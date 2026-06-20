// 升阶/升星配置（纯 TS，不依赖 cc）：v1.0 §6 升阶(星舰)/升星(驾驶员) 的成本与战力涨幅。
//
// ⚠️ 全表 v0.1 占位（第二块「碎片经济 + 战力曲线」校准）：
//   - 星舰升阶专属碎片量按设计给定 A级=C→B→A=20+40=60；通用舰碎片(shipBlueprint)/驾驶员各项=占位探针。
//   - 战力涨幅(每阶/每星 %)=占位；shipPowerOf 现为占位口径，精确战力公式第二块。

/** 星舰每阶升阶成本（index 0 = C→B、1 = B→A）：专属碎片(该舰) + 通用舰碎片(shipBlueprint·钱包)。 */
export interface S7ShipAscendCost { exclusiveShards: number; shipBlueprint: number; }
/** 驾驶员每星升星成本（index 0 = 1★→2★ … 3 = 4★→5★）：专属碎片(该员) + 通用员碎片(pilotShardUniversal·钱包)。 */
export interface S7PilotStarupCost { exclusiveShards: number; pilotShardUniversal: number; }

export interface S7AscendConfig {
  shipTierStepCost: S7ShipAscendCost[];   // 长度 = SHIP_TIER_MAX(2)
  pilotStarStepCost: S7PilotStarupCost[];  // 长度 = PILOT_STAR_MAX-1(4)
  /** 星舰各阶累计战力加成%（index = tier·0=C）：占位·任何养成都抬战力(§6)。 */
  shipTierPowerPct: number[];
  /** 驾驶员各星累计战力加成%（index = star-1·0=1★）。 */
  pilotStarPowerPct: number[];
}

export const DEFAULT_S7_ASCEND_CONFIG: S7AscendConfig = {
  // 专属碎片：C→B=20、B→A=40（设计给定·A级总 60）；通用舰碎片占位。
  shipTierStepCost: [
    { exclusiveShards: 20, shipBlueprint: 2 },
    { exclusiveShards: 40, shipBlueprint: 5 },
  ],
  // 驾驶员升星专属+通用碎片（占位·递增）。
  pilotStarStepCost: [
    { exclusiveShards: 10, pilotShardUniversal: 2 }, // 1★→2★
    { exclusiveShards: 15, pilotShardUniversal: 3 }, // 2★→3★
    { exclusiveShards: 25, pilotShardUniversal: 5 }, // 3★→4★
    { exclusiveShards: 40, pilotShardUniversal: 8 }, // 4★→5★
  ],
  shipTierPowerPct: [0, 12, 28],          // C/B/A
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
