// 建筑运行时状态（块6b-2，纯 TS，不依赖 cc）：v1.0 §7 基地建筑的存档载体 + 升级骨架。
// 拥有的建筑 = buildingId → 当前等级(1-10)：在表内 = 已解锁（蓝图获得即激活 1 级），不在 = 未解锁/未建。
// 与 S7PluginInventory 同构：本模块拥有建筑子状态的形状 + createDefault/normalize + 纯操作，
// S7SaveService 组合进 S7PlayerState；升级时的资源扣减（花星矿）在 S7BuildingUpgradeService。
// 与配置解耦：不校验 buildingId 是否存在于 building_config（那是装配/运行时的事，本存档层与配置解耦）。

/** 建筑等级下界（解锁即 1 级）。 */
export const S7_BUILDING_MIN_LEVEL = 1;
/** 建筑等级上界（v1.0 §7：建筑 1-10 级）。 */
export const S7_BUILDING_MAX_LEVEL = 10;

/** 建筑子状态：buildingId → 当前等级(1..10)。在表内 = 已解锁；不在 = 未解锁/未建。 */
export interface S7BuildingState {
  levels: Record<string, number>;
}

/** 默认空建筑状态（新档无任何建筑，靠主线/教程解锁时再 unlockBuilding 加进来）。 */
export function createDefaultS7BuildingState(): S7BuildingState {
  return { levels: {} };
}

/**
 * 规范化建筑状态：只保留「key 为非空字符串、等级为 [MIN,MAX] 内整数」的项；
 * 越界等级 / 非整数 / 脏键一律丢弃，防脏档/篡改把非法等级带进运行时。与配置解耦（不校验 buildingId 是否存在）。
 */
export function normalizeS7BuildingState(raw: unknown): S7BuildingState {
  const out = createDefaultS7BuildingState();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const levels = (src.levels && typeof src.levels === 'object') ? (src.levels as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(levels)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue; // 防原型污染
    if (typeof v !== 'number' || !Number.isInteger(v)) continue;
    if (v < S7_BUILDING_MIN_LEVEL || v > S7_BUILDING_MAX_LEVEL) continue;
    out.levels[key] = v;
  }
  return out;
}

/** 该建筑是否已解锁（在表内）。 */
export function isBuildingUnlocked(state: S7BuildingState, buildingId: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.levels, buildingId);
}

/** 取建筑等级：已解锁返回 1-10；未解锁返回 0。 */
export function getBuildingLevel(state: S7BuildingState, buildingId: string): number {
  const lv = state.levels[buildingId];
  return typeof lv === 'number' ? lv : 0;
}

/** 解锁建筑（蓝图获得即激活 1 级）。已解锁 = 幂等不变。返回是否本次新解锁。 */
export function unlockBuilding(state: S7BuildingState, buildingId: string): boolean {
  if (isBuildingUnlocked(state, buildingId)) return false;
  state.levels[buildingId] = S7_BUILDING_MIN_LEVEL;
  return true;
}

/** 是否可升级：已解锁且未满级。 */
export function canUpgradeBuilding(state: S7BuildingState, buildingId: string): boolean {
  const lv = getBuildingLevel(state, buildingId);
  return lv >= S7_BUILDING_MIN_LEVEL && lv < S7_BUILDING_MAX_LEVEL;
}

/** 升 1 级（仅改等级、不含资源校验；资源扣减在 S7BuildingUpgradeService）。可升则 +1 返回 true；未解锁/已满级返回 false。 */
export function bumpBuildingLevel(state: S7BuildingState, buildingId: string): boolean {
  if (!canUpgradeBuilding(state, buildingId)) return false;
  state.levels[buildingId] += 1;
  return true;
}
