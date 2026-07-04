// 悬赏词缀应用层（第2.5块·块2 星港悬赏板，纯 TS，不依赖 cc）：GDD-v2.0 S10.8。
// 职责：把一张悬赏卡携带的「词缀」按【定位型】翻译成效果积木，注入我方对应定位型单位的 extraBlocks，
//       战斗开始时由装配层 deriveUnit 合并生效（确定性、配置表驱动）。词缀只作用于我方、不碰敌方。
//
// 口径（GDD S10.8）：
// - 词缀=本场战斗对我方指定定位型的 buff+debuff 组合修正；品质定条数（铜1/银2/金3，条数在卡生成时定）。
// - 落地机制全部复用【既有积木】：改基础属性（攻/血/防/攻速）走 modifier 积木(pct)、改词条（暴击率/必暴击/
//   技能急速CD/治疗强度）走 affix 积木——12 条词缀零引擎改动（Ron 2026-07-04 拍板：两条工程/支援特殊词缀
//   改写成纯现有旋钮版，全 12 条真实生效、半残词缀不上板）。
// - 定位型来源=battle_unit_stat_param.positionType（灰盒占位·星舰内容块随真源统一校准，见 README 遗留）。
// - 「上阵≤N 舰」条件（孤胆合约）在装配时按上阵数判定；'all' 定位型命中全队。
//
// 数值全 v0.1 占位（各修正量），阶段三数值校准统一精校；本层只做"配置→积木"的确定性翻译，不含数值。

import { S7EffectBlock, S7StatKey, S7AffixKey } from './S7BattleEffectBlock';

/** 星舰 5 定位型（GDD S5「星舰5定位型」）。词缀 positionType 取这 5 个或 'all'（全队）。 */
export type S7PositionType = 'assault' | 'guard' | 'artillery' | 'support' | 'engineer';
export const S7_POSITION_TYPES: readonly S7PositionType[] = Object.freeze([
  'assault', 'guard', 'artillery', 'support', 'engineer',
]);

/** 词缀 positionType 允许值 = 5 定位型 + 'all'（校验器共用真源）。 */
export const S7_AFFIX_TARGET_TYPES: readonly string[] = Object.freeze([...S7_POSITION_TYPES, 'all']);

/** 单条修正：channel=stat → 改基础属性(modifier 积木)；channel=affix → 改定向词条(affix 积木)。 */
export interface S7CommissionAffixMod {
  channel: 'stat' | 'affix';
  /** channel=stat: S7StatKey（maxHp/attack/armor/attackIntervalSec/...）；channel=affix: S7AffixKey（critRate/skillHaste/healPower/...）。 */
  key: string;
  /** 仅 channel=stat 用；缺省 'pct'。词缀不用 'set'（那是质变覆盖，非词缀语义）。 */
  op?: 'flat' | 'pct';
  value: number;
}

/**
 * 词缀定义（应用层只读它需要的字段；结构上与配置行 S7CommissionAffixParam 兼容，UI 直接传配置行进来）。
 * 不 import 配置类型，避免 core→config 依赖方向。
 */
export interface S7CommissionAffixDef {
  rowId: string;
  affixName: string;
  /** 目标定位型 ∈ 5 定位型 或 'all'。 */
  positionType: string;
  /** 0=无条件；>0=仅当我方上阵数 ≤ 此值时生效（孤胆合约=3）。 */
  condLineupMax: number;
  mods: readonly S7CommissionAffixMod[];
  effectText: string;
}

/** 把一条修正翻成一块效果积木（stat→modifier / affix→affix）；source 前缀便于战报溯源。 */
function modToBlock(mod: S7CommissionAffixMod, affixId: string): S7EffectBlock {
  const source = `commission_affix:${affixId}`;
  if (mod.channel === 'affix') {
    return { kind: 'affix', affix: mod.key as S7AffixKey, value: mod.value, source };
  }
  return { kind: 'modifier', stat: mod.key as S7StatKey, op: mod.op ?? 'pct', value: mod.value, source };
}

/** 该词缀是否作用于「某定位型、某上阵数」的一艘我方单位。 */
function affixHitsUnit(def: S7CommissionAffixDef, positionType: S7PositionType, lineupSize: number): boolean {
  if (def.positionType !== 'all' && def.positionType !== positionType) return false; // 定位型不匹配
  if (def.condLineupMax > 0 && lineupSize > def.condLineupMax) return false; // 上阵数条件不满足
  return true;
}

/**
 * 一张卡的激活词缀里，命中「某定位型 + 某上阵数」单位的那些定义（供备战界面挂词缀标记：图标 + effectText）。
 * activeAffixIds 里的未知 id（脏配置/脏档）跳过。
 */
export function matchedCommissionAffixes(
  affixDefs: readonly S7CommissionAffixDef[],
  activeAffixIds: readonly string[],
  positionType: S7PositionType,
  lineupSize: number,
): S7CommissionAffixDef[] {
  const byId = new Map<string, S7CommissionAffixDef>();
  for (const d of affixDefs) byId.set(d.rowId, d);
  const out: S7CommissionAffixDef[] = [];
  for (const id of activeAffixIds) {
    const def = byId.get(id);
    if (def && affixHitsUnit(def, positionType, lineupSize)) out.push(def);
  }
  return out;
}

/**
 * 一张卡的激活词缀，对「某定位型 + 某上阵数」的一艘我方单位，产出注入其 extraBlocks 的效果积木。
 * 战斗开始时随该单位四层积木一并喂 deriveUnit 合并（确定性）。无命中 → 空数组。
 */
export function commissionAffixBlocks(
  affixDefs: readonly S7CommissionAffixDef[],
  activeAffixIds: readonly string[],
  positionType: S7PositionType,
  lineupSize: number,
): S7EffectBlock[] {
  const out: S7EffectBlock[] = [];
  for (const def of matchedCommissionAffixes(affixDefs, activeAffixIds, positionType, lineupSize)) {
    for (const mod of def.mods) out.push(modToBlock(mod, def.rowId));
  }
  return out;
}
