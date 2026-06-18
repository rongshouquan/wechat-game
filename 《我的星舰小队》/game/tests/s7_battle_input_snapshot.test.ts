// BATTLE-RT-07E-1: S7 正式战斗输入快照契约 S7BattleInputSnapshot 校验测试。
// 覆盖：合法快照（结构 / 带 runtime）、必填稳定标识缺失、runIndex 非负整数、来源痕迹（时间/随机/账号/设备）、
// owned 元素校验、units 数量 1..5、站位非法 / 重复、上阵引用未拥有（ship/pilot/core/plugin）、
// 等级/强化非负整数、插件强化越界引用、runtime 未知 ID、多错累计、无副作用、静态隔离与未来在线化不堵死。
// runtime 校验用样例配置加载真实 runtime；不改磁盘样例表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import {
  S7BattleInputSnapshot,
  S7BattleInputUnitSnapshot,
  S7BattleInputSnapshotValidation,
  validateS7BattleInputSnapshot,
} from '../assets/scripts/core/s7/S7BattleInputSnapshot';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const SNAPSHOT_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleInputSnapshot.ts');

type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));

/** 一份结构自洽的合法快照（owned 与上阵引用一致；不依赖真实配置 ID，用于结构层测试）。 */
function validSnapshot(over: Partial<S7BattleInputSnapshot> = {}): S7BattleInputSnapshot {
  return {
    snapshotId: 'snap-001',
    nodeId: 'n001',
    battleAttemptId: 'attempt-001',
    runIndex: 0,
    lineupRevision: 'rev-1',
    runSeed: 'seed-001',
    ownedShips: ['shp01', 'shp02', 'shp03'],
    ownedPilots: ['plt01'],
    ownedPlugins: ['plg01'],
    ownedCores: ['cor01'],
    units: [
      {
        shipId: 'shp01',
        slotRef: 'p0c2',
        pilotId: 'plt01',
        coreId: 'cor01',
        pluginIds: ['plg01'],
        shipLevel: 10,
        pilotLevel: 8,
        coreEnhance: 2,
        pluginEnhanceById: { plg01: 3 },
      },
      { shipId: 'shp02', slotRef: 'p1c2' },
      { shipId: 'shp03', slotRef: 'p2c2' },
    ],
    ...over,
  };
}

/** 在 unit[0] 上覆盖字段（用于注入非法值，含越类型注入）。 */
function snapshotWithUnit0(unitOver: Record<string, unknown>): S7BattleInputSnapshot {
  const snap = validSnapshot();
  snap.units[0] = { ...snap.units[0], ...unitOver } as unknown as S7BattleInputUnitSnapshot;
  return snap;
}

const codes = (v: S7BattleInputSnapshotValidation): string[] => (v.ok ? [] : v.errors.map((e) => e.code));

describe('S7BattleInputSnapshot - 合法快照', () => {
  it('结构自洽的合法快照（无 runtime）通过', () => {
    const v = validateS7BattleInputSnapshot(validSnapshot());
    expect(v.ok).toBe(true);
  });

  it('单舰最小合法快照（仅 shipId + slotRef）通过', () => {
    const v = validateS7BattleInputSnapshot(
      validSnapshot({ ownedShips: ['shp01'], units: [{ shipId: 'shp01', slotRef: 'p0c0' }] }),
    );
    expect(v.ok).toBe(true);
  });

  it('带 runtime 的全装配合法快照（真实 ship/pilot/core/plugin ID）通过', async () => {
    const rt = await runtimeOf(loadBundle());
    const pilotId = (rt.getAll('pilot_config')[0] as { pilotId: string }).pilotId;
    const coreId = (rt.getAll('core_config')[0] as { coreId: string }).coreId;
    const pluginId = (rt.getAll('plugin_config')[0] as { pluginId: string }).pluginId;
    const snap = validSnapshot({
      ownedShips: ['shp01'],
      ownedPilots: [pilotId],
      ownedCores: [coreId],
      ownedPlugins: [pluginId],
      units: [
        {
          shipId: 'shp01',
          slotRef: 'p0c2',
          pilotId,
          coreId,
          pluginIds: [pluginId],
          pluginEnhanceById: { [pluginId]: 1 },
        },
      ],
    });
    expect(validateS7BattleInputSnapshot(snap, rt).ok).toBe(true);
  });
});

describe('S7BattleInputSnapshot - 必填稳定标识', () => {
  it('空 runSeed 失败 (missing_run_seed)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runSeed: '' })))).toContain('missing_run_seed');
  });
  it('空 battleAttemptId 失败 (missing_battle_attempt_id)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ battleAttemptId: '' })))).toContain('missing_battle_attempt_id');
  });
  it('空 lineupRevision 失败 (missing_lineup_revision)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ lineupRevision: '' })))).toContain('missing_lineup_revision');
  });
  it('空 snapshotId / nodeId 失败', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ snapshotId: '' })))).toContain('missing_snapshot_id');
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ nodeId: '' })))).toContain('missing_node_id');
  });
  it('runIndex 负数 / 小数 / 非数失败 (bad_run_index)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runIndex: -1 })))).toContain('bad_run_index');
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runIndex: 1.5 })))).toContain('bad_run_index');
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runIndex: 'x' as unknown as number })))).toContain('bad_run_index');
  });
});

describe('S7BattleInputSnapshot - 来源痕迹（未来在线化不堵死）', () => {
  it('runSeed 含时间来源痕迹失败 (tainted_id_source)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runSeed: 'seed-Date.now()-123' })))).toContain('tainted_id_source');
  });
  it('battleAttemptId 含设备来源痕迹失败', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ battleAttemptId: 'attempt-deviceId-abc' })))).toContain('tainted_id_source');
  });
  it('lineupRevision 含账号来源痕迹失败', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ lineupRevision: 'rev-openid-xyz' })))).toContain('tainted_id_source');
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ lineupRevision: 'rev-unionid-xyz' })))).toContain('tainted_id_source');
  });
  it('runSeed 含随机来源痕迹失败', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ runSeed: 'Math.random-seed' })))).toContain('tainted_id_source');
  });
});

describe('S7BattleInputSnapshot - units 数量与单位结构', () => {
  it('units 为空失败 (empty_units)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ units: [] })))).toContain('empty_units');
  });
  it('units 超过 5 失败 (too_many_units)', () => {
    const six: S7BattleInputUnitSnapshot[] = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].map((slotRef) => ({ shipId: 'shp01', slotRef }));
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ ownedShips: ['shp01'], units: six })))).toContain('too_many_units');
  });
  it('非对象 unit 失败 (bad_unit)，且不抛错', () => {
    const snap = validSnapshot();
    (snap.units as unknown[])[0] = null;
    expect(codes(validateS7BattleInputSnapshot(snap))).toContain('bad_unit');
  });
});

describe('S7BattleInputSnapshot - 站位校验', () => {
  it('非法 slotRef 失败 (bad_slot_ref)', () => {
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ slotRef: 'p3c0' })))).toContain('bad_slot_ref');
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ slotRef: 'r0c0' })))).toContain('bad_slot_ref');
  });
  it('重复 slotRef 失败 (duplicate_slot)', () => {
    const snap = validSnapshot({
      ownedShips: ['shp01', 'shp02'],
      units: [
        { shipId: 'shp01', slotRef: 'p0c2' },
        { shipId: 'shp02', slotRef: 'p0c2' },
      ],
    });
    expect(codes(validateS7BattleInputSnapshot(snap))).toContain('duplicate_slot');
  });
});

describe('S7BattleInputSnapshot - 上阵引用一致性', () => {
  it('上阵 ship 不在 ownedShips 失败 (ship_not_owned)', () => {
    const snap = validSnapshot({ ownedShips: ['shp01'] }); // 默认 units 含 shp02/shp03
    expect(codes(validateS7BattleInputSnapshot(snap))).toContain('ship_not_owned');
  });
  it('pilot 被引用但不在 ownedPilots 失败 (pilot_not_owned)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ ownedPilots: [] })))).toContain('pilot_not_owned');
  });
  it('core 被引用但不在 ownedCores 失败 (core_not_owned)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ ownedCores: [] })))).toContain('core_not_owned');
  });
  it('plugin 被引用但不在 ownedPlugins 失败 (plugin_not_owned)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ ownedPlugins: [] })))).toContain('plugin_not_owned');
  });
  it('owned 含非字符串元素失败 (bad_owned_id)', () => {
    expect(codes(validateS7BattleInputSnapshot(validSnapshot({ ownedShips: ['shp01', 123 as unknown as string, 'shp03'] })))).toContain('bad_owned_id');
  });
});

describe('S7BattleInputSnapshot - 等级 / 强化值', () => {
  it('shipLevel 负数失败 (bad_level_value)', () => {
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ shipLevel: -1 })))).toContain('bad_level_value');
  });
  it('pilotLevel 小数失败 (bad_level_value)', () => {
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ pilotLevel: 1.5 })))).toContain('bad_level_value');
  });
  it('coreEnhance 非数失败 (bad_enhance_value)', () => {
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ coreEnhance: 'x' as unknown as number })))).toContain('bad_enhance_value');
  });
  it('pluginEnhanceById 负值失败 (bad_enhance_value)', () => {
    expect(codes(validateS7BattleInputSnapshot(snapshotWithUnit0({ pluginIds: ['plg01'], pluginEnhanceById: { plg01: -2 } })))).toContain('bad_enhance_value');
  });
  it('pluginEnhanceById 键不在 pluginIds 内失败 (plugin_enhance_unknown_ref)', () => {
    const snap = snapshotWithUnit0({ pluginIds: ['plg01'], pluginEnhanceById: { plg01: 1, plg02: 1 } });
    // plg02 既不在 pluginIds 内、也不在 ownedPlugins 内：应同时含越界引用错误。
    expect(codes(validateS7BattleInputSnapshot(snap))).toContain('plugin_enhance_unknown_ref');
  });
});

describe('S7BattleInputSnapshot - runtime 引用校验', () => {
  it('runtime 开启时未知 ship/pilot/core/plugin id 失败', async () => {
    const rt = await runtimeOf(loadBundle());
    const snap = validSnapshot({
      ownedShips: ['shp_nope'],
      ownedPilots: ['plt_nope'],
      ownedCores: ['cor_nope'],
      ownedPlugins: ['plg_nope'],
      units: [{ shipId: 'shp_nope', slotRef: 'p0c2', pilotId: 'plt_nope', coreId: 'cor_nope', pluginIds: ['plg_nope'] }],
    });
    const v = validateS7BattleInputSnapshot(snap, rt);
    expect(v.ok).toBe(false);
    for (const c of ['unknown_ship', 'unknown_pilot', 'unknown_core', 'unknown_plugin']) {
      expect(codes(v)).toContain(c);
    }
  });

  it('同一快照在不传 runtime 时仅结构校验通过（runtime 才捕获未知 ID）', () => {
    const snap = validSnapshot({
      ownedShips: ['shp_nope'],
      ownedPilots: ['plt_nope'],
      ownedCores: ['cor_nope'],
      ownedPlugins: ['plg_nope'],
      units: [{ shipId: 'shp_nope', slotRef: 'p0c2', pilotId: 'plt_nope', coreId: 'cor_nope', pluginIds: ['plg_nope'] }],
    });
    expect(validateS7BattleInputSnapshot(snap).ok).toBe(true);
  });
});

describe('S7BattleInputSnapshot - 累计错误与无副作用', () => {
  it('多处非法时累计多个错误，不以抛错作为结果', () => {
    const snap = validSnapshot({ runSeed: '', units: [{ shipId: 'shp01', slotRef: 'p9c9' }], ownedShips: [] });
    const v = validateS7BattleInputSnapshot(snap);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.length).toBeGreaterThanOrEqual(2);
      expect(v.errors.every((e) => typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string')).toBe(true);
    }
  });

  it('校验不修改传入快照', () => {
    const snap = validSnapshot();
    const before = JSON.stringify(snap);
    validateS7BattleInputSnapshot(snap);
    expect(JSON.stringify(snap)).toBe(before);
  });

  it('ok:true 结果不含 errors 字段', () => {
    const v = validateS7BattleInputSnapshot(validSnapshot());
    expect(v.ok).toBe(true);
    expect((v as { errors?: unknown }).errors).toBeUndefined();
  });
});

describe('S7BattleInputSnapshot - 静态隔离与未来在线化不堵死', () => {
  it('imports 不含 cc / 存档 / 玩家态 / 编队 / UI / 旧战斗 / 战斗运行壳 / 主线推进', () => {
    const src = readFileSync(SNAPSHOT_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'S7SaveService', 'SaveService', 'PlayerState', 'Formation',
      'MainSceneController', 'BattleView', 'VictoryPresenter', 'DefeatPresenter',
      'completeS7Node', 'S7BattleRunService', 'S7AutoBattleEngine',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });

  it('源码去注释后不含生产种子来源 / 联网 / 支付 / 社交痕迹', () => {
    const raw = readFileSync(SNAPSHOT_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Date.now', 'Math.random', 'openid', 'unionid', 'deviceId',
      'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest', 'http://', 'https://',
      'requestPayment', 'createRewardedVideoAd', 'leaderboard', 'guild', 'friend', 'payment', 'iap',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
