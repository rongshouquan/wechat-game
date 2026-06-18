import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState, getHeroLevel } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import { oneTapUpgrade } from '../assets/scripts/core/OneTapUpgradeService';
import { resolveRecommendedTarget } from '../assets/scripts/core/RecommendedTargetService';
import { LevelConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
const levels = JSON.parse(readFileSync(path.join(CONFIG_DIR, 'level_config.sample.json'), 'utf-8')) as LevelConfig[];

describe('OneTapUpgradeService - 资源足够', () => {
  it('资源充足时批量升级上阵英雄并记录 one_tap_upgrade_applied', () => {
    const state = createInitialPlayerState();
    // S5C-05 曲线：lv1→2=60/12, lv2→3=100/20, lv3→4=140/28；合计 300/60 恰好升 3 级。
    state.resources.starCoin = 300;
    state.resources.expChip = 60;

    const result = oneTapUpgrade({ playerState: state, onFieldHeroIds: ['hero_a'] });

    expect(result.applied).toBe(true);
    expect(result.steps.length).toBe(3);
    expect(getHeroLevel(state, 'hero_a')).toBe(4);
    expect(state.resources.starCoin).toBe(0);
    expect(state.resources.expChip).toBe(0);
    expect(result.log).toContain('one_tap_upgrade_applied');
    expect(result.stopReason).toBe('no_resource');
  });
});

describe('OneTapUpgradeService - 资源不足', () => {
  it('资源不足以升级任何英雄时不升级、不扣成负数、返回 no_resource', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 10;
    state.resources.expChip = 1;

    const result = oneTapUpgrade({ playerState: state, onFieldHeroIds: ['hero_a'] });

    expect(result.applied).toBe(false);
    expect(result.steps.length).toBe(0);
    expect(result.stopReason).toBe('no_resource');
    expect(state.resources.starCoin).toBe(10);
    expect(state.resources.expChip).toBe(1);
    expect(getHeroLevel(state, 'hero_a')).toBe(1);
  });

  it('无任何候选英雄时返回 no_candidate', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 9999;
    state.resources.expChip = 9999;

    const result = oneTapUpgrade({ playerState: state, onFieldHeroIds: [] });

    expect(result.applied).toBe(false);
    expect(result.stopReason).toBe('no_candidate');
  });
});

describe('OneTapUpgradeService - 多英雄排序策略', () => {
  it('同等条件优先升级当前最低等级的英雄（拉齐短板）', () => {
    const state = createInitialPlayerState();
    state.heroLevels = { hero_a: 1, hero_b: 3 };
    state.resources.starCoin = 100; // 只够升一次 lv1 的英雄
    state.resources.expChip = 20;

    const result = oneTapUpgrade({ playerState: state, onFieldHeroIds: ['hero_b', 'hero_a'] });

    expect(result.steps.length).toBe(1);
    expect(result.steps[0].heroId).toBe('hero_a'); // 低等级优先，而非列表顺序里的 hero_b
    expect(getHeroLevel(state, 'hero_a')).toBe(2);
    expect(getHeroLevel(state, 'hero_b')).toBe(3);
  });

  it('上阵英雄优先于替补英雄（includeBench=true 时仍先升上阵）', () => {
    const state = createInitialPlayerState();
    state.heroLevels = { field_hero: 5, bench_hero: 1 };
    state.resources.starCoin = 500; // field lv5 需要 500/100
    state.resources.expChip = 100;

    const result = oneTapUpgrade({
      playerState: state,
      onFieldHeroIds: ['field_hero'],
      benchHeroIds: ['bench_hero'],
      includeBench: true,
    });

    expect(result.steps[0].heroId).toBe('field_hero'); // 上阵优先，即便等级更高
  });
});

describe('OneTapUpgradeService - 状态不变', () => {
  it('升级失败（资源不足）时玩家状态完全不变', () => {
    const state = createInitialPlayerState();
    state.heroLevels = { hero_a: 2 };
    state.resources.starCoin = 50;
    state.resources.expChip = 5;
    const snapshot = JSON.stringify(state);

    oneTapUpgrade({ playerState: state, onFieldHeroIds: ['hero_a'] });

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('OneTapUpgradeService - 配合推荐目标刷新', () => {
  it('一键升级耗尽资源后，推荐目标不再是升级（可刷新下一步目标）', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 100;
    state.resources.expChip = 20;
    const ownedHeroIds = ['hero_a'];

    const before = resolveRecommendedTarget({
      playerState: state,
      rewardLedger: createRewardLedger(),
      hasClaimableOfflineReward: false,
      lastDefeat: undefined,
      levels,
      ownedHeroIds,
    });
    expect(before.primary.type).toBe('upgrade');

    oneTapUpgrade({ playerState: state, onFieldHeroIds: ownedHeroIds });

    const after = resolveRecommendedTarget({
      playerState: state,
      rewardLedger: createRewardLedger(),
      hasClaimableOfflineReward: false,
      lastDefeat: undefined,
      levels,
      ownedHeroIds,
    });
    expect(after.primary.type).not.toBe('upgrade');
  });
});
