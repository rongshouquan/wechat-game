import { describe, it, expect } from 'vitest';
import { AnalyticsUploadEvent } from '../assets/scripts/analytics/AnalyticsEventTypes';
import {
  DASHBOARD_EVENT_TO_METRIC,
  aggregateDashboardMetrics,
} from '../assets/scripts/analytics/AnalyticsDashboardAggregator';

const T0 = 1_700_000_000_000;

/** 构造一条最小合法形态的上报事件（聚合只读 eventName，其余补齐通用字段即可）。 */
function ev(eventName: string, params: Record<string, unknown> = {}): AnalyticsUploadEvent {
  return {
    eventName,
    userId: 'dev_user_1',
    sessionId: 'sess_1',
    timestamp: T0,
    appVersion: '1.0.0',
    configVersion: '0.1.0',
    params,
  };
}

describe('AnalyticsDashboardAggregator - 最低指标聚合', () => {
  it('空事件数组聚合出全 0 指标，比值为 null', () => {
    const m = aggregateDashboardMetrics([]);
    expect(m.totalEvents).toBe(0);
    expect(m.tutorialStart).toBe(0);
    expect(m.derived.adCompletionRate).toBeNull();
    expect(m.derived.goalCompletionRate).toBeNull();
  });

  it('mock 事件可聚合出 9 项最低指标计数', () => {
    const events = [
      ev('tutorial_start'),
      ev('tutorial_start'),
      ev('first_battle_win'),
      ev('boss_fail'),
      ev('boss_fail'),
      ev('boss_fail'),
      ev('offline_reward_claim_1x'),
      ev('ad_click'),
      ev('ad_click'),
      ev('ad_complete'),
      ev('ad_fail'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_complete'),
      ev('goal_complete'),
    ];
    const m = aggregateDashboardMetrics(events);

    expect(m.tutorialStart).toBe(2);
    expect(m.firstBattleWin).toBe(1);
    expect(m.bossFail).toBe(3);
    expect(m.offlineRewardClaim1x).toBe(1);
    expect(m.adClick).toBe(2);
    expect(m.adComplete).toBe(1);
    expect(m.adFail).toBe(1);
    expect(m.goalShow).toBe(4);
    expect(m.goalComplete).toBe(2);
    expect(m.totalEvents).toBe(events.length);
  });

  it('derived 比值 = 完成 / 触发', () => {
    const m = aggregateDashboardMetrics([
      ev('ad_click'),
      ev('ad_click'),
      ev('ad_complete'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_show'),
      ev('goal_complete'),
    ]);
    expect(m.derived.adCompletionRate).toBe(0.5); // 1/2
    expect(m.derived.goalCompletionRate).toBe(0.25); // 1/4
  });

  it('未映射事件只计入 totalEvents，不影响 9 项指标', () => {
    const m = aggregateDashboardMetrics([
      ev('stage_start', { levelId: '1-1', teamPower: 100 }),
      ev('ad_click'),
    ]);
    expect(m.totalEvents).toBe(2);
    expect(m.adClick).toBe(1);
    expect(m.tutorialStart).toBe(0);
    expect(m.bossFail).toBe(0);
  });

  it('映射表覆盖全部 9 项要求指标', () => {
    const targetKeys = new Set(Object.values(DASHBOARD_EVENT_TO_METRIC));
    expect(targetKeys).toEqual(
      new Set([
        'tutorialStart',
        'firstBattleWin',
        'bossFail',
        'offlineRewardClaim1x',
        'adClick',
        'adComplete',
        'adFail',
        'goalShow',
        'goalComplete',
      ]),
    );
  });
});
