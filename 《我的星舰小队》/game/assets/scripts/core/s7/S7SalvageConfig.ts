// 信标打捞配置（步5 收尾批回写·纯 TS，不依赖 cc）：v1.0 §10.2「打捞与信标」。
// 数值终值 = 初值表 v0.7 §6 打捞表（机器真源 PARAMS.salvage/TRUTHS.salvageTimeMult·照抄不调数）：
//   - 必得：星矿/星贝/通用碎片 ×时长档倍率（h2=1/h8=2.2/h24=3.8·每小时效率递减）；
//     固定干货（稀有=核碎 0.25/史诗=核碎 0.5+宝石 0.5·期望值口径→运行时按概率掷整数件）。
//   - 概率发现分两线（细案④⑤）：**经济线**（通碎/信标/核碎/宝石）吃基础掷骰数；
//     **惊喜线**（插件/居民/工人/星辉货舱）另吃稀有发现加成（+5%/级顶+35%）+ Lv10 24h 额外一骰。
//   - 掷骰数按时长档取表（h2/h8/h24 非线性·旧 baseRolls+perHour 线性口径作废）。
//   - **长趟守恒刀**：24h 趟全部产出 ×0.72（队数 3/4/5 只给排面不给增量·细案④·选型记档初值表 §15）。
//   - 每类发现"期望值→抽签"口径：单趟每类发现期望 = 掷骰数×单骰期望 ≤1（全表实测），
//     按 floor+小数概率补一件 采样 → 期望精确=尺子、且天然满足"单次≤1"（Ron 2026-06-20 护栏）。
// 经济护栏(§10.2)：完整星核不进打捞；完整星舰=C阶（本表已无该项·高稀有走信标档分层）；
//   居民/工人/星辉货舱/各品质插件「单次≤1」（见上·采样天然满足）。

/** 信标档。 */
export type S7BeaconTier = 'common' | 'rare' | 'epic';
/** 信标档 → 钱包货币键（消耗一张该档信标开打）。 */
export const BEACON_RESOURCE: Record<S7BeaconTier, string> = {
  common: 'beaconCommon', rare: 'beaconRare', epic: 'beaconEpic',
};

/** 时长档键（2h/8h/24h）。 */
export type S7SalvageDurKey = 'h2' | 'h8' | 'h24';
export const SALVAGE_DUR_HOURS: Record<S7SalvageDurKey, number> = { h2: 2, h8: 8, h24: 24 };
export function salvageDurKeyOf(hours: number): S7SalvageDurKey | null {
  return hours === 2 ? 'h2' : hours === 8 ? 'h8' : hours === 24 ? 'h24' : null;
}

/** 一条打捞奖励（收菜产出·manifest）。 */
export type S7SalvageReward =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'plugin'; quality: 'fine' | 'superior' | 'legendary' } // 插件（品质·应用侧挑 pluginId 入库）
  | { kind: 'chest'; chestId: string; amount: number }            // 星辉货舱
  | { kind: 'population'; pop: 'resident' | 'worker'; amount: number };

/** 一档信标的产出定义（v0.7 尺子同构）。 */
export interface S7BeaconTierDef {
  /** 必得软货币/通碎（2h 基线量·×时长档倍率）。 */
  ore: number;
  cargo: number;
  universal: number;
  /** 固定干货（每趟期望值·不吃时长倍率·吃守恒刀；掷整数件）。 */
  fixed: Partial<Record<'coreFrag' | 'starGem', number>>;
  /** 掷骰数按时长档（经济线基数；惊喜线在此之上加成）。 */
  rolls: Record<S7SalvageDurKey, number>;
  /** 经济线单骰期望（通碎/信标/核碎/宝石）。 */
  econEV: Partial<Record<'universal' | 'beaconCommon' | 'beaconRare' | 'beaconEpic' | 'coreFrag' | 'starGem', number>>;
  /** 惊喜线单骰期望（插件/居民/工人/货舱·吃稀有发现加成）。 */
  surpriseEV: Partial<Record<'finePlugin' | 'superiorPlugin' | 'legendaryPlugin' | 'resident' | 'worker' | 'cargoChest', number>>;
}

export interface S7SalvageConfig {
  /** 时长档倍率（每小时效率递减：h8=2.2 非 4×、h24=3.8 非 12×）。 */
  timeMult: Record<S7SalvageDurKey, number>;
  /** 长趟守恒刀：只落 24h 趟的全产出乘数（细案④队数 3/4/5 守恒）。 */
  yieldScale: number;
  yieldScaleDur: S7SalvageDurKey;
  tiers: Record<S7BeaconTier, S7BeaconTierDef>;
  /** 打捞加速券（商人星贝购·把一趟 2h 短趟产出升到 8h 档）——购买 UI 归灰盒批·价先落。 */
  accelPriceStarCargo: number;
}

// ===== 默认配置（v0.7 校准终值·照抄机器真源）=====

export const DEFAULT_S7_SALVAGE_CONFIG: S7SalvageConfig = {
  timeMult: { h2: 1, h8: 2.2, h24: 3.8 },
  yieldScale: 0.72,
  yieldScaleDur: 'h24',
  tiers: {
    common: {
      ore: 30, cargo: 14, universal: 1.5, fixed: {},
      rolls: { h2: 1.6, h8: 3.8, h24: 8.2 },
      econEV: { universal: 0.5, beaconCommon: 0.16, coreFrag: 0.004 },
      surpriseEV: { finePlugin: 0.05, resident: 0.02, worker: 0.02, cargoChest: 0.01 },
    },
    rare: {
      ore: 70, cargo: 38, universal: 2.5, fixed: { coreFrag: 0.25 },
      rolls: { h2: 2.6, h8: 5.0, h24: 10.4 },
      econEV: { universal: 0.8, beaconRare: 0.05, coreFrag: 0.008, starGem: 0.015 },
      surpriseEV: { superiorPlugin: 0.05, resident: 0.03, worker: 0.03, cargoChest: 0.015 },
    },
    epic: {
      ore: 160, cargo: 95, universal: 4, fixed: { coreFrag: 0.5, starGem: 0.5 },
      rolls: { h2: 3.8, h8: 7.0, h24: 12.6 },
      econEV: { universal: 1.2, beaconEpic: 0.05, coreFrag: 0.012, starGem: 0.05 },
      surpriseEV: { superiorPlugin: 0.07, legendaryPlugin: 0.035, resident: 0.04, worker: 0.04, cargoChest: 0.02 },
    },
  },
  accelPriceStarCargo: 150,
};

/** 通用碎片两种键（舰/员）——通碎产出随机其一（§10.2）。 */
export const UNIVERSAL_SHARD_KEYS = ['shipBlueprint', 'pilotShardUniversal'] as const;
