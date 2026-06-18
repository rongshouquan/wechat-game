/**
 * 快速巡航/扫荡广告（C28）。
 *
 * 新增「看广告快速巡航已通关关卡获取收益」的纯 TS 服务，不触发真实战斗重跑（不调用 BattleEngine/runLevelBattle）。
 *
 * 设计要点：
 * - 只允许对【已通关】关卡巡航：levelId 必须在 playerState.clearedLevelIds 中，否则拒绝。
 * - 不重跑战斗：产出由传入的 reward_config（配置驱动）直接折算到玩家资源，不做任何战斗模拟。
 * - 收益前置：必须广告 completed 且 C25 AdRewardFlowService 产出 granted；中断 / 失败 / 限频 / 重复一律不发奖。
 * - 限频：复用 C25 的每日 / 会话 / 冷却（经 AdRewardFlowService -> AdFrequencyService）。
 * - 防重：以 contextId 作为广告 flow 的 opportunityId / flow key，重复回调不重复发奖；发奖经 RewardLedger，不绕过。
 * - 发奖应用失败：沿用 C26/C27 语义——复用已 completed 但未确认的广告 flow 重试，不重播广告、不再消耗次数。
 * - 不依赖 cc / wx，不做强制广告，不做 UI；对 ads 层仅 import type，core 不产生对 ads 的运行时依赖。
 */
import type { AdFrequencyRejectReason } from '../ads/AdFrequencyService';
import type { AdRewardFlowOutcome, AdRewardRequest, AdRewardFlowService } from '../ads/AdRewardFlowService';
import { AdConfig, RewardConfig } from '../config/ConfigTypes';
import { PlayerState } from './PlayerState';
import { RewardFlowEntry, RewardLedger } from './RewardLedger';

/** 默认快速巡航广告位（对应 ad_config.sample.json 的 ad_quick_cruise）。 */
export const DEFAULT_QUICK_CRUISE_AD_SLOT_ID = 'ad_quick_cruise';

export type QuickCruiseStatus =
  | 'granted' // 广告完成 + 巡航产出应用成功
  | 'not_cleared' // 关卡未通关，拒绝巡航
  | 'already_claimed' // 同一巡航上下文已发（含重复回调）
  | 'rejected_frequency' // 广告每日 / 会话 / 冷却限频拒绝
  | 'ad_not_completed' // 广告中断 / 失败 -> 不发奖
  | 'grant_failed' // 产出应用失败，可重试
  | 'unknown_slot';

export interface QuickCruiseResult {
  status: QuickCruiseStatus;
  granted: boolean;
  levelId: string;
  contextId: string;
  /** 广告（巡航）防重 flow key（= `${flowKeyPrefix}_${contextId}`）。 */
  flowKey: string;
  /** 巡航流水 flowId（即广告 flow，rewardId=巡航奖励）。 */
  cruiseFlowId?: string;
  frequencyReason?: AdFrequencyRejectReason;
  adStatus?: AdRewardFlowOutcome['status'];
  retryable: boolean;
  log: string[];
}

export interface QuickCruiseParams {
  rewardLedger: RewardLedger;
  playerState: PlayerState;
  /** 要巡航的关卡 id（必须已通关）。 */
  levelId: string;
  /** 本次巡航唯一 id（同一次巡航 / 同一次结算），作为广告防重 flow key 后缀；多次巡航须传不同值。 */
  contextId: string;
  /** 配置驱动的巡航产出（来自 reward_config，通常为被巡航关卡的奖励或专设巡航奖励）。 */
  cruiseReward: RewardConfig;
  now: number;
  /**
   * 应用巡航产出到玩家状态（默认按 reward_config 折算资源并返回 true）。返回 false 表示应用失败，可重试。
   */
  applyReward?: (state: PlayerState, reward: RewardConfig) => boolean;
}

export interface QuickCruiseOptions {
  adSlotId?: string;
}

function defaultApplyCruise(state: PlayerState, reward: RewardConfig): boolean {
  state.resources.starCoin += reward.starCoin ?? 0;
  state.resources.expChip += reward.expChip ?? 0;
  state.resources.equipmentPart += reward.equipmentPart ?? 0;
  state.resources.baseEnergy += reward.baseEnergy ?? 0;
  return true;
}

/**
 * 快速巡航服务：对已通关关卡，在「广告 completed + C25 flow granted」后发放配置驱动的巡航产出，
 * 受每日 / 会话 / 冷却限制并经 RewardLedger + flow key 防重。不触发任何真实战斗。
 */
export class QuickCruiseService {
  private readonly configs: Map<string, AdConfig>;
  private readonly adSlotId: string;

  constructor(
    private readonly adFlow: AdRewardFlowService,
    configs: AdConfig[] | Map<string, AdConfig>,
    options?: QuickCruiseOptions,
  ) {
    this.configs = configs instanceof Map ? configs : new Map(configs.map((c) => [c.adSlotId, c]));
    this.adSlotId = options?.adSlotId ?? DEFAULT_QUICK_CRUISE_AD_SLOT_ID;
  }

  /**
   * 主动触发一次「看广告快速巡航」。必须由玩家主动触发，不做强制广告，不重跑战斗。
   * 仅在关卡已通关且广告 completed + C25 flow granted 后发放巡航产出。
   */
  async requestCruiseViaAd(params: QuickCruiseParams): Promise<QuickCruiseResult> {
    const { levelId, contextId } = params;
    const cfg = this.configs.get(this.adSlotId);
    const flowKey = cfg ? `${cfg.flowKeyPrefix}_${contextId}` : `unknown_${contextId}`;
    const base = { levelId, contextId, flowKey };
    const log: string[] = [];

    if (!cfg) {
      log.push('quick_cruise_unknown_slot');
      return { ...base, status: 'unknown_slot', granted: false, retryable: false, log };
    }

    // 只允许已通关关卡巡航。
    if (!params.playerState.clearedLevelIds.includes(levelId)) {
      log.push('quick_cruise_not_cleared');
      return { ...base, status: 'not_cleared', granted: false, retryable: false, log };
    }

    // 同一巡航上下文已发（广告 flow 已 confirmed）-> 判重拒绝。
    if (this.hasConfirmedCruise(params.rewardLedger, flowKey, cfg.rewardId)) {
      log.push('quick_cruise_already_claimed');
      return { ...base, status: 'already_claimed', granted: false, retryable: false, log };
    }

    // 发奖应用失败重试：复用已 completed 但未确认（granted/failed）的广告 flow，不重播广告、不再消耗次数。
    const reusable = this.adFlow.findReusableAdFlow(params.rewardLedger, this.adSlotId, contextId);
    if (reusable) {
      log.push('quick_cruise_reuse_ad_flow');
      return this.finalize(params, base, reusable, undefined, log);
    }

    // 主动播放广告（C25 处理每日 / 会话 / 冷却限频与广告维度防重）。
    const adReq: AdRewardRequest = { adSlotId: this.adSlotId, opportunityId: contextId };
    const adOutcome = await this.adFlow.requestAdReward(params.rewardLedger, adReq, params.now);
    log.push(`quick_cruise_ad_${adOutcome.status}`);

    if (adOutcome.status === 'rejected_frequency') {
      return {
        ...base,
        status: 'rejected_frequency',
        granted: false,
        frequencyReason: adOutcome.frequencyReason,
        retryable: adOutcome.retryable,
        log,
      };
    }
    if (adOutcome.status !== 'granted' || !adOutcome.flowEntry) {
      const status: QuickCruiseStatus = adOutcome.status === 'duplicate' ? 'already_claimed' : 'ad_not_completed';
      return { ...base, status, granted: false, adStatus: adOutcome.status, retryable: adOutcome.retryable, log };
    }

    return this.finalize(params, base, adOutcome.flowEntry, adOutcome.status, log);
  }

  private finalize(
    params: QuickCruiseParams,
    base: { levelId: string; contextId: string; flowKey: string },
    adEntry: RewardFlowEntry,
    adStatus: AdRewardFlowOutcome['status'] | undefined,
    log: string[],
  ): QuickCruiseResult {
    const apply = params.applyReward ?? defaultApplyCruise;
    const applied = apply(params.playerState, params.cruiseReward);

    if (!applied) {
      // 应用失败：广告 flow 置 failed（保留为可复用），整笔可重试（复用广告、不重播）。
      this.adFlow.settleReward(adEntry, false);
      log.push('quick_cruise_apply_failed');
      return { ...base, status: 'grant_failed', granted: false, cruiseFlowId: adEntry.flowId, adStatus, retryable: true, log };
    }

    // 应用成功：结算广告（巡航）flow -> confirmed。
    this.adFlow.settleReward(adEntry, true);
    log.push('quick_cruise_granted');
    return { ...base, status: 'granted', granted: true, cruiseFlowId: adEntry.flowId, adStatus, retryable: false, log };
  }

  private hasConfirmedCruise(ledger: RewardLedger, flowKey: string, rewardId: string): boolean {
    return ledger.entries.some((e) => e.sourceId === flowKey && e.rewardId === rewardId && e.status === 'confirmed');
  }
}
