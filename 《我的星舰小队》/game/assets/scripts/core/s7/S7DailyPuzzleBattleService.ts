// 每日推演·战斗服务（第2.5块·块4，纯 TS，不依赖 cc）：GDD S10.9。
//
// 职责：把一道题（内联敌阵）+ 玩家从候选战队包里的选摆（选 5 包 + 摆 3×3），跑成一场确定性推演战斗。
// 复用块3 已批准的**受控引擎入口**（内联敌阵 / 敌方积木两可选字段）——**并行加法**：不改组装器 / 引擎 /
// 主线 / 悬赏 / 回廊路径一个字节；只是「战队包 → 组装器建临时单位 + 在引擎请求上叠加内联敌阵」。预计零引擎改动。
//
// 我方单位 = 战队包（舰+员固定绑定 + 可选题目指定的插件/星核）喂现有组装器建成的**临时内存态单位**——
//   不落存档、不碰玩家 box（修订⑤）；归一 C 阶 Lv10（shipLevel/pilotLevel 强制 PUZZLE_NORMALIZED_LEVEL·无升阶升星）。
// 敌方 = 题目内联敌阵（unitStatRef + 落点）+ 可选全体缩放（enemyHpPct/enemyAtkPct·调难度占位）。
// 战斗种子对同一题固定（全服同题·确定性）：作者解回放与蒙特卡洛乱选都用同一场"今日战斗"，只有选摆在变。

import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7DailyPuzzleParam } from '../../config/s7/ConfigTypesS7';
import { S7BattleEntry } from './S7BattleEntry';
import {
  S7BattleEncounterAssembler, S7BattleLineupUnitInput, S7BattleLineupPluginInput,
} from './S7BattleEncounterAssembler';
import { S7AutoBattleEngine } from './S7AutoBattleEngine';
import { S7AutoBattleRunRequest, S7AutoBattleInlineEnemyInput } from './S7AutoBattleTypes';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7PluginQuality } from './S7PluginEffects';
import { summarizeS7BattleLog } from './S7BattleLogSummary';
import { S7BattleRunResult } from './S7BattleRunService';
import { PUZZLE_NORMALIZED_LEVEL } from './S7DailyPuzzle';

/** 组装器上下文/时基载体节点（仅借其 encounter 建玩家单位与上下文；敌人被内联敌阵覆盖，主线路径不动）。同回廊成例。 */
export const PUZZLE_BASE_CONTEXT_NODE = 'n001';

/** 玩家一项选摆：从候选包里选 packId + 摆到我方 3×3 的 slotRef（p{0-2}c{0-2}）。 */
export interface S7DailyPuzzleSelectionEntry {
  packId: string;
  slotRef: string;
}

/** 选摆非法（未知 packId / 空选摆）——控制器/验解器捕获。组装器另会校验格子合法/去重/≤5。 */
export class S7DailyPuzzleSelectionError extends Error {
  constructor(public readonly code: 'unknown_pack' | 'empty_selection', message: string) {
    super(`s7 daily puzzle 选摆错误[${code}]: ${message}`);
    this.name = 'S7DailyPuzzleSelectionError';
  }
}

/** 同一题固定的运行种子（全服同题·确定性）：作者解回放 + 蒙特卡洛 + 玩家出战都用它，只有选摆在变。 */
export function dailyPuzzleRunSeed(puzzleId: string): string {
  return `puzzle_${puzzleId}`;
}

/** 全体敌人血/攻缩放积木（纯函数·占位调难度用）：pct 非 0 才出块（deriveUnit 走 1+Σpct，负值=削弱）。 */
export function puzzleEnemyScaleBlocks(hpPct: number, atkPct: number): S7EffectBlock[] {
  const out: S7EffectBlock[] = [];
  if (Number.isFinite(hpPct) && hpPct !== 0) out.push({ kind: 'modifier', stat: 'maxHp', op: 'pct', value: hpPct, source: 'puzzle_scale' });
  if (Number.isFinite(atkPct) && atkPct !== 0) out.push({ kind: 'modifier', stat: 'attack', op: 'pct', value: atkPct, source: 'puzzle_scale' });
  return out;
}

/**
 * 把玩家选摆解析成组装器需要的阵容输入（纯函数）：每个 packId → 候选包 → 临时单位（归一 C 阶 Lv10·带包指定插件/核）。
 * 未知 packId 抛 S7DailyPuzzleSelectionError；空选摆同样抛（组装器也会拦空，此处给更清晰的错）。
 * 注：不在此校验 slotRef 合法/去重/≤5 —— 交组装器统一校验（避免两处规则漂移）。
 */
export function buildPuzzleLineup(
  puzzle: S7DailyPuzzleParam, selection: readonly S7DailyPuzzleSelectionEntry[],
): S7BattleLineupUnitInput[] {
  if (!Array.isArray(selection) || selection.length === 0) {
    throw new S7DailyPuzzleSelectionError('empty_selection', '选摆不能为空');
  }
  return selection.map((sel) => {
    const pack = puzzle.candidatePacks.find((p) => p.packId === sel.packId);
    if (!pack) {
      throw new S7DailyPuzzleSelectionError('unknown_pack', `未知战队包 "${String(sel.packId)}"（不在本题候选内）`);
    }
    const plugins: S7BattleLineupPluginInput[] | undefined = pack.plugins?.map((pl) => ({
      pluginId: pl.pluginId,
      quality: pl.quality as S7PluginQuality, // 合法性由组装器 + 静态校验器把关
    }));
    const unit: S7BattleLineupUnitInput = {
      shipId: pack.shipId,
      slotRef: sel.slotRef,
      pilotId: pack.pilotId,
      coreId: pack.coreId,
      plugins,
      // 归一：C 阶 Lv10（无升阶升星）——不带 tier/star 积木，只按 Lv10 成长。
      shipLevel: PUZZLE_NORMALIZED_LEVEL,
      pilotLevel: PUZZLE_NORMALIZED_LEVEL,
    };
    return unit;
  });
}

export interface S7DailyPuzzleBattleRequest {
  runtime: S7ConfigRuntime;
  puzzle: S7DailyPuzzleParam;
  /** 玩家选摆（选 5 包 + 摆位；作者解/蒙卡各自构造后传入）。 */
  selection: readonly S7DailyPuzzleSelectionEntry[];
  /** 运行种子；缺省用 dailyPuzzleRunSeed(puzzleId)（同一题固定·全服同题）。 */
  runSeed?: string | number;
}

/**
 * 跑一场推演战斗（纯 TS·无副作用·不推进进度/不发奖）。
 * 受控入口：复用组装器以 n001 为载体建玩家临时单位 + 基础 request，再叠加内联敌阵/敌方缩放两字段喂引擎。
 * 选摆非法抛 S7DailyPuzzleSelectionError；阵容格/数量非法由组装器抛 S7BattleEncounterAssemblerError。
 */
export function runDailyPuzzleBattle(req: S7DailyPuzzleBattleRequest): S7BattleRunResult {
  const { runtime, puzzle, selection } = req;
  const runSeed = req.runSeed ?? dailyPuzzleRunSeed(puzzle.rowId);
  const lineup = buildPuzzleLineup(puzzle, selection);

  const inlineEnemyUnits: S7AutoBattleInlineEnemyInput[] = puzzle.enemyFormation.map((e) => ({
    unitStatRef: e.unitStatRef,
    slotRef: e.slotRef,
  }));
  const enemyEffectBlocks = puzzleEnemyScaleBlocks(puzzle.enemyHpPct ?? 0, puzzle.enemyAtkPct ?? 0);

  // 复用组装器建玩家单位 + 基础 encounter（n001·仅上下文/时基载体；敌人被内联覆盖，组装器/主线路径零改动）。
  const entry = S7BattleEntry.fromRuntime(runtime);
  const assembler = new S7BattleEncounterAssembler(runtime, entry);
  const assembled = assembler.assemble({
    progress: { currentNodeId: PUZZLE_BASE_CONTEXT_NODE, clearedNodeIds: [] },
    runSeed,
    lineup,
  });

  const request: S7AutoBattleRunRequest = {
    ...assembled.request,
    inlineEnemyUnits,
    enemyEffectBlocks,
  };
  const result = new S7AutoBattleEngine(runtime).run(request);
  return { context: assembled.context, request, trace: assembled.trace, result, summary: summarizeS7BattleLog(result) };
}
