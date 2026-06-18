import { BattleLogEntry, BattleResult, BattleSide } from '../combat/BattleEngine';

export interface UnitDamageTaken {
  unitId: string;
  amount: number;
}

export interface SkillCastCount {
  skillId: string;
  count: number;
}

export interface BattleDebugReport {
  winner: BattleSide | 'draw';
  durationSec: number;
  failReason?: string;
  totalDamage: number;
  totalHealing: number;
  /** 各单位承受的总伤害，按伤害量从高到低排序。 */
  damageTakenByUnit: UnitDamageTaken[];
  /** 各技能（含普攻）释放次数，按次数从高到低排序。 */
  skillCastCounts: SkillCastCount[];
}

/**
 * 把一场战斗的日志整理成可读的调试报告：总伤害、总治疗、各单位承伤、
 * 技能释放次数、赢家、耗时、失败原因。供调试面板 / 日志导出复用。
 */
export function buildBattleDebugReport(result: BattleResult): BattleDebugReport {
  let totalDamage = 0;
  let totalHealing = 0;
  const damageTakenMap = new Map<string, number>();
  const skillCastMap = new Map<string, number>();

  for (const entry of result.log) {
    switch (entry.type) {
      case 'damage':
        totalDamage += entry.amount;
        damageTakenMap.set(entry.targetId, (damageTakenMap.get(entry.targetId) ?? 0) + entry.amount);
        break;
      case 'heal':
        totalHealing += entry.amount;
        break;
      case 'skill_cast':
        skillCastMap.set(entry.skillId, (skillCastMap.get(entry.skillId) ?? 0) + 1);
        break;
      default:
        break;
    }
  }

  // 不用 `[...map.entries()]`：微信小游戏构建会将其降级为 `[].concat(map.entries())`，
  // 但 concat 不展开迭代器，结果是 `[迭代器实例]` 而非 entry 数组（同 BattleLaunchService
  // 的 Set spread 问题）。Array.from(...) 是普通函数调用，可正确展开。
  const damageTakenByUnit = Array.from(damageTakenMap.entries())
    .map(([unitId, amount]) => ({ unitId, amount }))
    .sort((a, b) => b.amount - a.amount);

  const skillCastCounts = Array.from(skillCastMap.entries())
    .map(([skillId, count]) => ({ skillId, count }))
    .sort((a, b) => b.count - a.count);

  return {
    winner: result.winner,
    durationSec: result.durationSec,
    failReason: result.failReason,
    totalDamage,
    totalHealing,
    damageTakenByUnit,
    skillCastCounts,
  };
}

/** 找出战斗开始 / 结束日志条目，便于调试面板展示战斗起止信息。 */
export function findBattleBoundaries(log: BattleLogEntry[]): {
  start?: Extract<BattleLogEntry, { type: 'battle_start' }>;
  end?: Extract<BattleLogEntry, { type: 'battle_end' }>;
} {
  return {
    start: log.find((e): e is Extract<BattleLogEntry, { type: 'battle_start' }> => e.type === 'battle_start'),
    end: log.find((e): e is Extract<BattleLogEntry, { type: 'battle_end' }> => e.type === 'battle_end'),
  };
}

/** 将战斗日志导出为 JSON 字符串，供调试面板"导出日志"功能使用。 */
export function exportBattleLogAsJson(result: BattleResult): string {
  return JSON.stringify(
    {
      winner: result.winner,
      durationSec: result.durationSec,
      failReason: result.failReason,
      log: result.log,
    },
    null,
    2,
  );
}
