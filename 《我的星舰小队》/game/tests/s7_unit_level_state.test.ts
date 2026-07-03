// C1b 升级变强 步1：单位等级存档（星舰/驾驶员等级）状态结构 + 读写（纯 TS）。
import { describe, it, expect } from 'vitest';
import {
  S7_UNIT_MIN_LEVEL,
  S7_UNIT_MAX_LEVEL,
  createDefaultS7UnitLevelState,
  normalizeS7UnitLevelState,
  getShipLevel,
  getPilotLevel,
  setShipLevel,
  setPilotLevel,
} from '../assets/scripts/core/s7/S7UnitLevelState';

describe('C1b 升级变强 步1 单位等级 S7UnitLevelState', () => {
  it('等级上下界常量；默认空账本', () => {
    expect(S7_UNIT_MIN_LEVEL).toBe(1);
    // 取消建筑卡等级（Ron 2026-07-03）：绝对上限抬到 100（=SS/5★ 天花板；每单位实际上限由阶级算）。
    expect(S7_UNIT_MAX_LEVEL).toBe(100);
    expect(createDefaultS7UnitLevelState()).toEqual({ shipLevels: {}, pilotLevels: {} });
  });

  it('get 缺记录默认 1 级；有记录返回该级', () => {
    const st = createDefaultS7UnitLevelState();
    expect(getShipLevel(st, 'shp01')).toBe(1);
    expect(getPilotLevel(st, 'pil03')).toBe(1);
    st.shipLevels['shp01'] = 7;
    expect(getShipLevel(st, 'shp01')).toBe(7);
  });

  it('set 夹紧到 [1,100] 并向下取整', () => {
    const st = createDefaultS7UnitLevelState();
    setShipLevel(st, 'shp01', 5);
    expect(getShipLevel(st, 'shp01')).toBe(5);
    setShipLevel(st, 'shp01', 999); // 超上限 → 100
    expect(getShipLevel(st, 'shp01')).toBe(100);
    setShipLevel(st, 'shp02', 0); // 低于下限 → 1
    expect(getShipLevel(st, 'shp02')).toBe(1);
    setShipLevel(st, 'shp03', 3.9); // 取整 → 3
    expect(getShipLevel(st, 'shp03')).toBe(3);
    setShipLevel(st, '', 5); // 空 id 无操作
    expect(st.shipLevels['']).toBeUndefined();
    setPilotLevel(st, 'pil01', 12);
    expect(getPilotLevel(st, 'pil01')).toBe(12);
  });

  it('normalize：只留 [1,100] 整数；越界/非整数/脏键丢弃；两本账本独立', () => {
    const out = normalizeS7UnitLevelState({
      shipLevels: { shp01: 10, shp02: 0, shp03: 101, shp04: 2.5, shp05: 'x', '': 3 },
      pilotLevels: { pil01: 100, pil02: 1 }, // 100=新上限边界，保留
    });
    expect(out.shipLevels).toEqual({ shp01: 10 }); // 0/101(越界)/2.5/'x'/空键 全丢
    expect(out.pilotLevels).toEqual({ pil01: 100, pil02: 1 });
  });

  it('normalize：容错非对象 / 缺字段 → 空账本', () => {
    expect(normalizeS7UnitLevelState(null)).toEqual({ shipLevels: {}, pilotLevels: {} });
    expect(normalizeS7UnitLevelState({})).toEqual({ shipLevels: {}, pilotLevels: {} });
    expect(normalizeS7UnitLevelState({ shipLevels: 'oops' })).toEqual({ shipLevels: {}, pilotLevels: {} });
  });

  it('防原型污染：JSON.parse 脏档的 __proto__/constructor 键丢弃、不污染原型', () => {
    const raw = JSON.parse('{"shipLevels":{"__proto__":5,"constructor":7,"shp01":9}}');
    const out = normalizeS7UnitLevelState(raw);
    expect(out.shipLevels).toEqual({ shp01: 9 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
