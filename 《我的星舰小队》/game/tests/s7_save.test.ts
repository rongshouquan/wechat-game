// CC-07B/CC-07C: S7 首发存档（12 资源 + 主线进度）测试。
// 覆盖：12 资源默认状态、独立 storage key、缺档初始化、保存后加载、损坏 JSON 回退、
// 结构缺失回退、脏数据规范化、版本规范化、v1->v2 迁移（保留 12 资源 + 补默认主线进度）、
// mainlineProgress 往返，并证明流程版 SaveService 既有行为未受影响。
import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import {
  S7_CURRENT_SAVE_VERSION,
  S7_SAVE_STORAGE_KEY,
  S7_RESOURCE_KEYS,
  createDefaultS7ResourceState,
  createDefaultS7PlayerState,
  createDefaultS7SaveData,
  loadS7Save,
  persistS7Save,
  restoreS7KeyState,
} from '../assets/scripts/save/S7SaveService';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  createDefaultSaveData,
  persistSave,
  loadSave,
} from '../assets/scripts/save/SaveService';

const NOW = 1_700_000_000_000;

describe('s7 save - resource skeleton', () => {
  it('default resource state contains exactly the canonical keys, all 0', () => {
    const res = createDefaultS7ResourceState();
    expect(Object.keys(res).sort()).toEqual([...S7_RESOURCE_KEYS].sort());
    expect(Object.keys(res)).toHaveLength(S7_RESOURCE_KEYS.length);
    for (const k of S7_RESOURCE_KEYS) expect(res[k]).toBe(0);
  });

  it('enumerates the exact canonical resource keys（块6余项：+starGem/pilotShardUniversal、信标拆 3 档、撤 beacon）', () => {
    expect([...S7_RESOURCE_KEYS]).toEqual([
      'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
      'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
      'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo',
    ]);
    // 笼统 beacon 已撤、不在键集内（拆成 3 档）。
    expect([...S7_RESOURCE_KEYS]).not.toContain('beacon');
  });

  it('default save data uses S7 current version and a fresh player state + default mainline progress + 空插件库存 + 空建筑', () => {
    const data = createDefaultS7SaveData(NOW);
    expect(data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    expect(data.saveVersion).toBe(9); // 块7b：v8→v9（活动周期字段）
    expect(data.playerState.pluginInventory).toEqual({ plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 }); // 6d-1/6d-2：默认空库存
    expect(data.playerState.buildings).toEqual({ levels: {} }); // 6b-2：默认空建筑
    expect(data.playerState.population).toEqual({ residents: 0, workers: 0 }); // 6b-4b：默认 0 人口
    expect(data.playerState.exclusiveShards).toEqual({ shards: {} }); // 块6余项：默认空专属碎片库存
    expect(data.playerState.chests).toEqual({ starlightCargo: 0, actionTreasure: 0, expansionTreasure: 0 }); // 块6余项：默认空宝箱
    expect(data.playerState.activityProgress).toEqual({
      action3: { progress: 0, claimedMilestones: [], completionClaimed: false, cycleStartTime: 0, settlementCount: 0 },
      expansion7: { progress: 0, claimedMilestones: [], completionClaimed: false, cycleStartTime: 0, settlementCount: 0 },
    }); // 块7a/7b：默认空活动进度（含周期字段）
    expect(data.lastOnlineTime).toBe(NOW);
    expect(Object.keys(data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
    expect(createDefaultS7PlayerState().resources.starOre).toBe(0);
    expect(data.playerState.mainlineProgress.currentNodeId).toBe('n001');
    expect(data.playerState.mainlineProgress.clearedNodeIds).toEqual([]);
  });
});

describe('s7 save - independent storage domain', () => {
  it('uses a storage key distinct from the 流程版 key', () => {
    expect(S7_SAVE_STORAGE_KEY).not.toBe(SAVE_STORAGE_KEY);
    expect(S7_SAVE_STORAGE_KEY).toBe('starship_squad_s7_save_v1');
  });

  it('initializes default when no S7 save exists (isNew)', () => {
    const adapter = new MemoryStorageAdapter();
    const r = loadS7Save(adapter, NOW);
    expect(r.isNew).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.migrated).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    expect(Object.keys(r.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('round-trips resource values through persist + load', () => {
    const adapter = new MemoryStorageAdapter();
    const data = createDefaultS7SaveData(NOW);
    data.playerState.resources.starOre = 5200;
    data.playerState.resources.fullCore = 3;
    data.playerState.resources.starCargo = 1;
    persistS7Save(adapter, data, NOW + 1000);

    const r = loadS7Save(adapter, NOW + 2000);
    expect(r.isNew).toBe(false);
    expect(r.corrupted).toBe(false);
    expect(r.data.playerState.resources.starOre).toBe(5200);
    expect(r.data.playerState.resources.fullCore).toBe(3);
    expect(r.data.playerState.resources.starCargo).toBe(1);
    expect(r.data.lastOnlineTime).toBe(NOW + 1000);
    expect(Object.keys(r.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('round-trips buildings + pluginInventory through persist + load (6b-2 修复 persist 漏字段)', () => {
    const adapter = new MemoryStorageAdapter();
    const data = createDefaultS7SaveData(NOW);
    data.playerState.buildings.levels['bld_dock'] = 3;
    data.playerState.buildings.levels['bld_supply_station'] = 1;
    data.playerState.pluginInventory.plugins.push({ instanceId: 'pi1', pluginId: 'plg01', quality: 'fine' });
    data.playerState.pluginInventory.nextInstanceSeq = 2;
    data.playerState.population = { residents: 7, workers: 3 };
    persistS7Save(adapter, data, NOW + 1000);

    const r = loadS7Save(adapter, NOW + 2000);
    // 建筑等级随存档往返保留（旧 persist 不会丢，因 buildings 是新加；此处主要锁“persist 真把它写进去了”）
    expect(r.data.playerState.buildings.levels).toEqual({ bld_dock: 3, bld_supply_station: 1 });
    // 插件库存往返保留——旧 persist 漏写会让它退回默认空库存，此断言即为防回归
    expect(r.data.playerState.pluginInventory.plugins).toEqual([{ instanceId: 'pi1', pluginId: 'plg01', quality: 'fine' }]);
    expect(r.data.playerState.pluginInventory.nextInstanceSeq).toBe(2);
    // 人口往返保留（6b-4b）
    expect(r.data.playerState.population).toEqual({ residents: 7, workers: 3 });
  });

  it('round-trips exclusiveShards + chests through persist + load（块6余项·防 persist 漏字段）', () => {
    const adapter = new MemoryStorageAdapter();
    const data = createDefaultS7SaveData(NOW);
    data.playerState.exclusiveShards.shards['ship01'] = 12;
    data.playerState.exclusiveShards.shards['pil03'] = 5;
    data.playerState.chests = { starlightCargo: 2, actionTreasure: 1, expansionTreasure: 3 };
    persistS7Save(adapter, data, NOW + 1000);

    const r = loadS7Save(adapter, NOW + 2000);
    // 漏写会让它退回默认空，本断言即为防回归（呼应 6b-2 persist 漏 pluginInventory 的教训）
    expect(r.data.playerState.exclusiveShards.shards).toEqual({ ship01: 12, pil03: 5 });
    expect(r.data.playerState.chests).toEqual({ starlightCargo: 2, actionTreasure: 1, expansionTreasure: 3 });
  });

  it('round-trips activityProgress through persist + load（块7a·防 persist 漏字段）', () => {
    const adapter = new MemoryStorageAdapter();
    const data = createDefaultS7SaveData(NOW);
    data.playerState.activityProgress.action3 = { progress: 150, claimedMilestones: ['a1'], completionClaimed: true, cycleStartTime: NOW, settlementCount: 1 };
    data.playerState.activityProgress.expansion7 = { progress: 40, claimedMilestones: [], completionClaimed: false, cycleStartTime: NOW, settlementCount: 0 };
    persistS7Save(adapter, data, NOW + 1000);

    const r = loadS7Save(adapter, NOW + 2000);
    expect(r.data.playerState.activityProgress.action3).toEqual({ progress: 150, claimedMilestones: ['a1'], completionClaimed: true, cycleStartTime: NOW, settlementCount: 1 });
    expect(r.data.playerState.activityProgress.expansion7).toEqual({ progress: 40, claimedMilestones: [], completionClaimed: false, cycleStartTime: NOW, settlementCount: 0 });
  });

  it('restoreS7KeyState returns normalized 13-resource state + timestamp', () => {
    const restored = restoreS7KeyState(createDefaultS7SaveData(NOW));
    expect(Object.keys(restored.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
    expect(restored.lastOnlineTime).toBe(NOW);
  });
});

describe('s7 save - corruption / structure fallback', () => {
  it('falls back to default on corrupted JSON', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(S7_SAVE_STORAGE_KEY, '{not valid json');
    const r = loadS7Save(adapter, NOW);
    expect(r.corrupted).toBe(true);
    expect(r.isNew).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    expect(Object.keys(r.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('falls back to default on structurally invalid save', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(S7_SAVE_STORAGE_KEY, JSON.stringify({ foo: 1 }));
    const r = loadS7Save(adapter, NOW);
    expect(r.corrupted).toBe(true);
    expect(r.data.playerState.resources.starOre).toBe(0);
  });

  it('normalizes dirty resources: fills missing keys, drops unknown, zeroes invalid/negative', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 1,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 100, hullAlloy: -5, pilotToken: 'oops', bogusKey: 999 },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW);
    expect(r.corrupted).toBe(false);
    const res = r.data.playerState.resources as Record<string, number>;
    expect(Object.keys(res).sort()).toEqual([...S7_RESOURCE_KEYS].sort());
    expect(res.starOre).toBe(100);
    expect(res.hullAlloy).toBe(0); // 负数 -> 0
    expect(res.pilotToken).toBe(0); // 非数 -> 0
    expect(res.bogusKey).toBeUndefined(); // 未知键丢弃
    expect(res.coreFrag).toBe(0); // 缺失键补 0
  });

  it('normalizes + restamps on version mismatch (migrated)', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({ saveVersion: 0, lastOnlineTime: NOW, playerState: { resources: { starOre: 7 } } }),
    );
    const r = loadS7Save(adapter, NOW);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    expect(r.data.playerState.resources.starOre).toBe(7);
    expect(Object.keys(r.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('迁移 v1 旧档到当前版本：保留有效资源、丢弃已废弃币(battleLog/pluginMat/coreMat)、补默认主线进度+空插件库存', () => {
    const adapter = new MemoryStorageAdapter();
    // v1 旧档形状：仅 resources（含现已废弃的 battleLog/pluginMat/coreMat），无 mainlineProgress。
    const v1Resources: Record<string, number> = {
      starOre: 5200, hullAlloy: 2000, battleLog: 1800, shipBlueprint: 10, pilotToken: 6, pluginMat: 500,
      coreMat: 150, coreFrag: 20, fullCore: 1, supplyTicket: 8, beacon: 5, starCargo: 1,
    };
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({ saveVersion: 1, lastOnlineTime: NOW, playerState: { resources: v1Resources } }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    const res = r.data.playerState.resources as Record<string, unknown>;
    // 仍存在的旧键逐一保留（排除已被拆/撤的 beacon——它走 v6 carry，单独断言）
    for (const k of S7_RESOURCE_KEYS) {
      if (k === 'beaconCommon') continue;
      if (k in v1Resources) expect(r.data.playerState.resources[k]).toBe(v1Resources[k]);
    }
    // v6 迁移：旧档笼统 beacon(5) 并入 beaconCommon、不丢；其余信标档与新币默认 0。
    expect(r.data.playerState.resources.beaconCommon).toBe(5);
    expect(r.data.playerState.resources.beaconRare).toBe(0);
    expect(r.data.playerState.resources.beaconEpic).toBe(0);
    expect(r.data.playerState.resources.starGem).toBe(0);
    expect(r.data.playerState.resources.pilotShardUniversal).toBe(0);
    expect(res.beacon).toBeUndefined(); // 笼统 beacon 已不在键集内
    // 已废弃币被规范化丢弃（不再在键集内）
    for (const dead of ['battleLog', 'pluginMat', 'coreMat']) expect(res[dead]).toBeUndefined();
    // 补默认主线进度
    expect(r.data.playerState.mainlineProgress.currentNodeId).toBe('n001');
    expect(r.data.playerState.mainlineProgress.clearedNodeIds).toEqual([]);
  });

  it('迁移 v3 旧档到 v4：补默认空建筑，保留资源/主线/插件库存（加性迁移，无需重置）', () => {
    const adapter = new MemoryStorageAdapter();
    // v3 旧档形状：有 resources + mainlineProgress + pluginInventory，但无 buildings。
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 3,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 3000 },
          mainlineProgress: { currentNodeId: 'n004', clearedNodeIds: ['n001', 'n002', 'n003'] },
          pluginInventory: { plugins: [{ instanceId: 'pi1', pluginId: 'plg02', quality: 'superior' }], nextInstanceSeq: 2, nextActionSeq: 0 },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    // 新字段 buildings 补默认空
    expect(r.data.playerState.buildings).toEqual({ levels: {} });
    // 旧字段全保留
    expect(r.data.playerState.resources.starOre).toBe(3000);
    expect(r.data.playerState.mainlineProgress.currentNodeId).toBe('n004');
    expect(r.data.playerState.pluginInventory.plugins).toEqual([{ instanceId: 'pi1', pluginId: 'plg02', quality: 'superior' }]);
  });

  it('迁移 v4 旧档到 v5：补默认 0 人口，保留建筑等旧字段（加性迁移，无需重置）', () => {
    const adapter = new MemoryStorageAdapter();
    // v4 旧档形状：有 resources/mainline/插件/buildings，但无 population。
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 4,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 1500 },
          mainlineProgress: { currentNodeId: 'n002', clearedNodeIds: ['n001'] },
          pluginInventory: { plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 },
          buildings: { levels: { bld_dock: 2 } },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    // 新字段 population 补默认 0
    expect(r.data.playerState.population).toEqual({ residents: 0, workers: 0 });
    // 旧字段保留
    expect(r.data.playerState.resources.starOre).toBe(1500);
    expect(r.data.playerState.buildings.levels).toEqual({ bld_dock: 2 });
  });

  it('迁移 v5 旧档到 v6：笼统 beacon 并入 beaconCommon，新币默认 0，旧字段保留（加性迁移）', () => {
    const adapter = new MemoryStorageAdapter();
    // v5 旧档形状：钱包用笼统 beacon、无 starGem/pilotShardUniversal/beacon 三档。
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 5,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 2200, beacon: 7, starCargo: 3 },
          mainlineProgress: { currentNodeId: 'n003', clearedNodeIds: ['n001', 'n002'] },
          pluginInventory: { plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 },
          buildings: { levels: { bld_dock: 4 } },
          population: { residents: 5, workers: 2 },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    // beacon(7) → beaconCommon；其余信标档/新币默认 0
    expect(r.data.playerState.resources.beaconCommon).toBe(7);
    expect(r.data.playerState.resources.beaconRare).toBe(0);
    expect(r.data.playerState.resources.beaconEpic).toBe(0);
    expect(r.data.playerState.resources.starGem).toBe(0);
    expect(r.data.playerState.resources.pilotShardUniversal).toBe(0);
    expect((r.data.playerState.resources as Record<string, unknown>).beacon).toBeUndefined();
    // 旧字段全保留
    expect(r.data.playerState.resources.starOre).toBe(2200);
    expect(r.data.playerState.resources.starCargo).toBe(3);
    expect(r.data.playerState.buildings.levels).toEqual({ bld_dock: 4 });
    expect(r.data.playerState.population).toEqual({ residents: 5, workers: 2 });
  });

  it('迁移 v6 旧档到 v7：补默认空专属碎片库存 + 空宝箱，保留旧字段（加性迁移，无需重置）', () => {
    const adapter = new MemoryStorageAdapter();
    // v6 旧档形状：有钱包/主线/插件/建筑/人口，但无 exclusiveShards / chests。
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 6,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 1800, beaconCommon: 2 },
          mainlineProgress: { currentNodeId: 'n006', clearedNodeIds: ['n001', 'n002', 'n003', 'n004', 'n005'] },
          pluginInventory: { plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 },
          buildings: { levels: { bld_dock: 5 } },
          population: { residents: 3, workers: 1 },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    // 新字段补默认空
    expect(r.data.playerState.exclusiveShards).toEqual({ shards: {} });
    expect(r.data.playerState.chests).toEqual({ starlightCargo: 0, actionTreasure: 0, expansionTreasure: 0 });
    // 旧字段全保留
    expect(r.data.playerState.resources.starOre).toBe(1800);
    expect(r.data.playerState.resources.beaconCommon).toBe(2);
    expect(r.data.playerState.buildings.levels).toEqual({ bld_dock: 5 });
    expect(r.data.playerState.population).toEqual({ residents: 3, workers: 1 });
  });

  it('迁移 v7 旧档到当前：补默认空活动进度，保留旧字段（加性迁移，无需重置）', () => {
    const adapter = new MemoryStorageAdapter();
    // v7 旧档形状：有钱包/主线/插件/建筑/人口/专属碎片/宝箱，但无 activityProgress。
    adapter.setString(
      S7_SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 7,
        lastOnlineTime: NOW,
        playerState: {
          resources: { starOre: 2600, starGem: 4 },
          mainlineProgress: { currentNodeId: 'n008', clearedNodeIds: ['n001'] },
          pluginInventory: { plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 },
          buildings: { levels: { bld_dock: 6 } },
          population: { residents: 4, workers: 2 },
          exclusiveShards: { shards: { ship01: 9 } },
          chests: { starlightCargo: 1, actionTreasure: 0, expansionTreasure: 0 },
        },
      }),
    );
    const r = loadS7Save(adapter, NOW + 5);
    expect(r.migrated).toBe(true);
    expect(r.corrupted).toBe(false);
    expect(r.data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    // 新字段补默认空（含块7b 周期字段）
    expect(r.data.playerState.activityProgress).toEqual({
      action3: { progress: 0, claimedMilestones: [], completionClaimed: false, cycleStartTime: 0, settlementCount: 0 },
      expansion7: { progress: 0, claimedMilestones: [], completionClaimed: false, cycleStartTime: 0, settlementCount: 0 },
    });
    // 旧字段全保留
    expect(r.data.playerState.resources.starGem).toBe(4);
    expect(r.data.playerState.exclusiveShards.shards).toEqual({ ship01: 9 });
    expect(r.data.playerState.chests).toEqual({ starlightCargo: 1, actionTreasure: 0, expansionTreasure: 0 });
  });

  it('round-trips mainlineProgress through persist + load', () => {
    const adapter = new MemoryStorageAdapter();
    const data = createDefaultS7SaveData(NOW);
    data.playerState.mainlineProgress = { currentNodeId: 'n005', clearedNodeIds: ['n001', 'n002', 'n003', 'n004'] };
    persistS7Save(adapter, data, NOW + 10);
    const r = loadS7Save(adapter, NOW + 20);
    expect(r.data.playerState.mainlineProgress.currentNodeId).toBe('n005');
    expect(r.data.playerState.mainlineProgress.clearedNodeIds).toEqual(['n001', 'n002', 'n003', 'n004']);
  });
});

describe('s7 save - 流程版 SaveService isolation', () => {
  it('S7 persist does not affect 流程版 load on the same adapter, and vice versa', () => {
    const adapter = new MemoryStorageAdapter();

    // 写入流程版存档（其自有 key）。
    const legacy = createDefaultSaveData(NOW);
    legacy.playerState.resources.starCoin = 999;
    persistSave(adapter, legacy, NOW);

    // 写入 S7 存档（独立 key）。
    const s7 = createDefaultS7SaveData(NOW);
    s7.playerState.resources.starOre = 42;
    persistS7Save(adapter, s7, NOW);

    // 流程版加载不受 S7 写入影响：仍为流程版结构 / 版本 / 数值。
    const legacyLoaded = loadSave(adapter, NOW);
    expect(legacyLoaded.corrupted).toBe(false);
    expect(legacyLoaded.isNew).toBe(false);
    expect(legacyLoaded.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(legacyLoaded.data.playerState.resources.starCoin).toBe(999);
    // 流程版结构里不存在 S7 的 starOre 资源键。
    expect((legacyLoaded.data.playerState.resources as unknown as Record<string, unknown>).starOre).toBeUndefined();

    // S7 加载同样独立、互不污染。
    const s7Loaded = loadS7Save(adapter, NOW);
    expect(s7Loaded.data.playerState.resources.starOre).toBe(42);
    expect(Object.keys(s7Loaded.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('S7 load on a store holding only a 流程版 save returns isNew (does not read 流程版 key)', () => {
    const adapter = new MemoryStorageAdapter();
    persistSave(adapter, createDefaultSaveData(NOW), NOW);
    const r = loadS7Save(adapter, NOW);
    expect(r.isNew).toBe(true); // 未读取流程版 key，视为无 S7 档
  });

  it('S7 维护自己独立的版本计数（独立性靠各用各的 storage key，与版本号是否相等无关）', () => {
    expect(S7_CURRENT_SAVE_VERSION).toBe(9);
    expect(Number.isInteger(S7_CURRENT_SAVE_VERSION)).toBe(true);
    // 真正的隔离保证 = S7 与流程版用不同 storage key（互不读写）；两个独立计数器取到同值纯属巧合、无害。
    // （原断言用"版本号不相等"当独立性代理，流程版也到 7 后该代理失效——隔离本质从来不是值不同。）
    expect(S7_SAVE_STORAGE_KEY).not.toBe(SAVE_STORAGE_KEY);
  });
});
