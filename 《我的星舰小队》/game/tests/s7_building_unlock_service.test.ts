// M1：建筑解锁花星矿服务单测（镜像 upgradeBuilding 的判别式风格）。
import { describe, it, expect } from 'vitest';
import { createDefaultS7ResourceState } from '../assets/scripts/save/S7SaveService';
import { createDefaultS7BuildingState, unlockBuilding, isBuildingUnlocked, getBuildingLevel } from '../assets/scripts/core/s7/S7BuildingState';
import { unlockBuildingWithStarOre } from '../assets/scripts/core/s7/S7BuildingUpgradeService';

describe('unlockBuildingWithStarOre', () => {
  it('星矿够 → 解锁成功，扣星矿、等级=1', () => {
    const state = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    res.starOre = 100;
    const r = unlockBuildingWithStarOre(state, res, 'bld_dock', 50);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.starOreSpent).toBe(50);
    expect(isBuildingUnlocked(state, 'bld_dock')).toBe(true);
    expect(getBuildingLevel(state, 'bld_dock')).toBe(1);
    expect(res.starOre).toBe(50);
  });

  it('星矿不足 → insufficient_star_ore，不改状态', () => {
    const state = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    res.starOre = 10;
    const r = unlockBuildingWithStarOre(state, res, 'bld_dock', 50);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('insufficient_star_ore');
    expect(isBuildingUnlocked(state, 'bld_dock')).toBe(false);
    expect(res.starOre).toBe(10);
  });

  it('已解锁 → already_unlocked，不改状态', () => {
    const state = createDefaultS7BuildingState();
    unlockBuilding(state, 'bld_dock');
    const res = createDefaultS7ResourceState();
    res.starOre = 100;
    const r = unlockBuildingWithStarOre(state, res, 'bld_dock', 50);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('already_unlocked');
    expect(res.starOre).toBe(100);
  });

  it('成本非法（负数/小数）→ bad_cost，不改状态', () => {
    const state = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    res.starOre = 100;
    const r1 = unlockBuildingWithStarOre(state, res, 'bld_dock', -1);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('bad_cost');
    const r2 = unlockBuildingWithStarOre(state, res, 'bld_dock', 1.5);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('bad_cost');
    expect(isBuildingUnlocked(state, 'bld_dock')).toBe(false);
    expect(res.starOre).toBe(100);
  });
});
