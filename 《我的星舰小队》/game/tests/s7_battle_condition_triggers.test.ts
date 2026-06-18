// 块2b：条件型/事件型触发（on_kill / on_hit / ally_down）的引擎集成测试。
// 触发的技能统一用 eff_ult_shield_bubble（自盾、可观察、无需敌方目标）；被测单位均去掉自带大招以隔离。
// 事件型有 1 tick 延迟（事件在 dealDamage 采集、下个 tick 的 stepTriggers 评估），故断言"触发时刻 > 0/>= 阵亡时刻"。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry, S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;
const TRIG = 'eff_state_shield'; // 触发后释放的可观察"纯自盾"技能（self_team、0 伤害，不会误伤/清场干扰测试）

function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
function clone(b: Bundle): Bundle {
  return JSON.parse(JSON.stringify(b)) as Bundle;
}
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`缺 ${table}.${rowId}`);
  return r;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}
function trigCasts(log: S7AutoBattleLogEntry[], actorId: string): S7AutoBattleLogEntry[] {
  return log.filter((e) => e.type === 'ultimate_cast' && e.effectRef === TRIG && e.actorId === actorId);
}

describe('块2b on_kill 触发', () => {
  // 枪手秒杀近处小怪触发 on_kill；另置一只高血盾怪让战斗在击杀后继续（否则同 tick 清场提前结束、来不及触发）。
  function setup(b: Bundle): void {
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attack: 500, attackRangeCells: 7 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100, attack: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_shield'), { maxHp: 1000000, attack: 1, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_shield'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_shield', count: 1, slotRefs: ['r0c1'], spawnDelaySec: 0 });
  }

  it('击杀后触发 on_kill 技能（且非开局即放：开局尚无击杀）', async () => {
    const b = clone(loadBundle());
    setup(b);
    const blocks: S7EffectBlock[] = [{ kind: 'trigger', on: 'on_kill', effectRef: TRIG }];
    const r: S7AutoBattleResult = (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }] });
    const casts = trigCasts(r.log, 'player_p0c2');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(casts[0].timeSec).toBeGreaterThan(0);
  });

  it('对照：不带 on_kill 积木则不触发该技能（防假过）', async () => {
    const b = clone(loadBundle());
    setup(b);
    const r: S7AutoBattleResult = (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'k', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    expect(trigCasts(r.log, 'player_p0c2').length).toBe(0);
  });

  it('多次击杀可重复触发 on_kill（证明可重复、非一次性 latch）', async () => {
    const b = clone(loadBundle());
    // 枪手逐个秒杀 5 只小怪（每秒一发普攻杀一只）；on_kill 应随每次击杀重复触发。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attack: 500, attackRangeCells: 7, attackIntervalSec: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 5, slotRefs: ['r0c0', 'r0c1', 'r0c2', 'r0c3', 'r0c4'], spawnDelaySec: 0, maxConcurrentOnField: 5 });
    const blocks: S7EffectBlock[] = [{ kind: 'trigger', on: 'on_kill', effectRef: TRIG }];
    const r: S7AutoBattleResult = (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'kk', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }] });
    expect(trigCasts(r.log, 'player_p0c2').length).toBeGreaterThanOrEqual(2); // 多次击杀→多次触发（每秒一杀，逐次触发）
  });
});

describe('块2b on_hit 触发', () => {
  it('受击后触发 on_hit 技能（且非开局即放）', async () => {
    const b = clone(loadBundle());
    // 坦克放后排 range1 够不到远敌→不普攻不击杀、无自带大招；远程敌每隔一段打它。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_guardian'), { ultimateEffectRef: 'none', ultimateCdSec: 0, maxHp: 1000000, armor: 200, attackRangeCells: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 1000000, attack: 10, attackRangeCells: 9 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c6'] });
    const blocks: S7EffectBlock[] = [{ kind: 'trigger', on: 'on_hit', effectRef: TRIG }];
    const r: S7AutoBattleResult = (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'h', playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0', effectBlocks: blocks }] });
    const casts = trigCasts(r.log, 'player_p0c0');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(casts[0].timeSec).toBeGreaterThan(0);
  });

  it('对照：不带 on_hit 积木则不触发该技能（防假过）', async () => {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_guardian'), { ultimateEffectRef: 'none', ultimateCdSec: 0, maxHp: 1000000, armor: 200, attackRangeCells: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 1000000, attack: 10, attackRangeCells: 9 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c6'] });
    const r: S7AutoBattleResult = (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'h', playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }] });
    expect(trigCasts(r.log, 'player_p0c0').length).toBe(0);
  });
});

describe('块2b ally_down 触发', () => {
  it('己方阵亡达阈值后触发一次 ally_down 技能', async () => {
    const b = clone(loadBundle());
    // 牺牲位(1血,靠前被秒) + 观察位(坦克,带 ally_down 阈值1)；远程敌先打最近的牺牲位。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { maxHp: 1, armor: 1, attackRangeCells: 1, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_guardian'), { maxHp: 1000000, armor: 500, attackRangeCells: 1, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 1000000, attack: 50, attackRangeCells: 9 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
    const blocks: S7EffectBlock[] = [{ kind: 'trigger', on: 'ally_down', threshold: 1, effectRef: TRIG }];
    const r: S7AutoBattleResult = (await engineOf(b)).run({
      encounterRef: 'enc_n001', battleSeed: 'a',
      playerUnits: [
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }, // 牺牲位（最近，被秒）
        { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c0', effectBlocks: blocks }, // 观察位
      ],
    });
    const down = r.log.find((e) => e.type === 'unit_down' && e.actorId === 'player_p0c2');
    expect(down).toBeDefined(); // 牺牲位阵亡
    const casts = trigCasts(r.log, 'player_p2c0');
    expect(casts.length).toBeGreaterThanOrEqual(1);
    expect(casts[0].timeSec).toBeGreaterThanOrEqual(down!.timeSec); // 阵亡后才触发
  });
});
