#!/usr/bin/env node
// 悬赏时间线（定价重锚批·拍板5 重写：基底=recNodes 锚点法）。
// 问题：按正常养成节奏，各档玩家"第几天过得了/碾得动"新手(n010)/普通(n055)/困难(n098)/噩梦(n130)？
// 旧→新→为什么对：旧版复刻灰盒基底（已通关最高星域首节点×倍率+威胁位 B7 复刻）——该规则已随
// 拍板5 退役；新版=直接打四锚点的原生落地敌阵（=真机 bountyBattleNodeId 现状·威胁位层不在
// 运行时里，不建模不存在的东西；灰盒批若加威胁位变体再回补）。
// 口径（总控 07-10 回执沿用）：
//   碾得动 = 单把胜率 ≥95%（samples≥20）且平均时长 ≤18s（碾压门槛=手感靶 1.8× 口径）；
//   能过线 = 单把胜率 ≥20%（Ron 拍定·墙口径章同源）；
//   玩家 = 经济尺当日真实养成态（dailyMains·同爬坡矩阵口径）；
//   验收两条（任务单B件）：① D2 打噩梦锚点应≈0%（"D2 白拿 2.2×"已死）；
//   ② 四档"首碾日"落经济尺节奏注释带内（普通档 D1 碾新手→D8-9 碾普通→D24-26 碾困难→D38-40 碾噩梦收菜）。
// 用法：node tools/s7-bounty-timeline.mjs [--samples N] [--tier 普通]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const SAMPLES = Number(argStr('samples', '20'));
const TIERS = argStr('tier', '肝档,重度,普通,轻度').split(',');
const ANCHORS = [['新手', 'n010'], ['普通', 'n055'], ['困难', 'n098'], ['噩梦', 'n130']];

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-bounty-'));
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
  const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);
  const { mod, cleanup } = await loadEntry();
  try {
    const { pressure } = eco.calibratePressure();
    const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
    const service = new mod.S7BattleRunService();
    // 锚点敌阵=落地态原样（真机同款）：整个时间线共用一个 runtime。
    const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(mod.loadBundle()));

    const measure = (mains, nodeId, tag) => {
      const m = mains.slice();
      const arranged = [m[1] ?? m[0], m[0], m[2] ?? m[0], m[3] ?? m[0], m[4] ?? m[0]];
      const coreId = arranged.some(([t]) => t === 3 || t === 4 || t === 'S' || t === 'SS') ? 'core08' : undefined;
      const { lineup } = mod.genLineupFromMains({ ships: MEDIAN, mains: arranged, coreId });
      let wins = 0; let dur = 0;
      for (let i = 0; i < SAMPLES; i += 1) {
        const r = service.run({ runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] }, runSeed: `bt-${tag}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH });
        if (r.result.winner === 'player') wins += 1;
        dur += r.result.durationSec;
      }
      return { win: (wins / SAMPLES) * 100, dur: dur / SAMPLES };
    };

    console.log(`# 悬赏时间线·锚点法（samples=${SAMPLES}·碾=≥95%且≤18s·过线=≥20%·玩家=当日真实养成态）`);
    console.log(`锚点压力：${ANCHORS.map(([n, id]) => `${n}=${id}(${pressure[Number(id.slice(1))]})`).join(' ')}`);
    for (const tier of TIERS) {
      const r = eco.simulateEconomyTier(tier, pressure, { envelope: 'expected', runFullDays: true });
      const grad = r.graduateDay ?? r.dailyCleared.length;
      console.log(`\n## ${tier}（毕业 D${grad}）`);
      for (const [label, nodeId] of ANCHORS) {
        let firstPass = null; let firstCrush = null; let d2 = null;
        for (let d = 1; d <= grad; d += 1) {
          if (d > 2 && d % 2 !== 0) continue; // D1/D2 逐日（白拿验证）·之后隔日采样
          const mains = r.dailyMains[d - 1];
          if (!mains) continue;
          const m = measure(mains, nodeId, `${tier}-${label}-${d}`);
          if (d === 2) d2 = m;
          if (firstPass === null && m.win >= 20) firstPass = `D${d}（${m.win.toFixed(0)}%）`;
          if (m.win >= 95 && m.dur <= 18) { firstCrush = `D${d}（${m.win.toFixed(0)}%/${m.dur.toFixed(1)}s）`; break; }
        }
        const d2txt = d2 ? ` ｜ D2实测 ${d2.win.toFixed(0)}%` : '';
        console.log(`${label}@${nodeId}: 首过线 ${firstPass ?? '毕业前未达'} ｜ 首碾 ${firstCrush ?? '毕业前未达'}${d2txt}`);
      }
    }
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-bounty-timeline] 失败：', e); process.exitCode = 1; });
