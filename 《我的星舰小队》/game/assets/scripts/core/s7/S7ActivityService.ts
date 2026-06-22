// 活动奖励解析（阶段一 G-step1，纯 TS，不依赖 cc / 存档落盘）：v1.0 §10.5。
//
// 在已有 S7ActivityProgress 引擎(进度/里程碑/完成/周期结算)之上，配合 S7ActivityConfig 提供「展示 + 解析」纯函数：
//   - listMilestones / completionView：给 UI 列里程碑/完成的 阈值·奖励·可领·已领 状态。
//   - progressWeightFor：某行为该给多少进度（喂入点用）。
//   - activityCycleConfig：把 config 的完成阈值整理成 tickActivityCycles 需要的形状。
//   - settlementReward：一次结算发的宝藏（行动宝藏/扩张宝藏·走邮件）。
// 领取的「记账」仍由引擎 claimMilestone/claimCompletion 做；本层只解析「领什么」，发奖由应用侧入账。

import {
  S7ActivityType,
  S7ActivityProgressState,
  S7ActivityCycleConfig,
  S7ActivitySettlement,
  S7_ACTIVITY_TYPES,
  isMilestoneClaimed,
  canClaimMilestone,
  canClaimCompletion,
  settlementChestType,
} from './S7ActivityProgress';
import { S7ActivityConfig, S7ActivityReward } from './S7ActivityConfig';

/** 里程碑的展示视图（含可领/已领态）。 */
export interface S7MilestoneView {
  id: string;
  threshold: number;
  rewards: S7ActivityReward[];
  claimed: boolean;
  claimable: boolean;
}

/** 列某活动的全部过程里程碑（顺序同 config·含可领/已领态）。 */
export function listMilestones(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  config: S7ActivityConfig,
): S7MilestoneView[] {
  const def = config.activities[type];
  if (!def) return [];
  return def.milestones.map((m) => ({
    id: m.id,
    threshold: m.threshold,
    rewards: m.rewards,
    claimed: isMilestoneClaimed(state, type, m.id),
    claimable: canClaimMilestone(state, type, m.id, m.threshold),
  }));
}

/** 完成奖励的展示视图（阈值·奖励·可领·已领）。 */
export interface S7CompletionView {
  threshold: number;
  rewards: S7ActivityReward[];
  claimed: boolean;
  claimable: boolean;
}

export function completionView(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  config: S7ActivityConfig,
): S7CompletionView | null {
  const def = config.activities[type];
  if (!def) return null;
  return {
    threshold: def.completion.threshold,
    rewards: def.completion.rewards,
    claimed: state[type].completionClaimed,
    claimable: canClaimCompletion(state, type, def.completion.threshold),
  };
}

/** 某行为该给多少进度点（未配置该行为 → 0）。 */
export function progressWeightFor(config: S7ActivityConfig, type: S7ActivityType, action: string): number {
  const w = config.activities[type]?.progressWeights[action];
  return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 0;
}

/** 把 config 整理成 tickActivityCycles 需要的「每类完成阈值」形状（结算以完成阈值为达标线）。 */
export function activityCycleConfig(config: S7ActivityConfig): Record<S7ActivityType, S7ActivityCycleConfig> {
  const out = {} as Record<S7ActivityType, S7ActivityCycleConfig>;
  for (const t of S7_ACTIVITY_TYPES) {
    out[t] = { completionThreshold: config.activities[t]?.completion.threshold ?? Number.POSITIVE_INFINITY };
  }
  return out;
}

/** 一次结算发的宝藏（3天→行动宝藏 / 7天→扩张宝藏·走邮件→背包→开箱）。 */
export function settlementReward(type: S7ActivityType): S7ActivityReward {
  return { kind: 'chest', chestId: settlementChestType(type), amount: 1 };
}

/**
 * 结算邮件应发的全部奖励（G 反馈3·补发漏领）：
 *   ① 该轮达标但**未领**的过程里程碑奖励 ② 完成奖励（达标且未领）③ 结算宝藏。
 * 用结算快照(progressAtSettle/claimed*AtSettle)对照 config 算出漏领项，避免"周期到期玩家没领→只补结算宝藏"丢奖。
 */
export function settlementBackfillRewards(settlement: S7ActivitySettlement, config: S7ActivityConfig): S7ActivityReward[] {
  const out: S7ActivityReward[] = [];
  const def = config.activities[settlement.type];
  if (def) {
    for (const m of def.milestones) {
      if (settlement.progressAtSettle >= m.threshold && !settlement.claimedMilestonesAtSettle.includes(m.id)) {
        out.push(...m.rewards); // 漏领的过程里程碑
      }
    }
    if (settlement.progressAtSettle >= def.completion.threshold && !settlement.completionClaimedAtSettle) {
      out.push(...def.completion.rewards); // 漏领的完成奖励
    }
  }
  out.push(settlementReward(settlement.type)); // 结算宝藏（恒发）
  return out;
}
