// S7 节点结算（步5 收尾批回写·纯 TS，不依赖 cc）：把"通关一个主线节点"落成「发软货币 + 推进主线」。
//
// 首通固定三件套（初值表 v0.7 §6 主线首通·机器真源 PARAMS.mainline）：
//   合金/驾驶记录/星贝 = 基值(55/36/24) × 档位倍率(普通1/精英1.6/Boss2.6/剧情首Boss2.0) × 星域系数(关所在星域)。
//   公式驱动：档位=节点行 nodeTypeTag、星域=节点行 starfieldId、剧情首Boss=rewardAnchorRef 'reward_first_boss'
//   （数据仍来自 mainline_node_config·旧 reward_pool_ref→reward_param 主线包链路退役=占位分辨率不够 sf×档位）。
// 教程期定向投放（PARAMS.tutorialGrant·GDD-M"首Boss前刚好养出 1 艘 S 阶"）：
//   n001-n030 每关首通 +13 起手舰专属碎片（人人相同·经济尺同口径）。
// 首通限定（v1.0 §8「重复挑战不刷资源」）：靠 completeS7Node 的顺序校验天然实现——
//   非当前待通节点（已通关 / 越级）返回错误、不发奖、不推进，零额外判重。
//
// 边界：core 层自包含——只依赖 config(S7ConfigRuntime/类型) + 同族 S7MainlineProgress；
//   不 import save（不绑 S7PlayerState/S7ResourceState 具体类型，资源以 Record<string,number> 传入），
//   不 import cc。可在 Node/Vitest 单测。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7MainlineNodeConfig } from '../../config/s7/ConfigTypesS7';
import { STARFIELD_COEF_TABLE } from './S7OfflineProduction';
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

// ===== 首通固定三件套（v0.7 校准终值·照抄不调数）=====
/** 固定软货币基值（×档位倍率×星域系数）。 */
export const MAINLINE_FIXED_BASE = { hullAlloy: 55, pilotToken: 36, starCargo: 24 } as const;
/** 档位倍率（剧情首Boss n030=2.0·高潮点非墙）。 */
export const MAINLINE_STAGE_MULT = { normal: 1, elite: 1.6, boss: 2.6, storyBoss: 2.0 } as const;
/** 剧情首Boss 的奖励锚 id（数据驱动标记·firstBossNodeId 同源）。 */
export const FIRST_BOSS_REWARD_ANCHOR = 'reward_first_boss';
/** 教程期定向投放：n001-首Boss 每关首通给起手舰专属碎片（GDD-M S 阶承诺的经济面）。
 *  450 关新世界首Boss=n054（旧 n030）·与经济尺 PARAMS.tutorialGrant.untilNode=54 对表。 */
export const TUTORIAL_GRANT_MAIN_SHARD_PER_NODE = 13;
export const TUTORIAL_GRANT_UNTIL_NODE = 54;
export const TUTORIAL_GRANT_SHIP_ID = 'shp01';

/** 节点 → 固定奖励档（nodeTypeTag 非 elite/boss 的一律 normal·与经济尺 nodeStage 同口径）。 */
function fixedStageOf(node: S7MainlineNodeConfig): keyof typeof MAINLINE_STAGE_MULT {
  if (node.rewardAnchorRef === FIRST_BOSS_REWARD_ANCHOR) return 'storyBoss';
  if (node.nodeTypeTag === 'boss') return 'boss';
  if (node.nodeTypeTag === 'elite') return 'elite';
  return 'normal';
}

/** 节点所在星域序号（sf01→1…sf06→6；解析失败→1）。 */
function starfieldIndexOf(node: S7MainlineNodeConfig): number {
  const m = /^sf0*(\d+)$/.exec(node.starfieldId ?? '');
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= STARFIELD_COEF_TABLE.length ? n : 1;
}

/**
 * 解析某节点首通应发的软货币（纯函数，只读配置）：
 * 固定三件套 = 基值 × 档位倍率 × 星域系数（四舍五入）；找不到节点行 → 空数组。
 */
export function resolveNodeRewardGrants(runtime: S7ConfigRuntime, nodeId: string): S7ResourceGrant[] {
  const node = runtime.getById<S7MainlineNodeConfig>('mainline_node_config', nodeId);
  if (!node) return [];
  const coef = STARFIELD_COEF_TABLE[starfieldIndexOf(node) - 1] ?? 1;
  const mult = MAINLINE_STAGE_MULT[fixedStageOf(node)] * coef;
  const grants: S7ResourceGrant[] = [
    { resourceId: 'hullAlloy', amount: Math.round(MAINLINE_FIXED_BASE.hullAlloy * mult) },
    { resourceId: 'pilotToken', amount: Math.round(MAINLINE_FIXED_BASE.pilotToken * mult) },
    { resourceId: 'starCargo', amount: Math.round(MAINLINE_FIXED_BASE.starCargo * mult) },
  ];
  return grants;
}

/** 教程期定向投放（n001-n030）：该节点首通应给的起手舰专属碎片数（不在窗口=0）。
 *  调用方（应用侧）领奖时经 addExclusiveShards(TUTORIAL_GRANT_SHIP_ID, 数量) 入账。 */
export function tutorialMainShardGrant(nodeId: string): number {
  const m = /^n0*(\d+)$/.exec(nodeId ?? '');
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= TUTORIAL_GRANT_UNTIL_NODE ? TUTORIAL_GRANT_MAIN_SHARD_PER_NODE : 0;
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
