// ⚠️ 生成件（tools/gen-corridor-scale.mjs）勿手改——定价重锚 v1。
// 回廊层强度的 φ 换算表：φ(P)=P/500 恒等（v1 刻度即强度·主线 K 合同同一条换算链·细表 §19）。
// 旧 strengthIndex 采样版（含 ~28k 反解器饱和）随刻度 v0 一并退役；本表=恒等线性（插值零误差），
// 保留查表形状=运行时消费面不变。growth_band/战力公式变动后重跑生成器（奇偶校验测试守同步）。

/** [战力P, φ] 采样点（线性插值）。 */
export const S7_CORRIDOR_PHI_TABLE: ReadonlyArray<readonly [number, number]> = [
  [100, 0.200000],
  [250, 0.500000],
  [500, 1.000000],
  [1000, 2.000000],
  [2000, 4.000000],
  [4000, 8.000000],
  [8000, 16.000000],
  [16000, 32.000000],
  [32000, 64.000000],
  [64000, 128.000000],
  [128000, 256.000000],
  [300000, 600.000000],
  [600000, 1200.000000],
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
