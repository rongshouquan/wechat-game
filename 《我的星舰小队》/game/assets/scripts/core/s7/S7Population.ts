// 基地人口（步5 收尾批回写·纯 TS，不依赖 cc）：居民 + 工人 的存档状态 + 效果。
//   居民：① 离线收益 +X%；② 离线存储时间 +X（让基地更热闹、产出更多）。
//   工人：减少建筑升级成本——步5 起走 S7BuildingEffects.workerBuildDiscountPct（细案③费率新规），
//   本模块旧 −0.5%/人 常量线已退役。
// 人口口径（细案③·2026-07-09 Ron 重定）：**数量无上限**（永远收得进、"满了收不进"从根上消失）；
//   居住舱等级＝**有效编制** 6+2/级（S7BuildingEffects.habitatStaffCap·Lv10=26 人贡献数值），
//   **超编居民/工人＝纯人气不加成**——效果函数内按编制截断。
// 与 S7BuildingState 同构：本模块拥有人口子状态形状 + createDefault/normalize + 效果函数，S7SaveService 组合进 S7PlayerState。
// 数值终值 = 初值表 v0.7（机器真源 simulate-s7-economy.mjs：产率 +1%/居民·存储 +0.5h/居民封顶 +6h）。

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

// ===== 居民效果（v0.7 校准终值·编制内才生效）=====
const RESIDENT_RATE_PCT_PER = 1; // +1% 离线产率/居民（编制内）
const RESIDENT_STORAGE_HOURS_PER = 0.5; // +0.5h 离线存储/居民（编制内）
const RESIDENT_STORAGE_HOURS_CAP = 6; // 封顶 +6h（机器真源 min(6, residents×0.5)·守追赶红线）

/** 有效居民/工人数：按居住舱有效编制截断（超编纯人气·细案③）。 */
export function effectiveStaff(count: number, staffCap: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return Math.min(n, Math.max(0, Math.floor(staffCap || 0)));
}

/** 居民给的离线产率加成（百分比·编制内 +1%/人）。喂 S7OfflineProduction.extraRateBonusPct。
 *  staffCap = S7BuildingEffects.habitatStaffCap(居住舱等级)。 */
export function residentRateBonusPct(residentCount: number, staffCap: number): number {
  return effectiveStaff(residentCount, staffCap) * RESIDENT_RATE_PCT_PER;
}
/** 居民给的离线存储延长（小时·编制内 +0.5h/人·封顶 +6h）。喂 S7OfflineProduction.extraStorageHours。 */
export function residentStorageExtensionHours(residentCount: number, staffCap: number): number {
  return Math.min(effectiveStaff(residentCount, staffCap) * RESIDENT_STORAGE_HOURS_PER, RESIDENT_STORAGE_HOURS_CAP);
}

// 工人建筑折扣：见 S7BuildingEffects.workerBuildDiscountPct（细案③·居住舱 Lv3 门+费率升档+封顶25%）。
// 旧 workerCostDiscountPct/applyWorkerDiscount（−0.5%/人封顶30·无门槛）已随步5 回写退役。
