/**
 * 采矿站（C19）。
 *
 * 纯 TypeScript 模块，不依赖 cc：采矿站按时间持续产出资源，产率与封顶由配置驱动，
 * 领取入账走 RewardLedger 防重，领取结果可写回 C08 存档。
 *
 * 关键约束（与《C19-P 采矿站技术预案》一致）：
 * - 与 C11 离线收益硬隔离：本服务只用自身的 miningStation.lastCollectTime，
 *   绝不读写 SaveData.lastOnlineTime，绝不复用 offline 的 sourceId/rewardId。
 * - 持续产出按时间惰性计算，不在存档里存"已囤积数量"——领取入账是唯一改资源的写路径。
 * - RewardLedger 只用于"领取入账防重"，不用于持续产出计算：accrual 是纯函数，不写流水。
 * - 时间来源遵循《存档与防重规格》：本服务不直接读系统时间，now/lastCollectTime 由调用方传入
 *   （调用方负责服务器时间优先、本地时间兜底，防止改本地时间刷收益）。
 * - 仅实现 1 倍基础产出，不接广告加速（广告翻倍属后续阶段）。
 */
import { PlayerState } from './PlayerState';
import { RewardLedger, confirmRewardGrant, requestRewardGrant } from './RewardLedger';

/** 采矿站每小时产率（当前仅产 baseEnergy，结构便于后续扩展）。 */
export interface MiningYield {
  baseEnergy: number;
}

/** 采矿站配置（配置驱动：封顶时长与单位时间产率均可在此调参）。 */
export interface MiningStationConfig {
  /** 囤积封顶时长（小时），超过部分不再累计（溢出丢弃）。 */
  maxStorageHours: number;
  /** 单位时间（每小时）产率。 */
  ratePerHour: MiningYield;
}

/**
 * 默认采矿站配置（占位数值，待数值设计稿到位后调参；结构不变）。
 */
export const DEFAULT_MINING_STATION_CONFIG: MiningStationConfig = {
  maxStorageHours: 12,
  ratePerHour: { baseEnergy: 300 },
};

/**
 * 采矿站状态（存档内，挂在 PlayerState 下）。
 * 不存"已囤积数量"，囤积量始终由 lastCollectTime 惰性按时间计算。
 */
export interface MiningStationState {
  /** 是否已解锁/建成，未解锁不产出（门禁）。 */
  unlocked: boolean;
  /** 上次领取（或惰性锚定）的时间戳(ms)；<=0 表示未初始化（惰性锚定哨兵）。 */
  lastCollectTime: number;
}

/** 采矿站默认状态：已解锁、时间戳未锚定（首次 accrual 时锚定为 now，不爆收益）。 */
export function createDefaultMiningStationState(): MiningStationState {
  return { unlocked: true, lastCollectTime: 0 };
}

const MS_PER_HOUR = 60 * 60 * 1000;

/** 采矿站固定奖励标识；与 lastCollectTime 组合成唯一 sourceId 用于领取防重。 */
const MINING_REWARD_ID = 'mining_collect';

export interface MiningStationCalculation {
  /** 自上次领取以来的原始时长（毫秒，已对负数做下限 0 处理）。 */
  elapsedMs: number;
  /** 计入产出的有效时长（小时，已封顶）。 */
  cappedHours: number;
  /** 原始时长是否已超过封顶时长。 */
  capped: boolean;
  yield: MiningYield;
  /** 是否存在可领取的非零产出（含解锁/惰性锚定门禁判定）。 */
  claimable: boolean;
  /** 是否为首次惰性锚定（lastCollectTime<=0）：本次产出 0，但需把锚点推进到 now。 */
  needsAnchor: boolean;
  log: string[];
}

export interface MiningStationCalcParams {
  station: MiningStationState;
  now: number;
  config?: MiningStationConfig;
}

/**
 * 计算采矿站当前可领取产出（纯计算，不发放、不改状态、不写流水）。
 * - lastCollectTime<=0：首次惰性锚定，产出 0、needsAnchor=true（调用方应把锚点推进到 now）。
 * - 未解锁：产出 0、不可领取。
 * - 时长封顶在 config.maxStorageHours，溢出丢弃。
 * - now<=lastCollectTime（零间隔/时间回退）：elapsed 取 0，产出 0、不可领取。
 */
export function calculateMiningYield(params: MiningStationCalcParams): MiningStationCalculation {
  const config = params.config ?? DEFAULT_MINING_STATION_CONFIG;
  const { station } = params;
  const log: string[] = [];

  if (station.lastCollectTime <= 0) {
    log.push('mining_first_anchor');
    return {
      elapsedMs: 0,
      cappedHours: 0,
      capped: false,
      yield: { baseEnergy: 0 },
      claimable: false,
      needsAnchor: true,
      log,
    };
  }

  if (!station.unlocked) {
    log.push('mining_locked_fallback');
    return {
      elapsedMs: 0,
      cappedHours: 0,
      capped: false,
      yield: { baseEnergy: 0 },
      claimable: false,
      needsAnchor: false,
      log,
    };
  }

  const elapsedMs = Math.max(0, params.now - station.lastCollectTime);
  const rawHours = elapsedMs / MS_PER_HOUR;
  const capped = rawHours > config.maxStorageHours;
  const cappedHours = Math.min(rawHours, config.maxStorageHours);
  if (capped) {
    log.push('mining_storage_capped');
  }

  const yield_: MiningYield = {
    baseEnergy: Math.floor(config.ratePerHour.baseEnergy * cappedHours),
  };
  const claimable = yield_.baseEnergy > 0;

  return { elapsedMs, cappedHours, capped, yield: yield_, claimable, needsAnchor: false, log };
}

export interface MiningStationClaimResult {
  granted: boolean;
  duplicate: boolean;
  /** 本次是否执行了首次惰性锚定（仅推进 lastCollectTime，不发奖）。 */
  anchored: boolean;
  calculation: MiningStationCalculation;
  /** 本次领取后建议落盘的新 lastCollectTime（领取成功或惰性锚定时为 now，否则维持原值）。 */
  nextLastCollectTime: number;
  flowId?: string;
  log: string[];
}

export interface MiningStationClaimParams {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  now: number;
  config?: MiningStationConfig;
}

/** 把领取窗口的起始时间戳折算为防重用的 sourceId（同一窗口领取一次后即被锁定）。 */
function buildMiningSourceId(lastCollectTime: number): string {
  return `mining_${lastCollectTime}`;
}

/**
 * 领取采矿站产出：
 * - 直接读写 playerState.miningStation（采矿站状态在 PlayerState 内）。
 * - 首次惰性锚定（lastCollectTime<=0）：把 lastCollectTime 推进到 now，不发奖、不写流水，anchored=true。
 * - 未解锁/零间隔/极短间隔（floor 后为 0）/时间回退：不发奖、不写流水、不推进 lastCollectTime。
 * - 可领取时经 RewardLedger 防重：同一窗口已发放过则记为 duplicate 并拒绝，不推进 lastCollectTime。
 * - 发放成功：资源入账（baseEnergy）、确认流水、记录 flowId、把 lastCollectTime 推进到 now（关闭该窗口）。
 *   调用方据 nextLastCollectTime 落盘（C08），保证杀进程重进不重复发奖。
 */
export function claimMiningYield(params: MiningStationClaimParams): MiningStationClaimResult {
  const station = params.playerState.miningStation;
  const calculation = calculateMiningYield({ station, now: params.now, config: params.config });
  const log = [...calculation.log];

  // 首次惰性锚定：仅把锚点推进到 now，不发奖、不写流水。
  if (calculation.needsAnchor) {
    station.lastCollectTime = params.now;
    log.push('mining_anchored');
    return { granted: false, duplicate: false, anchored: true, calculation, nextLastCollectTime: params.now, log };
  }

  if (!calculation.claimable) {
    log.push('mining_nothing_to_claim');
    return { granted: false, duplicate: false, anchored: false, calculation, nextLastCollectTime: station.lastCollectTime, log };
  }

  const sourceId = buildMiningSourceId(station.lastCollectTime);
  const outcome = requestRewardGrant(params.rewardLedger, sourceId, MINING_REWARD_ID);
  log.push(...outcome.log);

  if (!outcome.granted) {
    log.push('mining_collect_duplicate_rejected');
    return {
      granted: false,
      duplicate: outcome.duplicate,
      anchored: false,
      calculation,
      nextLastCollectTime: station.lastCollectTime,
      flowId: outcome.entry.flowId,
      log,
    };
  }

  params.playerState.resources.baseEnergy += calculation.yield.baseEnergy;
  confirmRewardGrant(outcome.entry);
  if (!params.playerState.claimedRewardFlowIds.includes(outcome.entry.flowId)) {
    params.playerState.claimedRewardFlowIds.push(outcome.entry.flowId);
  }
  station.lastCollectTime = params.now;
  log.push('mining_collect_granted');

  return { granted: true, duplicate: false, anchored: false, calculation, nextLastCollectTime: params.now, flowId: outcome.entry.flowId, log };
}
