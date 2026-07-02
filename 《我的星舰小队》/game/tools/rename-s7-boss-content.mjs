// 配合 150 关拓扑改造：把原 n018/n075 真实设计的Boss战斗内容(战斗单位/遭遇/阶段/刷怪/压力)
// 原样搬到新Boss位（内容不改，只挪ID）——按主题对齐：原n018是"SF01 护盾Boss"，
// 新拓扑里"护盾"主题独立成SF02(n084)，故n018→n084（不是n060，n060是新SF01/swarm主题，无对应真实内容）；
// 原n075是"终Boss 狂暴主轴"，新拓扑终Boss仍是n150(SF06/berserk)，主题对齐，n075→n150。
// n037/n056无原始战斗数据；SF01/03/04/05(n060/102/120/138)暂无战斗内容，留阶段2c批量生产，不在本脚本臆造。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

function renameInFile(name) {
  const p = path.join(DIR, `${name}.sample.json`);
  let text = readFileSync(p, 'utf-8');
  text = text.replaceAll('n075', 'n150').replaceAll('n018', 'n084');
  writeFileSync(p, text, 'utf-8');
}
for (const f of ['battle_unit_stat_param', 'battle_encounter_param', 'battle_boss_phase_param', 'battle_spawn_param']) {
  renameInFile(f);
}

// pressure_param：重命名2个真实Boss压力行 + 补齐 sf05/06 的 np/ep 行 + 4个新Boss压力行占位。
const ppPath = path.join(DIR, 'pressure_param.sample.json');
const pp = JSON.parse(readFileSync(ppPath, 'utf-8'));
for (const row of pp) {
  if (row.rowId === 'bp_n018') { row.rowId = 'bp_n084'; row.refKey = 'n084'; row.note = 'SF02 护盾Boss 主模板 T04（原n018搬迁，主题对齐SF02护盾），后续数值校准阶段重定'; }
  if (row.rowId === 'bp_n075') { row.rowId = 'bp_n150'; row.refKey = 'n150'; row.note = 'SF06 终Boss 主模板 T10（原n075搬迁），上限暂沿用14500，后续数值校准阶段重定'; }
}
// 新增行清单（先滤掉上次运行留下的旧副本，保证脚本可重复执行/幂等）
const NEW_PRESSURE_IDS = new Set(['np_sf05', 'ep_sf05', 'np_sf06', 'ep_sf06', 'bp_n060', 'bp_n102', 'bp_n120', 'bp_n138']);
const ppFiltered = pp.filter((r) => !NEW_PRESSURE_IDS.has(r.rowId));
ppFiltered.push(
  { schemaVersion: 's7-0.1.0', rowId: 'np_sf05', scope: 'normal', refKey: 'sf05', pressureMin: 4000, pressureMax: 8000, note: 'SF05 主模板 T07/T08 占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'ep_sf05', scope: 'elite', refKey: 'sf05', pressureMin: 6000, pressureMax: 9500, secondaryPressureCap: 1, note: 'SF05 精英占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'np_sf06', scope: 'normal', refKey: 'sf06', pressureMin: 8000, pressureMax: 12500, note: 'SF06 终域混合前域模板占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'ep_sf06', scope: 'elite', refKey: 'sf06', pressureMin: 10500, pressureMax: 13500, secondaryPressureCap: 1, note: 'SF06 精英占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'bp_n060', scope: 'boss', refKey: 'n060', pressureRecommend: 1500, pressureMin: 1300, pressureMax: 1800, note: 'SF01 群怪Boss占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'bp_n102', scope: 'boss', refKey: 'n102', pressureRecommend: 5200, pressureMin: 4600, pressureMax: 6000, note: 'SF03 后排Boss占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'bp_n120', scope: 'boss', refKey: 'n120', pressureRecommend: 7500, pressureMin: 6800, pressureMax: 8500, note: 'SF04 召唤Boss占位区间，精确值留数值校准阶段' },
  { schemaVersion: 's7-0.1.0', rowId: 'bp_n138', scope: 'boss', refKey: 'n138', pressureRecommend: 10200, pressureMin: 9400, pressureMax: 11200, note: 'SF05 爆发Boss占位区间，精确值留数值校准阶段' },
);
writeFileSync(ppPath, JSON.stringify(ppFiltered, null, 2) + '\n', 'utf-8');

// building_anchor_impact_check：n075/no_ad_75_pass_check 引用改到终Boss n150/no_ad_boss6_check
const baPath = path.join(DIR, 'building_anchor_impact_check.sample.json');
const ba = JSON.parse(readFileSync(baPath, 'utf-8'));
for (const row of ba) {
  if (row.checkId === 'building_anchor_d28_n075_pass') {
    row.checkId = 'building_anchor_final_boss_pass';
    row.noAdCheckTag = 'no_ad_boss6_check';
  }
}
writeFileSync(baPath, JSON.stringify(ba, null, 2) + '\n', 'utf-8');

// refund_param：保护期描述标签 n001_n037 → n001_n017（拓扑改造后转折点前移）
const rfPath = path.join(DIR, 'refund_param.sample.json');
let rf = JSON.parse(readFileSync(rfPath, 'utf-8'));
for (const row of rf) {
  if (row.periodTag === 'protection_n001_n037') row.periodTag = 'protection_n001_n017';
}
writeFileSync(rfPath, JSON.stringify(rf, null, 2) + '\n', 'utf-8');

console.log('boss content 搬迁 + pressure_param补齐 + 零散引用修正 完成');
