// S7 专用纯 TS 战斗 dry-run 运行壳（BATTLE-RT-07A，不依赖 cc）。
//
// 职责：把已完成的 S7 实时战斗四层链路串成一次无副作用的本地 dry-run：
//   S7BattleEntry -> S7BattleEncounterAssembler -> S7AutoBattleEngine -> summarizeS7BattleLog
// 给定显式输入（runtime / progress / runSeed / lineup），跑出一次战斗的
//   context（节点战斗上下文）/ request（引擎请求）/ trace（本地战报锚点）/
//   result（战斗结果与日志）/ summary（轻量胜负与双方输出统计），
// 但只“跑出结果”，不应用结果。
//
// 严格边界（依 RT-07A 任务包）：
// - 只编排既有四层，不重写各层语义；不接 UI / Cocos 场景，不 import cc。
// - 不写 S7SaveService / SaveService / 玩家态，不调用主线推进，不发奖励、不结算、不改资源。
// - 不复用流程版 BattleLaunchService / 流程版战斗引擎 / 流程版回放服务。
// - 不接真实服务器 / 微信云 / 支付 / 排行榜 / 好友 / 公会 / 账号体系 / 充值。
// - battleSeed 由调用方显式 runSeed 与 nodeId 组合（见 RT-05 组装器），
//   不使用随机数、不使用当前时间、不使用设备 / 账号标识；同输入完全可复现。
// - 不吞错误：context / 组装 / 引擎 的错误按各层既有类型自然抛出，不转 UI 文案。
// - 不修改任何入参对象（runtime 配置行 / progress / lineup / runSeed）。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7MainlineProgressState } from './S7MainlineProgress';
import { S7BattleEntry, S7BattleContext } from './S7BattleEntry';
import {
  S7BattleEncounterAssembler,
  S7BattleLineupUnitInput,
  S7BattleRunTrace,
} from './S7BattleEncounterAssembler';
import { S7AutoBattleEngine } from './S7AutoBattleEngine';
import { S7AutoBattleRunRequest, S7AutoBattleResult } from './S7AutoBattleTypes';
import { summarizeS7BattleLog, S7BattleLogSummaryResult } from './S7BattleLogSummary';

/** dry-run 运行壳输入：显式 runtime + 只读进度 + 运行种子 + 玩家阵容（稳定 shipId）。 */
export interface S7BattleRunRequest {
  /** 已加载的 S7 只读配置运行时。 */
  runtime: S7ConfigRuntime;
  /** 只读主线进度（决定当前战斗节点）；本层不推进、不写回。 */
  progress: S7MainlineProgressState;
  /** 调用方显式传入的运行种子；与 nodeId 组合成 battleSeed，禁止由随机/时间生成。 */
  runSeed: string | number;
  /** 玩家出战阵容（稳定 shipId + 玩家 3x3 锚点格）。 */
  lineup: S7BattleLineupUnitInput[];
  /** C14 硬控递减旋钮（机制批③段三真值翻开）：真机三入口与模拟器统一传 S7_HARD_CONTROL_DIMINISH；
   *  缺省缺席=引擎行为不变（既有测试零重定基·旋钮通道铁律）。 */
  hardControlDiminish?: { factor: number; windowSec: number };
}

/**
 * dry-run 运行壳产物：四层链路逐级输出的聚合。
 * - context：S7BattleEntry 解析出的只读节点战斗上下文。
 * - request：S7BattleEncounterAssembler 组装、可直接喂引擎的请求（不含 trace）。
 * - trace：本地战报锚点（uploadRequired=false，不上传、不写存档）。
 * - result：S7AutoBattleEngine 跑出的战斗结果与完整事件日志。
 * - summary：summarizeS7BattleLog 推导的轻量胜负提示与双方输出统计。
 */
export interface S7BattleRunResult {
  context: S7BattleContext;
  request: S7AutoBattleRunRequest;
  trace: S7BattleRunTrace;
  result: S7AutoBattleResult;
  summary: S7BattleLogSummaryResult;
}

/**
 * S7 战斗 dry-run 运行壳。无状态：每次 run 只读入参、不缓存、不写回。
 * 固定内部顺序：entry 解析 context -> 组装器产出 request/trace ->
 * 引擎跑 result -> 摘要生成 summary。任一层出错按其原始类型抛出，不吞错。
 */
export class S7BattleRunService {
  /** 跑一次本地 dry-run，返回 context/request/trace/result/summary；不改入参、不产生副作用。 */
  run(request: S7BattleRunRequest): S7BattleRunResult {
    const { runtime, progress, runSeed, lineup } = request;

    // 1 + 2：用 S7BattleEntry 解析当前节点 context，并交给组装器产出引擎 request 与本地 trace。
    const entry = S7BattleEntry.fromRuntime(runtime);
    const assembler = new S7BattleEncounterAssembler(runtime, entry);
    const assembled = assembler.assemble({ progress, runSeed, lineup });
    if (request.hardControlDiminish) assembled.request.hardControlDiminish = request.hardControlDiminish;

    // 3：用 S7AutoBattleEngine 跑出结果（battleSeed 已由组装器按 nodeId + runSeed 固定，可复现）。
    const result = new S7AutoBattleEngine(runtime).run(assembled.request);

    // 4：用 summarizeS7BattleLog 生成轻量摘要（只读 result，不再读配置、不触网）。
    const summary = summarizeS7BattleLog(result);

    return {
      context: assembled.context,
      request: assembled.request,
      trace: assembled.trace,
      result,
      summary,
    };
  }
}
