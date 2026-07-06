// 手写类型声明：给 vitest/tsc 提供 simulate-s7-economy.mjs 的导出面（工具本体是纯 JS·零依赖）。
// 只声明测试与后续子步会用到的公开 API；内部结构（台账/状态机）以运行时为准。

export interface S7ShapeTierParams { minutesPerDay: number; r: number; stuckBonus: number }
export declare const SHAPE: {
  N: number; base: number; qStart: number; qEnd: number; curvePow: number;
  bossPositions: number[]; bossSpike: number; P0: number;
  SEC_PER_NODE: number; MAX_DAYS: number;
  tiers: Record<string, S7ShapeTierParams>;
};
export declare function shapeRequiredCurve(s?: typeof SHAPE): number[];
export declare function shapeSimulate(tierName: string, s?: typeof SHAPE): { graduateDay: number | null; dailyLog: number[] };
export declare function shapeDaySchedule(tierName?: string, s?: typeof SHAPE): number[];

export declare const TRUTHS: {
  N: number;
  regionSpans: { sf: number; from: number; to: number }[];
  bossNodes: number[];
  storyBossNode: number;
  eliteNodes: number[];
  tierBase: number[];
  shipLevelPowerPct: number;
  pilotStarCoef: number[];
  pilotLevelPct: number;
  pluginPower: { fine: number; superior: number; legendary: number };
  corePower: number;
  pluginSlotsByTier: number[];
  shipLevelCapByTier: number[];
  pilotLevelCapByStar: number[];
  shipLevelCost: (lv: number) => number;
  pilotLevelCost: (lv: number) => number;
  synthesizeBodyShards: number;
  shipAscendCost: number[];
  pilotStarupCost: number[];
  buildingCost: (level: number, coef: number) => number;
  buildingImportance: Record<string, number>;
  habitatStorageHours: (lv: number) => number;
  habitatRatePct: (lv: number) => number;
  researchPowerPct: (lv: number) => number;
  galleryPerCorePct: (lv: number) => number;
  galleryCapPct: number;
  salvageQueues: (lv: number) => number;
  buildingMaxLevel: number;
  salvageTimeMult: { h2: number; h8: number; h24: number };
  bountyDailyCards: number;
  bountyQualityMult: { bronze: number; silver: number; gold: number };
  bountyGoldPity: number;
  bountyPerfectMult: number;
  bountyAmbushRate: number;
  bountyAmbushLossPct: number;
  bountyBoardCap: number[];
  corridorMilestoneEvery: number;
  corridorEchoEvery: number;
  gachaPity: number;
  vaultRepeatPriceGrowth: number;
  eventCycle3: number;
  eventCycle7: number;
};

export declare const PARAMS: Record<string, any> & { maxDays: number };
export interface S7EconTierProfile {
  minutesPerDay: number; sessionsPerDay: number; adsPerDay: number;
  dailyCompletion: number; eventCompletion: number;
  salvageRunsPerQueue: number; corridorMinutes: number; shoppingPower: number;
  tinkerBonus: number; consolationTries?: number; stallCorridorMult?: number;
}
export declare const TIERS: Record<string, S7EconTierProfile>;
export declare const TARGETS: Record<string, number>;
export declare const RESOURCE_KEYS: string[];

export declare function regionOfNode(n: number, truths?: typeof TRUTHS): number;
export declare function nodeStage(n: number, truths?: typeof TRUTHS): 'normal' | 'elite' | 'boss' | 'storyBoss';
export declare function shipBasePower(tier: number, level: number, truths?: typeof TRUTHS): number;
export declare function pilotCoef(star: number, level: number, truths?: typeof TRUTHS): number;
export declare function unitPower(
  ship: { tier: number; level: number }, pilot: { star: number; level: number } | null,
  pluginSum: number, hasCore: boolean, truths?: typeof TRUTHS,
): number;
export declare function teamPower(st: unknown, truths?: typeof TRUTHS): number;

export interface S7EconRunOpts {
  envelope?: 'expected' | 'lucky' | 'unlucky';
  ads?: 'profile' | 'none' | 'full';
  disable?: Partial<Record<'offline' | 'patrol' | 'bounty' | 'corridor' | 'salvage' | 'gacha' | 'events' | 'mail' | 'merchant' | 'puzzle' | 'mainlineRewards', boolean>>;
  incomeScale?: Record<string, number>;
  pause?: { from: number; days: number };
  runFullDays?: boolean;
}
export interface S7EconResult {
  tier: string;
  graduateDay: number | null;
  cleared: number;
  firstWeekCleared: number;
  firstWeekPct: number;
  maxWallDays: number;
  wallsOver2: number;
  wallDays: Record<string, number>;
  finalPower: number;
  corridorLayer: number;
  coresOwned: number;
  mains: { shipTier: number; shipLv: number; star: number; pilotLv: number }[];
  offShards: { ship: number; pilot: number };
  resources: Record<string, number>;
  negativeViolations: { day: number; key: string; value: number }[];
  adsUsedTotal: number;
  dailyCleared: number[];
  dailyPower: number[];
  ledger: { income: Record<string, Record<string, number>>; spend: Record<string, Record<string, number>> };
}
export declare function simulateEconomyTier(tierName: string, pressure: number[], opts?: S7EconRunOpts, P?: typeof PARAMS, T?: typeof TRUTHS): S7EconResult;
export declare function seedPressureCurve(scaleGuess?: number): number[];
export declare function calibratePressure(P?: typeof PARAMS, T?: typeof TRUTHS): { pressure: number[]; gamma: number };
export declare function runStandard(pressure: number[], P?: typeof PARAMS): Record<string, { expected: S7EconResult; lucky: S7EconResult; unlucky: S7EconResult }>;
export declare function checkCalibration(std: ReturnType<typeof runStandard>, P?: typeof PARAMS): string[];
export declare function runAdComparison(pressure: number[], P?: typeof PARAMS): Record<string, { fullDays: number | null; zeroDays: number | null; speedup: number | null; zeroMaxWall: number }>;
export declare function runSensitivity(pressure: number[], P?: typeof PARAMS): { base: number | null; rows: { source: string; graduateDay: number | null; delta: number | string }[] };
export declare function runHalving(pressure: number[], P?: typeof PARAMS): { base: number | null; rows: { source: string; graduateDay: number | null; delta: number | string }[] };
export declare function runCatchup(pressure: number[], P?: typeof PARAMS): { tier: string; from: number; days: number; base: number | null; graduateDay: number | null; delay: number | null; extraVsPause: number | null }[];
