// 第2.5块·块1：广告点位每日次数计数器单测（GDD S13.2 每日上限的通用载体）。
// 覆盖：消耗至上限拒绝且不改状态、跨天自动重置、点位互不影响、只读查询无副作用、脏档规范化、dayKey 边界。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7AdDaily,
  normalizeS7AdDaily,
  adDayKey,
  adDailyUsed,
  adDailyTryConsume,
} from '../assets/scripts/core/s7/S7AdDailyCounter';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

describe('块1 · S7AdDailyCounter', () => {
  it('默认状态：任意点位今日已用 0', () => {
    const s = createDefaultS7AdDaily();
    expect(adDailyUsed(s, 'return_report_double', NOW)).toBe(0);
  });

  it('消耗到上限：limit=2 → ok(1)/ok(2)，第三次 daily_limit 且计数不再变', () => {
    const s = createDefaultS7AdDaily();
    const c1 = adDailyTryConsume(s, 'return_report_double', 2, NOW);
    expect(c1).toEqual({ ok: true, usedToday: 1 });
    const c2 = adDailyTryConsume(s, 'return_report_double', 2, NOW + 1000);
    expect(c2).toEqual({ ok: true, usedToday: 2 });
    const c3 = adDailyTryConsume(s, 'return_report_double', 2, NOW + 2000);
    expect(c3).toEqual({ ok: false, reason: 'daily_limit' });
    expect(adDailyUsed(s, 'return_report_double', NOW + 2000)).toBe(2); // 拒绝不改状态
  });

  it('跨天自动重置：昨日用满，次日已用视为 0、可再消耗且从 1 重计', () => {
    const s = createDefaultS7AdDaily();
    adDailyTryConsume(s, 'p', 1, NOW);
    expect(adDailyTryConsume(s, 'p', 1, NOW)).toEqual({ ok: false, reason: 'daily_limit' });
    const nextDay = NOW + DAY;
    expect(adDailyUsed(s, 'p', nextDay)).toBe(0);
    expect(adDailyTryConsume(s, 'p', 1, nextDay)).toEqual({ ok: true, usedToday: 1 });
    expect(s.entries['p'].dayKey).toBe(adDayKey(nextDay));
  });

  it('点位互不影响：A 用满不阻塞 B', () => {
    const s = createDefaultS7AdDaily();
    adDailyTryConsume(s, 'a', 1, NOW);
    expect(adDailyTryConsume(s, 'a', 1, NOW)).toEqual({ ok: false, reason: 'daily_limit' });
    expect(adDailyTryConsume(s, 'b', 1, NOW)).toEqual({ ok: true, usedToday: 1 });
  });

  it('adDailyUsed 是只读查询：跨天读取不落盘副作用（entries 不被改写）', () => {
    const s = createDefaultS7AdDaily();
    adDailyTryConsume(s, 'p', 3, NOW);
    const snapshot = JSON.stringify(s);
    expect(adDailyUsed(s, 'p', NOW + DAY)).toBe(0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('normalize：非对象退默认；非法条目（负数/浮点/缺字段/空点位名）全部丢弃，合法条目保留', () => {
    expect(normalizeS7AdDaily(null)).toEqual({ entries: {} });
    expect(normalizeS7AdDaily(42)).toEqual({ entries: {} });
    const dirty = {
      entries: {
        good: { dayKey: 19676, count: 2 },
        negCount: { dayKey: 19676, count: -1 },
        floatDay: { dayKey: 19676.5, count: 1 },
        missing: { dayKey: 19676 },
        '': { dayKey: 19676, count: 1 },
        notObj: 'x',
      },
    };
    const n = normalizeS7AdDaily(dirty);
    expect(Object.keys(n.entries)).toEqual(['good']);
    expect(n.entries.good).toEqual({ dayKey: 19676, count: 2 });
  });

  it('adDayKey 边界：负数/NaN 归 0；正常值与"打捞加速 dayKey"同口径 floor(now/天)', () => {
    expect(adDayKey(-5)).toBe(0);
    expect(adDayKey(Number.NaN)).toBe(0);
    expect(adDayKey(NOW)).toBe(Math.floor(NOW / DAY));
  });
});
