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
  it('unitPowerAtLevel ship：段内线性,端点与样例一致', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 1)).toBe(120); // lv1-10 段起点
    expect(unitPowerAtLevel(BANDS, 'ship', 10)).toBe(300); // lv1-10 段终点
    expect(unitPowerAtLevel(BANDS, 'ship', 11)).toBe(300); // lv11-20 段起点(连续)
    expect(unitPowerAtLevel(BANDS, 'ship', 20)).toBe(650);
    expect(unitPowerAtLevel(BANDS, 'ship', 40)).toBe(2200); // 顶级
    expect(unitPowerAtLevel(BANDS, 'ship', 5)).toBeCloseTo(200, 5); // 120 + 180*(4/9)
  });

  it('unitPowerAtLevel：等级夹紧 [1,40]', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 0)).toBe(120); // <1 → 1
    expect(unitPowerAtLevel(BANDS, 'ship', 999)).toBe(2200); // >40 → 40
  });

  it('shipGrowthBlocks：1 级无积木；高级按战力倍率给 maxHp+attack 同比 pct', () => {
    expect(shipGrowthBlocks(BANDS, 1)).toEqual([]); // 1 级不放大
    const lv10 = shipGrowthBlocks(BANDS, 10);
    // ratio = 300/120 = 2.5 → pct = 1.5
    expect(lv10).toEqual([
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 1.5, source: 'ship_growth' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 1.5, source: 'ship_growth' },
    ]);
    // 越高级倍率越大(单调)
    const lv40 = shipGrowthBlocks(BANDS, 40);
    const pct40 = (lv40[0] as { value: number }).value;
    expect(pct40).toBeCloseTo(2200 / 120 - 1, 5);
    expect(pct40).toBeGreaterThan(1.5);
  });

  it('pilotGrowthBlocks：占位返回空（驾驶员升级无原始属性,§5.2）', () => {
    expect(pilotGrowthBlocks(BANDS, 1)).toEqual([]);
    expect(pilotGrowthBlocks(BANDS, 40)).toEqual([]);
  });
});
