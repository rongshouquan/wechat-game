// S7 战斗输入快照 -> 运行壳请求适配器（BATTLE-RT-07E-2-1，纯 TS，不依赖 cc）。
//
// 职责：把一份“已校验合法”的 S7BattleInputSnapshot 安全投影成 S7BattleRunService 当前需要的
// S7BattleRunRequest。只生成请求，不调用运行壳、不跑战斗。
//
// 内部顺序固定：
//   1. validateS7BattleInputSnapshot(snapshot, runtime)：非法直接返回 invalid_snapshot（保留 validation，不抛错）。
//   2. 校验 snapshot.nodeId === progress.currentNodeId：不一致返回 node_progress_mismatch（不改写 progress）。
//   3. 一致时投影：runtime / progress 原引用透传，runSeed = snapshot.runSeed，
//      lineup = 每个单位的稳定 { shipId, slotRef }。
//
// 严格边界（依 RT-07E-2-1 任务包）：
// - adapter 不 new S7BattleRunService、不调用 run()、不跑 S7AutoBattleEngine。
// - 不接 UI / 战报 / 胜负弹窗，不结算 / 不发奖励 / 不应用 rewardAnchorRef，不推进主线 / 不调 completeS7Node，
//   不读写存档 / 玩家态 / 编队，不接服务器 / 微信云 / 联网 / 账号 / 设备标识 / 排行榜 / 好友 / 公会 / 支付 / 充值。
// - 不把驾驶员 / 插件 / 星核 / 等级 / 强化转成战斗属性：这些字段只在快照校验阶段被检查，
//   不进入 lineup（运行壳当前只消费稳定 shipId + slotRef）。
// - 不生成生产 runSeed：runSeed 直接取调用方快照里的显式值，不使用时间 / 随机 / 账号 / 设备。
// - 未来在线化不堵死：稳定 ID、显式 seed、可复现、可在 Node/Vitest 本地测试。

import {
  validateS7BattleInputSnapshot,
  S7BattleInputSnapshot,
  S7BattleInputSnapshotValidation,
} from './S7BattleInputSnapshot';
import type { S7BattleRunRequest } from './S7BattleRunService';
import type { S7MainlineProgressState } from './S7MainlineProgress';
import type { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';

/** 适配器输入：只读配置运行时 + 只读主线进度 + 待投影的输入快照。 */
export interface S7BattleInputRunRequestAdapterInput {
  runtime: S7ConfigRuntime;
  progress: S7MainlineProgressState;
  snapshot: S7BattleInputSnapshot;
}

/**
 * 适配结果（union，不以抛错作为常规结果）：
 * - ok:true 携带可直接交给 S7BattleRunService.run() 的 request。
 * - invalid_snapshot：快照校验未通过，原样保留 validation 供调用方定位。
 * - node_progress_mismatch：快照节点与当前待战节点不一致，回带两侧 nodeId。
 */
export type S7BattleInputRunRequestResult =
  | { ok: true; request: S7BattleRunRequest }
  | { ok: false; code: 'invalid_snapshot'; validation: S7BattleInputSnapshotValidation }
  | { ok: false; code: 'node_progress_mismatch'; snapshotNodeId: string; progressNodeId: string };

/**
 * 把合法输入快照投影为运行壳请求。无副作用：不修改 snapshot / progress / runtime，
 * 不调用运行壳，不跑战斗。失败按 union 返回可预期结果，不抛错。
 */
export function buildS7BattleRunRequestFromInputSnapshot(
  input: S7BattleInputRunRequestAdapterInput,
): S7BattleInputRunRequestResult {
  const { runtime, progress, snapshot } = input;

  // 1. 契约校验（含 runtime 引用校验）；非法直接返回，不投影、不抛错。
  const validation = validateS7BattleInputSnapshot(snapshot, runtime);
  if (!validation.ok) {
    return { ok: false, code: 'invalid_snapshot', validation };
  }

  // 2. 节点一致性：snapshot.nodeId 必须等于当前待战节点；不一致返回，不改写 progress。
  if (snapshot.nodeId !== progress.currentNodeId) {
    return {
      ok: false,
      code: 'node_progress_mismatch',
      snapshotNodeId: snapshot.nodeId,
      progressNodeId: progress.currentNodeId,
    };
  }

  // 3. 投影：runtime / progress 原引用透传；runSeed 取快照显式值；
  //    lineup 仅取每个单位的稳定 shipId + slotRef（其余装配 / 培养字段不转战斗属性）。
  const request: S7BattleRunRequest = {
    runtime,
    progress,
    runSeed: snapshot.runSeed,
    lineup: snapshot.units.map(({ shipId, slotRef }) => ({ shipId, slotRef })),
  };
  return { ok: true, request };
}
