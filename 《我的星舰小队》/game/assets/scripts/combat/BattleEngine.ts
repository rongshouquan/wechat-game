import { EnemyConfig, HeroConfig, SkillConfig } from '../config/ConfigTypes';

export type BattleSide = 'player' | 'enemy';
export type StatKey = 'atk' | 'def';

export interface StatModifier {
  stat: StatKey;
  amount: number;
  expiresAt: number;
}

export interface BattleUnit {
  readonly id: string;
  readonly name: string;
  readonly side: BattleSide;
  readonly maxHp: number;
  hp: number;
  readonly baseAtk: number;
  readonly baseDef: number;
  readonly aspd: number;
  energy: number;
  attackTimer: number;
  shield: number;
  modifiers: StatModifier[];
  readonly normalSkill: SkillConfig | null;
  readonly activeSkill: SkillConfig | null;
}

/** 双方当前 HP 合计快照（battle_tick / battle_end 附带，供战斗过程展示层读取权威血量）。 */
export interface SideHpTotals {
  player: number;
  enemy: number;
}

export type BattleLogEntry =
  | { type: 'battle_start'; time: number; playerCount: number; enemyCount: number }
  | { type: 'battle_tick'; time: number; alivePlayers: number; aliveEnemies: number; hp?: SideHpTotals }
  | { type: 'damage'; time: number; sourceId: string; targetId: string; amount: number; skillId?: string }
  | { type: 'heal'; time: number; sourceId: string; targetId: string; amount: number; skillId?: string }
  | { type: 'skill_cast'; time: number; sourceId: string; skillId: string; targetId?: string }
  | {
      type: 'battle_end';
      time: number;
      winner: BattleSide | 'draw';
      reason: string;
      hp?: SideHpTotals;
      alivePlayers?: number;
      aliveEnemies?: number;
    };

export interface BattleResult {
  winner: BattleSide | 'draw';
  durationSec: number;
  log: BattleLogEntry[];
  failReason?: string;
}

const TICK_SECONDS = 0.1;
const ENERGY_ON_ATTACK = 10;
const ENERGY_ON_HIT = 3;
const ENERGY_FULL = 100;
const TICK_LOG_INTERVAL = 1.0;

/**
 * 出战单位的最终属性（已含装备等外部加成）。
 * 由调用方（如 EquipmentService）在 BattleEngine 之外算好后传入，BattleEngine 自身不读取
 * PlayerState、不读取装备定义，只按传入值覆盖 hp/atk/def。
 */
export interface FinalStats {
  hp: number;
  atk: number;
  def: number;
}

/**
 * 从 hero_config + skill_config 构建出战单位，按 type 字段区分普攻 (normal) 与主动技能 (active)。
 * 不传 finalStats 时保持旧逻辑：直接使用 hero 的 baseHp/baseAtk/baseDef。
 * 传 finalStats 时仅覆盖 hp/atk/def（含 maxHp），其余字段不变。
 */
export function buildHeroUnit(hero: HeroConfig, skills: SkillConfig[], idSuffix = '', finalStats?: FinalStats): BattleUnit {
  const ownSkills = skills.filter((s) => s.ownerHeroId === hero.heroId);
  const normalSkill = ownSkills.find((s) => s.type === 'normal') ?? null;
  const activeSkill = ownSkills.find((s) => s.type === 'active') ?? null;
  const hp = finalStats?.hp ?? hero.baseHp;
  const atk = finalStats?.atk ?? hero.baseAtk;
  const def = finalStats?.def ?? hero.baseDef;
  return {
    id: `${hero.heroId}${idSuffix}`,
    name: hero.name,
    side: 'player',
    maxHp: hp,
    hp,
    baseAtk: atk,
    baseDef: def,
    aspd: hero.aspd,
    energy: 0,
    attackTimer: 0,
    shield: 0,
    modifiers: [],
    normalSkill,
    activeSkill,
  };
}

/** 从 enemy_config 构建出战单位。当前样例表未提供敌方技能数据，敌人仅使用普攻（倍率 1）。 */
export function buildEnemyUnit(enemy: EnemyConfig, idSuffix = ''): BattleUnit {
  return {
    id: `${enemy.enemyId}${idSuffix}`,
    name: enemy.name,
    side: 'enemy',
    maxHp: enemy.hp,
    hp: enemy.hp,
    baseAtk: enemy.atk,
    baseDef: enemy.def,
    aspd: enemy.aspd,
    energy: 0,
    attackTimer: 0,
    shield: 0,
    modifiers: [],
    normalSkill: null,
    activeSkill: null,
  };
}

function isAlive(unit: BattleUnit): boolean {
  return unit.hp > 0;
}

/** 双方当前 HP 合计（含护盾外的真实 hp），随 tick/end 日志输出，供展示层免于重放伤害公式。 */
function sideHpTotals(playerUnits: BattleUnit[], enemyUnits: BattleUnit[]): SideHpTotals {
  const sum = (units: BattleUnit[]): number => units.reduce((acc, u) => acc + u.hp, 0);
  return { player: sum(playerUnits), enemy: sum(enemyUnits) };
}

function effectiveStat(unit: BattleUnit, stat: StatKey, now: number): number {
  const base = stat === 'atk' ? unit.baseAtk : unit.baseDef;
  let bonus = 0;
  for (const mod of unit.modifiers) {
    if (mod.stat === stat && mod.expiresAt > now) bonus += mod.amount;
  }
  return Math.max(0, base + bonus);
}

function pruneExpiredModifiers(unit: BattleUnit, now: number): void {
  unit.modifiers = unit.modifiers.filter((m) => m.expiresAt > now);
}

export type ElementModifierFn = (attackerElement: string | undefined, defenderElement: string | undefined) => number;

/** 默认属性克制：尚无电磁/火焰/光能克制数据，固定返回 1，预留入口供后续接入。 */
export const defaultElementModifier: ElementModifierFn = () => 1;

export interface DamageParams {
  attackerAtk: number;
  defenderDef: number;
  multiplier: number;
  /** 属性克制修正，默认 1（固定值，待属性克制数据补齐后接入 defaultElementModifier 之外的实现）。 */
  elementModifier?: number;
  /** 随机浮动系数，本阶段固定为 1，便于测试确定性。 */
  randomFactor?: number;
}

/**
 * 护甲减免公式（按设计资料）：
 *   armorMitigation = 100 / (100 + DEF)
 *   damage = ATK * multiplier * armorMitigation * elementModifier * randomFactor
 * 至少造成 1 点伤害。
 */
function computeDamage(params: DamageParams): number {
  const { attackerAtk, defenderDef, multiplier, elementModifier = 1, randomFactor = 1 } = params;
  const armorMitigation = 100 / (100 + defenderDef);
  const raw = attackerAtk * multiplier * armorMitigation * elementModifier * randomFactor;
  return Math.max(1, Math.round(raw));
}

function applyDamage(
  log: BattleLogEntry[],
  time: number,
  source: BattleUnit,
  target: BattleUnit,
  amount: number,
  skillId?: string,
): void {
  let remaining = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remaining);
  log.push({ type: 'damage', time, sourceId: source.id, targetId: target.id, amount, skillId });
  if (isAlive(target)) {
    target.energy = Math.min(ENERGY_FULL, target.energy + ENERGY_ON_HIT);
  }
}

function applyHeal(
  log: BattleLogEntry[],
  time: number,
  source: BattleUnit,
  target: BattleUnit,
  amount: number,
  skillId?: string,
): void {
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const healed = target.hp - before;
  log.push({ type: 'heal', time, sourceId: source.id, targetId: target.id, amount: healed, skillId });
}

function pickAttackTarget(targets: BattleUnit[]): BattleUnit | undefined {
  return targets.find(isAlive);
}

function pickLowestHpAlly(allies: BattleUnit[]): BattleUnit | undefined {
  return allies
    .filter(isAlive)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

function performNormalAttack(
  log: BattleLogEntry[],
  time: number,
  attacker: BattleUnit,
  enemies: BattleUnit[],
): void {
  const target = pickAttackTarget(enemies);
  if (!target) return;
  const multiplier = attacker.normalSkill?.multiplier ?? 1;
  const dmg = computeDamage({
    attackerAtk: effectiveStat(attacker, 'atk', time),
    defenderDef: effectiveStat(target, 'def', time),
    multiplier,
  });
  applyDamage(log, time, attacker, target, dmg, attacker.normalSkill?.skillId);
  attacker.energy = Math.min(ENERGY_FULL, attacker.energy + ENERGY_ON_ATTACK);
}

function castActiveSkill(
  log: BattleLogEntry[],
  time: number,
  caster: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): void {
  const skill = caster.activeSkill;
  if (!skill) return;

  caster.energy = Math.max(0, caster.energy - (skill.energyCost ?? ENERGY_FULL));
  log.push({ type: 'skill_cast', time, sourceId: caster.id, skillId: skill.skillId });

  const multiplier = skill.multiplier;
  const effectType = skill.effectType ?? 'damage';
  const duration = skill.durationSec ?? 0;

  const resolveTargets = (): BattleUnit[] => {
    switch (skill.target) {
      case 'enemy_single': {
        const t = pickAttackTarget(enemies);
        return t ? [t] : [];
      }
      case 'enemy_multi':
        return enemies.filter(isAlive);
      case 'self':
        return [caster];
      case 'ally_low_hp': {
        const t = pickLowestHpAlly(allies);
        return t ? [t] : [];
      }
      case 'team':
        return allies.filter(isAlive);
      default:
        return [];
    }
  };

  const targets = resolveTargets();
  const casterAtk = effectiveStat(caster, 'atk', time);

  for (const target of targets) {
    switch (effectType) {
      case 'damage': {
        const dmg = computeDamage({
          attackerAtk: casterAtk,
          defenderDef: effectiveStat(target, 'def', time),
          multiplier,
        });
        applyDamage(log, time, caster, target, dmg, skill.skillId);
        break;
      }
      case 'heal': {
        const amount = Math.max(1, Math.round(casterAtk * multiplier));
        applyHeal(log, time, caster, target, amount, skill.skillId);
        break;
      }
      case 'shield': {
        target.shield += Math.max(0, Math.round(casterAtk * multiplier));
        break;
      }
      case 'buff': {
        target.modifiers.push({ stat: 'atk', amount: skill.effectValue ?? 0, expiresAt: time + duration });
        break;
      }
      case 'armor_break': {
        target.modifiers.push({ stat: 'def', amount: -(skill.effectValue ?? 0), expiresAt: time + duration });
        break;
      }
      default:
        break;
    }
  }
}

export interface SimulateOptions {
  /** 战斗超时时间（秒）。明显打不过的情况下应在此时间内判负，默认 30 秒。 */
  timeoutSec?: number;
}

/**
 * 自动战斗循环：以固定步长推进时间，按攻速触发普攻，普攻命中后双方获得能量，
 * 能量满 100 时自动释放主动技能；护甲减免、属性修正（buff/护盾/破甲）、治疗均按
 * skill_config 中的 effectType 数据驱动，未对任何角色/敌人写死特殊逻辑。
 */
export function simulateBattle(
  playerUnits: BattleUnit[],
  enemyUnits: BattleUnit[],
  options: SimulateOptions = {},
): BattleResult {
  const timeoutSec = options.timeoutSec ?? 30;
  const log: BattleLogEntry[] = [];
  let time = 0;
  let nextTickLog = 0;

  log.push({ type: 'battle_start', time, playerCount: playerUnits.length, enemyCount: enemyUnits.length });
  log.push({
    type: 'battle_tick',
    time,
    alivePlayers: playerUnits.length,
    aliveEnemies: enemyUnits.length,
    hp: sideHpTotals(playerUnits, enemyUnits),
  });

  while (time < timeoutSec) {
    time = Math.round((time + TICK_SECONDS) * 100) / 100;

    for (const unit of [...playerUnits, ...enemyUnits]) {
      if (!isAlive(unit)) continue;
      pruneExpiredModifiers(unit, time);

      unit.attackTimer += TICK_SECONDS;
      const interval = 1 / unit.aspd;
      if (unit.attackTimer >= interval) {
        unit.attackTimer -= interval;
        const allies = unit.side === 'player' ? playerUnits : enemyUnits;
        const enemies = unit.side === 'player' ? enemyUnits : playerUnits;
        performNormalAttack(log, time, unit, enemies);
        if (unit.energy >= ENERGY_FULL && unit.activeSkill) {
          castActiveSkill(log, time, unit, allies, enemies);
        }
      }
    }

    if (time >= nextTickLog) {
      log.push({
        type: 'battle_tick',
        time,
        alivePlayers: playerUnits.filter(isAlive).length,
        aliveEnemies: enemyUnits.filter(isAlive).length,
        hp: sideHpTotals(playerUnits, enemyUnits),
      });
      nextTickLog += TICK_LOG_INTERVAL;
    }

    const playersAlive = playerUnits.some(isAlive);
    const enemiesAlive = enemyUnits.some(isAlive);
    if (!playersAlive || !enemiesAlive) {
      const winner: BattleSide | 'draw' = playersAlive ? 'player' : enemiesAlive ? 'enemy' : 'draw';
      const reason = !playersAlive ? 'all_players_down' : !enemiesAlive ? 'all_enemies_down' : 'mutual_destruction';
      log.push({
        type: 'battle_end',
        time,
        winner,
        reason,
        hp: sideHpTotals(playerUnits, enemyUnits),
        alivePlayers: playerUnits.filter(isAlive).length,
        aliveEnemies: enemyUnits.filter(isAlive).length,
      });
      return { winner, durationSec: time, log, failReason: winner === 'enemy' ? reason : undefined };
    }
  }

  log.push({
    type: 'battle_end',
    time,
    winner: 'enemy',
    reason: 'timeout',
    hp: sideHpTotals(playerUnits, enemyUnits),
    alivePlayers: playerUnits.filter(isAlive).length,
    aliveEnemies: enemyUnits.filter(isAlive).length,
  });
  return { winner: 'enemy', durationSec: time, log, failReason: 'timeout' };
}
