// B 块·单舰装配：S7ShipLoadout 装/卸 插件·星核（按 shipId·注入槽位解析器）+ 端到端「真进战斗生效」。
// §5.3 一船3槽(武器/技能/战术)·同类不堆叠·同名不重复·单实例只装一船；§5.4 一船1核·同名核一场只1个。
// 装配按船记忆(squad.shipLoadouts·与编队解耦)。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createDefaultS7Squad,
  grantShip,
  grantPilot,
  grantCore,
  assignSlot,
  buildSquadLineup,
  S7SquadState,
} from '../assets/scripts/core/s7/S7Squad';
import {
  createDefaultS7PluginInventory,
  addOwnedPlugin,
} from '../assets/scripts/core/s7/S7PluginInventory';
import {
  equipPlugin,
  unequipPlugin,
  equipCore,
  unequipCore,
} from '../assets/scripts/core/s7/S7ShipLoadout';
import { S7PluginSlot } from '../assets/scripts/config/s7/ConfigTypesS7';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7BattleEncounterAssembler } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';

// ---- 测试用槽位解析器：pluginId → slotTag（镜像 plugin_config 的相关行，避免单测读盘）。 ----
const SLOT: Record<string, S7PluginSlot> = {
  plg02: 'weapon', plg09: 'weapon',
  plg07: 'skill',
  plg01: 'tactical', plg03: 'tactical',
};
const resolver = (pluginId: string): S7PluginSlot | undefined => SLOT[pluginId];

/** 拥有 shp01/shp02 + 驾驶员 + core01 的 squad（装配操作按 shipId·不依赖编队）。 */
function squad2(): S7SquadState {
  const s = createDefaultS7Squad();
  grantShip(s, 'shp01'); grantShip(s, 'shp02');
  grantPilot(s, 'pil01'); grantPilot(s, 'pil02');
  grantCore(s, 'core01', 1);
  return s;
}
const lo = (s: S7SquadState, shipId: string) => s.shipLoadouts[shipId];

describe('S7ShipLoadout · 插件装/卸（按船）', () => {
  it('装插件：未拥有船 not_owned_ship；实例不在库存 not_owned_plugin；未知槽位 unknown_plugin', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    expect(equipPlugin(s, inv, 'shp99', a.instanceId, resolver)).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(equipPlugin(s, inv, 'shp01', 'pi999', resolver)).toEqual({ ok: false, code: 'not_owned_plugin' });
    const u = addOwnedPlugin(inv, 'plgZZ', 'fine'); // 解析器查不到槽位
    expect(equipPlugin(s, inv, 'shp01', u.instanceId, resolver)).toEqual({ ok: false, code: 'unknown_plugin' });
  });

  it('装插件成功 → 写进该船 shipLoadouts', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    expect(equipPlugin(s, inv, 'shp01', a.instanceId, resolver)).toEqual({ ok: true });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([a.instanceId]);
  });

  it('同名插件本船已装第二个实例 → dup_plugin（优先于同槽），状态不变', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const b = addOwnedPlugin(inv, 'plg02', 'superior');
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp01', b.instanceId, resolver)).toEqual({ ok: false, code: 'dup_plugin' });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([a.instanceId]);
  });

  it('同类槽已占（不同武器插件）→ slot_type_occupied，不改状态', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const b = addOwnedPlugin(inv, 'plg09', 'fine');
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp01', b.instanceId, resolver)).toEqual({ ok: false, code: 'slot_type_occupied' });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([a.instanceId]);
  });

  it('三槽各装一件（武器/技能/战术）→ 都成功、共存', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const w = addOwnedPlugin(inv, 'plg02', 'fine');
    const k = addOwnedPlugin(inv, 'plg07', 'fine');
    const t = addOwnedPlugin(inv, 'plg01', 'fine');
    expect(equipPlugin(s, inv, 'shp01', w.instanceId, resolver).ok).toBe(true);
    expect(equipPlugin(s, inv, 'shp01', k.instanceId, resolver).ok).toBe(true);
    expect(equipPlugin(s, inv, 'shp01', t.instanceId, resolver).ok).toBe(true);
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([w.instanceId, k.instanceId, t.instanceId]);
  });

  it('防脏档兜底：船已有3件(含重复武器槽) 再装第4件不同槽 → too_many_plugins', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const w1 = addOwnedPlugin(inv, 'plg02', 'fine');
    const w2 = addOwnedPlugin(inv, 'plg09', 'fine');
    const k = addOwnedPlugin(inv, 'plg07', 'fine');
    const t = addOwnedPlugin(inv, 'plg01', 'fine');
    s.shipLoadouts.shp01 = { pilotId: null, coreId: null, pluginInstanceIds: [w1.instanceId, w2.instanceId, k.instanceId] }; // 直接构造脏档
    expect(equipPlugin(s, inv, 'shp01', t.instanceId, resolver)).toEqual({ ok: false, code: 'too_many_plugins' });
  });

  it('单实例独占：装到第二艘船 → 自动从第一艘卸下', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp02', a.instanceId, resolver)).toEqual({ ok: true });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([]);            // 从原船卸下
    expect(lo(s, 'shp02').pluginInstanceIds).toEqual([a.instanceId]); // 装到新船
  });

  it('先校验后改（原子性）：装失败不会把实例从原船误卸', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const x = addOwnedPlugin(inv, 'plg02', 'fine'); // weapon → shp01
    const y = addOwnedPlugin(inv, 'plg09', 'fine'); // weapon → shp02 占武器槽
    equipPlugin(s, inv, 'shp01', x.instanceId, resolver);
    equipPlugin(s, inv, 'shp02', y.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp02', x.instanceId, resolver)).toEqual({ ok: false, code: 'slot_type_occupied' });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([x.instanceId]); // 没被误卸
  });

  it('卸插件：not_owned_ship / 幂等', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    expect(unequipPlugin(s, 'shp99', a.instanceId)).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(unequipPlugin(s, 'shp01', a.instanceId)).toEqual({ ok: true });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([]);
    expect(unequipPlugin(s, 'shp01', a.instanceId)).toEqual({ ok: true }); // 再卸幂等
  });
});

describe('S7ShipLoadout · 星核装/卸（按船）', () => {
  it('装核：not_owned_ship / not_owned_core / 成功', () => {
    const s = squad2();
    expect(equipCore(s, 'shp99', 'core01')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(equipCore(s, 'shp01', 'core99')).toEqual({ ok: false, code: 'not_owned_core' });
    expect(equipCore(s, 'shp01', 'core01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBe('core01');
  });

  it('同名核一场只1个：装到第二艘 → 自动从第一艘卸下（§5.4）', () => {
    const s = squad2();
    equipCore(s, 'shp01', 'core01');
    expect(equipCore(s, 'shp02', 'core01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBeNull(); // 从原船卸下
    expect(lo(s, 'shp02').coreId).toBe('core01');
  });

  it('卸核：not_owned_ship / 置空 / 幂等', () => {
    const s = squad2();
    equipCore(s, 'shp01', 'core01');
    expect(unequipCore(s, 'shp99')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(unequipCore(s, 'shp01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBeNull();
    expect(unequipCore(s, 'shp01')).toEqual({ ok: true });
  });
});

// ---- 端到端：装上插件/星核 → buildSquadLineup → 真组装器 → 真出现在战斗效果积木里。 ----
const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadRuntime(): Promise<S7ConfigRuntime> {
  const bundle = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return S7ConfigRuntime.load(createInMemoryS7TableReader(bundle));
}

describe('S7ShipLoadout · 真进战斗生效（端到端：装配→阵容→组装器→效果积木）', () => {
  it('装传奇武器插件 + 过载核心 → 战斗单位 effectBlocks 真带上对应积木', async () => {
    const rt = await loadRuntime();
    const realSlotOf = (pluginId: string): S7PluginSlot | undefined =>
      (rt.getAll<{ pluginId: string; slotTag: S7PluginSlot }>('plugin_config').find((c) => c.pluginId === pluginId))?.slotTag;

    const s = createDefaultS7Squad();
    grantShip(s, 'shp01'); grantPilot(s, 'pil01'); grantCore(s, 'core07', 1);
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    const inv = createDefaultS7PluginInventory();
    const w = addOwnedPlugin(inv, 'plg02', 'legendary'); // 武器·传奇

    expect(equipPlugin(s, inv, 'shp01', w.instanceId, realSlotOf)).toEqual({ ok: true });
    expect(equipCore(s, 'shp01', 'core07')).toEqual({ ok: true });

    const built = buildSquadLineup(s, undefined, inv);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.lineup[0].plugins).toEqual([{ pluginId: 'plg02', quality: 'legendary' }]);
    expect(built.lineup[0].coreId).toBe('core07');

    const asm = new S7BattleEncounterAssembler(rt);
    const out = asm.assemble({ progress: { currentNodeId: 'n001', clearedNodeIds: [] }, runSeed: 'b', lineup: built.lineup });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attack' && b.op === 'pct')).toBe(true);       // 武器插件加攻
    expect(blocks.some((b) => b.kind === 'affix' && b.affix === 'critRate')).toBe(true);                          // 传奇额外暴击
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true);            // 过载核心原子炮
  });

  it('下场再上阵：装配仍跟随该船进战斗（每舰记忆 loadout）', async () => {
    const rt = await loadRuntime();
    const realSlotOf = (pluginId: string): S7PluginSlot | undefined =>
      (rt.getAll<{ pluginId: string; slotTag: S7PluginSlot }>('plugin_config').find((c) => c.pluginId === pluginId))?.slotTag;
    const s = createDefaultS7Squad();
    grantShip(s, 'shp01'); grantPilot(s, 'pil01'); grantCore(s, 'core07', 1);
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    const inv = createDefaultS7PluginInventory();
    const w = addOwnedPlugin(inv, 'plg02', 'legendary');
    equipPlugin(s, inv, 'shp01', w.instanceId, realSlotOf);
    equipCore(s, 'shp01', 'core07');
    // 下场（清编队位）→ 再上阵到别的格。
    s.formation = [];
    assignSlot(s, 'p1c2', 'shp01', 'pil01');
    const built = buildSquadLineup(s, undefined, inv);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.lineup[0].coreId).toBe('core07'); // 装备仍在
    expect(built.lineup[0].plugins).toEqual([{ pluginId: 'plg02', quality: 'legendary' }]);
  });

  it('对照：不装任何插件/核 → 无原子炮（防假过）', async () => {
    const rt = await loadRuntime();
    const s = createDefaultS7Squad();
    grantShip(s, 'shp01'); grantPilot(s, 'pil01');
    assignSlot(s, 'p0c2', 'shp01', 'pil01');
    const inv = createDefaultS7PluginInventory();
    const built = buildSquadLineup(s, undefined, inv);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const asm = new S7BattleEncounterAssembler(rt);
    const out = asm.assemble({ progress: { currentNodeId: 'n001', clearedNodeIds: [] }, runSeed: 'b', lineup: built.lineup });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(false);
  });
});
