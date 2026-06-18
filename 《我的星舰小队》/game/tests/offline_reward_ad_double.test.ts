import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState, PlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger, RewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DEFAULT_OFFLINE_REWARD_CONFIG,
  claimOfflineReward,
} from '../assets/scripts/core/OfflineRewardService';
import { claimOfflineRewardDoubleViaAd } from '../assets/scripts/core/OfflineRewardDoubleService';
import { AdService, AdAdapter } from '../assets/scripts/ads/AdService';
import { MockAdAdapter, MockAdScenario } from '../assets/scripts/ads/MockAdAdapter';
import { AdFrequencyService } from '../assets/scripts/ads/AdFrequencyService';
import { AdRewardFlowService } from '../assets/scripts/ads/AdRewardFlowService';
import { AdConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
const MS_PER_HOUR = 60 * 60 * 1000;
const BASE_TIME = 1_700_000_000_000;
const RATE = DEFAULT_OFFLINE_REWARD_CONFIG.baseRate; // starCoin 600/h, expChip 120/h

function progressedPlayerState(): PlayerState {
  const state = createInitialPlayerState();
  state.clearedLevelIds = ['1-1'];
  return state;
}

function sampleAdConfigs(): AdConfig[] {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, 'ad_config.sample.json'), 'utf-8')) as AdConfig[];
}

/** 定制广告位（cooldown 0、额度充足），隔离限频/冷却以专注离线翻倍逻辑。 */
function offlineAdCfg(overrides: Partial<AdConfig> = {}): AdConfig {
  return {
    schemaVersion: '0.1.0',
    adSlotId: 'ad_offline_double',
    adType: 'rewarded_video',
    entry: 'offline_reward_double',
    rewardId: 'rw_ad_offline_double',
    dailyLimit: 5,
    sessionLimit: 5,
    cooldownSec: 0,
    activeTriggerOnly: true,
    allowRetryOnFail: true,
    flowKeyPrefix: 'ad_offline_double',
    ...overrides,
  };
}

function buildAdFlow(adConfigs: AdConfig[], scenario: MockAdScenario): AdRewardFlowService {
  const adService = new AdService(new MockAdAdapter(scenario));
  const frequency = new AdFrequencyService(adConfigs);
  return new AdRewardFlowService(adService, frequency, adConfigs);
}

/** 同上，但统计广告 show（实际播放）次数，用于验证重试不重播广告。 */
function buildAdFlowCounting(adConfigs: AdConfig[], scenario: MockAdScenario) {
  const base = new MockAdAdapter(scenario);
  const counter = { shows: 0 };
  const adapter: AdAdapter = {
    load: (request) => base.load(request),
    show: (request, emit) => {
      counter.shows += 1;
      base.show(request, emit);
    },
  };
  const adFlow = new AdRewardFlowService(new AdService(adapter), new AdFrequencyService(adConfigs), adConfigs);
  return { adFlow, counter };
}

function doubleParams(
  playerState: PlayerState,
  rewardLedger: RewardLedger,
  adFlow: AdRewardFlowService,
  overrides: Partial<Parameters<typeof claimOfflineRewardDoubleViaAd>[0]> = {},
) {
  return {
    lastOnlineTime: BASE_TIME,
    now: BASE_TIME + 3 * MS_PER_HOUR,
    hasProgress: true,
    playerState,
    rewardLedger,
    adFlow,
    ...overrides,
  };
}

describe('OfflineRewardDouble - 1 倍路径不受影响', () => {
  it('未看广告仍可领 1 倍（C11 行为不变）', () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const one = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
    });
    expect(one.granted).toBe(true);
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3);
  });
});

describe('OfflineRewardDouble - 广告完成后领 2 倍', () => {
  it('广告 completed -> 领 2 倍，资源翻倍，离线流水与广告 flow 均 confirmed', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow(sampleAdConfigs(), { play: 'completed' }); // 用冻结样例配置

    const r = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));

    expect(r.status).toBe('granted_double');
    expect(r.granted).toBe(true);
    expect(r.doubledReward.starCoin).toBe(RATE.starCoinPerHour * 3 * 2);
    expect(r.doubledReward.expChip).toBe(RATE.expChipPerHour * 3 * 2);
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3 * 2);
    expect(ps.resources.expChip).toBe(RATE.expChipPerHour * 3 * 2);
    expect(r.nextLastOnlineTime).toBe(BASE_TIME + 3 * MS_PER_HOUR);

    const offlineEntry = ledger.entries.find((e) => e.flowId === r.offlineFlowId);
    expect(offlineEntry?.status).toBe('confirmed');
    expect(ps.claimedRewardFlowIds).toContain(r.offlineFlowId);
    const adEntry = ledger.entries.find((e) => e.rewardId === 'rw_ad_offline_double');
    expect(adEntry?.status).toBe('confirmed');
  });
});

describe('OfflineRewardDouble - 广告中断/失败不能领 2 倍', () => {
  it('用户中断 -> ad_not_completed，不发奖，离线窗口未锁（之后仍可领 1 倍）', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'cancelled' });

    const r = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));
    expect(r.status).toBe('ad_not_completed');
    expect(r.granted).toBe(false);
    expect(ps.resources.starCoin).toBe(0);

    const one = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
    });
    expect(one.granted).toBe(true);
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3);
  });

  it('加载失败 / 播放失败 -> ad_not_completed 且可重试，不发奖', async () => {
    for (const scenario of [{ play: 'failed' } as MockAdScenario, { load: 'load_failed' } as MockAdScenario]) {
      const ps = progressedPlayerState();
      const ledger = createRewardLedger();
      const adFlow = buildAdFlow([offlineAdCfg()], scenario);

      const r = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));
      expect(r.status).toBe('ad_not_completed');
      expect(r.retryable).toBe(true);
      expect(ps.resources.starCoin).toBe(0);
    }
  });
});

describe('OfflineRewardDouble - 同一离线周期不能重复领取（1 倍/2 倍互斥）', () => {
  it('2 倍后再 2 倍同窗口 -> already_claimed', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });

    expect((await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow))).status).toBe('granted_double');
    const r2 = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));
    expect(r2.status).toBe('already_claimed');
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3 * 2); // 未再加
  });

  it('先领 1 倍，再请求 2 倍 -> already_claimed（不播广告）', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const one = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
    });
    expect(one.granted).toBe(true);

    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });
    const r2 = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));
    expect(r2.status).toBe('already_claimed');
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3); // 只有 1 倍
    // 未播广告：不应有广告流水
    expect(ledger.entries.some((e) => e.rewardId === 'rw_ad_offline_double')).toBe(false);
  });

  it('先领 2 倍，再领 1 倍 -> 1 倍判重拒绝', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });
    expect((await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow))).status).toBe('granted_double');

    const one = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
    });
    expect(one.granted).toBe(false);
    expect(one.duplicate).toBe(true);
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3 * 2); // 只有 2 倍
  });
});

describe('OfflineRewardDouble - 不突破 8 小时封顶', () => {
  it('离线 20 小时按 8 小时封顶后再翻倍（时长不放大）', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });

    const r = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 20 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
    });

    expect(r.status).toBe('granted_double');
    expect(r.calculation.capped).toBe(true);
    expect(r.calculation.cappedHours).toBe(DEFAULT_OFFLINE_REWARD_CONFIG.maxOfflineHours);
    expect(r.doubledReward.starCoin).toBe(RATE.starCoinPerHour * 8 * 2);
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 8 * 2);
  });
});

describe('OfflineRewardDouble - 发奖失败可重试', () => {
  it('应用失败 -> grant_failed（离线流水/广告 flow 置 failed、不加资源），重试后 granted_double', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });

    const r1 = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow, { applyReward: () => false }));
    expect(r1.status).toBe('grant_failed');
    expect(r1.retryable).toBe(true);
    expect(ps.resources.starCoin).toBe(0);
    expect(ledger.entries.find((e) => e.flowId === r1.offlineFlowId)?.status).toBe('failed');
    expect(ledger.entries.some((e) => e.rewardId === 'rw_ad_offline_double' && e.status === 'failed')).toBe(true);

    const r2 = await claimOfflineRewardDoubleViaAd(doubleParams(ps, ledger, adFlow));
    expect(r2.status).toBe('granted_double');
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3 * 2);
  });

  it('cooldownSec=300 下，发奖失败后立即重试复用已完成广告：不重播、不再消耗次数、不被冷却拦截', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    // 用冻结样例 ad_config（ad_offline_double cooldownSec=300, sessionLimit=2）。
    const { adFlow, counter } = buildAdFlowCounting(sampleAdConfigs(), { play: 'completed' });
    const now = BASE_TIME + 3 * MS_PER_HOUR;

    const r1 = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: BASE_TIME,
      now,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
      applyReward: () => false,
    });
    expect(r1.status).toBe('grant_failed');
    expect(r1.retryable).toBe(true);
    expect(counter.shows).toBe(1);
    expect(ps.resources.starCoin).toBe(0);

    // 立刻重试：同一 now（真实 300s 冷却未过、会话也未释放），默认 apply 成功。
    const r2 = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: BASE_TIME,
      now,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
    });
    expect(r2.status).toBe('granted_double');
    expect(counter.shows).toBe(1); // 关键：未再播放广告
    expect(ps.resources.starCoin).toBe(RATE.starCoinPerHour * 3 * 2);
    expect(ps.resources.expChip).toBe(RATE.expChipPerHour * 3 * 2);

    // 重新应用成功后：离线流水与广告 flow 均 confirmed。
    expect(ledger.entries.find((e) => e.flowId === r2.offlineFlowId)?.status).toBe('confirmed');
    expect(ledger.entries.some((e) => e.rewardId === 'rw_ad_offline_double' && e.status === 'confirmed')).toBe(true);
  });
});

describe('OfflineRewardDouble - 新离线窗口可再次 2 倍 / 无收益不播广告', () => {
  it('推进窗口后新窗口可再次领 2 倍', async () => {
    const ps = progressedPlayerState();
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });

    const r1 = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
    });
    expect(r1.status).toBe('granted_double');

    const w2Start = r1.nextLastOnlineTime;
    const r2 = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: w2Start,
      now: w2Start + 2 * MS_PER_HOUR,
      hasProgress: true,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
    });
    expect(r2.status).toBe('granted_double');
    expect(r2.doubledReward.starCoin).toBe(RATE.starCoinPerHour * 2 * 2);
  });

  it('无可领取（无进度）时直接返回 nothing_to_claim，不播广告', async () => {
    const ps = createInitialPlayerState(); // 无 clearedLevelIds
    const ledger = createRewardLedger();
    const adFlow = buildAdFlow([offlineAdCfg()], { play: 'completed' });

    const r = await claimOfflineRewardDoubleViaAd({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: false,
      playerState: ps,
      rewardLedger: ledger,
      adFlow,
    });
    expect(r.status).toBe('nothing_to_claim');
    expect(ledger.entries).toHaveLength(0);
  });
});
