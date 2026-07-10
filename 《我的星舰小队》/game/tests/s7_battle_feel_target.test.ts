// ⑥第一段收尾双实证（任务单⑥·任务5/6）：手感靶 25s±5 + 同战力三搭配"差几倍" + 星核强度表。
// 本文件=手感靶的机器守卫（进 gate）：数值漂出带即红。数据表输出 [feel]/[gap]/[core] 行，整理进细表 §18。
//
// 口径（细表 §9/§17）：
// - 中位阵容（成文定义）＝C阶 Lv0 五定位型各一：磐石(独占前列吃火)+极焰+烈阳+晨曦+迷雾，无插件无核。
// - 标准靶＝按 §9 管线系数手搓的参照敌配：P=500 → 敌血池 k_hp×P、敌合计原始 DPS k_dps×P（8 只均分·防20）。
// - 碾压双点＝纯升级路：Lv11(战力×1.80·band v2 强度积 2.86) / Lv20(战力×2.52·强度积 3.93)。
// - 三阵容同战力＝同为 C·Lv0 五舰（战力公式不含"选了哪艘"）→ 战力全等 500。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES, S7GrowthBandParam } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattlePlayerUnitInput } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';
import { unitPowerAtLevel } from '../assets/scripts/core/s7/S7UnitGrowth';

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
const clone = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
function addRowFrom(b: Bundle, table: S7ConfigTableName, srcRowId: string, newRowId: string, overrides: Row): Row {
  const src = row(b, table, srcRowId);
  const cloned = { ...JSON.parse(JSON.stringify(src)) as Row, rowId: newRowId, ...overrides };
  (b[table] as Row[]).push(cloned);
  return cloned;
}

// ===== 实证常量（校准终值·细表 §9/§18 同步）=====
/** 管线系数 v1（实证回标解·§9 初值 k_hp=10/k_dps=0.34 的实测修正见 §18 数据表）。 */
const K_HP = 10;
const K_DPS = 0.34;
const STD_PRESSURE = 500; // 标准靶压力 = 中位队战力（C·Lv0 五舰 = 5×100）
const SEEDS = ['fa', 'fb', 'fc', 'fd', 'fe'] as const;

/** 参照敌配：n 只均分 pool 血 / 合计原始 DPS 均分（interval 1.1s·防 armor）。铺敌方前两列。 */
function mkRefTarget(b: Bundle, opts: { pool: number; dps: number; n?: number; armor?: number; rowIdSuffix?: string }): void {
  const n = opts.n ?? 8;
  const armor = opts.armor ?? 20;
  const hp = Math.max(1, Math.round(opts.pool / n));
  const atk = Math.max(1, Math.round((opts.dps * 1.1) / n));
  addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_ref_dummy', {
    maxHp: hp, attack: atk, armor, attackIntervalSec: 1.1, attackRangeCells: 99,
    targetingTag: 'nearest_random_tie',
  });
  const slots = ['r0c0', 'r1c0', 'r2c0', 'r3c0', 'r4c0', 'r0c1', 'r1c1', 'r2c1', 'r3c1', 'r4c1', 'r0c2', 'r1c2', 'r2c2', 'r3c2', 'r4c2', 'r0c3'].slice(0, n);
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: ['spawn_n001_w1'],
    enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_ref_dummy'],
    timeLimitSec: 120,
  });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
    unitStatRef: 'bu_ref_dummy', count: n, slotRefs: slots, spawnDelaySec: 0, maxConcurrentOnField: 21,
  });
}

/** 升级成长积木（真实链路同款：band v2 ratio 同乘血攻）。 */
let BANDS: S7GrowthBandParam[] | null = null;
function lvBlocks(level: number): S7EffectBlock[] {
  if (!BANDS) {
    BANDS = JSON.parse(readFileSync(path.join(S7_DIR, 'growth_band_param.sample.json'), 'utf-8')) as S7GrowthBandParam[];
  }
  const base = unitPowerAtLevel(BANDS, 'ship', 1);
  const cur = unitPowerAtLevel(BANDS, 'ship', level);
  if (cur <= base) return [];
  const pct = cur / base - 1;
  return [
    { kind: 'modifier', stat: 'maxHp', op: 'pct', value: pct, source: 'feel_growth' },
    { kind: 'modifier', stat: 'attack', op: 'pct', value: pct, source: 'feel_growth' },
  ];
}
/** 基础暴击基线注入（常量表 C3/C4·装配侧）。 */
const CRIT_BASE: S7EffectBlock[] = [
  { kind: 'affix', affix: 'critRate', value: 0.05, source: 'crit_base' },
  { kind: 'affix', affix: 'critDmg', value: 0.5, source: 'crit_base' },
];

type LineupSpec = Array<{ ref: string; slot: string; extra?: S7EffectBlock[] }>;
/** 中位阵容（成文·细表 §17）：磐石独占前列 col2 吃火，输出居 col1，支援 col0。 */
const MEDIAN: LineupSpec = [
  { ref: 'bu_ship_static_disruptor', slot: 'p1c2' }, // 磐石（坦）
  { ref: 'bu_ship_vanguard', slot: 'p0c1' },         // 极焰（突击）
  { ref: 'bu_ship_longwave_suppressor', slot: 'p1c1' }, // 烈阳（炮击）
  { ref: 'bu_ship_shp17', slot: 'p2c1' },            // 迷雾（工程·第一拍纯伤）
  { ref: 'bu_ship_shp13', slot: 'p1c0' },            // 晨曦（支援·盾）
];

function toLineup(spec: LineupSpec, level = 1): S7AutoBattlePlayerUnitInput[] {
  return spec.map((s) => ({
    unitStatRef: s.ref,
    slotRef: s.slot,
    effectBlocks: [...CRIT_BASE, ...lvBlocks(level), ...(s.extra ?? [])],
  }));
}

/** 跑多种子取平均时长与胜率。 */
function runBout(b: Bundle, rt: S7ConfigRuntime, lineup: S7AutoBattlePlayerUnitInput[]): { winRate: number; avgDur: number } {
  const engine = new S7AutoBattleEngine(rt);
  let wins = 0;
  let dur = 0;
  for (const seed of SEEDS) {
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: seed, playerUnits: lineup });
    if (r.winner === 'player') wins += 1;
    dur += r.durationSec;
  }
  return { winRate: wins / SEEDS.length, avgDur: dur / SEEDS.length };
}
async function rtOf(b: Bundle): Promise<S7ConfigRuntime> {
  return S7ConfigRuntime.load(createInMemoryS7TableReader(b));
}
const log = (line: string): void => {
  // eslint-disable-next-line no-console
  console.log(line);
};

describe('⑥实证A · 手感靶（GDD §4 总锚·机器守卫）', () => {
  async function feel(mult: { pool: number; dps: number }, level: number): Promise<{ winRate: number; avgDur: number }> {
    const b = clone(loadBundle());
    mkRefTarget(b, { pool: K_HP * STD_PRESSURE * mult.pool, dps: K_DPS * STD_PRESSURE * mult.dps });
    return runBout(b, await rtOf(b), toLineup(MEDIAN, level));
  }

  it('常规关（W=P）≈25s±5·必胜', async () => {
    const r = await feel({ pool: 1, dps: 1 }, 1);
    log(`[feel] 常规 W=P：win=${r.winRate} dur=${r.avgDur.toFixed(1)}s（靶 20-30）`);
    expect(r.winRate).toBe(1);
    expect(r.avgDur).toBeGreaterThanOrEqual(20);
    expect(r.avgDur).toBeLessThanOrEqual(30);
  });

  it('精英（池×1.4·火×1.15）≈35s 带·必胜', async () => {
    const r = await feel({ pool: 1.4, dps: 1.15 }, 1);
    log(`[feel] 精英：win=${r.winRate} dur=${r.avgDur.toFixed(1)}s（靶 28-42）`);
    expect(r.winRate).toBe(1);
    expect(r.avgDur).toBeGreaterThanOrEqual(28);
    expect(r.avgDur).toBeLessThanOrEqual(42);
  });

  it('Boss 量纲（池×2.2·火×1.3）45-60s 带·常胜', async () => {
    const r = await feel({ pool: 2.2, dps: 1.3 }, 1);
    log(`[feel] Boss：win=${r.winRate} dur=${r.avgDur.toFixed(1)}s（靶 40-65）`);
    expect(r.winRate).toBeGreaterThanOrEqual(0.8);
    expect(r.avgDur).toBeGreaterThanOrEqual(40);
    expect(r.avgDur).toBeLessThanOrEqual(65);
  });

  it('碾压门槛（Lv11=战力×1.80）时长明显缩短', async () => {
    const r = await feel({ pool: 1, dps: 1 }, 11);
    log(`[feel] 碾压门槛 1.8×：win=${r.winRate} dur=${r.avgDur.toFixed(1)}s（靶 ≤18）`);
    expect(r.winRate).toBe(1);
    expect(r.avgDur).toBeLessThanOrEqual(18);
  });

  it('碾压代表（Lv20=战力×2.52）≈10s 带', async () => {
    const r = await feel({ pool: 1, dps: 1 }, 20);
    log(`[feel] 碾压代表 2.5×：win=${r.winRate} dur=${r.avgDur.toFixed(1)}s（靶 6-14）`);
    expect(r.winRate).toBe(1);
    expect(r.avgDur).toBeGreaterThanOrEqual(6);
    expect(r.avgDur).toBeLessThanOrEqual(14);
  });
});

describe('⑥实证B · 同战力三搭配"差几倍"（总纲1 验收核心）', () => {
  // 三阵容战力全等（C·Lv0 五舰=500）：
  /** 克制向（对标准靶=小怪海题）：AoE 双炮击+群蜂十字普攻+高频突击——工具对题。 */
  const COUNTER: LineupSpec = [
    { ref: 'bu_ship_static_disruptor', slot: 'p1c2' },   // 磐石
    { ref: 'bu_ship_flashrail_reaper', slot: 'p0c1' },   // 群蜂（cross_area 普攻）
    { ref: 'bu_ship_longwave_suppressor', slot: 'p1c1' }, // 烈阳（十字轰击）
    { ref: 'bu_ship_oldport_flex', slot: 'p2c1' },       // 霹雳（4 目标连锁）
    { ref: 'bu_ship_shp13', slot: 'p1c0' },              // 晨曦
  ];
  /** 乱搭（合法但错配）：三坦双奶——零主输出。 */
  const MISFIT: LineupSpec = [
    { ref: 'bu_ship_static_disruptor', slot: 'p0c2' }, // 磐石
    { ref: 'bu_ship_oasis_repair', slot: 'p1c2' },     // 铁壁
    { ref: 'bu_ship_star_ring_charger', slot: 'p2c2' }, // 堡垒
    { ref: 'bu_ship_shp13', slot: 'p1c1' },            // 晨曦
    { ref: 'bu_ship_shp15', slot: 'p1c0' },            // 甘霖
  ];

  /** 效能=能在 120s 内通关的最高靶强度档（对 P=500 标准靶按倍率升档）。 */
  async function capacity(spec: LineupSpec): Promise<number> {
    const MULTS = [0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0];
    let best = 0;
    for (const m of MULTS) {
      const b = clone(loadBundle());
      mkRefTarget(b, { pool: K_HP * STD_PRESSURE * m, dps: K_DPS * STD_PRESSURE * m });
      const r = runBout(b, await rtOf(b), toLineup(spec, 1));
      if (r.winRate >= 0.8) best = m;
      else break;
    }
    return best;
  }

  it('克制向/中位/乱搭 效能差落 2-4 倍带（同战力 500）', async () => {
    const cCounter = await capacity(COUNTER);
    const cMedian = await capacity(MEDIAN);
    const cMisfit = await capacity(MISFIT);
    const gap = cCounter / Math.max(cMisfit, 0.25);
    log(`[gap] 可通关强度档：克制向=${cCounter}× 中位=${cMedian}× 乱搭=${cMisfit}×（克制/乱搭=${gap.toFixed(1)}倍·靶 2-4）`);
    expect(cCounter).toBeGreaterThanOrEqual(cMedian); // 工具对题 ≥ 中位
    expect(cMedian).toBeGreaterThan(cMisfit);         // 中位 > 错配
    expect(gap).toBeGreaterThanOrEqual(2);            // 总纲1："实战威力可差几倍"
    expect(gap).toBeLessThanOrEqual(4.5);             // 带上沿（±轻余量·总纲1 带 2-4）
  });
});

describe('⑥实证C · 星核强度表（新分档口径·毕业核高一档+常规核逆袭）', () => {
  /** 可测核积木（已接线 9 颗·各配最优载体思路；其余 7 颗待 M4+/接线批补测·细表 §18 注记）。 */
  const CORES: Record<string, { blocks: S7EffectBlock[]; carrier?: string }> = {
    陨星弹: {
      blocks: [
        { kind: 'action', slot: 'normal', effectRef: 'eff_atomic_cannon', source: 'core_meteor' },
        { kind: 'modifier', stat: 'attackIntervalSec', op: 'set', value: 10, source: 'core_meteor' },
      ],
    },
    超新星: { // 毕业核：恒速攒 20s → 全屏 ×4.0
      blocks: [{ kind: 'trigger', on: 'cd', cdSec: 14, initialCdSec: 14, effectRef: 'eff_s7_supernova', source: 'core_nova' }], // ⑥实证校准：20s→14s（细表§15 同步）
    },
    守护铃: { // 开场全队免控 8s（对无控标准靶=对照组≈零收益·记档）
      blocks: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_s7_guardianbell', source: 'core_bell' }],
    },
    星鲸: {
      blocks: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_ref_whale_summon', source: 'core_whale' }],
    },
    银河烟花: { // 击杀连锁补普攻（≈无上限近似）
      blocks: [{ kind: 'trigger', on: 'on_kill', effectRef: 'eff_basic_attack', source: 'core_firework' }],
    },
    小太阳: { // ≈CD16s 的 3×3 大伤（灼烧折进爆伤·完整版待 M2 区域态）
      blocks: [{ kind: 'trigger', on: 'cd', cdSec: 16, initialCdSec: 3, effectRef: 'eff_ref_sun_burst', source: 'core_sun' }],
    },
    时光糖: { // M1：血量首破 70% → 攻速+40%+技能急速 30%·10s
      blocks: [{ kind: 'trigger', on: 'hp_below', threshold: 0.7, effectRef: 'eff_ref_timecandy', source: 'core_candy' }],
    },
    贪吃星: { // M3：击杀永久 +3% 攻（本场不清）
      blocks: [{ kind: 'stack', rule: { ruleId: 'core_glutton', on: 'kill', stat: 'atkPct', perStack: 0.03 }, source: 'core_glutton' }],
    },
    超级护罩: { // 本舰盾破 → 全队盾（攻×5·每场1）——载体=磐石（吃火者=盾被打破的单位·shield_broken 事件挂被破盾方）
      blocks: [{ kind: 'trigger', on: 'shield_broken', once: true, effectRef: 'eff_ref_supershield', source: 'core_shield' }],
      carrier: 'bu_ship_static_disruptor',
    },
  };

  function coreFixtures(b: Bundle): void {
    addRowFrom(b, 'battle_effect_param', 'eff_ult_clear_barrage', 'eff_ref_sun_burst', {
      effectKind: 'core', effectType: 'burst_nuke', effectPower: 3.6, targetingTag: 'block_area', maxTargets: 9, durationSec: 0, stateTag: 'none', summonUnitRef: 'none',
    });
    addRowFrom(b, 'battle_effect_param', 'eff_state_summon', 'eff_ref_whale_summon', {
      effectKind: 'core', effectType: 'summon', effectPower: 0, targetingTag: 'self_team', maxTargets: 1, durationSec: 20,
      stateTag: 'summon', summonUnitRef: 'bu_s7_whale', summonExpireSec: 20, despawnWithSource: true, summonSourceCap: 1,
    });
    // 批③段三重锚：模板盾行带 shieldMaxHpPct（盾题咬合）·apply_state 行继承会被校验器拦——显式抹除。
    addRowFrom(b, 'battle_effect_param', 'eff_state_shield', 'eff_ref_timecandy', {
      effectKind: 'core', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_team', maxTargets: 1, durationSec: 10,
      stateTag: 'atk_speed_up', stateAmount: 0.4, summonUnitRef: 'none', shieldMaxHpPct: undefined,
    });
    addRowFrom(b, 'battle_effect_param', 'eff_ult_shield_bubble', 'eff_ref_supershield', {
      effectKind: 'core', effectType: 'shield_bubble', effectPower: 5, targetingTag: 'self_team', maxTargets: 5, durationSec: 8, stateTag: 'shield', summonUnitRef: 'none',
    });
  }

  async function coreDur(coreName: string | null, boss = false): Promise<number> {
    const b = clone(loadBundle());
    coreFixtures(b);
    // boss=毕业核档差的判定场景（45-60s·攒能型核爆 3-4 次=其设计主场；常规 24s 靶对周期核天然吃亏·§18 记档）
    const m = boss ? { pool: 2.2, dps: 1.3 } : { pool: 1, dps: 1 };
    mkRefTarget(b, { pool: K_HP * STD_PRESSURE * m.pool, dps: K_DPS * STD_PRESSURE * m.dps });
    const spec = MEDIAN.map((s) => ({ ...s }));
    if (coreName) {
      const core = CORES[coreName];
      const carrierRef = core.carrier ?? 'bu_ship_vanguard'; // 缺省载体=极焰
      const target = spec.find((s) => s.ref === carrierRef) ?? spec[1];
      target.extra = [...(target.extra ?? []), ...core.blocks];
    }
    const r = runBout(b, await rtOf(b), toLineup(spec, 1));
    return r.avgDur;
  }

  it('9 颗可测核强度表（常规+Boss 双场景·总控提名单数据底稿）+ 毕业核高一档（Boss 场景钉）', async () => {
    const rows: Array<[string, number, number]> = [];
    const base = await coreDur(null);
    for (const name of Object.keys(CORES)) {
      const d = await coreDur(name);
      rows.push([name, d, (base - d) / base]);
    }
    rows.sort((a, b2) => b2[2] - a[2]);
    log(`[core] 常规靶（${base.toFixed(1)}s 基线）：`);
    for (const [name, d, gain] of rows) log(`[core]   ${name}: ${d.toFixed(1)}s（提速 ${(gain * 100).toFixed(0)}%）`);
    // 毕业核档差判定场景=Boss 靶（攒能核设计主场·真源"每隔一阵全屏大爆炸"的分量在长战斗）
    const bossBase = await coreDur(null, true);
    const bossRows: Array<[string, number, number]> = [];
    for (const name of Object.keys(CORES)) {
      const d = await coreDur(name, true);
      bossRows.push([name, d, (bossBase - d) / bossBase]);
    }
    bossRows.sort((a, b2) => b2[2] - a[2]);
    log(`[core] Boss 靶（${bossBase.toFixed(1)}s 基线）：`);
    for (const [name, d, gain] of bossRows) log(`[core]   ${name}: ${d.toFixed(1)}s（提速 ${(gain * 100).toFixed(0)}%）`);
    const novaGain = bossRows.find((r) => r[0] === '超新星')![2];
    const bestRegular = Math.max(...bossRows.filter((r) => r[0] !== '超新星').map((r) => r[2]));
    log(`[core] 毕业核档差（Boss 场景）：超新星 ${(novaGain * 100).toFixed(0)}% vs 常规最强 ${(bestRegular * 100).toFixed(0)}%`);
    // 毕业核"明显高一档"（星核真源头注·⑥校准钉死）：Boss 场景提速 ≥ 常规最强 ×1.3
    expect(novaGain).toBeGreaterThanOrEqual(bestRegular * 1.3);
  });

  it('常规核逆袭（总纲策略）：战力 500+对题常规核 险胜的靶，战力 580 无核乱搭打不过', async () => {
    // 靶强度=中位队上限之上一档（1.5×）：中位+陨星弹（对题：铺场小怪海=半场 AoE）应赢；
    // 乱搭三坦双奶哪怕升到 Lv3（战力 580）也打不动——"搭配得当可逆袭"实证。
    const mk = async (spec: LineupSpec, level: number, core: string | null): Promise<number> => {
      const b = clone(loadBundle());
      coreFixtures(b);
      mkRefTarget(b, { pool: K_HP * STD_PRESSURE * 1.5, dps: K_DPS * STD_PRESSURE * 1.5 });
      const s2 = spec.map((s) => ({ ...s }));
      if (core) {
        const target = s2.find((s) => s.ref === (CORES[core].carrier ?? 'bu_ship_vanguard')) ?? s2[1];
        target.extra = [...(target.extra ?? []), ...CORES[core].blocks];
      }
      const r = runBout(b, await rtOf(b), toLineup(s2, level));
      return r.winRate;
    };
    const MISFIT: LineupSpec = [
      { ref: 'bu_ship_static_disruptor', slot: 'p0c2' },
      { ref: 'bu_ship_oasis_repair', slot: 'p1c2' },
      { ref: 'bu_ship_star_ring_charger', slot: 'p2c2' },
      { ref: 'bu_ship_shp13', slot: 'p1c1' },
      { ref: 'bu_ship_shp15', slot: 'p1c0' },
    ];
    const underdog = await mk(MEDIAN, 1, '陨星弹');   // 战力 500+对题核
    const bigMisfit = await mk(MISFIT, 3, null);       // 战力 ≈580 无核错配
    log(`[core] 逆袭用例（1.5× 靶）：500+陨星弹 win=${underdog} vs 580 乱搭 win=${bigMisfit}`);
    expect(underdog).toBeGreaterThanOrEqual(0.8);
    expect(bigMisfit).toBeLessThanOrEqual(0.2);
  });
});
