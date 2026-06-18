/**
 * 1-3 日新手目标（C21）。
 *
 * 纯 TypeScript 模块，不依赖 cc：定义新手前 3 日的目标清单，绑定真实事件来源推进进度，
 * 达成且天数解锁后可领取，领取发奖走 RewardLedger 防重。
 *
 * 关键约束（与《C21-P 技术预案》一致）：
 * - 这是"1-3 日新手目标"，不是每日重置任务：进度不跨天清零。
 * - 本服务不直接读系统时间，now 由调用方传入。
 * - startTime<=0 时在首次记录进度或领取检查时惰性锚定为 now（类比 C19 采矿 lastCollectTime）。
 * - activeDay = clamp(floor((now - startTime)/DAY_MS)+1, 1, 3)；now < startTime 只落到 day 1。
 * - 进度可提前累计，但领取受 day <= activeDay 闸控。
 * - 事件适配只接收各服务的真实结果类型，仅在"真实非重复成功"时推进；duplicate/insufficient/
 *   anchored/applied=false/changed=false 一律不推进。
 * - 领取先查 claimedGoalIds，再走 requestRewardGrant(ledger, goal_${goalId}, daily_goal)；
 *   只有 granted 后才发奖、confirmRewardGrant、记录 flowId、写 claimedGoalIds。
 */
import { RewardLedger, confirmRewardGrant, requestRewardGrant } from './RewardLedger';
import type { PlayerResources, PlayerState, UpgradeResult } from './PlayerState';
import type { RewardSettlementOutcome } from './LevelRewardSettlement';
import type { OneTapUpgradeResult } from './OneTapUpgradeService';
import type { OneTapEquipResult } from './OneTapEquipService';
import type { OfflineRewardClaimResult } from './OfflineRewardService';
import type { MiningStationClaimResult } from './MiningStationService';
import type { SupplyDrawResult } from './SupplyService';
import type { CraftHeroResult } from './FragmentCraftService';

/** 目标绑定的事件来源类型（覆盖 7 类真实事件）。 */
export type GoalEventType =
  | 'level_clear'
  | 'hero_upgrade'
  | 'one_tap_equip'
  | 'offline_claim'
  | 'mining_claim'
  | 'supply_draw'
  | 'fragment_craft';

export interface GoalFragmentReward {
  heroId: string;
  count: number;
}

/** 目标完成奖励（C21 内部结构，复用 PlayerState 的资源/碎片落地，不依赖 reward_config 表）。 */
export interface GoalReward {
  starCoin?: number;
  expChip?: number;
  equipmentPart?: number;
  baseEnergy?: number;
  fragments?: GoalFragmentReward[];
}

/** 单条目标定义。 */
export interface DailyGoalDef {
  goalId: string;
  day: 1 | 2 | 3;
  eventType: GoalEventType;
  targetValue: number;
  reward: GoalReward;
}

/** 新手目标存档状态（挂在 PlayerState 下）。 */
export interface DailyGoalsState {
  /** 新手目标起算锚点时间戳(ms)；0=未锚定（惰性锚定哨兵）。 */
  startTime: number;
  /** 各目标累计进度：goalId -> 已累计量（未出现视为 0）。 */
  progress: Record<string, number>;
  /** 已领取的 goalId（便捷态；领取防重真源是 RewardLedger）。 */
  claimedGoalIds: string[];
}

/** 一个自然日的毫秒数。 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 默认 1-3 日新手目标清单（占位数值，待数值/新手引导设计稿替换；结构不变）。
 * 覆盖 7 类事件来源，分布在第 1/2/3 日。
 */
export const DEFAULT_DAILY_GOALS: DailyGoalDef[] = [
  // Day 1
  { goalId: 'd1_clear_1', day: 1, eventType: 'level_clear', targetValue: 1, reward: { starCoin: 200, expChip: 40 } },
  { goalId: 'd1_upgrade_1', day: 1, eventType: 'hero_upgrade', targetValue: 1, reward: { starCoin: 150 } },
  { goalId: 'd1_supply_1', day: 1, eventType: 'supply_draw', targetValue: 1, reward: { baseEnergy: 100 } },
  // Day 2
  { goalId: 'd2_offline_1', day: 2, eventType: 'offline_claim', targetValue: 1, reward: { starCoin: 300 } },
  { goalId: 'd2_mining_1', day: 2, eventType: 'mining_claim', targetValue: 1, reward: { baseEnergy: 150 } },
  { goalId: 'd2_equip_1', day: 2, eventType: 'one_tap_equip', targetValue: 1, reward: { equipmentPart: 20 } },
  // Day 3
  { goalId: 'd3_craft_1', day: 3, eventType: 'fragment_craft', targetValue: 1, reward: { starCoin: 500, fragments: [{ heroId: 'hero_ryan', count: 10 }] } },
  { goalId: 'd3_clear_3', day: 3, eventType: 'level_clear', targetValue: 3, reward: { starCoin: 400, expChip: 80 } },
  { goalId: 'd3_supply_3', day: 3, eventType: 'supply_draw', targetValue: 3, reward: { expChip: 120 } },
];

/** 目标领取固定奖励标识；与 goalId 组合成稳定 sourceId 用于领取防重。 */
const GOAL_REWARD_ID = 'daily_goal';

const RESOURCE_KEYS: (keyof PlayerResources)[] = ['starCoin', 'expChip', 'equipmentPart', 'baseEnergy'];

export function createDefaultDailyGoalsState(): DailyGoalsState {
  return { startTime: 0, progress: {}, claimedGoalIds: [] };
}

/** 惰性锚定：startTime<=0 时把起算点设为 now。 */
function ensureAnchored(goals: DailyGoalsState, now: number): void {
  if (goals.startTime <= 0) {
    goals.startTime = now;
  }
}

/**
 * 解析当前激活日（1-3）。startTime<=0 时以 now 为起点（当日第 1 日）；
 * now<startTime（异常时间回退）时 elapsed 为负，clamp 后只落到 day 1。
 */
export function resolveActiveDay(goals: DailyGoalsState, now: number): number {
  const start = goals.startTime > 0 ? goals.startTime : now;
  const day = Math.floor((now - start) / DAY_MS) + 1;
  return Math.min(3, Math.max(1, day));
}

function findDef(goalId: string, defs: DailyGoalDef[]): DailyGoalDef | undefined {
  return defs.find((d) => d.goalId === goalId);
}

/**
 * 核心进度推进：对所有 eventType 匹配的目标，progress += amount（amount<=0 不处理）。
 * 进度不受天数限制（可提前累计），首次推进时惰性锚定 startTime。
 */
export function applyGoalEvent(
  goals: DailyGoalsState,
  eventType: GoalEventType,
  amount: number,
  now: number,
  defs: DailyGoalDef[] = DEFAULT_DAILY_GOALS,
): void {
  if (amount <= 0) {
    return;
  }
  ensureAnchored(goals, now);
  for (const def of defs) {
    if (def.eventType === eventType) {
      goals.progress[def.goalId] = (goals.progress[def.goalId] ?? 0) + amount;
    }
  }
}

// ---- 事件适配：接收各服务真实结果类型，仅在真实非重复成功时推进 ----

/** 通关：win && granted（重复结算 duplicate 不推进）。 */
export function recordLevelClear(state: PlayerState, outcome: RewardSettlementOutcome, now: number, defs?: DailyGoalDef[]): void {
  if (outcome.win && outcome.granted) {
    applyGoalEvent(state.dailyGoals, 'level_clear', 1, now, defs);
  }
}

/** 单次升级：UpgradeResult.ok。 */
export function recordHeroUpgradeSingle(state: PlayerState, result: UpgradeResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.ok) {
    applyGoalEvent(state.dailyGoals, 'hero_upgrade', 1, now, defs);
  }
}

/** 一键升级：applied=true，推进量为 steps.length。 */
export function recordOneTapUpgrade(state: PlayerState, result: OneTapUpgradeResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.applied) {
    applyGoalEvent(state.dailyGoals, 'hero_upgrade', result.steps.length, now, defs);
  }
}

/** 一键穿装：changed=true。 */
export function recordOneTapEquip(state: PlayerState, result: OneTapEquipResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.changed) {
    applyGoalEvent(state.dailyGoals, 'one_tap_equip', 1, now, defs);
  }
}

/** 离线领取：granted=true。 */
export function recordOfflineClaim(state: PlayerState, result: OfflineRewardClaimResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.granted) {
    applyGoalEvent(state.dailyGoals, 'offline_claim', 1, now, defs);
  }
}

/** 采矿领取：granted=true 且 anchored=false（惰性锚定不算一次领取）。 */
export function recordMiningClaim(state: PlayerState, result: MiningStationClaimResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.granted && !result.anchored) {
    applyGoalEvent(state.dailyGoals, 'mining_claim', 1, now, defs);
  }
}

/** 普通补给：granted=true。 */
export function recordSupplyDraw(state: PlayerState, result: SupplyDrawResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.granted) {
    applyGoalEvent(state.dailyGoals, 'supply_draw', 1, now, defs);
  }
}

/** 碎片合成：granted=true。 */
export function recordFragmentCraft(state: PlayerState, result: CraftHeroResult, now: number, defs?: DailyGoalDef[]): void {
  if (result.granted) {
    applyGoalEvent(state.dailyGoals, 'fragment_craft', 1, now, defs);
  }
}

// ---- 状态查询与领取 ----

export interface DailyGoalStatus {
  goalId: string;
  day: number;
  eventType: GoalEventType;
  progress: number;
  targetValue: number;
  /** 进度达成。 */
  reached: boolean;
  /** 天数已解锁（day <= activeDay）。 */
  unlocked: boolean;
  claimed: boolean;
  /** unlocked && reached && !claimed。 */
  claimable: boolean;
}

/** 返回全部目标的当前状态（领取检查，会惰性锚定 startTime）。 */
export function getGoalStatuses(state: PlayerState, now: number, defs: DailyGoalDef[] = DEFAULT_DAILY_GOALS): DailyGoalStatus[] {
  const goals = state.dailyGoals;
  ensureAnchored(goals, now);
  const activeDay = resolveActiveDay(goals, now);
  return defs.map((def) => {
    const progress = goals.progress[def.goalId] ?? 0;
    const reached = progress >= def.targetValue;
    const unlocked = def.day <= activeDay;
    const claimed = goals.claimedGoalIds.includes(def.goalId);
    return {
      goalId: def.goalId,
      day: def.day,
      eventType: def.eventType,
      progress,
      targetValue: def.targetValue,
      reached,
      unlocked,
      claimed,
      claimable: unlocked && reached && !claimed,
    };
  });
}

/** 当前可领取的目标列表。 */
export function getClaimableGoals(state: PlayerState, now: number, defs?: DailyGoalDef[]): DailyGoalStatus[] {
  return getGoalStatuses(state, now, defs).filter((s) => s.claimable);
}

export type ClaimGoalRejectReason = 'not_found' | 'already_claimed' | 'locked' | 'not_reached' | 'duplicate';

export interface ClaimGoalResult {
  granted: boolean;
  duplicate: boolean;
  reason?: ClaimGoalRejectReason;
  goalId: string;
  reward?: GoalReward;
  flowId?: string;
  log: string[];
}

function applyGoalReward(state: PlayerState, reward: GoalReward): void {
  for (const key of RESOURCE_KEYS) {
    const amount = reward[key] ?? 0;
    if (amount > 0) {
      state.resources[key] += amount;
    }
  }
  for (const frag of reward.fragments ?? []) {
    state.heroFragments[frag.heroId] = (state.heroFragments[frag.heroId] ?? 0) + frag.count;
  }
}

/**
 * 领取一个目标奖励：
 * 1. 惰性锚定 startTime。
 * 2. 找不到目标 -> 拒绝（not_found）。
 * 3. 先查 claimedGoalIds，已领取 -> 拒绝（already_claimed）。
 * 4. 天数未解锁（day > activeDay）-> 拒绝（locked）。
 * 5. 进度未达成 -> 拒绝（not_reached）。
 * 6. requestRewardGrant(ledger, goal_${goalId}, daily_goal)：duplicate -> 拒绝、不发奖。
 * 7. granted -> 发奖、confirmRewardGrant、记录 flowId、写 claimedGoalIds。
 * 以上拒绝分支均不发奖、不写 claimedGoalIds。
 */
export function claimGoal(
  state: PlayerState,
  ledger: RewardLedger,
  goalId: string,
  now: number,
  defs: DailyGoalDef[] = DEFAULT_DAILY_GOALS,
): ClaimGoalResult {
  const goals = state.dailyGoals;
  ensureAnchored(goals, now);
  const log: string[] = [];

  const def = findDef(goalId, defs);
  if (!def) {
    log.push('daily_goal_not_found');
    return { granted: false, duplicate: false, reason: 'not_found', goalId, log };
  }

  if (goals.claimedGoalIds.includes(goalId)) {
    log.push('daily_goal_already_claimed');
    return { granted: false, duplicate: false, reason: 'already_claimed', goalId, log };
  }

  const activeDay = resolveActiveDay(goals, now);
  if (def.day > activeDay) {
    log.push('daily_goal_locked');
    return { granted: false, duplicate: false, reason: 'locked', goalId, log };
  }

  const progress = goals.progress[goalId] ?? 0;
  if (progress < def.targetValue) {
    log.push('daily_goal_not_reached');
    return { granted: false, duplicate: false, reason: 'not_reached', goalId, log };
  }

  const outcome = requestRewardGrant(ledger, `goal_${goalId}`, GOAL_REWARD_ID);
  log.push(...outcome.log);
  if (!outcome.granted) {
    log.push('daily_goal_duplicate_rejected');
    return { granted: false, duplicate: outcome.duplicate, reason: 'duplicate', goalId, flowId: outcome.entry.flowId, log };
  }

  applyGoalReward(state, def.reward);
  confirmRewardGrant(outcome.entry);
  if (!state.claimedRewardFlowIds.includes(outcome.entry.flowId)) {
    state.claimedRewardFlowIds.push(outcome.entry.flowId);
  }
  if (!goals.claimedGoalIds.includes(goalId)) {
    goals.claimedGoalIds.push(goalId);
  }
  log.push('daily_goal_granted');

  return { granted: true, duplicate: false, goalId, reward: def.reward, flowId: outcome.entry.flowId, log };
}
