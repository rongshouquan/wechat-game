/**
 * 碎片合成（C20b）。
 *
 * 纯 TypeScript 模块，不依赖 cc：消耗已累计的角色碎片（C20a 的 heroFragments）合成角色；
 * 未拥有角色合成成功后加入 ownedHeroIds，已拥有角色再合成则按配置转化为资源（dupe）。
 *
 * 关键约束（与《C20-P 技术预案》一致）：
 * - 配置驱动：默认 DEFAULT_CRAFT_CONFIG，可注入 config 覆盖（阈值/重复转化资源可调参）。
 * - 单次 craftHero：碎片不足拒绝；恰好/超出阈值成功扣 threshold，保留余量。
 * - RewardLedger 只用于"合成入账防重"：sourceId=craft_${craftCount}（成功前计数），
 *   rewardId=hero_craft。碎片校验 -> 防重 -> 入账 在同一同步调用内原子完成。
 * - granted 后才扣碎片、入账（拥有/转资源）、confirmRewardGrant、记录 flowId、craftCount++；
 *   duplicate 与碎片不足均不扣碎片、不入账、不递增 craftCount。
 * - 不做高级/心愿/SSR 大保底，不接广告。
 */
import { PlayerResources, PlayerState } from './PlayerState';
import { RewardLedger, confirmRewardGrant, requestRewardGrant } from './RewardLedger';

/** 碎片合成配置（配置驱动：阈值与重复合成转化资源均可调参）。 */
export interface CraftConfig {
  /** 合成一个角色所需碎片阈值。 */
  thresholdPerHero: number;
  /** 已拥有角色再次合成时转化的资源（PlayerResources 子集）。 */
  dupeResourceOnOwned: Partial<PlayerResources>;
}

/**
 * 默认碎片合成配置（占位数值，待数值设计稿到位后调参；结构不变）。
 */
export const DEFAULT_CRAFT_CONFIG: CraftConfig = {
  thresholdPerHero: 60,
  dupeResourceOnOwned: { expChip: 20 },
};

/** 合成固定奖励标识；与 craftCount 组合成唯一 sourceId 用于合成防重。 */
const CRAFT_REWARD_ID = 'hero_craft';

const RESOURCE_KEYS: (keyof PlayerResources)[] = ['starCoin', 'expChip', 'equipmentPart', 'baseEnergy'];

export interface CraftHeroResult {
  granted: boolean;
  /** 同一窗口（craftCount）重复合成被防重拒绝。 */
  duplicate: boolean;
  /** 碎片不足被拒绝。 */
  insufficient: boolean;
  heroId: string;
  /** 本次是否为首次拥有该角色。 */
  ownedNew: boolean;
  /** 已拥有角色重复合成转化的资源（仅 granted 且已拥有时非空）。 */
  dupeResources: Partial<PlayerResources>;
  threshold: number;
  /** 扣减后该角色剩余碎片（保留余量）。 */
  fragmentsRemaining: number;
  flowId?: string;
  /** 本次后建议落盘的 craftCount（granted 时 +1，否则维持）。 */
  nextCraftCount: number;
  log: string[];
}

export interface CraftHeroParams {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  heroId: string;
  config?: CraftConfig;
}

/**
 * 单次合成一个角色：
 * 1. 校验该角色碎片是否达到阈值；不足直接拒绝，不写 RewardLedger、不扣碎片、不入账、不递增 craftCount。
 * 2. RewardLedger 防重：sourceId=craft_${craftCount}、rewardId=hero_craft；
 *    duplicate 时不扣碎片、不入账、不递增。
 * 3. granted 后（同一同步调用内原子完成）：扣 threshold 碎片（保留余量）-> 未拥有则加入
 *    ownedHeroIds，已拥有则按 dupeResourceOnOwned 转化资源 -> confirmRewardGrant ->
 *    记录 flowId -> craftCount++。
 * 调用方据 nextCraftCount 落盘（C08），保证杀进程重进不重复合成。
 */
export function craftHero(params: CraftHeroParams): CraftHeroResult {
  const config = params.config ?? DEFAULT_CRAFT_CONFIG;
  const state = params.playerState;
  const { heroId } = params;
  const threshold = config.thresholdPerHero;
  const log: string[] = [];

  const current = state.heroFragments[heroId] ?? 0;

  // 1. 碎片不足拒绝（不写流水/不扣碎片/不入账/不递增）
  if (current < threshold) {
    log.push('craft_insufficient_fragments');
    return {
      granted: false,
      duplicate: false,
      insufficient: true,
      heroId,
      ownedNew: false,
      dupeResources: {},
      threshold,
      fragmentsRemaining: current,
      nextCraftCount: state.craftCount,
      log,
    };
  }

  // 2. RewardLedger 防重（使用成功前计数）
  const sourceId = `craft_${state.craftCount}`;
  const outcome = requestRewardGrant(params.rewardLedger, sourceId, CRAFT_REWARD_ID);
  log.push(...outcome.log);

  if (!outcome.granted) {
    log.push('craft_duplicate_rejected');
    return {
      granted: false,
      duplicate: outcome.duplicate,
      insufficient: false,
      heroId,
      ownedNew: false,
      dupeResources: {},
      threshold,
      fragmentsRemaining: current,
      flowId: outcome.entry.flowId,
      nextCraftCount: state.craftCount,
      log,
    };
  }

  // 3. granted：扣 threshold（保留余量）、拥有/转资源、确认、记录、递增
  state.heroFragments[heroId] = current - threshold;

  let ownedNew = false;
  const dupeResources: Partial<PlayerResources> = {};
  if (!state.ownedHeroIds.includes(heroId)) {
    state.ownedHeroIds.push(heroId);
    ownedNew = true;
    log.push('craft_hero_owned');
  } else {
    for (const key of RESOURCE_KEYS) {
      const amount = config.dupeResourceOnOwned[key] ?? 0;
      if (amount > 0) {
        state.resources[key] += amount;
        dupeResources[key] = amount;
      }
    }
    log.push('craft_dupe_to_resources');
  }

  confirmRewardGrant(outcome.entry);
  if (!state.claimedRewardFlowIds.includes(outcome.entry.flowId)) {
    state.claimedRewardFlowIds.push(outcome.entry.flowId);
  }
  state.craftCount += 1;
  log.push('craft_granted');

  return {
    granted: true,
    duplicate: false,
    insufficient: false,
    heroId,
    ownedNew,
    dupeResources,
    threshold,
    fragmentsRemaining: state.heroFragments[heroId],
    flowId: outcome.entry.flowId,
    nextCraftCount: state.craftCount,
    log,
  };
}
