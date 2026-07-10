// 抽卡三池配置（步5 收尾批回写·纯 TS，不依赖 cc）：v1.0 §10.1「星港补给站·三池·轮换 + 专属池」。
// 数值终值 = 初值表 v0.7 §6 抽卡（机器真源 PARAMS.gacha/TRUTHS.gachaPity·照抄不调数）：
//   - 每抽必得随机单位专属碎片 1-3（期望 2.0=shardPerPullEV·"大概率随机专属碎片"）；
//   - 本体出率：C 7% / B 2.5% / A 0.8%（+补给站垫层·细案⑥·只加 A）——本体带阶级=抽卡阶级保底体系（GDD §S10.1）；
//   - 20 抽保底 A 级本体=真概率（每抽都有机会·天然/保底命中都清计数·保底进度条=基础功能挂灰盒批）；
//   - 重复本体折专属碎片 15（"同单位高阶自动分解低阶"：抽到更高阶=单位升到该阶+旧体折 15；≤现阶=直接折 15）。
// 池名单 = 20 舰/20 员真 id（细表 §13 头注"旧占位分组文案随步5 对齐"）；分类按定位型分桶（轮换机制用）。
// 专属舰 = shp10(群蜂)/shp11(贯日) 沿用占位名单（真源未点名 2 艘·挂牌待内容侧定稿；只影响"哪 2 艘走专属池"不影响出率）。

/** 三池 id。 */
export type S7GachaPoolId = 'recruit' | 'refit' | 'exclusive';
/** 抽到的单位种类。 */
export type S7GachaUnitKind = 'ship' | 'pilot';
/** 本体阶级档（body 出率的三档·舰=C/B/A 阶、员=1★/2★/3★）。 */
export type S7GachaBodyRank = 'C' | 'B' | 'A';

/** 一个轮换类别（派系/角色）：含一批成员单位 id。 */
export interface S7GachaCategory {
  categoryId: string;
  name: string;
  /** 成员单位 id（招募=pilotId / 整备=shipId）。 */
  memberIds: string[];
}

export interface S7GachaConfig {
  /** 招募池（驾驶员）的 6 角色分类（轮换单位：每天开 dailyOpenCategories 个、3 天一轮）。 */
  recruitCategories: S7GachaCategory[];
  /** 整备池（星舰）的 6 派系分类（只含非专属星舰；专属舰不在此）。 */
  refitCategories: S7GachaCategory[];
  /** 专属舰 id 列表（每 rotationDays 轮换一艘；只进专属池 / 宝库定向）。 */
  exclusiveShipIds: string[];

  // ===== v0.7 校准终值 =====
  /** 专属舰轮换周期（天）。设计=3。 */
  rotationDays: number;
  /** 每天开放的轮换类别数（招募/整备）。设计=2。 */
  dailyOpenCategories: number;
  /** 每抽必得碎片量下/上限（1-3 均匀·期望 2.0）。 */
  shardPerPullMin: number;
  shardPerPullMax: number;
  /** 本体自然出率（每抽·A 档另加补给站垫层 pp）。 */
  bodyP: Record<S7GachaBodyRank, number>;
  /** A 级硬保底抽数（真概率口径：天然 A/保底 A 都清计数）。 */
  pityDraws: number;
  /** 重复本体折专属碎片数（全部重复体统一 15=机器真源 dupFoldShards；旧"保底折 60"作废）。 */
  dupFoldShards: number;
  /** 专属池兑换进度阈值：每累计 N 抽 → 1 个兑换箱（§10.1 设计值 200·尺外=未入尺注记）。 */
  exchangeThreshold: number;
  /** 专属池兑换箱「已拥有该专属」溢出折该专属升阶碎片数（设计值 60）。 */
  exchangeOverflowShards: number;
}

/**
 * 默认抽卡配置（v0.7 终值 + 真 20/20 名单）。
 * 分类按定位型分桶（舰：突击/护卫×2/炮击/支援/工程·非专属 18 艘；员：突击×2/护卫/炮击/支援/工程·20 名）。
 */
export const DEFAULT_S7_GACHA_CONFIG: S7GachaConfig = {
  // 整备池 6 派系（非专属舰 18 艘：20 舰 − 专属 shp10/shp11）。
  refitCategories: [
    { categoryId: 'rf_assault', name: '突击派系', memberIds: ['shp01', 'shp02', 'shp03', 'shp04'] },
    { categoryId: 'rf_guard_a', name: '护卫派系·磐铁', memberIds: ['shp05', 'shp06'] },
    { categoryId: 'rf_guard_b', name: '护卫派系·堡岳', memberIds: ['shp07', 'shp08'] },
    { categoryId: 'rf_artillery', name: '炮击派系', memberIds: ['shp09', 'shp12'] },
    { categoryId: 'rf_support', name: '支援派系', memberIds: ['shp13', 'shp14', 'shp15', 'shp16'] },
    { categoryId: 'rf_engineer', name: '工程派系', memberIds: ['shp17', 'shp18', 'shp19', 'shp20'] },
  ],
  // 招募池 6 角色（pil01-20 全 20 名·id 恒等映射 shpNN↔pilNN=⑩A1）。
  recruitCategories: [
    { categoryId: 'rc_assault_a', name: '突击驾驶·炎影', memberIds: ['pil01', 'pil02'] },
    { categoryId: 'rc_assault_b', name: '突击驾驶·燎蛰', memberIds: ['pil03', 'pil04'] },
    { categoryId: 'rc_guard', name: '护卫驾驶', memberIds: ['pil05', 'pil06', 'pil07', 'pil08'] },
    { categoryId: 'rc_artillery', name: '炮击驾驶', memberIds: ['pil09', 'pil10', 'pil11', 'pil12'] },
    { categoryId: 'rc_support', name: '支援驾驶', memberIds: ['pil13', 'pil14', 'pil15', 'pil16'] },
    { categoryId: 'rc_engineer', name: '工程驾驶', memberIds: ['pil17', 'pil18', 'pil19', 'pil20'] },
  ],
  exclusiveShipIds: ['shp10', 'shp11'],

  rotationDays: 3,
  dailyOpenCategories: 2,
  shardPerPullMin: 1,
  shardPerPullMax: 3,
  bodyP: { C: 0.07, B: 0.025, A: 0.008 },
  pityDraws: 20,
  dupFoldShards: 15,
  exchangeThreshold: 200,
  exchangeOverflowShards: 60,
};

/** 取池子里单位的种类（招募=pilot，整备/专属=ship）。 */
export function poolUnitKind(poolId: S7GachaPoolId): S7GachaUnitKind {
  return poolId === 'recruit' ? 'pilot' : 'ship';
}

/** 所有非专属星舰 id（= 整备池全部成员，专属池常驻部分）。 */
export function nonExclusiveShipIds(config: S7GachaConfig): string[] {
  const out: string[] = [];
  for (const cat of config.refitCategories) {
    for (const id of cat.memberIds) if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** 本体阶级档 → 舰阶 index（C=0/B=1/A=2）或 员星级（C=1★/B=2★/A=3★）。 */
export function bodyRankToShipTier(rank: S7GachaBodyRank): number {
  return rank === 'A' ? 2 : rank === 'B' ? 1 : 0;
}
export function bodyRankToPilotStar(rank: S7GachaBodyRank): number {
  return rank === 'A' ? 3 : rank === 'B' ? 2 : 1;
}
