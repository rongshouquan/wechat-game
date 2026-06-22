// 单舰装配（B 块，纯 TS，不依赖 cc）：给「某艘船」装/卸 插件·星核，按 v1.0 §5.3/§5.4 校验。
//
// 数据落点（v1.0 §4.4「每舰记忆 loadout」）：装配按 shipId 记在 squad.shipLoadouts，**与编队解耦**——
//   船下场/换格，装配仍跟着船保留。星核来源 = squad.ownedCores 计数；插件来源 = S7PluginInventory 实例。
//
// 规则（v1.0）：
//   §5.3 一船 3 槽（武器/技能/战术）：同类槽不堆叠、同名插件一船不重复、单实例同时只装一船（装到别船自动卸下）。
//   §5.4 一船最多 1 核；**同种核可多装·拥有 N 份可同时装 N 艘**（Ron 2026 改·原"一场只1个"作废）。
//
// 解耦：槽位类型(weapon/skill/tactical)是 plugin_config 的字段——core 层不读配置，由调用方注入 pluginSlotOf 解析器
//   (pluginId → slotTag)，本模块只用它判"同类槽"。所有操作「先校验、后修改」：校验不过不改任何状态。

import { S7SquadState, S7Loadout, coreOwnedCount, isShipOwned, isPilotOwned, findPilotShip, findPluginShip } from './S7Squad';
import { S7PluginInventoryState, findOwnedPlugin } from './S7PluginInventory';
import { S7PluginSlot } from '../../config/s7/ConfigTypesS7';

/** 一船插件槽上限（v1.0 §5.3：武器/技能/战术 各一）。 */
export const S7_MAX_PLUGINS_PER_SHIP = 3;

/** pluginId → 槽位类型 的解析器（调用方从 plugin_config 提供；查不到返回 undefined）。 */
export type S7PluginSlotResolver = (pluginId: string) => S7PluginSlot | undefined;

export type S7LoadoutErrorCode =
  | 'not_owned_ship'     // 未拥有该船（不能装配）
  | 'not_owned_pilot'    // 驾驶员未拥有
  | 'not_owned_plugin'   // 插件实例不在库存
  | 'unknown_plugin'     // 实例的 pluginId 在 plugin_config 查不到槽位
  | 'not_owned_core';    // 星核未拥有
// 注：插件「同类槽不堆叠/同名不重复/≤3」现由 equipPlugin「直接替换同类槽」保证，不再以错误码拦截。

export type S7LoadoutResult = { ok: true } | { ok: false; code: S7LoadoutErrorCode };

/** 取/建某船装配（就地建空装配并返回，供"先校验后改"阶段的写入用）。 */
function ensureLoadout(squad: S7SquadState, shipId: string): S7Loadout {
  let l = squad.shipLoadouts[shipId];
  if (!l) {
    l = { pilotId: null, coreId: null, pluginInstanceIds: [] };
    squad.shipLoadouts[shipId] = l;
  }
  return l;
}

/**
 * 给某船装一个插件实例（v1.0 §5.3 一船每类槽位仅 1 件·不堆叠）。校验拥有船/拥有插件/已知槽位，全过再改：
 *   ① 记下源船(该实例当前在哪艘船)和目标船"同类槽位"的原占位 X；
 *   ② 该实例从所有船卸下、目标船同类槽 X 也卸下；
 *   ③ 装到目标船；
 *   ④ **交换**：若该实例来自"别的船 B"且目标船原有 X → 把 X 装回 B（填 B 空出的同类槽）。
 *      若该实例本是空闲(无源船) → X 被替下回到空闲(无交换对象)。
 * 注：每类槽≤1 → 插件数永远 ≤3、同名(同 pluginId 必同槽)自然不重复——无需报错。
 */
export function equipPlugin(
  squad: S7SquadState,
  inv: S7PluginInventoryState,
  shipId: string,
  instanceId: string,
  pluginSlotOf: S7PluginSlotResolver,
): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const inst = findOwnedPlugin(inv, instanceId);
  if (!inst) return { ok: false, code: 'not_owned_plugin' };
  const slotTag = pluginSlotOf(inst.pluginId);
  if (!slotTag) return { ok: false, code: 'unknown_plugin' };

  const fromShip = findPluginShip(squad, instanceId); // 源船（本舰/别船/null）
  const target = ensureLoadout(squad, shipId);
  // 目标船同类槽原占位 X（≠自身）。
  const occupant = target.pluginInstanceIds.find((id) => {
    if (id === instanceId) return false;
    const o = findOwnedPlugin(inv, id);
    return !!o && pluginSlotOf(o.pluginId) === slotTag;
  }) ?? null;

  // 卸下该实例(全船) + 目标船 X。
  for (const l of Object.values(squad.shipLoadouts)) {
    const i = l.pluginInstanceIds.indexOf(instanceId);
    if (i >= 0) l.pluginInstanceIds.splice(i, 1);
  }
  if (occupant) {
    const i = target.pluginInstanceIds.indexOf(occupant);
    if (i >= 0) target.pluginInstanceIds.splice(i, 1);
  }
  // 装上。
  target.pluginInstanceIds.push(instanceId);
  // 交换：来自别船 + 目标原有 X → X 回填到源船同类槽（源船该槽已被实例腾空）。
  if (fromShip && fromShip !== shipId && occupant) {
    ensureLoadout(squad, fromShip).pluginInstanceIds.push(occupant);
  }
  return { ok: true };
}

/** 从某船卸下一个插件实例（未拥有船 → not_owned_ship；不在该船 → 幂等成功）。 */
export function unequipPlugin(squad: S7SquadState, shipId: string, instanceId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const l = squad.shipLoadouts[shipId];
  if (l) {
    const i = l.pluginInstanceIds.indexOf(instanceId);
    if (i >= 0) l.pluginInstanceIds.splice(i, 1);
  }
  return { ok: true };
}

/**
 * 给某船装一颗星核。先校验（拥有船/拥有核），全过再改：覆盖目标船原核装上（一船仍 1 核）。
 * 同种核可多装（Ron 2026·§5.4 改）：**拥有 N 份可同时装 N 艘**——别船已用满拥有份数则拦（不再从别船卸下）。
 */
export function equipCore(squad: S7SquadState, shipId: string, coreId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const ownedCount = coreOwnedCount(squad, coreId);
  if (ownedCount <= 0) return { ok: false, code: 'not_owned_core' };

  const target = ensureLoadout(squad, shipId);
  if (target.coreId === coreId) return { ok: true }; // 已装该核·幂等
  // 别船已装该核的船；份数没用满 → 直接占一份(多装)；份数用满 → 从其中一艘卸下挪过来(同时在场数 ≤ 拥有份数)。
  const usingShips: string[] = [];
  for (const [sid, l] of Object.entries(squad.shipLoadouts)) {
    if (sid !== shipId && l.coreId === coreId) usingShips.push(sid);
  }
  if (usingShips.length >= ownedCount && usingShips.length > 0) {
    squad.shipLoadouts[usingShips[0]].coreId = null; // 份数用满：从一艘别船卸下让位
  }
  target.coreId = coreId; // 装上（覆盖目标原核·原核回可用池）
  return { ok: true };
}

/** 从某船卸下星核（未拥有船 → not_owned_ship；否则置空·幂等）。 */
export function unequipCore(squad: S7SquadState, shipId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const l = squad.shipLoadouts[shipId];
  if (l) l.coreId = null;
  return { ok: true };
}

/**
 * 给某船配驾驶员（统一装配口·与插件/星核对称）。校验拥有船+拥有员；
 * 一员只驾一船：配到本船时从别船卸下。**交换**：若来自别船 B 且本舰原有驾驶员 → 原驾驶员回填到 B。
 */
export function equipPilot(squad: S7SquadState, shipId: string, pilotId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  if (!isPilotOwned(squad, pilotId)) return { ok: false, code: 'not_owned_pilot' };
  const fromShip = findPilotShip(squad, pilotId);     // 源船（本舰/别船/null）
  const target = ensureLoadout(squad, shipId);
  const occupant = target.pilotId;                    // 目标船原驾驶员
  for (const [sid, l] of Object.entries(squad.shipLoadouts)) {
    if (sid !== shipId && l.pilotId === pilotId) l.pilotId = null; // 从别船卸下
  }
  target.pilotId = pilotId;
  if (fromShip && fromShip !== shipId && occupant) ensureLoadout(squad, fromShip).pilotId = occupant;
  return { ok: true };
}

/** 从某船卸下驾驶员（未拥有船 → not_owned_ship；否则置空·幂等）。 */
export function unequipPilot(squad: S7SquadState, shipId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const l = squad.shipLoadouts[shipId];
  if (l) l.pilotId = null;
  return { ok: true };
}
