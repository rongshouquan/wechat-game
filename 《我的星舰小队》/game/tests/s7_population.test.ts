// 块6b-4b：基地人口（居民/工人）状态 + 效果 + 与离线/建筑成本的接线测试（纯 TS）。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7Population,
  normalizeS7Population,
  residentRateBonusPct,
  residentStorageExtensionHours,
  workerCostDiscountPct,
  applyWorkerDiscount,
} from '../assets/scripts/core/s7/S7Population';
import { computeOfflineGains } from '../assets/scripts/core/s7/S7OfflineProduction';
import { buildingUpgradeStarOreCost } from '../assets/scripts/core/s7/S7BuildingCost';

describe('块6b-4b 基地人口 S7Population', () => {
  it('默认 0 人口；normalize 只取非负整数、脏值落 0', () => {
    expect(createDefaultS7Population()).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population({ residents: 5, workers: 3 })).toEqual({ residents: 5, workers: 3 });
    expect(normalizeS7Population({ residents: -1, workers: 2.5 })).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population({ residents: 'x' })).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population(null)).toEqual({ residents: 0, workers: 0 });
  });

  it('居民：离线产率 +1%/人(封顶+40%)、离线存储 +0.25h/人(封顶+12h，守红线)', () => {
    expect(residentRateBonusPct(0)).toBe(0);
    expect(residentRateBonusPct(10)).toBe(10);
    expect(residentRateBonusPct(40)).toBe(40);
    expect(residentRateBonusPct(50)).toBe(40); // 封顶
    expect(residentStorageExtensionHours(0)).toBe(0);
    expect(residentStorageExtensionHours(4)).toBe(1); // 4×0.25
    expect(residentStorageExtensionHours(48)).toBe(12); // 封顶
    expect(residentStorageExtensionHours(100)).toBe(12); // 封顶
  });

  it('工人：建筑升级 -0.5%/人(封顶-30%)；折扣应用向下取整、不为负', () => {
    expect(workerCostDiscountPct(0)).toBe(0);
    expect(workerCostDiscountPct(1)).toBe(0.5);
    expect(workerCostDiscountPct(60)).toBe(30);
    expect(workerCostDiscountPct(100)).toBe(30); // 封顶
    expect(applyWorkerDiscount(1000, 0)).toBe(1000);
    expect(applyWorkerDiscount(1000, 10)).toBe(950); // -5%
    expect(applyWorkerDiscount(1000, 60)).toBe(700); // -30% 封顶
    expect(applyWorkerDiscount(0, 10)).toBe(0);
  });

  it('接线·居民喂离线：产率/存储加成经 extra* 注入生效', () => {
    const base = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre; // 300
    const withPop = computeOfflineGains(3600, {
      habitatLevel: 1,
      clearedStarfieldTier: 0,
      extraRateBonusPct: residentRateBonusPct(10), // +10%
      extraStorageHours: residentStorageExtensionHours(10), // +2.5h
    }).gains.starOre;
    expect(withPop).toBe(Math.floor(300 * 1.1)); // 330
    expect(withPop).toBeGreaterThan(base);
  });

  it('接线·工人省建筑成本：折扣应用在 S7BuildingCost 之上', () => {
    const full = buildingUpgradeStarOreCost('bld_dock', 1)!; // 156
    expect(applyWorkerDiscount(full, 10)).toBe(Math.floor(156 * 0.95)); // 148
    expect(applyWorkerDiscount(full, 10)).toBeLessThan(full);
  });
});
