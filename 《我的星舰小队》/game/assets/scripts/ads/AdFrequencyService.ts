import { AdConfig } from '../config/ConfigTypes';

/** 限频拒绝原因。 */
export type AdFrequencyRejectReason = 'daily_limit' | 'session_limit' | 'cooldown';

export interface AdFrequencyDecision {
  allowed: boolean;
  reason?: AdFrequencyRejectReason;
  /** 当前剩余每日次数（已考虑跨日重置）。 */
  remainingDaily: number;
  /** 当前剩余会话次数（按会话内存计）。 */
  remainingSession: number;
  /** 冷却剩余毫秒；未冷却为 0。 */
  cooldownRemainingMs: number;
}

/**
 * 可持久化的单广告位每日/冷却计数（跨会话保留，运行时可由存档承载）。
 * sessionCount 不在此结构内——会话次数随 app 进程内存计，新会话从 0 开始。
 */
export interface AdSlotDailyState {
  dayKey: number;
  dailyCount: number;
  lastCompletedAtMs: number | null;
}

export interface AdFrequencyState {
  slots: Record<string, AdSlotDailyState>;
}

const DAY_MS = 86_400_000;

/**
 * 由时间戳推导“日”索引（UTC 自然日）。
 * 时间源策略（TD-005 方案 B，Ron 2026-06-11 确认）：首发灰度采用本地时间（调用方注入 Date.now()），
 * 不接云函数/远端时间源——改本地系统时间可能刷新每日次数，属首发已知接受风险；
 * “服务器时间优先、本地兜底”的强防改时间能力后置到真实云/远端时间阶段（届时调用方改注入来源即可，本函数无需变更）。
 * 时钟回拨场景下冷却判定按保守处理（见 canRequest）。
 */
export function dayIndexOf(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

/**
 * 广告限频服务：按 AdConfig 的 dailyLimit / sessionLimit / cooldownSec 对单广告位做每日、会话、冷却三重限频。
 * 纯 TS，不依赖 cc / wx；时间由调用方注入（nowMs），便于 Node/Vitest 确定性测试。
 * 仅做“能否再看一次广告”的判定与“完整观看后计数”，不发奖、不接 RewardLedger（发奖防重见 AdRewardFlowService）。
 */
export class AdFrequencyService {
  private readonly configs: Map<string, AdConfig>;
  private readonly state: AdFrequencyState;
  private readonly sessionCounts = new Map<string, number>();

  constructor(configs: AdConfig[] | Map<string, AdConfig>, initialState?: AdFrequencyState) {
    this.configs = configs instanceof Map ? configs : new Map(configs.map((c) => [c.adSlotId, c]));
    this.state = initialState ? cloneState(initialState) : { slots: {} };
  }

  /** 导出可持久化的每日/冷却计数（深拷贝；不含会话计数）。 */
  getState(): AdFrequencyState {
    return cloneState(this.state);
  }

  /** 判断当前是否允许再请求一次该广告位的广告。 */
  canRequest(adSlotId: string, nowMs: number): AdFrequencyDecision {
    const cfg = this.requireConfig(adSlotId);
    const day = dayIndexOf(nowMs);
    const slot = this.state.slots[adSlotId];

    const dailyUsed = slot && slot.dayKey === day ? slot.dailyCount : 0;
    const sessionUsed = this.sessionCounts.get(adSlotId) ?? 0;
    const remainingDaily = Math.max(0, cfg.dailyLimit - dailyUsed);
    const remainingSession = Math.max(0, cfg.sessionLimit - sessionUsed);

    const lastAt = slot?.lastCompletedAtMs ?? null;
    const cooldownMs = cfg.cooldownSec * 1000;
    // 时钟回拨（nowMs < lastAt）时 elapsed 为负，剩余冷却会变大 -> 仍判为冷却中，保守不放行。
    const cooldownRemainingMs = lastAt === null ? 0 : Math.max(0, cooldownMs - (nowMs - lastAt));

    let reason: AdFrequencyRejectReason | undefined;
    if (dailyUsed >= cfg.dailyLimit) {
      reason = 'daily_limit';
    } else if (sessionUsed >= cfg.sessionLimit) {
      reason = 'session_limit';
    } else if (cooldownRemainingMs > 0) {
      reason = 'cooldown';
    }

    return { allowed: reason === undefined, reason, remainingDaily, remainingSession, cooldownRemainingMs };
  }

  /**
   * 记录一次“完整观看”：每日 +1、会话 +1，并刷新冷却起点。
   * 只应在广告 completed 且确实新发放奖励时调用——失败 / 中断 / 重复不调用（不消耗成功次数）。
   */
  recordCompleted(adSlotId: string, nowMs: number): void {
    this.requireConfig(adSlotId);
    const day = dayIndexOf(nowMs);
    const slot = this.state.slots[adSlotId];
    if (!slot || slot.dayKey !== day) {
      this.state.slots[adSlotId] = { dayKey: day, dailyCount: 1, lastCompletedAtMs: nowMs };
    } else {
      slot.dailyCount += 1;
      slot.lastCompletedAtMs = nowMs;
    }
    this.sessionCounts.set(adSlotId, (this.sessionCounts.get(adSlotId) ?? 0) + 1);
  }

  private requireConfig(adSlotId: string): AdConfig {
    const cfg = this.configs.get(adSlotId);
    if (!cfg) {
      throw new Error(`AdFrequencyService: 未知 adSlotId "${adSlotId}"`);
    }
    return cfg;
  }
}

function cloneState(state: AdFrequencyState): AdFrequencyState {
  const slots: Record<string, AdSlotDailyState> = {};
  for (const [id, s] of Object.entries(state.slots)) {
    slots[id] = { dayKey: s.dayKey, dailyCount: s.dailyCount, lastCompletedAtMs: s.lastCompletedAtMs };
  }
  return { slots };
}
