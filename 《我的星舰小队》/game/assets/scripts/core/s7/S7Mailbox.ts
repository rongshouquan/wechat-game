// 邮件系统（阶段一 G2，纯 TS，不依赖 cc）：v1.0 §10.6「活动结算/补偿通过邮件发放领到背包」。
//
// 这是基建：被 C(抽卡轮换补发进度箱) / G(活动里程碑/完成/结算发奖) 依赖——它们把奖励塞进邮件，玩家在邮箱领到背包/钱包。
// 本模块只管"邮件这件容器"：收件 / 已读 / 领取(返回该邮奖励给调用方去入账) / 过期清理 / 计数。
//   ⚠️ 不直接入账：领取只把奖励"返回"，由调用方按类型应用到 钱包(resource) / 宝箱库存(chest)（保持与具体 store 解耦）。
//   不依赖 cc / 流程版；不使用随机；时间(createdAt/now)由调用方传入（确定可测、不读系统时钟）。

/**
 * 一笔邮件奖励，调用方按 type 入对应 store：
 *  - resource：软货币/碎片 → 钱包；
 *  - chest：宝箱 → 宝箱库存；
 *  - unit：星舰/驾驶员「本体」→ squad（C 块抽卡专属池轮换补发用；领取侧若已拥有该本体则按规则折成专属碎片，见 S7GachaService）。
 */
export type S7MailReward =
  | { type: 'resource'; resourceId: string; amount: number }
  | { type: 'chest'; chestId: string; amount: number }
  | { type: 'unit'; unitKind: 'ship' | 'pilot'; unitId: string }
  | { type: 'population'; pop: 'resident' | 'worker'; amount: number }; // G 活动补发：里程碑给的人口也能走邮件

export interface S7Mail {
  id: string;
  /** 来源标签（如 'activity_action3' / 'gacha_rotation_makeup' / 'compensation'），仅分类/展示用。 */
  kind: string;
  title: string;
  rewards: S7MailReward[];
  read: boolean;
  claimed: boolean;
  /** 收件时刻（毫秒，调用方传）。 */
  createdAt: number;
  /** 过期时刻（毫秒）；null=永不过期。过期且未领 → 不可再领、可被清理。 */
  expireAt: number | null;
}

export interface S7MailboxState {
  mails: S7Mail[];
  /** 下一封邮件序号（生成稳定 id `m{seq}`，不用随机）。 */
  nextSeq: number;
}

export function createDefaultS7Mailbox(): S7MailboxState {
  return { mails: [], nextSeq: 1 };
}

function normReward(raw: unknown): S7MailReward | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // unit：本体奖励无 amount（本体唯一），须先于 amount 校验判定，否则会被下方 amount<=0 误拦。
  if (r.type === 'unit' && (r.unitKind === 'ship' || r.unitKind === 'pilot') && typeof r.unitId === 'string' && r.unitId.length > 0) {
    return { type: 'unit', unitKind: r.unitKind, unitId: r.unitId };
  }
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0 ? Math.floor(r.amount) : 0;
  if (amount <= 0) return null;
  if (r.type === 'resource' && typeof r.resourceId === 'string' && r.resourceId.length > 0) {
    return { type: 'resource', resourceId: r.resourceId, amount };
  }
  if (r.type === 'chest' && typeof r.chestId === 'string' && r.chestId.length > 0) {
    return { type: 'chest', chestId: r.chestId, amount };
  }
  if (r.type === 'population' && (r.pop === 'resident' || r.pop === 'worker')) {
    return { type: 'population', pop: r.pop, amount };
  }
  return null;
}

/** 规范化邮箱（防脏档）：邮件取合法字段，奖励过滤非法，nextSeq 取 ≥ 现有最大序号+1 的正整数。 */
export function normalizeS7Mailbox(raw: unknown): S7MailboxState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const mails: S7Mail[] = [];
  const seenIds = new Set<string>();
  if (Array.isArray(src.mails)) {
    for (const m of src.mails) {
      const row = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      const id = row.id;
      if (typeof id !== 'string' || id.length === 0 || seenIds.has(id)) continue;
      seenIds.add(id);
      mails.push({
        id,
        kind: typeof row.kind === 'string' ? row.kind : 'unknown',
        title: typeof row.title === 'string' ? row.title : '',
        rewards: Array.isArray(row.rewards) ? row.rewards.map(normReward).filter((x): x is S7MailReward => x !== null) : [],
        read: row.read === true,
        claimed: row.claimed === true,
        createdAt: typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : 0,
        expireAt: typeof row.expireAt === 'number' && Number.isFinite(row.expireAt) ? row.expireAt : null,
      });
    }
  }
  let nextSeq = typeof src.nextSeq === 'number' && Number.isInteger(src.nextSeq) && src.nextSeq > 0 ? src.nextSeq : 1;
  // 守护：nextSeq 必须大于已有 m{n} 的最大 n，避免脏档导致 id 撞车。
  for (const m of mails) {
    const n = /^m(\d+)$/.exec(m.id);
    if (n) nextSeq = Math.max(nextSeq, parseInt(n[1], 10) + 1);
  }
  return { mails, nextSeq };
}

export interface S7AddMailInput {
  kind: string;
  title: string;
  rewards: S7MailReward[];
  createdAt: number;
  /** 过期时刻（毫秒）；不传=永不过期。 */
  expireAt?: number | null;
}

/** 收一封邮件（就地加入，分配稳定 id `m{seq}`）。返回新邮件。 */
export function addMail(box: S7MailboxState, input: S7AddMailInput): S7Mail {
  const mail: S7Mail = {
    id: `m${box.nextSeq}`,
    kind: input.kind,
    title: input.title,
    rewards: input.rewards.slice(),
    read: false,
    claimed: false,
    createdAt: input.createdAt,
    expireAt: input.expireAt ?? null,
  };
  box.nextSeq += 1;
  box.mails.push(mail);
  return mail;
}

/** 标记已读。返回是否命中。 */
export function markMailRead(box: S7MailboxState, id: string): boolean {
  const m = box.mails.find((x) => x.id === id);
  if (!m) return false;
  m.read = true;
  return true;
}

const isExpired = (m: S7Mail, now: number): boolean => m.expireAt !== null && now > m.expireAt;

export type S7ClaimMailResult =
  | { ok: true; rewards: S7MailReward[] }
  | { ok: false; reason: 'not_found' | 'already_claimed' | 'expired' };

/**
 * 领取一封邮件：成功则标记 claimed+read 并返回奖励（调用方按 type 入钱包/宝箱）。
 * 已领→already_claimed；过期未领→expired（不可领）；不存在→not_found。不直接入账（解耦）。
 */
export function claimMail(box: S7MailboxState, id: string, now: number): S7ClaimMailResult {
  const m = box.mails.find((x) => x.id === id);
  if (!m) return { ok: false, reason: 'not_found' };
  if (m.claimed) return { ok: false, reason: 'already_claimed' };
  if (isExpired(m, now)) return { ok: false, reason: 'expired' };
  m.claimed = true;
  m.read = true;
  return { ok: true, rewards: m.rewards.slice() };
}

/** 清理"已过期且未领"的邮件（已领的保留作历史可另行清，本步只清过期未领）。返回清理条数。 */
export function pruneExpiredMail(box: S7MailboxState, now: number): number {
  const before = box.mails.length;
  box.mails = box.mails.filter((m) => m.claimed || !isExpired(m, now));
  return before - box.mails.length;
}

/** 未读数（含已领但未读？已领自动置读，故未读=未读未领）。 */
export function unreadMailCount(box: S7MailboxState): number {
  return box.mails.reduce((n, m) => (m.read ? n : n + 1), 0);
}

/** 可领数（未领且未过期）——用 now 判过期。 */
export function claimableMailCount(box: S7MailboxState, now: number): number {
  return box.mails.reduce((n, m) => (!m.claimed && !isExpired(m, now) ? n + 1 : n), 0);
}
