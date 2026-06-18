import { describe, it, expect } from 'vitest';
import {
  NavigationContext,
  resolveNavigationIntent,
} from '../assets/scripts/core/NavigationService';
import { DefeatReasonType, getRetryPathsForReason } from '../assets/scripts/core/DefeatAnalysisService';

const context: NavigationContext = { knownLevelIds: ['level_1_1', 'level_1_2', 'level_1_3'] };

describe('S5C-03 resolveNavigationIntent - 已有面板的导航意图', () => {
  it('hero_upgrade（推荐目标升级/失败弹窗一键升级路径）-> 主界面聚焦一键升级', () => {
    const resolution = resolveNavigationIntent({ scene: 'hero_upgrade', params: { heroId: 'hero_isen' } }, context);
    expect(resolution.kind).toBe('focus_upgrade');
    expect(resolution.notice).toBeTruthy();
  });

  it('offline_reward_claim（推荐目标离线收益）-> 主界面聚焦离线收益', () => {
    const resolution = resolveNavigationIntent({ scene: 'offline_reward_claim' }, context);
    expect(resolution.kind).toBe('focus_offline_reward');
    expect(resolution.notice).toBeTruthy();
  });

  it('level_battle 带合法 levelId -> 备战该关卡，提示含关卡 id', () => {
    const resolution = resolveNavigationIntent({ scene: 'level_battle', params: { levelId: 'level_1_2' } }, context);
    expect(resolution.kind).toBe('battle_prep');
    expect(resolution.levelId).toBe('level_1_2');
    expect(resolution.notice).toContain('level_1_2');
  });
});

describe('S5C-03 resolveNavigationIntent - 关卡缺失时的安全回落', () => {
  it('level_battle 的 levelId 不在关卡配置中 -> 回主界面且不带 levelId', () => {
    const resolution = resolveNavigationIntent({ scene: 'level_battle', params: { levelId: 'level_9_9' } }, context);
    expect(resolution.kind).toBe('main');
    expect(resolution.levelId).toBeUndefined();
    expect(resolution.notice).toBeTruthy();
  });

  it('level_battle 缺 levelId（如无上一关可重刷）-> 回主界面', () => {
    const resolution = resolveNavigationIntent({ scene: 'level_battle', params: { mode: 'replay_previous' } }, context);
    expect(resolution.kind).toBe('main');
    expect(resolution.levelId).toBeUndefined();
    expect(resolution.notice).toBeTruthy();
  });
});

describe('S5C-03 resolveNavigationIntent - 未开放页面兜底（不吞掉点击）', () => {
  it.each(['formation_edit', 'level_select', 'reward_claim', 'defeat_recovery'])(
    '%s 尚无正式 UI -> not_available 且兜底提示非空',
    (scene) => {
      const resolution = resolveNavigationIntent({ scene }, context);
      expect(resolution.kind).toBe('not_available');
      expect(resolution.levelId).toBeUndefined();
      expect(resolution.notice).toBeTruthy();
    },
  );

  it('未知 scene -> not_available，提示中带 scene 名便于排查', () => {
    const resolution = resolveNavigationIntent({ scene: 'mystery_page' }, context);
    expect(resolution.kind).toBe('not_available');
    expect(resolution.notice).toContain('mystery_page');
  });

  it('全部已知意图 scene 的解析结果 notice 恒非空（任何导航点击都有可见反馈）', () => {
    const knownScenes = [
      'hero_upgrade',
      'offline_reward_claim',
      'level_battle',
      'formation_edit',
      'level_select',
      'reward_claim',
      'defeat_recovery',
    ];
    for (const scene of knownScenes) {
      expect(resolveNavigationIntent({ scene }, context).notice).toBeTruthy();
    }
  });
});

describe('S5C-03 与失败弹窗挽留路径的集成', () => {
  const allReasons: DefeatReasonType[] = [
    'insufficient_output',
    'insufficient_durability',
    'insufficient_healing',
    'insufficient_level',
    'formation_issue',
  ];

  it('全部失败原因的全部挽留路径意图均可解析且提示非空', () => {
    for (const reason of allReasons) {
      for (const path of getRetryPathsForReason(reason, 'level_1_1')) {
        const resolution = resolveNavigationIntent(path.navigationIntent, context);
        expect(resolution.notice).toBeTruthy();
      }
    }
  });

  it('"重刷上一关"路径（带上一关 id）-> 备战上一关', () => {
    const paths = getRetryPathsForReason('insufficient_level', 'level_1_1');
    const replay = paths.find((p) => p.type === 'replay_previous_level');
    expect(replay).toBeDefined();
    const resolution = resolveNavigationIntent(replay!.navigationIntent, context);
    expect(resolution.kind).toBe('battle_prep');
    expect(resolution.levelId).toBe('level_1_1');
  });

  it('"重刷上一关"路径但无上一关可刷 -> 安全回落主界面', () => {
    const paths = getRetryPathsForReason('insufficient_level', undefined);
    const replay = paths.find((p) => p.type === 'replay_previous_level');
    expect(replay).toBeDefined();
    const resolution = resolveNavigationIntent(replay!.navigationIntent, context);
    expect(resolution.kind).toBe('main');
    expect(resolution.levelId).toBeUndefined();
  });
});
