// 单舰深装（B 块，纯 TS，不依赖 cc）：在编队某船位上「装/卸」插件·星核，按 v1.0 §5.3/§5.4 校验。
//
// 数据落点：
//   - 插件 = 实例（S7PluginInventory 的 instanceId）→ 装到 formation slot 的 pluginInstanceIds。
//   - 星核 = 拥有计数（squad.ownedCores: coreId→数）→ 装到 slot.coreId（一船 1 核）。
//
// 规则（v1.0）：
//   §5.3 一船 3 槽（武器/技能/战术）：同类槽不堆叠、同名插件一船不重复、单实例同时只装一船（装到别船自动卸下）。
//   §5.4 一船最多 1 核、同名核一场只 1 个（同一 coreId 装到别船自动从原船卸下）。
//
// 解耦：槽位类型(weapon/skill/tactical)是 plugin_config 的字段——core 层不读配置，由调用方注入 pluginSlotOf 解析器
//   (pluginId → slotTag)，本模块只用它判"同类槽"。所有操作「先校验、后修改」：校验不过不改任何状态。

import { S7SquadState, S7FormationSlot, coreOwnedCount } from './S7Squad';
import { S7PluginInventoryState, findOwnedPlugin } from './S7PluginInventory';
import { S7PluginSlot } from '../../config/s7/ConfigTypesS7';

/** 一船插件槽上限（v1.0 §5.3：武器/技能/战术 各一）。 */
export const S7_MAX_PLUGINS_PER_SHIP = 3;

/** pluginId → 槽位类型 的解析器（调用方从 plugin_config 提供；查不到返回 undefined）。 */
export type S7PluginSlotResolver = (pluginId: string) => S7PluginSlot | undefined;

export type S7LoadoutErrorCode =
  | 'no_slot'            // 该船位不存在或没放船（空格不能深装）
  | 'not_owned_plugin'   // 插件实例不在库存
  | 'unknown_plugin'     // 实例的 pluginId 在 plugin_config 查不到槽位
  | 'slot_type_occupied' // 同类槽已被别的插件占（不堆叠）
  | 'dup_plugin'         // 同名插件本船已装
  | 'too_many_plugins'   // 本船插件已满 3
  | 'not_owned_core';    // 星核未拥有

export type S7LoadoutResult = { ok: true } | { ok: false; code: S7LoadoutErrorCode };

/** 找"存在且放了船"的船位；空格/不存在返回 null。 */
function shipSlot(squad: S7SquadState, slotRef: string): S7FormationSlot | null {
  const s = squad.formation.find((x) => x.slotRef === slotRef);
  return s && typeof s.shipId === 'string' && s.shipId.length > 0 ? s : null;
}

/** 解析某船位已装插件实例的槽位类型（跳过库存/配置里查不到的，防脏档拖垮判定）。 */
function equippedSlotInfo(
  slot: S7FormationSlot,
  inv: S7PluginInventoryState,
  pluginSlotOf: S7PluginSlotResolver,
): { instanceId: string; pluginId: string; slotTag: S7PluginSlot }[] {
  const out: { instanceId: string; pluginId: string; slotTag: S7PluginSlot }[] = [];
  for (const id of slot.pluginInstanceIds) {
    const inst = findOwnedPlugin(inv, id);
    if (!inst) continue;
    const slotTag = pluginSlotOf(inst.pluginId);
    if (!slotTag) continue;
    out.push({ instanceId: id, pluginId: inst.pluginId, slotTag });
  }
  return out;
}

/**
 * 在某船位装一个插件实例。先校验（船位/拥有/槽位/不堆叠/不重名/≤3），全过再改：
 * 把该实例从所有船位卸下（单实例独占·含幂等重装），再装到目标船位。
 */
export function equipPlugin(
  squad: S7SquadState,
  inv: S7PluginInventoryState,
  slotRef: string,
  instanceId: string,
  pluginSlotOf: S7PluginSlotResolver,
): S7LoadoutResult {
  const target = shipSlot(squad, slotRef);
  if (!target) return { ok: false, code: 'no_slot' };
  const inst = findOwnedPlugin(inv, instanceId);
  if (!inst) return { ok: false, code: 'not_owned_plugin' };
  const slotTag = pluginSlotOf(inst.pluginId);
  if (!slotTag) return { ok: false, code: 'unknown_plugin' };

  // 目标船位「除自身外」已装的插件（自身=幂等重装，不算冲突）。
  // 校验顺序：先同名(dup_plugin，最具体)→ 再同槽(slot_type_occupied)→ 再满槽(too_many，防脏档兜底)。
  // 注：同 pluginId 必同槽，若同槽先判会让 dup_plugin 永不可达，故 dup 在前。
  const others = equippedSlotInfo(target, inv, pluginSlotOf).filter((e) => e.instanceId !== instanceId);
  if (others.some((e) => e.pluginId === inst.pluginId)) return { ok: false, code: 'dup_plugin' };
  if (others.some((e) => e.slotTag === slotTag)) return { ok: false, code: 'slot_type_occupied' };
  if (others.length >= S7_MAX_PLUGINS_PER_SHIP) return { ok: false, code: 'too_many_plugins' };

  // 校验全过 → 改状态：先全局卸下该实例（独占），再装到目标。
  for (const s of squad.formation) {
    const i = s.pluginInstanceIds.indexOf(instanceId);
    if (i >= 0) s.pluginInstanceIds.splice(i, 1);
  }
  target.pluginInstanceIds.push(instanceId);
  return { ok: true };
}

/** 从某船位卸下一个插件实例（船位不存在/没船 → no_slot；不在该位 → 幂等成功）。 */
export function unequipPlugin(squad: S7SquadState, slotRef: string, instanceId: string): S7LoadoutResult {
  const target = shipSlot(squad, slotRef);
  if (!target) return { ok: false, code: 'no_slot' };
  const i = target.pluginInstanceIds.indexOf(instanceId);
  if (i >= 0) target.pluginInstanceIds.splice(i, 1);
  return { ok: true };
}

/**
 * 在某船位装一颗星核。先校验（船位/拥有），全过再改：
 * 把同一 coreId 从别的船位卸下（§5.4 同名核一场只 1 个），再装到目标船位（一船 1 核·覆盖原核）。
 */
export function equipCore(squad: S7SquadState, slotRef: string, coreId: string): S7LoadoutResult {
  const target = shipSlot(squad, slotRef);
  if (!target) return { ok: false, code: 'no_slot' };
  if (coreOwnedCount(squad, coreId) <= 0) return { ok: false, code: 'not_owned_core' };

  for (const s of squad.formation) {
    if (s !== target && s.coreId === coreId) s.coreId = null; // 同名核从别船卸下
  }
  target.coreId = coreId;
  return { ok: true };
}

/** 从某船位卸下星核（船位不存在/没船 → no_slot；否则置空·幂等）。 */
export function unequipCore(squad: S7SquadState, slotRef: string): S7LoadoutResult {
  const target = shipSlot(squad, slotRef);
  if (!target) return { ok: false, code: 'no_slot' };
  target.coreId = null;
  return { ok: true };
}
