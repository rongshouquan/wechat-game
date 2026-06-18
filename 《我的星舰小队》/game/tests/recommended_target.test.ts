import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInitialPlayerState, upgradeHero } from '../assets/scripts/core/PlayerState';
import { confirmRewardGrant, createRewardLedger, requestRewardGrant } from '../assets/scripts/core/RewardLedger';
import {
  RecommendedTargetContext,
  resolveRecommendedTarget,
} from '../assets/scripts/core/RecommendedTargetService';
import { LevelConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

const levels = readSample<LevelConfig[]>('level_config.sample.json');
const ownedHeroIds = ['hero_isen', 'hero_mia'];

function baseContext(overrides: Partial<RecommendedTargetContext> = {}): RecommendedTargetContext {
  return {
    playerState: createInitialPlayerState(),
    rewardLedger: createRewardLedger(),
    hasClaimableOfflineReward: false,
    lastDefeat: undefined,
    levels,
    ownedHeroIds,
    ...overrides,
  };
}

describe('RecommendedTargetService - 优先级分支', () => {
  it('优先级1：存在未确认（pending/granted）奖励流水时，主目标为未确认胜利奖励', () => {
    const ledger = createRewardLedger();
    const outcome = requestRewardGrant(ledger, '1-1', 'reward_1-1');
    expect(outcome.entry.status).toBe('granted');

    // 同时构造其余分支也命中的状态，验证优先级1严格压制其余分支
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 9999;
    playerState.resources.expChip = 9999;

    const result = resolveRecommendedTarget(
      baseContext({
        playerState,
        rewardLedger: ledger,
        hasClaimableOfflineReward: true,
        lastDefeat: { levelId: '1-2', reason: '输出不足', recoveryAvailable: true },
      }),
    );

    expect(result.primary.type).toBe('unconfirmed_reward');
    expect(result.primary.priority).toBe(1);
    expect(result.primary.navigationIntent.scene).toBe('reward_claim');
    expect(result.primary.navigationIntent.params).toMatchObject({ flowId: outcome.entry.flowId, sourceId: '1-1' });
    // 备选目标中应包含其余命中的分支，且按优先级排序
    expect(result.alternatives.map((a) => a.type)).toEqual(['offline_reward', 'defeat_recovery', 'upgrade', 'next_level']);
  });

  it('confirmed 状态的奖励流水不应被识别为"未确认"', () => {
    const ledger = createRewardLedger();
    const outcome = requestRewardGrant(ledger, '1-1', 'reward_1-1');
    confirmRewardGrant(outcome.entry);

    const result = resolveRecommendedTarget(baseContext({ rewardLedger: ledger }));

    expect(result.primary.type).not.toBe('unconfirmed_reward');
    expect(result.alternatives.every((a) => a.type !== 'unconfirmed_reward')).toBe(true);
  });

  it('优先级2：无未确认奖励但有可领取离线收益时，主目标为离线收益', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 9999;
    playerState.resources.expChip = 9999;

    const result = resolveRecommendedTarget(
      baseContext({
        playerState,
        hasClaimableOfflineReward: true,
        lastDefeat: { levelId: '1-2', reason: '承伤不足', recoveryAvailable: true },
      }),
    );

    expect(result.primary.type).toBe('offline_reward');
    expect(result.primary.navigationIntent.scene).toBe('offline_reward_claim');
  });

  it('优先级3：无未确认奖励/离线收益，但最近失败且有修复动作时，主目标为失败修复', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 9999;
    playerState.resources.expChip = 9999;

    const result = resolveRecommendedTarget(
      baseContext({
        playerState,
        lastDefeat: { levelId: '1-3', reason: '治疗不足', recoveryAvailable: true },
      }),
    );

    expect(result.primary.type).toBe('defeat_recovery');
    expect(result.primary.navigationIntent.params).toMatchObject({ levelId: '1-3', reason: '治疗不足' });
  });

  it('最近失败但 recoveryAvailable=false 时，不命中失败修复分支', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 9999;
    playerState.resources.expChip = 9999;

    const result = resolveRecommendedTarget(
      baseContext({
        playerState,
        lastDefeat: { levelId: '1-3', reason: '阵容缺位', recoveryAvailable: false },
      }),
    );

    expect(result.primary.type).not.toBe('defeat_recovery');
    expect([result.primary, ...result.alternatives].every((t) => t.type !== 'defeat_recovery')).toBe(true);
  });

  it('优先级4：以上均不命中，但资源足够升级角色时，主目标为升级', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 200; // 1级升级花费 100 星币 / 20 经验芯片，足够
    playerState.resources.expChip = 50;

    const result = resolveRecommendedTarget(baseContext({ playerState }));

    expect(result.primary.type).toBe('upgrade');
    expect(result.primary.navigationIntent.params).toMatchObject({ heroId: 'hero_isen' });
  });

  it('资源不足以升级任何角色时，不命中升级分支', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 10;
    playerState.resources.expChip = 1;

    const result = resolveRecommendedTarget(baseContext({ playerState }));

    expect(result.primary.type).not.toBe('upgrade');
    expect([result.primary, ...result.alternatives].every((t) => t.type !== 'upgrade')).toBe(true);
  });
});

describe('RecommendedTargetService - 兜底目标', () => {
  it('全部条件均不命中时，兜底推荐挑战下一关', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 0;
    playerState.resources.expChip = 0;

    const result = resolveRecommendedTarget(baseContext({ playerState }));

    expect(result.primary.type).toBe('next_level');
    expect(result.primary.navigationIntent.params).toMatchObject({ levelId: levels[0].levelId });
    expect(result.primary.priority).toBe(5);
  });

  it('已通关全部关卡且无其余命中分支时，兜底退化为重刷上一关', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 0;
    playerState.resources.expChip = 0;
    playerState.clearedLevelIds = levels.map((l) => l.levelId);

    const result = resolveRecommendedTarget(baseContext({ playerState }));

    expect(result.primary.type).toBe('replay_level');
    expect(result.primary.navigationIntent.params).toMatchObject({ levelId: levels[levels.length - 1].levelId });
  });

  it('无关卡数据且无通关记录时，返回安全兜底目标：场景不依赖 levelId，且 params 中不出现 levelId: undefined', () => {
    const playerState = createInitialPlayerState();

    const result = resolveRecommendedTarget(baseContext({ playerState, levels: [] }));

    expect(result.primary).toBeDefined();
    expect(result.primary.type).toBe('safe_fallback');
    // 场景必须是不依赖 levelId 即可安全跳转的页面（如关卡选择），而不是要求带 levelId 的 level_battle
    expect(result.primary.navigationIntent.scene).toBe('level_select');
    // params 要么不存在，要么不包含 levelId 字段；两种情况下都不会让 UI 拿到 levelId: undefined
    const params = result.primary.navigationIntent.params;
    if (params) {
      expect('levelId' in params).toBe(false);
    }
    expect(JSON.stringify(result.primary.navigationIntent)).not.toContain('undefined');
  });

  it('无关卡数据但存在历史通关记录时，仍可安全退化为重刷上一关（带有效 levelId）', () => {
    const playerState = createInitialPlayerState();
    playerState.clearedLevelIds = ['1-1', '1-2'];

    const result = resolveRecommendedTarget(baseContext({ playerState, levels: [] }));

    expect(result.primary.type).toBe('replay_level');
    expect(result.primary.navigationIntent.scene).toBe('level_battle');
    expect(result.primary.navigationIntent.params?.levelId).toBe('1-2');
    expect(result.primary.navigationIntent.params?.levelId).not.toBeUndefined();
  });
});

describe('RecommendedTargetService - 输出结构', () => {
  it('返回结构包含可被 UI 直接消费的字段：类型/文案key/跳转意图/原因/优先级', () => {
    const result = resolveRecommendedTarget(baseContext());

    for (const target of [result.primary, ...result.alternatives]) {
      expect(typeof target.type).toBe('string');
      expect(typeof target.textKey).toBe('string');
      expect(typeof target.reason).toBe('string');
      expect(typeof target.priority).toBe('number');
      expect(typeof target.navigationIntent.scene).toBe('string');
    }
  });

  it('alternatives 按优先级升序排列且不包含 primary', () => {
    const playerState = createInitialPlayerState();
    playerState.resources.starCoin = 9999;
    playerState.resources.expChip = 9999;

    const ledger = createRewardLedger();
    requestRewardGrant(ledger, '1-1', 'reward_1-1');

    const result = resolveRecommendedTarget(
      baseContext({
        playerState,
        rewardLedger: ledger,
        hasClaimableOfflineReward: true,
        lastDefeat: { levelId: '1-2', reason: '输出不足', recoveryAvailable: true },
      }),
    );

    const priorities = result.alternatives.map((a) => a.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(result.alternatives.every((a) => a.type !== result.primary.type)).toBe(true);
  });
});
