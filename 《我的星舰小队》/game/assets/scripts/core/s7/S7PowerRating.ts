// 战力公式 v0 单一真源（机制批③段三·躯干重校）——初值表 §3 的工程落点。
// 病根（§16d 三段）：此前"纸面战力"有两套量纲——战前界面占位公式（成长战力+固定加成）与
// 经济尺/压力表所用的 v0 公式（模拟器本地复制）互不相认，"我方战力 vs 推荐战力"跨量纲没法看；
// 且真机升阶/升星数值走占位百分比表（+12..72%），与校准世界（×1.26^阶 全属性）两个世界。
// 本件把 v0 公式与战斗数值线常量收拢成单点：战前界面、模拟器、成长积木全部 import 此处。
//
// 口径：
//  - 战力=养成刻度参考值（Ron 拍板：同战力异搭配实战差数倍是设计而非 bug）；
//  - 插件与星核都计入战力（Ron 2026-06-20 拍板·有意覆盖 v1.0 §6"质变不计"）；
//  - 压力表 P 与本公式同量纲（经济尺双锚生成法按 v0 战力锚定）。

import { S7PluginQuality } from './S7PluginEffects';

/** 阶级基值（C/B/A/S/SS·初值表 §3）。 */
export const S7_TIER_POWER_BASE = [100, 160, 250, 380, 550] as const;
/** 升阶战斗全属性乘（×1.26/阶·细表 §12.1——血/攻/甲同乘）。 */
export const S7_TIER_ATTR_MULT = 1.26;
/** 驾驶员星级战力系数（下标=星级 1-5；0 位占位）。 */
export const S7_PILOT_STAR_MULT = [1.0, 1.0, 1.08, 1.18, 1.3, 1.45] as const;
/** 插件战力（品质档）。 */
export const S7_PLUGIN_POWER: Record<S7PluginQuality, number> = { fine: 15, superior: 35, legendary: 70 };
/** 星核战力（装了就计·质变强度不折算）。 */
export const S7_CORE_POWER = 120;

/** 玩家侧暴击基线（随机带宽"窄档"现行值·细表 §16c M8——真机/模拟同源，带宽换档改这一处）。 */
export const S7_PLAYER_CRIT_BASE = { rate: 0.05, dmg: 0.5 } as const;

export interface S7ShipPowerInput {
  /** 阶级下标 0=C … 4=SS。 */
  tier: number;
  /** 星舰等级（1 起）。 */
  level: number;
  /** 三槽插件品质（缺槽少传）。 */
  pluginQualities: S7PluginQuality[];
  /** 是否装星核。 */
  withCore: boolean;
  /** 驾驶员星级（1-5；0/无驾驶员=不乘）。 */
  pilotStar: number;
  /** 驾驶员等级（0 起）。 */
  pilotLevel: number;
}

/** 单舰战力 v0：(阶基值×(1+0.08×(级−1)) + Σ插件) × 星系数×(1+0.01×驾级) + 核。 */
export function shipPowerV0(input: S7ShipPowerInput): number {
  const tier = Math.max(0, Math.min(S7_TIER_POWER_BASE.length - 1, Math.floor(input.tier)));
  const level = Math.max(1, Math.floor(input.level));
  const base = S7_TIER_POWER_BASE[tier] * (1 + 0.08 * (level - 1));
  const plug = input.pluginQualities.reduce((a, q) => a + (S7_PLUGIN_POWER[q] ?? 0), 0);
  const star = Math.max(0, Math.min(5, Math.floor(input.pilotStar)));
  const pilotMult = star >= 1 ? S7_PILOT_STAR_MULT[star] * (1 + 0.01 * Math.max(0, input.pilotLevel)) : 1;
  return (base + plug) * pilotMult + (input.withCore ? S7_CORE_POWER : 0);
}
