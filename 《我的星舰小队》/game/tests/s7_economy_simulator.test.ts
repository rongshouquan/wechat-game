// 第三块①「造尺子」→ 第三块③「形状靶v2+双锚+黑市」gate 测试（任务单③硬规格 #6 如实重定基）。
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

  it('四档画像不碰黑市：计数只累计不消费、无广告券购买', () => {
    for (const t of Object.keys(TARGETS)) {
      expect(std[t].expected.bm.spent, `${t} 不应有黑市消费`).toBe(0);
      expect(std[t].expected.bm.ticketsBought, `${t} 不应买广告券`).toBe(0);
    }
    // 轻度=纯无广告画像：计数也必须为 0（零广告红线的黑市侧影）
    expect(std['轻度'].expected.bm.earnedTotal).toBe(0);
  });

  it('商品表价位档合规：小 30-50 / 中 68-98 / 大 128-198（S13.6 v0 价位带）', () => {
    const g = PARAMS.blackMarket.goods;
    for (const id of ['shardPack', 'plugLegend']) expect(g[id].price).toBeGreaterThanOrEqual(30);
    for (const id of ['shardPack', 'plugLegend']) expect(g[id].price).toBeLessThanOrEqual(50);
    expect(g.coreStd.price).toBeGreaterThanOrEqual(68);
    expect(g.coreStd.price).toBeLessThanOrEqual(98);
    for (const id of ['coreStrong', 'shipHigh']) {
      expect(g[id].price).toBeGreaterThanOrEqual(128);
      expect(g[id].price).toBeLessThanOrEqual(198);
    }
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
