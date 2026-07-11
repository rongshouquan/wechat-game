#!/usr/bin/env node
// 定价重锚批 C 件 · 钞门天数表（拍板6：验收量纲=天数·只出表不定稿·数字 Ron 终拍）。
// 问题：不用解题钥匙（岩×磐石+砺×铁壁）、纯堆战力硬怼 n102，比正解多卡几天？
// 口径：
//   正解破墙日 = 经济尺 n102 破墙日（工具到手节奏·§8a"卡天数=攒工具的天数"）；
//   纯堆阵容 = 当日真实养成态 mains 套到「无钥匙五舰」（磐石→堡垒 shp08×pil08·其余中位同款）——
//     真实玩家形态："没抽到岩/砺的人拿自己的护卫顶"；
//   纯堆过线日 = 单把胜率首次 ≥20%（能过线·Ron 拍定）·n=40；
//   钞门天数 = 纯堆过线日 − 正解破墙日（预备靶=硬堆 5-7 天·贴 7 天硬顶不破）。
// 用法：node tools/s7-chomen-days.mjs [--samples N] [--maxextra N]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argNum = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : d; };
const SAMPLES = argNum('samples', 40);
const MAX_EXTRA = argNum('maxextra', 14);

const tmp = mkdtempSync(path.join(tmpdir(), 'chomen-'));
const outfile = path.join(tmp, 'e.mjs');
await build({ entryPoints: [path.join(HERE, 's7-battles-entry.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent' });
process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(outfile).href);
const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);

const { pressure } = eco.calibratePressure();
// 纯堆五舰：堡垒(shp08·护卫×pil08)+极焰+烈阳+贯日+晨曦——无岩无砺·站位同中位（坦占 p1c2）。
const NO_KEY_SHIPS = ['shp08', 'shp01', 'shp09', 'shp11', 'shp13'];
const service = new mod.S7BattleRunService();
const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(mod.loadBundle()));

console.log(`# 钞门天数表（n102·纯堆=无钥匙硬怼·过线=单把 ≥20%·n=${SAMPLES}）`);
console.log(`n102 压力=${pressure[102]}（含 lift）`);
for (const tier of ['肝档', '重度', '普通', '轻度']) {
  const r = eco.simulateEconomyTier(tier, pressure, { envelope: 'expected', runFullDays: true });
  let cum = 0; const cums = [];
  for (let d = 0; d < r.dailyCleared.length; d++) { cum += r.dailyCleared[d]; cums.push(cum); }
  const brk = cums.findIndex((c) => c >= 102) + 1; // 正解破墙日（经济口径）
  const rows = [];
  let crossed = null;
  for (let d = brk; d <= Math.min(brk + MAX_EXTRA, r.dailyMains.length); d++) {
    const mains = r.dailyMains[d - 1]; if (!mains) break;
    const m = mains.slice();
    const arranged = [m[1] ?? m[0], m[0], m[2] ?? m[0], m[3] ?? m[0], m[4] ?? m[0]];
    const coreId = arranged.some(([t]) => t === 3 || t === 4) ? 'core08' : undefined;
    const { lineup, teamPower } = mod.genLineupFromMains({ ships: NO_KEY_SHIPS, mains: arranged, coreId });
    let wins = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const rr = service.run({ runtime, progress: { currentNodeId: 'n102', clearedNodeIds: [] }, runSeed: `cm-${tier}-${d}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH });
      if (rr.result.winner === 'player') wins++;
    }
    const w = (wins / SAMPLES) * 100;
    rows.push(`D${d}(+${d - brk}) ${Math.round((teamPower / pressure[102]) * 100)}% ${w.toFixed(0)}%`);
    if (crossed === null && w >= 20) { crossed = d; break; }
  }
  const extra = crossed === null ? `>${MAX_EXTRA}（窗内未过线）` : `${crossed - brk} 天`;
  console.log(`\n## ${tier}（正解破墙 D${brk}·毕业 D${r.graduateDay}）：纯堆多卡 ${extra}`);
  console.log(rows.join(' | '));
}
rmSync(tmp, { recursive: true, force: true });
