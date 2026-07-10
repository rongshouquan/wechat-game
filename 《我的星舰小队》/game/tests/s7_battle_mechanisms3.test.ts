// 机制批③段一：四机制族（弹跳衰减/计数复释/蓄力攒层/C14 硬控递减）+ 6 深坑核（core17-22）手推期望值测试。
// 口径同⑦⑨机制批（s7_battle_mechanisms.test）：每条通路"装上生效"用手推数值断言；"缺省缺席=逐字节不变"由
// 全量既有测试(gate)兜底。基线量纲：攻击手 攻100/防25/间隔1s ↔ 靶 防25 → 普攻 = 100×100/125 = 80。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import {
  S7AutoBattleLogEntry,
  S7AutoBattlePlayerUnitInput,
  S7AutoBattleResult,
  S7AutoBattleRunRequest,
} from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';
import { coreBlocks } from '../assets/scripts/core/s7/S7CoreEffects';

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
function cloneBundle(b: Bundle): Bundle {
  return JSON.parse(JSON.stringify(b)) as Bundle;
}
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
function addRowFrom(b: Bundle, table: S7ConfigTableName, srcRowId: string, newRowId: string, overrides: Row): Row {
  const src = row(b, table, srcRowId);
  const base = JSON.parse(JSON.stringify(src)) as Row;
  // 同⑩A3 中性化口径：引擎守卫要"裸行"前提——克隆时剥接线通道（含机制批③ ultimateChargeKills），要测哪条由用例显式 override。
  delete base.extraTriggerBlocks;
  delete base.stackRules;
  delete base.alsoApplyStateRefs;
  delete base.ultimateChargeKills;
  if (String(srcRowId).startsWith('bu_ship')) {
    base.normalEffectRef = 'eff_basic_attack';
    base.ultimateEffectRef = 'none';
    base.ultimateCdSec = 0;
  }
  const clone = { ...base, rowId: newRowId, ...overrides };
  (b[table] as Row[]).push(clone);
  return clone;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}

/** 机制批③试验台（同 mechRig 口径）：玩家舰克隆 vanguard（攻100/防25/间隔1s/血100000/裸行），敌克隆 swarm（攻1/防25/血100000）。 */
function rig3(opts: {
  players: Array<{ rowId: string; overrides?: Row }>;
  enemies: Array<{ rowId: string; slot: string; overrides?: Row; delaySec?: number }>;
  effects?: Array<{ rowId: string; overrides: Row }>;
  timeLimitSec?: number;
}): Bundle {
  const b = cloneBundle(loadBundle());
  for (const p of opts.players) {
    addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', p.rowId, {
      maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
      targetingTag: 'nearest_random_tie',
      ...(p.overrides ?? {}),
    });
  }
  const spawnRefs: string[] = [];
  const enemyRefs = new Set<string>(['bu_enemy_swarm']);
  opts.enemies.forEach((e, i) => {
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', e.rowId, {
      maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
      targetingTag: 'nearest_random_tie',
      ...(e.overrides ?? {}),
    });
    enemyRefs.add(e.rowId);
    if (i === 0) {
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
        unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: e.delaySec ?? 0,
      });
      spawnRefs.push('spawn_n001_w1');
    } else {
      addRowFrom(b, 'battle_spawn_param', 'spawn_n001_w2', `spawn_m3_${i}`, {
        unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: e.delaySec ?? 0,
      });
      spawnRefs.push(`spawn_m3_${i}`);
    }
  });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: spawnRefs,
    enemyUnitStatRefs: [...enemyRefs],
    timeLimitSec: opts.timeLimitSec ?? 6,
  });
  for (const e of opts.effects ?? []) {
    addRowFrom(b, 'battle_effect_param', 'eff_basic_attack', e.rowId, e.overrides);
  }
  return b;
}

const unitInput = (unitStatRef: string, slotRef: string, blocks?: S7EffectBlock[]): S7AutoBattlePlayerUnitInput =>
  ({ unitStatRef, slotRef, ...(blocks ? { effectBlocks: blocks } : {}) });

async function runRig(b: Bundle, players: S7AutoBattlePlayerUnitInput[], extra?: Partial<S7AutoBattleRunRequest>): Promise<S7AutoBattleResult> {
  return (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'm3', playerUnits: players, ...(extra ?? {}) });
}
const dmgOf = (r: S7AutoBattleResult, effectRef: string, actorId = 'player_p1c2'): S7AutoBattleLogEntry[] =>
  r.log.filter((e) => e.type === 'damage' && e.effectRef === effectRef && e.actorId === actorId);

// ============ 弹跳衰减族 ============

describe('机制批③-弹跳衰减 · bounceTargets/bounceDecayPct（彩虹棱镜/霹雳真弹跳）', () => {
  it('棱镜档：3 目标每跳 −25pp → 80/60/40，链序=最近未命中', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_bouncer' }],
      enemies: [
        { rowId: 'bu_m3_e0', slot: 'r0c0' },
        { rowId: 'bu_m3_e1', slot: 'r0c1' },
        { rowId: 'bu_m3_e2', slot: 'r0c2' },
      ],
      effects: [{ rowId: 'eff_m3_bounce', overrides: { bounceTargets: 3, bounceDecayPct: 0.25, maxTargets: 1 } }],
      timeLimitSec: 1,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_bouncer'), { normalEffectRef: 'eff_m3_bounce' });
    const r = await runRig(b, [unitInput('bu_m3_bouncer', 'p1c2')]);
    const hits = dmgOf(r, 'eff_m3_bounce');
    // 主目标=最近 r0c0(80)；跳1=曼哈顿最近未命中 r0c1(×0.75=60)；跳2=r0c2(×0.5=40)。
    expect(hits.map((h) => h.amount)).toEqual([80, 60, 40]);
    expect(hits.map((h) => (h.targetIds ?? [])[0])).toEqual(['enemy_0000', 'enemy_0001', 'enemy_0002']);
  });

  it('霹雳档：4 目标无衰减·目标不足即断链 → 两敌只打 80/80', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_bouncer' }],
      enemies: [
        { rowId: 'bu_m3_e0', slot: 'r0c0' },
        { rowId: 'bu_m3_e1', slot: 'r1c0' },
      ],
      effects: [{ rowId: 'eff_m3_bounce4', overrides: { bounceTargets: 4, maxTargets: 1 } }],
      timeLimitSec: 1,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_bouncer'), { normalEffectRef: 'eff_m3_bounce4' });
    const r = await runRig(b, [unitInput('bu_m3_bouncer', 'p1c2')]);
    const hits = dmgOf(r, 'eff_m3_bounce4');
    expect(hits.map((h) => h.amount)).toEqual([80, 80]); // 无衰减·断链于无新目标
    expect(new Set(hits.flatMap((h) => h.targetIds ?? [])).size).toBe(2); // 同链不重复目标
  });
});

// ============ 计数复释族 ============

describe('机制批③-计数复释 · splitEveryN/splitTargets（影刃「残影」）', () => {
  it('每 2 次出手后第 3 发分裂 2 目标：unit_attack 目标数序列 [1,1,2,1]', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_split' }],
      enemies: [
        { rowId: 'bu_m3_e0', slot: 'r0c0' },
        { rowId: 'bu_m3_e1', slot: 'r1c0' },
      ],
      effects: [{ rowId: 'eff_m3_split', overrides: { splitEveryN: 2, splitTargets: 2, maxTargets: 1 } }],
      timeLimitSec: 3.2, // 攻击落在 t0/1/2/3 → 4 次出手
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_split'), { normalEffectRef: 'eff_m3_split' });
    const r = await runRig(b, [unitInput('bu_m3_split', 'p1c2')]);
    const atks = r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(atks.map((a) => (a.targetIds ?? []).length)).toEqual([1, 1, 2, 1]);
    // 分裂发两个目标各吃全额 80（非平分）。
    const t2hits = dmgOf(r, 'eff_m3_split').filter((d) => Math.abs((d.timeSec ?? 0) - 2) < 1e-9);
    expect(t2hits.map((h) => h.amount)).toEqual([80, 80]);
  });
});

// ============ 蓄力攒层族 ============

describe('机制批③-蓄力攒层 · ultimateChargeKills（群蜂「饱和打击」模型）', () => {
  it('击杀攒 3 层满放（无开局放·杀 3 后下一 tick 全体开火·大招击杀也计层）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_charger' }],
      enemies: Array.from({ length: 7 }, (_, i) => ({ rowId: `bu_m3_ce${i}`, slot: `r${i % 5}c${Math.floor(i / 5)}`, overrides: { maxHp: 10 } })),
      effects: [{
        rowId: 'eff_m3_charge_nuke',
        overrides: { effectKind: 'ultimate', effectType: 'clear_barrage', effectPower: 1.0, targetingTag: 'all_enemies', maxTargets: 16 },
      }],
      timeLimitSec: 6,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_charger'), {
      ultimateEffectRef: 'eff_m3_charge_nuke', ultimateCdSec: 0, ultimateChargeKills: 3,
    });
    const r = await runRig(b, [unitInput('bu_m3_charger', 'p1c2')]);
    const casts = r.log.filter((e) => e.type === 'ultimate_cast' && e.effectRef === 'eff_m3_charge_nuke');
    // 普攻 t0/1/2 各杀 1（80≥10 血）→ 第 3 杀发生在 t2 普攻步 → 满层在 t2.2 触发步开火；蓄力模型无 CD 开局放。
    expect(casts).toHaveLength(1);
    expect(casts[0].timeSec).toBeCloseTo(2.2, 9);
    // 全体开火把剩余 4 敌全收（各 80）→ 玩家清场胜。
    expect(dmgOf(r, 'eff_m3_charge_nuke')).toHaveLength(4);
    expect(r.winner).toBe('player');
    expect(r.reason).toBe('all_enemies_down');
  });
});

// ============ C14 硬控递减 ============

describe('机制批③-C14 硬控递减 · request.hardControlDiminish（同源×0.6^n·30s 窗口）', () => {
  const c14Rig = () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_victim' }],
      enemies: [{
        rowId: 'bu_m3_controller', slot: 'r0c0',
        overrides: {
          extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 2, effectRef: 'eff_m3_sc' }],
        },
      }],
      effects: [{
        rowId: 'eff_m3_sc',
        overrides: { effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'single_target', durationSec: 1.5, maxTargets: 1, stateTag: 'short_circuit' },
      }],
      timeLimitSec: 6,
    });
    return b;
  };
  const scExpires = (r: S7AutoBattleResult) => r.log
    .filter((e) => e.type === 'state_expire' && e.actorId === 'player_p1c2' && e.stateTag === 'short_circuit')
    .map((e) => e.timeSec);

  it('旋钮开：同源重复施加 1.5s→0.9s→0.54s（到期 tick 1.6/3.0/4.6）', async () => {
    const r = await runRig(c14Rig(), [unitInput('bu_m3_victim', 'p1c2')], {
      hardControlDiminish: { factor: 0.6, windowSec: 30 },
    });
    expect(scExpires(r)).toEqual([1.6, 3.0, 4.6]);
  });

  it('旋钮缺省：不递减（到期 tick 1.6/3.6/5.6=既有行为）', async () => {
    const r = await runRig(c14Rig(), [unitInput('bu_m3_victim', 'p1c2')]);
    expect(scExpires(r)).toEqual([1.6, 3.6, 5.6]);
  });
});

// ============ 深坑核 · 曲率星门 core17 ============

describe('机制批③-曲率星门 core17 · rank_swap（开局整排对调·1×1 限定·全场一次）', () => {
  it('最前列 c0 与最后列 c4 逐行互换（空端=移入空格）·中间列不动', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_gate' }],
      enemies: [
        { rowId: 'bu_m3_e0', slot: 'r0c0' },
        { rowId: 'bu_m3_e1', slot: 'r1c0' },
        { rowId: 'bu_m3_e2', slot: 'r2c2' },
        { rowId: 'bu_m3_e3', slot: 'r0c4' },
      ],
      timeLimitSec: 1,
    });
    const r = await runRig(b, [unitInput('bu_m3_gate', 'p1c2', [...coreBlocks('core17')])]);
    const swap = r.log.find((e) => e.type === 'rank_swap');
    expect(swap?.note).toBe('c0<->c4');
    expect((swap?.targetIds ?? []).length).toBe(3); // e0/e1/e3 被移动·e2 中列不动
    const slotOf = (id: string) => r.finalState.enemies.find((u) => u.unitId === id)?.slotRef;
    expect(slotOf('enemy_0000')).toBe('r0c4'); // 前排 → 最后排
    expect(slotOf('enemy_0001')).toBe('r1c4'); // 对面空格=直接移入
    expect(slotOf('enemy_0003')).toBe('r0c0'); // 后排 → 最前排
    expect(slotOf('enemy_0002')).toBe('r2c2'); // 中间列原地
  });

  it('多格 Boss 覆盖端格的行跳过（真源：Boss 不参与）·多颗星门只结算一次', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_gate' }, { rowId: 'bu_m3_gate2' }],
      enemies: [
        { rowId: 'bu_m3_boss', slot: 'r0c0', overrides: { sizeRows: 2, sizeCols: 2 } }, // 2×2 覆盖 r0-1×c0-1
        { rowId: 'bu_m3_e1', slot: 'r2c0' },
        { rowId: 'bu_m3_e2', slot: 'r0c4' },
        { rowId: 'bu_m3_e3', slot: 'r2c4' },
      ],
      timeLimitSec: 1,
    });
    const r = await runRig(b, [
      unitInput('bu_m3_gate', 'p1c2', [...coreBlocks('core17')]),
      unitInput('bu_m3_gate2', 'p0c2', [...coreBlocks('core17')]),
    ]);
    const swaps = r.log.filter((e) => e.type === 'rank_swap');
    expect(swaps).toHaveLength(2);
    expect(swaps[0].note).toBe('c0<->c4');
    expect(swaps[1].note).toBe('already_swapped'); // 第二颗空转=对调两次会复原（幂等口径 §16d）
    const slotOf = (id: string) => r.finalState.enemies.find((u) => u.unitId === id)?.slotRef;
    expect(slotOf('enemy_0000')).toBe('r0c0'); // Boss 原地（2×2 不参与）
    expect(slotOf('enemy_0002')).toBe('r0c4'); // 行 0 端格被 Boss 覆盖 → 整行跳过
    expect(slotOf('enemy_0001')).toBe('r2c4'); // 行 2 正常互换
    expect(slotOf('enemy_0003')).toBe('r2c0');
  });
});

// ============ 深坑核 · 引力阱 core19 ============

describe('机制批③-引力阱 core19 · 技能命中追加当前生命×8%（上限攻×5）', () => {
  const gravityRig = (enemyHp: number) => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_grav' }],
      enemies: [{ rowId: 'bu_m3_e0', slot: 'r0c0', overrides: { maxHp: enemyHp } }],
      effects: [{ rowId: 'eff_m3_ult', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'single_target', maxTargets: 1 } }],
      timeLimitSec: 0.4, // 只看 t0：技能(触发步)+普攻(普攻步)
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_grav'), { ultimateEffectRef: 'eff_m3_ult', ultimateCdSec: 8 });
    return b;
  };

  it('技能 80 → 追伤 round((1000−80)×8%)=74·普攻无追伤', async () => {
    const r = await runRig(gravityRig(1000), [unitInput('bu_m3_grav', 'p1c2', [...coreBlocks('core19')])]);
    const ult = dmgOf(r, 'eff_m3_ult');
    expect(ult.map((h) => [h.amount, h.note])).toEqual([[80, undefined], [74, 'gravity_bonus']]);
    const normals = dmgOf(r, 'eff_basic_attack');
    expect(normals).toHaveLength(1); // t0 普攻
    expect(normals[0].note).toBeUndefined(); // 普攻不触发引力追伤
  });

  it('上限=攻×5：超肥靶追伤钳到 500（=100×5）', async () => {
    const r = await runRig(gravityRig(100000), [unitInput('bu_m3_grav', 'p1c2', [...coreBlocks('core19')])]);
    const bonus = dmgOf(r, 'eff_m3_ult').find((h) => h.note === 'gravity_bonus');
    expect(bonus?.amount).toBe(500); // round((100000−80)×0.08)=7994 → 钳 500
  });
});

// ============ 深坑核 · 共鸣音叉 core18 ============

describe('机制批③-共鸣音叉 core18 · 直接伤害分流 25% → 全场最高血敌', () => {
  it('打近敌 80 → 最肥远敌同时吃 20（note=resonance_split）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_fork' }],
      enemies: [
        { rowId: 'bu_m3_e0', slot: 'r0c0', overrides: { maxHp: 50000 } },
        { rowId: 'bu_m3_fat', slot: 'r2c4', overrides: { maxHp: 200000 } },
      ],
      timeLimitSec: 1,
    });
    const r = await runRig(b, [unitInput('bu_m3_fork', 'p1c2', [...coreBlocks('core18')])]);
    const hits = dmgOf(r, 'eff_basic_attack');
    expect(hits.map((h) => [h.amount, (h.targetIds ?? [])[0], h.note])).toEqual([
      [80, 'enemy_0000', undefined],
      [20, 'enemy_0001', 'resonance_split'], // round(80×0.25)=20 → 最高血
    ]);
  });

  it('目标本身就是最肥：同目标再吃一份（§16d 口径·单敌=每击 80+20）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_fork' }],
      enemies: [{ rowId: 'bu_m3_e0', slot: 'r0c0' }],
      timeLimitSec: 1,
    });
    const r = await runRig(b, [unitInput('bu_m3_fork', 'p1c2', [...coreBlocks('core18')])]);
    const hits = dmgOf(r, 'eff_basic_attack');
    expect(hits.map((h) => h.amount)).toEqual([80, 20]);
    expect(hits[1].targetIds).toEqual(['enemy_0000']);
  });
});

// ============ 深坑核 · 幸运扭蛋 core21 ============

describe('机制批③-幸运扭蛋 core21 · 放技能随机强化路由（战斗种子可复现）', () => {
  it('每次放技能恰好掷一次·五路由全可达·各路由效果落地', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_lucky' }],
      enemies: [{ rowId: 'bu_m3_e0', slot: 'r0c0', overrides: { maxHp: 100000000 } }],
      effects: [{ rowId: 'eff_m3_ult', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'single_target', maxTargets: 1 } }],
      timeLimitSec: 60,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_lucky'), { ultimateEffectRef: 'eff_m3_ult', ultimateCdSec: 1 });
    const r = await runRig(b, [unitInput('bu_m3_lucky', 'p1c2', [...coreBlocks('core21')])]);
    const casts = r.log.filter((e) => e.type === 'ultimate_cast' && e.effectRef === 'eff_m3_ult');
    const rolls = r.log.filter((e) => e.type === 'core_gacha');
    expect(rolls.length).toBe(casts.length); // 每放一次技能恰好掷一次
    const outcomes = new Set(rolls.map((e) => e.note));
    expect([...outcomes].every((o) => ['crit', 'area', 'echo', 'lifesteal', 'cd'].includes(String(o)))).toBe(true);
    expect(outcomes.size).toBe(5); // 60s ≥60 掷·五路由全出现（种子固定=确定性）
    // 逐路由效果核（同 tick 交叉验证）：
    for (const roll of rolls) {
      const t = roll.timeSec;
      const sameTick = (e: S7AutoBattleLogEntry) => Math.abs((e.timeSec ?? -1) - (t ?? 0)) < 1e-9;
      if (roll.note === 'crit') {
        expect(r.log.some((e) => sameTick(e) && e.type === 'state_apply' && e.stateTag === 'crit_rate_up' && e.effectRef === 'eff_core_gacha_crit')).toBe(true);
      } else if (roll.note === 'area') {
        expect(r.log.some((e) => sameTick(e) && e.type === 'state_apply' && e.stateTag === 'area_up')).toBe(true);
      } else if (roll.note === 'lifesteal') {
        expect(r.log.some((e) => sameTick(e) && e.type === 'state_apply' && e.stateTag === 'lifesteal_up')).toBe(true);
      } else if (roll.note === 'echo') {
        // 连放=本次技能立即多放一轮 → 同 tick 该技能伤害 ≥2 发。
        expect(dmgOf(r, 'eff_m3_ult').filter(sameTick).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

// ============ 深坑核 · 全息镜 core22 ============

describe('机制批③-全息镜 core22 · 召唤 60% 属性分身（限时 12s·普攻同本舰）', () => {
  it('开局召分身：三围=快照×0.6（1000/100/25→600/60/15）·分身普攻 48·12s 到期退场', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_holo', overrides: { maxHp: 1000 } }],
      enemies: [{ rowId: 'bu_m3_e0', slot: 'r0c0', overrides: { maxHp: 100000000, attack: 0 } }],
      timeLimitSec: 14,
    });
    // 敌攻 0 会被引擎伤害下限 max(1,…) 拉成 1 →给受击方超高血即可；attack:0 非法? swarm 校验不跑 fixture——直接给 1。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_m3_e0'), { attack: 1 });
    const r = await runRig(b, [unitInput('bu_m3_holo', 'p1c2', [...coreBlocks('core22')])]);
    const spawn = r.log.find((e) => e.type === 'spawn_wave' && e.side === 'player' && e.note === 'effect_summon');
    expect(spawn).toBeTruthy();
    const cloneId = (spawn?.targetIds ?? [])[0];
    const clone = r.finalState.players.find((u) => u.unitId === cloneId);
    expect(clone?.unitStatRef).toBe('bu_s7_hologram');
    expect(clone?.maxHp).toBe(600); // 1000×0.6 快照
    // 分身普攻=本舰普攻行（eff_basic_attack）·攻 60 → 60×100/125=48。
    const cloneHits = r.log.filter((e) => e.type === 'damage' && e.actorId === cloneId);
    expect(cloneHits.length).toBeGreaterThanOrEqual(10);
    expect(cloneHits.every((h) => h.amount === 48)).toBe(true);
    // 限时 12s：到期退场，之后无分身出手（CD22 第二召在限时 14s 外）。
    expect(cloneHits.every((h) => (h.timeSec ?? 0) <= 12 + 1e-9)).toBe(true);
    expect(r.log.some((e) => e.type === 'unit_down' && e.actorId === cloneId)).toBe(true);
    expect(clone?.alive).toBe(false);
  });
});

// ============ 深坑核同族 · 银河烟花 core16 多米诺升级 ============

describe('机制批③-银河烟花 core16 · 多米诺连锁（≤5 发·每发 +10%）', () => {
  it('连杀链：普攻杀 1 → 补发 80/88/96/104/112 连杀 5（链满即止）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_fire' }],
      enemies: Array.from({ length: 6 }, (_, i) => ({ rowId: `bu_m3_fe${i}`, slot: `r${i % 5}c${Math.floor(i / 5)}`, overrides: { maxHp: 10 } })),
      timeLimitSec: 2,
    });
    const r = await runRig(b, [unitInput('bu_m3_fire', 'p1c2', [...coreBlocks('core16')])]);
    const shots = dmgOf(r, 'eff_core_firework');
    expect(shots.map((h) => h.amount)).toEqual([80, 88, 96, 104, 112]); // ×1.0/1.1/1.2/1.3/1.4
    expect(r.winner).toBe('player'); // 普攻杀 1 + 链杀 5 = 清场
  });

  it('补发未击杀即断链：硬靶挡在链中 → 只打 2 发', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3_fire' }],
      enemies: [
        { rowId: 'bu_m3_fe0', slot: 'r0c0', overrides: { maxHp: 10 } },
        { rowId: 'bu_m3_fe1', slot: 'r1c0', overrides: { maxHp: 10 } },
        { rowId: 'bu_m3_hard', slot: 'r2c0', overrides: { maxHp: 100000 } },
        { rowId: 'bu_m3_fe3', slot: 'r3c0', overrides: { maxHp: 10 } },
      ],
      timeLimitSec: 0.4,
    });
    const r = await runRig(b, [unitInput('bu_m3_fire', 'p1c2', [...coreBlocks('core16')])]);
    // t0 普攻杀 fe0 → t0.2 补发1 杀 fe1(80) → 补发2 打 hard(88·未杀) → 断链。
    const shots = dmgOf(r, 'eff_core_firework');
    expect(shots.map((h) => h.amount)).toEqual([80, 88]);
  });
});
