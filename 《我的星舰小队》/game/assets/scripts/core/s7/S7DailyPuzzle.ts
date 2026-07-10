// 每日推演·核心逻辑（第2.5块·块4，纯 TS，不依赖 cc）：GDD-v2.0 S10.9 / 附录B B5.3（Ron 2026-07-05 三修订）。
// 每天一道全服同题的"战术残局"：玩家不用自己的船，从题目给的 6-8 个候选战队包（舰+员固定绑定·可选带题目
// 指定的插件/星核·不可改装）里挑 5 个、摆进 3×3，去打一个刁钻内联敌阵。会摆的一把过、乱摆的过不了。
// 当天不限次、失败零惩罚、首胜发一次小奖、全程无广告；每天凌晨 4 点换题（沿用统一日界 s7DayKey）。
//
// 本模块 = 推演的"纯逻辑账本"：每日轮换 + 存档态（当日题号/已解/尝试数·v23）+ 解锁门控 + 发奖占位。
// 战斗构建（战队包→组装器→受控入口）在 S7DailyPuzzleBattleService；三道闸验解器在 S7DailyPuzzleSolver。
// 题库 = 配置表 daily_puzzle_param（Codex 走量；5 道样题本块手写），题目类型在 config/s7/ConfigTypesS7。
// 数值全 v0.1 占位（发奖量/威胁强度），阶段三数值校准统一精校（改这里的 exported const 即可，不动逻辑）。

import { s7DayKey } from './S7AdDailyCounter';

// ===== 结构常量（定义性·非占位）=====
/** 归一等级：C 阶 Lv10（无升阶升星）——战斗构建时对所有战队包强制此级（见 S7DailyPuzzleBattleService）。 */
export const PUZZLE_NORMALIZED_LEVEL = 10;
/** 上阵格数（我方 3×3 选摆 5 舰）。作者解与玩家出战都恰好 5。 */
export const PUZZLE_LINEUP_SIZE = 5;
/** 解锁节点（Ron 2026-07-05 修订①：打通 n040 后解锁·替代原"第5关后"·沿用回廊的"通关节点检查"门控成例）。 */
export const DAILY_PUZZLE_UNLOCK_NODE = 'n040';

// ===== v0.7 校准终值（步5 回写·机器真源 PARAMS.puzzle：星贝 30/通碎 2.5——通碎按整数取上沿 3·推演敏感性 ±0 天=无感·记细表 §14）=====
/** 每日首胜小奖：星贝 + 通用星舰碎片（GDD S10.9）。 */
export const PUZZLE_REWARD_CARGO = 30;   // starCargo 星贝（v0.7）
export const PUZZLE_REWARD_SHARD = 3;    // shipBlueprint 通用星舰碎片（尺 2.5 取整上沿）

/**
 * 每日首胜小奖（纯函数·占位）。星矿不入（守 S9 星矿四来源）；无广告翻倍（GDD S13.2 推演零广告）。
 * "首胜发一次"由调用方看 markDailyPuzzleSolved 返回值决定，本函数只出奖表。
 */
export function dailyPuzzleFirstWinReward(): Record<string, number> {
  return { starCargo: PUZZLE_REWARD_CARGO, shipBlueprint: PUZZLE_REWARD_SHARD };
}

// ===== 每日轮换（全服同题·确定性·纯本地）=====

/**
 * 今日题号（按日期序号轮换·纯函数）：dayKey % 题数（负值/空表防御）。
 * 全服同题——s7DayKey 对所有玩家一致（北京时间凌晨 4 点日界），故同一天人人同题。
 * 题库顺序 = 配置表内行序（调用方传入 puzzleIds）。空题库 → null。
 */
export function todaysPuzzleId(dayKey: number, puzzleIds: readonly string[]): string | null {
  const n = puzzleIds.length;
  if (n === 0) return null;
  const key = Number.isFinite(dayKey) && dayKey > 0 ? Math.floor(dayKey) : 0;
  const idx = ((key % n) + n) % n;
  return puzzleIds[idx];
}

// ===== 持久化状态（当日题号 + 已解标记 + 尝试计数·v23·跨天自动重置）=====

/** 每日推演存档子状态（本模块拥有形状 + 默认/规范化·S7SaveService 组合·v23）。 */
export interface S7DailyPuzzleSaveState {
  /** 下列统计所属游戏日（s7DayKey）；跨天由 refreshDailyPuzzle 重置。 */
  dayKey: number;
  /** 当日题号（跨天刷新时写入·= todaysPuzzleId 结果）。空串 = 尚未初始化。 */
  puzzleId: string;
  /** 今日是否已解（已解 = 首胜发过奖·当日重复通关不重复发）。 */
  solved: boolean;
  /** 今日尝试次数（失败零惩罚不限次·仅计数展示）。 */
  attempts: number;
}

export function createDefaultS7DailyPuzzle(): S7DailyPuzzleSaveState {
  return { dayKey: 0, puzzleId: '', solved: false, attempts: 0 };
}

/** 规范化（防脏档）：dayKey/attempts 取非负整数、puzzleId 取字符串、solved 取布尔；其余落默认。 */
export function normalizeS7DailyPuzzle(raw: unknown): S7DailyPuzzleSaveState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dayKey = typeof s.dayKey === 'number' && Number.isInteger(s.dayKey) && s.dayKey >= 0 ? s.dayKey : 0;
  const puzzleId = typeof s.puzzleId === 'string' ? s.puzzleId : '';
  const solved = s.solved === true;
  const attempts = typeof s.attempts === 'number' && Number.isInteger(s.attempts) && s.attempts >= 0 ? s.attempts : 0;
  return { dayKey, puzzleId, solved, attempts };
}

/**
 * 刷新到今日（有状态·进推演页/结算时调）：若跨天或题号与今日不符 → 重置为今日题（已解=false·尝试=0）。
 * 返回今日题号（空题库 → null·不改状态）。同一天重复调 = 幂等（不清今日已解/尝试）。
 */
export function refreshDailyPuzzle(
  state: S7DailyPuzzleSaveState, now: number, puzzleIds: readonly string[],
): string | null {
  const today = s7DayKey(now);
  const todayId = todaysPuzzleId(today, puzzleIds);
  if (todayId === null) return null;
  if (state.dayKey !== today || state.puzzleId !== todayId) {
    state.dayKey = today;
    state.puzzleId = todayId;
    state.solved = false;
    state.attempts = 0;
  }
  return todayId;
}

/** 今日该题是否已解（只读·跨天视为未解）。 */
export function isDailyPuzzleSolved(state: S7DailyPuzzleSaveState, now: number, puzzleId: string): boolean {
  return state.dayKey === s7DayKey(now) && state.solved && state.puzzleId === puzzleId;
}

/** 今日尝试次数（只读·跨天视为 0）。 */
export function dailyPuzzleAttempts(state: S7DailyPuzzleSaveState, now: number, puzzleId: string): number {
  return state.dayKey === s7DayKey(now) && state.puzzleId === puzzleId ? state.attempts : 0;
}

/**
 * 记一次尝试（有状态·出战即调）：先对齐今日，再 attempts+1。返回对齐后当前尝试次数。
 * 空题库 → 不动状态、返回 0。
 */
export function recordDailyPuzzleAttempt(
  state: S7DailyPuzzleSaveState, now: number, puzzleIds: readonly string[],
): number {
  if (refreshDailyPuzzle(state, now, puzzleIds) === null) return 0;
  state.attempts += 1;
  return state.attempts;
}

/**
 * 标记今日已解（有状态·战斗胜利后调）：先对齐今日，再置 solved。
 * 返回 true = 本次是**首胜**（此前未解·调用方据此发一次小奖）；false = 已解过（不重复发）或空题库。
 */
export function markDailyPuzzleSolved(
  state: S7DailyPuzzleSaveState, now: number, puzzleIds: readonly string[],
): boolean {
  if (refreshDailyPuzzle(state, now, puzzleIds) === null) return false;
  if (state.solved) return false;
  state.solved = true;
  return true;
}

// ===== 解锁门控 =====

/**
 * 每日推演解锁（Ron 2026-07-05 修订①）：n040 已通关（沿用回廊 corridorUnlocked 的"通关节点检查"成例）。
 * README/GDD 解锁口径从旧"第5关强引导后"改为此（第5关克制概念已教·n040 在首Boss n030 之后·体验更顺）。
 */
export function dailyPuzzleUnlocked(clearedNodeIds: readonly string[]): boolean {
  return clearedNodeIds.includes(DAILY_PUZZLE_UNLOCK_NODE);
}
