import { PlayerEquipmentState, createDefaultEquipmentState } from './EquipmentService';
import { MiningStationState, createDefaultMiningStationState } from './MiningStationService';
import { DailyGoalsState, createDefaultDailyGoalsState } from './DailyGoalService';

export interface PlayerResources {
  starCoin: number;
  expChip: number;
  equipmentPart: number;
  baseEnergy: number;
}

export interface PlayerState {
  resources: PlayerResources;
  /** 角色等级，key 为 heroId，未出现的角色视为 1 级。 */
  heroLevels: Record<string, number>;
  /** 已通关的关卡 id 列表（用于防重复结算与进度展示）。 */
  clearedLevelIds: string[];
  /** 已确认发放的奖励流水 id 列表（与 RewardLedger 的 flowId 对应）。 */
  claimedRewardFlowIds: string[];
  /** 装备状态（C17）：拥有的装备仓库 + 各英雄四部位穿戴槽。 */
  equipments: PlayerEquipmentState;
  /** 采矿站状态（C19）：按时间持续产出资源，独立于 C11 离线收益。 */
  miningStation: MiningStationState;
  /** 角色碎片累计（C20）：key 为 heroId，value 为累计碎片数（未出现视为 0）。 */
  heroFragments: Record<string, number>;
  /** 已拥有角色 id（C20）：唯一持久化真源，碎片合成（C20b）写入；默认空。 */
  ownedHeroIds: string[];
  /** 当前上阵英雄 id（S5C-01）：唯一持久化真源，随存档跨会话保留；默认空，新档由 AppContext 按默认上阵规则补齐。 */
  onFieldHeroIds: string[];
  /** 普通补给抽取单调计数器（C20）：作为领取防重的序号源。 */
  supplyDrawCount: number;
  /** 碎片合成单调计数器（C20，预留给 C20b）：作为合成防重的序号源。 */
  craftCount: number;
  /** 1-3 日新手目标状态（C21）：进度/已领取/起算锚点，不跨天清零。 */
  dailyGoals: DailyGoalsState;
}

export function createInitialPlayerState(): PlayerState {
  return {
    resources: { starCoin: 0, expChip: 0, equipmentPart: 0, baseEnergy: 0 },
    heroLevels: {},
    clearedLevelIds: [],
    claimedRewardFlowIds: [],
    equipments: createDefaultEquipmentState(),
    miningStation: createDefaultMiningStationState(),
    heroFragments: {},
    ownedHeroIds: [],
    onFieldHeroIds: [],
    supplyDrawCount: 0,
    craftCount: 0,
    dailyGoals: createDefaultDailyGoalsState(),
  };
}

/** 新玩家初始拥有英雄（S5C-01 设计冻结，Ron 已确认）。 */
export const INITIAL_OWNED_HERO_IDS: readonly string[] = ['hero_isen', 'hero_mia'];

/** 新玩家默认上阵英雄（S5C-01 设计冻结，Ron 已确认）。 */
export const DEFAULT_ON_FIELD_HERO_IDS: readonly string[] = ['hero_isen', 'hero_mia'];

/**
 * 把任意来源（含历史脏存档/异常运行时值）的阵容字段规范化为 string[]（S5D-02 自愈，TD-003 关联）：
 * 非数组一律视为空数组；数组中混入的非字符串/空字符串元素（如误存的 Set/object）逐个剔除。
 * 规范化结果可能为空数组——是否回填默认阵容由调用方按各自的"真源为空才 seed"语义决定
 * （SaveService 迁移路径回填 DEFAULT_ON_FIELD_HERO_IDS；AppContext 按 seed 规则回填）。
 */
export function normalizeHeroIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * 保证上阵英雄必在拥有列表中（S5C-01 不变量）：缺失的上阵英雄补入 ownedHeroIds，不移除任何既有拥有。
 * 旧档迁移（v6->v7 回填默认上阵）后调用，避免出现"上阵了未拥有英雄"的脏阵容。
 */
export function ensureOnFieldHeroesOwned(state: PlayerState): void {
  for (const heroId of state.onFieldHeroIds) {
    if (!state.ownedHeroIds.includes(heroId)) {
      state.ownedHeroIds.push(heroId);
    }
  }
}

export function getHeroLevel(state: PlayerState, heroId: string): number {
  return state.heroLevels[heroId] ?? 1;
}

export interface UpgradeCost {
  starCoin: number;
  expChip: number;
}

/**
 * 升级消耗曲线锚点（S5C-05 数值初稿，《S5C-05 数值初稿与试玩验收草案》§3.2）：
 * 分段曲线替换原 `100/20 * currentLevel` 线性占位。
 *   currentLevel <= 3: starCoin = 60 + 40*(lv-1), expChip = 12 + 8*(lv-1)
 *   currentLevel >  3: starCoin = 140 + 60*(lv-3), expChip = 28 + 12*(lv-3)
 * 对照表（升到下一级消耗）：lv1→60/12, lv2→100/20, lv3→140/28, lv4→200/40, lv5→260/52, lv6→320/64。
 * `costFn` 可注入覆盖以便测试/调参；保留 DEFAULT_UPGRADE_COST_PER_LEVEL 供向后兼容（不再用于默认曲线）。
 */
export const DEFAULT_UPGRADE_COST_PER_LEVEL: UpgradeCost = { starCoin: 100, expChip: 20 };

export function computeUpgradeCost(currentLevel: number): UpgradeCost {
  // 等级下限按 1 处理（防御性：currentLevel<1 时按 1 级消耗）。
  const lv = Math.max(1, currentLevel);
  if (lv <= 3) {
    return { starCoin: 60 + 40 * (lv - 1), expChip: 12 + 8 * (lv - 1) };
  }
  return { starCoin: 140 + 60 * (lv - 3), expChip: 28 + 12 * (lv - 3) };
}

export interface UpgradeResult {
  ok: boolean;
  error?: string;
  fromLevel?: number;
  toLevel?: number;
  cost?: UpgradeCost;
}

/**
 * 角色升级：消耗星币/经验芯片，等级 +1。资源不足时拒绝并返回原因，不扣减资源。
 */
export function upgradeHero(
  state: PlayerState,
  heroId: string,
  costFn: (currentLevel: number) => UpgradeCost = computeUpgradeCost,
): UpgradeResult {
  const currentLevel = getHeroLevel(state, heroId);
  const cost = costFn(currentLevel);

  if (state.resources.starCoin < cost.starCoin || state.resources.expChip < cost.expChip) {
    return {
      ok: false,
      error: `资源不足：需要 ${cost.starCoin} 星币 / ${cost.expChip} 经验芯片`,
      fromLevel: currentLevel,
      cost,
    };
  }

  state.resources.starCoin -= cost.starCoin;
  state.resources.expChip -= cost.expChip;
  state.heroLevels[heroId] = currentLevel + 1;

  return { ok: true, fromLevel: currentLevel, toLevel: currentLevel + 1, cost };
}
