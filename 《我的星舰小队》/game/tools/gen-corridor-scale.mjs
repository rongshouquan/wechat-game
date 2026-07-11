#!/usr/bin/env node
// 对锚与阶梯批 · 生成回廊 φ 换算表（S7CorridorScaleTable.ts·生成件勿手改）。
// 原理：回廊层强度走主线同一条 K 合同（pool=K_HP×500×φpool·dps=K_DPS×500×φdps^{>1?1.08}），
// φ=strengthIndex(P)/strengthIndex(500)（tools/s7-battles-entry.ts·依赖反解器+growth_band）——
// 运行时不移植反解器，改由本工具采样生成查表+线性插值；growth_band/K 合同/战力公式任一变动后
// 重跑本工具重生成（奇偶校验测试=tests/s7_corridor_scale_parity.test.ts 会红）。
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'assets', 'scripts', 'core', 's7', 'S7CorridorScaleTable.ts');

const tmp = mkdtempSync(path.join(tmpdir(), 's7-phigen-'));
const outfile = path.join(tmp, 'entry.mjs');
await build({
  entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
  bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
});
process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(outfile).href);

// 采样：P 从 100 到 600k 对数网格 ×1.05 ＋ 150 关压力表全点（关键点零插值误差——
// φ=反解器台阶函数，墙压力值可能正骑在台阶上，如 3912 曾被网格插值差 9%）。
const POINTS = [];
let p = 100;
while (p <= 600000) {
  POINTS.push(Math.round(p));
  p *= 1.05;
}
for (const v of mod.loadPressure()) if (v > 0) POINTS.push(Math.round(v));
POINTS.sort((a, b) => a - b);
const DEDUP = [...new Set(POINTS)];
POINTS.length = 0;
POINTS.push(...DEDUP);
const base = mod.strengthIndex(500, 'dps');
const rows = POINTS.map((P) => {
  const phi = P <= 500 ? P / 500 : mod.strengthIndex(P, 'dps') / base;
  return `  [${P}, ${phi.toFixed(6)}],`;
});

const body = `// ⚠️ 生成件（tools/gen-corridor-scale.mjs）勿手改——对锚与阶梯批。
// 回廊层强度的 φ 换算表：φ(P)=strengthIndex(P)/strengthIndex(500)（主线 K 合同同一条换算链·
// 细表 §19）；growth_band/战力公式/K 合同变动后重跑生成器（奇偶校验测试守同步）。
// φ 在 ~28k（反解器顶=SS·L100）后饱和=主线同款行为，深层回廊难度随之封顶（对锚批已上报）。

/** [战力P, φ] 采样点（对数网格·线性插值）。 */
export const S7_CORRIDOR_PHI_TABLE: ReadonlyArray<readonly [number, number]> = [
${rows.join('\n')}
] as const;

/** φ(P)：表内线性插值；表外夹取端点。 */
export function corridorPhi(power: number): number {
  const t = S7_CORRIDOR_PHI_TABLE;
  if (power <= t[0][0]) return (t[0][1] * power) / t[0][0];
  const last = t[t.length - 1];
  if (power >= last[0]) return last[1];
  for (let i = 1; i < t.length; i += 1) {
    if (power <= t[i][0]) {
      const [p0, f0] = t[i - 1];
      const [p1, f1] = t[i];
      const k = (power - p0) / (p1 - p0);
      return f0 + (f1 - f0) * k;
    }
  }
  return last[1];
}
`;
writeFileSync(OUT, body);
console.log(`[gen-corridor-scale] 写出 ${OUT}（${POINTS.length} 采样点·φ(500)=1）`);
rmSync(tmp, { recursive: true, force: true });
