// 第2.5块·块5：广告点位统一政策单测（S13 决策①②③④——每日1次/用尽即隐/广告券/新手期全隐 的唯一收口）。
// 防假过反例（任务单硬要求）：①"把每日上限改0该点永不可用"会被【限次点位·未用=available】矩阵测出；
//   ②"券失败不退"会被 settleAdTicketAttempt 不变量测出；③上限表漏点位会被 adPointLimitTableComplete 测出。
import { describe, it, expect } from 'vitest';
import { S7_AD_POINTS, S7AdPoint } from '../assets/scripts/core/s7/S7AdGateway';
import {
  S7_AD_POINT_DAILY_LIMITS, S7_SPONSOR_SUPPLY_TICKETS, AD_TICKET_RESOURCE_KEY,
  s7AdButtonState, adTicketButtonLabel, adTicketCount,
  consumeAdTicket, refundAdTicket, settleAdTicketAttempt, adPointLimitTableComplete,
  S7_WELFARE_AD_POINTS,
} from '../assets/scripts/core/s7/S7AdPointPolicy';

describe('块5 · 上限表（决策①：全 1，唯一例外货舱多选不限）', () => {
  it('表键集恰好=网关十点位（漏登/多登都会红）', () => {
    expect(adPointLimitTableComplete()).toBe(true);
    expect(Object.keys(S7_AD_POINT_DAILY_LIMITS).sort()).toEqual([...S7_AD_POINTS].sort());
  });

  it('cargo_extra_pick=null 不限次；其余 9 点位全部=1', () => {
    expect(S7_AD_POINT_DAILY_LIMITS.cargo_extra_pick).toBeNull();
    for (const p of S7_AD_POINTS) {
      if (p === 'cargo_extra_pick') continue;
      expect(S7_AD_POINT_DAILY_LIMITS[p], p).toBe(1);
    }
  });

  it('赞助补给发放量=10（S13 #6·决策⑤·占位常量防无声改动）', () => {
    expect(S7_SPONSOR_SUPPLY_TICKETS).toBe(10);
  });
});

describe('块5 · 按钮三态（决策②③④）', () => {
  it('【防假过①】每个限次点位：今日未用 → available（若有人把上限改成 0，这里立刻红）', () => {
    for (const p of S7_AD_POINTS) {
      expect(s7AdButtonState(p, 0, 0, false), p).toEqual({ kind: 'available' });
    }
  });

  it('限次点位用满：无券 → hidden（不出现·非置灰）；持券 → ticket 且带张数', () => {
    expect(s7AdButtonState('return_report_double', 1, 0, false)).toEqual({ kind: 'hidden' });
    expect(s7AdButtonState('return_report_double', 1, 2, false)).toEqual({ kind: 'ticket', tickets: 2 });
    // 步5 重定基：#5 打捞秒完=福利三点位（#5/#6/#10）铁顶——券不可恢复·用满恒 hidden（总修订案五·v0.7 WELFARE_POINTS）。
    expect(s7AdButtonState('salvage_speedup', 5, 1, false)).toEqual({ kind: 'hidden' });
    expect(s7AdButtonState('sponsor_supply', 1, 3, false)).toEqual({ kind: 'hidden' });
    expect(s7AdButtonState('corridor_milestone_double', 1, 3, false)).toEqual({ kind: 'hidden' });
  });

  it('不限次点位（货舱多选）：用多少次都 available、永不进券态', () => {
    expect(s7AdButtonState('cargo_extra_pick', 99, 0, false)).toEqual({ kind: 'available' });
    expect(s7AdButtonState('cargo_extra_pick', 99, 5, false)).toEqual({ kind: 'available' });
  });

  it('强引导期（决策④）：全点位一律 hidden——未用/持券/不限次都藏', () => {
    for (const p of S7_AD_POINTS) {
      expect(s7AdButtonState(p, 0, 0, true), p).toEqual({ kind: 'hidden' });
      expect(s7AdButtonState(p, 1, 3, true), p).toEqual({ kind: 'hidden' });
    }
  });

  it('券态文案：基础文案+「广告券×N」（各界面统一走 helper·不各自拼）', () => {
    expect(adTicketButtonLabel('📺 全部翻倍', 2)).toBe('📺 全部翻倍｜广告券×2');
  });
});

describe('块5 · 广告券消耗时序（决策③：先扣→播→失败退回）', () => {
  it('consumeAdTicket：足额扣 1；不足 → false 且不动钱包；非法值当 0', () => {
    const w: Record<string, number> = { adTicket: 2 };
    expect(consumeAdTicket(w)).toBe(true);
    expect(w.adTicket).toBe(1);
    expect(consumeAdTicket(w)).toBe(true);
    expect(consumeAdTicket(w)).toBe(false); // 0 张 → 拒
    expect(w.adTicket).toBe(0);
    expect(adTicketCount({ adTicket: Number.NaN })).toBe(0);
    expect(adTicketCount({})).toBe(0);
    expect(consumeAdTicket({})).toBe(false);
  });

  it('【防假过②】失败必退券：扣 1 → settle(false) → 张数复原；settle(true) → 净扣 1（若退券逻辑被删这里红）', () => {
    const w: Record<string, number> = { [AD_TICKET_RESOURCE_KEY]: 3 };
    expect(consumeAdTicket(w)).toBe(true);
    expect(settleAdTicketAttempt(w, false)).toBe('refunded');
    expect(w.adTicket).toBe(3); // 失败退回·不白扣
    expect(consumeAdTicket(w)).toBe(true);
    expect(settleAdTicketAttempt(w, true)).toBe('granted');
    expect(w.adTicket).toBe(2); // 成功净扣 1
  });

  it('refundAdTicket：+1（含从 0/缺键退回）', () => {
    const w: Record<string, number> = {};
    refundAdTicket(w);
    expect(w.adTicket).toBe(1);
  });
});

describe('块5 · 三态与上限表联动（点位维度矩阵·防单点漏接）', () => {
  it('每个限次点位：用满且无券=hidden；用满且持券=福利三点位恒 hidden（铁顶）、其余 ticket（逐点位过·别漏收口）', () => {
    for (const p of S7_AD_POINTS) {
      const limit = S7_AD_POINT_DAILY_LIMITS[p as S7AdPoint];
      if (limit === null) continue;
      expect(s7AdButtonState(p, limit, 0, false), `${p} hidden`).toEqual({ kind: 'hidden' });
      if (S7_WELFARE_AD_POINTS.has(p as S7AdPoint)) {
        expect(s7AdButtonState(p, limit, 1, false), `${p} welfare-iron-cap`).toEqual({ kind: 'hidden' }); // 券不可恢复
      } else {
        expect(s7AdButtonState(p, limit, 1, false), `${p} ticket`).toEqual({ kind: 'ticket', tickets: 1 });
      }
    }
  });

  it('福利白名单=#5/#6/#10 恰三点位（v0.7 WELFARE_POINTS 对表）', () => {
    expect([...S7_WELFARE_AD_POINTS].sort()).toEqual(['corridor_milestone_double', 'salvage_speedup', 'sponsor_supply']);
  });
});
