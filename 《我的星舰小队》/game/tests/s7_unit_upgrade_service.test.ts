// C1b 升级变强 步3：星舰升级服务（花软货币→提级）测试。真实 upgrade_cost 样例,不改磁盘表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7UpgradeCostParam } from '../assets/scripts/config/s7/ConfigTypesS7';
import { createDefaultS7UnitLevelState, getShipLevel, setShipLevel } from '../assets/scripts/core/s7/S7UnitLevelState';
import { upgradeShipOneLevel } from '../assets/scripts/core/s7/S7UnitUpgradeService';

const COST: S7UpgradeCostParam[] = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'upgrade_cost_param.sample.json'),
    'utf-8',
  ),
);
const res = (o: Partial<Record<string, number>>): Record<string, number> => ({ starOre: 0, hullAlloy: 0, shipBlueprint: 0, ...o });

describe('C1b 升级变强 步3 升级服务 S7UnitUpgradeService', () => {
  it('1→2 级：扣 段总成本÷10（ship lv1-10=220矿/140合金 → 22/14）,提级', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources = res({ starOre: 100, hullAlloy: 100 });
    const r = upgradeShipOneLevel(levels, resources, COST, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fromLevel).toBe(1);
    expect(r.toLevel).toBe(2);
    expect(r.spent).toEqual({ starOre: 22, hullAlloy: 14, shipBlueprint: 0 });
    expect(resources.starOre).toBe(78);
    expect(resources.hullAlloy).toBe(86);
    expect(getShipLevel(levels, 'shp01')).toBe(2);
  });

  it('资源不足：ok:false insufficient,返回 needed,状态不变', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources = res({ starOre: 10, hullAlloy: 100 }); // 矿不够
    const r = upgradeShipOneLevel(levels, resources, COST, 'shp01');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('insufficient');
    expect(r.needed).toEqual({ starOre: 22, hullAlloy: 14, shipBlueprint: 0 });
    expect(resources.starOre).toBe(10); // 不扣
    expect(getShipLevel(levels, 'shp01')).toBe(1); // 不提级
  });

  it('满级：40 级再升 ok:false max_level,不扣不变', () => {
    const levels = createDefaultS7UnitLevelState();
    setShipLevel(levels, 'shp01', 40);
    const resources = res({ starOre: 99999, hullAlloy: 99999 });
    const r = upgradeShipOneLevel(levels, resources, COST, 'shp01');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('max_level');
    expect(resources.starOre).toBe(99999);
  });

  it('跨段：升到 11 级用 ship_lv_11_20 段成本（720矿÷10=72）', () => {
    const levels = createDefaultS7UnitLevelState();
    setShipLevel(levels, 'shp01', 10);
    const resources = res({ starOre: 100, hullAlloy: 100 });
    const r = upgradeShipOneLevel(levels, resources, COST, 'shp01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.toLevel).toBe(11);
    expect(r.spent.starOre).toBe(72); // 720/10
    expect(r.spent.hullAlloy).toBe(42); // 420/10
  });

  it('连升两级累计扣费 + 累计提级', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources = res({ starOre: 1000, hullAlloy: 1000 });
    expect(upgradeShipOneLevel(levels, resources, COST, 'shp01').ok).toBe(true); // 1→2: -22/-14
    expect(upgradeShipOneLevel(levels, resources, COST, 'shp01').ok).toBe(true); // 2→3: -22/-14
    expect(getShipLevel(levels, 'shp01')).toBe(3);
    expect(resources.starOre).toBe(1000 - 44);
    expect(resources.hullAlloy).toBe(1000 - 28);
  });
});
