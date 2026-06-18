import { EnemyGroupConfig, LevelConfig, RewardConfig } from '../config/ConfigTypes';
import { confirmRewardGrant, requestRewardGrant, RewardLedger } from './RewardLedger';
import { PlayerState } from './PlayerState';
import { EnemyLookup, LevelBattleResult, runLevelBattle, SquadFactory } from './LevelProgression';
import { SimulateOptions } from '../combat/BattleEngine';

export interface RewardSettlementOutcome {
  levelId: string;
  win: boolean;
  granted: boolean;
  duplicate: boolean;
  flowId?: string;
  log: string[];
}

/** 把 reward_config 中的资源/奖励内容应用到玩家状态（碎片暂只记录数量，不展开为具体存档结构）。 */
function applyRewardToState(state: PlayerState, reward: RewardConfig): void {
  state.resources.starCoin += reward.starCoin ?? 0;
  state.resources.expChip += reward.expChip ?? 0;
  state.resources.equipmentPart += reward.equipmentPart ?? 0;
  state.resources.baseEnergy += reward.baseEnergy ?? 0;
}

/**
 * 关卡胜利结算：通过奖励流水状态机申请发放，防止同一关卡奖励被重复领取；
 * 发放成功后把奖励内容计入玩家资源、记录已通关关卡与奖励流水 id。
 * 关卡失败时不应调用本函数（不发放通关奖励）。
 */
export function settleLevelVictory(
  ledger: RewardLedger,
  state: PlayerState,
  levelId: string,
  reward: RewardConfig,
): RewardSettlementOutcome {
  const outcome = requestRewardGrant(ledger, levelId, reward.rewardId);

  if (outcome.duplicate) {
    return { levelId, win: true, granted: false, duplicate: true, flowId: outcome.entry.flowId, log: outcome.log };
  }

  applyRewardToState(state, reward);
  if (!state.clearedLevelIds.includes(levelId)) {
    state.clearedLevelIds.push(levelId);
  }
  state.claimedRewardFlowIds.push(outcome.entry.flowId);
  confirmRewardGrant(outcome.entry);

  return {
    levelId,
    win: true,
    granted: true,
    duplicate: false,
    flowId: outcome.entry.flowId,
    log: outcome.log,
  };
}

/** 关卡失败：不发放通关奖励，仅返回结算结果用于日志展示。 */
export function settleLevelDefeat(levelId: string): RewardSettlementOutcome {
  return { levelId, win: false, granted: false, duplicate: false, log: [] };
}

export interface PlayLevelResult {
  battle: LevelBattleResult;
  settlement: RewardSettlementOutcome;
}

/**
 * 与 LevelProgression 打通的单关流程：调用 BattleEngine 跑完一场关卡战斗，
 * 胜利则通过奖励流水状态机结算 reward_config 奖励（防重复领取），
 * 失败则不发放通关奖励，仅返回失败结果（含 failReason）。
 */
export function playLevelAndSettle(
  level: LevelConfig,
  group: EnemyGroupConfig,
  reward: RewardConfig,
  lookupEnemy: EnemyLookup,
  squadFactory: SquadFactory,
  ledger: RewardLedger,
  state: PlayerState,
  simOptions?: SimulateOptions,
): PlayLevelResult {
  const battle = runLevelBattle(level, group, lookupEnemy, squadFactory, simOptions);
  const settlement = battle.win
    ? settleLevelVictory(ledger, state, level.levelId, reward)
    : settleLevelDefeat(level.levelId);

  return { battle, settlement };
}
