// 星核三渠道 + 星空宝库引擎（阶段一 I-step1，纯 TS，不依赖 cc / Math.random / Date / 存档）：v1.0 §5.4 / §9.3 / §10.4。
//
// 纯函数·确定性·可单测：
//   - synthesizeCore：星核碎片随机合成 1 颗（够碎片→从 synthesisPool 随机出·返回 fragSpent 供调用方扣账）。
//   - rollExpansionChoices：扩张宝藏开箱——首次=全池自选；非首次=随机三选一（无放回）。
//   - vaultCoreViews / vaultShipViews：星空宝库展示视图（owned 一次性解锁 / affordable / 限定核标记）。
// 不扣账/不发核：碎片/宝石扣减与 grantCore/grantShip 由应用侧做（与配置/存档解耦）。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import { S7CoreSourceConfig } from './S7CoreSourceConfig';

export type S7SynthResult =
  | { ok: true; coreId: string; fragSpent: number }
  | { ok: false; reason: 'insufficient' | 'empty_pool' };

/** 星核碎片随机合成 1 颗（够碎片→从 synthesisPool 随机出 1 颗）。不扣账：返回 fragSpent 供调用方扣 coreFrag。 */
export function synthesizeCore(config: S7CoreSourceConfig, fragHave: number, rng: S7AutoBattleRng): S7SynthResult {
  if (!Array.isArray(config.synthesisPool) || config.synthesisPool.length === 0) return { ok: false, reason: 'empty_pool' };
  if (typeof fragHave !== 'number' || fragHave < config.synthesisCost) return { ok: false, reason: 'insufficient' };
  const coreId = rng.pick(config.synthesisPool);
  if (!coreId) return { ok: false, reason: 'empty_pool' };
  return { ok: true, coreId, fragSpent: config.synthesisCost };
}

/**
 * 扩张宝藏开箱的核选项（§5.4/§10.5）：
 *  - isFirstSelect=true（首次·第7天）→ 返回**全池**供自选（全部 expansionPool）。
 *  - 否则 → **随机三选一**（无放回·从 expansionPool 取 expansionChoiceCount 个不同）。
 *  空池 → 空数组。确定性：同 rng 序列同结果。
 */
export function rollExpansionChoices(config: S7CoreSourceConfig, isFirstSelect: boolean, rng: S7AutoBattleRng): string[] {
  const pool = Array.isArray(config.expansionPool) ? config.expansionPool.slice() : [];
  if (pool.length === 0) return [];
  if (isFirstSelect) return pool; // 全池自选
  const out: string[] = [];
  const n = Math.min(Math.max(1, config.expansionChoiceCount), pool.length);
  for (let k = 0; k < n; k += 1) {
    const i = rng.nextInt(pool.length);
    out.push(pool.splice(i, 1)[0]); // 无放回
  }
  return out;
}

/** 宝库星核兑换项视图（owned=已一次性解锁·limited=宝库限定核·affordable=宝石够）。 */
export interface S7VaultCoreView {
  coreId: string;
  gemCost: number;
  owned: boolean;
  limited: boolean;
  affordable: boolean;
}

export function vaultCoreViews(config: S7CoreSourceConfig, ownedCoreIds: string[], gemHave: number): S7VaultCoreView[] {
  const ownedSet = new Set(ownedCoreIds);
  const limSet = new Set(config.vaultLimitedCoreIds);
  return config.vaultCores.map((e) => ({
    coreId: e.coreId,
    gemCost: e.gemCost,
    owned: ownedSet.has(e.coreId),
    limited: limSet.has(e.coreId),
    affordable: gemHave >= e.gemCost,
  }));
}

/** 宝库专属舰兑换项视图（owned=已拥有·affordable=宝石够）。 */
export interface S7VaultShipView {
  shipId: string;
  gemCost: number;
  owned: boolean;
  affordable: boolean;
}

export function vaultShipViews(config: S7CoreSourceConfig, ownedShipIds: string[], gemHave: number): S7VaultShipView[] {
  const ownedSet = new Set(ownedShipIds);
  return config.vaultShips.map((e) => ({
    shipId: e.shipId,
    gemCost: e.gemCost,
    owned: ownedSet.has(e.shipId),
    affordable: gemHave >= e.gemCost,
  }));
}
