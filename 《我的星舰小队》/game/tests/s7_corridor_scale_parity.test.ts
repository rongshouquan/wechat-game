// 对锚与阶梯批 · 回廊 φ 表奇偶校验：生成表（S7CorridorScaleTable·运行时插值）必须与
// 工具侧真 φ（tools/s7-battles-entry strengthIndex·反解器+growth_band 全链）逐点吻合。
// growth_band / 战力公式 / 反解器任一变动而忘记重跑 tools/gen-corridor-scale.mjs → 本测试红。
import { describe, it, expect } from 'vitest';
import { corridorPhi } from '../assets/scripts/core/s7/S7CorridorScaleTable';
import { strengthIndex } from '../tools/s7-battles-entry';

describe('对锚批 · 回廊 φ 表 == 工具真 φ（生成件同步守卫）', () => {
  it('采样点逐点吻合（±6% 容差=反解器台阶跳变半高·网格×1.05）·锚点 φ(500)=1·锚下线性段', () => {
    const base = strengthIndex(500, 'dps');
    for (const p of [500, 800, 1660, 3912, 7050, 11668, 16954, 32094, 60000, 200000]) {
      const truth = p <= 500 ? p / 500 : strengthIndex(p, 'dps') / base;
      const table = corridorPhi(p);
      expect(Math.abs(table - truth) / truth, `φ(${p}) 表=${table} 真=${truth}`).toBeLessThanOrEqual(0.06);
    }
    expect(corridorPhi(500)).toBeCloseTo(1, 1);
    expect(corridorPhi(250)).toBeCloseTo(0.5, 1);
  });
});
