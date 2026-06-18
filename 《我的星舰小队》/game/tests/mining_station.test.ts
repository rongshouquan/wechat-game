import { describe, it, expect } from 'vitest';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  DEFAULT_MINING_STATION_CONFIG,
  MiningStationConfig,
  calculateMiningYield,
  claimMiningYield,
  createDefaultMiningStationState,
} from '../assets/scripts/core/MiningStationService';
import {
  calculateOfflineReward,
  claimOfflineReward,
} from '../assets/scripts/core/OfflineRewardService';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  SaveData,
  createDefaultSaveData,
  buildSaveDataFromState,
  loadSave,
  persistSave,
  restoreKeyState,
} from '../assets/scripts/save/SaveService';

const MS_PER_HOUR = 60 * 60 * 1000;
const BASE_TIME = 1_700_000_000_000;

/** 已锚定（lastCollectTime>0）、已解锁的采矿站玩家状态。 */
function anchoredPlayerState(lastCollectTime = BASE_TIME) {
  const state = createInitialPlayerState();
  state.miningStation.lastCollectTime = lastCollectTime;
  return state;
}

describe('MiningStationService - 产出计算', () => {
  it('解锁、离上次领取 2 小时，按配置率产出 floor(rate*h)', () => {
    const calc = calculateMiningYield({
      station: { unlocked: true, lastCollectTime: BASE_TIME },
      now: BASE_TIME + 2 * MS_PER_HOUR,
    });

    expect(calc.cappedHours).toBe(2);
    expect(calc.capped).toBe(false);
    expect(calc.yield.baseEnergy).toBe(DEFAULT_MINING_STATION_CONFIG.ratePerHour.baseEnergy * 2);
    expect(calc.claimable).toBe(true);
    expect(calc.needsAnchor).toBe(false);
  });

  it('非整数小时按 floor 取整', () => {
    const calc = calculateMiningYield({
      station: { unlocked: true, lastCollectTime: BASE_TIME },
      now: BASE_TIME + 1.5 * MS_PER_HOUR,
    });

    // 300/h * 1.5h = 450
    expect(calc.yield.baseEnergy).toBe(450);
  });
});

describe('MiningStationService - 配置驱动', () => {
  it('封顶时长与产率由配置驱动（替换配置即改变结果）', () => {
    const config: MiningStationConfig = { maxStorageHours: 4, ratePerHour: { baseEnergy: 100 } };
    const calc = calculateMiningYield({
      station: { unlocked: true, lastCollectTime: BASE_TIME },
      now: BASE_TIME + 3 * MS_PER_HOUR,
      config,
    });

    expect(calc.yield.baseEnergy).toBe(300);
  });
});

describe('MiningStationService - 封顶', () => {
  it('超过 maxStorageHours 按封顶计，溢出丢弃并记 mining_storage_capped', () => {
    const calc = calculateMiningYield({
      station: { unlocked: true, lastCollectTime: BASE_TIME },
      now: BASE_TIME + 30 * MS_PER_HOUR,
    });

    expect(calc.capped).toBe(true);
    expect(calc.cappedHours).toBe(DEFAULT_MINING_STATION_CONFIG.maxStorageHours);
    expect(calc.yield.baseEnergy).toBe(
      DEFAULT_MINING_STATION_CONFIG.ratePerHour.baseEnergy * DEFAULT_MINING_STATION_CONFIG.maxStorageHours,
    );
    expect(calc.log).toContain('mining_storage_capped');
  });
});

describe('MiningStationService - 领取入账', () => {
  it('领取成功后资源增加、流水确认、flowId 入账、lastCollectTime 推进到 now', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();
    const now = BASE_TIME + 5 * MS_PER_HOUR;

    const result = claimMiningYield({ playerState, rewardLedger, now });

    expect(result.granted).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.anchored).toBe(false);
    expect(result.nextLastCollectTime).toBe(now);
    expect(playerState.resources.baseEnergy).toBe(result.calculation.yield.baseEnergy);
    expect(playerState.miningStation.lastCollectTime).toBe(now);
    expect(result.flowId).toBeDefined();
    expect(playerState.claimedRewardFlowIds).toContain(result.flowId);
    const entry = rewardLedger.entries.find((e) => e.flowId === result.flowId);
    expect(entry?.status).toBe('confirmed');
    expect(result.log).toContain('mining_collect_granted');
  });
});

describe('MiningStationService - 同一窗口重复领取防重', () => {
  it('同一 lastCollectTime 窗口二次领取被拒绝，不再加资源', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();
    const now = BASE_TIME + 3 * MS_PER_HOUR;

    const first = claimMiningYield({ playerState, rewardLedger, now });
    expect(first.granted).toBe(true);
    const afterFirst = playerState.resources.baseEnergy;
    expect(afterFirst).toBeGreaterThan(0);

    // 模拟杀进程重放同一窗口（lastCollectTime 已推进到 now，用 now 作锚点再领同一窗口）
    playerState.miningStation.lastCollectTime = BASE_TIME;
    const second = claimMiningYield({ playerState, rewardLedger, now });
    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(playerState.resources.baseEnergy).toBe(afterFirst);
    // 重复领取不得推进 lastCollectTime
    expect(playerState.miningStation.lastCollectTime).toBe(BASE_TIME);
    expect(second.log).toContain('mining_collect_duplicate_rejected');
  });
});

describe('MiningStationService - 成功领取后新窗口可再次领取', () => {
  it('领取推进 lastCollectTime 后形成新窗口，可再次领取', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();

    const firstNow = BASE_TIME + 3 * MS_PER_HOUR;
    const first = claimMiningYield({ playerState, rewardLedger, now: firstNow });
    expect(first.granted).toBe(true);
    expect(playerState.miningStation.lastCollectTime).toBe(firstNow);

    const secondNow = firstNow + 2 * MS_PER_HOUR;
    const second = claimMiningYield({ playerState, rewardLedger, now: secondNow });
    expect(second.granted).toBe(true);
    expect(second.duplicate).toBe(false);
    expect(playerState.miningStation.lastCollectTime).toBe(secondNow);
  });
});

describe('MiningStationService - 零间隔/极短间隔不推进', () => {
  it('零间隔（now===lastCollectTime）不发奖、不写流水、不推进', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();

    const result = claimMiningYield({ playerState, rewardLedger, now: BASE_TIME });

    expect(result.granted).toBe(false);
    expect(result.duplicate).toBe(false);
    expect(rewardLedger.entries.length).toBe(0);
    expect(playerState.resources.baseEnergy).toBe(0);
    expect(playerState.miningStation.lastCollectTime).toBe(BASE_TIME);
    expect(result.log).toContain('mining_nothing_to_claim');
  });

  it('极短间隔（floor 后为 0）不推进，保留余量供下次累积跨过 1 单位', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();

    // 300/h => 每 12 秒产 1 点；10 秒内 floor 后为 0
    const tooShort = BASE_TIME + 10_000;
    const first = claimMiningYield({ playerState, rewardLedger, now: tooShort });
    expect(first.granted).toBe(false);
    expect(playerState.miningStation.lastCollectTime).toBe(BASE_TIME); // 余量保留
    expect(rewardLedger.entries.length).toBe(0);

    // 锚点未推进，从原锚点累计到 1 小时后可正常领取
    const later = BASE_TIME + 1 * MS_PER_HOUR;
    const second = claimMiningYield({ playerState, rewardLedger, now: later });
    expect(second.granted).toBe(true);
    expect(second.calculation.yield.baseEnergy).toBe(300);
  });
});

describe('MiningStationService - 时间回退不推进、不发奖', () => {
  it('now<lastCollectTime 时产出 0、不可领取、不推进、不报错', () => {
    const playerState = anchoredPlayerState();
    const rewardLedger = createRewardLedger();

    const result = claimMiningYield({ playerState, rewardLedger, now: BASE_TIME - 5 * MS_PER_HOUR });

    expect(result.calculation.elapsedMs).toBe(0);
    expect(result.granted).toBe(false);
    expect(rewardLedger.entries.length).toBe(0);
    expect(playerState.resources.baseEnergy).toBe(0);
    expect(playerState.miningStation.lastCollectTime).toBe(BASE_TIME);
  });
});

describe('MiningStationService - 首次惰性初始化', () => {
  it('lastCollectTime<=0 时本次产出 0、不写流水、不加资源，但锚定 lastCollectTime=now', () => {
    const playerState = createInitialPlayerState(); // 默认 lastCollectTime=0
    const rewardLedger = createRewardLedger();
    const now = BASE_TIME + 100 * MS_PER_HOUR; // 即使间隔很大也不爆收益

    const result = claimMiningYield({ playerState, rewardLedger, now });

    expect(result.granted).toBe(false);
    expect(result.anchored).toBe(true);
    expect(result.calculation.yield.baseEnergy).toBe(0);
    expect(rewardLedger.entries.length).toBe(0);
    expect(playerState.resources.baseEnergy).toBe(0);
    expect(result.nextLastCollectTime).toBe(now);
    // 状态更新路径：claim 成功把锚点写回 playerState
    expect(playerState.miningStation.lastCollectTime).toBe(now);
    expect(result.log).toContain('mining_anchored');

    // 锚定后再过 2 小时可正常领取
    const after = claimMiningYield({ playerState, rewardLedger, now: now + 2 * MS_PER_HOUR });
    expect(after.granted).toBe(true);
    expect(after.calculation.yield.baseEnergy).toBe(600);
  });
});

describe('MiningStationService - 未解锁门禁', () => {
  it('unlocked=false 时不产出、不可领取、不写流水、不推进', () => {
    const playerState = createInitialPlayerState();
    playerState.miningStation = { unlocked: false, lastCollectTime: BASE_TIME };
    const rewardLedger = createRewardLedger();

    const result = claimMiningYield({ playerState, rewardLedger, now: BASE_TIME + 5 * MS_PER_HOUR });

    expect(result.granted).toBe(false);
    expect(result.calculation.claimable).toBe(false);
    expect(rewardLedger.entries.length).toBe(0);
    expect(playerState.resources.baseEnergy).toBe(0);
    expect(playerState.miningStation.lastCollectTime).toBe(BASE_TIME);
    expect(result.calculation.log).toContain('mining_locked_fallback');
  });
});

describe('MiningStationService - 存档迁移与往返', () => {
  it('v2 旧档（无 miningStation）迁移到 v3，回填默认采矿站且不丢旧字段', () => {
    const adapter = new MemoryStorageAdapter();

    // 构造一份 v2 旧档：playerState 缺 miningStation，但有各既有字段
    const base = createInitialPlayerState();
    base.resources.starCoin = 777;
    base.resources.baseEnergy = 5;
    base.heroLevels = { hero_isen: 3 };
    base.clearedLevelIds = ['1-1', '1-2'];
    base.claimedRewardFlowIds = ['flow_offline_x'];
    const legacyPlayerState: any = { ...base };
    delete legacyPlayerState.miningStation;

    // v2 旧档：缺 miningStation，且天然缺 v6 才引入的 adFrequencyState/defeatSupplyState 顶层字段。
    const v2Save = {
      saveVersion: 2,
      playerState: legacyPlayerState,
      rewardLedger: createRewardLedger(),
      lastOnlineTime: BASE_TIME,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v2Save));

    const result = loadSave(adapter, BASE_TIME + 1000);

    expect(result.migrated).toBe(true);
    expect(result.corrupted).toBe(false);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    // 回填默认采矿站，lastCollectTime=0（惰性锚定哨兵，不爆收益）
    expect(result.data.playerState.miningStation).toEqual(createDefaultMiningStationState());
    expect(result.data.playerState.miningStation.lastCollectTime).toBe(0);
    // 既有字段不丢失
    expect(result.data.playerState.resources.starCoin).toBe(777);
    expect(result.data.playerState.resources.baseEnergy).toBe(5);
    expect(result.data.playerState.heroLevels).toEqual({ hero_isen: 3 });
    expect(result.data.playerState.clearedLevelIds).toEqual(['1-1', '1-2']);
    expect(result.data.playerState.claimedRewardFlowIds).toEqual(['flow_offline_x']);
    expect(result.data.playerState.equipments).toBeDefined();
  });

  it('含 miningStation 的存档 persist/load 往返保真', () => {
    const adapter = new MemoryStorageAdapter();
    const playerState = anchoredPlayerState(BASE_TIME + 7 * MS_PER_HOUR);
    playerState.miningStation.unlocked = true;
    const ledger = createRewardLedger();

    const saveTime = BASE_TIME + 8 * MS_PER_HOUR;
    persistSave(adapter, buildSaveDataFromState(playerState, ledger, saveTime), saveTime);

    const reloaded = restoreKeyState(loadSave(adapter, saveTime + 1000).data);
    expect(reloaded.playerState.miningStation).toEqual(playerState.miningStation);
  });

  it('createDefaultSaveData 的采矿站为默认状态', () => {
    const data = createDefaultSaveData(BASE_TIME);
    expect(data.playerState.miningStation).toEqual(createDefaultMiningStationState());
  });
});

describe('MiningStationService - 与 C11 离线收益硬隔离', () => {
  it('采矿与离线各自独立领取，流水互不判重，时间戳互不影响', () => {
    const playerState = createInitialPlayerState();
    playerState.clearedLevelIds = ['1-1']; // 离线收益需要进度
    playerState.miningStation.lastCollectTime = BASE_TIME; // 采矿已锚定
    const rewardLedger = createRewardLedger();

    const now = BASE_TIME + 3 * MS_PER_HOUR;

    // 先领离线收益
    const offline = claimOfflineReward({
      lastOnlineTime: BASE_TIME,
      now,
      hasProgress: true,
      playerState,
      rewardLedger,
    });
    expect(offline.granted).toBe(true);
    const starAfterOffline = playerState.resources.starCoin;
    expect(starAfterOffline).toBeGreaterThan(0);

    // 再领采矿（同一 ledger）：不应被离线流水判为重复
    const mining = claimMiningYield({ playerState, rewardLedger, now });
    expect(mining.granted).toBe(true);
    expect(mining.duplicate).toBe(false);
    expect(playerState.resources.baseEnergy).toBeGreaterThan(0);

    // 采矿只推进自己的 lastCollectTime，不动 lastOnlineTime 语义（离线推进由 nextLastOnlineTime 表达）
    expect(playerState.miningStation.lastCollectTime).toBe(now);
    expect(offline.nextLastOnlineTime).toBe(now);

    // 离线收益仍能在新窗口继续领取，未被采矿影响
    const offline2 = claimOfflineReward({
      lastOnlineTime: now,
      now: now + 2 * MS_PER_HOUR,
      hasProgress: true,
      playerState,
      rewardLedger,
    });
    expect(offline2.granted).toBe(true);
    expect(offline2.duplicate).toBe(false);

    // 两条产线流水来源前缀不同，互不重叠
    const offlineEntries = rewardLedger.entries.filter((e) => e.sourceId.startsWith('offline_'));
    const miningEntries = rewardLedger.entries.filter((e) => e.sourceId.startsWith('mining_'));
    expect(offlineEntries.length).toBeGreaterThan(0);
    expect(miningEntries.length).toBe(1);
    expect(miningEntries[0].rewardId).toBe('mining_collect');

    // 旁证：离线计算与采矿计算彼此独立
    const offlineCalc = calculateOfflineReward({ lastOnlineTime: now, now: now + MS_PER_HOUR, hasProgress: true });
    expect(offlineCalc.claimable).toBe(true);
  });
});
