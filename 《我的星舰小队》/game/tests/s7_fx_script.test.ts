// 演出骨架批：签名查表 + 指令流生成器单测（纯 TS，不碰引擎）。
import { describe, expect, it } from 'vitest';
import { resolveFxSignature } from '../assets/scripts/core/s7/fx/S7FxCatalog';
import { buildS7FxScript, S7FxCommand } from '../assets/scripts/core/s7/fx/S7FxScript';
import { S7BattlePlayback } from '../assets/scripts/core/s7/S7BattlePlayback';

// ---- 手工迷你回放（不跑引擎；字段齐 S7BattlePlayback 结构）----
function miniPlayback(): S7BattlePlayback {
  return {
    roster: [
      { unitId: 'A', side: 'player', slotRef: 'p0c2', row: 0, col: 2, maxHp: 100, unitStatRef: 'bu_ship_guardian' },
      { unitId: 'E1', side: 'enemy', slotRef: 'r0c1', row: 0, col: 1, maxHp: 50, unitStatRef: 'bu_n001' },
    ],
    frames: [
      { timeSec: 0, attacks: [], hits: [], deaths: [], spawnedIds: ['E1'], units: {} },
      {
        timeSec: 1,
        attacks: [{ actorId: 'A', side: 'player', targetIds: ['E1'], isUltimate: false, isCore: false, effectType: 'damage', effectRef: 'eff_x' }],
        hits: [{ targetId: 'E1', amount: 30, crit: false, hpAfter: 20 }],
        deaths: [],
        spawnedIds: [],
        units: {},
      },
      {
        timeSec: 2,
        attacks: [{ actorId: 'A', side: 'player', targetIds: ['E1'], isUltimate: false, isCore: false, effectType: 'damage', effectRef: 'eff_x' }],
        hits: [{ targetId: 'E1', amount: 20, crit: true, hpAfter: 0 }],
        deaths: ['E1'],
        spawnedIds: [],
        units: {},
      },
    ],
    winner: 'player',
    reason: 'wipe',
    durationSec: 2,
    playerSurvivorPct: 100,
  } as unknown as S7BattlePlayback;
}

const RESOLVE = (ref: string) =>
  ref === 'bu_ship_guardian' ? { unitRef: 'shp03', roleTag: 'assault' } : { unitRef: '', roleTag: '' };

describe('S7FxCatalog 签名查表', () => {
  it('锋矢(shp03)普攻=三连点射：3 发/0.1s 间隔/细弹', () => {
    const s = resolveFxSignature({ unitRef: 'shp03', roleTag: 'assault', effectType: 'damage', isUltimate: false, side: 'player' });
    expect(s.projectile?.count).toBe(3);
    expect(s.projectile?.intervalSec).toBeCloseTo(0.1);
    expect(s.projectile!.size).toBeLessThan(1);
    expect(s.vLevel).toBe(1);
  });

  it('烈阳(shp09)技能=高抛巨弹+大爆点、守 V2', () => {
    const s = resolveFxSignature({ unitRef: 'shp09', roleTag: 'artillery', effectType: 'damage', isUltimate: true, side: 'player' });
    expect(s.projectile?.arc).toBe(1);
    expect(s.projectile!.size).toBeGreaterThan(1.5);
    expect(s.impact.kind).toBe('burst_big');
    expect(s.vLevel).toBe(2);
  });

  it('铁壁(shp06)技能怒吼=原地环（无弹体）', () => {
    const s = resolveFxSignature({ unitRef: 'shp06', roleTag: 'guard', effectType: 'damage', isUltimate: true, side: 'player' });
    expect(s.projectile).toBeNull();
    expect(s.impact.kind).toBe('ring_expand');
  });

  it('治疗效果恒功能绿（不随舰变）', () => {
    const s = resolveFxSignature({ unitRef: 'shp09', roleTag: 'artillery', effectType: 'heal', isUltimate: false, side: 'player' });
    expect(s.projectile?.color).toBe('#7ED957');
    expect(s.projectile?.shape).toBe('bubble');
  });

  it('未知舰/未知 roleTag 不炸、有兜底；敌方走族弹', () => {
    const generic = resolveFxSignature({ unitRef: 'shp99', roleTag: 'weird', effectType: 'damage', isUltimate: false, side: 'player' });
    expect(generic.projectile).not.toBeNull();
    const enemy = resolveFxSignature({ unitRef: '', roleTag: '', effectType: 'damage', isUltimate: false, side: 'enemy' });
    expect(enemy.projectile?.color).toBe('#D94A4A');
  });
});

describe('S7FxScript 指令流', () => {
  it('锋矢普攻一次=1 炮口闪+3 弹体+3 爆点；弹体按 0.1s 错峰', () => {
    const tl = buildS7FxScript(miniPlayback(), RESOLVE);
    const f1 = tl.commands.filter((c) => c.tSec >= 1 && c.tSec < 2);
    expect(f1.filter((c) => c.kind === 'muzzle')).toHaveLength(1);
    const shots = f1.filter((c) => c.kind === 'projectile');
    expect(shots).toHaveLength(3);
    const launches = shots.map((c) => c.tSec).sort((a, b) => a - b);
    expect(launches[1] - launches[0]).toBeCloseTo(0.1, 5);
    expect(f1.filter((c) => c.kind === 'impact')).toHaveLength(3);
  });

  it('命中视觉锚首发到达时刻（演出-结算同拍锁定：伤害视觉不早于弹道出现）', () => {
    const tl = buildS7FxScript(miniPlayback(), RESOLVE);
    const firstShot = tl.commands.find((c) => c.kind === 'projectile')!;
    const flash = tl.commands.find((c) => c.kind === 'unit_flash')!;
    expect(flash.tSec).toBeGreaterThan(firstShot.tSec);
    expect(flash.tSec).toBeCloseTo(firstShot.tSec + (firstShot as Extract<S7FxCommand, { kind: 'projectile' }>).flightSec, 5);
  });

  it('死亡星爆晚于对应命中；spawn 指令在场', () => {
    const tl = buildS7FxScript(miniPlayback(), RESOLVE);
    const death = tl.commands.find((c) => c.kind === 'death_burst')!;
    const lastFlash = tl.commands.filter((c) => c.kind === 'unit_flash').pop()!;
    expect(death.tSec).toBeGreaterThan(lastFlash.tSec);
    expect(tl.commands.some((c) => c.kind === 'spawn' && c.unitId === 'E1')).toBe(true);
  });

  it('指令按时间升序；布局=敌上我下（敌 y<0.5<我 y）', () => {
    const tl = buildS7FxScript(miniPlayback(), RESOLVE);
    for (let i = 1; i < tl.commands.length; i += 1) {
      expect(tl.commands[i].tSec).toBeGreaterThanOrEqual(tl.commands[i - 1].tSec);
    }
    expect(tl.layout['E1'].at.y).toBeLessThan(0.5);
    expect(tl.layout['A'].at.y).toBeGreaterThan(0.5);
  });

  it('无 resolver 也能跑（全兜底签名，不炸）', () => {
    const tl = buildS7FxScript(miniPlayback());
    expect(tl.commands.length).toBeGreaterThan(0);
  });

  it('星核 V3 排场：isCore 伤害触发=全场压暗+陨星天降+大爆（不走常规签名弹）', () => {
    const pb = miniPlayback();
    pb.frames[1].attacks = [{ actorId: 'A', side: 'player', targetIds: ['E1'], isUltimate: true, isCore: true, effectType: 'damage', effectRef: 'eff_core' }] as typeof pb.frames[1]['attacks'];
    const tl = buildS7FxScript(pb, RESOLVE);
    const f1 = tl.commands.filter((c) => c.tSec >= 1 && c.tSec < 2);
    const darken = f1.find((c) => c.kind === 'darken');
    expect(darken).toBeTruthy();
    const meteor = f1.find((c) => c.kind === 'projectile');
    expect(meteor).toBeTruthy();
    if (meteor && meteor.kind === 'projectile') {
      expect(meteor.from.y).toBeLessThan(0); // 天顶画外落下
      expect(meteor.spec.size).toBeGreaterThan(3);
    }
    const bigBurst = f1.find((c) => c.kind === 'impact' && c.impact.kind === 'burst_big');
    expect(bigBurst).toBeTruthy();
  });

  it('敌方三排楔形阵：前中后排都有人、Boss 居中排中心、前排厚于后排（Ron 阵型三调）', () => {
    const pb = miniPlayback();
    // 1 Boss（maxHp 最大）+ 7 小怪
    pb.roster = [
      pb.roster[0],
      { unitId: 'BOSS', side: 'enemy', slotRef: 'r2c2', row: 2, col: 2, maxHp: 500, unitStatRef: 'bu_boss' },
      ...Array.from({ length: 7 }, (_, i) => ({
        unitId: `M${i}`, side: 'enemy' as const, slotRef: `r${i % 3}c${i % 5}`, row: i % 3, col: i % 5, maxHp: 50, unitStatRef: 'bu_n001',
      })),
    ] as typeof pb.roster;
    const tl = buildS7FxScript(pb);
    const boss = tl.layout['BOSS'].at;
    expect(boss.x).toBeCloseTo(0.5, 5);
    expect(boss.y).toBeCloseTo(0.28, 5); // =rowY[1] 中排（07-13 舒展版 0.29→0.28，随排距表调）
    const ys = Array.from({ length: 7 }, (_, i) => tl.layout[`M${i}`].at.y);
    const front = ys.filter((y) => y > 0.34);
    const mid = ys.filter((y) => y > 0.245 && y <= 0.34);
    const back = ys.filter((y) => y <= 0.245);
    expect(front.length).toBeGreaterThan(0);
    expect(mid.length).toBeGreaterThan(0);
    expect(back.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThanOrEqual(back.length); // 前中厚重、后排最薄
  });
});
