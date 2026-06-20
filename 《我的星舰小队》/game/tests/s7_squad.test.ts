// 阶段一 A-step1 + B 块：阵容/编队（S7Squad）单测——拥有 roster / 编队操作 / 规范化(含旧档迁移) / 编队+按船装配(驾驶员/星核/插件)→战斗阵容。纯结构，不读磁盘表。
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
  getShipLoadout,
  getShipPilot,
  S7SquadState,
  S7_MAX_FORMATION_SLOTS,
} from '../assets/scripts/core/s7/S7Squad';
import {
  createDefaultS7PluginInventory,
  addOwnedPlugin,
} from '../assets/scripts/core/s7/S7PluginInventory';

/** 造一个 squad（spread 默认，便于直接给 formation/shipLoadouts 测校验）。 */
function squadOf(over: Partial<S7SquadState>): S7SquadState {
  return { ...createDefaultS7Squad(), ...over };
}
const pilotOf = (s: S7SquadState, shipId: string) => s.shipLoadouts[shipId]?.pilotId ?? null;

describe('S7Squad · 拥有与编队操作', () => {
  it('默认空（含 shipLoadouts）；grant 幂等', () => {
    const s = createDefaultS7Squad();
    expect(s).toEqual({ ownedShips: [], ownedPilots: [], ownedCores: {}, formation: [], shipLoadouts: {} });
    expect(grantShip(s, 'shp01')).toBe(true);
    expect(grantShip(s, 'shp01')).toBe(false);
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

  it('编队槽只含 slotRef/shipId（驾驶员/装备都在 shipLoadouts）', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    expect(s.formation[0]).toEqual({ slotRef: 'p0c2', shipId: 'shp01' });
    expect(getShipPilot(s, 'shp01')).toBe('pil01'); // 驾驶员跟船记忆
  });

  it('驾驶员/装备跟船：下场(clearSlot)仍保留，重新上阵自动带回（v1.0 §4.4）', () => {
    const s = createDefaultS7Squad();
    grantShip(s, 'shp01'); grantPilot(s, 'pil01');
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    s.shipLoadouts.shp01.coreId = 'core01';
    s.shipLoadouts.shp01.pluginInstanceIds = ['pi1'];
    clearSlot(s, 'p0c2'); // 下场
    expect(s.formation).toHaveLength(0);
    expect(getShipLoadout(s, 'shp01')).toEqual({ pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: ['pi1'] }); // 全保留
    // 重新上阵到别的格：已记忆的驾驶员保留（assignSlot 传入的 pil09 被忽略）。
    assignSlot(s, 'p2c2', 'shp01', 'pil09');
    expect(pilotOf(s, 'shp01')).toBe('pil01');
    expect(getShipLoadout(s, 'shp01')).toEqual({ pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: ['pi1'] });
  });

  it('驾驶员唯一性：把同一员配到第二艘船 → 自动从第一艘卸下（v1.0 §4.4）', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    assignSlot(s, 'p1c2', 'shp02', 'pil01'); // 同员 pil01 放到 shp02 → shp01 卸员
    expect(pilotOf(s, 'shp01')).toBeNull();
    expect(pilotOf(s, 'shp02')).toBe('pil01');
  });

  it('setSlotPilot：换驾驶员遵守唯一性（从别船卸下）；null 卸下本舰', () => {
    const s = createDefaultS7Squad();
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    assignSlot(s, 'p1c2', 'shp02', 'pil02');
    setSlotPilot(s, 'p1c2', 'pil01'); // pil01 配 shp02 → shp01 卸下
    expect(pilotOf(s, 'shp01')).toBeNull();
    expect(pilotOf(s, 'shp02')).toBe('pil01');
    setSlotPilot(s, 'p1c2', null); // 卸下 shp02 驾驶员
    expect(pilotOf(s, 'shp02')).toBeNull();
    setSlotPilot(s, 'pXcX', 'pil03'); // 不存在的位 → 不动
    expect(s.formation).toHaveLength(2);
  });

  it('assignSlot 满 5 位后第 6 艘不加', () => {
    const s = createDefaultS7Squad();
    ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].forEach((sl, i) => assignSlot(s, sl, `shp${i}`, `pil${i}`));
    expect(s.formation).toHaveLength(S7_MAX_FORMATION_SLOTS);
  });

  it('normalize：脏档清洗（去重去空、星核取正整数、编队去非法/重位/同船、截到5；无驾驶员/装备→shipLoadouts 空）', () => {
    const dirty = {
      ownedShips: ['shp01', 'shp01', '', 5, 'shp02'],
      ownedPilots: ['pil01'],
      ownedCores: { core01: 2, core02: -1, core03: 1.5, bad: 'x' },
      formation: [
        { slotRef: 'p0c2', shipId: 'shp01' },
        { slotRef: 'p0c2', shipId: 'shp02' }, // 重位 → 丢
        { slotRef: 'p1c2', shipId: 'shp01' }, // 同船 → 丢
        { slotRef: 'zzz', shipId: 'shp03' }, // 非法位 → 丢
        { slotRef: 'p2c2', shipId: 'shp09' },
      ],
    };
    const s = normalizeS7Squad(dirty);
    expect(s.ownedShips).toEqual(['shp01', 'shp02']);
    expect(s.ownedCores).toEqual({ core01: 2 });
    expect(s.formation.map((r) => r.slotRef)).toEqual(['p0c2', 'p2c2']);
    expect(s.formation[0]).toEqual({ slotRef: 'p0c2', shipId: 'shp01' });
    expect(s.shipLoadouts).toEqual({}); // 无驾驶员/装备不建空壳
  });

  it('normalize：旧档驾驶员/装备记在 formation 行上 → 迁移到 shipLoadouts（去重去空）', () => {
    const dirty = {
      ownedShips: ['shp01', 'shp02'],
      formation: [
        { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: ['pi1', 'pi1', ''] },
        { slotRef: 'p1c2', shipId: 'shp02', pilotId: 'pil02' }, // 仅驾驶员
        { slotRef: 'p2c2', shipId: 'shp03' }, // 啥都没 → 不建
      ],
    };
    const s = normalizeS7Squad(dirty);
    expect(s.formation[0]).toEqual({ slotRef: 'p0c2', shipId: 'shp01' }); // 行上不再带驾驶员/装备
    expect(s.shipLoadouts.shp01).toEqual({ pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: ['pi1'] }); // 迁移 + 去重去空
    expect(s.shipLoadouts.shp02).toEqual({ pilotId: 'pil02', coreId: null, pluginInstanceIds: [] }); // 仅驾驶员也迁移
    expect(s.shipLoadouts.shp03).toBeUndefined(); // 全空不建空壳
  });

  it('normalize：新结构 shipLoadouts 优先于旧行迁移（不被覆盖）', () => {
    const src = {
      ownedShips: ['shp01'],
      formation: [{ slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pilOLD', coreId: 'coreOLD' }],
      shipLoadouts: { shp01: { pilotId: 'pil02', coreId: 'core02', pluginInstanceIds: ['pi5'] } },
    };
    const s = normalizeS7Squad(src);
    expect(s.shipLoadouts.shp01).toEqual({ pilotId: 'pil02', coreId: 'core02', pluginInstanceIds: ['pi5'] });
  });

  it('normalize 非对象 → 默认空', () => {
    expect(normalizeS7Squad(null)).toEqual(createDefaultS7Squad());
    expect(normalizeS7Squad(42)).toEqual(createDefaultS7Squad());
  });
});

describe('S7Squad · buildSquadLineup 校验 + 转换', () => {
  const owned = (over: Partial<S7SquadState> = {}) =>
    squadOf({ ownedShips: ['shp01', 'shp02', 'shp03'], ownedPilots: ['pil01', 'pil02'], ownedCores: { core01: 1 }, ...over });

  it('合法编队 → 转成阵容（驾驶员/core 取自 shipLoadouts；注入 shipLevel）', () => {
    const s = owned({
      formation: [
        { slotRef: 'p0c2', shipId: 'shp01' },
        { slotRef: 'p1c2', shipId: 'shp02' },
      ],
      shipLoadouts: {
        shp01: { pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
        shp02: { pilotId: 'pil02', coreId: 'core01', pluginInstanceIds: [] },
      },
    });
    const r = buildSquadLineup(s, { shipLevels: { shp01: 8 }, pilotLevels: {} });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lineup).toHaveLength(2);
      expect(r.lineup[0]).toMatchObject({ shipId: 'shp01', slotRef: 'p0c2', pilotId: 'pil01', shipLevel: 8 });
      expect(r.lineup[0].coreId).toBeUndefined();
      expect(r.lineup[1]).toMatchObject({ shipId: 'shp02', slotRef: 'p1c2', pilotId: 'pil02', coreId: 'core01', shipLevel: 1 });
    }
  });

  it('无 unitLevels → 不注入 shipLevel', () => {
    const s = owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01' }], shipLoadouts: { shp01: { pilotId: 'pil01', coreId: null, pluginInstanceIds: [] } } });
    const r = buildSquadLineup(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].shipLevel).toBeUndefined();
  });

  it('各错误码：empty / no_pilot / not_owned_ship / not_owned_pilot / not_owned_core / dup_slot / dup_ship / bad_slot / too_many', () => {
    const withPilot = (shipId: string, pilotId: string | null) => ({ [shipId]: { pilotId, coreId: null, pluginInstanceIds: [] as string[] } });
    const code = (s: S7SquadState) => { const r = buildSquadLineup(s); return r.ok ? 'OK' : r.code; };
    expect(code(owned({ formation: [] }))).toBe('empty');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01' }] }))).toBe('no_pilot'); // 无装配=无驾驶员
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01' }], shipLoadouts: withPilot('shp01', null) }))).toBe('no_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shpX' }], shipLoadouts: withPilot('shpX', 'pil01') }))).toBe('not_owned_ship');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01' }], shipLoadouts: withPilot('shp01', 'pilX') }))).toBe('not_owned_pilot');
    expect(code(owned({ formation: [{ slotRef: 'p0c2', shipId: 'shp01' }], shipLoadouts: { shp01: { pilotId: 'pil01', coreId: 'coreX', pluginInstanceIds: [] } } }))).toBe('not_owned_core');
    expect(code(owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }, { slotRef: 'p0c2', shipId: 'shp02' }],
      shipLoadouts: { ...withPilot('shp01', 'pil01'), ...withPilot('shp02', 'pil02') },
    }))).toBe('dup_slot');
    expect(code(owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }, { slotRef: 'p1c2', shipId: 'shp01' }],
      shipLoadouts: withPilot('shp01', 'pil01'),
    }))).toBe('dup_ship');
    expect(code(owned({ formation: [{ slotRef: 'zzz', shipId: 'shp01' }], shipLoadouts: withPilot('shp01', 'pil01') }))).toBe('bad_slot');
    const six = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].map((sl, i) => ({ slotRef: sl, shipId: `shp${i}` }));
    expect(code(squadOf({ ownedShips: six.map((x) => x.shipId), formation: six }))).toBe('too_many');
  });

  it('同员上两艘（直接构造）→ dup_pilot', () => {
    const s = owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }, { slotRef: 'p1c2', shipId: 'shp02' }],
      shipLoadouts: {
        shp01: { pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
        shp02: { pilotId: 'pil01', coreId: null, pluginInstanceIds: [] },
      },
    });
    const r = buildSquadLineup(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('dup_pilot');
  });
});

describe('S7Squad · buildSquadLineup 解析插件实例（B 块·按船装配）', () => {
  const owned = (over: Partial<S7SquadState> = {}) =>
    squadOf({ ownedShips: ['shp01'], ownedPilots: ['pil01'], ownedCores: { core01: 1 }, ...over });

  it('给了库存 → 该船装配里的插件实例解析成 {pluginId,quality} 喂阵容', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'legendary');
    const b = addOwnedPlugin(inv, 'plg07', 'fine');
    const s = owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }],
      shipLoadouts: { shp01: { pilotId: 'pil01', coreId: 'core01', pluginInstanceIds: [a.instanceId, b.instanceId] } },
    });
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
    const s = owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }],
      shipLoadouts: { shp01: { pilotId: 'pil01', coreId: null, pluginInstanceIds: [a.instanceId] } },
    });
    const r = buildSquadLineup(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineup[0].plugins).toBeUndefined();
  });

  it('装配引用了库存里没有的实例 → not_owned_plugin', () => {
    const inv = createDefaultS7PluginInventory();
    const s = owned({
      formation: [{ slotRef: 'p0c2', shipId: 'shp01' }],
      shipLoadouts: { shp01: { pilotId: 'pil01', coreId: null, pluginInstanceIds: ['pi999'] } },
    });
    const r = buildSquadLineup(s, undefined, inv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_owned_plugin');
  });
});
