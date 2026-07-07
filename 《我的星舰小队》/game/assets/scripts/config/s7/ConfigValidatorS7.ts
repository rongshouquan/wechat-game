// S7 配置校验器（运行时 + vitest 共用真源；与流程版 ConfigValidator.ts 隔离）。
// Tier A（5 叶子表）：数量严格、ID 唯一全小写、白名单、预留硬禁用、枚举、交叉引用。
// Tier B（12 参数/支撑表）：rowId 唯一全小写、schemaVersion、逐表数值/口径校验。
// 全局：powerIndex 仅允许出现在 power_reference_param。
// 数值口径转写自 03-04 v0.2，不做平衡。

import {
  S7ConfigBundle,
  S7ConfigTableName,
  S7_ID_FIELD,
} from './ConfigTypesS7';
// 战场网格尺寸单一真源（敌方 5×7）；锚点格上界由此派生，改尺寸只改 S7BattleGrid.ts。
import { S7_ENEMY_ROWS, S7_ENEMY_COLS } from '../../core/s7/S7BattleGrid';
// 悬赏词缀定位型真源（5 定位型 + 'all'）；positionType/词缀 positionType 校验共用（第2.5块·块2）。
import { S7_POSITION_TYPES, S7_AFFIX_TARGET_TYPES } from '../../core/s7/S7CommissionAffix';

// 词缀 mod 的合法 stat/affix 键（镜像 core/s7/S7BattleEffectBlock.ts 的 S7StatKey/S7AffixKey）。
const S7_STAT_KEYS = ['maxHp', 'attack', 'armor', 'attackIntervalSec', 'attackRangeCells', 'passiveEnergyPerSec'];
const S7_AFFIX_KEYS = ['critRate', 'critDmg', 'shieldBreak', 'skillHaste', 'healPower', 'controlResist', 'dmgVsSwarm', 'dmgVsBoss'];

export interface S7ValidationError {
  table: string;
  id: string;
  message: string;
}

const ID_PATTERN = /^[a-z0-9_]+$/;

export const S7_PROBLEM_TAGS = ['swarm', 'shield', 'backline', 'burst', 'berserk', 'summon'];
const S7_STAGE_TYPES = ['normal', 'elite', 'boss'];
const S7_SHIP_TYPES = ['free', 'stream'];
const S7_PLUGIN_SLOTS = ['weapon', 'skill', 'tactical'];

// 资源词表（钱包全集，块6余项扩键）：奖励发放(reward_param.resourceId)按此校验，与 S7SaveService.S7_RESOURCE_KEYS 对齐。
// 6a-2 删废弃币 battleLog/pluginMat/coreMat；块6余项 +starGem/pilotShardUniversal、信标拆 3 档 beaconCommon/Rare/Epic（撤 beacon）；
// 块5 +adTicket（广告券·只从商人星贝购买，不进关卡/活动奖励，但词表与钱包全集保持对齐）。
const RESOURCE_VOCAB = [
  'starOre', 'hullAlloy', 'shipBlueprint', 'pilotShardUniversal', 'pilotToken',
  'coreFrag', 'fullCore', 'starGem', 'supplyTicket',
  'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket',
];
// 免费毕业预算追踪子集（free_resource_anchor_param 列集）：只盯核心软货币——与钱包全集解耦，
// 故扩钱包(starGem/信标 3 档等)不再被逼填毕业预算数值；信标经济交第二块·信标打捞数值表后再议是否纳入。
const ANCHOR_BUDGET_KEYS = [
  'starOre', 'hullAlloy', 'shipBlueprint', 'pilotToken',
  'coreFrag', 'fullCore', 'supplyTicket', 'starCargo',
];
const REWARD_SOURCE_TYPES = [
  'mainline', 'boss', 'action3', 'expansion7', 'salvage', 'range', 'supply', 'beacon', 'star_cargo',
];
const ANCHOR_DAYS = ['d7', 'd14', 'd21', 'd28'];

type TierATable = 'battle_template_config' | 'ship_config' | 'pilot_config' | 'core_config' | 'plugin_config';

const TIER_A_TABLES: TierATable[] = ['battle_template_config', 'ship_config', 'pilot_config', 'core_config', 'plugin_config'];

const TIER_B_TABLES: S7ConfigTableName[] = [
  'source_tag_config', 'power_reference_param', 'free_resource_anchor_param', 'upgrade_cost_param',
  'enhance_cost_param', 'refund_param', 'pressure_param', 'reward_param', 'shop_param',
  'merchant_refresh_param', 'recycle_param', 'anti_arbitrage_check',
  'commission_affix_param', 'daily_puzzle_param',
];

// 成长段位参数表（CC-07E-1）：rowId 主键，与 Tier B 参数表同族；逐表数值/口径由 validateGrowth 校验。
const TIER_GROWTH_TABLES: S7ConfigTableName[] = ['growth_band_param'];

// 首发成长段只剩 ship/pilot：插件不分等级（§5.3）、星核砍 5 阶强化（§5.4，留 P1）→ 均无成长段。
const S7_GROWTH_TARGET_TYPES = ['ship', 'pilot'];
const S7_GROWTH_CURVE_TYPES = ['band_linear', 'control_point'];
const S7_GROWTH_SECONDARY_KINDS = ['stat', 'affix', 'effect', 'none'];
const S7_GROWTH_EXPECTED_SECONDARY: Record<string, string> = {
  ship: 'stat', pilot: 'none',
};

// 轻量实时自动战斗表（BATTLE-RT-03）：rowId 主键，与参数表同族通用校验；逐表契约由 validateBattle 校验。
const TIER_BATTLE_TABLES: S7ConfigTableName[] = [
  'battle_unit_stat_param', 'battle_effect_param', 'battle_encounter_param',
  'battle_spawn_param', 'battle_boss_phase_param',
];
// prop=场景道具单位（如委托护航运输船·第2.5块）：不属于任何实体真源表，unitRef 恒为 'none'。
const S7_BATTLE_UNIT_TARGET_TYPES = ['ship', 'enemy', 'boss', 'prop'];
// ⑥8a 受控并行加法（2026-07-07）：目标族/空间AoE/沉默/免控/cd_refund 新枚举登记（与 .mjs 校验器双份同步改）。
const S7_BATTLE_UNIT_TARGETING_TAGS = [
  'nearest_random_tie', 'backline_first', 'lowest_hp_ally', 'column_line', 'marked_first',
  'lowest_hp_enemy', 'highest_hp_enemy', 'highest_attack_enemy', 'highest_armor_enemy',
  'key_unit_first', 'lowhp_then_nearest', 'lock_until_dead', 'first_column_first', 'debuffed_first',
  'cross_area', 'block_area',
  // ⑦机制批①：友方目标族（澈/沛/霖/沧）+ 自身区域族（张盾/鼓动）
  'highest_attack_ally', 'no_buff_ally_first', 'most_debuffed_ally', 'controlled_ally_first',
  'self_cross_area', 'self_block_area',
  // ⑥第一段：春风群奶普攻=行级友方全体（引擎 selectTargets 既有分支）
  'self_team',
];
const S7_BATTLE_EFFECT_KINDS = ['normal_attack', 'ultimate', 'core', 'state'];
const S7_BATTLE_EFFECT_TYPES = [
  'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
  'shield_bubble', 'repair_burst', 'short_circuit_pulse', 'summon_drone',
  'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
  'silence', 'control_immune', 'cd_refund',
  'apply_state', // ⑦机制批①：通用状态施加
  'purify', // ⑨机制批② M5：纯净化/驱散（无伤无治·dispelCount 移除减益/增益）
];
// ⑦机制批① M1 限时修正状态 tag（stateAmount 必填的框架 tag 集）。
const S7_MOD_STATE_TAGS = [
  'atk_up', 'atk_down', 'atk_speed_up', 'atk_speed_down', 'armor_down',
  'dmg_up', 'dmg_taken_up', 'dmg_taken_down', 'crit_rate_up', 'crit_dmg_up', 'skill_haste_up',
];
// ⑦机制批① M2 周期结算状态 tag（stateTick* 三通道至少配一个 >0）。
const S7_PERIODIC_STATE_TAGS = ['burn', 'regen'];
const S7_BATTLE_STATE_TAGS = [
  'none', 'shield', 'shield_break', 'mark', 'vulnerable', 'short_circuit', 'stun', 'summon', 'berserk',
  'silence', 'control_immune',
  'debuff_immune', // ⑨机制批② M5：减益免疫（增益·挡一切新减益）
  ...S7_MOD_STATE_TAGS,
  ...S7_PERIODIC_STATE_TAGS,
];
// ⑦机制批①：触发积木 on 取值（extraTriggerBlocks 单位行通道校验用·与 S7TriggerBlock 对齐）。
const S7_TRIGGER_ON_VALUES = [
  'battle_start', 'cd', 'on_kill', 'hp_below', 'on_hit', 'ally_down', 'passive',
  'shield_broken', 'attack_landed', 'skill_cast',
];
// ⑦机制批① M3 叠层规则枚举（unit 行 stackRules 校验用·与 S7StackRuleParam 对齐）。
const S7_STACK_RULE_ON_VALUES = ['attack_landed', 'was_hit', 'was_hit_by_skill', 'kill', 'per_second', 'hp_lost_decile'];
const S7_STACK_RULE_STAT_VALUES = ['atkPct', 'atkSpeedPct', 'dmgUpPct', 'dmgTakenDownPct', 'dmgVsLockedPct'];
/** ⑦机制批①：可作为 alsoApplyStateRefs 宿主的 effectType（伤害/护盾/治疗/状态族；召唤与 cd_refund 不结算追加状态）。 */
const S7_ALSO_APPLY_HOST_TYPES = [
  'basic_damage', 'clear_barrage', 'line_pierce', 'backline_strike', 'burst_nuke',
  'shield', 'shield_bubble', 'repair_burst',
  'short_circuit', 'short_circuit_pulse', 'stun', 'shield_break', 'mark', 'vulnerable', 'berserk',
  'silence', 'control_immune', 'apply_state',
];
/** ⑨机制批② M5：可承载 dispelCount（净化/驱散）的 effectType——护盾/治疗行附带净化，或 purify 纯净化主体。 */
const S7_DISPEL_HOST_TYPES = ['shield', 'shield_bubble', 'repair_burst', 'purify'];
const S7_BOSS_PHASE_TAGS = ['start', 'mid', 'final'];
const S7_BOSS_PHASE_TRIGGER_TYPES = ['battle_start', 'hp_pct_below', 'time_elapsed_sec'];
// 敌方战场锚点格 r0c0..r{rows-1}c{cols-1}（当前 5 行 x 7 列；尺寸真源见 core/s7/S7BattleGrid.ts）。
// 正则按个位行列数构造（≤10）。
const BATTLE_GRID_SLOT_PATTERN = new RegExp(`^r[0-${S7_ENEMY_ROWS - 1}]c[0-${S7_ENEMY_COLS - 1}]$`);

// Tier B 关系 / schema 表：与参数表平行，但 idField 各异（非 rowId），引用只指向已落 Tier A 实体。
const TIER_B_REL_TABLES: S7ConfigTableName[] = [
  'enemy_schema_config', 'boss_skeleton_config', 'prebattle_preview_config',
  'ship_pilot_fit_config', 'core_plugin_fit_config',
];

// Tier B 建筑表（来源 BUILDING-02）：idField 各异；bld_rsv_* 是合法建筑行，不沿用 rsv 硬禁。
const TIER_B_BLD_TABLES: S7ConfigTableName[] = [
  'building_config', 'building_unlock_config', 'building_level_cost_param',
  'building_level_effect_param', 'building_anchor_impact_check',
];

const BUILDING_GROUPS = ['core_growth', 'pilot_growth', 'base_comfort', 'supply_comfort', 'resource_comfort', 'merchant_comfort', 'minor_growth', 'showcase'];
const BUILDING_NO_AD_ROLES = ['entry_only', 'optional_support', 'non_core', 'none'];
const BUILDING_RELEASE_TAGS = ['default_release', 'conditional_post'];
const BUILDING_DEFAULT_KEYS = ['dock', 'pilot_training_bay', 'habitat', 'supply_station', 'salvage_port', 'merchant_station', 'research_tower'];
const BUILDING_RESERVED_KEYS = ['core_gallery'];
const BUILDING_ANCHOR_DAYS = ['D7', 'D14', 'D21', 'D28'];
// 70 回退机制已作废（Codex 旧遗留，2026-07-02 随150关拓扑改造一并清理）：恒为空，任何节点不得 cut_70。
const FORBIDDEN_FALLBACK_NODES: string[] = [];

function seq(prefix: string, from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${i < 10 ? '0' : ''}${i}`);
  return out;
}

function seq3(prefix: string, from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${String(i).padStart(3, '0')}`);
  return out;
}

// Tier C（主线节点 / 教程 / 解锁结构表，来源 03-05）：idField 各异，沿用关系/schema 表通用校验。
const TIER_C_TABLES: S7ConfigTableName[] = [
  'mainline_node_config', 'chapter_config', 'star_region_config', 'boss_node_config',
  'tutorial_trigger_config', 'unlock_checkpoint_config', 'protection_reset_config',
];

// 150关拓扑改造（2026-07-02，GDD-v2.0 S2/S14 毕业节奏建模确认）：6星域/25章节/6Boss/150节点。
const S7_MAINLINE_NODE_IDS = seq3('n', 1, 150);
const S7_CHAPTER_IDS = seq('ch', 1, 25);
const S7_STARFIELD_IDS = seq('sf', 1, 6);
// n030=第5章章末剧情首Boss（Ron 2026-07-03，掉陨星弹/解锁展厅+回廊）；6 墙(n060/084/102/120/138/150) 数量不变，n030 是第7个 boss 类型节点。
const S7_BOSS_NODE_IDS = ['n030', 'n060', 'n084', 'n102', 'n120', 'n138', 'n150'];
// 真实强引导教程只覆盖 n001-n005（见 S7DemoController runTutorialStep），此表不再铺到后面的 Codex 旧占位步骤。
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

// 简化为每个大Boss一个不看广告检查点（原16个绑定旧75节点具体位置，随拓扑改造一并简化，2026-07-02）。
const S7_NO_AD_CHECK_TAGS = [
  'none', 'no_ad_boss1_check', 'no_ad_boss2_check', 'no_ad_boss3_check',
  'no_ad_boss4_check', 'no_ad_boss5_check', 'no_ad_boss6_check',
];

const S7_PROTECTION_TAGS = ['active', 'ending_notice', 'closed'];
const S7_FALLBACK70_TAGS = ['keep_70', 'cut_70', 'merge_70_to_t01', 'merge_70_to_t05'];
const NODE_RANGE_PATTERN = /^n\d{3}_n\d{3}$/;
const RESERVED_TOKEN_PATTERN = /(rsv|observatory|core_gallery)/;

// Tier D（桥接表，来源 CC-05b：03-CC-05b 指令 + D2 补丁）：idField 各异，沿用关系/schema 表通用校验。
const TIER_D_TABLES: S7ConfigTableName[] = [
  'reward_pool_ref_config', 'no_ad_path_check_config', 'risk_fallback_70_config',
];

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

// replacementRef 中嵌入的主线节点 ID（如 n045_n050_summon_reuse 中的 n045/n050）。
const EMBEDDED_NODE_ID_PATTERN = /n\d{3}/g;

export const S7_EXPECTED_COUNT: Record<TierATable, number> = {
  battle_template_config: 10,
  // ⑥第一段 20 舰落地（2026-07-07·细表§12）：默认盘 12→20（真源首发 20 舰·shp01-20 映射记细表）。
  ship_config: 20,
  pilot_config: 10,
  core_config: 7,
  plugin_config: 18,
};

export const S7_DEFAULT_IDS: Record<TierATable, string[]> = {
  battle_template_config: seq('t', 1, 10),
  ship_config: seq('shp', 1, 20), // ⑥第一段：12→20
  pilot_config: seq('pil', 1, 10),
  core_config: seq('core', 1, 7),
  plugin_config: seq('plg', 1, 18),
};

function isReservedTierAId(table: TierATable, id: string): boolean {
  if (table === 'battle_template_config' && (id === 't11' || id === 't12')) return true;
  return /rsv/.test(id);
}

function asRow(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function checkStringArrayEnum(
  errors: S7ValidationError[], table: string, id: string, field: string,
  value: unknown, allowed: string[], requireNonEmpty: boolean,
): void {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} 必须是数组` });
    return;
  }
  if (requireNonEmpty && value.length === 0) errors.push({ table, id, message: `${field} 不能为空` });
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item)) {
      errors.push({ table, id, message: `${field} 含非法值 "${String(item)}"（允许：${allowed.join('/')}）` });
    }
  }
}

function checkRefs(
  errors: S7ValidationError[], table: string, id: string, field: string,
  value: unknown, validIds: Set<string>,
): void {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} 必须是数组` });
    return;
  }
  for (const ref of value) {
    if (typeof ref !== 'string') {
      errors.push({ table, id, message: `${field} 含非字符串引用` });
    } else if (/rsv/.test(ref) || ref === 't11' || ref === 't12') {
      errors.push({ table, id, message: `${field} 引用了条件预留项 "${ref}"，禁止进入默认配置` });
    } else if (!validIds.has(ref)) {
      errors.push({ table, id, message: `${field} 引用的 "${ref}" 不存在于默认实体表` });
    }
  }
}

function validateTierACommon(
  errors: S7ValidationError[], table: TierATable, rows: unknown[],
): Record<string, unknown>[] {
  const idField = S7_ID_FIELD[table];
  const expected = S7_EXPECTED_COUNT[table];
  const whitelist = new Set(S7_DEFAULT_IDS[table]);
  if (rows.length !== expected) {
    errors.push({ table, id: '-', message: `数量必须为 ${expected}，实际 ${rows.length}` });
  }
  const seen = new Set<string>();
  const validRows: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = asRow(raw);
    if (!row) {
      errors.push({ table, id: '-', message: '配置行必须是对象' });
      continue;
    }
    validRows.push(row);
    const idValue = row[idField];
    const id = typeof idValue === 'string' ? idValue : String(idValue);
    if (typeof row.schemaVersion !== 'string' || row.schemaVersion.length === 0) {
      errors.push({ table, id, message: '缺少合法 schemaVersion' });
    }
    if (typeof idValue !== 'string' || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" 不符合全小写英文/数字/下划线规则` });
    }
    if (seen.has(id)) errors.push({ table, id, message: 'ID 重复' });
    seen.add(id);
    if (isReservedTierAId(table, id)) errors.push({ table, id, message: '条件预留项禁止进入默认配置行 / 默认池' });
    if (!whitelist.has(id)) errors.push({ table, id, message: `${id} 不在默认白名单内，禁止进入默认配置` });
  }
  return validRows;
}

function validateTierBCommon(
  errors: S7ValidationError[], table: S7ConfigTableName, rows: unknown[],
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const validRows: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = asRow(raw);
    if (!row) {
      errors.push({ table, id: '-', message: '配置行必须是对象' });
      continue;
    }
    validRows.push(row);
    const idValue = row.rowId;
    const id = typeof idValue === 'string' ? idValue : String(idValue);
    if (typeof row.schemaVersion !== 'string' || row.schemaVersion.length === 0) {
      errors.push({ table, id, message: '缺少合法 schemaVersion' });
    }
    if (typeof idValue !== 'string' || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `rowId "${id}" 不符合全小写英文/数字/下划线规则` });
    }
    if (/rsv/.test(id)) errors.push({ table, id, message: 'rowId 含条件预留标识，禁止进入参数表' });
    if (seen.has(id)) errors.push({ table, id, message: 'rowId 重复' });
    seen.add(id);
  }
  return validRows;
}

function validateTierBRelCommon(
  errors: S7ValidationError[], table: S7ConfigTableName, rows: unknown[],
): Record<string, unknown>[] {
  const idField = S7_ID_FIELD[table];
  const seen = new Set<string>();
  const validRows: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = asRow(raw);
    if (!row) {
      errors.push({ table, id: '-', message: '配置行必须是对象' });
      continue;
    }
    validRows.push(row);
    const idValue = row[idField];
    const id = typeof idValue === 'string' ? idValue : String(idValue);
    if (typeof row.schemaVersion !== 'string' || row.schemaVersion.length === 0) {
      errors.push({ table, id, message: '缺少合法 schemaVersion' });
    }
    if (typeof idValue !== 'string' || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" 不符合全小写英文/数字/下划线规则` });
    }
    if (/rsv/.test(id) || id === 't11' || id === 't12') errors.push({ table, id, message: '条件预留标识禁止进入关系/schema 表主键' });
    if (seen.has(id)) errors.push({ table, id, message: `${idField} 重复` });
    seen.add(id);
  }
  return validRows;
}

function checkSingleRef(
  errors: S7ValidationError[], table: string, id: string, field: string,
  value: unknown, validIds: Set<string>,
): void {
  if (typeof value !== 'string') {
    errors.push({ table, id, message: `${field} 必须是字符串引用` });
  } else if (/rsv/.test(value) || value === 't11' || value === 't12') {
    errors.push({ table, id, message: `${field} 引用了条件预留项 "${value}"，禁止进入默认配置` });
  } else if (!validIds.has(value)) {
    errors.push({ table, id, message: `${field} 引用的 "${value}" 不存在于默认实体表` });
  }
}

function validateTierBRel(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
  ids: { ships: Set<string>; pilots: Set<string>; cores: Set<string>; plugins: Set<string>; templates: Set<string> },
): void {
  // enemy_schema_config：templateRefSlots ⊆ T01-T10；counterHintTags >= 2
  for (const row of rowsByTable.enemy_schema_config) {
    const id = String(row.enemyId);
    if (typeof row.mainProblemTag !== 'string' || !S7_PROBLEM_TAGS.includes(row.mainProblemTag)) errors.push({ table: 'enemy_schema_config', id, message: 'mainProblemTag 非法' });
    checkStringArrayEnum(errors, 'enemy_schema_config', id, 'problemTagRefs', row.problemTagRefs, S7_PROBLEM_TAGS, true);
    checkRefs(errors, 'enemy_schema_config', id, 'templateRefSlots', row.templateRefSlots, ids.templates);
    if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) errors.push({ table: 'enemy_schema_config', id, message: 'counterHintTags 至少 2 个通用解法方向' });
  }

  // boss_skeleton_config：1 主问题 + <=1 副压力；templateRefs ⊆ T01-T10；counterHintTags >= 2
  for (const row of rowsByTable.boss_skeleton_config) {
    const id = String(row.bossId);
    if (typeof row.primaryProblemTag !== 'string' || !S7_PROBLEM_TAGS.includes(row.primaryProblemTag)) errors.push({ table: 'boss_skeleton_config', id, message: 'primaryProblemTag 非法' });
    const sec = row.secondaryPressureTag;
    if (typeof sec !== 'string') errors.push({ table: 'boss_skeleton_config', id, message: 'secondaryPressureTag 必须是字符串（空串表示无副压力）' });
    else if (sec.length > 0 && !S7_PROBLEM_TAGS.includes(sec)) errors.push({ table: 'boss_skeleton_config', id, message: `secondaryPressureTag "${sec}" 非法（最多 1 个副压力，须为 6 类问题之一）` });
    checkRefs(errors, 'boss_skeleton_config', id, 'templateRefs', row.templateRefs, ids.templates);
    if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) errors.push({ table: 'boss_skeleton_config', id, message: 'counterHintTags 至少 2 个通用解法方向' });
  }

  // prebattle_preview_config：templateRef 存在；counterHintTags >= 2（不绑唯一答案 / 广告）
  for (const row of rowsByTable.prebattle_preview_config) {
    const id = String(row.previewId);
    checkSingleRef(errors, 'prebattle_preview_config', id, 'templateRef', row.templateRef, ids.templates);
    checkStringArrayEnum(errors, 'prebattle_preview_config', id, 'problemTagRefs', row.problemTagRefs, S7_PROBLEM_TAGS, true);
    if (!Array.isArray(row.counterHintTags) || row.counterHintTags.length < 2) errors.push({ table: 'prebattle_preview_config', id, message: 'counterHintTags 至少 2 个通用解法方向' });
  }

  // ship_pilot_fit_config：shipRef/pilotRef 存在；每主适配有替代；notUniqueFlag=true；PIL-RSV 不入默认适配
  const fitShips = new Set<string>();
  for (const row of rowsByTable.ship_pilot_fit_config) {
    const id = String(row.shipRef);
    if (!ids.ships.has(id)) errors.push({ table: 'ship_pilot_fit_config', id, message: `shipRef "${id}" 不存在于星舰表` });
    fitShips.add(id);
    checkSingleRef(errors, 'ship_pilot_fit_config', id, 'primaryPilotRef', row.primaryPilotRef, ids.pilots);
    checkRefs(errors, 'ship_pilot_fit_config', id, 'alternativePilotRefs', row.alternativePilotRefs, ids.pilots);
    if (!Array.isArray(row.alternativePilotRefs) || row.alternativePilotRefs.length < 1) errors.push({ table: 'ship_pilot_fit_config', id, message: '每个主适配必须提供至少 1 个替代适配' });
    if (row.notUniqueFlag !== true) errors.push({ table: 'ship_pilot_fit_config', id, message: 'notUniqueFlag 必须为 true（禁止唯一绑定）' });
  }
  for (const s of ids.ships) if (!fitShips.has(s)) errors.push({ table: 'ship_pilot_fit_config', id: s, message: `星舰 ${s} 缺少适配关系行` });

  // core_plugin_fit_config：各引用存在；任一流派 >= 2 解法（>=2 星核且 >=2 插件）
  for (const row of rowsByTable.core_plugin_fit_config) {
    const id = String(row.streamTag);
    checkRefs(errors, 'core_plugin_fit_config', id, 'shipRefs', row.shipRefs, ids.ships);
    checkRefs(errors, 'core_plugin_fit_config', id, 'pilotRefs', row.pilotRefs, ids.pilots);
    checkRefs(errors, 'core_plugin_fit_config', id, 'coreRefs', row.coreRefs, ids.cores);
    checkRefs(errors, 'core_plugin_fit_config', id, 'pluginRefs', row.pluginRefs, ids.plugins);
    if (!Array.isArray(row.coreRefs) || row.coreRefs.length < 2) errors.push({ table: 'core_plugin_fit_config', id, message: '每流派至少 2 个星核解法（不绑定唯一星核）' });
    if (!Array.isArray(row.pluginRefs) || row.pluginRefs.length < 2) errors.push({ table: 'core_plugin_fit_config', id, message: '每流派至少 2 个插件解法（不绑定唯一插件）' });
  }
}

function validateTierBBldCommon(
  errors: S7ValidationError[], table: S7ConfigTableName, rows: unknown[],
): Record<string, unknown>[] {
  const idField = S7_ID_FIELD[table];
  const seen = new Set<string>();
  const validRows: Record<string, unknown>[] = [];
  for (const raw of rows) {
    const row = asRow(raw);
    if (!row) {
      errors.push({ table, id: '-', message: '配置行必须是对象' });
      continue;
    }
    validRows.push(row);
    const idValue = row[idField];
    const id = typeof idValue === 'string' ? idValue : String(idValue);
    if (typeof row.schemaVersion !== 'string' || row.schemaVersion.length === 0) {
      errors.push({ table, id, message: '缺少合法 schemaVersion' });
    }
    if (typeof idValue !== 'string' || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" 不符合全小写英文/数字/下划线规则` });
    }
    if (seen.has(id)) errors.push({ table, id, message: `${idField} 重复` });
    seen.add(id);
  }
  return validRows;
}

function validateTierBBld(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  // building_config
  const bldRows = rowsByTable.building_config;
  const buildingIds = new Set<string>();
  const systemRefsById = new Map<string, string[]>();
  const noAdRoleById = new Map<string, string>();
  const defaultKeys: string[] = [];
  const conditionalKeys: string[] = [];
  const keySeen = new Set<string>();
  if (bldRows.length !== 8) errors.push({ table: 'building_config', id: '-', message: `建筑总数必须为 8（7 默认 + 1 条件/后置），实际 ${bldRows.length}` });
  for (const row of bldRows) {
    const id = String(row.buildingId);
    buildingIds.add(id);
    const key = String(row.buildingKey);
    if (keySeen.has(key)) errors.push({ table: 'building_config', id, message: `buildingKey "${key}" 重复` });
    keySeen.add(key);
    const refs = Array.isArray(row.systemRefTags) ? row.systemRefTags.map((t) => String(t)) : [];
    systemRefsById.set(id, refs);
    noAdRoleById.set(id, String(row.noAdCorePathRole));
    if (typeof row.buildingGroupTag !== 'string' || !BUILDING_GROUPS.includes(row.buildingGroupTag)) errors.push({ table: 'building_config', id, message: 'buildingGroupTag 非法' });
    if (typeof row.noAdCorePathRole !== 'string' || !BUILDING_NO_AD_ROLES.includes(row.noAdCorePathRole)) errors.push({ table: 'building_config', id, message: 'noAdCorePathRole 非法' });
    if (typeof row.releaseTag !== 'string' || !BUILDING_RELEASE_TAGS.includes(row.releaseTag)) errors.push({ table: 'building_config', id, message: 'releaseTag 非法' });
    if (row.initialLevel !== 1) errors.push({ table: 'building_config', id, message: 'initialLevel 必须为 1' });
    if (row.maxLevel !== 10) errors.push({ table: 'building_config', id, message: 'maxLevel 必须为 10' });
    if (row.functionUnlockLevel !== 1) errors.push({ table: 'building_config', id, message: 'functionUnlockLevel 必须为 1' });
    if ((num(row.mainlineRequiredLevelCap) ?? 99) > 1) errors.push({ table: 'building_config', id, message: 'mainlineRequiredLevelCap 不得 > 1' });
    if (!Array.isArray(row.systemRefTags) || row.systemRefTags.length === 0) errors.push({ table: 'building_config', id, message: 'systemRefTags 不能为空' });
    if (row.releaseTag === 'default_release') {
      defaultKeys.push(key);
      if (row.reservedFlag !== false) errors.push({ table: 'building_config', id, message: 'default_release 建筑 reservedFlag 必须为 false' });
    } else if (row.releaseTag === 'conditional_post') {
      conditionalKeys.push(key);
      if (row.reservedFlag !== true) errors.push({ table: 'building_config', id, message: 'conditional_post 建筑 reservedFlag 必须为 true' });
      if (row.buildingGroupTag !== 'showcase') errors.push({ table: 'building_config', id, message: 'conditional_post 建筑必须属于 showcase 组' });
    }
  }
  if (defaultKeys.length !== 7) errors.push({ table: 'building_config', id: '-', message: `默认建筑必须为 7 个，实际 ${defaultKeys.length}` });
  for (const k of BUILDING_DEFAULT_KEYS) if (!defaultKeys.includes(k)) errors.push({ table: 'building_config', id: k, message: `默认建筑缺少 "${k}"` });
  for (const k of defaultKeys) if (!BUILDING_DEFAULT_KEYS.includes(k)) errors.push({ table: 'building_config', id: k, message: `"${k}" 不在 7 个默认建筑白名单内` });
  if (conditionalKeys.length !== 1) errors.push({ table: 'building_config', id: '-', message: `条件/后置建筑必须为 1 个，实际 ${conditionalKeys.length}` });
  for (const k of BUILDING_RESERVED_KEYS) if (!conditionalKeys.includes(k)) errors.push({ table: 'building_config', id: k, message: `条件/后置预留建筑缺少 "${k}"` });

  const usedGroups = new Set<string>(bldRows.map((r) => String(r.buildingGroupTag)));

  // building_unlock_config
  const unlockBuildings = new Set<string>();
  const cc05aSeen = new Set<string>();
  for (const row of rowsByTable.building_unlock_config) {
    const id = String(row.unlockId);
    const bid = String(row.buildingId);
    if (!buildingIds.has(bid)) errors.push({ table: 'building_unlock_config', id, message: `buildingId "${bid}" 不存在` });
    unlockBuildings.add(bid);
    if (typeof row.unlockSourceType !== 'string' || !['tutorial_anchor', 'mainline_anchor', 'need_anchor', 'expansion_anchor', 'blueprint_progress'].includes(row.unlockSourceType)) errors.push({ table: 'building_unlock_config', id, message: 'unlockSourceType 非法' });
    if (row.initialLevelOnUnlock !== 1) errors.push({ table: 'building_unlock_config', id, message: 'initialLevelOnUnlock 必须为 1' });
    if (row.noAdAvailableFlag !== true) errors.push({ table: 'building_unlock_config', id, message: 'noAdAvailableFlag 必须为 true' });
    if (row.forbiddenFallback70Flag !== true) errors.push({ table: 'building_unlock_config', id, message: 'forbiddenFallback70Flag 必须为 true' });
    if (row.forbiddenCommercialSourceFlag !== true) errors.push({ table: 'building_unlock_config', id, message: 'forbiddenCommercialSourceFlag 必须为 true' });
    if (row.corePathRequiredFlag === true && noAdRoleById.get(bid) !== 'entry_only') {
      errors.push({ table: 'building_unlock_config', id, message: 'corePathRequiredFlag 仅 entry_only 入口建筑可为 true（驾驶员训练舱/补给站/打捞/商人/研究/展厅不得为核心必需）' });
    }
    const cc = String(row.cc05aLinkTag);
    if (cc05aSeen.has(cc)) errors.push({ table: 'building_unlock_config', id, message: 'cc05aLinkTag 重复' });
    cc05aSeen.add(cc);
    const anchorLower = String(row.unlockAnchorTag).toLowerCase();
    const ccLower = cc.toLowerCase();
    for (const n of FORBIDDEN_FALLBACK_NODES) {
      if (anchorLower.includes(n) || ccLower.includes(n)) errors.push({ table: 'building_unlock_config', id, message: `建筑解锁不得挂 70 回退可删节点 ${n.toUpperCase()}` });
    }
  }
  for (const b of buildingIds) if (!unlockBuildings.has(b)) errors.push({ table: 'building_unlock_config', id: b, message: `建筑 ${b} 缺少解锁行` });

  // building_level_cost_param
  for (const row of rowsByTable.building_level_cost_param) {
    const id = String(row.costParamId);
    if (typeof row.buildingGroupTag !== 'string' || !usedGroups.has(row.buildingGroupTag)) errors.push({ table: 'building_level_cost_param', id, message: 'buildingGroupTag 必须来自 building_config 已有建筑组' });
    if (!['activate_lv1', 'lv2_5', 'lv6_10'].includes(String(row.levelBand))) errors.push({ table: 'building_level_cost_param', id, message: 'levelBand 非法' });
    if (!['none', 'star_ore'].includes(String(row.primaryResourceTag))) errors.push({ table: 'building_level_cost_param', id, message: 'primaryResourceTag 非法' });
    if (!['none', 'low', 'mid', 'high'].includes(String(row.costBandTag))) errors.push({ table: 'building_level_cost_param', id, message: 'costBandTag 非法' });
    if (!['entry_unlock_only', 'not_in_core_floor', 'optional_post'].includes(String(row.freeAnchorImpactTag))) errors.push({ table: 'building_level_cost_param', id, message: 'freeAnchorImpactTag 非法' });
    if (row.forbidRecalc0304Flag !== true) errors.push({ table: 'building_level_cost_param', id, message: 'forbidRecalc0304Flag 必须为 true（禁止重算 03-04）' });
  }

  // building_level_effect_param
  for (const row of rowsByTable.building_level_effect_param) {
    const id = String(row.effectParamId);
    const bid = String(row.buildingId);
    if (!buildingIds.has(bid)) errors.push({ table: 'building_level_effect_param', id, message: `buildingId "${bid}" 不存在` });
    if (!['lv1', 'lv2_5', 'lv6_10'].includes(String(row.levelBand))) errors.push({ table: 'building_level_effect_param', id, message: 'levelBand 非法' });
    if (!['none', 'minor_non_gate'].includes(String(row.combatPowerImpactTag))) errors.push({ table: 'building_level_effect_param', id, message: 'combatPowerImpactTag 非法' });
    if (row.mainlineGateAllowed !== false) errors.push({ table: 'building_level_effect_param', id, message: 'mainlineGateAllowed 必须为 false（建筑不得卡主线）' });
    if (row.noAdGateAllowed !== false) errors.push({ table: 'building_level_effect_param', id, message: 'noAdGateAllowed 必须为 false（建筑不得卡 no-ad）' });
    const sysRefs = systemRefsById.get(bid) ?? [];
    if (typeof row.affectedSystemTag !== 'string' || !sysRefs.includes(row.affectedSystemTag)) {
      errors.push({ table: 'building_level_effect_param', id, message: `affectedSystemTag "${String(row.affectedSystemTag)}" 不在建筑 ${bid} 的 systemRefTags 内` });
    }
  }

  // building_anchor_impact_check
  const anchorDaysSeen = new Set<string>();
  for (const row of rowsByTable.building_anchor_impact_check) {
    const id = String(row.checkId);
    if (typeof row.anchorDay === 'string') anchorDaysSeen.add(row.anchorDay);
    if (!BUILDING_ANCHOR_DAYS.includes(String(row.anchorDay))) errors.push({ table: 'building_anchor_impact_check', id, message: 'anchorDay 非法' });
    if (!Array.isArray(row.requiredBuildingRefs)) errors.push({ table: 'building_anchor_impact_check', id, message: 'requiredBuildingRefs 必须是数组' });
    else for (const ref of row.requiredBuildingRefs) {
      if (typeof ref !== 'string' || !buildingIds.has(ref)) errors.push({ table: 'building_anchor_impact_check', id, message: `requiredBuildingRefs 引用的 "${String(ref)}" 不存在` });
    }
    if ((num(row.requiredLevelCap) ?? 99) > 1) errors.push({ table: 'building_anchor_impact_check', id, message: 'requiredLevelCap 不得 > 1（no-ad 核心路径不依赖建筑 Level 2-10）' });
    if (!['no_impact', 'needs_review', 'blocks_anchor'].includes(String(row.impactJudgement))) errors.push({ table: 'building_anchor_impact_check', id, message: 'impactJudgement 非法' });
    if (row.impactJudgement === 'blocks_anchor') errors.push({ table: 'building_anchor_impact_check', id, message: 'impactJudgement=blocks_anchor 必须回主控 / Ron，不得直接落表' });
    if (row.blockOnFail !== true) errors.push({ table: 'building_anchor_impact_check', id, message: 'blockOnFail 必须为 true' });
    if (row.forbidCommercialPatchFlag !== true) errors.push({ table: 'building_anchor_impact_check', id, message: 'forbidCommercialPatchFlag 必须为 true' });
  }
  for (const d of BUILDING_ANCHOR_DAYS) if (!anchorDaysSeen.has(d)) errors.push({ table: 'building_anchor_impact_check', id: d, message: `缺少锚点 ${d}` });
}

function validateTierB(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  // source_tag_config
  for (const row of rowsByTable.source_tag_config) {
    const id = String(row.rowId);
    const cat = row.sourceCategory;
    if (cat !== 'free' && cat !== 'high_risk') errors.push({ table: 'source_tag_config', id, message: 'sourceCategory 非法' });
    if (row.riskLevel !== 'low' && row.riskLevel !== 'high') errors.push({ table: 'source_tag_config', id, message: 'riskLevel 非法' });
    if (cat === 'high_risk' && row.riskLevel !== 'high') errors.push({ table: 'source_tag_config', id, message: 'high_risk 来源 riskLevel 必须为 high' });
    if (row.inheritOnTransform !== true) errors.push({ table: 'source_tag_config', id, message: 'inheritOnTransform 必须为 true（来源标签延续）' });
    if (row.washProtected !== true) errors.push({ table: 'source_tag_config', id, message: 'washProtected 必须为 true（防洗白）' });
  }

  // power_reference_param
  const prDays = new Set<string>();
  for (const row of rowsByTable.power_reference_param) {
    const id = String(row.rowId);
    if (typeof row.anchorDay === 'string') prDays.add(row.anchorDay);
    if (!ANCHOR_DAYS.includes(String(row.anchorDay))) errors.push({ table: 'power_reference_param', id, message: 'anchorDay 非法' });
    if (row.internalOnly !== true) errors.push({ table: 'power_reference_param', id, message: 'internalOnly 必须为 true（powerIndex 仅内部/QA）' });
    const v = num(row.powerIndex); const lo = num(row.powerIndexMin); const hi = num(row.powerIndexMax);
    if (lo === null || hi === null || v === null || !(lo <= v && v <= hi)) {
      errors.push({ table: 'power_reference_param', id, message: 'powerIndexMin <= powerIndex <= powerIndexMax 不成立' });
    }
  }
  for (const d of ANCHOR_DAYS) if (!prDays.has(d)) errors.push({ table: 'power_reference_param', id: d, message: `缺少锚点 ${d}` });

  // free_resource_anchor_param：floor <= expected
  const byAnchor: Record<string, { floor?: Record<string, unknown>; expected?: Record<string, unknown> }> = {};
  for (const row of rowsByTable.free_resource_anchor_param) {
    const id = String(row.rowId);
    const day = String(row.anchorDay);
    if (!ANCHOR_DAYS.includes(day)) errors.push({ table: 'free_resource_anchor_param', id, message: 'anchorDay 非法' });
    if (row.band !== 'floor' && row.band !== 'expected') errors.push({ table: 'free_resource_anchor_param', id, message: 'band 必须是 floor / expected' });
    byAnchor[day] = byAnchor[day] ?? {};
    if (row.band === 'floor') byAnchor[day].floor = row;
    if (row.band === 'expected') byAnchor[day].expected = row;
  }
  for (const d of ANCHOR_DAYS) {
    const pair = byAnchor[d];
    if (!pair || !pair.floor || !pair.expected) {
      errors.push({ table: 'free_resource_anchor_param', id: d, message: `缺少 ${d} 的 floor / expected 行` });
      continue;
    }
    for (const res of ANCHOR_BUDGET_KEYS) {
      const f = num(pair.floor[res]); const e = num(pair.expected[res]);
      if (f === null || e === null) errors.push({ table: 'free_resource_anchor_param', id: d, message: `资源 ${res} 缺数值` });
      else if (f > e) errors.push({ table: 'free_resource_anchor_param', id: d, message: `资源 ${res} floor(${f}) > expected(${e})` });
    }
  }

  // upgrade_cost_param：等级上限 40
  let shipMaxLv = 0; let pilotMaxLv = 0;
  for (const row of rowsByTable.upgrade_cost_param) {
    const id = String(row.rowId);
    if (row.targetType !== 'ship' && row.targetType !== 'pilot') errors.push({ table: 'upgrade_cost_param', id, message: 'targetType 非法' });
    const lv = num(row.maxLevel) ?? 0;
    if (row.targetType === 'ship') shipMaxLv = Math.max(shipMaxLv, lv);
    if (row.targetType === 'pilot') pilotMaxLv = Math.max(pilotMaxLv, lv);
  }
  if (shipMaxLv !== 40) errors.push({ table: 'upgrade_cost_param', id: 'ship', message: `星舰等级上限必须为 40，实际 ${shipMaxLv}` });
  if (pilotMaxLv !== 40) errors.push({ table: 'upgrade_cost_param', id: 'pilot', message: `驾驶员等级上限必须为 40，实际 ${pilotMaxLv}` });

  // 首发无强化系统：砍星核 5 阶强化（v1.0 §5.4「不做重复星核深层养成（留 P1）」）、插件不分等级（§5.3）。
  // → enhance_cost_param 应为空；P1 若做星核深层养成再启用本表与对应校验。
  if (rowsByTable.enhance_cost_param.length > 0) {
    errors.push({ table: 'enhance_cost_param', id: '-', message: '首发无强化系统，enhance_cost_param 应为空（已砍星核 5 阶强化，§5.4）' });
  }

  // refund_param：不跨币种、min<=max
  for (const row of rowsByTable.refund_param) {
    const id = String(row.rowId);
    if (row.crossCurrency !== false) errors.push({ table: 'refund_param', id, message: 'crossCurrency 必须为 false（不跨币种洗白）' });
    const lo = num(row.refundRateMinPct); const hi = num(row.refundRateMaxPct);
    if (lo === null || hi === null || lo > hi || lo < 0 || hi > 100) {
      errors.push({ table: 'refund_param', id, message: 'refundRate 区间非法（0<=min<=max<=100）' });
    }
  }

  // pressure_param：min<=max；N075<=14500；modifier 不叠 Boss
  for (const row of rowsByTable.pressure_param) {
    const id = String(row.rowId);
    const scope = row.scope;
    if (scope !== 'normal' && scope !== 'elite' && scope !== 'boss' && scope !== 'template_modifier') {
      errors.push({ table: 'pressure_param', id, message: 'scope 非法' });
      continue;
    }
    if (scope === 'template_modifier') {
      const m = num(row.modifier);
      if (m === null || m <= 0) errors.push({ table: 'pressure_param', id, message: 'modifier 必须为正数' });
      if (row.appliesToBoss !== false) errors.push({ table: 'pressure_param', id, message: 'template_modifier 的 appliesToBoss 必须为 false（不叠乘 boss_pressure）' });
    } else {
      const lo = num(row.pressureMin); const hi = num(row.pressureMax);
      if (lo === null || hi === null || lo > hi) errors.push({ table: 'pressure_param', id, message: 'pressureMin <= pressureMax 不成立' });
      if (scope === 'boss' && row.refKey === 'n150' && (hi === null || hi > 14500)) {
        errors.push({ table: 'pressure_param', id, message: 'N150（终Boss）压力上限必须 <= 14500，不上探 15500' });
      }
    }
  }

  // reward_param：来源合法、资源词表、min<=max、无 RSV、不绑广告
  for (const row of rowsByTable.reward_param) {
    const id = String(row.rowId);
    const st = String(row.sourceType);
    if (!REWARD_SOURCE_TYPES.includes(st)) errors.push({ table: 'reward_param', id, message: `sourceType "${st}" 非法` });
    if (/rsv/i.test(st) || /rsv/i.test(String(row.packId)) || /rsv/i.test(String(row.goodItemTag))) {
      errors.push({ table: 'reward_param', id, message: '奖励池不得引用条件预留项（RSV）' });
    }
    if (row.noAdRequired !== true) errors.push({ table: 'reward_param', id, message: '奖励池 noAdRequired 必须为 true（关键路径不绑广告）' });
    if (!Array.isArray(row.resources)) {
      errors.push({ table: 'reward_param', id, message: 'resources 必须是数组' });
    } else {
      for (const r of row.resources as unknown[]) {
        const rr = asRow(r);
        if (!rr) { errors.push({ table: 'reward_param', id, message: 'resources 项必须是对象' }); continue; }
        if (typeof rr.resourceId !== 'string' || !RESOURCE_VOCAB.includes(rr.resourceId)) {
          errors.push({ table: 'reward_param', id, message: `resourceId "${String(rr.resourceId)}" 不在资源词表内` });
        }
        const lo = num(rr.min); const hi = num(rr.max);
        if (lo === null) errors.push({ table: 'reward_param', id, message: 'resources.min 缺数值' });
        if (hi !== null && lo !== null && lo > hi) errors.push({ table: 'reward_param', id, message: 'resources.min > max' });
      }
    }
  }

  // shop_param：priceMin<=priceMax、非关键路径物、limit>=1
  for (const row of rowsByTable.shop_param) {
    const id = String(row.rowId);
    const lo = num(row.priceMin); const hi = num(row.priceMax);
    if (lo === null || hi === null || lo > hi) errors.push({ table: 'shop_param', id, message: 'priceMin <= priceMax 不成立' });
    if (row.criticalPath !== false) errors.push({ table: 'shop_param', id, message: '商人不得出售关键路径唯一物（criticalPath 必须 false）' });
    if ((num(row.purchaseLimit) ?? 0) < 1) errors.push({ table: 'shop_param', id, message: 'purchaseLimit 必须 >= 1' });
  }

  // merchant_refresh_param
  for (const row of rowsByTable.merchant_refresh_param) {
    const id = String(row.rowId);
    if (row.freeRefreshPerCycle !== 1) errors.push({ table: 'merchant_refresh_param', id, message: 'freeRefreshPerCycle 必须为 1' });
    if ((num(row.paidRefreshCapPerCycle) ?? 99) > 3) errors.push({ table: 'merchant_refresh_param', id, message: 'paidRefreshCapPerCycle 必须 <= 3' });
    if (row.criticalPathItemBlock !== true) errors.push({ table: 'merchant_refresh_param', id, message: 'criticalPathItemBlock 必须为 true' });
    const seqv = row.refreshCostSequence;
    if (!Array.isArray(seqv) || seqv.length !== 3 || seqv[0] !== 80 || seqv[1] !== 160 || seqv[2] !== 320) {
      errors.push({ table: 'merchant_refresh_param', id, message: 'refreshCostSequence 必须为 [80,160,320]' });
    }
  }

  // recycle_param：min<=max、完整星核不可回收、高风险买入必亏
  const highRiskItems = ['merchant_bought', 'ad_extra', 'sponsor_supply', 'treasure_product'];
  for (const row of rowsByTable.recycle_param) {
    const id = String(row.rowId);
    const lo = num(row.refundRateMinPct); const hi = num(row.refundRateMaxPct);
    if (lo === null || hi === null || lo > hi) errors.push({ table: 'recycle_param', id, message: 'refundRate 区间非法' });
    if (row.itemType === 'full_core' && row.recyclable !== false) {
      errors.push({ table: 'recycle_param', id, message: '完整星核必须 recyclable=false（防核心路径套利）' });
    }
    if (typeof row.itemType === 'string' && highRiskItems.includes(row.itemType) && (hi === null || hi > 15)) {
      errors.push({ table: 'recycle_param', id, message: '高风险来源买入回收必亏（refundRateMaxPct <= 15）' });
    }
  }

  // anti_arbitrage_check：>=6 条且全部 blockOnFail
  const arb = rowsByTable.anti_arbitrage_check;
  if (arb.length < 6) errors.push({ table: 'anti_arbitrage_check', id: '-', message: `阻断规则至少 6 条，实际 ${arb.length}` });
  for (const row of arb) {
    const id = String(row.rowId);
    if (row.blockOnFail !== true) errors.push({ table: 'anti_arbitrage_check', id, message: 'blockOnFail 必须为 true' });
    if (typeof row.formula !== 'string' || row.formula.length === 0) errors.push({ table: 'anti_arbitrage_check', id, message: 'formula 不能为空' });
  }
}

function validateTierC(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  const templateIds = new Set<string>(S7_DEFAULT_IDS.battle_template_config);
  const tutorialIds = new Set<string>(S7_TUTORIAL_STEP_IDS);

  // mainline_node_config：150 节点完整、字段枚举、70 回退白名单（已作废）、N018/N019 转折
  const mainlineRows = rowsByTable.mainline_node_config;
  if (mainlineRows.length !== 150) {
    errors.push({ table: 'mainline_node_config', id: '-', message: `主线节点必须为 150 行，实际 ${mainlineRows.length}` });
  }
  const mainlineById = new Map<string, Record<string, unknown>>();
  const seenNodeIds = new Set<string>();
  const cutNodes: string[] = [];
  for (const row of mainlineRows) {
    const id = String(row.nodeId);
    seenNodeIds.add(id);
    mainlineById.set(id, row);
    if (!S7_NODE_TYPE_TAGS.includes(String(row.nodeTypeTag))) errors.push({ table: 'mainline_node_config', id, message: 'nodeTypeTag 非法' });
    if (typeof row.starfieldId !== 'string' || !S7_STARFIELD_IDS.includes(row.starfieldId)) errors.push({ table: 'mainline_node_config', id, message: 'starfieldId 非法' });
    if (typeof row.chapterId !== 'string' || !S7_CHAPTER_IDS.includes(row.chapterId)) errors.push({ table: 'mainline_node_config', id, message: 'chapterId 非法' });
    const tref = row.templateRef;
    if (tref !== 'none' && (typeof tref !== 'string' || !templateIds.has(tref))) {
      errors.push({ table: 'mainline_node_config', id, message: `templateRef "${String(tref)}" 非法（仅允许 t01-t10 或 none）` });
    }
    const ptag = row.problemTagRef;
    if (ptag !== 'none' && (typeof ptag !== 'string' || !S7_PROBLEM_TAGS.includes(ptag))) {
      errors.push({ table: 'mainline_node_config', id, message: 'problemTagRef 非法' });
    }
    if (typeof row.secondaryPressureTag !== 'string' || !S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) {
      errors.push({ table: 'mainline_node_config', id, message: 'secondaryPressureTag 非法' });
    }
    const tut = row.tutorialStepRef;
    if (tut !== 'none' && (typeof tut !== 'string' || !tutorialIds.has(tut))) {
      errors.push({ table: 'mainline_node_config', id, message: 'tutorialStepRef 非法' });
    }
    if (typeof row.unlockRef !== 'string' || row.unlockRef.length === 0) errors.push({ table: 'mainline_node_config', id, message: 'unlockRef 不能为空' });
    if (typeof row.rewardAnchorRef !== 'string' || row.rewardAnchorRef.length === 0) errors.push({ table: 'mainline_node_config', id, message: 'rewardAnchorRef 不能为空' });
    if (typeof row.noAdCheckTag !== 'string' || !S7_NO_AD_CHECK_TAGS.includes(row.noAdCheckTag)) {
      errors.push({ table: 'mainline_node_config', id, message: 'noAdCheckTag 非法' });
    }
    if (typeof row.protectionPeriodTag !== 'string' || !S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) {
      errors.push({ table: 'mainline_node_config', id, message: 'protectionPeriodTag 非法' });
    }
    if (typeof row.fallback70Tag !== 'string' || !S7_FALLBACK70_TAGS.includes(row.fallback70Tag)) {
      errors.push({ table: 'mainline_node_config', id, message: 'fallback70Tag 非法' });
    }
    if (row.fallback70Tag === 'cut_70') cutNodes.push(id);
  }
  for (const id of S7_MAINLINE_NODE_IDS) {
    if (!seenNodeIds.has(id)) errors.push({ table: 'mainline_node_config', id, message: `缺少主线节点 ${id}` });
  }

  // 70 回退白名单：仅 N033/N047/N053/N063/N070 允许 cut_70
  for (const id of cutNodes) {
    if (!FORBIDDEN_FALLBACK_NODES.includes(id)) {
      errors.push({ table: 'mainline_node_config', id, message: `fallback70Tag=cut_70 仅允许 ${FORBIDDEN_FALLBACK_NODES.join('/')}，不允许 ${id}` });
    }
  }
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const row = mainlineById.get(id);
    if (row && row.fallback70Tag !== 'cut_70') errors.push({ table: 'mainline_node_config', id, message: `${id} 必须 fallback70Tag=cut_70` });
  }

  // 保护期分布（2026-07-02 拓扑改造：转折点前移到 n018/n019，配合系统解锁前置化）：
  // N001-N017 active；N018 ending_notice；N019-N150 closed
  for (const id of S7_MAINLINE_NODE_IDS) {
    const row = mainlineById.get(id);
    if (!row) continue;
    const idx = Number(id.slice(1));
    const expected = idx <= 17 ? 'active' : idx === 18 ? 'ending_notice' : 'closed';
    if (row.protectionPeriodTag !== expected) errors.push({ table: 'mainline_node_config', id, message: `protectionPeriodTag 应为 ${expected}` });
  }

  // N018/N019 转折：非战斗节点，protection 字段必填
  const n018 = mainlineById.get('n018');
  if (n018 && (n018.problemTagRef !== 'none' || n018.templateRef !== 'none')) {
    errors.push({ table: 'mainline_node_config', id: 'n018', message: 'N018 必须为非战斗节点（templateRef/problemTagRef=none）' });
  }
  const n019 = mainlineById.get('n019');
  if (n019 && (n019.problemTagRef !== 'none' || n019.templateRef !== 'none')) {
    errors.push({ table: 'mainline_node_config', id: 'n019', message: 'N019 必须为非战斗节点（templateRef/problemTagRef=none）' });
  }

  // chapter_config：12 章节完整，Boss 章节挂接正确
  const chapterRows = rowsByTable.chapter_config;
  const seenChapters = new Set<string>();
  for (const row of chapterRows) {
    const id = String(row.chapterId);
    seenChapters.add(id);
    if (typeof row.starfieldId !== 'string' || !S7_STARFIELD_IDS.includes(row.starfieldId)) errors.push({ table: 'chapter_config', id, message: 'starfieldId 非法' });
    if (typeof row.nodeRangeTag !== 'string' || !NODE_RANGE_PATTERN.test(row.nodeRangeTag)) errors.push({ table: 'chapter_config', id, message: 'nodeRangeTag 格式非法（应为 nNNN_nNNN）' });
    checkRefs(errors, 'chapter_config', id, 'primaryTemplateTags', row.primaryTemplateTags, templateIds);
    const boss = row.bossRef;
    if (boss !== 'none' && (typeof boss !== 'string' || !S7_BOSS_NODE_IDS.includes(boss))) errors.push({ table: 'chapter_config', id, message: 'bossRef 非法' });
  }
  for (const id of S7_CHAPTER_IDS) if (!seenChapters.has(id)) errors.push({ table: 'chapter_config', id, message: `缺少章节 ${id}` });
  // 6星域末尾章节（2026-07-02 拓扑改造：ch10/14/17/20/23/25，对应 n060/084/102/120/138/150）
  for (const expected of ['ch10', 'ch14', 'ch17', 'ch20', 'ch23', 'ch25']) {
    const row = chapterRows.find((r) => r.chapterId === expected);
    if (!row || row.bossRef === 'none') errors.push({ table: 'chapter_config', id: expected, message: `${expected} 必须设置 bossRef` });
  }

  // star_region_config：4 星域完整
  const starRows = rowsByTable.star_region_config;
  const seenStarfields = new Set<string>();
  for (const row of starRows) {
    const id = String(row.starfieldId);
    seenStarfields.add(id);
    if (typeof row.nodeRangeTag !== 'string' || !NODE_RANGE_PATTERN.test(row.nodeRangeTag)) errors.push({ table: 'star_region_config', id, message: 'nodeRangeTag 格式非法（应为 nNNN_nNNN）' });
    checkStringArrayEnum(errors, 'star_region_config', id, 'mainProblemTags', row.mainProblemTags, S7_PROBLEM_TAGS, true);
    checkStringArrayEnum(errors, 'star_region_config', id, 'reuseProblemTags', row.reuseProblemTags, S7_PROBLEM_TAGS, false);
    if (typeof row.bossValidationTag !== 'string' || !S7_PROBLEM_TAGS.includes(row.bossValidationTag)) errors.push({ table: 'star_region_config', id, message: 'bossValidationTag 非法' });
    if (!['keep_all', 'cut_1', 'cut_2'].includes(String(row.fallback70Policy))) errors.push({ table: 'star_region_config', id, message: 'fallback70Policy 非法' });
  }
  for (const id of S7_STARFIELD_IDS) if (!seenStarfields.has(id)) errors.push({ table: 'star_region_config', id, message: `缺少星域 ${id}` });

  // boss_node_config：6 Boss 完整，主问题与 mainline 一致，终Boss(N150) 必须 t10
  const bossRows = rowsByTable.boss_node_config;
  const seenBoss = new Set<string>();
  for (const row of bossRows) {
    const id = String(row.bossNodeId);
    seenBoss.add(id);
    if (!S7_BOSS_NODE_IDS.includes(id)) errors.push({ table: 'boss_node_config', id, message: `bossNodeId 必须为 ${S7_BOSS_NODE_IDS.join('/')}` });
    if (typeof row.mainProblemTag !== 'string' || !S7_PROBLEM_TAGS.includes(row.mainProblemTag)) errors.push({ table: 'boss_node_config', id, message: 'mainProblemTag 非法' });
    checkSingleRef(errors, 'boss_node_config', id, 'templateRef', row.templateRef, templateIds);
    if (typeof row.secondaryPressureTag !== 'string' || !S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) errors.push({ table: 'boss_node_config', id, message: 'secondaryPressureTag 非法' });
    checkRefs(errors, 'boss_node_config', id, 'previewTagRefs', row.previewTagRefs, tutorialIds);
    if (typeof row.forbiddenMechanicTag !== 'string' || row.forbiddenMechanicTag.length === 0) errors.push({ table: 'boss_node_config', id, message: 'forbiddenMechanicTag 不能为空' });
    const mline = mainlineById.get(id);
    if (mline && mline.problemTagRef !== row.mainProblemTag) errors.push({ table: 'boss_node_config', id, message: 'mainProblemTag 必须与 mainline_node_config 对应节点一致' });
  }
  for (const id of S7_BOSS_NODE_IDS) if (!seenBoss.has(id)) errors.push({ table: 'boss_node_config', id, message: `缺少 Boss 节点 ${id}` });
  const finalBoss = bossRows.find((r) => r.bossNodeId === 'n150');
  if (finalBoss && finalBoss.templateRef !== 't10') errors.push({ table: 'boss_node_config', id: 'n150', message: 'N150（终Boss）templateRef 必须为 t10（Boss 狂暴主轴）' });

  // tutorial_trigger_config：38 步完整，结构字段与对应主线节点一致
  const tutRows = rowsByTable.tutorial_trigger_config;
  const seenTut = new Set<string>();
  for (const row of tutRows) {
    const id = String(row.tutorialStepId);
    seenTut.add(id);
    const nodeId = row.nodeId;
    const mline = typeof nodeId === 'string' ? mainlineById.get(nodeId) : undefined;
    if (typeof nodeId !== 'string' || !mline) {
      errors.push({ table: 'tutorial_trigger_config', id, message: `nodeId "${String(nodeId)}" 不是有效主线节点` });
    }
    if (!['on_node_enter', 'on_node_complete', 'on_checkpoint_enter'].includes(String(row.triggerTag))) errors.push({ table: 'tutorial_trigger_config', id, message: 'triggerTag 非法' });
    if (typeof row.contentTag !== 'string' || !ID_PATTERN.test(row.contentTag)) errors.push({ table: 'tutorial_trigger_config', id, message: 'contentTag 必须是全小写下划线标签（不写长教程文案）' });
    if (typeof row.protectionPeriodTag !== 'string' || !S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) errors.push({ table: 'tutorial_trigger_config', id, message: 'protectionPeriodTag 非法' });
    if (!['skippable', 'mandatory_ack'].includes(String(row.skippableTag))) errors.push({ table: 'tutorial_trigger_config', id, message: 'skippableTag 非法' });
    if (mline) {
      if (row.unlockRef !== mline.unlockRef) errors.push({ table: 'tutorial_trigger_config', id, message: 'unlockRef 必须与对应主线节点 unlockRef 一致' });
      if (row.protectionPeriodTag !== mline.protectionPeriodTag) errors.push({ table: 'tutorial_trigger_config', id, message: 'protectionPeriodTag 必须与对应主线节点一致' });
    }
    // 教程表已简化为仅 tut01-05（真实强引导只覆盖 n001-n005，见 S7DemoController），强制确认仅 TUT01/02。
    const expectedMandatory = ['tut01', 'tut02'].includes(id);
    if (expectedMandatory && row.skippableTag !== 'mandatory_ack') errors.push({ table: 'tutorial_trigger_config', id, message: `${id} 必须为 mandatory_ack` });
    if (!expectedMandatory && row.skippableTag === 'mandatory_ack') errors.push({ table: 'tutorial_trigger_config', id, message: `${id} 不得为 mandatory_ack（仅 TUT01/02）` });
  }
  for (const id of S7_TUTORIAL_STEP_IDS) if (!seenTut.has(id)) errors.push({ table: 'tutorial_trigger_config', id, message: `缺少教程触发 ${id}` });

  // unlock_checkpoint_config：主线 unlockRef 全登记 + 建筑解锁桥接全登记，核心解锁不挂 70 回退节点
  // 条件预留建筑（core_gallery，bld_rsv_*）解锁不纳入默认桥接登记范围（见下方红线扫描）。
  const buildingUnlockIds = new Set<string>(
    rowsByTable.building_unlock_config
      .filter((r) => !RESERVED_TOKEN_PATTERN.test(String(r.unlockId)) && !RESERVED_TOKEN_PATTERN.test(String(r.cc05aLinkTag)))
      .map((r) => String(r.unlockId)),
  );
  const mainlineUnlockRefs = new Set<string>();
  for (const row of mainlineRows) {
    const u = String(row.unlockRef);
    if (u !== 'none') mainlineUnlockRefs.add(u);
  }
  const unlockRows = rowsByTable.unlock_checkpoint_config;
  const seenUnlock = new Set<string>();
  for (const row of unlockRows) {
    const id = String(row.unlockRef);
    seenUnlock.add(id);
    const nodeId = row.nodeId;
    if (nodeId !== 'none' && (typeof nodeId !== 'string' || !S7_MAINLINE_NODE_IDS.includes(nodeId))) {
      errors.push({ table: 'unlock_checkpoint_config', id, message: `nodeId "${String(nodeId)}" 非法` });
    }
    if (typeof row.systemTag !== 'string' || row.systemTag.length === 0) errors.push({ table: 'unlock_checkpoint_config', id, message: 'systemTag 不能为空' });
    if (typeof row.requiredForMainlineTag !== 'boolean') errors.push({ table: 'unlock_checkpoint_config', id, message: 'requiredForMainlineTag 必须是布尔值' });
    if (typeof row.noAdRequiredTag !== 'boolean') errors.push({ table: 'unlock_checkpoint_config', id, message: 'noAdRequiredTag 必须是布尔值' });
    const bref = row.buildingUnlockRef;
    if (bref !== 'none' && (typeof bref !== 'string' || !buildingUnlockIds.has(bref))) {
      errors.push({ table: 'unlock_checkpoint_config', id, message: `buildingUnlockRef "${String(bref)}" 不存在于 building_unlock_config` });
    }
    if (row.requiredForMainlineTag === true && typeof nodeId === 'string' && FORBIDDEN_FALLBACK_NODES.includes(nodeId)) {
      errors.push({ table: 'unlock_checkpoint_config', id, message: `核心解锁不得挂 70 回退可删节点 ${nodeId}` });
    }
  }
  for (const u of mainlineUnlockRefs) if (!seenUnlock.has(u)) errors.push({ table: 'unlock_checkpoint_config', id: u, message: `主线 unlockRef "${u}" 缺少登记行` });
  const registeredBuildingRefs = new Set<string>(unlockRows.map((r) => String(r.buildingUnlockRef)).filter((v) => v !== 'none'));
  for (const bid of buildingUnlockIds) if (!registeredBuildingRefs.has(bid)) errors.push({ table: 'unlock_checkpoint_config', id: bid, message: `建筑解锁 "${bid}" 缺少桥接登记行` });

  // protection_reset_config：N018/N019 转折字段必填（2026-07-02 拓扑改造：转折点前移，原N038/N039）
  const protRows = rowsByTable.protection_reset_config;
  const protById = new Map<string, Record<string, unknown>>();
  for (const row of protRows) {
    const id = String(row.nodeId);
    protById.set(id, row);
    if (!['n018', 'n019'].includes(id)) errors.push({ table: 'protection_reset_config', id, message: 'nodeId 仅允许 n018/n019' });
    if (typeof row.protectionPeriodTag !== 'string' || !S7_PROTECTION_TAGS.includes(row.protectionPeriodTag)) errors.push({ table: 'protection_reset_config', id, message: 'protectionPeriodTag 非法' });
    if (typeof row.freeResetFlag !== 'boolean') errors.push({ table: 'protection_reset_config', id, message: 'freeResetFlag 必须是布尔值' });
    if (typeof row.irreversibleWarningFlag !== 'boolean') errors.push({ table: 'protection_reset_config', id, message: 'irreversibleWarningFlag 必须是布尔值' });
    if (!Array.isArray(row.resetScopeTags)) errors.push({ table: 'protection_reset_config', id, message: 'resetScopeTags 必须是数组' });
    if (!Array.isArray(row.alwaysReversibleTags) || row.alwaysReversibleTags.length === 0) errors.push({ table: 'protection_reset_config', id, message: 'alwaysReversibleTags 不能为空' });
  }
  const n018p = protById.get('n018');
  if (!n018p) errors.push({ table: 'protection_reset_config', id: 'n018', message: '缺少 N018 行' });
  else {
    if (n018p.freeResetFlag !== true) errors.push({ table: 'protection_reset_config', id: 'n018', message: 'N018 freeResetFlag 必须为 true（全队整备 / 免费总重置）' });
    if (!Array.isArray(n018p.resetScopeTags) || n018p.resetScopeTags.length === 0) errors.push({ table: 'protection_reset_config', id: 'n018', message: 'N018 resetScopeTags 不能为空' });
  }
  const n019p = protById.get('n019');
  if (!n019p) errors.push({ table: 'protection_reset_config', id: 'n019', message: '缺少 N019 行' });
  else if (n019p.irreversibleWarningFlag !== true) errors.push({ table: 'protection_reset_config', id: 'n019', message: 'N019 irreversibleWarningFlag 必须为 true（正式养成期提醒）' });

  // 红线：T11/T12、PIL/CORE/PLG-RSV、条件预留建筑（core_gallery，含历史 observatory token 防回归）不得进入 Tier C 默认结构
  for (const table of TIER_C_TABLES) {
    const idField = S7_ID_FIELD[table];
    for (const row of rowsByTable[table]) {
      const rowId = String(row[idField] ?? '-');
      for (const [field, value] of Object.entries(row)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string' && RESERVED_TOKEN_PATTERN.test(v)) {
            errors.push({ table, id: rowId, message: `${field} 含条件预留 / 奇迹建筑引用 "${v}"，禁止进入默认主线 / 教程 / 解锁 / 完成目标` });
          }
        }
      }
    }
  }
}

// Tier D（桥接表 + 全量 S7 交叉校验，来源 03-CC-05b）：
// reward_pool_ref_config <-> mainline_node_config.rewardAnchorRef 双向覆盖；
// no_ad_path_check_config <-> S7_NO_AD_CHECK_TAGS / mainline_node_config.noAdCheckTag 双向覆盖；
// risk_fallback_70_config <-> mainline_node_config.fallback70Tag != keep_70 双向覆盖。
function validateTierD(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  const mainlineRows = rowsByTable.mainline_node_config;
  const mainlineById = new Map<string, Record<string, unknown>>();
  for (const row of mainlineRows) mainlineById.set(String(row.nodeId), row);
  const rewardParamIds = new Set<string>(rowsByTable.reward_param.map((r) => String(r.rowId)));

  // reward_pool_ref_config：10 个 rewardAnchorRef 与 mainline_node_config.rewardAnchorRef 双向覆盖
  // （2026-07-02 简化为 basic/elite/cargo旗舰 + 5区域Boss + 终Boss=9；2026-07-03 +reward_first_boss(n030 剧情首Boss)=10）
  const poolRows = rowsByTable.reward_pool_ref_config;
  if (poolRows.length !== 10) errors.push({ table: 'reward_pool_ref_config', id: '-', message: `必须为 10 行，实际 ${poolRows.length}` });
  const anchorRefsFromMainline = new Set<string>(mainlineRows.map((r) => String(r.rewardAnchorRef)));
  const seenAnchors = new Set<string>();
  for (const row of poolRows) {
    const id = String(row.rewardAnchorRef);
    if (seenAnchors.has(id)) errors.push({ table: 'reward_pool_ref_config', id, message: 'rewardAnchorRef 重复' });
    seenAnchors.add(id);
    if (typeof row.sourceTag !== 'string' || !S7_REWARD_SOURCE_TAGS.includes(row.sourceTag)) errors.push({ table: 'reward_pool_ref_config', id, message: 'sourceTag 非法' });
    if (typeof row.poolRoleTag !== 'string' || !ID_PATTERN.test(row.poolRoleTag)) errors.push({ table: 'reward_pool_ref_config', id, message: 'poolRoleTag 不合法' });
    if (row.noAdRequiredTag !== true) errors.push({ table: 'reward_pool_ref_config', id, message: 'noAdRequiredTag 必须为 true' });
    if (typeof row.goodItemTag !== 'string' || row.goodItemTag.length === 0) errors.push({ table: 'reward_pool_ref_config', id, message: 'goodItemTag 不能为空' });
    if (typeof row.notes !== 'string' || row.notes.length === 0) errors.push({ table: 'reward_pool_ref_config', id, message: 'notes 不能为空' });

    if (!Array.isArray(row.nodeRefs) || row.nodeRefs.length === 0) {
      errors.push({ table: 'reward_pool_ref_config', id, message: 'nodeRefs 不能为空' });
    } else {
      for (const ref of row.nodeRefs as unknown[]) {
        const nodeId = String(ref);
        const mline = mainlineById.get(nodeId);
        if (!mline) errors.push({ table: 'reward_pool_ref_config', id, message: `nodeRefs 引用的 "${nodeId}" 不是有效主线节点` });
        else if (mline.rewardAnchorRef !== id) errors.push({ table: 'reward_pool_ref_config', id, message: `主线节点 ${nodeId} 的 rewardAnchorRef 不是 "${id}"` });
      }
    }

    if (!Array.isArray(row.rewardParamRef)) {
      errors.push({ table: 'reward_pool_ref_config', id, message: 'rewardParamRef 必须是数组' });
    } else {
      if (row.sourceTag === 'source_none' && row.rewardParamRef.length !== 0) errors.push({ table: 'reward_pool_ref_config', id, message: 'sourceTag=source_none 时 rewardParamRef 必须为空' });
      if (row.sourceTag !== 'source_none' && row.rewardParamRef.length === 0) errors.push({ table: 'reward_pool_ref_config', id, message: 'rewardParamRef 不能为空' });
      for (const ref of row.rewardParamRef as unknown[]) {
        if (typeof ref !== 'string' || !rewardParamIds.has(ref)) errors.push({ table: 'reward_pool_ref_config', id, message: `rewardParamRef 引用的 "${String(ref)}" 不存在于 reward_param` });
      }
    }
  }
  for (const anchor of anchorRefsFromMainline) {
    if (!seenAnchors.has(anchor)) errors.push({ table: 'reward_pool_ref_config', id: anchor, message: `主线引用的 rewardAnchorRef "${anchor}" 缺少桥接登记行` });
  }
  for (const anchor of seenAnchors) {
    if (!anchorRefsFromMainline.has(anchor)) errors.push({ table: 'reward_pool_ref_config', id: anchor, message: `rewardAnchorRef "${anchor}" 未被任何主线节点引用` });
  }
  // reward_review_comfort（70回退专属安慰奖）随70回退机制一并作废，不再要求存在（2026-07-02）。

  // no_ad_path_check_config：16 个 checkTag 与 S7_NO_AD_CHECK_TAGS（去 none）/ mainline.noAdCheckTag 双向覆盖
  const checkRows = rowsByTable.no_ad_path_check_config;
  const expectedCheckTags = S7_NO_AD_CHECK_TAGS.filter((t) => t !== 'none');
  if (checkRows.length !== expectedCheckTags.length) errors.push({ table: 'no_ad_path_check_config', id: '-', message: `必须为 ${expectedCheckTags.length} 行，实际 ${checkRows.length}` });
  const seenCheckTags = new Set<string>();
  const checkTagsFromMainline = new Set<string>();
  for (const row of mainlineRows) {
    const tag = String(row.noAdCheckTag);
    if (tag !== 'none') checkTagsFromMainline.add(tag);
  }
  for (const row of checkRows) {
    const id = String(row.checkTag);
    if (!expectedCheckTags.includes(id)) errors.push({ table: 'no_ad_path_check_config', id, message: 'checkTag 不在 S7_NO_AD_CHECK_TAGS 范围内' });
    if (seenCheckTags.has(id)) errors.push({ table: 'no_ad_path_check_config', id, message: 'checkTag 重复' });
    seenCheckTags.add(id);
    const nodeId = String(row.nodeId);
    const mline = mainlineById.get(nodeId);
    if (!mline) errors.push({ table: 'no_ad_path_check_config', id, message: `nodeId "${nodeId}" 不是有效主线节点` });
    else if (mline.noAdCheckTag !== id) errors.push({ table: 'no_ad_path_check_config', id, message: `主线节点 ${nodeId} 的 noAdCheckTag 不是 "${id}"` });
    if (FORBIDDEN_FALLBACK_NODES.includes(nodeId)) errors.push({ table: 'no_ad_path_check_config', id, message: `不看广告检查点不得绑定 70 回退可删节点 ${nodeId}` });
    if (typeof row.requiredStateTag !== 'string' || row.requiredStateTag.length === 0 || !ID_PATTERN.test(row.requiredStateTag)) errors.push({ table: 'no_ad_path_check_config', id, message: 'requiredStateTag 不合法' });
    checkStringArrayEnum(errors, 'no_ad_path_check_config', id, 'forbiddenDependencyTag', row.forbiddenDependencyTag, S7_FORBIDDEN_DEPENDENCY_TAGS, true);
  }
  for (const tag of expectedCheckTags) if (!seenCheckTags.has(tag)) errors.push({ table: 'no_ad_path_check_config', id: tag, message: `缺少检查点 ${tag}` });
  for (const tag of checkTagsFromMainline) if (!seenCheckTags.has(tag)) errors.push({ table: 'no_ad_path_check_config', id: tag, message: `主线引用的 noAdCheckTag "${tag}" 缺少检查点登记行` });

  // risk_fallback_70_config：与 mainline fallback70Tag != keep_70 的节点双向覆盖，70 回退不可砍关键路径
  const fbRows = rowsByTable.risk_fallback_70_config;
  const fallbackNodesFromMainline = mainlineRows.filter((r) => r.fallback70Tag !== 'keep_70').map((r) => String(r.nodeId));
  if (fbRows.length !== fallbackNodesFromMainline.length) errors.push({ table: 'risk_fallback_70_config', id: '-', message: `必须为 ${fallbackNodesFromMainline.length} 行，实际 ${fbRows.length}` });
  const seenFbNodes = new Set<string>();
  for (const row of fbRows) {
    const id = String(row.nodeId);
    if (seenFbNodes.has(id)) errors.push({ table: 'risk_fallback_70_config', id, message: 'nodeId 重复' });
    seenFbNodes.add(id);
    const mline = mainlineById.get(id);
    if (!mline) errors.push({ table: 'risk_fallback_70_config', id, message: `nodeId "${id}" 不是有效主线节点` });
    else if (mline.fallback70Tag !== row.fallback70Tag) errors.push({ table: 'risk_fallback_70_config', id, message: `fallback70Tag 必须与主线节点一致（"${String(mline.fallback70Tag)}"）` });
    if (row.fallback70Tag === 'keep_70' || !S7_FALLBACK70_TAGS.includes(String(row.fallback70Tag))) errors.push({ table: 'risk_fallback_70_config', id, message: 'fallback70Tag 非法（不得为 keep_70）' });
    if (row.criticalPathTag !== false) errors.push({ table: 'risk_fallback_70_config', id, message: 'criticalPathTag 必须为 false（70 回退不可砍关键路径）' });
    if (typeof row.fallbackReasonTag !== 'string' || row.fallbackReasonTag.length === 0 || !ID_PATTERN.test(row.fallbackReasonTag)) errors.push({ table: 'risk_fallback_70_config', id, message: 'fallbackReasonTag 不合法' });
    if (typeof row.replacementRef !== 'string' || row.replacementRef.length === 0 || !ID_PATTERN.test(row.replacementRef)) {
      errors.push({ table: 'risk_fallback_70_config', id, message: 'replacementRef 不合法' });
    } else {
      const embedded = row.replacementRef.match(EMBEDDED_NODE_ID_PATTERN) ?? [];
      for (const ref of embedded) {
        if (!mainlineById.has(ref)) errors.push({ table: 'risk_fallback_70_config', id, message: `replacementRef 引用的节点 "${ref}" 不存在（空引用）` });
        else if (FORBIDDEN_FALLBACK_NODES.includes(ref)) errors.push({ table: 'risk_fallback_70_config', id, message: `replacementRef 不得引用 70 回退可删节点 "${ref}"（空引用）` });
      }
    }
  }
  for (const id of fallbackNodesFromMainline) if (!seenFbNodes.has(id)) errors.push({ table: 'risk_fallback_70_config', id, message: `主线 fallback70Tag != keep_70 的节点 "${id}" 缺少回退登记行` });

  // 70 回退完整性：可删节点不得遗留教程 / 解锁引用（防教程断点 / 空引用）
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const mline = mainlineById.get(id);
    if (!mline) continue;
    if (mline.tutorialStepRef !== 'none') errors.push({ table: 'mainline_node_config', id, message: `70 回退可删节点 ${id} 的 tutorialStepRef 必须为 none（防教程断点）` });
    if (mline.unlockRef !== 'none') errors.push({ table: 'mainline_node_config', id, message: `70 回退可删节点 ${id} 的 unlockRef 必须为 none（防空引用）` });
  }

  // 红线：T11/T12、PIL/CORE/PLG-RSV、条件预留建筑（core_gallery，含历史 observatory token 防回归）不得进入桥接表
  for (const table of TIER_D_TABLES) {
    const idField = S7_ID_FIELD[table];
    for (const row of rowsByTable[table]) {
      const rowId = String(row[idField] ?? '-');
      for (const [field, value] of Object.entries(row)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string' && RESERVED_TOKEN_PATTERN.test(v)) {
            errors.push({ table, id: rowId, message: `${field} 含条件预留 / 奇迹建筑引用 "${v}"，禁止进入默认桥接配置` });
          }
        }
      }
    }
  }
}

function checkGrowthBandCoverage(
  errors: S7ValidationError[],
  bands: { from: number; to: number }[],
  minLv: number,
  maxLv: number,
  label: string,
): void {
  if (bands.length === 0) {
    errors.push({ table: 'growth_band_param', id: label, message: `${label} 缺少 band_linear 成长段` });
    return;
  }
  const sorted = [...bands].sort((a, b) => a.from - b.from);
  if (sorted[0].from !== minLv) errors.push({ table: 'growth_band_param', id: label, message: `${label} 成长段起点必须为 ${minLv}` });
  if (sorted[sorted.length - 1].to !== maxLv) errors.push({ table: 'growth_band_param', id: label, message: `${label} 成长段终点必须为 ${maxLv}` });
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].from !== sorted[i - 1].to + 1) {
      errors.push({ table: 'growth_band_param', id: label, message: `${label} 成长段不连续（${sorted[i - 1].to}->${sorted[i].from}）` });
    }
  }
}

/**
 * 成长段位参数表校验（CC-07E-1）：
 * - 字段枚举 / 数值 / curveType 逻辑（band_linear 段端点；control_point 单点 min=max）。
 * - secondaryKind 与 targetType 一致（ship=stat / pilot=none；插件不分等级、星核砍强化→均无成长段）。
 * - 覆盖完整：ship/pilot band 连续覆盖 1-40。（控制点曲线校验保留给 P1 星核深层养成。）
 */
function validateGrowth(
  errors: S7ValidationError[],
  rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  const rows = rowsByTable.growth_band_param ?? [];
  const byTarget: Record<string, { from: number; to: number }[]> = { ship: [], pilot: [] };

  for (const row of rows) {
    const id = String(row.rowId ?? '-');
    const tt = row.targetType;
    if (typeof tt !== 'string' || !S7_GROWTH_TARGET_TYPES.includes(tt)) {
      errors.push({ table: 'growth_band_param', id, message: 'targetType 非法' });
      continue;
    }
    const ct = row.curveType;
    if (typeof ct !== 'string' || !S7_GROWTH_CURVE_TYPES.includes(ct)) {
      errors.push({ table: 'growth_band_param', id, message: 'curveType 非法' });
    }
    if (typeof row.bandId !== 'string' || !ID_PATTERN.test(row.bandId)) {
      errors.push({ table: 'growth_band_param', id, message: 'bandId 不合法' });
    }
    if (typeof row.secondaryKind !== 'string' || !S7_GROWTH_SECONDARY_KINDS.includes(row.secondaryKind)) {
      errors.push({ table: 'growth_band_param', id, message: 'secondaryKind 非法' });
    } else if (row.secondaryKind !== S7_GROWTH_EXPECTED_SECONDARY[tt]) {
      errors.push({ table: 'growth_band_param', id, message: `secondaryKind 应为 ${S7_GROWTH_EXPECTED_SECONDARY[tt]}` });
    }
    const f = num(row.fromIndex);
    const t = num(row.toIndex);
    const interp = num(row.interpFromIndex);
    const pmin = num(row.powerMin);
    const pmax = num(row.powerMax);
    const smin = num(row.secondaryMin);
    const smax = num(row.secondaryMax);
    if (f === null || t === null || interp === null) errors.push({ table: 'growth_band_param', id, message: 'fromIndex/toIndex/interpFromIndex 必须是数值' });
    if (pmin === null || pmax === null || smin === null || smax === null) errors.push({ table: 'growth_band_param', id, message: 'power/secondary 端点必须是数值' });

    if (ct === 'band_linear') {
      if (f !== null && t !== null && f > t) errors.push({ table: 'growth_band_param', id, message: 'fromIndex<=toIndex 不成立' });
      if (interp !== null && t !== null && interp >= t) errors.push({ table: 'growth_band_param', id, message: 'interpFromIndex 必须 < toIndex（插值分母非零）' });
      if (interp !== null && f !== null && interp > f) errors.push({ table: 'growth_band_param', id, message: 'interpFromIndex 不得 > fromIndex' });
      if (pmin !== null && pmax !== null && pmin > pmax) errors.push({ table: 'growth_band_param', id, message: 'powerMin<=powerMax 不成立' });
      if ((tt === 'ship' || tt === 'pilot') && f !== null && t !== null) byTarget[tt].push({ from: f, to: t });
    } else if (ct === 'control_point') {
      if (f !== null && t !== null && f !== t) errors.push({ table: 'growth_band_param', id, message: 'control_point fromIndex 必须等于 toIndex' });
      if (interp !== null && f !== null && interp !== f) errors.push({ table: 'growth_band_param', id, message: 'control_point interpFromIndex 必须等于 fromIndex' });
      if (pmin !== null && pmax !== null && pmin !== pmax) errors.push({ table: 'growth_band_param', id, message: 'control_point powerMin 必须等于 powerMax' });
      if (smin !== null && smax !== null && smin !== smax) errors.push({ table: 'growth_band_param', id, message: 'control_point secondaryMin 必须等于 secondaryMax' });
    }
  }

  // ⑥第一段（细表§12.1）：取消建筑卡等级后舰上限=100，ship 战斗成长段铺满 1-100（41-100 占位持平作废）；
  // pilot 成长不走 band 属性（驾驶加成通道），band 表仍留 1-40 占位、随天赋接线批对齐。
  checkGrowthBandCoverage(errors, byTarget.ship, 1, 100, 'ship');
  checkGrowthBandCoverage(errors, byTarget.pilot, 1, 40, 'pilot');
}

/** 战斗表数组引用校验（不耦合 rsv/t11/t12 红线，那些只对默认实体/关系表生效）。 */
function battleArrayRefs(
  errors: S7ValidationError[], table: string, id: string, field: string,
  value: unknown, validIds: Set<string>, requireNonEmpty: boolean,
): void {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} 必须是数组` });
    return;
  }
  if (requireNonEmpty && value.length === 0) errors.push({ table, id, message: `${field} 不能为空` });
  for (const ref of value) {
    if (typeof ref !== 'string' || !validIds.has(ref)) {
      errors.push({ table, id, message: `${field} 引用的 "${String(ref)}" 不存在` });
    }
  }
}

/** 由 nodeTypeTag 推导战斗阶段（与 S7BattleEntry.deriveStageType 一致）。 */
function deriveBattleStage(nodeTypeTag: string): string {
  if (nodeTypeTag === 'boss') return 'boss';
  if (nodeTypeTag === 'elite') return 'elite';
  return 'normal';
}

/**
 * 轻量实时自动战斗表校验（BATTLE-RT-03）：
 * - 5 表字段枚举 / 数值 / 占格 / 时长规则。
 * - 交叉引用：unitRef / effectRef / pressureRef / nodeRef / encounterRef / spawnPlanRefs /
 *   bossPhaseRefs / unitStatRef / summonUnitRef(s) / bossNodeId 全部有效。
 * - 敌方格子 r0c0..r2c6；count===slotRefs.length；同行无重复格；按单位 size 展开 footprint 不越界 / 不重叠。
 * - encounter 覆盖 n001/n018/n075；n075 pressureRef===bp_n075；encounter↔spawn / encounter↔bossPhase 双向闭合。
 * - 每 Boss 最多 3 阶段且 start/mid/final 不重复；summonCountCap 0-10。
 * - 不做 pressure→hp/attack/armor 自动换算（RT-02 Codex 决策，pressure 仅作强度锚点绑定）。
 */
function validateBattle(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  const shipIds = new Set<string>(rowsByTable.ship_config.map((r) => String(r.shipId)));
  const enemyIds = new Set<string>(rowsByTable.enemy_schema_config.map((r) => String(r.enemyId)));
  const bossNodeIds = new Set<string>(rowsByTable.boss_node_config.map((r) => String(r.bossNodeId)));
  const templateIds = new Set<string>(rowsByTable.battle_template_config.map((r) => String(r.templateId)));
  const pressureIds = new Set<string>(rowsByTable.pressure_param.map((r) => String(r.rowId)));
  const mainlineById = new Map<string, Record<string, unknown>>();
  for (const r of rowsByTable.mainline_node_config) mainlineById.set(String(r.nodeId), r);

  const unitRows = rowsByTable.battle_unit_stat_param;
  const effectRows = rowsByTable.battle_effect_param;
  const encounterRows = rowsByTable.battle_encounter_param;
  const spawnRows = rowsByTable.battle_spawn_param;
  const phaseRows = rowsByTable.battle_boss_phase_param;

  const unitById = new Map<string, Record<string, unknown>>();
  for (const r of unitRows) unitById.set(String(r.rowId), r);
  const unitIds = new Set<string>(unitById.keys());
  const effectIds = new Set<string>(effectRows.map((r) => String(r.rowId)));
  const effectById = new Map<string, Record<string, unknown>>();
  for (const r of effectRows) effectById.set(String(r.rowId), r);
  const spawnById = new Map<string, Record<string, unknown>>();
  for (const r of spawnRows) spawnById.set(String(r.rowId), r);
  const spawnIds = new Set<string>(spawnById.keys());
  const phaseById = new Map<string, Record<string, unknown>>();
  for (const r of phaseRows) phaseById.set(String(r.rowId), r);
  const phaseIds = new Set<string>(phaseById.keys());
  const encounterById = new Map<string, Record<string, unknown>>();
  for (const r of encounterRows) encounterById.set(String(r.rowId), r);

  // ---- battle_unit_stat_param ----
  for (const row of unitRows) {
    const id = String(row.rowId);
    const tt = row.targetType;
    if (typeof tt !== 'string' || !S7_BATTLE_UNIT_TARGET_TYPES.includes(tt)) {
      errors.push({ table: 'battle_unit_stat_param', id, message: 'targetType 非法' });
    } else if (tt === 'prop') {
      if (row.unitRef !== 'none') {
        errors.push({ table: 'battle_unit_stat_param', id, message: 'prop 类单位 unitRef 必须为 none（不挂实体真源表）' });
      }
    } else {
      const validSet = tt === 'ship' ? shipIds : tt === 'enemy' ? enemyIds : bossNodeIds;
      if (typeof row.unitRef !== 'string' || !validSet.has(row.unitRef)) {
        errors.push({ table: 'battle_unit_stat_param', id, message: `unitRef "${String(row.unitRef)}" 不存在于对应实体表（${tt}）` });
      }
    }
    // positionType（第2.5块·块2 悬赏词缀）：仅 ship 行必填、∈ 5 定位型（灰盒占位·星舰内容块随真源校准）。
    if (tt === 'ship' && (typeof row.positionType !== 'string' || !S7_POSITION_TYPES.includes(row.positionType as never))) {
      errors.push({ table: 'battle_unit_stat_param', id, message: `positionType "${String(row.positionType)}" 非法（玩家星舰必填，允许：${S7_POSITION_TYPES.join('/')}）` });
    }
    for (const f of ['maxHp', 'attack', 'armor', 'attackIntervalSec', 'attackRangeCells'] as const) {
      const v = num(row[f]);
      if (v === null || v <= 0) errors.push({ table: 'battle_unit_stat_param', id, message: `${f} 必须为正数` });
    }
    const pe = num(row.passiveEnergyPerSec);
    if (pe === null || pe < 0) errors.push({ table: 'battle_unit_stat_param', id, message: 'passiveEnergyPerSec 必须 >= 0' });
    const sr = num(row.sizeRows);
    if (sr === null || !Number.isInteger(sr) || sr < 1 || sr > 3) errors.push({ table: 'battle_unit_stat_param', id, message: 'sizeRows 必须为 1-3 的整数' });
    const sc = num(row.sizeCols);
    if (sc === null || !Number.isInteger(sc) || sc < 1 || sc > 7) errors.push({ table: 'battle_unit_stat_param', id, message: 'sizeCols 必须为 1-7 的整数' });
    if (typeof row.targetingTag !== 'string' || !S7_BATTLE_UNIT_TARGETING_TAGS.includes(row.targetingTag)) {
      errors.push({ table: 'battle_unit_stat_param', id, message: 'targetingTag 非法（首版至少支持 nearest_random_tie）' });
    }
    for (const f of ['normalEffectRef', 'ultimateEffectRef', 'coreEffectRef'] as const) {
      const v = row[f];
      if (v !== 'none' && (typeof v !== 'string' || !effectIds.has(v))) {
        errors.push({ table: 'battle_unit_stat_param', id, message: `${f} "${String(v)}" 必须为 none 或有效 battle_effect_param.rowId` });
      }
    }
    const ucd = num(row.ultimateCdSec);
    if (ucd === null || ucd < 0) errors.push({ table: 'battle_unit_stat_param', id, message: 'ultimateCdSec 必须 >= 0（无大招写 0；块2 大招触发冷却）' });
    // ⑥8a 可选字段（缺席=不校·存在则查范围）：敌/Boss 行基线词条注入。
    if (row.controlResist !== undefined) {
      const cr = num(row.controlResist);
      if (cr === null || cr < 0 || cr > 1) errors.push({ table: 'battle_unit_stat_param', id, message: 'controlResist（可选）必须在 [0,1]' });
    }
    if (row.baseCritRate !== undefined) {
      const bcr = num(row.baseCritRate);
      if (bcr === null || bcr < 0 || bcr > 1) errors.push({ table: 'battle_unit_stat_param', id, message: 'baseCritRate（可选）必须在 [0,1]' });
    }
    if (row.baseCritDmg !== undefined) {
      const bcd = num(row.baseCritDmg);
      if (bcd === null || bcd < 0) errors.push({ table: 'battle_unit_stat_param', id, message: 'baseCritDmg（可选）必须 >= 0' });
    }
    // ⑦机制批① 单位行可选通道（缺席=不校）：敌方事件触发 extraTriggerBlocks / 叠层规则 stackRules。
    if (row.extraTriggerBlocks !== undefined) {
      if (!Array.isArray(row.extraTriggerBlocks) || row.extraTriggerBlocks.length === 0) {
        errors.push({ table: 'battle_unit_stat_param', id, message: 'extraTriggerBlocks（可选）必须为非空数组' });
      } else {
        for (const tb of row.extraTriggerBlocks as Array<Record<string, unknown>>) {
          if (!tb || typeof tb !== 'object' || tb.kind !== 'trigger') { errors.push({ table: 'battle_unit_stat_param', id, message: 'extraTriggerBlocks 每项必须为 kind="trigger" 的触发积木' }); continue; }
          if (typeof tb.on !== 'string' || !S7_TRIGGER_ON_VALUES.includes(tb.on)) errors.push({ table: 'battle_unit_stat_param', id, message: `extraTriggerBlocks.on "${String(tb.on)}" 非法` });
          if (typeof tb.effectRef !== 'string' || !effectIds.has(tb.effectRef)) errors.push({ table: 'battle_unit_stat_param', id, message: `extraTriggerBlocks.effectRef "${String(tb.effectRef)}" 必须为有效 battle_effect_param.rowId` });
          if (tb.on === 'cd') {
            const cd = num(tb.cdSec);
            if (cd === null || !(cd > 0)) errors.push({ table: 'battle_unit_stat_param', id, message: 'extraTriggerBlocks cd 型必须给正数 cdSec' });
          }
          if (tb.onKillRoleTags !== undefined && (!Array.isArray(tb.onKillRoleTags) || tb.onKillRoleTags.length === 0 || tb.onKillRoleTags.some((x: unknown) => typeof x !== 'string'))) {
            errors.push({ table: 'battle_unit_stat_param', id, message: 'extraTriggerBlocks.onKillRoleTags（可选）必须为非空字符串数组' });
          }
        }
      }
    }
    if (row.stackRules !== undefined) {
      if (!Array.isArray(row.stackRules) || row.stackRules.length === 0) {
        errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules（可选）必须为非空数组' });
      } else {
        for (const sr of row.stackRules as Array<Record<string, unknown>>) {
          if (!sr || typeof sr !== 'object') { errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules 每项必须为对象' }); continue; }
          if (typeof sr.ruleId !== 'string' || sr.ruleId.length === 0) errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules.ruleId 必须为非空字符串' });
          if (typeof sr.on !== 'string' || !S7_STACK_RULE_ON_VALUES.includes(sr.on)) errors.push({ table: 'battle_unit_stat_param', id, message: `stackRules.on "${String(sr.on)}" 非法` });
          if (typeof sr.stat !== 'string' || !S7_STACK_RULE_STAT_VALUES.includes(sr.stat)) errors.push({ table: 'battle_unit_stat_param', id, message: `stackRules.stat "${String(sr.stat)}" 非法` });
          const ps = num(sr.perStack);
          if (ps === null || !(ps > 0) || !Number.isFinite(ps)) errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules.perStack 必须为正数' });
          if (sr.maxStacks !== undefined) {
            const ms = num(sr.maxStacks);
            if (ms === null || !Number.isInteger(ms) || ms < 1) errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules.maxStacks（可选）必须为 >= 1 的整数' });
          }
          if (sr.breakOn !== undefined && sr.breakOn !== 'attack_gap' && sr.breakOn !== 'target_switch') errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules.breakOn（可选）必须为 attack_gap | target_switch' });
          if (sr.breakOn === 'attack_gap') {
            const gap = num(sr.breakGapSec);
            if (gap === null || !(gap > 0)) errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules breakOn=attack_gap 必须给正数 breakGapSec' });
          }
          if (sr.breakAction !== undefined && sr.breakAction !== 'clear' && sr.breakAction !== 'decay_1') errors.push({ table: 'battle_unit_stat_param', id, message: 'stackRules.breakAction（可选）必须为 clear | decay_1' });
        }
      }
    }
  }

  // ---- battle_effect_param ----
  for (const row of effectRows) {
    const id = String(row.rowId);
    if (typeof row.effectKind !== 'string' || !S7_BATTLE_EFFECT_KINDS.includes(row.effectKind)) errors.push({ table: 'battle_effect_param', id, message: 'effectKind 非法' });
    if (typeof row.effectType !== 'string' || !S7_BATTLE_EFFECT_TYPES.includes(row.effectType)) errors.push({ table: 'battle_effect_param', id, message: 'effectType 非法' });
    const power = num(row.effectPower);
    if (power === null || power < 0) errors.push({ table: 'battle_effect_param', id, message: 'effectPower 必须 >= 0' });
    const mt = num(row.maxTargets);
    if (mt === null || !Number.isInteger(mt) || mt < 1) errors.push({ table: 'battle_effect_param', id, message: 'maxTargets 必须为 >= 1 的整数' });
    const dur = num(row.durationSec);
    if (dur === null || dur < 0) errors.push({ table: 'battle_effect_param', id, message: 'durationSec 必须 >= 0' });
    if (typeof row.targetingTag !== 'string' || !ID_PATTERN.test(row.targetingTag)) errors.push({ table: 'battle_effect_param', id, message: 'targetingTag 不合法' });
    const stTag = row.stateTag;
    if (typeof stTag !== 'string' || !S7_BATTLE_STATE_TAGS.includes(stTag)) errors.push({ table: 'battle_effect_param', id, message: 'stateTag 非法' });
    else if (stTag !== 'none' && (dur === null || dur <= 0)) errors.push({ table: 'battle_effect_param', id, message: '状态效果 durationSec 必须为正数' });
    const summon = row.summonUnitRef;
    if (summon !== 'none') {
      if (typeof summon !== 'string' || !unitIds.has(summon)) errors.push({ table: 'battle_effect_param', id, message: `summonUnitRef "${String(summon)}" 必须为 none 或有效 battle_unit_stat_param.rowId` });
      if (dur === null || dur <= 0) errors.push({ table: 'battle_effect_param', id, message: '召唤效果 durationSec 必须为正数' });
    }
    // ⑥8a 可选字段（缺席=不校·存在则查范围）：状态施加概率 / 召唤生命周期包。
    if (row.stateChance !== undefined) {
      const scv = num(row.stateChance);
      if (scv === null || scv <= 0 || scv > 1) errors.push({ table: 'battle_effect_param', id, message: 'stateChance（可选）必须在 (0,1]' });
      else if (stTag === 'none') errors.push({ table: 'battle_effect_param', id, message: 'stateChance（可选）要求 stateTag ≠ none' });
    }
    if (row.summonExpireSec !== undefined) {
      const ses = num(row.summonExpireSec);
      if (ses === null || ses <= 0) errors.push({ table: 'battle_effect_param', id, message: 'summonExpireSec（可选）必须为正数' });
      else if (summon === 'none') errors.push({ table: 'battle_effect_param', id, message: 'summonExpireSec（可选）要求 summonUnitRef ≠ none' });
    }
    if (row.despawnWithSource !== undefined) {
      if (typeof row.despawnWithSource !== 'boolean') errors.push({ table: 'battle_effect_param', id, message: 'despawnWithSource（可选）必须为布尔' });
      else if (summon === 'none') errors.push({ table: 'battle_effect_param', id, message: 'despawnWithSource（可选）要求 summonUnitRef ≠ none' });
    }
    if (row.summonSourceCap !== undefined) {
      const ssc = num(row.summonSourceCap);
      if (ssc === null || !Number.isInteger(ssc) || ssc < 1) errors.push({ table: 'battle_effect_param', id, message: 'summonSourceCap（可选）必须为 >= 1 的整数' });
      else if (summon === 'none') errors.push({ table: 'battle_effect_param', id, message: 'summonSourceCap（可选）要求 summonUnitRef ≠ none' });
    }
    // ⑦机制批① 字段组（缺席=不校·全部旧配置不带这些字段）：
    // apply_state 必须选态；框架修正 tag 必须给幅度；周期 tag 必须给结算通道；字段只许配给对应 tag 族。
    const isModTag = typeof stTag === 'string' && S7_MOD_STATE_TAGS.includes(stTag);
    const isPeriodicTag = typeof stTag === 'string' && S7_PERIODIC_STATE_TAGS.includes(stTag);
    const isFrameworkTag = isModTag || isPeriodicTag;
    if (row.effectType === 'apply_state' && stTag === 'none') {
      errors.push({ table: 'battle_effect_param', id, message: 'apply_state 效果要求 stateTag ≠ none' });
    }
    if (isModTag) {
      const amt = num(row.stateAmount);
      if (amt === null || !(amt > 0) || !Number.isFinite(amt)) errors.push({ table: 'battle_effect_param', id, message: `修正状态 ${String(stTag)} 要求 stateAmount 为正数（方向在 tag 名里）` });
    } else if (row.stateAmount !== undefined) {
      errors.push({ table: 'battle_effect_param', id, message: 'stateAmount（可选）仅允许配给 M1 修正状态 tag' });
    }
    const tickChannels = ['stateTickAtkPct', 'stateTickMaxHpPct', 'stateTickFlat'] as const;
    if (isPeriodicTag) {
      let anyPositive = false;
      for (const f of tickChannels) {
        if (row[f] === undefined) continue;
        const v = num(row[f]);
        if (v === null || v < 0 || !Number.isFinite(v)) errors.push({ table: 'battle_effect_param', id, message: `${f}（可选）必须为 >= 0 的有限数` });
        else if (v > 0) anyPositive = true;
      }
      if (!anyPositive) errors.push({ table: 'battle_effect_param', id, message: `周期状态 ${String(stTag)} 要求 stateTickAtkPct/stateTickMaxHpPct/stateTickFlat 至少一项 > 0` });
      if (row.stateTickIntervalSec !== undefined) {
        const iv = num(row.stateTickIntervalSec);
        if (iv === null || !(iv > 0)) errors.push({ table: 'battle_effect_param', id, message: 'stateTickIntervalSec（可选）必须为正数' });
      }
    } else {
      for (const f of [...tickChannels, 'stateTickIntervalSec'] as const) {
        if (row[f] !== undefined) errors.push({ table: 'battle_effect_param', id, message: `${f}（可选）仅允许配给周期状态 tag（burn/regen）` });
      }
    }
    if (row.stateMaxStacks !== undefined) {
      const sms = num(row.stateMaxStacks);
      if (sms === null || !Number.isInteger(sms) || sms < 1) errors.push({ table: 'battle_effect_param', id, message: 'stateMaxStacks（可选）必须为 >= 1 的整数' });
      else if (!isFrameworkTag) errors.push({ table: 'battle_effect_param', id, message: 'stateMaxStacks（可选）仅允许配给框架状态 tag' });
    }
    if (row.stateExpireAction !== undefined) {
      if (row.stateExpireAction !== 'clear' && row.stateExpireAction !== 'decay_1') errors.push({ table: 'battle_effect_param', id, message: 'stateExpireAction（可选）必须为 clear | decay_1' });
      else if (!isFrameworkTag) errors.push({ table: 'battle_effect_param', id, message: 'stateExpireAction（可选）仅允许配给框架状态 tag' });
    }
    if (row.alsoApplyStateRefs !== undefined) {
      const refs = row.alsoApplyStateRefs;
      if (!Array.isArray(refs) || refs.length === 0 || refs.some((r) => typeof r !== 'string')) {
        errors.push({ table: 'battle_effect_param', id, message: 'alsoApplyStateRefs（可选）必须为非空字符串数组' });
      } else {
        if (typeof row.effectType !== 'string' || !S7_ALSO_APPLY_HOST_TYPES.includes(row.effectType)) {
          errors.push({ table: 'battle_effect_param', id, message: 'alsoApplyStateRefs（可选）仅允许配在伤害/护盾/治疗/状态类效果行上' });
        }
        for (const ref of refs) {
          const sub = effectById.get(ref);
          if (!sub) { errors.push({ table: 'battle_effect_param', id, message: `alsoApplyStateRefs 引用的 "${ref}" 不存在于 battle_effect_param` }); continue; }
          if (ref === id) errors.push({ table: 'battle_effect_param', id, message: 'alsoApplyStateRefs 不允许引用自身' });
          if (sub.stateTag === 'none') errors.push({ table: 'battle_effect_param', id, message: `alsoApplyStateRefs 引用的 "${ref}" 必须 stateTag ≠ none` });
          if (sub.alsoApplyStateRefs !== undefined) errors.push({ table: 'battle_effect_param', id, message: `alsoApplyStateRefs 引用的 "${ref}" 自身不得再带 alsoApplyStateRefs（禁链式）` });
        }
      }
    }
    // ⑨机制批② M5 字段组（缺席=不校·全部旧配置不带这些字段）：
    // 净化/驱散 dispelCount（宿主限护盾/治疗/purify）；purify 必须带 dispelCount；dispelHardControl/applyUndispellable 门控。
    let dispelN: number | null = null;
    if (row.dispelCount !== undefined) {
      dispelN = num(row.dispelCount);
      if (dispelN === null || !Number.isInteger(dispelN) || dispelN < 1) {
        errors.push({ table: 'battle_effect_param', id, message: 'dispelCount（可选）必须为 >= 1 的整数' });
      } else if (typeof row.effectType !== 'string' || !S7_DISPEL_HOST_TYPES.includes(row.effectType)) {
        errors.push({ table: 'battle_effect_param', id, message: 'dispelCount（可选）仅允许配在护盾/治疗行或 purify 效果上' });
      }
    }
    if (row.effectType === 'purify' && (dispelN === null || dispelN < 1)) {
      errors.push({ table: 'battle_effect_param', id, message: 'purify 效果要求 dispelCount >= 1' });
    }
    if (row.dispelHardControl !== undefined) {
      if (typeof row.dispelHardControl !== 'boolean') errors.push({ table: 'battle_effect_param', id, message: 'dispelHardControl（可选）必须为布尔' });
      else if (row.dispelCount === undefined) errors.push({ table: 'battle_effect_param', id, message: 'dispelHardControl（可选）要求同时配 dispelCount' });
    }
    if (row.applyUndispellable !== undefined) {
      if (typeof row.applyUndispellable !== 'boolean') errors.push({ table: 'battle_effect_param', id, message: 'applyUndispellable（可选）必须为布尔' });
      else if (stTag === 'none') errors.push({ table: 'battle_effect_param', id, message: 'applyUndispellable（可选）要求 stateTag ≠ none（标记被施加的状态）' });
    }
  }

  // ---- battle_encounter_param ----
  for (const row of encounterRows) {
    const id = String(row.rowId);
    if (typeof row.nodeRef !== 'string' || !mainlineById.has(row.nodeRef)) errors.push({ table: 'battle_encounter_param', id, message: `nodeRef "${String(row.nodeRef)}" 不是有效主线节点` });
    const stage = row.stageType;
    if (typeof stage !== 'string' || !S7_STAGE_TYPES.includes(stage)) errors.push({ table: 'battle_encounter_param', id, message: 'stageType 非法' });
    if (typeof row.templateRef !== 'string' || !templateIds.has(row.templateRef)) errors.push({ table: 'battle_encounter_param', id, message: `templateRef "${String(row.templateRef)}" 非法（仅 t01-t10）` });
    if (typeof row.problemTagRef !== 'string' || !S7_PROBLEM_TAGS.includes(row.problemTagRef)) errors.push({ table: 'battle_encounter_param', id, message: 'problemTagRef 非法' });
    if (typeof row.secondaryPressureTag !== 'string' || !S7_SECONDARY_PRESSURE_TAGS.includes(row.secondaryPressureTag)) errors.push({ table: 'battle_encounter_param', id, message: 'secondaryPressureTag 非法' });
    if (typeof row.pressureRef !== 'string' || !pressureIds.has(row.pressureRef)) errors.push({ table: 'battle_encounter_param', id, message: `pressureRef "${String(row.pressureRef)}" 不存在于 pressure_param` });
    battleArrayRefs(errors, 'battle_encounter_param', id, 'enemyUnitStatRefs', row.enemyUnitStatRefs, unitIds, true);
    battleArrayRefs(errors, 'battle_encounter_param', id, 'spawnPlanRefs', row.spawnPlanRefs, spawnIds, true);
    battleArrayRefs(errors, 'battle_encounter_param', id, 'bossPhaseRefs', row.bossPhaseRefs, phaseIds, false);
    if (row.playerSlotPolicy !== 'five_ship_3x3_default') errors.push({ table: 'battle_encounter_param', id, message: 'playerSlotPolicy 首版必须为 five_ship_3x3_default' });
    const tl = num(row.timeLimitSec);
    if (tl === null || tl <= 0) errors.push({ table: 'battle_encounter_param', id, message: 'timeLimitSec 必须为正数' });
    if (row.battleSeedPolicy !== 'node_id_plus_run_seed') errors.push({ table: 'battle_encounter_param', id, message: 'battleSeedPolicy 首版必须为 node_id_plus_run_seed' });
    if (stage !== 'boss' && Array.isArray(row.bossPhaseRefs) && row.bossPhaseRefs.length > 0) {
      errors.push({ table: 'battle_encounter_param', id, message: '非 boss 战斗的 bossPhaseRefs 必须为空数组' });
    }
    const mline = typeof row.nodeRef === 'string' ? mainlineById.get(row.nodeRef) : undefined;
    if (mline && typeof stage === 'string') {
      const derived = deriveBattleStage(String(mline.nodeTypeTag));
      if (derived !== stage) errors.push({ table: 'battle_encounter_param', id, message: `stageType "${stage}" 与主线节点 nodeTypeTag 推导（${derived}）不一致` });
    }
    if (Array.isArray(row.spawnPlanRefs)) {
      for (const sref of row.spawnPlanRefs) {
        const s = typeof sref === 'string' ? spawnById.get(sref) : undefined;
        if (s && String(s.encounterRef) !== id) errors.push({ table: 'battle_encounter_param', id, message: `spawnPlanRefs 引用的 "${String(sref)}" 的 encounterRef 不指向本 encounter（双向闭合失败）` });
      }
    }
    if (Array.isArray(row.bossPhaseRefs)) {
      for (const pref of row.bossPhaseRefs) {
        const ph = typeof pref === 'string' ? phaseById.get(pref) : undefined;
        if (ph && String(ph.bossNodeId) !== String(row.nodeRef)) errors.push({ table: 'battle_encounter_param', id, message: `bossPhaseRefs 引用的 "${String(pref)}" 不属于 boss 节点 ${String(row.nodeRef)}（双向闭合失败）` });
      }
    }
  }

  const coveredNodes = new Set<string>(encounterRows.map((r) => String(r.nodeRef)));
  for (const need of ['n001', 'n084', 'n150']) {
    if (!coveredNodes.has(need)) errors.push({ table: 'battle_encounter_param', id: need, message: `必须覆盖节点 ${need} 的 encounter` });
  }
  const finalEnc = encounterRows.find((r) => String(r.nodeRef) === 'n150');
  if (finalEnc && finalEnc.pressureRef !== 'bp_n150') errors.push({ table: 'battle_encounter_param', id: String(finalEnc.rowId), message: 'n150（终Boss）encounter 的 pressureRef 必须为 bp_n150' });

  // ---- battle_spawn_param ----
  for (const row of spawnRows) {
    const id = String(row.rowId);
    const encRef = row.encounterRef;
    const enc = typeof encRef === 'string' ? encounterById.get(encRef) : undefined;
    if (!enc) errors.push({ table: 'battle_spawn_param', id, message: `encounterRef "${String(encRef)}" 不存在` });
    const wave = num(row.waveIndex);
    if (wave === null || !Number.isInteger(wave) || wave < 1) errors.push({ table: 'battle_spawn_param', id, message: 'waveIndex 必须为 >= 1 的整数' });
    const unitRef = row.unitStatRef;
    const unit = typeof unitRef === 'string' ? unitById.get(unitRef) : undefined;
    if (!unit) errors.push({ table: 'battle_spawn_param', id, message: `unitStatRef "${String(unitRef)}" 不存在` });
    else if (enc && Array.isArray(enc.enemyUnitStatRefs) && !enc.enemyUnitStatRefs.includes(unitRef)) {
      errors.push({ table: 'battle_spawn_param', id, message: `unitStatRef "${String(unitRef)}" 不在 encounter ${String(encRef)} 的 enemyUnitStatRefs 内` });
    }
    const sd = num(row.spawnDelaySec);
    if (sd === null || sd < 0) errors.push({ table: 'battle_spawn_param', id, message: 'spawnDelaySec 必须 >= 0' });
    const mc = num(row.maxConcurrentOnField);
    const gridCells = S7_ENEMY_ROWS * S7_ENEMY_COLS;
    if (mc === null || !Number.isInteger(mc) || mc < 1 || mc > gridCells) errors.push({ table: 'battle_spawn_param', id, message: `maxConcurrentOnField 必须为 1-${gridCells} 的整数` });
    const slots = row.slotRefs;
    if (!Array.isArray(slots)) {
      errors.push({ table: 'battle_spawn_param', id, message: 'slotRefs 必须是数组' });
    } else {
      const cnt = num(row.count);
      if (cnt === null || cnt !== slots.length) errors.push({ table: 'battle_spawn_param', id, message: `count (${String(row.count)}) 必须等于 slotRefs.length (${slots.length})` });
      const anchorsSeen = new Set<string>();
      const footprint = new Set<string>();
      const sr = unit ? num(unit.sizeRows) : null;
      const sc = unit ? num(unit.sizeCols) : null;
      for (const slot of slots) {
        if (typeof slot !== 'string' || !BATTLE_GRID_SLOT_PATTERN.test(slot)) {
          errors.push({ table: 'battle_spawn_param', id, message: `slotRefs 含非法格子 "${String(slot)}"（仅 r0c0..r${S7_ENEMY_ROWS - 1}c${S7_ENEMY_COLS - 1}）` });
          continue;
        }
        if (anchorsSeen.has(slot)) errors.push({ table: 'battle_spawn_param', id, message: `slotRefs 含重复格子 "${slot}"` });
        anchorsSeen.add(slot);
        if (sr !== null && sc !== null) {
          const baseR = Number(slot[1]);
          const baseC = Number(slot[3]);
          for (let dr = 0; dr < sr; dr += 1) {
            for (let dc = 0; dc < sc; dc += 1) {
              const rr = baseR + dr;
              const cc = baseC + dc;
              if (rr > S7_ENEMY_ROWS - 1 || cc > S7_ENEMY_COLS - 1) {
                errors.push({ table: 'battle_spawn_param', id, message: `单位 ${String(unitRef)} 以 ${slot} 为锚点的 ${sr}x${sc} 占格越界（r${rr}c${cc}）` });
                continue;
              }
              const key = `r${rr}c${cc}`;
              if (footprint.has(key)) errors.push({ table: 'battle_spawn_param', id, message: `占格重叠于 ${key}` });
              footprint.add(key);
            }
          }
        }
      }
    }
  }

  // ---- battle_boss_phase_param ----
  const phaseTagsByBoss = new Map<string, string[]>();
  for (const row of phaseRows) {
    const id = String(row.rowId);
    const bnid = row.bossNodeId;
    if (typeof bnid !== 'string' || !bossNodeIds.has(bnid)) errors.push({ table: 'battle_boss_phase_param', id, message: `bossNodeId "${String(bnid)}" 不存在` });
    const ptag = row.phaseTag;
    if (typeof ptag !== 'string' || !S7_BOSS_PHASE_TAGS.includes(ptag)) errors.push({ table: 'battle_boss_phase_param', id, message: 'phaseTag 非法' });
    const trig = row.triggerType;
    if (typeof trig !== 'string' || !S7_BOSS_PHASE_TRIGGER_TYPES.includes(trig)) errors.push({ table: 'battle_boss_phase_param', id, message: 'triggerType 非法' });
    const tv = num(row.triggerValue);
    if (tv === null) errors.push({ table: 'battle_boss_phase_param', id, message: 'triggerValue 必须是数值' });
    else if (trig === 'battle_start' && tv !== 0) errors.push({ table: 'battle_boss_phase_param', id, message: 'battle_start 的 triggerValue 必须为 0' });
    battleArrayRefs(errors, 'battle_boss_phase_param', id, 'effectRefs', row.effectRefs, effectIds, true);
    battleArrayRefs(errors, 'battle_boss_phase_param', id, 'summonUnitRefs', row.summonUnitRefs, unitIds, false);
    const cap = num(row.summonCountCap);
    if (cap === null || !Number.isInteger(cap) || cap < 0 || cap > 10) errors.push({ table: 'battle_boss_phase_param', id, message: 'summonCountCap 必须为 0-10 的整数' });
    if (typeof bnid === 'string' && typeof ptag === 'string') {
      const arr = phaseTagsByBoss.get(bnid) ?? [];
      arr.push(ptag);
      phaseTagsByBoss.set(bnid, arr);
    }
  }
  for (const [boss, tags] of phaseTagsByBoss) {
    if (tags.length > 3) errors.push({ table: 'battle_boss_phase_param', id: boss, message: `Boss ${boss} 最多 3 个阶段，实际 ${tags.length}` });
    if (new Set(tags).size !== tags.length) errors.push({ table: 'battle_boss_phase_param', id: boss, message: `Boss ${boss} phaseTag 重复（start/mid/final 不可重复）` });
  }
}

// 悬赏词缀表（第2.5块·块2 星港悬赏板，GDD S10.8）：positionType/条件/修正积木逐条契约校验。
function validateCommissionAffix(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
): void {
  for (const row of rowsByTable.commission_affix_param ?? []) {
    const id = String(row.rowId);
    if (typeof row.affixName !== 'string' || row.affixName.length === 0) errors.push({ table: 'commission_affix_param', id, message: 'affixName 不能为空' });
    if (typeof row.effectText !== 'string' || row.effectText.length === 0) errors.push({ table: 'commission_affix_param', id, message: 'effectText 不能为空' });
    if (typeof row.positionType !== 'string' || !S7_AFFIX_TARGET_TYPES.includes(row.positionType)) {
      errors.push({ table: 'commission_affix_param', id, message: `positionType "${String(row.positionType)}" 非法（允许：${S7_AFFIX_TARGET_TYPES.join('/')}）` });
    }
    const cond = num(row.condLineupMax);
    if (cond === null || !Number.isInteger(cond) || cond < 0) errors.push({ table: 'commission_affix_param', id, message: 'condLineupMax 必须为 >=0 的整数（0=无条件）' });
    if (!Array.isArray(row.mods) || row.mods.length === 0) {
      errors.push({ table: 'commission_affix_param', id, message: 'mods 必须为非空数组' });
      continue;
    }
    for (const raw of row.mods) {
      const mod = asRow(raw);
      if (!mod) { errors.push({ table: 'commission_affix_param', id, message: 'mods 含非对象项' }); continue; }
      const ch = mod.channel;
      if (num(mod.value) === null) errors.push({ table: 'commission_affix_param', id, message: 'mod.value 必须为数值' });
      if (ch === 'stat') {
        if (typeof mod.key !== 'string' || !S7_STAT_KEYS.includes(mod.key)) errors.push({ table: 'commission_affix_param', id, message: `stat mod.key "${String(mod.key)}" 非法（允许：${S7_STAT_KEYS.join('/')}）` });
        if (mod.op !== undefined && mod.op !== 'flat' && mod.op !== 'pct') errors.push({ table: 'commission_affix_param', id, message: 'stat mod.op 仅允许 flat/pct（缺省 pct；词缀不用 set）' });
      } else if (ch === 'affix') {
        if (typeof mod.key !== 'string' || !S7_AFFIX_KEYS.includes(mod.key)) errors.push({ table: 'commission_affix_param', id, message: `affix mod.key "${String(mod.key)}" 非法（允许：${S7_AFFIX_KEYS.join('/')}）` });
      } else {
        errors.push({ table: 'commission_affix_param', id, message: `mod.channel "${String(ch)}" 非法（允许 stat/affix）` });
      }
    }
  }
}

// 每日推演题库（第2.5块·块4，GDD S10.9）：静态那道闸(c 候选数∈[6,8]) + 结构合法（.mjs 的 TS 镜像）。
// 要真跑引擎的两道闸(a 作者解回放 / b 蒙特卡洛乱选率<30%) 在 vitest s7_daily_puzzle_solver.test.ts（校验器跑不了引擎）。
const S7_PUZZLE_THREAT_TYPES = ['backline', 'shield', 'summon', 'heal', 'burst', 'swarm', 'berserk', 'mixed'];
const S7_PUZZLE_QUALITIES = ['fine', 'superior', 'legendary'];
const S7_PUZZLE_PLAYER_SLOT = /^p[0-2]c[0-2]$/;
const S7_PUZZLE_ENEMY_SLOT = /^r[0-4]c[0-6]$/;
const S7_PUZZLE_MIN_CAND = 6;
const S7_PUZZLE_MAX_CAND = 8;
const S7_PUZZLE_LINEUP = 5;
function validateDailyPuzzle(
  errors: S7ValidationError[], rowsByTable: Record<string, Record<string, unknown>[]>,
  refs: { ships: Set<string>; pilots: Set<string>; cores: Set<string>; plugins: Set<string> },
): void {
  const enemyUnitIds = new Set<string>();
  for (const r of rowsByTable.battle_unit_stat_param ?? []) if (r.targetType === 'enemy') enemyUnitIds.add(String(r.rowId));
  const push = (id: string, message: string): void => { errors.push({ table: 'daily_puzzle_param', id, message }); };

  for (const row of rowsByTable.daily_puzzle_param ?? []) {
    const id = String(row.rowId);
    if (typeof row.threatType !== 'string' || !S7_PUZZLE_THREAT_TYPES.includes(row.threatType)) push(id, `threatType "${String(row.threatType)}" 非法`);
    if (typeof row.threatHint !== 'string' || row.threatHint.length === 0) push(id, 'threatHint 不能为空');

    const ef = row.enemyFormation;
    if (!Array.isArray(ef) || ef.length === 0) push(id, 'enemyFormation 必须为非空数组');
    else {
      const eslots = new Set<string>();
      for (const raw of ef) {
        const e = asRow(raw);
        if (!e) { push(id, 'enemyFormation 含非对象项'); continue; }
        if (typeof e.unitStatRef !== 'string' || !enemyUnitIds.has(e.unitStatRef)) push(id, `enemyFormation.unitStatRef "${String(e.unitStatRef)}" 不是 enemy 战斗单位`);
        if (typeof e.slotRef !== 'string' || !S7_PUZZLE_ENEMY_SLOT.test(e.slotRef)) push(id, `enemyFormation.slotRef "${String(e.slotRef)}" 非法（r0c0..r4c6）`);
        else if (eslots.has(e.slotRef)) push(id, `enemyFormation.slotRef "${e.slotRef}" 重复`); else eslots.add(e.slotRef);
      }
    }
    for (const f of ['enemyHpPct', 'enemyAtkPct']) if (row[f] !== undefined && num(row[f]) === null) push(id, `${f} 必须为数值`);

    const packs = row.candidatePacks;
    const packIds = new Set<string>();
    if (!Array.isArray(packs)) push(id, 'candidatePacks 必须为数组');
    else {
      if (packs.length < S7_PUZZLE_MIN_CAND || packs.length > S7_PUZZLE_MAX_CAND) push(id, `候选战队包数量必须∈[${S7_PUZZLE_MIN_CAND},${S7_PUZZLE_MAX_CAND}]（闸 c），实际 ${packs.length}`);
      for (const raw of packs) {
        const pk = asRow(raw);
        if (!pk) { push(id, 'candidatePacks 含非对象项'); continue; }
        if (typeof pk.packId !== 'string' || pk.packId.length === 0) push(id, 'pack.packId 不能为空');
        else if (packIds.has(pk.packId)) push(id, `pack.packId "${pk.packId}" 重复`); else packIds.add(pk.packId);
        if (typeof pk.shipId !== 'string' || !refs.ships.has(pk.shipId)) push(id, `pack.shipId "${String(pk.shipId)}" 不存在`);
        if (typeof pk.pilotId !== 'string' || !refs.pilots.has(pk.pilotId)) push(id, `pack.pilotId "${String(pk.pilotId)}" 不存在`);
        if (pk.coreId !== undefined && (typeof pk.coreId !== 'string' || !refs.cores.has(pk.coreId))) push(id, `pack.coreId "${String(pk.coreId)}" 不存在`);
        if (pk.plugins !== undefined) {
          if (!Array.isArray(pk.plugins) || pk.plugins.length > 3) push(id, 'pack.plugins 必须为数组且≤3');
          else for (const rawPl of pk.plugins) {
            const pl = asRow(rawPl);
            if (!pl || typeof pl.pluginId !== 'string' || !refs.plugins.has(pl.pluginId)) push(id, `pack.plugin "${String(pl?.pluginId)}" 不存在`);
            if (!pl || typeof pl.quality !== 'string' || !S7_PUZZLE_QUALITIES.includes(pl.quality)) push(id, `pack.plugin.quality "${String(pl?.quality)}" 非法（fine/superior/legendary）`);
          }
        }
      }
    }

    const sol = row.authorSolution;
    if (!Array.isArray(sol) || sol.length !== S7_PUZZLE_LINEUP) push(id, `authorSolution 必须正好 ${S7_PUZZLE_LINEUP} 项，实际 ${Array.isArray(sol) ? sol.length : '非数组'}`);
    else {
      const pslots = new Set<string>();
      for (const raw of sol) {
        const s = asRow(raw);
        if (!s || typeof s.packId !== 'string' || !packIds.has(s.packId)) push(id, `authorSolution.packId "${String(s?.packId)}" 不在候选内`);
        if (!s || typeof s.slotRef !== 'string' || !S7_PUZZLE_PLAYER_SLOT.test(s.slotRef)) push(id, `authorSolution.slotRef "${String(s?.slotRef)}" 非法（p0c0..p2c2）`);
        else if (pslots.has(s.slotRef)) push(id, `authorSolution.slotRef "${s.slotRef}" 重复`); else pslots.add(s.slotRef);
      }
    }
  }
}

export function validateS7ConfigBundle(
  bundle: Record<S7ConfigTableName, unknown[]>,
): S7ValidationError[] {
  const errors: S7ValidationError[] = [];
  const rowsByTable: Record<string, Record<string, unknown>[]> = {};

  for (const table of TIER_A_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierACommon(errors, table, rows);
  }
  for (const table of TIER_B_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }
  for (const table of TIER_GROWTH_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }
  for (const table of TIER_B_REL_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_B_BLD_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBBldCommon(errors, table, rows);
  }
  for (const table of TIER_C_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_D_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_BATTLE_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: '-', message: '配置表必须是数组' });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }

  const shipIds = new Set<string>(rowsByTable.ship_config.map((r) => String(r.shipId)));
  const coreIds = new Set<string>(rowsByTable.core_config.map((r) => String(r.coreId)));
  const pilotIds = new Set<string>(rowsByTable.pilot_config.map((r) => String(r.pilotId)));
  const pluginIds = new Set<string>(rowsByTable.plugin_config.map((r) => String(r.pluginId)));
  const templateIds = new Set<string>(rowsByTable.battle_template_config.map((r) => String(r.templateId)));
  // 注意：禁用 [...shipIds, ...coreIds] 的 Set 展开——Cocos 微信小游戏构建对"展开 Set"会降级编错成空数组
  // （同 S7MainlineProgress 注释里的 [...new Set()] 坑），导致默认实体表为空、插件 fitRefs 全部误报不存在。
  // 改用 Set.forEach 逐个 add（方法调用，不走会被编错的迭代展开协议）。
  const shipAndCoreIds = new Set<string>();
  shipIds.forEach((x) => shipAndCoreIds.add(x));
  coreIds.forEach((x) => shipAndCoreIds.add(x));

  for (const row of rowsByTable.battle_template_config) {
    const id = String(row.templateId);
    if (typeof row.mainProblemTag !== 'string' || !S7_PROBLEM_TAGS.includes(row.mainProblemTag)) errors.push({ table: 'battle_template_config', id, message: 'mainProblemTag 非法' });
    if (row.secondaryTagCap !== 1) errors.push({ table: 'battle_template_config', id, message: 'secondaryTagCap 必须为 1' });
    checkStringArrayEnum(errors, 'battle_template_config', id, 'applicableStageTypes', row.applicableStageTypes, S7_STAGE_TYPES, true);
    if (row.reservedSlotFlag !== false) errors.push({ table: 'battle_template_config', id, message: 'Tier A 默认模板 reservedSlotFlag 必须为 false' });
  }
  for (const row of rowsByTable.ship_config) {
    const id = String(row.shipId);
    if (typeof row.shipType !== 'string' || !S7_SHIP_TYPES.includes(row.shipType)) errors.push({ table: 'ship_config', id, message: 'shipType 非法' });
    checkStringArrayEnum(errors, 'ship_config', id, 'coverProblemTags', row.coverProblemTags, S7_PROBLEM_TAGS, true);
  }
  for (const row of rowsByTable.pilot_config) {
    const id = String(row.pilotId);
    checkStringArrayEnum(errors, 'pilot_config', id, 'coverProblemTags', row.coverProblemTags, S7_PROBLEM_TAGS, true);
  }
  for (const row of rowsByTable.core_config) {
    const id = String(row.coreId);
    checkStringArrayEnum(errors, 'core_config', id, 'coverProblemTags', row.coverProblemTags, S7_PROBLEM_TAGS, true);
    checkRefs(errors, 'core_config', id, 'shipFitRefs', row.shipFitRefs, shipIds);
  }
  for (const row of rowsByTable.plugin_config) {
    const id = String(row.pluginId);
    if (typeof row.slotTag !== 'string' || !S7_PLUGIN_SLOTS.includes(row.slotTag)) errors.push({ table: 'plugin_config', id, message: 'slotTag 非法' });
    checkStringArrayEnum(errors, 'plugin_config', id, 'coverProblemTags', row.coverProblemTags, S7_PROBLEM_TAGS, true);
    checkRefs(errors, 'plugin_config', id, 'fitRefs', row.fitRefs, shipAndCoreIds);
  }

  validateTierB(errors, rowsByTable);
  validateGrowth(errors, rowsByTable);
  validateTierBRel(errors, rowsByTable, {
    ships: shipIds, pilots: pilotIds, cores: coreIds, plugins: pluginIds, templates: templateIds,
  });
  validateTierBBld(errors, rowsByTable);
  validateTierC(errors, rowsByTable);
  validateTierD(errors, rowsByTable);
  validateBattle(errors, rowsByTable);
  validateCommissionAffix(errors, rowsByTable);
  validateDailyPuzzle(errors, rowsByTable, { ships: shipIds, pilots: pilotIds, cores: coreIds, plugins: pluginIds });

  // 全局：powerIndex 仅允许出现在 power_reference_param
  for (const [table, rows] of Object.entries(rowsByTable)) {
    if (table === 'power_reference_param') continue;
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(row, 'powerIndex')) {
        errors.push({ table, id: String(row.rowId ?? '-'), message: 'powerIndex 仅允许出现在 power_reference_param（不得进入 UI / 奖励 / 商业化语义）' });
      }
    }
  }

  return errors;
}
