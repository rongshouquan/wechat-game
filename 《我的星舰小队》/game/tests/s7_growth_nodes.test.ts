// 段二 A4：升级大节点表（每 10 级·5 个全落 L10-50）单测——账本结构+解锁查询+强度预算守恒审计。
import { describe, it, expect } from 'vitest';
import {
  S7_GROWTH_NODES, S7_GROWTH_NODE_LEVELS, growthNodesUnlocked, nextGrowthNode, isGrowthNodeLevel,
} from '../assets/scripts/core/s7/S7GrowthNodes';
import { S7_UNIT_MAX_LEVEL } from '../assets/scripts/core/s7/S7UnitLevelState';
import { S7_LEVEL_GATE_POWER } from '../assets/scripts/core/s7/S7PowerRating';

describe('段二 A4 · 大节点账本（L10-50 每 10 级五节点）', () => {
  it('五节点全落 L10-50、每 10 级一个、末节点=等级天花板', () => {
    // 为什么对：A4 原文"5 个全落 L10-50"；A3 上限 50——最后一个大节点必须与天花板重合
    // （毕业仪式感落在满级·王牌徽记）。
    expect(S7_GROWTH_NODE_LEVELS).toEqual([10, 20, 30, 40, 50]);
    expect(S7_GROWTH_NODE_LEVELS[S7_GROWTH_NODE_LEVELS.length - 1]).toBe(S7_UNIT_MAX_LEVEL);
  });

  it('节点类型：L20/L40=旧技能门（携带强度）；L10/30/50=新节点（零强度·A4 预算守恒）', () => {
    // 为什么对：强度总预算守恒（毕业态锚定）——毕业态在旧世界只吃 L20/L40 两个强度门，
    // 三个新节点惊喜靠机制/演出型内容不靠堆数字（Ron A4 原文）。
    const byLevel = new Map(S7_GROWTH_NODES.map((n) => [n.level, n]));
    expect(byLevel.get(20)!.kind).toBe('skill_gate');
    expect(byLevel.get(40)!.kind).toBe('skill_gate');
    expect(byLevel.get(20)!.combatPower).toBe(true);
    expect(byLevel.get(40)!.combatPower).toBe(true);
    for (const lv of [10, 30, 50]) {
      expect(byLevel.get(lv)!.combatPower).toBe(false);
      expect(byLevel.get(lv)!.kind).not.toBe('skill_gate');
    }
    // 三新节点类型各异（演出/内容/身份三种惊喜，不重样）。
    expect(new Set([10, 30, 50].map((lv) => byLevel.get(lv)!.kind)).size).toBe(3);
  });

  it('强度预算守恒的机器审计：LF 刻度门 == 账本里 combatPower 节点（两账互锁）', () => {
    // 为什么对：LF 刻度表只给"携带强度"的节点加价（L20 ×1.100/L40 ×1.166）；若有人给
    // L10/30/50 塞数字强度而不改账本（或反之），此测红=守恒破坏被抓。
    const gateLevels = Object.keys(S7_LEVEL_GATE_POWER).map(Number).sort((a, b) => a - b);
    const powerNodes = S7_GROWTH_NODES.filter((n) => n.combatPower).map((n) => n.level);
    expect(gateLevels).toEqual(powerNodes);
  });

  it('解锁查询：growthNodesUnlocked / nextGrowthNode / isGrowthNodeLevel', () => {
    expect(growthNodesUnlocked(1)).toEqual([]);
    expect(growthNodesUnlocked(10).map((n) => n.level)).toEqual([10]);
    expect(growthNodesUnlocked(35).map((n) => n.level)).toEqual([10, 20, 30]);
    expect(growthNodesUnlocked(50)).toHaveLength(5);
    expect(nextGrowthNode(1)!.level).toBe(10);
    expect(nextGrowthNode(10)!.level).toBe(20);
    expect(nextGrowthNode(49)!.level).toBe(50);
    expect(nextGrowthNode(50)).toBeNull(); // 满级无下一节点
    expect(isGrowthNodeLevel(30)).toBe(true);
    expect(isGrowthNodeLevel(31)).toBe(false);
    // 脏参回退（与全库 normalize 语义一致）。
    expect(growthNodesUnlocked(Number.NaN)).toEqual([]);
    expect(nextGrowthNode(Number.NaN)!.level).toBe(10);
  });
});
