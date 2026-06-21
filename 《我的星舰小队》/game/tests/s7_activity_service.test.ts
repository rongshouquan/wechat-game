// 阶段一 G-step1：活动奖励解析单测（v1.0 §10.5）——
//   里程碑视图(顺序/可领/已领) · 完成视图 · 进度权重 · 周期config整理 · 结算宝藏 · 默认配置§10.5自检 ·
//   与引擎联动(喂进度→可领·领后已领·tick到期结算)。
// 纯结构、确定性、不读磁盘。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7ActivityProgress, addActivityProgress, claimMilestone, claimCompletion,
  tickActivityCycles, S7_ACTIVITY_DURATION_SEC,
} from '../assets/scripts/core/s7/S7ActivityProgress';
import { DEFAULT_S7_ACTIVITY_CONFIG as CFG } from '../assets/scripts/core/s7/S7ActivityConfig';
import {
  listMilestones, completionView, progressWeightFor, activityCycleConfig, settlementReward,
} from '../assets/scripts/core/s7/S7ActivityService';

describe('S7 活动 · 里程碑视图', () => {
  it('按 config 顺序列出·阈值/奖励正确·初始不可领不已领', () => {
    const st = createDefaultS7ActivityProgress();
    const ms = listMilestones(st, 'action3', CFG);
    expect(ms.map((m) => m.id)).toEqual(['a3_m1', 'a3_m2', 'a3_m3']);
    expect(ms[0].threshold).toBe(30);
    expect(ms.every((m) => !m.claimed && !m.claimable)).toBe(true);
  });

  it('进度过阈值→可领；领取后→已领且不可再领', () => {
    const st = createDefaultS7ActivityProgress();
    addActivityProgress(st, 'action3', 35); // 过 m1(30)·未过 m2(60)
    let ms = listMilestones(st, 'action3', CFG);
    expect(ms[0].claimable).toBe(true);
    expect(ms[1].claimable).toBe(false);
    // 领 m1（引擎记账）。
    expect(claimMilestone(st, 'action3', 'a3_m1', 30)).toBe(true);
    ms = listMilestones(st, 'action3', CFG);
    expect(ms[0].claimed).toBe(true);
    expect(ms[0].claimable).toBe(false);
  });
});

describe('S7 活动 · 完成视图', () => {
  it('完成阈值/奖励正确·达标可领·领后已领', () => {
    const st = createDefaultS7ActivityProgress();
    let cv = completionView(st, 'action3', CFG)!;
    expect(cv.threshold).toBe(150);
    expect(cv.claimable).toBe(false);
    addActivityProgress(st, 'action3', 150);
    cv = completionView(st, 'action3', CFG)!;
    expect(cv.claimable).toBe(true);
    expect(claimCompletion(st, 'action3', 150)).toBe(true);
    cv = completionView(st, 'action3', CFG)!;
    expect(cv.claimed).toBe(true);
    expect(cv.claimable).toBe(false);
  });
});

describe('S7 活动 · 进度权重', () => {
  it('配置内行为返回权重·未知行为返回 0', () => {
    expect(progressWeightFor(CFG, 'action3', 'node_clear')).toBe(10);
    expect(progressWeightFor(CFG, 'action3', 'salvage_collect')).toBe(8);
    expect(progressWeightFor(CFG, 'action3', 'gacha_draw')).toBe(5);
    expect(progressWeightFor(CFG, 'action3', 'no_such_action')).toBe(0);
    expect(progressWeightFor(CFG, 'expansion7', 'node_clear')).toBe(10);
  });
});

describe('S7 活动 · 周期config + 结算', () => {
  it('activityCycleConfig 取各活动完成阈值', () => {
    const cc = activityCycleConfig(CFG);
    expect(cc.action3.completionThreshold).toBe(150);
    expect(cc.expansion7.completionThreshold).toBe(380);
  });

  it('settlementReward：3天→行动宝藏 / 7天→扩张宝藏', () => {
    expect(settlementReward('action3')).toEqual({ kind: 'chest', chestId: 'actionTreasure', amount: 1 });
    expect(settlementReward('expansion7')).toEqual({ kind: 'chest', chestId: 'expansionTreasure', amount: 1 });
  });

  it('与 tick 联动：攒够完成阈值→周期到期产出 1 次结算事件', () => {
    const st = createDefaultS7ActivityProgress();
    const cc = activityCycleConfig(CFG);
    const t0 = 1_000_000;
    expect(tickActivityCycles(st, t0, cc)).toEqual([]); // 首 tick 起算·不结算
    addActivityProgress(st, 'action3', 150); // 攒够完成阈值
    const durMs = S7_ACTIVITY_DURATION_SEC.action3 * 1000;
    const events = tickActivityCycles(st, t0 + durMs + 1, cc);
    const a3 = events.filter((e) => e.type === 'action3');
    expect(a3.length).toBe(1);
    expect(a3[0].settlementCount).toBe(1);
    // 结算后进度重置（新一轮）。
    expect(listMilestones(st, 'action3', CFG).every((m) => !m.claimed)).toBe(true);
  });

  it('与 tick 联动：没攒够→周期到期不结算（作废·守跨期红线）', () => {
    const st = createDefaultS7ActivityProgress();
    const cc = activityCycleConfig(CFG);
    const t0 = 2_000_000;
    tickActivityCycles(st, t0, cc);
    addActivityProgress(st, 'action3', 40); // 没到完成阈值 150
    const durMs = S7_ACTIVITY_DURATION_SEC.action3 * 1000;
    const events = tickActivityCycles(st, t0 + durMs + 1, cc);
    expect(events.filter((e) => e.type === 'action3').length).toBe(0);
  });
});

describe('S7 活动 · 默认配置 §10.5 自检', () => {
  it('3天行动：完成=星辉货舱·过程偏 信标/补给券/通用碎片', () => {
    const a = CFG.activities.action3;
    expect(a.completion.rewards).toEqual([{ kind: 'chest', chestId: 'starlightCargo', amount: 1 }]);
    const allRewards = a.milestones.flatMap((m) => m.rewards);
    expect(allRewards.some((r) => r.kind === 'resource' && (r.resourceId === 'beaconCommon' || r.resourceId === 'beaconRare'))).toBe(true);
    expect(allRewards.some((r) => r.kind === 'resource' && r.resourceId === 'supplyTicket')).toBe(true);
    expect(allRewards.some((r) => r.kind === 'resource' && (r.resourceId === 'shipBlueprint' || r.resourceId === 'pilotShardUniversal'))).toBe(true);
  });

  it('7天扩张：完成=史诗信标+星核碎片·过程含人口(居民/工人)', () => {
    const e = CFG.activities.expansion7;
    const compIds = e.completion.rewards.filter((r) => r.kind === 'resource').map((r) => (r as { resourceId: string }).resourceId);
    expect(compIds).toContain('beaconEpic');
    expect(compIds).toContain('coreFrag');
    const allRewards = e.milestones.flatMap((m) => m.rewards);
    expect(allRewards.some((r) => r.kind === 'population')).toBe(true);
  });

  it('两活动都配了 推关/打捞/抽卡 进度权重', () => {
    for (const t of ['action3', 'expansion7'] as const) {
      const w = CFG.activities[t].progressWeights;
      expect(w.node_clear).toBeGreaterThan(0);
      expect(w.salvage_collect).toBeGreaterThan(0);
      expect(w.gacha_draw).toBeGreaterThan(0);
    }
  });
});
