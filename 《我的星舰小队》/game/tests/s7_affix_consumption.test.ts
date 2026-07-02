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
// Boss 用工程现成的 bu_boss_n084（targetType=boss、unitRef=n084 合法），关掉它的大招避免干扰首发观察。
function dmgBundle(kind: 'enemy' | 'boss'): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attackRangeCells: 7,
    maxHp: 1000000, armor: 500, attack: 1000,
  });
  const enemyRef = kind === 'boss' ? 'bu_boss_n084' : 'bu_enemy_swarm';
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

// ===== 块4b-2：要新约定的 3 类（暴击 / 控制抗性 / 技能急速）+ 破盾值 =====

describe('块4b-2 暴击 critRate/critDmg', () => {
  async function dmgEntry(blocks: S7EffectBlock[] | null): Promise<{ amount: number; crit: boolean }> {
    const r = (await engineOf(dmgBundle('enemy'))).run({
      encounterRef: 'enc_n001', battleSeed: 'crit',
      playerUnits: [blocks
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    const d = r.log.find((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
    if (!d) throw new Error('无伤害日志');
    return { amount: d.amount as number, crit: d.crit === true };
  }
  const crit = (rate: number, dmg: number): S7EffectBlock[] =>
    [{ kind: 'affix', affix: 'critRate', value: rate, source: 't' }, { kind: 'affix', affix: 'critDmg', value: dmg, source: 't' }];

  it('critRate=1 必暴 + critDmg=1 → 首发=基线×2 且日志 crit=true；无暴击词条=基线、无 crit 标记', async () => {
    const base = await dmgEntry(null);
    const c = await dmgEntry(crit(1, 1));
    expect(base.crit).toBe(false);          // 未装：不掷随机、不带 crit 字段
    expect(c.crit).toBe(true);              // critRate=1 必暴
    expect(c.amount).toBe(base.amount * 2); // critDmg=1 → ×2
  });

  it('防假过：critRate=0 但 critDmg 高 → 不触发(基线、无暴击标记)；critRate=1 但 critDmg=0 → 暴击但无加成(=基线)', async () => {
    const base = await dmgEntry(null);
    const noRoll = await dmgEntry(crit(0, 5)); // 概率0 → 短路不掷、不暴击
    expect(noRoll.crit).toBe(false);
    expect(noRoll.amount).toBe(base.amount);
    const zeroDmg = await dmgEntry(crit(1, 0)); // 必暴但暴伤+0
    expect(zeroDmg.crit).toBe(true);
    expect(zeroDmg.amount).toBe(base.amount);
  });
});

describe('块4b-2 破盾值 shieldBreak', () => {
  // 带盾敌人 bu_enemy_shield：开局自带 eff_state_shield(self_team) → t0 给自己上盾(盾量=maxHp*0.2，很大)；玩家普攻啃盾。
  function shieldBundle(): Bundle {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attackRangeCells: 7, maxHp: 1000000, armor: 500, attack: 1000,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_shield'), { maxHp: 100000000, attack: 1, armor: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_shield', 'bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_shield', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    return b;
  }
  async function firstHit(blocks: S7EffectBlock[] | null): Promise<{ shieldAfter: number; hpDmg: number }> {
    const r = (await engineOf(shieldBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'sb',
      playerUnits: [blocks
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    const d = r.log.find((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
    if (!d) throw new Error('无伤害日志');
    return { shieldAfter: d.shieldAfter as number, hpDmg: d.amount as number };
  }
  it('装 shieldBreak → 同一发啃掉更多护盾（shieldAfter 更低），未装=基线', async () => {
    const base = await firstHit(null);
    const broken = await firstHit(affix('shieldBreak', 0.5));
    expect(base.hpDmg).toBe(0);   // 盾够大 → 首发全被盾吸收
    expect(broken.hpDmg).toBe(0);
    expect(broken.shieldAfter).toBeLessThan(base.shieldAfter); // 破盾系数高 → 盾掉更多
  });
});

describe('块4b-2 控制抗性 controlResist', () => {
  // 敌人开局眩晕玩家(ult 改 eff_state_stun, single_target, 2s, CD10)；玩家高血、攻1(双方都不死→跑到超时)。
  function stunBundle(): Bundle {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      maxHp: 100000000, armor: 500, attack: 1, attackRangeCells: 7, ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), {
      maxHp: 100000000, attack: 1, armor: 1, ultimateEffectRef: 'eff_state_stun', ultimateCdSec: 10, coreEffectRef: 'none',
    });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    return b;
  }
  async function firstStunExpire(blocks: S7EffectBlock[] | null): Promise<number> {
    const r = (await engineOf(stunBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'cr',
      playerUnits: [blocks
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    const e = r.log.find((x) => x.type === 'state_expire' && x.actorId === 'player_p0c2' && x.stateTag === 'stun');
    if (!e) throw new Error('无玩家眩晕到期日志');
    return e.timeSec;
  }
  it('装 controlResist=0.5 → 眩晕到期更早（时长减半），未装=基线', async () => {
    const base = await firstStunExpire(null);
    const resisted = await firstStunExpire(affix('controlResist', 0.5));
    expect(resisted).toBeLessThan(base); // 抗性缩短控制时长 → 更早解除
  });
});

describe('块4b-2 技能急速 skillHaste', () => {
  // 玩家带 CD 大招(repair_burst 自奶,不伤敌不终战), CD10; 无普攻、高血→跑到超时，统计大招释放次数。
  function ultBundle(): Bundle {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      maxHp: 100000000, armor: 500, attack: 1, attackRangeCells: 7, normalEffectRef: 'none', ultimateEffectRef: 'eff_ult_repair_burst', ultimateCdSec: 10, coreEffectRef: 'none',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000000, attack: 1, armor: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    return b;
  }
  async function ultCasts(blocks: S7EffectBlock[] | null): Promise<number> {
    const r = (await engineOf(ultBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'sh',
      playerUnits: [blocks
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    return r.log.filter((e) => e.type === 'ultimate_cast' && e.actorId === 'player_p0c2').length;
  }
  it('装 skillHaste=1 → 大招 CD 减半、同场释放次数明显更多，未装=基线', async () => {
    const base = await ultCasts(null);
    const hasted = await ultCasts(affix('skillHaste', 1));
    expect(hasted).toBeGreaterThan(base);
  });
});
