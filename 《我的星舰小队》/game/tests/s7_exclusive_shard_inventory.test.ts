// 块6余项：专属碎片库存（每单位专属碎片）状态结构 + 增删查（纯 TS）。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7ExclusiveShardInventory,
  normalizeS7ExclusiveShardInventory,
  getExclusiveShardCount,
  addExclusiveShards,
  spendExclusiveShards,
  S7ExclusiveShardInventoryState,
} from '../assets/scripts/core/s7/S7ExclusiveShardInventory';

describe('块6余项 专属碎片库存 S7ExclusiveShardInventory', () => {
  it('默认空库存；getExclusiveShardCount 缺项返回 0', () => {
    const inv = createDefaultS7ExclusiveShardInventory();
    expect(inv).toEqual({ shards: {} });
    expect(getExclusiveShardCount(inv, 'ship01')).toBe(0);
  });

  it('normalize 只保留正整数项；非整数/≤0/脏键一律丢弃', () => {
    const raw = {
      shards: {
        ship01: 12, // 保留
        pil03: 1, // 保留
        ship02: 0, // ≤0 丢弃
        ship03: -5, // 负 丢弃
        ship04: 2.5, // 非整数 丢弃
        ship05: 'x', // 非数 丢弃
        '': 9, // 空键 丢弃
      },
    };
    const out = normalizeS7ExclusiveShardInventory(raw);
    expect(out.shards).toEqual({ ship01: 12, pil03: 1 });
  });

  it('防原型污染：脏档(JSON.parse) 的 __proto__/constructor 键被丢弃、不污染原型', () => {
    // 注意：必须用 JSON.parse 构造——对象字面量里的 __proto__: 是原型设置器、不会成为 own key，
    // 唯有 JSON.parse 才会把 "__proto__" 当成真正的 own 属性（真实脏档的来源）。
    const raw = JSON.parse('{"shards":{"__proto__":{"polluted":true},"constructor":99,"ship01":7}}');
    const out = normalizeS7ExclusiveShardInventory(raw);
    expect(out.shards).toEqual({ ship01: 7 });
    // 原型未被污染
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('normalize 容错：非对象 / 缺 shards → 空库存', () => {
    expect(normalizeS7ExclusiveShardInventory(null).shards).toEqual({});
    expect(normalizeS7ExclusiveShardInventory({}).shards).toEqual({});
    expect(normalizeS7ExclusiveShardInventory({ shards: 'oops' }).shards).toEqual({});
  });

  it('addExclusiveShards 累加；非正/非整数 amount 无操作', () => {
    const inv: S7ExclusiveShardInventoryState = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(inv, 'ship01', 10);
    addExclusiveShards(inv, 'ship01', 5);
    expect(getExclusiveShardCount(inv, 'ship01')).toBe(15);
    addExclusiveShards(inv, 'ship01', 0); // 无操作
    addExclusiveShards(inv, 'ship01', -3); // 无操作
    addExclusiveShards(inv, 'ship01', 1.5); // 无操作
    addExclusiveShards(inv, '', 5); // 空键无操作
    expect(getExclusiveShardCount(inv, 'ship01')).toBe(15);
  });

  it('spendExclusiveShards：足够才扣并返回 true；扣到 0 删键；不足/非法 amount 返回 false 不扣', () => {
    const inv = createDefaultS7ExclusiveShardInventory();
    addExclusiveShards(inv, 'pil03', 60);
    expect(spendExclusiveShards(inv, 'pil03', 20)).toBe(true);
    expect(getExclusiveShardCount(inv, 'pil03')).toBe(40);
    // 不足不扣
    expect(spendExclusiveShards(inv, 'pil03', 100)).toBe(false);
    expect(getExclusiveShardCount(inv, 'pil03')).toBe(40);
    // 非法 amount 不扣
    expect(spendExclusiveShards(inv, 'pil03', 0)).toBe(false);
    expect(spendExclusiveShards(inv, 'pil03', -1)).toBe(false);
    expect(spendExclusiveShards(inv, 'pil03', 2.5)).toBe(false);
    expect(getExclusiveShardCount(inv, 'pil03')).toBe(40);
    // 恰好扣完 → 删键（不留 0）
    expect(spendExclusiveShards(inv, 'pil03', 40)).toBe(true);
    expect(getExclusiveShardCount(inv, 'pil03')).toBe(0);
    expect(Object.prototype.hasOwnProperty.call(inv.shards, 'pil03')).toBe(false);
    // 不存在的单位扣 → false
    expect(spendExclusiveShards(inv, 'ship99', 1)).toBe(false);
  });
});
