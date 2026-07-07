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
