/**
 * 埋点服务（C13，阶段2最小埋点）。
 *
 * 纯 TypeScript 模块，不依赖 cc：负责按统一字段结构产出埋点事件，并分发给所有已注册的 Sink。
 * 本任务只做事件产出 + 本地可调试输出，真实上报通道（云函数 trackEvent / 失败重试队列）留到阶段4。
 *
 * 每条事件的最小 payload 字段（《数据接入技术方案》通用字段裁剪为阶段2闭环所需）：
 * - eventName：事件名
 * - timestamp：事件发生时间戳
 * - sessionId：本次会话 ID
 * - playerSnapshot：玩家关键状态快照（资源、最高关卡、角色等级概要）
 * - payload：事件自定义数据
 */
import { PlayerResources, PlayerState } from '../core/PlayerState';

/** 阶段2闭环最小埋点事件集（事件名沿用《数据接入技术方案》P0 命名口径）。 */
export const AnalyticsEvent = {
  /** 关卡开始。 */
  LevelStart: 'stage_start',
  /** 关卡结束（胜利/失败统一出口，胜负放入 payload.win）。 */
  LevelEnd: 'stage_end',
  /** 推荐目标被采纳（玩家点击主推荐目标跳转）。 */
  RecommendedTargetAdopted: 'goal_adopt',
  /** 一键升级触发。 */
  OneTapUpgradeTriggered: 'one_tap_upgrade',
  /** 失败弹窗展示。 */
  DefeatDialogShow: 'defeat_dialog_show',
  /** 失败弹窗中选择某条挽留路径。 */
  DefeatActionSelect: 'defeat_action_select',
  /** 离线收益领取。 */
  OfflineRewardClaim: 'offline_reward_claim',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** 玩家关键状态快照：只取闭环分析需要的概要字段，不整包搬运存档。 */
export interface PlayerSnapshot {
  resources: PlayerResources;
  /** 最高（最近）已通关关卡 id；无通关记录时为 null。 */
  highestClearedLevelId: string | null;
  /** 已通关关卡数量。 */
  clearedLevelCount: number;
  /** 角色等级概要（heroId -> level）。 */
  heroLevels: Record<string, number>;
}

export interface AnalyticsEventRecord {
  eventName: string;
  timestamp: number;
  sessionId: string;
  playerSnapshot: PlayerSnapshot;
  payload: Record<string, unknown>;
}

/** 埋点输出通道。阶段2仅有本地 Sink；阶段4再接云上报 Sink。 */
export interface AnalyticsSink {
  record(event: AnalyticsEventRecord): void;
}

/** 由玩家状态构造关键状态快照（浅拷贝资源/等级，避免事件持有可变引用）。 */
export function buildPlayerSnapshot(state: PlayerState): PlayerSnapshot {
  const cleared = state.clearedLevelIds;
  return {
    resources: { ...state.resources },
    highestClearedLevelId: cleared.length > 0 ? cleared[cleared.length - 1] : null,
    clearedLevelCount: cleared.length,
    heroLevels: { ...state.heroLevels },
  };
}

export type NowFn = () => number;

export interface AnalyticsServiceOptions {
  /** 本次会话 ID（每次启动生成，调用方负责生成与持有）。 */
  sessionId: string;
  /** 输出通道列表（至少一个 LocalAnalyticsSink）。 */
  sinks: AnalyticsSink[];
  /** 时间源，默认 Date.now，可注入便于测试。 */
  now?: NowFn;
}

export class AnalyticsService {
  private readonly sessionId: string;
  private readonly sinks: AnalyticsSink[];
  private readonly now: NowFn;

  constructor(options: AnalyticsServiceOptions) {
    this.sessionId = options.sessionId;
    this.sinks = options.sinks;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * 发出一条埋点事件：按最小字段组装事件，分发给所有 Sink，并返回组装后的事件（便于调用方/测试断言）。
   */
  track(
    eventName: AnalyticsEventName | string,
    state: PlayerState,
    payload: Record<string, unknown> = {},
  ): AnalyticsEventRecord {
    const event: AnalyticsEventRecord = {
      eventName,
      timestamp: this.now(),
      sessionId: this.sessionId,
      playerSnapshot: buildPlayerSnapshot(state),
      payload,
    };
    for (const sink of this.sinks) {
      sink.record(event);
    }
    return event;
  }
}
