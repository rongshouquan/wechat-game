// 广告点位每日次数计数器（第2.5块·块1，纯 TS，不依赖 cc）：GDD S13.2 各点位"每日上限"的通用载体。
// 分工：S7AdGateway 只管"广告看没看完"，每日上限由各玩法块配合本模块实现（网关注释既定分工）。
// 本模块另持有全游戏统一日界 s7DayKey（Ron 2026-07-03 拍板：北京时间凌晨 4 点重置）——
//   salvageDayKey / merchantDayKey / gachaDayIndex 均委托它，"每天"只有一个口径。
// 块1 先服务「回港报告翻倍」(return_report_double·每日 2 次)；块3/5 新点位直接复用，不再各自造轮子。
// 上限数值属 S13/数值细表（各点位自持常量），本模块只做计数，不写死限额。
// UI 铁律呼应（S13.1）：到上限时按钮"不出现"而非置灰——查询用 adDailyUsed，不产生副作用。

export interface S7AdDailyEntry {
  dayKey: number;
  count: number;
}

/** 各点位每日计数（key = 点位 id）。存档子状态：本模块拥有形状 + createDefault/normalize，S7SaveService 组合（v19）。 */
export interface S7AdDailyState {
  entries: Record<string, S7AdDailyEntry>;
}

const DAY_MS = 86_400_000;
/** 日界移位：+8h 时区（微信小游戏仅国内发行，写死 UTC+8）− 4h 重置时刻 = +4h。 */
const DAY_RESET_SHIFT_MS = (8 - 4) * 3_600_000;

export function createDefaultS7AdDaily(): S7AdDailyState {
  return { entries: {} };
}

/**
 * 全游戏统一"游戏日"key：北京时间凌晨 4 点重置（Ron 2026-07-03 拍板；避开 0 点在线玩家被当场打断）。
 * 非有限/负值归 0。所有"每日 X"（广告上限/商人刷新/抽卡轮换/打捞加速…）一律用本函数，不得各自 floor。
 */
export function s7DayKey(now: number): number {
  return Number.isFinite(now) && now > 0 ? Math.floor((now + DAY_RESET_SHIFT_MS) / DAY_MS) : 0;
}

/** 规范化（防脏档）：只收合法 {dayKey:整数, count:非负整数} 条目；其余丢弃。 */
export function normalizeS7AdDaily(raw: unknown): S7AdDailyState {
  const out = createDefaultS7AdDaily();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const entries = (src.entries && typeof src.entries === 'object' ? src.entries : {}) as Record<string, unknown>;
  for (const point of Object.keys(entries)) {
    if (point.length === 0) continue;
    const row = (entries[point] && typeof entries[point] === 'object' ? entries[point] : {}) as Record<string, unknown>;
    const dayKey = typeof row.dayKey === 'number' && Number.isInteger(row.dayKey) ? row.dayKey : null;
    const count = typeof row.count === 'number' && Number.isInteger(row.count) && row.count >= 0 ? row.count : null;
    if (dayKey === null || count === null) continue;
    out.entries[point] = { dayKey, count };
  }
  return out;
}

/** 今日已用次数（只读，跨天视为 0，不落盘副作用）。 */
export function adDailyUsed(state: S7AdDailyState, point: string, now: number): number {
  const entry = state.entries[point];
  if (!entry || entry.dayKey !== s7DayKey(now)) return 0;
  return entry.count;
}

export type S7AdDailyConsumeResult =
  | { ok: true; usedToday: number }
  | { ok: false; reason: 'daily_limit' };

/**
 * 尝试消耗一次：未到上限 → 计数 +1 返回 ok（跨天自动重置后再计）；到上限 → 拒绝且不改状态。
 * 调用时机：广告"看完"(gateway ok) 之后、发奖之前——广告没看完不消耗次数。
 */
export function adDailyTryConsume(
  state: S7AdDailyState, point: string, dailyLimit: number, now: number,
): S7AdDailyConsumeResult {
  const dayKey = s7DayKey(now);
  const entry = state.entries[point];
  const usedToday = entry && entry.dayKey === dayKey ? entry.count : 0;
  if (usedToday >= dailyLimit) return { ok: false, reason: 'daily_limit' };
  state.entries[point] = { dayKey, count: usedToday + 1 };
  return { ok: true, usedToday: usedToday + 1 };
}
