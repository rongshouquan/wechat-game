// 活动配置（阶段一 G-step1，纯 TS，不依赖 cc）：v1.0 §10.5「3 天行动 / 7 天扩张（不做每日任务）」。
//
// ⚠️ 全表 v0.1 占位（Ron 授权 Claude 定灰盒占位·第二块「活动里程碑/奖励/进度权重」统一校准）：
//   - 进度靠玩家正常游玩自然累积（推关/打捞/抽卡 → 各给 progressWeights 配的进度点·§10.5「不做每日任务」）。
//   - 里程碑(过程奖励) + 完成(完成奖励) + 结算(宝藏·走 settlementChestType)。
//   - 3 天行动：过程偏 信标/补给券/通用碎片；完成=星辉货舱；结算=行动宝藏(§10.5)。
//   - 7 天扩张：过程=基础资源/居民/工人/稀有信标/通用碎片；完成=史诗信标/星核碎片；结算=扩张宝藏(§10.5)。
//   - 阈值/奖励量/进度权重全占位·刻意好测好演示·第二块校准。
//   - 资源键沿用钱包既有键；宝箱键对齐 S7ChestType；人口=居民/工人(§10.5 7天给人口·与 K 块「人口来源」重叠的那部分)。

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

// ===== 默认配置（v0.1 占位探针·阈值刻意调小便于灰盒演示·第二块校准）=====

const RES = (resourceId: string, amount: number): S7ActivityReward => ({ kind: 'resource', resourceId, amount });
const CHEST = (chestId: S7ChestType, amount: number): S7ActivityReward => ({ kind: 'chest', chestId, amount });
const POP = (pop: 'resident' | 'worker', amount: number): S7ActivityReward => ({ kind: 'population', pop, amount });

export const DEFAULT_S7_ACTIVITY_CONFIG: S7ActivityConfig = {
  activities: {
    // 3 天行动（短周期）：过程偏 信标/补给券/通用碎片；完成=星辉货舱；结算=行动宝藏。
    action3: {
      progressWeights: { node_clear: 10, salvage_collect: 8, gacha_draw: 5 },
      milestones: [
        { id: 'a3_m1', threshold: 30, rewards: [RES('beaconCommon', 1), RES('supplyTicket', 3)] },
        { id: 'a3_m2', threshold: 60, rewards: [RES('shipBlueprint', 5), RES('pilotShardUniversal', 5)] },
        { id: 'a3_m3', threshold: 100, rewards: [RES('supplyTicket', 5), RES('beaconRare', 1)] },
      ],
      completion: { threshold: 150, rewards: [CHEST('starlightCargo', 1)] }, // 完成=星辉货舱
    },
    // 7 天扩张（中周期）：过程=基础资源/居民/工人/稀有信标/通用碎片；完成=史诗信标/星核碎片；结算=扩张宝藏。
    expansion7: {
      progressWeights: { node_clear: 10, salvage_collect: 8, gacha_draw: 5 },
      milestones: [
        { id: 'e7_m1', threshold: 60, rewards: [RES('starOre', 800), RES('beaconRare', 1)] },
        { id: 'e7_m2', threshold: 150, rewards: [RES('shipBlueprint', 10), RES('pilotShardUniversal', 10)] },
        { id: 'e7_m3', threshold: 260, rewards: [POP('resident', 1), POP('worker', 1)] }, // §10.5 7天给人口
      ],
      completion: { threshold: 380, rewards: [RES('beaconEpic', 1), RES('coreFrag', 20)] }, // 完成=史诗信标+星核碎片
    },
  },
};
