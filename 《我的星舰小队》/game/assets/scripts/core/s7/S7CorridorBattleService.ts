// 深空回廊·战斗服务（第2.5块·块3步2，纯 TS，不依赖 cc）：GDD S10.7。
//
// 职责：把 Step1 的层作战计划（S7CorridorLayerPlan）+ 玩家阵容，跑成一场回廊战斗。
// 这是 Ron 2026-07-04 批准的**受控引擎入口**——用引擎新加的三个可选字段（内联敌阵/敌方积木/限时覆盖）
// 注入回廊敌方修正与动态敌阵；**并行加法**：不改 S7BattleRunService / S7BattleEncounterAssembler / 主线/悬赏路径，
// 只是「复用组装器建玩家单位 + 在引擎请求上叠加回廊三字段」。gate 零回归为机器验收。
//
// 敌阵来源：普通/戏法层=Step1 生成敌阵（plan.formation）；回响Boss层=复用主线 Boss 节点的 encounter→spawn 敌阵形状
//   + 轮次缩放积木（"复用Boss配置+倍率"）。我方回廊效果：乱流(playerBlocks) + 静默空域(禁核=strip coreId)。
// 上阵上限（精锐3/孤胆1）在此硬拦（UI 侧也应先拦，双保险）。不推进进度、不发奖——那些在控制器结算侧。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7BattleEncounterParam, S7BattleSpawnParam } from '../../config/s7/ConfigTypesS7';
import { S7BattleEntry } from './S7BattleEntry';
import { S7BattleEncounterAssembler, S7BattleLineupUnitInput } from './S7BattleEncounterAssembler';
import { S7AutoBattleEngine } from './S7AutoBattleEngine';
import { S7AutoBattleRunRequest, S7AutoBattleInlineEnemyInput } from './S7AutoBattleTypes';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { summarizeS7BattleLog } from './S7BattleLogSummary';
import { S7BattleRunResult } from './S7BattleRunService';
import { S7CorridorLayerPlan } from './S7DeepCorridor';

/** 组装器上下文/时基载体节点（仅借其 encounter 建玩家单位与上下文；敌人被内联敌阵覆盖，主线路径不动）。 */
export const CORRIDOR_BASE_CONTEXT_NODE = 'n001';
/** 回廊默认限时（非闪电战层·秒）。 */
export const CORRIDOR_DEFAULT_TIME_SEC = 120;

export interface S7CorridorBattleRequest {
  runtime: S7ConfigRuntime;
  /** 本层作战计划（Step1 corridorLayerPlan 产出）。 */
  plan: S7CorridorLayerPlan;
  /** 玩家出战阵容（已配好 core/pilot/plugin/等级 + 全队加成 extraBlocks；回廊效果在此服务内叠加）。 */
  lineup: S7BattleLineupUnitInput[];
  /** 运行种子（确定性：同层同种子逐字节一致）。 */
  runSeed: string | number;
  /** C14 硬控递减旋钮（段三真值翻开·同 S7BattleRunService 口径）：缺省缺席=行为不变。 */
  hardControlDiminish?: { factor: number; windowSec: number };
}

/** 上阵超上限（精锐/孤胆戏法层）——控制器捕获后提示玩家下阵多余星舰。 */
export class S7CorridorLineupCapError extends Error {
  constructor(public readonly cap: number, public readonly actual: number) {
    super(`本层限上阵 ${cap} 舰，实际 ${actual} 舰`);
    this.name = 'S7CorridorLineupCapError';
  }
}

/**
 * 回响Boss层敌阵：从 Boss 节点的 encounter→spawnPlanRefs→spawn 行展平成内联敌（复用Boss配置·纯读 config）。
 * 找不到 encounter / spawn 行 → 跳过（防御性返回已收集的）。
 */
export function bossNodeInlineEnemies(runtime: S7ConfigRuntime, bossNodeId: string): S7AutoBattleInlineEnemyInput[] {
  const enc = runtime.getAll<S7BattleEncounterParam>('battle_encounter_param').find((e) => e.nodeRef === bossNodeId);
  if (!enc) return [];
  const out: S7AutoBattleInlineEnemyInput[] = [];
  for (const ref of enc.spawnPlanRefs) {
    const sp = runtime.getById<S7BattleSpawnParam>('battle_spawn_param', ref);
    if (!sp) continue;
    for (const slot of sp.slotRefs) out.push({ unitStatRef: sp.unitStatRef, slotRef: slot });
  }
  return out;
}

/** 解出本层内联敌阵 + 敌方积木：普通/戏法=生成敌阵；回响Boss=复用Boss节点形状 + 轮次缩放积木。 */
export function corridorInlineEnemies(
  plan: S7CorridorLayerPlan, runtime: S7ConfigRuntime,
): { inlineEnemyUnits: S7AutoBattleInlineEnemyInput[]; enemyEffectBlocks: readonly S7EffectBlock[] } {
  if (plan.echoBoss) {
    return { inlineEnemyUnits: bossNodeInlineEnemies(runtime, plan.echoBoss.bossNodeId), enemyEffectBlocks: plan.echoBoss.enemyBlocks };
  }
  const f = plan.formation;
  if (!f) return { inlineEnemyUnits: [], enemyEffectBlocks: [] }; // 防御：普通/戏法层必有 formation
  return { inlineEnemyUnits: f.units.map((u) => ({ unitStatRef: u.unitStatRef, slotRef: u.slotRef })), enemyEffectBlocks: f.enemyBlocks };
}

/** 我方阵容注入回廊效果（纯函数）：乱流（playerBlocks 加到每舰 extraBlocks）+ 静默空域（禁核=清 coreId）。 */
export function applyCorridorLineupEffects(
  lineup: readonly S7BattleLineupUnitInput[], plan: S7CorridorLayerPlan,
): S7BattleLineupUnitInput[] {
  return lineup.map((u) => {
    const base: S7BattleLineupUnitInput = plan.disablePlayerCores ? { ...u, coreId: undefined } : { ...u };
    if (plan.playerBlocks.length === 0) return base;
    return { ...base, extraBlocks: [...(base.extraBlocks ?? []), ...plan.playerBlocks] };
  });
}

/**
 * 跑一层回廊战斗（纯 TS·无副作用·不推进进度/不发奖）。
 * 受控入口：复用组装器以 n001 为载体建玩家单位 + 基础 request，再叠加内联敌阵/敌方积木/限时三字段喂引擎。
 * 上阵超上限抛 S7CorridorLineupCapError。
 */
export function runCorridorBattle(req: S7CorridorBattleRequest): S7BattleRunResult {
  const { runtime, plan, lineup, runSeed } = req;
  if (lineup.length > plan.lineupCap) throw new S7CorridorLineupCapError(plan.lineupCap, lineup.length);

  const { inlineEnemyUnits, enemyEffectBlocks } = corridorInlineEnemies(plan, runtime);
  const effLineup = applyCorridorLineupEffects(lineup, plan);

  // 复用组装器建玩家单位 + 基础 encounter（n001·仅上下文/时基载体；敌人被内联覆盖，组装器/主线路径零改动）。
  const entry = S7BattleEntry.fromRuntime(runtime);
  const assembler = new S7BattleEncounterAssembler(runtime, entry);
  const assembled = assembler.assemble({
    progress: { currentNodeId: CORRIDOR_BASE_CONTEXT_NODE, clearedNodeIds: [] },
    runSeed,
    lineup: effLineup,
  });

  const timeLimit = plan.timeLimitSecOverride > 0 ? plan.timeLimitSecOverride : CORRIDOR_DEFAULT_TIME_SEC;
  const request: S7AutoBattleRunRequest = {
    ...assembled.request,
    inlineEnemyUnits,
    enemyEffectBlocks,
    timeLimitSecOverride: timeLimit,
    ...(req.hardControlDiminish ? { hardControlDiminish: req.hardControlDiminish } : {}),
  };
  const result = new S7AutoBattleEngine(runtime).run(request);
  return { context: assembled.context, request, trace: assembled.trace, result, summary: summarizeS7BattleLog(result) };
}
