/**
 * 胜利结算衔接下一目标（C13）。
 *
 * 纯 TypeScript 模块，不依赖 cc：把 C07 的关卡胜利结算与 C09 推荐目标组件打通，
 * 形成"打完一关 → 立刻知道下一步"的闭环数据流——胜利结算完成后，用结算后的最新
 * PlayerState / RewardLedger 重新解析推荐目标，作为结算面板"下一步"入口的数据来源。
 *
 * 可选接入 C13 埋点服务：结算完成后发出"关卡结束"事件（含胜负、奖励、刷新出的下一目标类型）。
 * 本任务不接 UI，UI 接入（结算面板、下一目标按钮）留到 C14。
 */
import { RewardConfig } from '../config/ConfigTypes';
import { PlayerState } from './PlayerState';
import { RewardLedger } from './RewardLedger';
import { RewardSettlementOutcome, settleLevelVictory } from './LevelRewardSettlement';
import {
  RecommendedTargetContext,
  RecommendedTargetResult,
  resolveRecommendedTarget,
} from './RecommendedTargetService';
import { AnalyticsEvent, AnalyticsService } from '../analytics/AnalyticsService';

export interface VictoryFlowParams {
  ledger: RewardLedger;
  state: PlayerState;
  levelId: string;
  reward: RewardConfig;
  /**
   * 推荐目标上下文中除 playerState / rewardLedger 之外的部分；
   * 结算后会用最新的 state / ledger 与之合并再解析，确保推荐目标基于结算后的状态。
   */
  targetContext: Omit<RecommendedTargetContext, 'playerState' | 'rewardLedger'>;
  /** 可选埋点服务；传入则在结算后发出"关卡结束"事件。 */
  analytics?: AnalyticsService;
  /** 本场战斗耗时（毫秒），写入埋点 payload，未知时为 undefined。 */
  battleTimeMs?: number;
}

export interface VictoryFlowResult {
  settlement: RewardSettlementOutcome;
  /** 结算后刷新出的推荐目标（主目标即结算面板"下一步"入口的数据来源）。 */
  recommendedTarget: RecommendedTargetResult;
  log: string[];
}

/**
 * 胜利结算 + 刷新下一目标：
 * 1. 经奖励流水状态机结算关卡胜利奖励（防重复领取，落到 state）。
 * 2. 用结算后的最新 state / ledger 重新解析推荐目标。
 * 3. 可选发出"关卡结束"埋点（胜利出口）。
 */
export function settleVictoryAndRefreshTarget(params: VictoryFlowParams): VictoryFlowResult {
  const settlement = settleLevelVictory(params.ledger, params.state, params.levelId, params.reward);
  const log = [...settlement.log];

  const recommendedTarget = resolveRecommendedTarget({
    ...params.targetContext,
    playerState: params.state,
    rewardLedger: params.ledger,
  });
  log.push('next_target_refreshed_after_victory');

  if (params.analytics) {
    params.analytics.track(AnalyticsEvent.LevelEnd, params.state, {
      levelId: params.levelId,
      win: true,
      granted: settlement.granted,
      duplicate: settlement.duplicate,
      rewardId: params.reward.rewardId,
      battleTimeMs: params.battleTimeMs ?? null,
      nextTargetType: recommendedTarget.primary.type,
    });
  }

  return { settlement, recommendedTarget, log };
}
