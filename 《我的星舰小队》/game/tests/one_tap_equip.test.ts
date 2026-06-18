import { describe, it, expect } from 'vitest';
import { EquipmentDefinition } from '../assets/scripts/core/EquipmentService';
import { oneTapEquip, scoreEquipment } from '../assets/scripts/core/OneTapEquipService';
import { createInitialPlayerState } from '../assets/scripts/core/PlayerState';
import { getEquipmentBonusForHero } from '../assets/scripts/core/EquipmentService';
import { MemoryStorageAdapter } from '../assets/scripts/save/SaveStorageAdapter';
import {
  buildSaveDataFromState,
  loadSave,
  persistSave,
} from '../assets/scripts/save/SaveService';
import { createRewardLedger } from '../assets/scripts/core/RewardLedger';

const T0 = 1_700_000_000_000;

const DEFS: EquipmentDefinition[] = [
  // weapon：高分 vs 低分
  { id: 'wpn_hi', part: 'weapon', name: '高级武器', bonus: { atk: 50 } }, // score 500
  { id: 'wpn_lo', part: 'weapon', name: '初级武器', bonus: { atk: 10 } }, // score 100
  // armor
  { id: 'arm_hi', part: 'armor', name: '重甲', bonus: { hp: 300, def: 20 } }, // 300+160=460
  { id: 'arm_lo', part: 'armor', name: '轻甲', bonus: { hp: 100, def: 5 } }, // 100+40=140
  // engine
  { id: 'eng_a', part: 'engine', name: '引擎', bonus: { hp: 120 } }, // 120
  // chip
  { id: 'chp_a', part: 'chip', name: '芯片', bonus: { def: 12 } }, // 96
];

function makeOwned(map: Record<string, string>) {
  // map: ownedId -> definitionId
  const owned: Record<string, { id: string; definitionId: string }> = {};
  for (const [id, definitionId] of Object.entries(map)) {
    owned[id] = { id, definitionId };
  }
  return owned;
}

describe('OneTapEquipService - 评分', () => {
  it('score = hp + atk*10 + def*8', () => {
    expect(scoreEquipment({ id: 'x', part: 'weapon', name: 'x', bonus: { hp: 1, atk: 2, def: 3 } })).toBe(
      1 + 2 * 10 + 3 * 8,
    );
    expect(scoreEquipment({ id: 'y', part: 'armor', name: 'y', bonus: {} })).toBe(0);
  });
});

describe('OneTapEquipService - 一键穿装', () => {
  it('无装备时不崩，槽位保持空', () => {
    const state = createInitialPlayerState();
    const result = oneTapEquip(state, ['hero_isen'], DEFS);
    expect(result.changed).toBe(false);
    expect(state.equipments.equippedByHeroId['hero_isen']).toEqual({});
  });

  it('部分装备只填可用部位', () => {
    const state = createInitialPlayerState();
    state.equipments.owned = makeOwned({ o_wpn: 'wpn_hi', o_eng: 'eng_a' });
    const result = oneTapEquip(state, ['hero_isen'], DEFS);
    expect(result.changed).toBe(true);
    const slots = state.equipments.equippedByHeroId['hero_isen'];
    expect(slots).toEqual({ weapon: 'o_wpn', engine: 'o_eng' });
    expect(slots.armor).toBeUndefined();
    expect(slots.chip).toBeUndefined();
  });

  it('满装备时各部位选择最高分', () => {
    const state = createInitialPlayerState();
    state.equipments.owned = makeOwned({
      a: 'wpn_hi',
      b: 'wpn_lo',
      c: 'arm_hi',
      d: 'arm_lo',
      e: 'eng_a',
      f: 'chp_a',
    });
    oneTapEquip(state, ['hero_isen'], DEFS);
    expect(state.equipments.equippedByHeroId['hero_isen']).toEqual({
      weapon: 'a', // wpn_hi
      armor: 'c', // arm_hi
      engine: 'e',
      chip: 'f',
    });
  });

  it('同一装备不会被多个英雄重复占用', () => {
    const state = createInitialPlayerState();
    // 只有一件高分武器和一件低分武器
    state.equipments.owned = makeOwned({ a: 'wpn_hi', b: 'wpn_lo' });
    oneTapEquip(state, ['hero_isen', 'hero_mia'], DEFS);
    const s1 = state.equipments.equippedByHeroId['hero_isen'];
    const s2 = state.equipments.equippedByHeroId['hero_mia'];
    // 第一个英雄拿高分，第二个拿次高，互不重复
    expect(s1.weapon).toBe('a');
    expect(s2.weapon).toBe('b');
    expect(s1.weapon).not.toBe(s2.weapon);

    // 第三个英雄无可用武器，保持空
    state.equipments.owned = makeOwned({ a: 'wpn_hi' });
    oneTapEquip(state, ['hero_isen', 'hero_mia'], DEFS);
    expect(state.equipments.equippedByHeroId['hero_isen'].weapon).toBe('a');
    expect(state.equipments.equippedByHeroId['hero_mia'].weapon).toBeUndefined();
  });

  it('低分已穿装备可被高分替换，被替换装备回到可用池', () => {
    const state = createInitialPlayerState();
    state.equipments.owned = makeOwned({ lo: 'wpn_lo', hi: 'wpn_hi' });
    // 预置：英雄已穿低分武器
    state.equipments.equippedByHeroId['hero_isen'] = { weapon: 'lo' };

    const result = oneTapEquip(state, ['hero_isen'], DEFS);
    expect(result.changed).toBe(true);
    // 升级到高分
    expect(state.equipments.equippedByHeroId['hero_isen'].weapon).toBe('hi');

    // 两个英雄场景：被替换的低分件回池，给第二个英雄
    const state2 = createInitialPlayerState();
    state2.equipments.owned = makeOwned({ lo: 'wpn_lo', hi: 'wpn_hi' });
    state2.equipments.equippedByHeroId['hero_isen'] = { weapon: 'lo' };
    oneTapEquip(state2, ['hero_isen', 'hero_mia'], DEFS);
    expect(state2.equipments.equippedByHeroId['hero_isen'].weapon).toBe('hi');
    expect(state2.equipments.equippedByHeroId['hero_mia'].weapon).toBe('lo');
  });

  it('缺 definition / 部位不匹配 / 非上阵英雄占用 的装备被忽略', () => {
    const state = createInitialPlayerState();
    state.equipments.owned = makeOwned({
      good: 'wpn_hi',
      ghost: 'def_missing', // 缺 definition
    });
    // 非上阵英雄占用一件 armor，不应被上阵英雄抢走
    state.equipments.owned['reservedArm'] = { id: 'reservedArm', definitionId: 'arm_hi' };
    state.equipments.equippedByHeroId['hero_offfield'] = { armor: 'reservedArm' };

    oneTapEquip(state, ['hero_isen'], DEFS);
    const slots = state.equipments.equippedByHeroId['hero_isen'];
    expect(slots.weapon).toBe('good');
    // ghost 缺定义被忽略；armor 被非上阵英雄占用，不分配
    expect(slots.armor).toBeUndefined();
    // 非上阵英雄装备保持不变
    expect(state.equipments.equippedByHeroId['hero_offfield'].armor).toBe('reservedArm');
  });

  it('结果写入 PlayerState 后可被 SaveService 持久化并还原', () => {
    const adapter = new MemoryStorageAdapter();
    const state = createInitialPlayerState();
    state.equipments.owned = makeOwned({ a: 'wpn_hi', c: 'arm_hi' });
    oneTapEquip(state, ['hero_isen'], DEFS);

    const ledger = createRewardLedger();
    persistSave(adapter, buildSaveDataFromState(state, ledger, T0), T0);

    const reloaded = loadSave(adapter, T0 + 1000);
    const slots = reloaded.data.playerState.equipments.equippedByHeroId['hero_isen'];
    expect(slots).toEqual({ weapon: 'a', armor: 'c' });

    // 还原后加成计算可用
    const bonus = getEquipmentBonusForHero(
      reloaded.data.playerState.equipments,
      'hero_isen',
      DEFS,
    );
    expect(bonus).toEqual({ hp: 300, atk: 50, def: 20 });
  });
});
