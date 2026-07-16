#!/usr/bin/env node
// 段6 · 全线初见验收批扫器（任务单 6.4·总控验收件）。
// 口径：普通档"该关到达时点养成态"（--milestone-power 同源=经济尺快照 milestones）×40 样本，
//   节点关全集=13 Boss+38 精英+眼段 401-450（≥任务单"88 节点关"·多扫不漏扫），
//   豁免三族自动跳过对带判定（依据列如实注）：斩首=victoryRule 机器判（§21.3a 速胜结构·含 n390 复合豁免
//   =总控 07-16 措辞令）/镜像=mirrorLineup 机器判（恒定胜率型·爬坡带失效）/蜜月=sf01 精英（战力比
//   400-1300% 结构性碾过）。眼段=段均落带+逐关散布记档（组合方差 ±40pt 段均口径=段4 裁决）。
// 别用 wall-boost-scan 硬扫全量（每候选重跑经济尺≈2 小时陷阱·备忘二.1）——本工具毫秒级/场。
// 用法：node tools/s7-initial-view-scan.mjs [--samples 40] [--fast]（fast=10 样本粗扫·调参轮用）
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argStr = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SAMPLES = argv.includes('--fast') ? 10 : Number(argStr('samples', '40'));

const tmp = mkdtempSync(path.join(tmpdir(), 'iview-'));
const outfile = path.join(tmp, 'e.mjs');
await build({ entryPoints: [path.join(HERE, 's7-battles-entry.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent' });
process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(outfile).href);

const DIR = path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const mainline = JSON.parse(readFileSync(path.join(DIR, 'mainline_node_config.sample.json'), 'utf-8'));
const encs = JSON.parse(readFileSync(path.join(DIR, 'battle_encounter_param.sample.json'), 'utf-8'));
const encOf = (id) => encs.find((e) => e.nodeRef === id);

// —— 节点关全集 ——
const nodes = mainline
  .filter((n) => {
    const num = Number(n.nodeId.slice(1));
    return n.nodeTypeTag === 'boss' || n.nodeTypeTag === 'elite' || (num >= 401 && num <= 450);
  })
  .map((n) => ({ id: n.nodeId, num: Number(n.nodeId.slice(1)), type: n.nodeTypeTag }));

// —— 带靶与身份（剧本 v1.3/细表 §8a/§21 声明）——
const TIER_BAND = { 福利: [0.95, 1.0], 无压力: [0.70, 0.85], 微阻滞: [0.40, 0.60], 阻滞: [0.20, 0.35], 变态: [0.05, 0.15] };
const EYE_SEGS = [
  { from: 401, to: 404, name: '检阅', band: [1.0, 1.0] },
  { from: 405, to: 415, name: '两叠', band: [0.30, 0.45] },
  { from: 416, to: 430, name: '三叠', band: [0.25, 0.40] },
  { from: 431, to: 443, name: '四叠', band: [0.22, 0.35] },
  { from: 444, to: 449, name: '五叠', band: [0.20, 0.30] },
];
const WALLS = new Set([104, 140, 176, 250, 282, 312, 368, 400, 450]);
const CLIMAX = { 54: '首Boss·高潮', 214: '高潮②', 340: '高潮③', 384: '前哨仪式仗（迟到者奖励·§21.1 裁决）' };

const rows = [];
for (const n of nodes) {
  const rep = (await mod.scanMainlineAsync({ family: 'median', samples: SAMPLES, fromNode: n.num, toNode: n.num, milestonePower: true }))[0];
  if (!rep) continue;
  const enc = encOf(n.id) ?? {};
  const win = rep.winRate;
  const pct = Math.round(win * 100);
  let identity = '';
  let band = null;
  let verdict = '';
  if (n.type === 'elite') {
    const tier = enc.eliteTier ?? '?';
    identity = `精英·${tier}`;
    // 豁免三族（机器判·依据如实注）
    if (enc.victoryRule === 'kill_target') {
      verdict = `豁免（斩首速胜结构·§21.3a·实测 ${pct}%）`;
    } else if (enc.mirrorLineup === true) {
      verdict = `豁免（镜像恒定胜率型·爬坡带失效·单点 ${pct}% 记档）`;
    } else if (n.num <= 104) {
      verdict = `豁免（sf01 蜜月结构性碾过·战力比 400-1300%·实测 ${pct}%）`;
    } else {
      band = TIER_BAND[tier] ?? null;
    }
  } else if (n.type === 'boss') {
    if (WALLS.has(n.num)) {
      identity = `Boss·墙（矩阵语义）`;
      verdict = `墙关记档（撞墙态 ${pct}%·卡天由经济矩阵承载·§20.2 分工）`;
    } else {
      identity = `Boss·${CLIMAX[n.num] ?? '高潮'}`;
      verdict = `高潮记档（${pct}%·碾过/演出仗语义）`;
    }
  } else {
    const seg = EYE_SEGS.find((s) => n.num >= s.from && n.num <= s.to);
    identity = `眼段·${seg?.name ?? '?'}`;
    band = null; // 眼段=段均口径（表尾判）·逐关散布记档
    verdict = `散布记档（段均判定见表尾）`;
  }
  if (band) {
    const [lo, hi] = band;
    verdict = win >= lo - 1e-9 && win <= hi + 1e-9 ? '✓ 带内'
      : win > hi ? `⚠ 超带 +${Math.round((win - hi) * 100)}pt`
        : `⚠ 偏狠 −${Math.round((lo - win) * 100)}pt`;
  }
  rows.push({ ...n, identity, pct, dur: rep.avgDurationSec, verdict, power: rep.teamPower, pressure: rep.pressure });
  console.error(`[scan] ${n.id} ${identity} ${pct}% ${rep.avgDurationSec.toFixed(1)}s ${verdict}`);
}

// —— 全表 ——
console.log(`# 全线初见验收表（普通档到达态·${SAMPLES} 样本/关·共 ${rows.length} 关）`);
console.log('| 关 | 身份 | 胜率 | 均时 | 判定/豁免依据 |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.identity} | ${r.pct}% | ${r.dur.toFixed(1)}s | ${r.verdict} |`);

// —— 眼段段均（组合方差 ±40pt 段均口径·段4 裁决）——
console.log('\n## 眼段段均判定');
for (const seg of EYE_SEGS) {
  const segRows = rows.filter((r) => r.type !== 'boss' && r.num >= seg.from && r.num <= seg.to);
  if (segRows.length === 0) continue;
  const avg = segRows.reduce((s, r) => s + r.pct, 0) / segRows.length;
  const [lo, hi] = seg.band;
  const inBand = seg.name === '检阅' ? avg >= 99.9 : avg >= lo * 100 - 1e-9 && avg <= hi * 100 + 1e-9;
  const spread = `${Math.min(...segRows.map((r) => r.pct))}-${Math.max(...segRows.map((r) => r.pct))}`;
  console.log(`- ${seg.name}（${seg.from}-${seg.to}·${segRows.length} 关）：段均 ${avg.toFixed(1)}%（带 ${lo * 100}-${hi * 100}）${inBand ? '✓' : '⚠ 出带'}·散布 ${spread}%·零胜率关=[${segRows.filter((r) => r.pct === 0).map((r) => r.id).join(',') || '无'}]`);
}
rmSync(tmp, { recursive: true, force: true });
