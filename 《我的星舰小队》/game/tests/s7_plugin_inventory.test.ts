// 块6d-1：插件实例库存（背包）模块测试。覆盖 默认/增/删/查 + 规范化(丢非法/去重/序号防撞)。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7PluginInventory,
  normalizeS7PluginInventory,
  addOwnedPlugin,
  removeOwnedPlugin,
  findOwnedPlugin,
  S7PluginInventoryState,
} from '../assets/scripts/core/s7/S7PluginInventory';

describe('块6d-1 插件库存 - 默认/增删查', () => {
  it('默认库存为空、序号从 1 起', () => {
    const inv = createDefaultS7PluginInventory();
    expect(inv.plugins).toEqual([]);
    expect(inv.nextInstanceSeq).toBe(1);
  });

  it('addOwnedPlugin mint 唯一递增 instanceId(pi1,pi2)、入库并推进序号', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const b = addOwnedPlugin(inv, 'plg02', 'superior');
    expect(a.instanceId).toBe('pi1');
    expect(b.instanceId).toBe('pi2');
    expect(a.instanceId).not.toBe(b.instanceId); // 同词条同/异品质，实例 id 仍唯一
    expect(inv.plugins).toHaveLength(2);
    expect(inv.nextInstanceSeq).toBe(3);
    expect(a.pluginId).toBe('plg02');
    expect(b.quality).toBe('superior');
  });

  it('find/remove 按 instanceId 工作', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg01', 'legendary');
    expect(findOwnedPlugin(inv, a.instanceId)).toEqual(a);
    expect(removeOwnedPlugin(inv, a.instanceId)).toBe(true);
    expect(removeOwnedPlugin(inv, a.instanceId)).toBe(false); // 已不在
    expect(findOwnedPlugin(inv, a.instanceId)).toBeUndefined();
    expect(inv.plugins).toHaveLength(0);
  });
});

describe('块6d-1 插件库存 - 规范化', () => {
  it('丢弃结构非法实例(缺字段/品质非法)、保留合法', () => {
    const inv = normalizeS7PluginInventory({
      plugins: [
        { instanceId: 'pi1', pluginId: 'plg02', quality: 'fine' }, // ok
        { instanceId: 'pi2', pluginId: 'plg03', quality: 'epic' }, // 品质非法→丢
        { instanceId: '', pluginId: 'plg04', quality: 'fine' }, // instanceId 空→丢
        { pluginId: 'plg05', quality: 'fine' }, // 缺 instanceId→丢
        { instanceId: 'pi6', quality: 'fine' }, // 缺 pluginId→丢
      ],
      nextInstanceSeq: 7,
    });
    expect(inv.plugins).toEqual([{ instanceId: 'pi1', pluginId: 'plg02', quality: 'fine' }]);
  });

  it('instanceId 去重(保留先出现)', () => {
    const inv = normalizeS7PluginInventory({
      plugins: [
        { instanceId: 'pi1', pluginId: 'plg02', quality: 'fine' },
        { instanceId: 'pi1', pluginId: 'plg03', quality: 'superior' }, // 重复 id→丢
      ],
      nextInstanceSeq: 2,
    });
    expect(inv.plugins).toHaveLength(1);
    expect(inv.plugins[0].pluginId).toBe('plg02');
  });

  it('nextInstanceSeq 防撞：取 max(原值, 现有最大序号+1, 1)', () => {
    // 现有实例最大序号 pi9，但存档里 nextInstanceSeq 被篡改成 2 → 规范化抬到 10，避免 mint 出 pi2..pi9 撞号
    const inv = normalizeS7PluginInventory({
      plugins: [{ instanceId: 'pi9', pluginId: 'plg02', quality: 'fine' }],
      nextInstanceSeq: 2,
    });
    expect(inv.nextInstanceSeq).toBe(10);
    const added = addOwnedPlugin(inv, 'plg03', 'fine');
    expect(added.instanceId).toBe('pi10'); // 不与现有 pi9 撞
  });

  it('垃圾/缺失输入 → 默认空库存', () => {
    expect(normalizeS7PluginInventory(undefined)).toEqual(createDefaultS7PluginInventory());
    expect(normalizeS7PluginInventory({ plugins: 'nope' })).toEqual(createDefaultS7PluginInventory());
    const inv: S7PluginInventoryState = normalizeS7PluginInventory(42);
    expect(inv.plugins).toEqual([]);
    expect(inv.nextInstanceSeq).toBe(1);
  });
});
