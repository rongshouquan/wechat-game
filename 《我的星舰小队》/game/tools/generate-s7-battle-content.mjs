#!/usr/bin/env node
// 段二战斗批 · 450 关战斗内容骨架走量生成器（2026-07-14 首建）。
//
// 分工（与 apply-enemy-landing.mjs 的两步幂等纪律咬合）：
//   本工具＝**骨架层**（encounter 行/spawn 波次与格位/Boss 全局行/Boss 阶段占位——"这关有谁、几波、站哪"）；
//   apply-enemy-landing＝**属性层**（按压力表落血攻防——"他们多硬多疼"）。
//   顺序：本工具 → apply-enemy-landing → apply-pressure-display → validator。
// 幂等：纯确定性映射（零随机），重跑逐字节同结果；--check 同 apply 口径字节比对。
//
// 保留面（§20.1 红线）：n001-n008 教学段 encounter/spawn 原行一字不动（敌配手调窗口）；
//   41+ 条全局基础行不删（本工具只动 bu_boss_* 全局行：删旧世界 7 位、建新世界 13 位骨架）。
// 波次设计：跟 problemTagRef 走（战前预览标签与实际敌人对得上）；六域族味用真源载体
//   （废铁=swarm_tough/support/stormtower、污染=pollution——ROLE_SHAPE 已含其形状行）。
// Boss 内容：段 1 只落"占位弧线"（mid 血50% 易伤窗 + final 血20% 爆发窗·通用两段）——
//   13 Boss 真机制（对位真源 §5 族属/招牌/召唤）＝段 2 手调域，本工具不发明设计。
// 精英内容：段 1 落"强化组合"骨架；花样（词缀点名/奇阵/斩首/镜像/复活连战/福利）＝段 3 手调域。
//
// 用法：
//   node tools/generate-s7-battle-content.mjs           # 生成+写盘
//   node tools/generate-s7-battle-content.mjs --check   # 不写盘：计算态与磁盘逐字节比对（0=一致）
// ⚠️ --check 只在 apply-enemy-landing 之前有效：apply 会把骨架属性覆盖成落数值（Boss 行血攻/
//    spawn 引用节点化）——落数后的盘面 vs 骨架计算态必然不同（≠工具坏）。落数后的幂等验证
//    =apply-enemy-landing --check；重跑本工具会以磁盘现态为基（Boss 行"已有保留"）+重建 encounter/
//    spawn/phase 骨架，跑完必须再跑一遍 apply 恢复属性层。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTables, writeTables, serializeTable, LANDING_TABLES, EYE_RULES, ELITE_EFFECT_RE } from './enemy-landing-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dirIdx = argv.indexOf('--dir');
// --dir：对指定目录副本操作（全链重放守卫/测试用）——mainline 输入与 5 张输出域同目录取。
const DIR = dirIdx >= 0 && argv[dirIdx + 1]
  ? path.resolve(argv[dirIdx + 1])
  : path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const SCHEMA = 's7-0.1.0';
const CHECK = argv.includes('--check');
const TEACHING_MAX_NODE = 8; // n001-n008 保留面（§20.1）

const mainline = JSON.parse(readFileSync(path.join(DIR, 'mainline_node_config.sample.json'), 'utf-8'));

// ============================================================================
// 波次映射（problemTag → 职业波次组合·主模式对齐旧 148 关归纳 + 六域族味载体）
// 每 tag 两个 normal 变体（按节点号轮换=域内有变化不单调）。
// ============================================================================

/** 全局职业行短后缀（bu_enemy_<suffix>）。 */
const NORMAL_WAVES = {
  swarm: [
    [['swarm', 7], ['swarm', 5]], // 星盗海双波（旧 t02 主模式）
    [['swarm', 7]],               // 单波直道（旧 t01 主模式）
  ],
  backline: [
    [['swarm_tough', 4], ['support', 2], ['stormtower', 2]], // 废铁全家福：滚石挡前+修理机奶+磁暴塔（点治疗源题）
    [['swarm_tough', 6], ['stormtower', 2]],                 // 重肉波
  ],
  shield: [
    [['shield', 3]],               // 盾墙（旧 t03/t04 主模式·血厚量少）
    [['shield', 2], ['swarm', 5]], // 盾+杂兵混编
  ],
  summon: [
    [['summon_source', 2], ['boss_add', 4]], // 量产母舰+在场无人机（旧 t09 主模式）
    [['summon_source', 2], ['backline', 2]], // 母舰+点名塔（无人舰族纯度）
  ],
  berserk: [
    [['pollution', 3], ['swarm', 4]],       // 污染体+杂兵（受击狂暴题·真源载体）
    [['pollution', 2], ['burst_raider', 2]], // 污染+快攻
  ],
  burst: [
    [['burst_raider', 2], ['charge', 2]], // 玻璃炮+前锋（旧 t08 主模式）
    [['burst_raider', 3]],                // 纯爆发（旧 t07 主模式）
  ],
};

/** 精英强化组合（花样=段 3 手调，此处为强度骨架·对齐旧 elite 例）。 */
const ELITE_WAVES = {
  swarm: [['swarm_tough', 8], ['swarm', 4]],
  backline: [['stormtower', 3], ['support', 2], ['swarm_tough', 3]],
  shield: [['shield_warden', 1], ['shield', 2]],
  summon: [['summon_source', 2], ['boss_add', 4]],
  berserk: [['pollution', 4], ['swarm', 3]],
  burst: [['burst_raider', 3], ['charge', 2]],
};

/** Boss 场 adds 波（域主题·旧例 boss=bossx1+主题职业）。 */
const BOSS_ADDS = {
  swarm: [['swarm', 5]],
  backline: [['stormtower', 2], ['support', 2]],
  shield: [['shield', 3]],
  summon: [['summon_source', 2]],
  berserk: [['pollution', 3]],
  burst: [['charge', 3]],
};

/** Boss 大招占位（段 2 对位真源后换真机制；轮换两款通用大招防千篇一律）。 */
const BOSS_ULT_PLACEHOLDER = ['eff_ult_clear_barrage', 'eff_ult_burst_nuke'];

// ============================================================================
// 手调声明表总目录（段2 立·总控确认的三层手调通道之「生成器声明层」）
// 红线：磁盘 json 永远=本工具→apply-enemy-landing 两步重放的产物，禁止手改 json 绕公式；
//   一切手调=写进下面三张声明表，重跑=声明自动重放（守卫=s7_enemy_landing_scripts 全链重放测试）。
// 分工：血攻防间隔四属性=压力公式独占（apply 层·差异化走 entry BOSS_SHAPE_OVERRIDE 公式参数）；
//   机制（Boss 行为字段/阶段/专属效果行/adds 波次）=BOSS_CONTENT；格位=FORMATION_OVERRIDE；
//   精英花样=ELITE_CONTENT（段3 填·本批空表架构）。
// 效果行三方分域：本工具独管 eff_boss_nXXX_* 域（重跑=先删本域后按声明重建）；
//   apply 管 eff_nXXX_summon；41 全局行+教学段=手写正文双不碰。
// ============================================================================

/**
 * BOSS_CONTENT：13 Boss 真机制声明（键=nodeId·值缺省=通用占位弧线）。
 *   boss:    Boss 行字段覆写（targetingTag/normalEffectRef/ultimateEffectRef/ultimateCdSec/
 *            coreEffectRef/note…——只写要覆写的键；已存在 Boss 行同样重放=声明是真源）。
 *   effects: 专属效果行全量字段数组（rowId 必须落 eff_boss_<nodeId>_* 命名域·本工具先删后建）。
 *   phases:  真阶段数组（{tag,triggerType,triggerValue,effectRefs,summonUnitRefs?,summonCountCap?,note?}
 *            ·替代 mid/final 通用占位·rowId 生成为 phase_<nodeId>_<tag>）。
 *   adds:    Boss 场同屏 adds 波次覆写（[[职业后缀,数量],…]·缺省走域主题 BOSS_ADDS）。
 *   encounter: encounter 行字段覆写（reviveWaves 连战等·只写要覆写的键）。
 * 填表窗口=段2 13 Boss 手调（严格按敌人真源 §5 对位表）。
 */
const BOSS_CONTENT = {
  // ===== n054 · 首Boss 星盗大副（真源§5 原班·强引导收尾高潮·非墙·掉陨星弹）=====
  // 「小阵仗」=复用船长"鼓动"+队长"蓄力重轰"，幅度/规模远低于星盗大王；真源无阶段（1 普攻+1 招牌）。
  n054: {
    boss: {
      ultimateEffectRef: 'eff_boss_n054_volley', ultimateCdSec: 12,
      extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 10, effectRef: 'eff_boss_n054_rally' }],
      note: 'n054 星盗大副（真源§5 原班·段2 手调）：小阵仗=周期小幅鼓动身边星盗艇+蓄力小狂轰·掉陨星弹',
    },
    effects: [
      { rowId: 'eff_boss_n054_volley', effectKind: 'ultimate', effectType: 'burst_nuke', effectPower: 1.1, targetingTag: 'cross_area', durationSec: 0, maxTargets: 3, stateTag: 'none', summonUnitRef: 'none', note: '大副蓄力小狂轰：对单体/小范围中伤（队长蓄力重轰缩幅·1.5s 蓄力感=演出层）' },
      { rowId: 'eff_boss_n054_rally', effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_block_area', durationSec: 4, maxTargets: 6, stateTag: 'atk_up', stateAmount: 0.15, summonUnitRef: 'none', note: '大副鼓动（船长鼓动缩幅）：身边星盗艇 +15% 攻 4s' },
    ],
    phases: [],
  },
  // ===== n104 · 墙① 星盗大王（真源§5 原班·群怪主题·两阶段）=====
  // 阶段1 疯狂鼓动（大幅加攻加速+周期召星盗艇补数量）→阶段2（血50%）蓄力狂轰：引擎阶段=一次性
  // 触发，"此后持续狂轰"以 mid 触发大 AoE ×1+长时狂暴态（普攻/鼓动全变猛）近似——真源忠实度记档。
  n104: {
    boss: {
      ultimateEffectRef: 'none', ultimateCdSec: 0,
      extraTriggerBlocks: [
        { kind: 'trigger', on: 'cd', cdSec: 8, effectRef: 'eff_boss_n104_rally_atk' },
        { kind: 'trigger', on: 'cd', cdSec: 8, effectRef: 'eff_boss_n104_rally_haste' },
        { kind: 'trigger', on: 'cd', cdSec: 12, effectRef: 'eff_boss_n104_summon' },
      ],
      note: 'n104 星盗大王（真源§5 原班·段2 手调）：阶段1 疯狂鼓动+周期召星盗艇·阶段2（50%）蓄力狂轰+狂暴',
    },
    effects: [
      { rowId: 'eff_boss_n104_rally_atk', effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_block_area', durationSec: 6, maxTargets: 6, stateTag: 'atk_up', stateAmount: 0.3, summonUnitRef: 'none', note: '疯狂鼓动·攻（船长鼓动放大）：周围星盗 +30% 攻 6s' },
      { rowId: 'eff_boss_n104_rally_haste', effectKind: 'state', effectType: 'apply_state', effectPower: 0, targetingTag: 'self_block_area', durationSec: 6, maxTargets: 6, stateTag: 'atk_speed_up', stateAmount: 0.25, summonUnitRef: 'none', note: '疯狂鼓动·速：周围星盗 +25% 攻速 6s' },
      { rowId: 'eff_boss_n104_summon', effectKind: 'state', effectType: 'summon', effectPower: 0, targetingTag: 'self_team', durationSec: 10, maxTargets: 2, stateTag: 'none', summonUnitRef: 'bu_enemy_swarm', summonExpireSec: 20, despawnWithSource: true, summonSourceCap: 3, note: '周期召星盗艇补数量（击杀召唤源即停=生命周期包）·summonUnitRef 由 apply 节点化' },
      { rowId: 'eff_boss_n104_wildvolley', effectKind: 'ultimate', effectType: 'basic_damage', effectPower: 1.8, targetingTag: 'block_area', durationSec: 0, maxTargets: 9, stateTag: 'none', summonUnitRef: 'none', note: '蓄力狂轰（队长蓄力重轰放大）：阶段2 宣言·对一片高伤' },
      { rowId: 'eff_boss_n104_frenzy', effectKind: 'state', effectType: 'berserk', effectPower: 0, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'berserk', summonUnitRef: 'none', note: '阶段2 长时狂暴（蓄力狂轰的常态化近似·真源忠实度记档）' },
    ],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_boss_n104_wildvolley', 'eff_boss_n104_frenzy'], note: '阶段2「蓄力狂轰」：大 AoE 宣言+此后狂暴（真源两阶段）' },
    ],
  },
  // ===== n140 · 墙② 废铁再生者（Ron 定名变体·机制墙=坟场复活教学）=====
  n140: {
    boss: {
      ultimateEffectRef: 'eff_ult_burst_nuke', ultimateCdSec: 12,
      selfReviveHpPct: 0.5, selfReviveDelaySec: 1.2,
      note: 'n140 废铁再生者（变体·Ron 定名·段2 手调）：Boss 死后原地半血复活一次（坟场通道·复活机制教学）+修理机 adds·重轰=废铁直射炮弹语义',
    },
    effects: [],
    phases: [],
    adds: [['support', 2], ['swarm_tough', 3]], // 修理机 adds（奶别的废铁=点治疗源教学）+滚石挡前
  },
  // ===== n176 · 墙③ 废铁泰坦（真源§5 原班·护后排双钥解题墙）=====
  // 超高血高防+重锤点名后排（targetingTag=backline_first 既有字段）+震荡踏击 AoE+召滚石；
  // 高血/高防/重锤形状=entry BOSS_SHAPE_OVERRIDE.n176（hpShare .75/armor 60/interval 2.6·公式参数层）。
  n176: {
    boss: {
      targetingTag: 'backline_first',
      ultimateEffectRef: 'eff_boss_n176_stomp', ultimateCdSec: 11,
      extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 14, effectRef: 'eff_boss_n176_rocks' }],
      note: 'n176 废铁泰坦（真源§5 原班·段2 手调）：高血防+重锤点名后排+震荡踏击+召滚石——护后排双钥解题墙',
    },
    effects: [
      { rowId: 'eff_boss_n176_stomp', effectKind: 'ultimate', effectType: 'basic_damage', effectPower: 1.3, targetingTag: 'block_area', durationSec: 0, maxTargets: 9, stateTag: 'none', summonUnitRef: 'none', note: '震荡踏击：周期对一片放【震荡波】AoE（真源原文）' },
      { rowId: 'eff_boss_n176_rocks', effectKind: 'state', effectType: 'summon', effectPower: 0, targetingTag: 'self_team', durationSec: 10, maxTargets: 2, stateTag: 'none', summonUnitRef: 'bu_enemy_swarm_tough', summonExpireSec: 20, despawnWithSource: true, summonSourceCap: 3, note: '召唤滚石（swarm_tough=滚石机载体·生命周期包）' },
    ],
    phases: [],
  },
  // ===== n214 · 高潮② 巡卫母垒（Ron 定名变体·全场盾墙演出仗·不卡天）=====
  n214: {
    boss: {
      ultimateEffectRef: 'eff_state_shield', ultimateCdSec: 8,
      extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 10, effectRef: 'eff_boss_n214_shieldwall' }],
      note: 'n214 巡卫母垒（变体·Ron 定名·段2 手调）：护盾巡卫放大=自盾循环+周期全场盾墙（破盾题演出仗）',
    },
    effects: [
      { rowId: 'eff_boss_n214_shieldwall', effectKind: 'state', effectType: 'shield', effectPower: 1.5, targetingTag: 'self_team', durationSec: 6, maxTargets: 12, stateTag: 'shield', summonUnitRef: 'none', note: '全场盾墙：给全体敌方上盾（盾卫"能量护盾"放大到全场·演出仗骨架）' },
    ],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_boss_n214_shieldwall'], note: '第二幕盾墙（高潮演出节拍）' },
    ],
  },
  // ===== n250 · 墙④ 失控母舰（真源§5 原班挪位·护盾主题×连战墙）=====
  // 阶段1 带护盾+周期召唤无人机（f8c6ae75·ult=BOSS_PERIODIC_SUMMON n250 规则挂·此处不声明 ult）
  // +红线点名后排；阶段2 破盾后狂暴连射（shield_broken 触发=机制自洽的"两阶段"）；连战=reviveWaves 1。
  n250: {
    boss: {
      extraTriggerBlocks: [
        { kind: 'trigger', on: 'battle_start', effectRef: 'eff_boss_n250_shield' },
        { kind: 'trigger', on: 'shield_broken', effectRef: 'eff_boss_n250_frenzy' },
        { kind: 'trigger', on: 'cd', cdSec: 10, effectRef: 'eff_ult_backline_strike' },
      ],
      note: 'n250 失控母舰（真源§5 原班挪位·段2 手调）：阶段1 大盾+周期召无人机（ult=BOSS_PERIODIC_SUMMON 规则）+红线点名后排·阶段2 破盾狂暴连射·连战墙=reviveWaves',
    },
    effects: [
      { rowId: 'eff_boss_n250_shield', effectKind: 'state', effectType: 'shield', effectPower: 4, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'shield', summonUnitRef: 'none', note: '阶段1 大护盾（破盾前几乎免伤·破盾=阶段2 开关）' },
      { rowId: 'eff_boss_n250_frenzy', effectKind: 'state', effectType: 'berserk', effectPower: 0, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'berserk', summonUnitRef: 'none', note: '阶段2 破盾后狂暴连射（真源原文·shield_broken 触发）' },
    ],
    phases: [],
    // 段3 首件修正（n250 续调根因=debug 实证双塔 918 DPS 秒后排→35s 团灭·真源阶段1 点名=Boss 自身
    // extraTrigger 独家承载〔原文无塔〕）：adds 换无人机护卫="周期召唤无人机"的场面呼应·威胁弥散。
    adds: [['boss_add', 4]],
    encounter: { reviveWaves: 1 }, // 墙④连战墙：满血复活连战 ×1（耐力配队·通道①上岗·数值域定报备）
  },
  // ===== n282 · 墙⑤ 母舰指挥官（真源§5 原班·召唤主题·两阶段）=====
  // 阶段1 量产协议（ult=BOSS_PERIODIC_SUMMON n282 cd8=召唤速度更快·不声明 ult）
  // →阶段2（50%）锁定歼灭：mid/final 两窗点名高伤（"周期点名"以双窗近似·真源忠实度记档）。
  n282: {
    boss: {
      note: 'n282 母舰指挥官（真源§5 原班·段2 手调）：量产协议（周期快召无人机=BOSS_PERIODIC_SUMMON cd8）·血50% 起锁定歼灭点名后排',
    },
    effects: [
      { rowId: 'eff_boss_n282_lockdown', effectKind: 'ultimate', effectType: 'backline_strike', effectPower: 1.6, targetingTag: 'backline_first', durationSec: 0, maxTargets: 2, stateTag: 'none', summonUnitRef: 'none', note: '锁定歼灭：红线锁定后排打持续射线高伤（点名者机制放大）' },
      { rowId: 'eff_boss_n282_frenzy', effectKind: 'state', effectType: 'berserk', effectPower: 0, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'berserk', summonUnitRef: 'none', note: '残血狂暴（终段压迫）' },
    ],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_boss_n282_lockdown'], note: '阶段2「锁定歼灭」开窗：点名后排高伤' },
      { tag: 'final', triggerType: 'hp_pct_below', triggerValue: 20, effectRefs: ['eff_boss_n282_lockdown', 'eff_boss_n282_frenzy'], note: '终段：再点名+狂暴' },
    ],
  },
  // ===== n312 · 墙⑥ 量产中枢（Ron 定名变体·母舰召唤放大×复活波次=反召唤+耐力双考）=====
  n312: {
    boss: {
      note: 'n312 量产中枢（变体·Ron 定名·段2 手调）：母舰召唤放大（BOSS_PERIODIC_SUMMON cd6）×复活波次连战——反召唤+耐力双考（解题+连战叠加墙）',
    },
    effects: [],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, summonUnitRefs: ['bu_enemy_boss_add', 'bu_enemy_boss_add', 'bu_enemy_boss_add', 'bu_enemy_boss_add'], summonCountCap: 4, effectRefs: ['eff_state_vulnerable'], note: '血50% 爆产一波+召唤硬直易伤窗（量产放大的阶段宣言·validator 要求 effectRefs 非空）' },
    ],
    adds: [['summon_source', 2], ['support', 2]], // 母舰单元+修理机（点源优先级=解题成分）
    encounter: { reviveWaves: 1 },
  },
  // ===== n340 · 高潮③ 污染巨兽（真源§5 原班挪位·爆发主题·挂起测换载体位）=====
  n340: {
    boss: {
      normalEffectRef: 'eff_normal_polluted',
      extraTriggerBlocks: [{ kind: 'trigger', on: 'cd', cdSec: 12, effectRef: 'eff_pollution_tide' }],
      stackRules: [{ ruleId: 'n340_time_rage', on: 'per_second', stat: 'atkPct', perStack: 0.02 }],
      note: 'n340 污染巨兽（真源§5 原班挪位·段2 手调）：污染潮（cd12 全屏+全队燃烧）+随时间狂暴（+2%攻/s）+阶段召污染体——验限时爆发+净化+护罩',
    },
    effects: [],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, summonUnitRefs: ['bu_enemy_pollution', 'bu_enemy_pollution'], summonCountCap: 2, effectRefs: ['eff_state_vulnerable'], note: '阶段召唤污染体+召唤硬直易伤窗（真源载体·⑩A4 先例）' },
    ],
  },
  // ===== n368 · 墙⑦ 污染之心（Ron 定名变体·机制+解题叠加墙=净化+护罩双钥·A7 主流度说明在册）=====
  n368: {
    boss: {
      normalEffectRef: 'eff_normal_polluted',
      extraTriggerBlocks: [
        { kind: 'trigger', on: 'on_hit', effectRef: 'eff_pollution_spray' },
        { kind: 'trigger', on: 'cd', cdSec: 10, effectRef: 'eff_pollution_tide' },
      ],
      stackRules: [{ ruleId: 'n368_hit_rage', on: 'was_hit', stat: 'atkPct', perStack: 0.06 }],
      note: 'n368 污染之心（变体·Ron 定名·段2 手调）：受击狂暴（+6%/次=污染体放大）+喷毒放大（命中挂燃烧）+周期污染潮——净化+护罩双钥（钥匙=宝库流通②·A7 说明书）',
    },
    effects: [],
    phases: [],
  },
  // ===== n384 · 前哨 风暴哨兵（Ron 定名变体·锁定打击放大+快节奏·毕业核货架亮起位·不卡天）=====
  // 快节奏形状=BOSS_SHAPE_OVERRIDE.n384（interval 1.4 快锤）。
  n384: {
    boss: {
      ultimateEffectRef: 'eff_boss_n384_lock', ultimateCdSec: 8,
      note: 'n384 风暴哨兵（变体·Ron 定名·段2 手调）：锁定打击放大+增幅域快节奏（毕业核货架进度闩位=vaultGradUnlockNode 384）',
    },
    effects: [
      { rowId: 'eff_boss_n384_lock', effectKind: 'ultimate', effectType: 'backline_strike', effectPower: 1.5, targetingTag: 'backline_first', durationSec: 0, maxTargets: 2, stateTag: 'none', summonUnitRef: 'none', note: '锁定打击放大（点名者机制·快节奏 cd8）' },
      { rowId: 'eff_boss_n384_frenzy', effectKind: 'state', effectType: 'berserk', effectPower: 0, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'berserk', summonUnitRef: 'none', note: '半血狂暴（前哨硬仗压迫）' },
    ],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_boss_n384_frenzy'], note: '半血狂暴（硬仗档·不卡天）' },
    ],
  },
  // ===== n400 · 墙⑧ 风暴壁垒（Ron 定名变体·战力+连战叠加墙=重装群海+复活波次连战）=====
  // 波次击杀密度=超新星连环引爆舞台（A 案 −1.5s/杀·reviveWaves 2=三遍海量击杀）；重装形状=SHAPE_OVERRIDE.n400。
  n400: {
    boss: {
      ultimateEffectRef: 'eff_ult_clear_barrage', ultimateCdSec: 10,
      note: 'n400 风暴壁垒（变体·Ron 定名·段2 手调）：重装群海+复活波次连战 ×2——波次击杀密度=超新星连环引爆舞台（毕业核钥匙墙·A7 说明书）',
    },
    effects: [],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 50, summonUnitRefs: ['bu_enemy_boss_add', 'bu_enemy_boss_add', 'bu_enemy_boss_add', 'bu_enemy_boss_add'], summonCountCap: 4, effectRefs: ['eff_state_vulnerable'], note: '半血再爆一波海+召唤硬直易伤窗（击杀密度舞台）' },
    ],
    adds: [['swarm_tough', 4], ['shield', 3]], // 重装群海：滚石肉墙+自盾敌
    encounter: { reviveWaves: 2 }, // 连战 ×2（数值域定报备·矩阵卡天最重墙+超新星舞台=击杀总量×3）
  },
  // ===== n450 · 墙⑨ 星能污染核心（真源§5 原班终Boss·3 阶段·六规则全叠载体·挂起测换载体位）=====
  // 真源：阶段1 护盾、阶段2 召唤+后排点名、阶段3 狂暴全屏（先狂暴后全屏=§20.11 A4④ 旧 n150 效果序迁移）。
  n450: {
    boss: {
      normalEffectRef: 'eff_normal_polluted',
      extraTriggerBlocks: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_boss_n450_shield' }],
      note: 'n450 星能污染核心（真源§5 原班终Boss·段2 手调+段4 六叠）：3 阶段=开局护盾→召唤+点名→狂暴全屏；六规则全叠=EYE_RULES 通用面（潮/增幅/连战/坟场）+本声明 adds 面（母舰=流水线·延迟环卫=迷雾）',
    },
    // 段4 六叠 adds 面：量产母舰（assembly·拆速三态）+污染体环卫延迟 10s 现身（mist·开局核打不到）。
    adds: [['pollution', 3, 10], ['summon_source', 1]],
    effects: [
      { rowId: 'eff_boss_n450_shield', effectKind: 'state', effectType: 'shield', effectPower: 4, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'shield', summonUnitRef: 'none', note: '阶段1 护盾（破盾=毕业战第一课）' },
      { rowId: 'eff_boss_n450_frenzy', effectKind: 'state', effectType: 'berserk', effectPower: 0, targetingTag: 'self_team', durationSec: 999, maxTargets: 1, stateTag: 'berserk', summonUnitRef: 'none', note: '阶段3 狂暴（先狂暴后全屏=效果序）' },
    ],
    phases: [
      { tag: 'mid', triggerType: 'hp_pct_below', triggerValue: 60, effectRefs: ['eff_ult_backline_strike'], summonUnitRefs: ['bu_enemy_pollution', 'bu_enemy_boss_add', 'bu_enemy_boss_add'], summonCountCap: 3, note: '阶段2（mid@60）：召唤（污染体+无人机）+后排点名（phaseTag 值域=mid/final·3 阶段=开局盾+mid+final）' },
      { tag: 'final', triggerType: 'hp_pct_below', triggerValue: 25, effectRefs: ['eff_boss_n450_frenzy', 'eff_s7_cataclysm'], note: '阶段3：狂暴全屏（eff_s7_cataclysm=⑩A4 载体迁移）' },
    ],
  },
};

/**
 * FORMATION_OVERRIDE：节点关摆阵手调（键=nodeId·全关级声明——该关所有波格位一次给全，
 *   缺波=throw 防"半截手调"）。boss='rXcY'（Boss 锚格）；waves=[slotRefs[],…] 按该关
 *   spawn 生成顺序对位（Boss 关=adds 波序·普通/精英关=w1,w2,…）。
 * 手调者自保零撞格+版图合法（validator 兜格位语法·引擎 canPlace 兜冲突·s7-formation-check 兜美感）。
 * 填表窗口=段2 节点关摆阵（13 Boss+38 精英·C 项②）。
 */
const FORMATION_OVERRIDE = {
  // ===== 13 Boss 逐关手调（C 项②·Ron 摆阵美感规格：左右对称/阵心居中/自然有构图）=====
  // 契约：boss=2×2 锚格；waves 按 adds 波序给全（全关级声明）；全部关于 r2 镜像对称；
  // 构图跟机制走（奶后置/塔深藏/盾墙前压/壁垒两层……）——"阵"感为机制服务。
  // 38 精英：走量对称版式先行；个性摆位（奇阵=阵型即花样本体）随段3 ELITE_CONTENT 花样载体一体落。
  n054: { boss: 'r1c2', waves: [['r0c0', 'r2c0', 'r4c0', 'r1c1', 'r3c1']] }, // 大副小阵仗：疏扇前哨+双亲兵——"小弟拱卫"
  n104: { boss: 'r1c2', waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0', 'r2c1']] }, // 大王：洞心横列+亲兵居中——"众星拱月"
  n140: { boss: 'r1c2', waves: [['r1c4', 'r3c4'], ['r1c0', 'r2c0', 'r3c0']] }, // 再生者：修理机藏 Boss 身后（点治疗源教学的视觉表达）+滚石挡前
  n176: { boss: 'r1c2', waves: [['r0c1', 'r4c1'], ['r1c4', 'r3c4']] }, // 泰坦：磁暴塔两翼+修理机后勤——重锤居中塔翼奶后
  n214: { boss: 'r1c2', waves: [['r0c0', 'r2c0', 'r4c0']] }, // 巡卫母垒：疏排盾墙横陈中线——"盾墙演出"开幕构图
  n250: { boss: 'r1c2', waves: [['r1c0', 'r3c0', 'r0c1', 'r4c1']] }, // 失控母舰：无人机环形护航（段3 首件随 adds 换载体同改·前双卫+翼后双卫·点名语义=Boss 自身周期点名）
  n282: { boss: 'r1c2', waves: [['r0c1', 'r4c1']] }, // 指挥官：母舰单元两翼量产线
  n312: { boss: 'r1c2', waves: [['r0c0', 'r4c0'], ['r1c4', 'r3c4']] }, // 量产中枢：前置车间+后勤奶——纵深流水线
  n340: { boss: 'r1c2', waves: [['r0c0', 'r2c0', 'r4c0']] }, // 污染巨兽：污染体疏排毒雾前线
  n368: { boss: 'r1c2', waves: [['r1c0', 'r2c0', 'r3c0']] }, // 污染之心：紧凑毒心卫队
  n384: { boss: 'r1c2', waves: [['r1c0', 'r2c0', 'r3c0']] }, // 风暴哨兵：突击楔（快节奏前压）
  n400: { boss: 'r1c2', waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0'], ['r1c1', 'r2c1', 'r3c1']] }, // 风暴壁垒：洞心肉墙+二线盾——两层壁垒名实相符
  n450: { boss: 'r1c3', waves: [['r0c1', 'r2c1', 'r4c1'], ['r2c5']] }, // 终Boss：锚深一层（c3-c4·压轴纵深）+污染体延迟环卫（迷雾）+量产母舰藏最深（流水线）·c0 留白=决战开阔感
  // ===== 38 精英个性摆位（段3 C 项②·奇阵=阵型即花样本体·源单位位置=玩法语义：词缀源/斩首目标
  // 藏深处=点它有代价；镜像 4 关无 spawn、福利 6 关走量对称版式=不进表）=====
  n007: { waves: [['r2c3'], ['r1c2', 'r3c2'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 词缀源居中深处+点名塔双卫+洞心前排
  n020: { waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0'], ['r0c1', 'r1c1', 'r3c1', 'r4c1']] }, // 贴脸：双层洞心墙全压中线
  n033: { waves: [['r2c4'], ['r1c0', 'r2c0', 'r3c0', 'r1c1', 'r3c1']] }, // 斩首：母舰深藏 c4·杂兵楔形挡路
  n068: { waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0'], ['r0c4', 'r1c4', 'r3c4', 'r4c4']] }, // 包围：前贴+后纵两团夹层
  n088: { waves: [['r2c4'], ['r1c3', 'r3c3'], ['r1c0', 'r2c0', 'r3c0', 'r1c1', 'r3c1']] }, // 词缀源深+塔中卫+楔形前阵
  n122: { waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0'], ['r1c1', 'r2c1', 'r3c1']] }, // 贴脸：洞心+楔形双层
  n128: { waves: [['r2c3'], ['r1c4', 'r3c4'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 词缀源中·塔更深·滚石洞心
  n142: { waves: [['r1c5', 'r3c5'], ['r1c0', 'r2c0', 'r3c0', 'r1c1', 'r3c1']] }, // 斩首升档：双修理机极深·肉墙楔形
  n150: { waves: [['r2c2'], ['r0c1', 'r4c1', 'r1c3', 'r3c3', 'r2c0']] }, // 奇阵+词缀：环形拱卫词缀源（环心 c2）
  n165: { waves: [['r2c4'], ['r1c3', 'r3c3'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 速鼓源深位变体
  n168: { waves: [['r0c0', 'r1c0', 'r3c0', 'r4c0', 'r1c4', 'r3c4'], ['r1c5', 'r3c5']] }, // 包围Ⅰ：前四后二夹+磁暴塔深翼
  n192: { waves: [['r2c3'], ['r1c0', 'r2c0', 'r3c0', 'r1c1', 'r3c1']] }, // 词缀源+楔形
  n198: { waves: [['r2c5'], ['r1c1', 'r3c1'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 斩首目标=词缀源极深·盾双卫·洞心前排
  n224: { waves: [['r1c4', 'r2c4', 'r3c4'], ['r1c6', 'r3c6']] }, // 龟缩：全阵 c4+·点名塔贴最深墙
  n238: { waves: [['r2c4'], ['r1c5', 'r3c5'], ['r1c0', 'r3c0']] }, // 词缀源+塔纵深梯队·盾前
  n244: { waves: [['r1c3', 'r3c3'], ['r0c0', 'r1c0', 'r3c0', 'r4c0', 'r1c5', 'r3c5']] }, // 包围Ⅱ：盾中枢+前四后二重夹
  n258: { waves: [['r1c4', 'r3c4'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 复活连战：双母舰后置流水线+无人机洞心
  n284: { waves: [['r2c3'], ['r2c5'], ['r1c0', 'r2c0', 'r3c0']] }, // 词缀源中+母舰极深+楔形
  n290: { waves: [['r2c4'], ['r0c1', 'r4c1', 'r1c3', 'r3c3']] }, // 斩首+奇阵：环形拱卫深处目标
  n298: { waves: [['r1c4'], ['r3c4'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 双词缀源对称深位（各一波）+洞心
  n306: { waves: [['r2c4'], ['r2c2'], ['r0c0', 'r1c0', 'r3c0', 'r4c0']] }, // 复活+词缀：源深·母舰中·洞心前
  n320: { waves: [['r2c5'], ['r0c1', 'r2c1', 'r4c1'], ['r1c0', 'r2c0', 'r3c0']] }, // 变态①三层环阵：词缀源极深·污染体疏中·楔形前
  n344: { waves: [['r2c3'], ['r1c1', 'r3c1'], ['r0c0', 'r2c0', 'r4c0']] }, // 词缀源+污染双卫+疏排前
  n348: { waves: [['r0c2', 'r2c2', 'r4c2'], ['r1c0', 'r2c0', 'r3c0']] }, // 复活+奇阵：污染疏中层+楔形前（环形纵深）
  n356: { waves: [['r1c4'], ['r3c4'], ['r1c0', 'r2c0', 'r3c0'], ['r0c1', 'r4c1']] }, // 段4 续调：双源对称深位+污染楔+杂兵翼卫
  n362: { waves: [['r1c5', 'r3c5'], ['r1c0', 'r2c0', 'r3c0']] }, // 斩首+复活：双修理机极深·污染楔前
  n390: { waves: [['r2c5'], ['r0c1', 'r2c1', 'r4c1'], ['r1c0', 'r3c0']] }, // 变态③：词缀源极深·爆发疏中·前锋双卫
  n396: { waves: [['r1c0', 'r2c0', 'r3c0'], ['r0c1', 'r2c1', 'r4c1']] }, // 贴脸：爆发楔+前锋疏两层压线
};

/**
 * ELITE_CONTENT：38 精英花样声明（段3 填表·剧本 v1.3 精英表一字对齐）。
 *   kind: 花样名（=剧本表原文·M10 同型禁连排校验源——firstType=split(/[+·（]/)[0] 剧本生成器同口径）；
 *   tier: 五档（福利/无压力/微阻滞/阻滞/变态·写入 encounter.eliteTier=entry 五档带查表源）；
 *   waves: 波次覆写（缺省 ELITE_WAVES[tag]·镜像关由 encounter.mirrorLineup 触发零 spawn）；
 *   encounter: 花样件（victoryRule+victoryTargetUnitRef〔全局行名·apply ②c 节点化〕/reviveWaves/
 *              mirrorLineup+mirrorScalePct）；
 *   effects: 关级专属效果行全量字段数组（段6 起·rowId 必须落 eff_elite_<nodeId>_* 命名域·本工具
 *            先删后建=BOSS_CONTENT.effects 同构；节点行引用重定向=lib ELITE_EFFECT_REDIRECT）。
 * 六族载体（段3 盘点定案）：词缀=rally_source/rally_haste_source 强化源单位（真源§1 星盗船长·
 *   击杀即停 counterplay）；奇阵=FORMATION_OVERRIDE 摆位本体；斩首=victoryRule（杀点名单位即胜·
 *   目标藏深处）；镜像=mirrorLineup+缩放通道；复活连战=reviveWaves；福利=档位白送（0.3/0.3）零账变。
 */
const ELITE_CONTENT = {
  // —— sf01 星港边域（swarm 域）——
  n007: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_source', 1], ['backline', 2], ['swarm', 4]] },
  n020: { kind: '奇阵·贴脸（纯）', tier: '微阻滞', waves: [['swarm_tough', 4], ['swarm', 4]] }, // 贴脸=FORMATION 双层全压中线
  n033: { kind: '限时斩首（纯·引擎通道首秀）', tier: '无压力', waves: [['summon_source', 1], ['swarm', 5]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_summon_source' } },
  n068: { kind: '奇阵·包围（纯）', tier: '无压力', waves: [['swarm', 4], ['swarm', 4]] }, // 包围=前贴+后纵两团夹层
  n088: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_source', 1], ['backline', 2], ['swarm', 5]] },
  // —— sf02 废铁坟场（backline 域）——
  n116: { kind: '福利·合金（纯福利）', tier: '福利', waves: [['swarm', 5]] },
  n122: { kind: '奇阵·贴脸（纯）', tier: '无压力', waves: [['swarm', 4], ['swarm', 3]] },
  n128: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_source', 1], ['backline', 2], ['swarm_tough', 4]] },
  n142: { kind: '限时斩首（纯·参数升档）', tier: '微阻滞', waves: [['support', 2], ['swarm_tough', 5]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_support' } }, // 升档=目标 2 只全灭（杀修理机·废铁味）
  n150: { kind: '奇阵+词缀（1+1 首秀）', tier: '微阻滞', waves: [['rally_source', 1], ['swarm_tough', 5]] }, // 环形拱卫词缀源
  n165: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_haste_source', 1], ['backline', 2], ['swarm_tough', 4]] }, // 词缀分档=速鼓
  n168: { kind: '奇阵·包围（纯·参数升档Ⅰ）', tier: '阻滞', waves: [['swarm_tough', 6], ['stormtower', 2]] },
  // —— sf03 迷雾星尘带（shield 域）——
  n186: { kind: '镜像关（纯·新花样②首秀）', tier: '微阻滞', encounter: { mirrorLineup: true, mirrorScalePct: 0.95 } }, // 段4 续调R1（总控裁：首秀 25% 比升档 45% 难=倒挂·二分 0.9-1.0）·第4轮（先手优势实测量化：×1.75 才压到 55-70——微阻滞 40-60 需 ×1.9 级）·第2轮：同强对称战我方必胜（同 tick 先手滚雪球=引擎结构面实测）——scale 补偿先手优势
  n192: { kind: '词缀点名（纯）', tier: '无压力', waves: [['rally_source', 1], ['swarm', 5]] },
  n198: { kind: '斩首+词缀（1+1）', tier: '微阻滞', waves: [['rally_source', 1], ['shield', 2], ['swarm', 4]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_rally_source' } }, // 两花样咬合：杀词缀源即胜
  n208: { kind: '福利·驾驶记录（纯福利）', tier: '福利', waves: [['swarm', 5]] },
  n224: { kind: '奇阵·龟缩+迷雾藏兵（1+1·域规则联动）', tier: '阻滞', waves: [['shield', 3], ['backline', 2]] }, // 龟缩=全阵深处（迷雾藏兵=段4 域规则·摆位先落）
  n232: { kind: '福利·星贝（纯福利）', tier: '福利', waves: [['swarm', 5]] },
  n238: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_source', 1], ['backline', 2], ['shield', 2]] },
  n244: { kind: '奇阵·包围（纯·参数升档Ⅱ）', tier: '阻滞', waves: [['shield', 2], ['swarm_tough', 6]] },
  // —— sf04 母舰工业区（summon 域）——
  n258: { kind: '满血复活连战（纯·精英版）', tier: '微阻滞', waves: [['summon_source', 2], ['boss_add', 4]], encounter: { reviveWaves: 1 } },
  n266: { kind: '镜像+词缀（1+1·参数升档）', tier: '阻滞', encounter: { mirrorLineup: true, mirrorScalePct: 1.12 } }, // 段4 续调R2 终（40 样本提精度）·R1（总控裁：5-15%=错落变态带·二分 1.05-1.15）·词缀语义=镜像敌带强化·第2轮抬（先手补偿+阻滞档）
  n274: { kind: '福利·星贝（纯福利）', tier: '福利', waves: [['swarm', 5]] },
  n284: { kind: '词缀点名（纯）', tier: '无压力', waves: [['rally_source', 1], ['summon_source', 1], ['boss_add', 3]] },
  n290: { kind: '斩首+奇阵（1+1）', tier: '微阻滞', waves: [['summon_source', 1], ['boss_add', 4]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_summon_source' } }, // 环形拱卫目标
  n298: { kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_source', 1], ['rally_haste_source', 1], ['boss_add', 4]] }, // 双词缀源
  n306: { kind: '复活连战+词缀（1+1）', tier: '阻滞', waves: [['rally_source', 1], ['summon_source', 1], ['boss_add', 4]], encounter: { reviveWaves: 1 } },
  // —— sf05 污染之海（berserk 域）——
  n320: { kind: '斩首+词缀+奇阵（1+1+1 首秀）', tier: '变态', waves: [['rally_source', 1], ['pollution', 3], ['swarm_tough', 3]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_rally_source' } }, // 变态①：三层环阵拱卫词缀源·杀源即胜
  n330: { kind: '福利·合金（纯福利·垫关）', tier: '福利', waves: [['swarm', 5]] },
  n336: { kind: '镜像关（纯·参数升档）', tier: '微阻滞', encounter: { mirrorLineup: true, mirrorScalePct: 1.0 } },
  n344: { kind: '词缀点名（纯）', tier: '无压力', waves: [['rally_source', 1], ['pollution', 2], ['swarm', 3]] },
  n348: { kind: '复活+奇阵（1+1）', tier: '微阻滞', waves: [['pollution', 3], ['swarm', 3]], encounter: { reviveWaves: 1 } },
  n356: {
    kind: '词缀点名（纯）', tier: '微阻滞', waves: [['rally_haste_source', 1], ['rally_source', 1], ['pollution', 3], ['swarm', 2]], // 段4 续调R1（总控裁白板化不接受）：下一杆=双源（攻+速双词缀·分摊集火窗·杀完两源才白板）
    // 段6 升级案（§21.3b·总控批）：速鼓效果行全局共享（n165/n356 同用 eff_s7_elite_rally_haste）→
    // 关级变体行解耦（lib ELITE_EFFECT_REDIRECT 指回）——幅度杆独立可调不连带在带的 n165。
    // 初值=全局同值 0.2（零行为差基线·调参轮账见 §21.6）。
    effects: [{
      rowId: 'eff_elite_n356_rally_haste', effectKind: 'state', effectType: 'apply_state', effectPower: 0,
      targetingTag: 'self_block_area', durationSec: 6, maxTargets: 8, stateTag: 'atk_speed_up', stateAmount: 0.2,
      summonUnitRef: 'none', note: 'n356 速鼓关级变体（段6 升级案·与全局行解耦·幅度独立调·现值=全局同值 0.2〔两轮无效刀已撤·候裁喘气关语义·§21.6〕）',
    }],
  },
  n362: { kind: '斩首+复活（1+1）', tier: '阻滞', waves: [['support', 2], ['pollution', 3]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_support', reviveWaves: 1 } }, // 连战里点奶=斩首×耐力
  // —— sf06 风暴核心（burst 域）——
  n372: { kind: '镜像+词缀+奇阵（1+1+1）', tier: '变态', encounter: { mirrorLineup: true, mirrorScalePct: 1.25 } }, // 变态②·第4轮：敌比我强 75%（先手补偿+变态档）
  n378: { kind: '福利·驾驶记录（纯福利·垫关）', tier: '福利', waves: [['swarm', 5]] },
  n390: { kind: '斩首+复活+词缀（1+1+1·变态组合预告）', tier: '变态', waves: [['rally_source', 1], ['burst_raider', 3], ['charge', 2]], encounter: { victoryRule: 'kill_target', victoryTargetUnitRef: 'bu_enemy_rally_source', reviveWaves: 2 } }, // 变态③压轴：两遍连战×杀深处词缀源
  n396: { kind: '奇阵·贴脸（纯）', tier: '微阻滞', waves: [['burst_raider', 3], ['charge', 3]] },
};

/** eff_boss_nXXX_* 命名域正则（本工具独管·与 apply 的 eff_nXXX_summon 域零交集）。 */
const BOSS_EFFECT_RE = /^eff_boss_n\d+_/;

// ============================================================================
// 格位铺排 v2（C① 摆阵美感规格·Ron 2026-07-15 立·memory enemy-formation-aesthetics）
// 坐标契约（引擎/演出层实读钉死·B0.7 s7FieldVisualCell+S7AutoBattleEngine.dist=ec+1+(2-pc)+|pr-er|）：
//   row=屏幕横向（r0-r4·对称轴 r2）、col=纵深（c0 贴中线=最靠玩家·c6 最深）。
// 规格三条落法：①左右基本对称=每层（同 col）row 集关于 r2 镜像；②阵心=横向居中由 r2 轴天然
//   满足，纵深沿"贴中线起"铺（与旧世界"铺前排"手感口径一致·纵深整体偏移的自由留节点关手调层）；
//   ③自然禁棋盘=禁 5 连横（[0..4] 全占版式不入库）+层间错行（相邻层集合互异出楔形/箭头感）+
//   同 count 多版式按 (节点号×7+波序) 确定性轮换（域内有变化·零随机可重放）。
// 旧 rowSlots（col 中心向外+row 递增）在 B0.7 语义下实际产出"纵深纵队串"（n104 adds
//   r2c1..r2c5 磁盘实录），随本版退役（段2 C①）。教学段 n001-n008 spawn 原行保留不套本规格。
// ============================================================================

/** 同 count 对称版式库：每版式=层序列，层=关于 r2 镜像对称的 row 集（升序）。全库无 [0,1,2,3,4] 五连横。 */
const LAYER_PATTERNS = {
  1: [[[2]]],
  2: [[[1, 3]], [[0, 4]]],
  3: [[[1, 2, 3]], [[0, 2, 4]]],
  4: [[[0, 1, 3, 4]], [[1, 3], [1, 3]]],
  5: [[[1, 2, 3], [1, 3]], [[0, 1, 3, 4], [2]]],
  6: [[[1, 2, 3], [1, 2, 3]], [[0, 1, 3, 4], [1, 3]]],
  7: [[[0, 1, 3, 4], [1, 2, 3]], [[1, 2, 3], [0, 1, 3, 4]]],
  8: [[[0, 1, 3, 4], [0, 1, 3, 4]], [[0, 2, 4], [1, 3], [0, 2, 4]]],
  9: [[[0, 1, 3, 4], [1, 2, 3], [1, 3]], [[0, 2, 4], [1, 2, 3], [0, 2, 4]]],
  10: [[[0, 1, 3, 4], [1, 2, 3], [1, 2, 3]], [[0, 1, 3, 4], [1, 3], [0, 1, 3, 4]]],
  11: [[[0, 1, 3, 4], [1, 2, 3], [0, 1, 3, 4]]],
  12: [[[0, 1, 3, 4], [0, 1, 3, 4], [0, 1, 3, 4]]],
};

/** 对称铺格：count 只从 fromCol 层起纵深铺，返回格位表＋占用层数（下一波从其后层起=波间零格冲突）。 */
function symmetricSlots(count, fromCol, variantSeed) {
  const patterns = LAYER_PATTERNS[count];
  let layers;
  if (patterns) {
    layers = patterns[variantSeed % patterns.length];
  } else {
    // >12 兜底：4 只/层洞心阵循环+余数层查表（走量波次现值 ≤12·此支为参数变更保险）。
    layers = [];
    let left = count;
    while (left > 4) { layers.push([0, 1, 3, 4]); left -= 4; }
    layers.push(...LAYER_PATTERNS[left][0]);
  }
  const slots = [];
  layers.forEach((rows, li) => {
    const col = fromCol + li;
    if (col > 6) throw new Error(`纵深越界：fromCol=${fromCol} 层数=${layers.length}（敌方 7 列封顶）`);
    for (const r of rows) slots.push(`r${r}c${col}`);
  });
  return { slots, layersUsed: layers.length };
}

// ============================================================================
// 生成
// ============================================================================

/** 段3 M10 校验（剧本生成器同口径照抄·对 ELITE_CONTENT 声明跑）：38 关全声明+同型禁连排
 *  （相邻 kind 首词不同·firstType=split(/[+·（]/)[0]）+五档分布 6/6/17/6/3+福利互锁。 */
function checkEliteDeclarations() {
  const eliteIds = mainline.filter((r) => r.nodeTypeTag === 'elite').map((r) => r.nodeId);
  const missing = eliteIds.filter((id) => !ELITE_CONTENT[id]);
  if (missing.length) throw new Error(`ELITE_CONTENT 缺声明：${missing.join(',')}（段3 起 38 关全声明）`);
  const firstType = (k) => k.split(/[+·（]/)[0];
  const TIER_TARGET = { 福利: 6, 无压力: 6, 微阻滞: 17, 阻滞: 6, 变态: 3 };
  const tierCount = {};
  for (let i = 0; i < eliteIds.length; i += 1) {
    const d = ELITE_CONTENT[eliteIds[i]];
    if (!d.kind || !d.tier) throw new Error(`${eliteIds[i]} 声明缺 kind/tier`);
    tierCount[d.tier] = (tierCount[d.tier] ?? 0) + 1;
    if (d.kind.startsWith('福利') !== (d.tier === '福利')) throw new Error(`${eliteIds[i]} 福利花样与福利档不互锁`);
    if (i > 0 && firstType(d.kind) === firstType(ELITE_CONTENT[eliteIds[i - 1]].kind)) {
      throw new Error(`M10 同型连排：${eliteIds[i - 1]}(${ELITE_CONTENT[eliteIds[i - 1]].kind}) → ${eliteIds[i]}(${d.kind})`);
    }
  }
  for (const [tier, n] of Object.entries(TIER_TARGET)) {
    if ((tierCount[tier] ?? 0) !== n) throw new Error(`M10 档位分布：${tier}=${tierCount[tier] ?? 0} ≠ ${n}`);
  }
}

/** 段4 · 眼段域规则 → encounter 字段翻译（tide=小潮 cd8 4%P+大潮 cd20 8%P·surge=开场敌我 +25%·
 *  battlewave=连战 ×1；attackPof→attack 由 apply ②d 落数=三方对称）。 */
function eyeEncounterFields(rules) {
  const env = [];
  if (rules.includes('tide')) {
    env.push(
      { on: 'cd', cdSec: 8, effectRef: 'eff_pollution_tide', side: 'player', attackPof: 0.04 },
      { on: 'cd', cdSec: 20, effectRef: 'eff_pollution_tide', side: 'player', attackPof: 0.08 },
    );
  }
  if (rules.includes('surge')) env.push({ on: 'battle_start', effectRef: 'eff_s7_env_storm_surge', side: 'both' });
  return {
    ...(env.length > 0 ? { environmentBlocks: env } : {}),
    ...(rules.includes('battlewave') ? { reviveWaves: 1 } : {}),
  };
}

function buildBundle(tables) {
  checkEliteDeclarations();
  const stat = { encounters: 0, spawns: 0, bossRows: 0, phases: 0 };
  const oldEnc = tables.battle_encounter_param;
  const oldSpawn = tables.battle_spawn_param;
  const units = tables.battle_unit_stat_param;

  // —— 全局行面：删除不在新世界 Boss 位的旧 bu_boss_* 行，按新 13 位建骨架行。
  const bossNums = mainline.filter((r) => r.nodeTypeTag === 'boss').map((r) => r.nodeId);
  const bossSet = new Set(bossNums);
  const keptUnits = units.filter((r) => {
    const m = r.rowId.match(/^bu_boss_(n\d{3})$/);
    return !m || bossSet.has(m[1]);
  });
  const existingBoss = new Set(keptUnits.filter((r) => /^bu_boss_n\d{3}$/.test(r.rowId)).map((r) => r.rowId));
  const bossTemplateRow = units.find((r) => r.rowId === 'bu_boss_n060') ?? units.find((r) => /^bu_boss_n\d{3}$/.test(r.rowId));
  if (!bossTemplateRow) throw new Error('缺 Boss 行结构模板（bu_boss_*）');
  let ultIdx = 0;
  for (const nodeId of bossNums) {
    const rowId = `bu_boss_${nodeId}`;
    const decl = BOSS_CONTENT[nodeId];
    const existing = keptUnits.find((r) => r.rowId === rowId);
    if (existing) {
      // 已有行保留骨架值（血攻防=apply 落数域不碰）；BOSS_CONTENT.boss 声明字段每次重放=声明是真源。
      if (decl?.boss) Object.assign(existing, decl.boss);
      continue;
    }
    const node = mainline.find((r) => r.nodeId === nodeId);
    keptUnits.push({
      ...bossTemplateRow,
      rowId,
      unitRef: nodeId,
      roleTag: `boss_${node.problemTagRef}`,
      targetingTag: 'nearest_random_tie',
      normalEffectRef: 'eff_basic_attack',
      ultimateEffectRef: BOSS_ULT_PLACEHOLDER[ultIdx++ % BOSS_ULT_PLACEHOLDER.length],
      ultimateCdSec: 10,
      coreEffectRef: 'none',
      note: `${nodeId} Boss 骨架占位（450 关走量·域主题=${node.problemTagRef}·真机制=段2 对位真源§5 手调）`,
      ...(decl?.boss ?? {}),
    });
    stat.bossRows += 1;
  }
  tables.battle_unit_stat_param = keptUnits;

  // —— eff_boss_nXXX_* 效果域：本工具独管——先删本域全部行，再按 BOSS_CONTENT 声明重建（重跑=声明重放）。
  const keptEffects = tables.battle_effect_param.filter((r) => !BOSS_EFFECT_RE.test(r.rowId));
  for (const [nodeId, decl] of Object.entries(BOSS_CONTENT)) {
    for (const eff of decl.effects ?? []) {
      if (!eff.rowId || !eff.rowId.startsWith(`eff_boss_${nodeId}_`)) {
        throw new Error(`BOSS_CONTENT[${nodeId}] 效果行 rowId 必须落 eff_boss_${nodeId}_* 命名域：${eff.rowId}`);
      }
      keptEffects.push({ schemaVersion: SCHEMA, ...eff });
      stat.bossEffects = (stat.bossEffects ?? 0) + 1;
    }
  }
  tables.battle_effect_param = keptEffects;

  // —— eff_elite_nXXX_* 效果域（段6·总控批）：BOSS 域同构——先删后建=ELITE_CONTENT.effects 声明重放；
  //    消费闭环=lib ELITE_EFFECT_REDIRECT（apply 造节点行时把 extraTriggerBlocks 引用换成本域变体行）。
  const keptEffects2 = tables.battle_effect_param.filter((r) => !ELITE_EFFECT_RE.test(r.rowId));
  for (const [nodeId, decl] of Object.entries(ELITE_CONTENT)) {
    for (const eff of decl.effects ?? []) {
      if (!eff.rowId || !eff.rowId.startsWith(`eff_elite_${nodeId}_`)) {
        throw new Error(`ELITE_CONTENT[${nodeId}] 效果行 rowId 必须落 eff_elite_${nodeId}_* 命名域：${eff.rowId}`);
      }
      keptEffects2.push({ schemaVersion: SCHEMA, ...eff });
      stat.eliteEffects = (stat.eliteEffects ?? 0) + 1;
    }
  }
  tables.battle_effect_param = keptEffects2;

  // —— encounter/spawn/phase：教学段 n001-n008 原行保留，n009+ 全重建。
  // 教学段保留面=敌配属性/波次/格位一字不动；stageType 标签跟 mainline 对齐
  // （新世界精英位挪动：旧 n006 elite→normal、n007 normal→elite——validator 一致性铁则）。
  const keepEnc = oldEnc.filter((e) => /^n00[1-8]$/.test(e.nodeRef)).map((e) => {
    const node = mainline.find((r) => r.nodeId === e.nodeRef);
    const stage = node.nodeTypeTag === 'boss' ? 'boss'
      : node.nodeTypeTag === 'elite' ? 'elite'
        : node.nodeTypeTag === 'tutorial_battle' ? e.stageType // 教学战斗节点沿原标签（n001-n005）
          : 'normal';
    return e.stageType === stage ? e : { ...e, stageType: stage };
  });
  const keepSpawn = oldSpawn.filter((s) => /^spawn_n00[1-8]_/.test(s.rowId));
  const newEnc = [];
  const newSpawn = [];
  const newPhases = [];

  for (const node of mainline) {
    const num = Number(node.nodeId.slice(1));
    if (num <= TEACHING_MAX_NODE) continue;
    if (node.nodeTypeTag === 'reset_gate' || node.nodeTypeTag === 'protection_notice') continue;
    const nodeId = node.nodeId;
    const tag = node.problemTagRef;
    const isBoss = node.nodeTypeTag === 'boss';
    const isElite = node.nodeTypeTag === 'elite';
    const stage = isBoss ? 'boss' : isElite ? 'elite' : 'normal';
    const spawnRefs = [];
    const unitRefs = new Set();

    // 全关级摆阵手调声明（FORMATION_OVERRIDE·有=该关所有波格位显式给全，缺波=throw 防半截手调）。
    const fo = FORMATION_OVERRIDE[nodeId];
    const overrideWave = (waveIdx0, fallbackFn) => {
      if (!fo) return fallbackFn();
      const slots = fo.waves?.[waveIdx0];
      if (!slots) throw new Error(`FORMATION_OVERRIDE[${nodeId}] 缺第 ${waveIdx0 + 1} 波格位（全关级声明必须给全）`);
      return { slots, layersUsed: 0 }; // 显式格表不参与层推进（手调者自保零撞格）
    };

    if (isBoss) {
      const bossRowId = `bu_boss_${nodeId}`;
      // Boss 2×2 锚 r1c2（占 r1-r2 × c2-c3）：几何中心横向偏轴 0.5 格=5 横位场对偶宽件无整数
      // 居中解，属规格"基本对称"容差（旧 r0c2=占 r0-r1 贴横向最左·随 C① 修正）；纵深 c2 起
      // =身前 c0-c1 留给 adds 挡刀层（零占格冲突·layersUsed 断言防撞）。逐关微调=FORMATION_OVERRIDE 手调层。
      newSpawn.push({
        schemaVersion: SCHEMA, rowId: `spawn_${nodeId}_boss`, encounterRef: `enc_${nodeId}`, waveIndex: 1,
        unitStatRef: bossRowId, count: 1, slotRefs: [fo?.boss ?? 'r1c2'], spawnDelaySec: 0, maxConcurrentOnField: 12,
        note: `enc_${nodeId} 第1波：${bossRowId} x1`,
      });
      spawnRefs.push(`spawn_${nodeId}_boss`);
      unitRefs.add(bossRowId);
      const decl = BOSS_CONTENT[nodeId];
      const adds = decl?.adds ?? BOSS_ADDS[tag] ?? BOSS_ADDS.swarm;
      let addWave = 0;
      let addsCol = 0; // adds 从 c0 贴中线起逐层铺（Boss 身前挡刀语义）
      for (const [suffix, count, delaySec] of adds) {
        addWave += 1;
        const sid = `spawn_${nodeId}_adds${adds.length > 1 ? addWave : ''}`;
        // Boss 场 adds 版式固定首版（每 count 最紧凑=层数最少）：c0-c1 仅两层预算（Boss 占 c2 起），
        // 多层变体（如 4 只的 2×2 方阵）会挤爆断言——版式变化留给普通关（7 层纵深充裕）。
        const { slots, layersUsed } = overrideWave(addWave - 1, () => symmetricSlots(count, addsCol, 0));
        addsCol += layersUsed;
        if (!fo && addsCol > 2) throw new Error(`${nodeId} Boss adds 层数越过 Boss 占格（c2 起）：走量 adds 必须 ≤2 层`);
        newSpawn.push({
          schemaVersion: SCHEMA, rowId: sid, encounterRef: `enc_${nodeId}`, waveIndex: 1,
          unitStatRef: `bu_enemy_${suffix}`, count, slotRefs: slots,
          spawnDelaySec: delaySec ?? 0, maxConcurrentOnField: 12, // 段4：adds 第三元素=延迟（n450 迷雾环卫）
          note: `enc_${nodeId} 第1波 adds：bu_enemy_${suffix} x${count}${delaySec ? '（迷雾藏兵=延迟现身·眼段域规则）' : ''}`,
        });
        spawnRefs.push(sid);
        // 节点行名与 apply 的 ensureNodeRow 命名一致：spawn 引用 bu_enemy_boss_add → bu_nXXX_boss_add
        // （bu_nXXX_add 是 phase 召唤专属行名·3%/6% 特殊份额，spawn 面不用）。
        unitRefs.add(`bu_${nodeId}_${suffix}`);
      }
      // Boss 阶段：BOSS_CONTENT.phases 声明真阶段（重跑=声明重放）；无声明=通用两段占位弧线
      // （血50% 易伤窗 → 血20% 爆发窗）。
      if (decl?.phases) {
        for (const p of decl.phases) {
          newPhases.push({
            schemaVersion: SCHEMA, rowId: `phase_${nodeId}_${p.tag}`, bossNodeId: nodeId, phaseTag: p.tag,
            triggerType: p.triggerType, triggerValue: p.triggerValue, effectRefs: p.effectRefs,
            summonUnitRefs: p.summonUnitRefs ?? [], summonCountCap: p.summonCountCap ?? 0,
            note: p.note ?? `${nodeId} 真阶段（段2 BOSS_CONTENT 声明·对位真源§5）`,
          });
          stat.phases += 1;
        }
      } else {
        newPhases.push({
          schemaVersion: SCHEMA, rowId: `phase_${nodeId}_mid`, bossNodeId: nodeId, phaseTag: 'mid',
          triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_state_vulnerable'],
          summonUnitRefs: [], summonCountCap: 0, note: '中段易伤窗占位（450 关走量·真阶段=段2 对位手调）',
        });
        newPhases.push({
          schemaVersion: SCHEMA, rowId: `phase_${nodeId}_final`, bossNodeId: nodeId, phaseTag: 'final',
          triggerType: 'hp_pct_below', triggerValue: 20, effectRefs: ['eff_ult_burst_nuke'],
          summonUnitRefs: [], summonCountCap: 0, note: '残血爆发窗占位（450 关走量·真阶段=段2 对位手调）',
        });
        stat.phases += 2;
      }
    } else {
      const variants = NORMAL_WAVES[tag] ?? NORMAL_WAVES.swarm;
      // 段3：精英关吃 ELITE_CONTENT 声明（waves 覆写·镜像关零 spawn=validator isMirror 例外面）。
      const eDecl = isElite ? ELITE_CONTENT[nodeId] : undefined;
      const isMirror = eDecl?.encounter?.mirrorLineup === true;
      // 段4：眼段域规则翻译（EYE_RULES 声明·lib 共享）——spawn 面两规则：
      //   assembly=附加量产母舰波（拆速三态语义）；mist=末波延迟 10s（藏兵=开局核打不到）。
      const eyeRules = EYE_RULES[nodeId] ?? null;
      let plan = isMirror ? []
        : isElite ? (eDecl?.waves ?? ELITE_WAVES[tag] ?? ELITE_WAVES.swarm)
          : variants[num % variants.length];
      if (eyeRules && eyeRules.includes('assembly')) plan = [...plan, ['summon_source', 1]];
      const mistWaveIdx = eyeRules && eyeRules.includes('mist') ? plan.length : -1; // 末波=藏兵波
      let wave = 0;
      let nextCol = 0; // 波间从上一波占用层（纵深）的下一层起铺=零格冲突
      for (const [suffix, count] of plan) {
        wave += 1;
        const sid = `spawn_${nodeId}_w${wave}`;
        const { slots, layersUsed } = overrideWave(wave - 1, () => symmetricSlots(count, nextCol, num * 7 + wave));
        newSpawn.push({
          schemaVersion: SCHEMA, rowId: sid, encounterRef: `enc_${nodeId}`, waveIndex: wave,
          unitStatRef: `bu_enemy_${suffix}`, count, slotRefs: slots,
          spawnDelaySec: wave === mistWaveIdx ? (num <= 404 ? 5 : 10) : wave === 1 ? 0 : 5, // 检阅段（401-404）迷雾=5s 轻量亮相（碾压档 10-14s 的时长下限治理）
          maxConcurrentOnField: 14,
          note: `enc_${nodeId} 第${wave}波：bu_enemy_${suffix} x${count}${wave === mistWaveIdx ? '（迷雾藏兵=延迟现身·眼段域规则）' : ''}`,
        });
        nextCol += layersUsed;
        spawnRefs.push(sid);
        unitRefs.add(`bu_${nodeId}_${suffix}`);
      }
    }

    newEnc.push({
      schemaVersion: SCHEMA,
      rowId: `enc_${nodeId}`,
      nodeRef: nodeId,
      stageType: stage,
      templateRef: node.templateRef,
      problemTagRef: tag,
      secondaryPressureTag: node.secondaryPressureTag ?? 'none',
      pressureRef: isBoss ? `bp_${nodeId}` : `np_${node.starfieldId}`,
      enemyUnitStatRefs: [...unitRefs],
      spawnPlanRefs: spawnRefs,
      bossPhaseRefs: isBoss
        ? (BOSS_CONTENT[nodeId]?.phases?.map((p) => `phase_${nodeId}_${p.tag}`)
          ?? [`phase_${nodeId}_mid`, `phase_${nodeId}_final`])
        : [],
      playerSlotPolicy: 'five_ship_3x3_default',
      timeLimitSec: 120,
      battleSeedPolicy: 'node_id_plus_run_seed',
      note: `${nodeId} ${stage === 'boss' ? 'Boss关' : stage === 'elite' ? '精英关' : '普通关'}·${tag} 主题（450 关走量）`,
      ...(isBoss ? (BOSS_CONTENT[nodeId]?.encounter ?? {}) : {}), // 声明覆写（reviveWaves 连战等·重放）
      // 段3：精英声明覆写（eliteTier 档位写入=entry 五档带查表源；victoryRule/mirror/revive 花样件）。
      ...(isElite && ELITE_CONTENT[nodeId]?.tier ? { eliteTier: ELITE_CONTENT[nodeId].tier } : {}),
      ...(isElite ? (ELITE_CONTENT[nodeId]?.encounter ?? {}) : {}),
      // 段4：眼段域规则 encounter 面翻译（tide/surge=环境块·battlewave=连战；graveyard=apply 层注单位字段）。
      ...(EYE_RULES[nodeId] ? eyeEncounterFields(EYE_RULES[nodeId]) : {}),
    });
    stat.encounters += 1;
    stat.spawns = newSpawn.length;
  }

  tables.battle_encounter_param = [...keepEnc, ...newEnc];
  tables.battle_spawn_param = [...keepSpawn, ...newSpawn];
  tables.battle_boss_phase_param = newPhases;
  return stat;
}

function compareToDisk(tables) {
  let diffs = 0;
  for (const name of LANDING_TABLES) {
    const diskRaw = readFileSync(path.join(DIR, `${name}.sample.json`), 'utf-8').replace(/\r\n/g, '\n');
    if (diskRaw !== serializeTable(tables[name])) {
      diffs += 1;
      console.log(`[check] ✗ ${name} 与磁盘不一致（字节）`);
    }
  }
  return diffs;
}

const tables = loadTables(DIR);
const stat = buildBundle(tables);
console.log(`[content] encounter ${stat.encounters}（+教学 8 保留）· spawn ${stat.spawns}（+教学保留）· Boss 骨架行 +${stat.bossRows} · phase ${stat.phases}`);
if (CHECK) {
  const diffs = compareToDisk(tables);
  console.log(diffs === 0 ? '[check] ✅ 计算态与磁盘一致' : `[check] ✗ 共 ${diffs} 处不一致`);
  process.exitCode = diffs === 0 ? 0 : 1;
} else {
  const written = writeTables(DIR, tables);
  console.log(`[content] 写盘：${written.length ? written.join(', ') : '（无变化=幂等）'}`);
}
