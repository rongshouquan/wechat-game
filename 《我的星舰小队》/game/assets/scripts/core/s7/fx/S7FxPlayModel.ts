// S7 战斗演出播放模型（纯 TS · 不 import cc · Cocos 壳批 2026-07-14）。
//
// 职责：把 S7FxTimeline 指令流播成**逐帧可渲染状态**——单位运行态（位置/血量/受击
//   白闪/施法泛光等计时器）+ 弹体/爆点/余烬/伤害数字四池 + V3 压暗。渲染层
//   （Cocos S7BattleFxLayer / HTML 预览壳）只读状态画图，不理解战斗语义。
//   逻辑与视觉蓝本 = tools/fx-preview/index.html（组装 v8 定案·总谱 §4a），此处为其
//   引擎无关移植；坐标系 = 参考画布 464×825 像素（与预览壳同幅面、同纵横比
//   0.5624≈720/1280），渲染层按 viewW/REF_W 等比放大。
//
// 红线（总谱 §7）：弹体上限 48（超发丢最旧）；余烬 ≤90、伤害数字 ≤26；本层零分配
//   热路径外移（数组复用·渲染层负责节点池）。微信兼容：不展开 Set/Map。

import { S7FxCommand, S7FxTimeline } from './S7FxScript';
import { S7FxImpactKind, S7FxProjectileSpec, ROLE_COLOR } from './S7FxCatalog';

/** 参考画布（预览壳同幅面；渲染层等比缩放）。 */
export const S7FX_REF_W = 464;
export const S7FX_REF_H = 825;

/** 入场仪式时长（总谱 §6 开局序列·批4 依 Ron 07-15「滑入太快，仪式感要放长」0.5→0.9s）。
 *  实现＝t 从 -INTRO 起跑：指令 tSec≥0 天然等入场完再执行，逻辑/指令流零改动。 */
export const S7FX_INTRO_SEC = 0.9;
/** 「战斗开始」横幅窗口（批4·Ron「0.6 秒太短」→1.6s：入场尾 0.25s 前亮、开打后 1.35s 收）。 */
export const S7FX_BANNER_FROM = -0.25;
export const S7FX_BANNER_TO = 1.35;

/** 五舰签名色 + 敌方族色（预览壳同表）。 */
export const S7FX_SHIP_COLOR: Record<string, string> = {
  shp03: '#4FC3F7', shp06: '#3BA8A0', shp09: '#FF8A3D', shp13: '#F5A8C0', shp20: '#B05CE0',
};
export const S7FX_ENEMY_COLOR = '#C4453F';
/** 亲和组徽记色（驾驶员真源 §0③·头像底环）。 */
export const S7FX_GROUP_RING: Record<string, string> = {
  shp03: '#FFA94D', shp06: '#63B8FF', shp09: '#FFE066', shp13: '#7FE7D0', shp20: '#B78CF0',
};
export const S7FX_PILOT_OF_SHIP: Record<string, string> = {
  shp03: 'pil03', shp06: 'pil06', shp09: 'pil09', shp13: 'pil13', shp20: 'pil20',
};

/** 发射锚点表（L75 母版实测件位·[dx,dy]=占本舰绘制框比例·y 负=机头向；多锚按 shotIdx 轮转）。 */
export const S7FX_MUZZLES: Record<string, ReadonlyArray<readonly [number, number]>> = {
  shp03: [[0, -0.41], [-0.354, 0], [0.354, 0]],
  shp06: [[0, -0.35]],
  shp09: [[-0.05, -0.44], [0.06, -0.44]],
  shp13: [[0, -0.36]],
  shp20: [[-0.27, -0.043], [0.27, -0.043]],
};
const MUZZLE_PLAYER_DEFAULT: ReadonlyArray<readonly [number, number]> = [[0, -0.38]];
const MUZZLE_ENEMY_DEFAULT: ReadonlyArray<readonly [number, number]> = [[0, 0.36]];

/** 切件驱动规格（L75 母版 1024² 件位；渲染层据此摆部件节点）。 */
export interface S7FxPartRig {
  /** 资源名（resources/fx/units/ 下）。 */
  sprite: string;
  /** 件矩形 [x0,y0,x1,y1]（母版 1024² 像素空间）。 */
  rect: readonly [number, number, number, number];
  /** 旋转/后坐轴心（同空间）。 */
  axis: readonly [number, number];
  /** 动法：halo=悬浮轻转+上下浮 / spin=来回转 / spin2=反相来回转 / recoil=开火后坐 / flag=迎风摆。 */
  mode: 'halo' | 'spin' | 'spin2' | 'recoil' | 'flag';
}
export const S7FX_MASTER_SIZE = 1024;
export const S7FX_PART_RIGS: Record<string, S7FxPartRig[]> = {
  shp09: [{ sprite: 'ship_lieyang_part0', rect: [410, 50, 625, 270], axis: [515, 265], mode: 'recoil' }],
  shp13: [{ sprite: 'ship_chenxi_part0', rect: [385, 125, 630, 350], axis: [508, 345], mode: 'halo' }],
  shp20: [
    { sprite: 'ship_suolian_part0', rect: [140, 395, 335, 550], axis: [233, 468], mode: 'spin' },
    { sprite: 'ship_suolian_part1', rect: [690, 395, 885, 550], axis: [790, 468], mode: 'spin2' },
  ],
};
/** 星盗船长旗（按 body 资源名挂靠·敌方无 unitRef）。 */
export const S7FX_PIRATE_FLAG_RIG: S7FxPartRig = {
  sprite: 'pirate_chuanzhang_flag', rect: [475, 40, 725, 210], axis: [515, 208], mode: 'flag',
};

/** 弹体贴图选择（功能绿>敌红>形状；baseAngle=素材自带朝向）。 */
export function s7FxVfxForProjectile(spec: S7FxProjectileSpec): { name: string; baseAngle: number } | null {
  if (spec.color === '#7ED957') return { name: 'vfx_heal_orb', baseAngle: 0 };
  switch (spec.shape) {
    case 'bolt':
      return spec.color === '#D94A4A'
        ? { name: 'vfx_bolt_red', baseAngle: Math.PI }
        : { name: 'vfx_bolt_cyan', baseAngle: Math.PI };
    case 'shell': return { name: 'vfx_shell_orange', baseAngle: 0 };
    case 'ring': return { name: 'vfx_ring_teal', baseAngle: 0 };
    case 'orb': return { name: 'vfx_orb_purple', baseAngle: 0 };
    case 'bubble': return { name: 'vfx_bubble_blue', baseAngle: 0 };
    case 'blade': return { name: 'vfx_blade_cyan', baseAngle: 0 };
    default: return null;
  }
}

/** 花名册行（Cocos 侧从 playback.roster + resolveRef 拼出）。 */
export interface S7FxRosterEntry {
  unitId: string;
  side: string;
  unitRef: string;
  roleTag: string;
  maxHp: number;
}

/** 单位运行态（参考像素空间；渲染层直接消费）。 */
export interface S7FxUnitState {
  unitId: string;
  side: string;
  unitRef: string;
  /** 职业标签（无皮舰矢量兜底取族色/画型用）。 */
  roleTag: string;
  color: string;
  /** 参考像素坐标（464×825 空间·中心点）。 */
  x: number;
  y: number;
  /** 绘制框（参考像素）。 */
  w: number;
  h: number;
  isBoss: boolean;
  hpPct: number;
  alive: boolean;
  present: boolean;
  /** 事件计时器（秒·渲染层读值做白闪/抖动/后坐/点头/入场/施法泛光/死亡淡出）。 */
  flashT: number;
  shakeT: number;
  recoilT: number;
  lungeT: number;
  spawnT: number;
  castGlowT: number;
  deadT: number;
  /** 治疗泛绿柔光（总谱 §3.3·0.35s）。 */
  healGlowT: number;
  /** 暴击冲击环（总谱 §3.1"暴击=爆点外加一圈冲击环"·批4 欠账补齐·0.3s 扩散）。 */
  critRingT: number;
  /** 相位（确定性哈希·渲染层做悬浮/摇摆错拍）。 */
  phase: number;
}

export interface S7FxProjState {
  spec: S7FxProjectileSpec;
  fromX: number; fromY: number;
  toX: number; toY: number;
  flightSec: number;
  age: number;
  /** 发射锚点偏移（参考像素·已含）。 */
  ox: number; oy: number;
  vLevel: number;
}

export interface S7FxImpactState {
  x: number; y: number;
  kind: S7FxImpactKind | 'muzzle';
  size: number;
  color: string;
  age: number;
  life: number;
}

export interface S7FxParticleState {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; color: string; size: number;
}

export interface S7FxPopState {
  x: number; y: number; txt: string; crit: boolean; age: number; life: number;
}

const PROJ_CAP = 48; // 总谱 §7 弹体红线
const EMBER_CAP = 90;
const POP_CAP = 26;

function hash01(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** 确定性伪随机（避免 Math.random——微信/回放一致性；按调用序推进）。 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class S7FxPlayModel {
  readonly units: Record<string, S7FxUnitState> = {};
  readonly unitList: S7FxUnitState[] = [];
  readonly projs: S7FxProjState[] = [];
  readonly impacts: S7FxImpactState[] = [];
  readonly bursts: S7FxParticleState[] = [];
  readonly embers: S7FxParticleState[] = [];
  readonly pops: S7FxPopState[] = [];

  t = -S7FX_INTRO_SEC; // 负区间=入场仪式（我方滑入·HUD 未亮·指令未动）
  darkenT = 0;
  darkenDur = 0;
  finished = false;
  /** 胜负（收尾演出分流：胜=我方加速冲出画面上缘·负=敌方扬长而去我方冒烟淡出=总谱 §4 速度曲线）。 */
  winner = '';
  /** 收尾演出计时（finished 后累计；outroDone 才通知宿主收场）。 */
  outroT = 0;
  /** 末杀顿帧（清场最后一击=急刹+顿帧 0.22s·总谱 §4/§5）。 */
  freezeT = 0;
  /** V3 曲速脉冲（星光拉线+punch-zoom 0.3s·与压暗同步·总谱 §4/§5）。 */
  starPulseT = 0;
  /** Boss 登场推镜（1.00→1.06 约 1s·总谱 §5）。 */
  bossZoomT = 0;
  private bossZoomPlayed = false;
  /** 波次（批4 信息层）：当前波号/总波数（单波关渲染层不显）。 */
  waveIdx = 1;
  waveCount = 1;
  /** 「第 N 波来袭」横幅计时（exec wave_banner 点亮·1.5s）。 */
  waveBannerT = 0;

  private cmdIdx = 0;
  private readonly cmds: S7FxCommand[];
  private readonly endT: number;
  private rng = makeRng(0x53375);
  /** 开场在场快照（restart 恢复用：开场敌人预标 present=true·Boss/召唤物 false）。 */
  private readonly presentAtStart: Record<string, boolean> = {};

  constructor(timeline: S7FxTimeline, roster: S7FxRosterEntry[], winner = '') {
    this.cmds = timeline.commands;
    this.endT = timeline.durationSec + 1.5;
    this.winner = winner;
    this.waveCount = timeline.waveCount ?? 1;
    // 敌方尺寸阶（对标验收尺②）：Boss=断崖判定（最大血 ≥1.8× 次大血才算·全同血敌群
    //   =全大副档，07-15 Ron 真机反馈：旧"最大即 Boss"让均血 7 敌全变船长尺寸挤成一坨）；
    //   其余 ≥35% 分位=大副档 78 / 以下=小兵档 54；我方 92。
    let maxEnemyHp = 1;
    let secondEnemyHp = 0;
    let bossUnitId = '';
    for (const r of roster) {
      if (r.side !== 'enemy') continue;
      if (r.maxHp > maxEnemyHp) { secondEnemyHp = maxEnemyHp; maxEnemyHp = r.maxHp; bossUnitId = r.unitId; }
      else if (r.maxHp > secondEnemyHp) secondEnemyHp = r.maxHp;
    }
    const hasRealBoss = secondEnemyHp <= 0 ? true : maxEnemyHp >= secondEnemyHp * 1.8;
    for (const r of roster) {
      const lay = timeline.layout[r.unitId];
      const isP = r.side === 'player';
      let size = 92;
      let isBoss = false;
      if (!isP) {
        if (hasRealBoss && r.unitId === bossUnitId) { size = 150; isBoss = true; }
        else if (r.maxHp / maxEnemyHp >= 0.35) size = 78;
        else size = 54;
      }
      const u: S7FxUnitState = {
        unitId: r.unitId,
        side: r.side,
        unitRef: r.unitRef,
        roleTag: r.roleTag,
        color: isP ? (S7FX_SHIP_COLOR[r.unitRef] ?? ROLE_COLOR[r.roleTag] ?? '#FFE066') : S7FX_ENEMY_COLOR,
        x: (lay ? lay.at.x : 0.5) * S7FX_REF_W,
        y: (lay ? lay.at.y : 0.5) * S7FX_REF_H,
        w: size, h: size, isBoss,
        hpPct: 100, alive: true, present: isP,
        flashT: 0, shakeT: 0, recoilT: 0, lungeT: 0, spawnT: 0, castGlowT: 0, deadT: 0, healGlowT: 0, critRingT: 0,
        phase: hash01(r.unitId, 31) * Math.PI * 2,
      };
      this.units[r.unitId] = u;
      this.unitList.push(u);
    }
    // 开场敌人（tSec=0 的 spawn·非 Boss）构造即列阵：入场仪式期（t<0）指令不执行，
    // 若不预标 present，我方滑入那 0.5s 敌阵会整片隐身（守方应已在场）；Boss 不预标
    // ——保留 t=0 spawn 的登场演出+推镜。召唤物 spawn 在 t>0，天然不受影响。
    for (const c of this.cmds) {
      if (c.tSec > 0.001) break; // 已按 tSec 升序
      if (c.kind !== 'spawn') continue;
      const u = this.units[c.unitId];
      if (u && !u.isBoss) u.present = true;
    }
    for (const u of this.unitList) this.presentAtStart[u.unitId] = u.present;
  }

  restart(): void {
    this.t = -S7FX_INTRO_SEC;
    this.cmdIdx = 0;
    this.waveIdx = 1;
    this.waveBannerT = 0;
    this.darkenT = 0;
    this.darkenDur = 0;
    this.finished = false;
    this.outroT = 0;
    this.freezeT = 0;
    this.starPulseT = 0;
    this.bossZoomT = 0;
    this.bossZoomPlayed = false;
    this.projs.length = 0;
    this.impacts.length = 0;
    this.bursts.length = 0;
    this.embers.length = 0;
    this.pops.length = 0;
    this.rng = makeRng(0x53375);
    for (const u of this.unitList) {
      u.hpPct = 100; u.alive = true; u.present = this.presentAtStart[u.unitId] ?? u.side === 'player';
      u.flashT = 0; u.shakeT = 0; u.recoilT = 0; u.lungeT = 0; u.spawnT = 0; u.castGlowT = 0; u.deadT = 0; u.healGlowT = 0; u.critRingT = 0;
    }
  }

  /** 跳到结尾（跳过键）：快进执行全部剩余指令、清飞行物，保留终局单位态。 */
  skipToEnd(): void {
    while (this.cmdIdx < this.cmds.length) {
      this.exec(this.cmds[this.cmdIdx]);
      this.cmdIdx += 1;
    }
    this.t = this.endT;
    this.projs.length = 0;
    this.impacts.length = 0;
    this.bursts.length = 0;
    this.embers.length = 0;
    this.pops.length = 0;
    this.darkenT = 0;
    this.freezeT = 0;
    this.starPulseT = 0;
    this.bossZoomT = 0;
    this.waveBannerT = 0;
    for (const u of this.unitList) { u.spawnT = 0; if (!u.alive) u.deadT = 0; u.critRingT = 0; }
    this.finished = true;
    this.outroT = 9; // 跳过=不放收尾演出，直接可收场
  }

  /** 推进 dt 秒（渲染层每帧调用；speed 由调用方乘进 dt）。 */
  step(dt: number): void {
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05; // 防真假时钟混用大跳帧（预览壳同款钳制）
    // 镜头/星流计时器走真实时间（顿帧冻的是战斗，不冻镜头呼吸）
    if (this.bossZoomT > 0) this.bossZoomT = Math.max(0, this.bossZoomT - dt);
    if (this.starPulseT > 0) this.starPulseT = Math.max(0, this.starPulseT - dt);
    if (this.finished) { this.outroT += dt; return; } // 收尾演出期：战斗态定格，只累计 outro
    if (this.freezeT > 0) { this.freezeT -= dt; return; } // 末杀顿帧：全场急停
    this.t += dt;
    while (this.cmdIdx < this.cmds.length && this.cmds[this.cmdIdx].tSec <= this.t) {
      this.exec(this.cmds[this.cmdIdx]);
      this.cmdIdx += 1;
    }
    // 池老化（回收由过滤完成——渲染层按 age<life 同步节点池）
    for (let i = this.projs.length - 1; i >= 0; i -= 1) {
      const p = this.projs[i];
      p.age += dt;
      if (p.age >= p.flightSec + 0.02) this.projs.splice(i, 1);
    }
    for (let i = this.impacts.length - 1; i >= 0; i -= 1) {
      const im = this.impacts[i];
      im.age += dt;
      if (im.age >= im.life) this.impacts.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const b = this.bursts[i];
      b.age += dt;
      if (b.age >= b.life) { this.bursts.splice(i, 1); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    for (let i = this.embers.length - 1; i >= 0; i -= 1) {
      const e = this.embers[i];
      e.age += dt;
      if (e.age >= e.life) { this.embers.splice(i, 1); continue; }
      e.vy += 150 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i -= 1) {
      const p = this.pops[i];
      p.age += dt;
      if (p.age >= p.life) this.pops.splice(i, 1);
    }
    for (const u of this.unitList) {
      if (u.flashT > 0) u.flashT = Math.max(0, u.flashT - dt);
      if (u.shakeT > 0) u.shakeT = Math.max(0, u.shakeT - dt);
      if (u.recoilT > 0) u.recoilT = Math.max(0, u.recoilT - dt);
      if (u.lungeT > 0) u.lungeT = Math.max(0, u.lungeT - dt);
      if (u.spawnT > 0) u.spawnT = Math.max(0, u.spawnT - dt);
      if (u.castGlowT > 0) u.castGlowT = Math.max(0, u.castGlowT - dt);
      if (u.healGlowT > 0) u.healGlowT = Math.max(0, u.healGlowT - dt);
      if (u.critRingT > 0) u.critRingT = Math.max(0, u.critRingT - dt);
      if (!u.alive && u.deadT > 0) u.deadT = Math.max(0, u.deadT - dt);
    }
    if (this.waveBannerT > 0) this.waveBannerT = Math.max(0, this.waveBannerT - dt);
    if (this.darkenT > 0) this.darkenT = Math.max(0, this.darkenT - dt);
    if (this.t >= this.endT) this.finished = true;
  }

  /** 「战斗开始」横幅强度 0-1（批4 开锣仪式·窗口 [-0.25,1.35]s 梯形包络：淡入0.2/驻/淡出0.35）。 */
  battleBannerK(): number {
    if (this.t < S7FX_BANNER_FROM || this.t > S7FX_BANNER_TO || this.finished) return 0;
    const inK = Math.min(1, (this.t - S7FX_BANNER_FROM) / 0.2);
    const outK = Math.min(1, (S7FX_BANNER_TO - this.t) / 0.35);
    return Math.max(0, Math.min(inK, outK));
  }

  /** 「第 N 波来袭」横幅强度 0-1（1.5s 包络：淡入0.15/驻/淡出0.35）。 */
  waveBannerK(): number {
    if (this.waveBannerT <= 0) return 0;
    const k = 1.5 - this.waveBannerT; // 已播秒
    return Math.max(0, Math.min(k / 0.15, 1, this.waveBannerT / 0.35));
  }

  /** V3 压暗当前 alpha（0-0.42·渲染层直接用）。 */
  darkenAlpha(): number {
    if (this.darkenT <= 0 || this.darkenDur <= 0) return 0;
    const dk = Math.min(1, (this.darkenDur - this.darkenT) / 0.25, this.darkenT / 0.35);
    return 0.42 * Math.max(0, dk);
  }

  /** 星流速度倍率（总谱 §4 速度情绪曲线：入场快掠/巡航/V3 拉线/末杀急刹/胜负收尾）。 */
  starSpeedK(): number {
    if (this.finished) return this.winner === 'player' ? 3.5 : 0.6; // 胜=追击加速·负=掉队慢漂
    if (this.freezeT > 0) return 0.05; // 急刹
    if (this.starPulseT > 0) return 4.5; // 曲速脉冲
    if (this.t < 0.5) return 3.2; // 入场仪式快掠（与滑入 0.5s 咬合）
    return 1;
  }

  /** 星光拉线强度 0-1（V3 脉冲期星点画成长条=曲速感）。 */
  starStreakK(): number {
    return this.starPulseT > 0 ? this.starPulseT / 0.3 : 0;
  }

  /** 镜头缩放（总谱 §5：Boss 登场推镜 1.00→1.06 / V3 punch-zoom 1.00→1.04→1.00；
   *  同一时刻镜头动作 ≤1——Boss 推镜优先。放大方向永不露画布外。 */
  zoomScale(): number {
    if (this.bossZoomT > 0) {
      const k = 1 - this.bossZoomT; // 0→1
      const env = k < 0.4 ? k / 0.4 : k > 0.8 ? (1 - k) / 0.2 : 1; // 推 0.4s/驻 0.4s/回 0.2s
      return 1 + 0.06 * Math.max(0, Math.min(1, env));
    }
    if (this.starPulseT > 0) {
      const k = 1 - this.starPulseT / 0.3;
      return 1 + 0.04 * Math.sin(Math.PI * k);
    }
    return 1;
  }

  /** 收尾演出完成（渲染层此时才通知宿主开结果窗）。 */
  outroDone(): boolean {
    return this.finished && this.outroT >= 0.9;
  }

  /** 入场纵向位移（参考像素·y 正=向下）：我方自屏幕下方滑入 0.5s 缓入到位（总谱 §6 开局序列·
   *  Ron 07-15 反馈②补齐——旧色块版有此仪式、演出层漏移植）。敌方守方原地不动。 */
  introOffsetY(u: S7FxUnitState): number {
    if (this.t >= 0 || u.side !== 'player') return 0;
    const k = Math.min(1, -this.t / S7FX_INTRO_SEC); // 1→0
    return k * k * S7FX_REF_H * 0.62; // 缓入：起步屏外、到位前减速
  }

  /** HUD 可见（血条/头像/倒计时 入场完成才亮起——"入场→就绪"节奏）。 */
  hudVisible(): boolean {
    return this.t >= 0;
  }

  /** 收尾纵向位移（参考像素·y 负=向上）：胜=我方依次加速冲出画面上缘；负=敌方扬长而去。 */
  outroOffsetY(u: S7FxUnitState): number {
    if (!this.finished || this.outroT <= 0) return 0;
    const win = this.winner === 'player';
    const mover = win ? u.side === 'player' : u.side === 'enemy';
    if (!mover || !u.alive) return 0;
    const stagger = (u.phase / (Math.PI * 2)) * 0.25; // 依次冲出（错拍 ≤0.25s）
    const tt = Math.max(0, this.outroT - stagger);
    return -(tt * tt) * (win ? 1400 : 900);
  }

  /** 收尾透明度（负局我方缓缓掉队淡出=柔和不挫败；其余 1）。 */
  outroAlpha(u: S7FxUnitState): number {
    if (!this.finished || this.winner === 'player' || u.side !== 'player') return 1;
    return Math.max(0.25, 1 - this.outroT * 0.8);
  }

  /** 弹体当前位置+朝向（参考像素；含发射锚点与高抛弧）。 */
  projPose(p: S7FxProjState): { x: number; y: number; angle: number } {
    const k = Math.min(1, p.age / p.flightSec);
    const x0 = p.fromX + p.ox, y0 = p.fromY + p.oy;
    const x = x0 + (p.toX - x0) * k;
    const lift = (p.spec.arc || 0) * 120 * Math.sin(Math.PI * k);
    const y = y0 + (p.toY - y0) * k - lift;
    const angle = Math.atan2(p.toY - p.fromY, p.toX - p.fromX) + Math.PI / 2;
    return { x, y, angle };
  }

  private muzzleOffset(unitId: string, shotIdx: number): readonly [number, number] {
    const u = this.units[unitId];
    if (!u) return [0, 0];
    const anchors = S7FX_MUZZLES[u.unitRef]
      ?? (u.side === 'player' ? MUZZLE_PLAYER_DEFAULT : MUZZLE_ENEMY_DEFAULT);
    const a = anchors[(shotIdx || 0) % anchors.length];
    return [a[0] * u.w, a[1] * u.h];
  }

  private exec(c: S7FxCommand): void {
    const u = 'unitId' in c ? this.units[c.unitId] : undefined;
    switch (c.kind) {
      case 'spawn':
        if (u && !u.present) { // 已列阵单位不重播入场（开场敌人构造即在场）
          u.present = true;
          u.spawnT = 0.4;
          // Boss 登场推镜（首个 Boss 一次性·总谱 §5：1.00→1.06 约 1s）
          if (u.isBoss && !this.bossZoomPlayed) { this.bossZoomPlayed = true; this.bossZoomT = 1.0; }
        }
        break;
      case 'muzzle': {
        const m = this.muzzleOffset(c.unitId, 0);
        this.impacts.push({ x: c.at.x * S7FX_REF_W + m[0], y: c.at.y * S7FX_REF_H + m[1], kind: 'muzzle', size: 0.5, color: c.color, age: 0, life: 0.1 });
        if (u) u.lungeT = 0.14;
        break;
      }
      case 'projectile': {
        if (this.projs.length >= PROJ_CAP) this.projs.shift(); // 红线：超发丢最旧
        const m = c.srcId !== undefined ? this.muzzleOffset(c.srcId, c.shotIdx ?? 0) : ([0, 0] as const);
        this.projs.push({
          spec: c.spec,
          fromX: c.from.x * S7FX_REF_W, fromY: c.from.y * S7FX_REF_H,
          toX: c.to.x * S7FX_REF_W, toY: c.to.y * S7FX_REF_H,
          flightSec: c.flightSec, age: 0, ox: m[0], oy: m[1], vLevel: c.vLevel,
        });
        break;
      }
      case 'impact': {
        const dflt = c.impact.kind === 'ring_expand' || c.impact.kind === 'cage_ring' ? 0.42
          : c.impact.kind === 'bubble_pop' ? 0.35 : 0.26;
        const life = c.impact.durationSec || dflt;
        const x = c.at.x * S7FX_REF_W, y = c.at.y * S7FX_REF_H;
        this.impacts.push({ x, y, kind: c.impact.kind, size: c.impact.size, color: c.color, age: 0, life });
        if (c.impact.kind === 'burst_small' || c.impact.kind === 'burst_mid' || c.impact.kind === 'burst_big') {
          const n = c.impact.kind === 'burst_big' ? 9 : c.impact.kind === 'burst_mid' ? 6 : 3;
          for (let i = 0; i < n; i += 1) {
            const a = this.rng() * Math.PI * 2, sp = 30 + this.rng() * 70;
            this.embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 36, age: 0, life: 0.45 + this.rng() * 0.3, color: c.color, size: 1.2 + this.rng() * 1.6 });
          }
          if (this.embers.length > EMBER_CAP) this.embers.splice(0, this.embers.length - EMBER_CAP);
        }
        break;
      }
      case 'unit_flash':
        if (u) {
          u.flashT = 0.12;
          if (c.crit) u.critRingT = 0.3; // 总谱 §3.1：暴击=爆点外加一圈冲击环（批4 欠账补齐）
        }
        break;
      case 'wave_banner':
        this.waveIdx = c.wave;
        this.waveBannerT = 1.5;
        break;
      case 'unit_shake':
        if (u) u.shakeT = 0.1;
        break;
      case 'hp_change': {
        if (u) u.hpPct = c.hpPct;
        if (u && typeof c.delta === 'number' && c.delta < 0) {
          // 同拍多数字防撞字：x 撒得更开 + 按同屏序号纵向错层
          const lane = this.pops.length % 3;
          this.pops.push({
            x: u.x + (this.rng() - 0.5) * u.w * 0.9, y: u.y - u.h * 0.55 - lane * 9,
            txt: String(-c.delta), crit: !!c.crit, age: 0, life: 0.8,
          });
          if (this.pops.length > POP_CAP) this.pops.splice(0, this.pops.length - POP_CAP);
        }
        // 治疗（差分正 delta）：泛绿柔光·不出数字（总谱 §3.3"血条就是数字的替身"）
        if (u && typeof c.delta === 'number' && c.delta > 0) u.healGlowT = 0.35;
        break;
      }
      case 'death_burst': {
        if (u) { u.alive = false; u.deadT = 0.4; }
        const colors = ['#FFD93D', '#FF8A3D', '#F5A8C0', '#4FC3F7', '#7ED957'];
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + this.rng() * 0.5;
          this.bursts.push({ x: c.at.x * S7FX_REF_W, y: c.at.y * S7FX_REF_H, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, age: 0, life: 0.4, color: colors[i % 5], size: 3.4 });
        }
        // 清场最后一击=急刹+顿帧（总谱 §4/§5·敌方全灭瞬间）
        if (u && u.side === 'enemy') {
          let anyEnemyAlive = false;
          for (const other of this.unitList) {
            if (other.side === 'enemy' && other.alive) { anyEnemyAlive = true; break; }
          }
          if (!anyEnemyAlive) this.freezeT = 0.22;
        }
        break;
      }
      case 'recoil':
        if (u) { u.recoilT = 0.15; u.castGlowT = 0.4; } // 磨精批2 降噪：0.55→0.4（同屏施法环过多过吵）
        break;
      case 'darken':
        this.darkenT = c.durationSec;
        this.darkenDur = c.durationSec;
        this.starPulseT = 0.3; // V3 曲速脉冲：星光拉线+punch-zoom 与压暗同拍（总谱 §4/§5）
        break;
      default:
        break;
    }
  }
}
