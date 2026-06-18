import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createInitialPlayerState,
  getHeroLevel,
  upgradeHero,
  PlayerState,
  DEFAULT_ON_FIELD_HERO_IDS,
} from '../assets/scripts/core/PlayerState';
import { assembleSquad } from '../assets/scripts/core/BattleLaunchService';
import { HeroConfig, SkillConfig } from '../assets/scripts/config/ConfigTypes';
import { confirmRewardGrant, createRewardLedger, requestRewardGrant } from '../assets/scripts/core/RewardLedger';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  SaveData,
  buildSaveDataFromState,
  createDefaultSaveData,
  loadSave,
  migrateSaveData,
  onAppHide,
  onAppLaunchOrShow,
  persistSave,
  restoreKeyState,
} from '../assets/scripts/save/SaveService';
import { AdFrequencyService } from '../assets/scripts/ads/AdFrequencyService';
import { AdRewardFlowService } from '../assets/scripts/ads/AdRewardFlowService';
import { AdService } from '../assets/scripts/ads/AdService';
import { MockAdAdapter } from '../assets/scripts/ads/MockAdAdapter';
import { DefeatSupplyService, DefeatSupplyParams, DefeatSupplyState } from '../assets/scripts/core/DefeatSupplyService';
import { AdConfig } from '../assets/scripts/config/ConfigTypes';

const T0 = 1_700_000_000_000;

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const sampleHeroes = readSample<HeroConfig[]>('hero_config.sample.json');
const sampleSkills = readSample<SkillConfig[]>('skill_config.sample.json');

describe('SaveService - 首次无存档初始化', () => {
  it('启动时无存档则初始化默认存档', () => {
    const adapter = new MemoryStorageAdapter();

    const result = loadSave(adapter, T0);

    expect(result.isNew).toBe(true);
    expect(result.corrupted).toBe(false);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.data.playerState).toEqual(createInitialPlayerState());
    expect(result.data.rewardLedger.entries).toHaveLength(0);
    expect(result.data.lastOnlineTime).toBe(T0);
    expect(result.log).toContain('save_not_found_initializing_default');
  });

  it('onAppLaunchOrShow 在无存档时返回初始化的关键状态', () => {
    const adapter = new MemoryStorageAdapter();

    const { restored, result } = onAppLaunchOrShow(adapter, T0);

    expect(result.isNew).toBe(true);
    expect(restored.playerState.resources.starCoin).toBe(0);
    expect(restored.rewardLedger.entries).toHaveLength(0);
    expect(restored.lastOnlineTime).toBe(T0);
  });
});

describe('SaveService - 保存后恢复（含切后台/重启模拟）', () => {
  it('保存关键状态后，重新加载可还原资源/英雄等级/已通关关卡/最后在线时间', () => {
    const adapter = new MemoryStorageAdapter();

    // 模拟一局游戏后的关键状态变化
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 500;
    playerState.resources.expChip = 80;
    playerState.clearedLevelIds.push('1-1', '1-2');
    upgradeHero(playerState, 'hero_isen');
    const ledger = createRewardLedger();

    const saveTime = T0 + 60_000;
    const saved = persistSave(adapter, buildSaveDataFromState(playerState, ledger, saveTime), saveTime);
    expect(saved.lastOnlineTime).toBe(saveTime);

    // 模拟"杀进程重进"：用全新的内存适配器引用同一份底层存储字符串，重新走 loadSave
    const reloadResult = loadSave(adapter, T0 + 120_000);
    const restored = restoreKeyState(reloadResult.data);

    expect(reloadResult.isNew).toBe(false);
    expect(reloadResult.corrupted).toBe(false);
    // upgradeHero 消耗资源（S5C-05 曲线 lv1→2 = 60 星币 / 12 经验芯片），落盘恢复后应是扣减后的值
    expect(restored.playerState.resources.starCoin).toBe(440);
    expect(restored.playerState.resources.expChip).toBe(68);
    expect(restored.playerState.clearedLevelIds).toEqual(['1-1', '1-2']);
    expect(getHeroLevel(restored.playerState, 'hero_isen')).toBe(2);
    expect(restored.lastOnlineTime).toBe(saveTime);
  });

  it('onAppHide 落盘后，onAppLaunchOrShow 可还原同一份关键状态', () => {
    const adapter = new MemoryStorageAdapter();
    const playerState = createInitialPlayerState();
    playerState.resources.baseEnergy = 12;
    const ledger = createRewardLedger();

    const hideTime = T0 + 30_000;
    onAppHide(adapter, playerState, ledger, hideTime);

    const showTime = T0 + 90_000;
    const { restored, result } = onAppLaunchOrShow(adapter, showTime);

    expect(result.isNew).toBe(false);
    expect(restored.playerState.resources.baseEnergy).toBe(12);
    // lastOnlineTime 取存档中记录的"上次切后台时间"，而不是本次启动时间，供后续离线收益等模块计算离线时长
    expect(restored.lastOnlineTime).toBe(hideTime);
  });
});

describe('SaveService - 奖励流水防重复随存档持久化', () => {
  it('已 confirmed 的奖励流水落盘后重新加载，仍判定为已领取（不会被重复发放）', () => {
    const adapter = new MemoryStorageAdapter();
    const playerState = createInitialPlayerState();
    const ledger = createRewardLedger();

    const outcome = requestRewardGrant(ledger, '1-1', 'reward_1-1');
    expect(outcome.granted).toBe(true);
    confirmRewardGrant(outcome.entry);
    expect(outcome.entry.status).toBe('confirmed');

    const saveTime = T0 + 10_000;
    persistSave(adapter, buildSaveDataFromState(playerState, ledger, saveTime), saveTime);

    const reloadResult = loadSave(adapter, T0 + 20_000);
    const restored = restoreKeyState(reloadResult.data);

    // confirmed 流水状态随 RewardLedger 一并落盘恢复
    const restoredEntry = restored.rewardLedger.entries.find((e) => e.flowId === outcome.entry.flowId);
    expect(restoredEntry?.status).toBe('confirmed');

    // 同时同步进 PlayerState.claimedRewardFlowIds，双重防重复依据均落盘
    expect(restored.playerState.claimedRewardFlowIds).toContain(outcome.entry.flowId);

    // 重新发放申请应被判定为重复并拒绝
    const retryOutcome = requestRewardGrant(restored.rewardLedger, '1-1', 'reward_1-1');
    expect(retryOutcome.duplicate).toBe(true);
    expect(retryOutcome.granted).toBe(false);
    expect(retryOutcome.log).toContain('duplicate reward rejected');
  });
});

describe('SaveService - 版本号与迁移占位', () => {
  it('版本相同时直通，不触发迁移', () => {
    const data = createDefaultSaveData(T0);
    const result = migrateSaveData(data, CURRENT_SAVE_VERSION, CURRENT_SAVE_VERSION);

    expect(result.migrated).toBe(false);
    expect(result.data).toBe(data);
    expect(result.log).toHaveLength(0);
  });

  it('版本不同时触发迁移占位，记录日志并保留数据、写入新版本号', () => {
    const oldData: SaveData = { ...createDefaultSaveData(T0), saveVersion: 0 };
    const result = migrateSaveData(oldData, 0, CURRENT_SAVE_VERSION);

    expect(result.migrated).toBe(true);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.data.playerState).toEqual(oldData.playerState);
    expect(result.log.some((line) => line.includes('save_migration_placeholder'))).toBe(true);
  });

  it('loadSave 在读到旧版本存档时自动走迁移占位并返回当前版本号', () => {
    const adapter = new MemoryStorageAdapter();
    const oldSave: SaveData = { ...createDefaultSaveData(T0), saveVersion: 0 };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(oldSave));

    const result = loadSave(adapter, T0 + 1000);

    expect(result.migrated).toBe(true);
    expect(result.corrupted).toBe(false);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(result.log).toContain('save_loaded_version_migrated');
  });

  it('v5 旧存档（无广告计数字段）迁移到 v6 不崩溃，回填空广告/补给状态', () => {
    const adapter = new MemoryStorageAdapter();
    // 构造一份真实的 v5 旧档：含完整 playerState/rewardLedger/lastOnlineTime，但【没有】adFrequencyState/defeatSupplyState 字段。
    const v5Save = {
      saveVersion: 5,
      playerState: createInitialPlayerState(),
      rewardLedger: createRewardLedger(),
      lastOnlineTime: T0,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v5Save));

    const result = loadSave(adapter, T0 + 1000);
    const restored = restoreKeyState(result.data);

    expect(result.corrupted).toBe(false);
    expect(result.migrated).toBe(true);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    // 缺失的广告/补给计数被回填为空状态（语义=尚未看过广告），不丢失既有 playerState/ledger。
    expect(restored.adFrequencyState).toEqual({ slots: {} });
    expect(restored.defeatSupplyState).toEqual({ bosses: {} });
    expect(restored.playerState).toEqual(v5Save.playerState);
    expect(restored.rewardLedger.entries).toHaveLength(0);
  });

  it('v6 旧存档（无上阵阵容字段）迁移到 v7：回填默认上阵并保证上阵者必拥有（S5C-01）', () => {
    const adapter = new MemoryStorageAdapter();
    // 构造真实 v6 旧档形状：playerState【没有】onFieldHeroIds 字段；
    // ownedHeroIds 模拟一份只拥有合成英雄、不含默认两人的极端旧档，验证"上阵者必拥有"补入。
    const { onFieldHeroIds: _dropped, ...v6PlayerState } = createInitialPlayerState();
    v6PlayerState.ownedHeroIds = ['hero_ryan'];
    v6PlayerState.resources.starCoin = 500;
    const v6Save = {
      saveVersion: 6,
      playerState: v6PlayerState,
      rewardLedger: createRewardLedger(),
      adFrequencyState: { slots: {} },
      defeatSupplyState: { bosses: {} },
      lastOnlineTime: T0,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v6Save));

    const result = loadSave(adapter, T0 + 1000);

    expect(result.corrupted).toBe(false);
    expect(result.migrated).toBe(true);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    // 缺失的上阵字段回填默认上阵（Ron 已确认：hero_isen / hero_mia）
    expect(result.data.playerState.onFieldHeroIds).toEqual([...DEFAULT_ON_FIELD_HERO_IDS]);
    // 上阵英雄补入拥有列表，既有拥有与资源不丢失
    expect(result.data.playerState.ownedHeroIds).toEqual(['hero_ryan', 'hero_isen', 'hero_mia']);
    expect(result.data.playerState.resources.starCoin).toBe(500);
  });

  it('v6 旧存档已含默认两人时迁移到 v7：拥有列表不重复追加', () => {
    const adapter = new MemoryStorageAdapter();
    // 典型真实旧档：灰盒 seed 已把两名英雄落盘进 ownedHeroIds。
    const { onFieldHeroIds: _dropped, ...v6PlayerState } = createInitialPlayerState();
    v6PlayerState.ownedHeroIds = ['hero_isen', 'hero_mia'];
    const v6Save = {
      saveVersion: 6,
      playerState: v6PlayerState,
      rewardLedger: createRewardLedger(),
      adFrequencyState: { slots: {} },
      defeatSupplyState: { bosses: {} },
      lastOnlineTime: T0,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v6Save));

    const result = loadSave(adapter, T0 + 1000);

    expect(result.data.playerState.onFieldHeroIds).toEqual(['hero_isen', 'hero_mia']);
    expect(result.data.playerState.ownedHeroIds).toEqual(['hero_isen', 'hero_mia']);
  });

  it('S5D-02: 当前版本存档 onFieldHeroIds/ownedHeroIds 字段形状异常时自愈为合法 string[]，且 assembleSquad 不再因 "[object Set]" 抛错', () => {
    const adapter = new MemoryStorageAdapter();
    // 模拟真机脏存档：saveVersion 已是当前版本（不走 migrateSaveData），
    // 但 onFieldHeroIds/ownedHeroIds 字段混入了非字符串元素（如误存的 Set 实例），
    // 直接读出会让 assembleSquad 拿到 "[object Set]" 当 heroId 抛错。
    const playerState = createInitialPlayerState();
    const corruptSave = {
      saveVersion: CURRENT_SAVE_VERSION,
      playerState: {
        ...playerState,
        ownedHeroIds: ['hero_isen', new Set(['bad']), 'hero_mia'],
        onFieldHeroIds: [new Set(['bad'])],
      },
      rewardLedger: createRewardLedger(),
      adFrequencyState: { slots: {} },
      defeatSupplyState: { bosses: {} },
      lastOnlineTime: T0,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(corruptSave));

    const result = loadSave(adapter, T0 + 1000);

    expect(result.corrupted).toBe(false);
    // 异常元素被剔除，onFieldHeroIds 剔除后为空数组（自愈为合法 string[]，回填默认阵容由 AppContext 的 seed 规则负责）
    expect(result.data.playerState.onFieldHeroIds).toEqual([]);
    expect(result.data.playerState.ownedHeroIds).toEqual(['hero_isen', 'hero_mia']);

    // 模拟 AppContext 的 seed 规则：onFieldHeroIds 真源为空时回填 Ron 已确认的新档默认阵容
    const restoredOnField =
      result.data.playerState.onFieldHeroIds.length === 0
        ? [...DEFAULT_ON_FIELD_HERO_IDS]
        : result.data.playerState.onFieldHeroIds;
    expect(restoredOnField).toEqual(['hero_isen', 'hero_mia']);

    // assembleSquad 不再把 Set/object 当 heroId，正常组装出战小队
    const { summary } = assembleSquad({
      onFieldHeroIds: restoredOnField,
      heroes: sampleHeroes,
      skills: sampleSkills,
      playerState: { ...result.data.playerState, onFieldHeroIds: restoredOnField },
    });
    expect(summary.map((s) => s.heroId)).toEqual(['hero_isen', 'hero_mia']);
  });
});

describe('SaveService - 广告运行时计数随存档持久化（TD-005）', () => {
  const AD_DAY = Date.UTC(2026, 5, 9, 12, 0, 0); // 固定 UTC 时刻，便于跨日/冷却推算

  function adConfig(overrides: Partial<AdConfig> = {}): AdConfig {
    return {
      schemaVersion: '0.1.0',
      adSlotId: 'ad_test',
      adType: 'rewarded_video',
      entry: 'offline_reward_double',
      rewardId: 'rw_ad_offline_double',
      dailyLimit: 3,
      sessionLimit: 2,
      cooldownSec: 300,
      activeTriggerOnly: true,
      allowRetryOnFail: true,
      flowKeyPrefix: 'ad_test',
      ...overrides,
    };
  }

  it('杀进程/重建服务后，AdFrequencyState 的每日次数与冷却起点不重置', () => {
    const adapter = new MemoryStorageAdapter();
    const cfg = adConfig({ dailyLimit: 3, sessionLimit: 5, cooldownSec: 300 });

    // 第一会话：看完一次广告，每日 +1、冷却起点 = AD_DAY。
    const freq1 = new AdFrequencyService([cfg]);
    freq1.recordCompleted(cfg.adSlotId, AD_DAY);

    // 落盘（携带广告每日/冷却计数；会话次数不入档）。
    const saveTime = AD_DAY + 1_000;
    persistSave(
      adapter,
      buildSaveDataFromState(createInitialPlayerState(), createRewardLedger(), saveTime, freq1.getState()),
      saveTime,
    );

    // 模拟杀进程重进：用新适配器引用同底层存储，重新加载并用恢复的状态重建服务。
    const restored = restoreKeyState(loadSave(adapter, AD_DAY + 2_000).data);
    const freq2 = new AdFrequencyService([cfg], restored.adFrequencyState);

    // 仍在冷却窗内（300s）判定：每日次数未清零（剩 2），冷却起点保留 -> 冷却中。
    const within = freq2.canRequest(cfg.adSlotId, AD_DAY + 60_000);
    expect(within.remainingDaily).toBe(2);
    expect(within.allowed).toBe(false);
    expect(within.reason).toBe('cooldown');
    expect(within.cooldownRemainingMs).toBeGreaterThan(0);

    // 冷却结束后（>300s）：每日计数仍保留为 1（剩 2），冷却已过，可再请求；会话次数则从 0 重新计（新进程内存态）。
    const after = freq2.canRequest(cfg.adSlotId, AD_DAY + 301_000);
    expect(after.remainingDaily).toBe(2);
    expect(after.cooldownRemainingMs).toBe(0);
    expect(after.remainingSession).toBe(5); // 会话次数随新进程重置（设计如此）
    expect(after.allowed).toBe(true);

    // 对照：不带恢复状态的全新服务每日次数会从满额开始（证明差异来自持久化而非默认值）。
    const fresh = new AdFrequencyService([cfg]);
    expect(fresh.canRequest(cfg.adSlotId, AD_DAY + 60_000).remainingDaily).toBe(3);
  });

  it('杀进程/重建服务后，DefeatSupplyState 的同 Boss 每日补给次数不重置', async () => {
    const adapter = new MemoryStorageAdapter();
    const cfg = adConfig({
      adSlotId: 'ad_defeat_supply',
      entry: 'defeat_supply',
      rewardId: 'rw_ad_defeat_supply',
      dailyLimit: 5,
      sessionLimit: 5,
      cooldownSec: 0,
      flowKeyPrefix: 'ad_defeat_supply',
    });

    const buildSupply = (state?: DefeatSupplyState) => {
      const adFlow = new AdRewardFlowService(
        new AdService(new MockAdAdapter({ play: 'completed' })),
        new AdFrequencyService([cfg]),
        [cfg],
      );
      return new DefeatSupplyService(adFlow, [cfg], { maxSuppliesPerBossPerDay: 1, state });
    };

    const playerState: PlayerState = createInitialPlayerState();
    const ledger1 = createRewardLedger();

    // 第一会话：对 boss_1-5 看完一次补给广告 -> 同 Boss 当日计数 +1。
    const supply1 = buildSupply();
    const params: DefeatSupplyParams = {
      rewardLedger: ledger1,
      playerState,
      request: { contextId: 'defeat_ctx_1', bossKey: 'boss_1-5' },
      now: AD_DAY,
      applySupply: () => true,
    };
    const r1 = await supply1.requestSupplyViaAd(params);
    expect(r1.status).toBe('granted');
    expect(supply1.bossCount('boss_1-5', AD_DAY)).toBe(1);

    // 落盘（携带同 Boss 每日补给计数）。
    const saveTime = AD_DAY + 1_000;
    persistSave(
      adapter,
      buildSaveDataFromState(playerState, ledger1, saveTime, undefined, supply1.getState()),
      saveTime,
    );

    // 杀进程重进：重新加载并用恢复的状态重建服务。
    const restored = restoreKeyState(loadSave(adapter, AD_DAY + 2_000).data);
    const supply2 = buildSupply(restored.defeatSupplyState);

    // 同 Boss 当日计数未清零。
    expect(supply2.bossCount('boss_1-5', AD_DAY)).toBe(1);

    // 再次对同 Boss（新失败上下文）请求补给：因当日已达上限 1，被 boss_limit 拦截（证明持久化计数在重建后仍生效）。
    const r2 = await supply2.requestSupplyViaAd({
      rewardLedger: restored.rewardLedger,
      playerState: restored.playerState,
      request: { contextId: 'defeat_ctx_2', bossKey: 'boss_1-5' },
      now: AD_DAY,
      applySupply: () => true,
    });
    expect(r2.status).toBe('boss_limit');
    expect(r2.granted).toBe(false);

    // 对照：不带恢复状态的全新服务同 Boss 计数从 0 起（差异来自持久化）。
    const fresh = buildSupply();
    expect(fresh.bossCount('boss_1-5', AD_DAY)).toBe(0);
  });
});

describe('SaveService - 损坏存档兜底', () => {
  it('JSON 解析失败时回退到默认存档，不阻塞启动流程', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(SAVE_STORAGE_KEY, '{ not-valid-json');

    const result = loadSave(adapter, T0);

    expect(result.corrupted).toBe(true);
    expect(result.isNew).toBe(false);
    expect(result.data).toEqual(createDefaultSaveData(T0));
    expect(result.log).toContain('save_corrupted_json_parse_failed_fallback_to_default');
  });

  it('结构不完整（缺少关键字段）时判定为损坏并回退默认存档', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify({ saveVersion: 1, playerState: {} }));

    const result = loadSave(adapter, T0);

    expect(result.corrupted).toBe(true);
    expect(result.data).toEqual(createDefaultSaveData(T0));
    expect(result.log).toContain('save_corrupted_invalid_shape_fallback_to_default');
  });
});
