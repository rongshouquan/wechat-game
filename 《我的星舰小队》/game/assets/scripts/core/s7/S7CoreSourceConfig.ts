// 星核三渠道 + 星空宝库配置（阶段一 I-step1，纯 TS，不依赖 cc）：v1.0 §5.4 / §9.3 / §10.4。
//
// ⚠️ 全表 v0.1 占位（Ron 授权 Claude 定灰盒占位·第二块「合成成本/兑换价/池构成」统一校准）：
//   - 三渠道（§5.4·随机为主·定向兜底）：① 扩张宝藏(7天结算·首次全池自选/之后随机三选一) ② 星核碎片随机合成 ③ 星空宝石→星空宝库定向兑换。
//   - 星空宝库(§10.4)：只卖 星核(含宝库限定核) / 专属星舰·定向兑换·一次性解锁(买过显示已拥有)·慢速兜底。
//   - 宝库限定核(§5.4)：2-3 个最强/最酷核·**只在宝库兑换**(合成/扩张开不出)→ 配置上 = 进 vaultCores 且列入 vaultLimitedCoreIds·**不进 synthesisPool/expansionPool**。
//     现有 config 仅 core01-06(通用)+core07(过载核心·首boss固定)·**限定核属内容铺量**：vaultLimitedCoreIds 暂空、结构留好。
//   - core07 过载核心 = 首个 Boss 固定掉落(F 块)·不进任何渠道池。
//   - 资源键：coreFrag(星核碎片·合成) / starGem(星空宝石·兑换)。

/** 宝库可兑换星核项。 */
export interface S7VaultCoreEntry { coreId: string; gemCost: number; }
/** 宝库可兑换专属星舰项（§9.3 专属星舰=星空宝库定向兑换）。 */
export interface S7VaultShipEntry { shipId: string; gemCost: number; }

export interface S7CoreSourceConfig {
  /** 碎片随机合成 可出的核（随机·赌）。 */
  synthesisPool: string[];
  /** 每次合成消耗的星核碎片。 */
  synthesisCost: number;
  /** 扩张宝藏 三选一/全池自选 的核池。 */
  expansionPool: string[];
  /** 扩张宝藏「非首次」随机三选一的选项数。 */
  expansionChoiceCount: number;
  /** 宝库可兑换星核（含限定核·星宝石定价·一次性解锁）。 */
  vaultCores: S7VaultCoreEntry[];
  /** 宝库可兑换专属星舰。 */
  vaultShips: S7VaultShipEntry[];
  /** 宝库限定核 id（只在宝库·不进 synthesis/expansion·占位空·内容铺量填 2-3 个）。 */
  vaultLimitedCoreIds: string[];
}

// ===== 默认配置（v0.1 占位探针·第二块校准）=====

const GENERAL_CORES = ['core01', 'core02', 'core03', 'core04', 'core05', 'core06']; // 通用核（core07=过载核心 不进池）

export const DEFAULT_S7_CORE_SOURCE_CONFIG: S7CoreSourceConfig = {
  synthesisPool: GENERAL_CORES.slice(),
  synthesisCost: 60, // 星核碎片/颗（占位）
  expansionPool: GENERAL_CORES.slice(),
  expansionChoiceCount: 3,
  vaultCores: GENERAL_CORES.map((coreId) => ({ coreId, gemCost: 80 })), // 占位定价；限定核(内容铺量)以更高价进此表 + 进 vaultLimitedCoreIds
  vaultShips: [
    { shipId: 'shp10', gemCost: 200 },
    { shipId: 'shp11', gemCost: 200 },
  ],
  vaultLimitedCoreIds: [], // 占位空：限定核属内容铺量（2-3 个最强核·届时进 vaultCores 且列此）
};
