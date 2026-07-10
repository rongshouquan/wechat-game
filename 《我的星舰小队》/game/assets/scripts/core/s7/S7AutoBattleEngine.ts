// S7 专用纯 TS 实时自动战斗核心引擎（BATTLE-RT-04，不依赖 cc）。
//
// 让 enc_n001 / enc_n018 / enc_n075 能用配置和测试阵容跑出真实战斗结果与事件日志。
// 只做战斗模拟核心；不接 UI、不发奖励、不推进主线、不写存档、不接真实玩家阵容 assembler。
//
// 与流程版战斗完全隔离：不 import / 不复用 BattleEngine / BattleUnit / HeroConfig /
// EnemyConfig / SkillConfig / BattleLaunchService / BattlePlaybackService / cc。
// 仅读取 S7ConfigRuntime 的只读配置（getById/getAll 返回底层引用，引擎只读不写，绝不回改配置行）。
// 不把 pressure_param 自动换算成 hp / attack / armor。
//
// 时间：tick 固定 0.2s；同一 battleSeed 结果与日志完全一致；随机只用于"最近目标并列"裁决。
// 同一 tick 固定顺序（见 RT-04 §5.8）：
//   1 出怪 → 2 状态到期 → 3 被动回能 → 4 满能(被动)放大招 → 5 普攻(稳定序)
//   → 6 普攻后满能放大招 → 7 Boss phase → 8 清理死亡 → 9 判胜负/超时。
// 日志事件触发，不每 tick spam。

import {
  S7BattleUnitStatParam,
  S7BattleEffectParam,
  S7BattleEncounterParam,
  S7BattleSpawnParam,
  S7BattleBossPhaseParam,
  S7BattleStateTag,
} from '../../config/s7/ConfigTypesS7';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7AutoBattleSide,
  S7AutoBattleRunRequest,
  S7AutoBattleInlineEnemyInput,
  S7AutoBattleResult,
  S7AutoBattleLogEntry,
  S7AutoBattleLogType,
  S7AutoBattleFinalState,
  S7AutoBattleUnitFinalState,
  S7AutoBattleWinner,
  S7AutoBattleReason,
  S7AutoBattleError,
} from './S7AutoBattleTypes';
// 战场网格尺寸统一从单一真源导入（v1.0：敌方 5×7、我方 3×3、上阵 5）。
import {
  S7_PLAYER_ROWS as PLAYER_ROWS,
  S7_PLAYER_COLS as PLAYER_COLS,
  S7_ENEMY_ROWS as ENEMY_ROWS,
  S7_ENEMY_COLS as ENEMY_COLS,
  S7_MAX_PLAYER_UNITS as MAX_PLAYER_UNITS,
} from './S7BattleGrid';
// 效果装配层：玩家单位四层积木 → 最终战斗属性（块1）。
import { deriveUnit, S7DeriveBaseStat, S7DerivedUnit } from './S7BattleStatDerivation';
import { S7TriggerBlock, S7AffixKey, S7StackRuleParam } from './S7BattleEffectBlock';

// ===== 首版行为常量（RT-04 首版口径，非最终平衡；报告中已列明）=====
const TICK_SEC = 0.2;
// 块2：取消能量条，技能改三类触发（CD/开局/条件）。原 ENERGY_FULL/ON_ATTACK/ON_HIT 已移除。
const VULNERABLE_MULT = 1.25;
const SHIELD_BREAK_MULT = 1.5;
const BERSERK_ATTACK_MULT = 1.25;
const BERSERK_INTERVAL_MULT = 0.8;
/** 护盾量 = max(maxHp*0.2, caster.attack*effectPower)。 */
const SHIELD_HP_FRACTION = 0.2;

const PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;

const DAMAGE_TYPES = new Set<string>([
  'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
]);
const SHIELD_TYPES = new Set<string>(['shield', 'shield_bubble']);
const HEAL_TYPES = new Set<string>(['repair_burst']);
const SUMMON_TYPES = new Set<string>(['summon', 'summon_drone']);
const STATE_TYPES = new Set<string>([
  'short_circuit', 'short_circuit_pulse', 'stun', 'shield_break', 'mark', 'vulnerable', 'berserk',
  'silence', 'control_immune', // ⑥8a：沉默(挡技能不挡普攻) / 免控(硬控免疫·守护铃/山岳不动)
  'apply_state', // ⑦机制批①：通用状态施加（stateTag 选态）
]);
/** ⑦机制批① M1 限时修正状态 tag 全集（幅度=效果行 stateAmount·方向在 tag 名里）。
 *  旧配置不出现这些 tag=引擎行为逐字节不变；参数消费点见 stateModSum/effAttack/effInterval/dealDamage/fireTrigger。 */
const MOD_STATE_TAGS = new Set<S7BattleStateTag>([
  'atk_up', 'atk_down', 'atk_speed_up', 'atk_speed_down', 'armor_down',
  'dmg_up', 'dmg_taken_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
  'lifesteal_up', // 机制批③ 幸运扭蛋"吸血"：限时吸血加成（消费点=dealDamage 吸血轴·尾部追加=旧配置不变）
]);
/** ⑦机制批① M2 周期结算状态 tag（结算量=施加瞬间快照×层数·挂进"状态到期"步语义内）。 */
const PERIODIC_STATE_TAGS = new Set<S7BattleStateTag>(['burn', 'regen']);
/** 控制状态：期间不能普攻、不能放大招、不能主动触发。（沉默不在此列：只挡技能、普攻照打） */
const CONTROL_TAGS: S7BattleStateTag[] = ['short_circuit', 'stun'];
/** ⑥8a 硬控全集（真源硬控=短路/沉默 + 遗留 stun）：控制抗性缩时与 control_immune 免疫按此集合判。 */
const HARD_CONTROL_TAGS: S7BattleStateTag[] = ['short_circuit', 'stun', 'silence'];
/** 状态到期的固定遍历顺序，保证日志稳定。（⑥8a/⑦机制批① 新 tag 追加尾部：旧配置不出现新 tag=顺序不变） */
const STATE_TAG_ORDER: S7BattleStateTag[] = [
  'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
  'silence', 'control_immune',
  'atk_up', 'atk_down', 'atk_speed_up', 'atk_speed_down', 'armor_down',
  'dmg_up', 'dmg_taken_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
  'regen', 'burn', // ⑦机制批① M2：同刻先回血后掉血（纸面规则·体验平滑向）
  'debuff_immune', // ⑨机制批② M5：减益免疫（尾部追加·旧配置不出现=遍历顺序不变）
  'taunt', // ⑨机制批② M4：嘲讽（尾部追加=遍历顺序不变）
  'reflect', // ⑨机制批② M4：反弹（尾部追加=遍历顺序不变）
  'guard', // ⑨机制批② M4：守护替挡（尾部追加=遍历顺序不变）
  'share', // ⑨机制批② M4：分摊（尾部追加=遍历顺序不变）
  'aura', // ⑨机制批② M6：光环（尾部追加=遍历顺序不变）
  'blind', // ⑨机制批② M8：致盲（尾部追加=遍历顺序不变）
  'area_up', // 机制批③ 幸运扭蛋"范围+1"（尾部追加=遍历顺序不变）
  'lifesteal_up', // 机制批③ 幸运扭蛋"吸血"（尾部追加=遍历顺序不变）
  'no_attack', // 机制批③段二 堡垒「要塞展开」停普攻（尾部追加=遍历顺序不变）
];
const FRIENDLY_TAGS = new Set<string>([
  'self_team', 'lowest_hp_ally',
  // ⑦机制批① 友方目标族 + 自身区域族（施加者阵营侧选目标）
  'highest_attack_ally', 'no_buff_ally_first', 'most_debuffed_ally', 'controlled_ally_first',
  'self_cross_area', 'self_block_area',
]);

// ===== ⑥8a 通用常量（全局常量表 v0 消费点·数值细表战斗篇 §2）=====
/** 残血阈值（真源 §0：残血=血量<30%；dmgVsLowHp/healVsLowHp/lowhp_then_nearest 同锚）。 */
const LOWHP_THRESHOLD = 0.30;
/** 高血阈值（烬贪婪：对 >50% 血增伤）。 */
const HIGHHP_THRESHOLD = 0.50;
/** "高防"判定线（破障弹：带护盾或防 ≥ 此值算 fortified）。 */
const FORTIFIED_ARMOR_THRESHOLD = 40;
/** key_unit_first 目标族的"关键单位"roleTag 集（蛰/空：治疗/召唤源优先）。 */
const KEY_ROLE_TAGS = new Set<string>(['healer', 'summoner', 'support', 'summon_source']);
/** debuffed_first / most_debuffed_ally 目标族的"带减益"判定集。（⑦机制批① 新减益 tag 追加尾部：
 *  旧配置不出现新 tag=判定结果不变） */
const DEBUFF_TAGS: S7BattleStateTag[] = [
  'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'silence',
  'atk_down', 'atk_speed_down', 'armor_down', 'dmg_taken_up', 'blind', // ⑨M8 致盲=减益（蔽/霖 目标判定纳入·尾部追加=旧配置不变）
];
/** ⑦机制批① no_buff_ally_first 目标族的"带增益"判定集（沛：优先照顾还没增益/护盾的友军）。 */
const BUFF_TAGS: S7BattleStateTag[] = [
  'shield', 'control_immune', 'berserk',
  'atk_up', 'atk_speed_up', 'dmg_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
  'debuff_immune', // ⑨机制批② M5：减益免疫也是增益（沛"无增益友军优先"纳入·尾部追加=旧配置不变）
  'area_up', 'lifesteal_up', // 机制批③ 扭蛋强化=增益（尾部追加=旧配置不变）
];

// ===== ⑨机制批② M5 净化/驱散极性与移除优先级（真源=星舰真源§状态库·优先级序=数值域定序·记数值细表 §16c）=====
/** 「减益」全集（净化候选 + debuff_immune 拦截判定）：软控（减速/虚弱/破防/易伤/削盾/燃烧）+ 硬控（短路/沉默/晕眩）；
 *  真源明列 mark 为目标标记非减益 → 排除（净化不清 mark·debuff_immune 不挡 mark）。 */
const DEBUFF_STATE_TAGS: S7BattleStateTag[] = [
  'atk_down', 'atk_speed_down', 'armor_down', 'vulnerable', 'dmg_taken_up', 'burn', 'shield_break', 'blind',
  'short_circuit', 'stun', 'silence',
];
/** 净化移除优先级（友军·最有害先移）：硬控（仅 dispelHardControl 时纳入·队首=最高威胁）→ 燃烧 DoT
 *  → 破防/易伤（挨更多打）→ 虚弱/减速（削输出/节奏）→ 易伤态/削盾。 */
const DISPEL_DEBUFF_ORDER: S7BattleStateTag[] = [
  'short_circuit', 'stun', 'silence',
  'burn', 'blind', 'armor_down', 'dmg_taken_up', 'atk_down', 'atk_speed_down', 'vulnerable', 'shield_break',
];
/** 驱散移除优先级（敌方·最具威胁先移）：狂暴/加攻（真源"反制狂暴/鼓动"）→ 增伤/加攻速/暴击/急速
 *  → 减伤/持续回血/护盾 → 免控/减益免疫。 */
const DISPEL_BUFF_ORDER: S7BattleStateTag[] = [
  'berserk', 'atk_up', 'dmg_up', 'atk_speed_up', 'crit_dmg_up', 'crit_rate_up', 'skill_haste_up',
  'dmg_taken_down', 'regen', 'shield', 'control_immune', 'debuff_immune',
  'area_up', 'lifesteal_up', // 机制批③ 扭蛋强化可被驱散（尾部追加=旧配置移除序不变）
];

/** 无装配单位（敌人/召唤物/基线舰）的默认定向词条：全 0（冻结共享，战斗中只读不改）。 */
const ZERO_AFFIXES: Readonly<Record<S7AffixKey, number>> = Object.freeze({
  critRate: 0, critDmg: 0, shieldBreak: 0, skillHaste: 0,
  healPower: 0, controlResist: 0, dmgVsSwarm: 0, dmgVsBoss: 0,
  // ⑥8a 新词条缺省全 0（=引擎行为逐字节不变）
  dmgVsLowHp: 0, dmgVsHighHp: 0, dmgVsFortified: 0, armorPen: 0, lifesteal: 0, dodgeRate: 0,
  dmgTakenPct: 0, healTakenPct: 0, shieldPower: 0, healVsLowHp: 0, skillDmgPct: 0, effectAmp: 0,
  durationPct: 0, summonCapBonus: 0,
  // 机制批③ 星核词条缺省全 0（=引擎行为逐字节不变）
  skillHitCurHpPct: 0, skillHitCapAtkMult: 0, dmgSplitFattestPct: 0, luckyOnCast: 0,
  // 机制批③段二 条件/专项词条族缺省全 0（=引擎行为逐字节不变）
  normalAtkDmgPct: 0, skillCritRate: 0, skillCritDmgPct: 0,
  critRateVsLowHp: 0, critRateVsHighHp: 0, critRateVsFortified: 0, critDmgVsBoss: 0,
  dmgVsBurning: 0, dmgVsSummonSource: 0, armorPenVsSummonSource: 0, dmgVsKeyUnit: 0, dmgVsFullHp: 0,
  shaveCurHpPct: 0, halfBreakAtkPct: 0, shatterChance: 0,
  lowHpThresholdPct: 0, highHpThresholdPct: 0, executeLowHpPct: 0, executeBossMaxHpPct: 0,
  saveAllyLethalOnce: 0, lethalGuardOnce: 0, lethalGuardImmuneSec: 0, critAfterDodge: 0,
  overhealToShieldPct: 0, healFullShieldMaxHpPct: 0, shieldVsLowHp: 0,
  buffAmpPct: 0, buffRiderCritRate: 0, buffTransferOnDeath: 0, coverageAmpPerAlly: 0, durationPctFullCoverage: 0,
  debuffedTakenAmpTeam: 0, debuffedTakenIncludeBoss: 0, debuffedTakenPerDebuff: 0, teamCritVsDebuffed: 0,
  healDispelCount: 0, healDispelHardControl: 0, healOnDispelAtkPct: 0, afterDispelImmuneSec: 0,
  reflectAllRecentPct: 0, tauntReflectPct: 0, guardExtraCharges: 0, guardSelfDmgDownPct: 0,
  shareForControlledPct: 0, focusMaxGuaranteedCrit: 0, extraNormalHitWhileAtkSpeedUp: 0,
  normalSplashPct: 0, normalSplashTargets: 0, chargedNormalPct: 0, chargedNormalSplashPct: 0,
  skillRepeatChance: 0, skillDetonateAtkPct: 0, skillDetonateCross: 0, skillCdPerTargetSec: 0, skillCdFullBonusSec: 0,
  aftershockAtkPct: 0, lowHpDmgTakenDown: 0, summonAtkPct: 0, summonHpPct: 0, summonSyncFire: 0,
  armorPerHpDecilePct: 0, lowHpArmorFlat: 0, dmgToTeamShieldPct: 0, shieldCapMaxHpMult: 0, overflowShieldToHealPct: 0,
  normalAreaMinEnemies: 0, normalAreaAlways: 0,
  armorDownOnShieldBreak: 0, firstControlImmune: 0, critSplashPct: 0, critFollowupAtkPct: 0, critHasteAmount: 0,
  critLifestealDouble: 0, firstSkillCdHalf: 0, skillAreaUp: 0, buffRiderCritDmg: 0, shredOnHitChance: 0, armorPenVsHighestArmor: 0,
  skillRepeatCount: 0, fortressChargePct: 0,
});

// ===== 机制批③ 幸运扭蛋：五路由的引擎内合成状态行（不进配置表·rowId 只作日志/演出锚点）=====
// 数值=细表 §15（暴击+30%/范围+1/连放/吸血20%/缩CD3s·6s）；触发在 castLogged 顶部（先 roll 后结算=本次技能即受益）。
const GACHA_DURATION_SEC = 6;
const GACHA_CD_REFUND_SEC = 3;
const GACHA_ROW_BASE = {
  schemaVersion: 's7-inline', effectKind: 'core' as const, effectType: 'apply_state' as const,
  effectPower: 0, targetingTag: 'self_team', durationSec: GACHA_DURATION_SEC, maxTargets: 1,
  summonUnitRef: 'none', note: '幸运扭蛋路由（引擎内合成行）',
};
const GACHA_CRIT_ROW: S7BattleEffectParam = { ...GACHA_ROW_BASE, rowId: 'eff_core_gacha_crit', stateTag: 'crit_rate_up', stateAmount: 0.30 };
const GACHA_AREA_ROW: S7BattleEffectParam = { ...GACHA_ROW_BASE, rowId: 'eff_core_gacha_area', stateTag: 'area_up' };
const GACHA_LIFESTEAL_ROW: S7BattleEffectParam = { ...GACHA_ROW_BASE, rowId: 'eff_core_gacha_lifesteal', stateTag: 'lifesteal_up', stateAmount: 0.20 };
const GACHA_OUTCOMES = ['crit', 'area', 'echo', 'lifesteal', 'cd'] as const;

// ===== 机制批③段二 · 引擎内合成行与常量（不进配置表·rowId=日志/演出锚点）=====
/** 保命插件传奇：触发免死后短暂无敌（dmg_taken_down 1.0=既有整发免伤路径）。 */
const LETHAL_IMMUNE_ROW: S7BattleEffectParam = {
  ...GACHA_ROW_BASE, rowId: 'eff_plg_lethal_immune', stateTag: 'dmg_taken_down', stateAmount: 1.0, durationSec: 1.5,
  note: '保命传奇（引擎内合成行）',
};
/** 藏5★「装甲碎裂」（顺路升级）：碎甲=易伤 2s（全队对其增伤=易伤天然全队受益·真源口径）。 */
const SHATTER_ROW: S7BattleEffectParam = {
  ...GACHA_ROW_BASE, rowId: 'eff_pil_cang20_shatter', stateTag: 'vulnerable', durationSec: 2,
  note: '藏5★装甲碎裂（引擎内合成行）',
};
/** 霖3★：被本舰净化的友军短时免疫新减益（时长由 afterDispelImmuneSec 词条注入）。 */
const AFTER_DISPEL_IMMUNE_ROW: S7BattleEffectParam = {
  ...GACHA_ROW_BASE, rowId: 'eff_pil_lin_s3_immune', stateTag: 'debuff_immune', durationSec: 2,
  note: '霖3★净化后免疫（引擎内合成行）',
};
/** 岩3★：守护触发时自身短暂减伤（幅度由 guardSelfDmgDownPct 词条注入·时长 2s 数值域定）。 */
const GUARD_SELF_BUFF_ROW: S7BattleEffectParam = {
  ...GACHA_ROW_BASE, rowId: 'eff_pil_yan_s3_selfdown', stateTag: 'dmg_taken_down', stateAmount: 0.20, durationSec: 2,
  note: '岩3★守护自减伤（引擎内合成行）',
};
/** 澈L100：本舰施加增益时附带小暴击增益（幅度由 buffRiderCritRate 词条注入）。 */
const BUFF_RIDER_CRIT_ROW: S7BattleEffectParam = {
  ...GACHA_ROW_BASE, rowId: 'eff_pil_che_l100_crit', stateTag: 'crit_rate_up', stateAmount: 0.08, durationSec: 6,
  note: '澈L100增益附暴击（引擎内合成行）',
};
/** 增益方向的 M1 修正 tag（澈「增幅」/沛「润泽」的"状态幅度增效"消费面·施加给友军才算增益）。 */
const BUFF_MOD_TAGS = new Set<S7BattleStateTag>([
  'atk_up', 'atk_speed_up', 'dmg_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up', 'lifesteal_up',
]);
/** 岳能力/5★："攻击我方后排"事件知识窗口秒数（数值域定稿·§16d）。 */
const BACKLINE_ATTACKER_WINDOW_SEC = 2.5;
/** 余震插件：延迟追加伤的固定延迟秒数（数值域定稿·§16d）。 */
const AFTERSHOCK_DELAY_SEC = 1.5;

/** 机制批③段二 延迟结算项（小太阳完整版/蜂针定时爆破=zone 区域快照·余震=single 单体追加）。 */
interface RtPendingBlast {
  atTime: number;
  casterId: string;
  casterSide: S7AutoBattleSide;
  /** 施放瞬间攻击力快照（施放者中途死亡照爆·同 M2 快照口径）。 */
  atkSnapshot: number;
  kind: 'zone' | 'single';
  effectRef: string;
  /** zone：锚点格（引爆时刻以在场者算·格子不追人）；single：目标 unitId（已死=空爆）。 */
  anchorRow?: number;
  anchorCol?: number;
  targetId?: string;
  /** 伤害=atkSnapshot×powerMult（延迟伤走直伤子结算口径·§16d）。 */
  powerMult: number;
  area?: 'cross' | 'block';
  targetSide: S7AutoBattleSide;
}

interface RtStateInst {
  tag: S7BattleStateTag;
  expireAt: number;
  // ===== ⑦机制批① 框架状态专用可选字段（旧 tag 不设=行为不变）=====
  /** M1：每层修正幅度（正数·方向在 tag 名）；总幅度 = amountPerStack × stacks。 */
  amountPerStack?: number;
  /** M3：当前层数（框架态默认 1）。 */
  stacks?: number;
  /** M3：层数上限（≥2 才可叠；缺省 1=同名只刷新）。 */
  maxStacks?: number;
  /** M3：时限到期动作——clear=整态消失（缺省）/ decay_1=降 1 层并按 durationSec 重计时。 */
  expireAction?: 'clear' | 'decay_1';
  /** M3 decay_1 重计时用：本态单次施加的持续秒数。 */
  durationSec?: number;
  // ===== M2 周期结算（burn/regen）专用 =====
  /** 每层每次结算量（施加瞬间快照：atkPct×施加者基础攻 + maxHpPct×目标最大血 + flat）。 */
  tickAmount?: number;
  /** 结算间隔秒（缺省 1）。重复施加=层数/时长规则照旧，结算节拍从最新施加重新起拍。 */
  tickIntervalSec?: number;
  /** 下一次结算时刻。 */
  nextTickAt?: number;
  /** 施加者（击杀归账/日志 actor；施加者死亡后仍按快照跳数）。 */
  sourceUnitId?: string;
  sourceSide?: S7AutoBattleSide;
  /** 施加来源效果行（结算日志 effectRef）。 */
  srcEffectRef?: string;
  /** ⑨机制批② M5：不可驱散标记（守护铃「守护铃光」·true=dispel 跳过不移除）；缺省=可驱散。 */
  undispellable?: boolean;
  /** ⑨机制批② M4：嘲讽施加者 unitId（taunt 态专用·被嘲讽单位攻击性选目标强制打此单位）。 */
  tauntedBy?: string;
  /** ⑨机制批② M4：反弹态参数（reflect 态专用·施加瞬间快照）——反弹量=受伤×reflectPct + 攻击者攻×reflectAtkPct
   *  + reflectBase(受方防×reflectArmorPct 快照)；blockPct=受击减免比例（岩「反震」格挡）。 */
  reflectPct?: number;
  reflectAtkPct?: number;
  reflectBase?: number;
  blockPct?: number;
  /** ⑨机制批② M4 守护替挡（guard 态·守护者持有）：保护范围 / 替挡冷却秒 / 下次可替挡时刻（运行时更新）。 */
  guardProtect?: 'backline' | 'all';
  guardCooldownSec?: number;
  guardReadyAt?: number;
  /** 机制批③段二 岩5★：本冷却窗剩余替挡次数（undefined=窗口开启时按 1+guardExtraCharges 重置）。 */
  guardChargesLeft?: number;
  /** ⑨机制批② M4 分摊（share 态·受方持有）：分摊比例 / 承接模式 / 承接者 unitId（to_caster=施加者·adjacent 忽略）。 */
  sharePct?: number;
  shareMode?: 'adjacent' | 'to_caster';
  shareTargetId?: string;
  /** ⑨机制批② M6 光环（aura 态·源持有）：作用轴 / 幅度 / 范围 / 条件门 / 数值缩放。 */
  auraStat?: 'dmgTakenDownPct' | 'atkSpeedPct' | 'skillHastePct';
  auraAmount?: number;
  auraScope?: 'self' | 'team' | 'cross' | 'block';
  auraCondition?: 'always' | 'has_summon' | 'no_enemy_summon';
  auraScale?: 'per_lowhp_ally';
  /** ⑨机制批② M8 致盲（blind 态·持有者）：普攻落空概率 (0,1]。 */
  blindChance?: number;
  /** 机制批③段二：状态自然到期时由持有者释放的效果行（堡垒「要塞展开」结束反击·被驱散/死亡不触发）。 */
  expireEffectRef?: string;
  /** 机制批③段二：叠层态"叠满触发"已触发标记（迷雾L100·掉层后可再触发）。 */
  onFullFired?: boolean;
  /** 机制批③段二：持有 no_attack 态期间受击计数（堡垒A"被打积能结束大反击"·反击 damageScale=1+0.5×次·封顶+5）。 */
  hitCounter?: number;
}

/** ⑦机制批① M3：叠层规则运行态。 */
interface RtStackRule {
  rule: S7StackRuleParam;
  /** 当前层数（hp_lost_decile 为派生·不用本字段）。 */
  stacks: number;
  /** per_second 型下一次累积时刻。 */
  nextAccrueAt: number;
  /** 最近一次累积事件时刻（attack_gap 断档判定；断档后重臂）。 */
  lastEventAt: number;
  /** target_switch 断档：跟踪的锁定目标。 */
  trackedTargetId: string | null;
  /** 机制批③段二：叠满触发已放次数（onFullMaxFires 封顶用）。 */
  onFullFires?: number;
}

/** 运行时触发项：块1 的触发积木 + 运行时计时/闩锁状态（块2）。 */
interface RtTrigger {
  block: S7TriggerBlock;
  /** on='cd' 的下次可放时刻（初始 0 = 开局即放第一次）。 */
  nextFireAt: number;
  /** 一次性触发（battle_start / hp_below）是否已放过。 */
  fired: boolean;
  /** 机制批③ on='on_kill_charge' 的当前攒层数（击杀点直接累积·释放后清零）；其余触发型不设。 */
  charge?: number;
}

interface RtUnit {
  unitId: string;
  side: S7AutoBattleSide;
  unitStatRef: string;
  slotRef: string;
  row: number;
  col: number;
  sizeRows: number;
  sizeCols: number;
  maxHp: number;
  hp: number;
  attack: number;
  /** ⑨机制批② M9：出场攻击力快照（贪吃星运行时累积 additive 基数·不随 attack 变动）。 */
  baseAttack: number;
  armor: number;
  attackIntervalSec: number;
  attackRangeCells: number;
  passiveEnergyPerSec: number;
  nextAttackAt: number;
  alive: boolean;
  downLogged: boolean;
  isBoss: boolean;
  bossNodeId: string | null;
  normalEffectRef: string;
  ultimateEffectRef: string;
  coreEffectRef: string;
  targetingTag: string;
  coreTriggered: boolean;
  triggers: RtTrigger[];
  /** 块2b 事件型触发的本 tick 事件标志（stepTriggers 评估后清）。 */
  hitSinceTrigger: boolean;
  killedSinceTrigger: boolean;
  /** ⑥8a 事件标志（同 2b 模式·评估后清）：本舰护盾被打破 / 本舰普攻命中。 */
  shieldBrokenSinceTrigger: boolean;
  attackLandedSinceTrigger: boolean;
  /** ⑦机制批①：本 tick 击杀名单的 roleTag（on_kill 触发的击杀对象过滤·蛰「斩链」；评估后清）。 */
  killedRolesSinceTrigger: string[];
  /** ⑦机制批①：本单位放出 ultimate 类效果（skill_cast 触发·战鼓；评估后清）。 */
  skillCastSinceTrigger: boolean;
  /** ⑦机制批① M3：叠层规则运行态（装配 stack 积木 + 单位行 stackRules；空数组=行为不变）。 */
  stackRules: RtStackRule[];
  shield: number;
  states: Map<S7BattleStateTag, RtStateInst>;
  /** 定向词条（插件等装配产出；块4b 引擎按需消费）。无装配单位为全 0（ZERO_AFFIXES）。 */
  affixes: Readonly<Record<S7AffixKey, number>>;
  /** ⑥8a：单位属性行 roleTag（key_unit_first 目标族消费）。 */
  roleTag: string;
  /** ⑥8a lock_until_dead 目标族：当前锁定目标（死后换锁）。 */
  lockedTargetId: string | null;
  /** ⑥8a 召唤生命周期包：召唤源 unitId / 到期时刻（null=不限时）/ 是否随源消亡。 */
  summonedBy: string | null;
  summonExpireAt: number | null;
  despawnWithSource: boolean;
  /** 机制批③ 计数复释（影刃「残影」）：本单位普攻出手计数（普攻行带 splitEveryN 才有意义·纯内部计数不影响旧行为）。 */
  splitShotCount: number;
  /** 机制批③ C14 硬控递减：施加者 unitId → {n=窗口内已施加次数, at=最近施加时刻}（仅请求带旋钮时才分配）。 */
  hcDim?: Map<string, { n: number; at: number }>;
  // ===== 机制批③段二 运行时字段（全部缺省 undefined/false=旧行为不变）=====
  /** 保命插件：本场免死已用（每场 1 次闩锁）。 */
  lethalGuardUsed?: boolean;
  /** 苏5★替挡致命：本场已替挡过（每场 1 次闩锁）。 */
  lethalSaveUsed?: boolean;
  /** 甘霖SS复活：本场已复活过（每场 1 次闩锁）。 */
  reviveUsed?: boolean;
  /** 警戒传奇：闪避后下一击必暴（一次性闩锁·出手即清）。 */
  guaranteedCritNext?: boolean;
  /** 充能插件：true=已蓄力（下一发强化）；false/缺省=下一拍蓄力不出手。 */
  chargedNormal?: boolean;
  /** 影5★ Boss 侧：已对本 Boss 吃过"跌破阈值追加伤"的攻击者 unitId 集（每场每攻击者一次）。 */
  bossExecuteDoneBy?: Set<string>;
  /** 岳能力：本单位最近一次打中对方后排的时刻（事件知识目标窗口）。 */
  lastHitBacklineAt?: number;
  /** 岳5★：近期攻击者履历（窗口内·反射全部攻击者用）。 */
  recentAttackers?: Array<{ id: string; at: number }>;
  /** 翎5★：本 tick 击杀过"当时敌方存活最高攻目标"（stepTriggers 评估后随其余事件标志清）。 */
  killedHighestAtkSinceTrigger?: boolean;
  /** 机制批③段二 召唤覆写（derived.summonOverride 快照·本舰召唤物出场时消费）。 */
  summonOverride?: { targetingTag?: string; normalEffectRef?: string };
  /** 甘霖SS复活选人：阵亡时刻（stepCleanupDead 记账·复活选"最近阵亡"）。 */
  diedAt?: number;
  /** 韧性传奇：本场"免疫第一次硬控"已用（一次性闩锁）。 */
  firstControlImmuneUsed?: boolean;
}

interface SummonBudget {
  remaining: number;
}

/** 召唤生命周期元数据（⑥8a）+ 机制批③ copyFrom（全息镜分身的施法者三围快照）+ 段二 继承/覆写。 */
interface SummonMeta {
  sourceId: string | null;
  expireSec?: number;
  despawnWithSource: boolean;
  copyFrom?: {
    maxHp: number;
    attack: number;
    armor: number;
    attackIntervalSec: number;
    attackRangeCells: number;
    normalEffectRef: string;
    targetingTag: string;
  };
  /** 机制批③段二 巡「召唤物属性继承」：攻/血按源词条放大（缺省=零回归）。 */
  statScale?: { atkPct: number; hpPct: number };
  /** 机制批③段二 召唤覆写：目标选择/普攻行变体（巡能力/哨卫L60/巡3★·缺省=零回归）。 */
  override?: { targetingTag?: string; normalEffectRef?: string };
}

interface RtSpawnPlan {
  row: S7BattleSpawnParam;
  processed: boolean;
}

interface RtPhase {
  row: S7BattleBossPhaseParam;
  triggered: boolean;
}

/**
 * S7 自动战斗引擎。一个实例可复用，多次 run 互不污染（每次 run 在内部 BattleRun 中持有独立状态）。
 * 仅读取注入的 S7ConfigRuntime（只读），绝不回写配置。
 */
export class S7AutoBattleEngine {
  constructor(private readonly runtime: S7ConfigRuntime) {}

  /** 跑一场自动战斗，返回结果与完整事件日志。 */
  run(request: S7AutoBattleRunRequest): S7AutoBattleResult {
    return new BattleRun(this.runtime, request).execute();
  }
}

/** 单场战斗的运行态（与引擎实例解耦，保证可复用与无状态泄漏）。 */
class BattleRun {
  private readonly rng: S7AutoBattleRng;
  private readonly log: S7AutoBattleLogEntry[] = [];
  private readonly units: RtUnit[] = [];
  private readonly playerCells = new Set<string>();
  private readonly enemyCells = new Set<string>();
  private spawnPlans: RtSpawnPlan[] = [];
  private phases: RtPhase[] = [];
  /** ⑨机制批② M4：本场是否存在守护替挡态（首次施加 guard 时置真）；false=dealDamage 守护解析整段跳过=逐字节不变。 */
  private anyGuard = false;
  /** ⑨机制批② M6：本场是否存在光环态（首次施加 aura 时置真）；false=auraSum 整段跳过=逐字节不变。 */
  private anyAura = false;
  /** 机制批③ 曲率星门：本场是否已结算过整排对调（多颗同装/多次触发只算一次——对调两次=复原=负收益，语义上幂等）。 */
  private rankSwapDone = false;
  // ===== 机制批③段二 存在门旗（spawnUnit 置真；false=对应扫描整段跳过=零回归）=====
  /** 蔽「笼罩」在场（debuffedTakenAmpTeam>0 的单位存在）。 */
  private anyCloak = false;
  /** 蔽5★「全队对减益敌暴击+」在场。 */
  private anyTeamCrit = false;
  /** 苏5★「替挡致命」在场。 */
  private anyLethalSave = false;
  /** 沧3★「硬控友军分摊」在场。 */
  private anyShareGuard = false;
  /** 岳能力「打正在攻击我后排的敌」在场（backline_attacker_first 目标族=事件知识跟踪才开）。 */
  private anyEventKnowledge = false;
  /** 澈5★「增益转移」在场。 */
  private anyBuffTransfer = false;
  /** 机制批③段二 延迟结算队列（小太阳完整版/蜂针定时爆破/余震·空队列=零回归）。 */
  private pendingBlasts: RtPendingBlast[] = [];
  private time = 0;
  private timeLimitSec = 0;
  private enemySeq = 0;
  /** 块2b：各方累计阵亡数（ally_down 条件触发用）。 */
  private readonly deadCount: Record<S7AutoBattleSide, number> = { player: 0, enemy: 0 };

  constructor(
    private readonly runtime: S7ConfigRuntime,
    private readonly request: S7AutoBattleRunRequest,
  ) {
    this.rng = new S7AutoBattleRng(request.battleSeed);
  }

  execute(): S7AutoBattleResult {
    const enc = this.runtime.getById<S7BattleEncounterParam>('battle_encounter_param', this.request.encounterRef);
    if (!enc) {
      throw new S7AutoBattleError('unknown_encounter', `battle_encounter_param 缺少 ${this.request.encounterRef}`);
    }
    // 【回廊受控扩展】限时覆盖（>0 才生效）：闪电战 40s。主线/悬赏不设 → 用 encounter 限时（零行为变化）。
    const tOverride = this.request.timeLimitSecOverride;
    this.timeLimitSec = typeof tOverride === 'number' && tOverride > 0 ? tOverride : enc.timeLimitSec;

    this.placePlayerUnits();
    // 【回廊受控扩展】内联敌阵：给了则用它一次性铺敌、忽略 encounter 出怪批次；否则走原 spawnPlans 路径（零行为变化）。
    const inline = this.request.inlineEnemyUnits;
    if (inline && inline.length > 0) this.placeInlineEnemies(inline);
    else this.loadSpawnPlans(enc);
    this.loadPhases(enc);

    this.pushLog('battle_start', { note: enc.rowId });

    const maxTicks = Math.max(1, Math.round(this.timeLimitSec / TICK_SEC));
    let decided: { winner: S7AutoBattleWinner; reason: S7AutoBattleReason } | null = null;

    for (let tick = 0; tick < maxTicks; tick += 1) {
      this.time = roundTime(tick * TICK_SEC);

      this.stepSpawnWaves();        // 1 出怪
      this.stepExpireStates();      // 2 状态到期
      this.stepTriggers();          // 3 三类触发（CD / 开局即放 / 血量阈值；on_kill/on_hit 留块2b）
      this.stepNormalAttacks();     // 4 普攻
      this.stepBossPhases();        // 5 Boss 阶段
      this.stepCleanupDead();       // 6 清理死亡

      decided = this.checkOutcome(); // 7 判胜负 / 超时
      if (decided) break;
    }

    let durationSec: number;
    let winner: S7AutoBattleWinner;
    let reason: S7AutoBattleReason;
    if (decided) {
      durationSec = this.time;
      winner = decided.winner;
      reason = decided.reason;
    } else {
      durationSec = this.timeLimitSec;
      winner = 'enemy';
      reason = 'timeout';
    }

    this.log.push({ timeSec: durationSec, type: 'battle_end', winner, reason, durationSec });

    return {
      winner,
      reason,
      durationSec,
      log: this.log,
      finalState: this.buildFinalState(durationSec),
    };
  }

  // ===== 初始化 =====

  private placePlayerUnits(): void {
    const inputs = this.request.playerUnits;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new S7AutoBattleError('no_player_units', '玩家上阵单位不能为空');
    }
    if (inputs.length > MAX_PLAYER_UNITS) {
      throw new S7AutoBattleError('too_many_players', `玩家单位最多 ${MAX_PLAYER_UNITS}，实际 ${inputs.length}`);
    }
    const seenSlots = new Set<string>();
    for (const input of inputs) {
      const slot = input.slotRef;
      if (typeof slot !== 'string' || !PLAYER_SLOT_PATTERN.test(slot)) {
        throw new S7AutoBattleError('bad_player_slot', `非法玩家格 "${String(slot)}"（仅 p0c0..p2c2）`);
      }
      if (seenSlots.has(slot)) {
        throw new S7AutoBattleError('dup_player_slot', `重复玩家格 "${slot}"`);
      }
      seenSlots.add(slot);
      const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', input.unitStatRef);
      if (!stat) {
        throw new S7AutoBattleError('unknown_unit_stat', `battle_unit_stat_param 缺少 ${String(input.unitStatRef)}`);
      }
      if (stat.targetType !== 'ship') {
        throw new S7AutoBattleError('not_ship', `玩家单位 ${stat.rowId} 的 targetType 必须是 ship（实际 ${stat.targetType}）`);
      }
      const row = Number(slot[1]);
      const col = Number(slot[3]);
      // 块1：带了四层效果积木才走装配层；不带则按星舰基线原样出场（零行为变化）。
      const blocks = input.effectBlocks ?? [];
      const derived = blocks.length > 0 ? deriveUnit(baseStatOf(stat), blocks) : null;
      this.spawnUnit(stat, 'player', row, col, slot, derived);
    }
  }

  private loadSpawnPlans(enc: S7BattleEncounterParam): void {
    const plans: RtSpawnPlan[] = [];
    for (const ref of enc.spawnPlanRefs) {
      const row = this.runtime.getById<S7BattleSpawnParam>('battle_spawn_param', ref);
      if (!row) throw new S7AutoBattleError('unknown_spawn', `battle_spawn_param 缺少 ${ref}`);
      plans.push({ row, processed: false });
    }
    // 稳定处理顺序：先到点的先出，同时刻按 waveIndex、rowId 决定，保证同 seed 出怪顺序固定。
    plans.sort((a, b) => {
      if (a.row.spawnDelaySec !== b.row.spawnDelaySec) return a.row.spawnDelaySec - b.row.spawnDelaySec;
      if (a.row.waveIndex !== b.row.waveIndex) return a.row.waveIndex - b.row.waveIndex;
      return a.row.rowId < b.row.rowId ? -1 : a.row.rowId > b.row.rowId ? 1 : 0;
    });
    this.spawnPlans = plans;
  }

  private loadPhases(enc: S7BattleEncounterParam): void {
    const phases: RtPhase[] = [];
    for (const ref of enc.bossPhaseRefs) {
      const row = this.runtime.getById<S7BattleBossPhaseParam>('battle_boss_phase_param', ref);
      if (!row) throw new S7AutoBattleError('unknown_boss_phase', `battle_boss_phase_param 缺少 ${ref}`);
      phases.push({ row, triggered: false });
    }
    this.phases = phases;
  }

  // ===== 单步处理（固定顺序）=====

  /** 1：处理到点的出怪批次。 */
  private stepSpawnWaves(): void {
    for (const plan of this.spawnPlans) {
      if (plan.processed) continue;
      if (this.time + 1e-9 < plan.row.spawnDelaySec) continue;
      plan.processed = true;
      this.processSpawnPlan(plan.row);
    }
  }

  private processSpawnPlan(plan: S7BattleSpawnParam): void {
    const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', plan.unitStatRef);
    if (!stat) throw new S7AutoBattleError('unknown_unit_stat', `battle_unit_stat_param 缺少 ${plan.unitStatRef}`);
    const created: RtUnit[] = [];
    for (const slot of plan.slotRefs) {
      if (this.countAliveEnemies() >= plan.maxConcurrentOnField) break; // 同屏上限
      const parsed = parseEnemySlot(slot);
      if (!parsed) {
        throw new S7AutoBattleError('bad_spawn_slot', `非法出怪格 "${slot}"（仅 r0c0..r${ENEMY_ROWS - 1}c${ENEMY_COLS - 1}）`);
      }
      if (!this.canPlace('enemy', parsed.row, parsed.col, stat.sizeRows, stat.sizeCols)) continue; // 占用/越界则跳过该格
      created.push(this.spawnUnit(stat, 'enemy', parsed.row, parsed.col, slot));
    }
    if (created.length > 0) {
      this.pushLog('spawn_wave', {
        side: 'enemy',
        waveIndex: plan.waveIndex,
        targetIds: created.map((u) => u.unitId),
        note: plan.rowId,
      });
    }
  }

  /**
   * 【深空回廊专用·受控入口】按内联敌阵一次性铺敌（开局全部就位·单波·不走 encounter 出怪批次）。
   * 每个敌人应用 request.enemyEffectBlocks（随层缩放 + 敌方戏法：铁甲潮改护甲/护盾矩阵开局盾/蜂群变弱），
   * 经 deriveUnit 合并成装配后属性（spawnUnit 对敌我同口径消费 derived）。占用/越界的格跳过。
   * 主线/悬赏永不传 inlineEnemyUnits，永不进入此路径（零行为变化，与 processSpawnPlan 并行不交叉）。
   */
  private placeInlineEnemies(inline: readonly S7AutoBattleInlineEnemyInput[]): void {
    const ebs = this.request.enemyEffectBlocks ?? [];
    const created: RtUnit[] = [];
    for (const item of inline) {
      const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', item.unitStatRef);
      if (!stat) throw new S7AutoBattleError('unknown_unit_stat', `battle_unit_stat_param 缺少 ${String(item.unitStatRef)}`);
      const parsed = parseEnemySlot(item.slotRef);
      if (!parsed) {
        throw new S7AutoBattleError('bad_spawn_slot', `非法内联敌格 "${String(item.slotRef)}"（仅 r0c0..r${ENEMY_ROWS - 1}c${ENEMY_COLS - 1}）`);
      }
      if (!this.canPlace('enemy', parsed.row, parsed.col, stat.sizeRows, stat.sizeCols)) continue; // 占用/越界跳过该格
      const derived = ebs.length > 0 ? deriveUnit(baseStatOf(stat), ebs) : null;
      created.push(this.spawnUnit(stat, 'enemy', parsed.row, parsed.col, item.slotRef, derived));
    }
    if (created.length > 0) {
      // t=0 记 spawn_wave 让敌人在战斗演出里登场（playback 靠 spawn_wave 点名·见 S7BattlePlayback）。
      this.pushLog('spawn_wave', { side: 'enemy', waveIndex: 1, targetIds: created.map((u) => u.unitId), note: 'corridor_inline' });
    }
  }

  /** 2：结算状态到期并记录 state_expire；⑥8a 附带处理限时召唤物到期（无限时召唤物时零行为）。
   *  ⑦机制批①（挂进本步语义内·不新增步骤）：M2 周期结算（先结到点的 tick 再判到期）、
   *  M3 到期动作 decay_1（降 1 层重计时）、叠层规则的 per_second 累积与 attack_gap 断档。 */
  private stepExpireStates(): void {
    for (const unit of this.stableUnits()) {
      if (!unit.alive) continue;
      for (const tag of STATE_TAG_ORDER) {
        const st = unit.states.get(tag);
        if (!st) continue;
        // ⑦M2：周期结算——结清所有 到点 且 不晚于到期时刻 的 tick（同刻"先结算后到期"）。
        if (st.nextTickAt !== undefined) {
          const interval = st.tickIntervalSec !== undefined && st.tickIntervalSec > 0 ? st.tickIntervalSec : 1;
          while (unit.alive && st.nextTickAt <= this.time + 1e-9 && st.nextTickAt <= st.expireAt + 1e-9) {
            this.settlePeriodicTick(unit, st);
            st.nextTickAt += interval;
          }
          if (!unit.alive) break; // 燃烧跳死：本单位全部状态处理停止（清理死亡步统一收尾）
        }
        if (st.expireAt <= this.time + 1e-9) {
          // ⑦M3 到期动作：decay_1=降 1 层并按单次施加时长重计时（层数>1 时）；否则整态消失。
          if (st.expireAction === 'decay_1' && (st.stacks ?? 1) > 1 && st.durationSec !== undefined) {
            st.stacks = (st.stacks ?? 1) - 1;
            st.expireAt = this.time + st.durationSec;
            if (st.onFullFired && st.maxStacks !== undefined && (st.stacks ?? 1) < st.maxStacks) st.onFullFired = false; // 掉层再满可再触发（迷雾L100）
            continue;
          }
          unit.states.delete(tag);
          if (tag === 'shield' && unit.shield > 0) unit.shield = 0; // 护盾随状态消退
          this.pushLog('state_expire', { actorId: unit.unitId, side: unit.side, stateTag: tag });
          // 机制批③段二 堡垒「要塞展开」结束反击：状态自然到期→持有者放 expireEffectRef（被驱散删除不经此=不触发）。
          if (st.expireEffectRef !== undefined && unit.alive) {
            const eff = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', st.expireEffectRef);
            if (eff) {
              const hits = Math.min(10, st.hitCounter ?? 0);
              const scale = 1 + unit.affixes.fortressChargePct * hits; // 堡垒A「被打积能」：×(1+系数×受击次·封顶10次)·基础档系数0=×1
              const targets = this.selectTargets(unit, eff.targetingTag, eff.maxTargets, undefined);
              this.pushLog('ultimate_cast', {
                actorId: unit.unitId, side: unit.side, effectRef: eff.rowId, effectType: eff.effectType,
                targetIds: targets.map((x) => x.unitId), note: 'state_expire_effect',
              });
              if (targets.length > 0) this.applyEffectToTargets(unit, eff, targets, undefined, scale);
            }
          }
        }
      }
      if (!unit.alive) continue;
      // ⑦M3：叠层规则时间面（per_second 累积 / attack_gap 断档·无规则单位零循环零行为）
      for (const r of unit.stackRules) {
        if (r.rule.on === 'per_second') {
          while (r.nextAccrueAt <= this.time + 1e-9) {
            if (r.rule.breakOn === 'target_switch') this.syncTrackedTarget(unit, r);
            if (r.rule.stat !== 'dmgVsLockedPct' || unit.lockedTargetId !== null) {
              r.stacks = Math.min(r.rule.maxStacks ?? Infinity, r.stacks + 1);
              r.lastEventAt = this.time;
            }
            r.nextAccrueAt += 1;
          }
        }
        if (
          r.rule.breakOn === 'attack_gap' && r.stacks > 0
          && r.rule.breakGapSec !== undefined && r.rule.breakGapSec > 0
          && this.time - r.lastEventAt > r.rule.breakGapSec + 1e-9
        ) {
          r.stacks = r.rule.breakAction === 'decay_1' ? r.stacks - 1 : 0;
          r.lastEventAt = this.time; // 重臂：再满一个 gap 才断下一次
        }
      }
      // ⑥8a 召唤生命周期：summonExpireSec 到期消亡（unit_down 由步"清理死亡"统一记录）
      if (unit.summonExpireAt !== null && unit.summonExpireAt <= this.time + 1e-9) {
        unit.alive = false;
        unit.hp = 0;
      }
    }
  }

  /** ⑦机制批① M2：结算一次周期 tick。燃烧=无视防御的伤害（先啃护盾 1:1，吃旧易伤×1.25/易伤参数版/减伤%，
   *  免伤=0；不触发 on_hit/attack_landed，不吃暴击/闪避）；回血=直接回血（快照量·满血跳过不记日志）。
   *  击杀归账给施加者（施加者已死则只记阵亡数）。 */
  private settlePeriodicTick(unit: RtUnit, st: RtStateInst): void {
    const base = (st.tickAmount ?? 0) * (st.stacks ?? 1);
    if (base <= 0) return;
    const actorId = st.sourceUnitId ?? unit.unitId;
    const side = st.sourceSide ?? unit.side;
    if (st.tag === 'regen') {
      const amount = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(base)));
      if (amount <= 0) return; // 满血不跳不记
      unit.hp += amount;
      this.pushLog('heal', {
        actorId, side, targetIds: [unit.unitId], effectRef: st.srcEffectRef, effectType: 'regen',
        periodic: true, amount, hpAfter: unit.hp, shieldAfter: unit.shield,
      });
      return;
    }
    // burn
    let raw = base;
    if (unit.states.has('vulnerable')) raw *= VULNERABLE_MULT;
    const takenUp = this.stateModSum(unit, 'dmg_taken_up');
    if (takenUp !== 0) raw *= 1 + takenUp;
    const reduction = Math.min(1, Math.max(0, this.stateModSum(unit, 'dmg_taken_down') + this.ruleStatSum(unit, 'dmgTakenDownPct')));
    if (reduction >= 1) {
      this.pushLog('damage', {
        actorId, side, targetIds: [unit.unitId], effectRef: st.srcEffectRef, effectType: 'burn',
        periodic: true, amount: 0, immune: true, hpAfter: unit.hp, shieldAfter: unit.shield,
      });
      return;
    }
    if (reduction > 0) raw *= 1 - reduction;
    const dmg = Math.max(1, Math.round(raw));
    let hpDmg = dmg;
    if (unit.shield > 0) {
      const absorbed = Math.min(unit.shield, dmg); // 周期伤对护盾 1:1（不吃削盾系数·纸面规则）
      unit.shield -= absorbed;
      hpDmg = dmg - absorbed;
      if (unit.shield <= 0) {
        unit.shield = 0;
        unit.states.delete('shield');
        unit.shieldBrokenSinceTrigger = true;
      }
    }
    if (hpDmg > 0) unit.hp -= hpDmg;
    if (unit.hp <= 0) {
      unit.hp = 0;
      unit.alive = false;
    }
    this.pushLog('damage', {
      actorId, side, targetIds: [unit.unitId], effectRef: st.srcEffectRef, effectType: 'burn',
      periodic: true, amount: hpDmg, hpAfter: unit.hp, shieldAfter: unit.shield,
    });
    if (!unit.alive) {
      this.deadCount[unit.side] += 1;
      const source = st.sourceUnitId ? this.units.find((u) => u.unitId === st.sourceUnitId) : undefined;
      if (source && source.alive) {
        source.killedSinceTrigger = true;
        source.killedRolesSinceTrigger.push(unit.roleTag);
        this.accrueStackEvent(source, 'kill');
        this.accrueChargeKills(source); // 机制批③：DoT 击杀同样攒层
      }
    }
  }

  /** 3：评估并释放三类触发（CD / 开局即放 / 血量阈值）。on_kill/on_hit 留块2b；passive 走装配 modifier、不在此 fire。
   *  ⑥8a：沉默（silence）同硬控一样挡技能触发（但不挡普攻·见 canAct）；事件标志清理并入。 */
  private stepTriggers(): void {
    // 机制批③段二：先结到点的延迟结算（小太阳后爆/蜂针引爆/余震·语义=定时触发归"三类触发"步·空队列=零回归）。
    if (this.pendingBlasts.length > 0) this.settlePendingBlasts();
    for (const unit of this.stableUnits()) {
      if (!unit.alive) continue;
      if (this.hasControl(unit) || unit.states.has('silence')) continue; // 短路/晕眩/沉默：无法触发技能
      for (const t of unit.triggers) {
        if (this.triggerReady(unit, t)) this.fireTrigger(unit, t);
      }
      // 块2b：本 tick 的击杀/受击事件已评估完，清标志（下个 tick 重新采集）。⑥8a 两个新事件标志同法。
      unit.hitSinceTrigger = false;
      unit.killedSinceTrigger = false;
      unit.shieldBrokenSinceTrigger = false;
      unit.attackLandedSinceTrigger = false;
      unit.skillCastSinceTrigger = false;
      if (unit.killedRolesSinceTrigger.length > 0) unit.killedRolesSinceTrigger = [];
      if (unit.killedHighestAtkSinceTrigger) unit.killedHighestAtkSinceTrigger = false; // 机制批③段二（翎5★）
    }
  }

  /** 机制批③段二：结算所有到点的延迟项——zone=以锚点格为中心收当刻在场者（格子不追人）·single=目标仍活才吃；
   *  伤害=施放瞬间攻击力快照×倍率·走直伤子结算口径（先啃盾 1:1 不过甲不暴击不递归）。 */
  private settlePendingBlasts(): void {
    const due = this.pendingBlasts.filter((p) => p.atTime <= this.time + 1e-9);
    if (due.length === 0) return;
    this.pendingBlasts = this.pendingBlasts.filter((p) => p.atTime > this.time + 1e-9);
    for (const p of due) {
      const caster = this.units.find((u) => u.unitId === p.casterId);
      const actor = caster ?? this.units[0]; // 施放者已死：快照照爆·记账退化给场上首单位（极端兜底·日志 actorId 仍写快照者）
      const amount = Math.max(1, Math.round(p.atkSnapshot * p.powerMult));
      if (p.kind === 'single') {
        const target = this.units.find((u) => u.unitId === p.targetId && u.alive);
        if (target) this.applySubHit(caster ?? actor, target, amount, p.effectRef, 'delayed_hit');
        continue;
      }
      // zone：锚点格十字/3×3 覆盖判定（footprint 相交）。
      const pr = p.anchorRow ?? 0;
      const pc = p.anchorCol ?? 0;
      const cells: Array<[number, number]> = p.area === 'cross'
        ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]]
        : [
          [pr - 1, pc - 1], [pr - 1, pc], [pr - 1, pc + 1],
          [pr, pc - 1], [pr, pc], [pr, pc + 1],
          [pr + 1, pc - 1], [pr + 1, pc], [pr + 1, pc + 1],
        ];
      const inArea = (u: RtUnit): boolean => {
        for (const [r, c] of cells) {
          if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
        }
        return false;
      };
      const victims = sortBy(this.units.filter((u) => u.side === p.targetSide && u.alive && inArea(u)), (u) => [u.unitId]);
      for (const v of victims) this.applySubHit(caster ?? actor, v, amount, p.effectRef, 'delayed_blast');
    }
  }

  private triggerReady(unit: RtUnit, t: RtTrigger): boolean {
    switch (t.block.on) {
      case 'cd':
        return this.time + 1e-9 >= t.nextFireAt;
      case 'battle_start':
        return !t.fired;
      case 'hp_below':
        return !t.fired && unit.maxHp > 0 && unit.hp / unit.maxHp < (t.block.threshold ?? 0);
      case 'on_kill': {
        if (t.fired || !unit.killedSinceTrigger) return false; // 可重复（fired 仅在 once=true 时闩）：每个有击杀的 tick 触发一次
        // 机制批③段二（燎5★）：本 tick 击杀数门槛（缺省 1=旧行为）。
        if ((t.block.minKills ?? 1) > unit.killedRolesSinceTrigger.length) return false;
        // 机制批③段二（翎5★）：只在击杀过"当时敌方最高攻目标"时触发（缺省不过滤=旧行为）。
        if (t.block.onKillHighestAttack === true && !unit.killedHighestAtkSinceTrigger) return false;
        // ⑦机制批①：击杀对象 roleTag 过滤（缺省不过滤=旧行为）。本 tick 击杀名单里有命中集合的才触发。
        const filter = t.block.onKillRoleTags;
        if (!filter || filter.length === 0) return true;
        return unit.killedRolesSinceTrigger.some((r) => filter.includes(r));
      }
      case 'ally_lowhp':
        // 机制批③段二（沧Lv1「驰援」）：有友军跌入残血（<threshold·缺省 C6）即触发；一次性（fireTrigger 闩 fired）。
        return !t.fired && this.units.some((u) => u.side === unit.side && u !== unit && u.alive
          && u.maxHp > 0 && u.hp / u.maxHp < (t.block.threshold ?? LOWHP_THRESHOLD));
      case 'on_hit':
        return !t.fired && unit.hitSinceTrigger; // 可重复（同上）
      case 'shield_broken':
        return !t.fired && unit.shieldBrokenSinceTrigger; // ⑥8a：本舰护盾被打破（超级护罩=once）
      case 'attack_landed':
        return !t.fired && unit.attackLandedSinceTrigger; // ⑥8a：本舰普攻命中（回充插件）
      case 'skill_cast':
        return !t.fired && unit.skillCastSinceTrigger; // ⑦机制批①：本舰放出 ultimate 类效果（战鼓）
      case 'ally_down':
        return !t.fired && this.deadCount[unit.side] >= (t.block.threshold ?? Infinity); // 一次性：己方阵亡到数
      case 'on_kill_charge':
        // 机制批③ 蓄力攒层：层数在击杀点累积（accrueChargeKills·含本舰大招自身的击杀），攒满即放。
        // 沉默/硬控挡的是 stepTriggers 的释放（循环顶部 continue），不挡累积=真源"蓄力不可被打断、仅沉默阻止释放"。
        return (t.charge ?? 0) >= (t.block.threshold ?? Infinity);
      default:
        return false; // passive（走装配 modifier，不在此 fire）
    }
  }

  /** 4：按稳定顺序处理可行动单位普攻。 */
  private stepNormalAttacks(): void {
    for (const unit of this.stableUnits()) {
      if (!this.canAct(unit)) continue;
      // 机制批③段二 堡垒「要塞展开」：no_attack 态期间停普攻（技能照放·非硬控）；缺省无此态=零回归。
      if (unit.states.has('no_attack')) continue;
      if (this.time + 1e-9 < unit.nextAttackAt) continue;
      const normal = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.normalEffectRef);
      if (!normal) continue; // normalEffectRef='none' 或缺失：本次普攻跳过（不报错）
      // 机制批③段二 充能插件：隔拍蓄力——未蓄力拍不出手只标记（照进冷却=出手节奏减半、下一发强化）。
      if (unit.affixes.chargedNormalPct > 0 && !unit.chargedNormal) {
        unit.chargedNormal = true;
        this.pushLog('unit_attack', { actorId: unit.unitId, side: unit.side, targetIds: [], effectRef: normal.rowId, note: 'charging' });
        unit.nextAttackAt = this.time + this.effInterval(unit);
        continue;
      }
      // 机制批③ 计数复释（影刃「残影」）：每满 splitEveryN 次出手后下一发分裂为 splitTargets 目标（各全额）。
      // 计数按"出手"算（含随后被致盲落空的出手）——计数在选目标前完成=不动 RNG 消费序；缺省缺席=零回归。
      let maxT = normal.maxTargets;
      if (normal.splitEveryN !== undefined && normal.splitEveryN > 0
        && normal.splitTargets !== undefined && normal.splitTargets > 1) {
        unit.splitShotCount += 1;
        if (unit.splitShotCount > normal.splitEveryN) {
          unit.splitShotCount = 0;
          maxT = Math.max(maxT, normal.splitTargets);
        }
      }
      // 机制批③段二 散射插件/充能满蓄溅射：普攻附带相邻溅射（选区扩为十字/3×3·首目标满额其余按比例）。
      let selTag = unit.targetingTag;
      let splashOverride: number | undefined;
      let scaleAll = 1;
      if (DAMAGE_TYPES.has(normal.effectType)) {
        // 群蜂「弹巢」（敌 ≥N 普攻升 3×3）/L100（恒 3×3）：条件 targeting 缩放（缺省 0=零回归）。
        if (unit.affixes.normalAreaAlways > 0
          || (unit.affixes.normalAreaMinEnemies > 0 && this.countAliveOf(opposite(unit.side)) >= unit.affixes.normalAreaMinEnemies)) {
          selTag = 'block_area';
          maxT = Math.max(maxT, 9);
        }
        if (unit.affixes.normalSplashPct > 0 && unit.affixes.normalSplashTargets >= 1) {
          const extraN = Math.floor(unit.affixes.normalSplashTargets);
          selTag = 'cross_area'; // 相邻 1 格=十字选区取最近 1·传奇 4=十字全收
          maxT = Math.max(maxT, 1 + extraN);
          splashOverride = unit.affixes.normalSplashPct;
        }
        if (unit.affixes.chargedNormalPct > 0 && unit.chargedNormal) {
          scaleAll = 1 + unit.affixes.chargedNormalPct; // 满蓄发 ×(1+档位)
          unit.chargedNormal = false;
          if (unit.affixes.chargedNormalSplashPct > 0) {
            selTag = 'cross_area';
            maxT = Math.max(maxT, 5);
            splashOverride = splashOverride ?? unit.affixes.chargedNormalSplashPct;
          }
        } else if (unit.affixes.chargedNormalPct > 0) {
          unit.chargedNormal = false; // 保守分支（理论不达·蓄力在上方拦截）
        }
      }
      const targets = this.selectTargets(unit, selTag, maxT, unit.attackRangeCells);
      if (targets.length === 0) continue; // 无可攻击目标：跳过，不报错，不重置冷却
      // ⑨机制批② M8 致盲：攻击者持 blind 态时普攻按 blindChance 概率落空（不掉血·只记 miss 日志·照进冷却）；
      // 缺省无 blind 态=首条短路不掷随机=零回归（同暴击/闪避口径）。
      const bl = unit.states.get('blind');
      if (bl && bl.blindChance && this.rng.next() < bl.blindChance) {
        this.pushLog('unit_attack', { actorId: unit.unitId, side: unit.side, targetIds: [], effectRef: normal.rowId, note: 'blind_miss' });
        unit.nextAttackAt = this.time + this.effInterval(unit);
        continue;
      }
      this.pushLog('unit_attack', {
        actorId: unit.unitId,
        side: unit.side,
        targetIds: targets.map((t) => t.unitId),
        effectRef: normal.rowId,
        effectType: normal.effectType,
      });
      this.applyEffectToTargets(unit, normal, targets, splashOverride, scaleAll);
      // ⑨机制批② M7 概率连击（极焰快速装填/锋矢L100）：普攻 repeatChance 概率额外再打一发（重选目标·单次不链）；
      // 缺省无 repeatChance=首条短路不掷随机=零回归（同暴击/闪避口径）。
      if (normal.repeatChance !== undefined && normal.repeatChance > 0 && this.rng.next() < normal.repeatChance) {
        const extra = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
        if (extra.length > 0) this.applyEffectToTargets(unit, normal, extra);
      }
      // 机制批③段二 翎3★「夺势期普攻+1击」：持加攻速态期间普攻附带额外一击（重选目标·各判暴击）。
      if (unit.affixes.extraNormalHitWhileAtkSpeedUp > 0 && unit.states.has('atk_speed_up')) {
        const bonusHit = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
        if (bonusHit.length > 0) this.applyEffectToTargets(unit, normal, bonusHit);
      }
      unit.nextAttackAt = this.time + this.effInterval(unit);
    }
  }

  /** 7：检查并触发 Boss phase（每个 phase 每场只触发一次）。 */
  private stepBossPhases(): void {
    for (const phase of this.phases) {
      if (phase.triggered) continue;
      const boss = this.findBoss(phase.row.bossNodeId);
      if (!boss) continue;
      if (!this.phaseConditionMet(phase.row, boss)) continue;
      phase.triggered = true;
      this.triggerPhase(boss, phase.row);
    }
  }

  /** 8：清理死亡单位并记录 unit_down，释放占格。⑥8a：先做"随源消亡"级联（无该类召唤物时零行为）。 */
  private stepCleanupDead(): void {
    // ⑥8a 召唤生命周期：despawnWithSource=true 的存活召唤物，其召唤源已死则一并消亡（含链式·定点循环）。
    let cascaded = true;
    while (cascaded) {
      cascaded = false;
      for (const s of this.units) {
        if (!s.alive || !s.despawnWithSource || s.summonedBy === null) continue;
        const src = this.units.find((u) => u.unitId === s.summonedBy);
        if (src && !src.alive) {
          s.alive = false;
          s.hp = 0;
          cascaded = true;
        }
      }
    }
    for (const unit of this.stableUnits()) {
      if (unit.alive || unit.downLogged) continue;
      unit.downLogged = true;
      unit.diedAt = this.time; // 机制批③段二：甘霖SS复活按"最近阵亡"选人
      // 机制批③段二b 亡语（哨卫A 诱饵盒爆炸反击）：死亡清理时以死亡锚点格放效果（缺省缺席=零行为）。
      const deathRef = (this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', unit.unitStatRef) as { onDeathEffectRef?: string } | null)?.onDeathEffectRef;
      if (deathRef !== undefined) {
        const eff = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', deathRef);
        if (eff) {
          const foes = this.units.filter((u) => u.side !== unit.side && u.alive && u.hp > 0);
          const kind = eff.targetingTag === 'block_area' ? 'block' : 'cross';
          const victims = this.orderAreaAround(unit, foes, eff.maxTargets, kind).filter((u) => u.side !== unit.side);
          for (const v of victims) {
            this.applySubHit(unit, v, Math.max(1, Math.round(unit.attack * eff.effectPower)), eff.rowId, 'death_blast');
          }
        }
      }
      this.freeCells(unit);
      // 机制批③段二 澈5★「增益转移」：被增益友军阵亡→其增益态原样搬给同阵营最高攻存活友军（同 tag 覆盖）。
      if (this.anyBuffTransfer) this.transferBuffsOnDeath(unit);
      this.pushLog('unit_down', { actorId: unit.unitId, side: unit.side });
    }
  }

  /** 机制批③段二 澈5★：把死者身上的增益态（BUFF_TAGS ∩ 在身）搬给同阵营最高攻存活友军；无承接者=散佚。 */
  private transferBuffsOnDeath(dead: RtUnit): void {
    const carrier = this.units.find((u) => u.side === dead.side && u.alive && u.affixes.buffTransferOnDeath > 0);
    if (!carrier) return;
    const buffs: RtStateInst[] = [];
    for (const tag of BUFF_TAGS) {
      const st = dead.states.get(tag);
      if (st && tag !== 'shield') buffs.push(st); // 护盾数值绑单位不搬（记§16d 口径）
    }
    if (buffs.length === 0) return;
    const heirs = sortBy(this.units.filter((u) => u.side === dead.side && u.alive && u !== dead), (u) => [-u.attack, u.unitId]);
    if (heirs.length === 0) return;
    const heir = heirs[0];
    for (const st of buffs) heir.states.set(st.tag, { ...st });
    this.pushLog('state_apply', {
      actorId: carrier.unitId, side: carrier.side, targetIds: [heir.unitId],
      effectRef: 'buff_transfer', note: buffs.map((b) => b.tag).join(','),
    });
  }

  /** 9：检查胜负或 timeout。 */
  private checkOutcome(): { winner: S7AutoBattleWinner; reason: S7AutoBattleReason } | null {
    const enemiesAlive = this.units.some((u) => u.side === 'enemy' && u.alive);
    const playersAlive = this.units.some((u) => u.side === 'player' && u.alive);
    // RT-04-fix#4：仍有未处理出怪批次时，场上暂时无敌人不算清场（防延迟首波/两波间清场提前胜利）。
    const pendingSpawns = this.spawnPlans.some((p) => !p.processed);
    // 敌人全灭且无待出怪才判玩家胜（同 tick 双方清空也算清场成功）。
    if (!enemiesAlive && !pendingSpawns) return { winner: 'player', reason: 'all_enemies_down' };
    if (!playersAlive) return { winner: 'enemy', reason: 'all_players_down' };
    return null;
  }

  // ===== 触发 / 星核 =====

  /** 释放一条触发的效果并推进其计时/闩锁；首次任意触发后放一次 coreEffectRef（占位钩子，星核大改留块3）。 */
  private fireTrigger(unit: RtUnit, t: RtTrigger): void {
    const effect = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', t.block.effectRef);
    // 先推进触发状态（即便 effectRef 为 none/缺失也推进，避免每 tick 重试）。
    // 块4b-2：技能急速词条（本单位插件提供）缩短触发型技能 CD：effCd = cdSec/(1+skillHaste)。skillHaste=0 时不变（零回归）。
    if (t.block.on === 'cd') {
      const baseCd = t.block.cdSec && t.block.cdSec > 0 ? t.block.cdSec : Infinity;
      // ⑦机制批①：技能急速 buff 状态（时光糖「缩短技能CD」）并入急速分母；无状态时和 0=表达式值逐字节不变。
      const haste = unit.affixes.skillHaste + this.stateModSum(unit, 'skill_haste_up') + this.auraSum(unit, 'skillHastePct');
      t.nextFireAt = this.time + (baseCd === Infinity ? Infinity : baseCd / (1 + haste));
    } else {
      // 事件型（on_kill/on_hit/shield_broken/attack_landed/skill_cast）默认可重复：靠 stepTriggers 清事件标志重新武装；
      // once=true 时闩死（⑥8a·超级护罩"每场1次"）。其余（battle_start/hp_below/ally_down）保持一次性。
      const repeatable = t.block.on === 'on_kill' || t.block.on === 'on_hit'
        || t.block.on === 'shield_broken' || t.block.on === 'attack_landed' || t.block.on === 'skill_cast'
        || t.block.on === 'on_kill_charge'; // 机制批③：蓄力攒层可反复攒满反复放
      if (!repeatable || t.block.once) t.fired = true;
      if (t.block.on === 'on_kill_charge') t.charge = 0; // 释放后清零重攒（溢出层随清零丢弃·真源口径）
    }
    if (!effect) return;
    // ⑦机制批①：放出 ultimate 类效果=一次"放技能"（skill_cast 事件·战鼓；core/state 类不算·真源口径）。
    // 同 tick 内排在其后的 skill_cast 触发会立即看到本标志（触发顺序=积木顺序·确定性）。
    if (effect.effectKind === 'ultimate') unit.skillCastSinceTrigger = true;
    this.castLogged(unit, effect, 'ultimate_cast');
    // 机制批③段二 蜂巢「同步开火」：本舰放技能→在场召唤物立即齐射一次（≥2=S 阶·连本舰普攻也触发）。
    if (effect.effectKind === 'ultimate' && unit.affixes.summonSyncFire > 0) this.syncFireSummons(unit);
    if (!unit.coreTriggered && unit.coreEffectRef !== 'none') {
      const core = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.coreEffectRef);
      if (core) {
        unit.coreTriggered = true;
        this.castLogged(unit, core, 'core_trigger');
      }
    }
  }

  /**
   * 释放一个主动效果（大招 / 星核）并记录施法事件：先选定目标（RNG 仅抽一次），
   * 把目标写入施法日志（cast 事件早于其伤害/状态事件），再施加。召唤型无预选目标，
   * 召出的单位由随后的 spawn_wave 体现。
   */
  private castLogged(caster: RtUnit, effect: S7BattleEffectParam, logType: S7AutoBattleLogType): void {
    // 机制批③ 幸运扭蛋（luckyOnCast 词条·§15）：每次放技能（ultimate 类）先掷路由再结算本技能——
    // 连放/暴击/吸血/范围强化对"当次"即生效（爽感优先·§16d 口径）；缺省词条 0=不掷随机=零回归。
    let gachaExtraCast = 0;
    if (effect.effectKind === 'ultimate' && caster.affixes.luckyOnCast > 0) {
      gachaExtraCast = this.rollGachaOnCast(caster);
    }
    // ⑥8a cd_refund：缩短施法者自身全部 cd 型触发的下次可放时刻（effectPower=秒数·无目标·不掷随机）。
    if (effect.effectType === 'cd_refund') {
      for (const t of caster.triggers) {
        if (t.block.on === 'cd' && Number.isFinite(t.nextFireAt)) {
          t.nextFireAt = Math.max(this.time, t.nextFireAt - effect.effectPower);
        }
      }
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType, targetIds: [caster.unitId] });
      return;
    }
    if (effect.effectType === 'accumulate_attack') {
      // ⑨机制批② M9 贪吃星（运行时属性累积·on_kill 触发）：本场永久 +effectPower×基础攻（additive 不复利·无上限）。
      caster.attack += Math.round(effect.effectPower * caster.baseAttack);
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType, targetIds: [caster.unitId] });
      return;
    }
    // 机制批③ 曲率星门：开局一次性整排对调（rank_swap 效果型·全场只结算一次）。
    if (effect.effectType === 'rank_swap') {
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType });
      this.resolveRankSwap(caster);
      return;
    }
    // 机制批③段二 骁5★「击杀延长先锋窗」：延长自身 stateTag 态的到期时刻 +effectPower 秒（无该态=空转）。
    if (effect.effectType === 'extend_state') {
      const st = caster.states.get(effect.stateTag);
      if (st) st.expireAt = roundTime(st.expireAt + effect.effectPower);
      this.pushLog(logType, {
        actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType,
        targetIds: [caster.unitId], note: st ? 'extended' : 'no_state',
      });
      return;
    }
    // 机制批③段二 甘霖SS「复活」：复活一名最近阵亡友军（每场 1 次·血量=最大生命×reviveHpPct）+
    // effectPower>0 时顺带全队回血（攻×power·SS"复活+全队回血"一行成型）。
    if (effect.effectType === 'revive') {
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType });
      if (!caster.reviveUsed) {
        const dead = sortBy(
          this.units.filter((u) => u.side === caster.side && !u.alive && u.downLogged),
          (u) => [-(u.diedAt ?? 0), u.unitId],
        )[0];
        if (dead) {
          caster.reviveUsed = true;
          dead.alive = true;
          dead.downLogged = false;
          dead.hp = Math.max(1, Math.round(dead.maxHp * (effect.reviveHpPct ?? 0.4)));
          let placed = false;
          if (this.canPlace(dead.side, dead.row, dead.col, dead.sizeRows, dead.sizeCols)) {
            this.occupy(dead);
            placed = true;
          } else {
            const cell = this.findEmptyCell(dead.side, dead.sizeRows, dead.sizeCols);
            if (cell) {
              dead.row = cell.row;
              dead.col = cell.col;
              dead.slotRef = dead.side === 'player' ? `p${cell.row}c${cell.col}` : `r${cell.row}c${cell.col}`;
              this.occupy(dead);
              placed = true;
            }
          }
          if (!placed) {
            // 满场无格：复活失败回滚（闩锁一并回滚=下次再试）。
            dead.alive = false;
            dead.downLogged = true;
            dead.hp = 0;
            caster.reviveUsed = false;
          } else {
            // 复活后大招 CD 重置为满 CD（防"复活即放大招"·§16d 数值域定稿）；普攻下一拍起。
            for (const t2 of dead.triggers) {
              if (t2.block.on === 'cd' && t2.block.cdSec !== undefined && t2.block.cdSec > 0) t2.nextFireAt = this.time + t2.block.cdSec;
            }
            dead.nextAttackAt = this.time + dead.attackIntervalSec;
            this.pushLog('revive', {
              actorId: caster.unitId, side: caster.side, targetIds: [dead.unitId],
              effectRef: effect.rowId, amount: dead.hp, hpAfter: dead.hp,
            });
          }
        }
      }
      if (effect.effectPower > 0) {
        for (const u of this.units) {
          if (u.side === caster.side && u.alive) this.heal(caster, u, effect);
        }
      }
      return;
    }
    if (SUMMON_TYPES.has(effect.effectType)) {
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType });
      const budget: SummonBudget = { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, budget, 'effect_summon', caster, effect);
      // 机制批③ 扭蛋"连放"对召唤型技能=再召一轮（预算独立·同源上限照常约束）。
      for (let i = 0; i < gachaExtraCast; i += 1) {
        const b2: SummonBudget = { remaining: effect.maxTargets };
        this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, b2, 'effect_summon', caster, effect);
      }
      return;
    }
    // 机制批③ 扭蛋"范围+1"（area_up 态·仅 ultimate/core 类）：技能作用范围升一档（单体→十字→3×3），
    // maxTargets 同步抬到该档几何上限；缺省无 area_up 态=选区参数逐字节不变。
    let selTag = effect.targetingTag;
    let selMax = effect.maxTargets;
    if ((effect.effectKind === 'ultimate' || effect.effectKind === 'core')
      && (caster.states.has('area_up') || caster.affixes.skillAreaUp > 0)) {
      const up = upgradeAreaTag(selTag);
      if (up) {
        selTag = up.tag;
        selMax = Math.max(selMax, up.minTargets);
      }
    }
    const targets = this.selectTargets(caster, selTag, selMax, undefined);
    this.pushLog(logType, {
      actorId: caster.unitId,
      side: caster.side,
      effectRef: effect.rowId,
      effectType: effect.effectType,
      targetIds: targets.map((t) => t.unitId),
    });
    this.applyEffectToTargets(caster, effect, targets);
    // 机制批③ 银河烟花多米诺（chainOnKillMax·§15）：补发若击杀则同 tick 立即再补、逐发递增，未击杀/到上限即断。
    if (effect.chainOnKillMax !== undefined && effect.chainOnKillMax > 1 && targets.length > 0) {
      this.resolveKillChain(caster, effect, targets[0], selTag);
    }
    // ⑨机制批② M7 多重释放（极焰SS 连放三次/群蜂饱和SS 连放两轮）：额外 repeatCount 次重选+重放；缺省无=零回归。
    // 机制批③：扭蛋"连放"并入同一循环（+gachaExtraCast）；段二：连发插件概率连放（词条掷·仅 ultimate·缺省 0=不掷）。
    let multiCast = Math.max(0, Math.floor(effect.repeatCount ?? 0)) + gachaExtraCast
      + (effect.effectKind === 'ultimate' ? Math.max(0, Math.floor(caster.affixes.skillRepeatCount)) : 0); // 段二b：极焰SS/群蜂SS 词条连放
    if (effect.effectKind === 'ultimate' && caster.affixes.skillRepeatChance > 0
      && this.rng.next() < caster.affixes.skillRepeatChance) {
      multiCast += 1;
    }
    for (let i = 0; i < multiCast; i += 1) {
      const rt = this.selectTargets(caster, selTag, selMax, undefined);
      this.applyEffectToTargets(caster, effect, rt);
    }
    // 机制批③段二 循环插件：技能每命中 1 目标缩 CD（传奇：命中满目标数再+固定值）；缺省 0=零回归。
    if (effect.effectKind === 'ultimate' && caster.affixes.skillCdPerTargetSec > 0 && targets.length > 0) {
      let refund = caster.affixes.skillCdPerTargetSec * targets.length;
      if (caster.affixes.skillCdFullBonusSec > 0 && targets.length >= selMax) refund += caster.affixes.skillCdFullBonusSec;
      for (const t of caster.triggers) {
        if (t.block.on === 'cd' && Number.isFinite(t.nextFireAt)) {
          t.nextFireAt = Math.max(this.time, t.nextFireAt - refund);
        }
      }
    }
  }

  /** 机制批③段二 山岳「磁暴盾」：受伤×系数转护盾均分存活友军（累加式=转化语义·区别常规护盾"取较大"·§16d 口径）；
   *  设 shieldCapMaxHpMult 时各盾封顶最大生命×系数、溢出×overflowShieldToHealPct 转全队回血（山岳A）。 */
  private convertDamageToTeamShield(converter: RtUnit, hpDmg: number): void {
    const total = Math.round(hpDmg * converter.affixes.dmgToTeamShieldPct);
    if (total <= 0) return;
    const allies = sortBy(this.units.filter((u) => u.side === converter.side && u.alive), (u) => [u.unitId]);
    if (allies.length === 0) return;
    const per = Math.max(1, Math.floor(total / allies.length));
    let overflowTotal = 0;
    for (const a of allies) {
      let gain = per;
      if (converter.affixes.shieldCapMaxHpMult > 0) {
        const cap = Math.round(a.maxHp * converter.affixes.shieldCapMaxHpMult);
        const room = Math.max(0, cap - a.shield);
        if (gain > room) {
          overflowTotal += gain - room;
          gain = room;
        }
      }
      if (gain <= 0) continue;
      a.shield += gain;
      const prevExpire = a.states.get('shield')?.expireAt ?? 0;
      a.states.set('shield', { tag: 'shield', expireAt: Math.max(prevExpire, this.time + 6), sourceUnitId: converter.unitId });
    }
    this.pushLog('state_apply', {
      actorId: converter.unitId, side: converter.side, targetIds: allies.map((a) => a.unitId),
      effectRef: 'storm_shield', stateTag: 'shield', amount: total, note: 'damage_to_shield',
    });
    // 山岳A「溢盾转奶」：溢出量×系数 → 全队均分回血。
    if (overflowTotal > 0 && converter.affixes.overflowShieldToHealPct > 0) {
      const healTotal = Math.round(overflowTotal * converter.affixes.overflowShieldToHealPct);
      const healPer = Math.max(1, Math.floor(healTotal / allies.length));
      for (const a of allies) {
        if (a.hp >= a.maxHp) continue;
        const before = a.hp;
        a.hp = Math.min(a.maxHp, a.hp + healPer);
        if (a.hp !== before) {
          this.pushLog('heal', {
            actorId: converter.unitId, side: converter.side, targetIds: [a.unitId],
            effectRef: 'storm_shield', amount: a.hp - before, note: 'shield_overflow_heal',
            hpAfter: a.hp, shieldAfter: a.shield,
          });
        }
      }
    }
  }

  /** 机制批③段二 蜂巢「同步开火」：本舰在场召唤物各立即普攻一次（不动其冷却节奏）；词条 ≥2（S 阶）=本舰也普攻一次。 */
  private syncFireSummons(source: RtUnit): void {
    const drones = this.units.filter((u) => u.alive && u.summonedBy === source.unitId);
    for (const d of drones) this.syncOneAttack(d);
    if (source.affixes.summonSyncFire >= 2) this.syncOneAttack(source);
  }

  private syncOneAttack(unit: RtUnit): void {
    if (!this.canAct(unit) || unit.states.has('no_attack')) return;
    const normal = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.normalEffectRef);
    if (!normal) return;
    const targets = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
    if (targets.length === 0) return;
    this.pushLog('unit_attack', {
      actorId: unit.unitId, side: unit.side, targetIds: targets.map((t) => t.unitId),
      effectRef: normal.rowId, effectType: normal.effectType, note: 'sync_fire',
    });
    this.applyEffectToTargets(unit, normal, targets);
  }

  /** 机制批③ 幸运扭蛋路由：等权五选一（战斗种子 RNG·可复现）。返回本次技能的额外连放次数（echo=1 其余 0）。 */
  private rollGachaOnCast(caster: RtUnit): number {
    const idx = Math.min(GACHA_OUTCOMES.length - 1, Math.floor(this.rng.next() * GACHA_OUTCOMES.length));
    const outcome = GACHA_OUTCOMES[idx];
    this.pushLog('core_gacha', { actorId: caster.unitId, side: caster.side, note: outcome });
    switch (outcome) {
      case 'crit':
        this.applyState(caster, caster, 'crit_rate_up', GACHA_DURATION_SEC, GACHA_CRIT_ROW);
        return 0;
      case 'area':
        this.applyState(caster, caster, 'area_up', GACHA_DURATION_SEC, GACHA_AREA_ROW);
        return 0;
      case 'echo':
        return 1;
      case 'lifesteal':
        this.applyState(caster, caster, 'lifesteal_up', GACHA_DURATION_SEC, GACHA_LIFESTEAL_ROW);
        return 0;
      case 'cd':
      default:
        for (const t of caster.triggers) {
          if (t.block.on === 'cd' && Number.isFinite(t.nextFireAt)) {
            t.nextFireAt = Math.max(this.time, t.nextFireAt - GACHA_CD_REFUND_SEC);
          }
        }
        return 0;
    }
  }

  /** 机制批③ 银河烟花多米诺链：首发已由调用方结算；上一发致死才续补下一发（同 tick 同步结算·真源"若又击杀则继续"）。
   *  链内第 k 发（k 从 1 计）伤害 ×(1+chainRampPct×(k−1))；补发按效果行 targetingTag 重选（死者天然排除）。 */
  private resolveKillChain(caster: RtUnit, effect: S7BattleEffectParam, firstTarget: RtUnit, selTag: string): void {
    const chainMax = effect.chainOnKillMax ?? 1;
    const ramp = effect.chainRampPct ?? 0;
    let shots = 1;
    let last = firstTarget;
    while (shots < chainMax && !last.alive) {
      const next = this.selectTargets(caster, selTag, 1, undefined);
      if (next.length === 0) break;
      this.dealDamage(caster, next[0], effect, 1 + ramp * shots);
      last = next[0];
      shots += 1;
    }
  }

  /** 机制批③ 曲率星门（真源：只对 1 格单位生效·多格 Boss 不参与·开局一次性）：对施法者的敌对阵营，
   *  取"有 1×1 存活单位的最前列 F 与最后列 B"，逐行互换 (r,F)↔(r,B) 的占用（一端为空=单位移到对面空格）；
   *  任一端格被多格单位覆盖的行跳过。全场只结算一次（再次触发记 already_swapped 空转）。 */
  private resolveRankSwap(caster: RtUnit): void {
    const side = opposite(caster.side);
    if (this.rankSwapDone) {
      this.pushLog('rank_swap', { actorId: caster.unitId, side: caster.side, targetIds: [], note: 'already_swapped' });
      return;
    }
    this.rankSwapDone = true;
    const movers = this.units.filter((u) => u.side === side && u.alive && u.sizeRows === 1 && u.sizeCols === 1);
    if (movers.length === 0) {
      this.pushLog('rank_swap', { actorId: caster.unitId, side: caster.side, targetIds: [], note: 'no_targets' });
      return;
    }
    let front = Infinity;
    let back = -Infinity;
    for (const u of movers) {
      front = Math.min(front, u.col);
      back = Math.max(back, u.col);
    }
    if (front === back) {
      this.pushLog('rank_swap', { actorId: caster.unitId, side: caster.side, targetIds: [], note: 'single_rank' });
      return;
    }
    const rows = side === 'player' ? PLAYER_ROWS : ENEMY_ROWS;
    const moved: string[] = [];
    for (let r = 0; r < rows; r += 1) {
      const a = movers.find((u) => u.row === r && u.col === front);
      const b = movers.find((u) => u.row === r && u.col === back);
      if (!a && !b) continue;
      // 多格单位（Boss）footprint 覆盖任一端格 → 该行跳过（真源口径表：Boss 常占多格、不参与整排对调）。
      if (this.cellCoveredByMultiCell(side, r, front) || this.cellCoveredByMultiCell(side, r, back)) continue;
      if (a) this.freeCells(a);
      if (b) this.freeCells(b);
      if (a) {
        a.col = back;
        a.slotRef = side === 'player' ? `p${a.row}c${a.col}` : `r${a.row}c${a.col}`;
        this.occupy(a);
        moved.push(a.unitId);
      }
      if (b) {
        b.col = front;
        b.slotRef = side === 'player' ? `p${b.row}c${b.col}` : `r${b.row}c${b.col}`;
        this.occupy(b);
        moved.push(b.unitId);
      }
    }
    this.pushLog('rank_swap', { actorId: caster.unitId, side: caster.side, targetIds: moved, note: `c${front}<->c${back}` });
  }

  /** 某格是否被"多格存活单位"的 footprint 覆盖（曲率星门跳行判定·1×1 单位不算）。 */
  private cellCoveredByMultiCell(side: S7AutoBattleSide, r: number, c: number): boolean {
    for (const u of this.units) {
      if (u.side !== side || !u.alive || (u.sizeRows === 1 && u.sizeCols === 1)) continue;
      if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
    }
    return false;
  }

  // ===== Boss phase =====

  private findBoss(bossNodeId: string): RtUnit | null {
    for (const unit of this.stableUnits()) {
      if (unit.side === 'enemy' && unit.alive && unit.isBoss && unit.bossNodeId === bossNodeId) return unit;
    }
    return null;
  }

  private phaseConditionMet(phase: S7BattleBossPhaseParam, boss: RtUnit): boolean {
    switch (phase.triggerType) {
      case 'battle_start':
        return true;
      case 'hp_pct_below':
        return (boss.hp / boss.maxHp) * 100 < phase.triggerValue;
      case 'time_elapsed_sec':
        return this.time + 1e-9 >= phase.triggerValue;
      default:
        return false;
    }
  }

  private triggerPhase(boss: RtUnit, phase: S7BattleBossPhaseParam): void {
    this.pushLog('boss_phase', { actorId: boss.unitId, side: 'enemy', phaseTag: phase.phaseTag, note: phase.rowId });
    const budget: SummonBudget = { remaining: phase.summonCountCap };
    for (const ref of phase.effectRefs) {
      const eff = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', ref);
      if (!eff) continue;
      this.resolveEffect(boss, eff, false, budget);
    }
    // phase.summonUnitRefs：按出现顺序分组后召唤，与召唤型 effectRefs 共用同一 phase 预算。
    // ⑥8a：记录召唤源=Boss（无 effect=无限时/无随源消亡/无同源上限——阶段召唤行为不变）。
    for (const group of groupOrdered(phase.summonUnitRefs)) {
      this.summonUnits('enemy', group.ref, group.count, budget, 'phase_summon', boss);
    }
  }

  // ===== 效果结算 =====

  /** 结算一个效果：召唤型走召唤分支，其余按 targetingTag 选目标后施加。 */
  private resolveEffect(caster: RtUnit, effect: S7BattleEffectParam, isNormal: boolean, budget: SummonBudget | null): void {
    if (effect.effectType === 'cd_refund') {
      // ⑥8a：cd_refund 无目标、作用自身（phase 路径同语义）。
      for (const t of caster.triggers) {
        if (t.block.on === 'cd' && Number.isFinite(t.nextFireAt)) {
          t.nextFireAt = Math.max(this.time, t.nextFireAt - effect.effectPower);
        }
      }
      return;
    }
    if (SUMMON_TYPES.has(effect.effectType)) {
      const b = budget ?? { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, b, 'effect_summon', caster, effect);
      return;
    }
    const tag = isNormal ? caster.targetingTag : effect.targetingTag;
    const range = isNormal ? caster.attackRangeCells : undefined;
    const targets = this.selectTargets(caster, tag, effect.maxTargets, range);
    this.applyEffectToTargets(caster, effect, targets);
  }

  /** ⑥8a：stateTag 施加概率门——字段缺省或 ≥1 时必定施加且不掷随机（零回归）；仅 (0,1) 才消费 RNG。 */
  private rollStateChance(effect: S7BattleEffectParam): boolean {
    const c = effect.stateChance;
    if (c === undefined || c >= 1) return true;
    return this.rng.next() < c;
  }

  private applyEffectToTargets(caster: RtUnit, effect: S7BattleEffectParam, targets: RtUnit[], splashOverride?: number, damageScaleAll = 1): void {
    const type = effect.effectType;
    // 机制批③ 弹跳衰减族：伤害行带 bounceTargets≥2 时改走弹跳链（首目标=常规选定的 targets[0]，逐跳弹向
    // 最近未命中敌；第 n 跳伤害 ×max(0,1−n×bounceDecayPct)）。stateTag/追加状态对"实际命中链"施加。
    // 缺省缺席=finalTargets===targets=逐字节不变。
    let finalTargets = targets;
    if (DAMAGE_TYPES.has(type)) {
      if (effect.maxHpPctDamage !== undefined && effect.maxHpPctDamage > 0) {
        // 机制批③段二 比例伤行（炎3★致命一击/影5★Boss侧）：目标最大生命×系数（Boss 按 bossFactor 折）——
        // 走直伤子结算口径（不吃攻/暴击/护甲乘区·先啃盾 1:1·§16d 口径）。
        for (const t of targets) {
          if (!t.alive) continue;
          const factor = t.isBoss ? (effect.maxHpPctBossFactor ?? 1) : 1;
          this.applySubHit(caster, t, Math.max(1, Math.round(t.maxHp * effect.maxHpPctDamage * factor)), effect.rowId, 'pct_damage');
        }
      } else if (effect.bounceTargets !== undefined && effect.bounceTargets > 1 && targets.length > 0) {
        finalTargets = this.resolveBounceChain(targets[0], effect.bounceTargets);
        const decay = effect.bounceDecayPct ?? 0;
        for (let i = 0; i < finalTargets.length; i += 1) {
          const scale = (1 - i * decay) * damageScaleAll;
          if (scale <= 1e-9) { finalTargets = finalTargets.slice(0, i); break; }
          this.dealDamage(caster, finalTargets[i], effect, scale);
        }
      } else {
        // ⑨机制批② M7 溅射分伤（散射枪管/引爆器/极焰节点/贯日L40）：首目标满额、其余按 splashPct；缺省无 splashPct=全额=逐字节不变。
        // 机制批③段二：splashOverride/damageScaleAll=词条驱动的普攻溅射与充能强化（缺省 undefined/1=逐字节不变）；
        // 段二b：requireTargetState=只打带指定状态的目标（霹雳SS 引爆被短路敌·缺省缺席=全结算）。
        const splash = splashOverride ?? effect.splashPct;
        for (let i = 0; i < targets.length; i += 1) {
          if (effect.requireTargetState !== undefined && !targets[i].states.has(effect.requireTargetState)) continue;
          this.dealDamage(caster, targets[i], effect, (splash !== undefined && i > 0 ? splash : 1) * damageScaleAll);
        }
      }
      if (effect.stateTag !== 'none') {
        for (const t of finalTargets) if (t.alive && this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
      }
    } else if (SHIELD_TYPES.has(type)) {
      for (const t of targets) this.addShield(caster, t, effect);
      this.applyFrameworkRider(caster, effect, targets);
      this.applyDispelRider(caster, effect, targets); // ⑨机制批② M5：晨曦「回响」=护盾附净化
    } else if (HEAL_TYPES.has(type)) {
      for (const t of targets) this.heal(caster, t, effect);
      this.applyFrameworkRider(caster, effect, targets);
      this.applyDispelRider(caster, effect, targets); // ⑨机制批② M5：回响/涤荡/春风净化=治疗附净化
    } else if (STATE_TYPES.has(type)) {
      for (const t of targets) if (this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
    } else if (type === 'purify') {
      this.applyDispelRider(caster, effect, targets); // ⑨机制批② M5：净化模块=纯净化主体（无伤无治）
    }
    // ⑦机制批① 一发多态（山岳「不动」免控+减伤 / 时光糖 加攻速+技能急速 / 侵蚀 破防+虚弱）：
    // 追加状态行按数组序对同一目标集施加；被引用行自身的 alsoApplyStateRefs 不再展开（禁链式）。
    // 字段缺省（全部旧配置）不进此分支=零行为变化。
    const extraRefs = effect.alsoApplyStateRefs;
    if (extraRefs && extraRefs.length > 0) {
      for (const ref of extraRefs) {
        const row = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', ref);
        if (!row || row.stateTag === 'none') continue;
        for (const t of finalTargets) if (t.alive && this.rollStateChance(row)) this.applyState(caster, t, row.stateTag, row.durationSec, row);
      }
    }
    // 机制批③段二 延迟爆点（小太阳完整版=灼烧行挂爆点/蜂针定时爆破=伤害行挂爆点·类型无关）：
    // 以首目标锚点格快照区域，delayedBlastSec 秒后引爆 delayedBlastRef（缺省缺席=零回归）。
    if (effect.delayedBlastRef !== undefined && (effect.delayedBlastSec ?? 0) > 0) {
      const anchor = finalTargets[0] ?? targets[0];
      if (anchor) this.schedulePendingZone(caster, effect, anchor);
    }
  }

  /** 机制批③段二：登记一个区域延迟爆点（锚=首目标当前锚点格·攻击力施放瞬间快照·形状/倍率取爆点行）。 */
  private schedulePendingZone(caster: RtUnit, hostEffect: S7BattleEffectParam, anchor: RtUnit): void {
    const blast = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', hostEffect.delayedBlastRef ?? '');
    if (!blast) return;
    this.pendingBlasts.push({
      atTime: roundTime(this.time + (hostEffect.delayedBlastSec ?? 0)),
      casterId: caster.unitId,
      casterSide: caster.side,
      atkSnapshot: caster.attack,
      kind: 'zone',
      effectRef: blast.rowId,
      anchorRow: anchor.row,
      anchorCol: anchor.col,
      powerMult: blast.effectPower,
      area: blast.targetingTag === 'cross_area' ? 'cross' : 'block',
      targetSide: opposite(caster.side),
    });
  }

  /** 机制批③ 弹跳链目标解析：从首目标起逐跳选"距当前目标最近（曼哈顿距）的未命中同阵营敌人"；
   *  unitId 平局稳定序、不消耗 RNG；无新目标即断链。返回含首目标的完整链（长度 ≤ bounceTargets）。 */
  private resolveBounceChain(primary: RtUnit, bounceTargets: number): RtUnit[] {
    const chain: RtUnit[] = [primary];
    const visited = new Set<RtUnit>([primary]);
    while (chain.length < bounceTargets) {
      const cur = chain[chain.length - 1];
      const candidates = this.units.filter((u) => u.side === primary.side && u.alive && u.hp > 0 && !visited.has(u));
      if (candidates.length === 0) break;
      const next = sortBy(candidates, (u) => [Math.abs(u.row - cur.row) + Math.abs(u.col - cur.col), u.unitId])[0];
      chain.push(next);
      visited.add(next);
    }
    return chain;
  }

  /** ⑦机制批①：护盾/治疗行的框架状态搭载（甘霖「再生」=治疗附 HoT/晨曦Lv100 普盾附减伤）。
   *  只对框架新 tag（修正/周期）生效——旧 tag（如护盾行自描述的 stateTag='shield'）维持描述性不消费=零回归。 */
  private applyFrameworkRider(caster: RtUnit, effect: S7BattleEffectParam, targets: RtUnit[]): void {
    if (!MOD_STATE_TAGS.has(effect.stateTag) && !PERIODIC_STATE_TAGS.has(effect.stateTag)) return;
    for (const t of targets) if (t.alive && this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
  }

  /** ⑨机制批② M5：净化/驱散 rider——对每个存活目标移除状态（缺 dispelCount 或 ≤0=零操作=逐字节不变）。
   *  挂治疗/护盾行=附带净化（回响/涤荡/春风净化）；作 purify 主体=纯净化（净化模块）。 */
  private applyDispelRider(caster: RtUnit, effect: S7BattleEffectParam, targets: RtUnit[]): void {
    const count = effect.dispelCount ?? 0;
    if (count <= 0) return;
    for (const t of targets) if (t.alive) this.applyDispel(caster, t, effect, count);
  }

  /** ⑨机制批② M5：从 target 移除至多 count 个状态。极性由目标阵营定——
   *  友军=净化（移除减益·硬控需 dispelHardControl）/ 敌方=驱散（移除增益）；按 §16c 优先级序·跳过不可驱散态。
   *  移除 shield 态同步清零护盾数值（镜像 stepExpireStates 口径）。 */
  private applyDispel(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam, count: number): number {
    const cleanse = target.side === caster.side; // 友军→净化减益；敌方→驱散增益
    const order = cleanse ? DISPEL_DEBUFF_ORDER : DISPEL_BUFF_ORDER;
    const allowHardControl = effect.dispelHardControl === true;
    const removed: S7BattleStateTag[] = [];
    for (const tag of order) {
      if (removed.length >= count) break;
      if (cleanse && HARD_CONTROL_TAGS.includes(tag) && !allowHardControl) continue;
      const inst = target.states.get(tag);
      if (!inst || inst.undispellable) continue;
      target.states.delete(tag);
      if (tag === 'shield') target.shield = 0;
      removed.push(tag);
    }
    if (removed.length > 0) {
      this.pushLog('state_dispel', {
        actorId: caster.unitId, side: caster.side, targetIds: [target.unitId],
        effectRef: effect.rowId, note: (cleanse ? 'cleanse:' : 'dispel:') + removed.join(','),
      });
    }
    return removed.length; // 机制批③段二：霖「涤荡」附属钩需要移除数（旧调用方不读=行为不变）
  }

  /** 机制批③段二 沛「润泽」覆盖计数：同阵营存活友军里"身上有本舰来源增益/护盾态"的人数；
   *  with 变体把"即将被覆盖的目标"也计入（首个目标也算 1 人=真源"覆盖1人=+4%"口径）。 */
  private coverageCountWith(src: RtUnit, incoming: RtUnit): number {
    let n = 0;
    for (const u of this.units) {
      if (u.side !== src.side || !u.alive) continue;
      if (u === incoming || this.coveredBy(u, src)) n += 1;
    }
    return n;
  }

  private allAlliesCoveredBy(src: RtUnit): boolean {
    for (const u of this.units) {
      if (u.side !== src.side || !u.alive) continue;
      if (!this.coveredBy(u, src)) return false;
    }
    return true;
  }

  private coveredBy(unit: RtUnit, src: RtUnit): boolean {
    for (const tag of BUFF_TAGS) {
      const st = unit.states.get(tag);
      if (st && st.sourceUnitId === src.unitId) return true;
    }
    return false;
  }

  private dealDamage(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam, damageScale = 1): void {
    if (!target.alive) return;
    target = this.resolveGuard(caster, target); // ⑨机制批② M4 守护替挡：敌打我方后排友军→伤害转就绪守护者(岩·CD 门控)；无守护态=原目标
    // ⑥8a 闪避（受方词条·警戒雷达）：仅 dodgeRate>0 才掷随机（零回归模式同暴击）；闪避=完全落空，
    // 不掉血不破盾、不触发 on_hit / attack_landed，只记 amount=0 + dodged 标记的伤害日志。
    if (target.affixes.dodgeRate > 0 && this.rng.next() < target.affixes.dodgeRate) {
      // 机制批③段二 警戒传奇「闪避后必暴」：闩下一击必暴（缺省词条 0=零写入）。
      if (target.affixes.critAfterDodge > 0) target.guaranteedCritNext = true;
      this.pushLog('damage', {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: 0,
        dodged: true,
        hpAfter: target.hp,
        shieldAfter: target.shield,
      });
      return;
    }
    // ⑦机制批① 免伤（dmg_taken_down 状态 + 叠层规则减伤轴 总幅度 ≥1）：整发落空——不掉血不破盾、
    // 不触发 on_hit/attack_landed，只记 amount=0 + immune 标记（同 dodge 的"新内容才出现"口径；
    // 置于 dodge 之后保证既有 RNG 消费序不变）。
    const dmgReduction = Math.min(1, Math.max(0,
      this.stateModSum(target, 'dmg_taken_down') + this.ruleStatSum(target, 'dmgTakenDownPct') + this.auraSum(target, 'dmgTakenDownPct')
      // 机制批③段二 舰体传奇：自身 <30% 时减伤+（缺省 0=逐字节不变）。
      + (target.affixes.lowHpDmgTakenDown > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD ? target.affixes.lowHpDmgTakenDown : 0)));
    if (dmgReduction >= 1) {
      this.pushLog('damage', {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: 0,
        immune: true,
        hpAfter: target.hp,
        shieldAfter: target.shield,
      });
      return;
    }
    // ⑨机制批② M4：一次性取受方反弹态（供下方格挡减免 + 尾部反弹直扣复用）；缺省无 reflect 态=两处皆跳过=逐字节不变。
    const reflectInst = target.states.get('reflect');
    const shareInst = target.states.get('share'); // ⑨机制批② M4 分摊：受方把一部分伤害转承接者（缺省无 share=receiverDmg=dmg）
    // ⑥8a 破甲（施方词条·藏）：无视目标一部分防御；armorPen=0 时防御原值（零回归）。
    // ⑦机制批① 破防（armor_down 状态·受方）：再乘 (1−幅度)；无状态时乘 1=逐字节不变。
    const armorCut = Math.min(1, Math.max(0, this.stateModSum(target, 'armor_down')));
    // 机制批③段二 空L100「对召唤源穿防」：对 roleTag=summon_source 追加穿透（缺省 0=逐字节不变）。
    let pen = caster.affixes.armorPen
      + (target.roleTag === 'summon_source' ? caster.affixes.armorPenVsSummonSource : 0);
    // 机制批③段二 藏5★「对最高防无视全部防御」：目标是"当时敌方存活最高防"才追加（缺省 0=逐字节不变）。
    if (caster.affixes.armorPenVsHighestArmor > 0
      && !this.units.some((u) => u.side === target.side && u.alive && u.armor > target.armor)) {
      pen += caster.affixes.armorPenVsHighestArmor;
    }
    // 机制批③段二 堡垒「厚装」（每 10% 当前血防御 ×(1+系数)）+ S「低血保底防御」（<30% 时 +固定值）——缺省 0=逐字节不变。
    let baseArmor = target.armor;
    if (target.affixes.armorPerHpDecilePct > 0 && target.maxHp > 0) {
      baseArmor *= 1 + target.affixes.armorPerHpDecilePct * Math.floor((target.hp / target.maxHp) * 10 + 1e-9);
    }
    if (target.affixes.lowHpArmorFlat > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD) {
      baseArmor += target.affixes.lowHpArmorFlat;
    }
    const effArmor = baseArmor * (1 - Math.min(1, Math.max(0, pen))) * (1 - armorCut);
    // 机制批③段二 尾部钩用的入手前快照（满血判定/破半跨线判定）。
    const preHp = target.hp;
    const preHpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 0;
    let raw = this.effAttack(caster) * effect.effectPower * damageScale * 100 / (100 + effArmor); // ⑨M7 溅射：damageScale 缺省 1=逐字节不变
    if (target.states.has('vulnerable')) raw *= VULNERABLE_MULT;
    // 块4b-1：定向加伤词条（施法者插件提供）。对 Boss 用 dmgVsBoss，对其余（小怪/非 Boss 目标）用 dmgVsSwarm。
    raw *= 1 + (target.isBoss ? caster.affixes.dmgVsBoss : caster.affixes.dmgVsSwarm);
    // ⑥8a 条件伤害词条族（缺省 0=不变）：对残血(影斩首)/对高血(烬贪婪)/对带盾或高防(破障弹)。
    // 机制批③段二：影 L20/L80·烬 L40 的阈值覆盖词条（缺省 0=用全局 C6/C7=逐字节不变）。
    const lowThresh = caster.affixes.lowHpThresholdPct > 0 ? caster.affixes.lowHpThresholdPct : LOWHP_THRESHOLD;
    const highThresh = caster.affixes.highHpThresholdPct > 0 ? caster.affixes.highHpThresholdPct : HIGHHP_THRESHOLD;
    if (caster.affixes.dmgVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < lowThresh) {
      raw *= 1 + caster.affixes.dmgVsLowHp;
    }
    if (caster.affixes.dmgVsHighHp > 0 && target.maxHp > 0 && target.hp / target.maxHp > highThresh) {
      raw *= 1 + caster.affixes.dmgVsHighHp;
    }
    if (caster.affixes.dmgVsFortified > 0 && (target.shield > 0 || target.armor >= FORTIFIED_ARMOR_THRESHOLD)) {
      raw *= 1 + caster.affixes.dmgVsFortified;
    }
    // 机制批③段二 条件增伤族（缺省 0=不变）：对燃烧敌(贯日A)/对召唤源(空L40)/对关键单位(蛰5★处决伤)/
    // 对满血(烬3★)/普攻专项(烈阳重火力)。
    if (caster.affixes.dmgVsBurning > 0 && target.states.has('burn')) raw *= 1 + caster.affixes.dmgVsBurning;
    if (caster.affixes.dmgVsSummonSource > 0 && target.roleTag === 'summon_source') raw *= 1 + caster.affixes.dmgVsSummonSource;
    if (caster.affixes.dmgVsKeyUnit > 0 && KEY_ROLE_TAGS.has(target.roleTag)) raw *= 1 + caster.affixes.dmgVsKeyUnit;
    if (caster.affixes.dmgVsFullHp > 0 && target.hp >= target.maxHp) raw *= 1 + caster.affixes.dmgVsFullHp;
    if (caster.affixes.normalAtkDmgPct > 0 && effect.effectKind === 'normal_attack') raw *= 1 + caster.affixes.normalAtkDmgPct;
    // 机制批③段二 蔽「笼罩」：被控/带减益敌受全队伤害+（团队易伤·anyCloak 门=缺省整段跳过）。
    if (this.anyCloak && target.side !== caster.side) {
      const cloakAmp = this.cloakAmpFor(caster.side, target);
      if (cloakAmp > 0) raw *= 1 + cloakAmp;
    }
    // ⑦机制批① 增伤（dmg_up 状态 + M3 叠层增伤轴 + 源「专注」对锁定目标专项轴）：和 0 → 不乘（逐字节不变）。
    const dmgUp = this.stateModSum(caster, 'dmg_up') + this.ruleStatSum(caster, 'dmgUpPct')
      + (caster.lockedTargetId === target.unitId ? this.ruleStatSum(caster, 'dmgVsLockedPct') : 0);
    if (dmgUp !== 0) raw *= 1 + dmgUp;
    // ⑥8a 技能侧乘区（仅 ultimate/core 伤害吃·普攻不吃）：技能伤害%（增幅线圈）× 效果量%（增效插件）。
    const isSkill = effect.effectKind === 'ultimate' || effect.effectKind === 'core';
    if (isSkill) raw *= (1 + caster.affixes.skillDmgPct) * (1 + caster.affixes.effectAmp);
    // ⑥8a 受方受伤修正（护盾发生器为负值=减伤；钳到 −90% 防归零）。
    raw *= Math.max(0.1, 1 + target.affixes.dmgTakenPct);
    // ⑦机制批① 受方状态乘区：易伤参数版（dmg_taken_up·可叠）× 减伤%（dmg_taken_down·<1 的部分；≥1 已走上方免伤路径）。
    const takenUp = this.stateModSum(target, 'dmg_taken_up');
    if (takenUp !== 0) raw *= 1 + takenUp;
    if (dmgReduction > 0) raw *= 1 - dmgReduction;
    // ⑨机制批② M4 格挡（岩「反震」·reflect 态 blockPct）：受击先减免一部分；无 reflect 态/blockPct=跳过=逐字节不变。
    if (reflectInst && reflectInst.blockPct) raw *= 1 - Math.min(1, Math.max(0, reflectInst.blockPct));
    // 块4b-2：暴击词条。仅 critRate>0 才掷随机数（&& 短路）——保证无暴击单位不消费 RNG、不扰动既有并列裁决序列（零回归）。
    //   命中暴击 → 伤害 ×(1+暴击伤害)。暴击倍率/概率为占位语义，精确值第二块。
    // ⑦机制批①：暴击率/暴伤 buff 状态并入判定与倍率（无状态时和 0=判定阈值与倍率逐字节不变）。
    let critRate = caster.affixes.critRate + this.stateModSum(caster, 'crit_rate_up');
    // 机制批③段二 条件暴击族（缺省 0=判定阈值逐字节不变）：对残血(影L100)/对高血(烬L100)/对带盾高防(破障传奇)/
    // 技能专项(过载)/全队对减益敌(蔽5★·anyTeamCrit 门)。
    if (caster.affixes.critRateVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < lowThresh) critRate += caster.affixes.critRateVsLowHp;
    if (caster.affixes.critRateVsHighHp > 0 && target.maxHp > 0 && target.hp / target.maxHp > highThresh) critRate += caster.affixes.critRateVsHighHp;
    if (caster.affixes.critRateVsFortified > 0 && (target.shield > 0 || target.armor >= FORTIFIED_ARMOR_THRESHOLD)) critRate += caster.affixes.critRateVsFortified;
    if (isSkill && caster.affixes.skillCritRate > 0) critRate += caster.affixes.skillCritRate;
    if (this.anyTeamCrit && target.side !== caster.side && this.targetHasDebuff(target)) {
      critRate += this.teamCritAmpFor(caster.side);
    }
    let crit = critRate > 0 && this.rng.next() < critRate;
    // 机制批③段二 必暴闩锁（不掷随机=新内容才生效）：警戒传奇"闪避后下一击必暴"·源5★"专注满层技能对锁定必暴"。
    if (caster.guaranteedCritNext) {
      crit = true;
      caster.guaranteedCritNext = false;
    } else if (!crit && isSkill && caster.affixes.focusMaxGuaranteedCrit > 0
      && caster.lockedTargetId === target.unitId && this.focusAtMax(caster)) {
      crit = true;
    }
    if (crit) raw *= 1 + caster.affixes.critDmg + this.stateModSum(caster, 'crit_dmg_up')
      + (target.isBoss ? caster.affixes.critDmgVsBoss : 0) + (isSkill ? caster.affixes.skillCritDmgPct : 0);
    const dmg = Math.max(1, Math.round(raw));

    // ⑨机制批② M4 分摊：受方 share 态把 sharePct 转给承接者（援护链邻格互摊/山岳SS/沧3★指定者）·自己只承剩余；
    // 承接者直扣不过甲(同反弹)·死亡归攻击者(伤害源)；缺省无 share 态 → receiverDmg=dmg=逐字节不变。
    let receiverDmg = dmg;
    if (shareInst && shareInst.sharePct) {
      const sharers = this.resolveShareSharers(target, shareInst);
      const pct = Math.min(1, Math.max(0, shareInst.sharePct));
      if (sharers.length > 0 && pct > 0) {
        const shareTotal = Math.round(dmg * pct);
        receiverDmg = dmg - shareTotal;
        this.distributeShare(sharers, shareTotal, caster);
      }
    } else if (this.anyShareGuard && this.underHardControl(target)) {
      // 机制批③段二 沧3★「友军被硬控时分摊」：受方无 share 态且正被硬控 → 同阵营持词条者替她分摊（anyShareGuard 门）。
      const guardian = this.units.find((u) => u.side === target.side && u !== target && u.alive && u.affixes.shareForControlledPct > 0);
      if (guardian) {
        const shareTotal = Math.round(dmg * Math.min(1, Math.max(0, guardian.affixes.shareForControlledPct)));
        if (shareTotal > 0) {
          receiverDmg = dmg - shareTotal;
          this.distributeShare([guardian], shareTotal, caster);
        }
      }
    }
    let hpDmg = receiverDmg;
    if (target.shield > 0) {
      // 块4b-2：破盾值词条（施法者插件提供）叠加到破盾系数 → 同一发对护盾啃得更多。
      const shieldMult = (target.states.has('shield_break') ? SHIELD_BREAK_MULT : 1.0) + caster.affixes.shieldBreak;
      const shieldLoss = Math.round(receiverDmg * shieldMult);
      if (shieldLoss <= target.shield) {
        target.shield -= shieldLoss;
        hpDmg = 0;
      } else {
        const overflowShieldPts = shieldLoss - target.shield;
        target.shield = 0;
        target.states.delete('shield');
        target.shieldBrokenSinceTrigger = true; // ⑥8a：护盾被伤害打破（自然到期不算）
        hpDmg = Math.max(0, Math.round(overflowShieldPts / shieldMult));
        // 机制批③段二 破甲传奇「破盾降防」：本舰打破敌护盾 → 给其上破防（armor_down 0.2·3s·词条驱动合成行）。
        if (caster.affixes.armorDownOnShieldBreak > 0) {
          this.applyState(caster, target, 'armor_down', 3, {
            ...GACHA_ROW_BASE, rowId: 'eff_plg_shieldbreak_shred', stateTag: 'armor_down',
            stateAmount: caster.affixes.armorDownOnShieldBreak, durationSec: 3, note: '破甲传奇（引擎内合成行）',
          });
        }
      }
    }
    // 机制批③段二 致死预结算族（直接命中路径·缺省无词条=零回归）——顺序：自保（保命插件）→ 他保（苏5★替挡）。
    if (hpDmg >= target.hp && target.hp > 0) {
      if (target.affixes.lethalGuardOnce > 0 && !target.lethalGuardUsed) {
        // 保命插件：免死留 1 血（每场 1 次）；传奇：随后短暂无敌（dmg_taken_down 1.0=整发免伤路径）。
        target.lethalGuardUsed = true;
        hpDmg = target.hp - 1;
        this.pushLog('state_apply', { actorId: target.unitId, side: target.side, targetIds: [target.unitId], effectRef: 'lethal_guard', note: 'survive_at_1' });
        if (target.affixes.lethalGuardImmuneSec > 0) {
          this.applyState(target, target, 'dmg_taken_down', target.affixes.lethalGuardImmuneSec, LETHAL_IMMUNE_ROW);
        }
      } else if (this.anyLethalSave) {
        // 苏5★「替挡致命」：同阵营持词条者替目标承受该击（每场 1 次·直伤子结算=先啃她的盾）。
        const savior = this.units.find((u) => u.side === target.side && u !== target && u.alive
          && u.affixes.saveAllyLethalOnce > 0 && !u.lethalSaveUsed);
        if (savior) {
          savior.lethalSaveUsed = true;
          this.applySubHit(caster, savior, hpDmg, effect.rowId, 'lethal_guard_ally');
          hpDmg = 0;
        }
      }
    }
    if (hpDmg > 0) target.hp -= hpDmg;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
    // 机制批③段二 堡垒A「被打积能」：要塞态（no_attack）期间受击计数（结束反击按次数放大）。
    if (hpDmg > 0) {
      const fort = target.states.get('no_attack');
      if (fort) fort.hitCounter = (fort.hitCounter ?? 0) + 1;
    }
    // 机制批③段二 山岳「磁暴盾」（伤害转化族）：自身实际扣血×系数 → 护盾均分全队（累加式·上限=shieldCapMaxHpMult·
    // 溢出×overflowShieldToHealPct 转全队回血=山岳A）。缺省词条 0=零行为。
    if (target.affixes.dmgToTeamShieldPct > 0 && hpDmg > 0) {
      this.convertDamageToTeamShield(target, hpDmg);
    }
    this.pushLog('damage', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: hpDmg,
      ...(crit ? { crit: true } : {}), // 仅暴击时带字段：非暴击伤害日志保持原形状（零回归）
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
    // 机制批③段二 暴击事件族（缺省词条 0=零行为）：火力传奇溅射相邻/瞄准传奇补刀/爆裂传奇自加速。
    if (crit) {
      if (caster.affixes.critSplashPct > 0) {
        const adjacents = sortBy(
          this.units.filter((u) => u.side === target.side && u.alive && u !== target && this.isAdjacentCell(target, u)),
          (u) => [Math.abs(u.row - target.row) + Math.abs(u.col - target.col), u.unitId],
        );
        if (adjacents.length > 0) {
          this.applySubHit(caster, adjacents[0], Math.max(1, Math.round(dmg * caster.affixes.critSplashPct)), effect.rowId, 'crit_splash');
        }
      }
      if (caster.affixes.critFollowupAtkPct > 0 && target.alive) {
        this.applySubHit(caster, target, Math.max(1, Math.round(caster.attack * caster.affixes.critFollowupAtkPct)), effect.rowId, 'crit_followup');
      }
      if (caster.affixes.critHasteAmount > 0) {
        this.applyState(caster, caster, 'atk_speed_up', 3, {
          ...GACHA_ROW_BASE, rowId: 'eff_plg_crit_haste', stateTag: 'atk_speed_up',
          stateAmount: caster.affixes.critHasteAmount, durationSec: 3, note: '爆裂传奇（引擎内合成行）',
        });
      }
    }
    // ⑥8a 吸血（施方词条·嗜血弹）：按实际扣血量回吸；lifesteal=0 或未掉血时零行为零日志。
    // 机制批③：扭蛋"吸血"限时态并入（无该态时和 0=判定与数值逐字节不变）；段二：嗜血传奇=暴击时本次吸血翻倍。
    const lifestealPct = (caster.affixes.lifesteal + this.stateModSum(caster, 'lifesteal_up'))
      * (crit && caster.affixes.critLifestealDouble > 0 ? 2 : 1);
    if (lifestealPct > 0 && hpDmg > 0 && caster.alive && caster.hp < caster.maxHp) {
      const healed = Math.min(caster.maxHp - caster.hp, Math.max(1, Math.round(hpDmg * lifestealPct)));
      caster.hp += healed;
      this.pushLog('heal', {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [caster.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: healed,
        hpAfter: caster.hp,
        shieldAfter: caster.shield,
      });
    }
    // ⑥8a：普攻命中事件（回充插件消费；闪避已在顶部 return、不计命中）。
    // ⑦M3：叠层规则事件累积——炎「过热」普攻命中（immune 已提前 return 不计）。
    if (effect.effectKind === 'normal_attack') {
      caster.attackLandedSinceTrigger = true;
      this.accrueStackEvent(caster, 'attack_landed');
    }
    // 块2b：采集事件型触发的事件（在 stepTriggers 评估、清标志）。
    if (!target.alive) {
      caster.killedSinceTrigger = true;
      caster.killedRolesSinceTrigger.push(target.roleTag); // ⑦机制批①：击杀对象过滤用（内部采集·无行为分支）
      // 机制批③段二 翎5★：本次击杀对象是否为"当时敌方存活最高攻目标"（含其本身·内部采集无行为分支）。
      if (!this.units.some((u) => u.side === target.side && u.alive && u.attack > target.attack)) {
        caster.killedHighestAtkSinceTrigger = true;
      }
      this.deadCount[target.side] += 1;
      this.accrueStackEvent(caster, 'kill', target); // ⑦M3：贪吃星/燎3★
      this.accrueChargeKills(caster); // 机制批③：蓄力攒层（群蜂饱和·无 charge 触发=空循环零行为）
    } else {
      target.hitSinceTrigger = true;
      // ⑦M3：受击事件累积——污染体狂暴（被任意伤害命中）/ 铁壁「坚甲」（被技能伤害命中=真源"重击"口径）。
      this.accrueStackEvent(target, 'was_hit', caster);
      if (isSkill) this.accrueStackEvent(target, 'was_hit_by_skill', caster);
    }
    // 机制批③段二 岳能力「事件知识」：命中"对方后排"的攻击者记时间戳（anyEventKnowledge 门=缺省零写入）。
    if (this.anyEventKnowledge && this.isBacklineOfSide(target)) {
      caster.lastHitBacklineAt = this.time;
    }
    // ⑨机制批② M4 反弹（受方 reflect 态·岩反震/岳荆甲/铁壁A/磐石A/砺5★）：把"受到的伤害"一部分直扣攻击者。
    // 攻击者=caster 天然在手（在 dealDamage 内结算·非走 on_hit·避开 §5"攻击者上下文缺"深坑）；
    // 反弹伤=直扣不过甲、不再触发反弹/on_hit/attack_landed（无递归、不改既有事件序）；反弹致死镜像既有击杀记账归反弹者。
    if (reflectInst && caster.alive) {
      const reflectAmt = Math.round(
        (reflectInst.reflectPct ?? 0) * dmg
        + (reflectInst.reflectAtkPct ?? 0) * caster.attack
        + (reflectInst.reflectBase ?? 0));
      if (reflectAmt > 0) {
        caster.hp -= reflectAmt;
        const reflectorKill = caster.hp <= 0;
        if (reflectorKill) { caster.hp = 0; caster.alive = false; }
        this.pushLog('damage', {
          actorId: target.unitId, side: target.side, targetIds: [caster.unitId],
          effectRef: 'reflect', amount: reflectAmt, note: 'reflect', hpAfter: caster.hp, shieldAfter: caster.shield,
        });
        if (reflectorKill) {
          target.killedSinceTrigger = true;
          target.killedRolesSinceTrigger.push(caster.roleTag);
          this.deadCount[caster.side] += 1;
          this.accrueStackEvent(target, 'kill');
          this.accrueChargeKills(target); // 机制批③：反弹击杀同样攒层
        }
      }
    }
    // 机制批③ 引力阱（skillHitCurHpPct 词条·仅技能命中）：追加"目标当前生命×系数"伤害、上限=本舰攻×skillHitCapAtkMult——
    // 按主伤结算后的当前生命计（主伤致死=无追伤·§16d 口径）；走直伤子结算（先啃盾 1:1 再扣血·不过甲不暴击不递归）。
    if (isSkill && caster.affixes.skillHitCurHpPct > 0 && target.alive && target.hp > 0) {
      const capMult = caster.affixes.skillHitCapAtkMult;
      const cap = capMult > 0 ? Math.round(caster.attack * capMult) : Infinity;
      const bonus = Math.min(cap, Math.max(1, Math.round(target.hp * caster.affixes.skillHitCurHpPct)));
      this.applySubHit(caster, target, bonus, effect.rowId, 'gravity_bonus');
    }
    // 机制批③ 共鸣音叉（dmgSplitFattestPct 词条）：本次直接命中成伤的一部分同时打向全场血量最高的敌人
    // （目标本身就是最肥时也分流=同目标再吃一份·§16d 口径）；DoT/反弹/分摊/子结算不分流（不递归）。
    if (caster.affixes.dmgSplitFattestPct > 0 && dmg > 0) {
      const foes = this.units.filter((u) => u.side === target.side && u.alive && u.hp > 0);
      if (foes.length > 0) {
        const fattest = sortBy(foes, (u) => [-u.hp, u.unitId])[0];
        this.applySubHit(caster, fattest, Math.max(1, Math.round(dmg * caster.affixes.dmgSplitFattestPct)), effect.rowId, 'resonance_split');
      }
    }
    // ===== 机制批③段二 命中后钩族（全部词条缺省 0=零回归·结算序=§16d 记档：削血→破半→碎甲→处决→引爆→余震→集火反射→嘲讽反弹）=====
    // 烬3★「削血」：命中满血目标（入手前快照）追加削其当前生命×系数（直伤子结算）。
    if (caster.affixes.shaveCurHpPct > 0 && preHp >= target.maxHp && target.alive && target.hp > 0) {
      this.applySubHit(caster, target, Math.max(1, Math.round(target.hp * caster.affixes.shaveCurHpPct)), effect.rowId, 'hp_shave');
    }
    // 烬5★顺路升级「破半」：这一击把目标从半血以上打入半血及以下 → 追加一次结算（演出=爆点放大无飘字·总谱⑦）。
    if (caster.affixes.halfBreakAtkPct > 0 && target.alive && target.maxHp > 0
      && preHpRatio > 0.5 && target.hp / target.maxHp <= 0.5) {
      this.applySubHit(caster, target, Math.max(1, Math.round(caster.attack * caster.affixes.halfBreakAtkPct)), effect.rowId, 'half_break');
    }
    // 藏5★顺路升级「装甲碎裂」：命中"当时敌方存活最高防目标"概率碎甲（易伤 2s=全队对其增伤·真源口径）。
    if (caster.affixes.shatterChance > 0 && target.alive
      && !this.units.some((u) => u.side === target.side && u.alive && u.armor > target.armor)
      && this.rng.next() < caster.affixes.shatterChance) {
      this.applyState(caster, target, 'vulnerable', SHATTER_ROW.durationSec, SHATTER_ROW);
    }
    // 藏3★「击中高防叠破防」：命中"当时敌方存活最高防目标"概率叠 armor_down（0.3·可叠2·5s·词条合成行）。
    if (caster.affixes.shredOnHitChance > 0 && target.alive
      && !this.units.some((u) => u.side === target.side && u.alive && u.armor > target.armor)
      && this.rng.next() < caster.affixes.shredOnHitChance) {
      this.applyState(caster, target, 'armor_down', 5, {
        ...GACHA_ROW_BASE, rowId: 'eff_pil_cang20_shred', stateTag: 'armor_down',
        stateAmount: 0.3, stateMaxStacks: 2, durationSec: 5, note: '藏3★破防叠（引擎内合成行）',
      });
    }
    // 影5★「处决」：对 <阈值 非 Boss 直接即死（无视护盾/护甲·kill 记账归本舰）；
    // Boss 侧=首次跌破阈值后本舰下一次命中追加最大生命×系数（每场每 Boss 一次·§16d 数值域定稿）。
    if (caster.affixes.executeLowHpPct > 0 && target.alive && target.maxHp > 0
      && target.hp / target.maxHp < caster.affixes.executeLowHpPct) {
      if (!target.isBoss) {
        const remain = target.hp;
        target.hp = 0;
        target.alive = false;
        this.pushLog('damage', {
          actorId: caster.unitId, side: caster.side, targetIds: [target.unitId],
          effectRef: effect.rowId, amount: remain, note: 'execute', hpAfter: 0, shieldAfter: target.shield,
        });
        caster.killedSinceTrigger = true;
        caster.killedRolesSinceTrigger.push(target.roleTag);
        this.deadCount[target.side] += 1;
        this.accrueStackEvent(caster, 'kill', target);
        this.accrueChargeKills(caster);
      } else if (caster.affixes.executeBossMaxHpPct > 0) {
        const done = target.bossExecuteDoneBy ?? (target.bossExecuteDoneBy = new Set<string>());
        if (!done.has(caster.unitId)) {
          done.add(caster.unitId);
          this.applySubHit(caster, target, Math.max(1, Math.round(target.maxHp * caster.affixes.executeBossMaxHpPct)), effect.rowId, 'execute_boss');
        }
      }
    }
    // 引爆插件（技能命中）：目标相邻敌人吃 攻×系数 额外伤（传奇=十字全收·缺省=最近相邻 1 个）。
    if (isSkill && caster.affixes.skillDetonateAtkPct > 0) {
      const adj = this.units.filter((u) => u.side === target.side && u.alive && u !== target && this.isAdjacentCell(target, u));
      const picks = caster.affixes.skillDetonateCross > 0
        ? adj.filter((u) => Math.abs(u.row - target.row) + Math.abs(u.col - target.col) === 1)
        : sortBy(adj, (u) => [Math.abs(u.row - target.row) + Math.abs(u.col - target.col), u.unitId]).slice(0, 1);
      for (const v of picks) {
        this.applySubHit(caster, v, Math.max(1, Math.round(caster.attack * caster.affixes.skillDetonateAtkPct)), effect.rowId, 'detonate');
      }
    }
    // 余震插件（技能命中）：目标 1.5s 后吃延迟追加伤 攻×系数（单体·目标死亡=空爆）。
    if (isSkill && caster.affixes.aftershockAtkPct > 0 && target.alive) {
      this.pendingBlasts.push({
        atTime: roundTime(this.time + AFTERSHOCK_DELAY_SEC), casterId: caster.unitId, casterSide: caster.side,
        atkSnapshot: caster.attack, kind: 'single', effectRef: effect.rowId, targetId: target.unitId,
        powerMult: caster.affixes.aftershockAtkPct, targetSide: target.side,
      });
    }
    // 岳5★「反射全部攻击者」：维护近期攻击者履历（窗口内）·本次受伤×系数均分反射（直伤子结算·记账归受方）。
    if (target.affixes.reflectAllRecentPct > 0 && target.alive && dmg > 0) {
      const ra = target.recentAttackers ?? (target.recentAttackers = []);
      const kept = ra.filter((e) => this.time - e.at <= BACKLINE_ATTACKER_WINDOW_SEC + 1e-9 && e.id !== caster.unitId);
      kept.push({ id: caster.unitId, at: this.time });
      target.recentAttackers = kept;
      const attackers = kept
        .map((e) => this.units.find((u) => u.unitId === e.id))
        .filter((u): u is RtUnit => !!u && u.alive);
      if (attackers.length > 0) {
        const per = Math.max(1, Math.round((dmg * target.affixes.reflectAllRecentPct) / attackers.length));
        for (const a of attackers) this.applySubHit(target, a, per, 'reflect_all', 'reflect_all');
      }
    }
    // 砺5★「按血差反弹给嘲讽目标」：反弹比例=系数×(已损血比例/0.5) 封顶系数（血越低反弹越肥·≤50% 血满额）。
    if (target.affixes.tauntReflectPct > 0 && target.alive && target.maxHp > 0 && dmg > 0) {
      const lostRatio = 1 - target.hp / target.maxHp;
      const pct = Math.min(target.affixes.tauntReflectPct, target.affixes.tauntReflectPct * (lostRatio / 0.5));
      const victim = this.units.find((u) => u.side !== target.side && u.alive
        && u.states.get('taunt')?.tauntedBy === target.unitId);
      if (victim && pct > 0) {
        this.applySubHit(target, victim, Math.max(1, Math.round(dmg * pct)), 'taunt_reflect', 'taunt_reflect');
      }
    }
  }

  /** 机制批③段二 蔽「笼罩」总幅度：攻方阵营存在笼罩者且目标带减益 → 基础幅度(+Boss 门)+每种减益叠加（取最强笼罩者）。 */
  private cloakAmpFor(attackerSide: S7AutoBattleSide, target: RtUnit): number {
    let best = 0;
    for (const u of this.units) {
      if (u.side !== attackerSide || !u.alive || u.affixes.debuffedTakenAmpTeam <= 0) continue;
      if (target.isBoss && u.affixes.debuffedTakenIncludeBoss <= 0) continue;
      const debuffCount = DEBUFF_TAGS.filter((d) => target.states.has(d)).length;
      if (debuffCount === 0) continue;
      const amp = u.affixes.debuffedTakenAmpTeam + u.affixes.debuffedTakenPerDebuff * Math.max(0, debuffCount - 1);
      if (amp > best) best = amp;
    }
    return best;
  }

  /** 机制批③段二 蔽5★：攻方阵营最强"全队对减益敌暴击+"幅度。 */
  private teamCritAmpFor(attackerSide: S7AutoBattleSide): number {
    let best = 0;
    for (const u of this.units) {
      if (u.side === attackerSide && u.alive && u.affixes.teamCritVsDebuffed > best) best = u.affixes.teamCritVsDebuffed;
    }
    return best;
  }

  private targetHasDebuff(target: RtUnit): boolean {
    return DEBUFF_TAGS.some((d) => target.states.has(d));
  }

  /** 机制批③段二 源5★：专注（dmgVsLockedPct 轴）任一规则攒满层。 */
  private focusAtMax(unit: RtUnit): boolean {
    for (const r of unit.stackRules) {
      if (r.rule.stat === 'dmgVsLockedPct' && r.rule.maxStacks !== undefined && this.ruleStacksOf(unit, r) >= r.rule.maxStacks) return true;
    }
    return false;
  }

  /** 机制批③段二：单位是否处于硬控（短路/晕眩/沉默·沧3★"被硬控友军"判据）。 */
  private underHardControl(unit: RtUnit): boolean {
    for (const tag of HARD_CONTROL_TAGS) if (unit.states.has(tag)) return true;
    return false;
  }

  /** 机制批③段二 岳「事件知识」：受害者是否是其阵营的"后排"（玩家侧 col≤1·敌侧 col≥1；多格单位按锚点）。 */
  private isBacklineOfSide(victim: RtUnit): boolean {
    return victim.side === 'player' ? victim.col <= 1 : victim.col >= 1;
  }

  /** 机制批③ 直伤子结算（引力阱追伤/共鸣音叉分流）：先啃盾 1:1 再扣血（周期伤口径）、不过甲不暴击、
   *  不触发 on_hit/attack_landed/反弹/分摊/再追伤（不递归·同⑨直扣族）；击杀记账归 actor。 */
  private applySubHit(actor: RtUnit, victim: RtUnit, amount: number, effectRef: string, noteTag: string): void {
    if (!victim.alive || amount <= 0) return;
    let hpDmg = amount;
    if (victim.shield > 0) {
      const absorbed = Math.min(victim.shield, amount);
      victim.shield -= absorbed;
      hpDmg = amount - absorbed;
      if (victim.shield <= 0) {
        victim.shield = 0;
        victim.states.delete('shield');
        victim.shieldBrokenSinceTrigger = true;
      }
    }
    if (hpDmg > 0) victim.hp -= hpDmg;
    const dead = victim.hp <= 0;
    if (dead) {
      victim.hp = 0;
      victim.alive = false;
    }
    this.pushLog('damage', {
      actorId: actor.unitId, side: actor.side, targetIds: [victim.unitId],
      effectRef, amount: hpDmg, note: noteTag, hpAfter: victim.hp, shieldAfter: victim.shield,
    });
    if (dead) {
      actor.killedSinceTrigger = true;
      actor.killedRolesSinceTrigger.push(victim.roleTag);
      this.deadCount[victim.side] += 1;
      this.accrueStackEvent(actor, 'kill');
      this.accrueChargeKills(actor);
    }
  }

  private addShield(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam): void {
    if (!target.alive) return;
    // ⑥8a 护盾强度词条（已知小旋钮①·晨曦S质变/苏回光护盾侧/磐石专属）+ 技能效果量词条（增效插件）：
    // 全部缺省 0 → 与旧公式逐字节一致。
    const isSkill = effect.effectKind === 'ultimate' || effect.effectKind === 'core';
    let powerMult = (1 + caster.affixes.shieldPower) * (isSkill ? 1 + caster.affixes.effectAmp : 1);
    // 机制批③段二 苏L40/L80「残血盾量+」：对残血友军护盾量放大（缺省 0=逐字节不变）。
    if (caster.affixes.shieldVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD) {
      powerMult *= 1 + caster.affixes.shieldVsLowHp;
    }
    // 机制批③段二 沛「润泽」：覆盖越多每份越强（护盾侧·缺省 0=逐字节不变）。
    if (caster.affixes.coverageAmpPerAlly > 0 && target.side === caster.side) {
      powerMult *= 1 + this.coverageCountWith(caster, target) * caster.affixes.coverageAmpPerAlly;
    }
    // 机制批③段二 shieldMaxHpPct：护盾量改按"目标最大生命×系数"（护盾传奇/沛3★·缺省缺席=原公式逐字节不变）。
    const baseAmount = effect.shieldMaxHpPct !== undefined && effect.shieldMaxHpPct > 0
      ? Math.round(target.maxHp * effect.shieldMaxHpPct)
      : Math.max(
        Math.round(target.maxHp * SHIELD_HP_FRACTION),
        Math.round(caster.attack * effect.effectPower),
      );
    const amount = Math.round(baseAmount * powerMult);
    // 同名状态不叠层：护盾量取较大值，刷新持续时间。
    target.shield = Math.max(target.shield, amount);
    // ⑥8a 持久力场词条：技能型持续效果时长 ×(1+durationPct)（普攻护盾不吃·真源"技能的持续型效果"口径）。
    let duration = (effect.durationSec > 0 ? effect.durationSec : 1) * (isSkill ? 1 + caster.affixes.durationPct : 1);
    // 机制批③段二 沛5★：覆盖全队时辅助持续再翻倍档（护盾侧）。
    if (caster.affixes.durationPctFullCoverage > 0 && target.side === caster.side && this.allAlliesCoveredBy(caster)) {
      duration *= 1 + caster.affixes.durationPctFullCoverage;
    }
    target.states.set('shield', { tag: 'shield', expireAt: this.time + duration, sourceUnitId: caster.unitId });
    this.pushLog('state_apply', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      stateTag: 'shield',
      amount,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
  }

  private heal(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam): void {
    if (!target.alive) return;
    // 块4b-1：治疗强度词条（施法者插件提供）放大治疗量。
    // ⑥8a 追加（缺省 0=不变）：对残血友军治疗加成（苏回光）× 受治疗加成（治疗强化·受方）× 技能效果量（增效）。
    let rawHeal = caster.attack * effect.effectPower * (1 + caster.affixes.healPower);
    if (caster.affixes.healVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD) {
      rawHeal *= 1 + caster.affixes.healVsLowHp;
    }
    if (effect.effectKind === 'ultimate' || effect.effectKind === 'core') rawHeal *= 1 + caster.affixes.effectAmp;
    rawHeal *= 1 + target.affixes.healTakenPct;
    const amount = Math.round(rawHeal);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    this.pushLog('heal', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: healed,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
    // ===== 机制批③段二 治疗附属钩族（全部词条缺省 0=零回归）=====
    // 苏L100/医修传奇「溢疗转盾」：溢出量×系数转护盾（同名护盾取较大值·6s 数值域定）。
    const overflow = amount - healed;
    if (caster.affixes.overhealToShieldPct > 0 && overflow > 0) {
      const gain = Math.max(1, Math.round(overflow * caster.affixes.overhealToShieldPct));
      target.shield = Math.max(target.shield, gain);
      target.states.set('shield', { tag: 'shield', expireAt: this.time + 6, sourceUnitId: caster.unitId });
      this.pushLog('state_apply', {
        actorId: caster.unitId, side: caster.side, targetIds: [target.unitId],
        effectRef: effect.rowId, stateTag: 'shield', amount: gain, note: 'overheal_to_shield',
        hpAfter: target.hp, shieldAfter: target.shield,
      });
    }
    // 苏3★「治满血给盾」：这次治疗把目标治到满血 → 获目标最大生命×系数护盾（6s）。
    if (caster.affixes.healFullShieldMaxHpPct > 0 && healed > 0 && target.hp >= target.maxHp) {
      const gain = Math.max(1, Math.round(target.maxHp * caster.affixes.healFullShieldMaxHpPct));
      target.shield = Math.max(target.shield, gain);
      target.states.set('shield', { tag: 'shield', expireAt: this.time + 6, sourceUnitId: caster.unitId });
      this.pushLog('state_apply', {
        actorId: caster.unitId, side: caster.side, targetIds: [target.unitId],
        effectRef: effect.rowId, stateTag: 'shield', amount: gain, note: 'full_heal_shield',
        hpAfter: target.hp, shieldAfter: target.shield,
      });
    }
    // 霖「涤荡」（驾驶员层注入=词条通道）：治疗附驱散 N 个（效果行 dispelCount 之外相加）·L40 开硬控·
    // L80/5★ 驱散成功附回血 攻×系数·3★ 净化后短时免疫新减益。
    if (caster.affixes.healDispelCount > 0) {
      const removed = this.applyDispel(caster, target, {
        ...effect,
        dispelCount: Math.floor(caster.affixes.healDispelCount),
        dispelHardControl: caster.affixes.healDispelHardControl > 0,
      }, Math.floor(caster.affixes.healDispelCount));
      if (removed > 0) {
        if (caster.affixes.healOnDispelAtkPct > 0 && target.alive && target.hp < target.maxHp) {
          const extra = Math.max(1, Math.round(caster.attack * caster.affixes.healOnDispelAtkPct));
          const b2 = target.hp;
          target.hp = Math.min(target.maxHp, target.hp + extra);
          this.pushLog('heal', {
            actorId: caster.unitId, side: caster.side, targetIds: [target.unitId],
            effectRef: effect.rowId, effectType: effect.effectType, amount: target.hp - b2, note: 'dispel_heal',
            hpAfter: target.hp, shieldAfter: target.shield,
          });
        }
        if (caster.affixes.afterDispelImmuneSec > 0) {
          this.applyState(caster, target, 'debuff_immune', caster.affixes.afterDispelImmuneSec, AFTER_DISPEL_IMMUNE_ROW);
        }
      }
    }
  }

  private applyState(caster: RtUnit, target: RtUnit, tag: S7BattleStateTag, durationSec: number, effect: S7BattleEffectParam): void {
    if (tag === 'none' || !target.alive) return;
    // ⑥8a 免控状态（守护铃/山岳不动）：持有 control_immune 期间硬控（短路/晕眩/沉默）施加直接落空。
    if (HARD_CONTROL_TAGS.includes(tag) && target.states.has('control_immune')) return;
    // 机制批③段二 韧性传奇「免疫第一次硬控」：每场一次闩锁（缺省词条 0=零行为）。
    if (HARD_CONTROL_TAGS.includes(tag) && target.affixes.firstControlImmune > 0 && !target.firstControlImmuneUsed) {
      target.firstControlImmuneUsed = true;
      this.pushLog('state_apply', { actorId: target.unitId, side: target.side, targetIds: [target.unitId], effectRef: 'first_control_immune', note: 'blocked:' + tag });
      return;
    }
    // ⑨机制批② M5：减益免疫（霖3★/净化模块传奇）——持有 debuff_immune 期间一切新减益（含硬控·真源"免疫新减益"）落空。
    if (DEBUFF_STATE_TAGS.includes(tag) && target.states.has('debuff_immune')) return;
    let duration = durationSec > 0 ? durationSec : 1;
    // 块4b-2：控制抗性词条（受控方插件提供）只作用于硬控 → 缩短控制时长；抗性钳到 [0,1]。
    // ⑥8a：硬控集合从 CONTROL_TAGS（短路/晕眩）扩为 HARD_CONTROL_TAGS（+沉默·真源硬控口径）——
    // 旧配置不存在沉默状态，controlResist 对短路/晕眩的行为不变。
    if (HARD_CONTROL_TAGS.includes(tag)) {
      const resist = Math.min(1, Math.max(0, target.affixes.controlResist));
      duration *= 1 - resist;
    }
    // ⑥8a 持久力场词条：技能型状态时长 ×(1+durationPct)（缺省 0=不变）。真源明写"护盾/控制/buff"
    // 均延长——含硬控（控制被延长的对抗面=controlResist/免控/Boss 抗性，平衡走数值不改机制语义）。
    const isSkill = effect.effectKind === 'ultimate' || effect.effectKind === 'core';
    if (isSkill) duration *= 1 + caster.affixes.durationPct;
    // 机制批③ C14 硬控递减（《数值细表真源》§1·旋钮缺省缺席=不递减=逐字节不变）：同源（同施加者）对同目标
    // 在窗口内重复施加硬控 → 最终时长 ×factor^n（n=窗口内已施加次数）；距上次施加超过 windowSec 计数归零。
    // 放在全部时长修正之后=对最终时长打折（§16d 口径）。
    if (HARD_CONTROL_TAGS.includes(tag)) {
      const knob = this.request.hardControlDiminish;
      if (knob && knob.factor > 0 && knob.factor < 1) {
        const m = target.hcDim ?? (target.hcDim = new Map());
        const rec = m.get(caster.unitId);
        const n = rec && this.time - rec.at <= knob.windowSec + 1e-9 ? rec.n : 0;
        if (n > 0) duration *= Math.pow(knob.factor, n);
        m.set(caster.unitId, { n: n + 1, at: this.time });
      }
    }
    // ⑦机制批① M1/M2/M3 框架状态分支（旧 tag 一律走下方原路径=逐字节不变）。
    // 纸面规则（本批钉死·记数值细表机制批①日志章）：同 tag 重复施加=可叠(+1层至上限)+时长刷新，
    // 不可叠(上限1)=只刷新；每层幅度/上限/到期动作以最新一次施加为准；周期态结算节拍从最新施加重新起拍。
    // 机制批③段二 沛5★「覆盖全队时辅助持续翻倍档」：施加增益/护盾且当前全队被本舰覆盖 → 时长再 ×(1+词条)。
    if (caster.affixes.durationPctFullCoverage > 0 && target.side === caster.side
      && BUFF_MOD_TAGS.has(tag) && this.allAlliesCoveredBy(caster)) {
      duration *= 1 + caster.affixes.durationPctFullCoverage;
    }
    if (MOD_STATE_TAGS.has(tag) || PERIODIC_STATE_TAGS.has(tag)) {
      const maxStacks = Math.max(1, Math.floor(effect.stateMaxStacks ?? 1));
      const prev = target.states.get(tag);
      const stacks = prev ? Math.min(maxStacks, (prev.stacks ?? 1) + 1) : 1;
      // 机制批③段二 状态幅度增效消费点（澈「增幅」effectAmp 语义修正落点 + 沛「润泽」覆盖缩放）：
      // 本舰对友军施加的增益态幅度 ×(1+buffAmpPct)×(1+覆盖数×coverageAmpPerAlly)（缺省 0=逐字节不变）。
      let amountPer = effect.stateAmount ?? 0;
      if (target.side === caster.side && BUFF_MOD_TAGS.has(tag)
        && (caster.affixes.buffAmpPct > 0 || caster.affixes.coverageAmpPerAlly > 0)) {
        const cov = caster.affixes.coverageAmpPerAlly > 0 ? this.coverageCountWith(caster, target) : 0;
        amountPer *= (1 + caster.affixes.buffAmpPct) * (1 + cov * caster.affixes.coverageAmpPerAlly);
      }
      const inst: RtStateInst = {
        tag,
        expireAt: this.time + duration,
        amountPerStack: amountPer,
        stacks,
        maxStacks,
        expireAction: effect.stateExpireAction ?? 'clear',
        durationSec: duration,
      };
      inst.sourceUnitId = caster.unitId; // 机制批③段二：覆盖计数/增益转移用元数据（周期态下方仍覆写=同值）
      if (effect.expireEffectRef !== undefined) inst.expireEffectRef = effect.expireEffectRef;
      if (PERIODIC_STATE_TAGS.has(tag)) {
        // M2：结算量=施加瞬间快照（施加者基础攻/目标最大血/固定值三通道相加）——之后攻击变化不追溯。
        inst.tickAmount = (effect.stateTickAtkPct ?? 0) * caster.attack
          + (effect.stateTickMaxHpPct ?? 0) * target.maxHp
          + (effect.stateTickFlat ?? 0);
        const interval = effect.stateTickIntervalSec !== undefined && effect.stateTickIntervalSec > 0
          ? effect.stateTickIntervalSec : 1;
        inst.tickIntervalSec = interval;
        inst.nextTickAt = this.time + interval;
        inst.sourceUnitId = caster.unitId;
        inst.sourceSide = caster.side;
        inst.srcEffectRef = effect.rowId;
      }
      // 机制批③段二 迷雾L100「侵蚀叠满附沉默」：叠到上限的瞬间对同目标追加施放（到顶期间不重复·掉层再满可再触发）。
      if (effect.onMaxStacksApplyRef !== undefined && maxStacks > 1) {
        const wasFullFired = prev !== undefined && (prev.stacks ?? 1) >= maxStacks && prev.onFullFired === true;
        if (stacks >= maxStacks && !wasFullFired) {
          inst.onFullFired = true;
          const row = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', effect.onMaxStacksApplyRef);
          if (row && row.stateTag !== 'none') this.applyState(caster, target, row.stateTag, row.durationSec, row);
        } else if (wasFullFired) {
          inst.onFullFired = true;
        }
      }
      target.states.set(tag, inst);
      this.pushLog('state_apply', {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        stateTag: tag,
        ...(stacks > 1 ? { stacks } : {}), // 仅叠层时带字段：单层施加日志保持既有形状
      });
      // 机制批③段二 澈L100「增益附暴击」/澈3★「主C暴伤+」：本舰对友军施加增益时附带小增益（rider 行自身跳过=防递归）。
      if (caster.affixes.buffRiderCritRate > 0 && target.side === caster.side
        && BUFF_MOD_TAGS.has(tag) && effect !== BUFF_RIDER_CRIT_ROW && tag !== 'crit_rate_up') {
        this.applyState(caster, target, 'crit_rate_up', GACHA_DURATION_SEC,
          { ...BUFF_RIDER_CRIT_ROW, stateAmount: caster.affixes.buffRiderCritRate });
      }
      if (caster.affixes.buffRiderCritDmg > 0 && target.side === caster.side
        && BUFF_MOD_TAGS.has(tag) && tag !== 'crit_rate_up' && tag !== 'crit_dmg_up') {
        this.applyState(caster, target, 'crit_dmg_up', GACHA_DURATION_SEC,
          { ...GACHA_ROW_BASE, rowId: 'eff_pil_che_s3_critdmg', stateTag: 'crit_dmg_up',
            stateAmount: caster.affixes.buffRiderCritDmg, note: '澈3★主C暴伤（引擎内合成行）' });
      }
      return;
    }
    // 同名状态不叠层，只刷新持续时间。⑨M4/M5 可选标记按 tag 附加（旧 tag=纯 {tag,expireAt}=逐字节不变）。
    const simple: RtStateInst = { tag, expireAt: this.time + duration };
    simple.sourceUnitId = caster.unitId; // 机制批③段二：覆盖计数/增益转移用元数据（行为不读则无副作用）
    if (effect.expireEffectRef !== undefined) simple.expireEffectRef = effect.expireEffectRef; // 堡垒要塞结束反击
    if (effect.applyUndispellable) simple.undispellable = true; // ⑨M5 守护铃「守护铃光」不可驱散
    if (tag === 'taunt') simple.tauntedBy = caster.unitId; // ⑨M4 记嘲讽施加者=被嘲讽者强制打它
    if (tag === 'reflect') { // ⑨M4 反弹参数施加瞬间快照（岩反震/岳荆甲/铁壁A/磐石A/砺5★）
      if (effect.reflectPct !== undefined) simple.reflectPct = effect.reflectPct;
      if (effect.reflectAtkPct !== undefined) simple.reflectAtkPct = effect.reflectAtkPct;
      const base = (effect.reflectArmorPct ?? 0) * target.armor;
      if (base !== 0) simple.reflectBase = base;
      if (effect.blockPct !== undefined) simple.blockPct = effect.blockPct;
    }
    if (tag === 'guard') { // ⑨M4 守护替挡（岩·battle_start 上态）；再次施加保留既有冷却进度
      simple.guardProtect = effect.guardProtect ?? 'backline';
      if (effect.guardCooldownSec !== undefined) simple.guardCooldownSec = effect.guardCooldownSec;
      simple.guardReadyAt = target.states.get('guard')?.guardReadyAt ?? 0;
      this.anyGuard = true;
    }
    if (tag === 'share') { // ⑨M4 分摊（援护链=adjacent 互摊 / 山岳SS·沧3★=to_caster 转施加者）
      if (effect.sharePct !== undefined) simple.sharePct = effect.sharePct;
      simple.shareMode = effect.shareMode ?? 'to_caster';
      if (simple.shareMode === 'to_caster') simple.shareTargetId = caster.unitId;
    }
    if (tag === 'aura') { // ⑨M6 光环参数（源持态·消费点动态求和·在场即生效/退场撤销）
      // 机制批③段二b：同单位重复上 aura=保留更强档（幅度优先）——舰侧 L 节点升档触发与行级基础触发
      // 同拍先后不定，保强规则让升档恒胜（单光环单位无比较=零回归）。
      const prevAura = target.states.get('aura');
      if (prevAura && (prevAura.auraAmount ?? 0) > (effect.auraAmount ?? 0)) {
        prevAura.expireAt = this.time + duration; // 只续时不降档
        return;
      }
      simple.auraStat = effect.auraStat;
      if (effect.auraAmount !== undefined) simple.auraAmount = effect.auraAmount;
      simple.auraScope = effect.auraScope;
      simple.auraCondition = effect.auraCondition ?? 'always';
      if (effect.auraScale !== undefined) simple.auraScale = effect.auraScale;
      this.anyAura = true;
    }
    if (tag === 'blind' && effect.blindChance !== undefined) simple.blindChance = effect.blindChance; // ⑨M8 致盲落空概率
    target.states.set(tag, simple);
    this.pushLog('state_apply', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      stateTag: tag,
    });
  }

  // ===== 召唤 =====

  /** 召唤 count 个 summonUnitRef 到 side 阵营空格，受 budget 与空格双重约束；找不到空格就少召，不报错不重试。
   *  ⑥8a 召唤生命周期包（source/effect 可选·全部字段缺省=旧行为）：记录召唤源、限时、随源消亡、同源场上上限。 */
  private summonUnits(
    side: S7AutoBattleSide, summonUnitRef: string, count: number, budget: SummonBudget, note: string,
    source?: RtUnit, effect?: S7BattleEffectParam,
  ): void {
    if (summonUnitRef === 'none') return;
    const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', summonUnitRef);
    if (!stat) return;
    // 同源场上上限（effect.summonSourceCap + 召唤者 summonCapBonus 词条）：仅配置了 cap 才启用。
    const sourceCap = effect?.summonSourceCap;
    const capTotal = sourceCap !== undefined && source
      ? sourceCap + Math.floor(source.affixes.summonCapBonus)
      : Infinity;
    let aliveFromSource = 0;
    if (capTotal !== Infinity && source) {
      for (const u of this.units) if (u.alive && u.summonedBy === source.unitId) aliveFromSource += 1;
    }
    const summonMeta: SummonMeta = {
      sourceId: source ? source.unitId : null,
      expireSec: effect?.summonExpireSec,
      despawnWithSource: effect?.despawnWithSource === true,
      // 机制批③ 全息镜（copyCasterStatsPct）：分身三围=施法者当时快照×系数（普攻/攻速/射程/选目标同施法者·
      // 不继承词条/技能/星核）；缺省缺席=用召唤行自身三围（星鲸口径·逐字节不变）。
      copyFrom: effect?.copyCasterStatsPct !== undefined && effect.copyCasterStatsPct > 0 && source ? {
        maxHp: Math.max(1, Math.round(source.maxHp * effect.copyCasterStatsPct)),
        attack: Math.max(1, Math.round(source.attack * effect.copyCasterStatsPct)),
        armor: Math.round(source.armor * effect.copyCasterStatsPct),
        attackIntervalSec: source.attackIntervalSec,
        attackRangeCells: source.attackRangeCells,
        normalEffectRef: source.normalEffectRef,
        targetingTag: source.targetingTag,
      } : undefined,
      // 机制批③段二 召唤物属性继承（巡 L20/L80 攻+·L100 血+）+召唤覆写（巡能力打后排/哨卫L60 嘲讽诱饵/巡3★溅射弹）：
      // 全部来自召唤源词条/覆写快照（缺省 0/undefined=零回归）。
      statScale: source && (source.affixes.summonAtkPct > 0 || source.affixes.summonHpPct > 0)
        ? { atkPct: source.affixes.summonAtkPct, hpPct: source.affixes.summonHpPct }
        : undefined,
      override: source?.summonOverride,
    };
    const created: RtUnit[] = [];
    for (let i = 0; i < count; i += 1) {
      if (budget.remaining <= 0) break;
      if (aliveFromSource + created.length >= capTotal) break; // ⑥8a：同源上限到顶少召（同"满场少召"语义）
      const cell = this.findEmptyCell(side, stat.sizeRows, stat.sizeCols);
      if (!cell) break; // 满场少召，不无限重试
      const slot = side === 'player' ? `p${cell.row}c${cell.col}` : `r${cell.row}c${cell.col}`;
      created.push(this.spawnUnit(stat, side, cell.row, cell.col, slot, null, summonMeta));
      budget.remaining -= 1;
    }
    if (created.length > 0) {
      this.pushLog('spawn_wave', { side, targetIds: created.map((u) => u.unitId), note });
    }
  }

  // ===== 目标选择 =====

  private selectTargets(caster: RtUnit, tag: string, maxTargets: number, rangeLimit?: number): RtUnit[] {
    const targetSide: S7AutoBattleSide = FRIENDLY_TAGS.has(tag) ? caster.side : opposite(caster.side);
    let candidates = this.units.filter((u) => u.side === targetSide && u.alive && u.hp > 0);
    if (rangeLimit !== undefined) {
      candidates = candidates.filter((u) => this.dist(caster, u) <= rangeLimit);
    }
    if (candidates.length === 0) return [];
    // ⑨机制批② M4 嘲讽：攻击性选目标（打对方阵营）时，被嘲讽单位强制以嘲讽者为首目标（嘲讽者在候选=存活/在射程内）。
    // 覆盖一切 tag（含 backline_first/column_line=n102 点名塔被拉回打前排坦克的解）；无 taunt 态=不进此分支=逐字节不变。
    if (targetSide !== caster.side) {
      const forced = this.resolveTaunt(caster, candidates);
      if (forced) {
        const rest = sortBy(candidates.filter((u) => u !== forced), (u) => [this.dist(caster, u), u.unitId]);
        return [forced, ...rest].slice(0, maxTargets);
      }
    }

    switch (tag) {
      case 'self_team':
        return this.orderSelfTeam(caster, candidates, maxTargets);
      case 'lowest_hp_ally':
        return sortBy(candidates, (u) => [u.hp, u.unitId]).slice(0, maxTargets);
      case 'backline_first':
        return this.orderBackline(caster, targetSide, candidates, maxTargets);
      case 'column_line':
        return this.orderColumnLine(caster, candidates, maxTargets);
      case 'marked_first':
        return sortBy(candidates, (u) => [u.states.has('mark') ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'all_enemies':
        return sortBy(candidates, (u) => [this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      // ===== ⑥8a 驾驶员能力目标族（纯排序新枚举·旧配置不引用=行为不变）=====
      case 'lowest_hp_enemy': // 炎：集火血量最少
        return sortBy(candidates, (u) => [u.hp, u.unitId]).slice(0, maxTargets);
      case 'highest_hp_enemy': // 烬：打最肥
        return sortBy(candidates, (u) => [-u.hp, u.unitId]).slice(0, maxTargets);
      case 'highest_attack_enemy': // 翎：掐最高攻
        return sortBy(candidates, (u) => [-u.attack, u.unitId]).slice(0, maxTargets);
      case 'highest_armor_enemy': // 藏：啃最高防
        return sortBy(candidates, (u) => [-u.armor, u.unitId]).slice(0, maxTargets);
      case 'key_unit_first': // 蛰/空：治疗/召唤源优先（按属性行 roleTag 判）
        return sortBy(candidates, (u) => [KEY_ROLE_TAGS.has(u.roleTag) ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'lowhp_then_nearest': // 燎：残血(<30%)优先补刀，无残血打最前
        return sortBy(candidates, (u) => [u.maxHp > 0 && u.hp / u.maxHp < LOWHP_THRESHOLD ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'debuffed_first': // 蔽：已被控/带减益的优先
        return sortBy(candidates, (u) => [DEBUFF_TAGS.some((d) => u.states.has(d)) ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'backline_attacker_first': // 机制批③段二 岳：优先打"窗口内攻击过我方后排"的敌人（事件知识目标·无嫌犯=最近）
        return sortBy(candidates, (u) => [
          u.lastHitBacklineAt !== undefined && this.time - u.lastHitBacklineAt <= BACKLINE_ATTACKER_WINDOW_SEC + 1e-9 ? 0 : 1,
          this.dist(caster, u), u.unitId,
        ]).slice(0, maxTargets);
      case 'first_column_first': // 骁：严格头排（敌侧 col 越小越靠前）
        return sortBy(candidates, (u) => [u.col, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'lock_until_dead': { // 源：锁定一个打到死再换（锁存于本单位·死后换最近）
        let locked = candidates.find((u) => u.unitId === caster.lockedTargetId);
        if (!locked) {
          locked = this.pickNearest(caster, candidates, 1)[0];
          caster.lockedTargetId = locked ? locked.unitId : null;
        }
        if (!locked) return [];
        const rest = sortBy(candidates.filter((u) => u !== locked), (u) => [this.dist(caster, u), u.unitId]);
        return [locked, ...rest].slice(0, maxTargets);
      }
      case 'cross_area': // ⑥8a 空间AoE：主目标+十字4格（小范围）
        return this.orderArea(caster, candidates, maxTargets, 'cross');
      case 'block_area': // ⑥8a 空间AoE：主目标+3×3（一片）
        return this.orderArea(caster, candidates, maxTargets, 'block');
      // ===== ⑦机制批① 友方目标族（8a 如实交回件·随机制批补齐）=====
      case 'highest_attack_ally': // 澈：增益喂输出最高的友军
        return sortBy(candidates, (u) => [-u.attack, u.unitId]).slice(0, maxTargets);
      case 'no_buff_ally_first': // 沛：还没增益/护盾的友军优先
        return sortBy(candidates, (u) => [BUFF_TAGS.some((b) => u.states.has(b)) ? 1 : 0, u.unitId]).slice(0, maxTargets);
      case 'most_debuffed_ally': // 霖：身上减益最多的友军优先
        return sortBy(candidates, (u) => [-DEBUFF_TAGS.filter((d) => u.states.has(d)).length, u.unitId]).slice(0, maxTargets);
      case 'controlled_ally_first': // 沧（8a 简化口径）：被控/带减益友军优先，其次血少者
        return sortBy(candidates, (u) => [
          this.hasControl(u) || DEBUFF_TAGS.some((d) => u.states.has(d)) ? 0 : 1, u.hp, u.unitId,
        ]).slice(0, maxTargets);
      // ===== ⑦机制批① 自身区域族（磐石「张盾」自己+相邻4格 / 船长「鼓动」周围）=====
      case 'self_cross_area':
        return this.orderSelfArea(caster, candidates, maxTargets, 'cross');
      case 'self_block_area':
        return this.orderSelfArea(caster, candidates, maxTargets, 'block');
      case 'single_target':
      case 'nearest_random_tie':
      default:
        return this.pickNearest(caster, candidates, maxTargets);
    }
  }

  /** ⑨机制批② M4 嘲讽解析：本单位持 taunt 态且嘲讽者仍在候选（存活/在射程/对方阵营）内 → 返回嘲讽者，否则 null（嘲讽自然失效走常规选目标）。 */
  private resolveTaunt(caster: RtUnit, candidates: RtUnit[]): RtUnit | null {
    const ts = caster.states.get('taunt');
    if (!ts || ts.tauntedBy === undefined) return null;
    return candidates.find((u) => u.unitId === ts.tauntedBy) ?? null;
  }

  /** ⑨机制批② M4 守护替挡：敌方伤害命中我方某友军时，若存在"就绪+保护该友军"的守护者(岩)→伤害转守护者并进其 CD；否则原目标。
   *  缺省本场无 guard 态（anyGuard=false）=整段跳过=逐字节不变。 */
  private resolveGuard(attacker: RtUnit, target: RtUnit): RtUnit {
    if (!this.anyGuard || target.side === attacker.side) return target; // 只拦敌打我方
    for (const g of this.units) {
      if (g === target || g.side !== target.side || !g.alive) continue;
      const gs = g.states.get('guard');
      if (!gs || (gs.guardReadyAt ?? 0) > this.time + 1e-9) continue; // 无守护态 / 冷却中
      const protects = gs.guardProtect === 'all' || this.isMoreBackline(target, g); // backline=被护者比守护者更靠后
      if (!protects) continue;
      // 机制批③段二 岩5★「守护双目标」：每个冷却窗替挡次数=1+guardExtraCharges（缺省 0=单次=旧行为逐动作一致）。
      gs.guardChargesLeft = gs.guardChargesLeft ?? (1 + Math.max(0, Math.floor(g.affixes.guardExtraCharges)));
      gs.guardChargesLeft -= 1;
      if (gs.guardChargesLeft <= 0) {
        gs.guardReadyAt = this.time + (gs.guardCooldownSec ?? 0); // 次数用尽才进替挡冷却
        gs.guardChargesLeft = undefined;
      }
      // 机制批③段二 岩3★「守护触发自减伤」：替挡瞬间给自己短暂减伤（缺省词条 0=零行为）。
      if (g.affixes.guardSelfDmgDownPct > 0) {
        this.applyState(g, g, 'dmg_taken_down', GUARD_SELF_BUFF_ROW.durationSec,
          { ...GUARD_SELF_BUFF_ROW, stateAmount: g.affixes.guardSelfDmgDownPct });
      }
      return g;
    }
    return target;
  }

  /** a 是否比 b 更靠后排（同阵营·玩家列越小越靠后 / 敌方列越大越靠后）。 */
  private isMoreBackline(a: RtUnit, b: RtUnit): boolean {
    return a.side === 'player' ? a.col < b.col : a.col > b.col;
  }

  /** ⑨机制批② M4 分摊·承接者解析：to_caster→施加者(存活/同阵营/非受方)；adjacent→相邻(3×3锚点)且同持 adjacent share 态的友军（援护链互摊网络）。 */
  private resolveShareSharers(receiver: RtUnit, shareInst: RtStateInst): RtUnit[] {
    if (shareInst.shareMode === 'to_caster') {
      const t = this.units.find((u) => u.unitId === shareInst.shareTargetId
        && u.alive && u.side === receiver.side && u !== receiver);
      return t ? [t] : [];
    }
    return this.units.filter((u) => u.side === receiver.side && u.alive && u !== receiver
      && this.isAdjacentCell(receiver, u) && u.states.get('share')?.shareMode === 'adjacent');
  }

  /** 锚点格 3×3 相邻（切比雪夫距 ≤1·不含自身）。 */
  private isAdjacentCell(a: RtUnit, b: RtUnit): boolean {
    return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
  }

  /** ⑨机制批② M4 分摊·把 shareTotal 均分给承接者（余数给前者）直扣不过甲；承接者死亡归攻击者(伤害源·镜像直伤击杀记账)。 */
  private distributeShare(sharers: RtUnit[], shareTotal: number, attacker: RtUnit): void {
    const n = sharers.length;
    if (n === 0 || shareTotal <= 0) return;
    const base = Math.floor(shareTotal / n);
    let rem = shareTotal - base * n;
    for (const s of sharers) {
      const amt = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      if (amt <= 0) continue;
      s.hp -= amt;
      const dead = s.hp <= 0;
      if (dead) { s.hp = 0; s.alive = false; }
      this.pushLog('damage', {
        actorId: attacker.unitId, side: attacker.side, targetIds: [s.unitId],
        effectRef: 'share', amount: amt, note: 'share', hpAfter: s.hp, shieldAfter: s.shield,
      });
      if (dead) {
        attacker.killedSinceTrigger = true;
        attacker.killedRolesSinceTrigger.push(s.roleTag);
        this.deadCount[s.side] += 1;
        this.accrueStackEvent(attacker, 'kill');
        this.accrueChargeKills(attacker); // 机制批③：分摊致死同样攒层
      }
    }
  }

  /** ⑥8a 空间AoE：主目标=最近规则选 1，随后收其锚点格周围（十字4格/3×3）footprint 相交的单位。
   *  多格单位以锚点格为区域中心（v0 口径·记数值细表）；区域内按曼哈顿距主目标近→远、unitId 稳定排序。 */
  private orderArea(caster: RtUnit, candidates: RtUnit[], maxTargets: number, kind: 'cross' | 'block'): RtUnit[] {
    const primary = this.pickNearest(caster, candidates, 1)[0];
    if (!primary) return [];
    const pr = primary.row;
    const pc = primary.col;
    const cells: Array<[number, number]> = kind === 'cross'
      ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]]
      : [
        [pr - 1, pc - 1], [pr - 1, pc], [pr - 1, pc + 1],
        [pr, pc - 1], [pr, pc], [pr, pc + 1],
        [pr + 1, pc - 1], [pr + 1, pc], [pr + 1, pc + 1],
      ];
    const inArea = (u: RtUnit): boolean => {
      for (const [r, c] of cells) {
        if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
      }
      return false;
    };
    const others = sortBy(
      candidates.filter((u) => u !== primary && inArea(u)),
      (u) => [Math.abs(u.row - pr) + Math.abs(u.col - pc), u.unitId],
    );
    return [primary, ...others].slice(0, maxTargets);
  }

  /** ⑦机制批① 自身区域：以施加者锚点格为中心（十字4格/3×3），收 footprint 相交的己方单位；
   *  施加者永远第一位，其余按曼哈顿距中心近→远、unitId 稳定排序（与 orderArea 同口径）。 */
  private orderSelfArea(caster: RtUnit, candidates: RtUnit[], maxTargets: number, kind: 'cross' | 'block'): RtUnit[] {
    const pr = caster.row;
    const pc = caster.col;
    const cells: Array<[number, number]> = kind === 'cross'
      ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]]
      : [
        [pr - 1, pc - 1], [pr - 1, pc], [pr - 1, pc + 1],
        [pr, pc - 1], [pr, pc], [pr, pc + 1],
        [pr + 1, pc - 1], [pr + 1, pc], [pr + 1, pc + 1],
      ];
    const inArea = (u: RtUnit): boolean => {
      for (const [r, c] of cells) {
        if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
      }
      return false;
    };
    const others = sortBy(
      candidates.filter((u) => u !== caster && inArea(u)),
      (u) => [Math.abs(u.row - pr) + Math.abs(u.col - pc), u.unitId],
    );
    const ordered = candidates.includes(caster) ? [caster, ...others] : others;
    return ordered.slice(0, maxTargets);
  }

  /** 最近目标；同距离时标记优先，仍并列则用 seeded RNG 取一个。逐个选满 maxTargets。 */
  private pickNearest(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    const pool = [...candidates];
    const selected: RtUnit[] = [];
    while (selected.length < maxTargets && pool.length > 0) {
      let minD = Infinity;
      for (const u of pool) minD = Math.min(minD, this.dist(caster, u));
      let tie = pool.filter((u) => this.dist(caster, u) === minD);
      const marked = tie.filter((u) => u.states.has('mark'));
      if (marked.length > 0) tie = marked;
      tie = sortBy(tie, (u) => [u.unitId]); // 稳定排序，保证 RNG 取样可复现
      const chosen = tie.length === 1 ? tie[0] : (this.rng.pick(tie) as RtUnit);
      selected.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }
    return selected;
  }

  private orderSelfTeam(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 自身优先，其余按 unitId 稳定排序。
    const others = sortBy(candidates.filter((u) => u !== caster), (u) => [u.unitId]);
    const ordered = candidates.includes(caster) ? [caster, ...others] : others;
    return ordered.slice(0, maxTargets);
  }

  private orderBackline(caster: RtUnit, targetSide: S7AutoBattleSide, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 敌方后排=高列，玩家后排=低列。backlineRank 越小越靠后排。
    const rank = (u: RtUnit): number => (targetSide === 'enemy' ? (ENEMY_COLS - 1 - u.col) : u.col);
    return sortBy(candidates, (u) => [rank(u), this.dist(caster, u), u.unitId]).slice(0, maxTargets);
  }

  private orderColumnLine(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 先锁定最近目标所在列，命中该列全部；列内不足再按近到远补。
    const nearest = this.pickNearest(caster, candidates, 1)[0];
    if (!nearest) return [];
    const targetCol = nearest.col;
    const inColumn = sortBy(
      candidates.filter((u) => occupiesColumn(u, targetCol)),
      (u) => [u.row, u.unitId],
    );
    const selected: RtUnit[] = [];
    const seen = new Set<RtUnit>();
    for (const u of inColumn) {
      if (selected.length >= maxTargets) break;
      selected.push(u);
      seen.add(u);
    }
    if (selected.length < maxTargets) {
      const rest = sortBy(candidates.filter((u) => !seen.has(u)), (u) => [this.dist(caster, u), u.unitId]);
      for (const u of rest) {
        if (selected.length >= maxTargets) break;
        selected.push(u);
      }
    }
    return selected;
  }

  // ===== 距离 =====

  /** caster 与 target 的格距（玩家格 vs 敌方格）。玩家列越大越靠前，敌方列越小越靠前。 */
  private dist(caster: RtUnit, target: RtUnit): number {
    const playerUnit = caster.side === 'player' ? caster : target;
    const enemyUnit = caster.side === 'player' ? target : caster;
    let best = Infinity;
    for (let pr = playerUnit.row; pr < playerUnit.row + playerUnit.sizeRows; pr += 1) {
      for (let pc = playerUnit.col; pc < playerUnit.col + playerUnit.sizeCols; pc += 1) {
        for (let er = enemyUnit.row; er < enemyUnit.row + enemyUnit.sizeRows; er += 1) {
          for (let ec = enemyUnit.col; ec < enemyUnit.col + enemyUnit.sizeCols; ec += 1) {
            const d = ec + 1 + (2 - pc) + Math.abs(pr - er);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }

  // ===== 单位 / 占格 =====

  private spawnUnit(
    stat: S7BattleUnitStatParam, side: S7AutoBattleSide, row: number, col: number, slotRef: string,
    derived: S7DerivedUnit | null = null,
    summonMeta?: SummonMeta,
  ): RtUnit {
    const cv = derived ?? stat; // 战斗数值：有装配结果用装配后的，否则用基线 stat（无装配时零行为变化）。
    const cf = summonMeta?.copyFrom; // 机制批③ 全息镜：分身三围快照覆盖（缺省 undefined=零行为变化）
    // 机制批③段二 召唤继承/覆写（缺省 undefined=零行为变化）：属性放大与目标/普攻变体。
    const ss = summonMeta?.statScale;
    const so = summonMeta?.override;
    const unitId = side === 'player' ? `player_${slotRef}` : `enemy_${pad4(this.enemySeq++)}`;
    const triggers: RtTrigger[] = [];
    // 机制批③ 蓄力攒层（群蜂「饱和打击」）：单位行带 ultimateChargeKills>0 → 大招改"击杀攒层满放"模型（替代 CD 触发）；
    // 缺省缺席=下方 CD 触发原路径=逐字节不变。
    if (cv.ultimateEffectRef !== 'none' && (stat.ultimateChargeKills ?? 0) > 0) {
      triggers.push({
        block: { kind: 'trigger', on: 'on_kill_charge', threshold: stat.ultimateChargeKills, effectRef: cv.ultimateEffectRef },
        nextFireAt: 0, fired: false, charge: 0,
      });
    } else if (cv.ultimateEffectRef !== 'none' && stat.ultimateCdSec > 0) {
      // 星舰自带大招 → 默认 CD 触发（开局即放：nextFireAt=0）。无大招(none) 或 CD<=0 不补。
      triggers.push({ block: { kind: 'trigger', on: 'cd', cdSec: stat.ultimateCdSec, effectRef: cv.ultimateEffectRef }, nextFireAt: 0, fired: false });
    }
    // 装配层提供的额外触发（驾驶员/插件/星核内容，块3/4/5）。⑥8a：cd 型吃 initialCdSec（缺省 0=开局即放不变）。
    if (derived) {
      for (const tb of derived.triggers) {
        triggers.push({ block: tb, nextFireAt: tb.on === 'cd' ? (tb.initialCdSec ?? 0) : 0, fired: false });
      }
    }
    // ⑦机制批①：单位行额外触发（敌方事件触发通道·污染体"受击喷毒"；缺省缺席=零行为）。
    if (stat.extraTriggerBlocks && stat.extraTriggerBlocks.length > 0) {
      for (const tb of stat.extraTriggerBlocks) {
        triggers.push({ block: tb, nextFireAt: tb.on === 'cd' ? (tb.initialCdSec ?? 0) : 0, fired: false });
      }
    }
    // ⑦机制批① M3：叠层规则（装配 stack 积木 + 单位行 stackRules；全部旧配置两处皆空=空数组零行为）。
    const stackRules: RtStackRule[] = [];
    for (const rule of [...(derived?.stackRules ?? []), ...(stat.stackRules ?? [])]) {
      stackRules.push({
        rule,
        stacks: 0,
        nextAccrueAt: rule.on === 'per_second' ? this.time + 1 : Infinity,
        lastEventAt: this.time,
        trackedTargetId: null,
      });
    }
    // ⑥8a：敌/Boss 属性行的基线词条可选字段（controlResist/baseCritRate/baseCritDmg）——
    // 无装配时注入；字段全缺省则沿用冻结共享 ZERO_AFFIXES（零新对象·零行为变化）。
    let affixes: Readonly<Record<S7AffixKey, number>> = derived ? derived.affixes : ZERO_AFFIXES;
    if (!derived && ((stat.controlResist ?? 0) !== 0 || (stat.baseCritRate ?? 0) !== 0 || (stat.baseCritDmg ?? 0) !== 0)) {
      affixes = Object.freeze({
        ...ZERO_AFFIXES,
        controlResist: stat.controlResist ?? 0,
        critRate: stat.baseCritRate ?? 0,
        critDmg: stat.baseCritDmg ?? 0,
      });
    }
    const unit: RtUnit = {
      unitId,
      side,
      unitStatRef: stat.rowId,
      slotRef,
      row,
      col,
      sizeRows: cv.sizeRows,
      sizeCols: cv.sizeCols,
      maxHp: Math.round((cf ? cf.maxHp : cv.maxHp) * (ss ? 1 + ss.hpPct : 1)),
      hp: Math.round((cf ? cf.maxHp : cv.maxHp) * (ss ? 1 + ss.hpPct : 1)),
      attack: Math.round((cf ? cf.attack : cv.attack) * (ss ? 1 + ss.atkPct : 1)),
      baseAttack: Math.round((cf ? cf.attack : cv.attack) * (ss ? 1 + ss.atkPct : 1)), // ⑨M9 贪吃星累积基数
      armor: cf ? cf.armor : cv.armor,
      attackIntervalSec: cf ? cf.attackIntervalSec : cv.attackIntervalSec,
      attackRangeCells: cf ? cf.attackRangeCells : cv.attackRangeCells,
      passiveEnergyPerSec: cv.passiveEnergyPerSec,
      nextAttackAt: 0,
      alive: true,
      downLogged: false,
      isBoss: stat.targetType === 'boss',
      bossNodeId: stat.targetType === 'boss' ? stat.unitRef : null,
      normalEffectRef: so?.normalEffectRef ?? (cf ? cf.normalEffectRef : cv.normalEffectRef),
      ultimateEffectRef: cv.ultimateEffectRef,
      coreEffectRef: cv.coreEffectRef,
      targetingTag: so?.targetingTag ?? (cf ? cf.targetingTag : cv.targetingTag),
      coreTriggered: false,
      triggers,
      hitSinceTrigger: false,
      killedSinceTrigger: false,
      shieldBrokenSinceTrigger: false,
      attackLandedSinceTrigger: false,
      killedRolesSinceTrigger: [],
      skillCastSinceTrigger: false,
      stackRules,
      shield: 0,
      states: new Map(),
      affixes,
      roleTag: stat.roleTag,
      lockedTargetId: null,
      summonedBy: summonMeta ? summonMeta.sourceId : null,
      summonExpireAt: summonMeta && summonMeta.expireSec !== undefined && summonMeta.expireSec > 0
        ? this.time + summonMeta.expireSec
        : null,
      despawnWithSource: summonMeta ? summonMeta.despawnWithSource : false,
      splitShotCount: 0, // 机制批③ 计数复释：普攻出手计数（残影）
    };
    // 机制批③段二 冷却传奇「开局首技 CD 减半」：只压带首发延迟（initialCd>0）的触发（开局即放型天然满足=语义注）。
    if (unit.affixes.firstSkillCdHalf > 0) {
      for (const t of triggers) {
        if (t.block.on === 'cd' && t.nextFireAt > 0) t.nextFireAt = roundTime(t.nextFireAt / 2);
      }
    }
    // 机制批③段二 召唤覆写快照（本舰未来召唤物消费·derived 无则缺省 undefined=零行为）。
    if (derived?.summonOverride) unit.summonOverride = derived.summonOverride;
    // 机制批③段二 存在门旗（缺省词条 0=旗保持 false=各扫描整段跳过）。
    if (unit.affixes.debuffedTakenAmpTeam > 0) this.anyCloak = true;
    if (unit.affixes.teamCritVsDebuffed > 0) this.anyTeamCrit = true;
    if (unit.affixes.saveAllyLethalOnce > 0) this.anyLethalSave = true;
    if (unit.affixes.shareForControlledPct > 0) this.anyShareGuard = true;
    if (unit.affixes.buffTransferOnDeath > 0) this.anyBuffTransfer = true;
    if (unit.targetingTag === 'backline_attacker_first') this.anyEventKnowledge = true;
    this.occupy(unit);
    this.units.push(unit);
    return unit;
  }

  private canPlace(side: S7AutoBattleSide, row: number, col: number, sizeRows: number, sizeCols: number): boolean {
    const rows = side === 'player' ? PLAYER_ROWS : ENEMY_ROWS;
    const cols = side === 'player' ? PLAYER_COLS : ENEMY_COLS;
    const occ = side === 'player' ? this.playerCells : this.enemyCells;
    if (row < 0 || col < 0 || row + sizeRows > rows || col + sizeCols > cols) return false;
    for (let r = row; r < row + sizeRows; r += 1) {
      for (let c = col; c < col + sizeCols; c += 1) {
        if (occ.has(cellKey(r, c))) return false;
      }
    }
    return true;
  }

  private findEmptyCell(side: S7AutoBattleSide, sizeRows: number, sizeCols: number): { row: number; col: number } | null {
    const rows = side === 'player' ? PLAYER_ROWS : ENEMY_ROWS;
    const cols = side === 'player' ? PLAYER_COLS : ENEMY_COLS;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (this.canPlace(side, r, c, sizeRows, sizeCols)) return { row: r, col: c };
      }
    }
    return null;
  }

  private occupy(unit: RtUnit): void {
    const occ = unit.side === 'player' ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.add(cellKey(r, c));
    }
  }

  private freeCells(unit: RtUnit): void {
    const occ = unit.side === 'player' ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.delete(cellKey(r, c));
    }
  }

  private countAliveEnemies(): number {
    let n = 0;
    for (const u of this.units) if (u.side === 'enemy' && u.alive) n += 1;
    return n;
  }

  /** 机制批③段二：某阵营存活单位数（群蜂「弹巢」条件门用·敌我通用）。 */
  private countAliveOf(side: S7AutoBattleSide): number {
    let n = 0;
    for (const u of this.units) if (u.side === side && u.alive) n += 1;
    return n;
  }

  // ===== 小工具 =====

  private canAct(unit: RtUnit): boolean {
    return unit.alive && unit.hp > 0 && !this.hasControl(unit);
  }

  private hasControl(unit: RtUnit): boolean {
    for (const tag of CONTROL_TAGS) if (unit.states.has(tag)) return true;
    return false;
  }

  /** ⑦机制批①：读取一个 M1 框架状态的当前总幅度（每层幅度×层数）；无该状态或旧 tag 未带参数=0。 */
  private stateModSum(unit: RtUnit, tag: S7BattleStateTag): number {
    const st = unit.states.get(tag);
    if (!st || st.amountPerStack === undefined) return 0;
    return st.amountPerStack * (st.stacks ?? 1);
  }

  /** ⑦M3：一条叠层规则的即时层数（hp_lost_decile=按已损血量每 10% 一层派生·动态涨落；其余=事件累积值）。 */
  private ruleStacksOf(unit: RtUnit, r: RtStackRule): number {
    if (r.rule.on === 'hp_lost_decile') {
      if (unit.maxHp <= 0) return 0;
      const derived = Math.floor((1 - unit.hp / unit.maxHp) * 10 + 1e-9);
      return Math.max(0, Math.min(r.rule.maxStacks ?? Infinity, derived));
    }
    return r.stacks;
  }

  /** ⑦M3：单位在某数值轴上的叠层规则总幅度（Σ 层数×每层幅度）；无规则单位=空循环和 0（行为不变）。 */
  private ruleStatSum(unit: RtUnit, stat: S7StackRuleParam['stat']): number {
    let sum = 0;
    for (const r of unit.stackRules) {
      if (r.rule.stat !== stat) continue;
      if (r.rule.breakOn === 'target_switch') this.syncTrackedTarget(unit, r);
      sum += this.ruleStacksOf(unit, r) * r.rule.perStack;
    }
    return sum;
  }

  /** ⑦M3：target_switch 断档——锁定目标变更时按断档动作处理层数（源「专注」=清空）。 */
  private syncTrackedTarget(unit: RtUnit, r: RtStackRule): void {
    if (r.trackedTargetId === unit.lockedTargetId) return;
    r.stacks = r.rule.breakAction === 'decay_1' ? Math.max(0, r.stacks - 1) : 0;
    r.trackedTargetId = unit.lockedTargetId;
  }

  /** 机制批③ 蓄力攒层（群蜂「饱和打击」）：击杀点直接累积（含大招自身/DoT/反弹/分摊/子结算击杀·多杀逐个计）；
   *  无 on_kill_charge 触发的单位=空循环零行为。释放判定在 stepTriggers（沉默挡释放不挡累积）。 */
  private accrueChargeKills(unit: RtUnit): void {
    for (const t of unit.triggers) {
      if (t.block.on === 'on_kill_charge') t.charge = (t.charge ?? 0) + 1;
    }
  }

  /** ⑦M3：事件累积（伤害结算/触发处直接调·即时生效于下一次结算读取；无规则单位零循环）。
   *  机制批③段二：+叠满触发钩（onFullEffectRef·炎3★致命一击/铁壁S坚甲回血）——层数攒到 maxStacks 的
   *  瞬间释放效果（onFullScope=target 以 ctx 为锚/self 对自己）；onFullReset 缺省 true=触发后清零重攒。 */
  private accrueStackEvent(unit: RtUnit, event: 'attack_landed' | 'was_hit' | 'was_hit_by_skill' | 'kill', ctx?: RtUnit): void {
    for (const r of unit.stackRules) {
      if (r.rule.on !== event) continue;
      if (r.rule.breakOn === 'target_switch') this.syncTrackedTarget(unit, r);
      const before = r.stacks;
      r.stacks = Math.min(r.rule.maxStacks ?? Infinity, r.stacks + 1);
      r.lastEventAt = this.time;
      if (r.rule.onFullEffectRef !== undefined && r.rule.maxStacks !== undefined
        && before < r.rule.maxStacks && r.stacks >= r.rule.maxStacks
        && (r.rule.onFullMaxFires === undefined || (r.onFullFires ?? 0) < r.rule.onFullMaxFires)) {
        r.onFullFires = (r.onFullFires ?? 0) + 1;
        const eff = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', r.rule.onFullEffectRef);
        if (eff) {
          const anchor = r.rule.onFullScope === 'target' ? (ctx ?? unit) : unit;
          this.castAnchoredEffect(unit, eff, anchor);
        }
        if (r.rule.onFullReset !== false) r.stacks = 0;
      }
    }
  }

  /** 机制批③段二 叠满触发的锚定释放：伤害行（含 maxHpPctDamage 比例伤）以锚为首目标、区域行以锚点格扩十字/3×3；
   *  治疗/状态行按行自身 targetingTag 常规选目标（self_team 等）。 */
  private castAnchoredEffect(caster: RtUnit, effect: S7BattleEffectParam, anchor: RtUnit): void {
    if (DAMAGE_TYPES.has(effect.effectType) && anchor.side !== caster.side) {
      let targets: RtUnit[] = [anchor];
      if (effect.targetingTag === 'cross_area' || effect.targetingTag === 'block_area') {
        const kind = effect.targetingTag === 'cross_area' ? 'cross' : 'block';
        const candidates = this.units.filter((u) => u.side === anchor.side && u.alive && u.hp > 0);
        targets = this.orderAreaAround(anchor, candidates, effect.maxTargets, kind);
      }
      this.pushLog('ultimate_cast', {
        actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType,
        targetIds: targets.map((t) => t.unitId), note: 'on_full',
      });
      this.applyEffectToTargets(caster, effect, targets);
      return;
    }
    this.castLogged(caster, effect, 'ultimate_cast');
  }

  /** 以指定单位为区域中心的收集（叠满触发/延迟爆点共用·与 orderArea 同口径但主目标外部钦定）。 */
  private orderAreaAround(primary: RtUnit, candidates: RtUnit[], maxTargets: number, kind: 'cross' | 'block'): RtUnit[] {
    const pr = primary.row;
    const pc = primary.col;
    const cells: Array<[number, number]> = kind === 'cross'
      ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]]
      : [
        [pr - 1, pc - 1], [pr - 1, pc], [pr - 1, pc + 1],
        [pr, pc - 1], [pr, pc], [pr, pc + 1],
        [pr + 1, pc - 1], [pr + 1, pc], [pr + 1, pc + 1],
      ];
    const inArea = (u: RtUnit): boolean => {
      for (const [r, c] of cells) {
        if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
      }
      return false;
    };
    const others = sortBy(
      candidates.filter((u) => u !== primary && inArea(u)),
      (u) => [Math.abs(u.row - pr) + Math.abs(u.col - pc), u.unitId],
    );
    return [primary, ...others].slice(0, Math.max(1, maxTargets));
  }

  /** ⑨机制批② M6：unit 从所有存活光环源收到的某轴总幅度（在场即生效·退场撤销·动态重算）；无光环=0（anyAura 门=行为不变）。 */
  private auraSum(unit: RtUnit, stat: 'dmgTakenDownPct' | 'atkSpeedPct' | 'skillHastePct'): number {
    if (!this.anyAura) return 0;
    let sum = 0;
    for (const src of this.units) {
      if (!src.alive) continue;
      const a = src.states.get('aura');
      if (!a || a.auraStat !== stat) continue;
      if (!this.auraInScope(src, unit, a.auraScope)) continue;
      if (!this.auraConditionMet(src, a)) continue;
      let amt = a.auraAmount ?? 0;
      if (a.auraScale === 'per_lowhp_ally') amt *= this.lowhpAllyCount(src);
      sum += amt;
    }
    return sum;
  }

  /** 光环范围判定：self=仅源自身 / team=同阵营全体 / cross=源自己+十字4格 / block=源自己+3×3。 */
  private auraInScope(src: RtUnit, unit: RtUnit, scope?: 'self' | 'team' | 'cross' | 'block'): boolean {
    const s = scope ?? 'team';
    if (s === 'self') return unit === src;
    if (unit.side !== src.side) return false;
    if (s === 'team') return true;
    if (unit === src) return true;
    const dr = Math.abs(unit.row - src.row);
    const dc = Math.abs(unit.col - src.col);
    return s === 'cross' ? (dr + dc) === 1 : (dr <= 1 && dc <= 1); // cross=十字相邻 / block=3×3
  }

  /** 光环条件门：always / has_summon（本源有存活召唤物·哨卫联防）/ no_enemy_summon（无敌方召唤物存活·空5★）。 */
  private auraConditionMet(src: RtUnit, a: RtStateInst): boolean {
    if (a.auraCondition === 'has_summon') return this.units.some((u) => u.alive && u.summonedBy === src.unitId);
    if (a.auraCondition === 'no_enemy_summon') return !this.units.some((u) => u.alive && u.side !== src.side && u.summonedBy !== null);
    return true;
  }

  /** 残血友军数（同阵营存活·血<30%·不含自身·沧坚壁 per_lowhp_ally 缩放用）。 */
  private lowhpAllyCount(src: RtUnit): number {
    let n = 0;
    for (const u of this.units) {
      if (u === src || u.side !== src.side || !u.alive) continue;
      if (u.maxHp > 0 && u.hp / u.maxHp < LOWHP_THRESHOLD) n += 1;
    }
    return n;
  }

  /** 生效攻击：berserk 特例保持原码原样（×1.25），M1 加攻/虚弱 + M3 叠层攻击轴在其外乘法合成；
   *  和为 0 时直接走原路径返回（浮点逐字节不变）。加攻/虚弱只进伤害口径，治疗/护盾量走基础攻（与 berserk 现状同口径）。 */
  private effAttack(unit: RtUnit): number {
    const base = unit.states.has('berserk') ? unit.attack * BERSERK_ATTACK_MULT : unit.attack;
    const pct = this.stateModSum(unit, 'atk_up') - this.stateModSum(unit, 'atk_down') + this.ruleStatSum(unit, 'atkPct');
    return pct === 0 ? base : base * Math.max(0, 1 + pct);
  }

  /** 生效普攻间隔：berserk 特例保持原码原样（×0.8），M1 加攻速/减速 + M3 叠层攻速轴在其外按 间隔/(1+攻速和) 合成；
   *  分母钳到 ≥0.1（极限减速也最多把间隔拉长 10 倍）；和为 0 时走原路径（浮点逐字节不变）。 */
  private effInterval(unit: RtUnit): number {
    const base = unit.states.has('berserk') ? unit.attackIntervalSec * BERSERK_INTERVAL_MULT : unit.attackIntervalSec;
    const spd = this.stateModSum(unit, 'atk_speed_up') - this.stateModSum(unit, 'atk_speed_down') + this.ruleStatSum(unit, 'atkSpeedPct') + this.auraSum(unit, 'atkSpeedPct');
    return spd === 0 ? base : base / Math.max(0.1, 1 + spd);
  }


  /** 全体单位的稳定遍历顺序：先 side 后 unitId，保证同 seed 处理/日志顺序固定。 */
  private stableUnits(): RtUnit[] {
    return sortBy([...this.units], (u) => [u.side, u.unitId]);
  }

  private pushLog(type: S7AutoBattleLogType, fields: Partial<S7AutoBattleLogEntry>): void {
    this.log.push({ timeSec: this.time, type, ...fields });
  }

  private buildFinalState(durationSec: number): S7AutoBattleFinalState {
    const snap = (u: RtUnit): S7AutoBattleUnitFinalState => ({
      unitId: u.unitId,
      side: u.side,
      unitStatRef: u.unitStatRef,
      slotRef: u.slotRef,
      hp: u.hp,
      maxHp: u.maxHp,
      shield: u.shield,
      alive: u.alive,
    });
    return {
      durationSec,
      players: this.units.filter((u) => u.side === 'player').map(snap),
      enemies: this.units.filter((u) => u.side === 'enemy').map(snap),
    };
  }
}

// ===== 纯函数工具 =====

function opposite(side: S7AutoBattleSide): S7AutoBattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function roundTime(t: number): number {
  return Math.round(t * 1e6) / 1e6;
}

// 敌方出怪格正则按网格尺寸构造（单一真源 S7BattleGrid；当前 5×7，个位行列数）。
const ENEMY_SLOT_PATTERN = new RegExp(`^r[0-${ENEMY_ROWS - 1}]c[0-${ENEMY_COLS - 1}]$`);
function parseEnemySlot(slot: string): { row: number; col: number } | null {
  if (typeof slot !== 'string' || !ENEMY_SLOT_PATTERN.test(slot)) return null;
  return { row: Number(slot[1]), col: Number(slot[3]) };
}

/** 取一艘星舰的基线战斗属性，作为效果装配层的输入。 */
function baseStatOf(stat: S7BattleUnitStatParam): S7DeriveBaseStat {
  return {
    maxHp: stat.maxHp,
    attack: stat.attack,
    armor: stat.armor,
    attackIntervalSec: stat.attackIntervalSec,
    attackRangeCells: stat.attackRangeCells,
    passiveEnergyPerSec: stat.passiveEnergyPerSec,
    sizeRows: stat.sizeRows,
    sizeCols: stat.sizeCols,
    targetingTag: stat.targetingTag,
    normalEffectRef: stat.normalEffectRef,
    ultimateEffectRef: stat.ultimateEffectRef,
    coreEffectRef: stat.coreEffectRef,
  };
}

/** 单位占格是否覆盖目标列。 */
function occupiesColumn(unit: RtUnit, col: number): boolean {
  return col >= unit.col && col < unit.col + unit.sizeCols;
}

/** 机制批③ 扭蛋"范围+1"升档表：单体→十字(≥5 目标)→3×3(≥9 目标)；已是 3×3 或非区域 tag（列/全体/友方等）不升。 */
function upgradeAreaTag(tag: string): { tag: string; minTargets: number } | null {
  if (tag === 'single_target' || tag === 'nearest_random_tie') return { tag: 'cross_area', minTargets: 5 };
  if (tag === 'cross_area') return { tag: 'block_area', minTargets: 9 };
  if (tag === 'self_cross_area') return { tag: 'self_block_area', minTargets: 9 };
  return null;
}

/** 按出现顺序把引用列表分组为 {ref,count}（保留首见顺序，保证召唤顺序确定）。 */
function groupOrdered(refs: string[]): { ref: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const ref of refs) {
    if (!counts.has(ref)) order.push(ref);
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return order.map((ref) => ({ ref, count: counts.get(ref) ?? 0 }));
}

type SortKey = (string | number)[];

/** 稳定多键排序（升序）；不修改入参数组顺序语义由调用方保证（已传副本处用副本）。 */
function sortBy<T>(items: T[], keyFn: (item: T) => SortKey): T[] {
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
      const va = ka[i];
      const vb = kb[i];
      if (va === vb) continue;
      if (va === undefined) return -1;
      if (vb === undefined) return 1;
      return va < vb ? -1 : 1;
    }
    return 0;
  });
}
