// 抽卡三池引擎（阶段一 C-step1，纯 TS，不依赖 cc / Math.random / Date）：v1.0 §10.1。
//
// 职责：把「三池 + 每日轮换 + 阶级地板保底 + 重复折碎片 + 专属池进度兑换 + 轮换补发(走邮件)」接成可玩逻辑。
//   - 抽取结果直接落到 squad(本体) / shards(专属碎片)；轮换补发塞进 mailbox（玩家邮箱领回）。
//   - 不碰补给券钱包：补给券在 S7ResourceState(存档层)，core 不 import save —— 调用方先确保并扣券（见各函数注释）。
//   - 随机用注入的 S7AutoBattleRng（确定可测）；时间(now/dayIndex)由调用方传入（不读系统时钟）。
//
// 设计映射（§10.1）：
//   招募池(驾驶员)/整备池(星舰)：每天只开 dailyOpenCategories(=2) 个类别、每天轮换、rotationDays(=3) 天走完一轮 6 类。
//   专属池(星舰)：常驻「所有非专属舰」+「当期专属舰」(每 rotationDays 轮换一艘)；每抽累积兑换进度，满阈值出兑换箱。
//   三池阶级地板：每 floorPityDraws 抽必出 ≥A 级/3★（已拥有→折 floorFoldShards 碎片）。重复本体→折 dupFoldShards 碎片。
//   专属池兑换箱：兑换当期专属(A 级)，已拥有→溢出折 exchangeOverflowShards 碎片；轮换时忘领的满格→邮件补发(简化结算·Ron 拍板)。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7GachaConfig,
  S7GachaPoolId,
  S7GachaUnitKind,
  poolUnitKind,
  nonExclusiveShipIds,
} from './S7GachaConfig';
import { S7GachaState } from './S7GachaState';
import { S7SquadState, grantShip, grantPilot, isShipOwned, isPilotOwned } from './S7Squad';
import { S7ExclusiveShardInventoryState, addExclusiveShards } from './S7ExclusiveShardInventory';
import { S7MailboxState, addMail, S7MailReward } from './S7Mailbox';

const DAY_MS = 86_400_000;

/** 由时间戳(ms)算「游戏日序号」(UTC 起算)。轮换以此为准；第二块/真机可再本地化。 */
export function gachaDayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
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

/** 阶级地板保底的候选（≥A 级/3★）：招募→aTierPilotIds，整备/专属→aTierShipIds。 */
function floorCandidates(config: S7GachaConfig, poolId: S7GachaPoolId): string[] {
  return poolId === 'recruit' ? config.aTierPilotIds : config.aTierShipIds;
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

export type S7GachaDrawResult = 'new_body' | 'dup_shards' | 'floor_body' | 'floor_shards';

export interface S7GachaDrawOutcome {
  poolId: S7GachaPoolId;
  unitKind: S7GachaUnitKind;
  unitId: string;
  /** 是否为阶级地板保底命中的那一抽。 */
  isFloor: boolean;
  /** 是否抽到「当期专属舰」（仅专属池可能为 true）。专属舰恒按 A 级处理（Ron 拍板·不出 C/B 专属·见 §10.1）。 */
  isExclusive: boolean;
  result: S7GachaDrawResult;
  /** 折得的专属碎片数（发本体时为 0）。 */
  shardsGained: number;
  /** 专属池本抽后的累计兑换进度（仅专属池有意义，其余 = 0）。 */
  exchangeProgress: number;
}

/** 拥有判断（按单位种类）。 */
function isOwned(squad: S7SquadState, kind: S7GachaUnitKind, unitId: string): boolean {
  return kind === 'ship' ? isShipOwned(squad, unitId) : isPilotOwned(squad, unitId);
}
/** 发本体（按单位种类）。 */
function grantBody(squad: S7SquadState, kind: S7GachaUnitKind, unitId: string): void {
  if (kind === 'ship') grantShip(squad, unitId);
  else grantPilot(squad, unitId);
}

/**
 * 抽一次（调用方须已确保并扣掉 1 张补给券）。就地修改 state/squad/shards。
 *  流程：① 累加该池保底计数，判定本抽是否为地板保底；② 选单位（保底→A 级候选，普通→当天开放单位）；
 *       ③ 未拥有→发本体；已拥有→折碎片(保底 floorFoldShards / 普通 dupFoldShards)；④ 专属池累加兑换进度。
 *  注：抽取前应已调用 refreshGachaToDay（保证专属/进度按当前日）。openUnitIds 为空(配置异常)→返回 null。
 */
export function drawGachaOnce(
  state: S7GachaState,
  squad: S7SquadState,
  shards: S7ExclusiveShardInventoryState,
  config: S7GachaConfig,
  rng: S7AutoBattleRng,
  poolId: S7GachaPoolId,
  dayIndex: number,
): S7GachaDrawOutcome | null {
  const kind = poolUnitKind(poolId);
  const pool = openUnitIds(config, poolId, dayIndex);
  if (pool.length === 0) return null;

  // ① 地板保底判定：达 floorPityDraws 的那一抽触发。
  const pityNeed = Math.max(1, config.floorPityDraws);
  const isFloor = state.pity[poolId] + 1 >= pityNeed;

  // ② 选单位。
  let unitId: string;
  if (isFloor) {
    const cands = floorCandidates(config, poolId).filter((id) => id.length > 0);
    unitId = (cands.length > 0 ? rng.pick(cands) : rng.pick(pool)) as string;
    state.pity[poolId] = 0; // 命中保底清零
  } else {
    unitId = rng.pick(pool) as string;
    state.pity[poolId] += 1;
  }

  // ③ 发本体 / 折碎片。
  const owned = isOwned(squad, kind, unitId);
  let result: S7GachaDrawResult;
  let shardsGained = 0;
  if (!owned) {
    grantBody(squad, kind, unitId);
    result = isFloor ? 'floor_body' : 'new_body';
  } else {
    shardsGained = isFloor ? config.floorFoldShards : config.dupFoldShards;
    addExclusiveShards(shards, unitId, shardsGained);
    result = isFloor ? 'floor_shards' : 'dup_shards';
  }

  // ④ 专属池累加兑换进度。
  if (poolId === 'exclusive') state.exchangeProgress += 1;

  // 是否抽到当期专属舰（仅专属池）：专属舰恒 A 级（§10.1·Ron 拍板）。
  const isExclusive = poolId === 'exclusive' && config.exclusiveShipIds.includes(unitId);

  return { poolId, unitKind: kind, unitId, isFloor, isExclusive, result, shardsGained, exchangeProgress: poolId === 'exclusive' ? state.exchangeProgress : 0 };
}

/**
 * 连抽 count 次（如十连）。调用方传 ticketsAvailable（当前补给券数），引擎抽 min(count, available) 次，
 * 返回实际消耗券数 ticketsSpent 与每抽结果——调用方据 ticketsSpent 扣券。抽取前会自动刷新到当前日。
 */
export interface S7GachaDrawManyResult {
  ticketsSpent: number;
  outcomes: S7GachaDrawOutcome[];
  refresh: S7GachaRefreshResult;
}
export function drawGachaMany(
  state: S7GachaState,
  squad: S7SquadState,
  shards: S7ExclusiveShardInventoryState,
  mailbox: S7MailboxState,
  config: S7GachaConfig,
  rng: S7AutoBattleRng,
  poolId: S7GachaPoolId,
  count: number,
  ticketsAvailable: number,
  dayIndex: number,
  now: number,
): S7GachaDrawManyResult {
  const refresh = refreshGachaToDay(state, mailbox, config, dayIndex, now);
  const times = Math.max(0, Math.min(Math.floor(count), Math.floor(ticketsAvailable)));
  const outcomes: S7GachaDrawOutcome[] = [];
  for (let i = 0; i < times; i += 1) {
    const o = drawGachaOnce(state, squad, shards, config, rng, poolId, dayIndex);
    if (!o) break; // 配置异常·提前停（不多扣券）
    outcomes.push(o);
  }
  return { ticketsSpent: outcomes.length, outcomes, refresh };
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
