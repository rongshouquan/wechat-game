// S7 专用纯 TS 实时自动战斗核心：公开类型层（BATTLE-RT-04，不依赖 cc）。
//
// 边界（依 RT-04 任务包）：仅战斗模拟核心的输入/输出/事件日志契约。
// - 不接 UI、不发奖励、不推进主线、不写存档、不接真实玩家阵容 assembler。
// - 不复用、不 import 流程版 BattleEngine / BattleUnit / HeroConfig / EnemyConfig /
//   SkillConfig / BattleLaunchService / BattlePlaybackService / cc。
// - 不把 pressure_param 自动换算成 hp / attack / armor。

import { S7EffectBlock } from './S7BattleEffectBlock';

/** 战斗阵营。 */
export type S7AutoBattleSide = 'player' | 'enemy';

/** 玩家上阵单位输入（不读取存档阵容；由调用方/测试夹具直接提供）。 */
export interface S7AutoBattlePlayerUnitInput {
  /** 指向 battle_unit_stat_param.rowId，targetType 必须是 ship。 */
  unitStatRef: string;
  /** 玩家 3x3 锚点格：p0c0..p2c2。 */
  slotRef: string;
  /**
   * 该单位四层（星舰/驾驶员/插件/星核）合成出的效果积木（v1.0 §4.6）。
   * 由上游装配/解析层填充（块3/4/5 据配置生成）；缺省/空数组时按星舰基线、不做任何叠加。
   */
  effectBlocks?: readonly S7EffectBlock[];
}

/** 内联敌方单位（【深空回廊专用·受控扩展】：按层号动态生成的敌阵落点）。 */
export interface S7AutoBattleInlineEnemyInput {
  /** 指向 battle_unit_stat_param.rowId（enemy 行）。 */
  unitStatRef: string;
  /** 敌方 5×7 锚点格：r0c0..r4c6。 */
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
  // ===== 以下三项 = 【深空回廊专用·受控扩展·全部可选】=====
  // 并行加法：主线/悬赏板战斗从不设这三项，缺省时引擎行为与扩展前逐字节一致（gate 零回归为机器验收）。
  /**
   * 内联敌阵：给了则用它一次性铺敌、**忽略** encounter 的 spawnPlanRefs（回廊按层动态生成敌阵）。
   * 缺省/空 → 走 encounter 出怪批次（主线/悬赏原路径，零行为变化）。
   */
  inlineEnemyUnits?: readonly S7AutoBattleInlineEnemyInput[];
  /**
   * 施加到全体敌人的效果积木（随层缩放 + 敌方戏法：铁甲潮/护盾矩阵/蜂群变弱），经 deriveUnit 合并。
   * 缺省 → 敌人按基线出场（主线/悬赏零行为变化）。
   */
  enemyEffectBlocks?: readonly S7EffectBlock[];
  /** 限时覆盖秒数（>0 覆盖 encounter.timeLimitSec；闪电战=40）。缺省/≤0 → 用 encounter 的限时（零行为变化）。 */
  timeLimitSecOverride?: number;
  /**
   * 机制批③ C14 硬控递减旋钮（《数值细表真源》§1 C14·真源载体=本批）：同一施加者对同一目标重复施加硬控
   * （短路/晕眩/沉默）时，时长 ×factor^n（n=窗口内已施加次数；距上次施加超过 windowSec 则计数归零）。
   * 缺省缺席=不递减（既有行为逐字节不变）；真机三入口（主线/悬赏/回廊）传 S7_HARD_CONTROL_DIMINISH 常量=规则开。
   */
  hardControlDiminish?: { factor: number; windowSec: number };
}

/** C14 硬控递减真值（数值细表真源 §1：同源重复 ×0.6^n·30s 窗口重置）——真机战斗入口统一传此常量。 */
export const S7_HARD_CONTROL_DIMINISH: { factor: number; windowSec: number } = { factor: 0.6, windowSec: 30 };

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
  | 'state_dispel'
  | 'unit_down'
  | 'boss_phase'
  | 'battle_end'
  | 'rank_swap' // 机制批③ 曲率星门：开局整排对调（targetIds=被移动单位·note=对调的两列）——演出层开场星门动画锚点
  | 'core_gacha'; // 机制批③ 幸运扭蛋：本次放技能随机到的强化（note=crit/area/echo/lifesteal/cd）——演出层扭蛋弹出锚点

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
  /** 块4b-2：本次伤害是否暴击（暴击词条命中时 true；非伤害事件省略）。 */
  crit?: boolean;
  /** ⑥8a：本次攻击被闪避（dodgeRate 词条命中时 true·amount=0；非闪避事件省略=旧日志形状不变）。 */
  dodged?: boolean;
  /** ⑦机制批①：本次攻击被免伤整发挡下（dmg_taken_down 总幅度≥1 时 true·amount=0；非免伤事件省略）。 */
  immune?: boolean;
  /** ⑦机制批①：state_apply 的当前叠层数（仅 >1 时携带；单层施加日志保持既有形状）。 */
  stacks?: number;
  /** ⑦机制批①：周期结算产生的伤害/治疗（burn/regen tick 时 true；非周期事件省略）。 */
  periodic?: boolean;
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
