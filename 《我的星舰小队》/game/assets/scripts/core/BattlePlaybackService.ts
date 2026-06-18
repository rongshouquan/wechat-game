/**
 * 战斗过程播放数据服务（S5C-04，纯 TS，不依赖 cc）。
 *
 * 把一场真实战斗的结果（BattleResult.log + 双方单位元数据）转换为按时间顺序的可播放帧序列，
 * 供 BattleView 定时播放。事件顺序与内容完全来自真实战斗日志，不构造任何假数据：
 * - 每条日志条目对应一帧：damage/heal/skill_cast 产出可读事件文案；
 *   battle_tick / battle_end 携带引擎权威的双方存活数与 HP 合计快照（无需重放伤害公式）；
 * - 播放节奏：模拟时长超过目标观看时长时按比例加速（wallTime = simTime / speed），
 *   只压缩时间、不改变事件顺序。
 */
import { BattleSide, BattleUnit, SideHpTotals } from '../combat/BattleEngine';
import { LevelBattleResult } from './LevelProgression';

/** 目标观看时长（秒）：模拟时长超过它则加速播放。 */
const TARGET_WALL_SECONDS = 6;
/** 最大加速倍率（30 秒超时战在该倍率下约 6 秒播完）。 */
const MAX_SPEED = 5;
/** 同名单位（如同种敌人 x3）展示时附加 id 中的 "#n" 后缀以便区分。 */
const UNIT_SUFFIX_PATTERN = /#\d+$/;

export interface BattleSummarySnapshot {
  alivePlayers: number;
  aliveEnemies: number;
  /** 双方当前 HP 合计（来自引擎日志快照；事件帧沿用最近一次快照值）。 */
  playerHp: number;
  enemyHp: number;
  /** 双方满血合计（由出战单位 maxHp 求和，整场不变）。 */
  playerMaxHp: number;
  enemyMaxHp: number;
}

export type BattlePlaybackFrameKind = 'start' | 'tick' | 'damage' | 'heal' | 'skill' | 'end';

export interface BattlePlaybackFrame {
  kind: BattlePlaybackFrameKind;
  /** 模拟时间（秒），与战斗日志一致，单调不减。 */
  simTime: number;
  /** 播放墙钟时间（秒）= simTime / speed，视图按它调度。 */
  wallTime: number;
  /** 可读事件文案（damage/heal/skill 帧携带；start/tick/end 帧无）。 */
  eventText?: string;
  /** 截至本帧的双方摘要（每帧都带，视图直接渲染，无需自行累计状态）。 */
  summary: BattleSummarySnapshot;
  /** end 帧专用：最终胜负。 */
  winner?: BattleSide | 'draw';
}

export interface BattlePlayback {
  frames: BattlePlaybackFrame[];
  /** 播放加速倍率（>=1）。 */
  speed: number;
  /** 模拟总时长（秒）。 */
  durationSec: number;
  /** 播放总时长（秒）= durationSec / speed。 */
  wallDurationSec: number;
  winner: BattleSide | 'draw';
}

/** 单位 id -> 展示名映射：同名单位（同种敌人多只）附加 "#n" 后缀区分。 */
export function buildUnitLabels(units: BattleUnit[]): Map<string, string> {
  const nameCount = new Map<string, number>();
  for (const unit of units) {
    nameCount.set(unit.name, (nameCount.get(unit.name) ?? 0) + 1);
  }
  const labels = new Map<string, string>();
  for (const unit of units) {
    const suffix = (nameCount.get(unit.name) ?? 0) > 1 ? unit.id.match(UNIT_SUFFIX_PATTERN)?.[0] ?? '' : '';
    labels.set(unit.id, `${unit.name}${suffix}`);
  }
  return labels;
}

function computeSpeed(durationSec: number): number {
  if (durationSec <= TARGET_WALL_SECONDS) {
    return 1;
  }
  return Math.min(MAX_SPEED, durationSec / TARGET_WALL_SECONDS);
}

function sumMaxHp(units: BattleUnit[]): number {
  return units.reduce((acc, u) => acc + u.maxHp, 0);
}

/**
 * 把真实关卡战斗结果转换为播放帧序列。
 * 帧顺序即日志顺序（时间相同的事件保持原始先后），摘要血量取最近一次引擎快照。
 */
export function buildBattlePlayback(levelResult: LevelBattleResult): BattlePlayback {
  const { battle, playerUnits, enemyUnits } = levelResult;
  const labels = buildUnitLabels([...playerUnits, ...enemyUnits]);
  const unitLabel = (id: string): string => labels.get(id) ?? id;

  const speed = computeSpeed(battle.durationSec);
  const playerMaxHp = sumMaxHp(playerUnits);
  const enemyMaxHp = sumMaxHp(enemyUnits);

  // 初始摘要：满血、全员存活；后续由 tick/end 帧的引擎快照更新。
  let summary: BattleSummarySnapshot = {
    alivePlayers: playerUnits.length,
    aliveEnemies: enemyUnits.length,
    playerHp: playerMaxHp,
    enemyHp: enemyMaxHp,
    playerMaxHp,
    enemyMaxHp,
  };
  const withHp = (alivePlayers: number, aliveEnemies: number, hp?: SideHpTotals): BattleSummarySnapshot => ({
    alivePlayers,
    aliveEnemies,
    playerHp: hp?.player ?? summary.playerHp,
    enemyHp: hp?.enemy ?? summary.enemyHp,
    playerMaxHp,
    enemyMaxHp,
  });

  const frames: BattlePlaybackFrame[] = [];
  for (const entry of battle.log) {
    const wallTime = entry.time / speed;
    switch (entry.type) {
      case 'battle_start':
        frames.push({ kind: 'start', simTime: entry.time, wallTime, summary });
        break;
      case 'battle_tick':
        summary = withHp(entry.alivePlayers, entry.aliveEnemies, entry.hp);
        frames.push({ kind: 'tick', simTime: entry.time, wallTime, summary });
        break;
      case 'damage':
        frames.push({
          kind: 'damage',
          simTime: entry.time,
          wallTime,
          eventText: `${unitLabel(entry.sourceId)} → ${unitLabel(entry.targetId)} 伤害 ${entry.amount}`,
          summary,
        });
        break;
      case 'heal':
        frames.push({
          kind: 'heal',
          simTime: entry.time,
          wallTime,
          eventText: `${unitLabel(entry.sourceId)} → ${unitLabel(entry.targetId)} 治疗 ${entry.amount}`,
          summary,
        });
        break;
      case 'skill_cast':
        frames.push({
          kind: 'skill',
          simTime: entry.time,
          wallTime,
          eventText: `${unitLabel(entry.sourceId)} 释放技能`,
          summary,
        });
        break;
      case 'battle_end':
        summary = withHp(
          entry.alivePlayers ?? summary.alivePlayers,
          entry.aliveEnemies ?? summary.aliveEnemies,
          entry.hp,
        );
        frames.push({ kind: 'end', simTime: entry.time, wallTime, summary, winner: entry.winner });
        break;
      default:
        break;
    }
  }

  return {
    frames,
    speed,
    durationSec: battle.durationSec,
    wallDurationSec: battle.durationSec / speed,
    winner: battle.winner,
  };
}
