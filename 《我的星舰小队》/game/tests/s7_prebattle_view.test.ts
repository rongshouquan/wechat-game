// 阶段一 A-step2a：战前备战数据层单测。真实样例配置跑出，不改磁盘表。
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { createDefaultS7Squad, grantShip, grantPilot, grantCore, assignSlot } from '../assets/scripts/core/s7/S7Squad';
import { buildPrebattleView } from '../assets/scripts/core/s7/S7PrebattleView';
import { createDefaultS7PluginInventory, addOwnedPlugin } from '../assets/scripts/core/s7/S7PluginInventory';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

let runtime: S7ConfigRuntime;
beforeAll(async () => {
  runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
});

const at = (nodeId: string) => ({ currentNodeId: nodeId, clearedNodeIds: [] });
const squad2 = () => {
  const s = createDefaultS7Squad();
  grantShip(s, 'shp01'); grantShip(s, 'shp02'); grantPilot(s, 'pil01'); grantPilot(s, 'pil02');
  assignSlot(s, 'p0c2', 'shp01', 'pil01');
  assignSlot(s, 'p1c2', 'shp02', 'pil02');
  return s;
};

describe('A-step2a · buildPrebattleView', () => {
  it('n006 精英：如实读出敌情(8 强化群怪 + 2 爆发兵=10·带站位)、stageType=elite、无Boss', () => {
    const r = buildPrebattleView(runtime, at('n006'), squad2());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.stageType).toBe('elite');
    expect(r.view.hasEncounter).toBe(true);
    expect(r.view.enemyCount).toBe(10); // n006: spawn_n006_w1(8) + w2(2)
    expect(r.view.enemies.filter((e) => e.unitStatRef === 'bu_enemy_swarm_tough')).toHaveLength(8);
    expect(r.view.enemies.filter((e) => e.unitStatRef === 'bu_enemy_burst_raider')).toHaveLength(2);
    expect(r.view.enemies.every((e) => /^r\dc\d$/.test(e.slotRef))).toBe(true); // 带敌方站位
    expect(r.view.hasBoss).toBe(false);
  });

  it('n018 Boss：hasBoss=true、含 boss 单位、stageType=boss、推荐战力取 boss recommend', () => {
    const r = buildPrebattleView(runtime, at('n018'), squad2());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.stageType).toBe('boss');
    expect(r.view.hasBoss).toBe(true);
    expect(r.view.enemies.some((e) => e.unitStatRef === 'bu_boss_n018' && e.isBoss)).toBe(true);
    expect(r.view.recommendedPower).toBe(1500); // bp_n018 recommend
  });

  it('n008 暂无遭遇：ok 但 hasEncounter=false、敌人空（仍给 stageType/推荐战力）', () => {
    const r = buildPrebattleView(runtime, at('n008'), squad2());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.hasEncounter).toBe(false);
    expect(r.view.enemyCount).toBe(0);
    expect(r.view.recommendedPower).toBeGreaterThan(0); // np_sf01 中值
  });

  it('我方战力：编队各舰成长战力之和；升级后更高', () => {
    const base = buildPrebattleView(runtime, at('n006'), squad2());
    const leveled = buildPrebattleView(runtime, at('n006'), squad2(), { shipLevels: { shp01: 10, shp02: 10 }, pilotLevels: {} });
    expect(base.ok && leveled.ok).toBe(true);
    if (!base.ok || !leveled.ok) return;
    expect(base.view.playerPower).toBeGreaterThan(0);
    expect(leveled.view.playerPower).toBeGreaterThan(base.view.playerPower); // 升级→战力涨
  });

  it('装配（插件 + 星核）抬高战力（Ron 拍板：两者均计入·占位值）', () => {
    const bare = buildPrebattleView(runtime, at('n006'), squad2());
    const inv = createDefaultS7PluginInventory();
    const a = addOwnedPlugin(inv, 'plg02', 'legendary');
    const s = squad2();
    grantCore(s, 'core07', 1);
    s.shipLoadouts.shp01.coreId = 'core07'; // 就地改（保留 assignSlot 配的驾驶员）
    s.shipLoadouts.shp01.pluginInstanceIds = [a.instanceId];
    const equipped = buildPrebattleView(runtime, at('n006'), s, undefined, inv);
    expect(bare.ok && equipped.ok).toBe(true);
    if (!bare.ok || !equipped.ok) return;
    expect(equipped.view.playerPower).toBeGreaterThan(bare.view.playerPower); // 装了插件+核 → 战力更高
  });

  it('驾驶员单独也计入战力（同船同级·只差驾驶员·占位）', () => {
    const noPilot = createDefaultS7Squad();
    grantShip(noPilot, 'shp01');
    noPilot.formation = [{ slotRef: 'p0c2', shipId: 'shp01' }]; // 无 loadout = 无驾驶员
    const withPilot = createDefaultS7Squad();
    grantShip(withPilot, 'shp01'); grantPilot(withPilot, 'pil01');
    assignSlot(withPilot, 'p0c2', 'shp01', 'pil01');
    const a = buildPrebattleView(runtime, at('n006'), noPilot);
    const b = buildPrebattleView(runtime, at('n006'), withPilot);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.view.playerPower).toBeGreaterThan(a.view.playerPower); // 配了驾驶员 → 战力更高
  });

  it('空编队：我方战力 0（仍可看敌情/推荐）', () => {
    const r = buildPrebattleView(runtime, at('n006'), createDefaultS7Squad());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.view.playerPower).toBe(0);
    expect(r.view.enemyCount).toBe(10);
  });

  it('非战斗节点（n038 reset_gate）：ok:false', () => {
    const r = buildPrebattleView(runtime, at('n038'), squad2());
    expect(r.ok).toBe(false);
  });
});
