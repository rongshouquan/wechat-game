// 养成 / 经济 / 战力（纯 TS，可单测）。数值取自 第二块/轻量B2-v0.1，均为 v0.1 起步值。
import type { UnitSpec } from "./engine.ts";

// 战力显示（B1 §1 思路的简化代理：基于战斗属性 + 修正；过载核心因 dmgMult×2 → 战力≈翻倍，战斗伤害严格×2）
export function powerOf(s: UnitSpec): number {
  let p = s.atk * (s.dmgMult ?? 1) * 12 + s.maxHp * 0.3;
  if (s.primary?.aoeMult) p += s.atk * s.primary.aoeMult * 4; // 原子炮(过载核心)大范围爆发计入战力
  if (s.onShieldBreakTeamShield) p += 150;
  return Math.round(p);
}
export function teamPower(specs: UnitSpec[]): number {
  return specs.filter((s) => s.side === "ally").reduce((a, s) => a + powerOf(s), 0);
}

// 星舰升级成本（合金）：50 × 等级^1.3
export function shipLevelCost(level: number): number {
  return Math.round(50 * Math.pow(level, 1.3));
}

// 关卡掉落（合金）：随节点上升，Boss 更多
export function nodeReward(node: number, isBoss: boolean): number {
  return Math.round((isBoss ? 120 : 35) * Math.pow(1.12, node - 1));
}

// 领一次离线产出（合金）——简化：固定一笔（真实版随最高星域提升、有 1.5 天上限）
export function offlineChunk(): number {
  return 400;
}
