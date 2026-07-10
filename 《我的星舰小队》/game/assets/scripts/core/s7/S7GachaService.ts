// 抽卡三池引擎（步5 收尾批回写·纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.1 + 初值表 v0.7。
//
// 职责：把「三池 + 每日轮换 + 碎片化出货 + 阶级本体 + 20 抽真概率保底 + 专属池进度兑换 + 轮换补发(走邮件)」接成可玩逻辑。
//   - 抽取结果直接落到 squad(本体) / tiers(阶级) / shards(专属碎片)；轮换补发塞进 mailbox（玩家邮箱领回）。
//   - 不碰补给券钱包：补给券在 S7ResourceState(存档层)，core 不 import save —— 调用方按返回的 ticketsSpent 扣券。
//   - 随机用注入的 S7AutoBattleRng（确定可测）；时间(now/dayIndex)由调用方传入（不读系统时钟）。
//
// 出货模型（v0.7 校准终值·S10.1 碎片化）：
//   每抽必得：随机开放单位的专属碎片 1-3（期望 2.0）；
//   本体线：C 7% / B 2.5% / A 0.8%+补给站垫层——独立掷、本体单位独立随机；
//   20 抽保底=真概率（每抽都有机会提前出 A；天然 A/保底 A 都清计数=保底进度条语义）；
//   本体带阶级：舰 C/B/A 阶·员 1★/2★/3★；已拥有→"高阶留低阶分解"（更高阶=升到该阶+折 15；否则折 15）。
//   补给站钩子（细案⑥）：垫层=A 本体率绝对加点（supplyATierRateBumpPct）；免费抽/十连九折在 drawGachaMany 计费面。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7GachaConfig,
  S7GachaPoolId,
  S7GachaUnitKind,
  S7GachaBodyRank,
  poolUnitKind,
  nonExclusiveShipIds,
  bodyRankToShipTier,
  bodyRankToPilotStar,
} from './S7GachaConfig';
import { S7GachaState } from './S7GachaState';
import { S7SquadState, grantShip, grantPilot, isShipOwned, isPilotOwned } from './S7Squad';
import { S7UnitTierState, getShipTier, setShipTier, getPilotStar, setPilotStar } from './S7UnitTierState';
import { S7ExclusiveShardInventoryState, addExclusiveShards } from './S7ExclusiveShardInventory';
import { S7MailboxState, addMail, S7MailReward } from './S7Mailbox';
import { supplyATierRateBumpPct, supplyTenPullTicketCost } from './S7BuildingEffects';
import { s7DayKey } from './S7AdDailyCounter';

/** 由时间戳(ms)算「游戏日序号」——委托全游戏统一日界（北京时间凌晨 4 点重置）。轮换以此为准。 */
export function gachaDayIndex(now: number): number {
  return s7DayKey(now);
}

/** 当前专属轮换期号(= floor(day/rotationDays))。 */
export function exclusivePeriodOf(config: S7GachaConfig, dayIndex: number): number {
  const days = Math.max(1, config.rotationDays);
  return Math.floor(dayIndex / days);
}

/** 当期专属舰 id（按期号在 exclusiveShipIds 里轮换）。无专属舰配置→null。 */
export function currentExclusiveShipId(config: S7GachaConfig, dayIndex: number): string | null {
  const list = config.exclusiveShipIds;
  if (!Array.isArray(list) || list.length === 0) return null;
  const period = exclusivePeriodOf(config, dayIndex);
  return list[((period % list.length) + list.length) % list.length];
}

/** 当天开放的轮换类别 id（招募/整备：按天滑动取 dailyOpenCategories 个，回卷成 rotationDays 天一轮）。 */
export function openCategoryIds(config: S7GachaConfig, poolId: S7GachaPoolId, dayIndex: number): string[] {
  const cats = poolId === 'recruit' ? config.recruitCategories : config.refitCategories;
  const n = cats.length;
  if (n === 0) return [];
  const open = Math.max(1, config.dailyOpenCategories);
  const start = (((dayIndex * open) % n) + n) % n;
  const out: string[] = [];
  for (let k = 0; k < open && k < n; k += 1) {
    const id = cats[(start + k) % n].categoryId;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** 当天某池可抽到的单位 id 列表。专属池=所有非专属舰 + 当期专属舰；招募/整备=当天开放类别的成员。 */
export function openUnitIds(config: S7GachaConfig, poolId: S7GachaPoolId, dayIndex: number): string[] {
  if (poolId === 'exclusive') {
    const ships = nonExclusiveShipIds(config);
    const ex = currentExclusiveShipId(config, dayIndex);
    if (ex && !ships.includes(ex)) ships.push(ex);
    return ships;
  }
  const cats = poolId === 'recruit' ? config.recruitCategories : config.refitCategories;
  const openIds = new Set(openCategoryIds(config, poolId, dayIndex));
  const out: string[] = [];
  for (const cat of cats) {
    if (!openIds.has(cat.categoryId)) continue;
    for (const id of cat.memberIds) if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ===== 轮换补发（专属池忘领的满格进度箱·走邮件，简化结算 Ron 拍板）=====

export interface S7GachaRefreshResult {
  /** 本次刷新是否发生了专属轮换。 */
  rotated: boolean;
  /** 因轮换补发结算的满格箱数(0=无补发)。 */
  settledBoxes: number;
  /** 补发邮件 id（无补发则 null）。 */
  mailId: string | null;
}

/**
 * 把抽卡状态刷新到「当前游戏日」：检测专属轮换。
 *  - 若发生轮换且上一期有「忘领的满格兑换进度」→ 按简化规则结算并塞进邮箱（OLD 期专属：未拥有→发 1 本体+余格折碎片；已拥有→全折碎片）。
 *  - 然后清零兑换进度(零头不补偿·§10.1)、刷新当前期号/专属舰缓存。
 * 必须在抽取前 / 进入抽卡界面 / 加载存档时调用。now 用于邮件 createdAt。返回本次轮换/补发情况。
 */
export function refreshGachaToDay(
  state: S7GachaState,
  mailbox: S7MailboxState,
  config: S7GachaConfig,
  dayIndex: number,
  now: number,
): S7GachaRefreshResult {
  const period = exclusivePeriodOf(config, dayIndex);
  const result: S7GachaRefreshResult = { rotated: false, settledBoxes: 0, mailId: null };
  if (state.exclusivePeriod === period) {
    // 同期：仅确保专属舰缓存正确（首次初始化时 exclusivePeriod 已对但 shipId 可能为 null）。
    if (state.exclusiveShipId === null) state.exclusiveShipId = currentExclusiveShipId(config, dayIndex);
    return result;
  }

  // 发生轮换（或首次初始化 exclusivePeriod=-1）。
  result.rotated = state.exclusivePeriod !== -1; // 首次初始化不算“轮换”
  const oldExclusive = state.exclusiveShipId;
  const threshold = Math.max(1, config.exchangeThreshold);
  const unclaimed = Math.max(0, Math.floor(state.exchangeProgress / threshold) - state.exchangeClaimed);

  if (result.rotated && unclaimed > 0 && oldExclusive) {
    // 简化结算（Ron 拍板）：忘领的满格 → 邮件补发。编码为「1 个本体(unit) + 余格折碎片」；
    //   本函数刻意不依赖 squad（轮换可能在无 squad 上下文触发），故「未拥有发本体 / 已拥有全折碎片」的分支
    //   由领取应用侧(界面层)按领取当时是否已拥有 OLD 专属来决定 unit→本体 还是 unit→折碎片（见 S7MailReward 'unit'）。
    result.settledBoxes = unclaimed;
    const rewards: S7MailReward[] = [
      { type: 'unit', unitKind: 'ship', unitId: oldExclusive },
    ];
    if (unclaimed > 1) {
      rewards.push({ type: 'resource', resourceId: exclusiveShardResourceId(oldExclusive), amount: (unclaimed - 1) * config.exchangeOverflowShards });
    }
    const mail = addMail(mailbox, {
      kind: 'gacha_rotation_makeup',
      title: '专属补给·轮换补发',
      rewards,
      createdAt: now,
    });
    result.mailId = mail.id;
  }

  // 清零进度(零头清零·不补偿) + 刷新期号/专属缓存。
  state.exchangeProgress = 0;
  state.exchangeClaimed = 0;
  state.exclusivePeriod = period;
  state.exclusiveShipId = currentExclusiveShipId(config, dayIndex);
  return result;
}

/** 某单位专属碎片在「钱包/邮件 resource」里的 resourceId 约定：`exShard:<unitId>`（领取侧解析后入 exclusiveShards 表）。 */
export function exclusiveShardResourceId(unitId: string): string {
  return `exShard:${unitId}`;
}

// ===== 单抽 =====

/** 本体去向：new=新到手（按抽出阶级）/ upgraded=已拥有但抽出更高阶（升到该阶+旧体折 15）/ dup=折 15。 */
export type S7GachaBodyResult = 'new' | 'upgraded' | 'dup';

export interface S7GachaBodyDrop {
  unitId: string;
  /** 本体阶级档（C/B/A）。 */
  rank: S7GachaBodyRank;
  result: S7GachaBodyResult;
  /** 折得的专属碎片数（new=0）。 */
  foldShards: number;
  /** 是否为 20 抽硬保底命中（false=天然概率出的）。 */
  viaPity: boolean;
  /** 是否为当期专属舰（仅专属池可能 true）。 */
  isExclusive: boolean;
}

export interface S7GachaDrawOutcome {
  poolId: S7GachaPoolId;
  unitKind: S7GachaUnitKind;
  /** 每抽必得：随机单位专属碎片。 */
  shardUnitId: string;
  shardAmount: number;
  /** 本体线（多数抽为 null=没出本体）。 */
  body: S7GachaBodyDrop | null;
  /** 专属池本抽后的累计兑换进度（仅专属池有意义，其余 = 0）。 */
  exchangeProgress: number;
  /** 本抽后的保底计数（=保底进度条读数·满 pityDraws 前一抽的显示值）。 */
  pityCount: number;
}

/** 拥有判断（按单位种类）。 */
function isOwned(squad: S7SquadState, kind: S7GachaUnitKind, unitId: string): boolean {
  return kind === 'ship' ? isShipOwned(squad, unitId) : isPilotOwned(squad, unitId);
}

/** 发/升本体（含阶级）：返回结果与折碎片数。 */
function applyBody(
  squad: S7SquadState, tiers: S7UnitTierState, shards: S7ExclusiveShardInventoryState,
  kind: S7GachaUnitKind, unitId: string, rank: S7GachaBodyRank, dupFold: number,
): { result: S7GachaBodyResult; foldShards: number } {
  const owned = isOwned(squad, kind, unitId);
  if (!owned) {
    if (kind === 'ship') {
      grantShip(squad, unitId);
      const t = bodyRankToShipTier(rank);
      if (t > getShipTier(tiers, unitId)) setShipTier(tiers, unitId, t);
    } else {
      grantPilot(squad, unitId);
      const s = bodyRankToPilotStar(rank);
      if (s > getPilotStar(tiers, unitId)) setPilotStar(tiers, unitId, s);
    }
    return { result: 'new', foldShards: 0 };
  }
  // 已拥有：抽到更高阶=升到该阶+旧体分解 15；否则新体分解 15（"同单位高阶自动分解低阶"·§10.1）。
  const upgraded = kind === 'ship'
    ? bodyRankToShipTier(rank) > getShipTier(tiers, unitId)
    : bodyRankToPilotStar(rank) > getPilotStar(tiers, unitId);
  if (upgraded) {
    if (kind === 'ship') setShipTier(tiers, unitId, bodyRankToShipTier(rank));
    else setPilotStar(tiers, unitId, bodyRankToPilotStar(rank));
  }
  addExclusiveShards(shards, unitId, dupFold);
  return { result: upgraded ? 'upgraded' : 'dup', foldShards: dupFold };
}

/**
 * 抽一次（计费由调用方/drawGachaMany 管）。就地修改 state/squad/tiers/shards。
 *  流程：① 必得碎片：随机开放单位 1-3 片；② 本体线：保底计数+1 → 计数≥20 强制 A 保底，
 *       否则按 A(0.008+垫层)/B(0.025)/C(0.07) 独立掷（A 命中也清计数=真概率保底）；
 *       ③ 本体去向（new/upgraded/dup）；④ 专属池累加兑换进度。
 *  注：抽取前应已调用 refreshGachaToDay。openUnitIds 为空(配置异常)→返回 null。
 */
export function drawGachaOnce(
  state: S7GachaState,
  squad: S7SquadState,
  tiers: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  config: S7GachaConfig,
  rng: S7AutoBattleRng,
  poolId: S7GachaPoolId,
  dayIndex: number,
  supplyLevel = 0,
): S7GachaDrawOutcome | null {
  const kind = poolUnitKind(poolId);
  const pool = openUnitIds(config, poolId, dayIndex);
  if (pool.length === 0) return null;

  // ① 每抽必得随机单位专属碎片 1-3。
  const shardUnitId = rng.pick(pool) as string;
  const span = Math.max(0, config.shardPerPullMax - config.shardPerPullMin);
  const shardAmount = config.shardPerPullMin + (span > 0 ? rng.nextInt(span + 1) : 0);
  addExclusiveShards(shards, shardUnitId, shardAmount);

  // ② 本体线：真概率 + 20 抽硬保底。
  const pityNeed = Math.max(1, config.pityDraws);
  const aP = config.bodyP.A + supplyATierRateBumpPct(supplyLevel) / 100;
  let body: S7GachaBodyDrop | null = null;
  state.pity[poolId] += 1;
  const viaPity = state.pity[poolId] >= pityNeed;
  const r = rng.next();
  let rank: S7GachaBodyRank | null = null;
  if (viaPity) rank = 'A';
  else if (r < aP) rank = 'A';
  else if (r < aP + config.bodyP.B) rank = 'B';
  else if (r < aP + config.bodyP.B + config.bodyP.C) rank = 'C';
  if (rank !== null) {
    if (rank === 'A') state.pity[poolId] = 0; // 天然 A / 保底 A 都清计数（真概率保底）
    const unitId = rng.pick(pool) as string;
    const applied = applyBody(squad, tiers, shards, kind, unitId, rank, config.dupFoldShards);
    body = {
      unitId, rank, result: applied.result, foldShards: applied.foldShards, viaPity,
      isExclusive: poolId === 'exclusive' && config.exclusiveShipIds.includes(unitId),
    };
  }

  // ③ 专属池累加兑换进度。
  if (poolId === 'exclusive') state.exchangeProgress += 1;

  return {
    poolId, unitKind: kind, shardUnitId, shardAmount, body,
    exchangeProgress: poolId === 'exclusive' ? state.exchangeProgress : 0,
    pityCount: state.pity[poolId],
  };
}

/**
 * 连抽 count 次（单抽/十连）。计费面（细案⑥）：
 *  - 免费抽（freePulls·补给站 Lv4/Lv7 每日 1/2 次）先花、后走补给券；
 *  - count===10 且能整额支付时按十连价收券（Lv10 九折=9 券·supplyTenPullTicketCost）；
 *  - 券/免费额度合计不足 → 抽 min(count, 可支付数)（按钮层已挡·此处兜底）。
 * 返回实际消耗（调用方据此扣券/扣免费额度）。抽取前会自动刷新到当前日。
 */
export interface S7GachaDrawManyResult {
  ticketsSpent: number;
  freePullsSpent: number;
  outcomes: S7GachaDrawOutcome[];
  refresh: S7GachaRefreshResult;
}
export function drawGachaMany(
  state: S7GachaState,
  squad: S7SquadState,
  tiers: S7UnitTierState,
  shards: S7ExclusiveShardInventoryState,
  mailbox: S7MailboxState,
  config: S7GachaConfig,
  rng: S7AutoBattleRng,
  poolId: S7GachaPoolId,
  count: number,
  ticketsAvailable: number,
  dayIndex: number,
  now: number,
  opts?: { supplyLevel?: number; freePulls?: number },
): S7GachaDrawManyResult {
  const refresh = refreshGachaToDay(state, mailbox, config, dayIndex, now);
  const supplyLevel = opts?.supplyLevel ?? 0;
  const freeAvail = Math.max(0, Math.floor(opts?.freePulls ?? 0));
  const want = Math.max(0, Math.floor(count));
  const tickets = Math.max(0, Math.floor(ticketsAvailable));

  let times = 0;
  let ticketsSpent = 0;
  let freePullsSpent = 0;
  if (want === 10) {
    // 十连：整额券价（Lv10 九折）；不够整额则退化为可支付的单抽数（免费先花）。
    const tenCost = supplyTenPullTicketCost(supplyLevel);
    if (tickets >= tenCost) {
      times = 10; ticketsSpent = tenCost;
    } else {
      freePullsSpent = Math.min(freeAvail, want);
      ticketsSpent = Math.min(tickets, want - freePullsSpent);
      times = freePullsSpent + ticketsSpent;
    }
  } else {
    freePullsSpent = Math.min(freeAvail, want);
    ticketsSpent = Math.min(tickets, want - freePullsSpent);
    times = freePullsSpent + ticketsSpent;
  }

  const outcomes: S7GachaDrawOutcome[] = [];
  for (let i = 0; i < times; i += 1) {
    const o = drawGachaOnce(state, squad, tiers, shards, config, rng, poolId, dayIndex, supplyLevel);
    if (!o) break; // 配置异常·提前停（不多扣券）
    outcomes.push(o);
  }
  if (outcomes.length < times) {
    // 提前停（配置异常）：按实际抽数回算计费（免费先花的口径不变）。
    freePullsSpent = Math.min(freePullsSpent, outcomes.length);
    ticketsSpent = want === 10 && outcomes.length === 10 ? ticketsSpent : Math.max(0, outcomes.length - freePullsSpent);
  }
  return { ticketsSpent, freePullsSpent, outcomes, refresh };
}

// ===== 专属池进度兑换箱 =====

/** 当前可领的兑换箱数（floor(进度/阈值) - 已领；≥0）。 */
export function availableExchangeBoxes(state: S7GachaState, config: S7GachaConfig): number {
  const threshold = Math.max(1, config.exchangeThreshold);
  return Math.max(0, Math.floor(state.exchangeProgress / threshold) - state.exchangeClaimed);
}

export type S7ExchangeClaimResult =
  | { ok: true; exclusiveShipId: string; result: 'exclusive_body' | 'overflow_shards'; shardsGained: number; boxesClaimed: number }
  | { ok: false; reason: 'no_box' | 'no_exclusive' };

/**
 * 领取兑换箱（专属池进度满 → 点尾端箱兑换当期专属 A 级）。
 *  - claimAll=false：领 1 个；true：一次领光（×2 叠领·§10.1）。
 *  - 第 1 个箱：未拥有当期专属→发本体；其余箱(或本就已拥有)→溢出折 exchangeOverflowShards 该专属碎片。
 *  就地修改 squad/shards/state.exchangeClaimed。需先 refreshGachaToDay（保证当期专属正确）。
 */
export function claimExchangeBox(
  state: S7GachaState,
  squad: S7SquadState,
  shards: S7ExclusiveShardInventoryState,
  config: S7GachaConfig,
  dayIndex: number,
  claimAll = false,
): S7ExchangeClaimResult {
  const avail = availableExchangeBoxes(state, config);
  if (avail <= 0) return { ok: false, reason: 'no_box' };
  const exId = currentExclusiveShipId(config, dayIndex);
  if (!exId) return { ok: false, reason: 'no_exclusive' };

  const boxes = claimAll ? avail : 1;
  let bodyGranted = false;
  let shardsGained = 0;
  for (let i = 0; i < boxes; i += 1) {
    if (!isShipOwned(squad, exId)) {
      grantShip(squad, exId);
      bodyGranted = true;
    } else {
      addExclusiveShards(shards, exId, config.exchangeOverflowShards);
      shardsGained += config.exchangeOverflowShards;
    }
  }
  state.exchangeClaimed += boxes;
  return {
    ok: true,
    exclusiveShipId: exId,
    result: bodyGranted ? 'exclusive_body' : 'overflow_shards',
    shardsGained,
    boxesClaimed: boxes,
  };
}
