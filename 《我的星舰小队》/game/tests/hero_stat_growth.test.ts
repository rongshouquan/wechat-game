import { describe, it, expect } from 'vitest';
import { computeHeroFinalStats } from '../assets/scripts/core/HeroStatGrowthService';
import { computeUpgradeCost } from '../assets/scripts/core/PlayerState';
import { calculateOfflineReward, DEFAULT_OFFLINE_REWARD_CONFIG } from '../assets/scripts/core/OfflineRewardService';

const MS_PER_HOUR = 60 * 60 * 1000;

describe('S5C-05 §3.1 英雄等级属性折算', () => {
  // hero_isen 基础值：hp 680 / atk 92 / def 40
  const isenBase = { hp: 680, atk: 92, def: 40 };

  it('1 级返回基础值（levelBonus 下限 0，不放大）', () => {
    expect(computeHeroFinalStats(isenBase, 1)).toEqual({ hp: 680, atk: 92, def: 40 });
  });

  it('等级 <=1（含 0/负）按基础值处理', () => {
    expect(computeHeroFinalStats(isenBase, 0)).toEqual({ hp: 680, atk: 92, def: 40 });
  });

  it('3 级按草案公式折算并四舍五入', () => {
    // levelBonus=2: hp=680*(1+0.44)=979.2→979, atk=92*(1+0.36)=125.12→125, def=40*(1+0.28)=51.2→51
    expect(computeHeroFinalStats(isenBase, 3)).toEqual({ hp: 979, atk: 125, def: 51 });
  });

  it('5 级按草案公式折算并四舍五入', () => {
    // levelBonus=4: hp=680*1.88=1278.4→1278, atk=92*1.72=158.24→158, def=40*1.56=62.4→62
    expect(computeHeroFinalStats(isenBase, 5)).toEqual({ hp: 1278, atk: 158, def: 62 });
  });

  it('属性随等级单调不减', () => {
    let prevHp = 0;
    for (let lv = 1; lv <= 6; lv++) {
      const s = computeHeroFinalStats(isenBase, lv);
      expect(s.hp).toBeGreaterThanOrEqual(prevHp);
      prevHp = s.hp;
    }
  });
});

describe('S5C-05 §3.2 升级消耗曲线', () => {
  it('逐级消耗与草案对照表一致', () => {
    const table: Record<number, { starCoin: number; expChip: number }> = {
      1: { starCoin: 60, expChip: 12 },
      2: { starCoin: 100, expChip: 20 },
      3: { starCoin: 140, expChip: 28 },
      4: { starCoin: 200, expChip: 40 },
      5: { starCoin: 260, expChip: 52 },
      6: { starCoin: 320, expChip: 64 },
    };
    for (const [lvStr, expected] of Object.entries(table)) {
      expect(computeUpgradeCost(Number(lvStr))).toEqual(expected);
    }
  });

  it('等级 <1 按 1 级消耗（防御性下限）', () => {
    expect(computeUpgradeCost(0)).toEqual({ starCoin: 60, expChip: 12 });
  });
});

describe('S5C-05 §3.5 默认离线收益 120/24，8 小时封顶 960/192', () => {
  it('默认配置每小时 120/24', () => {
    expect(DEFAULT_OFFLINE_REWARD_CONFIG.maxOfflineHours).toBe(8);
    expect(DEFAULT_OFFLINE_REWARD_CONFIG.baseRate).toEqual({ starCoinPerHour: 120, expChipPerHour: 24 });
  });

  it('离线 1 小时收益为 120/24', () => {
    const calc = calculateOfflineReward({ lastOnlineTime: 0, now: MS_PER_HOUR, hasProgress: true });
    expect(calc.reward).toEqual({ starCoin: 120, expChip: 24 });
  });

  it('离线 8 小时封顶 960/192', () => {
    const calc = calculateOfflineReward({ lastOnlineTime: 0, now: 8 * MS_PER_HOUR, hasProgress: true });
    expect(calc.capped).toBe(false);
    expect(calc.reward).toEqual({ starCoin: 960, expChip: 192 });
  });

  it('离线 12 小时仍封顶在 8 小时（960/192）', () => {
    const calc = calculateOfflineReward({ lastOnlineTime: 0, now: 12 * MS_PER_HOUR, hasProgress: true });
    expect(calc.capped).toBe(true);
    expect(calc.reward).toEqual({ starCoin: 960, expChip: 192 });
  });
});
