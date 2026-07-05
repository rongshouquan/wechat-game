// 今日补给箱（第2.5块·块5，纯 TS，不依赖 cc）：GDD-v2.0 S13.2 #2 + S10.10"日常礼物清单"。
// 主界面活动区旁的小礼盒岛：每日 1 次看广告开箱（白送型·附录B B1.1）；当日已开→礼盒隐藏（凌晨4点日界再现）；
// 持广告券→按 S7AdPointPolicy 三态恢复显示（券开的当日第 2/3 箱换掷奖序号，内容不重复同一份）。
//
// 内容=轻随机资源包（S10.10 定死结构）：合金/驾驶记录/星贝小额组合 + 小概率 1 张普通信标 或 少量通用碎片。
// **按 s7DayKey 确定性预掷**（照回港报告成例·种子=supply_chest_<dayKey>_<openIndex>·禁 Math.random）：
//   杀进程重进同日同序号 → 同内容；开箱记数走 S7AdDailyCounter（点位 daily_supply_chest），不新增存档字段。
// 量级全 v0.1 占位（exported const·第三块数值校准统一精校）。"空盒隐入背景"演出留美术阶段。

import { S7AutoBattleRng } from './S7AutoBattleRng';

/** 广告点位 id（S13.2 #2）。 */
export const DAILY_SUPPLY_CHEST_AD_POINT = 'daily_supply_chest';

// ===== 占位数值（第三块统一校准；改这里不改逻辑）=====
/** 基础组合量（±抖动前）：合金 / 驾驶记录 / 星贝。 */
export const SUPPLY_CHEST_ALLOY_BASE = 40;
export const SUPPLY_CHEST_TOKEN_BASE = 30;
export const SUPPLY_CHEST_CARGO_BASE = 10;
/** 各量抖动幅度（±pct·0.2=±20%·确定性 rng 掷）。 */
export const SUPPLY_CHEST_JITTER_PCT = 0.2;
/** 小概率彩蛋：普通信标×1 概率（0-1）。 */
export const SUPPLY_CHEST_BEACON_CHANCE = 0.12;
/** 未中信标时：少量通用碎片概率（0-1）+ 数量（舰/员碎片随机其一）。 */
export const SUPPLY_CHEST_SHARD_CHANCE = 0.25;
export const SUPPLY_CHEST_SHARD_AMOUNT = 4;

/**
 * 掷一份今日补给箱内容（确定性·纯函数）：dayKey=全游戏统一日界（s7DayKey），openIndex=今日第几次开（1 起·
 * 正常每日 1 次恒为 1；广告券重开取 2/3…，同日不同序号内容不同、但都确定可复算）。
 * 返回 资源键→数量 的入账清单（全为正整数）。
 */
export function rollDailySupplyChest(dayKey: number, openIndex: number): Record<string, number> {
  const rng = new S7AutoBattleRng(`supply_chest_${dayKey}_${openIndex}`);
  const jitter = (base: number): number => {
    const f = 1 + (rng.next() * 2 - 1) * SUPPLY_CHEST_JITTER_PCT; // [1-pct, 1+pct)
    return Math.max(1, Math.round(base * f));
  };
  const out: Record<string, number> = {
    hullAlloy: jitter(SUPPLY_CHEST_ALLOY_BASE),
    pilotToken: jitter(SUPPLY_CHEST_TOKEN_BASE),
    starCargo: jitter(SUPPLY_CHEST_CARGO_BASE),
  };
  // 彩蛋层：小概率普通信标×1；未中则再掷"少量通用碎片"（舰/员随机其一）；两层都未中=纯软货币组合。
  if (rng.next() < SUPPLY_CHEST_BEACON_CHANCE) {
    out.beaconCommon = 1;
  } else if (rng.next() < SUPPLY_CHEST_SHARD_CHANCE) {
    out[rng.next() < 0.5 ? 'shipBlueprint' : 'pilotShardUniversal'] = SUPPLY_CHEST_SHARD_AMOUNT;
  }
  return out;
}
