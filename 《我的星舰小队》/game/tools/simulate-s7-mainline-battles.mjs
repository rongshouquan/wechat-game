#!/usr/bin/env node
// ⑥第二段·战斗侧第二把尺子 CLI 壳：用 esbuild 把 TS 入口（s7-battles-entry.mts·引擎+组装器真链路）
// 即时打包到临时文件后驱动。本工程 .mjs 跑不了 TS（既定形状·推演验解器为此放 vitest）——
// esbuild 为 vitest 既有传递依赖的显式化（报备已批），打包仅发生在工具运行时、不动引擎不进游戏包。
//
// 用法：
//   node tools/simulate-s7-mainline-battles.mjs                     # 中位族全扫 148 关（3 种子）
//   node tools/simulate-s7-mainline-battles.mjs --lineup counter    # 克制向族
//   node tools/simulate-s7-mainline-battles.mjs --lineup misfit --samples 5 --from 60 --to 90
//   node tools/simulate-s7-mainline-battles.mjs --power-ratio 1.8   # 碾压实验（阵容战力=P×1.8）
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-battles-'));
  const outfile = path.join(tmp, 'entry.mjs');
  try {
    await build({
      entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      outfile,
      logLevel: 'silent',
    });
    process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
    const mod = await import(pathToFileURL(outfile).href);
    const code = await mod.main(process.argv.slice(2));
    process.exitCode = code;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

run().catch((e) => {
  console.error('[simulate-s7-mainline-battles] 失败：', e);
  process.exitCode = 1;
});
