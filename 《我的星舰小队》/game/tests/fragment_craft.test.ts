import { describe, it, expect } from 'vitest';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';
import {
  CraftConfig,
  DEFAULT_CRAFT_CONFIG,
  craftHero,
} from '../assets/scripts/core/FragmentCraftService';

const THRESHOLD = DEFAULT_CRAFT_CONFIG.thresholdPerHero; // 60

function stateWithFragments(heroId: string, count: number) {
  const state = createInitialPlayerState();
  state.heroFragments[heroId] = count;
  return state;
}

describe('FragmentCraftService - 碎片不足不能合成', () => {
  it('碎片低于阈值时拒绝，不写流水、不扣碎片、不入账、不递增 craftCount', () => {
    const state = stateWithFragments('hero_ryan', THRESHOLD - 1);
    const ledger = createRewardLedger();

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(result.granted).toBe(false);
    expect(result.insufficient).toBe(true);
    expect(ledger.entries.length).toBe(0);
    expect(state.heroFragments.hero_ryan).toBe(THRESHOLD - 1);
    expect(state.ownedHeroIds).toEqual([]);
    expect(state.craftCount).toBe(0);
    expect(result.log).toContain('craft_insufficient_fragments');
  });
});

describe('FragmentCraftService - 恰好达到阈值合成', () => {
  it('恰好达到阈值时合成成功，扣满、余量 0、加入 ownedHeroIds、计数++', () => {
    const state = stateWithFragments('hero_ryan', THRESHOLD);
    const ledger = createRewardLedger();

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(result.granted).toBe(true);
    expect(result.ownedNew).toBe(true);
    expect(result.fragmentsRemaining).toBe(0);
    expect(state.heroFragments.hero_ryan).toBe(0);
    expect(state.ownedHeroIds).toEqual(['hero_ryan']);
    expect(state.craftCount).toBe(1);
    expect(result.nextCraftCount).toBe(1);
    expect(result.flowId).toBeDefined();
    expect(state.claimedRewardFlowIds).toContain(result.flowId);
    const entry = ledger.entries.find((e) => e.flowId === result.flowId);
    expect(entry?.status).toBe('confirmed');
    expect(entry?.sourceId).toBe('craft_0');
    expect(entry?.rewardId).toBe('hero_craft');
    expect(result.log).toContain('craft_hero_owned');
  });
});

describe('FragmentCraftService - 超出阈值扣减并保留余量', () => {
  it('碎片超出阈值时单次只扣 threshold，保留余量', () => {
    const state = stateWithFragments('hero_ryan', THRESHOLD + 25);
    const ledger = createRewardLedger();

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(result.granted).toBe(true);
    expect(result.ownedNew).toBe(true);
    expect(result.fragmentsRemaining).toBe(25);
    expect(state.heroFragments.hero_ryan).toBe(25);
    expect(state.ownedHeroIds).toEqual(['hero_ryan']);
  });
});

describe('FragmentCraftService - 已拥有角色转资源', () => {
  it('已拥有角色再合成转 dupeResourceOnOwned 资源，不重复加入 ownedHeroIds', () => {
    const state = stateWithFragments('hero_ryan', THRESHOLD + 10);
    state.ownedHeroIds = ['hero_ryan'];
    const ledger = createRewardLedger();
    const expChipBefore = state.resources.expChip;

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(result.granted).toBe(true);
    expect(result.ownedNew).toBe(false);
    expect(result.dupeResources).toEqual(DEFAULT_CRAFT_CONFIG.dupeResourceOnOwned);
    expect(state.resources.expChip).toBe(expChipBefore + (DEFAULT_CRAFT_CONFIG.dupeResourceOnOwned.expChip ?? 0));
    expect(state.ownedHeroIds).toEqual(['hero_ryan']); // 未重复加入
    expect(state.heroFragments.hero_ryan).toBe(10); // 保留余量
    expect(result.log).toContain('craft_dupe_to_resources');
  });

  it('自定义配置（阈值/转化资源）生效', () => {
    const config: CraftConfig = { thresholdPerHero: 30, dupeResourceOnOwned: { starCoin: 99 } };
    const state = stateWithFragments('hero_mia', 30);
    state.ownedHeroIds = ['hero_mia'];
    const ledger = createRewardLedger();

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_mia', config });

    expect(result.granted).toBe(true);
    expect(result.threshold).toBe(30);
    expect(result.dupeResources).toEqual({ starCoin: 99 });
    expect(state.resources.starCoin).toBe(99);
    expect(state.heroFragments.hero_mia).toBe(0);
  });
});

describe('FragmentCraftService - 同一 craftCount 重放防重', () => {
  it('同一序号重放被 duplicate 拒绝，不二次扣碎片/入账/递增', () => {
    const state = stateWithFragments('hero_ryan', 200);
    const ledger = createRewardLedger();

    const first = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });
    expect(first.granted).toBe(true);
    expect(state.heroFragments.hero_ryan).toBe(140);
    expect(state.craftCount).toBe(1);

    // 模拟同一 craftCount 重放（计数回退但流水 craft_0 已存在）
    state.craftCount = 0;
    const second = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(state.heroFragments.hero_ryan).toBe(140); // 未二次扣碎片
    expect(state.craftCount).toBe(0); // 未递增
    expect(state.ownedHeroIds).toEqual(['hero_ryan']); // 未变化
    expect(second.log).toContain('craft_duplicate_rejected');
  });
});

describe('FragmentCraftService - 多次合成计数递增', () => {
  it('连续合成 craftCount 递增、碎片按次扣减、首次拥有后续转资源', () => {
    const state = stateWithFragments('hero_ryan', 200);
    const ledger = createRewardLedger();
    const expChipBefore = state.resources.expChip;

    const r1 = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });
    const r2 = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });
    const r3 = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect([r1.granted, r2.granted, r3.granted]).toEqual([true, true, true]);
    expect(r1.ownedNew).toBe(true);
    expect(r2.ownedNew).toBe(false);
    expect(r3.ownedNew).toBe(false);
    expect(state.craftCount).toBe(3);
    expect(state.heroFragments.hero_ryan).toBe(200 - 3 * THRESHOLD); // 20
    expect(state.ownedHeroIds).toEqual(['hero_ryan']);
    // 两次重复合成各转化一次资源
    expect(state.resources.expChip).toBe(expChipBefore + 2 * (DEFAULT_CRAFT_CONFIG.dupeResourceOnOwned.expChip ?? 0));
    expect(ledger.entries.filter((e) => e.status === 'confirmed').length).toBe(3);
  });
});

describe('FragmentCraftService - 与 C20a supplyDrawCount 互不影响', () => {
  it('合成只改 craftCount，不影响 supplyDrawCount；流水来源前缀互不判重', () => {
    const state = stateWithFragments('hero_ryan', THRESHOLD);
    state.supplyDrawCount = 7;
    const ledger = createRewardLedger();
    // 预置一条 supply 流水，验证 craft 不会与之判重
    ledger.entries.push({ flowId: 'flow_supply_7_1', sourceId: 'supply_7', rewardId: 'supply_draw', status: 'confirmed', sequence: 1 });

    const result = craftHero({ playerState: state, rewardLedger: ledger, heroId: 'hero_ryan' });

    expect(result.granted).toBe(true);
    expect(state.craftCount).toBe(1);
    expect(state.supplyDrawCount).toBe(7); // 未受影响
    const craftEntry = ledger.entries.find((e) => e.sourceId === 'craft_0');
    expect(craftEntry?.status).toBe('confirmed');
    // supply 流水与 craft 流水来源前缀不同，互不重叠
    expect(ledger.entries.filter((e) => e.sourceId.startsWith('supply_')).length).toBe(1);
    expect(ledger.entries.filter((e) => e.sourceId.startsWith('craft_')).length).toBe(1);
  });
});
