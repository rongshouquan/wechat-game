import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assembleSquad, launchLevelBattle } from '../assets/scripts/core/BattleLaunchService';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
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

function statePlaying(onField: string[], heroLevels: Record<string, number> = {}) {
  const state = createInitialPlayerState();
  state.onFieldHeroIds = [...onField];
  state.heroLevels = { ...heroLevels };
  return state;
}

describe('S5C-02 assembleSquad - 真实阵容出战组装', () => {
  it('默认两人阵容：站位按 positionType 分配，等级取真实 heroLevels', () => {
    const state = statePlaying(['hero_isen', 'hero_mia'], { hero_isen: 3 });

    const { units, summary } = assembleSquad({ onFieldHeroIds: state.onFieldHeroIds, heroes, skills, playerState: state });

    expect(units).toHaveLength(2);
    expect(summary).toEqual([
      expect.objectContaining({ heroId: 'hero_isen', role: 'firepower', positionType: 'front', assignedPosition: 'front', level: 3 }),
      expect.objectContaining({ heroId: 'hero_mia', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 1 }),
    ]);
    // 出战单位属性来自 hero_config（满血初始态），unitId 与摘要对应
    expect(units[0].id).toBe(summary[0].unitId);
    expect(units[0].hp).toBe(units[0].maxHp);
  });

  it('前排溢出时落到后排：assignedPosition 与 positionType 不一致作为真实数据保留', () => {
    // hero_isen / hero_ryan / hero_kora 均为前排定位（front），前排容量 2，第三人应落到后排
    const state = statePlaying(['hero_isen', 'hero_ryan', 'hero_kora']);

    const { summary } = assembleSquad({ onFieldHeroIds: state.onFieldHeroIds, heroes, skills, playerState: state });

    expect(summary[0].assignedPosition).toBe('front');
    expect(summary[1].assignedPosition).toBe('front');
    expect(summary[2]).toEqual(
      expect.objectContaining({ heroId: 'hero_kora', positionType: 'front', assignedPosition: 'back' }),
    );
  });

  it('上阵 id 去重且最多取 5 人；引用不存在的英雄抛错', () => {
    const seven = ['hero_isen', 'hero_isen', 'hero_ryan', 'hero_kora', 'hero_mia', 'hero_vex', 'hero_luna', 'hero_nox'];
    const state = statePlaying(seven);
    const { units } = assembleSquad({ onFieldHeroIds: state.onFieldHeroIds, heroes, skills, playerState: state });
    expect(units).toHaveLength(5);

    const bad = statePlaying(['hero_missing']);
    expect(() => assembleSquad({ onFieldHeroIds: bad.onFieldHeroIds, heroes, skills, playerState: bad })).toThrow(
      /hero_missing/,
    );
  });

  it('S5D-04: 去重保持原始出现顺序，重复 id 不影响后续 heroId 的站位顺序', () => {
    // hero_isen 重复出现于第 3 位，去重后应仍按首次出现顺序 [hero_isen, hero_mia, hero_ryan]
    const state = statePlaying(['hero_isen', 'hero_mia', 'hero_isen', 'hero_ryan']);
    const { summary } = assembleSquad({ onFieldHeroIds: state.onFieldHeroIds, heroes, skills, playerState: state });
    expect(summary.map((s) => s.heroId)).toEqual(['hero_isen', 'hero_mia', 'hero_ryan']);
  });
});

describe('S5C-02 launchLevelBattle - 真实战斗驱动胜负与失败上下文', () => {
  // 测试本地构造的必败/必胜敌人与关卡（不写入正式配置表，仅用于确定性验证）
  const overwhelming: EnemyConfig = {
    schemaVersion: '0.1.0',
    enemyId: 'enemy_test_overwhelming',
    name: '测试压制者',
    faction: 'mechanical',
    hp: 99999,
    atk: 500,
    def: 200,
    aspd: 1.2,
  };
  const feeble: EnemyConfig = {
    schemaVersion: '0.1.0',
    enemyId: 'enemy_test_feeble',
    name: '测试残骸',
    faction: 'mechanical',
    hp: 1,
    atk: 1,
    def: 0,
    aspd: 0.5,
  };
  const testLevels: LevelConfig[] = [
    { schemaVersion: '0.1.0', levelId: 't-lose', chapter: 1, stage: 1, type: 'normal', enemyGroupId: 'eg_t_lose', recommendedPower: 700, rewardId: 'rw_1_1' },
    { schemaVersion: '0.1.0', levelId: 't-win', chapter: 1, stage: 2, type: 'normal', enemyGroupId: 'eg_t_win', recommendedPower: 80, rewardId: 'rw_1_2' },
    { schemaVersion: '0.1.0', levelId: 't-broken', chapter: 1, stage: 3, type: 'normal', enemyGroupId: 'eg_missing', recommendedPower: 80, rewardId: 'rw_1_3' },
  ];
  const testGroups: EnemyGroupConfig[] = [
    { schemaVersion: '0.1.0', enemyGroupId: 'eg_t_lose', enemies: [{ enemyId: 'enemy_test_overwhelming', count: 1 }], timeoutSec: 30 },
    { schemaVersion: '0.1.0', enemyGroupId: 'eg_t_win', enemies: [{ enemyId: 'enemy_test_feeble', count: 1 }], timeoutSec: 30 },
  ];
  const testEnemies = [overwhelming, feeble];

  it('明显打不过时判负：defeatContext 为真实战报/真实阵容/关卡 recommendedPower', () => {
    const state = statePlaying(['hero_isen', 'hero_mia'], { hero_isen: 2, hero_mia: 2 });

    const launch = launchLevelBattle({
      levelId: 't-lose',
      levels: testLevels,
      enemyGroups: testGroups,
      enemies: testEnemies,
      heroes,
      skills,
      playerState: state,
    });

    expect(launch.levelResult.win).toBe(false);
    expect(launch.report.winner).toBe('enemy');
    expect(launch.report.failReason).toBeDefined();
    expect(launch.report.totalDamage).toBeGreaterThan(0);
    expect(launch.report.damageTakenByUnit.length).toBeGreaterThan(0);

    const ctx = launch.defeatContext!;
    expect(ctx).toBeDefined();
    expect(ctx.levelId).toBe('t-lose');
    expect(ctx.recommendedPower).toBe(700);
    expect(ctx.report).toBe(launch.report);
    expect(ctx.squad.map((m) => m.heroId)).toEqual(['hero_isen', 'hero_mia']);
    expect(ctx.squad.map((m) => m.level)).toEqual([2, 2]);
  });

  it('稳赢时判胜：win=true，无失败上下文，战报为真实聚合数据', () => {
    const state = statePlaying(['hero_isen', 'hero_mia']);

    const launch = launchLevelBattle({
      levelId: 't-win',
      levels: testLevels,
      enemyGroups: testGroups,
      enemies: testEnemies,
      heroes,
      skills,
      playerState: state,
    });

    expect(launch.levelResult.win).toBe(true);
    expect(launch.report.winner).toBe('player');
    expect(launch.defeatContext).toBeUndefined();
    expect(launch.report.totalDamage).toBeGreaterThan(0);
  });

  it('关卡不存在或敌组缺失时抛错（数据错误不静默）', () => {
    const state = statePlaying(['hero_isen']);
    const base = { levels: testLevels, enemyGroups: testGroups, enemies: testEnemies, heroes, skills, playerState: state };

    expect(() => launchLevelBattle({ ...base, levelId: 'no-such-level' })).toThrow(/no-such-level/);
    expect(() => launchLevelBattle({ ...base, levelId: 't-broken' })).toThrow(/eg_missing/);
  });

  it('真实样例配置冒烟：1-1 + 新档默认阵容，结果自洽（胜负/战报/失败上下文互相一致）', () => {
    const state = statePlaying(['hero_isen', 'hero_mia']);

    const launch = launchLevelBattle({
      levelId: '1-1',
      levels,
      enemyGroups,
      enemies,
      heroes,
      skills,
      playerState: state,
    });

    expect(launch.levelResult.win).toBe(launch.report.winner === 'player');
    expect(launch.squad).toHaveLength(2);
    if (launch.levelResult.win) {
      expect(launch.defeatContext).toBeUndefined();
    } else {
      expect(launch.defeatContext?.levelId).toBe('1-1');
      expect(launch.defeatContext?.recommendedPower).toBe(80);
    }
    // 引擎无随机源，固定输入应得到固定结果（防回归锚点：当前样例数值下 1-1 的确定性胜负）
    const rerun = launchLevelBattle({ levelId: '1-1', levels, enemyGroups, enemies, heroes, skills, playerState: statePlaying(['hero_isen', 'hero_mia']) });
    expect(rerun.levelResult.win).toBe(launch.levelResult.win);
    console.log('[battle_launch] 1-1 默认阵容实测结果:', launch.report.winner, `${launch.report.durationSec}s`, launch.report.failReason ?? 'win');
  });
});
