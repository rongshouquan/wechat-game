// 建筑各级效果数值（步5 收尾批回写·纯 TS，不依赖 cc）：给定建筑等级 → 效果量。
// 真源：《第三块-数值校准/建筑升级细案-v1.md》（八栋唯一细案·Ron 2026-07-09 逐栋拍定）；
//   数值终值 = 初值表 v0.7 校准解（机器真源 = simulate-s7-economy.mjs 的 TRUTHS/PARAMS 表·本文件照抄不调数）。
// 本模块只算"等级→数值"，不接消费方：离线用 offlineStorageHours/offlineRateBonusPct、战斗用
//   researchTeamBonusPct/coreGalleryTeamBonusPct、抽卡用 supplyATierRateBumpPct……各系统各自取用。
// 功能件 UI（阵容预设/每日特训/王牌战绩墙/研究项目页/图鉴/心愿单）归工程灰盒批——此处只落数值面。
//
// 约定：入参 level 为该建筑当前等级（getBuildingLevel：未解锁=0）；level<1 一律返回 0/无效果。

import { S7_BUILDING_MAX_LEVEL } from './S7BuildingState';

/** 把 level 夹到 [1, MAX] 的整数；level<1 返回 0（调用方据此判"无效果"）。 */
function clampLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  return Math.min(Math.floor(level), S7_BUILDING_MAX_LEVEL);
}

// ===== 船坞 dock：星舰升级合金折扣线 + 阵容预设槽（细案①）=====
// 折扣只作用合金（专属碎片结构性不打折=不经过此路径）；−1.5%/级、Lv10 毕业 −15%。
export const UPGRADE_DISCOUNT_PCT_PER_LEVEL = 1.5;

/** 船坞折扣乘数（作用星舰升级合金成本）：lv1=0.985 → lv10=0.85。未解锁=1（不折）。 */
export function dockAlloyDiscountMult(dockLevel: number): number {
  return 1 - (UPGRADE_DISCOUNT_PCT_PER_LEVEL * clampLevel(dockLevel)) / 100;
}
/** 阵容预设槽数（Lv4/7/10 各 +1·功能件 UI 归灰盒批）。 */
export function dockPresetSlots(dockLevel: number): number {
  const lv = clampLevel(dockLevel);
  return lv >= 10 ? 3 : lv >= 7 ? 2 : lv >= 4 ? 1 : 0;
}

// ===== 驾驶员训练舱 pilot_training_bay：驾驶记录折扣线 + 每日特训（细案②）=====
/** 训练舱折扣乘数（作用驾驶员升级记录成本）：−1.5%/级、Lv10 −15%。未解锁=1。 */
export function trainingTokenDiscountMult(trainingLevel: number): number {
  return 1 - (UPGRADE_DISCOUNT_PCT_PER_LEVEL * clampLevel(trainingLevel)) / 100;
}
/** 每日特训名额（Lv4=1 名·Lv10 金牌教官=2 名）。UI 归灰盒批。 */
export function trainingDailyBoostSlots(trainingLevel: number): number {
  const lv = clampLevel(trainingLevel);
  return lv >= 10 ? 2 : lv >= 4 ? 1 : 0;
}
/** 每日特训当日驾驶加成（百分比）：Lv4=+3%·Lv10 效果翻倍 +6%。 */
export function trainingDailyBoostPct(trainingLevel: number): number {
  const lv = clampLevel(trainingLevel);
  return lv >= 10 ? 6 : lv >= 4 ? 3 : 0;
}

// ===== 居住舱 habitat：离线仓/产率 + 有效编制 + 委托积压 + 工人折扣门（细案③）=====
// 逐级表照抄机器真源 habitatStorageHours/habitatRatePct（Lv5 为积压里程碑级、不加产率）。
const HABITAT_STORAGE_HOURS = [36, 37, 39, 40, 42, 43, 44, 45, 47, 48];
const HABITAT_RATE_PCT = [2, 4, 6, 8, 8, 10, 12, 14, 16, 18];

/** 离线存储上限（小时）：lv1=36 → lv10=48 封顶。未解锁=0。 */
export function offlineStorageHours(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  return lv === 0 ? 0 : HABITAT_STORAGE_HOURS[lv - 1];
}
/** 离线产率加成（百分比）：lv1=+2% → lv10=+18%（Lv5 持平=细案里程碑级）。 */
export function offlineRateBonusPct(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  return lv === 0 ? 0 : HABITAT_RATE_PCT[lv - 1];
}
/** 有效编制（细案③人口新口径）：人口数量无上限、编制内才贡献数值——6+2/级（lv1=8 → lv10=26）。未解锁=0。 */
export function habitatStaffCap(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  return lv === 0 ? 0 : 6 + 2 * lv;
}
/** 委托积压上限（细案③+§二3 连带拍板·原 12/16/20 作废）：基础 6 → Lv5=9 → Lv10=12。 */
export function bountyBoardCap(habitatLevel: number): number {
  const lv = clampLevel(habitatLevel);
  return lv >= 10 ? 12 : lv >= 5 ? 9 : 6;
}

// —— 工人建筑折扣（细案③·取代旧 S7Population 常量线 −0.5%/人封顶30）——
// 居住舱 Lv3 解锁；费率随居住舱升档 Lv3/6/10 = −1/−1.5/−2%/名（编制内工人）；总封顶 −25%。
export const WORKER_DISCOUNT_MIN_HABITAT_LEVEL = 3;
export const WORKER_DISCOUNT_CAP_PCT = 25;

/** 工人建筑升级折扣（百分比 0-25）：入参为工人总数（内部按有效编制截断·超编纯人气）。 */
export function workerBuildDiscountPct(habitatLevel: number, workerCount: number): number {
  const lv = clampLevel(habitatLevel);
  if (lv < WORKER_DISCOUNT_MIN_HABITAT_LEVEL) return 0;
  const rate = lv >= 10 ? 2.0 : lv >= 6 ? 1.5 : 1.0;
  const effWorkers = Math.min(Math.max(0, Math.floor(workerCount || 0)), habitatStaffCap(lv));
  return Math.min(WORKER_DISCOUNT_CAP_PCT, effWorkers * rate);
}

// ===== 打捞港 salvage_port：打捞队 3/4/5 + 稀有发现惊喜线（细案④）=====
/** 打捞队数量：lv1=3 → lv4=4 → lv7=5（细案④·原 1/2/3 作废）。未解锁=0。 */
export function salvageTeamCount(salvageLevel: number): number {
  const lv = clampLevel(salvageLevel);
  return lv >= 7 ? 5 : lv >= 4 ? 4 : lv >= 1 ? 3 : 0;
}
// 稀有发现惊喜线（Lv2/3/5/6/8/9/10 各 +5%·累计 +35%·相对值）：只作用惊喜线掷骰
//（居民/工人/货舱/插件四族），经济线（软货币/通碎/信标/核碎/宝石）不吃。
const SALVAGE_SURPRISE_STEPS = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 7];
/** 稀有发现加成（百分比·相对值）：lv10=+35%。 */
export function salvageSurpriseBonusPct(salvageLevel: number): number {
  return SALVAGE_SURPRISE_STEPS[clampLevel(salvageLevel)] * 5;
}
/** Lv10：24h 长趟额外一次惊喜掷骰。 */
export const SALVAGE_EXTRA_ROLL_LEVEL = 10;
export function salvageExtraSurpriseRoll(salvageLevel: number, hours: number): boolean {
  return clampLevel(salvageLevel) >= SALVAGE_EXTRA_ROLL_LEVEL && hours === 24;
}

// ===== 研究塔 research_tower：全队属性 +1%/级 + 研究项目槽（细案⑦）=====
/** 全队主属性加成（百分比）：+1%/级 → lv10=+10%（Lv3/6 为研究槽里程碑级·照加）。 */
export function researchTeamBonusPct(researchLevel: number): number {
  return clampLevel(researchLevel) * 1;
}
/** 研究槽数（Lv3 槽①/Lv6 槽②=流派定制器成型）。项目页 UI 归灰盒批。 */
export function researchProjectSlots(researchLevel: number): number {
  const lv = clampLevel(researchLevel);
  return lv >= 6 ? 2 : lv >= 3 ? 1 : 0;
}
/** 禁忌研究解锁级（Lv10）。 */
export const RESEARCH_FORBIDDEN_UNLOCK_LEVEL = 10;
/** 研究项目库 v0（细案⑦占位值·未入尺·灰盒批接项目页时消费；量级挂《数值细表真源》待真机校）。 */
export const RESEARCH_PROJECT_LIBRARY = [
  { id: 'weaponry', name: '武器学', effect: 'atkPct', value: 3 },
  { id: 'armoring', name: '装甲学', effect: 'dmgTakenPct', value: -3 },
  { id: 'mobility', name: '机动学', effect: 'atkSpeedPct', value: 3 },
  { id: 'engineering', name: '工程学', effect: 'summonAtkHpPct', value: 8 },
  { id: 'medical', name: '医疗学', effect: 'healPct', value: 5 },
  { id: 'targeting', name: '瞄准学', effect: 'critRatePct', value: 2 },
] as const;
export const RESEARCH_FORBIDDEN_LIBRARY = [
  { id: 'overclock_ammo', name: '超频弹药', effect: 'atkPct', value: 5, sideEffect: 'armorPct', sideValue: -2 },
  { id: 'glass_barrel', name: '玻璃炮膛', effect: 'critDmgPct', value: 15, sideEffect: 'maxHpPct', sideValue: -3 },
  { id: 'bloodthirst', name: '嗜血协议', effect: 'lifestealPct', value: 3, sideEffect: 'healTakenPct', sideValue: -5 },
] as const;

// ===== 星核展厅 core_gallery：收藏加成逐级表 + 双层分红 + 双黄蛋（细案⑧乙案）=====
/** 总加成上限（防收集很多种时无限叠，保持 minor）。 */
export const CORE_GALLERY_TOTAL_BONUS_CAP_PCT = 10;
// 收藏加成逐级表（细案⑧：Lv3/6 为分红里程碑级不加收藏·Lv4 权重补跳·0.30→0.60 封顶）。
const GALLERY_PER_TYPE_PCT = [0.30, 0.33, 0.33, 0.40, 0.43, 0.43, 0.48, 0.52, 0.57, 0.60];

/** 每种星核加成值（百分比）：lv1=0.30% → lv10=0.60%（逐级表·非线性）。 */
export function coreGalleryPerTypeBonusPct(galleryLevel: number): number {
  const lv = clampLevel(galleryLevel);
  return lv === 0 ? 0 : GALLERY_PER_TYPE_PCT[lv - 1];
}
/** 展厅全队加成（百分比）= 每种加成值 × 已收集星核种数，封顶 CAP。"收集变强"。 */
export function coreGalleryTeamBonusPct(galleryLevel: number, distinctCoreCount: number): number {
  const lv = clampLevel(galleryLevel);
  if (lv === 0 || !Number.isFinite(distinctCoreCount) || distinctCoreCount <= 0) return 0;
  const raw = coreGalleryPerTypeBonusPct(lv) * Math.floor(distinctCoreCount);
  return Math.min(raw, CORE_GALLERY_TOTAL_BONUS_CAP_PCT);
}

// —— 双层分红（细案⑧：Lv3 碎片分红/Lv6 宝石分红·每天按已收集核种数产出）——
export const GALLERY_FRAG_DIVIDEND_UNLOCK_LEVEL = 3;
export const GALLERY_GEM_DIVIDEND_UNLOCK_LEVEL = 6;
export const GALLERY_FRAG_PER_SPECIES_PER_DAY = 0.10; // 星核碎片/种/日（v0.7 两轮压定·0.3→0.18→0.10）
export const GALLERY_GEM_PER_SPECIES_PER_DAY = 0.10;  // 星空宝石/种/日

/** 展厅每日分红（期望量·小数）：结算侧按天累积、整数入账（余数进存档 carry）。 */
export function galleryDailyDividend(galleryLevel: number, distinctCoreCount: number): { coreFrag: number; starGem: number } {
  const lv = clampLevel(galleryLevel);
  const n = Math.max(0, Math.floor(distinctCoreCount || 0));
  return {
    coreFrag: lv >= GALLERY_FRAG_DIVIDEND_UNLOCK_LEVEL ? GALLERY_FRAG_PER_SPECIES_PER_DAY * n : 0,
    starGem: lv >= GALLERY_GEM_DIVIDEND_UNLOCK_LEVEL ? GALLERY_GEM_PER_SPECIES_PER_DAY * n : 0,
  };
}
/** 双黄蛋概率（细案⑧ Lv10·Ron 拍案A 3%·第二颗限流通款）：Lv10 前为 0。 */
export function galleryDoubleYolkP(galleryLevel: number): number {
  return clampLevel(galleryLevel) >= 10 ? 0.03 : 0;
}

// ===== 星港补给站 supply_station：A 级概率垫层 + 每日免费抽 + 十连九折（细案⑥）=====
// A 级垫层 = A 本体自然出率的绝对加点（20 抽保底不动）；封顶 +2.5pp（面值 +5pp 入尺实测
// 近 7 倍过热砍半·初值表 §15 记档）。逐级表照抄机器真源 supplyGacha.aPctByLv。
const SUPPLY_A_BUMP_PCT = [0, 0.25, 0.5, 0.75, 0.75, 1.0, 1.25, 1.25, 1.5, 1.75, 2.5];

/** A 级/3★ 本体出率垫层（百分点·绝对加点）：lv10=+2.5pp 封顶。 */
export function supplyATierRateBumpPct(supplyLevel: number): number {
  return SUPPLY_A_BUMP_PCT[clampLevel(supplyLevel)];
}
/** 每日免费抽次数（Lv4=1/Lv7=2·免耗补给券）。 */
export function supplyFreeDailyPulls(supplyLevel: number): number {
  const lv = clampLevel(supplyLevel);
  return lv >= 7 ? 2 : lv >= 4 ? 1 : 0;
}
/** 十连券价（Lv10 十连九折：10 抽收 9 券；未满级 10）。 */
export function supplyTenPullTicketCost(supplyLevel: number): number {
  return clampLevel(supplyLevel) >= 10 ? 9 : 10;
}

// ===== 商人小站 merchant_station：稀有格 + 回收价档 + Lv10 全场九折（细案⑤ Ron 亲排）=====
// Lv1 稀有格×1 → Lv2 权重① → Lv3 回收价① → Lv4 格×2 → Lv5 权重②·流通核入池 →
// Lv6 回收② → Lv7 格×3 → Lv8 权重③·核低频 → Lv9 回收③ → Lv10 全场九折。
// 权重档（Lv2/5/8）体现在商品池的 minLv/升频字段（S7MerchantConfig）；此处出等级→槽数/档数/折扣。
const MERCHANT_RARE_SLOTS = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3];

/** 稀有格槽数：Lv1=1 → Lv4=2 → Lv7=3。未解锁=0。 */
export function merchantRareSlots(merchantLevel: number): number {
  return MERCHANT_RARE_SLOTS[clampLevel(merchantLevel)];
}
/** 回收价升档数（Lv3/6/9 各 +1 档）：信标 25→28→31→34 / 传奇插件 150→165→180→195（每档 +3/+15）。 */
export function merchantRecycleSteps(merchantLevel: number): number {
  const lv = clampLevel(merchantLevel);
  return lv >= 9 ? 3 : lv >= 6 ? 2 : lv >= 3 ? 1 : 0;
}
export const MERCHANT_RECYCLE_STEP_BEACON = 3;   // 普通信标回收价每档 +3 星贝
export const MERCHANT_RECYCLE_STEP_PLUGIN = 15;  // 传奇插件回收价每档 +15 星贝
/** 全场价格乘数（Lv10 九折）。 */
export function merchantPriceMult(merchantLevel: number): number {
  return clampLevel(merchantLevel) >= 10 ? 0.9 : 1;
}
