// 第2.5块·块1：巡逻收益纯函数单测（GDD S10.10）。
// 覆盖：星域档0零产出前置、tier1 基础速率×系数、上限截断/溢出、居住舱0无巡逻、居民延长、边界(负/NaN/1秒取整)。
import { describe, it, expect } from 'vitest';
import { computePatrolGains, PATROL_BASE_RATE_PER_HOUR } from '../assets/scripts/core/s7/S7PatrolProduction';

const HOUR = 3600;

describe('块1 · computePatrolGains', () => {
  it('星域档 0（未通关任何星域）：不论离开多久全零、hasGains=false（无可巡逻星域）', () => {
    const r = computePatrolGains(10 * HOUR, { clearedStarfieldTier: 0, habitatLevel: 5 });
    expect(r.gains).toEqual({ hullAlloy: 0, pilotToken: 0, starCargo: 0 });
    expect(r.hasGains).toBe(false);
  });

  it('tier1 · 居住舱 lv1 · 离开 1 小时：进账 = 基础产率 × 星域系数 1.6（与离线同一系数表）', () => {
    const r = computePatrolGains(HOUR, { clearedStarfieldTier: 1, habitatLevel: 1 });
    expect(r.gains.hullAlloy).toBe(Math.floor(PATROL_BASE_RATE_PER_HOUR.hullAlloy * 1.6)); // 48
    expect(r.gains.pilotToken).toBe(Math.floor(PATROL_BASE_RATE_PER_HOUR.pilotToken * 1.6)); // 32
    expect(r.gains.starCargo).toBe(Math.floor(PATROL_BASE_RATE_PER_HOUR.starCargo * 1.6)); // 12
    expect(r.hasGains).toBe(true);
    expect(r.overflowed).toBe(false);
  });

  it('护栏方向：巡逻合金基础速率明显低于离线合金（≈25%），对齐经济体检"委托+巡逻≤离线~50%"', () => {
    // 离线合金基础 120/h（S7OfflineProduction）；巡逻 30/h。此处只锁"量级关系"，精确比例阶段三校准。
    expect(PATROL_BASE_RATE_PER_HOUR.hullAlloy).toBeLessThanOrEqual(120 * 0.3);
  });

  it('上限截断：居住舱 lv1 存储 36h，离开 40h → 按 36h 计、overflowed=true', () => {
    const r = computePatrolGains(40 * HOUR, { clearedStarfieldTier: 1, habitatLevel: 1 });
    expect(r.capSeconds).toBe(36 * HOUR);
    expect(r.effectiveSeconds).toBe(36 * HOUR);
    expect(r.overflowed).toBe(true);
    expect(r.gains.hullAlloy).toBe(Math.floor(30 * 1.6 * 36)); // 1728
  });

  it('居民延长存储：extraStorageHours=6 → 上限 42h，40h 不再溢出', () => {
    const r = computePatrolGains(40 * HOUR, { clearedStarfieldTier: 1, habitatLevel: 1, extraStorageHours: 6 });
    expect(r.capSeconds).toBe(42 * HOUR);
    expect(r.overflowed).toBe(false);
    expect(r.gains.hullAlloy).toBe(Math.floor(30 * 1.6 * 40)); // 1920
  });

  it('居住舱未解锁（lv0）：上限 0 → 全零；离开>0 记 overflowed（与离线同规则）', () => {
    const r = computePatrolGains(5 * HOUR, { clearedStarfieldTier: 2, habitatLevel: 0 });
    expect(r.gains).toEqual({ hullAlloy: 0, pilotToken: 0, starCargo: 0 });
    expect(r.capSeconds).toBe(0);
    expect(r.overflowed).toBe(true);
    expect(r.hasGains).toBe(false);
  });

  it('边界：负数/NaN 离开秒数按 0；1 秒 tier1 向下取整为 0', () => {
    expect(computePatrolGains(-100, { clearedStarfieldTier: 1, habitatLevel: 1 }).gains.hullAlloy).toBe(0);
    expect(computePatrolGains(Number.NaN, { clearedStarfieldTier: 1, habitatLevel: 1 }).overflowed).toBe(false);
    const oneSec = computePatrolGains(1, { clearedStarfieldTier: 1, habitatLevel: 1 });
    expect(oneSec.gains).toEqual({ hullAlloy: 0, pilotToken: 0, starCargo: 0 });
    expect(oneSec.hasGains).toBe(false);
  });

  it('高档系数：tier4=6.0；越界档（tier6·6星域拓扑）向下夹到表尾 6.0（与离线 starfieldCoefficient 同口径）', () => {
    const t4 = computePatrolGains(HOUR, { clearedStarfieldTier: 4, habitatLevel: 1 });
    expect(t4.gains.hullAlloy).toBe(Math.floor(30 * 6.0)); // 180
    const t6 = computePatrolGains(HOUR, { clearedStarfieldTier: 6, habitatLevel: 1 });
    expect(t6.gains.hullAlloy).toBe(t4.gains.hullAlloy); // 夹到同一系数（系数表扩到6档属阶段三校准）
  });
});
