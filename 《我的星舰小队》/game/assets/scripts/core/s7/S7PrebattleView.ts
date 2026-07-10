// 战前备战 数据层（阶段一 A-step2a，纯 TS，不依赖 cc）：v1.0 §4.4「战前界面：敌情预览(类型/数量/位置/有无Boss)」+ §6「统一战力值」。
//
// 职责：把"当前主线节点 + 玩家编队"如实组装成战前备战界面要显示的只读数据：
//   ① 敌情预览：当前节点遭遇的敌人列表（unitStatRef + 站位 slotRef + 是否Boss），如实读 encounter→spawn 配置，不脑补。
//   ② 推荐战力：取该节点的压力值（v1.0 §8 以 pressure 衡量难度；boss 取 recommend，普通/精英取 min/max 中值）。
//   ③ 我方战力：编队各舰按等级折算的成长战力之和。
//   ③ 我方战力＝战力公式 v0（S7PowerRating 单一真源·机制批③段三躯干重校）：与压力表/经济尺同量纲——
//     "我方 vs 推荐"从此可直读（此前占位公式与压力表跨量纲·§16d 三段病根记档）。
//
// 边界：core 层只读 runtime 配置 + 同族 S7*；不跑战斗、不改状态、不 import cc/save；确定可复算、可单测。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import {
  S7BattleEncounterParam,
  S7BattleSpawnParam,
  S7BattleUnitStatParam,
  S7GrowthBandParam,
} from '../../config/s7/ConfigTypesS7';
import { S7MainlineProgressState } from './S7MainlineProgress';
import { S7BattleEntry } from './S7BattleEntry';
import { S7SquadState } from './S7Squad';
import { S7UnitLevelState, getShipLevel, getPilotLevel } from './S7UnitLevelState';
import { S7PluginInventoryState, findOwnedPlugin } from './S7PluginInventory';
import { S7PluginQuality } from './S7PluginEffects';
import { S7UnitTierState, getShipTier, getPilotStar } from './S7UnitTierState';
import { shipPowerV0 } from './S7PowerRating';

/**
 * 单舰战力（战力公式 v0·S7PowerRating 单一真源）：(阶基值×等级项+插件)×驾驶员系数+核。
 * 备战总战力按编队逐舰求和、上阵界面按此排序/显示——单一口径；与压力表同量纲。
 * 插件与星核都计入战力（Ron 2026-06-20 拍板·有意覆盖 v1.0 §6"质变不计战力"）。
 */
export function shipPowerOf(
  _growthBands: S7GrowthBandParam[],
  squad: S7SquadState,
  shipId: string,
  unitLevels?: S7UnitLevelState,
  inventory?: S7PluginInventoryState,
  tierState?: S7UnitTierState,
): number {
  const level = unitLevels ? getShipLevel(unitLevels, shipId) : 1;
  const tier = tierState ? getShipTier(tierState, shipId) : 0;
  const lo = squad.shipLoadouts[shipId];
  const pluginQualities: S7PluginQuality[] = [];
  if (lo && inventory) {
    for (const id of lo.pluginInstanceIds) {
      const inst = findOwnedPlugin(inventory, id);
      if (inst) pluginQualities.push(inst.quality);
    }
  }
  const pilotStar = lo?.pilotId ? (tierState ? getPilotStar(tierState, lo.pilotId) : 1) : 0;
  // 配了驾驶员至少 Lv1（×1.01·与刻度反解同口径）——"配驾驶员就计入战力"语义在 v0 下仍成立。
  const pilotLevel = lo?.pilotId ? (unitLevels ? getPilotLevel(unitLevels, lo.pilotId) : 1) : 0;
  return Math.round(shipPowerV0({ tier, level, pluginQualities, withCore: !!lo?.coreId, pilotStar, pilotLevel }));
}

/** 敌情预览里的一个敌人：战斗属性行 + 站位 + 是否 Boss。 */
export interface S7PrebattleEnemy {
  unitStatRef: string;
  slotRef: string;
  isBoss: boolean;
}

export interface S7PrebattleView {
  nodeId: string;
  stageType: string;        // normal / elite / boss
  /** 该节点是否已配遭遇（false=暂无关卡，敌人列表为空）。 */
  hasEncounter: boolean;
  enemies: S7PrebattleEnemy[];
  enemyCount: number;
  hasBoss: boolean;
  /** 我方战力（占位·精确公式留第二块）：编队各舰 成长战力(按等级) + 装配战力(驾驶员 + 星核 + 插件按品质)之和（向下取整）。 */
  playerPower: number;
  /** 推荐战力（占位）：节点压力值（boss=recommend，普通/精英=min/max 中值）。 */
  recommendedPower: number;
}

export type S7PrebattleViewResult =
  | { ok: true; view: S7PrebattleView }
  | { ok: false; error: string };

/**
 * 组装当前节点的战前备战数据（只读，不跑战斗）。
 * 非战斗节点 / context 解析失败 → ok:false。节点无遭遇 → ok:true 但 hasEncounter=false、enemies 空。
 */
export function buildPrebattleView(
  runtime: S7ConfigRuntime,
  progress: S7MainlineProgressState,
  squad: S7SquadState,
  unitLevels?: S7UnitLevelState,
  inventory?: S7PluginInventoryState,
  tierState?: S7UnitTierState,
): S7PrebattleViewResult {
  const ctxResult = S7BattleEntry.fromRuntime(runtime).resolveCurrentContext(progress);
  if (!ctxResult.ok) return { ok: false, error: ctxResult.error };
  const ctx = ctxResult.context;

  // 推荐战力：boss 取 recommend；普通/精英取压力 min/max 中值（v1.0 §8 以 pressure 衡量难度）。
  const p = ctx.pressure;
  const recommendedPower =
    ctx.stageType === 'boss' && typeof p.recommend === 'number'
      ? Math.round(p.recommend)
      : Math.round((p.min + p.max) / 2);

  // 敌情预览：如实读 该节点 encounter → spawn → 敌人单位 + 站位（不脑补）。
  const encounter = runtime
    .getAll<S7BattleEncounterParam>('battle_encounter_param')
    .find((e) => e.nodeRef === ctx.nodeId);
  const enemies: S7PrebattleEnemy[] = [];
  if (encounter && Array.isArray(encounter.spawnPlanRefs)) {
    const spawns = runtime.getAll<S7BattleSpawnParam>('battle_spawn_param');
    const units = runtime.getAll<S7BattleUnitStatParam>('battle_unit_stat_param');
    for (const spawnRef of encounter.spawnPlanRefs) {
      const spawn = spawns.find((s) => s.rowId === spawnRef);
      if (!spawn || !Array.isArray(spawn.slotRefs)) continue;
      const unit = units.find((u) => u.rowId === spawn.unitStatRef);
      const isBoss = unit?.targetType === 'boss';
      for (const slotRef of spawn.slotRefs) {
        enemies.push({ unitStatRef: spawn.unitStatRef, slotRef, isBoss });
      }
    }
  }

  // 我方战力（占位）：编队各舰 成长战力(按等级) + 装配战力(驾驶员 + 星核 + 插件按品质·均计入)，逐舰经 shipPowerOf。
  const growthBands = runtime.getAll<S7GrowthBandParam>('growth_band_param');
  let playerPower = 0;
  for (const slot of squad.formation) {
    playerPower += shipPowerOf(growthBands, squad, slot.shipId, unitLevels, inventory, tierState);
  }

  return {
    ok: true,
    view: {
      nodeId: ctx.nodeId,
      stageType: ctx.stageType,
      hasEncounter: !!encounter,
      enemies,
      enemyCount: enemies.length,
      hasBoss: ctx.stageType === 'boss' || enemies.some((e) => e.isBoss),
      playerPower: Math.round(playerPower),
      recommendedPower,
    },
  };
}
