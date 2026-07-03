// 巡逻收益（第2.5块·块1，纯 TS，不依赖 cc）：GDD-v2.0 S10.10「已通关星域自动巡逻」。
// 定位：墙期/日常的小额战斗养成资源补充（合金/驾驶记录/星贝），与离线产出（星矿为主）侧重不同；
//   两渠道在阶段三数值校准时合并进毕业预算（GDD §3 经济循环体检）。
// 口径：按"离开时长"累积（与离线产出同口径：在线不攒、回来才算）；确定可复算（纯函数）。
// 速率 = 基础产率 × 星域系数（复用离线的 starfieldCoefficient，主线进度永久乘区）；
//   护栏：基础产率刻意压低（≈离线同币种 25%），对齐"委托+巡逻 ≤ 离线 ~50%"体检约束。
// 上限 = 与离线产出一致的时长口径（居住舱存储小时 + 居民延长）——"你不在时星港帮你留"同一主题。
// 前置：clearedStarfieldTier=0（未通关任何星域）→ 零巡逻（没有可巡逻的星域）。
// 数值全 v0.1 占位，阶段三数值校准统一精校。

import { offlineStorageHours } from './S7BuildingEffects';
import { starfieldCoefficient } from './S7OfflineProduction';

/** 巡逻产出的软货币键（S10.10：合金/驾驶记录/星贝——刻意与离线的"星矿为主"错开侧重）。 */
export type S7PatrolResourceKey = 'hullAlloy' | 'pilotToken' | 'starCargo';

/** 基础产率（每小时，星域系数 ×1.0 时）。v0.1 占位：≈离线同币种 25%（合金 30 vs 离线 120）。 */
export const PATROL_BASE_RATE_PER_HOUR: Record<S7PatrolResourceKey, number> = {
  hullAlloy: 30,
  pilotToken: 20,
  starCargo: 8,
};

export interface S7PatrolParams {
  /** 已通关最高星域档（0-4）；0 = 无可巡逻星域 → 零产出。 */
  clearedStarfieldTier: number;
  /** 居住舱等级（决定存储上限时长，与离线共用口径）。未解锁=0 → 上限 0 → 无巡逻。 */
  habitatLevel: number;
  /** 额外存储延长（小时，居民注入；默认 0）。 */
  extraStorageHours?: number;
}

export interface S7PatrolResult {
  /** 各币种进账（向下取整）。 */
  gains: Record<S7PatrolResourceKey, number>;
  /** 实际计入秒数（被上限截断后）。 */
  effectiveSeconds: number;
  /** 存储上限对应秒数。 */
  capSeconds: number;
  /** 是否撞上限（离开过久 → 溢出浪费，与离线同规则）。 */
  overflowed: boolean;
  /** 任一币种 > 0。 */
  hasGains: boolean;
}

const PATROL_KEYS: S7PatrolResourceKey[] = ['hullAlloy', 'pilotToken', 'starCargo'];

/**
 * 计算巡逻进账（纯函数、确定可复算）。
 * elapsedSeconds 为"离开秒数"（负/非有限按 0）；上限 = (居住舱存储 + 居民延长) 小时。
 * 每币种进账 = floor( 基础产率 × 星域系数 × 有效秒数 / 3600 )；星域档 0 → 全零。
 */
export function computePatrolGains(elapsedSeconds: number, params: S7PatrolParams): S7PatrolResult {
  const elapsed = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const capHours = offlineStorageHours(params.habitatLevel) + Math.max(0, params.extraStorageHours ?? 0);
  const capSeconds = capHours * 3600;
  const effectiveSeconds = Math.min(elapsed, capSeconds);
  const tier = Number.isFinite(params.clearedStarfieldTier) && params.clearedStarfieldTier > 0
    ? Math.floor(params.clearedStarfieldTier) : 0;

  const gains: Record<S7PatrolResourceKey, number> = { hullAlloy: 0, pilotToken: 0, starCargo: 0 };
  if (tier >= 1) {
    const coef = starfieldCoefficient(tier);
    for (const key of PATROL_KEYS) {
      gains[key] = Math.floor((PATROL_BASE_RATE_PER_HOUR[key] * coef * effectiveSeconds) / 3600);
    }
  }
  const hasGains = PATROL_KEYS.some((k) => gains[k] > 0);
  return { gains, effectiveSeconds, capSeconds, overflowed: elapsed > capSeconds, hasGains };
}
