// 块7a：活动进度（3天行动/7天扩张）进度累积 + 里程碑/完成领取（纯 TS，阈值由配置传入、不发奖）。
import { describe, it, expect } from 'vitest';
import {
  S7_ACTIVITY_TYPES,
  createDefaultS7ActivityProgress,
  normalizeS7ActivityProgress,
  getActivityProgress,
  addActivityProgress,
  isMilestoneClaimed,
  canClaimMilestone,
  claimMilestone,
  canClaimCompletion,
  claimCompletion,
} from '../assets/scripts/core/s7/S7ActivityProgress';

describe('块7a 活动进度 S7ActivityProgress', () => {
  it('两种活动键固定；默认各零', () => {
    expect([...S7_ACTIVITY_TYPES]).toEqual(['action3', 'expansion7']);
    expect(createDefaultS7ActivityProgress()).toEqual({
      action3: { progress: 0, claimedMilestones: [], completionClaimed: false },
      expansion7: { progress: 0, claimedMilestones: [], completionClaimed: false },
    });
  });

  it('normalize：键集恒为两类，缺项补默认、progress 取有限非负、里程碑去重去脏、completion 强制布尔、未知键丢弃', () => {
    const out = normalizeS7ActivityProgress({
      action3: { progress: 120, claimedMilestones: ['m1', 'm1', 'm2', '', 5], completionClaimed: true },
      // expansion7 缺失 → 补默认
      bogus: { progress: 999 }, // 未知键丢弃
    });
    expect(out.action3).toEqual({ progress: 120, claimedMilestones: ['m1', 'm2'], completionClaimed: true });
    expect(out.expansion7).toEqual({ progress: 0, claimedMilestones: [], completionClaimed: false });
    expect((out as Record<string, unknown>).bogus).toBeUndefined();
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
