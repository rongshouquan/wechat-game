// 活动配置（步5 收尾批回写·纯 TS，不依赖 cc）：S10.5「3 天行动 / 7 天扩张（不做每日任务）」三层两笔分账。
// 数值终值 = 初值表 v0.7 §6 events（机器真源 PARAMS.events·照抄不调数）：
//   - **三层两笔（§9#3 老冲突修正·本批修代码）**：过程里程碑（周期量平摊三档）→ **完成奖**（7天=史诗信标1+星核碎片6·
//     周期末一笔）→ **结算奖**（走 settlementChestType：3天=行动宝藏三选一、7天=扩张宝藏**完整星核**——另一笔）。
//   - 3 天行动周期量：补给券14/普通信标2/稀有信标2/通用碎片8/星矿400；完成=星辉货舱1；结算=行动宝藏。
//   - 7 天扩张周期量：补给券24/普通信标2/稀有信标3/通用碎片16/星矿900/居民1/工人1；完成=史诗信标1+核碎6；结算=扩张宝藏(星核)。
//   - 进度靠玩家正常游玩自然累积（推关/打捞/抽卡 → progressWeights·§10.5「不做每日任务」）。
//   - ⚠️ 里程碑阈值/进度权重＝灰盒占位保留（尺子按"事件完成率"画像参数建模、无逐点阈值真值——
//     阈值量级挂灰盒批真机校：目标=正常游玩完成率对齐画像 0.92-1.0/0.88-0.95）。
//   - 资源键沿用钱包既有键；宝箱键对齐 S7ChestType；人口=居民/工人(§10.5 7天给人口)。

import { S7ActivityType } from './S7ActivityProgress';
import { S7ChestType } from './S7ChestInventory';

/** 一笔活动奖励（应用侧入账：resource→钱包·chest→宝箱库·population→居民/工人）。 */
export type S7ActivityReward =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'chest'; chestId: S7ChestType; amount: number }
  | { kind: 'population'; pop: 'resident' | 'worker'; amount: number };

/** 一个过程里程碑：到 threshold 进度可领 rewards。 */
export interface S7ActivityMilestone {
  id: string;
  threshold: number;
  rewards: S7ActivityReward[];
}

/** 一种活动的配置。 */
export interface S7ActivityDef {
  /** 过程里程碑（阈值升序·id 唯一）。 */
  milestones: S7ActivityMilestone[];
  /** 完成奖励（到 threshold 可领一次）。 */
  completion: { threshold: number; rewards: S7ActivityReward[] };
  /** 玩家行为 → 进度点（推关/打捞/抽卡…·未列出的行为不计进度）。 */
  progressWeights: Record<string, number>;
}

export interface S7ActivityConfig {
  activities: Record<S7ActivityType, S7ActivityDef>;
}

/** 进度行为键（喂入点用·控制器在对应时机调 addActivityProgress(权重)）。 */
export const S7_ACTIVITY_ACTIONS = {
  nodeClear: 'node_clear',   // 推关首通胜利
  salvage: 'salvage_collect', // 打捞收菜
  gacha: 'gacha_draw',       // 抽卡（每抽）
} as const;

// ===== 默认配置（v0.7 校准终值·周期量平摊三档里程碑；阈值/权重=灰盒占位保留）=====

const RES = (resourceId: string, amount: number): S7ActivityReward => ({ kind: 'resource', resourceId, amount });
const CHEST = (chestId: S7ChestType, amount: number): S7ActivityReward => ({ kind: 'chest', chestId, amount });
const POP = (pop: 'resident' | 'worker', amount: number): S7ActivityReward => ({ kind: 'population', pop, amount });

/** 教程首事件加码：首个 3 天行动结算额外给起手舰专属碎片（PARAMS.tutorialGrant.firstEventMainShard·
 *  GDD-M"S 阶承诺"经济面·应用侧在首次 action3 结算时一并入账）。 */
export const FIRST_EVENT_MAIN_SHARD_BONUS = 60;
export const FIRST_EVENT_MAIN_SHARD_SHIP_ID = 'shp01';

export const DEFAULT_S7_ACTIVITY_CONFIG: S7ActivityConfig = {
  activities: {
    // 3 天行动（短周期·周期量：券14/普标2/稀标2/通碎8/星矿400）：完成=星辉货舱；结算=行动宝藏三选一。
    action3: {
      progressWeights: { node_clear: 10, salvage_collect: 8, gacha_draw: 5 },
      milestones: [
        { id: 'a3_m1', threshold: 30, rewards: [RES('supplyTicket', 5), RES('beaconCommon', 1), RES('starOre', 130)] },
        { id: 'a3_m2', threshold: 60, rewards: [RES('shipBlueprint', 4), RES('pilotShardUniversal', 4), RES('beaconRare', 1), RES('starOre', 130)] },
        { id: 'a3_m3', threshold: 100, rewards: [RES('supplyTicket', 9), RES('beaconCommon', 1), RES('beaconRare', 1), RES('starOre', 140)] },
      ],
      completion: { threshold: 150, rewards: [CHEST('starlightCargo', 1)] }, // 完成=星辉货舱
    },
    // 7 天扩张（中周期·周期量：券24/普标2/稀标3/通碎16/星矿900/居民1/工人1）：完成=史诗信标+核碎6；结算=扩张宝藏(完整星核)。
    expansion7: {
      progressWeights: { node_clear: 10, salvage_collect: 8, gacha_draw: 5 },
      milestones: [
        { id: 'e7_m1', threshold: 60, rewards: [RES('supplyTicket', 8), RES('starOre', 300), RES('beaconCommon', 2), RES('beaconRare', 1)] },
        { id: 'e7_m2', threshold: 150, rewards: [RES('shipBlueprint', 8), RES('pilotShardUniversal', 8), RES('starOre', 300), RES('beaconRare', 1)] },
        { id: 'e7_m3', threshold: 260, rewards: [RES('supplyTicket', 16), RES('starOre', 300), RES('beaconRare', 1), POP('resident', 1), POP('worker', 1)] }, // §10.5 7天给人口
      ],
      // 完成奖（两笔分账第一笔·v0.7 completion7）：史诗信标 1 + 星核碎片 6（B4 稀缺线终值·§10㉒"8"已被 B4 更新）。
      completion: { threshold: 380, rewards: [RES('beaconEpic', 1), RES('coreFrag', 6)] },
    },
  },
};
