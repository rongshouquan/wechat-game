import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import { buildSaveDataFromState, persistSave } from '../assets/scripts/save/SaveService';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import { MockCloudSaveAdapter } from '../assets/scripts/save/MockCloudSaveAdapter';
import { createCloudSnapshot } from '../assets/scripts/save/CloudSaveAdapter';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { AppContext, AppContextConfig } from '../assets/scripts/ui/presenter/AppContext';
import { dayIndexOf, AdFrequencyState } from '../assets/scripts/ads/AdFrequencyService';
import { DefeatSupplyState } from '../assets/scripts/core/DefeatSupplyService';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');

const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function makeContext(overrides: Partial<AppContextConfig>): AppContext {
  const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [new LocalAnalyticsSink({ console: false })], now: () => NOW });
  return new AppContext({
    adapter: new MemoryStorageAdapter(),
    analytics,
    levels,
    rewards,
    ownedHeroIds: ['hero_isen'],
    onFieldHeroIds: ['hero_isen'],
    now: () => NOW,
    ...overrides,
  });
}

describe('AppContext - 云存档 mock 接入（S5A-04）', () => {
  it('上传当前本地 SaveData，云端可下载到同一份关键状态', async () => {
    const cloud = new MockCloudSaveAdapter();
    const ctx = makeContext({ adapter: new MemoryStorageAdapter(), cloudSaveAdapter: cloud });

    ctx.playerState.resources.starCoin = 123;
    ctx.playerState.clearedLevelIds.push('1-1');

    const result = await ctx.uploadCurrentSaveToCloud(1);
    expect(result).not.toBeNull();
    expect(result!.accepted).toBe(true);
    expect(result!.status).toBe('cloud_empty');

    const downloaded = await ctx.downloadCloudSave();
    expect(downloaded).not.toBeNull();
    expect(downloaded!.revision).toBe(1);
    expect(downloaded!.data.playerState.resources.starCoin).toBe(123);
    expect(downloaded!.data.playerState.clearedLevelIds).toContain('1-1');
    expect(downloaded!.data.lastOnlineTime).toBe(NOW);
  });

  it('上传快照包含 adFrequencyState / defeatSupplyState（S5A-01 字段）', async () => {
    const adapter = new MemoryStorageAdapter();
    // 预置一份带非空广告/补给计数的本地存档。
    const adState: AdFrequencyState = {
      slots: { ad_offline_double: { dayKey: dayIndexOf(NOW), dailyCount: 2, lastCompletedAtMs: NOW } },
    };
    const supplyState: DefeatSupplyState = { bosses: { 'boss_1-5': { dayKey: dayIndexOf(NOW), count: 1 } } };
    persistSave(
      adapter,
      buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), NOW, adState, supplyState),
      NOW,
    );

    const cloud = new MockCloudSaveAdapter();
    const ctx = makeContext({ adapter, cloudSaveAdapter: cloud });

    const result = await ctx.uploadCurrentSaveToCloud(1);
    expect(result!.accepted).toBe(true);

    const snapshot = cloud.peek();
    expect(snapshot!.data.adFrequencyState).toEqual(adState);
    expect(snapshot!.data.defeatSupplyState).toEqual(supplyState);
  });

  it('云端更新（cloud_newer）时不覆盖本地存档，只返回 adapter 结果', async () => {
    const adapter = new MemoryStorageAdapter();
    // 云端预置一份更高 revision、内容不同的快照。
    const cloudData = buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), NOW);
    cloudData.playerState.resources.starCoin = 9999;
    const cloud = new MockCloudSaveAdapter(createCloudSnapshot(cloudData, 5));

    const ctx = makeContext({ adapter, cloudSaveAdapter: cloud });
    ctx.playerState.resources.starCoin = 100; // 本地值

    const result = await ctx.uploadCurrentSaveToCloud(1); // 本地 revision 落后
    expect(result!.accepted).toBe(false);
    expect(result!.status).toBe('cloud_newer');
    // 本地存档未被云端覆盖。
    expect(ctx.playerState.resources.starCoin).toBe(100);

    // 下载云端快照也不会自动覆盖本地——只把结果交给上层。
    const downloaded = await ctx.downloadCloudSave();
    expect(downloaded!.data.playerState.resources.starCoin).toBe(9999);
    expect(ctx.playerState.resources.starCoin).toBe(100);
  });

  it('同 revision 内容分叉（conflict）时不覆盖本地，只返回冲突结果', async () => {
    const adapter = new MemoryStorageAdapter();
    const cloudData = buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), NOW);
    cloudData.playerState.resources.starCoin = 777;
    const cloud = new MockCloudSaveAdapter(createCloudSnapshot(cloudData, 1));

    const ctx = makeContext({ adapter, cloudSaveAdapter: cloud });
    ctx.playerState.resources.starCoin = 100;

    const result = await ctx.uploadCurrentSaveToCloud(1); // 同 revision，内容不同
    expect(result!.accepted).toBe(false);
    expect(result!.status).toBe('conflict');
    expect(result!.conflictReason).toBeDefined();
    expect(ctx.playerState.resources.starCoin).toBe(100); // 本地未被覆盖
  });

  it('未注入 cloudSaveAdapter 时上传/下载返回 null，不影响现有行为', async () => {
    const ctx = makeContext({ adapter: new MemoryStorageAdapter() });
    expect(ctx.cloudSave).toBeUndefined();
    expect(await ctx.uploadCurrentSaveToCloud(1)).toBeNull();
    expect(await ctx.downloadCloudSave()).toBeNull();

    // 普通 persist 仍可用。
    ctx.playerState.resources.starCoin = 50;
    ctx.persist();
    expect(ctx.lastOnlineTime).toBe(NOW);
  });
});
