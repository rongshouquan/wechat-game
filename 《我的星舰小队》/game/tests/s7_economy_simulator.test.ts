// 第三块①「造尺子」→ 第三块③「形状靶v2+双锚+黑市」→ 任务单⑤「B1军饷落地+参与度真分层」
// → 任务单⑧「经济尺重构」gate 测试（如实重定基）。⑧新增面：委托 3 张+明保底+难度四档
//（品质期望/难度选择纯函数/试探胜率）、演习木桩档位函数（记录第一单源搬家）、星核渠道
// 矩阵（开蛋收藏期望/宝库两层价/毕业核到手时点）、黑市 2大+4小+宝箱（计数余额约束·强星核
// 退役）、商店百货化与广告券新规（福利广告铁顶）、逐关养成态导出口（⑥第三段接口）。
// 口径：毕业天数【不】进 gate（后续调数值天天变）；进 gate 的是——
//   ① 内嵌形状靶 v2 副本没漂移（四档 30/37/47/57 + 递进墙矩阵——"靶"不是"尺"，靶变=有人动了锁定决策）
//   ② 战力公式对 B1 手算例 ③ 附录D 升阶/升星消耗与等级上限 ④ 建筑成本公式对 6b3 草案例值
//   ⑤ 守恒（五画像任何币种任何天不负 + 台账收支恒等式 + 黑市计数账本）
//   ⑥ 敏感性方向（尺子对输入诚实）⑦ 压力值表结构（单调/教程段可过/双锚结构/递进墙跳升）
//   ⑧ 校准基线全绿（四档带/首周/硬顶/新手零墙/肝墙矩阵带/黑市党 D22-25——全是"带"不钉天数）
//   ⑨ 抗漂移回归护栏（±20% 单源扰动×6 重校后达标 + 指定反例 treasure×2=v0.1 病灶回归测试）
//   ⑩ 黑市三条验收（D22-25 / 四档基线不变性=严格相等 / 计数守恒与日上限）
import { describe, expect, it } from 'vitest';
import {
  SHAPE, shapeSimulate, TRUTHS, PARAMS, TIERS, TARGETS, BM_TARGET, RESOURCE_KEYS,
  WALL_MATRIX_BANDS, HARD_WALL_CAP,
  shipBasePower, pilotCoef, unitPower, nodeStage, regionOfNode,
  benchEffPct, bountyCardsFor, incomeShares,
  commissionQualityEV, pickCommissionDifficulty, drillTierFor, drillCumReward, expectedDistinctCores,
  calibratePressure, simulateEconomyTier, runStandard,
  checkCalibration, checkBlackMarket, DRIFT_VARIANTS, runDriftVariant,
} from '../tools/simulate-s7-economy.mjs';

// 压力值表与五画像标准跑全套共享一份（校准器确定性，跑一次 ~150ms）
const { pressure, gammas, anchors, schedule } = calibratePressure();
const std = runStandard(pressure);

/** 形状层墙指标（零清等待天数口径·与工具 summarize 同算法的测试侧独立实现） */
function shapeWallMetrics(dailyLog: number[]) {
  const wall: Record<number, number> = { 60: 0, 84: 0, 102: 0, 120: 0, 138: 0, 150: 0 };
  let cum = 0, newbie = 0, maxWall = 0, cur = 0;
  for (const c of dailyLog) {
    if (c === 0) {
      cur++;
      if (cum < 30) newbie++;
      if (wall[cum + 1] !== undefined) wall[cum + 1]++;
    } else cur = 0;
    maxWall = Math.max(maxWall, cur);
    cum += c;
  }
  return { wall, newbie, maxWall, firstWeek: dailyLog.slice(0, 7).reduce((a, b) => a + b, 0) };
}

describe('S7 经济尺 · 形状靶 v2 副本（锁定决策镜像，漂移即报警）', () => {
  it('内嵌形状模型复现四档毕业 肝30/重37/普47/轻57', () => {
    // 为什么对：四档毕业靶是 Ron 锁定决策（30/37/47/57 钉死不变），v2 递进墙改的是
    // 墙的分布形状，毕业日必须精确复现——这四个数字任何漂移都意味着有人动了锁定决策。
    expect(shapeSimulate('肝档').graduateDay).toBe(30);
    expect(shapeSimulate('重度').graduateDay).toBe(37);
    expect(shapeSimulate('普通').graduateDay).toBe(47);
    expect(shapeSimulate('轻度').graduateDay).toBe(57);
  });

  it('v2 形状参数与 simulate-s7-progression.mjs 锁定值一致（旧 v1 均匀 1.8 靶已作废）', () => {
    // 为什么对（重定基 2026-07-06）：Ron 递进墙拍板作废旧"六墙均匀 1.8×"靶；新尖峰=
    // 任务单③"形状约束×经济实测"端到端拟合定稿（过程记初值表 v0.3）；光滑曲线三参数
    // 与 v1 相同（递进感全部由尖峰表达）；r=恰好毕业靶日可行区间中点。
    expect(SHAPE.N).toBe(150);
    expect(SHAPE.qStart).toBe(0.003);
    expect(SHAPE.qEnd).toBe(0.03);
    expect(SHAPE.curvePow).toBe(1.1);
    expect(SHAPE.bossSpikes).toEqual({ 60: 1.12, 84: 1.01, 102: 1.24, 120: 1.27, 138: 1.0, 150: 1.38 });
    expect(SHAPE.tiers['肝档'].r).toBe(0.0741);
    expect(SHAPE.tiers['重度'].r).toBe(0.0637);
    expect(SHAPE.tiers['普通'].r).toBe(0.0528);
    expect(SHAPE.tiers['轻度'].r).toBe(0.0452);
  });

  it('形状层递进墙性质：肝墙 1/2/2/4、n084/n138 全档零等待、新手零墙、全档 ≤7 硬顶', () => {
    // 为什么对：任务单③硬规格#1 的形状层落地实测值——肝档 1/2/2/4（n120 取"≈3"的
    // −1 容差、n150=4 毕业墙保持最长，取舍记档：换轻度经济层不破 7 天硬顶）；
    // 新手期 n001-n030 零墙与 84/138 余势墙零等待是全档硬性质。
    const liver = shapeWallMetrics(shapeSimulate('肝档').dailyLog);
    expect(liver.wall).toEqual({ 60: 1, 84: 0, 102: 2, 120: 2, 138: 0, 150: 4 });
    for (const t of ['肝档', '重度', '普通', '轻度'] as const) {
      const m = shapeWallMetrics(shapeSimulate(t).dailyLog);
      expect(m.newbie, `${t} 新手期应零墙`).toBe(0);
      expect(m.maxWall, `${t} 形状层单墙硬顶`).toBeLessThanOrEqual(7);
      expect(m.wall[84], `${t} n084 余势墙`).toBe(0);
      expect(m.wall[138], `${t} n138 余势墙`).toBe(0);
    }
    // 普通档首周 59 关 = 39.3%（靶 35-40%——首周清关是锁定决策的一部分）
    expect(shapeWallMetrics(shapeSimulate('普通').dailyLog).firstWeek).toBe(59);
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

describe('S7 经济尺 · 新真源增量（任务单③硬规格 #4）', () => {
  it('7天扩张两笔分账（S10.5 三层复原）：完成奖=史诗信标+星核碎片、结算奖=完整星核，过程奖不再含史诗信标', () => {
    // 为什么对：S10.5（2026-07-06 自 v1.0 复原）明确 完成奖励＝史诗信标/星核碎片、
    // 结算奖励＝扩张宝藏完整星核 是两笔——v0 曾把史诗信标折进过程奖平摊（口径错），
    // 本版把 beaconEpic 从 cycle7 过程包移出、单列 completion7；碎片量值 8 =数值域自定记档。
    expect(PARAMS.events.completion7.beaconEpic).toBeGreaterThanOrEqual(1);
    expect(PARAMS.events.completion7.coreFrag).toBeGreaterThan(0);
    expect(PARAMS.events.completionCore).toBe(1);
    expect((PARAMS.events.cycle7 as Record<string, number>).beaconEpic).toBeUndefined();
  });

  it('S10.2 打捞护栏在模型的体现：不出整核/整舰、高稀有走概率层无保底节拍', () => {
    // 为什么对：S10.2 经济护栏①完整星核不进打捞（只出星核碎片/星空宝石）——模型的
    // fixed/rollEV 里不得出现 fullCore；②完整星舰=C阶（模型保守省略整舰产出=连 C 阶
    // 都不发，方向只会低估打捞、不会虚高）；③高稀有（居民/工人/货舱/插件）在 rollEV
    // 概率层、无 pity 结构（模型本就无打捞保底计数器）。
    for (const tier of Object.values(PARAMS.salvage.tiers)) {
      expect((tier.fixed as Record<string, number>).fullCore).toBeUndefined();
      expect((tier.rollEV as Record<string, number>).fullCore).toBeUndefined();
      expect((tier.rollEV as Record<string, number>).shipBody).toBeUndefined();
    }
  });
});

describe('S7 经济尺 · 守恒自检（五画像）', () => {
  for (const tier of [...Object.keys(TARGETS), BM_TARGET.tier]) {
    it(`${tier}：任何币种任何天不出现负余额`, () => {
      expect(std[tier].expected.negativeViolations).toEqual([]);
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
  const base = std['普通'].expected;

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

describe('S7 经济尺 · 压力值表结构（双锚 v2）', () => {
  it('长度 151（下标 1-150）、全程单调不降、教程段 n1-n5 显著低', () => {
    expect(pressure.length).toBe(TRUTHS.N + 1);
    for (let n = 2; n <= TRUTHS.N; n++) {
      expect(pressure[n], `n${n} 应 ≥ n${n - 1}`).toBeGreaterThanOrEqual(pressure[n - 1]);
    }
    expect(pressure[1]).toBeLessThan(pressure[30]);
    expect(pressure[150]).toBeGreaterThan(pressure[1] * 20);
  });

  it('6 真Boss墙位于 60/84/102/120/138/150；4 面真墙（60/102/120/150）有跳升、84/138 余势墙近平', () => {
    // 为什么对（重定基 v2）：旧靶 4 面墙统一 >1.10 跳升；v2 递进墙下实测跳升
    // n60=1.25/n102=1.20/n120=1.19/n150=1.21（墙高≈普通档在该墙的等待天数的战力增量，
    // 四面都远高于 1.10 地板）；n84/n138 设计为零等待余势墙、只须单调（实测 1.00/1.01）。
    expect(TRUTHS.bossNodes).toEqual([60, 84, 102, 120, 138, 150]);
    for (const w of [60, 102, 120, 150]) {
      expect(pressure[w] / pressure[w - 1], `n${w} 墙跳升不足`).toBeGreaterThan(1.10);
    }
    for (const w of [84, 138]) {
      expect(pressure[w], `n${w} 应保持单调`).toBeGreaterThanOrEqual(pressure[w - 1]);
      expect(pressure[w] / pressure[w - 1], `n${w} 余势墙不应立起真墙`).toBeLessThan(1.10);
    }
  });

  it('双锚结构：早锚=n060 破墙日 D9、晚锚=毕业日 D47（皆取自形状时刻表），γ 各自在理智区间', () => {
    // 为什么对：双锚是任务单③的机制本体——锚点天数直接来自形状 v2 时刻表
    // （schedule[60]=9 / schedule[150]=47=普通档毕业靶），不是手填魔数；γ 落在
    // (0.5,3.0) 之外说明经济与形状量级脱节（种子缩放或收入结构大改），必须人工介入。
    expect(anchors.map((a) => ({ node: a.node, targetDay: a.targetDay })))
      .toEqual([{ node: 60, targetDay: 9 }, { node: 150, targetDay: 47 }]);
    expect(schedule[60]).toBe(9);
    expect(schedule[150]).toBe(47);
    expect(schedule[150]).toBe(TARGETS['普通']);
    for (const g of gammas) {
      expect(g).toBeGreaterThan(0.5);
      expect(g).toBeLessThan(3.0);
    }
  });

  it('早锚兑现：普通档实跑 n060 破墙日落在 [7,10] 窗（锚 D9 − 教程钳制反馈 2 天 / + 跳变 1 天）', () => {
    // 为什么对：γ 搜索钉的是"钳制前"曲线的破墙日 ≤9（整数日跳变最坏 +1）；终表教程段
    // 钳制（n1-8 开局必过·GDD-M 硬规格）让 D1 多清几关、奖励链式提前 ≈2 天——把钳制
    // 挪进搜索循环会移动整个校准不动点（实测新手期反冒 2 天墙·选型教训记 calibratePressure
    // 注释），故按机理如实取 [7,10] 窗。防"早段价格漂移"的真保护=treasure×2 指定反例 +
    // 抗漂移变体的肝 n060 带（收紧 [0,2]），不靠这条的精确到日。
    const r = std['普通'].expected;
    let cum = 0, breakDay = null as number | null;
    for (let d = 0; d < r.dailyCleared.length; d++) {
      cum += r.dailyCleared[d];
      if (cum >= 60) { breakDay = d + 1; break; }
    }
    expect(breakDay).not.toBeNull();
    expect(breakDay!).toBeGreaterThanOrEqual(7);
    expect(breakDay!).toBeLessThanOrEqual(10);
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

describe('S7 经济尺 · 校准基线全绿（带判定·不钉具体天数）', () => {
  it('四档验收全过：毕业带±10%/首周/档位顺序/守恒/全档≤7硬顶/新手零墙/肝墙矩阵带', () => {
    // 为什么对：这是任务单③交付态的机器判定本体——checkCalibration 内部全部是
    // "带"（±10%、35-40%、矩阵带、硬顶），调参期天数漂移不会误报，破带才报。
    expect(checkCalibration(std)).toEqual([]);
  });

  it('黑市党验收全过：毕业 D22-25 带 + 硬顶 + 新手零墙 + 计数账本恒等', () => {
    expect(checkBlackMarket(std[BM_TARGET.tier].expected)).toEqual([]);
  });

  it('肝墙矩阵带与硬顶常量未被放宽（守门自检）', () => {
    // 为什么对：防"为绿而绿"改带——n060 带 [0,2] 是 v0.1 病灶探测器（当时漂到 5），
    // 硬顶 7=Ron 锁定决策；这两个数字被改宽 gate 必须先红。
    expect(WALL_MATRIX_BANDS[60]).toEqual([0, 2]);
    expect(HARD_WALL_CAP).toBe(7);
  });
});

describe('S7 经济尺 · 黑市（S13.6 入模 · 任务单③验收三条）', () => {
  const bm = std[BM_TARGET.tier].expected;

  it('黑市党毕业落 D22-25 带内', () => {
    expect(bm.graduateDay).not.toBeNull();
    expect(bm.graduateDay!).toBeGreaterThanOrEqual(BM_TARGET.min);
    expect(bm.graduateDay!).toBeLessThanOrEqual(BM_TARGET.max);
  });

  it('计数账本守恒：赚−花=余、总量 ≤ 毕业天数×日上限30、余额非负', () => {
    // 为什么对：计数是"第 15 种资源"但不进 14 键钱包（钱包键被下方测试钉死+本子步
    // 零回写运行时），所以单独立账本+单独守恒；日上限 30 是 S13.6 三道闸①。
    expect(bm.bm.earnedTotal - bm.bm.spent).toBeCloseTo(bm.bm.balance, 9);
    expect(bm.bm.balance).toBeGreaterThanOrEqual(0);
    expect(bm.bm.earnedTotal).toBeLessThanOrEqual((bm.graduateDay ?? PARAMS.maxDays) * PARAMS.blackMarket.dailyViewCap);
    expect(bm.bm.spent).toBeGreaterThan(0); // 黑市党必须真的在买（不是空转的画像）
  });

  it('四档基线不变性：黑市党关掉黑市行为 === 肝档逐字段严格相等（验收第二条）', () => {
    // 为什么对：第五画像的非黑市参数与肝档逐项相同，dis.blackMarket 只关主动行为
    // （券/连看/购买），计数对所有画像都是纯观察者——因此两跑必须每个字段完全一致；
    // 任何不一致=黑市代码路径泄漏进了四档基线（验收红线）。
    const liver = simulateEconomyTier('肝档', pressure, {});
    const bmOff = simulateEconomyTier(BM_TARGET.tier, pressure, { disable: { blackMarket: true } });
    expect({ ...bmOff, tier: null }).toEqual({ ...liver, tier: null });
  });

  it('四档货架零接触：宝箱以外零消费、券按画像口味、轻度全零（任务单⑧重定基）', () => {
    // 为什么对（重定基·任务单⑧）：宝箱=全部看广告画像的通用日常（Ron 口径修正：受计数
    // 余额自然约束），故四档 spent 不再恒 0——但必须恰好等于宝箱支出（10×箱数=货架零接触）；
    // 券改"商店按需"（肝/重有口味、普/轻 0）；轻度零广告→计数/宝箱/券全零（红线跑法纯净）。
    for (const t of Object.keys(TARGETS)) {
      const b = std[t].expected.bm;
      expect(b.spent, `${t} 黑市支出=宝箱支出（不碰货架）`).toBeCloseTo(b.boxes * PARAMS.blackMarket.box.price, 9);
      expect(Object.keys(b.buys).filter((k) => k !== 'box'), `${t} 不应买货架商品`).toEqual([]);
    }
    expect(std['普通'].expected.bm.ticketsBought, '普通档券口味=0').toBe(0);
    expect(std['轻度'].expected.bm.earnedTotal).toBe(0);
    expect(std['轻度'].expected.bm.boxes).toBe(0);
    expect(std['轻度'].expected.bm.ticketsBought).toBe(0);
  });

  it('货架结构合规（任务单⑧）：大件 128-198、小件坑 8 品类、宝箱价 10、强星核退役', () => {
    // 为什么对：总修订案三终拍——2 大件（高阶舰 128/超新星 198=GDD 点名价）+4 小件坑
    // （8 品类·流通核 128-138 带压轴）+宝箱位（价 10 日 1）；"强星核+100 额外战力"概念
    // 退役=商品、字段、战力公式加项全清（bmExtraPower 不复存在）。
    const g = PARAMS.blackMarket.goods;
    expect(g.shipHigh.price).toBe(128);
    expect(g.supernova.price).toBe(198);
    expect((g as Record<string, unknown>).coreStrong).toBeUndefined();
    for (const item of Object.values(g)) expect((item.give as Record<string, number>).strongBonus).toBeUndefined();
    expect(PARAMS.blackMarket.box.price).toBe(10);
    const pool = PARAMS.blackMarket.smalls.pool;
    expect(Object.keys(pool).length).toBe(8);
    expect(pool.flowCore.price).toBeGreaterThanOrEqual(128);
    expect(pool.flowCore.price).toBeLessThanOrEqual(138);
    expect((std['黑市党'].expected as unknown as Record<string, unknown>).bmExtraPower).toBeUndefined();
    // 补给券/星空宝石不进小件池（守铁律：抽卡唯一阀门/宝库黑市分工）
    for (const item of Object.values(pool)) {
      expect((item.give as Record<string, number>).supplyTicket).toBeUndefined();
      expect((item.give as Record<string, number>).starGem).toBeUndefined();
    }
  });
});

describe('S7 经济尺 · 参与度真分层（任务单⑤·结构三件+质量分层）', () => {
  it('张数决策纯函数：预算/意愿/时间/积压四约束按画像分层（任务单⑧重定基 3 张制）', () => {
    // 为什么对（各值逐一手核·⑧张数 4→3 重定基）：轻度预算 3 分钟→floor(3/1.2)=2 张
    //（15 分钟玩家掐表打卡）；轻度真墙日预算×2→floor(6/1.2)=5，被意愿 3×0.88+恶补0=2.64
    // 封顶（期望值口径不取整）；肝档积压>3 → 意愿 3+3=6（回来清板·预算 floor(10/1.2)=8
    // 兜得住）；肝档积压 3 时不触发恶补=min(3,…)=3；普通 3×0.92+1=3.76＜预算
    // floor(6/1.2)=5；重度 3+2=5＜floor(8/1.2)=6；剩余分钟 floor(2.5/1.2)=2 仍兜底；零积压=0。
    expect(bountyCardsFor(TIERS['轻度'], 12, 10, false)).toBe(2);
    expect(bountyCardsFor(TIERS['轻度'], 12, 10, true)).toBeCloseTo(2.64, 9);
    expect(bountyCardsFor(TIERS['肝档'], 12, 100, false)).toBe(6);
    expect(bountyCardsFor(TIERS['肝档'], 3, 100, false)).toBe(3);
    expect(bountyCardsFor(TIERS['普通'], 12, 100, false)).toBeCloseTo(3.76, 9);
    expect(bountyCardsFor(TIERS['重度'], 12, 100, false)).toBe(5);
    expect(bountyCardsFor(TIERS['普通'], 12, 2.5, false)).toBe(2);
    expect(bountyCardsFor(TIERS['轻度'], 0, 10, false)).toBe(0);
  });

  it('全程实跑分层：轻度 <2.6 张/日，其余档 ≈3 张/日（张数分层在底部咬合·⑧重定基）', () => {
    // 为什么对（⑧张数 4→3 重定基·实测 肝/重/普 3.00、轻 2.22）：3 张制下张数分层带
    // 整体下移且档差绝对值变窄（0.78 张/日）——这是设计有意的（张数轴让位难度轴），
    // 底部咬合仍在：轻度预算掐死 ≈2.2、其余打满 3.0；肝/重对普通的顶端分层改走
    // 难度试探（bountyProbe·pickCommissionDifficulty）+打法质量（bountyPerfect），
    // 与木桩压榨（drillSkill）三轴——张数不再是唯一分层轴是⑧的结构本意。
    const avg = (t: string) => std[t].expected.bountyCards / std[t].expected.graduateDay!;
    expect(avg('轻度')).toBeLessThan(2.6);
    for (const t of ['肝档', '重度', '普通']) expect(avg(t), `${t} 张/日`).toBeGreaterThanOrEqual(2.85);
    expect(avg('普通') - avg('轻度')).toBeGreaterThan(0.5);
  });

  it('打法质量分层：完美通关率 肝>重>普>轻、黑市党=肝档（顶端参与度轴）', () => {
    // 为什么对：张数在 4 张/日发卡封顶后，打法质量（S10.8 完美通关 ×1.25 的达成率）是
    // 悬赏板剩下的参与度轴——B1 后军饷第一源必须自带档差，不能全靠打捞背（salvage×0.8
    // 扰动曾把肝/重顶出天数带·任务单⑤实测教训）；黑市党非黑市参数=肝档是基线不变性前提。
    expect(TIERS['肝档'].bountyPerfect).toBeGreaterThan(TIERS['重度'].bountyPerfect);
    expect(TIERS['重度'].bountyPerfect).toBeGreaterThan(TIERS['普通'].bountyPerfect);
    expect(TIERS['普通'].bountyPerfect).toBeGreaterThan(TIERS['轻度'].bountyPerfect);
    expect(TIERS['黑市党'].bountyPerfect).toBe(TIERS['肝档'].bountyPerfect);
  });

  it('发卡=每登录日 +3（S10.8 任务单⑧委托制）：实打张数 ≤ 3×活跃天（停玩天不发卡）', () => {
    // 为什么对：S10.8 重构"每登录日 +3、超上限掉最旧"（张数 4→3 随委托制）——停玩天不发卡
    // 的门控沿任务单⑤修正（修正前停玩=攒卡银行凭空多打）；不变量挂 TRUTHS.bountyDailyCards
    // 自动随真源，回退发卡门控时必红，且对毕业日漂移稳健（不钉具体张数）。
    const paused = simulateEconomyTier('肝档', pressure, { pause: { from: 10, days: 2 } });
    expect(paused.bountyCards).toBeLessThanOrEqual(TRUTHS.bountyDailyCards * (paused.graduateDay! - 2) + 1e-6);
    const base = std['肝档'].expected;
    expect(base.bountyCards).toBeLessThanOrEqual(TRUTHS.bountyDailyCards * base.graduateDay! + 1e-6);
  });

  it('B1 军饷身份进 gate 且检查是活的：两币各自第一单源带内 + 清零必报身份错（⑧作战大厅口径）', () => {
    // 为什么对（⑧重定基）：演习记录随木桩剥离，"悬赏 40-55%"护栏按作战大厅渠道继承——
    // 合金第一单源=护航委托、记录第一单源=演习木桩，各 40-55%；主线 ≤10% 两币对称继承
    //（Ron 2026-07-07 口径确认）。活性检查两条腿分别验：清零委托→合金身份错、清零木桩
    // →记录身份错，防"检查本体被删/绕过"。
    for (const [key, src] of [['hullAlloy', 'bounty'], ['pilotToken', 'drill']] as const) {
      const s = incomeShares(std['普通'].expected, key);
      expect(s[src], `${key} 第一单源份额`).toBeGreaterThanOrEqual(40);
      expect(s[src], `${key} 第一单源份额`).toBeLessThanOrEqual(55);
      expect(s.mainline, `${key} 主线份额`).toBeLessThanOrEqual(10);
      expect(s[src]).toBeGreaterThan(Math.max(s.offline, s.patrol));
    }
    const doctored = structuredClone(std);
    doctored['普通'].expected.ledger.income.bounty = { hullAlloy: 0 };
    expect(checkCalibration(doctored).some((e) => e.includes('B1 身份') && e.includes('hullAlloy'))).toBe(true);
    const doctored2 = structuredClone(std);
    doctored2['普通'].expected.ledger.income.drill = { pilotToken: 0 };
    expect(checkCalibration(doctored2).some((e) => e.includes('B1 身份') && e.includes('pilotToken'))).toBe(true);
  });

  it('板凳折算：零池为零、随池单调、cap 封顶，cap 处在"小乘区"量级（≤3%）', () => {
    // 为什么对：benchPct=cap×(1−e^(−pool/scale)) 的数学性质；cap 0.03 是任务单⑤实测
    // 上限——0.035 起板凳把普通档抬快→压力表校贵→salvage×0.8 扰动下肝/重被顶出带
    //（抗漂移护栏红），故 cap 被改大 gate 必须先红。
    expect(benchEffPct(0)).toBe(0);
    expect(benchEffPct(1000)).toBeGreaterThan(0);
    expect(benchEffPct(6000)).toBeGreaterThan(benchEffPct(1000));
    expect(benchEffPct(1e9)).toBeLessThanOrEqual(PARAMS.bench.cap + 1e-12);
    expect(PARAMS.bench.cap).toBeLessThanOrEqual(0.03);
  });

  it('板凳方向诚实：关掉板凳（cap=0）→ 同压力表下毕业不早于开板凳', () => {
    // 为什么对：板凳只加有效战力不加收入，关掉后同一压力表下只能更慢或持平
    //（实测 普通 D48 vs D46）——若关掉反而变快=板凳在别处漏了负效果，尺子不诚实。
    const P0 = structuredClone(PARAMS);
    P0.bench.cap = 0;
    const off = simulateEconomyTier('普通', pressure, {}, P0);
    expect(off.graduateDay!).toBeGreaterThanOrEqual(std['普通'].expected.graduateDay!);
  });

  it('黑市党带收回严格口径 D22-25（板凳治饱和假象后步3 的 26 上沿收回）', () => {
    // 为什么对：步3 把上沿松到 26 的唯一理由是"五主力 SS 顶满后大件碎片无处去"的模型
    // 饱和假象；板凳深度入模后满阶溢出碎片继续产边际价值、假象病根已治，Ron 认可的
    // 原始口径 D22-25 恢复（实测黑市党 D24 带内、主力终态 4/5 艘 T4）。
    expect(BM_TARGET.max).toBe(25);
    expect(BM_TARGET.min).toBe(22);
  });
});

describe('S7 经济尺 · 抗漂移回归护栏（任务单③硬规格 #2 · 测校准器自愈）', () => {
  // 为什么对：护栏跑的是"扰动参数 → 全流程重校准 → 变体承诺验收"，判定项=四档带±10%
  // （整天容差）/档位顺序/新手零墙/守恒/肝重普硬顶≤7/轻度瞬时≤9/肝墙矩阵 DRIFT 带
  // （n060 收紧 [0,2]=v0.1 病灶探测器）；放宽差异全部有实测依据并记档于工具注释。
  for (const v of DRIFT_VARIANTS) {
    it(`${v.source}×${v.mult}：重校后四档带/肝墙矩阵/硬顶承诺全过`, () => {
      expect(runDriftVariant(v.source, v.mult).errors).toEqual([]);
    });
  }

  it('指定反例 treasure×2（中后期变富·v0.1 病灶场景）：重校后肝墙不再漂', () => {
    // 为什么对：v0.1 的病=行动宝藏入模让中后期变富 → 单γ全曲线下调 → 肝档 n060 墙
    // 4→5 破口径；双锚改造后同款扰动加倍（treasure×2）重校，肝墙必须稳在带内——
    // 这是任务单③点名的"双锚改造直接对抗验证"，永久回归测试。
    const r = runDriftVariant('treasure', 2);
    expect(r.errors).toEqual([]);
    expect(r.liverWalls[60]).toBeLessThanOrEqual(2);
  });
});

describe('S7 经济尺 · 机制冒烟（不断言具体毕业天数）', () => {
  it('四档都能在 maxDays 内毕业、档位顺序 肝<重<普<轻、黑市党快于肝档', () => {
    const days = (['肝档', '重度', '普通', '轻度'] as const).map(
      (t) => std[t].expected.graduateDay ?? Infinity,
    );
    for (const d of days) expect(d).toBeLessThanOrEqual(PARAMS.maxDays);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1]);
    expect(std[BM_TARGET.tier].expected.graduateDay!).toBeLessThan(days[0]);
  });

  it('陨星弹在 n030 首通发放、深空回廊随之解锁（核数 ≥1）', () => {
    const r = std['普通'].expected;
    expect(r.coresOwned).toBeGreaterThanOrEqual(1);
    expect(r.corridorLayer).toBeGreaterThan(0);
  });

  it('20 抽保底口径存在（gachaPity=20）·钱包 14 键与存档真源一致（黑市计数不入钱包）', () => {
    expect(TRUTHS.gachaPity).toBe(20);
    expect(RESOURCE_KEYS).toEqual([
      'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
      'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
      'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket',
    ]);
  });
});

describe('S7 经济尺 · 任务单⑧ 护航委托（3 张明保底 + 难度四档自选）', () => {
  it('真源常量：3 张/日、每 3 天 1 金、每天 ≥1 银（明保底替代旧金8%+暗保底）', () => {
    expect(TRUTHS.bountyDailyCards).toBe(3);
    expect(TRUTHS.bountyGoldEveryDays).toBe(3);
    expect(TRUTHS.bountySilverPerDay).toBe(1);
    expect((TRUTHS as Record<string, unknown>).bountyGoldPity, '旧暗保底常量应退役').toBeUndefined();
  });

  it('明保底品质期望：单张 金1/9 银1/3 铜5/9、期望倍率 ≈1.4222（保底=日程表零方差）', () => {
    // 为什么对：日 3 张含 1 银、每 3 天 1 金 → 单张金 (1/3)/3=1/9、银 1/3、铜=余 5/9；
    // qMult = 1/9×3 + 1/3×1.6 + 5/9×1 = 1.4222——与旧随机口径均值几乎相同（1.42），
    // 明保底改变的是方差与下限、不是均值（受控方差哲学的机器体现）。
    const q = commissionQualityEV();
    expect(q.goldPerCard).toBeCloseTo(1 / 9, 9);
    expect(q.silverPerCard).toBeCloseTo(1 / 3, 9);
    expect(q.bronzePerCard).toBeCloseTo(5 / 9, 9);
    expect(q.qMult).toBeCloseTo(1 / 9 * 3 + 1 / 3 * 1.6 + 5 / 9 * 1, 9);
  });

  it('难度选择纯函数：稳档=碾压线最高档、普/轻不试探、肝/重试探过意愿门槛、顶档收菜', () => {
    // 为什么对（合成压力表手核）：推荐战力=压力表定点 n10/n55/n98/n130=300/3000/10000/20000；
    // 战力 500：碾 1.15×300=345 → 稳档新手；普通(不试探)拿 0.7 倍率；
    // 肝档 2800：2800/3000=0.933 ≥ probeMinRatio 0.9、胜率 (0.933−0.55)/0.6=0.639 ≥
    // 1−0.6=0.4 意愿门槛 → 试探普通档；轻度同战力不试探（bountyProbe=false）；
    // 肝档 23000 ≥ 1.15×20000 → 稳档噩梦（顶档无可试探=后期收菜）。
    const pr: number[] = new Array(151).fill(0);
    pr[10] = 300; pr[55] = 3000; pr[98] = 10000; pr[130] = 20000;
    const D = PARAMS.bounty.difficulty;
    const low = pickCommissionDifficulty(TIERS['普通'], 500, pr);
    expect(low.safe).toBe('novice');
    expect(low.safeMult).toBe(D.mults.novice);
    expect(low.probe).toBeNull();
    const liver = pickCommissionDifficulty(TIERS['肝档'], 2800, pr);
    expect(liver.probe).toBe('normal');
    expect(liver.pWin).toBeCloseTo((2800 / 3000 - D.failFloor) / (D.crushRatio - D.failFloor), 9);
    const light = pickCommissionDifficulty(TIERS['轻度'], 2800, pr);
    expect(light.probe).toBeNull();
    const top = pickCommissionDifficulty(TIERS['肝档'], 23000, pr);
    expect(top.safe).toBe('nightmare');
    expect(top.probe).toBeNull();
    // 试探胜率边界：ratio≤failFloor 必败、≥crushRatio 满胜（意愿门槛外仍可核曲线）
    const edge = pickCommissionDifficulty(TIERS['肝档'], 3450, pr); // =1.15×3000 → 稳档普通
    expect(edge.safe).toBe('normal');
  });

  it('难度倍率单调且"难度越高奖励越多"（新手<普通<困难<噩梦）', () => {
    const m = PARAMS.bounty.difficulty.mults;
    expect(m.novice).toBeLessThan(m.normal);
    expect(m.normal).toBeLessThan(m.hard);
    expect(m.hard).toBeLessThan(m.nightmare);
  });
});

describe('S7 经济尺 · 任务单⑧ 演习木桩（档位函数·记录第一单源）', () => {
  it('档位表 15-20 档内、阈值等比、战力→档位单调、覆盖新手到毕业', () => {
    // 为什么对：GDD S10.8"进度条分 15-20 档"（取 20=结构修正记档：18 档时顶部档距 30%
    // 全档终局零跨档）；阈值=8k×1.2577^k：战力 333(dmg 8k)→1 档、500→2 档、
    // 顶档 ≈ 战力 26k（毕业段真实可达·d=0.40 换算）。
    const D = PARAMS.drill;
    expect(D.tiers).toBeGreaterThanOrEqual(15);
    expect(D.tiers).toBeLessThanOrEqual(20);
    expect(D.dps).toBe(0.40); // ⑥细表 §9 量纲合同
    expect(drillTierFor(100, 1)).toBe(0);
    expect(drillTierFor(334, 1)).toBe(1);
    expect(drillTierFor(500, 1)).toBe(2);
    let prev = 0;
    for (const w of [500, 1000, 3000, 8000, 15000, 22000, 26100]) {
      const k = drillTierFor(w, 1);
      expect(k, `战力 ${w} 档位应单调`).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(drillTierFor(26100, 1)).toBe(D.tiers); // 毕业段摸到顶档
    expect(drillTierFor(22000, 1.08), '压榨系数=会玩差应能多跨档').toBeGreaterThanOrEqual(drillTierFor(22000, 0.95));
  });

  it('累计奖励：cum(0)=0、随档严格递增、复现老演习弧（档7≈1050/档20≈11000 带）', () => {
    expect(drillCumReward(0)).toBe(0);
    for (let k = 1; k <= PARAMS.drill.tiers; k++) {
      expect(drillCumReward(k)).toBeGreaterThan(drillCumReward(k - 1));
    }
    expect(drillCumReward(7)).toBeGreaterThan(900);
    expect(drillCumReward(7)).toBeLessThan(1250);
    expect(drillCumReward(20)).toBeGreaterThan(9500);
    expect(drillCumReward(20)).toBeLessThan(12500);
  });

  it('实跑：木桩=记录第一单源（checkCalibration 覆盖）+ 无星域系数（档位表即进度缩放）', () => {
    // 为什么对：drill 源只发 pilotToken；若有人给木桩挂 offCoef 会双重缩放（档位随战力
    // 已含进度），此测钉"份额来自 drill 源"+日收入=cum(档)×完成率×参与率的期望值语义。
    const r = std['普通'].expected;
    const s = incomeShares(r, 'pilotToken');
    expect(s.drill).toBeGreaterThan(Math.max(s.offline, s.patrol, s.mainline));
    expect(r.drillTier).toBeGreaterThanOrEqual(15); // 毕业时点应在高档区
  });
});

describe('S7 经济尺 · 任务单⑧ 星核渠道矩阵（开蛋/宝库两层/毕业核时点）', () => {
  it('开蛋收藏期望：零抽=只陨星弹、随抽数单调、封顶 16、强常规=低权重头奖', () => {
    const mk = (egg: number, cleared = 30) => ({
      cleared,
      coreDraws: { egg, treasure: 0, bmFlow: 0, shopFlow: 0, vaultFlow: 0, vaultDupes: 0 },
      gradCores: { vault: 0, bm: 0, treasureEV: 0 },
    });
    expect(expectedDistinctCores(mk(0, 0))).toBe(0);
    expect(expectedDistinctCores(mk(0))).toBe(1); // 首Boss 后=陨星弹
    let prev = 0;
    for (const n of [1, 3, 8, 20, 60]) {
      const d = expectedDistinctCores(mk(n));
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
    expect(expectedDistinctCores(mk(10000))).toBeLessThanOrEqual(16);
    expect(PARAMS.core.eggStrongWeight * 2, '2 颗强常规合计权重=低权重头奖').toBeLessThan(0.15);
  });

  it('宝库两层价：8 流通统一价、毕业核更贵但不悬殊（≤2.5×）、同款复购 ×1.5 递增沿用', () => {
    expect(PARAMS.core.vaultGradPrice).toBeGreaterThan(PARAMS.core.vaultFlowPrice);
    expect(PARAMS.core.vaultGradPrice / PARAMS.core.vaultFlowPrice).toBeLessThanOrEqual(2.5);
    expect(TRUTHS.vaultRepeatPriceGrowth).toBe(1.5);
  });

  it('毕业核到手时点分布（新验收口径）：肝/重/普 期望线毕业前 ≥1 颗、时点落中后期窗', () => {
    // 为什么对：⑧验收口径改"不锁核数——验 常规核心跳+毕业核到手时点分布+欧非带"；
    // 期望线=宝库攒宝石（5 槽满后转攒 200）——实测 肝 D15/重 D28/普 D23 首颗，全部落
    // [0.35G, G] 中后期窗（毕业前拿到=对毕业墙有用；不过早=不冲烂常规核策略期）。
    for (const t of ['肝档', '重度', '普通'] as const) {
      const r = std[t].expected;
      expect(r.gradCoreDays.length, `${t} 毕业前应有毕业核`).toBeGreaterThanOrEqual(1);
      expect(r.gradCoreDays[0]).toBeGreaterThanOrEqual(Math.floor(r.graduateDay! * 0.35));
      expect(r.gradCoreDays[0]).toBeLessThanOrEqual(r.graduateDay!);
    }
    // 欧线：扩张宝藏曲率星门低概率（coreLuck 包络轴）——期望跑有小数 EV、欧跑放大、非跑=0
    const lucky = simulateEconomyTier('普通', pressure, { envelope: 'lucky' });
    const unlucky = simulateEconomyTier('普通', pressure, { envelope: 'unlucky' });
    expect(lucky.gradCores.treasureEV).toBeGreaterThan(std['普通'].expected.gradCores.treasureEV);
    expect(unlucky.gradCores.treasureEV).toBe(0);
  });

  it('常规核心跳节奏：普通档中后期 2.5-5 天/颗带内（B4 稀缺线口径沿用）', () => {
    const r = std['普通'].expected;
    const mid = r.coreDays.filter((d: number) => d >= r.graduateDay! * 0.4);
    const gaps: number[] = [];
    for (let i = 1; i < mid.length; i++) gaps.push(mid[i] - mid[i - 1]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeGreaterThanOrEqual(2.0);
    expect(avg).toBeLessThanOrEqual(5.0);
  });
});

describe('S7 经济尺 · 任务单⑧ 黑市宝箱（计数余额约束）与广告券新规', () => {
  it('宝箱频率=计数收入的自然结果：肝≈每日、重≈2/3、普≈5天一箱、轻=0（Ron 口径）', () => {
    // 为什么对：宝箱必买但受"余额 ≥10"约束——肝 9-10 计数/日≈日日开、重 6/日≈2/3 频率、
    // 普 2/日≈5 天攒一箱、轻 0 广告=永远开不起；不变量=箱数 ≤ 计数总收入/箱价。
    const per = (t: string) => std[t].expected.bm.boxes / std[t].expected.graduateDay!;
    expect(per('肝档')).toBeGreaterThan(0.7);
    expect(per('重度')).toBeGreaterThan(0.5);
    expect(per('重度')).toBeLessThan(per('肝档'));
    expect(per('普通')).toBeGreaterThan(0.1);
    expect(per('普通')).toBeLessThan(0.3);
    expect(std['轻度'].expected.bm.boxes).toBe(0);
    for (const t of [...Object.keys(TARGETS), BM_TARGET.tier]) {
      const b = std[t].expected.bm;
      expect(b.boxes * PARAMS.blackMarket.box.price, `${t} 箱支出 ≤ 计数收入`).toBeLessThanOrEqual(b.earnedTotal + 1e-9);
    }
  });

  it('宝箱期望回报＞箱价（跨币种保守折算 ≥10 计数当量）+ 毕业核极低概率 <1%', () => {
    // 为什么对（保守折算表·只计四大硬通货）：专属碎片按黑市小件比价 130 碎片=40 计数
    // →0.3077 计数/碎片；通用碎片同比价 60=32 → 0.533/枚；核碎按小件 15=35 → 2.33/枚；
    // 传奇插件按小件 2=45 → 22.5/件；优秀 2=30 → 15/件——其余（军饷/星贝/信标/宝石）
    // 一律记 0，折算下限仍须 ≥ 箱价=期望回报＞箱价的机器化（Ron"普惠稳赚"）。
    const g = PARAMS.blackMarket.box.give;
    const lower = g.mainShards * (40 / 130) + g.universal * (32 / 60)
      + g.coreFrag * (35 / 15) + g.legendaryPlugin * 22.5 + g.superiorPlugin * 15;
    expect(lower).toBeGreaterThanOrEqual(PARAMS.blackMarket.box.price);
    expect(PARAMS.blackMarket.box.gradCoreP).toBeLessThan(0.01);
    expect(PARAMS.blackMarket.box.gradCoreP).toBeGreaterThan(0);
  });

  it('黑市解锁=n060 首通（Ron 拍板）·黑市党大件=舰包优先、毕业前不买超新星/流通核（记档）', () => {
    expect(PARAMS.blackMarket.unlockNode).toBe(60);
    const bmRun = std[BM_TARGET.tier].expected;
    expect(bmRun.bm.buys.shipHigh).toBeGreaterThanOrEqual(2);
    expect(bmRun.bm.buys.supernova ?? 0, '毕业前超新星 0 购=舰包边际碾压的如实结果').toBe(0);
    expect(bmRun.bm.buys.flowCore ?? 0).toBe(0);
    expect(bmRun.bm.buys.box).toBeGreaterThan(10);
  });

  it('广告券新规：肝/重按需购券（>0）、观看总量=免费+券有上界、轻度纯零广告', () => {
    // 为什么对：券不限购但画像有口味上限（adTickets 肝4/重2/普0/轻0·黑市党+2）；
    // 观看总量 ≤ (免费口味+券口味)×毕业日=结构上界；轻度全链路零（红线跑法纯净）。
    expect(std['肝档'].expected.bm.ticketsBought).toBeGreaterThan(0);
    for (const t of ['肝档', '重度'] as const) {
      const r = std[t].expected;
      const cap = (TIERS[t].adsPerDay + TIERS[t].adTickets) * r.graduateDay!;
      expect(r.adsUsedTotal, `${t} 观看总量上界`).toBeLessThanOrEqual(cap + 1e-9);
    }
    expect(std['轻度'].expected.adsUsedTotal).toBe(0);
  });

  it('福利广告铁顶（#6 赞助券）：券不可恢复→补给券广告收入 ≤ 10×毕业日', () => {
    // 为什么对：#6=福利广告每日 1 次铁顶（10 券/次）；若券恢复漏进 #6，收入会超
    // 10×天数上界——此不变量对"WELFARE 集合被删/绕过"敏感（肝档券 >0 且有富余动机）。
    for (const t of ['肝档', '重度', '黑市党'] as const) {
      const r = std[t].expected;
      const sponsor = (r.ledger.income.adTickets as Record<string, number> | undefined)?.supplyTicket ?? 0;
      expect(sponsor, `${t} #6 铁顶`).toBeLessThanOrEqual(PARAMS.ads.ticketPerAd * r.graduateDay! + 1e-9);
    }
  });
});

describe('S7 经济尺 · 任务单⑧ 逐关养成态导出口（⑥第三段接口）', () => {
  it('普通档 milestones=150 条、节点升序、字段完备（5 主力四元组/插件/核/战力>0）', () => {
    const r = std['普通'].expected;
    expect(r.milestones.length).toBe(150);
    for (let i = 0; i < r.milestones.length; i++) {
      const m = r.milestones[i];
      expect(m.node).toBe(i + 1);
      expect(m.power).toBeGreaterThan(0);
      expect(m.mains.length).toBe(5);
      for (const u of m.mains) expect(u.length).toBe(4);
      expect(m.cores).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(m.day).toBeGreaterThanOrEqual(r.milestones[i - 1].day);
    }
    // 教程段交叉验证（模型真实承诺·粒度记档）：n030 开打时主力1 ≥A 阶（压力 628 可过），
    // S 阶在 n040 前落位——模型 D2 即打首Boss、3天行动宝藏 D3 才到，与 GDD-M"首Boss前
    // 刚好 1 艘 S"差半步是事件时序粒度（§18 记档·挂第二段与行动宝藏助力验收一并校）。
    const n30 = r.milestones[29];
    expect(Math.max(...n30.mains.map((u: number[]) => u[0]))).toBeGreaterThanOrEqual(2);
    const n40 = r.milestones[39];
    expect(Math.max(...n40.mains.map((u: number[]) => u[0]))).toBeGreaterThanOrEqual(3);
  });
});
