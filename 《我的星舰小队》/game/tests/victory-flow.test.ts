import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';
import { settleVictoryAndRefreshTarget } from '../assets/scripts/core/VictoryFlowService';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');
const reward11 = rewards.find((r) => r.rewardId === 'rw_1_1')!;
const ownedHeroIds = ['hero_isen', 'hero_mia'];

function baseTargetContext() {
  return {
    hasClaimableOfflineReward: false,
    lastDefeat: undefined,
    levels,
    ownedHeroIds,
  };
}

describe('VictoryFlowService - 胜利结算衔接下一目标', () => {
  it('结算胜利后刷新推荐目标，主目标为未确认奖励，并产出 next_target_refreshed_after_victory 日志', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();

    const result = settleVictoryAndRefreshTarget({
      ledger,
      state,
      levelId: '1-1',
      reward: reward11,
      targetContext: baseTargetContext(),
    });

    expect(result.settlement.granted).toBe(true);
    expect(result.log).toContain('next_target_refreshed_after_victory');
    // 结算把奖励计入资源、标记通关
    expect(state.clearedLevelIds).toContain('1-1');
    expect(state.resources.starCoin).toBe(reward11.starCoin);
    // 刷新出的下一目标基于结算后的最新状态
    expect(result.recommendedTarget.primary).toBeDefined();
    expect(result.recommendedTarget.primary.type).toBe('next_level');
  });

  it('推荐目标基于结算后的最新 state/ledger（刚通关 1-1 后下一关推荐 1-2）', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();

    const result = settleVictoryAndRefreshTarget({
      ledger,
      state,
      levelId: '1-1',
      reward: reward11,
      targetContext: baseTargetContext(),
    });

    expect(result.recommendedTarget.primary.navigationIntent.params).toMatchObject({ levelId: '1-2' });
  });

  it('重复结算同一关卡时不重复发奖（duplicate），仍刷新下一目标', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();

    settleVictoryAndRefreshTarget({ ledger, state, levelId: '1-1', reward: reward11, targetContext: baseTargetContext() });
    const starAfterFirst = state.resources.starCoin;

    const second = settleVictoryAndRefreshTarget({ ledger, state, levelId: '1-1', reward: reward11, targetContext: baseTargetContext() });

    expect(second.settlement.duplicate).toBe(true);
    expect(state.resources.starCoin).toBe(starAfterFirst);
    expect(second.log).toContain('next_target_refreshed_after_victory');
  });
});

describe('VictoryFlowService - 埋点接入', () => {
  it('传入 analytics 时结算后发出 stage_end 事件，payload 含胜负/奖励/下一目标类型', () => {
    const sink = new LocalAnalyticsSink({ console: false });
    const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [sink], now: () => 999 });
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();

    settleVictoryAndRefreshTarget({
      ledger,
      state,
      levelId: '1-1',
      reward: reward11,
      targetContext: baseTargetContext(),
      analytics,
      battleTimeMs: 4200,
    });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0];
    expect(event.eventName).toBe('stage_end');
    expect(event.payload).toMatchObject({
      levelId: '1-1',
      win: true,
      granted: true,
      rewardId: 'rw_1_1',
      battleTimeMs: 4200,
      nextTargetType: 'next_level',
    });
    expect(sink.logs[0]).toContain('analytics_event_emitted');
  });

  it('未传入 analytics 时不产生埋点事件（埋点为可选接入）', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();
    const result = settleVictoryAndRefreshTarget({
      ledger,
      state,
      levelId: '1-1',
      reward: reward11,
      targetContext: baseTargetContext(),
    });
    expect(result.settlement.granted).toBe(true);
  });
});
