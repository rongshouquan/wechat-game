// S7 专用纯 TS 战斗日志摘要（BATTLE-RT-06，不依赖 cc）。
//
// 职责：只消费 S7AutoBattleEngine.run() 已经产出的 S7AutoBattleResult，推导出：
// - 轻量胜负提示码（hintCode）。
// - 我方每个单位造成的伤害统计。
// - 敌方每个单位造成的伤害统计。
//
// 严格边界（依 RT-06 任务包）：
// - 摘要层只吃“已经跑完的结果”：不自己跑战斗、不组装战斗、不读配置；故不 import
//   S7AutoBattleEngine / S7BattleEncounterAssembler / S7ConfigRuntime，也不 import
//   流程版 BattleEngine 等、不 import 存档、不调 completeS7Node、不 import cc。
// - 不接 UI / 奖励 / 主线推进 / 存档写入。
// - 未来在线化只做纯本地稳定摘要：结果完全由 S7AutoBattleResult 推导，不使用随机/当前时间/
//   设备或账号标识，不访问网络/支付/社交/排行榜，不放 openid/unionid 之类身份信息。
// - 不修改传入的 result。

import {
  S7AutoBattleResult,
  S7AutoBattleSide,
  S7AutoBattleUnitFinalState,
} from './S7AutoBattleTypes';

/** 轻量胜负提示码（首版只给码，不写 UI 文案）。 */
export type S7BattleOutcomeHintCode =
  | 'player_win_all_enemies_down'
  | 'enemy_win_all_players_down'
  | 'enemy_win_timeout'
  | 'enemy_win_summon_overflow'
  | 'enemy_win_swarm_overflow'
  | 'enemy_win_shield_not_broken'
  | 'enemy_win_boss_final_phase'
  | 'enemy_win_unknown';

/** 单个单位的造成伤害统计（区分血量伤害与可推导护盾伤害；治疗/上盾不计）。 */
export interface S7BattleUnitDamageSummary {
  unitId: string;
  side: S7AutoBattleSide;
  unitStatRef: string;
  slotRef: string;
  alive: boolean;
  hpDamageDealt: number;
  shieldDamageDealt: number;
  totalDamageDealt: number;
  hitCount: number;
}

export interface S7BattleLogSummaryResult {
  winner: 'player' | 'enemy';
  /** 与引擎 S7AutoBattleReason 同域（段二 C3 起含 target_down=斩首胜利·无配置节点不出现）。 */
  reason: S7AutoBattleResult['reason'];
  durationSec: number;
  hintCode: S7BattleOutcomeHintCode;
  playerDamage: S7BattleUnitDamageSummary[];
  enemyDamage: S7BattleUnitDamageSummary[];
  topPlayerDamage: S7BattleUnitDamageSummary | null;
  topEnemyDamage: S7BattleUnitDamageSummary | null;
}

const SUMMON_NOTES = new Set<string>(['phase_summon', 'effect_summon']);
const SUMMON_OVERFLOW_MIN = 5;
const SWARM_TOTAL_MIN = 10;
const SWARM_ALIVE_MIN = 6;

interface DamageAcc {
  hpDamageDealt: number;
  shieldDamageDealt: number;
  hitCount: number;
}

/**
 * 把一场战斗结果摘要成轻量胜负提示 + 双方单位输出统计。
 * 纯函数、无副作用：只读 result，不修改入参，不依赖随机/时间/网络/配置。
 */
export function summarizeS7BattleLog(result: S7AutoBattleResult): S7BattleLogSummaryResult {
  const damageByUnit = accumulateDamage(result);

  const toSummary = (u: S7AutoBattleUnitFinalState): S7BattleUnitDamageSummary => {
    const acc = damageByUnit.get(u.unitId);
    const hp = acc ? acc.hpDamageDealt : 0;
    const shield = acc ? acc.shieldDamageDealt : 0;
    return {
      unitId: u.unitId,
      side: u.side,
      unitStatRef: u.unitStatRef,
      slotRef: u.slotRef,
      alive: u.alive,
      hpDamageDealt: hp,
      shieldDamageDealt: shield,
      totalDamageDealt: hp + shield,
      hitCount: acc ? acc.hitCount : 0,
    };
  };

  // playerDamage / enemyDamage 必须覆盖 finalState 里出现过的全部单位（含 0 输出）。
  const playerDamage = result.finalState.players.map(toSummary).sort(byDamageThenId);
  const enemyDamage = result.finalState.enemies.map(toSummary).sort(byDamageThenId);

  return {
    winner: result.winner,
    reason: result.reason,
    durationSec: result.durationSec,
    hintCode: computeHintCode(result),
    playerDamage,
    enemyDamage,
    topPlayerDamage: playerDamage.length > 0 ? playerDamage[0] : null,
    topEnemyDamage: enemyDamage.length > 0 ? enemyDamage[0] : null,
  };
}

/** totalDamageDealt 从高到低；相同则 unitId 字符串升序（保证同输入同输出）。 */
function byDamageThenId(a: S7BattleUnitDamageSummary, b: S7BattleUnitDamageSummary): number {
  if (b.totalDamageDealt !== a.totalDamageDealt) return b.totalDamageDealt - a.totalDamageDealt;
  if (a.unitId < b.unitId) return -1;
  if (a.unitId > b.unitId) return 1;
  return 0;
}

/**
 * 按日志顺序统计每个单位造成的伤害：
 * - 血量伤害：damage 事件的 amount 直接计入 actorId。
 * - 护盾伤害：按目标最近 shieldAfter 推导（state_apply(shield) 刷新护盾，自然过期记 0），
 *   攻击命中时把 max(0, 旧护盾 - 新 shieldAfter) 计为攻击方护盾伤害；推导不出记 0，不报错。
 * - 治疗 / 上盾 / 大招施法本身不计伤害。
 */
function accumulateDamage(result: S7AutoBattleResult): Map<string, DamageAcc> {
  const damageByUnit = new Map<string, DamageAcc>();
  const shieldByUnit = new Map<string, number>();

  const accFor = (unitId: string): DamageAcc => {
    let acc = damageByUnit.get(unitId);
    if (!acc) {
      acc = { hpDamageDealt: 0, shieldDamageDealt: 0, hitCount: 0 };
      damageByUnit.set(unitId, acc);
    }
    return acc;
  };

  for (const entry of result.log) {
    if (entry.type === 'state_apply' && entry.stateTag === 'shield') {
      // 上盾：刷新目标当前护盾，便于后续推导；本身不算伤害。
      const target = entry.targetIds && entry.targetIds.length > 0 ? entry.targetIds[0] : undefined;
      if (target !== undefined && typeof entry.shieldAfter === 'number') {
        shieldByUnit.set(target, entry.shieldAfter);
      }
      continue;
    }

    if (entry.type === 'state_expire' && entry.stateTag === 'shield') {
      // 护盾自然过期：该单位当前护盾记 0，避免下一次攻击把过期护盾误算成攻击方输出。
      if (typeof entry.actorId === 'string') shieldByUnit.set(entry.actorId, 0);
      continue;
    }

    if (entry.type !== 'damage') continue;

    // 护盾伤害推导：仅单一目标且带 shieldAfter 时进行。
    let shieldDamage = 0;
    const singleTarget = entry.targetIds && entry.targetIds.length === 1 ? entry.targetIds[0] : undefined;
    if (singleTarget !== undefined && typeof entry.shieldAfter === 'number') {
      const prev = shieldByUnit.get(singleTarget);
      if (prev !== undefined) shieldDamage = Math.max(0, prev - entry.shieldAfter);
      shieldByUnit.set(singleTarget, entry.shieldAfter);
    }

    // 单位归属：actorId 缺失时不硬猜（仅护盾追踪照常更新）。
    if (typeof entry.actorId !== 'string') continue;
    const acc = accFor(entry.actorId);
    acc.hpDamageDealt += typeof entry.amount === 'number' ? entry.amount : 0;
    acc.shieldDamageDealt += shieldDamage;
    acc.hitCount += 1;
  }

  return damageByUnit;
}

/** 轻量胜负提示码（固定优先级见任务包 §8）。 */
function computeHintCode(result: S7AutoBattleResult): S7BattleOutcomeHintCode {
  // 段二 C3：斩首胜利（target_down）沿用玩家胜提示码（提示码枚举不扩=UI 零波及；
  // 斩首关专用文案若要区分，走灰盒批接 UI 时按 reason 细分——接口清单在案）。
  if (result.winner === 'player' && (result.reason === 'all_enemies_down' || result.reason === 'target_down')) {
    return 'player_win_all_enemies_down';
  }

  const isEnemyWin = result.winner === 'enemy';

  // 2：召唤压场（敌方召唤单位累计 >= 5）。
  if (isEnemyWin && countSummonedEnemies(result) >= SUMMON_OVERFLOW_MIN) {
    return 'enemy_win_summon_overflow';
  }
  // 3：Boss final 阶段或敌方狂暴窗口。
  if (isEnemyWin && hasFinalPhaseOrEnemyBerserk(result)) {
    return 'enemy_win_boss_final_phase';
  }
  // 4：仍有敌方单位带护盾（盾没破）。
  if (isEnemyWin && result.finalState.enemies.some((u) => u.shield > 0)) {
    return 'enemy_win_shield_not_broken';
  }
  // 5：大量敌方生成 / 大量敌方存活（清不掉）。
  if (isEnemyWin) {
    const total = result.finalState.enemies.length;
    const alive = result.finalState.enemies.reduce((n, u) => (u.alive ? n + 1 : n), 0);
    if (total >= SWARM_TOTAL_MIN || alive >= SWARM_ALIVE_MIN) return 'enemy_win_swarm_overflow';
  }
  // 6：全员阵亡。
  if (isEnemyWin && result.reason === 'all_players_down') return 'enemy_win_all_players_down';
  // 7：超时。
  if (isEnemyWin && result.reason === 'timeout') return 'enemy_win_timeout';

  // 8：其他敌方胜利（兜底）。
  return 'enemy_win_unknown';
}

/** 敌方召唤（phase_summon / effect_summon）累计召出的单位数。 */
function countSummonedEnemies(result: S7AutoBattleResult): number {
  let n = 0;
  for (const e of result.log) {
    if (e.type === 'spawn_wave' && e.side === 'enemy' && typeof e.note === 'string' && SUMMON_NOTES.has(e.note)) {
      n += e.targetIds ? e.targetIds.length : 0;
    }
  }
  return n;
}

function hasFinalPhaseOrEnemyBerserk(result: S7AutoBattleResult): boolean {
  for (const e of result.log) {
    if (e.type === 'boss_phase' && e.phaseTag === 'final') return true;
    if (e.type === 'state_apply' && e.side === 'enemy' && e.stateTag === 'berserk') return true;
  }
  return false;
}
