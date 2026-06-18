// S7 专用纯 TS 实时自动战斗核心引擎（BATTLE-RT-04，不依赖 cc）。
//
// 让 enc_n001 / enc_n018 / enc_n075 能用配置和测试阵容跑出真实战斗结果与事件日志。
// 只做战斗模拟核心；不接 UI、不发奖励、不推进主线、不写存档、不接真实玩家阵容 assembler。
//
// 与流程版战斗完全隔离：不 import / 不复用 BattleEngine / BattleUnit / HeroConfig /
// EnemyConfig / SkillConfig / BattleLaunchService / BattlePlaybackService / cc。
// 仅读取 S7ConfigRuntime 的只读配置（getById/getAll 返回底层引用，引擎只读不写，绝不回改配置行）。
// 不把 pressure_param 自动换算成 hp / attack / armor。
//
// 时间：tick 固定 0.2s；同一 battleSeed 结果与日志完全一致；随机只用于"最近目标并列"裁决。
// 同一 tick 固定顺序（见 RT-04 §5.8）：
//   1 出怪 → 2 状态到期 → 3 被动回能 → 4 满能(被动)放大招 → 5 普攻(稳定序)
//   → 6 普攻后满能放大招 → 7 Boss phase → 8 清理死亡 → 9 判胜负/超时。
// 日志事件触发，不每 tick spam。

import {
  S7BattleUnitStatParam,
  S7BattleEffectParam,
  S7BattleEncounterParam,
  S7BattleSpawnParam,
  S7BattleBossPhaseParam,
  S7BattleStateTag,
} from '../../config/s7/ConfigTypesS7';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7AutoBattleSide,
  S7AutoBattleRunRequest,
  S7AutoBattleResult,
  S7AutoBattleLogEntry,
  S7AutoBattleLogType,
  S7AutoBattleFinalState,
  S7AutoBattleUnitFinalState,
  S7AutoBattleWinner,
  S7AutoBattleReason,
  S7AutoBattleError,
} from './S7AutoBattleTypes';

// ===== 首版行为常量（RT-04 首版口径，非最终平衡；报告中已列明）=====
const TICK_SEC = 0.2;
const MAX_PLAYER_UNITS = 5;
const ENERGY_FULL = 100;
const PLAYER_ROWS = 3;
const PLAYER_COLS = 3;
const ENEMY_ROWS = 3;
const ENEMY_COLS = 7;
/** 普攻命中：攻击方获得能量。 */
const ENERGY_ON_ATTACK = 12;
/** 普攻命中：受击方少量获得能量（低于攻击收益）。 */
const ENERGY_ON_HIT = 4;
const VULNERABLE_MULT = 1.25;
const SHIELD_BREAK_MULT = 1.5;
const BERSERK_ATTACK_MULT = 1.25;
const BERSERK_INTERVAL_MULT = 0.8;
/** 护盾量 = max(maxHp*0.2, caster.attack*effectPower)。 */
const SHIELD_HP_FRACTION = 0.2;

const PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;

const DAMAGE_TYPES = new Set<string>([
  'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
]);
const SHIELD_TYPES = new Set<string>(['shield', 'shield_bubble']);
const HEAL_TYPES = new Set<string>(['repair_burst']);
const SUMMON_TYPES = new Set<string>(['summon', 'summon_drone']);
const STATE_TYPES = new Set<string>([
  'short_circuit', 'short_circuit_pulse', 'stun', 'shield_break', 'mark', 'vulnerable', 'berserk',
]);
/** 控制状态：期间不能普攻、不能放大招、不能主动触发。 */
const CONTROL_TAGS: S7BattleStateTag[] = ['short_circuit', 'stun'];
/** 状态到期的固定遍历顺序，保证日志稳定。 */
const STATE_TAG_ORDER: S7BattleStateTag[] = [
  'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
];
const FRIENDLY_TAGS = new Set<string>(['self_team', 'lowest_hp_ally']);

interface RtStateInst {
  tag: S7BattleStateTag;
  expireAt: number;
}

interface RtUnit {
  unitId: string;
  side: S7AutoBattleSide;
  unitStatRef: string;
  slotRef: string;
  row: number;
  col: number;
  sizeRows: number;
  sizeCols: number;
  maxHp: number;
  hp: number;
  attack: number;
  armor: number;
  attackIntervalSec: number;
  attackRangeCells: number;
  passiveEnergyPerSec: number;
  energy: number;
  nextAttackAt: number;
  alive: boolean;
  downLogged: boolean;
  isBoss: boolean;
  bossNodeId: string | null;
  normalEffectRef: string;
  ultimateEffectRef: string;
  coreEffectRef: string;
  targetingTag: string;
  coreTriggered: boolean;
  shield: number;
  states: Map<S7BattleStateTag, RtStateInst>;
}

interface SummonBudget {
  remaining: number;
}

interface RtSpawnPlan {
  row: S7BattleSpawnParam;
  processed: boolean;
}

interface RtPhase {
  row: S7BattleBossPhaseParam;
  triggered: boolean;
}

/**
 * S7 自动战斗引擎。一个实例可复用，多次 run 互不污染（每次 run 在内部 BattleRun 中持有独立状态）。
 * 仅读取注入的 S7ConfigRuntime（只读），绝不回写配置。
 */
export class S7AutoBattleEngine {
  constructor(private readonly runtime: S7ConfigRuntime) {}

  /** 跑一场自动战斗，返回结果与完整事件日志。 */
  run(request: S7AutoBattleRunRequest): S7AutoBattleResult {
    return new BattleRun(this.runtime, request).execute();
  }
}

/** 单场战斗的运行态（与引擎实例解耦，保证可复用与无状态泄漏）。 */
class BattleRun {
  private readonly rng: S7AutoBattleRng;
  private readonly log: S7AutoBattleLogEntry[] = [];
  private readonly units: RtUnit[] = [];
  private readonly playerCells = new Set<string>();
  private readonly enemyCells = new Set<string>();
  private spawnPlans: RtSpawnPlan[] = [];
  private phases: RtPhase[] = [];
  private time = 0;
  private timeLimitSec = 0;
  private enemySeq = 0;

  constructor(
    private readonly runtime: S7ConfigRuntime,
    private readonly request: S7AutoBattleRunRequest,
  ) {
    this.rng = new S7AutoBattleRng(request.battleSeed);
  }

  execute(): S7AutoBattleResult {
    const enc = this.runtime.getById<S7BattleEncounterParam>('battle_encounter_param', this.request.encounterRef);
    if (!enc) {
      throw new S7AutoBattleError('unknown_encounter', `battle_encounter_param 缺少 ${this.request.encounterRef}`);
    }
    this.timeLimitSec = enc.timeLimitSec;

    this.placePlayerUnits();
    this.loadSpawnPlans(enc);
    this.loadPhases(enc);

    this.pushLog('battle_start', { note: enc.rowId });

    const maxTicks = Math.max(1, Math.round(this.timeLimitSec / TICK_SEC));
    let decided: { winner: S7AutoBattleWinner; reason: S7AutoBattleReason } | null = null;

    for (let tick = 0; tick < maxTicks; tick += 1) {
      this.time = roundTime(tick * TICK_SEC);

      this.stepSpawnWaves();        // 1
      this.stepExpireStates();      // 2
      this.stepPassiveEnergy();     // 3
      this.stepPassiveUltimates();  // 4
      const attacked = this.stepNormalAttacks(); // 5
      this.stepAttackUltimates(attacked);        // 6
      this.stepBossPhases();        // 7
      this.stepCleanupDead();       // 8

      decided = this.checkOutcome(); // 9
      if (decided) break;
    }

    let durationSec: number;
    let winner: S7AutoBattleWinner;
    let reason: S7AutoBattleReason;
    if (decided) {
      durationSec = this.time;
      winner = decided.winner;
      reason = decided.reason;
    } else {
      durationSec = this.timeLimitSec;
      winner = 'enemy';
      reason = 'timeout';
    }

    this.log.push({ timeSec: durationSec, type: 'battle_end', winner, reason, durationSec });

    return {
      winner,
      reason,
      durationSec,
      log: this.log,
      finalState: this.buildFinalState(durationSec),
    };
  }

  // ===== 初始化 =====

  private placePlayerUnits(): void {
    const inputs = this.request.playerUnits;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new S7AutoBattleError('no_player_units', '玩家上阵单位不能为空');
    }
    if (inputs.length > MAX_PLAYER_UNITS) {
      throw new S7AutoBattleError('too_many_players', `玩家单位最多 ${MAX_PLAYER_UNITS}，实际 ${inputs.length}`);
    }
    const seenSlots = new Set<string>();
    for (const input of inputs) {
      const slot = input.slotRef;
      if (typeof slot !== 'string' || !PLAYER_SLOT_PATTERN.test(slot)) {
        throw new S7AutoBattleError('bad_player_slot', `非法玩家格 "${String(slot)}"（仅 p0c0..p2c2）`);
      }
      if (seenSlots.has(slot)) {
        throw new S7AutoBattleError('dup_player_slot', `重复玩家格 "${slot}"`);
      }
      seenSlots.add(slot);
      const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', input.unitStatRef);
      if (!stat) {
        throw new S7AutoBattleError('unknown_unit_stat', `battle_unit_stat_param 缺少 ${String(input.unitStatRef)}`);
      }
      if (stat.targetType !== 'ship') {
        throw new S7AutoBattleError('not_ship', `玩家单位 ${stat.rowId} 的 targetType 必须是 ship（实际 ${stat.targetType}）`);
      }
      const row = Number(slot[1]);
      const col = Number(slot[3]);
      this.spawnUnit(stat, 'player', row, col, slot);
    }
  }

  private loadSpawnPlans(enc: S7BattleEncounterParam): void {
    const plans: RtSpawnPlan[] = [];
    for (const ref of enc.spawnPlanRefs) {
      const row = this.runtime.getById<S7BattleSpawnParam>('battle_spawn_param', ref);
      if (!row) throw new S7AutoBattleError('unknown_spawn', `battle_spawn_param 缺少 ${ref}`);
      plans.push({ row, processed: false });
    }
    // 稳定处理顺序：先到点的先出，同时刻按 waveIndex、rowId 决定，保证同 seed 出怪顺序固定。
    plans.sort((a, b) => {
      if (a.row.spawnDelaySec !== b.row.spawnDelaySec) return a.row.spawnDelaySec - b.row.spawnDelaySec;
      if (a.row.waveIndex !== b.row.waveIndex) return a.row.waveIndex - b.row.waveIndex;
      return a.row.rowId < b.row.rowId ? -1 : a.row.rowId > b.row.rowId ? 1 : 0;
    });
    this.spawnPlans = plans;
  }

  private loadPhases(enc: S7BattleEncounterParam): void {
    const phases: RtPhase[] = [];
    for (const ref of enc.bossPhaseRefs) {
      const row = this.runtime.getById<S7BattleBossPhaseParam>('battle_boss_phase_param', ref);
      if (!row) throw new S7AutoBattleError('unknown_boss_phase', `battle_boss_phase_param 缺少 ${ref}`);
      phases.push({ row, triggered: false });
    }
    this.phases = phases;
  }

  // ===== 单步处理（固定顺序）=====

  /** 1：处理到点的出怪批次。 */
  private stepSpawnWaves(): void {
    for (const plan of this.spawnPlans) {
      if (plan.processed) continue;
      if (this.time + 1e-9 < plan.row.spawnDelaySec) continue;
      plan.processed = true;
      this.processSpawnPlan(plan.row);
    }
  }

  private processSpawnPlan(plan: S7BattleSpawnParam): void {
    const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', plan.unitStatRef);
    if (!stat) throw new S7AutoBattleError('unknown_unit_stat', `battle_unit_stat_param 缺少 ${plan.unitStatRef}`);
    const created: RtUnit[] = [];
    for (const slot of plan.slotRefs) {
      if (this.countAliveEnemies() >= plan.maxConcurrentOnField) break; // 同屏上限
      const parsed = parseEnemySlot(slot);
      if (!parsed) {
        throw new S7AutoBattleError('bad_spawn_slot', `非法出怪格 "${slot}"（仅 r0c0..r2c6）`);
      }
      if (!this.canPlace('enemy', parsed.row, parsed.col, stat.sizeRows, stat.sizeCols)) continue; // 占用/越界则跳过该格
      created.push(this.spawnUnit(stat, 'enemy', parsed.row, parsed.col, slot));
    }
    if (created.length > 0) {
      this.pushLog('spawn_wave', {
        side: 'enemy',
        waveIndex: plan.waveIndex,
        targetIds: created.map((u) => u.unitId),
        note: plan.rowId,
      });
    }
  }

  /** 2：结算状态到期并记录 state_expire。 */
  private stepExpireStates(): void {
    for (const unit of this.stableUnits()) {
      if (!unit.alive) continue;
      for (const tag of STATE_TAG_ORDER) {
        const st = unit.states.get(tag);
        if (!st) continue;
        if (st.expireAt <= this.time + 1e-9) {
          unit.states.delete(tag);
          if (tag === 'shield' && unit.shield > 0) unit.shield = 0; // 护盾随状态消退
          this.pushLog('state_expire', { actorId: unit.unitId, side: unit.side, stateTag: tag });
        }
      }
    }
  }

  /** 3：给存活单位增加被动能量（不每 tick 记 energy_change）。 */
  private stepPassiveEnergy(): void {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      unit.energy = Math.min(ENERGY_FULL, unit.energy + unit.passiveEnergyPerSec * TICK_SEC);
    }
  }

  /** 4：检查满能单位（含被动满能），未被短路/晕眩则立刻放大招。 */
  private stepPassiveUltimates(): void {
    for (const unit of this.stableUnits()) {
      this.tryCastUltimate(unit);
    }
  }

  /** 5：按稳定顺序处理可行动单位普攻；返回本 tick 实际出手的单位。 */
  private stepNormalAttacks(): RtUnit[] {
    const attacked: RtUnit[] = [];
    for (const unit of this.stableUnits()) {
      if (!this.canAct(unit)) continue;
      if (this.time + 1e-9 < unit.nextAttackAt) continue;
      const normal = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.normalEffectRef);
      if (!normal) continue; // normalEffectRef='none' 或缺失：本次普攻跳过（不报错）
      const targets = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
      if (targets.length === 0) continue; // 无可攻击目标：跳过，不报错，不重置冷却
      this.pushLog('unit_attack', {
        actorId: unit.unitId,
        side: unit.side,
        targetIds: targets.map((t) => t.unitId),
        effectRef: normal.rowId,
        effectType: normal.effectType,
      });
      this.applyEffectToTargets(unit, normal, targets);
      this.gainEnergy(unit, ENERGY_ON_ATTACK);
      unit.nextAttackAt = this.time + this.effInterval(unit);
      attacked.push(unit);
    }
    return attacked;
  }

  /** 6：普攻结算后，攻击方能量达到 100 则立刻放大招。 */
  private stepAttackUltimates(attacked: RtUnit[]): void {
    for (const unit of attacked) {
      this.tryCastUltimate(unit);
    }
  }

  /** 7：检查并触发 Boss phase（每个 phase 每场只触发一次）。 */
  private stepBossPhases(): void {
    for (const phase of this.phases) {
      if (phase.triggered) continue;
      const boss = this.findBoss(phase.row.bossNodeId);
      if (!boss) continue;
      if (!this.phaseConditionMet(phase.row, boss)) continue;
      phase.triggered = true;
      this.triggerPhase(boss, phase.row);
    }
  }

  /** 8：清理死亡单位并记录 unit_down，释放占格。 */
  private stepCleanupDead(): void {
    for (const unit of this.stableUnits()) {
      if (unit.alive || unit.downLogged) continue;
      unit.downLogged = true;
      this.freeCells(unit);
      this.pushLog('unit_down', { actorId: unit.unitId, side: unit.side });
    }
  }

  /** 9：检查胜负或 timeout。 */
  private checkOutcome(): { winner: S7AutoBattleWinner; reason: S7AutoBattleReason } | null {
    const enemiesAlive = this.units.some((u) => u.side === 'enemy' && u.alive);
    const playersAlive = this.units.some((u) => u.side === 'player' && u.alive);
    // RT-04-fix#4：仍有未处理出怪批次时，场上暂时无敌人不算清场（防延迟首波/两波间清场提前胜利）。
    const pendingSpawns = this.spawnPlans.some((p) => !p.processed);
    // 敌人全灭且无待出怪才判玩家胜（同 tick 双方清空也算清场成功）。
    if (!enemiesAlive && !pendingSpawns) return { winner: 'player', reason: 'all_enemies_down' };
    if (!playersAlive) return { winner: 'enemy', reason: 'all_players_down' };
    return null;
  }

  // ===== 大招 / 星核 =====

  /** 满能且未被控制时释放大招；大招后首次触发 coreEffectRef 一次。返回是否释放。 */
  private tryCastUltimate(unit: RtUnit): boolean {
    if (!unit.alive) return false;
    if (unit.energy < ENERGY_FULL) return false;
    if (this.hasControl(unit)) return false;
    const ult = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.ultimateEffectRef);
    if (!ult) {
      // 无大招效果（'none'）：不放大招，但保留满能，待其拥有有效大招时再放（首版正常单位均有大招或恒为 none）。
      return false;
    }
    this.pushLog('energy_change', { actorId: unit.unitId, side: unit.side, energyAfter: ENERGY_FULL });
    this.castLogged(unit, ult, 'ultimate_cast');
    unit.energy -= ENERGY_FULL;

    if (!unit.coreTriggered && unit.coreEffectRef !== 'none') {
      const core = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', unit.coreEffectRef);
      if (core) {
        unit.coreTriggered = true;
        this.castLogged(unit, core, 'core_trigger');
      }
    }
    return true;
  }

  /**
   * 释放一个主动效果（大招 / 星核）并记录施法事件：先选定目标（RNG 仅抽一次），
   * 把目标写入施法日志（cast 事件早于其伤害/状态事件），再施加。召唤型无预选目标，
   * 召出的单位由随后的 spawn_wave 体现。
   */
  private castLogged(caster: RtUnit, effect: S7BattleEffectParam, logType: S7AutoBattleLogType): void {
    if (SUMMON_TYPES.has(effect.effectType)) {
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType });
      const budget: SummonBudget = { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, budget, 'effect_summon');
      return;
    }
    const targets = this.selectTargets(caster, effect.targetingTag, effect.maxTargets, undefined);
    this.pushLog(logType, {
      actorId: caster.unitId,
      side: caster.side,
      effectRef: effect.rowId,
      effectType: effect.effectType,
      targetIds: targets.map((t) => t.unitId),
    });
    this.applyEffectToTargets(caster, effect, targets);
  }

  // ===== Boss phase =====

  private findBoss(bossNodeId: string): RtUnit | null {
    for (const unit of this.stableUnits()) {
      if (unit.side === 'enemy' && unit.alive && unit.isBoss && unit.bossNodeId === bossNodeId) return unit;
    }
    return null;
  }

  private phaseConditionMet(phase: S7BattleBossPhaseParam, boss: RtUnit): boolean {
    switch (phase.triggerType) {
      case 'battle_start':
        return true;
      case 'hp_pct_below':
        return (boss.hp / boss.maxHp) * 100 < phase.triggerValue;
      case 'time_elapsed_sec':
        return this.time + 1e-9 >= phase.triggerValue;
      default:
        return false;
    }
  }

  private triggerPhase(boss: RtUnit, phase: S7BattleBossPhaseParam): void {
    this.pushLog('boss_phase', { actorId: boss.unitId, side: 'enemy', phaseTag: phase.phaseTag, note: phase.rowId });
    const budget: SummonBudget = { remaining: phase.summonCountCap };
    for (const ref of phase.effectRefs) {
      const eff = this.runtime.getById<S7BattleEffectParam>('battle_effect_param', ref);
      if (!eff) continue;
      this.resolveEffect(boss, eff, false, budget);
    }
    // phase.summonUnitRefs：按出现顺序分组后召唤，与召唤型 effectRefs 共用同一 phase 预算。
    for (const group of groupOrdered(phase.summonUnitRefs)) {
      this.summonUnits('enemy', group.ref, group.count, budget, 'phase_summon');
    }
  }

  // ===== 效果结算 =====

  /** 结算一个效果：召唤型走召唤分支，其余按 targetingTag 选目标后施加。 */
  private resolveEffect(caster: RtUnit, effect: S7BattleEffectParam, isNormal: boolean, budget: SummonBudget | null): void {
    if (SUMMON_TYPES.has(effect.effectType)) {
      const b = budget ?? { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, b, 'effect_summon');
      return;
    }
    const tag = isNormal ? caster.targetingTag : effect.targetingTag;
    const range = isNormal ? caster.attackRangeCells : undefined;
    const targets = this.selectTargets(caster, tag, effect.maxTargets, range);
    this.applyEffectToTargets(caster, effect, targets);
  }

  private applyEffectToTargets(caster: RtUnit, effect: S7BattleEffectParam, targets: RtUnit[]): void {
    const type = effect.effectType;
    if (DAMAGE_TYPES.has(type)) {
      for (const t of targets) this.dealDamage(caster, t, effect);
      if (effect.stateTag !== 'none') {
        for (const t of targets) if (t.alive) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect.rowId);
      }
      return;
    }
    if (SHIELD_TYPES.has(type)) {
      for (const t of targets) this.addShield(caster, t, effect);
      return;
    }
    if (HEAL_TYPES.has(type)) {
      for (const t of targets) this.heal(caster, t, effect);
      return;
    }
    if (STATE_TYPES.has(type)) {
      for (const t of targets) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect.rowId);
    }
  }

  private dealDamage(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam): void {
    if (!target.alive) return;
    let raw = this.effAttack(caster) * effect.effectPower * 100 / (100 + target.armor);
    if (target.states.has('vulnerable')) raw *= VULNERABLE_MULT;
    const dmg = Math.max(1, Math.round(raw));

    let hpDmg = dmg;
    if (target.shield > 0) {
      const shieldMult = target.states.has('shield_break') ? SHIELD_BREAK_MULT : 1.0;
      const shieldLoss = Math.round(dmg * shieldMult);
      if (shieldLoss <= target.shield) {
        target.shield -= shieldLoss;
        hpDmg = 0;
      } else {
        const overflowShieldPts = shieldLoss - target.shield;
        target.shield = 0;
        target.states.delete('shield');
        hpDmg = Math.max(0, Math.round(overflowShieldPts / shieldMult));
      }
    }
    if (hpDmg > 0) target.hp -= hpDmg;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
    this.pushLog('damage', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: hpDmg,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
    if (target.alive) {
      this.gainEnergy(target, ENERGY_ON_HIT);
      // RT-04-fix#2：受击涨能量满后立刻放大招（未短路/晕眩则同结算内即触发，不等下一 tick）。
      this.tryCastUltimate(target);
    }
  }

  private addShield(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam): void {
    if (!target.alive) return;
    const amount = Math.max(
      Math.round(target.maxHp * SHIELD_HP_FRACTION),
      Math.round(caster.attack * effect.effectPower),
    );
    // 同名状态不叠层：护盾量取较大值，刷新持续时间。
    target.shield = Math.max(target.shield, amount);
    const duration = effect.durationSec > 0 ? effect.durationSec : 1;
    target.states.set('shield', { tag: 'shield', expireAt: this.time + duration });
    this.pushLog('state_apply', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      stateTag: 'shield',
      amount,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
  }

  private heal(caster: RtUnit, target: RtUnit, effect: S7BattleEffectParam): void {
    if (!target.alive) return;
    const amount = Math.round(caster.attack * effect.effectPower);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    this.pushLog('heal', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: healed,
      hpAfter: target.hp,
      shieldAfter: target.shield,
    });
  }

  private applyState(caster: RtUnit, target: RtUnit, tag: S7BattleStateTag, durationSec: number, effectRef: string): void {
    if (tag === 'none' || !target.alive) return;
    const duration = durationSec > 0 ? durationSec : 1;
    // 同名状态不叠层，只刷新持续时间。
    target.states.set(tag, { tag, expireAt: this.time + duration });
    this.pushLog('state_apply', {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef,
      stateTag: tag,
    });
  }

  // ===== 召唤 =====

  /** 召唤 count 个 summonUnitRef 到 side 阵营空格，受 budget 与空格双重约束；找不到空格就少召，不报错不重试。 */
  private summonUnits(side: S7AutoBattleSide, summonUnitRef: string, count: number, budget: SummonBudget, note: string): void {
    if (summonUnitRef === 'none') return;
    const stat = this.runtime.getById<S7BattleUnitStatParam>('battle_unit_stat_param', summonUnitRef);
    if (!stat) return;
    const created: RtUnit[] = [];
    for (let i = 0; i < count; i += 1) {
      if (budget.remaining <= 0) break;
      const cell = this.findEmptyCell(side, stat.sizeRows, stat.sizeCols);
      if (!cell) break; // 满场少召，不无限重试
      const slot = side === 'player' ? `p${cell.row}c${cell.col}` : `r${cell.row}c${cell.col}`;
      created.push(this.spawnUnit(stat, side, cell.row, cell.col, slot));
      budget.remaining -= 1;
    }
    if (created.length > 0) {
      this.pushLog('spawn_wave', { side, targetIds: created.map((u) => u.unitId), note });
    }
  }

  // ===== 目标选择 =====

  private selectTargets(caster: RtUnit, tag: string, maxTargets: number, rangeLimit?: number): RtUnit[] {
    const targetSide: S7AutoBattleSide = FRIENDLY_TAGS.has(tag) ? caster.side : opposite(caster.side);
    let candidates = this.units.filter((u) => u.side === targetSide && u.alive && u.hp > 0);
    if (rangeLimit !== undefined) {
      candidates = candidates.filter((u) => this.dist(caster, u) <= rangeLimit);
    }
    if (candidates.length === 0) return [];

    switch (tag) {
      case 'self_team':
        return this.orderSelfTeam(caster, candidates, maxTargets);
      case 'lowest_hp_ally':
        return sortBy(candidates, (u) => [u.hp, u.unitId]).slice(0, maxTargets);
      case 'backline_first':
        return this.orderBackline(caster, targetSide, candidates, maxTargets);
      case 'column_line':
        return this.orderColumnLine(caster, candidates, maxTargets);
      case 'marked_first':
        return sortBy(candidates, (u) => [u.states.has('mark') ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'all_enemies':
        return sortBy(candidates, (u) => [this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case 'single_target':
      case 'nearest_random_tie':
      default:
        return this.pickNearest(caster, candidates, maxTargets);
    }
  }

  /** 最近目标；同距离时标记优先，仍并列则用 seeded RNG 取一个。逐个选满 maxTargets。 */
  private pickNearest(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    const pool = [...candidates];
    const selected: RtUnit[] = [];
    while (selected.length < maxTargets && pool.length > 0) {
      let minD = Infinity;
      for (const u of pool) minD = Math.min(minD, this.dist(caster, u));
      let tie = pool.filter((u) => this.dist(caster, u) === minD);
      const marked = tie.filter((u) => u.states.has('mark'));
      if (marked.length > 0) tie = marked;
      tie = sortBy(tie, (u) => [u.unitId]); // 稳定排序，保证 RNG 取样可复现
      const chosen = tie.length === 1 ? tie[0] : (this.rng.pick(tie) as RtUnit);
      selected.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }
    return selected;
  }

  private orderSelfTeam(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 自身优先，其余按 unitId 稳定排序。
    const others = sortBy(candidates.filter((u) => u !== caster), (u) => [u.unitId]);
    const ordered = candidates.includes(caster) ? [caster, ...others] : others;
    return ordered.slice(0, maxTargets);
  }

  private orderBackline(caster: RtUnit, targetSide: S7AutoBattleSide, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 敌方后排=高列，玩家后排=低列。backlineRank 越小越靠后排。
    const rank = (u: RtUnit): number => (targetSide === 'enemy' ? (ENEMY_COLS - 1 - u.col) : u.col);
    return sortBy(candidates, (u) => [rank(u), this.dist(caster, u), u.unitId]).slice(0, maxTargets);
  }

  private orderColumnLine(caster: RtUnit, candidates: RtUnit[], maxTargets: number): RtUnit[] {
    // 先锁定最近目标所在列，命中该列全部；列内不足再按近到远补。
    const nearest = this.pickNearest(caster, candidates, 1)[0];
    if (!nearest) return [];
    const targetCol = nearest.col;
    const inColumn = sortBy(
      candidates.filter((u) => occupiesColumn(u, targetCol)),
      (u) => [u.row, u.unitId],
    );
    const selected: RtUnit[] = [];
    const seen = new Set<RtUnit>();
    for (const u of inColumn) {
      if (selected.length >= maxTargets) break;
      selected.push(u);
      seen.add(u);
    }
    if (selected.length < maxTargets) {
      const rest = sortBy(candidates.filter((u) => !seen.has(u)), (u) => [this.dist(caster, u), u.unitId]);
      for (const u of rest) {
        if (selected.length >= maxTargets) break;
        selected.push(u);
      }
    }
    return selected;
  }

  // ===== 距离 =====

  /** caster 与 target 的格距（玩家格 vs 敌方格）。玩家列越大越靠前，敌方列越小越靠前。 */
  private dist(caster: RtUnit, target: RtUnit): number {
    const playerUnit = caster.side === 'player' ? caster : target;
    const enemyUnit = caster.side === 'player' ? target : caster;
    let best = Infinity;
    for (let pr = playerUnit.row; pr < playerUnit.row + playerUnit.sizeRows; pr += 1) {
      for (let pc = playerUnit.col; pc < playerUnit.col + playerUnit.sizeCols; pc += 1) {
        for (let er = enemyUnit.row; er < enemyUnit.row + enemyUnit.sizeRows; er += 1) {
          for (let ec = enemyUnit.col; ec < enemyUnit.col + enemyUnit.sizeCols; ec += 1) {
            const d = ec + 1 + (2 - pc) + Math.abs(pr - er);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }

  // ===== 单位 / 占格 =====

  private spawnUnit(stat: S7BattleUnitStatParam, side: S7AutoBattleSide, row: number, col: number, slotRef: string): RtUnit {
    const unitId = side === 'player' ? `player_${slotRef}` : `enemy_${pad4(this.enemySeq++)}`;
    const unit: RtUnit = {
      unitId,
      side,
      unitStatRef: stat.rowId,
      slotRef,
      row,
      col,
      sizeRows: stat.sizeRows,
      sizeCols: stat.sizeCols,
      maxHp: stat.maxHp,
      hp: stat.maxHp,
      attack: stat.attack,
      armor: stat.armor,
      attackIntervalSec: stat.attackIntervalSec,
      attackRangeCells: stat.attackRangeCells,
      passiveEnergyPerSec: stat.passiveEnergyPerSec,
      energy: 0,
      nextAttackAt: 0,
      alive: true,
      downLogged: false,
      isBoss: stat.targetType === 'boss',
      bossNodeId: stat.targetType === 'boss' ? stat.unitRef : null,
      normalEffectRef: stat.normalEffectRef,
      ultimateEffectRef: stat.ultimateEffectRef,
      coreEffectRef: stat.coreEffectRef,
      targetingTag: stat.targetingTag,
      coreTriggered: false,
      shield: 0,
      states: new Map(),
    };
    this.occupy(unit);
    this.units.push(unit);
    return unit;
  }

  private canPlace(side: S7AutoBattleSide, row: number, col: number, sizeRows: number, sizeCols: number): boolean {
    const rows = side === 'player' ? PLAYER_ROWS : ENEMY_ROWS;
    const cols = side === 'player' ? PLAYER_COLS : ENEMY_COLS;
    const occ = side === 'player' ? this.playerCells : this.enemyCells;
    if (row < 0 || col < 0 || row + sizeRows > rows || col + sizeCols > cols) return false;
    for (let r = row; r < row + sizeRows; r += 1) {
      for (let c = col; c < col + sizeCols; c += 1) {
        if (occ.has(cellKey(r, c))) return false;
      }
    }
    return true;
  }

  private findEmptyCell(side: S7AutoBattleSide, sizeRows: number, sizeCols: number): { row: number; col: number } | null {
    const rows = side === 'player' ? PLAYER_ROWS : ENEMY_ROWS;
    const cols = side === 'player' ? PLAYER_COLS : ENEMY_COLS;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (this.canPlace(side, r, c, sizeRows, sizeCols)) return { row: r, col: c };
      }
    }
    return null;
  }

  private occupy(unit: RtUnit): void {
    const occ = unit.side === 'player' ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.add(cellKey(r, c));
    }
  }

  private freeCells(unit: RtUnit): void {
    const occ = unit.side === 'player' ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.delete(cellKey(r, c));
    }
  }

  private countAliveEnemies(): number {
    let n = 0;
    for (const u of this.units) if (u.side === 'enemy' && u.alive) n += 1;
    return n;
  }

  // ===== 小工具 =====

  private canAct(unit: RtUnit): boolean {
    return unit.alive && unit.hp > 0 && !this.hasControl(unit);
  }

  private hasControl(unit: RtUnit): boolean {
    for (const tag of CONTROL_TAGS) if (unit.states.has(tag)) return true;
    return false;
  }

  private effAttack(unit: RtUnit): number {
    return unit.states.has('berserk') ? unit.attack * BERSERK_ATTACK_MULT : unit.attack;
  }

  private effInterval(unit: RtUnit): number {
    return unit.states.has('berserk') ? unit.attackIntervalSec * BERSERK_INTERVAL_MULT : unit.attackIntervalSec;
  }

  private gainEnergy(unit: RtUnit, amount: number): void {
    unit.energy = Math.min(ENERGY_FULL, unit.energy + amount);
  }

  /** 全体单位的稳定遍历顺序：先 side 后 unitId，保证同 seed 处理/日志顺序固定。 */
  private stableUnits(): RtUnit[] {
    return sortBy([...this.units], (u) => [u.side, u.unitId]);
  }

  private pushLog(type: S7AutoBattleLogType, fields: Partial<S7AutoBattleLogEntry>): void {
    this.log.push({ timeSec: this.time, type, ...fields });
  }

  private buildFinalState(durationSec: number): S7AutoBattleFinalState {
    const snap = (u: RtUnit): S7AutoBattleUnitFinalState => ({
      unitId: u.unitId,
      side: u.side,
      unitStatRef: u.unitStatRef,
      slotRef: u.slotRef,
      hp: u.hp,
      maxHp: u.maxHp,
      shield: u.shield,
      energy: Math.round(u.energy * 100) / 100,
      alive: u.alive,
    });
    return {
      durationSec,
      players: this.units.filter((u) => u.side === 'player').map(snap),
      enemies: this.units.filter((u) => u.side === 'enemy').map(snap),
    };
  }
}

// ===== 纯函数工具 =====

function opposite(side: S7AutoBattleSide): S7AutoBattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function roundTime(t: number): number {
  return Math.round(t * 1e6) / 1e6;
}

function parseEnemySlot(slot: string): { row: number; col: number } | null {
  if (typeof slot !== 'string' || !/^r[0-2]c[0-6]$/.test(slot)) return null;
  return { row: Number(slot[1]), col: Number(slot[3]) };
}

/** 单位占格是否覆盖目标列。 */
function occupiesColumn(unit: RtUnit, col: number): boolean {
  return col >= unit.col && col < unit.col + unit.sizeCols;
}

/** 按出现顺序把引用列表分组为 {ref,count}（保留首见顺序，保证召唤顺序确定）。 */
function groupOrdered(refs: string[]): { ref: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const ref of refs) {
    if (!counts.has(ref)) order.push(ref);
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return order.map((ref) => ({ ref, count: counts.get(ref) ?? 0 }));
}

type SortKey = (string | number)[];

/** 稳定多键排序（升序）；不修改入参数组顺序语义由调用方保证（已传副本处用副本）。 */
function sortBy<T>(items: T[], keyFn: (item: T) => SortKey): T[] {
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
      const va = ka[i];
      const vb = kb[i];
      if (va === vb) continue;
      if (va === undefined) return -1;
      if (vb === undefined) return 1;
      return va < vb ? -1 : 1;
    }
    return 0;
  });
}
