// 深空回廊·戏法层规则库（第2.5块·块3，纯 TS，不依赖 cc）：GDD-v2.0 S10.7 内联表 10 种。
// 对标块2 的 S7CommissionAffix——把"戏法层的规则"翻译成一份纯数据的作用清单（积木 + 敌阵指令 + 我方规则），
// 由层生成器（S7DeepCorridor）与出战流程（步2）照单执行。本层不跑战斗、不碰引擎、不含随机。
//
// 落地机制铁律（Ron 2026-07-04 拍板）：10 种戏法**零新增机制类型**——全部复用既有战斗积木/敌人单位：
//   - 敌方数值修正（铁甲潮高防 / 蜂群变弱）走 modifier 积木，作用到敌方（步2 经回廊专用受控入口注入）。
//   - 敌方开局带盾（护盾矩阵）走 trigger 积木 → 现成 eff_state_shield（battle_start 触发）。
//   - 我方数值修正（乱流·技能CD拖慢）走 affix 积木（skillHaste 取负 = CD 变长），与悬赏词缀完全同一条路。
//   - 敌阵形状类（后排火力摆位 / 蜂群翻倍 / 持久战加奶妈）由层生成器直接摆/加敌人（复用现成敌人行）。
//   - 战斗规则类（精锐限3 / 孤胆限1 / 闪电战限时 / 静默空域禁核）输出成标志，步2 在装配/备战侧执行。
//
// "换作用方"：悬赏词缀 buff/debuff 我方；这里同款积木大多作用到**敌方**（enemyBlocks）——这是块3 相对块2 的差异点。
// 数值全 v0.1 占位（各修正量/限时/上限），阶段三数值校准统一精校；本层只做"规则→数据"的确定性翻译。

import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7_MAX_PLAYER_UNITS } from './S7BattleGrid';

/** 10 种戏法 id（GDD S10.7 内联表，顺序与表一致）。 */
export type S7CorridorTrickId =
  | 'backline_fire'   // 后排火力：敌全部署后排
  | 'elite_squad'     // 精锐小队：只许上 3 舰
  | 'blitz'           // 闪电战：限时 40 秒
  | 'iron_tide'       // 铁甲潮：敌全体高防
  | 'swarm'           // 蜂群：敌数量翻倍、单体弱
  | 'silent_zone'     // 静默空域：我方星核失效
  | 'attrition'       // 持久战：敌方治疗单位多
  | 'shield_matrix'   // 护盾矩阵：敌全体开局带盾
  | 'turbulence'      // 乱流：我方技能 CD +50%
  | 'lone_hero';      // 孤胆英雄：只许上 1 舰（深层专属）

/** 戏法定义（展示 + 元数据；塔页/备战页明示要用 name/ruleText/solveHint）。 */
export interface S7CorridorTrickDef {
  id: S7CorridorTrickId;
  /** 中文名（塔页/备战页标题）。 */
  name: string;
  /** 规则一句话（进关前明示——"才谈得上换搭配"）。 */
  ruleText: string;
  /** 解法提示（动脑解法｜硬碾路径，GDD 表）。 */
  solveHint: string;
  /** 是否深层专属（孤胆英雄）——只在深层出现，见 S7DeepCorridor.CORRIDOR_DEEP_TRICK_LAYER。 */
  deepOnly: boolean;
}

// ===== 占位数值（阶段三统一校准；改这里不改逻辑，照 S7StarportBounty 的 exported const 成例）=====
/** 铁甲潮：敌全体护甲 +150%（占位·pct 随基础护甲放大）。 */
export const IRON_TIDE_ARMOR_PCT = 1.5;
/** 蜂群：敌数量倍率（翻倍）。 */
export const SWARM_COUNT_MULT = 2;
/** 蜂群：单体削弱——血/攻各 -50%（占位·负 pct = 乘 0.5）。 */
export const SWARM_WEAKEN_PCT = -0.5;
/** 持久战：追加治疗型敌人数量（占位·复用 bu_enemy_support，其大招 eff_ult_repair_burst 奶最低血友方）。 */
export const ATTRITION_EXTRA_HEALERS = 3;
/** 闪电战：限时秒数（覆盖引擎默认 120s）。 */
export const BLITZ_TIME_LIMIT_SEC = 40;
/** 精锐小队：上阵上限。 */
export const ELITE_LINEUP_CAP = 3;
/** 孤胆英雄：上阵上限。 */
export const LONE_LINEUP_CAP = 1;
/**
 * 乱流：我方技能 CD +50%。引擎按 CD/(1+skillHaste) 生效（块4b-2），故 CD×1.5 需 skillHaste = 1/1.5-1 = -1/3。
 * 用 affix 积木作用到我方全体（负急速 = 拖慢），与悬赏词缀走同一条 affix 通道。
 */
export const TURBULENCE_SKILL_HASTE = 1 / 1.5 - 1; // = -0.3333…（+50% CD）
/** 护盾矩阵：敌开局带盾引用的现成状态效果（battle_start 触发·先扣盾再扣血）。占位·可换更久/更强的专用盾（第三块）。 */
export const SHIELD_MATRIX_EFFECT_REF = 'eff_state_shield';

/** 戏法库（10 种·GDD S10.7 内联表原文）。顺序=表顺序，供确定性抽取与 UI 展示。 */
export const S7_CORRIDOR_TRICKS: readonly S7CorridorTrickDef[] = Object.freeze([
  { id: 'backline_fire', name: '后排火力', ruleText: '敌全部署后排', solveHint: '突击/打后排驾驶/导弹AoE ｜ 高攻速平推', deepOnly: false },
  { id: 'elite_squad', name: '精锐小队', ruleText: '只许上 3 舰', solveHint: '挑精英三人组 ｜ 3 艘养成溢出', deepOnly: false },
  { id: 'blitz', name: '闪电战', ruleText: `限时 ${BLITZ_TIME_LIMIT_SEC} 秒`, solveHint: '爆发流搭配 ｜ 战力溢出速杀', deepOnly: false },
  { id: 'iron_tide', name: '铁甲潮', ruleText: '敌全体高防', solveHint: '破甲/按%扣血 ｜ 堆攻硬凿', deepOnly: false },
  { id: 'swarm', name: '蜂群', ruleText: '敌数量翻倍、单体弱', solveHint: '群伤清场 ｜ 单点慢磨', deepOnly: false },
  { id: 'silent_zone', name: '静默空域', ruleText: '我方星核失效', solveHint: '不依赖核的阵容 ｜ 基础战力够高', deepOnly: false },
  { id: 'attrition', name: '持久战', ruleText: '敌方治疗单位多', solveHint: '点杀奶源/禁疗 ｜ 爆发盖过回复', deepOnly: false },
  { id: 'shield_matrix', name: '护盾矩阵', ruleText: '敌全体开局带盾', solveHint: '削盾工具 ｜ 硬打穿两层血', deepOnly: false },
  { id: 'turbulence', name: '乱流', ruleText: '我方技能 CD +50%', solveHint: '普攻/被动流 ｜ 属性碾压', deepOnly: false },
  { id: 'lone_hero', name: '孤胆英雄', ruleText: '只许上 1 舰', solveHint: '单舰极限特化 ｜ 超高养成单舰', deepOnly: true },
]);

/** 按 id 取戏法定义；未知 id 返回 null。 */
export function corridorTrickDef(id: string): S7CorridorTrickDef | null {
  return S7_CORRIDOR_TRICKS.find((t) => t.id === id) ?? null;
}

/**
 * 一种戏法对一层的"作用清单"（纯数据·步2/生成器照单执行）：
 * - enemyBlocks：施加到全体敌人的积木（铁甲潮高防 / 蜂群变弱 / 护盾矩阵开局盾）。
 * - playerBlocks：施加到我方全体的积木（乱流·负急速）。
 * - enemyPlacement：'back' = 敌阵摆后排（后排火力）；'default' = 常规前中排。
 * - enemyCountMult：敌数量倍率（蜂群=2）。
 * - extraHealers：追加治疗敌人数（持久战）。
 * - lineupCap：我方上阵上限（精锐=3 / 孤胆=1 / 默认=5）。
 * - timeLimitSec：>0 覆盖引擎默认限时（闪电战=40）；0 = 不覆盖。
 * - disablePlayerCores：true = 我方星核失效（静默空域），步2 装配时不注星核积木。
 */
export interface S7CorridorTrickEffect {
  trickId: S7CorridorTrickId;
  enemyBlocks: S7EffectBlock[];
  playerBlocks: S7EffectBlock[];
  enemyPlacement: 'default' | 'back';
  enemyCountMult: number;
  extraHealers: number;
  lineupCap: number;
  timeLimitSec: number;
  disablePlayerCores: boolean;
}

/** 无戏法（普通层/回响Boss层）的中性作用清单——所有杠杆归位。 */
export function neutralCorridorEffect(): Omit<S7CorridorTrickEffect, 'trickId'> {
  return {
    enemyBlocks: [],
    playerBlocks: [],
    enemyPlacement: 'default',
    enemyCountMult: 1,
    extraHealers: 0,
    lineupCap: S7_MAX_PLAYER_UNITS,
    timeLimitSec: 0,
    disablePlayerCores: false,
  };
}

/**
 * 把一种戏法翻成作用清单（纯函数·确定性·无随机）。从中性清单出发，只改本戏法涉及的杠杆。
 * source 前缀便于战报溯源（corridor_trick:<id>）。
 */
export function corridorTrickEffect(trickId: S7CorridorTrickId): S7CorridorTrickEffect {
  const eff: S7CorridorTrickEffect = { trickId, ...neutralCorridorEffect() };
  const src = `corridor_trick:${trickId}`;
  switch (trickId) {
    case 'backline_fire':
      eff.enemyPlacement = 'back';
      break;
    case 'elite_squad':
      eff.lineupCap = ELITE_LINEUP_CAP;
      break;
    case 'blitz':
      eff.timeLimitSec = BLITZ_TIME_LIMIT_SEC;
      break;
    case 'iron_tide':
      eff.enemyBlocks = [{ kind: 'modifier', stat: 'armor', op: 'pct', value: IRON_TIDE_ARMOR_PCT, source: src }];
      break;
    case 'swarm':
      eff.enemyCountMult = SWARM_COUNT_MULT;
      eff.enemyBlocks = [
        { kind: 'modifier', stat: 'maxHp', op: 'pct', value: SWARM_WEAKEN_PCT, source: src },
        { kind: 'modifier', stat: 'attack', op: 'pct', value: SWARM_WEAKEN_PCT, source: src },
      ];
      break;
    case 'silent_zone':
      eff.disablePlayerCores = true;
      break;
    case 'attrition':
      eff.extraHealers = ATTRITION_EXTRA_HEALERS;
      break;
    case 'shield_matrix':
      eff.enemyBlocks = [{ kind: 'trigger', on: 'battle_start', effectRef: SHIELD_MATRIX_EFFECT_REF, source: src }];
      break;
    case 'turbulence':
      eff.playerBlocks = [{ kind: 'affix', affix: 'skillHaste', value: TURBULENCE_SKILL_HASTE, source: src }];
      break;
    case 'lone_hero':
      eff.lineupCap = LONE_LINEUP_CAP;
      break;
    default: {
      // 穷尽保护：新增 trickId 忘了处理会被 tsc 拦下。
      const _never: never = trickId;
      return _never;
    }
  }
  return eff;
}
