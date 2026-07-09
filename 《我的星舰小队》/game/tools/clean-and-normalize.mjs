#!/usr/bin/env node
// ⑩A0 · 落数两步之一「清节点行回净土」（§20.1 成文规则的入库版·⑥当次脚本用完即删的补账）。
// 正常重落不必单独跑本脚本——apply-enemy-landing.mjs 内部先清后落（半截重落=174 垃圾行事故的根治）。
// 本脚本用于排查/换压力表前观察净土态。
//
// 用法：
//   node tools/clean-and-normalize.mjs           # 清并写盘（写前打印统计）
//   node tools/clean-and-normalize.mjs --dry     # 只打印统计不写盘
//   node tools/clean-and-normalize.mjs --dir <configs目录>   # 对指定目录副本操作（测试用）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTables, writeTables, cleanBundle } from './enemy-landing-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dirIdx = argv.indexOf('--dir');
const DIR = dirIdx >= 0 && argv[dirIdx + 1]
  ? path.resolve(argv[dirIdx + 1])
  : path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const DRY = argv.includes('--dry');

const tables = loadTables(DIR);
const stat = cleanBundle(tables);
console.log(`[clean] 删节点敌行 ${stat.unitRemoved} · 删节点召唤效果 ${stat.effectRemoved} · 归一 spawn 引用 ${stat.spawnRefs} · 归一 phase 召唤引用 ${stat.phaseRefs}`);
if (DRY) {
  console.log('[clean] --dry：不写盘');
} else {
  const written = writeTables(DIR, tables);
  console.log(`[clean] 写盘：${written.length ? written.join(', ') : '（无变化）'}`);
}
