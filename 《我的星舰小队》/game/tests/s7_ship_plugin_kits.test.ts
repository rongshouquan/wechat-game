// ⑩A3 · 舰技能/插件残项接线验证（手推期望值·§11/§12/§14 v0 + 插件真源三档）。
// 战斗级手推：张盾/怒吼/冲锋号/贯日燃烧/淬针/号角旗普攻/净化模块/回充/援护/自愈；
// 接线级：插件 30 件三档逐点 + 挂牌件=空 + 舰行通道形状。机制本体已由 ⑦⑨ 覆盖——守"接线正确"。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { pluginBlocks } from '../assets/scripts/core/s7/S7PluginEffects';
import { S7AffixBlock, S7ModifierBlock, S7TriggerBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

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
/** 试验台：单敌 A(r0c0·海量血/攻1/防25) + 惰性假人 B(r0c6)；我方单位行由用例覆写。 */
function rig(over: { enemyA?: Row } = {}): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), {
    maxHp: 100000000, attack: 1, armor: 25, sizeRows: 1, sizeCols: 1, attackIntervalSec: 1.0,
    attackRangeCells: 99, targetingTag: 'nearest_random_tie', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    extraTriggerBlocks: undefined, stackRules: undefined, roleTag: 'swarm',
    ...(over.enemyA ?? {}),
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), {
    maxHp: 100000000, attack: 1, armor: 25, sizeRows: 1, sizeCols: 1, attackIntervalSec: 1.0,
    attackRangeCells: 99, targetingTag: 'nearest_random_tie', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
  });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_boss_add'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  return b;
}
const engineOf = async (b: Bundle): Promise<S7AutoBattleEngine> => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
type Dmg = { source: string; target: string; amount: number; t: number; effectRef?: string; periodic?: boolean };
const dmg = (log: S7AutoBattleLogEntry[]): Dmg[] => log.filter((e) => e.type === 'damage').map((e) => ({
  source: e.actorId ?? '', target: (e.targetIds ?? [])[0] ?? '', amount: e.amount ?? NaN, t: e.timeSec, effectRef: e.effectRef, periodic: e.periodic,
}));

describe('⑩A3-舰装备面 · 战斗级手推（§11/§12 v0）', () => {
  it('磐石张盾：放盾窗口内敌 100 伤 → 60（−40%·4s·CD12 自动放）', async () => {
    const b = rig({ enemyA: { attack: 125, maxHp: 100000000 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'zd',
      playerUnits: [{ unitStatRef: 'bu_ship_static_disruptor', slotRef: 'p1c1' }],
    });
    // 磐石真甲 40（§12 原值·未覆写）：净伤基线=125×100/140≈89.3；力场光环常驻 −15% → 76；张盾+力场窗口 ×0.45 → 40。
    const onTank = dmg(r.log).filter((d) => d.source === 'enemy_0000' && d.target === 'player_p1c1' && !d.periodic).map((d) => d.amount);
    expect(onTank).toContain(76); // 力场常驻（M6 光环·battle_start 接线）：89.3×0.85
    expect(onTank).toContain(40); // 张盾+力场叠加窗口（M1 减伤轴相加）：89.3×0.45
  });
  it('铁壁怒吼：3×3 嘲讽把点名敌拉向自己 + 放吼窗口自减伤 −30%（skill_cast 拼装）', async () => {
    const b = rig({ enemyA: { attack: 125, targetingTag: 'backline_first', maxHp: 100000000 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'nh',
      playerUnits: [
        { unitStatRef: 'bu_ship_oasis_repair', slotRef: 'p2c2' }, // 铁壁前排
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' },       // 后排诱饵
      ],
    });
    const first = dmg(r.log).find((d) => d.source === 'enemy_0000');
    expect(first?.target).toBe('player_p2c2'); // 怒吼嘲讽（CD10 开局即放·覆盖 backline_first）
    const onWall = dmg(r.log).filter((d) => d.source === 'enemy_0000' && d.target === 'player_p2c2').map((d) => d.amount);
    expect(onWall).toContain(60); // 怒吼窗口：铁壁真甲45→净伤86.2×0.7≈60（skill_cast 第二件真拼上）
  });
  it('号角三件：普攻旗=友军增伤+10%·冲锋号=全队+30% 窗口·催进=攻速光环（6s 攻击数†）', async () => {
    const b = rig({ enemyA: { maxHp: 100000000 } });
    // 号角行攻低（§12 28）：换成测试值 125 便于手推旗/号数值。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_shp14'), { attack: 125, armor: 25, maxHp: 1000000, attackIntervalSec: 1.0 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
      attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'hj',
      playerUnits: [
        { unitStatRef: 'bu_ship_shp14', slotRef: 'p1c0' },  // 号角（旗打最残友军=gunner 被打后）
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' }, // 主输出（前排吃火）
      ],
    });
    const hits = dmg(r.log).filter((d) => d.source === 'player_p1c2').map((d) => d.amount);
    // 冲锋号开局即放（cd 型缺省 t0）且旗每秒补挂 → 窗口=143（125×1.3×1.1×0.8）、窗后=110（旗常态）——号+旗必然叠加、无纯 130 档。
    expect(hits).toContain(143); // 冲锋号+旗叠加窗口（开局即放）
    expect(hits).toContain(110); // 窗口外旗常态（每秒补挂=常驻 +10%）
  });
  it('贯日灼烧射线：普攻附燃烧——周期伤=攻×8%（无视防御·4s 跳 4 次）', async () => {
    const b = rig({ enemyA: { maxHp: 100000000 } });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_blackshield_escort'), { attack: 125, armor: 25, maxHp: 1000000, attackIntervalSec: 1.0, attackRangeCells: 99 });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'gr',
      playerUnits: [{ unitStatRef: 'bu_ship_blackshield_escort', slotRef: 'p1c1' }],
    });
    const burns = dmg(r.log).filter((d) => d.source === 'player_p1c1' && d.periodic).map((d) => d.amount);
    expect(burns.length).toBeGreaterThan(0);
    expect(burns[0]).toBe(10); // 125×0.08=10（燃烧无视防御=M2 口径·§11 8%/s）
  });
  it('蜂针淬针：普攻叠易伤——第二发起 100→125（+25%·M1 参数版易伤）', async () => {
    const b = rig({ enemyA: { maxHp: 100000000 } });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_fireworks_cruiser'), { attack: 125, armor: 25, maxHp: 1000000, attackIntervalSec: 1.0, attackRangeCells: 99, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'cz',
      playerUnits: [{ unitStatRef: 'bu_ship_fireworks_cruiser', slotRef: 'p1c1' }],
    });
    const hits = dmg(r.log).filter((d) => d.source === 'player_p1c1' && !d.periodic).map((d) => d.amount);
    expect(hits[0]).toBe(100); // 首发上易伤（先结伤后挂态）
    expect(hits).toContain(125); // 后续吃 25% 易伤
  });
});

describe('⑩A3-插件面 · 战斗级手推（插件真源三档）', () => {
  const withPlugins = async (plugins: Array<{ pluginId: string; quality: 'fine' | 'superior' | 'legendary' }>, enemyA: Row = { maxHp: 100000000 }) => {
    const b = rig({ enemyA });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      ultimateEffectRef: 'eff_ult_burst_nuke', ultimateCdSec: 6, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
      attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
    });
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(b));
    const { S7BattleEncounterAssembler } = await import('../assets/scripts/core/s7/S7BattleEncounterAssembler');
    const asm = new S7BattleEncounterAssembler(runtime);
    const out = asm.assemble({
      progress: { currentNodeId: 'n001', clearedNodeIds: [] }, runSeed: 'plg',
      lineup: [{ shipId: 'shp02', slotRef: 'p1c1', pilotId: 'pil02', plugins }],
    });
    const engine = new S7AutoBattleEngine(runtime);
    return engine.run(out.request);
  };
  it('回充插件（attack_landed→cd_refund）：带传奇回充的大招次数 > 不带（CD6·1.4s/命中）', async () => {
    const base = await withPlugins([]);
    const charged = await withPlugins([{ pluginId: 'plg24', quality: 'legendary' }]);
    const ults = (r: Awaited<ReturnType<typeof withPlugins>>) => r.log.filter((e) => e.type === 'ultimate_cast' && e.actorId === 'player_p1c1' && e.effectRef === 'eff_ult_burst_nuke').length;
    expect(ults(charged)).toBeGreaterThan(ults(base));
  });
  it('净化模块（cd8 周期自清）：敌挂的持续减益被周期清除（清后再挨打再清）', async () => {
    // 敌普攻带易伤 rider（复用蜂针淬针行）→ 我方持续被挂 dmg_taken_up；净化模块周期清。
    const r = await withPlugins([{ pluginId: 'plg14', quality: 'fine' }], { maxHp: 100000000, attack: 50, normalEffectRef: 'eff_s7_normal_cuizhen' });
    const dispels = r.log.filter((e) => e.type === 'state_dispel' && e.actorId === 'player_p1c1');
    expect(dispels.length).toBeGreaterThan(0); // 周期净化真在转（M5 purify·cd 装配=任务单 A3 点名件）
  });
  it('援护插件（M4 share·adjacent）：两船相邻各带援护=互摊——受击者只承 90%、邻船承 10%（精良）', async () => {
    const b = rig({ enemyA: { attack: 125, maxHp: 100000000 } });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
      attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), {
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
      attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
    });
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(b));
    const { S7BattleEncounterAssembler } = await import('../assets/scripts/core/s7/S7BattleEncounterAssembler');
    const asm = new S7BattleEncounterAssembler(runtime);
    const out = asm.assemble({
      progress: { currentNodeId: 'n001', clearedNodeIds: [] }, runSeed: 'sh',
      lineup: [
        { shipId: 'shp01', slotRef: 'p1c1', pilotId: 'pil01', plugins: [{ pluginId: 'plg16', quality: 'fine' }] },
        { shipId: 'shp02', slotRef: 'p1c0', pilotId: 'pil02', plugins: [{ pluginId: 'plg16', quality: 'fine' }] },
      ],
    });
    const engine = new S7AutoBattleEngine(runtime);
    const r = engine.run(out.request);
    const onFront = dmg(r.log).filter((d) => d.source === 'enemy_0000' && d.target === 'player_p1c1').map((d) => d.amount);
    expect(onFront).toContain(90); // 100×(1−.10) 自承（M4 share·相邻互摊）
  });
  it('自愈插件：battle_start 长时限 regen——周期回血跳点=最大生命 0.5%（精良）', async () => {
    const r = await withPlugins([{ pluginId: 'plg12', quality: 'fine' }], { maxHp: 100000000, attack: 7000 }); // 净火 5600/s > 跳量 5000 ⇒ 缺口持续存在、跳点满额
    const heals = r.log.filter((e) => e.type === 'heal' && e.actorId === 'player_p1c1' && e.periodic);
    expect(heals.length).toBeGreaterThan(0);
    expect(heals.some((e) => e.amount === 5000)).toBe(true); // 1,000,000×0.5% 满额跳（缺口>跳量时·M2 maxHpPct 通道·回血封顶最大血口径）
  });
});

describe('⑩A3-接线门扫描 · 插件 30 件三档逐点（真源保形）', () => {
  const affixOf = (id: string, q: 'fine' | 'superior' | 'legendary', key: string) =>
    (pluginBlocks(id, 'weapon', q).find((b) => b.kind === 'affix' && (b as S7AffixBlock).affix === key) as S7AffixBlock | undefined)?.value;
  const modOf = (id: string, q: 'fine' | 'superior' | 'legendary') =>
    (pluginBlocks(id, 'weapon', q).find((b) => b.kind === 'modifier') as S7ModifierBlock | undefined)?.value;
  it('数值词条件三档逐点（火力/舰体/冷却/急速/增效/持久…）', () => {
    expect([modOf('plg02', 'fine'), modOf('plg02', 'superior'), modOf('plg02', 'legendary')]).toEqual([0.08, 0.18, 0.35]);
    expect([modOf('plg05', 'fine'), modOf('plg05', 'legendary')]).toEqual([0.10, 0.40]);
    expect(affixOf('plg07', 'legendary', 'skillHaste')).toBe(0.333333); // CD−25% ⇒ haste=r/(1−r)
    expect(modOf('plg10', 'legendary')).toBe(-0.230769); // 攻速+30% ⇒ 间隔 ×1/1.3
    expect(affixOf('plg26', 'legendary', 'effectAmp')).toBe(0.55); // 传奇附加=再+一档（§14 40→55）
    expect(affixOf('plg29', 'legendary', 'durationPct')).toBe(0.70); // 传奇附加=再延长（§14 50→70）
    expect(affixOf('plg23', 'superior', 'lifesteal')).toBe(0.06);
    expect(affixOf('plg15', 'legendary', 'dodgeRate')).toBe(0.25); // ⑩三段流派扶正 8/15/25（闪避坦成型·§14 记档）
    expect(affixOf('plg01', 'legendary', 'dmgTakenPct')).toBe(-0.25);
  });
  it('触发件形状：灭群传奇=on_kill+小怪过滤·回充=attack_landed·净化传奇=双触发 4.8s', () => {
    const mq = pluginBlocks('plg19', 'weapon', 'legendary');
    const trig = mq.find((b) => b.kind === 'trigger') as S7TriggerBlock;
    expect(trig.on).toBe('on_kill');
    expect(trig.onKillRoleTags).toEqual(['swarm', 'swarm_tough']);
    expect(pluginBlocks('plg19', 'weapon', 'superior').some((b) => b.kind === 'trigger')).toBe(false); // 传奇专属
    expect((pluginBlocks('plg24', 'skill', 'fine').find((b) => b.kind === 'trigger') as S7TriggerBlock).effectRef).toBe('eff_plg_cdr_02');
    const purifyLeg = pluginBlocks('plg14', 'tactical', 'legendary').filter((b) => b.kind === 'trigger') as S7TriggerBlock[];
    expect(purifyLeg).toHaveLength(2); // 净化+免疫双触发
    expect(purifyLeg.every((t) => t.cdSec === 4.8)).toBe(true); // 传奇更勤（8→4.8=−40%）
  });
  it('基础无载体件=空积木挂牌（散射/充能/过载/连发/引爆/循环/余震/保命）', () => {
    for (const id of ['plg21', 'plg22', 'plg13', 'plg18', 'plg25', 'plg27', 'plg28', 'plg30']) {
      expect(pluginBlocks(id, 'weapon', 'legendary'), `${id} 应挂牌返回空`).toHaveLength(0);
    }
  });
});
