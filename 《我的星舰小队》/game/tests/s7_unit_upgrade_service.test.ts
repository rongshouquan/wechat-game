// 单位升级服务单测（步5 收尾批重定基·A9-4 逐级成本公式=初值表 v0.7 §7 支出侧）。
// 重定基总说明（旧→新→为什么对）：
//   旧 upgrade_cost_param"段总成本÷10 均摊+三币混扣+41-100 持平段末"占位 → 逐级公式
//   舰 L→L+1 = round(50×L^1.3×船坞折扣) 只花合金；员 = round(40×L^1.2×训练舱折扣) 只花记录
//   （B1 军饷身份：合金=舰粮/记录=员粮·1-100 全段同一公式=41-100 补段·机器真源 TRUTHS.shipLevelCost）。
import { describe, it, expect } from 'vitest';
import {
  upgradeShipOneLevel, upgradePilotOneLevel, shipLevelUpCost, pilotLevelUpCost,
  SHIP_LEVEL_COST_BASE, SHIP_LEVEL_COST_EXP, PILOT_LEVEL_COST_BASE, PILOT_LEVEL_COST_EXP,
} from '../assets/scripts/core/s7/S7UnitUpgradeService';
import { createDefaultS7UnitLevelState, getShipLevel, getPilotLevel, setShipLevel, setPilotLevel } from '../assets/scripts/core/s7/S7UnitLevelState';

describe('步5 · 升级成本公式对表（v0.7 §7）', () => {
  it('公式常量：舰 50×L^1.3 合金 / 员 40×L^1.2 记录', () => {
    expect(SHIP_LEVEL_COST_BASE).toBe(50);
    expect(SHIP_LEVEL_COST_EXP).toBe(1.3);
    expect(PILOT_LEVEL_COST_BASE).toBe(40);
    expect(PILOT_LEVEL_COST_EXP).toBe(1.2);
  });

  it('逐级成本手推：L1→2=50 / L10→11=998 / L40→41=6049 / L99→100=19647（41-100 真段=A9-4 补段）', () => {
    expect(shipLevelUpCost(1, 0)).toBe(50);
    expect(shipLevelUpCost(10, 0)).toBe(998);
    expect(shipLevelUpCost(40, 0)).toBe(6049);
    expect(shipLevelUpCost(99, 0)).toBe(19647); // 旧"41-100 持平段末"作废=真曲线
    expect(shipLevelUpCost(99, 0)).toBeGreaterThan(shipLevelUpCost(40, 0)); // 递增非持平
    expect(pilotLevelUpCost(1, 0)).toBe(40);
    expect(pilotLevelUpCost(10, 0)).toBe(634);
  });

  it('折扣线（细案①②）：船坞/训练舱 Lv10=−15% → round(50×0.85)=43 / round(40×0.85)=34；Lv1=49', () => {
    expect(shipLevelUpCost(1, 10)).toBe(43);
    expect(pilotLevelUpCost(1, 10)).toBe(34);
    expect(shipLevelUpCost(1, 1)).toBe(49);
  });
});

describe('C1b-step3 · 升舰（只花合金·船坞折扣）', () => {
  it('合金够：升 1 级、只扣合金（星矿/图纸零扣=B1 身份）', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { starOre: 100, hullAlloy: 100, shipBlueprint: 5, pilotToken: 0 };
    const r = upgradeShipOneLevel(levels, resources, 'shp01', 0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fromLevel).toBe(1);
      expect(r.toLevel).toBe(2);
      expect(r.spent).toEqual({ starOre: 0, hullAlloy: 50, shipBlueprint: 0 });
    }
    expect(resources.hullAlloy).toBe(50);
    expect(resources.starOre).toBe(100);     // 星矿不动（旧三币混扣作废）
    expect(resources.shipBlueprint).toBe(5); // 图纸不动
    expect(getShipLevel(levels, 'shp01')).toBe(2);
  });

  it('合金不够：insufficient·带 needed·不改状态', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { hullAlloy: 10 };
    const r = upgradeShipOneLevel(levels, resources, 'shp01', 0);
    expect(r).toMatchObject({ ok: false, reason: 'insufficient' });
    if (!r.ok) expect(r.needed?.hullAlloy).toBe(50);
    expect(resources.hullAlloy).toBe(10);
    expect(getShipLevel(levels, 'shp01')).toBe(1);
  });

  it('阶级上限：达 levelCap → cap_reached（升阶解锁更高）；绝对上限 100 → max_level', () => {
    const levels = createDefaultS7UnitLevelState();
    setShipLevel(levels, 'shp01', 20);
    const resources: Record<string, number> = { hullAlloy: 99999 };
    expect(upgradeShipOneLevel(levels, resources, 'shp01', 0, 20)).toMatchObject({ ok: false, reason: 'cap_reached' }); // C 阶顶 20
    setShipLevel(levels, 'shp01', 100);
    expect(upgradeShipOneLevel(levels, resources, 'shp01', 0, 100)).toMatchObject({ ok: false, reason: 'max_level' });
  });

  it('船坞折扣生效：Lv10 船坞升 L1→2 只扣 43', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { hullAlloy: 100 };
    const r = upgradeShipOneLevel(levels, resources, 'shp01', 10);
    expect(r.ok).toBe(true);
    expect(resources.hullAlloy).toBe(57); // 100−43
  });
});

describe('C1b-step3 · 升员（只花驾驶记录·训练舱折扣）', () => {
  it('记录够：升 1 级、只扣记录', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { pilotToken: 100, hullAlloy: 7 };
    const r = upgradePilotOneLevel(levels, resources, 'pil01', 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spentPilotToken).toBe(40);
    expect(resources.pilotToken).toBe(60);
    expect(resources.hullAlloy).toBe(7); // 合金不动
    expect(getPilotLevel(levels, 'pil01')).toBe(2);
  });

  it('记录不够：insufficient·带 needed·不改状态', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { pilotToken: 10 };
    const r = upgradePilotOneLevel(levels, resources, 'pil01', 0);
    expect(r).toMatchObject({ ok: false, reason: 'insufficient' });
    if (!r.ok) expect(r.neededPilotToken).toBe(40);
    expect(getPilotLevel(levels, 'pil01')).toBe(1);
  });

  it('星级上限：达 levelCap → cap_reached', () => {
    const levels = createDefaultS7UnitLevelState();
    setPilotLevel(levels, 'pil01', 20);
    expect(upgradePilotOneLevel(levels, { pilotToken: 9999 }, 'pil01', 0, 20)).toMatchObject({ ok: false, reason: 'cap_reached' });
  });

  it('训练舱折扣生效：Lv10 训练舱升 L1→2 只扣 34', () => {
    const levels = createDefaultS7UnitLevelState();
    const resources: Record<string, number> = { pilotToken: 100 };
    const r = upgradePilotOneLevel(levels, resources, 'pil01', 10);
    expect(r.ok).toBe(true);
    expect(resources.pilotToken).toBe(66); // 100−34
  });
});
