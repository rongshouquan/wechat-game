// 抽卡存档子状态（阶段一 C-step1，纯 TS，不依赖 cc）：v1.0 §10.1 抽卡三池的持久化载体。
//
// 存的是「跨会话要记住的抽卡进度」：三池各自的阶级地板保底计数 + 专属池兑换进度/已领箱数/当期专属标记。
//   轮换的「当天开哪 2 类 / 当期哪艘专属」是由时间(dayIndex)确定计算的，不存（见 S7GachaService）；
//   这里只存「检测专属轮换 + 结算忘领进度箱」所需的那点状态。
// 与 S7BuildingState / S7ExclusiveShardInventory 同构：本模块拥有形状 + createDefault/normalize；
//   S7SaveService 组合进 S7PlayerState（v12→v13 加性迁移）。配置解耦：不校验单位/池是否存在。

import { S7GachaPoolId } from './S7GachaConfig';

/** 三池各自的阶级地板保底计数（达 floorPityDraws 触发保底、命中后清零）。 */
export interface S7GachaPityState {
  recruit: number;
  refit: number;
  exclusive: number;
}

export interface S7GachaState {
  /** 三池 A 级保底计数（20 抽真概率保底·天然 A/保底 A 都清零=保底进度条读数）。 */
  pity: S7GachaPityState;
  /** 专属池当期累计抽数（每抽 +1；满阈值产出兑换箱）。 */
  exchangeProgress: number;
  /** 专属池当期已领取的兑换箱数（availableBoxes = floor(progress/阈值) - 已领）。 */
  exchangeClaimed: number;
  /** 当前已结算到的「专属轮换期号」(= floor(dayIndex/rotationDays))；-1 = 未初始化。 */
  exclusivePeriod: number;
  /** 当前期的专属舰 id（缓存·用于轮换补发结算 OLD 期专属）；null = 未初始化。 */
  exclusiveShipId: string | null;
  /** 免费抽记账日（s7DayKey·细案⑥补给站 Lv4/Lv7 每日免费抽）；0=未用过。 */
  freePullDayKey: number;
  /** 记账日当天已用的免费抽次数（跨天由调用方对比 dayKey 归零口径读取）。 */
  freePullsUsed: number;
}

export function createDefaultS7GachaState(): S7GachaState {
  return {
    pity: { recruit: 0, refit: 0, exclusive: 0 },
    exchangeProgress: 0,
    exchangeClaimed: 0,
    exclusivePeriod: -1,
    exclusiveShipId: null,
    freePullDayKey: 0,
    freePullsUsed: 0,
  };
}

/** 取非负整数（脏值/负/非整 → 0）。 */
function nonNegInt(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/**
 * 规范化（防脏档/篡改）：保底计数/兑换进度取非负整数；exclusivePeriod 取整数(允许 -1)；exclusiveShipId 取非空字符串否则 null。
 * 守护：exchangeClaimed 不超过 floor(progress/?) 无法在此判（阈值在 config），故只夹到 ≤ exchangeProgress（claimed 不可能超过抽数）。
 */
export function normalizeS7GachaState(raw: unknown): S7GachaState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pitySrc = (src.pity && typeof src.pity === 'object' ? src.pity : {}) as Record<string, unknown>;
  const out = createDefaultS7GachaState();
  out.pity = {
    recruit: nonNegInt(pitySrc.recruit),
    refit: nonNegInt(pitySrc.refit),
    exclusive: nonNegInt(pitySrc.exclusive),
  };
  out.exchangeProgress = nonNegInt(src.exchangeProgress);
  out.exchangeClaimed = Math.min(nonNegInt(src.exchangeClaimed), out.exchangeProgress);
  out.exclusivePeriod = typeof src.exclusivePeriod === 'number' && Number.isInteger(src.exclusivePeriod) ? src.exclusivePeriod : -1;
  out.exclusiveShipId = typeof src.exclusiveShipId === 'string' && src.exclusiveShipId.length > 0 ? src.exclusiveShipId : null;
  out.freePullDayKey = nonNegInt(src.freePullDayKey);
  out.freePullsUsed = nonNegInt(src.freePullsUsed);
  return out;
}

/** 今日剩余免费抽次数（细案⑥：补给站 Lv4=1/Lv7=2·跨天自动重置口径）。 */
export function freePullsLeftToday(state: S7GachaState, dayKey: number, dailyFree: number): number {
  const used = state.freePullDayKey === dayKey ? state.freePullsUsed : 0;
  return Math.max(0, Math.floor(dailyFree) - used);
}

/** 记账：今日用掉 n 次免费抽（跨天先归零再累计）。 */
export function spendFreePulls(state: S7GachaState, dayKey: number, n: number): void {
  if (n <= 0) return;
  if (state.freePullDayKey !== dayKey) { state.freePullDayKey = dayKey; state.freePullsUsed = 0; }
  state.freePullsUsed += Math.floor(n);
}

/** 取某池保底计数。 */
export function getPity(state: S7GachaState, poolId: S7GachaPoolId): number {
  return state.pity[poolId];
}
