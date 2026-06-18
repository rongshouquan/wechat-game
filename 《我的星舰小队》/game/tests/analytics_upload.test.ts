import { describe, it, expect } from 'vitest';
import {
  AnalyticsUploadEvent,
  P0_EVENT_NAMES,
  P0_EVENT_SPECS,
  validateUploadEvent,
} from '../assets/scripts/analytics/AnalyticsEventTypes';
import { AnalyticsUploadQueue } from '../assets/scripts/analytics/AnalyticsUploadAdapter';
import { MockAnalyticsUploadAdapter } from '../assets/scripts/analytics/MockAnalyticsUploadAdapter';

const T0 = 1_700_000_000_000;

/** 构造一条合法的 P0 事件，按事件 spec 自动补齐必填 levelId 与关键参数。 */
function makeEvent(eventName: string, overrides: Partial<AnalyticsUploadEvent> = {}): AnalyticsUploadEvent {
  const spec = (P0_EVENT_SPECS as Record<string, { requiresLevelId: boolean; params: readonly string[] }>)[eventName];
  const params: Record<string, unknown> = {};
  if (spec) {
    for (const key of spec.params) {
      params[key] = key === 'isAd' ? false : 1;
    }
  }
  const base: AnalyticsUploadEvent = {
    eventName,
    userId: 'dev_user_1',
    sessionId: 'sess_1',
    timestamp: T0,
    appVersion: '1.0.0',
    configVersion: '0.1.0',
    params,
  };
  if (spec?.requiresLevelId) {
    base.levelId = '1-1';
  }
  return { ...base, ...overrides, params: { ...params, ...(overrides.params ?? {}) } };
}

describe('AnalyticsEventTypes - P0 事件字段校验', () => {
  it('所有 P0 事件按 spec 补齐后均校验通过', () => {
    for (const name of P0_EVENT_NAMES) {
      const result = validateUploadEvent(makeEvent(name));
      expect(result.valid, `${name}: ${result.errors.join(',')}`).toBe(true);
    }
  });

  it('缺通用必填字段（userId）被拒绝', () => {
    const event = makeEvent('stage_start', { userId: '' });
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing_or_invalid_field:userId');
  });

  it('缺必填顶层 levelId（requiresLevelId 事件）被拒绝', () => {
    const event = makeEvent('stage_start');
    delete event.levelId;
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing_required_field:levelId');
  });

  it('缺 P0 关键参数被拒绝', () => {
    const event = makeEvent('ad_complete');
    delete (event.params as Record<string, unknown>).rewardId;
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing_required_param:rewardId');
  });

  it('未登记事件名被拒绝', () => {
    const event = makeEvent('stage_start', { eventName: 'not_a_real_event' });
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('unknown_event:'))).toBe(true);
  });

  it('timestamp / params 类型非法被拒绝', () => {
    const event = makeEvent('goal_show');
    (event as unknown as { timestamp: unknown }).timestamp = 'now';
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing_or_invalid_field:timestamp');
  });
});

describe('AnalyticsEventTypes - 敏感硬件 ID 防采集', () => {
  it('params 内出现 imei 被拒绝', () => {
    const event = makeEvent('stage_start', { params: { imei: '123456789' } });
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('sensitive_id_param:'))).toBe(true);
  });

  it('顶层出现 deviceId（硬件 ID）被拒绝', () => {
    const event = makeEvent('stage_start');
    (event as unknown as { deviceId: string }).deviceId = 'hw-xxxx';
    const result = validateUploadEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('sensitive_id_field:'))).toBe(true);
  });

  it('大小写变体（IDFA / mac）同样被拦截', () => {
    const idfa = validateUploadEvent(makeEvent('ad_click', { params: { IDFA: 'x' } }));
    const mac = validateUploadEvent(makeEvent('ad_click', { params: { MAC: 'aa:bb' } }));
    expect(idfa.valid).toBe(false);
    expect(mac.valid).toBe(false);
  });
});

describe('AnalyticsUploadQueue - 入队校验', () => {
  it('非法事件被拒绝入队，不进入队列', () => {
    const queue = new AnalyticsUploadQueue(MockAnalyticsUploadAdapter.alwaysOk());
    const res = queue.enqueue(makeEvent('stage_start', { userId: '' }));
    expect(res.accepted).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(queue.size).toBe(0);
  });

  it('合法事件入队为 pending', () => {
    const queue = new AnalyticsUploadQueue(MockAnalyticsUploadAdapter.alwaysOk());
    const res = queue.enqueue(makeEvent('stage_start'));
    expect(res.accepted).toBe(true);
    expect(queue.countByStatus('pending')).toBe(1);
  });
});

describe('AnalyticsUploadQueue - 上报成功 / 失败 / 重试', () => {
  it('上报成功后标记 sent，mock 收到事件', async () => {
    const adapter = MockAnalyticsUploadAdapter.alwaysOk();
    const queue = new AnalyticsUploadQueue(adapter);
    queue.enqueue(makeEvent('tutorial_start'));
    queue.enqueue(makeEvent('stage_win'));

    const summary = await queue.flush(T0);
    expect(summary).toEqual({ attempted: 2, sent: 2, failed: 0 });
    expect(queue.countByStatus('sent')).toBe(2);
    expect(adapter.sentEvents).toHaveLength(2);
  });

  it('上报失败后标记 failed 并设置退避 retryAt', async () => {
    const adapter = MockAnalyticsUploadAdapter.alwaysFail('net_down');
    const queue = new AnalyticsUploadQueue(adapter);
    queue.enqueue(makeEvent('stage_start'));

    const summary = await queue.flush(T0);
    expect(summary.failed).toBe(1);
    const entry = queue.snapshot()[0];
    expect(entry.status).toBe('failed');
    expect(entry.attempts).toBe(1);
    expect(entry.retryAt).toBe(T0 + 10_000); // 首次失败退避 10s
    expect(entry.lastError).toBe('net_down');
  });

  it('未到 retryAt 不重试；到点后重试并成功', async () => {
    const adapter = MockAnalyticsUploadAdapter.failFirst(1);
    const queue = new AnalyticsUploadQueue(adapter);
    queue.enqueue(makeEvent('ad_complete'));

    // 第一次失败
    await queue.flush(T0);
    expect(queue.countByStatus('failed')).toBe(1);

    // 未到 retryAt（T0+10s）：不重试
    const early = await queue.flush(T0 + 5_000);
    expect(early.attempted).toBe(0);
    expect(adapter.callCount).toBe(1);

    // 到点重试 -> 成功
    const late = await queue.flush(T0 + 10_000);
    expect(late.attempted).toBe(1);
    expect(late.sent).toBe(1);
    expect(queue.countByStatus('sent')).toBe(1);
    expect(adapter.callCount).toBe(2);
  });

  it('多次失败按 10s/30s/60s/5min 退避递增', async () => {
    const adapter = MockAnalyticsUploadAdapter.alwaysFail();
    const queue = new AnalyticsUploadQueue(adapter);
    queue.enqueue(makeEvent('stage_start'));

    let now = T0;
    await queue.flush(now); // attempt1 -> retryAt +10s
    expect(queue.snapshot()[0].retryAt).toBe(now + 10_000);

    now += 10_000;
    await queue.flush(now); // attempt2 -> +30s
    expect(queue.snapshot()[0].retryAt).toBe(now + 30_000);

    now += 30_000;
    await queue.flush(now); // attempt3 -> +60s
    expect(queue.snapshot()[0].retryAt).toBe(now + 60_000);

    now += 60_000;
    await queue.flush(now); // attempt4 -> tail 5min
    expect(queue.snapshot()[0].retryAt).toBe(now + 5 * 60_000);
  });

  it('failed 超过 24 小时保留窗口被裁剪', async () => {
    const adapter = MockAnalyticsUploadAdapter.alwaysFail();
    const queue = new AnalyticsUploadQueue(adapter);
    queue.enqueue(makeEvent('stage_start'));
    await queue.flush(T0); // firstFailedAt = T0

    // 超过 24h 后再 flush（无到期事件也会触发裁剪）
    const summary = await queue.flush(T0 + 24 * 60 * 60_000 + 1);
    expect(summary.attempted).toBeGreaterThanOrEqual(0);
    expect(queue.countByStatus('failed')).toBe(0);
    expect(queue.size).toBe(0);
  });
});
