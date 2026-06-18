import { describe, it, expect } from 'vitest';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import {
  AnalyticsEvent,
  AnalyticsService,
  buildPlayerSnapshot,
} from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';

function makeService(sink: LocalAnalyticsSink, t = 1_000): AnalyticsService {
  return new AnalyticsService({ sessionId: 'sess_test', sinks: [sink], now: () => t });
}

describe('AnalyticsService - 最小事件字段', () => {
  it('每条事件至少包含 eventName/timestamp/sessionId/playerSnapshot/payload', () => {
    const sink = new LocalAnalyticsSink({ console: false });
    const service = makeService(sink, 12345);
    const state = createInitialPlayerState();

    const event = service.track(AnalyticsEvent.LevelStart, state, { levelId: '1-1', teamPower: 100 });

    expect(event.eventName).toBe('stage_start');
    expect(event.timestamp).toBe(12345);
    expect(event.sessionId).toBe('sess_test');
    expect(event.playerSnapshot).toBeDefined();
    expect(event.payload).toMatchObject({ levelId: '1-1', teamPower: 100 });
  });

  it('playerSnapshot 含资源/最高关卡/已通关数/角色等级概要，且为浅拷贝（不持有可变引用）', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 500;
    state.clearedLevelIds = ['1-1', '1-2'];
    state.heroLevels = { hero_isen: 3 };

    const snapshot = buildPlayerSnapshot(state);
    expect(snapshot.resources.starCoin).toBe(500);
    expect(snapshot.highestClearedLevelId).toBe('1-2');
    expect(snapshot.clearedLevelCount).toBe(2);
    expect(snapshot.heroLevels).toEqual({ hero_isen: 3 });

    // 浅拷贝校验：改动原状态不应影响已生成的快照
    state.resources.starCoin = 0;
    state.heroLevels.hero_isen = 99;
    expect(snapshot.resources.starCoin).toBe(500);
    expect(snapshot.heroLevels.hero_isen).toBe(3);
  });

  it('无通关记录时 highestClearedLevelId 为 null', () => {
    const snapshot = buildPlayerSnapshot(createInitialPlayerState());
    expect(snapshot.highestClearedLevelId).toBeNull();
    expect(snapshot.clearedLevelCount).toBe(0);
  });
});

describe('LocalAnalyticsSink - 调试输出', () => {
  it('每条事件产出以 analytics_event_emitted 打头的调试行，并按序缓冲事件', () => {
    const sink = new LocalAnalyticsSink({ console: false });
    const service = makeService(sink);
    const state = createInitialPlayerState();

    service.track(AnalyticsEvent.LevelStart, state, { levelId: '1-1' });
    service.track(AnalyticsEvent.OneTapUpgradeTriggered, state, { steps: 3 });

    expect(sink.events).toHaveLength(2);
    expect(sink.logs).toHaveLength(2);
    expect(sink.logs[0].startsWith('analytics_event_emitted')).toBe(true);
    expect(sink.logs[0]).toContain('stage_start');

    const jsonl = sink.toJsonl().split('\n');
    expect(jsonl).toHaveLength(2);
    expect(JSON.parse(jsonl[1]).eventName).toBe('one_tap_upgrade');
  });

  it('clear 清空缓冲', () => {
    const sink = new LocalAnalyticsSink({ console: false });
    makeService(sink).track(AnalyticsEvent.OfflineRewardClaim, createInitialPlayerState(), {});
    expect(sink.events).toHaveLength(1);
    sink.clear();
    expect(sink.events).toHaveLength(0);
    expect(sink.logs).toHaveLength(0);
  });
});

describe('AnalyticsService - 阶段2闭环最小事件集覆盖', () => {
  it('关卡开始/结束、推荐目标采纳、一键升级、失败弹窗展示与选择、离线收益领取均可发出', () => {
    const sink = new LocalAnalyticsSink({ console: false });
    const service = makeService(sink);
    const state = createInitialPlayerState();

    service.track(AnalyticsEvent.LevelStart, state, { levelId: '1-1' });
    service.track(AnalyticsEvent.LevelEnd, state, { levelId: '1-1', win: true });
    service.track(AnalyticsEvent.RecommendedTargetAdopted, state, { goalType: 'next_level' });
    service.track(AnalyticsEvent.OneTapUpgradeTriggered, state, { steps: 2 });
    service.track(AnalyticsEvent.DefeatDialogShow, state, { levelId: '1-2', reason: '输出不足' });
    service.track(AnalyticsEvent.DefeatActionSelect, state, { actionType: 'one_tap_upgrade', isAd: false });
    service.track(AnalyticsEvent.OfflineRewardClaim, state, { minutes: 60 });

    const names = sink.events.map((e) => e.eventName);
    expect(names).toEqual([
      'stage_start',
      'stage_end',
      'goal_adopt',
      'one_tap_upgrade',
      'defeat_dialog_show',
      'defeat_action_select',
      'offline_reward_claim',
    ]);
    // 所有事件共享同一会话 ID
    expect(new Set(sink.events.map((e) => e.sessionId)).size).toBe(1);
  });

  it('多 Sink 时事件分发到每个 Sink', () => {
    const a = new LocalAnalyticsSink({ console: false });
    const b = new LocalAnalyticsSink({ console: false });
    const service = new AnalyticsService({ sessionId: 's', sinks: [a, b], now: () => 1 });
    service.track(AnalyticsEvent.LevelStart, createInitialPlayerState(), {});
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);
  });
});
