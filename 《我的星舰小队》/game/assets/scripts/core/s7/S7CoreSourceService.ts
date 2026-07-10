// 星核渠道引擎（步5 收尾批回写·纯 TS，不依赖 cc / Math.random / Date / 存档）：星核真源渠道矩阵 + v0.7 终值。
//
// 纯函数·确定性·可单测：
//   - synthesizeCore：碎片开蛋（13 常规·2 强常规 w0.035 头奖·前 5 颗保底·展厅 Lv10 双黄蛋 3% 第二颗限流通款）。
//   - rollExpansionChoices：扩张宝藏开箱——首次=全池自选；非首次=随机三选一（保底期"三张至少两张未拥有"+曲率星门欧皇线 p0.04）。
//   - pickCoreWithPity：随机整核渠道通用保底选择器（黑市小件/宝箱等灰盒批接线同用）。
//   - vaultCoreViews / vaultShipViews：宝库展示视图（流通核复购 ×1.5 递增按已拥有份数计价；毕业核唯一解锁）。
// 不扣账/不发核：碎片/宝石扣减与 grantCore/grantShip 由应用侧做（与配置/存档解耦）。
// 抽卡/开蛋 RNG 口径（2026-07-09 三连拍①）：抽取瞬间现掷、不掺玩家盐（账号欧非不建号定死）。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import { S7CoreSourceConfig, DEFAULT_S7_CORE_SOURCE_CONFIG } from './S7CoreSourceConfig';

/** 保底期判定：已拥有种类 < distinctPity → 随机整核渠道只出未拥有款。 */
export function corePityActive(config: S7CoreSourceConfig, ownedDistinctCount: number): boolean {
  return Math.max(0, Math.floor(ownedDistinctCount)) < config.distinctPity;
}

/**
 * 随机整核渠道通用选择器（保底前 5 颗不重复·细案§二1）：
 *  保底期 → 池按"未拥有"过滤（全拥有=退回全池·防空池）；非保底期 → 全池。
 *  weights 缺省=均匀；返回选中 coreId（空池 null）。
 */
export function pickCoreWithPity(
  pool: readonly string[], weights: readonly number[] | null,
  config: S7CoreSourceConfig, ownedCoreIds: readonly string[], rng: S7AutoBattleRng,
): string | null {
  if (pool.length === 0) return null;
  const ownedSet = new Set(ownedCoreIds);
  let candidates = pool.map((id, i) => ({ id, w: weights ? Math.max(0, weights[i] ?? 0) : 1 }));
  if (corePityActive(config, ownedSet.size)) {
    const unowned = candidates.filter((c) => !ownedSet.has(c.id));
    if (unowned.length > 0) candidates = unowned;
  }
  const total = candidates.reduce((s, c) => s + c.w, 0);
  if (total <= 0) return candidates[rng.nextInt(candidates.length)]?.id ?? null;
  let x = rng.next() * total;
  for (const c of candidates) { x -= c.w; if (x < 0) return c.id; }
  return candidates[candidates.length - 1].id;
}

/** 开蛋池权重（2 强常规各 eggStrongWeight·其余 11 颗均分剩余概率）。 */
export function eggWeights(config: S7CoreSourceConfig): number[] {
  const strong = new Set(config.strongRegularIds);
  const nStrong = config.synthesisPool.filter((id) => strong.has(id)).length;
  const nRest = config.synthesisPool.length - nStrong;
  const restW = nRest > 0 ? (1 - config.eggStrongWeight * nStrong) / nRest : 0;
  return config.synthesisPool.map((id) => (strong.has(id) ? config.eggStrongWeight : restW));
}

export type S7SynthResult =
  | { ok: true; coreIds: string[]; fragSpent: number; doubleYolk: boolean }
  | { ok: false; reason: 'insufficient' | 'empty_pool' };

/**
 * 星核碎片开蛋（60 碎/蛋）：13 常规池加权随机（强常规 w0.035 头奖）+ 前 5 颗保底 +
 * 双黄蛋（doubleYolkP>0 即生效=展厅 Lv10·第二颗限流通款·第二颗同吃保底）。
 * 不扣账：返回 fragSpent 供调用方扣 coreFrag；coreIds 长度 1 或 2。
 * doubleYolkP 由调用方传生效值（galleryDoubleYolkP(展厅等级)·未满级=0）。
 */
export function synthesizeCore(
  config: S7CoreSourceConfig, fragHave: number, rng: S7AutoBattleRng,
  ownedCoreIds: readonly string[] = [], doubleYolkP = 0,
): S7SynthResult {
  if (!Array.isArray(config.synthesisPool) || config.synthesisPool.length === 0) return { ok: false, reason: 'empty_pool' };
  if (typeof fragHave !== 'number' || fragHave < config.synthesisCost) return { ok: false, reason: 'insufficient' };
  const first = pickCoreWithPity(config.synthesisPool, eggWeights(config), config, ownedCoreIds, rng);
  if (!first) return { ok: false, reason: 'empty_pool' };
  const coreIds = [first];
  let doubleYolk = false;
  if (doubleYolkP > 0 && rng.next() < doubleYolkP && config.flowCoreIds.length > 0) {
    // 第二颗限流通款；保底判定含第一颗（就地拥有）。
    const second = pickCoreWithPity(config.flowCoreIds, null, config, [...ownedCoreIds, first], rng);
    if (second) { coreIds.push(second); doubleYolk = true; }
  }
  return { ok: true, coreIds, fragSpent: config.synthesisCost, doubleYolk };
}

/**
 * 扩张宝藏开箱的核选项（§5.4/§10.5 + 保底 + 欧皇线）：
 *  - isFirstSelect=true（首次·第7天）→ 返回**全池**供自选（全部 expansionPool）。
 *  - 否则 → 随机三选一（无放回）：保底期"三张至少两张未拥有"（细案§二1）；
 *    曲率星门欧皇线：p0.04 把其中一张换成 core17（已拥有则不换）。
 *  空池 → 空数组。确定性：同 rng 序列同结果。
 */
export function rollExpansionChoices(
  config: S7CoreSourceConfig, isFirstSelect: boolean, rng: S7AutoBattleRng,
  ownedCoreIds: readonly string[] = [],
): string[] {
  const pool = Array.isArray(config.expansionPool) ? config.expansionPool.slice() : [];
  if (pool.length === 0) return [];
  if (isFirstSelect) return pool; // 全池自选
  const ownedSet = new Set(ownedCoreIds);
  const n = Math.min(Math.max(1, config.expansionChoiceCount), pool.length);
  const out: string[] = [];
  const pityActive = corePityActive(config, ownedSet.size);
  // 保底期：前 max(2, n-1) 张从未拥有子池抽（"三张至少两张未拥有"）；子池不够则退回全池。
  const needUnowned = pityActive ? Math.min(2, n) : 0;
  const unownedPool = pool.filter((id) => !ownedSet.has(id));
  for (let k = 0; k < n; k += 1) {
    const useUnowned = k < needUnowned && unownedPool.length > 0;
    const src = useUnowned ? unownedPool : pool;
    if (src.length === 0) break;
    const i = rng.nextInt(src.length);
    const picked = src[i];
    out.push(picked);
    // 双池同步无放回。
    const pi = pool.indexOf(picked); if (pi >= 0) pool.splice(pi, 1);
    const ui = unownedPool.indexOf(picked); if (ui >= 0) unownedPool.splice(ui, 1);
  }
  // 欧皇线：p0.04 把最后一张换成曲率星门（未拥有时才有意义）。
  if (out.length > 0 && !ownedSet.has(config.treasureGradCoreId) && rng.next() < config.treasureGradP) {
    out[out.length - 1] = config.treasureGradCoreId;
  }
  return out;
}

/** 商店稀有格/黑市小件：随机发一颗流通核（吃前 5 颗保底）。就地入账 ownedCores；返回 coreId（空池 null）。 */
export function grantRandomFlowCore(
  squad: { ownedCores: Record<string, number> }, rng: S7AutoBattleRng,
  config: S7CoreSourceConfig = DEFAULT_S7_CORE_SOURCE_CONFIG,
): string | null {
  const owned = Object.keys(squad.ownedCores);
  const coreId = pickCoreWithPity(config.flowCoreIds, null, config, owned, rng);
  if (!coreId) return null;
  squad.ownedCores[coreId] = (squad.ownedCores[coreId] ?? 0) + 1;
  return coreId;
}

/** 宝库星核兑换项视图（流通核复购 ×1.5 递增·毕业核唯一解锁）。 */
export interface S7VaultCoreView {
  coreId: string;
  /** 本次兑换价（流通核=基价×1.5^已拥有份数·毕业核=基价）。 */
  gemCost: number;
  /** 已拥有份数（毕业核 owned=true 即不可再购）。 */
  ownedCopies: number;
  /** 毕业核标记（唯一解锁·不复购）。 */
  graduation: boolean;
  /** 是否可购（毕业核已拥有=false；流通核恒可复购）。 */
  purchasable: boolean;
  affordable: boolean;
}

/** 流通核第 n+1 份的兑换价（n=已拥有份数）：round(基价 × 1.5^n)。 */
export function vaultCorePrice(baseCost: number, ownedCopies: number, growth: number): number {
  const n = Math.max(0, Math.floor(ownedCopies));
  return Math.round(baseCost * Math.pow(growth, n));
}

export function vaultCoreViews(config: S7CoreSourceConfig, ownedCores: Record<string, number>, gemHave: number): S7VaultCoreView[] {
  return config.vaultCores.map((e) => {
    const copies = Math.max(0, Math.floor(ownedCores[e.coreId] ?? 0));
    const graduation = e.graduation === true;
    const cost = graduation ? e.gemCost : vaultCorePrice(e.gemCost, copies, config.vaultRepeatPriceGrowth);
    const purchasable = graduation ? copies === 0 : true;
    return { coreId: e.coreId, gemCost: cost, ownedCopies: copies, graduation, purchasable, affordable: gemHave >= cost };
  });
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
