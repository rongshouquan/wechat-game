import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildHeroUnit, BattleUnit } from '../assets/scripts/combat/BattleEngine';
import {
  computeUpgradeCost,
  createInitialPlayerState,
  getHeroLevel,
  upgradeHero,
} from '../assets/scripts/core/PlayerState';
import { confirmRewardGrant, createRewardLedger, requestRewardGrant } from '../assets/scripts/core/RewardLedger';
import {
  playLevelAndSettle,
  settleLevelDefeat,
  settleLevelVictory,
} from '../assets/scripts/core/LevelRewardSettlement';
import {
  EnemyConfig,
  EnemyGroupConfig,
  HeroConfig,
  LevelConfig,
  RewardConfig,
  SkillConfig,
} from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

const heroes = readSample<HeroConfig[]>('hero_config.sample.json');
const skills = readSample<SkillConfig[]>('skill_config.sample.json');
const enemies = readSample<EnemyConfig[]>('enemy_config.sample.json');
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const groups = readSample<EnemyGroupConfig[]>('enemy_group_config.sample.json');
const rewards = readSample<RewardConfig[]>('reward_config.sample.json');

const isen = heroes.find((h) => h.heroId === 'hero_isen')!;
const mia = heroes.find((h) => h.heroId === 'hero_mia')!;
const enemyById = new Map(enemies.map((e) => [e.enemyId, e]));
const groupsById = new Map(groups.map((g) => [g.enemyGroupId, g]));
const rewardById = new Map(rewards.map((r) => [r.rewardId, r]));
const lookupEnemy = (id: string) => enemyById.get(id);

const level11 = levels.find((l) => l.levelId === '1-1')!;
const group11 = groupsById.get(level11.enemyGroupId)!;
const reward11 = rewardById.get(level11.rewardId)!;

function buildPlayerSquad(): BattleUnit[] {
  return [
    buildHeroUnit(isen, skills, '#1'),
    buildHeroUnit(isen, skills, '#2'),
    buildHeroUnit(mia, skills, '#1'),
    buildHeroUnit(mia, skills, '#2'),
    buildHeroUnit(mia, skills, '#3'),
  ];
}

function buildWeakSquad(): BattleUnit[] {
  const unit = buildHeroUnit(mia, skills, '#weak');
  unit.hp = 1;
  (unit as { maxHp: number }).maxHp = 1;
  return [unit];
}

describe('hero upgrade', () => {
  it('upgrades successfully when resources are sufficient, consuming starCoin/expChip', () => {
    const state = createInitialPlayerState();
    const cost = computeUpgradeCost(getHeroLevel(state, 'hero_isen'));
    state.resources.starCoin = cost.starCoin;
    state.resources.expChip = cost.expChip;

    const result = upgradeHero(state, 'hero_isen');
    console.log('hero_level_up');

    expect(result).toMatchObject({ ok: true, fromLevel: 1, toLevel: 2 });
    expect(getHeroLevel(state, 'hero_isen')).toBe(2);
    expect(state.resources.starCoin).toBe(0);
    expect(state.resources.expChip).toBe(0);
  });

  it('rejects upgrade when resources are insufficient and does not deduct anything', () => {
    const state = createInitialPlayerState();
    state.resources.starCoin = 1;
    state.resources.expChip = 0;

    const result = upgradeHero(state, 'hero_isen');

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(getHeroLevel(state, 'hero_isen')).toBe(1);
    expect(state.resources.starCoin).toBe(1);
    expect(state.resources.expChip).toBe(0);
  });
});

describe('reward ledger and level settlement', () => {
  it('creates and grants a reward flow on first claim ("reward created" -> "reward granted")', () => {
    const ledger = createRewardLedger();
    const outcome = requestRewardGrant(ledger, '1-1', 'rw_1_1');

    expect(outcome.granted).toBe(true);
    expect(outcome.duplicate).toBe(false);
    expect(outcome.log).toEqual(['reward created', 'reward granted']);
    expect(outcome.entry.status).toBe('granted');

    confirmRewardGrant(outcome.entry);
    expect(outcome.entry.status).toBe('confirmed');
  });

  it('grants level reward on victory and applies it to player resources', () => {
    const ledger = createRewardLedger();
    const state = createInitialPlayerState();
    const before = { ...state.resources };

    const outcome = settleLevelVictory(ledger, state, '1-1', reward11);

    expect(outcome.granted).toBe(true);
    expect(outcome.duplicate).toBe(false);
    expect(state.clearedLevelIds).toContain('1-1');
    expect(state.claimedRewardFlowIds).toContain(outcome.flowId);
    expect(state.resources.starCoin).toBe(before.starCoin + (reward11.starCoin ?? 0));
    expect(state.resources.expChip).toBe(before.expChip + (reward11.expChip ?? 0));
  });

  it('rejects duplicate claims for the same level reward ("duplicate reward rejected")', () => {
    const ledger = createRewardLedger();
    const state = createInitialPlayerState();

    const first = settleLevelVictory(ledger, state, '1-1', reward11);
    const resourcesAfterFirst = { ...state.resources };

    const second = settleLevelVictory(ledger, state, '1-1', reward11);
    console.log(second.log[0]);

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.log).toEqual(['duplicate reward rejected']);
    // 重复领取不应再次发放资源
    expect(state.resources).toEqual(resourcesAfterFirst);
    expect(state.clearedLevelIds.filter((id) => id === '1-1').length).toBe(1);
  });

  it('does not grant a reward on level defeat', () => {
    const outcome = settleLevelDefeat('1-1');
    expect(outcome.win).toBe(false);
    expect(outcome.granted).toBe(false);
    expect(outcome.duplicate).toBe(false);
  });
});

describe('playLevelAndSettle (LevelProgression integration)', () => {
  it('settles and grants reward after a level victory', () => {
    const ledger = createRewardLedger();
    const state = createInitialPlayerState();

    const result = playLevelAndSettle(level11, group11, reward11, lookupEnemy, buildPlayerSquad, ledger, state, {
      timeoutSec: 60,
    });

    expect(result.battle.win).toBe(true);
    expect(result.settlement.granted).toBe(true);
    expect(state.clearedLevelIds).toContain('1-1');
    expect(state.resources.starCoin).toBeGreaterThan(0);
  });

  it('does not grant a reward when the boss fight fails (boss defeat -> no reward)', () => {
    const bossLevel = levels.find((l) => l.levelId === '1-10')!;
    const bossGroup = groupsById.get(bossLevel.enemyGroupId)!;
    const bossReward = rewardById.get(bossLevel.rewardId)!;

    const ledger = createRewardLedger();
    const state = createInitialPlayerState();

    const result = playLevelAndSettle(bossLevel, bossGroup, bossReward, lookupEnemy, buildWeakSquad, ledger, state, {
      timeoutSec: 30,
    });

    expect(result.battle.win).toBe(false);
    expect(result.battle.failReason).toBeDefined();
    expect(result.settlement.granted).toBe(false);
    expect(state.clearedLevelIds).not.toContain('1-10');
    expect(state.resources.starCoin).toBe(0);
    expect(ledger.entries.length).toBe(0);
  });
});
