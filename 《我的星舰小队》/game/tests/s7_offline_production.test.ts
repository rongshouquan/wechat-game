// 块6b-4a：离线产出纯函数测试。星域系数(主线进度乘区) + 产率(居住舱/额外加成) + 上限/溢出 + 边界。
import { describe, it, expect } from 'vitest';
import {
  computeOfflineGains,
  starfieldCoefficient,
  OFFLINE_BASE_RATE_PER_HOUR,
} from '../assets/scripts/core/s7/S7OfflineProduction';

describe('块6b-4a 离线产出 S7OfflineProduction', () => {
  it('星域系数随已通关最高星域升（主线进度乘区），越界向下夹', () => {
    expect(starfieldCoefficient(0)).toBe(1.0);
    expect(starfieldCoefficient(1)).toBe(1.6);
    expect(starfieldCoefficient(2)).toBe(2.6);
    expect(starfieldCoefficient(3)).toBe(4.0);
    expect(starfieldCoefficient(4)).toBe(6.0);
    expect(starfieldCoefficient(9)).toBe(6.0); // 越界夹到顶档
    expect(starfieldCoefficient(-1)).toBe(1.0); // 负→0档
  });

  it('基础产率：居住舱lv1、未通关星域、1小时 → 各软货币 = 基础值', () => {
    const r = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 });
    expect(r.gains.starOre).toBe(OFFLINE_BASE_RATE_PER_HOUR.starOre); // 300
    expect(r.gains.hullAlloy).toBe(OFFLINE_BASE_RATE_PER_HOUR.hullAlloy); // 120
    expect(r.gains.pilotToken).toBe(OFFLINE_BASE_RATE_PER_HOUR.pilotToken); // 80
    expect(r.overflowed).toBe(false);
  });

  it('主线进度抬产率：通关星域档↑ → 同时长进账成倍（×星域系数）', () => {
    const base = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre;
    const tier2 = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 2 }).gains.starOre;
    expect(tier2).toBe(Math.floor(base * 2.6)); // 300×2.6=780
    expect(tier2).toBeGreaterThan(base);
  });

  it('居住舱产率加成：lv10(+18%) 比 lv1 多产', () => {
    const lv1 = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre;
    const lv10 = computeOfflineGains(3600, { habitatLevel: 10, clearedStarfieldTier: 0 }).gains.starOre;
    expect(lv10).toBe(Math.floor(300 * 1.18)); // 354
    expect(lv10).toBeGreaterThan(lv1);
  });

  it('额外产率加成（居民6b-4b注入）叠加生效', () => {
    const without = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre;
    const withResidents = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0, extraRateBonusPct: 10 }).gains.starOre;
    expect(withResidents).toBe(Math.floor(300 * 1.1)); // 330
    expect(withResidents).toBeGreaterThan(without);
  });

  it('上限封顶：离线过久撞居住舱存储上限、溢出浪费', () => {
    const r = computeOfflineGains(100 * 3600, { habitatLevel: 1, clearedStarfieldTier: 0 }); // 100h ≫ 36h
    expect(r.capSeconds).toBe(36 * 3600); // 居住舱lv1=36h
    expect(r.effectiveSeconds).toBe(36 * 3600);
    expect(r.overflowed).toBe(true);
    expect(r.gains.starOre).toBe(300 * 36); // 10800，只算满上限
  });

  it('额外存储延长（居民6b-4b注入）抬高上限', () => {
    const r = computeOfflineGains(40 * 3600, { habitatLevel: 1, clearedStarfieldTier: 0, extraStorageHours: 12 }); // 上限 36+12=48h
    expect(r.capSeconds).toBe(48 * 3600);
    expect(r.effectiveSeconds).toBe(40 * 3600); // 40h<48h，未截断
    expect(r.overflowed).toBe(false);
  });

  it('居住舱未解锁(lv0)=无离线；经过秒数 0/负 → 零进账', () => {
    const noHab = computeOfflineGains(3600, { habitatLevel: 0, clearedStarfieldTier: 4 });
    expect(noHab.capSeconds).toBe(0);
    expect(noHab.gains.starOre).toBe(0);
    const zero = computeOfflineGains(0, { habitatLevel: 5, clearedStarfieldTier: 2 });
    expect(zero.gains.starOre).toBe(0);
    const neg = computeOfflineGains(-100, { habitatLevel: 5, clearedStarfieldTier: 2 });
    expect(neg.gains.starOre).toBe(0);
  });
});
