// S7 战斗色块回放：日志→可播放帧转换器（C1b 难度关卡 阶段② B1，纯 TS，不依赖 cc）。
//
// 职责：只消费 S7AutoBattleEngine 已产出的 S7AutoBattleResult（含带时间戳事件日志 + 最终态），
//   推导出一份"逐时刻关键帧"序列，供表现层（B2 的 Cocos 色块层）逐帧播放——
//   每帧给出此刻每个单位的位置/血量%/生死/是否在场，以及本帧发生的攻击/伤害/死亡/登场事件。
//   不重算战斗（位置取自 finalState.slotRef、血量时间线取自 damage/heal/unit_down 日志），
//   同一 result → 同一 playback（确定可复现）。
//
// 严格边界：只读 result，不修改入参；不 import 引擎/组装器/配置/存档/cc；不重写战斗语义；
//   不使用随机/当前时间/设备标识；不接网络/UI（B2 渲染层另写，调用本层产物）。

import {
  S7AutoBattleResult,
  S7AutoBattleSide,
  S7AutoBattleWinner,
  S7AutoBattleReason,
} from './S7AutoBattleTypes';

/** 回放单位（静态花名册 + 战场格位）：位置取自 finalState.slotRef。 */
export interface S7PlaybackUnit {
  unitId: string;
  side: S7AutoBattleSide;
  slotRef: string;
  /** 解析自 slotRef：玩家格 p{row}c{col} / 敌方格 r{row}c{col}。 */
  row: number;
  col: number;
  maxHp: number;
  unitStatRef: string;
}

/** 本帧一次伤害落点（供飘血/缩条动画）。 */
export interface S7PlaybackHit {
  targetId: string;
  amount: number;
  crit: boolean;
  hpAfter: number;
}

/** 本帧一次出手（供攻击闪光/连线动画）。 */
export interface S7PlaybackAttack {
  actorId: string;
  side: S7AutoBattleSide;
  targetIds: string[];
  /** 大招/星核施法（true）还是普攻（false），供渲染区分表现强度。 */
  isUltimate: boolean;
  /** 星核触发（core_trigger）标记——演出层 V3 质变排场依据（总谱 §1·2026-07-14 演出线补）。 */
  isCore: boolean;
  effectType: string;
  /** 效果行 id（如 eff_atomic_cannon）——改写型星核（陨星弹=普攻变形，无 core_trigger 事件）
   *  的演出识别键（2026-07-14 演出线补·只透传不改语义）。 */
  effectRef: string;
}

/** 某单位在某帧的瞬时状态。 */
export interface S7PlaybackUnitSnapshot {
  hp: number;
  /** 0-100 整数，便于直接画血条。 */
  hpPct: number;
  alive: boolean;
  /** 是否已登场（延迟出怪/召唤前为 false，渲染层据此决定是否画出）。 */
  present: boolean;
}

/** 一个关键帧：某时刻的全场快照 + 本时刻发生的事件。 */
export interface S7PlaybackFrame {
  timeSec: number;
  attacks: S7PlaybackAttack[];
  hits: S7PlaybackHit[];
  deaths: string[];
  spawnedIds: string[];
  /** 花名册中每个单位此刻的状态（key = unitId）。 */
  units: Record<string, S7PlaybackUnitSnapshot>;
}

/** 一场战斗的完整可播放产物。 */
export interface S7BattlePlayback {
  roster: S7PlaybackUnit[];
  frames: S7PlaybackFrame[];
  winner: S7AutoBattleWinner;
  reason: S7AutoBattleReason;
  durationSec: number;
  /** 收尾全队残血%（0-100 整数，便于结果展示，与 demo 状态行口径一致）。 */
  playerSurvivorPct: number;
}

const PLAYER_SLOT = /^p(\d)c(\d)$/;
const ENEMY_SLOT = /^r(\d)c(\d)$/;

/** 解析 slotRef → {row,col}；非法格回退 (0,0)（渲染层只用于摆位，不影响逻辑）。 */
function parseSlot(slotRef: string): { row: number; col: number } {
  const m = (typeof slotRef === 'string' && (PLAYER_SLOT.exec(slotRef) || ENEMY_SLOT.exec(slotRef))) || null;
  return m ? { row: Number(m[1]), col: Number(m[2]) } : { row: 0, col: 0 };
}

function pct(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, hp) / maxHp) * 100)));
}

interface MutState {
  hp: number;
  alive: boolean;
  present: boolean;
}

const ULTIMATE_TYPES = new Set<string>(['ultimate_cast', 'core_trigger']);

/**
 * 把一场战斗结果转成回放帧序列（纯函数，不改入参）。
 * 花名册（含位置）来自 finalState；血量/生死/登场时间线沿日志推演；按"相同时刻聚成一帧"。
 */
export function buildS7BattlePlayback(result: S7AutoBattleResult): S7BattlePlayback {
  const allFinal = [...result.finalState.players, ...result.finalState.enemies];

  const roster: S7PlaybackUnit[] = allFinal.map((u) => {
    const { row, col } = parseSlot(u.slotRef);
    return {
      unitId: u.unitId,
      side: u.side,
      slotRef: u.slotRef,
      row,
      col,
      maxHp: u.maxHp,
      unitStatRef: u.unitStatRef,
    };
  });

  // 运行态：玩家开局即在场；敌人待 spawn_wave 点名后登场。血量初始满血。
  const maxHpById = new Map<string, number>();
  const cur = new Map<string, MutState>();
  for (const u of roster) {
    maxHpById.set(u.unitId, u.maxHp);
    cur.set(u.unitId, { hp: u.maxHp, alive: true, present: u.side === 'player' });
  }

  const snapshot = (): Record<string, S7PlaybackUnitSnapshot> => {
    const out: Record<string, S7PlaybackUnitSnapshot> = {};
    for (const u of roster) {
      const s = cur.get(u.unitId)!;
      out[u.unitId] = { hp: s.hp, hpPct: pct(s.hp, maxHpById.get(u.unitId) ?? 0), alive: s.alive, present: s.present };
    }
    return out;
  };

  const frames: S7PlaybackFrame[] = [];
  // 开局帧（t=0 前的初始全场，玩家已就位、敌人首批未必登场）。
  frames.push({ timeSec: 0, attacks: [], hits: [], deaths: [], spawnedIds: [], units: snapshot() });

  // 日志已按时间升序；按"相同 timeSec"聚帧。
  let i = 0;
  const log = result.log;
  while (i < log.length) {
    const t = log[i].timeSec;
    const attacks: S7PlaybackAttack[] = [];
    const hits: S7PlaybackHit[] = [];
    const deaths: string[] = [];
    const spawnedIds: string[] = [];

    while (i < log.length && log[i].timeSec === t) {
      const e = log[i];
      switch (e.type) {
        case 'spawn_wave': {
          for (const id of e.targetIds ?? []) {
            const s = cur.get(id);
            if (s) {
              s.present = true;
              spawnedIds.push(id);
            }
          }
          break;
        }
        case 'unit_attack':
        case 'ultimate_cast':
        case 'core_trigger': {
          if (typeof e.actorId === 'string' && e.side) {
            attacks.push({
              actorId: e.actorId,
              side: e.side,
              targetIds: e.targetIds ? [...e.targetIds] : [],
              isUltimate: ULTIMATE_TYPES.has(e.type),
              isCore: e.type === 'core_trigger',
              effectType: typeof e.effectType === 'string' ? e.effectType : '',
              effectRef: typeof e.effectRef === 'string' ? e.effectRef : '',
            });
          }
          break;
        }
        case 'damage': {
          const target = e.targetIds && e.targetIds.length > 0 ? e.targetIds[0] : undefined;
          if (target !== undefined && cur.has(target)) {
            const s = cur.get(target)!;
            if (typeof e.hpAfter === 'number') s.hp = e.hpAfter;
            hits.push({
              targetId: target,
              amount: typeof e.amount === 'number' ? e.amount : 0,
              crit: e.crit === true,
              hpAfter: s.hp,
            });
          }
          break;
        }
        case 'heal': {
          const target = e.targetIds && e.targetIds.length > 0 ? e.targetIds[0] : undefined;
          if (target !== undefined && cur.has(target) && typeof e.hpAfter === 'number') {
            cur.get(target)!.hp = e.hpAfter;
          }
          break;
        }
        case 'unit_down': {
          if (typeof e.actorId === 'string' && cur.has(e.actorId)) {
            const s = cur.get(e.actorId)!;
            s.alive = false;
            s.hp = 0;
            deaths.push(e.actorId);
          }
          break;
        }
        default:
          break; // battle_start / battle_end / state_* / heal 之外：不改位置/血量时间线
      }
      i += 1;
    }

    frames.push({ timeSec: t, attacks, hits, deaths, spawnedIds, units: snapshot() });
  }

  // 收尾全队残血%（与 S7DemoController 口径一致：存活按 hp，死亡计 0）。
  let totMax = 0;
  let totHp = 0;
  for (const u of result.finalState.players) {
    totMax += u.maxHp;
    totHp += Math.max(0, u.hp);
  }

  return {
    roster,
    frames,
    winner: result.winner,
    reason: result.reason,
    durationSec: result.durationSec,
    playerSurvivorPct: totMax > 0 ? Math.round((totHp / totMax) * 100) : 0,
  };
}
