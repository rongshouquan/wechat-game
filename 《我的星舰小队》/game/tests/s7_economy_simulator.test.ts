// 第三块①「造尺子」gate 测试：守恒 + 核心公式 + 尺子诚实性（任务单硬规格 #10）。
// 口径：毕业天数【不】进 gate（后续调数值天天变）；这里只钉
//   ① 内嵌形状靶副本没漂移（四档 30/37/47/57——这是"靶"不是"尺"，靶变=有人动了锁定决策）
//   ② 战力公式对 B1 手算例 ③ 附录D 升阶/升星消耗与等级上限 ④ 建筑成本公式对 6b3 草案例值
//   ⑤ 守恒（任何币种任何天不负 + 台账收支恒等式）⑥ 敏感性方向（尺子对输入诚实）
//   ⑦ 压力值表结构（单调、教程段可过、真Boss墙有跳升）⑧ 机制冒烟（四档能在 maxDays 内毕业）
import { describe, expect, it } from 'vitest';
import {
  SHAPE, shapeSimulate, TRUTHS, PARAMS, TIERS, TARGETS, RESOURCE_KEYS,
  shipBasePower, pilotCoef, unitPower, nodeStage, regionOfNode,
  calibratePressure, simulateEconomyTier,
} from '../tools/simulate-s7-economy.mjs';

// 压力值表全套测试共享一份（校准器确定性，跑一次 ~100ms）
const { pressure, gamma } = calibratePressure();

describe('S7 经济尺 · 形状靶副本（锁定决策镜像，漂移即报警）', () => {
  it('内嵌形状模型复现四档毕业 肝30/重37/普47/轻57', () => {
    expect(shapeSimulate('肝档').graduateDay).toBe(30);
    expect(shapeSimulate('重度').graduateDay).toBe(37);
    expect(shapeSimulate('普通').graduateDay).toBe(47);
    expect(shapeSimulate('轻度').graduateDay).toBe(57);
  });

  it('形状参数与 simulate-s7-progression.mjs 锁定值一致', () => {
    expect(SHAPE.N).toBe(150);
    expect(SHAPE.bossPositions).toEqual([0.4, 0.55, 0.68, 0.8, 0.9, 1.0]);
    expect(SHAPE.bossSpike).toBe(1.8);
    expect(SHAPE.tiers['普通'].r).toBe(0.06);
  });
});

describe('S7 经济尺 · 战力公式（B1 §1 骨架 + S5.5 计入项）', () => {
  it('B1 D7 手算例：B阶15级 + 插件85 + 3★驾驶 ≈ 500', () => {
    // B1 原文：星舰基础 160×(1+0.08×14)=339；(339+85)×1.18≈500
    const base = shipBasePower(1, 15);
    expect(base).toBeCloseTo(339.2, 1);
    const p = unitPower({ tier: 1, level: 15 }, { star: 3, level: 0 }, 85, false);
    expect(p).toBeCloseTo((339.2 + 85) * 1.18, 1);
  });

  it('阶级基值 C100/B160/A250/S380/SS550、星核 +120、插件 15/35/70', () => {
    expect(TRUTHS.tierBase).toEqual([100, 160, 250, 380, 550]);
    expect(TRUTHS.corePower).toBe(120);
    expect(TRUTHS.pluginPower).toEqual({ fine: 15, superior: 35, legendary: 70 });
    // 装核 = +120 平移
    const noCore = unitPower({ tier: 3, level: 1 }, { star: 1, level: 0 }, 0, false);
    const withCore = unitPower({ tier: 3, level: 1 }, { star: 1, level: 0 }, 0, true);
    expect(withCore - noCore).toBeCloseTo(120, 6);
  });

  it('驾驶员系数 = 星级系数 ×(1+1%/级)（S5.5 驾驶加成计入战力）', () => {
    expect(pilotCoef(1, 0)).toBeCloseTo(1.0, 6);
    expect(pilotCoef(3, 20)).toBeCloseTo(1.18 * 1.2, 6);
    expect(pilotCoef(5, 100)).toBeCloseTo(1.45 * 2.0, 6);
  });
});

describe('S7 经济尺 · 真源锁定消耗（附录D / 6b3 草案）', () => {
  it('升阶/升星 = 30 合成 + 50/100/300/1000（附录D，压过 B1 的 20/40/80/160）', () => {
    expect(TRUTHS.synthesizeBodyShards).toBe(30);
    expect(TRUTHS.shipAscendCost).toEqual([50, 100, 300, 1000]);
    expect(TRUTHS.pilotStarupCost).toEqual([50, 100, 300, 1000]);
  });

  it('等级上限只由阶级/星级定：C20/B40/A60/S80/SS100（2026-07-03 拍板）', () => {
    expect(TRUTHS.shipLevelCapByTier).toEqual([20, 40, 60, 80, 100]);
    expect(TRUTHS.pilotLevelCapByStar).toEqual([20, 40, 60, 80, 100]);
  });

  it('升级成本曲线：星舰 50×lv^1.3 / 驾驶员 40×lv^1.2（B1 §2 形状）', () => {
    expect(TRUTHS.shipLevelCost(1)).toBe(50);
    expect(TRUTHS.shipLevelCost(10)).toBe(Math.round(50 * Math.pow(10, 1.3)));
    expect(TRUTHS.pilotLevelCost(10)).toBe(Math.round(40 * Math.pow(10, 1.2)));
  });

  it('建筑成本 = round(120×L^1.3×重要度)，对 6b3 草案例值（295 / 2088 / ×1.3 档 156）', () => {
    expect(TRUTHS.buildingCost(1, 1.0)).toBe(120);
    expect(TRUTHS.buildingCost(2, 1.0)).toBe(295);
    expect(TRUTHS.buildingCost(9, 1.0)).toBe(2088);
    expect(TRUTHS.buildingCost(1, 1.3)).toBe(156);
  });

  it('打捞时间档每小时效率递减、每信标收益递增（S10.2 口径）', () => {
    const m = TRUTHS.salvageTimeMult;
    expect(m.h2).toBeLessThan(m.h8);
    expect(m.h8).toBeLessThan(m.h24);
    expect(m.h2 / 2).toBeGreaterThan(m.h8 / 8);
    expect(m.h8 / 8).toBeGreaterThan(m.h24 / 24);
  });
});

describe('S7 经济尺 · 守恒自检（任务单验收 #②）', () => {
  for (const tier of Object.keys(TARGETS)) {
    it(`${tier}：任何币种任何天不出现负余额`, () => {
      const r = simulateEconomyTier(tier, pressure, {});
      expect(r.negativeViolations).toEqual([]);
    });
  }

  it('台账收支恒等式：终局余额 = Σ收入 − Σ支出（每币种）', () => {
    const r = simulateEconomyTier('普通', pressure, {});
    for (const key of RESOURCE_KEYS) {
      let net = 0;
      for (const kv of Object.values(r.ledger.income)) net += (kv as Record<string, number>)[key] ?? 0;
      for (const kv of Object.values(r.ledger.spend)) net -= (kv as Record<string, number>)[key] ?? 0;
      const bal = (r.resources as Record<string, number>)[key];
      expect(Math.abs(net - bal), `${key} 台账不平：净流 ${net} vs 余额 ${bal}`).toBeLessThan(0.51); // 余额输出四舍五入到 0.1
    }
  });

  it('欧非包络与广告开关下同样守恒', () => {
    for (const opts of [{ envelope: 'lucky' }, { envelope: 'unlucky' }, { ads: 'none' }, { ads: 'full' }] as const) {
      const r = simulateEconomyTier('普通', pressure, opts as never);
      expect(r.negativeViolations).toEqual([]);
    }
  });
});

describe('S7 经济尺 · 尺子诚实性（对输入敏感·不为绿而绿）', () => {
  const base = simulateEconomyTier('普通', pressure, {});

  it('敏感性方向：清零离线 → 毕业明显变慢', () => {
    const r = simulateEconomyTier('普通', pressure, { disable: { offline: true } });
    const rd = r.graduateDay ?? PARAMS.maxDays + 1;
    expect(rd).toBeGreaterThan((base.graduateDay ?? 0) + 3);
  });

  it('反例注入：打捞收入砍半 → 毕业变慢（尺子不许靠别处"自愈"）', () => {
    const r = simulateEconomyTier('普通', pressure, { incomeScale: { salvage: 0.5 } });
    const rd = r.graduateDay ?? PARAMS.maxDays + 1;
    expect(rd).toBeGreaterThan((base.graduateDay ?? 0) + 2);
  });

  it('停玩追赶：停 2 天毕业不早于基线、也不晚于基线+2+3（不绝望上界）', () => {
    const r = simulateEconomyTier('普通', pressure, { pause: { from: 10, days: 2 } });
    expect(r.graduateDay).not.toBeNull();
    expect(r.graduateDay!).toBeGreaterThanOrEqual(base.graduateDay!);
    expect(r.graduateDay!).toBeLessThanOrEqual(base.graduateDay! + 2 + 3);
  });

  it('广告方向：满广告不慢于零广告；零广告也能毕业（红线①）', () => {
    const full = simulateEconomyTier('普通', pressure, { ads: 'full' });
    const none = simulateEconomyTier('普通', pressure, { ads: 'none' });
    expect(none.graduateDay).not.toBeNull();
    expect(full.graduateDay!).toBeLessThanOrEqual(none.graduateDay!);
  });
});

describe('S7 经济尺 · 压力值表结构', () => {
  it('长度 151（下标 1-150）、全程单调不降、教程段 n1-n5 显著低', () => {
    expect(pressure.length).toBe(TRUTHS.N + 1);
    for (let n = 2; n <= TRUTHS.N; n++) {
      expect(pressure[n], `n${n} 应 ≥ n${n - 1}`).toBeGreaterThanOrEqual(pressure[n - 1]);
    }
    expect(pressure[1]).toBeLessThan(pressure[30]);
    expect(pressure[150]).toBeGreaterThan(pressure[1] * 20);
  });

  it('6 真Boss墙位于 60/84/102/120/138/150；4 面长墙（60/102/120/150）有跳升', () => {
    expect(TRUTHS.bossNodes).toEqual([60, 84, 102, 120, 138, 150]);
    // 形状模型的真实特征：n84/n138 被"破墙余势"当天带过（普通档等待 0 天），
    // 压力表在这两处天然无跳升；真正的长墙是 60/102/120/150 四面。
    for (const w of [60, 102, 120, 150]) {
      expect(pressure[w] / pressure[w - 1], `n${w} 墙跳升不足`).toBeGreaterThan(1.10);
    }
    for (const w of [84, 138]) {
      expect(pressure[w], `n${w} 应保持单调`).toBeGreaterThanOrEqual(pressure[w - 1]);
    }
  });

  it('γ 收口系数在理智区间（0.5-3.0）', () => {
    expect(gamma).toBeGreaterThan(0.5);
    expect(gamma).toBeLessThan(3.0);
  });

  it('节点分类：n030=剧情首Boss、n006=精英、区域归属正确', () => {
    expect(nodeStage(30)).toBe('storyBoss');
    expect(nodeStage(6)).toBe('elite');
    expect(nodeStage(60)).toBe('boss');
    expect(nodeStage(7)).toBe('normal');
    expect(regionOfNode(1)).toBe(1);
    expect(regionOfNode(60)).toBe(1);
    expect(regionOfNode(61)).toBe(2);
    expect(regionOfNode(150)).toBe(6);
  });
});

describe('S7 经济尺 · 机制冒烟（不断言具体毕业天数）', () => {
  it('四档都能在 maxDays 内毕业、档位顺序 肝<重<普<轻', () => {
    const days = (['肝档', '重度', '普通', '轻度'] as const).map(
      (t) => simulateEconomyTier(t, pressure, {}).graduateDay ?? Infinity,
    );
    for (const d of days) expect(d).toBeLessThanOrEqual(PARAMS.maxDays);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1]);
  });

  it('陨星弹在 n030 首通发放、深空回廊随之解锁（核数 ≥1）', () => {
    const r = simulateEconomyTier('普通', pressure, {});
    expect(r.coresOwned).toBeGreaterThanOrEqual(1);
    expect(r.corridorLayer).toBeGreaterThan(0);
  });

  it('20 抽保底口径存在（gachaPity=20）·钱包 14 键与存档真源一致', () => {
    expect(TRUTHS.gachaPity).toBe(20);
    expect(RESOURCE_KEYS).toEqual([
      'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
      'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
      'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket',
    ]);
  });
});
