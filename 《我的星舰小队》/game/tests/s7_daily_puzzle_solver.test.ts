// 每日推演·验解器三道闸 + 防假过反例（第2.5块·块4步1，GDD S10.9 修订③）。
//
// 这是"要真跑引擎的两道闸(a/b)"的落地测试门（.mjs 跑不了 TS 引擎，见 S7DailyPuzzleSolver 文件头）：
//   ① 遍历题库每一道题 → 三闸全过（作者解回放胜 / 乱选率<30% / 候选数∈[6,8]）——Codex 之后加题跑一次 gate 全自动验。
//   ② **防假过反例**（Ron 硬要求·验解器自身不能假过）：
//      - 作者解错误的题 → 必须被闸 a 拦（authorSolves=false）；
//      - 乱选率超标的题（太简单）→ 必须被闸 b 拦（randomWinRateOk=false）；
//      - 候选数越界的题 → 必须被闸 c 拦（candidateCountOk=false）。
//   若验解器写成"永远 ok=true"，这些反例会红。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES, S7DailyPuzzleParam } from '../assets/scripts/config/s7/ConfigTypesS7';
import { validateDailyPuzzle, PUZZLE_MAX_RANDOM_WIN_RATE } from '../assets/scripts/core/s7/S7DailyPuzzleSolver';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
async function runtimeOf(): Promise<S7ConfigRuntime> {
  return S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
}
function puzzlesOf(runtime: S7ConfigRuntime): S7DailyPuzzleParam[] {
  return runtime.getAll<S7DailyPuzzleParam>('daily_puzzle_param');
}
/** 深拷贝一题（反例构造不污染原表）。 */
function clone(p: S7DailyPuzzleParam): S7DailyPuzzleParam {
  return JSON.parse(JSON.stringify(p)) as S7DailyPuzzleParam;
}

describe('S7 每日推演·题库三道闸（闸 a/b 真跑引擎）', () => {
  it('首发 5 道样题各覆盖不同威胁类型且齐全', async () => {
    const runtime = await runtimeOf();
    const puzzles = puzzlesOf(runtime);
    expect(puzzles.length).toBeGreaterThanOrEqual(5);
    // 交付⑥：后排点名/护盾/召唤/治疗/爆发 各来一道。
    const threats = new Set(puzzles.map((p) => p.threatType));
    for (const t of ['backline', 'shield', 'summon', 'heal', 'burst']) {
      expect(threats.has(t)).toBe(true);
    }
  });

  it('题库每一道题：三道闸全过（作者解胜 / 乱选率<30% / 候选数∈[6,8]）', async () => {
    const runtime = await runtimeOf();
    for (const p of puzzlesOf(runtime)) {
      const v = validateDailyPuzzle(runtime, p);
      // 分闸断言（失败时能看清是哪道闸挂 + 乱选率数字）。
      expect(v.candidateCountOk, `${p.rowId} 候选数 ${v.candidateCount} 应∈[6,8]`).toBe(true);
      expect(v.authorSolves, `${p.rowId} 作者解回放应我方胜（${v.note ?? ''}）`).toBe(true);
      expect(
        v.randomWinRateOk,
        `${p.rowId} 乱选率 ${(v.randomWinRate * 100).toFixed(1)}% 应 <${PUZZLE_MAX_RANDOM_WIN_RATE * 100}%`,
      ).toBe(true);
      expect(v.ok).toBe(true);
    }
  });
});

describe('S7 每日推演·验解器防假过反例（验解器自身不能假过）', () => {
  it('反例①：作者解错误的题 → 闸 a 必拦（authorSolves=false）', async () => {
    const runtime = await runtimeOf();
    const base = clone(puzzlesOf(runtime)[0]); // 后排点名题（eHP 4 万+）
    // 把作者解换成"只上 1 个辅助包"——单艘低攻辅助绝无可能清完整支敌阵 → 必然超时输（故意造错解）。
    base.authorSolution = [{ packId: base.candidatePacks[0].packId, slotRef: 'p0c0' }];
    // 用极小采样即可（只验作者解那道闸）。
    const v = validateDailyPuzzle(runtime, base, { mcSamples: 1 });
    expect(v.authorSolves, '故意造的错误作者解必须被闸 a 拦下').toBe(false);
    expect(v.ok).toBe(false);
  });

  it('反例②：太简单的题（乱选率超标）→ 闸 b 必拦（randomWinRateOk=false）', async () => {
    const runtime = await runtimeOf();
    const base = clone(puzzlesOf(runtime)[0]);
    // 把敌阵削到只剩 1 个小兵、零缩放——随便选摆都能赢，乱选率必然远超 30%。
    base.enemyFormation = [{ unitStatRef: 'bu_enemy_swarm', slotRef: 'r2c1' }];
    base.enemyHpPct = 0;
    base.enemyAtkPct = 0;
    const v = validateDailyPuzzle(runtime, base, { mcSamples: 60 });
    expect(v.authorSolves, '削弱后的敌阵作者解当然还是能赢').toBe(true);
    expect(v.randomWinRateOk, `太简单的题乱选率 ${(v.randomWinRate * 100).toFixed(1)}% 必须被闸 b 拦`).toBe(false);
    expect(v.ok).toBe(false);
  });

  it('反例③：候选数越界的题 → 闸 c 必拦（candidateCountOk=false）', async () => {
    const runtime = await runtimeOf();
    const base = clone(puzzlesOf(runtime)[0]);
    base.candidatePacks = base.candidatePacks.slice(0, 5); // 5 < 6
    const v = validateDailyPuzzle(runtime, base, { mcSamples: 1 });
    expect(v.candidateCountOk, '候选 5 个 <6 必须被闸 c 拦').toBe(false);
    expect(v.ok).toBe(false);
  });
});
