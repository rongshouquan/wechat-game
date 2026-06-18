import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState, PlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger, RewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  QuickCruiseService,
  QuickCruiseOptions,
  QuickCruiseParams,
} from '../assets/scripts/core/QuickCruiseService';
import { AdService, AdAdapter } from '../assets/scripts/ads/AdService';
import { MockAdAdapter, MockAdScenario } from '../assets/scripts/ads/MockAdAdapter';
import { AdFrequencyService } from '../assets/scripts/ads/AdFrequencyService';
import { AdRewardFlowService } from '../assets/scripts/ads/AdRewardFlowService';
import { AdConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function sampleAdConfigs(): AdConfig[] {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, 'ad_config.sample.json'), 'utf-8')) as AdConfig[];
}

function rewardConfigFor(rewardId: string): RewardConfig {
  const rows = JSON.parse(readFileSync(path.join(CONFIG_DIR, 'reward_config.sample.json'), 'utf-8')) as RewardConfig[];
  const row = rows.find((r) => r.rewardId === rewardId);
  if (!row) throw new Error(`reward_config.sample.json 缺少 ${rewardId}`);
  return row;
}

function quickAdCfg(overrides: Partial<AdConfig> = {}): AdConfig {
  return {
    schemaVersion: '0.1.0',
    adSlotId: 'ad_quick_cruise',
    adType: 'rewarded_video',
    entry: 'quick_cruise',
    rewardId: 'rw_ad_quick_cruise',
    dailyLimit: 5,
    sessionLimit: 5,
    cooldownSec: 0,
    activeTriggerOnly: true,
    allowRetryOnFail: true,
    flowKeyPrefix: 'ad_quick_cruise',
    ...overrides,
  };
}

function buildCruise(adConfigs: AdConfig[], scenario: MockAdScenario, options?: QuickCruiseOptions): QuickCruiseService {
  const adFlow = new AdRewardFlowService(new AdService(new MockAdAdapter(scenario)), new AdFrequencyService(adConfigs), adConfigs);
  return new QuickCruiseService(adFlow, adConfigs, options);
}

function buildCruiseCounting(adConfigs: AdConfig[], scenario: MockAdScenario, options?: QuickCruiseOptions) {
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
  return { cruise: new QuickCruiseService(adFlow, adConfigs, options), counter };
}

function clearedPlayerState(levelIds: string[] = ['1-5']): PlayerState {
  const s = createInitialPlayerState();
  s.clearedLevelIds = [...levelIds];
  return s;
}

function ctx(ps: PlayerState, ledger: RewardLedger, overrides: Partial<QuickCruiseParams> = {}): QuickCruiseParams {
  return {
    rewardLedger: ledger,
    playerState: ps,
    levelId: '1-5',
    contextId: 'cruise_1-5_1',
    cruiseReward: rewardConfigFor('rw_1_5'),
    now: NOW,
    ...overrides,
  };
}

describe('QuickCruise - 只允许已通关关卡', () => {
  it('未通关关卡拒绝 -> not_cleared，不播广告、不发奖', async () => {
    const ps = clearedPlayerState([]); // 未通关任何关卡
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg()], { play: 'completed' });

    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger));
    expect(r.status).toBe('not_cleared');
    expect(r.granted).toBe(false);
    expect(ledger.entries).toHaveLength(0);
    expect(ps.resources.starCoin).toBe(0);
  });
});

describe('QuickCruise - 已通关关卡广告完成后给巡航奖励（配置驱动，不重跑战斗）', () => {
  it('广告 completed -> granted，按 reward_config 折算产出，巡航流水 confirmed', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const reward = rewardConfigFor('rw_1_5');
    const cruise = buildCruise(sampleAdConfigs(), { play: 'completed' }); // 冻结样例配置

    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger, { cruiseReward: reward }));

    expect(r.status).toBe('granted');
    expect(r.granted).toBe(true);
    // 产出完全等于配置值（纯配置折算，无战斗随机产出）。
    expect(ps.resources.starCoin).toBe(reward.starCoin ?? 0);
    expect(ps.resources.expChip).toBe(reward.expChip ?? 0);
    expect(ps.resources.equipmentPart).toBe(reward.equipmentPart ?? 0);
    expect(r.flowKey).toBe('ad_quick_cruise_cruise_1-5_1');
    const entry = ledger.entries.find((e) => e.flowId === r.cruiseFlowId);
    expect(entry?.status).toBe('confirmed');
    expect(entry?.rewardId).toBe('rw_ad_quick_cruise');
  });

  it('产出配置驱动：换一份 reward_config 即改变产出', async () => {
    const ps = clearedPlayerState(['1-9']);
    const ledger = createRewardLedger();
    const reward = rewardConfigFor('rw_1_9');
    const cruise = buildCruise([quickAdCfg()], { play: 'completed' });

    await cruise.requestCruiseViaAd(ctx(ps, ledger, { levelId: '1-9', contextId: 'cruise_1-9_1', cruiseReward: reward }));
    expect(ps.resources.starCoin).toBe(reward.starCoin ?? 0);
    expect(ps.resources.equipmentPart).toBe(reward.equipmentPart ?? 0);
  });
});

describe('QuickCruise - 中断/失败不发奖', () => {
  it('用户中断 -> ad_not_completed，不发奖', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg()], { play: 'cancelled' });
    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger));
    expect(r.status).toBe('ad_not_completed');
    expect(ps.resources.starCoin).toBe(0);
  });

  it('加载失败 / 播放失败 -> ad_not_completed 且可重试，不发奖', async () => {
    for (const scenario of [{ play: 'failed' } as MockAdScenario, { load: 'load_failed' } as MockAdScenario]) {
      const ps = clearedPlayerState(['1-5']);
      const ledger = createRewardLedger();
      const cruise = buildCruise([quickAdCfg()], scenario);
      const r = await cruise.requestCruiseViaAd(ctx(ps, ledger));
      expect(r.status).toBe('ad_not_completed');
      expect(r.retryable).toBe(true);
      expect(ps.resources.starCoin).toBe(0);
    }
  });
});

describe('QuickCruise - 重复回调不重复发奖', () => {
  it('同一 contextId 再次请求 -> already_claimed，产出只发一次', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const reward = rewardConfigFor('rw_1_5');
    const cruise = buildCruise([quickAdCfg()], { play: 'completed' });

    expect((await cruise.requestCruiseViaAd(ctx(ps, ledger, { cruiseReward: reward }))).status).toBe('granted');
    const second = await cruise.requestCruiseViaAd(ctx(ps, ledger, { cruiseReward: reward }));
    expect(second.status).toBe('already_claimed');
    expect(ps.resources.starCoin).toBe(reward.starCoin ?? 0); // 未翻倍
  });

  it('SDK 重复回调（completed 触发两次）只发一次、只生成一条流水', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg()], { play: 'completed', duplicateCallback: true });
    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger));
    expect(r.status).toBe('granted');
    const confirmed = ledger.entries.filter((e) => e.rewardId === 'rw_ad_quick_cruise' && e.status === 'confirmed');
    expect(confirmed).toHaveLength(1);
  });
});

describe('QuickCruise - 超限/冷却拒绝', () => {
  it('超每日上限 -> rejected_frequency(daily_limit)', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg({ dailyLimit: 1, sessionLimit: 5 })], { play: 'completed' });
    expect((await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c1' }))).status).toBe('granted');
    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c2' }));
    expect(r.status).toBe('rejected_frequency');
    expect(r.frequencyReason).toBe('daily_limit');
  });

  it('超单会话上限 -> rejected_frequency(session_limit)（冻结样例 ad_quick_cruise sessionLimit=1）', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise(sampleAdConfigs(), { play: 'completed' });
    expect((await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c1' }))).status).toBe('granted');
    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c2' }));
    expect(r.status).toBe('rejected_frequency');
    expect(r.frequencyReason).toBe('session_limit');
  });

  it('冷却未结束 -> rejected_frequency(cooldown)，冷却结束后可巡航', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg({ dailyLimit: 9, sessionLimit: 9, cooldownSec: 300 })], { play: 'completed' });
    expect((await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c1', now: NOW }))).status).toBe('granted');
    const cooling = await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c2', now: NOW + 10_000 }));
    expect(cooling.status).toBe('rejected_frequency');
    expect(cooling.frequencyReason).toBe('cooldown');
    const ok = await cruise.requestCruiseViaAd(ctx(ps, ledger, { contextId: 'c2', now: NOW + 300_000 }));
    expect(ok.status).toBe('granted');
  });
});

describe('QuickCruise - 发奖失败复用重试（C26/C27 语义）', () => {
  it('cooldownSec=300 下应用失败后立即重试复用已完成广告：不重播、不再消耗次数', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const reward = rewardConfigFor('rw_1_5');
    const { cruise, counter } = buildCruiseCounting(sampleAdConfigs(), { play: 'completed' });

    const r1 = await cruise.requestCruiseViaAd(ctx(ps, ledger, { cruiseReward: reward, applyReward: () => false }));
    expect(r1.status).toBe('grant_failed');
    expect(r1.retryable).toBe(true);
    expect(counter.shows).toBe(1);
    expect(ps.resources.starCoin).toBe(0);

    const r2 = await cruise.requestCruiseViaAd(ctx(ps, ledger, { cruiseReward: reward }));
    expect(r2.status).toBe('granted');
    expect(counter.shows).toBe(1); // 关键：未再播放广告
    expect(ps.resources.starCoin).toBe(reward.starCoin ?? 0);
    const entry = ledger.entries.find((e) => e.flowId === r2.cruiseFlowId);
    expect(entry?.status).toBe('confirmed');
  });
});

describe('QuickCruise - 未知广告位', () => {
  it('未配置广告位 -> unknown_slot，不发奖', async () => {
    const ps = clearedPlayerState(['1-5']);
    const ledger = createRewardLedger();
    const cruise = buildCruise([quickAdCfg()], { play: 'completed' }, { adSlotId: 'ad_not_exist' });
    const r = await cruise.requestCruiseViaAd(ctx(ps, ledger));
    expect(r.status).toBe('unknown_slot');
    expect(ledger.entries).toHaveLength(0);
  });
});
