// S7 毕业节奏模拟器（形状靶）。
//
// ============================================================================
// 【v2 · 2026-07-06 递进墙拍板版（现行靶）】
// Ron 2026-07-06 重定节奏形状（GDD-v2.0 §3"节奏取向"改写）：
//   - 新手期 n001-n030 零墙纯爽推（全档）；
//   - 墙时长随进度递进（肝党锚：n060≈1天 → n102≈2天 → n120≈3天 → n150≈4-5天）；
//   - n084/n138 余势墙零等待（全档）；
//   - 任何档位任何单墙 ≤7 天硬顶（仅毕业墙可近顶——轻度 n150=7 恰在顶上）；
//   - 四档毕业 肝30/重37/普47/轻57 与首周清关 35-40% 不变。
// 旧 v1 靶（六墙均匀 spike 1.8，2026-07-02 版）随该拍板【作废】，参数保留在下方
// CURVE_PARAMS_V1_DEPRECATED 仅供历史对照，不再参与任何校验。
//
// v2 相对 v1 的实现差异（拟合过程见 任务单③ 完成报告 / 初值表 v0.3）：
//   ① 光滑曲线完全不动（qStart/qEnd/curvePow 与 v1 相同）——递进感全部由尖峰表达；
//   ② Boss 尖峰从"位置占比×统一 1.8"改为"真实节点号 × 每墙独立尖峰"
//      （v1 用占比取整会算出 n083/n135，与真实拓扑 n084/n138 差 1-3 关，v2 顺带修正）；
//   ③ 四档日成长率 r 相应回落（墙变矮 → 等待变少 → 毕业提前，r 下调把毕业日钉回四靶；
//      各 r 取"恰好毕业靶日"可行区间的中点，区间宽 0.09-0.34pp，不在参数刀刃上）。
//
// 用途不变：只建"形状"（抽象战力单位），是经济模拟器 simulate-s7-economy.mjs 的校准靶；
// 该文件内嵌本模型只读副本（SHAPE），两处必须同步改、gate 测试钉住副本输出。
// ============================================================================

/**
 * 关卡所需战力曲线 v2：
 * - 平滑段与 v1 同构：按 q(n) 复利增长，q 随 n 从 qStart 渐进抬升到 qEnd（curvePow 控制前松后紧）。
 * - bossSpikes：{节点号: 尖峰倍数}，该节点所需战力 = 平滑值 × 尖峰。
 *   递进墙 = 尖峰随进度抬升（1.12 → 1.26 → 1.30 → 1.42）；
 *   n084/n138 尖峰 ≈1（余势墙：叙事上是 Boss，数值上破前墙的余势当天带过、零等待）。
 */
function buildRequiredCurveV2({ N, base, qStart, qEnd, curvePow, bossSpikes }) {
  const smooth = [0, base];
  for (let n = 2; n <= N; n++) {
    const t = Math.pow((n - 1) / (N - 1), curvePow);
    const q = qStart + (qEnd - qStart) * t;
    smooth[n] = smooth[n - 1] * (1 + q);
  }
  const actual = [...smooth];
  for (const [node, spike] of Object.entries(bossSpikes)) {
    actual[Number(node)] = smooth[Number(node)] * spike;
  }
  return actual;
}

/**
 * 单档玩家逐日模拟（与 v1 逐行同算法）：
 * - power 按每日复利 r 增长；撞墙当天额外加 stuckBonus（固定量，后期边际递减）。
 * - maxNodesPerDay 是会话时长换算的"物理能点得过来的关数"上限。
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

/** 逐墙零清等待天数 + 新手期卡关天数 + 最长零清连段（v2 墙指标口径：整天零推进才算等待）。 */
function wallMetrics(dailyLog, bossNodes, newbieUntil) {
  const wallWait = Object.fromEntries(bossNodes.map((b) => [b, 0]));
  let cleared = 0;
  let newbieStuck = 0;
  let maxWall = 0;
  let cur = 0;
  for (const c of dailyLog) {
    if (c === 0) {
      cur++;
      if (cleared < newbieUntil) newbieStuck++;
      const next = cleared + 1;
      if (wallWait[next] !== undefined) wallWait[next]++;
    } else {
      cur = 0;
    }
    maxWall = Math.max(maxWall, cur);
    cleared += c;
  }
  return { wallWait, newbieStuck, maxWall };
}

// ---- v1 参数（2026-07-02 锁定 → 2026-07-06 作废·仅历史对照）----
// 作废原因：Ron 2026-07-06 拍板"递进墙"，六墙均匀 1.8× 的旧形状不再是靶。
const CURVE_PARAMS_V1_DEPRECATED = {
  N: 150,
  base: 100,
  qStart: 0.003,
  qEnd: 0.03,
  curvePow: 1.1,
  bossPositions: [0.4, 0.55, 0.68, 0.8, 0.9, 1.0],
  bossSpike: 1.8,
  P0: 100,
  tiers: {
    轻度: { minutesPerDay: 15, r: 0.050, stuckBonus: 1 },
    普通: { minutesPerDay: 35, r: 0.060, stuckBonus: 2 },
    重度: { minutesPerDay: 90, r: 0.072, stuckBonus: 4 },
    肝档: { minutesPerDay: 150, r: 0.085, stuckBonus: 7 },
  },
};

// ---- v2 锁定参数（2026-07-06 递进墙拍板 · 任务单③拟合定稿）----
// 尖峰选定说明（端到端扫描定稿·过程记初值表 v0.3）：s102/s120/s150 不是只按形状层
// 拟合，而是"形状约束 × 经济模拟实测"联合选优——经济层轻度末期日成长 ≈ 肝档一半，
// s120≥1.30 会让轻度 n120 卡 8 天破硬顶；s150≥1.42 让轻度 n150 破顶。最终组合让
// 经济层肝档矩阵落 1/2/3/2、轻度双末墙贴顶 7、全档硬顶不破。
// ⚠️ 已知偏差（体验级·报 Ron）：经济层肝档"毕业墙 n150"实测 2-3 天，达不到 GDD §3
// 的 ≈4-5 天——肝:轻末期成长比 ≈2×，同一堵墙"肝 ≥4 天"⇔"轻 ≥12 天"必破 7 天硬顶，
// 两约束在经济层互斥；按任务单优先级（硬顶=锁定决策 > 矩阵=容差自定）取硬顶。
const CURVE_PARAMS_V2 = {
  N: 150,
  base: 100,
  qStart: 0.003,
  qEnd: 0.03,
  curvePow: 1.1,
  // 六 Boss 真实节点号（= generate-s7-mainline-topology 墙位）× 递进尖峰
  bossSpikes: { 60: 1.12, 84: 1.01, 102: 1.24, 120: 1.27, 138: 1.0, 150: 1.38 },
  P0: 100,
};

const SEC_PER_NODE = 45;
const NEWBIE_UNTIL = 30; // n001-n030 新手期零墙（含首Boss n030 本身当天可过）
const HARD_WALL_CAP = 7; // 任何档位任何单墙 ≤7 天（锁定决策）
const TIERS_V2 = {
  // r = 恰好毕业靶日可行区间中点（区间宽 0.09-0.33pp·不在刀刃上）
  轻度: { minutesPerDay: 15, r: 0.0452, stuckBonus: 1 },
  普通: { minutesPerDay: 35, r: 0.0528, stuckBonus: 2 },
  重度: { minutesPerDay: 90, r: 0.0637, stuckBonus: 4 },
  肝档: { minutesPerDay: 150, r: 0.0741, stuckBonus: 7 },
};
const GRAD_TARGETS = { 肝档: 30, 重度: 37, 普通: 47, 轻度: 57 };
// 肝党锚墙矩阵靶（形状层·零清等待天数）：n060=1 / n102=2 / n120=2-3（GDD ≈3 的 −1 容差，
// 换轻度经济层不破硬顶·记档）/ n150=4-5（形状层毕业墙保持最长）；n084/n138=0
const LIVER_WALL_TARGET = { 60: [1, 1], 84: [0, 0], 102: [2, 2], 120: [2, 3], 138: [0, 0], 150: [4, 5] };
const MAX_DAYS = 90;

function run() {
  const P = CURVE_PARAMS_V2;
  const required = buildRequiredCurveV2(P);
  const bossNodes = Object.keys(P.bossSpikes).map(Number);
  console.log(`==== S7 毕业节奏模拟 v2（N=${P.N}，递进墙 · 抽象战力单位，非最终数值）====`);
  console.log(`光滑曲线：qStart=${P.qStart} qEnd=${P.qEnd} curvePow=${P.curvePow}（与 v1 相同）`);
  console.log(`递进尖峰：${bossNodes.map((b) => `n${b}=${P.bossSpikes[b]}`).join(' ')}（旧 v1 均匀 1.8× 已作废）`);

  const results = {};
  for (const [tier, t] of Object.entries(TIERS_V2)) {
    const maxNodesPerDay = Math.max(1, Math.floor((t.minutesPerDay * 60) / SEC_PER_NODE));
    const sim = simulateTier({ N: P.N, required, P0: P.P0, r: t.r, stuckBonus: t.stuckBonus, maxNodesPerDay, maxDays: MAX_DAYS });
    const log = sim.dailyLog.slice(0, sim.graduateDay ?? sim.dailyLog.length);
    const m = wallMetrics(log, bossNodes, NEWBIE_UNTIL);
    results[tier] = {
      graduateDay: sim.graduateDay,
      firstWeekCleared: log.slice(0, 7).reduce((a, b) => a + b, 0),
      ...m,
    };
    const status = sim.graduateDay ? `第${sim.graduateDay}天毕业` : `MAX_DAYS(${MAX_DAYS})内未毕业，卡在第${sim.cleared}关`;
    console.log(`\n[${tier}档 ${t.minutesPerDay}分钟/天 r=${t.r}] ${status}`);
    console.log(`  首周清关=${results[tier].firstWeekCleared}（${Math.round((results[tier].firstWeekCleared / P.N) * 1000) / 10}%）  最长墙=${m.maxWall}天  新手期卡关=${m.newbieStuck}天`);
    console.log(`  墙矩阵（零清等待天数）：${bossNodes.map((b) => `n${b}=${m.wallWait[b]}`).join(' ')}`);
  }

  // ---- v2 形状校验（任务单③硬规格#1 全量）----
  const errors = [];
  for (const [tier, target] of Object.entries(GRAD_TARGETS)) {
    if (results[tier].graduateDay !== target) errors.push(`${tier}毕业 D${results[tier].graduateDay} ≠ 靶 ${target}（v2 靶四档钉死）`);
  }
  for (const [node, [lo, hi]] of Object.entries(LIVER_WALL_TARGET)) {
    const w = results['肝档'].wallWait[node];
    if (w < lo || w > hi) errors.push(`肝档 n${node} 墙 ${w} 天，靶 ${lo === hi ? lo : `${lo}-${hi}`}`);
  }
  for (const [tier, r] of Object.entries(results)) {
    if (r.newbieStuck > 0) errors.push(`${tier}新手期（n001-n030）卡关 ${r.newbieStuck} 天，应零墙`);
    if (r.maxWall > HARD_WALL_CAP) errors.push(`${tier}最长墙 ${r.maxWall} 天 > 硬顶 ${HARD_WALL_CAP}`);
    for (const b of [84, 138]) {
      if (r.wallWait[b] > 0) errors.push(`${tier} n${b} 余势墙等待 ${r.wallWait[b]} 天，应零等待`);
    }
  }
  const fwPct = (results['普通'].firstWeekCleared / P.N) * 100;
  if (fwPct < 35 || fwPct > 40) errors.push(`普通档首周清关 ${Math.round(fwPct * 10) / 10}% 超出 35-40%`);

  console.log(`\n==== 结果 ====`);
  if (errors.length > 0) {
    console.error('v2 形状校验未通过:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('v2 形状校验通过（四档毕业钉靶、肝墙递进 1/2/3/4-5、新手零墙、全档 ≤7 天硬顶、n084/n138 零等待、普通首周 35-40%）');
}

run();
