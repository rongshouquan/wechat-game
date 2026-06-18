// S7 专用纯 TS 实时自动战斗核心：公开类型层（BATTLE-RT-04，不依赖 cc）。
//
// 边界（依 RT-04 任务包）：仅战斗模拟核心的输入/输出/事件日志契约。
// - 不接 UI、不发奖励、不推进主线、不写存档、不接真实玩家阵容 assembler。
// - 不复用、不 import 流程版 BattleEngine / BattleUnit / HeroConfig / EnemyConfig /
//   SkillConfig / BattleLaunchService / BattlePlaybackService / cc。
// - 不把 pressure_param 自动换算成 hp / attack / armor。

/** 战斗阵营。 */
export type S7AutoBattleSide = 'player' | 'enemy';

/** 玩家上阵单位输入（不读取存档阵容；由调用方/测试夹具直接提供）。 */
export interface S7AutoBattlePlayerUnitInput {
  /** 指向 battle_unit_stat_param.rowId，targetType 必须是 ship。 */
  unitStatRef: string;
  /** 玩家 3x3 锚点格：p0c0..p2c2。 */
  slotRef: string;
}

/** 一场自动战斗的运行请求。 */
export interface S7AutoBattleRunRequest {
  /** 指向 battle_encounter_param.rowId（enc_n001 / enc_n018 / enc_n075 ...）。 */
  encounterRef: string;
  /** 战斗随机种子；同 seed 结果与日志完全一致。 */
  battleSeed: string | number;
  /** 玩家上阵单位（首版最多 5 个）。 */
  playerUnits: S7AutoBattlePlayerUnitInput[];
}

export type S7AutoBattleWinner = 'player' | 'enemy';
export type S7AutoBattleReason = 'all_enemies_down' | 'all_players_down' | 'timeout';

/** 事件触发日志的事件类型（不每 tick spam）。 */
export type S7AutoBattleLogType =
  | 'battle_start'
  | 'spawn_wave'
  | 'unit_attack'
  | 'damage'
  | 'heal'
  | 'energy_change'
  | 'ultimate_cast'
  | 'core_trigger'
  | 'state_apply'
  | 'state_expire'
  | 'unit_down'
  | 'boss_phase'
  | 'battle_end';

/**
 * 单条事件日志。
 * 公共字段：timeSec / type。其余字段按事件语义出现：
 * - 涉及单位：actorId / side / targetIds。
 * - 涉及效果：effectRef / effectType。
 * - 伤害 / 治疗 / 护盾变化：amount + hpAfter / shieldAfter。
 * - 状态事件：stateTag。
 * - battle_end：winner / reason / durationSec。
 */
export interface S7AutoBattleLogEntry {
  timeSec: number;
  type: S7AutoBattleLogType;
  actorId?: string;
  side?: S7AutoBattleSide;
  targetIds?: string[];
  effectRef?: string;
  effectType?: string;
  amount?: number;
  hpAfter?: number;
  shieldAfter?: number;
  energyAfter?: number;
  stateTag?: string;
  waveIndex?: number;
  phaseTag?: string;
  winner?: S7AutoBattleWinner;
  reason?: S7AutoBattleReason;
  durationSec?: number;
  note?: string;
}

/** 单位收尾快照（只读结果，不回写配置）。 */
export interface S7AutoBattleUnitFinalState {
  unitId: string;
  side: S7AutoBattleSide;
  unitStatRef: string;
  slotRef: string;
  hp: number;
  maxHp: number;
  shield: number;
  energy: number;
  alive: boolean;
}

export interface S7AutoBattleFinalState {
  durationSec: number;
  players: S7AutoBattleUnitFinalState[];
  enemies: S7AutoBattleUnitFinalState[];
}

/** 一场自动战斗的最终结果。 */
export interface S7AutoBattleResult {
  winner: S7AutoBattleWinner;
  reason: S7AutoBattleReason;
  durationSec: number;
  log: S7AutoBattleLogEntry[];
  finalState: S7AutoBattleFinalState;
}

/** 输入 / 配置不合法时抛出（运行时发现非法占格、非法玩家格等）。 */
export class S7AutoBattleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(`s7 auto battle 错误[${code}]: ${message}`);
    this.name = 'S7AutoBattleError';
  }
}
