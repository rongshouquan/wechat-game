// 信标打捞引擎（阶段一 D-step1，纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.2。
//
// 职责：选信标档 → 占打捞队位 → 选时长(2/8/24h) → 异步真实时钟等待 → 收菜结算（必得 + 概率发现分层）。
//   - 不碰信标钱包：信标是 S7ResourceState(存档层)货币，core 不 import save —— 调用方先确保并扣 1 张该档信标（与抽卡同风格）。
//   - 收菜产出为 reward manifest(S7SalvageReward[])，由应用侧入账(资源/碎片/完整星舰[已有则折碎片]/插件/宝箱/人口)——本引擎不直接落多 store。
//   - 随机用注入的 S7AutoBattleRng(确定可测)；时间(now/ms)由调用方传入(不读系统时钟)；打捞队上限由打捞港等级算。
//   - 经济护栏(§10.2)：完整星核不进打捞(配置里只有星核碎片)；完整星舰=C阶(应用侧重复折专属碎片)；居民/工人/货舱/传奇插件单次≤1。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7SalvageConfig, S7SalvageReward, S7BeaconTier, S7DiscoveryEntry, UNIVERSAL_SHARD_KEYS,
} from './S7SalvageConfig';
import { S7SalvageState, S7SalvageMission } from './S7SalvageState';
import { salvageTeamCount } from './S7BuildingEffects';

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
  if (!config.timeTiers.some((t) => t.hours === hours)) return { ok: false, reason: 'bad_hours' };
  if (state.missions.length >= salvageTeamLimit(salvageLevel)) return { ok: false, reason: 'no_team_slot' };
  const mission: S7SalvageMission = { id: `sv${state.nextSeq}`, tier, hours, startTime: now, endTime: now + hours * HOUR_MS };
  state.nextSeq += 1;
  state.missions.push(mission);
  return { ok: true, mission };
}

// ===== 收菜结算 =====

/** 概率发现的「单次≤1」去重 key。 */
function rewardCapKey(r: S7SalvageReward): string {
  switch (r.kind) {
    case 'resource': return `res:${r.resourceId}`;
    case 'ship_body': return `ship:${r.shipId}`;
    case 'plugin': return `plugin:${r.quality}`;
    case 'chest': return `chest:${r.chestId}`;
    case 'population': return `pop:${r.pop}`;
  }
}

/** 加权取一个发现项（candidates 非空）。 */
function pickWeighted(entries: S7DiscoveryEntry[], rng: S7AutoBattleRng): S7DiscoveryEntry {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  let x = rng.next() * total;
  for (const e of entries) {
    x -= Math.max(0, e.weight);
    if (x < 0) return e;
  }
  return entries[entries.length - 1];
}

/**
 * 掷出一趟打捞的全部奖励（必得 + 概率发现）。导出供单测直接验。确定性：同 rng 序列同结果。
 *  必得：软货币(随时长 yieldMult 放大) + 1 种通用碎片(舰/员随机其一·放大) + 该档额外保底干货。
 *  概率发现：掷骰 floor(baseRolls + perHourRolls×hours) 次·加权取项；「单次≤1」项已出过则本趟剔除候选。
 *  资源类奖励按 resourceId 合并求和(manifest 整洁)；非资源(完整星舰/插件/宝箱/人口)保持独立条目。
 */
export function rollSalvageRewards(
  config: S7SalvageConfig, tier: S7BeaconTier, hours: number, rng: S7AutoBattleRng,
): S7SalvageReward[] {
  const def = config.tiers[tier];
  const mult = config.timeTiers.find((t) => t.hours === hours)?.yieldMult ?? 1;
  const out: S7SalvageReward[] = [];

  // 必得软货币 + 通用碎片（1 种随机其一）。
  out.push({ kind: 'resource', resourceId: 'starOre', amount: Math.round(def.baseStarOre * mult) });
  out.push({ kind: 'resource', resourceId: 'starCargo', amount: Math.round(def.baseStarCargo * mult) });
  const shardKey = rng.pick(UNIVERSAL_SHARD_KEYS) ?? 'shipBlueprint';
  out.push({ kind: 'resource', resourceId: shardKey, amount: Math.round(def.universalShardBase * mult) });
  // 额外必得干货（稀有/史诗）。
  for (const g of def.guaranteedExtra) out.push({ ...g });

  // 概率发现。
  const rolls = Math.floor(def.baseRolls + def.perHourRolls * hours);
  const capUsed = new Set<string>();
  for (let i = 0; i < rolls; i += 1) {
    const candidates = def.discovery.filter((e) => !(e.cap1 && capUsed.has(rewardCapKey(e.reward))));
    if (candidates.length === 0) break;
    const picked = pickWeighted(candidates, rng);
    if (picked.cap1) capUsed.add(rewardCapKey(picked.reward));
    out.push({ ...picked.reward });
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
 */
export function collectSalvage(
  state: S7SalvageState, config: S7SalvageConfig, missionId: string, now: number, rng: S7AutoBattleRng,
): S7CollectSalvageResult {
  const idx = state.missions.findIndex((m) => m.id === missionId);
  if (idx < 0) return { ok: false, reason: 'not_found' };
  const mission = state.missions[idx];
  if (!isSalvageDone(mission, now)) return { ok: false, reason: 'not_done' };
  const rewards = rollSalvageRewards(config, mission.tier, mission.hours, rng);
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
