// 演习木桩配置常量（步5 收尾批回写·纯 TS，不依赖 cc）：GDD S10.8 作战大厅·演习木桩（2026-07-07 总修订案 1b）。
// 数值终值 = 初值表 v0.7 §6-2（机器真源 PARAMS.drill·照抄不调数——阈值增速 1.2510＝机器真源，
//   初值表 §6-2 文字"1.2577"为陈旧行〔白档二犯修正前的旧值·§18 教训③〕，成文批一并订正）。
// ⚠️ 本模块=数值面常量先落（木桩界面/60 秒档位战斗 = 工程灰盒批）——驾驶记录第一单源（B1 身份）。
//
// 结构：60 秒计分窗、20 档等比阈值（低档密高档疏）；打到第 N 档领 1..N 全部奖励、每日重置；
//   **无星域系数**（档位表自身即进度缩放）；档位阈值挂队伍 DPS（d≈0.40 DPS/战力=⑥细表 §9 量纲）。

/** 计分窗（秒）。 */
export const DRILL_WINDOW_SEC = 60;
/** 档位数（18→20=⑧第6轮结构修正·顶部加密治终局全档躺平）。 */
export const DRILL_TIERS = 20;
/** 档位阈值：第 k 档（1 起）要求 60 秒总伤 ≥ 8000 × 1.2510^(k−1)（顶档≈战力 23.5k=毕业段真实可达）。 */
export const DRILL_THRESHOLD_BASE = 8000;
export const DRILL_THRESHOLD_GROWTH = 1.2510;
/** 档位奖励：第 k 档 = 90 × 1.165^(k−1) 驾驶记录（打到 N 档领 1..N 累计·每日重置）。 */
export const DRILL_REWARD_BASE = 90;
export const DRILL_REWARD_GROWTH = 1.165;
/** 战力→DPS 换算（⑥细表 §9 量纲合同 d≈0.40·推荐档位显示用）。 */
export const DRILL_DPS_PER_POWER = 0.40;

/** 第 k 档（1 起）的伤害阈值。 */
export function drillTierThreshold(k: number): number {
  const t = Math.max(1, Math.min(DRILL_TIERS, Math.floor(k)));
  return DRILL_THRESHOLD_BASE * Math.pow(DRILL_THRESHOLD_GROWTH, t - 1);
}
/** 第 k 档（1 起）的单档奖励（驾驶记录·四舍五入）。 */
export function drillTierReward(k: number): number {
  const t = Math.max(1, Math.min(DRILL_TIERS, Math.floor(k)));
  return Math.round(DRILL_REWARD_BASE * Math.pow(DRILL_REWARD_GROWTH, t - 1));
}
/** 打到第 N 档的累计奖励（1..N 求和·每日重置口径）。 */
export function drillCumulativeReward(n: number): number {
  let sum = 0;
  for (let k = 1; k <= Math.min(Math.max(0, Math.floor(n)), DRILL_TIERS); k += 1) sum += drillTierReward(k);
  return sum;
}
/** 某总伤能打到的最高档（0=一档没到）。 */
export function drillTierForDamage(totalDamage: number): number {
  let k = 0;
  for (let i = 1; i <= DRILL_TIERS; i += 1) {
    if (totalDamage >= drillTierThreshold(i)) k = i; else break;
  }
  return k;
}
