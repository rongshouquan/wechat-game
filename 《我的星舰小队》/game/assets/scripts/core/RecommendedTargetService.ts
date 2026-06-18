/**
 * 推荐目标组件（C09）。
 *
 * 纯 TypeScript 模块，不依赖 cc：根据玩家当前状态给出"下一步该做什么"的单一主推荐目标 + 备选目标列表。
 * 不做 UI、不接广告、不计算离线收益（离线收益的"是否可领取"由调用方/C11 计算后通过 context 传入）。
 *
 * 推荐优先级（高 -> 低，命中即可成为候选，按优先级排序后取最高者为主目标）：
 * 1. 未确认胜利奖励（RewardLedger 中存在 pending/granted 但未 confirmed 的流水）
 * 2. 可领取离线收益（由外部计算结果传入）
 * 3. 最近失败修复（最近一次战斗失败，且存在可执行的修复动作）
 * 4. 可升级（资源足够升级至少一个角色）
 * 5. 挑战下一关 / 重刷上一关（兜底，恒定命中，保证任意状态下至少有一个非广告目标）
 */
import { PlayerState, computeUpgradeCost, getHeroLevel } from './PlayerState';
import { RewardLedger } from './RewardLedger';
import { LevelConfig } from '../config/ConfigTypes';

export type RecommendedTargetType =
  | 'unconfirmed_reward'
  | 'offline_reward'
  | 'defeat_recovery'
  | 'upgrade'
  | 'next_level'
  | 'replay_level'
  | 'safe_fallback';

export interface NavigationIntent {
  /** 目标场景/面板标识，供 UI 层路由跳转使用。 */
  scene: string;
  params?: Record<string, unknown>;
}

export interface RecommendedTarget {
  type: RecommendedTargetType;
  /** 文案 key，UI 层据此查询本地化文案，本服务不直接产出展示文本。 */
  textKey: string;
  navigationIntent: NavigationIntent;
  /** 推荐原因，便于调试面板/埋点记录"为什么推荐这个目标"。 */
  reason: string;
  /** 优先级数值，越小优先级越高，与上方 1-5 档一一对应。 */
  priority: number;
}

export interface RecommendedTargetResult {
  primary: RecommendedTarget;
  alternatives: RecommendedTarget[];
}

/** 最近一次战斗失败的上下文（由调用方/C10 失败分析模块产出后传入，本服务不做失败原因判定）。 */
export interface LastDefeatInfo {
  levelId: string;
  reason: string;
  /** 是否存在可执行的修复动作（如有可升级角色、可调整阵容等）。由调用方结合 C10 分析结果给出。 */
  recoveryAvailable: boolean;
}

export interface RecommendedTargetContext {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  /** 是否存在可领取的离线收益。计算逻辑属于 C11，本服务只消费结果，不做计算。 */
  hasClaimableOfflineReward: boolean;
  /** 最近一次失败信息；无失败记录或已通过其他方式恢复时为 undefined。 */
  lastDefeat?: LastDefeatInfo;
  /** 按 chapter/stage 顺序排列的关卡配置列表，用于推导"下一关"。 */
  levels: LevelConfig[];
  /** 玩家当前拥有/可操作的角色 id 列表，用于判断"是否存在可升级的角色"。 */
  ownedHeroIds: string[];
}

const PRIORITY = {
  unconfirmedReward: 1,
  offlineReward: 2,
  defeatRecovery: 3,
  upgrade: 4,
  fallback: 5,
} as const;

function buildUnconfirmedRewardTarget(ledger: RewardLedger): RecommendedTarget | undefined {
  const entry = ledger.entries.find((e) => e.status === 'pending' || e.status === 'granted');
  if (!entry) {
    return undefined;
  }
  return {
    type: 'unconfirmed_reward',
    textKey: 'recommend.unconfirmed_reward',
    navigationIntent: { scene: 'reward_claim', params: { flowId: entry.flowId, sourceId: entry.sourceId } },
    reason: `存在未确认领取的奖励流水 ${entry.flowId}（状态：${entry.status}）`,
    priority: PRIORITY.unconfirmedReward,
  };
}

function buildOfflineRewardTarget(hasClaimable: boolean): RecommendedTarget | undefined {
  if (!hasClaimable) {
    return undefined;
  }
  return {
    type: 'offline_reward',
    textKey: 'recommend.offline_reward',
    navigationIntent: { scene: 'offline_reward_claim' },
    reason: '存在可领取的离线收益',
    priority: PRIORITY.offlineReward,
  };
}

function buildDefeatRecoveryTarget(lastDefeat: LastDefeatInfo | undefined): RecommendedTarget | undefined {
  if (!lastDefeat || !lastDefeat.recoveryAvailable) {
    return undefined;
  }
  return {
    type: 'defeat_recovery',
    textKey: 'recommend.defeat_recovery',
    navigationIntent: { scene: 'defeat_recovery', params: { levelId: lastDefeat.levelId, reason: lastDefeat.reason } },
    reason: `最近一次在 ${lastDefeat.levelId} 失败（${lastDefeat.reason}），存在可执行的修复动作`,
    priority: PRIORITY.defeatRecovery,
  };
}

function hasAffordableUpgrade(playerState: PlayerState, ownedHeroIds: string[]): string | undefined {
  for (const heroId of ownedHeroIds) {
    const currentLevel = getHeroLevel(playerState, heroId);
    const cost = computeUpgradeCost(currentLevel);
    if (playerState.resources.starCoin >= cost.starCoin && playerState.resources.expChip >= cost.expChip) {
      return heroId;
    }
  }
  return undefined;
}

function buildUpgradeTarget(playerState: PlayerState, ownedHeroIds: string[]): RecommendedTarget | undefined {
  const affordableHeroId = hasAffordableUpgrade(playerState, ownedHeroIds);
  if (!affordableHeroId) {
    return undefined;
  }
  return {
    type: 'upgrade',
    textKey: 'recommend.upgrade',
    navigationIntent: { scene: 'hero_upgrade', params: { heroId: affordableHeroId } },
    reason: `资源足够升级角色 ${affordableHeroId}`,
    priority: PRIORITY.upgrade,
  };
}

function findNextLevelId(levels: LevelConfig[], clearedLevelIds: string[]): string | undefined {
  return levels.find((level) => !clearedLevelIds.includes(level.levelId))?.levelId;
}

function lastClearedLevelId(clearedLevelIds: string[]): string | undefined {
  return clearedLevelIds.length > 0 ? clearedLevelIds[clearedLevelIds.length - 1] : undefined;
}

/**
 * 兜底目标：恒定命中，保证函数在任意玩家状态下都至少返回一个"可被 UI 安全消费"的非广告目标。
 *
 * 三种情形：
 * 1. 存在未通关的下一关 -> 推荐挑战下一关（带 levelId，跳转到关卡战斗）。
 * 2. 无下一关但有已通关记录 -> 退化为重刷上一关（带 levelId，跳转到关卡战斗）。
 * 3. 既无下一关也无已通关记录（如关卡数据缺失/全新存档异常）-> 安全兜底，
 *    跳转到不依赖 levelId 的关卡选择界面（level_select），不在 params 中放入 undefined 字段，
 *    避免 UI 拿到 levelId: undefined 后无法安全跳转。
 */
function buildFallbackTarget(levels: LevelConfig[], clearedLevelIds: string[]): RecommendedTarget {
  const nextLevelId = findNextLevelId(levels, clearedLevelIds);
  if (nextLevelId) {
    return {
      type: 'next_level',
      textKey: 'recommend.next_level',
      navigationIntent: { scene: 'level_battle', params: { levelId: nextLevelId } },
      reason: `挑战下一关 ${nextLevelId}`,
      priority: PRIORITY.fallback,
    };
  }

  const replayLevelId = lastClearedLevelId(clearedLevelIds);
  if (replayLevelId) {
    return {
      type: 'replay_level',
      textKey: 'recommend.replay_level',
      navigationIntent: { scene: 'level_battle', params: { levelId: replayLevelId } },
      reason: `暂无新关卡可挑战，重刷上一关 ${replayLevelId} 攒资源`,
      priority: PRIORITY.fallback,
    };
  }

  return {
    type: 'safe_fallback',
    textKey: 'recommend.safe_fallback',
    navigationIntent: { scene: 'level_select' },
    reason: '暂无可推荐的具体关卡（无关卡数据或无通关记录），引导玩家进入关卡选择界面',
    priority: PRIORITY.fallback,
  };
}

/**
 * 解析推荐目标：按优先级收集所有当前命中的候选目标，排序后取最高优先级为主目标，其余作为备选。
 * 兜底目标恒定命中，因此返回结果的 primary 永远存在（任意玩家状态下至少有一个非广告目标）。
 */
export function resolveRecommendedTarget(context: RecommendedTargetContext): RecommendedTargetResult {
  const candidates: RecommendedTarget[] = [];

  const unconfirmedReward = buildUnconfirmedRewardTarget(context.rewardLedger);
  if (unconfirmedReward) candidates.push(unconfirmedReward);

  const offlineReward = buildOfflineRewardTarget(context.hasClaimableOfflineReward);
  if (offlineReward) candidates.push(offlineReward);

  const defeatRecovery = buildDefeatRecoveryTarget(context.lastDefeat);
  if (defeatRecovery) candidates.push(defeatRecovery);

  const upgrade = buildUpgradeTarget(context.playerState, context.ownedHeroIds);
  if (upgrade) candidates.push(upgrade);

  candidates.push(buildFallbackTarget(context.levels, context.playerState.clearedLevelIds));

  candidates.sort((a, b) => a.priority - b.priority);

  const [primary, ...alternatives] = candidates;
  return { primary, alternatives };
}
