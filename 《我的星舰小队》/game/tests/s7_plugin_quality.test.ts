// 块4a：插件运行时 + 品质制（精良/优秀/传奇）集成测试。
// 三层验证：① 解析器(pluginBlocks)按品质缩放数值、传奇额外加一条小效果(affix)；
//          ② 引擎里「装武器插件→每发伤害变高、传奇>优秀>精良」(带「不装=基线」对照，防假过)；
//          ③ 装配器 lineup.plugins → effectBlocks + 槽位/数量/同名/品质校验 + 与星核并存。
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
import { pluginBlocks, S7_PLUGIN_QUALITIES, S7PluginQuality } from '../assets/scripts/core/s7/S7PluginEffects';
import {
  S7BattleEncounterAssembler,
  S7BattleEncounterAssemblerError,
  S7BattleLineupUnitInput,
} from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7ModifierBlock, S7AffixBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

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
const assemblerOf = async (b: Bundle): Promise<S7BattleEncounterAssembler> => new S7BattleEncounterAssembler(await runtimeOf(b));
const progressAt = (nodeId: string): S7MainlineProgressState => ({ currentNodeId: nodeId, clearedNodeIds: [] });
function codeOf(fn: () => unknown): string {
  try { fn(); } catch (e) {
    if (e instanceof S7BattleEncounterAssemblerError) return e.code;
    return `unexpected:${(e as Error).message}`;
  }
  return 'no_throw';
}

// 隔离用 bundle：枪手只剩普攻(去大招/星核钩子)、攻击=1000 便于观察伤害差；敌人高血、零护甲、不还手。
function makeBundle(): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attackRangeCells: 7,
    maxHp: 1000000, armor: 500, attack: 1000,
    // ⑥第一段重定基：影刃行默认间隔 0.77s 与缩CD后的 0.60s 在 tick 0.2s 网格上同落 0.8s 步进
    // （攻击只在 tick 边界结算）→ 缩CD对照失去分辨力；夹具钉 interval=1.0 恢复可分辨前提。
    attackIntervalSec: 1.0,
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000000, attack: 1, armor: 1 });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
  return b;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await runtimeOf(b));
}
// 取玩家造成的第一发伤害数值。
function firstPlayerDamage(r: S7AutoBattleResult): number {
  const d = r.log.find((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
  if (!d) throw new Error('无玩家伤害日志');
  return d.amount as number;
}

describe('块4a 解析器 pluginBlocks：品质缩放 + 传奇额外效果', () => {
  it('精良武器插件 = 1 条加伤修正、无额外词条', () => {
    const blocks = pluginBlocks('plg02', 'weapon', 'fine');
    expect(blocks).toHaveLength(1);
    const m = blocks[0] as S7ModifierBlock;
    expect(m.kind).toBe('modifier');
    expect(m.stat).toBe('attack');
    expect(m.op).toBe('pct');
    expect(m.value).toBeGreaterThan(0);
  });

  it('优秀 > 精良、传奇 > 优秀（同槽位数值随品质递增）', () => {
    const v = (q: S7PluginQuality) => (pluginBlocks('plg02', 'weapon', q)[0] as S7ModifierBlock).value;
    expect(v('superior')).toBeGreaterThan(v('fine'));
    expect(v('legendary')).toBeGreaterThan(v('superior'));
  });

  it('传奇附加=可接线件才有（⑩A3 重定基：真源逐件制·灭群传奇=击杀触发、火力传奇=溅射挂牌无附加）', () => {
    // 旧断言=槽位占位口径'传奇必附 affix'；真源三档制下传奇附加按件而定：
    // plg19 灭群传奇=on_kill 缩CD触发件 ✓；plg02 火力传奇附加(暴击溅射)=M7 挂牌→无附加积木=正确。
    expect(pluginBlocks('plg19', 'weapon', 'fine').some((x) => x.kind === 'trigger')).toBe(false);
    expect(pluginBlocks('plg19', 'weapon', 'legendary').some((x) => x.kind === 'trigger')).toBe(true);
    expect(pluginBlocks('plg02', 'weapon', 'legendary').some((x) => x.kind === 'affix')).toBe(false);
  });

  it('冷却=skillHaste 词条、急速=负 pct 间隔修正、护盾=受伤词条（⑩A3 重定基：槽位占位→真源词条）', () => {
    // 旧断言=槽位通用占位（skill 槽必给 interval−）；真源：plg07 冷却=技能CD（skillHaste）、
    // plg10 急速=攻速（间隔负 pct）、plg01 护盾=受伤−（dmgTakenPct 负词条）。
    const haste = pluginBlocks('plg07', 'skill', 'fine')[0] as S7AffixBlock;
    expect([haste.kind, haste.affix]).toEqual(['affix', 'skillHaste']);
    const rapid = pluginBlocks('plg10', 'weapon', 'fine')[0] as S7ModifierBlock;
    expect([rapid.kind, rapid.stat]).toEqual(['modifier', 'attackIntervalSec']);
    expect(rapid.value).toBeLessThan(0);
    const shieldp = pluginBlocks('plg01', 'tactical', 'fine')[0] as S7AffixBlock;
    expect([shieldp.kind, shieldp.affix]).toEqual(['affix', 'dmgTakenPct']);
    expect(shieldp.value).toBeLessThan(0);
  });

  it('每个品质都被 S7_PLUGIN_QUALITIES 覆盖（无遗漏）', () => {
    expect([...S7_PLUGIN_QUALITIES].sort()).toEqual(['fine', 'legendary', 'superior']);
  });
});

describe('块4a 引擎：装武器插件 → 每发伤害变高（带对照防假过）', () => {
  it('精良/优秀/传奇武器插件下的首发伤害都 > 不装插件的基线，且传奇 > 优秀 > 精良', async () => {
    const dmg = async (blocks: ReturnType<typeof pluginBlocks> | null) => {
      const r = (await engineOf(makeBundle())).run({
        encounterRef: 'enc_n001', battleSeed: 'plg',
        playerUnits: [blocks
          ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
          : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
      });
      return firstPlayerDamage(r);
    };
    const base = await dmg(null);
    const fine = await dmg(pluginBlocks('plg02', 'weapon', 'fine'));
    const superior = await dmg(pluginBlocks('plg02', 'weapon', 'superior'));
    const legendary = await dmg(pluginBlocks('plg02', 'weapon', 'legendary'));
    expect(fine).toBeGreaterThan(base); // 装了就更高（接线真生效）
    expect(superior).toBeGreaterThan(fine);
    expect(legendary).toBeGreaterThan(superior); // 品质越高伤害越高
  });

  it('对照：技能(CD)槽插件 → 普攻间隔变短、单位时间内攻击次数更多（防假过）', async () => {
    const countAtks = async (blocks: ReturnType<typeof pluginBlocks> | null) => {
      const r = (await engineOf(makeBundle())).run({
        encounterRef: 'enc_n001', battleSeed: 'cd',
        playerUnits: [blocks
          ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: blocks }
          : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
      });
      return r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p0c2').length;
    };
    const base = await countAtks(null);
    // ⑩A3 重定基：'普攻提速'的真源载体=急速插件 plg10（plg07 冷却改管技能CD·本用例夹具无技能）。
    const hasted = await countAtks(pluginBlocks('plg10', 'weapon', 'legendary'));
    expect(hasted).toBeGreaterThan(base); // 攻速+30% → 同样时长内打更多发
  });
});

describe('块4a 装配器：lineup.plugins → effectBlocks + 校验', () => {
  it('lineup 带 1 个武器插件 → 该单位 effectBlocks 携带加伤修正', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'p', lineup: [
      { shipId: 'shp01', slotRef: 'p0c2', plugins: [{ pluginId: 'plg02', quality: 'superior' }] },
    ] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attack' && b.op === 'pct')).toBe(true);
  });

  it('对照：不带 plugins → 无 effectBlocks（防假过）', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'p', lineup: [{ shipId: 'shp01', slotRef: 'p0c2' }] });
    expect(out.request.playerUnits[0].effectBlocks).toBeUndefined();
  });

  it('3 个不同槽位插件全部装配（武器+技能+战术）', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'p', lineup: [
      { shipId: 'shp01', slotRef: 'p0c2', plugins: [
        { pluginId: 'plg02', quality: 'fine' },   // weapon
        { pluginId: 'plg07', quality: 'fine' },   // energy(技能/CD)
        { pluginId: 'plg01', quality: 'fine' },   // tactical
      ] },
    ] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    // ⑩A3 重定基：三槽真源词条=火力(attack 修正)+冷却(skillHaste 词条)+护盾(dmgTakenPct 词条)——
    // 旧断言的 interval/armor 修正=槽位占位口径已退役；'三槽全装配'语义原样（三件积木都到）。
    const stats = blocks.filter((b) => b.kind === 'modifier').map((b) => (b as S7ModifierBlock).stat);
    const affixes = blocks.filter((b) => b.kind === 'affix').map((b) => (b as unknown as { affix: string }).affix);
    expect(stats).toContain('attack');
    expect(affixes).toContain('skillHaste');
    expect(affixes).toContain('dmgTakenPct');
  });

  it('星核 + 插件并存：effectBlocks 同时含原子炮(action) 与 插件加伤(modifier)', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'p', lineup: [
      { shipId: 'shp01', slotRef: 'p0c2', coreId: 'core07', plugins: [{ pluginId: 'plg02', quality: 'fine' }] },
    ] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true);
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attack' && b.op === 'pct')).toBe(true);
  });

  it('超 3 / 未知 / 同名重复 / 同槽重复 / 品质非法 分别报对应错误', async () => {
    const asm = await assemblerOf(loadBundle());
    const p = progressAt('n001');
    const L = (plugins: { pluginId: string; quality: string }[]): S7BattleLineupUnitInput[] =>
      [{ shipId: 'shp01', slotRef: 'p0c2', plugins: plugins as { pluginId: string; quality: S7PluginQuality }[] }];
    // 4 个插件 → 超上限
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: L(
      ['plg01', 'plg02', 'plg03', 'plg04'].map((id) => ({ pluginId: id, quality: 'fine' })),
    ) }))).toBe('too_many_plugins');
    // 未知插件
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: L([{ pluginId: 'plg99', quality: 'fine' }]) }))).toBe('unknown_plugin');
    // 同名重复
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: L([
      { pluginId: 'plg02', quality: 'fine' }, { pluginId: 'plg02', quality: 'superior' },
    ]) }))).toBe('duplicate_plugin');
    // 同槽重复（plg02、plg04 都是 weapon）
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: L([
      { pluginId: 'plg02', quality: 'fine' }, { pluginId: 'plg04', quality: 'fine' },
    ]) }))).toBe('duplicate_plugin_slot');
    // 品质非法
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: L([{ pluginId: 'plg02', quality: 'epic' }]) }))).toBe('bad_plugin_quality');
  });
});
