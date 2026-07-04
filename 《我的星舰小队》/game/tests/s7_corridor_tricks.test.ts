// 深空回廊·戏法层规则库测试（第2.5块·块3，GDD S10.7）：
// 10 种戏法各自翻成正确的积木/敌阵指令/我方规则；中性清单归位；"换作用方"不串（敌方戏法不碰我方，反之亦然）。
import { describe, it, expect } from 'vitest';
import {
  S7_CORRIDOR_TRICKS,
  S7CorridorTrickId,
  corridorTrickDef,
  corridorTrickEffect,
  neutralCorridorEffect,
  IRON_TIDE_ARMOR_PCT,
  SWARM_COUNT_MULT,
  SWARM_WEAKEN_PCT,
  ATTRITION_EXTRA_HEALERS,
  BLITZ_TIME_LIMIT_SEC,
  ELITE_LINEUP_CAP,
  LONE_LINEUP_CAP,
  TURBULENCE_SKILL_HASTE,
  SHIELD_MATRIX_EFFECT_REF,
} from '../assets/scripts/core/s7/S7CorridorTricks';
import { S7_MAX_PLAYER_UNITS } from '../assets/scripts/core/s7/S7BattleGrid';

const ALL_IDS: S7CorridorTrickId[] = [
  'backline_fire', 'elite_squad', 'blitz', 'iron_tide', 'swarm',
  'silent_zone', 'attrition', 'shield_matrix', 'turbulence', 'lone_hero',
];

describe('S7CorridorTricks - 戏法库结构', () => {
  it('恰好 10 种戏法·id 唯一·顺序=GDD 内联表·仅孤胆为深层专属', () => {
    expect(S7_CORRIDOR_TRICKS).toHaveLength(10);
    const ids = S7_CORRIDOR_TRICKS.map((t) => t.id);
    expect(ids).toEqual(ALL_IDS);
    expect(new Set(ids).size).toBe(10);
    const deep = S7_CORRIDOR_TRICKS.filter((t) => t.deepOnly).map((t) => t.id);
    expect(deep).toEqual(['lone_hero']);
  });

  it('每种戏法都有中文名/规则文案/解法提示（塔页+备战页明示要用）', () => {
    for (const t of S7_CORRIDOR_TRICKS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.ruleText.length).toBeGreaterThan(0);
      expect(t.solveHint.length).toBeGreaterThan(0);
    }
  });

  it('corridorTrickDef 命中/未命中', () => {
    expect(corridorTrickDef('iron_tide')?.name).toBe('铁甲潮');
    expect(corridorTrickDef('不存在')).toBeNull();
  });
});

describe('S7CorridorTricks - 中性清单（普通/Boss层）', () => {
  it('所有杠杆归位：无积木/默认摆位/不翻倍/无奶妈/满编/不限时/不禁核', () => {
    const n = neutralCorridorEffect();
    expect(n.enemyBlocks).toEqual([]);
    expect(n.playerBlocks).toEqual([]);
    expect(n.enemyPlacement).toBe('default');
    expect(n.enemyCountMult).toBe(1);
    expect(n.extraHealers).toBe(0);
    expect(n.lineupCap).toBe(S7_MAX_PLAYER_UNITS);
    expect(n.timeLimitSec).toBe(0);
    expect(n.disablePlayerCores).toBe(false);
  });
});

describe('S7CorridorTricks - 敌方修正类（同款积木·作用方=敌）', () => {
  it('铁甲潮：敌全体护甲 +pct（modifier·不碰我方/不改上阵）', () => {
    const e = corridorTrickEffect('iron_tide');
    expect(e.enemyBlocks).toEqual([
      { kind: 'modifier', stat: 'armor', op: 'pct', value: IRON_TIDE_ARMOR_PCT, source: 'corridor_trick:iron_tide' },
    ]);
    expect(e.playerBlocks).toEqual([]);
    expect(e.lineupCap).toBe(S7_MAX_PLAYER_UNITS);
    expect(e.timeLimitSec).toBe(0);
  });

  it('蜂群：敌数量翻倍 + 单体血/攻各 -pct（两条 modifier）', () => {
    const e = corridorTrickEffect('swarm');
    expect(e.enemyCountMult).toBe(SWARM_COUNT_MULT);
    expect(SWARM_COUNT_MULT).toBe(2);
    expect(e.enemyBlocks).toEqual([
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: SWARM_WEAKEN_PCT, source: 'corridor_trick:swarm' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: SWARM_WEAKEN_PCT, source: 'corridor_trick:swarm' },
    ]);
    expect(SWARM_WEAKEN_PCT).toBeLessThan(0); // 削弱=负 pct
  });

  it('护盾矩阵：敌开局带盾（battle_start 触发·引用现成 eff_state_shield）', () => {
    const e = corridorTrickEffect('shield_matrix');
    expect(e.enemyBlocks).toEqual([
      { kind: 'trigger', on: 'battle_start', effectRef: SHIELD_MATRIX_EFFECT_REF, source: 'corridor_trick:shield_matrix' },
    ]);
    expect(SHIELD_MATRIX_EFFECT_REF).toBe('eff_state_shield');
    expect(e.playerBlocks).toEqual([]);
  });
});

describe('S7CorridorTricks - 我方修正类（乱流·作用方=我）', () => {
  it('乱流：我方技能 CD +50%（affix skillHaste 取负·不碰敌方）', () => {
    const e = corridorTrickEffect('turbulence');
    expect(e.playerBlocks).toEqual([
      { kind: 'affix', affix: 'skillHaste', value: TURBULENCE_SKILL_HASTE, source: 'corridor_trick:turbulence' },
    ]);
    expect(e.enemyBlocks).toEqual([]); // 反例守卫：乱流绝不改敌方
    // 语义核实：引擎 CD/(1+skillHaste)，故 skillHaste 取负让 CD ×1.5（+50%）。
    expect(1 / (1 + TURBULENCE_SKILL_HASTE)).toBeCloseTo(1.5, 5);
    expect(TURBULENCE_SKILL_HASTE).toBeLessThan(0);
  });
});

describe('S7CorridorTricks - 敌阵形状 / 战斗规则类', () => {
  it('后排火力：敌阵摆后排（不改数值/不碰我方）', () => {
    const e = corridorTrickEffect('backline_fire');
    expect(e.enemyPlacement).toBe('back');
    expect(e.enemyBlocks).toEqual([]);
    expect(e.playerBlocks).toEqual([]);
  });

  it('持久战：追加治疗敌人（不改数值/不改摆位）', () => {
    const e = corridorTrickEffect('attrition');
    expect(e.extraHealers).toBe(ATTRITION_EXTRA_HEALERS);
    expect(ATTRITION_EXTRA_HEALERS).toBeGreaterThan(0);
    expect(e.enemyPlacement).toBe('default');
    expect(e.enemyBlocks).toEqual([]);
  });

  it('精锐小队：上阵上限 3（不碰敌方）', () => {
    const e = corridorTrickEffect('elite_squad');
    expect(e.lineupCap).toBe(ELITE_LINEUP_CAP);
    expect(ELITE_LINEUP_CAP).toBe(3);
    expect(e.enemyBlocks).toEqual([]);
  });

  it('孤胆英雄：上阵上限 1', () => {
    const e = corridorTrickEffect('lone_hero');
    expect(e.lineupCap).toBe(LONE_LINEUP_CAP);
    expect(LONE_LINEUP_CAP).toBe(1);
  });

  it('闪电战：限时覆盖 40s（不碰敌方/我方积木）', () => {
    const e = corridorTrickEffect('blitz');
    expect(e.timeLimitSec).toBe(BLITZ_TIME_LIMIT_SEC);
    expect(BLITZ_TIME_LIMIT_SEC).toBe(40);
    expect(e.enemyBlocks).toEqual([]);
    expect(e.playerBlocks).toEqual([]);
  });

  it('静默空域：我方禁核（不碰敌方/不改上阵）', () => {
    const e = corridorTrickEffect('silent_zone');
    expect(e.disablePlayerCores).toBe(true);
    expect(e.enemyBlocks).toEqual([]);
    expect(e.lineupCap).toBe(S7_MAX_PLAYER_UNITS);
  });
});

describe('S7CorridorTricks - 全戏法确定性 + 覆盖', () => {
  it('每种戏法重复翻译结果完全一致（确定性·无随机）', () => {
    for (const id of ALL_IDS) {
      expect(corridorTrickEffect(id)).toEqual(corridorTrickEffect(id));
    }
  });

  it('每种戏法至少改动一个杠杆（不存在"空戏法"）', () => {
    const neutral = neutralCorridorEffect();
    for (const id of ALL_IDS) {
      const e = corridorTrickEffect(id);
      const changed =
        e.enemyBlocks.length > 0 || e.playerBlocks.length > 0 ||
        e.enemyPlacement !== neutral.enemyPlacement || e.enemyCountMult !== neutral.enemyCountMult ||
        e.extraHealers !== neutral.extraHealers || e.lineupCap !== neutral.lineupCap ||
        e.timeLimitSec !== neutral.timeLimitSec || e.disablePlayerCores !== neutral.disablePlayerCores;
      expect(changed, `戏法 ${id} 应改动至少一个杠杆`).toBe(true);
    }
  });
});
