// BATTLE-RT-07E-3-1 / RT-07E-3-3-1: S7ShipBattleStatCoverage 覆盖报告测试。
// RT-07E-3-3-1 后 12 艘星舰均已有 base stat 行：断言全覆盖（covered=shp01..shp12, missing=[], ambiguous=[]），
// 新九行 shp04..shp12 各且仅 1 行、coreEffectRef==='none'、ultimateEffectRef 以 eff_ult_ 开头、
// 非 eff_ult_summon_drone、不引用 eff_state_*；并保留 duplicate->ambiguous、移除行->missing 两类缺口检测；
// report 无副作用；静态隔离与未来在线化不堵死。边界用例在内存里 clone 配置表构造；不改磁盘样例表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { analyzeS7ShipBattleStatCoverage } from '../assets/scripts/core/s7/S7ShipBattleStatCoverage';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const COVERAGE_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7ShipBattleStatCoverage.ts');

type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;
interface BattleUnitRow {
  rowId: string;
  targetType: string;
  unitRef: string;
  coreEffectRef: string;
  ultimateEffectRef: string;
  attackRangeCells: number; // ⑥第一段：C16 全舰射程断言用
}

function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const cloneBundle = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));

// ⑥第一段重定基（细表§12）：默认盘 12→20（真源首发 20 舰）；shp01-12 沿用冻结 rowId 原位改造、shp13-20 新行。
const ALL_SHIPS = [
  'shp01', 'shp02', 'shp03', 'shp04', 'shp05', 'shp06', 'shp07', 'shp08', 'shp09', 'shp10',
  'shp11', 'shp12', 'shp13', 'shp14', 'shp15', 'shp16', 'shp17', 'shp18', 'shp19', 'shp20',
];
/** shipId -> battle stat rowId 冻结映射（旧 12 行 rowId 不变=引用面稳定；新 8 行 bu_ship_shpXX）。 */
const NEW_NINE: Record<string, string> = {
  shp04: 'bu_ship_fireworks_cruiser',
  shp05: 'bu_ship_static_disruptor',
  shp06: 'bu_ship_oasis_repair',
  shp07: 'bu_ship_star_ring_charger',
  shp08: 'bu_ship_sweeper_drone',
  shp09: 'bu_ship_longwave_suppressor',
  shp10: 'bu_ship_flashrail_reaper',
  shp11: 'bu_ship_blackshield_escort',
  shp12: 'bu_ship_oldport_flex',
  shp13: 'bu_ship_shp13',
  shp14: 'bu_ship_shp14',
  shp15: 'bu_ship_shp15',
  shp16: 'bu_ship_shp16',
  shp17: 'bu_ship_shp17',
  shp18: 'bu_ship_shp18',
  shp19: 'bu_ship_shp19',
  shp20: 'bu_ship_shp20',
};

describe('S7ShipBattleStatCoverage - 20 艘全覆盖（⑥第一段后）', () => {
  it('totalShips=20，shipIds 为 shp01..shp20（稳定升序）', async () => {
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(loadBundle()));
    expect(report.totalShips).toBe(20);
    expect(report.shipIds).toEqual(ALL_SHIPS);
  });

  it('coveredShipIds 为 shp01..shp20，missingShipIds 与 ambiguousShipIds 均为空', async () => {
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(loadBundle()));
    expect(report.coveredShipIds).toEqual(ALL_SHIPS);
    expect(report.missingShipIds).toEqual([]);
    expect(report.ambiguousShipIds).toEqual([]);
  });

  it('rowsByShipId 旧三行映射保持原样', async () => {
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(loadBundle()));
    expect(report.rowsByShipId.shp01).toEqual(['bu_ship_vanguard']);
    expect(report.rowsByShipId.shp02).toEqual(['bu_ship_gunner']);
    expect(report.rowsByShipId.shp03).toEqual(['bu_ship_guardian']);
  });

  it('rowsByShipId 对 shp04..shp12 各有且只有 1 行（映射到冻结 rowId）', async () => {
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(loadBundle()));
    for (const [shipId, rowId] of Object.entries(NEW_NINE)) {
      expect(report.rowsByShipId[shipId]).toEqual([rowId]);
    }
  });

  it('记录当前消费者 / 输入 / 派生状态事实（derivationStatus 仍为 not_connected）', async () => {
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(loadBundle()));
    expect(report.currentConsumer).toBe('S7BattleEncounterAssembler');
    expect(report.currentConsumerInput).toBe('shipId+slotRef');
    expect(report.derivationStatus).toBe('not_connected');
  });
});

describe('S7ShipBattleStatCoverage - 舰行 base stat 约束（⑥第一段重定基）', () => {
  it('全 20 舰行 coreEffectRef==="none"，大招引用 ∈ {none, eff_s7_*}（M 依赖舰=none·细表§12 注记），不引用 eff_state_*', async () => {
    const rt = await runtimeOf(loadBundle());
    const units = rt.getAll<BattleUnitRow>('battle_unit_stat_param');
    for (const shipId of ALL_SHIPS) {
      const rows = units.filter((u) => u.targetType === 'ship' && u.unitRef === shipId);
      expect(rows).toHaveLength(1);
      const u = rows[0];
      expect(u.coreEffectRef).toBe('none'); // 星核=装配层积木下发，不占行级挂点
      // 旧口径 eff_ult_ 前缀已随 40 技能落数换代为 eff_s7_ 命名域；无大招（待机制批）写 none。
      const legalUlt = u.ultimateEffectRef === 'none' || u.ultimateEffectRef.startsWith('eff_s7_');
      expect(legalUlt).toBe(true);
      expect(u.ultimateEffectRef.startsWith('eff_state_')).toBe(false);
      expect(u.attackRangeCells).toBe(99); // C16 全舰射程=事实无限
    }
  });
});

describe('S7ShipBattleStatCoverage - 缺口检测仍生效（边界构造）', () => {
  it('duplicate ship stat 行 -> 对应 shipId 进入 ambiguous，不进入 covered', async () => {
    const b = cloneBundle(loadBundle());
    const dup = { ...row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), rowId: 'bu_ship_vanguard_dup' }; // 仍 targetType=ship & unitRef=shp01
    (b.battle_unit_stat_param as Row[]).push(dup);
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(b));
    expect(report.ambiguousShipIds).toContain('shp01');
    expect(report.coveredShipIds).not.toContain('shp01');
    expect(report.rowsByShipId.shp01).toEqual(['bu_ship_vanguard', 'bu_ship_vanguard_dup']);
  });

  it('内存移除某 ship 战斗行 -> 对应 shipId 回到 missing', async () => {
    const b = cloneBundle(loadBundle());
    b.battle_unit_stat_param = (b.battle_unit_stat_param as Row[]).filter((r) => r.rowId !== 'bu_ship_fireworks_cruiser');
    const report = analyzeS7ShipBattleStatCoverage(await runtimeOf(b));
    expect(report.missingShipIds).toContain('shp04');
    expect(report.coveredShipIds).not.toContain('shp04');
    expect(report.rowsByShipId.shp04).toEqual([]);
  });
});

describe('S7ShipBattleStatCoverage - 无副作用', () => {
  it('report 不修改 runtime 返回的 ship_config / battle_unit_stat_param 数组或行', async () => {
    const rt = await runtimeOf(loadBundle());
    const before = JSON.stringify({
      ships: rt.getAll('ship_config'),
      units: rt.getAll('battle_unit_stat_param'),
    });
    analyzeS7ShipBattleStatCoverage(rt);
    const after = JSON.stringify({
      ships: rt.getAll('ship_config'),
      units: rt.getAll('battle_unit_stat_param'),
    });
    expect(after).toBe(before);
  });
});

describe('S7ShipBattleStatCoverage - 静态隔离与未来在线化不堵死', () => {
  it('源码不含 cc / UI / 旧战斗 / 存档 / 玩家态 / 编队 / 运行壳 / 引擎 / 主线推进 import', () => {
    const src = readFileSync(COVERAGE_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'MainSceneController', 'BattleView', 'VictoryPresenter', 'DefeatPresenter', 'completeS7Node',
      'S7SaveService', 'SaveService', 'PlayerState', 'Formation', 'S7BattleRunService', 'S7AutoBattleEngine',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });

  it('源码去注释后不含联网 / 支付 / 社交 / 生产种子来源痕迹', () => {
    const raw = readFileSync(COVERAGE_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Date.now', 'Math.random', 'openid', 'unionid', 'deviceId',
      'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest', 'http://', 'https://',
      'requestPayment', 'createRewardedVideoAd', 'leaderboard', 'guild', 'friend', 'payment', 'iap',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
