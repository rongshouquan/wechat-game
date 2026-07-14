// S7FxPlayModel 播放模型单测（Cocos 壳批·纯逻辑层——渲染组件薄壳不进测试）。
import { describe, expect, it } from 'vitest';
import { buildS7FxScript } from '../assets/scripts/core/s7/fx/S7FxScript';
import type { S7BattlePlayback } from '../assets/scripts/core/s7/S7BattlePlayback';
import {
  S7FxPlayModel, S7FxRosterEntry, S7FX_REF_W, S7FX_REF_H, S7FX_MUZZLES,
} from '../assets/scripts/core/s7/fx/S7FxPlayModel';

const RESOLVE = (ref: string): { unitRef: string; roleTag: string } =>
  ref === 'bu_ship_fengshi' ? { unitRef: 'shp03', roleTag: 'assault' } : { unitRef: '', roleTag: '' };

/** 最小回放：我方锋矢 A 在 t=1 三连打敌 E1，E1 掉血；t=2 E1 死。 */
function miniPlayback(): S7BattlePlayback {
  return {
    winner: 'player',
    reason: 'all_enemies_down',
    durationSec: 3,
    roster: [
      { unitId: 'A', side: 'player', unitStatRef: 'bu_ship_fengshi', row: 0, col: 2, maxHp: 700 },
      { unitId: 'E1', side: 'enemy', unitStatRef: 'bu_en_raider', row: 0, col: 2, maxHp: 300 },
      { unitId: 'E2', side: 'enemy', unitStatRef: 'bu_en_boss', row: 1, col: 2, maxHp: 3000 },
    ],
    frames: [
      { timeSec: 0, attacks: [], hits: [], deaths: [], spawnedIds: ['A', 'E1', 'E2'], units: [] },
      {
        timeSec: 1,
        attacks: [{ actorId: 'A', side: 'player', targetIds: ['E1'], isUltimate: false, isCore: false, effectType: 'damage', effectRef: 'eff_x' }],
        hits: [{ targetId: 'E1', amount: 120, crit: true, hpAfter: 180 }],
        deaths: [], spawnedIds: [], units: [],
      },
      { timeSec: 2, attacks: [], hits: [{ targetId: 'E1', amount: 180, crit: false, hpAfter: 0 }], deaths: ['E1'], spawnedIds: [], units: [] },
    ],
  } as unknown as S7BattlePlayback;
}

function makeModel(): S7FxPlayModel {
  const pb = miniPlayback();
  const tl = buildS7FxScript(pb, RESOLVE);
  const roster: S7FxRosterEntry[] = pb.roster.map((u) => {
    const r = RESOLVE(u.unitStatRef);
    return { unitId: u.unitId, side: u.side, unitRef: r.unitRef, roleTag: r.roleTag, maxHp: u.maxHp };
  });
  return new S7FxPlayModel(tl, roster);
}

function stepTo(m: S7FxPlayModel, t: number, dt = 0.02): void {
  while (m.t < t) m.step(dt);
}

describe('S7FxPlayModel 播放态', () => {
  it('尺寸阶：我方 92 / Boss(最大 maxHp)=150 / 小兵=54；布局坐标进参考画布', () => {
    const m = makeModel();
    expect(m.units.A.w).toBe(92);
    expect(m.units.E2.w).toBe(150);
    expect(m.units.E2.isBoss).toBe(true);
    expect(m.units.E1.w).toBe(54);
    for (const u of m.unitList) {
      expect(u.x).toBeGreaterThanOrEqual(0);
      expect(u.x).toBeLessThanOrEqual(S7FX_REF_W);
      expect(u.y).toBeGreaterThanOrEqual(0);
      expect(u.y).toBeLessThanOrEqual(S7FX_REF_H);
    }
  });

  it('开场：我方在场、敌方随 spawn 指令入场（带滑入计时）', () => {
    const m = makeModel();
    expect(m.units.A.present).toBe(true);
    expect(m.units.E1.present).toBe(false);
    m.step(0.02); // t=0 帧 spawn 落地
    expect(m.units.E1.present).toBe(true);
    expect(m.units.E1.spawnT).toBeGreaterThan(0);
  });

  it('三连点射入池且带锋矢锚点偏移（首发=鼻尖锚·y 负向机头）', () => {
    const m = makeModel();
    stepTo(m, 1.05);
    expect(m.projs.length).toBeGreaterThanOrEqual(1);
    const first = m.projs[0];
    const anchor = S7FX_MUZZLES.shp03[0];
    expect(first.ox).toBeCloseTo(anchor[0] * 92, 5);
    expect(first.oy).toBeCloseTo(anchor[1] * 92, 5);
    // 弹体位姿：age=0 时正好在发射锚点上（起点=炮口而非舰心）
    const atLaunch = { ...first, age: 0 };
    const pose = m.projPose(atLaunch);
    expect(pose.x).toBeCloseTo(first.fromX + first.ox, 5);
    expect(pose.y).toBeCloseTo(first.fromY + first.oy, 5);
  });

  it('命中：白闪/抖动计时器点亮，血量落到 60%，暴击伤害数字入池', () => {
    const m = makeModel();
    stepTo(m, 1.4);
    expect(m.units.E1.hpPct).toBe(60);
    expect(m.pops.length).toBeGreaterThanOrEqual(1);
    const pop = m.pops[0];
    expect(pop.txt).toBe('120');
    expect(pop.crit).toBe(true);
  });

  it('死亡：星爆碎粒生成、单位 alive=false 且 deadT 渐熄', () => {
    const m = makeModel();
    stepTo(m, 2.5);
    expect(m.units.E1.alive).toBe(false);
    stepTo(m, 3.2);
    expect(m.units.E1.deadT).toBe(0);
  });

  it('弹体 48 上限：超发丢最旧（总谱 §7 红线）', () => {
    const m = makeModel();
    stepTo(m, 0.1);
    for (let i = 0; i < 60; i += 1) {
      (m as unknown as { exec(c: unknown): void }).exec({
        tSec: 0, kind: 'projectile', from: { x: 0.5, y: 0.9 }, to: { x: 0.5, y: 0.2 },
        spec: { shape: 'bolt', count: 1, intervalSec: 0, flightSec: 9, size: 1, arc: 0, color: '#4FC3F7' },
        flightSec: 9, vLevel: 1, srcId: 'A', shotIdx: 0,
      });
    }
    expect(m.projs.length).toBeLessThanOrEqual(48);
  });

  it('skipToEnd：指令快进到终局、飞行物清空、finished=true', () => {
    const m = makeModel();
    m.skipToEnd();
    expect(m.finished).toBe(true);
    expect(m.projs.length).toBe(0);
    expect(m.units.E1.alive).toBe(false);
    expect(m.units.E1.hpPct).toBe(0);
  });

  it('restart：全池清空、单位复位、可重播出同样结果（确定性伪随机）', () => {
    const m = makeModel();
    stepTo(m, 1.4);
    const popTxt = m.pops[0]?.txt;
    m.restart();
    expect(m.t).toBe(0);
    expect(m.pops.length).toBe(0);
    expect(m.units.E1.present).toBe(false);
    expect(m.units.E1.hpPct).toBe(100);
    stepTo(m, 1.4);
    expect(m.pops[0]?.txt).toBe(popTxt);
  });

  it('大跳帧钳制：单步 dt>0.05 不会把战斗快进穿帧（后台切回防炸）', () => {
    const m = makeModel();
    m.step(5);
    expect(m.t).toBeLessThanOrEqual(0.05 + 1e-9);
  });
});

describe('S7FxPlayModel 磨精件（星流曲线/推镜/顿帧/治疗/收尾）', () => {
  it('治疗差分：快照血量回升 → hp_change 正 delta → 泛绿计时器亮、不出伤害数字', () => {
    const pb = miniPlayback();
    // A 在 t=2 帧快照血量从 700 回到 700（无变化）→ 改造：t=1 A 掉到 500，t=2 回到 650
    pb.frames[1].hits.push({ targetId: 'A', amount: 200, crit: false, hpAfter: 500 } as never);
    pb.frames[1].units = { A: { hp: 500, hpPct: 71, alive: true, present: true } } as never;
    pb.frames[2].units = { A: { hp: 650, hpPct: 93, alive: true, present: true } } as never;
    const tl = buildS7FxScript(pb, RESOLVE);
    const healCmd = tl.commands.find((c) => c.kind === 'hp_change' && (c.delta ?? 0) > 0);
    expect(healCmd).toBeTruthy();
    const roster: S7FxRosterEntry[] = pb.roster.map((u) => {
      const r = RESOLVE(u.unitStatRef);
      return { unitId: u.unitId, side: u.side, unitRef: r.unitRef, roleTag: r.roleTag, maxHp: u.maxHp };
    });
    const m = new S7FxPlayModel(tl, roster, 'player');
    stepTo(m, 2.1); // 辉光 0.35s——在其存续期内踩点
    expect(m.units.A.healGlowT).toBeGreaterThan(0);
    expect(m.pops.filter((p) => p.txt.indexOf('+') >= 0).length).toBe(0); // 治疗不出数字（总谱 §3.3）
  });

  it('末杀顿帧：敌方全灭瞬间 freezeT 点亮、战斗时钟急停 0.22s', () => {
    const pb = miniPlayback();
    pb.frames[2].deaths = ['E1', 'E2'];
    const tl = buildS7FxScript(pb, RESOLVE);
    const roster: S7FxRosterEntry[] = pb.roster.map((u) => {
      const r = RESOLVE(u.unitStatRef);
      return { unitId: u.unitId, side: u.side, unitRef: r.unitRef, roleTag: r.roleTag, maxHp: u.maxHp };
    });
    const m = new S7FxPlayModel(tl, roster, 'player');
    while (m.freezeT <= 0 && m.t < 2.5) m.step(0.02); // 步到顿帧点亮那一拍
    expect(m.freezeT).toBeGreaterThan(0);
    const tAt = m.t;
    m.step(0.05); m.step(0.05); // 顿帧期内推进
    expect(m.t).toBe(tAt); // 时钟没走
    expect(m.starSpeedK()).toBeLessThan(0.1); // 急刹
    for (let i = 0; i < 6; i += 1) m.step(0.05); // 顿帧耗尽后恢复
    expect(m.t).toBeGreaterThan(tAt);
  });

  it('星流曲线：入场快掠→巡航→V3 拉线脉冲→胜局收尾加速', () => {
    const m = makeModel();
    expect(m.starSpeedK()).toBeGreaterThan(2); // t<0.5 入场快掠
    stepTo(m, 0.8);
    expect(m.starSpeedK()).toBe(1); // 巡航
    m.starPulseT = 0.2;
    expect(m.starSpeedK()).toBeGreaterThan(4); // 曲速脉冲
    expect(m.starStreakK()).toBeGreaterThan(0);
    m.starPulseT = 0;
    m.skipToEnd();
    // makeModel 未传 winner（''）→ 收尾按败局慢漂；带 winner 的加速在收尾测覆盖
    expect(m.starSpeedK()).toBeLessThan(1);
  });

  it('Boss 登场推镜：Boss spawn 点亮 1s 推镜、峰值 ≤1.06、结束回 1', () => {
    const m = makeModel();
    m.step(0.02); // t=0 帧 spawn（E2=Boss）
    expect(m.bossZoomT).toBeGreaterThan(0);
    let peak = 1;
    for (let i = 0; i < 60; i += 1) { m.step(0.02); peak = Math.max(peak, m.zoomScale()); }
    expect(peak).toBeGreaterThan(1.03);
    expect(peak).toBeLessThanOrEqual(1.06 + 1e-9);
    for (let i = 0; i < 30; i += 1) m.step(0.05);
    expect(m.zoomScale()).toBe(1);
  });

  it('胜局收尾：finished 后我方向上冲出（负位移）、敌方不动、0.9s 后 outroDone', () => {
    const pb = miniPlayback();
    const tl = buildS7FxScript(pb, RESOLVE);
    const roster: S7FxRosterEntry[] = pb.roster.map((u) => {
      const r = RESOLVE(u.unitStatRef);
      return { unitId: u.unitId, side: u.side, unitRef: r.unitRef, roleTag: r.roleTag, maxHp: u.maxHp };
    });
    const m = new S7FxPlayModel(tl, roster, 'player');
    while (!m.finished) m.step(0.05);
    expect(m.outroDone()).toBe(false);
    for (let i = 0; i < 12; i += 1) m.step(0.05);
    expect(m.outroOffsetY(m.units.A)).toBeLessThan(0); // 我方向上（参考系 y 向下=负）
    expect(m.outroOffsetY(m.units.E2)).toBe(0); // 敌方不动（胜局）
    for (let i = 0; i < 8; i += 1) m.step(0.05);
    expect(m.outroDone()).toBe(true);
  });
});
