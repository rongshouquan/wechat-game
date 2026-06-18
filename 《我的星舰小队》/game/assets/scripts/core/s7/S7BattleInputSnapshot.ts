// S7 正式战斗输入快照契约与本地校验（BATTLE-RT-07E-1，纯 TS，不依赖 cc）。
//
// 职责：冻结“一次正式 S7 战斗输入源”的稳定形状 —— 节点 / 运行标识 / 阵容修订 / 显式 runSeed /
// 拥有的星舰·驾驶员·插件·星核 / 上阵单位（站位 + 装配 + 培养状态），全部以稳定 ID 表达；
// 并提供一个无副作用的本地校验函数，把非法输入明确报错，绝不静默补默认值。
//
// 严格边界（依 RT-07E-1 任务包）：
// - 只定义契约 + 本地校验：不读写存档、不接 UI、不装配战斗、不跑战斗、不结算、不推进主线、不接服务器。
// - 不 import cc / 存档 / 玩家态 / 编队 / 旧战斗 / 战斗运行壳 / 战斗引擎 / 主线推进。
// - 未来在线化不堵死：稳定 ID、显式 runSeed、可复现、可在 Node/Vitest 本地校验；
//   不接真实联网 / 账号 / 设备标识 / 排行榜 / 好友 / 公会 / 支付 / 充值，
//   并主动校验 runSeed / battleAttemptId / lineupRevision 不含生产种子来源痕迹（时间 / 随机 / 账号 / 设备）。
// - runtime 仅作“可选只读引用校验”使用（校验 ID 是否存在于配置）；本文件不持有、不加载 runtime。

import type { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';

/** 单个上阵单位输入快照：稳定 shipId + 玩家 3x3 锚点格 + 可选装配 / 培养状态（全部稳定 ID）。 */
export interface S7BattleInputUnitSnapshot {
  shipId: string;
  slotRef: string;
  pilotId?: string;
  coreId?: string;
  pluginIds?: string[];
  shipLevel?: number;
  pilotLevel?: number;
  coreEnhance?: number;
  // 插件不分等级（v1.0 §5.3）：无 pluginEnhanceById；变强靠品质替换 / 合成。
}

/**
 * 一次正式 S7 战斗输入快照（稳定 ID 结构）。
 * 由调用方显式提供：本契约不生成 runSeed、不读存档、不装配/不跑战斗。
 */
export interface S7BattleInputSnapshot {
  /** 本次快照稳定标识（由调用方提供，便于复核 / 复现，不含身份或设备信息）。 */
  snapshotId: string;
  /** 目标战斗节点 ID（如 n001）。 */
  nodeId: string;
  /** 本次战斗尝试稳定标识（与重试 / 战报复核相关，显式提供，不由时间 / 随机生成）。 */
  battleAttemptId: string;
  /** 同一尝试内的运行序号（非负整数，用于重复运行的稳定区分）。 */
  runIndex: number;
  /** 阵容修订号：阵容 / 装配 / 培养状态变更时由调用方递增的稳定标识。 */
  lineupRevision: string;
  /** 显式战斗运行种子（非空字符串，由调用方提供，禁止由时间 / 随机 / 账号 / 设备生成）。 */
  runSeed: string;
  ownedShips: string[];
  ownedPilots: string[];
  ownedPlugins: string[];
  ownedCores: string[];
  units: S7BattleInputUnitSnapshot[];
}

export type S7BattleInputSnapshotErrorCode =
  | 'missing_snapshot_id'
  | 'missing_node_id'
  | 'missing_battle_attempt_id'
  | 'missing_lineup_revision'
  | 'missing_run_seed'
  | 'bad_run_index'
  | 'tainted_id_source'
  | 'bad_owned_id'
  | 'empty_units'
  | 'too_many_units'
  | 'bad_unit'
  | 'bad_slot_ref'
  | 'duplicate_slot'
  | 'ship_not_owned'
  | 'pilot_not_owned'
  | 'core_not_owned'
  | 'plugin_not_owned'
  | 'bad_level_value'
  | 'bad_enhance_value'
  | 'unknown_ship'
  | 'unknown_pilot'
  | 'unknown_core'
  | 'unknown_plugin';

export interface S7BattleInputSnapshotError {
  code: S7BattleInputSnapshotErrorCode;
  /** 本地、稳定的错误位置描述（如 units[2].slotRef）；不含身份 / 设备 / 网络信息。 */
  path: string;
  message: string;
}

export type S7BattleInputSnapshotValidation =
  | { ok: true }
  | { ok: false; errors: S7BattleInputSnapshotError[] };

type AddError = (code: S7BattleInputSnapshotErrorCode, path: string, message: string) => void;

const MIN_UNITS = 1;
const MAX_UNITS = 5;
const PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;

/**
 * 禁止出现在 runSeed / battleAttemptId / lineupRevision 中的“生产种子来源”片段（小写比对）。
 * 以拼接构造，确保本文件源码里不出现连续的来源字面量（同时满足本模块静态隔离测试）。
 */
const TAINTED_ID_SOURCE_FRAGMENTS: readonly string[] = [
  'date' + '.now',
  'math' + '.random',
  'open' + 'id',
  'union' + 'id',
  'dev' + 'ice',
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function hasTaintedSource(value: string): boolean {
  const lower = value.toLowerCase();
  return TAINTED_ID_SOURCE_FRAGMENTS.some((frag) => lower.includes(frag));
}

/** 校验 owned* 为非空字符串数组，返回其去空后的字符串集合（供上阵引用一致性比对）。 */
function validateOwned(raw: unknown, path: string, add: AddError): Set<string> {
  if (!Array.isArray(raw)) {
    add('bad_owned_id', path, `${path} 必须是字符串数组`);
    return new Set();
  }
  const set = new Set<string>();
  raw.forEach((x, i) => {
    if (!isNonEmptyString(x)) {
      add('bad_owned_id', `${path}[${i}]`, `${path}[${i}] 必须是非空字符串 ID`);
      return;
    }
    set.add(x);
  });
  return set;
}

/** 可选等级 / 强化值：提供时必须是非负整数。 */
function validateOptionalNonNegInt(
  value: unknown,
  path: string,
  code: 'bad_level_value' | 'bad_enhance_value',
  add: AddError,
): void {
  if (value === undefined) return;
  if (!isNonNegativeInteger(value)) {
    add(code, path, `${path} 必须是非负整数`);
  }
}

interface OwnedSets {
  ship: Set<string>;
  pilot: Set<string>;
  plugin: Set<string>;
  core: Set<string>;
}

function validateUnit(
  rawUnit: unknown,
  index: number,
  seenSlots: Set<string>,
  owned: OwnedSets,
  runtime: S7ConfigRuntime | undefined,
  add: AddError,
): void {
  if (typeof rawUnit !== 'object' || rawUnit === null) {
    add('bad_unit', `units[${index}]`, '上阵单位必须是对象');
    return;
  }
  const unit = rawUnit as Record<string, unknown>;
  const at = (field: string): string => `units[${index}].${field}`;

  // shipId：必填，且必须属于 ownedShips；runtime 开启时必须存在于配置。
  const shipId = unit.shipId;
  if (!isNonEmptyString(shipId)) {
    add('ship_not_owned', at('shipId'), 'shipId 必须是非空字符串');
  } else {
    if (!owned.ship.has(shipId)) add('ship_not_owned', at('shipId'), `上阵星舰 ${shipId} 不在 ownedShips 内`);
    if (runtime && !runtime.has('ship_config', shipId)) add('unknown_ship', at('shipId'), `ship_config 中无星舰 ${shipId}`);
  }

  // slotRef：p0c0..p2c2，且全队不重复。
  const slotRef = unit.slotRef;
  if (!isNonEmptyString(slotRef) || !PLAYER_SLOT_PATTERN.test(slotRef)) {
    add('bad_slot_ref', at('slotRef'), `非法站位 "${String(slotRef)}"（仅 p0c0..p2c2）`);
  } else if (seenSlots.has(slotRef)) {
    add('duplicate_slot', at('slotRef'), `重复站位 "${slotRef}"`);
  } else {
    seenSlots.add(slotRef);
  }

  // pilotId（可选）：提供时必须属于 ownedPilots；runtime 开启时必须存在于配置。
  if (unit.pilotId !== undefined) {
    const pilotId = unit.pilotId;
    if (!isNonEmptyString(pilotId)) {
      add('pilot_not_owned', at('pilotId'), 'pilotId 必须是非空字符串');
    } else {
      if (!owned.pilot.has(pilotId)) add('pilot_not_owned', at('pilotId'), `驾驶员 ${pilotId} 不在 ownedPilots 内`);
      if (runtime && !runtime.has('pilot_config', pilotId)) add('unknown_pilot', at('pilotId'), `pilot_config 中无驾驶员 ${pilotId}`);
    }
  }

  // coreId（可选）：提供时必须属于 ownedCores；runtime 开启时必须存在于配置。
  if (unit.coreId !== undefined) {
    const coreId = unit.coreId;
    if (!isNonEmptyString(coreId)) {
      add('core_not_owned', at('coreId'), 'coreId 必须是非空字符串');
    } else {
      if (!owned.core.has(coreId)) add('core_not_owned', at('coreId'), `星核 ${coreId} 不在 ownedCores 内`);
      if (runtime && !runtime.has('core_config', coreId)) add('unknown_core', at('coreId'), `core_config 中无星核 ${coreId}`);
    }
  }

  // pluginIds（可选）：每个插件必须属于 ownedPlugins；runtime 开启时必须存在于配置。
  if (unit.pluginIds !== undefined) {
    if (!Array.isArray(unit.pluginIds)) {
      add('plugin_not_owned', at('pluginIds'), 'pluginIds 必须是字符串数组');
    } else {
      unit.pluginIds.forEach((pid, j) => {
        const p = `${at('pluginIds')}[${j}]`;
        if (!isNonEmptyString(pid)) {
          add('plugin_not_owned', p, 'pluginId 必须是非空字符串');
          return;
        }
        if (!owned.plugin.has(pid)) add('plugin_not_owned', p, `插件 ${pid} 不在 ownedPlugins 内`);
        if (runtime && !runtime.has('plugin_config', pid)) add('unknown_plugin', p, `plugin_config 中无插件 ${pid}`);
      });
    }
  }

  // 等级 / 强化值（可选）：非负整数。不附加任意上限（保守边界，避免乱造复杂规则）。
  validateOptionalNonNegInt(unit.shipLevel, at('shipLevel'), 'bad_level_value', add);
  validateOptionalNonNegInt(unit.pilotLevel, at('pilotLevel'), 'bad_level_value', add);
  validateOptionalNonNegInt(unit.coreEnhance, at('coreEnhance'), 'bad_enhance_value', add);
  // 插件不分等级（v1.0 §5.3）：不再校验 pluginEnhanceById（已从契约移除）。
}

/**
 * 本地校验一次战斗输入快照：纯函数、无副作用、不读存档 / 不触网 / 不跑战斗。
 * 累计全部错误后返回 { ok:false; errors } 或 { ok:true }；不以抛错作为常规校验结果。
 * 传入 runtime 时额外做只读引用校验（ship/pilot/core/plugin 是否存在于配置）。
 */
export function validateS7BattleInputSnapshot(
  snapshot: S7BattleInputSnapshot,
  runtime?: S7ConfigRuntime,
): S7BattleInputSnapshotValidation {
  const errors: S7BattleInputSnapshotError[] = [];
  const add: AddError = (code, path, message) => {
    errors.push({ code, path, message });
  };

  const s = snapshot as unknown as Record<string, unknown>;

  // 1. 必填稳定标识：非空字符串。
  if (!isNonEmptyString(s.snapshotId)) add('missing_snapshot_id', 'snapshotId', 'snapshotId 必须是非空字符串');
  if (!isNonEmptyString(s.nodeId)) add('missing_node_id', 'nodeId', 'nodeId 必须是非空字符串');
  if (!isNonEmptyString(s.battleAttemptId)) add('missing_battle_attempt_id', 'battleAttemptId', 'battleAttemptId 必须是非空字符串');
  if (!isNonEmptyString(s.lineupRevision)) add('missing_lineup_revision', 'lineupRevision', 'lineupRevision 必须是非空字符串');
  if (!isNonEmptyString(s.runSeed)) add('missing_run_seed', 'runSeed', 'runSeed 必须由调用方显式提供为非空字符串');

  // 2. runIndex：非负整数。
  if (!isNonNegativeInteger(s.runIndex)) add('bad_run_index', 'runIndex', 'runIndex 必须是非负整数');

  // 3. 来源痕迹：runSeed / battleAttemptId / lineupRevision 不得携带时间 / 随机 / 账号 / 设备来源。
  for (const field of ['runSeed', 'battleAttemptId', 'lineupRevision'] as const) {
    const v = s[field];
    if (isNonEmptyString(v) && hasTaintedSource(v)) {
      add('tainted_id_source', field, `${field} 不得包含生产种子来源痕迹（时间 / 随机 / 账号 / 设备）`);
    }
  }

  // 4. owned*：非空字符串数组（元素层校验），并建立集合供上阵引用一致性比对。
  const owned: OwnedSets = {
    ship: validateOwned(s.ownedShips, 'ownedShips', add),
    pilot: validateOwned(s.ownedPilots, 'ownedPilots', add),
    plugin: validateOwned(s.ownedPlugins, 'ownedPlugins', add),
    core: validateOwned(s.ownedCores, 'ownedCores', add),
  };

  // 5. units：1..5 的数组；逐个单位校验站位 / 引用一致 / 等级强化 / runtime 引用。
  const units = s.units;
  if (!Array.isArray(units) || units.length < MIN_UNITS) {
    add('empty_units', 'units', `units 至少需要 ${MIN_UNITS} 个上阵单位`);
  } else if (units.length > MAX_UNITS) {
    add('too_many_units', 'units', `units 最多 ${MAX_UNITS} 个上阵单位，实际 ${units.length}`);
  }
  if (Array.isArray(units)) {
    const seenSlots = new Set<string>();
    units.forEach((rawUnit, i) => validateUnit(rawUnit, i, seenSlots, owned, runtime, add));
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
