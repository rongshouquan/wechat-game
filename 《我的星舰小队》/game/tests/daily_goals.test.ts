import { describe, it, expect } from 'vitest';
import { createInitialPlayerState, upgradeHero } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DAY_MS,
  DEFAULT_DAILY_GOALS,
  DailyGoalDef,
  applyGoalEvent,
  claimGoal,
  createDefaultDailyGoalsState,
  getClaimableGoals,
  getGoalStatuses,
  recordFragmentCraft,
  recordHeroUpgradeSingle,
  recordLevelClear,
  recordMiningClaim,
  recordOfflineClaim,
  recordOneTapEquip,
  recordOneTapUpgrade,
  recordSupplyDraw,
  resolveActiveDay,
} from '../assets/scripts/core/DailyGoalService';
import { claimOfflineReward } from '../assets/scripts/core/OfflineRewardService';
import { claimMiningYield } from '../assets/scripts/core/MiningStationService';
import { drawSupply } from '../assets/scripts/core/SupplyService';
import { craftHero } from '../assets/scripts/core/FragmentCraftService';
import type { RewardSettlementOutcome } from '../assets/scripts/core/LevelRewardSettlement';
import type { OneTapUpgradeResult } from '../assets/scripts/core/OneTapUpgradeService';
import type { OneTapEquipResult } from '../assets/scripts/core/OneTapEquipService';
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

const BASE = 1_700_000_000_000;
const constSource = (v: number) => () => v;

// 自定义目标集，便于精确控制 day 闸控与阈值，不依赖默认占位数值。
const customDefs: DailyGoalDef[] = [
  { goalId: 'g_day1', day: 1, eventType: 'supply_draw', targetValue: 2, reward: { starCoin: 10 } },
  { goalId: 'g_day2', day: 2, eventType: 'supply_draw', targetValue: 1, reward: { starCoin: 20, expChip: 5 } },
  { goalId: 'g_day3', day: 3, eventType: 'level_clear', targetValue: 1, reward: { baseEnergy: 30, fragments: [{ heroId: 'hero_ryan', count: 4 }] } },
];

describe('DailyGoalService - 惰性锚定', () => {
  it('startTime<=0 时，首次记录进度惰性锚定为 now', () => {
    const state = createInitialPlayerState();
    expect(state.dailyGoals.startTime).toBe(0);

    applyGoalEvent(state.dailyGoals, 'supply_draw', 1, BASE, customDefs);

    expect(state.dailyGoals.startTime).toBe(BASE);
  });

  it('startTime<=0 时，首次领取检查也惰性锚定为 now', () => {
    const state = createInitialPlayerState();
    getGoalStatuses(state, BASE, customDefs);
    expect(state.dailyGoals.startTime).toBe(BASE);
  });
});

describe('DailyGoalService - activeDay 闸控', () => {
  it('activeDay 随 now 推进，封顶 3', () => {
    const goals = createDefaultDailyGoalsState();
    goals.startTime = BASE;
    expect(resolveActiveDay(goals, BASE)).toBe(1);
    expect(resolveActiveDay(goals, BASE + DAY_MS)).toBe(2);
    expect(resolveActiveDay(goals, BASE + 2 * DAY_MS)).toBe(3);
    expect(resolveActiveDay(goals, BASE + 10 * DAY_MS)).toBe(3); // 封顶
  });

  it('now < startTime 只能落到 day 1', () => {
    const goals = createDefaultDailyGoalsState();
    goals.startTime = BASE;
    expect(resolveActiveDay(goals, BASE - 5 * DAY_MS)).toBe(1);
  });
});

describe('DailyGoalService - 进度提前累计但不能提前领取', () => {
  it('day2 目标在 day1 即可累计进度，但不可领取；进入 day2 后可领取', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();

    // 第 1 日：一次补给推进 g_day1(+1) 与 g_day2(+1)
    applyGoalEvent(state.dailyGoals, 'supply_draw', 1, BASE, customDefs);
    expect(state.dailyGoals.progress.g_day2).toBe(1); // 已达成 g_day2 阈值(1)

    // 仍在 day1：g_day2 未解锁，不可领取
    const day1Claimable = getClaimableGoals(state, BASE, customDefs).map((g) => g.goalId);
    expect(day1Claimable).not.toContain('g_day2');
    const lockedTry = claimGoal(state, ledger, 'g_day2', BASE, customDefs);
    expect(lockedTry.granted).toBe(false);
    expect(lockedTry.reason).toBe('locked');
    expect(ledger.entries.length).toBe(0);

    // 进入 day2：g_day2 解锁且达成，可领取
    const day2Now = BASE + DAY_MS;
    expect(getClaimableGoals(state, day2Now, customDefs).map((g) => g.goalId)).toContain('g_day2');
    const ok = claimGoal(state, ledger, 'g_day2', day2Now, customDefs);
    expect(ok.granted).toBe(true);
  });
});

describe('DailyGoalService - 7 类事件推进（真实结果类型）', () => {
  it('通关 win&&granted 推进 level_clear 目标', () => {
    const state = createInitialPlayerState();
    const outcome: RewardSettlementOutcome = { levelId: '1-1', win: true, granted: true, duplicate: false, log: [] };
    recordLevelClear(state, outcome, BASE);
    expect(state.dailyGoals.progress.d1_clear_1).toBe(1);
    expect(state.dailyGoals.progress.d3_clear_3).toBe(1);
  });

  it('单次升级 ok 推进 hero_upgrade 目标', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 1000;
    state.resources.expChip = 1000;
    const result = upgradeHero(state, 'hero_isen');
    expect(result.ok).toBe(true);
    recordHeroUpgradeSingle(state, result, BASE);
    expect(state.dailyGoals.progress.d1_upgrade_1).toBe(1);
  });

  it('一键升级 applied 按 steps.length 推进', () => {
    const state = createInitialPlayerState();
    const result: OneTapUpgradeResult = {
      steps: [
        { heroId: 'h1', fromLevel: 1, toLevel: 2, cost: { starCoin: 1, expChip: 1 } },
        { heroId: 'h2', fromLevel: 1, toLevel: 2, cost: { starCoin: 1, expChip: 1 } },
      ],
      applied: true,
      stopReason: 'no_resource',
      totalCost: { starCoin: 2, expChip: 2 },
      log: [],
    };
    recordOneTapUpgrade(state, result, BASE);
    expect(state.dailyGoals.progress.d1_upgrade_1).toBe(2);
  });

  it('一键穿装 changed 推进 one_tap_equip 目标', () => {
    const state = createInitialPlayerState();
    const result: OneTapEquipResult = { changed: true, heroes: ['hero_isen'] };
    recordOneTapEquip(state, result, BASE);
    expect(state.dailyGoals.progress.d2_equip_1).toBe(1);
  });

  it('离线领取 granted 推进 offline_claim 目标', () => {
    const state = createInitialPlayerState();
    state.clearedLevelIds = ['1-1'];
    const ledger = createRewardLedger();
    const result = claimOfflineReward({ lastOnlineTime: BASE, now: BASE + 3 * 60 * 60 * 1000, hasProgress: true, playerState: state, rewardLedger: ledger });
    expect(result.granted).toBe(true);
    recordOfflineClaim(state, result, BASE);
    expect(state.dailyGoals.progress.d2_offline_1).toBe(1);
  });

  it('采矿领取 granted&&!anchored 推进 mining_claim 目标', () => {
    const state = createInitialPlayerState();
    state.miningStation.lastCollectTime = BASE;
    const ledger = createRewardLedger();
    const result = claimMiningYield({ playerState: state, rewardLedger: ledger, now: BASE + 5 * 60 * 60 * 1000 });
    expect(result.granted).toBe(true);
    expect(result.anchored).toBe(false);
    recordMiningClaim(state, result, BASE);
    expect(state.dailyGoals.progress.d2_mining_1).toBe(1);
  });

  it('补给 granted 推进 supply_draw 目标', () => {
    const state = createInitialPlayerState();
    state.resources.baseEnergy = 100;
    const ledger = createRewardLedger();
    const result = drawSupply({ playerState: state, rewardLedger: ledger, rng: constSource(0) });
    expect(result.granted).toBe(true);
    recordSupplyDraw(state, result, BASE);
    expect(state.dailyGoals.progress.d1_supply_1).toBe(1);
    expect(state.dailyGoals.progress.d3_supply_3).toBe(1);
  });

  it('碎片合成 granted 推进 fragment_craft 目标', () => {
    const state = createInitialPlayerState();
    state.heroFragments.hero_ryan = 60;
    const ledger = createRewardLedger();
    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });
    expect(result.granted).toBe(true);
    recordFragmentCraft(state, result, BASE);
    expect(state.dailyGoals.progress.d3_craft_1).toBe(1);
  });
});

describe('DailyGoalService - 失败/重复事件不推进', () => {
  it('通关 duplicate、升级失败、一键升级未应用、穿装未变化、采矿惰性锚定、补给不足、合成不足均不推进', () => {
    const state = createInitialPlayerState();
    state.miningStation.lastCollectTime = 0; // 触发惰性锚定（anchored=true, granted=false）

    // 通关 duplicate
    recordLevelClear(state, { levelId: '1-1', win: true, granted: false, duplicate: true, log: [] }, BASE);
    // 升级失败（资源不足）
    recordHeroUpgradeSingle(state, upgradeHero(state, 'hero_isen'), BASE);
    // 一键升级未应用
    recordOneTapUpgrade(state, { steps: [], applied: false, stopReason: 'no_candidate', totalCost: { starCoin: 0, expChip: 0 }, log: [] }, BASE);
    // 一键穿装未变化
    recordOneTapEquip(state, { changed: false, heroes: [] }, BASE);
    // 采矿惰性锚定（非真实领取）
    const miningAnchor = claimMiningYield({ playerState: state, rewardLedger: createRewardLedger(), now: BASE });
    expect(miningAnchor.anchored).toBe(true);
    recordMiningClaim(state, miningAnchor, BASE);
    // 补给 baseEnergy 不足
    const supplyFail = drawSupply({ playerState: state, rewardLedger: createRewardLedger(), rng: constSource(0) });
    expect(supplyFail.granted).toBe(false);
    recordSupplyDraw(state, supplyFail, BASE);
    // 合成碎片不足
    const craftFail = craftHero({ playerState: state, rewardLedger: createRewardLedger(), heroId: 'hero_ryan' });
    expect(craftFail.granted).toBe(false);
    recordFragmentCraft(state, craftFail, BASE);

    // 所有默认目标进度仍为空
    expect(Object.keys(state.dailyGoals.progress).length).toBe(0);
  });
});

describe('DailyGoalService - 领取闸门', () => {
  it('未达成不能领取', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();
    applyGoalEvent(state.dailyGoals, 'supply_draw', 1, BASE, customDefs); // g_day1 需 2，仅 1
    const result = claimGoal(state, ledger, 'g_day1', BASE, customDefs);
    expect(result.granted).toBe(false);
    expect(result.reason).toBe('not_reached');
    expect(ledger.entries.length).toBe(0);
  });

  it('达成后可领取，奖励入账（资源+碎片）、流水 confirmed、写 claimedGoalIds 与 claimedRewardFlowIds', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();
    // 推进 g_day3（level_clear x1，day3 奖励含碎片），并把时间推进到 day3
    applyGoalEvent(state.dailyGoals, 'level_clear', 1, BASE, customDefs);
    const day3Now = BASE + 2 * DAY_MS;

    const result = claimGoal(state, ledger, 'g_day3', day3Now, customDefs);

    expect(result.granted).toBe(true);
    expect(state.resources.baseEnergy).toBe(30);
    expect(state.heroFragments.hero_ryan).toBe(4);
    expect(state.dailyGoals.claimedGoalIds).toContain('g_day3');
    expect(result.flowId).toBeDefined();
    expect(state.claimedRewardFlowIds).toContain(result.flowId);
    const entry = ledger.entries.find((e) => e.flowId === result.flowId);
    expect(entry?.status).toBe('confirmed');
    expect(entry?.sourceId).toBe('goal_g_day3');
    expect(entry?.rewardId).toBe('daily_goal');
  });

  it('重复领取防重：第二次被拒绝且不二次入账', () => {
    const state = createInitialPlayerState();
    const ledger = createRewardLedger();
    applyGoalEvent(state.dailyGoals, 'level_clear', 1, BASE, customDefs);
    const day3Now = BASE + 2 * DAY_MS;

    const first = claimGoal(state, ledger, 'g_day3', day3Now, customDefs);
    expect(first.granted).toBe(true);
    const energyAfterFirst = state.resources.baseEnergy;

    // 第二次：claimedGoalIds 已含 -> already_claimed
    const second = claimGoal(state, ledger, 'g_day3', day3Now, customDefs);
    expect(second.granted).toBe(false);
    expect(second.reason).toBe('already_claimed');
    expect(state.resources.baseEnergy).toBe(energyAfterFirst);

    // 即便绕过 claimedGoalIds（模拟便捷态丢失），RewardLedger 仍判 duplicate
    state.dailyGoals.claimedGoalIds = [];
    const third = claimGoal(state, ledger, 'g_day3', day3Now, customDefs);
    expect(third.granted).toBe(false);
    expect(third.duplicate).toBe(true);
    expect(third.reason).toBe('duplicate');
    expect(state.resources.baseEnergy).toBe(energyAfterFirst);
  });
});

describe('DailyGoalService - 默认目标覆盖 7 类事件', () => {
  it('DEFAULT_DAILY_GOALS 覆盖全部 7 种 eventType', () => {
    const types = new Set(DEFAULT_DAILY_GOALS.map((g) => g.eventType));
    expect(types).toEqual(new Set(['level_clear', 'hero_upgrade', 'one_tap_equip', 'offline_claim', 'mining_claim', 'supply_draw', 'fragment_craft']));
  });
});

describe('DailyGoalService - 存档迁移 v4 -> v5', () => {
  it('回填 dailyGoals，并保留 C17/C19/C20 与其它既有字段', () => {
    const adapter = new MemoryStorageAdapter();

    const base = createInitialPlayerState();
    base.resources.starCoin = 555;
    base.heroLevels = { hero_isen: 2 };
    base.clearedLevelIds = ['1-1'];
    base.claimedRewardFlowIds = ['flow_y'];
    base.miningStation = { unlocked: true, lastCollectTime: 999 };
    base.heroFragments = { hero_ryan: 12 };
    base.ownedHeroIds = ['hero_isen'];
    base.supplyDrawCount = 3;
    base.craftCount = 1;
    const legacy: any = { ...base };
    delete legacy.dailyGoals; // v4 旧档无 dailyGoals

    // v4 旧档：缺 dailyGoals，且天然缺 v6 才引入的 adFrequencyState/defeatSupplyState 顶层字段。
    const v4Save = { saveVersion: 4, playerState: legacy, rewardLedger: createRewardLedger(), lastOnlineTime: 1000 };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v4Save));

    const result = loadSave(adapter, 2000);
    const ps = result.data.playerState;

    expect(result.migrated).toBe(true);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(ps.dailyGoals).toEqual(createDefaultDailyGoalsState());
    // C17/C19/C20 字段保留
    expect(ps.equipments).toBeDefined();
    expect(ps.miningStation).toEqual({ unlocked: true, lastCollectTime: 999 });
    expect(ps.heroFragments).toEqual({ hero_ryan: 12 });
    expect(ps.ownedHeroIds).toEqual(['hero_isen']);
    expect(ps.supplyDrawCount).toBe(3);
    expect(ps.craftCount).toBe(1);
    // 其它既有字段保留
    expect(ps.resources.starCoin).toBe(555);
    expect(ps.heroLevels).toEqual({ hero_isen: 2 });
    expect(ps.clearedLevelIds).toEqual(['1-1']);
    expect(ps.claimedRewardFlowIds).toEqual(['flow_y']);
  });
});

describe('DailyGoalService - persist/load 往返保真', () => {
  it('dailyGoals(startTime/progress/claimedGoalIds) 往返保真', () => {
    const adapter = new MemoryStorageAdapter();
    const state = createInitialPlayerState();
    state.dailyGoals = { startTime: BASE, progress: { d1_clear_1: 2, d2_mining_1: 1 }, claimedGoalIds: ['d1_clear_1'] };
    const ledger = createRewardLedger();

    persistSave(adapter, buildSaveDataFromState(state, ledger, BASE + 100), BASE + 100);
    const reloaded = restoreKeyState(loadSave(adapter, BASE + 200).data);

    expect(reloaded.playerState.dailyGoals).toEqual({ startTime: BASE, progress: { d1_clear_1: 2, d2_mining_1: 1 }, claimedGoalIds: ['d1_clear_1'] });
  });
});
