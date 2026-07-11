#!/usr/bin/env node
// 定价重锚批 · 墙 boost 扫描器（WALL_BOOST 复收敛的调参工具·任务单 A 件跟校链一环）。
// 用途：对指定墙关，在内存里把 WALL_BOOST 换成候选 (pool,dps)，用经济尺"当日真实养成态"
// 打 破墙窗口 各日，输出五段带判读（§8a：卡墙0-5/偷鸡5-10/破墙10-20/+1 30-50/+2 ≥70·普通档严格锚）。
// 用法：node tools/s7-wall-boost-scan.mjs --wall 60 --tier 普通 --pools 0.8,1.0 --dpss 0.55,0.65 [--samples 30]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argStr = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WALL = Number(argStr('wall', '60'));
const TIER = argStr('tier', '普通');
const POOLS = argStr('pools', '1.0').split(',').map(Number);
const DPSS = argStr('dpss', '1.0').split(',').map(Number);
const SAMPLES = Number(argStr('samples', '30'));

const tmp = mkdtempSync(path.join(tmpdir(), 'wbscan-'));
const outfile = path.join(tmp, 'e.mjs');
await build({ entryPoints: [path.join(HERE, 's7-battles-entry.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent' });
process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
const mod = await import(pathToFileURL(outfile).href);
const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);

const { pressure } = eco.calibratePressure();
const r = eco.simulateEconomyTier(TIER, pressure, { envelope: 'expected', runFullDays: true });
let cum = 0; const days = [];
for (let d = 0; d < r.dailyCleared.length; d++) { cum += r.dailyCleared[d]; days.push(cum); }
const brk = days.findIndex((c) => c >= WALL) + 1;
const nodeId = `n${String(WALL).padStart(3, '0')}`;
const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
const service = new mod.S7BattleRunService();
const base = mod.loadBundle();
const cur = { 60: { pool: 1.41, dps: 0.885 }, 102: { pool: 0.9, dps: 0.6 }, 120: { pool: 1.65, dps: 0.95 }, 150: { pool: 1.5, dps: 0.75 } }[WALL];

console.log(`# ${nodeId}（${TIER}·破墙 D${brk}·P=${pressure[WALL]}·现行 boost ${cur.pool}/${cur.dps}·n=${SAMPLES}）`);
for (const pool of POOLS) for (const dps of DPSS) {
  const marks = [];
  for (let d = Math.max(1, brk - 2); d <= brk + 2; d++) {
    const mains = r.dailyMains[d - 1]; if (!mains) continue;
    const m = mains.slice();
    const arranged = [m[1] ?? m[0], m[0], m[2] ?? m[0], m[3] ?? m[0], m[4] ?? m[0]];
    const coreId = arranged.some(([t]) => t === 3 || t === 4) ? 'core08' : undefined;
    const { lineup, teamPower } = mod.genLineupFromMains({ ships: MEDIAN, mains: arranged, coreId });
    const b = JSON.parse(JSON.stringify(base));
    const scale = mod.mapPressureToEnemies(b, nodeId, pressure[WALL]);
    for (const [rowId, attrs] of Object.entries(scale.units)) {
      const row = b.battle_unit_stat_param.find((x) => x.rowId === rowId);
      if (row) Object.assign(row, attrs, {
        maxHp: Math.max(1, Math.round(attrs.maxHp * pool / cur.pool)),
        attack: Math.max(1, Math.round(attrs.attack * dps / cur.dps)),
      });
    }
    const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(b));
    let wins = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const rr = service.run({ runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] }, runSeed: `wb${WALL}-${pool}-${dps}-${d}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH });
      if (rr.result.winner === 'player') wins++;
    }
    const tag = d < brk ? '卡' : d === brk ? '破' : `+${d - brk}`;
    marks.push(`D${d}${tag} ${Math.round((teamPower / pressure[WALL]) * 100)}% ${Math.round((wins / SAMPLES) * 100)}%`);
  }
  console.log(`pool=${pool} dps=${dps} ｜ ${marks.join(' | ')}`);
}
rmSync(tmp, { recursive: true, force: true });
