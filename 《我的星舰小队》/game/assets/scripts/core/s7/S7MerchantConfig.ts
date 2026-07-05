// 商人小站配置（阶段一 E·纯 TS，不依赖 cc）：v1.0 §10.3「商人小站（星贝）」。
//
// ⚠️ 全表 v0.1 占位（Ron 已授权 Claude 定灰盒占位·第二块校准；现有 shop_param 等表留第二块迁）。
// 模型（Ron 2026-06-20 调整）：**轮换制商店**——
//   - 常驻格 alwaysOffers：补给券（主来源·每日限量·永远可买）。
//   - 轮换格 rollPool：信标×3 / 通用碎片×2 / 精良·优秀插件 / 限量星核碎片 / 稀有(传奇插件·史诗信标·较多碎片·星空宝石)，
//     每次刷新从池里随机铺 N 格（N 随商人小站等级增多）；高端物 minMerchantLevel 门槛（如星空宝石 lv3 起）。
//     → 刷新肉眼可见换货；"基础商品不靠升级解锁"=都在池里 lv1 即可刷到（除少数高端 lv 门槛）。
//   - 刷新：每周期免费 1 次 + 看广告 1 次（**去掉付费刷新**·Ron；广告次数块5 起统一走 S7AdPointPolicy·不在本表）。
//   - 回收→星贝（折损）：溢出星矿 / 各档信标，**随商人小站等级陆续解锁**（unlock 等级见 recycle）。插件回收挪到背包(留后)。
//   - 防套利：周期购买上限(跨刷新保留) + 刷新上限 + 回收折损 + 不可回收表。

import { S7PluginQuality } from './S7PluginEffects';
import { S7BeaconTier } from './S7SalvageConfig';

export type S7ShopItem =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'plugin'; quality: S7PluginQuality };

export interface S7ShopOfferTemplate {
  item: S7ShopItem;
  price: number;             // 星贝
  purchaseLimit: number;     // 每周期购买上限（跨天重置；手动刷新是否清零见 keepBoughtOnRefresh）
  minMerchantLevel?: number; // 轮换池：达此商人小站等级才可能刷出（高端物门槛）
  rareWeight?: number;       // 轮换池：加权（越大越常刷到）
  rare?: boolean;            // 标记为稀有项（界面高亮·展示用）
  /** 手动刷新（免费/广告·"新一茬店清购买次数"）时**保留**该商品已购计数（块5·广告券"每日限购1"不被刷新绕过）；只在跨天重置。 */
  keepBoughtOnRefresh?: boolean;
}

export interface S7MerchantConfig {
  /** 常驻格（永远在·补给券主来源 + 块5 广告券）。 */
  alwaysOffers: S7ShopOfferTemplate[];
  /** 轮换池（刷新时随机铺 N 格·N 随等级）。 */
  rollPool: S7ShopOfferTemplate[];
  /** 刷新规则（去付费·免费次数内部计；广告刷新块5 起统一走 S7AdPointPolicy 每日 1 次，不在此配）。 */
  refresh: { freePerCycle: number };
  /** 回收换星贝（折损·占位）+ 各项随商人小站等级解锁。 */
  recycle: {
    beacon: Record<S7BeaconTier, number>;
    starOrePerStarCargo: number;
    /** 回收溢出星矿 解锁所需商人小站等级。 */
    starOreUnlockLevel: number;
    /** 回收信标 解锁所需商人小站等级。 */
    beaconUnlockLevel: number;
  };
}

// ===== 默认配置（v0.1 占位探针·第二块校准）=====

const RES = (resourceId: string, amount: number): S7ShopItem => ({ kind: 'resource', resourceId, amount });
const PLG = (quality: S7PluginQuality): S7ShopItem => ({ kind: 'plugin', quality });

/** 广告券定价（星贝·占位挂第三块）+ 每日限购（占位默认 1·第三块可调）。S13 决策③：只有一种、一个定价。 */
export const S7_AD_TICKET_PRICE = 120;
export const S7_AD_TICKET_DAILY_BUY_LIMIT = 1;

export const DEFAULT_S7_MERCHANT_CONFIG: S7MerchantConfig = {
  alwaysOffers: [
    { item: RES('supplyTicket', 1), price: 80, purchaseLimit: 40 }, // 补给券主来源·每日限量 40（恒 o0·教程 step43 依赖）
    // 块5 广告券（S13 决策③）：恢复"当日已用完"的广告点位。keepBoughtOnRefresh=手动刷新不清已购（每日限购防绕过）。
    { item: RES('adTicket', 1), price: S7_AD_TICKET_PRICE, purchaseLimit: S7_AD_TICKET_DAILY_BUY_LIMIT, keepBoughtOnRefresh: true },
  ],
  rollPool: [
    // 基础（lv1 即可刷·高权重·常出）。
    { item: RES('beaconCommon', 1), price: 200, purchaseLimit: 5, rareWeight: 32 },
    { item: RES('beaconRare', 1), price: 700, purchaseLimit: 3, rareWeight: 18 },
    { item: RES('shipBlueprint', 5), price: 260, purchaseLimit: 4, rareWeight: 28 },   // 通用舰碎片
    { item: RES('pilotShardUniversal', 5), price: 260, purchaseLimit: 4, rareWeight: 28 }, // 通用员碎片
    { item: PLG('fine'), price: 320, purchaseLimit: 3, rareWeight: 26 },               // 精良插件
    { item: PLG('superior'), price: 900, purchaseLimit: 2, rareWeight: 14 },           // 优秀插件
    { item: RES('coreFrag', 5), price: 500, purchaseLimit: 2, rareWeight: 14 },        // 限量星核碎片
    // 稀有（低权重·部分 lv 门槛·标 rare 高亮）。
    { item: RES('beaconEpic', 1), price: 1800, purchaseLimit: 1, rareWeight: 8, rare: true },
    { item: PLG('legendary'), price: 3000, purchaseLimit: 1, rareWeight: 6, rare: true },
    { item: RES('shipBlueprint', 30), price: 1500, purchaseLimit: 1, rareWeight: 7, rare: true }, // 较多碎片
    { item: RES('pilotShardUniversal', 30), price: 1500, purchaseLimit: 1, rareWeight: 7, rare: true },
    { item: RES('starGem', 3), price: 4200, purchaseLimit: 1, rareWeight: 5, rare: true, minMerchantLevel: 3 }, // 星空宝石·lv3 起
  ],
  refresh: { freePerCycle: 1 },
  recycle: {
    beacon: { common: 40, rare: 140, epic: 360 },
    starOrePerStarCargo: 4, // 4 星矿 = 1 星贝（占位）
    starOreUnlockLevel: 2,  // 回收溢出星矿：商人小站 lv2 解锁
    beaconUnlockLevel: 4,   // 回收信标：lv4 解锁（陆续·晚于星矿）
  },
};
