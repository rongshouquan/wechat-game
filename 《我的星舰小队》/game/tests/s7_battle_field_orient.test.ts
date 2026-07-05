// 战场空间朝向·唯一真源（B0.7·B0.6#13·Ron 2026-07-05 防再犯）：纯换算·锁朝向+防漂移。
import { describe, it, expect } from 'vitest';
import {
  s7FieldVisualCell, s7FieldIsFrontRow, s7FieldUniformPos,
  S7_FIELD_DEPTH, S7_FIELD_LATERAL,
} from '../assets/scripts/ui/S7BattleFieldOrient';

describe('S7 战场朝向 · s7FieldVisualCell（唯一真源）', () => {
  it('我方：前排 c2 在最上、后排 c0 在最下；横排 row=左右', () => {
    expect(s7FieldVisualCell('player', 0, 2)).toEqual({ visualRow: 0, visualCol: 0 }); // c2 前排=顶·row0=左
    expect(s7FieldVisualCell('player', 2, 0)).toEqual({ visualRow: 2, visualCol: 2 }); // c0 后排=底·row2=右
    expect(s7FieldVisualCell('player', 1, 1).visualRow).toBe(1); // 中排
  });
  it('敌方：前排 c0 在最下、最深 c6 在最上；横排 row=左右', () => {
    expect(s7FieldVisualCell('enemy', 0, 0)).toEqual({ visualRow: 6, visualCol: 0 }); // c0 前排=底(贴近我)
    expect(s7FieldVisualCell('enemy', 4, 6)).toEqual({ visualRow: 0, visualCol: 4 }); // c6 最深=顶·row4=右
  });
  it('前排判定：我方 c2 / 敌方 c0 = 前排（贴近对方那排）', () => {
    expect(s7FieldIsFrontRow('player', 2)).toBe(true);
    expect(s7FieldIsFrontRow('player', 0)).toBe(false);
    expect(s7FieldIsFrontRow('enemy', 0)).toBe(true);
    expect(s7FieldIsFrontRow('enemy', 6)).toBe(false);
  });
  it('格数常量：我方 3 深×3 横 / 敌方 7 深×5 横', () => {
    expect(S7_FIELD_DEPTH.player).toBe(3);
    expect(S7_FIELD_LATERAL.player).toBe(3);
    expect(S7_FIELD_DEPTH.enemy).toBe(7);
    expect(S7_FIELD_LATERAL.enemy).toBe(5);
  });
});

describe('S7 战场朝向 · s7FieldUniformPos（均匀网格摆放·朝向落地）', () => {
  const A = { ax: 0, ay: 0, cw: 100, ch: 100, gap: 10 };
  it('我方前排(c2)在后排(c0)之上（y 更大）', () => {
    const front = s7FieldUniformPos('player', 1, 2, A.ax, A.ay, A.cw, A.ch, A.gap);
    const back = s7FieldUniformPos('player', 1, 0, A.ax, A.ay, A.cw, A.ch, A.gap);
    expect(front.y).toBeGreaterThan(back.y); // 前排在上=y 大
  });
  it('敌方前排(c0)在最深(c6)之下（y 更小）', () => {
    const front = s7FieldUniformPos('enemy', 2, 0, A.ax, A.ay, A.cw, A.ch, A.gap);
    const deep = s7FieldUniformPos('enemy', 2, 6, A.ax, A.ay, A.cw, A.ch, A.gap);
    expect(front.y).toBeLessThan(deep.y); // 前排在下=y 小
  });
  it('横排 row 递增 = x 向右', () => {
    const left = s7FieldUniformPos('player', 0, 1, A.ax, A.ay, A.cw, A.ch, A.gap);
    const right = s7FieldUniformPos('player', 2, 1, A.ax, A.ay, A.cw, A.ch, A.gap);
    expect(right.x).toBeGreaterThan(left.x);
  });
});
