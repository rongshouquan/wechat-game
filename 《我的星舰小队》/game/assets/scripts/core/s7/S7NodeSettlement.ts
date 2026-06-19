// S7 节点结算（C1b-step1，纯 TS，不依赖 cc）：把"通关一个主线节点"落成「发软货币 + 推进主线」。
//
// 节点→奖励链路：mainline_node_config[nodeId].rewardAnchorRef
//   → reward_pool_ref_config[anchor].rewardParamRef[] → reward_param[row].resources。
// 首通限定（v1.0 §8「重复挑战不刷资源」）：靠 completeS7Node 的顺序校验天然实现——
//   非当前待通节点（已通关 / 越级）返回错误、不发奖、不推进，零额外判重。
//
// ⚠️ 最小循环简化（占位，随奖励系统正式接入再细化，见 README 遗留）：
//   ① 池含多个 rewardParamRef 时只取第一个（精确"按节点选包"留后）；
//   ② 资源量取配置 min 作保底发放量（[min,max] 掷骰留第二块）；
//   ③ 只发 resources 软货币——三选一稀缺道具(goodItemTag)/宝箱/信标档 不在本步。
//
// 边界：core 层自包含——只依赖 config(S7ConfigRuntime/类型) + 同族 S7MainlineProgress；
//   不 import save（不绑 S7PlayerState/S7ResourceState 具体类型，资源以 Record<string,number> 传入），
//   不 import cc。可在 Node/Vitest 单测。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import {
  S7MainlineNodeConfig,
  S7RewardPoolRefConfig,
  S7RewardParam,
} from '../../config/s7/ConfigTypesS7';
import {
  S7MainlineModel,
  S7MainlineProgressState,
  S7CompleteNodeError,
  completeS7Node,
} from './S7MainlineProgress';

/** 一笔资源发放：货币键 + 数量（正整数）。 */
export interface S7ResourceGrant {
  resourceId: string;
  amount: number;
}

/**
 * 解析某节点首通应发的软货币（纯函数，只读配置）：
 * 节点→rewardAnchorRef→reward_pool_ref→首个 rewardParamRef→reward_param.resources（取 min、滤掉 ≤0）。
 * 找不到链路任一环 / 无正向资源 → 返回空数组（不报错，调用方按"无奖励"处理）。
 */
export function resolveNodeRewardGrants(runtime: S7ConfigRuntime, nodeId: string): S7ResourceGrant[] {
  const node = runtime.getById<S7MainlineNodeConfig>('mainline_node_config', nodeId);
  if (!node || typeof node.rewardAnchorRef !== 'string') return [];
  const pool = runtime.getById<S7RewardPoolRefConfig>('reward_pool_ref_config', node.rewardAnchorRef);
  if (!pool || !Array.isArray(pool.rewardParamRef) || pool.rewardParamRef.length === 0) return [];
  const paramRow = runtime.getById<S7RewardParam>('reward_param', pool.rewardParamRef[0]); // 简化①：取第一个
  if (!paramRow || !Array.isArray(paramRow.resources)) return [];
  const grants: S7ResourceGrant[] = [];
  for (const r of paramRow.resources) {
    if (!r || typeof r.resourceId !== 'string') continue;
    const amt = typeof r.min === 'number' && Number.isFinite(r.min) ? r.min : 0; // 简化②：取 min 作保底
    if (amt > 0) grants.push({ resourceId: r.resourceId, amount: amt });
  }
  return grants;
}

/**
 * 把一组发放就地加进资源账本（只加账本里已有的键——未知键跳过，防脏 resourceId 污染钱包）。
 * resources 用通用 Record（实际传 S7PlayerState.resources），保持 core 与 save 解耦。
 */
export function applyResourceGrants(resources: Record<string, number>, grants: S7ResourceGrant[]): void {
  for (const g of grants) {
    if (!g || typeof g.resourceId !== 'string') continue;
    if (!Object.prototype.hasOwnProperty.call(resources, g.resourceId)) continue;
    if (typeof g.amount === 'number' && Number.isFinite(g.amount) && g.amount > 0) {
      resources[g.resourceId] += g.amount;
    }
  }
}

export type S7NodeSettlementResult =
  | {
      ok: true;
      /** 本次首通应发的软货币（调用方用 applyResourceGrants 入账）。 */
      grants: S7ResourceGrant[];
      /** 推进后的主线进度（调用方写回 playerState.mainlineProgress + 落盘）。 */
      nextProgress: S7MainlineProgressState;
      completedNodeId: string;
      nextNodeId: string;
      /** 是否已完成最终节点。 */
      finished: boolean;
    }
  | { ok: false; error: S7CompleteNodeError };

/**
 * 结算一次"节点首通胜利"：先按主线顺序校验推进（completeS7Node），
 * 通过才解析奖励——故重复挑战（已通关/越级）天然 ok:false、不发奖不推进。
 * 纯函数：不修改入参、不写资源、不落盘；调用方据返回 applyResourceGrants + 写回进度 + persist。
 * 注意：本函数只在"战斗已判胜"后调用；战斗胜负由 S7BattleRunService.summary.winner 决定，不在此判。
 */
export function settleS7NodeVictory(
  model: S7MainlineModel,
  progress: S7MainlineProgressState,
  runtime: S7ConfigRuntime,
  nodeId: string,
): S7NodeSettlementResult {
  const complete = completeS7Node(model, progress, nodeId);
  if (!complete.ok) return { ok: false, error: complete.error };
  return {
    ok: true,
    grants: resolveNodeRewardGrants(runtime, nodeId),
    nextProgress: complete.state,
    completedNodeId: complete.completedNodeId,
    nextNodeId: complete.nextNodeId,
    finished: complete.finished,
  };
}
