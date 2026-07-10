// 校验 assets/resources/configs/s7 下的 S7 配置表（首发正式版独立命名空间）。
// Tier A 叶子表 + Tier B 数值/经济参数表；与流程版 validate-configs.mjs 平行、互不影响。
// 规则真源与 assets/scripts/config/s7/ConfigValidatorS7.ts 保持一致；失败以非零退出码阻断。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

const ID_PATTERN = /^[a-z0-9_]+$/;
const PROBLEM_TAGS = ['swarm', 'shield', 'backline', 'burst', 'berserk', 'summon'];
const STAGE_TYPES = ['normal', 'elite', 'boss'];
const SHIP_TYPES = ['free', 'stream'];
const PLUGIN_SLOTS = ['weapon', 'skill', 'tactical'];
// 资源词表（钱包全集）：奖励发放按此校验，与 S7SaveService.S7_RESOURCE_KEYS 对齐。块6余项 +starGem/pilotShardUniversal、信标拆 3 档（撤 beacon）；块5 +adTicket（广告券）。
const RESOURCE_VOCAB = ['starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken', 'coreFrag', 'fullCore', 'starGem', 'supplyTicket', 'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket'];
// 免费毕业预算追踪子集（anchor 表列集）：只盯核心软货币，与钱包全集解耦——扩钱包不被逼填预算数值（信标经济交第二块）。
const ANCHOR_BUDGET_KEYS = ['starOre', 'hullAlloy', 'shipBlueprint', 'pilotToken', 'coreFrag', 'fullCore', 'supplyTicket', 'starCargo'];
const REWARD_SOURCE_TYPES = ['mainline', 'boss', 'action3', 'expansion7', 'salvage', 'range', 'supply', 'beacon', 'star_cargo'];
const ANCHOR_DAYS = ['d7', 'd14', 'd21', 'd28'];

function seq(prefix, from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${i < 10 ? '0' : ''}${i}`);
  return out;
}

const TIER_A = {
  battle_template_config: { idField: 'templateId', count: 10, ids: seq('t', 1, 10) },
  // ⑥第一段 20 舰落地（2026-07-07·细表§12）：默认盘 12→20（与 ConfigValidatorS7.S7_EXPECTED_COUNT 双份同步）。
  ship_config: { idField: 'shipId', count: 20, ids: seq('shp', 1, 20) },
  pilot_config: { idField: 'pilotId', count: 20, ids: seq('pil', 1, 20) }, // ⑩A1：驾驶员 20 天赋接线·扩容已拍（第一段四点②）
  core_config: { idField: 'coreId', count: 16, ids: seq('core', 7, 22) },
  plugin_config: { idField: 'pluginId', count: 30, ids: seq('plg', 1, 30) }, // ⑩A3：插件残项接线·对齐真源 30 件（18 原位改名+12 新增·发放路径泛化读表安全）
};
const TIER_B = ['source_tag_config', 'power_reference_param', 'free_resource_anchor_param', 'enhance_cost_param', 'refund_param', 'pressure_param', 'reward_param', 'shop_param', 'merchant_refresh_param', 'recycle_param', 'anti_arbitrage_check', 'commission_affix_param'];
// 悬赏词缀定位型/键真源（镜像 core/s7/S7CommissionAffix.ts 与 S7BattleEffectBlock.ts）：改这些两处校验器都要改。
const POSITION_TYPES = ['assault', 'guard', 'artillery', 'support', 'engineer'];
const AFFIX_TARGET_TYPES = [...POSITION_TYPES, 'all'];
const STAT_KEYS = ['maxHp', 'attack', 'armor', 'attackIntervalSec', 'attackRangeCells', 'passiveEnergyPerSec'];
const AFFIX_KEYS = ['critRate', 'critDmg', 'shieldBreak', 'skillHaste', 'healPower', 'controlResist', 'dmgVsSwarm', 'dmgVsBoss'];
const TIER_B_REL = {
  enemy_schema_config: 'enemyId',
  boss_skeleton_config: 'bossId',
  prebattle_preview_config: 'previewId',
  ship_pilot_fit_config: 'shipRef',
  core_plugin_fit_config: 'streamTag',
};
const TIER_B_BLD = {
  building_config: 'buildingId',
  building_unlock_config: 'unlockId',
  building_level_cost_param: 'costParamId',
  building_level_effect_param: 'effectParamId',
  building_anchor_impact_check: 'checkId',
};
const BUILDING_GROUPS = ['core_growth', 'pilot_growth', 'base_comfort', 'supply_comfort', 'resource_comfort', 'merchant_comfort', 'minor_growth', 'showcase'];
const BUILDING_NO_AD_ROLES = ['entry_only', 'optional_support', 'non_core', 'none'];
const BUILDING_RELEASE_TAGS = ['default_release', 'conditional_post'];
const BUILDING_DEFAULT_KEYS = ['dock', 'pilot_training_bay', 'habitat', 'supply_station', 'salvage_port', 'merchant_station', 'research_tower'];
const BUILDING_RESERVED_KEYS = ['core_gallery'];
const BUILDING_ANCHOR_DAYS = ['D7', 'D14', 'D21', 'D28'];
// 70 回退机制已作废（Codex 旧遗留，2026-07-02 一并清理）：恒为空。
const FORBIDDEN_FALLBACK_NODES = [];

const errors = [];
const fail = (t, id, m) => errors.push(`[${t}] ${id}: ${m}`);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function load(name) {
  try {
    const data = JSON.parse(readFileSync(path.join(CONFIG_DIR, `${name}.sample.json`), 'utf-8'));
    if (!Array.isArray(data)) { fail(name, '-', '必须是数组'); return []; }
    return data;
  } catch (e) { fail(name, '-', `读取/解析失败: ${e.message}`); return []; }
}

function checkArrayEnum(name, id, field, value, allowed) {
  if (!Array.isArray(value) || value.length === 0) { fail(name, id, `${field} 必须是非空数组`); return; }
  for (const v of value) if (!allowed.includes(v)) fail(name, id, `${field} 含非法值 "${v}"`);
}
function checkRefs(name, id, field, value, validIds) {
  if (!Array.isArray(value)) { fail(name, id, `${field} 必须是数组`); return; }
  for (const ref of value) {
    if (/rsv/.test(ref) || ref === 't11' || ref === 't12') fail(name, id, `${field} 引用了条件预留项 "${ref}"`);
    else if (!validIds.has(ref)) fail(name, id, `${field} 引用的 "${ref}" 不存在`);
  }
}

const tables = {};
for (const [name, def] of Object.entries(TIER_A)) {
  const rows = load(name); tables[name] = rows;
  if (rows.length !== def.count) fail(name, '-', `数量必须为 ${def.count}，实际 ${rows.length}`);
  const whitelist = new Set(def.ids); const seen = new Set();
  for (const row of rows) {
    const id = row[def.idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${def.idField} 不符合全小写规则`);
    if (seen.has(id)) fail(name, id, 'ID 重复'); seen.add(id);
    if ((name === 'battle_template_config' && (id === 't11' || id === 't12')) || /rsv/.test(String(id))) fail(name, id, '条件预留项禁止进入默认池');
    if (!whitelist.has(id)) fail(name, id, `${id} 不在默认白名单内`);
  }
}
for (const name of TIER_B) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row.rowId;
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, 'rowId 不符合全小写规则');
    if (/rsv/.test(String(id))) fail(name, id, 'rowId 含条件预留标识');
    if (seen.has(id)) fail(name, id, 'rowId 重复'); seen.add(id);
  }
}

for (const [name, idField] of Object.entries(TIER_B_REL)) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${idField} 不符合全小写规则`);
    if (/rsv/.test(String(id)) || id === 't11' || id === 't12') fail(name, id, '条件预留标识禁止进入关系/schema 表主键');
    if (seen.has(id)) fail(name, id, `${idField} 重复`); seen.add(id);
  }
}

for (const [name, idField] of Object.entries(TIER_B_BLD)) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${idField} 不符合全小写规则`);
    if (seen.has(id)) fail(name, id, `${idField} 重复`); seen.add(id);
  }
}

const shipIds = new Set(tables.ship_config.map((r) => r.shipId));
const coreIds = new Set(tables.core_config.map((r) => r.coreId));
const pilotIds = new Set(tables.pilot_config.map((r) => r.pilotId));
const pluginIds = new Set(tables.plugin_config.map((r) => r.pluginId));
const templateIds = new Set(tables.battle_template_config.map((r) => r.templateId));
const shipAndCoreIds = new Set([...shipIds, ...coreIds]);
const checkSingleRef = (name, id, field, value, validIds) => {
  if (typeof value !== 'string') fail(name, id, `${field} 必须是字符串引用`);
  else if (/rsv/.test(value) || value === 't11' || value === 't12') fail(name, id, `${field} 引用了条件预留项 "${value}"`);
  else if (!validIds.has(value)) fail(name, id, `${field} 引用的 "${value}" 不存在`);
};

for (const row of tables.battle_template_config) {
  if (!PROBLEM_TAGS.includes(row.mainProblemTag)) fail('battle_template_config', row.templateId, 'mainProblemTag 非法');
  if (row.secondaryTagCap !== 1) fail('battle_template_config', row.templateId, 'secondaryTagCap 必须为 1');
  checkArrayEnum('battle_template_config', row.templateId, 'applicableStageTypes', row.applicableStageTypes, STAGE_TYPES);
  if (row.reservedSlotFlag !== false) fail('battle_template_config', row.templateId, 'reservedSlotFlag 必须为 false');
}
for (const row of tables.ship_config) {
  if (!SHIP_TYPES.includes(row.shipType)) fail('ship_config', row.shipId, 'shipType 非法');
  checkArrayEnum('ship_config', row.shipId, 'coverProblemTags', row.coverProblemTags, PROBLEM_TAGS);
}
for (const row of tables.pilot_config) checkArrayEnum('pilot_config', row.pilotId, 'coverProblemTags', row.coverProblemTags, PROBLEM_TAGS);
for (const row of tables.core_config) {
  checkArrayEnum('core_config', row.coreId, 'coverProblemTags', row.coverProblemTags, PROBLEM_TAGS);
  checkRefs('core_config', row.coreId, 'shipFitRefs', row.shipFitRefs, shipIds);
}
for (const row of tables.plugin_config) {
  if (!PLUGIN_SLOTS.includes(row.slotTag)) fail('plugin_config', row.pluginId, 'slotTag 非法');
  checkArrayEnum('plugin_config', row.pluginId, 'coverProblemTags', row.coverProblemTags, PROBLEM_TAGS);
  checkRefs('plugin_config', row.pluginId, 'fitRefs', row.fitRefs, shipAndCoreIds);
}

// ---- Tier B ----
for (const row of tables.source_tag_config) {
  const id = row.rowId;
  if (!['free', 'high_risk'].includes(row.sourceCategory)) fail('source_tag_config', id, 'sourceCategory 非法');
  if (row.sourceCategory === 'high_risk' && row.riskLevel !== 'high') fail('source_tag_config', id, 'high_risk 来源 riskLevel 必须 high');
  if (row.inheritOnTransform !== true) fail('source_tag_config', id, 'inheritOnTransform 必须 true');
  if (row.washProtected !== true) fail('source_tag_config', id, 'washProtected 必须 true');
}
{
  const days = new Set();
  for (const row of tables.power_reference_param) {
    days.add(row.anchorDay);
    if (row.internalOnly !== true) fail('power_reference_param', row.rowId, 'internalOnly 必须 true');
    const v = num(row.powerIndex), lo = num(row.powerIndexMin), hi = num(row.powerIndexMax);
    if (lo === null || hi === null || v === null || !(lo <= v && v <= hi)) fail('power_reference_param', row.rowId, 'powerIndexMin<=powerIndex<=powerIndexMax 不成立');
  }
  for (const d of ANCHOR_DAYS) if (!days.has(d)) fail('power_reference_param', d, `缺少锚点 ${d}`);
}
{
  const byAnchor = {};
  for (const row of tables.free_resource_anchor_param) {
    if (!ANCHOR_DAYS.includes(row.anchorDay)) fail('free_resource_anchor_param', row.rowId, 'anchorDay 非法');
    if (!['floor', 'expected'].includes(row.band)) fail('free_resource_anchor_param', row.rowId, 'band 非法');
    byAnchor[row.anchorDay] = byAnchor[row.anchorDay] ?? {};
    byAnchor[row.anchorDay][row.band] = row;
  }
  for (const d of ANCHOR_DAYS) {
    const p = byAnchor[d];
    if (!p || !p.floor || !p.expected) { fail('free_resource_anchor_param', d, `缺少 ${d} floor/expected`); continue; }
    for (const res of ANCHOR_BUDGET_KEYS) {
      const f = num(p.floor[res]), e = num(p.expected[res]);
      if (f === null || e === null) fail('free_resource_anchor_param', d, `资源 ${res} 缺数值`);
      else if (f > e) fail('free_resource_anchor_param', d, `资源 ${res} floor(${f})>expected(${e})`);
    }
  }
}
{
  // 首发无强化系统：砍星核5阶强化(§5.4 留P1) + 插件不分等级(§5.3) → enhance_cost_param 应为空
  if (tables.enhance_cost_param.length > 0) fail('enhance_cost_param', '-', '首发无强化系统,enhance_cost_param 应为空(已砍星核5阶强化,§5.4)');
}
for (const row of tables.refund_param) {
  if (row.crossCurrency !== false) fail('refund_param', row.rowId, 'crossCurrency 必须 false');
  const lo = num(row.refundRateMinPct), hi = num(row.refundRateMaxPct);
  if (lo === null || hi === null || lo > hi || lo < 0 || hi > 100) fail('refund_param', row.rowId, 'refundRate 区间非法');
}
for (const row of tables.pressure_param) {
  const s = row.scope;
  if (!['normal', 'elite', 'boss', 'template_modifier'].includes(s)) { fail('pressure_param', row.rowId, 'scope 非法'); continue; }
  if (s === 'template_modifier') {
    if (!(num(row.modifier) > 0)) fail('pressure_param', row.rowId, 'modifier 必须为正');
    if (row.appliesToBoss !== false) fail('pressure_param', row.rowId, 'appliesToBoss 必须 false');
  } else {
    const lo = num(row.pressureMin), hi = num(row.pressureMax);
    if (lo === null || hi === null || lo > hi) fail('pressure_param', row.rowId, 'pressureMin<=pressureMax 不成立');
    // 步5 对表守卫：n150 推荐战力钉 v0.7 快照精确值（32094）——压力表重校（json 再生）时此处红=提醒重落显示带（同敌配绊线哲学）。
    if (s === 'boss' && row.refKey === 'n150' && row.pressureRecommend !== 32094) fail('pressure_param', row.rowId, 'N150 推荐战力必须==v0.7 快照 32094（重校后同步重落）');
  }
}
for (const row of tables.reward_param) {
  const id = row.rowId;
  if (!REWARD_SOURCE_TYPES.includes(row.sourceType)) fail('reward_param', id, `sourceType "${row.sourceType}" 非法`);
  if (/rsv/i.test(String(row.sourceType)) || /rsv/i.test(String(row.packId)) || /rsv/i.test(String(row.goodItemTag))) fail('reward_param', id, '奖励池不得引用 RSV');
  if (row.noAdRequired !== true) fail('reward_param', id, 'noAdRequired 必须 true');
  if (!Array.isArray(row.resources)) fail('reward_param', id, 'resources 必须是数组');
  else for (const r of row.resources) {
    if (!RESOURCE_VOCAB.includes(r.resourceId)) fail('reward_param', id, `resourceId "${r.resourceId}" 不在资源词表`);
    const lo = num(r.min), hi = num(r.max);
    if (lo === null) fail('reward_param', id, 'resources.min 缺数值');
    if (hi !== null && lo !== null && lo > hi) fail('reward_param', id, 'resources.min>max');
  }
}
for (const row of tables.shop_param) {
  const lo = num(row.priceMin), hi = num(row.priceMax);
  if (lo === null || hi === null || lo > hi) fail('shop_param', row.rowId, 'priceMin<=priceMax 不成立');
  if (row.criticalPath !== false) fail('shop_param', row.rowId, '不得出售关键路径唯一物');
  if ((num(row.purchaseLimit) ?? 0) < 1) fail('shop_param', row.rowId, 'purchaseLimit 必须 >=1');
}
for (const row of tables.merchant_refresh_param) {
  if (row.freeRefreshPerCycle !== 1) fail('merchant_refresh_param', row.rowId, 'freeRefreshPerCycle 必须 1');
  if ((num(row.paidRefreshCapPerCycle) ?? 99) > 3) fail('merchant_refresh_param', row.rowId, 'paidRefreshCapPerCycle 必须 <=3');
  if (row.criticalPathItemBlock !== true) fail('merchant_refresh_param', row.rowId, 'criticalPathItemBlock 必须 true');
  const sq = row.refreshCostSequence;
  if (!Array.isArray(sq) || sq.length !== 3 || sq[0] !== 80 || sq[1] !== 160 || sq[2] !== 320) fail('merchant_refresh_param', row.rowId, 'refreshCostSequence 必须 [80,160,320]');
}
{
  const highRisk = ['merchant_bought', 'ad_extra', 'sponsor_supply', 'treasure_product'];
  for (const row of tables.recycle_param) {
    const lo = num(row.refundRateMinPct), hi = num(row.refundRateMaxPct);
    if (lo === null || hi === null || lo > hi) fail('recycle_param', row.rowId, 'refundRate 区间非法');
    if (row.itemType === 'full_core' && row.recyclable !== false) fail('recycle_param', row.rowId, '完整星核必须不可回收');
    if (highRisk.includes(row.itemType) && (hi === null || hi > 15)) fail('recycle_param', row.rowId, '高风险来源买入必亏(<=15%)');
  }
}
if (tables.anti_arbitrage_check.length < 6) fail('anti_arbitrage_check', '-', `阻断规则至少 6 条，实际 ${tables.anti_arbitrage_check.length}`);
for (const row of tables.anti_arbitrage_check) {
  if (row.blockOnFail !== true) fail('anti_arbitrage_check', row.rowId, 'blockOnFail 必须 true');
  if (typeof row.formula !== 'string' || !row.formula) fail('anti_arbitrage_check', row.rowId, 'formula 不能为空');
}

// ---- 成长段位参数表（CC-07E-1，来源 03-04 v0.2 §3.2-3.5）----
{
  const GROWTH_TARGET_TYPES = ['ship', 'pilot']; // 插件不分等级(§5.3)、星核砍强化(§5.4 留P1) → 均无成长段
  const GROWTH_CURVE_TYPES = ['band_linear', 'control_point'];
  const GROWTH_SECONDARY_KINDS = ['stat', 'affix', 'effect', 'none'];
  const GROWTH_EXPECTED_SECONDARY = { ship: 'stat', pilot: 'none' };
  const rows = load('growth_band_param'); tables.growth_band_param = rows;
  const seen = new Set();
  const byTarget = { ship: [], pilot: [] };
  for (const row of rows) {
    const id = row.rowId;
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail('growth_band_param', id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail('growth_band_param', id, 'rowId 不符合全小写规则');
    if (seen.has(id)) fail('growth_band_param', id, 'rowId 重复'); seen.add(id);
    const tt = row.targetType;
    if (!GROWTH_TARGET_TYPES.includes(tt)) { fail('growth_band_param', id, 'targetType 非法'); continue; }
    if (!GROWTH_CURVE_TYPES.includes(row.curveType)) fail('growth_band_param', id, 'curveType 非法');
    if (typeof row.bandId !== 'string' || !ID_PATTERN.test(row.bandId)) fail('growth_band_param', id, 'bandId 不合法');
    if (!GROWTH_SECONDARY_KINDS.includes(row.secondaryKind)) fail('growth_band_param', id, 'secondaryKind 非法');
    else if (row.secondaryKind !== GROWTH_EXPECTED_SECONDARY[tt]) fail('growth_band_param', id, `secondaryKind 应为 ${GROWTH_EXPECTED_SECONDARY[tt]}`);
    const f = num(row.fromIndex), t = num(row.toIndex), interp = num(row.interpFromIndex);
    const pmin = num(row.powerMin), pmax = num(row.powerMax), smin = num(row.secondaryMin), smax = num(row.secondaryMax);
    if (f === null || t === null || interp === null) fail('growth_band_param', id, 'fromIndex/toIndex/interpFromIndex 必须是数值');
    if (pmin === null || pmax === null || smin === null || smax === null) fail('growth_band_param', id, 'power/secondary 端点必须是数值');
    if (row.curveType === 'band_linear') {
      if (f !== null && t !== null && f > t) fail('growth_band_param', id, 'fromIndex<=toIndex 不成立');
      if (interp !== null && t !== null && interp >= t) fail('growth_band_param', id, 'interpFromIndex 必须 < toIndex');
      if (interp !== null && f !== null && interp > f) fail('growth_band_param', id, 'interpFromIndex 不得 > fromIndex');
      if (pmin !== null && pmax !== null && pmin > pmax) fail('growth_band_param', id, 'powerMin<=powerMax 不成立');
      if (byTarget[tt] && f !== null && t !== null) byTarget[tt].push({ from: f, to: t });
    } else if (row.curveType === 'control_point') {
      if (f !== null && t !== null && f !== t) fail('growth_band_param', id, 'control_point fromIndex 必须等于 toIndex');
      if (interp !== null && f !== null && interp !== f) fail('growth_band_param', id, 'control_point interpFromIndex 必须等于 fromIndex');
      if (pmin !== null && pmax !== null && pmin !== pmax) fail('growth_band_param', id, 'control_point powerMin 必须等于 powerMax');
      if (smin !== null && smax !== null && smin !== smax) fail('growth_band_param', id, 'control_point secondaryMin 必须等于 secondaryMax');
    }
  }
  const cover = (bands, minLv, maxLv, label) => {
    if (bands.length === 0) { fail('growth_band_param', label, `${label} 缺少 band_linear 成长段`); return; }
    const s = [...bands].sort((a, b) => a.from - b.from);
    if (s[0].from !== minLv) fail('growth_band_param', label, `${label} 成长段起点必须为 ${minLv}`);
    if (s[s.length - 1].to !== maxLv) fail('growth_band_param', label, `${label} 成长段终点必须为 ${maxLv}`);
    for (let i = 1; i < s.length; i += 1) if (s[i].from !== s[i - 1].to + 1) fail('growth_band_param', label, `${label} 成长段不连续`);
  };
  // ⑥第一段（细表§12.1）：取消建筑卡等级后舰上限=100，ship 战斗成长段铺满 1-100（41-100 占位持平作废）；
  // pilot 成长不走 band 属性（驾驶加成通道），band 表仍留 1-40 占位、随天赋接线批对齐。
  cover(byTarget.ship, 1, 100, 'ship');
  cover(byTarget.pilot, 1, 40, 'pilot');
}

// ---- Tier B 关系 / schema 表 ----
for (const row of tables.enemy_schema_config) {
  const id = row.enemyId;
  if (!PROBLEM_TAGS.includes(row.mainProblemTag)) fail('enemy_schema_config', id, 'mainProblemTag 非法');
  checkArrayEnum('enemy_schema_config', id, 'problemTagRefs', row.problemTagRefs, PROBLEM_TAGS);
  checkRefs('enemy_schema_config', id, 'templateRefSlots', row.templateRefSlots, templateIds);
  if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) fail('enemy_schema_config', id, 'counterHintTags 至少 2 个');
}
for (const row of tables.boss_skeleton_config) {
  const id = row.bossId;
  if (!PROBLEM_TAGS.includes(row.primaryProblemTag)) fail('boss_skeleton_config', id, 'primaryProblemTag 非法');
  const sec = row.secondaryPressureTag;
  if (typeof sec !== 'string') fail('boss_skeleton_config', id, 'secondaryPressureTag 必须是字符串');
  else if (sec.length > 0 && !PROBLEM_TAGS.includes(sec)) fail('boss_skeleton_config', id, `secondaryPressureTag "${sec}" 非法`);
  checkRefs('boss_skeleton_config', id, 'templateRefs', row.templateRefs, templateIds);
  if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) fail('boss_skeleton_config', id, 'counterHintTags 至少 2 个');
}
for (const row of tables.prebattle_preview_config) {
  const id = row.previewId;
  checkSingleRef('prebattle_preview_config', id, 'templateRef', row.templateRef, templateIds);
  checkArrayEnum('prebattle_preview_config', id, 'problemTagRefs', row.problemTagRefs, PROBLEM_TAGS);
  if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) fail('prebattle_preview_config', id, 'counterHintTags 至少 2 个');
}
{
  const fitShips = new Set();
  for (const row of tables.ship_pilot_fit_config) {
    const id = row.shipRef;
    if (!shipIds.has(id)) fail('ship_pilot_fit_config', id, `shipRef "${id}" 不存在`);
    fitShips.add(id);
    checkSingleRef('ship_pilot_fit_config', id, 'primaryPilotRef', row.primaryPilotRef, pilotIds);
    checkRefs('ship_pilot_fit_config', id, 'alternativePilotRefs', row.alternativePilotRefs, pilotIds);
    if (!Array.isArray(row.alternativePilotRefs) || row.alternativePilotRefs.length < 1) fail('ship_pilot_fit_config', id, '每个主适配必须至少 1 个替代适配');
    if (row.notUniqueFlag !== true) fail('ship_pilot_fit_config', id, 'notUniqueFlag 必须为 true');
  }
  for (const s of shipIds) if (!fitShips.has(s)) fail('ship_pilot_fit_config', s, `星舰 ${s} 缺少适配关系行`);
}
for (const row of tables.core_plugin_fit_config) {
  const id = row.streamTag;
  checkRefs('core_plugin_fit_config', id, 'shipRefs', row.shipRefs, shipIds);
  checkRefs('core_plugin_fit_config', id, 'pilotRefs', row.pilotRefs, pilotIds);
  checkRefs('core_plugin_fit_config', id, 'coreRefs', row.coreRefs, coreIds);
  checkRefs('core_plugin_fit_config', id, 'pluginRefs', row.pluginRefs, pluginIds);
  if (!Array.isArray(row.coreRefs) || row.coreRefs.length < 2) fail('core_plugin_fit_config', id, '每流派至少 2 个星核解法');
  if (!Array.isArray(row.pluginRefs) || row.pluginRefs.length < 2) fail('core_plugin_fit_config', id, '每流派至少 2 个插件解法');
}

// ---- Tier B 建筑表 ----
{
  const bldRows = tables.building_config;
  const buildingIds = new Set();
  const systemRefsById = new Map();
  const noAdRoleById = new Map();
  const defaultKeys = []; const conditionalKeys = []; const keySeen = new Set();
  if (bldRows.length !== 8) fail('building_config', '-', `建筑总数必须为 8，实际 ${bldRows.length}`);
  for (const row of bldRows) {
    const id = row.buildingId; buildingIds.add(id);
    const key = row.buildingKey;
    if (keySeen.has(key)) fail('building_config', id, `buildingKey "${key}" 重复`); keySeen.add(key);
    systemRefsById.set(id, Array.isArray(row.systemRefTags) ? row.systemRefTags : []);
    noAdRoleById.set(id, row.noAdCorePathRole);
    if (!BUILDING_GROUPS.includes(row.buildingGroupTag)) fail('building_config', id, 'buildingGroupTag 非法');
    if (!BUILDING_NO_AD_ROLES.includes(row.noAdCorePathRole)) fail('building_config', id, 'noAdCorePathRole 非法');
    if (!BUILDING_RELEASE_TAGS.includes(row.releaseTag)) fail('building_config', id, 'releaseTag 非法');
    if (row.initialLevel !== 1) fail('building_config', id, 'initialLevel 必须为 1');
    if (row.maxLevel !== 10) fail('building_config', id, 'maxLevel 必须为 10');
    if (row.functionUnlockLevel !== 1) fail('building_config', id, 'functionUnlockLevel 必须为 1');
    if ((num(row.mainlineRequiredLevelCap) ?? 99) > 1) fail('building_config', id, 'mainlineRequiredLevelCap 不得 > 1');
    if (!Array.isArray(row.systemRefTags) || row.systemRefTags.length === 0) fail('building_config', id, 'systemRefTags 不能为空');
    if (row.releaseTag === 'default_release') {
      defaultKeys.push(key);
      if (row.reservedFlag !== false) fail('building_config', id, 'default_release 建筑 reservedFlag 必须 false');
    } else if (row.releaseTag === 'conditional_post') {
      conditionalKeys.push(key);
      if (row.reservedFlag !== true) fail('building_config', id, 'conditional_post 建筑 reservedFlag 必须 true');
      if (row.buildingGroupTag !== 'showcase') fail('building_config', id, 'conditional_post 建筑必须属于 showcase 组');
    }
  }
  if (defaultKeys.length !== 7) fail('building_config', '-', `默认建筑必须为 7 个，实际 ${defaultKeys.length}`);
  for (const k of BUILDING_DEFAULT_KEYS) if (!defaultKeys.includes(k)) fail('building_config', k, `默认建筑缺少 "${k}"`);
  for (const k of defaultKeys) if (!BUILDING_DEFAULT_KEYS.includes(k)) fail('building_config', k, `"${k}" 不在默认建筑白名单内`);
  if (conditionalKeys.length !== 1) fail('building_config', '-', `条件/后置建筑必须为 1 个，实际 ${conditionalKeys.length}`);
  for (const k of BUILDING_RESERVED_KEYS) if (!conditionalKeys.includes(k)) fail('building_config', k, `条件/后置预留建筑缺少 "${k}"`);

  const usedGroups = new Set(bldRows.map((r) => r.buildingGroupTag));

  const unlockBuildings = new Set(); const cc05aSeen = new Set();
  for (const row of tables.building_unlock_config) {
    const id = row.unlockId; const bid = row.buildingId;
    if (!buildingIds.has(bid)) fail('building_unlock_config', id, `buildingId "${bid}" 不存在`);
    unlockBuildings.add(bid);
    if (!['tutorial_anchor', 'mainline_anchor', 'need_anchor', 'expansion_anchor', 'blueprint_progress'].includes(row.unlockSourceType)) fail('building_unlock_config', id, 'unlockSourceType 非法');
    if (row.initialLevelOnUnlock !== 1) fail('building_unlock_config', id, 'initialLevelOnUnlock 必须为 1');
    if (row.noAdAvailableFlag !== true) fail('building_unlock_config', id, 'noAdAvailableFlag 必须 true');
    if (row.forbiddenFallback70Flag !== true) fail('building_unlock_config', id, 'forbiddenFallback70Flag 必须 true');
    if (row.forbiddenCommercialSourceFlag !== true) fail('building_unlock_config', id, 'forbiddenCommercialSourceFlag 必须 true');
    if (row.corePathRequiredFlag === true && noAdRoleById.get(bid) !== 'entry_only') fail('building_unlock_config', id, 'corePathRequiredFlag 仅 entry_only 入口建筑可 true');
    if (cc05aSeen.has(row.cc05aLinkTag)) fail('building_unlock_config', id, 'cc05aLinkTag 重复'); cc05aSeen.add(row.cc05aLinkTag);
    const anchorLower = String(row.unlockAnchorTag).toLowerCase(); const ccLower = String(row.cc05aLinkTag).toLowerCase();
    for (const n of FORBIDDEN_FALLBACK_NODES) if (anchorLower.includes(n) || ccLower.includes(n)) fail('building_unlock_config', id, `建筑解锁不得挂 70 回退可删节点 ${n.toUpperCase()}`);
  }
  for (const b of buildingIds) if (!unlockBuildings.has(b)) fail('building_unlock_config', b, `建筑 ${b} 缺少解锁行`);

  for (const row of tables.building_level_cost_param) {
    const id = row.costParamId;
    if (!usedGroups.has(row.buildingGroupTag)) fail('building_level_cost_param', id, 'buildingGroupTag 必须来自 building_config');
    if (!['activate_lv1', 'lv2_5', 'lv6_10'].includes(row.levelBand)) fail('building_level_cost_param', id, 'levelBand 非法');
    if (!['none', 'star_ore'].includes(row.primaryResourceTag)) fail('building_level_cost_param', id, 'primaryResourceTag 非法');
    if (!['none', 'low', 'mid', 'high'].includes(row.costBandTag)) fail('building_level_cost_param', id, 'costBandTag 非法');
    if (!['entry_unlock_only', 'not_in_core_floor', 'optional_post'].includes(row.freeAnchorImpactTag)) fail('building_level_cost_param', id, 'freeAnchorImpactTag 非法');
    if (row.forbidRecalc0304Flag !== true) fail('building_level_cost_param', id, 'forbidRecalc0304Flag 必须 true');
  }

  for (const row of tables.building_level_effect_param) {
    const id = row.effectParamId; const bid = row.buildingId;
    if (!buildingIds.has(bid)) fail('building_level_effect_param', id, `buildingId "${bid}" 不存在`);
    if (!['lv1', 'lv2_5', 'lv6_10'].includes(row.levelBand)) fail('building_level_effect_param', id, 'levelBand 非法');
    if (!['none', 'minor_non_gate'].includes(row.combatPowerImpactTag)) fail('building_level_effect_param', id, 'combatPowerImpactTag 非法');
    if (row.mainlineGateAllowed !== false) fail('building_level_effect_param', id, 'mainlineGateAllowed 必须 false');
    if (row.noAdGateAllowed !== false) fail('building_level_effect_param', id, 'noAdGateAllowed 必须 false');
    const sysRefs = systemRefsById.get(bid) ?? [];
    if (!sysRefs.includes(row.affectedSystemTag)) fail('building_level_effect_param', id, `affectedSystemTag "${row.affectedSystemTag}" 不在建筑 ${bid} systemRefTags 内`);
  }

  const anchorDaysSeen = new Set();
  for (const row of tables.building_anchor_impact_check) {
    const id = row.checkId; anchorDaysSeen.add(row.anchorDay);
    if (!BUILDING_ANCHOR_DAYS.includes(row.anchorDay)) fail('building_anchor_impact_check', id, 'anchorDay 非法');
    if (!Array.isArray(row.requiredBuildingRefs)) fail('building_anchor_impact_check', id, 'requiredBuildingRefs 必须是数组');
    else for (const ref of row.requiredBuildingRefs) if (!buildingIds.has(ref)) fail('building_anchor_impact_check', id, `requiredBuildingRefs 引用的 "${ref}" 不存在`);
    if ((num(row.requiredLevelCap) ?? 99) > 1) fail('building_anchor_impact_check', id, 'requiredLevelCap 不得 > 1');
    if (!['no_impact', 'needs_review', 'blocks_anchor'].includes(row.impactJudgement)) fail('building_anchor_impact_check', id, 'impactJudgement 非法');
    if (row.impactJudgement === 'blocks_anchor') fail('building_anchor_impact_check', id, 'impactJudgement=blocks_anchor 必须回主控');
    if (row.blockOnFail !== true) fail('building_anchor_impact_check', id, 'blockOnFail 必须 true');
    if (row.forbidCommercialPatchFlag !== true) fail('building_anchor_impact_check', id, 'forbidCommercialPatchFlag 必须 true');
  }
  for (const d of BUILDING_ANCHOR_DAYS) if (!anchorDaysSeen.has(d)) fail('building_anchor_impact_check', d, `缺少锚点 ${d}`);
}

// ---- Tier C：主线节点 / 章节 / 星域 / Boss / 教程触发 / 解锁检查点 / 保护重置 ----
function seq3(prefix, from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${String(i).padStart(3, '0')}`);
  return out;
}
const TIER_C = {
  mainline_node_config: 'nodeId',
  chapter_config: 'chapterId',
  star_region_config: 'starfieldId',
  boss_node_config: 'bossNodeId',
  tutorial_trigger_config: 'tutorialStepId',
  unlock_checkpoint_config: 'unlockRef',
  protection_reset_config: 'nodeId',
};
// 150关拓扑改造（2026-07-02，GDD-v2.0 S2/S14 毕业节奏建模确认）：6星域/25章节/6Boss/150节点。
const S7_MAINLINE_NODE_IDS = seq3('n', 1, 150);
const S7_CHAPTER_IDS = seq('ch', 1, 25);
const S7_STARFIELD_IDS = seq('sf', 1, 6);
// n030=第5章章末剧情首Boss（Ron 2026-07-03，掉陨星弹/解锁展厅+回廊）；6 墙(n060/084/102/120/138/150) 数量不变，n030 是第7个 boss 类型节点。
const S7_BOSS_NODE_IDS = ['n030', 'n060', 'n084', 'n102', 'n120', 'n138', 'n150'];
// 真实强引导教程只覆盖 n001-n005（见 S7DemoController runTutorialStep）。
const S7_TUTORIAL_STEP_IDS = seq('tut', 1, 5);
const S7_NODE_TYPE_TAGS = [
  'tutorial_battle', 'tutorial_position', 'normal', 'elite', 'tutorial_shield', 'checkpoint', 'review', 'boss',
  'tutorial_backline', 'tutorial_plugin', 'tutorial_core', 'boss_prep', 'reset_gate', 'protection_notice',
  'tutorial_burst', 'tutorial_window', 'tutorial_berserk_preview',
];
const S7_SECONDARY_PRESSURE_TAGS = [
  'none', 'low_position', 'low_backline_preview', 'low_burst_preview', 'low_swarm', 'low_burst_window',
  'low_shield', 'low_backline', 'summon_low', 'backline_low', 'swarm_low', 'berserk_preview', 'burst_low',
  'low_burst', 'berserk_low', 'shield_low', 'one_of_t03_t05_t08_t09',
];
// 简化为每个大Boss一个不看广告检查点（2026-07-02 拓扑改造）。
const S7_NO_AD_CHECK_TAGS = [
  'none', 'no_ad_boss1_check', 'no_ad_boss2_check', 'no_ad_boss3_check',
  'no_ad_boss4_check', 'no_ad_boss5_check', 'no_ad_boss6_check',
];
const S7_PROTECTION_TAGS = ['active', 'ending_notice', 'closed'];
const S7_FALLBACK70_TAGS = ['keep_70', 'cut_70', 'merge_70_to_t01', 'merge_70_to_t05'];
const NODE_RANGE_PATTERN = /^n\d{3}_n\d{3}$/;
const RESERVED_TOKEN_PATTERN = /(rsv|observatory|core_gallery)/;

// ---- Tier D：桥接表（来源 03-CC-05b：reward_pool_ref_config / no_ad_path_check_config / risk_fallback_70_config）----
const TIER_D = {
  reward_pool_ref_config: 'rewardAnchorRef',
  no_ad_path_check_config: 'checkTag',
  risk_fallback_70_config: 'nodeId',
};
const S7_REWARD_SOURCE_TAGS = [
  'source_mainline', 'source_boss', 'source_star_cargo', 'source_supply',
  'source_expansion7', 'source_beacon', 'source_range', 'source_none',
];
const S7_FORBIDDEN_DEPENDENCY_TAGS = [
  'ad', 'ad_extra', 'ad_temp_power', 'ad_refresh', 'ad_pity', 'ad_revive',
  'ad_compensation', 'ad_hidden_strong_reward', 'iap', 'sponsor_supply',
  'merchant_bought', 'star_shell_arbitrage', 'star_shell_patch',
  'five_core_gate', 'unique_core_item', 'unique_plugin_item',
];
const EMBEDDED_NODE_ID_PATTERN = /n\d{3}/g;

function checkStringArrayEnum(name, id, field, value, allowed, requireNonEmpty) {
  if (!Array.isArray(value)) { fail(name, id, `${field} 必须是数组`); return; }
  if (requireNonEmpty && value.length === 0) fail(name, id, `${field} 不能为空`);
  for (const item of value) if (typeof item !== 'string' || !allowed.includes(item)) fail(name, id, `${field} 含非法值 "${item}"`);
}

for (const [name, idField] of Object.entries(TIER_C)) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${idField} 不符合全小写规则`);
    if (seen.has(id)) fail(name, id, `${idField} 重复`); seen.add(id);
  }
}

for (const [name, idField] of Object.entries(TIER_D)) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${idField} 不符合全小写规则`);
    if (seen.has(id)) fail(name, id, `${idField} 重复`); seen.add(id);
  }
}

{
  const tutorialIds = new Set(S7_TUTORIAL_STEP_IDS);

  // mainline_node_config：75 节点完整、字段枚举、70 回退白名单、N038/N039 转折
  const mainlineRows = tables.mainline_node_config;
  if (mainlineRows.length !== 150) fail('mainline_node_config', '-', `主线节点必须为 150 行，实际 ${mainlineRows.length}`);
  const mainlineById = new Map();
  const seenNodeIds = new Set();
  const cutNodes = [];
  for (const row of mainlineRows) {
    const id = row.nodeId;
    seenNodeIds.add(id);
    mainlineById.set(id, row);
    if (!S7_NODE_TYPE_TAGS.includes(row.nodeTypeTag)) fail('mainline_node_config', id, 'nodeTypeTag 非法');
    if (!S7_STARFIELD_IDS.includes(row.starfieldId)) fail('mainline_node_config', id, 'starfieldId 非法');
    if (!S7_CHAPTER_IDS.includes(row.chapterId)) fail('mainline_node_config', id, 'chapterId 非法');
    const tref = row.templateRef;
    if (tref !== 'none' && !templateIds.has(tref)) fail('mainline_node_config', id, `templateRef "${tref}" 非法（仅允许 t01-t10 或 none）`);
    const ptag = row.problemTagRef;
    if (ptag !== 'none' && !PROBLEM_TAGS.includes(ptag)) fail('mainline_node_config', id, 'problemTagRef 非法');
    if (!S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) fail('mainline_node_config', id, 'secondaryPressureTag 非法');
    const tut = row.tutorialStepRef;
    if (tut !== 'none' && !tutorialIds.has(tut)) fail('mainline_node_config', id, 'tutorialStepRef 非法');
    if (typeof row.unlockRef !== 'string' || row.unlockRef.length === 0) fail('mainline_node_config', id, 'unlockRef 不能为空');
    if (typeof row.rewardAnchorRef !== 'string' || row.rewardAnchorRef.length === 0) fail('mainline_node_config', id, 'rewardAnchorRef 不能为空');
    if (!S7_NO_AD_CHECK_TAGS.includes(row.noAdCheckTag)) fail('mainline_node_config', id, 'noAdCheckTag 非法');
    if (!S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) fail('mainline_node_config', id, 'protectionPeriodTag 非法');
    if (!S7_FALLBACK70_TAGS.includes(row.fallback70Tag)) fail('mainline_node_config', id, 'fallback70Tag 非法');
    if (row.fallback70Tag === 'cut_70') cutNodes.push(id);
  }
  for (const id of S7_MAINLINE_NODE_IDS) if (!seenNodeIds.has(id)) fail('mainline_node_config', id, `缺少主线节点 ${id}`);

  // 70 回退白名单：仅 N033/N047/N053/N063/N070 允许 cut_70
  for (const id of cutNodes) if (!FORBIDDEN_FALLBACK_NODES.includes(id)) fail('mainline_node_config', id, `fallback70Tag=cut_70 仅允许 ${FORBIDDEN_FALLBACK_NODES.join('/')}，不允许 ${id}`);
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const row = mainlineById.get(id);
    if (row && row.fallback70Tag !== 'cut_70') fail('mainline_node_config', id, `${id} 必须 fallback70Tag=cut_70`);
  }

  // 保护期分布（2026-07-02 拓扑改造：转折点前移到 n018/n019）：N001-N017 active；N018 ending_notice；N019-N150 closed
  for (const id of S7_MAINLINE_NODE_IDS) {
    const row = mainlineById.get(id);
    if (!row) continue;
    const idx = Number(id.slice(1));
    const expected = idx <= 17 ? 'active' : idx === 18 ? 'ending_notice' : 'closed';
    if (row.protectionPeriodTag !== expected) fail('mainline_node_config', id, `protectionPeriodTag 应为 ${expected}`);
  }

  // N018/N019 转折：非战斗节点
  const n018 = mainlineById.get('n018');
  if (n018 && (n018.problemTagRef !== 'none' || n018.templateRef !== 'none')) fail('mainline_node_config', 'n018', 'N018 必须为非战斗节点（templateRef/problemTagRef=none）');
  const n019 = mainlineById.get('n019');
  if (n019 && (n019.problemTagRef !== 'none' || n019.templateRef !== 'none')) fail('mainline_node_config', 'n019', 'N019 必须为非战斗节点（templateRef/problemTagRef=none）');

  // chapter_config：25 章节完整，Boss 章节挂接正确
  const chapterRows = tables.chapter_config;
  const seenChapters = new Set();
  for (const row of chapterRows) {
    const id = row.chapterId;
    seenChapters.add(id);
    if (!S7_STARFIELD_IDS.includes(row.starfieldId)) fail('chapter_config', id, 'starfieldId 非法');
    if (typeof row.nodeRangeTag !== 'string' || !NODE_RANGE_PATTERN.test(row.nodeRangeTag)) fail('chapter_config', id, 'nodeRangeTag 格式非法（应为 nNNN_nNNN）');
    checkRefs('chapter_config', id, 'primaryTemplateTags', row.primaryTemplateTags, templateIds);
    const boss = row.bossRef;
    if (boss !== 'none' && !S7_BOSS_NODE_IDS.includes(boss)) fail('chapter_config', id, 'bossRef 非法');
  }
  for (const id of S7_CHAPTER_IDS) if (!seenChapters.has(id)) fail('chapter_config', id, `缺少章节 ${id}`);
  // 6星域末尾章节（2026-07-02 拓扑改造：ch10/14/17/20/23/25，对应 n060/084/102/120/138/150）
  for (const expected of ['ch10', 'ch14', 'ch17', 'ch20', 'ch23', 'ch25']) {
    const row = chapterRows.find((r) => r.chapterId === expected);
    if (!row || row.bossRef === 'none') fail('chapter_config', expected, `${expected} 必须设置 bossRef`);
  }

  // star_region_config：6 星域完整
  const starRows = tables.star_region_config;
  const seenStarfields = new Set();
  for (const row of starRows) {
    const id = row.starfieldId;
    seenStarfields.add(id);
    if (typeof row.nodeRangeTag !== 'string' || !NODE_RANGE_PATTERN.test(row.nodeRangeTag)) fail('star_region_config', id, 'nodeRangeTag 格式非法（应为 nNNN_nNNN）');
    checkStringArrayEnum('star_region_config', id, 'mainProblemTags', row.mainProblemTags, PROBLEM_TAGS, true);
    checkStringArrayEnum('star_region_config', id, 'reuseProblemTags', row.reuseProblemTags, PROBLEM_TAGS, false);
    if (!PROBLEM_TAGS.includes(row.bossValidationTag)) fail('star_region_config', id, 'bossValidationTag 非法');
    if (!['keep_all', 'cut_1', 'cut_2'].includes(row.fallback70Policy)) fail('star_region_config', id, 'fallback70Policy 非法');
  }
  for (const id of S7_STARFIELD_IDS) if (!seenStarfields.has(id)) fail('star_region_config', id, `缺少星域 ${id}`);

  // boss_node_config：6 Boss 完整，主问题与 mainline 一致，终Boss(N150) 必须 t10
  const bossRows = tables.boss_node_config;
  const seenBoss = new Set();
  for (const row of bossRows) {
    const id = row.bossNodeId;
    seenBoss.add(id);
    if (!S7_BOSS_NODE_IDS.includes(id)) fail('boss_node_config', id, `bossNodeId 必须为 ${S7_BOSS_NODE_IDS.join('/')}`);
    if (!PROBLEM_TAGS.includes(row.mainProblemTag)) fail('boss_node_config', id, 'mainProblemTag 非法');
    checkSingleRef('boss_node_config', id, 'templateRef', row.templateRef, templateIds);
    if (!S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) fail('boss_node_config', id, 'secondaryPressureTag 非法');
    checkRefs('boss_node_config', id, 'previewTagRefs', row.previewTagRefs, tutorialIds);
    if (typeof row.forbiddenMechanicTag !== 'string' || row.forbiddenMechanicTag.length === 0) fail('boss_node_config', id, 'forbiddenMechanicTag 不能为空');
    const mline = mainlineById.get(id);
    if (mline && mline.problemTagRef !== row.mainProblemTag) fail('boss_node_config', id, 'mainProblemTag 必须与 mainline_node_config 对应节点一致');
  }
  for (const id of S7_BOSS_NODE_IDS) if (!seenBoss.has(id)) fail('boss_node_config', id, `缺少 Boss 节点 ${id}`);
  const finalBoss = bossRows.find((r) => r.bossNodeId === 'n150');
  if (finalBoss && finalBoss.templateRef !== 't10') fail('boss_node_config', 'n150', 'N150（终Boss）templateRef 必须为 t10（Boss 狂暴主轴）');

  // tutorial_trigger_config：5 步完整，结构字段与对应主线节点一致
  const tutRows = tables.tutorial_trigger_config;
  const seenTut = new Set();
  for (const row of tutRows) {
    const id = row.tutorialStepId;
    seenTut.add(id);
    const nodeId = row.nodeId;
    const mline = typeof nodeId === 'string' ? mainlineById.get(nodeId) : undefined;
    if (typeof nodeId !== 'string' || !mline) fail('tutorial_trigger_config', id, `nodeId "${nodeId}" 不是有效主线节点`);
    if (!['on_node_enter', 'on_node_complete', 'on_checkpoint_enter'].includes(row.triggerTag)) fail('tutorial_trigger_config', id, 'triggerTag 非法');
    if (typeof row.contentTag !== 'string' || !ID_PATTERN.test(row.contentTag)) fail('tutorial_trigger_config', id, 'contentTag 必须是全小写下划线标签（不写长教程文案）');
    if (!S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) fail('tutorial_trigger_config', id, 'protectionPeriodTag 非法');
    if (!['skippable', 'mandatory_ack'].includes(row.skippableTag)) fail('tutorial_trigger_config', id, 'skippableTag 非法');
    if (mline) {
      if (row.unlockRef !== mline.unlockRef) fail('tutorial_trigger_config', id, 'unlockRef 必须与对应主线节点 unlockRef 一致');
      if (row.protectionPeriodTag !== mline.protectionPeriodTag) fail('tutorial_trigger_config', id, 'protectionPeriodTag 必须与对应主线节点一致');
    }
    const expectedMandatory = ['tut01', 'tut02'].includes(id);
    if (expectedMandatory && row.skippableTag !== 'mandatory_ack') fail('tutorial_trigger_config', id, `${id} 必须为 mandatory_ack`);
    if (!expectedMandatory && row.skippableTag === 'mandatory_ack') fail('tutorial_trigger_config', id, `${id} 不得为 mandatory_ack（仅 TUT01/02）`);
  }
  for (const id of S7_TUTORIAL_STEP_IDS) if (!seenTut.has(id)) fail('tutorial_trigger_config', id, `缺少教程触发 ${id}`);

  // unlock_checkpoint_config：主线 unlockRef 全登记 + 建筑解锁桥接全登记，核心解锁不挂 70 回退节点
  // 条件预留建筑（core_gallery，bld_rsv_*）解锁不纳入默认桥接登记范围。
  const buildingUnlockIds = new Set(
    tables.building_unlock_config
      .filter((r) => !RESERVED_TOKEN_PATTERN.test(String(r.unlockId)) && !RESERVED_TOKEN_PATTERN.test(String(r.cc05aLinkTag)))
      .map((r) => r.unlockId),
  );
  const mainlineUnlockRefs = new Set();
  for (const row of mainlineRows) {
    const u = row.unlockRef;
    if (u !== 'none') mainlineUnlockRefs.add(u);
  }
  const unlockRows = tables.unlock_checkpoint_config;
  const seenUnlock = new Set();
  for (const row of unlockRows) {
    const id = row.unlockRef;
    seenUnlock.add(id);
    const nodeId = row.nodeId;
    if (nodeId !== 'none' && !S7_MAINLINE_NODE_IDS.includes(nodeId)) fail('unlock_checkpoint_config', id, `nodeId "${nodeId}" 非法`);
    if (typeof row.systemTag !== 'string' || row.systemTag.length === 0) fail('unlock_checkpoint_config', id, 'systemTag 不能为空');
    if (typeof row.requiredForMainlineTag !== 'boolean') fail('unlock_checkpoint_config', id, 'requiredForMainlineTag 必须是布尔值');
    if (typeof row.noAdRequiredTag !== 'boolean') fail('unlock_checkpoint_config', id, 'noAdRequiredTag 必须是布尔值');
    const bref = row.buildingUnlockRef;
    if (bref !== 'none' && !buildingUnlockIds.has(bref)) fail('unlock_checkpoint_config', id, `buildingUnlockRef "${bref}" 不存在于 building_unlock_config`);
    if (row.requiredForMainlineTag === true && FORBIDDEN_FALLBACK_NODES.includes(nodeId)) fail('unlock_checkpoint_config', id, `核心解锁不得挂 70 回退可删节点 ${nodeId}`);
  }
  for (const u of mainlineUnlockRefs) if (!seenUnlock.has(u)) fail('unlock_checkpoint_config', u, `主线 unlockRef "${u}" 缺少登记行`);
  const registeredBuildingRefs = new Set(unlockRows.map((r) => r.buildingUnlockRef).filter((v) => v !== 'none'));
  for (const bid of buildingUnlockIds) if (!registeredBuildingRefs.has(bid)) fail('unlock_checkpoint_config', bid, `建筑解锁 "${bid}" 缺少桥接登记行`);

  // protection_reset_config：N018/N019 转折字段必填（2026-07-02 拓扑改造：原N038/N039前移）
  const protRows = tables.protection_reset_config;
  const protById = new Map();
  for (const row of protRows) {
    const id = row.nodeId;
    protById.set(id, row);
    if (!['n018', 'n019'].includes(id)) fail('protection_reset_config', id, 'nodeId 仅允许 n018/n019');
    if (!S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) fail('protection_reset_config', id, 'protectionPeriodTag 非法');
    if (typeof row.freeResetFlag !== 'boolean') fail('protection_reset_config', id, 'freeResetFlag 必须是布尔值');
    if (typeof row.irreversibleWarningFlag !== 'boolean') fail('protection_reset_config', id, 'irreversibleWarningFlag 必须是布尔值');
    if (!Array.isArray(row.resetScopeTags)) fail('protection_reset_config', id, 'resetScopeTags 必须是数组');
    if (!Array.isArray(row.alwaysReversibleTags) || row.alwaysReversibleTags.length === 0) fail('protection_reset_config', id, 'alwaysReversibleTags 不能为空');
  }
  const n018p = protById.get('n018');
  if (!n018p) fail('protection_reset_config', 'n018', '缺少 N018 行');
  else {
    if (n018p.freeResetFlag !== true) fail('protection_reset_config', 'n018', 'N018 freeResetFlag 必须为 true（全队整备 / 免费总重置）');
    if (!Array.isArray(n018p.resetScopeTags) || n018p.resetScopeTags.length === 0) fail('protection_reset_config', 'n018', 'N018 resetScopeTags 不能为空');
  }
  const n019p = protById.get('n019');
  if (!n019p) fail('protection_reset_config', 'n019', '缺少 N019 行');
  else if (n019p.irreversibleWarningFlag !== true) fail('protection_reset_config', 'n019', 'N019 irreversibleWarningFlag 必须为 true（正式养成期提醒）');

  // 红线：T11/T12、PIL/CORE/PLG-RSV、条件预留建筑（core_gallery，含历史 observatory token 防回归）不得进入 Tier C 默认结构
  for (const [name, idField] of Object.entries(TIER_C)) {
    for (const row of tables[name]) {
      const rowId = row[idField] ?? '-';
      for (const [field, value] of Object.entries(row)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string' && RESERVED_TOKEN_PATTERN.test(v)) fail(name, rowId, `${field} 含条件预留 / 奇迹建筑引用 "${v}"，禁止进入默认主线 / 教程 / 解锁 / 完成目标`);
        }
      }
    }
  }
}

// ---- Tier D：桥接表 + 全量 S7 交叉校验（来源 03-CC-05b）----
{
  const mainlineRows = tables.mainline_node_config;
  const mainlineById = new Map();
  for (const row of mainlineRows) mainlineById.set(row.nodeId, row);
  const rewardParamIds = new Set(tables.reward_param.map((r) => r.rowId));

  // reward_pool_ref_config：10 个 rewardAnchorRef 与 mainline_node_config.rewardAnchorRef 双向覆盖（2026-07-02 简化 → 2026-07-03 +reward_first_boss=n030）
  const poolRows = tables.reward_pool_ref_config;
  if (poolRows.length !== 10) fail('reward_pool_ref_config', '-', `必须为 10 行，实际 ${poolRows.length}`);
  const anchorRefsFromMainline = new Set(mainlineRows.map((r) => r.rewardAnchorRef));
  const seenAnchors = new Set();
  for (const row of poolRows) {
    const id = row.rewardAnchorRef;
    if (seenAnchors.has(id)) fail('reward_pool_ref_config', id, 'rewardAnchorRef 重复');
    seenAnchors.add(id);
    if (!S7_REWARD_SOURCE_TAGS.includes(row.sourceTag)) fail('reward_pool_ref_config', id, 'sourceTag 非法');
    if (typeof row.poolRoleTag !== 'string' || !ID_PATTERN.test(row.poolRoleTag)) fail('reward_pool_ref_config', id, 'poolRoleTag 不合法');
    if (row.noAdRequiredTag !== true) fail('reward_pool_ref_config', id, 'noAdRequiredTag 必须为 true');
    if (typeof row.goodItemTag !== 'string' || row.goodItemTag.length === 0) fail('reward_pool_ref_config', id, 'goodItemTag 不能为空');
    if (typeof row.notes !== 'string' || row.notes.length === 0) fail('reward_pool_ref_config', id, 'notes 不能为空');

    if (!Array.isArray(row.nodeRefs) || row.nodeRefs.length === 0) {
      fail('reward_pool_ref_config', id, 'nodeRefs 不能为空');
    } else {
      for (const ref of row.nodeRefs) {
        const mline = mainlineById.get(ref);
        if (!mline) fail('reward_pool_ref_config', id, `nodeRefs 引用的 "${ref}" 不是有效主线节点`);
        else if (mline.rewardAnchorRef !== id) fail('reward_pool_ref_config', id, `主线节点 ${ref} 的 rewardAnchorRef 不是 "${id}"`);
      }
    }

    if (!Array.isArray(row.rewardParamRef)) {
      fail('reward_pool_ref_config', id, 'rewardParamRef 必须是数组');
    } else {
      if (row.sourceTag === 'source_none' && row.rewardParamRef.length !== 0) fail('reward_pool_ref_config', id, 'sourceTag=source_none 时 rewardParamRef 必须为空');
      if (row.sourceTag !== 'source_none' && row.rewardParamRef.length === 0) fail('reward_pool_ref_config', id, 'rewardParamRef 不能为空');
      for (const ref of row.rewardParamRef) if (!rewardParamIds.has(ref)) fail('reward_pool_ref_config', id, `rewardParamRef 引用的 "${ref}" 不存在于 reward_param`);
    }
  }
  for (const anchor of anchorRefsFromMainline) if (!seenAnchors.has(anchor)) fail('reward_pool_ref_config', anchor, `主线引用的 rewardAnchorRef "${anchor}" 缺少桥接登记行`);
  for (const anchor of seenAnchors) if (!anchorRefsFromMainline.has(anchor)) fail('reward_pool_ref_config', anchor, `rewardAnchorRef "${anchor}" 未被任何主线节点引用`);

  // reward_review_comfort（70回退专属安慰奖）随70回退机制一并作废，不再要求存在（2026-07-02）。

  // no_ad_path_check_config：16 个 checkTag 与 S7_NO_AD_CHECK_TAGS（去 none）/ mainline.noAdCheckTag 双向覆盖
  const checkRows = tables.no_ad_path_check_config;
  const expectedCheckTags = S7_NO_AD_CHECK_TAGS.filter((t) => t !== 'none');
  if (checkRows.length !== expectedCheckTags.length) fail('no_ad_path_check_config', '-', `必须为 ${expectedCheckTags.length} 行，实际 ${checkRows.length}`);
  const seenCheckTags = new Set();
  const checkTagsFromMainline = new Set();
  for (const row of mainlineRows) if (row.noAdCheckTag !== 'none') checkTagsFromMainline.add(row.noAdCheckTag);
  for (const row of checkRows) {
    const id = row.checkTag;
    if (!expectedCheckTags.includes(id)) fail('no_ad_path_check_config', id, 'checkTag 不在 S7_NO_AD_CHECK_TAGS 范围内');
    if (seenCheckTags.has(id)) fail('no_ad_path_check_config', id, 'checkTag 重复');
    seenCheckTags.add(id);
    const nodeId = row.nodeId;
    const mline = mainlineById.get(nodeId);
    if (!mline) fail('no_ad_path_check_config', id, `nodeId "${nodeId}" 不是有效主线节点`);
    else if (mline.noAdCheckTag !== id) fail('no_ad_path_check_config', id, `主线节点 ${nodeId} 的 noAdCheckTag 不是 "${id}"`);
    if (FORBIDDEN_FALLBACK_NODES.includes(nodeId)) fail('no_ad_path_check_config', id, `不看广告检查点不得绑定 70 回退可删节点 ${nodeId}`);
    if (typeof row.requiredStateTag !== 'string' || row.requiredStateTag.length === 0 || !ID_PATTERN.test(row.requiredStateTag)) fail('no_ad_path_check_config', id, 'requiredStateTag 不合法');
    checkStringArrayEnum('no_ad_path_check_config', id, 'forbiddenDependencyTag', row.forbiddenDependencyTag, S7_FORBIDDEN_DEPENDENCY_TAGS, true);
  }
  for (const tag of expectedCheckTags) if (!seenCheckTags.has(tag)) fail('no_ad_path_check_config', tag, `缺少检查点 ${tag}`);
  for (const tag of checkTagsFromMainline) if (!seenCheckTags.has(tag)) fail('no_ad_path_check_config', tag, `主线引用的 noAdCheckTag "${tag}" 缺少检查点登记行`);

  // risk_fallback_70_config：与 mainline fallback70Tag != keep_70 的节点双向覆盖，70 回退不可砍关键路径
  const fbRows = tables.risk_fallback_70_config;
  const fallbackNodesFromMainline = mainlineRows.filter((r) => r.fallback70Tag !== 'keep_70').map((r) => r.nodeId);
  if (fbRows.length !== fallbackNodesFromMainline.length) fail('risk_fallback_70_config', '-', `必须为 ${fallbackNodesFromMainline.length} 行，实际 ${fbRows.length}`);
  const seenFbNodes = new Set();
  for (const row of fbRows) {
    const id = row.nodeId;
    if (seenFbNodes.has(id)) fail('risk_fallback_70_config', id, 'nodeId 重复');
    seenFbNodes.add(id);
    const mline = mainlineById.get(id);
    if (!mline) fail('risk_fallback_70_config', id, `nodeId "${id}" 不是有效主线节点`);
    else if (mline.fallback70Tag !== row.fallback70Tag) fail('risk_fallback_70_config', id, `fallback70Tag 必须与主线节点一致（"${mline.fallback70Tag}"）`);
    if (row.fallback70Tag === 'keep_70' || !S7_FALLBACK70_TAGS.includes(row.fallback70Tag)) fail('risk_fallback_70_config', id, 'fallback70Tag 非法（不得为 keep_70）');
    if (row.criticalPathTag !== false) fail('risk_fallback_70_config', id, 'criticalPathTag 必须为 false（70 回退不可砍关键路径）');
    if (typeof row.fallbackReasonTag !== 'string' || row.fallbackReasonTag.length === 0 || !ID_PATTERN.test(row.fallbackReasonTag)) fail('risk_fallback_70_config', id, 'fallbackReasonTag 不合法');
    if (typeof row.replacementRef !== 'string' || row.replacementRef.length === 0 || !ID_PATTERN.test(row.replacementRef)) {
      fail('risk_fallback_70_config', id, 'replacementRef 不合法');
    } else {
      const embedded = row.replacementRef.match(EMBEDDED_NODE_ID_PATTERN) ?? [];
      for (const ref of embedded) {
        if (!mainlineById.has(ref)) fail('risk_fallback_70_config', id, `replacementRef 引用的节点 "${ref}" 不存在（空引用）`);
        else if (FORBIDDEN_FALLBACK_NODES.includes(ref)) fail('risk_fallback_70_config', id, `replacementRef 不得引用 70 回退可删节点 "${ref}"（空引用）`);
      }
    }
  }
  for (const id of fallbackNodesFromMainline) if (!seenFbNodes.has(id)) fail('risk_fallback_70_config', id, `主线 fallback70Tag != keep_70 的节点 "${id}" 缺少回退登记行`);

  // 70 回退完整性：可删节点不得遗留教程 / 解锁引用（防教程断点 / 空引用）
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const mline = mainlineById.get(id);
    if (!mline) continue;
    if (mline.tutorialStepRef !== 'none') fail('mainline_node_config', id, `70 回退可删节点 ${id} 的 tutorialStepRef 必须为 none（防教程断点）`);
    if (mline.unlockRef !== 'none') fail('mainline_node_config', id, `70 回退可删节点 ${id} 的 unlockRef 必须为 none（防空引用）`);
  }

  // 红线：T11/T12、PIL/CORE/PLG-RSV、条件预留建筑（core_gallery，含历史 observatory token 防回归）不得进入桥接表
  for (const [name, idField] of Object.entries(TIER_D)) {
    for (const row of tables[name]) {
      const rowId = row[idField] ?? '-';
      for (const [field, value] of Object.entries(row)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string' && RESERVED_TOKEN_PATTERN.test(v)) fail(name, rowId, `${field} 含条件预留 / 奇迹建筑引用 "${v}"，禁止进入默认桥接配置`);
        }
      }
    }
  }
}

// ---- 轻量实时自动战斗表（BATTLE-RT-03）----
const TIER_BATTLE = {
  battle_unit_stat_param: 'rowId',
  battle_effect_param: 'rowId',
  battle_encounter_param: 'rowId',
  battle_spawn_param: 'rowId',
  battle_boss_phase_param: 'rowId',
};
for (const [name, idField] of Object.entries(TIER_BATTLE)) {
  const rows = load(name); tables[name] = rows;
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail(name, id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(name, id, `${idField} 不符合全小写规则`);
    if (/rsv/.test(String(id))) fail(name, id, 'rowId 含条件预留标识');
    if (seen.has(id)) fail(name, id, `${idField} 重复`); seen.add(id);
  }
}
{
  // prop=场景道具单位（如委托护航运输船·第2.5块）：不属于任何实体真源表，unitRef 恒为 'none'。
  const BATTLE_UNIT_TARGET_TYPES = ['ship', 'enemy', 'boss', 'prop'];
  // ⑥8a 受控并行加法（2026-07-07）：目标族/空间AoE/沉默/免控/cd_refund 新枚举登记（与 ConfigValidatorS7 双份同步改）。
  const BATTLE_UNIT_TARGETING_TAGS = [
    'nearest_random_tie', 'backline_first', 'lowest_hp_ally', 'column_line', 'marked_first',
    'lowest_hp_enemy', 'highest_hp_enemy', 'highest_attack_enemy', 'highest_armor_enemy',
    'key_unit_first', 'lowhp_then_nearest', 'lock_until_dead', 'first_column_first', 'debuffed_first',
    'cross_area', 'block_area',
    // ⑦机制批①：友方目标族（澈/沛/霖/沧）+ 自身区域族（张盾/鼓动）；
    // self_team=引擎既有友方 tag 白名单漏项补录（8a 语义 a：支援舰行级必须可配友方 tag）
    'highest_attack_ally', 'no_buff_ally_first', 'most_debuffed_ally', 'controlled_ally_first',
    'self_cross_area', 'self_block_area', 'self_team',
  ];
  const BATTLE_EFFECT_KINDS = ['normal_attack', 'ultimate', 'core', 'state'];
  const BATTLE_EFFECT_TYPES = [
    'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
    'shield_bubble', 'repair_burst', 'short_circuit_pulse', 'summon_drone',
    'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
    'silence', 'control_immune', 'cd_refund',
    'apply_state', // ⑦机制批①：通用状态施加
    'purify', // ⑨机制批② M5：纯净化/驱散
    'accumulate_attack', // ⑨机制批② M9：运行时属性累积（贪吃星）
  ];
  // ⑦机制批① M1 限时修正状态 tag（stateAmount 必填的框架 tag 集·镜像 ConfigValidatorS7.ts）。
  const MOD_STATE_TAGS = [
    'atk_up', 'atk_down', 'atk_speed_up', 'atk_speed_down', 'armor_down',
    'dmg_up', 'dmg_taken_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
  ];
  // ⑦机制批① M2 周期结算状态 tag（stateTick* 三通道至少配一个 >0）。
  const PERIODIC_STATE_TAGS = ['burn', 'regen'];
  const BATTLE_STATE_TAGS = [
    'none', 'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
    'silence', 'control_immune',
    'debuff_immune', // ⑨机制批② M5：减益免疫
    'taunt', // ⑨机制批② M4：嘲讽
    'reflect', // ⑨机制批② M4：反弹
    'guard', // ⑨机制批② M4：守护替挡
    'share', // ⑨机制批② M4：分摊
    'aura', // ⑨机制批② M6：光环
    'blind', // ⑨机制批② M8：致盲
    ...MOD_STATE_TAGS,
    ...PERIODIC_STATE_TAGS,
  ];
  // ⑦机制批①：extraTriggerBlocks / stackRules 枚举（镜像 ConfigValidatorS7.ts）。
  const TRIGGER_ON_VALUES = [
    'battle_start', 'cd', 'on_kill', 'hp_below', 'on_hit', 'ally_down', 'passive',
    'shield_broken', 'attack_landed', 'skill_cast',
  ];
  const STACK_RULE_ON_VALUES = ['attack_landed', 'was_hit', 'was_hit_by_skill', 'kill', 'per_second', 'hp_lost_decile'];
  const STACK_RULE_STAT_VALUES = ['atkPct', 'atkSpeedPct', 'dmgUpPct', 'dmgTakenDownPct', 'dmgVsLockedPct'];
  // ⑦机制批①：可作为 alsoApplyStateRefs 宿主的 effectType（伤害/护盾/治疗/状态族）。
  const ALSO_APPLY_HOST_TYPES = [
    'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
    'shield', 'shield_bubble', 'repair_burst',
    'short_circuit', 'short_circuit_pulse', 'stun', 'shield_break', 'mark', 'vulnerable', 'berserk',
    'silence', 'control_immune', 'apply_state',
  ];
  // ⑨机制批② M5：可承载 dispelCount（净化/驱散）的 effectType（镜像 ConfigValidatorS7.ts）。
  const DISPEL_HOST_TYPES = ['shield', 'shield_bubble', 'repair_burst', 'purify'];
  const BOSS_PHASE_TAGS = ['start', 'mid', 'final'];
  const BOSS_PHASE_TRIGGER_TYPES = ['battle_start', 'hp_pct_below', 'time_elapsed_sec'];
  // 镜像 assets/scripts/core/s7/S7BattleGrid.ts（敌方 5×7）：改尺寸两处都要改。
  const ENEMY_ROWS = 5, ENEMY_COLS = 7;
  const GRID_SLOT = new RegExp(`^r[0-${ENEMY_ROWS - 1}]c[0-${ENEMY_COLS - 1}]$`);
  const deriveStage = (t) => (t === 'boss' ? 'boss' : t === 'elite' ? 'elite' : 'normal');
  const arrRefs = (name, id, field, value, validIds, nonEmpty) => {
    if (!Array.isArray(value)) { fail(name, id, `${field} 必须是数组`); return; }
    if (nonEmpty && value.length === 0) fail(name, id, `${field} 不能为空`);
    for (const ref of value) if (typeof ref !== 'string' || !validIds.has(ref)) fail(name, id, `${field} 引用的 "${ref}" 不存在`);
  };

  const shipIdSet = new Set(tables.ship_config.map((r) => r.shipId));
  const enemyIdSet = new Set(tables.enemy_schema_config.map((r) => r.enemyId));
  const bossNodeIdSet = new Set(tables.boss_node_config.map((r) => r.bossNodeId));
  const pressureIdSet = new Set(tables.pressure_param.map((r) => r.rowId));
  const mainlineMap = new Map(tables.mainline_node_config.map((r) => [r.nodeId, r]));

  const unitRows = tables.battle_unit_stat_param;
  const effectRows = tables.battle_effect_param;
  const encounterRows = tables.battle_encounter_param;
  const spawnRows = tables.battle_spawn_param;
  const phaseRows = tables.battle_boss_phase_param;

  const unitMap = new Map(unitRows.map((r) => [r.rowId, r]));
  const unitIdSet = new Set(unitMap.keys());
  const effectIdSet = new Set(effectRows.map((r) => r.rowId));
  const effectMap = new Map(effectRows.map((r) => [r.rowId, r]));
  const spawnMap = new Map(spawnRows.map((r) => [r.rowId, r]));
  const spawnIdSet = new Set(spawnMap.keys());
  const phaseMap = new Map(phaseRows.map((r) => [r.rowId, r]));
  const phaseIdSet = new Set(phaseMap.keys());
  const encounterMap = new Map(encounterRows.map((r) => [r.rowId, r]));

  for (const row of unitRows) {
    const id = row.rowId;
    if (!BATTLE_UNIT_TARGET_TYPES.includes(row.targetType)) fail('battle_unit_stat_param', id, 'targetType 非法');
    else if (row.targetType === 'prop') {
      if (row.unitRef !== 'none') fail('battle_unit_stat_param', id, 'prop 类单位 unitRef 必须为 none（不挂实体真源表）');
    } else {
      const set = row.targetType === 'ship' ? shipIdSet : row.targetType === 'enemy' ? enemyIdSet : bossNodeIdSet;
      if (!set.has(row.unitRef)) fail('battle_unit_stat_param', id, `unitRef "${row.unitRef}" 不存在于对应实体表（${row.targetType}）`);
    }
    // positionType（第2.5块·块2 悬赏词缀）：仅 ship 行必填、∈ 5 定位型（灰盒占位·星舰内容块随真源校准）。
    if (row.targetType === 'ship' && !POSITION_TYPES.includes(row.positionType)) fail('battle_unit_stat_param', id, `positionType "${row.positionType}" 非法（玩家星舰必填，允许：${POSITION_TYPES.join('/')}）`);
    for (const f of ['maxHp', 'attack', 'armor', 'attackIntervalSec', 'attackRangeCells']) {
      const v = num(row[f]); if (v === null || v <= 0) fail('battle_unit_stat_param', id, `${f} 必须为正数`);
    }
    const pe = num(row.passiveEnergyPerSec); if (pe === null || pe < 0) fail('battle_unit_stat_param', id, 'passiveEnergyPerSec 必须 >= 0');
    const sr = num(row.sizeRows); if (sr === null || !Number.isInteger(sr) || sr < 1 || sr > 3) fail('battle_unit_stat_param', id, 'sizeRows 必须为 1-3 的整数');
    const sc = num(row.sizeCols); if (sc === null || !Number.isInteger(sc) || sc < 1 || sc > 7) fail('battle_unit_stat_param', id, 'sizeCols 必须为 1-7 的整数');
    if (!BATTLE_UNIT_TARGETING_TAGS.includes(row.targetingTag)) fail('battle_unit_stat_param', id, 'targetingTag 非法（首版至少支持 nearest_random_tie）');
    for (const f of ['normalEffectRef', 'ultimateEffectRef', 'coreEffectRef']) {
      const v = row[f]; if (v !== 'none' && !effectIdSet.has(v)) fail('battle_unit_stat_param', id, `${f} "${v}" 必须为 none 或有效 battle_effect_param.rowId`);
    }
    const ucd = num(row.ultimateCdSec); if (ucd === null || ucd < 0) fail('battle_unit_stat_param', id, 'ultimateCdSec 必须 >= 0（无大招写 0；块2 大招触发冷却）');
    // ⑥8a 可选字段（缺席=不校·存在则查范围）：敌/Boss 行基线词条注入。
    if (row.controlResist !== undefined) {
      const cr = num(row.controlResist);
      if (cr === null || cr < 0 || cr > 1) fail('battle_unit_stat_param', id, 'controlResist（可选）必须在 [0,1]');
    }
    if (row.baseCritRate !== undefined) {
      const bcr = num(row.baseCritRate);
      if (bcr === null || bcr < 0 || bcr > 1) fail('battle_unit_stat_param', id, 'baseCritRate（可选）必须在 [0,1]');
    }
    if (row.baseCritDmg !== undefined) {
      const bcd = num(row.baseCritDmg);
      if (bcd === null || bcd < 0) fail('battle_unit_stat_param', id, 'baseCritDmg（可选）必须 >= 0');
    }
    // ⑦机制批① 单位行可选通道（缺席=不校·镜像 ConfigValidatorS7.ts）：extraTriggerBlocks / stackRules。
    if (row.extraTriggerBlocks !== undefined) {
      if (!Array.isArray(row.extraTriggerBlocks) || row.extraTriggerBlocks.length === 0) {
        fail('battle_unit_stat_param', id, 'extraTriggerBlocks（可选）必须为非空数组');
      } else {
        for (const tb of row.extraTriggerBlocks) {
          if (!tb || typeof tb !== 'object' || tb.kind !== 'trigger') { fail('battle_unit_stat_param', id, 'extraTriggerBlocks 每项必须为 kind="trigger" 的触发积木'); continue; }
          if (!TRIGGER_ON_VALUES.includes(tb.on)) fail('battle_unit_stat_param', id, `extraTriggerBlocks.on "${tb.on}" 非法`);
          if (typeof tb.effectRef !== 'string' || !effectIdSet.has(tb.effectRef)) fail('battle_unit_stat_param', id, `extraTriggerBlocks.effectRef "${tb.effectRef}" 必须为有效 battle_effect_param.rowId`);
          if (tb.on === 'cd') {
            const cd = num(tb.cdSec);
            if (cd === null || !(cd > 0)) fail('battle_unit_stat_param', id, 'extraTriggerBlocks cd 型必须给正数 cdSec');
          }
          if (tb.onKillRoleTags !== undefined && (!Array.isArray(tb.onKillRoleTags) || tb.onKillRoleTags.length === 0 || tb.onKillRoleTags.some((x) => typeof x !== 'string'))) {
            fail('battle_unit_stat_param', id, 'extraTriggerBlocks.onKillRoleTags（可选）必须为非空字符串数组');
          }
        }
      }
    }
    if (row.stackRules !== undefined) {
      if (!Array.isArray(row.stackRules) || row.stackRules.length === 0) {
        fail('battle_unit_stat_param', id, 'stackRules（可选）必须为非空数组');
      } else {
        for (const sr of row.stackRules) {
          if (!sr || typeof sr !== 'object') { fail('battle_unit_stat_param', id, 'stackRules 每项必须为对象'); continue; }
          if (typeof sr.ruleId !== 'string' || sr.ruleId.length === 0) fail('battle_unit_stat_param', id, 'stackRules.ruleId 必须为非空字符串');
          if (!STACK_RULE_ON_VALUES.includes(sr.on)) fail('battle_unit_stat_param', id, `stackRules.on "${sr.on}" 非法`);
          if (!STACK_RULE_STAT_VALUES.includes(sr.stat)) fail('battle_unit_stat_param', id, `stackRules.stat "${sr.stat}" 非法`);
          const ps = num(sr.perStack);
          if (ps === null || !(ps > 0) || !Number.isFinite(ps)) fail('battle_unit_stat_param', id, 'stackRules.perStack 必须为正数');
          if (sr.maxStacks !== undefined) {
            const ms = num(sr.maxStacks);
            if (ms === null || !Number.isInteger(ms) || ms < 1) fail('battle_unit_stat_param', id, 'stackRules.maxStacks（可选）必须为 >= 1 的整数');
          }
          if (sr.breakOn !== undefined && sr.breakOn !== 'attack_gap' && sr.breakOn !== 'target_switch') fail('battle_unit_stat_param', id, 'stackRules.breakOn（可选）必须为 attack_gap | target_switch');
          if (sr.breakOn === 'attack_gap') {
            const gap = num(sr.breakGapSec);
            if (gap === null || !(gap > 0)) fail('battle_unit_stat_param', id, 'stackRules breakOn=attack_gap 必须给正数 breakGapSec');
          }
          if (sr.breakAction !== undefined && sr.breakAction !== 'clear' && sr.breakAction !== 'decay_1') fail('battle_unit_stat_param', id, 'stackRules.breakAction（可选）必须为 clear | decay_1');
        }
      }
    }
  }

  for (const row of effectRows) {
    const id = row.rowId;
    if (!BATTLE_EFFECT_KINDS.includes(row.effectKind)) fail('battle_effect_param', id, 'effectKind 非法');
    if (!BATTLE_EFFECT_TYPES.includes(row.effectType)) fail('battle_effect_param', id, 'effectType 非法');
    const power = num(row.effectPower); if (power === null || power < 0) fail('battle_effect_param', id, 'effectPower 必须 >= 0');
    const mt = num(row.maxTargets); if (mt === null || !Number.isInteger(mt) || mt < 1) fail('battle_effect_param', id, 'maxTargets 必须为 >= 1 的整数');
    const dur = num(row.durationSec); if (dur === null || dur < 0) fail('battle_effect_param', id, 'durationSec 必须 >= 0');
    if (typeof row.targetingTag !== 'string' || !ID_PATTERN.test(row.targetingTag)) fail('battle_effect_param', id, 'targetingTag 不合法');
    if (!BATTLE_STATE_TAGS.includes(row.stateTag)) fail('battle_effect_param', id, 'stateTag 非法');
    else if (row.stateTag !== 'none' && !(dur > 0)) fail('battle_effect_param', id, '状态效果 durationSec 必须为正数');
    if (row.summonUnitRef !== 'none') {
      if (!unitIdSet.has(row.summonUnitRef)) fail('battle_effect_param', id, `summonUnitRef "${row.summonUnitRef}" 必须为 none 或有效 battle_unit_stat_param.rowId`);
      if (!(dur > 0)) fail('battle_effect_param', id, '召唤效果 durationSec 必须为正数');
    }
    // ⑥8a 可选字段（缺席=不校·存在则查范围）：状态施加概率 / 召唤生命周期包。
    if (row.stateChance !== undefined) {
      const scv = num(row.stateChance);
      if (scv === null || scv <= 0 || scv > 1) fail('battle_effect_param', id, 'stateChance（可选）必须在 (0,1]');
      else if (row.stateTag === 'none') fail('battle_effect_param', id, 'stateChance（可选）要求 stateTag ≠ none');
    }
    if (row.summonExpireSec !== undefined) {
      const ses = num(row.summonExpireSec);
      if (ses === null || ses <= 0) fail('battle_effect_param', id, 'summonExpireSec（可选）必须为正数');
      else if (row.summonUnitRef === 'none') fail('battle_effect_param', id, 'summonExpireSec（可选）要求 summonUnitRef ≠ none');
    }
    if (row.despawnWithSource !== undefined) {
      if (typeof row.despawnWithSource !== 'boolean') fail('battle_effect_param', id, 'despawnWithSource（可选）必须为布尔');
      else if (row.summonUnitRef === 'none') fail('battle_effect_param', id, 'despawnWithSource（可选）要求 summonUnitRef ≠ none');
    }
    // ⑦机制批① 字段组（缺席=不校·镜像 ConfigValidatorS7.ts 同名规则）。
    const isModTag = MOD_STATE_TAGS.includes(row.stateTag);
    const isPeriodicTag = PERIODIC_STATE_TAGS.includes(row.stateTag);
    const isFrameworkTag = isModTag || isPeriodicTag;
    if (row.effectType === 'apply_state' && row.stateTag === 'none') fail('battle_effect_param', id, 'apply_state 效果要求 stateTag ≠ none');
    if (isModTag) {
      const amt = num(row.stateAmount);
      if (amt === null || !(amt > 0) || !Number.isFinite(amt)) fail('battle_effect_param', id, `修正状态 ${row.stateTag} 要求 stateAmount 为正数（方向在 tag 名里）`);
    } else if (row.stateAmount !== undefined) {
      fail('battle_effect_param', id, 'stateAmount（可选）仅允许配给 M1 修正状态 tag');
    }
    const tickChannels = ['stateTickAtkPct', 'stateTickMaxHpPct', 'stateTickFlat'];
    if (isPeriodicTag) {
      let anyPositive = false;
      for (const f of tickChannels) {
        if (row[f] === undefined) continue;
        const v = num(row[f]);
        if (v === null || v < 0 || !Number.isFinite(v)) fail('battle_effect_param', id, `${f}（可选）必须为 >= 0 的有限数`);
        else if (v > 0) anyPositive = true;
      }
      if (!anyPositive) fail('battle_effect_param', id, `周期状态 ${row.stateTag} 要求 stateTickAtkPct/stateTickMaxHpPct/stateTickFlat 至少一项 > 0`);
      if (row.stateTickIntervalSec !== undefined) {
        const iv = num(row.stateTickIntervalSec);
        if (iv === null || !(iv > 0)) fail('battle_effect_param', id, 'stateTickIntervalSec（可选）必须为正数');
      }
    } else {
      for (const f of [...tickChannels, 'stateTickIntervalSec']) {
        if (row[f] !== undefined) fail('battle_effect_param', id, `${f}（可选）仅允许配给周期状态 tag（burn/regen）`);
      }
    }
    if (row.stateMaxStacks !== undefined) {
      const sms = num(row.stateMaxStacks);
      if (sms === null || !Number.isInteger(sms) || sms < 1) fail('battle_effect_param', id, 'stateMaxStacks（可选）必须为 >= 1 的整数');
      else if (!isFrameworkTag) fail('battle_effect_param', id, 'stateMaxStacks（可选）仅允许配给框架状态 tag');
    }
    if (row.stateExpireAction !== undefined) {
      if (row.stateExpireAction !== 'clear' && row.stateExpireAction !== 'decay_1') fail('battle_effect_param', id, 'stateExpireAction（可选）必须为 clear | decay_1');
      else if (!isFrameworkTag) fail('battle_effect_param', id, 'stateExpireAction（可选）仅允许配给框架状态 tag');
    }
    if (row.alsoApplyStateRefs !== undefined) {
      const refs = row.alsoApplyStateRefs;
      if (!Array.isArray(refs) || refs.length === 0 || refs.some((r) => typeof r !== 'string')) {
        fail('battle_effect_param', id, 'alsoApplyStateRefs（可选）必须为非空字符串数组');
      } else {
        if (!ALSO_APPLY_HOST_TYPES.includes(row.effectType)) fail('battle_effect_param', id, 'alsoApplyStateRefs（可选）仅允许配在伤害/护盾/治疗/状态类效果行上');
        for (const ref of refs) {
          const sub = effectMap.get(ref);
          if (!sub) { fail('battle_effect_param', id, `alsoApplyStateRefs 引用的 "${ref}" 不存在于 battle_effect_param`); continue; }
          if (ref === id) fail('battle_effect_param', id, 'alsoApplyStateRefs 不允许引用自身');
          if (sub.stateTag === 'none') fail('battle_effect_param', id, `alsoApplyStateRefs 引用的 "${ref}" 必须 stateTag ≠ none`);
          if (sub.alsoApplyStateRefs !== undefined) fail('battle_effect_param', id, `alsoApplyStateRefs 引用的 "${ref}" 自身不得再带 alsoApplyStateRefs（禁链式）`);
        }
      }
    }
    if (row.summonSourceCap !== undefined) {
      const ssc = num(row.summonSourceCap);
      if (ssc === null || !Number.isInteger(ssc) || ssc < 1) fail('battle_effect_param', id, 'summonSourceCap（可选）必须为 >= 1 的整数');
      else if (row.summonUnitRef === 'none') fail('battle_effect_param', id, 'summonSourceCap（可选）要求 summonUnitRef ≠ none');
    }
    // ⑨机制批② M5：净化/驱散字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    let dispelN = null;
    if (row.dispelCount !== undefined) {
      dispelN = num(row.dispelCount);
      if (dispelN === null || !Number.isInteger(dispelN) || dispelN < 1) fail('battle_effect_param', id, 'dispelCount（可选）必须为 >= 1 的整数');
      else if (!DISPEL_HOST_TYPES.includes(row.effectType)) fail('battle_effect_param', id, 'dispelCount（可选）仅允许配在护盾/治疗行或 purify 效果上');
    }
    if (row.effectType === 'purify' && (dispelN === null || dispelN < 1)) fail('battle_effect_param', id, 'purify 效果要求 dispelCount >= 1');
    if (row.dispelHardControl !== undefined) {
      if (typeof row.dispelHardControl !== 'boolean') fail('battle_effect_param', id, 'dispelHardControl（可选）必须为布尔');
      else if (row.dispelCount === undefined) fail('battle_effect_param', id, 'dispelHardControl（可选）要求同时配 dispelCount');
    }
    if (row.applyUndispellable !== undefined) {
      if (typeof row.applyUndispellable !== 'boolean') fail('battle_effect_param', id, 'applyUndispellable（可选）必须为布尔');
      else if (row.stateTag === 'none') fail('battle_effect_param', id, 'applyUndispellable（可选）要求 stateTag ≠ none（标记被施加的状态）');
    }
    // ⑨机制批② M4 reflect 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    const reflectFields = ['reflectPct', 'reflectAtkPct', 'reflectArmorPct', 'blockPct'];
    if (reflectFields.some((f) => row[f] !== undefined) && row.stateTag !== 'reflect') {
      fail('battle_effect_param', id, 'reflect/block 字段（可选）仅允许配给 stateTag=reflect');
    }
    for (const f of reflectFields) {
      if (row[f] === undefined) continue;
      const v = num(row[f]);
      if (v === null || v < 0 || !Number.isFinite(v)) fail('battle_effect_param', id, `${f}（可选）必须为 >= 0 的有限数`);
      else if (f === 'blockPct' && v > 1) fail('battle_effect_param', id, 'blockPct（可选）必须在 [0,1]');
    }
    // ⑨机制批② M4 guard 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    if (row.guardProtect !== undefined) {
      if (row.guardProtect !== 'backline' && row.guardProtect !== 'all') fail('battle_effect_param', id, 'guardProtect（可选）必须为 backline | all');
      else if (row.stateTag !== 'guard') fail('battle_effect_param', id, 'guardProtect（可选）仅允许配给 stateTag=guard');
    }
    if (row.guardCooldownSec !== undefined) {
      const gc = num(row.guardCooldownSec);
      if (gc === null || gc < 0 || !Number.isFinite(gc)) fail('battle_effect_param', id, 'guardCooldownSec（可选）必须为 >= 0 的有限数');
      else if (row.stateTag !== 'guard') fail('battle_effect_param', id, 'guardCooldownSec（可选）仅允许配给 stateTag=guard');
    }
    // ⑨机制批② M4 share 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    if ((row.sharePct !== undefined || row.shareMode !== undefined) && row.stateTag !== 'share') {
      fail('battle_effect_param', id, 'sharePct/shareMode（可选）仅允许配给 stateTag=share');
    }
    if (row.shareMode !== undefined && row.shareMode !== 'adjacent' && row.shareMode !== 'to_caster') {
      fail('battle_effect_param', id, 'shareMode（可选）必须为 adjacent | to_caster');
    }
    if (row.sharePct !== undefined) {
      const sp = num(row.sharePct);
      if (sp === null || sp < 0 || sp > 1) fail('battle_effect_param', id, 'sharePct（可选）必须在 [0,1]');
      else if (row.shareMode !== 'adjacent' && row.shareMode !== 'to_caster') fail('battle_effect_param', id, 'sharePct（可选）要求配 shareMode（adjacent|to_caster）');
    }
    // ⑨机制批② M6 aura 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    const auraFields = ['auraStat', 'auraAmount', 'auraScope', 'auraCondition', 'auraScale'];
    if (auraFields.some((f) => row[f] !== undefined) && row.stateTag !== 'aura') {
      fail('battle_effect_param', id, 'aura* 字段（可选）仅允许配给 stateTag=aura');
    }
    if (row.stateTag === 'aura') {
      if (!['dmgTakenDownPct', 'atkSpeedPct', 'skillHastePct'].includes(row.auraStat)) fail('battle_effect_param', id, 'aura 效果要求 auraStat ∈ dmgTakenDownPct|atkSpeedPct|skillHastePct');
      const av = num(row.auraAmount);
      if (av === null || !Number.isFinite(av)) fail('battle_effect_param', id, 'aura 效果要求 auraAmount 为有限数');
      if (!['self', 'team', 'cross', 'block'].includes(row.auraScope)) fail('battle_effect_param', id, 'aura 效果要求 auraScope ∈ self|team|cross|block');
      if (row.auraCondition !== undefined && !['always', 'has_summon', 'no_enemy_summon'].includes(row.auraCondition)) fail('battle_effect_param', id, 'auraCondition（可选）非法');
      if (row.auraScale !== undefined && row.auraScale !== 'per_lowhp_ally') fail('battle_effect_param', id, 'auraScale（可选）必须为 per_lowhp_ally');
    }
    // ⑨机制批② M7 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    if (row.repeatCount !== undefined) {
      const rc = num(row.repeatCount);
      if (rc === null || !Number.isInteger(rc) || rc < 1) fail('battle_effect_param', id, 'repeatCount（可选）必须为 >= 1 的整数');
    }
    if (row.repeatChance !== undefined) {
      const rch = num(row.repeatChance);
      if (rch === null || rch <= 0 || rch > 1) fail('battle_effect_param', id, 'repeatChance（可选）必须在 (0,1]');
      else if (row.effectKind !== 'normal_attack') fail('battle_effect_param', id, 'repeatChance（可选）仅允许配给普攻行（effectKind=normal_attack）');
    }
    if (row.splashPct !== undefined) {
      const sp = num(row.splashPct);
      if (sp === null || sp < 0 || sp >= 1) fail('battle_effect_param', id, 'splashPct（可选）必须在 [0,1)');
      else if (!['basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke'].includes(row.effectType)) fail('battle_effect_param', id, 'splashPct（可选）仅允许配给伤害行');
    }
    // ⑨机制批② M8 blind 字段组（镜像 ConfigValidatorS7.ts·缺席=不校）。
    if (row.blindChance !== undefined) {
      const bc = num(row.blindChance);
      if (bc === null || bc <= 0 || bc > 1) fail('battle_effect_param', id, 'blindChance（可选）必须在 (0,1]');
      else if (row.stateTag !== 'blind') fail('battle_effect_param', id, 'blindChance（可选）仅允许配给 stateTag=blind');
    }
    if (row.stateTag === 'blind' && (num(row.blindChance) === null || num(row.blindChance) <= 0)) {
      fail('battle_effect_param', id, 'blind 状态要求 blindChance ∈ (0,1]');
    }
  }

  for (const row of encounterRows) {
    const id = row.rowId;
    if (!mainlineMap.has(row.nodeRef)) fail('battle_encounter_param', id, `nodeRef "${row.nodeRef}" 不是有效主线节点`);
    if (!STAGE_TYPES.includes(row.stageType)) fail('battle_encounter_param', id, 'stageType 非法');
    if (!templateIds.has(row.templateRef)) fail('battle_encounter_param', id, `templateRef "${row.templateRef}" 非法（仅 t01-t10）`);
    if (!PROBLEM_TAGS.includes(row.problemTagRef)) fail('battle_encounter_param', id, 'problemTagRef 非法');
    if (!S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) fail('battle_encounter_param', id, 'secondaryPressureTag 非法');
    if (!pressureIdSet.has(row.pressureRef)) fail('battle_encounter_param', id, `pressureRef "${row.pressureRef}" 不存在于 pressure_param`);
    arrRefs('battle_encounter_param', id, 'enemyUnitStatRefs', row.enemyUnitStatRefs, unitIdSet, true);
    arrRefs('battle_encounter_param', id, 'spawnPlanRefs', row.spawnPlanRefs, spawnIdSet, true);
    arrRefs('battle_encounter_param', id, 'bossPhaseRefs', row.bossPhaseRefs, phaseIdSet, false);
    if (row.playerSlotPolicy !== 'five_ship_3x3_default') fail('battle_encounter_param', id, 'playerSlotPolicy 首版必须为 five_ship_3x3_default');
    const tl = num(row.timeLimitSec); if (tl === null || tl <= 0) fail('battle_encounter_param', id, 'timeLimitSec 必须为正数');
    if (row.battleSeedPolicy !== 'node_id_plus_run_seed') fail('battle_encounter_param', id, 'battleSeedPolicy 首版必须为 node_id_plus_run_seed');
    if (row.stageType !== 'boss' && Array.isArray(row.bossPhaseRefs) && row.bossPhaseRefs.length > 0) fail('battle_encounter_param', id, '非 boss 战斗的 bossPhaseRefs 必须为空数组');
    const mline = mainlineMap.get(row.nodeRef);
    if (mline) { const d = deriveStage(mline.nodeTypeTag); if (d !== row.stageType) fail('battle_encounter_param', id, `stageType "${row.stageType}" 与主线节点 nodeTypeTag 推导（${d}）不一致`); }
    if (Array.isArray(row.spawnPlanRefs)) for (const sref of row.spawnPlanRefs) { const s = spawnMap.get(sref); if (s && s.encounterRef !== id) fail('battle_encounter_param', id, `spawnPlanRefs 引用的 "${sref}" 的 encounterRef 不指向本 encounter（双向闭合失败）`); }
    if (Array.isArray(row.bossPhaseRefs)) for (const pref of row.bossPhaseRefs) { const ph = phaseMap.get(pref); if (ph && ph.bossNodeId !== row.nodeRef) fail('battle_encounter_param', id, `bossPhaseRefs 引用的 "${pref}" 不属于 boss 节点 ${row.nodeRef}（双向闭合失败）`); }
  }
  const coveredNodes = new Set(encounterRows.map((r) => r.nodeRef));
  for (const need of ['n001', 'n084', 'n150']) if (!coveredNodes.has(need)) fail('battle_encounter_param', need, `必须覆盖节点 ${need} 的 encounter`);
  const finalEnc = encounterRows.find((r) => r.nodeRef === 'n150');
  if (finalEnc && finalEnc.pressureRef !== 'bp_n150') fail('battle_encounter_param', finalEnc.rowId, 'n150（终Boss）encounter 的 pressureRef 必须为 bp_n150');

  for (const row of spawnRows) {
    const id = row.rowId;
    const enc = encounterMap.get(row.encounterRef);
    if (!enc) fail('battle_spawn_param', id, `encounterRef "${row.encounterRef}" 不存在`);
    const wave = num(row.waveIndex); if (wave === null || !Number.isInteger(wave) || wave < 1) fail('battle_spawn_param', id, 'waveIndex 必须为 >= 1 的整数');
    const unit = unitMap.get(row.unitStatRef);
    if (!unit) fail('battle_spawn_param', id, `unitStatRef "${row.unitStatRef}" 不存在`);
    else if (enc && Array.isArray(enc.enemyUnitStatRefs) && !enc.enemyUnitStatRefs.includes(row.unitStatRef)) fail('battle_spawn_param', id, `unitStatRef "${row.unitStatRef}" 不在 encounter ${row.encounterRef} 的 enemyUnitStatRefs 内`);
    const sd = num(row.spawnDelaySec); if (sd === null || sd < 0) fail('battle_spawn_param', id, 'spawnDelaySec 必须 >= 0');
    const mc = num(row.maxConcurrentOnField); const gridCells = ENEMY_ROWS * ENEMY_COLS; if (mc === null || !Number.isInteger(mc) || mc < 1 || mc > gridCells) fail('battle_spawn_param', id, `maxConcurrentOnField 必须为 1-${gridCells} 的整数`);
    if (!Array.isArray(row.slotRefs)) fail('battle_spawn_param', id, 'slotRefs 必须是数组');
    else {
      const cnt = num(row.count); if (cnt === null || cnt !== row.slotRefs.length) fail('battle_spawn_param', id, `count (${row.count}) 必须等于 slotRefs.length (${row.slotRefs.length})`);
      const anchorsSeen = new Set(); const footprint = new Set();
      const sr = unit ? num(unit.sizeRows) : null; const sc = unit ? num(unit.sizeCols) : null;
      for (const slot of row.slotRefs) {
        if (typeof slot !== 'string' || !GRID_SLOT.test(slot)) { fail('battle_spawn_param', id, `slotRefs 含非法格子 "${slot}"（仅 r0c0..r${ENEMY_ROWS - 1}c${ENEMY_COLS - 1}）`); continue; }
        if (anchorsSeen.has(slot)) fail('battle_spawn_param', id, `slotRefs 含重复格子 "${slot}"`); anchorsSeen.add(slot);
        if (sr !== null && sc !== null) {
          const baseR = Number(slot[1]); const baseC = Number(slot[3]);
          for (let dr = 0; dr < sr; dr += 1) for (let dc = 0; dc < sc; dc += 1) {
            const rr = baseR + dr; const cc = baseC + dc;
            if (rr > ENEMY_ROWS - 1 || cc > ENEMY_COLS - 1) { fail('battle_spawn_param', id, `单位 ${row.unitStatRef} 以 ${slot} 为锚点的 ${sr}x${sc} 占格越界（r${rr}c${cc}）`); continue; }
            const key = `r${rr}c${cc}`;
            if (footprint.has(key)) fail('battle_spawn_param', id, `占格重叠于 ${key}`); footprint.add(key);
          }
        }
      }
    }
  }

  const phaseTagsByBoss = new Map();
  for (const row of phaseRows) {
    const id = row.rowId;
    if (!bossNodeIdSet.has(row.bossNodeId)) fail('battle_boss_phase_param', id, `bossNodeId "${row.bossNodeId}" 不存在`);
    if (!BOSS_PHASE_TAGS.includes(row.phaseTag)) fail('battle_boss_phase_param', id, 'phaseTag 非法');
    if (!BOSS_PHASE_TRIGGER_TYPES.includes(row.triggerType)) fail('battle_boss_phase_param', id, 'triggerType 非法');
    const tv = num(row.triggerValue);
    if (tv === null) fail('battle_boss_phase_param', id, 'triggerValue 必须是数值');
    else if (row.triggerType === 'battle_start' && tv !== 0) fail('battle_boss_phase_param', id, 'battle_start 的 triggerValue 必须为 0');
    arrRefs('battle_boss_phase_param', id, 'effectRefs', row.effectRefs, effectIdSet, true);
    arrRefs('battle_boss_phase_param', id, 'summonUnitRefs', row.summonUnitRefs, unitIdSet, false);
    const cap = num(row.summonCountCap); if (cap === null || !Number.isInteger(cap) || cap < 0 || cap > 10) fail('battle_boss_phase_param', id, 'summonCountCap 必须为 0-10 的整数');
    if (typeof row.bossNodeId === 'string' && typeof row.phaseTag === 'string') { const arr = phaseTagsByBoss.get(row.bossNodeId) ?? []; arr.push(row.phaseTag); phaseTagsByBoss.set(row.bossNodeId, arr); }
  }
  for (const [boss, tags] of phaseTagsByBoss) {
    if (tags.length > 3) fail('battle_boss_phase_param', boss, `Boss ${boss} 最多 3 个阶段，实际 ${tags.length}`);
    if (new Set(tags).size !== tags.length) fail('battle_boss_phase_param', boss, `Boss ${boss} phaseTag 重复（start/mid/final 不可重复）`);
  }
}

// ---- 悬赏词缀（第2.5块·块2 星港悬赏板，GDD S10.8）：positionType/条件/修正积木逐条契约 ----
for (const row of tables.commission_affix_param ?? []) {
  const id = row.rowId;
  if (typeof row.affixName !== 'string' || !row.affixName) fail('commission_affix_param', id, 'affixName 不能为空');
  if (typeof row.effectText !== 'string' || !row.effectText) fail('commission_affix_param', id, 'effectText 不能为空');
  if (!AFFIX_TARGET_TYPES.includes(row.positionType)) fail('commission_affix_param', id, `positionType "${row.positionType}" 非法（允许：${AFFIX_TARGET_TYPES.join('/')}）`);
  const cond = num(row.condLineupMax);
  if (cond === null || !Number.isInteger(cond) || cond < 0) fail('commission_affix_param', id, 'condLineupMax 必须为 >=0 的整数（0=无条件）');
  if (!Array.isArray(row.mods) || row.mods.length === 0) { fail('commission_affix_param', id, 'mods 必须为非空数组'); continue; }
  for (const mod of row.mods) {
    if (!mod || typeof mod !== 'object') { fail('commission_affix_param', id, 'mods 含非对象项'); continue; }
    if (num(mod.value) === null) fail('commission_affix_param', id, 'mod.value 必须为数值');
    if (mod.channel === 'stat') {
      if (!STAT_KEYS.includes(mod.key)) fail('commission_affix_param', id, `stat mod.key "${mod.key}" 非法`);
      if (mod.op !== undefined && mod.op !== 'flat' && mod.op !== 'pct') fail('commission_affix_param', id, 'stat mod.op 仅允许 flat/pct');
    } else if (mod.channel === 'affix') {
      if (!AFFIX_KEYS.includes(mod.key)) fail('commission_affix_param', id, `affix mod.key "${mod.key}" 非法`);
    } else {
      fail('commission_affix_param', id, `mod.channel "${mod.channel}" 非法（允许 stat/affix）`);
    }
  }
}

// ---- 每日推演（第2.5块·块4）：静态那道闸(c 候选数∈[6,8]) + 结构合法。
//   要真跑引擎的两道闸(a 作者解回放 / b 蒙特卡洛乱选率<30%) 在 vitest s7_daily_puzzle_solver.test.ts
//   （.mjs 跑不了 TS 引擎·本工程既定形状）。两扇门同在 npm run gate——坏题必被拦、Codex 加题跑一次全自动验。
{
  const PUZZLE_THREAT_TYPES = ['backline', 'shield', 'summon', 'heal', 'burst', 'swarm', 'berserk', 'mixed'];
  const PUZZLE_QUALITIES = ['fine', 'superior', 'legendary'];
  const PLAYER_SLOT = /^p[0-2]c[0-2]$/;
  const ENEMY_SLOT = /^r[0-4]c[0-6]$/;
  const PUZZLE_MIN_CAND = 6, PUZZLE_MAX_CAND = 8, PUZZLE_LINEUP = 5;
  const enemyUnitIds = new Set((tables.battle_unit_stat_param ?? []).filter((r) => r.targetType === 'enemy').map((r) => r.rowId));
  const rows = load('daily_puzzle_param'); tables.daily_puzzle_param = rows;
  if (rows.length < 5) fail('daily_puzzle_param', '-', `首发样题至少 5 道，实际 ${rows.length}`);
  const seenPuzzle = new Set();
  for (const row of rows) {
    const id = row.rowId;
    if (!row.schemaVersion || typeof row.schemaVersion !== 'string') fail('daily_puzzle_param', id, '缺少合法 schemaVersion');
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) { fail('daily_puzzle_param', id, 'rowId 不符合全小写规则'); continue; }
    if (seenPuzzle.has(id)) fail('daily_puzzle_param', id, 'rowId 重复'); seenPuzzle.add(id);
    if (!PUZZLE_THREAT_TYPES.includes(row.threatType)) fail('daily_puzzle_param', id, `threatType "${row.threatType}" 非法`);
    if (typeof row.threatHint !== 'string' || !row.threatHint) fail('daily_puzzle_param', id, 'threatHint 不能为空');
    if (!Array.isArray(row.enemyFormation) || row.enemyFormation.length === 0) fail('daily_puzzle_param', id, 'enemyFormation 必须为非空数组');
    else {
      const eslots = new Set();
      for (const e of row.enemyFormation) {
        if (!e || typeof e !== 'object') { fail('daily_puzzle_param', id, 'enemyFormation 含非对象项'); continue; }
        if (!enemyUnitIds.has(e.unitStatRef)) fail('daily_puzzle_param', id, `enemyFormation.unitStatRef "${e.unitStatRef}" 不是 enemy 战斗单位`);
        if (typeof e.slotRef !== 'string' || !ENEMY_SLOT.test(e.slotRef)) fail('daily_puzzle_param', id, `enemyFormation.slotRef "${e.slotRef}" 非法（r0c0..r4c6）`);
        else if (eslots.has(e.slotRef)) fail('daily_puzzle_param', id, `enemyFormation.slotRef "${e.slotRef}" 重复`); else eslots.add(e.slotRef);
      }
    }
    for (const f of ['enemyHpPct', 'enemyAtkPct']) if (row[f] !== undefined && num(row[f]) === null) fail('daily_puzzle_param', id, `${f} 必须为数值`);
    const packs = row.candidatePacks;
    const packIds = new Set();
    if (!Array.isArray(packs)) fail('daily_puzzle_param', id, 'candidatePacks 必须为数组');
    else {
      if (packs.length < PUZZLE_MIN_CAND || packs.length > PUZZLE_MAX_CAND) fail('daily_puzzle_param', id, `候选战队包数量必须∈[${PUZZLE_MIN_CAND},${PUZZLE_MAX_CAND}]（闸 c），实际 ${packs.length}`);
      for (const pk of packs) {
        if (!pk || typeof pk !== 'object') { fail('daily_puzzle_param', id, 'candidatePacks 含非对象项'); continue; }
        if (typeof pk.packId !== 'string' || !pk.packId) fail('daily_puzzle_param', id, 'pack.packId 不能为空');
        else if (packIds.has(pk.packId)) fail('daily_puzzle_param', id, `pack.packId "${pk.packId}" 重复`); else packIds.add(pk.packId);
        if (!shipIds.has(pk.shipId)) fail('daily_puzzle_param', id, `pack.shipId "${pk.shipId}" 不存在`);
        if (!pilotIds.has(pk.pilotId)) fail('daily_puzzle_param', id, `pack.pilotId "${pk.pilotId}" 不存在`);
        if (pk.coreId !== undefined && !coreIds.has(pk.coreId)) fail('daily_puzzle_param', id, `pack.coreId "${pk.coreId}" 不存在`);
        if (pk.plugins !== undefined) {
          if (!Array.isArray(pk.plugins) || pk.plugins.length > 3) fail('daily_puzzle_param', id, 'pack.plugins 必须为数组且≤3');
          else for (const pl of pk.plugins) {
            if (!pl || !pluginIds.has(pl.pluginId)) fail('daily_puzzle_param', id, `pack.plugin "${pl?.pluginId}" 不存在`);
            if (!pl || !PUZZLE_QUALITIES.includes(pl.quality)) fail('daily_puzzle_param', id, `pack.plugin.quality "${pl?.quality}" 非法（fine/superior/legendary）`);
          }
        }
      }
    }
    const sol = row.authorSolution;
    if (!Array.isArray(sol) || sol.length !== PUZZLE_LINEUP) fail('daily_puzzle_param', id, `authorSolution 必须正好 ${PUZZLE_LINEUP} 项，实际 ${Array.isArray(sol) ? sol.length : '非数组'}`);
    else {
      const pslots = new Set();
      for (const s of sol) {
        if (!s || !packIds.has(s.packId)) fail('daily_puzzle_param', id, `authorSolution.packId "${s?.packId}" 不在候选内`);
        if (!s || typeof s.slotRef !== 'string' || !PLAYER_SLOT.test(s.slotRef)) fail('daily_puzzle_param', id, `authorSolution.slotRef "${s?.slotRef}" 非法（p0c0..p2c2）`);
        else if (pslots.has(s.slotRef)) fail('daily_puzzle_param', id, `authorSolution.slotRef "${s.slotRef}" 重复`); else pslots.add(s.slotRef);
      }
    }
  }
}

// 全局：powerIndex 仅允许出现在 power_reference_param
for (const [name, rows] of Object.entries(tables)) {
  if (name === 'power_reference_param') continue;
  for (const row of rows) if (Object.prototype.hasOwnProperty.call(row, 'powerIndex')) fail(name, row.rowId ?? '-', 'powerIndex 仅允许出现在 power_reference_param');
}

const version = tables.battle_template_config[0]?.schemaVersion ?? 'unknown';
console.log(`loaded s7 config version ${version}`);
if (errors.length > 0) {
  console.error(`s7 config validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('all s7 configs valid (45 tables: tier A 5 + tier B 12 params + 1 growth + 5 relation/schema + 5 building + tier C 7 mainline/tutorial/unlock + tier D 3 bridge tables + 5 realtime battle tables + 1 commission affix table + 1 daily puzzle table)');
