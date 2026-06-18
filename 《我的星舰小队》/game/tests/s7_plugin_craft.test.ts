// 块6d-2：插件合成测试。3 同槽同品质→1 高阶、槽内随机词条、确定性种子(nextActionSeq)、消费输入即幂等；含错误用例。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7PluginConfig } from '../assets/scripts/config/s7/ConfigTypesS7';
import {
  createDefaultS7PluginInventory,
  addOwnedPlugin,
  S7PluginInventoryState,
} from '../assets/scripts/core/s7/S7PluginInventory';
import { synthesizePlugins } from '../assets/scripts/core/s7/S7PluginCraftService';

const PLUGIN_CFG: S7PluginConfig[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'plugin_config.sample.json'), 'utf-8'),
) as S7PluginConfig[];
const slotOf = (pluginId: string): string => PLUGIN_CFG.find((c) => c.pluginId === pluginId)!.slotTag;
const poolOf = (slot: string): string[] => PLUGIN_CFG.filter((c) => c.slotTag === slot).map((c) => c.pluginId);
// 三个同槽位词条 + 一个异槽（验槽不匹配）。weapon: plg02/04/09；skill: plg07。
const WEAPON3 = ['plg02', 'plg04', 'plg09'];

function invWith(specs: Array<[string, 'fine' | 'superior' | 'legendary']>): { inv: S7PluginInventoryState; ids: string[] } {
  const inv = createDefaultS7PluginInventory();
  const ids = specs.map(([pid, q]) => addOwnedPlugin(inv, pid, q).instanceId);
  return { inv, ids };
}

describe('块6d-2 合成 - 正常路径', () => {
  it('3 个精良武器 → 1 个优秀武器，词条落在武器槽池内，消费 3 输入', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    const r = synthesizePlugins(inv, ids, PLUGIN_CFG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output.quality).toBe('superior'); // 精良→优秀
    expect(slotOf(r.output.pluginId)).toBe('weapon'); // 同槽位类型
    expect(poolOf('weapon')).toContain(r.output.pluginId); // 词条在武器槽池内
    expect(inv.plugins).toHaveLength(1); // 3 输入被消费，只剩产出
    expect(inv.plugins[0].instanceId).toBe(r.output.instanceId);
    expect(inv.nextActionSeq).toBe(1); // 动作序号推进
  });

  it('3 个优秀 → 1 个传奇', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'superior'] as [string, 'superior']));
    const r = synthesizePlugins(inv, ids, PLUGIN_CFG);
    expect(r.ok && r.output.quality).toBe('legendary');
  });

  it('幂等防重：合成后重放同一组输入 → instance_not_found（输入已消费，不双花）', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    expect(synthesizePlugins(inv, ids, PLUGIN_CFG).ok).toBe(true);
    const replay = synthesizePlugins(inv, ids, PLUGIN_CFG); // 重放同样的 3 个 instanceId
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toBe('instance_not_found');
    expect(inv.plugins).toHaveLength(1); // 仍只有第一次的产出，未被二次合成消耗/产出
  });

  it('确定性：相同 nextActionSeq + 相同输入 → 相同随机词条（可复现）', () => {
    const a = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    const b = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    const ra = synthesizePlugins(a.inv, a.ids, PLUGIN_CFG);
    const rb = synthesizePlugins(b.inv, b.ids, PLUGIN_CFG);
    expect(ra.ok && rb.ok).toBe(true);
    if (!ra.ok || !rb.ok) return;
    expect(ra.output.pluginId).toBe(rb.output.pluginId); // 同种子 → 同结果
  });
});

describe('块6d-2 合成 - 错误用例（不改库存）', () => {
  const code = (r: ReturnType<typeof synthesizePlugins>) => (r.ok ? 'ok' : r.code);

  it('非 3 个 / 重复实例 → need_exactly_3_distinct', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    expect(code(synthesizePlugins(inv, ids.slice(0, 2), PLUGIN_CFG))).toBe('need_exactly_3_distinct'); // 只 2 个
    expect(code(synthesizePlugins(inv, [ids[0], ids[0], ids[0]], PLUGIN_CFG))).toBe('need_exactly_3_distinct'); // 重复
    expect(inv.plugins).toHaveLength(3); // 未改库存
  });

  it('实例不存在 → instance_not_found', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'fine'] as [string, 'fine']));
    expect(code(synthesizePlugins(inv, [ids[0], ids[1], 'pi999'], PLUGIN_CFG))).toBe('instance_not_found');
  });

  it('槽位不一致 → slot_mismatch（武器+武器+技能）', () => {
    const { inv, ids } = invWith([['plg02', 'fine'], ['plg04', 'fine'], ['plg07', 'fine']]); // plg07=技能槽
    expect(code(synthesizePlugins(inv, ids, PLUGIN_CFG))).toBe('slot_mismatch');
  });

  it('品质不一致 → quality_mismatch（精良+精良+优秀）', () => {
    const { inv, ids } = invWith([['plg02', 'fine'], ['plg04', 'fine'], ['plg09', 'superior']]);
    expect(code(synthesizePlugins(inv, ids, PLUGIN_CFG))).toBe('quality_mismatch');
  });

  it('传奇不可再合 → quality_not_upgradable', () => {
    const { inv, ids } = invWith(WEAPON3.map((p) => [p, 'legendary'] as [string, 'legendary']));
    expect(code(synthesizePlugins(inv, ids, PLUGIN_CFG))).toBe('quality_not_upgradable');
  });
});
