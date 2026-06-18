/**
 * 一键升级 Presenter（C14a，纯 TS）。
 *
 * 包装 C12 一键升级服务：执行后落盘（C08）并发出 one_tap_upgrade 埋点。
 */
import { AppContext } from './AppContext';
import { AnalyticsEvent } from '../../analytics/AnalyticsService';
import { OneTapUpgradeResult, oneTapUpgrade } from '../../core/OneTapUpgradeService';

export class UpgradePresenter {
  constructor(private readonly ctx: AppContext) {}

  /** 执行一键升级；实际升了级则落盘。无论是否升级都发出埋点（含是否生效/步数/停止原因）。 */
  execute(includeBench = false): OneTapUpgradeResult {
    const result = oneTapUpgrade({
      playerState: this.ctx.playerState,
      onFieldHeroIds: this.ctx.onFieldHeroIds,
      benchHeroIds: this.ctx.benchHeroIds,
      includeBench,
    });

    if (result.applied) {
      this.ctx.persist();
    }

    this.ctx.analytics.track(AnalyticsEvent.OneTapUpgradeTriggered, this.ctx.playerState, {
      applied: result.applied,
      steps: result.steps.length,
      stopReason: result.stopReason,
      totalStarCoin: result.totalCost.starCoin,
      totalExpChip: result.totalCost.expChip,
    });

    return result;
  }
}
