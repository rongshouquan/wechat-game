// 信标打捞配置（阶段一 D-step1，纯 TS，不依赖 cc）：v1.0 §10.2「打捞与信标」。
//
// ⚠️ 全表 v0.1 占位（Ron 已授权 Claude 定灰盒占位·第二块「打捞产出表+碎片经济」统一校准）：
//   - 三档信标(普通/稀有/史诗) = 必得保底干货 + 概率发现分层；通用碎片每档保底 1 种(舰/员随机其一)。
//   - 时间档 2h/8h/24h·收益随时长递增但每小时效率递减(decayWeight)；广告加速按档固定减时·每日上限。
//   - 经济护栏(§10.2)：完整星核不进打捞(只给星核碎片)；完整星舰=C阶(重复折专属碎片)；
//     居民/工人/星辉货舱/传奇插件「单次≤1」；高稀有只在高档概率层、不保底。
//   - 现以 TS 常量承载(引擎吃 config·解耦可测)；第二块再决定是否迁进正式 config-resource。

/** 信标档。 */
export type S7BeaconTier = 'common' | 'rare' | 'epic';
/** 信标档 → 钱包货币键（消耗一张该档信标开打）。 */
export const BEACON_RESOURCE: Record<S7BeaconTier, string> = {
  common: 'beaconCommon', rare: 'beaconRare', epic: 'beaconEpic',
};

/** 一条打捞奖励（收菜产出·manifest）。完整星舰/插件等的"已拥有则折碎片"在应用侧按 squad 判（见 S7SalvageService）。 */
export type S7SalvageReward =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'ship_body'; shipId: string }                         // 完整星舰 C 阶（应用侧：已拥有→折该船专属碎片）
  | { kind: 'plugin'; quality: 'fine' | 'superior' | 'legendary' } // 插件（品质·对齐 S7PluginQuality·应用侧挑 pluginId 入库）
  | { kind: 'chest'; chestId: string; amount: number }            // 星辉货舱
  | { kind: 'population'; pop: 'resident' | 'worker'; amount: number };

/** 概率发现项：一个奖励模板 + 权重 + 是否「单次≤1」。 */
export interface S7DiscoveryEntry {
  reward: S7SalvageReward;
  weight: number;
  /** 单次≤1（居民/工人/星辉货舱/传奇插件/完整星舰等·一次收菜最多出 1 个）。 */
  cap1?: boolean;
}

/** 一档信标的产出定义。 */
export interface S7BeaconTierDef {
  /** 必得软货币（2h 基线量·随时长 decay 放大）。 */
  baseStarOre: number;
  baseStarCargo: number;
  /** 必得通用碎片量（每档保底 1 种·舰/员随机其一·2h 基线·随时长放大）。 */
  universalShardBase: number;
  /** 额外必得干货（稀有/史诗才有；普通为空）。 */
  guaranteedExtra: S7SalvageReward[];
  /** 概率发现：掷骰次数 = baseRolls + perHour×小时数（向下取整）。 */
  baseRolls: number;
  perHourRolls: number;
  /** 概率发现奖励表（加权）。 */
  discovery: S7DiscoveryEntry[];
}

export interface S7SalvageConfig {
  /** 时间档（小时）+ 软货币/碎片随时长的放大系数（递减：8h<4×2h、24h<3×8h）。 */
  timeTiers: { hours: number; yieldMult: number }[];
  tiers: Record<S7BeaconTier, S7BeaconTierDef>;
  /** 广告加速：每日次数上限(基础/打捞港高级) + 高级阈值 + 各时长档固定减时(分钟)。 */
  adSpeedup: { dailyLimitBase: number; dailyLimitHigh: number; highLevelAt: number; reduceMinutesByHours: Record<number, number> };
}

// ===== 默认配置（v0.1 占位探针·刻意好测/好演示·第二块校准）=====

const R = (resourceId: string, amount: number): S7SalvageReward => ({ kind: 'resource', resourceId, amount });

export const DEFAULT_S7_SALVAGE_CONFIG: S7SalvageConfig = {
  // 2h 基线 1×；8h≈2.8×（非 4×·递减）；24h≈6×（非 12×·递减）。
  timeTiers: [
    { hours: 2, yieldMult: 1 },
    { hours: 8, yieldMult: 2.8 },
    { hours: 24, yieldMult: 6 },
  ],
  tiers: {
    common: {
      baseStarOre: 100, baseStarCargo: 30, universalShardBase: 4,
      guaranteedExtra: [],
      baseRolls: 1, perHourRolls: 0.3,
      discovery: [
        { reward: { kind: 'plugin', quality: 'fine' }, weight: 30 },
        { reward: R('shipBlueprint', 3), weight: 25 },   // 另 1 种通用碎片（舰）
        { reward: R('pilotShardUniversal', 3), weight: 25 }, // 另 1 种通用碎片（员）
        { reward: R('supplyTicket', 2), weight: 20 },
        { reward: R('beaconCommon', 1), weight: 18 },
        { reward: R('coreFrag', 2), weight: 6 },                 // 极低：星核碎片少量
        { reward: { kind: 'population', pop: 'resident', amount: 1 }, weight: 3, cap1: true }, // 极低
        { reward: { kind: 'population', pop: 'worker', amount: 1 }, weight: 3, cap1: true },
        { reward: { kind: 'chest', chestId: 'starlightCargo', amount: 1 }, weight: 2, cap1: true }, // 极低：星辉货舱
      ],
    },
    rare: {
      baseStarOre: 260, baseStarCargo: 90, universalShardBase: 8,
      guaranteedExtra: [R('coreFrag', 5)], // 稀有保底 1 份稀有干货（星核碎片/优秀插件随一→占位给星核碎片）
      baseRolls: 2, perHourRolls: 0.35,
      discovery: [
        { reward: { kind: 'plugin', quality: 'superior' }, weight: 28 },
        { reward: R('shipBlueprint', 6), weight: 22 },
        { reward: R('pilotShardUniversal', 6), weight: 22 },
        { reward: R('coreFrag', 6), weight: 18 },
        { reward: R('beaconRare', 1), weight: 12 },
        { reward: { kind: 'population', pop: 'resident', amount: 1 }, weight: 5, cap1: true },
        { reward: { kind: 'population', pop: 'worker', amount: 1 }, weight: 5, cap1: true },
        { reward: { kind: 'chest', chestId: 'starlightCargo', amount: 1 }, weight: 4, cap1: true },
        { reward: { kind: 'ship_body', shipId: 'shp08' }, weight: 2, cap1: true }, // 极低：完整星舰 C 阶（占位指定一艘）
        { reward: R('starGem', 2), weight: 2 },                   // 极低：星空宝石
      ],
    },
    epic: {
      baseStarOre: 600, baseStarCargo: 220, universalShardBase: 16,
      guaranteedExtra: [R('coreFrag', 10), R('starGem', 5)], // 史诗保底：星核碎片小笔 + 星空宝石小笔
      baseRolls: 3, perHourRolls: 0.4,
      discovery: [
        { reward: { kind: 'plugin', quality: 'legendary' }, weight: 14, cap1: true }, // 传奇仅史诗·单次≤1
        { reward: { kind: 'plugin', quality: 'superior' }, weight: 20 },
        { reward: R('shipBlueprint', 12), weight: 18 },
        { reward: R('pilotShardUniversal', 12), weight: 18 },
        { reward: R('coreFrag', 12), weight: 16 },
        { reward: R('starGem', 5), weight: 12 },
        { reward: R('beaconEpic', 1), weight: 8 },
        { reward: { kind: 'population', pop: 'resident', amount: 1 }, weight: 8, cap1: true },
        { reward: { kind: 'population', pop: 'worker', amount: 1 }, weight: 8, cap1: true },
        { reward: { kind: 'chest', chestId: 'starlightCargo', amount: 1 }, weight: 7, cap1: true },
        { reward: { kind: 'ship_body', shipId: 'shp09' }, weight: 4, cap1: true }, // 完整星舰 C 阶
      ],
    },
  },
  adSpeedup: {
    dailyLimitBase: 3, dailyLimitHigh: 5, highLevelAt: 4, // 打捞港 lv≥4 → 每日 5 次
    reduceMinutesByHours: { 2: 30, 8: 120, 24: 360 },     // 2h档减30min / 8h减2h / 24h减6h（按档固定·§10.2）
  },
};

/** 通用碎片两种键（舰/员）——必得 1 种随机其一（§10.2）。 */
export const UNIVERSAL_SHARD_KEYS = ['shipBlueprint', 'pilotShardUniversal'] as const;
