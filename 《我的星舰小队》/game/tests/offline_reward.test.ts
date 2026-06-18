import { describe, it, expect } from 'vitest';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DEFAULT_OFFLINE_REWARD_CONFIG,
  OfflineRewardConfig,
  calculateOfflineReward,
  claimOfflineReward,
} from '../assets/scripts/core/OfflineRewardService';

const MS_PER_HOUR = 60 * 60 * 1000;
const BASE_TIME = 1_700_000_000_000;

function progressedPlayerState() {
  const state = createInitialPlayerState();
  state.clearedLevelIds = ['1-1'];
  return state;
}

describe('OfflineRewardService - 正常离线收益', () => {
  it('离线 2 小时按配置费率计算收益（1 倍，无广告翻倍）', () => {
    const calc = calculateOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 2 * MS_PER_HOUR,
      hasProgress: true,
    });

    expect(calc.cappedHours).toBe(2);
    expect(calc.capped).toBe(false);
    expect(calc.reward.starCoin).toBe(DEFAULT_OFFLINE_REWARD_CONFIG.baseRate.starCoinPerHour * 2);
    expect(calc.reward.expChip).toBe(DEFAULT_OFFLINE_REWARD_CONFIG.baseRate.expChipPerHour * 2);
    expect(calc.claimable).toBe(true);
  });

  it('封顶时长与费率由配置驱动（替换配置即改变结果）', () => {
    const config: OfflineRewardConfig = { maxOfflineHours: 4, baseRate: { starCoinPerHour: 100, expChipPerHour: 10 } };
    const calc = calculateOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 3 * MS_PER_HOUR,
      hasProgress: true,
      config,
    });

    expect(calc.reward.starCoin).toBe(300);
    expect(calc.reward.expChip).toBe(30);
  });
});

describe('OfflineRewardService - 8 小时封顶', () => {
  it('离线超过 8 小时按 8 小时封顶，并记录 offline_reward_capped_at_8h', () => {
    const calc = calculateOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 20 * MS_PER_HOUR,
      hasProgress: true,
    });

    expect(calc.capped).toBe(true);
    expect(calc.cappedHours).toBe(DEFAULT_OFFLINE_REWARD_CONFIG.maxOfflineHours);
    expect(calc.reward.starCoin).toBe(DEFAULT_OFFLINE_REWARD_CONFIG.baseRate.starCoinPerHour * 8);
    expect(calc.log).toContain('offline_reward_capped_at_8h');
  });
});

describe('OfflineRewardService - 防重复领取', () => {
  it('同一离线窗口领取一次后，重复领取被拒绝且不再加资源', () => {
    const playerState = progressedPlayerState();
    const rewardLedger = createRewardLedger();
    const params = { lastOnlineTime: BASE_TIME, now: BASE_TIME + 3 * MS_PER_HOUR, hasProgress: true, playerState, rewardLedger };

    const first = claimOfflineReward(params);
    expect(first.granted).toBe(true);
    const afterFirstStarCoin = playerState.resources.starCoin;
    expect(afterFirstStarCoin).toBeGreaterThan(0);

    // 重复领取同一窗口（lastOnlineTime 未推进）
    const second = claimOfflineReward(params);
    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(playerState.resources.starCoin).toBe(afterFirstStarCoin);
    expect(second.log).toContain('offline_reward_duplicate_rejected');
  });
});

describe('OfflineRewardService - 领取后状态更新', () => {
  it('领取成功后资源增加、流水确认、nextLastOnlineTime 推进到 now', () => {
    const playerState = progressedPlayerState();
    const rewardLedger = createRewardLedger();
    const now = BASE_TIME + 5 * MS_PER_HOUR;

    const result = claimOfflineReward({ lastOnlineTime: BASE_TIME, now, hasProgress: true, playerState, rewardLedger });

    expect(result.granted).toBe(true);
    expect(result.nextLastOnlineTime).toBe(now);
    expect(playerState.resources.starCoin).toBe(result.calculation.reward.starCoin);
    expect(playerState.resources.expChip).toBe(result.calculation.reward.expChip);
    expect(result.flowId).toBeDefined();
    expect(playerState.claimedRewardFlowIds).toContain(result.flowId);
    const entry = rewardLedger.entries.find((e) => e.flowId === result.flowId);
    expect(entry?.status).toBe('confirmed');
    expect(result.log).toContain('offline_reward_granted');
  });

  it('推进 lastOnlineTime 后形成新窗口，可再次领取（杀进程重进不重复发奖语义）', () => {
    const playerState = progressedPlayerState();
    const rewardLedger = createRewardLedger();

    const firstNow = BASE_TIME + 3 * MS_PER_HOUR;
    const first = claimOfflineReward({ lastOnlineTime: BASE_TIME, now: firstNow, hasProgress: true, playerState, rewardLedger });
    expect(first.granted).toBe(true);

    // 用上次领取后推进的时间作为新窗口起点
    const secondNow = first.nextLastOnlineTime + 2 * MS_PER_HOUR;
    const second = claimOfflineReward({ lastOnlineTime: first.nextLastOnlineTime, now: secondNow, hasProgress: true, playerState, rewardLedger });
    expect(second.granted).toBe(true);
    expect(second.duplicate).toBe(false);
  });
});

describe('OfflineRewardService - 无通关进度兜底', () => {
  it('无通关进度时不产生离线收益，且不可领取', () => {
    const calc = calculateOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 5 * MS_PER_HOUR,
      hasProgress: false,
    });

    expect(calc.reward.starCoin).toBe(0);
    expect(calc.reward.expChip).toBe(0);
    expect(calc.claimable).toBe(false);
    expect(calc.log).toContain('offline_reward_no_progress_fallback');
  });

  it('无进度时 claim 不写流水、不加资源', () => {
    const playerState = createInitialPlayerState(); // 无 clearedLevelIds
    const rewardLedger = createRewardLedger();

    const result = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME + 5 * MS_PER_HOUR,
      hasProgress: false,
      playerState,
      rewardLedger,
    });

    expect(result.granted).toBe(false);
    expect(rewardLedger.entries.length).toBe(0);
    expect(playerState.resources.starCoin).toBe(0);
    expect(result.nextLastOnlineTime).toBe(BASE_TIME);
  });

  it('离线时长为负（异常时间）时按 0 处理，不产生收益', () => {
    const calc = calculateOfflineReward({
      lastOnlineTime: BASE_TIME,
      now: BASE_TIME - 10 * MS_PER_HOUR,
      hasProgress: true,
    });

    expect(calc.offlineMs).toBe(0);
    expect(calc.reward.starCoin).toBe(0);
    expect(calc.claimable).toBe(false);
  });
});
