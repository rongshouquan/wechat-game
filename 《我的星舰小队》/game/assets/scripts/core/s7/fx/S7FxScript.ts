// S7 战斗演出指令流生成器（演出骨架批 2026-07-13 · 纯 TS，不依赖 cc）。
//
// 职责：吃 S7BattlePlayback（回放帧），按签名查表（S7FxCatalog）铺出一条
//   **时间轴演出指令流**——渲染壳（Cocos 特效层 / HTML 预览壳）只管逐条播指令，
//   不再理解战斗语义。四件套时序在此定：炮口闪 → 弹体飞行 → 命中爆点+受击白闪/微抖。
//
// 演出-结算同拍锁定（总谱 §6①④ 的落法）：逻辑帧数据一律不改；命中侧视觉
//   （爆点/白闪/抖动/死亡星爆）统一锚到"弹体到达"时刻（=攻击帧 + 出膛错峰 + 飞行时长，
//   飞行 ≤0.4s）——伤害视觉出现时，其来源弹道必然已在画面上（验收句成立）。
//   多弹齐射按 intervalSec 错峰=总谱 §6②"同拍爆点错帧渲染"。
//
// 严格边界：只读 playback；不重算战斗；无随机/无当前时间（同一 playback → 同一指令流）；
//   坐标输出 0-1 归一化（敌上我下），渲染壳自乘画布尺寸。

import { S7BattlePlayback, S7PlaybackUnit } from '../S7BattlePlayback';
import { resolveFxSignature, S7FxProjectileSpec, S7FxImpactKind } from './S7FxCatalog';

/** 归一化战场点（x,y ∈ 0-1；y 轴向下，敌方上半 / 我方下半=拍板布局）。 */
export interface S7FxPoint {
  x: number;
  y: number;
}

/** 演出指令（渲染壳唯一消费物；按 tSec 升序）。 */
export type S7FxCommand =
  | { tSec: number; kind: 'spawn'; unitId: string }
  | { tSec: number; kind: 'muzzle'; unitId: string; at: S7FxPoint; color: string; vLevel: 1 | 2 }
  | {
      tSec: number;
      kind: 'projectile';
      from: S7FxPoint;
      to: S7FxPoint;
      spec: S7FxProjectileSpec;
      flightSec: number;
      vLevel: 1 | 2;
    }
  | { tSec: number; kind: 'impact'; at: S7FxPoint; impact: { kind: S7FxImpactKind; size: number; durationSec?: number }; color: string; vLevel: 1 | 2 }
  | { tSec: number; kind: 'unit_flash'; unitId: string; crit: boolean }
  | { tSec: number; kind: 'unit_shake'; unitId: string }
  | { tSec: number; kind: 'hp_change'; unitId: string; hpPct: number }
  | { tSec: number; kind: 'death_burst'; unitId: string; at: S7FxPoint }
  | { tSec: number; kind: 'recoil'; unitId: string };

/** 一场战斗的演出时间轴。 */
export interface S7FxTimeline {
  commands: S7FxCommand[];
  durationSec: number;
  /** 单位静态摆位（渲染壳开场布阵用；key=unitId）。 */
  layout: Record<string, { at: S7FxPoint; side: string }>;
}

/** unitStatRef → { unitRef, roleTag } 解析器（由调用方注入；缺省返回空=走兜底签名）。 */
export type S7FxRefResolver = (unitStatRef: string) => { unitRef: string; roleTag: string };

const EMPTY_REF: { unitRef: string; roleTag: string } = { unitRef: '', roleTag: '' };

/** 敌上我下版位（拍板定死）+ 对峙带：敌三排 y=0.20/0.29/0.38（layoutEnemies）/
 *  对峙带 0.42-0.60（全空）/ 我 y 0.60-0.86。 */
const PLAYER_Y_TOP = 0.6;
const PLAYER_Y_BOTTOM = 0.86;
const X_MARGIN = 0.12;

/** 自然队形抖动（Ron 07-13 反馈②：有队列感但不死板）：按 unitId 确定性哈希
 *  给格位加 ±JITTER 的错落偏移——同一场战斗永远同一队形（可复现），
 *  骨架仍是阵列、观感自然随意。 */
const JITTER_X = 0.022;
const JITTER_Y = 0.018;

function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** 命中侧视觉相对弹体到达的微错峰（死亡星爆再晚一拍）。 */
const DEATH_LAG_SEC = 0.05;

interface GridExtent {
  maxRow: number;
  maxCol: number;
}

function extents(roster: S7PlaybackUnit[], side: string): GridExtent {
  let maxRow = 0;
  let maxCol = 0;
  for (const u of roster) {
    if (u.side !== side) continue;
    if (u.row > maxRow) maxRow = u.row;
    if (u.col > maxCol) maxCol = u.col;
  }
  return { maxRow, maxCol };
}

function clamp01x(v: number): number {
  return Math.max(0.08, Math.min(0.92, v));
}

function placePlayer(u: S7PlaybackUnit, ext: GridExtent): S7FxPoint {
  const cols = ext.maxCol + 1;
  const rows = ext.maxRow + 1;
  let x = cols <= 1 ? 0.5 : X_MARGIN + (u.col / (cols - 1)) * (1 - 2 * X_MARGIN);
  let y = rows <= 1 ? (PLAYER_Y_TOP + PLAYER_Y_BOTTOM) / 2 : PLAYER_Y_TOP + (u.row / (rows - 1)) * (PLAYER_Y_BOTTOM - PLAYER_Y_TOP);
  x += (hash01(u.unitId, 7) - 0.5) * 2 * JITTER_X;
  y += (hash01(u.unitId, 13) - 0.5) * 2 * JITTER_Y;
  return { x, y };
}

/** 敌方视觉阵型（Ron 07-13 三调·借鉴放置军团"紧凑团块+纵深多排"）：
 *  三排楔形——前 40% / 中 35% / 后 25%（前中厚重·别都压最后一排）；
 *  Boss 居中排中心被小怪簇拥；横向以中轴聚拢（固定间距=团块感，非均布全宽）；
 *  中排绕开 Boss 从两侧排、排间交错；哈希错落保自然。
 *  战斗格 row/col 只作排序键（逻辑前排优先进视觉前排），不再线性映射坐标。 */
function layoutEnemies(roster: S7PlaybackUnit[], bossId: string): Map<string, S7FxPoint> {
  const map = new Map<string, S7FxPoint>();
  const others = roster
    .filter((u) => u.side === 'enemy' && u.unitId !== bossId)
    .sort((a, b) => a.row - b.row || a.col - b.col || (a.unitId < b.unitId ? -1 : 1));
  const n = others.length;
  const frontN = Math.round(n * 0.4);
  const midN = Math.round(n * 0.35);
  const rows = [others.slice(0, frontN), others.slice(frontN, frontN + midN), others.slice(frontN + midN)];
  // 同类竖屏上下对阵（疯狂骑士团/咸鱼之王型）通用规律：排距舒展、间距均匀、
  // 与我方梯形镜像呼应——比"兵海团块"松、比均摊满区紧。
  const rowY = [0.37, 0.28, 0.19];
  const SPACING = 0.165;
  rows.forEach((rowUnits, ri) => {
    const m = rowUnits.length;
    rowUnits.forEach((u, i) => {
      let x: number;
      if (ri === 1) {
        // 中排：Boss 占中心（体宽约 0.16 屏），小怪从 ±0.21 起左右交替向外不压 Boss。
        const side = i % 2 === 0 ? 1 : -1;
        const step = Math.floor(i / 2);
        x = 0.5 + side * (0.21 + step * SPACING);
      } else {
        // 前/后排：以中轴聚拢，排间错半位。
        const offset = ri === 0 ? 0 : SPACING / 2;
        x = 0.5 + (i - (m - 1) / 2) * SPACING + offset;
      }
      x = clamp01x(x + (hash01(u.unitId, 7) - 0.5) * 2 * 0.016);
      const y = rowY[ri] + (hash01(u.unitId, 13) - 0.5) * 2 * 0.014;
      map.set(u.unitId, { x, y });
    });
  });
  map.set(bossId, { x: 0.5, y: rowY[1] });
  return map;
}

/**
 * 把回放帧铺成演出指令流（纯函数）。
 * @param playback buildS7BattlePlayback 产物
 * @param resolveRef unitStatRef→unitRef/roleTag 解析器（Cocos 壳从配置运行时注入；测试/预览可省略）
 */
export function buildS7FxScript(playback: S7BattlePlayback, resolveRef?: S7FxRefResolver): S7FxTimeline {
  const byId = new Map<string, S7PlaybackUnit>();
  for (const u of playback.roster) byId.set(u.unitId, u);

  const playerExt = extents(playback.roster, 'player');
  // Boss 判定=敌方 maxHp 最大者（与渲染壳尺寸阶同口径）。
  let bossId = '';
  let bossHp = -1;
  for (const u of playback.roster) {
    if (u.side === 'enemy' && u.maxHp > bossHp) {
      bossHp = u.maxHp;
      bossId = u.unitId;
    }
  }
  const enemyPos = layoutEnemies(playback.roster, bossId);
  const posOf = (unitId: string): S7FxPoint => {
    const u = byId.get(unitId);
    if (!u) return { x: 0.5, y: 0.5 };
    if (u.side === 'enemy') return enemyPos.get(unitId) ?? { x: 0.5, y: 0.28 };
    return placePlayer(u, playerExt);
  };

  const layout: Record<string, { at: S7FxPoint; side: string }> = {};
  for (const u of playback.roster) layout[u.unitId] = { at: posOf(u.unitId), side: u.side };

  const cmds: S7FxCommand[] = [];
  let maxT = playback.durationSec;

  for (const frame of playback.frames) {
    const t = frame.timeSec;

    for (const id of frame.spawnedIds) cmds.push({ tSec: t, kind: 'spawn', unitId: id });

    // 本帧命中视觉的统一到达时刻（帧内取"最后一发弹到达"前的首发到达即可对齐首爆）。
    // 每个 attack 独立铺弹；命中侧（flash/shake/hp/death）锚该 attack 的首发到达时刻。
    let frameArrival = t; // 帧内无攻击（如纯 dot 伤害）时命中视觉当拍播。

    for (const atk of frame.attacks) {
      const actor = byId.get(atk.actorId);
      const ref = resolveRef ? resolveRef(actor?.unitStatRef ?? '') : EMPTY_REF;
      const sign = resolveFxSignature({
        unitRef: ref.unitRef,
        roleTag: ref.roleTag,
        effectType: atk.effectType,
        isUltimate: atk.isUltimate,
        side: actor?.side ?? 'player',
      });
      const from = posOf(atk.actorId);

      if (atk.isUltimate) {
        // recoil=V2 施法标记：渲染壳据此做后坐+施法视觉强调（舰身泛光+舰色光环
        // 自身扩散·2026-07-13 Ron 拍撤文字横幅，技能辨识改纯视觉）。
        cmds.push({ tSec: t, kind: 'recoil', unitId: atk.actorId });
        const castColor = sign.projectile?.color ?? sign.impact.color;
        if (castColor) {
          cmds.push({ tSec: t, kind: 'impact', at: from, impact: { kind: 'ring_expand', size: 1.3 }, color: castColor, vLevel: 2 });
        }
      }

      if (!sign.projectile) {
        // 原地效果（怒吼环/圣盾泡）：每个目标当拍出 impact。
        if (sign.impact.kind !== 'none') {
          const targets = atk.targetIds.length > 0 ? atk.targetIds : [atk.actorId];
          for (const tg of targets) {
            cmds.push({ tSec: t, kind: 'impact', at: posOf(tg), impact: sign.impact, color: sign.impact.color ?? '#FFFFFF', vLevel: sign.vLevel });
          }
        }
        frameArrival = Math.max(frameArrival, t);
        continue;
      }

      const p = sign.projectile;
      cmds.push({ tSec: t, kind: 'muzzle', unitId: atk.actorId, at: from, color: p.color, vLevel: sign.vLevel });

      const targets = atk.targetIds.length > 0 ? atk.targetIds : [];
      for (let shot = 0; shot < p.count; shot += 1) {
        const launch = t + shot * p.intervalSec;
        const arrive = launch + p.flightSec;
        // 多目标：弹按目标轮转（三连打单目标=3 发同点；分镖 2 目标=各 1 发）。
        const tgList = targets.length > 0 ? [targets[shot % targets.length]] : [];
        for (const tg of tgList) {
          const to = posOf(tg);
          cmds.push({ tSec: launch, kind: 'projectile', from, to, spec: p, flightSec: p.flightSec, vLevel: sign.vLevel });
          if (sign.impact.kind !== 'none') {
            cmds.push({ tSec: arrive, kind: 'impact', at: to, impact: sign.impact, color: p.color, vLevel: sign.vLevel });
          }
        }
        if (shot === 0) frameArrival = Math.max(frameArrival, arrive);
        maxT = Math.max(maxT, arrive);
      }
    }

    // 命中侧视觉：统一锚帧首发到达时刻（逻辑帧不动，视觉后移=总谱 §6④ 演出追帧渲染）。
    for (const hit of frame.hits) {
      cmds.push({ tSec: frameArrival, kind: 'unit_flash', unitId: hit.targetId, crit: hit.crit });
      cmds.push({ tSec: frameArrival, kind: 'unit_shake', unitId: hit.targetId });
      cmds.push({ tSec: frameArrival, kind: 'hp_change', unitId: hit.targetId, hpPct: pctOf(hit.hpAfter, byId.get(hit.targetId)) });
    }
    for (const dead of frame.deaths) {
      const dt = frameArrival + DEATH_LAG_SEC;
      cmds.push({ tSec: dt, kind: 'death_burst', unitId: dead, at: posOf(dead) });
      maxT = Math.max(maxT, dt);
    }
  }

  cmds.sort((a, b) => a.tSec - b.tSec);
  return { commands: cmds, durationSec: maxT, layout };
}

function pctOf(hpAfter: number, u: S7PlaybackUnit | undefined): number {
  if (!u || u.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, hpAfter) / u.maxHp) * 100)));
}
