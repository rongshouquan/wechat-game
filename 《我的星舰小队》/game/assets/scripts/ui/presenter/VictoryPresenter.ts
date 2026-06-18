/**
 * 胜利结算 Presenter（C14a，纯 TS）。
 *
 * 把 C13 胜利结算衔接下一目标接到表现层：
 * - startLevel：进入关卡战斗，发出 stage_start 埋点。
 * - settleVictory：复用 VictoryFlowService 结算并刷新下一目标（内部发 stage_end），结算后清除失败态并落盘。
 * - adoptNextTarget：玩家点击结算面板"下一步"，发出 goal_adopt 埋点并返回跳转意图。
 */
import { AppContext } from './AppContext';
import { AnalyticsEvent } from '../../analytics/AnalyticsService';
import { NavigationIntent } from '../../core/RecommendedTargetService';
import { VictoryFlowResult, settleVictoryAndRefreshTarget } from '../../core/VictoryFlowService';

export class VictoryPresenter {
  constructor(private readonly ctx: AppContext) {}

  /** 进入关卡战斗：发出 stage_start 埋点。 */
  startLevel(levelId: string, teamPower?: number): void {
    this.ctx.analytics.track(AnalyticsEvent.LevelStart, this.ctx.playerState, {
      levelId,
      teamPower: teamPower ?? null,
    });
  }

  /**
   * 胜利结算并刷新下一目标：经 VictoryFlowService 结算（防重复领取，内部发 stage_end），
   * 结算后清除 lastDefeat 并落盘，保证杀进程重进不丢关键状态。
   * 找不到该关卡奖励配置时抛错（属配置缺失，应在配置校验阶段拦截）。
   */
  settleVictory(levelId: string, battleTimeMs?: number): VictoryFlowResult {
    const reward = this.ctx.rewardFor(levelId);
    if (!reward) {
      throw new Error(`VictoryPresenter: reward config not found for level ${levelId}`);
    }

    // 胜利即视为解决了此前的失败：先清除 lastDefeat，再刷新下一目标，
    // 否则刚通关却仍把"失败修复"推为下一步，闭环逻辑自相矛盾。
    this.ctx.lastDefeat = undefined;

    const result = settleVictoryAndRefreshTarget({
      ledger: this.ctx.rewardLedger,
      state: this.ctx.playerState,
      levelId,
      reward,
      targetContext: {
        hasClaimableOfflineReward: this.ctx.hasClaimableOfflineReward(),
        lastDefeat: undefined,
        levels: this.ctx.levels,
        ownedHeroIds: this.ctx.ownedHeroIds,
      },
      analytics: this.ctx.analytics,
      battleTimeMs,
    });

    this.ctx.persist();

    return result;
  }

  /** 玩家点击结算面板"下一步"目标：发出 goal_adopt 埋点并返回跳转意图。 */
  adoptNextTarget(result: VictoryFlowResult): NavigationIntent {
    const target = result.recommendedTarget.primary;
    this.ctx.analytics.track(AnalyticsEvent.RecommendedTargetAdopted, this.ctx.playerState, {
      goalType: target.type,
      priority: target.priority,
      source: 'victory_settlement',
    });
    return target.navigationIntent;
  }
}
