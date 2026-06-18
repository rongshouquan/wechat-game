/**
 * 离线收益（C11）。
 *
 * 纯 TypeScript 模块，不依赖 cc：根据上次离线时间戳与当前时间计算可领取的离线收益，
 * 通过 RewardLedger 防重发放，领取结果可写回 C08 存档。
 *
 * 关键约束：
 * - 默认封顶 8 小时（超过按 8 小时计），封顶时长与单位时间收益率均由配置驱动（见 OfflineRewardConfig），
 *   不写死在逻辑分支里，便于后续调参。
 * - 时间来源遵循《存档与防重规格》：本服务不直接读系统时间，now/lastOnlineTime 由调用方传入
 *   （调用方负责服务器时间优先、本地时间兜底，防止改本地时间刷收益）。
 * - 本文件仅实现 1 倍基础离线收益；广告 2 倍路径见 OfflineRewardDoubleService（C26），
 *   二者共用本文件导出的离线窗口防重锚点（buildOfflineSourceId + OFFLINE_REWARD_ID）实现 1 倍/2 倍互斥。
 * - 领取走 RewardLedger 防重，同一离线窗口不可重复领取。
 */
import { PlayerState } from './PlayerState';
import { RewardLedger, confirmRewardGrant, requestRewardGrant } from './RewardLedger';

export interface OfflineRewardRate {
  starCoinPerHour: number;
  expChipPerHour: number;
}

/** 离线收益配置（配置驱动：封顶时长与单位时间收益率均可在此调参）。 */
export interface OfflineRewardConfig {
  /** 离线收益封顶时长（小时），超过部分不再累计。 */
  maxOfflineHours: number;
  /** 单位时间（每小时）收益率。 */
  baseRate: OfflineRewardRate;
}

/**
 * 默认离线收益配置（S5C-05 数值初稿，《S5C-05 数值初稿与试玩验收草案》§3.5）：
 * 每小时 120/24，封顶 8 小时（封顶 8h 为规格强制要求）。8 小时上限 960/192，
 * 约等于 1 次低等级关键升级补量，不直接跳过 1-5→1-10 核心循环；可调参不改结构。
 */
export const DEFAULT_OFFLINE_REWARD_CONFIG: OfflineRewardConfig = {
  maxOfflineHours: 8,
  baseRate: { starCoinPerHour: 120, expChipPerHour: 24 },
};

const MS_PER_HOUR = 60 * 60 * 1000;

/** 离线收益固定来源标识前缀；与 lastOnlineTime 组合成唯一 sourceId 用于防重。 */
export const OFFLINE_REWARD_ID = 'offline_reward';

export interface OfflineRewardAmount {
  starCoin: number;
  expChip: number;
}

export interface OfflineRewardCalculation {
  /** 原始离线时长（毫秒，已对负数做下限 0 处理）。 */
  offlineMs: number;
  /** 计入收益的有效时长（小时，已封顶）。 */
  cappedHours: number;
  /** 原始离线时长是否已超过封顶时长。 */
  capped: boolean;
  reward: OfflineRewardAmount;
  /** 是否存在可领取的非零离线收益。 */
  claimable: boolean;
  log: string[];
}

export interface OfflineRewardCalcParams {
  lastOnlineTime: number;
  now: number;
  /** 玩家是否已有通关进度；无进度时不产生离线收益（兜底，避免新存档异常刷收益）。 */
  hasProgress: boolean;
  config?: OfflineRewardConfig;
}

/**
 * 计算离线收益（纯计算，不发放、不改状态）。
 * - 离线时长封顶在 config.maxOfflineHours。
 * - 无通关进度时收益为 0（兜底）。
 */
export function calculateOfflineReward(params: OfflineRewardCalcParams): OfflineRewardCalculation {
  const config = params.config ?? DEFAULT_OFFLINE_REWARD_CONFIG;
  const log: string[] = [];

  const offlineMs = Math.max(0, params.now - params.lastOnlineTime);
  const rawHours = offlineMs / MS_PER_HOUR;
  const capped = rawHours > config.maxOfflineHours;
  const cappedHours = Math.min(rawHours, config.maxOfflineHours);
  if (capped) {
    log.push('offline_reward_capped_at_8h');
  }

  if (!params.hasProgress) {
    log.push('offline_reward_no_progress_fallback');
    return { offlineMs, cappedHours, capped, reward: { starCoin: 0, expChip: 0 }, claimable: false, log };
  }

  const reward: OfflineRewardAmount = {
    starCoin: Math.floor(config.baseRate.starCoinPerHour * cappedHours),
    expChip: Math.floor(config.baseRate.expChipPerHour * cappedHours),
  };
  const claimable = reward.starCoin > 0 || reward.expChip > 0;

  return { offlineMs, cappedHours, capped, reward, claimable, log };
}

export interface OfflineRewardClaimResult {
  granted: boolean;
  duplicate: boolean;
  calculation: OfflineRewardCalculation;
  /** 本次领取后建议写入存档的新 lastOnlineTime（领取成功时为 now，关闭离线窗口）。 */
  nextLastOnlineTime: number;
  flowId?: string;
  log: string[];
}

export interface OfflineRewardClaimParams extends OfflineRewardCalcParams {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
}

/** 把离线窗口的起始时间戳折算为防重用的 sourceId（同一离线窗口领取一次后即被锁定）。 */
export function buildOfflineSourceId(lastOnlineTime: number): string {
  return `offline_${lastOnlineTime}`;
}

/**
 * 领取离线收益：
 * - 先计算收益；不可领取（0 收益/无进度）时直接返回，不写流水。
 * - 可领取时经 RewardLedger 防重：同一离线窗口已发放过则记为 duplicate 并拒绝。
 * - 发放成功后把收益加到玩家资源、确认流水、并把 lastOnlineTime 推进到 now（关闭该离线窗口）。
 *   调用方据 nextLastOnlineTime 落盘（C08），保证杀进程重进不重复发奖。
 */
export function claimOfflineReward(params: OfflineRewardClaimParams): OfflineRewardClaimResult {
  const calculation = calculateOfflineReward(params);
  const log = [...calculation.log];

  if (!calculation.claimable) {
    log.push('offline_reward_nothing_to_claim');
    return { granted: false, duplicate: false, calculation, nextLastOnlineTime: params.lastOnlineTime, log };
  }

  const sourceId = buildOfflineSourceId(params.lastOnlineTime);
  const outcome = requestRewardGrant(params.rewardLedger, sourceId, OFFLINE_REWARD_ID);
  log.push(...outcome.log);

  if (!outcome.granted) {
    log.push('offline_reward_duplicate_rejected');
    return { granted: false, duplicate: outcome.duplicate, calculation, nextLastOnlineTime: params.lastOnlineTime, flowId: outcome.entry.flowId, log };
  }

  params.playerState.resources.starCoin += calculation.reward.starCoin;
  params.playerState.resources.expChip += calculation.reward.expChip;
  confirmRewardGrant(outcome.entry);
  if (!params.playerState.claimedRewardFlowIds.includes(outcome.entry.flowId)) {
    params.playerState.claimedRewardFlowIds.push(outcome.entry.flowId);
  }
  log.push('offline_reward_granted');

  return { granted: true, duplicate: false, calculation, nextLastOnlineTime: params.now, flowId: outcome.entry.flowId, log };
}
