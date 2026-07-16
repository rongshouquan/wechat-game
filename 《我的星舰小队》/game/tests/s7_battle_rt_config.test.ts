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
    // 段二 H1（真源 f8c6ae75 召唤物对齐·旧→新→为什么对）：n084 失控母舰 Boss 本体挂周期召唤无人机
    //   （BOSS_PERIODIC_SUMMON 生产规则）→ +1 bu_n084_sadd（复用母舰单元召唤物·SADD 份额）
    //   +1 eff_n084_summon（生命周期包）；phase_n084_mid 旧盾仔阶段召唤×3 退役（行数不变·引用清空）。
    // 段二战斗批 450 关重定基（旧→新→为什么对）：150 关世界 241/305/148/216/21 → 450 关新世界——
    //   单位行 860=54 全局（48 旧基础 −7 旧 Boss 行〔n030/060/084/102/120/138/150 不在新 13 位=删〕
    //     +13 新 Boss 骨架行）+751 节点敌行+55 母舰 sadd 行（走量+apply 实测·工具输出对账）；
    //   效果行 344=289 全局（305−16 旧节点召唤行）+55 eff_nXXX_summon（55 个母舰关）；
    //   encounter 448=450−2 非战斗（n018/n019）；spawn 845=11 教学保留+834 走量；
    //   phase 26=13 Boss×2 占位段（mid 易伤窗+final 爆发窗·真阶段=段 2 对位手调）。
    // 段2 n018→n020 落位重定基（旧→新→为什么对）：精英位 18（被保护期身份吞=磁盘实出 37 精英）
    //   挪 n020 后 elite 回 38——n020 normal（单职业 1 波）→ elite（swarm_tough+swarm 2 波）
    //   =节点敌行 751→752、单位行 860→861（apply 清账 806→807 差 1 对账吻合）。
    // 段2 13 Boss 真机制重定基（旧→新→为什么对）：BOSS_CONTENT 声明落盘——
    //   单位行 861→868（+7=n140 adds 换型 tough+n312 adds +support+n400 adds 换双职业 +2
    //     +phase 阶段召唤专属 add 行 ×3〔n312/n400/n450〕+n250 周期召唤 sadd +1）；
    //   效果行 344→363（+19=eff_boss_* 声明域 18 行+eff_n250_summon 周期召唤 1 行）；
    //   spawn 845→847（n400/n312 adds 各 1→2 波）；
    //   phase 26→10（13 Boss 占位 ×2 段 → 声明制：n054/n140/n176/n368 零阶段〔真源机制在
    //     常态触发器〕+n104/n214/n312/n340/n384/n400 各 1 段+n282/n450 各 2 段=10）。
    // 段3 精英花样重铺重定基（旧→新→为什么对）：38 关 ELITE_CONTENT 声明落盘——
    //   单位行 868→857（+2 词缀源全局行〔rally/rally_haste·真源§1 星盗船长补配置行=⑩A4 先例〕
    //     −13 净减节点行：镜像 4 关零 spawn〔敌=玩家阵容读档〕+38 关波次换载体净账·apply 打印
    //     「节点行 744+add 3+sadd 53」对账吻合）；
    //   效果行 363→362（+2 rally 全局效果行−3 母舰召唤效果〔sadd 56→53=换波后母舰关净减〕）；
    //   spawn 847→839（828 走量+11 教学：镜像 4 关 −8 波+38 关波数净变）；
    //   encounter 448/phase 10 不变。
    expect(readTable('battle_unit_stat_param')).toHaveLength(857);
    // ⑩A1：+50 驾驶员效果行（eff_pil_*·细表§13）；⑩A2：+8 星核效果行（eff_core_*·小太阳/星鲸/时光糖/护罩/战鼓/贪吃星/烟花·§15）→ 42+50+8+15=115。
    // ⑩A3：+18 舰装备行（张盾/怒吼/冲锋号/催进/微风/致盲领域/侵蚀/联防/普攻变体…）+14 插件行（cdr×5/净化/免疫/援护×4/自愈×3）；⑩A4：+5（污染体两件/污染潮/磁暴场/终Boss全屏）。
    // 机制批③段一：+5（曲率星门 rank_swap/彩虹棱镜弹跳普攻/全息镜召唤/群蜂饱和打击/影刃分裂普攻·6 深坑核+同族挂牌件接线）。
    // 机制批③段二a：+15（炎3★/5★致命一击×2/影3★再判/燎5★刷新/沧驰援两件/沧5★光环/骁5★延长/翎5★双倍夺势/
    //   沛L40回血+3★小盾/空3★清场/巡3★溅射无人机弹/护盾传奇自罩盾/小太阳后爆——驾驶员质变+插件传奇接线）。
    // 机制批③段二b：+132（20 舰大节点 L20-L100 档位行 + A/S/SS 质变行 + 蜂针延迟爆/迷雾普攻致盲接真件——
    //   舰侧阶/级装配通道 shipBlocks 的数据面·逐行注"批③2b"）。
    expect(readTable('battle_effect_param')).toHaveLength(362);
    expect(readTable('battle_encounter_param')).toHaveLength(448);
    expect(readTable('battle_spawn_param')).toHaveLength(839);
    expect(readTable('battle_boss_phase_param')).toHaveLength(10);
  });

  it('covers all 17 RT-01 effect types', () => {
    const got = new Set(readTable<{ effectType: string }>('battle_effect_param').map((r) => r.effectType));
    for (const t of EFFECT_TYPES) expect(got.has(t)).toBe(true);
  });

  it('covers n001 (normal/t01/swarm), n054 (首Boss), n104 (墙①), n450 (毕业战 boss/t10/berserk, pressure bp_n450)', () => {
    // 旧钉 n084/n150（150 关世界 Boss 位）→ 新钉 n054/n104/n450（新世界代表位：首Boss/墙①/毕业战）。
    const enc = readTable<Record<string, unknown>>('battle_encounter_param');
    const n001 = enc.find((r) => r.nodeRef === 'n001')!;
    const n054 = enc.find((r) => r.nodeRef === 'n054')!;
    const n104 = enc.find((r) => r.nodeRef === 'n104')!;
    const n450 = enc.find((r) => r.nodeRef === 'n450')!;
    expect(n001.stageType).toBe('normal');
    expect(n001.templateRef).toBe('t01');
    expect(n001.problemTagRef).toBe('swarm');
    expect(n001.bossPhaseRefs).toEqual([]);
    expect(n054.stageType).toBe('boss');
    expect(n054.pressureRef).toBe('bp_n054');
    expect(n104.stageType).toBe('boss');
    expect(n104.templateRef).toBe('t02');
    expect(n104.problemTagRef).toBe('swarm');
    expect(n450.stageType).toBe('boss');
    expect(n450.templateRef).toBe('t10');
    expect(n450.problemTagRef).toBe('berserk');
    expect(n450.pressureRef).toBe('bp_n450');
  });

  it('pins n450 boss pressure to 450-world snapshot (段二战斗批重定基：bp_n150 12080 → bp_n450 17890=首导快照 pressure[450]·带=±10%)', () => {
    const p = (readTable<Record<string, unknown>>('pressure_param')).find((r) => r.rowId === 'bp_n450') as unknown as { pressureRecommend: number; pressureMin: number; pressureMax: number };
    expect(p.pressureRecommend).toBe(17890);
    expect(p.pressureMin).toBe(16101);
    expect(p.pressureMax).toBe(19679);
  });

  it('keeps boss summon at most 10 per phase, every boss at most 3 unique phases', () => {
    const phases = readTable<{ bossNodeId: string; phaseTag: string; summonCountCap: number }>('battle_boss_phase_param');
    for (const r of phases) expect(r.summonCountCap).toBeLessThanOrEqual(10);
    // 13 Boss 全量查（旧钉 n084/n150 两位·新世界 Boss 位随拓扑换=全量更稳）。
    for (const boss of new Set(phases.map((r) => r.bossNodeId))) {
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
    (rowOf(b, 'battle_spawn_param', 'spawn_n450_boss').slotRefs as string[])[0] = 'r0c6'; // 2x2 anchored at c6 -> c7 越界（450 关占位 Boss=2x2）
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn unitStatRef not in its encounter enemyUnitStatRefs', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').unitStatRef = 'bu_enemy_shield';
    expect(hasErr(b, 'battle_spawn_param')).toBe(true);
  });

  it('rejects a spawn whose encounterRef breaks the encounter<->spawn closure', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_spawn_param', 'spawn_n001_w1').encounterRef = 'enc_n104';
    expect(validateS7ConfigBundle(b).length).toBeGreaterThan(0);
  });

  it('rejects an invalid unitRef for the unit target type', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_boss_n104').unitRef = 'n999';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects an effect ref that does not exist', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_unit_stat_param', 'bu_ship_vanguard').ultimateEffectRef = 'eff_nonexistent';
    expect(hasErr(b, 'battle_unit_stat_param')).toBe(true);
  });

  it('rejects summonCountCap > 10', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_boss_phase_param', 'phase_n450_mid').summonCountCap = 11;
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects a duplicate phaseTag for one boss', () => {
    // 450 关占位 Boss=mid/final 两段；追加重复 mid 段必须被拦（原 n084 三段用例同机理：tag 重复即红）。
    const b = clone(loadBundle());
    (b.battle_boss_phase_param as Array<Record<string, unknown>>).push({
      schemaVersion: 's7-0.1.0', rowId: 'phase_n104_extra', bossNodeId: 'n104', phaseTag: 'mid',
      triggerType: 'time_elapsed_sec', triggerValue: 10, effectRefs: ['eff_ult_burst_nuke'],
      summonUnitRefs: [], summonCountCap: 0, note: 'x',
    });
    expect(hasErr(b, 'battle_boss_phase_param')).toBe(true);
  });

  it('rejects an n450 encounter pressureRef other than bp_n450', () => {
    const b = clone(loadBundle());
    rowOf(b, 'battle_encounter_param', 'enc_n450').pressureRef = 'bp_n104';
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
