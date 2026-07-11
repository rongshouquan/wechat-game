// 星港悬赏板（步5 收尾批回写·纯 TS，不依赖 cc）：GDD-v2.0 S10.8（2026-07-07 总修订案重构后口径）。
// 定位：每天凌晨 4 点（s7DayKey）刷出 3 张护航委托的日常辅助战斗档；所有场次真打（看戏找策略、不秒结算/不速刷）。
//
// 口径（GDD S10.8 终版·数值终值=初值表 v0.7 §6-1·机器真源 TRUTHS/PARAMS.bounty）：
// - 生成：每登录日刷 3 张全护航卡（演习已剥离进木桩=S7DrillConfig）；按日界种子确定性生成
//   （seed=bounty_<dayKey>，杀进程重进不换卡）；卡=品质(铜/银/金) + 词缀(条数随品质 铜1/银2/金3)。
// - 品质=明保底（Ron 2026-07-07 拍板·取代旧"金8%+暗保底"）：每天 3 张必含 ≥1 张银色；每 3 天必出 1 张金色
//   （日程表确定性=受控方差·单张期望 金1/9·银1/3·铜5/9）。
// - 积压：未做的卡留板，上限 6/9/12（居住舱基础/Lv5/Lv10=S7BuildingEffects.bountyBoardCap·细案③）；
//   超上限掉最旧；停玩天不发卡（登录日才刷=发卡"每登录日"口径）。
// - 产出：单张合金 495·星贝 20 ×星域系数^0.6 ×品质倍率(1/1.6/3) ×难度倍率 ×完美1.25；
//   星域系数取 ^0.6=难度爬档已是显式进度倍率、全系数会双重计 progression（机器真源 coefPow）。
//   金卡附赠实物(信标/通用碎片/补给券轮换·确定性)；星矿不入（守 S9 星矿四来源）。
// - 难度四档自选（总修订案 1a·选择 UI 归工程灰盒批）：新手0.7/普通1.0/困难1.5/噩梦2.2；
//   推荐战力=压力表定点 n10/n55/n98/n130（v0.9 快照值内嵌常量·对表测试钉与 json 一致）。
// - 敌阵基底=recNodes 固定锚点法（定价重锚批·拍板5）：难度→锚点节点敌阵（随压力表重校自动重校）；
//   旧灰盒"已通关最高星域首个战斗节点"退役（滞后内容×2.2 倍率=D2 白拿印钞·§16e 发现3）。
// - 遇袭（护航专属·15%·按卡确定性）：追加一场星盗遭遇战，赢=额外小包、输=折损本单入账 30%。
// - 词缀=本场对我方指定定位型的 buff+debuff（S7CommissionAffix 应用·配置表 commission_affix_param 驱动）。

import { starfieldCoefficient } from './S7OfflineProduction';
import { bountyBoardCap } from './S7BuildingEffects';
import { s7DayKey } from './S7AdDailyCounter';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7AutoBattleResult } from './S7AutoBattleTypes';
import { S7AutoBattleRng } from './S7AutoBattleRng';

export { bountyBoardCap } from './S7BuildingEffects';

export type S7BountyTheme = 'escort' | 'drill';
export type S7BountyQuality = 'bronze' | 'silver' | 'gold';
export const S7_BOUNTY_THEMES: readonly S7BountyTheme[] = Object.freeze(['escort', 'drill']);
export const S7_BOUNTY_QUALITIES: readonly S7BountyQuality[] = Object.freeze(['bronze', 'silver', 'gold']);

// ===== v0.7 校准终值（照抄不调数）=====
/** 每天刷出的卡数（总修订案：4→3 张·全护航）。 */
export const DAILY_CARDS = 3;
/** 明保底：每 GOLD_EVERY_DAYS 个发卡日必出 1 张金（dayKey % 3 === 0 的发卡日）。 */
export const GOLD_EVERY_DAYS = 3;
/** 明保底：每天 3 张必含的银卡张数。 */
export const SILVER_PER_DAY = 1;
/** 品质定词缀条数（铜1/银2/金3）。 */
export const AFFIX_COUNT: Readonly<Record<S7BountyQuality, number>> = Object.freeze({ bronze: 1, silver: 2, gold: 3 });
/** 品质产出倍率（铜1/银1.6/金3）。 */
export const QUALITY_MULT: Readonly<Record<S7BountyQuality, number>> = Object.freeze({ bronze: 1, silver: 1.6, gold: 3 });
/** 完美护航加成倍率（运输船满血 ×1.25）。 */
export const PERFECT_BONUS_MULT = 1.25;
/** 护航遇袭触发概率（15%·按卡确定性）。 */
export const AMBUSH_RATE = 0.15;
/** 星域系数衰减指数（难度爬档已是显式进度倍率·全系数=双重计）。 */
export const BOUNTY_COEF_POW = 0.6;
/** 老档折算铜卡上限（迁移用·取基础容量 6）。 */
export const LEGACY_MIGRATION_CAP = 6;

/** 难度四档（总修订案 1a）：倍率 + 推荐战力（=v0.9 压力表 n10/n55/n98/n130 快照值·对表测试钉 json 一致·
 *  重定基：v0.7 快照 {140,2972,8443,17319}=旧刻度读数 → 定价重锚 v1 后同四锚点的诚实新读数）。 */
export type S7BountyDifficulty = 'novice' | 'normal' | 'hard' | 'nightmare';
export const S7_BOUNTY_DIFFICULTIES: readonly S7BountyDifficulty[] = Object.freeze(['novice', 'normal', 'hard', 'nightmare']);
export const BOUNTY_DIFFICULTY_MULTS: Readonly<Record<S7BountyDifficulty, number>> = Object.freeze({
  novice: 0.7, normal: 1.0, hard: 1.5, nightmare: 2.2,
});
export const BOUNTY_DIFFICULTY_REC_POWER: Readonly<Record<S7BountyDifficulty, number>> = Object.freeze({
  novice: 136, normal: 1952, hard: 4500, nightmare: 6639,
});
/** 难度→敌阵锚点节点（=经济尺 PARAMS.bounty.difficulty.recNodes 镜像·改任一侧必须同步·对表测试钉）。 */
export const BOUNTY_DIFFICULTY_ANCHOR_NODES: Readonly<Record<S7BountyDifficulty, string>> = Object.freeze({
  novice: 'n010', normal: 'n055', hard: 'n098', nightmare: 'n130',
});

/** 基础产出/张（护航=合金+星贝·v0.7 终值 495/20；drill 行=老开发档积压消化用量·新卡不再生成演习）。 */
export const BOUNTY_BASE_REWARDS: Readonly<Record<S7BountyTheme, Readonly<Record<string, number>>>> = Object.freeze({
  escort: Object.freeze({ hullAlloy: 495, starCargo: 20 }),
  drill: Object.freeze({ pilotToken: 370 }),
});
/** 金卡附赠实物轮换（普通信标 / 通用星舰碎片 / 补给券），按获得次数轮换（期望各 1/3=机器真源 goldPhysical）。 */
export const GOLD_PHYSICAL_ROTATION: readonly string[] = Object.freeze(['beaconCommon', 'shipBlueprint', 'supplyTicket']);
export const GOLD_PHYSICAL_AMOUNT = 1;
/** 遇袭额外小包轮换（通用碎片 / 补给券），按获得次数轮换（期望各 1/2=机器真源 ambushWinBonus 0.5/0.5）。 */
export const AMBUSH_BONUS_ROTATION: readonly string[] = Object.freeze(['shipBlueprint', 'supplyTicket']);
export const AMBUSH_BONUS_AMOUNT = 1;

/** 运输船 battle_unit_stat_param.rowId（护航专用 prop 单位·不攻击可被打·沿用块2 配置）。 */
export const ESCORT_TRANSPORT_STAT_REF = 'bu_commission_transport';
/** 开场召唤运输船的 battle_effect_param.rowId。 */
export const ESCORT_TRANSPORT_SUMMON_EFFECT = 'eff_commission_transport_summon';

/** 一张悬赏卡。 */
export interface S7BountyCard {
  /** 板内唯一 id（今日卡=`<genDayKey>_<slot>`；老档折算=`legacy_<i>`）。 */
  id: string;
  /** 生成日 s7DayKey（0=老档折算/无日）；超容量时最旧先掉、金卡实物轮换按它。 */
  genDayKey: number;
  theme: S7BountyTheme;
  quality: S7BountyQuality;
  /** 携带词缀 id（指向 commission_affix_param.rowId；老档折算卡为空）。 */
  affixIds: string[];
}

/** 悬赏板存档子状态（本模块拥有形状 + createDefault/normalize，S7SaveService 组合，v21）。
 *  注：旧"noGoldDays 暗保底计数"随明保底日程表退役（字段仍规范化收纳=脏档兼容·恒 0）。 */
export interface S7BountyState {
  /** 板上现有卡（未做的积压 + 今日新刷；上限随居住舱）。 */
  cards: S7BountyCard[];
  /** 上次生成日 s7DayKey；<=0 = 从未生成过。 */
  lastGenDayKey: number;
  /** （已退役·恒 0）旧暗保底连续无金计数——明保底日程表下不再使用。 */
  noGoldDays: number;
  /** 已获金卡实物次数（轮换索引·Ron 拍板：按获得次数轮转、确定性；避免同日多金给同实物）。 */
  goldPhysicalCount: number;
  /** 已获遇袭小包次数（轮换索引·同金卡实物同口径：按获得次数轮转）。 */
  ambushBonusCount: number;
}

export function createDefaultS7Bounty(): S7BountyState {
  return { cards: [], lastGenDayKey: 0, noGoldDays: 0, goldPhysicalCount: 0, ambushBonusCount: 0 };
}

// ===== 规范化（防脏档）=====

function normalizeCard(raw: unknown): S7BountyCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const id = typeof s.id === 'string' && s.id.length > 0 ? s.id : null;
  const theme = s.theme === 'escort' || s.theme === 'drill' ? (s.theme as S7BountyTheme) : null;
  const quality = s.quality === 'bronze' || s.quality === 'silver' || s.quality === 'gold' ? (s.quality as S7BountyQuality) : null;
  if (id === null || theme === null || quality === null) return null;
  const genDayKey = typeof s.genDayKey === 'number' && Number.isInteger(s.genDayKey) && s.genDayKey >= 0 ? s.genDayKey : 0;
  const affixIds = Array.isArray(s.affixIds)
    ? s.affixIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  return { id, genDayKey, theme, quality, affixIds };
}

/** 规范化：非法卡剔除、字段回默认、板容量硬钳到 Lv10 上限（20）兜底防脏档超容。 */
export function normalizeExistingBounty(raw: unknown): S7BountyState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cards = Array.isArray(s.cards)
    ? s.cards.map(normalizeCard).filter((c): c is S7BountyCard => c !== null)
    : [];
  const hardCap = bountyBoardCap(10); // 20：normalize 不知居住舱等级，用最高档兜底防脏档，真实上限在 refresh 时按等级钳。
  if (cards.length > hardCap) cards.splice(0, cards.length - hardCap);
  const last = typeof s.lastGenDayKey === 'number' && Number.isInteger(s.lastGenDayKey) && s.lastGenDayKey > 0 ? s.lastGenDayKey : 0;
  const noGold = typeof s.noGoldDays === 'number' && Number.isInteger(s.noGoldDays) && s.noGoldDays > 0 ? s.noGoldDays : 0;
  const goldCnt = typeof s.goldPhysicalCount === 'number' && Number.isInteger(s.goldPhysicalCount) && s.goldPhysicalCount > 0 ? s.goldPhysicalCount : 0;
  const ambCnt = typeof s.ambushBonusCount === 'number' && Number.isInteger(s.ambushBonusCount) && s.ambushBonusCount > 0 ? s.ambushBonusCount : 0;
  return { cards, lastGenDayKey: last, noGoldDays: noGold, goldPhysicalCount: goldCnt, ambushBonusCount: ambCnt };
}

/**
 * 存档规范化入口（S7SaveService 调用）：优先读 bounty 字段；无 bounty 但有旧 commissions 字段（v20 老档）→
 * 把积压次数折算成等量铜卡（v20→v21 迁移，一次性）。都没有 → 空板默认。
 */
export function normalizeS7Bounty(rawBounty: unknown, rawLegacyCommissions?: unknown): S7BountyState {
  if (rawBounty && typeof rawBounty === 'object') return normalizeExistingBounty(rawBounty);
  if (rawLegacyCommissions && typeof rawLegacyCommissions === 'object') {
    const c = rawLegacyCommissions as Record<string, unknown>;
    const es = legacyStock(c.escort);
    const ds = legacyStock(c.drill);
    if (es + ds > 0) return seedBountyFromLegacyCommissions(es, ds);
  }
  return createDefaultS7Bounty();
}

function legacyStock(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const v = (raw as Record<string, unknown>).stock;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0;
}

/**
 * 老档积压折算（v20→v21）：旧护航/演习未做次数之和 → 等量铜卡（封顶 LEGACY_MIGRATION_CAP）。
 * 折算卡无词缀（纯产出·占位·避免迁移依赖配置），theme 按序交替；genDayKey=0（最旧·超容量先掉）。
 */
export function seedBountyFromLegacyCommissions(escortStock: number, drillStock: number): S7BountyState {
  const total = Math.max(0, Math.floor(escortStock) + Math.floor(drillStock));
  const n = Math.min(total, LEGACY_MIGRATION_CAP);
  const cards: S7BountyCard[] = [];
  for (let i = 0; i < n; i += 1) {
    cards.push({ id: `legacy_${i}`, genDayKey: 0, theme: i % 2 === 0 ? 'escort' : 'drill', quality: 'bronze', affixIds: [] });
  }
  return { cards, lastGenDayKey: 0, noGoldDays: 0, goldPhysicalCount: 0, ambushBonusCount: 0 };
}

// ===== 确定性日刷（明保底日程表·总修订案）=====

/** 从词缀池里确定性抽 count 个不重复 id（池不足则取全部）。 */
function drawDistinctAffixes(pool: readonly string[], count: number, rng: S7AutoBattleRng): string[] {
  const arr = pool.slice();
  const out: string[] = [];
  for (let i = 0; i < count && arr.length > 0; i += 1) {
    const j = rng.nextInt(arr.length);
    out.push(arr[j]);
    arr.splice(j, 1);
  }
  return out;
}

function buildCard(
  dayKey: number, slot: number, theme: S7BountyTheme, quality: S7BountyQuality,
  affixPool: readonly string[], rng: S7AutoBattleRng,
): S7BountyCard {
  const affixIds = drawDistinctAffixes(affixPool, AFFIX_COUNT[quality], rng);
  return { id: `${dayKey}_${slot}`, genDayKey: dayKey, theme, quality, affixIds };
}

/** 明保底：该发卡日是否为金卡日（每 3 天必出 1 金=dayKey 模 3 的确定性日程·玩家可预期）。 */
export function isGoldDay(dayKey: number): boolean {
  return ((dayKey % GOLD_EVERY_DAYS) + GOLD_EVERY_DAYS) % GOLD_EVERY_DAYS === 0;
}

/**
 * 生成某一天的 3 张全护航卡（确定性：seed=bounty_<dayKey>·明保底日程表）：
 * 金卡日=金1+银1+铜1；普通日=银1+铜2（"每天必含 ≥1 银、每 3 天必出 1 金"→ 单张期望 金1/9·银1/3·铜5/9）。
 * 品质在 3 个槽位间确定性洗位（同日重进不换卡）。
 */
export function generateDayCards(
  dayKey: number, affixPool: readonly string[],
): { cards: S7BountyCard[] } {
  const rng = new S7AutoBattleRng(`bounty_${dayKey}`);
  const qualities: S7BountyQuality[] = isGoldDay(dayKey)
    ? ['gold', 'silver', 'bronze']
    : ['silver', 'bronze', 'bronze'];
  // 洗位（Fisher-Yates·确定性）：品质构成是日程表、槽位顺序留随机观感。
  for (let i = qualities.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const t = qualities[i]; qualities[i] = qualities[j]; qualities[j] = t;
  }
  const cards: S7BountyCard[] = [];
  for (let slot = 0; slot < DAILY_CARDS; slot += 1) {
    cards.push(buildCard(dayKey, slot, 'escort', qualities[slot], affixPool, rng));
  }
  return { cards };
}

/**
 * 日刷入口（懒结算）：s7DayKey 变化时刷出今日 3 张加入板、按居住舱容量封顶（超则掉最旧）；同日重进不重刷。
 * 未做的卡留板（积压=6/9/12·细案③）；不做跨缺勤天数补刷（停玩天不发卡=发卡"每登录日"口径·§10㉙）。
 * 返回是否新刷了一批。
 */
export function refreshBountyBoard(
  state: S7BountyState, habitatLevel: number, now: number, affixPool: readonly string[],
): boolean {
  const dayKey = s7DayKey(now);
  if (state.lastGenDayKey === dayKey) return false; // 今日已刷
  const { cards } = generateDayCards(dayKey, affixPool);
  for (const c of cards) state.cards.push(c);
  const cap = bountyBoardCap(habitatLevel);
  if (state.cards.length > cap) state.cards.splice(0, state.cards.length - cap); // 超容量掉最旧
  state.noGoldDays = 0; // 明保底日程表下退役字段·恒 0
  state.lastGenDayKey = dayKey;
  return true;
}

// ===== 卡查询 / 完成 =====

export function findBountyCard(state: S7BountyState, cardId: string): S7BountyCard | null {
  return state.cards.find((c) => c.id === cardId) ?? null;
}

/** 完成一张卡（战斗胜利结算后调用）：从板上移除并返回该卡；找不到返回 null（不改状态）。 */
export function completeBountyCard(state: S7BountyState, cardId: string): S7BountyCard | null {
  const i = state.cards.findIndex((c) => c.id === cardId);
  if (i < 0) return null;
  return state.cards.splice(i, 1)[0];
}

// ===== 产出（轮换按"获得次数"·确定性·Ron 拍板）=====

/** 轮换索引 → 数组下标（负数/越界安全）。 */
function rotIndex(count: number, len: number): number {
  if (len <= 0) return 0;
  const c = Number.isFinite(count) ? Math.floor(count) : 0;
  return ((c % len) + len) % len;
}

/** 第 N 次（0 起）获得的金卡实物（普通信标→通用碎片→打捞加速券 三件循环）。 */
export function goldPhysicalItem(goldPhysicalCount: number): string {
  return GOLD_PHYSICAL_ROTATION[rotIndex(goldPhysicalCount, GOLD_PHYSICAL_ROTATION.length)];
}

/** 第 N 次（0 起）获得的遇袭小包实物（通用碎片→加速券 两件循环）。 */
export function ambushBonusItem(ambushBonusCount: number): string {
  return AMBUSH_BONUS_ROTATION[rotIndex(ambushBonusCount, AMBUSH_BONUS_ROTATION.length)];
}

/**
 * 一张卡的产出（纯函数）：基础(按 theme) × 星域系数^0.6 × 品质倍率 × 难度倍率；护航完美 ×1.25；全部向下取整。
 * 难度缺省 normal（=×1.0·难度选择 UI 归灰盒批·数值面先备）。
 * 金卡附赠实物按 goldPhysicalIndex 轮换（=当前已获金卡实物次数；非金卡忽略该参数）。实物并进货币表。
 */
export function bountyCardRewards(
  card: S7BountyCard, tier: number, perfect: boolean, goldPhysicalIndex = 0,
  difficulty: S7BountyDifficulty = 'normal',
): Record<string, number> {
  const coef = Math.pow(starfieldCoefficient(tier), BOUNTY_COEF_POW);
  const qMult = QUALITY_MULT[card.quality];
  const dMult = BOUNTY_DIFFICULTY_MULTS[difficulty] ?? 1;
  const perfectMult = card.theme === 'escort' && perfect ? PERFECT_BONUS_MULT : 1;
  const base = BOUNTY_BASE_REWARDS[card.theme];
  const out: Record<string, number> = {};
  for (const key of Object.keys(base)) {
    const amt = Math.floor(base[key] * coef * qMult * dMult * perfectMult);
    if (amt > 0) out[key] = amt;
  }
  if (card.quality === 'gold') {
    const item = goldPhysicalItem(goldPhysicalIndex);
    out[item] = (out[item] ?? 0) + GOLD_PHYSICAL_AMOUNT;
  }
  return out;
}

/**
 * 结算一张卡（战斗胜利后调用·有状态）：算产出(金卡实物按当前 goldPhysicalCount 轮换) → 金卡则计数+1 →
 * 从板上移除该卡。返回 {卡, 产出}；找不到返回 null（不改状态）。这是"获得次数轮转"的确定性推进入口。
 */
export function settleBountyCard(
  state: S7BountyState, cardId: string, tier: number, perfect: boolean,
  difficulty: S7BountyDifficulty = 'normal',
): { card: S7BountyCard; rewards: Record<string, number> } | null {
  const card = findBountyCard(state, cardId);
  if (!card) return null;
  const rewards = bountyCardRewards(card, tier, perfect, state.goldPhysicalCount, difficulty);
  if (card.quality === 'gold') state.goldPhysicalCount += 1;
  completeBountyCard(state, cardId);
  return { card, rewards };
}

/** 护航遇袭是否触发（护航专属·按卡确定性 seed=ambush_<id>·占位 15%）。演习/非护航恒 false。 */
export function bountyAmbushTriggered(card: S7BountyCard): boolean {
  if (card.theme !== 'escort') return false;
  return new S7AutoBattleRng(`ambush_${card.id}`).next() < AMBUSH_RATE;
}

/** 遇袭迎战失败折损比例（Ron 2026-07-04 风险抉择修订·占位 30% 挂数值细表）。 */
export const AMBUSH_LOSS_PENALTY_RATE = 0.3;

/**
 * 遇袭迎战失败的折损表（纯函数）：逐键 floor(本单入账 × 比例)。**只作用于本单护航刚结算的入账**——
 * 调用方拿它从钱包回收刚发的那部分，数学上恒 ≤ 本单入账、绝不触碰玩家既有存量；
 * 量少的实物（金卡信标×1 等）floor 后为 0 → 不进折损表（天然免扣）。
 */
export function ambushLossPenalty(settledRewards: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(settledRewards)) {
    const cut = Math.floor(settledRewards[key] * AMBUSH_LOSS_PENALTY_RATE);
    if (cut > 0) out[key] = cut;
  }
  return out;
}

/** 遇袭小包产出（纯函数）：按 ambushBonusIndex 轮换（通用碎片/加速券·占位量）。 */
export function bountyAmbushBonus(ambushBonusIndex: number): Record<string, number> {
  return { [ambushBonusItem(ambushBonusIndex)]: AMBUSH_BONUS_AMOUNT };
}

/** 领取遇袭小包（遇袭遭遇战打赢后调用·有状态）：按当前 ambushBonusCount 轮换 → 计数+1。 */
export function claimBountyAmbushBonus(state: S7BountyState): Record<string, number> {
  const rewards = bountyAmbushBonus(state.ambushBonusCount);
  state.ambushBonusCount += 1;
  return rewards;
}

/** 确定性运行种子：卡 id + 日界（同一张卡重跑同结果；不同卡不同种子）。 */
export function bountyRunSeed(card: S7BountyCard, now: number): string {
  return `bounty_run_${card.id}_${s7DayKey(now)}`;
}

// ===== 悬赏敌阵 / 护航运输船 =====

/**
 * 悬赏敌阵节点（定价重锚批·拍板5 锚点法）：难度 → 经济尺 recNodes 固定锚点敌阵（挂压力表·随重锚自动重校）。
 * 旧→新→为什么对：旧灰盒"已通关最高星域首个战斗节点"拿旧内容当基底、滞后当期战力 1-2 星域——
 * 悬赏时间线实测全档 D2 即碾噩梦×2.2（100%/6.5s）=倍率换奖励的对价故事不成立（§16e 发现3）；
 * 新=四档各锚一个固定压力点（与经济尺 pickCommissionDifficulty 同一组锚），难度真实存在、倍率=对价。
 * 难度选择弹窗归工程灰盒批；弹窗落地前由 bountyAutoDifficulty 缺省选档。
 */
export function bountyBattleNodeId(difficulty: S7BountyDifficulty = 'normal'): string {
  return BOUNTY_DIFFICULTY_ANCHOR_NODES[difficulty] ?? BOUNTY_DIFFICULTY_ANCHOR_NODES.normal;
}

/**
 * 过渡期自动选档（难度弹窗归灰盒批·落地前的缺省策略）：取"已通关锚点节点"的最高档——主线打穿过
 * 该压力点=证明碾得动（经济尺 crushRatio 稳档的通关代理）；一个没通=新手档。弹窗上线后由玩家选择取代。
 */
export function bountyAutoDifficulty(clearedNodeIds: readonly string[]): S7BountyDifficulty {
  const cleared = new Set(clearedNodeIds);
  let out: S7BountyDifficulty = 'novice';
  for (const d of S7_BOUNTY_DIFFICULTIES) {
    if (cleared.has(BOUNTY_DIFFICULTY_ANCHOR_NODES[d])) out = d;
  }
  return out;
}

/** 护航专用：旗舰开场召唤运输船的触发积木（附到首个上阵单位 extraBlocks）。 */
export function escortTransportBlocks(): S7EffectBlock[] {
  return [{ kind: 'trigger', on: 'battle_start', effectRef: ESCORT_TRANSPORT_SUMMON_EFFECT, source: 'bounty_escort' }];
}

/** 完美护航判定：战斗结果中运输船存活且满血（找不到运输船=召唤未发生 → 非完美，防御性 false）。 */
export function isPerfectEscort(result: S7AutoBattleResult): boolean {
  const t = result.finalState.players.find((u) => u.unitStatRef === ESCORT_TRANSPORT_STAT_REF);
  return !!t && t.alive && t.hp >= t.maxHp;
}
