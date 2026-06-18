/**
 * 最低数据看板聚合（C31）。
 *
 * 纯 TypeScript 模块，不依赖 cc / wx：输入 C30 上报事件数组，输出开发期可读的最低指标对象。
 * 只做内存聚合（计数 + 少量比值），供开发期 / QA 在本地核对事件到达与基本转化。
 *
 * 明确不做（属后续或越界）：
 *  - 不接真实 BI、不接真实微信云开发、不部署、不做在线看板；不需要任何真实云环境即可运行与测试。
 *  - 不做留存 / D1·D7 等需要跨会话时间窗的运营指标（那些依赖灰度环境数据，属阶段7）。
 *  - 指标口径与《灰度指标阈值表》不冲突：本聚合仅产出「计数」与「开发期近似比值」，
 *    不复刻阈值表中的目标/警戒/阻断判定，也不作为灰度扩量/暂停依据。
 */
import { AnalyticsUploadEvent } from './AnalyticsEventTypes';

/**
 * 最低看板指标。计数项与《数据接入技术方案》§4 P0 事件一一对应（事件来源见 DASHBOARD_EVENT_TO_METRIC）。
 * derived 为开发期近似比值，分母为 0 时取 null（不可计算），仅供本地观测，不等同阈值表口径。
 */
export interface AnalyticsDashboardMetrics {
  /** 新手开始数 ← tutorial_start */
  tutorialStart: number;
  /** 首战胜利数 ← first_battle_win */
  firstBattleWin: number;
  /** Boss 失败数 ← boss_fail */
  bossFail: number;
  /** 离线 1 倍领取 ← offline_reward_claim_1x */
  offlineRewardClaim1x: number;
  /** 广告点击 ← ad_click */
  adClick: number;
  /** 广告完成 ← ad_complete */
  adComplete: number;
  /** 广告失败 ← ad_fail */
  adFail: number;
  /** 推荐目标展示 ← goal_show */
  goalShow: number;
  /** 推荐目标完成 ← goal_complete */
  goalComplete: number;
  /** 参与聚合的事件总数（含未映射事件）。 */
  totalEvents: number;
  /** 开发期近似比值，分母为 0 取 null。 */
  derived: {
    /** 广告完成率近似 = adComplete / adClick。 */
    adCompletionRate: number | null;
    /** 推荐目标完成率近似 = goalComplete / goalShow。 */
    goalCompletionRate: number | null;
  };
}

/** 计数型指标键（不含 totalEvents / derived）。 */
type CountMetricKey =
  | 'tutorialStart'
  | 'firstBattleWin'
  | 'bossFail'
  | 'offlineRewardClaim1x'
  | 'adClick'
  | 'adComplete'
  | 'adFail'
  | 'goalShow'
  | 'goalComplete';

/** P0 事件名 -> 看板计数指标键的映射（事件来源单一真源）。 */
export const DASHBOARD_EVENT_TO_METRIC: Readonly<Record<string, CountMetricKey>> = {
  tutorial_start: 'tutorialStart',
  first_battle_win: 'firstBattleWin',
  boss_fail: 'bossFail',
  offline_reward_claim_1x: 'offlineRewardClaim1x',
  ad_click: 'adClick',
  ad_complete: 'adComplete',
  ad_fail: 'adFail',
  goal_show: 'goalShow',
  goal_complete: 'goalComplete',
};

function emptyMetrics(): AnalyticsDashboardMetrics {
  return {
    tutorialStart: 0,
    firstBattleWin: 0,
    bossFail: 0,
    offlineRewardClaim1x: 0,
    adClick: 0,
    adComplete: 0,
    adFail: 0,
    goalShow: 0,
    goalComplete: 0,
    totalEvents: 0,
    derived: { adCompletionRate: null, goalCompletionRate: null },
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * 聚合最低看板指标：按事件名计数，未映射事件只计入 totalEvents。
 * 纯函数、无副作用，不读系统时间、不接任何外部环境。
 */
export function aggregateDashboardMetrics(events: readonly AnalyticsUploadEvent[]): AnalyticsDashboardMetrics {
  const metrics = emptyMetrics();
  for (const event of events) {
    metrics.totalEvents += 1;
    const key = DASHBOARD_EVENT_TO_METRIC[event.eventName];
    if (key) {
      metrics[key] += 1;
    }
  }
  metrics.derived.adCompletionRate = ratio(metrics.adComplete, metrics.adClick);
  metrics.derived.goalCompletionRate = ratio(metrics.goalComplete, metrics.goalShow);
  return metrics;
}
