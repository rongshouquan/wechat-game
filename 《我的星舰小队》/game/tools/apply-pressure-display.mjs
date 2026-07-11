#!/usr/bin/env node
// 对锚与阶梯批 · 显示推荐值重标（Ron 07-10 拍板⑦"显示推荐=真实需求"·幂等重生成）。
// 重写 pressure_param.sample.json：
//   ① 普通/精英逐节点行（np_nXXX/ep_nXXX·min=max=校准压力值）——战前界面取中公式直接吐真值；
//   ② 星域带行保留并按新压力表重写（回退路径+战场页概览带）；
//   ③ Boss 行 recommend=压力值·带=±10% 显示；template_modifier 行原样保留。
// 压力来源＝经济尺在内存重算（与敌配落数同源·simulate-s7-economy.mjs calibratePressure）。
// 幂等：全表按 rowId 重建，重复跑逐字节一致。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7', 'pressure_param.sample.json');
const MAINLINE = path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7', 'mainline_node_config.sample.json');

const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);
const { pressure } = eco.calibratePressure();
const nodes = JSON.parse(readFileSync(MAINLINE, 'utf-8'));
const old = JSON.parse(readFileSync(FILE, 'utf-8'));

const keep = old.filter((r) => r.scope === 'template_modifier');
const out = [];
const sfSpans = new Map(); // sf → {normal: [nums], elite: [nums]}
for (const n of nodes) {
  const num = Number(n.nodeId.slice(1));
  const scope = n.nodeTypeTag === 'boss' || n.nodeTypeTag === 'story_boss' ? 'boss'
    : n.nodeTypeTag === 'elite' ? 'elite' : 'normal';
  if (scope === 'boss') {
    const p = pressure[num];
    out.push({
      schemaVersion: 's7-0.1.0', rowId: `bp_${n.nodeId}`, scope: 'boss', refKey: n.nodeId,
      pressureRecommend: p, pressureMin: Math.round(p * 0.9), pressureMax: Math.round(p * 1.1),
      note: `对锚批 v0.8 重标·推荐=校准压力真值（±10% 显示带）`,
    });
  } else {
    const s = sfSpans.get(n.starfieldId) ?? { normal: [], elite: [] };
    s[scope].push(num);
    sfSpans.set(n.starfieldId, s);
    out.push({
      schemaVersion: 's7-0.1.0', rowId: `${scope === 'elite' ? 'ep' : 'np'}_${n.nodeId}`, scope, refKey: n.nodeId,
      pressureMin: pressure[num], pressureMax: pressure[num],
      note: `对锚批 v0.8 逐节点重标（显示推荐=真实需求·min=max=压力真值）`,
    });
  }
}
// 星域带行（回退+概览）：带=该星域该 scope 节点压力的 [min,max]
for (const [sf, s] of sfSpans) {
  for (const scope of ['normal', 'elite']) {
    const nums = s[scope];
    if (!nums.length) continue;
    const vals = nums.map((n) => pressure[n]);
    out.push({
      schemaVersion: 's7-0.1.0', rowId: `${scope === 'elite' ? 'ep' : 'np'}_${sf}`, scope, refKey: sf,
      pressureMin: Math.min(...vals), pressureMax: Math.max(...vals),
      note: `对锚批 v0.8 星域带重写（回退路径·逐节点行为主）`,
    });
  }
}
const rows = [...out, ...keep];
writeFileSync(FILE, JSON.stringify(rows, null, 1) + '\n');
console.log(`[pressure-display] 写盘 ${rows.length} 行（逐节点 ${out.filter((r) => r.refKey.startsWith('n')).length} + 星域带 ${out.filter((r) => !r.refKey.startsWith('n')).length} + modifier ${keep.length}）`);
