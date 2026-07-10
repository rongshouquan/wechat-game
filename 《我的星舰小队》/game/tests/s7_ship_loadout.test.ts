// B 块·单舰装配：S7ShipLoadout 装/卸 插件·星核（按 shipId·注入槽位解析器）+ 端到端「真进战斗生效」。
// §5.3 一船3槽(武器/技能/战术)·同类不堆叠·同名不重复·单实例只装一船；§5.4 一船1核·同种核可多装(拥有N份装N艘·Ron 2026)。
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
  findPluginShip,
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
  equipPilot,
  unequipPilot,
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
  grantCore(s, 'core10', 1);
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

  it('同槽已有插件，装另一件空闲同槽插件 → 直接替换（成功·旧的被替下回空闲）', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');  // weapon
    const b = addOwnedPlugin(inv, 'plg09', 'fine');  // 另一个 weapon
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp01', b.instanceId, resolver)).toEqual({ ok: true }); // 不报错·直接替换
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([b.instanceId]); // a 被替下
    expect(findPluginShip(s, a.instanceId)).toBeNull(); // a 回空闲
  });

  it('同名插件另一实例同槽 → 替换（不会同名共存）', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const b = addOwnedPlugin(inv, 'plg02', 'superior'); // 同 pluginId
    equipPlugin(s, inv, 'shp01', a.instanceId, resolver);
    equipPlugin(s, inv, 'shp01', b.instanceId, resolver);
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([b.instanceId]); // 只剩 b·同名不共存
  });

  it('三槽各装一件（武器/技能/战术）→ 都成功、共存；再换其一只替换该槽', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const w = addOwnedPlugin(inv, 'plg02', 'fine');
    const k = addOwnedPlugin(inv, 'plg07', 'fine');
    const t = addOwnedPlugin(inv, 'plg01', 'fine');
    equipPlugin(s, inv, 'shp01', w.instanceId, resolver);
    equipPlugin(s, inv, 'shp01', k.instanceId, resolver);
    equipPlugin(s, inv, 'shp01', t.instanceId, resolver);
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([w.instanceId, k.instanceId, t.instanceId]);
    // 换武器槽：只替换 w，技能/战术不动，插件数仍 ≤3。
    const w2 = addOwnedPlugin(inv, 'plg09', 'fine');
    equipPlugin(s, inv, 'shp01', w2.instanceId, resolver);
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([k.instanceId, t.instanceId, w2.instanceId]);
    expect(lo(s, 'shp01').pluginInstanceIds.length).toBeLessThanOrEqual(3);
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

  it('装来自别船的同槽插件 + 本舰原有同槽 → 两船插件互换（不是单向移动）', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const x = addOwnedPlugin(inv, 'plg02', 'fine'); // weapon → shp01
    const y = addOwnedPlugin(inv, 'plg09', 'fine'); // weapon → shp02
    equipPlugin(s, inv, 'shp01', x.instanceId, resolver);
    equipPlugin(s, inv, 'shp02', y.instanceId, resolver);
    // 把 shp02 的 y 装到 shp01(本舰武器槽是 x) → 交换：shp01=y, shp02=x。
    expect(equipPlugin(s, inv, 'shp01', y.instanceId, resolver)).toEqual({ ok: true });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([y.instanceId]); // shp01 换成 y
    expect(lo(s, 'shp02').pluginInstanceIds).toEqual([x.instanceId]); // shp02 拿到 shp01 的 x（互换·非空闲）
  });

  it('装空闲插件到有同槽占位的船 → 替换(无交换对象)：旧的回空闲', () => {
    const s = squad2();
    const inv = createDefaultS7PluginInventory();
    const x = addOwnedPlugin(inv, 'plg02', 'fine');  // weapon → shp01
    const z = addOwnedPlugin(inv, 'plg09', 'fine');  // weapon · 空闲
    equipPlugin(s, inv, 'shp01', x.instanceId, resolver);
    expect(equipPlugin(s, inv, 'shp01', z.instanceId, resolver)).toEqual({ ok: true });
    expect(lo(s, 'shp01').pluginInstanceIds).toEqual([z.instanceId]); // 换成 z
    expect(findPluginShip(s, x.instanceId)).toBeNull();               // x 无交换对象 → 回空闲
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
    expect(equipCore(s, 'shp99', 'core10')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(equipCore(s, 'shp01', 'core99')).toEqual({ ok: false, code: 'not_owned_core' });
    expect(equipCore(s, 'shp01', 'core10')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBe('core10');
  });

  it('只拥有 1 份：装第二艘 → 份数用满·自动从第一艘挪走（同时在场数 ≤ 拥有份数·Ron 2026）', () => {
    const s = squad2();
    equipCore(s, 'shp01', 'core10');
    expect(equipCore(s, 'shp02', 'core10')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBeNull(); // 份数用满→从原船挪走让位
    expect(lo(s, 'shp02').coreId).toBe('core10');
  });

  it('拥有 2 份同种核 → 可同时装 2 艘（Ron 2026 改·不再"一场只1个")', () => {
    const s = squad2();
    grantCore(s, 'core10', 1); // 再拥有 1 份 → 共 2 份
    expect(equipCore(s, 'shp01', 'core10')).toEqual({ ok: true });
    expect(equipCore(s, 'shp02', 'core10')).toEqual({ ok: true }); // 份数没用满 → 直接多装
    expect(lo(s, 'shp01').coreId).toBe('core10');
    expect(lo(s, 'shp02').coreId).toBe('core10'); // 两艘同时在场
  });

  it('把别船的核装本舰 → 别船失去该核(挪过来)·本舰原核退回可用池(非互换·Ron 2026 改)', () => {
    const s = squad2();
    grantCore(s, 'core02', 1);
    equipCore(s, 'shp01', 'core10'); // shp01=core01
    equipCore(s, 'shp02', 'core02'); // shp02=core02（仅 1 份）
    expect(equipCore(s, 'shp01', 'core02')).toEqual({ ok: true }); // 把 shp02 的 core02 装到 shp01
    expect(lo(s, 'shp01').coreId).toBe('core02');
    expect(lo(s, 'shp02').coreId).toBeNull(); // core02 份数用满→从 shp02 挪走；shp01 原 core01 退回可用池(非互换)
  });

  it('卸核：not_owned_ship / 置空 / 幂等', () => {
    const s = squad2();
    equipCore(s, 'shp01', 'core10');
    expect(unequipCore(s, 'shp99')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(unequipCore(s, 'shp01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').coreId).toBeNull();
    expect(unequipCore(s, 'shp01')).toEqual({ ok: true });
  });
});

describe('S7ShipLoadout · 驾驶员装/卸（按船·与插件/星核对称）', () => {
  it('配驾驶员：not_owned_ship / not_owned_pilot / 成功', () => {
    const s = squad2();
    expect(equipPilot(s, 'shp99', 'pil01')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(equipPilot(s, 'shp01', 'pilX')).toEqual({ ok: false, code: 'not_owned_pilot' });
    expect(equipPilot(s, 'shp01', 'pil01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').pilotId).toBe('pil01');
  });

  it('一员只驾一船：配到第二艘(空员位) → 自动从第一艘卸下（§4.4·无交换对象）', () => {
    const s = squad2();
    equipPilot(s, 'shp01', 'pil01');
    expect(equipPilot(s, 'shp02', 'pil01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').pilotId).toBeNull();
    expect(lo(s, 'shp02').pilotId).toBe('pil01');
  });

  it('两船各有驾驶员，把别船的员配到本舰 → 两员互换', () => {
    const s = squad2();
    equipPilot(s, 'shp01', 'pil01'); // shp01=pil01
    equipPilot(s, 'shp02', 'pil02'); // shp02=pil02
    expect(equipPilot(s, 'shp01', 'pil02')).toEqual({ ok: true }); // 把 shp02 的 pil02 配到 shp01
    expect(lo(s, 'shp01').pilotId).toBe('pil02');
    expect(lo(s, 'shp02').pilotId).toBe('pil01'); // 互换
  });

  it('卸驾驶员：not_owned_ship / 置空 / 幂等', () => {
    const s = squad2();
    equipPilot(s, 'shp01', 'pil01');
    expect(unequipPilot(s, 'shp99')).toEqual({ ok: false, code: 'not_owned_ship' });
    expect(unequipPilot(s, 'shp01')).toEqual({ ok: true });
    expect(lo(s, 'shp01').pilotId).toBeNull();
    expect(unequipPilot(s, 'shp01')).toEqual({ ok: true });
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
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attack' && b.op === 'pct' && b.value === 0.35)).toBe(true); // 火力插件传奇=+35%（⑩A3 真源三档·旧"传奇必附 critRate"=槽位占位口径退役·火力传奇附加"暴击溅射"=M7 挂牌）
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true);            // 陨星弹原子炮
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
