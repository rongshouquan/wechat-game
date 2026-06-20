// 商人小站配置（阶段一 E-step1，纯 TS，不依赖 cc）：v1.0 §10.3「商人小站（星贝）」。
//
// ⚠️ 全表 v0.1 占位（Ron 已授权 Claude 定灰盒占位·第二块「商人定价/每日上限/稀有率」校准；现有 shop_param 等配置表留第二块迁）：
//   - 买（星贝）：固定格(lv1 全开·周期刷新) = 信标×3档 / 通用碎片×2 / 精良·优秀插件 / 限量星核碎片 / 补给券(主来源·每日限量)；
//     稀有格(随商人小站等级 1→3 格 + 高端物按等级解锁概率) = 传奇插件 / 史诗信标 / 较多碎片 / 星空宝石(lv 门槛)。
//   - 卖（回收→星贝·有折损）：多余插件(各品质·复用 S7PluginRecycleService) / 各档信标 / 溢出星矿。不可回收：本体/星核/碎片/券等。
//   - 刷新：每周期(每日)自动刷 + 免费手刷 + 付费刷(星贝·递增) + 看广告刷各 1。防套利：折损/周期购买上限/刷新上限/不可回收表。

import { S7PluginQuality } from './S7PluginEffects';
import { S7BeaconTier } from './S7SalvageConfig';

/** 商店一件商品（买到手的东西）：货币/碎片/信标/星核碎片/星空宝石(resource) 或 插件(plugin)。 */
export type S7ShopItem =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'plugin'; quality: S7PluginQuality };

/** 商品模板（上货时实例化成 offer）。 */
export interface S7ShopOfferTemplate {
  item: S7ShopItem;
  /** 单价（星贝 starCargo）。 */
  price: number;
  /** 每周期购买上限（跨刷新保留·防套利；周期=每日重置）。 */
  purchaseLimit: number;
  /** 稀有池专用：商人小站达此等级才可能刷出（高端物 lv 门槛·§10.3）。 */
  minMerchantLevel?: number;
  /** 稀有池专用：加权。 */
  rareWeight?: number;
}

export interface S7MerchantConfig {
  /** 固定格（lv1 全开·每周期都在·刷新只换库存数不换品类）。 */
  fixedOffers: S7ShopOfferTemplate[];
  /** 稀有池（刷进稀有格·按 minMerchantLevel 门槛 + rareWeight 抽）。 */
  rarePool: S7ShopOfferTemplate[];
  /** 刷新规则。 */
  refresh: { freePerCycle: number; paidCapPerCycle: number; paidCostSequence: number[]; adPerCycle: number };
  /** 回收换星贝（有折损·占位）：各档信标固定价；星矿按比率(每 N 星矿 = 1 星贝)。 */
  recycle: { beacon: Record<S7BeaconTier, number>; starOrePerStarCargo: number };
}

// ===== 默认配置（v0.1 占位探针·第二块校准）=====

const RES = (resourceId: string, amount: number): S7ShopItem => ({ kind: 'resource', resourceId, amount });
const PLG = (quality: S7PluginQuality): S7ShopItem => ({ kind: 'plugin', quality });

export const DEFAULT_S7_MERCHANT_CONFIG: S7MerchantConfig = {
  fixedOffers: [
    { item: RES('beaconCommon', 1), price: 200, purchaseLimit: 5 },
    { item: RES('beaconRare', 1), price: 700, purchaseLimit: 3 },
    { item: RES('beaconEpic', 1), price: 1800, purchaseLimit: 1 },
    { item: RES('shipBlueprint', 5), price: 260, purchaseLimit: 4 },   // 通用舰碎片
    { item: RES('pilotShardUniversal', 5), price: 260, purchaseLimit: 4 }, // 通用员碎片
    { item: PLG('fine'), price: 320, purchaseLimit: 3 },               // 精良插件
    { item: PLG('superior'), price: 900, purchaseLimit: 2 },           // 优秀插件
    { item: RES('coreFrag', 5), price: 500, purchaseLimit: 2 },        // 限量星核碎片
    { item: RES('supplyTicket', 1), price: 80, purchaseLimit: 40 },    // 补给券（主来源·每日限量 40）
  ],
  rarePool: [
    { item: PLG('legendary'), price: 3000, purchaseLimit: 1, rareWeight: 20 },
    { item: RES('beaconEpic', 2), price: 2600, purchaseLimit: 1, rareWeight: 22 }, // 史诗信标（较多）
    { item: RES('shipBlueprint', 30), price: 1500, purchaseLimit: 1, rareWeight: 24 }, // 较多碎片
    { item: RES('pilotShardUniversal', 30), price: 1500, purchaseLimit: 1, rareWeight: 24 },
    { item: RES('starGem', 3), price: 4200, purchaseLimit: 1, rareWeight: 16, minMerchantLevel: 3 }, // 星空宝石·lv3 起
  ],
  refresh: { freePerCycle: 1, paidCapPerCycle: 5, paidCostSequence: [200, 400, 800, 1600, 3200], adPerCycle: 1 },
  recycle: { beacon: { common: 40, rare: 140, epic: 360 }, starOrePerStarCargo: 4 }, // 4 星矿=1 星贝（占位）
};
