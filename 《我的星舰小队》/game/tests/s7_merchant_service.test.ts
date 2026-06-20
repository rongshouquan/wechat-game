// 阶段一 E-step1：商人小站引擎单测（轮换制·Ron 2026-06-20 调整后）——
//   上货(常驻补给券+轮换格随等级·门槛) · 刷新换一批新货 · 买(扣星贝/周期购买上限跨刷新保留/返回商品) ·
//   每日自动刷新(跨周期重置购买量+计数) · 回收(信标/星矿→星贝·折损) · 脏档规范化。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_MERCHANT_CONFIG, S7MerchantConfig, S7ShopItem } from '../assets/scripts/core/s7/S7MerchantConfig';
import { createDefaultS7Merchant, normalizeS7Merchant, shopItemKey } from '../assets/scripts/core/s7/S7MerchantState';
import {
  generateMerchantStock, refreshMerchantToCycle, buyMerchantOffer, offerRemaining,
  refreshMerchantShop, recycleBeacon, recycleStarOre, merchantStockSlots, merchantDayKey,
  grantMerchantFreeRefresh,
} from '../assets/scripts/core/s7/S7MerchantService';

const DAY = 86_400_000;
const T = 200 * DAY;
const rng = () => new S7AutoBattleRng('merchant-test');
const RES = (resourceId: string, amount: number): S7ShopItem => ({ kind: 'resource', resourceId, amount });
function cfg(overrides: Partial<S7MerchantConfig> = {}): S7MerchantConfig {
  return { ...DEFAULT_S7_MERCHANT_CONFIG, ...overrides };
}
/** 受控配置：常驻补给券(限2) + 轮换池仅 beaconCommon(限3·必铺) → 买/刷新测试确定。 */
function ctrlCfg(): S7MerchantConfig {
  return cfg({
    alwaysOffers: [{ item: RES('supplyTicket', 1), price: 80, purchaseLimit: 2 }],
    rollPool: [{ item: RES('beaconCommon', 1), price: 200, purchaseLimit: 3, rareWeight: 100 }],
    refresh: { freePerCycle: 1, adPerCycle: 1 },
  });
}

describe('E-step1 · 上货 / 轮换格', () => {
  it('merchantStockSlots 随等级 5→8（lv0→0）', () => {
    expect(merchantStockSlots(0)).toBe(0);
    expect(merchantStockSlots(1)).toBe(5);
    expect(merchantStockSlots(3)).toBe(6);
    expect(merchantStockSlots(5)).toBe(7);
    expect(merchantStockSlots(7)).toBe(8);
    expect(merchantStockSlots(99)).toBe(8); // 封顶
  });

  it('generateMerchantStock：常驻补给券 + 轮换格=merchantStockSlots(lv)；lv1 无星空宝石(lv3门槛)', () => {
    const s = createDefaultS7Merchant();
    generateMerchantStock(s, DEFAULT_S7_MERCHANT_CONFIG, 1, rng());
    // 补给券常驻。
    expect(s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'supplyTicket')).toBe(true);
    // 轮换格数 = 常驻(1) + merchantStockSlots(1)=5 → 共 6（池够铺满）。
    expect(s.offers).toHaveLength(1 + merchantStockSlots(1));
    // lv1 不出星空宝石。
    expect(s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'starGem')).toBe(false);
    // 无重复品类。
    const keys = s.offers.map((o) => shopItemKey(o.item));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('刷新换一批新货：不同种子铺出的货不全一样（解决"刷新没变化"）', () => {
    const sets = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const s = createDefaultS7Merchant();
      generateMerchantStock(s, DEFAULT_S7_MERCHANT_CONFIG, 1, new S7AutoBattleRng(`seed${i}`));
      sets.add(s.offers.map((o) => shopItemKey(o.item)).sort().join('|'));
    }
    expect(sets.size).toBeGreaterThan(1); // 多种不同货架组合 → 刷新有变化
  });

  it('高等级：轮换格更多·可出星空宝石', () => {
    let sawGem = false;
    for (let i = 0; i < 20 && !sawGem; i += 1) {
      const s = createDefaultS7Merchant();
      generateMerchantStock(s, DEFAULT_S7_MERCHANT_CONFIG, 7, new S7AutoBattleRng(`hi${i}`));
      expect(s.offers).toHaveLength(1 + merchantStockSlots(7)); // 1 常驻 + 8 轮换
      sawGem = s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'starGem');
    }
    expect(sawGem).toBe(true);
  });
});

describe('E-step1 · 买', () => {
  it('买：扣星贝 + 记购买量 + 返回商品；星贝不足→insufficient', () => {
    const c = ctrlCfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const offer = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'beaconCommon')!;
    const wallet = { starCargo: 500 };
    const r = buyMerchantOffer(s, wallet, offer.offerId, T);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.spent).toBe(200); expect(r.item).toEqual(RES('beaconCommon', 1)); }
    expect(wallet.starCargo).toBe(300);
    expect(s.dailyBought[shopItemKey(offer.item)]).toBe(1);
    expect(buyMerchantOffer(s, { starCargo: 10 }, offer.offerId, T)).toMatchObject({ ok: false, reason: 'insufficient_starcargo' });
  });

  it('周期购买上限：买满→limit_reached', () => {
    const c = ctrlCfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const ticket = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'supplyTicket')!; // limit 2
    const wallet = { starCargo: 999999 };
    expect(buyMerchantOffer(s, wallet, ticket.offerId, T).ok).toBe(true);
    expect(buyMerchantOffer(s, wallet, ticket.offerId, T).ok).toBe(true);
    expect(buyMerchantOffer(s, wallet, ticket.offerId, T)).toMatchObject({ ok: false, reason: 'limit_reached' });
    expect(offerRemaining(s, ticket)).toBe(0);
  });

  it('买不存在的 offer→not_found', () => {
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, ctrlCfg(), 1, rng(), T);
    expect(buyMerchantOffer(s, { starCargo: 999 }, 'oX', T)).toMatchObject({ ok: false, reason: 'not_found' });
  });
});

describe('E-step1 · 刷新（去付费·全新一茬店：货+购买次数一起刷·剩余次数制）', () => {
  it('免费刷新：消耗剩余次数·重铺货 + 清零购买次数（可重新买·Ron）', () => {
    const c = ctrlCfg(); // freePerCycle 1
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    expect(s.freeRefreshRemaining).toBe(1); // 周期重置为基础
    const ticket = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'supplyTicket')!;
    buyMerchantOffer(s, { starCargo: 999 }, ticket.offerId, T);
    expect(s.dailyBought[shopItemKey(ticket.item)]).toBe(1);
    expect(refreshMerchantShop(s, c, 1, rng(), 'free')).toMatchObject({ ok: true, remaining: 0 });
    expect(s.dailyBought).toEqual({}); // 刷新清零购买次数 → 全新一茬店可重新买
    expect(refreshMerchantShop(s, c, 1, rng(), 'free')).toMatchObject({ ok: false, reason: 'cap_reached' }); // 剩余 0
  });

  it('升级商人当场 +1 次免费刷新（一次性·非永久抬上限·Ron）', () => {
    const c = ctrlCfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T); // 剩余 1
    grantMerchantFreeRefresh(s, 1); // 升级赠送
    expect(s.freeRefreshRemaining).toBe(2);
    expect(refreshMerchantShop(s, c, 1, rng(), 'free').ok).toBe(true); // 用基础
    expect(refreshMerchantShop(s, c, 1, rng(), 'free').ok).toBe(true); // 用赠送
    expect(refreshMerchantShop(s, c, 1, rng(), 'free')).toMatchObject({ ok: false, reason: 'cap_reached' });
    // 跨天重置回基础(1)——赠送是一次性、不永久抬上限。
    refreshMerchantToCycle(s, c, 1, rng(), T + DAY);
    expect(s.freeRefreshRemaining).toBe(1);
  });

  it('广告刷新：消耗剩余次数', () => {
    const c = ctrlCfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    expect(refreshMerchantShop(s, c, 1, rng(), 'ad').ok).toBe(true);
    expect(refreshMerchantShop(s, c, 1, rng(), 'ad')).toMatchObject({ ok: false, reason: 'cap_reached' });
  });

  it('跨天自动刷新：重铺货 + 清购买量 + 刷新次数重置回基础', () => {
    const c = ctrlCfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const ticket = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'supplyTicket')!;
    buyMerchantOffer(s, { starCargo: 999 }, ticket.offerId, T);
    refreshMerchantShop(s, c, 1, rng(), 'free'); // 剩余→0
    expect(refreshMerchantToCycle(s, c, 1, rng(), T)).toBe(false); // 同周期不刷
    expect(refreshMerchantToCycle(s, c, 1, rng(), T + DAY)).toBe(true); // 次日刷
    expect(s.dailyBought).toEqual({});
    expect(s.freeRefreshRemaining).toBe(1); // 重置回基础
    expect(s.cycleKey).toBe(merchantDayKey(T + DAY));
  });
});

describe('E-step1 · 回收（卖→星贝·折损）', () => {
  it('回收信标→星贝（各档固定价）·信标不足/非法量拒绝', () => {
    const wallet: Record<string, number> = { beaconCommon: 3, beaconRare: 1, starCargo: 0 };
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'common', 2)).toMatchObject({ ok: true, starCargoGained: 80 });
    expect(wallet.beaconCommon).toBe(1);
    expect(wallet.starCargo).toBe(80);
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'epic', 1)).toMatchObject({ ok: false, reason: 'insufficient' });
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'common', 0)).toMatchObject({ ok: false, reason: 'bad_amount' });
  });

  it('回收溢出星矿→星贝（每4星矿=1星贝·零头留着）', () => {
    const wallet: Record<string, number> = { starOre: 10, starCargo: 0 };
    expect(recycleStarOre(wallet, DEFAULT_S7_MERCHANT_CONFIG, 10)).toMatchObject({ ok: true, starCargoGained: 2 });
    expect(wallet.starCargo).toBe(2);
    expect(wallet.starOre).toBe(2); // 零头留着
    expect(recycleStarOre(wallet, DEFAULT_S7_MERCHANT_CONFIG, 999)).toMatchObject({ ok: false, reason: 'insufficient' });
    expect(recycleStarOre({ starOre: 3, starCargo: 0 }, DEFAULT_S7_MERCHANT_CONFIG, 3)).toMatchObject({ ok: false, reason: 'bad_amount' });
  });
});

describe('E-step1 · 规范化(防脏档)', () => {
  it('丢非法 offer、dailyBought 非负、计数非负、cycleKey 取整', () => {
    const s = normalizeS7Merchant({
      offers: [
        { offerId: 'o0', item: { kind: 'resource', resourceId: 'beaconCommon', amount: 1 }, price: 200, purchaseLimit: 5, rare: false },
        { offerId: 'o0', item: { kind: 'resource', resourceId: 'x', amount: 1 }, price: 1, purchaseLimit: 1, rare: false }, // 重复id→丢
        { offerId: 'o2', item: { kind: 'plugin', quality: 'mythic' }, price: 1, purchaseLimit: 1, rare: true }, // 坏品质→丢
      ],
      dailyBought: { 'res:beaconCommon': 2, bad: -5 },
      cycleKey: 3.7, freeRefreshRemaining: -1, adRefreshRemaining: 1,
    });
    expect(s.offers.map((o) => o.offerId)).toEqual(['o0']);
    expect(s.dailyBought).toEqual({ 'res:beaconCommon': 2 });
    expect(s.cycleKey).toBe(-1);
    expect(s.freeRefreshRemaining).toBe(0);
    expect(s.adRefreshRemaining).toBe(1);
  });

  it('非对象→默认空', () => {
    expect(normalizeS7Merchant(null)).toEqual(createDefaultS7Merchant());
  });
});
