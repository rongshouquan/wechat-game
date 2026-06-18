/**
 * 主界面推荐目标 Presenter（C14a，纯 TS）。
 *
 * 产出"当前主界面该展示什么目标"的 view-model（基于 C09 推荐目标组件），
 * 并在玩家采纳主目标时发出 goal_adopt 埋点、返回跳转意图供视图层路由。
 */
import { AppContext } from './AppContext';
import { AnalyticsEvent } from '../../analytics/AnalyticsService';
import {
  NavigationIntent,
  RecommendedTargetResult,
  resolveRecommendedTarget,
} from '../../core/RecommendedTargetService';

export interface MainViewModel {
  recommended: RecommendedTargetResult;
  /** 主目标文案 key（视图层据此查本地化文案）。 */
  primaryTextKey: string;
  primaryType: string;
  /** 离线收益红点：是否存在可领取离线收益。 */
  hasClaimableOfflineReward: boolean;
}

export class MainPresenter {
  constructor(private readonly ctx: AppContext) {}

  getViewModel(): MainViewModel {
    const hasClaimableOfflineReward = this.ctx.hasClaimableOfflineReward();
    const recommended = resolveRecommendedTarget({
      playerState: this.ctx.playerState,
      rewardLedger: this.ctx.rewardLedger,
      hasClaimableOfflineReward,
      lastDefeat: this.ctx.lastDefeat,
      levels: this.ctx.levels,
      ownedHeroIds: this.ctx.ownedHeroIds,
    });
    return {
      recommended,
      primaryTextKey: recommended.primary.textKey,
      primaryType: recommended.primary.type,
      hasClaimableOfflineReward,
    };
  }

  /** 玩家点击主推荐目标：发出 goal_adopt 埋点并返回跳转意图。 */
  adoptPrimaryTarget(): NavigationIntent {
    const target = this.getViewModel().recommended.primary;
    this.ctx.analytics.track(AnalyticsEvent.RecommendedTargetAdopted, this.ctx.playerState, {
      goalType: target.type,
      priority: target.priority,
      scene: target.navigationIntent.scene,
    });
    return target.navigationIntent;
  }
}
