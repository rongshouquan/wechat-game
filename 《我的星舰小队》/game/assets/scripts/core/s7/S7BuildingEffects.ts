// 建筑各级效果数值（块6b-3，纯 TS，不依赖 cc）：给定建筑等级 → 效果量。
// 数值文档 建筑数值-6b3 v0.2（Ron 2026-06-19 拍板）；均为 v0.1 起步、原型再校准。
// 本模块只算"等级→数值"，不接消费方：离线用 offlineStorageHours/offlineRateBonusPct、
// 战斗用 researchTeamBonusPct/coreGalleryTeamBonusPct、抽卡用 supplyGachaTopRateBonusPct……各系统建好时各自取用。
// 设计真源：数值以 B1、设计以 v1.0 为准（旧 Codex 配置不理）。建筑不进战力公式，研究塔/展厅为 minor_non_gate 小加成。
//
// 约定：入参 level 为该建筑当前等级（getBuildingLevel：未解锁=0）；level<1 一律返回 0/无效果。

import { S7_BUILDING_MAX_LEVEL } from './S7BuildingState';

/** 把 level 夹到 [1, MAX] 的整数；level<1 返回 0（调用方据此判"无效果"）。 */
function clampLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.min(Math.floor(level), S7_BUILDING_MAX_LEVEL);
}

// ===== 船坞 dock / 驾驶员训练舱 pilot_training_bay：暂无战斗外收益 =====
// Ron 2026-07-03「取消建筑卡等级」拍板：星舰/驾驶员等级上限只由阶级/星级决定（C20/B40/A60/S80/SS100，
//   见 S7UnitTierState.shipLevelCapForTier / pilotLevelCapForStar），废除旧的"楼级×5"硬门。
//   因此船坞/训练舱升级目前【暂无战斗外收益】、不再导出 shipLevelCap/driverLevelCap。
// TODO（第三块数值校准定）：给船坞/训练舱升级一条"升级成本折扣"线（方向：楼级越高、对应单位升级/升阶花费越省），
//   让"升楼"重新有用。届时在此新增 dockUpgradeCostDiscountPct / trainingUpgradeCostDiscountPct 等函数并接消费方。

// ===== 居住舱 habitat：离线存储上限 + 离线产率加成 =====
/** 离线存储上限（小时）：lv1=36（1.5天）→ lv10=48（2天封顶，守 §12 红线）。未解锁=0。 */
export function offlineStorageHours(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  if (lv === 0) return 0;
  return Math.round(36 + (lv - 1) * (12 / 9)); // 36→48 线性
}
/** 离线产率加成（百分比）：+2%/级（lv1=0 → lv10=+18%）；居民加成在 6b-4 叠加在此之上。 */
export function offlineRateBonusPct(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  if (lv === 0) return 0;
  return (lv - 1) * 2;
}

// ===== 打捞港 salvage_port：打捞队数量 1/2/3 =====
/** 打捞队数量：lv1-3=1 → lv4-6=2 → lv7-10=3（v1.0 §7「1→3」）。未解锁=0。 */
export function salvageTeamCount(salvageLevel: number): number {
  const lv = clampLevel(salvageLevel);
  if (lv === 0) return 0;
  if (lv < 4) return 1;
  if (lv < 7) return 2;
  return 3;
}

// ===== 研究塔 research_tower：全队属性小加成（minor_non_gate）=====
/** 全队主属性加成（百分比）：+1%/级 → lv10=+10%。建筑里仅有的"升楼变强"。 */
export function researchTeamBonusPct(researchLevel: number): number {
  return clampLevel(researchLevel) * 1;
}

// ===== 星核展厅 core_gallery：收藏图鉴加成（minor_non_gate）=====
/** 总加成上限（防收集很多种时无限叠，保持 minor）。 */
export const CORE_GALLERY_TOTAL_BONUS_CAP_PCT = 10;
/** 每种星核加成值（百分比）：随楼级 lv1=0.3% → lv10=0.6%。 */
export function coreGalleryPerTypeBonusPct(galleryLevel: number): number {
  const lv = clampLevel(galleryLevel);
  if (lv === 0) return 0;
  return 0.3 + (lv - 1) * (0.3 / 9); // 0.3→0.6
}
/** 展厅全队加成（百分比）= 每种加成值 × 已收集星核种数，封顶 CAP。"收集变强"。 */
export function coreGalleryTeamBonusPct(galleryLevel: number, distinctCoreCount: number): number {
  const lv = clampLevel(galleryLevel);
  if (lv === 0 || !Number.isFinite(distinctCoreCount) || distinctCoreCount <= 0) return 0;
  const raw = coreGalleryPerTypeBonusPct(lv) * Math.floor(distinctCoreCount);
  return Math.min(raw, CORE_GALLERY_TOTAL_BONUS_CAP_PCT);
}

// ===== 星港补给站 supply_station：抽卡 A级/3★ 出率加成（占位，并入 §10.1）=====
/** A级/3★ 出率加成（百分比）：+0.5%/级 → lv10=+5%。温和小幅；精确幅度并入 §10.1 抽卡平衡。 */
export function supplyGachaTopRateBonusPct(supplyLevel: number): number {
  return clampLevel(supplyLevel) * 0.5;
}

// ===== 商人小站 merchant_station：商品槽位（轮换格数·E 块用 merchantStockSlots）=====
// 注：每日免费刷新改为"固定基础 + 升级一次性赠送"(Ron 2026-06-21)，不再随楼级算每日上限——
//     原 merchantDailyFreeRefresh 已删；基础次数在 S7MerchantConfig.refresh.freePerCycle，升级赠送见 grantMerchantFreeRefresh。
/** 商品槽位数：lv1=2 → 每 2 级 +1，封顶 6。未解锁=0。 */
export function merchantShopSlots(merchantLevel: number): number {
  const lv = clampLevel(merchantLevel);
  if (lv === 0) return 0;
  return Math.min(2 + Math.floor((lv - 1) / 2), 6);
}
