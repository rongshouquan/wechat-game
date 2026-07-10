// 阶段一 H-step1：宝箱开箱引擎单测（v1.0 §10.6 星辉货舱）——
//   选项解析(资源量在区间/确定性) · 信标包(个数在区间/只出配置档/按档合并) · 开箱列表(3选项·顺序) · 可选数 · 未知宝箱。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_CHEST_REWARD_CONFIG as CFG, S7ChestRewardConfig } from '../assets/scripts/core/s7/S7ChestRewardConfig';
import { resolveChestOption, rollChestOptions, chestPickLimits } from '../assets/scripts/core/s7/S7ChestRewardService';

describe('S7 开箱 · 选项解析', () => {
  it('resourceRange：量落在 [min,max] 闭区间', () => {
    const tpl = { kind: 'resourceRange' as const, resourceId: 'coreFrag', min: 8, max: 16 };
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const r = resolveChestOption(tpl, new S7AutoBattleRng(seed));
      expect(r.kind).toBe('resource');
      if (r.kind === 'resource') {
        expect(r.resourceId).toBe('coreFrag');
        expect(r.amount).toBeGreaterThanOrEqual(8);
        expect(r.amount).toBeLessThanOrEqual(16);
      }
    }
  });

  it('resourceRange：max<=min 时取 min', () => {
    const r = resolveChestOption({ kind: 'resourceRange', resourceId: 'starGem', min: 5, max: 5 }, new S7AutoBattleRng('x'));
    expect(r).toEqual({ kind: 'resource', resourceId: 'starGem', amount: 5 });
  });

  it('beaconBundle：总个数落在 [minCount,maxCount]，只出配置档，按档合并', () => {
    const tpl = {
      kind: 'beaconBundle' as const, minCount: 3, maxCount: 5,
      tierWeights: [
        { resourceId: 'beaconCommon', weight: 50 },
        { resourceId: 'beaconRare', weight: 35 },
        { resourceId: 'beaconEpic', weight: 15 },
      ],
    };
    const allowed = new Set(['beaconCommon', 'beaconRare', 'beaconEpic']);
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
      const r = resolveChestOption(tpl, new S7AutoBattleRng(seed));
      expect(r.kind).toBe('beaconBundle');
      if (r.kind === 'beaconBundle') {
        const total = r.items.reduce((s, x) => s + x.amount, 0);
        expect(total).toBeGreaterThanOrEqual(3);
        expect(total).toBeLessThanOrEqual(5);
        // 只出配置内的档，且按档合并（无重复 resourceId）。
        const ids = r.items.map((x) => x.resourceId);
        expect(ids.every((id) => allowed.has(id))).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
        expect(r.items.every((x) => x.amount > 0)).toBe(true);
      }
    }
  });

  it('确定性：同 seed 同结果', () => {
    const tpl = { kind: 'beaconBundle' as const, minCount: 3, maxCount: 5, tierWeights: [{ resourceId: 'beaconCommon', weight: 1 }, { resourceId: 'beaconRare', weight: 1 }] };
    const a = resolveChestOption(tpl, new S7AutoBattleRng('same'));
    const b = resolveChestOption(tpl, new S7AutoBattleRng('same'));
    expect(a).toEqual(b);
  });
});

describe('S7 开箱 · 星辉货舱开箱', () => {
  it('rollChestOptions 返回 3 个选项（星核碎片/星空宝石/信标包·顺序同 config）', () => {
    const opts = rollChestOptions(CFG, 'starlightCargo', new S7AutoBattleRng('open1'));
    expect(opts.length).toBe(3);
    expect(opts[0]).toMatchObject({ kind: 'resource', resourceId: 'coreFrag' });
    expect(opts[1]).toMatchObject({ kind: 'resource', resourceId: 'starGem' });
    expect(opts[2].kind).toBe('beaconBundle');
  });

  it('chestPickLimits：星辉货舱 免费1·广告1', () => {
    expect(chestPickLimits(CFG, 'starlightCargo')).toEqual({ free: 1, ad: 1 });
  });

  it('未知宝箱 → 空列表 / 0 选数（不报错）', () => {
    expect(rollChestOptions(CFG, 'noSuchChest', new S7AutoBattleRng('z'))).toEqual([]);
    expect(chestPickLimits(CFG, 'noSuchChest')).toEqual({ free: 0, ad: 0 });
  });

  it('确定性：同 seed 整箱同结果', () => {
    const a = rollChestOptions(CFG, 'starlightCargo', new S7AutoBattleRng('seedX'));
    const b = rollChestOptions(CFG, 'starlightCargo', new S7AutoBattleRng('seedX'));
    expect(a).toEqual(b);
  });
});

describe('S7 开箱 · 默认配置 §10.6 自检', () => {
  it('星辉货舱=3选项·含星核碎片/星空宝石/信标包', () => {
    const def = CFG.chests.starlightCargo;
    expect(def.options.length).toBe(3);
    expect(def.options.some((o) => o.kind === 'resourceRange' && o.resourceId === 'coreFrag')).toBe(true);
    expect(def.options.some((o) => o.kind === 'resourceRange' && o.resourceId === 'starGem')).toBe(true);
    expect(def.options.some((o) => o.kind === 'beaconBundle')).toBe(true);
    expect(def.freePicks).toBe(1);
    expect(def.adPicks).toBe(1);
  });

  it('信标包个数=7-11（步5 重定基：选项面值=3×整箱期望〔选1/3口径〕·v0.7 §6 cargoChest 信标 EV 3 枚/箱→选项 9）', () => {
    const bundle = CFG.chests.starlightCargo.options.find((o) => o.kind === 'beaconBundle')!;
    if (bundle.kind !== 'beaconBundle') throw new Error('bad');
    expect(bundle.minCount).toBe(7);
    expect(bundle.maxCount).toBe(11);
  });
});
