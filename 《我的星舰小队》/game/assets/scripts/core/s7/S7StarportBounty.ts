// 星港悬赏板（第2.5块·块2，纯 TS，不依赖 cc）：GDD-v2.0 S10.8。整体取代旧「每日委托」玩法。
// 定位：每天凌晨 4 点（s7DayKey）刷出 4 张悬赏卡的日常辅助战斗档；所有场次真打（看戏找策略、不秒结算/不速刷）。
//
// 口径（GDD S10.8）：
// - 生成：每天 s7DayKey 变化时刷出 4 张卡，按日界种子确定性生成（seed=bounty_<dayKey>，杀进程重进不换卡，
//   同打捞预掷先例）；卡=主题(护航/演习) + 品质(铜/银/金) + 词缀(条数随品质 铜1/银2/金3)。
// - 品质：金卡稀罕型（单张 GOLD_RATE 占位 8%）+ 暗保底（连续 PITY_DAYS 天无金必出一张·玩家无感知）。
// - 积压：未做的卡留板，上限 BOARD_CAP_BASE=12（居住舱 Lv5→16 / Lv10→20，沿用既有钩子）；每登录日 +4，
//   超上限掉最旧。老档积压次数折算成等量铜卡（存档 v20→v21，见 normalizeS7Bounty）。
// - 产出：护航=合金(+少量星贝)、演习=驾驶记录；品质倍率 铜1/银1.6/金3；金卡附赠实物(信标/通用碎片/加速券轮换)；
//   星矿不入（守 S9 星矿四来源）。护航运输船满血=完美护航 ×1.25（彩蛋，复用召唤积木）。
// - 遇袭（护航专属·小概率 AMBUSH_RATE 占位 15%·按卡确定性）：追加一场星盗遭遇战，赢=额外小包、输=不罚照常结算。
// - 出战=进主线同款备战选 5 舰（默认上次阵容）；被词缀影响的单位在备战挂标记（见 S7CommissionAffix）。
// - 词缀=本场对我方指定定位型的 buff+debuff（S7CommissionAffix 应用·配置表 commission_affix_param 驱动）。
// - 数值全 v0.1 占位（产率/倍率/概率/保底/实物），阶段三数值校准统一精校。

import { S7MainlineModel } from './S7MainlineProgress';
import { starfieldCoefficient } from './S7OfflineProduction';
import { s7DayKey } from './S7AdDailyCounter';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7AutoBattleResult } from './S7AutoBattleTypes';
import { S7AutoBattleRng } from './S7AutoBattleRng';

export type S7BountyTheme = 'escort' | 'drill';
export type S7BountyQuality = 'bronze' | 'silver' | 'gold';
export const S7_BOUNTY_THEMES: readonly S7BountyTheme[] = Object.freeze(['escort', 'drill']);
export const S7_BOUNTY_QUALITIES: readonly S7BountyQuality[] = Object.freeze(['bronze', 'silver', 'gold']);

// ===== 占位数值（阶段三统一校准；改这里不改逻辑）=====
/** 每天刷出的卡数（GDD S10.8：4 张）。 */
export const DAILY_CARDS = 4;
/** 单张金卡概率（占位 8%·期望两三天一张）。 */
export const GOLD_RATE = 0.08;
/** 单张银卡概率（占位 32%；铜=1-金-银）。 */
export const SILVER_RATE = 0.32;
/** 暗保底：连续 PITY_DAYS 次刷新无金 → 下一次强制出一张金（玩家无感知）。 */
export const PITY_DAYS = 4;
/** 品质定词缀条数（铜1/银2/金3）。 */
export const AFFIX_COUNT: Readonly<Record<S7BountyQuality, number>> = Object.freeze({ bronze: 1, silver: 2, gold: 3 });
/** 品质产出倍率（铜1/银1.6/金3）。 */
export const QUALITY_MULT: Readonly<Record<S7BountyQuality, number>> = Object.freeze({ bronze: 1, silver: 1.6, gold: 3 });
/** 完美护航加成倍率（运输船满血·占位 +25%）。 */
export const PERFECT_BONUS_MULT = 1.25;
/** 护航遇袭触发概率（占位 15%·按卡确定性）。 */
export const AMBUSH_RATE = 0.15;
/** 悬赏板容量：基础 12，居住舱 Lv5→16 / Lv10→20。 */
export const BOARD_CAP_BASE = 12;
/** 老档折算铜卡上限（迁移用·取基础容量）。 */
export const LEGACY_MIGRATION_CAP = BOARD_CAP_BASE;

/** 基础产出/张（护航=合金+少量星贝、演习=驾驶记录；占位·×星域系数×品质倍率后向下取整）。 */
export const BOUNTY_BASE_REWARDS: Readonly<Record<S7BountyTheme, Readonly<Record<string, number>>>> = Object.freeze({
  escort: Object.freeze({ hullAlloy: 80, starCargo: 10 }),
  drill: Object.freeze({ pilotToken: 60 }),
});
/** 金卡附赠实物轮换（普通信标 / 通用星舰碎片 / 打捞加速券〔现钱包无专用券·占位 supplyTicket〕），按 genDayKey 日轮换。 */
export const GOLD_PHYSICAL_ROTATION: readonly string[] = Object.freeze(['beaconCommon', 'shipBlueprint', 'supplyTicket']);
export const GOLD_PHYSICAL_AMOUNT = 1;
/** 遇袭额外小包轮换（通用碎片 / 加速券），按 genDayKey 日轮换。 */
export const AMBUSH_BONUS_ROTATION: readonly string[] = Object.freeze(['shipBlueprint', 'supplyTicket']);
export const AMBUSH_BONUS_AMOUNT = 2;

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

/** 悬赏板存档子状态（本模块拥有形状 + createDefault/normalize，S7SaveService 组合，v21）。 */
export interface S7BountyState {
  /** 板上现有卡（未做的积压 + 今日新刷；上限随居住舱）。 */
  cards: S7BountyCard[];
  /** 上次生成日 s7DayKey；<=0 = 从未生成过。 */
  lastGenDayKey: number;
  /** 连续无金刷新次数（暗保底计数·玩家无感知）。 */
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

// ===== 容量 =====

/** 悬赏板容量（基础 12，居住舱 Lv5→16 / Lv10→20；沿用既有居住舱钩子）。 */
export function bountyBoardCap(habitatLevel: number): number {
  const lv = Number.isFinite(habitatLevel) && habitatLevel > 0 ? Math.floor(habitatLevel) : 0;
  return lv >= 10 ? 20 : lv >= 5 ? 16 : BOARD_CAP_BASE;
}

// ===== 确定性日刷 =====

function rollQuality(rng: S7AutoBattleRng): S7BountyQuality {
  const r = rng.next();
  if (r < GOLD_RATE) return 'gold';
  if (r < GOLD_RATE + SILVER_RATE) return 'silver';
  return 'bronze';
}

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

/**
 * 生成某一天的 4 张卡（确定性：seed=bounty_<dayKey>）+ 更新暗保底计数。
 * 暗保底：进入这次刷新前已连续 noGoldDays 次无金，若本次仍无金且已达阈值 → 确定性挑一张升金。
 * 返回本次 4 张卡 + 刷新后的连续无金次数（有金→0，无金→+1）。
 */
export function generateDayCards(
  dayKey: number, noGoldDays: number, affixPool: readonly string[],
): { cards: S7BountyCard[]; noGoldDays: number } {
  const rng = new S7AutoBattleRng(`bounty_${dayKey}`);
  const cards: S7BountyCard[] = [];
  for (let slot = 0; slot < DAILY_CARDS; slot += 1) {
    const theme: S7BountyTheme = rng.next() < 0.5 ? 'escort' : 'drill';
    cards.push(buildCard(dayKey, slot, theme, rollQuality(rng), affixPool, rng));
  }
  let hasGold = cards.some((c) => c.quality === 'gold');
  if (!hasGold && noGoldDays >= PITY_DAYS - 1) {
    const idx = rng.nextInt(DAILY_CARDS);
    cards[idx] = buildCard(dayKey, idx, cards[idx].theme, 'gold', affixPool, rng); // 升金·重抽 3 词缀
    hasGold = true;
  }
  return { cards, noGoldDays: hasGold ? 0 : noGoldDays + 1 };
}

/**
 * 日刷入口（懒结算）：s7DayKey 变化时刷出今日 4 张加入板、按居住舱容量封顶（超则掉最旧）；同日重进不重刷。
 * 未做的卡留板（积压）；不做跨缺勤天数补刷（积压=你自己没做完的卡，不是缺勤天数囤卡）。返回是否新刷了一批。
 */
export function refreshBountyBoard(
  state: S7BountyState, habitatLevel: number, now: number, affixPool: readonly string[],
): boolean {
  const dayKey = s7DayKey(now);
  if (state.lastGenDayKey === dayKey) return false; // 今日已刷
  const prevNoGold = state.lastGenDayKey <= 0 ? 0 : state.noGoldDays;
  const { cards, noGoldDays } = generateDayCards(dayKey, prevNoGold, affixPool);
  for (const c of cards) state.cards.push(c);
  const cap = bountyBoardCap(habitatLevel);
  if (state.cards.length > cap) state.cards.splice(0, state.cards.length - cap); // 超容量掉最旧
  state.noGoldDays = noGoldDays;
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
 * 一张卡的产出（纯函数）：基础(按 theme) × 星域系数(tier) × 品质倍率；护航完美 ×1.25；全部向下取整。
 * 金卡附赠实物按 goldPhysicalIndex 轮换（=当前已获金卡实物次数；非金卡忽略该参数）。实物并进货币表。
 */
export function bountyCardRewards(card: S7BountyCard, tier: number, perfect: boolean, goldPhysicalIndex = 0): Record<string, number> {
  const coef = starfieldCoefficient(tier);
  const qMult = QUALITY_MULT[card.quality];
  const perfectMult = card.theme === 'escort' && perfect ? PERFECT_BONUS_MULT : 1;
  const base = BOUNTY_BASE_REWARDS[card.theme];
  const out: Record<string, number> = {};
  for (const key of Object.keys(base)) {
    const amt = Math.floor(base[key] * coef * qMult * perfectMult);
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
): { card: S7BountyCard; rewards: Record<string, number> } | null {
  const card = findBountyCard(state, cardId);
  if (!card) return null;
  const rewards = bountyCardRewards(card, tier, perfect, state.goldPhysicalCount);
  if (card.quality === 'gold') state.goldPhysicalCount += 1;
  completeBountyCard(state, cardId);
  return { card, rewards };
}

/** 护航遇袭是否触发（护航专属·按卡确定性 seed=ambush_<id>·占位 15%）。演习/非护航恒 false。 */
export function bountyAmbushTriggered(card: S7BountyCard): boolean {
  if (card.theme !== 'escort') return false;
  return new S7AutoBattleRng(`ambush_${card.id}`).next() < AMBUSH_RATE;
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

// ===== 灰盒敌阵 / 护航运输船（沿用块2 口径）=====

const BATTLE_NODE_TAGS = new Set(['tutorial_battle', 'normal', 'elite', 'boss']);

/**
 * 悬赏敌阵节点（灰盒）：已通关最高星域的首个战斗节点（旧内容·随星域自动升档）；档 0 → 全线路首个战斗节点（n001）。
 * 找不到（理论不可能）返回 null，调用方兜底提示。真实悬赏敌阵/涂装/靶机变体留数值校准+演出阶段。
 */
export function bountyBattleNodeId(model: S7MainlineModel, clearedNodeIds: string[]): string | null {
  const tier = model.clearedStarfieldTier(clearedNodeIds);
  const wantSf = tier > 0 ? `sf${String(tier).padStart(2, '0')}` : null;
  for (const nodeId of model.defaultRoute) {
    const view = model.nodeView(nodeId);
    if (!view || !BATTLE_NODE_TAGS.has(view.nodeTypeTag)) continue;
    if (wantSf === null || view.starfieldId === wantSf) return nodeId;
  }
  return null;
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
