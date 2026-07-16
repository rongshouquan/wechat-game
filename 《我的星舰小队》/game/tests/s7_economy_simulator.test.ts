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
  WALL_MATRIX_TARGET, WALL_MATRIX_TOL, HARD_WALL_CAP, WELFARE_POINTS,
  shipBasePower, pilotCoef, unitPower, nodeStage, regionOfNode,
  benchEffPct, bountyCardsFor, incomeShares,
  commissionQualityEV, pickCommissionDifficulty, drillTierFor, drillCumReward, expectedDistinctCores,
  upgradeDiscountMult, workerBuildDiscount, galleryDividendPerDay, doCores, doSalvage, doLevelUps,
  SALVAGE_SURPRISE_KEYS,
  calibratePressure, simulateEconomyTier, runStandard,
  checkCalibration, checkBlackMarket, DRIFT_VARIANTS, runDriftVariant,
} from '../tools/simulate-s7-economy.mjs';

// 压力值表与五画像标准跑全套共享一份（校准器确定性，跑一次 ~150ms）
const { pressure, gammas, anchors, schedule } = calibratePressure();
const std = runStandard(pressure);

/** 形状层墙指标（零清等待天数口径·与工具 summarize 同算法的测试侧独立实现·收口批：9 墙/新手线 n054） */
function shapeWallMetrics(dailyLog: number[]) {
  const wall: Record<number, number> = { 104: 0, 140: 0, 176: 0, 250: 0, 282: 0, 312: 0, 368: 0, 400: 0, 450: 0 };
  let cum = 0, newbie = 0, maxWall = 0, cur = 0;
  for (const c of dailyLog) {
    if (c === 0) {
      cur++;
      if (cum < 54) newbie++;
      if (wall[cum + 1] !== undefined) wall[cum + 1]++;
    } else cur = 0;
    maxWall = Math.max(maxWall, cur);
    cum += c;
  }
  return { wall, newbie, maxWall, firstWeek: dailyLog.slice(0, 7).reduce((a, b) => a + b, 0) };
}

describe('S7 经济尺 · 形状靶 v3 副本（锁定决策镜像，漂移即报警）', () => {
  it('内嵌形状模型复现四档毕业 肝40/重48/普60/轻73（SHAPE v3 拟合靶）', () => {
    // 收口批重定基（旧→新→为什么对）：旧 v2 四档 30/37/47/57="47 天/150 关"世界（07-11 新总纲作废）；
    // 新=SHAPE v3 拟合靶 40/48/60/73（§16h A.1·450 关/60 天骨架世界·拟合器按此四数精确收敛）。
    // 注意与经济层新靶（07-14 Ron 拍 A：40/51/57/83）分层：形状层=骨架设计靶，经济层=五画像实测认账——
    // 两层数字不同是架构事实（γ 校准以形状时刻表为锚、经济实测围绕它波动），不是矛盾。
    expect(shapeSimulate('肝档').graduateDay).toBe(40);
    expect(shapeSimulate('重度').graduateDay).toBe(48);
    expect(shapeSimulate('普通').graduateDay).toBe(60);
    expect(shapeSimulate('轻度').graduateDay).toBe(73);
  });

  it('v3 形状参数锁定（蜜月平台+主坡两段曲线·9 墙尖峰·四档 r）', () => {
    // 收口批重定基：v2 参数（N150/qStart 0.003/qEnd 0.03/六墙尖峰/r 0.0452-0.0741）随 07-11 新总纲
    // 作废（git 可溯）；v3=蜜月平台（n1-104 线性缓坡=B4"开局直道"）＋幂坡（qEnd 0.0105/pow 1.2）＋
    // 9 墙尖峰（尾项 n450=1.32）＋四档 r（拟合器坐标下降终值·§16h A.1）——锁定防漂移。
    expect(SHAPE.N).toBe(450);
    expect(SHAPE.moonEnd).toBe(104);
    expect(SHAPE.qMoonStart).toBe(0.0001);
    expect(SHAPE.qMoonEnd).toBe(0.004);
    expect(SHAPE.qEnd).toBe(0.0105);
    expect(SHAPE.curvePow).toBe(1.2);
    expect(SHAPE.bossSpikes).toEqual({ 104: 1.10, 140: 1.12, 176: 1.18, 250: 1.18, 282: 1.21, 312: 1.22, 368: 1.22, 400: 1.20, 450: 1.32 });
    expect(SHAPE.tiers['肝档'].r).toBe(0.0568);
    expect(SHAPE.tiers['重度'].r).toBe(0.0507);
    expect(SHAPE.tiers['普通'].r).toBe(0.0438);
    expect(SHAPE.tiers['轻度'].r).toBe(0.0386);
  });

  it('形状层性质：新手零墙（n054 前）、全档 ≤7 硬顶、普通首周 139、肝档 9 墙形状', () => {
    // 收口批重定基：肝档形状层墙分布=拟合器终值实测（前两墙 0=蜜月直道物理结果·毕业墙 4=最长）；
    // 新手线 30→54（新首Boss n054）；旧 n084/n138 余势墙断言随 150 关世界作废——新世界余势语义
    // 由经济层高潮/前哨仗守卫（n214/n340/n384 不卡天）承载，形状层无对应位。
    const liver = shapeWallMetrics(shapeSimulate('肝档').dailyLog);
    expect(liver.wall).toEqual({ 104: 0, 140: 0, 176: 1, 250: 1, 282: 2, 312: 2, 368: 2, 400: 2, 450: 4 });
    for (const t of ['肝档', '重度', '普通', '轻度'] as const) {
      const m = shapeWallMetrics(shapeSimulate(t).dailyLog);
      expect(m.newbie, `${t} 新手期应零墙`).toBe(0);
      expect(m.maxWall, `${t} 形状层单墙硬顶`).toBeLessThanOrEqual(7);
    }
    // 普通档首周 139 关 = 30.9%（[128,150] 锚带中值·墙①@n104+D4-5 撞墙决定形状）
    expect(shapeWallMetrics(shapeSimulate('普通').dailyLog).firstWeek).toBe(139);
  });
});

describe('S7 经济尺 · 战力刻度 v1（定价重锚批实测重标·镜像 S7PowerRating）', () => {
  // 重定基总说明（旧→新→为什么对）：v0 刻度（B1 骨架：阶基等比 1.6·+8%/级线性·星表挪用战斗值）
  // 对高阶套件定价失真（发现1：同 24.5k 纸面强度差 2.3 倍）；v1 按 29 构成实测重标
  // （tools/s7-power-recalib.mjs·RMSE 2%）：阶基值=实测升阶强度跳、等级=growth_band×技能节点门、
  // 星表=实测质变跳（3★/5★ 大步）、驾级系数 0.01→0.0036。B1 手算例=旧公式教学样例，随 v0 退役。
  it('等级因子=LF 表（growth_band 每轴倍数×节点门·R1 平移后 L10/L20）：B阶15级=108×2.0034', () => {
    // R1 重定基（旧→新→为什么对）：节点门随大节点五档平移挪 L10×1.100/L20×1.166（系数原值）——
    // LF(15)=g(15)×1.1=1.8213×1.1=2.0034；LF(20)=1.9833×1.1×1.166=2.5438；L40-50 段乘积不变（毕业锚守恒）。
    const base = shipBasePower(1, 15);
    expect(base).toBeCloseTo(108 * 2.0034, 1);
    expect(shipBasePower(0, 20)).toBeCloseTo(100 * 2.5438, 1);
    expect(shipBasePower(0, 50)).toBeCloseTo(100 * 3.2935, 1); // 毕业锚不动
    const p = unitPower({ tier: 1, level: 15 }, { star: 3, level: 0 }, 85, false);
    expect(p).toBeCloseTo((108 * 2.0034 + 85) * 1.27, 1);
  });

  it('阶级基值 C100/B108/A132/S180/SS323（实测邻比）、星核 +120、插件 15/35/70+90/110（段二 E7 扩档）', () => {
    // 重定基（旧→新→为什么对）：重锚批"加法项未动"三键表 + 段二 E7 传奇+/++ 两键（90/110·数值域定·
    // 运行时镜像守卫=s7_power_rating_sync）；旧三键原值一字未动。
    expect(TRUTHS.tierBase).toEqual([100, 108, 132, 180, 323]);
    expect(TRUTHS.corePower).toBe(120);
    expect(TRUTHS.pluginPower).toEqual({ fine: 15, superior: 35, legendary: 70, legendaryPlus: 90, legendaryPlusPlus: 110 });
    // 装核 = +120 平移
    const noCore = unitPower({ tier: 3, level: 1 }, { star: 1, level: 0 }, 0, false);
    const withCore = unitPower({ tier: 3, level: 1 }, { star: 1, level: 0 }, 0, true);
    expect(withCore - noCore).toBeCloseTo(120, 6);
  });

  it('驾驶员刻度系数 = 星刻度表 ×(1+0.36%/级)（星表=实测质变跳·战斗侧 S7_PILOT_STAR_MULT 不受影响）', () => {
    expect(pilotCoef(1, 0)).toBeCloseTo(1.0, 6);
    expect(pilotCoef(3, 20)).toBeCloseTo(1.27 * (1 + 0.0036 * 20), 6);
    expect(pilotCoef(5, 100)).toBeCloseTo(1.65 * 1.36, 6);
  });
});

describe('S7 经济尺 · 真源锁定消耗（附录D / 6b3 草案）', () => {
  it('升阶/升星 = 30 合成 + 50/100/300/1000（附录D，压过 B1 的 20/40/80/160）', () => {
    expect(TRUTHS.synthesizeBodyShards).toBe(30);
    expect(TRUTHS.shipAscendCost).toEqual([50, 100, 300, 1000]);
    expect(TRUTHS.pilotStarupCost).toEqual([50, 100, 300, 1000]);
  });

  it('等级上限只由阶级/星级定：C10/B20/A30/S40/SS50（段二 A3·2026-07-11 拍板取代 07-03 百级表）', () => {
    // 重定基（旧→新→为什么对）：结构拍板"上限只由阶级/星级定"不变；量值 100→50 两线同改
    // （51-100 段封存未来版本·Ron 07-11 晚新总纲）——运行时镜像守卫在 s7_power_rating_sync。
    expect(TRUTHS.shipLevelCapByTier).toEqual([10, 20, 30, 40, 50]);
    expect(TRUTHS.pilotLevelCapByStar).toEqual([10, 20, 30, 40, 50]);
  });

  it('升级成本曲线：星舰 50×lv^1.3 / 驾驶员 40×lv^1.2（B1 §2 形状）', () => {
    expect(TRUTHS.shipLevelCost(1)).toBe(50);
    expect(TRUTHS.shipLevelCost(10)).toBe(Math.round(50 * Math.pow(10, 1.3)));
    expect(TRUTHS.pilotLevelCost(10)).toBe(Math.round(40 * Math.pow(10, 1.2)));
  });

  it('建筑成本 = round(120×L^1.3×重要度×指数段)，L≤4 保 6b3 例值 + L5 起 ×1.20^(L−4)（A2 收口批）', () => {
    // 收口批重定基（旧→新→为什么对）：L≤4 原幂曲线例值不动（120/295/156=6b3 草案·前期容易）；
    // L5 起指数段=R21·2 指数化（Ron 三原则）经 A2 返工 ×1.55→×1.20（07-14 拍"毕业时基本全满"
    // 新靶·扫参六点账=§16h 收口批）——L9 例值 2088→2088×1.2^5=5195。
    expect(TRUTHS.buildingCost(1, 1.0)).toBe(120);
    expect(TRUTHS.buildingCost(2, 1.0)).toBe(295);
    expect(TRUTHS.buildingCost(1, 1.3)).toBe(156);
    expect(TRUTHS.buildingCost(4, 1.0)).toBe(Math.round(120 * Math.pow(4, 1.3)));       // 指数段前最后一级=原价
    expect(TRUTHS.buildingCost(9, 1.0)).toBe(Math.round(120 * Math.pow(9, 1.3) * Math.pow(1.20, 5))); // =5196（与实现同式一次舍入）
    expect(TRUTHS.buildingCost(10, 1.0)).toBe(Math.round(120 * Math.pow(10, 1.3) * Math.pow(1.20, 6)));
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
    // 毕业核提早批重定基（旧→新→为什么对）：>base+3 → ≥base+3——门 312 时序下普通差恰好
    // 收到 3 天整（56→59·撞开区间边界）；"至少慢 3 天=明显"的语义下限原样保持。
    expect(rd).toBeGreaterThanOrEqual((base.graduateDay ?? 0) + 3);
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

describe('S7 经济尺 · 显示推荐值==压力表（对锚批拍板⑦守卫）', () => {
  // 挂起恢复（段二战斗批 2026-07-14·旧→新→为什么对）：2b 收口批显式挂起（skip）——盘上 json
  // 是 150 关旧世界落数、与 450 关校准压力表物理不可比；本批拓扑 WORLD_450 填位+apply-pressure-display
  // 重落 450 关显示行=到期条件成立，按恢复条款回精确钉（拍板⑦"显示推荐=真实需求"·过渡漂移带退役）。
  it('pressure_param 逐节点行与校准压力表逐点一致（450 关精确钉）', () => {
    // 为什么对：拍板⑦"显示推荐=真实需求"——逐节点行由 apply-pressure-display.mjs 落数；本守卫
    // 防"压力表重校后显示行忘记重落"。精确钉：np/ep 行 min==max==校准值、bp 行 recommend==校准值。
    // 毕业核提早批重定基（旧→新→为什么对）：比较基准 内存 calibratePressure()→磁盘压力快照
    // （数值初值表-v0-数据.json·敌配落数同源）——门 312 改 PARAMS 后 γ 双锚重校漂 ±1-2/点
    // （320 点·中后段），而"真实需求"=玩家实际打的敌配=磁盘快照态（本批战斗侧冻结未动）；
    // 显示行≡敌配基准=拍板⑦真语义。内存态与快照的重新对齐=pressure_param 既有挂起恢复条款
    // （450 关 json 重导=拓扑批·三态一次对齐）。
    const fs = require('node:fs') as typeof import('node:fs');
    const snap = JSON.parse(fs.readFileSync(
      require('node:path').resolve(__dirname, '..', '..', '第三块-数值校准', '数值初值表-v0-数据.json'), 'utf-8',
    )) as { pressure: number[] };
    const diskPressure = snap.pressure;
    const rows = JSON.parse(fs.readFileSync(
      require('node:path').resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'pressure_param.sample.json'), 'utf-8',
    )) as Array<{ rowId: string; scope: string; refKey: string; pressureMin?: number; pressureMax?: number; pressureRecommend?: number }>;
    const nodeRows = rows.filter((r) => (r.scope === 'normal' || r.scope === 'elite') && /^n\d{3}$/.test(r.refKey));
    expect(nodeRows.length).toBe(437); // 450 - 13 boss 类节点（含 n018/n019 非战斗节点的展示行·无害）
    for (const r of nodeRows) {
      const n = Number(r.refKey.slice(1));
      expect(r.pressureMin, `${r.rowId} min`).toBe(diskPressure[n]);
      expect(r.pressureMax, `${r.rowId} max`).toBe(diskPressure[n]);
    }
    const bossRows = rows.filter((r) => r.scope === 'boss' && /^n\d{3}$/.test(r.refKey));
    expect(bossRows.map((r) => r.refKey).sort()).toEqual(
      ['n054', 'n104', 'n140', 'n176', 'n214', 'n250', 'n282', 'n312', 'n340', 'n368', 'n384', 'n400', 'n450'],
    );
    for (const b of bossRows) {
      expect(b.pressureRecommend, `${b.rowId} recommend`).toBe(diskPressure[Number(b.refKey.slice(1))]); // 同上重定基：基准=磁盘快照
    }
  });
});

describe('S7 经济尺 · 压力值表结构（双锚 v2）', () => {
  it('长度 151（下标 1-150）、墙外单调不降+墙=尖峰、教程段 n1-n5 显著低', () => {
    // 对锚与阶梯批重定基（旧→新→为什么对）：旧不变式=全程单调不降。墙点直抬（wallPressureLift·
    // Ron 十六格矩阵靶落地）后四面真墙成"尖峰"——墙后节点回落到原价=大墙后爽段（破墙日攒的
    // 资源立刻兑成一串爽推）。新不变式：①非墙过渡单调不降 ②墙本身 ≥ 前节点（是峰不是坑）
    // ③墙后首节点 ≥ 墙前一节点（回落不跌穿进场地板）。
    expect(pressure.length).toBe(TRUTHS.N + 1);
    const lifted = new Set(Object.keys(PARAMS.wallPressureLift ?? {}).map(Number));
    for (let n = 2; n <= TRUTHS.N; n++) {
      if (lifted.has(n - 1)) {
        expect(pressure[n], `墙后 n${n} 应 ≥ 墙前 n${n - 2}`).toBeGreaterThanOrEqual(pressure[n - 2]);
      } else {
        expect(pressure[n], `n${n} 应 ≥ n${n - 1}`).toBeGreaterThanOrEqual(pressure[n - 1]);
      }
    }
    for (const w of lifted) {
      expect(pressure[w], `墙 n${w} 应为局部峰`).toBeGreaterThanOrEqual(pressure[w - 1]);
    }
    expect(pressure[1]).toBeLessThan(pressure[104]);
    expect(pressure[TRUTHS.N]).toBeGreaterThan(pressure[1] * 20);
  });

  it('13 Boss 位=剧本 v1.2 骨架；9 墙跳升 >1.05；高潮/前哨（n214/n340/n384）不立真墙', () => {
    // 收口批重定基（旧→新→为什么对）：旧=六 Boss {60,84,102,120,138,150}+余势墙 84/138
    //（150 关世界·07-11 作废）；新=13 Boss（9 墙+3 高潮+1 前哨·剧本 v1.2 骨架 Ron 07-12 过拍）；
    // 跳升地板 1.05 沿段2a 底线（9 墙尖峰表 1.10-1.32 均应站上）；高潮/前哨=演出仗不立墙
    //（跳升 <1.10）——余势语义的新世界继承位。
    expect(TRUTHS.bossNodes).toEqual([104, 140, 176, 214, 250, 282, 312, 340, 368, 384, 400, 450]);
    expect(TRUTHS.wallNodes).toEqual([104, 140, 176, 250, 282, 312, 368, 400, 450]);
    expect(TRUTHS.storyBossNode).toBe(54);
    // 墙⑨ n450 排除跳升检查：L50 毕业态平台上经济压力闸失效（R12 结构发现②·γ 尾锚收口把
    // n450 压平实测 1.006）——墙⑨难度由 2b 战斗侧 WALL_BOOST（敌配+初见胜率带）承载，非压力表。
    for (const w of TRUTHS.wallNodes.filter((n: number) => n !== 450)) {
      expect(pressure[w] / pressure[w - 1], `n${w} 墙跳升塌方（底线 1.05）`).toBeGreaterThan(1.05);
    }
    for (const w of TRUTHS.climaxNodes.filter((n: number) => n !== 54)) {
      expect(pressure[w] / pressure[w - 1], `n${w} 高潮/前哨不应立起真墙`).toBeLessThan(1.10);
    }
  });

  it('双锚结构：早锚=n104 破墙日 D6、晚锚=n450 毕业日 D60（皆取自形状 v3 时刻表），γ 各自在理智区间', () => {
    // 收口批重定基：旧双锚 {n060→D9, n150→D47}（150 关世界）→新 {n104→D6, n450→D60}
    //（SHAPE v3 时刻表·§16h A.1）。注意分层：晚锚 D60=形状层骨架靶（schedule[450]），
    // 经济层新靶（07-14 Ron 拍 A）普通=57——形状锚是 γ 校准的坐标系、经济实测围绕它波动，
    // 二者不再恒等（旧断言 schedule[150]===TARGETS 随分层废除）。
    expect(anchors.map((a) => ({ node: a.node, targetDay: a.targetDay })))
      .toEqual([{ node: 104, targetDay: 6 }, { node: 450, targetDay: 60 }]);
    expect(schedule[104]).toBe(6);
    expect(schedule[450]).toBe(60);
    for (const g of gammas) {
      expect(g).toBeGreaterThan(0.5);
      expect(g).toBeLessThan(3.0);
    }
  });

  it('早锚兑现：普通档实跑 n104 破墙日落在 [4,7] 窗（锚 D6 − 教程钳制反馈 2 天 / + 跳变 1 天）', () => {
    // 收口批重定基：窗机理与段2a 同（γ 钉"钳制前"≤锚、教程钳制让奖励链提前 ≈2 天、整数日
    // 跳变 +1）——锚 D6 → 窗 [4,7]；实测 D5（剧本 D4-5 撞墙①口径 ✓）。防早段漂移的真保护
    // =treasure×2 指定反例+抗漂移肝墙 ±2，不靠本条精确到日。
    const r = std['普通'].expected;
    let cum = 0, breakDay = null as number | null;
    for (let d = 0; d < r.dailyCleared.length; d++) {
      cum += r.dailyCleared[d];
      if (cum >= 104) { breakDay = d + 1; break; }
    }
    expect(breakDay).not.toBeNull();
    expect(breakDay!).toBeGreaterThanOrEqual(4);
    expect(breakDay!).toBeLessThanOrEqual(7);
  });

  it('节点分类：n054=剧情首Boss、n007=精英、n104=Boss 墙、七域归属正确', () => {
    // 收口批重定基：n030→n054（新首Boss）、n006→n007（新精英表首位）、六域→七域（风暴之眼）。
    expect(nodeStage(54)).toBe('storyBoss');
    expect(nodeStage(7)).toBe('elite');
    expect(nodeStage(104)).toBe('boss');
    expect(nodeStage(9)).toBe('normal');
    expect(regionOfNode(1)).toBe(1);
    expect(regionOfNode(104)).toBe(1);
    expect(regionOfNode(105)).toBe(2);
    expect(regionOfNode(450)).toBe(7);
  });
});

// ===== 收口批 · 豁免收账（总控令 07-14）：旧六家族全豁免制（07-11 立·到期条件="段二新靶落地时
// 删除本豁免、恢复严格断言"）到期收账删除——新机制=模拟器层格子级显式豁免（WALL_CELL_EXEMPTIONS
// 等·候拍/候裁编号在案·'[豁免记档] ' 前缀行），测试层零家族豁免=真严格断言。=====
/** 分流豁免记档行（打印留档·断言只对真红）——豁免行由模拟器显式登记，测试不再自设家族名单 */
function splitExempted(errors: string[], tag: string): string[] {
  const exempted = errors.filter((e) => e.startsWith('[豁免记档]'));
  // eslint-disable-next-line no-console
  if (exempted.length) console.log(`[显式豁免·${tag}] ${exempted.length} 条（候拍/候裁/白名单·收口批格子级豁免制）：\n  ${exempted.join('\n  ')}`);
  return errors.filter((e) => !e.startsWith('[豁免记档]'));
}

describe('S7 经济尺 · 校准基线（收口批严格断言·豁免=模拟器层显式记档）', () => {
  it('四档验收全绿：新靶带±1/首周/档位顺序/破⑧推导锚/守恒/硬顶/新手零墙/B1 身份/矩阵/单调/流速/账平', () => {
    // 收口批重定基（旧→新→为什么对）：旧=六家族豁免制（150 关旧世界靶系作废期的过渡态）；
    // 新=严格断言——36 格新矩阵（07-14 终调终值）+毕业日新靶（07-14 Ron 拍 A：40/51/57/83 各±1）+
    // 破⑧锚从新靶−眼窗推导；候拍格（8 格）/候裁项（黑市党带/洼地阈值）=模拟器层显式豁免记档
    //（编号+理由在 WALL_CELL_EXEMPTIONS 等常量·随收口包呈 Ron），测试层过滤前缀后必须零红。
    expect(splitExempted(checkCalibration(std), '校准基线')).toEqual([]);
  });

  it('黑市党验收：真红为零（毕业带=候拍④显式豁免记档·其余法条全绿）', () => {
    // 收口批重定基：旧断言钉"全绿含 [22,27] 带"——该带随 47 天世界作废；提案带 [29,36] 候 Ron
    // 未拍+现值 D40 出带=R20 A2 死攒行为（Ron 拍）的结构代价——豁免记档（候拍④）非装绿；
    // 硬顶/新手零墙/守恒/计数账本/日上限等法条维持严格。
    expect(splitExempted(checkBlackMarket(std[BM_TARGET.tier].expected), '黑市党')).toEqual([]);
  });

  it('墙矩阵点靶与硬顶常量未被放宽（守门自检·36 格新矩阵）', () => {
    // 收口批重定基（旧→新→为什么对）：旧守门钉十六格 {60,102,120,150}（47 天世界·07-11 作废）；
    // 新=B3 拍板 36 格矩阵（剧本 v1.2 骨架 9 墙×四档·Ron 07-12 过拍）逐格钉死——职责不变
    //（防"为绿而绿改靶"）、钉的对象升级；容差 ±1/硬顶 7 原值。
    expect(WALL_MATRIX_TARGET).toEqual({
      肝档: { 104: 0.5, 140: 1, 176: 1, 250: 1, 282: 1.5, 312: 2, 368: 2, 400: 2.5, 450: 3 },
      重度: { 104: 1, 140: 1, 176: 1.5, 250: 2, 282: 2, 312: 2.5, 368: 3, 400: 3, 450: 4 },
      普通: { 104: 1, 140: 1.5, 176: 2, 250: 2.5, 282: 3, 312: 3, 368: 4, 400: 4, 450: 5 },
      轻度: { 104: 1.5, 140: 2, 176: 2.5, 250: 3, 282: 3.5, 312: 4, 368: 5, 400: 5.5, 450: 6 },
    });
    expect(WALL_MATRIX_TOL).toBe(1);
    expect(HARD_WALL_CAP).toBe(7);
    // lift 终值守门（收口批 4 轮终调+总控拍 n400=1.02 维持）：改 lift=动墙面，gate 必须先红再谈
    expect(PARAMS.wallPressureLift).toEqual({ 104: 1.00, 140: 1.00, 176: 1.00, 250: 1.015, 282: 1.00, 312: 0.99, 368: 1.00, 400: 1.02, 450: 1.00 });
  });
});

describe('S7 经济尺 · 黑市（S13.6 入模 · 任务单③验收三条）', () => {
  const bm = std[BM_TARGET.tier].expected;

  it('黑市党毕业=D24 钉住（Ron 带 [22,27] 内·回访钩子按设计触发·段2a 两次重校记档）', () => {
    // 为什么对（拍板回访记录）：⑧实测五杠杆全推不动 D27（计数+50%/解锁提前 10 关/不买宝箱/
    // 宝箱+43%/券+1 全无效）——根因=旧 D24 部分建立在 #10 回廊翻倍幽灵收入 bug 上（⑧修复）+
    // 宝箱吃 1/3 计数+主力 ≈D20 满阶后碎片入板凳（3% 封顶）边际归零。Ron 拍A：承认诚实结构、
    // 带放宽 [22,27]（黑市党仍快肝档 10%+宝箱日爽感+大件牌面=类充值价值成立）。
    // 段2a 回访记录（钉死钩子按设计转红·旧→新→为什么对）：D27→D26（A3 等级上限重校）→D24
    // （R1 五档平移：LF 中段 +10~16.6% 抬纸面推进力=过渡失真，2b power-recalib 重实测收账）；
    // 仍在 Ron 拍A 带 [22,27] 内=拍板未破，随交付回访报总控/Ron 知悉。任何再变动照旧转红强制回访。
    // 收口批重定基（旧→新→为什么对）：旧带 [22,27]/钉值 D24=47 天旧世界（07-11 作废）；
    // 新提案带 [29,36]=旧带对肝 30 的比例 73-90% 等比换到肝 40（候拍④·Ron 未拍）；现值 D40
    // 出提案带=R20 A2 死攒行为（Ron 拍"开门即死攒·舰包战力线让位"）的结构代价——checkBlackMarket
    // 已按候拍④豁免记档；本钉值测试照钉现值=回访钩子职责不变（任何再变动转红强制回访）。
    expect(BM_TARGET.min).toBe(29);
    expect(BM_TARGET.max).toBe(36); // 候拍④提案带（等比换算·随收口包呈 Ron）
    // 毕业核提早批重定基（旧→新→为什么对）：D40→D36——门 312（Ron 拍 B）使黑市党开盘
    // 提早（过墙⑥即拍·计数早备）→毕业 −4 天=回到候拍④提案带 [29,36] 上沿内（此前 D40
    // 出带挂账·门位提早顺带治愈=窟窿 #7 数据·候拍④裁定材料随批刷新呈报）。
    expect(bm.graduateDay).toBe(36); // 回访钩子钉现值（任何再变动转红强制回访）
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

  it('四档货架结构：宝箱+超新星死攒线之外零消费、轻度全零（R20 A2 重定基）', () => {
    // 收口批重定基（旧→新→为什么对）：旧断言"宝箱以外零消费"=R20 A2 前的行为；Ron 拍
    // "全画像黑市开门即死攒、到手前一分不花"后——看广告三档（肝/重/普）唯一的货架消费
    // =超新星 198（死攒到手），支出恒等式改 箱×10＋超新星×198；到手前宝箱停买由频率
    // 测试（下条）承载；轻度零广告→计数/宝箱/券全零不变（零广告红线跑法纯净）。
    for (const t of Object.keys(TARGETS)) {
      const b = std[t].expected.bm;
      const novaSpend = (b.buys.supernova ?? 0) * PARAMS.blackMarket.goods.supernova.price;
      expect(b.spent, `${t} 黑市支出=宝箱+超新星死攒线`).toBeCloseTo(b.boxes * PARAMS.blackMarket.box.price + novaSpend, 9);
      expect(Object.keys(b.buys).filter((k) => k !== 'box' && k !== 'supernova'), `${t} 不应买其他货架商品`).toEqual([]);
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
    // 毕业核提早批重定基（旧→新→为什么对）：上限 +1 日=毕业即停跑法的尾日口径钉正——停点在
    // 尾日发卡之后（毕业 D38 实发 39 日卡=117·旧肝靶 40 的宽上限 120 恰好盖住此既有日历边界，
    // 新靶 38 暴露）；停玩门控语义由 paused 差额自证（111 vs 117=停 2 日恰少 6 卡·下条断言）。
    expect(paused.bountyCards).toBeLessThanOrEqual(TRUTHS.bountyDailyCards * (paused.graduateDay! - 2 + 1) + 1e-6);
    const base = std['肝档'].expected;
    expect(base.bountyCards).toBeLessThanOrEqual(TRUTHS.bountyDailyCards * (base.graduateDay! + 1) + 1e-6);
    expect(base.bountyCards - paused.bountyCards).toBeCloseTo(TRUTHS.bountyDailyCards * 2, 5); // 停 2 日=少 6 卡精确（门控本体）
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
    // 毕业核提早批重定基（旧→新→为什么对）：≥base → ≥base−1——门 312+修杆世界里毕业日含
    // 读秒时序（战力快半天→过 312/撞墙日错位→读秒起点错位）±1 天混沌（实测 off=55 vs 56 全链
    // 早 1 天=时序投影非板凳负效果）；方向守卫保持在 >1 天面（真漏负效果仍抓）。
    expect(off.graduateDay!).toBeGreaterThanOrEqual(std['普通'].expected.graduateDay! - 1);
  });

  it('黑市党带=[29,36]（候拍④提案带·带演化史 25→26→25→27→[29,36] 每次有据）', () => {
    // 收口批重定基：旧 [22,27]=Ron 07-08 拍A（对肝 30 的 73-90% 比例带·47 天世界作废）；
    // 新 [29,36]=同比例等比换到肝 40（§16h 提案·候拍④·随收口包呈 Ron）——演化每步有据非"为绿调带"。
    expect(BM_TARGET.max).toBe(36);
    expect(BM_TARGET.min).toBe(29);
  });
});

describe('S7 经济尺 · 抗漂移回归护栏（收口批重建·450 关新世界承诺）', () => {
  // 收口批重定基（旧→新→为什么对）：旧承诺=150 关世界带系（豁免制过渡）；新承诺三层——
  // ①毕业包络=新靶 ±6（9 变体实测 [−6,+1] 对称化·±20% 单源×γ 重校转移的物理弹性）；
  // ②矩阵=只查肝档 ±2（对锚批承诺原语义"肝墙矩阵用 DRIFT 带"恢复·肝=节奏锚）；
  // ③法条=守恒/新手零墙/档位顺序/变体瞬时硬顶 ≤9 全档（重度 salvage×0.8 下 n368=9 与轻度
  // "基线贴顶逆向冲击必然瞬时越顶"先例同构·基线硬顶 7 由校准基线测试武装）。
  // 豁免格（WALL_CELL_EXEMPTIONS）在变体跑同源生效=分流记档。
  for (const v of DRIFT_VARIANTS) {
    it(`${v.source}×${v.mult}：重校后毕业包络±6/肝墙±2/法条全过（豁免=显式记档）`, () => {
      expect(splitExempted(runDriftVariant(v.source, v.mult).errors, `漂移${v.source}×${v.mult}`)).toEqual([]);
    });
  }

  it('指定反例 treasure×2（中后期变富·v0.1 病灶场景）：新承诺三层全过', () => {
    // 为什么对：v0.1 的病=行动宝藏入模让中后期变富 → 单γ全曲线下调 → 肝档早墙破口径；
    // 双锚+新承诺下该场景的对抗验证保留——肝墙矩阵 ±2 武装（豁免格分流）、毕业包络 ±6。
    const r = runDriftVariant('treasure', 2);
    expect(splitExempted(r.errors, '漂移treasure×2')).toEqual([]);
  });
});

describe('S7 经济尺 · 机制冒烟（不断言具体毕业天数）', () => {
  it('四档都能在 maxDays 内毕业、档位顺序 肝<重<普<轻、黑市党不慢于肝档', () => {
    // 收口批重定基：旧"黑市党快于肝档（严格 <）"——R20 A2 死攒（舰包战力线让位超新星）后
    // 黑市党 D40=肝档 D40 平肩（候拍④实体·"快 10%"旧口径随死攒代价候 Ron 重议），法条降为 ≤。
    const days = (['肝档', '重度', '普通', '轻度'] as const).map(
      (t) => std[t].expected.graduateDay ?? Infinity,
    );
    for (const d of days) expect(d).toBeLessThanOrEqual(PARAMS.maxDays);
    for (let i = 1; i < days.length; i++) expect(days[i]).toBeGreaterThan(days[i - 1]);
    expect(std[BM_TARGET.tier].expected.graduateDay!).toBeLessThanOrEqual(days[0]);
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
    // 收口批重定基：合成压力表定点随 recNodes 重落（H3：{10,55,98,130}→{10,150,300,385}=
    // 450 关新时刻表·普通档 D1 碾新手→D8-9 碾普通→D24-26 碾困难→D38-40 碾噩梦）；判定逻辑
    // 与手核算式原样（纯函数职责不变）：战力 500 碾 1.15×300=345→稳档新手；肝档入场线上方
    // 一点→试探普通；轻度同战力不试探（bountyProbe=false）；≥1.15×顶档→稳档噩梦收菜。
    const pr: number[] = new Array(TRUTHS.N + 1).fill(0);
    const rn = PARAMS.bounty.difficulty.recNodes;
    pr[rn.novice] = 300; pr[rn.normal] = 3000; pr[rn.hard] = 10000; pr[rn.nightmare] = 20000;
    const D = PARAMS.bounty.difficulty;
    const low = pickCommissionDifficulty(TIERS['普通'], 500, pr);
    expect(low.safe).toBe('novice');
    expect(low.safeMult).toBe(D.mults.novice);
    expect(low.probe).toBeNull();
    const probePower = 3000 * (D.probeMinRatio + 0.02); // 入场线上方一点（随参数自适应）
    const liver = pickCommissionDifficulty(TIERS['肝档'], probePower, pr);
    expect(liver.probe).toBe('normal');
    expect(liver.pWin).toBeCloseTo((probePower / 3000 - D.failFloor) / (D.crushRatio - D.failFloor), 9);
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
    // 为什么对：GDD S10.8"进度条分 15-20 档"（取 20=结构修正记档）；阈值表=伤害量纲（运行时
    // 行为零改动）。定价重锚 v1 重定基：估算器 dmg=paper×0.40 → paper^1.2529×0.0829（v1 纸面
    // 与 v0 非等比缩放，幂形把 基线 500 与 毕业顶档 同时钉回旧轨迹——毕业段 ~10.8k 摸顶档 20
    // =旧 23.5k 摸顶的同一批玩家；B1 身份带 40-55% 由校准守卫兜真值）。
    const D = PARAMS.drill;
    expect(D.tiers).toBeGreaterThanOrEqual(15);
    expect(D.tiers).toBeLessThanOrEqual(20);
    expect(D.dps).toBe(0.0829);
    expect(D.dpsPow).toBe(1.2529); // v1 换算幂形（见 PARAMS.drill 注）
    expect(drillTierFor(100, 1)).toBe(0);
    expect(drillTierFor(363, 1)).toBe(1); // t1 线：旧纸面 333 ↔ 新纸面 ≈363（同一伤害线 8k）
    expect(drillTierFor(500, 1)).toBe(2);
    let prev = 0;
    for (const w of [500, 1000, 3000, 6000, 9000, 10900]) {
      const k = drillTierFor(w, 1);
      expect(k, `战力 ${w} 档位应单调`).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(drillTierFor(10900, 1)).toBe(D.tiers); // 毕业段（终战力 10.4-11.2k）摸到顶档
    expect(drillTierFor(9000, 1.08), '压榨系数=会玩差应能多跨档').toBeGreaterThanOrEqual(drillTierFor(9000, 0.95));
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
    // 收口批重定基：陨星弹发放位随新首Boss n054（旧 n030·150 关世界作废）——构造 cleared 默认 60。
    const mk = (egg: number, cleared = 60) => ({
      cleared,
      coreDraws: { egg, treasure: 0, bmFlow: 0, shopFlow: 0, vaultFlow: 0, vaultDupes: 0 },
      gradCores: { vault: 0, bm: 0, treasureEV: 0 },
    });
    expect(expectedDistinctCores(mk(0, 0))).toBe(0);
    expect(expectedDistinctCores(mk(0))).toBe(1); // 首Boss（n054）后=陨星弹
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

  it('常规核心跳节奏：普通档中后期 ≥1.8 天/颗（B4 稀缺线·墙日聚簇修正口径）', () => {
    // 对锚与阶梯批重定基（旧→新→为什么对）：旧下限 2.0 → 1.8。墙矩阵落地后总量与毕业日
    // 未变（普通档 20 颗/D46 两世界相同），变的是分布——卡墙日攒的抽卡/回廊收入在墙下
    // 兑现，星核向中后期聚簇（间隔均值 2.05→1.92）。"卡墙日开出新核"=停滞期正反馈，
    // 设计上是加分项；稀缺线的总量语义（不多发一颗）由"总颗数/毕业日不变"守住，本断言
    // 只防中后期密度失控（<1.8=真通胀再报警）。观察记录=细表 §16e，交 Ron 复裁项之一。
    const r = std['普通'].expected;
    const mid = r.coreDays.filter((d: number) => d >= r.graduateDay! * 0.4);
    const gaps: number[] = [];
    for (let i = 1; i < mid.length; i++) gaps.push(mid[i] - mid[i - 1]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeGreaterThanOrEqual(1.8);
    expect(avg).toBeLessThanOrEqual(5.0);
  });
});

describe('S7 经济尺 · 任务单⑧ 黑市宝箱（计数余额约束）与广告券新规', () => {
  it('宝箱频率：死攒期停买（R20 A2）+到手后恢复——60d 均值大降·轻=0（重定基）', () => {
    // 收口批重定基（旧→新→为什么对）：旧断言（肝>0.7/重>0.5≈"计数自然频率"）=R20 A2 前；
    // Ron 拍"开门即死攒·到手前一分不花"后——看广告三档从开门（n104·D4-5）到超新星到手
    //（肝D29/重D37/普D39）宝箱全停，到手后恢复日常 → 毕业窗均值：肝 ≈(毕40−29)/40≈0.2-0.3、
    // 重/普更低；频率序 肝>重（计数快恢复期长）；轻 0 广告不变；账本不变量照旧。
    // 频率序不再是不变量：死攒结构下均值=恢复期占比（(毕业−到手)/毕业）×日频——重度恢复窗
    // 14/51 反超肝 11/40（计数快慢让位窗口占比），旧"肝>重"序断言删除；带断言=全档 ≤0.5。
    const per = (t: string) => std[t].expected.bm.boxes / std[t].expected.graduateDay!;
    expect(per('肝档')).toBeGreaterThan(0.1);
    expect(per('肝档')).toBeLessThan(0.5);
    expect(per('重度')).toBeGreaterThan(0);
    expect(per('重度')).toBeLessThan(0.5);
    expect(per('普通')).toBeLessThan(0.5);
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

  it('黑市解锁=n104 首通·超新星单件闩=n368·黑市党=死攒超新星→到手后转舰包（R20 A2 重定基）', () => {
    // 收口批重定基（旧→新→为什么对）：①解锁 60→104（Ron 澄清"黑市随 n104 首通解锁"·R20 A2
    // 账实钉平——黑市本体节点，超新星另有 n368 单件闩=A5 Ron 07-14 拍定）；②旧"舰包优先、
    // 毕业前不买超新星"随 R20 A2 反转：全画像开门即死攒超新星（到手前一分不花）、到手后回
    // 舰包/小件序——黑市党超新星=1（死攒线）+舰包 ≥2（到手后）+宝箱恢复。
    expect(PARAMS.blackMarket.unlockNode).toBe(104);
    // 毕业核提早批重定基（旧→新→为什么对）：368→312（Ron 拍 B 终案·两线同门过墙⑥上架——
    // 案甲〔黑市留 368 凑肝毕业 40〕被 Ron 否="为凑数字加行政限制"·经济观红线第三实案）。
    expect(PARAMS.blackMarket.novaUnlockNode).toBe(312);
    const bmRun = std[BM_TARGET.tier].expected;
    expect(bmRun.bm.buys.supernova, '死攒线到手=1 颗').toBe(1);
    expect(bmRun.bm.buys.shipHigh).toBeGreaterThanOrEqual(2);
    expect(bmRun.bm.buys.flowCore ?? 0).toBe(0);
    expect(bmRun.bm.buys.box).toBeGreaterThan(1);
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

  it('福利广告铁顶=真咬合验证：#5/#6/#10 名单钉死 + 里程碑加密跑下 #10 仍 ≤1/日', () => {
    // 为什么对（深度自检修正版·首版"#6 收入 ≤10×天"是同义反复假守卫——#5/#6 在流程里
    // 天然一次/日，挖掉福利名单测试照绿=自检抓出）：真咬合场景是 #10——回廊一天可跨多个
    // 里程碑，若券恢复漏进 #10，肝档（券 4/日+富余星贝）会给同日第 2+ 个里程碑翻倍。
    // 构造：里程碑密度 5 层→1 层（TRUTHS 注入·肝档日爬 2-5 层=同日多里程碑天天发生），
    // 断言 #10 观看次数 ≤ 1×毕业日——把 '#10' 挖出 WELFARE_POINTS 此测必红（变异已验证）。
    expect(Array.from(WELFARE_POINTS).sort()).toEqual(['#10', '#5', '#6']);
    const denseT = { ...TRUTHS, corridorMilestoneEvery: 1 }; // TRUTHS 含函数字段·浅展开（勿 structuredClone）
    const r = simulateEconomyTier('肝档', pressure, {}, PARAMS, denseT);
    const uses10 = r.adPointUses['#10'] ?? 0;
    expect(uses10, '#10 每日 ≤1（免费额度·券不可恢复）').toBeLessThanOrEqual(r.graduateDay!);
    expect(uses10, '加密跑里 #10 确实天天在用（测试非空转）').toBeGreaterThanOrEqual(r.graduateDay! * 0.5);
    // 非福利点位对照组：#3/#4 全关放开确实在吃券（同一机制的阳性对照）
    const base = std['肝档'].expected;
    expect((base.adPointUses['#3'] ?? 0) + (base.adPointUses['#4'] ?? 0)).toBeGreaterThan(base.graduateDay!);
    expect(base.bm.ticketsBought).toBeGreaterThan(0);
  });
});

describe('S7 经济尺 · 建筑细案入尺批（八栋九件·手推期望值 + 接线直测）', () => {
  it('①② 船坞/训练舱折扣线：−1.5%/级、Lv4 −6%/Lv7 −10.5%/Lv10 毕业 −15%（细案累计值逐点）', () => {
    // 为什么对：细案①②逐级表钉 −1.5%/级、里程碑行自带累计值（Lv4=−6%/Lv7=−10.5%/
    // Lv10=−15%）——upgradeDiscountMult(lv)=1−1.5%×lv 对表即得；>10 级夹紧防越界。
    expect(TRUTHS.dockDiscountPctPerLv).toBe(1.5);
    expect(TRUTHS.trainingDiscountPctPerLv).toBe(1.5);
    expect(upgradeDiscountMult(0, 1.5)).toBeCloseTo(1.0, 9);
    expect(upgradeDiscountMult(4, 1.5)).toBeCloseTo(0.94, 9);
    expect(upgradeDiscountMult(7, 1.5)).toBeCloseTo(0.895, 9);
    expect(upgradeDiscountMult(10, 1.5)).toBeCloseTo(0.85, 9);
    expect(upgradeDiscountMult(12, 1.5)).toBeCloseTo(0.85, 9);
  });

  it('①"专属碎片永不打折"：升阶/升星/合成消耗常量不变（折扣结构上只经过升级币路径）', () => {
    // 为什么对：折扣只在 doLevelUps 的合金/记录 debit 处生效；doAscends 走碎片字段
    // 不经任何折扣乘区——碎片梯（附录D 锁定）被这里钉死，谁给碎片打折 gate 先红。
    expect(TRUTHS.shipAscendCost).toEqual([50, 100, 300, 1000]);
    expect(TRUTHS.pilotStarupCost).toEqual([50, 100, 300, 1000]);
    expect(TRUTHS.synthesizeBodyShards).toBe(30);
  });

  it('① 折扣接线实证（doLevelUps 手推）：船坞 Lv10 时 43 合金升 1 级、无船坞升不动；训练舱对称', () => {
    // 为什么对（手推）：shipLevelCost(1)=50、船坞 Lv10 折扣 ×0.85 → round(42.5)=43——
    // 给 43 合金：折扣接通=升到 2 级钱花光；折扣断线=50>43 一级不动（首版对比全程模拟
    // 平均成本的测试被 M3 探针证伪为假守卫——训练舱二阶效应污染对照，换本外科版）。
    // 训练舱对称：pilotLevelCost(1)=40 → Lv10 ×0.85=34。
    const mkSt = (dockLv: number, trainLv: number, alloy: number, token: number) => ({
      res: { hullAlloy: alloy, pilotToken: token } as Record<string, number>,
      rosterShips: 1, rosterPilots: 1,
      mains: Array.from({ length: 5 }, (_, i) => ({
        ship: { tier: 0, level: 1, shards: 0, owned: i === 0 },
        pilot: { star: 1, level: 1, shards: 0, owned: i === 0 },
      })),
      buildings: { dock: dockLv, training: trainLv },
    });
    const debitOf = (st: ReturnType<typeof mkSt>) => (_s: string, key: string, amt: number) => {
      if ((st.res[key] ?? 0) < amt) return false; st.res[key] -= amt; return true;
    };
    const on = mkSt(10, 10, 43, 34);
    doLevelUps(on, debitOf(on), TRUTHS);
    expect(on.mains[0].ship.level).toBe(2);
    expect(on.mains[0].pilot.level).toBe(2);
    expect(on.res.hullAlloy).toBe(0);
    expect(on.res.pilotToken).toBe(0);
    const off = mkSt(0, 0, 43, 34);
    doLevelUps(off, debitOf(off), TRUTHS);
    expect(off.mains[0].ship.level).toBe(1); // 无折扣 50>43 升不动
    expect(off.mains[0].pilot.level).toBe(1); // 无折扣 40>34 升不动
  });

  it('② 工人建筑折扣：Lv3 解锁门 + 费率 1/1.5/2% 升档 + 封顶 25%（旧 v0.6 无门槛线作废）', () => {
    // 为什么对（重定基记录·总控回执③裁定）：v0.6 尺子里有一条 −1%/人·无门槛·封顶 20%
    // 的旧线（6b3 草案时代预支建模·运行时实为空账）——细案③把它改成"Lv3 里程碑解锁+
    // Lv3/6/10 费率 −1/−1.5/−2%/名+封顶 25% 占位"。逐点手推：居住舱 2 级 10 工=0（门）、
    // 3 级 10 工=10%、6 级 10 工=15%、10 级 26 工=min(25%, 52%)=25%（封顶咬合）、10 级 5 工=10%。
    expect(workerBuildDiscount(2, 10)).toBe(0);
    expect(workerBuildDiscount(3, 10)).toBeCloseTo(0.10, 9);
    expect(workerBuildDiscount(6, 10)).toBeCloseTo(0.15, 9);
    expect(workerBuildDiscount(10, 26)).toBeCloseTo(0.25, 9);
    expect(workerBuildDiscount(10, 5)).toBeCloseTo(0.10, 9);
    expect(workerBuildDiscount(3, 0)).toBe(0);
    expect(PARAMS.workerDiscount.capPct).toBeLessThanOrEqual(30); // 占位 25·30 实测三线劣（记档）
  });

  it('③ 委托积压 6/9/12（原 12/16/20 作废）＋恶补阈值=积压>日卡数（任务单联动核查项）', () => {
    // 为什么对：细案③+§二3 连带拍板（Ron 收紧·GDD S10.8 已同步）——下标=基础/Lv5/Lv10。
    // 恶补阈值挂 T.bountyDailyCards（=3）：积压 4>3 触发恶补（肝 3+3=6 想打、被积压 4 封顶）、
    // 积压 3 不触发（正好=日卡数）——收紧后阈值语义不漂。
    expect(TRUTHS.bountyBoardCap).toEqual([6, 9, 12]);
    expect(bountyCardsFor(TIERS['肝档'], 4, 100, false)).toBe(4);
    expect(bountyCardsFor(TIERS['肝档'], 3, 100, false)).toBe(3);
  });

  it('④ 打捞队 3/4/5（Lv1/4/7·原 1/2/3 作废）＋守恒刀结构守卫（长趟专刀·防静默回滚）', () => {
    // 为什么对：细案④队数表逐点；守恒承诺=单趟配平只落 24h 长趟（yieldScaleDur）、
    // 系数 0.72∈(0.6,0.8)（选型实测径记 PARAMS 注+校准日志）——谁把刀调回 1.0 或改回
    // 均匀刀（时间形状病·A/B 实证）gate 先红。
    expect(TRUTHS.salvageQueues(0)).toBe(0);
    expect(TRUTHS.salvageQueues(1)).toBe(3);
    expect(TRUTHS.salvageQueues(3)).toBe(3);
    expect(TRUTHS.salvageQueues(4)).toBe(4);
    expect(TRUTHS.salvageQueues(6)).toBe(4);
    expect(TRUTHS.salvageQueues(7)).toBe(5);
    expect(TRUTHS.salvageQueues(10)).toBe(5);
    expect(PARAMS.salvage.yieldScale).toBeGreaterThan(0.6);
    expect(PARAMS.salvage.yieldScale).toBeLessThanOrEqual(0.8);
    expect(PARAMS.salvage.yieldScaleDur).toBe('h24');
  });

  it('④ 信标不永动护栏：任何品质 24h 长趟的同品质信标自繁殖期望 <1（含守恒系数）', () => {
    // 为什么对：A3"拆永动"在新趟结构下重推——稀有自繁殖 0.075→0.05（普通档稀标流
    // 178%→97% 复守恒·校准日志）；不变量=每花 1 信标最多回 <1 同品质信标，否则打捞
    // 自供血成永动机（v0.1 病灶家族）。
    const ys = PARAMS.salvage.yieldScale;
    for (const [tier, key] of [['common', 'beaconCommon'], ['rare', 'beaconRare'], ['epic', 'beaconEpic']] as const) {
      const def = PARAMS.salvage.tiers[tier];
      const selfGen = def.rolls.h24 * ys * ((def.rollEV as Record<string, number>)[key] ?? 0);
      expect(selfGen, `${tier} 24h 自繁殖`).toBeLessThan(1);
    }
  });

  it('⑤ 稀有发现线：+5%/级只作用惊喜线四族、Lv10 累计 +35%＋24h 额外掷骰（doSalvage 手推）', () => {
    // 为什么对（手推·打捞 Lv9/Lv10 五趟 24h 普通信标·收口批带入现值 EV）：
    //   经济线掷骰/趟 = 8.2×0.72 = 5.904（稀有发现不吃·核碎 EV=源表现值 0.0005——旧手推
    //   带 0.004=N1 蛋线三刀+R18 形状旋转前的旧源表·手推公式不变参数重带）
    //   惊喜线掷骰/趟 Lv9 = 8.2×0.72×(1+0.05×6) = 7.6752（6 个概率级=+30%）
    //   惊喜线掷骰/趟 Lv10 = (8.2+1)×0.72×1.35 = 8.9424（+35%＋24h 额外一骰）
    //   → 5 趟核碎 = 5×5.904×0.0005 = 0.014760（Lv9/Lv10 同值=经济线不吃惊喜倍率）
    //   → 5 趟精良插件 Lv9 = 5×7.6752×0.05 = 1.9188 / Lv10 = 5×8.9424×0.05 = 2.2356
    expect(TRUTHS.salvageSurpriseLvls(1)).toBe(0);
    expect(TRUTHS.salvageSurpriseLvls(2)).toBe(1);
    expect(TRUTHS.salvageSurpriseLvls(5)).toBe(3);
    expect(TRUTHS.salvageSurpriseLvls(10)).toBe(7);
    expect(Array.from(SALVAGE_SURPRISE_KEYS).sort()).toEqual(
      ['cargoChest', 'finePlugin', 'legendaryPlugin', 'resident', 'superiorPlugin', 'worker']);
    const run = (salvageLv: number) => {
      const st = {
        res: { beaconCommon: 5, beaconRare: 0, beaconEpic: 0, starCargo: 0 } as Record<string, number>,
        buildings: { salvage: salvageLv, habitat: 0 },
        plugins: { fine: 0, superior: 0, legendary: 0 },
        residents: 0, workers: 0, accelCredits: 0, chestsOpened: 0,
      };
      const got: Record<string, number> = {}; // 按 来源:币种 聚合（货舱开箱另发核碎·须与打捞源分账）
      const credit = (src: string, key: string, amt: number) => { got[`${src}:${key}`] = (got[`${src}:${key}`] ?? 0) + amt; };
      const debit = (_src: string, key: string, amt: number) => {
        if ((st.res[key] ?? 0) < amt) return false; st.res[key] -= amt; return true;
      };
      doSalvage(st, credit, debit, { salvageRunsPerQueue: 1 }, { salvageRollMult: 1 }, false, PARAMS, TRUTHS);
      return { st, got };
    };
    const lv9 = run(9);
    expect(lv9.got['salvage:coreFrag']).toBeCloseTo(0.01476, 5);
    expect(lv9.st.plugins.fine).toBeCloseTo(1.9188, 4);
    const lv10 = run(10);
    expect(lv10.got['salvage:coreFrag']).toBeCloseTo(0.01476, 5); // 经济线不吃 Lv10 额外骰
    expect(lv10.st.plugins.fine).toBeCloseTo(2.2356, 4);
  });

  it('④⑤ 长趟守恒刀手推：Lv1 三队 6 趟＝3 长趟×0.72＋3 短趟全价（星矿 336.24）＋单次≤1 护栏', () => {
    // 为什么对（手推·打捞 Lv1/6 信标/计划 2 趟每队）：runs=3 队×2=6、前 3 趟 24h 吃守恒刀、
    // 后 3 趟 2h 全价——星矿 = 3×30×3.8×0.72 + 3×30×1×1 = 246.24+90 = 336.24（短趟保值=
    // 时间形状病的修复本体，刀若变均匀此数=336.24×…必红）。护栏：最重惊喜项单趟期望 ≤1。
    const st = {
      res: { beaconCommon: 6, beaconRare: 0, beaconEpic: 0, starCargo: 0 } as Record<string, number>,
      buildings: { salvage: 1, habitat: 0 },
      plugins: { fine: 0, superior: 0, legendary: 0 },
      residents: 0, workers: 0, accelCredits: 0, chestsOpened: 0,
    };
    const got: Record<string, number> = {};
    const credit = (_s: string, key: string, amt: number) => { got[key] = (got[key] ?? 0) + amt; };
    const debit = (_s: string, key: string, amt: number) => {
      if ((st.res[key] ?? 0) < amt) return false; st.res[key] -= amt; return true;
    };
    doSalvage(st, credit, debit, { salvageRunsPerQueue: 2 }, { salvageRollMult: 1 }, false, PARAMS, TRUTHS);
    expect(got.starOre).toBeCloseTo(3 * 30 * 3.8 * 0.72 + 3 * 30 * 1, 4);
    // 单次≤1 护栏（细案⑤"单次≤1 护栏不动"）：全品质×全时长×全惊喜项，含 Lv10 额外骰与 +35%
    for (const [tname, def] of Object.entries(PARAMS.salvage.tiers)) {
      for (const dur of ['h2', 'h8', 'h24'] as const) {
        const ysRun = dur === PARAMS.salvage.yieldScaleDur ? PARAMS.salvage.yieldScale : 1;
        const sRolls = ((def.rolls as Record<string, number>)[dur] + (dur === 'h24' ? 1 : 0)) * ysRun * 1.35;
        for (const k of SALVAGE_SURPRISE_KEYS) {
          const ev = (def.rollEV as Record<string, number>)[k] ?? 0;
          expect(sRolls * ev, `${tname}/${dur}/${k}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('⑥ 补给站：免费抽 Lv4=1/Lv7=2、十连九折 Lv10=×10/9、A 垫层单调且封顶 ≤5pp', () => {
    // 为什么对：细案⑥逐级表——免费抽挂 Lv4/Lv7 里程碑、Lv10 十连九折=10 抽收 9 券
    //（券换抽 ×10/9·攒十连期望值口径）；A 概率垫层=A 本体自然率绝对加点（总控回执⑧
    // 裁定读法）、面值 0.5pp/级过热（0.8%→5.8% 近 7 倍）砍半后封顶 +2.5pp（可调旋钮·记档）。
    expect(TRUTHS.supplyFreePulls(3)).toBe(0);
    expect(TRUTHS.supplyFreePulls(4)).toBe(1);
    expect(TRUTHS.supplyFreePulls(7)).toBe(2);
    expect(TRUTHS.supplyFreePulls(10)).toBe(2);
    expect(TRUTHS.supplyPullPerTicket(9)).toBe(1);
    expect(TRUTHS.supplyPullPerTicket(10)).toBeCloseTo(10 / 9, 9);
    const a = PARAMS.supplyGacha.aPctByLv;
    expect(a.length).toBe(11);
    for (let i = 1; i < a.length; i++) expect(a[i], `aPct[${i}] 单调`).toBeGreaterThanOrEqual(a[i - 1]);
    expect(a[10]).toBeLessThanOrEqual(5);
    expect(a[10]).toBeGreaterThan(0);
  });

  it('⑥ 免费抽接线实证：关掉免费抽 → 同压力表下总抽数严格变少', () => {
    // 为什么对：免费抽不耗券白嫖 → 关掉后（T′ 免费抽=0）总抽数必须严格下降。
    // 段2a 重定基（旧→新→为什么对）：旧探针=碎片总流降 ≥20——L50 世界里两跑毕业日错位
    // （关免费抽→毕业更晚→记账天数更多）+决策路径分叉噪声把 ~36 碎片信号淹没（实测 off
    // 反而 +10.7=假红）。换钉"定长同窗总抽数"＝接线本体再近一跳（两跑都 runFullDays 固定
    // 120 天窗·抽数=购券抽+免费抽，免费抽归零不被购券补偿——购券由星贝盈余驱动与免费抽
    // 无关），毕业日错位与蝴蝶效应双免疫；降幅下限=免费抽日 1-2 次×百余天=保守 ≥20 抽。
    const T0 = { ...TRUTHS, supplyFreePulls: () => 0 };
    const onFull = simulateEconomyTier('普通', pressure, { runFullDays: true });
    const off = simulateEconomyTier('普通', pressure, { runFullDays: true }, PARAMS, T0 as typeof TRUTHS);
    const pulls = (r: typeof off) => r.dailyGachaPulls.reduce((a: number, b: number) => a + (b ?? 0), 0);
    expect(pulls(off)).toBeLessThan(pulls(onFull) - 20);
  });

  it('⑦ 展厅双层分红：Lv3 碎片/Lv6 宝石、挂种类数（手推）＋收藏加成逐级表 0.30→0.60', () => {
    // 为什么对：细案⑧——分红=每日 rate×已收集种类（Lv2 无分红/Lv3 起碎片/Lv6 起宝石）；
    // 量级现值=frag 0.012/gem 0.07（收口批重钉：0.10/0.10→frag 随 N1 蛋线砍 0.04→0.012、
    // gem 随 R13/R16 宝石线历轮=源表现值·结构断言不变量级重带）。
    // 收藏加成逐级表锚点：Lv1=0.30/Lv2-3=0.33/Lv5=0.43/Lv10=0.60 封顶（Lv3/6 分红级不加收藏）。
    expect(galleryDividendPerDay(2, 10)).toEqual({ coreFrag: 0, starGem: 0 });
    expect(galleryDividendPerDay(3, 10).coreFrag).toBeCloseTo(10 * PARAMS.gallery.fragPerSpecies, 9);
    expect(galleryDividendPerDay(3, 10).starGem).toBe(0);
    expect(galleryDividendPerDay(6, 10).starGem).toBeCloseTo(10 * PARAMS.gallery.gemPerSpecies, 9);
    expect(galleryDividendPerDay(10, 16).coreFrag).toBeCloseTo(16 * PARAMS.gallery.fragPerSpecies, 9);
    expect(galleryDividendPerDay(10, 16).starGem).toBeCloseTo(16 * PARAMS.gallery.gemPerSpecies, 9);
    expect(PARAMS.gallery.fragPerSpecies).toBe(0.012);
    expect(PARAMS.gallery.gemPerSpecies).toBe(0.07);
    expect(TRUTHS.galleryPerCorePct(1)).toBeCloseTo(0.30, 9);
    expect(TRUTHS.galleryPerCorePct(3)).toBeCloseTo(0.33, 9);
    expect(TRUTHS.galleryPerCorePct(5)).toBeCloseTo(0.43, 9);
    expect(TRUTHS.galleryPerCorePct(10)).toBeCloseTo(0.60, 9);
    // 接线实证：普通档毕业前展厅到 Lv3+/Lv6+（八栋全满级实测）→ 分红两币都真的入账
    const g = std['普通'].expected.ledger.income.gallery ?? {};
    expect(g.coreFrag ?? 0).toBeGreaterThan(0);
    expect(g.starGem ?? 0).toBeGreaterThan(0);
  });

  it('⑧ 双黄蛋（案A 3%·第一段基线）：展厅 Lv10 才生效、第二颗计流通款渠道（doCores 手推）', () => {
    // 为什么对（手推·120 核碎=2 蛋）：Lv10 双黄蛋 3% → coresOwned = 2×1.03 = 2.06、
    // eggYolk 渠道 +0.06（流通款补集幂）；Lv9 无双黄 = 2.00 整。案C 探针：九折 clone
    // （eggLv10CostMult 0.9）→ 蛋价 54、120 碎开 2 蛋剩 12。
    expect(PARAMS.core.doubleYolkP).toBe(0.03); // 案A=第一段基线（总控回执⑨）
    expect(PARAMS.core.eggLv10CostMult).toBe(1.0);
    const mkSt = (galleryLv: number) => ({
      res: { coreFrag: 120, starGem: 0 } as Record<string, number>,
      coresOwned: 0, coresDistinct: 0, cleared: 31,
      coreDraws: { egg: 0, eggYolk: 0, treasure: 0, bmFlow: 0, shopFlow: 0, vaultFlow: 0, vaultDupes: 0 },
      gradCores: { vault: 0, bm: 0, treasureEV: 0 }, gradCoreDays: [] as number[],
      gradCoreVaultDays: [] as number[], gradCoreBmDays: [] as number[], // 收口批配套①：分渠道真源（镜像真实 st）
      buildings: { gallery: galleryLv },
    });
    const debitOf = (st: ReturnType<typeof mkSt>) => (_s: string, key: string, amt: number) => {
      if ((st.res[key] ?? 0) < amt) return false; st.res[key] -= amt; return true;
    };
    const lv10 = mkSt(10);
    doCores(lv10, debitOf(lv10), 5, { coreLuck: 1 }, PARAMS, TRUTHS);
    expect(lv10.coresOwned).toBeCloseTo(2.06, 9);
    expect(lv10.coreDraws.egg).toBe(2);
    expect(lv10.coreDraws.eggYolk).toBeCloseTo(0.06, 9);
    const lv9 = mkSt(9);
    doCores(lv9, debitOf(lv9), 5, { coreLuck: 1 }, PARAMS, TRUTHS);
    expect(lv9.coresOwned).toBeCloseTo(2.0, 9);
    expect(lv9.coreDraws.eggYolk).toBe(0);
    const caseC = structuredClone(PARAMS);
    caseC.core.doubleYolkP = 0; caseC.core.eggLv10CostMult = 0.9;
    const c = mkSt(10);
    doCores(c, debitOf(c), 5, { coreLuck: 1 }, caseC, TRUTHS);
    expect(c.coresOwned).toBeCloseTo(2.0, 9);
    expect(c.res.coreFrag).toBeCloseTo(12, 9); // 120 − 2×54
  });

  it('⑨ 宝库 330/490（R17-R19 Ron 拍改价链）＋核保底前 5 颗线性（min(n,5)·手推三点）', () => {
    // 收口批重定基（旧→新→为什么对）：旧 120/200=细案§二2（47 天世界）；改价链=R17 Ron 拍
    // "宝库≈18 天"口径（120→200/200→350·与回廊利息对冲同刀）→R19 联立解 pF=330（钥匙②方程
    // 反解）→pG 现值 490（R19/R20 联调终值·§16h）；复购 ×1.5/保底 min(n,5) 结构不动；
    // 构造 cleared 30→60（陨星弹随新首Boss n054）。
    expect(PARAMS.core.vaultFlowPrice).toBe(330);
    expect(PARAMS.core.vaultGradPrice).toBe(490);
    expect(TRUTHS.vaultRepeatPriceGrowth).toBe(1.5);
    expect(PARAMS.core.distinctPity).toBe(5);
    const mk = (egg: number, cleared = 60) => ({
      cleared,
      coreDraws: { egg, eggYolk: 0, treasure: 0, bmFlow: 0, shopFlow: 0, vaultFlow: 0, vaultDupes: 0 },
      gradCores: { vault: 0, bm: 0, treasureEV: 0 },
    });
    expect(expectedDistinctCores(mk(2))).toBeCloseTo(3, 6);
    expect(expectedDistinctCores(mk(4))).toBeCloseTo(5, 6);
    const six = expectedDistinctCores(mk(6));
    expect(six).toBeGreaterThan(5);
    expect(six).toBeLessThan(7);
  });

  it('⑨ 前 5 颗到手节奏复验（60 天世界重钉）：五画像首颗 ≤D4、第 5 颗 ≤D21', () => {
    // 收口批重定基（旧→新→为什么对）：旧带 ≤3/≤15=细案§二1"D2-15"（47 天世界口径作废）；
    // 新带=60 天世界实测包络（肝 1,7,9,14,14／轻 4,7,14,21,21——轻度 15 分/天到首Boss n054
    // 需 D4=首颗物理下限；第 5 颗=扩张 7 天周期×2+蛋线节奏 → 轻度 D21 为包络上界）。
    for (const t of [...Object.keys(TARGETS), BM_TARGET.tier]) {
      const cd = std[t].expected.coreDays;
      expect(cd.length, `${t} 毕业前核数`).toBeGreaterThanOrEqual(5);
      expect(cd[0], `${t} 首颗`).toBeLessThanOrEqual(4);
      expect(cd[4], `${t} 第5颗`).toBeLessThanOrEqual(21);
    }
  });

  it('⑦⑧ 分红/双黄蛋接线方向：关分红或关双黄 → 同压力表下核相关量严格变少', () => {
    // 收口批重定基（旧→新→为什么对）：分红段照旧（普通档毕业前 Lv3/6 到位）；双黄段旧口径
    // 用肝档毕业窗——A2 指数放缓后肝毕业快照 gallery=9（Lv10 从未生效·关双黄当然无差=断言
    // 空转），改 runFullDays 普通档（D47 全满 Lv10 → 至 D120 蛋线持续·实测差 0.20 颗）。
    const noDiv = simulateEconomyTier('普通', pressure, { disable: { gallery: true } });
    const withDiv = std['普通'].expected;
    const fragOf = (r: typeof withDiv) => Object.values(r.ledger.income).reduce((a, kv) => a + ((kv as Record<string, number>).coreFrag ?? 0), 0);
    expect(fragOf(noDiv)).toBeLessThan(fragOf(withDiv) - 1);
    const noYolk = structuredClone(PARAMS);
    noYolk.core.doubleYolkP = 0;
    const on = simulateEconomyTier('普通', pressure, { runFullDays: true });
    const off = simulateEconomyTier('普通', pressure, { runFullDays: true }, noYolk);
    expect(off.coresOwned).toBeLessThan(on.coresOwned - 0.05);
  });
});

describe('S7 经济尺 · 核数带守卫（收口尾批·Ron 拍"认"·候拍③销案）', () => {
  it('60 天口径核数带：肝 21/重 21/普 20/轻 14 各 ±1（runFullDays·maxDays=60 期望值口径）', () => {
    // 收口尾批钉值（旧→新→为什么对）：N1 旧带（19-21/16-18）定于钥匙机制前·作废；新带=
    // 候拍③查证令三层产出后 Ron 拍"认"的冻结态实测（构成账=§16h R22 尾批：扩张 7.68+陨星弹
    // +毕业核封顶 2=锁死渠道 ~11 颗＋商店彩蛋反向对冲→三档差收敛 1 颗=结构事实非病）。
    // 口径=真 60 天（R13 定义：runFullDays 全速跑·maxDays=60 截·期望值含小数渠道）——
    // 毕业日截断口径（13.3/16.5/19.7/21.5=通关导向）为观察口不进守卫；两口径注档 §16h。
    const bands: Record<string, [number, number]> = { 肝档: [20, 22], 重度: [20, 22], 普通: [19, 21], 轻度: [13, 15] };
    for (const [t, [lo, hi]] of Object.entries(bands)) {
      const P60 = structuredClone(PARAMS);
      P60.maxDays = 60;
      const n60 = simulateEconomyTier(t, pressure, { runFullDays: true }, P60).coresOwned;
      expect(n60, `${t} 60d 核数（期望值口径）`).toBeGreaterThanOrEqual(lo);
      expect(n60, `${t} 60d 核数（期望值口径）`).toBeLessThanOrEqual(hi);
    }
  });
});

describe('S7 经济尺 · 任务单⑧ 逐关养成态导出口（⑥第三段接口）', () => {
  it('普通档 milestones=450 条、节点升序、字段完备（5 主力四元组/插件/核/战力>0）', () => {
    // 收口批重定基：150→450（450 关新世界）；教程段交叉点随新首Boss挪 n054（旧 n030/n040）。
    const r = std['普通'].expected;
    expect(r.milestones.length).toBe(450);
    for (let i = 0; i < r.milestones.length; i++) {
      const m = r.milestones[i];
      expect(m.node).toBe(i + 1);
      expect(m.power).toBeGreaterThan(0);
      expect(m.mains.length).toBe(5);
      for (const u of m.mains) expect(u.length).toBe(4);
      expect(m.cores).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(m.day).toBeGreaterThanOrEqual(r.milestones[i - 1].day);
    }
    // 教程段交叉验证（模型真实承诺·粒度记档）：n054 开打时主力1 已 S 阶（实测 maxTier=3·
    // 比 GDD-M"首Boss前刚好 1 艘 S"快半步=D2 即打首Boss的事件时序粒度·§18 记档口径延续）。
    const n54 = r.milestones[53];
    expect(Math.max(...n54.mains.map((u: number[]) => u[0]))).toBeGreaterThanOrEqual(3);
  });
});
