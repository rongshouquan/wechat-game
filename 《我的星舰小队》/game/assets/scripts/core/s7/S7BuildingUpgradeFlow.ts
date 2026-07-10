// 建筑升级编排（C·养成接入 step2，纯 TS，不依赖 cc）：把现成的"成本计算(S7BuildingCost)+工人折扣(S7Population)+
//   升级校验扣减(S7BuildingUpgradeService)"串成表现层可直接用的两件事：
//   ① buildBuildingUpgradeView：列出每栋建筑的 等级/折后成本/买不买得起（喂 UI 列表，纯只读）。
//   ② upgradeBuildingWithDiscount：算折后成本 → 调 upgradeBuilding 校验扣减升级（就地改 state/resources）。
//
// 边界：core 层薄编排，不重写成本/折扣/升级机制（全复用现成模块）；建筑 id 列表由调用方从 building_config 传入
//   （保持本层与配置解耦）。resources 类型沿用 S7BuildingUpgradeService 的口径（S7ResourceState，仅动 starOre）。
//   数值真源 B1/v1.0，成本/效果 v0.1 待第二块校准。

import { S7ResourceState } from '../../save/S7SaveService';
import { S7BuildingState, isBuildingUnlocked, getBuildingLevel, S7_BUILDING_MAX_LEVEL } from './S7BuildingState';
import { buildingUpgradeStarOreCost, discountedBuildingUpgradeCost } from './S7BuildingCost';
import { S7PopulationState } from './S7Population';
import { workerBuildDiscountPct } from './S7BuildingEffects';
import { upgradeBuilding, S7BuildingUpgradeResult } from './S7BuildingUpgradeService';

/** 居住舱建筑 id（工人折扣的门槛与费率挂居住舱等级·细案③）。 */
const HABITAT_ID = 'bld_habitat';

/** 一栋建筑在升级面板里的只读视图行（供 UI 直接渲染）。 */
export interface S7BuildingUpgradeRow {
  buildingId: string;
  unlocked: boolean;
  /** 当前等级（未解锁=0）。 */
  level: number;
  maxLevel: number;
  atMax: boolean;
  /** 升下一级的原始星矿成本（未解锁/满级=null）。 */
  baseCost: number | null;
  /** 折后（工人减免）星矿成本（未解锁/满级=null）。 */
  discountedCost: number | null;
  /** 按当前星矿余额是否买得起（折后）。 */
  canAfford: boolean;
}

/**
 * 列出每栋建筑的升级视图（纯只读，不改任何状态）。
 * buildingIds 由调用方从 building_config 取（保持与配置解耦）；resources 仅读 starOre 判买得起。
 */
export function buildBuildingUpgradeView(
  buildingIds: string[],
  state: S7BuildingState,
  resources: S7ResourceState,
  population: S7PopulationState,
): S7BuildingUpgradeRow[] {
  const ore = typeof resources.starOre === 'number' ? resources.starOre : 0;
  const discPct = workerBuildDiscountPct(getBuildingLevel(state, HABITAT_ID), population.workers);
  return buildingIds.map((buildingId) => {
    const unlocked = isBuildingUnlocked(state, buildingId);
    const level = getBuildingLevel(state, buildingId);
    const atMax = unlocked && level >= S7_BUILDING_MAX_LEVEL;
    const baseCost = buildingUpgradeStarOreCost(buildingId, level); // 未解锁/满级 → null
    const discountedCost = baseCost === null ? null : discountedBuildingUpgradeCost(baseCost, discPct);
    const canAfford = discountedCost !== null && ore >= discountedCost;
    return { buildingId, unlocked, level, maxLevel: S7_BUILDING_MAX_LEVEL, atMax, baseCost, discountedCost, canAfford };
  });
}

/**
 * 升一栋建筑：算折后成本 → 调 upgradeBuilding（已解锁/未满级/成本合法/星矿够 才扣减升级）。
 * 未解锁/满级（无升级成本）直接返回对应 code，不调服务、不改状态。任一失败不改 state/resources。
 */
export function upgradeBuildingWithDiscount(
  state: S7BuildingState,
  resources: S7ResourceState,
  population: S7PopulationState,
  buildingId: string,
): S7BuildingUpgradeResult {
  const level = getBuildingLevel(state, buildingId);
  const baseCost = buildingUpgradeStarOreCost(buildingId, level);
  if (baseCost === null) return { ok: false, code: level < 1 ? 'not_unlocked' : 'max_level' };
  const discPct = workerBuildDiscountPct(getBuildingLevel(state, HABITAT_ID), population.workers);
  const cost = discountedBuildingUpgradeCost(baseCost, discPct);
  return upgradeBuilding(state, resources, buildingId, cost);
}
