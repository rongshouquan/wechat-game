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
  // 段二 A3 重定基（旧→新→为什么对）：等级上限 100→50（S7_UNIT_MAX_LEVEL·clampLevel 随之夹 50），
  // growth_band 数据 41-100 段保留=封存态不删——可达顶点从 L100(420) 变 L50。
  // L50 真值手推（41-100 段线性 288→420·interpFrom 41/to 100）：288 + (420−288)×(50−41)/(100−41)
  // ＝288+132×9/59＝308.1356…；互证：LF(50)=3.2935 ÷ 节点门(1.1×1.166)=2.5678=308.1356/120 ✓ 两源一致。
  const L50_POWER = 288 + (420 - 288) * (9 / 59);

  it('unitPowerAtLevel ship：段内线性,端点与样例一致', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 1)).toBe(120); // lv1-10 段起点
    expect(unitPowerAtLevel(BANDS, 'ship', 10)).toBe(196); // lv1-10 段终点（+7%/级·教学破墙窗口）
    expect(unitPowerAtLevel(BANDS, 'ship', 11)).toBe(203); // lv11-20 段起点（连续+3.5%/级）
    expect(unitPowerAtLevel(BANDS, 'ship', 20)).toBe(238);
    expect(unitPowerAtLevel(BANDS, 'ship', 40)).toBe(286);
    expect(unitPowerAtLevel(BANDS, 'ship', 50)).toBeCloseTo(L50_POWER, 5); // 可达顶点（SS·L50）
    expect(unitPowerAtLevel(BANDS, 'ship', 5)).toBeCloseTo(120 + (196 - 120) * (4 / 9), 5);
  });

  it('unitPowerAtLevel：等级夹紧 [1,50]（51-100 封存段数据保留·请求越界夹到 50）', () => {
    expect(unitPowerAtLevel(BANDS, 'ship', 0)).toBe(120); // <1 → 1
    expect(unitPowerAtLevel(BANDS, 'ship', 999)).toBeCloseTo(L50_POWER, 5); // 夹到 50（旧夹 100→420）
    expect(unitPowerAtLevel(BANDS, 'ship', 41)).toBe(288); // 41-100 段起点（SS·L41-50 仍可达段）
    expect(unitPowerAtLevel(BANDS, 'ship', 41)).toBeLessThan(unitPowerAtLevel(BANDS, 'ship', 50)); // 可达段内单调涨
  });

  it('shipGrowthBlocks：1 级无积木；高级按战力倍率给 maxHp+attack 同比 pct', () => {
    expect(shipGrowthBlocks(BANDS, 1)).toEqual([]); // 1 级不放大
    const lv10 = shipGrowthBlocks(BANDS, 10);
    // ratio = 196/120 → pct = 196/120 − 1
    expect(lv10).toEqual([
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 196 / 120 - 1, source: 'ship_growth' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 196 / 120 - 1, source: 'ship_growth' },
    ]);
    // 越高级倍率越大(单调)；顶点=夹紧后的 L50（旧 L100=420/120−1）。
    const lvTop = shipGrowthBlocks(BANDS, 100); // 请求 100 → 夹 50
    const pctTop = (lvTop[0] as { value: number }).value;
    expect(pctTop).toBeCloseTo(L50_POWER / 120 - 1, 5);
    expect(pctTop).toBeGreaterThan(196 / 120 - 1);
  });

  it('pilotGrowthBlocks：占位返回空（驾驶员升级无原始属性,§5.2）', () => {
    expect(pilotGrowthBlocks(BANDS, 1)).toEqual([]);
    expect(pilotGrowthBlocks(BANDS, 40)).toEqual([]);
  });
});
