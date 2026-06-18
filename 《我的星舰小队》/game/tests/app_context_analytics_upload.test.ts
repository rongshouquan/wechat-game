import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { MockAnalyticsUploadAdapter } from '../assets/scripts/analytics/MockAnalyticsUploadAdapter';
import { AnalyticsUploadEvent, P0_EVENT_SPECS } from '../assets/scripts/analytics/AnalyticsEventTypes';
import { AppContext, AppContextConfig } from '../assets/scripts/ui/presenter/AppContext';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');

const T0 = 1_700_000_000_000;

/** 构造一条合法 P0 上传事件（按 spec 补齐必填 levelId 与关键参数）。 */
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

function makeContext(overrides: Partial<AppContextConfig>): AppContext {
  const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [new LocalAnalyticsSink({ console: false })], now: () => T0 });
  return new AppContext({
    adapter: new MemoryStorageAdapter(),
    analytics,
    levels,
    rewards,
    ownedHeroIds: ['hero_isen'],
    onFieldHeroIds: ['hero_isen'],
    now: () => T0,
    ...overrides,
  });
}

describe('AppContext - 埋点上传 mock 队列接入（S5A-05）', () => {
  it('注入 adapter 后合法 P0 事件可入队并 flush 成功', async () => {
    const adapter = MockAnalyticsUploadAdapter.alwaysOk();
    const ctx = makeContext({ analyticsUploadAdapter: adapter });
    expect(ctx.analyticsUploadQueue).toBeDefined();

    const e1 = ctx.enqueueAnalyticsUploadEvent(makeEvent('tutorial_start'));
    const e2 = ctx.enqueueAnalyticsUploadEvent(makeEvent('stage_win'));
    expect(e1!.accepted).toBe(true);
    expect(e2!.accepted).toBe(true);

    const summary = await ctx.flushAnalyticsUploads(T0);
    expect(summary).toEqual({ attempted: 2, sent: 2, failed: 0 });
    expect(adapter.sentEvents).toHaveLength(2);
  });

  it('非法事件与含敏感硬件 ID 的事件被拒绝，不进入队列', () => {
    const ctx = makeContext({ analyticsUploadAdapter: MockAnalyticsUploadAdapter.alwaysOk() });

    // 缺通用必填字段 userId。
    const invalid = ctx.enqueueAnalyticsUploadEvent(makeEvent('stage_start', { userId: '' }));
    expect(invalid!.accepted).toBe(false);
    expect(invalid!.errors.length).toBeGreaterThan(0);

    // params 含敏感硬件 ID（imei）。
    const sensitive = ctx.enqueueAnalyticsUploadEvent(makeEvent('stage_start', { params: { imei: '123456789' } }));
    expect(sensitive!.accepted).toBe(false);
    expect(sensitive!.errors.some((x) => x.startsWith('sensitive_id_param:'))).toBe(true);

    expect(ctx.analyticsUploadQueue!.size).toBe(0);
  });

  it('上报失败后保留 failed/retryAt，到点后可重试成功', async () => {
    const adapter = MockAnalyticsUploadAdapter.failFirst(1, 'net_down');
    const ctx = makeContext({ analyticsUploadAdapter: adapter });
    ctx.enqueueAnalyticsUploadEvent(makeEvent('ad_complete'));

    // 第一次失败：failed + 退避 retryAt=T0+10s。
    const first = await ctx.flushAnalyticsUploads(T0);
    expect(first!.failed).toBe(1);
    const entry = ctx.analyticsUploadQueue!.snapshot()[0];
    expect(entry.status).toBe('failed');
    expect(entry.retryAt).toBe(T0 + 10_000);
    expect(entry.lastError).toBe('net_down');

    // 未到点不重试。
    const early = await ctx.flushAnalyticsUploads(T0 + 5_000);
    expect(early!.attempted).toBe(0);

    // 到点重试 -> 成功。
    const late = await ctx.flushAnalyticsUploads(T0 + 10_000);
    expect(late!.sent).toBe(1);
    expect(ctx.analyticsUploadQueue!.countByStatus('sent')).toBe(1);
  });

  it('未注入 adapter 时 enqueue/flush 安全返回 null，不影响现有行为', async () => {
    const ctx = makeContext({});
    expect(ctx.analyticsUploadQueue).toBeUndefined();
    expect(ctx.enqueueAnalyticsUploadEvent(makeEvent('stage_start'))).toBeNull();
    expect(await ctx.flushAnalyticsUploads(T0)).toBeNull();

    // 普通 persist 仍可用。
    ctx.playerState.resources.starCoin = 42;
    ctx.persist();
    expect(ctx.lastOnlineTime).toBe(T0);
  });
});
