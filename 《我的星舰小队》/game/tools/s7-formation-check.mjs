#!/usr/bin/env node
// 段2 C 项 · 摆阵美感规格对称性自查（只读报告工具·验收件——Ron 规格三条的机器可查面）。
// 坐标契约（B0.7/引擎实读）：row=屏幕横向（r0-r4·对称轴 r2）、col=纵深（c0 贴中线）。
// 检查项：①每波每层（同 col）row 集关于 r2 镜像对称（Boss 2×2 锚=偶宽件·0.5 格偏轴属"基本
//   对称"容差，按实占 4 格整体报告不计红）②5 连横（[0..4] 全占一层）=死板告警③教学段 n001-n008
//   保留面豁免。用法：
//   node tools/s7-formation-check.mjs              # 全表扫描（退出码 0=全过）
//   node tools/s7-formation-check.mjs --draw n104  # 单关阵型字符画（抽关呈 Ron 用）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const argv = process.argv.slice(2);
const drawIdx = argv.indexOf('--draw');
const DRAW = drawIdx >= 0 ? argv[drawIdx + 1] : null;

const spawns = JSON.parse(readFileSync(path.join(DIR, 'battle_spawn_param.sample.json'), 'utf-8'));
const units = JSON.parse(readFileSync(path.join(DIR, 'battle_unit_stat_param.sample.json'), 'utf-8'));
const unitById = new Map(units.map((r) => [r.rowId, r]));

function cellsOf(spawn) {
  return spawn.slotRefs.map((ref) => {
    const m = ref.match(/^r(\d)c(\d)$/);
    return { row: Number(m[1]), col: Number(m[2]) };
  });
}

/** Boss 2×2 实占格展开（对称性按实占整体评）。 */
function occupiedCells(spawn) {
  const stat = unitById.get(spawn.unitStatRef);
  const sr = stat?.sizeRows ?? 1;
  const sc = stat?.sizeCols ?? 1;
  const out = [];
  for (const c of cellsOf(spawn)) {
    for (let dr = 0; dr < sr; dr += 1) for (let dc = 0; dc < sc; dc += 1) out.push({ row: c.row + dr, col: c.col + dc });
  }
  return out;
}

if (DRAW) {
  const ss = spawns.filter((s) => s.encounterRef === `enc_${DRAW}`);
  if (!ss.length) { console.error(`无 enc_${DRAW}`); process.exit(1); }
  const grid = Array.from({ length: 7 }, () => Array(5).fill('·'));
  for (const s of ss) {
    const isBoss = /^bu_boss_/.test(s.unitStatRef);
    for (const c of occupiedCells(s)) {
      if (grid[c.col]) grid[c.col][c.row] = isBoss ? 'B' : String(s.waveIndex);
    }
  }
  console.log(`=== ${DRAW} 阵型（下=贴中线 c0·左右=横向 r0-r4·B=Boss 实占·数字=波序）===`);
  for (let c = 6; c >= 0; c -= 1) console.log(`c${c}  ${grid[c].join(' ')}`);
  process.exit(0);
}

// 段3 口径升级：对称按「整关合成画面」查（同关全波合并后逐层镜像）——美感规格的对象=玩家看到的
// 全阵，跨波镜像互补（如双词缀源各一波·r1/r3 对开）合成后对称即合规；旧"逐波查"对合并对称阵误报。
let waves = 0;
const asym = [];
let fullRows = 0;
const byEnc = new Map();
for (const s of spawns) {
  if (/^spawn_n00[1-8]_/.test(s.rowId)) continue; // 教学段保留面豁免
  waves += 1;
  if (!byEnc.has(s.encounterRef)) byEnc.set(s.encounterRef, []);
  byEnc.get(s.encounterRef).push(s);
}
for (const [encId, ss] of byEnc) {
  const byCol = new Map(); // col → {rows:Set, bossRows:Set}
  for (const s of ss) {
    const isBoss = /^bu_boss_/.test(s.unitStatRef);
    for (const c of (isBoss ? occupiedCells(s) : cellsOf(s))) {
      if (!byCol.has(c.col)) byCol.set(c.col, { rows: new Set(), bossRows: new Set() });
      byCol.get(c.col).rows.add(c.row);
      if (isBoss) byCol.get(c.col).bossRows.add(c.row);
    }
  }
  for (const [col, { rows, bossRows }] of byCol) {
    if (rows.size === 5) fullRows += 1;
    // Boss 2×2 偶宽件=0.5 格偏轴容差（"基本对称"规格原文）：该层剔除 Boss 实占后查小兵对称。
    const minions = [...rows].filter((r) => !bossRows.has(r));
    const sym = minions.every((r) => minions.includes(4 - r));
    if (!sym) asym.push(`${encId} c${col}=[${minions.sort().join(',')}]`);
  }
}
console.log(`[formation-check] 非教学波 ${waves}（按关合成查对称）：不对称 ${asym.length} · 5连横层 ${fullRows}`);
if (asym.length) {
  for (const a of asym.slice(0, 10)) console.log('  ✗ ' + a);
}
process.exitCode = asym.length > 0 || fullRows > 0 ? 1 : 0;
