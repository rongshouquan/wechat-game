// 离线收益编排（C·养成接入 step1，纯 TS，不依赖 cc）：把"玩家存档状态 + 上次在线时间 + 当前时间"
//   组装成离线产出的入参，调用现成纯函数 S7OfflineProduction.computeOfflineGains 算出这次离开攒了多少软货币。
//
// 职责（薄编排，无新数值）：
//   - 离线秒数 = max(0, (now - lastOnlineTime)/1000)，边界(负/非有限)归 0。
//   - 居住舱等级 ← buildings（未解锁=0→无离线）；星域系数档 ← model.clearedStarfieldTier(已通关节点)；
//     居民加成/存储延长 ← population（默认 0 人 → 无额外）。
//   - 产币与上限/封顶逻辑全在 computeOfflineGains 内（本层不重写数值）。
// 边界：core 层自包含——只依赖 config 无关的同族 S7* 模块 + 中性结构；不 import save（resources 以 Record 传入）、不 import cc。
//   数值真源 B1/v1.0，离线数值 v0.1 待第二块校准。

import { S7MainlineModel, S7MainlineProgressState } from './S7MainlineProgress';
import { S7BuildingState, getBuildingLevel } from './S7BuildingState';
import { S7PopulationState } from './S7Population';
import { residentRateBonusPct, residentStorageExtensionHours } from './S7Population';
import { habitatStaffCap } from './S7BuildingEffects';
import {
  computeOfflineGains,
  S7OfflineResult,
  S7OfflineResourceKey,
} from './S7OfflineProduction';

/** 居住舱建筑 id（须与 building_config 一致：决定离线存储上限 + 自带产率加成）。 */
export const S7_HABITAT_BUILDING_ID = 'bld_habitat';

const MS_PER_SEC = 1000;

export interface S7OfflineSettlement extends S7OfflineResult {
  /** 实际离线秒数（未被上限截断的原始值，便于展示"离线了多久"）。 */
  elapsedSeconds: number;
  /** 是否有正向进账（任一币种 > 0），调用方据此决定要不要弹"领取"。 */
  hasGains: boolean;
}

/**
 * 算这次"离线/离开"应得的软货币（纯函数，不改入参、不落盘）。
 * 调用方拿到后用 applyOfflineGains 入账，并把 lastOnlineTime 刷成 now 再落盘（关闭本次离线窗口）。
 */
export function computeS7OfflineSettlement(
  model: S7MainlineModel,
  buildings: S7BuildingState,
  population: S7PopulationState,
  progress: S7MainlineProgressState,
  lastOnlineTime: number,
  now: number,
): S7OfflineSettlement {
  const elapsedSeconds =
    Number.isFinite(now) && Number.isFinite(lastOnlineTime) && now > lastOnlineTime
      ? (now - lastOnlineTime) / MS_PER_SEC
      : 0;

  const habitatLevel = getBuildingLevel(buildings, S7_HABITAT_BUILDING_ID);
  const staffCap = habitatStaffCap(habitatLevel); // 有效编制（细案③：超编居民纯人气不加成）
  const result = computeOfflineGains(elapsedSeconds, {
    habitatLevel,
    clearedStarfieldTier: model.clearedStarfieldTier(progress.clearedNodeIds),
    extraRateBonusPct: residentRateBonusPct(population.residents, staffCap),
    extraStorageHours: residentStorageExtensionHours(population.residents, staffCap),
  });

  const hasGains = (Object.keys(result.gains) as S7OfflineResourceKey[]).some((k) => result.gains[k] > 0);
  return { ...result, elapsedSeconds, hasGains };
}

/**
 * 把离线进账就地加进资源账本（只加账本里已有的键——未知键跳过，防脏键污染钱包；与 S7NodeSettlement.applyResourceGrants 同口径）。
 */
export function applyOfflineGains(resources: Record<string, number>, gains: Record<S7OfflineResourceKey, number>): void {
  for (const key of Object.keys(gains) as S7OfflineResourceKey[]) {
    const amt = gains[key];
    if (!Object.prototype.hasOwnProperty.call(resources, key)) continue;
    if (typeof amt === 'number' && Number.isFinite(amt) && amt > 0) resources[key] += amt;
  }
}
