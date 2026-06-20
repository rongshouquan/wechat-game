/**
 * S7 首发正式版本地存档与 资源状态骨架（CC-07B，纯 TS，不依赖 cc）。
 *
 * 依 CC-07-PRE D-RT-3 决策：首发正式版采用【独立存档域 / 新 storage key】，
 * 不走流程版 saveVersion v8 老档迁移，不读取或迁移流程版旧存档 key。
 * 本文件只做存档/状态基础层：资源默认状态、S7 玩家状态骨架、读 / 写 / 恢复，
 * 复用 SaveStorageAdapter 接口模式（真机注入 Wx/Browser 适配器，测试用 MemoryStorageAdapter）。
 *
 * 边界：不接 AppContext / 启动场景 / Cocos UI / 战斗 / 主线 / 奖励 / 养成 / 建筑 / 商人 / 回收 / 广告；
 * 不改流程版 SaveService 的 CURRENT_SAVE_VERSION / SAVE_STORAGE_KEY / SaveData / PlayerState 语义；
 * 不 import cc，可在 Node / Vitest 独立测试。
 */
import { SaveStorageAdapter } from './SaveStorageAdapter';
import {
  S7MainlineProgressState,
  createDefaultS7MainlineProgress,
  normalizeS7MainlineProgress,
} from '../core/s7/S7MainlineProgress';
import {
  S7PluginInventoryState,
  createDefaultS7PluginInventory,
  normalizeS7PluginInventory,
} from '../core/s7/S7PluginInventory';
import {
  S7BuildingState,
  createDefaultS7BuildingState,
  normalizeS7BuildingState,
} from '../core/s7/S7BuildingState';
import {
  S7PopulationState,
  createDefaultS7Population,
  normalizeS7Population,
} from '../core/s7/S7Population';
import {
  S7ExclusiveShardInventoryState,
  createDefaultS7ExclusiveShardInventory,
  normalizeS7ExclusiveShardInventory,
} from '../core/s7/S7ExclusiveShardInventory';
import {
  S7ChestInventoryState,
  createDefaultS7ChestInventory,
  normalizeS7ChestInventory,
} from '../core/s7/S7ChestInventory';
import {
  S7ActivityProgressState,
  createDefaultS7ActivityProgress,
  normalizeS7ActivityProgress,
} from '../core/s7/S7ActivityProgress';
import {
  S7UnitLevelState,
  createDefaultS7UnitLevelState,
  normalizeS7UnitLevelState,
} from '../core/s7/S7UnitLevelState';
import {
  S7SquadState,
  createDefaultS7Squad,
  normalizeS7Squad,
} from '../core/s7/S7Squad';
import {
  S7MailboxState,
  createDefaultS7Mailbox,
  normalizeS7Mailbox,
} from '../core/s7/S7Mailbox';
import {
  S7GachaState,
  createDefaultS7GachaState,
  normalizeS7GachaState,
} from '../core/s7/S7GachaState';

/**
 * S7 存档结构版本。S7 首发独立计数，与流程版 CURRENT_SAVE_VERSION 互不相干。
 * v1（CC-07B）：资源骨架。
 * v2（CC-07C）：playerState 增加 mainlineProgress；v1 旧 S7 档加载时保留 资源、补默认主线进度。
 * v3（6d-1）：playerState 增加 pluginInventory（插件实例库存）；旧档加载补默认空库存（加性迁移，无需重置）。
 * v4（6b-2）：playerState 增加 buildings（建筑等级状态）；旧档加载补默认空建筑（加性迁移，无需重置）。
 * v5（6b-4b）：playerState 增加 population（居民/工人）；旧档加载补默认 0 人口（加性迁移，无需重置）。
 * v6（块6余项）：钱包扩键——新增 starGem(星空宝石)/pilotShardUniversal(通用驾驶员碎片)、信标 beacon 拆 3 档
 *   (beaconCommon/beaconRare/beaconEpic)。新键默认 0（加性）；旧档的笼统 beacon 量并入 beaconCommon（不丢、见 normalize）。
 * v7（块6余项）：playerState 增加 exclusiveShards(专属碎片库存) + chests(宝箱×3)；旧档加载补默认空（加性迁移，无需重置）。
 * v8（块7a）：playerState 增加 activityProgress(3天/7天活动进度+领取)；旧档加载补默认空（加性迁移，无需重置）。
 * v9（块7b）：activityProgress 每活动增加 cycleStartTime(周期起算)+settlementCount(累计结算次数)；旧档补默认 0（加性迁移）。
 * v10（C1b 升级变强）：playerState 增加 unitLevels(星舰/驾驶员等级)；旧档加载补默认空(=全 1 级，加性迁移)。
 * v11（阶段一 A·阵容/编队）：playerState 增加 squad(拥有 星舰/驾驶员/星核 + 编队)；旧档加载补默认空(无拥有/空编队，加性迁移)。
 * v12（阶段一 G2·邮件系统）：playerState 增加 mailbox(邮件列表+序号)；旧档加载补默认空邮箱(加性迁移，无需重置)。
 * v13（阶段一 C·抽卡三池）：playerState 增加 gacha(三池保底计数 + 专属池兑换进度/已领/期号)；旧档加载补默认空(加性迁移，无需重置)。
 */
export const S7_CURRENT_SAVE_VERSION = 13;

/**
 * S7 独立存档 key：必须与流程版 SAVE_STORAGE_KEY（'starship_squad_save_v1'）不同，互不污染。
 * 首发正式版自己的状态域，从此 key 读写，绝不读取流程版旧档。
 */
export const S7_SAVE_STORAGE_KEY = 'starship_squad_s7_save_v1';

/**
 * S7 首发 资源键（顺序与 03-04 v0.2 §2.2 free_resource_anchor_param 字段一致）。
 * 作为 资源状态的唯一键集真源。
 */
// 货币键（6a-2 重构 + 块6余项扩键）：
//   6a-2 删 battleLog/pluginMat/coreMat（升级额外消耗/插件强化料/星核强化料，均已废弃）。
//   块6余项：新增 starGem(星空宝石)/pilotShardUniversal(通用驾驶员碎片)；信标拆 3 档 beaconCommon/Rare/Epic（撤笼统 beacon）。
// 注：新键不进"免费毕业预算表"（那张表只盯核心软货币，见 ConfigValidatorS7.ANCHOR_BUDGET_KEYS），故扩钱包不再被逼填预算数值。
export const S7_RESOURCE_KEYS = [
  'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
  'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
  'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo',
] as const;

export type S7ResourceKey = (typeof S7_RESOURCE_KEYS)[number];

/** 资源状态：键集恒为 S7_RESOURCE_KEYS，值为非负数量。 */
export type S7ResourceState = Record<S7ResourceKey, number>;

/**
 * S7 玩家状态骨架：资源 + 主线进度（CC-07C）。
 * 养成 / 建筑等结构后续任务再扩；mainlineProgress 形状由 core/s7/S7MainlineProgress 拥有，本层组合。
 */
export interface S7PlayerState {
  resources: S7ResourceState;
  mainlineProgress: S7MainlineProgressState;
  /** 插件实例库存（6d-1）：形状由 core/s7/S7PluginInventory 拥有，本层组合。 */
  pluginInventory: S7PluginInventoryState;
  /** 建筑等级状态（6b-2）：形状由 core/s7/S7BuildingState 拥有，本层组合。 */
  buildings: S7BuildingState;
  /** 基地人口居民/工人（6b-4b）：形状由 core/s7/S7Population 拥有，本层组合。 */
  population: S7PopulationState;
  /** 专属碎片库存（块6余项）：unitId→专属碎片数，形状由 core/s7/S7ExclusiveShardInventory 拥有。 */
  exclusiveShards: S7ExclusiveShardInventoryState;
  /** 宝箱×3 未开库存（块6余项）：星辉货舱/行动宝藏/扩张宝藏计数，形状由 core/s7/S7ChestInventory 拥有。 */
  chests: S7ChestInventoryState;
  /** 活动进度（块7a）：3天行动/7天扩张的进度+领取，形状由 core/s7/S7ActivityProgress 拥有。 */
  activityProgress: S7ActivityProgressState;
  /** 单位等级（C1b 升级变强）：星舰/驾驶员等级，形状由 core/s7/S7UnitLevelState 拥有。 */
  unitLevels: S7UnitLevelState;
  /** 阵容/编队（阶段一 A）：拥有 星舰/驾驶员/星核 + 编队，形状由 core/s7/S7Squad 拥有。 */
  squad: S7SquadState;
  /** 邮件（阶段一 G2）：活动结算/抽卡补发/补偿的发放管道，形状由 core/s7/S7Mailbox 拥有。 */
  mailbox: S7MailboxState;
  /** 抽卡三池（阶段一 C）：三池保底计数 + 专属池兑换进度，形状由 core/s7/S7GachaState 拥有。 */
  gacha: S7GachaState;
}

export interface S7SaveData {
  saveVersion: number;
  playerState: S7PlayerState;
  /** 最后在线时间戳（毫秒），用于切后台 / 恢复及后续离线计算；本任务不做离线收益逻辑。 */
  lastOnlineTime: number;
}

/** 默认 资源状态：包含且只包含 S7_RESOURCE_KEYS 全部键，默认值均为 0。 */
export function createDefaultS7ResourceState(): S7ResourceState {
  const state = {} as S7ResourceState;
  for (const key of S7_RESOURCE_KEYS) {
    state[key] = 0;
  }
  return state;
}

export function createDefaultS7PlayerState(): S7PlayerState {
  return {
    resources: createDefaultS7ResourceState(),
    mainlineProgress: createDefaultS7MainlineProgress(),
    pluginInventory: createDefaultS7PluginInventory(),
    buildings: createDefaultS7BuildingState(),
    population: createDefaultS7Population(),
    exclusiveShards: createDefaultS7ExclusiveShardInventory(),
    chests: createDefaultS7ChestInventory(),
    activityProgress: createDefaultS7ActivityProgress(),
    unitLevels: createDefaultS7UnitLevelState(),
    squad: createDefaultS7Squad(),
    mailbox: createDefaultS7Mailbox(),
    gacha: createDefaultS7GachaState(),
  };
}

export function createDefaultS7SaveData(now: number): S7SaveData {
  return {
    saveVersion: S7_CURRENT_SAVE_VERSION,
    playerState: createDefaultS7PlayerState(),
    lastOnlineTime: now,
  };
}

/**
 * 规范化 资源：保证结果键集恰为 S7_RESOURCE_KEYS——
 * 缺失键补 0，非有限数值（NaN / Infinity / 负数 / 非数）一律落 0，未知键丢弃。
 * 防止脏存档把多余键或非法值带入运行时。
 */
function normalizeS7ResourceState(raw: unknown): S7ResourceState {
  const out = createDefaultS7ResourceState();
  if (raw && typeof raw === 'object') {
    const src = raw as Record<string, unknown>;
    for (const key of S7_RESOURCE_KEYS) {
      const v = src[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        out[key] = v;
      }
    }
    // v6 迁移（信标拆 3 档）：旧档的笼统 beacon 量并入 beaconCommon，不丢玩家信标。
    // 幂等——新档无 beacon 字段则跳过；写到 out（已不含 beacon 键），与未知键丢弃规则不冲突。
    const legacyBeacon = src.beacon;
    if (typeof legacyBeacon === 'number' && Number.isFinite(legacyBeacon) && legacyBeacon > 0) {
      out.beaconCommon += legacyBeacon;
    }
  }
  return out;
}

/** 规范化玩家状态骨架：规范 资源 + 主线进度；非对象一律退化为默认状态（v1 旧档无 mainlineProgress 即补默认）。 */
function normalizeS7PlayerState(raw: unknown): S7PlayerState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    resources: normalizeS7ResourceState(src.resources),
    mainlineProgress: normalizeS7MainlineProgress(src.mainlineProgress),
    pluginInventory: normalizeS7PluginInventory(src.pluginInventory),
    buildings: normalizeS7BuildingState(src.buildings),
    population: normalizeS7Population(src.population),
    exclusiveShards: normalizeS7ExclusiveShardInventory(src.exclusiveShards),
    chests: normalizeS7ChestInventory(src.chests),
    activityProgress: normalizeS7ActivityProgress(src.activityProgress),
    unitLevels: normalizeS7UnitLevelState(src.unitLevels),
    squad: normalizeS7Squad(src.squad),
    mailbox: normalizeS7Mailbox(src.mailbox),
    gacha: normalizeS7GachaState(src.gacha),
  };
}

export interface S7LoadResult {
  data: S7SaveData;
  /** 本次加载是否为"无 S7 存档，使用初始默认存档"。 */
  isNew: boolean;
  /** 本次加载是否触发了 S7 版本规范化（当前 S7 仅 v1，无跨版本迁移步骤）。 */
  migrated: boolean;
  /** 本次加载是否因存档损坏 / 结构非法而回退默认存档。 */
  corrupted: boolean;
  log: string[];
}

function isPlausibleS7SaveData(value: unknown): value is S7SaveData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const c = value as Partial<S7SaveData>;
  return (
    typeof c.saveVersion === 'number' &&
    typeof c.lastOnlineTime === 'number' &&
    !!c.playerState &&
    typeof c.playerState === 'object'
  );
}

/**
 * S7 启动加载流程（只读 S7_SAVE_STORAGE_KEY，绝不读流程版 key）：
 * - 无 S7 存档 -> 初始化默认（isNew=true）
 * - 解析失败 / 结构非法（损坏）-> 回退默认（corrupted=true），不让玩家卡死
 * - 版本与当前不一致 -> 骨架级规范并重置版本号（migrated=true；当前 S7 仅 v1，暂无跨版本迁移步骤）
 * - 否则正常恢复（仍规范化 资源，清洗脏键 / 缺键）
 */
export function loadS7Save(adapter: SaveStorageAdapter, now: number): S7LoadResult {
  const log: string[] = [];
  const raw = adapter.getString(S7_SAVE_STORAGE_KEY);

  if (raw === null) {
    log.push('s7_save_not_found_initializing_default');
    return { data: createDefaultS7SaveData(now), isNew: true, migrated: false, corrupted: false, log };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.push('s7_save_corrupted_json_parse_failed_fallback_to_default');
    return { data: createDefaultS7SaveData(now), isNew: false, migrated: false, corrupted: true, log };
  }

  if (!isPlausibleS7SaveData(parsed)) {
    log.push('s7_save_corrupted_invalid_shape_fallback_to_default');
    return { data: createDefaultS7SaveData(now), isNew: false, migrated: false, corrupted: true, log };
  }

  const playerState = normalizeS7PlayerState(parsed.playerState);

  if (parsed.saveVersion !== S7_CURRENT_SAVE_VERSION) {
    log.push(`s7_save_version_normalized from=${parsed.saveVersion} to=${S7_CURRENT_SAVE_VERSION}`);
    return {
      data: { saveVersion: S7_CURRENT_SAVE_VERSION, playerState, lastOnlineTime: parsed.lastOnlineTime },
      isNew: false,
      migrated: true,
      corrupted: false,
      log,
    };
  }

  log.push('s7_save_loaded_version_match');
  return {
    data: { saveVersion: S7_CURRENT_SAVE_VERSION, playerState, lastOnlineTime: parsed.lastOnlineTime },
    isNew: false,
    migrated: false,
    corrupted: false,
    log,
  };
}

/**
 * S7 持久化入口：把当前 S7 关键状态序列化落盘到 S7_SAVE_STORAGE_KEY，并刷新 lastOnlineTime。
 * 落盘前规范化 资源，保证存储结构恒为合法 S7_RESOURCE_KEYS 键集。
 */
export function persistS7Save(adapter: SaveStorageAdapter, data: S7SaveData, now: number): S7SaveData {
  const next: S7SaveData = {
    saveVersion: S7_CURRENT_SAVE_VERSION,
    playerState: {
      resources: normalizeS7ResourceState(data.playerState?.resources),
      mainlineProgress: normalizeS7MainlineProgress(data.playerState?.mainlineProgress),
      // 6b-2 修复：原 persist 漏写 pluginInventory（6d-1 加字段时遗漏），落盘会丢插件库存；现补 pluginInventory + buildings + population。
      pluginInventory: normalizeS7PluginInventory(data.playerState?.pluginInventory),
      buildings: normalizeS7BuildingState(data.playerState?.buildings),
      population: normalizeS7Population(data.playerState?.population),
      // 块6余项：persist 须显式列全字段（6b-2 教训：漏列会落盘丢字段）——补 exclusiveShards + chests。
      exclusiveShards: normalizeS7ExclusiveShardInventory(data.playerState?.exclusiveShards),
      chests: normalizeS7ChestInventory(data.playerState?.chests),
      activityProgress: normalizeS7ActivityProgress(data.playerState?.activityProgress),
      unitLevels: normalizeS7UnitLevelState(data.playerState?.unitLevels),
      // 阶段一A：persist 须显式列全字段（6b-2 教训：漏列会落盘丢字段）——补 squad。
      squad: normalizeS7Squad(data.playerState?.squad),
      // 阶段一G2：补 mailbox。
      mailbox: normalizeS7Mailbox(data.playerState?.mailbox),
      // 阶段一C：补 gacha（抽卡三池状态）——显式列全，勿漏（6b-2 教训）。
      gacha: normalizeS7GachaState(data.playerState?.gacha),
    },
    lastOnlineTime: now,
  };
  adapter.setString(S7_SAVE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export interface S7RestoredState {
  playerState: S7PlayerState;
  lastOnlineTime: number;
}

/** 从 S7 存档数据取出可直接交给后续 S7 模块使用的关键状态集合（规范化后的 资源 + 时间戳）。 */
export function restoreS7KeyState(data: S7SaveData): S7RestoredState {
  return {
    playerState: normalizeS7PlayerState(data.playerState),
    lastOnlineTime: data.lastOnlineTime,
  };
}
