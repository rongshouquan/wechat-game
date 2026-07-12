// 战力刻度公式 v1 单一真源（定价重锚专项批 2026-07-11·重标自实测）——战前界面、模拟器、成长积木全部 import 此处。
// 病根史（§16d 三段→§16e 发现1）：v0 刻度（阶基值 100/160/250/380/550·+8%/级线性·星系数乘整舰）
// 对高阶套件定价失真——同 24.5k 纸面：真实毕业态（2×SS·5★+3×S·4★）打 n150 100%/16s、反解态（5×S·4★）0%；
// φ 在 ≈28k 饱和、毕业墙战斗侧虚设。病根＝纸面涨速与真机强度涨速脱钩（等级线纸面 +8%/级 vs 真机每轴 +2.5%/级；
// SS 升阶/5★ 升星的技能质变纸面只标 +45%，实测 ×1.84/×1.33）。
//
// v1 重锚方法（实测锚定法·测量工具=tools/s7-power-recalib.mjs·数据=s7-power-recalib-data.json）：
// 对 29 个养成构成实测"胜率 50% 能吃下的敌强度倍数 s*"（k 合同标准靶·全真机世界·n=60 终点种子族），
// 拟合"同刻度≈同强度"的新定价（对数 LS·RMSE 2%）。锚点不动：C·Lv1 中位队＝500＝k 合同基准。
// 已知残差（记档）：①"练谁"维度（同资产集中养坦位/主输出位 vs 平摊五舰）实测差 1.2-1.5×——加法式
// 逐舰纸面结构上无法定价，归"搭配红利"域（拍板3 保留对象），墙点由 WALL_BOOST 重收敛吸收；
// ②SS·L100 实测强度与 L90 持平（独立种子族复测同结论），定价保单调按 LF 曲线走高＝顶端 ≤7% 高标；
// ③插件/核仍为固定加法项（本批未授权重定价）：新规模下插件占比≈真实价值（S 阶 +21% 纸面 vs +26% 实测·旧仅 +5.7%）。
//
// 口径：
//  - 战力=养成刻度参考值（Ron 拍板：同战力异搭配实战差数倍是设计而非 bug）；
//  - 插件与星核都计入战力（Ron 2026-06-20 拍板·有意覆盖 v1.0 §6"质变不计"）；
//  - 压力表 P 与本公式同量纲；重锚后"刻度即强度"＝φ 换算恒等化（entry mapPressureToEnemies）。
//
// ⚠️ 战斗侧行为零改动红线（定价重锚拍板2）：S7_TIER_ATTR_MULT / S7_PILOT_STAR_MULT / 带宽双基线
//    ＝真机战斗行为常量，本批一个数未动；刻度侧另立 *_POWER_* 定价表，两族禁止混用。

import { S7PluginQuality } from './S7PluginEffects';

/** 阶级基值（C/B/A/S/SS·v1 实测重标·旧 [100,160,250,380,550]）：邻比=实测升阶强度跳
 *  （C→B +8%/B→A +22%/A→S +36%/S→SS +79%·含 A/SS 技能质变——不再是拍脑袋的 1.6 等比）。 */
export const S7_TIER_POWER_BASE = [100, 108, 132, 180, 323] as const;
/** 【战斗侧】升阶战斗全属性乘（×1.26/阶·细表 §12.1——血/攻/甲同乘）。刻度定价禁用此值。 */
export const S7_TIER_ATTR_MULT = 1.26;
/** 【战斗侧】驾驶员星级战力系数（下标=星级 1-5；0 位占位）——喂 pilotNumericBlocks/strengthIndex
 *  的真机数值线（星系数×(1+0.01×驾级)−1 折 attack%/armor%），刻度定价禁用此表（一表两用已拆分）。 */
export const S7_PILOT_STAR_MULT = [1.0, 1.0, 1.08, 1.18, 1.3, 1.45] as const;
/** 【刻度定价专用·战斗侧禁用】星级刻度系数 v1（下标=星级 1-5；0 位占位·旧=挪用战斗表 [1,1.08,1.18,1.30,1.45]）：
 *  实测星级团队强度跳（3★/5★ 质变门大跳、2★/4★ 小步——1→2 +9%/2→3 +17%/3→4 +2%/4→5 +27%）。 */
export const S7_PILOT_STAR_POWER_MULT = [1.0, 1.0, 1.09, 1.27, 1.3, 1.65] as const;
/** 【刻度定价专用·战斗侧禁用】驾驶员等级刻度系数（旧 0.01=纸面 2 倍虚标·实测单轴数值线折团队强度≈半）。 */
export const S7_PILOT_LEVEL_POWER_COEF = 0.0036;
/** 【刻度定价专用·战斗侧禁用】舰等级刻度因子表（下标 = 级−1·1..50·段二 A3 截断＋R1 五档平移重算——
 *  旧表见 git 历史）：＝growth_band 每轴倍数 g(L) × 技能大节点门（R1 平移后 **L10 ×1.100 / L20 ×1.166**
 *  ·系数原值门位随内容平移；L30/40/50 档=旧 L60/80/100 内容平移·实测≈0 收益维持不加价=空门·忠实对应
 *  旧设计定价）。L40-50 段两门乘积与旧表相同＝毕业态纸面锚分毫不动（L50=3.2935）。
 *  同步守卫：tests 从 growth_band 重算比对（1..50）。 */
export const S7_LEVEL_GATE_POWER: Readonly<Record<number, number>> = { 10: 1.1, 20: 1.166 };
export const S7_SHIP_LEVEL_POWER_FACTOR = [
  1, 1.0704, 1.1407, 1.2111, 1.2815, 1.3519, 1.4222, 1.4926, 1.563, 1.7967,
  1.8608, 1.8965, 1.9321, 1.9678, 2.0034, 2.0391, 2.0747, 2.1104, 2.146, 2.5438,
  2.5652, 2.5913, 2.6175, 2.6436, 2.6697, 2.6958, 2.722, 2.7481, 2.7742, 2.8003,
  2.8217, 2.8478, 2.874, 2.9001, 2.9262, 2.9524, 2.9785, 3.0046, 3.0307, 3.0569,
  3.0782, 3.1022, 3.1261, 3.15, 3.1739, 3.1978, 3.2217, 3.2456, 3.2695, 3.2935,
] as const;
/** 插件战力（品质档）。传奇+/++＝段二 E7 扩档（数值域定·刻度诚实：+/++ 主数值沿传奇档，
 *  增量=附加条 ≈半件传奇附加当量 ~20/条 → 90/110；毕业态锚不受影响（毕业态插件非全传奇·
 *  +/++ 属毕业后追求）；2b 可用 s7-power-recalib 加构成实测复核。镜像=TRUTHS.pluginPower。 */
export const S7_PLUGIN_POWER: Record<S7PluginQuality, number> = {
  fine: 15, superior: 35, legendary: 70, legendaryPlus: 90, legendaryPlusPlus: 110,
};
/** 星核战力（装了就计·质变强度不折算·本批未动）。 */
export const S7_CORE_POWER = 120;

/**
 * 随机带宽基线（真机/模拟同源·带宽换档改这一处）。【战斗侧·本批零改动】
 * 中档转正（对锚与阶梯批·2026-07-10 Ron 拍板）：旧窄档 我方5%/×1.5+敌0 → 中档 我方15%/×1.75+敌10%/×1.5。
 * 如实记：⑩§20.13 探针当时敌方只设 rate 未设 dmg（暴伤×1.0=空转），对锚批按拍板语义落真值——
 * 敌伤期望比当时实测组 +5%，随段一墙循环重校一并吸收。
 */
export const S7_PLAYER_CRIT_BASE = { rate: 0.15, dmg: 0.75 } as const;
/** 敌方全体暴击基线（含 Boss/敌方召唤物；玩家侧召唤物不吃——注入点按 side 判）。 */
export const S7_ENEMY_CRIT_BASE = { rate: 0.1, dmg: 0.5 } as const;

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

/** 单舰战力 v1：(阶基值×LF(级) + Σ插件) × 星刻度系数×(1+0.0036×驾级) + 核。
 *  形状与 v0 同（插件在星乘区内、核在外）；三处换新：阶基值表 / 等级因子表 / 星刻度表＋驾级系数。 */
export function shipPowerV0(input: S7ShipPowerInput): number {
  const tier = Math.max(0, Math.min(S7_TIER_POWER_BASE.length - 1, Math.floor(input.tier)));
  // 段二 A3：等级夹紧 100→50（=S7_UNIT_MAX_LEVEL·LF 表 51-100 段随封存截断）。
  const level = Math.max(1, Math.min(S7_SHIP_LEVEL_POWER_FACTOR.length, Math.floor(input.level)));
  const base = S7_TIER_POWER_BASE[tier] * S7_SHIP_LEVEL_POWER_FACTOR[level - 1];
  const plug = input.pluginQualities.reduce((a, q) => a + (S7_PLUGIN_POWER[q] ?? 0), 0);
  const star = Math.max(0, Math.min(5, Math.floor(input.pilotStar)));
  const pilotMult = star >= 1
    ? S7_PILOT_STAR_POWER_MULT[star] * (1 + S7_PILOT_LEVEL_POWER_COEF * Math.max(0, input.pilotLevel))
    : 1;
  return (base + plug) * pilotMult + (input.withCore ? S7_CORE_POWER : 0);
}
