// 商人小站引擎（阶段一 E-step1，纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.3。
//
// 职责：上货(固定格+稀有格) / 买(扣星贝·查周期购买上限·返回商品由应用侧入账) / 刷新(免费/付费/广告·每周期上限) /
//       回收(信标·溢出星矿→星贝·有折损；插件回收复用 S7PluginRecycleService) / 每日自动刷新。
//   - 时间(now)/随机(rng·稀有格)/商人小站等级 由调用方传入；不读系统时钟、不依赖 cc，可 Node 测。
//   - 买只扣"价(星贝)"+记购买量，返回买到的 S7ShopItem，由应用侧 grant(资源→钱包 / 插件→addOwnedPlugin)，与具体 store 解耦。
//   - 防套利：周期购买上限(dailyBought 跨刷新保留·跨天重置) + 刷新上限 + 回收折损 + 不可回收表(本引擎不提供本体/星核/碎片回收)。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import { S7MerchantConfig, S7ShopItem, S7ShopOfferTemplate } from './S7MerchantConfig';
import { S7MerchantState, S7ShopOffer, shopItemKey } from './S7MerchantState';
import { S7BeaconTier, BEACON_RESOURCE } from './S7SalvageConfig';

const DAY_MS = 86_400_000;

/** 周期 key（每日刷新）。 */
export function merchantDayKey(now: number): number {
  return Math.floor(now / DAY_MS);
}

/** 稀有格数（随商人小站等级 1→3·§10.3）。lv1→1、lv4→2、lv7→3（占位门槛）。 */
export function rareSlotCount(merchantLevel: number): number {
  if (merchantLevel <= 0) return 0;
  return Math.max(1, Math.min(3, 1 + Math.floor((merchantLevel - 1) / 3)));
}

/** 加权取一个稀有模板（candidates 非空）。 */
function pickWeightedRare(cands: S7ShopOfferTemplate[], rng: S7AutoBattleRng): S7ShopOfferTemplate {
  const total = cands.reduce((s, t) => s + Math.max(0, t.rareWeight ?? 1), 0);
  let x = rng.next() * total;
  for (const t of cands) { x -= Math.max(0, t.rareWeight ?? 1); if (x < 0) return t; }
  return cands[cands.length - 1];
}

/** 生成一批货架（固定格全上 + 稀有格按等级抽·稀有格内不重复品类）。就地写 state.offers。 */
export function generateMerchantStock(state: S7MerchantState, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng): void {
  const offers: S7ShopOffer[] = [];
  let n = 0;
  for (const t of config.fixedOffers) {
    offers.push({ offerId: `o${n}`, item: t.item, price: t.price, purchaseLimit: t.purchaseLimit, rare: false });
    n += 1;
  }
  const slots = rareSlotCount(merchantLevel);
  const usedKeys = new Set<string>();
  for (let i = 0; i < slots; i += 1) {
    const cands = config.rarePool.filter((t) => merchantLevel >= (t.minMerchantLevel ?? 1) && !usedKeys.has(shopItemKey(t.item)));
    if (cands.length === 0) break;
    const t = pickWeightedRare(cands, rng);
    usedKeys.add(shopItemKey(t.item));
    offers.push({ offerId: `o${n}`, item: t.item, price: t.price, purchaseLimit: t.purchaseLimit, rare: true });
    n += 1;
  }
  state.offers = offers;
}

/** 每日自动刷新：跨周期则重铺货 + 清零购买量/刷新计数。返回是否发生刷新。进商店/抽取前调。 */
export function refreshMerchantToCycle(state: S7MerchantState, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng, now: number): boolean {
  const cycle = merchantDayKey(now);
  if (state.cycleKey === cycle && state.offers.length > 0) return false;
  generateMerchantStock(state, config, merchantLevel, rng);
  state.dailyBought = {};
  state.freeRefreshUsed = 0;
  state.paidRefreshUsed = 0;
  state.adRefreshUsed = 0;
  state.cycleKey = cycle;
  return true;
}

/** 某 offer 本周期还能买几个（购买上限 - 已购）。 */
export function offerRemaining(state: S7MerchantState, offer: S7ShopOffer): number {
  return Math.max(0, offer.purchaseLimit - (state.dailyBought[shopItemKey(offer.item)] ?? 0));
}

export type S7BuyResult =
  | { ok: true; item: S7ShopItem; spent: number }
  | { ok: false; reason: 'not_found' | 'limit_reached' | 'insufficient_starcargo' };

/**
 * 买一件（扣星贝 + 记购买量）。返回买到的 item 由应用侧入账（资源→钱包 / 插件→库存）。
 * 调用方传 starCargo 余额引用对象 {starCargo}（只读写这一项·避免引 save 层）；不够/超限/不存在→失败不扣。
 */
export function buyMerchantOffer(state: S7MerchantState, wallet: Record<string, number>, offerId: string, now: number): S7BuyResult {
  void now;
  const offer = state.offers.find((o) => o.offerId === offerId);
  if (!offer) return { ok: false, reason: 'not_found' };
  if (offerRemaining(state, offer) <= 0) return { ok: false, reason: 'limit_reached' };
  if ((wallet.starCargo ?? 0) < offer.price) return { ok: false, reason: 'insufficient_starcargo' };
  wallet.starCargo = (wallet.starCargo ?? 0) - offer.price;
  const key = shopItemKey(offer.item);
  state.dailyBought[key] = (state.dailyBought[key] ?? 0) + 1;
  return { ok: true, item: offer.item, spent: offer.price };
}

// ===== 刷新（免费 / 付费 / 广告）=====

export type S7RefreshMode = 'free' | 'paid' | 'ad';
export type S7RefreshResult =
  | { ok: true; mode: S7RefreshMode; spent: number; usedThisCycle: number; cap: number }
  | { ok: false; reason: 'cap_reached' | 'insufficient_starcargo' };

/**
 * 手动刷新货架（不清购买量·防套利：周期购买上限跨刷新保留）。
 *  - free：每周期 freePerCycle 次；paid：每周期 paidCapPerCycle 次·花星贝(递增序列)；ad：广告看完后调·每周期 adPerCycle 次。
 */
export function refreshMerchantShop(
  state: S7MerchantState, wallet: Record<string, number>, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng, mode: S7RefreshMode,
): S7RefreshResult {
  if (mode === 'free') {
    if (state.freeRefreshUsed >= config.refresh.freePerCycle) return { ok: false, reason: 'cap_reached' };
    state.freeRefreshUsed += 1;
    generateMerchantStock(state, config, merchantLevel, rng);
    return { ok: true, mode, spent: 0, usedThisCycle: state.freeRefreshUsed, cap: config.refresh.freePerCycle };
  }
  if (mode === 'ad') {
    if (state.adRefreshUsed >= config.refresh.adPerCycle) return { ok: false, reason: 'cap_reached' };
    state.adRefreshUsed += 1;
    generateMerchantStock(state, config, merchantLevel, rng);
    return { ok: true, mode, spent: 0, usedThisCycle: state.adRefreshUsed, cap: config.refresh.adPerCycle };
  }
  // paid：花星贝（递增序列·按已付费次数取价，超出取末值）。
  if (state.paidRefreshUsed >= config.refresh.paidCapPerCycle) return { ok: false, reason: 'cap_reached' };
  const seq = config.refresh.paidCostSequence;
  const cost = seq.length > 0 ? seq[Math.min(state.paidRefreshUsed, seq.length - 1)] : 0;
  if ((wallet.starCargo ?? 0) < cost) return { ok: false, reason: 'insufficient_starcargo' };
  wallet.starCargo = (wallet.starCargo ?? 0) - cost;
  state.paidRefreshUsed += 1;
  generateMerchantStock(state, config, merchantLevel, rng);
  return { ok: true, mode, spent: cost, usedThisCycle: state.paidRefreshUsed, cap: config.refresh.paidCapPerCycle };
}

// ===== 回收（卖→星贝·有折损）=====

export type S7RecycleResult = { ok: true; starCargoGained: number } | { ok: false; reason: 'insufficient' | 'bad_amount' };

/** 回收信标 → 星贝（各档固定价·占位）。count 张该档信标须足够。 */
export function recycleBeacon(
  wallet: Record<string, number>, config: S7MerchantConfig, tier: S7BeaconTier, count: number,
): S7RecycleResult {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, reason: 'bad_amount' };
  const key = BEACON_RESOURCE[tier];
  if ((wallet[key] ?? 0) < count) return { ok: false, reason: 'insufficient' };
  wallet[key] -= count;
  const gained = count * config.recycle.beacon[tier];
  wallet.starCargo = (wallet.starCargo ?? 0) + gained;
  return { ok: true, starCargoGained: gained };
}

/** 回收溢出星矿 → 星贝（按比率·占位：每 starOrePerStarCargo 星矿换 1 星贝·向下取整）。 */
export function recycleStarOre(wallet: Record<string, number>, config: S7MerchantConfig, starOreAmount: number): S7RecycleResult {
  if (!Number.isInteger(starOreAmount) || starOreAmount <= 0) return { ok: false, reason: 'bad_amount' };
  if ((wallet.starOre ?? 0) < starOreAmount) return { ok: false, reason: 'insufficient' };
  const rate = Math.max(1, config.recycle.starOrePerStarCargo);
  const gained = Math.floor(starOreAmount / rate);
  if (gained <= 0) return { ok: false, reason: 'bad_amount' }; // 不足 1 星贝的量不收（防 0 收）
  wallet.starOre -= gained * rate; // 只扣换得整数星贝对应的星矿（零头留着）
  wallet.starCargo = (wallet.starCargo ?? 0) + gained;
  return { ok: true, starCargoGained: gained };
}
