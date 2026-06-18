import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launchLevelBattle } from '../assets/scripts/core/BattleLaunchService';
import { analyzeDefeatReason } from '../assets/scripts/core/DefeatAnalysisService';
import { createInitialPlayerState, PlayerState } from '../assets/scripts/core/PlayerState';
import {
  EnemyConfig,
  EnemyGroupConfig,
  HeroConfig,
  LevelConfig,
  SkillConfig,
} from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');
function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}
const heroes = readSample<HeroConfig[]>('hero_config.sample.json');
const skills = readSample<SkillConfig[]>('skill_config.sample.json');
const enemies = readSample<EnemyConfig[]>('enemy_config.sample.json');
const enemyGroups = readSample<EnemyGroupConfig[]>('enemy_group_config.sample.json');
const levels = readSample<LevelConfig[]>('level_config.sample.json');

/** 默认双人 starter squad，指定各英雄等级。 */
function starterState(isenLevel = 1, miaLevel = 1): PlayerState {
  const state = createInitialPlayerState();
  state.ownedHeroIds = ['hero_isen', 'hero_mia'];
  state.onFieldHeroIds = ['hero_isen', 'hero_mia'];
  state.heroLevels = { hero_isen: isenLevel, hero_mia: miaLevel };
  return state;
}

function fight(levelId: string, state: PlayerState) {
  return launchLevelBattle({ levelId, levels, enemyGroups, enemies, heroes, skills, playerState: state });
}

describe('S5C-05 集成冒烟：新档 L1/L1 通过 1-1', () => {
  it('默认双人 L1/L1 稳定通过 1-1，耗时约 5~6 秒', () => {
    const launch = fight('1-1', starterState(1, 1));
    expect(launch.levelResult.win).toBe(true);
    expect(launch.levelResult.battle.durationSec).toBeGreaterThan(0);
    expect(launch.levelResult.battle.durationSec).toBeLessThanOrEqual(10);
  });
});

describe('S5C-05 集成冒烟：未升级 L2/L2 打 1-5 失败且优先判等级不足', () => {
  it('L2/L2 挑战 1-5 失败，失败主因为 insufficient_level（而非 formation_issue）', () => {
    const launch = fight('1-5', starterState(2, 2));
    expect(launch.levelResult.win).toBe(false);
    expect(launch.defeatContext).toBeDefined();
    const reason = analyzeDefeatReason(launch.defeatContext!);
    expect(reason.type).toBe('insufficient_level');
  });
});

describe('S5C-05 集成冒烟：升级后 hero_isen=3 / hero_mia=2 通过调整后的 1-5', () => {
  it('典型推进等级（3/2）可通过 1-5', () => {
    const launch = fight('1-5', starterState(3, 2));
    expect(launch.levelResult.win).toBe(true);
  });
});

describe('S5C-05 集成冒烟：等级真正影响战斗结果', () => {
  it('同一关卡下高等级阵容战斗结果不劣于低等级（升级有效）', () => {
    const low = fight('1-5', starterState(1, 1));
    const high = fight('1-5', starterState(3, 2));
    // 低等级不应胜过高等级：若低等级已失败，高等级应胜或同样进入更优结果
    expect(low.levelResult.win).toBe(false);
    expect(high.levelResult.win).toBe(true);
  });
});
