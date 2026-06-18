// S7-GAMEPLAY-04 / CC-06A 逐级精算与模拟校验工具。
// 成长段值来源：S7-GAMEPLAY-03-04-数值与经济配置总表-v0.2-草案.md §2-§9（冻结基线，本工具不修改其数值）。
// 只读 assets/resources/configs/s7 下既有 38 张配置表，不新增/修改配置表，不做运行时接入。
// 用途：把 §3.2-3.5 的"段值"按等级/阶段线性展开，并用 §4.1-4.3/§8/§9 的口径模拟 D7/D14/D21/D28、
// no-ad 路径、N075 压力上限与 70 回退影响，结果以非零退出码阻断。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

function load(name) {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, `${name}.sample.json`), 'utf-8'));
}

const RESOURCE_KEYS = ['starOre', 'hullAlloy', 'battleLog', 'shipBlueprint', 'pilotToken', 'pluginMat', 'coreMat', 'coreFrag', 'fullCore', 'supplyTicket', 'beacon', 'starCargo'];

function zeroResources() {
  const o = {};
  for (const k of RESOURCE_KEYS) o[k] = 0;
  return o;
}
function addResources(a, b, scale = 1) {
  const o = { ...a };
  for (const k of RESOURCE_KEYS) o[k] = (o[k] ?? 0) + (b[k] ?? 0) * scale;
  return o;
}
function divideResources(row, n) {
  const o = {};
  for (const k of RESOURCE_KEYS) o[k] = (row[k] ?? 0) / n;
  return o;
}
function scaleResources(r, n) {
  const o = {};
  for (const k of RESOURCE_KEYS) o[k] = (r[k] ?? 0) * n;
  return o;
}
function round2(v) { return Math.round(v * 100) / 100; }
function roundResources(r) {
  const o = {};
  for (const k of RESOURCE_KEYS) o[k] = round2(r[k]);
  return o;
}
function lerp(min, max, t) { return min + (max - min) * t; }
function piecewiseLerp(points, x) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return x < points[0][0] ? points[0][1] : points[points.length - 1][1];
}

// ---- 成长段值来源（CC-07E-1）：已迁移为 S7 配置表 growth_band_param（03-04 v0.2 §3.2-3.5 的唯一真源）。
// 本工具不再硬编码成长数组，改为从该表派生段 / 控制点；派生口径保持不变：
// band_linear（ship/pilot/plugin）段内线性插值；control_point（core）控制点分段线性。
function buildLinearBands(growthRows, targetType) {
  return growthRows
    .filter((r) => r.targetType === targetType && r.curveType === 'band_linear')
    .sort((a, b) => a.fromIndex - b.fromIndex)
    .map((r) => ({
      bandId: r.bandId,
      from: r.fromIndex,
      to: r.toIndex,
      domainFrom: r.interpFromIndex,
      powerMin: r.powerMin,
      powerMax: r.powerMax,
      secMin: r.secondaryMin,
      secMax: r.secondaryMax,
    }));
}
function buildControlPoints(growthRows, targetType) {
  const rows = growthRows
    .filter((r) => r.targetType === targetType && r.curveType === 'control_point')
    .sort((a, b) => a.fromIndex - b.fromIndex);
  return {
    powerPoints: rows.map((r) => [r.fromIndex, r.powerMin]),
    effectPoints: rows.map((r) => [r.fromIndex, r.secondaryMin]),
  };
}

// ---- 逐级 / 逐阶展开 ----
function expandShipLevels(upgradeCostRows, shipBands) {
  const out = [];
  for (const band of shipBands) {
    const costRow = upgradeCostRows.find((r) => r.targetType === 'ship' && r.bandId === band.bandId);
    const numLevels = band.to - band.from + 1;
    const perLevelCost = divideResources(costRow, numLevels);
    for (let level = band.from; level <= band.to; level++) {
      const t = (level - band.from) / (band.to - band.from);
      out.push({ level, bandId: band.bandId, shipPower: round2(lerp(band.powerMin, band.powerMax, t)), statIndex: round2(lerp(band.secMin, band.secMax, t)), levelCost: perLevelCost });
    }
  }
  return out;
}
function expandPilotLevels(upgradeCostRows, pilotBands) {
  const out = [];
  for (const band of pilotBands) {
    const costRow = upgradeCostRows.find((r) => r.targetType === 'pilot' && r.bandId === band.bandId);
    const numLevels = band.to - band.from + 1;
    const perLevelCost = divideResources(costRow, numLevels);
    for (let level = band.from; level <= band.to; level++) {
      const t = (level - band.from) / (band.to - band.from);
      out.push({ level, bandId: band.bandId, pilotPower: round2(lerp(band.powerMin, band.powerMax, t)), levelCost: perLevelCost });
    }
  }
  return out;
}
function expandCoreStages(enhanceCostRows, corePowerPoints, coreEffectPoints) {
  const find = (b) => enhanceCostRows.find((r) => r.targetType === 'core' && r.enhanceBand === b);
  const b12 = find('core_enhance_1_2');
  const b3 = find('core_enhance_3');
  const b45 = find('core_enhance_4_5');
  const out = [];
  for (let stage = 0; stage <= 5; stage++) {
    let stageCost = zeroResources();
    let bandId = null;
    if (stage === 1 || stage === 2) { stageCost = divideResources(b12, 2); bandId = 'core_enhance_1_2'; }
    else if (stage === 3) { stageCost = divideResources(b3, 1); bandId = 'core_enhance_3'; }
    else if (stage === 4 || stage === 5) { stageCost = divideResources(b45, 2); bandId = 'core_enhance_4_5'; }
    out.push({ stage, bandId, corePower: round2(piecewiseLerp(corePowerPoints, stage)), effectIndex: round2(piecewiseLerp(coreEffectPoints, stage)), stageCost: roundResources(stageCost) });
  }
  return out;
}
function expandPluginLevels(enhanceCostRows, pluginBands) {
  const out = [];
  for (const band of pluginBands) {
    const costRow = enhanceCostRows.find((r) => r.targetType === 'plugin' && r.enhanceBand === band.bandId);
    const numLevels = band.to - band.from + 1;
    const perLevelCost = divideResources(costRow, numLevels);
    const domainFrom = band.domainFrom;
    for (let level = band.from; level <= band.to; level++) {
      const t = (level - domainFrom) / (band.to - domainFrom);
      out.push({ level, bandId: band.bandId, pluginPower: round2(lerp(band.powerMin, band.powerMax, t)), affixIndex: round2(lerp(band.secMin, band.secMax, t)), levelCost: perLevelCost });
    }
  }
  return out;
}
function expandBuildingLevels(buildingConfigRows, effectRows) {
  const out = [];
  for (const b of buildingConfigRows) {
    for (let level = 1; level <= b.maxLevel; level++) {
      const levelBand = level === 1 ? 'lv1' : (level <= 5 ? 'lv2_5' : 'lv6_10');
      const effectRow = effectRows.find((r) => r.buildingId === b.buildingId && r.levelBand === levelBand);
      out.push({ buildingId: b.buildingId, level, levelBand, mainlineGateAllowed: effectRow?.mainlineGateAllowed ?? null, noAdGateAllowed: effectRow?.noAdGateAllowed ?? null });
    }
  }
  return out;
}
function cumulativeCost(levels, fromLevel, toLevel) {
  let total = zeroResources();
  for (const entry of levels) if (entry.level >= fromLevel && entry.level <= toLevel) total = addResources(total, entry.levelCost);
  return total;
}

// ---- 报告输出 ----
const errors = [];
const notes = [];
function check(section, label, ok, detail) {
  const line = `[${section}] ${label}: ${ok ? 'PASS' : 'FAIL'}${detail ? ` (${detail})` : ''}`;
  console.log(line);
  if (!ok) errors.push(line);
}
function info(section, label, detail) {
  console.log(`[${section}] ${label}${detail ? `: ${detail}` : ''}`);
}
function note(section, msg) {
  notes.push(`[${section}] ${msg}`);
  console.log(`[NOTE][${section}] ${msg}`);
}
function le(actual, limit) { return Object.fromEntries(RESOURCE_KEYS.map((k) => [k, (actual[k] ?? 0) <= (limit[k] ?? 0) + 1e-9])); }
function overBudget(actual, limit) {
  const over = [];
  for (const k of RESOURCE_KEYS) if ((actual[k] ?? 0) > (limit[k] ?? 0) + 1e-9) over.push(`${k} ${actual[k]}>${limit[k]}`);
  return over;
}

// ---- 加载配置 ----
const upgradeCostRows = load('upgrade_cost_param');
const enhanceCostRows = load('enhance_cost_param');
const growthRows = load('growth_band_param');
const freeResourceRows = load('free_resource_anchor_param');
const powerRefRows = load('power_reference_param');
const pressureRows = load('pressure_param');
const buildingConfigRows = load('building_config');
const buildingEffectRows = load('building_level_effect_param');
const mainlineRows = load('mainline_node_config');
const bossRows = load('boss_node_config');
const riskFallbackRows = load('risk_fallback_70_config');
const noAdCheckRows = load('no_ad_path_check_config');

// 从 growth_band_param 派生成长段 / 控制点（不再硬编码成长数组），作为参数注入 expand*。
const shipBands = buildLinearBands(growthRows, 'ship');
const pilotBands = buildLinearBands(growthRows, 'pilot');
const pluginBands = buildLinearBands(growthRows, 'plugin');
const corePoints = buildControlPoints(growthRows, 'core');

const shipLevels = expandShipLevels(upgradeCostRows, shipBands);
const pilotLevels = expandPilotLevels(upgradeCostRows, pilotBands);
const coreStages = expandCoreStages(enhanceCostRows, corePoints.powerPoints, corePoints.effectPoints);
const pluginLevels = expandPluginLevels(enhanceCostRows, pluginBands);
const buildingLevels = expandBuildingLevels(buildingConfigRows, buildingEffectRows);

const anchor = (day, band) => freeResourceRows.find((r) => r.anchorDay === day && r.band === band);

console.log('==== 1. 逐级 / 逐阶展开摘要 ====');
info('SHIP', '星舰 Lv1-40 行数', String(shipLevels.length));
info('SHIP', 'Lv1 / Lv10 / Lv20 / Lv30 / Lv40 ship_power', JSON.stringify([1, 10, 20, 30, 40].map((l) => shipLevels.find((r) => r.level === l).shipPower)));
info('PILOT', '驾驶员 Lv1-40 行数', String(pilotLevels.length));
info('PILOT', 'Lv1 / Lv10 / Lv20 / Lv30 / Lv40 pilot_power', JSON.stringify([1, 10, 20, 30, 40].map((l) => pilotLevels.find((r) => r.level === l).pilotPower)));
info('CORE', '星核阶段 0-5 行数', String(coreStages.length));
info('CORE', '各阶 core_power / effect_index', JSON.stringify(coreStages.map((r) => [r.stage, r.corePower, r.effectIndex])));
info('PLUGIN', '插件 +1 - +15 行数', String(pluginLevels.length));
info('PLUGIN', '+1 / +3 / +6 / +10 / +15 plugin_power', JSON.stringify([1, 3, 6, 10, 15].map((l) => pluginLevels.find((r) => r.level === l).pluginPower)));
info('BUILDING', '10 座建筑 x Lv1-10 行数', String(buildingLevels.length));

console.log('\n==== 2. 建筑 Lv2-10 非核心硬门槛校验 ====');
for (const b of buildingConfigRows) {
  check('BUILDING', `${b.buildingId} mainlineRequiredLevelCap===1 且 maxLevel===10`, b.mainlineRequiredLevelCap === 1 && b.maxLevel === 10);
}
const gatedRows = buildingLevels.filter((r) => r.levelBand !== 'lv1' && (r.mainlineGateAllowed !== false || r.noAdGateAllowed !== false));
check('BUILDING', 'Lv2-10 (lv2_5/lv6_10) 全部 mainlineGateAllowed=false 且 noAdGateAllowed=false', gatedRows.length === 0, gatedRows.length ? `异常行数=${gatedRows.length}` : '');

console.log('\n==== 3. D7 模拟（5 舰免费 + 第 7 天完整自选星核）====');
// 03-04 §4.3 D7 目标：3 主力舰 Lv11-20 + 2 辅助舰 Lv1-10；3 主力驾驶员 Lv11-20 + 2 辅助驾驶员 Lv1-10；1 核初始（stage0 免费）；6 插件 +0-3
let d7Cost = zeroResources();
d7Cost = addResources(d7Cost, scaleResources(cumulativeCost(shipLevels, 1, 20), 3));
d7Cost = addResources(d7Cost, scaleResources(cumulativeCost(shipLevels, 1, 10), 2));
d7Cost = addResources(d7Cost, scaleResources(cumulativeCost(pilotLevels, 1, 20), 3));
d7Cost = addResources(d7Cost, scaleResources(cumulativeCost(pilotLevels, 1, 10), 2));
d7Cost = addResources(d7Cost, scaleResources(pluginLevels.filter((r) => r.level <= 3).reduce((acc, r) => addResources(acc, r.levelCost), zeroResources()), 6));
d7Cost = roundResources(d7Cost);
const d7Floor = anchor('d7', 'floor');
info('D7', '模拟累计成本 (3舰Lv20+2舰Lv10+3驾驶员Lv20+2驾驶员Lv10+1核stage0+6插件+3)', JSON.stringify(d7Cost));
check('D7', '累计成本 <= D7 floor', overBudget(d7Cost, d7Floor).length === 0, overBudget(d7Cost, d7Floor).join(', '));

console.log('\n==== 4. D14 模拟（2 核可用，5 舰/驾驶员进入 Lv21-30 前段）====');
// "前段"取值区间：低=进入 Lv21（每段 1 级），高=进入 Lv25（段中点）；插件 10-12 个 +4-6（满段）
const d14ShipLow = scaleResources(cumulativeCost(shipLevels, 1, 21), 5);
const d14ShipHigh = scaleResources(cumulativeCost(shipLevels, 1, 25), 5);
const d14PilotLow = scaleResources(cumulativeCost(pilotLevels, 1, 21), 5);
const d14PilotHigh = scaleResources(cumulativeCost(pilotLevels, 1, 25), 5);
const pluginBand46 = pluginLevels.filter((r) => r.level >= 4 && r.level <= 6).reduce((acc, r) => addResources(acc, r.levelCost), zeroResources());
const d14Plugin10 = scaleResources(pluginBand46, 10);
const d14Plugin12 = scaleResources(pluginBand46, 12);
const d14Core2 = scaleResources(addResources(coreStages[2].stageCost, coreStages[1].stageCost ?? zeroResources()), 2); // 2 核 stage0->stage2 (core_enhance_1_2)
const d14CostLow = roundResources(addResources(addResources(addResources(d14ShipLow, d14PilotLow), d14Plugin10), d14Core2));
const d14CostHigh = roundResources(addResources(addResources(addResources(d14ShipHigh, d14PilotHigh), d14Plugin12), d14Core2));
const d14Floor = anchor('d14', 'floor');
const d14Expected = anchor('d14', 'expected');
info('D14', '模拟累计成本-低估 (5舰/5驾驶员进Lv21 + 10插件+4-6 + 2核stage2)', JSON.stringify(d14CostLow));
info('D14', '模拟累计成本-高估 (5舰/5驾驶员进Lv25 + 12插件+4-6 + 2核stage2)', JSON.stringify(d14CostHigh));
check('D14', '低估累计成本 <= D14 floor', overBudget(d14CostLow, d14Floor).length === 0, overBudget(d14CostLow, d14Floor).join(', '));
check('D14', '高估累计成本 <= D14 expected', overBudget(d14CostHigh, d14Expected).length === 0, overBudget(d14CostHigh, d14Expected).join(', '));
const d14HighOverFloor = overBudget(d14CostHigh, d14Floor);
if (d14HighOverFloor.length > 0) note('D14', `高估口径下超出 floor: ${d14HighOverFloor.join(', ')}；与 03-04 §4.3 "D14 expected 足够，floor 需优先主力" 的结论一致，不视为阻断`);

console.log('\n==== 5. D21 模拟（3 核基础路径 / 5 主力舰驾驶员 Lv30）====');
// 03-04 §4.3 D21 目标：5 主力舰 Lv30+；5 主力驾驶员 Lv30 左右；3 核稳定；12 插件 +7-10
// "+7-10"为段区间：低估=12插件进入+7（段首1级），高估=12插件到+10（满段）；与 D14 "前段"区间处理方式一致
const d21Ship30 = scaleResources(cumulativeCost(shipLevels, 1, 30), 5);
const d21Pilot30 = scaleResources(cumulativeCost(pilotLevels, 1, 30), 5);
const pluginLv7Cost = pluginLevels.find((r) => r.level === 7).levelCost;
const pluginBand710Full = pluginLevels.filter((r) => r.level >= 7 && r.level <= 10).reduce((acc, r) => addResources(acc, r.levelCost), zeroResources());
const d21Plugin12Low = scaleResources(pluginLv7Cost, 12);
const d21Plugin12High = scaleResources(pluginBand710Full, 12);
const core123 = addResources(addResources(coreStages[1].stageCost, coreStages[2].stageCost), coreStages[3].stageCost); // stage0->stage3 单核成本
const core12 = addResources(coreStages[1].stageCost, coreStages[2].stageCost); // stage0->stage2 单核成本 (基础/构筑入口)
const d21Core3Stage2 = scaleResources(core12, 3); // 3 核到 stage2（基础路径）
const d21Core3Stage3 = scaleResources(core123, 3); // 3 核到 stage3（稳定/强化3）
const d21CostBase = roundResources(addResources(addResources(addResources(d21Ship30, d21Pilot30), d21Plugin12Low), d21Core3Stage2));
const d21CostStage3 = roundResources(addResources(addResources(addResources(d21Ship30, d21Pilot30), d21Plugin12High), d21Core3Stage3));
const d21Floor = anchor('d21', 'floor');
const d21Expected = anchor('d21', 'expected');
info('D21', '模拟累计成本-低估 (5舰Lv30+5驾驶员Lv30+12插件进入+7+3核stage2基础)', JSON.stringify(d21CostBase));
info('D21', '模拟累计成本-高估 (5舰Lv30+5驾驶员Lv30+12插件到+10+3核stage3)', JSON.stringify(d21CostStage3));
check('D21', '低估累计成本 <= D21 floor（3核基础路径成立）', overBudget(d21CostBase, d21Floor).length === 0, overBudget(d21CostBase, d21Floor).join(', '));
check('D21', '高估累计成本 <= D21 expected', overBudget(d21CostStage3, d21Expected).length === 0, overBudget(d21CostStage3, d21Expected).join(', '));
const d21HighOverFloor = overBudget(d21CostStage3, d21Floor);
if (d21HighOverFloor.length > 0) note('D21', `高估口径下超出 floor: ${d21HighOverFloor.join(', ')}；12插件到+10、3核到stage3均属"+7-10"/强化3区间的上限，落入 expected 区间，不视为阻断`);

console.log('\n==== 6. D28 模拟（75 主线不看广告可通 / N075）====');
// 03-04 §4.3 D28 目标：5 主力舰 Lv36-40；5 主力驾驶员 Lv31-40 中段；3 核强化(stage3) + 第4核到stage2；15 插件 +7-10
const d28Ship36 = scaleResources(cumulativeCost(shipLevels, 1, 36), 5);
const d28Pilot35 = scaleResources(cumulativeCost(pilotLevels, 1, 35), 5);
const pluginBand710_15 = scaleResources(pluginBand710Full, 15);
const d28Core = addResources(d21Core3Stage3, scaleResources(core12, 1)); // 3核稳定在stage3 + 第4核到stage2（4-5核在途）
const d28Cost = roundResources(addResources(addResources(addResources(d28Ship36, d28Pilot35), pluginBand710_15), d28Core));
const d28Floor = anchor('d28', 'floor');
info('D28', '模拟累计成本 (5舰Lv36+5驾驶员Lv35+15插件+7-10+3核stage3+第4核stage2)', JSON.stringify(d28Cost));
check('D28', '累计成本 <= D28 floor（不看广告可通 N075）', overBudget(d28Cost, d28Floor).length === 0, overBudget(d28Cost, d28Floor).join(', '));

console.log('\n==== 7. N075 压力上限校验 ====');
const bpN075 = pressureRows.find((r) => r.rowId === 'bp_n075');
check('N075', 'pressureMax === 14500（不上探 15500）', bpN075?.pressureMax === 14500, `实际=${bpN075?.pressureMax}`);
check('N075', 'pressureRecommend 落在 [pressureMin, pressureMax]', bpN075.pressureRecommend >= bpN075.pressureMin && bpN075.pressureRecommend <= bpN075.pressureMax, `${bpN075.pressureRecommend} in [${bpN075.pressureMin},${bpN075.pressureMax}]`);
const n075Boss = bossRows.find((r) => r.bossNodeId === 'n075');
const n075Mainline = mainlineRows.find((r) => r.nodeId === 'n075');
check('N075', 'boss_node_config.n075.templateRef === t10', n075Boss?.templateRef === 't10');
check('N075', 'mainline_node_config.n075.noAdCheckTag === no_ad_75_pass_check', n075Mainline?.noAdCheckTag === 'no_ad_75_pass_check');

console.log('\n==== 8. no-ad 路径校验 ====');
check('NOAD', 'no_ad_path_check_config 共 16 行', noAdCheckRows.length === 16, `实际=${noAdCheckRows.length}`);
const cutNodes = mainlineRows.filter((r) => r.fallback70Tag === 'cut_70').map((r) => r.nodeId).sort();
const noAdOnCutNode = noAdCheckRows.filter((r) => cutNodes.includes(r.nodeId));
check('NOAD', 'no_ad_path_check_config 不绑定 70 可删节点', noAdOnCutNode.length === 0, noAdOnCutNode.map((r) => r.nodeId).join(','));
check('NOAD', 'D7 floor 支撑免费 5 舰 + 第 7 天完整自选星核', overBudget(d7Cost, d7Floor).length === 0);
check('NOAD', 'D21 floor 支撑 3 核基础路径(stage2)', overBudget(d21CostBase, d21Floor).length === 0);
check('NOAD', 'D28 floor 支撑 75 主线可通（N075）', overBudget(d28Cost, d28Floor).length === 0);
// §2.2/§8 关键资源锚点显式断言：完整星核与星辉货舱是 no-ad 关键路径的硬指标，不能只靠成本汇总间接覆盖
check('NOAD', 'D7 floor.完整星核(fullCore) >= 1（第 7 天完整自选星核, §2.2/§8）', (d7Floor.fullCore ?? 0) >= 1, `实际=${d7Floor.fullCore}`);
check('NOAD', 'D21 floor.完整星核(fullCore) >= 3（3 核基础路径, §2.2/§8）', (d21Floor.fullCore ?? 0) >= 3, `实际=${d21Floor.fullCore}`);
check('NOAD', 'D28 floor.完整星核(fullCore) >= 3（不看广告可通 N075, §2.2/§8）', (d28Floor.fullCore ?? 0) >= 3, `实际=${d28Floor.fullCore}`);
check('NOAD', 'D7 floor.星辉货舱(starCargo) >= 1（免费星辉货舱好东西, §8）', (d7Floor.starCargo ?? 0) >= 1, `实际=${d7Floor.starCargo}`);
check('NOAD', 'D28 floor.星辉货舱(starCargo) >= 1（免费星辉货舱好东西, §8）', (d28Floor.starCargo ?? 0) >= 1, `实际=${d28Floor.starCargo}`);

console.log('\n==== 9. 70 回退影响校验 ====');
const FORBIDDEN_FALLBACK_NODES = ['n033', 'n047', 'n053', 'n063', 'n070'];
check('FALLBACK70', 'mainline cut_70 节点严格等于 N033/N047/N053/N063/N070', JSON.stringify(cutNodes) === JSON.stringify(FORBIDDEN_FALLBACK_NODES), JSON.stringify(cutNodes));
const FORBIDDEN_TOKENS = ['ad', 'sponsor', 'merchant', 'star_shell', 'paid', 'starcargo'];
const cutRows = riskFallbackRows.filter((r) => FORBIDDEN_FALLBACK_NODES.includes(r.nodeId));
check('FALLBACK70', 'risk_fallback_70_config 中 5 个 cut_70 行齐全', cutRows.length === 5, `实际=${cutRows.length}`);
for (const r of cutRows) {
  const hay = `${r.replacementRef} ${r.fallbackReasonTag}`.toLowerCase();
  const hit = FORBIDDEN_TOKENS.filter((t) => hay.includes(t));
  check('FALLBACK70', `${r.nodeId} replacementRef/fallbackReasonTag 不含广告/商人/星贝补洞标记`, hit.length === 0, hit.join(','));
  check('FALLBACK70', `${r.nodeId} criticalPathTag === false`, r.criticalPathTag === false);
}
note('FALLBACK70', 'D28 floor 在第 6 节已验证可支撑 N075 通过，即当前 70 回退后的 free_resource_anchor_param 仍满足 §9 "D28 floor 不得低于 N075 不看广告通过线"');

console.log('\n==== 10. team_power_index 量级一致性观察（仅内部参考，非通过/阻断标准）====');
// 03-04 §3.1 公式：team_power_index = 舰船战力和 + 驾驶员战力和*0.45 + 已装配星核战力和*0.55 + 已装配插件战力和*0.25
// "已装配"数量未在 38 张配置表中定义，本节按以下假设量级仅作观察：D7 用当时全部可用数（1核/6插件），D14/D21/D28 假设 3 核、6 插件装配
function teamPowerIndex(shipPowerSum, pilotPowerSum, corePowerSum, pluginPowerSum) {
  return round2(shipPowerSum + pilotPowerSum * 0.45 + corePowerSum * 0.55 + pluginPowerSum * 0.25);
}
const d7Team = teamPowerIndex(
  3 * shipLevels.find((r) => r.level === 20).shipPower + 2 * shipLevels.find((r) => r.level === 10).shipPower,
  3 * pilotLevels.find((r) => r.level === 20).pilotPower + 2 * pilotLevels.find((r) => r.level === 10).pilotPower,
  1 * coreStages[0].corePower,
  6 * pluginLevels.find((r) => r.level === 3).pluginPower,
);
const d28Team = teamPowerIndex(
  5 * shipLevels.find((r) => r.level === 36).shipPower,
  5 * pilotLevels.find((r) => r.level === 35).pilotPower,
  3 * coreStages[3].corePower,
  6 * pluginLevels.find((r) => r.level === 10).pluginPower,
);
const d7PowerRef = powerRefRows.find((r) => r.rowId === 'd7');
const d28PowerRef = powerRefRows.find((r) => r.rowId === 'd28');
info('POWERIDX', `D7 公式计算值=${d7Team}，power_reference_param d7 区间=[${d7PowerRef.powerIndexMin},${d7PowerRef.powerIndexMax}] 建议=${d7PowerRef.powerIndex}`);
info('POWERIDX', `D28 公式计算值=${d28Team}，power_reference_param d28 区间=[${d28PowerRef.powerIndexMin},${d28PowerRef.powerIndexMax}] 建议=${d28PowerRef.powerIndex}`);
if (d7Team > d7PowerRef.powerIndexMax) {
  note('POWERIDX', `§3.1 公式按 §3.2-3.5 段值代入 §4.3 D7 目标编队后，计算值 ${d7Team} 超出 §2.1 power_reference_param d7 区间上限 ${d7PowerRef.powerIndexMax}（D28 ${d28Team} 落在 [${d28PowerRef.powerIndexMin},${d28PowerRef.powerIndexMax}] 内，未超出）。这是 03-04 v0.2 冻结稿内 §2.1 与 §3.1-3.5 两组参数之间的量级口径差异（D7 尤为明显），CC-06A 不改动任一方冻结数值，登记为需 Ron/Codex 决策项（非本任务通过标准的一部分）`);
}

console.log(`\n==== 结果 ====`);
console.log(`错误数: ${errors.length}`);
console.log(`备注数: ${notes.length}`);
if (errors.length > 0) {
  console.error('s7 progression simulation failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('all s7 progression simulations passed (ship/pilot lv1-40, core stage0-5, plugin +1-15, building lv1-10, D7/D14/D21/D28, no-ad, N075, fallback70)');
