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
  S7_SHIP_LEVEL_POWER_FACTOR, S7_LEVEL_GATE_POWER, S7_PLUGIN_POWER,
} from '../assets/scripts/core/s7/S7PowerRating';
import { shipLevelCapForTier, pilotLevelCapForStar } from '../assets/scripts/core/s7/S7UnitTierState';
import { DEFAULT_S7_ASCEND_CONFIG } from '../assets/scripts/core/s7/S7AscendConfig';
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

  it('LF 表 镜像逐项一致 且 == growth_band 每轴倍数 × 节点门（出处守卫·1..50）', () => {
    // 重定基（段二 A3·旧→新→为什么对）：旧循环 1..100；等级上限 100→50 后 LF 表截断到 50 项
    // （51-100 段封存未来版本·growth_band 数据保留不删——本守卫只核可达段 1..50，封存段无 LF 定价可核）。
    expect(S7_SHIP_LEVEL_POWER_FACTOR.length).toBe(50);
    expect([...S7_SHIP_LEVEL_POWER_FACTOR]).toEqual(eco.TRUTHS.shipLevelFactor);
    const bands = JSON.parse(readFileSync(
      path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'growth_band_param.sample.json'), 'utf-8',
    )) as S7GrowthBandParam[];
    const base = unitPowerAtLevel(bands, 'ship', 1);
    for (let L = 1; L <= 50; L += 1) {
      let expected = unitPowerAtLevel(bands, 'ship', L) / base;
      for (const [gate, mult] of Object.entries(S7_LEVEL_GATE_POWER)) {
        if (L >= Number(gate)) expected *= mult;
      }
      expect(S7_SHIP_LEVEL_POWER_FACTOR[L - 1], `LF(${L})`).toBeCloseTo(expected, 3);
    }
  });

  it('等级上限两线镜像一致（段二 A3：C10/B20/A30/S40/SS50）', () => {
    // 三源对表：S7UnitTierState 运行时上限 == 经济尺 TRUTHS 上限（舰按阶/员按星）——单侧改动=红。
    expect([0, 1, 2, 3, 4].map(shipLevelCapForTier)).toEqual(eco.TRUTHS.shipLevelCapByTier);
    expect([1, 2, 3, 4, 5].map(pilotLevelCapForStar)).toEqual(eco.TRUTHS.pilotLevelCapByStar);
  });

  it('插件战力表 镜像逐项一致（段二 E7 扩传奇+/++＝90/110·数值域定报备）', () => {
    expect(S7_PLUGIN_POWER).toEqual(eco.TRUTHS.pluginPower);
  });

  it('升阶/升星成本梯 运行时默认表 == 机器真源（总控批发现①：真机占位 20/40/80/120 对齐 50/100/300/1000）', () => {
    // 为什么对：真源=GDD-附录D-星舰/驾驶员真源 §0＋细表 §6 支出侧＋TRUTHS（冲突裁决顺序机器真源最高）；
    // 旧默认表=v0.1 占位从未过真源。本守卫防"运行时成本与经济模型静默劈叉"复发。
    expect(DEFAULT_S7_ASCEND_CONFIG.shipTierStepCost.map((c) => c.exclusiveShards)).toEqual(eco.TRUTHS.shipAscendCost);
    expect(DEFAULT_S7_ASCEND_CONFIG.pilotStarStepCost.map((c) => c.exclusiveShards)).toEqual(eco.TRUTHS.pilotStarupCost);
  });
});
