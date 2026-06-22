// 块7a：活动进度（3天行动/7天扩张）进度累积 + 里程碑/完成领取（纯 TS，阈值由配置传入、不发奖）。
import { describe, it, expect } from 'vitest';
import {
  S7_ACTIVITY_TYPES,
  S7_ACTIVITY_DURATION_SEC,
  createDefaultS7ActivityProgress,
  normalizeS7ActivityProgress,
  getActivityProgress,
  addActivityProgress,
  isMilestoneClaimed,
  canClaimMilestone,
  claimMilestone,
  canClaimCompletion,
  claimCompletion,
  tickActivityCycles,
  activityCycleEndTime,
  settlementChestType,
} from '../assets/scripts/core/s7/S7ActivityProgress';

/** 测试用空状态（块7b 字段齐）。 */
const EMPTY_STATE = { progress: 0, claimedMilestones: [], completionClaimed: false, cycleStartTime: 0, settlementCount: 0 };

describe('块7a 活动进度 S7ActivityProgress', () => {
  it('两种活动键固定；默认各零（含块7b 周期字段）', () => {
    expect([...S7_ACTIVITY_TYPES]).toEqual(['action3', 'expansion7']);
    expect(createDefaultS7ActivityProgress()).toEqual({
      action3: { ...EMPTY_STATE },
      expansion7: { ...EMPTY_STATE },
    });
  });

  it('normalize：键集恒为两类，缺项补默认、progress 取有限非负、里程碑去重去脏、completion 强制布尔、未知键丢弃', () => {
    const out = normalizeS7ActivityProgress({
      action3: { progress: 120, claimedMilestones: ['m1', 'm1', 'm2', '', 5], completionClaimed: true, cycleStartTime: 1700, settlementCount: 2 },
      // expansion7 缺失 → 补默认
      bogus: { progress: 999 }, // 未知键丢弃
    });
    expect(out.action3).toEqual({ progress: 120, claimedMilestones: ['m1', 'm2'], completionClaimed: true, cycleStartTime: 1700, settlementCount: 2 });
    expect(out.expansion7).toEqual({ ...EMPTY_STATE });
    expect((out as Record<string, unknown>).bogus).toBeUndefined();
  });

  it('normalize：块7b 字段去脏——cycleStartTime 负/非数落 0；settlementCount 非整数/负落 0', () => {
    expect(normalizeS7ActivityProgress({ action3: { cycleStartTime: -1, settlementCount: 2.5 } }).action3.cycleStartTime).toBe(0);
    expect(normalizeS7ActivityProgress({ action3: { cycleStartTime: 'x', settlementCount: -3 } }).action3.settlementCount).toBe(0);
    expect(normalizeS7ActivityProgress({ action3: { cycleStartTime: 1234, settlementCount: 5 } }).action3).toEqual({ ...EMPTY_STATE, cycleStartTime: 1234, settlementCount: 5 });
  });

  it('normalize：脏 progress（负/NaN/非数）落 0；completionClaimed 非 true 一律 false', () => {
    expect(normalizeS7ActivityProgress({ action3: { progress: -5 } }).action3.progress).toBe(0);
    expect(normalizeS7ActivityProgress({ action3: { progress: 'x' } }).action3.progress).toBe(0);
    expect(normalizeS7ActivityProgress({ action3: { progress: Infinity } }).action3.progress).toBe(0);
    expect(normalizeS7ActivityProgress({ action3: { completionClaimed: 1 } }).action3.completionClaimed).toBe(false);
    expect(normalizeS7ActivityProgress(null)).toEqual(createDefaultS7ActivityProgress());
  });

  it('addActivityProgress 累积；非正/非有限/未知类型无操作', () => {
    const st = createDefaultS7ActivityProgress();
    addActivityProgress(st, 'action3', 30);
    addActivityProgress(st, 'action3', 20);
    expect(getActivityProgress(st, 'action3')).toBe(50);
    addActivityProgress(st, 'action3', 0); // 无操作
    addActivityProgress(st, 'action3', -10); // 无操作
    addActivityProgress(st, 'action3', Infinity); // 无操作
    // @ts-expect-error 未知活动类型，应无操作
    addActivityProgress(st, 'weekly99', 5);
    expect(getActivityProgress(st, 'action3')).toBe(50);
    expect(getActivityProgress(st, 'expansion7')).toBe(0); // 互不串
  });

  it('里程碑领取：达阈值且未领才可领；领后再领=false；阈值未到=false', () => {
    const st = createDefaultS7ActivityProgress();
    addActivityProgress(st, 'expansion7', 100);
    // 阈值 80 已达、未领 → 可领
    expect(canClaimMilestone(st, 'expansion7', 'd7', 80)).toBe(true);
    expect(claimMilestone(st, 'expansion7', 'd7', 80)).toBe(true);
    expect(isMilestoneClaimed(st, 'expansion7', 'd7')).toBe(true);
    // 已领 → 不可重复
    expect(canClaimMilestone(st, 'expansion7', 'd7', 80)).toBe(false);
    expect(claimMilestone(st, 'expansion7', 'd7', 80)).toBe(false);
    expect(st.expansion7.claimedMilestones).toEqual(['d7']); // 没重复入账
    // 阈值未到 → 不可领，不改状态
    expect(canClaimMilestone(st, 'expansion7', 'd14', 200)).toBe(false);
    expect(claimMilestone(st, 'expansion7', 'd14', 200)).toBe(false);
    expect(st.expansion7.claimedMilestones).toEqual(['d7']);
    // 空 id / 非法阈值 → false
    expect(canClaimMilestone(st, 'expansion7', '', 1)).toBe(false);
    expect(canClaimMilestone(st, 'expansion7', 'dX', NaN)).toBe(false);
  });

  it('完成奖励领取：达完成阈值且未领才可领；领后置位、再领=false', () => {
    const st = createDefaultS7ActivityProgress();
    addActivityProgress(st, 'action3', 60);
    // 未达完成阈值 100
    expect(canClaimCompletion(st, 'action3', 100)).toBe(false);
    expect(claimCompletion(st, 'action3', 100)).toBe(false);
    // 达标
    addActivityProgress(st, 'action3', 40); // 共 100
    expect(canClaimCompletion(st, 'action3', 100)).toBe(true);
    expect(claimCompletion(st, 'action3', 100)).toBe(true);
    expect(st.action3.completionClaimed).toBe(true);
    // 已领不可重复
    expect(canClaimCompletion(st, 'action3', 100)).toBe(false);
    expect(claimCompletion(st, 'action3', 100)).toBe(false);
  });
});

describe('块7b 活动周期/结算/跨期追赶 tickActivityCycles', () => {
  const T0 = 1_700_000_000_000;
  const DAY = 24 * 3600 * 1000;
  const CFG = { action3: { completionThreshold: 100 }, expansion7: { completionThreshold: 300 } };

  it('周期时长常量：3天/7天；settlementChestType 映射', () => {
    expect(S7_ACTIVITY_DURATION_SEC.action3).toBe(72 * 3600);
    expect(S7_ACTIVITY_DURATION_SEC.expansion7).toBe(168 * 3600);
    expect(settlementChestType('action3')).toBe('actionTreasure');
    expect(settlementChestType('expansion7')).toBe('expansionTreasure');
  });

  it('首次 tick 以 now 起算周期、不结算；cycleEndTime = 起点 + 时长', () => {
    const st = createDefaultS7ActivityProgress();
    const ev = tickActivityCycles(st, T0, CFG);
    expect(ev).toEqual([]);
    expect(st.action3.cycleStartTime).toBe(T0);
    expect(st.expansion7.cycleStartTime).toBe(T0);
    expect(activityCycleEndTime(st, 'action3')).toBe(T0 + 72 * 3600 * 1000);
    expect(activityCycleEndTime(st, 'expansion7')).toBe(T0 + 168 * 3600 * 1000);
    // 未起算时 cycleEndTime=0
    expect(activityCycleEndTime(createDefaultS7ActivityProgress(), 'action3')).toBe(0);
  });

  it('窗口内未到期：不滚动、不结算', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG); // 起算
    addActivityProgress(st, 'action3', 100);
    const ev = tickActivityCycles(st, T0 + 2 * DAY, CFG); // 3天内
    expect(ev).toEqual([]);
    expect(st.action3.cycleStartTime).toBe(T0); // 没滚
    expect(st.action3.progress).toBe(100); // 没重置
  });

  it('攒够进度后周期到期：结算 1 次、滚入下一轮、进度/领取重置', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG); // 起算
    addActivityProgress(st, 'action3', 120); // ≥100 完成阈值
    claimMilestone(st, 'action3', 'm1', 50);
    const ev = tickActivityCycles(st, T0 + 3 * DAY + 1000, CFG); // 过 3 天窗口
    expect(ev).toMatchObject([{ type: 'action3', settlementCount: 1 }]); // 事件含结算快照(progressAtSettle 等)·此处只验类型/序号
    expect(st.action3.settlementCount).toBe(1);
    // 滚入下一轮：起点 +1 窗口、进度/里程碑/完成全重置
    expect(st.action3.cycleStartTime).toBe(T0 + 72 * 3600 * 1000);
    expect(st.action3.progress).toBe(0);
    expect(st.action3.claimedMilestones).toEqual([]);
    expect(st.action3.completionClaimed).toBe(false);
  });

  it('到期但未攒够：不结算、仍滚入下一轮（窗口过了就是过了）', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG);
    addActivityProgress(st, 'action3', 40); // <100，没攒够
    const ev = tickActivityCycles(st, T0 + 3 * DAY + 1000, CFG);
    expect(ev).toEqual([]); // 不结算
    expect(st.action3.settlementCount).toBe(0);
    expect(st.action3.cycleStartTime).toBe(T0 + 72 * 3600 * 1000); // 仍滚动
    expect(st.action3.progress).toBe(0);
  });

  it('跨期追赶：离开很久跨多轮——只有离开当下那轮可能结算，被略过的轮自动作废', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG);
    addActivityProgress(st, 'action3', 150); // 离开当下这轮已攒够
    // 离开 ~10 天（3天活动 → 跨 ~3 轮多）
    const ev = tickActivityCycles(st, T0 + 10 * DAY, CFG);
    // 只结算 1 次（离开当下那轮）；被略过的轮 progress 已重置=0、达不到阈值→作废
    expect(ev).toMatchObject([{ type: 'action3', settlementCount: 1 }]);
    expect(st.action3.settlementCount).toBe(1);
    // 落到当前进行中的窗口（now 在其内）
    expect(activityCycleEndTime(st, 'action3')).toBeGreaterThan(T0 + 10 * DAY);
    expect(st.action3.cycleStartTime).toBeLessThanOrEqual(T0 + 10 * DAY);
    expect(st.action3.progress).toBe(0);
  });

  it('settlementCount 跨轮累加：连续两轮都攒够 → 计到 2（供 7 天 1st/Nth 判定）', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG);
    // 第 1 轮攒够、到期结算
    addActivityProgress(st, 'expansion7', 350); // ≥300
    let ev = tickActivityCycles(st, T0 + 7 * DAY + 1000, CFG);
    expect(ev).toMatchObject([{ type: 'expansion7', settlementCount: 1 }]);
    // 第 2 轮再攒够、再到期结算
    addActivityProgress(st, 'expansion7', 400);
    ev = tickActivityCycles(st, T0 + 14 * DAY + 2000, CFG);
    expect(ev).toMatchObject([{ type: 'expansion7', settlementCount: 2 }]);
    expect(st.expansion7.settlementCount).toBe(2);
  });

  it('防御：now 非法 / 时钟回退 → 不动状态、不结算', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG);
    addActivityProgress(st, 'action3', 120);
    // now 非有限
    expect(tickActivityCycles(st, NaN, CFG)).toEqual([]);
    // 时钟回退到起点之前
    expect(tickActivityCycles(st, T0 - DAY, CFG)).toEqual([]);
    expect(st.action3.cycleStartTime).toBe(T0);
    expect(st.action3.progress).toBe(120);
  });

  it('阈值缺失/非法：时间照常滚动但不结算（不静默乱发）', () => {
    const st = createDefaultS7ActivityProgress();
    tickActivityCycles(st, T0, CFG);
    addActivityProgress(st, 'action3', 999);
    const badCfg = { action3: { completionThreshold: NaN }, expansion7: { completionThreshold: 300 } } as never;
    const ev = tickActivityCycles(st, T0 + 3 * DAY + 1000, badCfg);
    expect(ev).toEqual([]); // 阈值非法→不结算
    expect(st.action3.cycleStartTime).toBe(T0 + 72 * 3600 * 1000); // 但仍滚动
  });
});
