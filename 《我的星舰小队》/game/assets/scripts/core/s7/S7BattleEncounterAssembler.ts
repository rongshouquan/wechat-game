// S7 专用纯 TS 遇敌组装器（BATTLE-RT-05，不依赖 cc）。
//
// 职责：把 S7BattleEntry 解析出的当前节点 context、玩家出战星舰（稳定 shipId）和运行种子，
// 组装成 S7AutoBattleEngine.run() 可直接吃的 S7AutoBattleRunRequest，并附带一份只在本地返回的
// 轻量 trace（仅稳定 ID + 可复现信息）。这一步只做“战斗入参组装”。
//
// 边界（依 RT-05 任务包）：
// - 不调用 completeS7Node、不写 S7SaveService、不发奖励、不推进主线、不接 UI / Cocos 场景。
// - 不接真实服务器 / 云 / 社交 / 充值 / 微信云 / 支付 SDK；trace 只本地返回，不上传、不写存档。
// - battleSeed 必须由 nodeId + 调用方 runSeed 组合而成（同节点同 runSeed 同阵容完全可复现）；
//   不使用随机、不使用当前时间、不使用设备或账号标识。
// - 玩家输入用稳定 shipId，运行时再映射成引擎需要的 unitStatRef，避免未来玩家数据直接绑定战斗行 ID。
// - 不把 pressure_param 自动换算成 hp / attack / armor。

import {
  S7BattleEncounterParam,
  S7BattleUnitStatParam,
  S7ShipConfig,
  S7PluginConfig,
  S7PilotConfig,
  S7GrowthBandParam,
} from '../../config/s7/ConfigTypesS7';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7MainlineProgressState } from './S7MainlineProgress';
import { S7BattleEntry, S7BattleContext } from './S7BattleEntry';
import { S7AutoBattleRunRequest, S7AutoBattlePlayerUnitInput } from './S7AutoBattleTypes';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { coreBlocks } from './S7CoreEffects';
import { pluginBlocks, S7PluginQuality, S7_PLUGIN_QUALITIES } from './S7PluginEffects';
import { pilotBlocks } from './S7PilotEffects';
import { shipGrowthBlocks, pilotGrowthBlocks } from './S7UnitGrowth';

const MAX_LINEUP = 5;
/** 每艘星舰固定 3 槽（武器/技能(CD)/战术），不能堆同类、同名不重复（v1.0 §5.3）。 */
const MAX_PLUGINS_PER_SHIP = 3;
const PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;
const REQUIRED_PLAYER_SLOT_POLICY = 'five_ship_3x3_default';
const REQUIRED_SEED_POLICY = 'node_id_plus_run_seed';

/** 出战插件实例（块4a）：词条(pluginId) + 品质。槽位由 plugin_config 决定，不在此重复。 */
export interface S7BattleLineupPluginInput {
  pluginId: string;
  quality: S7PluginQuality;
}

/** 玩家出战单位输入：稳定 shipId + 玩家 3x3 锚点格（p0c0..p2c2）。不绑定 battle_unit_stat_param.rowId。 */
export interface S7BattleLineupUnitInput {
  shipId: string;
  slotRef: string;
  /** 驾驶员（块5）：组装时解析成行为AI+驾驶天赋积木喂装配层；缺省 = 无驾驶员。 */
  pilotId?: string;
  /** 装备的星核（块3）：组装时解析成效果积木喂装配层；缺省 = 无核。 */
  coreId?: string;
  /** 装备的插件（块4a，≤3，槽位不能重复）：组装时按品质解析成效果积木喂装配层；缺省 = 无插件。
   *  注：品质来自「拥有插件实例」模型；该模型的存档化(背包/合成/回收)留块6，此处由调用方直接给。 */
  plugins?: S7BattleLineupPluginInput[];
  /** 星舰等级（C1b 升级变强）：缺省 1 级；经 S7UnitGrowth.shipGrowthBlocks 折成成长积木放大血/攻。 */
  shipLevel?: number;
  /** 驾驶员等级（C1b 升级变强）：缺省 1 级；当前 pilotGrowthBlocks 占位返回空（§5.2 驾驶员升级无原始属性）。 */
  pilotLevel?: number;
}

/** 组装请求：只读节点进度 + 运行种子 + 玩家阵容（稳定 shipId）。 */
export interface S7BattleEncounterAssembleRequest {
  progress: S7MainlineProgressState;
  runSeed: string | number;
  lineup: S7BattleLineupUnitInput[];
}

/**
 * 轻量战报 trace（只本地返回，不写存档、不上传、不进入引擎请求）。
 * 只保留稳定 ID 与本地可复现信息，为未来核验/战报预留清晰锚点，但当前不做任何在线行为。
 */
export interface S7BattleRunTrace {
  nodeId: string;
  encounterRef: string;
  battleSeed: string;
  shipIds: string[];
  slotRefs: string[];
  battleSeedPolicy: string;
  uploadRequired: false;
}

/** 组装产物：解析出的 context、可直接交给引擎的 request、以及本地 trace。 */
export interface S7BattleEncounterAssembled {
  context: S7BattleContext;
  request: S7AutoBattleRunRequest;
  trace: S7BattleRunTrace;
}

export type S7BattleEncounterAssemblerErrorCode =
  | 'battle_context_error'
  | 'missing_encounter'
  | 'encounter_context_mismatch'
  | 'unsupported_seed_policy'
  | 'unsupported_player_slot_policy'
  | 'empty_lineup'
  | 'too_many_units'
  | 'bad_player_slot'
  | 'duplicate_player_slot'
  | 'unknown_ship'
  | 'missing_ship_battle_unit'
  | 'ambiguous_ship_battle_unit'
  | 'unknown_pilot'
  | 'too_many_plugins'
  | 'unknown_plugin'
  | 'duplicate_plugin'
  | 'duplicate_plugin_slot'
  | 'bad_plugin_quality';

export class S7BattleEncounterAssemblerError extends Error {
  constructor(
    public readonly code: S7BattleEncounterAssemblerErrorCode,
    message: string,
  ) {
    super(`s7 encounter assemble 错误[${code}]: ${message}`);
    this.name = 'S7BattleEncounterAssemblerError';
  }
}

/**
 * S7 遇敌组装器。位于 S7BattleEntry（只读 context）与 S7AutoBattleEngine（跑战斗）之间，
 * 只做入参组装，输入只读、无副作用：不改 progress、不改 runtime 配置行。
 */
export class S7BattleEncounterAssembler {
  private readonly entry: S7BattleEntry;

  constructor(
    private readonly runtime: S7ConfigRuntime,
    entry?: S7BattleEntry,
  ) {
    // 未传入 entry 时内部自建，调用方无需手动构造 context 层。
    this.entry = entry ?? S7BattleEntry.fromRuntime(runtime);
  }

  /** 组装当前节点的战斗入参；任一前置不满足抛 S7BattleEncounterAssemblerError，不产生副作用。 */
  assemble(request: S7BattleEncounterAssembleRequest): S7BattleEncounterAssembled {
    const { progress, runSeed, lineup } = request;

    // 1. 解析当前节点 context（只读，不改 progress）。
    const ctxResult = this.entry.resolveCurrentContext(progress);
    if (!ctxResult.ok) {
      throw new S7BattleEncounterAssemblerError(
        'battle_context_error',
        `节点 ${ctxResult.nodeId} 无法解析战斗 context：${ctxResult.error}`,
      );
    }
    const context = ctxResult.context;

    // 2. 匹配 encounter（nodeRef === context.nodeId）。
    const encounter = this.runtime
      .getAll<S7BattleEncounterParam>('battle_encounter_param')
      .find((e) => e.nodeRef === context.nodeId);
    if (!encounter) {
      throw new S7BattleEncounterAssemblerError(
        'missing_encounter',
        `节点 ${context.nodeId} 在 battle_encounter_param 中无对应 encounter`,
      );
    }

    // 3. encounter 与 context 一致性 + 策略校验。
    this.assertEncounterMatchesContext(context, encounter);

    // 4. 玩家阵容校验 + shipId -> unitStatRef 映射。
    const playerUnits = this.buildPlayerUnits(lineup);

    // 5. battleSeed = `${nodeId}:${runSeed}`（无随机、无时间、无设备/账号标识，完全可复现）。
    const battleSeed = `${context.nodeId}:${String(runSeed)}`;

    const engineRequest: S7AutoBattleRunRequest = {
      encounterRef: encounter.rowId,
      battleSeed,
      playerUnits,
    };

    // trace 只本地返回：保留未来核验/战报所需的稳定 ID，不上传、不写存档、不进入引擎请求。
    const trace: S7BattleRunTrace = {
      nodeId: context.nodeId,
      encounterRef: encounter.rowId,
      battleSeed,
      shipIds: lineup.map((u) => u.shipId),
      slotRefs: lineup.map((u) => u.slotRef),
      battleSeedPolicy: encounter.battleSeedPolicy,
      uploadRequired: false,
    };

    return { context, request: engineRequest, trace };
  }

  /** 校验 encounter 与 context 对齐，以及首版固定策略。 */
  private assertEncounterMatchesContext(context: S7BattleContext, encounter: S7BattleEncounterParam): void {
    const mismatch = (field: string, expected: unknown, actual: unknown): never => {
      throw new S7BattleEncounterAssemblerError(
        'encounter_context_mismatch',
        `encounter ${encounter.rowId} 的 ${field}（${String(actual)}）与节点 context（${String(expected)}）不一致`,
      );
    };

    if (encounter.stageType !== context.stageType) mismatch('stageType', context.stageType, encounter.stageType);
    if (encounter.templateRef !== context.templateId) mismatch('templateRef', context.templateId, encounter.templateRef);
    if (encounter.problemTagRef !== context.mainProblemTag) mismatch('problemTagRef', context.mainProblemTag, encounter.problemTagRef);
    // 副压力对齐：context.secondaryPressure 为 null 对应 encounter 的 'none'。
    const contextSecondary = context.secondaryPressure === null ? 'none' : context.secondaryPressure;
    if (encounter.secondaryPressureTag !== contextSecondary) {
      mismatch('secondaryPressureTag', contextSecondary, encounter.secondaryPressureTag);
    }

    if (encounter.playerSlotPolicy !== REQUIRED_PLAYER_SLOT_POLICY) {
      throw new S7BattleEncounterAssemblerError(
        'unsupported_player_slot_policy',
        `encounter ${encounter.rowId} 的 playerSlotPolicy 必须为 ${REQUIRED_PLAYER_SLOT_POLICY}，实际 ${String(encounter.playerSlotPolicy)}`,
      );
    }
    if (encounter.battleSeedPolicy !== REQUIRED_SEED_POLICY) {
      throw new S7BattleEncounterAssemblerError(
        'unsupported_seed_policy',
        `encounter ${encounter.rowId} 的 battleSeedPolicy 必须为 ${REQUIRED_SEED_POLICY}，实际 ${String(encounter.battleSeedPolicy)}`,
      );
    }
  }

  /** 校验玩家阵容并把每个稳定 shipId 映射成引擎需要的 unitStatRef。 */
  private buildPlayerUnits(lineup: S7BattleLineupUnitInput[]): S7AutoBattlePlayerUnitInput[] {
    if (!Array.isArray(lineup) || lineup.length === 0) {
      throw new S7BattleEncounterAssemblerError('empty_lineup', '玩家出战阵容不能为空');
    }
    if (lineup.length > MAX_LINEUP) {
      throw new S7BattleEncounterAssemblerError('too_many_units', `玩家出战最多 ${MAX_LINEUP} 艘，实际 ${lineup.length}`);
    }

    const ships = this.runtime.getAll<S7ShipConfig>('ship_config');
    const units = this.runtime.getAll<S7BattleUnitStatParam>('battle_unit_stat_param');
    const pluginConfigs = this.runtime.getAll<S7PluginConfig>('plugin_config');
    const pilotConfigs = this.runtime.getAll<S7PilotConfig>('pilot_config');
    const growthBands = this.runtime.getAll<S7GrowthBandParam>('growth_band_param'); // C1b 升级变强：等级→成长积木
    const seenSlots = new Set<string>();
    const playerUnits: S7AutoBattlePlayerUnitInput[] = [];

    for (const item of lineup) {
      const slotRef = item.slotRef;
      if (typeof slotRef !== 'string' || !PLAYER_SLOT_PATTERN.test(slotRef)) {
        throw new S7BattleEncounterAssemblerError('bad_player_slot', `非法玩家格 "${String(slotRef)}"（仅 p0c0..p2c2）`);
      }
      if (seenSlots.has(slotRef)) {
        throw new S7BattleEncounterAssemblerError('duplicate_player_slot', `重复玩家格 "${slotRef}"`);
      }
      seenSlots.add(slotRef);

      const shipId = item.shipId;
      if (typeof shipId !== 'string' || !ships.some((s) => s.shipId === shipId)) {
        throw new S7BattleEncounterAssemblerError('unknown_ship', `未知星舰 "${String(shipId)}"（不存在于 ship_config）`);
      }

      // shipId -> 战斗行：必须在 battle_unit_stat_param 命中且只命中 1 行 ship 单位。
      const matched = units.filter((u) => u.targetType === 'ship' && u.unitRef === shipId);
      if (matched.length === 0) {
        throw new S7BattleEncounterAssemblerError('missing_ship_battle_unit', `星舰 ${shipId} 在 battle_unit_stat_param 缺少战斗属性行`);
      }
      if (matched.length > 1) {
        throw new S7BattleEncounterAssemblerError('ambiguous_ship_battle_unit', `星舰 ${shipId} 在 battle_unit_stat_param 命中多行战斗属性`);
      }

      // 校验驾驶员归属（给了 pilotId 必须存在于 pilot_config）。
      if (item.pilotId !== undefined && !pilotConfigs.some((p) => p.pilotId === item.pilotId)) {
        throw new S7BattleEncounterAssemblerError('unknown_pilot', `未知驾驶员 "${String(item.pilotId)}"（不存在于 pilot_config）`);
      }
      // 块3 星核 + 块5 驾驶员 + 块4a 插件：装备件各自解析成效果积木，合并喂装配层。
      // 顺序：星核质变 → 驾驶员行为/天赋 → 插件数值微调（deriveUnit 合并与顺序无关，此序仅表语义）。
      const blocks: S7EffectBlock[] = [
        // C1b 升级变强：星舰/驾驶员等级成长积木（按战力倍率放大血/攻；pilot 占位空）。
        ...shipGrowthBlocks(growthBands, item.shipLevel ?? 1),
        ...pilotGrowthBlocks(growthBands, item.pilotLevel ?? 1),
        ...(item.coreId ? coreBlocks(item.coreId) : []),
        ...(item.pilotId ? pilotBlocks(item.pilotId) : []),
        ...this.resolvePluginBlocks(item.plugins, pluginConfigs),
      ];
      playerUnits.push(
        blocks.length > 0
          ? { unitStatRef: matched[0].rowId, slotRef, effectBlocks: blocks }
          : { unitStatRef: matched[0].rowId, slotRef },
      );
    }

    return playerUnits;
  }

  /**
   * 把一艘船装备的插件（≤3，槽位不重复、同名不重复）解析成效果积木。
   * 槽位类型取自 plugin_config，按品质缩放（S7PluginEffects.pluginBlocks）。无插件 → 空数组。
   */
  private resolvePluginBlocks(
    plugins: S7BattleLineupPluginInput[] | undefined,
    pluginConfigs: S7PluginConfig[],
  ): S7EffectBlock[] {
    if (plugins === undefined) return [];
    if (!Array.isArray(plugins) || plugins.length === 0) return [];
    if (plugins.length > MAX_PLUGINS_PER_SHIP) {
      throw new S7BattleEncounterAssemblerError(
        'too_many_plugins',
        `单舰最多装 ${MAX_PLUGINS_PER_SHIP} 个插件，实际 ${plugins.length}`,
      );
    }

    const seenPluginIds = new Set<string>();
    const seenSlotTags = new Set<string>();
    const out: S7EffectBlock[] = [];

    for (const p of plugins) {
      const pluginId = p?.pluginId;
      const config = pluginConfigs.find((c) => c.pluginId === pluginId);
      if (typeof pluginId !== 'string' || !config) {
        throw new S7BattleEncounterAssemblerError('unknown_plugin', `未知插件 "${String(pluginId)}"（不存在于 plugin_config）`);
      }
      if (seenPluginIds.has(pluginId)) {
        throw new S7BattleEncounterAssemblerError('duplicate_plugin', `插件 "${pluginId}" 在同一艘船重复装备（同名不重复）`);
      }
      seenPluginIds.add(pluginId);
      if (seenSlotTags.has(config.slotTag)) {
        throw new S7BattleEncounterAssemblerError(
          'duplicate_plugin_slot',
          `插件槽位 "${config.slotTag}" 重复（同舰每类槽位仅一件）`,
        );
      }
      seenSlotTags.add(config.slotTag);
      if (!S7_PLUGIN_QUALITIES.includes(p.quality)) {
        throw new S7BattleEncounterAssemblerError(
          'bad_plugin_quality',
          `插件 "${pluginId}" 品质非法 "${String(p.quality)}"（仅 fine/superior/legendary）`,
        );
      }

      out.push(...pluginBlocks(pluginId, config.slotTag, p.quality));
    }

    return out;
  }
}
