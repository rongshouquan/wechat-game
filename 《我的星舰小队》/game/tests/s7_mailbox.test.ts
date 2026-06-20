// 阶段一 G2：邮件系统单测——收件/已读/领取(返回奖励)/过期/清理/计数/规范化。纯结构，不读磁盘表。
import { describe, it, expect } from 'vitest';
import {
  createDefaultS7Mailbox,
  normalizeS7Mailbox,
  addMail,
  markMailRead,
  claimMail,
  pruneExpiredMail,
  unreadMailCount,
  claimableMailCount,
} from '../assets/scripts/core/s7/S7Mailbox';

const T = 1_000_000; // 基准时刻

describe('G2 · 邮件收发/领取', () => {
  it('addMail 分配稳定 id m{seq}、递增 nextSeq、初始未读未领', () => {
    const box = createDefaultS7Mailbox();
    const m1 = addMail(box, { kind: 'k', title: 't1', rewards: [{ type: 'resource', resourceId: 'starOre', amount: 100 }], createdAt: T });
    const m2 = addMail(box, { kind: 'k', title: 't2', rewards: [], createdAt: T });
    expect(m1.id).toBe('m1');
    expect(m2.id).toBe('m2');
    expect(box.nextSeq).toBe(3);
    expect(m1.read).toBe(false);
    expect(m1.claimed).toBe(false);
  });

  it('claimMail：成功返回奖励 + 标记已领已读；再领 already_claimed', () => {
    const box = createDefaultS7Mailbox();
    addMail(box, { kind: 'activity', title: '结算', rewards: [
      { type: 'resource', resourceId: 'starOre', amount: 500 },
      { type: 'chest', chestId: 'actionTreasure', amount: 1 },
    ], createdAt: T });
    const r = claimMail(box, 'm1', T + 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rewards).toEqual([
      { type: 'resource', resourceId: 'starOre', amount: 500 },
      { type: 'chest', chestId: 'actionTreasure', amount: 1 },
    ]);
    expect(box.mails[0].claimed).toBe(true);
    expect(box.mails[0].read).toBe(true);
    const again = claimMail(box, 'm1', T + 20);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('already_claimed');
  });

  it('claimMail：不存在 not_found / 过期未领 expired（不可领）', () => {
    const box = createDefaultS7Mailbox();
    expect(claimMail(box, 'mX', T)).toMatchObject({ ok: false, reason: 'not_found' });
    addMail(box, { kind: 'k', title: 't', rewards: [{ type: 'resource', resourceId: 'starOre', amount: 1 }], createdAt: T, expireAt: T + 100 });
    expect(claimMail(box, 'm1', T + 200)).toMatchObject({ ok: false, reason: 'expired' }); // now 超过 expireAt
    expect(claimMail(box, 'm1', T + 50).ok).toBe(true); // 未过期可领
  });

  it('markMailRead / 计数：未读数、可领数（过期不计可领）', () => {
    const box = createDefaultS7Mailbox();
    addMail(box, { kind: 'k', title: 'a', rewards: [], createdAt: T });
    addMail(box, { kind: 'k', title: 'b', rewards: [], createdAt: T, expireAt: T + 10 });
    expect(unreadMailCount(box)).toBe(2);
    markMailRead(box, 'm1');
    expect(unreadMailCount(box)).toBe(1);
    expect(claimableMailCount(box, T + 5)).toBe(2); // 都没过期
    expect(claimableMailCount(box, T + 50)).toBe(1); // m2 过期 → 不可领
  });

  it('pruneExpiredMail：清掉过期未领、保留已领与未过期', () => {
    const box = createDefaultS7Mailbox();
    addMail(box, { kind: 'k', title: '永久', rewards: [], createdAt: T }); // m1 永不过期
    addMail(box, { kind: 'k', title: '过期未领', rewards: [], createdAt: T, expireAt: T + 10 }); // m2
    addMail(box, { kind: 'k', title: '过期已领', rewards: [{ type: 'resource', resourceId: 'starOre', amount: 1 }], createdAt: T, expireAt: T + 10 }); // m3
    claimMail(box, 'm3', T + 5); // 先领 m3
    const removed = pruneExpiredMail(box, T + 100);
    expect(removed).toBe(1); // 只清 m2(过期未领)
    expect(box.mails.map((m) => m.id).sort()).toEqual(['m1', 'm3']);
  });

  it('normalize：脏档清洗（丢非法邮件/非法奖励、nextSeq 守护大于最大 id 序号）', () => {
    const dirty = {
      mails: [
        { id: 'm1', kind: 'k', title: 't', rewards: [{ type: 'resource', resourceId: 'starOre', amount: 5 }, { type: 'resource', resourceId: '', amount: 5 }, { type: 'resource', resourceId: 'x', amount: -1 }], read: true, claimed: false, createdAt: T, expireAt: null },
        { id: 'm1', kind: 'dup', title: 'dup', rewards: [], read: false, claimed: false, createdAt: T, expireAt: null }, // 重复 id → 丢
        { id: '', kind: 'k', title: 'noid', rewards: [], read: false, claimed: false, createdAt: T, expireAt: null }, // 空 id → 丢
        { id: 'm9', kind: 'k', title: 'big', rewards: [], read: false, claimed: false, createdAt: T, expireAt: null },
      ],
      nextSeq: 2, // 故意比 m9 小 → 守护应抬到 10
    };
    const box = normalizeS7Mailbox(dirty);
    expect(box.mails.map((m) => m.id)).toEqual(['m1', 'm9']);
    expect(box.mails[0].rewards).toEqual([{ type: 'resource', resourceId: 'starOre', amount: 5 }]); // 非法奖励被滤
    expect(box.nextSeq).toBe(10); // 守护：> 最大 id 序号 9
  });
  it('normalize 非对象 → 默认空邮箱', () => {
    expect(normalizeS7Mailbox(null)).toEqual(createDefaultS7Mailbox());
  });
});
