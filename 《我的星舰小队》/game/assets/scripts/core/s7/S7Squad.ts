// 阵容/编队（阶段一 A-step1，纯 TS，不依赖 cc）：v1.0 §4.4「战前编队：3×3 上阵 5 舰、每舰必配驾驶员、每舰记忆 loadout」。
//
// 本模块拥有几件事的状态形状 + 默认/规范化 + 操作/校验/转换：
//   ① 玩家"拥有"：星舰/驾驶员=拥有集合(本体单一，靠升阶/升星养)；星核=实例计数(coreId→拥有数)；插件实例库存另由 S7PluginInventory 管。
//   ② 编队：≤5 个上阵位，每位 = 星舰在哪格（slotRef + shipId）。驾驶员不在格上、跟船记忆（见 ③）。
//   ③ 单舰装配 shipLoadouts（v1.0 §4.4「每舰记忆 loadout」）：驾驶员 + 星核 + 插件实例按 shipId 记忆，**与编队解耦** → 下场/换位都跟着船、不丢；装/卸由 S7ShipLoadout（插件/星核）+ 本模块（驾驶员）操作。
//   ④ buildSquadLineup：把编队 + 各舰装配校验后转成 S7BattleEncounterAssembler 吃的出战阵容（注入星舰等级；给了库存则把插件实例解析成 {pluginId,quality} 喂战斗）。
//
// 边界：core 层自包含——只依赖同族 S7* + 中性结构；不 import save（由 S7SaveService 组合进 S7PlayerState）、不 import cc、可 Node/vitest 测。
// 数值真源 B1 / 设计真源 v1.0。

import { S7BattleLineupUnitInput, S7BattleLineupPluginInput } from './S7BattleEncounterAssembler';
import { S7UnitLevelState, getShipLevel } from './S7UnitLevelState';
import { S7PluginInventoryState, findOwnedPlugin } from './S7PluginInventory';

/** 上阵位上限（v1.0 §4.1：3×3 九宫格、上阵 5 舰）。 */
export const S7_MAX_FORMATION_SLOTS = 5;
/** 玩家阵位格 p0c0..p2c2。 */
const PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;

/** 一个上阵位的配置（只管"哪艘船在哪格"；驾驶员/装备都跟船记忆，见 shipLoadouts）。 */
export interface S7FormationSlot {
  slotRef: string;
  shipId: string;
}

/** 单舰装配（v1.0 §4.4「每舰记忆 loadout」）：驾驶员 + 星核 + 插件实例，按船记忆、与编队解耦。 */
export interface S7Loadout {
  /** 必配驾驶员（一员只驾一船·§4.4）；null = 缺驾驶员（buildSquadLineup 会拦"空船不能上阵"）。 */
  pilotId: string | null;
  /** 装备的星核 id（一船 1 核·§5.4）；null = 未装。 */
  coreId: string | null;
  /** 装备的插件「实例号」(S7PluginInventory 的 instanceId，非 pluginId)；经库存解析回 {pluginId,quality}。 */
  pluginInstanceIds: string[];
}

/** 阵容状态：拥有 roster + 编队 + 各舰装配。 */
export interface S7SquadState {
  ownedShips: string[];
  ownedPilots: string[];
  /** coreId → 拥有数（星核是实例，可多个）。 */
  ownedCores: Record<string, number>;
  formation: S7FormationSlot[];
  /** shipId → 该舰装配（星核/插件）。与编队解耦：船下场/换格，装配仍保留。 */
  shipLoadouts: Record<string, S7Loadout>;
}

export function createDefaultS7Squad(): S7SquadState {
  return { ownedShips: [], ownedPilots: [], ownedCores: {}, formation: [], shipLoadouts: {} };
}

/** 取某船装配（不存在返回 null·只读）。 */
export function getShipLoadout(squad: S7SquadState, shipId: string): S7Loadout | null {
  return squad.shipLoadouts[shipId] ?? null;
}

/** 取某船当前驾驶员（跟船记忆·不存在返回 null）。 */
export function getShipPilot(squad: S7SquadState, shipId: string): string | null {
  return squad.shipLoadouts[shipId]?.pilotId ?? null;
}

/** 取/建某船装配（就地建空装配并返回）。 */
function ensureLoadout(squad: S7SquadState, shipId: string): S7Loadout {
  let l = squad.shipLoadouts[shipId];
  if (!l) {
    l = { pilotId: null, coreId: null, pluginInstanceIds: [] };
    squad.shipLoadouts[shipId] = l;
  }
  return l;
}

/** 给某船配驾驶员（唯一性：先把该驾驶员从别船卸下，再配到本船）。pilotId=null 仅卸下本船。
 *  只动数据、不校验拥有（拥有校验在 S7ShipLoadout.equipPilot / buildSquadLineup）。 */
export function setShipPilot(squad: S7SquadState, shipId: string, pilotId: string | null): void {
  if (pilotId) {
    for (const [sid, l] of Object.entries(squad.shipLoadouts)) {
      if (sid !== shipId && l.pilotId === pilotId) l.pilotId = null; // 一员只驾一船·从别船自动卸下
    }
  }
  ensureLoadout(squad, shipId).pilotId = pilotId;
}

function normStrArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v.length > 0 && !out.includes(v)) out.push(v); // 去重、去空
  }
  return out;
}

function normCores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof k === 'string' && k.length > 0 && typeof v === 'number' && Number.isInteger(v) && v > 0) {
        out[k] = v;
      }
    }
  }
  return out;
}

/** 把一条原始数据规范成一份装配（驾驶员/星核取非空字符串否则 null、插件实例去重去空）。 */
function normLoadout(raw: unknown): S7Loadout {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    pilotId: typeof o.pilotId === 'string' && o.pilotId.length > 0 ? o.pilotId : null,
    coreId: typeof o.coreId === 'string' && o.coreId.length > 0 ? o.coreId : null,
    pluginInstanceIds: normStrArray(o.pluginInstanceIds),
  };
}
/** 一份装配是否为空（无驾驶员无核无插件）——用于规范化时丢弃空壳、不污染 shipLoadouts。 */
function loadoutIsEmpty(l: S7Loadout): boolean {
  return l.pilotId === null && l.coreId === null && l.pluginInstanceIds.length === 0;
}

/**
 * 规范化阵容（防脏档/篡改）：拥有集合去重去空、星核计数取正整数、编队取合法且阵位不重复的 ≤5 行；
 * 装配按 shipId 收（新结构 shipLoadouts），并**迁移旧存档**：旧档把 coreId/插件记在 formation 行上 → 搬进 shipLoadouts[shipId]。
 */
export function normalizeS7Squad(raw: unknown): S7SquadState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  // 先收新结构 shipLoadouts（按 shipId）。
  const shipLoadouts: Record<string, S7Loadout> = {};
  if (src.shipLoadouts && typeof src.shipLoadouts === 'object' && !Array.isArray(src.shipLoadouts)) {
    for (const [shipId, v] of Object.entries(src.shipLoadouts as Record<string, unknown>)) {
      if (typeof shipId !== 'string' || shipId.length === 0) continue;
      const l = normLoadout(v);
      if (!loadoutIsEmpty(l)) shipLoadouts[shipId] = l;
    }
  }

  const formation: S7FormationSlot[] = [];
  const seenSlots = new Set<string>();
  const seenShips = new Set<string>();
  if (Array.isArray(src.formation)) {
    for (const r of src.formation) {
      if (formation.length >= S7_MAX_FORMATION_SLOTS) break;
      const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const slotRef = row.slotRef;
      const shipId = row.shipId;
      if (typeof slotRef !== 'string' || !PLAYER_SLOT_PATTERN.test(slotRef) || seenSlots.has(slotRef)) continue;
      if (typeof shipId !== 'string' || shipId.length === 0 || seenShips.has(shipId)) continue; // 同船不占两位
      seenSlots.add(slotRef);
      seenShips.add(shipId);
      formation.push({ slotRef, shipId });
      // 迁移旧档：驾驶员/装备曾记在 formation 行上 → 若 shipLoadouts 尚无该船，则搬过来（新结构优先、不覆盖）。
      if (!shipLoadouts[shipId] && (row.pilotId !== undefined || row.coreId !== undefined || row.pluginInstanceIds !== undefined)) {
        const l = normLoadout(row);
        if (!loadoutIsEmpty(l)) shipLoadouts[shipId] = l;
      }
    }
  }
  return {
    ownedShips: normStrArray(src.ownedShips),
    ownedPilots: normStrArray(src.ownedPilots),
    ownedCores: normCores(src.ownedCores),
    formation,
    shipLoadouts,
  };
}

// ===== 拥有（获取侧调用：抽卡/发奖/打捞接好后由它们调；A-step2 demo 先 seed 默认拥有）=====

/** 获得一艘星舰本体（已拥有则幂等）。返回是否本次新增。 */
export function grantShip(squad: S7SquadState, shipId: string): boolean {
  if (squad.ownedShips.includes(shipId)) return false;
  squad.ownedShips.push(shipId);
  return true;
}
/** 获得一名驾驶员本体（已拥有则幂等）。 */
export function grantPilot(squad: S7SquadState, pilotId: string): boolean {
  if (squad.ownedPilots.includes(pilotId)) return false;
  squad.ownedPilots.push(pilotId);
  return true;
}
/** 获得 n 个某星核实例。 */
export function grantCore(squad: S7SquadState, coreId: string, n = 1): void {
  if (n <= 0) return;
  squad.ownedCores[coreId] = (squad.ownedCores[coreId] ?? 0) + n;
}

export const isShipOwned = (squad: S7SquadState, shipId: string): boolean => squad.ownedShips.includes(shipId);
export const isPilotOwned = (squad: S7SquadState, pilotId: string): boolean => squad.ownedPilots.includes(pilotId);
export const coreOwnedCount = (squad: S7SquadState, coreId: string): number => squad.ownedCores[coreId] ?? 0;

/** 某星舰当前是否在编队里（上场）。 */
export const isShipDeployed = (squad: S7SquadState, shipId: string): boolean => squad.formation.some((s) => s.shipId === shipId);

// ===== "某装备当前装在哪艘船"查询（跟船记忆·装配界面用·没装返回 null）=====
/** 某驾驶员配在哪艘船。 */
export function findPilotShip(squad: S7SquadState, pilotId: string): string | null {
  for (const [sid, l] of Object.entries(squad.shipLoadouts)) if (l.pilotId === pilotId) return sid;
  return null;
}
/** 某星核装在哪艘船。 */
export function findCoreShip(squad: S7SquadState, coreId: string): string | null {
  for (const [sid, l] of Object.entries(squad.shipLoadouts)) if (l.coreId === coreId) return sid;
  return null;
}
/** 某插件实例装在哪艘船。 */
export function findPluginShip(squad: S7SquadState, instanceId: string): string | null {
  for (const [sid, l] of Object.entries(squad.shipLoadouts)) if (l.pluginInstanceIds.includes(instanceId)) return sid;
  return null;
}

// ===== 编队操作 =====

/**
 * 把某拥有的星舰放到某阵位：移除该阵位旧配置 + 移除该船在别处的占位（同船只占一位），再写入。
 * 驾驶员跟船记忆（shipLoadouts）：本舰若已记忆驾驶员则保留（换格/重新上阵不丢）；否则用传入 pilotId 配上
 * （唯一性：从别船自动卸下·§4.4）。只动数据、不校验拥有（拥有/合法性在 buildSquadLineup 统一校验）；slotRef 非法则不动。
 */
export function assignSlot(squad: S7SquadState, slotRef: string, shipId: string, pilotId: string | null): void {
  if (!PLAYER_SLOT_PATTERN.test(slotRef)) return;
  squad.formation = squad.formation.filter((s) => s.slotRef !== slotRef && s.shipId !== shipId);
  if (squad.formation.length >= S7_MAX_FORMATION_SLOTS) return; // 满 5 位不再加
  squad.formation.push({ slotRef, shipId });
  // 驾驶员：本舰已记忆则保留；否则配上传入的（跟船记忆·唯一性）。
  if (!getShipPilot(squad, shipId) && pilotId) setShipPilot(squad, shipId, pilotId);
}

/**
 * 给某阵位（须已有船）换驾驶员：把该驾驶员从别船卸下（唯一性），再配给本位的船（跟船记忆）。
 * 目标位不存在则不动；pilotId 可为 null（卸下本舰驾驶员）。
 */
export function setSlotPilot(squad: S7SquadState, slotRef: string, pilotId: string | null): void {
  const target = squad.formation.find((s) => s.slotRef === slotRef);
  if (!target) return;
  setShipPilot(squad, target.shipId, pilotId);
}

/** 清空某阵位（仅下场·驾驶员/装备仍按船记忆在 shipLoadouts 保留）。 */
export function clearSlot(squad: S7SquadState, slotRef: string): void {
  squad.formation = squad.formation.filter((s) => s.slotRef !== slotRef);
}

// ===== 编队 → 战斗阵容 =====

export type S7SquadLineupErrorCode =
  | 'empty' | 'too_many' | 'bad_slot' | 'dup_slot' | 'dup_ship' | 'dup_pilot'
  | 'not_owned_ship' | 'no_pilot' | 'not_owned_pilot' | 'not_owned_core' | 'not_owned_plugin';

export type S7SquadLineupResult =
  | { ok: true; lineup: S7BattleLineupUnitInput[] }
  | { ok: false; code: S7SquadLineupErrorCode; message: string };

/**
 * 把编队校验后转成战斗阵容（喂 S7BattleEncounterAssembler）。
 * 校验：非空 / ≤5 / 阵位合法且不重 / 同船不占两位 / 星舰与驾驶员必须拥有 / 每位必配驾驶员 / 星核(若装)必须拥有。
 * 通过则注入星舰等级（unitLevels 给了的话）。
 * 插件（B 块）：给了 inventory 才解析——把 slot.pluginInstanceIds 经库存查回 {pluginId,quality} 喂战斗；
 *   实例在库存里查不到 → not_owned_plugin（早暴露编队与库存不同步）。不给 inventory = 不解析插件（保持老行为·零回归）。
 *   注：插件「同槽不堆叠/同名不重复/≤3」由装配层(S7BattleEncounterAssembler)按 plugin_config 校验，装/卸时由 S7ShipLoadout 拦在前。
 * 任一不满足返回 ok:false（不抛错，调用方据 code 提示）。
 */
export function buildSquadLineup(
  squad: S7SquadState,
  unitLevels?: S7UnitLevelState,
  inventory?: S7PluginInventoryState,
): S7SquadLineupResult {
  const f = squad.formation;
  if (!Array.isArray(f) || f.length === 0) return { ok: false, code: 'empty', message: '编队为空，至少上阵 1 艘' };
  if (f.length > S7_MAX_FORMATION_SLOTS) return { ok: false, code: 'too_many', message: `上阵最多 ${S7_MAX_FORMATION_SLOTS} 艘` };

  const seenSlots = new Set<string>();
  const seenShips = new Set<string>();
  const seenPilots = new Set<string>();
  const lineup: S7BattleLineupUnitInput[] = [];
  for (const slot of f) {
    if (typeof slot.slotRef !== 'string' || !PLAYER_SLOT_PATTERN.test(slot.slotRef)) {
      return { ok: false, code: 'bad_slot', message: `非法阵位 "${String(slot.slotRef)}"` };
    }
    if (seenSlots.has(slot.slotRef)) return { ok: false, code: 'dup_slot', message: `阵位 ${slot.slotRef} 重复` };
    seenSlots.add(slot.slotRef);
    if (seenShips.has(slot.shipId)) return { ok: false, code: 'dup_ship', message: `星舰 ${slot.shipId} 占了多个阵位` };
    seenShips.add(slot.shipId);
    if (!isShipOwned(squad, slot.shipId)) return { ok: false, code: 'not_owned_ship', message: `未拥有星舰 ${slot.shipId}` };
    // 驾驶员/装配（B 块）：按 shipId 取该舰记忆（与编队解耦）。
    const loadout = squad.shipLoadouts[slot.shipId];
    const pilotId = loadout?.pilotId ?? null;
    if (!pilotId) return { ok: false, code: 'no_pilot', message: `${slot.slotRef} 缺驾驶员（空船不能上阵）` };
    if (seenPilots.has(pilotId)) return { ok: false, code: 'dup_pilot', message: `驾驶员 ${pilotId} 同时上了多艘船（一员只能驾一船）` };
    seenPilots.add(pilotId);
    if (!isPilotOwned(squad, pilotId)) return { ok: false, code: 'not_owned_pilot', message: `未拥有驾驶员 ${pilotId}` };
    if (loadout?.coreId && coreOwnedCount(squad, loadout.coreId) <= 0) {
      return { ok: false, code: 'not_owned_core', message: `未拥有星核 ${loadout.coreId}` };
    }
    const unit: S7BattleLineupUnitInput = { shipId: slot.shipId, slotRef: slot.slotRef, pilotId };
    if (loadout?.coreId) unit.coreId = loadout.coreId;
    if (unitLevels) unit.shipLevel = getShipLevel(unitLevels, slot.shipId);
    // 插件（B 块）：给了库存才解析——实例号 → {pluginId,quality} 喂战斗（装配层再按配置缩放成效果积木）。
    if (inventory && loadout && loadout.pluginInstanceIds.length > 0) {
      const plugins: S7BattleLineupPluginInput[] = [];
      for (const instanceId of loadout.pluginInstanceIds) {
        const inst = findOwnedPlugin(inventory, instanceId);
        if (!inst) {
          return { ok: false, code: 'not_owned_plugin', message: `编队里的插件实例 ${instanceId} 不在库存（已被回收/合成？请重新装配）` };
        }
        plugins.push({ pluginId: inst.pluginId, quality: inst.quality });
      }
      if (plugins.length > 0) unit.plugins = plugins;
    }
    lineup.push(unit);
  }
  return { ok: true, lineup };
}
