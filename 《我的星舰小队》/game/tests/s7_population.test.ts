// 块6b-4b：基地人口（居民/工人）状态 + 效果 + 接线测试（步5 收尾批重定基·细案③人口新口径）。
// 重定基（旧→新→为什么对）：
//   ① 居民产率"+1%/人封顶40" → "+1%/人·编制内"（有效编制 6+2/级=细案③"人口无上限·超编纯人气"·封顶=编制）；
//   ② 居民存储"+0.25h/人顶12h" → "+0.5h/人顶6h"（机器真源 min(6, residents×0.5)）；
//   ③ 工人"-0.5%/人无门槛顶30"（S7Population 旧线）→ 细案③费率新规（居住舱 Lv3 门+1/1.5/2%/名+封顶25%
//     =S7BuildingEffects.workerBuildDiscountPct·见 s7_building_numbers 测试），本文件只验旧函数已退役+居民线。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7Population,
  normalizeS7Population,
  residentRateBonusPct,
  residentStorageExtensionHours,
  effectiveStaff,
} from '../assets/scripts/core/s7/S7Population';
import { habitatStaffCap, workerBuildDiscountPct } from '../assets/scripts/core/s7/S7BuildingEffects';
import { computeOfflineGains } from '../assets/scripts/core/s7/S7OfflineProduction';
import { buildingUpgradeStarOreCost, discountedBuildingUpgradeCost } from '../assets/scripts/core/s7/S7BuildingCost';

describe('块6b-4b 基地人口 S7Population', () => {
  it('默认 0 人口；normalize 只取非负整数、脏值落 0', () => {
    expect(createDefaultS7Population()).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population({ residents: 5, workers: 3 })).toEqual({ residents: 5, workers: 3 });
    expect(normalizeS7Population({ residents: -1, workers: 2.5 })).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population({ residents: 'x' })).toEqual({ residents: 0, workers: 0 });
    expect(normalizeS7Population(null)).toEqual({ residents: 0, workers: 0 });
  });

  it('有效编制截断：超编纯人气不加成（细案③·数量无上限）', () => {
    expect(effectiveStaff(10, 8)).toBe(8);   // 超编截断
    expect(effectiveStaff(5, 8)).toBe(5);    // 编制内全算
    expect(effectiveStaff(-3, 8)).toBe(0);   // 脏值
    expect(habitatStaffCap(1)).toBe(8);      // 6+2×1
    expect(habitatStaffCap(10)).toBe(26);    // 6+2×10（Lv10=26 人贡献数值）
    expect(habitatStaffCap(0)).toBe(0);      // 未解锁
  });

  it('居民：离线产率 +1%/人（编制内）、离线存储 +0.5h/人（封顶 +6h·机器真源）', () => {
    const cap10 = habitatStaffCap(10); // 26
    expect(residentRateBonusPct(0, cap10)).toBe(0);
    expect(residentRateBonusPct(10, cap10)).toBe(10);
    expect(residentRateBonusPct(30, cap10)).toBe(26); // 超编截断到编制 26（旧绝对封顶 40 作废）
    expect(residentStorageExtensionHours(0, cap10)).toBe(0);
    expect(residentStorageExtensionHours(4, cap10)).toBe(2); // 4×0.5（旧 0.25h/人作废）
    expect(residentStorageExtensionHours(20, cap10)).toBe(6); // 封顶 +6h（旧 12h 作废·守追赶红线）
  });

  it('工人：细案③费率新规（Lv3 门+费率升档+封顶25%·经 S7BuildingEffects）', () => {
    expect(workerBuildDiscountPct(2, 10)).toBe(0);   // 居住舱 <Lv3 无折扣（解锁门）
    expect(workerBuildDiscountPct(3, 10)).toBe(10);  // Lv3 费率 1%/名
    expect(workerBuildDiscountPct(6, 10)).toBe(15);  // Lv6 费率 1.5%/名
    expect(workerBuildDiscountPct(10, 10)).toBe(20); // Lv10 费率 2%/名
    expect(workerBuildDiscountPct(10, 30)).toBe(25); // 封顶 25%（30 人超编截断到 26·26×2=52→25）
  });

  it('接线·居民喂离线：产率/存储加成经 extra* 注入生效（v0.7 基础产率 62）', () => {
    const cap = habitatStaffCap(1); // 8
    const base = computeOfflineGains(3600, { habitatLevel: 1, clearedStarfieldTier: 0 }).gains.starOre; // 63
    const withPop = computeOfflineGains(3600, {
      habitatLevel: 1,
      clearedStarfieldTier: 0,
      extraRateBonusPct: residentRateBonusPct(8, cap), // +8%（编制内 8 人）
      extraStorageHours: residentStorageExtensionHours(8, cap), // +4h
    }).gains.starOre;
    expect(withPop).toBe(Math.floor(62 * 1.10)); // 68（居住舱2%+居民8%）
    expect(withPop).toBeGreaterThan(base);
  });

  it('接线·工人省建筑成本：新折扣径 round(原价×(1−折扣%))（原价=inner×3 全局系数）', () => {
    const full = buildingUpgradeStarOreCost('bld_dock', 1)!; // round(120×1^1.3×1.3)=156 → ×3=468
    expect(full).toBe(468);
    expect(discountedBuildingUpgradeCost(full, workerBuildDiscountPct(3, 10))).toBe(Math.round(468 * 0.9)); // 421
    expect(discountedBuildingUpgradeCost(full, 0)).toBe(468);
    expect(discountedBuildingUpgradeCost(0, 10)).toBe(0);
  });
});
