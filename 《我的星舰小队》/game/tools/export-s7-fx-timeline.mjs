#!/usr/bin/env node
// 战斗演出线 · 时间轴导出 CLI 壳：esbuild 即时打包 TS 入口（s7-fx-timeline-entry.ts·
// 组装器+引擎+回放+演出指令流真链路）后驱动——模式照 simulate-s7-mainline-battles.mjs。
//
// 用法：
//   node tools/export-s7-fx-timeline.mjs                    # n020 · 默认种子
//   node tools/export-s7-fx-timeline.mjs --node n030 --seed fx-2
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-fx-'));
  const outfile = path.join(tmp, 'entry.mjs');
  try {
    await build({
      entryPoints: [path.join(HERE, 's7-fx-timeline-entry.ts')],
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
  console.error('[export-s7-fx-timeline] 失败：', e);
  process.exitCode = 1;
});
