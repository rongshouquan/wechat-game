import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdService, AdRequest, AdResult, AdResultStatus } from '../assets/scripts/ads/AdService';
import { MockAdAdapter } from '../assets/scripts/ads/MockAdAdapter';
import { AdConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function loadAdConfig(): AdConfig[] {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, 'ad_config.sample.json'), 'utf-8')) as AdConfig[];
}

/** 从样例配置构造广告请求，确保测试用的 adSlotId/adType/entry 与冻结 schema 一致。 */
function requestFrom(adSlotId: string): AdRequest {
  const row = loadAdConfig().find((r) => r.adSlotId === adSlotId);
  if (!row) throw new Error(`ad_config.sample.json 缺少 adSlotId=${adSlotId}`);
  return { adSlotId: row.adSlotId, adType: row.adType, entry: row.entry };
}

const offlineReq = requestFrom('ad_offline_double');

/** 收集 onResult 事件流，便于断言生命周期顺序。 */
function collector(): { events: AdResult[]; onResult: (r: AdResult) => void } {
  const events: AdResult[] = [];
  return { events, onResult: (r) => events.push(r) };
}

function statuses(events: AdResult[]): AdResultStatus[] {
  return events.map((e) => e.status);
}

describe('AdService + MockAdAdapter', () => {
  it('加载成功：load() 返回 loaded', async () => {
    const service = new AdService(new MockAdAdapter({ load: 'loaded' }));
    const result = await service.load(offlineReq);
    expect(result.status).toBe('loaded');
    expect(result.request).toEqual(offlineReq);
  });

  it('播放完成 completed：事件流 [loaded, completed]，终态 completed，不发奖（无奖励字段）', async () => {
    const service = new AdService(new MockAdAdapter({ load: 'loaded', play: 'completed' }));
    const { events, onResult } = collector();
    const result = await service.requestRewardedAd(offlineReq, onResult);

    expect(statuses(events)).toEqual(['loaded', 'completed']);
    // 结果对象只表达广告状态（status + request），不携带任何奖励发放信息。
    expect(result).toEqual({ status: 'completed', request: offlineReq });
  });

  it('用户中断 cancelled：终态 cancelled，事件流 [loaded, cancelled]', async () => {
    const service = new AdService(new MockAdAdapter({ load: 'loaded', play: 'cancelled' }));
    const { events, onResult } = collector();
    const result = await service.requestRewardedAd(offlineReq, onResult);

    expect(result.status).toBe('cancelled');
    expect(statuses(events)).toEqual(['loaded', 'cancelled']);
  });

  it('加载失败 load_failed：终态 load_failed，不进入播放（无 loaded/终态事件）', async () => {
    let showCalled = false;
    const adapter = new MockAdAdapter({ load: 'load_failed', error: 'no_fill' });
    const spied = new Proxy(adapter, {
      get(target, prop, receiver) {
        if (prop === 'show') {
          return (...args: Parameters<typeof target.show>) => {
            showCalled = true;
            return target.show(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const service = new AdService(spied);
    const { events, onResult } = collector();
    const result = await service.requestRewardedAd(offlineReq, onResult);

    expect(result.status).toBe('load_failed');
    expect(result.error).toBe('no_fill');
    expect(statuses(events)).toEqual(['load_failed']);
    expect(showCalled).toBe(false);
  });

  it('播放失败 failed：终态 failed，可重试（不消耗成功，结果不发奖）', async () => {
    const service = new AdService(new MockAdAdapter({ load: 'loaded', play: 'failed', error: 'render_error' }));
    const { events, onResult } = collector();
    const result = await service.requestRewardedAd(offlineReq, onResult);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('render_error');
    expect(statuses(events)).toEqual(['loaded', 'failed']);

    // 失败后可再次发起（mock 改为完成），不被前一次失败阻断。
    const retryService = new AdService(new MockAdAdapter({ load: 'loaded', play: 'completed' }));
    const retry = await retryService.requestRewardedAd(offlineReq);
    expect(retry.status).toBe('completed');
  });

  it('重复回调 duplicate_callback：完成只生效一次，重复回调被去重标记', async () => {
    const service = new AdService(
      new MockAdAdapter({ load: 'loaded', play: 'completed', duplicateCallback: true }),
    );
    const { events, onResult } = collector();
    const result = await service.requestRewardedAd(offlineReq, onResult);

    // 终态仍为单次 completed（不因重复回调再次完成）。
    expect(result.status).toBe('completed');
    expect(statuses(events)).toEqual(['loaded', 'completed', 'duplicate_callback']);
    expect(statuses(events).filter((s) => s === 'completed')).toHaveLength(1);
  });

  it('mock 可按 adSlotId / adType / entry 返回不同结果', async () => {
    // 按 adSlotId 区分
    const bySlot = MockAdAdapter.byAdSlotId({
      ad_offline_double: { load: 'loaded', play: 'completed' },
      ad_defeat_supply: { load: 'loaded', play: 'cancelled' },
      ad_quick_cruise: { load: 'load_failed' },
    });
    const slotService = new AdService(bySlot);
    expect((await slotService.requestRewardedAd(requestFrom('ad_offline_double'))).status).toBe('completed');
    expect((await slotService.requestRewardedAd(requestFrom('ad_defeat_supply'))).status).toBe('cancelled');
    expect((await slotService.requestRewardedAd(requestFrom('ad_quick_cruise'))).status).toBe('load_failed');

    // 按 entry 区分
    const byEntry = new AdService(
      new MockAdAdapter((req) => (req.entry === 'quick_cruise' ? { play: 'failed' } : { play: 'completed' })),
    );
    expect((await byEntry.requestRewardedAd(requestFrom('ad_quick_cruise'))).status).toBe('failed');
    expect((await byEntry.requestRewardedAd(requestFrom('ad_offline_double'))).status).toBe('completed');

    // 按 adType 区分
    const byType = new AdService(
      new MockAdAdapter((req) => (req.adType === 'rewarded_video' ? { play: 'completed' } : { play: 'cancelled' })),
    );
    expect((await byType.requestRewardedAd(offlineReq)).status).toBe('completed');
  });
});
