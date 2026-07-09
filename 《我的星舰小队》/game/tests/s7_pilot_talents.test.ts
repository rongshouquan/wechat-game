// ⑩A1 · 驾驶员 20 天赋接线验证（手推期望值 + 级/星门 + 方向匹配门）。
// 分三层：① 战斗级手推（蛰/砺/岩/源/骁 五个代表机制族——数值由 §13 v0 手推）；
//        ② 接线门扫描（级门取对档效果行/参数·星门开质变·Lv0 缺省无天赋=回执⑤）；
//        ③ 方向匹配门（deriveUnit：行为 tag 方向与舰行基础 tag 不一致=忽略=真源§0"自然失效"）。
// 机制本体（taunt/guard/reflect/stack/aura…）已由 ⑦⑨ 机制批手推测试覆盖——本文件守"接线正确"。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { pilotBlocks } from '../assets/scripts/core/s7/S7PilotEffects';
import { deriveUnit } from '../assets/scripts/core/s7/S7BattleStatDerivation';
import {
  S7AffixBlock, S7BehaviorBlock, S7EffectBlock, S7ModifierBlock, S7StackBlock, S7TriggerBlock,
} from '../assets/scripts/core/s7/S7BattleEffectBlock';

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

/** 试验台：玩家攻手行(攻100/间隔1/防0/射99/无大招) + 两敌位(r0c0 / r0c6·enc_n001 双波)。 */
function rig(opts: {
  enemyA: Row; enemyB?: Row;
}): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
    attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie', // 攻125×(100/125防修)=净伤100·整洁手推数
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
    attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie', // 攻125×(100/125防修)=净伤100·整洁手推数
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
  // w2 恒 spawn 一个（count 必须==slotRefs.length·校验器约束）：无 enemyB 的用例=惰性假人（海量血/攻1·不影响手推值）。
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  return b;
}
const engineOf = async (b: Bundle): Promise<S7AutoBattleEngine> => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
type Dmg = { source: string; target: string; amount: number };
function dmgEvents(log: S7AutoBattleLogEntry[]): Dmg[] {
  return log.filter((e) => e.type === 'damage').map((e) => ({
    source: e.actorId ?? '', target: (e.targetIds ?? [])[0] ?? '', amount: e.amount ?? NaN,
  }));
}

describe('⑩A1-战斗级手推 · 蛰「斩链」杀关键单位→全队增伤（M1+onKillRoleTags 接线）', () => {
  const run = async (victimRole: string) => {
    const b = rig({
      enemyA: { maxHp: 1, armor: 1, roleTag: victimRole, attack: 1 }, // 一击必杀的"关键单位"载体
      enemyB: { maxHp: 100000000, roleTag: 'boss_add' },    // 记录靶
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'zhe',
      playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1', effectBlocks: [...pilotBlocks('pil04', 1)] }],
    });
    // 蛰能力=key_unit_first：先点杀 A（support 才算关键）；只看假人靶（enemy_0001）上的伤害值。
    return dmgEvents(r.log).filter((d) => d.source === 'player_p1c1' && d.target === 'enemy_0001').map((d) => d.amount);
  };
  it('杀 support → 假人靶吃 115（+15%·击杀后窗口）且 6s 到期回 100；杀 swarm → 全程 100（角色过滤真拦截）', async () => {
    const hitsSupport = await run('support');
    expect(hitsSupport).toContain(115);      // 斩链 dmg_up 15%：125×1.15×(100/125 防修)=115 手推
    expect(hitsSupport).toContain(100);      // 6s 窗口到期回基础值=时长语义也真
    const hitsSwarm = await run('swarm');
    expect(hitsSwarm.length).toBeGreaterThan(0);
    expect(hitsSwarm.every((a) => a === 100)).toBe(true); // 非关键击杀不触发（onKillRoleTags 过滤真拦截）
  });
});

describe('⑩A1-战斗级手推 · 砺持续嘲讽（cd 触发反复 apply_state 接线·⑨M4 定式）', () => {
  const firstTargetOf = async (withLi: boolean) => {
    const b = rig({ enemyA: { attack: 125, targetingTag: 'backline_first', maxHp: 100000000 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'li',
      playerUnits: [
        { unitStatRef: 'bu_ship_vanguard', slotRef: 'p2c2', ...(withLi ? { effectBlocks: [...pilotBlocks('pil06', 0)] } : {}) }, // 前排=砺舰（Lv0=能力即生效）
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' }, // 后排=被点名对象
      ],
    });
    const first = dmgEvents(r.log).find((d) => d.source === 'enemy_0000');
    return first?.target ?? 'none';
  };
  it('无砺：点名敌打后排 p0c0；带砺(Lv0)：被嘲讽拉去打前排 p2c2——能力起手即生效', async () => {
    expect(await firstTargetOf(false)).toBe('player_p0c0');
    expect(await firstTargetOf(true)).toBe('player_p2c2');
  });
});

describe('⑩A1-战斗级手推 · 岩守护+反震（guard 替挡 + 格挡/反弹数字·§13 v0）', () => {
  it('后排 100 伤被替挡：岩承伤 90（格挡10%）·攻击者被反弹 36（=90×40%）·守护 CD2s 期间漏击落回后排 100', async () => {
    const b = rig({ enemyA: { attack: 125, targetingTag: 'backline_first', maxHp: 100000000, attackIntervalSec: 1.0 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'yan',
      playerUnits: [
        { unitStatRef: 'bu_ship_vanguard', slotRef: 'p2c2', effectBlocks: [...pilotBlocks('pil05', 1)] }, // 岩：守护(能力)+反震(Lv1)
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' },
      ],
    });
    const dmg = dmgEvents(r.log);
    const onYan = dmg.filter((d) => d.source === 'enemy_0000' && d.target === 'player_p2c2').map((d) => d.amount);
    const onBack = dmg.filter((d) => d.source === 'enemy_0000' && d.target === 'player_p0c0').map((d) => d.amount);
    const reflected = dmg.filter((d) => d.source === 'player_p2c2' && d.target === 'enemy_0000' && d.amount === 36);
    expect(onYan).toContain(90);        // 替挡+格挡 10%：100→90
    expect(onBack).toContain(100);      // CD2s 期间攻击照落原目标（M4 口径）——漏击=CD 语义真实
    expect(reflected.length).toBeGreaterThan(0); // 反弹 90×40%=36 直扣攻击者
  });
});

describe('⑩A1-战斗级手推 · 源「专注」3★ 继承质变（M3 dmgVsLockedPct + target_switch 断条件映射）', () => {
  const firstHitOnB = async (star: number) => {
    const b = rig({
      enemyA: { maxHp: 150, armor: 25, attack: 1 },            // 先锁定并击杀的目标
      enemyB: { maxHp: 100000000, attack: 1 },      // 换锁后的目标
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'yuan',
      playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1', effectBlocks: [...pilotBlocks('pil09', 1, star)] }],
    });
    const hit = dmgEvents(r.log).find((d) => d.source === 'player_p1c1' && d.target === 'enemy_0001');
    return hit?.amount ?? NaN;
  };
  it('基座：杀锁定目标换锁清空专注（首击≈基础值）；3★：加成继承给下一个目标（首击>基座）', async () => {
    const base = await firstHitOnB(1);
    const s3 = await firstHitOnB(3);
    expect(s3).toBeGreaterThan(base); // 同种子同时间线·唯一差=3★ 去 target_switch 断条件（继承语义精确映射）
    expect(base).toBeLessThanOrEqual(110); // 换锁后接近清零（留 per_second 重臂 1-2 层量子余量）
  });
});

describe('⑩A1-战斗级手推 · 骁「先锋」开战窗口 + Lv0 缺省无天赋（回执⑤守卫）', () => {
  const hitsOf = async (lv: number) => {
    const b = rig({ enemyA: { maxHp: 100000000, attack: 1 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'xiao',
      playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1', effectBlocks: [...pilotBlocks('pil11', lv)] }],
    });
    return dmgEvents(r.log).filter((d) => d.source === 'player_p1c1').map((d) => d.amount);
  };
  it('Lv1：开战 8s 内 130（+30%）·窗口后回 100；Lv0：全程 100（天赋未解锁=最保守缺省）', async () => {
    const lv1 = await hitsOf(1);
    expect(lv1).toContain(130);
    expect(lv1).toContain(100);
    expect(lv1[0]).toBe(130); // 首击在窗口内
    const lv0 = await hitsOf(0);
    expect(lv0.every((a) => a === 100)).toBe(true);
  });
});

describe('⑩A1-接线门扫描（级门取对档·星门开质变·§13 参数逐点）', () => {
  const trigRefs = (blocks: readonly S7EffectBlock[]): string[] => blocks.filter((b): b is S7TriggerBlock => b.kind === 'trigger').map((t) => t.effectRef);
  const stacksOf = (blocks: readonly S7EffectBlock[]) => blocks.filter((b): b is S7StackBlock => b.kind === 'stack').map((s) => s.rule);
  const affixOf = (blocks: readonly S7EffectBlock[], key: string) => (blocks.find((b): b is S7AffixBlock => b.kind === 'affix' && b.affix === key) as S7AffixBlock | undefined)?.value;

  it('燎连斩级门：Lv1→1.5s / Lv20→2s / Lv100→4s；3★ 加连杀攻速叠层', () => {
    expect(trigRefs(pilotBlocks('pil03', 1))).toContain('eff_pil_cdr_15');
    expect(trigRefs(pilotBlocks('pil03', 20))).toContain('eff_pil_cdr_20');
    expect(trigRefs(pilotBlocks('pil03', 100))).toContain('eff_pil_cdr_40');
    expect(stacksOf(pilotBlocks('pil03', 1, 3)).some((r) => r.stat === 'atkSpeedPct' && r.perStack === 0.10)).toBe(true);
    expect(stacksOf(pilotBlocks('pil03', 1, 2)).length).toBe(0);
  });
  it('炎过热级门：Lv1=2%/3层 → Lv40=4% → Lv80 上限5 → Lv100 断击只降1层', () => {
    const l1 = stacksOf(pilotBlocks('pil01', 1))[0];
    expect([l1.perStack, l1.maxStacks, l1.breakAction ?? 'clear']).toEqual([0.02, 3, 'clear']);
    const l80 = stacksOf(pilotBlocks('pil01', 80))[0];
    expect([l80.perStack, l80.maxStacks]).toEqual([0.04, 5]);
    expect(stacksOf(pilotBlocks('pil01', 100))[0].breakAction).toBe('decay_1');
  });
  it('影斩首级门：Lv1=+40% → Lv40=+50% → Lv60=+60%（dmgVsLowHp）', () => {
    expect(affixOf(pilotBlocks('pil02', 1), 'dmgVsLowHp')).toBe(0.40);
    expect(affixOf(pilotBlocks('pil02', 40), 'dmgVsLowHp')).toBe(0.50);
    expect(affixOf(pilotBlocks('pil02', 60), 'dmgVsLowHp')).toBe(0.60);
  });
  it('沧坚壁：Lv1 光环基座 → Lv40 +盾效词条 → Lv80 每档 8%；巡增产：Lv40 上限+2；藏 Lv100 附增伤', () => {
    expect(trigRefs(pilotBlocks('pil08', 1))).toContain('eff_pil_cang_aura');
    expect(affixOf(pilotBlocks('pil08', 40), 'shieldPower')).toBe(0.15);
    expect(trigRefs(pilotBlocks('pil08', 80))).toContain('eff_pil_cang_aura_l80');
    expect(affixOf(pilotBlocks('pil19', 40), 'summonCapBonus')).toBe(2);
    expect(affixOf(pilotBlocks('pil19', 1), 'skillHaste')).toBe(0.20);
    const zang100 = pilotBlocks('pil20', 100);
    expect((zang100.find((b): b is S7ModifierBlock => b.kind === 'modifier') as S7ModifierBlock).value).toBe(0.08);
  });
  it('空/巡 5★ 光环星门：5★ 有、4★ 无（M6 no_enemy_summon / has_summon 载体）', () => {
    expect(trigRefs(pilotBlocks('pil18', 1, 5))).toContain('eff_pil_kong_s5_aura');
    expect(trigRefs(pilotBlocks('pil18', 1, 4))).not.toContain('eff_pil_kong_s5_aura');
    expect(trigRefs(pilotBlocks('pil19', 1, 5))).toContain('eff_pil_xun_s5_aura');
    expect(trigRefs(pilotBlocks('pil19', 1, 4))).not.toContain('eff_pil_xun_s5_aura');
  });
  it('岳3★：荆甲改按攻击者攻×12%（换 s3 行）；砺愈坚 Lv60 每档 5%', () => {
    expect(trigRefs(pilotBlocks('pil07', 1, 3))).toContain('eff_pil_yue_thorns_s3');
    expect(trigRefs(pilotBlocks('pil07', 1, 2))).toContain('eff_pil_yue_thorns');
    expect(stacksOf(pilotBlocks('pil06', 60))[0].perStack).toBe(0.05);
  });
});

describe('⑩A1-方向匹配门（deriveUnit·真源§0"自然生效/自然失效"的机器化）', () => {
  const base = {
    maxHp: 800, attack: 60, armor: 20, attackIntervalSec: 1, attackRangeCells: 99, passiveEnergyPerSec: 0,
    sizeRows: 1, sizeCols: 1,
    targetingTag: 'nearest_random_tie', normalEffectRef: 'eff_basic_attack', ultimateEffectRef: 'none', coreEffectRef: 'none',
  };
  it('苏(友方向能力)装攻击舰：普攻目标不被改成友军（否则=伤害打自己人）·天赋词条照常生效', () => {
    const d = deriveUnit(base, pilotBlocks('pil13', 1));
    expect(d.targetingTag).toBe('nearest_random_tie'); // 友方向覆盖被忽略=自然失效
    expect(d.affixes.healVsLowHp).toBe(0.30);          // 数值词条不受方向门影响（无治疗产出=天然空转）
  });
  it('澈(友方向能力)装支援舰（基础 tag=友方向）：覆盖生效=增益喂最高输出', () => {
    const d = deriveUnit({ ...base, targetingTag: 'lowest_hp_ally' }, pilotBlocks('pil14', 1));
    expect(d.targetingTag).toBe('highest_attack_ally');
  });
  it('炎(敌方向能力)装支援舰：不把治疗普攻改成打敌人=忽略；装攻击舰：正常覆盖', () => {
    expect(deriveUnit({ ...base, targetingTag: 'lowest_hp_ally' }, pilotBlocks('pil01', 0)).targetingTag).toBe('lowest_hp_ally');
    expect(deriveUnit(base, pilotBlocks('pil01', 0)).targetingTag).toBe('lowest_hp_enemy');
  });
});
