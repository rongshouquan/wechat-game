// 第2.5块·块1：巡逻收益纯函数单测（步5 收尾批重定基·初值表 v0.7 终值）。
// 重定基（旧→新→为什么对）：①基础产率 30/20/8（占位）→ 11.2/7.2/4（v0.7 PARAMS.patrol=B1 底垫 ×0.8 档）；
// ②系数表 5 档→7 档 regionCoef（tier1=1.7）；③新增派驻加成（+4%/艘·顶 10 艘=S10.10 数值面·UI 挂灰盒批）。
import { describe, it, expect } from 'vitest';
import { computePatrolGains, PATROL_BASE_RATE_PER_HOUR, patrolDockMult, PATROL_DOCK_PCT_PER_SHIP, PATROL_DOCK_MAX_SHIPS } from '../assets/scripts/core/s7/S7PatrolProduction';

const HOUR = 3600;

describe('块1 · computePatrolGains', () => {
  it('星域档 0（未通关任何星域）：不论离开多久全零、hasGains=false（无可巡逻星域）', () => {
    const r = computePatrolGains(10 * HOUR, { clearedStarfieldTier: 0, habitatLevel: 5 });
    expect(r.gains).toEqual({ hullAlloy: 0, pilotToken: 0, starCargo: 0 });
    expect(r.hasGains).toBe(false);
  });

  it('tier1 · 居住舱 lv1 · 离开 1 小时：进账 = 基础产率(11.2/7.2/4) × 星域系数 1.7（v0.7 七档表）', () => {
    expect(PATROL_BASE_RATE_PER_HOUR).toEqual({ hullAlloy: 11.2, pilotToken: 7.2, starCargo: 4 }); // 对表：v0.7 终值
    const r = computePatrolGains(HOUR, { clearedStarfieldTier: 1, habitatLevel: 1 });
    expect(r.gains.hullAlloy).toBe(Math.floor(11.2 * 1.7)); // 19
    expect(r.gains.pilotToken).toBe(Math.floor(7.2 * 1.7)); // 12
    expect(r.gains.starCargo).toBe(Math.floor(4 * 1.7)); // 6
    expect(r.hasGains).toBe(true);
    expect(r.overflowed).toBe(false);
  });

  it('护栏方向：巡逻合金 11.2 ≈ 离线合金 24 的 47%（v0.7 底垫双梁结构·B1 身份）', () => {
    expect(PATROL_BASE_RATE_PER_HOUR.hullAlloy / 24).toBeGreaterThan(0.4);
    expect(PATROL_BASE_RATE_PER_HOUR.hullAlloy / 24).toBeLessThan(0.5);
  });

  it('派驻加成（S10.10 数值面）：+4%/艘·计数上限 10 艘·缺省 0 无加成', () => {
    expect(PATROL_DOCK_PCT_PER_SHIP).toBe(4);
    expect(PATROL_DOCK_MAX_SHIPS).toBe(10);
    expect(patrolDockMult(0)).toBe(1);
    expect(patrolDockMult(5)).toBe(1.2);
    expect(patrolDockMult(15)).toBe(1.4); // 夹到 10 艘顶
    const base = computePatrolGains(HOUR, { clearedStarfieldTier: 1, habitatLevel: 1 }).gains.hullAlloy;
    const docked = computePatrolGains(HOUR, { clearedStarfieldTier: 1, habitatLevel: 1, dockedShips: 10 }).gains.hullAlloy;
    expect(docked).toBe(Math.floor(11.2 * 1.7 * 1.4)); // 26
    expect(docked).toBeGreaterThan(base);
  });

  it('上限截断：居住舱 lv1 存储 36h，离开 40h → 按 36h 计、overflowed=true', () => {
    const r = computePatrolGains(40 * HOUR, { clearedStarfieldTier: 1, habitatLevel: 1 });
    expect(r.capSeconds).toBe(36 * HOUR);
    expect(r.effectiveSeconds).toBe(36 * HOUR);
    expect(r.overflowed).toBe(true);
    expect(r.gains.hullAlloy).toBe(Math.floor(11.2 * 1.7 * 36)); // 685
  });

  it('居民延长存储：extraStorageHours=6 → 上限 42h，40h 不再溢出', () => {
    const r = computePatrolGains(40 * HOUR, { clearedStarfieldTier: 1, habitatLevel: 1, extraStorageHours: 6 });
    expect(r.capSeconds).toBe(42 * HOUR);
    expect(r.overflowed).toBe(false);
    expect(r.gains.hullAlloy).toBe(Math.floor(11.2 * 1.7 * 40)); // 761
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

  it('高档系数：tier4=5.8/tier6=10.5（七档表到位·越界向下夹）', () => {
    const t4 = computePatrolGains(HOUR, { clearedStarfieldTier: 4, habitatLevel: 1 });
    expect(t4.gains.hullAlloy).toBe(Math.floor(11.2 * 5.8)); // 64
    const t6 = computePatrolGains(HOUR, { clearedStarfieldTier: 6, habitatLevel: 1 });
    expect(t6.gains.hullAlloy).toBe(Math.floor(11.2 * 10.5)); // 117（旧'夹到6.0'作废=表已扩七档）
    const t9 = computePatrolGains(HOUR, { clearedStarfieldTier: 9, habitatLevel: 1 });
    expect(t9.gains.hullAlloy).toBe(t6.gains.hullAlloy); // 越界夹表尾
  });
});
