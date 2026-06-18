import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DEFAULT_SUPPLY_CONFIG,
  RandomSource,
  SupplyConfig,
  defaultRandomSource,
  drawSupply,
} from '../assets/scripts/core/SupplyService';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  SaveData,
  buildSaveDataFromState,
  loadSave,
  persistSave,
  restoreKeyState,
} from '../assets/scripts/save/SaveService';
import { AppContext } from '../assets/scripts/ui/presenter/AppContext';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

/** 固定值随机源（确定性，便于复现）。 */
function constSource(value: number): RandomSource {
  return () => value;
}

function energizedState(baseEnergy: number) {
  const state = createInitialPlayerState();
  state.resources.baseEnergy = baseEnergy;
  return state;
}

describe('SupplyService - 固定随机源抽取结果可复现', () => {
  it('rng=0 命中池首条，结果可复现', () => {
    const run = () => {
      const state = energizedState(100);
      const ledger = createRewardLedger();
      return drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0) });
    };
    const a = run();
    const b = run();

    expect(a.granted).toBe(true);
    expect(a.entryIndex).toBe(0);
    expect(a.fragments).toEqual({ hero_ryan: 2 });
    expect(a.entryIndex).toBe(b.entryIndex);
    expect(a.fragments).toEqual(b.fragments);
  });
});

describe('SupplyService - 配置注入改变命中结果', () => {
  it('同一 rng 下，不同 pool 配置命中不同条目', () => {
    const config: SupplyConfig = {
      costBaseEnergy: 10,
      minFragmentsPerDraw: 1,
      pityFragmentHeroId: 'hero_ryan',
      pool: [
        { weight: 1, fragments: [{ heroId: 'hero_a', count: 1 }] },
        { weight: 1, fragments: [{ heroId: 'hero_b', count: 1 }] },
      ],
    };

    const low = drawSupply({ playerState: energizedState(100), rewardLedger: createRewardLedger(), rng: constSource(0), config });
    const high = drawSupply({ playerState: energizedState(100), rewardLedger: createRewardLedger(), rng: constSource(0.75), config });

    expect(low.entryIndex).toBe(0);
    expect(low.fragments).toEqual({ hero_a: 1 });
    expect(high.entryIndex).toBe(1);
    expect(high.fragments).toEqual({ hero_b: 1 });
  });
});

describe('SupplyService - 保底碎片', () => {
  it('命中纯资源条目时仍补足 minFragmentsPerDraw 个保底碎片', () => {
    const config: SupplyConfig = {
      costBaseEnergy: 10,
      minFragmentsPerDraw: 3,
      pityFragmentHeroId: 'hero_ryan',
      pool: [{ weight: 1, resources: { starCoin: 100 } }],
    };
    const state = energizedState(100);
    const result = drawSupply({ playerState: state, rewardLedger: createRewardLedger(), rng: constSource(0), config });

    expect(result.granted).toBe(true);
    expect(result.fragments).toEqual({ hero_ryan: 3 });
    expect(state.heroFragments.hero_ryan).toBe(3);
    expect(result.resources).toEqual({ starCoin: 100 });
    expect(state.resources.starCoin).toBe(100);
    expect(result.log).toContain('supply_pity_fragment_applied');
  });
});

describe('SupplyService - baseEnergy 不足不能抽', () => {
  it('baseEnergy 不足时拒绝，不写流水、不扣费、不递增计数、不入账碎片', () => {
    const state = energizedState(10); // < 默认 cost 50
    const ledger = createRewardLedger();

    const result = drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0) });

    expect(result.granted).toBe(false);
    expect(result.insufficient).toBe(true);
    expect(ledger.entries.length).toBe(0);
    expect(state.resources.baseEnergy).toBe(10);
    expect(state.supplyDrawCount).toBe(0);
    expect(state.heroFragments).toEqual({});
    expect(result.log).toContain('supply_insufficient_base_energy');
  });
});

describe('SupplyService - 成功抽取入账', () => {
  it('扣 baseEnergy、碎片/资源入账、流水 confirmed、flowId 入账、supplyDrawCount++', () => {
    const config: SupplyConfig = {
      costBaseEnergy: 50,
      minFragmentsPerDraw: 1,
      pityFragmentHeroId: 'hero_ryan',
      pool: [{ weight: 1, fragments: [{ heroId: 'hero_mia', count: 2 }], resources: { starCoin: 30 } }],
    };
    const state = energizedState(100);
    const ledger = createRewardLedger();

    const result = drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0), config });

    expect(result.granted).toBe(true);
    expect(state.resources.baseEnergy).toBe(50);
    expect(state.heroFragments.hero_mia).toBe(2);
    expect(state.resources.starCoin).toBe(30);
    expect(state.supplyDrawCount).toBe(1);
    expect(result.nextSupplyDrawCount).toBe(1);
    expect(result.flowId).toBeDefined();
    expect(state.claimedRewardFlowIds).toContain(result.flowId);
    const entry = ledger.entries.find((e) => e.flowId === result.flowId);
    expect(entry?.status).toBe('confirmed');
    expect(entry?.sourceId).toBe('supply_0');
    expect(entry?.rewardId).toBe('supply_draw');
    expect(result.log).toContain('supply_draw_granted');
  });
});

describe('SupplyService - 同一 supplyDrawCount 重放防重', () => {
  it('同一序号重放被 duplicate 拒绝，不二次扣费/入账/递增', () => {
    const state = energizedState(200);
    const ledger = createRewardLedger();

    const first = drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0) });
    expect(first.granted).toBe(true);
    expect(state.resources.baseEnergy).toBe(150);
    const fragmentsAfterFirst = { ...state.heroFragments };

    // 模拟同一 supplyDrawCount 重放（计数回退但流水 supply_0 已存在）
    state.supplyDrawCount = 0;
    const second = drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0) });

    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(state.resources.baseEnergy).toBe(150); // 未二次扣费
    expect(state.heroFragments).toEqual(fragmentsAfterFirst); // 未二次入账
    expect(state.supplyDrawCount).toBe(0); // 未递增
    expect(second.log).toContain('supply_duplicate_rejected');
  });
});

describe('SupplyService - 多次抽取碎片累计', () => {
  it('连续抽取后 heroFragments 正确累计、计数递增', () => {
    const state = energizedState(200);
    const ledger = createRewardLedger();
    const rng = constSource(0); // 默认池首条 hero_ryan +2

    drawSupply({ playerState: state, rewardLedger: ledger, rng });
    drawSupply({ playerState: state, rewardLedger: ledger, rng });
    drawSupply({ playerState: state, rewardLedger: ledger, rng });

    expect(state.heroFragments.hero_ryan).toBe(6);
    expect(state.supplyDrawCount).toBe(3);
    expect(state.resources.baseEnergy).toBe(50);
    expect(ledger.entries.filter((e) => e.status === 'confirmed').length).toBe(3);
  });

  it('defaultRandomSource 返回 [0,1)', () => {
    for (let i = 0; i < 20; i += 1) {
      const v = defaultRandomSource();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('SupplyService - 存档迁移 v3 -> v4', () => {
  it('回填 heroFragments/ownedHeroIds/supplyDrawCount/craftCount，并保留旧字段', () => {
    const adapter = new MemoryStorageAdapter();

    // 构造一份 v3 旧档：缺 C20 四字段，但有 resources/equipments/miningStation/等
    const base = createInitialPlayerState();
    base.resources.starCoin = 888;
    base.resources.baseEnergy = 7;
    base.heroLevels = { hero_isen: 4 };
    base.clearedLevelIds = ['1-1', '1-2', '1-3'];
    base.claimedRewardFlowIds = ['flow_x'];
    base.miningStation = { unlocked: true, lastCollectTime: 123456 };
    const legacyPlayerState: any = { ...base };
    delete legacyPlayerState.heroFragments;
    delete legacyPlayerState.ownedHeroIds;
    delete legacyPlayerState.supplyDrawCount;
    delete legacyPlayerState.craftCount;

    // v3 旧档：缺 C20 系列字段，且天然缺 v6 才引入的 adFrequencyState/defeatSupplyState 顶层字段。
    const v3Save = {
      saveVersion: 3,
      playerState: legacyPlayerState,
      rewardLedger: createRewardLedger(),
      lastOnlineTime: 1000,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v3Save));

    const result = loadSave(adapter, 2000);
    const ps = result.data.playerState;

    expect(result.migrated).toBe(true);
    expect(result.corrupted).toBe(false);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    // 回填 C20 四字段
    expect(ps.heroFragments).toEqual({});
    expect(ps.ownedHeroIds).toEqual([]);
    expect(ps.supplyDrawCount).toBe(0);
    expect(ps.craftCount).toBe(0);
    // 既有字段不丢失
    expect(ps.resources.starCoin).toBe(888);
    expect(ps.resources.baseEnergy).toBe(7);
    expect(ps.heroLevels).toEqual({ hero_isen: 4 });
    expect(ps.clearedLevelIds).toEqual(['1-1', '1-2', '1-3']);
    expect(ps.claimedRewardFlowIds).toEqual(['flow_x']);
    expect(ps.equipments).toBeDefined();
    expect(ps.miningStation).toEqual({ unlocked: true, lastCollectTime: 123456 });
  });
});

describe('SupplyService - 含新字段存档 persist/load 往返保真', () => {
  it('heroFragments/ownedHeroIds/supplyDrawCount/craftCount 往返保真', () => {
    const adapter = new MemoryStorageAdapter();
    const state = createInitialPlayerState();
    state.heroFragments = { hero_ryan: 5, hero_mia: 3 };
    state.ownedHeroIds = ['hero_isen'];
    state.supplyDrawCount = 2;
    state.craftCount = 1;
    const ledger = createRewardLedger();

    persistSave(adapter, buildSaveDataFromState(state, ledger, 5000), 5000);
    const reloaded = restoreKeyState(loadSave(adapter, 6000).data);

    expect(reloaded.playerState.heroFragments).toEqual({ hero_ryan: 5, hero_mia: 3 });
    expect(reloaded.playerState.ownedHeroIds).toEqual(['hero_isen']);
    expect(reloaded.playerState.supplyDrawCount).toBe(2);
    expect(reloaded.playerState.craftCount).toBe(1);
  });
});

describe('AppContext - ownedHeroIds 真源为 playerState，config 仅作 seed', () => {
  const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
  const levels = JSON.parse(readFileSync(path.join(CONFIG_DIR, 'level_config.sample.json'), 'utf-8')) as LevelConfig[];
  const rewards = JSON.parse(readFileSync(path.join(CONFIG_DIR, 'reward_config.sample.json'), 'utf-8')) as RewardConfig[];

  function makeCtx(adapter: MemoryStorageAdapter, seed: string[], now = 1000): AppContext {
    const analytics = new AnalyticsService({ sessionId: 's', sinks: [new LocalAnalyticsSink({ console: false })], now: () => now });
    return new AppContext({ adapter, analytics, levels, rewards, ownedHeroIds: seed, onFieldHeroIds: seed, now: () => now });
  }

  it('新档真源为空时，config.ownedHeroIds 作为 seed 复制进 playerState 并成为真源', () => {
    const ctx = makeCtx(new MemoryStorageAdapter(), ['hero_isen', 'hero_mia']);

    // 真源即 playerState.ownedHeroIds（同一引用，无独立副本）
    expect(ctx.ownedHeroIds).toBe(ctx.playerState.ownedHeroIds);
    expect(ctx.ownedHeroIds).toEqual(['hero_isen', 'hero_mia']);

    // 修改真源后，ctx.ownedHeroIds 同步变化（不存在独立真源）
    ctx.playerState.ownedHeroIds.push('hero_nox');
    expect(ctx.ownedHeroIds).toContain('hero_nox');
  });

  it('旧档/已落盘真源非空时，config.ownedHeroIds seed 不覆盖真源', () => {
    const adapter = new MemoryStorageAdapter();

    // 第一会话：seed 后改成 ['hero_x'] 并落盘
    const ctx1 = makeCtx(adapter, ['hero_isen']);
    ctx1.playerState.ownedHeroIds = ['hero_x'];
    ctx1.persist();

    // 第二会话：真源已非空，传入不同 seed 不应覆盖
    const ctx2 = makeCtx(adapter, ['hero_isen', 'hero_mia']);
    expect(ctx2.ownedHeroIds).toEqual(['hero_x']);
    expect(ctx2.ownedHeroIds).toBe(ctx2.playerState.ownedHeroIds);
  });
});
