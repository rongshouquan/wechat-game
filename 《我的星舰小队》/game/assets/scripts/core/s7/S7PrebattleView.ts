// 战前备战 数据层（阶段一 A-step2a，纯 TS，不依赖 cc）：v1.0 §4.4「战前界面：敌情预览(类型/数量/位置/有无Boss)」+ §6「统一战力值」。
//
// 职责：把"当前主线节点 + 玩家编队"如实组装成战前备战界面要显示的只读数据：
//   ① 敌情预览：当前节点遭遇的敌人列表（unitStatRef + 站位 slotRef + 是否Boss），如实读 encounter→spawn 配置，不脑补。
//   ② 推荐战力：取该节点的压力值（v1.0 §8 以 pressure 衡量难度；boss 取 recommend，普通/精英取 min/max 中值）。
//   ③ 我方战力：编队各舰按等级折算的成长战力之和。
//   ⚠️ 战力为【占位·待 B 块统一战力模型】：v1.0 §6 要"四层折成战力值"，精确模型留 B；此处用成长战力(growth_band 冻结数据)粗算、明确标占位、不发明新公式。
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
import { S7UnitLevelState, getShipLevel } from './S7UnitLevelState';
import { unitPowerAtLevel } from './S7UnitGrowth';
import { S7PluginInventoryState, findOwnedPlugin } from './S7PluginInventory';
import { S7PluginQuality } from './S7PluginEffects';

// 装配对战力的贡献（占位·方向值·精确公式留第二块）。Ron 2026-06-20 拍板：插件「与」星核「与」驾驶员都计入战力
//（星核计入=有意覆盖 v1.0 §6"质变不计战力"——见进度日志/记忆）。星舰 1 级成长战力≈120，故此处量级取得可感知。
const PLUGIN_POWER_BY_QUALITY: Record<S7PluginQuality, number> = { fine: 50, superior: 80, legendary: 110 };
const CORE_POWER = 150;
// 驾驶员战力占位：现无升星系统（留后），先给配上驾驶员的船一档固定加成；升星后改为按星级缩放（第二块）。
const PILOT_POWER = 100;

/**
 * 单舰战力（占位·精确公式留第二块）：成长战力(按等级) + 装配战力(驾驶员 + 星核 + 插件按品质)。
 * 备战总战力按编队逐舰求和、上阵界面按此排序/显示——单一口径，避免重复。
 */
export function shipPowerOf(
  growthBands: S7GrowthBandParam[],
  squad: S7SquadState,
  shipId: string,
  unitLevels?: S7UnitLevelState,
  inventory?: S7PluginInventoryState,
): number {
  const lv = unitLevels ? getShipLevel(unitLevels, shipId) : 1;
  let p = unitPowerAtLevel(growthBands, 'ship', lv);
  const lo = squad.shipLoadouts[shipId];
  if (lo) {
    if (lo.pilotId) p += PILOT_POWER;
    if (lo.coreId) p += CORE_POWER;
    if (inventory) {
      for (const id of lo.pluginInstanceIds) {
        const inst = findOwnedPlugin(inventory, id);
        if (inst) p += PLUGIN_POWER_BY_QUALITY[inst.quality] ?? 0;
      }
    }
  }
  return Math.round(p);
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
    playerPower += shipPowerOf(growthBands, squad, slot.shipId, unitLevels, inventory);
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
