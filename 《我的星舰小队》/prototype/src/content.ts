// 最小集内容配置（数值取自 第二块/轻量B2-v0.1）。C1a-1 只用基础属性，技能/天赋/星核留 C1a-2。
import type { UnitConfig } from "./engine.ts";

type BaseStats = Omit<UnitConfig, "id" | "side" | "row" | "col">;

// 我方星舰 @ Lv1 / 阶级 C
export const SHIPS: Record<string, BaseStats> = {
  freedom: { name: "自由号", maxHp: 800, atk: 60, atkInterval: 1.0, def: 20 }, // 火炮·自由型
  swarm: { name: "蜂群", maxHp: 600, atk: 45, atkInterval: 1.25, def: 10 }, // 导弹·流派（AoE 留 C1a-2）
  bulwark: { name: "壁垒", maxHp: 1500, atk: 30, atkInterval: 1.43, def: 40 }, // 壁垒·流派（坦克）
};

// 敌人基础值（节点放大见 scaleEnemy）
export const ENEMIES: Record<string, BaseStats> = {
  raider: { name: "星盗艇", maxHp: 150, atk: 25, atkInterval: 0.9, def: 5 }, // 前排小怪
  turret: { name: "星盗炮台", maxHp: 90, atk: 35, atkInterval: 1.5, def: 0 }, // 后排远程（靠被晚打存活输出）
};

export function ally(shipKey: string, idSuffix: string, row: number, col: number): UnitConfig {
  const s = SHIPS[shipKey];
  return { ...s, id: `A_${idSuffix}`, side: "ally", row, col };
}

// 节点放大：第 n 关 小怪 HP ×1.12^(n-1)、攻击 ×1.10^(n-1)（轻量B2）
export function enemy(enemyKey: string, idSuffix: string, row: number, col: number, node = 1): UnitConfig {
  const e = ENEMIES[enemyKey];
  const hpScale = Math.pow(1.12, node - 1);
  const atkScale = Math.pow(1.1, node - 1);
  return {
    ...e,
    id: `E_${idSuffix}`,
    side: "enemy",
    row,
    col,
    maxHp: Math.round(e.maxHp * hpScale),
    atk: Math.round(e.atk * atkScale),
  };
}
