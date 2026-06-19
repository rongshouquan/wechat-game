// 活动进度（块7a，纯 TS，不依赖 cc）：v1.0 §10.5「3 天行动 / 7 天扩张（不做每日任务）」的存档载体 + 领取骨架。
// 两种活动：action3(3 天行动·短周期) / expansion7(7 天扩张·中周期)。
//   进度靠玩家正常游玩自然累积(推关/升级/打捞/抽卡等 → 由各系统调 addActivityProgress 喂入；喂入点留 C1b)。
//   到里程碑阈值给过程奖励、到完成阈值给完成奖励(3天=星辉货舱/7天=史诗信标·星核碎片)。
// 本层只管「进度 + 领取状态」：阈值由配置传入(第二块细表填)、发奖由调用方接(如发星辉货舱→S7ChestInventory.addChest)，
//   本层不写阈值、不发奖（与配置/发放解耦）。
// 留块7b：结算宝藏(行动/扩张宝藏) + 周期窗口(开启/到期滚动) + 跨期追赶(§12) —— 这些带时间，本块不做。
// 与 S7ChestInventory / S7Population 同构：固定键集 + createDefault/normalize + 纯操作，S7SaveService 组合进 S7PlayerState。

/** 两种活动键（v1.0 §10.5）：3 天行动 / 7 天扩张。命名与 reward_param.sourceType 一致。 */
export const S7_ACTIVITY_TYPES = ['action3', 'expansion7'] as const;
export type S7ActivityType = (typeof S7_ACTIVITY_TYPES)[number];

/** 单个活动的当前进度状态（块7a：不含周期时间字段，周期滚动留块7b）。 */
export interface S7ActivityState {
  /** 当前周期累计进度点（≥0，可非整数——进度权重可由喂入方决定）。 */
  progress: number;
  /** 已领过程里程碑 id 列表（id 由配置定义，本层不校验存在性）。 */
  claimedMilestones: string[];
  /** 完成奖励是否已领。 */
  completionClaimed: boolean;
}

/** 活动进度子状态：键集恒为 S7_ACTIVITY_TYPES。 */
export type S7ActivityProgressState = Record<S7ActivityType, S7ActivityState>;

function createDefaultActivityState(): S7ActivityState {
  return { progress: 0, claimedMilestones: [], completionClaimed: false };
}

/** 默认空活动进度（两种活动均零）。 */
export function createDefaultS7ActivityProgress(): S7ActivityProgressState {
  const out = {} as S7ActivityProgressState;
  for (const t of S7_ACTIVITY_TYPES) out[t] = createDefaultActivityState();
  return out;
}

/**
 * 规范化单个活动状态：progress 取有限非负数(否则 0)；claimedMilestones 只留非空字符串、去重；
 * completionClaimed 强制布尔。防脏档/篡改。
 */
function normalizeActivityState(raw: unknown): S7ActivityState {
  const out = createDefaultActivityState();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p = src.progress;
  if (typeof p === 'number' && Number.isFinite(p) && p >= 0) out.progress = p;
  if (Array.isArray(src.claimedMilestones)) {
    const seen = new Set<string>();
    for (const id of src.claimedMilestones) {
      if (typeof id !== 'string' || id.length === 0) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.claimedMilestones.push(id);
    }
  }
  out.completionClaimed = src.completionClaimed === true;
  return out;
}

/** 规范化活动进度：键集恒为 S7_ACTIVITY_TYPES，缺项补默认、未知键丢弃。 */
export function normalizeS7ActivityProgress(raw: unknown): S7ActivityProgressState {
  const out = createDefaultS7ActivityProgress();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const t of S7_ACTIVITY_TYPES) out[t] = normalizeActivityState(src[t]);
  return out;
}

/** 取某活动当前进度。 */
export function getActivityProgress(state: S7ActivityProgressState, type: S7ActivityType): number {
  return state[type].progress;
}

/** 喂入进度（amount 须为有限正数；非正/非有限/未知类型 = 无操作）。就地修改。 */
export function addActivityProgress(state: S7ActivityProgressState, type: S7ActivityType, amount: number): void {
  if (!S7_ACTIVITY_TYPES.includes(type)) return;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
  state[type].progress += amount;
}

/** 某里程碑是否已领。 */
export function isMilestoneClaimed(state: S7ActivityProgressState, type: S7ActivityType, milestoneId: string): boolean {
  if (!S7_ACTIVITY_TYPES.includes(type)) return false;
  return state[type].claimedMilestones.includes(milestoneId);
}

/** 是否可领某里程碑：进度达到阈值(由配置传入) 且 未领过。 */
export function canClaimMilestone(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  milestoneId: string,
  threshold: number,
): boolean {
  if (!S7_ACTIVITY_TYPES.includes(type)) return false;
  if (typeof milestoneId !== 'string' || milestoneId.length === 0) return false;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return false;
  if (isMilestoneClaimed(state, type, milestoneId)) return false;
  return state[type].progress >= threshold;
}

/**
 * 领取里程碑（仅记账，不发奖——奖励内容由调用方按配置发）。
 * 可领则记入已领、返回 true；不可领（未达阈值/已领/非法）返回 false 不改状态。
 */
export function claimMilestone(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  milestoneId: string,
  threshold: number,
): boolean {
  if (!canClaimMilestone(state, type, milestoneId, threshold)) return false;
  state[type].claimedMilestones.push(milestoneId);
  return true;
}

/** 是否可领完成奖励：进度达到完成阈值 且 未领过。 */
export function canClaimCompletion(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  completionThreshold: number,
): boolean {
  if (!S7_ACTIVITY_TYPES.includes(type)) return false;
  if (typeof completionThreshold !== 'number' || !Number.isFinite(completionThreshold)) return false;
  if (state[type].completionClaimed) return false;
  return state[type].progress >= completionThreshold;
}

/**
 * 领取完成奖励（仅记账，不发奖）。可领则置 completionClaimed、返回 true；否则返回 false 不改状态。
 * 完成奖励内容(3天=星辉货舱/7天=史诗信标·星核碎片)由调用方按配置发。
 */
export function claimCompletion(
  state: S7ActivityProgressState,
  type: S7ActivityType,
  completionThreshold: number,
): boolean {
  if (!canClaimCompletion(state, type, completionThreshold)) return false;
  state[type].completionClaimed = true;
  return true;
}
