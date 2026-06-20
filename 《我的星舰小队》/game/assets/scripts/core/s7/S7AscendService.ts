// 升阶/升星服务（纯 TS，不依赖 cc / Math.random / Date）：v1.0 §6。
//   星舰升阶：扣 该舰专属碎片 + 通用舰碎片(shipBlueprint) → 阶级+1 → 开更多插件槽 / A 阶开星核槽。
//   驾驶员升星：扣 该员专属碎片 + 通用员碎片(pilotShardUniversal) → 星级+1。
//   就地改 tierState / shards / resources（成功时）；失败不改任何状态。专属碎片走 S7ExclusiveShardInventory。

import {
  S7UnitTierState, getShipTier, setShipTier, getPilotStar, setPilotStar,
  SHIP_TIER_MAX, PILOT_STAR_MAX, shipPluginSlotCap, shipCoreSlotOpen,
} from './S7UnitTierState';
import { S7ExclusiveShardInventoryState, getExclusiveShardCount, spendExclusiveShards, addExclusiveShards } from './S7ExclusiveShardInventory';
import { S7AscendConfig } from './S7AscendConfig';

export type S7AscendFailReason = 'max_tier' | 'no_cost_row' | 'insufficient';

export type S7ShipAscendResult =
  | { ok: true; shipId: string; fromTier: number; toTier: number; spentExclusive: number; pluginSlots: number; coreSlot: boolean }
  | { ok: false; reason: S7AscendFailReason; shipId: string; needExclusive?: number };

/**
 * 星舰升阶 1 阶：**只扣该舰专属碎片**（通用碎片需先在背包转成专属·见 convertUniversalToExclusive）。阶级+1。
 * 到顶(SS)→max_tier；碎片不足→insufficient(带需求)。成功返回新阶开放的插件槽数 / 是否开星核槽。
 */
export function ascendShip(
  tierState: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  config: S7AscendConfig,
  shipId: string,
): S7ShipAscendResult {
  const fromTier = getShipTier(tierState, shipId);
  if (fromTier >= SHIP_TIER_MAX) return { ok: false, reason: 'max_tier', shipId };
  const cost = config.shipTierStepCost[fromTier];
  if (!cost) return { ok: false, reason: 'no_cost_row', shipId };
  if (getExclusiveShardCount(shards, shipId) < cost.exclusiveShards) {
    return { ok: false, reason: 'insufficient', shipId, needExclusive: cost.exclusiveShards };
  }
  spendExclusiveShards(shards, shipId, cost.exclusiveShards);
  const toTier = fromTier + 1;
  setShipTier(tierState, shipId, toTier);
  return { ok: true, shipId, fromTier, toTier, spentExclusive: cost.exclusiveShards, pluginSlots: shipPluginSlotCap(toTier), coreSlot: shipCoreSlotOpen(toTier) };
}

export type S7PilotStarupResult =
  | { ok: true; pilotId: string; fromStar: number; toStar: number; spentExclusive: number }
  | { ok: false; reason: S7AscendFailReason; pilotId: string; needExclusive?: number };

/**
 * 驾驶员升星 1 星：**只扣该员专属碎片**。到顶(5★)→max_tier；碎片不足→insufficient。
 */
export function starupPilot(
  tierState: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  config: S7AscendConfig,
  pilotId: string,
): S7PilotStarupResult {
  const fromStar = getPilotStar(tierState, pilotId);
  if (fromStar >= PILOT_STAR_MAX) return { ok: false, reason: 'max_tier', pilotId };
  const cost = config.pilotStarStepCost[fromStar - 1];
  if (!cost) return { ok: false, reason: 'no_cost_row', pilotId };
  if (getExclusiveShardCount(shards, pilotId) < cost.exclusiveShards) {
    return { ok: false, reason: 'insufficient', pilotId, needExclusive: cost.exclusiveShards };
  }
  spendExclusiveShards(shards, pilotId, cost.exclusiveShards);
  const toStar = fromStar + 1;
  setPilotStar(tierState, pilotId, toStar);
  return { ok: true, pilotId, fromStar, toStar, spentExclusive: cost.exclusiveShards };
}

// ===== 通用碎片 → 指定单位专属碎片（背包"使用"·Ron 2026-06-21·占位 1:1）=====
/** 通用碎片种类 → 钱包键。 */
const UNIVERSAL_KEY: Record<'ship' | 'pilot', string> = { ship: 'shipBlueprint', pilot: 'pilotShardUniversal' };

export type S7ConvertResult = { ok: true; converted: number } | { ok: false; reason: 'bad_amount' | 'insufficient' };

/**
 * 把 amount 个通用碎片（舰=shipBlueprint / 员=pilotShardUniversal）转成指定单位的专属碎片（占位 1:1）。
 * 就地扣钱包通用碎片、给 shards[unitId] 加专属。amount 非正/不足 → 失败不动。背包 UI 调（弹专属列表→选单位→拉条选量）。
 */
export function convertUniversalToExclusive(
  resources: Record<string, number>,
  shards: S7ExclusiveShardInventoryState,
  kind: 'ship' | 'pilot',
  unitId: string,
  amount: number,
): S7ConvertResult {
  if (!Number.isInteger(amount) || amount <= 0 || typeof unitId !== 'string' || unitId.length === 0) return { ok: false, reason: 'bad_amount' };
  const key = UNIVERSAL_KEY[kind];
  const have = typeof resources[key] === 'number' ? resources[key] : 0;
  if (have < amount) return { ok: false, reason: 'insufficient' };
  resources[key] = have - amount;
  addExclusiveShards(shards, unitId, amount); // 占位 1:1
  return { ok: true, converted: amount };
}
