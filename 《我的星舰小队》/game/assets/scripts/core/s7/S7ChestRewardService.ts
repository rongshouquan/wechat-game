// 宝箱开箱引擎（阶段一 H-step1，纯 TS，不依赖 cc / Math.random / Date / 存档 / 配置运行时）：v1.0 §10.6。
//
// 职责（纯函数·确定性·可单测）：
//   - rollChestOptions：把某宝箱的固定选项集掷量解析成具体奖励列表（供 UI 展示·玩家选 freePicks+adPicks 个）。
//   - chestPickLimits：该宝箱免费/看广告可选数。
//   星辉货舱(§10.6) = 3 选项(星核碎片/星空宝石/信标包) → 免费选 1 + 看广告再选 1。
//
// 边界：本引擎不读存档/不扣宝箱库存——开箱次数(openChest 扣库存)与选取状态(选哪几个)由应用侧(控制器)管。
//   随机用注入的 S7AutoBattleRng（确定可测）；发放 manifest 由应用侧入账（资源→钱包·信标包逐档加）。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import { S7ChestRewardConfig, S7ChestReward, S7ChestOptionTemplate } from './S7ChestRewardConfig';

/** [min,max] 闭区间整数（max<min 时取 min）。 */
function rollAmount(min: number, max: number, rng: S7AutoBattleRng): number {
  if (max <= min) return min;
  return min + rng.nextInt(max - min + 1);
}

/** 加权取一个信标档 resourceId（tiers 非空）。 */
function pickTier(tiers: { resourceId: string; weight: number }[], rng: S7AutoBattleRng): string {
  const total = tiers.reduce((s, t) => s + Math.max(0, t.weight), 0);
  if (total <= 0) return tiers[Math.min(tiers.length - 1, rng.nextInt(tiers.length))].resourceId;
  let x = rng.next() * total;
  for (const t of tiers) {
    x -= Math.max(0, t.weight);
    if (x < 0) return t.resourceId;
  }
  return tiers[tiers.length - 1].resourceId;
}

/** 把一个开箱选项模板解析成具体奖励（掷量；信标包逐个掷档后按档合并）。 */
export function resolveChestOption(tpl: S7ChestOptionTemplate, rng: S7AutoBattleRng): S7ChestReward {
  if (tpl.kind === 'resourceRange') {
    return { kind: 'resource', resourceId: tpl.resourceId, amount: rollAmount(tpl.min, tpl.max, rng) };
  }
  // beaconBundle：掷个数 → 逐个掷品质 → 按档合并。
  const count = rollAmount(tpl.minCount, tpl.maxCount, rng);
  const tally = new Map<string, number>();
  for (let i = 0; i < count; i += 1) {
    const rid = pickTier(tpl.tierWeights, rng);
    tally.set(rid, (tally.get(rid) ?? 0) + 1);
  }
  const items: { resourceId: string; amount: number }[] = [];
  tally.forEach((amount, resourceId) => items.push({ resourceId, amount }));
  return { kind: 'beaconBundle', items };
}

/**
 * 开箱：把某宝箱的固定选项集逐个掷量解析成具体奖励列表（顺序同 config·供 UI 展示）。
 *  确定性：同 config + 同 chestId + 同 rng 序列 → 同结果。未知宝箱 → 空数组。
 */
export function rollChestOptions(config: S7ChestRewardConfig, chestId: string, rng: S7AutoBattleRng): S7ChestReward[] {
  const def = config.chests[chestId];
  if (!def) return [];
  return def.options.map((o) => resolveChestOption(o, rng));
}

/** 该宝箱的免费/看广告可选数（未知宝箱 → 0/0）。 */
export function chestPickLimits(config: S7ChestRewardConfig, chestId: string): { free: number; ad: number } {
  const def = config.chests[chestId];
  return def ? { free: def.freePicks, ad: def.adPicks } : { free: 0, ad: 0 };
}
