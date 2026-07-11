// 回廊 φ 表奇偶校验（定价重锚 v1 重定基）：生成表（S7CorridorScaleTable·运行时插值）必须与
// 现行 φ 真值逐点吻合。真值变更记录（旧→新→为什么对）：
//   旧真值=strengthIndex(plan(P))/strengthIndex(500)（反解器+growth_band 分析链）——它是给
//   "v0 刻度≠强度"打的换算补丁；新真值=P/500 恒等——v1 刻度按实测重标后"刻度即强度"
//   （tools/s7-power-recalib.mjs·RMSE 2%），补丁随根因拆除（strengthIndex 已删·entry 同步）。
// growth_band / 战力公式任一变动而忘记重跑 tools/gen-corridor-scale.mjs → 本测试红。
import { describe, it, expect } from 'vitest';
import { corridorPhi } from '../assets/scripts/core/s7/S7CorridorScaleTable';

describe('定价重锚 · 回廊 φ 表 == 恒等真值（生成件同步守卫）', () => {
  it('φ(P)=P/500 逐点吻合（±1% 容差=表插值误差）·锚点 φ(500)=1·锚下线性段', () => {
    // 采样带=新刻度全程（毕业段压力 ~1 万量级·反解器顶 ~1.9 万·深层回廊外推段一并采）
    for (const p of [500, 800, 1600, 3000, 6000, 9000, 12000, 16000, 19000]) {
      const truth = p / 500;
      const table = corridorPhi(p);
      expect(Math.abs(table - truth) / truth, `φ(${p}) 表=${table} 真=${truth}`).toBeLessThanOrEqual(0.01);
    }
    expect(corridorPhi(500)).toBeCloseTo(1, 1);
    expect(corridorPhi(250)).toBeCloseTo(0.5, 1);
  });
});
