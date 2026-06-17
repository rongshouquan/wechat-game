// 最小集内容（数值取自 第二块/轻量B2-v0.1）：星舰(含技能) / 驾驶员(能力+天赋) / 插件 / 星核 / 敌人 + 装配器。
import type { UnitSpec, SkillSpec, TalentSpec, Targeting } from "./engine.ts";

interface ShipDef { name: string; maxHp: number; atk: number; atkInterval: number; def: number; skill: SkillSpec; }
export const SHIPS: Record<string, ShipDef> = {
  // 火炮·自由型：CD 技“集火炮”单体高伤
  freedom: { name: "自由号", maxHp: 800, atk: 60, atkInterval: 1.0, def: 20,
    skill: { name: "集火炮", trigger: "cooldown", cd: 8, action: { kind: "damage", mult: 3 } } },
  // 导弹·流派：条件技“饱和齐射”——场上敌 ≥3 时范围爆炸
  swarm: { name: "蜂群", maxHp: 600, atk: 45, atkInterval: 1.25, def: 10,
    skill: { name: "饱和齐射", trigger: "enemyCountGte", threshold: 3, refire: 6, action: { kind: "aoe", mult: 2, maxTargets: 4 } } },
  // 壁垒·流派：被动技“护盾力场”——全队减伤光环
  bulwark: { name: "壁垒", maxHp: 1500, atk: 30, atkInterval: 1.43, def: 40,
    skill: { name: "护盾力场", trigger: "passive", auraDmgReduction: 0.15 } },
};

interface DriverDef { name: string; role: string; targeting: Targeting; talent: TalentSpec; }
export const DRIVERS: Record<string, DriverDef> = {
  apai: { name: "阿派", role: "炮手·输出", targeting: "lowestHp", talent: { name: "过热", kind: "overheat", value: 4 } },
  qiqi: { name: "琪琪", role: "突袭·刺客", targeting: "backmost", talent: { name: "斩首", kind: "behead", value: 15 } },
  laojiu: { name: "老九", role: "工程·辅助", targeting: "frontmost", talent: { name: "维护", kind: "maintain", value: 20 } },
};

interface Mods { dmgMult: number; skillDmgMult: number; critChance: number; critMult: number; cdMult: number; shieldPen: number; dmgReduction: number; }
interface PluginDef { name: string; slot: "weapon" | "skill" | "tactic"; apply: (m: Mods) => void; }
export const PLUGINS: Record<string, PluginDef> = {
  amp: { name: "增幅模块", slot: "weapon", apply: (m) => { m.dmgMult += 0.12; } },
  scope: { name: "瞄准镜", slot: "weapon", apply: (m) => { m.critChance += 0.10; m.critMult = 1.5; } },
  cdchip: { name: "冷却芯片", slot: "skill", apply: (m) => { m.cdMult *= 0.85; } },
  coil: { name: "过载线圈", slot: "skill", apply: (m) => { m.skillDmgMult += 0.18; } },
  shieldgen: { name: "护盾发生器", slot: "tactic", apply: (m) => { m.dmgReduction += 0.15; } },
  pierce: { name: "破甲弹头", slot: "tactic", apply: (m) => { m.shieldPen += 0.30; } },
};

export type CoreKey = "smallSun" | "superShield";
export interface Loadout { ship: string; driver?: string; plugins?: string[]; core?: CoreKey; }

// 装配一艘上阵星舰：聚合 星舰 + 驾驶员(能力/天赋) + 插件(修正) + 星核(质变)。
export function deployAlly(id: string, row: number, col: number, lo: Loadout): UnitSpec {
  const ship = SHIPS[lo.ship];
  const m: Mods = { dmgMult: 1, skillDmgMult: 1, critChance: 0, critMult: 1.5, cdMult: 1, shieldPen: 0, dmgReduction: 0 };
  for (const p of lo.plugins ?? []) PLUGINS[p].apply(m);

  let skill: SkillSpec = ship.skill;
  let shield = 0;
  let onBreak: number | undefined;
  if (lo.core === "smallSun") {
    skill = { name: "小太阳", trigger: "cooldown", cd: 8, action: { kind: "aoe", mult: 4, maxTargets: 5 } }; // 质变：技能→大范围
  } else if (lo.core === "superShield") {
    shield = ship.atk * 5;
    onBreak = 2; // 破盾 → 全队护盾 = atk×2
  }
  const drv = lo.driver ? DRIVERS[lo.driver] : undefined;
  return {
    id: `A_${id}`, name: ship.name + (drv ? `·${drv.name}` : ""), side: "ally", row, col,
    maxHp: ship.maxHp, atk: ship.atk, atkInterval: ship.atkInterval, def: ship.def,
    targeting: drv?.targeting ?? "frontmost", skill, talent: drv?.talent,
    shield, onShieldBreakTeamShield: onBreak,
    dmgMult: m.dmgMult, skillDmgMult: m.skillDmgMult, critChance: m.critChance, critMult: m.critMult,
    cdMult: m.cdMult, shieldPen: m.shieldPen, dmgReduction: m.dmgReduction,
  };
}

interface EnemyDef { name: string; maxHp: number; atk: number; atkInterval: number; def: number; shield?: number; }
export const ENEMIES: Record<string, EnemyDef> = {
  raider: { name: "星盗艇", maxHp: 150, atk: 25, atkInterval: 0.9, def: 5 },
  turret: { name: "星盗炮台", maxHp: 90, atk: 35, atkInterval: 1.5, def: 0 },
  guard: { name: "护盾巡卫", maxHp: 250, atk: 30, atkInterval: 1.2, def: 10, shield: 520 }, // 盾厚血薄：破盾前血几乎打不动
};
export function makeEnemy(key: string, id: string, row: number, col: number, node = 1): UnitSpec {
  const e = ENEMIES[key];
  const hpS = Math.pow(1.12, node - 1), atkS = Math.pow(1.1, node - 1);
  return {
    id: `E_${id}`, name: e.name, side: "enemy", row, col,
    maxHp: Math.round(e.maxHp * hpS), atk: Math.round(e.atk * atkS), atkInterval: e.atkInterval, def: e.def,
    shield: e.shield ? Math.round(e.shield * hpS) : 0, targeting: "frontmost",
  };
}
