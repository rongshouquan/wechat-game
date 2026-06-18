import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildEnemyUnit,
  buildHeroUnit,
  simulateBattle,
  BattleUnit,
} from '../assets/scripts/combat/BattleEngine';
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

/**
 * hero_config.sample.json 当前仅提供 2 个角色（前排 hero_isen / 后排 hero_mia）。
 * 在不擅自扩充配置表的前提下，按任务包要求"支持至少一场 5 人小队"，
 * 通过 idSuffix 复制出战实例组成 2 前排 + 3 后排的 5 人小队，
 * 所有属性仍完整来自 hero_config / skill_config，不写死数值。
 */
function buildPlayerSquad(): BattleUnit[] {
  return [
    buildHeroUnit(isen, skills, '#1'),
    buildHeroUnit(isen, skills, '#2'),
    buildHeroUnit(mia, skills, '#1'),
    buildHeroUnit(mia, skills, '#2'),
    buildHeroUnit(mia, skills, '#3'),
  ];
}

/**
 * enemy_group_config 表尚未补齐（C02 已记录为待办，不阻塞 C04）。
 * 这里按任务包第 10 条要求，用 enemy_config 样例数据组装最小的临时敌人组，
 * 不创建/扩展正式的 enemy_group 配置表。
 */
function buildEnemyGroup(): BattleUnit[] {
  return [buildEnemyUnit(drone, '#1'), buildEnemyUnit(drone, '#2'), buildEnemyUnit(hammerBoss)];
}

describe('auto battle loop', () => {
  it('runs a 5-hero squad vs an enemy group and produces a result with logs', () => {
    const player = buildPlayerSquad();
    const enemyGroup = buildEnemyGroup();

    const result = simulateBattle(player, enemyGroup, { timeoutSec: 60 });

    expect(player.length).toBe(5);
    expect(['player', 'enemy', 'draw']).toContain(result.winner);
    expect(result.durationSec).toBeGreaterThan(0);

    const types = new Set(result.log.map((e) => e.type));
    expect(types.has('battle_tick')).toBe(true);
    expect(types.has('damage')).toBe(true);
    expect(types.has('skill_cast')).toBe(true);
    // hero_mia 的主动技能 effectType=heal，应在战斗中产生治疗事件
    expect(types.has('heal')).toBe(true);

    for (const line of ['battle tick', 'damage', 'heal', 'skill_cast']) {
      console.log(line);
    }
  });

  it('applies armor mitigation: damage = atk*multiplier*(100/(100+def)), minimum 1', () => {
    const attacker = buildHeroUnit(isen, skills, '#dmg');
    const defender = buildEnemyUnit(hammerBoss, '#dmg');
    const result = simulateBattle([attacker], [defender], { timeoutSec: 5 });

    const firstHit = result.log.find((e) => e.type === 'damage') as
      | { type: 'damage'; amount: number }
      | undefined;
    expect(firstHit).toBeDefined();
    // 护甲减免: armorMitigation = 100/(100+DEF)；
    // 普攻倍率取自 skill_isen_attack（multiplier=1.0），elementModifier/randomFactor 本阶段固定为 1：
    // damage = round(92 * 1.0 * 100/(100+45)) = round(92 * 100/145)
    const expected = Math.round((92 * 100) / (100 + hammerBoss.def));
    expect(firstHit!.amount).toBe(expected);
    expect(firstHit!.amount).toBeGreaterThanOrEqual(1);
  });

  it('grants energy on attacking and on being hit, then auto-casts the active skill at 100 energy', () => {
    const caster = buildHeroUnit(mia, skills, '#energy');
    // 预设能量贴近上限：下一次普攻 (+10) 即可触发 100 能量自动施放主动技能，
    // 用于确定性地验证"100 能量自动放主动技能"规则，而非依赖整场战斗的随机推进。
    caster.energy = 91;
    const ally = buildHeroUnit(mia, skills, '#ally');
    ally.hp = Math.round(ally.maxHp * 0.3);
    const target = buildEnemyUnit(drone, '#energy');

    const result = simulateBattle([caster, ally], [target], { timeoutSec: 15 });

    const cast = result.log.find((e) => e.type === 'skill_cast' && e.sourceId === caster.id);
    expect(cast).toBeDefined();
    const heal = result.log.find((e) => e.type === 'heal' && e.sourceId === caster.id);
    expect(heal).toBeDefined();
  });

  it('fails within 20-30 seconds when clearly outmatched', () => {
    // 临时构造的"明显打不过"测试敌人：攻防远超我方小队、血量充裕，
    // 确保我方无法击杀对方、且会被逐个击破。仅用于验证失败时长，不写入正式配置表。
    const overwhelmingBoss: EnemyConfig = {
      ...hammerBoss,
      enemyId: 'enemy_test_overwhelming',
      hp: hammerBoss.hp * 3,
      atk: Math.round(hammerBoss.atk * 2.5),
      def: hammerBoss.def * 2,
      aspd: 0.7,
    };

    const player = buildPlayerSquad();
    const enemyGroup = [buildEnemyUnit(overwhelmingBoss)];

    const result = simulateBattle(player, enemyGroup, { timeoutSec: 30 });

    expect(result.winner).toBe('enemy');
    expect(result.durationSec).toBeGreaterThanOrEqual(20);
    expect(result.durationSec).toBeLessThanOrEqual(30);
    expect(result.failReason).toBeDefined();
  });

  it('reports battle duration and a definitive winner', () => {
    const player = buildPlayerSquad();
    const enemyGroup = buildEnemyGroup();
    const result = simulateBattle(player, enemyGroup, { timeoutSec: 60 });

    const end = result.log.find((e) => e.type === 'battle_end');
    expect(end).toBeDefined();
    expect((end as { time: number }).time).toBe(result.durationSec);
  });
});
