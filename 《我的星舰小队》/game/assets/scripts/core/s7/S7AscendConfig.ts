// 升阶/升星配置（纯 TS，不依赖 cc）：v1.0 §6 升阶(星舰)/升星(驾驶员) 的成本与战力涨幅。
//
// 成本梯＝真源对齐（段二 2a·总控批发现①·2026-07-12）：50/100/300/1000 两线同梯——
//   真源=GDD-附录D-星舰/驾驶员真源 §0＋细表 §6 支出侧＋机器真源 TRUTHS.shipAscendCost/pilotStarupCost
//   （守卫=s7_power_rating_sync 对表测试）；旧 20/40/80/120·10/15/25/40=v0.1 占位从未过真源（git 可溯）。
//   升阶/升星**只扣专属碎片**（Ron 2026-06-21）；通用碎片不直接抵扣，需在背包手动转成指定单位的专属碎片(见 convertUniversalToExclusive)。
//   30 碎合成本体（获取通道·非升阶成本）＝挂工程灰盒批实装，与本表无关。
// ⚠️ shipTierPowerPct/pilotStarPowerPct 仍为 v0.1 占位遗留字段（无运行时消费·战力走 S7PowerRating 刻度 v1），留待清理批。

/** 星舰每阶升阶成本（index 0=C→B … 3=S→SS）：只扣专属碎片(该舰)。 */
export interface S7ShipAscendCost { exclusiveShards: number; }
/** 驾驶员每星升星成本（index 0=1★→2★ … 3=4★→5★）：只扣专属碎片(该员)。 */
export interface S7PilotStarupCost { exclusiveShards: number; }

export interface S7AscendConfig {
  shipTierStepCost: S7ShipAscendCost[];   // 长度 = SHIP_TIER_MAX(4)
  pilotStarStepCost: S7PilotStarupCost[];  // 长度 = PILOT_STAR_MAX-1(4)
  /** 星舰各阶累计战力加成%（index = tier·0=C…4=SS）：占位·任何养成都抬战力(§6)。 */
  shipTierPowerPct: number[];
  /** 驾驶员各星累计战力加成%（index = star-1·0=1★）。 */
  pilotStarPowerPct: number[];
}

export const DEFAULT_S7_ASCEND_CONFIG: S7AscendConfig = {
  // 专属碎片（真源梯·两线同值）：50/100/300/1000。
  shipTierStepCost: [
    { exclusiveShards: 50 },   // C→B
    { exclusiveShards: 100 },  // B→A
    { exclusiveShards: 300 },  // A→S
    { exclusiveShards: 1000 }, // S→SS
  ],
  // 驾驶员升星专属碎片（与星舰同梯·真源 §0）。
  pilotStarStepCost: [
    { exclusiveShards: 50 },   // 1★→2★
    { exclusiveShards: 100 },  // 2★→3★
    { exclusiveShards: 300 },  // 3★→4★
    { exclusiveShards: 1000 }, // 4★→5★
  ],
  shipTierPowerPct: [0, 12, 28, 48, 72],  // C/B/A/S/SS
  pilotStarPowerPct: [0, 6, 14, 24, 36],  // 1★..5★
};

/** 星舰某阶累计战力加成%（占位）。 */
export function shipTierPowerPct(config: S7AscendConfig, tier: number): number {
  const i = Math.max(0, Math.min(config.shipTierPowerPct.length - 1, Math.floor(tier)));
  return config.shipTierPowerPct[i] ?? 0;
}
/** 驾驶员某星累计战力加成%（占位）。 */
export function pilotStarPowerPct(config: S7AscendConfig, star: number): number {
  const i = Math.max(0, Math.min(config.pilotStarPowerPct.length - 1, Math.floor(star) - 1));
  return config.pilotStarPowerPct[i] ?? 0;
}
