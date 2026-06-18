/**
 * 离线收益「看广告 2 倍」路径（C26）。
 *
 * 在 C11 1 倍离线收益基础上新增「广告完整观看后领取 2 倍」的纯 TS 服务，不改 1 倍逻辑、不接 UI、不接真实广告账号。
 *
 * 设计要点：
 * - 1 倍路径（OfflineRewardService.claimOfflineReward）完全不变。
 * - 1 倍 / 2 倍互斥：二者共用同一离线窗口防重锚点（sourceId=offline_<lastOnlineTime>, rewardId=offline_reward），
 *   任一路径就同一窗口领取后，另一路径都会判重拒绝（杀进程重进亦不重复发奖）。
 * - 2 倍前置：必须广告 completed 且 C25 AdRewardFlowService 产出 granted；中断 / 失败 / 限频 / 重复一律不发 2 倍。
 * - 8 小时封顶不变：2 倍是对「已封顶基础收益」的金额翻倍，不放大离线累计时长。
 * - 奖励应用后结算广告 flow：成功 -> confirmed；应用失败 -> 离线流水与广告 flow 均置 failed，整笔可重试。
 * - 发奖应用失败重试：广告既已 completed，重试【复用】该已完成但 failed 的广告 flow 重新应用业务奖励，
 *   不重播广告、不再消耗广告次数、不受 cooldown/session/daily 拦截（见 AdRewardFlowService.findReusableAdFlow）。
 * - 不依赖 cc / wx；时间由调用方注入（now，遵循服务器时间优先）。对 ads 层仅做 import type，core 不产生对 ads 的运行时依赖。
 */
import type { AdRewardFlowOutcome, AdRewardRequest, AdRewardFlowService } from '../ads/AdRewardFlowService';
import { PlayerState } from './PlayerState';
import { confirmRewardGrant, requestRewardGrant, RewardFlowEntry, RewardLedger } from './RewardLedger';
import {
  buildOfflineSourceId,
  calculateOfflineReward,
  OFFLINE_REWARD_ID,
  OfflineRewardAmount,
  OfflineRewardCalculation,
  OfflineRewardConfig,
} from './OfflineRewardService';

/** 默认离线翻倍广告位（对应 ad_config.sample.json 的 ad_offline_double）。 */
export const DEFAULT_OFFLINE_DOUBLE_AD_SLOT_ID = 'ad_offline_double';

export type OfflineDoubleStatus =
  | 'granted_double' // 广告完成 + 应用 2 倍成功
  | 'nothing_to_claim' // 无可领取（0 收益 / 无进度）
  | 'already_claimed' // 同一离线窗口已领（1 倍或 2 倍），拒绝
  | 'ad_not_completed' // 广告中断 / 失败 / 限频 / 重复 / 未知位 -> 不发 2 倍
  | 'grant_failed'; // 奖励应用失败，可重试

export interface OfflineDoubleParams {
  lastOnlineTime: number;
  now: number;
  /** 是否已有通关进度；无进度不产生离线收益。 */
  hasProgress: boolean;
  config?: OfflineRewardConfig;
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  /** C25 广告奖励 flow 服务（注入，core 不直接依赖 ads 运行时）。 */
  adFlow: AdRewardFlowService;
  /** 广告位 id，默认 ad_offline_double。 */
  adSlotId?: string;
  /** 奖励应用钩子（默认把 2 倍金额加到玩家资源并返回 true）；返回 false 表示应用失败，可重试。 */
  applyReward?: (state: PlayerState, reward: OfflineRewardAmount) => boolean;
}

export interface OfflineDoubleResult {
  status: OfflineDoubleStatus;
  granted: boolean;
  calculation: OfflineRewardCalculation;
  /** granted 时实际发放的 2 倍金额；其余为 0。 */
  doubledReward: OfflineRewardAmount;
  /** 领取成功后建议写回存档的新 lastOnlineTime（granted 时为 now，关闭离线窗口）。 */
  nextLastOnlineTime: number;
  /** 离线窗口流水 id。 */
  offlineFlowId?: string;
  /** 广告 flow key。 */
  adFlowKey?: string;
  adStatus?: AdRewardFlowOutcome['status'];
  retryable: boolean;
  log: string[];
}

const ZERO: OfflineRewardAmount = { starCoin: 0, expChip: 0 };

function defaultApplyDouble(state: PlayerState, reward: OfflineRewardAmount): boolean {
  state.resources.starCoin += reward.starCoin;
  state.resources.expChip += reward.expChip;
  return true;
}

/** 该离线窗口是否已有有效发放（granted/confirmed）——1 倍或 2 倍任一领取后都会命中。 */
function hasGrantedOffline(ledger: RewardLedger, sourceId: string): boolean {
  return ledger.entries.some(
    (e) =>
      e.sourceId === sourceId &&
      e.rewardId === OFFLINE_REWARD_ID &&
      (e.status === 'granted' || e.status === 'confirmed'),
  );
}

/**
 * 领取「看广告 2 倍」离线收益。
 * 仅在广告 completed + C25 flow granted 后，按离线窗口防重锚点发放 2 倍金额；与 1 倍互斥。
 */
export async function claimOfflineRewardDoubleViaAd(params: OfflineDoubleParams): Promise<OfflineDoubleResult> {
  const calculation = calculateOfflineReward(params);
  const log = [...calculation.log];
  const adSlotId = params.adSlotId ?? DEFAULT_OFFLINE_DOUBLE_AD_SLOT_ID;
  const sourceId = buildOfflineSourceId(params.lastOnlineTime);

  if (!calculation.claimable) {
    log.push('offline_double_nothing_to_claim');
    return reject('nothing_to_claim', calculation, params.lastOnlineTime, false, log);
  }

  // 与 1 倍互斥：同一离线窗口已领（1 倍或 2 倍）则拒绝，不播广告、不消耗广告次数。
  if (hasGrantedOffline(params.rewardLedger, sourceId)) {
    log.push('offline_double_already_claimed');
    return reject('already_claimed', calculation, params.lastOnlineTime, false, log);
  }

  const doubledReward: OfflineRewardAmount = {
    starCoin: calculation.reward.starCoin * 2,
    expChip: calculation.reward.expChip * 2,
  };

  // 发奖应用失败重试：若该窗口已有「广告完成但未确认」的可复用广告 flow，
  // 则复用它重新应用业务奖励——不重播广告、不再消耗广告次数、不受 cooldown/session/daily 拦截。
  const reusable = params.adFlow.findReusableAdFlow(params.rewardLedger, adSlotId, sourceId);
  if (reusable) {
    log.push('offline_double_reuse_ad_flow');
    return applyAndFinalize(params, calculation, doubledReward, sourceId, reusable, reusable.sourceId, undefined, log);
  }

  // 正常路径：经 C25 限频 + 玩家主动播放广告；opportunityId 用离线窗口 id，保证广告维度也按窗口防重。
  const adReq: AdRewardRequest = { adSlotId, opportunityId: sourceId };
  const adOutcome = await params.adFlow.requestAdReward(params.rewardLedger, adReq, params.now);
  log.push(`offline_double_ad_${adOutcome.status}`);

  if (adOutcome.status !== 'granted' || !adOutcome.flowEntry) {
    return {
      status: 'ad_not_completed',
      granted: false,
      calculation,
      doubledReward: ZERO,
      nextLastOnlineTime: params.lastOnlineTime,
      adFlowKey: adOutcome.flowKey,
      adStatus: adOutcome.status,
      retryable: adOutcome.retryable,
      log,
    };
  }

  return applyAndFinalize(params, calculation, doubledReward, sourceId, adOutcome.flowEntry, adOutcome.flowKey, adOutcome.status, log);
}

/**
 * 广告已完成（拿到广告 flow 条目）后：在离线窗口锚点发放 2 倍并确认。
 * - 应用成功：离线流水 confirmed + 记录 flowId + 广告 flow confirmed + 推进 lastOnlineTime。
 * - 应用失败：离线流水与广告 flow 均置 failed（保留广告 flow 为可复用），整笔可重试（复用广告、不重播）。
 * adEntry 既可来自本次 requestAdReward，也可来自 findReusableAdFlow（重试复用）。
 */
function applyAndFinalize(
  params: OfflineDoubleParams,
  calculation: OfflineRewardCalculation,
  doubledReward: OfflineRewardAmount,
  sourceId: string,
  adEntry: RewardFlowEntry,
  adFlowKey: string,
  adStatus: AdRewardFlowOutcome['status'] | undefined,
  log: string[],
): OfflineDoubleResult {
  // 在离线窗口锚点申请发放（与 1 倍共锚，天然互斥防重）。
  const grant = requestRewardGrant(params.rewardLedger, sourceId, OFFLINE_REWARD_ID);
  log.push(...grant.log);
  if (!grant.granted) {
    // 兜底（理论上已被前置判重拦截）：窗口已发放 -> 撤销广告 flow（未实际发奖），不重复发 2 倍。
    params.adFlow.settleReward(adEntry, false);
    log.push('offline_double_duplicate_after_ad');
    return {
      status: 'already_claimed',
      granted: false,
      calculation,
      doubledReward: ZERO,
      nextLastOnlineTime: params.lastOnlineTime,
      offlineFlowId: grant.entry.flowId,
      adFlowKey,
      adStatus,
      retryable: false,
      log,
    };
  }

  const apply = params.applyReward ?? defaultApplyDouble;
  const applied = apply(params.playerState, doubledReward);

  if (!applied) {
    // 应用失败：离线流水与广告 flow 均置 failed（不计为已发放）；广告 flow 保留为可复用，整笔可重试。
    grant.entry.status = 'failed';
    params.adFlow.settleReward(adEntry, false);
    log.push('offline_double_apply_failed');
    return {
      status: 'grant_failed',
      granted: false,
      calculation,
      doubledReward: ZERO,
      nextLastOnlineTime: params.lastOnlineTime,
      offlineFlowId: grant.entry.flowId,
      adFlowKey,
      adStatus,
      retryable: true,
      log,
    };
  }

  // 应用成功：确认离线流水、记录 flowId、结算广告 flow(confirmed)、推进 lastOnlineTime 关闭窗口。
  confirmRewardGrant(grant.entry);
  if (!params.playerState.claimedRewardFlowIds.includes(grant.entry.flowId)) {
    params.playerState.claimedRewardFlowIds.push(grant.entry.flowId);
  }
  params.adFlow.settleReward(adEntry, true);
  log.push('offline_double_granted');

  return {
    status: 'granted_double',
    granted: true,
    calculation,
    doubledReward,
    nextLastOnlineTime: params.now,
    offlineFlowId: grant.entry.flowId,
    adFlowKey,
    adStatus,
    retryable: false,
    log,
  };
}

function reject(
  status: OfflineDoubleStatus,
  calculation: OfflineRewardCalculation,
  nextLastOnlineTime: number,
  retryable: boolean,
  log: string[],
): OfflineDoubleResult {
  return { status, granted: false, calculation, doubledReward: ZERO, nextLastOnlineTime, retryable, log };
}
