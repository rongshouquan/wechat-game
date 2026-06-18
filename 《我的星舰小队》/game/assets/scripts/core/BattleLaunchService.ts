/**
 * 真实战斗发起服务（S5C-02，纯 TS，不依赖 cc）。
 *
 * 把真实阵容（playerState.onFieldHeroIds，S5C-01 起为存档真源）与配置表组装成一场关卡战斗：
 * - assembleSquad：按 Formation 的 2 前排 + 3 后排结构分配站位，产出 BattleEngine 出战单位
 *   与 DefeatAnalysisService 所需的真实阵容摘要（含真实等级、positionType 与实际分配站位）。
 * - launchLevelBattle：复用 LevelProgression.runLevelBattle 跑真实 BattleEngine 模拟，
 *   产出关卡战斗结果 + 真实 BattleDebugReport；失败时附带真实 DefeatAnalysisContext，
 *   替换 TD-003 的样例失败上下文（buildSampleDefeatContext）。
 *
 * 出战属性（S5C-05 起）：按英雄真实等级经 HeroStatGrowthService 折算最终 hp/atk/def 传入
 * buildHeroUnit，使升级真正影响战斗结果；不改 hero_config 基础值、不改技能倍率/攻速/装备战力。
 * 等级同样如实进入阵容摘要，供失败分析（insufficient_level 判定）使用。
 */
import { BattleUnit, buildHeroUnit, SimulateOptions } from '../combat/BattleEngine';
import { computeHeroFinalStats } from './HeroStatGrowthService';
import { LevelBattleResult, runLevelBattle } from './LevelProgression';
import { BattleDebugReport, buildBattleDebugReport } from '../debug/BattleDebugReport';
import { DefeatAnalysisContext, SquadMemberSummary } from './DefeatAnalysisService';
import { EnemyConfig, EnemyGroupConfig, HeroConfig, LevelConfig, SkillConfig } from '../config/ConfigTypes';
import { PlayerState, getHeroLevel } from './PlayerState';
import { SQUAD_SIZE, SlotPosition } from './Formation';

/** 与 Formation 的固定槽位结构一致：2 前排 + 3 后排。 */
const ROW_CAPACITY: Record<SlotPosition, number> = { front: 2, back: 3 };

export interface SquadAssembly {
  /** BattleEngine 出战单位（每次组装均为全新实例，含满血/零能量初始状态）。 */
  units: BattleUnit[];
  /** 失败分析用阵容摘要：真实 heroId/role/positionType/实际站位/真实等级。 */
  summary: SquadMemberSummary[];
}

export interface AssembleSquadParams {
  /** 上阵英雄 id（真源 playerState.onFieldHeroIds）。去重后最多取 SQUAD_SIZE 人。 */
  onFieldHeroIds: string[];
  heroes: HeroConfig[];
  skills: SkillConfig[];
  /** 用于读取真实英雄等级（getHeroLevel）。 */
  playerState: PlayerState;
}

/**
 * 按真实阵容组装出战小队。站位分配规则：优先放入与 hero_config.positionType 匹配的排
 * （前排容量 2 / 后排容量 3），该排已满则落到另一排——此时 assignedPosition 与 positionType
 * 不一致，作为真实数据交给失败分析判定 formation_issue，不做掩盖。
 * 引用了不存在的 heroId 属配置/存档数据错误，直接抛错（调用方决定降级策略）。
 */
export function assembleSquad(params: AssembleSquadParams): SquadAssembly {
  // 不用 `[...new Set(arr)]`：微信小游戏构建（Cocos 3.8.8）会将其降级编译为
  // `[].concat(new Set(arr))`，但 Array.prototype.concat 不会展开 Set/迭代器，
  // 结果是 `[Set实例]` 而非去重后的元素数组，导致后续按 heroId 查找全部失败。
  // Array.from(...) 是普通函数调用，不受该 spread 降级转换影响，可正确展开 Set。
  const uniqueIds = Array.from(new Set(params.onFieldHeroIds)).slice(0, SQUAD_SIZE);
  const rowUsed: Record<SlotPosition, number> = { front: 0, back: 0 };
  const units: BattleUnit[] = [];
  const summary: SquadMemberSummary[] = [];

  for (const heroId of uniqueIds) {
    const hero = params.heroes.find((h) => h.heroId === heroId);
    if (!hero) {
      throw new Error(`assembleSquad: 上阵英雄 "${heroId}" 在 hero_config 中不存在`);
    }

    let assigned: SlotPosition = hero.positionType;
    if (rowUsed[assigned] >= ROW_CAPACITY[assigned]) {
      const other: SlotPosition = assigned === 'front' ? 'back' : 'front';
      if (rowUsed[other] >= ROW_CAPACITY[other]) {
        break; // 两排均满（理论上 uniqueIds 已截断为 5 人，不会走到；防御性兜底）
      }
      assigned = other;
    }
    rowUsed[assigned] += 1;

    // S5C-05：按真实等级折算入场最终属性（升级真正影响战斗）；等级 1 时即为基础值。
    const level = getHeroLevel(params.playerState, heroId);
    const finalStats = computeHeroFinalStats({ hp: hero.baseHp, atk: hero.baseAtk, def: hero.baseDef }, level);
    const unit = buildHeroUnit(hero, params.skills, '', finalStats);
    units.push(unit);
    summary.push({
      unitId: unit.id,
      heroId: hero.heroId,
      role: hero.role,
      positionType: hero.positionType,
      assignedPosition: assigned,
      level,
    });
  }

  return { units, summary };
}

export interface LaunchLevelBattleParams {
  levelId: string;
  levels: LevelConfig[];
  enemyGroups: EnemyGroupConfig[];
  enemies: EnemyConfig[];
  heroes: HeroConfig[];
  skills: SkillConfig[];
  playerState: PlayerState;
  simOptions?: SimulateOptions;
}

export interface LevelBattleLaunchResult {
  /** 关卡战斗结果（含完整 BattleResult 日志与胜负）。 */
  levelResult: LevelBattleResult;
  /** 真实战报（由本场战斗日志聚合，替换样例数据）。 */
  report: BattleDebugReport;
  /** 出战阵容摘要（与本场战斗一致）。 */
  squad: SquadMemberSummary[];
  /** 失败时的真实失败分析上下文（驱动失败弹窗）；胜利时为 undefined。 */
  defeatContext?: DefeatAnalysisContext;
}

/**
 * 发起一场真实关卡战斗：真实阵容 + level_config/enemy_group_config/enemy_config 驱动，
 * 胜负完全由 BattleEngine 模拟结果决定。关卡/敌组/敌人配置缺失属数据错误，直接抛错。
 */
export function launchLevelBattle(params: LaunchLevelBattleParams): LevelBattleLaunchResult {
  const level = params.levels.find((l) => l.levelId === params.levelId);
  if (!level) {
    throw new Error(`launchLevelBattle: 关卡 "${params.levelId}" 在 level_config 中不存在`);
  }
  const group = params.enemyGroups.find((g) => g.enemyGroupId === level.enemyGroupId);
  if (!group) {
    throw new Error(`launchLevelBattle: 关卡 "${level.levelId}" 引用的敌组 "${level.enemyGroupId}" 不存在`);
  }

  const assembly = assembleSquad({
    onFieldHeroIds: params.playerState.onFieldHeroIds,
    heroes: params.heroes,
    skills: params.skills,
    playerState: params.playerState,
  });

  const levelResult = runLevelBattle(
    level,
    group,
    (enemyId) => params.enemies.find((e) => e.enemyId === enemyId),
    () => assembly.units,
    params.simOptions,
  );

  const report = buildBattleDebugReport(levelResult.battle);

  return {
    levelResult,
    report,
    squad: assembly.summary,
    defeatContext: levelResult.win
      ? undefined
      : { report, levelId: level.levelId, squad: assembly.summary, recommendedPower: level.recommendedPower },
  };
}
