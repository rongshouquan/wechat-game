// 单位升级服务（C1b 升级变强 步3，纯 TS，不依赖 cc）：花软货币把星舰升 1 级。v1.0 §6 升级（星舰花星舰合金）。
//   成本读 upgrade_cost_param（按"等级段总成本"），占位口径：每升一级 = 该段总成本 ÷10（段含 10 级）向下取整。
//   校验：未满级(<40) → 该级所属段有成本行 → 资源够 → 扣费 + 提级。任一不满足返回 ok:false、不改任何状态。
//   ⚠️ 占位简化：÷10 的均摊为原型口径，精确"逐级成本曲线"留第二块；驾驶员升级(花驾驶记录)同理留后。
// 与配置/save 解耦：成本行由调用方从 runtime.getAll('upgrade_cost_param') 传入；等级状态/资源以中性结构传入。

import { S7UpgradeCostParam } from '../../config/s7/ConfigTypesS7';
import { S7UnitLevelState, S7_UNIT_MAX_LEVEL, getShipLevel, setShipLevel, getPilotLevel, setPilotLevel } from './S7UnitLevelState';

/** 段含的等级数（lv1-10 / 11-20 … 每段 10 级）；用于把"段总成本"均摊成每级成本（占位）。 */
const LEVELS_PER_BAND = 10;

/** 一次升级扣的各币种数量。 */
export interface S7UpgradeSpend {
  starOre: number;
  hullAlloy: number;
  shipBlueprint: number;
}

export type S7UpgradeFailReason = 'max_level' | 'no_cost_row' | 'insufficient' | 'cap_reached';

export type S7ShipUpgradeResult =
  | { ok: true; shipId: string; fromLevel: number; toLevel: number; spent: S7UpgradeSpend }
  | { ok: false; reason: S7UpgradeFailReason; shipId: string; needed?: S7UpgradeSpend };

function perLevel(total: number): number {
  return Math.max(0, Math.floor((Number.isFinite(total) ? total : 0) / LEVELS_PER_BAND));
}

/** 找目标等级所属段的成本行：该 targetType 中 maxLevel >= targetLevel 的最小 maxLevel 行。 */
function costRowFor(costRows: S7UpgradeCostParam[], targetType: 'ship' | 'pilot', targetLevel: number): S7UpgradeCostParam | undefined {
  return costRows
    .filter((r) => r.targetType === targetType && typeof r.maxLevel === 'number' && r.maxLevel >= targetLevel)
    .sort((a, b) => a.maxLevel - b.maxLevel)[0];
}

/** 有效等级上限 = min(绝对上限 40, 建筑给的 levelCap)。levelCap 缺省=绝对上限(无额外封顶)。 */
function effectiveCap(levelCap?: number): number {
  if (typeof levelCap !== 'number' || !Number.isFinite(levelCap)) return S7_UNIT_MAX_LEVEL;
  return Math.max(0, Math.min(S7_UNIT_MAX_LEVEL, Math.floor(levelCap)));
}

/**
 * 把一艘星舰升 1 级：就地扣 resources、提 levels（成功时）；失败不改任何状态。
 * levelCap（J·船坞等级上限）：当前级 >= 有效上限 → cap_reached（提示升船坞）；缺省则只受绝对上限 40 约束。
 */
export function upgradeShipOneLevel(
  levels: S7UnitLevelState,
  resources: Record<string, number>,
  costRows: S7UpgradeCostParam[],
  shipId: string,
  levelCap?: number,
): S7ShipUpgradeResult {
  const fromLevel = getShipLevel(levels, shipId);
  if (fromLevel >= S7_UNIT_MAX_LEVEL) return { ok: false, reason: 'max_level', shipId };
  if (fromLevel >= effectiveCap(levelCap)) return { ok: false, reason: 'cap_reached', shipId };
  const targetLevel = fromLevel + 1;
  const row = costRowFor(costRows, 'ship', targetLevel);
  if (!row) return { ok: false, reason: 'no_cost_row', shipId };

  const needed: S7UpgradeSpend = {
    starOre: perLevel(row.starOre),
    hullAlloy: perLevel(row.hullAlloy),
    shipBlueprint: perLevel(row.shipBlueprint),
  };
  const have = (k: string) => (typeof resources[k] === 'number' ? resources[k] : 0);
  if (have('starOre') < needed.starOre || have('hullAlloy') < needed.hullAlloy || have('shipBlueprint') < needed.shipBlueprint) {
    return { ok: false, reason: 'insufficient', shipId, needed };
  }

  resources.starOre = have('starOre') - needed.starOre;
  resources.hullAlloy = have('hullAlloy') - needed.hullAlloy;
  resources.shipBlueprint = have('shipBlueprint') - needed.shipBlueprint;
  setShipLevel(levels, shipId, targetLevel);
  return { ok: true, shipId, fromLevel, toLevel: targetLevel, spent: needed };
}

export type S7PilotUpgradeResult =
  | { ok: true; pilotId: string; fromLevel: number; toLevel: number; spentPilotToken: number }
  | { ok: false; reason: S7UpgradeFailReason; pilotId: string; neededPilotToken?: number };

/**
 * 把一名驾驶员升 1 级（v1.0 §6：花驾驶记录 pilotToken）：就地扣 pilotToken、提 pilotLevels（成功时）。
 * levelCap（J·训练舱等级上限）同船坞。成本读 upgrade_cost_param 的 pilot 行（占位÷10均摊）。
 */
export function upgradePilotOneLevel(
  levels: S7UnitLevelState,
  resources: Record<string, number>,
  costRows: S7UpgradeCostParam[],
  pilotId: string,
  levelCap?: number,
): S7PilotUpgradeResult {
  const fromLevel = getPilotLevel(levels, pilotId);
  if (fromLevel >= S7_UNIT_MAX_LEVEL) return { ok: false, reason: 'max_level', pilotId };
  if (fromLevel >= effectiveCap(levelCap)) return { ok: false, reason: 'cap_reached', pilotId };
  const targetLevel = fromLevel + 1;
  const row = costRowFor(costRows, 'pilot', targetLevel);
  if (!row) return { ok: false, reason: 'no_cost_row', pilotId };

  const need = perLevel(row.pilotToken);
  const have = typeof resources.pilotToken === 'number' ? resources.pilotToken : 0;
  if (have < need) return { ok: false, reason: 'insufficient', pilotId, neededPilotToken: need };

  resources.pilotToken = have - need;
  setPilotLevel(levels, pilotId, targetLevel);
  return { ok: true, pilotId, fromLevel, toLevel: targetLevel, spentPilotToken: need };
}
