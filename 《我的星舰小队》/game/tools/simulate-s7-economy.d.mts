// 手写类型声明：给 vitest/tsc 提供 simulate-s7-economy.mjs 的导出面（工具本体是纯 JS·零依赖）。
// 只声明测试与后续子步会用到的公开 API；内部结构（台账/状态机）以运行时为准。

export interface S7ShapeTierParams { minutesPerDay: number; r: number; stuckBonus: number }
export declare const SHAPE: {
  N: number; base: number; qStart: number; qEnd: number; curvePow: number;
  bossSpikes: Record<number, number>; P0: number;
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
  // 建筑细案入尺批（细案 v1 八栋逐级表）
  galleryFragLv: number;
  galleryGemLv: number;
  salvageQueues: (lv: number) => number;
  salvageSurpriseLvls: (lv: number) => number;
  salvageExtraRollLv: number;
  dockDiscountPctPerLv: number;
  trainingDiscountPctPerLv: number;
  supplyFreePulls: (lv: number) => number;
  supplyPullPerTicket: (lv: number) => number;
  buildingMaxLevel: number;
  salvageTimeMult: { h2: number; h8: number; h24: number };
  bountyDailyCards: number;
  bountyQualityMult: { bronze: number; silver: number; gold: number };
  bountyGoldEveryDays: number;
  bountySilverPerDay: number;
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

export interface S7SalvageTierDef {
  ore: number; cargo: number; universal: number;
  fixed: Record<string, number>; rolls: Record<string, number>; rollEV: Record<string, number>;
}
export interface S7BlackMarketGood { price: number; give: Record<string, number> }
export declare const PARAMS: {
  maxDays: number;
  salvage: {
    minutes: number;
    yieldScale: number;      // 建筑细案入尺批：队数 3/4/5 的单趟守恒系数
    yieldScaleDur: string;   // 守恒刀只落此时长档（'h24' 长趟专刀·选型记档）
    tiers: Record<'common' | 'rare' | 'epic', S7SalvageTierDef>; accel: { price: number };
  };
  events: {
    cycle3: Record<string, number>; cycle7: Record<string, number>;
    completion7: Record<string, number>; completionCore: number;
    treasure3: { legendaryPlugin: number; universalShards: number };
    completionThreshold: number;
  };
  bounty: {
    escortAlloy: number; escortCargo: number; coefPow: number;
    difficulty: {
      mults: Record<'novice' | 'normal' | 'hard' | 'nightmare', number>;
      recNodes: Record<'novice' | 'normal' | 'hard' | 'nightmare', number>;
      crushRatio: number; probeMinRatio: number; failFloor: number;
    };
    goldPhysical: Record<string, number>; ambushWinBonus: Record<string, number>;
    perfectRate: number; ambushWinRate: number; minutesPerCard: number; stallBudgetMult: number;
  };
  drill: {
    dps: number; windowSec: number;
    thresholdBase: number; thresholdGrowth: number; tiers: number;
    rewardBase: number; rewardGrowth: number; minutes: number;
  };
  core: {
    synthesisFragCost: number; eggStrongWeight: number;
    doubleYolkP: number;      // 双黄蛋（细案⑧ Lv10·案A 0.03/案B 0.05/案C 0）
    eggLv10CostMult: number;  // 开蛋九折（案C 0.9·其余 1.0）
    distinctPity: number;     // 核保底前 5 颗不重复（细案§二1）
    vaultFlowPrice: number; vaultGradPrice: number; treasureGradP: number; gradSaveAfterCores: number;
  };
  gallery: { fragPerSpecies: number; gemPerSpecies: number }; // 展厅双层分红（量级可调）
  workerDiscount: { minHabitatLv: number; pctLv3: number; pctLv6: number; pctLv10: number; capPct: number };
  supplyGacha: { aPctByLv: number[] }; // A 级概率垫层（绝对加点·可调旋钮）
  ads: { ticketPerAd: number; salvageInstantDur: string; offlineDoubleMult: number; overnightShare: number };
  blackMarket: {
    unlockNode: number; dailyViewCap: number;
    box: { price: number; give: Record<string, number>; fullCoreP: number; gradCoreP: number };
    goods: Record<string, S7BlackMarketGood>; largeMinPrice: number;
    smalls: { slots: number; adRerollMult: number; pool: Record<string, { w: number; wLv8?: number; price: number; give: Record<string, number> }> };
    smallPriority: string[];
  };
  merchant: {
    ticketPrice: number; ticketDailyCap: number; adTicketPrice: number;
    cargoReserve: number; richThreshold: number;
    rare: { slotsByLv: number[]; pool: Record<string, { w: number; wLv8?: number; price: number; minLv: number; give: Record<string, number> }> };
    staple: { beaconCommonPrice: number; wallPack: { cargoCost: number; hullAlloy: number; pilotToken: number; capPerDay: number }; finePlugin: { p: number; price: number } };
    discountLv10: number; recycleStep: { beacon: number; plugin: number }; minutes: number;
  };
  pressureCalib: { iterations: number; blend: number; gammaLo: number; gammaHi: number; gammaSteps: number; anchorNodes: number[] };
} & Record<string, any>;
export interface S7EconTierProfile {
  minutesPerDay: number; sessionsPerDay: number; adsPerDay: number;
  dailyCompletion: number; eventCompletion: number;
  salvageRunsPerQueue: number; corridorMinutes: number; shoppingPower: number;
  tinkerBonus: number; consolationTries?: number; stallCorridorMult?: number;
  bountyMinutes: number; bountyCatchup: number; bountyPerfect: number;
  bountyProbe: boolean; drillSkill: number; drillRate?: number; adTickets: number;
  bm?: { chain: boolean; buy: boolean; extraTickets?: number };
}
export declare const TIERS: Record<string, S7EconTierProfile>;
export declare const TARGETS: Record<string, number>;
export declare const BM_TARGET: { tier: string; min: number; max: number };
// 对锚与阶梯批：旧 WALL_MATRIX_BANDS/_DRIFT（肝党锚带）退役 → 十六格点靶 + 双轴单调守卫。
export declare const WALL_MATRIX_TARGET: Record<string, Record<string, number>>;
export declare const WALL_MATRIX_TOL: number;
export declare const WALL_MATRIX_DRIFT_TOL: number;
export declare const WALL_MONO_EXCEPTIONS: Set<string>;
export declare function checkWallMatrix(std: unknown, tol: number, opts?: { mono?: boolean }): string[];
export declare const WELFARE_POINTS: Set<string>;
export declare const HARD_WALL_CAP: number;
export declare const HARD_WALL_CAP_DRIFT_LIGHT: number;
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
export declare function benchPool(st: unknown, truths?: typeof TRUTHS): number;
export declare function benchEffPct(pool: number, P?: typeof PARAMS): number;
export declare function bountyCardsFor(
  tier: S7EconTierProfile, backlog: number, minutesLeft: number, wallDay: boolean,
  P?: typeof PARAMS, T?: typeof TRUTHS,
): number;
export declare function incomeShares(run: S7EconResult, key: string): {
  bounty: number; drill: number; offline: number; patrol: number; mainline: number; total: number;
};
// 任务单⑧新纯函数（gate 直测面）
export declare function commissionQualityEV(T?: typeof TRUTHS): {
  goldPerCard: number; silverPerCard: number; bronzePerCard: number; qMult: number;
};
export declare function pickCommissionDifficulty(tier: S7EconTierProfile, power: number, pressure: number[], P?: typeof PARAMS): {
  safe: string; safeMult: number; probe: string | null; probeMult: number; pWin: number;
};
export declare function drillTierFor(power: number, skill?: number, P?: typeof PARAMS): number;
export declare function drillCumReward(k: number, P?: typeof PARAMS): number;
export declare function expectedDistinctCores(st: {
  cleared: number;
  coreDraws: { egg: number; eggYolk?: number; treasure: number; bmFlow: number; shopFlow: number; vaultFlow: number; vaultDupes: number };
  gradCores: { vault: number; bm: number; treasureEV: number };
}, P?: typeof PARAMS, T?: typeof TRUTHS): number;

// 建筑细案入尺批·新纯函数与直测出口
export declare function upgradeDiscountMult(buildingLv: number, pctPerLv: number): number;
export declare function workerBuildDiscount(habitatLv: number, workers: number, P?: typeof PARAMS): number;
export declare function galleryDividendPerDay(galleryLv: number, distinct: number, P?: typeof PARAMS, T?: typeof TRUTHS): { coreFrag: number; starGem: number };
export declare const SALVAGE_SURPRISE_KEYS: Set<string>;
export declare function doCores(
  st: unknown, debit: (src: string, key: string, amt: number) => boolean,
  day: number, env: { coreLuck?: number }, P?: typeof PARAMS, T?: typeof TRUTHS,
): void;
export declare function doSalvage(
  st: unknown, credit: (src: string, key: string, amt: number) => void,
  debit: (src: string, key: string, amt: number) => boolean,
  tier: { salvageRunsPerQueue: number }, env: { salvageRollMult: number },
  adRun: boolean, P?: typeof PARAMS, T?: typeof TRUTHS,
): void;
export declare function doLevelUps(st: unknown, debit: (src: string, key: string, amt: number) => boolean, T?: typeof TRUTHS): void;

export interface S7EconRunOpts {
  envelope?: 'expected' | 'lucky' | 'unlucky';
  ads?: 'profile' | 'none' | 'full';
  disable?: Partial<Record<'offline' | 'patrol' | 'bounty' | 'drill' | 'corridor' | 'salvage' | 'gacha' | 'events' | 'mail' | 'merchant' | 'puzzle' | 'mainlineRewards' | 'blackMarket' | 'bmBox' | 'gallery', boolean>>;
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
  wallWait: Record<string, number>;
  newbieStuckDays: number;
  finalPower: number;
  corridorLayer: number;
  coresOwned: number;
  coresDistinct: number;
  coreDays: number[];
  gradCoreDays: number[];
  gradCores: { vault: number; bm: number; treasureEV: number };
  coreDraws: { egg: number; treasure: number; bmFlow: number; shopFlow: number; vaultFlow: number; vaultDupes: number };
  drillTier: number;
  bountyDiffMult: number;
  mains: { shipTier: number; shipLv: number; star: number; pilotLv: number }[];
  offShards: { ship: number; pilot: number };
  bountyCards: number;
  benchPct: number;
  resources: Record<string, number>;
  negativeViolations: { day: number; key: string; value: number }[];
  adsUsedTotal: number;
  adPointUses: Record<string, number>;
  bm: { balance: number; earnedTotal: number; earned: Record<string, number>; spent: number; buys: Record<string, number>; ticketsBought: number; boxes: number };
  milestones: { node: number; day: number; power: number; mains: number[][]; plugins: { fine: number; superior: number; legendary: number }; cores: number }[];
  dailyCleared: number[];
  dailyPower: number[];
  // 对锚批观察口：当日开打战力 + 当日养成态（[阶下标,舰级,驾星,驾级]×5·爬坡矩阵工具口径）+ 日终回廊层
  dailyOpenPower: number[];
  dailyMains: [number, number, number, number][][];
  dailyCorridor: number[];
  // 节奏观察口（专属碎片逐日流·建筑细案批免费抽接线测试用）
  dailyMainShards: ({ shipMain: number; shipOff: number; pilotMain: number; pilotOff: number } | undefined)[];
  ledger: { income: Record<string, Record<string, number>>; spend: Record<string, Record<string, number>> };
}
export interface S7PressureAnchor { node: number; targetDay: number; gamma: number }
export declare function simulateEconomyTier(tierName: string, pressure: number[], opts?: S7EconRunOpts, P?: typeof PARAMS, T?: typeof TRUTHS): S7EconResult;
export declare function seedPressureCurve(scaleGuess?: number): number[];
export declare function gammaAt(n: number, anchors: S7PressureAnchor[]): number;
export declare function calibratePressure(P?: typeof PARAMS, T?: typeof TRUTHS): {
  pressure: number[]; gammas: number[]; anchors: S7PressureAnchor[]; schedule: number[];
};
export declare function runStandard(pressure: number[], P?: typeof PARAMS, opts?: { tiers?: string[]; envelopes?: boolean }): Record<string, { expected: S7EconResult; lucky?: S7EconResult; unlucky?: S7EconResult }>;
export declare function checkCalibration(std: ReturnType<typeof runStandard>, P?: typeof PARAMS): string[];
export declare function checkDriftPromise(std: ReturnType<typeof runStandard>, P?: typeof PARAMS): string[];
export declare function checkBlackMarket(run: S7EconResult, P?: typeof PARAMS): string[];
export declare const DRIFT_VARIANTS: { source: string; mult: number }[];
export declare function perturbedParams(source: string, mult: number, P?: typeof PARAMS): typeof PARAMS;
export declare function runDriftVariant(source: string, mult: number, P?: typeof PARAMS, T?: typeof TRUTHS): {
  variant: string; errors: string[]; days: Record<string, number | null>;
  liverWalls: Record<string, number>; maxWalls: Record<string, number>; gammas: number[];
};
export declare function runDriftGuard(P?: typeof PARAMS, variants?: { source: string; mult: number }[]): ReturnType<typeof runDriftVariant>[];
export declare function runAdComparison(pressure: number[], P?: typeof PARAMS): Record<string, { fullDays: number | null; zeroDays: number | null; speedup: number | null; speedupWithBox: number | null; zeroMaxWall: number }>;
export declare function runSensitivity(pressure: number[], P?: typeof PARAMS): { base: number | null; rows: { source: string; graduateDay: number | null; delta: number | string }[] };
export declare function runHalving(pressure: number[], P?: typeof PARAMS): { base: number | null; rows: { source: string; graduateDay: number | null; delta: number | string }[] };
export declare function runCatchup(pressure: number[], P?: typeof PARAMS): { tier: string; from: number; days: number; base: number | null; graduateDay: number | null; delay: number | null; extraVsPause: number | null }[];
