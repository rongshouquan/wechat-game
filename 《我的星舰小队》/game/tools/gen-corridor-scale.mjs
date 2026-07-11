#!/usr/bin/env node
// 定价重锚 v1 · 生成回廊 φ 换算表（S7CorridorScaleTable.ts·生成件勿手改）。
// 原理：回廊层强度走主线同一条 K 合同（pool=K_HP×500×φpool·dps=K_DPS×500×φdps^{>1?1.08}）。
// φ 真值变更（旧→新→为什么对）：旧 φ=strengthIndex(P)/strengthIndex(500)（反解器+growth_band
// 分析链·吸收 v0 刻度与强度的换算漂移）；v1 刻度按实测重标后"刻度即强度"（s7-power-recalib·
// RMSE 2%），φ(P)=P/500 恒等——补丁随根因拆除（entry strengthIndex 已删·本表同步恒等采样）。
// 保留查表+插值形状：运行时消费面（corridorPhi）与奇偶校验测试零改动成本。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'assets', 'scripts', 'core', 's7', 'S7CorridorScaleTable.ts');

// 采样：恒等函数线性插值零误差——两点即精确；保留对数网格若干点纯为可读性/未来非线性留位。
const POINTS = [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 300000, 600000];
const rows = POINTS.map((P) => `  [${P}, ${(P / 500).toFixed(6)}],`);

const body = `// ⚠️ 生成件（tools/gen-corridor-scale.mjs）勿手改——定价重锚 v1。
// 回廊层强度的 φ 换算表：φ(P)=P/500 恒等（v1 刻度即强度·主线 K 合同同一条换算链·细表 §19）。
// 旧 strengthIndex 采样版（含 ~28k 反解器饱和）随刻度 v0 一并退役；本表=恒等线性（插值零误差），
// 保留查表形状=运行时消费面不变。growth_band/战力公式变动后重跑生成器（奇偶校验测试守同步）。

/** [战力P, φ] 采样点（线性插值）。 */
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
console.log(`[gen-corridor-scale] 写出 ${OUT}（${POINTS.length} 采样点·φ 恒等=P/500）`);
