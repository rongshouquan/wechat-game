// BATTLE-RT-03: S7 轻量实时自动战斗 5 张配置表 schema + 样例 fixture 测试。
// 覆盖：整盘校验通过、5 表行数、n001/n084/n150 装配契约、17 类 effectType 覆盖、
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

  it('lands the 5 battle tables with 2c批量production(2026-07-02)后的行数', () => {
    // 2c关卡战斗内容批量生产（Codex产出，见 第二块-关卡战斗内容生产规范.md）：
    // 148个可战斗节点(150-n018/n019两个非战斗保护期节点)全部覆盖 encounter；
    // 新增4个通用敌人schema(backline/support/charge/summon_source) + 4个新Boss单位(n060/102/120/138)。
    // n030 首Boss（Ron 2026-07-03）：+bu_boss_n030（本体2x2）；enc_n030 就地由普通改Boss（encounter 数不变）；
    //   spawn_n030_w1 拆成 spawn_n030_boss+spawn_n030_adds（净+1）；+phase_n030 三阶段（Boss 6→7 → 21 阶段）。
    // ⑥第一段 20 舰落地（细表§12）：舰行 12→20（+8）+ 召唤物 3 行（无人机/诱饵盒/星鲸）→ 30+11=41；
    // 效果行 +22（普攻变体 6 + 技能 14 + 星核备用 2）→ 20+22=42。
    // ⑥三段落数（细表§20）：n009+ 每关落节点敌行 bu_n<XXX>_<role>（137 关 ×角色数 + Boss adds/母舰产出行）
    //   =+196；41 基础行保留（教学 n001-n008/谜题/机制测试引用面）→ 41+196=237。
    //   落数脚本幂等（clean-and-normalize → apply-enemy-landing），行数=脚本输出实测。
    // ⑩A0 重落（v0.7 压力表·细表§20.9）：196→192——⑥脚本给七个 Boss 关无差别造 bu_n*_add，
    //   仅 n120/n138/n150 的阶段召唤真引用；n030/n060/n084/n102 四孤行（encounter/spawn/phase 零引用）
    //   由"只造被引用行"的入库版脚本自然清除（旧值≡死数据，删除不改任何战斗行为）→ 41+192=233。
    // ⑩A4：+2 全局真源载体行（污染体/磁暴塔=敌人真源§3/§4 在册敌人补配置行）·n138 阶段召唤 add→pollution（节点行数不变）。
    // 机制批③段一：+1 全息镜分身占位行（bu_s7_hologram·三围由 copyCasterStatsPct 施法者快照覆盖·结构基线）→ 44 基础。
    // 机制批③段二b：+4（嘲讽诱饵盒/爆炸诱饵盒/嘲讽堡垒=哨卫 L60/A/SS 召唤变体·大型母舰无人机=蜂巢SS）→ 48 基础。
    expect(readTable('battle_unit_stat_param')).toHaveLength(240); // 48 基础 + 192 节点敌行
    // ⑩A1：+50 驾驶员效果行（eff_pil_*·细表§13）；⑩A2：+8 星核效果行（eff_core_*·小太阳/星鲸/时光糖/护罩/战鼓/贪吃星/烟花·§15）→ 42+50+8+15=115。
    // ⑩A3：+18 舰装备行（张盾/怒吼/冲锋号/催进/微风/致盲领域/侵蚀/联防/普攻变体…）+14 插件行（cdr×5/净化/免疫/援护×4/自愈×3）；⑩A4：+5（污染体两件/污染潮/磁暴场/终Boss全屏）。
    // 机制批③段一：+5（曲率星门 rank_swap/彩虹棱镜弹跳普攻/全息镜召唤/群蜂饱和打击/影刃分裂普攻·6 深坑核+同族挂牌件接线）。
    // 机制批③段二a：+15（炎3★/5★致命一击×2/影3★再判/燎5★刷新/沧驰援两件/沧5★光环/骁5★延长/翎5★双倍夺势/
    //   沛L40回血+3★小盾/空3★清场/巡3★溅射无人机弹/护盾传奇自罩盾/小太阳后爆——驾驶员质变+插件传奇接线）。
    // 机制批③段二b：+132（20 舰大节点 L20-L100 档位行 + A/S/SS 质变行 + 蜂针延迟爆/迷雾普攻致盲接真件——
    //   舰侧阶/级装配通道 shipBlocks 的数据面·逐行注"批③2b"）。
    expect(readTable('battle_effect_param')).toHaveLength(304); // 42+50+8+18+14+5+5+15+132 全局 + 15 节点召唤行
    expect(readTable('battle_encounter_param')).toHaveLength(148); // enc_n030 就地改Boss，encounter 总数不变
    expect(readTable('battle_spawn_param')).toHaveLength(216); // spawn_n030_w1 → boss+adds 两行（净+1）
    expect(readTable('battle_boss_phase_param')).toHaveLength(21); // 7个Boss x 3阶段（+n030 首Boss 三阶段）
  });

  it('covers all 17 RT-01 effect types', () => {
    const got = new Set(readTable<{ effectType: string }>('battle_effect_param').map((r) => r.effectType));
    for (const t of EFFECT_TYPES) expect(got.has(t)).toBe(true);
  });

  it('covers n001 (normal/t01/swarm), n084 (boss/t04/shield), n150 (boss/t10/berserk, pressure bp_n150)', () => {
    const enc = readTable<Record<string, unknown>>('battle_encounter_param');
    const n001 = enc.find((r) => r.nodeRef === 'n001')!;
    const n084 = enc.find((r) => r.nodeRef === 'n084')!;
    const n150 = enc.find((r) => r.nodeRef === 'n150')!;
    expect(n001.stageType).toBe('normal');
    expect(n001.templateRef).toBe('t01');
    expect(n001.problemTagRef).toBe('swarm');
    expect(n001.bossPhaseRefs).toEqual([]);
    expect(n084.stageType).toBe('boss');
    expect(n084.templateRef).toBe('t04');
    expect(n084.secondaryPressureTag).toBe('swarm_low');
    expect(n150.stageType).toBe('boss');
    expect(n150.templateRef).toBe('t10');
    expect(n150.problemTagRef).toBe('berserk');
    expect(n150.secondaryPressureTag).toBe('one_of_t03_t05_t08_t09');
    expect(n150.pressureRef).toBe('bp_n150');
  });

  it('pins n150 boss pressure to v0.7 snapshot (步5 重定基：旧 14500=B1 旧刻度·新=推荐 32094/带 28885-35303)', () => {
    const p = (readTable<Record<string, unknown>>('pressure_param')).find((r) => r.rowId === 'bp_n150') as unknown as { pressureRecommend: number; pressureMin: number; pressureMax: number };
    expect(p.pressureRecommend).toBe(32094);
    expect(p.pressureMin).toBe(28885);
    expect(p.pressureMax).toBe(35303);
  });

  it('keeps n150 boss summon at most 10 per phase, n084/n150 at most 3 unique phases', () => {
    const phases = readTable<{ bossNodeId: string; phaseTag: string; summonCountCap: number }>('battle_boss_phase_param');
    for (const r of phases) expect(r.summonCountCap).toBeLessThanOrEqual(10);
    for (const boss of ['n084', 'n150']) {
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
    (rowOf(b, 'battle_spawn_param', 'spawn_n150_boss').slotRefs as string[])[0] = 'r0c5'; // 3x3 anchored at c5 -> c7
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn unitStatRef not in its encounter enemyUnitStatRefs', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').unitStatRef = 'bu_enemy_shield';
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn whose encounterRef breaks the encounter<->spawn closure', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').encounterRef = 'enc_n084';
    expect(validateS7ConfigBundle(b).length).toBeGreaterThan(0);
  });

  it('rejects an invalid unitRef for the unit target type', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_boss_n084').unitRef = 'n999';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects an effect ref that does not exist', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_ship_vanguard').ultimateEffectRef = 'eff_nonexistent';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects summonCountCap > 10', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_boss_phase_param', 'phase_n150_mid').summonCountCap = 11;
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects more than 3 phases for one boss', () => {
    const b = clone(loadBundle());
    (b.battle_boss_phase_param as Array<Record<string, unknown>>).push({
      schemaVersion: 's7-0.1.0', rowId: 'phase_n084_extra', bossNodeId: 'n084', phaseTag: 'mid',
      triggerType: 'time_elapsed_sec', triggerValue: 10, effectRefs: ['eff_ult_burst_nuke'],
      summonUnitRefs: [], summonCountCap: 0, note: 'x',
    });
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects an n150 encounter pressureRef other than bp_n150', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_encounter_param', 'enc_n150').pressureRef = 'bp_n084';
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
