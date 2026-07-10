// 商人小站引擎（阶段一 E-step1，纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.3。
//
// 职责：上货(固定格+稀有格) / 买(扣星贝·查周期购买上限·返回商品由应用侧入账) / 刷新(免费/付费/广告·每周期上限) /
//       回收(信标·溢出星矿→星贝·有折损；插件回收复用 S7PluginRecycleService) / 每日自动刷新。
//   - 时间(now)/随机(rng·稀有格)/商人小站等级 由调用方传入；不读系统时钟、不依赖 cc，可 Node 测。
//   - 买只扣"价(星贝)"+记购买量，返回买到的 S7ShopItem，由应用侧 grant(资源→钱包 / 插件→addOwnedPlugin)，与具体 store 解耦。
//   - 防套利：周期购买上限(dailyBought 跨刷新保留·跨天重置) + 刷新上限 + 回收折损 + 不可回收表(本引擎不提供本体/星核/碎片回收)。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import { merchantRareSlots, merchantPriceMult, merchantRecycleSteps } from './S7BuildingEffects';
import { S7MerchantConfig, S7ShopItem, S7ShopOfferTemplate } from './S7MerchantConfig';
import { S7MerchantState, S7ShopOffer, shopItemKey } from './S7MerchantState';
import { S7BeaconTier, BEACON_RESOURCE } from './S7SalvageConfig';
import { s7DayKey } from './S7AdDailyCounter';

/** 周期 key（每日刷新）——委托全游戏统一日界（北京时间凌晨 4 点重置）。 */
export function merchantDayKey(now: number): number {
  return s7DayKey(now);
}

// 稀有格数（Lv1×1/Lv4×2/Lv7×3）= S7BuildingEffects.merchantRareSlots（细案⑤ Ron 亲排 10 级表·旧 5-8 槽占位作废）。

/** 加权取一个模板（candidates 非空）。 */
function templateWeight(t: S7ShopOfferTemplate, merchantLevel: number): number {
  const w = merchantLevel >= 8 && typeof t.rareWeightLv8 === 'number' ? t.rareWeightLv8 : (t.rareWeight ?? 1);
  return Math.max(0, w);
}
function pickWeighted(cands: S7ShopOfferTemplate[], merchantLevel: number, rng: S7AutoBattleRng): S7ShopOfferTemplate {
  const total = cands.reduce((s, t) => s + templateWeight(t, merchantLevel), 0);
  let x = rng.next() * total;
  for (const t of cands) { x -= templateWeight(t, merchantLevel); if (x < 0) return t; }
  return cands[cands.length - 1];
}

/** 上货价（Lv10 全场九折·四舍五入）。 */
function stockPrice(basePrice: number, merchantLevel: number): number {
  return Math.round(basePrice * merchantPriceMult(merchantLevel));
}

/**
 * 生成一批货架（百货化）：常驻区全上 + 从稀有格池随机铺 merchantRareSlots(等级) 格
 * （Lv1×1/Lv4×2/Lv7×3·同批不重复品类·受 minMerchantLevel 权重档门槛·Lv8 起流通核用升频权重）。
 * 价格上货时套 Lv10 九折。就地写 state.offers。每次刷新调用 → 稀有格肉眼可见换一批。
 */
export function generateMerchantStock(state: S7MerchantState, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng): void {
  const offers: S7ShopOffer[] = [];
  let n = 0;
  for (const t of config.alwaysOffers) {
    offers.push({ offerId: `o${n}`, item: t.item, price: stockPrice(t.price, merchantLevel), purchaseLimit: t.purchaseLimit, rare: t.rare === true });
    n += 1;
  }
  const slots = merchantRareSlots(merchantLevel);
  const usedKeys = new Set<string>();
  for (const t of config.alwaysOffers) usedKeys.add(shopItemKey(t.item)); // 常驻品类不再轮换重复
  for (let i = 0; i < slots; i += 1) {
    const cands = config.rarePool.filter((t) => merchantLevel >= (t.minMerchantLevel ?? 1) && !usedKeys.has(shopItemKey(t.item)));
    if (cands.length === 0) break;
    const t = pickWeighted(cands, merchantLevel, rng);
    usedKeys.add(shopItemKey(t.item));
    offers.push({ offerId: `o${n}`, item: t.item, price: stockPrice(t.price, merchantLevel), purchaseLimit: t.purchaseLimit, rare: t.rare === true });
    n += 1;
  }
  state.offers = offers;
}

/** 每日自动刷新：跨周期则重铺货 + 清零购买量/免费刷新计数（跨天=全清·含 keepBoughtOnRefresh 商品）。返回是否发生刷新。进商店/抽取前调。 */
export function refreshMerchantToCycle(state: S7MerchantState, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng, now: number): boolean {
  const cycle = merchantDayKey(now);
  if (state.cycleKey === cycle && state.offers.length > 0) return false;
  generateMerchantStock(state, config, merchantLevel, rng);
  state.dailyBought = {};
  state.freeRefreshRemaining = config.refresh.freePerCycle; // 每周期重置为基础免费刷新次数
  state.cycleKey = cycle;
  return true;
}

/** 某 offer 本周期还能买几个（购买上限 - 已购；null=不限购〔广告券〕→ 恒有余量）。 */
export function offerRemaining(state: S7MerchantState, offer: S7ShopOffer): number {
  if (offer.purchaseLimit === null) return Number.MAX_SAFE_INTEGER;
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

// ===== 刷新（免费 / 广告）=====

export type S7RefreshMode = 'free' | 'ad';
export type S7RefreshResult =
  | { ok: true; mode: S7RefreshMode; remaining: number }
  | { ok: false; reason: 'cap_reached' };

/** 手动刷新时应保留已购计数的商品 key 集（keepBoughtOnRefresh·块5 广告券每日限购防绕过）。 */
function keepBoughtKeys(config: S7MerchantConfig): Set<string> {
  const keys = new Set<string>();
  for (const t of config.alwaysOffers.concat(config.rarePool)) {
    if (t.keepBoughtOnRefresh) keys.add(shopItemKey(t.item));
  }
  return keys;
}

/** 清"新一茬店"的购买计数：默认全清（可重新买）；keepBoughtOnRefresh 商品保留（只在跨天重置）。 */
function resetBoughtForNewStock(state: S7MerchantState, config: S7MerchantConfig): void {
  const keep = keepBoughtKeys(config);
  const preserved: Record<string, number> = {};
  for (const k of Object.keys(state.dailyBought)) {
    if (keep.has(k)) preserved[k] = state.dailyBought[k];
  }
  state.dailyBought = preserved;
}

/**
 * 手动刷新货架（全新一茬店：重铺一批轮换货 + **同时清零购买次数**·Ron 2026-06-21；
 * keepBoughtOnRefresh 商品的已购保留——块5 广告券"每日限购 1"不被刷新绕过）。
 *  - free：消耗一次剩余免费次数 = 每周期基础(freePerCycle) + 商人升级一次性赠送(见 grantMerchantFreeRefresh)。
 *  - ad：**无内部上限**（块5 起每日 1 次由 S7AdPointPolicy + S7AdDailyCounter 在调用侧收口·本函数只管重铺货）。
 *  - 防套利：免费次数有限 + 广告统一政策限次 + keepBought 保留 + 回收折损。
 */
export function refreshMerchantShop(
  state: S7MerchantState, config: S7MerchantConfig, merchantLevel: number, rng: S7AutoBattleRng, mode: S7RefreshMode,
): S7RefreshResult {
  if (mode === 'free') {
    if (state.freeRefreshRemaining <= 0) return { ok: false, reason: 'cap_reached' };
    state.freeRefreshRemaining -= 1;
    generateMerchantStock(state, config, merchantLevel, rng);
    resetBoughtForNewStock(state, config);
    return { ok: true, mode, remaining: state.freeRefreshRemaining };
  }
  // ad：上限在调用侧（统一政策），这里恒可刷。
  generateMerchantStock(state, config, merchantLevel, rng);
  resetBoughtForNewStock(state, config);
  return { ok: true, mode, remaining: 0 };
}

/** 商人小站升级时调：当场 +n 次免费刷新（一次性额度·非每日上限+1·Ron 2026-06-21 原拍；
 *  2026-07-10 Ron 拍"保留"：升级后立刻免费刷出一茬符合新等级刷新率的商品=升级即时反馈钩子；
 *  全生涯共 9 次、量级≈0 不入尺（初值表简化声明 19）。 */
export function grantMerchantFreeRefresh(state: S7MerchantState, n = 1): void {
  if (!Number.isInteger(n) || n <= 0) return;
  state.freeRefreshRemaining += n;
}

// ===== 回收（卖→星贝·有折损）=====

export type S7RecycleResult = { ok: true; starCargoGained: number } | { ok: false; reason: 'insufficient' | 'bad_amount' };

/** 普通信标回收单价（25 基价 + 3/档·商人 Lv3/6/9 各升一档：25→28→31→34）。 */
export function beaconCommonRecyclePrice(config: S7MerchantConfig, merchantLevel: number): number {
  return config.recycle.beacon.common + config.recycle.beaconCommonStepAdd * merchantRecycleSteps(merchantLevel);
}

/** 回收信标 → 星贝（普通档吃回收价档；稀有/史诗=固定值·尺外沿用）。count 张该档信标须足够。 */
export function recycleBeacon(
  wallet: Record<string, number>, config: S7MerchantConfig, tier: S7BeaconTier, count: number, merchantLevel = 0,
): S7RecycleResult {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, reason: 'bad_amount' };
  const key = BEACON_RESOURCE[tier];
  if ((wallet[key] ?? 0) < count) return { ok: false, reason: 'insufficient' };
  wallet[key] -= count;
  const unit = tier === 'common' ? beaconCommonRecyclePrice(config, merchantLevel) : config.recycle.beacon[tier];
  const gained = count * unit;
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
