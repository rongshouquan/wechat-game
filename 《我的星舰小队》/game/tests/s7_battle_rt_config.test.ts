// BATTLE-RT-03: S7 轻量实时自动战斗 5 张配置表 schema + 样例 fixture 测试。
// 覆盖：整盘校验通过、5 表行数、n001/n018/n075 装配契约、17 类 effectType 覆盖、
// 占格/格子/双向闭合/召唤上限/Boss 阶段等阻断规则。不实现战斗引擎。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateS7ConfigBundle } from '../assets/scripts/config/s7/ConfigValidatorS7';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

function readTable<T = Record<string, unknown>>(table: S7ConfigTableName): T[] {
  return JSON.parse(readFileSync(path.join(S7_DIR, `${table}.sample.json`), 'utf-8')) as T[];
}

function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const bundle = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) bundle[t] = readTable(t);
  return bundle;
}

function clone(b: Record<S7ConfigTableName, unknown[]>): Record<S7ConfigTableName, unknown[]> {
  return JSON.parse(JSON.stringify(b)) as Record<S7ConfigTableName, unknown[]>;
}

/** 取 battle 表某 rowId 行（mutable 引用，用于阻断用例制造非法数据）。 */
function rowOf(b: Record<S7ConfigTableName, unknown[]>, table: S7ConfigTableName, rowId: string): Record<string, unknown> {
  return (b[table] as Array<Record<string, unknown>>).find((r) => r.rowId === rowId)!;
}

const EFFECT_TYPES = [
  'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
  'shield_bubble', 'repair_burst', 'short_circuit_pulse', 'summon_drone',
  'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
];

describe('s7 battle-rt config tables (BATTLE-RT-03)', () => {
  it('validates the full 43-table plate including the 5 battle tables', () => {
    expect(validateS7ConfigBundle(loadBundle())).toEqual([]);
  });

  it('lands exactly the 5 new battle tables with first-round fixture rows', () => {
    expect(readTable('battle_unit_stat_param')).toHaveLength(17);
    expect(readTable('battle_effect_param')).toHaveLength(19); // 块3 新增 eff_atomic_cannon(过载核心原子炮)
    expect(readTable('battle_encounter_param')).toHaveLength(3);
    expect(readTable('battle_spawn_param')).toHaveLength(6);
    expect(readTable('battle_boss_phase_param')).toHaveLength(6);
  });

  it('covers all 17 RT-01 effect types', () => {
    const got = new Set(readTable<{ effectType: string }>('battle_effect_param').map((r) => r.effectType));
    for (const t of EFFECT_TYPES) expect(got.has(t)).toBe(true);
  });

  it('covers n001 (normal/t01/swarm), n018 (boss/t04/shield), n075 (boss/t10/berserk, pressure bp_n075)', () => {
    const enc = readTable<Record<string, unknown>>('battle_encounter_param');
    const n001 = enc.find((r) => r.nodeRef === 'n001')!;
    const n018 = enc.find((r) => r.nodeRef === 'n018')!;
    const n075 = enc.find((r) => r.nodeRef === 'n075')!;
    expect(n001.stageType).toBe('normal');
    expect(n001.templateRef).toBe('t01');
    expect(n001.problemTagRef).toBe('swarm');
    expect(n001.bossPhaseRefs).toEqual([]);
    expect(n018.stageType).toBe('boss');
    expect(n018.templateRef).toBe('t04');
    expect(n018.secondaryPressureTag).toBe('swarm_low');
    expect(n075.stageType).toBe('boss');
    expect(n075.templateRef).toBe('t10');
    expect(n075.problemTagRef).toBe('berserk');
    expect(n075.secondaryPressureTag).toBe('one_of_t03_t05_t08_t09');
    expect(n075.pressureRef).toBe('bp_n075');
  });

  it('keeps n075 boss pressure max at 14500 (existing pressure_param unchanged)', () => {
    const p = readTable<{ rowId: string; pressureMax: number }>('pressure_param').find((r) => r.rowId === 'bp_n075')!;
    expect(p.pressureMax).toBeLessThanOrEqual(14500);
    expect(p.pressureMax).toBe(14500);
  });

  it('keeps n075 boss summon at most 10 per phase, n018/n075 at most 3 unique phases', () => {
    const phases = readTable<{ bossNodeId: string; phaseTag: string; summonCountCap: number }>('battle_boss_phase_param');
    for (const r of phases) expect(r.summonCountCap).toBeLessThanOrEqual(10);
    for (const boss of ['n018', 'n075']) {
      const tags = phases.filter((r) => r.bossNodeId === boss).map((r) => r.phaseTag);
      expect(tags.length).toBeLessThanOrEqual(3);
      expect(new Set(tags).size).toBe(tags.length);
    }
  });
});

describe('s7 battle-rt validator blocks (BATTLE-RT-03)', () => {
  const hasErr = (b: Record<S7ConfigTableName, unknown[]>, table: string) =>
    validateS7ConfigBundle(b).some((e) => e.table === table);

  it('rejects count != slotRefs.length', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').count = 6;
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects an out-of-range grid slot', () => {
    const b = clone(loadBundle());
    (rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').slotRefs as string[])[0] = 'r5c0';
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a duplicate anchor slot in one spawn row', () => {
    const b = clone(loadBundle());
    (rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').slotRefs as string[])[1] = 'r0c0';
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a multi-cell footprint that overlaps', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_enemy_swarm').sizeCols = 2;
    const spawn = rowOf(b, 'battle_spawn_param', 'spawn_n001_w1');
    spawn.slotRefs = ['r0c0', 'r0c1']; // 2x1 footprints overlap at r0c1
    spawn.count = 2;
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a multi-cell footprint that goes out of bounds', () => {
    const b = clone(loadBundle());
    (rowOf(b, 'battle_spawn_param', 'spawn_n075_boss').slotRefs as string[])[0] = 'r0c5'; // 3x3 anchored at c5 -> c7
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn unitStatRef not in its encounter enemyUnitStatRefs', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').unitStatRef = 'bu_enemy_shield';
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn whose encounterRef breaks the encounter<->spawn closure', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').encounterRef = 'enc_n018';
    expect(validateS7ConfigBundle(b).length).toBeGreaterThan(0);
  });

  it('rejects an invalid unitRef for the unit target type', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_boss_n018').unitRef = 'n999';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects an effect ref that does not exist', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_ship_vanguard').ultimateEffectRef = 'eff_nonexistent';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects summonCountCap > 10', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_boss_phase_param', 'phase_n075_mid').summonCountCap = 11;
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects more than 3 phases for one boss', () => {
    const b = clone(loadBundle());
    (b.battle_boss_phase_param as Array<Record<string, unknown>>).push({
      schemaVersion: 's7-0.1.0', rowId: 'phase_n018_extra', bossNodeId: 'n018', phaseTag: 'mid',
      triggerType: 'time_elapsed_sec', triggerValue: 10, effectRefs: ['eff_ult_burst_nuke'],
      summonUnitRefs: [], summonCountCap: 0, note: 'x',
    });
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects an n075 encounter pressureRef other than bp_n075', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_encounter_param', 'enc_n075').pressureRef = 'bp_n018';
    expect(hasErr(b, 'battle_encounter_param')).toBe(true);
  });

  it('rejects a stageType that disagrees with the mainline node type derivation', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_encounter_param', 'enc_n001').stageType = 'boss';
    expect(hasErr(b, 'battle_encounter_param')).toBe(true);
  });

  it('rejects a state effect with zero duration', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_effect_param', 'eff_state_stun').durationSec = 0;
    expect(hasErr(b, 'battle_effect_param')).toBe(true);
  });

  it('rejects a powerIndex leaking into a battle table', () => {
    const b = clone(loadBundle());
    (rowOf(b, 'battle_unit_stat_param', 'bu_enemy_swarm') as Record<string, unknown>).powerIndex = 999;
    expect(validateS7ConfigBundle(b).some((e) => e.message.includes('powerIndex'))).toBe(true);
  });
});
