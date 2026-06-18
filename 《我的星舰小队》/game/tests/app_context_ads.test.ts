import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import { buildSaveDataFromState, persistSave } from '../assets/scripts/save/SaveService';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { AppContext } from '../assets/scripts/ui/presenter/AppContext';
import { dayIndexOf, AdFrequencyState } from '../assets/scripts/ads/AdFrequencyService';
import { DefeatSupplyState } from '../assets/scripts/core/DefeatSupplyService';
import { AdConfig, LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');
const adConfigs = readSample<AdConfig[]>('ad_config.sample.json');

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function makeContext(adapter: MemoryStorageAdapter): AppContext {
  const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [new LocalAnalyticsSink({ console: false })], now: () => NOW });
  return new AppContext({
    adapter,
    analytics,
    levels,
    rewards,
    ownedHeroIds: ['hero_isen'],
    onFieldHeroIds: ['hero_isen'],
    now: () => NOW,
    adConfigs,
    // 默认 MockAdAdapter（完整观看）；显式不接真实 SDK。
  });
}

describe('AppContext - 广告运行时服务接入（S5A-02）', () => {
  it('未提供 adConfigs 时不持有广告服务（向后兼容）', () => {
    const analytics = new AnalyticsService({ sessionId: 's', sinks: [new LocalAnalyticsSink({ console: false })], now: () => NOW });
    const ctx = new AppContext({
      adapter: new MemoryStorageAdapter(),
      analytics,
      levels,
      rewards,
      ownedHeroIds: ['hero_isen'],
      onFieldHeroIds: ['hero_isen'],
      now: () => NOW,
    });
    expect(ctx.adFrequency).toBeUndefined();
    expect(ctx.defeatSupply).toBeUndefined();
    expect(ctx.adRewardFlow).toBeUndefined();
  });

  it('启动后用存档中的 AdFrequencyState 初始化 AdFrequencyService', () => {
    const adapter = new MemoryStorageAdapter();
    // 预置存档：ad_offline_double 当日已用 2 次（dailyLimit=3），冷却起点 = NOW。
    const adState: AdFrequencyState = {
      slots: { ad_offline_double: { dayKey: dayIndexOf(NOW), dailyCount: 2, lastCompletedAtMs: NOW } },
    };
    persistSave(
      adapter,
      buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), NOW, adState),
      NOW,
    );

    const ctx = makeContext(adapter);
    expect(ctx.adFrequency).toBeDefined();

    // 恢复的每日次数生效：剩余 1 次；仍在 300s 冷却窗内。
    const d = ctx.adFrequency!.canRequest('ad_offline_double', NOW + 1_000);
    expect(d.remainingDaily).toBe(1);
    expect(d.reason).toBe('cooldown');
    expect(d.cooldownRemainingMs).toBeGreaterThan(0);
    // 会话次数为新进程内存态，从满额开始（sessionLimit=2）。
    expect(d.remainingSession).toBe(2);
  });

  it('启动后用存档中的 DefeatSupplyState 初始化 DefeatSupplyService', () => {
    const adapter = new MemoryStorageAdapter();
    const supplyState: DefeatSupplyState = { bosses: { 'boss_1-5': { dayKey: dayIndexOf(NOW), count: 1 } } };
    persistSave(
      adapter,
      buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), NOW, undefined, supplyState),
      NOW,
    );

    const ctx = makeContext(adapter);
    expect(ctx.defeatSupply).toBeDefined();
    expect(ctx.defeatSupply!.bossCount('boss_1-5', NOW)).toBe(1);
    // 其它 Boss 当日仍为 0。
    expect(ctx.defeatSupply!.bossCount('boss_2-5', NOW)).toBe(0);
  });

  it('计数变化后经 commitAdRuntimeState 落盘，重建 AppContext 计数仍保留', async () => {
    const adapter = new MemoryStorageAdapter();

    // 第一会话：从空档启动，对 boss_1-5 看完一次补给广告（默认 mock=completed）。
    const ctx1 = makeContext(adapter);
    const r = await ctx1.defeatSupply!.requestSupplyViaAd({
      rewardLedger: ctx1.rewardLedger,
      playerState: ctx1.playerState,
      request: { contextId: 'defeat_ctx_1', bossKey: 'boss_1-5' },
      now: NOW,
      applySupply: () => true,
    });
    expect(r.status).toBe('granted');
    expect(ctx1.defeatSupply!.bossCount('boss_1-5', NOW)).toBe(1);
    // 同 Boss 广告完成也消耗了 ad_defeat_supply 的每日次数（经同一 AdFrequencyService）。
    expect(ctx1.adFrequency!.canRequest('ad_defeat_supply', NOW).remainingDaily).toBe(2);

    // 同步广告运行时计数并落盘。
    ctx1.commitAdRuntimeState();

    // 模拟杀进程重进：用同一底层存储重建 AppContext。
    const ctx2 = makeContext(adapter);

    // 同 Boss 补给计数保留。
    expect(ctx2.defeatSupply!.bossCount('boss_1-5', NOW)).toBe(1);
    // 广告每日次数与冷却保留（剩 2，冷却中）；会话次数随新进程重置。
    const d = ctx2.adFrequency!.canRequest('ad_defeat_supply', NOW + 1_000);
    expect(d.remainingDaily).toBe(2);
    expect(d.cooldownRemainingMs).toBeGreaterThan(0);
    expect(d.remainingSession).toBe(2);

    // 对照：全新空档 AppContext 计数从 0 / 满额起（差异来自持久化而非默认值）。
    const fresh = makeContext(new MemoryStorageAdapter());
    expect(fresh.defeatSupply!.bossCount('boss_1-5', NOW)).toBe(0);
    expect(fresh.adFrequency!.canRequest('ad_defeat_supply', NOW).remainingDaily).toBe(3);
  });

  it('杀进程重进后同一失败上下文再次请求 -> already_claimed，不重复发补给（S5C-07-B 方案B口径）', async () => {
    const adapter = new MemoryStorageAdapter();

    // 第一会话：对 boss_1-5 看完一次补给广告并落盘（RewardLedger 流水随存档持久化）。
    const ctx1 = makeContext(adapter);
    const r1 = await ctx1.defeatSupply!.requestSupplyViaAd({
      rewardLedger: ctx1.rewardLedger,
      playerState: ctx1.playerState,
      request: { contextId: 'defeat_ctx_dup', bossKey: 'boss_1-5' },
      now: NOW,
      applySupply: () => true,
    });
    expect(r1.status).toBe('granted');
    ctx1.commitAdRuntimeState();

    // 模拟杀进程重进：同一底层存储重建 AppContext，对同一失败上下文重复请求。
    const ctx2 = makeContext(adapter);
    let appliedAfterRestart = 0;
    const r2 = await ctx2.defeatSupply!.requestSupplyViaAd({
      rewardLedger: ctx2.rewardLedger,
      playerState: ctx2.playerState,
      request: { contextId: 'defeat_ctx_dup', bossKey: 'boss_1-5' },
      now: NOW + 60_000,
      applySupply: () => {
        appliedAfterRestart += 1;
        return true;
      },
    });
    expect(r2.status).toBe('already_claimed');
    expect(r2.granted).toBe(false);
    expect(appliedAfterRestart).toBe(0);
    // 同 Boss 计数不因重复请求增长。
    expect(ctx2.defeatSupply!.bossCount('boss_1-5', NOW + 60_000)).toBe(1);
  });
});
