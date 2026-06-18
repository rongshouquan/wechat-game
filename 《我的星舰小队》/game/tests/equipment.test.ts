import { describe, it, expect } from 'vitest';
import {
  EquipmentDefinition,
  PlayerEquipmentState,
  applyEquipmentBonus,
  createDefaultEquipmentState,
  getEquipmentBonusForHero,
} from '../assets/scripts/core/EquipmentService';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { buildHeroUnit } from '../assets/scripts/combat/BattleEngine';
import { HeroConfig, SkillConfig } from '../assets/scripts/config/ConfigTypes';
import {
  CURRENT_SAVE_VERSION,
  SAVE_STORAGE_KEY,
  loadSave,
} from '../assets/scripts/save/SaveService';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';

const T0 = 1_700_000_000_000;

const DEFS: EquipmentDefinition[] = [
  { id: 'def_weapon', part: 'weapon', name: '激光枪', bonus: { atk: 30 } },
  { id: 'def_armor', part: 'armor', name: '护甲板', bonus: { hp: 200, def: 15 } },
  { id: 'def_engine', part: 'engine', name: '引擎', bonus: { hp: 80, atk: 5 } },
  { id: 'def_chip', part: 'chip', name: '芯片', bonus: { def: 10, atk: 8 } },
];

const HERO: HeroConfig = {
  schemaVersion: '0.1.0',
  heroId: 'hero_test',
  name: '测试',
  rarity: 'R',
  role: 'firepower',
  element: 'fire',
  positionType: 'front',
  baseHp: 1000,
  baseAtk: 100,
  baseDef: 50,
  aspd: 1.0,
  skillIds: [],
  obtain: 'test',
};
const NO_SKILLS: SkillConfig[] = [];

describe('EquipmentService - 默认状态', () => {
  it('新建 PlayerState 默认包含空装备状态', () => {
    const state = createInitialPlayerState();
    expect(state.equipments).toEqual({ owned: {}, equippedByHeroId: {} });
    expect(createDefaultEquipmentState()).toEqual({ owned: {}, equippedByHeroId: {} });
  });
});

describe('SaveService - v1 -> v2 装备迁移', () => {
  it('v1 存档迁移到 v2 后旧数据保留，并补空装备状态', () => {
    const adapter = new MemoryStorageAdapter();
    // 模拟 C17 之前的 v1 存档：playerState 不含 equipments 字段
    const v1Save = {
      saveVersion: 1,
      playerState: {
        resources: { starCoin: 500, expChip: 80, equipmentPart: 10, baseEnergy: 0 },
        heroLevels: { hero_isen: 3 },
        clearedLevelIds: ['1-1', '1-2'],
        claimedRewardFlowIds: ['flow_a'],
      },
      rewardLedger: { entries: [] },
      lastOnlineTime: T0,
    };
    adapter.setString(SAVE_STORAGE_KEY, JSON.stringify(v1Save));

    const result = loadSave(adapter, T0 + 1000);

    expect(result.migrated).toBe(true);
    expect(result.corrupted).toBe(false);
    expect(result.data.saveVersion).toBe(CURRENT_SAVE_VERSION);
    // 旧数据保留
    expect(result.data.playerState.resources.starCoin).toBe(500);
    expect(result.data.playerState.heroLevels).toEqual({ hero_isen: 3 });
    expect(result.data.playerState.clearedLevelIds).toEqual(['1-1', '1-2']);
    expect(result.data.playerState.claimedRewardFlowIds).toEqual(['flow_a']);
    // 补空装备状态，且与新建档形状一致
    expect(result.data.playerState.equipments).toEqual(createDefaultEquipmentState());
  });
});

describe('EquipmentService - 属性加成', () => {
  it('空槽时最终属性等于基础属性', () => {
    const state = createDefaultEquipmentState();
    const bonus = getEquipmentBonusForHero(state, 'hero_test', DEFS);
    expect(bonus).toEqual({ hp: 0, atk: 0, def: 0 });

    const base = { hp: 1000, atk: 100, def: 50 };
    expect(applyEquipmentBonus(base, bonus)).toEqual(base);
  });

  it('四槽满装备时 hp/atk/def 正确累加', () => {
    const state: PlayerEquipmentState = {
      owned: {
        w1: { id: 'w1', definitionId: 'def_weapon' },
        a1: { id: 'a1', definitionId: 'def_armor' },
        e1: { id: 'e1', definitionId: 'def_engine' },
        c1: { id: 'c1', definitionId: 'def_chip' },
      },
      equippedByHeroId: {
        hero_test: { weapon: 'w1', armor: 'a1', engine: 'e1', chip: 'c1' },
      },
    };
    const bonus = getEquipmentBonusForHero(state, 'hero_test', DEFS);
    // hp: 200+80 = 280; atk: 30+5+8 = 43; def: 15+10 = 25
    expect(bonus).toEqual({ hp: 280, atk: 43, def: 25 });

    const final = applyEquipmentBonus({ hp: 1000, atk: 100, def: 50 }, bonus);
    expect(final).toEqual({ hp: 1280, atk: 143, def: 75 });
  });

  it('缺 owned、缺 definition、部位不匹配、重复槽位引用不崩且不重复生效', () => {
    const state: PlayerEquipmentState = {
      owned: {
        // 部位不匹配：weapon 定义放进 armor 槽
        wrong: { id: 'wrong', definitionId: 'def_weapon' },
        // 缺 definition：引用不存在的定义
        ghostDef: { id: 'ghostDef', definitionId: 'def_missing' },
        // 正常武器，被两个槽位重复引用
        w1: { id: 'w1', definitionId: 'def_weapon' },
      },
      equippedByHeroId: {
        hero_test: {
          weapon: 'w1',
          armor: 'wrong', // 部位不匹配 -> 忽略
          engine: 'ghostMissing', // 缺 owned -> 忽略
          chip: 'ghostDef', // 缺 definition -> 忽略
        },
      },
    };
    const bonus = getEquipmentBonusForHero(state, 'hero_test', DEFS);
    // 只有 weapon 槽的 w1 生效：atk +30
    expect(bonus).toEqual({ hp: 0, atk: 30, def: 0 });

    // 重复引用同一件：两个槽都指向 w1，只生效一次
    const dupState: PlayerEquipmentState = {
      owned: { w1: { id: 'w1', definitionId: 'def_weapon' } },
      equippedByHeroId: { hero_test: { weapon: 'w1', armor: 'w1', engine: 'w1', chip: 'w1' } },
    };
    expect(getEquipmentBonusForHero(dupState, 'hero_test', DEFS)).toEqual({ hp: 0, atk: 30, def: 0 });

    // 未知英雄无穿戴槽，返回零加成，不抛异常
    expect(getEquipmentBonusForHero(state, 'hero_unknown', DEFS)).toEqual({ hp: 0, atk: 0, def: 0 });
  });
});

describe('BattleEngine - finalStats 入口', () => {
  it('传 finalStats 时使用最终属性；不传时旧行为不变', () => {
    const baseUnit = buildHeroUnit(HERO, NO_SKILLS, '#1');
    expect(baseUnit.maxHp).toBe(1000);
    expect(baseUnit.hp).toBe(1000);
    expect(baseUnit.baseAtk).toBe(100);
    expect(baseUnit.baseDef).toBe(50);

    const finalUnit = buildHeroUnit(HERO, NO_SKILLS, '#1', { hp: 1280, atk: 143, def: 75 });
    expect(finalUnit.maxHp).toBe(1280);
    expect(finalUnit.hp).toBe(1280);
    expect(finalUnit.baseAtk).toBe(143);
    expect(finalUnit.baseDef).toBe(75);
    // aspd 等其余字段不受影响
    expect(finalUnit.aspd).toBe(HERO.aspd);
  });
});
