// 任务单⑦引擎机制批①：M1 限时属性修正状态框架 + M2 周期 DoT/HoT + M3 叠层 的手推精确期望值测试。
// 口径同 ⑥8a（s7_battle_knobs.test）：每条通路"装上生效"用手推数值断言；"缺省缺席=逐字节不变"由
// 全量既有测试(gate)兜底，另设哨兵断言旧配置日志无任何机制批①新字段/新 tag/新 effectType。
// 基线量纲：攻击手 攻100/防25/间隔1s ↔ 靶 防25 → 普攻 = 100×100/125 = 80（整数便于精确断言）。
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
} from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

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
  const clone = { ...JSON.parse(JSON.stringify(src)) as Row, rowId: newRowId, ...overrides };
  (b[table] as Row[]).push(clone);
  return clone;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}

/**
 * 机制批试验台：N 个玩家舰（克隆 vanguard·默认 攻100/防25/间隔1s/血100000/射程9/无大招无核）
 * vs M 个敌人（克隆 swarm·默认 攻1/防25/间隔1s/血100000）。每个敌人一条独立出怪行；
 * effects 为按需追加的效果行（克隆 eff_basic_attack 改字段）。限时默认 6s。
 */
function mechRig(opts: {
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
  const enemyRefs = new Set<string>(['bu_enemy_swarm']); // w2 原行仍指向 enc_n001，swarm 必须保留过双向校验
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
      addRowFrom(b, 'battle_spawn_param', 'spawn_n001_w2', `spawn_mech_${i}`, {
        unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: e.delaySec ?? 0,
      });
      spawnRefs.push(`spawn_mech_${i}`);
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

/** 状态施加行速写（effectKind=state / effectType=apply_state）。 */
function stateRow(rowId: string, stateTag: string, stateAmount: number, durationSec: number, targetingTag: string, extra?: Row): { rowId: string; overrides: Row } {
  return {
    rowId,
    overrides: {
      effectKind: 'state', effectType: 'apply_state', effectPower: 0,
      targetingTag, durationSec, maxTargets: 9, stateTag, stateAmount,
      ...(extra ?? {}),
    },
  };
}
const trig = (on: string, effectRef: string, extra?: Row): S7EffectBlock =>
  ({ kind: 'trigger', on, effectRef, ...(extra ?? {}) } as unknown as S7EffectBlock);

const unitInput = (unitStatRef: string, slotRef: string, blocks?: S7EffectBlock[]): S7AutoBattlePlayerUnitInput =>
  ({ unitStatRef, slotRef, ...(blocks ? { effectBlocks: blocks } : {}) });

const dmgBy = (log: S7AutoBattleLogEntry[], actorId: string, effectRef = 'eff_basic_attack'): S7AutoBattleLogEntry[] =>
  log.filter((e) => e.type === 'damage' && e.actorId === actorId && e.effectRef === effectRef);
const stateAppliesOf = (log: S7AutoBattleLogEntry[], effectRef: string): S7AutoBattleLogEntry[] =>
  log.filter((e) => e.type === 'state_apply' && e.effectRef === effectRef);

const SEED = 'mech1';
const ENC = 'enc_n001';

// ===================== M1 · 限时属性修正状态框架 =====================

describe('⑦M1-A 八类修正状态（手推精确期望值·基线80=100×100/125）', () => {
  it('加攻 atk_up +50%·2.5s：命中 120/120/120 后到期回 80', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_atkup', 'atk_up', 0.5, 2.5, 'self_team', { maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_atkup')])],
    });
    // t=0 开局触发先于普攻步 → t=0/1/2 三击吃 buff（攻150→150×100/125=120）；expireAt=2.5 在 t=2.6 步2移除 → t=3 起回 80。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([120, 120, 120, 80, 80, 80]);
  });

  it('虚弱 atk_down −30% 挂敌方：敌打我 80→56', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [stateRow('eff_t7_weak', 'atk_down', 0.3, 10, 'nearest_random_tie')],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_weak')])],
    });
    // 敌攻 100×0.7=70 → 70×100/125=56。
    expect(dmgBy(r.log, 'enemy_0000').every((e) => e.amount === 56)).toBe(true);
    expect(dmgBy(r.log, 'enemy_0000').length).toBe(6);
  });

  it('加攻速 atk_speed_up +100%：间隔 1s→0.5s（tick 0.2s 量化后出手 0/0.6/1.2/...）6s 内 10 击', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_spdup', 'atk_speed_up', 1.0, 10, 'self_team', { maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_spdup')])],
    });
    const hits = dmgBy(r.log, 'player_p1c2');
    // nextAttackAt 每次 +0.5，但出手在首个 ≥ 它的 tick：0→0.6→1.2→…→5.4，共 10 击（基线 6 击）。
    expect(hits.length).toBe(10);
    expect(hits[1]?.timeSec).toBe(0.6);
  });

  it('减速 atk_speed_down −50% 挂敌方：敌出手时刻 0/2/4', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [stateRow('eff_t7_slow', 'atk_speed_down', 0.5, 10, 'nearest_random_tie')],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_slow')])],
    });
    // 间隔 1/(1−0.5)=2s。
    expect(dmgBy(r.log, 'enemy_0000').map((e) => e.timeSec)).toEqual([0, 2, 4]);
  });

  it('破防 armor_down −50%（防100靶）：50→67', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { armor: 100 } }],
      effects: [stateRow('eff_t7_sunder', 'armor_down', 0.5, 10, 'nearest_random_tie')],
    });
    const engine = await engineOf(b);
    const base = engine.run({ encounterRef: ENC, battleSeed: SEED, playerUnits: [unitInput('bu_t7_atk', 'p1c2')] });
    expect(dmgBy(base.log, 'player_p1c2')[0]?.amount).toBe(50); // 100×100/200
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_sunder')])],
    });
    // 防 100×(1−0.5)=50 → 100×100/150=66.67→67。
    expect(dmgBy(r.log, 'player_p1c2')[0]?.amount).toBe(67);
  });

  it('增伤 dmg_up +25%：80→100；易伤参数版 dmg_taken_up +50% 挂敌：80→120', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t7_dmgup', 'dmg_up', 0.25, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t7_vuln', 'dmg_taken_up', 0.5, 10, 'nearest_random_tie'),
      ],
    });
    const engine = await engineOf(b);
    const up = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_dmgup')])],
    });
    expect(dmgBy(up.log, 'player_p1c2')[0]?.amount).toBe(100);
    const vuln = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_vuln')])],
    });
    expect(dmgBy(vuln.log, 'player_p1c2')[0]?.amount).toBe(120);
  });

  it('减伤 dmg_taken_down −50%：敌打我 80→40', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [stateRow('eff_t7_dr', 'dmg_taken_down', 0.5, 10, 'self_team', { maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_dr')])],
    });
    expect(dmgBy(r.log, 'enemy_0000').every((e) => e.amount === 40)).toBe(true);
  });

  it('免伤 dmg_taken_down ≥100%：整发落空 amount=0+immune，不掉血、不触发受击事件', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [
        stateRow('eff_t7_invuln', 'dmg_taken_down', 1.0, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t7_onhit_mark', 'atk_up', 0.1, 1, 'self_team', { maxTargets: 1 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        trig('battle_start', 'eff_t7_invuln'),
        trig('on_hit', 'eff_t7_onhit_mark'), // 受击事件探针：免伤期间不得触发
      ])],
    });
    const hits = dmgBy(r.log, 'enemy_0000');
    expect(hits.length).toBe(6);
    expect(hits.every((e) => e.amount === 0 && e.immune === true)).toBe(true);
    const me = r.finalState.players.find((p) => p.unitId === 'player_p1c2');
    expect(me?.hp).toBe(me?.maxHp);
    expect(r.log.some((e) => e.type === 'ultimate_cast' && e.effectRef === 'eff_t7_onhit_mark')).toBe(false);
  });

  it('暴击 buff：crit_rate_up=1 配暴伤词条 / 暴击率词条配 crit_dmg_up，均 80→120', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t7_crup', 'crit_rate_up', 1.0, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t7_cdup', 'crit_dmg_up', 0.5, 10, 'self_team', { maxTargets: 1 }),
      ],
    });
    const engine = await engineOf(b);
    const a = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        { kind: 'affix', affix: 'critDmg', value: 0.5 } as S7EffectBlock,
        trig('battle_start', 'eff_t7_crup'),
      ])],
    });
    const hitsA = dmgBy(a.log, 'player_p1c2');
    expect(hitsA.every((e) => e.amount === 120 && e.crit === true)).toBe(true);
    const c = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        { kind: 'affix', affix: 'critRate', value: 1.0 } as S7EffectBlock,
        trig('battle_start', 'eff_t7_cdup'),
      ])],
    });
    const hitsC = dmgBy(c.log, 'player_p1c2');
    expect(hitsC.every((e) => e.amount === 120 && e.crit === true)).toBe(true);
  });

  it('技能急速 buff skill_haste_up +100%（时光糖缩CD口径）：CD4 技能施放时刻 0/2/4', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t7_haste', 'skill_haste_up', 1.0, 10, 'self_team', { maxTargets: 1 }),
        { rowId: 'eff_t7_nuke', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1, targetingTag: 'nearest_random_tie', durationSec: 0, maxTargets: 1, stateTag: 'none' } },
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        trig('battle_start', 'eff_t7_haste'), // 先挂 buff 再排 CD（同 tick 触发按积木顺序）
        trig('cd', 'eff_t7_nuke', { cdSec: 4 }),
      ])],
    });
    const casts = r.log.filter((e) => e.type === 'ultimate_cast' && e.effectRef === 'eff_t7_nuke');
    expect(casts.map((e) => e.timeSec)).toEqual([0, 2, 4]); // 4/(1+1)=2s
  });

  it('同名重复施加＝刷新时长+参数以最新为准（非叠加非取大）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t7_big', 'atk_up', 0.5, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t7_small', 'atk_up', 0.25, 10, 'self_team', { maxTargets: 1 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        trig('battle_start', 'eff_t7_big'),          // 先 +50%
        trig('cd', 'eff_t7_small', { cdSec: 2 }),    // 同 tick 再施 +25% → 覆盖为最新
      ])],
    });
    // 若叠加=×1.75→140；若取大=×1.5→120；最新覆盖=×1.25→100。
    expect(dmgBy(r.log, 'player_p1c2').every((e) => e.amount === 100)).toBe(true);
  });
});

describe('⑦M1-B 载体通路（号角普攻/斩链过滤/山岳不动一发多态/张盾自身区域）', () => {
  it('号角普攻通路：apply_state 作普攻 + 行级 highest_attack_ally，buff 喂给输出最高友军', async () => {
    const b = mechRig({
      players: [
        { rowId: 'bu_t7_striker' },
        { rowId: 'bu_t7_horn', overrides: { attack: 50, targetingTag: 'highest_attack_ally', normalEffectRef: 'eff_t7_hornbuff' } },
      ],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_hornbuff', 'atk_up', 0.5, 10, 'self_team', { effectKind: 'normal_attack', maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_striker', 'p0c2'), unitInput('bu_t7_horn', 'p1c2')],
    });
    // t=0 striker 先手未 buff（stableUnits 序 p0c2<p1c2）→ 80；号角 t=0 施 buff → t≥1 击 120。
    expect(dmgBy(r.log, 'player_p0c2').map((e) => e.amount)).toEqual([80, 120, 120, 120, 120, 120]);
    const buffs = stateAppliesOf(r.log, 'eff_t7_hornbuff');
    expect(buffs.every((e) => e.targetIds?.[0] === 'player_p0c2')).toBe(true); // 全部喂给 攻100>50 的 striker
  });

  it('斩链 onKillRoleTags：杀 minion 不触发、杀 healer 触发全队增伤（80→92）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [
        { rowId: 'bu_t7_mob', slot: 'r1c0', overrides: { maxHp: 80 } },                       // roleTag=minion（继承 swarm）
        { rowId: 'bu_t7_healer', slot: 'r1c1', overrides: { maxHp: 160, roleTag: 'healer' } },
        { rowId: 'bu_t7_tank', slot: 'r1c2' },
      ],
      effects: [stateRow('eff_t7_chainbuff', 'dmg_up', 0.15, 10, 'self_team', { maxTargets: 5 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [
        trig('on_kill', 'eff_t7_chainbuff', { onKillRoleTags: ['healer', 'summoner'] }),
      ])],
    });
    // t=0 杀 minion（80 血一发）→ 过滤不触发 → t=1/2 仍 80；t=2 杀 healer → t=2.2 触发 → t≥3 击 92（80×1.15）。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([80, 80, 80, 92, 92, 92]);
  });

  it('山岳「不动」一发多态：减伤−40% + 免疫硬控同发施加；到期后敌方晕眩落地', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_stunner', slot: 'r1c0', overrides: { attack: 100, normalEffectRef: 'eff_t7_stunhit' } }],
      effects: [
        { rowId: 'eff_t7_stunhit', overrides: { effectKind: 'normal_attack', effectType: 'basic_damage', effectPower: 1, targetingTag: 'nearest_random_tie', durationSec: 2, maxTargets: 1, stateTag: 'stun' } },
        stateRow('eff_t7_bulwark', 'dmg_taken_down', 0.4, 3, 'self_team', { maxTargets: 5, alsoApplyStateRefs: ['eff_t7_immu'] }),
        { rowId: 'eff_t7_immu', overrides: { effectKind: 'state', effectType: 'control_immune', effectPower: 0, targetingTag: 'self_team', durationSec: 3, maxTargets: 5, stateTag: 'control_immune' } },
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_atk', 'p1c2', [trig('battle_start', 'eff_t7_bulwark')])],
    });
    // 减伤窗内（t=0/1/2）：80×0.6=48 且晕眩被免控挡下；t=3 起 80 且晕眩落地并被每击刷新 → 我方 t≥3 不再出手。
    expect(dmgBy(r.log, 'enemy_0000', 'eff_t7_stunhit').map((e) => e.amount)).toEqual([48, 48, 48, 80, 80, 80]);
    const stunApplies = r.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'stun' && e.targetIds?.[0] === 'player_p1c2');
    expect(stunApplies.map((e) => e.timeSec)).toEqual([3, 4, 5]); // 免控期一次没挂上；到期后每击刷新
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.timeSec)).toEqual([0, 1, 2]);
    // 一发多态：两个状态在 t=0 同时施加
    expect(stateAppliesOf(r.log, 'eff_t7_bulwark')[0]?.timeSec).toBe(0);
    expect(stateAppliesOf(r.log, 'eff_t7_immu')[0]?.timeSec).toBe(0);
  });

  it('磐石「张盾」self_cross_area：罩自己+十字相邻，斜角友军不在盾内', async () => {
    const b = mechRig({
      players: [
        { rowId: 'bu_t7_wall', overrides: { normalEffectRef: 'none' } },
        { rowId: 'bu_t7_a1', overrides: { normalEffectRef: 'none' } },
        { rowId: 'bu_t7_a2', overrides: { normalEffectRef: 'none' } },
      ],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_shieldwall', 'dmg_taken_down', 0.4, 6, 'self_cross_area', { maxTargets: 9 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t7_wall', 'p1c1', [trig('battle_start', 'eff_t7_shieldwall')]),
        unitInput('bu_t7_a1', 'p0c1'), // 十字内（上邻）
        unitInput('bu_t7_a2', 'p0c0'), // 斜角——不在十字内
      ],
    });
    const covered = stateAppliesOf(r.log, 'eff_t7_shieldwall').map((e) => e.targetIds?.[0]);
    expect(covered).toEqual(['player_p1c1', 'player_p0c1']); // 施加者第一位·斜角不含
  });
});

describe('⑦M1-C 友方目标族（澈/沛/霖/沧）', () => {
  it('no_buff_ally_first（沛）：轮流铺满没增益的友军，铺满后回头刷新', async () => {
    const b = mechRig({
      players: [
        { rowId: 'bu_t7_p1', overrides: { normalEffectRef: 'none' } },
        { rowId: 'bu_t7_p2', overrides: { normalEffectRef: 'none' } },
        { rowId: 'bu_t7_spreader', overrides: { targetingTag: 'no_buff_ally_first', normalEffectRef: 'eff_t7_spread' } },
      ],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_spread', 'atk_up', 0.2, 10, 'self_team', { effectKind: 'normal_attack', maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_p1', 'p0c0'), unitInput('bu_t7_p2', 'p0c1'), unitInput('bu_t7_spreader', 'p1c2')],
    });
    const seq = stateAppliesOf(r.log, 'eff_t7_spread').map((e) => e.targetIds?.[0]);
    expect(seq.slice(0, 4)).toEqual(['player_p0c0', 'player_p0c1', 'player_p1c2', 'player_p0c0']);
  });

  it('most_debuffed_ally（霖）/ controlled_ally_first（沧）：越过 unitId 序选中被减益/被控的高位友军', async () => {
    const mk = (riderTag: string, buffTag: string, spreadTargeting: string) => mechRig({
      players: [
        { rowId: 'bu_t7_plain', overrides: { normalEffectRef: 'none' } },
        { rowId: 'bu_t7_victim', overrides: { attack: 999, normalEffectRef: 'none' } },
        { rowId: 'bu_t7_savior', overrides: { targetingTag: spreadTargeting, normalEffectRef: 'eff_t7_save' } },
      ],
      enemies: [{ rowId: 'bu_t7_sniper', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'highest_attack_enemy', normalEffectRef: 'eff_t7_rider' } }],
      effects: [
        { rowId: 'eff_t7_rider', overrides: { effectKind: 'normal_attack', effectType: 'basic_damage', effectPower: 1, targetingTag: 'nearest_random_tie', durationSec: 10, maxTargets: 1, stateTag: riderTag, ...(riderTag === 'atk_down' ? { stateAmount: 0.2 } : {}) } },
        stateRow('eff_t7_save', buffTag, 0.2, 10, 'self_team', { effectKind: 'normal_attack', maxTargets: 1 }),
      ],
    });
    // 霖：敌方专点最高攻(999·p1c1)挂虚弱 → 霖越过 p0c1(更小id) 选中减益最多的 p1c1。
    const engineA = await engineOf(mk('atk_down', 'atk_up', 'most_debuffed_ally'));
    const a = engineA.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_plain', 'p0c1'), unitInput('bu_t7_victim', 'p1c1'), unitInput('bu_t7_savior', 'p1c2')],
    });
    expect(stateAppliesOf(a.log, 'eff_t7_save')[0]?.targetIds?.[0]).toBe('player_p1c1');
    // 沧：敌方晕眩最高攻(999·p1c1) → 沧优先照顾被控友军 p1c1。
    const engineC = await engineOf(mk('stun', 'dmg_taken_down', 'controlled_ally_first'));
    const c = engineC.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_plain', 'p0c1'), unitInput('bu_t7_victim', 'p1c1'), unitInput('bu_t7_savior', 'p1c2')],
    });
    expect(stateAppliesOf(c.log, 'eff_t7_save')[0]?.targetIds?.[0]).toBe('player_p1c1');
  });
});

// ===================== M2 · 周期结算 DoT/HoT =====================

const periodicOf = (log: S7AutoBattleLogEntry[], effectType: string): S7AutoBattleLogEntry[] =>
  log.filter((e) => e.periodic === true && e.effectType === effectType);

describe('⑦M2 周期结算（燃烧/持续回血·快照量·手推期望值）', () => {
  it('燃烧固定值 10/s·3s：t=1/2/3 各跳 10 后到期；总掉血 30', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_burn', 'burn', 0, 3, 'nearest_random_tie', { stateAmount: undefined, stateTickFlat: 10 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [trig('battle_start', 'eff_t7_burn')])],
    });
    const ticks = periodicOf(r.log, 'burn');
    expect(ticks.map((e) => [e.timeSec, e.amount])).toEqual([[1, 10], [2, 10], [3, 10]]);
    expect(r.log.some((e) => e.type === 'state_expire' && e.stateTag === 'burn' && e.timeSec === 3)).toBe(true);
    expect(r.finalState.enemies[0]?.hp).toBe(100000 - 30);
  });

  it('燃烧快照口径：每秒伤=施加者基础攻×8%（⑥§11 数）·限时加攻不影响已挂燃烧', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t7_bigbuff', 'atk_up', 1.0, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t7_burn8', 'burn', 0, 4, 'nearest_random_tie', { stateAmount: undefined, stateTickAtkPct: 0.08 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [
        trig('battle_start', 'eff_t7_bigbuff'), // 先把加攻挂上（若快照走生效攻会翻倍→16）
        trig('battle_start', 'eff_t7_burn8'),
      ])],
    });
    // 快照=基础攻 100×8%=8/s（与治疗/护盾同口径·不吃限时加攻）。
    expect(periodicOf(r.log, 'burn').map((e) => e.amount)).toEqual([8, 8, 8, 8]);
  });

  it('燃烧按目标最大血：1%/s（靶 2000 血→20/s）；护盾先扛（1:1 啃盾·血不动）', async () => {
    const b1 = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [{ rowId: 'bu_t7_fat', slot: 'r1c0', overrides: { maxHp: 2000 } }],
      effects: [stateRow('eff_t7_burnhp', 'burn', 0, 3, 'nearest_random_tie', { stateAmount: undefined, stateTickMaxHpPct: 0.01 })],
    });
    const e1 = await engineOf(b1);
    const r1 = e1.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [trig('battle_start', 'eff_t7_burnhp')])],
    });
    expect(periodicOf(r1.log, 'burn').map((e) => e.amount)).toEqual([20, 20, 20]);
    // 护盾先扛：敌自带盾（开局大招罩 20000），燃烧 10/s 全进盾——amount(掉血)=0、shieldAfter 递减。
    const b2 = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [{ rowId: 'bu_t7_shielded', slot: 'r1c0', overrides: { ultimateEffectRef: 'eff_state_shield', ultimateCdSec: 999 } }],
      effects: [stateRow('eff_t7_burn10', 'burn', 0, 4, 'nearest_random_tie', { stateAmount: undefined, stateTickFlat: 10 })],
    });
    const e2 = await engineOf(b2);
    const r2 = e2.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [trig('battle_start', 'eff_t7_burn10')])],
    });
    const ticks = periodicOf(r2.log, 'burn');
    expect(ticks.every((e) => e.amount === 0)).toBe(true); // 全被盾吃掉·未掉血
    expect(ticks.map((e) => e.shieldAfter)).toEqual([19990, 19980, 19970, 19960]);
    expect(r2.finalState.enemies[0]?.hp).toBe(100000);
  });

  it('燃烧可叠 2 层（贯日Lv60 口径）：每秒重挂→第 1 跳 10、此后每跳 20', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [stateRow('eff_t7_burn2', 'burn', 0, 4, 'nearest_random_tie', { stateAmount: undefined, stateTickFlat: 10, stateMaxStacks: 2 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [trig('cd', 'eff_t7_burn2', { cdSec: 1 })])],
    });
    // t=0 施加(1层·下一跳1)；t=1 先跳 10 再重挂(2层·节拍重起)；此后每秒跳 20。
    expect(periodicOf(r.log, 'burn').map((e) => [e.timeSec, e.amount])).toEqual([[1, 10], [2, 20], [3, 20], [4, 20], [5, 20]]);
  });

  it('燃烧跳死：击杀归账给施加者（on_kill 触发）+ 阵亡结算正确', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_burner', overrides: { normalEffectRef: 'none' } }],
      enemies: [
        { rowId: 'bu_t7_frail', slot: 'r1c0', overrides: { maxHp: 25 } },
        { rowId: 'bu_t7_big', slot: 'r1c2' },
      ],
      effects: [
        stateRow('eff_t7_burnkill', 'burn', 0, 10, 'nearest_random_tie', { stateAmount: undefined, stateTickFlat: 10 }),
        stateRow('eff_t7_killmark', 'atk_up', 0.1, 1, 'self_team', { maxTargets: 1 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_burner', 'p1c2', [
        trig('battle_start', 'eff_t7_burnkill'),
        trig('on_kill', 'eff_t7_killmark'),
      ])],
    });
    // 25 血靶：t=1/2 各 10、t=3 只掉剩余 5 → 阵亡。击杀时序语义（纸面规则）：燃烧击杀发生在
    // "状态到期"步（步2）、同 tick 的触发步（步3）即见击杀标志 → on_kill 当 tick t=3.0 触发
    // （直伤击杀发生在普攻步4、触发步只能下个 tick 看到——两者差一 tick 是真实步序的自然结果）。
    expect(r.log.some((e) => e.type === 'unit_down' && e.actorId === 'enemy_0000' && e.timeSec === 3)).toBe(true);
    expect(r.log.some((e) => e.type === 'ultimate_cast' && e.effectRef === 'eff_t7_killmark' && e.timeSec === 3)).toBe(true);
  });

  it('甘霖「再生」通路：治疗行搭载 regen（攻×15%/s·4s）·被治友军获 HoT', async () => {
    const b = mechRig({
      players: [
        { rowId: 'bu_t7_tank2' },
        { rowId: 'bu_t7_healer2', overrides: { targetingTag: 'lowest_hp_ally', normalEffectRef: 'eff_t7_regenheal' } },
      ],
      enemies: [{ rowId: 'bu_t7_hitter', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [{
        rowId: 'eff_t7_regenheal',
        overrides: {
          effectKind: 'normal_attack', effectType: 'repair_burst', effectPower: 0.5,
          targetingTag: 'lowest_hp_ally', durationSec: 4, maxTargets: 1,
          stateTag: 'regen', stateTickAtkPct: 0.15,
        },
      }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_tank2', 'p1c2'), unitInput('bu_t7_healer2', 'p1c1')],
    });
    // 敌打前排 80/s；治疗 50/s + HoT 15/s（施加者攻 100×15%·快照）→ 每秒净 −15。
    expect(periodicOf(r.log, 'regen').map((e) => e.amount)).toEqual([15, 15, 15, 15, 15]);
    const tank = r.finalState.players.find((p) => p.unitId === 'player_p1c2');
    expect(tank?.hp).toBe(99895);
  });

  it('自愈插件通路：battle_start 挂 regen（最大血 1%/s·长时限）·满血跳过不记', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_selfheal', overrides: { maxHp: 1000 } }],
      enemies: [{ rowId: 'bu_t7_hitter', slot: 'r1c0', overrides: { attack: 125 } }],
      effects: [stateRow('eff_t7_selfregen', 'regen', 0, 999, 'self_team', { maxTargets: 1, stateAmount: undefined, stateTickMaxHpPct: 0.01 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_selfheal', 'p1c2', [trig('battle_start', 'eff_t7_selfregen')])],
    });
    // 敌 125 攻→每击 100；每秒 +10 回血 → 净 −90/s：t5 后 hp=450；t=0.x 满血期不跳不记。
    expect(periodicOf(r.log, 'regen').map((e) => e.amount)).toEqual([10, 10, 10, 10, 10]);
    const me = r.finalState.players.find((p) => p.unitId === 'player_p1c2');
    expect(me?.hp).toBe(450);
  });
});

// ===================== M3 · 叠层框架 =====================

const stackBlock = (rule: Record<string, unknown>): S7EffectBlock => ({ kind: 'stack', rule } as unknown as S7EffectBlock);

describe('⑦M3 叠层规则（过热/专注/坚甲/愈坚/贪吃星·手推期望值）', () => {
  it('炎「过热」：普攻命中叠 2%/层·上限3·断击(1.5s无命中)清空', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_flame' }],
      enemies: [
        { rowId: 'bu_t7_prey', slot: 'r1c0', overrides: { maxHp: 240 } },
        { rowId: 'bu_t7_late', slot: 'r1c1', delaySec: 5 },
      ],
    });
    const engine = await engineOf(b);
    const rule = { ruleId: 'overheat', on: 'attack_landed', stat: 'dmgUpPct', perStack: 0.02, maxStacks: 3, breakOn: 'attack_gap', breakGapSec: 1.5, breakAction: 'clear' };
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_flame', 'p1c2', [stackBlock(rule)])],
    });
    // t0:80(0层·杀前累层) t1:82(1层=80×1.02) t2:83(2层=80×1.04·靶死) → 断档3s清空 → t5 新靶 80。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([80, 82, 83, 80]);
    // Lv100 口径：断击只降 1 层——同场景 decay_1 → t5 以 2 层出手 83。
    const r2 = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_flame', 'p1c2', [stackBlock({ ...rule, breakAction: 'decay_1' })])],
    });
    expect(dmgBy(r2.log, 'player_p1c2').map((e) => e.amount)).toEqual([80, 82, 83, 83]);
  });

  it('源「专注」：锁定期每秒+3%·换目标清零重积', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_focus', overrides: { targetingTag: 'lock_until_dead' } }],
      enemies: [
        { rowId: 'bu_t7_first', slot: 'r1c0', overrides: { maxHp: 160 } },
        { rowId: 'bu_t7_second', slot: 'r1c1' },
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_focus', 'p1c2', [stackBlock({
        ruleId: 'focus', on: 'per_second', stat: 'dmgVsLockedPct', perStack: 0.03, maxStacks: 10, breakOn: 'target_switch',
      })])],
    });
    // 靶1：t0 80、t1 82(1层·击杀) → 换锁清零 → 靶2：t2 80、t3 82、t4 85、t5 87。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([80, 82, 80, 82, 85, 87]);
  });

  it('铁壁「坚甲」：受"重击"(技能伤害)叠 10% 减伤/层·普攻命中不叠', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_wall2' }],
      enemies: [
        { rowId: 'bu_t7_caster', slot: 'r1c0', overrides: { attack: 100, normalEffectRef: 'none', ultimateEffectRef: 'eff_t7_nuke2', ultimateCdSec: 2 } },
        { rowId: 'bu_t7_pecker', slot: 'r1c1', overrides: { attack: 100 } },
      ],
      effects: [{ rowId: 'eff_t7_nuke2', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1, targetingTag: 'nearest_random_tie', durationSec: 0, maxTargets: 1, stateTag: 'none' } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_wall2', 'p1c2', [stackBlock({
        ruleId: 'hardarmor', on: 'was_hit_by_skill', stat: 'dmgTakenDownPct', perStack: 0.1, maxStacks: 3,
      })])],
    });
    // 技能弹(施加者攻100→基线80)：t0 80(0层) t2 72(1层) t4 64(2层)；普攻弹只吃减伤不叠层：
    // t0 72(技能先结·已1层) t1 72 t2 64 t3 64 t4 56 t5 56——若普攻也叠层则 t1 必<72。
    const skillHits = r.log.filter((e) => e.type === 'damage' && e.effectRef === 'eff_t7_nuke2').map((e) => e.amount);
    expect(skillHits).toEqual([80, 72, 64]);
    const normalHits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'enemy_0001' && e.effectRef === 'eff_basic_attack').map((e) => e.amount);
    expect(normalHits).toEqual([72, 72, 64, 64, 56, 56]);
  });

  it('砺「愈坚」：每损 10% 血 +3% 减伤（派生层数·随血量动态）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_vet', overrides: { maxHp: 1000 } }],
      enemies: [{ rowId: 'bu_t7_hitter', slot: 'r1c0', overrides: { attack: 125 } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_vet', 'p1c2', [stackBlock({
        ruleId: 'harden', on: 'hp_lost_decile', stat: 'dmgTakenDownPct', perStack: 0.03, maxStacks: 8,
      })])],
    });
    // 基线100/击：满血100→(损10%)97→97→(2层)94→(3层)91→(4层)88；终血 433。
    expect(r.log.filter((e) => e.type === 'damage' && e.side === 'enemy').map((e) => e.amount)).toEqual([100, 97, 97, 94, 91, 88]);
    expect(r.finalState.players[0]?.hp).toBe(433);
  });

  it('贪吃星：击杀永久 +3% 攻（本场累积·不封顶）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_glutton' }],
      enemies: [
        { rowId: 'bu_t7_m1', slot: 'r1c0', overrides: { maxHp: 80 } },
        { rowId: 'bu_t7_m2', slot: 'r1c1', overrides: { maxHp: 80 } },
        { rowId: 'bu_t7_m3', slot: 'r1c2', overrides: { maxHp: 80 } },
        { rowId: 'bu_t7_boss2', slot: 'r1c3' },
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_glutton', 'p1c2', [stackBlock({
        ruleId: 'glutton', on: 'kill', stat: 'atkPct', perStack: 0.03,
      })])],
    });
    // 攻 100→103→106→109：80 → 82(103×0.8=82.4) → 85(106×0.8=84.8) → 87(109×0.8=87.2)×3。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([80, 82, 85, 87, 87, 87]);
  });

  it('战鼓（skill_cast 触发+全队叠增伤 8%/层）：每放一次技能全队层数+1', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_drummer' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0' }],
      effects: [
        { rowId: 'eff_t7_nuke3', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1, targetingTag: 'nearest_random_tie', durationSec: 0, maxTargets: 1, stateTag: 'none' } },
        stateRow('eff_t7_drums', 'dmg_up', 0.08, 8, 'self_team', { maxTargets: 5, stateMaxStacks: 5 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t7_drummer', 'p1c2', [
        trig('cd', 'eff_t7_nuke3', { cdSec: 2 }),      // 放技能：t=0/2/4
        trig('skill_cast', 'eff_t7_drums'),            // 同 tick 内排后=当场入层
      ])],
    });
    // 层数：t0=1层 t2=2层 t4=3层 → 普攻 86(80×1.08)/86/93(×1.16=92.8)/93/99(×1.24=99.2)/99。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([86, 86, 93, 93, 99, 99]);
    const applies = stateAppliesOf(r.log, 'eff_t7_drums');
    expect(applies.map((e) => e.stacks)).toEqual([undefined, 2, 3]); // 单层不带字段·叠层带
  });

  it('污染体全通路：单位行 extraTriggerBlocks(受击喷燃烧) + stackRules(越受击越狂暴)', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{
        rowId: 'bu_t7_polluted', slot: 'r1c0',
        overrides: {
          attack: 100,
          extraTriggerBlocks: [{ kind: 'trigger', on: 'on_hit', effectRef: 'eff_t7_spray' }],
          stackRules: [{ ruleId: 'rage', on: 'was_hit', stat: 'atkPct', perStack: 0.1 }],
        },
      }],
      effects: [stateRow('eff_t7_spray', 'burn', 0, 2, 'nearest_random_tie', { maxTargets: 2, stateAmount: undefined, stateTickFlat: 5 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: ENC, battleSeed: SEED, playerUnits: [unitInput('bu_t7_atk', 'p1c2')] });
    // 狂暴：我方每秒打它一下 → 敌攻 100/110/120/130/140/150 → 对我 80/88/96/104/112/120。
    expect(dmgBy(r.log, 'enemy_0000').map((e) => e.amount)).toEqual([80, 88, 96, 104, 112, 120]);
    // 喷毒：受击后 0.2s 喷燃烧（5/s·2s·每秒被打刷新）→ 跳点 1.2/2.2/3.2/4.2/5.2。
    expect(periodicOf(r.log, 'burn').map((e) => [e.timeSec, e.amount])).toEqual([[1.2, 5], [2.2, 5], [3.2, 5], [4.2, 5], [5.2, 5]]);
    const me = r.finalState.players.find((p) => p.unitId === 'player_p1c2');
    expect(me?.hp).toBe(100000 - 600 - 25);
  });
});

describe('⑦M1-D 零回归哨兵', () => {
  it('确定性：机制批场景同 seed 两跑结果一致', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t7_atk' }],
      enemies: [{ rowId: 'bu_t7_dummy', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [stateRow('eff_t7_mix', 'atk_up', 0.5, 2.5, 'self_team', { maxTargets: 1, alsoApplyStateRefs: ['eff_t7_mix2'] }), stateRow('eff_t7_mix2', 'dmg_taken_down', 0.5, 4, 'self_team', { maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const blocks = [trig('battle_start', 'eff_t7_mix')];
    const a = engine.run({ encounterRef: ENC, battleSeed: 'det', playerUnits: [unitInput('bu_t7_atk', 'p1c2', blocks)] });
    const c = engine.run({ encounterRef: ENC, battleSeed: 'det', playerUnits: [unitInput('bu_t7_atk', 'p1c2', blocks)] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });

  it('旧配置场景（enc_n001 样例阵容）：日志无任何机制批①新字段/新 tag/新 effectType', async () => {
    const engine = await engineOf(loadBundle());
    const TRIO: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
      { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c2' },
    ];
    const r = engine.run({ encounterRef: ENC, battleSeed: 'seed-1', playerUnits: TRIO });
    const NEW_TAGS = ['atk_up', 'atk_down', 'atk_speed_up', 'atk_speed_down', 'armor_down',
      'dmg_up', 'dmg_taken_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
      'burn', 'regen'];
    for (const e of r.log) {
      expect(e.immune).toBeUndefined();
      expect(e.stacks).toBeUndefined();
      expect(e.periodic).toBeUndefined();
      expect(NEW_TAGS.includes(String(e.stateTag))).toBe(false);
      expect(e.effectType === 'apply_state').toBe(false);
    }
  });
});

// ===================== ⑨M5 · 净化/驱散极性 + 减益免疫 =====================
// 手推口径：基线普攻 100×100/125=80；atk_up/atk_down ±50%→攻150/50→伤120/40（整数）。
// purify 用 cd 触发 + initialCdSec 延迟首发（t=3），制造"净化前(t0-2)/后(t3-5)"可断言的 damage 序列。

/** 简单态施加行（非 M1 修正 tag·不带 stateAmount·debuff_immune/berserk/short_circuit 用）。 */
function simpleStateRow(rowId: string, stateTag: string, durationSec: number, targetingTag: string, extra?: Row): { rowId: string; overrides: Row } {
  return {
    rowId,
    overrides: {
      effectKind: 'state', effectType: 'apply_state', effectPower: 0,
      targetingTag, durationSec, maxTargets: 9, stateTag, summonUnitRef: 'none',
      ...(extra ?? {}),
    },
  };
}
/** 净化/驱散主体行（effectType=purify·无伤无治·dispelCount 条）。cd/initialCdSec 在触发块上、不在效果行。 */
function purifyRow(rowId: string, targetingTag: string, dispelCount: number, extra?: Row): { rowId: string; overrides: Row } {
  return {
    rowId,
    overrides: {
      effectKind: 'ultimate', effectType: 'purify', effectPower: 0,
      targetingTag, durationSec: 0, maxTargets: 9, stateTag: 'none', summonUnitRef: 'none', dispelCount,
      ...(extra ?? {}),
    },
  };
}
const dispelsOf = (log: S7AutoBattleLogEntry[], effectRef: string): S7AutoBattleLogEntry[] =>
  log.filter((e) => e.type === 'state_dispel' && e.effectRef === effectRef);
const cdPurify = (effectRef: string) => trig('cd', effectRef, { cdSec: 999, initialCdSec: 3 });

describe('⑨M5-A 净化/驱散极性（友军→清减益 / 敌方→清增益）', () => {
  it('净化清虚弱：受害者伤 40→(t=3 净化后)80·note=cleanse:atk_down·目标只命中受害者', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_victim' }, { rowId: 'bu_t9_pure' }],
      enemies: [{ rowId: 'bu_t9_dummy', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t9_selfweak', 'atk_down', 0.5, 10, 'self_team', { maxTargets: 1 }),
        purifyRow('eff_t9_purify1', 'self_team', 1),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9_victim', 'p1c2', [trig('battle_start', 'eff_t9_selfweak')]),
        unitInput('bu_t9_pure', 'p0c2', [cdPurify('eff_t9_purify1')]),
      ],
    });
    // atk_down 0.5→攻50→50×100/125=40（t0-2）；t=3 purify 在普攻步前移除→80（t3-5）。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([40, 40, 40, 80, 80, 80]);
    const d = dispelsOf(r.log, 'eff_t9_purify1');
    expect(d.length).toBe(1); // 净化者自身无减益=不产日志；只有受害者一条
    expect(d[0].note).toBe('cleanse:atk_down');
    expect(d[0].targetIds).toEqual(['player_p1c2']);
  });

  it('驱散清敌加攻：敌伤 120→(t=3 驱散后)80·note=dispel:atk_up（极性=敌方侧自动切增益）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_buffer' }, { rowId: 'bu_t9_pure2' }],
      enemies: [{ rowId: 'bu_t9_foe', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [
        stateRow('eff_t9_foeatkup', 'atk_up', 0.5, 10, 'nearest_random_tie'),
        purifyRow('eff_t9_purify2', 'nearest_random_tie', 1),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9_buffer', 'p1c2', [trig('battle_start', 'eff_t9_foeatkup')]),
        unitInput('bu_t9_pure2', 'p0c2', [cdPurify('eff_t9_purify2')]),
      ],
    });
    // 敌攻 100×1.5=150→150×100/125=120（t0-2）；t=3 驱散 atk_up→100×100/125=80（t3-5）。
    expect(dmgBy(r.log, 'enemy_0000').map((e) => e.amount)).toEqual([120, 120, 120, 80, 80, 80]);
    const d = dispelsOf(r.log, 'eff_t9_purify2');
    expect(d.length).toBe(1);
    expect(d[0].note).toBe('dispel:atk_up');
  });
});

describe('⑨M5-B 硬控门控 dispelHardControl（基座软控 only·L40/L60 才开）', () => {
  it('基座净化跳过硬控只清软减益；开 dispelHardControl 后硬控最高优先先清', async () => {
    const mk = async (hard: boolean) => {
      const b = mechRig({
        players: [{ rowId: 'bu_t9_v3' }, { rowId: 'bu_t9_p3' }],
        enemies: [{ rowId: 'bu_t9_d3', slot: 'r1c0' }],
        effects: [
          simpleStateRow('eff_t9_sc', 'short_circuit', 10, 'self_team', { maxTargets: 1 }),
          stateRow('eff_t9_ad', 'atk_down', 0.5, 10, 'self_team', { maxTargets: 1 }),
          purifyRow('eff_t9_pf3', 'self_team', 1, hard ? { dispelHardControl: true } : undefined),
        ],
      });
      const engine = await engineOf(b);
      const r = engine.run({
        encounterRef: ENC, battleSeed: SEED,
        playerUnits: [
          unitInput('bu_t9_v3', 'p1c2', [trig('battle_start', 'eff_t9_sc'), trig('battle_start', 'eff_t9_ad')]),
          unitInput('bu_t9_p3', 'p0c2', [cdPurify('eff_t9_pf3')]),
        ],
      });
      return dispelsOf(r.log, 'eff_t9_pf3');
    };
    const soft = await mk(false);
    expect(soft.length).toBe(1);
    expect(soft[0].note).toBe('cleanse:atk_down'); // 硬控被跳过，清软减益
    const withHard = await mk(true);
    expect(withHard[0].note).toBe('cleanse:short_circuit'); // 开门后硬控队首先清
  });
});

describe('⑨M5-C 不可驱散 applyUndispellable（守护铃口径）', () => {
  it('count=5 驱散跳过 undispellable 的 berserk、只清普通增益 atk_up', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_b4' }, { rowId: 'bu_t9_p4' }],
      enemies: [{ rowId: 'bu_t9_f4', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [
        simpleStateRow('eff_t9_undber', 'berserk', 20, 'nearest_random_tie', { applyUndispellable: true }),
        stateRow('eff_t9_fup', 'atk_up', 0.5, 20, 'nearest_random_tie'),
        purifyRow('eff_t9_pf4', 'nearest_random_tie', 5),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9_b4', 'p1c2', [trig('battle_start', 'eff_t9_undber'), trig('battle_start', 'eff_t9_fup')]),
        unitInput('bu_t9_p4', 'p0c2', [cdPurify('eff_t9_pf4')]),
      ],
    });
    const d = dispelsOf(r.log, 'eff_t9_pf4');
    expect(d.length).toBe(1);
    expect(d[0].note).toBe('dispel:atk_up'); // berserk 不可驱散→count 再大也留
  });
});

describe('⑨M5-D 减益免疫 debuff_immune（霖3★/净化模块传奇·挡减益含硬控·不挡增益）', () => {
  it('免疫态挡 atk_down 与 short_circuit（伤维持120、能出手），放行 atk_up', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_im' }],
      enemies: [{ rowId: 'bu_t9_d5', slot: 'r1c0' }],
      effects: [
        simpleStateRow('eff_t9_di', 'debuff_immune', 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t9_ad5', 'atk_down', 0.5, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t9_au5', 'atk_up', 0.5, 10, 'self_team', { maxTargets: 1 }),
        simpleStateRow('eff_t9_sc5', 'short_circuit', 10, 'self_team', { maxTargets: 1 }),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9_im', 'p1c2', [
          trig('battle_start', 'eff_t9_di'),   // 先上免疫
          trig('battle_start', 'eff_t9_ad5'),  // 虚弱→被挡
          trig('battle_start', 'eff_t9_au5'),  // 加攻→放行
          trig('battle_start', 'eff_t9_sc5'),  // 硬控→被挡
        ]),
      ],
    });
    // 仅 atk_up 生效→攻150→120 全程；若 atk_down 未挡=80、若短路未挡=零攻击 → [120]×6 三重证伪。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount)).toEqual([120, 120, 120, 120, 120, 120]);
    expect(stateAppliesOf(r.log, 'eff_t9_ad5').length).toBe(0); // 虚弱被挡=无 state_apply
    expect(stateAppliesOf(r.log, 'eff_t9_au5').length).toBe(1); // 加攻放行
    expect(stateAppliesOf(r.log, 'eff_t9_sc5').length).toBe(0); // 硬控被挡
  });
});

describe('⑨M5-E 计数/优先级 + 缺省哨兵', () => {
  it('净化 count=2：三减益按序清 armor_down+dmg_taken_up、留 atk_down', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_v6' }, { rowId: 'bu_t9_p6' }],
      enemies: [{ rowId: 'bu_t9_d6', slot: 'r1c0' }],
      effects: [
        stateRow('eff_t9_ad6', 'atk_down', 0.3, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t9_ar6', 'armor_down', 0.3, 10, 'self_team', { maxTargets: 1 }),
        stateRow('eff_t9_du6', 'dmg_taken_up', 0.3, 10, 'self_team', { maxTargets: 1 }),
        purifyRow('eff_t9_pf6', 'self_team', 2),
      ],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9_v6', 'p1c2', [
          trig('battle_start', 'eff_t9_ad6'), trig('battle_start', 'eff_t9_ar6'), trig('battle_start', 'eff_t9_du6'),
        ]),
        unitInput('bu_t9_p6', 'p0c2', [cdPurify('eff_t9_pf6')]),
      ],
    });
    // 软段序 burn>armor_down>dmg_taken_up>atk_down>…；present={atk_down,armor_down,dmg_taken_up}·count2→清前二。
    const d = dispelsOf(r.log, 'eff_t9_pf6');
    expect(d.length).toBe(1);
    expect(d[0].note).toBe('cleanse:armor_down,dmg_taken_up');
  });

  it('哨兵：无 M5 字段的基线战斗·日志无 state_dispel、无 purify effectType', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9_base' }],
      enemies: [{ rowId: 'bu_t9_base_e', slot: 'r1c0' }],
    });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: ENC, battleSeed: SEED, playerUnits: [unitInput('bu_t9_base', 'p1c2')] });
    for (const e of r.log) {
      expect(e.type === 'state_dispel').toBe(false);
      expect(e.effectType === 'purify').toBe(false);
    }
  });
});

// ===================== ⑨M4 · 受击重定向族（嘲讽/反弹/守护）=====================
// 手推口径：嘲讽=选目标强制(零伤害math)；反弹=dealDamage尾部向caster直扣(不再触发反弹/on_hit·无递归)；
// 守护=dealDamage顶部换目标(护后排)。全部可选通道·缺省缺席=逐字节不变(既有测试探雷)。

const firstDmgTargetOf = (log: S7AutoBattleLogEntry[], actorId: string): string | undefined =>
  log.find((e) => e.type === 'damage' && e.actorId === actorId)?.targetIds?.[0];

describe('⑨M4-A 嘲讽 taunt（选目标强制重定向·n102护后排解）', () => {
  it('嘲讽覆盖 backline_first：点名后排的敌被拉去打前排嘲讽者', async () => {
    const mk = async (taunt: boolean) => {
      const b = mechRig({
        players: [{ rowId: 'bu_t9m4_front' }, { rowId: 'bu_t9m4_back' }],
        enemies: [{ rowId: 'bu_t9m4_foe', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first' } }],
        effects: taunt ? [simpleStateRow('eff_t9m4_taunt', 'taunt', 10, 'nearest_random_tie', { maxTargets: 1 })] : [],
      });
      const engine = await engineOf(b);
      const r = engine.run({
        encounterRef: ENC, battleSeed: SEED,
        playerUnits: [
          unitInput('bu_t9m4_front', 'p2c2', taunt ? [trig('battle_start', 'eff_t9m4_taunt')] : undefined),
          unitInput('bu_t9m4_back', 'p0c0'),
        ],
      });
      return firstDmgTargetOf(r.log, 'enemy_0000');
    };
    expect(await mk(false)).toBe('player_p0c0'); // 无嘲讽：backline_first 打后排(col0)
    expect(await mk(true)).toBe('player_p2c2');  // 嘲讽：拉去打前排嘲讽者(col2·覆盖 backline)
  });

  it('单体嘲讽最高攻敌（砺口径）：只被嘲讽的强敌改打嘲讽者、弱敌照常打后排', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_f2' }, { rowId: 'bu_t9m4_b2' }],
      enemies: [
        { rowId: 'bu_t9m4_strong', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first', attackRangeCells: 99 } },
        { rowId: 'bu_t9m4_weak', slot: 'r1c6', overrides: { attack: 50, targetingTag: 'backline_first', attackRangeCells: 99 } },
      ],
      effects: [simpleStateRow('eff_t9m4_t2', 'taunt', 10, 'highest_attack_enemy', { maxTargets: 1 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_f2', 'p2c2', [trig('battle_start', 'eff_t9m4_t2')]),
        unitInput('bu_t9m4_b2', 'p0c0'),
      ],
    });
    // 嘲讽只落最高攻敌(强)→它打前排嘲讽者；弱敌无 taunt→照常打后排。
    expect(firstDmgTargetOf(r.log, 'enemy_0000')).toBe('player_p2c2'); // 强敌(先出怪=0000)被嘲讽
    expect(firstDmgTargetOf(r.log, 'enemy_0001')).toBe('player_p0c0'); // 弱敌照常后排
  });
});

describe('⑨M4-B 反弹 reflect + 格挡 block（受方受击后向攻击者直扣·攻击者=caster在手·无§5深坑）', () => {
  const reflectRun = async (reflectExtra: Row, playerOverrides?: Row) => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_ref', overrides: playerOverrides }],
      enemies: [{ rowId: 'bu_t9m4_atk', slot: 'r1c0', overrides: { attack: 100 } }],
      effects: [simpleStateRow('eff_t9m4_ref', 'reflect', 20, 'self_team', { maxTargets: 1, ...reflectExtra })],
    });
    const engine = await engineOf(b);
    return engine.run({ encounterRef: ENC, battleSeed: SEED, playerUnits: [unitInput('bu_t9m4_ref', 'p1c2', [trig('battle_start', 'eff_t9m4_ref')])] });
  };
  const reflectsOf = (r: { log: S7AutoBattleLogEntry[] }) => r.log.filter((e) => e.type === 'damage' && e.note === 'reflect');

  it('反弹 reflectPct 50%：受 80 → 反弹 round(0.5×80)=40 直扣攻击者', async () => {
    const rf = reflectsOf(await reflectRun({ reflectPct: 0.5 }));
    expect(rf.length).toBeGreaterThan(0);
    expect(rf.every((e) => e.amount === 40 && e.actorId === 'player_p1c2' && e.targetIds?.[0] === 'enemy_0000')).toBe(true);
  });
  it('反弹 reflectAtkPct（岳3★口径）：反弹=round(0.2×敌攻100)=20', async () => {
    const rf = reflectsOf(await reflectRun({ reflectAtkPct: 0.2 }));
    expect(rf.length).toBeGreaterThan(0);
    expect(rf.every((e) => e.amount === 20)).toBe(true);
  });
  it('反弹 reflectArmorPct（岳荆甲base·施加瞬间快照受方防25）：反弹=round(0.4×25)=10', async () => {
    const rf = reflectsOf(await reflectRun({ reflectArmorPct: 0.4 }));
    expect(rf.length).toBeGreaterThan(0);
    expect(rf.every((e) => e.amount === 10)).toBe(true);
  });
  it('格挡 blockPct 25%：敌普攻对格挡者 80→round(80×0.75)=60（无反弹日志）', async () => {
    const r = await reflectRun({ blockPct: 0.25 });
    expect(dmgBy(r.log, 'enemy_0000').length).toBeGreaterThan(0);
    expect(dmgBy(r.log, 'enemy_0000').every((e) => e.amount === 60)).toBe(true);
    expect(reflectsOf(r).length).toBe(0); // 只格挡不反弹
  });
  it('反弹致死：低血攻击者(30)被反弹40打死·反弹者记击杀·玩家胜', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_rk', overrides: { attack: 1 } }], // 弱攻=不靠普攻先杀，逼出反弹致死
      enemies: [{ rowId: 'bu_t9m4_lowatk', slot: 'r1c0', overrides: { attack: 100, maxHp: 30 } }],
      effects: [simpleStateRow('eff_t9m4_rk', 'reflect', 20, 'self_team', { maxTargets: 1, reflectPct: 0.5 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: ENC, battleSeed: SEED, playerUnits: [unitInput('bu_t9m4_rk', 'p1c2', [trig('battle_start', 'eff_t9m4_rk')])] });
    const rk = r.log.find((e) => e.type === 'damage' && e.note === 'reflect' && e.targetIds?.[0] === 'enemy_0000');
    expect(rk?.amount).toBe(40);
    expect(r.finalState.enemies.find((e) => e.unitId === 'enemy_0000')?.alive).toBe(false);
    expect(r.winner).toBe('player');
  });
});

describe('⑨M4-C 守护替挡 guard（岩·敌打后排→转守护者·CD 门控·n102护后排解②）', () => {
  it('守护CD2s：敌点名后排→替挡落守护者(t0/2/4)、CD中落回后排(t1/3/5)', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_grd' }, { rowId: 'bu_t9m4_ally' }],
      enemies: [{ rowId: 'bu_t9m4_ge', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first', attackRangeCells: 99 } }],
      effects: [simpleStateRow('eff_t9m4_guard', 'guard', 30, 'self_team', { maxTargets: 1, guardProtect: 'backline', guardCooldownSec: 2 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_grd', 'p1c2', [trig('battle_start', 'eff_t9m4_guard')]), // 守护者在前(col2)
        unitInput('bu_t9m4_ally', 'p1c0'), // 后排友军(col0)
      ],
    });
    const seq = r.log.filter((e) => e.type === 'damage' && e.actorId === 'enemy_0000').map((e) => e.targetIds?.[0]);
    // CD2s：t0替挡(→守护者·CD到t2) / t1落回后排 / t2替挡 / t3后排 / t4替挡 / t5后排。
    expect(seq).toEqual(['player_p1c2', 'player_p1c0', 'player_p1c2', 'player_p1c0', 'player_p1c2', 'player_p1c0']);
  });

  it('backline 方向语义：守护者(后)不护更靠前的友军（敌打前排照落前排）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_g2' }, { rowId: 'bu_t9m4_a2' }],
      enemies: [{ rowId: 'bu_t9m4_ge2', slot: 'r1c0', overrides: { attack: 100, attackRangeCells: 99 } }],
      effects: [simpleStateRow('eff_t9m4_g2', 'guard', 30, 'self_team', { maxTargets: 1, guardProtect: 'backline', guardCooldownSec: 0 })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_g2', 'p1c0', [trig('battle_start', 'eff_t9m4_g2')]), // 守护者在后(col0)
        unitInput('bu_t9m4_a2', 'p1c2'), // 前排友军(col2·离敌更近)
      ],
    });
    // 敌 nearest→前排 a2(更近)；守护者在后·backline 只护更靠后者→a2 更靠前不护→照落 a2。
    expect(firstDmgTargetOf(r.log, 'enemy_0000')).toBe('player_p1c2');
  });
});

describe('⑨M4-D 分摊 share（受方受击时把 sharePct 转承接者·受方只承剩余·护栏②受方伤害走 receiverDmg）', () => {
  const sharesOf = (log: S7AutoBattleLogEntry[]) => log.filter((e) => e.type === 'damage' && e.note === 'share');

  it('分摊 to_caster（山岳SS/沧3★）：敌打友军80·30%(24)转承接者、友军只承56', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_sink' }, { rowId: 'bu_t9m4_recv' }],
      enemies: [{ rowId: 'bu_t9m4_se', slot: 'r1c0', overrides: { attack: 100, attackRangeCells: 99 } }],
      effects: [simpleStateRow('eff_t9m4_share', 'share', 30, 'self_team', { maxTargets: 9, sharePct: 0.3, shareMode: 'to_caster' })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_sink', 'p1c0', [trig('battle_start', 'eff_t9m4_share')]), // 承接者=施加者
        unitInput('bu_t9m4_recv', 'p1c2'), // 受方(近敌·被打)
      ],
    });
    const sh = sharesOf(r.log);
    expect(sh.length).toBeGreaterThan(0);
    expect(sh.every((e) => e.amount === 24 && e.targetIds?.[0] === 'player_p1c0')).toBe(true); // 24 转承接者
    expect(dmgBy(r.log, 'enemy_0000').every((e) => e.amount === 56)).toBe(true); // 受方只承 56
  });

  it('分摊 adjacent（援护链互摊）：相邻友军各持 adjacent share·A被打80·20%(16)转相邻B、A承64', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_a' }, { rowId: 'bu_t9m4_b' }],
      enemies: [{ rowId: 'bu_t9m4_ae', slot: 'r1c0', overrides: { attack: 100, attackRangeCells: 99 } }],
      effects: [simpleStateRow('eff_t9m4_sa', 'share', 30, 'self_team', { maxTargets: 1, sharePct: 0.2, shareMode: 'adjacent' })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_a', 'p1c2', [trig('battle_start', 'eff_t9m4_sa')]), // 近敌·被打
        unitInput('bu_t9m4_b', 'p1c1', [trig('battle_start', 'eff_t9m4_sa')]), // 相邻承接
      ],
    });
    const sh = sharesOf(r.log);
    expect(sh.length).toBeGreaterThan(0);
    expect(sh.every((e) => e.amount === 16 && e.targetIds?.[0] === 'player_p1c1')).toBe(true);
    expect(dmgBy(r.log, 'enemy_0000').every((e) => e.amount === 64)).toBe(true);
  });

  it('分摊致死：低血承接者(20)被分摊(24)打死·归攻击者记账', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m4_sink2', overrides: { maxHp: 20 } }, { rowId: 'bu_t9m4_recv2' }],
      enemies: [{ rowId: 'bu_t9m4_se2', slot: 'r1c0', overrides: { attack: 100, attackRangeCells: 99 } }],
      effects: [simpleStateRow('eff_t9m4_sh2', 'share', 30, 'self_team', { maxTargets: 9, sharePct: 0.3, shareMode: 'to_caster' })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m4_sink2', 'p1c0', [trig('battle_start', 'eff_t9m4_sh2')]),
        unitInput('bu_t9m4_recv2', 'p1c2'),
      ],
    });
    const share = r.log.find((e) => e.type === 'damage' && e.note === 'share' && e.targetIds?.[0] === 'player_p1c0');
    expect(share?.amount).toBe(24);
    expect(r.finalState.players.find((p) => p.unitId === 'player_p1c0')?.alive).toBe(false); // 承接者被分摊致死
  });
});

// ===================== ⑨M6 · 光环（源持态·消费点动态求和·在场即生效退场撤销）=====================
/** 光环施加行（源持 aura 态·self_team maxTargets 1 上到源自己）。 */
function auraRow(rowId: string, auraStat: string, auraAmount: number, auraScope: string, extra?: Row): { rowId: string; overrides: Row } {
  return {
    rowId,
    overrides: {
      effectKind: 'state', effectType: 'apply_state', effectPower: 0,
      targetingTag: 'self_team', durationSec: 99, maxTargets: 1, stateTag: 'aura', summonUnitRef: 'none',
      auraStat, auraAmount, auraScope, ...(extra ?? {}),
    },
  };
}

describe('⑨M6-A 减伤光环（磐石力场/哨卫联防/沧坚壁·dealDamage 减伤轴动态求和）', () => {
  it('cross 范围（磐石力场 −15%）：十字内友军受 68（0.85×80）·关光环=80', async () => {
    const mk = async (on: boolean) => {
      const b = mechRig({
        players: [{ rowId: 'bu_t9m6_src' }, { rowId: 'bu_t9m6_tgt' }],
        enemies: [{ rowId: 'bu_t9m6_e', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first', attackRangeCells: 99 } }],
        effects: on ? [auraRow('eff_t9m6_a', 'dmgTakenDownPct', 0.15, 'cross')] : [],
      });
      const engine = await engineOf(b);
      const r = engine.run({
        encounterRef: ENC, battleSeed: SEED,
        playerUnits: [
          unitInput('bu_t9m6_src', 'p1c1', on ? [trig('battle_start', 'eff_t9m6_a')] : undefined), // 光环源
          unitInput('bu_t9m6_tgt', 'p1c0', undefined), // 十字相邻·后排(被 backline 点)
        ],
      });
      return dmgBy(r.log, 'enemy_0000').map((e) => e.amount);
    };
    expect((await mk(true)).every((a) => a === 68)).toBe(true);  // 十字内 −15%
    expect((await mk(false)).every((a) => a === 80)).toBe(true); // 无光环
  });

  it('cross 范围排除对角：3×3 对角(非十字)友军不吃 cross 光环·受 80', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m6_s2' }, { rowId: 'bu_t9m6_diag' }],
      enemies: [{ rowId: 'bu_t9m6_e2', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first', attackRangeCells: 99 } }],
      effects: [auraRow('eff_t9m6_a2', 'dmgTakenDownPct', 0.15, 'cross')],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m6_s2', 'p1c1', [trig('battle_start', 'eff_t9m6_a2')]), // 源 p1c1
        unitInput('bu_t9m6_diag', 'p0c0', undefined), // 对角(dr1dc1·block非cross)·后排被点
      ],
    });
    expect(dmgBy(r.log, 'enemy_0000').every((a) => a.amount === 80)).toBe(true); // 对角不在十字→不减伤
  });
});

describe('⑨M6-B 攻速光环（号角催进·effInterval 动态求和）', () => {
  it('team 范围 +25% 攻速：间隔 1.0→0.8·6s 内攻击数增加（>基线6）', async () => {
    const mk = async (on: boolean) => {
      const b = mechRig({
        players: [{ rowId: 'bu_t9m6_horn' }],
        enemies: [{ rowId: 'bu_t9m6_e3', slot: 'r1c0', overrides: { attack: 1 } }],
        effects: on ? [auraRow('eff_t9m6_spd', 'atkSpeedPct', 0.25, 'team')] : [],
      });
      const engine = await engineOf(b);
      const r = engine.run({
        encounterRef: ENC, battleSeed: SEED,
        playerUnits: [unitInput('bu_t9m6_horn', 'p1c2', on ? [trig('battle_start', 'eff_t9m6_spd')] : undefined)],
      });
      return dmgBy(r.log, 'player_p1c2').length;
    };
    expect(await mk(false)).toBe(6); // 间隔1.0→6击
    expect(await mk(true)).toBeGreaterThan(6); // +25%攻速→提速(≈8击)
  });
});

describe('⑨M6-C 光环条件门（哨卫联防 has_summon）', () => {
  it('本源无召唤物→has_summon 条件假→联防不生效·受 80（非 74）', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m6_sen' }, { rowId: 'bu_t9m6_al' }],
      enemies: [{ rowId: 'bu_t9m6_e4', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first', attackRangeCells: 99 } }],
      effects: [auraRow('eff_t9m6_lf', 'dmgTakenDownPct', 0.08, 'team', { auraCondition: 'has_summon' })],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m6_sen', 'p1c1', [trig('battle_start', 'eff_t9m6_lf')]),
        unitInput('bu_t9m6_al', 'p1c0', undefined),
      ],
    });
    expect(dmgBy(r.log, 'enemy_0000').every((a) => a.amount === 80)).toBe(true); // 条件不满足→光环不生效
  });
});

// ===================== ⑨M7 · 连锁概率族核心（多重释放/概率连击/溅射分伤）=====================
const dmgRef = (log: S7AutoBattleLogEntry[], ref: string) => log.filter((e) => e.type === 'damage' && e.effectRef === ref);

describe('⑨M7-A 多重释放（极焰SS连放三次/群蜂饱和SS连放两轮）', () => {
  it('repeatCount=2：技能连放 3 次（1+2）·同目标 3 次伤害', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m7_mc' }],
      enemies: [{ rowId: 'bu_t9m7_e', slot: 'r1c0' }],
      effects: [{ rowId: 'eff_t9m7_mc', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'single_target', durationSec: 0, maxTargets: 1, stateTag: 'none', summonUnitRef: 'none', repeatCount: 2 } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m7_mc', 'p1c2', [trig('battle_start', 'eff_t9m7_mc')])],
    });
    expect(dmgRef(r.log, 'eff_t9m7_mc').length).toBe(3); // battle_start 一次触发 × repeatCount2 = 3 发
  });
});

describe('⑨M7-B 概率连击（极焰快速装填/锋矢L100·普攻 repeatChance）', () => {
  it('repeatChance=1.0：每次普攻必额外一发·6 击→12 伤害', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m7_rc', overrides: { normalEffectRef: 'eff_t9m7_rc' } }],
      enemies: [{ rowId: 'bu_t9m7_e2', slot: 'r1c0' }],
      effects: [{ rowId: 'eff_t9m7_rc', overrides: { effectKind: 'normal_attack', effectType: 'basic_damage', effectPower: 1.0, targetingTag: 'single_target', durationSec: 0, maxTargets: 1, stateTag: 'none', summonUnitRef: 'none', repeatChance: 1.0 } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m7_rc', 'p1c2', undefined)],
    });
    expect(dmgRef(r.log, 'eff_t9m7_rc').length).toBe(12); // 6 普攻 × 必连击1 = 12
  });
});

describe('⑨M7-C 溅射分伤（散射枪管/引爆器/极焰节点/贯日L40·首目标满额·邻格 splashPct）', () => {
  it('splashPct=0.5 + block_area：主目标 80 满额、邻格 40 半额', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m7_sp' }],
      enemies: [
        { rowId: 'bu_t9m7_pe', slot: 'r1c0' },
        { rowId: 'bu_t9m7_ne1', slot: 'r0c0' },
        { rowId: 'bu_t9m7_ne2', slot: 'r1c1' },
      ],
      effects: [{ rowId: 'eff_t9m7_sp', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'block_area', durationSec: 0, maxTargets: 9, stateTag: 'none', summonUnitRef: 'none', splashPct: 0.5 } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m7_sp', 'p1c2', [trig('battle_start', 'eff_t9m7_sp')])],
    });
    const amounts = dmgRef(r.log, 'eff_t9m7_sp').map((e) => e.amount ?? 0).sort((a, x) => x - a);
    expect(amounts.length).toBeGreaterThanOrEqual(2); // 至少 主+1邻
    expect(amounts[0]).toBe(80); // 首目标满额 80
    expect(amounts.slice(1).every((a) => a === 40)).toBe(true); // 邻格 ×0.5=40
  });
});

// ===================== ⑨M8 · 致盲（命中判定层·普攻按 blindChance 落空）=====================
function blindRow(rowId: string, blindChance: number): { rowId: string; overrides: Row } {
  return {
    rowId,
    overrides: {
      effectKind: 'state', effectType: 'apply_state', effectPower: 0,
      targetingTag: 'nearest_random_tie', durationSec: 20, maxTargets: 1, stateTag: 'blind', summonUnitRef: 'none', blindChance,
    },
  };
}
const blindMisses = (log: S7AutoBattleLogEntry[], actorId: string) =>
  log.filter((e) => e.type === 'unit_attack' && e.note === 'blind_miss' && e.actorId === actorId);

describe('⑨M8 致盲（迷雾普攻/致盲领域/SS）', () => {
  const mk = async (chance: number | null) => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m8_p', overrides: { attack: 1 } }], // 弱攻·不速杀敌·让敌反复出手
      enemies: [{ rowId: 'bu_t9m8_e', slot: 'r1c0', overrides: { attack: 100, maxHp: 100000 } }],
      effects: chance !== null ? [blindRow('eff_t9m8_bl', chance)] : [],
    });
    const engine = await engineOf(b);
    return engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m8_p', 'p1c2', chance !== null ? [trig('battle_start', 'eff_t9m8_bl')] : undefined)],
    });
  };

  it('blindChance=1.0：被致盲敌普攻全落空·0 伤害 + 6 次 blind_miss(照进冷却)·关致盲=6 伤害', async () => {
    const on = await mk(1.0);
    const off = await mk(null);
    expect(dmgBy(on.log, 'enemy_0000').length).toBe(0); // 全落空→敌零伤害
    expect(blindMisses(on.log, 'enemy_0000').length).toBe(6); // 6 次 miss=冷却正常推进(每 1s 一次尝试)
    expect(dmgBy(off.log, 'enemy_0000').length).toBe(6); // 无致盲=6 次正常伤害
  });

  it('blindChance=0.5：部分落空（miss>0 且 hit>0·miss+hit=6 次尝试）', async () => {
    const on = await mk(0.5);
    const misses = blindMisses(on.log, 'enemy_0000').length;
    const hits = dmgBy(on.log, 'enemy_0000').length;
    expect(misses).toBeGreaterThan(0); // 有落空
    expect(hits).toBeGreaterThan(0); // 有命中
    expect(misses + hits).toBe(6); // 共 6 次出手
  });
});

// ===================== ⑨M9/敌载体 · 第三段（贪吃星累积 + 敌载体三缺口组合验证）=====================
describe('⑨M9 贪吃星（运行时属性累积·on_kill 永久+攻·真源低成本项）', () => {
  it('accumulate_attack 0.5：每次击杀永久 +50%基础攻·连杀伤害递增 80→120→160', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m9_glut' }],
      enemies: [
        { rowId: 'bu_t9m9_w1', slot: 'r1c0', overrides: { maxHp: 1, attack: 1 } },
        { rowId: 'bu_t9m9_w2', slot: 'r1c1', overrides: { maxHp: 1, attack: 1 } },
        { rowId: 'bu_t9m9_w3', slot: 'r1c2', overrides: { maxHp: 1, attack: 1 } },
      ],
      effects: [{ rowId: 'eff_t9m9_glut', overrides: { effectKind: 'ultimate', effectType: 'accumulate_attack', effectPower: 0.5, targetingTag: 'self_team', durationSec: 0, maxTargets: 1, stateTag: 'none', summonUnitRef: 'none' } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m9_glut', 'p1c2', [trig('on_kill', 'eff_t9m9_glut')])],
    });
    // 攻 100→(杀1)150→(杀2)200：伤 80/120/160（击杀 tick 后一拍累积生效）。
    expect(dmgBy(r.log, 'player_p1c2').map((e) => e.amount).slice(0, 3)).toEqual([80, 120, 160]);
  });
});

describe('⑨敌载体三缺口（组合验证·能力已由 M1-M8 完备·接线归⑥回归批·不碰敌配JSON）', () => {
  it('削弱我方（§20.6 #10 缺口）：敌 apply_state 对我方施 atk_down −50% → 我方伤 80→40', async () => {
    const b = mechRig({
      players: [{ rowId: 'bu_t9m9_p', overrides: { attack: 100 } }],
      enemies: [{ rowId: 'bu_t9m9_dbf', slot: 'r1c0', overrides: { attack: 1, ultimateEffectRef: 'eff_t9m9_wk', ultimateCdSec: 3, attackRangeCells: 99 } }],
      effects: [{ rowId: 'eff_t9m9_wk', overrides: { effectKind: 'ultimate', effectType: 'apply_state', effectPower: 0, targetingTag: 'nearest_random_tie', durationSec: 20, maxTargets: 1, stateTag: 'atk_down', stateAmount: 0.5, summonUnitRef: 'none' } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [unitInput('bu_t9m9_p', 'p1c2', undefined)],
    });
    // 敌开局(cd 初发 t=0)对我方施 atk_down −50% → 我方攻 100→50 → 伤 40（全程）。
    expect(dmgBy(r.log, 'player_p1c2').every((e) => e.amount === 40)).toBe(true);
  });

  it('敌方 AoE 载体：敌用 block_area+splashPct 命中我方多单位（首满额·邻半额）', async () => {
    const b = mechRig({
      players: [
        { rowId: 'bu_t9m9_pa', overrides: { maxHp: 100000 } },
        { rowId: 'bu_t9m9_pb', overrides: { maxHp: 100000 } },
      ],
      enemies: [{ rowId: 'bu_t9m9_aoe', slot: 'r1c0', overrides: { attack: 100, ultimateEffectRef: 'eff_t9m9_ea', ultimateCdSec: 99, attackRangeCells: 99 } }],
      effects: [{ rowId: 'eff_t9m9_ea', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'block_area', durationSec: 0, maxTargets: 9, stateTag: 'none', summonUnitRef: 'none', splashPct: 0.5 } }],
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: ENC, battleSeed: SEED,
      playerUnits: [
        unitInput('bu_t9m9_pa', 'p1c1', undefined),
        unitInput('bu_t9m9_pb', 'p1c2', undefined),
      ],
    });
    // 敌 block_area 打我方两单位·首目标满额 80、邻格 40（敌 AoE 载体=splash 能力已备·任何单位可用）。
    const aoe = dmgRef(r.log, 'eff_t9m9_ea').map((e) => e.amount ?? 0).sort((a, x) => x - a);
    expect(aoe.length).toBeGreaterThanOrEqual(2);
    expect(aoe[0]).toBe(80);
    expect(aoe.slice(1).every((a) => a === 40)).toBe(true);
  });
});
