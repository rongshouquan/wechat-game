// 段二 A4＋R1 返工：升级大节点表（五档平移版）单测——账本结构+解锁查询+定价守恒审计+平移接线实证。
// R1 重定基（旧→新→为什么对）：旧测试验"两旧门+三新惊喜件"方案（结构理解偏差）；Ron 裁定=五档平移
// 内容零改动——账本五档全 skill_gate、定价门挪 L10/L20、惊喜件转未挂载留档。
import { describe, it, expect } from 'vitest';
import {
  S7_GROWTH_NODES, S7_GROWTH_NODE_LEVELS, S7_UNMOUNTED_DELIGHT_ARCHIVE,
  growthNodesUnlocked, nextGrowthNode, isGrowthNodeLevel,
} from '../assets/scripts/core/s7/S7GrowthNodes';
import { S7_UNIT_MAX_LEVEL } from '../assets/scripts/core/s7/S7UnitLevelState';
import { S7_LEVEL_GATE_POWER, S7_SHIP_LEVEL_POWER_FACTOR } from '../assets/scripts/core/s7/S7PowerRating';
import { shipBlocks } from '../assets/scripts/core/s7/S7ShipEffects';
import { pilotBlocks } from '../assets/scripts/core/s7/S7PilotEffects';

describe('段二 R1 · 大节点账本（五档平移 L10-50）', () => {
  it('五节点每 10 级一个、全部=逐单位强化档（skill_gate）、末节点=等级天花板', () => {
    expect(S7_GROWTH_NODE_LEVELS).toEqual([10, 20, 30, 40, 50]);
    expect(S7_GROWTH_NODE_LEVELS[S7_GROWTH_NODE_LEVELS.length - 1]).toBe(S7_UNIT_MAX_LEVEL);
    expect(S7_GROWTH_NODES.every((n) => n.kind === 'skill_gate')).toBe(true);
  });

  it('定价守恒审计：LF 门=L10/L20（系数原值）·L30/40/50=空门；账本 combatPower 与 LF 门互锁；毕业锚 L50 不动', () => {
    // 为什么对：R1"星舰技能门 L20/L40→L10/L20（系数原值）；新 30/40/50 维持空门（忠实对应旧设计）"；
    // L40-50 段两门乘积与旧表相同 → L50 纸面=3.2935 分毫不动（毕业态锚定的机器证据）。
    expect(S7_LEVEL_GATE_POWER).toEqual({ 10: 1.1, 20: 1.166 });
    const gateLevels = Object.keys(S7_LEVEL_GATE_POWER).map(Number).sort((a, b) => a - b);
    const powerNodes = S7_GROWTH_NODES.filter((n) => n.combatPower).map((n) => n.level);
    expect(gateLevels).toEqual(powerNodes);
    expect(S7_SHIP_LEVEL_POWER_FACTOR[49]).toBeCloseTo(3.2935, 4); // L50 毕业锚
    expect(S7_SHIP_LEVEL_POWER_FACTOR[9]).toBeCloseTo(1.6333 * 1.1, 3); // L10 门生效
    expect(S7_SHIP_LEVEL_POWER_FACTOR[19]).toBeCloseTo(1.9833 * 1.1 * 1.166, 2); // L20 双门
  });

  it('平移接线实证：舰/员运行时在新档位取到旧档内容（内容零改动·抽验三处）', () => {
    // 极焰（shp01）：旧 L20 集火炮档 → 新 L10 取到；旧 L100 档 → 新 L50 取到（效果 id=历史名不改）。
    const s10 = shipBlocks('shp01', 10, 0).map((b) => (b as { effectRef?: string }).effectRef);
    expect(s10).toContain('eff_s7_jihuopao_l20');
    const s50 = shipBlocks('shp01', 50, 0).map((b) => (b as { effectRef?: string }).effectRef);
    expect(s50).toContain('eff_s7_jihuopao_l100');
    const s9 = shipBlocks('shp01', 9, 0).map((b) => (b as { effectRef?: string }).effectRef);
    expect(s9).not.toContain('eff_s7_jihuopao_l20'); // L9 未到门
    // 燎（pil03）：旧 L100 连斩档 eff_pil_cdr_40 → 新 L50 取到。
    const p50 = pilotBlocks('pil03', 50, 1).map((b) => (b as { effectRef?: string }).effectRef);
    expect(p50).toContain('eff_pil_cdr_40');
    const p40 = pilotBlocks('pil03', 40, 1).map((b) => (b as { effectRef?: string }).effectRef);
    expect(p40).toContain('eff_pil_cdr_35'); // 旧 L80 档 → 新 L40
    expect(p40).not.toContain('eff_pil_cdr_40');
  });

  it('三惊喜件=未挂载留档（不进账本·候 Ron 将来处置）', () => {
    expect(S7_UNMOUNTED_DELIGHT_ARCHIVE.map((d) => d.kind)).toEqual(['signature_fire', 'unit_story', 'ace_crest']);
    // 账本里不得出现惊喜件类型（未挂载=账本零引用）。
    expect(S7_GROWTH_NODES.every((n) => (n.kind as string) === 'skill_gate')).toBe(true);
  });

  it('解锁查询：growthNodesUnlocked / nextGrowthNode / isGrowthNodeLevel', () => {
    expect(growthNodesUnlocked(1)).toEqual([]);
    expect(growthNodesUnlocked(10).map((n) => n.level)).toEqual([10]);
    expect(growthNodesUnlocked(35).map((n) => n.level)).toEqual([10, 20, 30]);
    expect(growthNodesUnlocked(50)).toHaveLength(5);
    expect(nextGrowthNode(1)!.level).toBe(10);
    expect(nextGrowthNode(50)).toBeNull();
    expect(isGrowthNodeLevel(30)).toBe(true);
    expect(isGrowthNodeLevel(31)).toBe(false);
    expect(growthNodesUnlocked(Number.NaN)).toEqual([]);
  });
});
