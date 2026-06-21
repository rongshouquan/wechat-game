// 阶段一 I-step1：星核三渠道引擎单测（v1.0 §5.4/§9.3/§10.4）——
//   碎片合成(够/不够/空池/确定性·出核在池内) · 扩张宝藏(首次全池/非首次随机三选一无放回/池不足/确定性) ·
//   宝库视图(owned/limited/affordable) · 默认配置§5.4自检(core07不进池·限定核不进合成/扩张池)。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_CORE_SOURCE_CONFIG as CFG, S7CoreSourceConfig } from '../assets/scripts/core/s7/S7CoreSourceConfig';
import { synthesizeCore, rollExpansionChoices, vaultCoreViews, vaultShipViews } from '../assets/scripts/core/s7/S7CoreSourceService';

describe('S7 星核 · 碎片随机合成', () => {
  it('碎片不够 → insufficient·不出核', () => {
    const r = synthesizeCore(CFG, CFG.synthesisCost - 1, new S7AutoBattleRng('a'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient');
  });

  it('够碎片 → 出 1 颗在 synthesisPool 内的核·fragSpent=成本', () => {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const r = synthesizeCore(CFG, 999, new S7AutoBattleRng(seed));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(CFG.synthesisPool).toContain(r.coreId);
        expect(r.fragSpent).toBe(CFG.synthesisCost);
      }
    }
  });

  it('空池 → empty_pool', () => {
    const cfg: S7CoreSourceConfig = { ...CFG, synthesisPool: [] };
    const r = synthesizeCore(cfg, 999, new S7AutoBattleRng('x'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty_pool');
  });

  it('确定性：同 seed 同结果', () => {
    expect(synthesizeCore(CFG, 999, new S7AutoBattleRng('same'))).toEqual(synthesizeCore(CFG, 999, new S7AutoBattleRng('same')));
  });
});

describe('S7 星核 · 扩张宝藏开箱', () => {
  it('首次 → 全池自选（返回整个 expansionPool）', () => {
    const out = rollExpansionChoices(CFG, true, new S7AutoBattleRng('a'));
    expect(out).toEqual(CFG.expansionPool);
  });

  it('非首次 → 随机三选一·无放回·都在池内', () => {
    for (const seed of ['e1', 'e2', 'e3', 'e4']) {
      const out = rollExpansionChoices(CFG, false, new S7AutoBattleRng(seed));
      expect(out.length).toBe(CFG.expansionChoiceCount); // 3
      expect(new Set(out).size).toBe(out.length); // 无放回·不重复
      expect(out.every((id) => CFG.expansionPool.includes(id))).toBe(true);
    }
  });

  it('池不足选项数 → 返回现有数量', () => {
    const cfg: S7CoreSourceConfig = { ...CFG, expansionPool: ['core01', 'core02'], expansionChoiceCount: 3 };
    const out = rollExpansionChoices(cfg, false, new S7AutoBattleRng('q'));
    expect(out.length).toBe(2);
    expect(new Set(out).size).toBe(2);
  });

  it('确定性：同 seed 同结果', () => {
    expect(rollExpansionChoices(CFG, false, new S7AutoBattleRng('z'))).toEqual(rollExpansionChoices(CFG, false, new S7AutoBattleRng('z')));
  });
});

describe('S7 星核 · 星空宝库视图', () => {
  it('星核：owned/limited/affordable 标记正确', () => {
    const cfg: S7CoreSourceConfig = {
      ...CFG,
      vaultCores: [{ coreId: 'core01', gemCost: 80 }, { coreId: 'coreLtd', gemCost: 300 }],
      vaultLimitedCoreIds: ['coreLtd'],
    };
    const v = vaultCoreViews(cfg, ['core01'], 100);
    expect(v[0]).toEqual({ coreId: 'core01', gemCost: 80, owned: true, limited: false, affordable: true });
    expect(v[1]).toEqual({ coreId: 'coreLtd', gemCost: 300, owned: false, limited: true, affordable: false });
  });

  it('专属舰：owned/affordable 标记正确', () => {
    const v = vaultShipViews(CFG, ['shp10'], 200);
    const s10 = v.find((x) => x.shipId === 'shp10')!;
    const s11 = v.find((x) => x.shipId === 'shp11')!;
    expect(s10.owned).toBe(true);
    expect(s11.owned).toBe(false);
    expect(s11.affordable).toBe(true); // gemHave 200 == cost 200
  });
});

describe('S7 星核 · 默认配置 §5.4 自检', () => {
  it('core07(过载核心) 不进任何渠道池', () => {
    expect(CFG.synthesisPool).not.toContain('core07');
    expect(CFG.expansionPool).not.toContain('core07');
    expect(CFG.vaultCores.some((e) => e.coreId === 'core07')).toBe(false);
  });

  it('宝库限定核 不进 合成/扩张 池（§5.4 只在宝库）', () => {
    for (const id of CFG.vaultLimitedCoreIds) {
      expect(CFG.synthesisPool).not.toContain(id);
      expect(CFG.expansionPool).not.toContain(id);
    }
  });

  it('宝库卖 星核 + 专属舰（§10.4）', () => {
    expect(CFG.vaultCores.length).toBeGreaterThan(0);
    expect(CFG.vaultShips.length).toBeGreaterThan(0);
  });
});
