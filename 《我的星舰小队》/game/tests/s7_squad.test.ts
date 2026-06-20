// 阶段一 A-step1：阵容/编队（S7Squad）单测——拥有 roster / 编队操作 / 规范化 / 编队→战斗阵容校验转换。纯结构，不读磁盘表。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7Squad,
  normalizeS7Squad,
  grantShip,
  grantPilot,
  grantCore,
  isShipOwned,
  coreOwnedCount,
  assignSlot,
  setSlotPilot,
  clearSlot,
  buildSquadLineup,
  S7SquadState,
  S7_MAX_FORMATION_SLOTS,
} from '../assets/scripts/core/s7/S7Squad';
import {
  createDefaultS7PluginInventory,
  addOwnedPlugin,
} from '../assets/scripts/core/s7/S7PluginInventory';

/** 造一个拥有若干船/员、编队已配好的 squad（绕过 helper 直接给，便于测校验）。 */
function squadOf(over: Partial<S7SquadState>): S7SquadState {
  return { ...createDefaultS7Squad(), ...over };
}

describe('S7Squad · 拥有与编队操作', () => {
  it('默认空；grant 幂等', () => {
    const s = createDefaultS7Squad();
    expect(s).toEqual({ ownedShips: [], ownedPilots: [], ownedCores: {}, formation: [] });
    expect(grantShip(s, 'shp01')).toBe(true);
    expect(grantShip(s, 'shp01')).toBe(false); // 重复不再加
    expect(s.ownedShips).toEqual(['shp01']);
    grantPilot(s, 'pil01');
    grantCore(s, 'core01', 2);
    grantCore(s, 'core01', 1);
    expect(coreOwnedCount(s, 'core01')).toBe(3);
    expect(isShipOwned(s, 'shp01')).toBe(true);
  });

  it('assignSlot：同船只占一位、同位被替换、满 5 位不再加；clearSlot 移除', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    assignSlot(s, 'p1c2', 'shp01', 'pil01'); // 同船换到新位 → 旧位移除
    expect(s.formation).toHaveLength(1);
    expect(s.formation[0].slotRef).toBe('p1c2');
    assignSlot(s, 'p1c2', 'shp02', 'pil02'); // 同位替换
    expect(s.formation).toHaveLength(1);
    expect(s.formation[0].shipId).toBe('shp02');
    assignSlot(s, 'p9c9', 'shp03', 'pil03'); // 非法位不动
    expect(s.formation).toHaveLength(1);
    clearSlot(s, 'p1c2');
    expect(s.formation).toHaveLength(0);
  });

  it('驾驶员唯一性：把同一员配到第二艘船 → 自动从第一艘卸下（v1.0 §4.4）', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    assignSlot(s, 'p1c2', 'shp02', 'pil01'); // 同员 pil01 放到 shp02 → shp01 应被卸员
    const a = s.formation.find((x) => x.shipId === 'shp01')!;
    const b = s.formation.find((x) => x.shipId === 'shp02')!;
    expect(a.pilotId).toBeNull(); // 自动卸下
    expect(b.pilotId).toBe('pil01');
  });

  it('setSlotPilot：换驾驶员也遵守唯一性（从别船卸下）', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    assignSlot(s, 'p1c2', 'shp02', 'pil02');
    setSlotPilot(s, 'p1c2', 'pil01'); // 把 pil01 配给 shp02 → shp01 卸下 pil01
    expect(s.formation.find((x) => x.shipId === 'shp01')!.pilotId).toBeNull();
    expect(s.formation.find((x) => x.shipId === 'shp02')!.pilotId).toBe('pil01');
    setSlotPilot(s, 'pXcX', 'pil03'); // 不存在的位 → 不动
    expect(s.formation).toHaveLength(2);
  });

  it('assignSlot 满 5 位后第 6 艘不加', () => {
    const s = createDefaultS7Squad();
    const slots = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'];
    slots.forEach((sl, i) => assignSlot(s, sl, `shp${i}`, `pil${i}`));
    expect(s.formation).toHaveLength(S7_MAX_FORMATION_SLOTS);
  });

  it('normalize：脏档清洗（去重去空、星核取正整数、编队去非法/重位/同船、截到5）', () => {
    const dirty = {
      ownedShips: ['shp01', 'shp01', '', 5, 'shp02'],
      ownedPilots: ['pil01'],
      ownedCores: { core01: 2, core02: -1, core03: 1.5, bad: 'x' },
      formation: [
        { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
        { slotRef: 'p0c2', shipId: 'shp02', pilotId: 'pil02' }, // 重位 → 丢
        { slotRef: 'p1c2', shipId: 'shp01', pilotId: 'pil03' }, // 同船 → 丢
        { slotRef: 'zzz', shipId: 'shp03', pilotId: 'pil03' }, // 非法位 → 丢
        { slotRef: 'p2c2', shipId: 'shp09', pilotId: '', coreId: 'core01', pluginInstanceIds: ['x', 'x', ''] },
      ],
    };
    const s = normalizeS7Squad(dirty);
    expect(s.ownedShips).toEqual(['shp01', 'shp02']);
    expect(s.ownedCores).toEqual({ core01: 2 }); // 负/小数/非数 丢
    expect(s.formation.map((r) => r.slotRef)).toEqual(['p0c2', 'p2c2']); // 只剩合法不冲突的
    expect(s.formation[1].pilotId).toBeNull(); // 空串 → null
    expect(s.formation[1].coreId).toBe('core01');
    expect(s.formation[1].pluginInstanceIds).toEqual(['x']); // 去重去空
  });
  it('normalize 非对象 → 默认空', () => {
    expect(normalizeS7Squad(null)).toEqual(createDefaultS7Squad());
    expect(normalizeS7Squad(42)).toEqual(createDefaultS7Squad());
  });
});

describe('S7Squad · buildSquadLineup 校验 + 转换', () => {
  const owned = (over: Partial<S7SquadState> = {}) =>
    squadOf({ ownedShips: ['shp01', 'shp02', 'shp03'], ownedPilots: ['pil01', 'pil02'], ownedCores: { core01: 1 }, ...over });

  it('合法编队 → 转成阵容（带 pilotId；注入 shipLevel）', () => {
    const s = owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
      { slotRef: 'p1c2', shipId: 'shp02', pilotId: 'pil02', coreId: 'core01', pluginInstanceIds: [] },
    ] });
    const levels = { shipLevels: { shp01: 8 }, pilotLevels: {} };
    const r = buildSquadLineup(s, levels);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lineup).toHaveLength(2);
      expect(r.lineup[0]).toMatchObject({ shipId: 'shp01', slotRef: 'p0c2', pilotId: 'pil01', shipLevel: 8 });
      expect(r.lineup[1]).toMatchObject({ shipId: 'shp02', slotRef: 'p1c2', pilotId: 'pil02', coreId: 'core01', shipLevel: 1 });
    }
  });

  it('无 unitLevels → 不注入 shipLevel', () => {
    const s = owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] }] });
    const r = buildSquadLineup(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].shipLevel).toBeUndefined();
  });

  it('各错误码：empty / no_pilot / not_owned_ship / not_owned_pilot / not_owned_core / dup_slot / dup_ship / bad_slot / too_many', () => {
    const code = (s: S7SquadState) => { const r = buildSquadLineup(s); return r.ok ? 'OK' : r.code; };
    expect(code(owned({ formation: [] }))).toBe('empty');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: null, coreId: null, pluginInstanceIds: [] }] }))).toBe('no_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shpX', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] }] }))).toBe('not_owned_ship');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pilX', coreId: null, pluginInstanceIds: [] }] }))).toBe('not_owned_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: 'coreX', pluginInstanceIds: [] }] }))).toBe('not_owned_core');
    expect(code(owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
      { slotRef: 'p0c2', shipId: 'shp02', pilotId: 'pil02', coreId: null, pluginInstanceIds: [] },
    ] }))).toBe('dup_slot');
    expect(code(owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
      { slotRef: 'p1c2', shipId: 'shp01', pilotId: 'pil02', coreId: null, pluginInstanceIds: [] },
    ] }))).toBe('dup_ship');
    expect(code(owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
      { slotRef: 'p1c2', shipId: 'shp02', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
    ] }))).toBe('dup_pilot'); // 同员上两艘
    expect(code(owned({ formation: [{ slotRef: 'zzz', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] }] }))).toBe('bad_slot');
    const six = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].map((sl, i) => ({ slotRef: sl, shipId: `shp${i}`, pilotId: `pil${i}`, coreId: null, pluginInstanceIds: [] }));
    expect(code(squadOf({ ownedShips: six.map((x) => x.shipId), ownedPilots: six.map((x) => x.pilotId), formation: six }))).toBe('too_many');
  });
});

describe('S7Squad · buildSquadLineup 解析插件实例（B 块）', () => {
  const owned = (over: Partial<S7SquadState> = {}) =>
    squadOf({ ownedShips: ['shp01'], ownedPilots: ['pil01'], ownedCores: { core01: 1 }, ...over });

  it('给了库存 → 编队插件实例解析成 {pluginId,quality} 喂阵容', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'legendary'); // 武器槽·传奇
    const b = addOwnedPlugin(inv, 'plg07', 'fine');      // 技能槽·精良
    const s = owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: [a.instanceId, b.instanceId] },
    ] });
    const r = buildSquadLineup(s, undefined, inv);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lineup[0].coreId).toBe('core01');
      expect(r.lineup[0].plugins).toEqual([
        { pluginId: 'plg02', quality: 'legendary' },
        { pluginId: 'plg07', quality: 'fine' },
      ]);
    }
  });

  it('不给库存 → 不解析插件（老行为·零回归）', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const s = owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [a.instanceId] },
    ] });
    const r = buildSquadLineup(s); // 无 inventory
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].plugins).toBeUndefined();
  });

  it('编队引用了库存里没有的实例 → not_owned_plugin', () => {
    const inv = createDefaultS7PluginInventory();
    const s = owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: ['pi999'] },
    ] });
    const r = buildSquadLineup(s, undefined, inv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_owned_plugin');
  });

  it('库存给了但该位没装插件 → plugins 不挂（undefined）', () => {
    const inv = createDefaultS7PluginInventory();
    const s = owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
    ] });
    const r = buildSquadLineup(s, undefined, inv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].plugins).toBeUndefined();
  });
});
