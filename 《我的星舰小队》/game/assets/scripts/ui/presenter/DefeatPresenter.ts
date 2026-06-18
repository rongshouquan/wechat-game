/**
 * 失败弹窗 Presenter（C14a，纯 TS）。
 *
 * 包装 C10 失败原因判断与非广告挽留路径：
 * - show：分析失败主因 + 取得 >=2 条非广告路径，写入 lastDefeat 供推荐目标消费，发出 defeat_dialog_show 埋点。
 * - selectPath：玩家选择某条非广告路径，发出 defeat_action_select 埋点（isAd 恒为 false），返回跳转意图。
 */
import { AppContext } from './AppContext';
import { AnalyticsEvent } from '../../analytics/AnalyticsService';
import {
  DefeatAnalysisContext,
  DefeatReason,
  NavigationIntent,
  RetryPath,
  analyzeDefeatAndBuildRecovery,
} from '../../core/DefeatAnalysisService';

export interface DefeatViewModel {
  reason: DefeatReason;
  /** 非广告挽留路径（>=2 条，按优先级升序）。 */
  retryPaths: RetryPath[];
}

export class DefeatPresenter {
  constructor(private readonly ctx: AppContext) {}

  /**
   * 展示失败弹窗：分析失败原因与挽留路径，记录 lastDefeat（供主界面推荐"失败修复"目标），
   * 发出 defeat_dialog_show 埋点。previousLevelId 用于补全"重刷上一关"路径的跳转参数。
   */
  show(context: DefeatAnalysisContext, previousLevelId?: string): DefeatViewModel {
    const recovery = analyzeDefeatAndBuildRecovery(context, previousLevelId);

    this.ctx.lastDefeat = {
      levelId: context.levelId,
      reason: recovery.reason.reason,
      recoveryAvailable: recovery.retryPaths.length > 0,
    };

    this.ctx.analytics.track(AnalyticsEvent.DefeatDialogShow, this.ctx.playerState, {
      levelId: context.levelId,
      reasonType: recovery.reason.type,
      pathCount: recovery.retryPaths.length,
    });

    return { reason: recovery.reason, retryPaths: recovery.retryPaths };
  }

  /** 玩家在失败弹窗选择一条非广告路径：发出 defeat_action_select 埋点并返回跳转意图。 */
  selectPath(path: RetryPath): NavigationIntent {
    this.ctx.analytics.track(AnalyticsEvent.DefeatActionSelect, this.ctx.playerState, {
      actionType: path.type,
      isAd: false,
      scene: path.navigationIntent.scene,
    });
    return path.navigationIntent;
  }
}
