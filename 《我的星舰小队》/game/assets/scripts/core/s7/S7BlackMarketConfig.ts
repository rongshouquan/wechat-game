// 黑市配置常量（步5 收尾批回写·纯 TS，不依赖 cc）：GDD S13.6（2026-07-07 总修订案三重构）。
// 数值终值 = 初值表 v0.7 §6-4/§6a（机器真源 PARAMS.blackMarket·照抄不调数）。
// ⚠️ 本模块=数值面常量先落（黑市界面/计数账本运行时 = 工程灰盒批·含宝箱开箱）——
//   灰盒批接线时直接吃本表，不再另定数；计数=独立账本不进 14 键钱包（gate 钉死口径）。
//
// 结构（总修订案三）：全部激励视频观看 +1 计数（常规点位/券观看/黑市连看通吃）·日上限 30；
//   货架 = 2 大件（固定轮换·日程公示）+ 4 小件坑（每日随机 8 品类加权·各限购 1/日）+ 宝箱位（价 10 日 1）；
//   黑市内可连看广告（纯计数无其他奖励）；入口低调无红点；解锁 = n060 首通（Ron 拍板"打赢难 Boss 解锁"）。

/** 解锁节点（n060 首通后·Ron 2026-07-07 拍板）。 */
export const BLACK_MARKET_UNLOCK_NODE = 'n060';
/** 日计数上限（三道闸①：护 eCPM/防无脑刷）。 */
export const BLACK_MARKET_DAILY_VIEW_CAP = 30;
/** 每次激励视频观看 +1 计数（全渠道通吃）。 */
export const BLACK_MARKET_COUNT_PER_AD = 1;

/** 黑市宝箱（Ron 设计·福利定位）：价 10 计数·每日限购 1·期望回报＞箱价（普惠稳赚·gate 钉下限）。 */
export const BLACK_MARKET_BOX_PRICE = 10;
export const BLACK_MARKET_BOX_DAILY_LIMIT = 1;
/** 宝箱期望内容表（v0.7·概率塔的期望值锚——灰盒批把它铺成概率塔时须总期望==本表）。 */
export const BLACK_MARKET_BOX_EXPECTED = Object.freeze({
  hullAlloy: 45, pilotToken: 30, starCargo: 25,
  universalShards: 2.5,   // 通用碎片（舰/员对半）
  mainShards: 40,         // 主力专属碎片（临门一脚投放·给离升阶/升星缺口最小的主力）
  beaconCommon: 0.2, beaconRare: 0.10, beaconEpic: 0.03,
  coreFrag: 0.5, superiorPlugin: 0.05, legendaryPlugin: 0.02, starGem: 0.3,
  fullFlowCoreP: 0.004,   // 完整流通核概率（<1% 铁律·吃前 5 颗保底）
  gradCoreP: 0.002,       // 毕业核概率（欧线彩蛋）
});

/** 2 大件坑（固定轮换·日程公示）。 */
export const BLACK_MARKET_LARGE_GOODS = Object.freeze({
  shipHigh: { price: 128, shipShards: 1000, pilotShards: 350 }, // 高阶舰包（S→SS 整舰当量·舰专属+员专属）
  supernova: { price: 198, coreId: 'core15' },                  // 毕业核·超新星（时间成本线·黑市不垄断任何核）
});

/** 4 小件坑（每日随机·各限购 1/日·8 品类加权；手动再刷=看广告 1 次/日·只重掷小坑·可选池 ×2）。 */
export const BLACK_MARKET_SMALL_SLOTS = 4;
export const BLACK_MARKET_SMALL_REROLL_PER_DAY = 1;
export const BLACK_MARKET_SMALL_POOL = Object.freeze([
  { id: 'shardSmall', w: 0.20, price: 40, give: { shipShards: 65, pilotShards: 65 } },   // 专属碎片小包（临门一脚）
  { id: 'plugSuperior', w: 0.16, price: 30, give: { superior: 2 } },                      // 优秀插件包
  { id: 'plugLegend', w: 0.10, price: 45, give: { legendary: 2 } },                       // 传奇插件包
  { id: 'uniPack', w: 0.14, price: 32, give: { universalShards: 60 } },                   // 通用碎片包（舰/员）
  { id: 'coreFragPack', w: 0.13, price: 35, give: { coreFrag: 15 } },                     // 星核碎片包
  { id: 'beaconPack', w: 0.12, price: 36, give: { beaconRare: 1, beaconEpicP: 0.25 } },   // 稀有·史诗信标
  { id: 'accelPack', w: 0.10, price: 25, give: { accelCredits: 3 } },                     // 打捞加速券三档（免耗星贝额度）
  { id: 'flowCore', w: 0.05, price: 133, give: { flowCore: 1 } },                         // 流通核（随机 1·吃前 5 颗保底·低频压轴）
]);
