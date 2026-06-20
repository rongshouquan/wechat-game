// 单位阶级/星级存档（升阶升星块·纯 TS，不依赖 cc）：v1.0 §5.1/§6——
//   星舰「阶级」C→B→A（升阶=花专属碎片+通用舰碎片）→ 阶段性开槽（插件槽 1/2/3 + 星核槽）；
//   驾驶员「星级」1★→5★（升星=花专属碎片+通用员碎片）→ 解锁/深化驾驶能力。
//   两条独立于「等级」(S7UnitLevelState·花合金/记录) 的养成线；本模块只管阶级/星级状态 + 开槽规则 + 默认/规范化。
// 与配置解耦：不校验 unitId 是否存在。数值（每阶成本/战力涨幅）在 S7AscendConfig（v0.1 占位·第二块校准）。

/** 星舰阶级（C→B→A·灰盒 3 阶；顶级 S/SS 长线留第二块）。0=C 起。 */
export const SHIP_TIER_MIN = 0; // C
export const SHIP_TIER_MAX = 2; // A
export const SHIP_TIER_NAMES = ['C', 'B', 'A'] as const;
/** 驾驶员星级 1★–5★。 */
export const PILOT_STAR_MIN = 1;
export const PILOT_STAR_MAX = 5;

/** 阶级/星级状态：星舰 id→阶级(0-2)、驾驶员 id→星级(1-5)。不在表内 = 默认起点（C 阶 / 1★）。 */
export interface S7UnitTierState {
  shipTiers: Record<string, number>;
  pilotStars: Record<string, number>;
}

export function createDefaultS7UnitTierState(): S7UnitTierState {
  return { shipTiers: {}, pilotStars: {} };
}

function normMap(raw: unknown, min: number, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const [key, v] of Object.entries(src)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) continue;
    out[key] = v;
  }
  return out;
}

/** 规范化（防脏档）：星舰阶级取 [0,2]、星级取 [1,5] 内整数，越界/脏键丢弃。 */
export function normalizeS7UnitTierState(raw: unknown): S7UnitTierState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    shipTiers: normMap(src.shipTiers, SHIP_TIER_MIN, SHIP_TIER_MAX),
    pilotStars: normMap(src.pilotStars, PILOT_STAR_MIN, PILOT_STAR_MAX),
  };
}

/** 取星舰阶级：无记录=0(C)。 */
export function getShipTier(state: S7UnitTierState, shipId: string): number {
  const t = state.shipTiers[shipId];
  return typeof t === 'number' && Number.isInteger(t) && t >= SHIP_TIER_MIN && t <= SHIP_TIER_MAX ? t : SHIP_TIER_MIN;
}
/** 取驾驶员星级：无记录=1。 */
export function getPilotStar(state: S7UnitTierState, pilotId: string): number {
  const s = state.pilotStars[pilotId];
  return typeof s === 'number' && Number.isInteger(s) && s >= PILOT_STAR_MIN && s <= PILOT_STAR_MAX ? s : PILOT_STAR_MIN;
}
/** 设星舰阶级（夹 [0,2]）。 */
export function setShipTier(state: S7UnitTierState, shipId: string, tier: number): void {
  if (typeof shipId !== 'string' || shipId.length === 0) return;
  state.shipTiers[shipId] = Math.max(SHIP_TIER_MIN, Math.min(SHIP_TIER_MAX, Math.floor(tier)));
}
/** 设驾驶员星级（夹 [1,5]）。 */
export function setPilotStar(state: S7UnitTierState, pilotId: string, star: number): void {
  if (typeof pilotId !== 'string' || pilotId.length === 0) return;
  state.pilotStars[pilotId] = Math.max(PILOT_STAR_MIN, Math.min(PILOT_STAR_MAX, Math.floor(star)));
}

/** 阶级名（C/B/A·越界回退）。 */
export function shipTierName(tier: number): string {
  return SHIP_TIER_NAMES[Math.max(0, Math.min(SHIP_TIER_NAMES.length - 1, Math.floor(tier)))] ?? 'C';
}

// ===== 开槽规则（v1.0 §5.3/§6「升阶阶段性开槽」·真开槽 Ron 2026-06-21 拍板）=====
/** 该阶级开放的插件槽数：C=1 / B=2 / A=3。 */
export function shipPluginSlotCap(tier: number): number {
  const t = Math.max(SHIP_TIER_MIN, Math.min(SHIP_TIER_MAX, Math.floor(tier)));
  return t + 1; // 0→1,1→2,2→3
}
/** 该阶级是否开放星核槽：A 阶(2)起开。 */
export function shipCoreSlotOpen(tier: number): boolean {
  return Math.floor(tier) >= SHIP_TIER_MAX;
}
