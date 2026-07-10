// 建筑升级成本（步5 收尾批回写·纯 TS，不依赖 cc）：v1.0 §7「升级只花星矿、即时完成」。
// 成本曲线：成本(L→L+1) = round( round(BASE × L^EXP × 重要度系数) × 全局系数 3.0 )，纯星矿。
//   全局系数 ×3.0 = 初值表 v0.7 校准解（机器真源 PARAMS.buildingCostMult——让建筑线成为星矿的
//   真实长期 sink、压死"溢出回收灌爆星贝"死水；6b3 草案的 v0.1 起步值由此定稿）。
//   重要度系数按建筑分 3 档（核心养成 ×1.3 / 重要 ×1.1 / 普通 ×1.0），越关键的楼升级越有"投资分量"。
// 与 S7BuildingUpgradeService 配合：本模块出成本数字，服务管校验+扣减+升级。

import { S7_BUILDING_MIN_LEVEL, S7_BUILDING_MAX_LEVEL } from './S7BuildingState';

const BASE = 120;
const EXPONENT = 1.3;
/** 全局成本系数（v0.7 校准终值·照抄不调数）。 */
export const BUILDING_COST_GLOBAL_MULT = 3.0;

/** 重要度系数（按建筑 id）。未知 id 取普通档 1.0（与配置解耦，不硬依赖建筑表存在）。 */
const TIER_MULTIPLIER: Record<string, number> = {
  bld_dock: 1.3, // 核心：卡星舰等级上限
  bld_pilot_training_bay: 1.3, // 核心：卡驾驶员等级上限
  bld_habitat: 1.1, // 重要：离线经济
  bld_research_tower: 1.1, // 重要：全队加成
  bld_supply_station: 1.1, // 重要：抽卡出率
  bld_salvage_port: 1.0, // 普通
  bld_merchant_station: 1.0, // 普通
  bld_rsv_core_gallery: 1.0, // 普通（收集向）
};

/** 建筑重要度系数（未知建筑→1.0）。 */
export function buildingCostTierMultiplier(buildingId: string): number {
  return TIER_MULTIPLIER[buildingId] ?? 1.0;
}

/**
 * 升级成本（currentLevel → currentLevel+1）的星矿花费（含全局系数 ×3.0·未含工人折扣）。
 * currentLevel 须为 [MIN, MAX-1] 内整数（已解锁、未满级）；否则返回 null（未解锁 / 已满级 = 无升级成本）。
 * 口径与机器真源一致：round( round(120×L^1.3×系数) × 3.0 )。
 */
export function buildingUpgradeStarOreCost(buildingId: string, currentLevel: number): number | null {
  if (!Number.isInteger(currentLevel)) return null;
  if (currentLevel < S7_BUILDING_MIN_LEVEL || currentLevel >= S7_BUILDING_MAX_LEVEL) return null;
  const inner = Math.round(BASE * Math.pow(currentLevel, EXPONENT) * buildingCostTierMultiplier(buildingId));
  return Math.round(inner * BUILDING_COST_GLOBAL_MULT);
}

/**
 * 折后升级成本（工人建筑折扣·细案③）：round( 原价 × (1−折扣%) )。
 * discountPct 传 S7BuildingEffects.workerBuildDiscountPct(居住舱等级, 工人数)（0-25）。
 */
export function discountedBuildingUpgradeCost(baseCost: number, discountPct: number): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return Math.max(0, Math.round(baseCost || 0));
  const d = Math.max(0, Math.min(100, Number.isFinite(discountPct) ? discountPct : 0));
  return Math.max(0, Math.round(baseCost * (1 - d / 100)));
}
