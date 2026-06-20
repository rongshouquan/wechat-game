// S7 对局编排（C1b-step1b，纯 TS，不依赖 cc）：把"打一个主线节点"串成一次可用的最小对局——
//   跑战斗(S7BattleRunService) → 判胜(summary.winner) → 胜则结算(settleS7NodeVictory) → 应用(发软货币+推进)。
//
// 两个产物：
//   ① playS7Node：纯函数，跑一局并返回 {战斗结果, 是否胜, 结算结果}，不改任何状态（供需要原始结果的调用方）。
//   ② S7RunSession：持有 {resources, progress} 的轻量会话——playCurrentNode 内部跑+结算+应用，
//      让"战斗→拿奖→推进→再战"的最小循环能在 Node 里直接转起来、可单测。
//
// 边界：core 层自包含——只依赖 config(S7ConfigRuntime) + 同族 S7* 模块；不 import save
//   （resources 以 Record<string,number> 持有，progress 用 S7MainlineProgressState；由上层从 S7PlayerState 桥接），
//   不 import cc。表现层(Cocos·step2)只需：构造会话→点"出战"调 playCurrentNode→读会话态刷 UI→写回存档落盘。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7MainlineModel, S7MainlineProgressState } from './S7MainlineProgress';
import { S7BattleRunService, S7BattleRunResult } from './S7BattleRunService';
import { S7BattleLineupUnitInput } from './S7BattleEncounterAssembler';
import { createS7DefaultDryRunLineup } from './S7DefaultBattleLineup';
import { S7UnitLevelState, getShipLevel } from './S7UnitLevelState';
import { S7SquadState, buildSquadLineup } from './S7Squad';
import { S7PluginInventoryState } from './S7PluginInventory';
import {
  S7NodeSettlementResult,
  settleS7NodeVictory,
  applyResourceGrants,
} from './S7NodeSettlement';

export interface S7PlayNodeRequest {
  runtime: S7ConfigRuntime;
  model: S7MainlineModel;
  /** 只读进度：决定打哪个节点(= currentNodeId)；本函数不写回。 */
  progress: S7MainlineProgressState;
  /** 显式运行种子（与 nodeId 组合成 battleSeed，确定可复算）；不可用随机/时间。 */
  runSeed: string | number;
  /** 出战阵容；缺省用默认 3 舰 dry-run 阵容。 */
  lineup?: S7BattleLineupUnitInput[];
}

export interface S7PlayNodeOutcome {
  /** 本局所打节点（= 战斗上下文节点 = 进度当前节点）。 */
  nodeId: string;
  /** 完整战斗结果（含日志/摘要，供表现层回放/展示）。 */
  battle: S7BattleRunResult;
  /** 是否我方胜（summary.winner === 'player'）。 */
  won: boolean;
  /** 胜则为结算结果（含发放+推进后进度）；负则 null。 */
  settlement: S7NodeSettlementResult | null;
}

/**
 * 跑一个节点对局（纯函数，不改入参、不写状态、不落盘）：
 * 跑战斗 → 胜则按"首通"结算（settleS7NodeVictory 内含顺序校验，重复挑战自然不发奖）。
 * 战斗本身由 S7BattleRunService 跑（同 runtime/progress/lineup/runSeed 完全可复现）。
 */
export function playS7Node(req: S7PlayNodeRequest): S7PlayNodeOutcome {
  const lineup = req.lineup ?? createS7DefaultDryRunLineup();
  const battle = new S7BattleRunService().run({
    runtime: req.runtime,
    progress: req.progress,
    runSeed: req.runSeed,
    lineup,
  });
  const nodeId = battle.context.nodeId; // 权威节点 = 战斗上下文（= progress.currentNodeId）
  const won = battle.summary.winner === 'player';
  const settlement = won ? settleS7NodeVictory(req.model, req.progress, req.runtime, nodeId) : null;
  return { nodeId, battle, won, settlement };
}

/**
 * 最小对局会话：持有玩家资源账本 + 主线进度，封装"打当前节点并应用结果"。
 * 状态以中性结构持有（不绑 S7PlayerState），由表现层从存档桥接进来、跑完写回。
 */
export class S7RunSession {
  constructor(
    /** 资源账本（实际传 S7PlayerState.resources）：胜利发放就地累加于此。 */
    public readonly resources: Record<string, number>,
    /** 主线进度：胜利推进后整体替换。 */
    public progress: S7MainlineProgressState,
    private readonly runtime: S7ConfigRuntime,
    private readonly model: S7MainlineModel,
    /** 单位等级（C1b 升级变强，可选）：给了则默认出战阵容按各舰等级折成成长积木→战斗更强。 */
    private readonly unitLevels?: S7UnitLevelState,
    /** 玩家阵容/编队（阶段一A，可选）：给了且编队合法则默认出战用玩家编队（否则回退默认 3 舰）。 */
    private readonly squad?: S7SquadState,
    /** 插件库存（B 块·单舰深装，可选）：给了则编队里装的插件实例被解析成战斗词条（真进战斗生效）。 */
    private readonly pluginInventory?: S7PluginInventoryState,
  ) {}

  /** 当前待打节点。 */
  get currentNodeId(): string {
    return this.progress.currentNodeId;
  }

  /**
   * 默认出战阵容：① 给了 squad 且编队校验通过 → 用玩家编队（含星舰等级）；
   * ② 否则回退默认 3 舰 dry-run（按 unitLevels 带等级）。保证未配编队/编队非法时仍能跑（零回归）。
   */
  private defaultLeveledLineup(): S7BattleLineupUnitInput[] {
    if (this.squad) {
      const built = buildSquadLineup(this.squad, this.unitLevels, this.pluginInventory);
      if (built.ok) return built.lineup;
    }
    const base = createS7DefaultDryRunLineup();
    if (!this.unitLevels) return base;
    return base.map((u) => ({ ...u, shipLevel: getShipLevel(this.unitLevels!, u.shipId) }));
  }

  /**
   * 打当前节点：跑战斗 → 胜且首通则发软货币(入账 resources)+推进进度。返回完整 outcome。
   * 负 / 重复挑战(结算 ok:false)：resources 与 progress 均不变。
   * 未显式传 lineup 时用"按等级变强"的默认阵容（升过级的船在战斗里更强）。
   */
  playCurrentNode(runSeed: string | number, lineup?: S7BattleLineupUnitInput[]): S7PlayNodeOutcome {
    const outcome = playS7Node({
      runtime: this.runtime,
      model: this.model,
      progress: this.progress,
      runSeed,
      lineup: lineup ?? this.defaultLeveledLineup(),
    });
    if (outcome.won && outcome.settlement && outcome.settlement.ok) {
      applyResourceGrants(this.resources, outcome.settlement.grants);
      this.progress = outcome.settlement.nextProgress;
    }
    return outcome;
  }
}
