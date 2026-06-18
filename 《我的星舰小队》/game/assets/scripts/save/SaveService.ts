/**
 * 本地存档持久化与生命周期（C08）。
 *
 * 范围：本地读写 / saveVersion / 迁移占位 / 启动加载 / 切后台保存 / 恢复 / 杀进程重进不丢关键状态。
 * 不接云存档（云存档接口预留属阶段4），不实现真实迁移逻辑（仅占位钩子）。
 *
 * 关键状态覆盖：资源、英雄等级、已通关关卡、RewardLedger 奖励流水、最后在线时间。
 * 时间来源遵循《存档与防重规格》——本服务接收外部传入的 now()，由调用方决定服务器时间优先/本地时间兜底的取值策略，
 * 本服务自身不直接读取系统时间，避免核心逻辑耦合具体时间来源实现。
 */
import {
  PlayerState,
  createInitialPlayerState,
  ensureOnFieldHeroesOwned,
  normalizeHeroIdList,
  DEFAULT_ON_FIELD_HERO_IDS,
} from '../core/PlayerState';
import { createDefaultEquipmentState } from '../core/EquipmentService';
import { createDefaultMiningStationState } from '../core/MiningStationService';
import { createDefaultDailyGoalsState } from '../core/DailyGoalService';
import { RewardLedger, RewardFlowEntry, createRewardLedger } from '../core/RewardLedger';
import type { AdFrequencyState } from '../ads/AdFrequencyService';
import type { DefeatSupplyState } from '../core/DefeatSupplyService';
import { SaveStorageAdapter } from './SaveStorageAdapter';

/** 当前存档结构版本号。结构发生不兼容变更时必须递增，并在 migrateSaveData 中补充迁移步骤。 */
export const CURRENT_SAVE_VERSION = 7;

export const SAVE_STORAGE_KEY = 'starship_squad_save_v1';

/** 默认（空）广告限频持久化状态：无每日计数、无冷却起点。会话次数不在此结构内（内存态）。 */
export function createDefaultAdFrequencyState(): AdFrequencyState {
  return { slots: {} };
}

/** 默认（空）失败补给持久化状态：无任何 Boss 当日补给计数。 */
export function createDefaultDefeatSupplyState(): DefeatSupplyState {
  return { bosses: {} };
}

export interface SaveData {
  saveVersion: number;
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  /**
   * 广告限频每日次数 / 冷却起点（AdFrequencyService.getState()）。跨会话持久化。
   * 会话次数（sessionCount）按设计仍为内存态、每会话重置，不写入存档。
   */
  adFrequencyState: AdFrequencyState;
  /** 同 Boss 每日失败补给次数（DefeatSupplyService.getState()）。跨会话持久化。 */
  defeatSupplyState: DefeatSupplyState;
  /** 最后一次在线时间戳（毫秒），用于切后台/杀进程恢复及离线收益等后续功能计算离线时长。 */
  lastOnlineTime: number;
}

export function createDefaultSaveData(now: number): SaveData {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    playerState: createInitialPlayerState(),
    rewardLedger: createRewardLedger(),
    adFrequencyState: createDefaultAdFrequencyState(),
    defeatSupplyState: createDefaultDefeatSupplyState(),
    lastOnlineTime: now,
  };
}

/**
 * 存档迁移钩子。
 * 版本相同时直通；版本不同时记录日志并迁移到目标版本。
 * v1 -> v2（C17 装备四部位）：保留旧数据，对缺失 equipments 的 playerState 回填空装备状态。
 * v2 -> v3（C19 采矿站）：保留旧数据（含 equipments 回填），对缺失 miningStation 的 playerState
 * 回填默认采矿站状态 { unlocked: true, lastCollectTime: 0 }。lastCollectTime=0 为惰性锚定哨兵，
 * 使老玩家更新后首次启动锚定为当时 now，不会因"站点自存档创建起就在产"而瞬间领到一大笔。
 * v3 -> v4（C20a 普通补给）：保留旧数据（含 equipments / miningStation 回填），对缺失的
 * heroFragments / ownedHeroIds / supplyDrawCount / craftCount 回填默认值（{} / [] / 0 / 0）。
 * v4 -> v5（C21 1-3 日目标）：保留旧数据（含 C17/C19/C20 回填），对缺失的 dailyGoals 回填默认值
 * { startTime: 0, progress: {}, claimedGoalIds: [] }。
 * v5 -> v6（TD-005 广告计数持久化）：保留旧数据，对缺失的 adFrequencyState / defeatSupplyState 顶层字段
 * 回填空状态（{ slots: {} } / { bosses: {} }）。旧档无广告计数即等价于"尚未看过广告"，回填空状态语义一致、
 * 不会误判已达每日上限或冷却中；老玩家更新后首次启动从 0 次重新累计当日次数（符合预期，不重复发奖由 RewardLedger 防重保障）。
 * v6 -> v7（S5C-01 上阵阵容持久化）：对缺失 onFieldHeroIds 的 playerState 回填默认上阵
 * DEFAULT_ON_FIELD_HERO_IDS（Ron 已确认：hero_isen / hero_mia），并把上阵英雄补入 ownedHeroIds
 * 保证"上阵者必拥有"不变量（只补入、不移除既有拥有；既有真实存档经灰盒 seed 落盘后通常已含这两名英雄，补入为幂等兜底）。
 * 迁移仅回填缺失字段，不丢失 resources / claimedRewardFlowIds / heroLevels / clearedLevelIds 等既有字段。
 */
export function migrateSaveData(raw: SaveData, fromVersion: number, toVersion: number): { data: SaveData; migrated: boolean; log: string[] } {
  const log: string[] = [];
  if (fromVersion === toVersion) {
    return { data: raw, migrated: false, log };
  }

  log.push(`save_migration_placeholder from=${fromVersion} to=${toVersion}`);
  const playerState: PlayerState = {
    ...raw.playerState,
    equipments: raw.playerState?.equipments ?? createDefaultEquipmentState(),
    miningStation: raw.playerState?.miningStation ?? createDefaultMiningStationState(),
    heroFragments: raw.playerState?.heroFragments ?? {},
    ownedHeroIds: normalizeHeroIdList(raw.playerState?.ownedHeroIds),
    onFieldHeroIds:
      raw.playerState?.onFieldHeroIds === undefined
        ? [...DEFAULT_ON_FIELD_HERO_IDS]
        : normalizeHeroIdList(raw.playerState.onFieldHeroIds),
    supplyDrawCount: raw.playerState?.supplyDrawCount ?? 0,
    craftCount: raw.playerState?.craftCount ?? 0,
    dailyGoals: raw.playerState?.dailyGoals ?? createDefaultDailyGoalsState(),
  };
  ensureOnFieldHeroesOwned(playerState);
  return {
    data: {
      ...raw,
      saveVersion: toVersion,
      playerState,
      adFrequencyState: raw.adFrequencyState ?? createDefaultAdFrequencyState(),
      defeatSupplyState: raw.defeatSupplyState ?? createDefaultDefeatSupplyState(),
    },
    migrated: true,
    log,
  };
}

export interface LoadResult {
  data: SaveData;
  /** 本次加载是否为"无存档，使用初始默认存档"。 */
  isNew: boolean;
  /** 本次加载是否触发了迁移占位逻辑。 */
  migrated: boolean;
  /** 本次加载是否因存档损坏而回退到默认存档。 */
  corrupted: boolean;
  log: string[];
}

function isPlausibleSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SaveData>;
  return (
    typeof candidate.saveVersion === 'number' &&
    typeof candidate.lastOnlineTime === 'number' &&
    !!candidate.playerState &&
    typeof candidate.playerState === 'object' &&
    !!candidate.rewardLedger &&
    Array.isArray((candidate.rewardLedger as RewardLedger).entries)
  );
}

/**
 * 启动加载流程：
 * - 无存档 -> 初始化默认存档（isNew=true）
 * - 存档存在但解析失败/结构不完整（损坏）-> 回退默认存档（corrupted=true），并保留旧数据日志，不让玩家因为存档损坏卡死在启动流程
 * - 存档版本与当前版本不一致 -> 走迁移占位（migrated=true）
 * - 否则正常恢复
 */
export function loadSave(adapter: SaveStorageAdapter, now: number): LoadResult {
  const log: string[] = [];
  const raw = adapter.getString(SAVE_STORAGE_KEY);

  if (raw === null) {
    log.push('save_not_found_initializing_default');
    return { data: createDefaultSaveData(now), isNew: true, migrated: false, corrupted: false, log };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.push('save_corrupted_json_parse_failed_fallback_to_default');
    return { data: createDefaultSaveData(now), isNew: false, migrated: false, corrupted: true, log };
  }

  if (!isPlausibleSaveData(parsed)) {
    log.push('save_corrupted_invalid_shape_fallback_to_default');
    return { data: createDefaultSaveData(now), isNew: false, migrated: false, corrupted: true, log };
  }

  if (parsed.saveVersion !== CURRENT_SAVE_VERSION) {
    const migration = migrateSaveData(parsed, parsed.saveVersion, CURRENT_SAVE_VERSION);
    log.push(...migration.log);
    log.push('save_loaded_version_migrated');
    return { data: migration.data, isNew: false, migrated: migration.migrated, corrupted: false, log };
  }

  log.push('save_loaded_version_match');
  const normalizedPlayerState: PlayerState = {
    ...parsed.playerState,
    ownedHeroIds: normalizeHeroIdList(parsed.playerState?.ownedHeroIds),
    onFieldHeroIds: normalizeHeroIdList(parsed.playerState?.onFieldHeroIds),
  };
  return {
    data: { ...parsed, playerState: normalizedPlayerState },
    isNew: false,
    migrated: false,
    corrupted: false,
    log,
  };
}

/**
 * 持久化入口：把当前关键状态序列化落盘，并刷新 lastOnlineTime。
 * 调用方在「切后台」「杀进程前关键节点」「关键状态变更后」均应调用本函数。
 */
export function persistSave(adapter: SaveStorageAdapter, data: SaveData, now: number): SaveData {
  const next: SaveData = { ...data, saveVersion: CURRENT_SAVE_VERSION, lastOnlineTime: now };
  adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export interface RestoredState {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  /** 广告限频每日次数 / 冷却起点，用于 new AdFrequencyService(configs, state) 恢复。 */
  adFrequencyState: AdFrequencyState;
  /** 同 Boss 每日补给次数，用于 new DefeatSupplyService(adFlow, configs, { state }) 恢复。 */
  defeatSupplyState: DefeatSupplyState;
  lastOnlineTime: number;
}

/** 从存档数据中取出可直接交给战斗/结算/推荐目标等模块使用的关键状态集合。 */
export function restoreKeyState(data: SaveData): RestoredState {
  return {
    playerState: data.playerState,
    rewardLedger: data.rewardLedger,
    adFrequencyState: data.adFrequencyState ?? createDefaultAdFrequencyState(),
    defeatSupplyState: data.defeatSupplyState ?? createDefaultDefeatSupplyState(),
    lastOnlineTime: data.lastOnlineTime,
  };
}

/**
 * 把当前关键状态打包为可持久化的 SaveData。
 * `confirmedFlowIds` 用于把 RewardLedger 中已 confirmed 的流水 id 同步进 PlayerState.claimedRewardFlowIds，
 * 保持两份关键状态在落盘时的一致性（沿用 C07 既有的 RewardLedger / PlayerState 数据结构，不改动其逻辑）。
 */
export function buildSaveDataFromState(
  playerState: PlayerState,
  rewardLedger: RewardLedger,
  lastOnlineTime: number,
  adFrequencyState?: AdFrequencyState,
  defeatSupplyState?: DefeatSupplyState,
): SaveData {
  const confirmedFlowIds = rewardLedger.entries
    .filter((entry: RewardFlowEntry) => entry.status === 'confirmed')
    .map((entry: RewardFlowEntry) => entry.flowId);

  const mergedClaimedIds = Array.from(new Set([...playerState.claimedRewardFlowIds, ...confirmedFlowIds]));

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    playerState: { ...playerState, claimedRewardFlowIds: mergedClaimedIds },
    rewardLedger,
    adFrequencyState: adFrequencyState ?? createDefaultAdFrequencyState(),
    defeatSupplyState: defeatSupplyState ?? createDefaultDefeatSupplyState(),
    lastOnlineTime,
  };
}

/**
 * 生命周期入口：切后台时调用，立即落盘当前关键状态。
 * 命名对应微信侧 wx.onHide 钩子，便于在 Cocos 层直接绑定，无需额外包装。
 */
export function onAppHide(
  adapter: SaveStorageAdapter,
  playerState: PlayerState,
  rewardLedger: RewardLedger,
  now: number,
  adFrequencyState?: AdFrequencyState,
  defeatSupplyState?: DefeatSupplyState,
): SaveData {
  const data = buildSaveDataFromState(playerState, rewardLedger, now, adFrequencyState, defeatSupplyState);
  return persistSave(adapter, data, now);
}

/**
 * 生命周期入口：启动/切前台恢复时调用，加载并返回可直接使用的关键状态。
 * 命名对应微信侧 wx.onShow / 启动流程，便于在 Cocos 层直接绑定。
 */
export function onAppLaunchOrShow(adapter: SaveStorageAdapter, now: number): { restored: RestoredState; result: LoadResult } {
  const result = loadSave(adapter, now);
  return { restored: restoreKeyState(result.data), result };
}
