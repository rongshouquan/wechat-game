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

// ===== 默认配置（v0.7 校准终值换算·选项面值 = 3×整箱类目期望〔选 1/3 口径〕）=====
// 机器真源 PARAMS.cargoChest：整箱期望 coreFrag 1.15 / starGem 1.65 / 信标 普1.0·稀1.4·史0.6（惊喜线让开箱数
// +45% 后的"箱数涨内容降"总账守恒终值）。运行时=三选一结构（§10.6 设计真值），选项面值×3 使"免费选1"的
// 期望==整箱期望。⚠️ 记账偏差：#7 广告再选一 = 第二个选项全额（≈整箱×2）vs 尺子 adPickMult ×1.5——
// 结构差异（选项制 vs 整箱乘数）·量级小（敏感性 宝箱+1 天）·挂灰盒/回归批复校。
export const DEFAULT_S7_CHEST_REWARD_CONFIG: S7ChestRewardConfig = {
  chests: {
    // 星辉货舱：3 选项（星核碎片 / 星空宝石 / 信标包）·免费选 1·看广告再选 1（#7·不限次点位）。
    starlightCargo: {
      options: [
        { kind: 'resourceRange', resourceId: 'coreFrag', min: 2, max: 5 },   // 期望 3.5 ≈ 3×1.15
        { kind: 'resourceRange', resourceId: 'starGem', min: 3, max: 7 },    // 期望 5 ≈ 3×1.65
        { // 信标包：期望 9 枚 ≈ 3×(1.0+1.4+0.6)·权重=1.0:1.4:0.6 归一（高稀有浓缩包身份·A2 步1）
          kind: 'beaconBundle', minCount: 7, maxCount: 11,
          tierWeights: [
            { resourceId: 'beaconCommon', weight: 33 },
            { resourceId: 'beaconRare', weight: 47 },
            { resourceId: 'beaconEpic', weight: 20 },
          ],
        },
      ],
      freePicks: 1,
      adPicks: 1,
    },
  },
};

// ===== 行动宝藏（3 天活动结算·三选一·v0.7 treasure3）=====
// 开箱 UI 归工程灰盒批（"开箱随后接"既有留后项）；内容常量先落=步5 回写口径。
export type S7ActionTreasureOption =
  | { kind: 'plugin'; quality: 'legendary'; count: number }
  | { kind: 'resource'; resourceId: 'shipBlueprint' | 'pilotShardUniversal'; amount: number };

/** 行动宝藏三选一（S10.5 自 v1.0 复原）：传奇插件×1 / 舰通用碎片×20 / 员通用碎片×20——选 1。 */
export const ACTION_TREASURE_OPTIONS: readonly S7ActionTreasureOption[] = Object.freeze([
  { kind: 'plugin', quality: 'legendary', count: 1 },
  { kind: 'resource', resourceId: 'shipBlueprint', amount: 20 },
  { kind: 'resource', resourceId: 'pilotShardUniversal', amount: 20 },
]);
