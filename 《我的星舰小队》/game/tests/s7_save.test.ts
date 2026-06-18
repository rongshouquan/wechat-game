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

  it('enumerates the exact canonical resource keys（6a-2：删 battleLog/pluginMat/coreMat）', () => {
    expect([...S7_RESOURCE_KEYS]).toEqual([
      'starOre', 'hullAlloy', 'shipBlueprint', 'pilotToken',
      'coreFrag', 'fullCore', 'supplyTicket', 'beacon', 'starCargo',
    ]);
  });

  it('default save data uses S7 version 2 and a fresh 12-resource player state + default mainline progress', () => {
    const data = createDefaultS7SaveData(NOW);
    expect(data.saveVersion).toBe(S7_CURRENT_SAVE_VERSION);
    expect(data.saveVersion).toBe(2);
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
    expect(r.data.saveVersion).toBe(2);
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

  it('restoreS7KeyState returns normalized 12-resource state + timestamp', () => {
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
    expect(r.data.saveVersion).toBe(2);
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
    expect(r.data.saveVersion).toBe(2);
    expect(r.data.playerState.resources.starOre).toBe(7);
    expect(Object.keys(r.data.playerState.resources)).toHaveLength(S7_RESOURCE_KEYS.length);
  });

  it('迁移 v1 旧档到 v2：保留有效资源、丢弃已废弃币(battleLog/pluginMat/coreMat)、补默认主线进度', () => {
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
    expect(r.data.saveVersion).toBe(2);
    // 现有效资源逐一保留
    for (const k of S7_RESOURCE_KEYS) expect(r.data.playerState.resources[k]).toBe(v1Resources[k]);
    // 已废弃币被规范化丢弃（不再在键集内）
    const res = r.data.playerState.resources as Record<string, unknown>;
    for (const dead of ['battleLog', 'pluginMat', 'coreMat']) expect(res[dead]).toBeUndefined();
    // 补默认主线进度
    expect(r.data.playerState.mainlineProgress.currentNodeId).toBe('n001');
    expect(r.data.playerState.mainlineProgress.clearedNodeIds).toEqual([]);
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

  it('keeps S7 version counter independent from 流程版 CURRENT_SAVE_VERSION', () => {
    expect(S7_CURRENT_SAVE_VERSION).toBe(2);
    // 流程版当前为 7；两者各自独立计数，本断言锁定"S7 不复用流程版版本号"。
    expect(S7_CURRENT_SAVE_VERSION).not.toBe(CURRENT_SAVE_VERSION);
  });
});
