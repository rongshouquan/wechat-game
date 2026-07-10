// 机制批③段二a：驾驶员质变/插件传奇的引擎新机制手推期望值测试。
// 基线量纲同段一：攻100/防25 → 普攻 80；直伤子结算=不过甲（原值）。
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
const cloneBundle = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
function addRowFrom(b: Bundle, table: S7ConfigTableName, srcRowId: string, newRowId: string, overrides: Row): Row {
  const src = row(b, table, srcRowId);
  const base = JSON.parse(JSON.stringify(src)) as Row;
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
function rig3(opts: {
  players: Array<{ rowId: string; overrides?: Row }>;
  enemies: Array<{ rowId: string; slot: string; overrides?: Row }>;
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
        unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: 0,
      });
      spawnRefs.push('spawn_n001_w1');
    } else {
      addRowFrom(b, 'battle_spawn_param', 'spawn_n001_w2', `spawn_m3b_${i}`, {
        unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: 0,
      });
      spawnRefs.push(`spawn_m3b_${i}`);
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
  return (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'm3b', playerUnits: players, ...(extra ?? {}) });
}
const af = (affix: string, value: number): S7EffectBlock => ({ kind: 'affix', affix, value } as unknown as S7EffectBlock);

describe('机制批③段二-致死预结算族（保命插件/苏5★替挡）', () => {
  it('保命：致死一击免死留 1 血（每场 1 次·第二次致死照死）', async () => {
    // 敌攻 100（对玩家防25 → 80/发·间隔1s）；玩家血 100=第一发 80 → 20；第二发 80≥20=致死 → 留 1；第三发 1 血照死。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_frail', overrides: { maxHp: 100, attack: 1 } }],
      enemies: [{ rowId: 'bu_m3b_killer', slot: 'r0c0', overrides: { attack: 100 } }],
      timeLimitSec: 4,
    });
    const r = await runRig(b, [unitInput('bu_m3b_frail', 'p1c2', [af('lethalGuardOnce', 1)])]);
    const guard = r.log.find((e) => e.type === 'state_apply' && e.effectRef === 'lethal_guard');
    expect(guard?.note).toBe('survive_at_1');
    const down = r.log.find((e) => e.type === 'unit_down' && e.actorId === 'player_p1c2');
    expect((down?.timeSec ?? 0)).toBeGreaterThan(guard?.timeSec ?? 0); // 免死之后才真死（第三发）
  });

  it('保命传奇：免死后短暂无敌（下一发 amount=0 immune）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3b_frail', overrides: { maxHp: 100, attack: 1 } }],
      enemies: [{ rowId: 'bu_m3b_killer', slot: 'r0c0', overrides: { attack: 100 } }],
      timeLimitSec: 2.4,
    });
    const r = await runRig(b, [unitInput('bu_m3b_frail', 'p1c2', [af('lethalGuardOnce', 1), af('lethalGuardImmuneSec', 1.5)])]);
    // t0 挨 80（100→20）·t1 致死→留 1+无敌 1.5s·t2 落在无敌窗内=immune 整发免伤。
    const immune = r.log.filter((e) => e.type === 'damage' && e.immune === true && (e.targetIds ?? [])[0] === 'player_p1c2');
    expect(immune.length).toBeGreaterThanOrEqual(1);
    expect(r.finalState.players[0].alive).toBe(true);
  });

  it('苏5★替挡：友军的致死一击转由持词条者承受（每场 1 次）', async () => {
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_frail', overrides: { maxHp: 100, attack: 1 } },
        { rowId: 'bu_m3b_su', overrides: { maxHp: 5000, attack: 1 } },
      ],
      enemies: [{ rowId: 'bu_m3b_killer', slot: 'r0c0', overrides: { attack: 100, targetingTag: 'backline_first' } }],
      timeLimitSec: 1.8, // 只看 t0/t1 两发（t2 第三发会再次致死=替挡已用·非本测对象）
    });
    // 敌打后排（p_c 低列=后排）：脆皮放 p1c0（最靠后）·苏放 p1c2。t0 80→20；t1 致死→苏替挡 80。
    const r = await runRig(b, [
      unitInput('bu_m3b_frail', 'p1c0'),
      unitInput('bu_m3b_su', 'p1c2', [af('saveAllyLethalOnce', 1)]),
    ]);
    const save = r.log.find((e) => e.type === 'damage' && e.note === 'lethal_guard_ally');
    expect(save?.targetIds).toEqual(['player_p1c2']); // 伤转苏
    expect(save?.amount).toBe(80);
    expect(r.finalState.players.find((u) => u.unitId === 'player_p1c0')?.alive).toBe(true); // 脆皮活着（20 血）
  });
});

describe('机制批③段二-处决/破半/削血（影5★/烬5★顺路/烬3★）', () => {
  it('影5★：目标 <40% 非 Boss=命中即处决（remain 直清·kill 归影）', async () => {
    // 敌血 300：hit1 80→220；hit2 80→140（140/300=46.7%>40% 不处决）；hit3 80→60（20%<40%→处决清 60）。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_ying' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0', overrides: { maxHp: 300 } }],
      timeLimitSec: 4,
    });
    const r = await runRig(b, [unitInput('bu_m3b_ying', 'p1c2', [af('executeLowHpPct', 0.40)])]);
    const exec = r.log.find((e) => e.type === 'damage' && e.note === 'execute');
    expect(exec?.amount).toBe(60);
    expect(r.winner).toBe('player');
  });

  it('烬5★破半：把目标从半血上打入半血下的那一击追加 攻×1.0（note=half_break·无伤害飘字=演出侧口径）', async () => {
    // 敌血 1000 现 560（>500）：hit 80 → 480（≤500 跨线）→ 追加 100（直伤）→ 380。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_jin' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0', overrides: { maxHp: 1000 } }],
      timeLimitSec: 8,
    });
    const r = await runRig(b, [unitInput('bu_m3b_jin', 'p1c2', [af('halfBreakAtkPct', 1.0)])]);
    const hb = r.log.filter((e) => e.type === 'damage' && e.note === 'half_break');
    expect(hb).toHaveLength(1); // 只在跨线那一击触发一次
    expect(hb[0].amount).toBe(100);
    // 跨线击前后血量核：跨线时 hpAfter ≤ 500 且上一发 >500。
    expect((hb[0].hpAfter ?? 0)).toBeLessThanOrEqual(500);
  });

  it('烬3★削血：命中满血目标追加削其当前生命 3%', async () => {
    // 敌血 10000 满血：hit 80 → 9920 → 削 round(9920×0.03)=298（note=hp_shave）；第二击目标非满血=无削。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_jin' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0', overrides: { maxHp: 10000 } }],
      timeLimitSec: 2.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_jin', 'p1c2', [af('shaveCurHpPct', 0.03)])]);
    const shave = r.log.filter((e) => e.type === 'damage' && e.note === 'hp_shave');
    expect(shave).toHaveLength(1);
    expect(shave[0].amount).toBe(298);
  });
});

describe('机制批③段二-暴击事件族（警戒必暴/瞄准补刀/嗜血翻倍）', () => {
  it('警戒传奇：闪避后下一击必暴（0 暴击率也暴=闩锁路径不掷随机）', async () => {
    // 玩家 dodgeRate=1 全闪避+critAfterDodge：敌打→闪避→玩家下一普攻必暴 80×1.5=120。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_dodgy' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0', overrides: { attack: 50 } }],
      timeLimitSec: 2.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_dodgy', 'p1c2', [
      af('dodgeRate', 1.0), af('critAfterDodge', 1), af('critDmg', 0.5),
    ])]);
    const crits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2' && e.crit === true);
    expect(crits.length).toBeGreaterThanOrEqual(1);
    expect(crits[0].amount).toBe(120); // 80×1.5
  });

  it('瞄准传奇：暴击补刀 攻×0.5（crit_followup 直伤）·嗜血传奇：暴击吸血翻倍', async () => {
    // critRate=1 全暴：主伤 120（80×1.5）→ 补刀 50（直伤）；吸血 10%×2=24（120×0.2）。
    const b = rig3({
      players: [{ rowId: 'bu_m3b_sniper', overrides: { maxHp: 100000, attack: 100 } }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0', overrides: { attack: 200 } }],
      timeLimitSec: 1.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_sniper', 'p1c2', [
      af('critRate', 1.0), af('critDmg', 0.5), af('critFollowupAtkPct', 0.5),
      af('lifesteal', 0.10), af('critLifestealDouble', 1),
    ])]);
    const follow = r.log.filter((e) => e.type === 'damage' && e.note === 'crit_followup');
    expect(follow.length).toBeGreaterThanOrEqual(1);
    expect(follow[0].amount).toBe(50);
    const heals = r.log.filter((e) => e.type === 'heal' && e.actorId === 'player_p1c2');
    expect(heals[0]?.amount).toBe(24); // 120×0.1×2（受伤后才有吸血空间：敌先手 160 伤=t0 敌普攻）
  });
});

describe('机制批③段二-涤荡注入/增幅/笼罩（霖/澈/蔽）', () => {
  it('霖：治疗附驱散（词条注入）+驱散成功回血+免疫 rider', async () => {
    // 敌给玩家 A 上虚弱（atk_down）→ 霖-舰治疗 A：驱散 1 减益 + 回血 攻×0.8=80 + debuff_immune 2s。
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_hurt', overrides: { maxHp: 1000, attack: 1 } },
        { rowId: 'bu_m3b_lin', overrides: { attack: 100, targetingTag: 'lowest_hp_ally', normalEffectRef: 'eff_m3b_heal' } },
      ],
      enemies: [{ rowId: 'bu_m3b_deb', slot: 'r0c0', overrides: {
        attack: 100,
        extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 2, effectRef: 'eff_m3b_weak' }],
      } }],
      effects: [
        { rowId: 'eff_m3b_heal', overrides: { effectKind: 'normal_attack', effectType: 'repair_burst', effectPower: 0.2, targetingTag: 'lowest_hp_ally', maxTargets: 1 } },
        { rowId: 'eff_m3b_weak', overrides: { effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'single_target', durationSec: 4, maxTargets: 1, stateTag: 'atk_down', stateAmount: 0.25 } },
      ],
      timeLimitSec: 3,
    });
    const r = await runRig(b, [
      unitInput('bu_m3b_hurt', 'p0c2'),
      unitInput('bu_m3b_lin', 'p2c0', [af('healDispelCount', 1), af('healOnDispelAtkPct', 0.8), af('afterDispelImmuneSec', 2)]),
    ]);
    expect(r.log.some((e) => e.type === 'state_dispel' && String(e.note).includes('atk_down'))).toBe(true);
    expect(r.log.some((e) => e.type === 'heal' && e.note === 'dispel_heal' && e.amount === 80)).toBe(true);
    expect(r.log.some((e) => e.type === 'state_apply' && e.stateTag === 'debuff_immune')).toBe(true);
  });

  it('澈增幅：本舰施加的增益态幅度 ×(1+0.5)——dmg_up 0.2→0.3（80→104）', async () => {
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_dps' },
        { rowId: 'bu_m3b_che', overrides: { attack: 1, targetingTag: 'highest_attack_ally', normalEffectRef: 'eff_m3b_buff' } },
      ],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0' }],
      effects: [
        { rowId: 'eff_m3b_buff', overrides: { effectKind: 'normal_attack', effectType: 'apply_state', effectPower: 0, targetingTag: 'highest_attack_ally', durationSec: 6, maxTargets: 1, stateTag: 'dmg_up', stateAmount: 0.2 } },
      ],
      timeLimitSec: 2.4,
    });
    const r = await runRig(b, [
      unitInput('bu_m3b_dps', 'p1c2'),
      unitInput('bu_m3b_che', 'p1c0', [af('buffAmpPct', 0.5)]),
    ]);
    // 澈 t0 上 buff（0.2×1.5=0.3）→ dps 后续普攻 80×1.3=104。
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2').map((e) => e.amount);
    expect(hits).toContain(104);
  });

  it('蔽笼罩：带减益敌受全队伤 +12%（80→90）·无减益敌原值', async () => {
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_dps' },
        { rowId: 'bu_m3b_bi', overrides: { attack: 1, normalEffectRef: 'eff_m3b_mark' } },
      ],
      enemies: [
        { rowId: 'bu_m3b_e0', slot: 'r0c0' },
        { rowId: 'bu_m3b_far', slot: 'r4c6' },
      ],
      effects: [
        { rowId: 'eff_m3b_mark', overrides: { effectKind: 'normal_attack', effectType: 'apply_state', effectPower: 0, targetingTag: 'single_target', durationSec: 6, maxTargets: 1, stateTag: 'atk_speed_down', stateAmount: 0.25 } },
      ],
      timeLimitSec: 2.4,
    });
    const r = await runRig(b, [
      unitInput('bu_m3b_dps', 'p1c2'),
      unitInput('bu_m3b_bi', 'p1c0', [af('debuffedTakenAmpTeam', 0.12)]),
    ]);
    // 蔽上减速（近敌 e0）→ 全队（dps）打 e0：round(80×1.12)=90。
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2' && (e.targetIds ?? [])[0] === 'enemy_0000').map((e) => e.amount);
    expect(hits).toContain(90);
  });
});

describe('机制批③段二-充能/散射/余震（插件状态机与延迟）', () => {
  it('充能：隔拍蓄力（charging 空拍）·满蓄发 ×1.7（80→136）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3b_charger' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0' }],
      timeLimitSec: 3.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_charger', 'p1c2', [af('chargedNormalPct', 0.70)])]);
    const atks = r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(atks[0].note).toBe('charging'); // t0=蓄力空拍
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2').map((e) => e.amount);
    expect(hits).toContain(136); // t1 满蓄 80×1.7
  });

  it('散射：普攻附带相邻 1 格 35% 溅射（80/28）·传奇 4 格档目标数=十字', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3b_spray' }],
      enemies: [
        { rowId: 'bu_m3b_e0', slot: 'r1c0' },
        { rowId: 'bu_m3b_e1', slot: 'r0c0' },
      ],
      timeLimitSec: 1.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_spray', 'p1c2', [af('normalSplashPct', 0.35), af('normalSplashTargets', 1)])]);
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2').map((e) => e.amount);
    expect(hits).toContain(80); // 主目标满额
    expect(hits).toContain(28); // 邻格 80×0.35
  });

  it('余震：技能命中 1.5s 后延迟追加 攻×1.4（note=delayed_hit）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3b_shaker', overrides: { ultimateEffectRef: 'eff_m3b_nuke', ultimateCdSec: 8 } }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0' }],
      effects: [{ rowId: 'eff_m3b_nuke', overrides: { effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.0, targetingTag: 'single_target', maxTargets: 1 } }],
      timeLimitSec: 2.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_shaker', 'p1c2', [af('aftershockAtkPct', 1.4)])]);
    const dh = r.log.filter((e) => e.type === 'damage' && e.note === 'delayed_hit');
    expect(dh).toHaveLength(1);
    expect(dh[0].amount).toBe(140); // 100×1.4 直伤
    expect(dh[0].timeSec).toBeCloseTo(1.6, 9); // t0 技能 → 1.5s 后（tick 栅格 1.6 结算）
  });
});

describe('机制批③段二-沧驰援/翎3★/守护强化（触发与守护窗）', () => {
  it('沧Lv1驰援：友军首次跌残血→获盾+嘲讽最高攻敌（一次性）', async () => {
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_frail', overrides: { maxHp: 200, attack: 1 } },
        { rowId: 'bu_m3b_cang', overrides: { attack: 100, targetingTag: 'controlled_ally_first', normalEffectRef: 'eff_m3b_heal2' } },
      ],
      enemies: [{ rowId: 'bu_m3b_killer', slot: 'r0c0', overrides: { attack: 200, targetingTag: 'backline_first' } }],
      effects: [
        { rowId: 'eff_m3b_heal2', overrides: { effectKind: 'normal_attack', effectType: 'repair_burst', effectPower: 0.1, targetingTag: 'lowest_hp_ally', maxTargets: 1 } },
      ],
      timeLimitSec: 3,
    });
    // 敌 160/发 打后排脆皮（200 血）→ t1 40/200=20%<30% 残血 → t1.2 驰援触发：沧获盾+嘲讽敌。
    const r = await runRig(b, [
      unitInput('bu_m3b_frail', 'p1c0'),
      unitInput('bu_m3b_cang', 'p1c2', [
        { kind: 'trigger', on: 'ally_lowhp', threshold: 0.3, effectRef: 'eff_pil_cang08_rescue_shield' } as unknown as S7EffectBlock,
        { kind: 'trigger', on: 'ally_lowhp', threshold: 0.3, effectRef: 'eff_pil_cang08_rescue_taunt' } as unknown as S7EffectBlock,
      ]),
    ]);
    expect(r.log.some((e) => e.type === 'state_apply' && e.stateTag === 'shield' && (e.targetIds ?? [])[0] === 'player_p1c2')).toBe(true);
    expect(r.log.some((e) => e.type === 'state_apply' && e.stateTag === 'taunt')).toBe(true);
    // 嘲讽生效：敌下一击被拉回打沧（非后排脆皮）。
    const afterTaunt = r.log.filter((e) => e.type === 'damage' && e.actorId === 'enemy_0000' && (e.timeSec ?? 0) >= 2);
    expect(afterTaunt.some((e) => (e.targetIds ?? [])[0] === 'player_p1c2')).toBe(true);
  });

  it('翎3★：持加攻速态期间普攻附带额外一击（同 tick 双击）', async () => {
    const b = rig3({
      players: [{ rowId: 'bu_m3b_ling' }],
      enemies: [{ rowId: 'bu_m3b_e0', slot: 'r0c0' }],
      effects: [{ rowId: 'eff_m3b_asu', overrides: { effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_team', durationSec: 30, maxTargets: 1, stateTag: 'atk_speed_up', stateAmount: 0.3 } }],
      timeLimitSec: 1.2,
    });
    const r = await runRig(b, [unitInput('bu_m3b_ling', 'p1c2', [
      af('extraNormalHitWhileAtkSpeedUp', 1),
      { kind: 'trigger', on: 'battle_start', effectRef: 'eff_m3b_asu' } as unknown as S7EffectBlock,
    ])]);
    const t0hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2' && Math.abs((e.timeSec ?? -1)) < 1e-9);
    expect(t0hits.length).toBe(2); // 主击+额外一击
  });

  it('岩5★守护双目标：同一冷却窗替挡 2 次（第 3 发才落原目标）', async () => {
    const b = rig3({
      players: [
        { rowId: 'bu_m3b_frail', overrides: { maxHp: 5000, attack: 1 } },
        { rowId: 'bu_m3b_guard', overrides: { maxHp: 100000, attack: 1 } },
      ],
      enemies: [
        { rowId: 'bu_m3b_k1', slot: 'r0c0', overrides: { attack: 100, targetingTag: 'backline_first' } },
        { rowId: 'bu_m3b_k2', slot: 'r1c0', overrides: { attack: 100, targetingTag: 'backline_first' } },
        { rowId: 'bu_m3b_k3', slot: 'r2c0', overrides: { attack: 100, targetingTag: 'backline_first' } },
      ],
      effects: [{ rowId: 'eff_m3b_guard', overrides: { effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_team', durationSec: 900, maxTargets: 1, stateTag: 'guard', guardProtect: 'backline', guardCooldownSec: 5 } }],
      timeLimitSec: 0.4,
    });
    // 三敌同 tick 各打后排脆皮：5★=窗口内替挡 2 次（前两发转岩）·第三发落回脆皮。
    const r = await runRig(b, [
      unitInput('bu_m3b_frail', 'p1c0'),
      unitInput('bu_m3b_guard', 'p1c2', [
        af('guardExtraCharges', 1),
        { kind: 'trigger', on: 'battle_start', effectRef: 'eff_m3b_guard' } as unknown as S7EffectBlock,
      ]),
    ]);
    const t0 = r.log.filter((e) => e.type === 'damage' && e.side === 'enemy' && Math.abs((e.timeSec ?? -1)) < 1e-9);
    const toGuard = t0.filter((e) => (e.targetIds ?? [])[0] === 'player_p1c2').length;
    const toFrail = t0.filter((e) => (e.targetIds ?? [])[0] === 'player_p1c0').length;
    expect(toGuard).toBe(2);
    expect(toFrail).toBe(1);
  });
});
