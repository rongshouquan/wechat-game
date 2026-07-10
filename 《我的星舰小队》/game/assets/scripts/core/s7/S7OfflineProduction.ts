// 离线产出（步5 收尾批回写·纯 TS，不依赖 cc）：v1.0 §7「基地被动产出软货币、离线累积、上限由居住舱定」+ §12.5「离线收益 = 纯函数(经过秒数, 状态)，确定可复算」。
// 产出速率 = 基础产率 × 星域系数(随已通关最高星域提升，主线进度永久乘区) × (1 + 居住舱产率加成 + 居民加成)。
//   星矿的星域乘区用开方衰减（coef^0.5）：星矿=建筑币·十级封顶的有限 sink，全速乘区必然溢出成死水
//   （初值表 v0.7 §6 oreCoefPow·步3 清淤 A1 落点）。
// 上限 = 居住舱存储上限(小时) + 额外延长(居民)；攒满即停、溢出浪费（v1.0 §16）。
// 数值终值 = 初值表 v0.7（机器真源 PARAMS.offline/regionCoef·B1 底垫身份：合金/记录 ×0.8 档）。

import { offlineStorageHours, offlineRateBonusPct } from './S7BuildingEffects';

/** 离线产出的软货币键（v1.0 §7：星矿 / 星舰合金 / 驾驶记录）。 */
export type S7OfflineResourceKey = 'starOre' | 'hullAlloy' | 'pilotToken';

/** 基础产率（每小时，星域系数 ×1.0、无加成时）。v0.7 校准终值（星矿 62=步3 减产·合金 24/记录 16=B1 底垫 ×0.8）。 */
export const OFFLINE_BASE_RATE_PER_HOUR: Record<S7OfflineResourceKey, number> = {
  starOre: 62,
  hullAlloy: 24,
  pilotToken: 16,
};

/** 星矿的星域乘区衰减指数（星矿走 coef^0.5·合金/记录全系数）。 */
export const ORE_COEF_POW = 0.5;

/** 星域系数表（下标=已通关星域数 0-6·七档）：v0.7 校准终值（离线/巡逻/悬赏共用进度乘区；主线奖励按关所在星域取 [sf-1]）。 */
export const STARFIELD_COEF_TABLE = [1.0, 1.7, 2.7, 4.0, 5.8, 8.2, 10.5];

/** 星域系数（clearedStarfieldTier：S7MainlineModel.clearedStarfieldTier 的结果，0-6；越界向下夹）。 */
export function starfieldCoefficient(clearedStarfieldTier: number): number {
  const t = Number.isFinite(clearedStarfieldTier) && clearedStarfieldTier > 0 ? Math.floor(clearedStarfieldTier) : 0;
  return STARFIELD_COEF_TABLE[Math.min(t, STARFIELD_COEF_TABLE.length - 1)];
}

export interface S7OfflineParams {
  /** 居住舱等级（决定存储上限 + 自带产率加成）。未解锁=0 → 上限 0 → 无离线。 */
  habitatLevel: number;
  /** 已通关最高星域档（主线进度，0-4）。 */
  clearedStarfieldTier: number;
  /** 额外产率加成%（居民等，6b-4b 注入；默认 0）。 */
  extraRateBonusPct?: number;
  /** 额外存储延长（小时，居民等，6b-4b 注入；默认 0）。 */
  extraStorageHours?: number;
}

export interface S7OfflineResult {
  /** 各软货币的进账（向下取整）。 */
  gains: Record<S7OfflineResourceKey, number>;
  /** 实际计入的秒数（被上限截断后）。 */
  effectiveSeconds: number;
  /** 存储上限对应的秒数。 */
  capSeconds: number;
  /** 是否撞上限（离线过久 → 溢出浪费）。 */
  overflowed: boolean;
}

const OFFLINE_KEYS: S7OfflineResourceKey[] = ['starOre', 'hullAlloy', 'pilotToken'];

/**
 * 计算离线进账（纯函数、确定可复算）。
 * elapsedSeconds 取边界算好的离线秒数（负数/非有限按 0）。上限 = (居住舱存储 + 额外延长) 小时。
 * 每币种进账 = floor( 基础产率 × 星域系数 × (1 + (居住舱加成% + 额外加成%)/100) × 有效秒数 / 3600 )；
 * 星矿的星域系数取 coef^0.5（开方衰减·v0.7）。
 */
export function computeOfflineGains(elapsedSeconds: number, params: S7OfflineParams): S7OfflineResult {
  const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const capHours = offlineStorageHours(params.habitatLevel) + Math.max(0, params.extraStorageHours ?? 0);
  const capSeconds = capHours * 3600;
  const effectiveSeconds = Math.min(elapsed, capSeconds);
  const coef = starfieldCoefficient(params.clearedStarfieldTier);
  const rateMult = 1 + (offlineRateBonusPct(params.habitatLevel) + Math.max(0, params.extraRateBonusPct ?? 0)) / 100;

  const gains = {} as Record<S7OfflineResourceKey, number>;
  for (const key of OFFLINE_KEYS) {
    const keyCoef = key === 'starOre' ? Math.pow(coef, ORE_COEF_POW) : coef;
    const perHour = OFFLINE_BASE_RATE_PER_HOUR[key] * keyCoef * rateMult;
    gains[key] = Math.floor((perHour * effectiveSeconds) / 3600);
  }
  return { gains, effectiveSeconds, capSeconds, overflowed: elapsed > capSeconds };
}
