// 巡逻收益（步5 收尾批回写·纯 TS，不依赖 cc）：GDD-v2.0 S10.10「已通关星域自动巡逻」。
// 定位：墙期/日常的小额战斗养成资源补充（合金/驾驶记录/星贝），与离线产出（星矿为主）侧重不同。
// 口径：按"离开时长"累积（与离线产出同口径：在线不攒、回来才算）；确定可复算（纯函数）。
// 速率 = 基础产率 × 星域系数 ×（1 + 派驻加成）；上限 = 与离线一致（居住舱存储小时 + 居民延长）。
// 前置：clearedStarfieldTier=0（未通关任何星域）→ 零巡逻（没有可巡逻的星域）。
// 数值终值 = 初值表 v0.7（机器真源 PARAMS.patrol·B1 底垫身份 ×0.8 档：14→11.2/9→7.2·星贝 4 不动）。
// 派驻制（S10.10）：每艘"超出上阵 5 舰的闲置舰"+4%、计数上限 10 艘（+40% 顶）——
//   派驻 UI/接线归工程灰盒批（2026-07-09 普查钉），本模块经 dockedShips 入参吃数、缺省 0。

import { offlineStorageHours } from './S7BuildingEffects';
import { starfieldCoefficient } from './S7OfflineProduction';

/** 巡逻产出的软货币键（S10.10：合金/驾驶记录/星贝——刻意与离线的"星矿为主"错开侧重）。 */
export type S7PatrolResourceKey = 'hullAlloy' | 'pilotToken' | 'starCargo';

/** 基础产率（每小时，星域系数 ×1.0 时）。v0.7 校准终值。 */
export const PATROL_BASE_RATE_PER_HOUR: Record<S7PatrolResourceKey, number> = {
  hullAlloy: 11.2,
  pilotToken: 7.2,
  starCargo: 4,
};

/** 派驻加成：+4%/艘（超出上阵 5 舰的闲置舰）·计数上限 10 艘（机器真源 patrolDockPctPerShip/patrolDockMax）。 */
export const PATROL_DOCK_PCT_PER_SHIP = 4;
export const PATROL_DOCK_MAX_SHIPS = 10;

/** 派驻加成乘数（dockedShips=派驻闲置舰数·缺省 0）。 */
export function patrolDockMult(dockedShips: number): number {
  const n = Math.min(PATROL_DOCK_MAX_SHIPS, Math.max(0, Math.floor(Number.isFinite(dockedShips) ? dockedShips : 0)));
  return 1 + (n * PATROL_DOCK_PCT_PER_SHIP) / 100;
}

export interface S7PatrolParams {
  /** 已通关最高星域档（0-6）；0 = 无可巡逻星域 → 零产出。 */
  clearedStarfieldTier: number;
  /** 居住舱等级（决定存储上限时长，与离线共用口径）。未解锁=0 → 上限 0 → 无巡逻。 */
  habitatLevel: number;
  /** 额外存储延长（小时，居民注入；默认 0）。 */
  extraStorageHours?: number;
  /** 派驻闲置舰数（灰盒批接线前缺省 0=无派驻加成）。 */
  dockedShips?: number;
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
 * 每币种进账 = floor( 基础产率 × 星域系数 × 派驻乘数 × 有效秒数 / 3600 )；星域档 0 → 全零。
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
    const coef = starfieldCoefficient(tier) * patrolDockMult(params.dockedShips ?? 0);
    for (const key of PATROL_KEYS) {
      gains[key] = Math.floor((PATROL_BASE_RATE_PER_HOUR[key] * coef * effectiveSeconds) / 3600);
    }
  }
  const hasGains = PATROL_KEYS.some((k) => gains[k] > 0);
  return { gains, effectiveSeconds, capSeconds, overflowed: elapsed > capSeconds, hasGains };
}
