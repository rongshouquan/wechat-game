// S7 默认 dry-run 出战阵容 helper（BATTLE-RT-07B-1，纯 TS，不依赖 cc）。
//
// 职责：提供 RT-07B 已冻结的“默认 dry-run 阵容”——三舰固定阵位：
//   shp01 -> p0c2 / shp02 -> p1c2 / shp03 -> p2c2。
// 这是用于本地 dry-run（喂给 S7BattleEncounterAssembler / S7BattleRunService 跑 n001/n018/n075）
// 的最小可执行默认阵容，便于在没有玩家正式阵容真源时仍能跑通战斗链路并被测试覆盖。
//
// 明确不是什么（严格边界，依 RT-07B 冻结口径）：
// - 不是“玩家正式拥有阵容”，不是“最终 5 舰默认阵容”——只是首个可执行三舰 dry-run 口径。
// - 不写存档：不读写 S7SaveService / SaveService / 玩家态，不复用旧英雄阵容 / 旧编队。
// - 不接 UI / Cocos 场景，不接结算 / 奖励 / 主线推进 / 服务器，不 import cc。
// - 不生成 runSeed：runSeed 必须由调用方显式传入；本 helper 只给阵容，不掺随机数 / 当前时间。
//
// 提供：
// - S7_DEFAULT_DRY_RUN_LINEUP：只读冻结常量（顺序固定，运行时不可变）。
// - createS7DefaultDryRunLineup()：返回全新可变副本，调用方修改返回数组 / 元素都不会污染下一次调用。

import { S7BattleLineupUnitInput } from './S7BattleEncounterAssembler';

/**
 * RT-07B 冻结的默认 dry-run 阵容（只读、运行时冻结）。
 * 顺序与阵位严格固定：shp01/p0c2 -> shp02/p1c2 -> shp03/p2c2。
 * 仅供 dry-run / 测试使用，不是玩家正式阵容；需要可变阵容请用 createS7DefaultDryRunLineup()。
 */
export const S7_DEFAULT_DRY_RUN_LINEUP: readonly Readonly<S7BattleLineupUnitInput>[] = Object.freeze([
  Object.freeze({ shipId: 'shp01', slotRef: 'p0c2' }),
  Object.freeze({ shipId: 'shp02', slotRef: 'p1c2' }),
  Object.freeze({ shipId: 'shp03', slotRef: 'p2c2' }),
]);

/**
 * 返回默认 dry-run 阵容的全新副本（fresh copy）。
 * 每次调用都重建数组与元素对象：调用方修改返回值不会影响冻结常量，也不会污染后续调用。
 */
export function createS7DefaultDryRunLineup(): S7BattleLineupUnitInput[] {
  return S7_DEFAULT_DRY_RUN_LINEUP.map((unit) => ({ shipId: unit.shipId, slotRef: unit.slotRef }));
}
