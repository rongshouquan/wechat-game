import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState, PlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger, RewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DefeatSupplyService,
  DefeatSupplyOptions,
  DefeatSupplyParams,
  DEFAULT_MAX_SUPPLIES_PER_BOSS_PER_DAY,
} from '../assets/scripts/core/DefeatSupplyService';
import { analyzeDefeatAndBuildRecovery, DefeatAnalysisContext } from '../assets/scripts/core/DefeatAnalysisService';
import { AdService, AdAdapter } from '../assets/scripts/ads/AdService';
import { MockAdAdapter, MockAdScenario } from '../assets/scripts/ads/MockAdAdapter';
import { AdFrequencyService } from '../assets/scripts/ads/AdFrequencyService';
import { AdRewardFlowService } from '../assets/scripts/ads/AdRewardFlowService';
import { AdConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
const NOW = Date.UTC(2026, 5, 9, 12, 0, 0);

function sampleAdConfigs(): AdConfig[] {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, 'ad_config.sample.json'), 'utf-8')) as AdConfig[];
}

function defeatAdCfg(overrides: Partial<AdConfig> = {}): AdConfig {
  return {
    schemaVersion: '0.1.0',
    adSlotId: 'ad_defeat_supply',
    adType: 'rewarded_video',
    entry: 'defeat_supply',
    rewardId: 'rw_ad_defeat_supply',
    dailyLimit: 5,
    sessionLimit: 5,
    cooldownSec: 0,
    activeTriggerOnly: true,
    allowRetryOnFail: true,
    flowKeyPrefix: 'ad_defeat_supply',
    ...overrides,
  };
}

function buildSupply(adConfigs: AdConfig[], scenario: MockAdScenario, options?: DefeatSupplyOptions): DefeatSupplyService {
  const adService = new AdService(new MockAdAdapter(scenario));
  const adFlow = new AdRewardFlowService(adService, new AdFrequencyService(adConfigs), adConfigs);
  return new DefeatSupplyService(adFlow, adConfigs, options);
}

/** 统计广告 show 次数的版本，用于验证复用重试不重播广告。 */
function buildSupplyCounting(adConfigs: AdConfig[], scenario: MockAdScenario, options?: DefeatSupplyOptions) {
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
  return { supply: new DefeatSupplyService(adFlow, adConfigs, options), counter };
}

function ctx(
  playerState: PlayerState,
  rewardLedger: RewardLedger,
  overrides: Partial<DefeatSupplyParams> = {},
): DefeatSupplyParams {
  return {
    rewardLedger,
    playerState,
    request: { contextId: 'defeat_1-10_attempt1', bossKey: 'boss_1-10' },
    now: NOW,
    ...overrides,
  };
}

/** 应用补给：加 50 能量并计数，便于断言"是否真的发了补给"。 */
function makeApplySupply() {
  const calls = { count: 0 };
  const applySupply = (s: PlayerState) => {
    calls.count += 1;
    s.resources.baseEnergy += 50;
    return true;
  };
  return { applySupply, calls };
}

describe('DefeatSupply - 非广告路径仍可用（C10 不受影响）', () => {
  it('analyzeDefeatAndBuildRecovery 仍返回 >=2 条非广告挽留路径', () => {
    const context: DefeatAnalysisContext = {
      report: {
        winner: 'enemy',
        durationSec: 30,
        failReason: 'all_players_down',
        totalDamage: 1000,
        totalHealing: 0,
        damageTakenByUnit: [],
        skillCastCounts: [],
      },
      levelId: '1-10',
      squad: [
        { unitId: 'u1', heroId: 'h1', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 10 },
        { unitId: 'u2', heroId: 'h2', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 10 },
        { unitId: 'u3', heroId: 'h3', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
        { unitId: 'u4', heroId: 'h4', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
        { unitId: 'u5', heroId: 'h5', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 10 },
      ],
      recommendedPower: 500,
    };
    const recovery = analyzeDefeatAndBuildRecovery(context, '1-9');
    expect(recovery.retryPaths.length).toBeGreaterThanOrEqual(2);
    // 非广告路径：每条都属于 C10 的非广告挽留类型，不含任何"看广告"达成方式。
    const nonAdTypes = ['one_tap_upgrade', 'adjust_formation', 'replay_previous_level', 'switch_hero'];
    for (const p of recovery.retryPaths) {
      expect(nonAdTypes).toContain(p.type);
    }
  });
});

describe('DefeatSupply - 广告完成后发补给', () => {
  it('广告 completed -> granted，applySupply 调用一次，补给流水 confirmed，同 Boss 次数 +1', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const { applySupply, calls } = makeApplySupply();
    const supply = buildSupply(sampleAdConfigs(), { play: 'completed' }); // 用冻结样例配置

    const r = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }));

    expect(r.status).toBe('granted');
    expect(r.granted).toBe(true);
    expect(calls.count).toBe(1);
    expect(ps.resources.baseEnergy).toBe(50);
    expect(r.flowKey).toBe('ad_defeat_supply_defeat_1-10_attempt1');
    const entry = ledger.entries.find((e) => e.flowId === r.supplyFlowId);
    expect(entry?.status).toBe('confirmed');
    expect(entry?.rewardId).toBe('rw_ad_defeat_supply');
    expect(supply.bossCount('boss_1-10', NOW)).toBe(1);
  });
});

describe('DefeatSupply - 中断/失败不发补给', () => {
  it('用户中断 -> ad_not_completed，不发补给', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const { applySupply, calls } = makeApplySupply();
    const supply = buildSupply([defeatAdCfg()], { play: 'cancelled' });

    const r = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }));
    expect(r.status).toBe('ad_not_completed');
    expect(r.granted).toBe(false);
    expect(calls.count).toBe(0);
    expect(ps.resources.baseEnergy).toBe(0);
    expect(supply.bossCount('boss_1-10', NOW)).toBe(0);
  });

  it('加载失败 / 播放失败 -> ad_not_completed 且可重试，不发补给', async () => {
    for (const scenario of [{ play: 'failed' } as MockAdScenario, { load: 'load_failed' } as MockAdScenario]) {
      const ps = createInitialPlayerState();
      const ledger = createRewardLedger();
      const supply = buildSupply([defeatAdCfg()], scenario);
      const r = await supply.requestSupplyViaAd(ctx(ps, ledger));
      expect(r.status).toBe('ad_not_completed');
      expect(r.retryable).toBe(true);
      expect(r.granted).toBe(false);
    }
  });
});

describe('DefeatSupply - 同一失败上下文重复回调不重复发奖', () => {
  it('同一 contextId 再次请求 -> already_claimed，补给只发一次', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const { applySupply, calls } = makeApplySupply();
    const supply = buildSupply([defeatAdCfg()], { play: 'completed' });

    expect((await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }))).status).toBe('granted');
    const second = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }));
    expect(second.status).toBe('already_claimed');
    expect(calls.count).toBe(1);
    expect(ps.resources.baseEnergy).toBe(50);
    expect(supply.bossCount('boss_1-10', NOW)).toBe(1);
  });

  it('SDK 重复回调（completed 触发两次）只发一次补给、只生成一条流水', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const { applySupply, calls } = makeApplySupply();
    const supply = buildSupply([defeatAdCfg()], { play: 'completed', duplicateCallback: true });

    const r = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }));
    expect(r.status).toBe('granted');
    expect(calls.count).toBe(1);
    const confirmed = ledger.entries.filter((e) => e.rewardId === 'rw_ad_defeat_supply' && e.status === 'confirmed');
    expect(confirmed).toHaveLength(1);
  });
});

describe('DefeatSupply - 超每日 / 同 Boss 上限拒绝', () => {
  it('超广告每日上限 -> rejected_frequency(daily_limit)', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    // 每日仅 1 次广告；Boss 上限放宽，用不同 Boss 隔离，专测每日上限。
    const supply = buildSupply([defeatAdCfg({ dailyLimit: 1, sessionLimit: 5 })], { play: 'completed' }, {
      maxSuppliesPerBossPerDay: 5,
    });

    const first = await supply.requestSupplyViaAd(ctx(ps, ledger, { request: { contextId: 'c1', bossKey: 'bossA' } }));
    expect(first.status).toBe('granted');
    const second = await supply.requestSupplyViaAd(ctx(ps, ledger, { request: { contextId: 'c2', bossKey: 'bossB' } }));
    expect(second.status).toBe('rejected_frequency');
    expect(second.frequencyReason).toBe('daily_limit');
  });

  it('超同 Boss 每日上限 -> boss_limit（每日额度仍有余）', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const supply = buildSupply([defeatAdCfg({ dailyLimit: 9, sessionLimit: 9 })], { play: 'completed' }, {
      maxSuppliesPerBossPerDay: 1,
    });

    const first = await supply.requestSupplyViaAd(ctx(ps, ledger, { request: { contextId: 'c1', bossKey: 'boss_1-10' } }));
    expect(first.status).toBe('granted');
    // 同 Boss、不同失败上下文 -> 被同 Boss 每日上限拦截
    const second = await supply.requestSupplyViaAd(ctx(ps, ledger, { request: { contextId: 'c2', bossKey: 'boss_1-10' } }));
    expect(second.status).toBe('boss_limit');
  });

  it('默认同 Boss 每日上限为保守值 1', () => {
    expect(DEFAULT_MAX_SUPPLIES_PER_BOSS_PER_DAY).toBe(1);
  });
});

describe('DefeatSupply - 发奖失败复用重试（C26 语义）', () => {
  it('cooldownSec=300 下应用失败后立即重试复用已完成广告：不重播、不再计 Boss/每日次数', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    // 用冻结样例配置（cooldownSec=300），但放宽同 Boss 上限以便复用重试可达成。
    const { supply, counter } = buildSupplyCounting(sampleAdConfigs(), { play: 'completed' }, {
      maxSuppliesPerBossPerDay: 2,
    });

    const r1 = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply: () => false }));
    expect(r1.status).toBe('grant_failed');
    expect(r1.retryable).toBe(true);
    expect(counter.shows).toBe(1);
    expect(supply.bossCount('boss_1-10', NOW)).toBe(1); // 广告已看一次

    const { applySupply, calls } = makeApplySupply();
    const r2 = await supply.requestSupplyViaAd(ctx(ps, ledger, { applySupply }));
    expect(r2.status).toBe('granted');
    expect(counter.shows).toBe(1); // 关键：未再播放广告
    expect(calls.count).toBe(1);
    expect(ps.resources.baseEnergy).toBe(50);
    expect(supply.bossCount('boss_1-10', NOW)).toBe(1); // 复用不再计 Boss 次数

    const entry = ledger.entries.find((e) => e.flowId === r2.supplyFlowId);
    expect(entry?.status).toBe('confirmed');
  });
});

describe('DefeatSupply - 未知广告位', () => {
  it('未配置广告位 -> unknown_slot，不发补给', async () => {
    const ps = createInitialPlayerState();
    const ledger = createRewardLedger();
    const supply = buildSupply([defeatAdCfg()], { play: 'completed' }, { adSlotId: 'ad_not_exist' });
    const r = await supply.requestSupplyViaAd(ctx(ps, ledger));
    expect(r.status).toBe('unknown_slot');
    expect(ledger.entries).toHaveLength(0);
  });
});
