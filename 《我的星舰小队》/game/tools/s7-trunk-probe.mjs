#!/usr/bin/env node
// 机制批③段三 · 躯干重校验收面探针：四个验收面一屏读数（②三档手感/③砍半必败/④精英小卡/⑤乱搭≈0%）。
// 普通关按题型分组给 完美(counter)/正常(median)/差(poor)/乱搭(misfit) 平均时长与胜率——
// 分离度病灶直接按题带定位（全局旋钮的反馈回路·禁点调纪律的观测面）。
// 用法：node tools/s7-trunk-probe.mjs [--samples N] [--from N] [--to N]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argNum = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
};
const SAMPLES = argNum('samples', 3);
const FROM = argNum('from', 9);
const TO = argNum('to', 150);

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-trunk-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

async function run() {
  const { mod, cleanup } = await loadEntry();
  try {
    const fams = ['counter', 'median', 'poor', 'misfit'];
    const reports = {};
    for (const f of fams) {
      reports[f] = await mod.scanMainlineAsync({ family: f, samples: SAMPLES, fromNode: FROM, toNode: TO, milestonePower: true });
    }
    const half = await mod.scanMainlineAsync({ family: 'median', samples: SAMPLES, fromNode: FROM, toNode: TO, milestonePower: true, powerRatio: 0.5 });
    const encs = mod.loadBundle().battle_encounter_param;
    const tagOf = new Map(encs.map((e) => [e.nodeRef, e.problemTagRef]));

    // 面②：普通关按题型分组（完美/正常/差三档 + 面⑤乱搭）
    const tags = {};
    for (const f of fams) {
      for (const r of reports[f]) {
        if (r.stage !== 'normal') continue;
        const tag = tagOf.get(r.nodeId) ?? '?';
        const t = (tags[tag] ??= {});
        const s = (t[f] ??= { n: 0, dur: 0, win: 0 });
        s.n += 1; s.dur += r.avgDurationSec; s.win += r.winRate;
      }
    }
    console.log(`# 躯干探针（samples=${SAMPLES}·n${FROM}-n${TO}·到达态）`);
    console.log('## 面② 三档手感（普通关·靶=完美15/正常25/差45）+面⑤ 乱搭（靶≈0%胜）');
    console.log('题型          | 完美(时长/胜)   | 正常          | 差            | 乱搭胜率');
    for (const [tag, t] of Object.entries(tags)) {
      const cell = (f) => t[f] ? `${(t[f].dur / t[f].n).toFixed(1)}s/${((t[f].win / t[f].n) * 100).toFixed(0)}%` : '-';
      const mis = t.misfit ? `${((t.misfit.win / t.misfit.n) * 100).toFixed(0)}%` : '-';
      console.log(`${tag.padEnd(12)} | ${cell('counter').padEnd(14)} | ${cell('median').padEnd(13)} | ${cell('poor').padEnd(13)} | ${mis}`);
    }
    const all = (f, stage) => {
      const rows = reports[f].filter((r) => r.stage === stage);
      const d = rows.reduce((a, r) => a + r.avgDurationSec, 0) / rows.length;
      const w = rows.reduce((a, r) => a + r.winRate, 0) / rows.length;
      return `${d.toFixed(1)}s/${(w * 100).toFixed(0)}%`;
    };
    console.log(`普通关总均：完美 ${all('counter', 'normal')} · 正常 ${all('median', 'normal')} · 差 ${all('poor', 'normal')} · 乱搭 ${all('misfit', 'normal')}`);
    // 面③：砍半必败（普通关胜率≈0 为达标）
    const hn = half.filter((r) => r.stage === 'normal');
    const bands = [[9, 30], [31, 60], [61, 100], [101, 150]];
    const cells = bands.map(([lo, hi]) => {
      const rs = hn.filter((r) => { const n = Number(r.nodeId.slice(1)); return n >= lo && n <= hi; });
      if (!rs.length) return `n${lo}-${hi}: -`;
      return `n${lo}-${hi}: ${((rs.reduce((a, r) => a + r.winRate, 0) / rs.length) * 100).toFixed(0)}%`;
    });
    console.log(`## 面③ 砍半战力（×0.5·靶=中期起必败·教学/碾压段除外）：${cells.join(' · ')}`);
    // 面④：精英小卡（中位·靶=偶尔小卡不全胜或明显更慢）
    console.log(`## 面④ 精英（中位）：${all('median', 'elite')}（普通 ${all('median', 'normal')}）·完美 ${all('counter', 'elite')}`);
    console.log(`## Boss（挂墙重对·此处仅观察）：中位 ${all('median', 'boss')} · 完美 ${all('counter', 'boss')}`);
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-trunk-probe] 失败：', e); process.exitCode = 1; });
