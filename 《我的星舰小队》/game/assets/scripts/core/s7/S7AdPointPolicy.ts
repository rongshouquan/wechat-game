// 广告点位统一政策（第2.5块·块5，纯 TS，不依赖 cc）：GDD-v2.0 S13.2 十点位"每日上限 + 按钮三态 + 广告券"唯一收口。
//
// Ron 2026-07-05/06 拍板（块5 任务单锁定决策，S13 步3 同步）：
//   ① 全点位每日上限 = 1 次；唯一例外 #7 星辉货舱多选不限（天然限频）。
//   ② 不显示剩余次数；点过即消失（隐藏非置灰），不放"今日已用完"类文案。
//   ③ 广告券（钱包新键 adTicket·商人星贝购买）：持券时"当日已用完而隐藏"的按钮恢复显示、
//      标「广告券×N」；点击=消耗 1 张+播广告+正常发奖；广告失败/被关退回该张券。
//   ④ 强引导（关1-5）期间全部广告入口隐藏（玩家第一次见到广告=引导结束后首次回港报告）。
//
// 分工：S7AdGateway 管"广告看没看完"；S7AdDailyCounter 管通用每日计数；本模块管
//   "上限是多少、按钮此刻长什么样、券怎么扣退"。各界面一律调 s7AdButtonState，禁止自写显隐判断。
// 上限/收益数值全 v0.1 占位（exported const·第三块数值校准统一精校，含"广告整体加速≤25-30%"回头配平）。

import { S7AdPoint, S7_AD_POINTS } from './S7AdGateway';

/** 广告券钱包键（S7_RESOURCE_KEYS 第 14 键·块5）。 */
export const AD_TICKET_RESOURCE_KEY = 'adTicket';

/**
 * 各点位每日上限表（唯一真源·决策①）：null = 不限次。
 * v0.1 占位：第三块数值校准可调（只改这张表，不改任何逻辑）。
 */
export const S7_AD_POINT_DAILY_LIMITS: Readonly<Record<S7AdPoint, number | null>> = Object.freeze({
  return_report_double: 1,       // #1（原 2 → 1）
  daily_supply_chest: 1,         // #2
  clear_reward_double: 1,        // #3（原不限 → 1·全部关卡共享同一次）
  triple_pick_extra: 1,          // #4（原 3 → 1）
  salvage_speedup: 1,            // #5（原 3 → 1）
  sponsor_supply: 1,             // #6（原 2 → 1）
  cargo_extra_pick: null,        // #7 唯一不限次（货舱稀有·天然限频）
  merchant_refresh: 1,           // #8（原 2 → 1）
  defeat_consolation_double: 1,  // #9（原 2 → 1）
  corridor_milestone_double: 1,  // #10（原不限 → 1）
});

/** 赞助补给一次广告发放补给券张数（S13 #6·决策⑤：×10；占位·第三块按"广告整体加速≤25-30%"配平抽卡供给）。 */
export const S7_SPONSOR_SUPPLY_TICKETS = 10;

/**
 * 按钮三态（决策②③④）：
 *   available = 今日未用完 → 正常显示；
 *   hidden    = 已用完且无券（或强引导期）→ 按钮不出现（非置灰·零"已用完"文案）；
 *   ticket    = 已用完但持券 → 恢复显示 + 标「广告券×N」，点击走券。
 */
export type S7AdButtonState =
  | { kind: 'available' }
  | { kind: 'hidden' }
  | { kind: 'ticket'; tickets: number };

/**
 * 计算某点位按钮此刻的三态（纯函数·无副作用）。
 * usedToday 由调用方用 adDailyUsed(state, point, now) 现取；tickets = 钱包 adTicket 数。
 */
export function s7AdButtonState(
  point: S7AdPoint,
  usedToday: number,
  tickets: number,
  strongGuideActive: boolean,
): S7AdButtonState {
  if (strongGuideActive) return { kind: 'hidden' }; // 决策④ 新手期全隐（全点位·含不限次的货舱多选）
  const limit = S7_AD_POINT_DAILY_LIMITS[point];
  if (limit === null || usedToday < limit) return { kind: 'available' };
  const n = Math.floor(tickets);
  if (n > 0) return { kind: 'ticket', tickets: n };
  return { kind: 'hidden' };
}

/** 券态按钮文案：基础文案 + 「广告券×N」标识（决策③·各界面统一走这里，不各自拼）。 */
export function adTicketButtonLabel(base: string, tickets: number): string {
  return `${base}｜广告券×${Math.floor(tickets)}`;
}

/** 钱包当前广告券张数（非法值一律当 0）。 */
export function adTicketCount(wallet: Record<string, number>): number {
  const v = wallet[AD_TICKET_RESOURCE_KEY];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** 扣 1 张广告券（点券态按钮那一刻·播广告之前）。不足 → false 且不动钱包。 */
export function consumeAdTicket(wallet: Record<string, number>): boolean {
  if (adTicketCount(wallet) < 1) return false;
  wallet[AD_TICKET_RESOURCE_KEY] = adTicketCount(wallet) - 1;
  return true;
}

/** 退回 1 张广告券（广告失败/被关·决策③"不白扣"）。 */
export function refundAdTicket(wallet: Record<string, number>): void {
  wallet[AD_TICKET_RESOURCE_KEY] = adTicketCount(wallet) + 1;
}

/**
 * 券路径结算（把"失败必退券"钉成可测的纯不变量）：
 * 调用方已 consumeAdTicket 扣 1 张、随后拿到广告结果 ok——ok=false 时就地退券。
 */
export function settleAdTicketAttempt(wallet: Record<string, number>, ok: boolean): 'granted' | 'refunded' {
  if (!ok) { refundAdTicket(wallet); return 'refunded'; }
  return 'granted';
}

/** 上限表完整性自检（供测试/校验用）：表键集恰好 = 网关十点位。 */
export function adPointLimitTableComplete(): boolean {
  const keys = Object.keys(S7_AD_POINT_DAILY_LIMITS).sort();
  const points = [...S7_AD_POINTS].sort();
  return keys.length === points.length && keys.every((k, i) => k === points[i]);
}
