// 信标打捞引擎（步5 收尾批回写·纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.2。
//
// 职责：选信标档 → 占打捞队位 → 选时长(2/8/24h) → 异步真实时钟等待 → 收菜结算（必得 + 双线概率发现）。
//   - 不碰信标钱包：信标是 S7ResourceState(存档层)货币，core 不 import save —— 调用方先确保并扣 1 张该档信标（与抽卡同风格）。
//   - 收菜产出为 reward manifest(S7SalvageReward[])，由应用侧入账(资源/碎片/插件/宝箱/人口)——本引擎不直接落多 store。
//   - 随机用注入的 S7AutoBattleRng(确定可测)；时间(now/ms)由调用方传入(不读系统时钟)；打捞队上限由打捞港等级算。
//   - 结算口径（v0.7 尺子同构·期望值精确对齐）：每类发现期望 = 掷骰数×单骰期望（全表 ≤1/趟），
//     采样=floor+小数概率补一件 → 单趟每类 0/1 件、期望与尺子逐类相等、"单次≤1"护栏天然满足；
//     惊喜线（插件/居民/工人/货舱）另乘稀有发现加成（+5%/级）+ Lv10 24h 额外一骰；24h 趟全产出 ×0.72 守恒刀。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7SalvageConfig, S7SalvageReward, S7BeaconTier, UNIVERSAL_SHARD_KEYS, salvageDurKeyOf,
} from './S7SalvageConfig';
import { S7SalvageState, S7SalvageMission } from './S7SalvageState';
import { salvageTeamCount, salvageSurpriseBonusPct, salvageExtraSurpriseRoll } from './S7BuildingEffects';

const HOUR_MS = 3_600_000;

/** 打捞队上限（= 打捞港等级·§10.2 打捞队 1→3）。 */
export function salvageTeamLimit(salvageLevel: number): number {
  return salvageTeamCount(salvageLevel);
}

/** 某任务剩余毫秒（已到点=0）。 */
export function salvageRemainingMs(mission: S7SalvageMission, now: number): number {
  return Math.max(0, mission.endTime - now);
}
/** 任务是否已完成（可收菜）。 */
export function isSalvageDone(mission: S7SalvageMission, now: number): boolean {
  return now >= mission.endTime;
}

// ===== 开打 =====

export type S7StartSalvageResult =
  | { ok: true; mission: S7SalvageMission }
  | { ok: false; reason: 'no_team_slot' | 'bad_tier' | 'bad_hours' };

/**
 * 开一趟打捞（调用方须已确保并扣掉 1 张该档信标）。占一个打捞队位。
 *  - 校验：档合法 / 时长合法(2/8/24) / 还有空打捞队位(进行中任务数 < 打捞队上限)。
 *  就地把任务加入 state。endTime = now + hours×3600000。
 */
export function startSalvage(
  state: S7SalvageState, config: S7SalvageConfig, tier: S7BeaconTier, hours: number, salvageLevel: number, now: number,
): S7StartSalvageResult {
  if (!config.tiers[tier]) return { ok: false, reason: 'bad_tier' };
  if (salvageDurKeyOf(hours) === null) return { ok: false, reason: 'bad_hours' };
  if (state.missions.length >= salvageTeamLimit(salvageLevel)) return { ok: false, reason: 'no_team_slot' };
  const mission: S7SalvageMission = { id: `sv${state.nextSeq}`, tier, hours, startTime: now, endTime: now + hours * HOUR_MS };
  state.nextSeq += 1;
  state.missions.push(mission);
  return { ok: true, mission };
}

// ===== 收菜结算 =====

/** 期望值抽签：期望 x（≥0）→ floor(x) 件 + 以小数概率补 1 件（期望精确 = x）。 */
function sampleExpected(x: number, rng: S7AutoBattleRng): number {
  if (!(x > 0)) return 0;
  const base = Math.floor(x);
  return base + (rng.next() < x - base ? 1 : 0);
}

/** 惊喜线发现 → 奖励条目（数量恒 1 件/条目·count 件即 count 条）。 */
function surpriseReward(key: string): S7SalvageReward {
  switch (key) {
    case 'finePlugin': return { kind: 'plugin', quality: 'fine' };
    case 'superiorPlugin': return { kind: 'plugin', quality: 'superior' };
    case 'legendaryPlugin': return { kind: 'plugin', quality: 'legendary' };
    case 'resident': return { kind: 'population', pop: 'resident', amount: 1 };
    case 'worker': return { kind: 'population', pop: 'worker', amount: 1 };
    default: return { kind: 'chest', chestId: 'starlightCargo', amount: 1 };
  }
}

/**
 * 掷出一趟打捞的全部奖励（必得 + 双线概率发现）。导出供单测直接验。确定性：同 rng 序列同结果。
 *  必得：星矿/星贝 ×时长档倍率×守恒刀；通用碎片（舰/员随机其一）同倍率；固定干货（期望值抽签×守恒刀）。
 *  经济线：掷骰数=rolls[档]×守恒刀 → 每类 期望值抽签；通碎按件随机舰/员。
 *  惊喜线：掷骰数另乘 稀有发现加成(+5%/级) + Lv10 24h 额外一骰 → 每类 期望值抽签（全表期望 <1 → 单次≤1 天然满足）。
 */
export function rollSalvageRewards(
  config: S7SalvageConfig, tier: S7BeaconTier, hours: number, rng: S7AutoBattleRng, salvageLevel = 0,
): S7SalvageReward[] {
  const def = config.tiers[tier];
  const dur = salvageDurKeyOf(hours) ?? 'h2';
  const ys = dur === config.yieldScaleDur ? config.yieldScale : 1;
  const mult = config.timeMult[dur] * ys;
  const out: S7SalvageReward[] = [];

  // 必得软货币 + 通用碎片（1 种随机其一）。
  out.push({ kind: 'resource', resourceId: 'starOre', amount: Math.round(def.ore * mult) });
  out.push({ kind: 'resource', resourceId: 'starCargo', amount: Math.round(def.cargo * mult) });
  const shardKey = rng.pick(UNIVERSAL_SHARD_KEYS) ?? 'shipBlueprint';
  out.push({ kind: 'resource', resourceId: shardKey, amount: Math.round(def.universal * mult) });
  // 固定干货（期望值·×守恒刀·抽签成整数件）。
  for (const key of Object.keys(def.fixed) as (keyof typeof def.fixed)[]) {
    const n = sampleExpected((def.fixed[key] ?? 0) * ys, rng);
    if (n > 0) out.push({ kind: 'resource', resourceId: key, amount: n });
  }

  // 经济线发现（掷骰数 ×守恒刀）。
  const econRolls = def.rolls[dur] * ys;
  for (const key of Object.keys(def.econEV) as (keyof typeof def.econEV)[]) {
    const n = sampleExpected(econRolls * (def.econEV[key] ?? 0), rng);
    if (n <= 0) continue;
    if (key === 'universal') {
      for (let i = 0; i < n; i += 1) {
        out.push({ kind: 'resource', resourceId: rng.pick(UNIVERSAL_SHARD_KEYS) ?? 'shipBlueprint', amount: 1 });
      }
    } else {
      out.push({ kind: 'resource', resourceId: key, amount: n });
    }
  }

  // 惊喜线发现（稀有发现加成 + Lv10 24h 额外一骰·同吃守恒刀=单位统一）。
  const surpriseMult = 1 + salvageSurpriseBonusPct(salvageLevel) / 100;
  const surpriseRolls = (def.rolls[dur] + (salvageExtraSurpriseRoll(salvageLevel, hours) ? 1 : 0)) * ys * surpriseMult;
  for (const key of Object.keys(def.surpriseEV) as (keyof typeof def.surpriseEV)[]) {
    const n = sampleExpected(surpriseRolls * (def.surpriseEV[key] ?? 0), rng);
    for (let i = 0; i < n; i += 1) out.push(surpriseReward(key));
  }

  return mergeResourceRewards(out);
}

/** 合并同 resourceId 的资源奖励求和；非资源条目原样保留(保持顺序：先资源后其它)。 */
function mergeResourceRewards(rewards: S7SalvageReward[]): S7SalvageReward[] {
  const resSum = new Map<string, number>();
  const others: S7SalvageReward[] = [];
  for (const r of rewards) {
    if (r.kind === 'resource') resSum.set(r.resourceId, (resSum.get(r.resourceId) ?? 0) + r.amount);
    else others.push(r);
  }
  const merged: S7SalvageReward[] = [];
  resSum.forEach((amount, resourceId) => merged.push({ kind: 'resource', resourceId, amount }));
  return merged.concat(others);
}

export type S7CollectSalvageResult =
  | { ok: true; rewards: S7SalvageReward[] }
  | { ok: false; reason: 'not_found' | 'not_done' };

/**
 * 收菜：任务已完成则掷奖、移除任务、返回 reward manifest（由应用侧入账）。未到点→not_done；不存在→not_found。
 * salvageLevel = 打捞港等级（惊喜线加成 + Lv10 额外骰）。
 */
export function collectSalvage(
  state: S7SalvageState, config: S7SalvageConfig, missionId: string, now: number, rng: S7AutoBattleRng, salvageLevel = 0,
): S7CollectSalvageResult {
  const idx = state.missions.findIndex((m) => m.id === missionId);
  if (idx < 0) return { ok: false, reason: 'not_found' };
  const mission = state.missions[idx];
  if (!isSalvageDone(mission, now)) return { ok: false, reason: 'not_done' };
  const rewards = rollSalvageRewards(config, mission.tier, mission.hours, rng, salvageLevel);
  state.missions.splice(idx, 1);
  return { ok: true, rewards };
}

// ===== 广告完成（块5 改行为：S13 #5 原"减2小时"作废 → 看广告=直接完成当前打捞）=====

export type S7SalvageAdCompleteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_done' };

/**
 * 看广告立即完成当前打捞（调用方在广告"看完"后调·Ron 2026-07-05 决策④）：
 * 不论品质、不论剩余时长，endTime 直接置为 now → 到点可收菜。
 *  - 任务不存在→not_found；已到点→already_done（按钮不该出现·防御）。
 * 每日次数不在此管——块5 起统一走 S7AdDailyCounter + S7AdPointPolicy（点位 salvage_speedup·每日 1 次），
 * 旧 state.adSpeedup 内部计数器已随之移除。
 */
export function salvageAdComplete(
  state: S7SalvageState, missionId: string, now: number,
): S7SalvageAdCompleteResult {
  const mission = state.missions.find((m) => m.id === missionId);
  if (!mission) return { ok: false, reason: 'not_found' };
  if (isSalvageDone(mission, now)) return { ok: false, reason: 'already_done' };
  mission.endTime = now;
  return { ok: true };
}
