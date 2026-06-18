import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import { AnalyticsService } from '../assets/scripts/analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../assets/scripts/analytics/LocalAnalyticsSink';
import { AppContext, AppContextConfig } from '../assets/scripts/ui/presenter/AppContext';
import {
  INITIAL_OWNED_HERO_IDS,
  DEFAULT_ON_FIELD_HERO_IDS,
  createInitialPlayerState,
  ensureOnFieldHeroesOwned,
} from '../assets/scripts/core/PlayerState';
import { LevelConfig, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');

const NOW = Date.UTC(2026, 5, 11, 12, 0, 0);

function makeCtx(adapter: MemoryStorageAdapter, overrides: Partial<AppContextConfig> = {}): AppContext {
  const analytics = new AnalyticsService({ sessionId: 'sess', sinks: [new LocalAnalyticsSink({ console: false })], now: () => NOW });
  return new AppContext({ adapter, analytics, levels, rewards, now: () => NOW, ...overrides });
}

describe('S5C-01 真实阵容接线 - 新档默认发放（Ron 已确认规则）', () => {
  it('新档不传 seed：初始拥有 hero_isen/hero_mia，默认上阵同两人', () => {
    const ctx = makeCtx(new MemoryStorageAdapter());

    expect(ctx.ownedHeroIds).toEqual([...INITIAL_OWNED_HERO_IDS]);
    expect(ctx.onFieldHeroIds).toEqual([...DEFAULT_ON_FIELD_HERO_IDS]);
  });

  it('拥有/上阵真源均为 playerState 字段，不存在独立副本', () => {
    const ctx = makeCtx(new MemoryStorageAdapter());

    expect(ctx.ownedHeroIds).toBe(ctx.playerState.ownedHeroIds);
    expect(ctx.onFieldHeroIds).toBe(ctx.playerState.onFieldHeroIds);

    ctx.playerState.onFieldHeroIds.push('hero_ryan');
    expect(ctx.onFieldHeroIds).toContain('hero_ryan');
  });
});

describe('S5C-01 真实阵容接线 - 阵容随存档持久化', () => {
  it('杀进程重进（同 adapter 重建 AppContext）：上阵阵容不重置、不被默认 seed 覆盖', () => {
    const adapter = new MemoryStorageAdapter();
    const ctx1 = makeCtx(adapter);

    // 模拟后续玩法改变了阵容（当前无阵容编辑 UI，直接写真源）
    ctx1.playerState.ownedHeroIds.push('hero_ryan');
    ctx1.playerState.onFieldHeroIds = ['hero_mia', 'hero_ryan'];
    ctx1.persist();

    const ctx2 = makeCtx(adapter);
    expect(ctx2.onFieldHeroIds).toEqual(['hero_mia', 'hero_ryan']);
    expect(ctx2.ownedHeroIds).toEqual(['hero_isen', 'hero_mia', 'hero_ryan']);
  });

  it('新档默认阵容本身也随首次落盘持久化（saveVersion=v7 当前版）', () => {
    const adapter = new MemoryStorageAdapter();
    const ctx1 = makeCtx(adapter);
    ctx1.persist();

    const ctx2 = makeCtx(adapter);
    expect(ctx2.ownedHeroIds).toEqual([...INITIAL_OWNED_HERO_IDS]);
    expect(ctx2.onFieldHeroIds).toEqual([...DEFAULT_ON_FIELD_HERO_IDS]);
  });
});

describe('S5C-01 真实阵容接线 - 显式 seed 兼容（测试/特殊装配）', () => {
  it('显式传入 seed 时仍按"真源为空时复制一次"生效', () => {
    const ctx = makeCtx(new MemoryStorageAdapter(), { ownedHeroIds: ['hero_a'], onFieldHeroIds: ['hero_a'] });

    expect(ctx.ownedHeroIds).toEqual(['hero_a']);
    expect(ctx.onFieldHeroIds).toEqual(['hero_a']);
  });

  it('显式传入空数组保持真源为空（不套用默认发放）', () => {
    const ctx = makeCtx(new MemoryStorageAdapter(), { ownedHeroIds: [], onFieldHeroIds: [] });

    expect(ctx.ownedHeroIds).toEqual([]);
    expect(ctx.onFieldHeroIds).toEqual([]);
  });
});

describe('S5C-01 ensureOnFieldHeroesOwned - 上阵者必拥有不变量', () => {
  it('上阵英雄缺失于拥有列表时补入，既有拥有不移除、不重复', () => {
    const state = createInitialPlayerState();
    state.ownedHeroIds = ['hero_ryan', 'hero_isen'];
    state.onFieldHeroIds = ['hero_isen', 'hero_mia'];

    ensureOnFieldHeroesOwned(state);

    expect(state.ownedHeroIds).toEqual(['hero_ryan', 'hero_isen', 'hero_mia']);
    expect(state.onFieldHeroIds).toEqual(['hero_isen', 'hero_mia']);
  });

  it('上阵为空或全部已拥有时不做任何修改', () => {
    const state = createInitialPlayerState();
    state.ownedHeroIds = ['hero_isen'];

    ensureOnFieldHeroesOwned(state);
    expect(state.ownedHeroIds).toEqual(['hero_isen']);

    state.onFieldHeroIds = ['hero_isen'];
    ensureOnFieldHeroesOwned(state);
    expect(state.ownedHeroIds).toEqual(['hero_isen']);
  });
});
