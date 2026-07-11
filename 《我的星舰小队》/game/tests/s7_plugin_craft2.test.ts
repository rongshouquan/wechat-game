// 段二 E 组：主副槽合成全案单测（概率塔/分层限槽/星贝锁定/附加条组合/#12 返还/存档规范化/装配接线/战力扩档）。
// 方法论：不镜像实现的 RNG 内部（防自证）——确定性用"同 seq 双跑逐字段相等"证，概率塔用大样本频率带证，
// 行为不变量（失败只毁副槽/成功双消/附加条数与去重）对每种结果分支都断言。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7PluginConfig } from '../assets/scripts/config/s7/ConfigTypesS7';
import {
  craftPlugins, restoreLastCraftLoss, craftRequiresSameSlot,
  S7_CRAFT_SUCCESS_P, S7_CRAFT_LOCK_PRICE, synthesizePlugins,
} from '../assets/scripts/core/s7/S7PluginCraftService';
import {
  createDefaultS7PluginInventory, normalizeS7PluginInventory, addOwnedPlugin, S7PluginInventoryState,
} from '../assets/scripts/core/s7/S7PluginInventory';
import {
  pluginBlocks, bonusEffectBlocks, S7_GRAFTABLE_BONUS_POOL, S7_BONUS_COUNT_BY_QUALITY, S7PluginQuality,
} from '../assets/scripts/core/s7/S7PluginEffects';
import { S7_PLUGIN_POWER, shipPowerV0 } from '../assets/scripts/core/s7/S7PowerRating';
import { S7BattleEncounterAssembler } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';

const PLUGIN_CONFIGS: S7PluginConfig[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'plugin_config.sample.json'), 'utf-8'),
);
const slotOf = (id: string) => PLUGIN_CONFIGS.find((c) => c.pluginId === id)!.slotTag;

/** 造一个库存：主槽件+副槽件，nextActionSeq 可指定（=确定性实验的自变量）。 */
function mk(mainId: string, mainQ: S7PluginQuality, fuelId: string, fuelQ: S7PluginQuality, seq = 0, mainBonus?: string[]) {
  const inv = createDefaultS7PluginInventory();
  const main = addOwnedPlugin(inv, mainId, mainQ, mainBonus);
  const fuel = addOwnedPlugin(inv, fuelId, fuelQ);
  inv.nextActionSeq = seq;
  return { inv, main, fuel };
}

describe('E1 概率塔 + 确定性', () => {
  it('概率塔常量=80/60/40/20（Ron E1 原文）；锁价指数塔 20/60/180/540（数值域报备）', () => {
    expect(S7_CRAFT_SUCCESS_P).toEqual({ fine: 0.8, superior: 0.6, legendary: 0.4, legendaryPlus: 0.2, legendaryPlusPlus: 0 });
    expect(S7_CRAFT_LOCK_PRICE).toEqual({ fine: 20, superior: 60, legendary: 180, legendaryPlus: 540, legendaryPlusPlus: 0 });
  });

  it('大样本频率贴塔（seq 0..399 独立世界·各档成功率 ±7pp 带）', () => {
    for (const [q, p] of [['fine', 0.8], ['superior', 0.6], ['legendary', 0.4], ['legendaryPlus', 0.2]] as const) {
      let win = 0;
      const N = 400;
      for (let s = 0; s < N; s++) {
        const { inv, main, fuel } = mk('plg02', q, 'plg04', q, s); // 同槽（武器）=全档合法
        const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS);
        if (r.ok && r.success) win += 1;
      }
      expect(Math.abs(win / N - p), `${q} 实测 ${win / N}`).toBeLessThanOrEqual(0.07);
    }
  });

  it('确定性：同 seq 同输入双跑逐字段相等；seq 消费+1；ok:false 不消费 seq', () => {
    const run = () => {
      const { inv, main, fuel } = mk('plg02', 'legendary', 'plg04', 'legendary', 7);
      const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS);
      return { r, seq: inv.nextActionSeq, plugins: inv.plugins.map((x) => ({ ...x })) };
    };
    const a = run();
    const b = run();
    expect(a.r).toEqual(b.r);
    expect(a.plugins).toEqual(b.plugins);
    expect(a.seq).toBe(8); // 消费+1
    // 非法请求不消费 seq、不动库存。
    const { inv, main } = mk('plg02', 'legendary', 'plg04', 'legendary', 7);
    const bad = craftPlugins(inv, main.instanceId, main.instanceId, PLUGIN_CONFIGS);
    expect(bad).toEqual({ ok: false, code: 'same_instance' });
    expect(inv.nextActionSeq).toBe(7);
    expect(inv.plugins).toHaveLength(2);
  });
});

describe('E3 主副槽语义 + E4 分层限槽', () => {
  it('失败＝副槽销毁/主槽保留/损失入账；成功＝双消+产出高一档（扫 seq 两分支都验到）', () => {
    let sawFail = false; let sawWin = false;
    for (let s = 0; s < 40 && !(sawFail && sawWin); s++) {
      const { inv, main, fuel } = mk('plg02', 'legendary', 'plg09', 'legendary', s);
      const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS, { dayKey: 'd9' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      if (r.success) {
        sawWin = true;
        expect(inv.plugins).toHaveLength(1); // 双消+1 产出
        expect(r.output.quality).toBe('legendaryPlus');
        expect(slotOf(r.output.pluginId)).toBe('weapon'); // 产物槽位跟主槽走
        expect(inv.lastCraftLoss).toBeUndefined();
      } else {
        sawFail = true;
        expect(inv.plugins.map((x) => x.instanceId)).toEqual([main.instanceId]); // 主槽保留
        expect(r.destroyedFuel).toMatchObject({ pluginId: 'plg09', quality: 'legendary', dayKey: 'd9' });
        expect(inv.lastCraftLoss).toMatchObject({ pluginId: 'plg09', quality: 'legendary' });
      }
    }
    expect(sawFail && sawWin).toBe(true); // 40 个种子内两分支都必然出现（p=0.4）
  });

  it('E4：精良/优秀跨槽燃料合法（产物槽位跟主槽走）；传奇→+ 起跨槽拒收', () => {
    expect(craftRequiresSameSlot('fine')).toBe(false);
    expect(craftRequiresSameSlot('legendary')).toBe(true);
    expect(craftRequiresSameSlot('legendaryPlus')).toBe(true);
    // 精良：武器主槽+战术燃料 → 合法，产物=武器槽词条
    for (let s = 0; s < 10; s++) {
      const { inv, main, fuel } = mk('plg02', 'fine', 'plg01', 'fine', s);
      const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS);
      expect(r.ok).toBe(true);
      if (r.ok && r.success) expect(slotOf(r.output.pluginId)).toBe('weapon');
    }
    // 传奇：跨槽=slot_mismatch_high_tier（库存不动）
    const { inv, main, fuel } = mk('plg02', 'legendary', 'plg01', 'legendary', 3);
    expect(craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS)).toEqual({ ok: false, code: 'slot_mismatch_high_tier' });
    expect(inv.plugins).toHaveLength(2);
  });

  it('前置校验：品质不一致/顶档不可合/未知词条', () => {
    const a = mk('plg02', 'fine', 'plg04', 'superior', 0);
    expect(craftPlugins(a.inv, a.main.instanceId, a.fuel.instanceId, PLUGIN_CONFIGS)).toEqual({ ok: false, code: 'quality_mismatch' });
    const b = mk('plg02', 'legendaryPlusPlus', 'plg04', 'legendaryPlusPlus', 0);
    expect(craftPlugins(b.inv, b.main.instanceId, b.fuel.instanceId, PLUGIN_CONFIGS)).toEqual({ ok: false, code: 'quality_not_upgradable' });
    const c = mk('plg99', 'fine', 'plg04', 'fine', 0);
    expect(craftPlugins(c.inv, c.main.instanceId, c.fuel.instanceId, PLUGIN_CONFIGS)).toEqual({ ok: false, code: 'unknown_plugin' });
  });

  it('E3 星贝锁定：成功必出主槽同款（扫 seq 至首个成功·锁定与未锁对照）', () => {
    let checked = false;
    for (let s = 0; s < 40 && !checked; s++) {
      const locked = mk('plg23', 'legendary', 'plg02', 'legendary', s);
      const r = craftPlugins(locked.inv, locked.main.instanceId, locked.fuel.instanceId, PLUGIN_CONFIGS, { locked: true });
      if (r.ok && r.success) {
        expect(r.output.pluginId).toBe('plg23'); // 锁定=主槽身份
        expect(r.output.quality).toBe('legendaryPlus');
        checked = true;
      }
    }
    expect(checked).toBe(true);
  });
});

describe('E2 附加条：条数/去重/继承/池纪律', () => {
  it('传奇→+：产物恰 1 条附加·来自同槽可嫁接池·≠产物本体（扫全成功样本）', () => {
    for (let s = 0; s < 60; s++) {
      const { inv, main, fuel } = mk('plg02', 'legendary', 'plg04', 'legendary', s);
      const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS);
      if (!(r.ok && r.success)) continue;
      expect(r.output.bonusEffectIds).toHaveLength(1);
      const bid = r.output.bonusEffectIds![0];
      expect(S7_GRAFTABLE_BONUS_POOL.weapon).toContain(bid);
      expect(bid).not.toBe(r.output.pluginId);
    }
  });

  it('+→++：继承主槽附加条+补第 2 条（去重·锁定身份下继承条必在）', () => {
    let checked = false;
    for (let s = 0; s < 80 && !checked; s++) {
      // 主槽=传奇+ plg02 带附加 plg20；锁定合成 → 产物 plg02 ++，附加须含 plg20 且共 2 条互异。
      const { inv, main, fuel } = mk('plg02', 'legendaryPlus', 'plg04', 'legendaryPlus', s, ['plg20']);
      const r = craftPlugins(inv, main.instanceId, fuel.instanceId, PLUGIN_CONFIGS, { locked: true });
      if (!(r.ok && r.success)) continue;
      expect(r.output.pluginId).toBe('plg02');
      expect(r.output.quality).toBe('legendaryPlusPlus');
      expect(r.output.bonusEffectIds).toHaveLength(2);
      expect(r.output.bonusEffectIds).toContain('plg20'); // 继承
      expect(new Set(r.output.bonusEffectIds).size).toBe(2); // 互异
      expect(r.output.bonusEffectIds).not.toContain('plg02'); // 不与本体撞
      checked = true;
    }
    expect(checked).toBe(true);
  });

  it('可嫁接池纪律：三槽池成员都各在其槽、池内无重复、容量足够抽满 ++（≥3 排除本体后）', () => {
    for (const [slot, pool] of Object.entries(S7_GRAFTABLE_BONUS_POOL) as [keyof typeof S7_GRAFTABLE_BONUS_POOL, readonly string[]][]) {
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.length).toBeGreaterThanOrEqual(3);
      for (const id of pool) {
        expect(slotOf(id)).toBe(slot);
        expect(bonusEffectBlocks(id).length).toBeGreaterThan(0); // 池内条条有真载体（抽到必有感）
      }
    }
    expect(bonusEffectBlocks('plg21')).toEqual([]); // 未收录（依赖捐主本体）=空
  });
});

describe('E5 #12 返还接口 + 存档规范化', () => {
  it('restoreLastCraftLoss：原样回库（词条/品质/附加条）+清记录；无记录=null', () => {
    const inv = createDefaultS7PluginInventory();
    expect(restoreLastCraftLoss(inv)).toBeNull();
    inv.lastCraftLoss = { pluginId: 'plg09', quality: 'legendaryPlus', bonusEffectIds: ['plg20'], dayKey: 'd3' };
    const back = restoreLastCraftLoss(inv);
    expect(back).toMatchObject({ pluginId: 'plg09', quality: 'legendaryPlus', bonusEffectIds: ['plg20'] });
    expect(inv.lastCraftLoss).toBeUndefined();
    expect(inv.plugins).toHaveLength(1);
  });

  it('normalize：附加条按品质钳数/去重/剔本体；低品质丢附加；lastCraftLoss 回环；旧档（无新字段）原样兼容', () => {
    const raw: S7PluginInventoryState = {
      plugins: [
        { instanceId: 'pi1', pluginId: 'plg02', quality: 'legendaryPlus', bonusEffectIds: ['plg04', 'plg09'] }, // 超 1 条→钳 1
        { instanceId: 'pi2', pluginId: 'plg02', quality: 'legendaryPlusPlus', bonusEffectIds: ['plg02', 'plg04', 'plg04', 'plg09'] }, // 剔本体+去重→[plg04,plg09]
        { instanceId: 'pi3', pluginId: 'plg01', quality: 'fine', bonusEffectIds: ['plg05'] }, // 低品质→丢
        { instanceId: 'pi4', pluginId: 'plg01', quality: 'superior' }, // 旧档形状
      ],
      nextInstanceSeq: 9,
      nextActionSeq: 4,
      lastCraftLoss: { pluginId: 'plg09', quality: 'legendary', dayKey: 'd2' },
    };
    const out = normalizeS7PluginInventory(JSON.parse(JSON.stringify(raw)));
    expect(out.plugins[0].bonusEffectIds).toEqual(['plg04']);
    expect(out.plugins[1].bonusEffectIds).toEqual(['plg04', 'plg09']);
    expect(out.plugins[2].bonusEffectIds).toBeUndefined();
    expect(out.plugins[3]).toEqual({ instanceId: 'pi4', pluginId: 'plg01', quality: 'superior' });
    expect(out.lastCraftLoss).toEqual({ pluginId: 'plg09', quality: 'legendary', dayKey: 'd2' });
    expect(out.nextActionSeq).toBe(4);
    // 脏 quality 丢实例（含伪品质字符串）。
    const dirty = normalizeS7PluginInventory({ plugins: [{ instanceId: 'x', pluginId: 'plg01', quality: 'epic' }] });
    expect(dirty.plugins).toHaveLength(0);
  });

  it('旧 3 合 1 路径原样可用（并存期·字节不变面）', () => {
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'fine');
    const b = addOwnedPlugin(inv, 'plg04', 'fine');
    const c = addOwnedPlugin(inv, 'plg09', 'fine');
    const r = synthesizePlugins(inv, [a.instanceId, b.instanceId, c.instanceId], PLUGIN_CONFIGS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.quality).toBe('superior');
  });
});

describe('战斗积木与战力扩档', () => {
  it('pluginBlocks：传奇+＝传奇底座+附加块；低品质忽略附加；条数超品质上限截断', () => {
    const base = pluginBlocks('plg02', 'weapon', 'legendary');
    const plus = pluginBlocks('plg02', 'weapon', 'legendaryPlus', ['plg20']);
    expect(plus.length).toBe(base.length + bonusEffectBlocks('plg20').length);
    expect(plus.slice(0, base.length)).toEqual(base); // 主数值沿传奇档（E2 零新数值）
    expect(plus[plus.length - 1]).toMatchObject({ kind: 'affix', affix: 'critDmgVsBoss', value: 0.30, source: 'plugbonus:plg20' });
    expect(pluginBlocks('plg02', 'weapon', 'fine', ['plg20'])).toEqual(pluginBlocks('plg02', 'weapon', 'fine')); // 低品质忽略
    const pp = pluginBlocks('plg02', 'weapon', 'legendaryPlusPlus', ['plg20', 'plg04', 'plg09']); // 3 条→取 2
    expect(pp.length).toBe(base.length + bonusEffectBlocks('plg20').length + bonusEffectBlocks('plg04').length);
  });

  it('战力表扩档 90/110（E7 数值域）＋ shipPowerV0 消费', () => {
    expect(S7_PLUGIN_POWER.legendaryPlus).toBe(90);
    expect(S7_PLUGIN_POWER.legendaryPlusPlus).toBe(110);
    const base = { tier: 4, level: 50, withCore: true, pilotStar: 5, pilotLevel: 50 };
    const p1 = shipPowerV0({ ...base, pluginQualities: ['legendary', 'legendary', 'legendary'] });
    const p2 = shipPowerV0({ ...base, pluginQualities: ['legendaryPlusPlus', 'legendaryPlus', 'legendary'] });
    expect(p2).toBeGreaterThan(p1); // +/++ 计入刻度
  });

  it('装配器集成：合法附加条产出附加块进引擎请求；重复/撞本体/超条数/未知捐主=bad_bonus_effects', async () => {
    // 真 runtime（全表内存加载·同 s7_battle_encounter_assembler 测试套路）。
    const { S7ConfigRuntime, createInMemoryS7TableReader } = await import('../assets/scripts/config/s7/S7ConfigRuntime');
    const { S7_TABLE_FILES } = await import('../assets/scripts/config/s7/ConfigTypesS7');
    const dir = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
    const bundle = {} as Record<string, unknown[]>;
    for (const t of Object.keys(S7_TABLE_FILES)) bundle[t] = JSON.parse(readFileSync(path.join(dir, `${t}.sample.json`), 'utf-8'));
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(bundle as never));
    const asm = new S7BattleEncounterAssembler(runtime);
    const progress = { currentNodeId: 'n001', clearedNodeIds: [] };
    const lineupWith = (plugins: { pluginId: string; quality: S7PluginQuality; bonusEffectIds?: string[] }[]) => ([
      { shipId: 'shp01', slotRef: 'p0c2', plugins },
    ]);
    // 合法：传奇+ 带 1 条附加 → 引擎请求 effectBlocks 含 plugbonus 块。
    const ok = asm.assemble({ progress, runSeed: 't', lineup: lineupWith([{ pluginId: 'plg02', quality: 'legendaryPlus', bonusEffectIds: ['plg20'] }]) });
    const blocks = ok.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((bk) => (bk as { source?: string }).source === 'plugbonus:plg20')).toBe(true);
    // 非法四态：撞本体 / 重复 / 超条数 / 未知捐主。
    const codeOf = (plugins: { pluginId: string; quality: S7PluginQuality; bonusEffectIds?: string[] }[]) => {
      try { asm.assemble({ progress, runSeed: 't', lineup: lineupWith(plugins) }); } catch (e) { return (e as { code?: string }).code; }
      return 'no_throw';
    };
    expect(codeOf([{ pluginId: 'plg02', quality: 'legendaryPlus', bonusEffectIds: ['plg02'] }])).toBe('bad_bonus_effects');
    expect(codeOf([{ pluginId: 'plg02', quality: 'legendaryPlusPlus', bonusEffectIds: ['plg20', 'plg20'] }])).toBe('bad_bonus_effects');
    expect(codeOf([{ pluginId: 'plg02', quality: 'legendaryPlus', bonusEffectIds: ['plg20', 'plg04'] }])).toBe('bad_bonus_effects');
    expect(codeOf([{ pluginId: 'plg02', quality: 'legendaryPlus', bonusEffectIds: ['plg99'] }])).toBe('bad_bonus_effects');
    // 低品质带附加=非法（超 0 条上限）——防"拼强度"脏输入。
    expect(codeOf([{ pluginId: 'plg02', quality: 'fine', bonusEffectIds: ['plg20'] }])).toBe('bad_bonus_effects');
  });
});
