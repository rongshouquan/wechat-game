// ⑩A2 · 星核 16 颗接线验证（手推期望值 + 深坑核挂牌守卫）。
// 战斗级手推：战鼓/贪吃星/时光糖/超新星/小太阳/守护铃/星鲸；接线级：全表 id 扫描（9 可接+陨星弹 / 6 深坑=空）。
// 机制本体已由 ⑦⑨ 测试覆盖——本文件守"接线正确"（触发条件/效果行/参数=细表 §15/§18.3 v0）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { coreBlocks } from '../assets/scripts/core/s7/S7CoreEffects';
import { S7TriggerBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

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
/** 同 A1 试验台：玩家行攻125/防25（净伤100）+ 敌 A(r0c0)/B(r0c6)。带大招版给战鼓用。 */
function rig(opts: { enemyA: Row; enemyB?: Row; playerUlt?: { ref: string; cd: number } }): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: opts.playerUlt?.ref ?? 'none', ultimateCdSec: opts.playerUlt?.cd ?? 0, coreEffectRef: 'none',
    normalEffectRef: 'eff_basic_attack', attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125,
    attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), {
    maxHp: 100000000, attack: 1, armor: 25, sizeRows: 1, sizeCols: 1, attackIntervalSec: 1.0,
    attackRangeCells: 99, targetingTag: 'nearest_random_tie', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    ...opts.enemyA,
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), {
    maxHp: 100000000, attack: 1, armor: 25, sizeRows: 1, sizeCols: 1, attackIntervalSec: 1.0,
    attackRangeCells: 99, targetingTag: 'nearest_random_tie', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    ...(opts.enemyB ?? {}),
  });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_boss_add'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  return b;
}
const engineOf = async (b: Bundle): Promise<S7AutoBattleEngine> => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
const runWith = async (b: Bundle, coreId: string, seed = 'core') => {
  const engine = await engineOf(b);
  return engine.run({
    encounterRef: 'enc_n001', battleSeed: seed,
    playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1', effectBlocks: [...coreBlocks(coreId)] }],
  });
};
type Dmg = { source: string; target: string; amount: number; t: number; effectRef?: string };
function dmgEvents(log: S7AutoBattleLogEntry[]): Dmg[] {
  return log.filter((e) => e.type === 'damage').map((e) => ({
    source: e.actorId ?? '', target: (e.targetIds ?? [])[0] ?? '', amount: e.amount ?? NaN, t: e.timeSec, effectRef: e.effectRef,
  }));
}

describe('⑩A2-接线门扫描 · 16 核全表（9 接线+陨星弹 / 6 深坑挂牌=空）', () => {
  const trigOf = (coreId: string) => (coreBlocks(coreId).find((b) => b.kind === 'trigger') as S7TriggerBlock | undefined);
  it('9 新核触发条件与效果行逐点（§15/§18.3 v0）', () => {
    expect([trigOf('core08')!.on, trigOf('core08')!.cdSec, trigOf('core08')!.effectRef]).toEqual(['cd', 16, 'eff_core_sun']);
    expect([trigOf('core09')!.on, trigOf('core09')!.effectRef]).toEqual(['battle_start', 'eff_core_whale']);
    expect([trigOf('core10')!.on, trigOf('core10')!.threshold, trigOf('core10')!.once]).toEqual(['hp_below', 0.7, true]);
    expect([trigOf('core11')!.on, trigOf('core11')!.once, trigOf('core11')!.effectRef]).toEqual(['shield_broken', true, 'eff_core_supershield']);
    expect([trigOf('core12')!.on, trigOf('core12')!.effectRef]).toEqual(['skill_cast', 'eff_core_wardrum']);
    expect([trigOf('core13')!.on, trigOf('core13')!.effectRef]).toEqual(['on_kill', 'eff_core_gluttony']);
    expect([trigOf('core14')!.on, trigOf('core14')!.effectRef]).toEqual(['battle_start', 'eff_s7_guardianbell']);
    // 超新星=§18.3 实证终值 14s/×5.0（"20s/×4.0 常规战只赶尾声=毕业核不达档"·§15 行同步本批修）
    // 段5 重定基（旧→新→为什么对）：旧=四元组（恒速时代）；新+killCdReduceSec 1.5/killCdFloorSec 6
    // =A 案「连环引爆」接线（Ron 07-13 拍·星核真源 §4·仅超新星单核带减充字段）——守卫防回退恒速。
    expect([trigOf('core15')!.on, trigOf('core15')!.cdSec, trigOf('core15')!.initialCdSec, trigOf('core15')!.killCdReduceSec, trigOf('core15')!.killCdFloorSec, trigOf('core15')!.effectRef]).toEqual(['cd', 14, 14, 1.5, 6, 'eff_s7_supernova']);
    expect([trigOf('core16')!.on, trigOf('core16')!.effectRef]).toEqual(['on_kill', 'eff_core_firework']);
  });
  // 机制批③段一重定基（旧→新→为什么对）：旧断言=core17-22 挂牌返回空（⑨如实交回态守卫）；
  // 本批 6 深坑核全部接线（§15/§16d）→ 守卫翻面为"逐核返回真积木"（挂牌态解除·防回退到空壳）。
  it('6 深坑核（core17-22）=机制批③已接线（逐核积木形状）；未知 id 空；陨星弹原样', () => {
    expect([trigOf('core17')!.on, trigOf('core17')!.effectRef]).toEqual(['battle_start', 'eff_core_stargate']); // 曲率星门=开局一次
    const affixOf = (coreId: string, key: string) => coreBlocks(coreId).find((b) => b.kind === 'affix' && b.affix === key) as { value: number } | undefined;
    expect(affixOf('core18', 'dmgSplitFattestPct')!.value).toBe(0.25); // 共鸣音叉=分流25%
    expect(affixOf('core19', 'skillHitCurHpPct')!.value).toBe(0.08); // 引力阱=当前生命8%
    expect(affixOf('core19', 'skillHitCapAtkMult')!.value).toBe(5); // 引力阱上限=攻×5
    expect(coreBlocks('core20').some((b) => b.kind === 'action' && b.slot === 'normal' && b.effectRef === 'eff_core_prism')).toBe(true); // 棱镜=普攻改写
    expect(affixOf('core21', 'luckyOnCast')!.value).toBe(1); // 幸运扭蛋=放技能路由
    expect([trigOf('core22')!.on, trigOf('core22')!.cdSec, trigOf('core22')!.effectRef]).toEqual(['cd', 22, 'eff_core_hologram']); // 全息镜=周期分身
    expect(coreBlocks('core99'), 'core99 未知 id 应返回空').toHaveLength(0);
    expect(coreBlocks('core07').some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true);
  });
});

describe('⑩A2-战斗级手推 · 战鼓（skill_cast→全队增伤叠层）', () => {
  it('每放一次技能普攻 100→108→116（+8%/层·M3 叠层）', async () => {
    // 玩家带单体大招（burst_nuke ×2.2·CD4）+ 战鼓：放一次后普攻 108、放两次后 116。
    const b = rig({ enemyA: { maxHp: 100000000 }, playerUlt: { ref: 'eff_ult_burst_nuke', cd: 4 } });
    const r = await runWith(b, 'core12');
    const normals = dmgEvents(r.log).filter((d) => d.source === 'player_p1c1' && d.effectRef === 'eff_basic_attack').map((d) => d.amount);
    // cd 型大招开局即放（缺省 initialCd=0）→ 首普攻前已 1 层：档位=108/116/…/140，上限 5 层封顶。
    expect(normals).toContain(108); // 1 层
    expect(normals).toContain(116); // 2 层
    expect(normals).toContain(140); // 5 层=+40% 满层
    expect(Math.max(...normals)).toBe(140); // 上限 5 真封顶（M3 stateMaxStacks）
  });
});

describe('⑩A2-战斗级手推 · 贪吃星（击杀永久+3%基础攻·M9）', () => {
  it('杀 1 敌后普攻 100→103（+3% 基础攻·不复利）', async () => {
    const b = rig({ enemyA: { maxHp: 1, armor: 1, attack: 1 }, enemyB: { maxHp: 100000000 } });
    const r = await runWith(b, 'core13');
    const onB = dmgEvents(r.log).filter((d) => d.source === 'player_p1c1' && d.target === 'enemy_0001').map((d) => d.amount);
    expect(onB).toContain(103); // 125×1.03×0.8=103
    expect(onB).not.toContain(100); // 杀 A 在先·打 B 全程带累积
  });
});

describe('⑩A2-战斗级手推 · 时光糖（血量首次跌破70%→攻速+40%+急速·每场1）', () => {
  it('跌破 70% 后 atk_speed_up 与 skill_haste_up 双态上身（alsoApply 拼装）', async () => {
    // 敌攻 500（净400/发）：玩家 100 万血打不穿；改玩家血 1000 → 第二发跌破 70%。
    const b = rig({ enemyA: { attack: 500, maxHp: 100000000 } });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { maxHp: 1000 });
    const r = await runWith(b, 'core10');
    const states = r.log.filter((e) => e.type === 'state_apply' && e.actorId === 'player_p1c1').map((e) => e.stateTag);
    expect(states).toContain('atk_speed_up');
    expect(states).toContain('skill_haste_up');
  });
});

describe('⑩A2-战斗级手推 · 守护铃/超新星/小太阳/星鲸（开场免控·攒能爆发·周期AoE·召唤）', () => {
  it('守护铃：开场全队 control_immune 上身', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 100000000 } }), 'core14');
    const bell = r.log.find((e) => e.type === 'state_apply' && e.stateTag === 'control_immune' && e.timeSec <= 0.4);
    expect(bell).toBeTruthy();
  });
  it('超新星：t<14s 无全屏爆·首爆 ≈14s·单发=125×5×0.8=500', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 100000000 } }), 'core15');
    const nova = dmgEvents(r.log).filter((d) => d.source === 'player_p1c1' && d.amount === 500);
    expect(nova.length).toBeGreaterThan(0);
    expect(Math.min(...nova.map((d) => d.t))).toBeGreaterThanOrEqual(14);
  });
  // 机制批③段二重定基（旧→新→为什么对）：旧=第一拍"灼烧折进爆伤 ×3.6 一次性"（360=125×3.6×0.8）；
  // 本批完整版接真（§15 全语义）：3×3 灼烧 3s（攻×20%/s·无视防御）→ 锚点格延迟 3s 爆 ×3.0（直伤子结算·快照）。
  it('小太阳完整版：灼烧 25/s×3 跳 + 3s 后爆 375（125×3.0 快照直伤）', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 100000000 } }), 'core08');
    const burn = r.log.filter((e) => e.type === 'damage' && e.effectType === 'burn' && e.amount === 25); // 125×0.2=25·无视防御
    expect(burn.length).toBeGreaterThanOrEqual(3);
    const blast = r.log.filter((e) => e.type === 'damage' && e.effectRef === 'eff_core_sun_blast' && e.amount === 375);
    expect(blast.length).toBeGreaterThan(0);
    const firstApply = r.log.find((e) => e.type === 'state_apply' && e.stateTag === 'burn');
    expect((blast[0].timeSec ?? 0) - (firstApply?.timeSec ?? 0)).toBeCloseTo(3, 5); // 灼烧先上身·3s 后爆（延迟结算）
  });
  it('星鲸：开场召出 bu_s7_whale 入我方（限时 20s 生命周期包）', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 100000000 } }), 'core09');
    expect(r.finalState.players.some((u) => u.unitStatRef === 'bu_s7_whale' || u.unitId.includes('summon'))
      || r.log.some((e) => e.type === 'state_apply' && e.stateTag === 'summon')).toBe(true);
  });
});

describe('段5 · 超新星A案「连环引爆」（killCdReduceSec 1.5/killCdFloorSec 6 · 手推期望值）', () => {
  // 手推基准（rig 试验台）：gunner 攻125/敌防25=净伤100·普攻首拍 t=0 间隔 1.0s（nextAttackAt 初始 0）；
  // tick 0.2s；超新星 initialCd 14=恒速基线首爆 t=14.0；步序=triggers(3) 先于普攻(4)。
  // 爆点时刻=damage 事件 effectRef=eff_s7_supernova 按 timeSec 去重（1 亿血陪打靶恒在场吃爆）。
  const novaTimes = (log: S7AutoBattleLogEntry[]): number[] => {
    const ts = log.filter((e) => e.type === 'damage' && e.effectRef === 'eff_s7_supernova').map((e) => e.timeSec);
    return Array.from(new Set(ts)).sort((a, b) => a - b);
  };

  it('前拉：t=0 杀 1 敌 → 首爆 14.0→12.6（nextFireAt 12.5·tick 0.2 上取格点；恒速旧行为=14.0）', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 50 } }), 'core15'); // 50 血=净伤 100 一击死
    const t = novaTimes(r.log);
    expect(t.length).toBeGreaterThan(0);
    expect(t[0]).toBeCloseTo(12.6, 5); // 变异探针：注掉 accrueChargeKills A案分支 → 本断言红（14.0）
  });

  it('下限顶格+爆炸收割喂下一轮：8 脆皮 → 首爆 6.0（floor·无下限应 5.0）·第二爆 17.0（=20.0−2×1.5）', async () => {
    const b = rig({ enemyA: { maxHp: 50 } });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
      count: 8, slotRefs: ['r0c0', 'r1c0', 'r2c0', 'r3c0', 'r4c0', 'r0c1', 'r1c1', 'r2c1'], maxConcurrentOnField: 16,
    });
    // 同屏上限=场上存活敌总数 vs 本波 cap（processSpawnPlan）——w2 默认 cap 2 会被 w1 的 8 只挤丢（陪打靶缺席=战斗 6s 清场提前结束），双波齐覆 16。
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { maxConcurrentOnField: 16 });
    const r = await runWith(b, 'core15');
    const t = novaTimes(r.log);
    // 普攻 1 杀/s（t=0..5 共 6 杀）：14→12.5→11→9.5→8→6.5→pulled 5.0 触 floor(0+6)=6.0 → fire t=6.0 格点。
    expect(t[0]).toBeCloseTo(6.0, 5);
    // 首爆重臂 6.0+14=20.0；爆炸 500 收割余下 2 脆皮（+2 杀·fireTrigger 先重臂后施放=收割喂进下一轮）→ 17.0。
    expect(t[1]).toBeCloseTo(17.0, 5);
    // 此后无击杀（只剩 1 亿血陪打靶）→ 第三爆 17.0+14=31.0（前拉不跨轮残留·轮语义干净）。
    expect(t[2]).toBeCloseTo(31.0, 5);
  });

  it('击杀者口径：队友杀不喂——僚舰清兵·装核舰不出手 → 首爆恒速 14.0', async () => {
    const b = rig({ enemyA: { maxHp: 50 } });
    (row(b, 'battle_unit_stat_param', 'bu_ship_gunner') as Row).normalEffectRef = 'none'; // 装核舰零击杀
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), {
      normalEffectRef: 'eff_basic_attack', attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125,
      attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie', ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'a-mate',
      playerUnits: [
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1', effectBlocks: [...coreBlocks('core15')] },
        { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c1' },
      ],
    });
    expect(novaTimes(r.log)[0]).toBeCloseTo(14.0, 5);
  });

  it('单核例外：无字段 cd 核（core08 小太阳）在同款击杀流下节奏不变（burn 上身 t=0 与 16.0）', async () => {
    const r = await runWith(rig({ enemyA: { maxHp: 50 } }), 'core08'); // gunner t=0 杀敌照旧
    const casts = Array.from(new Set(r.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'burn').map((e) => e.timeSec))).sort((a, b) => a - b);
    expect(casts[0]).toBeCloseTo(0, 5);
    expect(casts[1]).toBeCloseTo(16.0, 5); // 击杀若误喂无字段块=此值 <16（"仅超新星单核"守卫）
  });

  it('下限对全前拉源生效：A案+cd_refund（灭群/CDR 通道）双叠 → 轮长仍 ≥6（旁通道不得穿底）', async () => {
    // 真源"下次充能时间下限 6s"=轮长本体口径——cd_refund 旧 clamp 只到 this.time，双通道叠加
    // （1.5+2.5=4s/杀）可把轮打到即刻连爆=绕底；floor 武装后任何前拉源都触底停。
    const b = rig({ enemyA: { maxHp: 50 } });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
      count: 8, slotRefs: ['r0c0', 'r1c0', 'r2c0', 'r3c0', 'r4c0', 'r0c1', 'r1c1', 'r2c1'], maxConcurrentOnField: 16,
    });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { maxConcurrentOnField: 16 });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'floor-all',
      playerUnits: [{
        unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1',
        effectBlocks: [...coreBlocks('core15'), { kind: 'trigger', on: 'on_kill', effectRef: 'eff_pil_cdr_25', source: 'test_cdr' }],
      }],
    });
    const t = novaTimes(r.log);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t[0]).toBeGreaterThanOrEqual(6 - 1e-6); // 首轮触底停（变异探针：撤 cd_refund 的 floor 分支→<6 红）
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(6 - 1e-6); // 每轮 ≥6
  });

  it('环境杀不喂（零击杀归因链继承）：潮杀脆皮·装核舰不出手 → 首爆恒速 14.0', async () => {
    const b = rig({ enemyA: { maxHp: 50 } });
    (row(b, 'battle_unit_stat_param', 'bu_ship_gunner') as Row).normalEffectRef = 'none';
    (row(b, 'battle_encounter_param', 'enc_n001') as Row).environmentBlocks = [
      { on: 'battle_start', effectRef: 'eff_pollution_tide', side: 'enemy', attack: 100 }, // ×0.8=80 伤·t=0 杀 50 血脆皮
    ];
    const r = await runWith(b, 'core15');
    expect(r.log.find((e) => e.type === 'damage' && e.actorId === 'environment' && e.hpAfter === 0)).toBeTruthy(); // 环境击杀确实发生
    expect(novaTimes(r.log)[0]).toBeCloseTo(14.0, 5);
  });
});
