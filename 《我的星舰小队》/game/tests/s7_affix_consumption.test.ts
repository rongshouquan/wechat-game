// 块4b-1：引擎消费定向词条（确定性纯乘子组）——对Boss加伤 / 对小怪加伤 / 治疗强度。
// 每条带「不装该词条=基线」对照防假过；并做「对Boss/对小怪」跨分支验证（装错对象不生效），证明 isBoss 分支路由正确。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock, S7AffixKey } from '../assets/scripts/core/s7/S7BattleEffectBlock';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const clone = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`缺 ${table}.${rowId}`);
  return r;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await runtimeOf(b));
}
const affix = (a: S7AffixKey, value: number): S7EffectBlock[] => [{ kind: 'affix', affix: a, value, source: 'test' }];

// 普攻枪手(攻=1000)打单个高血敌人；kind 控制目标是 小怪(非Boss) 还是 Boss。
// Boss 用工程现成的 bu_boss_n018（targetType=boss、unitRef=n018 合法），关掉它的大招避免干扰首发观察。
function dmgBundle(kind: 'enemy' | 'boss'): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attackRangeCells: 7,
    maxHp: 1000000, armor: 500, attack: 1000,
  });
  const enemyRef = kind === 'boss' ? 'bu_boss_n018' : 'bu_enemy_swarm';
  Object.assign(row(b, 'battle_unit_stat_param', enemyRef), {
    maxHp: 100000000, attack: 1, armor: 1, ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
  });
  // enemyUnitStatRefs 含 enemyRef + bu_enemy_swarm：后者是 spawn_n001_w2 行的引用，须在列内才过校验
  //（w2 不在 spawnPlanRefs，不会真刷；只 w1 刷出 1 个 enemyRef）。
  const refs = Array.from(new Set([enemyRef, 'bu_enemy_swarm']));
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: refs, spawnPlanRefs: ['spawn_n001_w1'] });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: enemyRef, count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
  return b;
}
function firstPlayerDamage(r: S7AutoBattleResult): number {
  const d = r.log.find((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
  if (!d) throw new Error('无玩家伤害日志');
  return d.amount as number;
}
async function dmgWith(enemyTargetType: 'enemy' | 'boss', blocks: S7EffectBlock[] | null): Promise<number> {
  const r = (await engineOf(dmgBundle(enemyTargetType))).run({
    encounterRef: 'enc_n001', battleSeed: 'aff',
    playerUnits: [blocks
      ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
      : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
  });
  return firstPlayerDamage(r);
}

describe('块4b-1 对小怪加伤 dmgVsSwarm', () => {
  it('打非Boss敌人：装 dmgVsSwarm → 首发伤害高于基线（约 ×1.5）', async () => {
    const base = await dmgWith('enemy', null);
    const boosted = await dmgWith('enemy', affix('dmgVsSwarm', 0.5));
    expect(boosted).toBeGreaterThan(base);
    expect(boosted).toBe(Math.round(base * 1.5));
  });

  it('跨分支防假过：dmgVsSwarm 对 Boss 不生效（Boss 目标仍是基线）', async () => {
    const base = await dmgWith('boss', null);
    const swarmAffixOnBoss = await dmgWith('boss', affix('dmgVsSwarm', 0.5));
    expect(swarmAffixOnBoss).toBe(base); // 目标是 Boss，对小怪词条不应加成
  });
});

describe('块4b-1 对Boss加伤 dmgVsBoss', () => {
  it('打Boss：装 dmgVsBoss → 首发伤害高于基线（约 ×1.5）', async () => {
    const base = await dmgWith('boss', null);
    const boosted = await dmgWith('boss', affix('dmgVsBoss', 0.5));
    expect(boosted).toBeGreaterThan(base);
    expect(boosted).toBe(Math.round(base * 1.5));
  });

  it('跨分支防假过：dmgVsBoss 对非Boss小怪不生效（小怪目标仍是基线）', async () => {
    const base = await dmgWith('enemy', null);
    const bossAffixOnSwarm = await dmgWith('enemy', affix('dmgVsBoss', 0.5));
    expect(bossAffixOnSwarm).toBe(base); // 目标是小怪，对Boss词条不应加成
  });
});

describe('块4b-1 治疗强度 healPower', () => {
  // 治疗枪手(repair_burst 大招, CD=2, 开局即放→t0满血回0、t2受伤后回正量)自奶；敌人高攻让其掉血但不死、回血不触顶。
  function healBundle(): Bundle {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      maxHp: 10000000, armor: 1, attack: 1000, attackRangeCells: 7,
      normalEffectRef: 'eff_basic_attack', ultimateEffectRef: 'eff_ult_repair_burst', ultimateCdSec: 2, coreEffectRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000000, attack: 200000, armor: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    return b;
  }
  async function firstPositiveHeal(blocks: S7EffectBlock[] | null): Promise<number> {
    const r = (await engineOf(healBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'heal',
      playerUnits: [blocks
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    const h = r.log.find((e) => e.type === 'heal' && e.actorId === 'player_p0c2' && (e.amount as number) > 0);
    if (!h) throw new Error('无正治疗量日志');
    return h.amount as number;
  }
  it('装 healPower → 治疗量高于基线（约 ×1.5），未装=基线', async () => {
    const base = await firstPositiveHeal(null);
    const ctrl = await firstPositiveHeal(affix('healPower', 0)); // 词条值0=应等于基线
    const boosted = await firstPositiveHeal(affix('healPower', 0.5));
    expect(ctrl).toBe(base);
    expect(boosted).toBeGreaterThan(base);
    expect(boosted).toBe(Math.round(base * 1.5));
  });
});
