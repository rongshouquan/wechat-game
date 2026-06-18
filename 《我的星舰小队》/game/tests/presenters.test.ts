import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';
import { AppContext } from '../assets/scripts/ui/presenter/AppContext';
import { MainPresenter } from '../assets/scripts/ui/presenter/MainPresenter';
import { UpgradePresenter } from '../assets/scripts/ui/presenter/UpgradePresenter';
import { OfflineRewardPresenter } from '../assets/scripts/ui/presenter/OfflineRewardPresenter';
import { DefeatPresenter } from '../assets/scripts/ui/presenter/DefeatPresenter';
import { VictoryPresenter } from '../assets/scripts/ui/presenter/VictoryPresenter';
import { DefeatAnalysisContext, SquadMemberSummary } from '../assets/scripts/core/DefeatAnalysisService';
import { BattleDebugReport } from '../assets/scripts/debug/BattleDebugReport';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');

const HOUR = 60 * 60 * 1000;

let sink: LocalAnalyticsSink;
let now: number;

function makeContext(): AppContext {
  sink = new LocalAnalyticsSink({ console: false });
  const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [sink], now: () => now });
  return new AppContext({
    adapter: new MemoryStorageAdapter(),
    analytics,
    levels,
    rewards,
    ownedHeroIds: ['hero_isen', 'hero_mia'],
    onFieldHeroIds: ['hero_isen', 'hero_mia'],
    now: () => now,
  });
}

function eventNames(): string[] {
  return sink.events.map((e) => e.eventName);
}

beforeEach(() => {
  now = 1_000_000;
});

describe('AppContext - 会话装配与生命周期', () => {
  it('新会话从默认档启动，关键状态可用', () => {
    const ctx = makeContext();
    expect(ctx.playerState.clearedLevelIds).toEqual([]);
    expect(ctx.rewardLedger.entries).toEqual([]);
    expect(ctx.rewardFor('1-1')?.rewardId).toBe('rw_1_1');
  });

  it('胜利落盘后，新建 AppContext（模拟杀进程重进）能恢复关键状态', () => {
    const adapter = new MemoryStorageAdapter();
    const sink1 = new LocalAnalyticsSink({ console: false });
    const a1 = new AnalyticsService({ sessionId: 's1', sinks: [sink1], now: () => now });
    const ctx1 = new AppContext({ adapter, analytics: a1, levels, rewards, ownedHeroIds: ['hero_isen'], onFieldHeroIds: ['hero_isen'], now: () => now });
    new VictoryPresenter(ctx1).settleVictory('1-1');

    const sink2 = new LocalAnalyticsSink({ console: false });
    const a2 = new AnalyticsService({ sessionId: 's2', sinks: [sink2], now: () => now });
    const ctx2 = new AppContext({ adapter, analytics: a2, levels, rewards, ownedHeroIds: ['hero_isen'], onFieldHeroIds: ['hero_isen'], now: () => now });
    expect(ctx2.playerState.clearedLevelIds).toContain('1-1');
    expect(ctx2.playerState.resources.starCoin).toBe(rewards.find((r) => r.rewardId === 'rw_1_1')!.starCoin);
  });
});

describe('MainPresenter - 推荐目标 view-model 与采纳埋点', () => {
  it('默认档主目标为挑战下一关，view-model 暴露文案 key 与离线红点', () => {
    const vm = new MainPresenter(makeContext()).getViewModel();
    expect(vm.primaryType).toBe('next_level');
    expect(vm.primaryTextKey).toBe('recommend.next_level');
    expect(vm.hasClaimableOfflineReward).toBe(false);
  });

  it('采纳主目标发出 goal_adopt 埋点并返回跳转意图', () => {
    const ctx = makeContext();
    const intent = new MainPresenter(ctx).adoptPrimaryTarget();
    expect(intent.scene).toBe('level_battle');
    expect(eventNames()).toEqual(['goal_adopt']);
    expect(sink.events[0].payload).toMatchObject({ goalType: 'next_level' });
  });
});

describe('UpgradePresenter - 一键升级埋点与落盘', () => {
  it('资源足够时执行升级、落盘并发出 one_tap_upgrade（applied=true）', () => {
    const ctx = makeContext();
    ctx.playerState.resources.starCoin = 500;
    ctx.playerState.resources.expChip = 100;

    const result = new UpgradePresenter(ctx).execute();

    expect(result.applied).toBe(true);
    expect(eventNames()).toEqual(['one_tap_upgrade']);
    expect(sink.events[0].payload).toMatchObject({ applied: true, steps: result.steps.length });
    // 升级后等级写入了 state
    expect(ctx.playerState.heroLevels.hero_isen).toBeGreaterThan(1);
  });

  it('资源不足时不升级，仍发出 one_tap_upgrade（applied=false）', () => {
    const ctx = makeContext();
    const result = new UpgradePresenter(ctx).execute();
    expect(result.applied).toBe(false);
    expect(sink.events[0].payload).toMatchObject({ applied: false });
  });
});

describe('OfflineRewardPresenter - 离线收益领取', () => {
  it('有进度且离线足够时可领取，发出 offline_reward_claim（granted=true）并推进 lastOnlineTime', () => {
    const ctx = makeContext();
    ctx.playerState.clearedLevelIds = ['1-1'];
    ctx.lastOnlineTime = now - 2 * HOUR;

    const presenter = new OfflineRewardPresenter(ctx);
    expect(presenter.getViewModel().claimable).toBe(true);

    const result = presenter.claim();
    expect(result.granted).toBe(true);
    expect(ctx.lastOnlineTime).toBe(now);
    expect(eventNames()).toEqual(['offline_reward_claim']);
    expect(sink.events[0].payload).toMatchObject({ granted: true });
  });

  it('同一离线窗口重复领取被防重拒绝（granted=false, duplicate=true）', () => {
    const ctx = makeContext();
    ctx.playerState.clearedLevelIds = ['1-1'];
    ctx.lastOnlineTime = now - 2 * HOUR;
    const presenter = new OfflineRewardPresenter(ctx);
    presenter.claim();
    // 时间未推进，但窗口已关闭：再次领取应无可领取（claimable=false）
    const second = presenter.claim();
    expect(second.granted).toBe(false);
  });
});

function buildDefeatContext(): DefeatAnalysisContext {
  const squad: SquadMemberSummary[] = [
    { unitId: 'u1', heroId: 'h1', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 5 },
    { unitId: 'u2', heroId: 'h2', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 5 },
    { unitId: 'u3', heroId: 'h3', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 5 },
    { unitId: 'u4', heroId: 'h4', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 5 },
    { unitId: 'u5', heroId: 'h5', role: 'disruptor', positionType: 'back', assignedPosition: 'back', level: 5 },
  ];
  const report: BattleDebugReport = {
    winner: 'enemy',
    durationSec: 30,
    failReason: 'timeout',
    totalDamage: 100,
    totalHealing: 50,
    damageTakenByUnit: [],
    skillCastCounts: [],
  };
  return { report, levelId: '1-2', squad, recommendedPower: 120 };
}

describe('DefeatPresenter - 失败弹窗展示与选择', () => {
  it('show 分析失败原因（输出不足）+ >=2 非广告路径，记录 lastDefeat，发出 defeat_dialog_show', () => {
    const ctx = makeContext();
    const vm = new DefeatPresenter(ctx).show(buildDefeatContext(), '1-1');

    expect(vm.reason.type).toBe('insufficient_output');
    expect(vm.retryPaths.length).toBeGreaterThanOrEqual(2);
    // 不得含广告路径
    expect(JSON.stringify(vm.retryPaths)).not.toContain('广告');
    expect(vm.retryPaths.every((p) => !/(^|_)ad(_|$)/.test(p.type))).toBe(true);
    expect(ctx.lastDefeat).toMatchObject({ levelId: '1-2', recoveryAvailable: true });
    expect(eventNames()).toEqual(['defeat_dialog_show']);
  });

  it('selectPath 发出 defeat_action_select（isAd=false）并返回跳转意图', () => {
    const ctx = makeContext();
    const presenter = new DefeatPresenter(ctx);
    const vm = presenter.show(buildDefeatContext(), '1-1');
    const intent = presenter.selectPath(vm.retryPaths[0]);

    expect(intent.scene).toBeDefined();
    expect(eventNames()).toEqual(['defeat_dialog_show', 'defeat_action_select']);
    expect(sink.events[1].payload).toMatchObject({ isAd: false, actionType: vm.retryPaths[0].type });
  });

  it('失败后主界面推荐目标变为失败修复（lastDefeat 接入推荐目标）', () => {
    const ctx = makeContext();
    new DefeatPresenter(ctx).show(buildDefeatContext(), '1-1');
    const vm = new MainPresenter(ctx).getViewModel();
    expect(vm.primaryType).toBe('defeat_recovery');
  });
});

describe('VictoryPresenter - 关卡开始/结束与胜利衔接下一目标', () => {
  it('startLevel 发出 stage_start；settleVictory 发出 stage_end 并刷新下一目标、清除失败态、落盘', () => {
    const ctx = makeContext();
    const presenter = new VictoryPresenter(ctx);
    ctx.lastDefeat = { levelId: '1-1', reason: 'x', recoveryAvailable: true };

    presenter.startLevel('1-1', 88);
    const result = presenter.settleVictory('1-1', 4200);

    expect(eventNames()).toEqual(['stage_start', 'stage_end']);
    expect(sink.events[0].payload).toMatchObject({ levelId: '1-1', teamPower: 88 });
    expect(sink.events[1].payload).toMatchObject({ levelId: '1-1', win: true, nextTargetType: result.recommendedTarget.primary.type });
    expect(ctx.lastDefeat).toBeUndefined();
    expect(ctx.playerState.clearedLevelIds).toContain('1-1');
    // 结算后主目标：刚通关 1-1，存在未确认奖励则推未确认，否则下一关
    expect(['unconfirmed_reward', 'next_level']).toContain(result.recommendedTarget.primary.type);
  });

  it('adoptNextTarget 发出 goal_adopt（source=victory_settlement）', () => {
    const ctx = makeContext();
    const presenter = new VictoryPresenter(ctx);
    const result = presenter.settleVictory('1-1');
    const intent = presenter.adoptNextTarget(result);
    expect(intent.scene).toBeDefined();
    const adopt = sink.events.find((e) => e.eventName === 'goal_adopt');
    expect(adopt?.payload).toMatchObject({ source: 'victory_settlement' });
  });

  it('settleVictory 找不到关卡奖励配置时抛错', () => {
    const ctx = makeContext();
    expect(() => new VictoryPresenter(ctx).settleVictory('9-9')).toThrow();
  });
});
