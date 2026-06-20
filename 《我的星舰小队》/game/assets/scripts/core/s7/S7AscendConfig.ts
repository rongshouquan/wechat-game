// 升阶/升星配置（纯 TS，不依赖 cc）：v1.0 §6 升阶(星舰)/升星(驾驶员) 的成本与战力涨幅。
//
// ⚠️ 全表 v0.1 占位（第二块「碎片经济 + 战力曲线」校准）：
//   - 升阶/升星**只扣专属碎片**（Ron 2026-06-21）；通用碎片不直接抵扣，需在背包手动转成指定单位的专属碎片(见 convertUniversalToExclusive)。
//   - 星舰 5 阶 C→B→A→S→SS：专属碎片量 C→B=20/B→A=40（设计给定 A级=60）·A→S/S→SS=占位；战力涨幅=占位。

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
  // 专属碎片：C→B=20、B→A=40（设计给定 A级总 60）；A→S/S→SS 占位递增。
  shipTierStepCost: [
    { exclusiveShards: 20 },  // C→B
    { exclusiveShards: 40 },  // B→A
    { exclusiveShards: 80 },  // A→S（占位）
    { exclusiveShards: 120 }, // S→SS（占位）
  ],
  // 驾驶员升星专属碎片（占位·递增）。
  pilotStarStepCost: [
    { exclusiveShards: 10 }, // 1★→2★
    { exclusiveShards: 15 }, // 2★→3★
    { exclusiveShards: 25 }, // 3★→4★
    { exclusiveShards: 40 }, // 4★→5★
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
