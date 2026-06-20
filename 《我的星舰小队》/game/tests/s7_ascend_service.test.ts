// 升阶/升星块 step1：阶级/星级状态 + 升阶/升星服务 + 开槽规则 单测。纯结构、不读磁盘。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7UnitTierState, normalizeS7UnitTierState, getShipTier, getPilotStar, setShipTier, setPilotStar,
  shipTierName, shipPluginSlotCap, shipCoreSlotOpen, SHIP_TIER_MAX, PILOT_STAR_MAX,
} from '../assets/scripts/core/s7/S7UnitTierState';
import { DEFAULT_S7_ASCEND_CONFIG, shipTierPowerPct, pilotStarPowerPct } from '../assets/scripts/core/s7/S7AscendConfig';
import { ascendShip, starupPilot } from '../assets/scripts/core/s7/S7AscendService';
import { createDefaultS7ExclusiveShardInventory, addExclusiveShards, getExclusiveShardCount } from '../assets/scripts/core/s7/S7ExclusiveShardInventory';

const res = (o: Partial<Record<string, number>>): Record<string, number> => ({ shipBlueprint: 0, pilotShardUniversal: 0, ...o });

describe('升阶升星 · 阶级/星级状态 + 开槽规则', () => {
  it('默认：星舰 C 阶(0)、驾驶员 1★；越界规范化丢弃', () => {
    const s = createDefaultS7UnitTierState();
    expect(getShipTier(s, 'shp01')).toBe(0);
    expect(getPilotStar(s, 'pil01')).toBe(1);
    const n = normalizeS7UnitTierState({ shipTiers: { shp01: 2, bad: 9, x: -1 }, pilotStars: { pil01: 5, y: 0, z: 6 } });
    expect(n.shipTiers).toEqual({ shp01: 2 }); // 9/-1 越界丢
    expect(n.pilotStars).toEqual({ pil01: 5 }); // 0/6 越界丢
  });

  it('开槽规则：C=1插件槽、B=2、A=3+星核槽', () => {
    expect(shipPluginSlotCap(0)).toBe(1);
    expect(shipPluginSlotCap(1)).toBe(2);
    expect(shipPluginSlotCap(2)).toBe(3);
    expect(shipCoreSlotOpen(0)).toBe(false);
    expect(shipCoreSlotOpen(1)).toBe(false);
    expect(shipCoreSlotOpen(2)).toBe(true); // A 阶开星核槽
    expect(shipTierName(0)).toBe('C');
    expect(shipTierName(2)).toBe('A');
  });

  it('战力涨幅随阶级/星级递增(占位)', () => {
    expect(shipTierPowerPct(DEFAULT_S7_ASCEND_CONFIG, 0)).toBe(0);
    expect(shipTierPowerPct(DEFAULT_S7_ASCEND_CONFIG, 2)).toBeGreaterThan(shipTierPowerPct(DEFAULT_S7_ASCEND_CONFIG, 1));
    expect(pilotStarPowerPct(DEFAULT_S7_ASCEND_CONFIG, 5)).toBeGreaterThan(pilotStarPowerPct(DEFAULT_S7_ASCEND_CONFIG, 1));
  });
});

describe('升阶升星 · 升阶服务 ascendShip', () => {
  it('C→B：扣 20 专属碎片(该舰)+2 通用舰碎片·阶级+1·返回新槽(2插件·无核)', () => {
    const tiers = createDefaultS7UnitTierState();
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'shp01', 30);
    const resources = res({ shipBlueprint: 10 });
    const r = ascendShip(tiers, shards, resources, DEFAULT_S7_ASCEND_CONFIG, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toTier).toBe(1);
    expect(r.spentExclusive).toBe(20);
    expect(r.spentBlueprint).toBe(2);
    expect(r.pluginSlots).toBe(2);
    expect(r.coreSlot).toBe(false);
    expect(getExclusiveShardCount(shards, 'shp01')).toBe(10);
    expect(resources.shipBlueprint).toBe(8);
    expect(getShipTier(tiers, 'shp01')).toBe(1);
  });

  it('B→A：扣 40+5·到 A 阶开 3 插件槽+星核槽', () => {
    const tiers = createDefaultS7UnitTierState();
    setShipTier(tiers, 'shp01', 1);
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'shp01', 40);
    const r = ascendShip(tiers, shards, res({ shipBlueprint: 5 }), DEFAULT_S7_ASCEND_CONFIG, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toTier).toBe(2);
    expect(r.pluginSlots).toBe(3);
    expect(r.coreSlot).toBe(true);
  });

  it('A 阶再升→max_tier；碎片不足→insufficient(不扣不提阶)', () => {
    const tiers = createDefaultS7UnitTierState();
    setShipTier(tiers, 'shp01', SHIP_TIER_MAX);
    expect(ascendShip(tiers, createDefaultS7ExclusiveShardInventory(), res({ shipBlueprint: 99 }), DEFAULT_S7_ASCEND_CONFIG, 'shp01'))
      .toMatchObject({ ok: false, reason: 'max_tier' });
    // C→B 需 20 专属，只给 5 → insufficient
    const tiers2 = createDefaultS7UnitTierState();
    const shards2 = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards2, 'shp02', 5);
    const r = ascendShip(tiers2, shards2, res({ shipBlueprint: 99 }), DEFAULT_S7_ASCEND_CONFIG, 'shp02');
    expect(r).toMatchObject({ ok: false, reason: 'insufficient', needExclusive: 20 });
    expect(getExclusiveShardCount(shards2, 'shp02')).toBe(5); // 不扣
    expect(getShipTier(tiers2, 'shp02')).toBe(0); // 不提阶
  });

  it('通用舰碎片不足也 insufficient', () => {
    const tiers = createDefaultS7UnitTierState();
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'shp01', 99);
    const r = ascendShip(tiers, shards, res({ shipBlueprint: 0 }), DEFAULT_S7_ASCEND_CONFIG, 'shp01'); // 需 2 通用
    expect(r).toMatchObject({ ok: false, reason: 'insufficient', needBlueprint: 2 });
  });
});

describe('升阶升星 · 升星服务 starupPilot', () => {
  it('1★→2★：扣 10 专属(该员)+2 通用员碎片·星级+1', () => {
    const tiers = createDefaultS7UnitTierState();
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'pil01', 20);
    const resources = res({ pilotShardUniversal: 10 });
    const r = starupPilot(tiers, shards, resources, DEFAULT_S7_ASCEND_CONFIG, 'pil01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toStar).toBe(2);
    expect(r.spentExclusive).toBe(10);
    expect(r.spentUniversal).toBe(2);
    expect(getExclusiveShardCount(shards, 'pil01')).toBe(10);
    expect(resources.pilotShardUniversal).toBe(8);
    expect(getPilotStar(tiers, 'pil01')).toBe(2);
  });

  it('5★再升→max_tier；专属/通用不足→insufficient', () => {
    const tiers = createDefaultS7UnitTierState();
    setPilotStar(tiers, 'pil01', PILOT_STAR_MAX);
    expect(starupPilot(tiers, createDefaultS7ExclusiveShardInventory(), res({ pilotShardUniversal: 99 }), DEFAULT_S7_ASCEND_CONFIG, 'pil01'))
      .toMatchObject({ ok: false, reason: 'max_tier' });
    const tiers2 = createDefaultS7UnitTierState();
    const shards2 = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards2, 'pil02', 3); // 1★→2★ 需 10
    expect(starupPilot(tiers2, shards2, res({ pilotShardUniversal: 99 }), DEFAULT_S7_ASCEND_CONFIG, 'pil02'))
      .toMatchObject({ ok: false, reason: 'insufficient' });
  });
});
