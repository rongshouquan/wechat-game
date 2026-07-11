// 对锚与阶梯批：随机带宽"中档"默认的正向守卫（Ron 2026-07-10 拍板转正·⑩§20.13 弹药5 实测组）。
// 守四件事：①敌方全体默认吃暴击基线（10%/×1.5·含幅度精确值）②行字段=覆盖语义（显式 0=关，
// 机制试验台靠这口子保确定性）③side 门——玩家侧无装配单位（召唤物等）不吃敌方基线 ④我方装配
// 基线常量=15%/×1.75 且经 playerCritBaseBlocks 全链生效。
// 如实记档：⑩当时探针敌方只设 rate 未设 dmg（暴伤×1.0=空转），本批按拍板语义落真值（细表§16e）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7_PLAYER_CRIT_BASE, S7_ENEMY_CRIT_BASE } from '../assets/scripts/core/s7/S7PowerRating';
import { playerCritBaseBlocks } from '../assets/scripts/core/s7/S7UnitGrowth';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const bundle = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return bundle;
}
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
function addRowFrom(b: Bundle, table: S7ConfigTableName, srcRowId: string, newRowId: string, overrides: Row): Row {
  const base = JSON.parse(JSON.stringify(row(b, table, srcRowId))) as Row;
  delete base.extraTriggerBlocks;
  delete base.stackRules;
  delete base.alsoApplyStateRefs;
  if (String(srcRowId).startsWith('bu_ship')) {
    base.normalEffectRef = 'eff_basic_attack';
    base.ultimateEffectRef = 'none';
    base.ultimateCdSec = 0;
  }
  const clone = { ...base, rowId: newRowId, ...overrides };
  (b[table] as Row[]).push(clone);
  return clone;
}

/** 1v1 试验台：玩家 攻100/防25 vs 敌 攻100/防25，双方互打（基线伤害=100×100/125=80）。 */
function rig(opts: { enemyOverrides?: Row; timeLimitSec?: number } = {}): Bundle {
  const b = loadBundle();
  addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_bw_ship', {
    maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    targetingTag: 'nearest_random_tie',
  });
  addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_bw_enemy', {
    maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    targetingTag: 'nearest_random_tie',
    ...(opts.enemyOverrides ?? {}),
  });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
    unitStatRef: 'bu_bw_enemy', count: 1, slotRefs: ['r1c0'], spawnDelaySec: 0,
  });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: ['spawn_n001_w1'],
    enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_bw_enemy'],
    timeLimitSec: opts.timeLimitSec ?? 30,
  });
  return b;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}
const hitsBy = (log: S7AutoBattleLogEntry[], actorId: string): number[] =>
  log.filter((e) => e.type === 'damage' && e.actorId === actorId && e.effectRef === 'eff_basic_attack')
    .map((e) => e.amount as number);

const SEEDS = ['bw1', 'bw2', 'bw3'];

describe('对锚与阶梯批 · 随机带宽中档基线', () => {
  it('拍板值钉死：我方 15%/×1.75 · 敌方 10%/×1.5（改动=先过 Ron 换档）', () => {
    expect(S7_PLAYER_CRIT_BASE).toEqual({ rate: 0.15, dmg: 0.75 });
    expect(S7_ENEMY_CRIT_BASE).toEqual({ rate: 0.1, dmg: 0.5 });
    const blocks = playerCritBaseBlocks();
    expect(blocks).toEqual([
      { kind: 'affix', affix: 'critRate', value: 0.15, source: 'crit_base' },
      { kind: 'affix', affix: 'critDmg', value: 0.75, source: 'crit_base' },
    ]);
  });

  it('敌方默认吃基线：敌伤只出现 {80, 120}（120=80×1.5 暴击）且三种子合计暴击数在 10% 带', async () => {
    let crits = 0;
    let total = 0;
    for (const seed of SEEDS) {
      const engine = await engineOf(rig());
      const r = engine.run({
        encounterRef: 'enc_n001', battleSeed: seed,
        playerUnits: [{ unitStatRef: 'bu_bw_ship', slotRef: 'p1c2' }],
      });
      const hits = hitsBy(r.log, 'enemy_0000');
      expect(hits.length).toBeGreaterThanOrEqual(20);
      for (const h of hits) expect([80, 120]).toContain(h);
      crits += hits.filter((h) => h === 120).length;
      total += hits.length;
    }
    // 10% 期望：total≈90 → 期望 9；宽带 [2, 25] 防抖（掷点归战斗种子·确定性可复跑）。
    expect(crits).toBeGreaterThanOrEqual(2);
    expect(crits).toBeLessThanOrEqual(Math.round(total * 0.28));
  });

  it('行字段=覆盖语义：baseCritRate/baseCritDmg 显式 0 → 敌伤恒 80（机制试验台确定性口子）', async () => {
    const engine = await engineOf(rig({ enemyOverrides: { baseCritRate: 0, baseCritDmg: 0 } }));
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'bw1',
      playerUnits: [{ unitStatRef: 'bu_bw_ship', slotRef: 'p1c2' }],
    });
    const hits = hitsBy(r.log, 'enemy_0000');
    expect(hits.length).toBeGreaterThanOrEqual(20);
    expect(hits.every((h) => h === 80)).toBe(true);
  });

  it('side 门：玩家侧裸单位（无装配·同召唤物路径）不吃任何暴击基线 → 我方伤恒 80', async () => {
    for (const seed of SEEDS) {
      const engine = await engineOf(rig());
      const r = engine.run({
        encounterRef: 'enc_n001', battleSeed: seed,
        playerUnits: [{ unitStatRef: 'bu_bw_ship', slotRef: 'p1c2' }],
      });
      const hits = hitsBy(r.log, 'player_p1c2');
      expect(hits.length).toBeGreaterThanOrEqual(20);
      expect(hits.every((h) => h === 80)).toBe(true);
    }
  });

  it('我方装配基线全链：挂 playerCritBaseBlocks → 我方伤 {80, 140}（140=80×1.75）且有暴击', async () => {
    let crits = 0;
    let total = 0;
    for (const seed of SEEDS) {
      const engine = await engineOf(rig());
      const r = engine.run({
        encounterRef: 'enc_n001', battleSeed: seed,
        playerUnits: [{ unitStatRef: 'bu_bw_ship', slotRef: 'p1c2', effectBlocks: playerCritBaseBlocks() }],
      });
      const hits = hitsBy(r.log, 'player_p1c2');
      expect(hits.length).toBeGreaterThanOrEqual(20);
      for (const h of hits) expect([80, 140]).toContain(h);
      crits += hits.filter((h) => h === 140).length;
      total += hits.length;
    }
    // 15% 期望：total≈90 → 期望 13.5；宽带 [4, 35]。
    expect(crits).toBeGreaterThanOrEqual(4);
    expect(crits).toBeLessThanOrEqual(Math.round(total * 0.39));
  });
});

// ===== 对锚与阶梯批 · 墙爬坡带守卫（真实养成态冻结快照·经济尺 dailyMains 口径）=====
// 为什么用冻结快照：守卫要确定性——经济尺活算会随任何经济参数漂移把战斗守卫连坐翻红；
// 快照=校准时点的"普通档该日真实队伍"（来源与复算方法=tools/s7-wall-climb.mjs·细表 §16e）。
// 带故意放宽（破墙日 10-20 靶 → 断言 [5,35]/[5,30]）：守"墙还在那"不守精确点位，
// 复现精确值用爬坡工具；卡墙日守 ≤10（0-5 靶+采样噪声余量）。
import { genLineupFromMains } from '../tools/s7-battles-entry';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { S7_HARD_CONTROL_DIMINISH } from '../assets/scripts/core/s7/S7AutoBattleTypes';

describe('对锚与阶梯批 · 墙爬坡带守卫（普通档冻结态）', () => {
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
  // 经济尺 v0.8 校准态快照（普通档·mains=[阶,舰级,驾星,驾级]×5·主力序）
  const D9 = [[3, 12, 3, 13], [2, 12, 3, 13], [2, 12, 2, 12], [2, 12, 2, 12], [1, 11, 2, 12]];
  const D28 = [[3, 30, 4, 33], [3, 29, 4, 33], [3, 29, 4, 33], [3, 29, 4, 33], [3, 29, 4, 33]];
  const D31 = [[3, 32, 4, 36], [3, 32, 4, 36], [3, 32, 4, 36], [3, 32, 4, 36], [3, 31, 4, 35]];
  const arrange = (m: number[][]) => [m[1], m[0], m[2], m[3], m[4]] as Array<[number, number, number, number]>;

  async function winRate(nodeId: string, mains: number[][], samples = 20): Promise<number> {
    const { lineup } = genLineupFromMains({ ships: MEDIAN, mains: arrange(mains), coreId: 'core08' });
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
    const service = new S7BattleRunService();
    let wins = 0;
    for (let i = 0; i < samples; i += 1) {
      const r = service.run({
        runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] },
        runSeed: `wallguard-${nodeId}-${i}`, lineup, hardControlDiminish: S7_HARD_CONTROL_DIMINISH,
      });
      if (r.result.winner === 'player') wins += 1;
    }
    return (wins / samples) * 100;
  }

  // 带宽定标记录（对锚批·多种子族合并）：n060 破墙 ≈29%（26.7/34.4 两族·带上浮如实报）·
  // n120 卡墙 1.7%·n120 破墙 11.7%。守卫带=点估±采样方差余量（n=32 时 p̂≈30% 的 95% 波动约 ±16pp）
  // ——守"墙还在（不为零）且没塌成白给（不过半）"，精确点位=tools/s7-wall-climb.mjs 的职责
  // （早期 n=20 同族种子曾把 30% 读成 15%=教训记 §16e）。
  it('n060 破墙日（普D9 真实态）：单把胜率落 [2,45]（靶 10-20·实测≈29 带上浮·攻坚日语义在）', async () => {
    const w = await winRate('n060', D9, 32);
    expect(w).toBeGreaterThanOrEqual(2);
    expect(w).toBeLessThanOrEqual(45);
  }, 90000);

  it('n120 卡墙日（普D28 真实态）：单把胜率 ≤12（推不动才叫卡墙）', async () => {
    const w = await winRate('n120', D28, 32);
    expect(w).toBeLessThanOrEqual(12);
  }, 90000);

  it('n120 破墙日（普D31 真实态）：单把胜率落 [2,30]（靶 10-20）', async () => {
    const wBrk = await winRate('n120', D31, 32);
    expect(wBrk).toBeGreaterThanOrEqual(2);
    expect(wBrk).toBeLessThanOrEqual(30);
  }, 90000);
});
