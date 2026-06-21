// 宝箱开箱配置（阶段一 H-step1，纯 TS，不依赖 cc）：v1.0 §10.6「宝箱」。
//
// ⚠️ 全表 v0.1 占位（Ron 授权 Claude 定灰盒占位·第二块「开箱产出量」统一校准）：
//   - 本块先做**星辉货舱**(starlightCargo)：§10.6「随机量 星核碎片 + 星空宝石 + 3~5 个随机品质信标；
//     开箱展示 3 选项→免费选 1→看 1 次广告再选第 2 个」——即 3 个固定类别(各掷量) 选 freePicks+adPicks 个。
//   - **行动宝藏 / 扩张宝藏**开箱机制不同(三选一固定 / 星核·见 §10.5)，随其来源 G 活动 / I 星核 块一并接，本块不做。
//   - 数值(各类别量范围/信标包个数/品质权重)全占位·第二块校准。
//   - 资源键沿用钱包既有键：coreFrag(星核碎片) / starGem(星空宝石) / beaconCommon|Rare|Epic(信标)。

/** 一笔开箱奖励（应用侧入账：resource→钱包；beaconBundle→逐档加进钱包信标键）。 */
export type S7ChestReward =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'beaconBundle'; items: { resourceId: string; amount: number }[] }; // 信标包（多档随机·按档合并）

/** 一个开箱选项模板（开箱时掷量解析成 S7ChestReward）。 */
export type S7ChestOptionTemplate =
  | { kind: 'resourceRange'; resourceId: string; min: number; max: number }
  | { kind: 'beaconBundle'; minCount: number; maxCount: number; tierWeights: { resourceId: string; weight: number }[] };

/** 一种宝箱的开箱定义：固定选项集 + 免费可选数 + 看广告追加可选数（§10.6 星辉货舱=3 选项·免费1·广告1）。 */
export interface S7ChestDef {
  options: S7ChestOptionTemplate[];
  freePicks: number;
  adPicks: number;
}

export interface S7ChestRewardConfig {
  /** 按 chestId（对齐 S7ChestInventory 的 S7ChestType）。当前仅 starlightCargo。 */
  chests: Record<string, S7ChestDef>;
}

// ===== 默认配置（v0.1 占位探针·第二块校准）=====

export const DEFAULT_S7_CHEST_REWARD_CONFIG: S7ChestRewardConfig = {
  chests: {
    // 星辉货舱：3 选项（星核碎片 / 星空宝石 / 信标包）·免费选 1·看广告再选 1。
    starlightCargo: {
      options: [
        { kind: 'resourceRange', resourceId: 'coreFrag', min: 8, max: 16 },  // 星核碎片（随机量）
        { kind: 'resourceRange', resourceId: 'starGem', min: 3, max: 6 },     // 星空宝石（随机量）
        { // 3~5 个随机品质信标（普通多·史诗少）
          kind: 'beaconBundle', minCount: 3, maxCount: 5,
          tierWeights: [
            { resourceId: 'beaconCommon', weight: 50 },
            { resourceId: 'beaconRare', weight: 35 },
            { resourceId: 'beaconEpic', weight: 15 },
          ],
        },
      ],
      freePicks: 1,
      adPicks: 1,
    },
  },
};
