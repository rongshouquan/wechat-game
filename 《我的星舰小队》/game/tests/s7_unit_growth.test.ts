// C1b 升级变强 步2：单位成长积木（等级→战力→放大血攻积木）测试。真实 growth_band 样例,不改磁盘表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7GrowthBandParam } from '../assets/scripts/config/s7/ConfigTypesS7';
import { unitPowerAtLevel, shipGrowthBlocks, pilotGrowthBlocks } from '../assets/scripts/core/s7/S7UnitGrowth';

const BANDS: S7GrowthBandParam[] = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'growth_band_param.sample.json'),
    'utf-8',
  ),
);

describe('C1b 升级变强 步2 成长积木 S7UnitGrowth', () => {
  // ⑥第一段重定基（细表§12.1 v2）：growth_band 换校准曲线（前陡后缓·L10=196/L40=286/L100=420=×3.5/轴），
  // 旧 03-04 冻结值（L10=300/L40=2200）作废（数值真源铁律=Codex 旧配置自由改）；41-100 真段落地、"持平占位"语义随之退役。
  it('unitPowerAtLevel ship：段内线性,端点与样例一致', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 1)).toBe(120); // lv1-10 段起点
    expect(unitPowerAtLevel(BANDS, 'ship', 10)).toBe(196); // lv1-10 段终点（+7%/级·教学破墙窗口）
    expect(unitPowerAtLevel(BANDS, 'ship', 11)).toBe(203); // lv11-20 段起点（连续+3.5%/级）
    expect(unitPowerAtLevel(BANDS, 'ship', 20)).toBe(238);
    expect(unitPowerAtLevel(BANDS, 'ship', 40)).toBe(286);
    expect(unitPowerAtLevel(BANDS, 'ship', 100)).toBe(420); // 顶级 ×3.5/轴
    expect(unitPowerAtLevel(BANDS, 'ship', 5)).toBeCloseTo(120 + (196 - 120) * (4 / 9), 5);
  });

  it('unitPowerAtLevel：等级夹紧 [1,100]；41-100 为真实成长段（旧"超40持平"占位已被 §12.1 v2 取代）', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 0)).toBe(120); // <1 → 1
    expect(unitPowerAtLevel(BANDS, 'ship', 999)).toBe(420); // 夹到 100 → 段末 420
    expect(unitPowerAtLevel(BANDS, 'ship', 41)).toBe(288); // 41-100 段起点（真实成长非持平）
    expect(unitPowerAtLevel(BANDS, 'ship', 41)).toBeLessThan(unitPowerAtLevel(BANDS, 'ship', 100)); // 段内单调涨
  });

  it('shipGrowthBlocks：1 级无积木；高级按战力倍率给 maxHp+attack 同比 pct', () => {
    expect(shipGrowthBlocks(BANDS, 1)).toEqual([]); // 1 级不放大
    const lv10 = shipGrowthBlocks(BANDS, 10);
    // ratio = 196/120 → pct = 196/120 − 1
    expect(lv10).toEqual([
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 196 / 120 - 1, source: 'ship_growth' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 196 / 120 - 1, source: 'ship_growth' },
    ]);
    // 越高级倍率越大(单调)
    const lv100 = shipGrowthBlocks(BANDS, 100);
    const pct100 = (lv100[0] as { value: number }).value;
    expect(pct100).toBeCloseTo(420 / 120 - 1, 5);
    expect(pct100).toBeGreaterThan(196 / 120 - 1);
  });

  it('pilotGrowthBlocks：占位返回空（驾驶员升级无原始属性,§5.2）', () => {
    expect(pilotGrowthBlocks(BANDS, 1)).toEqual([]);
    expect(pilotGrowthBlocks(BANDS, 40)).toEqual([]);
  });
});
