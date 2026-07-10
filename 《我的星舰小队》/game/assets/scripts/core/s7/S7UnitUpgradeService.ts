// 单位升级服务（步5 收尾批回写·纯 TS，不依赖 cc）：花软货币把星舰/驾驶员升 1 级。
// 成本曲线（初值表 v0.7 §7 支出侧·机器真源 TRUTHS.shipLevelCost/pilotLevelCost·B1 军饷身份）：
//   星舰 L→L+1 = round( 50 × L^1.3 × 船坞折扣 ) 星舰合金（只花合金——旧"星矿+合金+舰碎片"三币占位作废）；
//   驾驶员 L→L+1 = round( 40 × L^1.2 × 训练舱折扣 ) 驾驶记录。
//   1-100 全段同一公式（旧 upgrade_cost_param"段总成本÷10 均摊+41-100 持平"占位作废=A9-4 补段）。
//   折扣线（细案①②）：船坞/训练舱 −1.5%/级顶 −15%，只折升级币；专属碎片（升阶/升星/合成）结构上不经过此路径。
// 校验：未满级(<绝对上限 100=SS/5★) → 未达阶级上限 → 资源够 → 扣费 + 提级。任一不满足返回 ok:false、不改任何状态。
// 与 save 解耦：等级状态/资源以中性结构传入；建筑折扣由调用方传该建筑等级。

import { S7UnitLevelState, S7_UNIT_MAX_LEVEL, getShipLevel, setShipLevel, getPilotLevel, setPilotLevel } from './S7UnitLevelState';
import { dockAlloyDiscountMult, trainingTokenDiscountMult } from './S7BuildingEffects';

/** 升级成本公式常量（v0.7 校准终值·照抄不调数）。 */
export const SHIP_LEVEL_COST_BASE = 50;
export const SHIP_LEVEL_COST_EXP = 1.3;
export const PILOT_LEVEL_COST_BASE = 40;
export const PILOT_LEVEL_COST_EXP = 1.2;

/** 星舰 L→L+1 的合金成本（含船坞折扣·与机器真源 round(50×L^1.3×折扣) 一字不差）。 */
export function shipLevelUpCost(fromLevel: number, dockLevel: number): number {
  const lv = Math.max(0, Math.floor(Number.isFinite(fromLevel) ? fromLevel : 0));
  return Math.round(SHIP_LEVEL_COST_BASE * Math.pow(lv, SHIP_LEVEL_COST_EXP) * dockAlloyDiscountMult(dockLevel));
}
/** 驾驶员 L→L+1 的记录成本（含训练舱折扣）。 */
export function pilotLevelUpCost(fromLevel: number, trainingLevel: number): number {
  const lv = Math.max(0, Math.floor(Number.isFinite(fromLevel) ? fromLevel : 0));
  return Math.round(PILOT_LEVEL_COST_BASE * Math.pow(lv, PILOT_LEVEL_COST_EXP) * trainingTokenDiscountMult(trainingLevel));
}

/** 一次升级扣的各币种数量（星舰升级只花合金·步5 起 starOre/shipBlueprint 恒 0，字段保留防调用方断链）。 */
export interface S7UpgradeSpend {
  starOre: number;
  hullAlloy: number;
  shipBlueprint: number;
}

export type S7UpgradeFailReason = 'max_level' | 'no_cost_row' | 'insufficient' | 'cap_reached';

export type S7ShipUpgradeResult =
  | { ok: true; shipId: string; fromLevel: number; toLevel: number; spent: S7UpgradeSpend }
  | { ok: false; reason: S7UpgradeFailReason; shipId: string; needed?: S7UpgradeSpend };

/**
 * 有效等级上限 = 阶级/星级给的 levelCap（Ron 2026-07-03「取消建筑卡等级」：上限只由阶级决定）。
 * levelCap 由调用方按单位阶级算好传入（shipLevelCapForTier/pilotLevelCapForStar：C20/B40/A60/S80/SS100）；
 * 仅对绝对上限 S7_UNIT_MAX_LEVEL(=100·SS/5★天花板) 做防脏参兜底，缺省=绝对上限(无阶级额外封顶)。
 */
function effectiveCap(levelCap?: number): number {
  if (typeof levelCap !== 'number' || !Number.isFinite(levelCap)) return S7_UNIT_MAX_LEVEL;
  return Math.max(0, Math.min(S7_UNIT_MAX_LEVEL, Math.floor(levelCap)));
}

/**
 * 把一艘星舰升 1 级（只花星舰合金·船坞折扣生效）：就地扣 resources、提 levels（成功时）；失败不改任何状态。
 * dockLevel = 船坞当前等级（折扣线）；levelCap（阶级等级上限）：当前级 >= 有效上限 → cap_reached。
 */
export function upgradeShipOneLevel(
  levels: S7UnitLevelState,
  resources: Record<string, number>,
  shipId: string,
  dockLevel: number,
  levelCap?: number,
): S7ShipUpgradeResult {
  const fromLevel = getShipLevel(levels, shipId);
  if (fromLevel >= S7_UNIT_MAX_LEVEL) return { ok: false, reason: 'max_level', shipId };
  if (fromLevel >= effectiveCap(levelCap)) return { ok: false, reason: 'cap_reached', shipId };
  const needed: S7UpgradeSpend = { starOre: 0, hullAlloy: shipLevelUpCost(fromLevel, dockLevel), shipBlueprint: 0 };
  const have = typeof resources.hullAlloy === 'number' ? resources.hullAlloy : 0;
  if (have < needed.hullAlloy) return { ok: false, reason: 'insufficient', shipId, needed };

  resources.hullAlloy = have - needed.hullAlloy;
  setShipLevel(levels, shipId, fromLevel + 1);
  return { ok: true, shipId, fromLevel, toLevel: fromLevel + 1, spent: needed };
}

export type S7PilotUpgradeResult =
  | { ok: true; pilotId: string; fromLevel: number; toLevel: number; spentPilotToken: number }
  | { ok: false; reason: S7UpgradeFailReason; pilotId: string; neededPilotToken?: number };

/**
 * 把一名驾驶员升 1 级（只花驾驶记录·训练舱折扣生效）：就地扣 pilotToken、提 pilotLevels（成功时）。
 * trainingLevel = 训练舱当前等级（折扣线）；levelCap（星级等级上限）同星舰。
 */
export function upgradePilotOneLevel(
  levels: S7UnitLevelState,
  resources: Record<string, number>,
  pilotId: string,
  trainingLevel: number,
  levelCap?: number,
): S7PilotUpgradeResult {
  const fromLevel = getPilotLevel(levels, pilotId);
  if (fromLevel >= S7_UNIT_MAX_LEVEL) return { ok: false, reason: 'max_level', pilotId };
  if (fromLevel >= effectiveCap(levelCap)) return { ok: false, reason: 'cap_reached', pilotId };
  const need = pilotLevelUpCost(fromLevel, trainingLevel);
  const have = typeof resources.pilotToken === 'number' ? resources.pilotToken : 0;
  if (have < need) return { ok: false, reason: 'insufficient', pilotId, neededPilotToken: need };

  resources.pilotToken = have - need;
  setPilotLevel(levels, pilotId, fromLevel + 1);
  return { ok: true, pilotId, fromLevel, toLevel: fromLevel + 1, spentPilotToken: need };
}
