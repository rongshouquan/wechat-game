// 阶段一 G1：广告网关 + mock 适配 单测。纯结构，不读磁盘表。
import { describe, it, expect } from 'vitest';
import {
  S7AdGateway,
  S7MockAdAdapter,
  S7_AD_POINTS,
  S7AdPoint,
} from '../assets/scripts/core/s7/S7AdGateway';

describe('G1 · 广告网关', () => {
  it('5 个点位齐全', () => {
    expect([...S7_AD_POINTS].sort()).toEqual(
      ['cargo_extra_pick', 'clear_reward_double', 'merchant_refresh', 'salvage_speedup', 'sponsor_supply'],
    );
  });

  it('mock 默认"看完" → 各点位 show 返回 ok', async () => {
    const g = new S7AdGateway(new S7MockAdAdapter());
    for (const p of S7_AD_POINTS) {
      const r = await g.show(p);
      expect(r.ok).toBe(true);
    }
  });

  it('mock 配成"被关" → show 返回 ok:false + reason', async () => {
    const g = new S7AdGateway(new S7MockAdAdapter({ ok: false, reason: 'closed' }));
    const r = await g.show('sponsor_supply');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('closed');
  });

  it('非法点位 → 当失败兜底（不抛错）', async () => {
    const g = new S7AdGateway(new S7MockAdAdapter());
    const r = await g.show('not_a_point' as S7AdPoint);
    expect(r.ok).toBe(false);
  });

  it('setAdapter 可热换适配器（阶段五换真 SDK 的接口）', async () => {
    const g = new S7AdGateway(new S7MockAdAdapter({ ok: false, reason: 'no_fill' }));
    expect((await g.show('salvage_speedup')).ok).toBe(false);
    g.setAdapter(new S7MockAdAdapter({ ok: true }));
    expect((await g.show('salvage_speedup')).ok).toBe(true);
  });
});
