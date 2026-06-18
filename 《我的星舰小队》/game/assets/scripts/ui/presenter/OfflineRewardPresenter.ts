/**
 * 离线收益 Presenter（C14a，纯 TS）。
 *
 * 包装 C11 离线收益服务：展示可领取收益、执行领取（经 RewardLedger 防重），
 * 领取成功后推进 lastOnlineTime 并落盘，发出 offline_reward_claim 埋点。
 */
import { AppContext } from './AppContext';
import { AnalyticsEvent } from '../../analytics/AnalyticsService';
import {
  OfflineRewardCalculation,
  OfflineRewardClaimResult,
  claimOfflineReward,
} from '../../core/OfflineRewardService';

export interface OfflineRewardViewModel {
  calculation: OfflineRewardCalculation;
  claimable: boolean;
}

export class OfflineRewardPresenter {
  constructor(private readonly ctx: AppContext) {}

  getViewModel(): OfflineRewardViewModel {
    const calculation = this.ctx.getOfflineRewardCalculation();
    return { calculation, claimable: calculation.claimable };
  }

  /** 领取离线收益：成功则推进 lastOnlineTime 并落盘；无论结果都发出埋点。 */
  claim(): OfflineRewardClaimResult {
    const result = claimOfflineReward({
      lastOnlineTime: this.ctx.lastOnlineTime,
      now: this.ctx.now(),
      hasProgress: this.ctx.playerState.clearedLevelIds.length > 0,
      config: this.ctx.offlineConfig,
      playerState: this.ctx.playerState,
      rewardLedger: this.ctx.rewardLedger,
    });

    this.ctx.lastOnlineTime = result.nextLastOnlineTime;
    if (result.granted) {
      this.ctx.persist();
    }

    this.ctx.analytics.track(AnalyticsEvent.OfflineRewardClaim, this.ctx.playerState, {
      granted: result.granted,
      duplicate: result.duplicate,
      starCoin: result.calculation.reward.starCoin,
      expChip: result.calculation.reward.expChip,
      cappedHours: result.calculation.cappedHours,
      capped: result.calculation.capped,
    });

    return result;
  }
}
