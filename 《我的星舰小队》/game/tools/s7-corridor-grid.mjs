#!/usr/bin/env node
// 对锚与阶梯批 · 回廊层×战力栅格（批③报备2 提及的可复跑 dev 栅格工具·入库版）。
// 用途：①验收"层前沿贴 req(L)=420×1.075^(L-1) 曲线"（K 合同+φ 全链缩放后普通/戏法层前沿
//        ≈×0.5-0.8=主线普通关行为、回响层前沿 ≈×1.2 贴尺子尖峰 1.25）；
//      ②回响/戏法层抽查（×1.25 尖峰·闪电战公平化）；③层强度改动后的回归复跑。
// 用法：node tools/s7-corridor-grid.mjs [--layers 1,5,10,25,40,60] [--samples N] [--ratios 0.8,1.0,1.2]
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const SAMPLES = Number(argStr('samples', '10'));
const LAYERS = argStr('layers', '1,5,10,20,25,40,60,80').split(',').map(Number);
const RATIOS = argStr('ratios', '0.6,0.8,1.0,1.2,1.5').split(',').map(Number);

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-cgrid-'));
  const outfile = path.join(tmp, 'entry.mjs');
  // 打包一个复合入口：battles-entry（阵容生成）+ 回廊服务（运行时件）
  const src = `
export * from '${path.join(HERE, 's7-battles-entry.ts').replace(/\\/g, '/')}';
export { corridorLayerPlan, corridorPaletteFrom, corridorBossNodeIds, corridorLayerReq } from '${path.join(HERE, '..', 'assets', 'scripts', 'core', 's7', 'S7DeepCorridor.ts').replace(/\\/g, '/')}';
export { runCorridorBattle } from '${path.join(HERE, '..', 'assets', 'scripts', 'core', 's7', 'S7CorridorBattleService.ts').replace(/\\/g, '/')}';
`;
  const entryFile = path.join(tmp, 'grid-entry.ts');
  writeFileSync(entryFile, src);
  await build({
    entryPoints: [entryFile],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

async function run() {
  const { mod, cleanup } = await loadEntry();
  try {
    const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(mod.loadBundle()));
    const rows = runtime.getAll('battle_unit_stat_param');
    const palette = mod.corridorPaletteFrom(rows);
    const bossIds = mod.corridorBossNodeIds(runtime.getAll('mainline_node_config'));
    const bossP = {};
    for (const r of runtime.getAll('pressure_param')) {
      if (r.scope === 'boss' && typeof r.pressureRecommend === 'number') bossP[r.refKey] = r.pressureRecommend;
    }
    console.log(`# 回廊栅格（palette=${palette.length} 基础行·samples=${SAMPLES}·K合同φ全链版）`);
    console.log(`层 | req(L) | ${RATIOS.map((r) => `×${r}`).join(' | ')} | 隐含P0(50%前沿粗估)`);
    for (const L of LAYERS) {
      const plan = mod.corridorLayerPlan(L, palette, bossIds, bossP);
      const req = Math.round(mod.corridorLayerReq(L));
      const cells = [];
      let frontier = null;
      let prevWin = null;
      for (const ratio of RATIOS) {
        const power = req * ratio;
        const lineup = mod.genLineupCustom({
          ships: ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'], targetTeamPower: power,
          coreMap: { shp01: 'core08' },
        }).lineup;
        let wins = 0;
        for (let i = 0; i < SAMPLES; i += 1) {
          const r = mod.runCorridorBattle({ runtime, plan, lineup, runSeed: `cgrid-${L}-${ratio}-${i}` });
          if (r.result.winner === 'player') wins += 1;
        }
        const win = (wins / SAMPLES) * 100;
        if (prevWin !== null && prevWin < 50 && win >= 50 && frontier === null) frontier = ratio;
        prevWin = win;
        cells.push(`${win.toFixed(0)}%`);
      }
      const tag = plan.echoBoss ? `回响${plan.echoBoss.bossNodeId}(×${plan.echoBoss.mult})` : plan.trickId ? `戏法${plan.trickId}` : '普通';
      console.log(`L${String(L).padEnd(3)} ${tag.padEnd(14)} | ${req} | ${cells.join(' | ')} | ${frontier ? `≈req×${frontier}` : '-'}`);
    }
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-corridor-grid] 失败：', e); process.exitCode = 1; });
