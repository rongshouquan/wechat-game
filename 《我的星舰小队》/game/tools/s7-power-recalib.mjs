#!/usr/bin/env node
// 定价重锚专项批 · 构成×强度测量架（任务单A件·实测锚定法的测量端）。
// 干什么：给定"养成构成"（阶/级/星/驾级 ×5 舰·插件/核可控），对标准靶二分搜索
// "单把胜率=50%"的敌强度倍数 s*（强度的操作化定义：这套构成能吃下多强的敌人）。
// 同刻度不同构成的 s* 比值 = 刻度失真的直接测量 → 喂 --fit 拟合新定价（阶基值/星刻度表/级系数）。
//
// 口径：
//  - 标准靶=手感靶同构（8 只均分·防20·射程99·1.1s 间隔·铺前两列·nearest_random_tie），
//    pool=K_HP×500×s、dps=K_DPS×500×s（entry 现行 k 合同 20/0.5·对 s 纯线性——
//    测量仪要线性刻度；敌配管线的 ^1.08 晚段补偿是结构件，不属于"强度"定义）；
//  - 阵容=中位五舰（shp05/01/09/11/13·恒等真配驾驶员）走 S7BattleRunService 全真机世界
//    （升阶积木/驾驶员数值线/天赋机制门/带宽双基线全部由装配器自动注入）；
//  - 网格默认 kit=stripped（无插件无核·隔离 阶/级/星 三轴定价），验证对/残差对用 kit=real；
//  - 采样纪律（§16e 教训）：粗探 n=16、二分 n=24、终点 n=60，独立种子族；
//  - 缓存 tools/s7-power-recalib-data.json：键=构成+kit+仪器版本，断了重跑只补缺（--force 重测）。
// 用法：node tools/s7-power-recalib.mjs [--only key1,key2] [--list] [--report] [--force]
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(HERE, 's7-power-recalib-data.json');
const INSTRUMENT = 'std8@n001 K=20/0.5 crit=中档双基线 lineup=中位五舰'; // 仪器版本（变了=缓存全作废）

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const argStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

// ===== 构成网格（kit: stripped=无插件无核；real=按阶默认插件+S+旗舰装核 core08）=====
// mains 五元组=[阶字母, 舰级, 驾星, 驾级]×5（uniform 简写=单条展开五份）。
const U = (t, lv, star, plv) => Array.from({ length: 5 }, () => [t, lv, star, plv]);
const GRID = [
  // —— 主干路径（升阶保级·星随阶·驾级=舰级同频）——
  { key: 'C-L1', mains: U('C', 1, 1, 1), kit: 'stripped', final: true }, // 基线（先测·s* 归一参考）
  { key: 'C-L10', mains: U('C', 10, 1, 10), kit: 'stripped' },
  { key: 'C-L20', mains: U('C', 20, 1, 20), kit: 'stripped' },
  { key: 'B-L20', mains: U('B', 20, 2, 20), kit: 'stripped' },
  { key: 'B-L30', mains: U('B', 30, 2, 30), kit: 'stripped' },
  { key: 'B-L40', mains: U('B', 40, 2, 40), kit: 'stripped' },
  { key: 'A-L40', mains: U('A', 40, 3, 40), kit: 'stripped' },
  { key: 'A-L50', mains: U('A', 50, 3, 50), kit: 'stripped' },
  { key: 'A-L60', mains: U('A', 60, 3, 60), kit: 'stripped' },
  { key: 'S-L60', mains: U('S', 60, 4, 60), kit: 'stripped' },
  { key: 'S-L70', mains: U('S', 70, 4, 70), kit: 'stripped' },
  { key: 'S-L80', mains: U('S', 80, 4, 80), kit: 'stripped' },
  { key: 'SS-L80', mains: U('SS', 80, 5, 80), kit: 'stripped' },
  { key: 'SS-L90', mains: U('SS', 90, 5, 90), kit: 'stripped' },
  { key: 'SS-L100', mains: U('SS', 100, 5, 100), kit: 'stripped' },
  // —— 星轴隔离（S·L70·驾级70 定住，只动星）——
  { key: 'S-L70-star1', mains: U('S', 70, 1, 20), kit: 'stripped' }, // 驾级受星上限钳（1★≤20）
  { key: 'S-L70-star2', mains: U('S', 70, 2, 40), kit: 'stripped' },
  { key: 'S-L70-star3', mains: U('S', 70, 3, 60), kit: 'stripped' },
  { key: 'S-L70-star5', mains: U('S', 70, 5, 70), kit: 'stripped' },
  // —— 星轴复核（A·L50）——
  { key: 'A-L50-star1', mains: U('A', 50, 1, 20), kit: 'stripped' },
  { key: 'A-L50-star5', mains: U('A', 50, 5, 50), kit: 'stripped' },
  // —— 驾级轴隔离（S·L70·4★ 定住，只动驾级）——
  { key: 'S-L70-p30', mains: U('S', 70, 4, 30), kit: 'stripped' },
  { key: 'S-L70-p80', mains: U('S', 70, 4, 80), kit: 'stripped' },
  // —— 套件残差对（同构成 ±插件 ±核·量化加法项失真）——
  { key: 'S-L70-plug', mains: U('S', 70, 4, 70), kit: 'plugins' },
  { key: 'S-L70-full', mains: U('S', 70, 4, 70), kit: 'real' },
  { key: 'B-L30-plug', mains: U('B', 30, 2, 30), kit: 'plugins' },
  // —— 验证对（发现1 两态·kit=real 真实着装）——
  { key: 'GRAD', mains: [['SS', 90, 5, 90], ['SS', 90, 5, 90], ['S', 80, 4, 80], ['S', 80, 4, 80], ['S', 80, 4, 80]], kit: 'real', final: true },
  { key: 'SOLVER-24K', mains: U('S', 80, 4, 80), kit: 'real', final: true }, // 反解态载体（同 kit 下与 GRAD 比）
  // —— 混编曲线诊断（0..5 艘 SS 逐档＋槽位对照·kit=real·定"锚在哪个混编档"）——
  { key: 'MIX-1SS', mains: [['SS', 90, 5, 90], ['S', 80, 4, 80], ['S', 80, 4, 80], ['S', 80, 4, 80], ['S', 80, 4, 80]], kit: 'real' },
  { key: 'MIX-3SS', mains: [['SS', 90, 5, 90], ['SS', 90, 5, 90], ['SS', 90, 5, 90], ['S', 80, 4, 80], ['S', 80, 4, 80]], kit: 'real' },
  { key: 'MIX-4SS', mains: [['SS', 90, 5, 90], ['SS', 90, 5, 90], ['SS', 90, 5, 90], ['SS', 90, 5, 90], ['S', 80, 4, 80]], kit: 'real' },
  { key: 'SS-L90-real', mains: U('SS', 90, 5, 90), kit: 'real' },
  // 槽位对照：同 2SS+3S，SS 挪去低杠杆位（贯日/晨曦）——分辨"集中养主力"红利是槽位驱动还是阶混合驱动
  { key: 'GRAD-LOWSLOT', mains: [['S', 80, 4, 80], ['S', 80, 4, 80], ['S', 80, 4, 80], ['SS', 90, 5, 90], ['SS', 90, 5, 90]], kit: 'real' },
];

// ===== 搜索参数 =====
const N_COARSE = 24;
const N_BISECT = 60;
const N_FINAL = 200; // 引擎吞吐实测 ~200把/s：终点可以奢侈（steep 曲线下 s* 精度 ~±0.3%）
const BRACKET_STEP = 1.25; // 粗探步长
const BISECT_STOP = 1.05;  // hi/lo ≤ 此值停二分

async function loadMod() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-recalib-'));
  const src = path.join(tmp, 'composite-entry.ts');
  const outfile = path.join(tmp, 'entry.mjs');
  const p = (rel) => path.join(HERE, rel).replace(/\\/g, '/');
  writeFileSync(src, [
    `export * from '${p('s7-battles-entry.ts')}';`,
    `export { shipPowerV0, S7_PLAYER_CRIT_BASE, S7_TIER_POWER_BASE, S7_PILOT_STAR_MULT } from '${p('../assets/scripts/core/s7/S7PowerRating.ts')}';`,
    `export { unitPowerAtLevel } from '${p('../assets/scripts/core/s7/S7UnitGrowth.ts')}';`,
  ].join('\n'));
  await build({
    entryPoints: [src], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

const TIERS = ['C', 'B', 'A', 'S', 'SS'];
const TIER_PLUGINS = { C: ['fine'], B: ['superior', 'fine'], A: ['superior', 'superior', 'fine'], S: ['legendary', 'superior', 'superior'], SS: ['legendary', 'legendary', 'legendary'] };
const SLOT_PLUGINS = ['plg02', 'plg07', 'plg01'];
const SLOTS = ['p1c2', 'p0c1', 'p1c1', 'p2c1', 'p1c0'];
const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];

/** 组装阵容（genLineupFromMains 同构，多一层插件/核控制）；返回 lineup + 旧刻度纸面。 */
function buildLineup(mod, mains, kit) {
  const crit = [
    { kind: 'affix', affix: 'critRate', value: mod.S7_PLAYER_CRIT_BASE.rate, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: mod.S7_PLAYER_CRIT_BASE.dmg, source: 'crit_base' },
  ];
  const withPlug = kit === 'plugins' || kit === 'real';
  // 核给主输出位（1 号位极焰·genLineup"第二舰=主输出位装核"口径）；1 号位不够 S+ 才退而给首个 S+。
  const sPlus = ([t]) => t === 'S' || t === 'SS';
  const coreIdx = kit !== 'real' ? -1 : (sPlus(mains[1]) ? 1 : mains.findIndex(sPlus));
  let oldPaper = 0;
  const lineup = MEDIAN.map((shipId, i) => {
    const [t, level, star, plv] = mains[i];
    const tierIdx = TIERS.indexOf(t);
    const quals = withPlug ? TIER_PLUGINS[t] : [];
    const withCore = i === coreIdx;
    oldPaper += mod.shipPowerV0({ tier: tierIdx, level, pluginQualities: quals, withCore, pilotStar: star, pilotLevel: plv });
    return {
      shipId,
      slotRef: SLOTS[i],
      pilotId: mod.pilotOfShip(shipId),
      pilotLevel: plv,
      pilotStar: star,
      shipTier: tierIdx,
      ...(withCore ? { coreId: 'core08' } : {}),
      plugins: quals.map((q, j) => ({ pluginId: SLOT_PLUGINS[j], quality: q })),
      shipLevel: level,
      extraBlocks: crit,
    };
  });
  return { lineup, oldPaper: Math.round(oldPaper) };
}

/** 标准靶注入（手感靶 mkRefTarget 同构）：s=强度倍数（对 k 合同锚点 500 的线性倍）。 */
function mkRefBundle(mod, baseBundle, s) {
  const b = JSON.parse(JSON.stringify(baseBundle));
  const K_HP = mod.K_HP; const K_DPS = mod.K_DPS;
  const n = 8;
  const pool = K_HP * 500 * s;
  const dps = K_DPS * 500 * s;
  const units = b.battle_unit_stat_param;
  const src = units.find((x) => x.rowId === 'bu_enemy_swarm');
  if (!src) throw new Error('缺 bu_enemy_swarm 源行');
  units.push({
    ...JSON.parse(JSON.stringify(src)), rowId: 'bu_ref_dummy',
    maxHp: Math.max(1, Math.round(pool / n)), attack: Math.max(1, Math.round((dps * 1.1) / n)),
    armor: 20, attackIntervalSec: 1.1, attackRangeCells: 99, targetingTag: 'nearest_random_tie',
  });
  const enc = b.battle_encounter_param.find((x) => x.rowId === 'enc_n001');
  Object.assign(enc, { spawnPlanRefs: ['spawn_n001_w1'], enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_ref_dummy'], timeLimitSec: 120 });
  const spawn = b.battle_spawn_param.find((x) => x.rowId === 'spawn_n001_w1');
  const slots = ['r0c0', 'r1c0', 'r2c0', 'r3c0', 'r4c0', 'r0c1', 'r1c1', 'r2c1'];
  Object.assign(spawn, { unitStatRef: 'bu_ref_dummy', count: n, slotRefs: slots, spawnDelaySec: 0, maxConcurrentOnField: 21 });
  return b;
}

/** 在强度 s 处打 n 把，返回胜率。 */
async function winRateAt(mod, service, baseBundle, lineup, s, nSamples, key, probeIdx) {
  const b = mkRefBundle(mod, baseBundle, s);
  const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(b));
  let wins = 0;
  for (let i = 0; i < nSamples; i += 1) {
    const r = service.run({
      runtime, progress: { currentNodeId: 'n001', clearedNodeIds: [] },
      runSeed: `pr-${key}-${probeIdx}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH,
    });
    if (r.result.winner === 'player') wins += 1;
  }
  return wins / nSamples;
}

/** 解析起点：真机成长数学的几何均近似（1.26^阶 × (1+0.025(L−1)) × sqrt(星系数×(1+0.01驾级))）。 */
function analyticGuess(mod, mains) {
  let g = 0;
  for (const [t, lv, star, plv] of mains) {
    const tierIdx = TIERS.indexOf(t);
    const axis = Math.pow(1.26, tierIdx) * (1 + 0.025 * (lv - 1));
    const pilot = Math.sqrt(mod.S7_PILOT_STAR_MULT[star] * (1 + 0.01 * plv));
    g += axis * pilot;
  }
  return g / 5;
}

/** 二分搜索 s*（胜率 50% 交点）。返回 {sStar, finalWin, battles, probes}。 */
async function searchPoint(mod, service, baseBundle, pt, s0) {
  const { lineup } = buildLineup(mod, pt.mains, pt.kit);
  const probes = [];
  let battles = 0;
  let probeIdx = 0;
  const probe = async (s, n) => {
    const w = await winRateAt(mod, service, baseBundle, lineup, s, n, pt.key, probeIdx++);
    battles += n;
    probes.push({ s: +s.toFixed(4), n, win: +w.toFixed(3) });
    return w;
  };
  // 1) 粗探找括号：lo=最后一个胜≥0.5 的 s，hi=第一个 <0.5 的 s
  let lo = null; let hi = null;
  let s = s0;
  let w = await probe(s, N_COARSE);
  if (w >= 0.5) {
    lo = s;
    for (let i = 0; i < 14 && hi === null; i++) {
      s *= BRACKET_STEP;
      w = await probe(s, N_COARSE);
      if (w >= 0.5) lo = s; else hi = s;
    }
  } else {
    hi = s;
    for (let i = 0; i < 14 && lo === null; i++) {
      s /= BRACKET_STEP;
      w = await probe(s, N_COARSE);
      if (w < 0.5) hi = s; else lo = s;
    }
  }
  if (lo === null || hi === null) throw new Error(`${pt.key}: 括号失败（s0=${s0}·可能起点离谱）`);
  // 2) 对数二分到 ±4%
  while (hi / lo > BISECT_STOP) {
    const mid = Math.sqrt(lo * hi);
    const wm = await probe(mid, N_BISECT);
    if (wm >= 0.5) lo = mid; else hi = mid;
  }
  // 3) 终点：括号两端各 n=60，(log s, 胜率) 线性内插 50% 交点（曲线陡=内插比中点稳）。
  let wLo = await probe(lo, N_FINAL);
  let wHi = await probe(hi, N_FINAL);
  if (wLo < 0.5) { lo /= 1.06; wLo = await probe(lo, N_FINAL); }   // 噪声兜底：保证 straddle
  if (wHi >= 0.5) { hi *= 1.06; wHi = await probe(hi, N_FINAL); }
  const t = Math.max(0, Math.min(1, (wLo - 0.5) / Math.max(1e-9, wLo - wHi)));
  const est = Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)));
  return { sStar: +est.toFixed(4), winLo: +wLo.toFixed(3), winHi: +wHi.toFixed(3), battles, probes };
}

// ===== --fit：新定价拟合（stripped 点集·对数最小二乘）=====
// 模型（每舰）：s*_rel ≈ B̂[t] × LF(L) × SP[σ] × (1+q·λ)，
//   LF(L)=g(L)×Π门（g=growth_band 每轴倍数·门=技能大节点实测增益·60/80/100 实测≈0 且钳 ≥1 保单调）。
// 自由参数：B̂1..4、SP2..5、q、δ20、δ40（11 个·23 个 stripped 观测）。
function fitPricing(cache, gBands) {
  const g = (L) => gBands[Math.max(1, Math.min(100, Math.round(L))) - 1];
  const pts = GRID.filter((pt) => pt.kit === 'stripped' && cache.points[pt.key]);
  const base = cache.points['C-L1'];
  // 观测=队均 s*_rel；预测=五舰均（uniform 网格→就是单舰式；混编验证点不进拟合）
  const obs = pts.map((pt) => ({
    key: pt.key,
    mains: pt.mains,
    y: Math.log(cache.points[pt.key].sStar / base.sStar),
  }));
  // θ = [lnB1..lnB4, lnSP2..lnSP5, q, lnδ20, lnδ40]
  let th = [Math.log(1.12), Math.log(1.41), Math.log(1.91), Math.log(3.53),
    Math.log(1.06), Math.log(1.21), Math.log(1.24), Math.log(1.6), 0.0042, Math.log(1.09), Math.log(1.14)];
  const predLn = (t, mains) => {
    const [lnB1, lnB2, lnB3, lnB4, lnS2, lnS3, lnS4, lnS5, q, lnD20, lnD40] = t;
    const lnB = [0, lnB1, lnB2, lnB3, lnB4];
    const lnSP = [0, 0, lnS2, lnS3, lnS4, lnS5];
    let sum = 0;
    for (const [tier, L, star, lam] of mains) {
      const ti = TIERS.indexOf(tier);
      let lf = Math.log(g(L));
      if (L >= 20) lf += lnD20;
      if (L >= 40) lf += lnD40;
      sum += Math.exp(lnB[ti] + lf + lnSP[star] + Math.log(1 + q * lam) - Math.log(1 + q * 1));
    }
    return Math.log(sum / 5);
  };
  const lossOf = (t) => obs.reduce((a, o) => { const r = predLn(t, o.mains) - o.y; return a + r * r; }, 0);
  // 坐标下降（小问题·数值稳）：每参数一维黄金步进搜索，收敛到步长阈
  let loss = lossOf(th);
  for (let round = 0; round < 200; round += 1) {
    let improved = false;
    for (let i = 0; i < th.length; i += 1) {
      let step = i === 8 ? 0.0005 : 0.02; // q 用绝对步长
      for (let k = 0; k < 40 && step > (i === 8 ? 1e-6 : 1e-4); k += 1) {
        let moved = false;
        for (const dir of [1, -1]) {
          const t2 = th.slice();
          t2[i] += dir * step;
          if (i === 8 && t2[i] < 0) continue; // q ≥ 0
          const l2 = lossOf(t2);
          if (l2 < loss - 1e-12) { th = t2; loss = l2; moved = true; improved = true; break; }
        }
        if (!moved) step /= 2;
      }
    }
    if (!improved) break;
  }
  const [lnB1, lnB2, lnB3, lnB4, lnS2, lnS3, lnS4, lnS5, q, lnD20, lnD40] = th;
  const out = {
    tierBase: [100, 100 * Math.exp(lnB1), 100 * Math.exp(lnB2), 100 * Math.exp(lnB3), 100 * Math.exp(lnB4)],
    starMult: [1, 1, Math.exp(lnS2), Math.exp(lnS3), Math.exp(lnS4), Math.exp(lnS5)],
    q,
    gate20: Math.max(1, Math.exp(lnD20)),
    gate40: Math.max(1, Math.exp(lnD40)),
    rmse: Math.sqrt(loss / obs.length),
  };
  // 逐点残差
  const resid = obs.map((o) => ({ key: o.key, pct: (Math.exp(predLn(th, o.mains) - o.y) - 1) * 100 }));
  return { out, resid, predLn: (mains) => predLn(th, mains) };
}

function runFit(cache, gBands) {
  const { out, resid } = fitPricing(cache, gBands);
  console.log('\n# 新定价拟合结果（stripped 点集·对数 LS）\n');
  console.log(`阶基值 B = [${out.tierBase.map((v) => v.toFixed(1)).join(', ')}]（旧 [100,160,250,380,550]）`);
  console.log(`星刻度 SP = [${out.starMult.slice(1).map((v) => v.toFixed(3)).join(', ')}]（1★..5★·旧 [1,1.08,1.18,1.30,1.45]）`);
  console.log(`驾级系数 q = ${out.q.toFixed(5)}（旧 0.01）`);
  console.log(`技能节点门 δ20=${out.gate20.toFixed(3)} δ40=${out.gate40.toFixed(3)}（δ60/80/100 实测≈0 → 1·保单调）`);
  console.log(`拟合 RMSE（log 域）= ${(out.rmse * 100).toFixed(1)}%\n`);
  console.log('| 点 | 残差（预测−实测） |');
  console.log('|---|---|');
  for (const r of resid) console.log(`| ${r.key} | ${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}% |`);
  // LF 表（1..100·喂 S7PowerRating 常量）
  const lf = [];
  for (let L = 1; L <= 100; L += 1) {
    let v = gBands[L - 1];
    if (L >= 20) v *= out.gate20;
    if (L >= 40) v *= out.gate40;
    lf.push(+v.toFixed(4));
  }
  console.log(`\nLF 表（level 1..100·= growth_band 每轴倍数 × 节点门）：\n${JSON.stringify(lf)}`);
  return { ...out, lf };
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return { instrument: INSTRUMENT, points: {} };
  const c = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  if (c.instrument !== INSTRUMENT) {
    console.log(`[recalib] 仪器版本变化（${c.instrument} → ${INSTRUMENT}），缓存作废重测`);
    return { instrument: INSTRUMENT, points: {} };
  }
  return c;
}
const saveCache = (c) => writeFileSync(CACHE_FILE, JSON.stringify(c, null, 1));

function report(cache, mod) {
  console.log('\n# 构成×强度测量矩阵（s*=胜率50%的敌强度倍数·对锚点500线性）\n');
  console.log('| 构成 | kit | 旧纸面(队) | s* | 两端胜率 | 旧纸面/500 | s*/基线 | 失真比 |');
  console.log('|---|---|---|---|---|---|---|---|');
  const base = cache.points['C-L1'];
  for (const pt of GRID) {
    const r = cache.points[pt.key];
    if (!r) { console.log(`| ${pt.key} | ${pt.kit} | — | 未测 |  |  |  |  |`); continue; }
    const paperRatio = r.oldPaper / (base?.oldPaper ?? 500);
    const sRatio = base ? r.sStar / base.sStar : NaN;
    const distort = paperRatio / sRatio; // >1=纸面虚高（刻度买贵了），<1=纸面低估
    console.log(`| ${pt.key} | ${pt.kit} | ${r.oldPaper} | ${r.sStar} | ${(r.winLo * 100).toFixed(0)}/${(r.winHi * 100).toFixed(0)}% | ${paperRatio.toFixed(2)}× | ${sRatio.toFixed(2)}× | ${distort.toFixed(2)} |`);
  }
}

async function run() {
  const only = argStr('only', '').split(',').filter(Boolean);
  const { mod, cleanup } = await loadMod();
  try {
    const cache = loadCache();
    if (has('list')) {
      for (const pt of GRID) console.log(`${pt.key}\t${pt.kit}\t${cache.points[pt.key] ? '✓已测' : '未测'}`);
      return;
    }
    if (has('report')) { report(cache, mod); return; }
    const gBandsOf = () => {
      const bands = JSON.parse(readFileSync(path.join(HERE, '..', 'assets', 'resources', 'configs', 's7', 'growth_band_param.sample.json'), 'utf-8'));
      const b0 = mod.unitPowerAtLevel(bands, 'ship', 1);
      const g = [];
      for (let L = 1; L <= 100; L += 1) g.push(+(mod.unitPowerAtLevel(bands, 'ship', L) / b0).toFixed(4));
      return g;
    };
    if (has('bands')) { console.log(JSON.stringify(gBandsOf())); return; } // 升级带每轴倍数（与真机同源）
    if (has('fit')) { runFit(cache, gBandsOf()); return; }
    const service = new mod.S7BattleRunService();
    const baseBundle = mod.loadBundle();
    const t0 = Date.now();
    // 基线必须先测（其余点的解析起点靠它归一）
    const order = [...GRID].sort((a, b) => (a.key === 'C-L1' ? -1 : b.key === 'C-L1' ? 1 : 0));
    for (const pt of order) {
      if (only.length && !only.includes(pt.key)) continue;
      if (cache.points[pt.key] && !has('force')) continue;
      const baseS = cache.points['C-L1']?.sStar;
      const guessRel = analyticGuess(mod, pt.mains) / analyticGuess(mod, GRID[0].mains);
      const s0 = baseS ? baseS * guessRel : 1.0;
      const { oldPaper } = buildLineup(mod, pt.mains, pt.kit);
      process.stdout.write(`[recalib] ${pt.key}（kit=${pt.kit}·旧纸面 ${oldPaper}·起点 s0=${s0.toFixed(2)}）… `);
      const tp = Date.now();
      const r = await searchPoint(mod, service, baseBundle, pt, s0);
      cache.points[pt.key] = { spec: pt.mains, kit: pt.kit, oldPaper, ...r };
      saveCache(cache);
      console.log(`s*=${r.sStar}（两端 ${(r.winLo * 100).toFixed(0)}/${(r.winHi * 100).toFixed(0)}%·${r.battles} 把·${((Date.now() - tp) / 1000).toFixed(0)}s）`);
    }
    console.log(`\n[recalib] 总耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟；数据=${CACHE_FILE}`);
    report(cache, mod);
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-power-recalib] 失败：', e); process.exitCode = 1; });
