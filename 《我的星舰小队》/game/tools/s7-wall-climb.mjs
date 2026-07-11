#!/usr/bin/env node
// 对锚与阶梯批 · 逐墙爬坡矩阵（Ron 07-10 破墙爬坡曲线的实测工具·任务单硬规格 #2）。
// 把两把尺子拧在一起：经济尺（在内存重算压力表+四档逐日开打战力+当日养成态）× 战斗模拟
// （中位队按"卡墙那天的真实队伍"组队打墙关）→ 每墙×每档一行"卡墙各日/偷鸡/破墙/+1/+2"单把胜率。
// 阵容口径：genLineupFromMains（经济尺 dailyMains 快照逐舰组装）——不做战力反解，
// 消掉"相邻战力点跳组合"的形状噪声（§20.2 同款病·本工具首测 n150 85%→42% 实证后改此口径）。
//
// 验收口径（总控 2026-07-10 裁定）：
//   普通档=严格锚（逐日落五段带 0-5/5-10/10-20/30-50/≥70）；肝/重/轻=矩阵天数±1+单调，
//   逐日曲线如实呈现、越带格标注不硬调；快步长跳段（如肝 n060 日+20%）=预期如实标注；
//   n102=解题墙特例（卡天数=攒工具天数·中位默认队全程贴 0 属预期形态·真验收=B5 五态矩阵
//   +钞门×1.5+工具时间线，见 n102 专档），本工具照出曲线但不套五段带。
// 用法：node tools/s7-wall-climb.mjs [--samples N] [--wall 60,120] [--tier 普通]
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
const argStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const SAMPLES = argNum('samples', 20);
const WALLS = argStr('wall', '60,102,120,150').split(',').map(Number);
const TIERS = argStr('tier', '肝档,重度,普通,轻度').split(',');

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-climb-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

// 五段带（普通档严格判定；日别名→带）
const BANDS = [
  ['卡墙', 0, 5], ['偷鸡', 5, 10], ['破墙', 10, 20], ['+1日', 30, 50], ['+2日', 70, 100],
];
function bandOf(alias) {
  const b = BANDS.find(([a]) => a === alias);
  return b ? [b[1], b[2]] : null;
}

/** mains（主力1..5·主力1 最先冲S）→ 中位五舰位：主力1→输出位(第2格=极焰)、主力2→坦位(首格=磐石)、
 *  其余按序补 3/4/5 位——对齐 genLineup"第二舰=主输出位装核"的中位摆位口径。 */
function arrangeMains(mains) {
  const m = mains.slice();
  return [m[1] ?? m[0], m[0], m[2] ?? m[0], m[3] ?? m[0], m[4] ?? m[0]];
}

async function run() {
  const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);
  const { mod, cleanup } = await loadEntry();
  try {
    const { pressure } = eco.calibratePressure();
    const service = new mod.S7BattleRunService();
    const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(mod.loadBundle()));
    const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13']; // 段三中位口径（贯日终版）

    const winAt = (nodeId, mains, coreId, tag) => {
      const { lineup, teamPower } = mod.genLineupFromMains({
        ships: MEDIAN, mains: arrangeMains(mains), coreId,
      });
      let wins = 0;
      for (let i = 0; i < SAMPLES; i += 1) {
        const r = service.run({
          runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] },
          runSeed: `climb-${tag}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH,
        });
        if (r.result.winner === 'player') wins += 1;
      }
      return { win: (wins / SAMPLES) * 100, teamPower };
    };

    console.log(`# 逐墙爬坡矩阵（samples=${SAMPLES}/点 · 阵容=当日真实养成态 · 经济尺在内存重算）`);
    console.log(`压力值@墙：${WALLS.map((w) => `n${w}=${pressure[w]}`).join(' ')}`);
    for (const tier of TIERS) {
      const r = eco.simulateEconomyTier(tier, pressure, { envelope: 'expected', runFullDays: true });
      console.log(`\n## ${tier}（毕业 D${r.graduateDay}）`);
      for (const w of WALLS) {
        let cum = 0; let arrive = null; let brk = null;
        for (let d = 0; d < r.dailyCleared.length; d++) {
          const before = cum;
          cum += r.dailyCleared[d];
          if (arrive === null && cum >= w - 1) arrive = d + 1;
          if (before < w && cum >= w) { brk = d + 1; break; }
        }
        if (arrive === null || brk === null) { console.log(`n${w}: 窗口未达（毕业前未到墙）`); continue; }
        const stuck = r.wallWait[w] ?? 0;
        const nodeId = `n${String(w).padStart(3, '0')}`;
        const cells = [];
        for (let d = Math.min(arrive + 1, brk); d <= brk + 2; d++) {
          const mains = r.dailyMains[d - 1];
          const open = r.dailyOpenPower[d - 1];
          if (!mains || !open) break;
          const alias = d < brk ? (d === brk - 1 ? '偷鸡' : '卡墙') : d === brk ? '破墙' : d === brk + 1 ? '+1日' : '+2日';
          const coreId = mains.some(([t]) => t === 'S' || t === 'SS') ? 'core08' : undefined;
          const { win, teamPower } = winAt(nodeId, mains, coreId, `${tier}-${w}-d${d}`);
          const band = bandOf(alias);
          const mark = band ? (win >= band[0] && win <= band[1] ? '✓' : '✗') : '';
          cells.push(`D${d}${alias} ${(teamPower / pressure[w] * 100).toFixed(0)}% ${win.toFixed(0)}%${mark}`);
        }
        console.log(`n${w}（卡${stuck}天）: ${cells.join(' | ')}`);
      }
    }
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-wall-climb] 失败：', e); process.exitCode = 1; });
