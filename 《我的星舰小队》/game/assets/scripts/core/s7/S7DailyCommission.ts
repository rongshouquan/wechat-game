// 每日委托（第2.5块·块2，纯 TS，不依赖 cc）：GDD-v2.0 S10.8「护航/演习·无脑速刷档」。
// 定位：每天的轻松战斗档，敌人强度压在玩家战力下一截（必赢）；产出=战斗养成资源（护航→合金+星贝、
//   演习→驾驶记录），星矿不入此渠道（守 S9 星矿四来源）。解锁：第 5 关强引导结束后（UI 层把关）。
//
// 口径：
// - 次数与积压（S10.8）：每类每日 2 次；错过自动积压，基础上限 3 天量（6 次），居住舱 Lv5→4 天（8）、
//   Lv10→5 天（10）。"日"用全游戏统一日界 s7DayKey（北京凌晨 4 点）。发放=懒结算：每次触达时按
//   跨过的天数补发（lastAccrualDayKey 哨兵 <=0 表示从未发放过——首次触达只发当日份，不追溯解锁前）。
// - 难度与奖励缩放（S10.8）：随已通关最高星域档自动升档（同离线产出规则 starfieldCoefficient）。
//   灰盒敌阵=已通关最高星域的"首个战斗节点"旧敌阵（旧内容必赢；真实委托敌阵/涂装变体留数值校准+演出阶段）。
// - 首打必看/秒结算（"新内容看戏、旧内容秒办"）：按星域档记 watchedTiers；某档首打必进真战斗，
//   同档之后可秒结算（确定性引擎直接出结果）；两类当前档都看过 → UI 开放"一键速刷今日份"。
// - 完美护航（Ron 2026-07-03 明确）：护航场上开场召唤"运输船"（复用召唤积木·battle_start 触发），
//   战斗结束运输船满血 → 小奖加成（彩蛋非失败条件）。演习无运输船。
// - 数值全 v0.1 占位（产率/完美加成），阶段三数值校准统一精校。

import { S7MainlineModel } from './S7MainlineProgress';
import { starfieldCoefficient } from './S7OfflineProduction';
import { s7DayKey } from './S7AdDailyCounter';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7AutoBattleResult } from './S7AutoBattleTypes';

export type S7CommissionType = 'escort' | 'drill';
export const S7_COMMISSION_TYPES: readonly S7CommissionType[] = Object.freeze(['escort', 'drill']);

/** 每类每日发放次数（S10.8：每类每日 2 次；v0.1 可校准）。 */
export const COMMISSION_DAILY_COUNT = 2;
/** 基础积压天数（S10.8：3 天量；居住舱 Lv5→4 / Lv10→5）。 */
export const COMMISSION_BASE_BACKLOG_DAYS = 3;

/** 运输船 battle_unit_stat_param.rowId（护航专用 prop 单位·不攻击可被打）。 */
export const COMMISSION_TRANSPORT_STAT_REF = 'bu_commission_transport';
/** 开场召唤运输船的 battle_effect_param.rowId。 */
export const COMMISSION_TRANSPORT_SUMMON_EFFECT = 'eff_commission_transport_summon';

/** 单类委托状态：可打次数（含积压）+ 上次发放日 + 已看过战斗的星域档。 */
export interface S7CommissionTypeState {
  stock: number;
  /** 上次发放的 s7DayKey；<=0 = 从未发放（首次触达只发当日份，不追溯）。 */
  lastAccrualDayKey: number;
  /** 已看过真战斗的星域档（首打必看 → 之后该档可秒结算）。 */
  watchedTiers: number[];
}

/** 委托存档子状态：本模块拥有形状 + createDefault/normalize，S7SaveService 组合（v20）。 */
export interface S7CommissionState {
  escort: S7CommissionTypeState;
  drill: S7CommissionTypeState;
}

function defaultTypeState(): S7CommissionTypeState {
  return { stock: 0, lastAccrualDayKey: 0, watchedTiers: [] };
}

export function createDefaultS7Commissions(): S7CommissionState {
  return { escort: defaultTypeState(), drill: defaultTypeState() };
}

function normalizeTypeState(raw: unknown): S7CommissionTypeState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const stock = typeof src.stock === 'number' && Number.isInteger(src.stock) && src.stock > 0 ? src.stock : 0;
  const last = typeof src.lastAccrualDayKey === 'number' && Number.isInteger(src.lastAccrualDayKey) && src.lastAccrualDayKey > 0
    ? src.lastAccrualDayKey : 0;
  const tiers = Array.isArray(src.watchedTiers)
    ? Array.from(new Set(src.watchedTiers.filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 0))).sort((a, b) => a - b)
    : [];
  return { stock, lastAccrualDayKey: last, watchedTiers: tiers };
}

/** 规范化（防脏档）：非法字段退默认；watchedTiers 去重排序只收非负整数。 */
export function normalizeS7Commissions(raw: unknown): S7CommissionState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { escort: normalizeTypeState(src.escort), drill: normalizeTypeState(src.drill) };
}

/** 积压天数上限（S10.8：基础 3，居住舱 Lv5→4 / Lv10→5）。 */
export function commissionBacklogDays(habitatLevel: number): number {
  const lv = Number.isFinite(habitatLevel) && habitatLevel > 0 ? Math.floor(habitatLevel) : 0;
  return COMMISSION_BASE_BACKLOG_DAYS + (lv >= 10 ? 2 : lv >= 5 ? 1 : 0);
}

/** 单类库存封顶 = 每日份 × 积压天数（3/4/5 天 → 6/8/10 次）。 */
export function commissionStockCap(habitatLevel: number): number {
  return COMMISSION_DAILY_COUNT * commissionBacklogDays(habitatLevel);
}

/**
 * 懒结算发放（两类一起）：跨过 N 天补发 N×每日份、封顶积压上限；同日重复触达不重复发。
 * 首次触达（哨兵 <=0）只发当日份——委托解锁前的日子不追溯。返回本次实际补发总次数（UI 提示用）。
 */
export function accrueCommissions(state: S7CommissionState, habitatLevel: number, now: number): number {
  const dk = s7DayKey(now);
  const cap = commissionStockCap(habitatLevel);
  let added = 0;
  for (const type of S7_COMMISSION_TYPES) {
    const s = state[type];
    if (s.lastAccrualDayKey <= 0) {
      const next = Math.max(s.stock, Math.min(cap, COMMISSION_DAILY_COUNT)); // 首次触达：补到当日份（正常首次 stock=0 → 2）
      added += next - s.stock;
      s.stock = next;
      s.lastAccrualDayKey = dk;
      continue;
    }
    if (dk > s.lastAccrualDayKey) {
      const days = dk - s.lastAccrualDayKey;
      const next = Math.min(cap, s.stock + days * COMMISSION_DAILY_COUNT);
      added += next - s.stock;
      s.stock = next;
      s.lastAccrualDayKey = dk;
    }
  }
  return added;
}

/** 消耗一次（开打/秒结算前调用）：无库存返回 false 且不改状态。 */
export function consumeCommission(state: S7CommissionState, type: S7CommissionType): boolean {
  const s = state[type];
  if (s.stock <= 0) return false;
  s.stock -= 1;
  return true;
}

export function isTierWatched(state: S7CommissionState, type: S7CommissionType, tier: number): boolean {
  return state[type].watchedTiers.includes(tier);
}

/** 记录"该档已看过真战斗"（幂等）。 */
export function markTierWatched(state: S7CommissionState, type: S7CommissionType, tier: number): void {
  const s = state[type];
  if (!s.watchedTiers.includes(tier)) {
    s.watchedTiers.push(tier);
    s.watchedTiers.sort((a, b) => a - b);
  }
}

const BATTLE_NODE_TAGS = new Set(['tutorial_battle', 'normal', 'elite', 'boss']);

/**
 * 委托敌阵节点（灰盒）：已通关最高星域的首个战斗节点（旧内容必赢）；档 0（未通关任何星域）→ 全线路
 * 首个战斗节点（n001）。找不到（理论不可能）返回 null，调用方兜底提示。
 */
export function commissionBattleNodeId(model: S7MainlineModel, clearedNodeIds: string[]): string | null {
  const tier = model.clearedStarfieldTier(clearedNodeIds);
  const wantSf = tier > 0 ? `sf${String(tier).padStart(2, '0')}` : null;
  for (const nodeId of model.defaultRoute) {
    const view = model.nodeView(nodeId);
    if (!view || !BATTLE_NODE_TAGS.has(view.nodeTypeTag)) continue;
    if (wantSf === null || view.starfieldId === wantSf) return nodeId;
  }
  return null;
}

/** 基础产出/次（v0.1 占位·×星域系数后向下取整；护航→合金+星贝、演习→驾驶记录，S10.8）。 */
export const COMMISSION_BASE_REWARDS: Readonly<Record<S7CommissionType, Readonly<Record<string, number>>>> = Object.freeze({
  escort: Object.freeze({ hullAlloy: 80, starCargo: 10 }),
  drill: Object.freeze({ pilotToken: 60 }),
});
/** 完美护航加成倍率（v0.1 占位：+25%）。 */
export const COMMISSION_PERFECT_BONUS_MULT = 1.25;

/** 单次委托产出：基础 × starfieldCoefficient(档)；护航完美 ×1.25；全部向下取整。 */
export function commissionRewards(type: S7CommissionType, tier: number, perfect: boolean): Record<string, number> {
  const coef = starfieldCoefficient(tier);
  const mult = type === 'escort' && perfect ? COMMISSION_PERFECT_BONUS_MULT : 1;
  const out: Record<string, number> = {};
  const base = COMMISSION_BASE_REWARDS[type];
  for (const key of Object.keys(base)) {
    const amt = Math.floor(base[key] * coef * mult);
    if (amt > 0) out[key] = amt;
  }
  return out;
}

/** 确定性运行种子：类型+日界+当日剩余库存（同一次委托重跑同结果；不同场不同种子）。 */
export function commissionRunSeed(type: S7CommissionType, now: number, stockBefore: number): string {
  return `commission_${type}_${s7DayKey(now)}_${stockBefore}`;
}

/** 护航专用：旗舰开场召唤运输船的触发积木（附到首个上阵单位 extraBlocks）。 */
export function escortTransportBlocks(): S7EffectBlock[] {
  return [{ kind: 'trigger', on: 'battle_start', effectRef: COMMISSION_TRANSPORT_SUMMON_EFFECT, source: 'commission_escort' }];
}

/** 完美护航判定：战斗结果中运输船存活且满血（找不到运输船=召唤未发生 → 非完美，防御性 false）。 */
export function isPerfectEscort(result: S7AutoBattleResult): boolean {
  const t = result.finalState.players.find((u) => u.unitStatRef === COMMISSION_TRANSPORT_STAT_REF);
  return !!t && t.alive && t.hp >= t.maxHp;
}
