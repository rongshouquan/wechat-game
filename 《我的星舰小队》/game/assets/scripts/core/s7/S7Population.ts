// 基地人口（块6b-4b，纯 TS，不依赖 cc）：居民 + 工人 的存档状态 + 效果。v1.0 §7「基地人口」。
//   居民：① 离线收益 +X%；② 离线存储时间 +X（让基地更热闹、产出更多）。
//   工人：减少建筑升级所需材料（本作 = 星矿成本）-X%。
// 与 S7BuildingState 同构：本模块拥有人口子状态形状 + createDefault/normalize + 效果函数，S7SaveService 组合进 S7PlayerState。
// 接线：居民效果经 S7OfflineProduction 的 extraRateBonusPct/extraStorageHours 注入；工人折扣应用在 S7BuildingCost 之上。
// 居民/工人的"数量"来自主线救回 / 7 天扩张（内容侧，后续给）；本层先把状态与效果立起来，数量默认 0。
// 数值 v0.1 待原型校准；上限刻意收紧——尤其居民"存储延长"，守 §12/§16「少玩 3-4 天明显落后」红线
// （居住舱最高 48h + 居民最高 +12h = 60h ≈ 2.5 天上限，仍低于 3-4 天）。

export interface S7PopulationState {
  residents: number;
  workers: number;
}

export function createDefaultS7Population(): S7PopulationState {
  return { residents: 0, workers: 0 };
}

function toCount(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** 规范化：residents/workers 仅取非负整数，否则落 0（防脏档/篡改）。 */
export function normalizeS7Population(raw: unknown): S7PopulationState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { residents: toCount(src.residents), workers: toCount(src.workers) };
}

// ===== 居民效果（v0.1）=====
const RESIDENT_RATE_PCT_PER = 1; // +1% 离线产率/居民
const RESIDENT_RATE_PCT_CAP = 40; // 封顶 +40%
const RESIDENT_STORAGE_HOURS_PER = 0.25; // +0.25h(15min) 离线存储/居民
const RESIDENT_STORAGE_HOURS_CAP = 12; // 封顶 +12h（守红线：居住舱48h + 12h = 60h≈2.5天）

/** 居民给的离线产率加成（百分比，封顶）。喂 S7OfflineProduction.extraRateBonusPct。 */
export function residentRateBonusPct(residentCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(residentCount) ? residentCount : 0));
  return Math.min(n * RESIDENT_RATE_PCT_PER, RESIDENT_RATE_PCT_CAP);
}
/** 居民给的离线存储延长（小时，封顶）。喂 S7OfflineProduction.extraStorageHours。 */
export function residentStorageExtensionHours(residentCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(residentCount) ? residentCount : 0));
  return Math.min(n * RESIDENT_STORAGE_HOURS_PER, RESIDENT_STORAGE_HOURS_CAP);
}

// ===== 工人效果（v0.1）=====
const WORKER_DISCOUNT_PCT_PER = 0.5; // -0.5% 建筑升级星矿/工人
const WORKER_DISCOUNT_PCT_CAP = 30; // 封顶 -30%（不让建筑白送）

/** 工人给的建筑升级成本减免（百分比，封顶）。 */
export function workerCostDiscountPct(workerCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(workerCount) ? workerCount : 0));
  return Math.min(n * WORKER_DISCOUNT_PCT_PER, WORKER_DISCOUNT_PCT_CAP);
}
/** 把工人折扣应用到建筑升级星矿成本（向下取整，不低于 0）。调用方：applyWorkerDiscount(buildingUpgradeStarOreCost(...), workers)。 */
export function applyWorkerDiscount(baseCost: number, workerCount: number): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return Math.max(0, Math.floor(baseCost || 0));
  return Math.max(0, Math.floor(baseCost * (1 - workerCostDiscountPct(workerCount) / 100)));
}
