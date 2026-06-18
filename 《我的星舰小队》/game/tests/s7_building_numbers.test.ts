// 块6b-3：建筑数值（成本曲线 + 各级效果）测试（纯 TS）。数值见 第二块-数值设计/建筑数值-6b3 v0.2。
import { describe, it, expect } from 'vitest';
import {
  buildingUpgradeStarOreCost,
  buildingCostTierMultiplier,
} from '../assets/scripts/core/s7/S7BuildingCost';
import {
  shipLevelCap,
  driverLevelCap,
  offlineStorageHours,
  offlineRateBonusPct,
  salvageTeamCount,
  researchTeamBonusPct,
  coreGalleryPerTypeBonusPct,
  coreGalleryTeamBonusPct,
  CORE_GALLERY_TOTAL_BONUS_CAP_PCT,
  supplyGachaTopRateBonusPct,
  merchantShopSlots,
  merchantDailyFreeRefresh,
} from '../assets/scripts/core/s7/S7BuildingEffects';

describe('块6b-3 建筑升级成本 S7BuildingCost', () => {
  it('重要度系数分 3 档（核心1.3/重要1.1/普通1.0，未知1.0）', () => {
    expect(buildingCostTierMultiplier('bld_dock')).toBe(1.3);
    expect(buildingCostTierMultiplier('bld_pilot_training_bay')).toBe(1.3);
    expect(buildingCostTierMultiplier('bld_habitat')).toBe(1.1);
    expect(buildingCostTierMultiplier('bld_supply_station')).toBe(1.1);
    expect(buildingCostTierMultiplier('bld_salvage_port')).toBe(1.0);
    expect(buildingCostTierMultiplier('bld_rsv_core_gallery')).toBe(1.0);
    expect(buildingCostTierMultiplier('bld_unknown_xyz')).toBe(1.0); // 与配置解耦：未知→普通档
  });

  it('成本公式 round(120×L^1.3×系数)：基准曲线与核心档对齐数值文档', () => {
    // 普通档（×1.0）
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 1)).toBe(120);
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 2)).toBe(295);
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 9)).toBe(2088);
    // 核心档（×1.3）
    expect(buildingUpgradeStarOreCost('bld_dock', 1)).toBe(156);
    expect(buildingUpgradeStarOreCost('bld_dock', 9)).toBe(2714);
  });

  it('成本逐级递增（普通档 1→9）', () => {
    let prev = -1;
    for (let lv = 1; lv <= 9; lv++) {
      const c = buildingUpgradeStarOreCost('bld_salvage_port', lv)!;
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it('满级/未解锁/非整数 → null（无升级成本）', () => {
    expect(buildingUpgradeStarOreCost('bld_dock', 10)).toBeNull(); // 满级
    expect(buildingUpgradeStarOreCost('bld_dock', 0)).toBeNull(); // 未解锁
    expect(buildingUpgradeStarOreCost('bld_dock', 11)).toBeNull(); // 越界
    expect(buildingUpgradeStarOreCost('bld_dock', 3.5)).toBeNull(); // 非整数
  });
});

describe('块6b-3 建筑各级效果 S7BuildingEffects', () => {
  it('船坞 / 训练舱：等级上限 = 楼级 × 5（未解锁=0、越级夹到上限）', () => {
    expect(shipLevelCap(0)).toBe(0);
    expect(shipLevelCap(1)).toBe(5);
    expect(shipLevelCap(3)).toBe(15); // 对齐 B1 D7 主力15
    expect(shipLevelCap(10)).toBe(50);
    expect(shipLevelCap(11)).toBe(50); // 越级夹到 MAX
    expect(shipLevelCap(-1)).toBe(0);
    expect(driverLevelCap(7)).toBe(35); // 与船坞对称
  });

  it('居住舱：离线存储 36→48h、产率 +2%/级(lv1=0→lv10=18)', () => {
    expect(offlineStorageHours(0)).toBe(0);
    expect(offlineStorageHours(1)).toBe(36);
    expect(offlineStorageHours(10)).toBe(48); // 守 2 天红线
    expect(offlineRateBonusPct(1)).toBe(0);
    expect(offlineRateBonusPct(10)).toBe(18);
  });

  it('打捞港：打捞队 1/2/3（lv1-3/4-6/7-10）', () => {
    expect(salvageTeamCount(0)).toBe(0);
    expect(salvageTeamCount(1)).toBe(1);
    expect(salvageTeamCount(3)).toBe(1);
    expect(salvageTeamCount(4)).toBe(2);
    expect(salvageTeamCount(6)).toBe(2);
    expect(salvageTeamCount(7)).toBe(3);
    expect(salvageTeamCount(10)).toBe(3);
  });

  it('研究塔：全队 +1%/级 → lv10=+10%', () => {
    expect(researchTeamBonusPct(0)).toBe(0);
    expect(researchTeamBonusPct(1)).toBe(1);
    expect(researchTeamBonusPct(10)).toBe(10);
  });

  it('星核展厅：每种 0.3→0.6%，总加成=每种×种数、封顶 10%（收集变强）', () => {
    expect(coreGalleryPerTypeBonusPct(1)).toBeCloseTo(0.3, 5);
    expect(coreGalleryPerTypeBonusPct(10)).toBeCloseTo(0.6, 5);
    expect(coreGalleryTeamBonusPct(1, 0)).toBe(0); // 没收集=0
    expect(coreGalleryTeamBonusPct(0, 5)).toBe(0); // 未解锁=0
    expect(coreGalleryTeamBonusPct(1, 3)).toBeCloseTo(0.9, 5); // 0.3×3
    expect(coreGalleryTeamBonusPct(10, 5)).toBeCloseTo(3.0, 5); // 0.6×5
    expect(coreGalleryTeamBonusPct(10, 100)).toBe(CORE_GALLERY_TOTAL_BONUS_CAP_PCT); // 封顶 10
  });

  it('星港补给站：A级/3★ 出率 +0.5%/级 → lv10=+5%（占位，并入§10.1）', () => {
    expect(supplyGachaTopRateBonusPct(0)).toBe(0);
    expect(supplyGachaTopRateBonusPct(1)).toBe(0.5);
    expect(supplyGachaTopRateBonusPct(10)).toBe(5);
  });

  it('商人小站：商品槽位 2→6、每日免费刷新 1/2/3', () => {
    expect(merchantShopSlots(0)).toBe(0);
    expect(merchantShopSlots(1)).toBe(2);
    expect(merchantShopSlots(3)).toBe(3);
    expect(merchantShopSlots(10)).toBe(6);
    expect(merchantDailyFreeRefresh(5)).toBe(1);
    expect(merchantDailyFreeRefresh(6)).toBe(2);
    expect(merchantDailyFreeRefresh(10)).toBe(3);
  });
});
