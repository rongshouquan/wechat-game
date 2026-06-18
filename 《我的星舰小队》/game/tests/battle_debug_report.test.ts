import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildEnemyUnit, buildHeroUnit, simulateBattle, BattleUnit } from '../assets/scripts/combat/BattleEngine';
import {
  buildBattleDebugReport,
  exportBattleLogAsJson,
  findBattleBoundaries,
} from '../assets/scripts/debug/BattleDebugReport';
import { EnemyConfig, HeroConfig, SkillConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

const heroes = readSample<HeroConfig[]>('hero_config.sample.json');
const skills = readSample<SkillConfig[]>('skill_config.sample.json');
const enemies = readSample<EnemyConfig[]>('enemy_config.sample.json');

const isen = heroes.find((h) => h.heroId === 'hero_isen')!;
const mia = heroes.find((h) => h.heroId === 'hero_mia')!;
const drone = enemies.find((e) => e.enemyId === 'enemy_mech_drone')!;
const hammerBoss = enemies.find((e) => e.enemyId === 'enemy_mech_hammer_boss')!;

function buildPlayerSquad(): BattleUnit[] {
  return [
    buildHeroUnit(isen, skills, '#1'),
    buildHeroUnit(isen, skills, '#2'),
    buildHeroUnit(mia, skills, '#1'),
    buildHeroUnit(mia, skills, '#2'),
    buildHeroUnit(mia, skills, '#3'),
  ];
}

function buildEnemyGroup(): BattleUnit[] {
  return [buildEnemyUnit(drone, '#1'), buildEnemyUnit(drone, '#2'), buildEnemyUnit(hammerBoss)];
}

describe('battle log structure', () => {
  it('records battle_start and battle_end with winner, duration and reason', () => {
    const result = simulateBattle(buildPlayerSquad(), buildEnemyGroup(), { timeoutSec: 60 });
    const { start, end } = findBattleBoundaries(result.log);

    expect(start).toBeDefined();
    expect(start!.time).toBe(0);
    expect(start!.playerCount).toBe(5);
    expect(start!.enemyCount).toBe(3);

    expect(end).toBeDefined();
    expect(end!.time).toBe(result.durationSec);
    expect(['player', 'enemy', 'draw']).toContain(end!.winner);
    expect(typeof end!.reason).toBe('string');
  });

  it('records damage entries with sourceId/targetId/amount and heal entries with healed amount', () => {
    const result = simulateBattle(buildPlayerSquad(), buildEnemyGroup(), { timeoutSec: 60 });
    const damage = result.log.find((e) => e.type === 'damage');
    const heal = result.log.find((e) => e.type === 'heal');

    expect(damage).toMatchObject({ type: 'damage' });
    if (damage?.type === 'damage') {
      expect(typeof damage.sourceId).toBe('string');
      expect(typeof damage.targetId).toBe('string');
      expect(damage.amount).toBeGreaterThan(0);
    }
    expect(heal).toMatchObject({ type: 'heal' });
    if (heal?.type === 'heal') {
      expect(heal.amount).toBeGreaterThan(0);
    }
  });

  it('records skill_cast entries with sourceId and skillId', () => {
    const result = simulateBattle(buildPlayerSquad(), buildEnemyGroup(), { timeoutSec: 60 });
    const cast = result.log.find((e) => e.type === 'skill_cast');
    expect(cast).toBeDefined();
    if (cast?.type === 'skill_cast') {
      expect(typeof cast.sourceId).toBe('string');
      expect(typeof cast.skillId).toBe('string');
    }
  });

  it('records a fail reason on the battle_end entry when the player side loses', () => {
    const overwhelmingBoss: EnemyConfig = {
      ...hammerBoss,
      enemyId: 'enemy_test_overwhelming_debug',
      hp: hammerBoss.hp * 3,
      atk: Math.round(hammerBoss.atk * 2.5),
      def: hammerBoss.def * 2,
      aspd: 0.7,
    };
    const result = simulateBattle(buildPlayerSquad(), [buildEnemyUnit(overwhelmingBoss)], { timeoutSec: 30 });
    const end = result.log.find((e) => e.type === 'battle_end');

    expect(result.winner).toBe('enemy');
    expect(result.failReason).toBeDefined();
    expect(end).toMatchObject({ type: 'battle_end', winner: 'enemy' });
  });
});

describe('BattleDebugReport', () => {
  it('summarizes total damage, healing, per-unit damage taken and skill cast counts', () => {
    const result = simulateBattle(buildPlayerSquad(), buildEnemyGroup(), { timeoutSec: 60 });
    const report = buildBattleDebugReport(result);

    const expectedDamage = result.log
      .filter((e): e is Extract<typeof e, { type: 'damage' }> => e.type === 'damage')
      .reduce((sum, e) => sum + e.amount, 0);
    const expectedHealing = result.log
      .filter((e): e is Extract<typeof e, { type: 'heal' }> => e.type === 'heal')
      .reduce((sum, e) => sum + e.amount, 0);

    expect(report.totalDamage).toBe(expectedDamage);
    expect(report.totalHealing).toBe(expectedHealing);
    expect(report.totalDamage).toBeGreaterThan(0);

    // S5D-04: damageTakenByUnit/skillCastCounts 必须是 { unitId/skillId, amount/count } 形状的真实条目
    // （回归 Map.entries() spread 在微信构建降级编译下被错误转换为 [迭代器实例] 的问题）
    expect(report.damageTakenByUnit.length).toBeGreaterThan(0);
    for (const entry of report.damageTakenByUnit) {
      expect(typeof entry.unitId).toBe('string');
      expect(typeof entry.amount).toBe('number');
    }

    // damageTakenByUnit 总和应等于总伤害，且按伤害量降序排列
    const sumPerUnit = report.damageTakenByUnit.reduce((sum, u) => sum + u.amount, 0);
    expect(sumPerUnit).toBe(expectedDamage);
    for (let i = 1; i < report.damageTakenByUnit.length; i++) {
      expect(report.damageTakenByUnit[i - 1].amount).toBeGreaterThanOrEqual(report.damageTakenByUnit[i].amount);
    }

    // skillCastCounts 总数应等于 skill_cast 日志条目数，且按次数降序排列
    const totalCasts = result.log.filter((e) => e.type === 'skill_cast').length;
    const sumCasts = report.skillCastCounts.reduce((sum, s) => sum + s.count, 0);
    expect(sumCasts).toBe(totalCasts);
    for (let i = 1; i < report.skillCastCounts.length; i++) {
      expect(report.skillCastCounts[i - 1].count).toBeGreaterThanOrEqual(report.skillCastCounts[i].count);
    }

    expect(report.winner).toBe(result.winner);
    expect(report.durationSec).toBe(result.durationSec);
  });

  it('includes a fail reason in the report when the squad loses', () => {
    const overwhelmingBoss: EnemyConfig = {
      ...hammerBoss,
      enemyId: 'enemy_test_overwhelming_report',
      hp: hammerBoss.hp * 3,
      atk: Math.round(hammerBoss.atk * 2.5),
      def: hammerBoss.def * 2,
      aspd: 0.7,
    };
    const result = simulateBattle(buildPlayerSquad(), [buildEnemyUnit(overwhelmingBoss)], { timeoutSec: 30 });
    const report = buildBattleDebugReport(result);

    expect(report.winner).toBe('enemy');
    expect(report.failReason).toBeDefined();
    expect(report.failReason).toBe(result.failReason);
  });

  it('exports the battle log as parseable JSON containing winner and log entries', () => {
    const result = simulateBattle(buildPlayerSquad(), buildEnemyGroup(), { timeoutSec: 60 });
    const json = exportBattleLogAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.winner).toBe(result.winner);
    expect(parsed.durationSec).toBe(result.durationSec);
    expect(Array.isArray(parsed.log)).toBe(true);
    expect(parsed.log.length).toBe(result.log.length);
    expect(parsed.log[0].type).toBe('battle_start');
  });
});
