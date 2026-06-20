// 单舰装配（B 块，纯 TS，不依赖 cc）：给「某艘船」装/卸 插件·星核，按 v1.0 §5.3/§5.4 校验。
//
// 数据落点（v1.0 §4.4「每舰记忆 loadout」）：装配按 shipId 记在 squad.shipLoadouts，**与编队解耦**——
//   船下场/换格，装配仍跟着船保留。星核来源 = squad.ownedCores 计数；插件来源 = S7PluginInventory 实例。
//
// 规则（v1.0）：
//   §5.3 一船 3 槽（武器/技能/战术）：同类槽不堆叠、同名插件一船不重复、单实例同时只装一船（装到别船自动卸下）。
//   §5.4 一船最多 1 核、同名核一场只 1 个（同一 coreId 装到别船自动从原船卸下）。
//
// 解耦：槽位类型(weapon/skill/tactical)是 plugin_config 的字段——core 层不读配置，由调用方注入 pluginSlotOf 解析器
//   (pluginId → slotTag)，本模块只用它判"同类槽"。所有操作「先校验、后修改」：校验不过不改任何状态。

import { S7SquadState, S7Loadout, coreOwnedCount, isShipOwned, isPilotOwned, setShipPilot } from './S7Squad';
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
 *   ① 该实例从所有船卸下（单实例独占·含幂等重装）；
 *   ② **直接替换**：把目标船上"同类槽位"的占位插件卸下（被替下的回到空闲）；
 *   ③ 装到目标船。
 * 注：因每类槽≤1，故插件数永远 ≤3、同名(同 pluginId 必同槽)自然不重复——无需 slot_type_occupied/dup/too_many 报错。
 *   "已在别船"的二次确认是表现层(demo)的事，本层只管"装就替换"。
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

  // ① 该实例从所有船卸下（独占·跨所有船·含从目标船自身去重）。
  for (const l of Object.values(squad.shipLoadouts)) {
    const i = l.pluginInstanceIds.indexOf(instanceId);
    if (i >= 0) l.pluginInstanceIds.splice(i, 1);
  }
  const target = ensureLoadout(squad, shipId);
  // ② 替换：移除目标船上同类槽位的其它插件（被替下→空闲）。
  target.pluginInstanceIds = target.pluginInstanceIds.filter((id) => {
    const o = findOwnedPlugin(inv, id);
    const tag = o ? pluginSlotOf(o.pluginId) : undefined;
    return tag !== slotTag; // 同类槽的占位插件被替换掉；其余保留
  });
  // ③ 装上。
  target.pluginInstanceIds.push(instanceId);
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
 * 给某船装一颗星核。先校验（拥有船/拥有核），全过再改：
 * 把同一 coreId 从别的船卸下（§5.4 同名核一场只 1 个），再装到目标船（一船 1 核·覆盖原核）。
 */
export function equipCore(squad: S7SquadState, shipId: string, coreId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  if (coreOwnedCount(squad, coreId) <= 0) return { ok: false, code: 'not_owned_core' };

  for (const [sid, l] of Object.entries(squad.shipLoadouts)) {
    if (sid !== shipId && l.coreId === coreId) l.coreId = null; // 同名核从别船卸下
  }
  ensureLoadout(squad, shipId).coreId = coreId;
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
 * 唯一性：一员只驾一船 → 配到本船时从别船自动卸下（setShipPilot 处理）。
 */
export function equipPilot(squad: S7SquadState, shipId: string, pilotId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  if (!isPilotOwned(squad, pilotId)) return { ok: false, code: 'not_owned_pilot' };
  setShipPilot(squad, shipId, pilotId);
  return { ok: true };
}

/** 从某船卸下驾驶员（未拥有船 → not_owned_ship；否则置空·幂等）。 */
export function unequipPilot(squad: S7SquadState, shipId: string): S7LoadoutResult {
  if (!isShipOwned(squad, shipId)) return { ok: false, code: 'not_owned_ship' };
  const l = squad.shipLoadouts[shipId];
  if (l) l.pilotId = null;
  return { ok: true };
}
