// 建筑数值对表测试（步5 收尾批重定基=A9-1 主对表：运行时值==细案 v1/初值表 v0.7 校准值·逐级钉死）。
// 重定基总说明（旧→新→为什么对）：
//   ① 成本：round(120×L^1.3×系数) → ×3.0 全局系数（v0.7 buildingCostMult=星矿真实长期 sink·压死溢出死水）；
//   ② 打捞队 1/2/3 → 3/4/5（细案④ Ron 拍板·原 1/2/3 作废）；
//   ③ 居住舱产率 (lv−1)×2 → 逐级表 [2,4,6,8,8,10,12,14,16,18]（细案③·Lv5=积压里程碑级不加产率）；
//   ④ 补给站 +0.5%/级顶 5 → 垫层逐级表顶 +2.5pp（入尺实测面值 +5pp 近 7 倍过热砍半·初值表 §15）；
//   ⑤ 商人槽 2-6 → 稀有格 1/2/3（Lv1/4/7=Ron 亲排 10 级表）；
//   ⑥ 展厅每种 0.3→0.6 线性 → 逐级表（Lv3/6=分红里程碑级不加收藏）；
//   ⑦ 新增八面：折扣线×2/工人费率/编制/积压/惊喜线/免费抽·九折/双层分红/双黄蛋。
import { describe, it, expect } from 'vitest';
import {
  buildingUpgradeStarOreCost,
  buildingCostTierMultiplier,
  discountedBuildingUpgradeCost,
  BUILDING_COST_GLOBAL_MULT,
} from '../assets/scripts/core/s7/S7BuildingCost';
import {
  offlineStorageHours,
  offlineRateBonusPct,
  habitatStaffCap,
  bountyBoardCap,
  workerBuildDiscountPct,
  salvageTeamCount,
  salvageSurpriseBonusPct,
  salvageExtraSurpriseRoll,
  dockAlloyDiscountMult,
  trainingTokenDiscountMult,
  dockPresetSlots,
  trainingDailyBoostSlots,
  trainingDailyBoostPct,
  researchTeamBonusPct,
  researchProjectSlots,
  coreGalleryPerTypeBonusPct,
  coreGalleryTeamBonusPct,
  CORE_GALLERY_TOTAL_BONUS_CAP_PCT,
  galleryDailyDividend,
  galleryDoubleYolkP,
  supplyATierRateBumpPct,
  supplyFreeDailyPulls,
  supplyTenPullTicketCost,
  merchantRareSlots,
  merchantRecycleSteps,
  merchantPriceMult,
  UPGRADE_DISCOUNT_PCT_PER_LEVEL,
} from '../assets/scripts/core/s7/S7BuildingEffects';

describe('建筑升级成本 S7BuildingCost（×3.0 全局系数=v0.7）', () => {
  it('重要度系数分 3 档（核心1.3/重要1.1/普通1.0，未知1.0）', () => {
    expect(buildingCostTierMultiplier('bld_dock')).toBe(1.3);
    expect(buildingCostTierMultiplier('bld_pilot_training_bay')).toBe(1.3);
    expect(buildingCostTierMultiplier('bld_habitat')).toBe(1.1);
    expect(buildingCostTierMultiplier('bld_supply_station')).toBe(1.1);
    expect(buildingCostTierMultiplier('bld_salvage_port')).toBe(1.0);
    expect(buildingCostTierMultiplier('bld_rsv_core_gallery')).toBe(1.0);
    expect(buildingCostTierMultiplier('bld_unknown_xyz')).toBe(1.0); // 与配置解耦：未知→普通档
  });

  it('成本公式 round(round(120×L^1.3×系数)×3.0)：×3=尺子校准解（机器真源 buildingCostMult）', () => {
    expect(BUILDING_COST_GLOBAL_MULT).toBe(3.0);
    // 旧→新：120→360 / 295→885 / 2088→6264 / 156→468 / 2714→8142（全=旧值×3·内层 round 不变）。
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 1)).toBe(360);
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 2)).toBe(885);
    expect(buildingUpgradeStarOreCost('bld_salvage_port', 9)).toBe(6264);
    expect(buildingUpgradeStarOreCost('bld_dock', 1)).toBe(468);
    expect(buildingUpgradeStarOreCost('bld_dock', 9)).toBe(8142);
  });

  it('工人折扣应用：round(原价×(1−折扣%))', () => {
    expect(discountedBuildingUpgradeCost(468, 10)).toBe(421);
    expect(discountedBuildingUpgradeCost(468, 25)).toBe(351);
    expect(discountedBuildingUpgradeCost(468, 0)).toBe(468);
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

describe('①② 船坞/训练舱：折扣线 −1.5%/级顶 −15% + 功能件数值面（细案①②）', () => {
  it('折扣乘数：lv0=1 / lv1=0.985 / lv10=0.85（只折升级币·专属碎片结构性不经过）', () => {
    expect(UPGRADE_DISCOUNT_PCT_PER_LEVEL).toBe(1.5);
    expect(dockAlloyDiscountMult(0)).toBe(1);
    expect(dockAlloyDiscountMult(1)).toBeCloseTo(0.985, 10);
    expect(dockAlloyDiscountMult(10)).toBeCloseTo(0.85, 10);
    expect(trainingTokenDiscountMult(4)).toBeCloseTo(0.94, 10);
    expect(trainingTokenDiscountMult(10)).toBeCloseTo(0.85, 10);
  });

  it('阵容预设槽 Lv4/7/10=1/2/3；每日特训 Lv4=1名+3%·Lv10=2名+6%（UI 挂灰盒批）', () => {
    expect([dockPresetSlots(3), dockPresetSlots(4), dockPresetSlots(7), dockPresetSlots(10)]).toEqual([0, 1, 2, 3]);
    expect([trainingDailyBoostSlots(3), trainingDailyBoostSlots(4), trainingDailyBoostSlots(10)]).toEqual([0, 1, 2]);
    expect([trainingDailyBoostPct(3), trainingDailyBoostPct(4), trainingDailyBoostPct(10)]).toEqual([0, 3, 6]);
  });
});

describe('③ 居住舱：仓/产率逐级表 + 有效编制 + 积压 + 工人费率（细案③）', () => {
  it('离线存储逐级表 36→48h（机器真源 habitatStorageHours）', () => {
    expect(offlineStorageHours(0)).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(offlineStorageHours)).toEqual([36, 37, 39, 40, 42, 43, 44, 45, 47, 48]);
  });

  it('产率逐级表 lv1=+2 → lv10=+18（Lv5 持平=积压里程碑级·旧线性 lv1=0 作废）', () => {
    expect(offlineRateBonusPct(0)).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(offlineRateBonusPct)).toEqual([2, 4, 6, 8, 8, 10, 12, 14, 16, 18]);
  });

  it('有效编制 6+2/级（lv1=8 → lv10=26·人口数量无上限口径的数值面）', () => {
    expect(habitatStaffCap(0)).toBe(0);
    expect(habitatStaffCap(1)).toBe(8);
    expect(habitatStaffCap(5)).toBe(16);
    expect(habitatStaffCap(10)).toBe(26);
  });

  it('委托积压 6/9/12（基础/Lv5/Lv10·原 12/16/20 作废）', () => {
    expect(bountyBoardCap(0)).toBe(6);
    expect(bountyBoardCap(5)).toBe(9);
    expect(bountyBoardCap(10)).toBe(12);
  });

  it('工人费率新规：Lv3 门 + 1/1.5/2%/名 + 封顶 25%（编制内截断）', () => {
    expect(workerBuildDiscountPct(2, 20)).toBe(0);      // 门槛前无折扣
    expect(workerBuildDiscountPct(3, 5)).toBe(5);       // Lv3=1%/名
    expect(workerBuildDiscountPct(6, 10)).toBe(15);     // Lv6=1.5%/名
    expect(workerBuildDiscountPct(10, 10)).toBe(20);    // Lv10=2%/名
    expect(workerBuildDiscountPct(10, 26)).toBe(25);    // 26×2=52 → 封顶 25
    expect(workerBuildDiscountPct(3, 100)).toBe(12);    // Lv3 编制=6+2×3=12·超编截断 → 12×1%=12%
  });
});

describe('④ 打捞港：队数 3/4/5 + 稀有发现惊喜线（细案④）', () => {
  it('打捞队 3/4/5（Lv1/4/7·原 1/2/3 作废）', () => {
    expect(salvageTeamCount(0)).toBe(0);
    expect(salvageTeamCount(1)).toBe(3);
    expect(salvageTeamCount(3)).toBe(3);
    expect(salvageTeamCount(4)).toBe(4);
    expect(salvageTeamCount(6)).toBe(4);
    expect(salvageTeamCount(7)).toBe(5);
    expect(salvageTeamCount(10)).toBe(5);
  });

  it('稀有发现 +5%/档：Lv9=+30% / Lv10=+35%（惊喜线四族专用）', () => {
    expect(salvageSurpriseBonusPct(0)).toBe(0);
    expect(salvageSurpriseBonusPct(2)).toBe(5);
    expect(salvageSurpriseBonusPct(9)).toBe(30);
    expect(salvageSurpriseBonusPct(10)).toBe(35);
  });

  it('Lv10：24h 长趟额外一次惊喜掷骰（短趟不给）', () => {
    expect(salvageExtraSurpriseRoll(10, 24)).toBe(true);
    expect(salvageExtraSurpriseRoll(10, 8)).toBe(false);
    expect(salvageExtraSurpriseRoll(9, 24)).toBe(false);
  });
});

describe('⑤ 商人小站：稀有格/回收档/九折（Ron 亲排 10 级表）', () => {
  it('稀有格 Lv1×1/Lv4×2/Lv7×3', () => {
    expect(merchantRareSlots(0)).toBe(0);
    expect(merchantRareSlots(1)).toBe(1);
    expect(merchantRareSlots(4)).toBe(2);
    expect(merchantRareSlots(7)).toBe(3);
    expect(merchantRareSlots(10)).toBe(3);
  });

  it('回收价档 Lv3/6/9 各 +1 档；Lv10 全场九折', () => {
    expect([merchantRecycleSteps(2), merchantRecycleSteps(3), merchantRecycleSteps(6), merchantRecycleSteps(9)]).toEqual([0, 1, 2, 3]);
    expect(merchantPriceMult(9)).toBe(1);
    expect(merchantPriceMult(10)).toBe(0.9);
  });
});

describe('⑥ 补给站：垫层/免费抽/十连九折（细案⑥）', () => {
  it('A 级垫层逐级表·封顶 +2.5pp（面值 +5pp 入尺过热砍半=初值表 §15）', () => {
    expect(supplyATierRateBumpPct(0)).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(supplyATierRateBumpPct)).toEqual([0.25, 0.5, 0.75, 0.75, 1.0, 1.25, 1.25, 1.5, 1.75, 2.5]);
  });

  it('每日免费抽 Lv4=1/Lv7=2；十连券价 Lv10=9（九折）', () => {
    expect([supplyFreeDailyPulls(3), supplyFreeDailyPulls(4), supplyFreeDailyPulls(7)]).toEqual([0, 1, 2]);
    expect(supplyTenPullTicketCost(9)).toBe(10);
    expect(supplyTenPullTicketCost(10)).toBe(9);
  });
});

describe('⑦ 研究塔：+1%/级 + 研究槽（细案⑦）', () => {
  it('全队 +1%/级 → lv10=+10%；研究槽 Lv3/6=1/2', () => {
    expect(researchTeamBonusPct(0)).toBe(0);
    expect(researchTeamBonusPct(10)).toBe(10);
    expect([researchProjectSlots(2), researchProjectSlots(3), researchProjectSlots(6)]).toEqual([0, 1, 2]);
  });
});

describe('⑧ 星核展厅：收藏逐级表 + 双层分红 + 双黄蛋（细案⑧乙案·Ron 拍案A）', () => {
  it('收藏加成逐级表 0.30→0.60（Lv3/6=分红里程碑级不加收藏）·封顶 10%', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(coreGalleryPerTypeBonusPct)).toEqual([0.30, 0.33, 0.33, 0.40, 0.43, 0.43, 0.48, 0.52, 0.57, 0.60]);
    expect(coreGalleryTeamBonusPct(1, 0)).toBe(0); // 没收集=0
    expect(coreGalleryTeamBonusPct(0, 5)).toBe(0); // 未解锁=0
    expect(coreGalleryTeamBonusPct(1, 3)).toBeCloseTo(0.9, 5); // 0.3×3
    expect(coreGalleryTeamBonusPct(10, 5)).toBeCloseTo(3.0, 5); // 0.6×5
    expect(coreGalleryTeamBonusPct(10, 100)).toBe(CORE_GALLERY_TOTAL_BONUS_CAP_PCT); // 封顶 10
  });

  it('双层分红：Lv3 碎片 0.10/种/日·Lv6 宝石 0.10/种/日（两轮压定=心跳带+核碎地理）', () => {
    expect(galleryDailyDividend(2, 10)).toEqual({ coreFrag: 0, starGem: 0 });
    expect(galleryDailyDividend(3, 10)).toEqual({ coreFrag: 1.0, starGem: 0 });
    expect(galleryDailyDividend(6, 10)).toEqual({ coreFrag: 1.0, starGem: 1.0 });
    expect(galleryDailyDividend(10, 16).coreFrag).toBeCloseTo(1.6, 10); // 毕业后 16 种=1.6/日=长线主场
  });

  it('双黄蛋 Lv10=3%（Ron 拍案A·未满级 0）', () => {
    expect(galleryDoubleYolkP(9)).toBe(0);
    expect(galleryDoubleYolkP(10)).toBe(0.03);
  });
});
