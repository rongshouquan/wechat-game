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

// 段6 核销恢复（任务单 6.6·挂起注记删除）：150 关旧世界组（n060/n120 卡/破二日形状·v0.9 快照）→
// 450 关新组重建。重定基（旧→新→为什么对）：旧守卫形状="战力墙哪天破"；450 世界墙⑧=解题墙
// （毕业核=钥匙·R22 A4"无核毕不了业"生死线实证），守卫本体换成「无核破不开＋有核当日开＋首墙
// 迟到者形状」三态——快照=经济尺普通档 dailyMains 段6 文件态复跑抽取（D5=n104 到达日/D43=n400
// 破⑧日〔钥匙路 D40 撞 D43 破〕）；钉值依据=段6 实测：n400 无核硬堆态爬坡全程 0-3%（wall-climb
// 32 样本 D41-45）/有核+core15≈65%（段5 A案 probe 20 样本）/n104 普通 D5 到达 75%（迟到者奖励·
// 肝档才是 n104 矩阵锚=§21.1 二值形态）。s7-wall-climb.mjs 复算口径不变。
describe('段6 · 450 关墙守卫（墙⑧钥匙双态+首墙形状·普通档冻结态快照）', () => {
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
  // 经济尺普通档快照（段6 采·mains=[阶,舰级,驾星,驾级]×5·主力序）：
  const D5 = [[3, 10, 2, 10], [1, 10, 2, 9], [1, 9, 2, 9], [1, 9, 2, 9], [1, 9, 2, 9]];
  const D43 = [[4, 50, 5, 50], [4, 50, 5, 50], [4, 50, 5, 50], [3, 40, 4, 40], [3, 40, 4, 40]];
  const arrange = (m: number[][]) => [m[1], m[0], m[2], m[3], m[4]] as Array<[number, number, number, number]>;

  async function winRate(nodeId: string, mains: number[][], coreId: string, samples = 20): Promise<number> {
    const { lineup } = genLineupFromMains({ ships: MEDIAN, mains: arrange(mains), coreId });
    // core 归位主输出位（genLineupFromMains 把核给第一个 S/SS=shp05 磐石坦——超新星挂低攻坦=
    // 爆伤与击杀循环失真〔首验 0% 实证〕；genLineup/段5 probe 口径=第二舰主输出 i===1=shp01）。
    for (const u of lineup) delete u.coreId;
    lineup[1].coreId = coreId;
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

  // 守卫哲学不变：守"墙还在+钥匙开得了门"，精确点位=tools/s7-wall-climb.mjs / dev 探针的职责；
  // 带=点估±采样方差余量（n=32 时 95% 波动约 ±8-16pp·§16e 同族种子教训）。
  it('墙⑧无核硬堆态（普D43 真实态·无毕业核）：单把 ≤10%（墙是真墙·入场券生死线）', async () => {
    const w = await winRate('n400', D43, 'core08', 32); // 小太阳=非毕业核对照（实测 0-3%）
    expect(w).toBeLessThanOrEqual(10);
  }, 90000);

  it('墙⑧有核态（普D43 真实态+超新星）：单把 ≥15%（能过线 20−采样余量·毕业核当日可破）', async () => {
    // 口径三标：D43 真实混配态（3 SS 顶+2 S 舰）=21.9%>能过线 20 ✓"当日可过"；段5 probe 的 65%
    // =genLineup 反解全 SS 顶配口径（近似态·非当日真实）——两口径都记档（§21.6），守卫守真实态下限。
    // 无核对照（上条 0-3%）→有核 21.9%=毕业核入场券差距的机器铁证。
    const w = await winRate('n400', D43, 'core15', 32);
    expect(w).toBeGreaterThanOrEqual(15);
  }, 90000);

  it('首墙 n104（普D5 到达态）：单把 ≥50%（普通档到达晚=迟到者奖励·肝档才是矩阵锚）', async () => {
    const w = await winRate('n104', D5, 'core08', 32); // wall-climb 实测 75%
    expect(w).toBeGreaterThanOrEqual(50);
  }, 90000);
});
