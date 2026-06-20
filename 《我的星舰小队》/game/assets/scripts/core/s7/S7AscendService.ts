// 升阶/升星服务（纯 TS，不依赖 cc / Math.random / Date）：v1.0 §6。
//   星舰升阶：扣 该舰专属碎片 + 通用舰碎片(shipBlueprint) → 阶级+1 → 开更多插件槽 / A 阶开星核槽。
//   驾驶员升星：扣 该员专属碎片 + 通用员碎片(pilotShardUniversal) → 星级+1。
//   就地改 tierState / shards / resources（成功时）；失败不改任何状态。专属碎片走 S7ExclusiveShardInventory。

import {
  S7UnitTierState, getShipTier, setShipTier, getPilotStar, setPilotStar,
  SHIP_TIER_MAX, PILOT_STAR_MAX, shipPluginSlotCap, shipCoreSlotOpen,
} from './S7UnitTierState';
import { S7ExclusiveShardInventoryState, getExclusiveShardCount, spendExclusiveShards } from './S7ExclusiveShardInventory';
import { S7AscendConfig } from './S7AscendConfig';

export type S7AscendFailReason = 'max_tier' | 'no_cost_row' | 'insufficient';

export type S7ShipAscendResult =
  | { ok: true; shipId: string; fromTier: number; toTier: number; spentExclusive: number; spentBlueprint: number; pluginSlots: number; coreSlot: boolean }
  | { ok: false; reason: S7AscendFailReason; shipId: string; needExclusive?: number; needBlueprint?: number };

/**
 * 星舰升阶 1 阶：扣该舰专属碎片 + 通用舰碎片(shipBlueprint)，阶级+1。
 * 到顶(A)→max_tier；碎片不足→insufficient(带需求)。成功返回新阶开放的插件槽数 / 是否开星核槽。
 */
export function ascendShip(
  tierState: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  resources: Record<string, number>,
  config: S7AscendConfig,
  shipId: string,
): S7ShipAscendResult {
  const fromTier = getShipTier(tierState, shipId);
  if (fromTier >= SHIP_TIER_MAX) return { ok: false, reason: 'max_tier', shipId };
  const cost = config.shipTierStepCost[fromTier];
  if (!cost) return { ok: false, reason: 'no_cost_row', shipId };
  const haveShard = getExclusiveShardCount(shards, shipId);
  const haveBp = typeof resources.shipBlueprint === 'number' ? resources.shipBlueprint : 0;
  if (haveShard < cost.exclusiveShards || haveBp < cost.shipBlueprint) {
    return { ok: false, reason: 'insufficient', shipId, needExclusive: cost.exclusiveShards, needBlueprint: cost.shipBlueprint };
  }
  spendExclusiveShards(shards, shipId, cost.exclusiveShards);
  resources.shipBlueprint = haveBp - cost.shipBlueprint;
  const toTier = fromTier + 1;
  setShipTier(tierState, shipId, toTier);
  return { ok: true, shipId, fromTier, toTier, spentExclusive: cost.exclusiveShards, spentBlueprint: cost.shipBlueprint, pluginSlots: shipPluginSlotCap(toTier), coreSlot: shipCoreSlotOpen(toTier) };
}

export type S7PilotStarupResult =
  | { ok: true; pilotId: string; fromStar: number; toStar: number; spentExclusive: number; spentUniversal: number }
  | { ok: false; reason: S7AscendFailReason; pilotId: string; needExclusive?: number; needUniversal?: number };

/**
 * 驾驶员升星 1 星：扣该员专属碎片 + 通用员碎片(pilotShardUniversal)，星级+1。到顶(5★)→max_tier；碎片不足→insufficient。
 */
export function starupPilot(
  tierState: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  resources: Record<string, number>,
  config: S7AscendConfig,
  pilotId: string,
): S7PilotStarupResult {
  const fromStar = getPilotStar(tierState, pilotId);
  if (fromStar >= PILOT_STAR_MAX) return { ok: false, reason: 'max_tier', pilotId };
  const cost = config.pilotStarStepCost[fromStar - 1];
  if (!cost) return { ok: false, reason: 'no_cost_row', pilotId };
  const haveShard = getExclusiveShardCount(shards, pilotId);
  const haveUni = typeof resources.pilotShardUniversal === 'number' ? resources.pilotShardUniversal : 0;
  if (haveShard < cost.exclusiveShards || haveUni < cost.pilotShardUniversal) {
    return { ok: false, reason: 'insufficient', pilotId, needExclusive: cost.exclusiveShards, needUniversal: cost.pilotShardUniversal };
  }
  spendExclusiveShards(shards, pilotId, cost.exclusiveShards);
  resources.pilotShardUniversal = haveUni - cost.pilotShardUniversal;
  const toStar = fromStar + 1;
  setPilotStar(tierState, pilotId, toStar);
  return { ok: true, pilotId, fromStar, toStar, spentExclusive: cost.exclusiveShards, spentUniversal: cost.pilotShardUniversal };
}
