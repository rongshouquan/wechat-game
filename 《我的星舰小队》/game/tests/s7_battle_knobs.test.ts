// 任务单⑥8a：受控并行加法六组旋钮测试（词条族/目标族/空间AoE/沉默免控/触发扩展/召唤生命周期包）。
// 口径：每个旋钮"装上生效"用手推精确期望值断言；"缺省缺席=逐字节不变"由全量既有测试(gate)兜底，
// 本文件另设哨兵：旧配置场景日志中不得出现任何新字段/新事件。
// 夹具同 s7_auto_battle_engine.test：内存 clone 配置造用例，不改磁盘样例表（运行时加载会过 ConfigValidatorS7：
// armor>0 / unitRef 须存在于实体表（克隆行继承）/ 出怪单位须列进 encounter.enemyUnitStatRefs）。
// 基线量纲：攻击手 攻100/防25/间隔1s ↔ 靶 防25 → 普攻=100×100/125=80（整数便于精确断言）。
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
/** 克隆一行并覆盖字段后推入表（新 rowId）。unitRef 等继承源行（过实体表存在性校验）。 */
function addRowFrom(b: Bundle, table: S7ConfigTableName, srcRowId: string, newRowId: string, overrides: Row): Row {
  const src = row(b, table, srcRowId);
  const clone = { ...JSON.parse(JSON.stringify(src)) as Row, rowId: newRowId, ...overrides };
  (b[table] as Row[]).push(clone);
  return clone;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}
const ofType = (log: S7AutoBattleLogEntry[], type: string): S7AutoBattleLogEntry[] => log.filter((e) => e.type === type);

/**
 * 标准旋钮试验台：1 攻击手(可带积木) vs 1 训练靶（默认 靶血 100000/攻 1/防 25·互不致死）。
 * 攻击手=克隆 vanguard：攻 100/间隔 1s/防 25/血 100000/射程 9/无大招（除非 overrides 给）。
 * 靶=克隆 swarm 于 r1c0。enc_n001 只挂 w1 一波（w2 行保留在表里→enemyUnitStatRefs 里保留 swarm 过校验）；
 * 限时默认 6s（30 tick·多数场景跑到超时）。
 */
function knobRig(opts: {
  attacker?: Row; dummy?: Row; timeLimitSec?: number;
  extraSpawn?: { rowId: string; unitRowId: string; slot: string };
} = {}): Bundle {
  const b = cloneBundle(loadBundle());
  addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_test_attacker', {
    maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    targetingTag: 'nearest_random_tie',
    ...(opts.attacker ?? {}),
  });
  addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_dummy', {
    maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    targetingTag: 'nearest_random_tie',
    ...(opts.dummy ?? {}),
  });
  const extraUnits = opts.extraSpawn ? [opts.extraSpawn.unitRowId] : [];
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: opts.extraSpawn ? ['spawn_n001_w1', opts.extraSpawn.rowId] : ['spawn_n001_w1'],
    // w2 行仍留在 spawn 表里指向 enc_n001，故 swarm 必须保留在清单内过校验（引擎只跑 spawnPlanRefs 引用的行）。
    enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_test_dummy', ...extraUnits],
    timeLimitSec: opts.timeLimitSec ?? 6,
  });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
    unitStatRef: 'bu_test_dummy', count: 1, slotRefs: ['r1c0'], spawnDelaySec: 0,
  });
  if (opts.extraSpawn) {
    addRowFrom(b, 'battle_spawn_param', 'spawn_n001_w2', opts.extraSpawn.rowId, {
      unitStatRef: opts.extraSpawn.unitRowId, count: 1, slotRefs: [opts.extraSpawn.slot], spawnDelaySec: 0,
    });
  }
  return b;
}
const ATK = (blocks?: S7EffectBlock[]): S7AutoBattlePlayerUnitInput[] => [
  { unitStatRef: 'bu_test_attacker', slotRef: 'p1c2', ...(blocks ? { effectBlocks: blocks } : {}) },
];
const affix = (a: string, value: number): S7EffectBlock => ({ kind: 'affix', affix: a as never, value });
/** 攻击手对外普攻伤害序列（eff_basic_attack）。 */
function basicHits(log: S7AutoBattleLogEntry[]): number[] {
  return log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2' && e.effectRef === 'eff_basic_attack')
    .map((e) => e.amount ?? -1);
}

describe('⑥8a-A 词条族（精确期望值·基线80=100×100/125）', () => {
  it('armorPen：防100 基线50/穿透1.0→100', async () => {
    const b = knobRig({ dummy: { armor: 100 } });
    const engine = await engineOf(b);
    const base = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    expect(basicHits(base.log)[0]).toBe(50); // 100×100/(100+100)
    const pen = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('armorPen', 1)]) });
    expect(basicHits(pen.log)[0]).toBe(100); // 防御全穿
  });

  it('dmgVsHighHp：满血靶(>50%) 80→160；dmgVsFortified：防40 71→143', async () => {
    const engine = await engineOf(knobRig());
    const hi = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('dmgVsHighHp', 1)]) });
    expect(basicHits(hi.log)[0]).toBe(160);
    const engine2 = await engineOf(knobRig({ dummy: { armor: 40 } }));
    const baseline = engine2.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    expect(basicHits(baseline.log)[0]).toBe(71); // 100×100/140=71.43→71
    const fort = engine2.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('dmgVsFortified', 1)]) });
    expect(basicHits(fort.log)[0]).toBe(143); // ×2=142.86→143（防40=高防判定线）
  });

  it('dmgVsLowHp：靶降到<30%后的下一击 80→160', async () => {
    const b = knobRig({ dummy: { maxHp: 110 } }); // 第1击后 30/110=27.3%<30%
    const engine = await engineOf(b);
    const base = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    expect(basicHits(base.log).slice(0, 2)).toEqual([80, 80]);
    const low = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('dmgVsLowHp', 1)]) });
    expect(basicHits(low.log).slice(0, 2)).toEqual([80, 160]); // 第2击触发残血加成
  });

  it('dmgTakenPct（受方减伤）：敌攻100 基线80/−0.5→40；dodgeRate=1：全闪避零掉血', async () => {
    const b = knobRig({ dummy: { attack: 100 } });
    const engine = await engineOf(b);
    const enemyHitOnPlayer = (log: S7AutoBattleLogEntry[]): S7AutoBattleLogEntry[] =>
      log.filter((e) => e.type === 'damage' && e.side === 'enemy' && e.targetIds?.[0] === 'player_p1c2');
    const base = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    expect(enemyHitOnPlayer(base.log)[0]?.amount).toBe(80);
    const reduced = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('dmgTakenPct', -0.5)]) });
    expect(enemyHitOnPlayer(reduced.log)[0]?.amount).toBe(40);
    const dodge = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('dodgeRate', 1)]) });
    const hits = enemyHitOnPlayer(dodge.log);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.dodged === true && e.amount === 0)).toBe(true);
    const me = dodge.finalState.players.find((p) => p.unitId === 'player_p1c2');
    expect(me?.hp).toBe(me?.maxHp); // 一滴血没掉
  });

  it('lifesteal：受伤后按实际扣血 50% 回吸（80→回40）', async () => {
    const b = knobRig({ dummy: { attack: 100 } });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix('lifesteal', 0.5)]) });
    const steal = ofType(r.log, 'heal').filter((e) => e.actorId === 'player_p1c2' && e.targetIds?.[0] === 'player_p1c2');
    expect(steal.length).toBeGreaterThan(0);
    expect(steal[0].amount).toBe(40); // 本舰击靶 80 × 0.5
  });

  it('skillDmgPct/effectAmp：只吃技能伤害（burst_nuke 176→264），普攻不吃', async () => {
    for (const key of ['skillDmgPct', 'effectAmp'] as const) {
      const b = knobRig({ attacker: { ultimateEffectRef: 'eff_ult_burst_nuke', ultimateCdSec: 10 } });
      const engine = await engineOf(b);
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([affix(key, 0.5)]) });
      const skillHit = r.log.find((e) => e.type === 'damage' && e.effectRef === 'eff_ult_burst_nuke');
      expect(skillHit?.amount).toBe(264); // 100×2.2×(100/125)=176 → ×1.5=264
      expect(basicHits(r.log)[0]).toBe(80); // 普攻不吃技能乘区
    }
  });

  it('shieldPower：盾量 200→300（大招全队盾）', async () => {
    const mk = async (blocks?: S7EffectBlock[]) => {
      const b = knobRig({ attacker: { maxHp: 1000, attack: 50, ultimateEffectRef: 'eff_ult_shield_bubble', ultimateCdSec: 10 } });
      const engine = await engineOf(b);
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
      return ofType(r.log, 'state_apply').find((e) => e.stateTag === 'shield' && e.targetIds?.[0] === 'player_p1c2')?.amount;
    };
    expect(await mk()).toBe(200); // max(1000×0.2, 50×1)
    expect(await mk([affix('shieldPower', 0.5)])).toBe(300);
  });

  it('healVsLowHp/healTakenPct：残血队友治疗 100→200；受治疗+50%→150', async () => {
    const mk = async (healerBlocks?: S7EffectBlock[], tankBlocks?: S7EffectBlock[]) => {
      const b = cloneBundle(loadBundle());
      addRowFrom(b, 'battle_effect_param', 'eff_ult_repair_burst', 'eff_test_heal_normal', {
        effectKind: 'normal_attack', effectType: 'repair_burst', effectPower: 1, targetingTag: 'lowest_hp_ally', maxTargets: 1, durationSec: 0, stateTag: 'none', summonUnitRef: 'none',
      });
      addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_test_healer', {
        maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
        normalEffectRef: 'eff_test_heal_normal', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
        // 普攻的目标选择走"单位行 targetingTag"（效果行 targetingTag 只在技能路径生效）——
        // 治疗舰必须行级配友方 tag（落数时晨曦/甘霖同口径·记数值细表）
        targetingTag: 'lowest_hp_ally',
      });
      addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_test_tank', {
        maxHp: 10000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
        ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
      });
      addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_dummy', {
        maxHp: 100000, attack: 9500, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
      });
      Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
        spawnPlanRefs: ['spawn_n001_w1'], timeLimitSec: 4,
        enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_test_dummy'],
      });
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_test_dummy', count: 1, slotRefs: ['r1c0'], spawnDelaySec: 0 });
      const engine = await engineOf(b);
      const lineup: S7AutoBattlePlayerUnitInput[] = [
        { unitStatRef: 'bu_test_healer', slotRef: 'p0c0', ...(healerBlocks ? { effectBlocks: healerBlocks } : {}) },
        { unitStatRef: 'bu_test_tank', slotRef: 'p1c2', ...(tankBlocks ? { effectBlocks: tankBlocks } : {}) },
      ];
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: lineup });
      // t0 稳定序：敌(9500×0.8=7600)先手把坦克打到 2400/10000=24%（<30%），随后奶妈普攻治疗最残
      return ofType(r.log, 'heal').find((e) => e.actorId === 'player_p0c0' && (e.amount ?? 0) > 0)?.amount;
    };
    expect(await mk()).toBe(100);
    expect(await mk([affix('healVsLowHp', 1)])).toBe(200);
    expect(await mk(undefined, [affix('healTakenPct', 0.5)])).toBe(150);
  });
});

describe('⑥8a-B 沉默/免控/敌行基线词条', () => {
  it('silence：挡技能触发、不挡普攻', async () => {
    const b = knobRig({
      attacker: { ultimateEffectRef: 'eff_ult_burst_nuke', ultimateCdSec: 5 },
      timeLimitSec: 12,
    });
    addRowFrom(b, 'battle_effect_param', 'eff_state_short_circuit', 'eff_test_silence', {
      effectKind: 'normal_attack', effectType: 'silence', stateTag: 'silence', durationSec: 999, targetingTag: 'single_target', maxTargets: 1, effectPower: 0, summonUnitRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_test_dummy'), { normalEffectRef: 'eff_test_silence' });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    // t0 大招先手放出 1 次（tick 内步序：触发在敌普攻前），随后被沉默 → 12s 内不再有第 2 次
    const ults = ofType(r.log, 'ultimate_cast').filter((e) => e.actorId === 'player_p1c2');
    expect(ults.length).toBe(1);
    // 普攻照打（12s 应有 ≥10 次）
    const attacks = ofType(r.log, 'unit_attack').filter((e) => e.actorId === 'player_p1c2');
    expect(attacks.length).toBeGreaterThanOrEqual(10);
  });

  it('control_immune：持有期间硬控施加落空、攻击不间断', async () => {
    const b = knobRig({ timeLimitSec: 6 });
    addRowFrom(b, 'battle_effect_param', 'eff_state_shield', 'eff_test_immune', {
      effectKind: 'ultimate', effectType: 'control_immune', stateTag: 'control_immune', durationSec: 999, targetingTag: 'self_team', maxTargets: 1, effectPower: 0, summonUnitRef: 'none',
    });
    addRowFrom(b, 'battle_effect_param', 'eff_state_short_circuit', 'eff_test_sc_hit', {
      effectKind: 'normal_attack', effectType: 'short_circuit', stateTag: 'short_circuit', durationSec: 999, targetingTag: 'single_target', maxTargets: 1, effectPower: 0, summonUnitRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_test_attacker'), { ultimateEffectRef: 'eff_test_immune', ultimateCdSec: 10 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_test_dummy'), { normalEffectRef: 'eff_test_sc_hit' });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    expect(ofType(r.log, 'state_apply').some((e) => e.stateTag === 'control_immune')).toBe(true);
    // 短路施加被免疫：全程无 short_circuit 落到玩家身上
    expect(ofType(r.log, 'state_apply').some((e) => e.stateTag === 'short_circuit' && e.targetIds?.[0] === 'player_p1c2')).toBe(false);
    const attacks = ofType(r.log, 'unit_attack').filter((e) => e.actorId === 'player_p1c2');
    expect(attacks.length).toBeGreaterThanOrEqual(5); // 6s/1s 间隔≈6 次，未被控停
  });

  it('敌行 controlResist=1：硬控时长归零（下 tick 即过期）；baseCrit 行字段：全暴击×2', async () => {
    const b = knobRig({ dummy: { attack: 100, controlResist: 1, baseCritRate: 1, baseCritDmg: 1 }, timeLimitSec: 4 });
    addRowFrom(b, 'battle_effect_param', 'eff_state_short_circuit', 'eff_test_sc_normal', {
      effectKind: 'normal_attack', effectType: 'short_circuit', stateTag: 'short_circuit', durationSec: 10, targetingTag: 'single_target', maxTargets: 1, effectPower: 0, summonUnitRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_test_attacker'), { normalEffectRef: 'eff_test_sc_normal' });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    const applied = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'short_circuit');
    const expired = ofType(r.log, 'state_expire').find((e) => e.stateTag === 'short_circuit');
    expect(applied && expired).toBeTruthy();
    expect((expired!.timeSec) - (applied!.timeSec)).toBeLessThanOrEqual(0.2 + 1e-6); // 抗性1→时长0→下tick清
    // 敌人全程带 100% 暴击 ×2：打玩家（防25）= 80×2=160 且 crit 标记
    const enemyHits = r.log.filter((e) => e.type === 'damage' && e.side === 'enemy');
    expect(enemyHits.length).toBeGreaterThan(0);
    expect(enemyHits.every((e) => e.crit === true && e.amount === 160)).toBe(true);
  });
});

describe('⑥8a-C 触发扩展（initialCd/cd_refund/once/护盾破/普攻命中）', () => {
  const CD_REFUND_ROW: Row = {
    effectKind: 'ultimate', effectType: 'cd_refund', effectPower: 5, targetingTag: 'single_target', maxTargets: 1, durationSec: 0, stateTag: 'none', summonUnitRef: 'none',
  };

  it('initialCdSec：cd 触发首发延迟到 3s（旧语义开局即放不变）', async () => {
    const b = knobRig({ timeLimitSec: 6 });
    const engine = await engineOf(b);
    const blocks: S7EffectBlock[] = [
      { kind: 'trigger', on: 'cd', cdSec: 5, initialCdSec: 3, effectRef: 'eff_ult_burst_nuke' },
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
    const casts = ofType(r.log, 'ultimate_cast').filter((e) => e.effectRef === 'eff_ult_burst_nuke');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(casts[0].timeSec).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(casts[0].timeSec).toBeLessThan(3.3);
  });

  it('cd_refund(on_kill)：两次分 tick 击杀回 CD → 第二轮大招大幅提前；once=true 只触发一次', async () => {
    const mk = async (once: boolean | undefined) => {
      // 布阵：脆皮×2（r1c0 近·r0c0 次近）+ 大血靶（r2c5 远·保场）；攻击手带全体大招 cd10。
      // 脆皮 230 血/防25：t0 大招96+普攻80 → 近的剩54，t1 普攻补刀（击杀#1）；
      // 次近的只吃大招96 → 剩134，t2/t3 普攻 80×2 → t3 击杀#2。两次击杀分属不同 tick。
      const b = knobRig({
        attacker: { ultimateEffectRef: 'eff_ult_clear_barrage', ultimateCdSec: 10 },
        timeLimitSec: 12,
      });
      addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_frail', {
        maxHp: 230, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
      });
      addRowFrom(b, 'battle_effect_param', 'eff_basic_attack', 'eff_test_refund', CD_REFUND_ROW);
      Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
        spawnPlanRefs: ['spawn_n001_w1', 'spawn_test_frails'],
        enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_test_dummy', 'bu_test_frail'],
      });
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { slotRefs: ['r2c5'] }); // 大血靶挪远
      addRowFrom(b, 'battle_spawn_param', 'spawn_n001_w2', 'spawn_test_frails', {
        unitStatRef: 'bu_test_frail', count: 2, slotRefs: ['r1c0', 'r0c0'], spawnDelaySec: 0,
      });
      const engine = await engineOf(b);
      const blocks: S7EffectBlock[] = [
        { kind: 'trigger', on: 'on_kill', effectRef: 'eff_test_refund', ...(once !== undefined ? { once } : {}) },
      ];
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
      const refunds = ofType(r.log, 'ultimate_cast').filter((e) => e.effectType === 'cd_refund');
      const barrages = ofType(r.log, 'ultimate_cast').filter((e) => e.effectRef === 'eff_ult_clear_barrage');
      return { refunds: refunds.length, second: barrages[1]?.timeSec ?? null };
    };
    const base = await mk(undefined);
    expect(base.refunds).toBe(2); // 两次分 tick 击杀各触发一次
    expect(base.second).not.toBeNull();
    expect(base.second!).toBeLessThan(5); // 10s CD 被回 2×5s → 约 3.4s 放出第二轮
    const onceRun = await mk(true);
    expect(onceRun.refunds).toBe(1); // once 闩死
    expect(onceRun.second!).toBeCloseTo(5, 1); // 只回一次 5s → 第二轮 ≈5s
  });

  it('shield_broken(once)：本舰护盾被打破 → 下 tick 放全队盾且仅一次', async () => {
    const b = knobRig({
      attacker: { maxHp: 1000, attack: 100, ultimateEffectRef: 'eff_test_selfshield', ultimateCdSec: 10 },
      dummy: { attack: 300 },
      timeLimitSec: 6,
    });
    addRowFrom(b, 'battle_effect_param', 'eff_state_shield', 'eff_test_selfshield', {
      effectKind: 'ultimate', effectType: 'shield', stateTag: 'shield', durationSec: 10, targetingTag: 'self_team', maxTargets: 1, effectPower: 1, summonUnitRef: 'none',
    });
    const engine = await engineOf(b);
    const blocks: S7EffectBlock[] = [
      { kind: 'trigger', on: 'shield_broken', once: true, effectRef: 'eff_ult_shield_bubble' },
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
    // t0：自盾 200（max(1000×0.2,100×1)）→ 敌 300×0.8=240 打破；t0.2：shield_broken 触发放全队盾
    const bubble = ofType(r.log, 'ultimate_cast').filter((e) => e.effectRef === 'eff_ult_shield_bubble');
    expect(bubble.length).toBe(1);
    expect(bubble[0].timeSec).toBeCloseTo(0.2, 5);
  });

  it('attack_landed：普攻命中事件可重复触发', async () => {
    const b = knobRig({ timeLimitSec: 4 });
    addRowFrom(b, 'battle_effect_param', 'eff_basic_attack', 'eff_test_refund2', CD_REFUND_ROW);
    const engine = await engineOf(b);
    const blocks: S7EffectBlock[] = [
      { kind: 'trigger', on: 'attack_landed', effectRef: 'eff_test_refund2' },
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
    const refunds = ofType(r.log, 'ultimate_cast').filter((e) => e.effectType === 'cd_refund');
    expect(refunds.length).toBeGreaterThanOrEqual(2); // 每次普攻命中的下一 tick 都触发
  });

  it('stateChance：概率门产生"部分命中挂状态"（固定 seed 确定性）', async () => {
    const b = knobRig({ timeLimitSec: 12 });
    addRowFrom(b, 'battle_effect_param', 'eff_basic_attack', 'eff_test_chance_hit', {
      effectKind: 'normal_attack', effectType: 'basic_damage', effectPower: 1, targetingTag: 'single_target', maxTargets: 1, durationSec: 4, stateTag: 'vulnerable', stateChance: 0.5, summonUnitRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_test_attacker'), { normalEffectRef: 'eff_test_chance_hit' });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'chance-seed', playerUnits: ATK() });
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2').length;
    const applies = ofType(r.log, 'state_apply').filter((e) => e.stateTag === 'vulnerable').length;
    expect(hits).toBeGreaterThanOrEqual(10);
    expect(applies).toBeGreaterThan(0);
    expect(applies).toBeLessThan(hits); // 0<命中率<1：有挂上也有没挂上
  });
});

describe('⑥8a-D 召唤生命周期包', () => {
  const mkSummonEffect = (b: Bundle, overrides: Row): void => {
    addRowFrom(b, 'battle_effect_param', 'eff_state_summon', 'eff_test_summon', {
      effectKind: 'ultimate', effectType: 'summon', stateTag: 'summon', durationSec: 10,
      targetingTag: 'self_team', maxTargets: 2, summonUnitRef: 'bu_test_pet', ...overrides,
    });
  };
  const petRow = (b: Bundle): void => {
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_pet', {
      maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    });
  };

  it('summonExpireSec=3：召唤物 3 秒整点消亡', async () => {
    const b = knobRig({ attacker: { ultimateEffectRef: 'eff_test_summon', ultimateCdSec: 999 }, timeLimitSec: 6 });
    petRow(b);
    mkSummonEffect(b, { summonExpireSec: 3 });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    const petIds = new Set(r.finalState.players.filter((p) => p.unitStatRef === 'bu_test_pet').map((p) => p.unitId));
    expect(petIds.size).toBe(2);
    const downs = ofType(r.log, 'unit_down').filter((e) => petIds.has(e.actorId ?? ''));
    expect(downs.length).toBe(2);
    for (const d of downs) expect(d.timeSec).toBeCloseTo(3.0, 5);
  });

  it('despawnWithSource：召唤源阵亡当 tick 召唤物级联消亡', async () => {
    const b = knobRig({
      attacker: { maxHp: 1200, ultimateEffectRef: 'eff_test_summon', ultimateCdSec: 999 },
      dummy: { attack: 20000 }, // 20000×0.8=16000 > 1200：t0 一击带走召唤源
      timeLimitSec: 4,
    });
    petRow(b);
    mkSummonEffect(b, { despawnWithSource: true });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    const downs = ofType(r.log, 'unit_down');
    expect(downs.length).toBe(3); // 召唤源 + 2 召唤物同 tick
    for (const d of downs) expect(d.timeSec).toBeCloseTo(0, 5);
  });

  it('summonSourceCap=2：同源场上封顶；summonCapBonus 词条 +1 → 3', async () => {
    const mk = async (blocks?: S7EffectBlock[]) => {
      const b = knobRig({ attacker: { ultimateEffectRef: 'eff_test_summon', ultimateCdSec: 2 }, timeLimitSec: 8 });
      petRow(b);
      mkSummonEffect(b, { maxTargets: 3, summonSourceCap: 2 });
      const engine = await engineOf(b);
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
      return ofType(r.log, 'spawn_wave').filter((e) => e.note === 'effect_summon')
        .reduce((acc, e) => acc + (e.targetIds?.length ?? 0), 0);
    };
    expect(await mk()).toBe(2); // 多轮大招也只召到 cap
    expect(await mk([affix('summonCapBonus', 1)])).toBe(3);
  });
});

describe('⑥8a-E 目标族与空间AoE', () => {
  /** 双靶台：近靶 r1c0 + 远靶 r2c5，字段各自可调；返回首攻打的是近/远。 */
  async function firstTargetWith(tag: string, nearOverrides: Row, farOverrides: Row): Promise<'near' | 'far'> {
    const b = knobRig({
      dummy: { maxHp: 100000, attack: 1, ...nearOverrides },
      timeLimitSec: 4,
      extraSpawn: { rowId: 'spawn_test_far', unitRowId: 'bu_test_far', slot: 'r2c5' },
    });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_far', {
      maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, ...farOverrides,
    });
    const engine = await engineOf(b);
    const blocks: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: tag }];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
    const far = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_far')?.unitId;
    const first = r.log.find((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    return first?.targetIds?.[0] === far ? 'far' : 'near';
  }

  it('lowest_hp_enemy 打血最少（远靶血 500 被优先）', async () => {
    expect(await firstTargetWith('lowest_hp_enemy', { maxHp: 100000 }, { maxHp: 500 })).toBe('far');
  });
  it('highest_hp_enemy 打最肥', async () => {
    expect(await firstTargetWith('highest_hp_enemy', { maxHp: 90000 }, { maxHp: 100000 })).toBe('far');
  });
  it('highest_attack_enemy 掐最高攻', async () => {
    expect(await firstTargetWith('highest_attack_enemy', { attack: 5 }, { attack: 500 })).toBe('far');
  });
  it('highest_armor_enemy 啃最高防', async () => {
    expect(await firstTargetWith('highest_armor_enemy', { armor: 10 }, { armor: 90 })).toBe('far');
  });
  it('key_unit_first 优先关键 roleTag（治疗/召唤源）', async () => {
    expect(await firstTargetWith('key_unit_first', { roleTag: 'frontline' }, { roleTag: 'summon_source' })).toBe('far');
  });
  it('first_column_first 严格头列优先（近但列大让位）', async () => {
    // 近靶挪到 r1c1（距2·列1），远靶 r4c0（距4·列0）→ 头列 wins
    const b = knobRig({ dummy: { maxHp: 100000 }, timeLimitSec: 4, extraSpawn: { rowId: 'spawn_test_c0', unitRowId: 'bu_test_far', slot: 'r4c0' } });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_far', { maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { slotRefs: ['r1c1'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([{ kind: 'behavior', targetingTag: 'first_column_first' }]) });
    const far = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_far')?.unitId;
    const first = r.log.find((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(first?.targetIds?.[0]).toBe(far);
  });
  it('lock_until_dead 锁到死再换', async () => {
    // 近靶 240 血（80×3 整杀）+ 远靶大血：前 3 击全打近靶，第 4 击起换远靶
    const b = knobRig({ dummy: { maxHp: 240 }, timeLimitSec: 8, extraSpawn: { rowId: 'spawn_test_far2', unitRowId: 'bu_test_far', slot: 'r2c5' } });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_far', { maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9 });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([{ kind: 'behavior', targetingTag: 'lock_until_dead' }]) });
    const near = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_dummy')?.unitId;
    const far = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_far')?.unitId;
    const seq = r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2').map((e) => e.targetIds?.[0]);
    expect(seq.slice(0, 3)).toEqual([near, near, near]);
    expect(seq[3]).toBe(far);
  });

  it('lowhp_then_nearest：无残血时回退最近；出现残血(<30%)后转火', async () => {
    // 近靶大血 + 远靶 120 血：t0 大招(全体·96 伤)把远靶轰到 24/120=20%（近靶不掉档）
    // → 同 tick 步4 普攻按"残血优先"应舍近取远；对照组（默认 nearest）打近靶。
    const b = knobRig({
      attacker: { ultimateEffectRef: 'eff_ult_clear_barrage', ultimateCdSec: 10 },
      dummy: { maxHp: 100000 },
      timeLimitSec: 4,
      extraSpawn: { rowId: 'spawn_test_lowhp', unitRowId: 'bu_test_far', slot: 'r2c5' },
    });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_far', {
      maxHp: 120, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK([{ kind: 'behavior', targetingTag: 'lowhp_then_nearest' }]) });
    const far = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_far')?.unitId;
    const near = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_dummy')?.unitId;
    const first = r.log.find((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(first?.targetIds?.[0]).toBe(far); // 残血优先
    const ctrl = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
    const ctrlFirst = ctrl.log.find((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(ctrlFirst?.targetIds?.[0]).toBe(near); // 对照：默认最近打近靶（=回退分支的行为）
  });

  it('debuffed_first：带减益的敌人优先（辅助手先挂易伤到后排）', async () => {
    // 辅助手（backline_first·普攻挂 vulnerable）t0 先动打远靶挂减益 → 主攻手 debuffed_first 舍近取远。
    const b = knobRig({
      dummy: { maxHp: 100000 },
      timeLimitSec: 4,
      extraSpawn: { rowId: 'spawn_test_debuff', unitRowId: 'bu_test_far', slot: 'r2c5' },
    });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_far', {
      maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
    });
    addRowFrom(b, 'battle_effect_param', 'eff_basic_attack', 'eff_test_vuln_hit', {
      effectKind: 'normal_attack', effectType: 'basic_damage', effectPower: 1, targetingTag: 'single_target', maxTargets: 1, durationSec: 8, stateTag: 'vulnerable', summonUnitRef: 'none',
    });
    addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_test_support', {
      // 射程 99=事实无限：p0c0→r2c5 格距 10，射程 9 会把后排滤出普攻候选（=落数时全舰射程 99 的实证）
      maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 99,
      normalEffectRef: 'eff_test_vuln_hit', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
      targetingTag: 'backline_first',
    });
    const engine = await engineOf(b);
    const lineup: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_test_support', slotRef: 'p0c0' }, // p0c0 < p1c2：同 tick 先动
      { unitStatRef: 'bu_test_attacker', slotRef: 'p1c2', effectBlocks: [{ kind: 'behavior', targetingTag: 'debuffed_first' }] },
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: lineup });
    const far = r.finalState.enemies.find((e) => e.unitStatRef === 'bu_test_far')?.unitId;
    const first = r.log.find((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
    expect(first?.targetIds?.[0]).toBe(far); // 后排被挂易伤后，主攻手弃近打带减益者
  });

  it('durationPct（持久力场）：技能挂的状态时长 4s→6s', async () => {
    const b = knobRig({ attacker: { ultimateEffectRef: 'eff_test_vuln_nuke', ultimateCdSec: 20 }, timeLimitSec: 8 });
    addRowFrom(b, 'battle_effect_param', 'eff_ult_burst_nuke', 'eff_test_vuln_nuke', {
      effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1, targetingTag: 'single_target', maxTargets: 1, durationSec: 4, stateTag: 'vulnerable', summonUnitRef: 'none',
    });
    const engine = await engineOf(b);
    const span = async (blocks?: S7EffectBlock[]) => {
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK(blocks) });
      const applied = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'vulnerable');
      const expired = ofType(r.log, 'state_expire').find((e) => e.stateTag === 'vulnerable');
      return (expired?.timeSec ?? NaN) - (applied?.timeSec ?? NaN);
    };
    expect(await span()).toBeCloseTo(4.0, 5);
    expect(await span([affix('durationPct', 0.5)])).toBeCloseTo(6.0, 5);
  });

  it('cross_area/block_area：主目标+十字4格 vs 3×3（对角只进 block）', async () => {
    const mk = async (tag: string) => {
      const b = cloneBundle(loadBundle());
      addRowFrom(b, 'battle_unit_stat_param', 'bu_ship_vanguard', 'bu_test_attacker', {
        maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
        ultimateEffectRef: 'eff_test_area', ultimateCdSec: 10, coreEffectRef: 'none',
      });
      addRowFrom(b, 'battle_unit_stat_param', 'bu_enemy_swarm', 'bu_test_dummy', {
        maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9,
      });
      addRowFrom(b, 'battle_effect_param', 'eff_ult_clear_barrage', 'eff_test_area', {
        effectKind: 'ultimate', effectType: 'clear_barrage', effectPower: 1, targetingTag: tag, maxTargets: 9, durationSec: 0, stateTag: 'none', summonUnitRef: 'none',
      });
      Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
        spawnPlanRefs: ['spawn_n001_w1'], timeLimitSec: 4,
        enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_test_dummy'],
      });
      // 主目标 r1c0（p1c2 最近·距1）；十字=r0c0/r2c0/r1c1；对角=r0c1（只有 block 吃）
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
        unitStatRef: 'bu_test_dummy', count: 5, slotRefs: ['r1c0', 'r0c0', 'r2c0', 'r1c1', 'r0c1'], spawnDelaySec: 0,
      });
      const engine = await engineOf(b);
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: ATK() });
      const bySlot = new Map(r.finalState.enemies.map((e) => [e.slotRef, e.unitId]));
      const cast = ofType(r.log, 'ultimate_cast').find((e) => e.effectRef === 'eff_test_area');
      return { targets: new Set(cast?.targetIds ?? []), bySlot };
    };
    const cross = await mk('cross_area');
    expect(cross.targets.has(cross.bySlot.get('r1c0')!)).toBe(true);
    expect(cross.targets.has(cross.bySlot.get('r0c0')!)).toBe(true);
    expect(cross.targets.has(cross.bySlot.get('r2c0')!)).toBe(true);
    expect(cross.targets.has(cross.bySlot.get('r1c1')!)).toBe(true);
    expect(cross.targets.has(cross.bySlot.get('r0c1')!)).toBe(false); // 对角不进十字
    expect(cross.targets.size).toBe(4);
    const block = await mk('block_area');
    expect(block.targets.size).toBe(5); // 3×3 全吃（含对角）
    expect(block.targets.has(block.bySlot.get('r0c1')!)).toBe(true);
  });
});

describe('⑥8a-F 零回归哨兵', () => {
  it('确定性：旋钮场景同 seed 两跑结果一致', async () => {
    const b = knobRig({ dummy: { attack: 100 } });
    const engine = await engineOf(b);
    const blocks = [affix('lifesteal', 0.5), affix('dodgeRate', 0.3), affix('armorPen', 0.2)];
    const a = engine.run({ encounterRef: 'enc_n001', battleSeed: 'det', playerUnits: ATK(blocks) });
    const c = engine.run({ encounterRef: 'enc_n001', battleSeed: 'det', playerUnits: ATK(blocks) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });

  it('旧配置场景（enc_n001 样例阵容）：日志无任何 8a 新事件/新字段', async () => {
    const engine = await engineOf(loadBundle());
    const TRIO: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
      { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c2' },
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'seed-1', playerUnits: TRIO });
    for (const e of r.log) {
      expect(e.dodged).toBeUndefined();
      expect(['silence', 'control_immune'].includes(String(e.stateTag))).toBe(false);
      expect(e.effectType === 'cd_refund').toBe(false);
    }
  });
});
