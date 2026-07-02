// S7 毕业节奏模拟器（2026-07-02 重写）。
//
// 背景：旧版本对着 Codex 03-04 v0.2 草案的 D7/D14/D21/D28 锚点校验 growth_band_param 等配置表——
// 那套数值属于"Codex 旧配置"，按项目铁律（数值真源=B1+v1.0/v2.0设计，Codex 旧配置可无视/自由改，
// 见记忆 numeric-truth-b1-v1-ignore-codex）已不再适用，随旧结论一起作废。
//
// 本版用途：GDD-v2.0 S2/S14"肝档≥30天毕业+每天不断档"拍板（2026-07-02）的落地模型。
// 只建"形状"——用抽象战力单位模拟"关卡所需战力曲线" vs "玩家战力增长"，反推：
//   ① 主线关卡大致要多少个 ② 难度曲线什么形状 ③ 轻/普/重/肝四档各自哪天毕业
// 不是最终数值——真实星矿/合金/驾驶记录换算、抽卡出率、打捞产出等精确值留给阶段三"数值一次性校准"，
// 那一步会把这里的"抽象战力"换成真实资源公式，曲线形状/关卡量以这里锁定的结果为基准。
//
// 参考依据：
// - GDD-v2.0.md S2/S14（肝档≥30天+每天不断档、毕业=主线全清、难度曲线参考《放置军团》）
// - 放置军团实测节奏（2026-07-02 调研）：前期能连续快速推进，中期渐慢，
//   少数几个"真大Boss"（如"魔导师"/"人王"）形成数天到更久的长墙，过了大Boss后明显加速——
//   不是"每隔几关一个小卡点"的均匀分布，是"大量可连续推的关卡 + 少数几个真正难啃的大关卡"。

/**
 * 关卡所需战力曲线：
 * - 平滑段按 q(n) 复利增长，q 本身随 n 从 qStart 渐进抬升到 qEnd（curvePow 控制"前松后紧"的陡峭程度，
 *   越大越front-loaded：前期几乎不设防，后期才明显变陡）。
 * - bossPositions（0~1 的进度占比）标记"真大Boss"节点，该节点所需战力在平滑值基础上乘 bossSpike，
 *   形成真正的长墙（呼应放置军团"卡在少数几个大Boss"的体验）。
 */
function buildRequiredCurve({ N, base, qStart, qEnd, curvePow, bossPositions, bossSpike }) {
  const smooth = [0, base];
  for (let n = 2; n <= N; n++) {
    const t = Math.pow((n - 1) / (N - 1), curvePow);
    const q = qStart + (qEnd - qStart) * t;
    smooth[n] = smooth[n - 1] * (1 + q);
  }
  const actual = [...smooth];
  for (const pos of bossPositions) {
    const n = Math.round(pos * N);
    actual[n] = smooth[n] * bossSpike;
  }
  return actual;
}

/**
 * 单档玩家逐日模拟：
 * - power 按每日复利 r 增长（对应"离线/建筑/打捞都随进度滚雪球"，时间锁为主）。
 * - 撞墙（power 不够下一关）当天额外加 stuckBonus（对应"卡关缓冲"重刷已首通关卡的小额奖励，
 *   固定量、不随 power 增大而增大——天然形成"越到后期边际作用越小"）。
 * - maxNodesPerDay 是会话时长换算的"物理能点得过来的关数"上限（安全阀，正常不应触发到）。
 */
function simulateTier({ N, required, P0, r, stuckBonus, maxNodesPerDay, maxDays }) {
  let power = P0;
  let cleared = 0;
  const dailyLog = [];
  for (let day = 1; day <= maxDays; day++) {
    const wasStuck = power < required[cleared + 1];
    power *= 1 + r;
    if (wasStuck) power += stuckBonus;
    let clearedToday = 0;
    while (cleared < N && power >= required[cleared + 1] && clearedToday < maxNodesPerDay) {
      cleared++;
      clearedToday++;
    }
    dailyLog.push(clearedToday);
    if (cleared >= N) return { graduateDay: day, dailyLog };
  }
  return { graduateDay: null, dailyLog, cleared };
}

function zeroStreaks(log) {
  const streaks = [];
  let cur = 0;
  for (const v of log) {
    if (v === 0) cur++;
    else { if (cur > 0) streaks.push(cur); cur = 0; }
  }
  if (cur > 0) streaks.push(cur);
  return streaks;
}

// ---- 2026-07-02 锁定参数（Ron 确认的"形状"，见 GDD-v2.0.md S2/S14）----
// N=150 是本轮建模的工作基线；综合前后两轮探索，150-190 都是合理量级，
// 精确关卡量由阶段二"内容铺量"实际填充节奏 + 阶段三数值校准共同定稿，此处先按 150 出结果。
const CURVE_PARAMS = {
  N: 150,
  base: 100,
  qStart: 0.003,
  qEnd: 0.03,
  curvePow: 1.1,
  bossPositions: [0.4, 0.55, 0.68, 0.8, 0.9, 1.0], // 6 个"真大Boss"节点位置（进度占比）
  bossSpike: 1.8,
  P0: 100,
};

const SEC_PER_NODE = 45; // 一关"已有把握"的处理耗时估算：想阵容+确认+观战+收奖+推进
const TIERS = {
  轻度: { minutesPerDay: 15, r: 0.050, stuckBonus: 1 },
  普通: { minutesPerDay: 35, r: 0.060, stuckBonus: 2 },
  重度: { minutesPerDay: 90, r: 0.072, stuckBonus: 4 },
  肝档: { minutesPerDay: 150, r: 0.085, stuckBonus: 7 },
};
const MAX_DAYS = 90;

function run() {
  const required = buildRequiredCurve(CURVE_PARAMS);
  console.log(`==== S7 毕业节奏模拟（N=${CURVE_PARAMS.N}，抽象战力单位，非最终数值）====`);
  console.log(`难度曲线：qStart=${CURVE_PARAMS.qStart} qEnd=${CURVE_PARAMS.qEnd} curvePow=${CURVE_PARAMS.curvePow}（前松后紧）；真Boss节点=${CURVE_PARAMS.bossPositions.length}个，spike=${CURVE_PARAMS.bossSpike}x`);

  const results = {};
  for (const [tier, t] of Object.entries(TIERS)) {
    const maxNodesPerDay = Math.max(1, Math.floor((t.minutesPerDay * 60) / SEC_PER_NODE));
    const sim = simulateTier({ N: CURVE_PARAMS.N, required, P0: CURVE_PARAMS.P0, r: t.r, stuckBonus: t.stuckBonus, maxNodesPerDay, maxDays: MAX_DAYS });
    const clearedLog = sim.dailyLog.slice(0, sim.graduateDay ?? sim.dailyLog.length);
    const streaks = zeroStreaks(clearedLog);
    results[tier] = {
      minutesPerDay: t.minutesPerDay,
      graduateDay: sim.graduateDay,
      firstWeekCleared: clearedLog.slice(0, 7).reduce((a, b) => a + b, 0),
      maxWallDays: streaks.length ? Math.max(...streaks) : 0,
      wallsOver2Days: streaks.filter((s) => s >= 2).length,
    };
    const status = sim.graduateDay
      ? `第${sim.graduateDay}天毕业`
      : `MAX_DAYS(${MAX_DAYS})内未毕业，卡在第${sim.cleared}关`;
    console.log(`\n[${tier}档 ${t.minutesPerDay}分钟/天] ${status}`);
    console.log(`  首周清关数=${results[tier].firstWeekCleared}（共${CURVE_PARAMS.N}关的${Math.round((results[tier].firstWeekCleared / CURVE_PARAMS.N) * 100)}%）`);
    console.log(`  最长单次卡关=${results[tier].maxWallDays}天，≥2天的卡关次数=${results[tier].wallsOver2Days}`);
  }

  // ---- 校验：呼应 GDD-v2.0 S2 拍板的方向性约束（不是精确数值断言，是形状健康度检查）----
  const errors = [];
  if (!results['肝档'].graduateDay || Math.abs(results['肝档'].graduateDay - 30) > 5) {
    errors.push(`肝档毕业天数偏离30天目标过多：${results['肝档'].graduateDay}`);
  }
  const order = ['肝档', '重度', '普通', '轻度'].map((t) => results[t].graduateDay);
  for (let i = 1; i < order.length; i++) {
    if (!(order[i] > order[i - 1])) errors.push(`档位毕业天数顺序不对：应肝<重<普<轻，实际=${JSON.stringify(order)}`);
  }
  if (results['肝档'].firstWeekCleared < CURVE_PARAMS.N * 0.25) {
    errors.push(`肝档首周清关占比过低（<25%），不满足"前期推得爽"的形状要求`);
  }

  console.log(`\n==== 结果 ====`);
  if (errors.length > 0) {
    console.error('形状校验未通过:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('形状校验通过（肝档≈30天毕业、四档顺序正确、首周清关占比达标）');
}

run();
