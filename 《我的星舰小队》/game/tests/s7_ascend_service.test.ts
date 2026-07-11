// 升阶/升星块 step1：阶级/星级状态 + 升阶/升星服务(只扣专属) + 开槽规则 + 通用碎片转换 单测。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7UnitTierState, normalizeS7UnitTierState, getShipTier, getPilotStar, setShipTier, setPilotStar,
  shipTierName, shipPluginSlotCap, shipCoreSlotOpen, SHIP_TIER_MAX, PILOT_STAR_MAX,
  shipLevelCapForTier, pilotLevelCapForStar,
} from '../assets/scripts/core/s7/S7UnitTierState';
import { DEFAULT_S7_ASCEND_CONFIG, shipTierPowerPct, pilotStarPowerPct } from '../assets/scripts/core/s7/S7AscendConfig';
import { ascendShip, starupPilot, convertUniversalToExclusive } from '../assets/scripts/core/s7/S7AscendService';
import { createDefaultS7ExclusiveShardInventory, addExclusiveShards, getExclusiveShardCount } from '../assets/scripts/core/s7/S7ExclusiveShardInventory';

describe('升阶升星 · 阶级/星级状态 + 开槽规则（5 阶 C/B/A/S/SS）', () => {
  it('默认 C 阶(0)/1★；越界规范化丢弃（阶级上限 4=SS）', () => {
    const s = createDefaultS7UnitTierState();
    expect(getShipTier(s, 'shp01')).toBe(0);
    expect(getPilotStar(s, 'pil01')).toBe(1);
    const n = normalizeS7UnitTierState({ shipTiers: { shp01: 4, bad: 5, x: -1 }, pilotStars: { pil01: 5, y: 0, z: 6 } });
    expect(n.shipTiers).toEqual({ shp01: 4 }); // 5/-1 越界丢(0..4)
    expect(n.pilotStars).toEqual({ pil01: 5 });
  });

  it('开槽：C=1插件/B=2/A=3/S=3/SS=3；星核槽 S(3)起开', () => {
    expect([0, 1, 2, 3, 4].map(shipPluginSlotCap)).toEqual([1, 2, 3, 3, 3]);
    expect([0, 1, 2, 3, 4].map(shipCoreSlotOpen)).toEqual([false, false, false, true, true]); // A(2)不开·S(3)起开
    expect(shipTierName(0)).toBe('C');
    expect(shipTierName(3)).toBe('S');
    expect(shipTierName(4)).toBe('SS');
  });

  it('战力涨幅随阶级/星级递增(占位·5 阶)', () => {
    expect([0, 1, 2, 3, 4].map((t) => shipTierPowerPct(DEFAULT_S7_ASCEND_CONFIG, t))).toEqual([0, 12, 28, 48, 72]);
    expect(pilotStarPowerPct(DEFAULT_S7_ASCEND_CONFIG, 5)).toBeGreaterThan(pilotStarPowerPct(DEFAULT_S7_ASCEND_CONFIG, 1));
  });

  it('等级上限只由阶级/星级决定（段二 A3·上限 100→50 两线同改）：C10/B20/A30/S40/SS50', () => {
    // 重定基（旧→新→为什么对）：旧 20/40/60/80/100＝百级世界；Ron 2026-07-11 晚拍板上限 100→50
    // （51-100 段封存未来版本防膨胀），步长 20→10、结构不变（星舰按阶 (tier+1)×10／驾驶员按星 star×10 对称）。
    expect([0, 1, 2, 3, 4].map(shipLevelCapForTier)).toEqual([10, 20, 30, 40, 50]);
    expect([1, 2, 3, 4, 5].map(pilotLevelCapForStar)).toEqual([10, 20, 30, 40, 50]);
    // 越界/脏参夹到合法阶级/星级区间（不越过 SS50 天花板、不低于起点 10）。
    expect(shipLevelCapForTier(-3)).toBe(10); // <C 夹到 C
    expect(shipLevelCapForTier(99)).toBe(50); // >SS 夹到 SS
    expect(pilotLevelCapForStar(0)).toBe(10); // <1★ 夹到 1★
    expect(pilotLevelCapForStar(99)).toBe(50); // >5★ 夹到 5★
    expect(shipLevelCapForTier(Number.NaN)).toBe(10); // 脏参回退起点
  });
});

describe('升阶升星 · 升阶服务 ascendShip（只扣专属碎片）', () => {
  // 成本重定基（段二 2a·总控批发现①·旧→新→为什么对）：旧 20/40/80/120＝v0.1 占位从未过真源；
  // 新 50/100/300/1000＝真源梯（GDD-附录D 真源 §0＋细表 §6 支出侧＋机器真源 TRUTHS·对表守卫在 s7_power_rating_sync）。
  it('C→B：扣 50 专属(该舰)·阶级+1·2 插件槽·无核槽', () => {
    const tiers = createDefaultS7UnitTierState();
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'shp01', 60);
    const r = ascendShip(tiers, shards, DEFAULT_S7_ASCEND_CONFIG, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toTier).toBe(1);
    expect(r.spentExclusive).toBe(50);
    expect(r.pluginSlots).toBe(2);
    expect(r.coreSlot).toBe(false);
    expect(getExclusiveShardCount(shards, 'shp01')).toBe(10);
    expect(getShipTier(tiers, 'shp01')).toBe(1);
  });

  it('A→S：扣 300·到 S 阶开星核槽(3 插件+核)', () => {
    const tiers = createDefaultS7UnitTierState();
    setShipTier(tiers, 'shp01', 2); // A
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'shp01', 300);
    const r = ascendShip(tiers, shards, DEFAULT_S7_ASCEND_CONFIG, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toTier).toBe(3); // S
    expect(r.pluginSlots).toBe(3);
    expect(r.coreSlot).toBe(true); // S 阶开星核槽
  });

  it('SS 再升→max_tier；专属不足→insufficient(不扣不提阶)', () => {
    const tiers = createDefaultS7UnitTierState();
    setShipTier(tiers, 'shp01', SHIP_TIER_MAX);
    expect(ascendShip(tiers, createDefaultS7ExclusiveShardInventory(), DEFAULT_S7_ASCEND_CONFIG, 'shp01')).toMatchObject({ ok: false, reason: 'max_tier' });
    const tiers2 = createDefaultS7UnitTierState();
    const shards2 = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards2, 'shp02', 5); // C→B 需 50
    expect(ascendShip(tiers2, shards2, DEFAULT_S7_ASCEND_CONFIG, 'shp02')).toMatchObject({ ok: false, reason: 'insufficient', needExclusive: 50 });
    expect(getExclusiveShardCount(shards2, 'shp02')).toBe(5);
    expect(getShipTier(tiers2, 'shp02')).toBe(0);
  });
});

describe('升阶升星 · 升星服务 starupPilot（只扣专属碎片）', () => {
  it('1★→2★：扣 50 专属(该员)·星级+1', () => {
    const tiers = createDefaultS7UnitTierState();
    const shards = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards, 'pil01', 60);
    const r = starupPilot(tiers, shards, DEFAULT_S7_ASCEND_CONFIG, 'pil01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toStar).toBe(2);
    expect(r.spentExclusive).toBe(50);
    expect(getExclusiveShardCount(shards, 'pil01')).toBe(10);
    expect(getPilotStar(tiers, 'pil01')).toBe(2);
  });

  it('5★再升→max_tier；专属不足→insufficient', () => {
    const tiers = createDefaultS7UnitTierState();
    setPilotStar(tiers, 'pil01', PILOT_STAR_MAX);
    expect(starupPilot(tiers, createDefaultS7ExclusiveShardInventory(), DEFAULT_S7_ASCEND_CONFIG, 'pil01')).toMatchObject({ ok: false, reason: 'max_tier' });
    const tiers2 = createDefaultS7UnitTierState();
    const shards2 = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(shards2, 'pil02', 3); // 需 50
    expect(starupPilot(tiers2, shards2, DEFAULT_S7_ASCEND_CONFIG, 'pil02')).toMatchObject({ ok: false, reason: 'insufficient' });
  });
});

describe('升阶升星 · 通用碎片转专属（背包·占位 1:1）', () => {
  it('舰：扣通用舰碎片(shipBlueprint)→加该舰专属(1:1)', () => {
    const shards = createDefaultS7ExclusiveShardInventory();
    const resources: Record<string, number> = { shipBlueprint: 10, pilotShardUniversal: 0 };
    const r = convertUniversalToExclusive(resources, shards, 'ship', 'shp01', 6);
    expect(r).toMatchObject({ ok: true, converted: 6 });
    expect(resources.shipBlueprint).toBe(4);
    expect(getExclusiveShardCount(shards, 'shp01')).toBe(6);
  });

  it('员：扣通用员碎片(pilotShardUniversal)→加该员专属', () => {
    const shards = createDefaultS7ExclusiveShardInventory();
    const resources: Record<string, number> = { shipBlueprint: 0, pilotShardUniversal: 8 };
    expect(convertUniversalToExclusive(resources, shards, 'pilot', 'pil03', 5)).toMatchObject({ ok: true, converted: 5 });
    expect(resources.pilotShardUniversal).toBe(3);
    expect(getExclusiveShardCount(shards, 'pil03')).toBe(5);
  });

  it('通用不足/非法量→失败不动', () => {
    const shards = createDefaultS7ExclusiveShardInventory();
    const resources: Record<string, number> = { shipBlueprint: 2, pilotShardUniversal: 0 };
    expect(convertUniversalToExclusive(resources, shards, 'ship', 'shp01', 5)).toMatchObject({ ok: false, reason: 'insufficient' });
    expect(convertUniversalToExclusive(resources, shards, 'ship', 'shp01', 0)).toMatchObject({ ok: false, reason: 'bad_amount' });
    expect(resources.shipBlueprint).toBe(2); // 不动
    expect(getExclusiveShardCount(shards, 'shp01')).toBe(0);
  });
});
