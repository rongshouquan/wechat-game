// 定价重锚批 · 刻度 v1 双源同步守卫（深度自检补件——没有这守卫，S7PowerRating.ts 与
// simulate-s7-economy.mjs TRUTHS 两份镜像可被单侧改动而全绿=显示与经济静默劈叉）。
// ① 镜像对表：TS 单源常量 == 经济尺 TRUTHS 镜像（阶基值/星刻度表/驾级系数/LF 表逐项）；
// ② LF 表出处守卫：S7_SHIP_LEVEL_POWER_FACTOR 必须 == growth_band 每轴倍数 × 技能节点门
//    （S7_LEVEL_GATE_POWER·L20/L40）——growth_band 改了忘记重生成 LF 表=此测红。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7_TIER_POWER_BASE, S7_PILOT_STAR_POWER_MULT, S7_PILOT_LEVEL_POWER_COEF,
  S7_SHIP_LEVEL_POWER_FACTOR, S7_LEVEL_GATE_POWER,
} from '../assets/scripts/core/s7/S7PowerRating';
import { unitPowerAtLevel } from '../assets/scripts/core/s7/S7UnitGrowth';
import { S7GrowthBandParam } from '../assets/scripts/config/s7/ConfigTypesS7';
// 经济尺=纯 .mjs（tsc 走 d.mts 声明）；vitest 下动态 import 运行时真值。
// eslint-disable-next-line @typescript-eslint/no-require-imports
import * as eco from '../tools/simulate-s7-economy.mjs';

describe('定价重锚 · 刻度 v1 双源同步（S7PowerRating ↔ 经济尺 TRUTHS）', () => {
  it('阶基值/星刻度表/驾级系数 镜像逐项一致', () => {
    expect([...S7_TIER_POWER_BASE]).toEqual(eco.TRUTHS.tierBase);
    // TS 表 0 位占位（星 0/1 都是 1.0），经济尺表下标=星级−1。
    expect(S7_PILOT_STAR_POWER_MULT.slice(1)).toEqual(eco.TRUTHS.pilotStarCoef);
    expect(S7_PILOT_LEVEL_POWER_COEF).toBe(eco.TRUTHS.pilotLevelPct);
  });

  it('LF 表 镜像逐项一致 且 == growth_band 每轴倍数 × 节点门（出处守卫）', () => {
    expect([...S7_SHIP_LEVEL_POWER_FACTOR]).toEqual(eco.TRUTHS.shipLevelFactor);
    const bands = JSON.parse(readFileSync(
      path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'growth_band_param.sample.json'), 'utf-8',
    )) as S7GrowthBandParam[];
    const base = unitPowerAtLevel(bands, 'ship', 1);
    for (let L = 1; L <= 100; L += 1) {
      let expected = unitPowerAtLevel(bands, 'ship', L) / base;
      for (const [gate, mult] of Object.entries(S7_LEVEL_GATE_POWER)) {
        if (L >= Number(gate)) expected *= mult;
      }
      expect(S7_SHIP_LEVEL_POWER_FACTOR[L - 1], `LF(${L})`).toBeCloseTo(expected, 3);
    }
  });
});
