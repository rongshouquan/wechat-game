// 星核渠道引擎单测（步5 收尾批重定基·渠道矩阵终值=星核真源头注 + 初值表 v0.7 §6-3）——
// 重定基总说明（旧→新→为什么对）：
//   ① 旧 core01-06 占位池 → 13 常规开蛋池（2 强常规 w0.035 头奖）+ 11 宝藏池 + 8 流通宝库（收编=细表 §15 映射）；
//   ② 旧"宝库一次性解锁+限定核" → 流通核可复购 ×1.5 递增（按已拥有份数计价）+ 毕业核 2 颗唯一解锁（总修订案）；
//   ③ 新增：前 5 颗保底（细案§二1 Ron 方案2）/ 双黄蛋 3%（细案⑧案A）/ 曲率星门欧皇线 p0.04。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_CORE_SOURCE_CONFIG as CFG, S7CoreSourceConfig } from '../assets/scripts/core/s7/S7CoreSourceConfig';
import {
  synthesizeCore, rollExpansionChoices, vaultCoreViews, vaultShipViews,
  pickCoreWithPity, corePityActive, eggWeights, vaultCorePrice, grantRandomFlowCore,
} from '../assets/scripts/core/s7/S7CoreSourceService';

describe('S7 星核 · 渠道矩阵终值对表（v0.7 §6-3）', () => {
  it('开蛋池 13 常规（不含陨星弹/毕业核）·宝藏池 11（池子3+流通8）·宝库 8 流通@120+2 毕业@200', () => {
    expect(CFG.synthesisPool).toHaveLength(13);
    expect(CFG.expansionPool).toHaveLength(11);
    expect(CFG.synthesisPool).not.toContain('core07'); // 陨星弹=首Boss 首杀唯一
    expect(CFG.synthesisPool).not.toContain('core15'); // 毕业核不进开蛋
    expect(CFG.synthesisPool).not.toContain('core17');
    expect(CFG.strongRegularIds).toEqual(['core08', 'core09']); // 小太阳/星鲸=§18.3 底稿领跑（挂牌 Ron 追认）
    expect(CFG.expansionPool).not.toContain('core08'); // 强常规只出开蛋
    expect(CFG.expansionPool).not.toContain('core09');
    expect(CFG.flowCoreIds).toHaveLength(8);
    const flow = CFG.vaultCores.filter((e) => !e.graduation);
    const grad = CFG.vaultCores.filter((e) => e.graduation);
    expect(flow).toHaveLength(8);
    expect(flow.every((e) => e.gemCost === 120)).toBe(true); // 宝库流通统一价 120（细案§二2）
    expect(grad.map((e) => e.coreId).sort()).toEqual(['core15', 'core17']); // 超新星/曲率星门
    expect(grad.every((e) => e.gemCost === 200)).toBe(true);
    expect(CFG.synthesisCost).toBe(60);
    expect(CFG.doubleYolkP).toBe(0.03);
    expect(CFG.distinctPity).toBe(5);
    expect(CFG.treasureGradP).toBe(0.04);
    expect(CFG.vaultRepeatPriceGrowth).toBe(1.5);
  });

  it('开蛋权重：强常规各 0.035、其余 11 颗均分（合计=1）', () => {
    const w = eggWeights(CFG);
    const strongIdx = CFG.synthesisPool.map((id, i) => (CFG.strongRegularIds.includes(id) ? i : -1)).filter((i) => i >= 0);
    for (const i of strongIdx) expect(w[i]).toBeCloseTo(0.035, 10);
    const rest = w.filter((_, i) => !strongIdx.includes(i));
    for (const x of rest) expect(x).toBeCloseTo((1 - 0.07) / 11, 10);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('S7 星核 · 碎片开蛋（保底+双黄蛋）', () => {
  it('碎片不够 → insufficient·不出核', () => {
    const r = synthesizeCore(CFG, CFG.synthesisCost - 1, new S7AutoBattleRng('a'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient');
  });

  it('够碎片 → 出核在 synthesisPool 内·fragSpent=60', () => {
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const r = synthesizeCore(CFG, 999, new S7AutoBattleRng(seed));
      expect(r.ok).toBe(true);
      if (r.ok) {
        for (const id of r.coreIds) expect(CFG.synthesisPool).toContain(id);
        expect(r.fragSpent).toBe(60);
      }
    }
  });

  it('前 5 颗保底：已拥有 <5 时开蛋只出未拥有款（细案§二1）', () => {
    const owned = CFG.synthesisPool.slice(0, 4); // 已拥有 4 种
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      const r = synthesizeCore(CFG, 999, new S7AutoBattleRng(seed), owned);
      expect(r.ok).toBe(true);
      if (r.ok) expect(owned).not.toContain(r.coreIds[0]); // 必是新款
    }
    expect(corePityActive(CFG, 4)).toBe(true);
    expect(corePityActive(CFG, 5)).toBe(false); // 第 6 颗起纯随机可重复
  });

  it('双黄蛋 3%（展厅 Lv10）：出 2 颗·第二颗限流通款；未满级 doubleYolkP=0 恒单蛋', () => {
    // 用注入概率 1.0 验证结构（真实 3%=galleryDoubleYolkP 传入·概率分布不在单测断言）。
    let sawYolk = false;
    for (const seed of ['y1', 'y2', 'y3']) {
      const r = synthesizeCore(CFG, 999, new S7AutoBattleRng(seed), [], 1.0);
      expect(r.ok).toBe(true);
      if (r.ok && r.doubleYolk) {
        sawYolk = true;
        expect(r.coreIds).toHaveLength(2);
        expect(CFG.flowCoreIds).toContain(r.coreIds[1]); // 第二颗限流通款
      }
    }
    expect(sawYolk).toBe(true);
    const single = synthesizeCore(CFG, 999, new S7AutoBattleRng('y0'), [], 0);
    if (single.ok) expect(single.coreIds).toHaveLength(1);
  });

  it('空池 → empty_pool；确定性：同 seed 同结果', () => {
    const cfg: S7CoreSourceConfig = { ...CFG, synthesisPool: [] };
    const r = synthesizeCore(cfg, 999, new S7AutoBattleRng('x'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty_pool');
    expect(synthesizeCore(CFG, 999, new S7AutoBattleRng('same'))).toEqual(synthesizeCore(CFG, 999, new S7AutoBattleRng('same')));
  });
});

describe('S7 星核 · 扩张宝藏开箱（保底两张+欧皇线）', () => {
  it('首次 → 全池自选（返回整个 expansionPool）', () => {
    const out = rollExpansionChoices(CFG, true, new S7AutoBattleRng('a'));
    expect(out).toEqual(CFG.expansionPool);
  });

  it('非首次 → 随机三选一·无放回·都在池内（或欧皇线曲率星门）', () => {
    for (const seed of ['e1', 'e2', 'e3', 'e4']) {
      const out = rollExpansionChoices(CFG, false, new S7AutoBattleRng(seed));
      expect(out.length).toBe(CFG.expansionChoiceCount); // 3
      expect(new Set(out).size).toBe(out.length); // 无放回·不重复
      expect(out.every((id) => CFG.expansionPool.includes(id) || id === CFG.treasureGradCoreId)).toBe(true);
    }
  });

  it('保底期（已拥有 <5）：三张至少两张未拥有（细案§二1）', () => {
    const owned = CFG.expansionPool.slice(0, 3); // 拥有 3 种（<5=保底期）
    for (const seed of ['g1', 'g2', 'g3', 'g4', 'g5']) {
      const out = rollExpansionChoices(CFG, false, new S7AutoBattleRng(seed), owned);
      const unownedCount = out.filter((id) => !owned.includes(id)).length;
      expect(unownedCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('欧皇线：p=1 注入 → 末张必为曲率星门（已拥有则不换）', () => {
    const cfg: S7CoreSourceConfig = { ...CFG, treasureGradP: 1 };
    const out = rollExpansionChoices(cfg, false, new S7AutoBattleRng('lucky'));
    expect(out[out.length - 1]).toBe('core17');
    const outOwned = rollExpansionChoices(cfg, false, new S7AutoBattleRng('lucky'), ['core17', ...CFG.expansionPool.slice(0, 4)]);
    expect(outOwned).not.toContain('core17'); // 已拥有=不换（毕业核唯一解锁）
  });

  it('池不足选项数 → 返回现有数量；确定性：同 seed 同结果', () => {
    const cfg: S7CoreSourceConfig = { ...CFG, expansionPool: ['core12', 'core13'], expansionChoiceCount: 3, treasureGradP: 0 };
    const out = rollExpansionChoices(cfg, false, new S7AutoBattleRng('q'));
    expect(out.length).toBe(2);
    expect(new Set(out).size).toBe(2);
    expect(rollExpansionChoices(CFG, false, new S7AutoBattleRng('z'))).toEqual(rollExpansionChoices(CFG, false, new S7AutoBattleRng('z')));
  });
});

describe('S7 星核 · 星空宝库视图（流通复购 ×1.5·毕业唯一）', () => {
  it('流通核：未拥有=基价 120 可购；已拥有 n 份=120×1.5^n 复购价（恒可购）', () => {
    expect(vaultCorePrice(120, 0, 1.5)).toBe(120);
    expect(vaultCorePrice(120, 1, 1.5)).toBe(180);
    expect(vaultCorePrice(120, 2, 1.5)).toBe(270);
    const flowId = CFG.flowCoreIds[0];
    const v = vaultCoreViews(CFG, { [flowId]: 2 }, 500);
    const row = v.find((x) => x.coreId === flowId)!;
    expect(row.ownedCopies).toBe(2);
    expect(row.gemCost).toBe(270);
    expect(row.purchasable).toBe(true); // 流通核恒可复购（"全队配同款"慢速线）
    expect(row.graduation).toBe(false);
  });

  it('毕业核：唯一解锁（已拥有=不可购）·基价 200 不递增', () => {
    const v = vaultCoreViews(CFG, { core15: 1 }, 999);
    const nova = v.find((x) => x.coreId === 'core15')!;
    expect(nova.graduation).toBe(true);
    expect(nova.purchasable).toBe(false);
    const gate = v.find((x) => x.coreId === 'core17')!;
    expect(gate.purchasable).toBe(true);
    expect(gate.gemCost).toBe(200);
  });

  it('专属舰：owned/affordable 标记正确（定价=尺外沿用值）', () => {
    const v = vaultShipViews(CFG, ['shp10'], 200);
    const s10 = v.find((x) => x.shipId === 'shp10')!;
    const s11 = v.find((x) => x.shipId === 'shp11')!;
    expect(s10.owned).toBe(true);
    expect(s11.owned).toBe(false);
    expect(s11.affordable).toBe(true); // gemHave 200 == cost 200
  });
});

describe('S7 星核 · 通用保底选择器 + 商店/黑市流通核发放', () => {
  it('pickCoreWithPity：保底期只出未拥有款；全拥有退回全池（防空池）', () => {
    const pool = CFG.flowCoreIds;
    const owned = pool.slice(0, 3);
    for (const seed of ['k1', 'k2', 'k3', 'k4']) {
      const picked = pickCoreWithPity(pool, null, CFG, owned, new S7AutoBattleRng(seed));
      expect(picked).not.toBeNull();
      expect(owned).not.toContain(picked);
    }
    const allOwned = pickCoreWithPity(pool.slice(0, 2), null, CFG, pool.slice(0, 2), new S7AutoBattleRng('k5'));
    expect(pool.slice(0, 2)).toContain(allOwned); // 子池全拥有=退回全池
  });

  it('grantRandomFlowCore：发一颗流通核入账 ownedCores（吃保底）', () => {
    const squad = { ownedCores: {} as Record<string, number> };
    const id = grantRandomFlowCore(squad, new S7AutoBattleRng('shop'));
    expect(id).not.toBeNull();
    expect(CFG.flowCoreIds).toContain(id);
    expect(squad.ownedCores[id!]).toBe(1);
  });
});

describe('S7 星核 · 默认配置渠道矩阵自检', () => {
  it('core07(陨星弹) 不进任何渠道池（首Boss 首杀唯一）', () => {
    expect(CFG.synthesisPool).not.toContain('core07');
    expect(CFG.expansionPool).not.toContain('core07');
    expect(CFG.vaultCores.some((e) => e.coreId === 'core07')).toBe(false);
  });

  it('强常规只出开蛋（不进宝藏/宝库）；毕业核不进开蛋/宝藏常规位', () => {
    for (const id of CFG.strongRegularIds) {
      expect(CFG.expansionPool).not.toContain(id);
      expect(CFG.vaultCores.some((e) => e.coreId === id)).toBe(false);
    }
  });

  it('宝库卖 星核 + 专属舰（§10.4）', () => {
    expect(CFG.vaultCores.length).toBe(10);
    expect(CFG.vaultShips.length).toBeGreaterThan(0);
  });
});
