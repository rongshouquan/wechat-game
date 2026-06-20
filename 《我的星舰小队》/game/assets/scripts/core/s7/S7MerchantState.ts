// 商人小站存档子状态（阶段一 E-step1，纯 TS，不依赖 cc）：v1.0 §10.3 的持久化载体。
//
// 存「当前上架的货 + 本周期已购量 + 刷新次数 + 周期标记」：货架按周期(每日)刷、跨会话保留当期货；
//   购买上限按周期算(dailyBought 跨手动/广告刷新保留、只在跨天重置)，守住"周期购买上限"防套利。
// 与 S7Mailbox/S7Salvage 同构：本模块拥有形状 + createDefault/normalize；S7SaveService 组合(v14→v15)。

import { S7ShopItem } from './S7MerchantConfig';
import { S7_PLUGIN_QUALITIES, S7PluginQuality } from './S7PluginEffects';

/** 上架的一件商品。 */
export interface S7ShopOffer {
  offerId: string;
  item: S7ShopItem;
  price: number;
  purchaseLimit: number;
  rare: boolean;
}

export interface S7MerchantState {
  /** 当前货架（固定格 + 稀有格）。 */
  offers: S7ShopOffer[];
  /** 本周期各商品已购量（key=itemKey·跨刷新保留·跨天重置）。 */
  dailyBought: Record<string, number>;
  /** 当前货架所属周期 key(=floor(now/天))；-1=未初始化。 */
  cycleKey: number;
  freeRefreshUsed: number;
  paidRefreshUsed: number;
  adRefreshUsed: number;
}

export function createDefaultS7Merchant(): S7MerchantState {
  return { offers: [], dailyBought: {}, cycleKey: -1, freeRefreshUsed: 0, paidRefreshUsed: 0, adRefreshUsed: 0 };
}

/** 商品在 dailyBought / 购买上限里的归并 key：资源用 resourceId，插件用 `plugin:<品质>`。 */
export function shopItemKey(item: S7ShopItem): string {
  return item.kind === 'resource' ? `res:${item.resourceId}` : `plugin:${item.quality}`;
}

const nonNegInt = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const finitePos = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function normItem(raw: unknown): S7ShopItem | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (o.kind === 'resource' && typeof o.resourceId === 'string' && o.resourceId.length > 0) {
    const amount = finitePos(o.amount);
    if (amount <= 0) return null;
    return { kind: 'resource', resourceId: o.resourceId, amount: Math.floor(amount) };
  }
  if (o.kind === 'plugin' && typeof o.quality === 'string' && S7_PLUGIN_QUALITIES.includes(o.quality as S7PluginQuality)) {
    return { kind: 'plugin', quality: o.quality as S7PluginQuality };
  }
  return null;
}

/** 规范化（防脏档）：offer 取合法项(item 合法·价/限非负·id 去重去空)；dailyBought 取非负整数；计数非负；cycleKey 取整(允许-1)。 */
export function normalizeS7Merchant(raw: unknown): S7MerchantState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = createDefaultS7Merchant();
  const seen = new Set<string>();
  if (Array.isArray(src.offers)) {
    for (const o of src.offers) {
      const row = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
      const id = row.offerId;
      if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
      const item = normItem(row.item);
      if (!item) continue;
      seen.add(id);
      out.offers.push({ offerId: id, item, price: Math.floor(finitePos(row.price)), purchaseLimit: nonNegInt(row.purchaseLimit), rare: row.rare === true });
    }
  }
  const db = (src.dailyBought && typeof src.dailyBought === 'object' ? src.dailyBought : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(db)) {
    if (typeof k !== 'string' || k.length === 0) continue;
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    const n = nonNegInt(v);
    if (n > 0) out.dailyBought[k] = n;
  }
  out.cycleKey = typeof src.cycleKey === 'number' && Number.isInteger(src.cycleKey) ? src.cycleKey : -1;
  out.freeRefreshUsed = nonNegInt(src.freeRefreshUsed);
  out.paidRefreshUsed = nonNegInt(src.paidRefreshUsed);
  out.adRefreshUsed = nonNegInt(src.adRefreshUsed);
  return out;
}
