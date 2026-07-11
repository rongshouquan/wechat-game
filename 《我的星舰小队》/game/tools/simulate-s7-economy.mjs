// S7 真实资源经济模拟器（第三块①「造尺子」·2026-07-06 → 第三块③双锚+黑市改造 · 同日
//   → 任务单⑤参与度真分层 · 2026-07-07：悬赏张数×辅助战斗预算耦合 + 恶补按画像分层 +
//     板凳深度小乘区 + 发卡"每登录日"真源对齐，详见 PARAMS.bounty/bench 与 TIERS 注释）
//
// ============================================================================
// 用途：五画像玩家（肝/重/普/轻 + 黑市重度党）逐日"真实过日子"——挣真资源、花真资源、
//   按真实养成态算战力、按 150 关压力值推进、卡关攒资源破墙。校准靶 = 形状模型 v2
//   `simulate-s7-progression.mjs`（2026-07-06 Ron 递进墙拍板；旧"六墙均匀1.8"靶作废）：
//   四档毕业 肝30/重37/普47/轻57（±10%）+ 首周清关 35-40% + 新手期 n001-n030 零墙
//   + 递进墙（肝党锚 n060≈1/n102≈2/n120≈3/n150≈4-5 天·n084/n138 余势墙零等待）
//   + 任何档位任何单墙 ≤7 天硬顶（仅毕业墙可近顶）。
//
// 第三块③改造三层（任务单 2026-07-06）：
//   ① 形状靶 v2：内嵌副本换递进墙参数（同步 simulate-s7-progression.mjs）。
//   ② 校准器双锚：单 γ"收入漂移耦合"缺陷（初值表 v0 §13 诊断——中后期变富 → γ 全曲线
//      下调 → 前段变便宜 → 肝档提前到墙下多等）改为 早锚=普通档 n060 破墙日 +
//      晚锚=毕业日 双 γ、锚间对数插值；抗漂移回归护栏（±20% 单源扰动重校后仍达标）进 gate。
//   ③ 黑市入模（GDD S13.6）：全部激励视频观看 +1 计数（日上限 30）、商品表 v0、
//      第五画像「黑市重度党」（基于肝档+连看/广告券/购买），毕业靶 D22-25；
//      四档基线不碰黑市代码路径（基线不变性可用严格相等测试证明）。
//
// 真源指针（结构与锁定数字，冲突以此为准）：
//   - GDD-v2.0.md S8/S9/S10.1-10.10/S13（各系统收支结构、广告10点位、悬赏/回廊/推演/回港）
//   - GDD-附录D-星舰真源.md §0（升阶消耗 30合成+50/100/300/1000、等级上限 C20/B40/A60/S80/SS100）
//   - GDD-附录D-驾驶员真源.md §0（升星消耗同梯、每级+1%驾驶加成、星级系数质变线）
//   - GDD-附录D-插件真源.md（战力 15/35/70、3合1 升品、C1/B2/A3 槽）
//   - GDD-附录D-星核真源.md（+120/装核船、渠道=首Boss固定/扩张宝藏/碎片合成/宝石兑换）
//   - 第二块-数值设计/节奏表-B1-普通玩家主干-v0.1.md（战力公式骨架、升级成本曲线形状、
//     星核节奏支柱 §8、四档时间门控原理 §9；B1 旧数字不当靶）
//   - 第二块-数值设计/建筑数值-6b3草案（建筑成本 120×L^1.3×重要度、各级效果·Ron 拍板 v0.2）
//   - 钱包 14 键 = S7SaveService.S7_RESOURCE_KEYS
//   - 150 关拓扑 = generate-s7-mainline-topology.mjs（6 星域墙位 60/84/102/120/138/150、
//     剧情首Boss n030、精英 [6,59,83,101,119,137,149]）
//
// 模型口径（任务单硬规格）：
//   - 期望值模型：随机项按数学期望直算，零 RNG、跑一次秒出、完全确定。
//   - 20 抽保底按确定节拍精确触发（每满 20 抽发 1 个 A 本体，自然概率另计）。
//   - 欧非包络：三个关键随机项（专属碎片归属集中度/悬赏金卡率/打捞发现产出）
//     乐观/悲观系数双跑输出带宽（envelope='lucky'|'unlucky'）。
//   - 守恒：每日每币种余额不为负；台账逐源记账（income/spend），收支恒等式可自检。
//   - 零回写：本工具不改任何游戏运行时代码/配置；校准解只出文档。
//
// 压力值表的生成方法（=校准解的一部分，任务单硬规格 #5"初值按形状曲线生成"）：
//   ① 内嵌形状模型（只读副本·常量锁定）跑出普通档"第几天该清到第几关"的时刻表；
//   ② 用经济模拟里普通档的真实战力轨迹，把时刻表重采样成真实战力单位的 150 关压力值
//      （关 n 的压力值 = 普通档在形状时刻表说"清到 n 那天"开盘时的战力）；
//   ③ 全局系数 γ 二分搜索，使普通档在经济模拟里恰好第 47 天毕业。
//   迭代 ①→②→③ 至收敛（确定性模型必收敛），其余三档不看靶自由跑——它们落在哪就是
//   尺子对"参与度差异"的真实测量。
//
// ============================================================================
// 玩家策略成文（固定优先级贪心 · 四档共用同一策略、只差档位参数）：
//   每日流程：
//   1. 回港领取：离线产出 + 巡逻收益（按离开时长累积、居住舱存储上限截断）；
//      看广告档用 #1 报告翻倍（软货币）。
//   2. 快速打理（固定几分钟）：商人（星贝盈余买补给券至日限+轮换篮）→ 打捞派趟
//      （信标 史诗>稀有>普通；积压少走 24h 长趟、积压多加短趟消化；#5 广告追加一趟）。
//   3. 花钱优先级：a.通用碎片 1:1 转当前瓶颈主力 → b.专属碎片够就升阶/升星（主力1
//      优先冲 S 接陨星弹，其余按阶低者先）→ c.免费抽＋补给券全抽（舰/员池对半·Lv10 十连
//      九折）→ d.合金/驾驶记录从最便宜一级逐级买满 5 主力（船坞/训练舱折扣线生效）→
//      e.插件 3合1 升品 → f.星矿升建筑（八栋全入列=建筑细案入尺批·船坞/训练舱携折扣线
//      入循环，旧"无战斗外收益不升"TODO 由此销案）→ g.星核碎片够价即开蛋（展厅 Lv10
//      双黄蛋）、星空宝石够价即宝库兑换（流通 120/毕业 200·复购 ×1.5 递增）。
//   4. 推主线优先：战力 ≥ 压力值就打（45 秒/关时间预算）；首通=固定软货币+三选一期望
//      （选卡偏好：点名主力的专属碎片>补给券/星核碎片>插件/信标>星矿）；看广告档
//      每日 1 次 #3 固定翻倍 + 1 次 #4 再选一，用在当日最后一关（最肥）。
//   5. 剩余时间做日常：悬赏板（含积压回补·护航遇袭"正面迎战"）→ 每日推演 →
//      深空回廊往上顶（层奖+每5层里程碑·#10 翻倍）。
//   6. 卡关日：每日 1 次挑战尝试吃战败安慰包（#9 翻倍），攒资源等破墙。
//   档位参数（TIERS）：日均在线分钟 / 会话数 / 广告观看次数（轻度=0，天然构成
//   "纯无广告"红线跑法）/ 日常完成率 / 打捞趟数计划 / 回廊时间 / 购物意愿。
//
// 模型简化（诚实声明，全部记入《数值初值表-v0》）：
//   - 专属碎片不跨单位挪用：5 主力各自独立积攒（随机归属碎片 × 归属集中度 ÷ 5 +
//     定向投放），落在非主力身上的碎片单独沉淀记账（审视报告"死水"观察口）。
//   - 打捞按"当日派趟当日结算"的稳态近似；信标不过期，短趟只在积压时用。
//   - 商人广告刷新 #8 折算为轮换购买篮 ×1.5；广告券（星贝→广告机会转换器）v0 不启用
//     （不影响零广告红线与 +25-30% 上限判定，留作第二子步杠杆）。
//   - 战斗胜负 = 战力比阈值 1.0（Boss spike 已在压力值内），不模拟词缀/克制微操。
//   - 教程期（n001-n030）定向投放保证"首Boss前养出 1 艘 S 阶"（GDD-M 铁律）：
//     早期节点内置对主力1 的专属碎片投放，见 PARAMS.tutorialGrant。
// ============================================================================

// ---------------------------------------------------------------------------
// 〇、内嵌形状模型 v2（校准靶·常量与算法为 simulate-s7-progression.mjs 的只读副本，
//     若形状模型再被拍板改参，这里必须同步；gate 测试钉住本副本输出 30/37/47/57）
//     v1（六墙均匀 spike 1.8·bossPositions 占比制）2026-07-06 递进墙拍板后作废，
//     旧参数保留在 simulate-s7-progression.mjs 的 CURVE_PARAMS_V1_DEPRECATED。
// ---------------------------------------------------------------------------

export const SHAPE = {
  N: 150, base: 100, qStart: 0.003, qEnd: 0.03, curvePow: 1.1,
  // 六 Boss 真实节点号 × 递进尖峰（v1 的占比取整会落在 n083/n135，v2 顺带修正到真实拓扑）
  // 尖峰=«形状约束 × 经济实测»端到端联合选优（经济层轻度末期成长≈肝档一半，s120≥1.30/
  // s150≥1.42 都会把轻度末墙顶破 7 天硬顶）——选定组合的取舍记初值表 v0.3
  bossSpikes: { 60: 1.12, 84: 1.01, 102: 1.24, 120: 1.27, 138: 1.0, 150: 1.38 },
  P0: 100,
  SEC_PER_NODE: 45, MAX_DAYS: 90,
  // r = 恰好毕业靶日的可行区间中点（区间宽 0.09-0.33pp）；墙变矮 → r 相应回落钉回四靶
  tiers: {
    轻度: { minutesPerDay: 15, r: 0.0452, stuckBonus: 1 },
    普通: { minutesPerDay: 35, r: 0.0528, stuckBonus: 2 },
    重度: { minutesPerDay: 90, r: 0.0637, stuckBonus: 4 },
    肝档: { minutesPerDay: 150, r: 0.0741, stuckBonus: 7 },
  },
};

export function shapeRequiredCurve(s = SHAPE) {
  const smooth = [0, s.base];
  for (let n = 2; n <= s.N; n++) {
    const t = Math.pow((n - 1) / (s.N - 1), s.curvePow);
    const q = s.qStart + (s.qEnd - s.qStart) * t;
    smooth[n] = smooth[n - 1] * (1 + q);
  }
  const actual = smooth.slice();
  for (const [node, spike] of Object.entries(s.bossSpikes)) {
    actual[Number(node)] = smooth[Number(node)] * spike;
  }
  return actual;
}

/** 形状模型单档逐日模拟（与原工具逐行为同一算法）。返回 {graduateDay, dailyLog}。 */
export function shapeSimulate(tierName, s = SHAPE) {
  const t = s.tiers[tierName];
  const required = shapeRequiredCurve(s);
  const maxNodesPerDay = Math.max(1, Math.floor((t.minutesPerDay * 60) / s.SEC_PER_NODE));
  let power = s.P0, cleared = 0;
  const dailyLog = [];
  for (let day = 1; day <= s.MAX_DAYS; day++) {
    const wasStuck = power < required[cleared + 1];
    power *= 1 + t.r;
    if (wasStuck) power += t.stuckBonus;
    let clearedToday = 0;
    while (cleared < s.N && power >= required[cleared + 1] && clearedToday < maxNodesPerDay) {
      cleared++; clearedToday++;
    }
    dailyLog.push(clearedToday);
    if (cleared >= s.N) return { graduateDay: day, dailyLog };
  }
  return { graduateDay: null, dailyLog };
}

/** 形状时刻表：node → 普通档应在第几天清掉它。 */
export function shapeDaySchedule(tierName = '普通', s = SHAPE) {
  const { dailyLog } = shapeSimulate(tierName, s);
  const dayOf = [0];
  let n = 0;
  for (let d = 1; d <= dailyLog.length; d++) {
    for (let k = 0; k < dailyLog[d - 1]; k++) dayOf[++n] = d;
  }
  return dayOf; // dayOf[n] = 形状模型里普通档清掉第 n 关的那天
}

// ---------------------------------------------------------------------------
// 一、真源锁定常量（不是校准旋钮；改这里=改真源，须先过冲突清单）
// ---------------------------------------------------------------------------

export const TRUTHS = {
  N: 150,
  regionSpans: [
    { sf: 1, from: 1, to: 60 }, { sf: 2, from: 61, to: 84 }, { sf: 3, from: 85, to: 102 },
    { sf: 4, from: 103, to: 120 }, { sf: 5, from: 121, to: 138 }, { sf: 6, from: 139, to: 150 },
  ],
  bossNodes: [60, 84, 102, 120, 138, 150],
  storyBossNode: 30,
  eliteNodes: [6, 59, 83, 101, 119, 137, 149],

  // 战力公式 v0.1 骨架（B1 §1 + S5.5 驾驶加成计入 + 星核插件计入战力拍板）
  tierBase: [100, 160, 250, 380, 550],
  shipLevelPowerPct: 0.08,
  pilotStarCoef: [1.0, 1.08, 1.18, 1.30, 1.45],
  pilotLevelPct: 0.01,
  pluginPower: { fine: 15, superior: 35, legendary: 70 },
  corePower: 120,
  pluginSlotsByTier: [1, 2, 3, 3, 3],

  shipLevelCapByTier: [20, 40, 60, 80, 100],
  pilotLevelCapByStar: [20, 40, 60, 80, 100],

  shipLevelCost: (lv) => Math.round(50 * Math.pow(lv, 1.3)),
  pilotLevelCost: (lv) => Math.round(40 * Math.pow(lv, 1.2)),

  synthesizeBodyShards: 30,
  shipAscendCost: [50, 100, 300, 1000],
  pilotStarupCost: [50, 100, 300, 1000],

  buildingCost: (level, coef) => Math.round(120 * Math.pow(level, 1.3) * coef),
  buildingImportance: { dock: 1.3, training: 1.3, habitat: 1.1, research: 1.1, supply: 1.1, salvage: 1.0, merchant: 1.0, gallery: 1.0 },
  // —— 建筑升级细案 v1 入模（2026-07-09 Ron 逐栋拍定·任务单「建筑细案入尺批」）——
  // 细案钉的是"哪级出哪个里程碑"的结构（=真源）；量级=占位 v0 入尺定稿（可调的挂 PARAMS）。
  // 居住舱（细案③）：仓 36→48h 封顶／产率爬到 +18%（Lv5=积压里程碑级不加产率·锚 Lv9=+16/Lv10=+18）／
  // 有效编制 6+2/级（人口无上限·超编纯人气——期望值模型里与"编制封顶"数学等价，主循环沿用 6+2×lv）
  habitatStorageHours: (lv) => (lv <= 0 ? 0 : [36, 37, 39, 40, 42, 43, 44, 45, 47, 48][Math.min(10, lv) - 1]),
  habitatRatePct: (lv) => (lv <= 0 ? 0 : [2, 4, 6, 8, 8, 10, 12, 14, 16, 18][Math.min(10, lv) - 1]),
  researchPowerPct: (lv) => Math.max(0, lv) * 1,
  // 展厅（细案⑧）：收藏加成逐级表 0.30→0.60 封顶（Lv3/6=分红里程碑级不加收藏·Lv4 权重补跳）；
  // 双层分红量级挂 PARAMS.gallery（任务单"量级可调"）
  galleryPerCorePct: (lv) => [0.30, 0.33, 0.33, 0.40, 0.43, 0.43, 0.48, 0.52, 0.57, 0.60][Math.max(1, Math.min(10, lv)) - 1],
  galleryCapPct: 10,
  galleryFragLv: 3, galleryGemLv: 6, // 碎片分红 Lv3 / 宝石分红 Lv6（解锁级=细案结构）
  // 打捞港（细案④）：队数 3/4/5（Lv1/4/7·原 1/2/3 作废）——总吞吐守恒靠 PARAMS.salvage.yieldScale
  // 单趟配平（"只给排面不给增量"），前期信标瓶颈下的空车体感如实记档
  salvageQueues: (lv) => (lv >= 7 ? 5 : lv >= 4 ? 4 : lv >= 1 ? 3 : 0),
  // 打捞稀有发现线（细案④⑤）：Lv2/3/5/6/8/9 各 +5%（相对）＋Lv10 +5% → 累计 +35%；
  // 只作用惊喜线（居民/工人/货舱/插件·经济线掷骰不吃）；Lv10 另给 24h 长趟额外一次惊喜掷骰
  salvageSurpriseLvls: (lv) => [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 7][Math.max(0, Math.min(10, lv))],
  salvageExtraRollLv: 10,
  // 船坞/训练舱折扣线（细案①②）：升级币成本 −1.5%/级（Lv10 毕业 −15%）——船坞只折星舰
  // 合金、训练舱只折驾驶记录；专属碎片（合成 30/升阶/升星梯）永不打折=结构上不经过此路径
  dockDiscountPctPerLv: 1.5,
  trainingDiscountPctPerLv: 1.5,
  // 补给站（细案⑥）：免费抽 Lv4=每日1/Lv7=每日2（不耗券白嫖）；Lv10 十连九折（10 抽收 9 券
  // =券换抽数 ×10/9·假设玩家攒十连抽=期望值口径）；A 级概率垫层挂 PARAMS.supplyGacha（可调旋钮）
  supplyFreePulls: (lv) => (lv >= 7 ? 2 : lv >= 4 ? 1 : 0),
  supplyPullPerTicket: (lv) => (lv >= 10 ? 10 / 9 : 1),
  buildingMaxLevel: 10,

  salvageTimeMult: { h2: 1, h8: 2.2, h24: 3.8 }, // 每小时效率递减（0.50/0.28/0.16），每信标收益随时长递增

  // 护航委托（任务单⑧总修订案：张数 4→3、明保底替代"金8%+暗保底"、难度四档自选）
  bountyDailyCards: 3,
  bountyQualityMult: { bronze: 1, silver: 1.6, gold: 3 },
  bountyGoldEveryDays: 3,  // 明保底：每 3 天必出 1 张金色
  bountySilverPerDay: 1,   // 明保底：每天 3 张必含 ≥1 张银色
  bountyPerfectMult: 1.25, // 运输船满血 ×1.25 彩蛋（沿用·达成率=画像 bountyPerfect）
  bountyAmbushRate: 0.15,
  bountyAmbushLossPct: 0.30,
  // 积压 6/9/12（细案③＋§二3 连带拍板·2026-07-09 Ron 收紧·原 12/16/20 作废）：
  // 下标=基础/居住舱 Lv5/Lv10；恶补阈值沿"积压>日卡数"（bountyCardsFor·任务单联动核查项）
  bountyBoardCap: [6, 9, 12],

  corridorMilestoneEvery: 5,
  corridorEchoEvery: 25,

  gachaPity: 20,
  vaultRepeatPriceGrowth: 1.5,
  eventCycle3: 3,
  eventCycle7: 7,
};

// ---------------------------------------------------------------------------
// 二、校准参数表（唯一调参处——"改一处→重跑→秒出四档对比"）
// ---------------------------------------------------------------------------

export const PARAMS = {
  maxDays: 120,

  // 星域系数（离线/巡逻/悬赏共用进度乘区·下标=已通关星域数 0-6；主线奖励按关所在星域取）
  regionCoef: [1.0, 1.7, 2.7, 4.0, 5.8, 8.2, 10.5],

  // 离线产出（/小时·×星域系数×(1+居住舱%+居民%)）——星矿为主（S10.10 侧重口径）；
  // 合金/记录=「回来有得领」的底垫（B1 落地·任务单⑤：军饷主渠道让位悬赏，离线 ×0.7 降档
  // ——底垫身份不是战力主粮；顺带护 #1 广告翻倍 ≤ 加速上限）
  offline: { starOre: 62, hullAlloy: 24, pilotToken: 16 }, // A1 步3：星矿减产 100→62；B1 任务单⑤：合金 30→24/记录 20→16（×0.8——×0.7 实测把肝档打捞暴露度顶过抗漂移带，底垫少砍一档·调参记档）
  // 星矿的星域乘区用开方衰减（星矿=建筑币·十级封顶的有限 sink，全速乘区必然溢出成死水）
  oreCoefPow: 0.5,
  // 巡逻收益（/小时·×星域系数×(1+派驻加成)）——战斗养成资源小额（≈离线同币种 45% 档）
  // B1 任务单⑤：军饷随离线同降 ×0.8（14→11.2/9→7.2·底垫身份），星贝不动
  patrol: { hullAlloy: 11.2, pilotToken: 7.2, starCargo: 4 },
  patrolDockPctPerShip: 4,
  patrolDockMax: 10,

  // 护航委托（任务单⑧重构：3 张全护航＋难度四档自选，演习记录剥离进 drill 木桩）
  // 张数四约束沿用任务单⑤（min(积压, 意愿, 剩余分钟, 分钟预算)·恶补/预算按画像·真墙日 ×2）。
  // 量值推导（§18 记档）：老模型 4 张=2 护航×550+2 演习×370；"单张 ×4/3"在护航/演习拆分口径下
  // 换算为"委托日总额不变"起步——3 张全护航锚老 2 张护航日总额 1100 合金基值 → 单张 base≈520
  //（×难度均值后正中）；难度倍率接管一半进度缩放（coefPow 0.5，同星矿 ^0.5 先例），
  // 早期(新手档×0.7·coef1)≈老量、后期(噩梦×2.2·coef10.5^0.5)≈老量——总弧形状不动、份额不漂。
  bounty: {
    escortAlloy: 495, escortCargo: 20, // 第4轮 520→495：普通档委托份额 54.4% 贴带顶回中（靶≈50±3）
    coefPow: 0.6, // 星域系数取 ^0.6（第3轮 0.5→0.6：末段委托成长太平→零广告终局墙9天/bounty×1.2 普通墙8）：难度爬档已是显式进度倍率，全系数会双重计progression
    // 难度四档（总修订案 1a·倍率表与推荐战力=数值域自定·曲线节奏锚 Ron 方向）：
    // 推荐战力挂压力值表定点（新手n10/普通n55/困难n98/噩梦n130）——随校准器自动重校，
    // 节奏兑现：普通档 D1 碾新手→D8-9 碾普通→D24-26 碾困难→D38-40 碾噩梦收菜。
    difficulty: {
      mults: { novice: 0.7, normal: 1.0, hard: 1.5, nightmare: 2.2 },
      recNodes: { novice: 10, normal: 55, hard: 98, nightmare: 130 },
      crushRatio: 1.15,   // 战力 ≥1.15×推荐 = 稳赢（模型胜率 1.0）
      probeMinRatio: 0.95, // 试探上一档的战力下限（0.75→0.85→0.90→0.95：试探红利反复熔肝 n120 墙·逐轮收窄）
      failFloor: 0.55,    // 胜率线性带下沿：ratio≤0.55 必败、≥crushRatio 必胜
    },
    goldPhysical: { beaconCommon: 1 / 3, shipBlueprint: 1 / 3, supplyTicket: 1 / 3 },
    ambushWinBonus: { shipBlueprint: 0.5, supplyTicket: 0.5 },
    perfectRate: 0.5, // 画像无 bountyPerfect 时的回退值（分层见 TIERS·任务单⑤）
    ambushWinRate: 0.85,
    minutesPerCard: 1.2,
    stallBudgetMult: 2,
  },

  // 演习木桩（任务单⑧总修订案 1b·产驾驶记录=原演习份额移此）：60 秒计分窗、20 档
  // （15-20 带上限·低档密高档疏=等比阈值），打到第 N 档领 1..N 全部奖励、每日重置。
  // 档位阈值挂队伍 DPS（⑥细表 §9 量纲 d≈0.40 DPS/战力 → 60 秒总伤 ≈24×战力）：
  // 阈值 8k×1.2655^k 覆盖战力 ≈333（新手前）到 ≈29k（毕业+）；奖励表=记录币配平位，
  // 无星域系数（档位表自身即进度缩放——老演习 2×370×1.42×coef 的轨迹由 cum(档) 复现：
  // 档7≈1050/档20≈11000 对齐老 coef 1→10.5 弧）。
  // 结构修正（第6轮记档）：18 档→20 档——18 档时顶部档距 30%、战力 2.2-2.9 万整段
  // 零跨档，全档终局记录收入平掉（普通/轻度 n150 贴顶 7、黑市党 D26 差 1 天的共同根因）。
  drill: {
    dps: 0.40, windowSec: 60,
    thresholdBase: 8000, thresholdGrowth: 1.2510, tiers: 20, // 顶档=战力≈23.5k 全档毕业段真实可达（1.2577 时 26k 仍无人摸到=白档二犯·§18 教训③）
    rewardBase: 90, rewardGrowth: 1.165,
    minutes: 2, // 打到可达档的强制日常耗时（自愿实验时长不计=1c 口径）
  },

  // 每日推演（n040 后·首胜）
  puzzle: { starCargo: 30, shipBlueprint: 2.5, minutes: 2.0 },

  // 今日补给箱（#2 广告点位）
  supplyChest: { hullAlloy: 35, pilotToken: 25, starCargo: 10, beaconCommon: 0.25, universal: 1.0 },

  // 商人小站（任务单⑧总修订案四：百货商店化——常驻区应急+稀有格 Lv 节奏+广告券不限购+Lv10 九折）
  merchant: {
    ticketPrice: 80, ticketDailyCap: 50, // 补给券：每日限购=抽卡节奏唯一阀门（铁律例外·照旧）
    adTicketPrice: 70,                   // 广告券：常驻不限购·价适中偏低（60-80 带取 70·购买=画像按需 TIERS.adTickets）
    cargoReserve: 150,
    richThreshold: 800,
    // 稀有格（Lv1×1 / Lv4×2 / Lv7×3 满·每日互不重复各限购 1·权重升级 Lv2/5/8）：
    // 池 6 品类；流通核 Lv5 极低频入池 → Lv8 升低频（S10.3 终版）。旧"轮换篮子"三件
    // （稀有信标/核碎包）归入本结构，精良插件移常驻区——起步流量对齐 v0.5 篮子防校准冲击。
    rare: {
      slotsByLv: [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3], // 下标=商人小站等级
      pool: {
        beaconRare:   { w: 0.34, price: 300, minLv: 1, give: { beaconRare: 1 } },
        superiorPlugin: { w: 0.20, price: 450, minLv: 1, give: { superior: 1 } },
        coreFragSmall: { w: 0.10, price: 500, minLv: 1, give: { coreFrag: 5 } },   // 第1轮：0.18→0.10（核心跳超发主源之一）
        beaconEpic:   { w: 0.08, price: 800, minLv: 2, give: { beaconEpic: 1 } },  // Lv2 权重①：史诗信标现身
        coreFragBig:  { w: 0.05, price: 1150, minLv: 2, give: { coreFrag: 12 } },  // 星核碎片大包（低频·第1轮 0.12→0.05）
        flowCore:     { w: 0.02, wLv8: 0.05, price: 1200, minLv: 5, give: { flowCore: 1 } }, // 流通核彩蛋 Lv5→Lv8 升频
      },
    },
    // 常驻区应急（"比正常渠道贵一截→平时不买、关键应急"·缺料触发建模两项+精良插件常驻）：
    // ①打捞队闲置（信标<队数）→ 按贵价补普通信标保打捞不断档；②真墙日军饷应急小包
    //（价劣·墙期星贝富余才买）。星矿包/合金包日常价劣不建常购模型（=设计"平时不买"的如实体现）。
    staple: {
      beaconCommonPrice: 60,          // vs 回收价 25 = "贵一截"的应急定位
      wallPack: { cargoCost: 120, hullAlloy: 90, pilotToken: 60, capPerDay: 3 },
      finePlugin: { p: 0.35, price: 320 }, // 精良插件不限（沿用 v0.5 篮子流量）
    },
    discountLv10: 0.9,               // Lv10 全场商品 9 折（满级终身被动）
    recycleStep: { beacon: 3, plugin: 15 }, // Lv3/6/9 回收价各升一档（信标 25→28→31→34·插件 150→165→180→195）
    minutes: 0.8,
  },

  // 打捞（每信标一趟；软货币/通用碎片 ×时间档倍率；rolls=发现掷骰·随时长档取对应值）
  // 策略：每队先派 1 趟 24h（信标效率高）；剩余信标按档位趟数计划加派 2h 短趟消化
  // （时间效率高·信标效率低——"消化型"重度玩家 vs "效率型"轻度玩家的真实分层）；
  // 星贝盈余时买打捞加速券把短趟升为 8h 档产出（花星贝买时间·S10.2/S10.3 设计）。
  salvage: {
    minutes: 1.0,
    // 单趟守恒系数（细案④"队数 3/4/5 只给排面不给增量"·建筑细案入尺批）：队数翻倍段不同
    //（Lv1 1→3/Lv4 2→4/Lv7 3→5），单一系数只能锚一段——按总控确认方针锚"中后期主吞吐段"，
    // 全程收入轨迹 ≈v0.6 用 --income 复核。**守恒刀只落 24h 长趟**（yieldScaleDur）——
    // 队数翻倍翻出来的正是长趟（每队首趟 24h·5 队=长趟 3→5），短趟单价不动。
    // 调参记档（选型实测径）：①均匀刀 0.6→总量 72%（过深）；②均匀 0.83→129%（信标自繁殖
    // 非线性回潮）；③均匀 0.72→总量 102% 但把打捞收入"时间形状"压后——前期信标束缚下
    // 趟数不变每趟被砍、后期队数红利补总量，短周期档整段前中期插件/通碎/核碎瘦 20-28%、
    // 被普通档锚定的压力表(+7-15%)挤出带（肝 D35/BM D30=A/B 逐日曲线实证）；④终版=
    // 长趟专刀：后期 肝(3L+8S→5L×s+6S)/普(3L+3S→5L×s+1S) 在 s=0.72 数学平价，前期
    // 保留"3 队全放长趟"的设计 QoL（细案①早给队数=有意的爽点，如实入模）。
    yieldScale: 0.72,
    yieldScaleDur: 'h24',
    tiers: {
      common: {
        ore: 30, cargo: 14, universal: 1.5, fixed: {},
        rolls: { h2: 1.6, h8: 3.8, h24: 8.2 },
        rollEV: { universal: 0.5, beaconCommon: 0.16, coreFrag: 0.004, finePlugin: 0.05, resident: 0.02, worker: 0.02, cargoChest: 0.01 }, // 券下架=B3（S10.1 无此渠道）；coreFrag 0.015→0.004（B4 两刀）
      },
      rare: {
        ore: 70, cargo: 38, universal: 2.5, fixed: { coreFrag: 0.25 }, // B4：1→0.25（打捞=核碎最大源 55%·中后期超发主凶）
        rolls: { h2: 2.6, h8: 5.0, h24: 10.4 },
        rollEV: { universal: 0.8, beaconRare: 0.05, coreFrag: 0.008, superiorPlugin: 0.05, starGem: 0.015, resident: 0.03, worker: 0.03, cargoChest: 0.015 }, // 券下架=B3；稀有自繁殖 0.10→0.075（24h 1.04→0.78 拆永动·A3）；coreFrag 0.03→0.008（B4 两刀）；starGem 0.05→0.015（B7 挪回廊）
      },
      epic: {
        ore: 160, cargo: 95, universal: 4, fixed: { coreFrag: 0.5, starGem: 0.5 }, // B4：coreFrag 2→0.5；B7：starGem 2→0.5（大头挪回廊）
        rolls: { h2: 3.8, h8: 7.0, h24: 12.6 },
        rollEV: { universal: 1.2, beaconEpic: 0.05, coreFrag: 0.012, superiorPlugin: 0.07, legendaryPlugin: 0.035, starGem: 0.05, resident: 0.04, worker: 0.04, cargoChest: 0.02 }, // 券下架=B3；coreFrag 0.05→0.012（B4 两刀）；starGem 0.15→0.05（B7 挪回廊）
      },
    },
    // 打捞加速券（商人·星贝→时间转换器）：把一趟 2h 短趟的产出升到 8h 档
    accel: { price: 150 },
  },

  // 主线首通（固定软货币三件套 ×关所在星域系数 ×档位倍率）
  mainline: {
    fixedAlloyBase: 55, fixedTokenBase: 36, fixedCargoBase: 24,
    eliteMult: 1.6, bossMult: 2.6, storyBossMult: 2.0,
    minutesPerNode: 0.75,
    // A4（步4 稀缺线·纯砍版落地）：offShard −30%（2.6/4.0/5.2→1.82/2.8/3.64）、主力不动。
    // 实测记档（§15）：守恒重分版（main+30%）熨平肝 n102 墙、半补版（+15%）顶破轻度硬顶——
    // 主力碎片是中段战力最敏感杠杆，禁止用它"补偿"；且三选一 off 仅占沉淀 <9%（主源=抽卡
    // 66% 非主力归属），A4 治沉淀实测近无效，沉淀治理移交结构层（挂任务单⑤板凳深度联动）
    pickEV: {
      normal: { mainShipShard: 1.3, mainPilotShard: 1.3, offShard: 1.82, supplyTicket: 0.85, coreFrag: 0.4, starOreBase: 11, beaconCommon: 0.4, finePlugin: 0.16 },
      elite: { mainShipShard: 2.0, mainPilotShard: 2.0, offShard: 2.8, supplyTicket: 1.4, coreFrag: 1.0, starOreBase: 16, beaconRare: 0.35, superiorPlugin: 0.15 },
      boss: { mainShipShard: 2.6, mainPilotShard: 2.6, offShard: 3.64, supplyTicket: 2.6, coreFrag: 3.0, starOreBase: 26, beaconEpic: 0.15, starGem: 1.6, superiorPlugin: 0.13, legendaryPlugin: 0.04 },
    },
    adExtraPickMult: 0.9,
  },

  // 教程期定向投放（GDD-M"首Boss前刚好养出 1 艘 S 阶"·人人相同·计入初值表）。
  // ⚠️ 模型粒度如实记档（任务单⑧ milestones 导出口曝光）：模型普通档 D2 即打 n030
  //（首个 3 天行动宝藏 D3 才结算），n030 开打时主力1=A 阶+257 碎片、S 阶落 D3-4（n040 前）
  // ——与 GDD-M 铁律差半步是"事件未到"的时序问题非碎片量问题（15/关实测治不了还搅首周），
  // 与"行动宝藏对首Boss助力"验收补充一并挂第二段校。
  tutorialGrant: { perNodeMainShard: 13, untilNode: 30, firstEventMainShard: 60 },

  // 抽卡（S10.1 碎片化）
  gacha: {
    shardPerPullEV: 2.0,
    bodyP: { C: 0.07, B: 0.025, A: 0.008 },
    dupFoldShards: 15,
    poolSizeShips: 18, poolSizePilots: 20,
  },

  // 星核渠道矩阵（任务单⑧总修订案二：常规14+毕业2 两层·合成改开蛋·宝库 8流通统一价+2毕业更贵）
  core: {
    synthesisFragCost: 60,
    eggStrongWeight: 0.035, // 开蛋 13 常规池：2 颗强常规各 3.5%（合成头奖低权重）、其余 11 颗均分
    // 双黄蛋（细案⑧ Lv10 里程碑·展厅 Lv10 才生效）：开蛋一蛋双核、第二颗限流通款。
    // 三案对照（第二段交 Ron 拍）：案A doubleYolkP=0.03 / 案B =0.05 / 案C =0＋eggLv10CostMult=0.9
    //（开蛋九折 60→54）。第一段基线挂案A（总控回执⑨照准）。
    doubleYolkP: 0.03,
    eggLv10CostMult: 1.0,
    // 核保底（细案§二1 连带拍板·Ron 拍板结构非调参旋钮）：前 5 颗星核保证各不相同——
    // 已拥有种类 <5 时全部随机整核渠道（开蛋/宝藏/黑市小件/宝箱）只出未拥有款；
    // 期望模型=种类期望前段改精确线性 min(n,5)（expectedDistinctCores）
    distinctPity: 5,
    // 宝库价格（细案§二2·Ron 给两案委托总控拍 → 120/200·2026-07-09）：流通 110→120（+9%
    // 由入尺消化=对冲分红/双黄蛋新热源）；毕业核 200=⑧刚验证的时点锚不动；复购 ×1.5 不动
    vaultFlowPrice: 120,    // 8 流通款统一价（110→120=细案§二2 拍板·旧 110 见⑧第3轮记档）
    vaultGradPrice: 200,    // 2 毕业核更贵（≈1.67×·"性价比略低于流通核但不悬殊"）
    treasureGradP: 0.04,    // 扩张宝藏三选一池（11 常规）混入曲率星门低概率＝欧皇线
    gradSaveAfterCores: 5,  // 宝石线策略：5 核槽填满后转攒毕业核（=B7"攒宝石换想要的核"落名）
  },
  // 展厅双层分红（细案⑧·Lv3 碎片/Lv6 宝石·挂 coresDistinct）：量级=任务单"可调"旋钮——
  // 起步取细案占位（碎片 0.3/种/日·宝石 0.12/种/日=0.1-0.15 带中值）；心跳带超热优先砍这里
  //（总控回执⑤授权在案）。解锁级挂 TRUTHS.galleryFragLv/galleryGemLv。
  gallery: { fragPerSpecies: 0.10, gemPerSpecies: 0.10 },
  // 工人建筑折扣（细案③·总控回执③裁定"改费率结构"）：居住舱 Lv3 解锁（旧 v0.6 线
  // =−1%/人·无门槛·封顶20% 由此取代——那是 6b3 草案时代的预支建模，运行时实为空账）；
  // 费率随居住舱升档 Lv3/6/10=−1/−1.5/−2%/名（编制内），总封顶 −25%（占位·可调）
  workerDiscount: { minHabitatLv: 3, pctLv3: 1.0, pctLv6: 1.5, pctLv10: 2.0, capPct: 25 },
  // 补给站 A 级概率垫层（细案⑥"抽出 A 级/3★ 概率 +0.5%/级·累计 +5% 封顶"）：映射=A 级
  // 本体自然出率的绝对加点（20 抽保底不动·总控回执⑧裁定读法正确）；模型不分级本体，
  // 垫层入账=本体率增量（记简化声明）。下标=补给站等级；每级增量与封顶均为可调旋钮
  //（总控：垫层要"升楼有感"非钉死数字，破四档靶先砍它）——起步取细案面值。
  supplyGacha: { aPctByLv: [0, 0.25, 0.5, 0.75, 0.75, 1.0, 1.25, 1.25, 1.5, 1.75, 2.5] },

  // 事件（3天行动/7天扩张·自然游玩推进；周期过程奖平摊+周期末完成/结算两笔）
  events: {
    cycle3: { supplyTicket: 14, beaconCommon: 2, beaconRare: 2, universal: 8, starOre: 400, completionChest: 1 }, // 券 8→10：B3 补回副口
    // 7天扩张三层（S10.5 2026-07-06 复原·任务单③核对修正）：过程奖=基础资源/居民/工人/
    // 稀有信标/通用碎片（平摊）；完成奖=史诗信标+星核碎片（completion7·周期末一笔）；
    // 结算奖=扩张宝藏完整星核（completionCore·另一笔）。v0 曾把史诗信标折进过程平摊=口径错，
    // 本版拆两笔；星核碎片量值 8/周期为数值域自定（星核通胀红旗下取低·记档）。
    cycle7: { supplyTicket: 24, beaconCommon: 2, beaconRare: 3, universal: 16, starOre: 900, resident: 1, worker: 1 }, // 券 12→16：B3 补回副口
    completion7: { beaconEpic: 1, coreFrag: 6 }, // B4：8→4→6（4 时 salvage×0.8 扰动破带——事件源=扰动免疫，给第 3-5 颗战力核留韧性腿·§15）
    completionCore: 1,
    // 3天结算奖=行动宝藏三选一（2026-07-06 自 v1.0 复原进 S10.5）：传奇插件 / 舰通用碎片 / 员通用碎片
    treasure3: { legendaryPlugin: 1, universalShards: 20 },
    completionThreshold: 0.6,
  },

  // 邮件（迎新+里程碑·一次性）
  mail: {
    day1: { supplyTicket: 10, hullAlloy: 300, starOre: 300, starCargo: 200 },
    day3: { supplyTicket: 5, beaconCommon: 2 },
    day7: { supplyTicket: 8, beaconRare: 1 },
  },

  // 星辉货舱（Boss 大奖/打捞稀有/3天活动完成；#7 广告=期望 ×1.5）
  cargoChest: {
    coreFrag: 1.15, starGem: 1.65, // B4：coreFrag 4→1.5（货舱=核碎第二源 28%）；建筑细案批：1.5→1.15、gem 2→1.65（惊喜线倍率让开箱数+45%·箱内经济量回调=箱数涨内容降·总账≈守恒）
    beacons: { beaconCommon: 1.0, beaconRare: 1.4, beaconEpic: 0.6 }, // A2 提前并入步1：普通权重转稀有（货舱=高稀有浓缩包身份·补 A3 收口后的稀有流量·不走自繁殖链）
    adPickMult: 1.5,
  },

  // 深空回廊（参与度分层主渠道：肝爬得深爬得勤 → 层奖+里程碑显著多）
  corridor: {
    reqBase: 420, reqGrowth: 0.075, echoSpike: 1.25, minutesPerLayer: 1.0,
    layerAlloy: { base: 22, per: 5.5 }, layerToken: { base: 15, per: 3.6 }, layerCargo: { base: 4, per: 1.0 },
    msOre: { base: 100, per: 60 }, msCargo: { base: 50, per: 25 }, msUniversal: { base: 4, per: 1.6 },
    msBeacon: 2, rareBeaconLayer: 25, epicBeaconLayer: 50,
    // B7（步4 稀缺线）：星空宝石大头自打捞挪回廊里程碑（总量≈不变只挪渠道）——爬塔独一份
    // 的攒头（攒宝石换想要的核）；刻意不吃 #10 广告 msMult：宝石=稀缺定向货币，分层靠爬得
    // 深不靠看广告（护"常规轨加速不碰稀缺线"口径·同 #5/#7 喂核不提速教训）
    msGem: { base: 16, per: 1.8 }, // 前置加厚版（11 里程碑总量≈295 不变）：轻度爬层慢，宝石线后置在 gacha×0.8 扰动下顶破毕业墙（墙10·§15）
  },

  // 战败安慰包（仅主线·卡关日 1 次尝试）
  consolation: { hullAlloy: 45, pilotToken: 30, firstDefeatBeacon: 1 },

  // 星港趣事（微量）
  anecdote: { chance: 0.15, starCargo: 3, starOre: 3 },

  // 建筑解锁脚本（节点/天触发；解锁占位花费=强引导 8/5/8/5）
  unlock: {
    dockNode: 1, trainingNode: 1, supplyNode: 3, salvageNode: 4, merchantNode: 5,
    habitatNode: 8, galleryNode: 15, researchDay: 5,
    unlockCosts: { dock: 8, training: 5, supply: 8, salvage: 5, merchant: 5 },
  },
  // 建筑细案入尺批：船坞/训练舱携折扣线入列（细案①·6→8 栋=新增星矿 sink 对冲工人折扣
  // 收窄）。排位实测（任务单点名·四序对比记校准日志）：收入栋（居住/打捞）在前 →
  // 补给站（免费抽=每天看得见的甜头·Lv4 起 +1 抽/日=玩家贪心可信）→ 折扣栋（船坞/
  // 训练=军饷效率准收入）→ 研究/商人/展厅。四序四档全稳（±1 天）、黑市党对排位敏感
  //（dock 第3位=D28 出带·dockLast=D27 贴边·本序=D26 带内有余量）——取本序。
  buildingPriority: ['habitat', 'salvage', 'supply', 'training', 'dock', 'research', 'merchant', 'gallery'],
  oreReserve: 0,
  // 建筑成本全局系数（6b3 草案自述"v0.1 起步值·原型校准"——尺子校准解=×3，
  // 让建筑线成为星矿的真实长期 sink，压死"溢出回收灌爆星贝"的死水；记入初值表待回写）
  buildingCostMult: 3.0,

  // 板凳深度（任务单⑤第一段·结构三件之三）：主力满阶/满星后的溢出专属碎片 + 非主力
  // 归属碎片（P8 沉淀）不再纯浪费——真实玩家会练第 6+ 艘板凳舰，板凳价值=对词缀/克制
  // 换搭配的应对空间（S2/S8 克制真实存在），与 tinkerBonus 同一机制层，折算为小幅有效
  // 战力乘区：benchPct = cap × (1 − e^(−pool/scale))，递减收益 + 封顶。量级第一性：普通
  // 毕业死碎片池 ≈5000 ≈ 1-2 艘 S 级板凳的换搭配价值 ≈2-3% 有效战力（远小于研究塔 10%/
  // 展厅 10%=真"小乘区"）；cap 实测上限=0.03（0.035 起板凳把普通档抬快→压力表整体校贵→
  // salvage×0.8 扰动下肝/重被顶出带=抗漂移护栏红，调参记档任务单⑤）。顺带治黑市党五主力
  // SS 饱和假象（步3 记档）：舰包碎片在满阶后流入板凳池继续产生边际价值，BM 带收回 D22-25。
  bench: { cap: 0.03, scale: 6000 },

  // 长墙试错累积（任务单⑧·成文 §5 软参数）：墙下连续卡 N 天=玩家已试错 N 天（换搭配/
  // 摸克制与词缀解法·S8"墙期体验含换搭配试错"的时间维度），每连续卡 1 天 +1% 有效战力、
  // 封顶 +4%——tinkerBonus 是"平时"的试错空间常数、这条是"卡墙越久越接近解法"的累积项；
  // 破墙即清零。量级由墙"太便宜"探测器（矩阵带下限）反推封顶。
  stallTinker: { perDay: 0.007, cap: 0.03 },

  // 欧非包络（三个关键随机项·任务单硬规格 #3）——任务单⑧：委托金卡改明保底后
  // 品质随机轴消亡（受控方差哲学的机器体现），欧非第三轴换成星核运气 coreLuck
  //（乘 扩张宝藏曲率星门概率 + 宝箱整核/毕业核尾概率 = 开蛋/宝箱类渠道的欧非表达）。
  envelope: {
    expected: { mainShardShare: 0.34, coreLuck: 1.0, salvageRollMult: 1.0 },
    lucky: { mainShardShare: 0.44, coreLuck: 2.0, salvageRollMult: 1.15 },
    unlucky: { mainShardShare: 0.25, coreLuck: 0, salvageRollMult: 0.85 },
  },

  // 广告点位量值（S13 十一点位·任务单⑧总修订案五：广告券不限购新规）
  // offlineDoubleMult = #1 回港报告倍率（×1.5 Ron 2026-07-07 拍A 定案）。
  // #1 口径改"每次上线结算一次离线期收益均可翻倍"：日离线时长拆 会话数 段——首会话
  // 结算隔夜大段（overnightShare），其余会话均分小段；每段翻倍各耗 1 次观看（免费或券）。
  // 福利广告（#5 打捞秒完/#6 赞助券/#10 回廊里程碑）＝每日 1 次铁顶·广告券不可恢复；
  // 其余点位券可无限恢复（#3/#4 全关首通可用=常规轨新大头，25% 总账重验=本单验收 7）。
  ads: { ticketPerAd: 10, salvageInstantDur: 'h8', offlineDoubleMult: 1.5, overnightShare: 0.65 },

  // 黑市（GDD S13.6 · 任务单⑧总修订案三重构：2大轮换+4小坑+宝箱位·强星核退役·n060 解锁）
  blackMarket: {
    unlockNode: 60,   // Ron 2026-07-07 拍板：n060 首通后（"打赢难 Boss 解锁"奖励叙事·旧 v0 提案 30 作废）
    dailyViewCap: 30, // 三道闸①：日计数上限（护 eCPM/防无脑刷）
    // 黑市宝箱（Ron 设计·福利定位）：价 10 计数·每日限购 1·期望回报＞箱价（普惠稳赚）。
    // 购买者=全部看广告画像（"正常看广告玩家每天开得起的固定小确幸"）——频率是计数收入的
    // 自然结果（肝 9-10/日≈每日一箱、重 6≈隔日、普 2≈5 天一箱、轻 0 买不了·Ron 口径修正）。
    // 内容=全游戏物品期望值表（概率塔挂细表·此处为塔的期望值折算）；毕业核极低概率 <1%
    // ＝欧线彩蛋（挂欧非包络 coreLuck），期望线上以 gradCoreP 小数入账。
    box: {
      price: 10,
      give: { hullAlloy: 45, pilotToken: 30, starCargo: 25, universal: 2.5, mainShards: 40, beaconCommon: 0.2, beaconRare: 0.10, beaconEpic: 0.03, coreFrag: 0.5, superiorPlugin: 0.05, legendaryPlugin: 0.02, starGem: 0.3 },
      fullCoreP: 0.004, gradCoreP: 0.002, // 完整流通核/毕业核极低概率（<1% 铁律内）
    },
    // 2 大件坑（固定轮换·日程公示）：高阶星舰 128 / 毕业核·超新星 198（时间成本线）。
    // "强星核（+100 额外战力）"概念退役——bmExtraPower 相关模型量已全部清理。
    goods: {
      shipHigh: { price: 128, give: { shipShards: 1000, pilotShards: 350 } }, // 舰专属+1000(S→SS 整舰当量)+员 350
      supernova: { price: 198, give: { gradCore: 1 } },                       // 毕业核第二渠道（黑市不垄断任何核）
    },
    largeMinPrice: 100,
    // 4 小件坑（每日随机·各限购 1/日·8 品类加权：材料高频打底/信标中频/核低频惊喜）；
    // 期望值口径：每坑=池加权独立抽 → 品类日均可购件数 = 坑数×权重（×手动再刷 1 次/日）。
    smalls: {
      slots: 4, adRerollMult: 2, // 看广告手动再刷 1 次/日（只重掷小坑·该次照计数）→ 可选池翻倍
      pool: {
        shardSmall:  { w: 0.20, price: 40, give: { shipShards: 65, pilotShards: 65 } }, // 专属碎片小包（临门一脚）
        plugSuperior:{ w: 0.16, price: 30, give: { superior: 2 } },                      // 优秀插件包
        plugLegend:  { w: 0.10, price: 45, give: { legendary: 2 } },                     // 传奇插件包
        uniPack:     { w: 0.14, price: 32, give: { universalShards: 60 } },              // 通用碎片包（舰/员）
        coreFragPack:{ w: 0.13, price: 35, give: { coreFrag: 15 } },                     // 星核碎片包
        beaconPack:  { w: 0.12, price: 36, give: { beaconRare: 1, beaconEpic: 0.25 } },  // 稀有·史诗信标
        accelPack:   { w: 0.10, price: 25, give: { accelCredits: 3 } },                  // 打捞加速券三档（免耗星贝的加速额度）
        flowCore:    { w: 0.05, price: 133, give: { flowCore: 1 } },                     // 流通核（8 池随机1·低频压轴·128-138 带）
      },
    },
    // 黑市党购买策略成文（总修订案）：宝箱必买 → 大件攒钱（毕业前=高阶舰；五主力满 SS 后
    // 边际转向超新星=毕业核时间成本线）→ 小件机会型（给大件留足底金才买·优先乘法通道）。
    smallPriority: ['shardSmall', 'plugLegend', 'uniPack', 'plugSuperior', 'coreFragPack', 'beaconPack', 'accelPack'], // flowCore 毕业前不买（大件价·舰包边际碾压=步3 实证沿用·毕业后货架 B8 主场）
  },

  // 压力值校准器（任务单③锚定改造·选型实测记档，过程见初值表 v0.3）：
  // 双锚=普通档「n060 破墙日（早锚）+ 毕业日（晚锚）」，γ 分段常数（n≤60 / n>60），
  // 段内保住重采样给出的相对墙高。选型教训：①单 γ="中后期变富→前段变便宜"耦合
  // （v0 §13 诊断病·早锚治愈）；②锚间对数坡道=把中段墙抬贵、毕业墙压便宜，肝档矩阵
  // 倒挂（弃用）；③加密到四锚（n102/n120 破墙日进锚）=γ₂ 对整数破墙日过拟合而抖动，
  // 首周清关被带出 35-40% 带（弃用）。双锚分段=稳态最优解。
  pressureCalib: { iterations: 6, blend: 0.7, gammaLo: 0.5, gammaHi: 3.0, gammaSteps: 24, anchorNodes: [60], bossSampleHalfDay: true },
  // 对锚与阶梯批（Ron 07-10 十六格墙矩阵靶）：四墙压力点直抬（γ 校准后按倍数抬墙点·尖峰式
  // 不回夹单调——破墙后节点保持原价=大墙后爽段）。选型记档：形状尖峰(bossSpikes)传导链
  // 经 γ 重锚+重采样后量子化且强耦合（+0.04≡+0.08 平台·抬 s120 反打 n102·两轮扫参实证），
  // 按 §20.2"停手换结构"纪律改墙点直抬；值=按各档到达裕量/日增速反解后实测收敛（§16e）。
  // 终值=U4（第七轮装配扫参收敛·§16e 全过程）：普通列 1/2/4/5（n102 差 1=解题墙尺子代理·
  // 已知缺口交 Ron）·n150 四档全中 3/4/5/6·毕业 32/38/46/55 全带内·唯一轴违例=肝 n060 先卡
  // （原理性例外·见 WALL_MONO_EXCEPTIONS）。
  wallPressureLift: { 60: 1.08, 102: 1.08, 120: 1.03, 150: 1.0 },
};

// ---------------------------------------------------------------------------
// 三、四档玩家画像（任务单硬规格 #4：只差参数）
// ---------------------------------------------------------------------------

export const TIERS = {
  // tinkerBonus = 卡关期"换搭配试错"的等效战力折算（S2/S8：墙期体验含换搭配试错；
  // 克制与词缀真实存在，时间多=试出针对性阵容的概率高——按档位折算成小幅有效战力，计入初值表）
  // bountyMinutes / bountyCatchup / bountyPerfect = 任务单⑤参与度真分层三参数（成文策略假设·记初值表）：
  //   bountyMinutes = 悬赏"辅助战斗分钟预算"/日（张数硬约束·真墙日 ×bounty.stallBudgetMult）——
  //     肝 10 分钟打满 4 张+恶补；轻度 3 分钟 ≈2 张/日（15 分钟玩家掐表打卡，板上常年积压）；
  //     对照锁定口径：普通档悬赏日耗时 ≈4.4-6 分钟，落"辅助战斗 5-10 分钟"带内（B1 红线）。
  //   bountyCatchup = 积压>4 时的恶补意愿（张/日附加）——步2 实证全档统一 +3 恶补是"档差
  //     抹平"主漏洞；分层后 15 分钟玩家不恶补（=0），肝档才有"回来清板"行为。
  //   bountyPerfect = 完美通关率（S10.8 完美 ×1.25 的达成率）——悬赏=看戏找策略的词缀战斗，
  //     投入深的玩家更常打出完美（肝 0.6/重 0.55/普 0.5/轻 0.35）；这是悬赏板对肝/重的
  //     顶端分层（张数在 4 张/日封顶后，质量是剩下的参与度轴），B1 后军饷第一源必须
  //     自己带档差、不能全靠打捞背（salvage×0.8 扰动实测教训）。量级记档：肝 0.7 实测把
  //     肝档末墙熔到贴带下沿+扰动带破下限（墙"太便宜"探测器报警），0.6/0.55 是天数与
  //     墙双边都留余量的收敛值（9 变体全绿）。
  // 任务单⑧新增三参数（成文策略假设·§5）：
  //   bountyProbe = 委托难度试探（肝/重/黑市党"打可碾压最高档+试探上一档"，普/轻打稳档）；
  //     试探意愿门槛挂 bountyPerfect（会玩度）：胜率 ≥ (1−bountyPerfect) 才敢上探——
  //     肝 0.6→胜率 40% 就敢试，轻 0.35（不试探）。失败丢单由 #11 保卡兜（免费 1 次/日+券）。
  //   drillSkill = 木桩输出压榨系数（全输出流/搭配实验的会玩差·1.0=量纲标称）；
  //   drillRate = 木桩参与率（打木桩的天数占比·在 dailyCompletion 之外）——木桩是
  //     "自愿实验场"性质、无积压无惩罚，15 分钟玩家时间最紧优先委托/推主线，
  //     ≈1/4 的天不打（轻 0.75）；其余档日常习惯内（1.0）。成文 §5 最软参数。
  //   adTickets = 广告券日购上限（画像按需·总修订案"不限购"下的行为学约束=观看忍耐度：
  //     普通档 2 次/日是忍耐度不是钱包约束，券≈0；肝/重才愿意为肥点位加看；黑市党最高）。
  肝档: {
    minutesPerDay: 150, sessionsPerDay: 6, adsPerDay: 9,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 6, corridorMinutes: 28, shoppingPower: 1.0, tinkerBonus: 0.16, consolationTries: 3, stallCorridorMult: 2.5,
    bountyMinutes: 10, bountyCatchup: 3, bountyPerfect: 0.6,
    bountyProbe: true, drillSkill: 1.08, adTickets: 4,
  },
  重度: {
    minutesPerDay: 90, sessionsPerDay: 4, adsPerDay: 6,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 3, corridorMinutes: 14, shoppingPower: 1.0, tinkerBonus: 0.055, consolationTries: 2, stallCorridorMult: 2.2,
    bountyMinutes: 8, bountyCatchup: 2, bountyPerfect: 0.55,
    bountyProbe: true, drillSkill: 1.04, adTickets: 2,
  },
  普通: {
    minutesPerDay: 35, sessionsPerDay: 2.5, adsPerDay: 2,
    dailyCompletion: 0.92, eventCompletion: 0.95,
    salvageRunsPerQueue: 2, corridorMinutes: 7, shoppingPower: 0.8, tinkerBonus: 0.03, consolationTries: 1,
    bountyMinutes: 6, bountyCatchup: 1, bountyPerfect: 0.5,
    bountyProbe: false, drillSkill: 1.0, adTickets: 0,
  },
  轻度: {
    minutesPerDay: 15, sessionsPerDay: 1.5, adsPerDay: 0,
    dailyCompletion: 0.88, eventCompletion: 0.92,
    salvageRunsPerQueue: 2, corridorMinutes: 5, shoppingPower: 0.75, tinkerBonus: 0.025, consolationTries: 1,
    bountyMinutes: 3, bountyCatchup: 0, bountyPerfect: 0.35,
    bountyProbe: false, drillSkill: 0.92, drillRate: 0.70, adTickets: 0,
  },
  // 第五画像·黑市重度党（S13.6 · 任务单③）：非黑市参数与肝档逐项相同（=基线不变性测试
  // 的前提：关掉 bm 行为后必须与肝档逐字段相等）；日观看 ≈ 常规点位 9 + 券 + 连看
  // 填满至日上限 30。任务单⑧：券改"商店按需"（adTickets 上限内点位恢复），bm.ticket 旧
  // 专项购券口径退役；宝箱=全部看广告画像通用行为（不在 bm 开关内·Ron 口径修正）。
  黑市党: {
    minutesPerDay: 150, sessionsPerDay: 6, adsPerDay: 9,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 6, corridorMinutes: 28, shoppingPower: 1.0, tinkerBonus: 0.16, consolationTries: 3, stallCorridorMult: 2.5,
    bountyMinutes: 10, bountyCatchup: 3, bountyPerfect: 0.6,
    bountyProbe: true, drillSkill: 1.08, adTickets: 4, // 基础券口味=肝档同值（非黑市参数逐项相同=基线不变性前提）
    bm: { chain: true, buy: true, extraTickets: 3 },   // 追加券口味=黑市行为的一部分（类充值投入·随 dis.blackMarket 一起关）
  },
};

export const TARGETS = { 肝档: 30, 重度: 37, 普通: 47, 轻度: 57 };
// 黑市重度党毕业带（Ron 2026-07-08 拍A放宽 [22,27]·取代 07-06"≈D22-25"）——单列，不进四档 TARGETS/档位顺序检查。
// 放宽依据（任务单⑧交回·五杠杆实测推不动）：旧 D24 部分建立在 #10 回廊翻倍幽灵收入 bug 上（v0.5 起
// 存在·⑧修复）；宝箱每日必买吃 1/3 计数+主力 D20 满阶后碎片入板凳封顶——诚实结构下 D26-27。
// 黑市党仍比肝档快 10%+宝箱日爽感+大件牌面，类充值价值成立（Ron 拍板记录=初值表 §18）。
export const BM_TARGET = { tier: '黑市党', min: 22, max: 27 };
// 墙矩阵十六格点靶（Ron 2026-07-10 连环拍·对锚与阶梯批落地——取代旧"肝党锚验收带"，
// 旧带 {60:[0,2],84:[0,1],102:[1,3],120:[2,4],138:[0,1],150:[2,4]} 与 DRIFT 版见 git 历史）。
// 验收口径（总控 07-10 裁定）：普档=爬坡带严格锚；肝/重/轻=点靶±1＋双轴单调＋硬顶 7；
// 0.5 靶（重度 n060）在日粒度尺上 {0,1} 皆中。
export const WALL_MATRIX_TARGET = {
  肝档: { 60: 0, 102: 1, 120: 2, 150: 3 },
  重度: { 60: 0.5, 102: 2, 120: 3, 150: 4 },
  普通: { 60: 1, 102: 3, 120: 4, 150: 5 },
  轻度: { 60: 1, 102: 3, 120: 5, 150: 6 },
};
export const WALL_MATRIX_TOL = 1;        // 基线容差（全档±1·已知缺口 4 格详 §16e·交 Ron 复裁）
export const WALL_MATRIX_DRIFT_TOL = 2;  // ±20% 单源扰动容差（真实经济形变如实反映不静默吸收）
// 双轴单调（越后的墙越长·越轻度越久·非降）记档例外：肝档在 n060 先于重度卡墙——
// 到达时间压缩效应（肝 D8 冲到墙下经济未熟=裸装 74% 撞墙；重 D13 到时已熟=93% 到达裕量、
// 破墙余量 112%+eff 桥，翻墙阈值 ~×1.23 远超肝 ×1.05）。七轮扫参实证任何单墙抬升都无法
// 同时给出"肝0普1"与"肝≤重"，属画像结构非调参可解；绝对进度肝仍领先一周=设计无罪，记档豁免。
export const WALL_MONO_EXCEPTIONS = new Set(['n60:肝档>重度']);
// 福利广告点位（任务单⑧总修订案五·Ron 拍板）：#5 打捞秒完/#6 赞助补给券/#10 回廊里程碑
// 翻倍——每日 1 次铁顶、广告券不可恢复（三者=纯资源生成口：时间门控阀/印钞口/宝石通胀口）。
export const WELFARE_POINTS = new Set(['#5', '#6', '#10']);
// 任何档位任何单墙硬顶（2026-07-06 锁定决策）
export const HARD_WALL_CAP = 7;
// 扰动变体下轻度的瞬时容忍（基线把轻度末墙钉在贴顶 7=«仅毕业墙可近顶»的设计位，任何
// 逆向冲击必然瞬时越顶；护栏承诺=不超过 9、且重调形状参数可收回——尺子如实报告而非静默吸收）
export const HARD_WALL_CAP_DRIFT_LIGHT = 9;

// ---------------------------------------------------------------------------
// 四、拓扑与战力公式
// ---------------------------------------------------------------------------

export function regionOfNode(n, T = TRUTHS) {
  for (const r of T.regionSpans) if (n >= r.from && n <= r.to) return r.sf;
  return T.regionSpans.length;
}

export function nodeStage(n, T = TRUTHS) {
  if (n === T.storyBossNode) return 'storyBoss';
  if (T.bossNodes.includes(n)) return 'boss';
  if (T.eliteNodes.includes(n)) return 'elite';
  return 'normal';
}

export function shipBasePower(tier, level, T = TRUTHS) {
  return T.tierBase[tier] * (1 + T.shipLevelPowerPct * Math.max(0, level - 1));
}

export function pilotCoef(star, level, T = TRUTHS) {
  return T.pilotStarCoef[star - 1] * (1 + T.pilotLevelPct * level);
}

/** 单舰战力 = (星舰基础 + 插件合计) × 驾驶员系数 + 星核加成（B1 §1 + 星核插件计入拍板） */
export function unitPower(ship, pilot, pluginSum, hasCore, T = TRUTHS) {
  const base = shipBasePower(ship.tier, ship.level, T);
  const coef = pilot ? pilotCoef(pilot.star, pilot.level, T) : 1.0;
  return (base + pluginSum) * coef + (hasCore ? T.corePower : 0);
}

/** 队伍战力：上阵主力 + 插件按槽装最优 + 星核装 S 阶槽 + 研究塔/展厅小乘区 */
export function teamPower(st, T = TRUTHS) {
  const lineup = Math.min(5, Math.floor(st.rosterShips), Math.floor(st.rosterPilots) || 1);
  // 展开插件为"件"列表（期望模型允许小数件，按价值排序装配）
  let slots = 0;
  for (let i = 0; i < lineup; i++) slots += T.pluginSlotsByTier[st.mains[i].ship.tier];
  const stock = [
    ...Array(Math.ceil(st.plugins.legendary)).fill().map((_, i) => Math.min(1, st.plugins.legendary - i) * T.pluginPower.legendary),
    ...Array(Math.ceil(st.plugins.superior)).fill().map((_, i) => Math.min(1, st.plugins.superior - i) * T.pluginPower.superior),
    ...Array(Math.ceil(st.plugins.fine)).fill().map((_, i) => Math.min(1, st.plugins.fine - i) * T.pluginPower.fine),
  ].slice(0, Math.max(0, slots));
  let coreSlots = 0;
  for (let i = 0; i < lineup; i++) if (st.mains[i].ship.tier >= 3) coreSlots++;
  let coresLeft = Math.min(Math.floor(st.coresOwned), coreSlots);

  let total = 0, si = 0;
  for (let i = 0; i < lineup; i++) {
    const m = st.mains[i];
    const nSlots = T.pluginSlotsByTier[m.ship.tier];
    let plugSum = 0;
    for (let k = 0; k < nSlots && si < stock.length; k++, si++) plugSum += stock[si];
    const hasCore = m.ship.tier >= 3 && coresLeft > 0;
    if (hasCore) coresLeft--;
    total += unitPower(m.ship, m.pilot, plugSum, hasCore, T);
  }
  const researchPct = T.researchPowerPct(st.buildings.research) / 100;
  const galleryPct = Math.min(T.galleryCapPct,
    st.buildings.gallery >= 1 ? st.coresDistinct * T.galleryPerCorePct(st.buildings.gallery) : 0) / 100;
  return total * (1 + researchPct + galleryPct);
}

// 板凳深度（任务单⑤）：死碎片池 = 非主力归属沉淀（offShards·P8）+ 满阶主力/满星驾驶员
// 身上再也花不出去的专属碎片——真实玩家用它们练第 6+ 艘板凳舰。
export function benchPool(st, T = TRUTHS) {
  let pool = st.offShardsShip + st.offShardsPilot;
  for (const m of st.mains) {
    if (m.ship.owned && m.ship.tier >= T.tierBase.length - 1) pool += m.ship.shards;
    if (m.pilot.owned && m.pilot.star >= T.pilotStarCoef.length) pool += m.pilot.shards;
  }
  return pool;
}

/** 板凳有效战力折算（小乘区·与 tinkerBonus 同层）：cap×(1−e^(−pool/scale))，递减+封顶。 */
export function benchEffPct(pool, P = PARAMS) {
  const B = P.bench;
  if (!B || !(B.cap > 0) || !(pool > 0)) return 0;
  return B.cap * (1 - Math.exp(-pool / B.scale));
}

// —— 建筑细案入尺批 · 三个纯函数（细案①②③⑧·供 gate 手推期望值直测）——

/** 升级币折扣乘数（细案①②）：船坞/训练舱 −1.5%/级，Lv10 毕业 −15%（1→0.985…10→0.85）。 */
export function upgradeDiscountMult(buildingLv, pctPerLv) {
  return 1 - ((pctPerLv ?? 0) * Math.max(0, Math.min(10, buildingLv))) / 100;
}

/** 工人建筑折扣（细案③·居住舱 Lv3 解锁+费率升档+封顶）：返回 0-0.25 的折扣比例。
 *  取代 v0.6 旧线（−1%/人·无门槛·封顶 20%=6b3 草案时代预支建模·运行时实为空账）。 */
export function workerBuildDiscount(habitatLv, workers, P = PARAMS) {
  const W = P.workerDiscount;
  if (!W || habitatLv < W.minHabitatLv) return 0;
  const rate = habitatLv >= 10 ? W.pctLv10 : habitatLv >= 6 ? W.pctLv6 : W.pctLv3;
  return Math.min(W.capPct / 100, (Math.max(0, workers) * rate) / 100);
}

/** 展厅双层分红（细案⑧）：每天按已收集核种数产出——Lv3 起碎片、Lv6 起宝石（/种/日）。 */
export function galleryDividendPerDay(galleryLv, distinct, P = PARAMS, T = TRUTHS) {
  const n = Math.max(0, distinct);
  return {
    coreFrag: galleryLv >= T.galleryFragLv ? P.gallery.fragPerSpecies * n : 0,
    starGem: galleryLv >= T.galleryGemLv ? P.gallery.gemPerSpecies * n : 0,
  };
}

/** 悬赏可打张数（任务单⑤参与度真分层·纯函数供 gate 直测）：
 *  min(积压, 意愿, 剩余分钟, 辅助战斗预算)——
 *  意愿 = 日卡4×完成率 + 恶补（仅积压>日卡时·bountyCatchup 按画像·15分钟玩家=0）；
 *  预算 = bountyMinutes（真墙日 ×stallBudgetMult——零推进的卡关日回来清板）。 */
export function bountyCardsFor(tier, backlog, minutesLeft, wallDay, P = PARAMS, T = TRUTHS) {
  if (!(backlog > 0)) return 0;
  const budgetMin = tier.bountyMinutes * (wallDay ? P.bounty.stallBudgetMult : 1);
  const byBudget = Math.floor(budgetMin / P.bounty.minutesPerCard);
  const canByTime = Math.floor(Math.max(0, minutesLeft) / P.bounty.minutesPerCard);
  // 意愿不取整（期望值口径·任务单⑤修正）：完成率 0.92 = 平均每日漏 0.32 张——此前
  // Math.round 把 3.68 吞成 4，普通档与肝/重在张数上被拉平（B1 后军饷第一源需要
  // 张数期望如实分层；全模型本就允许小数件/小数抽，张数取整是历史遗留的不一致）。
  const want = T.bountyDailyCards * tier.dailyCompletion
    + (backlog > T.bountyDailyCards ? (tier.bountyCatchup ?? 0) : 0);
  return Math.max(0, Math.min(backlog, want, canByTime, byBudget));
}

/** 委托明保底品质期望（任务单⑧·替代旧"金8%+暗保底"随机口径）：
 *  每天 3 张必含 ≥1 银、每 3 天必出 1 金 → 单张期望 金1/9 银1/3 铜5/9（保底=日程表，零方差）。 */
export function commissionQualityEV(T = TRUTHS) {
  const goldPerCard = 1 / T.bountyGoldEveryDays / T.bountyDailyCards;
  const silverPerCard = T.bountySilverPerDay / T.bountyDailyCards;
  const bronzePerCard = 1 - goldPerCard - silverPerCard;
  const qMult = goldPerCard * T.bountyQualityMult.gold
    + silverPerCard * T.bountyQualityMult.silver + bronzePerCard * T.bountyQualityMult.bronze;
  return { goldPerCard, silverPerCard, bronzePerCard, qMult };
}

/** 委托难度选择策略（任务单⑧·成文 §5·纯函数供 gate 直测）。
 *  稳档 = 战力 ≥ crushRatio×推荐战力 的最高档（新手档无门槛兜底）；
 *  试探（仅 bountyProbe 画像）= 稳档的上一档：战力比 ≥ probeMinRatio 且
 *  胜率 ≥ (1−bountyPerfect)（会玩度决定敢不敢上探）才试；胜率=线性带
 *  clamp((ratio−failFloor)/(crushRatio−failFloor))。失败丢单 → #11 保卡重打稳档。
 *  返回 { safe, safeMult, probe|null, probeMult, pWin }。 */
export function pickCommissionDifficulty(tier, power, pressure, P = PARAMS) {
  const D = P.bounty.difficulty;
  const names = ['novice', 'normal', 'hard', 'nightmare'];
  const rec = (d) => pressure[D.recNodes[d]] ?? 1;
  let safeIdx = 0;
  for (let i = 1; i < names.length; i++) if (power >= D.crushRatio * rec(names[i])) safeIdx = i;
  const out = { safe: names[safeIdx], safeMult: D.mults[names[safeIdx]], probe: null, probeMult: 0, pWin: 1 };
  if (tier.bountyProbe && safeIdx < names.length - 1) {
    const next = names[safeIdx + 1];
    const ratio = power / rec(next);
    if (ratio >= D.probeMinRatio) {
      const pWin = Math.max(0, Math.min(1, (ratio - D.failFloor) / (D.crushRatio - D.failFloor)));
      if (pWin >= 1 - (tier.bountyPerfect ?? P.bounty.perfectRate)) {
        out.probe = next; out.probeMult = D.mults[next]; out.pWin = pWin;
      }
    }
  }
  return out;
}

/** 木桩档位（任务单⑧·纯函数）：60 秒总伤 = 战力×d×60×压榨系数，打到阈值表最高可达档。 */
export function drillTierFor(power, skill, P = PARAMS) {
  const D = P.drill;
  const dmg = power * D.dps * D.windowSec * (skill ?? 1);
  let k = 0;
  for (let i = 1; i <= D.tiers; i++) {
    if (dmg >= D.thresholdBase * Math.pow(D.thresholdGrowth, i - 1)) k = i; else break;
  }
  return k;
}

/** 木桩累计奖励（打到第 N 档领 1..N 全部·每日重置）。 */
export function drillCumReward(k, P = PARAMS) {
  const D = P.drill;
  let sum = 0;
  for (let i = 1; i <= Math.min(k, D.tiers); i++) sum += D.rewardBase * Math.pow(D.rewardGrowth, i - 1);
  return sum;
}

/** 星核收藏（种类数）期望（任务单⑧渠道矩阵·期望值口径）：
 *  常规 14 = 陨星弹1 + 强常规2（只出开蛋·低权重）+ 池子款3（开蛋+宝藏池）+ 流通款8
 *  （开蛋+宝藏池+宝库定向+黑市小件+商店稀有格）；毕业核 2（宝库/宝藏欧线/黑市超新星）。
 *  各随机渠道按"每抽命中该核概率"的补集幂计算；宝库定向买必得新种类，与随机渠道的
 *  重叠用比例折算（期望值近似·记模型简化声明）。 */
export function expectedDistinctCores(st, P = PARAMS, T = TRUTHS) {
  const d = st.coreDraws;
  const yolk = d.eggYolk ?? 0; // 双黄蛋第二颗（限流通款·8 池随机）
  const ws = P.core.eggStrongWeight;
  const wReg = (1 - 2 * ws) / 11;              // 开蛋：11 颗常规均分
  const tReg = (1 - P.core.treasureGradP) / 11; // 宝藏池：11 颗常规均分（毕业核概率之外）
  const meteor = st.cleared >= T.storyBossNode ? 1 : 0;
  const strong2 = 2 * (1 - Math.pow(1 - ws, d.egg));
  const pool3 = 3 * (1 - Math.pow(1 - wReg, d.egg) * Math.pow(1 - tReg, d.treasure));
  const flowRand = 8 * (1 - Math.pow(1 - wReg, d.egg) * Math.pow(1 - tReg, d.treasure)
    * Math.pow(1 - 1 / 8, d.bmFlow + d.shopFlow + yolk));
  const vaultDistinct = Math.min(8, d.vaultFlow);
  const grad = Math.min(2, (st.gradCores?.vault ?? 0) + (st.gradCores?.bm ?? 0) + (st.gradCores?.treasureEV ?? 0));
  // 随机渠道种类期望（宝库定向/毕业核之外·宝库重叠按比例折算沿用）
  const randomPart = strong2 + pool3 + flowRand * (8 - vaultDistinct) / 8;
  // 核保底（细案§二1·前 5 颗不重复）：已拥有 <distinctPity 时随机整核渠道只出未拥有款
  // → 前段种类期望=精确线性 min(随机抽数, 5−定核数)；超出后回补集幂（取 max=保底是
  // 下限、两段自然衔接；随机抽数横跨异池按"任一渠道保底通用"合并计，记简化声明）
  const nRandom = d.egg + yolk + d.treasure + (d.bmFlow ?? 0) + (d.shopFlow ?? 0);
  const guaranteed = Math.min(nRandom, Math.max(0, (P.core.distinctPity ?? 0) - meteor));
  return meteor + vaultDistinct + Math.max(randomPart, guaranteed) + grad;
}

// ---------------------------------------------------------------------------
// 五、状态与台账
// ---------------------------------------------------------------------------

export const RESOURCE_KEYS = [
  'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
  'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
  'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket',
];

function newState() {
  return {
    res: Object.fromEntries(RESOURCE_KEYS.map((k) => [k, 0])),
    mains: Array.from({ length: 5 }, (_, i) => ({
      ship: { tier: 0, level: 1, shards: 0, owned: i === 0 },
      pilot: { star: 1, level: 1, shards: 0, owned: i === 0 },
    })),
    rosterShips: 1, rosterPilots: 1,
    offShardsShip: 0, offShardsPilot: 0,
    plugins: { fine: 0, superior: 0, legendary: 0 },
    coresOwned: 0, coresDistinct: 0,
    coreDays: [], // 观测口（步4 稀缺线）：第 i 颗核的到手日（B4 验"前5颗节奏不动+中后期3-5天/颗"）
    // 任务单⑧星核渠道矩阵：分渠道抽数（种类期望用）+ 毕业核分账（到手时点分布=新验收口径）
    // eggYolk=双黄蛋第二颗（限流通款·细案⑧）——单列渠道进流通款补集幂（建筑细案入尺批）
    coreDraws: { egg: 0, eggYolk: 0, treasure: 0, bmFlow: 0, shopFlow: 0, vaultFlow: 0, vaultDupes: 0 },
    gradCores: { vault: 0, bm: 0, treasureEV: 0 },
    gradCoreDays: [], // 毕业核到手日（宝库/黑市=确定日；宝藏欧线走 treasureEV+欧非包络）
    accelCredits: 0,  // 打捞加速券额度（黑市小件·免耗星贝的 2h→8h 升档次数）
    drillTier: 0,     // 木桩当日档位（观测口）
    milestones: [],   // 逐关养成态快照（任务单⑧交付 8·⑥第三段接口）
    buildings: { dock: 0, training: 0, habitat: 0, salvage: 0, merchant: 0, supply: 0, research: 0, gallery: 0 },
    residents: 0, workers: 0,
    cleared: 0, corridorLayer: 0, corridorUnlocked: false,
    pityCounter: { ship: 0, pilot: 0 },
    bountyBacklog: 0, bountyCardsPlayed: 0, bountyDiffMult: 0,
    ledger: { income: {}, spend: {} },
    // 节奏观察口（只读统计·2026-07-07）：逐日×渠道×资源 收/支账 + 专属碎片/插件件数逐日，
    // 供 --pacing 窗口切分；不参与任何经济决策，curDay 由主循环每日更新
    dailyIncomeBySource: [], dailySpendBySource: [], dailyMainShards: [], dailyPlugins: [], curDay: 0,
    negativeViolations: [],
    dailyCleared: [], dailyPower: [], dailyStuck: [], dailyOpenPower: [], dailyMains: [], dailyCorridor: [],
    graduateDay: null,
    adsUsedTotal: 0, adPointUses: {}, chestsOpened: 0,
    // 黑市计数独立账本（不进 14 键钱包——运行时钱包键有 gate 测试钉死且本子步零回写）；
    // boxes=宝箱累计开数（全部看广告画像通用·计数余额自然约束）；ticketsBought=广告券累计
    bm: { balance: 0, earnedTotal: 0, earned: {}, spent: 0, buys: {}, ticketsBought: 0, boxes: 0 },
  };
}

function mkLedgerFns(st, incomeScale) {
  const credit = (source, key, amount) => {
    const scaled = amount * (incomeScale?.[source] ?? 1);
    if (!(scaled > 0)) return;
    st.res[key] = (st.res[key] ?? 0) + scaled;
    const s = (st.ledger.income[source] ??= {});
    s[key] = (s[key] ?? 0) + scaled;
    const ds = ((st.dailyIncomeBySource[st.curDay] ??= {})[source] ??= {});
    ds[key] = (ds[key] ?? 0) + scaled;
  };
  const debit = (source, key, amount) => {
    if (!(amount > 0)) return true;
    if ((st.res[key] ?? 0) + 1e-9 < amount) return false;
    st.res[key] -= amount;
    const s = (st.ledger.spend[source] ??= {});
    s[key] = (s[key] ?? 0) + amount;
    const ds = ((st.dailySpendBySource[st.curDay] ??= {})[source] ??= {});
    ds[key] = (ds[key] ?? 0) + amount;
    return true;
  };
  return { credit, debit };
}

// ---------------------------------------------------------------------------
// 六、子系统（花钱/抽卡/打捞/开箱/主线收益）
// ---------------------------------------------------------------------------

function syncMainOwnership(st) {
  for (let i = 0; i < 5; i++) {
    if (st.rosterShips >= i + 1) st.mains[i].ship.owned = true;
    if (st.rosterPilots >= i + 1) st.mains[i].pilot.owned = true;
  }
}

function creditMainShards(st, kind, totalShards, share) {
  if (!(totalShards > 0)) return;
  const per = (totalShards * share) / 5;
  for (const m of st.mains) {
    if (kind === 'ship') m.ship.shards += per;
    else m.pilot.shards += per;
  }
  if (kind === 'ship') st.offShardsShip += totalShards * (1 - share);
  else st.offShardsPilot += totalShards * (1 - share);
  // 节奏观察口：专属碎片不走 14 键 res，逐日单记（main=主力5单位合计、off=非主力沉淀）
  const dm = (st.dailyMainShards[st.curDay] ??= { shipMain: 0, shipOff: 0, pilotMain: 0, pilotOff: 0 });
  if (kind === 'ship') { dm.shipMain += totalShards * share; dm.shipOff += totalShards * (1 - share); }
  else { dm.pilotMain += totalShards * share; dm.pilotOff += totalShards * (1 - share); }
}

function doGachaPulls(st, pool, pulls, env, P, T) {
  if (!(pulls > 0)) return;
  const poolSize = pool === 'ship' ? P.gacha.poolSizeShips : P.gacha.poolSizePilots;
  const roster = pool === 'ship' ? st.rosterShips : st.rosterPilots;
  creditMainShards(st, pool, pulls * P.gacha.shardPerPullEV, env.mainShardShare);
  const pity = st.pityCounter[pool] + pulls;
  const pityBodies = Math.floor(pity / T.gachaPity);
  st.pityCounter[pool] = pity % T.gachaPity;
  // 补给站 A 级概率垫层（细案⑥·可调旋钮）：A 本体自然出率绝对加点、20 抽保底不动；
  // 模型不分级本体 → 垫层=本体率增量（记简化声明）
  const aBump = (P.supplyGacha?.aPctByLv?.[Math.max(0, Math.min(10, st.buildings.supply))] ?? 0) / 100;
  const bodies = pulls * (P.gacha.bodyP.C + P.gacha.bodyP.B + P.gacha.bodyP.A + aBump) + pityBodies;
  const dupP = Math.min(0.95, roster / poolSize);
  const dupShards = bodies * dupP * P.gacha.dupFoldShards;
  creditMainShards(st, pool, dupShards, env.mainShardShare);
  if (pool === 'ship') st.rosterShips += bodies * (1 - dupP);
  else st.rosterPilots += bodies * (1 - dupP);
  syncMainOwnership(st);
}

function convertUniversal(st, debit) {
  const owned = st.mains.filter((m) => m.ship.owned);
  if (owned.length) {
    const b = owned.sort((a, x) => a.ship.tier - x.ship.tier)[0];
    const u = st.res.shipBlueprint;
    if (u > 0 && debit('convert', 'shipBlueprint', u)) b.ship.shards += u;
  }
  const ownedP = st.mains.filter((m) => m.pilot.owned);
  if (ownedP.length) {
    const b = ownedP.sort((a, x) => a.pilot.star - x.pilot.star)[0];
    const u = st.res.pilotShardUniversal;
    if (u > 0 && debit('convert', 'pilotShardUniversal', u)) b.pilot.shards += u;
  }
}

function doAscends(st, T) {
  let go = true;
  while (go) {
    go = false;
    for (const m of [...st.mains].sort((a, b) => a.ship.tier - b.ship.tier)) {
      if (!m.ship.owned) {
        if (m.ship.shards >= T.synthesizeBodyShards) { m.ship.shards -= T.synthesizeBodyShards; m.ship.owned = true; go = true; }
        continue;
      }
      if (m.ship.tier < 4 && m.ship.shards >= T.shipAscendCost[m.ship.tier]) {
        m.ship.shards -= T.shipAscendCost[m.ship.tier]; m.ship.tier += 1; go = true;
      }
    }
    for (const m of [...st.mains].sort((a, b) => a.pilot.star - b.pilot.star)) {
      if (!m.pilot.owned) {
        if (m.pilot.shards >= T.synthesizeBodyShards) { m.pilot.shards -= T.synthesizeBodyShards; m.pilot.owned = true; go = true; }
        continue;
      }
      if (m.pilot.star < 5 && m.pilot.shards >= T.pilotStarupCost[m.pilot.star - 1]) {
        m.pilot.shards -= T.pilotStarupCost[m.pilot.star - 1]; m.pilot.star += 1; go = true;
      }
    }
  }
}

// 建筑细案入尺批：导出供 gate 手推直测（折扣线接线的机器可验）
export function doLevelUps(st, debit, T) {
  // 船坞/训练舱折扣线（细案①②·建筑细案入尺批）：只折升级币（合金/驾驶记录）——
  // 升阶/升星/合成走专属碎片（doAscends），结构上不经过此路径=细案"专属碎片永不打折"
  const dockMult = upgradeDiscountMult(st.buildings.dock, T.dockDiscountPctPerLv);
  const trainMult = upgradeDiscountMult(st.buildings.training, T.trainingDiscountPctPerLv);
  const lineup = Math.min(5, Math.floor(st.rosterShips));
  for (let guard = 0; guard < 5000; guard++) {
    let best = null;
    for (let i = 0; i < lineup; i++) {
      const m = st.mains[i];
      if (!m.ship.owned || m.ship.level >= T.shipLevelCapByTier[m.ship.tier]) continue;
      const c = Math.round(T.shipLevelCost(m.ship.level) * dockMult);
      if (!best || c < best.cost) best = { m, cost: c };
    }
    if (!best || !debit('shipLevel', 'hullAlloy', best.cost)) break;
    best.m.ship.level += 1;
  }
  const lineupP = Math.min(5, Math.floor(st.rosterPilots));
  for (let guard = 0; guard < 5000; guard++) {
    let best = null;
    for (let i = 0; i < lineupP; i++) {
      const m = st.mains[i];
      if (!m.pilot.owned || m.pilot.level >= T.pilotLevelCapByStar[m.pilot.star - 1]) continue;
      const c = Math.round(T.pilotLevelCost(m.pilot.level) * trainMult);
      if (!best || c < best.cost) best = { m, cost: c };
    }
    if (!best || !debit('pilotLevel', 'pilotToken', best.cost)) break;
    best.m.pilot.level += 1;
  }
}

function doPluginCraft(st) {
  const fineKeep = 12, supKeep = 9;
  if (st.plugins.fine > fineKeep) {
    st.plugins.superior += (st.plugins.fine - fineKeep) / 3;
    st.plugins.fine = fineKeep;
  }
  if (st.plugins.superior > supKeep) {
    st.plugins.legendary += (st.plugins.superior - supKeep) / 3;
    st.plugins.superior = supKeep;
  }
}

function doBuildings(st, debit, P, T) {
  // 工人折扣新规（细案③·总控回执③）：Lv3 解锁门＋费率 Lv3/6/10 升档＋封顶 25%（占位）
  const disc = workerBuildDiscount(st.buildings.habitat, st.workers, P);
  for (let guard = 0; guard < 100; guard++) {
    let done = false;
    for (const b of P.buildingPriority) {
      if (st.buildings[b] <= 0 || st.buildings[b] >= T.buildingMaxLevel) continue;
      const cost = Math.round(T.buildingCost(st.buildings[b], T.buildingImportance[b]) * P.buildingCostMult * (1 - disc));
      if (st.res.starOre - cost >= P.oreReserve && debit('building', 'starOre', cost)) {
        st.buildings[b] += 1; done = true; break;
      }
    }
    if (!done) break;
  }
  const allCapped = P.buildingPriority.every((b) => st.buildings[b] === 0 || st.buildings[b] >= T.buildingMaxLevel);
  if (allCapped && st.buildings.merchant >= 2 && st.res.starOre > 2000) {
    const surplus = st.res.starOre - 2000;
    if (debit('oreRecycle', 'starOre', surplus)) {
      st.res.starCargo += surplus / 8; // A1 步3：回收率 4:1→8:1（回收阀退回应急位，不再制造星贝死水）
      const s = (st.ledger.income.oreRecycle ??= {});
      s.starCargo = (s.starCargo ?? 0) + surplus / 8;
      const ds = ((st.dailyIncomeBySource[st.curDay] ??= {}).oreRecycle ??= {});
      ds.starCargo = (ds.starCargo ?? 0) + surplus / 8;
    }
  }
}

// 建筑细案入尺批：导出供 gate 手推期望值直测（注入 st/debit——双黄蛋/开蛋九折机器可验）
export function doCores(st, debit, day, env, P, T) {
  // 合成=随机开蛋（任务单⑧·13 常规池·2 强常规低权重）：总数照常 +1，种类走期望收藏。
  // 展厅 Lv10 里程碑（细案⑧·建筑细案入尺批）：双黄蛋 doubleYolkP（第二颗限流通款·
  // eggYolk 单列渠道）或开蛋九折 eggLv10CostMult（三案对照的案C）——都只在 Lv10 生效。
  const lv10 = st.buildings.gallery >= 10;
  const eggCost = Math.round(P.core.synthesisFragCost * (lv10 ? (P.core.eggLv10CostMult ?? 1) : 1));
  const yolkP = lv10 ? (P.core.doubleYolkP ?? 0) : 0;
  while (st.res.coreFrag >= eggCost && debit('coreSynthesis', 'coreFrag', eggCost)) {
    st.coresOwned += 1 + yolkP;
    st.coreDraws.egg += 1;
    if (yolkP > 0) st.coreDraws.eggYolk += yolkP;
  }
  // 宝库（8 流通统一价 + 2 毕业更贵）：①5 核槽未满=流通款定向补新（战力边际最高）；
  // ②槽满后转攒毕业核（B7"攒宝石换想要的核"落名——攒钱期不买流通款）；③2 颗毕业核
  // 到手后回流通复购（同款第 2 份起 ×1.5 递增="全队配同款"慢速线=终局宝石 sink）。
  for (let guard = 0; guard < 10; guard++) {
    const gradLeft = 2 - Math.min(2, st.gradCores.vault + st.gradCores.bm);
    if (st.coresOwned >= P.core.gradSaveAfterCores && gradLeft > 0) {
      if (st.res.starGem >= P.core.vaultGradPrice && debit('coreVault', 'starGem', P.core.vaultGradPrice)) {
        st.coresOwned += 1; st.gradCores.vault += 1; st.gradCoreDays.push(day);
        continue;
      }
      break;
    }
    const price = st.coreDraws.vaultFlow < 8
      ? P.core.vaultFlowPrice
      : Math.round(P.core.vaultFlowPrice * Math.pow(T.vaultRepeatPriceGrowth, st.coreDraws.vaultDupes + 1));
    if (st.res.starGem >= price && debit('coreVault', 'starGem', price)) {
      st.coresOwned += 1;
      if (st.coreDraws.vaultFlow < 8) st.coreDraws.vaultFlow += 1; else st.coreDraws.vaultDupes += 1;
    } else break;
  }
  st.coresDistinct = Math.min(16, expectedDistinctCores(st, P, T));
}

// 临门一脚碎片投放（黑市/宝箱共用口径）：给离下一次升阶/升星缺口最小的可升主力；
// 全员到顶后给阶/星最低者兜底（溢出碎片流入板凳池继续产边际价值）。
function grantTargetedShards(st, shipShards, pilotShards) {
  if (shipShards > 0) {
    const cand = st.mains.filter((m) => m.ship.owned && m.ship.tier < 4)
      .sort((a, b) => (TRUTHS.shipAscendCost[a.ship.tier] - a.ship.shards) - (TRUTHS.shipAscendCost[b.ship.tier] - b.ship.shards));
    const target = cand[0] ?? st.mains.filter((m) => m.ship.owned).sort((a, b) => a.ship.tier - b.ship.tier)[0];
    if (target) target.ship.shards += shipShards;
  }
  if (pilotShards > 0) {
    const cand = st.mains.filter((m) => m.pilot.owned && m.pilot.star < 5)
      .sort((a, b) => (TRUTHS.pilotStarupCost[a.pilot.star - 1] - a.pilot.shards) - (TRUTHS.pilotStarupCost[b.pilot.star - 1] - b.pilot.shards));
    const target = cand[0] ?? st.mains.filter((m) => m.pilot.owned).sort((a, b) => a.pilot.star - b.pilot.star)[0];
    if (target) target.pilot.shards += pilotShards;
  }
}

// 黑市宝箱（任务单⑧·Ron 口径修正版）：全部看广告画像的通用行为、每日限购 1，
// 购买受"计数余额 ≥ 箱价"自然约束——频率是计数收入的自然结果（肝 9-10/日≈每日一箱、
// 重 6≈隔日、普 2≈5 天一箱、轻 0 买不了），不做凭空扣负或全档拉平。
// 账目归 bmBox 源（黑市轨）：25% 常规轨硬线不计宝箱、另报一行透明化（Ron 拍板口径）。
function doBmBox(st, credit, env, P) {
  if (st.cleared < P.blackMarket.unlockNode) return;
  const B = P.blackMarket.box;
  if (st.bm.balance < B.price) return;
  st.bm.balance -= B.price; st.bm.spent += B.price;
  st.bm.boxes += 1; st.bm.buys.box = (st.bm.buys.box ?? 0) + 1;
  for (const [k, v] of Object.entries(B.give)) {
    if (k === 'universal') { credit('bmBox', 'shipBlueprint', v / 2); credit('bmBox', 'pilotShardUniversal', v / 2); }
    else if (k === 'mainShards') grantTargetedShards(st, v / 2, v / 2);
    else if (k === 'superiorPlugin') st.plugins.superior += v;
    else if (k === 'legendaryPlugin') st.plugins.legendary += v;
    else credit('bmBox', k, v);
  }
  const luck = env.coreLuck ?? 1;
  if (B.fullCoreP > 0) { st.coresOwned += B.fullCoreP * luck; st.coreDraws.bmFlow += B.fullCoreP * luck; }
  if (B.gradCoreP > 0) { st.coresOwned += B.gradCoreP * luck; st.gradCores.treasureEV += B.gradCoreP * luck; }
}

// 黑市货架（任务单⑧总修订案三·黑市党画像）：2 大件坑（高阶舰 128/超新星 198 固定轮换）
// ＋4 小件坑（8 品类加权随机·各限购 1/日·看广告手动再刷 1 次/日→可选池翻倍）。
// 购买策略成文：宝箱必买（doBmBox 已先行）→ 大件攒钱（毕业前=高阶舰；五主力满 SS 后
// 边际转向超新星=毕业核时间成本线·"核类毕业前 0 购"步3 实证的如实延续）→ 小件机会型：
// 非墙日给下一个大件留足底金（20/日结余几乎全喂大件·小件只吃溢出≈0）；**真墙日=机会型
// 的本义**——卡在墙下时大件（128 计数 ≈6 天储蓄）远水不解近渴，立即战力小件（插件包/
// 临门一脚碎片包）不留底金直接破墙（实测黑市党 D22 到 n150 墙下白攒 4 天=此行为的场景）。
function doBlackMarket(st, credit, day, prevWall, P) {
  if (st.cleared < P.blackMarket.unlockNode) return;
  const BM = P.blackMarket;
  const shipsSaturated = st.mains.every((m) => m.ship.owned && m.ship.tier >= 4);
  const bigId = shipsSaturated && st.gradCores.bm < 1 ? 'supernova' : 'shipHigh';
  const big = BM.goods[bigId];
  if (st.bm.balance >= big.price) {
    st.bm.balance -= big.price; st.bm.spent += big.price;
    st.bm.buys[bigId] = (st.bm.buys[bigId] ?? 0) + 1;
    if (big.give.shipShards) grantTargetedShards(st, big.give.shipShards, big.give.pilotShards ?? 0);
    if (big.give.gradCore) { st.coresOwned += big.give.gradCore; st.gradCores.bm += big.give.gradCore; st.gradCoreDays.push(day); }
  }
  const reserve = prevWall ? 0 : big.price; // 长墙日小件不留底金（机会型）·非墙日攒大件
  const offers = BM.smalls.slots * BM.smalls.adRerollMult;
  // 长墙日只买"立即战力"件（插件包=装上就涨；碎片包凑不满升阶=零即时战力、加速券非战力
  // ——首版长墙清仓把 shardSmall/accelPack 也买了=白花计数还拖船·深度自检修正）
  const buyOrder = prevWall ? ['plugLegend', 'plugSuperior', 'shardSmall'] : BM.smallPriority;
  for (const id of buyOrder) {
    const g = BM.smalls.pool[id];
    const avail = Math.min(1, offers * g.w); // 每坑独立抽+每品类限购 1/日 → 期望件数封顶 1
    if (!(avail > 0) || st.bm.balance - g.price * avail < reserve) continue;
    st.bm.balance -= g.price * avail; st.bm.spent += g.price * avail;
    st.bm.buys[id] = (st.bm.buys[id] ?? 0) + avail;
    const gv = g.give;
    if (gv.shipShards) grantTargetedShards(st, gv.shipShards * avail, (gv.pilotShards ?? 0) * avail);
    if (gv.universalShards) {
      credit('bmShelf', 'shipBlueprint', (gv.universalShards / 2) * avail);
      credit('bmShelf', 'pilotShardUniversal', (gv.universalShards / 2) * avail);
    }
    if (gv.beaconRare) credit('bmShelf', 'beaconRare', gv.beaconRare * avail);
    if (gv.beaconEpic) credit('bmShelf', 'beaconEpic', gv.beaconEpic * avail);
    if (gv.coreFrag) credit('bmShelf', 'coreFrag', gv.coreFrag * avail);
    if (gv.superior) st.plugins.superior += gv.superior * avail;
    if (gv.legendary) st.plugins.legendary += gv.legendary * avail;
    if (gv.accelCredits) st.accelCredits += gv.accelCredits * avail;
    if (gv.flowCore) { st.coresOwned += gv.flowCore * avail; st.coreDraws.bmFlow += gv.flowCore * avail; }
  }
}

function openCargoChest(st, credit, count, adPick, P) {
  if (!(count > 0)) return;
  const mult = adPick ? P.cargoChest.adPickMult : 1.0;
  credit('cargoChest', 'coreFrag', P.cargoChest.coreFrag * count * mult);
  credit('cargoChest', 'starGem', P.cargoChest.starGem * count * mult);
  for (const [k, v] of Object.entries(P.cargoChest.beacons)) credit('cargoChest', k, v * count * mult);
  st.chestsOpened += count;
}

// 惊喜线四族（细案④⑤"稀有发现"作用面）：居民/工人/货舱/插件——经济线（软货币/通碎/
// 信标/核碎/宝石）不吃稀有发现倍率；导出供 gate 钉作用面。
export const SALVAGE_SURPRISE_KEYS = new Set(['resident', 'worker', 'cargoChest', 'finePlugin', 'superiorPlugin', 'legendaryPlugin']);

// 建筑细案入尺批：导出供 gate 手推期望值直测（注入 st/credit/debit——队数/长趟守恒刀/惊喜线/额外骰接线机器可验）
export function doSalvage(st, credit, debit, tier, env, adRun, P, T) {
  const queues = T.salvageQueues(st.buildings.salvage);
  if (queues <= 0) return;
  // 每队 1 趟 24h 保底（信标效率优先）；剩余按档位趟数计划加 2h 短趟消化（时间效率优先）；
  // 短趟可用加速券升为 8h 档产出（星贝盈余时购买）；广告 #5 追加一趟 8h 档。
  // 建筑细案入尺批：队数 3/4/5 的守恒刀只落 24h 长趟（yieldScaleDur·选型记档见 PARAMS 注）；
  // 稀有发现线（+5%/级·累计 +35%）只乘惊喜线掷骰；Lv10 24h 长趟额外一次惊喜掷骰
  //（额外骰同吃守恒系数=单位统一，惊喜倍率在缩减后基数上生效——对齐已确认方针）。
  const ys = P.salvage.yieldScale ?? 1;
  const surpriseMult = 1 + 0.05 * T.salvageSurpriseLvls(st.buildings.salvage);
  const runs = queues * tier.salvageRunsPerQueue + (adRun ? 1 : 0);
  for (let r = 0; r < runs; r++) {
    const isAd = adRun && r === runs - 1;
    const isLong = r < queues;
    const bkey = st.res.beaconEpic >= 1 ? 'beaconEpic' : st.res.beaconRare >= 1 ? 'beaconRare' : st.res.beaconCommon >= 1 ? 'beaconCommon' : null;
    if (!bkey || !debit('salvage', bkey, 1)) break;
    const def = P.salvage.tiers[bkey === 'beaconEpic' ? 'epic' : bkey === 'beaconRare' ? 'rare' : 'common'];
    let dur = isAd ? P.ads.salvageInstantDur : isLong ? 'h24' : 'h2';
    if (dur === 'h2' && st.accelCredits >= 1) { st.accelCredits -= 1; dur = 'h8'; } // 黑市加速券额度优先
    else if (dur === 'h2' && st.res.starCargo > P.merchant.richThreshold
      && debit('salvageAccel', 'starCargo', P.salvage.accel.price)) dur = 'h8'; // 加速券（星贝）
    const ysRun = !P.salvage.yieldScaleDur || dur === P.salvage.yieldScaleDur ? ys : 1;
    const mult = T.salvageTimeMult[dur] * ysRun;
    credit('salvage', 'starOre', def.ore * mult);
    credit('salvage', 'starCargo', def.cargo * mult);
    credit('salvage', 'shipBlueprint', (def.universal * mult) / 2);
    credit('salvage', 'pilotShardUniversal', (def.universal * mult) / 2);
    for (const [k, v] of Object.entries(def.fixed)) credit('salvage', k, v * ysRun);
    const rolls = def.rolls[dur] * env.salvageRollMult * ysRun; // 经济线掷骰（守恒刀）
    const sRolls = (def.rolls[dur] + (st.buildings.salvage >= T.salvageExtraRollLv && dur === 'h24' ? 1 : 0))
      * env.salvageRollMult * ysRun * surpriseMult;             // 惊喜线掷骰（稀有发现线+Lv10 额外骰）
    const ev = def.rollEV;
    if (ev.universal) { credit('salvage', 'shipBlueprint', (rolls * ev.universal) / 2); credit('salvage', 'pilotShardUniversal', (rolls * ev.universal) / 2); }
    if (ev.supplyTicket) credit('salvage', 'supplyTicket', rolls * ev.supplyTicket);
    if (ev.beaconCommon) credit('salvage', 'beaconCommon', rolls * ev.beaconCommon);
    if (ev.beaconRare) credit('salvage', 'beaconRare', rolls * ev.beaconRare);
    if (ev.beaconEpic) credit('salvage', 'beaconEpic', rolls * ev.beaconEpic);
    if (ev.coreFrag) credit('salvage', 'coreFrag', rolls * ev.coreFrag);
    if (ev.starGem) credit('salvage', 'starGem', rolls * ev.starGem);
    if (ev.finePlugin) st.plugins.fine += sRolls * ev.finePlugin;
    if (ev.superiorPlugin) st.plugins.superior += sRolls * ev.superiorPlugin;
    if (ev.legendaryPlugin) st.plugins.legendary += sRolls * ev.legendaryPlugin;
    // 步3 人口封顶：容量=6+2×居住舱级（lv10=26）——细案③改口径后=有效编制（超编纯人气，
    // 期望值模型等价）；居民/工人=惊喜线（吃稀有发现倍率·与细案⑤"联动看住"对齐）
    const popCapS = 6 + 2 * st.buildings.habitat;
    if (ev.resident) st.residents = Math.min(popCapS, st.residents + sRolls * ev.resident);
    if (ev.worker) st.workers = Math.min(popCapS, st.workers + sRolls * ev.worker);
    if (ev.cargoChest) openCargoChest(st, credit, sRolls * ev.cargoChest, false, P);
  }
}

function creditPickEV(st, credit, ev, picks, coef) {
  for (const m of st.mains) {
    m.ship.shards += (ev.mainShipShard * picks) / 5;
    m.pilot.shards += (ev.mainPilotShard * picks) / 5;
  }
  st.offShardsShip += (ev.offShard * picks) / 2;
  st.offShardsPilot += (ev.offShard * picks) / 2;
  if (ev.supplyTicket) credit('mainlinePick', 'supplyTicket', ev.supplyTicket * picks);
  if (ev.coreFrag) credit('mainlinePick', 'coreFrag', ev.coreFrag * picks);
  if (ev.starOreBase) credit('mainlinePick', 'starOre', ev.starOreBase * coef * picks);
  if (ev.beaconCommon) credit('mainlinePick', 'beaconCommon', ev.beaconCommon * picks);
  if (ev.beaconRare) credit('mainlinePick', 'beaconRare', ev.beaconRare * picks);
  if (ev.beaconEpic) credit('mainlinePick', 'beaconEpic', ev.beaconEpic * picks);
  if (ev.starGem) credit('mainlinePick', 'starGem', ev.starGem * picks);
  if (ev.finePlugin) st.plugins.fine += ev.finePlugin * picks;
  if (ev.superiorPlugin) st.plugins.superior += ev.superiorPlugin * picks;
  if (ev.legendaryPlugin) st.plugins.legendary += ev.legendaryPlugin * picks;
}

function nodeClearIncome(st, credit, n, opts, P, T) {
  const stage = nodeStage(n, T);
  const coef = P.regionCoef[regionOfNode(n, T) - 1] ?? 1;
  const mult = stage === 'boss' ? P.mainline.bossMult : stage === 'elite' ? P.mainline.eliteMult : stage === 'storyBoss' ? P.mainline.storyBossMult : 1;
  const fixMult = mult * coef * (opts.adDouble ? 2 : 1);
  credit('mainline', 'hullAlloy', P.mainline.fixedAlloyBase * fixMult);
  credit('mainline', 'pilotToken', P.mainline.fixedTokenBase * fixMult);
  credit('mainline', 'starCargo', P.mainline.fixedCargoBase * fixMult);

  const evKey = stage === 'boss' ? 'boss' : stage === 'storyBoss' || stage === 'elite' ? 'elite' : 'normal';
  const picks = 1 + (opts.adExtraPick ? P.mainline.adExtraPickMult : 0);
  creditPickEV(st, credit, P.mainline.pickEV[evKey], picks, coef);

  if (n <= P.tutorialGrant.untilNode) st.mains[0].ship.shards += P.tutorialGrant.perNodeMainShard;
  if (stage === 'storyBoss') { st.coresOwned += 1; st.corridorUnlocked = true; }
  else if (stage === 'boss') openCargoChest(st, credit, 1, opts.watcherChest, P);
  if (n === 3) { st.rosterShips = Math.max(st.rosterShips, 2); st.rosterPilots = Math.max(st.rosterPilots, 2); syncMainOwnership(st); }
  if (n === 5) { st.rosterPilots = Math.max(st.rosterPilots, 3); syncMainOwnership(st); }
}

// ---------------------------------------------------------------------------
// 七、主模拟（单档一遍）
// ---------------------------------------------------------------------------

/**
 * @param {string} tierName
 * @param {number[]} pressure 150 关压力值表（校准器产出；下标 1..150）
 * @param {object} opts { envelope, ads:'profile'|'none'|'full', disable:{...},
 *                        incomeScale:{source:mult}, pause:{from,days}, runFullDays }
 */
export function simulateEconomyTier(tierName, pressure, opts = {}, P = PARAMS, T = TRUTHS) {
  const tier = TIERS[tierName];
  if (!tier) throw new Error(`unknown tier ${tierName}`);
  const env = P.envelope[opts.envelope ?? 'expected'];
  const dis = opts.disable ?? {};
  const st = newState();
  const { credit, debit } = mkLedgerFns(st, opts.incomeScale);
  const adsPerDay = opts.ads === 'none' ? 0 : opts.ads === 'full' ? 9 : tier.adsPerDay;
  const watcher = adsPerDay > 0;
  let ev3Anchor = 1, ev7Anchor = 1;

  for (let day = 1; day <= P.maxDays; day++) {
    st.curDay = day;
    const paused = opts.pause && day >= opts.pause.from && day < opts.pause.from + opts.pause.days;
    const clearedRegions = T.regionSpans.filter((r) => st.cleared >= r.to).length;
    const offCoef = P.regionCoef[clearedRegions];
    let adsLeft = paused ? 0 : adsPerDay;
    let minutes = paused ? 0 : tier.minutesPerDay;
    // 黑市计数（S13.6：全游戏任何激励视频观看 +1，日上限 30）——计数对所有画像常开；
    // dis.blackMarket 只关"货架/连看"主动行为（基线不变性测试用）；宝箱=看广告画像通用
    // 行为不在此开关内（dis.bmBox 单独门·供 25% 常规轨口径测量）。
    const bmActive = !dis.blackMarket && tier.bm;
    let bmViewsToday = 0;
    const bmView = (type) => {
      if (bmViewsToday >= P.blackMarket.dailyViewCap) return false;
      bmViewsToday++;
      st.bm.balance++; st.bm.earnedTotal++;
      st.bm.earned[type] = (st.bm.earned[type] ?? 0) + 1;
      return true;
    };
    // 广告券新规（任务单⑧总修订案五）：福利广告 WELFARE_POINTS 每日 1 次铁顶、券不可恢复；
    // 其余点位免费额度用尽后可用券恢复（商店常驻 70 星贝·画像按需上限 adTickets）。
    // ads:'full' 双跑=满口径（9 免费+肝档券策略 4）——测设计暴露度而非单画像口味。
    const merchDisc = () => (st.buildings.merchant >= 10 ? P.merchant.discountLv10 : 1);
    let ticketsLeft = paused ? 0 : opts.ads === 'none' ? 0
      : opts.ads === 'full' ? 4
        : (tier.adTickets ?? 0) + (bmActive ? (tier.bm?.extraTickets ?? 0) : 0);
    // keepFree/keepTickets = 给后续肥点位留的储备（#10 回廊里程碑走免费·#11 保卡走免费或券）；
    // ONCE_PER_DAY=S13.2"每日 1 次"点位的显式守卫——#10 回廊一天可跨多个里程碑、流程结构
    // 挡不住（v0.5 起即有的隐性超发·⑧咬合测试曝光修正）；#1 分段/#3/#4 全关/#7/#11 多次=设计本意不入列。
    const dayUses = {};
    const ONCE_PER_DAY = new Set(['#2', '#5', '#6', '#8', '#9', '#10']);
    const useView = (point, { keepFree = 0, keepTickets = 0 } = {}) => {
      if (ONCE_PER_DAY.has(point) && (dayUses[point] ?? 0) >= 1) return false;
      const took = () => {
        dayUses[point] = (dayUses[point] ?? 0) + 1;
        st.adsUsedTotal++; st.adPointUses[point] = (st.adPointUses[point] ?? 0) + 1;
      };
      if (adsLeft > keepFree && adsLeft > 0) { adsLeft--; took(); bmView('points'); return true; }
      if (WELFARE_POINTS.has(point)) return false; // 福利广告：不可券恢复（一天多一次都不行）
      if (ticketsLeft > keepTickets && ticketsLeft > 0 && st.buildings.merchant >= 1) {
        const price = P.merchant.adTicketPrice * merchDisc();
        if (st.res.starCargo - price >= P.merchant.richThreshold / 2 && debit('adTicket', 'starCargo', price)) {
          ticketsLeft--; st.bm.ticketsBought++; took(); bmView('ticket'); return true;
        }
      }
      return false;
    };
    // 储备位：回廊里程碑 #10（福利·免费额度）、委托保卡 #11（试探画像·免费或券）
    const prober = !paused && tier.bountyProbe && st.cleared >= 5;
    const reserveFree = (watcher && st.corridorUnlocked ? 1 : 0) + (watcher && prober ? 1 : 0);
    const reserveTickets = prober ? 1 : 0;

    // —— 0. 解锁脚本 ——
    const U = P.unlock;
    const tryUnlock = (b, node) => {
      if (st.buildings[b] === 0 && st.cleared >= node) {
        const cost = U.unlockCosts[b] ?? 0;
        if (cost === 0 || debit('unlock', 'starOre', cost)) st.buildings[b] = 1;
      }
    };
    tryUnlock('dock', U.dockNode); tryUnlock('training', U.trainingNode);
    tryUnlock('supply', U.supplyNode); tryUnlock('salvage', U.salvageNode);
    tryUnlock('merchant', U.merchantNode);
    if (st.buildings.habitat === 0 && st.cleared >= U.habitatNode) st.buildings.habitat = 1;
    if (st.buildings.gallery === 0 && st.cleared >= U.galleryNode) st.buildings.gallery = 1;
    if (st.buildings.research === 0 && day >= U.researchDay) st.buildings.research = 1;

    // —— 1. 邮件（一次性·迎新/里程碑）——
    if (!dis.mail && !paused) {
      const pack = day === 1 ? P.mail.day1 : day === 3 ? P.mail.day3 : day === 7 ? P.mail.day7 : null;
      if (pack) for (const [k, v] of Object.entries(pack)) credit('mail', k, v);
    }

    // —— 2. 回港领取（离线+巡逻·停玩后按存储上限补领）——
    const storageH = T.habitatStorageHours(st.buildings.habitat) + Math.min(6, st.residents * 0.5);
    if (!paused && st.buildings.habitat >= 1) {
      let hours = 24 - minutes / 60;
      if (opts.pause && day === opts.pause.from + opts.pause.days) hours += opts.pause.days * 24;
      hours = Math.min(hours, storageH);
      const rateMult = 1 + (T.habitatRatePct(st.buildings.habitat) + st.residents * 1) / 100;
      // #1 回港报告（任务单⑧口径修正：回港=每次上线结算一次离线期收益、每段各可翻倍）：
      // 首会话结算隔夜大段（overnightShare·吃免费额度=当日最肥单点），其余会话小段均分——
      // 小段边际低，只花"留足 #3/#4/#11 之外"的券、不占免费额度（keepFree 99）。
      let dblShare = 0;
      if (watcher && useView('#1')) dblShare += P.ads.overnightShare;
      if (watcher && dblShare > 0) {
        const smallSegs = Math.max(0, Math.round(tier.sessionsPerDay) - 1);
        const perSeg = smallSegs > 0 ? (1 - P.ads.overnightShare) / smallSegs : 0;
        for (let i = 0; i < smallSegs; i++) {
          if (!useView('#1', { keepFree: 99, keepTickets: reserveTickets + 2 })) break;
          dblShare += perSeg;
        }
      }
      const adDouble = 1 + (P.ads.offlineDoubleMult - 1) * dblShare;
      if (!dis.offline) {
        const oreCoef = Math.pow(offCoef, P.oreCoefPow ?? 1);
        credit('offline', 'starOre', P.offline.starOre * oreCoef * rateMult * hours * adDouble);
        credit('offline', 'hullAlloy', P.offline.hullAlloy * offCoef * rateMult * hours * adDouble);
        credit('offline', 'pilotToken', P.offline.pilotToken * offCoef * rateMult * hours * adDouble);
      }
      if (!dis.patrol && clearedRegions >= 1) {
        const docked = Math.min(P.patrolDockMax, Math.max(0, Math.floor(st.rosterShips) - 5));
        const dockMult = 1 + (docked * P.patrolDockPctPerShip) / 100;
        credit('patrol', 'hullAlloy', P.patrol.hullAlloy * offCoef * dockMult * hours * adDouble);
        credit('patrol', 'pilotToken', P.patrol.pilotToken * offCoef * dockMult * hours * adDouble);
        credit('patrol', 'starCargo', P.patrol.starCargo * offCoef * dockMult * hours * adDouble);
      }
      minutes -= 0.5;
    }

    // —— 3. 快速打理：商人 + 打捞 + 赞助券/补给箱广告 ——
    if (!paused && watcher) { // #2 今日补给箱（看广告开箱·结构自限每日 1 箱·券可恢复——预算判断收进 useView·深度自检修正旧外置门）
      if (useView('#2')) {
        credit('supplyChest', 'hullAlloy', P.supplyChest.hullAlloy);
        credit('supplyChest', 'pilotToken', P.supplyChest.pilotToken);
        credit('supplyChest', 'starCargo', P.supplyChest.starCargo);
        credit('supplyChest', 'beaconCommon', P.supplyChest.beaconCommon);
        credit('supplyChest', 'shipBlueprint', P.supplyChest.universal / 2);
        credit('supplyChest', 'pilotShardUniversal', P.supplyChest.universal / 2);
      }
    }
    if (!paused && watcher && st.buildings.supply >= 1 && useView('#6')) {
      credit('adTickets', 'supplyTicket', P.ads.ticketPerAd); // #6 赞助补给券（福利广告·铁顶=useView 内拦券）
    }
    if (!paused && !dis.merchant && st.buildings.merchant >= 1) {
      minutes -= P.merchant.minutes;
      const disc = merchDisc(); // Lv10 全场 9 折（满级终身被动）
      // 补给券（每日限购·抽卡节奏唯一阀门铁律照旧）：留足 richThreshold 再买（步1 口径）
      const tPrice = P.merchant.ticketPrice * disc;
      const afford = Math.floor(Math.max(0, st.res.starCargo - P.merchant.richThreshold) / tPrice);
      const buy = Math.min(P.merchant.ticketDailyCap, afford);
      if (buy > 0 && debit('merchantTicket', 'starCargo', buy * tPrice)) {
        credit('merchantTicket', 'supplyTicket', buy);
      }
      // 稀有格（任务单⑧百货化）：槽数 Lv1×1/Lv4×2/Lv7×3，池 6 品类各限购 1/日；
      // #8 商人刷新=重掷稀有格（免费 1 次/日·券可无限恢复——模型取 1 次=可选池翻倍，
      // 追加刷新对 6 品类小池边际递减、不建模·记简化声明）
      if (st.res.starCargo > P.merchant.richThreshold) {
        let slotsEff = P.merchant.rare.slotsByLv[Math.min(10, st.buildings.merchant)];
        if (watcher && useView('#8', { keepFree: reserveFree })) slotsEff *= 2;
        for (const [, g] of Object.entries(P.merchant.rare.pool)) {
          if (st.buildings.merchant < (g.minLv ?? 1)) continue;
          const w = st.buildings.merchant >= 8 && g.wLv8 ? g.wLv8 : g.w;
          const q = Math.min(1, slotsEff * w) * tier.shoppingPower;
          const cost = g.price * disc * q;
          if (!(q > 0) || st.res.starCargo - cost < P.merchant.richThreshold / 2) continue;
          if (!debit('merchantRare', 'starCargo', cost)) continue;
          const gv = g.give;
          if (gv.beaconRare) credit('merchantRare', 'beaconRare', gv.beaconRare * q);
          if (gv.beaconEpic) credit('merchantRare', 'beaconEpic', gv.beaconEpic * q);
          if (gv.coreFrag) credit('merchantRare', 'coreFrag', gv.coreFrag * q);
          if (gv.superior) st.plugins.superior += gv.superior * q;
          if (gv.flowCore) { st.coresOwned += gv.flowCore * q; st.coreDraws.shopFlow += gv.flowCore * q; }
        }
      }
      // 常驻区应急①（缺料触发·价贵一截）：打捞队要断粮（信标<队数）才按贵价补普通信标
      {
        const queuesNow = T.salvageQueues(st.buildings.salvage);
        const beaconsNow = st.res.beaconCommon + st.res.beaconRare + st.res.beaconEpic;
        if (queuesNow > 0 && beaconsNow < queuesNow) {
          const need = Math.min(queuesNow - beaconsNow, 3);
          const cost = P.merchant.staple.beaconCommonPrice * disc * need;
          if (st.res.starCargo - cost > P.merchant.richThreshold / 2 && debit('merchantStaple', 'starCargo', cost)) {
            credit('merchantStaple', 'beaconCommon', need);
          }
        }
      }
      // 常驻区应急②（真墙日军饷小包·价劣=平时不买）：昨日整天零推进才触发、星贝富余才买
      {
        const prevWall = st.dailyStuck.length > 0 && st.dailyStuck[st.dailyStuck.length - 1] === 1;
        const W = P.merchant.staple.wallPack;
        if (prevWall && st.res.starCargo > P.merchant.richThreshold) {
          const n = Math.min(W.capPerDay, Math.floor((st.res.starCargo - P.merchant.richThreshold) / (W.cargoCost * disc)));
          if (n > 0 && debit('merchantStaple', 'starCargo', n * W.cargoCost * disc)) {
            credit('merchantStaple', 'hullAlloy', n * W.hullAlloy);
            credit('merchantStaple', 'pilotToken', n * W.pilotToken);
          }
        }
      }
      // 常驻区：精良插件不限（沿用 v0.5 篮子流量口径）
      if (st.res.starCargo > P.merchant.richThreshold) {
        const q = P.merchant.staple.finePlugin.p * tier.shoppingPower;
        const cost = P.merchant.staple.finePlugin.price * disc * q;
        if (q > 0 && st.res.starCargo - cost > P.merchant.richThreshold / 2 && debit('merchantStaple', 'starCargo', cost)) {
          st.plugins.fine += q;
        }
        // B5 步3：高价大件货位=限周"定向专属碎片包"（650 星贝·照旧）
        if (day % 7 === 0 && st.res.starCargo > 2500 && debit('merchantBigItem', 'starCargo', 650 * disc)) {
          let weakest = st.mains[0];
          for (const m of st.mains) if (m.ship.tier < weakest.ship.tier) weakest = m;
          weakest.ship.shards += 18; weakest.pilot.shards += 18;
        }
      }
      // 回收台（Lv3/6/9 回收价升档=升级节奏表"回收①②③"）：信标 25→28→31→34
      if (st.res.beaconCommon > 40) {
        const recycleLv = st.buildings.merchant >= 9 ? 3 : st.buildings.merchant >= 6 ? 2 : st.buildings.merchant >= 3 ? 1 : 0;
        const rec = st.res.beaconCommon - 40;
        if (debit('beaconRecycle', 'beaconCommon', rec)) {
          credit('beaconRecycle', 'starCargo', rec * (25 + recycleLv * P.merchant.recycleStep.beacon));
        }
      }
    }
    if (!paused && !dis.salvage && st.buildings.salvage >= 1) {
      minutes -= P.salvage.minutes;
      const queues = T.salvageQueues(st.buildings.salvage);
      const adRun = watcher
        && (st.res.beaconCommon + st.res.beaconRare + st.res.beaconEpic) > queues && useView('#5'); // #5 打捞秒完（福利广告·铁顶=useView 内拦券）
      // 昨日卡关 → 今天更勤地倒腾打捞（卡关日会话时间全闲着）
      const prevStuck = st.dailyStuck.length > 0 && st.dailyStuck[st.dailyStuck.length - 1] === 1;
      const boostTier = prevStuck ? { ...tier, salvageRunsPerQueue: tier.salvageRunsPerQueue * 1.5 } : tier;
      doSalvage(st, credit, debit, boostTier, env, adRun, P, T);
    }

    // —— 4. 事件（3天/7天·平摊+周期末大奖）——
    if (!dis.events) {
      const comp = paused ? 0 : tier.eventCompletion;
      const drip = (pack, cycleDays) => {
        for (const [k, v] of Object.entries(pack)) {
          if (k.startsWith('completion')) continue;
          const amt = (v / cycleDays) * comp;
          if (k === 'universal') { credit('events', 'shipBlueprint', amt / 2); credit('events', 'pilotShardUniversal', amt / 2); }
          else if (k === 'resident') st.residents = Math.min(6 + 2 * st.buildings.habitat, st.residents + amt); // 步3 人口封顶
          else if (k === 'worker') st.workers = Math.min(6 + 2 * st.buildings.habitat, st.workers + amt);
          else credit('events', k, amt);
        }
      };
      if (!paused) { drip(P.events.cycle3, T.eventCycle3); drip(P.events.cycle7, T.eventCycle7); }
      if (day === ev3Anchor + T.eventCycle3 - 1) {
        if (!paused && tier.eventCompletion >= P.events.completionThreshold) {
          openCargoChest(st, credit, P.events.cycle3.completionChest, watcher && useView('#7', { keepFree: reserveFree, keepTickets: reserveTickets }), P);
          if (day <= T.eventCycle3) st.mains[0].ship.shards += P.tutorialGrant.firstEventMainShard;
          // 结算奖=行动宝藏三选一（v1.0 复原）·边际贪心：插件会顶掉精良/空槽（Δ≥55）才拿；
          // 槽位已铺满优秀及以上（再拿只赚 Δ35）→ 改拿通用碎片对半（喂升阶升星的边际更高）。
          // 首周期不发：首期行动宝藏=教程定向碎片特案（上一行 firstEventMainShard·GDD-M 首Boss助力），防双重计账。
          if (day > T.eventCycle3) {
            let treasureSlots = 0;
            for (const m of st.mains) treasureSlots += T.pluginSlotsByTier[m.ship.tier];
            if (st.plugins.legendary + st.plugins.superior < treasureSlots) {
              st.plugins.legendary += P.events.treasure3.legendaryPlugin;
            } else {
              credit('events', 'shipBlueprint', P.events.treasure3.universalShards / 2);
              credit('events', 'pilotShardUniversal', P.events.treasure3.universalShards / 2);
            }
          }
        }
        ev3Anchor = day + 1;
      }
      if (day === ev7Anchor + T.eventCycle7 - 1) {
        if (!paused && tier.eventCompletion >= P.events.completionThreshold) {
          // 7天扩张两笔分账（S10.5 三层·任务单③修正）：完成奖=史诗信标+星核碎片；
          // 结算奖=扩张宝藏随机星核三选一（池=11 常规＋曲率星门低概率=任务单⑧欧皇线：
          // 概率挂欧非包络 coreLuck——期望线小数入账、欧线毕业核可提前、非酋线=0 全走宝库兜底）
          for (const [k, v] of Object.entries(P.events.completion7)) credit('events', k, v);
          const pGrad = Math.min(1, P.core.treasureGradP * (env.coreLuck ?? 1));
          st.coresOwned += P.events.completionCore;
          st.coreDraws.treasure += P.events.completionCore * (1 - pGrad);
          st.gradCores.treasureEV += P.events.completionCore * pGrad;
        }
        ev7Anchor = day + 1;
      }
    }

    // —— 4.5 展厅双层分红（细案⑧·建筑细案入尺批）：按已收集核种数日结——Lv3 碎片/Lv6 宝石；
    // 种数取昨日日终 coresDistinct（当日新核次日起息·期望值口径下一天滞后可忽略，记简化声明）；
    // 放花钱段之前=当日分红当日可用（与回港领取同为"上线先领后花"的日流程语义）
    if (!paused && !dis.gallery) {
      const div = galleryDividendPerDay(st.buildings.gallery, st.coresDistinct, P, T);
      if (div.coreFrag > 0) credit('gallery', 'coreFrag', div.coreFrag);
      if (div.starGem > 0) credit('gallery', 'starGem', div.starGem);
    }

    // —— 5. 花钱（宝箱→黑市货架→转换→升阶→抽卡→升级→插件→建筑→星核）——
    if (!paused) {
      if (!dis.bmBox) doBmBox(st, credit, env, P); // 宝箱=看广告画像通用（计数余额自然约束·bmBox 账目=黑市轨）
      // 货架=黑市党；长墙机会型判据=连续 ≥2 天零推进（1 天短墙不触发——首版"昨日墙即触发"
      // 实测把中期短墙日的小件支出算进来、攒船节奏反被拖慢 D26→27=负优化，判据收紧后只在
      // n150 类长墙第 3 天起清仓破墙·记档§18）
      const ds = st.dailyStuck;
      const longWallBm = ds.length >= 2 && ds[ds.length - 1] === 1 && ds[ds.length - 2] === 1;
      if (bmActive && tier.bm.buy) doBlackMarket(st, credit, day, longWallBm, P);
      convertUniversal(st, debit);
      doAscends(st, T);
      if (!dis.gacha) {
        // 补给站细案⑥（建筑细案入尺批）：免费抽（Lv4 每日+1/Lv7 每日+2·不耗券必领）＋
        // Lv10 十连九折（券换抽数 ×10/9·攒十连=期望值口径）；A 概率垫层在 doGachaPulls 内
        const freePulls = T.supplyFreePulls(st.buildings.supply);
        const tickets = Math.floor(st.res.supplyTicket);
        let pulls = st.buildings.supply >= 1 ? freePulls : 0;
        if (tickets > 0 && debit('gacha', 'supplyTicket', tickets)) {
          pulls += tickets * T.supplyPullPerTicket(st.buildings.supply);
        }
        if (pulls > 0) {
          doGachaPulls(st, 'ship', pulls / 2, env, P, T);
          doGachaPulls(st, 'pilot', pulls / 2, env, P, T);
        }
      }
      doAscends(st, T);
      doLevelUps(st, debit, T);
      doPluginCraft(st);
      { // 步3 插件回收入模（②审计盲区修复·运行时块6d-3 已实现回收→星贝）：槽位+4 备件之外的传奇=死库存；
        // 回收价随商人升级节奏表"回收①②③"升档（150→165→180→195·任务单⑧百货化）
        let slotsNow = 0;
        for (const m of st.mains) slotsNow += T.pluginSlotsByTier[m.ship.tier];
        const plugSurplus = st.plugins.legendary - (slotsNow + 4);
        if (plugSurplus > 0) {
          const recycleLv = st.buildings.merchant >= 9 ? 3 : st.buildings.merchant >= 6 ? 2 : st.buildings.merchant >= 3 ? 1 : 0;
          st.plugins.legendary -= plugSurplus;
          credit('pluginRecycle', 'starCargo', plugSurplus * (150 + recycleLv * P.merchant.recycleStep.plugin));
        }
      }
      doBuildings(st, debit, P, T);
      doCores(st, debit, day, env, P, T);
    }

    // —— 6. 推主线（主线优先吃时间预算；有效战力 = 战力 ×(1+试错折算+板凳折算)）——
    // 板凳深度（任务单⑤）与 tinkerBonus 同层：都是"换搭配应对词缀/克制"的空间折算；
    // 按当日开盘死碎片池取值、一日一采（与试错折算同步，不在日内追涨）。
    let clearedToday = 0;
    let power = teamPower(st, T);
    // 对锚与阶梯批观察口（纯记录零行为）：当日开打战力 + 当日养成态（同 milestones 形状）——
    // 爬坡矩阵工具（s7-wall-climb）按"卡墙那天的真实队伍"生成阵容，替代逐点战力反解
    // （反解在相邻战力点会跳组合=阵容形状噪声，§20.2 同款病，n150 爬坡首测 85%→42% 实证）。
    st.dailyOpenPower.push(Math.round(power));
    st.dailyMains.push(st.mains.map((m) => [m.ship.tier, Math.round(m.ship.level), m.pilot.star, Math.round(m.pilot.level)]));
    // 长墙试错累积：用"截至昨日的连续零推进天数"取值（当日推进态未知·与 prevWall 同口径）
    const stallEff = Math.min(P.stallTinker?.cap ?? 0, (P.stallTinker?.perDay ?? 0) * (st.stuckStreak ?? 0));
    const eff = 1 + (tier.tinkerBonus ?? 0) + benchEffPct(benchPool(st, T), P) + stallEff;
    if (!paused && st.cleared < T.N) {
      let nodeBudget = Math.floor(Math.max(0, minutes) / P.mainline.minutesPerNode);
      while (st.cleared < T.N && nodeBudget > 0 && power * eff >= pressure[st.cleared + 1]) {
        const n = st.cleared + 1;
        // 逐关养成态快照（任务单⑧交付 8·⑥第三段接口）：打这关时点的开盘养成态
        st.milestones.push({
          node: n, day, power: Math.round(power),
          mains: st.mains.map((m) => [m.ship.tier, Math.round(m.ship.level), m.pilot.star, Math.round(m.pilot.level)]),
          plugins: { fine: Math.round(st.plugins.fine * 10) / 10, superior: Math.round(st.plugins.superior * 10) / 10, legendary: Math.round(st.plugins.legendary * 10) / 10 },
          cores: Math.round(st.coresOwned * 10) / 10,
        });
        // #3 首通翻倍 + #4 再选一（任务单⑧块5 扩围转全量：主线全部关卡首通可用·券可无限恢复）
        // ——每关各耗 1 次观看；#4 期望值更肥（含专属碎片）优先；两者都给 #10/#11 留储备。
        const opts2 = { watcherChest: watcher, adDouble: false, adExtraPick: false };
        if (watcher && !dis.mainlineRewards) {
          if (useView('#4', { keepFree: reserveFree, keepTickets: reserveTickets })) opts2.adExtraPick = true;
          if (useView('#3', { keepFree: reserveFree, keepTickets: reserveTickets })) opts2.adDouble = true;
        }
        if (opts2.watcherChest && nodeStage(n, T) === 'boss') useView('#7', { keepFree: reserveFree, keepTickets: reserveTickets }); // #7 货舱多选（不限·券可恢复·留 #10/#11 储备）
        if (!dis.mainlineRewards) nodeClearIncome(st, credit, n, opts2, P, T);
        else if (n === T.storyBossNode) { st.coresOwned += 1; st.corridorUnlocked = true; }
        st.cleared = n;
        clearedToday++; nodeBudget--;
        minutes -= P.mainline.minutesPerNode;
        convertUniversal(st, debit); doAscends(st, T); doLevelUps(st, debit, T);
        power = teamPower(st, T);
      }
    }

    // —— 7. 剩余时间做日常：悬赏 → 推演 → 回廊 ——
    // 两级卡关口径（当日主线推进结束后判定）：
    //   stuckToday = 日终顶在战力上限（下一关打不动）——推进期几乎天天如此（每天清到上限
    //     为止），沿用给 回廊 stallCorridorMult / 安慰包（既有校准态行为，任务单⑤不动）；
    //   wallDay = 整天零推进的真墙日（与 dailyStuck/墙矩阵同口径）——悬赏恶补预算只在
    //     真墙日放大（"卡关那几天回来清板"），否则 stall 放大天天触发=分层被抹平。
    const stuckToday = !paused && st.cleared < T.N && power * eff < pressure[st.cleared + 1];
    const wallDay = stuckToday && clearedToday === 0;
    // 发卡=「每登录日 +4」（S10.8 原文）——停玩天不发卡（任务单⑤真源对齐修正：此前模型
    // 停玩也累积，停玩变相成"攒卡银行"，恶补分层下会虚增停玩后回补收入）
    if (!paused && st.cleared >= 5) {
      st.bountyBacklog = Math.min(st.bountyBacklog + T.bountyDailyCards,
        T.bountyBoardCap[st.buildings.habitat >= 10 ? 2 : st.buildings.habitat >= 5 ? 1 : 0]);
    }
    if (!paused && !dis.bounty && st.cleared >= 5 && st.bountyBacklog > 0) {
      // 护航委托（任务单⑧：3 张全护航·难度四档自选·明保底品质·失败丢单+#11 保卡）。
      // 张数四约束沿用任务单⑤（bountyCardsFor 纯函数）；试探画像的失败重打时间按
      // (1+失败率) 折进预算（分钟预算/剩余分钟同折——重打也是真时间）。
      const pick = pickCommissionDifficulty(tier, power, pressure, P);
      const probing = !!pick.probe;
      const replayFrac = probing ? 1 - pick.pWin : 0;
      const cards = bountyCardsFor(tier, st.bountyBacklog, minutes / (1 + replayFrac), wallDay, P, T);
      if (cards > 0) {
        minutes -= cards * P.bounty.minutesPerCard * (1 + replayFrac);
        st.bountyBacklog -= cards;
        st.bountyCardsPlayed += cards;
        // #11 委托失败保卡（基础每日 1 次免费·券可无限恢复）：保住=换稳档重打
        let saved = 0;
        const failures = probing ? cards * (1 - pick.pWin) : 0;
        for (let f = failures; f > 0.01; f -= 1) {
          if (useView('#11')) saved += Math.min(1, f); else break;
        }
        const saveFrac = failures > 0 ? Math.min(1, saved / failures) : 0;
        // 期望难度倍率/张：胜=上档全额；败而保=稳档重打全额；败未保=丢单零奖励
        const diffEV = probing
          ? pick.pWin * pick.probeMult + (1 - pick.pWin) * saveFrac * pick.safeMult
          : pick.safeMult;
        st.bountyDiffMult = diffEV;
        const { qMult, goldPerCard } = commissionQualityEV(T);
        const coefP = Math.pow(offCoef, P.bounty.coefPow ?? 1);
        // 完美通关率按画像（任务单⑤沿用·两层制：赢=品质×难度全额、满血 ×1.25 彩蛋）
        const perfect = 1 + (tier.bountyPerfect ?? P.bounty.perfectRate) * (T.bountyPerfectMult - 1);
        const ambushLoss = 1 - T.bountyAmbushRate * (1 - P.bounty.ambushWinRate) * T.bountyAmbushLossPct;
        credit('bounty', 'hullAlloy', P.bounty.escortAlloy * coefP * qMult * diffEV * perfect * ambushLoss * cards);
        credit('bounty', 'starCargo', P.bounty.escortCargo * coefP * qMult * diffEV * perfect * ambushLoss * cards);
        // 金卡附赠实物（明保底 1/9 张·品质管实物、难度不乘）；遇袭小包按胜场张数
        for (const [k, share] of Object.entries(P.bounty.goldPhysical)) credit('bounty', k, goldPerCard * cards * share);
        const winCards = probing ? cards * (pick.pWin + (1 - pick.pWin) * saveFrac) : cards;
        const winEV = T.bountyAmbushRate * P.bounty.ambushWinRate * winCards;
        for (const [k, v] of Object.entries(P.bounty.ambushWinBonus)) credit('bounty', k, winEV * v);
      }
    }
    // 演习木桩（任务单⑧·驾驶记录主渠道）：60 秒计分窗、打到当前战力可达档、
    // 奖励=1..N 档累计一次性、每日重置；无星域系数（档位表即进度缩放）。
    if (!paused && !dis.drill && st.cleared >= 5 && minutes >= P.drill.minutes) {
      minutes -= P.drill.minutes;
      const k = drillTierFor(power, tier.drillSkill, P);
      if (k > 0) credit('drill', 'pilotToken', drillCumReward(k, P) * tier.dailyCompletion * (tier.drillRate ?? 1));
      st.drillTier = k;
    }
    if (!paused && !dis.puzzle && st.cleared >= 40 && minutes >= P.puzzle.minutes * tier.dailyCompletion) {
      minutes -= P.puzzle.minutes * tier.dailyCompletion;
      credit('puzzle', 'starCargo', P.puzzle.starCargo * tier.dailyCompletion);
      credit('puzzle', 'shipBlueprint', P.puzzle.shipBlueprint * tier.dailyCompletion);
    }
    if (!paused && !dis.corridor && st.corridorUnlocked) {
      // 卡关日主线时间空出来 → 投回廊（S8 墙期体验："有仗可打"由回廊/悬赏/推演承担）；
      // 投入倍数按档位（肝档卡关日几乎全泡回廊）
      const cmCap = tier.corridorMinutes * (stuckToday ? (tier.stallCorridorMult ?? 2) : 1);
      let cm = Math.min(cmCap, Math.max(0, minutes));
      while (cm >= PARAMS.corridor.minutesPerLayer) {
        const L = st.corridorLayer + 1;
        let req = P.corridor.reqBase * Math.pow(1 + P.corridor.reqGrowth, L - 1);
        if (L % T.corridorEchoEvery === 0) req *= P.corridor.echoSpike;
        if (power * eff < req) break; // 回廊戏法层=动脑换搭配可提前过（S10.7），同折算（含板凳）
        cm -= P.corridor.minutesPerLayer;
        st.corridorLayer = L;
        credit('corridor', 'hullAlloy', P.corridor.layerAlloy.base + P.corridor.layerAlloy.per * L);
        credit('corridor', 'pilotToken', P.corridor.layerToken.base + P.corridor.layerToken.per * L);
        credit('corridor', 'starCargo', P.corridor.layerCargo.base + P.corridor.layerCargo.per * L);
        if (L % T.corridorMilestoneEvery === 0) {
          const i = L / T.corridorMilestoneEvery;
          const msMult = watcher && useView('#10') ? 2.5 : 1; // #10 里程碑翻倍（福利广告·铁顶=useView 内拦券）
          credit('corridor', 'starOre', (P.corridor.msOre.base + P.corridor.msOre.per * i) * msMult);
          credit('corridor', 'starCargo', (P.corridor.msCargo.base + P.corridor.msCargo.per * i) * msMult);
          const uni = (P.corridor.msUniversal.base + P.corridor.msUniversal.per * i) * msMult;
          credit('corridor', 'shipBlueprint', uni / 2);
          credit('corridor', 'pilotShardUniversal', uni / 2);
          const bkey = L >= P.corridor.epicBeaconLayer ? 'beaconEpic' : L >= P.corridor.rareBeaconLayer ? 'beaconRare' : 'beaconCommon';
          credit('corridor', bkey, P.corridor.msBeacon * msMult);
          credit('corridor', 'starGem', P.corridor.msGem.base + P.corridor.msGem.per * i); // B7：宝石线不乘 msMult（稀缺线不挂广告）
        }
      }
    }

    // —— 8. 卡关：安慰包（白送每日≤3 次·按档位尝试次数领）+ 趣事 ——
    if (stuckToday) {
      const tries = Math.min(3, tier.consolationTries ?? 1); // 肝档一天多试几次墙
      const adCons = watcher && useView('#9') ? 1 : 0; // #9 战败安慰双倍（首次那单·结构自限·券可恢复）
      credit('consolation', 'hullAlloy', P.consolation.hullAlloy * (tries + adCons));
      credit('consolation', 'pilotToken', P.consolation.pilotToken * (tries + adCons));
      credit('consolation', 'beaconCommon', P.consolation.firstDefeatBeacon);
    }
    if (!paused) {
      credit('anecdote', 'starCargo', P.anecdote.chance * P.anecdote.starCargo);
      credit('anecdote', 'starOre', P.anecdote.chance * P.anecdote.starOre);
    }
    // 黑市连看（S13.6：黑市内连续观看纯 +计数无其他奖励）：把当日观看数填到日上限
    if (!paused && bmActive && tier.bm.chain && st.cleared >= P.blackMarket.unlockNode) {
      while (bmView('chain')) { /* 填满至 dailyViewCap */ }
    }

    // —— 9. 日终记录 + 守恒检查 ——
    while (st.coreDays.length < Math.floor(st.coresOwned + 1e-9)) st.coreDays.push(day); // 核到手日观测口
    st.dailyCleared.push(clearedToday);
    st.dailyPower.push(power);
    st.dailyStuck.push(wallDay ? 1 : 0);
    st.stuckStreak = wallDay ? (st.stuckStreak ?? 0) + 1 : 0; // 长墙试错累积计数（破墙清零）
    st.dailyCorridor.push(Math.round(st.corridorLayer)); // 对锚批观察口：日终回廊层（层数/日曲线）
    // 节奏观察口：件数类存量日终快照（插件走 7+ 入账点，存量差分比流水贴"每天到手可用"口径）
    st.dailyPlugins.push({ fine: st.plugins.fine, superior: st.plugins.superior, legendary: st.plugins.legendary });
    for (const k of RESOURCE_KEYS) {
      if (st.res[k] < -1e-6) st.negativeViolations.push({ day, key: k, value: st.res[k] });
    }
    if (st.cleared >= T.N && st.graduateDay === null) {
      st.graduateDay = day;
      if (!opts.runFullDays) break;
    }
  }
  return summarize(tierName, st, opts, P, T);
}

function zeroStreaks(log) {
  const streaks = []; let cur = 0;
  for (const v of log) { if (v === 0) cur++; else { if (cur > 0) streaks.push(cur); cur = 0; } }
  if (cur > 0) streaks.push(cur);
  return streaks;
}

function summarize(tierName, st, opts, P, T) {
  const upto = st.graduateDay ?? st.dailyCleared.length;
  const cl = st.dailyCleared.slice(0, upto);
  // 墙统计：战力被卡的零清日（1=卡住 → 转成 0 让 zeroStreaks 数连段）
  const stuckMask = cl.map((v, i) => (st.dailyStuck[i] === 1 ? 0 : 1));
  const wallStreaks = zeroStreaks(stuckMask);
  const firstWeek = cl.slice(0, 7).reduce((a, b) => a + b, 0);
  // 墙矩阵（v2 口径·与形状靶同指标）：每面 Boss 墙的"零清等待天数"（整天零推进才算等待，
  // 破墙当天清了别的关不算）；新手期卡关天数 = 清完 n030 前的零清卡关日（靶=0）
  const wallWait = Object.fromEntries(T.bossNodes.map((b) => [b, 0]));
  let cum = 0, newbieStuckDays = 0;
  for (let i = 0; i < upto; i++) {
    if (st.dailyStuck[i] === 1) {
      if (cum < T.storyBossNode) newbieStuckDays++;
      const next = cum + 1;
      if (wallWait[next] !== undefined) wallWait[next]++;
    }
    cum += st.dailyCleared[i];
  }
  return {
    tier: tierName,
    graduateDay: st.graduateDay,
    cleared: st.cleared,
    firstWeekCleared: firstWeek,
    firstWeekPct: Math.round((firstWeek / T.N) * 1000) / 10,
    maxWallDays: wallStreaks.length ? Math.max(...wallStreaks) : 0,
    wallsOver2: wallStreaks.filter((s) => s >= 2).length,
    wallWait,
    newbieStuckDays,
    finalPower: Math.round(st.dailyPower[upto - 1] ?? 0),
    corridorLayer: Math.round(st.corridorLayer),
    coresOwned: Math.round(st.coresOwned * 10) / 10,
    coresDistinct: Math.round(st.coresDistinct * 10) / 10,
    coreDays: st.coreDays,
    // 任务单⑧观测口：毕业核到手（分渠道）+ 渠道抽数 + 木桩档位 + 委托难度期望倍率
    gradCoreDays: st.gradCoreDays,
    gradCores: { ...st.gradCores },
    coreDraws: { ...st.coreDraws },
    drillTier: st.drillTier,
    bountyDiffMult: Math.round(st.bountyDiffMult * 100) / 100,
    // 观测口（任务单⑤）：悬赏实打张数（分层验证）与板凳终态折算（%·一位小数）
    bountyCards: Math.round(st.bountyCardsPlayed * 10) / 10,
    benchPct: Math.round(benchEffPct(benchPool(st, T), P) * 1000) / 10,
    mains: st.mains.map((m) => ({ shipTier: m.ship.tier, shipLv: m.ship.level, star: m.pilot.star, pilotLv: m.pilot.level })),
    offShards: { ship: Math.round(st.offShardsShip), pilot: Math.round(st.offShardsPilot) },
    // 观测口（②审计补查·2026-07-06）：插件池与人口终态——插件/人口不在 14 键钱包，此前无源池汇可见性
    plugins: { fine: Math.round(st.plugins.fine * 10) / 10, superior: Math.round(st.plugins.superior * 10) / 10, legendary: Math.round(st.plugins.legendary * 10) / 10 },
    population: { residents: Math.round(st.residents * 10) / 10, workers: Math.round(st.workers * 10) / 10 },
    resources: Object.fromEntries(RESOURCE_KEYS.map((k) => [k, Math.round(st.res[k] * 10) / 10])),
    negativeViolations: st.negativeViolations,
    adsUsedTotal: st.adsUsedTotal,
    adPointUses: { ...st.adPointUses },
    bm: { ...st.bm, earned: { ...st.bm.earned }, buys: { ...st.bm.buys } },
    milestones: st.milestones,
    dailyCleared: cl,
    dailyPower: st.dailyPower,
    dailyOpenPower: st.dailyOpenPower,
    dailyMains: st.dailyMains,
    dailyCorridor: st.dailyCorridor,
    ledger: st.ledger,
    dailyIncomeBySource: st.dailyIncomeBySource,
    dailySpendBySource: st.dailySpendBySource,
    dailyMainShards: st.dailyMainShards,
    dailyPlugins: st.dailyPlugins,
  };
}

// ---------------------------------------------------------------------------
// 八、压力值校准器（四锚分段版 · 任务单③）
//   重采样普通档轨迹 → 四个 γ 分段钉四个锚（普通档时点，全部来自形状时刻表 v2）：
//     锚1 = n060 破墙日（首真墙·早锚）   锚2 = n102 破墙日
//     锚3 = n120 破墙日                  锚4 = 毕业日（n150）
//   γ(n) 分段常数：n ≤ 60 取 γ₁；61-102 取 γ₂；103-120 取 γ₃；121-150 取 γ₄。
//   锚 i 的达成日只依赖 γ₁..γᵢ → 升序逐锚二分 = 精确坐标下降；段内相对墙高
//   完全保留重采样结果（不做段内插值——坡道会扭曲相对价，教训见 PARAMS 注）。
//   动机（初值表 v0 §13 诊断）：单 γ 下"中后期变富 → γ 全曲线下调 → 前段变便宜 →
//   肝档提前冲到 n060 墙下多等"；分段锚把每段各自钉死，收入形变只被本段 γ 吸收。
// ---------------------------------------------------------------------------

/** 初值压力曲线：按形状曲线等比放大到真实战力量级（迭代起点用）。 */
export function seedPressureCurve(scaleGuess = 3.0) {
  const shaped = shapeRequiredCurve();
  return shaped.map((v) => (v ? Math.round(v * scaleGuess) : v));
}

/** 分段 γ：取"第一个 node ≥ n 的锚"的 γ（锚按节点升序，末锚=毕业节点 N 兜底）。 */
export function gammaAt(n, anchors) {
  for (const a of anchors) if (n <= a.node) return a.gamma;
  return anchors[anchors.length - 1].gamma;
}

/** 第一次清掉节点 node 的那天（1 起）；未清到返回 null。 */
function dayNodeCleared(run, node) {
  let cum = 0;
  for (let d = 0; d < run.dailyCleared.length; d++) {
    cum += run.dailyCleared[d];
    if (cum >= node) return d + 1;
  }
  return null;
}

/**
 * 校准压力值表（四锚分段）：
 *  迭代：普通档经济轨迹按形状时刻表重采样 → 逐锚二分各自的 γ（锚 i 的达成日只依赖
 *  γ₁..γᵢ，升序搜索即坐标下降）→ 按分段 γ 应用。
 * 返回 { pressure, gammas, anchors, schedule }。
 */
export function calibratePressure(P = PARAMS, T = TRUTHS) {
  const schedule = shapeDaySchedule('普通');       // n → 形状里普通档清 n 的那天
  const C = P.pressureCalib;
  const anchors = [
    ...C.anchorNodes.map((node) => ({ node, targetDay: schedule[node], gamma: 1 })),
    { node: T.N, targetDay: schedule[T.N], gamma: 1 },
  ];
  let pressure = seedPressureCurve();
  for (let iter = 0; iter < C.iterations; iter++) {
    const run = simulateEconomyTier('普通', pressure, { runFullDays: true }, P, T);
    const powerAt = (d) => run.dailyPower[Math.max(0, Math.min(run.dailyPower.length - 1, d - 1))];
    // 重采样：关 n 的压力值 = 普通档在"形状说该清 n 那天"开盘（前一日终）的战力；
    // 墙采样策略（对锚与阶梯批参数化）：旧策略=真Boss墙取"开盘与前一日"半日均值（防其余档多算 1 天），
    // 实测它让普通档墙天数较形状表系统性 -1 天滑移（0/2/3/5 vs 形状 1/3/3/6）——矩阵点靶时代
    // （Ron 07-10 十六格靶）改整日采样让普通列贴回形状表；bossSampleHalfDay=true 可回旧策略对照。
    const raw = [0];
    for (let n = 1; n <= T.N; n++) {
      const d = schedule[n] ?? schedule[schedule.length - 1];
      const p1 = powerAt(d - 1) || run.dailyPower[0] * 0.8;
      raw[n] = T.bossNodes.includes(n) && C.bossSampleHalfDay === true ? 0.5 * (p1 + (powerAt(d - 2) || p1)) : p1;
    }
    for (let n = 2; n <= T.N; n++) raw[n] = Math.max(raw[n], raw[n - 1]); // 单调
    // 混合上一轮，稳定收敛（γ 应用前的"素曲线"参与混合）
    const blended = pressure.map((v, n) => (n === 0 ? 0 : C.blend * raw[n] + (1 - C.blend) * v));
    // 逐锚 γ 二分（升序）：锚 i 达成日随 γᵢ 单调变晚，取"达成日 ≤ 靶日"的最大 γ
    for (const anchor of anchors) {
      // 二分找达成日≤靶日的最大 γ；再与"跳变另一侧"（达成日>靶日的最小 γ）比较，
      // 取离靶日更近的一侧、平手取更硬一侧——达成日是整数、随 γ 跳变，若只收便宜侧，
      // 扰动会让整段落在"刚好没跳"的低价位（实测把首周清关吹到 46%·记档）
      const dayAt = (g) => {
        anchor.gamma = g;
        const trial = blended.map((v, n) => (n === 0 ? 0 : Math.round(v * gammaAt(n, anchors))));
        return dayNodeCleared(simulateEconomyTier('普通', trial, {}, P, T), anchor.node);
      };
      let lo = C.gammaLo, hi = C.gammaHi, best = lo, hit = false;
      for (let s = 0; s < C.gammaSteps; s++) {
        const mid = (lo + hi) / 2;
        const g = dayAt(mid);
        if (g === null || g > anchor.targetDay) hi = mid; else { lo = mid; best = mid; if (g === anchor.targetDay) { hit = true; break; } }
      }
      if (!hit) {
        const dLo = dayAt(best);
        const dHi = dayAt(hi);
        if (dLo !== null && dHi !== null
          && Math.abs(dHi - anchor.targetDay) <= Math.abs(dLo - anchor.targetDay)) best = hi;
      }
      anchor.gamma = best;
    }
    pressure = blended.map((v, n) => (n === 0 ? 0 : Math.round(v * gammaAt(n, anchors))));
  }
  // 教程段（n1-n8）终表钳制：强引导关必须开局可过（GDD-M 硬规格）。放在迭代与 γ 收口
  // 之后，只修最终表的头 8 关（全档 D1-3 内清掉的关），不扰动普通档钉靶。
  // 选型教训（记档）：曾试把钳制挪进迭代（γ 搜索前）——D1 连锁反馈把校准器带到另一个
  // 坏不动点（γ 崩到 0.89、新手期反冒 2 天墙、四档全飘），实测否决；保持循环外终表钳制，
  // 代价=扰动变体下首周清关有 ±6pp 已知波动（基线严格达标、变体验收不含首周项）。
  const day1Power = simulateEconomyTier('普通', pressure, { runFullDays: false }, P, T).dailyPower[0];
  for (let n = 1; n <= 8; n++) {
    pressure[n] = Math.min(pressure[n], Math.round(day1Power * (0.30 + 0.08 * n)));
  }
  for (let n = 2; n <= T.N; n++) pressure[n] = Math.max(pressure[n], pressure[n - 1]);
  // 对锚与阶梯批：四墙压力点直抬（在单调收口之后·不回夹）——墙成"尖峰"、破墙后节点保持
  // 原价（大墙后爽段口径）；γ 锚在未抬曲线上拟合，抬墙加出的等待天数=毕业日诚实漂移（授权
  // 口径"毕业日随墙矩阵微移=预期内如实报"）。见 PARAMS.wallPressureLift 选型记档。
  for (const [node, lift] of Object.entries(P.wallPressureLift ?? {})) {
    const n = Number(node);
    if (pressure[n]) pressure[n] = Math.round(pressure[n] * lift);
  }
  return {
    pressure,
    gammas: anchors.map((a) => a.gamma),
    anchors: anchors.map((a) => ({ ...a })),
    schedule,
  };
}

// ---------------------------------------------------------------------------
// 九、运行器
// ---------------------------------------------------------------------------

export function runStandard(pressure, P = PARAMS, opts = {}) {
  const tiers = opts.tiers ?? Object.keys(TIERS);
  const envelopes = opts.envelopes ?? true;
  const out = {};
  for (const t of tiers) {
    out[t] = { expected: simulateEconomyTier(t, pressure, { envelope: 'expected' }, P) };
    if (envelopes) {
      out[t].lucky = simulateEconomyTier(t, pressure, { envelope: 'lucky' }, P);
      out[t].unlucky = simulateEconomyTier(t, pressure, { envelope: 'unlucky' }, P);
    }
  }
  return out;
}

// 军饷身份份额（B1 落地·任务单⑤·GDD §3 转正口径；任务单⑧：记录第一单源随演习剥离
// 搬进木桩——"悬赏 40-55%"护栏按作战大厅渠道继承：合金看护航委托、驾驶记录看演习木桩，
// 各自 40-55% 第一单源；主线 ≤10% 风味护栏两币对称继承（Ron 2026-07-07 口径确认）。
export function incomeShares(run, key) {
  let total = 0;
  for (const kv of Object.values(run.ledger.income)) total += kv[key] ?? 0;
  const of = (src) => (total > 0 ? ((run.ledger.income[src]?.[key] ?? 0) / total) * 100 : 0);
  return { bounty: of('bounty'), drill: of('drill'), offline: of('offline'), patrol: of('patrol'), mainline: of('mainline'), total };
}

// 四档基线验收（v2 口径·严格版）：毕业带 ±10%（按整天取整——天数是整数，容差
// round(靶×10%)=肝3/重4/普5/轻6 天）+ 首周 + 档位顺序 + 守恒 + 全档单墙 ≤7 天硬顶 +
// 新手期 n001-n030 零墙 + 墙矩阵十六格点靶±1/双轴单调/余势零墙 + B1 军饷身份份额。
// 旧"肝≤4/普≤11/轻≤12"墙限随递进墙拍板作废（普/轻 8-11 天口径已废除）。
export function checkCalibration(std, P = PARAMS) {
  const errors = [];
  for (const [t, target] of Object.entries(TARGETS)) {
    const g = std[t].expected.graduateDay;
    if (!g) errors.push(`${t} 未在 ${P.maxDays} 天内毕业（卡在 ${std[t].expected.cleared}）`);
    else if (Math.abs(g - target) > Math.round(target * 0.10)) errors.push(`${t} 毕业 D${g} 偏离靶 ${target}±10%`);
  }
  const fw = std['普通'].expected.firstWeekPct;
  if (fw < 33 || fw > 42) errors.push(`普通档首周清关 ${fw}% 超出 35-40% 带（容差±2）`);
  const order = ['肝档', '重度', '普通', '轻度'].map((t) => std[t].expected.graduateDay ?? 999);
  for (let i = 1; i < order.length; i++) if (!(order[i] > order[i - 1])) { errors.push(`档位顺序错：${JSON.stringify(order)}`); break; }
  for (const t of Object.keys(TARGETS)) {
    const r = std[t].expected;
    if (r.maxWallDays > HARD_WALL_CAP) errors.push(`${t} 最长墙 ${r.maxWallDays} 天 > 硬顶 ${HARD_WALL_CAP}`);
    if (r.newbieStuckDays > 0) errors.push(`${t} 新手期（n001-n030）卡关 ${r.newbieStuckDays} 天，应零墙`);
    if (r.negativeViolations.length) errors.push(`${t} 守恒违规 ${r.negativeViolations.length} 处（首处 ${JSON.stringify(r.negativeViolations[0])}）`);
  }
  errors.push(...checkWallMatrix(std, WALL_MATRIX_TOL));
  // B1 军饷身份（普通档·合金/记录两币分别判·任务单⑧作战大厅口径）：
  // 合金第一单源=护航委托、记录第一单源=演习木桩，各 40-55%；主线风味 ≤10% 两币对称。
  for (const [key, srcName] of [['hullAlloy', 'bounty'], ['pilotToken', 'drill']]) {
    const s = incomeShares(std['普通'].expected, key);
    const share = s[srcName];
    if (share < 40 || share > 55) errors.push(`B1 身份：普通档 ${key} ${srcName === 'bounty' ? '委托' : '木桩'}份额 ${Math.round(share)}% 出 40-55 带`);
    if (share <= Math.max(s.offline, s.patrol)) errors.push(`B1 身份：普通档 ${key} ${srcName} 未成第一单源（${Math.round(share)}% vs 离线 ${Math.round(s.offline)}%/巡逻 ${Math.round(s.patrol)}%）`);
    if (s.mainline > 10) errors.push(`B1 身份：普通档 ${key} 主线份额 ${Math.round(s.mainline)}% 超风味上限 10%`);
  }
  return errors;
}

// 抗漂移变体验收（"校准器承诺"版·与基线严格版的差异全部有实测依据并记档）：
//   同基线：四档毕业带（整天容差）/ 档位顺序 / 新手零墙 / 守恒 / 肝重普硬顶 ≤7。
//   放宽项：①肝墙矩阵用 DRIFT 带（中后段 ±1——±20% 单源冲击是真实经济形变，尺子如实
//   反映而非静默吸收；早锚盯的 n060 仍收紧 [0,2]=v0.1 病灶探测器）；②轻度硬顶 ≤9（基线
//   贴顶 7 设计位，逆向冲击必然瞬时越顶，收回靠重调形状参数）；③不查首周（终表教程钳制
//   在扰动下有 ±6pp 已知波动·选型教训见 calibratePressure 注释）。
export function checkDriftPromise(std, P = PARAMS) {
  const errors = [];
  for (const [t, target] of Object.entries(TARGETS)) {
    const g = std[t].expected.graduateDay;
    // 变体毕业带=±10%＋1 整天宽限（对锚与阶梯批）：墙点直抬加出的等待天数是"γ 校准后"的固定项，
    // 扰动重校时校准器无法自愈吸收（基线肝 D32=+6.7% 带内、treasure×2 顶到 D34=旧带外 1 天）；
    // 天数是整数、矩阵靶本身自带 ±1 容差，变体承诺同粒度放 1 天（基线严格带 ±10% 不动）。
    if (!g) errors.push(`${t} 未在 ${P.maxDays} 天内毕业（卡在 ${std[t].expected.cleared}）`);
    else if (Math.abs(g - target) > Math.round(target * 0.10) + 1) errors.push(`${t} 毕业 D${g} 偏离靶 ${target}±10%+1天`);
  }
  const order = ['肝档', '重度', '普通', '轻度'].map((t) => std[t].expected.graduateDay ?? 999);
  for (let i = 1; i < order.length; i++) if (!(order[i] > order[i - 1])) { errors.push(`档位顺序错：${JSON.stringify(order)}`); break; }
  for (const t of Object.keys(TARGETS)) {
    const r = std[t].expected;
    const cap = t === '轻度' ? HARD_WALL_CAP_DRIFT_LIGHT : HARD_WALL_CAP;
    if (r.maxWallDays > cap) errors.push(`${t} 最长墙 ${r.maxWallDays} 天 > 变体容忍 ${cap}`);
    if (r.newbieStuckDays > 0) errors.push(`${t} 新手期卡关 ${r.newbieStuckDays} 天，应零墙`);
    if (r.negativeViolations.length) errors.push(`${t} 守恒违规 ${r.negativeViolations.length} 处`);
  }
  // 变体只查点靶宽容差（±2）·不查双轴单调（±20% 冲击下的瞬时轴乱序=真实形变如实反映）
  errors.push(...checkWallMatrix(std, WALL_MATRIX_DRIFT_TOL, { mono: false }));
  return errors;
}

/**
 * 墙矩阵守卫（对锚与阶梯批·Ron 07-10 十六格点靶）：
 *  ① 十六格点靶 ±tol（0.5 靶={0,1} 皆中，超出再按距离最近端计偏差）；
 *  ② 余势关 n084/n138 全档零等待（大墙后爽段口径）；
 *  ③ 双轴非降单调（墙轴：n060≤n102≤n120≤n150 每档；档轴：肝≤重≤普≤轻 每墙），
 *     记档例外（WALL_MONO_EXCEPTIONS）豁免——破形状即红。
 */
export function checkWallMatrix(std, tol, opts = {}) {
  const errors = [];
  const TIER_ORDER = ['肝档', '重度', '普通', '轻度'];
  const WALLS = [60, 102, 120, 150];
  const ww = (t, w) => std[t].expected.wallWait[w] ?? 0;
  for (const t of TIER_ORDER) {
    for (const w of WALLS) {
      const v = ww(t, w);
      const tgt = WALL_MATRIX_TARGET[t][w];
      const miss = tgt === 0.5 ? (v === 0 || v === 1 ? 0 : Math.min(Math.abs(v), Math.abs(v - 1))) : Math.abs(v - tgt);
      if (miss > tol) errors.push(`墙矩阵 ${t} n${w}=${v} 天，偏离靶 ${tgt} 超容差 ±${tol}`);
    }
    for (const w of [84, 138]) {
      if (ww(t, w) > (tol >= 2 ? 1 : 0)) errors.push(`余势关 ${t} n${w}=${ww(t, w)} 天，应零等待（大墙后爽段）`);
    }
  }
  if (opts.mono !== false) {
    for (const t of TIER_ORDER) {
      for (let i = 1; i < WALLS.length; i++) {
        if (ww(t, WALLS[i]) < ww(t, WALLS[i - 1])) {
          errors.push(`墙轴单调破形：${t} n${WALLS[i - 1]}=${ww(t, WALLS[i - 1])} > n${WALLS[i]}=${ww(t, WALLS[i])}（越后的墙应越长）`);
        }
      }
    }
    for (const w of WALLS) {
      for (let j = 1; j < TIER_ORDER.length; j++) {
        const [a, b] = [TIER_ORDER[j - 1], TIER_ORDER[j]];
        if (ww(b, w) < ww(a, w) && !WALL_MONO_EXCEPTIONS.has(`n${w}:${a}>${b}`)) {
          errors.push(`档轴单调破形：n${w} ${a}=${ww(a, w)} > ${b}=${ww(b, w)}（越轻度应越久）`);
        }
      }
    }
  }
  return errors;
}

// 黑市验收（任务单③三条之一：黑市党毕业 D22-25）+ 计数账本自检
export function checkBlackMarket(run, P = PARAMS) {
  const errors = [];
  if (!run.graduateDay) errors.push(`黑市党未毕业（卡在 ${run.cleared}）`);
  else if (run.graduateDay < BM_TARGET.min || run.graduateDay > BM_TARGET.max) {
    errors.push(`黑市党毕业 D${run.graduateDay} 超出靶带 D${BM_TARGET.min}-${BM_TARGET.max}`);
  }
  if (run.maxWallDays > HARD_WALL_CAP) errors.push(`黑市党最长墙 ${run.maxWallDays} 天 > 硬顶 ${HARD_WALL_CAP}`);
  if (run.newbieStuckDays > 0) errors.push(`黑市党新手期卡关 ${run.newbieStuckDays} 天`);
  if (run.negativeViolations.length) errors.push(`黑市党守恒违规 ${run.negativeViolations.length} 处`);
  const bm = run.bm;
  if (Math.abs(bm.earnedTotal - bm.spent - bm.balance) > 1e-9) {
    errors.push(`黑市计数台账不平：赚 ${bm.earnedTotal} − 花 ${bm.spent} ≠ 余 ${bm.balance}`);
  }
  if (bm.balance < 0) errors.push(`黑市计数余额为负 ${bm.balance}`);
  const days = run.graduateDay ?? P.maxDays;
  if (bm.earnedTotal > days * P.blackMarket.dailyViewCap) {
    errors.push(`黑市计数总量 ${bm.earnedTotal} 超过 ${days}×日上限 ${P.blackMarket.dailyViewCap}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// 九·五、抗漂移回归护栏（任务单③硬规格 #2：测"校准器自愈能力"）
//   对 offline/salvage/gacha 三源 ×0.8/×1.2 共 6 变体：扰动参数 → 全流程重校准 →
//   四档 ±10% / 墙矩阵点靶±2（变体容差） / 硬顶必须仍达标（不钉具体天数）。
//   'treasure' 源（行动宝藏 ×2）= §13 诊断场景的直接对抗验证（指定反例），随 --drift 输出。
// ---------------------------------------------------------------------------

export const DRIFT_VARIANTS = [
  { source: 'offline', mult: 0.8 }, { source: 'offline', mult: 1.2 },
  { source: 'salvage', mult: 0.8 }, { source: 'salvage', mult: 1.2 },
  { source: 'gacha', mult: 0.8 }, { source: 'gacha', mult: 1.2 },
  // 任务单⑤：B1 落地后悬赏=军饷第一单源（载重梁），±20% 扰动进永久护栏——同时是本单
  // 深度自检指定反例的转正（"对分层后的悬赏 ±20% 扰动，验证轻度不再被挤出带"）。
  { source: 'bounty', mult: 0.8 }, { source: 'bounty', mult: 1.2 },
];

/** 生成"单源 ×mult"的扰动参数副本（深拷贝·不碰全局 PARAMS）。 */
export function perturbedParams(source, mult, P = PARAMS) {
  const p = structuredClone(P);
  if (source === 'offline') {
    for (const k of Object.keys(p.offline)) p.offline[k] *= mult;
  } else if (source === 'salvage') {
    for (const t of Object.values(p.salvage.tiers)) {
      t.ore *= mult; t.cargo *= mult; t.universal *= mult;
      for (const k of Object.keys(t.fixed)) t.fixed[k] *= mult;
      for (const k of Object.keys(t.rollEV)) t.rollEV[k] *= mult;
    }
  } else if (source === 'gacha') {
    p.gacha.shardPerPullEV *= mult;
    for (const k of Object.keys(p.gacha.bodyP)) p.gacha.bodyP[k] *= mult;
  } else if (source === 'bounty') {
    // 任务单⑧：军饷第一单源扰动=作战大厅两渠道（护航委托+演习木桩）同扰
    p.bounty.escortAlloy *= mult;
    p.bounty.escortCargo *= mult;
    p.drill.rewardBase *= mult;
  } else if (source === 'treasure') {
    p.events.treasure3.legendaryPlugin *= mult;
    p.events.treasure3.universalShards *= mult;
  } else {
    throw new Error(`unknown perturbation source ${source}`);
  }
  return p;
}

/** 单变体：扰动 → 全流程重校准 → 变体承诺验收。返回 { variant, errors, days, liverWalls, gammas }。 */
export function runDriftVariant(source, mult, P = PARAMS, T = TRUTHS) {
  const p = perturbedParams(source, mult, P);
  const { pressure, gammas } = calibratePressure(p, T);
  const std = runStandard(pressure, p, { tiers: Object.keys(TARGETS), envelopes: false });
  const errors = checkDriftPromise(std, p);
  return {
    variant: `${source}×${mult}`,
    errors,
    days: Object.fromEntries(Object.keys(TARGETS).map((t) => [t, std[t].expected.graduateDay])),
    liverWalls: std['肝档'].expected.wallWait,
    maxWalls: Object.fromEntries(Object.keys(TARGETS).map((t) => [t, std[t].expected.maxWallDays])),
    gammas: gammas.map((g) => Math.round(g * 1000) / 1000),
  };
}

export function runDriftGuard(P = PARAMS, variants = DRIFT_VARIANTS) {
  return variants.map((v) => runDriftVariant(v.source, v.mult, P));
}

// 广告口径三档包络（任务单⑤·B1 落地后 #1 ×1.5/×1.7/×2.0 的常规轨自然加速实测——
// 每档全流程重校准后跑 满/零 广告双跑 + 基线全套验收，产出交 Ron 拍的三选项数据）
export function runAdEnvelope(P = PARAMS, mults = [1.5, 1.7, 2.0]) {
  return mults.map((mult) => {
    const p = structuredClone(P);
    p.ads.offlineDoubleMult = mult;
    const { pressure } = calibratePressure(p);
    const std = runStandard(pressure, p, { envelopes: false });
    const gateErrors = [...checkCalibration(std, p), ...checkBlackMarket(std[BM_TARGET.tier].expected, p)];
    const ads = runAdComparison(pressure, p);
    return {
      mult,
      days: Object.fromEntries(Object.keys(TARGETS).map((t) => [t, std[t].expected.graduateDay])),
      speedups: Object.fromEntries(Object.entries(ads).map(([t, r]) => [t, r.speedup])),
      zeroMaxWalls: Object.fromEntries(Object.entries(ads).map(([t, r]) => [t, r.zeroMaxWall])),
      gateErrors,
    };
  });
}

// 广告双跑（任务单⑧验收 7=本单最重要新验收）：满/零广告实测常规轨加速。
// 口径（Ron 2026-07-07 拍板）：黑市宝箱=黑市轨商品、25% 硬线不计（双跑两侧都关宝箱=
// 纯常规轨口径 speedup）；含宝箱数字另报一行透明化（speedupWithBox）。
export function runAdComparison(pressure, P = PARAMS) {
  const out = {};
  for (const t of ['肝档', '重度', '普通']) {
    const full = simulateEconomyTier(t, pressure, { ads: 'full', disable: { bmBox: true } }, P);
    const none = simulateEconomyTier(t, pressure, { ads: 'none', disable: { bmBox: true } }, P);
    const fullBox = simulateEconomyTier(t, pressure, { ads: 'full' }, P);
    out[t] = {
      fullDays: full.graduateDay, zeroDays: none.graduateDay,
      speedup: none.graduateDay && full.graduateDay
        ? Math.round(((none.graduateDay - full.graduateDay) / none.graduateDay) * 1000) / 10 : null,
      speedupWithBox: none.graduateDay && fullBox.graduateDay
        ? Math.round(((none.graduateDay - fullBox.graduateDay) / none.graduateDay) * 1000) / 10 : null,
      zeroMaxWall: none.maxWallDays,
    };
  }
  return out;
}

export function runSensitivity(pressure, P = PARAMS) {
  const base = simulateEconomyTier('普通', pressure, {}, P).graduateDay;
  const sources = ['offline', 'patrol', 'bounty', 'drill', 'corridor', 'salvage', 'gacha', 'events', 'mail', 'merchant', 'puzzle', 'mainlineRewards', 'bmBox', 'gallery'];
  const rows = [];
  for (const s of sources) {
    const r = simulateEconomyTier('普通', pressure, { disable: { [s]: true } }, P);
    rows.push({ source: s, graduateDay: r.graduateDay, delta: r.graduateDay ? r.graduateDay - base : `未毕业(卡${r.cleared})` });
  }
  return { base, rows };
}

export function runHalving(pressure, P = PARAMS) {
  // 深度自检反例：把某收入源砍半，尺子必须报告变慢（不许靠别的漏洞"自愈"）
  const base = simulateEconomyTier('普通', pressure, {}, P).graduateDay;
  const rows = [];
  for (const s of ['offline', 'salvage', 'bounty']) {
    const r = simulateEconomyTier('普通', pressure, { incomeScale: { [s]: 0.5 } }, P);
    rows.push({ source: `${s}×0.5`, graduateDay: r.graduateDay, delta: r.graduateDay ? r.graduateDay - base : `未毕业(卡${r.cleared})` });
  }
  return { base, rows };
}

export function runCatchup(pressure, P = PARAMS) {
  const rows = [];
  for (const t of ['普通', '轻度']) {
    const base = simulateEconomyTier(t, pressure, {}, P).graduateDay;
    for (const [from, days] of [[10, 1], [10, 2], [10, 3], [10, 4], [25, 2], [25, 4]]) {
      const r = simulateEconomyTier(t, pressure, { pause: { from, days } }, P);
      rows.push({
        tier: t, from, days, base, graduateDay: r.graduateDay,
        delay: r.graduateDay ? r.graduateDay - base : null,
        extraVsPause: r.graduateDay ? r.graduateDay - base - days : null,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 十、CLI
// ---------------------------------------------------------------------------

function fmtTierLine(r, target) {
  const dev = r.graduateDay ? Math.round(((r.graduateDay - target) / target) * 1000) / 10 : null;
  return `D${r.graduateDay ?? '×'}(靶${target} ${dev !== null ? (dev >= 0 ? '+' : '') + dev + '%' : '未毕业'}) `
    + `首周${r.firstWeekCleared}关(${r.firstWeekPct}%) 最长墙${r.maxWallDays}天 `
    + `终战力${r.finalPower} 回廊${r.corridorLayer}层 核${r.coresOwned}`;
}

function fmtWalls(r, T = TRUTHS) {
  return T.bossNodes.map((b) => `n${b}=${r.wallWait[b] ?? 0}`).join(' ');
}

const isMain = typeof process !== 'undefined' && process.argv[1]
  && /simulate-s7-economy\.mjs$/.test(String(process.argv[1]).replace(/\\/g, '/'));

if (isMain) {
  const args = new Set(process.argv.slice(2));
  const t0 = Date.now();
  console.log("==== S7 真实资源经济模拟器（建筑细案入尺批：八栋细案九件入模——折扣线×2+工人折扣+积压6/9/12+打捞队3/4/5+稀有发现线+免费抽·十连九折+双层分红+双黄蛋+宝库120·核保底 · 期望值模型·零RNG）====");

  const { pressure, gammas, anchors } = calibratePressure();
  console.log(`压力值表：形状时刻表(v2 递进墙)重采样 + 双锚分段γ收口 [${anchors.map((a) => `n${a.node}→D${a.targetDay} γ=${Math.round(a.gamma * 1000) / 1000}`).join(' | ')}] + 教程段(n1-8)钳制`);

  const std = runStandard(pressure);
  console.log(`\n—— 五画像校准（expected·广告/天：肝${TIERS['肝档'].adsPerDay}/重${TIERS['重度'].adsPerDay}/普${TIERS['普通'].adsPerDay}/轻${TIERS['轻度'].adsPerDay}/黑市党${TIERS['黑市党'].adsPerDay}+券+连看至${PARAMS.blackMarket.dailyViewCap}）——`);
  for (const [t, target] of Object.entries(TARGETS)) {
    console.log(`[${t}] ${fmtTierLine(std[t].expected, target)}`);
    console.log(`       墙矩阵：${fmtWalls(std[t].expected)} ｜ 欧非：欧 D${std[t].lucky.graduateDay ?? '×'} / 非 D${std[t].unlucky.graduateDay ?? '×'}`);
  }
  const bmRun = std['黑市党'].expected;
  console.log(`[黑市党] D${bmRun.graduateDay ?? '×'}(靶${BM_TARGET.min}-${BM_TARGET.max}) 最长墙${bmRun.maxWallDays}天 终战力${bmRun.finalPower}`);
  console.log(`       墙矩阵：${fmtWalls(bmRun)} ｜ 计数：赚${bmRun.bm.earnedTotal}(点位${bmRun.bm.earned.points ?? 0}/券${bmRun.bm.ticketsBought}/连看${bmRun.bm.earned.chain ?? 0}) 花${bmRun.bm.spent} 余${Math.round(bmRun.bm.balance)} 购${JSON.stringify(bmRun.bm.buys)}`);
  const errors = [...checkCalibration(std), ...checkBlackMarket(bmRun)];
  console.log(errors.length ? `\n❌ 校准未过：\n  - ${errors.join('\n  - ')}` : '\n✅ 校准检查全过（四档±10%/首周/档位顺序/守恒 + 全档≤7天硬顶/新手零墙/墙矩阵16格±1/双轴单调/余势零墙 + 黑市党/计数账本）');

  if (args.has('--ads') || args.has('--all')) {
    console.log('\n—— 广告双跑（任务单⑧验收 7·常规轨口径=双侧关宝箱；含宝箱=黑市轨透明行·≤25% 硬线）——');
    for (const [t, r] of Object.entries(runAdComparison(pressure))) {
      console.log(`[${t}] 满广告 D${r.fullDays} vs 零广告 D${r.zeroDays} → 常规轨加速 ${r.speedup}%（含宝箱透明行 ${r.speedupWithBox}%·零广告最长墙 ${r.zeroMaxWall} 天）`);
    }
  }
  if (args.has('--milestones')) {
    // 逐关养成态导出口（任务单⑧交付 8·⑥第三段"中位搭配在该关应有养成态"取数口）。
    // 行格式：node day power | 5×[阶/级/星/驾级] | 插件(精/优/传) | 核。全五画像进 json。
    const tierName = process.env.S7_MS_TIER ?? '普通';
    const r = std[tierName].expected;
    console.log(`\n—— 逐关养成态快照 [${tierName}]（打该关时点的开盘态·⑥第三段接口）——`);
    console.log('node\tday\tpower\tmains(阶/级/星/驾级)×5\tplug(精/优/传)\tcores');
    for (const m of r.milestones) {
      console.log(`n${String(m.node).padStart(3, '0')}\tD${m.day}\t${m.power}\t${m.mains.map((u) => u.join('/')).join(' ')}\t${m.plugins.fine}/${m.plugins.superior}/${m.plugins.legendary}\t${m.cores}`);
    }
  }
  if (args.has('--sensitivity') || args.has('--all')) {
    console.log('\n—— 敏感性冒烟（普通档·单源清零）——');
    const sen = runSensitivity(pressure);
    console.log(`基线 D${sen.base}`);
    for (const r of sen.rows) console.log(`  −${r.source}: D${r.graduateDay ?? '×'} (Δ${typeof r.delta === 'number' ? (r.delta >= 0 ? '+' : '') + r.delta : r.delta})`);
  }
  if (args.has('--halving') || args.has('--all')) {
    console.log('\n—— 反例自检（收入源砍半·尺子须诚实变慢）——');
    const h = runHalving(pressure);
    console.log(`基线 D${h.base}`);
    for (const r of h.rows) console.log(`  ${r.source}: D${r.graduateDay ?? '×'} (Δ${typeof r.delta === 'number' ? (r.delta >= 0 ? '+' : '') + r.delta : r.delta})`);
  }
  if (args.has('--catchup') || args.has('--all')) {
    console.log('\n—— 追赶实验（第X天起停玩N天）——');
    for (const r of runCatchup(pressure)) {
      console.log(`  [${r.tier}] D${r.from}起停${r.days}天 → 毕业D${r.graduateDay}（比基线D${r.base}晚${r.delay}天·超出停玩本身${r.extraVsPause}天）`);
    }
  }
  if (args.has('--drift') || args.has('--all')) {
    console.log('\n—— 抗漂移回归护栏（单源扰动 → 全流程重校准 → 四档带/肝墙矩阵/硬顶仍须达标）——');
    const variants = [...DRIFT_VARIANTS, { source: 'treasure', mult: 2 }]; // 末位=指定反例（§13 场景直接对抗验证）
    for (const v of variants) {
      const r = runDriftVariant(v.source, v.mult);
      const tag = v.source === 'treasure' ? '（指定反例·行动宝藏×2）' : '';
      console.log(`  [${r.variant}]${tag} ${r.errors.length ? '❌ ' + r.errors.join('；') : '✅'} 四档 ${Object.values(r.days).join('/')} 肝墙 ${Object.entries(r.liverWalls).map(([n, w]) => `n${n}=${w}`).join(' ')} γ=${r.gammas.join('/')}`);
    }
  }
  if (args.has('--adenv') || args.has('--all')) {
    console.log('\n—— 广告口径三档包络（#1 回港倍率 ×1.5/×1.7/×2.0 · 每档重校准 · 交 Ron 拍）——');
    for (const r of runAdEnvelope()) {
      console.log(`  [#1 ×${r.mult}] 四档 ${Object.values(r.days).join('/')} ｜ 加速 肝${r.speedups['肝档']}%/重${r.speedups['重度']}%/普${r.speedups['普通']}% ｜ 零广告最长墙 ${Object.values(r.zeroMaxWalls).join('/')} ｜ 验收 ${r.gateErrors.length ? '❌ ' + r.gateErrors.join('；') : '✅ 全绿'}`);
    }
  }
  if (args.has('--pressure')) {
    console.log('\n—— 150 关压力值表 ——');
    for (let n = 1; n <= TRUTHS.N; n++) {
      const tag = nodeStage(n) === 'boss' ? ' ←真Boss墙' : nodeStage(n) === 'storyBoss' ? ' ←剧情首Boss' : nodeStage(n) === 'elite' ? ' (精英)' : '';
      console.log(`n${String(n).padStart(3, '0')} ${pressure[n]}${tag}`);
    }
  }
  if (args.has('--income')) {
    console.log('\n—— 普通档收入构成（累计·按源）——');
    const r = std['普通'].expected;
    for (const [src, kv] of Object.entries(r.ledger.income)) {
      const parts = Object.entries(kv).map(([k, v]) => `${k}:${Math.round(v)}`).join(' ');
      console.log(`  ${src}: ${parts}`);
    }
    console.log('—— 终局余额（死水/溢出观察口）——');
    console.log(`  ${JSON.stringify(r.resources)}`);
    console.log(`  非主力专属碎片沉淀：舰 ${r.offShards.ship} / 员 ${r.offShards.pilot}`);
    console.log(`  主力养成态：${r.mains.map((m) => `T${m.shipTier}L${m.shipLv}/${m.star}★L${m.pilotLv}`).join(' ')}`);
  }
  if (args.has('--cores')) {
    console.log('\n—— 星核到手节奏（B4 观察口：到手日序列·↑=与上一颗间隔天数）——');
    for (const t of Object.keys(TIERS)) {
      const r = std[t].expected;
      const seq = r.coreDays.map((d, i) => (i === 0 ? `D${d}` : `D${d}(↑${d - r.coreDays[i - 1]})`)).join(' ');
      console.log(`[${t}] 共${r.coreDays.length}颗：${seq}`);
    }
    console.log('\n—— 毕业核到手时点（任务单⑧新验收口径：期望线=宝库攒宝石·欧线=宝藏/宝箱 coreLuck）——');
    for (const t of Object.keys(TIERS)) {
      const r = std[t].expected;
      const luckyR = std[t].lucky;
      console.log(`[${t}] 确定线 ${r.gradCoreDays.length ? r.gradCoreDays.map((d) => `D${d}`).join('/') : '（毕业前无）'}（宝库${r.gradCores.vault}/黑市${r.gradCores.bm}）｜ 欧线期望分 ${Math.round(r.gradCores.treasureEV * 100) / 100}（欧跑 ${Math.round((luckyR?.gradCores?.treasureEV ?? 0) * 100) / 100}）`);
    }
    console.log('\n—— 星空宝石渠道构成（B7 观察口：累计收入按源）——');
    for (const t of Object.keys(TIERS)) {
      const r = std[t].expected;
      const rows = Object.entries(r.ledger.income)
        .map(([src, kv]) => [src, kv.starGem ?? 0]).filter(([, v]) => v > 0.5)
        .map(([src, v]) => `${src}:${Math.round(v)}`).join(' ');
      console.log(`[${t}] ${rows || '（无）'} ｜ 终局结余 ${r.resources.starGem}`);
    }
  }
  if (args.has('--trace')) {
    const r = simulateEconomyTier('普通', pressure, {});
    console.log('\nday cleared cum power req(next)');
    let cum = 0;
    for (let d = 0; d < r.dailyCleared.length; d++) {
      cum += r.dailyCleared[d];
      console.log(`${d + 1} ${r.dailyCleared[d]} ${cum} ${Math.round(r.dailyPower[d])} ${cum < 150 ? pressure[cum + 1] : '-'}`);
    }
  }
  if (args.has('--pacing')) {
    // 资源节奏观察口（2026-07-07 Ron 拍板"节奏方向"工序的取数口）：
    // 三窗口（前期=首周 / 中期=毕业中点±3 / 后期=毕业前7天）逐资源 收/支 日均 + 末窗主渠道。
    for (const tierName of args.has('--pacing-all') ? Object.keys(TIERS) : ['普通']) {
      const r = std[tierName].expected;
      const G = r.graduateDay ?? r.dailyCleared.length;
      const mid = Math.round(G / 2);
      const wins = [[1, 7], [mid - 3, mid + 3], [G - 6, G]];
      const agg = (dailyBySource, [from, to]) => {
        const byKey = {}, bySrc = {};
        for (let d = from; d <= to; d++) {
          const dayRec = dailyBySource[d]; if (!dayRec) continue;
          for (const [src, kv] of Object.entries(dayRec)) for (const [k, v] of Object.entries(kv)) {
            byKey[k] = (byKey[k] ?? 0) + v;
            (bySrc[k] ??= {})[src] = (bySrc[k][src] ?? 0) + v;
          }
        }
        return { byKey, bySrc, days: to - from + 1 };
      };
      const NAME = { starOre: '星矿', hullAlloy: '合金', pilotToken: '驾驶记录', starCargo: '星贝', supplyTicket: '补给券', shipBlueprint: '通碎·舰', pilotShardUniversal: '通碎·员', coreFrag: '星核碎片', starGem: '星空宝石', beaconCommon: '信标普', beaconRare: '信标稀', beaconEpic: '信标史' };
      const incW = wins.map((w) => agg(r.dailyIncomeBySource, w));
      const spdW = wins.map((w) => agg(r.dailySpendBySource, w));
      console.log(`\n—— 资源节奏观察口 [${tierName}] G=D${G} · 窗口 前D1-7 / 中D${mid - 3}-${mid + 3} / 后D${G - 6}-${G} · 每格=收/支 日均 ——`);
      for (const k of Object.keys(NAME)) {
        const cells = wins.map((_, i) => `${((incW[i].byKey[k] ?? 0) / incW[i].days).toFixed(1)}/${((spdW[i].byKey[k] ?? 0) / spdW[i].days).toFixed(1)}`);
        const lateTop = Object.entries(incW[2].bySrc[k] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2)
          .map(([s, v]) => `${s}${Math.round((v / (incW[2].byKey[k] || 1)) * 100)}%`).join('+');
        console.log(`  ${NAME[k]}\t前 ${cells[0]}\t中 ${cells[1]}\t后 ${cells[2]}\t末窗主源 ${lateTop || '-'}`);
      }
      const shardW = wins.map(([f, t]) => {
        const s = { shipMain: 0, shipOff: 0, pilotMain: 0, pilotOff: 0 };
        for (let d = f; d <= t; d++) { const x = r.dailyMainShards[d]; if (x) for (const kk of Object.keys(s)) s[kk] += x[kk]; }
        return { s, days: t - f + 1 };
      });
      const sm = (q) => shardW.map((w) => (w.s[q] / w.days).toFixed(1)).join(' / ');
      console.log(`  专属碎片(前/中/后 日均)：舰主力 ${sm('shipMain')}｜员主力 ${sm('pilotMain')}｜沉淀舰 ${sm('shipOff')}｜沉淀员 ${sm('pilotOff')}`);
      const plugW = wins.map(([f, t]) => {
        const a = r.dailyPlugins[f - 2] ?? { fine: 0, superior: 0, legendary: 0 };
        const b = r.dailyPlugins[t - 1] ?? a;
        return ['fine', 'superior', 'legendary'].map((q) => (((b[q] ?? 0) - (a[q] ?? 0)) / (t - f + 1)).toFixed(2)).join('/');
      });
      console.log(`  插件净增件/日(精良/优秀/传奇)：前 ${plugW[0]}｜中 ${plugW[1]}｜后 ${plugW[2]}`);
      const coreGaps = wins.map(([f, t]) => { const n = r.coreDays.filter((d) => d >= f && d <= t).length; return (n / (t - f + 1)).toFixed(2); });
      console.log(`  星核到手颗/日：前 ${coreGaps[0]}｜中 ${coreGaps[1]}｜后 ${coreGaps[2]}（到手日全序列见 --cores）`);
    }
  }
  if (args.has('--json')) {
    const fs = await import('node:fs');
    const path = process.env.S7_ECON_JSON ?? 'tools/s7-economy-report.json';
    const strip = (r) => ({ ...r, ledger: undefined, dailyPower: undefined, dailyCleared: undefined, dailyOpenPower: undefined, dailyMains: undefined, dailyCorridor: undefined });
    const payload = {
      generatedBy: 'simulate-s7-economy.mjs', version: 'v0.8(对锚与阶梯批·墙矩阵16格点靶+墙点直抬+带宽中档)',
      targets: TARGETS, bmTarget: BM_TARGET, gammas, anchors,
      wallMatrixTarget: WALL_MATRIX_TARGET, wallMatrixTol: WALL_MATRIX_TOL, hardWallCap: HARD_WALL_CAP,
      params: { ...PARAMS }, tiers: TIERS,
      standard: Object.fromEntries(Object.entries(std).map(([t, v]) => [t, {
        expected: strip(v.expected),
        lucky: { graduateDay: v.lucky.graduateDay }, unlucky: { graduateDay: v.unlucky.graduateDay },
      }])),
      ads: runAdComparison(pressure), adEnvelope: runAdEnvelope(), sensitivity: runSensitivity(pressure),
      halving: runHalving(pressure), catchup: runCatchup(pressure),
      drift: [...DRIFT_VARIANTS, { source: 'treasure', mult: 2 }]
        .map((v) => { const r = runDriftVariant(v.source, v.mult); return { ...r, ok: r.errors.length === 0 }; }),
      pressure,
    };
    fs.writeFileSync(path, JSON.stringify(payload, null, 1));
    console.log(`\n已写出 ${path}`);
  }
  console.log(`\n（总耗时 ${Date.now() - t0}ms）`);
  if (errors.length) process.exit(1);
}
