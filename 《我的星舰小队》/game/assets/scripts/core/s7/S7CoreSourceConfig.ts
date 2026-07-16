// 星核渠道矩阵 + 星空宝库配置（步5 收尾批回写·纯 TS，不依赖 cc）：星核真源头注（2026-07-07 总修订案）。
// 数值终值 = 初值表 v0.7 §6-3（机器真源 PARAMS.core·照抄不调数）。
//
// 分级与渠道（常规 14 + 毕业 2·分级不向玩家外显=Ron 2026-07-09 拍板）：
//   陨星弹 core07 = 首Boss 首杀唯一（不进任何渠道池）；
//   强常规 2（core08 小太阳/core09 星鲸）= 只出自碎片合成开蛋（低权重头奖 w0.035/颗）；
//   池子款 3（core12 战鼓/core13 贪吃星/core16 银河烟花）= 开蛋 + 扩张宝藏池；
//   流通款 8（core10/11/14/18/19/20/21/22）= 开蛋 + 宝藏池 + 宝库常驻 120 + 黑市小件 + 商店稀有格；
//   毕业核 2 = core15 超新星（宝库 200 + 黑市 198）/ core17 曲率星门（宝库 200 + 宝藏欧皇线 p0.04）。
//   ⚠️ 强常规/池子/流通名单 = 按⑥§18.3 实测强度底稿推导（领跑=小太阳/星鲸；触发型归流通；
//     战鼓/贪吃星/银河烟花=已实测偏强者入池子款；深坑 5 核入流通款〔效果挂机制批③·发放面照真值走〕）
//     ——真源头注"总控提名单报 Ron"位：本名单=数值域推导落地·挂牌 Ron 追认（步5 记档）。
// 新手保底（细案§二1·Ron 方案2）：前 5 颗各不相同——已拥有种类 <5 时随机整核渠道只出未拥有款
//   （开蛋/扩张随机三选一〔三张至少两张未拥有〕/黑市小件流通核/黑市宝箱整核）；宝库定向天然不受限。
// 宝库复购（GDD S10.4）：流通核可重复兑换、第 2 份起 ×1.5 递增（按已拥有份数计价）；毕业核唯一解锁不复购。
// 双黄蛋（细案⑧·Ron 拍案A）：展厅 Lv10 起开蛋 3% 一蛋双核、第二颗限流通款。

/** 宝库可兑换星核项。 */
export interface S7VaultCoreEntry { coreId: string; gemCost: number; graduation?: boolean; }
/** 宝库可兑换专属星舰项（§9.3 专属星舰=星空宝库定向兑换）。 */
export interface S7VaultShipEntry { shipId: string; gemCost: number; }

export interface S7CoreSourceConfig {
  /** 碎片合成开蛋池（13 常规·含 2 强常规低权重）。 */
  synthesisPool: string[];
  /** 强常规 id（开蛋权重 eggStrongWeight/颗·其余均分）。 */
  strongRegularIds: string[];
  /** 强常规单颗开蛋权重（0.035·合成头奖）。 */
  eggStrongWeight: number;
  /** 每次合成消耗的星核碎片（60）。 */
  synthesisCost: number;
  /** 双黄蛋概率（展厅 Lv10 起生效·由调用方按 galleryDoubleYolkP 传入生效值；此处为案A 终值 3%）。 */
  doubleYolkP: number;
  /** 双黄蛋第二颗限定池（=流通款 8）。 */
  flowCoreIds: string[];
  /** 扩张宝藏 三选一/全池自选 的核池（11 常规=池子3+流通8）。 */
  expansionPool: string[];
  /** 扩张宝藏「非首次」随机三选一的选项数。 */
  expansionChoiceCount: number;
  /** 扩张宝藏三选一混入曲率星门的概率（欧皇线 p0.04·替换其中一张）。 */
  treasureGradP: number;
  /** 曲率星门 id（宝藏欧皇线目标）。 */
  treasureGradCoreId: string;
  /** 新手保底：前 N 颗各不相同（5）。 */
  distinctPity: number;
  /** 宝库可兑换星核（8 流通 120 + 2 毕业 200·流通复购 ×1.5 递增）。 */
  vaultCores: S7VaultCoreEntry[];
  /** 宝库流通核复购递增倍率（1.5）。 */
  vaultRepeatPriceGrowth: number;
  /** 宝库可兑换专属星舰（定价=尺外沿用值·未入尺注记）。 */
  vaultShips: S7VaultShipEntry[];
  /** 毕业核提早批（Ron 07-16 拍"提早解锁让会玩的提早爽"）·可拍门：过此主线节点后毕业核可购买
   *  （宝库/黑市两线同门）——经济尺 vaultGradUnlockNode/novaUnlockNode=312 的运行时数据层对表位；
   *  消费=工程灰盒批（货架购买判定+置灰态）。 */
  gradPurchasableFromNode: number;
  /** 可见门（预告态·数据层语义=Ron 案"提早可见提早规划"）：黑市线=n104（黑市开门即见）／
   *  宝库线=0（宝库系统开门即见·随展厅建筑线）——UI 呈现（货架预告卡+进度条）=工程灰盒批消费，
   *  本批只定字段与语义（接口记档=灰盒批待办）。 */
  gradVisibleFrom: { bm: number; vault: number };
}

// ===== 默认配置（v0.7 校准终值）=====

/** 强常规 2（只出开蛋·头奖）。 */
const STRONG_REGULAR = ['core08', 'core09'];
/** 池子款 3（开蛋+宝藏池）。 */
const POOL_REGULAR = ['core12', 'core13', 'core16'];
/** 流通款 8（开蛋+宝藏池+宝库+黑市小件+商店稀有格）。 */
const FLOW_CORES = ['core10', 'core11', 'core14', 'core18', 'core19', 'core20', 'core21', 'core22'];

export const DEFAULT_S7_CORE_SOURCE_CONFIG: S7CoreSourceConfig = {
  synthesisPool: [...STRONG_REGULAR, ...POOL_REGULAR, ...FLOW_CORES], // 13 常规
  strongRegularIds: STRONG_REGULAR.slice(),
  eggStrongWeight: 0.035,
  synthesisCost: 60,
  doubleYolkP: 0.03,
  flowCoreIds: FLOW_CORES.slice(),
  expansionPool: [...POOL_REGULAR, ...FLOW_CORES], // 11 常规
  expansionChoiceCount: 3,
  treasureGradP: 0.04,
  treasureGradCoreId: 'core17',
  distinctPity: 5,
  vaultCores: [
    ...FLOW_CORES.map((coreId) => ({ coreId, gemCost: 120 })),
    { coreId: 'core15', gemCost: 200, graduation: true },
    { coreId: 'core17', gemCost: 200, graduation: true },
  ],
  vaultRepeatPriceGrowth: 1.5,
  vaultShips: [
    { shipId: 'shp10', gemCost: 200 }, // 专属舰名单=占位沿用（真源未点名 2 艘·挂牌）；定价尺外
    { shipId: 'shp11', gemCost: 200 },
  ],
  gradPurchasableFromNode: 312, // 毕业核提早批：过墙⑥上架（旧=宝库 384/黑市 368 两线·同改此门=经济尺对表）
  gradVisibleFrom: { bm: 104, vault: 0 }, // 可见即预告（0=系统开门即见）·消费=灰盒批
};
