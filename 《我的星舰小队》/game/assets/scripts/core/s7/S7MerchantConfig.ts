// 商人小站配置（步5 收尾批回写·纯 TS，不依赖 cc）：GDD S10.3 百货商店化（2026-07-07 总修订案四）。
// 数值终值 = 初值表 v0.7 §6-5（机器真源 PARAMS.merchant·照抄不调数）；
// 等级节奏 = Ron 亲排 10 级表（细案⑤·一字不动）：Lv1 稀有格×1 → Lv2 权重① → Lv3 回收价① → Lv4 格×2 →
//   Lv5 权重②·流通核入池 → Lv6 回收② → Lv7 格×3 → Lv8 权重③·核低频 → Lv9 回收③ → Lv10 全场九折。
// 结构：
//   - 常驻区 alwaysOffers：补给券 80 日限 50（抽卡节奏唯一阀门·铁律例外）/ 广告券 70 **不限购** /
//     精良插件 320 / 应急普通信标 60（"比正常渠道贵一截→平时不买、关键应急"）/ 真墙日军饷应急小包（120 星贝→90 合金+60 记录·日≤3）。
//   - 稀有格 rarePool：6 品类加权（每日互不重复各限购 1）·格数=S7BuildingEffects.merchantRareSlots（Lv1×1/Lv4×2/Lv7×3）·
//     权重档：史诗信标/核碎大包 Lv2 入池、流通核 Lv5 极低频入池 → Lv8 升低频（wLv8）。
//   - Lv10 全场九折（上货时价格 ×0.9=merchantPriceMult）。
//   - 回收：普通信标 25（+3/档·Lv3/6/9）·稀有/史诗信标与溢出星矿=灰盒既有值沿用（尺外·未入尺注记）；
//     溢出星矿 8:1（步3 A1 终值）；传奇插件回收 150（+15/档）在 S7PluginRecycleService。
//   - 升级赠送免费刷新（Ron 2026-07-10 拍"保留"）：每升 1 级赠 1 次一次性刷新额度（不动每日上限）——
//     升级后立刻免费刷出一茬符合新等级刷新率的商品=升级的即时反馈钩子（grantMerchantFreeRefresh·量级≈0 不入尺）。

import { S7PluginQuality } from './S7PluginEffects';
import { S7BeaconTier } from './S7SalvageConfig';

export type S7ShopItem =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'plugin'; quality: S7PluginQuality }
  | { kind: 'bundle'; name: string; resources: { resourceId: string; amount: number }[] } // 军饷应急小包等多币组合
  | { kind: 'core'; pool: 'flow' };                                                       // 流通核（随机一颗·吃前5颗保底）

export interface S7ShopOfferTemplate {
  item: S7ShopItem;
  price: number;             // 星贝（上货时 ×merchantPriceMult）
  /** 每周期购买上限（跨天重置；null=不限购〔广告券〕）。 */
  purchaseLimit: number | null;
  minMerchantLevel?: number; // 稀有格池：达此商人小站等级才可能刷出（权重档门槛）
  rareWeight?: number;       // 稀有格池：加权
  rareWeightLv8?: number;    // Lv8 权重③：达 Lv8 后改用此权重（流通核 0.02→0.05 升频）
  rare?: boolean;            // 标记为稀有项（界面高亮·展示用）
  /** 手动刷新（免费/广告·"新一茬店清购买次数"）时**保留**该商品已购计数；只在跨天重置。 */
  keepBoughtOnRefresh?: boolean;
}

export interface S7MerchantConfig {
  /** 常驻区（永远在）。 */
  alwaysOffers: S7ShopOfferTemplate[];
  /** 稀有格池（刷新时随机铺 merchantRareSlots(等级) 格·同批不重复品类）。 */
  rarePool: S7ShopOfferTemplate[];
  /** 刷新规则（免费次数内部计；广告刷新走 S7AdPointPolicy 每日 1 次，不在此配）。 */
  refresh: { freePerCycle: number };
  /** 回收换星贝：普通信标 25 基价（+3/档·Lv3/6/9=S7BuildingEffects.merchantRecycleSteps）；
   *  稀有/史诗信标与星矿 8:1 = 尺外沿用值。 */
  recycle: {
    beacon: Record<S7BeaconTier, number>;
    /** 普通信标回收价每档增量（Lv3/6/9 各 +3）。 */
    beaconCommonStepAdd: number;
    starOrePerStarCargo: number;
    /** 回收溢出星矿 解锁所需商人小站等级。 */
    starOreUnlockLevel: number;
    /** 回收信标 解锁所需商人小站等级。 */
    beaconUnlockLevel: number;
  };
}

// ===== 默认配置（v0.7 校准终值）=====

const RES = (resourceId: string, amount: number): S7ShopItem => ({ kind: 'resource', resourceId, amount });
const PLG = (quality: S7PluginQuality): S7ShopItem => ({ kind: 'plugin', quality });

/** 广告券定价（星贝·v0.7 终值 70=60-80 带中值）+ 不限购（S13.2 总修订案五·旧 120 限 1 作废）。 */
export const S7_AD_TICKET_PRICE = 70;
export const S7_AD_TICKET_DAILY_BUY_LIMIT: number | null = null;
/** 补给券日限（抽卡节奏唯一阀门·铁律例外）。 */
export const S7_SUPPLY_TICKET_DAILY_CAP = 50;

export const DEFAULT_S7_MERCHANT_CONFIG: S7MerchantConfig = {
  alwaysOffers: [
    { item: RES('supplyTicket', 1), price: 80, purchaseLimit: S7_SUPPLY_TICKET_DAILY_CAP }, // 补给券主来源·日限 50（恒 o0·教程 step43 依赖）
    // 广告券（总修订案五）：恢复"当日已用完"的非福利广告点位·70 星贝**不限购**。keepBoughtOnRefresh 语义保留（不限购下无实际约束）。
    { item: RES('adTicket', 1), price: S7_AD_TICKET_PRICE, purchaseLimit: S7_AD_TICKET_DAILY_BUY_LIMIT, keepBoughtOnRefresh: true },
    { item: PLG('fine'), price: 320, purchaseLimit: 3 },              // 精良插件常驻（v0.5 篮子流量沿用·限购=尺外护栏）
    { item: RES('beaconCommon', 1), price: 60, purchaseLimit: 5 },    // 应急信标（vs 回收 25="贵一截"·打捞断粮才买）
    { item: { kind: 'bundle', name: '军饷应急小包', resources: [{ resourceId: 'hullAlloy', amount: 90 }, { resourceId: 'pilotToken', amount: 60 }] }, price: 120, purchaseLimit: 3 }, // 真墙日应急（价劣=平时不买）
  ],
  rarePool: [
    // 6 品类（v0.7 rare.pool·权重×100 记）：每日互不重复各限购 1；权重档 Lv2/5/8。
    { item: RES('beaconRare', 1), price: 300, purchaseLimit: 1, rareWeight: 34, rare: true },
    { item: PLG('superior'), price: 450, purchaseLimit: 1, rareWeight: 20, rare: true },
    { item: RES('coreFrag', 5), price: 500, purchaseLimit: 1, rareWeight: 10, rare: true },
    { item: RES('beaconEpic', 1), price: 800, purchaseLimit: 1, rareWeight: 8, rare: true, minMerchantLevel: 2 },   // Lv2 权重①：史诗信标现身
    { item: RES('coreFrag', 12), price: 1150, purchaseLimit: 1, rareWeight: 5, rare: true, minMerchantLevel: 2 },   // 核碎大包（低频）
    { item: { kind: 'core', pool: 'flow' }, price: 1200, purchaseLimit: 1, rareWeight: 2, rareWeightLv8: 5, rare: true, minMerchantLevel: 5 }, // 流通核彩蛋 Lv5 极低频 → Lv8 低频
  ],
  refresh: { freePerCycle: 1 },
  recycle: {
    beacon: { common: 25, rare: 140, epic: 360 }, // common=v0.7 终值 25；rare/epic=灰盒沿用（尺外·未入尺注记）
    beaconCommonStepAdd: 3,
    starOrePerStarCargo: 8, // 8 星矿 = 1 星贝（步3 A1：4:1→8:1 压死溢出死水）
    starOreUnlockLevel: 2,  // 回收溢出星矿：商人小站 lv2 解锁（灰盒既有）
    beaconUnlockLevel: 4,   // 回收信标：lv4 解锁（灰盒既有）
  },
};
