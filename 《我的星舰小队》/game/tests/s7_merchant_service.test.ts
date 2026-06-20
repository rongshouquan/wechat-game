// 阶段一 E-step1：商人小站引擎单测——
//   上货(固定格+稀有格随等级/门槛) · 买(扣星贝/周期购买上限跨刷新保留/返回商品) · 刷新(免费/付费递增/广告·上限) ·
//   每日自动刷新(跨周期重置购买量+计数) · 回收(信标/星矿→星贝·折损) · 脏档规范化。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_MERCHANT_CONFIG, S7MerchantConfig } from '../assets/scripts/core/s7/S7MerchantConfig';
import { createDefaultS7Merchant, normalizeS7Merchant, shopItemKey } from '../assets/scripts/core/s7/S7MerchantState';
import {
  generateMerchantStock, refreshMerchantToCycle, buyMerchantOffer, offerRemaining,
  refreshMerchantShop, recycleBeacon, recycleStarOre, rareSlotCount, merchantDayKey,
} from '../assets/scripts/core/s7/S7MerchantService';

const DAY = 86_400_000;
const T = 200 * DAY;
const rng = () => new S7AutoBattleRng('merchant-test');
function cfg(overrides: Partial<S7MerchantConfig> = {}): S7MerchantConfig {
  return { ...DEFAULT_S7_MERCHANT_CONFIG, ...overrides };
}

describe('E-step1 · 上货 / 稀有格', () => {
  it('rareSlotCount 随等级 1→3（lv0→0）', () => {
    expect(rareSlotCount(0)).toBe(0);
    expect(rareSlotCount(1)).toBe(1);
    expect(rareSlotCount(4)).toBe(2);
    expect(rareSlotCount(7)).toBe(3);
    expect(rareSlotCount(99)).toBe(3); // 封顶
  });

  it('generateMerchantStock：固定格全上 + 稀有格按等级数；lv1 无星空宝石(lv3门槛)', () => {
    const s = createDefaultS7Merchant();
    generateMerchantStock(s, DEFAULT_S7_MERCHANT_CONFIG, 1, rng());
    const fixedCount = DEFAULT_S7_MERCHANT_CONFIG.fixedOffers.length;
    expect(s.offers.filter((o) => !o.rare)).toHaveLength(fixedCount);
    expect(s.offers.filter((o) => o.rare)).toHaveLength(1); // lv1 → 1 稀有格
    // lv1 抽不出 starGem（minMerchantLevel 3）。
    const hasGem = s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'starGem');
    expect(hasGem).toBe(false);
    // 补给券固定格在。
    expect(s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'supplyTicket')).toBe(true);
  });

  it('高等级稀有格更多·可出星空宝石', () => {
    const s = createDefaultS7Merchant();
    // lv7 → 3 稀有格；多 seed 抽，starGem 至少出现一次（门槛已过）。
    let sawGem = false;
    for (let i = 0; i < 20 && !sawGem; i += 1) {
      generateMerchantStock(s, DEFAULT_S7_MERCHANT_CONFIG, 7, new S7AutoBattleRng(`g${i}`));
      expect(s.offers.filter((o) => o.rare).length).toBe(3);
      sawGem = s.offers.some((o) => o.item.kind === 'resource' && o.item.resourceId === 'starGem');
    }
    expect(sawGem).toBe(true);
  });
});

describe('E-step1 · 买', () => {
  function freshShop(level = 1) {
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, DEFAULT_S7_MERCHANT_CONFIG, level, rng(), T);
    return s;
  }

  it('买：扣星贝 + 记购买量 + 返回商品；星贝不足→insufficient', () => {
    const s = freshShop();
    const offer = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'beaconCommon')!;
    const wallet = { starCargo: 500 };
    const r = buyMerchantOffer(s, wallet, offer.offerId, T);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.spent).toBe(offer.price); expect(r.item).toEqual({ kind: 'resource', resourceId: 'beaconCommon', amount: 1 }); }
    expect(wallet.starCargo).toBe(500 - offer.price);
    expect(s.dailyBought[shopItemKey(offer.item)]).toBe(1);
    // 星贝不足。
    const poor = { starCargo: 10 };
    expect(buyMerchantOffer(s, poor, offer.offerId, T)).toMatchObject({ ok: false, reason: 'insufficient_starcargo' });
  });

  it('周期购买上限：买满→limit_reached', () => {
    const s = freshShop();
    const offer = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'beaconCommon')!; // limit 5
    const wallet = { starCargo: 999999 };
    for (let i = 0; i < offer.purchaseLimit; i += 1) expect(buyMerchantOffer(s, wallet, offer.offerId, T).ok).toBe(true);
    expect(buyMerchantOffer(s, wallet, offer.offerId, T)).toMatchObject({ ok: false, reason: 'limit_reached' });
    expect(offerRemaining(s, offer)).toBe(0);
  });

  it('买不存在的 offer→not_found', () => {
    const s = freshShop();
    expect(buyMerchantOffer(s, { starCargo: 999 }, 'oX', T)).toMatchObject({ ok: false, reason: 'not_found' });
  });
});

describe('E-step1 · 刷新（防套利：购买上限跨刷新保留）', () => {
  it('免费刷新：每周期上限 1·重铺货但不清购买量', () => {
    const c = cfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const beacon = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'beaconCommon')!;
    const wallet = { starCargo: 999999 };
    buyMerchantOffer(s, wallet, beacon.offerId, T); // 买 1
    expect(s.dailyBought[shopItemKey(beacon.item)]).toBe(1);
    const r = refreshMerchantShop(s, wallet, c, 1, rng(), 'free');
    expect(r.ok).toBe(true);
    expect(s.dailyBought[shopItemKey(beacon.item)]).toBe(1); // 刷新不清购买量（防套利）
    expect(refreshMerchantShop(s, wallet, c, 1, rng(), 'free')).toMatchObject({ ok: false, reason: 'cap_reached' }); // 免费仅 1 次
  });

  it('付费刷新：花星贝(递增序列)·上限·星贝不足拒绝', () => {
    const c = cfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const wallet = { starCargo: 200 + 400 + 800 };
    expect(refreshMerchantShop(s, wallet, c, 1, rng(), 'paid')).toMatchObject({ ok: true, spent: 200 });
    expect(refreshMerchantShop(s, wallet, c, 1, rng(), 'paid')).toMatchObject({ ok: true, spent: 400 });
    expect(refreshMerchantShop(s, wallet, c, 1, rng(), 'paid')).toMatchObject({ ok: true, spent: 800 });
    expect(wallet.starCargo).toBe(0);
    expect(refreshMerchantShop(s, wallet, c, 1, rng(), 'paid')).toMatchObject({ ok: false, reason: 'insufficient_starcargo' }); // 第4次价1600·没钱
  });

  it('广告刷新：每周期上限 1', () => {
    const c = cfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    expect(refreshMerchantShop(s, { starCargo: 0 }, c, 1, rng(), 'ad').ok).toBe(true);
    expect(refreshMerchantShop(s, { starCargo: 0 }, c, 1, rng(), 'ad')).toMatchObject({ ok: false, reason: 'cap_reached' });
  });

  it('跨天自动刷新：重铺货 + 清购买量 + 清刷新计数', () => {
    const c = cfg();
    const s = createDefaultS7Merchant();
    refreshMerchantToCycle(s, c, 1, rng(), T);
    const beacon = s.offers.find((o) => o.item.kind === 'resource' && o.item.resourceId === 'beaconCommon')!;
    const wallet = { starCargo: 999999 };
    buyMerchantOffer(s, wallet, beacon.offerId, T);
    refreshMerchantShop(s, wallet, c, 1, rng(), 'free');
    expect(refreshMerchantToCycle(s, c, 1, rng(), T)).toBe(false); // 同周期不刷
    expect(refreshMerchantToCycle(s, c, 1, rng(), T + DAY)).toBe(true); // 次日刷
    expect(s.dailyBought).toEqual({}); // 购买量清零
    expect(s.freeRefreshUsed).toBe(0); // 刷新计数清零
    expect(s.cycleKey).toBe(merchantDayKey(T + DAY));
  });
});

describe('E-step1 · 回收（卖→星贝·折损）', () => {
  it('回收信标→星贝（各档固定价）·信标不足/非法量拒绝', () => {
    const wallet: Record<string, number> = { beaconCommon: 3, beaconRare: 1, starCargo: 0 };
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'common', 2)).toMatchObject({ ok: true, starCargoGained: 80 }); // 2×40
    expect(wallet.beaconCommon).toBe(1);
    expect(wallet.starCargo).toBe(80);
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'epic', 1)).toMatchObject({ ok: false, reason: 'insufficient' });
    expect(recycleBeacon(wallet, DEFAULT_S7_MERCHANT_CONFIG, 'common', 0)).toMatchObject({ ok: false, reason: 'bad_amount' });
  });

  it('回收溢出星矿→星贝（每4星矿=1星贝·零头留着）', () => {
    const wallet: Record<string, number> = { starOre: 10, starCargo: 0 };
    const r = recycleStarOre(wallet, DEFAULT_S7_MERCHANT_CONFIG, 10); // floor(10/4)=2 星贝·扣 8 星矿·留 2
    expect(r).toMatchObject({ ok: true, starCargoGained: 2 });
    expect(wallet.starCargo).toBe(2);
    expect(wallet.starOre).toBe(2); // 零头 2 留着
    expect(recycleStarOre(wallet, DEFAULT_S7_MERCHANT_CONFIG, 999)).toMatchObject({ ok: false, reason: 'insufficient' }); // 量不足(只剩2)
    // 量够但 <1 星贝（3 星矿 < 4 比率 → 换不出整数星贝）→ bad_amount。
    expect(recycleStarOre({ starOre: 3, starCargo: 0 }, DEFAULT_S7_MERCHANT_CONFIG, 3)).toMatchObject({ ok: false, reason: 'bad_amount' });
  });
});

describe('E-step1 · 规范化(防脏档)', () => {
  it('丢非法 offer(坏item/空id/重复id)、dailyBought 非负、计数非负、cycleKey 取整', () => {
    const s = normalizeS7Merchant({
      offers: [
        { offerId: 'o0', item: { kind: 'resource', resourceId: 'beaconCommon', amount: 1 }, price: 200, purchaseLimit: 5, rare: false },
        { offerId: 'o0', item: { kind: 'resource', resourceId: 'x', amount: 1 }, price: 1, purchaseLimit: 1, rare: false }, // 重复 id→丢
        { offerId: 'o1', item: { kind: 'resource', resourceId: '', amount: 1 }, price: 1, purchaseLimit: 1, rare: false }, // 坏 item→丢
        { offerId: 'o2', item: { kind: 'plugin', quality: 'mythic' }, price: 1, purchaseLimit: 1, rare: true }, // 坏品质→丢
      ],
      dailyBought: { 'res:beaconCommon': 2, bad: -5 },
      cycleKey: 3.7, freeRefreshUsed: -1, paidRefreshUsed: 2, adRefreshUsed: 1,
    });
    expect(s.offers.map((o) => o.offerId)).toEqual(['o0']);
    expect(s.dailyBought).toEqual({ 'res:beaconCommon': 2 }); // 负值丢
    expect(s.cycleKey).toBe(-1); // 非整→-1
    expect(s.freeRefreshUsed).toBe(0); // 负→0
    expect(s.paidRefreshUsed).toBe(2);
  });

  it('非对象→默认空', () => {
    expect(normalizeS7Merchant(null)).toEqual(createDefaultS7Merchant());
  });
});
