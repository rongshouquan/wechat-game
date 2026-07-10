// 块6b-4a：离线产出纯函数测试（步5 收尾批重定基·初值表 v0.7 终值）。
// 重定基（旧→新→为什么对）：
//   ① 基础产率 300/120/80（v0.1 占位）→ 62/24/16（v0.7：星矿 62=步3 减产·合金 24/记录 16=B1 底垫 ×0.8）；
//   ② 星域系数 5 档 [1,1.6,2.6,4,6] → 7 档 [1,1.7,2.7,4,5.8,8.2,10.5]（v0.7 regionCoef·6 星域拓扑=0-6 档）；
//   ③ 新增：星矿星域乘区 ^0.5（oreCoefPow=星矿是十级封顶建筑币·全速乘区溢出成死水·步3 A1）；
//   ④ 居住舱产率 lv1=+2%（细案③逐级表 [2,4,6,8,8,10,12,14,16,18]·旧 (lv−1)×2 的 lv1=0 作废）。
import { describe, it, expect } from 'vitest';
import {
  computeOfflineGains,
  starfieldCoefficient,
  OFFLINE_BASE_RATE_PER_HOUR,
  STARFIELD_COEF_TABLE,
  ORE_COEF_POW,
} from '../assets/scripts/core/s7/S7OfflineProduction';

describe('块6b-4a 离线产出 S7OfflineProduction', () => {
  it('对表：基础产率==v0.7 终值（星矿62/合金24/记录16）·系数表==7 档 regionCoef', () => {
    expect(OFFLINE_BASE_RATE_PER_HOUR).toEqual({ starOre: 62, hullAlloy: 24, pilotToken: 16 });
    expect(STARFIELD_COEF_TABLE).toEqual([1.0, 1.7, 2.7, 4.0, 5.8, 8.2, 10.5]);
    expect(ORE_COEF_POW).toBe(0.5);
  });

  it('星域系数随已通关星域数升（主线进度乘区），越界向下夹', () => {
    expect(starfieldCoefficient(0)).toBe(1.0);
    expect(starfieldCoefficient(1)).toBe(1.7);
    expect(starfieldCoefficient(2)).toBe(2.7);
    expect(starfieldCoefficient(3)).toBe(4.0);
    expect(starfieldCoefficient(4)).toBe(5.8);
    expect(starfieldCoefficient(5)).toBe(8.2);
    expect(starfieldCoefficient(6)).toBe(10.5);
    expect(starfieldCoefficient(9)).toBe(10.5); // 越界夹到顶档
    expect(starfieldCoefficient(-1)).toBe(1.0); // 负→0档
  });

  it('基础产率：居住舱lv1（+2%·细案③逐级表）、未通关星域、1小时 → 基础值×1.02', () => {
    const r = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 });
    expect(r.gains.starOre).toBe(Math.floor(62 * 1.02)); // 63
    expect(r.gains.hullAlloy).toBe(Math.floor(24 * 1.02)); // 24
    expect(r.gains.pilotToken).toBe(Math.floor(16 * 1.02)); // 16
    expect(r.overflowed).toBe(false);
  });

  it('主线进度抬产率：合金/记录全系数·星矿走 ^0.5 开方衰减（v0.7 oreCoefPow）', () => {
    const t2 = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 2 }).gains;
    expect(t2.hullAlloy).toBe(Math.floor(24 * 2.7 * 1.02)); // 66=全系数
    expect(t2.starOre).toBe(Math.floor(62 * Math.pow(2.7, 0.5) * 1.02)); // 103=开方衰减
    expect(t2.starOre).toBeLessThan(Math.floor(62 * 2.7 * 1.02)); // 星矿被衰减（<全系数 170）
  });

  it('居住舱产率加成：lv10(+18%) 比 lv1(+2%) 多产', () => {
    const lv1 = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre;
    const lv10 = computeOfflineGains(3600, { habitatLevel: 10, clearedStarfieldTier: 0 }).gains.starOre;
    expect(lv10).toBe(Math.floor(62 * 1.18)); // 73
    expect(lv10).toBeGreaterThan(lv1);
  });

  it('额外产率加成（居民6b-4b注入）叠加生效', () => {
    const without = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre;
    const withResidents = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0, extraRateBonusPct: 10 }).gains.starOre;
    expect(withResidents).toBe(Math.floor(62 * 1.12)); // 69（居住舱2%+居民10%）
    expect(withResidents).toBeGreaterThan(without);
  });

  it('上限封顶：离线过久撞居住舱存储上限、溢出浪费', () => {
    const r = computeOfflineGains(100 * 3600, { habitatLevel: 1, clearedStarfieldTier: 0 }); // 100h ≫ 36h
    expect(r.capSeconds).toBe(36 * 3600); // 居住舱lv1=36h
    expect(r.effectiveSeconds).toBe(36 * 3600);
    expect(r.overflowed).toBe(true);
    expect(r.gains.starOre).toBe(Math.floor(62 * 1.02 * 36)); // 2276·只算满上限
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
