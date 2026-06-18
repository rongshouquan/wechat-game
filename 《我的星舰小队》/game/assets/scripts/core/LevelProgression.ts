import { BattleResult, BattleUnit, buildEnemyUnit, simulateBattle, SimulateOptions } from '../combat/BattleEngine';
import { EnemyConfig, EnemyGroupConfig, LevelConfig } from '../config/ConfigTypes';

export type EnemyLookup = (enemyId: string) => EnemyConfig | undefined;

/** 玩家小队工厂：每场战斗需要一组全新的 BattleUnit 实例（含初始状态）。 */
export type SquadFactory = () => BattleUnit[];

export type StageOutcome =
  | { type: 'stage_win'; levelId: string }
  | { type: 'boss_start'; levelId: string }
  | { type: 'boss_win'; levelId: string }
  | { type: 'boss_fail'; levelId: string; reason: string }
  | { type: 'stage_fail'; levelId: string; reason: string };

export interface LevelBattleResult {
  levelId: string;
  isBoss: boolean;
  battle: BattleResult;
  win: boolean;
  failReason?: string;
  /**
   * 本场战斗实际使用的双方单位（S5C-04 起暴露，供战斗过程展示层读取 id/name/side/maxHp 等
   * 只读元数据；注意 hp/energy 等可变字段为战后终态，过程血量以日志 hp 快照为准）。
   */
  playerUnits: BattleUnit[];
  enemyUnits: BattleUnit[];
}

export interface CampaignProgress {
  /** 推进到的关卡 id：胜利则为下一关（或最终关），失败则停留在失败的关卡。 */
  currentLevelId: string;
  /** 已通关的关卡 id 列表，按顺序。 */
  clearedLevelIds: string[];
  outcomes: StageOutcome[];
  /** 战斗失败时记录失败原因；连续推进成功则为 undefined。 */
  failReason?: string;
}

/** 是否为 Boss 关：levelId 形如 "x-10" / "x-20"，或 type 字段标记为 boss。 */
export function isBossLevel(level: LevelConfig): boolean {
  return level.type === 'boss' || /-(10|20)$/.test(level.levelId);
}

/** 按 enemy_group_config 中的敌人列表与数量，从 enemy_config 构建出战敌人单位。 */
export function buildEnemyGroupUnits(group: EnemyGroupConfig, lookupEnemy: EnemyLookup): BattleUnit[] {
  const units: BattleUnit[] = [];
  for (const member of group.enemies) {
    const enemy = lookupEnemy(member.enemyId);
    if (!enemy) {
      throw new Error(`enemy_group_config "${group.enemyGroupId}" 引用的 enemyId "${member.enemyId}" 未找到`);
    }
    for (let i = 0; i < member.count; i++) {
      units.push(buildEnemyUnit(enemy, `#${i + 1}`));
    }
  }
  return units;
}

/** 运行单场关卡战斗：组装敌方单位并调用 BattleEngine 模拟。 */
export function runLevelBattle(
  level: LevelConfig,
  group: EnemyGroupConfig,
  lookupEnemy: EnemyLookup,
  squadFactory: SquadFactory,
  simOptions?: SimulateOptions,
): LevelBattleResult {
  const playerUnits = squadFactory();
  const enemyUnits = buildEnemyGroupUnits(group, lookupEnemy);
  const options: SimulateOptions = { timeoutSec: group.timeoutSec, ...simOptions };
  const battle = simulateBattle(playerUnits, enemyUnits, options);
  const win = battle.winner === 'player';
  return {
    levelId: level.levelId,
    isBoss: isBossLevel(level),
    battle,
    win,
    failReason: win ? undefined : battle.failReason,
    playerUnits,
    enemyUnits,
  };
}

/**
 * 关卡推进：按顺序逐关战斗。胜利则推进到下一关并记录 stage_win/boss_win，
 * 失败则停留在当前关卡，记录 boss_fail（普通关失败同样停留，但仅 Boss 关
 * 按设计要求返回 failReason）并立即终止后续推进。
 */
export function progressCampaign(
  levels: LevelConfig[],
  groupsById: Map<string, EnemyGroupConfig>,
  lookupEnemy: EnemyLookup,
  squadFactory: SquadFactory,
  simOptions?: SimulateOptions,
): CampaignProgress {
  const outcomes: StageOutcome[] = [];
  const clearedLevelIds: string[] = [];
  let currentLevelId = levels[0]?.levelId ?? '';
  let failReason: string | undefined;

  for (const level of levels) {
    const group = groupsById.get(level.enemyGroupId);
    if (!group) {
      throw new Error(`level "${level.levelId}" 引用的 enemyGroupId "${level.enemyGroupId}" 未找到`);
    }

    const isBoss = isBossLevel(level);
    if (isBoss) {
      outcomes.push({ type: 'boss_start', levelId: level.levelId });
    }

    const result = runLevelBattle(level, group, lookupEnemy, squadFactory, simOptions);

    if (result.win) {
      outcomes.push(isBoss ? { type: 'boss_win', levelId: level.levelId } : { type: 'stage_win', levelId: level.levelId });
      clearedLevelIds.push(level.levelId);
      const idx = levels.indexOf(level);
      const next = levels[idx + 1];
      currentLevelId = next ? next.levelId : level.levelId;
    } else {
      failReason = result.failReason ?? 'unknown';
      outcomes.push(
        isBoss
          ? { type: 'boss_fail', levelId: level.levelId, reason: failReason }
          : { type: 'stage_fail', levelId: level.levelId, reason: failReason },
      );
      currentLevelId = level.levelId;
      break;
    }
  }

  return { currentLevelId, clearedLevelIds, outcomes, failReason };
}
