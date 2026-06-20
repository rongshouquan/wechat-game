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
  clearSlot,
  buildSquadLineup,
  S7SquadState,
  S7_MAX_FORMATION_SLOTS,
} from '../assets/scripts/core/s7/S7Squad';

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
        { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] },
        { slotRef: 'p0c2', shipId: 'shp02', pilotId: 'pil02' }, // 重位 → 丢
        { slotRef: 'p1c2', shipId: 'shp01', pilotId: 'pil03' }, // 同船 → 丢
        { slotRef: 'zzz', shipId: 'shp03', pilotId: 'pil03' }, // 非法位 → 丢
        { slotRef: 'p2c2', shipId: 'shp09', pilotId: '', coreId: 'core01', pluginIds: ['x', 'x', ''] },
      ],
    };
    const s = normalizeS7Squad(dirty);
    expect(s.ownedShips).toEqual(['shp01', 'shp02']);
    expect(s.ownedCores).toEqual({ core01: 2 }); // 负/小数/非数 丢
    expect(s.formation.map((r) => r.slotRef)).toEqual(['p0c2', 'p2c2']); // 只剩合法不冲突的
    expect(s.formation[1].pilotId).toBeNull(); // 空串 → null
    expect(s.formation[1].coreId).toBe('core01');
    expect(s.formation[1].pluginIds).toEqual(['x']); // 去重去空
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
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] },
      { slotRef: 'p1c2', shipId: 'shp02', pilotId: 'pil02', coreId: 'core01', pluginIds: [] },
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
    const s = owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] }] });
    const r = buildSquadLineup(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].shipLevel).toBeUndefined();
  });

  it('各错误码：empty / no_pilot / not_owned_ship / not_owned_pilot / not_owned_core / dup_slot / dup_ship / bad_slot / too_many', () => {
    const code = (s: S7SquadState) => { const r = buildSquadLineup(s); return r.ok ? 'OK' : r.code; };
    expect(code(owned({ formation: [] }))).toBe('empty');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: null, coreId: null, pluginIds: [] }] }))).toBe('no_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shpX', pilotId: 'pil01', coreId: null, pluginIds: [] }] }))).toBe('not_owned_ship');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pilX', coreId: null, pluginIds: [] }] }))).toBe('not_owned_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: 'coreX', pluginIds: [] }] }))).toBe('not_owned_core');
    expect(code(owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] },
      { slotRef: 'p0c2', shipId: 'shp02', pilotId: 'pil02', coreId: null, pluginIds: [] },
    ] }))).toBe('dup_slot');
    expect(code(owned({ formation: [
      { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] },
      { slotRef: 'p1c2', shipId: 'shp01', pilotId: 'pil02', coreId: null, pluginIds: [] },
    ] }))).toBe('dup_ship');
    expect(code(owned({ formation: [{ slotRef: 'zzz', shipId: 'shp01', pilotId: 'pil01', coreId: null, pluginIds: [] }] }))).toBe('bad_slot');
    const six = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].map((sl, i) => ({ slotRef: sl, shipId: `shp${i}`, pilotId: `pil${i}`, coreId: null, pluginIds: [] }));
    expect(code(squadOf({ ownedShips: six.map((x) => x.shipId), ownedPilots: six.map((x) => x.pilotId), formation: six }))).toBe('too_many');
  });
});
