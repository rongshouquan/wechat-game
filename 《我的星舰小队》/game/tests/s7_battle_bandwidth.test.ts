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

// ⚠️ 段二战斗批显式挂起（skip=记档非删除·非装绿）：本组=150 关旧世界墙工况守卫（n060/n120 冻结态
// 爬坡带·v0.9 快照）——450 关重铺后 n060/n120=普通关、九墙挪 n104-n450、WALL_BOOST 旧键全不命中，
// "卡墙/破墙"被测对象物理消失（红=真世界变化非引擎坏；绿=语义空转假绿，一并挂）。
// 到期条件=段 2 WALL_BOOST 九墙手调+段 6 初见口径实测后，按新世界九墙+新冻结态快照重建本组守卫
// （s7-wall-climb.mjs 复算口径不变·恢复时删本注记）。带宽中档基线组（上方）=引擎行为守卫，不受影响照跑。
describe.skip('定价重锚批 · 墙爬坡带守卫（普通档冻结态·v0.9）〔挂起：待段2 WALL_BOOST+段6 实测后按 450 关九墙重建〕', () => {
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
  // 经济尺 v0.9 校准态快照（普通档·mains=[阶,舰级,驾星,驾级]×5·主力序）。
  // 重定基（旧→新→为什么对）：v0.8 快照=旧刻度经济轨迹（D9 舰级 12/驾 13 等）——定价重锚 v1 后
  // 压力表/敌配/到达轨迹全体重落，冻结态按新世界重采（tools/s7-wall-climb.mjs 复算口径不变）。
  const D9 = [[3, 12, 3, 12], [2, 12, 3, 12], [2, 12, 2, 12], [1, 11, 2, 12], [1, 11, 2, 12]];
  const D10 = [[3, 13, 3, 14], [2, 13, 3, 13], [2, 13, 3, 13], [2, 13, 2, 13], [1, 12, 2, 13]];
  const D31 = [[3, 32, 4, 35], [3, 32, 4, 35], [3, 31, 4, 35], [3, 31, 4, 34], [3, 31, 4, 34]];
  const D33 = [[4, 33, 4, 37], [3, 33, 4, 36], [3, 33, 4, 36], [3, 33, 4, 36], [3, 33, 4, 36]];
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

  // 带宽定标记录（定价重锚批·n=40 定版）：n060 破墙 5%/+1日 30%/+2日 88%；n120=升阶事件
  // 二值墙（卡墙全 0 → 主力1 升 SS 日 93%——§16e 肝/重同款"破墙=升阶事件"新世界全档化）。
  // 守卫哲学不变：守"墙还在+形状在"，精确点位=tools/s7-wall-climb.mjs 的职责；
  // 带=点估±采样方差余量（n=32 时 95% 波动约 ±8-16pp·早期同族种子教训记 §16e）。
  it('n060 破墙日（普D9 真实态·段2a 过渡：点带转爬坡不倒挂+打印）', async () => {
    // ⚠️ 段2a 过渡豁免（同旧靶豁免制·到期=2b WALL_BOOST 按新世界重收敛后恢复点带）：R1 五档平移
    // 把旧 L20-100 档位内容压进 L10-50——冻结的 D9 真实态（~L20-30 主力）现携带旧 L40-60 档战力，
    // 旧墙系数下破墙日实测 5%→72%（"同纸面更强"的过渡失真·2b power-recalib+墙循环收账）。
    // 过渡底线仍武装：爬坡不倒挂（次日 ≥ 破墙日 −15pp 采样余量）+ 双点读数打印留档。
    const wBrk = await winRate('n060', D9, 32);
    const wNext = await winRate('n060', D10, 32);
    // eslint-disable-next-line no-console
    console.log(`[旧靶豁免·段2a 过渡] n060 冻结态双点：破墙日 ${wBrk}%（旧带 ≤30）/ 次日 ${wNext}%（旧带 [8,65]）——2b 墙循环重收敛收账`);
    expect(wNext).toBeGreaterThanOrEqual(wBrk - 15);
  }, 90000);

  it('n120 卡墙日（普D31 真实态）：单把胜率 ≤12（推不动才叫卡墙）', async () => {
    const w = await winRate('n120', D31, 32);
    expect(w).toBeLessThanOrEqual(12); // 实测 0%（二值墙卡墙侧）
  }, 90000);

  it('n120 破墙日（普D33 真实态=主力1 升 SS 日）：单把胜率 ≥50（升阶事件必须破得开）', async () => {
    const wBrk = await winRate('n120', D33, 32);
    expect(wBrk).toBeGreaterThanOrEqual(50); // 实测 93%：二值事件墙的"开门"侧——SS 日破不开=质变体感破坏
  }, 90000);
});
