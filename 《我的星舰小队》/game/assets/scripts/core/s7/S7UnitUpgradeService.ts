// 单位升级服务（C1b 升级变强 步3，纯 TS，不依赖 cc）：花软货币把星舰升 1 级。v1.0 §6 升级（星舰花星舰合金）。
//   成本读 upgrade_cost_param（按"等级段总成本"），占位口径：每升一级 = 该段总成本 ÷10（段含 10 级）向下取整。
//   校验：未满级(<40) → 该级所属段有成本行 → 资源够 → 扣费 + 提级。任一不满足返回 ok:false、不改任何状态。
//   ⚠️ 占位简化：÷10 的均摊为原型口径，精确"逐级成本曲线"留第二块；驾驶员升级(花驾驶记录)同理留后。
// 与配置/save 解耦：成本行由调用方从 runtime.getAll('upgrade_cost_param') 传入；等级状态/资源以中性结构传入。

import { S7UpgradeCostParam } from '../../config/s7/ConfigTypesS7';
import { S7UnitLevelState, S7_UNIT_MAX_LEVEL, getShipLevel, setShipLevel } from './S7UnitLevelState';

/** 段含的等级数（lv1-10 / 11-20 … 每段 10 级）；用于把"段总成本"均摊成每级成本（占位）。 */
const LEVELS_PER_BAND = 10;

/** 一次升级扣的各币种数量。 */
export interface S7UpgradeSpend {
  starOre: number;
  hullAlloy: number;
  shipBlueprint: number;
}

export type S7ShipUpgradeResult =
  | { ok: true; shipId: string; fromLevel: number; toLevel: number; spent: S7UpgradeSpend }
  | { ok: false; reason: 'max_level' | 'no_cost_row' | 'insufficient'; shipId: string; needed?: S7UpgradeSpend };

function perLevel(total: number): number {
  return Math.max(0, Math.floor((Number.isFinite(total) ? total : 0) / LEVELS_PER_BAND));
}

/** 找目标等级所属段的成本行：targetType=ship 中 maxLevel >= targetLevel 的最小 maxLevel 行。 */
function shipCostRowFor(costRows: S7UpgradeCostParam[], targetLevel: number): S7UpgradeCostParam | undefined {
  return costRows
    .filter((r) => r.targetType === 'ship' && typeof r.maxLevel === 'number' && r.maxLevel >= targetLevel)
    .sort((a, b) => a.maxLevel - b.maxLevel)[0];
}

/**
 * 把一艘星舰升 1 级：就地扣 resources、提 levels（成功时）；失败不改任何状态。
 * resources 用中性 Record（实际传 S7PlayerState.resources）；levels 传 S7UnitLevelState。
 */
export function upgradeShipOneLevel(
  levels: S7UnitLevelState,
  resources: Record<string, number>,
  costRows: S7UpgradeCostParam[],
  shipId: string,
): S7ShipUpgradeResult {
  const fromLevel = getShipLevel(levels, shipId);
  if (fromLevel >= S7_UNIT_MAX_LEVEL) return { ok: false, reason: 'max_level', shipId };
  const targetLevel = fromLevel + 1;
  const row = shipCostRowFor(costRows, targetLevel);
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
