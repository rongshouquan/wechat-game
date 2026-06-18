import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildHeroUnit, BattleUnit } from '../assets/scripts/combat/BattleEngine';
import {
  buildEnemyGroupUnits,
  isBossLevel,
  progressCampaign,
  runLevelBattle,
} from '../assets/scripts/core/LevelProgression';
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
const levels = readSample<LevelConfig[]>('level_config.sample.json');
const groups = readSample<EnemyGroupConfig[]>('enemy_group_config.sample.json');

const isen = heroes.find((h) => h.heroId === 'hero_isen')!;
const mia = heroes.find((h) => h.heroId === 'hero_mia')!;
const enemyById = new Map(enemies.map((e) => [e.enemyId, e]));
const groupsById = new Map(groups.map((g) => [g.enemyGroupId, g]));
const lookupEnemy = (id: string) => enemyById.get(id);

/** 与 battle.test.ts 一致：复制出战实例组成 2 前排 + 3 后排的 5 人小队。 */
function buildPlayerSquad(): BattleUnit[] {
  return [
    buildHeroUnit(isen, skills, '#1'),
    buildHeroUnit(isen, skills, '#2'),
    buildHeroUnit(mia, skills, '#1'),
    buildHeroUnit(mia, skills, '#2'),
    buildHeroUnit(mia, skills, '#3'),
  ];
}

/** 明显打不过的小队：用于验证关卡失败时的结果与停留行为。 */
function buildWeakSquad(): BattleUnit[] {
  const unit = buildHeroUnit(mia, skills, '#weak');
  unit.hp = 1;
  (unit as { maxHp: number }).maxHp = 1;
  return [unit];
}

describe('LevelProgression', () => {
  it('classifies boss levels by levelId / type (x-10 and x-20 are boss nodes)', () => {
    const lvl110 = levels.find((l) => l.levelId === '1-10')!;
    const lvl11 = levels.find((l) => l.levelId === '1-1')!;
    expect(isBossLevel(lvl110)).toBe(true);
    expect(isBossLevel(lvl11)).toBe(false);
    expect(isBossLevel({ ...lvl11, levelId: '1-20', type: 'boss' })).toBe(true);
  });

  it('builds enemy units from an enemy group config using enemy_config data', () => {
    const group = groupsById.get('eg_1_1')!;
    const units = buildEnemyGroupUnits(group, lookupEnemy);
    expect(units.length).toBe(group.enemies.reduce((sum, m) => sum + m.count, 0));
    expect(units.every((u) => u.side === 'enemy')).toBe(true);
  });

  it('runs a single level battle and reports win/loss with the right boss flag', () => {
    const level = levels.find((l) => l.levelId === '1-1')!;
    const group = groupsById.get(level.enemyGroupId)!;
    const result = runLevelBattle(level, group, lookupEnemy, buildPlayerSquad, { timeoutSec: 60 });
    expect(result.levelId).toBe('1-1');
    expect(result.isBoss).toBe(false);
    expect(['player', 'enemy', 'draw']).toContain(result.battle.winner);
  });

  it('progresses through levels 1-1..1-10, marking stage_win and the 1-10 boss fight', () => {
    const progress = progressCampaign(levels, groupsById, lookupEnemy, buildPlayerSquad, { timeoutSec: 60 });

    expect(progress.outcomes.find((o) => o.type === 'stage_win' && o.levelId === '1-1')).toBeDefined();
    expect(progress.outcomes.find((o) => o.type === 'boss_start' && o.levelId === '1-10')).toBeDefined();

    const last = progress.outcomes[progress.outcomes.length - 1];
    expect(['boss_win', 'boss_fail', 'stage_fail']).toContain(last.type);

    if (last.type === 'boss_win') {
      expect(progress.clearedLevelIds).toContain('1-10');
      expect(progress.failReason).toBeUndefined();
    } else {
      expect(progress.failReason).toBeDefined();
      expect(progress.currentLevelId).toBe(last.levelId);
    }
  });

  it('stays at the failed level and returns a failure reason when the squad cannot win', () => {
    const progress = progressCampaign(levels.slice(0, 1), groupsById, lookupEnemy, buildWeakSquad, { timeoutSec: 30 });

    expect(progress.outcomes[0]).toEqual({ type: 'stage_fail', levelId: '1-1', reason: progress.failReason });
    expect(progress.currentLevelId).toBe('1-1');
    expect(progress.clearedLevelIds).toEqual([]);
    expect(progress.failReason).toBeDefined();
  });

  it('emits boss_start / boss_win or boss_fail markers for a standalone boss-level run', () => {
    const bossLevel = levels.find((l) => l.levelId === '1-10')!;
    const progress = progressCampaign([bossLevel], groupsById, lookupEnemy, buildPlayerSquad, { timeoutSec: 90 });

    expect(progress.outcomes[0]).toEqual({ type: 'boss_start', levelId: '1-10' });
    const second = progress.outcomes[1];
    expect(['boss_win', 'boss_fail']).toContain(second.type);
    if (second.type === 'boss_fail') {
      expect(second.reason).toBeDefined();
      expect(progress.currentLevelId).toBe('1-10');
    } else {
      expect(progress.clearedLevelIds).toEqual(['1-10']);
    }
  });
});
