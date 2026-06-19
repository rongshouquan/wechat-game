// 块6余项：宝箱×3（星辉货舱/行动宝藏/扩张宝藏）未开库存状态结构 + 放入/打开（纯 TS）。
import { describe, it, expect } from 'vitest';
import {
  S7_CHEST_TYPES,
  createDefaultS7ChestInventory,
  normalizeS7ChestInventory,
  getChestCount,
  addChest,
  openChest,
} from '../assets/scripts/core/s7/S7ChestInventory';

describe('块6余项 宝箱库存 S7ChestInventory', () => {
  it('三种宝箱键固定；默认各 0', () => {
    expect([...S7_CHEST_TYPES]).toEqual(['starlightCargo', 'actionTreasure', 'expansionTreasure']);
    expect(createDefaultS7ChestInventory()).toEqual({ starlightCargo: 0, actionTreasure: 0, expansionTreasure: 0 });
  });

  it('normalize：键集恒为三类，缺补 0、非非负整数落 0、未知键丢弃', () => {
    expect(normalizeS7ChestInventory({ starlightCargo: 2, actionTreasure: 1, expansionTreasure: 3 }))
      .toEqual({ starlightCargo: 2, actionTreasure: 1, expansionTreasure: 3 });
    // 缺项补 0
    expect(normalizeS7ChestInventory({ starlightCargo: 4 }))
      .toEqual({ starlightCargo: 4, actionTreasure: 0, expansionTreasure: 0 });
    // 非法值落 0、未知键丢弃
    const out = normalizeS7ChestInventory({ starlightCargo: -1, actionTreasure: 2.5, expansionTreasure: 'x', bogus: 99 });
    expect(out).toEqual({ starlightCargo: 0, actionTreasure: 0, expansionTreasure: 0 });
    expect((out as Record<string, unknown>).bogus).toBeUndefined();
    // 非对象 → 全 0
    expect(normalizeS7ChestInventory(null)).toEqual({ starlightCargo: 0, actionTreasure: 0, expansionTreasure: 0 });
  });

  it('addChest 累加；非正/非整数/未知类型无操作', () => {
    const inv = createDefaultS7ChestInventory();
    addChest(inv, 'starlightCargo', 3);
    addChest(inv, 'starlightCargo', 2);
    expect(getChestCount(inv, 'starlightCargo')).toBe(5);
    addChest(inv, 'actionTreasure', 0); // 无操作
    addChest(inv, 'actionTreasure', -1); // 无操作
    addChest(inv, 'actionTreasure', 1.5); // 无操作
    // @ts-expect-error 故意传未知类型，应无操作
    addChest(inv, 'unknownChest', 5);
    expect(inv).toEqual({ starlightCargo: 5, actionTreasure: 0, expansionTreasure: 0 });
  });

  it('openChest：有库存才扣 1 返回 true；无库存返回 false 不扣（只扣计数、不发奖）', () => {
    const inv = createDefaultS7ChestInventory();
    addChest(inv, 'expansionTreasure', 2);
    expect(openChest(inv, 'expansionTreasure')).toBe(true);
    expect(getChestCount(inv, 'expansionTreasure')).toBe(1);
    expect(openChest(inv, 'expansionTreasure')).toBe(true);
    expect(getChestCount(inv, 'expansionTreasure')).toBe(0);
    // 空了再开 → false
    expect(openChest(inv, 'expansionTreasure')).toBe(false);
    expect(getChestCount(inv, 'expansionTreasure')).toBe(0);
    // 没放过的类型 → false
    expect(openChest(inv, 'starlightCargo')).toBe(false);
  });
});
