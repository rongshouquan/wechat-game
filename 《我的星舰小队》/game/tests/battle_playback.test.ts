import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launchLevelBattle } from '../assets/scripts/core/BattleLaunchService';
import { buildBattlePlayback, buildUnitLabels } from '../assets/scripts/core/BattlePlaybackService';
import { LevelBattleResult } from '../assets/scripts/core/LevelProgression';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { BattleResult, BattleSide, BattleUnit } from '../assets/scripts/combat/BattleEngine';
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

/** 跑一场真实关卡战斗（默认双人阵容打第一关），可选传 simOptions 控制超时。 */
function launchDefault(simOptions?: { timeoutSec?: number }) {
  const state = createInitialPlayerState();
  state.onFieldHeroIds = ['hero_isen', 'hero_mia'];
  return launchLevelBattle({
    levelId: levels[0].levelId,
    levels,
    enemyGroups,
    enemies,
    heroes,
    skills,
    playerState: state,
    simOptions,
  });
}

function fakeUnit(id: string, name: string, side: BattleSide, maxHp: number): BattleUnit {
  return {
    id,
    name,
    side,
    maxHp,
    hp: maxHp,
    baseAtk: 10,
    baseDef: 0,
    aspd: 1,
    energy: 0,
    attackTimer: 0,
    shield: 0,
    modifiers: [],
    normalSkill: null,
    activeSkill: null,
  };
}

describe('S5C-04 buildBattlePlayback - 真实战斗日志驱动的播放帧', () => {
  const launch = launchDefault();
  const battle = launch.levelResult.battle;
  const playback = buildBattlePlayback(launch.levelResult);

  it('帧与日志一一对应，simTime/wallTime 单调不减，事件顺序与日志一致', () => {
    expect(playback.frames).toHaveLength(battle.log.length);
    for (let i = 1; i < playback.frames.length; i++) {
      expect(playback.frames[i].simTime).toBeGreaterThanOrEqual(playback.frames[i - 1].simTime);
      expect(playback.frames[i].wallTime).toBeGreaterThanOrEqual(playback.frames[i - 1].wallTime);
    }
    const logEventTypes = battle.log
      .filter((e) => e.type === 'damage' || e.type === 'heal' || e.type === 'skill_cast')
      .map((e) => (e.type === 'skill_cast' ? 'skill' : e.type));
    const frameEventKinds = playback.frames
      .filter((f) => f.kind === 'damage' || f.kind === 'heal' || f.kind === 'skill')
      .map((f) => f.kind);
    expect(frameEventKinds).toEqual(logEventTypes);
    for (const frame of playback.frames) {
      if (frame.kind === 'damage' || frame.kind === 'heal' || frame.kind === 'skill') {
        expect(frame.eventText).toBeTruthy();
      }
    }
  });

  it('起始帧为双方满血/全员存活，末帧胜负与引擎结果一致', () => {
    const first = playback.frames[0];
    expect(first.kind).toBe('start');
    const playerMaxHp = launch.levelResult.playerUnits.reduce((acc, u) => acc + u.maxHp, 0);
    const enemyMaxHp = launch.levelResult.enemyUnits.reduce((acc, u) => acc + u.maxHp, 0);
    expect(first.summary).toMatchObject({
      alivePlayers: launch.levelResult.playerUnits.length,
      aliveEnemies: launch.levelResult.enemyUnits.length,
      playerHp: playerMaxHp,
      enemyHp: enemyMaxHp,
      playerMaxHp,
      enemyMaxHp,
    });

    const last = playback.frames[playback.frames.length - 1];
    expect(last.kind).toBe('end');
    expect(last.winner).toBe(battle.winner);
    expect(playback.winner).toBe(battle.winner);
    // 1-1 + 默认阵容为确定性胜局（S5C-02 实测）：末帧敌方全灭
    expect(battle.winner).toBe('player');
    expect(last.summary.aliveEnemies).toBe(0);
    expect(last.summary.enemyHp).toBe(0);
  });

  it('tick 帧血量摘要逐条等于引擎日志的权威 hp 快照', () => {
    const tickEntries = battle.log.filter((e) => e.type === 'battle_tick');
    const tickFrames = playback.frames.filter((f) => f.kind === 'tick');
    expect(tickFrames).toHaveLength(tickEntries.length);
    tickEntries.forEach((entry, i) => {
      expect(entry.hp).toBeDefined();
      expect(tickFrames[i].summary.playerHp).toBe(entry.hp!.player);
      expect(tickFrames[i].summary.enemyHp).toBe(entry.hp!.enemy);
      expect(tickFrames[i].summary.alivePlayers).toBe(entry.alivePlayers);
      expect(tickFrames[i].summary.aliveEnemies).toBe(entry.aliveEnemies);
    });
  });

  it('模拟时长不超过目标观看时长时不加速（wallTime == simTime）', () => {
    expect(battle.durationSec).toBeLessThanOrEqual(6);
    expect(playback.speed).toBe(1);
    for (const frame of playback.frames) {
      expect(frame.wallTime).toBe(frame.simTime);
    }
  });
});

describe('S5C-04 buildBattlePlayback - 真实败局（短超时强制失败）', () => {
  it('超时败局：末帧失败、双方仍存活（存活数来自引擎而非由胜负推导）', () => {
    const launch = launchDefault({ timeoutSec: 0.5 });
    expect(launch.levelResult.win).toBe(false);
    expect(launch.defeatContext).toBeDefined();

    const playback = buildBattlePlayback(launch.levelResult);
    const last = playback.frames[playback.frames.length - 1];
    expect(last.kind).toBe('end');
    expect(last.winner).toBe('enemy');
    // timeout 败局双方都未团灭：末帧存活数必须取自引擎 battle_end 快照
    expect(last.summary.alivePlayers).toBeGreaterThan(0);
    expect(last.summary.aliveEnemies).toBeGreaterThan(0);
  });
});

describe('S5C-04 buildBattlePlayback - 长战局加速', () => {
  it('30 秒战局按上限 5 倍速压缩到 6 秒，只压时间不改顺序', () => {
    const battle: BattleResult = {
      winner: 'enemy',
      durationSec: 30,
      failReason: 'timeout',
      log: [
        { type: 'battle_start', time: 0, playerCount: 1, enemyCount: 1 },
        { type: 'battle_tick', time: 0, alivePlayers: 1, aliveEnemies: 1, hp: { player: 100, enemy: 100 } },
        { type: 'damage', time: 15, sourceId: 'e#1', targetId: 'p', amount: 60 },
        {
          type: 'battle_end',
          time: 30,
          winner: 'enemy',
          reason: 'timeout',
          hp: { player: 40, enemy: 100 },
          alivePlayers: 1,
          aliveEnemies: 1,
        },
      ],
    };
    const levelResult: LevelBattleResult = {
      levelId: 'synthetic',
      isBoss: false,
      battle,
      win: false,
      failReason: 'timeout',
      playerUnits: [fakeUnit('p', '测试员', 'player', 100)],
      enemyUnits: [fakeUnit('e#1', '靶机', 'enemy', 100)],
    };

    const playback = buildBattlePlayback(levelResult);
    expect(playback.speed).toBe(5);
    expect(playback.wallDurationSec).toBe(6);
    expect(playback.frames.map((f) => f.wallTime)).toEqual([0, 0, 3, 6]);
    expect(playback.frames.map((f) => f.kind)).toEqual(['start', 'tick', 'damage', 'end']);
    // 末帧摘要取引擎 battle_end 快照
    const last = playback.frames[playback.frames.length - 1];
    expect(last.summary.playerHp).toBe(40);
    expect(last.summary.alivePlayers).toBe(1);
  });
});

describe('S5C-04 buildUnitLabels - 同名单位展示后缀', () => {
  it('同名敌人附加 id 中的 #n 后缀，唯一名不加后缀', () => {
    const labels = buildUnitLabels([
      fakeUnit('hero_isen', '伊森', 'player', 100),
      fakeUnit('enemy_bug#1', '雷虫', 'enemy', 50),
      fakeUnit('enemy_bug#2', '雷虫', 'enemy', 50),
    ]);
    expect(labels.get('hero_isen')).toBe('伊森');
    expect(labels.get('enemy_bug#1')).toBe('雷虫#1');
    expect(labels.get('enemy_bug#2')).toBe('雷虫#2');
  });
});
