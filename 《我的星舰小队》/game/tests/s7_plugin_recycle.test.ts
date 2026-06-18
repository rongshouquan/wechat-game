// 块6d-3：插件回收测试。回收 → 星贝(starCargo) 入账 + 出库；品质越高回收越多；找不到不改动；消费即幂等。
import { describe, it, expect } from 'vitest';
import { createDefaultS7ResourceState } from '../assets/scripts/save/S7SaveService';
import { createDefaultS7PluginInventory, addOwnedPlugin } from '../assets/scripts/core/s7/S7PluginInventory';
import { recyclePlugin } from '../assets/scripts/core/s7/S7PluginRecycleService';

describe('块6d-3 插件回收', () => {
  it('回收精良插件 → 星贝(starCargo) 入账、实例出库、返回所得', () => {
    const inv = createDefaultS7PluginInventory();
    const res = createDefaultS7ResourceState();
    const inst = addOwnedPlugin(inv, 'plg02', 'fine');
    const r = recyclePlugin(inv, res, inst.instanceId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.starbeiGained).toBeGreaterThan(0);
    expect(res.starCargo).toBe(r.starbeiGained); // 星贝入账到 starCargo
    expect(inv.plugins).toHaveLength(0); // 实例出库
  });

  it('品质越高回收星贝越多（传奇>优秀>精良）', () => {
    const gain = (q: 'fine' | 'superior' | 'legendary') => {
      const inv = createDefaultS7PluginInventory();
      const res = createDefaultS7ResourceState();
      const inst = addOwnedPlugin(inv, 'plg02', q);
      const r = recyclePlugin(inv, res, inst.instanceId);
      return r.ok ? r.starbeiGained : -1;
    };
    expect(gain('superior')).toBeGreaterThan(gain('fine'));
    expect(gain('legendary')).toBeGreaterThan(gain('superior'));
  });

  it('找不到实例 → instance_not_found 且不改动库存/资源', () => {
    const inv = createDefaultS7PluginInventory();
    const res = createDefaultS7ResourceState();
    addOwnedPlugin(inv, 'plg02', 'fine');
    const r = recyclePlugin(inv, res, 'pi999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('instance_not_found');
    expect(inv.plugins).toHaveLength(1); // 未改库存
    expect(res.starCargo).toBe(0); // 未入账
  });

  it('幂等：回收后重放同一实例 → not_found，星贝不二次入账', () => {
    const inv = createDefaultS7PluginInventory();
    const res = createDefaultS7ResourceState();
    const inst = addOwnedPlugin(inv, 'plg02', 'legendary');
    const first = recyclePlugin(inv, res, inst.instanceId);
    const afterFirst = res.starCargo;
    const replay = recyclePlugin(inv, res, inst.instanceId);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(false);
    expect(res.starCargo).toBe(afterFirst); // 未二次入账
  });
});
