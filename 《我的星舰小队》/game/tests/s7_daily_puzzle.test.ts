// 每日推演·纯逻辑（第2.5块·块4步1）：轮换 / 存档态 v23 / 解锁门控 / 发奖。不跑引擎（引擎侧在 solver 测试）。
import { describe, it, expect } from 'vitest';
import { s7DayKey } from '../assets/scripts/core/s7/S7AdDailyCounter';
import {
  todaysPuzzleId, createDefaultS7DailyPuzzle, normalizeS7DailyPuzzle, refreshDailyPuzzle,
  isDailyPuzzleSolved, dailyPuzzleAttempts, recordDailyPuzzleAttempt, markDailyPuzzleSolved,
  dailyPuzzleUnlocked, dailyPuzzleFirstWinReward, DAILY_PUZZLE_UNLOCK_NODE,
} from '../assets/scripts/core/s7/S7DailyPuzzle';

const DAY = 86_400_000;
const IDS = ['pa', 'pb', 'pc']; // 3 题库

describe('S7 每日推演·每日轮换（全服同题·确定性）', () => {
  it('dayKey % 题数 轮换；同一天同题、逐日推进、循环回头', () => {
    expect(todaysPuzzleId(0, IDS)).toBe('pa');
    expect(todaysPuzzleId(1, IDS)).toBe('pb');
    expect(todaysPuzzleId(2, IDS)).toBe('pc');
    expect(todaysPuzzleId(3, IDS)).toBe('pa'); // 循环
    expect(todaysPuzzleId(4, IDS)).toBe('pb');
  });
  it('空题库 → null；负 dayKey 归 0 号', () => {
    expect(todaysPuzzleId(5, [])).toBeNull();
    expect(todaysPuzzleId(-7, IDS)).toBe('pa');
  });
});

describe('S7 每日推演·存档态（默认/规范化·v23）', () => {
  it('默认态 = 未初始化未解 0 尝试', () => {
    expect(createDefaultS7DailyPuzzle()).toEqual({ dayKey: 0, puzzleId: '', solved: false, attempts: 0 });
  });
  it('规范化丢弃脏值（负尝试/非整 dayKey/非布尔 solved/非串 puzzleId）', () => {
    expect(normalizeS7DailyPuzzle({ dayKey: -3, puzzleId: 42, solved: 'yes', attempts: -1 }))
      .toEqual({ dayKey: 0, puzzleId: '', solved: false, attempts: 0 });
    expect(normalizeS7DailyPuzzle({ dayKey: 10, puzzleId: 'pb', solved: true, attempts: 4 }))
      .toEqual({ dayKey: 10, puzzleId: 'pb', solved: true, attempts: 4 });
    expect(normalizeS7DailyPuzzle(null)).toEqual(createDefaultS7DailyPuzzle());
    expect(normalizeS7DailyPuzzle({ attempts: 2.5 }).attempts).toBe(0); // 非整
  });
});

describe('S7 每日推演·刷新 / 已解 / 尝试（跨天自动重置）', () => {
  const now = 1_000 * DAY + 5_000_000; // 某个正时刻
  const nextDay = now + DAY;

  it('refresh：首次写入今日题；同天幂等（不清已解/尝试）；跨天重置', () => {
    const s = createDefaultS7DailyPuzzle();
    const id = refreshDailyPuzzle(s, now, IDS);
    expect(id).toBe(todaysPuzzleId(s7DayKey(now), IDS));
    expect(s.dayKey).toBe(s7DayKey(now));
    expect(s.solved).toBe(false);

    s.solved = true; s.attempts = 3;
    refreshDailyPuzzle(s, now + 1000, IDS); // 同天再刷
    expect(s.solved).toBe(true); // 幂等：不清
    expect(s.attempts).toBe(3);

    refreshDailyPuzzle(s, nextDay, IDS); // 跨天
    expect(s.solved).toBe(false); // 重置
    expect(s.attempts).toBe(0);
    expect(s.dayKey).toBe(s7DayKey(nextDay));
  });

  it('尝试计数：出战 +1；跨天视为 0；空题库不动', () => {
    const s = createDefaultS7DailyPuzzle();
    const id = refreshDailyPuzzle(s, now, IDS)!;
    expect(recordDailyPuzzleAttempt(s, now, IDS)).toBe(1);
    expect(recordDailyPuzzleAttempt(s, now, IDS)).toBe(2);
    expect(dailyPuzzleAttempts(s, now, id)).toBe(2);
    expect(dailyPuzzleAttempts(s, nextDay, id)).toBe(0); // 跨天读=0
    expect(recordDailyPuzzleAttempt(s, now, [])).toBe(0); // 空题库
  });

  it('首胜标记：首次胜 true（发奖）、当日重复胜 false（不重复发）、跨天重置', () => {
    const s = createDefaultS7DailyPuzzle();
    const id = refreshDailyPuzzle(s, now, IDS)!;
    expect(isDailyPuzzleSolved(s, now, id)).toBe(false);
    expect(markDailyPuzzleSolved(s, now, IDS)).toBe(true); // 首胜
    expect(isDailyPuzzleSolved(s, now, id)).toBe(true);
    expect(markDailyPuzzleSolved(s, now, IDS)).toBe(false); // 当日重复不发
    // 跨天换题后可再首胜。
    expect(markDailyPuzzleSolved(s, nextDay, IDS)).toBe(true);
  });
});

describe('S7 每日推演·解锁门控 + 发奖', () => {
  it('解锁 = n040 已通关（沿用回廊通关节点检查）', () => {
    expect(DAILY_PUZZLE_UNLOCK_NODE).toBe('n040');
    expect(dailyPuzzleUnlocked([])).toBe(false);
    expect(dailyPuzzleUnlocked(['n030', 'n039'])).toBe(false);
    expect(dailyPuzzleUnlocked(['n038', 'n040', 'n041'])).toBe(true);
  });
  it('首胜发奖 = 星贝 + 通用星舰碎片（占位·非负）', () => {
    const r = dailyPuzzleFirstWinReward();
    expect(r.starCargo).toBeGreaterThan(0);
    expect(r.shipBlueprint).toBeGreaterThan(0);
    expect(r.starOre ?? 0).toBe(0); // 星矿不入（守 S9 四来源）
  });
});
