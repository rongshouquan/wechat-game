// 每日推演·验解器（第2.5块·块4，纯 TS，不依赖 cc）：GDD S10.9 三道闸（Ron 2026-07-05 修订③）。
//
// 三道闸（保证题目"有唯一巧手、能区分会玩的人"）：
//   a) 作者解引擎回放必过——作者录的选摆真跑引擎必须我方胜。
//   b) 随机合法选摆蒙特卡洛通过率 <30%——乱选 5 包乱摆的赢面必须低（保证要动脑）。
//   c) 候选数 ∈[6,8]——硬校验（修订②候选战队包 6-8）。
// 另出**每题乱选率**（randomWinRate）供题库难度分档（修订③）。
//
// ⚠️ 落地位置（Ron 2026-07-05 认可）：validate:configs 的 .mjs 是纯 Node 读 JSON、**跑不了 TS 引擎**（本工程既定形状·
//   不装编译链保持简单）。故要真跑引擎的两道闸(a/b) 由本模块在 **vitest 遍历题库测试**里执行（属 npm test → npm run gate）；
//   纯静态那道闸(c)+结构合法另在 .mjs / ConfigValidatorS7 各放一份。两者同在 gate 里——坏题必被拦、Codex 加题跑一次 gate 全自动验。
//
// 确定性铁律：蒙特卡洛用固定选摆种子 + 固定采样数、战斗用同一题固定种子（只选摆在变），全程无随机/无时间——
//   门禁不忽绿忽红。性能护栏（Ron）：题库扫描若把 gate 拖过约 3 分钟，降 PUZZLE_MC_SAMPLES 到 100 或把扫描拆独立测试文件并行。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7DailyPuzzleParam } from '../../config/s7/ConfigTypesS7';
import { S7_PLAYER_ROWS, S7_PLAYER_COLS } from './S7BattleGrid';
import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  runDailyPuzzleBattle, dailyPuzzleRunSeed, S7DailyPuzzleSelectionEntry,
} from './S7DailyPuzzleBattleService';
import { PUZZLE_LINEUP_SIZE } from './S7DailyPuzzle';

// ===== 三道闸阈值/参数（改这里不改逻辑）=====
/** 闸 b：随机乱选通过率上限（<30% 判过·GDD S10.9）。 */
export const PUZZLE_MAX_RANDOM_WIN_RATE = 0.30;
/** 闸 c：候选战队包数量区间（修订②：6-8）。 */
export const PUZZLE_MIN_CANDIDATES = 6;
export const PUZZLE_MAX_CANDIDATES = 8;
/** 闸 b：蒙特卡洛采样数（确定性·固定）。性能护栏见文件头：拖慢 gate 就降到 100 或拆独立测试文件。 */
export const PUZZLE_MC_SAMPLES = 200;

/** 我方 3×3 全部锚点格（p{row}c{col}·9 格）——蒙特卡洛从中随机取 5 格。 */
export function puzzlePlayerSlots(): string[] {
  const out: string[] = [];
  for (let r = 0; r < S7_PLAYER_ROWS; r += 1) for (let c = 0; c < S7_PLAYER_COLS; c += 1) out.push(`p${r}c${c}`);
  return out;
}

/** Fisher–Yates 洗牌（确定性·用注入的 rng·不改入参）。 */
function shuffled<T>(arr: readonly T[], rng: S7AutoBattleRng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 构造一个随机合法选摆：从候选包随机取 5、从 9 格随机取 5、一一配对（确定性·用注入的 rng）。 */
export function randomPuzzleSelection(puzzle: S7DailyPuzzleParam, rng: S7AutoBattleRng): S7DailyPuzzleSelectionEntry[] {
  const packIds = shuffled(puzzle.candidatePacks.map((p) => p.packId), rng).slice(0, PUZZLE_LINEUP_SIZE);
  const slots = shuffled(puzzlePlayerSlots(), rng).slice(0, PUZZLE_LINEUP_SIZE);
  return packIds.map((packId, i) => ({ packId, slotRef: slots[i] }));
}

/** 一场推演是否我方胜（跑引擎·throw 视为未胜——防御性，坏题/坏选摆不炸测试）。 */
function selectionWins(
  runtime: S7ConfigRuntime, puzzle: S7DailyPuzzleParam, selection: readonly S7DailyPuzzleSelectionEntry[],
): { win: boolean; error?: string } {
  try {
    const res = runDailyPuzzleBattle({ runtime, puzzle, selection, runSeed: dailyPuzzleRunSeed(puzzle.rowId) });
    return { win: res.result.winner === 'player' };
  } catch (e) {
    return { win: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 单题验解结果（三道闸 + 乱选率）。 */
export interface S7DailyPuzzleValidation {
  puzzleId: string;
  candidateCount: number;
  /** 闸 c。 */
  candidateCountOk: boolean;
  /** 闸 a：作者解回放我方胜。 */
  authorSolves: boolean;
  /** 闸 b 采样数 / 赢的把数 / 乱选率 / 是否 <阈值。 */
  randomSamples: number;
  randomWins: number;
  randomWinRate: number;
  randomWinRateOk: boolean;
  /** 三闸全过。 */
  ok: boolean;
  /** 首个失败原因（诊断用·作者解报错/等）。 */
  note?: string;
}

export interface S7DailyPuzzleValidateOptions {
  /** 覆盖蒙特卡洛采样数（测试/授权harness 调难度用·缺省 PUZZLE_MC_SAMPLES）。 */
  mcSamples?: number;
}

/**
 * 验一道题的三道闸（纯函数·确定性·跑引擎）。
 * 闸 a：作者解回放我方胜；闸 b：mcSamples 把随机选摆的胜率 <阈值；闸 c：候选数 ∈[6,8]。
 * 返回完整分解（含乱选率供难度分档）。ok = 三闸全过。
 */
export function validateDailyPuzzle(
  runtime: S7ConfigRuntime, puzzle: S7DailyPuzzleParam, opts: S7DailyPuzzleValidateOptions = {},
): S7DailyPuzzleValidation {
  const samples = opts.mcSamples ?? PUZZLE_MC_SAMPLES;
  let note: string | undefined;

  // 闸 c：候选数 ∈[6,8]（纯静态）。
  const candidateCount = puzzle.candidatePacks.length;
  const candidateCountOk = candidateCount >= PUZZLE_MIN_CANDIDATES && candidateCount <= PUZZLE_MAX_CANDIDATES;
  if (!candidateCountOk) note = note ?? `候选数 ${candidateCount} 不在 [${PUZZLE_MIN_CANDIDATES},${PUZZLE_MAX_CANDIDATES}]`;

  // 闸 a：作者解回放必过。
  const authorSel: S7DailyPuzzleSelectionEntry[] = puzzle.authorSolution.map((s) => ({ packId: s.packId, slotRef: s.slotRef }));
  const authorRun = selectionWins(runtime, puzzle, authorSel);
  const authorSolves = authorRun.win;
  if (!authorSolves) note = note ?? (authorRun.error ? `作者解报错：${authorRun.error}` : '作者解回放未胜');

  // 闸 b：蒙特卡洛乱选率（固定种子·只选摆在变·战斗种子对本题固定）。
  const rng = new S7AutoBattleRng(`puzzle_mc_${puzzle.rowId}`);
  let randomWins = 0;
  for (let i = 0; i < samples; i += 1) {
    const sel = randomPuzzleSelection(puzzle, rng);
    if (selectionWins(runtime, puzzle, sel).win) randomWins += 1;
  }
  const randomWinRate = samples > 0 ? randomWins / samples : 0;
  const randomWinRateOk = randomWinRate < PUZZLE_MAX_RANDOM_WIN_RATE;
  if (!randomWinRateOk) note = note ?? `乱选率 ${(randomWinRate * 100).toFixed(1)}% ≥ ${(PUZZLE_MAX_RANDOM_WIN_RATE * 100).toFixed(0)}%`;

  return {
    puzzleId: puzzle.rowId,
    candidateCount,
    candidateCountOk,
    authorSolves,
    randomSamples: samples,
    randomWins,
    randomWinRate,
    randomWinRateOk,
    ok: candidateCountOk && authorSolves && randomWinRateOk,
    note,
  };
}
