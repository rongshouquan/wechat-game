// 单位等级存档（C1b 升级变强 步1，纯 TS，不依赖 cc）：v1.0 §6 升级——记录每艘星舰 / 每名驾驶员的当前等级。
//   星舰升级花星舰合金、驾驶员升级花驾驶记录（成本表 upgrade_cost_param，扣费逻辑在升级服务·步3）；
//   等级→战斗变强经"成长积木"(步2 S7UnitGrowth)织入战斗(步4 装配器)。本模块只管"等级状态"的存档结构与读写。
// 与 S7BuildingState 同构：本模块拥有子状态形状 + createDefault/normalize + 纯操作，S7SaveService 组合进 S7PlayerState。
// 与配置解耦：不校验 shipId/pilotId 是否存在于 ship_config/pilot_config（那是装配/运行时的事）。

/** 单位等级下界（任何单位至少 1 级）。 */
export const S7_UNIT_MIN_LEVEL = 1;
/**
 * 单位等级绝对上界（段二 A3·Ron 2026-07-11 晚拍板：上限 100→50 舰/员两线同改·SS/5★=50 为全局天花板）。
 * 每个单位的实际上限由阶级算（S7UnitTierState.shipLevelCapForTier / pilotLevelCapForStar：C10/B20/A30/S40/SS50）；
 * 这里的 50 只是"任何单位都不可能超过"的绝对红线（存档规范化 / setLevel 夹紧 / 成长曲线共用它防越界）。
 * 51-100 段＝封存未来版本（growth_band/成本表/大节点 L60-100 内容数据保留不删，上限钳死即不可达）。
 */
export const S7_UNIT_MAX_LEVEL = 50;

/** 单位等级状态：星舰 / 驾驶员各一本"id→等级(1..50)"账本。不在表内 = 默认 1 级。 */
export interface S7UnitLevelState {
  shipLevels: Record<string, number>;
  pilotLevels: Record<string, number>;
}

export function createDefaultS7UnitLevelState(): S7UnitLevelState {
  return { shipLevels: {}, pilotLevels: {} };
}

/** 规范化单本账本：只保留 key 非空字符串、等级为 [1,100] 内整数的项；越界/非整数/脏键/原型污染键丢弃。 */
function normalizeLevelMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const [key, v] of Object.entries(src)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue; // 防原型污染
    if (typeof v !== 'number' || !Number.isInteger(v)) continue;
    if (v < S7_UNIT_MIN_LEVEL || v > S7_UNIT_MAX_LEVEL) continue;
    out[key] = v;
  }
  return out;
}

/** 规范化单位等级状态（防脏档/篡改把非法等级带进运行时）。 */
export function normalizeS7UnitLevelState(raw: unknown): S7UnitLevelState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    shipLevels: normalizeLevelMap(src.shipLevels),
    pilotLevels: normalizeLevelMap(src.pilotLevels),
  };
}

function getLevel(map: Record<string, number>, id: string): number {
  const lv = map[id];
  return typeof lv === 'number' && Number.isInteger(lv) && lv >= S7_UNIT_MIN_LEVEL ? lv : S7_UNIT_MIN_LEVEL;
}
function setLevel(map: Record<string, number>, id: string, level: number): void {
  if (typeof id !== 'string' || id.length === 0) return;
  const clamped = Math.max(S7_UNIT_MIN_LEVEL, Math.min(S7_UNIT_MAX_LEVEL, Math.floor(level)));
  map[id] = clamped;
}

/** 取某星舰等级：有记录返回 1-100，无记录返回默认 1。 */
export function getShipLevel(state: S7UnitLevelState, shipId: string): number {
  return getLevel(state.shipLevels, shipId);
}
/** 取某驾驶员等级：有记录返回 1-100，无记录返回默认 1。 */
export function getPilotLevel(state: S7UnitLevelState, pilotId: string): number {
  return getLevel(state.pilotLevels, pilotId);
}
/** 设星舰等级（夹紧到 [1,100]、向下取整）。升级服务(步3)用;此处只改等级、不扣费。 */
export function setShipLevel(state: S7UnitLevelState, shipId: string, level: number): void {
  setLevel(state.shipLevels, shipId, level);
}
/** 设驾驶员等级（夹紧到 [1,100]、向下取整）。 */
export function setPilotLevel(state: S7UnitLevelState, pilotId: string, level: number): void {
  setLevel(state.pilotLevels, pilotId, level);
}
