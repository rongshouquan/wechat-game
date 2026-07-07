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
//      优先冲 S 接陨星弹，其余按阶低者先）→ c.补给券全抽（舰/员池对半）→ d.合金/
//      驾驶记录从最便宜一级逐级买满 5 主力 → e.插件 3合1 升品 → f.星矿升建筑
//      （居住舱→打捞港→研究塔→补给站→商人→展厅；船坞/训练舱现无战斗外收益不升，遵真源
//      TODO）→ g.星核碎片够 60 即合成、星空宝石够价即宝库兑换（复购 ×1.5 递增）。
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
  habitatStorageHours: (lv) => (lv <= 0 ? 0 : 36 + 1.3 * (lv - 1)),
  habitatRatePct: (lv) => Math.max(0, lv) * 2,
  researchPowerPct: (lv) => Math.max(0, lv) * 1,
  galleryPerCorePct: (lv) => 0.3 + (Math.max(1, lv) - 1) * (0.3 / 9),
  galleryCapPct: 10,
  salvageQueues: (lv) => (lv >= 7 ? 3 : lv >= 4 ? 2 : lv >= 1 ? 1 : 0),
  buildingMaxLevel: 10,

  salvageTimeMult: { h2: 1, h8: 2.2, h24: 3.8 }, // 每小时效率递减（0.50/0.28/0.16），每信标收益随时长递增

  bountyDailyCards: 4,
  bountyQualityMult: { bronze: 1, silver: 1.6, gold: 3 },
  bountyGoldPity: 4,
  bountyPerfectMult: 1.25,
  bountyAmbushRate: 0.15,
  bountyAmbushLossPct: 0.30,
  bountyBoardCap: [12, 16, 20],

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
  // 合金/记录刻意小额：离线是"回来有得领"的底垫，不是战力主粮（护 #1 广告翻倍 ≤ 加速上限）
  offline: { starOre: 62, hullAlloy: 30, pilotToken: 20 }, // A1 步3：星矿减产 100→62（治离线超发=三大死水共同源头；合金记录不动·B1 暂缓中）
  // 星矿的星域乘区用开方衰减（星矿=建筑币·十级封顶的有限 sink，全速乘区必然溢出成死水）
  oreCoefPow: 0.5,
  // 巡逻收益（/小时·×星域系数×(1+派驻加成)）——战斗养成资源小额（≈离线同币种 45% 档）
  patrol: { hullAlloy: 14, pilotToken: 9, starCargo: 4 },
  patrolDockPctPerShip: 4,
  patrolDockMax: 10,

  // 悬赏板（基础/张·×星域系数×品质期望；护航=合金+星贝、演习=驾驶记录）
  // 任务单⑤参与度真分层：可打张数=min(积压, 意愿, 剩余分钟, 画像辅助战斗预算 bountyMinutes)；
  // 恶补意愿 bountyCatchup 按画像（见 TIERS）；卡关日预算 ×stallBudgetMult（墙期"有仗可打"
  // 由悬赏/回廊承担=S8 口径，与 stallCorridorMult 同一先例——不是放水，是卡关日玩家真有闲）。
  bounty: {
    escortAlloy: 200, escortCargo: 20,
    drillToken: 135,
    goldRate: 0.08,
    goldPhysical: { beaconCommon: 1 / 3, shipBlueprint: 1 / 3, supplyTicket: 1 / 3 },
    ambushWinBonus: { shipBlueprint: 0.5, supplyTicket: 0.5 },
    perfectRate: 0.5,
    ambushWinRate: 0.85,
    minutesPerCard: 1.2,
    stallBudgetMult: 2,
  },

  // 每日推演（n040 后·首胜）
  puzzle: { starCargo: 30, shipBlueprint: 2.5, minutes: 2.0 },

  // 今日补给箱（#2 广告点位）
  supplyChest: { hullAlloy: 35, pilotToken: 25, starCargo: 10, beaconCommon: 0.25, universal: 1.0 },

  // 商人小站
  merchant: {
    ticketPrice: 80, ticketDailyCap: 50, // 40→55：B3 打捞券下架的等量补回主口（星贝可负担时才买=顺带加宽星贝 sink）
    cargoReserve: 150,
    richThreshold: 800,
    basket: { beaconRare: { p: 1.2, price: 300 }, finePlugin: { p: 0.35, price: 320 }, coreFrag5: { p: 0.10, price: 500 } }, // 篮子停售普通信标改售稀有（审计矩阵建议·星贝真 sink+全档稳定稀有流·治轻度末期掉速）；coreFrag5 p 0.15→0.10（B4）
    minutes: 0.8,
  },

  // 打捞（每信标一趟；软货币/通用碎片 ×时间档倍率；rolls=发现掷骰·随时长档取对应值）
  // 策略：每队先派 1 趟 24h（信标效率高）；剩余信标按档位趟数计划加派 2h 短趟消化
  // （时间效率高·信标效率低——"消化型"重度玩家 vs "效率型"轻度玩家的真实分层）；
  // 星贝盈余时买打捞加速券把短趟升为 8h 档产出（花星贝买时间·S10.2/S10.3 设计）。
  salvage: {
    minutes: 1.0,
    tiers: {
      common: {
        ore: 30, cargo: 14, universal: 1.5, fixed: {},
        rolls: { h2: 1.6, h8: 3.8, h24: 8.2 },
        rollEV: { universal: 0.5, beaconCommon: 0.16, coreFrag: 0.004, finePlugin: 0.05, resident: 0.02, worker: 0.02, cargoChest: 0.01 }, // 券下架=B3（S10.1 无此渠道）；coreFrag 0.015→0.004（B4 两刀）
      },
      rare: {
        ore: 70, cargo: 38, universal: 2.5, fixed: { coreFrag: 0.25 }, // B4：1→0.25（打捞=核碎最大源 55%·中后期超发主凶）
        rolls: { h2: 2.6, h8: 5.0, h24: 10.4 },
        rollEV: { universal: 0.8, beaconRare: 0.075, coreFrag: 0.008, superiorPlugin: 0.05, starGem: 0.015, resident: 0.03, worker: 0.03, cargoChest: 0.015 }, // 券下架=B3；稀有自繁殖 0.10→0.075（24h 1.04→0.78 拆永动·A3）；coreFrag 0.03→0.008（B4 两刀）；starGem 0.05→0.015（B7 挪回廊）
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

  // 教程期定向投放（GDD-M"首Boss前刚好养出 1 艘 S 阶"·人人相同·计入初值表）
  tutorialGrant: { perNodeMainShard: 13, untilNode: 30, firstEventMainShard: 60 },

  // 抽卡（S10.1 碎片化）
  gacha: {
    shardPerPullEV: 2.0,
    bodyP: { C: 0.07, B: 0.025, A: 0.008 },
    dupFoldShards: 15,
    poolSizeShips: 18, poolSizePilots: 20,
  },

  // 星核渠道量值
  core: { synthesisFragCost: 60, vaultBasePrice: 70, distinctPool: 13 }, // B4/B7 联动：宝库 80→70——宝石线=扰动免疫渠道（回廊+货舱），降基价给第 2-4 颗核提前量，治轻度事件粮打折的结构性韧性缺口（§15）

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
    coreFrag: 1.5, starGem: 2, // B4：coreFrag 4→1.5（货舱=核碎第二源 28%）
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
  buildingPriority: ['habitat', 'salvage', 'research', 'supply', 'merchant', 'gallery'],
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

  // 欧非包络（三个关键随机项·任务单硬规格 #3）
  envelope: {
    expected: { mainShardShare: 0.34, goldRate: 1.0, salvageRollMult: 1.0 },
    lucky: { mainShardShare: 0.44, goldRate: 1.5, salvageRollMult: 1.15 },
    unlucky: { mainShardShare: 0.25, goldRate: 0.6, salvageRollMult: 0.85 },
  },

  // 广告点位量值（S13 十点位·全点位每日 1 次）
  ads: { ticketPerAd: 10, salvageInstantDur: 'h8' }, // #6 赞助券 7→10：B2 加肥（削 #1 省出的份额往肥点挪）

  // 黑市（GDD S13.6 · 广告"类充值"轨 · 任务单③入模）
  blackMarket: {
    unlockNode: 30,   // v0 提案：黑市商船首Boss（n030）通关后停靠（与回廊同期解锁·记档）
    dailyViewCap: 30, // 三道闸①：日计数上限（护 eCPM/防无脑刷）
    ticketPrice: 120, // 广告券（S13.2 块5 定稿占位：星贝 120·日限 1）——黑市党画像启用
    ticketPerDay: 1,
    // 商品表 v0（价位档：小 30-50 / 中 68-98 / 大 128-198 · 挂数值细表）。
    // 模型效果口径（记档）：碎片包给"最落后主力"（舰按阶最低者/员按星最低者）——黑市加速的
    // 主通道是碎片→提前升 SS（乘法·S→SS 单舰 ×1.4 量级），星核/插件是平移项；
    // 强星核=标准核+100 额外战力（"高于标准核一档"的特供人设）。
    goods: {
      shardPack: { price: 40, give: { shipShards: 65, pilotShards: 65 } },   // 小·专属碎片小包
      plugLegend: { price: 45, give: { legendary: 2 } },                     // 小·传奇插件包（×2）
      coreStd: { price: 80, give: { core: 1 } },                             // 中·星核（黑市特供货架）
      coreStrong: { price: 148, give: { core: 1, strongBonus: 100 } },       // 大·强星核
      // 大·高阶星舰（黑市特供·S13.6 原文商品）：模型入账=1000 专属碎片（恰好一段 S→SS 的
      // 整舰当量，"花 128 计数买一艘高阶舰"的类充值旗舰件）+ 350 驾驶员组件
      shipHigh: { price: 128, give: { shipShards: 1000, pilotShards: 350 } },
    },
    // 三道闸②：货架轮换（4 日循环·每日 1 小/中 + 隔日 1 大）+ 大件限购（每日 ≤1 件大件）
    rotation: [['shardPack', 'shipHigh'], ['plugLegend', 'coreStd'], ['shardPack', 'shipHigh'], ['plugLegend', 'coreStrong']], // 步3：毕业前舰包=硬需求上双大件槽（实测核类毕业前0购·B8 毕业后货架换核）
    largeMinPrice: 100, // 价 ≥100 视为大件：限购判定 + 购买策略"给大件留钱"的门槛
    // 购买策略成文（攒计数 → 买当前边际价值最高）：优先级=乘法通道在前、平移项在后；
    // 低优先级商品只有在"买完仍留得起最高优先级大件"时才买（给大件留钱=攒的行为）
    priority: ['shipHigh', 'coreStrong', 'coreStd', 'plugLegend', 'shardPack'],
  },

  // 压力值校准器（任务单③锚定改造·选型实测记档，过程见初值表 v0.3）：
  // 双锚=普通档「n060 破墙日（早锚）+ 毕业日（晚锚）」，γ 分段常数（n≤60 / n>60），
  // 段内保住重采样给出的相对墙高。选型教训：①单 γ="中后期变富→前段变便宜"耦合
  // （v0 §13 诊断病·早锚治愈）；②锚间对数坡道=把中段墙抬贵、毕业墙压便宜，肝档矩阵
  // 倒挂（弃用）；③加密到四锚（n102/n120 破墙日进锚）=γ₂ 对整数破墙日过拟合而抖动，
  // 首周清关被带出 35-40% 带（弃用）。双锚分段=稳态最优解。
  pressureCalib: { iterations: 6, blend: 0.7, gammaLo: 0.5, gammaHi: 3.0, gammaSteps: 24, anchorNodes: [60] },
};

// ---------------------------------------------------------------------------
// 三、四档玩家画像（任务单硬规格 #4：只差参数）
// ---------------------------------------------------------------------------

export const TIERS = {
  // tinkerBonus = 卡关期"换搭配试错"的等效战力折算（S2/S8：墙期体验含换搭配试错；
  // 克制与词缀真实存在，时间多=试出针对性阵容的概率高——按档位折算成小幅有效战力，计入初值表）
  // bountyMinutes / bountyCatchup = 任务单⑤参与度真分层两参数（成文策略假设·记初值表）：
  //   bountyMinutes = 悬赏"辅助战斗分钟预算"/日（张数硬约束·卡关日 ×bounty.stallBudgetMult）——
  //     肝 10 分钟打满 4 张+恶补；轻度 3 分钟 ≈2 张/日（15 分钟玩家掐表打卡，板上常年积压）；
  //     对照锁定口径：普通档悬赏日耗时 ≈4.8-6 分钟，落"辅助战斗 5-10 分钟"带内（B1 红线）。
  //   bountyCatchup = 积压>4 时的恶补意愿（张/日附加）——步2 实证全档统一 +3 恶补是"档差
  //     抹平"主漏洞；分层后 15 分钟玩家不恶补（=0），肝档才有"回来清板"行为。
  肝档: {
    minutesPerDay: 150, sessionsPerDay: 6, adsPerDay: 9,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 6, corridorMinutes: 28, shoppingPower: 1.0, tinkerBonus: 0.16, consolationTries: 3, stallCorridorMult: 2.5,
    bountyMinutes: 10, bountyCatchup: 3,
  },
  重度: {
    minutesPerDay: 90, sessionsPerDay: 4, adsPerDay: 6,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 3, corridorMinutes: 14, shoppingPower: 1.0, tinkerBonus: 0.055, consolationTries: 2, stallCorridorMult: 2.2,
    bountyMinutes: 8, bountyCatchup: 2,
  },
  普通: {
    minutesPerDay: 35, sessionsPerDay: 2.5, adsPerDay: 2,
    dailyCompletion: 0.92, eventCompletion: 0.95,
    salvageRunsPerQueue: 2, corridorMinutes: 7, shoppingPower: 0.8, tinkerBonus: 0.03, consolationTries: 1,
    bountyMinutes: 6, bountyCatchup: 1,
  },
  轻度: {
    minutesPerDay: 15, sessionsPerDay: 1.5, adsPerDay: 0,
    dailyCompletion: 0.88, eventCompletion: 0.92,
    salvageRunsPerQueue: 2, corridorMinutes: 5, shoppingPower: 0.75, tinkerBonus: 0.025, consolationTries: 1,
    bountyMinutes: 3, bountyCatchup: 0,
  },
  // 第五画像·黑市重度党（S13.6 · 任务单③）：非黑市参数与肝档逐项相同（=基线不变性测试
  // 的前提：关掉 bm 行为后必须与肝档逐字段相等）；日观看 ≈ 常规点位 9 + 广告券 1 + 连看
  // 填满至日上限 30（"≈25-30 次"画像口径）。
  黑市党: {
    minutesPerDay: 150, sessionsPerDay: 6, adsPerDay: 9,
    dailyCompletion: 1.0, eventCompletion: 1.0,
    salvageRunsPerQueue: 6, corridorMinutes: 28, shoppingPower: 1.0, tinkerBonus: 0.16, consolationTries: 3, stallCorridorMult: 2.5,
    bountyMinutes: 10, bountyCatchup: 3,
    bm: { chain: true, buy: true, ticket: true },
  },
};

export const TARGETS = { 肝档: 30, 重度: 37, 普通: 47, 轻度: 57 };
// 黑市重度党毕业带（Ron 2026-07-06 认可 ≈D22-25）——单列，不进四档 TARGETS/档位顺序检查。
// 步3 曾因"五主力 SS 饱和假象"把上沿松到 26；任务单⑤板凳深度入模后（满阶溢出碎片流入
// 板凳池继续产边际价值·假象病根已治），带收回 D22-25 严格口径。
export const BM_TARGET = { tier: '黑市党', min: 22, max: 25 };
// 肝党锚墙矩阵验收带（经济层零清等待天数·基线实测 1/0/2/3/0/2·容差 ±1 记档）。
// ⚠️ n150 带 [2,4] 低于 GDD §3"≈4-5"：经济层肝:轻末期成长比 ≈2×，"肝 ≥4"⇔"轻 ≥12"必破
// 7 天硬顶，两约束互斥；按任务单优先级取硬顶（矩阵=容差自定），偏差为体验级发现报 Ron。
export const WALL_MATRIX_BANDS = { 60: [0, 2], 84: [0, 1], 102: [1, 3], 120: [2, 4], 138: [0, 1], 150: [2, 4] };
// 抗漂移变体版矩阵带（±20% 单源扰动下的"校准器承诺"——早锚盯 n060 仍然收紧到 [0,2]
// =v0.1 诊断病的直接探测器；中后段随真实经济形变放宽 1 天；实测 6 变体+指定反例数据定档）
export const WALL_MATRIX_BANDS_DRIFT = { 60: [0, 2], 84: [0, 1], 102: [0, 3], 120: [1, 4], 138: [0, 1], 150: [2, 5] };
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
  total += st.bmExtraPower ?? 0; // 黑市强星核的额外档位（与标准核同层，吃小乘区）
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

/** 悬赏可打张数（任务单⑤参与度真分层·纯函数供 gate 直测）：
 *  min(积压, 意愿, 剩余分钟, 辅助战斗预算)——
 *  意愿 = 日卡4×完成率 + 恶补（仅积压>日卡时·bountyCatchup 按画像·15分钟玩家=0）；
 *  预算 = bountyMinutes（真墙日 ×stallBudgetMult——零推进的卡关日回来清板）。 */
export function bountyCardsFor(tier, backlog, minutesLeft, wallDay, P = PARAMS, T = TRUTHS) {
  if (!(backlog > 0)) return 0;
  const budgetMin = tier.bountyMinutes * (wallDay ? P.bounty.stallBudgetMult : 1);
  const byBudget = Math.floor(budgetMin / P.bounty.minutesPerCard);
  const canByTime = Math.floor(Math.max(0, minutesLeft) / P.bounty.minutesPerCard);
  const want = Math.round(T.bountyDailyCards * tier.dailyCompletion
    + (backlog > T.bountyDailyCards ? (tier.bountyCatchup ?? 0) : 0));
  return Math.max(0, Math.min(backlog, want, canByTime, byBudget));
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
    buildings: { dock: 0, training: 0, habitat: 0, salvage: 0, merchant: 0, supply: 0, research: 0, gallery: 0 },
    residents: 0, workers: 0,
    cleared: 0, corridorLayer: 0, corridorUnlocked: false,
    pityCounter: { ship: 0, pilot: 0 },
    vaultBought: 0,
    bountyBacklog: 0, bountyCardsPlayed: 0,
    ledger: { income: {}, spend: {} },
    negativeViolations: [],
    dailyCleared: [], dailyPower: [], dailyStuck: [],
    graduateDay: null,
    adsUsedTotal: 0, chestsOpened: 0,
    // 黑市计数独立账本（不进 14 键钱包——运行时钱包键有 gate 测试钉死且本子步零回写）
    bm: { balance: 0, earnedTotal: 0, earned: {}, spent: 0, buys: {}, ticketsBought: 0 },
    bmExtraPower: 0, // 强星核的"高于标准核"部分（每颗 +strongBonus·加在小乘区之前）
  };
}

function mkLedgerFns(st, incomeScale) {
  const credit = (source, key, amount) => {
    const scaled = amount * (incomeScale?.[source] ?? 1);
    if (!(scaled > 0)) return;
    st.res[key] = (st.res[key] ?? 0) + scaled;
    const s = (st.ledger.income[source] ??= {});
    s[key] = (s[key] ?? 0) + scaled;
  };
  const debit = (source, key, amount) => {
    if (!(amount > 0)) return true;
    if ((st.res[key] ?? 0) + 1e-9 < amount) return false;
    st.res[key] -= amount;
    const s = (st.ledger.spend[source] ??= {});
    s[key] = (s[key] ?? 0) + amount;
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
}

function doGachaPulls(st, pool, pulls, env, P, T) {
  if (!(pulls > 0)) return;
  const poolSize = pool === 'ship' ? P.gacha.poolSizeShips : P.gacha.poolSizePilots;
  const roster = pool === 'ship' ? st.rosterShips : st.rosterPilots;
  creditMainShards(st, pool, pulls * P.gacha.shardPerPullEV, env.mainShardShare);
  const pity = st.pityCounter[pool] + pulls;
  const pityBodies = Math.floor(pity / T.gachaPity);
  st.pityCounter[pool] = pity % T.gachaPity;
  const bodies = pulls * (P.gacha.bodyP.C + P.gacha.bodyP.B + P.gacha.bodyP.A) + pityBodies;
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

function doLevelUps(st, debit, T) {
  const lineup = Math.min(5, Math.floor(st.rosterShips));
  for (let guard = 0; guard < 5000; guard++) {
    let best = null;
    for (let i = 0; i < lineup; i++) {
      const m = st.mains[i];
      if (!m.ship.owned || m.ship.level >= T.shipLevelCapByTier[m.ship.tier]) continue;
      const c = T.shipLevelCost(m.ship.level);
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
      const c = T.pilotLevelCost(m.pilot.level);
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
  const disc = Math.min(0.2, st.workers * 0.01);
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
    }
  }
}

function doCores(st, debit, P, T) {
  while (st.res.coreFrag >= P.core.synthesisFragCost && debit('coreSynthesis', 'coreFrag', P.core.synthesisFragCost)) {
    st.coresOwned += 1;
  }
  for (let guard = 0; guard < 10; guard++) {
    const price = Math.round(P.core.vaultBasePrice * Math.pow(T.vaultRepeatPriceGrowth, st.vaultBought));
    if (st.res.starGem >= price && debit('coreVault', 'starGem', price)) { st.coresOwned += 1; st.vaultBought += 1; }
    else break;
  }
  const pool = P.core.distinctPool;
  st.coresDistinct = Math.min(pool + 3,
    pool * (1 - Math.exp(-Math.max(0, st.coresOwned - 1) / pool)) + (st.coresOwned > 0 ? 1 : 0));
}

// 黑市购买（S13.6 · 购买策略成文）：攒计数买"当前边际价值最高"商品——大件（强星核/
// 高阶星舰包=乘法通道）优先；买小件前给大件留出底金（balance − 价 ≥ largeMinPrice 才买小），
// 大件每日限购 1（三道闸②）。碎片给最落后主力（舰=阶最低/员=星最低·与通用碎片转换同口径）。
function doBlackMarket(st, tier, day, P) {
  if (st.cleared < P.blackMarket.unlockNode) return;
  const shelf = P.blackMarket.rotation[(day - 1) % P.blackMarket.rotation.length];
  // 按边际价值优先级过货架（PARAMS.blackMarket.priority 成文），非最高优先级商品
  // 要给最高优先级大件留钱（reserve）——"攒计数买大件"的行为模型
  const order = P.blackMarket.priority.filter((id) => shelf.includes(id));
  const topPrice = P.blackMarket.goods[P.blackMarket.priority[0]].price;
  let largeBoughtToday = false;
  for (const id of order) {
    const g = P.blackMarket.goods[id];
    const isLarge = g.price >= P.blackMarket.largeMinPrice;
    if (st.bm.balance < g.price) continue;
    if (isLarge && largeBoughtToday) continue;
    if (id !== P.blackMarket.priority[0] && st.bm.balance - g.price < topPrice) continue;
    st.bm.balance -= g.price;
    st.bm.spent += g.price;
    st.bm.buys[id] = (st.bm.buys[id] ?? 0) + 1;
    if (isLarge) largeBoughtToday = true;
    // 碎片投放目标=「临门一脚」：给离下一次升阶/升星缺口最小的可升主力（真实玩家把
    // 大包砸给马上要突破的那艘=边际价值最高的字面落实）；全员到顶后给阶/星最低者兜底
    if (g.give.shipShards) {
      const cand = st.mains.filter((m) => m.ship.owned && m.ship.tier < 4)
        .sort((a, b) => (TRUTHS.shipAscendCost[a.ship.tier] - a.ship.shards) - (TRUTHS.shipAscendCost[b.ship.tier] - b.ship.shards));
      const target = cand[0] ?? st.mains.filter((m) => m.ship.owned).sort((a, b) => a.ship.tier - b.ship.tier)[0];
      if (target) target.ship.shards += g.give.shipShards;
    }
    if (g.give.pilotShards) {
      const cand = st.mains.filter((m) => m.pilot.owned && m.pilot.star < 5)
        .sort((a, b) => (TRUTHS.pilotStarupCost[a.pilot.star - 1] - a.pilot.shards) - (TRUTHS.pilotStarupCost[b.pilot.star - 1] - b.pilot.shards));
      const target = cand[0] ?? st.mains.filter((m) => m.pilot.owned).sort((a, b) => a.pilot.star - b.pilot.star)[0];
      if (target) target.pilot.shards += g.give.pilotShards;
    }
    if (g.give.legendary) st.plugins.legendary += g.give.legendary;
    if (g.give.core) st.coresOwned += g.give.core;
    if (g.give.strongBonus) st.bmExtraPower += g.give.strongBonus;
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

function doSalvage(st, credit, debit, tier, env, adRun, P, T) {
  const queues = T.salvageQueues(st.buildings.salvage);
  if (queues <= 0) return;
  // 每队 1 趟 24h 保底（信标效率优先）；剩余按档位趟数计划加 2h 短趟消化（时间效率优先）；
  // 短趟可用加速券升为 8h 档产出（星贝盈余时购买）；广告 #5 追加一趟 8h 档。
  const runs = queues * tier.salvageRunsPerQueue + (adRun ? 1 : 0);
  for (let r = 0; r < runs; r++) {
    const isAd = adRun && r === runs - 1;
    const isLong = r < queues;
    const bkey = st.res.beaconEpic >= 1 ? 'beaconEpic' : st.res.beaconRare >= 1 ? 'beaconRare' : st.res.beaconCommon >= 1 ? 'beaconCommon' : null;
    if (!bkey || !debit('salvage', bkey, 1)) break;
    const def = P.salvage.tiers[bkey === 'beaconEpic' ? 'epic' : bkey === 'beaconRare' ? 'rare' : 'common'];
    let dur = isAd ? P.ads.salvageInstantDur : isLong ? 'h24' : 'h2';
    if (dur === 'h2' && st.res.starCargo > P.merchant.richThreshold
      && debit('salvageAccel', 'starCargo', P.salvage.accel.price)) dur = 'h8'; // 加速券
    const mult = T.salvageTimeMult[dur];
    credit('salvage', 'starOre', def.ore * mult);
    credit('salvage', 'starCargo', def.cargo * mult);
    credit('salvage', 'shipBlueprint', (def.universal * mult) / 2);
    credit('salvage', 'pilotShardUniversal', (def.universal * mult) / 2);
    for (const [k, v] of Object.entries(def.fixed)) credit('salvage', k, v);
    const rolls = def.rolls[dur] * env.salvageRollMult;
    const ev = def.rollEV;
    if (ev.universal) { credit('salvage', 'shipBlueprint', (rolls * ev.universal) / 2); credit('salvage', 'pilotShardUniversal', (rolls * ev.universal) / 2); }
    if (ev.supplyTicket) credit('salvage', 'supplyTicket', rolls * ev.supplyTicket);
    if (ev.beaconCommon) credit('salvage', 'beaconCommon', rolls * ev.beaconCommon);
    if (ev.beaconRare) credit('salvage', 'beaconRare', rolls * ev.beaconRare);
    if (ev.beaconEpic) credit('salvage', 'beaconEpic', rolls * ev.beaconEpic);
    if (ev.coreFrag) credit('salvage', 'coreFrag', rolls * ev.coreFrag);
    if (ev.starGem) credit('salvage', 'starGem', rolls * ev.starGem);
    if (ev.finePlugin) st.plugins.fine += rolls * ev.finePlugin;
    if (ev.superiorPlugin) st.plugins.superior += rolls * ev.superiorPlugin;
    if (ev.legendaryPlugin) st.plugins.legendary += rolls * ev.legendaryPlugin;
    // 步3 人口封顶：容量=6+2×居住舱级（lv10=26）——真源未定义容量（②审计盲区），数值域自定入模
    const popCapS = 6 + 2 * st.buildings.habitat;
    if (ev.resident) st.residents = Math.min(popCapS, st.residents + rolls * ev.resident);
    if (ev.worker) st.workers = Math.min(popCapS, st.workers + rolls * ev.worker);
    if (ev.cargoChest) openCargoChest(st, credit, rolls * ev.cargoChest, false, P);
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
    const paused = opts.pause && day >= opts.pause.from && day < opts.pause.from + opts.pause.days;
    const clearedRegions = T.regionSpans.filter((r) => st.cleared >= r.to).length;
    const offCoef = P.regionCoef[clearedRegions];
    let adsLeft = paused ? 0 : adsPerDay;
    let minutes = paused ? 0 : tier.minutesPerDay;
    // 黑市计数（S13.6：全游戏任何激励视频观看 +1，日上限 30）——计数对所有画像常开
    // （纯观察者，不产生任何资源效果）；dis.blackMarket 只关"主动行为"（券/连看/购买），
    // 供基线不变性测试用。
    const bmActive = !dis.blackMarket && tier.bm;
    let bmViewsToday = 0;
    const bmView = (type) => {
      if (bmViewsToday >= P.blackMarket.dailyViewCap) return false;
      bmViewsToday++;
      st.bm.balance++; st.bm.earnedTotal++;
      st.bm.earned[type] = (st.bm.earned[type] ?? 0) + 1;
      return true;
    };
    const useAd = () => { if (adsLeft > 0) { adsLeft--; st.adsUsedTotal++; bmView('points'); return true; } return false; };

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
      const adDouble = watcher && useAd() ? 1.5 : 1; // #1 回港报告 ×2→×1.5（B2 削峰第一刀·Ron 已拍·治单点独大+步1后广告差回上限内）
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
    if (!paused && adsLeft > 0) { // #2 今日补给箱（看广告开箱）
      if (useAd()) {
        credit('supplyChest', 'hullAlloy', P.supplyChest.hullAlloy);
        credit('supplyChest', 'pilotToken', P.supplyChest.pilotToken);
        credit('supplyChest', 'starCargo', P.supplyChest.starCargo);
        credit('supplyChest', 'beaconCommon', P.supplyChest.beaconCommon);
        credit('supplyChest', 'shipBlueprint', P.supplyChest.universal / 2);
        credit('supplyChest', 'pilotShardUniversal', P.supplyChest.universal / 2);
      }
    }
    if (!paused && st.buildings.supply >= 1 && adsLeft > 0 && useAd()) {
      credit('adTickets', 'supplyTicket', P.ads.ticketPerAd); // #6 赞助补给券
    }
    // 广告券（S13.2 块5·商人星贝购·日限 1）：黑市党画像启用——持券把"已用完点位"恢复
    // 一次 = 当日广告预算 +1（走同一优先级链吃点位奖励，观看在 useAd 内计数、不重复+1）
    if (!paused && bmActive && tier.bm.ticket && st.buildings.merchant >= 1) {
      for (let i = 0; i < P.blackMarket.ticketPerDay; i++) {
        if (debit('bmTicket', 'starCargo', P.blackMarket.ticketPrice)) { adsLeft += 1; st.bm.ticketsBought += 1; }
        else break;
      }
    }
    if (!paused && !dis.merchant && st.buildings.merchant >= 1) {
      minutes -= P.merchant.minutes;
      // 买券给货架留预算（步1）：留足 richThreshold 再买券——防"券吃光星贝、篮子/加速券饿死"（券中后期边际低、货架是真价值）
      const afford = Math.floor(Math.max(0, st.res.starCargo - P.merchant.richThreshold) / P.merchant.ticketPrice);
      const buy = Math.min(P.merchant.ticketDailyCap, afford);
      if (buy > 0 && debit('merchantTicket', 'starCargo', buy * P.merchant.ticketPrice)) {
        credit('merchantTicket', 'supplyTicket', buy);
      }
      if (st.res.starCargo > P.merchant.richThreshold) {
        let basketMult = tier.shoppingPower;
        if (watcher && adsLeft > 0 && useAd()) basketMult *= 1.5; // #8 商人刷新
        const B = P.merchant.basket;
        const tryBuy = (entry, give) => {
          const q = entry.p * basketMult;
          if (q > 0 && st.res.starCargo - entry.price * q > P.merchant.richThreshold / 2 && debit('merchantBasket', 'starCargo', entry.price * q)) give(q);
        };
        tryBuy(B.beaconRare, (q) => credit('merchantBasket', 'beaconRare', q)); // 篮子改售稀有信标（步1）
        tryBuy(B.finePlugin, (q) => { st.plugins.fine += q; });
        tryBuy(B.coreFrag5, (q) => credit('merchantBasket', 'coreFrag', q * 5));
        // B5 步3：高价大件货位=限周"定向专属碎片包"（650 星贝 → 最弱主力 舰/员各+18；审计原案"传奇插件包"因插件死库存改品·记档）
        if (day % 7 === 0 && st.res.starCargo > 2500 && debit('merchantBigItem', 'starCargo', 650)) {
          let weakest = st.mains[0];
          for (const m of st.mains) if (m.ship.tier < weakest.ship.tier) weakest = m;
          weakest.ship.shards += 18; weakest.pilot.shards += 18;
        }
      }
      // A6 步3：商人信标回收上架（S10.3 真源既有·治 332 枚死信标）：留 40 张打捞粮，超出按 25 星贝/枚回收
      if (st.res.beaconCommon > 40) {
        const rec = st.res.beaconCommon - 40;
        if (debit('beaconRecycle', 'beaconCommon', rec)) credit('beaconRecycle', 'starCargo', rec * 25);
      }
    }
    if (!paused && !dis.salvage && st.buildings.salvage >= 1) {
      minutes -= P.salvage.minutes;
      const queues = T.salvageQueues(st.buildings.salvage);
      const adRun = watcher && adsLeft > 0
        && (st.res.beaconCommon + st.res.beaconRare + st.res.beaconEpic) > queues && useAd(); // #5
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
          openCargoChest(st, credit, P.events.cycle3.completionChest, watcher && adsLeft > 0 && useAd(), P);
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
          // 结算奖=扩张宝藏完整星核。v0 曾把史诗信标折进过程平摊，口径已改。
          for (const [k, v] of Object.entries(P.events.completion7)) credit('events', k, v);
          st.coresOwned += P.events.completionCore;
        }
        ev7Anchor = day + 1;
      }
    }

    // —— 5. 花钱（黑市→转换→升阶→抽卡→升级→插件→建筑→星核）——
    if (!paused) {
      if (bmActive && tier.bm.buy) doBlackMarket(st, tier, day, P); // 黑市购买（碎片进主力→下面升阶消化）
      convertUniversal(st, debit);
      doAscends(st, T);
      if (!dis.gacha) {
        const tickets = Math.floor(st.res.supplyTicket);
        if (tickets > 0 && debit('gacha', 'supplyTicket', tickets)) {
          const shipPulls = tickets / 2;
          doGachaPulls(st, 'ship', shipPulls, env, P, T);
          doGachaPulls(st, 'pilot', tickets - shipPulls, env, P, T);
        }
      }
      doAscends(st, T);
      doLevelUps(st, debit, T);
      doPluginCraft(st);
      { // 步3 插件回收入模（②审计盲区修复·运行时块6d-3 已实现回收→星贝）：槽位+4 备件之外的传奇=死库存，回收 150 星贝/件
        let slotsNow = 0;
        for (const m of st.mains) slotsNow += T.pluginSlotsByTier[m.ship.tier];
        const plugSurplus = st.plugins.legendary - (slotsNow + 4);
        if (plugSurplus > 0) {
          st.plugins.legendary -= plugSurplus;
          credit('pluginRecycle', 'starCargo', plugSurplus * 150);
        }
      }
      doBuildings(st, debit, P, T);
      doCores(st, debit, P, T);
    }

    // —— 6. 推主线（主线优先吃时间预算；有效战力 = 战力 ×(1+试错折算+板凳折算)）——
    // 板凳深度（任务单⑤）与 tinkerBonus 同层：都是"换搭配应对词缀/克制"的空间折算；
    // 按当日开盘死碎片池取值、一日一采（与试错折算同步，不在日内追涨）。
    let clearedToday = 0;
    let power = teamPower(st, T);
    const eff = 1 + (tier.tinkerBonus ?? 0) + benchEffPct(benchPool(st, T), P);
    if (!paused && st.cleared < T.N) {
      let nodeBudget = Math.floor(Math.max(0, minutes) / P.mainline.minutesPerNode);
      let adDoubleLeft = watcher && adsLeft > 0; // #3 首通翻倍（用在当日最后一关）
      let adPickLeft = watcher && adsLeft > 1;   // #4 再选一个
      while (st.cleared < T.N && nodeBudget > 0 && power * eff >= pressure[st.cleared + 1]) {
        const n = st.cleared + 1;
        const isLast = nodeBudget === 1 || (st.cleared + 1 < T.N && power * eff < pressure[n + 1] && true);
        const opts2 = { watcherChest: watcher && adsLeft > 0, adDouble: false, adExtraPick: false };
        if (isLast && adDoubleLeft && useAd()) { opts2.adDouble = true; adDoubleLeft = false; }
        if (isLast && adPickLeft && useAd()) { opts2.adExtraPick = true; adPickLeft = false; }
        if (opts2.watcherChest && nodeStage(n, T) === 'boss') useAd(); // #7 货舱多选
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
      // 参与度真分层（任务单⑤·结构三件之一二）：
      // ① 张数×预算耦合：可打张数 ≤ 画像"辅助战斗分钟预算"（bountyMinutes）——此前只受
      //    "剩余分钟"约束，对 15 分钟档几乎不咬合（悬赏近乎全档拉平=步2 B1 互斥根因之一）；
      // ② 恶补分层：积压回补意愿 bountyCatchup 按画像（此前全档统一 +3=根因之二，
      //    15 分钟玩家不恶补）。决策逻辑=bountyCardsFor 纯函数（gate 直测）。
      const cards = bountyCardsFor(tier, st.bountyBacklog, minutes, wallDay, P, T);
      if (cards > 0) {
        minutes -= cards * P.bounty.minutesPerCard;
        st.bountyBacklog -= cards;
        st.bountyCardsPlayed += cards;
        const gBase = Math.min(0.5, P.bounty.goldRate * env.goldRate);
        const pNoGoldDay = Math.pow(1 - gBase, T.bountyDailyCards);
        const gEff = gBase + Math.pow(pNoGoldDay, T.bountyGoldPity) * (1 / T.bountyDailyCards) * 0.5;
        const qMult = (1 - 0.32 - gEff) + 0.32 * T.bountyQualityMult.silver + gEff * T.bountyQualityMult.gold;
        const perfect = 1 + P.bounty.perfectRate * (T.bountyPerfectMult - 1);
        const ambushLoss = 1 - T.bountyAmbushRate * (1 - P.bounty.ambushWinRate) * T.bountyAmbushLossPct;
        const half = cards / 2;
        credit('bounty', 'hullAlloy', P.bounty.escortAlloy * offCoef * qMult * perfect * ambushLoss * half);
        credit('bounty', 'starCargo', P.bounty.escortCargo * offCoef * qMult * perfect * ambushLoss * half);
        credit('bounty', 'pilotToken', P.bounty.drillToken * offCoef * qMult * half);
        for (const [k, share] of Object.entries(P.bounty.goldPhysical)) credit('bounty', k, gEff * cards * share);
        const winEV = T.bountyAmbushRate * P.bounty.ambushWinRate * half;
        for (const [k, v] of Object.entries(P.bounty.ambushWinBonus)) credit('bounty', k, winEV * v);
      }
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
          const msMult = watcher && adsLeft > 0 && useAd() ? 2.5 : 1; // #10 里程碑 ×2→×2.5：B2 加肥
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
      const adCons = watcher && adsLeft > 0 && useAd() ? 1 : 0; // #9 战败安慰双倍（首次那单）
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
    coreDays: st.coreDays,
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
    bm: { ...st.bm, earned: { ...st.bm.earned }, buys: { ...st.bm.buys } },
    bmExtraPower: st.bmExtraPower,
    dailyCleared: cl,
    dailyPower: st.dailyPower,
    ledger: st.ledger,
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
    // 真Boss墙节点取"开盘与前一日"的均值——期望模型玩家在日中跨线，整日采样会系统性
    // 高估墙高（普通档时间线被 γ 迭代钉回形状表不受影响，其余档的墙长因此不再多算 1 天）
    const raw = [0];
    for (let n = 1; n <= T.N; n++) {
      const d = schedule[n] ?? schedule[schedule.length - 1];
      const p1 = powerAt(d - 1) || run.dailyPower[0] * 0.8;
      raw[n] = T.bossNodes.includes(n) ? 0.5 * (p1 + (powerAt(d - 2) || p1)) : p1;
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

// 四档基线验收（v2 口径·严格版）：毕业带 ±10%（按整天取整——天数是整数，容差
// round(靶×10%)=肝3/重4/普5/轻6 天）+ 首周 + 档位顺序 + 守恒 + 全档单墙 ≤7 天硬顶 +
// 新手期 n001-n030 零墙 + 肝党锚墙矩阵带。
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
  for (const [node, [lo, hi]] of Object.entries(WALL_MATRIX_BANDS)) {
    const w = std['肝档'].expected.wallWait[node] ?? 0;
    if (w < lo || w > hi) errors.push(`肝档 n${node} 墙 ${w} 天，超出验收带 [${lo},${hi}]`);
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
    if (!g) errors.push(`${t} 未在 ${P.maxDays} 天内毕业（卡在 ${std[t].expected.cleared}）`);
    else if (Math.abs(g - target) > Math.round(target * 0.10)) errors.push(`${t} 毕业 D${g} 偏离靶 ${target}±10%`);
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
  for (const [node, [lo, hi]] of Object.entries(WALL_MATRIX_BANDS_DRIFT)) {
    const w = std['肝档'].expected.wallWait[node] ?? 0;
    if (w < lo || w > hi) errors.push(`肝档 n${node} 墙 ${w} 天，超出变体带 [${lo},${hi}]`);
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
//   四档 ±10% / 肝墙矩阵带 / 硬顶必须仍达标（不钉具体天数）。
//   'treasure' 源（行动宝藏 ×2）= §13 诊断场景的直接对抗验证（指定反例），随 --drift 输出。
// ---------------------------------------------------------------------------

export const DRIFT_VARIANTS = [
  { source: 'offline', mult: 0.8 }, { source: 'offline', mult: 1.2 },
  { source: 'salvage', mult: 0.8 }, { source: 'salvage', mult: 1.2 },
  { source: 'gacha', mult: 0.8 }, { source: 'gacha', mult: 1.2 },
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

export function runAdComparison(pressure, P = PARAMS) {
  const out = {};
  for (const t of ['肝档', '重度', '普通']) {
    const full = simulateEconomyTier(t, pressure, { ads: 'full' }, P);
    const none = simulateEconomyTier(t, pressure, { ads: 'none' }, P);
    out[t] = {
      fullDays: full.graduateDay, zeroDays: none.graduateDay,
      speedup: none.graduateDay && full.graduateDay
        ? Math.round(((none.graduateDay - full.graduateDay) / none.graduateDay) * 1000) / 10 : null,
      zeroMaxWall: none.maxWallDays,
    };
  }
  return out;
}

export function runSensitivity(pressure, P = PARAMS) {
  const base = simulateEconomyTier('普通', pressure, {}, P).graduateDay;
  const sources = ['offline', 'patrol', 'bounty', 'corridor', 'salvage', 'gacha', 'events', 'mail', 'merchant', 'puzzle', 'mainlineRewards'];
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
  console.log('==== S7 真实资源经济模拟器（第三块③ 形状靶v2+双锚校准+黑市 · 期望值模型·零RNG）====');

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
  console.log(errors.length ? `\n❌ 校准未过：\n  - ${errors.join('\n  - ')}` : '\n✅ 校准检查全过（四档±10%/首周/档位顺序/守恒 + 全档≤7天硬顶/新手零墙/肝墙矩阵带 + 黑市党D22-25/计数账本）');

  if (args.has('--ads') || args.has('--all')) {
    console.log('\n—— 广告双跑（全点位吃满 vs 纯零广告）——');
    for (const [t, r] of Object.entries(runAdComparison(pressure))) {
      console.log(`[${t}] 满广告 D${r.fullDays} vs 零广告 D${r.zeroDays} → 加速 ${r.speedup}%（零广告最长墙 ${r.zeroMaxWall} 天）`);
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
  if (args.has('--json')) {
    const fs = await import('node:fs');
    const path = process.env.S7_ECON_JSON ?? 'tools/s7-economy-report.json';
    const strip = (r) => ({ ...r, ledger: undefined, dailyPower: undefined, dailyCleared: undefined });
    const payload = {
      generatedBy: 'simulate-s7-economy.mjs', version: 'v0.3(第三块③ 形状靶v2+双锚+黑市)',
      targets: TARGETS, bmTarget: BM_TARGET, gammas, anchors,
      wallMatrixBands: WALL_MATRIX_BANDS, hardWallCap: HARD_WALL_CAP,
      params: { ...PARAMS }, tiers: TIERS,
      standard: Object.fromEntries(Object.entries(std).map(([t, v]) => [t, {
        expected: strip(v.expected),
        lucky: { graduateDay: v.lucky.graduateDay }, unlucky: { graduateDay: v.unlucky.graduateDay },
      }])),
      ads: runAdComparison(pressure), sensitivity: runSensitivity(pressure),
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
