// 块6b-2：建筑运行时状态 + 升级服务测试（纯 TS）。
// 状态：解锁=蓝图激活1级(幂等)/取等级/可升判定/升级封顶。服务：升级花星矿、5 类边界(未解锁/满级/坏成本/星矿不足/成功)失败不改动。
import { describe, it, expect } from 'vitest';
import { createDefaultS7ResourceState } from '../assets/scripts/save/S7SaveService';
import {
  createDefaultS7BuildingState,
  normalizeS7BuildingState,
  isBuildingUnlocked,
  getBuildingLevel,
  unlockBuilding,
  canUpgradeBuilding,
  bumpBuildingLevel,
  S7_BUILDING_MAX_LEVEL,
} from '../assets/scripts/core/s7/S7BuildingState';
import { upgradeBuilding } from '../assets/scripts/core/s7/S7BuildingUpgradeService';

describe('块6b-2 建筑状态 S7BuildingState', () => {
  it('默认空建筑', () => {
    expect(createDefaultS7BuildingState()).toEqual({ levels: {} });
  });

  it('解锁=蓝图激活1级，且幂等（重复解锁不改等级、返回 false）', () => {
    const s = createDefaultS7BuildingState();
    expect(isBuildingUnlocked(s, 'bld_dock')).toBe(false);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(0); // 未解锁=0
    expect(unlockBuilding(s, 'bld_dock')).toBe(true);
    expect(isBuildingUnlocked(s, 'bld_dock')).toBe(true);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(1);
    // 幂等：再解锁不变
    expect(unlockBuilding(s, 'bld_dock')).toBe(false);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(1);
  });

  it('可升判定：未解锁=false、1~9级=true、满级=false', () => {
    const s = createDefaultS7BuildingState();
    expect(canUpgradeBuilding(s, 'bld_dock')).toBe(false); // 未解锁
    unlockBuilding(s, 'bld_dock');
    expect(canUpgradeBuilding(s, 'bld_dock')).toBe(true); // 1 级
    s.levels['bld_dock'] = S7_BUILDING_MAX_LEVEL;
    expect(canUpgradeBuilding(s, 'bld_dock')).toBe(false); // 满级
  });

  it('bumpBuildingLevel：可升则 +1，满级/未解锁返回 false 不变', () => {
    const s = createDefaultS7BuildingState();
    expect(bumpBuildingLevel(s, 'bld_dock')).toBe(false); // 未解锁
    unlockBuilding(s, 'bld_dock');
    expect(bumpBuildingLevel(s, 'bld_dock')).toBe(true);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(2);
    s.levels['bld_dock'] = S7_BUILDING_MAX_LEVEL;
    expect(bumpBuildingLevel(s, 'bld_dock')).toBe(false); // 满级
    expect(getBuildingLevel(s, 'bld_dock')).toBe(S7_BUILDING_MAX_LEVEL);
  });

  it('normalize：保留合法项、丢弃越界/非整数/脏键/非法结构', () => {
    // 用 JSON.parse 造脏输入：__proto__/constructor 才会成为「真的自有属性」（对象字面量里它们是特殊语法、不建自有属性）。
    // 其中 constructor:5 若无脏键 guard 会原样漏进结果 → 本断言能真正验到防护（非假过）。
    const dirty = JSON.parse(
      '{"levels":{"bld_dock":5,"bld_habitat":1,"bld_bad_low":0,"bld_bad_high":11,"bld_bad_float":3.5,"bld_bad_str":"x","__proto__":9,"constructor":7}}',
    );
    const s = normalizeS7BuildingState(dirty);
    expect(s.levels).toEqual({ bld_dock: 5, bld_habitat: 1 });
  });

  it('normalize：非对象 / 缺 levels 退化为默认空', () => {
    expect(normalizeS7BuildingState(null)).toEqual({ levels: {} });
    expect(normalizeS7BuildingState(42)).toEqual({ levels: {} });
    expect(normalizeS7BuildingState({})).toEqual({ levels: {} });
    expect(normalizeS7BuildingState({ levels: 'nope' })).toEqual({ levels: {} });
  });
});

describe('块6b-2 建筑升级服务 S7BuildingUpgradeService', () => {
  it('成功升级：扣星矿 + 升 1 级 + 返回新等级/花费', () => {
    const s = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    unlockBuilding(s, 'bld_dock');
    res.starOre = 100;
    const r = upgradeBuilding(s, res, 'bld_dock', 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newLevel).toBe(2);
    expect(r.starOreSpent).toBe(30);
    expect(res.starOre).toBe(70); // 扣了 30
    expect(getBuildingLevel(s, 'bld_dock')).toBe(2);
  });

  it('未解锁：not_unlocked，不改动 state/resources', () => {
    const s = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    res.starOre = 100;
    const r = upgradeBuilding(s, res, 'bld_dock', 30);
    expect(r).toEqual({ ok: false, code: 'not_unlocked' });
    expect(res.starOre).toBe(100); // 未扣
    expect(isBuildingUnlocked(s, 'bld_dock')).toBe(false);
  });

  it('满级：max_level，不改动', () => {
    const s = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    unlockBuilding(s, 'bld_dock');
    s.levels['bld_dock'] = S7_BUILDING_MAX_LEVEL;
    res.starOre = 1000;
    const r = upgradeBuilding(s, res, 'bld_dock', 30);
    expect(r).toEqual({ ok: false, code: 'max_level' });
    expect(res.starOre).toBe(1000);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(S7_BUILDING_MAX_LEVEL);
  });

  it('星矿不足：insufficient_star_ore，不扣不升', () => {
    const s = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    unlockBuilding(s, 'bld_dock');
    res.starOre = 20;
    const r = upgradeBuilding(s, res, 'bld_dock', 30);
    expect(r).toEqual({ ok: false, code: 'insufficient_star_ore' });
    expect(res.starOre).toBe(20); // 不扣
    expect(getBuildingLevel(s, 'bld_dock')).toBe(1); // 不升
  });

  it('坏成本（负数/非整数）：bad_cost，不改动；成本=0 合法（免费升级）', () => {
    const s = createDefaultS7BuildingState();
    const res = createDefaultS7ResourceState();
    unlockBuilding(s, 'bld_dock');
    res.starOre = 100;
    expect(upgradeBuilding(s, res, 'bld_dock', -5)).toEqual({ ok: false, code: 'bad_cost' });
    expect(upgradeBuilding(s, res, 'bld_dock', 3.5)).toEqual({ ok: false, code: 'bad_cost' });
    expect(res.starOre).toBe(100);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(1);
    // 成本 0 合法：升级且不扣
    const r0 = upgradeBuilding(s, res, 'bld_dock', 0);
    expect(r0.ok).toBe(true);
    expect(res.starOre).toBe(100);
    expect(getBuildingLevel(s, 'bld_dock')).toBe(2);
  });
});
