// 建筑升级服务（块6b-2，纯 TS，不依赖 cc）：v1.0 §7「升级只花星矿、即时完成无等待」。
// 升级成本拍板（2026-06-18）：纯星矿，不再要"少量指定材料"（见设计 §7 / §17 变更记录）。
// 就地修改 state（等级 +1）与 resources（扣星矿）；本次升级的星矿成本由调用方传入——
// 真实星矿成本曲线 = 6b-3（届时新建 S7BuildingCost 模块算好喂进来），本服务成本无关、只管「校验 + 扣减 + 升级」机制。
// 与回收/合成服务同构：返回判别式结果，任一校验失败不改动任何状态（天然幂等、可安全重试）。

import { S7ResourceState } from '../../save/S7SaveService';
import {
  S7BuildingState,
  getBuildingLevel,
  canUpgradeBuilding,
  bumpBuildingLevel,
  isBuildingUnlocked,
  unlockBuilding,
} from './S7BuildingState';

export type S7BuildingUpgradeResult =
  | { ok: true; newLevel: number; starOreSpent: number }
  | { ok: false; code: 'not_unlocked' | 'max_level' | 'bad_cost' | 'insufficient_star_ore' };

export type S7BuildingUnlockResult =
  | { ok: true; starOreSpent: number }
  | { ok: false; code: 'already_unlocked' | 'bad_cost' | 'insufficient_star_ore' };

/**
 * 升级一个建筑：已解锁 → 未满级 → 成本合法 → 星矿够 → 扣星矿 + 升 1 级。
 * @param cost 本次升级（当前级 → 下一级）的星矿花费，由 6b-3 成本模块算好传入；须为非负整数。
 * 任一校验失败返回对应 code 且不改动 state/resources。
 */
export function upgradeBuilding(
  state: S7BuildingState,
  resources: S7ResourceState,
  buildingId: string,
  cost: number,
): S7BuildingUpgradeResult {
  if (getBuildingLevel(state, buildingId) < 1) return { ok: false, code: 'not_unlocked' };
  if (!canUpgradeBuilding(state, buildingId)) return { ok: false, code: 'max_level' };
  if (typeof cost !== 'number' || !Number.isInteger(cost) || cost < 0) return { ok: false, code: 'bad_cost' };
  if (resources.starOre < cost) return { ok: false, code: 'insufficient_star_ore' };
  resources.starOre -= cost;
  bumpBuildingLevel(state, buildingId);
  return { ok: true, newLevel: getBuildingLevel(state, buildingId), starOreSpent: cost };
}

/**
 * 花星矿解锁一栋建筑（新手引导 M1 用：船坞/训练舱解锁不再免费，需真花星矿）。
 * 已解锁 → 已解锁不变；成本合法 → 星矿够 → 扣星矿 + 解锁(lv1)。
 * @param cost 本次解锁的星矿花费，由调用方传入（M1 暂用 GDD 占位值 50，第二块校准）；须为非负整数。
 * 任一校验失败返回对应 code 且不改动 state/resources（与 upgradeBuilding 同构·幂等可安全重试）。
 */
export function unlockBuildingWithStarOre(
  state: S7BuildingState,
  resources: S7ResourceState,
  buildingId: string,
  cost: number,
): S7BuildingUnlockResult {
  if (isBuildingUnlocked(state, buildingId)) return { ok: false, code: 'already_unlocked' };
  if (typeof cost !== 'number' || !Number.isInteger(cost) || cost < 0) return { ok: false, code: 'bad_cost' };
  if (resources.starOre < cost) return { ok: false, code: 'insufficient_star_ore' };
  resources.starOre -= cost;
  unlockBuilding(state, buildingId);
  return { ok: true, starOreSpent: cost };
}
