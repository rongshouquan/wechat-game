#!/usr/bin/env node
// 定价重锚批 D 件 · 双钥匙到手率蒙特卡洛（拍板7：人＋舰全算·按真实轮换/保底规则·新到达日重算）。
// 钥匙四件 = 岩 pil05 + 砺 pil06（招募池·护卫类别 1/3 天开放）+ 磐石 shp05 + 铁壁 shp06（整备池·磐铁派系 1/3 天开放）。
// 驱动真机 S7GachaService.drawGachaOnce（真轮换/20 抽真概率保底/碎片 30 合成/重复折 15——零复刻）；
// 抽数节奏 = 经济尺观察口 dailyGachaPulls（船/人对半=经济模型同款）；补给站垫层按 dailySupplyLv 真值；
// 轮换相位按玩家随机（开服日相位均匀 0-2——不同玩家撞到的开放日不同）。
// 输出：各档 到 正解破墙日/+3/+7/钞门日 的四钥齐率 + 仅人两钥齐率（对照旧 74% 备档口径）+
//        缺钥人群"补齐还差几天"分布（痛感原料·上限=钞门天数表的 SS 门）。
// 用法：node tools/s7-key-mc.mjs [--players N]
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argNum = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : d; };
const PLAYERS = argNum('players', 4000);

const tmp = mkdtempSync(path.join(tmpdir(), 'keymc-'));
const src = path.join(tmp, 'x.ts');
const p = (rel) => path.join(HERE, rel).replace(/\\/g, '/');
writeFileSync(src, [
  `export { drawGachaOnce, refreshGachaToDay } from '${p('../assets/scripts/core/s7/S7GachaService.ts')}';`,
  `export { DEFAULT_S7_GACHA_CONFIG } from '${p('../assets/scripts/core/s7/S7GachaConfig.ts')}';`,
  `export { createDefaultS7GachaState } from '${p('../assets/scripts/core/s7/S7GachaState.ts')}';`,
  `export { createDefaultS7Squad, grantShip, grantPilot, isShipOwned, isPilotOwned } from '${p('../assets/scripts/core/s7/S7Squad.ts')}';`,
  `export { createDefaultS7UnitTierState } from '${p('../assets/scripts/core/s7/S7UnitTierState.ts')}';`,
  `export { createDefaultS7ExclusiveShardInventory, getExclusiveShardCount } from '${p('../assets/scripts/core/s7/S7ExclusiveShardInventory.ts')}';`,
  `export { S7AutoBattleRng } from '${p('../assets/scripts/core/s7/S7AutoBattleRng.ts')}';`,
].join('\n'));
const outfile = path.join(tmp, 'e.mjs');
await build({ entryPoints: [src], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent' });
const mod = await import(pathToFileURL(outfile).href);
const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);

const KEY_SHIPS = ['shp05', 'shp06'];
const KEY_PILOTS = ['pil05', 'pil06'];
const SYNTH = eco.TRUTHS.synthesizeBodyShards; // 30 碎合成本体（到手三径之一）

const { pressure } = eco.calibratePressure();
console.log(`# 双钥匙到手率蒙特卡洛（players=${PLAYERS}/档·真机三池规则·抽数=经济尺节奏·船人对半）`);
for (const tier of ['肝档', '重度', '普通', '轻度']) {
  const r = eco.simulateEconomyTier(tier, pressure, { envelope: 'expected', runFullDays: true });
  let cum = 0; const cums = [];
  for (let d = 0; d < r.dailyCleared.length; d++) { cum += r.dailyCleared[d]; cums.push(cum); }
  const brk = cums.findIndex((c) => c >= 102) + 1; // 正解破墙日
  const pulls = r.dailyGachaPulls;
  const supply = r.dailySupplyLv;
  const days = pulls.length;

  const keyDay = []; // 每玩家：四钥齐日（未齐=Infinity）
  const pilotPairDay = [];
  for (let pl = 0; pl < PLAYERS; pl++) {
    const rng = new mod.S7AutoBattleRng(`keymc-${tier}-${pl}`);
    const phase = rng.nextInt(3); // 轮换相位（开服相位均匀）
    const state = mod.createDefaultS7GachaState();
    const squad = mod.createDefaultS7Squad();
    mod.grantShip(squad, 'shp01'); mod.grantPilot(squad, 'pil01'); // 起手
    const tiers = mod.createDefaultS7UnitTierState();
    const shards = mod.createDefaultS7ExclusiveShardInventory();
    let shipCarry = 0; let pilotCarry = 0;
    let kd = Infinity; let pd = Infinity;
    const ownedKey = (id) => (id.startsWith('shp')
      ? (mod.isShipOwned(squad, id) || mod.getExclusiveShardCount(shards, id) >= SYNTH)
      : (mod.isPilotOwned(squad, id) || mod.getExclusiveShardCount(shards, id) >= SYNTH));
    for (let d = 1; d <= days; d++) {
      const total = pulls[d - 1] ?? 0;
      shipCarry += total / 2; pilotCarry += total / 2;
      const sp = Math.floor(shipCarry); shipCarry -= sp;
      const pp = Math.floor(pilotCarry); pilotCarry -= pp;
      const lv = supply[d - 1] ?? 0;
      for (let i = 0; i < sp; i++) mod.drawGachaOnce(state, squad, tiers, shards, mod.DEFAULT_S7_GACHA_CONFIG, rng, 'refit', d + phase, lv);
      for (let i = 0; i < pp; i++) mod.drawGachaOnce(state, squad, tiers, shards, mod.DEFAULT_S7_GACHA_CONFIG, rng, 'recruit', d + phase, lv);
      if (pd === Infinity && KEY_PILOTS.every(ownedKey)) pd = d;
      if (kd === Infinity && KEY_PILOTS.every(ownedKey) && KEY_SHIPS.every(ownedKey)) { kd = d; }
      if (kd !== Infinity && d >= brk + 14) break;
    }
    keyDay.push(kd); pilotPairDay.push(pd);
  }
  const pct = (arr, day) => ((arr.filter((v) => v <= day).length / arr.length) * 100).toFixed(1);
  const missAt = keyDay.filter((v) => v > brk);
  const lateDist = {};
  for (const v of missAt) {
    const late = v === Infinity ? '>14' : String(Math.min(14, v - brk));
    lateDist[late] = (lateDist[late] ?? 0) + 1;
  }
  const distTxt = Object.entries(lateDist).sort((a, b) => (a[0] === '>14' ? 1 : b[0] === '>14' ? -1 : Number(a[0]) - Number(b[0])))
    .map(([k, v]) => `+${k}天:${((v / PLAYERS) * 100).toFixed(1)}%`).join(' ');
  console.log(`\n## ${tier}（正解破墙 D${brk}·日均抽 ${(pulls.reduce((a, b) => a + b, 0) / days).toFixed(1)}）`);
  console.log(`四钥齐率：破墙日 ${pct(keyDay, brk)}% ｜ +3天 ${pct(keyDay, brk + 3)}% ｜ +7天 ${pct(keyDay, brk + 7)}%`);
  console.log(`仅人两钥（旧备档口径）：破墙日 ${pct(pilotPairDay, brk)}% ｜ D25 ${pct(pilotPairDay, 25)}%`);
  console.log(`破墙日缺钥人群占比 ${(100 - Number(pct(keyDay, brk))).toFixed(1)}%·其补齐还差天数分布：${distTxt || '（无）'}`);
}
rmSync(tmp, { recursive: true, force: true });
