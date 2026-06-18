import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdService } from '../assets/scripts/ads/AdService';
import { MockAdAdapter, MockAdScenario, MockScenarioResolver } from '../assets/scripts/ads/MockAdAdapter';
import { AdFrequencyService, AdFrequencyState } from '../assets/scripts/ads/AdFrequencyService';
import { AdRewardFlowService } from '../assets/scripts/ads/AdRewardFlowService';
import { createRewardLedger, RewardLedger } from '../assets/scripts/core/RewardLedger';
import { AdConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
const DAY_MS = 86_400_000;
const T = Date.UTC(2026, 5, 9, 12, 0, 0); // 固定 UTC 时刻，便于跨日/冷却推算

function adConfig(overrides: Partial<AdConfig> = {}): AdConfig {
  return {
    schemaVersion: '0.1.0',
    adSlotId: 'ad_test',
    adType: 'rewarded_video',
    entry: 'offline_reward_double',
    rewardId: 'rw_ad_offline_double',
    dailyLimit: 3,
    sessionLimit: 2,
    cooldownSec: 300,
    activeTriggerOnly: true,
    allowRetryOnFail: true,
    flowKeyPrefix: 'ad_test',
    ...overrides,
  };
}

function services(cfg: AdConfig, scenario: MockAdScenario | MockScenarioResolver, initialState?: AdFrequencyState) {
  const adService = new AdService(new MockAdAdapter(scenario));
  const frequency = new AdFrequencyService([cfg], initialState);
  const flow = new AdRewardFlowService(adService, frequency, [cfg]);
  return { frequency, flow };
}

function req(cfg: AdConfig, opportunityId: string) {
  return { adSlotId: cfg.adSlotId, opportunityId };
}

function grantedCount(ledger: RewardLedger): number {
  return ledger.entries.filter((e) => e.status === 'granted' || e.status === 'confirmed').length;
}

describe('AdFrequencyService（限频判定）', () => {
  it('超每日上限拒绝（daily_limit）', () => {
    const cfg = adConfig({ dailyLimit: 2, sessionLimit: 5, cooldownSec: 0 });
    const frequency = new AdFrequencyService([cfg]);
    frequency.recordCompleted(cfg.adSlotId, T);
    frequency.recordCompleted(cfg.adSlotId, T);
    const d = frequency.canRequest(cfg.adSlotId, T);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('daily_limit');
    expect(d.remainingDaily).toBe(0);
  });

  it('超单会话上限拒绝（session_limit），每日仍有余量', () => {
    const cfg = adConfig({ dailyLimit: 5, sessionLimit: 2, cooldownSec: 0 });
    const frequency = new AdFrequencyService([cfg]);
    frequency.recordCompleted(cfg.adSlotId, T);
    frequency.recordCompleted(cfg.adSlotId, T);
    const d = frequency.canRequest(cfg.adSlotId, T);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('session_limit');
    expect(d.remainingDaily).toBe(3);
    expect(d.remainingSession).toBe(0);
  });

  it('冷却未结束拒绝，冷却结束后放行', () => {
    const cfg = adConfig({ dailyLimit: 5, sessionLimit: 5, cooldownSec: 300 });
    const frequency = new AdFrequencyService([cfg]);
    frequency.recordCompleted(cfg.adSlotId, T);

    const during = frequency.canRequest(cfg.adSlotId, T + 100_000);
    expect(during.allowed).toBe(false);
    expect(during.reason).toBe('cooldown');
    expect(during.cooldownRemainingMs).toBe(200_000);

    const after = frequency.canRequest(cfg.adSlotId, T + 300_000);
    expect(after.allowed).toBe(true);
  });

  it('跨自然日后每日次数重置', () => {
    const cfg = adConfig({ dailyLimit: 1, sessionLimit: 9, cooldownSec: 300 });
    const frequency = new AdFrequencyService([cfg]);
    frequency.recordCompleted(cfg.adSlotId, T);
    expect(frequency.canRequest(cfg.adSlotId, T).reason).toBe('daily_limit');
    // 次日：每日计数重置、冷却早已结束
    expect(frequency.canRequest(cfg.adSlotId, T + DAY_MS).allowed).toBe(true);
  });

  it('getState 可导出每日计数，跨实例（重启）恢复后仍限频', () => {
    const cfg = adConfig({ dailyLimit: 1, sessionLimit: 9, cooldownSec: 0 });
    const first = new AdFrequencyService([cfg]);
    first.recordCompleted(cfg.adSlotId, T);
    const persisted = first.getState();

    const restored = new AdFrequencyService([cfg], persisted);
    const d = restored.canRequest(cfg.adSlotId, T);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('daily_limit');
  });
});

describe('AdRewardFlowService（异常矩阵 + 防重 flow）', () => {
  it('完整观看产出 granted reward flow（经 RewardLedger + flow key，未应用具体奖励）', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    const { flow, frequency } = services(cfg, { play: 'completed' });
    const ledger = createRewardLedger();

    const out = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(out.status).toBe('granted');
    expect(out.flowKey).toBe('ad_test_op1');
    expect(out.flowEntry?.sourceId).toBe('ad_test_op1');
    expect(out.flowEntry?.rewardId).toBe('rw_ad_offline_double');
    // granted 但未 confirm：等 C26-C28 应用奖励后 settle。
    expect(out.flowEntry?.status).toBe('granted');
    expect(grantedCount(ledger)).toBe(1);
    // 成功消耗一次。
    expect(frequency.canRequest(cfg.adSlotId, T).remainingDaily).toBe(cfg.dailyLimit - 1);
  });

  it('用户中断不发奖、不消耗成功次数（可重试）', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    const { flow, frequency } = services(cfg, { play: 'cancelled' });
    const ledger = createRewardLedger();

    const out = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(out.status).toBe('cancelled');
    expect(out.retryable).toBe(true);
    expect(ledger.entries).toHaveLength(0);
    expect(frequency.canRequest(cfg.adSlotId, T).remainingDaily).toBe(cfg.dailyLimit);
  });

  it('加载失败/播放失败可重试，不消耗成功次数；重试后可正常发奖', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    let scenario: MockAdScenario = { load: 'load_failed' };
    const { flow, frequency } = services(cfg, () => scenario);
    const ledger = createRewardLedger();

    const r1 = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(r1.status).toBe('load_failed');
    expect(r1.retryable).toBe(true);

    scenario = { play: 'failed', error: 'render_error' };
    const r2 = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(r2.status).toBe('failed');
    expect(r2.retryable).toBe(true);

    // 两次失败都不发奖、不消耗。
    expect(ledger.entries).toHaveLength(0);
    expect(frequency.canRequest(cfg.adSlotId, T).remainingDaily).toBe(cfg.dailyLimit);

    // 重试成功发奖。
    scenario = { play: 'completed' };
    const r3 = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(r3.status).toBe('granted');
    expect(grantedCount(ledger)).toBe(1);
  });

  it('SDK 重复回调（completed 触发两次）只生成一条 reward flow', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    const { flow } = services(cfg, { play: 'completed', duplicateCallback: true });
    const ledger = createRewardLedger();

    const out = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    expect(out.status).toBe('granted');
    expect(grantedCount(ledger)).toBe(1);
  });

  it('同一奖励机会重复领取（同 opportunityId）判重，不重复生成 flow、不重复消耗', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    const { flow, frequency } = services(cfg, { play: 'completed' });
    const ledger = createRewardLedger();

    const first = await flow.requestAdReward(ledger, req(cfg, 'offline_2026_06_09'), T);
    expect(first.status).toBe('granted');

    const second = await flow.requestAdReward(ledger, req(cfg, 'offline_2026_06_09'), T);
    expect(second.status).toBe('duplicate');
    expect(second.retryable).toBe(false);

    expect(grantedCount(ledger)).toBe(1);
    // 只消耗了一次成功次数。
    expect(frequency.canRequest(cfg.adSlotId, T).remainingDaily).toBe(cfg.dailyLimit - 1);
  });

  it('超频时直接拒绝、不播放广告（daily / session / cooldown）', async () => {
    // daily
    const dailyCfg = adConfig({ dailyLimit: 1, sessionLimit: 5, cooldownSec: 0, flowKeyPrefix: 'ad_d' });
    {
      const { flow } = services(dailyCfg, { play: 'completed' });
      const ledger = createRewardLedger();
      expect((await flow.requestAdReward(ledger, req(dailyCfg, 'a'), T)).status).toBe('granted');
      const rej = await flow.requestAdReward(ledger, req(dailyCfg, 'b'), T);
      expect(rej.status).toBe('rejected_frequency');
      expect(rej.frequencyReason).toBe('daily_limit');
      expect(grantedCount(ledger)).toBe(1);
    }
    // session
    const sessionCfg = adConfig({ dailyLimit: 5, sessionLimit: 1, cooldownSec: 0, flowKeyPrefix: 'ad_s' });
    {
      const { flow } = services(sessionCfg, { play: 'completed' });
      const ledger = createRewardLedger();
      expect((await flow.requestAdReward(ledger, req(sessionCfg, 'a'), T)).status).toBe('granted');
      const rej = await flow.requestAdReward(ledger, req(sessionCfg, 'b'), T);
      expect(rej.status).toBe('rejected_frequency');
      expect(rej.frequencyReason).toBe('session_limit');
    }
    // cooldown
    const cdCfg = adConfig({ dailyLimit: 5, sessionLimit: 5, cooldownSec: 300, flowKeyPrefix: 'ad_c' });
    {
      const { flow } = services(cdCfg, { play: 'completed' });
      const ledger = createRewardLedger();
      expect((await flow.requestAdReward(ledger, req(cdCfg, 'a'), T)).status).toBe('granted');
      const rej = await flow.requestAdReward(ledger, req(cdCfg, 'b'), T + 10_000);
      expect(rej.status).toBe('rejected_frequency');
      expect(rej.frequencyReason).toBe('cooldown');
      expect(rej.retryable).toBe(true);
      const ok = await flow.requestAdReward(ledger, req(cdCfg, 'b'), T + 300_000);
      expect(ok.status).toBe('granted');
    }
  });

  it('发奖失败可重试：settleReward(false) -> failed，重新应用后 settle(true) -> confirmed', async () => {
    const cfg = adConfig({ cooldownSec: 0 });
    const { flow } = services(cfg, { play: 'completed' });
    const ledger = createRewardLedger();

    const out = await flow.requestAdReward(ledger, req(cfg, 'op1'), T);
    const entry = out.flowEntry!;
    expect(entry.status).toBe('granted');

    flow.settleReward(entry, false);
    expect(entry.status).toBe('failed');

    flow.settleReward(entry, true);
    expect(entry.status).toBe('confirmed');
  });

  it('未知广告位返回 unknown_slot，不发奖', async () => {
    const cfg = adConfig();
    const { flow } = services(cfg, { play: 'completed' });
    const ledger = createRewardLedger();
    const out = await flow.requestAdReward(ledger, { adSlotId: 'ad_not_exist', opportunityId: 'x' }, T);
    expect(out.status).toBe('unknown_slot');
    expect(ledger.entries).toHaveLength(0);
  });

  it('以冻结样例 ad_config 驱动：ad_quick_cruise（daily2/session1）单会话 1 次后超会话', async () => {
    const sample = JSON.parse(
      readFileSync(path.join(CONFIG_DIR, 'ad_config.sample.json'), 'utf-8'),
    ) as AdConfig[];
    const cruise = sample.find((c) => c.adSlotId === 'ad_quick_cruise')!;
    const adService = new AdService(new MockAdAdapter({ play: 'completed' }));
    const frequency = new AdFrequencyService(sample);
    const flow = new AdRewardFlowService(adService, frequency, sample);
    const ledger = createRewardLedger();

    const r1 = await flow.requestAdReward(ledger, { adSlotId: cruise.adSlotId, opportunityId: 'level_1_1' }, T);
    expect(r1.status).toBe('granted');
    expect(r1.flowKey).toBe(`${cruise.flowKeyPrefix}_level_1_1`);

    const r2 = await flow.requestAdReward(ledger, { adSlotId: cruise.adSlotId, opportunityId: 'level_1_2' }, T);
    expect(r2.status).toBe('rejected_frequency');
    expect(r2.frequencyReason).toBe('session_limit');
  });
});
