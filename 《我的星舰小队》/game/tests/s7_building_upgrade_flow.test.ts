// C·养成接入 step2：建筑升级编排单测（成本/折扣/校验/升级后状态）。纯结构，不读磁盘表。
import { describe, it, expect } from 'vitest';
import { createDefaultS7ResourceState } from '../assets/scripts/save/S7SaveService';
import { createDefaultS7BuildingState, unlockBuilding, getBuildingLevel } from '../assets/scripts/core/s7/S7BuildingState';
import { createDefaultS7Population } from '../assets/scripts/core/s7/S7Population';
import { buildingUpgradeStarOreCost } from '../assets/scripts/core/s7/S7BuildingCost';
import { applyWorkerDiscount } from '../assets/scripts/core/s7/S7Population';
import {
  buildBuildingUpgradeView,
  upgradeBuildingWithDiscount,
} from '../assets/scripts/core/s7/S7BuildingUpgradeFlow';

const IDS = ['bld_habitat', 'bld_dock', 'bld_research_tower'];

describe('C step2 · buildBuildingUpgradeView', () => {
  it('未解锁建筑：unlocked=false、level=0、成本=null、买不起', () => {
    const view = buildBuildingUpgradeView(IDS, createDefaultS7BuildingState(), createDefaultS7ResourceState(), createDefaultS7Population());
    for (const row of view) {
      expect(row.unlocked).toBe(false);
      expect(row.level).toBe(0);
      expect(row.baseCost).toBeNull();
      expect(row.discountedCost).toBeNull();
      expect(row.canAfford).toBe(false);
    }
  });

  it('已解锁 lv1：成本=配置公式值、星矿够→canAfford=true', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_habitat'); // lv1
    const res = createDefaultS7ResourceState();
    res.starOre = 100000;
    const row = buildBuildingUpgradeView(['bld_habitat'], state, res, createDefaultS7Population())[0];
    expect(row.unlocked).toBe(true);
    expect(row.level).toBe(1);
    expect(row.baseCost).toBe(buildingUpgradeStarOreCost('bld_habitat', 1)); // round(120·1^1.3·1.1)=132
    expect(row.discountedCost).toBe(row.baseCost); // 0 工人 → 无折扣
    expect(row.canAfford).toBe(true);
  });

  it('星矿不足：canAfford=false', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_dock'); // lv1, 成本系数 1.3
    const res = createDefaultS7ResourceState();
    res.starOre = 10; // 远不够
    const row = buildBuildingUpgradeView(['bld_dock'], state, res, createDefaultS7Population())[0];
    expect(row.canAfford).toBe(false);
  });

  it('工人折扣：折后成本 < 原始成本', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_habitat');
    const res = createDefaultS7ResourceState();
    res.starOre = 100000;
    const row = buildBuildingUpgradeView(['bld_habitat'], state, res, { residents: 0, workers: 20 })[0];
    expect(row.discountedCost).toBe(applyWorkerDiscount(row.baseCost!, 20));
    expect(row.discountedCost!).toBeLessThan(row.baseCost!);
  });
});

describe('C step2 · upgradeBuildingWithDiscount', () => {
  it('未解锁 → not_unlocked，不改状态', () => {
    const state = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    res.starOre = 100000;
    const r = upgradeBuildingWithDiscount(state, res, createDefaultS7Population(), 'bld_habitat');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_unlocked');
    expect(res.starOre).toBe(100000); // 未扣
  });

  it('已解锁、星矿够 → 升级成功，等级+1、扣折后星矿', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_habitat'); // lv1
    const res = createDefaultS7ResourceState();
    res.starOre = 100000;
    const expectCost = applyWorkerDiscount(buildingUpgradeStarOreCost('bld_habitat', 1)!, 0);
    const r = upgradeBuildingWithDiscount(state, res, createDefaultS7Population(), 'bld_habitat');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newLevel).toBe(2);
      expect(r.starOreSpent).toBe(expectCost);
    }
    expect(getBuildingLevel(state, 'bld_habitat')).toBe(2);
    expect(res.starOre).toBe(100000 - expectCost);
  });

  it('星矿不足 → insufficient_star_ore，不改状态', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_dock');
    const res = createDefaultS7ResourceState();
    res.starOre = 5;
    const r = upgradeBuildingWithDiscount(state, res, createDefaultS7Population(), 'bld_dock');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('insufficient_star_ore');
    expect(getBuildingLevel(state, 'bld_dock')).toBe(1); // 未升
    expect(res.starOre).toBe(5); // 未扣
  });

  it('工人折扣让同次升级少花星矿', () => {
    const mk = () => {
      const state = createDefaultS7BuildingState();
      unlockBuilding(state, 'bld_habitat');
      const res = createDefaultS7ResourceState();
      res.starOre = 100000;
      return { state, res };
    };
    const a = mk();
    upgradeBuildingWithDiscount(a.state, a.res, createDefaultS7Population(), 'bld_habitat');
    const b = mk();
    upgradeBuildingWithDiscount(b.state, b.res, { residents: 0, workers: 20 }, 'bld_habitat');
    expect(b.res.starOre).toBeGreaterThan(a.res.starOre); // 有工人 → 花更少 → 剩更多
  });

  it('升到满级后再升 → max_level', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_salvage_port'); // lv1, 系数 1.0
    const res = createDefaultS7ResourceState();
    res.starOre = 10_000_000;
    for (let i = 1; i < 10; i += 1) {
      const r = upgradeBuildingWithDiscount(state, res, createDefaultS7Population(), 'bld_salvage_port');
      expect(r.ok).toBe(true);
    }
    expect(getBuildingLevel(state, 'bld_salvage_port')).toBe(10);
    const maxed = upgradeBuildingWithDiscount(state, res, createDefaultS7Population(), 'bld_salvage_port');
    expect(maxed.ok).toBe(false);
    if (!maxed.ok) expect(maxed.code).toBe('max_level');
  });
});
