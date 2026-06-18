/**
 * 普通补给抽取（C20a）。
 *
 * 纯 TypeScript 模块，不依赖 cc：消耗 baseEnergy 抽取一次普通补给，按配置加权命中条目，
 * 结果以碎片优先（命中资源条目时也补足保底碎片），领取入账走 RewardLedger 防重。
 *
 * 关键约束（与《C20-P 技术预案》一致）：
 * - 核心随机必须由调用方注入 RandomSource，核心逻辑禁止直接 Math.random；
 *   defaultRandomSource 仅供表现层显式传入，核心层与随机来源解耦。
 * - 配置驱动：默认 DEFAULT_SUPPLY_CONFIG，可注入 config 覆盖（概率/保底/消耗均可调参）。
 * - 不直接产出角色（角色仅由 C20b 碎片合成获得），不做高级/心愿/SSR 大保底。
 * - RewardLedger 只用于"领取入账防重"：sourceId=supply_${supplyDrawCount}（成功前计数），
 *   rewardId=supply_draw。资源校验 -> 防重 -> 入账 在同一同步调用内原子完成。
 * - 本服务不直接读系统时间。
 */
import { PlayerResources, PlayerState } from './PlayerState';
import { RewardFragment } from '../config/ConfigTypes';
import { RewardLedger, confirmRewardGrant, requestRewardGrant } from './RewardLedger';

/** 随机源：返回 [0,1) 的浮点数。核心抽取强制注入，便于 Vitest 固定结果。 */
export type RandomSource = () => number;

/** 默认随机源（仅供表现层显式传入；核心逻辑不得隐式使用）。 */
export const defaultRandomSource: RandomSource = () => Math.random();

/** 补给池条目：加权命中，可产出碎片和/或资源。 */
export interface SupplyPoolEntry {
  /** 加权权重，必须 > 0。 */
  weight: number;
  /** 碎片产出（复用 reward 的 {heroId,count} 结构）。 */
  fragments?: RewardFragment[];
  /** 资源产出（PlayerResources 子集）。 */
  resources?: Partial<PlayerResources>;
}

/** 普通补给配置（配置驱动：消耗/保底/概率池均可在此调参）。 */
export interface SupplyConfig {
  /** 单抽消耗的 baseEnergy。 */
  costBaseEnergy: number;
  /** 每抽保底碎片数（命中碎片不足此数时由 pity 角色补足）。 */
  minFragmentsPerDraw: number;
  /** 保底碎片归属角色（须为 hero_config 中既有 heroId）。 */
  pityFragmentHeroId: string;
  /** 加权概率池，碎片优先。 */
  pool: SupplyPoolEntry[];
}

/**
 * 默认普通补给配置（占位数值，待数值设计稿到位后调参；结构不变）。
 * 池内碎片条目权重占多数（碎片优先），资源条目作为兜底（仍受保底碎片约束）。
 */
export const DEFAULT_SUPPLY_CONFIG: SupplyConfig = {
  costBaseEnergy: 50,
  minFragmentsPerDraw: 1,
  pityFragmentHeroId: 'hero_ryan',
  pool: [
    { weight: 50, fragments: [{ heroId: 'hero_ryan', count: 2 }] },
    { weight: 30, fragments: [{ heroId: 'hero_vex', count: 2 }] },
    { weight: 15, fragments: [{ heroId: 'hero_mia', count: 1 }] },
    { weight: 5, resources: { starCoin: 100 } },
  ],
};

/** 补给抽取固定奖励标识；与 supplyDrawCount 组合成唯一 sourceId 用于领取防重。 */
const SUPPLY_REWARD_ID = 'supply_draw';

const RESOURCE_KEYS: (keyof PlayerResources)[] = ['starCoin', 'expChip', 'equipmentPart', 'baseEnergy'];

export interface SupplyDrawResult {
  granted: boolean;
  /** 同一窗口（supplyDrawCount）重复领取被防重拒绝。 */
  duplicate: boolean;
  /** baseEnergy 不足被拒绝。 */
  insufficient: boolean;
  /** 命中的池下标（-1 表示未发放）。 */
  entryIndex: number;
  /** 本次实际发放的碎片（heroId -> count，含保底补足）。 */
  fragments: Record<string, number>;
  /** 本次实际发放的资源（仅含 >0 项）。 */
  resources: Partial<PlayerResources>;
  /** 本次消耗的 baseEnergy（仅 granted 时真正扣减）。 */
  costBaseEnergy: number;
  flowId?: string;
  /** 本次后建议落盘的 supplyDrawCount（granted 时 +1，否则维持）。 */
  nextSupplyDrawCount: number;
  log: string[];
}

export interface SupplyDrawParams {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  /** 注入的随机源（核心强制提供）。 */
  rng: RandomSource;
  config?: SupplyConfig;
}

/** 加权命中：roll = rng()*总权重，遍历累加命中首个区间；浮点误差时兜底命中最后一条。 */
function pickEntryIndex(pool: SupplyPoolEntry[], rng: RandomSource): number {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < pool.length; i += 1) {
    cumulative += pool[i].weight;
    if (roll < cumulative) {
      return i;
    }
  }
  return pool.length - 1;
}

function addFragment(state: PlayerState, gained: Record<string, number>, heroId: string, count: number): void {
  state.heroFragments[heroId] = (state.heroFragments[heroId] ?? 0) + count;
  gained[heroId] = (gained[heroId] ?? 0) + count;
}

/**
 * 抽取一次普通补给：
 * 1. 校验 baseEnergy 是否足够；不足直接拒绝，不写 RewardLedger、不扣资源、不递增 supplyDrawCount。
 * 2. RewardLedger 防重：sourceId=supply_${supplyDrawCount}、rewardId=supply_draw；
 *    duplicate 时不扣资源、不入账、不递增。
 * 3. granted 后（同一同步调用内原子完成）：按 rng 命中池条目 -> 入账碎片（含保底补足）/资源
 *    -> 扣 baseEnergy -> confirmRewardGrant -> 记录 flowId -> supplyDrawCount++。
 * 调用方据 nextSupplyDrawCount 落盘（C08），保证杀进程重进不重复发奖。
 */
export function drawSupply(params: SupplyDrawParams): SupplyDrawResult {
  const config = params.config ?? DEFAULT_SUPPLY_CONFIG;
  const state = params.playerState;
  const log: string[] = [];

  // 1. 资源校验（不足拒绝，不写流水/不扣费/不递增）
  if (state.resources.baseEnergy < config.costBaseEnergy) {
    log.push('supply_insufficient_base_energy');
    return {
      granted: false,
      duplicate: false,
      insufficient: true,
      entryIndex: -1,
      fragments: {},
      resources: {},
      costBaseEnergy: config.costBaseEnergy,
      nextSupplyDrawCount: state.supplyDrawCount,
      log,
    };
  }

  // 2. RewardLedger 防重（使用成功前计数）
  const sourceId = `supply_${state.supplyDrawCount}`;
  const outcome = requestRewardGrant(params.rewardLedger, sourceId, SUPPLY_REWARD_ID);
  log.push(...outcome.log);

  if (!outcome.granted) {
    log.push('supply_duplicate_rejected');
    return {
      granted: false,
      duplicate: outcome.duplicate,
      insufficient: false,
      entryIndex: -1,
      fragments: {},
      resources: {},
      costBaseEnergy: config.costBaseEnergy,
      flowId: outcome.entry.flowId,
      nextSupplyDrawCount: state.supplyDrawCount,
      log,
    };
  }

  // 3. granted：命中、入账、保底、扣费、确认、记录、递增
  const entryIndex = pickEntryIndex(config.pool, params.rng);
  const entry = config.pool[entryIndex];

  const fragments: Record<string, number> = {};
  let fragmentTotal = 0;
  for (const f of entry.fragments ?? []) {
    addFragment(state, fragments, f.heroId, f.count);
    fragmentTotal += f.count;
  }
  if (fragmentTotal < config.minFragmentsPerDraw) {
    addFragment(state, fragments, config.pityFragmentHeroId, config.minFragmentsPerDraw - fragmentTotal);
    log.push('supply_pity_fragment_applied');
  }

  const resources: Partial<PlayerResources> = {};
  for (const key of RESOURCE_KEYS) {
    const amount = entry.resources?.[key] ?? 0;
    if (amount > 0) {
      state.resources[key] += amount;
      resources[key] = amount;
    }
  }

  state.resources.baseEnergy -= config.costBaseEnergy;

  confirmRewardGrant(outcome.entry);
  if (!state.claimedRewardFlowIds.includes(outcome.entry.flowId)) {
    state.claimedRewardFlowIds.push(outcome.entry.flowId);
  }
  state.supplyDrawCount += 1;
  log.push('supply_draw_granted');

  return {
    granted: true,
    duplicate: false,
    insufficient: false,
    entryIndex,
    fragments,
    resources,
    costBaseEnergy: config.costBaseEnergy,
    flowId: outcome.entry.flowId,
    nextSupplyDrawCount: state.supplyDrawCount,
    log,
  };
}
