// 抽卡三池配置（阶段一 C-step1，纯 TS，不依赖 cc）：v1.0 §10.1「星港补给站·三池·轮换 + 专属池」。
//
// ⚠️ 全表标 v0.1 占位（Ron 已授权 Claude 定灰盒占位·第二块统一校准/正式定）：
//   - 6 派系（星舰）/ 6 角色（驾驶员）的分类映射 = 占位（按现有 12 舰 / 10 员手分，凑齐 6 类供轮换机制成立）。
//   - 专属舰 = 从现有 12 舰挑 2 艘标占位（shp10/shp11），只进专属池轮换（将来 I 块宝库定向兑换）。
//   - 数值探针（保底抽数 / 兑换阈值 / 折碎片量 / 出率）= 占位，第二块校准；折 15 / 折 60 是设计给定值（§6/§10.1）。
//   - 现以 TS 常量承载（引擎吃 config 参数·解耦可测）；第二块再决定是否迁进正式 config-resource 管线。
//
// 设计要点（§10.1）：招募池(驾驶员)/整备池(星舰) 每天只开 2 类、每天轮换、3 天走完一轮 6 类；
//   专属池常驻「所有非专属星舰」+「1 艘当期专属」(每 3 天轮换一艘)；三池都有「阶级地板」保底；专属池有进度兑换保底。

/** 三池 id。 */
export type S7GachaPoolId = 'recruit' | 'refit' | 'exclusive';
/** 抽到的单位种类。 */
export type S7GachaUnitKind = 'ship' | 'pilot';

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
  /** 专属舰 id 列表（每 rotationDays 轮换一艘；只进专属池 / 将来宝库）。 */
  exclusiveShipIds: string[];
  /** 阶级地板保底命中时，可发的「≥A 级星舰」候选（v0.1 占位指定的高阶舰）。 */
  aTierShipIds: string[];
  /** 阶级地板保底命中时，可发的「≥3★ 驾驶员」候选。 */
  aTierPilotIds: string[];

  // ===== 数值探针（v0.1 占位）=====
  /** 专属舰轮换周期（天）。设计=3。 */
  rotationDays: number;
  /** 每天开放的轮换类别数（招募/整备）。设计=2。 */
  dailyOpenCategories: number;
  /** 阶级地板保底：每 N 抽必出 ≥A/3★（命中后该池计数清零）。v0.1 探针。 */
  floorPityDraws: number;
  /** 专属池兑换进度阈值：每累计 N 抽 → 1 个兑换箱。v0.1 探针（设计示例 200）。 */
  exchangeThreshold: number;
  /** 重复本体折专属碎片数（§6/§10.1 设计给定 ~15）。 */
  dupFoldShards: number;
  /** 阶级地板「保底本该给但已拥有」折碎片数（§6 A 级=养到 A 阶总量=60）。 */
  floorFoldShards: number;
  /** 专属池兑换箱「已拥有该专属」溢出折该专属升阶碎片数（v0.1=60，= 满 A 阶）。 */
  exchangeOverflowShards: number;
}

/**
 * 默认抽卡配置（v0.1 占位）。分类按现有 12 舰 / 10 员手分凑齐 6 类；专属舰 = shp10/shp11。
 * 数值为灰盒探针（保底 10 抽 / 专属兑换 50 抽，刻意调小便于灰盒演示与测试；第二块按真实经济校准）。
 */
export const DEFAULT_S7_GACHA_CONFIG: S7GachaConfig = {
  // 整备池 6 派系（非专属舰 shp01-09,12 共 10 艘 → 6 类：四类各 2、两类各 1）。
  refitCategories: [
    { categoryId: 'rf_guard', name: '护卫派系', memberIds: ['shp01', 'shp06'] },
    { categoryId: 'rf_breach', name: '破袭派系', memberIds: ['shp02', 'shp05'] },
    { categoryId: 'rf_snipe', name: '狙击派系', memberIds: ['shp03', 'shp09'] },
    { categoryId: 'rf_suppress', name: '压制派系', memberIds: ['shp04', 'shp08'] },
    { categoryId: 'rf_charge', name: '充能派系', memberIds: ['shp07'] },
    { categoryId: 'rf_versatile', name: '万能派系', memberIds: ['shp12'] },
  ],
  // 招募池 6 角色（pil01-10 共 10 名 → 6 类）。
  recruitCategories: [
    { categoryId: 'rc_guard', name: '守护角色', memberIds: ['pil01', 'pil06'] },
    { categoryId: 'rc_breach', name: '破盾角色', memberIds: ['pil02'] },
    { categoryId: 'rc_shooter', name: '射手角色', memberIds: ['pil03', 'pil10'] },
    { categoryId: 'rc_clear', name: '清场角色', memberIds: ['pil04', 'pil08'] },
    { categoryId: 'rc_jam', name: '干扰角色', memberIds: ['pil05', 'pil09'] },
    { categoryId: 'rc_charge', name: '充能角色', memberIds: ['pil07'] },
  ],
  exclusiveShipIds: ['shp10', 'shp11'],
  aTierShipIds: ['shp02', 'shp03', 'shp09'],
  aTierPilotIds: ['pil02', 'pil03', 'pil07'],

  rotationDays: 3,
  dailyOpenCategories: 2,
  floorPityDraws: 10,
  exchangeThreshold: 50,
  dupFoldShards: 15,
  floorFoldShards: 60,
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
