"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tests/s7_pilot_talents.test.ts
var import_vitest = require("vitest");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));

// assets/scripts/config/s7/ConfigTypesS7.ts
var S7_ID_FIELD = {
  battle_template_config: "templateId",
  ship_config: "shipId",
  pilot_config: "pilotId",
  core_config: "coreId",
  plugin_config: "pluginId",
  source_tag_config: "rowId",
  power_reference_param: "rowId",
  free_resource_anchor_param: "rowId",
  upgrade_cost_param: "rowId",
  enhance_cost_param: "rowId",
  growth_band_param: "rowId",
  refund_param: "rowId",
  pressure_param: "rowId",
  reward_param: "rowId",
  shop_param: "rowId",
  merchant_refresh_param: "rowId",
  recycle_param: "rowId",
  anti_arbitrage_check: "rowId",
  enemy_schema_config: "enemyId",
  boss_skeleton_config: "bossId",
  prebattle_preview_config: "previewId",
  ship_pilot_fit_config: "shipRef",
  core_plugin_fit_config: "streamTag",
  building_config: "buildingId",
  building_unlock_config: "unlockId",
  building_level_cost_param: "costParamId",
  building_level_effect_param: "effectParamId",
  building_anchor_impact_check: "checkId",
  mainline_node_config: "nodeId",
  chapter_config: "chapterId",
  star_region_config: "starfieldId",
  boss_node_config: "bossNodeId",
  tutorial_trigger_config: "tutorialStepId",
  unlock_checkpoint_config: "unlockRef",
  protection_reset_config: "nodeId",
  reward_pool_ref_config: "rewardAnchorRef",
  no_ad_path_check_config: "checkTag",
  risk_fallback_70_config: "nodeId",
  battle_unit_stat_param: "rowId",
  battle_effect_param: "rowId",
  battle_encounter_param: "rowId",
  battle_spawn_param: "rowId",
  battle_boss_phase_param: "rowId",
  commission_affix_param: "rowId",
  daily_puzzle_param: "rowId"
};
var S7_TABLE_FILES = {
  battle_template_config: "s7/battle_template_config.sample",
  ship_config: "s7/ship_config.sample",
  pilot_config: "s7/pilot_config.sample",
  core_config: "s7/core_config.sample",
  plugin_config: "s7/plugin_config.sample",
  source_tag_config: "s7/source_tag_config.sample",
  power_reference_param: "s7/power_reference_param.sample",
  free_resource_anchor_param: "s7/free_resource_anchor_param.sample",
  upgrade_cost_param: "s7/upgrade_cost_param.sample",
  enhance_cost_param: "s7/enhance_cost_param.sample",
  growth_band_param: "s7/growth_band_param.sample",
  refund_param: "s7/refund_param.sample",
  pressure_param: "s7/pressure_param.sample",
  reward_param: "s7/reward_param.sample",
  shop_param: "s7/shop_param.sample",
  merchant_refresh_param: "s7/merchant_refresh_param.sample",
  recycle_param: "s7/recycle_param.sample",
  anti_arbitrage_check: "s7/anti_arbitrage_check.sample",
  enemy_schema_config: "s7/enemy_schema_config.sample",
  boss_skeleton_config: "s7/boss_skeleton_config.sample",
  prebattle_preview_config: "s7/prebattle_preview_config.sample",
  ship_pilot_fit_config: "s7/ship_pilot_fit_config.sample",
  core_plugin_fit_config: "s7/core_plugin_fit_config.sample",
  building_config: "s7/building_config.sample",
  building_unlock_config: "s7/building_unlock_config.sample",
  building_level_cost_param: "s7/building_level_cost_param.sample",
  building_level_effect_param: "s7/building_level_effect_param.sample",
  building_anchor_impact_check: "s7/building_anchor_impact_check.sample",
  mainline_node_config: "s7/mainline_node_config.sample",
  chapter_config: "s7/chapter_config.sample",
  star_region_config: "s7/star_region_config.sample",
  boss_node_config: "s7/boss_node_config.sample",
  tutorial_trigger_config: "s7/tutorial_trigger_config.sample",
  unlock_checkpoint_config: "s7/unlock_checkpoint_config.sample",
  protection_reset_config: "s7/protection_reset_config.sample",
  reward_pool_ref_config: "s7/reward_pool_ref_config.sample",
  no_ad_path_check_config: "s7/no_ad_path_check_config.sample",
  risk_fallback_70_config: "s7/risk_fallback_70_config.sample",
  battle_unit_stat_param: "s7/battle_unit_stat_param.sample",
  battle_effect_param: "s7/battle_effect_param.sample",
  battle_encounter_param: "s7/battle_encounter_param.sample",
  battle_spawn_param: "s7/battle_spawn_param.sample",
  battle_boss_phase_param: "s7/battle_boss_phase_param.sample",
  commission_affix_param: "s7/commission_affix_param.sample",
  daily_puzzle_param: "s7/daily_puzzle_param.sample"
};

// assets/scripts/core/s7/S7BattleGrid.ts
var S7_PLAYER_ROWS = 3;
var S7_PLAYER_COLS = 3;
var S7_ENEMY_ROWS = 5;
var S7_ENEMY_COLS = 7;
var S7_MAX_PLAYER_UNITS = 5;

// assets/scripts/core/s7/S7CommissionAffix.ts
var S7_POSITION_TYPES = Object.freeze([
  "assault",
  "guard",
  "artillery",
  "support",
  "engineer"
]);
var S7_AFFIX_TARGET_TYPES = Object.freeze([...S7_POSITION_TYPES, "all"]);

// assets/scripts/config/s7/ConfigValidatorS7.ts
var S7_STAT_KEYS = ["maxHp", "attack", "armor", "attackIntervalSec", "attackRangeCells", "passiveEnergyPerSec"];
var S7_AFFIX_KEYS = ["critRate", "critDmg", "shieldBreak", "skillHaste", "healPower", "controlResist", "dmgVsSwarm", "dmgVsBoss"];
var ID_PATTERN = /^[a-z0-9_]+$/;
var S7_PROBLEM_TAGS = ["swarm", "shield", "backline", "burst", "berserk", "summon"];
var S7_STAGE_TYPES = ["normal", "elite", "boss"];
var S7_SHIP_TYPES = ["free", "stream"];
var S7_PLUGIN_SLOTS = ["weapon", "skill", "tactical"];
var RESOURCE_VOCAB = [
  "starOre",
  "hullAlloy",
  "shipBlueprint",
  "pilotShardUniversal",
  "pilotToken",
  "coreFrag",
  "fullCore",
  "starGem",
  "supplyTicket",
  "beaconCommon",
  "beaconRare",
  "beaconEpic",
  "starCargo",
  "adTicket"
];
var ANCHOR_BUDGET_KEYS = [
  "starOre",
  "hullAlloy",
  "shipBlueprint",
  "pilotToken",
  "coreFrag",
  "fullCore",
  "supplyTicket",
  "starCargo"
];
var REWARD_SOURCE_TYPES = [
  "mainline",
  "boss",
  "action3",
  "expansion7",
  "salvage",
  "range",
  "supply",
  "beacon",
  "star_cargo"
];
var ANCHOR_DAYS = ["d7", "d14", "d21", "d28"];
var TIER_A_TABLES = ["battle_template_config", "ship_config", "pilot_config", "core_config", "plugin_config"];
var TIER_B_TABLES = [
  "source_tag_config",
  "power_reference_param",
  "free_resource_anchor_param",
  "upgrade_cost_param",
  "enhance_cost_param",
  "refund_param",
  "pressure_param",
  "reward_param",
  "shop_param",
  "merchant_refresh_param",
  "recycle_param",
  "anti_arbitrage_check",
  "commission_affix_param",
  "daily_puzzle_param"
];
var TIER_GROWTH_TABLES = ["growth_band_param"];
var S7_GROWTH_TARGET_TYPES = ["ship", "pilot"];
var S7_GROWTH_CURVE_TYPES = ["band_linear", "control_point"];
var S7_GROWTH_SECONDARY_KINDS = ["stat", "affix", "effect", "none"];
var S7_GROWTH_EXPECTED_SECONDARY = {
  ship: "stat",
  pilot: "none"
};
var TIER_BATTLE_TABLES = [
  "battle_unit_stat_param",
  "battle_effect_param",
  "battle_encounter_param",
  "battle_spawn_param",
  "battle_boss_phase_param"
];
var S7_BATTLE_UNIT_TARGET_TYPES = ["ship", "enemy", "boss", "prop"];
var S7_BATTLE_UNIT_TARGETING_TAGS = [
  "nearest_random_tie",
  "backline_first",
  "lowest_hp_ally",
  "column_line",
  "marked_first",
  "lowest_hp_enemy",
  "highest_hp_enemy",
  "highest_attack_enemy",
  "highest_armor_enemy",
  "key_unit_first",
  "lowhp_then_nearest",
  "lock_until_dead",
  "first_column_first",
  "debuffed_first",
  "cross_area",
  "block_area",
  // ⑦机制批①：友方目标族（澈/沛/霖/沧）+ 自身区域族（张盾/鼓动）
  "highest_attack_ally",
  "no_buff_ally_first",
  "most_debuffed_ally",
  "controlled_ally_first",
  "self_cross_area",
  "self_block_area",
  // ⑥第一段：春风群奶普攻=行级友方全体（引擎 selectTargets 既有分支）
  "self_team"
];
var S7_BATTLE_EFFECT_KINDS = ["normal_attack", "ultimate", "core", "state"];
var S7_BATTLE_EFFECT_TYPES = [
  "basic_damage",
  "clear_barrage",
  "line_pierce",
  "backline_strike",
  "burst_nuke",
  "shield_bubble",
  "repair_burst",
  "short_circuit_pulse",
  "summon_drone",
  "shield",
  "shield_break",
  "mark",
  "vulnerable",
  "short_circuit",
  "stun",
  "summon",
  "berserk",
  "silence",
  "control_immune",
  "cd_refund",
  "apply_state",
  // ⑦机制批①：通用状态施加
  "purify",
  // ⑨机制批② M5：纯净化/驱散（无伤无治·dispelCount 移除减益/增益）
  "accumulate_attack"
  // ⑨机制批② M9：运行时属性累积（贪吃星·on_kill 永久 +攻）
];
var S7_MOD_STATE_TAGS = [
  "atk_up",
  "atk_down",
  "atk_speed_up",
  "atk_speed_down",
  "armor_down",
  "dmg_up",
  "dmg_taken_up",
  "dmg_taken_down",
  "crit_rate_up",
  "crit_dmg_up",
  "skill_haste_up"
];
var S7_PERIODIC_STATE_TAGS = ["burn", "regen"];
var S7_BATTLE_STATE_TAGS = [
  "none",
  "shield",
  "shield_break",
  "mark",
  "vulnerable",
  "short_circuit",
  "stun",
  "summon",
  "berserk",
  "silence",
  "control_immune",
  "debuff_immune",
  // ⑨机制批② M5：减益免疫（增益·挡一切新减益）
  "taunt",
  // ⑨机制批② M4：嘲讽（被嘲讽者攻击性选目标强制打嘲讽者）
  "reflect",
  // ⑨机制批② M4：反弹（受方受击后向攻击者直扣）
  "guard",
  // ⑨机制批② M4：守护替挡（守护者持态·敌打其后排友军→伤害转守护者）
  "share",
  // ⑨机制批② M4：分摊（受方受击时把 sharePct 转给承接者）
  "aura",
  // ⑨机制批② M6：光环（源持态·消费点动态求和）
  "blind",
  // ⑨机制批② M8：致盲（持有者普攻按 blindChance 概率落空）
  ...S7_MOD_STATE_TAGS,
  ...S7_PERIODIC_STATE_TAGS
];
var S7_TRIGGER_ON_VALUES = [
  "battle_start",
  "cd",
  "on_kill",
  "hp_below",
  "on_hit",
  "ally_down",
  "passive",
  "shield_broken",
  "attack_landed",
  "skill_cast"
];
var S7_STACK_RULE_ON_VALUES = ["attack_landed", "was_hit", "was_hit_by_skill", "kill", "per_second", "hp_lost_decile"];
var S7_STACK_RULE_STAT_VALUES = ["atkPct", "atkSpeedPct", "dmgUpPct", "dmgTakenDownPct", "dmgVsLockedPct"];
var S7_ALSO_APPLY_HOST_TYPES = [
  "basic_damage",
  "clear_barrage",
  "line_pierce",
  "backline_strike",
  "burst_nuke",
  "shield",
  "shield_bubble",
  "repair_burst",
  "short_circuit",
  "short_circuit_pulse",
  "stun",
  "shield_break",
  "mark",
  "vulnerable",
  "berserk",
  "silence",
  "control_immune",
  "apply_state"
];
var S7_DISPEL_HOST_TYPES = ["shield", "shield_bubble", "repair_burst", "purify"];
var S7_BOSS_PHASE_TAGS = ["start", "mid", "final"];
var S7_BOSS_PHASE_TRIGGER_TYPES = ["battle_start", "hp_pct_below", "time_elapsed_sec"];
var BATTLE_GRID_SLOT_PATTERN = new RegExp(`^r[0-${S7_ENEMY_ROWS - 1}]c[0-${S7_ENEMY_COLS - 1}]$`);
var TIER_B_REL_TABLES = [
  "enemy_schema_config",
  "boss_skeleton_config",
  "prebattle_preview_config",
  "ship_pilot_fit_config",
  "core_plugin_fit_config"
];
var TIER_B_BLD_TABLES = [
  "building_config",
  "building_unlock_config",
  "building_level_cost_param",
  "building_level_effect_param",
  "building_anchor_impact_check"
];
var BUILDING_GROUPS = ["core_growth", "pilot_growth", "base_comfort", "supply_comfort", "resource_comfort", "merchant_comfort", "minor_growth", "showcase"];
var BUILDING_NO_AD_ROLES = ["entry_only", "optional_support", "non_core", "none"];
var BUILDING_RELEASE_TAGS = ["default_release", "conditional_post"];
var BUILDING_DEFAULT_KEYS = ["dock", "pilot_training_bay", "habitat", "supply_station", "salvage_port", "merchant_station", "research_tower"];
var BUILDING_RESERVED_KEYS = ["core_gallery"];
var BUILDING_ANCHOR_DAYS = ["D7", "D14", "D21", "D28"];
var FORBIDDEN_FALLBACK_NODES = [];
function seq(prefix, from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${i < 10 ? "0" : ""}${i}`);
  return out;
}
function seq3(prefix, from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(`${prefix}${String(i).padStart(3, "0")}`);
  return out;
}
var TIER_C_TABLES = [
  "mainline_node_config",
  "chapter_config",
  "star_region_config",
  "boss_node_config",
  "tutorial_trigger_config",
  "unlock_checkpoint_config",
  "protection_reset_config"
];
var S7_MAINLINE_NODE_IDS = seq3("n", 1, 150);
var S7_CHAPTER_IDS = seq("ch", 1, 25);
var S7_STARFIELD_IDS = seq("sf", 1, 6);
var S7_BOSS_NODE_IDS = ["n030", "n060", "n084", "n102", "n120", "n138", "n150"];
var S7_TUTORIAL_STEP_IDS = seq("tut", 1, 5);
var S7_NODE_TYPE_TAGS = [
  "tutorial_battle",
  "tutorial_position",
  "normal",
  "elite",
  "tutorial_shield",
  "checkpoint",
  "review",
  "boss",
  "tutorial_backline",
  "tutorial_plugin",
  "tutorial_core",
  "boss_prep",
  "reset_gate",
  "protection_notice",
  "tutorial_burst",
  "tutorial_window",
  "tutorial_berserk_preview"
];
var S7_SECONDARY_PRESSURE_TAGS = [
  "none",
  "low_position",
  "low_backline_preview",
  "low_burst_preview",
  "low_swarm",
  "low_burst_window",
  "low_shield",
  "low_backline",
  "summon_low",
  "backline_low",
  "swarm_low",
  "berserk_preview",
  "burst_low",
  "low_burst",
  "berserk_low",
  "shield_low",
  "one_of_t03_t05_t08_t09"
];
var S7_NO_AD_CHECK_TAGS = [
  "none",
  "no_ad_boss1_check",
  "no_ad_boss2_check",
  "no_ad_boss3_check",
  "no_ad_boss4_check",
  "no_ad_boss5_check",
  "no_ad_boss6_check"
];
var S7_PROTECTION_TAGS = ["active", "ending_notice", "closed"];
var S7_FALLBACK70_TAGS = ["keep_70", "cut_70", "merge_70_to_t01", "merge_70_to_t05"];
var NODE_RANGE_PATTERN = /^n\d{3}_n\d{3}$/;
var RESERVED_TOKEN_PATTERN = /(rsv|observatory|core_gallery)/;
var TIER_D_TABLES = [
  "reward_pool_ref_config",
  "no_ad_path_check_config",
  "risk_fallback_70_config"
];
var S7_REWARD_SOURCE_TAGS = [
  "source_mainline",
  "source_boss",
  "source_star_cargo",
  "source_supply",
  "source_expansion7",
  "source_beacon",
  "source_range",
  "source_none"
];
var S7_FORBIDDEN_DEPENDENCY_TAGS = [
  "ad",
  "ad_extra",
  "ad_temp_power",
  "ad_refresh",
  "ad_pity",
  "ad_revive",
  "ad_compensation",
  "ad_hidden_strong_reward",
  "iap",
  "sponsor_supply",
  "merchant_bought",
  "star_shell_arbitrage",
  "star_shell_patch",
  "five_core_gate",
  "unique_core_item",
  "unique_plugin_item"
];
var EMBEDDED_NODE_ID_PATTERN = /n\d{3}/g;
var S7_EXPECTED_COUNT = {
  battle_template_config: 10,
  // ⑥第一段 20 舰落地（2026-07-07·细表§12）：默认盘 12→20（真源首发 20 舰·shp01-20 映射记细表）。
  ship_config: 20,
  pilot_config: 20,
  // ⑩A1 扩容（第一段四点②已拍）
  core_config: 7,
  plugin_config: 18
};
var S7_DEFAULT_IDS = {
  battle_template_config: seq("t", 1, 10),
  ship_config: seq("shp", 1, 20),
  // ⑥第一段：12→20
  pilot_config: seq("pil", 1, 20),
  core_config: seq("core", 1, 7),
  plugin_config: seq("plg", 1, 18)
};
function isReservedTierAId(table, id) {
  if (table === "battle_template_config" && (id === "t11" || id === "t12")) return true;
  return /rsv/.test(id);
}
function asRow(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function checkStringArrayEnum(errors, table, id, field, value, allowed, requireNonEmpty) {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} \u5FC5\u987B\u662F\u6570\u7EC4` });
    return;
  }
  if (requireNonEmpty && value.length === 0) errors.push({ table, id, message: `${field} \u4E0D\u80FD\u4E3A\u7A7A` });
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item)) {
      errors.push({ table, id, message: `${field} \u542B\u975E\u6CD5\u503C "${String(item)}"\uFF08\u5141\u8BB8\uFF1A${allowed.join("/")}\uFF09` });
    }
  }
}
function checkRefs(errors, table, id, field, value, validIds) {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} \u5FC5\u987B\u662F\u6570\u7EC4` });
    return;
  }
  for (const ref of value) {
    if (typeof ref !== "string") {
      errors.push({ table, id, message: `${field} \u542B\u975E\u5B57\u7B26\u4E32\u5F15\u7528` });
    } else if (/rsv/.test(ref) || ref === "t11" || ref === "t12") {
      errors.push({ table, id, message: `${field} \u5F15\u7528\u4E86\u6761\u4EF6\u9884\u7559\u9879 "${ref}"\uFF0C\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u914D\u7F6E` });
    } else if (!validIds.has(ref)) {
      errors.push({ table, id, message: `${field} \u5F15\u7528\u7684 "${ref}" \u4E0D\u5B58\u5728\u4E8E\u9ED8\u8BA4\u5B9E\u4F53\u8868` });
    }
  }
}
function validateTierACommon(errors, table, rows) {
  const idField = S7_ID_FIELD[table];
  const expected = S7_EXPECTED_COUNT[table];
  const whitelist = new Set(S7_DEFAULT_IDS[table]);
  if (rows.length !== expected) {
    errors.push({ table, id: "-", message: `\u6570\u91CF\u5FC5\u987B\u4E3A ${expected}\uFF0C\u5B9E\u9645 ${rows.length}` });
  }
  const seen = /* @__PURE__ */ new Set();
  const validRows = [];
  for (const raw of rows) {
    const row2 = asRow(raw);
    if (!row2) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u884C\u5FC5\u987B\u662F\u5BF9\u8C61" });
      continue;
    }
    validRows.push(row2);
    const idValue = row2[idField];
    const id = typeof idValue === "string" ? idValue : String(idValue);
    if (typeof row2.schemaVersion !== "string" || row2.schemaVersion.length === 0) {
      errors.push({ table, id, message: "\u7F3A\u5C11\u5408\u6CD5 schemaVersion" });
    }
    if (typeof idValue !== "string" || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" \u4E0D\u7B26\u5408\u5168\u5C0F\u5199\u82F1\u6587/\u6570\u5B57/\u4E0B\u5212\u7EBF\u89C4\u5219` });
    }
    if (seen.has(id)) errors.push({ table, id, message: "ID \u91CD\u590D" });
    seen.add(id);
    if (isReservedTierAId(table, id)) errors.push({ table, id, message: "\u6761\u4EF6\u9884\u7559\u9879\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u914D\u7F6E\u884C / \u9ED8\u8BA4\u6C60" });
    if (!whitelist.has(id)) errors.push({ table, id, message: `${id} \u4E0D\u5728\u9ED8\u8BA4\u767D\u540D\u5355\u5185\uFF0C\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u914D\u7F6E` });
  }
  return validRows;
}
function validateTierBCommon(errors, table, rows) {
  const seen = /* @__PURE__ */ new Set();
  const validRows = [];
  for (const raw of rows) {
    const row2 = asRow(raw);
    if (!row2) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u884C\u5FC5\u987B\u662F\u5BF9\u8C61" });
      continue;
    }
    validRows.push(row2);
    const idValue = row2.rowId;
    const id = typeof idValue === "string" ? idValue : String(idValue);
    if (typeof row2.schemaVersion !== "string" || row2.schemaVersion.length === 0) {
      errors.push({ table, id, message: "\u7F3A\u5C11\u5408\u6CD5 schemaVersion" });
    }
    if (typeof idValue !== "string" || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `rowId "${id}" \u4E0D\u7B26\u5408\u5168\u5C0F\u5199\u82F1\u6587/\u6570\u5B57/\u4E0B\u5212\u7EBF\u89C4\u5219` });
    }
    if (/rsv/.test(id)) errors.push({ table, id, message: "rowId \u542B\u6761\u4EF6\u9884\u7559\u6807\u8BC6\uFF0C\u7981\u6B62\u8FDB\u5165\u53C2\u6570\u8868" });
    if (seen.has(id)) errors.push({ table, id, message: "rowId \u91CD\u590D" });
    seen.add(id);
  }
  return validRows;
}
function validateTierBRelCommon(errors, table, rows) {
  const idField = S7_ID_FIELD[table];
  const seen = /* @__PURE__ */ new Set();
  const validRows = [];
  for (const raw of rows) {
    const row2 = asRow(raw);
    if (!row2) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u884C\u5FC5\u987B\u662F\u5BF9\u8C61" });
      continue;
    }
    validRows.push(row2);
    const idValue = row2[idField];
    const id = typeof idValue === "string" ? idValue : String(idValue);
    if (typeof row2.schemaVersion !== "string" || row2.schemaVersion.length === 0) {
      errors.push({ table, id, message: "\u7F3A\u5C11\u5408\u6CD5 schemaVersion" });
    }
    if (typeof idValue !== "string" || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" \u4E0D\u7B26\u5408\u5168\u5C0F\u5199\u82F1\u6587/\u6570\u5B57/\u4E0B\u5212\u7EBF\u89C4\u5219` });
    }
    if (/rsv/.test(id) || id === "t11" || id === "t12") errors.push({ table, id, message: "\u6761\u4EF6\u9884\u7559\u6807\u8BC6\u7981\u6B62\u8FDB\u5165\u5173\u7CFB/schema \u8868\u4E3B\u952E" });
    if (seen.has(id)) errors.push({ table, id, message: `${idField} \u91CD\u590D` });
    seen.add(id);
  }
  return validRows;
}
function checkSingleRef(errors, table, id, field, value, validIds) {
  if (typeof value !== "string") {
    errors.push({ table, id, message: `${field} \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u5F15\u7528` });
  } else if (/rsv/.test(value) || value === "t11" || value === "t12") {
    errors.push({ table, id, message: `${field} \u5F15\u7528\u4E86\u6761\u4EF6\u9884\u7559\u9879 "${value}"\uFF0C\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u914D\u7F6E` });
  } else if (!validIds.has(value)) {
    errors.push({ table, id, message: `${field} \u5F15\u7528\u7684 "${value}" \u4E0D\u5B58\u5728\u4E8E\u9ED8\u8BA4\u5B9E\u4F53\u8868` });
  }
}
function validateTierBRel(errors, rowsByTable, ids) {
  for (const row2 of rowsByTable.enemy_schema_config) {
    const id = String(row2.enemyId);
    if (typeof row2.mainProblemTag !== "string" || !S7_PROBLEM_TAGS.includes(row2.mainProblemTag)) errors.push({ table: "enemy_schema_config", id, message: "mainProblemTag \u975E\u6CD5" });
    checkStringArrayEnum(errors, "enemy_schema_config", id, "problemTagRefs", row2.problemTagRefs, S7_PROBLEM_TAGS, true);
    checkRefs(errors, "enemy_schema_config", id, "templateRefSlots", row2.templateRefSlots, ids.templates);
    if (!Array.isArray(row2.counterHintTags) || row2.counterHintTags.length < 2) errors.push({ table: "enemy_schema_config", id, message: "counterHintTags \u81F3\u5C11 2 \u4E2A\u901A\u7528\u89E3\u6CD5\u65B9\u5411" });
  }
  for (const row2 of rowsByTable.boss_skeleton_config) {
    const id = String(row2.bossId);
    if (typeof row2.primaryProblemTag !== "string" || !S7_PROBLEM_TAGS.includes(row2.primaryProblemTag)) errors.push({ table: "boss_skeleton_config", id, message: "primaryProblemTag \u975E\u6CD5" });
    const sec = row2.secondaryPressureTag;
    if (typeof sec !== "string") errors.push({ table: "boss_skeleton_config", id, message: "secondaryPressureTag \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\uFF08\u7A7A\u4E32\u8868\u793A\u65E0\u526F\u538B\u529B\uFF09" });
    else if (sec.length > 0 && !S7_PROBLEM_TAGS.includes(sec)) errors.push({ table: "boss_skeleton_config", id, message: `secondaryPressureTag "${sec}" \u975E\u6CD5\uFF08\u6700\u591A 1 \u4E2A\u526F\u538B\u529B\uFF0C\u987B\u4E3A 6 \u7C7B\u95EE\u9898\u4E4B\u4E00\uFF09` });
    checkRefs(errors, "boss_skeleton_config", id, "templateRefs", row2.templateRefs, ids.templates);
    if (!Array.isArray(row2.counterHintTags) || row2.counterHintTags.length < 2) errors.push({ table: "boss_skeleton_config", id, message: "counterHintTags \u81F3\u5C11 2 \u4E2A\u901A\u7528\u89E3\u6CD5\u65B9\u5411" });
  }
  for (const row2 of rowsByTable.prebattle_preview_config) {
    const id = String(row2.previewId);
    checkSingleRef(errors, "prebattle_preview_config", id, "templateRef", row2.templateRef, ids.templates);
    checkStringArrayEnum(errors, "prebattle_preview_config", id, "problemTagRefs", row2.problemTagRefs, S7_PROBLEM_TAGS, true);
    if (!Array.isArray(row2.counterHintTags) || row2.counterHintTags.length < 2) errors.push({ table: "prebattle_preview_config", id, message: "counterHintTags \u81F3\u5C11 2 \u4E2A\u901A\u7528\u89E3\u6CD5\u65B9\u5411" });
  }
  const fitShips = /* @__PURE__ */ new Set();
  for (const row2 of rowsByTable.ship_pilot_fit_config) {
    const id = String(row2.shipRef);
    if (!ids.ships.has(id)) errors.push({ table: "ship_pilot_fit_config", id, message: `shipRef "${id}" \u4E0D\u5B58\u5728\u4E8E\u661F\u8230\u8868` });
    fitShips.add(id);
    checkSingleRef(errors, "ship_pilot_fit_config", id, "primaryPilotRef", row2.primaryPilotRef, ids.pilots);
    checkRefs(errors, "ship_pilot_fit_config", id, "alternativePilotRefs", row2.alternativePilotRefs, ids.pilots);
    if (!Array.isArray(row2.alternativePilotRefs) || row2.alternativePilotRefs.length < 1) errors.push({ table: "ship_pilot_fit_config", id, message: "\u6BCF\u4E2A\u4E3B\u9002\u914D\u5FC5\u987B\u63D0\u4F9B\u81F3\u5C11 1 \u4E2A\u66FF\u4EE3\u9002\u914D" });
    if (row2.notUniqueFlag !== true) errors.push({ table: "ship_pilot_fit_config", id, message: "notUniqueFlag \u5FC5\u987B\u4E3A true\uFF08\u7981\u6B62\u552F\u4E00\u7ED1\u5B9A\uFF09" });
  }
  for (const s of ids.ships) if (!fitShips.has(s)) errors.push({ table: "ship_pilot_fit_config", id: s, message: `\u661F\u8230 ${s} \u7F3A\u5C11\u9002\u914D\u5173\u7CFB\u884C` });
  for (const row2 of rowsByTable.core_plugin_fit_config) {
    const id = String(row2.streamTag);
    checkRefs(errors, "core_plugin_fit_config", id, "shipRefs", row2.shipRefs, ids.ships);
    checkRefs(errors, "core_plugin_fit_config", id, "pilotRefs", row2.pilotRefs, ids.pilots);
    checkRefs(errors, "core_plugin_fit_config", id, "coreRefs", row2.coreRefs, ids.cores);
    checkRefs(errors, "core_plugin_fit_config", id, "pluginRefs", row2.pluginRefs, ids.plugins);
    if (!Array.isArray(row2.coreRefs) || row2.coreRefs.length < 2) errors.push({ table: "core_plugin_fit_config", id, message: "\u6BCF\u6D41\u6D3E\u81F3\u5C11 2 \u4E2A\u661F\u6838\u89E3\u6CD5\uFF08\u4E0D\u7ED1\u5B9A\u552F\u4E00\u661F\u6838\uFF09" });
    if (!Array.isArray(row2.pluginRefs) || row2.pluginRefs.length < 2) errors.push({ table: "core_plugin_fit_config", id, message: "\u6BCF\u6D41\u6D3E\u81F3\u5C11 2 \u4E2A\u63D2\u4EF6\u89E3\u6CD5\uFF08\u4E0D\u7ED1\u5B9A\u552F\u4E00\u63D2\u4EF6\uFF09" });
  }
}
function validateTierBBldCommon(errors, table, rows) {
  const idField = S7_ID_FIELD[table];
  const seen = /* @__PURE__ */ new Set();
  const validRows = [];
  for (const raw of rows) {
    const row2 = asRow(raw);
    if (!row2) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u884C\u5FC5\u987B\u662F\u5BF9\u8C61" });
      continue;
    }
    validRows.push(row2);
    const idValue = row2[idField];
    const id = typeof idValue === "string" ? idValue : String(idValue);
    if (typeof row2.schemaVersion !== "string" || row2.schemaVersion.length === 0) {
      errors.push({ table, id, message: "\u7F3A\u5C11\u5408\u6CD5 schemaVersion" });
    }
    if (typeof idValue !== "string" || !ID_PATTERN.test(idValue)) {
      errors.push({ table, id, message: `${idField} "${id}" \u4E0D\u7B26\u5408\u5168\u5C0F\u5199\u82F1\u6587/\u6570\u5B57/\u4E0B\u5212\u7EBF\u89C4\u5219` });
    }
    if (seen.has(id)) errors.push({ table, id, message: `${idField} \u91CD\u590D` });
    seen.add(id);
  }
  return validRows;
}
function validateTierBBld(errors, rowsByTable) {
  const bldRows = rowsByTable.building_config;
  const buildingIds = /* @__PURE__ */ new Set();
  const systemRefsById = /* @__PURE__ */ new Map();
  const noAdRoleById = /* @__PURE__ */ new Map();
  const defaultKeys = [];
  const conditionalKeys = [];
  const keySeen = /* @__PURE__ */ new Set();
  if (bldRows.length !== 8) errors.push({ table: "building_config", id: "-", message: `\u5EFA\u7B51\u603B\u6570\u5FC5\u987B\u4E3A 8\uFF087 \u9ED8\u8BA4 + 1 \u6761\u4EF6/\u540E\u7F6E\uFF09\uFF0C\u5B9E\u9645 ${bldRows.length}` });
  for (const row2 of bldRows) {
    const id = String(row2.buildingId);
    buildingIds.add(id);
    const key = String(row2.buildingKey);
    if (keySeen.has(key)) errors.push({ table: "building_config", id, message: `buildingKey "${key}" \u91CD\u590D` });
    keySeen.add(key);
    const refs = Array.isArray(row2.systemRefTags) ? row2.systemRefTags.map((t) => String(t)) : [];
    systemRefsById.set(id, refs);
    noAdRoleById.set(id, String(row2.noAdCorePathRole));
    if (typeof row2.buildingGroupTag !== "string" || !BUILDING_GROUPS.includes(row2.buildingGroupTag)) errors.push({ table: "building_config", id, message: "buildingGroupTag \u975E\u6CD5" });
    if (typeof row2.noAdCorePathRole !== "string" || !BUILDING_NO_AD_ROLES.includes(row2.noAdCorePathRole)) errors.push({ table: "building_config", id, message: "noAdCorePathRole \u975E\u6CD5" });
    if (typeof row2.releaseTag !== "string" || !BUILDING_RELEASE_TAGS.includes(row2.releaseTag)) errors.push({ table: "building_config", id, message: "releaseTag \u975E\u6CD5" });
    if (row2.initialLevel !== 1) errors.push({ table: "building_config", id, message: "initialLevel \u5FC5\u987B\u4E3A 1" });
    if (row2.maxLevel !== 10) errors.push({ table: "building_config", id, message: "maxLevel \u5FC5\u987B\u4E3A 10" });
    if (row2.functionUnlockLevel !== 1) errors.push({ table: "building_config", id, message: "functionUnlockLevel \u5FC5\u987B\u4E3A 1" });
    if ((num(row2.mainlineRequiredLevelCap) ?? 99) > 1) errors.push({ table: "building_config", id, message: "mainlineRequiredLevelCap \u4E0D\u5F97 > 1" });
    if (!Array.isArray(row2.systemRefTags) || row2.systemRefTags.length === 0) errors.push({ table: "building_config", id, message: "systemRefTags \u4E0D\u80FD\u4E3A\u7A7A" });
    if (row2.releaseTag === "default_release") {
      defaultKeys.push(key);
      if (row2.reservedFlag !== false) errors.push({ table: "building_config", id, message: "default_release \u5EFA\u7B51 reservedFlag \u5FC5\u987B\u4E3A false" });
    } else if (row2.releaseTag === "conditional_post") {
      conditionalKeys.push(key);
      if (row2.reservedFlag !== true) errors.push({ table: "building_config", id, message: "conditional_post \u5EFA\u7B51 reservedFlag \u5FC5\u987B\u4E3A true" });
      if (row2.buildingGroupTag !== "showcase") errors.push({ table: "building_config", id, message: "conditional_post \u5EFA\u7B51\u5FC5\u987B\u5C5E\u4E8E showcase \u7EC4" });
    }
  }
  if (defaultKeys.length !== 7) errors.push({ table: "building_config", id: "-", message: `\u9ED8\u8BA4\u5EFA\u7B51\u5FC5\u987B\u4E3A 7 \u4E2A\uFF0C\u5B9E\u9645 ${defaultKeys.length}` });
  for (const k of BUILDING_DEFAULT_KEYS) if (!defaultKeys.includes(k)) errors.push({ table: "building_config", id: k, message: `\u9ED8\u8BA4\u5EFA\u7B51\u7F3A\u5C11 "${k}"` });
  for (const k of defaultKeys) if (!BUILDING_DEFAULT_KEYS.includes(k)) errors.push({ table: "building_config", id: k, message: `"${k}" \u4E0D\u5728 7 \u4E2A\u9ED8\u8BA4\u5EFA\u7B51\u767D\u540D\u5355\u5185` });
  if (conditionalKeys.length !== 1) errors.push({ table: "building_config", id: "-", message: `\u6761\u4EF6/\u540E\u7F6E\u5EFA\u7B51\u5FC5\u987B\u4E3A 1 \u4E2A\uFF0C\u5B9E\u9645 ${conditionalKeys.length}` });
  for (const k of BUILDING_RESERVED_KEYS) if (!conditionalKeys.includes(k)) errors.push({ table: "building_config", id: k, message: `\u6761\u4EF6/\u540E\u7F6E\u9884\u7559\u5EFA\u7B51\u7F3A\u5C11 "${k}"` });
  const usedGroups = new Set(bldRows.map((r) => String(r.buildingGroupTag)));
  const unlockBuildings = /* @__PURE__ */ new Set();
  const cc05aSeen = /* @__PURE__ */ new Set();
  for (const row2 of rowsByTable.building_unlock_config) {
    const id = String(row2.unlockId);
    const bid = String(row2.buildingId);
    if (!buildingIds.has(bid)) errors.push({ table: "building_unlock_config", id, message: `buildingId "${bid}" \u4E0D\u5B58\u5728` });
    unlockBuildings.add(bid);
    if (typeof row2.unlockSourceType !== "string" || !["tutorial_anchor", "mainline_anchor", "need_anchor", "expansion_anchor", "blueprint_progress"].includes(row2.unlockSourceType)) errors.push({ table: "building_unlock_config", id, message: "unlockSourceType \u975E\u6CD5" });
    if (row2.initialLevelOnUnlock !== 1) errors.push({ table: "building_unlock_config", id, message: "initialLevelOnUnlock \u5FC5\u987B\u4E3A 1" });
    if (row2.noAdAvailableFlag !== true) errors.push({ table: "building_unlock_config", id, message: "noAdAvailableFlag \u5FC5\u987B\u4E3A true" });
    if (row2.forbiddenFallback70Flag !== true) errors.push({ table: "building_unlock_config", id, message: "forbiddenFallback70Flag \u5FC5\u987B\u4E3A true" });
    if (row2.forbiddenCommercialSourceFlag !== true) errors.push({ table: "building_unlock_config", id, message: "forbiddenCommercialSourceFlag \u5FC5\u987B\u4E3A true" });
    if (row2.corePathRequiredFlag === true && noAdRoleById.get(bid) !== "entry_only") {
      errors.push({ table: "building_unlock_config", id, message: "corePathRequiredFlag \u4EC5 entry_only \u5165\u53E3\u5EFA\u7B51\u53EF\u4E3A true\uFF08\u9A7E\u9A76\u5458\u8BAD\u7EC3\u8231/\u8865\u7ED9\u7AD9/\u6253\u635E/\u5546\u4EBA/\u7814\u7A76/\u5C55\u5385\u4E0D\u5F97\u4E3A\u6838\u5FC3\u5FC5\u9700\uFF09" });
    }
    const cc = String(row2.cc05aLinkTag);
    if (cc05aSeen.has(cc)) errors.push({ table: "building_unlock_config", id, message: "cc05aLinkTag \u91CD\u590D" });
    cc05aSeen.add(cc);
    const anchorLower = String(row2.unlockAnchorTag).toLowerCase();
    const ccLower = cc.toLowerCase();
    for (const n of FORBIDDEN_FALLBACK_NODES) {
      if (anchorLower.includes(n) || ccLower.includes(n)) errors.push({ table: "building_unlock_config", id, message: `\u5EFA\u7B51\u89E3\u9501\u4E0D\u5F97\u6302 70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 ${n.toUpperCase()}` });
    }
  }
  for (const b of buildingIds) if (!unlockBuildings.has(b)) errors.push({ table: "building_unlock_config", id: b, message: `\u5EFA\u7B51 ${b} \u7F3A\u5C11\u89E3\u9501\u884C` });
  for (const row2 of rowsByTable.building_level_cost_param) {
    const id = String(row2.costParamId);
    if (typeof row2.buildingGroupTag !== "string" || !usedGroups.has(row2.buildingGroupTag)) errors.push({ table: "building_level_cost_param", id, message: "buildingGroupTag \u5FC5\u987B\u6765\u81EA building_config \u5DF2\u6709\u5EFA\u7B51\u7EC4" });
    if (!["activate_lv1", "lv2_5", "lv6_10"].includes(String(row2.levelBand))) errors.push({ table: "building_level_cost_param", id, message: "levelBand \u975E\u6CD5" });
    if (!["none", "star_ore"].includes(String(row2.primaryResourceTag))) errors.push({ table: "building_level_cost_param", id, message: "primaryResourceTag \u975E\u6CD5" });
    if (!["none", "low", "mid", "high"].includes(String(row2.costBandTag))) errors.push({ table: "building_level_cost_param", id, message: "costBandTag \u975E\u6CD5" });
    if (!["entry_unlock_only", "not_in_core_floor", "optional_post"].includes(String(row2.freeAnchorImpactTag))) errors.push({ table: "building_level_cost_param", id, message: "freeAnchorImpactTag \u975E\u6CD5" });
    if (row2.forbidRecalc0304Flag !== true) errors.push({ table: "building_level_cost_param", id, message: "forbidRecalc0304Flag \u5FC5\u987B\u4E3A true\uFF08\u7981\u6B62\u91CD\u7B97 03-04\uFF09" });
  }
  for (const row2 of rowsByTable.building_level_effect_param) {
    const id = String(row2.effectParamId);
    const bid = String(row2.buildingId);
    if (!buildingIds.has(bid)) errors.push({ table: "building_level_effect_param", id, message: `buildingId "${bid}" \u4E0D\u5B58\u5728` });
    if (!["lv1", "lv2_5", "lv6_10"].includes(String(row2.levelBand))) errors.push({ table: "building_level_effect_param", id, message: "levelBand \u975E\u6CD5" });
    if (!["none", "minor_non_gate"].includes(String(row2.combatPowerImpactTag))) errors.push({ table: "building_level_effect_param", id, message: "combatPowerImpactTag \u975E\u6CD5" });
    if (row2.mainlineGateAllowed !== false) errors.push({ table: "building_level_effect_param", id, message: "mainlineGateAllowed \u5FC5\u987B\u4E3A false\uFF08\u5EFA\u7B51\u4E0D\u5F97\u5361\u4E3B\u7EBF\uFF09" });
    if (row2.noAdGateAllowed !== false) errors.push({ table: "building_level_effect_param", id, message: "noAdGateAllowed \u5FC5\u987B\u4E3A false\uFF08\u5EFA\u7B51\u4E0D\u5F97\u5361 no-ad\uFF09" });
    const sysRefs = systemRefsById.get(bid) ?? [];
    if (typeof row2.affectedSystemTag !== "string" || !sysRefs.includes(row2.affectedSystemTag)) {
      errors.push({ table: "building_level_effect_param", id, message: `affectedSystemTag "${String(row2.affectedSystemTag)}" \u4E0D\u5728\u5EFA\u7B51 ${bid} \u7684 systemRefTags \u5185` });
    }
  }
  const anchorDaysSeen = /* @__PURE__ */ new Set();
  for (const row2 of rowsByTable.building_anchor_impact_check) {
    const id = String(row2.checkId);
    if (typeof row2.anchorDay === "string") anchorDaysSeen.add(row2.anchorDay);
    if (!BUILDING_ANCHOR_DAYS.includes(String(row2.anchorDay))) errors.push({ table: "building_anchor_impact_check", id, message: "anchorDay \u975E\u6CD5" });
    if (!Array.isArray(row2.requiredBuildingRefs)) errors.push({ table: "building_anchor_impact_check", id, message: "requiredBuildingRefs \u5FC5\u987B\u662F\u6570\u7EC4" });
    else for (const ref of row2.requiredBuildingRefs) {
      if (typeof ref !== "string" || !buildingIds.has(ref)) errors.push({ table: "building_anchor_impact_check", id, message: `requiredBuildingRefs \u5F15\u7528\u7684 "${String(ref)}" \u4E0D\u5B58\u5728` });
    }
    if ((num(row2.requiredLevelCap) ?? 99) > 1) errors.push({ table: "building_anchor_impact_check", id, message: "requiredLevelCap \u4E0D\u5F97 > 1\uFF08no-ad \u6838\u5FC3\u8DEF\u5F84\u4E0D\u4F9D\u8D56\u5EFA\u7B51 Level 2-10\uFF09" });
    if (!["no_impact", "needs_review", "blocks_anchor"].includes(String(row2.impactJudgement))) errors.push({ table: "building_anchor_impact_check", id, message: "impactJudgement \u975E\u6CD5" });
    if (row2.impactJudgement === "blocks_anchor") errors.push({ table: "building_anchor_impact_check", id, message: "impactJudgement=blocks_anchor \u5FC5\u987B\u56DE\u4E3B\u63A7 / Ron\uFF0C\u4E0D\u5F97\u76F4\u63A5\u843D\u8868" });
    if (row2.blockOnFail !== true) errors.push({ table: "building_anchor_impact_check", id, message: "blockOnFail \u5FC5\u987B\u4E3A true" });
    if (row2.forbidCommercialPatchFlag !== true) errors.push({ table: "building_anchor_impact_check", id, message: "forbidCommercialPatchFlag \u5FC5\u987B\u4E3A true" });
  }
  for (const d of BUILDING_ANCHOR_DAYS) if (!anchorDaysSeen.has(d)) errors.push({ table: "building_anchor_impact_check", id: d, message: `\u7F3A\u5C11\u951A\u70B9 ${d}` });
}
function validateTierB(errors, rowsByTable) {
  for (const row2 of rowsByTable.source_tag_config) {
    const id = String(row2.rowId);
    const cat = row2.sourceCategory;
    if (cat !== "free" && cat !== "high_risk") errors.push({ table: "source_tag_config", id, message: "sourceCategory \u975E\u6CD5" });
    if (row2.riskLevel !== "low" && row2.riskLevel !== "high") errors.push({ table: "source_tag_config", id, message: "riskLevel \u975E\u6CD5" });
    if (cat === "high_risk" && row2.riskLevel !== "high") errors.push({ table: "source_tag_config", id, message: "high_risk \u6765\u6E90 riskLevel \u5FC5\u987B\u4E3A high" });
    if (row2.inheritOnTransform !== true) errors.push({ table: "source_tag_config", id, message: "inheritOnTransform \u5FC5\u987B\u4E3A true\uFF08\u6765\u6E90\u6807\u7B7E\u5EF6\u7EED\uFF09" });
    if (row2.washProtected !== true) errors.push({ table: "source_tag_config", id, message: "washProtected \u5FC5\u987B\u4E3A true\uFF08\u9632\u6D17\u767D\uFF09" });
  }
  const prDays = /* @__PURE__ */ new Set();
  for (const row2 of rowsByTable.power_reference_param) {
    const id = String(row2.rowId);
    if (typeof row2.anchorDay === "string") prDays.add(row2.anchorDay);
    if (!ANCHOR_DAYS.includes(String(row2.anchorDay))) errors.push({ table: "power_reference_param", id, message: "anchorDay \u975E\u6CD5" });
    if (row2.internalOnly !== true) errors.push({ table: "power_reference_param", id, message: "internalOnly \u5FC5\u987B\u4E3A true\uFF08powerIndex \u4EC5\u5185\u90E8/QA\uFF09" });
    const v = num(row2.powerIndex);
    const lo = num(row2.powerIndexMin);
    const hi = num(row2.powerIndexMax);
    if (lo === null || hi === null || v === null || !(lo <= v && v <= hi)) {
      errors.push({ table: "power_reference_param", id, message: "powerIndexMin <= powerIndex <= powerIndexMax \u4E0D\u6210\u7ACB" });
    }
  }
  for (const d of ANCHOR_DAYS) if (!prDays.has(d)) errors.push({ table: "power_reference_param", id: d, message: `\u7F3A\u5C11\u951A\u70B9 ${d}` });
  const byAnchor = {};
  for (const row2 of rowsByTable.free_resource_anchor_param) {
    const id = String(row2.rowId);
    const day = String(row2.anchorDay);
    if (!ANCHOR_DAYS.includes(day)) errors.push({ table: "free_resource_anchor_param", id, message: "anchorDay \u975E\u6CD5" });
    if (row2.band !== "floor" && row2.band !== "expected") errors.push({ table: "free_resource_anchor_param", id, message: "band \u5FC5\u987B\u662F floor / expected" });
    byAnchor[day] = byAnchor[day] ?? {};
    if (row2.band === "floor") byAnchor[day].floor = row2;
    if (row2.band === "expected") byAnchor[day].expected = row2;
  }
  for (const d of ANCHOR_DAYS) {
    const pair = byAnchor[d];
    if (!pair || !pair.floor || !pair.expected) {
      errors.push({ table: "free_resource_anchor_param", id: d, message: `\u7F3A\u5C11 ${d} \u7684 floor / expected \u884C` });
      continue;
    }
    for (const res of ANCHOR_BUDGET_KEYS) {
      const f = num(pair.floor[res]);
      const e = num(pair.expected[res]);
      if (f === null || e === null) errors.push({ table: "free_resource_anchor_param", id: d, message: `\u8D44\u6E90 ${res} \u7F3A\u6570\u503C` });
      else if (f > e) errors.push({ table: "free_resource_anchor_param", id: d, message: `\u8D44\u6E90 ${res} floor(${f}) > expected(${e})` });
    }
  }
  let shipMaxLv = 0;
  let pilotMaxLv = 0;
  for (const row2 of rowsByTable.upgrade_cost_param) {
    const id = String(row2.rowId);
    if (row2.targetType !== "ship" && row2.targetType !== "pilot") errors.push({ table: "upgrade_cost_param", id, message: "targetType \u975E\u6CD5" });
    const lv = num(row2.maxLevel) ?? 0;
    if (row2.targetType === "ship") shipMaxLv = Math.max(shipMaxLv, lv);
    if (row2.targetType === "pilot") pilotMaxLv = Math.max(pilotMaxLv, lv);
  }
  if (shipMaxLv !== 40) errors.push({ table: "upgrade_cost_param", id: "ship", message: `\u661F\u8230\u7B49\u7EA7\u4E0A\u9650\u5FC5\u987B\u4E3A 40\uFF0C\u5B9E\u9645 ${shipMaxLv}` });
  if (pilotMaxLv !== 40) errors.push({ table: "upgrade_cost_param", id: "pilot", message: `\u9A7E\u9A76\u5458\u7B49\u7EA7\u4E0A\u9650\u5FC5\u987B\u4E3A 40\uFF0C\u5B9E\u9645 ${pilotMaxLv}` });
  if (rowsByTable.enhance_cost_param.length > 0) {
    errors.push({ table: "enhance_cost_param", id: "-", message: "\u9996\u53D1\u65E0\u5F3A\u5316\u7CFB\u7EDF\uFF0Cenhance_cost_param \u5E94\u4E3A\u7A7A\uFF08\u5DF2\u780D\u661F\u6838 5 \u9636\u5F3A\u5316\uFF0C\xA75.4\uFF09" });
  }
  for (const row2 of rowsByTable.refund_param) {
    const id = String(row2.rowId);
    if (row2.crossCurrency !== false) errors.push({ table: "refund_param", id, message: "crossCurrency \u5FC5\u987B\u4E3A false\uFF08\u4E0D\u8DE8\u5E01\u79CD\u6D17\u767D\uFF09" });
    const lo = num(row2.refundRateMinPct);
    const hi = num(row2.refundRateMaxPct);
    if (lo === null || hi === null || lo > hi || lo < 0 || hi > 100) {
      errors.push({ table: "refund_param", id, message: "refundRate \u533A\u95F4\u975E\u6CD5\uFF080<=min<=max<=100\uFF09" });
    }
  }
  for (const row2 of rowsByTable.pressure_param) {
    const id = String(row2.rowId);
    const scope = row2.scope;
    if (scope !== "normal" && scope !== "elite" && scope !== "boss" && scope !== "template_modifier") {
      errors.push({ table: "pressure_param", id, message: "scope \u975E\u6CD5" });
      continue;
    }
    if (scope === "template_modifier") {
      const m = num(row2.modifier);
      if (m === null || m <= 0) errors.push({ table: "pressure_param", id, message: "modifier \u5FC5\u987B\u4E3A\u6B63\u6570" });
      if (row2.appliesToBoss !== false) errors.push({ table: "pressure_param", id, message: "template_modifier \u7684 appliesToBoss \u5FC5\u987B\u4E3A false\uFF08\u4E0D\u53E0\u4E58 boss_pressure\uFF09" });
    } else {
      const lo = num(row2.pressureMin);
      const hi = num(row2.pressureMax);
      if (lo === null || hi === null || lo > hi) errors.push({ table: "pressure_param", id, message: "pressureMin <= pressureMax \u4E0D\u6210\u7ACB" });
      if (scope === "boss" && row2.refKey === "n150" && (hi === null || hi > 14500)) {
        errors.push({ table: "pressure_param", id, message: "N150\uFF08\u7EC8Boss\uFF09\u538B\u529B\u4E0A\u9650\u5FC5\u987B <= 14500\uFF0C\u4E0D\u4E0A\u63A2 15500" });
      }
    }
  }
  for (const row2 of rowsByTable.reward_param) {
    const id = String(row2.rowId);
    const st = String(row2.sourceType);
    if (!REWARD_SOURCE_TYPES.includes(st)) errors.push({ table: "reward_param", id, message: `sourceType "${st}" \u975E\u6CD5` });
    if (/rsv/i.test(st) || /rsv/i.test(String(row2.packId)) || /rsv/i.test(String(row2.goodItemTag))) {
      errors.push({ table: "reward_param", id, message: "\u5956\u52B1\u6C60\u4E0D\u5F97\u5F15\u7528\u6761\u4EF6\u9884\u7559\u9879\uFF08RSV\uFF09" });
    }
    if (row2.noAdRequired !== true) errors.push({ table: "reward_param", id, message: "\u5956\u52B1\u6C60 noAdRequired \u5FC5\u987B\u4E3A true\uFF08\u5173\u952E\u8DEF\u5F84\u4E0D\u7ED1\u5E7F\u544A\uFF09" });
    if (!Array.isArray(row2.resources)) {
      errors.push({ table: "reward_param", id, message: "resources \u5FC5\u987B\u662F\u6570\u7EC4" });
    } else {
      for (const r of row2.resources) {
        const rr = asRow(r);
        if (!rr) {
          errors.push({ table: "reward_param", id, message: "resources \u9879\u5FC5\u987B\u662F\u5BF9\u8C61" });
          continue;
        }
        if (typeof rr.resourceId !== "string" || !RESOURCE_VOCAB.includes(rr.resourceId)) {
          errors.push({ table: "reward_param", id, message: `resourceId "${String(rr.resourceId)}" \u4E0D\u5728\u8D44\u6E90\u8BCD\u8868\u5185` });
        }
        const lo = num(rr.min);
        const hi = num(rr.max);
        if (lo === null) errors.push({ table: "reward_param", id, message: "resources.min \u7F3A\u6570\u503C" });
        if (hi !== null && lo !== null && lo > hi) errors.push({ table: "reward_param", id, message: "resources.min > max" });
      }
    }
  }
  for (const row2 of rowsByTable.shop_param) {
    const id = String(row2.rowId);
    const lo = num(row2.priceMin);
    const hi = num(row2.priceMax);
    if (lo === null || hi === null || lo > hi) errors.push({ table: "shop_param", id, message: "priceMin <= priceMax \u4E0D\u6210\u7ACB" });
    if (row2.criticalPath !== false) errors.push({ table: "shop_param", id, message: "\u5546\u4EBA\u4E0D\u5F97\u51FA\u552E\u5173\u952E\u8DEF\u5F84\u552F\u4E00\u7269\uFF08criticalPath \u5FC5\u987B false\uFF09" });
    if ((num(row2.purchaseLimit) ?? 0) < 1) errors.push({ table: "shop_param", id, message: "purchaseLimit \u5FC5\u987B >= 1" });
  }
  for (const row2 of rowsByTable.merchant_refresh_param) {
    const id = String(row2.rowId);
    if (row2.freeRefreshPerCycle !== 1) errors.push({ table: "merchant_refresh_param", id, message: "freeRefreshPerCycle \u5FC5\u987B\u4E3A 1" });
    if ((num(row2.paidRefreshCapPerCycle) ?? 99) > 3) errors.push({ table: "merchant_refresh_param", id, message: "paidRefreshCapPerCycle \u5FC5\u987B <= 3" });
    if (row2.criticalPathItemBlock !== true) errors.push({ table: "merchant_refresh_param", id, message: "criticalPathItemBlock \u5FC5\u987B\u4E3A true" });
    const seqv = row2.refreshCostSequence;
    if (!Array.isArray(seqv) || seqv.length !== 3 || seqv[0] !== 80 || seqv[1] !== 160 || seqv[2] !== 320) {
      errors.push({ table: "merchant_refresh_param", id, message: "refreshCostSequence \u5FC5\u987B\u4E3A [80,160,320]" });
    }
  }
  const highRiskItems = ["merchant_bought", "ad_extra", "sponsor_supply", "treasure_product"];
  for (const row2 of rowsByTable.recycle_param) {
    const id = String(row2.rowId);
    const lo = num(row2.refundRateMinPct);
    const hi = num(row2.refundRateMaxPct);
    if (lo === null || hi === null || lo > hi) errors.push({ table: "recycle_param", id, message: "refundRate \u533A\u95F4\u975E\u6CD5" });
    if (row2.itemType === "full_core" && row2.recyclable !== false) {
      errors.push({ table: "recycle_param", id, message: "\u5B8C\u6574\u661F\u6838\u5FC5\u987B recyclable=false\uFF08\u9632\u6838\u5FC3\u8DEF\u5F84\u5957\u5229\uFF09" });
    }
    if (typeof row2.itemType === "string" && highRiskItems.includes(row2.itemType) && (hi === null || hi > 15)) {
      errors.push({ table: "recycle_param", id, message: "\u9AD8\u98CE\u9669\u6765\u6E90\u4E70\u5165\u56DE\u6536\u5FC5\u4E8F\uFF08refundRateMaxPct <= 15\uFF09" });
    }
  }
  const arb = rowsByTable.anti_arbitrage_check;
  if (arb.length < 6) errors.push({ table: "anti_arbitrage_check", id: "-", message: `\u963B\u65AD\u89C4\u5219\u81F3\u5C11 6 \u6761\uFF0C\u5B9E\u9645 ${arb.length}` });
  for (const row2 of arb) {
    const id = String(row2.rowId);
    if (row2.blockOnFail !== true) errors.push({ table: "anti_arbitrage_check", id, message: "blockOnFail \u5FC5\u987B\u4E3A true" });
    if (typeof row2.formula !== "string" || row2.formula.length === 0) errors.push({ table: "anti_arbitrage_check", id, message: "formula \u4E0D\u80FD\u4E3A\u7A7A" });
  }
}
function validateTierC(errors, rowsByTable) {
  const templateIds = new Set(S7_DEFAULT_IDS.battle_template_config);
  const tutorialIds = new Set(S7_TUTORIAL_STEP_IDS);
  const mainlineRows = rowsByTable.mainline_node_config;
  if (mainlineRows.length !== 150) {
    errors.push({ table: "mainline_node_config", id: "-", message: `\u4E3B\u7EBF\u8282\u70B9\u5FC5\u987B\u4E3A 150 \u884C\uFF0C\u5B9E\u9645 ${mainlineRows.length}` });
  }
  const mainlineById = /* @__PURE__ */ new Map();
  const seenNodeIds = /* @__PURE__ */ new Set();
  const cutNodes = [];
  for (const row2 of mainlineRows) {
    const id = String(row2.nodeId);
    seenNodeIds.add(id);
    mainlineById.set(id, row2);
    if (!S7_NODE_TYPE_TAGS.includes(String(row2.nodeTypeTag))) errors.push({ table: "mainline_node_config", id, message: "nodeTypeTag \u975E\u6CD5" });
    if (typeof row2.starfieldId !== "string" || !S7_STARFIELD_IDS.includes(row2.starfieldId)) errors.push({ table: "mainline_node_config", id, message: "starfieldId \u975E\u6CD5" });
    if (typeof row2.chapterId !== "string" || !S7_CHAPTER_IDS.includes(row2.chapterId)) errors.push({ table: "mainline_node_config", id, message: "chapterId \u975E\u6CD5" });
    const tref = row2.templateRef;
    if (tref !== "none" && (typeof tref !== "string" || !templateIds.has(tref))) {
      errors.push({ table: "mainline_node_config", id, message: `templateRef "${String(tref)}" \u975E\u6CD5\uFF08\u4EC5\u5141\u8BB8 t01-t10 \u6216 none\uFF09` });
    }
    const ptag = row2.problemTagRef;
    if (ptag !== "none" && (typeof ptag !== "string" || !S7_PROBLEM_TAGS.includes(ptag))) {
      errors.push({ table: "mainline_node_config", id, message: "problemTagRef \u975E\u6CD5" });
    }
    if (typeof row2.secondaryPressureTag !== "string" || !S7_SECONDARY_PRESSURE_TAGS.includes(row2.secondaryPressureTag)) {
      errors.push({ table: "mainline_node_config", id, message: "secondaryPressureTag \u975E\u6CD5" });
    }
    const tut = row2.tutorialStepRef;
    if (tut !== "none" && (typeof tut !== "string" || !tutorialIds.has(tut))) {
      errors.push({ table: "mainline_node_config", id, message: "tutorialStepRef \u975E\u6CD5" });
    }
    if (typeof row2.unlockRef !== "string" || row2.unlockRef.length === 0) errors.push({ table: "mainline_node_config", id, message: "unlockRef \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.rewardAnchorRef !== "string" || row2.rewardAnchorRef.length === 0) errors.push({ table: "mainline_node_config", id, message: "rewardAnchorRef \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.noAdCheckTag !== "string" || !S7_NO_AD_CHECK_TAGS.includes(row2.noAdCheckTag)) {
      errors.push({ table: "mainline_node_config", id, message: "noAdCheckTag \u975E\u6CD5" });
    }
    if (typeof row2.protectionPeriodTag !== "string" || !S7_PROTECTION_TAGS.includes(row2.protectionPeriodTag)) {
      errors.push({ table: "mainline_node_config", id, message: "protectionPeriodTag \u975E\u6CD5" });
    }
    if (typeof row2.fallback70Tag !== "string" || !S7_FALLBACK70_TAGS.includes(row2.fallback70Tag)) {
      errors.push({ table: "mainline_node_config", id, message: "fallback70Tag \u975E\u6CD5" });
    }
    if (row2.fallback70Tag === "cut_70") cutNodes.push(id);
  }
  for (const id of S7_MAINLINE_NODE_IDS) {
    if (!seenNodeIds.has(id)) errors.push({ table: "mainline_node_config", id, message: `\u7F3A\u5C11\u4E3B\u7EBF\u8282\u70B9 ${id}` });
  }
  for (const id of cutNodes) {
    if (!FORBIDDEN_FALLBACK_NODES.includes(id)) {
      errors.push({ table: "mainline_node_config", id, message: `fallback70Tag=cut_70 \u4EC5\u5141\u8BB8 ${FORBIDDEN_FALLBACK_NODES.join("/")}\uFF0C\u4E0D\u5141\u8BB8 ${id}` });
    }
  }
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const row2 = mainlineById.get(id);
    if (row2 && row2.fallback70Tag !== "cut_70") errors.push({ table: "mainline_node_config", id, message: `${id} \u5FC5\u987B fallback70Tag=cut_70` });
  }
  for (const id of S7_MAINLINE_NODE_IDS) {
    const row2 = mainlineById.get(id);
    if (!row2) continue;
    const idx = Number(id.slice(1));
    const expected = idx <= 17 ? "active" : idx === 18 ? "ending_notice" : "closed";
    if (row2.protectionPeriodTag !== expected) errors.push({ table: "mainline_node_config", id, message: `protectionPeriodTag \u5E94\u4E3A ${expected}` });
  }
  const n018 = mainlineById.get("n018");
  if (n018 && (n018.problemTagRef !== "none" || n018.templateRef !== "none")) {
    errors.push({ table: "mainline_node_config", id: "n018", message: "N018 \u5FC5\u987B\u4E3A\u975E\u6218\u6597\u8282\u70B9\uFF08templateRef/problemTagRef=none\uFF09" });
  }
  const n019 = mainlineById.get("n019");
  if (n019 && (n019.problemTagRef !== "none" || n019.templateRef !== "none")) {
    errors.push({ table: "mainline_node_config", id: "n019", message: "N019 \u5FC5\u987B\u4E3A\u975E\u6218\u6597\u8282\u70B9\uFF08templateRef/problemTagRef=none\uFF09" });
  }
  const chapterRows = rowsByTable.chapter_config;
  const seenChapters = /* @__PURE__ */ new Set();
  for (const row2 of chapterRows) {
    const id = String(row2.chapterId);
    seenChapters.add(id);
    if (typeof row2.starfieldId !== "string" || !S7_STARFIELD_IDS.includes(row2.starfieldId)) errors.push({ table: "chapter_config", id, message: "starfieldId \u975E\u6CD5" });
    if (typeof row2.nodeRangeTag !== "string" || !NODE_RANGE_PATTERN.test(row2.nodeRangeTag)) errors.push({ table: "chapter_config", id, message: "nodeRangeTag \u683C\u5F0F\u975E\u6CD5\uFF08\u5E94\u4E3A nNNN_nNNN\uFF09" });
    checkRefs(errors, "chapter_config", id, "primaryTemplateTags", row2.primaryTemplateTags, templateIds);
    const boss = row2.bossRef;
    if (boss !== "none" && (typeof boss !== "string" || !S7_BOSS_NODE_IDS.includes(boss))) errors.push({ table: "chapter_config", id, message: "bossRef \u975E\u6CD5" });
  }
  for (const id of S7_CHAPTER_IDS) if (!seenChapters.has(id)) errors.push({ table: "chapter_config", id, message: `\u7F3A\u5C11\u7AE0\u8282 ${id}` });
  for (const expected of ["ch10", "ch14", "ch17", "ch20", "ch23", "ch25"]) {
    const row2 = chapterRows.find((r) => r.chapterId === expected);
    if (!row2 || row2.bossRef === "none") errors.push({ table: "chapter_config", id: expected, message: `${expected} \u5FC5\u987B\u8BBE\u7F6E bossRef` });
  }
  const starRows = rowsByTable.star_region_config;
  const seenStarfields = /* @__PURE__ */ new Set();
  for (const row2 of starRows) {
    const id = String(row2.starfieldId);
    seenStarfields.add(id);
    if (typeof row2.nodeRangeTag !== "string" || !NODE_RANGE_PATTERN.test(row2.nodeRangeTag)) errors.push({ table: "star_region_config", id, message: "nodeRangeTag \u683C\u5F0F\u975E\u6CD5\uFF08\u5E94\u4E3A nNNN_nNNN\uFF09" });
    checkStringArrayEnum(errors, "star_region_config", id, "mainProblemTags", row2.mainProblemTags, S7_PROBLEM_TAGS, true);
    checkStringArrayEnum(errors, "star_region_config", id, "reuseProblemTags", row2.reuseProblemTags, S7_PROBLEM_TAGS, false);
    if (typeof row2.bossValidationTag !== "string" || !S7_PROBLEM_TAGS.includes(row2.bossValidationTag)) errors.push({ table: "star_region_config", id, message: "bossValidationTag \u975E\u6CD5" });
    if (!["keep_all", "cut_1", "cut_2"].includes(String(row2.fallback70Policy))) errors.push({ table: "star_region_config", id, message: "fallback70Policy \u975E\u6CD5" });
  }
  for (const id of S7_STARFIELD_IDS) if (!seenStarfields.has(id)) errors.push({ table: "star_region_config", id, message: `\u7F3A\u5C11\u661F\u57DF ${id}` });
  const bossRows = rowsByTable.boss_node_config;
  const seenBoss = /* @__PURE__ */ new Set();
  for (const row2 of bossRows) {
    const id = String(row2.bossNodeId);
    seenBoss.add(id);
    if (!S7_BOSS_NODE_IDS.includes(id)) errors.push({ table: "boss_node_config", id, message: `bossNodeId \u5FC5\u987B\u4E3A ${S7_BOSS_NODE_IDS.join("/")}` });
    if (typeof row2.mainProblemTag !== "string" || !S7_PROBLEM_TAGS.includes(row2.mainProblemTag)) errors.push({ table: "boss_node_config", id, message: "mainProblemTag \u975E\u6CD5" });
    checkSingleRef(errors, "boss_node_config", id, "templateRef", row2.templateRef, templateIds);
    if (typeof row2.secondaryPressureTag !== "string" || !S7_SECONDARY_PRESSURE_TAGS.includes(row2.secondaryPressureTag)) errors.push({ table: "boss_node_config", id, message: "secondaryPressureTag \u975E\u6CD5" });
    checkRefs(errors, "boss_node_config", id, "previewTagRefs", row2.previewTagRefs, tutorialIds);
    if (typeof row2.forbiddenMechanicTag !== "string" || row2.forbiddenMechanicTag.length === 0) errors.push({ table: "boss_node_config", id, message: "forbiddenMechanicTag \u4E0D\u80FD\u4E3A\u7A7A" });
    const mline = mainlineById.get(id);
    if (mline && mline.problemTagRef !== row2.mainProblemTag) errors.push({ table: "boss_node_config", id, message: "mainProblemTag \u5FC5\u987B\u4E0E mainline_node_config \u5BF9\u5E94\u8282\u70B9\u4E00\u81F4" });
  }
  for (const id of S7_BOSS_NODE_IDS) if (!seenBoss.has(id)) errors.push({ table: "boss_node_config", id, message: `\u7F3A\u5C11 Boss \u8282\u70B9 ${id}` });
  const finalBoss = bossRows.find((r) => r.bossNodeId === "n150");
  if (finalBoss && finalBoss.templateRef !== "t10") errors.push({ table: "boss_node_config", id: "n150", message: "N150\uFF08\u7EC8Boss\uFF09templateRef \u5FC5\u987B\u4E3A t10\uFF08Boss \u72C2\u66B4\u4E3B\u8F74\uFF09" });
  const tutRows = rowsByTable.tutorial_trigger_config;
  const seenTut = /* @__PURE__ */ new Set();
  for (const row2 of tutRows) {
    const id = String(row2.tutorialStepId);
    seenTut.add(id);
    const nodeId = row2.nodeId;
    const mline = typeof nodeId === "string" ? mainlineById.get(nodeId) : void 0;
    if (typeof nodeId !== "string" || !mline) {
      errors.push({ table: "tutorial_trigger_config", id, message: `nodeId "${String(nodeId)}" \u4E0D\u662F\u6709\u6548\u4E3B\u7EBF\u8282\u70B9` });
    }
    if (!["on_node_enter", "on_node_complete", "on_checkpoint_enter"].includes(String(row2.triggerTag))) errors.push({ table: "tutorial_trigger_config", id, message: "triggerTag \u975E\u6CD5" });
    if (typeof row2.contentTag !== "string" || !ID_PATTERN.test(row2.contentTag)) errors.push({ table: "tutorial_trigger_config", id, message: "contentTag \u5FC5\u987B\u662F\u5168\u5C0F\u5199\u4E0B\u5212\u7EBF\u6807\u7B7E\uFF08\u4E0D\u5199\u957F\u6559\u7A0B\u6587\u6848\uFF09" });
    if (typeof row2.protectionPeriodTag !== "string" || !S7_PROTECTION_TAGS.includes(row2.protectionPeriodTag)) errors.push({ table: "tutorial_trigger_config", id, message: "protectionPeriodTag \u975E\u6CD5" });
    if (!["skippable", "mandatory_ack"].includes(String(row2.skippableTag))) errors.push({ table: "tutorial_trigger_config", id, message: "skippableTag \u975E\u6CD5" });
    if (mline) {
      if (row2.unlockRef !== mline.unlockRef) errors.push({ table: "tutorial_trigger_config", id, message: "unlockRef \u5FC5\u987B\u4E0E\u5BF9\u5E94\u4E3B\u7EBF\u8282\u70B9 unlockRef \u4E00\u81F4" });
      if (row2.protectionPeriodTag !== mline.protectionPeriodTag) errors.push({ table: "tutorial_trigger_config", id, message: "protectionPeriodTag \u5FC5\u987B\u4E0E\u5BF9\u5E94\u4E3B\u7EBF\u8282\u70B9\u4E00\u81F4" });
    }
    const expectedMandatory = ["tut01", "tut02"].includes(id);
    if (expectedMandatory && row2.skippableTag !== "mandatory_ack") errors.push({ table: "tutorial_trigger_config", id, message: `${id} \u5FC5\u987B\u4E3A mandatory_ack` });
    if (!expectedMandatory && row2.skippableTag === "mandatory_ack") errors.push({ table: "tutorial_trigger_config", id, message: `${id} \u4E0D\u5F97\u4E3A mandatory_ack\uFF08\u4EC5 TUT01/02\uFF09` });
  }
  for (const id of S7_TUTORIAL_STEP_IDS) if (!seenTut.has(id)) errors.push({ table: "tutorial_trigger_config", id, message: `\u7F3A\u5C11\u6559\u7A0B\u89E6\u53D1 ${id}` });
  const buildingUnlockIds = new Set(
    rowsByTable.building_unlock_config.filter((r) => !RESERVED_TOKEN_PATTERN.test(String(r.unlockId)) && !RESERVED_TOKEN_PATTERN.test(String(r.cc05aLinkTag))).map((r) => String(r.unlockId))
  );
  const mainlineUnlockRefs = /* @__PURE__ */ new Set();
  for (const row2 of mainlineRows) {
    const u = String(row2.unlockRef);
    if (u !== "none") mainlineUnlockRefs.add(u);
  }
  const unlockRows = rowsByTable.unlock_checkpoint_config;
  const seenUnlock = /* @__PURE__ */ new Set();
  for (const row2 of unlockRows) {
    const id = String(row2.unlockRef);
    seenUnlock.add(id);
    const nodeId = row2.nodeId;
    if (nodeId !== "none" && (typeof nodeId !== "string" || !S7_MAINLINE_NODE_IDS.includes(nodeId))) {
      errors.push({ table: "unlock_checkpoint_config", id, message: `nodeId "${String(nodeId)}" \u975E\u6CD5` });
    }
    if (typeof row2.systemTag !== "string" || row2.systemTag.length === 0) errors.push({ table: "unlock_checkpoint_config", id, message: "systemTag \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.requiredForMainlineTag !== "boolean") errors.push({ table: "unlock_checkpoint_config", id, message: "requiredForMainlineTag \u5FC5\u987B\u662F\u5E03\u5C14\u503C" });
    if (typeof row2.noAdRequiredTag !== "boolean") errors.push({ table: "unlock_checkpoint_config", id, message: "noAdRequiredTag \u5FC5\u987B\u662F\u5E03\u5C14\u503C" });
    const bref = row2.buildingUnlockRef;
    if (bref !== "none" && (typeof bref !== "string" || !buildingUnlockIds.has(bref))) {
      errors.push({ table: "unlock_checkpoint_config", id, message: `buildingUnlockRef "${String(bref)}" \u4E0D\u5B58\u5728\u4E8E building_unlock_config` });
    }
    if (row2.requiredForMainlineTag === true && typeof nodeId === "string" && FORBIDDEN_FALLBACK_NODES.includes(nodeId)) {
      errors.push({ table: "unlock_checkpoint_config", id, message: `\u6838\u5FC3\u89E3\u9501\u4E0D\u5F97\u6302 70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 ${nodeId}` });
    }
  }
  for (const u of mainlineUnlockRefs) if (!seenUnlock.has(u)) errors.push({ table: "unlock_checkpoint_config", id: u, message: `\u4E3B\u7EBF unlockRef "${u}" \u7F3A\u5C11\u767B\u8BB0\u884C` });
  const registeredBuildingRefs = new Set(unlockRows.map((r) => String(r.buildingUnlockRef)).filter((v) => v !== "none"));
  for (const bid of buildingUnlockIds) if (!registeredBuildingRefs.has(bid)) errors.push({ table: "unlock_checkpoint_config", id: bid, message: `\u5EFA\u7B51\u89E3\u9501 "${bid}" \u7F3A\u5C11\u6865\u63A5\u767B\u8BB0\u884C` });
  const protRows = rowsByTable.protection_reset_config;
  const protById = /* @__PURE__ */ new Map();
  for (const row2 of protRows) {
    const id = String(row2.nodeId);
    protById.set(id, row2);
    if (!["n018", "n019"].includes(id)) errors.push({ table: "protection_reset_config", id, message: "nodeId \u4EC5\u5141\u8BB8 n018/n019" });
    if (typeof row2.protectionPeriodTag !== "string" || !S7_PROTECTION_TAGS.includes(row2.protectionPeriodTag)) errors.push({ table: "protection_reset_config", id, message: "protectionPeriodTag \u975E\u6CD5" });
    if (typeof row2.freeResetFlag !== "boolean") errors.push({ table: "protection_reset_config", id, message: "freeResetFlag \u5FC5\u987B\u662F\u5E03\u5C14\u503C" });
    if (typeof row2.irreversibleWarningFlag !== "boolean") errors.push({ table: "protection_reset_config", id, message: "irreversibleWarningFlag \u5FC5\u987B\u662F\u5E03\u5C14\u503C" });
    if (!Array.isArray(row2.resetScopeTags)) errors.push({ table: "protection_reset_config", id, message: "resetScopeTags \u5FC5\u987B\u662F\u6570\u7EC4" });
    if (!Array.isArray(row2.alwaysReversibleTags) || row2.alwaysReversibleTags.length === 0) errors.push({ table: "protection_reset_config", id, message: "alwaysReversibleTags \u4E0D\u80FD\u4E3A\u7A7A" });
  }
  const n018p = protById.get("n018");
  if (!n018p) errors.push({ table: "protection_reset_config", id: "n018", message: "\u7F3A\u5C11 N018 \u884C" });
  else {
    if (n018p.freeResetFlag !== true) errors.push({ table: "protection_reset_config", id: "n018", message: "N018 freeResetFlag \u5FC5\u987B\u4E3A true\uFF08\u5168\u961F\u6574\u5907 / \u514D\u8D39\u603B\u91CD\u7F6E\uFF09" });
    if (!Array.isArray(n018p.resetScopeTags) || n018p.resetScopeTags.length === 0) errors.push({ table: "protection_reset_config", id: "n018", message: "N018 resetScopeTags \u4E0D\u80FD\u4E3A\u7A7A" });
  }
  const n019p = protById.get("n019");
  if (!n019p) errors.push({ table: "protection_reset_config", id: "n019", message: "\u7F3A\u5C11 N019 \u884C" });
  else if (n019p.irreversibleWarningFlag !== true) errors.push({ table: "protection_reset_config", id: "n019", message: "N019 irreversibleWarningFlag \u5FC5\u987B\u4E3A true\uFF08\u6B63\u5F0F\u517B\u6210\u671F\u63D0\u9192\uFF09" });
  for (const table of TIER_C_TABLES) {
    const idField = S7_ID_FIELD[table];
    for (const row2 of rowsByTable[table]) {
      const rowId = String(row2[idField] ?? "-");
      for (const [field, value] of Object.entries(row2)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === "string" && RESERVED_TOKEN_PATTERN.test(v)) {
            errors.push({ table, id: rowId, message: `${field} \u542B\u6761\u4EF6\u9884\u7559 / \u5947\u8FF9\u5EFA\u7B51\u5F15\u7528 "${v}"\uFF0C\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u4E3B\u7EBF / \u6559\u7A0B / \u89E3\u9501 / \u5B8C\u6210\u76EE\u6807` });
          }
        }
      }
    }
  }
}
function validateTierD(errors, rowsByTable) {
  const mainlineRows = rowsByTable.mainline_node_config;
  const mainlineById = /* @__PURE__ */ new Map();
  for (const row2 of mainlineRows) mainlineById.set(String(row2.nodeId), row2);
  const rewardParamIds = new Set(rowsByTable.reward_param.map((r) => String(r.rowId)));
  const poolRows = rowsByTable.reward_pool_ref_config;
  if (poolRows.length !== 10) errors.push({ table: "reward_pool_ref_config", id: "-", message: `\u5FC5\u987B\u4E3A 10 \u884C\uFF0C\u5B9E\u9645 ${poolRows.length}` });
  const anchorRefsFromMainline = new Set(mainlineRows.map((r) => String(r.rewardAnchorRef)));
  const seenAnchors = /* @__PURE__ */ new Set();
  for (const row2 of poolRows) {
    const id = String(row2.rewardAnchorRef);
    if (seenAnchors.has(id)) errors.push({ table: "reward_pool_ref_config", id, message: "rewardAnchorRef \u91CD\u590D" });
    seenAnchors.add(id);
    if (typeof row2.sourceTag !== "string" || !S7_REWARD_SOURCE_TAGS.includes(row2.sourceTag)) errors.push({ table: "reward_pool_ref_config", id, message: "sourceTag \u975E\u6CD5" });
    if (typeof row2.poolRoleTag !== "string" || !ID_PATTERN.test(row2.poolRoleTag)) errors.push({ table: "reward_pool_ref_config", id, message: "poolRoleTag \u4E0D\u5408\u6CD5" });
    if (row2.noAdRequiredTag !== true) errors.push({ table: "reward_pool_ref_config", id, message: "noAdRequiredTag \u5FC5\u987B\u4E3A true" });
    if (typeof row2.goodItemTag !== "string" || row2.goodItemTag.length === 0) errors.push({ table: "reward_pool_ref_config", id, message: "goodItemTag \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.notes !== "string" || row2.notes.length === 0) errors.push({ table: "reward_pool_ref_config", id, message: "notes \u4E0D\u80FD\u4E3A\u7A7A" });
    if (!Array.isArray(row2.nodeRefs) || row2.nodeRefs.length === 0) {
      errors.push({ table: "reward_pool_ref_config", id, message: "nodeRefs \u4E0D\u80FD\u4E3A\u7A7A" });
    } else {
      for (const ref of row2.nodeRefs) {
        const nodeId = String(ref);
        const mline = mainlineById.get(nodeId);
        if (!mline) errors.push({ table: "reward_pool_ref_config", id, message: `nodeRefs \u5F15\u7528\u7684 "${nodeId}" \u4E0D\u662F\u6709\u6548\u4E3B\u7EBF\u8282\u70B9` });
        else if (mline.rewardAnchorRef !== id) errors.push({ table: "reward_pool_ref_config", id, message: `\u4E3B\u7EBF\u8282\u70B9 ${nodeId} \u7684 rewardAnchorRef \u4E0D\u662F "${id}"` });
      }
    }
    if (!Array.isArray(row2.rewardParamRef)) {
      errors.push({ table: "reward_pool_ref_config", id, message: "rewardParamRef \u5FC5\u987B\u662F\u6570\u7EC4" });
    } else {
      if (row2.sourceTag === "source_none" && row2.rewardParamRef.length !== 0) errors.push({ table: "reward_pool_ref_config", id, message: "sourceTag=source_none \u65F6 rewardParamRef \u5FC5\u987B\u4E3A\u7A7A" });
      if (row2.sourceTag !== "source_none" && row2.rewardParamRef.length === 0) errors.push({ table: "reward_pool_ref_config", id, message: "rewardParamRef \u4E0D\u80FD\u4E3A\u7A7A" });
      for (const ref of row2.rewardParamRef) {
        if (typeof ref !== "string" || !rewardParamIds.has(ref)) errors.push({ table: "reward_pool_ref_config", id, message: `rewardParamRef \u5F15\u7528\u7684 "${String(ref)}" \u4E0D\u5B58\u5728\u4E8E reward_param` });
      }
    }
  }
  for (const anchor of anchorRefsFromMainline) {
    if (!seenAnchors.has(anchor)) errors.push({ table: "reward_pool_ref_config", id: anchor, message: `\u4E3B\u7EBF\u5F15\u7528\u7684 rewardAnchorRef "${anchor}" \u7F3A\u5C11\u6865\u63A5\u767B\u8BB0\u884C` });
  }
  for (const anchor of seenAnchors) {
    if (!anchorRefsFromMainline.has(anchor)) errors.push({ table: "reward_pool_ref_config", id: anchor, message: `rewardAnchorRef "${anchor}" \u672A\u88AB\u4EFB\u4F55\u4E3B\u7EBF\u8282\u70B9\u5F15\u7528` });
  }
  const checkRows = rowsByTable.no_ad_path_check_config;
  const expectedCheckTags = S7_NO_AD_CHECK_TAGS.filter((t) => t !== "none");
  if (checkRows.length !== expectedCheckTags.length) errors.push({ table: "no_ad_path_check_config", id: "-", message: `\u5FC5\u987B\u4E3A ${expectedCheckTags.length} \u884C\uFF0C\u5B9E\u9645 ${checkRows.length}` });
  const seenCheckTags = /* @__PURE__ */ new Set();
  const checkTagsFromMainline = /* @__PURE__ */ new Set();
  for (const row2 of mainlineRows) {
    const tag = String(row2.noAdCheckTag);
    if (tag !== "none") checkTagsFromMainline.add(tag);
  }
  for (const row2 of checkRows) {
    const id = String(row2.checkTag);
    if (!expectedCheckTags.includes(id)) errors.push({ table: "no_ad_path_check_config", id, message: "checkTag \u4E0D\u5728 S7_NO_AD_CHECK_TAGS \u8303\u56F4\u5185" });
    if (seenCheckTags.has(id)) errors.push({ table: "no_ad_path_check_config", id, message: "checkTag \u91CD\u590D" });
    seenCheckTags.add(id);
    const nodeId = String(row2.nodeId);
    const mline = mainlineById.get(nodeId);
    if (!mline) errors.push({ table: "no_ad_path_check_config", id, message: `nodeId "${nodeId}" \u4E0D\u662F\u6709\u6548\u4E3B\u7EBF\u8282\u70B9` });
    else if (mline.noAdCheckTag !== id) errors.push({ table: "no_ad_path_check_config", id, message: `\u4E3B\u7EBF\u8282\u70B9 ${nodeId} \u7684 noAdCheckTag \u4E0D\u662F "${id}"` });
    if (FORBIDDEN_FALLBACK_NODES.includes(nodeId)) errors.push({ table: "no_ad_path_check_config", id, message: `\u4E0D\u770B\u5E7F\u544A\u68C0\u67E5\u70B9\u4E0D\u5F97\u7ED1\u5B9A 70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 ${nodeId}` });
    if (typeof row2.requiredStateTag !== "string" || row2.requiredStateTag.length === 0 || !ID_PATTERN.test(row2.requiredStateTag)) errors.push({ table: "no_ad_path_check_config", id, message: "requiredStateTag \u4E0D\u5408\u6CD5" });
    checkStringArrayEnum(errors, "no_ad_path_check_config", id, "forbiddenDependencyTag", row2.forbiddenDependencyTag, S7_FORBIDDEN_DEPENDENCY_TAGS, true);
  }
  for (const tag of expectedCheckTags) if (!seenCheckTags.has(tag)) errors.push({ table: "no_ad_path_check_config", id: tag, message: `\u7F3A\u5C11\u68C0\u67E5\u70B9 ${tag}` });
  for (const tag of checkTagsFromMainline) if (!seenCheckTags.has(tag)) errors.push({ table: "no_ad_path_check_config", id: tag, message: `\u4E3B\u7EBF\u5F15\u7528\u7684 noAdCheckTag "${tag}" \u7F3A\u5C11\u68C0\u67E5\u70B9\u767B\u8BB0\u884C` });
  const fbRows = rowsByTable.risk_fallback_70_config;
  const fallbackNodesFromMainline = mainlineRows.filter((r) => r.fallback70Tag !== "keep_70").map((r) => String(r.nodeId));
  if (fbRows.length !== fallbackNodesFromMainline.length) errors.push({ table: "risk_fallback_70_config", id: "-", message: `\u5FC5\u987B\u4E3A ${fallbackNodesFromMainline.length} \u884C\uFF0C\u5B9E\u9645 ${fbRows.length}` });
  const seenFbNodes = /* @__PURE__ */ new Set();
  for (const row2 of fbRows) {
    const id = String(row2.nodeId);
    if (seenFbNodes.has(id)) errors.push({ table: "risk_fallback_70_config", id, message: "nodeId \u91CD\u590D" });
    seenFbNodes.add(id);
    const mline = mainlineById.get(id);
    if (!mline) errors.push({ table: "risk_fallback_70_config", id, message: `nodeId "${id}" \u4E0D\u662F\u6709\u6548\u4E3B\u7EBF\u8282\u70B9` });
    else if (mline.fallback70Tag !== row2.fallback70Tag) errors.push({ table: "risk_fallback_70_config", id, message: `fallback70Tag \u5FC5\u987B\u4E0E\u4E3B\u7EBF\u8282\u70B9\u4E00\u81F4\uFF08"${String(mline.fallback70Tag)}"\uFF09` });
    if (row2.fallback70Tag === "keep_70" || !S7_FALLBACK70_TAGS.includes(String(row2.fallback70Tag))) errors.push({ table: "risk_fallback_70_config", id, message: "fallback70Tag \u975E\u6CD5\uFF08\u4E0D\u5F97\u4E3A keep_70\uFF09" });
    if (row2.criticalPathTag !== false) errors.push({ table: "risk_fallback_70_config", id, message: "criticalPathTag \u5FC5\u987B\u4E3A false\uFF0870 \u56DE\u9000\u4E0D\u53EF\u780D\u5173\u952E\u8DEF\u5F84\uFF09" });
    if (typeof row2.fallbackReasonTag !== "string" || row2.fallbackReasonTag.length === 0 || !ID_PATTERN.test(row2.fallbackReasonTag)) errors.push({ table: "risk_fallback_70_config", id, message: "fallbackReasonTag \u4E0D\u5408\u6CD5" });
    if (typeof row2.replacementRef !== "string" || row2.replacementRef.length === 0 || !ID_PATTERN.test(row2.replacementRef)) {
      errors.push({ table: "risk_fallback_70_config", id, message: "replacementRef \u4E0D\u5408\u6CD5" });
    } else {
      const embedded = row2.replacementRef.match(EMBEDDED_NODE_ID_PATTERN) ?? [];
      for (const ref of embedded) {
        if (!mainlineById.has(ref)) errors.push({ table: "risk_fallback_70_config", id, message: `replacementRef \u5F15\u7528\u7684\u8282\u70B9 "${ref}" \u4E0D\u5B58\u5728\uFF08\u7A7A\u5F15\u7528\uFF09` });
        else if (FORBIDDEN_FALLBACK_NODES.includes(ref)) errors.push({ table: "risk_fallback_70_config", id, message: `replacementRef \u4E0D\u5F97\u5F15\u7528 70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 "${ref}"\uFF08\u7A7A\u5F15\u7528\uFF09` });
      }
    }
  }
  for (const id of fallbackNodesFromMainline) if (!seenFbNodes.has(id)) errors.push({ table: "risk_fallback_70_config", id, message: `\u4E3B\u7EBF fallback70Tag != keep_70 \u7684\u8282\u70B9 "${id}" \u7F3A\u5C11\u56DE\u9000\u767B\u8BB0\u884C` });
  for (const id of FORBIDDEN_FALLBACK_NODES) {
    const mline = mainlineById.get(id);
    if (!mline) continue;
    if (mline.tutorialStepRef !== "none") errors.push({ table: "mainline_node_config", id, message: `70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 ${id} \u7684 tutorialStepRef \u5FC5\u987B\u4E3A none\uFF08\u9632\u6559\u7A0B\u65AD\u70B9\uFF09` });
    if (mline.unlockRef !== "none") errors.push({ table: "mainline_node_config", id, message: `70 \u56DE\u9000\u53EF\u5220\u8282\u70B9 ${id} \u7684 unlockRef \u5FC5\u987B\u4E3A none\uFF08\u9632\u7A7A\u5F15\u7528\uFF09` });
  }
  for (const table of TIER_D_TABLES) {
    const idField = S7_ID_FIELD[table];
    for (const row2 of rowsByTable[table]) {
      const rowId = String(row2[idField] ?? "-");
      for (const [field, value] of Object.entries(row2)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === "string" && RESERVED_TOKEN_PATTERN.test(v)) {
            errors.push({ table, id: rowId, message: `${field} \u542B\u6761\u4EF6\u9884\u7559 / \u5947\u8FF9\u5EFA\u7B51\u5F15\u7528 "${v}"\uFF0C\u7981\u6B62\u8FDB\u5165\u9ED8\u8BA4\u6865\u63A5\u914D\u7F6E` });
          }
        }
      }
    }
  }
}
function checkGrowthBandCoverage(errors, bands, minLv, maxLv, label) {
  if (bands.length === 0) {
    errors.push({ table: "growth_band_param", id: label, message: `${label} \u7F3A\u5C11 band_linear \u6210\u957F\u6BB5` });
    return;
  }
  const sorted = [...bands].sort((a, b) => a.from - b.from);
  if (sorted[0].from !== minLv) errors.push({ table: "growth_band_param", id: label, message: `${label} \u6210\u957F\u6BB5\u8D77\u70B9\u5FC5\u987B\u4E3A ${minLv}` });
  if (sorted[sorted.length - 1].to !== maxLv) errors.push({ table: "growth_band_param", id: label, message: `${label} \u6210\u957F\u6BB5\u7EC8\u70B9\u5FC5\u987B\u4E3A ${maxLv}` });
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].from !== sorted[i - 1].to + 1) {
      errors.push({ table: "growth_band_param", id: label, message: `${label} \u6210\u957F\u6BB5\u4E0D\u8FDE\u7EED\uFF08${sorted[i - 1].to}->${sorted[i].from}\uFF09` });
    }
  }
}
function validateGrowth(errors, rowsByTable) {
  const rows = rowsByTable.growth_band_param ?? [];
  const byTarget = { ship: [], pilot: [] };
  for (const row2 of rows) {
    const id = String(row2.rowId ?? "-");
    const tt = row2.targetType;
    if (typeof tt !== "string" || !S7_GROWTH_TARGET_TYPES.includes(tt)) {
      errors.push({ table: "growth_band_param", id, message: "targetType \u975E\u6CD5" });
      continue;
    }
    const ct = row2.curveType;
    if (typeof ct !== "string" || !S7_GROWTH_CURVE_TYPES.includes(ct)) {
      errors.push({ table: "growth_band_param", id, message: "curveType \u975E\u6CD5" });
    }
    if (typeof row2.bandId !== "string" || !ID_PATTERN.test(row2.bandId)) {
      errors.push({ table: "growth_band_param", id, message: "bandId \u4E0D\u5408\u6CD5" });
    }
    if (typeof row2.secondaryKind !== "string" || !S7_GROWTH_SECONDARY_KINDS.includes(row2.secondaryKind)) {
      errors.push({ table: "growth_band_param", id, message: "secondaryKind \u975E\u6CD5" });
    } else if (row2.secondaryKind !== S7_GROWTH_EXPECTED_SECONDARY[tt]) {
      errors.push({ table: "growth_band_param", id, message: `secondaryKind \u5E94\u4E3A ${S7_GROWTH_EXPECTED_SECONDARY[tt]}` });
    }
    const f = num(row2.fromIndex);
    const t = num(row2.toIndex);
    const interp = num(row2.interpFromIndex);
    const pmin = num(row2.powerMin);
    const pmax = num(row2.powerMax);
    const smin = num(row2.secondaryMin);
    const smax = num(row2.secondaryMax);
    if (f === null || t === null || interp === null) errors.push({ table: "growth_band_param", id, message: "fromIndex/toIndex/interpFromIndex \u5FC5\u987B\u662F\u6570\u503C" });
    if (pmin === null || pmax === null || smin === null || smax === null) errors.push({ table: "growth_band_param", id, message: "power/secondary \u7AEF\u70B9\u5FC5\u987B\u662F\u6570\u503C" });
    if (ct === "band_linear") {
      if (f !== null && t !== null && f > t) errors.push({ table: "growth_band_param", id, message: "fromIndex<=toIndex \u4E0D\u6210\u7ACB" });
      if (interp !== null && t !== null && interp >= t) errors.push({ table: "growth_band_param", id, message: "interpFromIndex \u5FC5\u987B < toIndex\uFF08\u63D2\u503C\u5206\u6BCD\u975E\u96F6\uFF09" });
      if (interp !== null && f !== null && interp > f) errors.push({ table: "growth_band_param", id, message: "interpFromIndex \u4E0D\u5F97 > fromIndex" });
      if (pmin !== null && pmax !== null && pmin > pmax) errors.push({ table: "growth_band_param", id, message: "powerMin<=powerMax \u4E0D\u6210\u7ACB" });
      if ((tt === "ship" || tt === "pilot") && f !== null && t !== null) byTarget[tt].push({ from: f, to: t });
    } else if (ct === "control_point") {
      if (f !== null && t !== null && f !== t) errors.push({ table: "growth_band_param", id, message: "control_point fromIndex \u5FC5\u987B\u7B49\u4E8E toIndex" });
      if (interp !== null && f !== null && interp !== f) errors.push({ table: "growth_band_param", id, message: "control_point interpFromIndex \u5FC5\u987B\u7B49\u4E8E fromIndex" });
      if (pmin !== null && pmax !== null && pmin !== pmax) errors.push({ table: "growth_band_param", id, message: "control_point powerMin \u5FC5\u987B\u7B49\u4E8E powerMax" });
      if (smin !== null && smax !== null && smin !== smax) errors.push({ table: "growth_band_param", id, message: "control_point secondaryMin \u5FC5\u987B\u7B49\u4E8E secondaryMax" });
    }
  }
  checkGrowthBandCoverage(errors, byTarget.ship, 1, 100, "ship");
  checkGrowthBandCoverage(errors, byTarget.pilot, 1, 40, "pilot");
}
function battleArrayRefs(errors, table, id, field, value, validIds, requireNonEmpty) {
  if (!Array.isArray(value)) {
    errors.push({ table, id, message: `${field} \u5FC5\u987B\u662F\u6570\u7EC4` });
    return;
  }
  if (requireNonEmpty && value.length === 0) errors.push({ table, id, message: `${field} \u4E0D\u80FD\u4E3A\u7A7A` });
  for (const ref of value) {
    if (typeof ref !== "string" || !validIds.has(ref)) {
      errors.push({ table, id, message: `${field} \u5F15\u7528\u7684 "${String(ref)}" \u4E0D\u5B58\u5728` });
    }
  }
}
function deriveBattleStage(nodeTypeTag) {
  if (nodeTypeTag === "boss") return "boss";
  if (nodeTypeTag === "elite") return "elite";
  return "normal";
}
function validateBattle(errors, rowsByTable) {
  const shipIds = new Set(rowsByTable.ship_config.map((r) => String(r.shipId)));
  const enemyIds = new Set(rowsByTable.enemy_schema_config.map((r) => String(r.enemyId)));
  const bossNodeIds = new Set(rowsByTable.boss_node_config.map((r) => String(r.bossNodeId)));
  const templateIds = new Set(rowsByTable.battle_template_config.map((r) => String(r.templateId)));
  const pressureIds = new Set(rowsByTable.pressure_param.map((r) => String(r.rowId)));
  const mainlineById = /* @__PURE__ */ new Map();
  for (const r of rowsByTable.mainline_node_config) mainlineById.set(String(r.nodeId), r);
  const unitRows = rowsByTable.battle_unit_stat_param;
  const effectRows = rowsByTable.battle_effect_param;
  const encounterRows = rowsByTable.battle_encounter_param;
  const spawnRows = rowsByTable.battle_spawn_param;
  const phaseRows = rowsByTable.battle_boss_phase_param;
  const unitById = /* @__PURE__ */ new Map();
  for (const r of unitRows) unitById.set(String(r.rowId), r);
  const unitIds = new Set(unitById.keys());
  const effectIds = new Set(effectRows.map((r) => String(r.rowId)));
  const effectById = /* @__PURE__ */ new Map();
  for (const r of effectRows) effectById.set(String(r.rowId), r);
  const spawnById = /* @__PURE__ */ new Map();
  for (const r of spawnRows) spawnById.set(String(r.rowId), r);
  const spawnIds = new Set(spawnById.keys());
  const phaseById = /* @__PURE__ */ new Map();
  for (const r of phaseRows) phaseById.set(String(r.rowId), r);
  const phaseIds = new Set(phaseById.keys());
  const encounterById = /* @__PURE__ */ new Map();
  for (const r of encounterRows) encounterById.set(String(r.rowId), r);
  for (const row2 of unitRows) {
    const id = String(row2.rowId);
    const tt = row2.targetType;
    if (typeof tt !== "string" || !S7_BATTLE_UNIT_TARGET_TYPES.includes(tt)) {
      errors.push({ table: "battle_unit_stat_param", id, message: "targetType \u975E\u6CD5" });
    } else if (tt === "prop") {
      if (row2.unitRef !== "none") {
        errors.push({ table: "battle_unit_stat_param", id, message: "prop \u7C7B\u5355\u4F4D unitRef \u5FC5\u987B\u4E3A none\uFF08\u4E0D\u6302\u5B9E\u4F53\u771F\u6E90\u8868\uFF09" });
      }
    } else {
      const validSet = tt === "ship" ? shipIds : tt === "enemy" ? enemyIds : bossNodeIds;
      if (typeof row2.unitRef !== "string" || !validSet.has(row2.unitRef)) {
        errors.push({ table: "battle_unit_stat_param", id, message: `unitRef "${String(row2.unitRef)}" \u4E0D\u5B58\u5728\u4E8E\u5BF9\u5E94\u5B9E\u4F53\u8868\uFF08${tt}\uFF09` });
      }
    }
    if (tt === "ship" && (typeof row2.positionType !== "string" || !S7_POSITION_TYPES.includes(row2.positionType))) {
      errors.push({ table: "battle_unit_stat_param", id, message: `positionType "${String(row2.positionType)}" \u975E\u6CD5\uFF08\u73A9\u5BB6\u661F\u8230\u5FC5\u586B\uFF0C\u5141\u8BB8\uFF1A${S7_POSITION_TYPES.join("/")}\uFF09` });
    }
    for (const f of ["maxHp", "attack", "armor", "attackIntervalSec", "attackRangeCells"]) {
      const v = num(row2[f]);
      if (v === null || v <= 0) errors.push({ table: "battle_unit_stat_param", id, message: `${f} \u5FC5\u987B\u4E3A\u6B63\u6570` });
    }
    const pe = num(row2.passiveEnergyPerSec);
    if (pe === null || pe < 0) errors.push({ table: "battle_unit_stat_param", id, message: "passiveEnergyPerSec \u5FC5\u987B >= 0" });
    const sr = num(row2.sizeRows);
    if (sr === null || !Number.isInteger(sr) || sr < 1 || sr > 3) errors.push({ table: "battle_unit_stat_param", id, message: "sizeRows \u5FC5\u987B\u4E3A 1-3 \u7684\u6574\u6570" });
    const sc = num(row2.sizeCols);
    if (sc === null || !Number.isInteger(sc) || sc < 1 || sc > 7) errors.push({ table: "battle_unit_stat_param", id, message: "sizeCols \u5FC5\u987B\u4E3A 1-7 \u7684\u6574\u6570" });
    if (typeof row2.targetingTag !== "string" || !S7_BATTLE_UNIT_TARGETING_TAGS.includes(row2.targetingTag)) {
      errors.push({ table: "battle_unit_stat_param", id, message: "targetingTag \u975E\u6CD5\uFF08\u9996\u7248\u81F3\u5C11\u652F\u6301 nearest_random_tie\uFF09" });
    }
    for (const f of ["normalEffectRef", "ultimateEffectRef", "coreEffectRef"]) {
      const v = row2[f];
      if (v !== "none" && (typeof v !== "string" || !effectIds.has(v))) {
        errors.push({ table: "battle_unit_stat_param", id, message: `${f} "${String(v)}" \u5FC5\u987B\u4E3A none \u6216\u6709\u6548 battle_effect_param.rowId` });
      }
    }
    const ucd = num(row2.ultimateCdSec);
    if (ucd === null || ucd < 0) errors.push({ table: "battle_unit_stat_param", id, message: "ultimateCdSec \u5FC5\u987B >= 0\uFF08\u65E0\u5927\u62DB\u5199 0\uFF1B\u57572 \u5927\u62DB\u89E6\u53D1\u51B7\u5374\uFF09" });
    if (row2.controlResist !== void 0) {
      const cr = num(row2.controlResist);
      if (cr === null || cr < 0 || cr > 1) errors.push({ table: "battle_unit_stat_param", id, message: "controlResist\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 [0,1]" });
    }
    if (row2.baseCritRate !== void 0) {
      const bcr = num(row2.baseCritRate);
      if (bcr === null || bcr < 0 || bcr > 1) errors.push({ table: "battle_unit_stat_param", id, message: "baseCritRate\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 [0,1]" });
    }
    if (row2.baseCritDmg !== void 0) {
      const bcd = num(row2.baseCritDmg);
      if (bcd === null || bcd < 0) errors.push({ table: "battle_unit_stat_param", id, message: "baseCritDmg\uFF08\u53EF\u9009\uFF09\u5FC5\u987B >= 0" });
    }
    if (row2.extraTriggerBlocks !== void 0) {
      if (!Array.isArray(row2.extraTriggerBlocks) || row2.extraTriggerBlocks.length === 0) {
        errors.push({ table: "battle_unit_stat_param", id, message: "extraTriggerBlocks\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u975E\u7A7A\u6570\u7EC4" });
      } else {
        for (const tb of row2.extraTriggerBlocks) {
          if (!tb || typeof tb !== "object" || tb.kind !== "trigger") {
            errors.push({ table: "battle_unit_stat_param", id, message: 'extraTriggerBlocks \u6BCF\u9879\u5FC5\u987B\u4E3A kind="trigger" \u7684\u89E6\u53D1\u79EF\u6728' });
            continue;
          }
          if (typeof tb.on !== "string" || !S7_TRIGGER_ON_VALUES.includes(tb.on)) errors.push({ table: "battle_unit_stat_param", id, message: `extraTriggerBlocks.on "${String(tb.on)}" \u975E\u6CD5` });
          if (typeof tb.effectRef !== "string" || !effectIds.has(tb.effectRef)) errors.push({ table: "battle_unit_stat_param", id, message: `extraTriggerBlocks.effectRef "${String(tb.effectRef)}" \u5FC5\u987B\u4E3A\u6709\u6548 battle_effect_param.rowId` });
          if (tb.on === "cd") {
            const cd = num(tb.cdSec);
            if (cd === null || !(cd > 0)) errors.push({ table: "battle_unit_stat_param", id, message: "extraTriggerBlocks cd \u578B\u5FC5\u987B\u7ED9\u6B63\u6570 cdSec" });
          }
          if (tb.onKillRoleTags !== void 0 && (!Array.isArray(tb.onKillRoleTags) || tb.onKillRoleTags.length === 0 || tb.onKillRoleTags.some((x) => typeof x !== "string"))) {
            errors.push({ table: "battle_unit_stat_param", id, message: "extraTriggerBlocks.onKillRoleTags\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\u6570\u7EC4" });
          }
        }
      }
    }
    if (row2.stackRules !== void 0) {
      if (!Array.isArray(row2.stackRules) || row2.stackRules.length === 0) {
        errors.push({ table: "battle_unit_stat_param", id, message: "stackRules\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u975E\u7A7A\u6570\u7EC4" });
      } else {
        for (const sr2 of row2.stackRules) {
          if (!sr2 || typeof sr2 !== "object") {
            errors.push({ table: "battle_unit_stat_param", id, message: "stackRules \u6BCF\u9879\u5FC5\u987B\u4E3A\u5BF9\u8C61" });
            continue;
          }
          if (typeof sr2.ruleId !== "string" || sr2.ruleId.length === 0) errors.push({ table: "battle_unit_stat_param", id, message: "stackRules.ruleId \u5FC5\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32" });
          if (typeof sr2.on !== "string" || !S7_STACK_RULE_ON_VALUES.includes(sr2.on)) errors.push({ table: "battle_unit_stat_param", id, message: `stackRules.on "${String(sr2.on)}" \u975E\u6CD5` });
          if (typeof sr2.stat !== "string" || !S7_STACK_RULE_STAT_VALUES.includes(sr2.stat)) errors.push({ table: "battle_unit_stat_param", id, message: `stackRules.stat "${String(sr2.stat)}" \u975E\u6CD5` });
          const ps = num(sr2.perStack);
          if (ps === null || !(ps > 0) || !Number.isFinite(ps)) errors.push({ table: "battle_unit_stat_param", id, message: "stackRules.perStack \u5FC5\u987B\u4E3A\u6B63\u6570" });
          if (sr2.maxStacks !== void 0) {
            const ms = num(sr2.maxStacks);
            if (ms === null || !Number.isInteger(ms) || ms < 1) errors.push({ table: "battle_unit_stat_param", id, message: "stackRules.maxStacks\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
          }
          if (sr2.breakOn !== void 0 && sr2.breakOn !== "attack_gap" && sr2.breakOn !== "target_switch") errors.push({ table: "battle_unit_stat_param", id, message: "stackRules.breakOn\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A attack_gap | target_switch" });
          if (sr2.breakOn === "attack_gap") {
            const gap = num(sr2.breakGapSec);
            if (gap === null || !(gap > 0)) errors.push({ table: "battle_unit_stat_param", id, message: "stackRules breakOn=attack_gap \u5FC5\u987B\u7ED9\u6B63\u6570 breakGapSec" });
          }
          if (sr2.breakAction !== void 0 && sr2.breakAction !== "clear" && sr2.breakAction !== "decay_1") errors.push({ table: "battle_unit_stat_param", id, message: "stackRules.breakAction\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A clear | decay_1" });
        }
      }
    }
  }
  for (const row2 of effectRows) {
    const id = String(row2.rowId);
    if (typeof row2.effectKind !== "string" || !S7_BATTLE_EFFECT_KINDS.includes(row2.effectKind)) errors.push({ table: "battle_effect_param", id, message: "effectKind \u975E\u6CD5" });
    if (typeof row2.effectType !== "string" || !S7_BATTLE_EFFECT_TYPES.includes(row2.effectType)) errors.push({ table: "battle_effect_param", id, message: "effectType \u975E\u6CD5" });
    const power = num(row2.effectPower);
    if (power === null || power < 0) errors.push({ table: "battle_effect_param", id, message: "effectPower \u5FC5\u987B >= 0" });
    const mt = num(row2.maxTargets);
    if (mt === null || !Number.isInteger(mt) || mt < 1) errors.push({ table: "battle_effect_param", id, message: "maxTargets \u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
    const dur = num(row2.durationSec);
    if (dur === null || dur < 0) errors.push({ table: "battle_effect_param", id, message: "durationSec \u5FC5\u987B >= 0" });
    if (typeof row2.targetingTag !== "string" || !ID_PATTERN.test(row2.targetingTag)) errors.push({ table: "battle_effect_param", id, message: "targetingTag \u4E0D\u5408\u6CD5" });
    const stTag = row2.stateTag;
    if (typeof stTag !== "string" || !S7_BATTLE_STATE_TAGS.includes(stTag)) errors.push({ table: "battle_effect_param", id, message: "stateTag \u975E\u6CD5" });
    else if (stTag !== "none" && (dur === null || dur <= 0)) errors.push({ table: "battle_effect_param", id, message: "\u72B6\u6001\u6548\u679C durationSec \u5FC5\u987B\u4E3A\u6B63\u6570" });
    const summon = row2.summonUnitRef;
    if (summon !== "none") {
      if (typeof summon !== "string" || !unitIds.has(summon)) errors.push({ table: "battle_effect_param", id, message: `summonUnitRef "${String(summon)}" \u5FC5\u987B\u4E3A none \u6216\u6709\u6548 battle_unit_stat_param.rowId` });
      if (dur === null || dur <= 0) errors.push({ table: "battle_effect_param", id, message: "\u53EC\u5524\u6548\u679C durationSec \u5FC5\u987B\u4E3A\u6B63\u6570" });
    }
    if (row2.stateChance !== void 0) {
      const scv = num(row2.stateChance);
      if (scv === null || scv <= 0 || scv > 1) errors.push({ table: "battle_effect_param", id, message: "stateChance\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 (0,1]" });
      else if (stTag === "none") errors.push({ table: "battle_effect_param", id, message: "stateChance\uFF08\u53EF\u9009\uFF09\u8981\u6C42 stateTag \u2260 none" });
    }
    if (row2.summonExpireSec !== void 0) {
      const ses = num(row2.summonExpireSec);
      if (ses === null || ses <= 0) errors.push({ table: "battle_effect_param", id, message: "summonExpireSec\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u6B63\u6570" });
      else if (summon === "none") errors.push({ table: "battle_effect_param", id, message: "summonExpireSec\uFF08\u53EF\u9009\uFF09\u8981\u6C42 summonUnitRef \u2260 none" });
    }
    if (row2.despawnWithSource !== void 0) {
      if (typeof row2.despawnWithSource !== "boolean") errors.push({ table: "battle_effect_param", id, message: "despawnWithSource\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u5E03\u5C14" });
      else if (summon === "none") errors.push({ table: "battle_effect_param", id, message: "despawnWithSource\uFF08\u53EF\u9009\uFF09\u8981\u6C42 summonUnitRef \u2260 none" });
    }
    if (row2.summonSourceCap !== void 0) {
      const ssc = num(row2.summonSourceCap);
      if (ssc === null || !Number.isInteger(ssc) || ssc < 1) errors.push({ table: "battle_effect_param", id, message: "summonSourceCap\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
      else if (summon === "none") errors.push({ table: "battle_effect_param", id, message: "summonSourceCap\uFF08\u53EF\u9009\uFF09\u8981\u6C42 summonUnitRef \u2260 none" });
    }
    const isModTag = typeof stTag === "string" && S7_MOD_STATE_TAGS.includes(stTag);
    const isPeriodicTag = typeof stTag === "string" && S7_PERIODIC_STATE_TAGS.includes(stTag);
    const isFrameworkTag = isModTag || isPeriodicTag;
    if (row2.effectType === "apply_state" && stTag === "none") {
      errors.push({ table: "battle_effect_param", id, message: "apply_state \u6548\u679C\u8981\u6C42 stateTag \u2260 none" });
    }
    if (isModTag) {
      const amt = num(row2.stateAmount);
      if (amt === null || !(amt > 0) || !Number.isFinite(amt)) errors.push({ table: "battle_effect_param", id, message: `\u4FEE\u6B63\u72B6\u6001 ${String(stTag)} \u8981\u6C42 stateAmount \u4E3A\u6B63\u6570\uFF08\u65B9\u5411\u5728 tag \u540D\u91CC\uFF09` });
    } else if (row2.stateAmount !== void 0) {
      errors.push({ table: "battle_effect_param", id, message: "stateAmount\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 M1 \u4FEE\u6B63\u72B6\u6001 tag" });
    }
    const tickChannels = ["stateTickAtkPct", "stateTickMaxHpPct", "stateTickFlat"];
    if (isPeriodicTag) {
      let anyPositive = false;
      for (const f of tickChannels) {
        if (row2[f] === void 0) continue;
        const v = num(row2[f]);
        if (v === null || v < 0 || !Number.isFinite(v)) errors.push({ table: "battle_effect_param", id, message: `${f}\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 0 \u7684\u6709\u9650\u6570` });
        else if (v > 0) anyPositive = true;
      }
      if (!anyPositive) errors.push({ table: "battle_effect_param", id, message: `\u5468\u671F\u72B6\u6001 ${String(stTag)} \u8981\u6C42 stateTickAtkPct/stateTickMaxHpPct/stateTickFlat \u81F3\u5C11\u4E00\u9879 > 0` });
      if (row2.stateTickIntervalSec !== void 0) {
        const iv = num(row2.stateTickIntervalSec);
        if (iv === null || !(iv > 0)) errors.push({ table: "battle_effect_param", id, message: "stateTickIntervalSec\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u6B63\u6570" });
      }
    } else {
      for (const f of [...tickChannels, "stateTickIntervalSec"]) {
        if (row2[f] !== void 0) errors.push({ table: "battle_effect_param", id, message: `${f}\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9\u5468\u671F\u72B6\u6001 tag\uFF08burn/regen\uFF09` });
      }
    }
    if (row2.stateMaxStacks !== void 0) {
      const sms = num(row2.stateMaxStacks);
      if (sms === null || !Number.isInteger(sms) || sms < 1) errors.push({ table: "battle_effect_param", id, message: "stateMaxStacks\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
      else if (!isFrameworkTag) errors.push({ table: "battle_effect_param", id, message: "stateMaxStacks\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9\u6846\u67B6\u72B6\u6001 tag" });
    }
    if (row2.stateExpireAction !== void 0) {
      if (row2.stateExpireAction !== "clear" && row2.stateExpireAction !== "decay_1") errors.push({ table: "battle_effect_param", id, message: "stateExpireAction\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A clear | decay_1" });
      else if (!isFrameworkTag) errors.push({ table: "battle_effect_param", id, message: "stateExpireAction\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9\u6846\u67B6\u72B6\u6001 tag" });
    }
    if (row2.alsoApplyStateRefs !== void 0) {
      const refs = row2.alsoApplyStateRefs;
      if (!Array.isArray(refs) || refs.length === 0 || refs.some((r) => typeof r !== "string")) {
        errors.push({ table: "battle_effect_param", id, message: "alsoApplyStateRefs\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\u6570\u7EC4" });
      } else {
        if (typeof row2.effectType !== "string" || !S7_ALSO_APPLY_HOST_TYPES.includes(row2.effectType)) {
          errors.push({ table: "battle_effect_param", id, message: "alsoApplyStateRefs\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u5728\u4F24\u5BB3/\u62A4\u76FE/\u6CBB\u7597/\u72B6\u6001\u7C7B\u6548\u679C\u884C\u4E0A" });
        }
        for (const ref of refs) {
          const sub = effectById.get(ref);
          if (!sub) {
            errors.push({ table: "battle_effect_param", id, message: `alsoApplyStateRefs \u5F15\u7528\u7684 "${ref}" \u4E0D\u5B58\u5728\u4E8E battle_effect_param` });
            continue;
          }
          if (ref === id) errors.push({ table: "battle_effect_param", id, message: "alsoApplyStateRefs \u4E0D\u5141\u8BB8\u5F15\u7528\u81EA\u8EAB" });
          if (sub.stateTag === "none") errors.push({ table: "battle_effect_param", id, message: `alsoApplyStateRefs \u5F15\u7528\u7684 "${ref}" \u5FC5\u987B stateTag \u2260 none` });
          if (sub.alsoApplyStateRefs !== void 0) errors.push({ table: "battle_effect_param", id, message: `alsoApplyStateRefs \u5F15\u7528\u7684 "${ref}" \u81EA\u8EAB\u4E0D\u5F97\u518D\u5E26 alsoApplyStateRefs\uFF08\u7981\u94FE\u5F0F\uFF09` });
        }
      }
    }
    let dispelN = null;
    if (row2.dispelCount !== void 0) {
      dispelN = num(row2.dispelCount);
      if (dispelN === null || !Number.isInteger(dispelN) || dispelN < 1) {
        errors.push({ table: "battle_effect_param", id, message: "dispelCount\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
      } else if (typeof row2.effectType !== "string" || !S7_DISPEL_HOST_TYPES.includes(row2.effectType)) {
        errors.push({ table: "battle_effect_param", id, message: "dispelCount\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u5728\u62A4\u76FE/\u6CBB\u7597\u884C\u6216 purify \u6548\u679C\u4E0A" });
      }
    }
    if (row2.effectType === "purify" && (dispelN === null || dispelN < 1)) {
      errors.push({ table: "battle_effect_param", id, message: "purify \u6548\u679C\u8981\u6C42 dispelCount >= 1" });
    }
    if (row2.dispelHardControl !== void 0) {
      if (typeof row2.dispelHardControl !== "boolean") errors.push({ table: "battle_effect_param", id, message: "dispelHardControl\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u5E03\u5C14" });
      else if (row2.dispelCount === void 0) errors.push({ table: "battle_effect_param", id, message: "dispelHardControl\uFF08\u53EF\u9009\uFF09\u8981\u6C42\u540C\u65F6\u914D dispelCount" });
    }
    if (row2.applyUndispellable !== void 0) {
      if (typeof row2.applyUndispellable !== "boolean") errors.push({ table: "battle_effect_param", id, message: "applyUndispellable\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A\u5E03\u5C14" });
      else if (stTag === "none") errors.push({ table: "battle_effect_param", id, message: "applyUndispellable\uFF08\u53EF\u9009\uFF09\u8981\u6C42 stateTag \u2260 none\uFF08\u6807\u8BB0\u88AB\u65BD\u52A0\u7684\u72B6\u6001\uFF09" });
    }
    const reflectFields = ["reflectPct", "reflectAtkPct", "reflectArmorPct", "blockPct"];
    if (reflectFields.some((f) => row2[f] !== void 0) && stTag !== "reflect") {
      errors.push({ table: "battle_effect_param", id, message: "reflect/block \u5B57\u6BB5\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=reflect" });
    }
    for (const f of reflectFields) {
      if (row2[f] === void 0) continue;
      const v = num(row2[f]);
      if (v === null || v < 0 || !Number.isFinite(v)) errors.push({ table: "battle_effect_param", id, message: `${f}\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 0 \u7684\u6709\u9650\u6570` });
      else if (f === "blockPct" && v > 1) errors.push({ table: "battle_effect_param", id, message: "blockPct\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 [0,1]" });
    }
    if (row2.guardProtect !== void 0) {
      if (row2.guardProtect !== "backline" && row2.guardProtect !== "all") errors.push({ table: "battle_effect_param", id, message: "guardProtect\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A backline | all" });
      else if (stTag !== "guard") errors.push({ table: "battle_effect_param", id, message: "guardProtect\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=guard" });
    }
    if (row2.guardCooldownSec !== void 0) {
      const gc = num(row2.guardCooldownSec);
      if (gc === null || gc < 0 || !Number.isFinite(gc)) errors.push({ table: "battle_effect_param", id, message: "guardCooldownSec\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 0 \u7684\u6709\u9650\u6570" });
      else if (stTag !== "guard") errors.push({ table: "battle_effect_param", id, message: "guardCooldownSec\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=guard" });
    }
    if ((row2.sharePct !== void 0 || row2.shareMode !== void 0) && stTag !== "share") {
      errors.push({ table: "battle_effect_param", id, message: "sharePct/shareMode\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=share" });
    }
    if (row2.shareMode !== void 0 && row2.shareMode !== "adjacent" && row2.shareMode !== "to_caster") {
      errors.push({ table: "battle_effect_param", id, message: "shareMode\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A adjacent | to_caster" });
    }
    if (row2.sharePct !== void 0) {
      const sp = num(row2.sharePct);
      if (sp === null || sp < 0 || sp > 1) errors.push({ table: "battle_effect_param", id, message: "sharePct\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 [0,1]" });
      else if (row2.shareMode !== "adjacent" && row2.shareMode !== "to_caster") errors.push({ table: "battle_effect_param", id, message: "sharePct\uFF08\u53EF\u9009\uFF09\u8981\u6C42\u914D shareMode\uFF08adjacent|to_caster\uFF09" });
    }
    const auraFields = ["auraStat", "auraAmount", "auraScope", "auraCondition", "auraScale"];
    if (auraFields.some((f) => row2[f] !== void 0) && stTag !== "aura") {
      errors.push({ table: "battle_effect_param", id, message: "aura* \u5B57\u6BB5\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=aura" });
    }
    if (stTag === "aura") {
      if (!["dmgTakenDownPct", "atkSpeedPct", "skillHastePct"].includes(String(row2.auraStat))) errors.push({ table: "battle_effect_param", id, message: "aura \u6548\u679C\u8981\u6C42 auraStat \u2208 dmgTakenDownPct|atkSpeedPct|skillHastePct" });
      const av = num(row2.auraAmount);
      if (av === null || !Number.isFinite(av)) errors.push({ table: "battle_effect_param", id, message: "aura \u6548\u679C\u8981\u6C42 auraAmount \u4E3A\u6709\u9650\u6570" });
      if (!["self", "team", "cross", "block"].includes(String(row2.auraScope))) errors.push({ table: "battle_effect_param", id, message: "aura \u6548\u679C\u8981\u6C42 auraScope \u2208 self|team|cross|block" });
      if (row2.auraCondition !== void 0 && !["always", "has_summon", "no_enemy_summon"].includes(String(row2.auraCondition))) errors.push({ table: "battle_effect_param", id, message: "auraCondition\uFF08\u53EF\u9009\uFF09\u975E\u6CD5" });
      if (row2.auraScale !== void 0 && row2.auraScale !== "per_lowhp_ally") errors.push({ table: "battle_effect_param", id, message: "auraScale\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A per_lowhp_ally" });
    }
    if (row2.repeatCount !== void 0) {
      const rc = num(row2.repeatCount);
      if (rc === null || !Number.isInteger(rc) || rc < 1) errors.push({ table: "battle_effect_param", id, message: "repeatCount\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
    }
    if (row2.repeatChance !== void 0) {
      const rch = num(row2.repeatChance);
      if (rch === null || rch <= 0 || rch > 1) errors.push({ table: "battle_effect_param", id, message: "repeatChance\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 (0,1]" });
      else if (row2.effectKind !== "normal_attack") errors.push({ table: "battle_effect_param", id, message: "repeatChance\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9\u666E\u653B\u884C\uFF08effectKind=normal_attack\uFF09" });
    }
    if (row2.splashPct !== void 0) {
      const sp = num(row2.splashPct);
      if (sp === null || sp < 0 || sp >= 1) errors.push({ table: "battle_effect_param", id, message: "splashPct\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 [0,1)" });
      else if (!["basic_damage", "clear_barrage", "line_pierce", "backline_strike", "burst_nuke"].includes(String(row2.effectType))) errors.push({ table: "battle_effect_param", id, message: "splashPct\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9\u4F24\u5BB3\u884C" });
    }
    if (row2.blindChance !== void 0) {
      const bc = num(row2.blindChance);
      if (bc === null || bc <= 0 || bc > 1) errors.push({ table: "battle_effect_param", id, message: "blindChance\uFF08\u53EF\u9009\uFF09\u5FC5\u987B\u5728 (0,1]" });
      else if (stTag !== "blind") errors.push({ table: "battle_effect_param", id, message: "blindChance\uFF08\u53EF\u9009\uFF09\u4EC5\u5141\u8BB8\u914D\u7ED9 stateTag=blind" });
    }
    if (stTag === "blind" && (num(row2.blindChance) === null || num(row2.blindChance) <= 0)) {
      errors.push({ table: "battle_effect_param", id, message: "blind \u72B6\u6001\u8981\u6C42 blindChance \u2208 (0,1]" });
    }
  }
  for (const row2 of encounterRows) {
    const id = String(row2.rowId);
    if (typeof row2.nodeRef !== "string" || !mainlineById.has(row2.nodeRef)) errors.push({ table: "battle_encounter_param", id, message: `nodeRef "${String(row2.nodeRef)}" \u4E0D\u662F\u6709\u6548\u4E3B\u7EBF\u8282\u70B9` });
    const stage = row2.stageType;
    if (typeof stage !== "string" || !S7_STAGE_TYPES.includes(stage)) errors.push({ table: "battle_encounter_param", id, message: "stageType \u975E\u6CD5" });
    if (typeof row2.templateRef !== "string" || !templateIds.has(row2.templateRef)) errors.push({ table: "battle_encounter_param", id, message: `templateRef "${String(row2.templateRef)}" \u975E\u6CD5\uFF08\u4EC5 t01-t10\uFF09` });
    if (typeof row2.problemTagRef !== "string" || !S7_PROBLEM_TAGS.includes(row2.problemTagRef)) errors.push({ table: "battle_encounter_param", id, message: "problemTagRef \u975E\u6CD5" });
    if (typeof row2.secondaryPressureTag !== "string" || !S7_SECONDARY_PRESSURE_TAGS.includes(row2.secondaryPressureTag)) errors.push({ table: "battle_encounter_param", id, message: "secondaryPressureTag \u975E\u6CD5" });
    if (typeof row2.pressureRef !== "string" || !pressureIds.has(row2.pressureRef)) errors.push({ table: "battle_encounter_param", id, message: `pressureRef "${String(row2.pressureRef)}" \u4E0D\u5B58\u5728\u4E8E pressure_param` });
    battleArrayRefs(errors, "battle_encounter_param", id, "enemyUnitStatRefs", row2.enemyUnitStatRefs, unitIds, true);
    battleArrayRefs(errors, "battle_encounter_param", id, "spawnPlanRefs", row2.spawnPlanRefs, spawnIds, true);
    battleArrayRefs(errors, "battle_encounter_param", id, "bossPhaseRefs", row2.bossPhaseRefs, phaseIds, false);
    if (row2.playerSlotPolicy !== "five_ship_3x3_default") errors.push({ table: "battle_encounter_param", id, message: "playerSlotPolicy \u9996\u7248\u5FC5\u987B\u4E3A five_ship_3x3_default" });
    const tl = num(row2.timeLimitSec);
    if (tl === null || tl <= 0) errors.push({ table: "battle_encounter_param", id, message: "timeLimitSec \u5FC5\u987B\u4E3A\u6B63\u6570" });
    if (row2.battleSeedPolicy !== "node_id_plus_run_seed") errors.push({ table: "battle_encounter_param", id, message: "battleSeedPolicy \u9996\u7248\u5FC5\u987B\u4E3A node_id_plus_run_seed" });
    if (stage !== "boss" && Array.isArray(row2.bossPhaseRefs) && row2.bossPhaseRefs.length > 0) {
      errors.push({ table: "battle_encounter_param", id, message: "\u975E boss \u6218\u6597\u7684 bossPhaseRefs \u5FC5\u987B\u4E3A\u7A7A\u6570\u7EC4" });
    }
    const mline = typeof row2.nodeRef === "string" ? mainlineById.get(row2.nodeRef) : void 0;
    if (mline && typeof stage === "string") {
      const derived = deriveBattleStage(String(mline.nodeTypeTag));
      if (derived !== stage) errors.push({ table: "battle_encounter_param", id, message: `stageType "${stage}" \u4E0E\u4E3B\u7EBF\u8282\u70B9 nodeTypeTag \u63A8\u5BFC\uFF08${derived}\uFF09\u4E0D\u4E00\u81F4` });
    }
    if (Array.isArray(row2.spawnPlanRefs)) {
      for (const sref of row2.spawnPlanRefs) {
        const s = typeof sref === "string" ? spawnById.get(sref) : void 0;
        if (s && String(s.encounterRef) !== id) errors.push({ table: "battle_encounter_param", id, message: `spawnPlanRefs \u5F15\u7528\u7684 "${String(sref)}" \u7684 encounterRef \u4E0D\u6307\u5411\u672C encounter\uFF08\u53CC\u5411\u95ED\u5408\u5931\u8D25\uFF09` });
      }
    }
    if (Array.isArray(row2.bossPhaseRefs)) {
      for (const pref of row2.bossPhaseRefs) {
        const ph = typeof pref === "string" ? phaseById.get(pref) : void 0;
        if (ph && String(ph.bossNodeId) !== String(row2.nodeRef)) errors.push({ table: "battle_encounter_param", id, message: `bossPhaseRefs \u5F15\u7528\u7684 "${String(pref)}" \u4E0D\u5C5E\u4E8E boss \u8282\u70B9 ${String(row2.nodeRef)}\uFF08\u53CC\u5411\u95ED\u5408\u5931\u8D25\uFF09` });
      }
    }
  }
  const coveredNodes = new Set(encounterRows.map((r) => String(r.nodeRef)));
  for (const need of ["n001", "n084", "n150"]) {
    if (!coveredNodes.has(need)) errors.push({ table: "battle_encounter_param", id: need, message: `\u5FC5\u987B\u8986\u76D6\u8282\u70B9 ${need} \u7684 encounter` });
  }
  const finalEnc = encounterRows.find((r) => String(r.nodeRef) === "n150");
  if (finalEnc && finalEnc.pressureRef !== "bp_n150") errors.push({ table: "battle_encounter_param", id: String(finalEnc.rowId), message: "n150\uFF08\u7EC8Boss\uFF09encounter \u7684 pressureRef \u5FC5\u987B\u4E3A bp_n150" });
  for (const row2 of spawnRows) {
    const id = String(row2.rowId);
    const encRef = row2.encounterRef;
    const enc = typeof encRef === "string" ? encounterById.get(encRef) : void 0;
    if (!enc) errors.push({ table: "battle_spawn_param", id, message: `encounterRef "${String(encRef)}" \u4E0D\u5B58\u5728` });
    const wave = num(row2.waveIndex);
    if (wave === null || !Number.isInteger(wave) || wave < 1) errors.push({ table: "battle_spawn_param", id, message: "waveIndex \u5FC5\u987B\u4E3A >= 1 \u7684\u6574\u6570" });
    const unitRef = row2.unitStatRef;
    const unit = typeof unitRef === "string" ? unitById.get(unitRef) : void 0;
    if (!unit) errors.push({ table: "battle_spawn_param", id, message: `unitStatRef "${String(unitRef)}" \u4E0D\u5B58\u5728` });
    else if (enc && Array.isArray(enc.enemyUnitStatRefs) && !enc.enemyUnitStatRefs.includes(unitRef)) {
      errors.push({ table: "battle_spawn_param", id, message: `unitStatRef "${String(unitRef)}" \u4E0D\u5728 encounter ${String(encRef)} \u7684 enemyUnitStatRefs \u5185` });
    }
    const sd = num(row2.spawnDelaySec);
    if (sd === null || sd < 0) errors.push({ table: "battle_spawn_param", id, message: "spawnDelaySec \u5FC5\u987B >= 0" });
    const mc = num(row2.maxConcurrentOnField);
    const gridCells = S7_ENEMY_ROWS * S7_ENEMY_COLS;
    if (mc === null || !Number.isInteger(mc) || mc < 1 || mc > gridCells) errors.push({ table: "battle_spawn_param", id, message: `maxConcurrentOnField \u5FC5\u987B\u4E3A 1-${gridCells} \u7684\u6574\u6570` });
    const slots = row2.slotRefs;
    if (!Array.isArray(slots)) {
      errors.push({ table: "battle_spawn_param", id, message: "slotRefs \u5FC5\u987B\u662F\u6570\u7EC4" });
    } else {
      const cnt = num(row2.count);
      if (cnt === null || cnt !== slots.length) errors.push({ table: "battle_spawn_param", id, message: `count (${String(row2.count)}) \u5FC5\u987B\u7B49\u4E8E slotRefs.length (${slots.length})` });
      const anchorsSeen = /* @__PURE__ */ new Set();
      const footprint = /* @__PURE__ */ new Set();
      const sr = unit ? num(unit.sizeRows) : null;
      const sc = unit ? num(unit.sizeCols) : null;
      for (const slot of slots) {
        if (typeof slot !== "string" || !BATTLE_GRID_SLOT_PATTERN.test(slot)) {
          errors.push({ table: "battle_spawn_param", id, message: `slotRefs \u542B\u975E\u6CD5\u683C\u5B50 "${String(slot)}"\uFF08\u4EC5 r0c0..r${S7_ENEMY_ROWS - 1}c${S7_ENEMY_COLS - 1}\uFF09` });
          continue;
        }
        if (anchorsSeen.has(slot)) errors.push({ table: "battle_spawn_param", id, message: `slotRefs \u542B\u91CD\u590D\u683C\u5B50 "${slot}"` });
        anchorsSeen.add(slot);
        if (sr !== null && sc !== null) {
          const baseR = Number(slot[1]);
          const baseC = Number(slot[3]);
          for (let dr = 0; dr < sr; dr += 1) {
            for (let dc = 0; dc < sc; dc += 1) {
              const rr = baseR + dr;
              const cc = baseC + dc;
              if (rr > S7_ENEMY_ROWS - 1 || cc > S7_ENEMY_COLS - 1) {
                errors.push({ table: "battle_spawn_param", id, message: `\u5355\u4F4D ${String(unitRef)} \u4EE5 ${slot} \u4E3A\u951A\u70B9\u7684 ${sr}x${sc} \u5360\u683C\u8D8A\u754C\uFF08r${rr}c${cc}\uFF09` });
                continue;
              }
              const key = `r${rr}c${cc}`;
              if (footprint.has(key)) errors.push({ table: "battle_spawn_param", id, message: `\u5360\u683C\u91CD\u53E0\u4E8E ${key}` });
              footprint.add(key);
            }
          }
        }
      }
    }
  }
  const phaseTagsByBoss = /* @__PURE__ */ new Map();
  for (const row2 of phaseRows) {
    const id = String(row2.rowId);
    const bnid = row2.bossNodeId;
    if (typeof bnid !== "string" || !bossNodeIds.has(bnid)) errors.push({ table: "battle_boss_phase_param", id, message: `bossNodeId "${String(bnid)}" \u4E0D\u5B58\u5728` });
    const ptag = row2.phaseTag;
    if (typeof ptag !== "string" || !S7_BOSS_PHASE_TAGS.includes(ptag)) errors.push({ table: "battle_boss_phase_param", id, message: "phaseTag \u975E\u6CD5" });
    const trig = row2.triggerType;
    if (typeof trig !== "string" || !S7_BOSS_PHASE_TRIGGER_TYPES.includes(trig)) errors.push({ table: "battle_boss_phase_param", id, message: "triggerType \u975E\u6CD5" });
    const tv = num(row2.triggerValue);
    if (tv === null) errors.push({ table: "battle_boss_phase_param", id, message: "triggerValue \u5FC5\u987B\u662F\u6570\u503C" });
    else if (trig === "battle_start" && tv !== 0) errors.push({ table: "battle_boss_phase_param", id, message: "battle_start \u7684 triggerValue \u5FC5\u987B\u4E3A 0" });
    battleArrayRefs(errors, "battle_boss_phase_param", id, "effectRefs", row2.effectRefs, effectIds, true);
    battleArrayRefs(errors, "battle_boss_phase_param", id, "summonUnitRefs", row2.summonUnitRefs, unitIds, false);
    const cap = num(row2.summonCountCap);
    if (cap === null || !Number.isInteger(cap) || cap < 0 || cap > 10) errors.push({ table: "battle_boss_phase_param", id, message: "summonCountCap \u5FC5\u987B\u4E3A 0-10 \u7684\u6574\u6570" });
    if (typeof bnid === "string" && typeof ptag === "string") {
      const arr = phaseTagsByBoss.get(bnid) ?? [];
      arr.push(ptag);
      phaseTagsByBoss.set(bnid, arr);
    }
  }
  for (const [boss, tags] of phaseTagsByBoss) {
    if (tags.length > 3) errors.push({ table: "battle_boss_phase_param", id: boss, message: `Boss ${boss} \u6700\u591A 3 \u4E2A\u9636\u6BB5\uFF0C\u5B9E\u9645 ${tags.length}` });
    if (new Set(tags).size !== tags.length) errors.push({ table: "battle_boss_phase_param", id: boss, message: `Boss ${boss} phaseTag \u91CD\u590D\uFF08start/mid/final \u4E0D\u53EF\u91CD\u590D\uFF09` });
  }
}
function validateCommissionAffix(errors, rowsByTable) {
  for (const row2 of rowsByTable.commission_affix_param ?? []) {
    const id = String(row2.rowId);
    if (typeof row2.affixName !== "string" || row2.affixName.length === 0) errors.push({ table: "commission_affix_param", id, message: "affixName \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.effectText !== "string" || row2.effectText.length === 0) errors.push({ table: "commission_affix_param", id, message: "effectText \u4E0D\u80FD\u4E3A\u7A7A" });
    if (typeof row2.positionType !== "string" || !S7_AFFIX_TARGET_TYPES.includes(row2.positionType)) {
      errors.push({ table: "commission_affix_param", id, message: `positionType "${String(row2.positionType)}" \u975E\u6CD5\uFF08\u5141\u8BB8\uFF1A${S7_AFFIX_TARGET_TYPES.join("/")}\uFF09` });
    }
    const cond = num(row2.condLineupMax);
    if (cond === null || !Number.isInteger(cond) || cond < 0) errors.push({ table: "commission_affix_param", id, message: "condLineupMax \u5FC5\u987B\u4E3A >=0 \u7684\u6574\u6570\uFF080=\u65E0\u6761\u4EF6\uFF09" });
    if (!Array.isArray(row2.mods) || row2.mods.length === 0) {
      errors.push({ table: "commission_affix_param", id, message: "mods \u5FC5\u987B\u4E3A\u975E\u7A7A\u6570\u7EC4" });
      continue;
    }
    for (const raw of row2.mods) {
      const mod = asRow(raw);
      if (!mod) {
        errors.push({ table: "commission_affix_param", id, message: "mods \u542B\u975E\u5BF9\u8C61\u9879" });
        continue;
      }
      const ch = mod.channel;
      if (num(mod.value) === null) errors.push({ table: "commission_affix_param", id, message: "mod.value \u5FC5\u987B\u4E3A\u6570\u503C" });
      if (ch === "stat") {
        if (typeof mod.key !== "string" || !S7_STAT_KEYS.includes(mod.key)) errors.push({ table: "commission_affix_param", id, message: `stat mod.key "${String(mod.key)}" \u975E\u6CD5\uFF08\u5141\u8BB8\uFF1A${S7_STAT_KEYS.join("/")}\uFF09` });
        if (mod.op !== void 0 && mod.op !== "flat" && mod.op !== "pct") errors.push({ table: "commission_affix_param", id, message: "stat mod.op \u4EC5\u5141\u8BB8 flat/pct\uFF08\u7F3A\u7701 pct\uFF1B\u8BCD\u7F00\u4E0D\u7528 set\uFF09" });
      } else if (ch === "affix") {
        if (typeof mod.key !== "string" || !S7_AFFIX_KEYS.includes(mod.key)) errors.push({ table: "commission_affix_param", id, message: `affix mod.key "${String(mod.key)}" \u975E\u6CD5\uFF08\u5141\u8BB8\uFF1A${S7_AFFIX_KEYS.join("/")}\uFF09` });
      } else {
        errors.push({ table: "commission_affix_param", id, message: `mod.channel "${String(ch)}" \u975E\u6CD5\uFF08\u5141\u8BB8 stat/affix\uFF09` });
      }
    }
  }
}
var S7_PUZZLE_THREAT_TYPES = ["backline", "shield", "summon", "heal", "burst", "swarm", "berserk", "mixed"];
var S7_PUZZLE_QUALITIES = ["fine", "superior", "legendary"];
var S7_PUZZLE_PLAYER_SLOT = /^p[0-2]c[0-2]$/;
var S7_PUZZLE_ENEMY_SLOT = /^r[0-4]c[0-6]$/;
var S7_PUZZLE_MIN_CAND = 6;
var S7_PUZZLE_MAX_CAND = 8;
var S7_PUZZLE_LINEUP = 5;
function validateDailyPuzzle(errors, rowsByTable, refs) {
  const enemyUnitIds = /* @__PURE__ */ new Set();
  for (const r of rowsByTable.battle_unit_stat_param ?? []) if (r.targetType === "enemy") enemyUnitIds.add(String(r.rowId));
  const push = (id, message) => {
    errors.push({ table: "daily_puzzle_param", id, message });
  };
  for (const row2 of rowsByTable.daily_puzzle_param ?? []) {
    const id = String(row2.rowId);
    if (typeof row2.threatType !== "string" || !S7_PUZZLE_THREAT_TYPES.includes(row2.threatType)) push(id, `threatType "${String(row2.threatType)}" \u975E\u6CD5`);
    if (typeof row2.threatHint !== "string" || row2.threatHint.length === 0) push(id, "threatHint \u4E0D\u80FD\u4E3A\u7A7A");
    const ef = row2.enemyFormation;
    if (!Array.isArray(ef) || ef.length === 0) push(id, "enemyFormation \u5FC5\u987B\u4E3A\u975E\u7A7A\u6570\u7EC4");
    else {
      const eslots = /* @__PURE__ */ new Set();
      for (const raw of ef) {
        const e = asRow(raw);
        if (!e) {
          push(id, "enemyFormation \u542B\u975E\u5BF9\u8C61\u9879");
          continue;
        }
        if (typeof e.unitStatRef !== "string" || !enemyUnitIds.has(e.unitStatRef)) push(id, `enemyFormation.unitStatRef "${String(e.unitStatRef)}" \u4E0D\u662F enemy \u6218\u6597\u5355\u4F4D`);
        if (typeof e.slotRef !== "string" || !S7_PUZZLE_ENEMY_SLOT.test(e.slotRef)) push(id, `enemyFormation.slotRef "${String(e.slotRef)}" \u975E\u6CD5\uFF08r0c0..r4c6\uFF09`);
        else if (eslots.has(e.slotRef)) push(id, `enemyFormation.slotRef "${e.slotRef}" \u91CD\u590D`);
        else eslots.add(e.slotRef);
      }
    }
    for (const f of ["enemyHpPct", "enemyAtkPct"]) if (row2[f] !== void 0 && num(row2[f]) === null) push(id, `${f} \u5FC5\u987B\u4E3A\u6570\u503C`);
    const packs = row2.candidatePacks;
    const packIds = /* @__PURE__ */ new Set();
    if (!Array.isArray(packs)) push(id, "candidatePacks \u5FC5\u987B\u4E3A\u6570\u7EC4");
    else {
      if (packs.length < S7_PUZZLE_MIN_CAND || packs.length > S7_PUZZLE_MAX_CAND) push(id, `\u5019\u9009\u6218\u961F\u5305\u6570\u91CF\u5FC5\u987B\u2208[${S7_PUZZLE_MIN_CAND},${S7_PUZZLE_MAX_CAND}]\uFF08\u95F8 c\uFF09\uFF0C\u5B9E\u9645 ${packs.length}`);
      for (const raw of packs) {
        const pk = asRow(raw);
        if (!pk) {
          push(id, "candidatePacks \u542B\u975E\u5BF9\u8C61\u9879");
          continue;
        }
        if (typeof pk.packId !== "string" || pk.packId.length === 0) push(id, "pack.packId \u4E0D\u80FD\u4E3A\u7A7A");
        else if (packIds.has(pk.packId)) push(id, `pack.packId "${pk.packId}" \u91CD\u590D`);
        else packIds.add(pk.packId);
        if (typeof pk.shipId !== "string" || !refs.ships.has(pk.shipId)) push(id, `pack.shipId "${String(pk.shipId)}" \u4E0D\u5B58\u5728`);
        if (typeof pk.pilotId !== "string" || !refs.pilots.has(pk.pilotId)) push(id, `pack.pilotId "${String(pk.pilotId)}" \u4E0D\u5B58\u5728`);
        if (pk.coreId !== void 0 && (typeof pk.coreId !== "string" || !refs.cores.has(pk.coreId))) push(id, `pack.coreId "${String(pk.coreId)}" \u4E0D\u5B58\u5728`);
        if (pk.plugins !== void 0) {
          if (!Array.isArray(pk.plugins) || pk.plugins.length > 3) push(id, "pack.plugins \u5FC5\u987B\u4E3A\u6570\u7EC4\u4E14\u22643");
          else for (const rawPl of pk.plugins) {
            const pl = asRow(rawPl);
            if (!pl || typeof pl.pluginId !== "string" || !refs.plugins.has(pl.pluginId)) push(id, `pack.plugin "${String(pl?.pluginId)}" \u4E0D\u5B58\u5728`);
            if (!pl || typeof pl.quality !== "string" || !S7_PUZZLE_QUALITIES.includes(pl.quality)) push(id, `pack.plugin.quality "${String(pl?.quality)}" \u975E\u6CD5\uFF08fine/superior/legendary\uFF09`);
          }
        }
      }
    }
    const sol = row2.authorSolution;
    if (!Array.isArray(sol) || sol.length !== S7_PUZZLE_LINEUP) push(id, `authorSolution \u5FC5\u987B\u6B63\u597D ${S7_PUZZLE_LINEUP} \u9879\uFF0C\u5B9E\u9645 ${Array.isArray(sol) ? sol.length : "\u975E\u6570\u7EC4"}`);
    else {
      const pslots = /* @__PURE__ */ new Set();
      for (const raw of sol) {
        const s = asRow(raw);
        if (!s || typeof s.packId !== "string" || !packIds.has(s.packId)) push(id, `authorSolution.packId "${String(s?.packId)}" \u4E0D\u5728\u5019\u9009\u5185`);
        if (!s || typeof s.slotRef !== "string" || !S7_PUZZLE_PLAYER_SLOT.test(s.slotRef)) push(id, `authorSolution.slotRef "${String(s?.slotRef)}" \u975E\u6CD5\uFF08p0c0..p2c2\uFF09`);
        else if (pslots.has(s.slotRef)) push(id, `authorSolution.slotRef "${s.slotRef}" \u91CD\u590D`);
        else pslots.add(s.slotRef);
      }
    }
  }
}
function validateS7ConfigBundle(bundle) {
  const errors = [];
  const rowsByTable = {};
  for (const table of TIER_A_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierACommon(errors, table, rows);
  }
  for (const table of TIER_B_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }
  for (const table of TIER_GROWTH_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }
  for (const table of TIER_B_REL_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_B_BLD_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBBldCommon(errors, table, rows);
  }
  for (const table of TIER_C_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_D_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBRelCommon(errors, table, rows);
  }
  for (const table of TIER_BATTLE_TABLES) {
    const rows = bundle[table];
    if (!Array.isArray(rows)) {
      errors.push({ table, id: "-", message: "\u914D\u7F6E\u8868\u5FC5\u987B\u662F\u6570\u7EC4" });
      rowsByTable[table] = [];
      continue;
    }
    rowsByTable[table] = validateTierBCommon(errors, table, rows);
  }
  const shipIds = new Set(rowsByTable.ship_config.map((r) => String(r.shipId)));
  const coreIds = new Set(rowsByTable.core_config.map((r) => String(r.coreId)));
  const pilotIds = new Set(rowsByTable.pilot_config.map((r) => String(r.pilotId)));
  const pluginIds = new Set(rowsByTable.plugin_config.map((r) => String(r.pluginId)));
  const templateIds = new Set(rowsByTable.battle_template_config.map((r) => String(r.templateId)));
  const shipAndCoreIds = /* @__PURE__ */ new Set();
  shipIds.forEach((x) => shipAndCoreIds.add(x));
  coreIds.forEach((x) => shipAndCoreIds.add(x));
  for (const row2 of rowsByTable.battle_template_config) {
    const id = String(row2.templateId);
    if (typeof row2.mainProblemTag !== "string" || !S7_PROBLEM_TAGS.includes(row2.mainProblemTag)) errors.push({ table: "battle_template_config", id, message: "mainProblemTag \u975E\u6CD5" });
    if (row2.secondaryTagCap !== 1) errors.push({ table: "battle_template_config", id, message: "secondaryTagCap \u5FC5\u987B\u4E3A 1" });
    checkStringArrayEnum(errors, "battle_template_config", id, "applicableStageTypes", row2.applicableStageTypes, S7_STAGE_TYPES, true);
    if (row2.reservedSlotFlag !== false) errors.push({ table: "battle_template_config", id, message: "Tier A \u9ED8\u8BA4\u6A21\u677F reservedSlotFlag \u5FC5\u987B\u4E3A false" });
  }
  for (const row2 of rowsByTable.ship_config) {
    const id = String(row2.shipId);
    if (typeof row2.shipType !== "string" || !S7_SHIP_TYPES.includes(row2.shipType)) errors.push({ table: "ship_config", id, message: "shipType \u975E\u6CD5" });
    checkStringArrayEnum(errors, "ship_config", id, "coverProblemTags", row2.coverProblemTags, S7_PROBLEM_TAGS, true);
  }
  for (const row2 of rowsByTable.pilot_config) {
    const id = String(row2.pilotId);
    checkStringArrayEnum(errors, "pilot_config", id, "coverProblemTags", row2.coverProblemTags, S7_PROBLEM_TAGS, true);
  }
  for (const row2 of rowsByTable.core_config) {
    const id = String(row2.coreId);
    checkStringArrayEnum(errors, "core_config", id, "coverProblemTags", row2.coverProblemTags, S7_PROBLEM_TAGS, true);
    checkRefs(errors, "core_config", id, "shipFitRefs", row2.shipFitRefs, shipIds);
  }
  for (const row2 of rowsByTable.plugin_config) {
    const id = String(row2.pluginId);
    if (typeof row2.slotTag !== "string" || !S7_PLUGIN_SLOTS.includes(row2.slotTag)) errors.push({ table: "plugin_config", id, message: "slotTag \u975E\u6CD5" });
    checkStringArrayEnum(errors, "plugin_config", id, "coverProblemTags", row2.coverProblemTags, S7_PROBLEM_TAGS, true);
    checkRefs(errors, "plugin_config", id, "fitRefs", row2.fitRefs, shipAndCoreIds);
  }
  validateTierB(errors, rowsByTable);
  validateGrowth(errors, rowsByTable);
  validateTierBRel(errors, rowsByTable, {
    ships: shipIds,
    pilots: pilotIds,
    cores: coreIds,
    plugins: pluginIds,
    templates: templateIds
  });
  validateTierBBld(errors, rowsByTable);
  validateTierC(errors, rowsByTable);
  validateTierD(errors, rowsByTable);
  validateBattle(errors, rowsByTable);
  validateCommissionAffix(errors, rowsByTable);
  validateDailyPuzzle(errors, rowsByTable, { ships: shipIds, pilots: pilotIds, cores: coreIds, plugins: pluginIds });
  for (const [table, rows] of Object.entries(rowsByTable)) {
    if (table === "power_reference_param") continue;
    for (const row2 of rows) {
      if (Object.prototype.hasOwnProperty.call(row2, "powerIndex")) {
        errors.push({ table, id: String(row2.rowId ?? "-"), message: "powerIndex \u4EC5\u5141\u8BB8\u51FA\u73B0\u5728 power_reference_param\uFF08\u4E0D\u5F97\u8FDB\u5165 UI / \u5956\u52B1 / \u5546\u4E1A\u5316\u8BED\u4E49\uFF09" });
      }
    }
  }
  return errors;
}

// assets/scripts/config/s7/ConfigLoaderS7.ts
var S7_TABLE_NAMES = [
  "battle_template_config",
  "ship_config",
  "pilot_config",
  "core_config",
  "plugin_config",
  "source_tag_config",
  "power_reference_param",
  "free_resource_anchor_param",
  "upgrade_cost_param",
  "enhance_cost_param",
  "growth_band_param",
  "refund_param",
  "pressure_param",
  "reward_param",
  "shop_param",
  "merchant_refresh_param",
  "recycle_param",
  "anti_arbitrage_check",
  "enemy_schema_config",
  "boss_skeleton_config",
  "prebattle_preview_config",
  "ship_pilot_fit_config",
  "core_plugin_fit_config",
  "building_config",
  "building_unlock_config",
  "building_level_cost_param",
  "building_level_effect_param",
  "building_anchor_impact_check",
  "mainline_node_config",
  "chapter_config",
  "star_region_config",
  "boss_node_config",
  "tutorial_trigger_config",
  "unlock_checkpoint_config",
  "protection_reset_config",
  "reward_pool_ref_config",
  "no_ad_path_check_config",
  "risk_fallback_70_config",
  "battle_unit_stat_param",
  "battle_effect_param",
  "battle_encounter_param",
  "battle_spawn_param",
  "battle_boss_phase_param",
  "commission_affix_param",
  "daily_puzzle_param"
];
var S7ConfigLoadError = class extends Error {
  constructor(errors) {
    super(`s7 config validation failed: ${errors.length} error(s)`);
    this.errors = errors;
  }
};
var S7ConfigLoader = class {
  constructor() {
    this.bundle = null;
    this.indexes = /* @__PURE__ */ new Map();
    this.version = "";
  }
  static get resourcePaths() {
    return { ...S7_TABLE_FILES };
  }
  loadFromData(raw) {
    const errors = validateS7ConfigBundle(raw);
    if (errors.length > 0) {
      throw new S7ConfigLoadError(errors);
    }
    const bundle = raw;
    this.bundle = bundle;
    this.indexes.clear();
    for (const table of S7_TABLE_NAMES) {
      const idField = S7_ID_FIELD[table];
      const map = /* @__PURE__ */ new Map();
      for (const row2 of bundle[table]) {
        map.set(row2[idField], row2);
      }
      this.indexes.set(table, map);
    }
    const first = bundle.battle_template_config[0];
    this.version = first ? first.schemaVersion : "unknown";
  }
  get loadedVersion() {
    return this.version;
  }
  isLoaded() {
    return this.bundle !== null;
  }
  getAll(table) {
    this.assertLoaded();
    return this.bundle[table];
  }
  getById(table, id) {
    this.assertLoaded();
    return this.indexes.get(table)?.get(id);
  }
  assertLoaded() {
    if (!this.bundle) {
      throw new Error("S7ConfigLoader: configs not loaded yet");
    }
  }
};

// assets/scripts/config/s7/S7ConfigRuntime.ts
var S7_RUNTIME_TABLE_NAMES = Object.keys(S7_TABLE_FILES);
var S7ConfigAssembleError = class extends Error {
  constructor(tableName, message) {
    super(`s7 table "${tableName}" \u88C5\u914D\u5931\u8D25: ${message}`);
    this.tableName = tableName;
    this.name = "S7ConfigAssembleError";
  }
};
async function assembleS7Bundle(reader) {
  const bundle = {};
  for (const tableName of S7_RUNTIME_TABLE_NAMES) {
    const resourcePath = S7_TABLE_FILES[tableName];
    let rows;
    try {
      rows = await reader(tableName, resourcePath);
    } catch (err) {
      throw new S7ConfigAssembleError(tableName, err?.message ?? String(err));
    }
    if (!Array.isArray(rows)) {
      throw new S7ConfigAssembleError(
        tableName,
        `\u671F\u671B\u6570\u7EC4\uFF0C\u5B9E\u9645\u4E3A ${rows === null ? "null" : typeof rows}`
      );
    }
    bundle[tableName] = rows;
  }
  return bundle;
}
function createInMemoryS7TableReader(bundle) {
  return async (tableName) => bundle[tableName] ?? [];
}
var S7ConfigRuntime = class _S7ConfigRuntime {
  constructor(loader) {
    this.loader = loader;
  }
  /**
   * 经注入的 reader 读取全部 43 张表，校验后构建只读运行时。
   * 校验失败抛 S7ConfigLoadError；表读取失败 / 非数组抛 S7ConfigAssembleError。
   */
  static async load(reader) {
    const bundle = await assembleS7Bundle(reader);
    const loader = new S7ConfigLoader();
    loader.loadFromData(bundle);
    return new _S7ConfigRuntime(loader);
  }
  /** 已加载配置版本（schemaVersion），未加载时为空串。 */
  get version() {
    return this.loader.loadedVersion;
  }
  isLoaded() {
    return this.loader.isLoaded();
  }
  /** 已加载的 43 张表名（只读副本）。 */
  get tableNames() {
    return [...S7_RUNTIME_TABLE_NAMES];
  }
  /** 取整表行（加载后只读，调用方不得修改返回数组）。 */
  getAll(table) {
    return this.loader.getAll(table);
  }
  /** 按表内唯一 ID 取单行；不存在返回 undefined。 */
  getById(table, id) {
    return this.loader.getById(table, id);
  }
  /** 是否存在指定 ID 的行。 */
  has(table, id) {
    return this.loader.getById(table, id) !== void 0;
  }
};

// assets/scripts/core/s7/S7AutoBattleRng.ts
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
var S7AutoBattleRng = class {
  constructor(seed) {
    this.state = xmur3(String(seed));
  }
  /** 下一个 [0,1) 浮点数。 */
  next() {
    let t = this.state = this.state + 1831565813 | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** [0, n) 的整数；n<=0 时返回 0。 */
  nextInt(n) {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }
  /** 从非空数组里等概率取一个；空数组返回 undefined。 */
  pick(items) {
    if (items.length === 0) return void 0;
    return items[this.nextInt(items.length)];
  }
};

// assets/scripts/core/s7/S7AutoBattleTypes.ts
var S7AutoBattleError = class extends Error {
  constructor(code, message) {
    super(`s7 auto battle \u9519\u8BEF[${code}]: ${message}`);
    this.code = code;
    this.name = "S7AutoBattleError";
  }
};

// assets/scripts/core/s7/S7BattleStatDerivation.ts
var STAT_KEYS = [
  "maxHp",
  "attack",
  "armor",
  "attackIntervalSec",
  "attackRangeCells",
  "passiveEnergyPerSec"
];
var AFFIX_KEYS = [
  "critRate",
  "critDmg",
  "shieldBreak",
  "skillHaste",
  "healPower",
  "controlResist",
  "dmgVsSwarm",
  "dmgVsBoss",
  // ⑥8a 受控并行加法（缺省 0=行为不变），语义见 S7BattleEffectBlock 注释
  "dmgVsLowHp",
  "dmgVsHighHp",
  "dmgVsFortified",
  "armorPen",
  "lifesteal",
  "dodgeRate",
  "dmgTakenPct",
  "healTakenPct",
  "shieldPower",
  "healVsLowHp",
  "skillDmgPct",
  "effectAmp",
  "durationPct",
  "summonCapBonus"
];
function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}
var FRIENDLY_TARGETING_TAGS = /* @__PURE__ */ new Set([
  "self_team",
  "lowest_hp_ally",
  "highest_attack_ally",
  "no_buff_ally_first",
  "most_debuffed_ally",
  "controlled_ally_first",
  "self_cross_area",
  "self_block_area"
]);
function deriveUnit(base, blocks = []) {
  const acc = {};
  for (const k of STAT_KEYS) acc[k] = { flat: 0, pct: 0, set: null };
  const affixes = {};
  for (const a of AFFIX_KEYS) affixes[a] = 0;
  let targetingTag = base.targetingTag;
  let normalEffectRef = base.normalEffectRef;
  let ultimateEffectRef = base.ultimateEffectRef;
  let coreEffectRef = base.coreEffectRef;
  const triggers = [];
  const stackRules = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "modifier": {
        const slot = acc[b.stat];
        if (!slot) throw new Error(`\u672A\u77E5\u7684\u4FEE\u6B63\u5C5E\u6027: ${String(b.stat)}`);
        if (b.op === "flat") slot.flat += b.value;
        else if (b.op === "pct") slot.pct += b.value;
        else slot.set = b.value;
        break;
      }
      case "affix":
        if (!(b.affix in affixes)) throw new Error(`\u672A\u77E5\u7684\u8BCD\u6761: ${String(b.affix)}`);
        affixes[b.affix] += b.value;
        break;
      case "behavior":
        if (FRIENDLY_TARGETING_TAGS.has(b.targetingTag) === FRIENDLY_TARGETING_TAGS.has(base.targetingTag)) {
          targetingTag = b.targetingTag;
        }
        break;
      case "action":
        if (b.slot === "normal") normalEffectRef = b.effectRef;
        else if (b.slot === "ultimate") ultimateEffectRef = b.effectRef;
        else coreEffectRef = b.effectRef;
        break;
      case "trigger":
        triggers.push(b);
        break;
      case "stack":
        stackRules.push(b.rule);
        break;
      default: {
        const _exhaustive = b;
        throw new Error(`\u672A\u77E5\u79EF\u6728\u7C7B\u578B: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  const calc = (k) => ((acc[k].set ?? base[k]) + acc[k].flat) * (1 + acc[k].pct);
  return {
    maxHp: Math.max(1, Math.round(calc("maxHp"))),
    attack: Math.max(0, Math.round(calc("attack"))),
    armor: Math.max(0, Math.round(calc("armor"))),
    attackIntervalSec: Math.max(0.1, round6(calc("attackIntervalSec"))),
    attackRangeCells: Math.max(0, round6(calc("attackRangeCells"))),
    passiveEnergyPerSec: Math.max(0, round6(calc("passiveEnergyPerSec"))),
    sizeRows: base.sizeRows,
    sizeCols: base.sizeCols,
    affixes,
    targetingTag,
    normalEffectRef,
    ultimateEffectRef,
    coreEffectRef,
    triggers,
    stackRules
  };
}

// assets/scripts/core/s7/S7AutoBattleEngine.ts
var TICK_SEC = 0.2;
var VULNERABLE_MULT = 1.25;
var SHIELD_BREAK_MULT = 1.5;
var BERSERK_ATTACK_MULT = 1.25;
var BERSERK_INTERVAL_MULT = 0.8;
var SHIELD_HP_FRACTION = 0.2;
var PLAYER_SLOT_PATTERN = /^p[0-2]c[0-2]$/;
var DAMAGE_TYPES = /* @__PURE__ */ new Set([
  "basic_damage",
  "clear_barrage",
  "line_pierce",
  "backline_strike",
  "burst_nuke"
]);
var SHIELD_TYPES = /* @__PURE__ */ new Set(["shield", "shield_bubble"]);
var HEAL_TYPES = /* @__PURE__ */ new Set(["repair_burst"]);
var SUMMON_TYPES = /* @__PURE__ */ new Set(["summon", "summon_drone"]);
var STATE_TYPES = /* @__PURE__ */ new Set([
  "short_circuit",
  "short_circuit_pulse",
  "stun",
  "shield_break",
  "mark",
  "vulnerable",
  "berserk",
  "silence",
  "control_immune",
  // ⑥8a：沉默(挡技能不挡普攻) / 免控(硬控免疫·守护铃/山岳不动)
  "apply_state"
  // ⑦机制批①：通用状态施加（stateTag 选态）
]);
var MOD_STATE_TAGS = /* @__PURE__ */ new Set([
  "atk_up",
  "atk_down",
  "atk_speed_up",
  "atk_speed_down",
  "armor_down",
  "dmg_up",
  "dmg_taken_up",
  "dmg_taken_down",
  "crit_rate_up",
  "crit_dmg_up",
  "skill_haste_up"
]);
var PERIODIC_STATE_TAGS = /* @__PURE__ */ new Set(["burn", "regen"]);
var CONTROL_TAGS = ["short_circuit", "stun"];
var HARD_CONTROL_TAGS = ["short_circuit", "stun", "silence"];
var STATE_TAG_ORDER = [
  "shield",
  "shield_break",
  "mark",
  "vulnerable",
  "short_circuit",
  "stun",
  "summon",
  "berserk",
  "silence",
  "control_immune",
  "atk_up",
  "atk_down",
  "atk_speed_up",
  "atk_speed_down",
  "armor_down",
  "dmg_up",
  "dmg_taken_up",
  "dmg_taken_down",
  "crit_rate_up",
  "crit_dmg_up",
  "skill_haste_up",
  "regen",
  "burn",
  // ⑦机制批① M2：同刻先回血后掉血（纸面规则·体验平滑向）
  "debuff_immune",
  // ⑨机制批② M5：减益免疫（尾部追加·旧配置不出现=遍历顺序不变）
  "taunt",
  // ⑨机制批② M4：嘲讽（尾部追加=遍历顺序不变）
  "reflect",
  // ⑨机制批② M4：反弹（尾部追加=遍历顺序不变）
  "guard",
  // ⑨机制批② M4：守护替挡（尾部追加=遍历顺序不变）
  "share",
  // ⑨机制批② M4：分摊（尾部追加=遍历顺序不变）
  "aura",
  // ⑨机制批② M6：光环（尾部追加=遍历顺序不变）
  "blind"
  // ⑨机制批② M8：致盲（尾部追加=遍历顺序不变）
];
var FRIENDLY_TAGS = /* @__PURE__ */ new Set([
  "self_team",
  "lowest_hp_ally",
  // ⑦机制批① 友方目标族 + 自身区域族（施加者阵营侧选目标）
  "highest_attack_ally",
  "no_buff_ally_first",
  "most_debuffed_ally",
  "controlled_ally_first",
  "self_cross_area",
  "self_block_area"
]);
var LOWHP_THRESHOLD = 0.3;
var HIGHHP_THRESHOLD = 0.5;
var FORTIFIED_ARMOR_THRESHOLD = 40;
var KEY_ROLE_TAGS = /* @__PURE__ */ new Set(["healer", "summoner", "support", "summon_source"]);
var DEBUFF_TAGS = [
  "shield_break",
  "mark",
  "vulnerable",
  "short_circuit",
  "stun",
  "silence",
  "atk_down",
  "atk_speed_down",
  "armor_down",
  "dmg_taken_up",
  "blind"
  // ⑨M8 致盲=减益（蔽/霖 目标判定纳入·尾部追加=旧配置不变）
];
var BUFF_TAGS = [
  "shield",
  "control_immune",
  "berserk",
  "atk_up",
  "atk_speed_up",
  "dmg_up",
  "dmg_taken_down",
  "crit_rate_up",
  "crit_dmg_up",
  "skill_haste_up",
  "debuff_immune"
  // ⑨机制批② M5：减益免疫也是增益（沛"无增益友军优先"纳入·尾部追加=旧配置不变）
];
var DEBUFF_STATE_TAGS = [
  "atk_down",
  "atk_speed_down",
  "armor_down",
  "vulnerable",
  "dmg_taken_up",
  "burn",
  "shield_break",
  "blind",
  "short_circuit",
  "stun",
  "silence"
];
var DISPEL_DEBUFF_ORDER = [
  "short_circuit",
  "stun",
  "silence",
  "burn",
  "blind",
  "armor_down",
  "dmg_taken_up",
  "atk_down",
  "atk_speed_down",
  "vulnerable",
  "shield_break"
];
var DISPEL_BUFF_ORDER = [
  "berserk",
  "atk_up",
  "dmg_up",
  "atk_speed_up",
  "crit_dmg_up",
  "crit_rate_up",
  "skill_haste_up",
  "dmg_taken_down",
  "regen",
  "shield",
  "control_immune",
  "debuff_immune"
];
var ZERO_AFFIXES = Object.freeze({
  critRate: 0,
  critDmg: 0,
  shieldBreak: 0,
  skillHaste: 0,
  healPower: 0,
  controlResist: 0,
  dmgVsSwarm: 0,
  dmgVsBoss: 0,
  // ⑥8a 新词条缺省全 0（=引擎行为逐字节不变）
  dmgVsLowHp: 0,
  dmgVsHighHp: 0,
  dmgVsFortified: 0,
  armorPen: 0,
  lifesteal: 0,
  dodgeRate: 0,
  dmgTakenPct: 0,
  healTakenPct: 0,
  shieldPower: 0,
  healVsLowHp: 0,
  skillDmgPct: 0,
  effectAmp: 0,
  durationPct: 0,
  summonCapBonus: 0
});
var S7AutoBattleEngine = class {
  constructor(runtime) {
    this.runtime = runtime;
  }
  /** 跑一场自动战斗，返回结果与完整事件日志。 */
  run(request) {
    return new BattleRun(this.runtime, request).execute();
  }
};
var BattleRun = class {
  constructor(runtime, request) {
    this.runtime = runtime;
    this.request = request;
    this.log = [];
    this.units = [];
    this.playerCells = /* @__PURE__ */ new Set();
    this.enemyCells = /* @__PURE__ */ new Set();
    this.spawnPlans = [];
    this.phases = [];
    /** ⑨机制批② M4：本场是否存在守护替挡态（首次施加 guard 时置真）；false=dealDamage 守护解析整段跳过=逐字节不变。 */
    this.anyGuard = false;
    /** ⑨机制批② M6：本场是否存在光环态（首次施加 aura 时置真）；false=auraSum 整段跳过=逐字节不变。 */
    this.anyAura = false;
    this.time = 0;
    this.timeLimitSec = 0;
    this.enemySeq = 0;
    /** 块2b：各方累计阵亡数（ally_down 条件触发用）。 */
    this.deadCount = { player: 0, enemy: 0 };
    this.rng = new S7AutoBattleRng(request.battleSeed);
  }
  execute() {
    const enc = this.runtime.getById("battle_encounter_param", this.request.encounterRef);
    if (!enc) {
      throw new S7AutoBattleError("unknown_encounter", `battle_encounter_param \u7F3A\u5C11 ${this.request.encounterRef}`);
    }
    const tOverride = this.request.timeLimitSecOverride;
    this.timeLimitSec = typeof tOverride === "number" && tOverride > 0 ? tOverride : enc.timeLimitSec;
    this.placePlayerUnits();
    const inline = this.request.inlineEnemyUnits;
    if (inline && inline.length > 0) this.placeInlineEnemies(inline);
    else this.loadSpawnPlans(enc);
    this.loadPhases(enc);
    this.pushLog("battle_start", { note: enc.rowId });
    const maxTicks = Math.max(1, Math.round(this.timeLimitSec / TICK_SEC));
    let decided = null;
    for (let tick = 0; tick < maxTicks; tick += 1) {
      this.time = roundTime(tick * TICK_SEC);
      this.stepSpawnWaves();
      this.stepExpireStates();
      this.stepTriggers();
      this.stepNormalAttacks();
      this.stepBossPhases();
      this.stepCleanupDead();
      decided = this.checkOutcome();
      if (decided) break;
    }
    let durationSec;
    let winner;
    let reason;
    if (decided) {
      durationSec = this.time;
      winner = decided.winner;
      reason = decided.reason;
    } else {
      durationSec = this.timeLimitSec;
      winner = "enemy";
      reason = "timeout";
    }
    this.log.push({ timeSec: durationSec, type: "battle_end", winner, reason, durationSec });
    return {
      winner,
      reason,
      durationSec,
      log: this.log,
      finalState: this.buildFinalState(durationSec)
    };
  }
  // ===== 初始化 =====
  placePlayerUnits() {
    const inputs = this.request.playerUnits;
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new S7AutoBattleError("no_player_units", "\u73A9\u5BB6\u4E0A\u9635\u5355\u4F4D\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (inputs.length > S7_MAX_PLAYER_UNITS) {
      throw new S7AutoBattleError("too_many_players", `\u73A9\u5BB6\u5355\u4F4D\u6700\u591A ${S7_MAX_PLAYER_UNITS}\uFF0C\u5B9E\u9645 ${inputs.length}`);
    }
    const seenSlots = /* @__PURE__ */ new Set();
    for (const input of inputs) {
      const slot = input.slotRef;
      if (typeof slot !== "string" || !PLAYER_SLOT_PATTERN.test(slot)) {
        throw new S7AutoBattleError("bad_player_slot", `\u975E\u6CD5\u73A9\u5BB6\u683C "${String(slot)}"\uFF08\u4EC5 p0c0..p2c2\uFF09`);
      }
      if (seenSlots.has(slot)) {
        throw new S7AutoBattleError("dup_player_slot", `\u91CD\u590D\u73A9\u5BB6\u683C "${slot}"`);
      }
      seenSlots.add(slot);
      const stat = this.runtime.getById("battle_unit_stat_param", input.unitStatRef);
      if (!stat) {
        throw new S7AutoBattleError("unknown_unit_stat", `battle_unit_stat_param \u7F3A\u5C11 ${String(input.unitStatRef)}`);
      }
      if (stat.targetType !== "ship") {
        throw new S7AutoBattleError("not_ship", `\u73A9\u5BB6\u5355\u4F4D ${stat.rowId} \u7684 targetType \u5FC5\u987B\u662F ship\uFF08\u5B9E\u9645 ${stat.targetType}\uFF09`);
      }
      const row2 = Number(slot[1]);
      const col = Number(slot[3]);
      const blocks = input.effectBlocks ?? [];
      const derived = blocks.length > 0 ? deriveUnit(baseStatOf(stat), blocks) : null;
      this.spawnUnit(stat, "player", row2, col, slot, derived);
    }
  }
  loadSpawnPlans(enc) {
    const plans = [];
    for (const ref of enc.spawnPlanRefs) {
      const row2 = this.runtime.getById("battle_spawn_param", ref);
      if (!row2) throw new S7AutoBattleError("unknown_spawn", `battle_spawn_param \u7F3A\u5C11 ${ref}`);
      plans.push({ row: row2, processed: false });
    }
    plans.sort((a, b) => {
      if (a.row.spawnDelaySec !== b.row.spawnDelaySec) return a.row.spawnDelaySec - b.row.spawnDelaySec;
      if (a.row.waveIndex !== b.row.waveIndex) return a.row.waveIndex - b.row.waveIndex;
      return a.row.rowId < b.row.rowId ? -1 : a.row.rowId > b.row.rowId ? 1 : 0;
    });
    this.spawnPlans = plans;
  }
  loadPhases(enc) {
    const phases = [];
    for (const ref of enc.bossPhaseRefs) {
      const row2 = this.runtime.getById("battle_boss_phase_param", ref);
      if (!row2) throw new S7AutoBattleError("unknown_boss_phase", `battle_boss_phase_param \u7F3A\u5C11 ${ref}`);
      phases.push({ row: row2, triggered: false });
    }
    this.phases = phases;
  }
  // ===== 单步处理（固定顺序）=====
  /** 1：处理到点的出怪批次。 */
  stepSpawnWaves() {
    for (const plan of this.spawnPlans) {
      if (plan.processed) continue;
      if (this.time + 1e-9 < plan.row.spawnDelaySec) continue;
      plan.processed = true;
      this.processSpawnPlan(plan.row);
    }
  }
  processSpawnPlan(plan) {
    const stat = this.runtime.getById("battle_unit_stat_param", plan.unitStatRef);
    if (!stat) throw new S7AutoBattleError("unknown_unit_stat", `battle_unit_stat_param \u7F3A\u5C11 ${plan.unitStatRef}`);
    const created = [];
    for (const slot of plan.slotRefs) {
      if (this.countAliveEnemies() >= plan.maxConcurrentOnField) break;
      const parsed = parseEnemySlot(slot);
      if (!parsed) {
        throw new S7AutoBattleError("bad_spawn_slot", `\u975E\u6CD5\u51FA\u602A\u683C "${slot}"\uFF08\u4EC5 r0c0..r${S7_ENEMY_ROWS - 1}c${S7_ENEMY_COLS - 1}\uFF09`);
      }
      if (!this.canPlace("enemy", parsed.row, parsed.col, stat.sizeRows, stat.sizeCols)) continue;
      created.push(this.spawnUnit(stat, "enemy", parsed.row, parsed.col, slot));
    }
    if (created.length > 0) {
      this.pushLog("spawn_wave", {
        side: "enemy",
        waveIndex: plan.waveIndex,
        targetIds: created.map((u) => u.unitId),
        note: plan.rowId
      });
    }
  }
  /**
   * 【深空回廊专用·受控入口】按内联敌阵一次性铺敌（开局全部就位·单波·不走 encounter 出怪批次）。
   * 每个敌人应用 request.enemyEffectBlocks（随层缩放 + 敌方戏法：铁甲潮改护甲/护盾矩阵开局盾/蜂群变弱），
   * 经 deriveUnit 合并成装配后属性（spawnUnit 对敌我同口径消费 derived）。占用/越界的格跳过。
   * 主线/悬赏永不传 inlineEnemyUnits，永不进入此路径（零行为变化，与 processSpawnPlan 并行不交叉）。
   */
  placeInlineEnemies(inline) {
    const ebs = this.request.enemyEffectBlocks ?? [];
    const created = [];
    for (const item of inline) {
      const stat = this.runtime.getById("battle_unit_stat_param", item.unitStatRef);
      if (!stat) throw new S7AutoBattleError("unknown_unit_stat", `battle_unit_stat_param \u7F3A\u5C11 ${String(item.unitStatRef)}`);
      const parsed = parseEnemySlot(item.slotRef);
      if (!parsed) {
        throw new S7AutoBattleError("bad_spawn_slot", `\u975E\u6CD5\u5185\u8054\u654C\u683C "${String(item.slotRef)}"\uFF08\u4EC5 r0c0..r${S7_ENEMY_ROWS - 1}c${S7_ENEMY_COLS - 1}\uFF09`);
      }
      if (!this.canPlace("enemy", parsed.row, parsed.col, stat.sizeRows, stat.sizeCols)) continue;
      const derived = ebs.length > 0 ? deriveUnit(baseStatOf(stat), ebs) : null;
      created.push(this.spawnUnit(stat, "enemy", parsed.row, parsed.col, item.slotRef, derived));
    }
    if (created.length > 0) {
      this.pushLog("spawn_wave", { side: "enemy", waveIndex: 1, targetIds: created.map((u) => u.unitId), note: "corridor_inline" });
    }
  }
  /** 2：结算状态到期并记录 state_expire；⑥8a 附带处理限时召唤物到期（无限时召唤物时零行为）。
   *  ⑦机制批①（挂进本步语义内·不新增步骤）：M2 周期结算（先结到点的 tick 再判到期）、
   *  M3 到期动作 decay_1（降 1 层重计时）、叠层规则的 per_second 累积与 attack_gap 断档。 */
  stepExpireStates() {
    for (const unit of this.stableUnits()) {
      if (!unit.alive) continue;
      for (const tag of STATE_TAG_ORDER) {
        const st = unit.states.get(tag);
        if (!st) continue;
        if (st.nextTickAt !== void 0) {
          const interval = st.tickIntervalSec !== void 0 && st.tickIntervalSec > 0 ? st.tickIntervalSec : 1;
          while (unit.alive && st.nextTickAt <= this.time + 1e-9 && st.nextTickAt <= st.expireAt + 1e-9) {
            this.settlePeriodicTick(unit, st);
            st.nextTickAt += interval;
          }
          if (!unit.alive) break;
        }
        if (st.expireAt <= this.time + 1e-9) {
          if (st.expireAction === "decay_1" && (st.stacks ?? 1) > 1 && st.durationSec !== void 0) {
            st.stacks = (st.stacks ?? 1) - 1;
            st.expireAt = this.time + st.durationSec;
            continue;
          }
          unit.states.delete(tag);
          if (tag === "shield" && unit.shield > 0) unit.shield = 0;
          this.pushLog("state_expire", { actorId: unit.unitId, side: unit.side, stateTag: tag });
        }
      }
      if (!unit.alive) continue;
      for (const r of unit.stackRules) {
        if (r.rule.on === "per_second") {
          while (r.nextAccrueAt <= this.time + 1e-9) {
            if (r.rule.breakOn === "target_switch") this.syncTrackedTarget(unit, r);
            if (r.rule.stat !== "dmgVsLockedPct" || unit.lockedTargetId !== null) {
              r.stacks = Math.min(r.rule.maxStacks ?? Infinity, r.stacks + 1);
              r.lastEventAt = this.time;
            }
            r.nextAccrueAt += 1;
          }
        }
        if (r.rule.breakOn === "attack_gap" && r.stacks > 0 && r.rule.breakGapSec !== void 0 && r.rule.breakGapSec > 0 && this.time - r.lastEventAt > r.rule.breakGapSec + 1e-9) {
          r.stacks = r.rule.breakAction === "decay_1" ? r.stacks - 1 : 0;
          r.lastEventAt = this.time;
        }
      }
      if (unit.summonExpireAt !== null && unit.summonExpireAt <= this.time + 1e-9) {
        unit.alive = false;
        unit.hp = 0;
      }
    }
  }
  /** ⑦机制批① M2：结算一次周期 tick。燃烧=无视防御的伤害（先啃护盾 1:1，吃旧易伤×1.25/易伤参数版/减伤%，
   *  免伤=0；不触发 on_hit/attack_landed，不吃暴击/闪避）；回血=直接回血（快照量·满血跳过不记日志）。
   *  击杀归账给施加者（施加者已死则只记阵亡数）。 */
  settlePeriodicTick(unit, st) {
    const base = (st.tickAmount ?? 0) * (st.stacks ?? 1);
    if (base <= 0) return;
    const actorId = st.sourceUnitId ?? unit.unitId;
    const side = st.sourceSide ?? unit.side;
    if (st.tag === "regen") {
      const amount = Math.min(unit.maxHp - unit.hp, Math.max(1, Math.round(base)));
      if (amount <= 0) return;
      unit.hp += amount;
      this.pushLog("heal", {
        actorId,
        side,
        targetIds: [unit.unitId],
        effectRef: st.srcEffectRef,
        effectType: "regen",
        periodic: true,
        amount,
        hpAfter: unit.hp,
        shieldAfter: unit.shield
      });
      return;
    }
    let raw = base;
    if (unit.states.has("vulnerable")) raw *= VULNERABLE_MULT;
    const takenUp = this.stateModSum(unit, "dmg_taken_up");
    if (takenUp !== 0) raw *= 1 + takenUp;
    const reduction = Math.min(1, Math.max(0, this.stateModSum(unit, "dmg_taken_down") + this.ruleStatSum(unit, "dmgTakenDownPct")));
    if (reduction >= 1) {
      this.pushLog("damage", {
        actorId,
        side,
        targetIds: [unit.unitId],
        effectRef: st.srcEffectRef,
        effectType: "burn",
        periodic: true,
        amount: 0,
        immune: true,
        hpAfter: unit.hp,
        shieldAfter: unit.shield
      });
      return;
    }
    if (reduction > 0) raw *= 1 - reduction;
    const dmg = Math.max(1, Math.round(raw));
    let hpDmg = dmg;
    if (unit.shield > 0) {
      const absorbed = Math.min(unit.shield, dmg);
      unit.shield -= absorbed;
      hpDmg = dmg - absorbed;
      if (unit.shield <= 0) {
        unit.shield = 0;
        unit.states.delete("shield");
        unit.shieldBrokenSinceTrigger = true;
      }
    }
    if (hpDmg > 0) unit.hp -= hpDmg;
    if (unit.hp <= 0) {
      unit.hp = 0;
      unit.alive = false;
    }
    this.pushLog("damage", {
      actorId,
      side,
      targetIds: [unit.unitId],
      effectRef: st.srcEffectRef,
      effectType: "burn",
      periodic: true,
      amount: hpDmg,
      hpAfter: unit.hp,
      shieldAfter: unit.shield
    });
    if (!unit.alive) {
      this.deadCount[unit.side] += 1;
      const source = st.sourceUnitId ? this.units.find((u) => u.unitId === st.sourceUnitId) : void 0;
      if (source && source.alive) {
        source.killedSinceTrigger = true;
        source.killedRolesSinceTrigger.push(unit.roleTag);
        this.accrueStackEvent(source, "kill");
      }
    }
  }
  /** 3：评估并释放三类触发（CD / 开局即放 / 血量阈值）。on_kill/on_hit 留块2b；passive 走装配 modifier、不在此 fire。
   *  ⑥8a：沉默（silence）同硬控一样挡技能触发（但不挡普攻·见 canAct）；事件标志清理并入。 */
  stepTriggers() {
    for (const unit of this.stableUnits()) {
      if (!unit.alive) continue;
      if (this.hasControl(unit) || unit.states.has("silence")) continue;
      for (const t of unit.triggers) {
        if (this.triggerReady(unit, t)) this.fireTrigger(unit, t);
      }
      unit.hitSinceTrigger = false;
      unit.killedSinceTrigger = false;
      unit.shieldBrokenSinceTrigger = false;
      unit.attackLandedSinceTrigger = false;
      unit.skillCastSinceTrigger = false;
      if (unit.killedRolesSinceTrigger.length > 0) unit.killedRolesSinceTrigger = [];
    }
  }
  triggerReady(unit, t) {
    switch (t.block.on) {
      case "cd":
        return this.time + 1e-9 >= t.nextFireAt;
      case "battle_start":
        return !t.fired;
      case "hp_below":
        return !t.fired && unit.maxHp > 0 && unit.hp / unit.maxHp < (t.block.threshold ?? 0);
      case "on_kill": {
        if (t.fired || !unit.killedSinceTrigger) return false;
        const filter = t.block.onKillRoleTags;
        if (!filter || filter.length === 0) return true;
        return unit.killedRolesSinceTrigger.some((r) => filter.includes(r));
      }
      case "on_hit":
        return !t.fired && unit.hitSinceTrigger;
      // 可重复（同上）
      case "shield_broken":
        return !t.fired && unit.shieldBrokenSinceTrigger;
      // ⑥8a：本舰护盾被打破（超级护罩=once）
      case "attack_landed":
        return !t.fired && unit.attackLandedSinceTrigger;
      // ⑥8a：本舰普攻命中（回充插件）
      case "skill_cast":
        return !t.fired && unit.skillCastSinceTrigger;
      // ⑦机制批①：本舰放出 ultimate 类效果（战鼓）
      case "ally_down":
        return !t.fired && this.deadCount[unit.side] >= (t.block.threshold ?? Infinity);
      // 一次性：己方阵亡到数
      default:
        return false;
    }
  }
  /** 4：按稳定顺序处理可行动单位普攻。 */
  stepNormalAttacks() {
    for (const unit of this.stableUnits()) {
      if (!this.canAct(unit)) continue;
      if (this.time + 1e-9 < unit.nextAttackAt) continue;
      const normal = this.runtime.getById("battle_effect_param", unit.normalEffectRef);
      if (!normal) continue;
      const targets = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
      if (targets.length === 0) continue;
      const bl = unit.states.get("blind");
      if (bl && bl.blindChance && this.rng.next() < bl.blindChance) {
        this.pushLog("unit_attack", { actorId: unit.unitId, side: unit.side, targetIds: [], effectRef: normal.rowId, note: "blind_miss" });
        unit.nextAttackAt = this.time + this.effInterval(unit);
        continue;
      }
      this.pushLog("unit_attack", {
        actorId: unit.unitId,
        side: unit.side,
        targetIds: targets.map((t) => t.unitId),
        effectRef: normal.rowId,
        effectType: normal.effectType
      });
      this.applyEffectToTargets(unit, normal, targets);
      if (normal.repeatChance !== void 0 && normal.repeatChance > 0 && this.rng.next() < normal.repeatChance) {
        const extra = this.selectTargets(unit, unit.targetingTag, normal.maxTargets, unit.attackRangeCells);
        if (extra.length > 0) this.applyEffectToTargets(unit, normal, extra);
      }
      unit.nextAttackAt = this.time + this.effInterval(unit);
    }
  }
  /** 7：检查并触发 Boss phase（每个 phase 每场只触发一次）。 */
  stepBossPhases() {
    for (const phase of this.phases) {
      if (phase.triggered) continue;
      const boss = this.findBoss(phase.row.bossNodeId);
      if (!boss) continue;
      if (!this.phaseConditionMet(phase.row, boss)) continue;
      phase.triggered = true;
      this.triggerPhase(boss, phase.row);
    }
  }
  /** 8：清理死亡单位并记录 unit_down，释放占格。⑥8a：先做"随源消亡"级联（无该类召唤物时零行为）。 */
  stepCleanupDead() {
    let cascaded = true;
    while (cascaded) {
      cascaded = false;
      for (const s of this.units) {
        if (!s.alive || !s.despawnWithSource || s.summonedBy === null) continue;
        const src = this.units.find((u) => u.unitId === s.summonedBy);
        if (src && !src.alive) {
          s.alive = false;
          s.hp = 0;
          cascaded = true;
        }
      }
    }
    for (const unit of this.stableUnits()) {
      if (unit.alive || unit.downLogged) continue;
      unit.downLogged = true;
      this.freeCells(unit);
      this.pushLog("unit_down", { actorId: unit.unitId, side: unit.side });
    }
  }
  /** 9：检查胜负或 timeout。 */
  checkOutcome() {
    const enemiesAlive = this.units.some((u) => u.side === "enemy" && u.alive);
    const playersAlive = this.units.some((u) => u.side === "player" && u.alive);
    const pendingSpawns = this.spawnPlans.some((p) => !p.processed);
    if (!enemiesAlive && !pendingSpawns) return { winner: "player", reason: "all_enemies_down" };
    if (!playersAlive) return { winner: "enemy", reason: "all_players_down" };
    return null;
  }
  // ===== 触发 / 星核 =====
  /** 释放一条触发的效果并推进其计时/闩锁；首次任意触发后放一次 coreEffectRef（占位钩子，星核大改留块3）。 */
  fireTrigger(unit, t) {
    const effect = this.runtime.getById("battle_effect_param", t.block.effectRef);
    if (t.block.on === "cd") {
      const baseCd = t.block.cdSec && t.block.cdSec > 0 ? t.block.cdSec : Infinity;
      const haste = unit.affixes.skillHaste + this.stateModSum(unit, "skill_haste_up") + this.auraSum(unit, "skillHastePct");
      t.nextFireAt = this.time + (baseCd === Infinity ? Infinity : baseCd / (1 + haste));
    } else {
      const repeatable = t.block.on === "on_kill" || t.block.on === "on_hit" || t.block.on === "shield_broken" || t.block.on === "attack_landed" || t.block.on === "skill_cast";
      if (!repeatable || t.block.once) t.fired = true;
    }
    if (!effect) return;
    if (effect.effectKind === "ultimate") unit.skillCastSinceTrigger = true;
    this.castLogged(unit, effect, "ultimate_cast");
    if (!unit.coreTriggered && unit.coreEffectRef !== "none") {
      const core = this.runtime.getById("battle_effect_param", unit.coreEffectRef);
      if (core) {
        unit.coreTriggered = true;
        this.castLogged(unit, core, "core_trigger");
      }
    }
  }
  /**
   * 释放一个主动效果（大招 / 星核）并记录施法事件：先选定目标（RNG 仅抽一次），
   * 把目标写入施法日志（cast 事件早于其伤害/状态事件），再施加。召唤型无预选目标，
   * 召出的单位由随后的 spawn_wave 体现。
   */
  castLogged(caster, effect, logType) {
    if (effect.effectType === "cd_refund") {
      for (const t of caster.triggers) {
        if (t.block.on === "cd" && Number.isFinite(t.nextFireAt)) {
          t.nextFireAt = Math.max(this.time, t.nextFireAt - effect.effectPower);
        }
      }
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType, targetIds: [caster.unitId] });
      return;
    }
    if (effect.effectType === "accumulate_attack") {
      caster.attack += Math.round(effect.effectPower * caster.baseAttack);
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType, targetIds: [caster.unitId] });
      return;
    }
    if (SUMMON_TYPES.has(effect.effectType)) {
      this.pushLog(logType, { actorId: caster.unitId, side: caster.side, effectRef: effect.rowId, effectType: effect.effectType });
      const budget = { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, budget, "effect_summon", caster, effect);
      return;
    }
    const targets = this.selectTargets(caster, effect.targetingTag, effect.maxTargets, void 0);
    this.pushLog(logType, {
      actorId: caster.unitId,
      side: caster.side,
      effectRef: effect.rowId,
      effectType: effect.effectType,
      targetIds: targets.map((t) => t.unitId)
    });
    this.applyEffectToTargets(caster, effect, targets);
    const multiCast = Math.max(0, Math.floor(effect.repeatCount ?? 0));
    for (let i = 0; i < multiCast; i += 1) {
      const rt = this.selectTargets(caster, effect.targetingTag, effect.maxTargets, void 0);
      this.applyEffectToTargets(caster, effect, rt);
    }
  }
  // ===== Boss phase =====
  findBoss(bossNodeId) {
    for (const unit of this.stableUnits()) {
      if (unit.side === "enemy" && unit.alive && unit.isBoss && unit.bossNodeId === bossNodeId) return unit;
    }
    return null;
  }
  phaseConditionMet(phase, boss) {
    switch (phase.triggerType) {
      case "battle_start":
        return true;
      case "hp_pct_below":
        return boss.hp / boss.maxHp * 100 < phase.triggerValue;
      case "time_elapsed_sec":
        return this.time + 1e-9 >= phase.triggerValue;
      default:
        return false;
    }
  }
  triggerPhase(boss, phase) {
    this.pushLog("boss_phase", { actorId: boss.unitId, side: "enemy", phaseTag: phase.phaseTag, note: phase.rowId });
    const budget = { remaining: phase.summonCountCap };
    for (const ref of phase.effectRefs) {
      const eff = this.runtime.getById("battle_effect_param", ref);
      if (!eff) continue;
      this.resolveEffect(boss, eff, false, budget);
    }
    for (const group of groupOrdered(phase.summonUnitRefs)) {
      this.summonUnits("enemy", group.ref, group.count, budget, "phase_summon", boss);
    }
  }
  // ===== 效果结算 =====
  /** 结算一个效果：召唤型走召唤分支，其余按 targetingTag 选目标后施加。 */
  resolveEffect(caster, effect, isNormal, budget) {
    if (effect.effectType === "cd_refund") {
      for (const t of caster.triggers) {
        if (t.block.on === "cd" && Number.isFinite(t.nextFireAt)) {
          t.nextFireAt = Math.max(this.time, t.nextFireAt - effect.effectPower);
        }
      }
      return;
    }
    if (SUMMON_TYPES.has(effect.effectType)) {
      const b = budget ?? { remaining: effect.maxTargets };
      this.summonUnits(caster.side, effect.summonUnitRef, effect.maxTargets, b, "effect_summon", caster, effect);
      return;
    }
    const tag = isNormal ? caster.targetingTag : effect.targetingTag;
    const range = isNormal ? caster.attackRangeCells : void 0;
    const targets = this.selectTargets(caster, tag, effect.maxTargets, range);
    this.applyEffectToTargets(caster, effect, targets);
  }
  /** ⑥8a：stateTag 施加概率门——字段缺省或 ≥1 时必定施加且不掷随机（零回归）；仅 (0,1) 才消费 RNG。 */
  rollStateChance(effect) {
    const c = effect.stateChance;
    if (c === void 0 || c >= 1) return true;
    return this.rng.next() < c;
  }
  applyEffectToTargets(caster, effect, targets) {
    const type = effect.effectType;
    if (DAMAGE_TYPES.has(type)) {
      const splash = effect.splashPct;
      for (let i = 0; i < targets.length; i += 1) this.dealDamage(caster, targets[i], effect, splash !== void 0 && i > 0 ? splash : 1);
      if (effect.stateTag !== "none") {
        for (const t of targets) if (t.alive && this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
      }
    } else if (SHIELD_TYPES.has(type)) {
      for (const t of targets) this.addShield(caster, t, effect);
      this.applyFrameworkRider(caster, effect, targets);
      this.applyDispelRider(caster, effect, targets);
    } else if (HEAL_TYPES.has(type)) {
      for (const t of targets) this.heal(caster, t, effect);
      this.applyFrameworkRider(caster, effect, targets);
      this.applyDispelRider(caster, effect, targets);
    } else if (STATE_TYPES.has(type)) {
      for (const t of targets) if (this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
    } else if (type === "purify") {
      this.applyDispelRider(caster, effect, targets);
    }
    const extraRefs = effect.alsoApplyStateRefs;
    if (extraRefs && extraRefs.length > 0) {
      for (const ref of extraRefs) {
        const row2 = this.runtime.getById("battle_effect_param", ref);
        if (!row2 || row2.stateTag === "none") continue;
        for (const t of targets) if (t.alive && this.rollStateChance(row2)) this.applyState(caster, t, row2.stateTag, row2.durationSec, row2);
      }
    }
  }
  /** ⑦机制批①：护盾/治疗行的框架状态搭载（甘霖「再生」=治疗附 HoT/晨曦Lv100 普盾附减伤）。
   *  只对框架新 tag（修正/周期）生效——旧 tag（如护盾行自描述的 stateTag='shield'）维持描述性不消费=零回归。 */
  applyFrameworkRider(caster, effect, targets) {
    if (!MOD_STATE_TAGS.has(effect.stateTag) && !PERIODIC_STATE_TAGS.has(effect.stateTag)) return;
    for (const t of targets) if (t.alive && this.rollStateChance(effect)) this.applyState(caster, t, effect.stateTag, effect.durationSec, effect);
  }
  /** ⑨机制批② M5：净化/驱散 rider——对每个存活目标移除状态（缺 dispelCount 或 ≤0=零操作=逐字节不变）。
   *  挂治疗/护盾行=附带净化（回响/涤荡/春风净化）；作 purify 主体=纯净化（净化模块）。 */
  applyDispelRider(caster, effect, targets) {
    const count = effect.dispelCount ?? 0;
    if (count <= 0) return;
    for (const t of targets) if (t.alive) this.applyDispel(caster, t, effect, count);
  }
  /** ⑨机制批② M5：从 target 移除至多 count 个状态。极性由目标阵营定——
   *  友军=净化（移除减益·硬控需 dispelHardControl）/ 敌方=驱散（移除增益）；按 §16c 优先级序·跳过不可驱散态。
   *  移除 shield 态同步清零护盾数值（镜像 stepExpireStates 口径）。 */
  applyDispel(caster, target, effect, count) {
    const cleanse = target.side === caster.side;
    const order = cleanse ? DISPEL_DEBUFF_ORDER : DISPEL_BUFF_ORDER;
    const allowHardControl = effect.dispelHardControl === true;
    const removed = [];
    for (const tag of order) {
      if (removed.length >= count) break;
      if (cleanse && HARD_CONTROL_TAGS.includes(tag) && !allowHardControl) continue;
      const inst = target.states.get(tag);
      if (!inst || inst.undispellable) continue;
      target.states.delete(tag);
      if (tag === "shield") target.shield = 0;
      removed.push(tag);
    }
    if (removed.length > 0) {
      this.pushLog("state_dispel", {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        note: (cleanse ? "cleanse:" : "dispel:") + removed.join(",")
      });
    }
  }
  dealDamage(caster, target, effect, damageScale = 1) {
    if (!target.alive) return;
    target = this.resolveGuard(caster, target);
    if (target.affixes.dodgeRate > 0 && this.rng.next() < target.affixes.dodgeRate) {
      this.pushLog("damage", {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: 0,
        dodged: true,
        hpAfter: target.hp,
        shieldAfter: target.shield
      });
      return;
    }
    const dmgReduction = Math.min(1, Math.max(
      0,
      this.stateModSum(target, "dmg_taken_down") + this.ruleStatSum(target, "dmgTakenDownPct") + this.auraSum(target, "dmgTakenDownPct")
    ));
    if (dmgReduction >= 1) {
      this.pushLog("damage", {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: 0,
        immune: true,
        hpAfter: target.hp,
        shieldAfter: target.shield
      });
      return;
    }
    const reflectInst = target.states.get("reflect");
    const shareInst = target.states.get("share");
    const armorCut = Math.min(1, Math.max(0, this.stateModSum(target, "armor_down")));
    const effArmor = target.armor * (1 - Math.min(1, Math.max(0, caster.affixes.armorPen))) * (1 - armorCut);
    let raw = this.effAttack(caster) * effect.effectPower * damageScale * 100 / (100 + effArmor);
    if (target.states.has("vulnerable")) raw *= VULNERABLE_MULT;
    raw *= 1 + (target.isBoss ? caster.affixes.dmgVsBoss : caster.affixes.dmgVsSwarm);
    if (caster.affixes.dmgVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD) {
      raw *= 1 + caster.affixes.dmgVsLowHp;
    }
    if (caster.affixes.dmgVsHighHp > 0 && target.maxHp > 0 && target.hp / target.maxHp > HIGHHP_THRESHOLD) {
      raw *= 1 + caster.affixes.dmgVsHighHp;
    }
    if (caster.affixes.dmgVsFortified > 0 && (target.shield > 0 || target.armor >= FORTIFIED_ARMOR_THRESHOLD)) {
      raw *= 1 + caster.affixes.dmgVsFortified;
    }
    const dmgUp = this.stateModSum(caster, "dmg_up") + this.ruleStatSum(caster, "dmgUpPct") + (caster.lockedTargetId === target.unitId ? this.ruleStatSum(caster, "dmgVsLockedPct") : 0);
    if (dmgUp !== 0) raw *= 1 + dmgUp;
    const isSkill = effect.effectKind === "ultimate" || effect.effectKind === "core";
    if (isSkill) raw *= (1 + caster.affixes.skillDmgPct) * (1 + caster.affixes.effectAmp);
    raw *= Math.max(0.1, 1 + target.affixes.dmgTakenPct);
    const takenUp = this.stateModSum(target, "dmg_taken_up");
    if (takenUp !== 0) raw *= 1 + takenUp;
    if (dmgReduction > 0) raw *= 1 - dmgReduction;
    if (reflectInst && reflectInst.blockPct) raw *= 1 - Math.min(1, Math.max(0, reflectInst.blockPct));
    const critRate = caster.affixes.critRate + this.stateModSum(caster, "crit_rate_up");
    const crit = critRate > 0 && this.rng.next() < critRate;
    if (crit) raw *= 1 + caster.affixes.critDmg + this.stateModSum(caster, "crit_dmg_up");
    const dmg = Math.max(1, Math.round(raw));
    let receiverDmg = dmg;
    if (shareInst && shareInst.sharePct) {
      const sharers = this.resolveShareSharers(target, shareInst);
      const pct = Math.min(1, Math.max(0, shareInst.sharePct));
      if (sharers.length > 0 && pct > 0) {
        const shareTotal = Math.round(dmg * pct);
        receiverDmg = dmg - shareTotal;
        this.distributeShare(sharers, shareTotal, caster);
      }
    }
    let hpDmg = receiverDmg;
    if (target.shield > 0) {
      const shieldMult = (target.states.has("shield_break") ? SHIELD_BREAK_MULT : 1) + caster.affixes.shieldBreak;
      const shieldLoss = Math.round(receiverDmg * shieldMult);
      if (shieldLoss <= target.shield) {
        target.shield -= shieldLoss;
        hpDmg = 0;
      } else {
        const overflowShieldPts = shieldLoss - target.shield;
        target.shield = 0;
        target.states.delete("shield");
        target.shieldBrokenSinceTrigger = true;
        hpDmg = Math.max(0, Math.round(overflowShieldPts / shieldMult));
      }
    }
    if (hpDmg > 0) target.hp -= hpDmg;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
    this.pushLog("damage", {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: hpDmg,
      ...crit ? { crit: true } : {},
      // 仅暴击时带字段：非暴击伤害日志保持原形状（零回归）
      hpAfter: target.hp,
      shieldAfter: target.shield
    });
    if (caster.affixes.lifesteal > 0 && hpDmg > 0 && caster.alive && caster.hp < caster.maxHp) {
      const healed = Math.min(caster.maxHp - caster.hp, Math.max(1, Math.round(hpDmg * caster.affixes.lifesteal)));
      caster.hp += healed;
      this.pushLog("heal", {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [caster.unitId],
        effectRef: effect.rowId,
        effectType: effect.effectType,
        amount: healed,
        hpAfter: caster.hp,
        shieldAfter: caster.shield
      });
    }
    if (effect.effectKind === "normal_attack") {
      caster.attackLandedSinceTrigger = true;
      this.accrueStackEvent(caster, "attack_landed");
    }
    if (!target.alive) {
      caster.killedSinceTrigger = true;
      caster.killedRolesSinceTrigger.push(target.roleTag);
      this.deadCount[target.side] += 1;
      this.accrueStackEvent(caster, "kill");
    } else {
      target.hitSinceTrigger = true;
      this.accrueStackEvent(target, "was_hit");
      if (isSkill) this.accrueStackEvent(target, "was_hit_by_skill");
    }
    if (reflectInst && caster.alive) {
      const reflectAmt = Math.round(
        (reflectInst.reflectPct ?? 0) * dmg + (reflectInst.reflectAtkPct ?? 0) * caster.attack + (reflectInst.reflectBase ?? 0)
      );
      if (reflectAmt > 0) {
        caster.hp -= reflectAmt;
        const reflectorKill = caster.hp <= 0;
        if (reflectorKill) {
          caster.hp = 0;
          caster.alive = false;
        }
        this.pushLog("damage", {
          actorId: target.unitId,
          side: target.side,
          targetIds: [caster.unitId],
          effectRef: "reflect",
          amount: reflectAmt,
          note: "reflect",
          hpAfter: caster.hp,
          shieldAfter: caster.shield
        });
        if (reflectorKill) {
          target.killedSinceTrigger = true;
          target.killedRolesSinceTrigger.push(caster.roleTag);
          this.deadCount[caster.side] += 1;
          this.accrueStackEvent(target, "kill");
        }
      }
    }
  }
  addShield(caster, target, effect) {
    if (!target.alive) return;
    const isSkill = effect.effectKind === "ultimate" || effect.effectKind === "core";
    const powerMult = (1 + caster.affixes.shieldPower) * (isSkill ? 1 + caster.affixes.effectAmp : 1);
    const amount = Math.round(Math.max(
      Math.round(target.maxHp * SHIELD_HP_FRACTION),
      Math.round(caster.attack * effect.effectPower)
    ) * powerMult);
    target.shield = Math.max(target.shield, amount);
    const duration = (effect.durationSec > 0 ? effect.durationSec : 1) * (isSkill ? 1 + caster.affixes.durationPct : 1);
    target.states.set("shield", { tag: "shield", expireAt: this.time + duration });
    this.pushLog("state_apply", {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      stateTag: "shield",
      amount,
      hpAfter: target.hp,
      shieldAfter: target.shield
    });
  }
  heal(caster, target, effect) {
    if (!target.alive) return;
    let rawHeal = caster.attack * effect.effectPower * (1 + caster.affixes.healPower);
    if (caster.affixes.healVsLowHp > 0 && target.maxHp > 0 && target.hp / target.maxHp < LOWHP_THRESHOLD) {
      rawHeal *= 1 + caster.affixes.healVsLowHp;
    }
    if (effect.effectKind === "ultimate" || effect.effectKind === "core") rawHeal *= 1 + caster.affixes.effectAmp;
    rawHeal *= 1 + target.affixes.healTakenPct;
    const amount = Math.round(rawHeal);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    this.pushLog("heal", {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      effectType: effect.effectType,
      amount: healed,
      hpAfter: target.hp,
      shieldAfter: target.shield
    });
  }
  applyState(caster, target, tag, durationSec, effect) {
    if (tag === "none" || !target.alive) return;
    if (HARD_CONTROL_TAGS.includes(tag) && target.states.has("control_immune")) return;
    if (DEBUFF_STATE_TAGS.includes(tag) && target.states.has("debuff_immune")) return;
    let duration = durationSec > 0 ? durationSec : 1;
    if (HARD_CONTROL_TAGS.includes(tag)) {
      const resist = Math.min(1, Math.max(0, target.affixes.controlResist));
      duration *= 1 - resist;
    }
    const isSkill = effect.effectKind === "ultimate" || effect.effectKind === "core";
    if (isSkill) duration *= 1 + caster.affixes.durationPct;
    if (MOD_STATE_TAGS.has(tag) || PERIODIC_STATE_TAGS.has(tag)) {
      const maxStacks = Math.max(1, Math.floor(effect.stateMaxStacks ?? 1));
      const prev = target.states.get(tag);
      const stacks = prev ? Math.min(maxStacks, (prev.stacks ?? 1) + 1) : 1;
      const inst = {
        tag,
        expireAt: this.time + duration,
        amountPerStack: effect.stateAmount ?? 0,
        stacks,
        maxStacks,
        expireAction: effect.stateExpireAction ?? "clear",
        durationSec: duration
      };
      if (PERIODIC_STATE_TAGS.has(tag)) {
        inst.tickAmount = (effect.stateTickAtkPct ?? 0) * caster.attack + (effect.stateTickMaxHpPct ?? 0) * target.maxHp + (effect.stateTickFlat ?? 0);
        const interval = effect.stateTickIntervalSec !== void 0 && effect.stateTickIntervalSec > 0 ? effect.stateTickIntervalSec : 1;
        inst.tickIntervalSec = interval;
        inst.nextTickAt = this.time + interval;
        inst.sourceUnitId = caster.unitId;
        inst.sourceSide = caster.side;
        inst.srcEffectRef = effect.rowId;
      }
      target.states.set(tag, inst);
      this.pushLog("state_apply", {
        actorId: caster.unitId,
        side: caster.side,
        targetIds: [target.unitId],
        effectRef: effect.rowId,
        stateTag: tag,
        ...stacks > 1 ? { stacks } : {}
        // 仅叠层时带字段：单层施加日志保持既有形状
      });
      return;
    }
    const simple = { tag, expireAt: this.time + duration };
    if (effect.applyUndispellable) simple.undispellable = true;
    if (tag === "taunt") simple.tauntedBy = caster.unitId;
    if (tag === "reflect") {
      if (effect.reflectPct !== void 0) simple.reflectPct = effect.reflectPct;
      if (effect.reflectAtkPct !== void 0) simple.reflectAtkPct = effect.reflectAtkPct;
      const base = (effect.reflectArmorPct ?? 0) * target.armor;
      if (base !== 0) simple.reflectBase = base;
      if (effect.blockPct !== void 0) simple.blockPct = effect.blockPct;
    }
    if (tag === "guard") {
      simple.guardProtect = effect.guardProtect ?? "backline";
      if (effect.guardCooldownSec !== void 0) simple.guardCooldownSec = effect.guardCooldownSec;
      simple.guardReadyAt = target.states.get("guard")?.guardReadyAt ?? 0;
      this.anyGuard = true;
    }
    if (tag === "share") {
      if (effect.sharePct !== void 0) simple.sharePct = effect.sharePct;
      simple.shareMode = effect.shareMode ?? "to_caster";
      if (simple.shareMode === "to_caster") simple.shareTargetId = caster.unitId;
    }
    if (tag === "aura") {
      simple.auraStat = effect.auraStat;
      if (effect.auraAmount !== void 0) simple.auraAmount = effect.auraAmount;
      simple.auraScope = effect.auraScope;
      simple.auraCondition = effect.auraCondition ?? "always";
      if (effect.auraScale !== void 0) simple.auraScale = effect.auraScale;
      this.anyAura = true;
    }
    if (tag === "blind" && effect.blindChance !== void 0) simple.blindChance = effect.blindChance;
    target.states.set(tag, simple);
    this.pushLog("state_apply", {
      actorId: caster.unitId,
      side: caster.side,
      targetIds: [target.unitId],
      effectRef: effect.rowId,
      stateTag: tag
    });
  }
  // ===== 召唤 =====
  /** 召唤 count 个 summonUnitRef 到 side 阵营空格，受 budget 与空格双重约束；找不到空格就少召，不报错不重试。
   *  ⑥8a 召唤生命周期包（source/effect 可选·全部字段缺省=旧行为）：记录召唤源、限时、随源消亡、同源场上上限。 */
  summonUnits(side, summonUnitRef, count, budget, note, source, effect) {
    if (summonUnitRef === "none") return;
    const stat = this.runtime.getById("battle_unit_stat_param", summonUnitRef);
    if (!stat) return;
    const sourceCap = effect?.summonSourceCap;
    const capTotal = sourceCap !== void 0 && source ? sourceCap + Math.floor(source.affixes.summonCapBonus) : Infinity;
    let aliveFromSource = 0;
    if (capTotal !== Infinity && source) {
      for (const u of this.units) if (u.alive && u.summonedBy === source.unitId) aliveFromSource += 1;
    }
    const summonMeta = {
      sourceId: source ? source.unitId : null,
      expireSec: effect?.summonExpireSec,
      despawnWithSource: effect?.despawnWithSource === true
    };
    const created = [];
    for (let i = 0; i < count; i += 1) {
      if (budget.remaining <= 0) break;
      if (aliveFromSource + created.length >= capTotal) break;
      const cell = this.findEmptyCell(side, stat.sizeRows, stat.sizeCols);
      if (!cell) break;
      const slot = side === "player" ? `p${cell.row}c${cell.col}` : `r${cell.row}c${cell.col}`;
      created.push(this.spawnUnit(stat, side, cell.row, cell.col, slot, null, summonMeta));
      budget.remaining -= 1;
    }
    if (created.length > 0) {
      this.pushLog("spawn_wave", { side, targetIds: created.map((u) => u.unitId), note });
    }
  }
  // ===== 目标选择 =====
  selectTargets(caster, tag, maxTargets, rangeLimit) {
    const targetSide = FRIENDLY_TAGS.has(tag) ? caster.side : opposite(caster.side);
    let candidates = this.units.filter((u) => u.side === targetSide && u.alive && u.hp > 0);
    if (rangeLimit !== void 0) {
      candidates = candidates.filter((u) => this.dist(caster, u) <= rangeLimit);
    }
    if (candidates.length === 0) return [];
    if (targetSide !== caster.side) {
      const forced = this.resolveTaunt(caster, candidates);
      if (forced) {
        const rest = sortBy(candidates.filter((u) => u !== forced), (u) => [this.dist(caster, u), u.unitId]);
        return [forced, ...rest].slice(0, maxTargets);
      }
    }
    switch (tag) {
      case "self_team":
        return this.orderSelfTeam(caster, candidates, maxTargets);
      case "lowest_hp_ally":
        return sortBy(candidates, (u) => [u.hp, u.unitId]).slice(0, maxTargets);
      case "backline_first":
        return this.orderBackline(caster, targetSide, candidates, maxTargets);
      case "column_line":
        return this.orderColumnLine(caster, candidates, maxTargets);
      case "marked_first":
        return sortBy(candidates, (u) => [u.states.has("mark") ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case "all_enemies":
        return sortBy(candidates, (u) => [this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      // ===== ⑥8a 驾驶员能力目标族（纯排序新枚举·旧配置不引用=行为不变）=====
      case "lowest_hp_enemy":
        return sortBy(candidates, (u) => [u.hp, u.unitId]).slice(0, maxTargets);
      case "highest_hp_enemy":
        return sortBy(candidates, (u) => [-u.hp, u.unitId]).slice(0, maxTargets);
      case "highest_attack_enemy":
        return sortBy(candidates, (u) => [-u.attack, u.unitId]).slice(0, maxTargets);
      case "highest_armor_enemy":
        return sortBy(candidates, (u) => [-u.armor, u.unitId]).slice(0, maxTargets);
      case "key_unit_first":
        return sortBy(candidates, (u) => [KEY_ROLE_TAGS.has(u.roleTag) ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case "lowhp_then_nearest":
        return sortBy(candidates, (u) => [u.maxHp > 0 && u.hp / u.maxHp < LOWHP_THRESHOLD ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case "debuffed_first":
        return sortBy(candidates, (u) => [DEBUFF_TAGS.some((d) => u.states.has(d)) ? 0 : 1, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case "first_column_first":
        return sortBy(candidates, (u) => [u.col, this.dist(caster, u), u.unitId]).slice(0, maxTargets);
      case "lock_until_dead": {
        let locked = candidates.find((u) => u.unitId === caster.lockedTargetId);
        if (!locked) {
          locked = this.pickNearest(caster, candidates, 1)[0];
          caster.lockedTargetId = locked ? locked.unitId : null;
        }
        if (!locked) return [];
        const rest = sortBy(candidates.filter((u) => u !== locked), (u) => [this.dist(caster, u), u.unitId]);
        return [locked, ...rest].slice(0, maxTargets);
      }
      case "cross_area":
        return this.orderArea(caster, candidates, maxTargets, "cross");
      case "block_area":
        return this.orderArea(caster, candidates, maxTargets, "block");
      // ===== ⑦机制批① 友方目标族（8a 如实交回件·随机制批补齐）=====
      case "highest_attack_ally":
        return sortBy(candidates, (u) => [-u.attack, u.unitId]).slice(0, maxTargets);
      case "no_buff_ally_first":
        return sortBy(candidates, (u) => [BUFF_TAGS.some((b) => u.states.has(b)) ? 1 : 0, u.unitId]).slice(0, maxTargets);
      case "most_debuffed_ally":
        return sortBy(candidates, (u) => [-DEBUFF_TAGS.filter((d) => u.states.has(d)).length, u.unitId]).slice(0, maxTargets);
      case "controlled_ally_first":
        return sortBy(candidates, (u) => [
          this.hasControl(u) || DEBUFF_TAGS.some((d) => u.states.has(d)) ? 0 : 1,
          u.hp,
          u.unitId
        ]).slice(0, maxTargets);
      // ===== ⑦机制批① 自身区域族（磐石「张盾」自己+相邻4格 / 船长「鼓动」周围）=====
      case "self_cross_area":
        return this.orderSelfArea(caster, candidates, maxTargets, "cross");
      case "self_block_area":
        return this.orderSelfArea(caster, candidates, maxTargets, "block");
      case "single_target":
      case "nearest_random_tie":
      default:
        return this.pickNearest(caster, candidates, maxTargets);
    }
  }
  /** ⑨机制批② M4 嘲讽解析：本单位持 taunt 态且嘲讽者仍在候选（存活/在射程/对方阵营）内 → 返回嘲讽者，否则 null（嘲讽自然失效走常规选目标）。 */
  resolveTaunt(caster, candidates) {
    const ts = caster.states.get("taunt");
    if (!ts || ts.tauntedBy === void 0) return null;
    return candidates.find((u) => u.unitId === ts.tauntedBy) ?? null;
  }
  /** ⑨机制批② M4 守护替挡：敌方伤害命中我方某友军时，若存在"就绪+保护该友军"的守护者(岩)→伤害转守护者并进其 CD；否则原目标。
   *  缺省本场无 guard 态（anyGuard=false）=整段跳过=逐字节不变。 */
  resolveGuard(attacker, target) {
    if (!this.anyGuard || target.side === attacker.side) return target;
    for (const g of this.units) {
      if (g === target || g.side !== target.side || !g.alive) continue;
      const gs = g.states.get("guard");
      if (!gs || (gs.guardReadyAt ?? 0) > this.time + 1e-9) continue;
      const protects = gs.guardProtect === "all" || this.isMoreBackline(target, g);
      if (!protects) continue;
      gs.guardReadyAt = this.time + (gs.guardCooldownSec ?? 0);
      return g;
    }
    return target;
  }
  /** a 是否比 b 更靠后排（同阵营·玩家列越小越靠后 / 敌方列越大越靠后）。 */
  isMoreBackline(a, b) {
    return a.side === "player" ? a.col < b.col : a.col > b.col;
  }
  /** ⑨机制批② M4 分摊·承接者解析：to_caster→施加者(存活/同阵营/非受方)；adjacent→相邻(3×3锚点)且同持 adjacent share 态的友军（援护链互摊网络）。 */
  resolveShareSharers(receiver, shareInst) {
    if (shareInst.shareMode === "to_caster") {
      const t = this.units.find((u) => u.unitId === shareInst.shareTargetId && u.alive && u.side === receiver.side && u !== receiver);
      return t ? [t] : [];
    }
    return this.units.filter((u) => u.side === receiver.side && u.alive && u !== receiver && this.isAdjacentCell(receiver, u) && u.states.get("share")?.shareMode === "adjacent");
  }
  /** 锚点格 3×3 相邻（切比雪夫距 ≤1·不含自身）。 */
  isAdjacentCell(a, b) {
    return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && !(a.row === b.row && a.col === b.col);
  }
  /** ⑨机制批② M4 分摊·把 shareTotal 均分给承接者（余数给前者）直扣不过甲；承接者死亡归攻击者(伤害源·镜像直伤击杀记账)。 */
  distributeShare(sharers, shareTotal, attacker) {
    const n = sharers.length;
    if (n === 0 || shareTotal <= 0) return;
    const base = Math.floor(shareTotal / n);
    let rem = shareTotal - base * n;
    for (const s of sharers) {
      const amt = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      if (amt <= 0) continue;
      s.hp -= amt;
      const dead = s.hp <= 0;
      if (dead) {
        s.hp = 0;
        s.alive = false;
      }
      this.pushLog("damage", {
        actorId: attacker.unitId,
        side: attacker.side,
        targetIds: [s.unitId],
        effectRef: "share",
        amount: amt,
        note: "share",
        hpAfter: s.hp,
        shieldAfter: s.shield
      });
      if (dead) {
        attacker.killedSinceTrigger = true;
        attacker.killedRolesSinceTrigger.push(s.roleTag);
        this.deadCount[s.side] += 1;
        this.accrueStackEvent(attacker, "kill");
      }
    }
  }
  /** ⑥8a 空间AoE：主目标=最近规则选 1，随后收其锚点格周围（十字4格/3×3）footprint 相交的单位。
   *  多格单位以锚点格为区域中心（v0 口径·记数值细表）；区域内按曼哈顿距主目标近→远、unitId 稳定排序。 */
  orderArea(caster, candidates, maxTargets, kind) {
    const primary = this.pickNearest(caster, candidates, 1)[0];
    if (!primary) return [];
    const pr = primary.row;
    const pc = primary.col;
    const cells = kind === "cross" ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]] : [
      [pr - 1, pc - 1],
      [pr - 1, pc],
      [pr - 1, pc + 1],
      [pr, pc - 1],
      [pr, pc],
      [pr, pc + 1],
      [pr + 1, pc - 1],
      [pr + 1, pc],
      [pr + 1, pc + 1]
    ];
    const inArea = (u) => {
      for (const [r, c] of cells) {
        if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
      }
      return false;
    };
    const others = sortBy(
      candidates.filter((u) => u !== primary && inArea(u)),
      (u) => [Math.abs(u.row - pr) + Math.abs(u.col - pc), u.unitId]
    );
    return [primary, ...others].slice(0, maxTargets);
  }
  /** ⑦机制批① 自身区域：以施加者锚点格为中心（十字4格/3×3），收 footprint 相交的己方单位；
   *  施加者永远第一位，其余按曼哈顿距中心近→远、unitId 稳定排序（与 orderArea 同口径）。 */
  orderSelfArea(caster, candidates, maxTargets, kind) {
    const pr = caster.row;
    const pc = caster.col;
    const cells = kind === "cross" ? [[pr, pc], [pr - 1, pc], [pr + 1, pc], [pr, pc - 1], [pr, pc + 1]] : [
      [pr - 1, pc - 1],
      [pr - 1, pc],
      [pr - 1, pc + 1],
      [pr, pc - 1],
      [pr, pc],
      [pr, pc + 1],
      [pr + 1, pc - 1],
      [pr + 1, pc],
      [pr + 1, pc + 1]
    ];
    const inArea = (u) => {
      for (const [r, c] of cells) {
        if (r >= u.row && r < u.row + u.sizeRows && c >= u.col && c < u.col + u.sizeCols) return true;
      }
      return false;
    };
    const others = sortBy(
      candidates.filter((u) => u !== caster && inArea(u)),
      (u) => [Math.abs(u.row - pr) + Math.abs(u.col - pc), u.unitId]
    );
    const ordered = candidates.includes(caster) ? [caster, ...others] : others;
    return ordered.slice(0, maxTargets);
  }
  /** 最近目标；同距离时标记优先，仍并列则用 seeded RNG 取一个。逐个选满 maxTargets。 */
  pickNearest(caster, candidates, maxTargets) {
    const pool = [...candidates];
    const selected = [];
    while (selected.length < maxTargets && pool.length > 0) {
      let minD = Infinity;
      for (const u of pool) minD = Math.min(minD, this.dist(caster, u));
      let tie = pool.filter((u) => this.dist(caster, u) === minD);
      const marked = tie.filter((u) => u.states.has("mark"));
      if (marked.length > 0) tie = marked;
      tie = sortBy(tie, (u) => [u.unitId]);
      const chosen = tie.length === 1 ? tie[0] : this.rng.pick(tie);
      selected.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }
    return selected;
  }
  orderSelfTeam(caster, candidates, maxTargets) {
    const others = sortBy(candidates.filter((u) => u !== caster), (u) => [u.unitId]);
    const ordered = candidates.includes(caster) ? [caster, ...others] : others;
    return ordered.slice(0, maxTargets);
  }
  orderBackline(caster, targetSide, candidates, maxTargets) {
    const rank = (u) => targetSide === "enemy" ? S7_ENEMY_COLS - 1 - u.col : u.col;
    return sortBy(candidates, (u) => [rank(u), this.dist(caster, u), u.unitId]).slice(0, maxTargets);
  }
  orderColumnLine(caster, candidates, maxTargets) {
    const nearest = this.pickNearest(caster, candidates, 1)[0];
    if (!nearest) return [];
    const targetCol = nearest.col;
    const inColumn = sortBy(
      candidates.filter((u) => occupiesColumn(u, targetCol)),
      (u) => [u.row, u.unitId]
    );
    const selected = [];
    const seen = /* @__PURE__ */ new Set();
    for (const u of inColumn) {
      if (selected.length >= maxTargets) break;
      selected.push(u);
      seen.add(u);
    }
    if (selected.length < maxTargets) {
      const rest = sortBy(candidates.filter((u) => !seen.has(u)), (u) => [this.dist(caster, u), u.unitId]);
      for (const u of rest) {
        if (selected.length >= maxTargets) break;
        selected.push(u);
      }
    }
    return selected;
  }
  // ===== 距离 =====
  /** caster 与 target 的格距（玩家格 vs 敌方格）。玩家列越大越靠前，敌方列越小越靠前。 */
  dist(caster, target) {
    const playerUnit = caster.side === "player" ? caster : target;
    const enemyUnit = caster.side === "player" ? target : caster;
    let best = Infinity;
    for (let pr = playerUnit.row; pr < playerUnit.row + playerUnit.sizeRows; pr += 1) {
      for (let pc = playerUnit.col; pc < playerUnit.col + playerUnit.sizeCols; pc += 1) {
        for (let er = enemyUnit.row; er < enemyUnit.row + enemyUnit.sizeRows; er += 1) {
          for (let ec = enemyUnit.col; ec < enemyUnit.col + enemyUnit.sizeCols; ec += 1) {
            const d = ec + 1 + (2 - pc) + Math.abs(pr - er);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }
  // ===== 单位 / 占格 =====
  spawnUnit(stat, side, row2, col, slotRef, derived = null, summonMeta) {
    const cv = derived ?? stat;
    const unitId = side === "player" ? `player_${slotRef}` : `enemy_${pad4(this.enemySeq++)}`;
    const triggers = [];
    if (cv.ultimateEffectRef !== "none" && stat.ultimateCdSec > 0) {
      triggers.push({ block: { kind: "trigger", on: "cd", cdSec: stat.ultimateCdSec, effectRef: cv.ultimateEffectRef }, nextFireAt: 0, fired: false });
    }
    if (derived) {
      for (const tb of derived.triggers) {
        triggers.push({ block: tb, nextFireAt: tb.on === "cd" ? tb.initialCdSec ?? 0 : 0, fired: false });
      }
    }
    if (stat.extraTriggerBlocks && stat.extraTriggerBlocks.length > 0) {
      for (const tb of stat.extraTriggerBlocks) {
        triggers.push({ block: tb, nextFireAt: tb.on === "cd" ? tb.initialCdSec ?? 0 : 0, fired: false });
      }
    }
    const stackRules = [];
    for (const rule of [...derived?.stackRules ?? [], ...stat.stackRules ?? []]) {
      stackRules.push({
        rule,
        stacks: 0,
        nextAccrueAt: rule.on === "per_second" ? this.time + 1 : Infinity,
        lastEventAt: this.time,
        trackedTargetId: null
      });
    }
    let affixes = derived ? derived.affixes : ZERO_AFFIXES;
    if (!derived && ((stat.controlResist ?? 0) !== 0 || (stat.baseCritRate ?? 0) !== 0 || (stat.baseCritDmg ?? 0) !== 0)) {
      affixes = Object.freeze({
        ...ZERO_AFFIXES,
        controlResist: stat.controlResist ?? 0,
        critRate: stat.baseCritRate ?? 0,
        critDmg: stat.baseCritDmg ?? 0
      });
    }
    const unit = {
      unitId,
      side,
      unitStatRef: stat.rowId,
      slotRef,
      row: row2,
      col,
      sizeRows: cv.sizeRows,
      sizeCols: cv.sizeCols,
      maxHp: cv.maxHp,
      hp: cv.maxHp,
      attack: cv.attack,
      baseAttack: cv.attack,
      // ⑨M9 贪吃星累积基数
      armor: cv.armor,
      attackIntervalSec: cv.attackIntervalSec,
      attackRangeCells: cv.attackRangeCells,
      passiveEnergyPerSec: cv.passiveEnergyPerSec,
      nextAttackAt: 0,
      alive: true,
      downLogged: false,
      isBoss: stat.targetType === "boss",
      bossNodeId: stat.targetType === "boss" ? stat.unitRef : null,
      normalEffectRef: cv.normalEffectRef,
      ultimateEffectRef: cv.ultimateEffectRef,
      coreEffectRef: cv.coreEffectRef,
      targetingTag: cv.targetingTag,
      coreTriggered: false,
      triggers,
      hitSinceTrigger: false,
      killedSinceTrigger: false,
      shieldBrokenSinceTrigger: false,
      attackLandedSinceTrigger: false,
      killedRolesSinceTrigger: [],
      skillCastSinceTrigger: false,
      stackRules,
      shield: 0,
      states: /* @__PURE__ */ new Map(),
      affixes,
      roleTag: stat.roleTag,
      lockedTargetId: null,
      summonedBy: summonMeta ? summonMeta.sourceId : null,
      summonExpireAt: summonMeta && summonMeta.expireSec !== void 0 && summonMeta.expireSec > 0 ? this.time + summonMeta.expireSec : null,
      despawnWithSource: summonMeta ? summonMeta.despawnWithSource : false
    };
    this.occupy(unit);
    this.units.push(unit);
    return unit;
  }
  canPlace(side, row2, col, sizeRows, sizeCols) {
    const rows = side === "player" ? S7_PLAYER_ROWS : S7_ENEMY_ROWS;
    const cols = side === "player" ? S7_PLAYER_COLS : S7_ENEMY_COLS;
    const occ = side === "player" ? this.playerCells : this.enemyCells;
    if (row2 < 0 || col < 0 || row2 + sizeRows > rows || col + sizeCols > cols) return false;
    for (let r = row2; r < row2 + sizeRows; r += 1) {
      for (let c = col; c < col + sizeCols; c += 1) {
        if (occ.has(cellKey(r, c))) return false;
      }
    }
    return true;
  }
  findEmptyCell(side, sizeRows, sizeCols) {
    const rows = side === "player" ? S7_PLAYER_ROWS : S7_ENEMY_ROWS;
    const cols = side === "player" ? S7_PLAYER_COLS : S7_ENEMY_COLS;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (this.canPlace(side, r, c, sizeRows, sizeCols)) return { row: r, col: c };
      }
    }
    return null;
  }
  occupy(unit) {
    const occ = unit.side === "player" ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.add(cellKey(r, c));
    }
  }
  freeCells(unit) {
    const occ = unit.side === "player" ? this.playerCells : this.enemyCells;
    for (let r = unit.row; r < unit.row + unit.sizeRows; r += 1) {
      for (let c = unit.col; c < unit.col + unit.sizeCols; c += 1) occ.delete(cellKey(r, c));
    }
  }
  countAliveEnemies() {
    let n = 0;
    for (const u of this.units) if (u.side === "enemy" && u.alive) n += 1;
    return n;
  }
  // ===== 小工具 =====
  canAct(unit) {
    return unit.alive && unit.hp > 0 && !this.hasControl(unit);
  }
  hasControl(unit) {
    for (const tag of CONTROL_TAGS) if (unit.states.has(tag)) return true;
    return false;
  }
  /** ⑦机制批①：读取一个 M1 框架状态的当前总幅度（每层幅度×层数）；无该状态或旧 tag 未带参数=0。 */
  stateModSum(unit, tag) {
    const st = unit.states.get(tag);
    if (!st || st.amountPerStack === void 0) return 0;
    return st.amountPerStack * (st.stacks ?? 1);
  }
  /** ⑦M3：一条叠层规则的即时层数（hp_lost_decile=按已损血量每 10% 一层派生·动态涨落；其余=事件累积值）。 */
  ruleStacksOf(unit, r) {
    if (r.rule.on === "hp_lost_decile") {
      if (unit.maxHp <= 0) return 0;
      const derived = Math.floor((1 - unit.hp / unit.maxHp) * 10 + 1e-9);
      return Math.max(0, Math.min(r.rule.maxStacks ?? Infinity, derived));
    }
    return r.stacks;
  }
  /** ⑦M3：单位在某数值轴上的叠层规则总幅度（Σ 层数×每层幅度）；无规则单位=空循环和 0（行为不变）。 */
  ruleStatSum(unit, stat) {
    let sum = 0;
    for (const r of unit.stackRules) {
      if (r.rule.stat !== stat) continue;
      if (r.rule.breakOn === "target_switch") this.syncTrackedTarget(unit, r);
      sum += this.ruleStacksOf(unit, r) * r.rule.perStack;
    }
    return sum;
  }
  /** ⑦M3：target_switch 断档——锁定目标变更时按断档动作处理层数（源「专注」=清空）。 */
  syncTrackedTarget(unit, r) {
    if (r.trackedTargetId === unit.lockedTargetId) return;
    r.stacks = r.rule.breakAction === "decay_1" ? Math.max(0, r.stacks - 1) : 0;
    r.trackedTargetId = unit.lockedTargetId;
  }
  /** ⑦M3：事件累积（伤害结算/触发处直接调·即时生效于下一次结算读取；无规则单位零循环）。 */
  accrueStackEvent(unit, event) {
    for (const r of unit.stackRules) {
      if (r.rule.on !== event) continue;
      if (r.rule.breakOn === "target_switch") this.syncTrackedTarget(unit, r);
      r.stacks = Math.min(r.rule.maxStacks ?? Infinity, r.stacks + 1);
      r.lastEventAt = this.time;
    }
  }
  /** ⑨机制批② M6：unit 从所有存活光环源收到的某轴总幅度（在场即生效·退场撤销·动态重算）；无光环=0（anyAura 门=行为不变）。 */
  auraSum(unit, stat) {
    if (!this.anyAura) return 0;
    let sum = 0;
    for (const src of this.units) {
      if (!src.alive) continue;
      const a = src.states.get("aura");
      if (!a || a.auraStat !== stat) continue;
      if (!this.auraInScope(src, unit, a.auraScope)) continue;
      if (!this.auraConditionMet(src, a)) continue;
      let amt = a.auraAmount ?? 0;
      if (a.auraScale === "per_lowhp_ally") amt *= this.lowhpAllyCount(src);
      sum += amt;
    }
    return sum;
  }
  /** 光环范围判定：self=仅源自身 / team=同阵营全体 / cross=源自己+十字4格 / block=源自己+3×3。 */
  auraInScope(src, unit, scope) {
    const s = scope ?? "team";
    if (s === "self") return unit === src;
    if (unit.side !== src.side) return false;
    if (s === "team") return true;
    if (unit === src) return true;
    const dr = Math.abs(unit.row - src.row);
    const dc = Math.abs(unit.col - src.col);
    return s === "cross" ? dr + dc === 1 : dr <= 1 && dc <= 1;
  }
  /** 光环条件门：always / has_summon（本源有存活召唤物·哨卫联防）/ no_enemy_summon（无敌方召唤物存活·空5★）。 */
  auraConditionMet(src, a) {
    if (a.auraCondition === "has_summon") return this.units.some((u) => u.alive && u.summonedBy === src.unitId);
    if (a.auraCondition === "no_enemy_summon") return !this.units.some((u) => u.alive && u.side !== src.side && u.summonedBy !== null);
    return true;
  }
  /** 残血友军数（同阵营存活·血<30%·不含自身·沧坚壁 per_lowhp_ally 缩放用）。 */
  lowhpAllyCount(src) {
    let n = 0;
    for (const u of this.units) {
      if (u === src || u.side !== src.side || !u.alive) continue;
      if (u.maxHp > 0 && u.hp / u.maxHp < LOWHP_THRESHOLD) n += 1;
    }
    return n;
  }
  /** 生效攻击：berserk 特例保持原码原样（×1.25），M1 加攻/虚弱 + M3 叠层攻击轴在其外乘法合成；
   *  和为 0 时直接走原路径返回（浮点逐字节不变）。加攻/虚弱只进伤害口径，治疗/护盾量走基础攻（与 berserk 现状同口径）。 */
  effAttack(unit) {
    const base = unit.states.has("berserk") ? unit.attack * BERSERK_ATTACK_MULT : unit.attack;
    const pct = this.stateModSum(unit, "atk_up") - this.stateModSum(unit, "atk_down") + this.ruleStatSum(unit, "atkPct");
    return pct === 0 ? base : base * Math.max(0, 1 + pct);
  }
  /** 生效普攻间隔：berserk 特例保持原码原样（×0.8），M1 加攻速/减速 + M3 叠层攻速轴在其外按 间隔/(1+攻速和) 合成；
   *  分母钳到 ≥0.1（极限减速也最多把间隔拉长 10 倍）；和为 0 时走原路径（浮点逐字节不变）。 */
  effInterval(unit) {
    const base = unit.states.has("berserk") ? unit.attackIntervalSec * BERSERK_INTERVAL_MULT : unit.attackIntervalSec;
    const spd = this.stateModSum(unit, "atk_speed_up") - this.stateModSum(unit, "atk_speed_down") + this.ruleStatSum(unit, "atkSpeedPct") + this.auraSum(unit, "atkSpeedPct");
    return spd === 0 ? base : base / Math.max(0.1, 1 + spd);
  }
  /** 全体单位的稳定遍历顺序：先 side 后 unitId，保证同 seed 处理/日志顺序固定。 */
  stableUnits() {
    return sortBy([...this.units], (u) => [u.side, u.unitId]);
  }
  pushLog(type, fields) {
    this.log.push({ timeSec: this.time, type, ...fields });
  }
  buildFinalState(durationSec) {
    const snap = (u) => ({
      unitId: u.unitId,
      side: u.side,
      unitStatRef: u.unitStatRef,
      slotRef: u.slotRef,
      hp: u.hp,
      maxHp: u.maxHp,
      shield: u.shield,
      alive: u.alive
    });
    return {
      durationSec,
      players: this.units.filter((u) => u.side === "player").map(snap),
      enemies: this.units.filter((u) => u.side === "enemy").map(snap)
    };
  }
};
function opposite(side) {
  return side === "player" ? "enemy" : "player";
}
function cellKey(row2, col) {
  return `${row2},${col}`;
}
function pad4(n) {
  return String(n).padStart(4, "0");
}
function roundTime(t) {
  return Math.round(t * 1e6) / 1e6;
}
var ENEMY_SLOT_PATTERN = new RegExp(`^r[0-${S7_ENEMY_ROWS - 1}]c[0-${S7_ENEMY_COLS - 1}]$`);
function parseEnemySlot(slot) {
  if (typeof slot !== "string" || !ENEMY_SLOT_PATTERN.test(slot)) return null;
  return { row: Number(slot[1]), col: Number(slot[3]) };
}
function baseStatOf(stat) {
  return {
    maxHp: stat.maxHp,
    attack: stat.attack,
    armor: stat.armor,
    attackIntervalSec: stat.attackIntervalSec,
    attackRangeCells: stat.attackRangeCells,
    passiveEnergyPerSec: stat.passiveEnergyPerSec,
    sizeRows: stat.sizeRows,
    sizeCols: stat.sizeCols,
    targetingTag: stat.targetingTag,
    normalEffectRef: stat.normalEffectRef,
    ultimateEffectRef: stat.ultimateEffectRef,
    coreEffectRef: stat.coreEffectRef
  };
}
function occupiesColumn(unit, col) {
  return col >= unit.col && col < unit.col + unit.sizeCols;
}
function groupOrdered(refs) {
  const order = [];
  const counts = /* @__PURE__ */ new Map();
  for (const ref of refs) {
    if (!counts.has(ref)) order.push(ref);
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return order.map((ref) => ({ ref, count: counts.get(ref) ?? 0 }));
}
function sortBy(items, keyFn) {
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
      const va = ka[i];
      const vb = kb[i];
      if (va === vb) continue;
      if (va === void 0) return -1;
      if (vb === void 0) return 1;
      return va < vb ? -1 : 1;
    }
    return 0;
  });
}

// assets/scripts/core/s7/S7PilotEffects.ts
function nodeValue(level, tiers) {
  let out;
  for (const [lv, v] of tiers) {
    if (level >= lv) out = v;
  }
  return out;
}
function stack(rule, source) {
  return { kind: "stack", rule: { ...rule, source }, source };
}
var BUILDERS = {
  // ===== 突击组（pil01-04）=====
  pil01: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "lowest_hp_enemy", source: "pil01" }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.02], [20, 0.03], [40, 0.04]]);
      const cap = nodeValue(lv, [[1, 3], [60, 4], [80, 5]]);
      b.push(stack({
        ruleId: "pil01_overheat",
        on: "attack_landed",
        stat: "dmgUpPct",
        perStack: per,
        maxStacks: cap,
        breakOn: "attack_gap",
        breakGapSec: 2.5,
        breakAction: lv >= 100 ? "decay_1" : "clear"
      }, "pil01"));
    }
    return b;
  },
  pil02: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "backline_first", source: "pil02" }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.4], [40, 0.5], [60, 0.6]]);
      b.push({ kind: "affix", affix: "dmgVsLowHp", value: v, source: "pil02" });
    }
    return b;
  },
  pil03: (lv, star) => {
    const b = [{ kind: "behavior", targetingTag: "lowhp_then_nearest", source: "pil03" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_cdr_15"], [20, "eff_pil_cdr_20"], [40, "eff_pil_cdr_25"], [60, "eff_pil_cdr_30"], [80, "eff_pil_cdr_35"], [100, "eff_pil_cdr_40"]]);
      b.push({ kind: "trigger", on: "on_kill", effectRef: eff, source: "pil03" });
    }
    if (star >= 3) {
      b.push(stack({ ruleId: "pil03_chain_haste", on: "kill", stat: "atkSpeedPct", perStack: 0.1, breakOn: "attack_gap", breakGapSec: 4, breakAction: "clear" }, "pil03"));
    }
    return b;
  },
  pil04: (lv, star) => {
    const b = [{ kind: "behavior", targetingTag: "key_unit_first", source: "pil04" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_zhe_dmgup"], [20, "eff_pil_zhe_dmgup_l20"], [40, "eff_pil_zhe_dmgup_l40"], [60, "eff_pil_zhe_dmgup_l60"], [80, "eff_pil_zhe_dmgup_l80"], [100, "eff_pil_zhe_dmgup_l100"]]);
      b.push({ kind: "trigger", on: "on_kill", onKillRoleTags: ["support", "summon_source"], effectRef: eff, source: "pil04" });
    }
    if (star >= 3) {
      b.push({ kind: "trigger", on: "on_kill", onKillRoleTags: ["support", "summon_source"], effectRef: "eff_pil_cdr_20", source: "pil04" });
    }
    return b;
  },
  // ===== 护卫组（pil05-08）=====
  pil05: (lv) => {
    const guardEff = nodeValue(lv, [[0, "eff_pil_yan_guard"], [20, "eff_pil_yan_guard_l20"], [100, "eff_pil_yan_guard_l100"]]);
    const b = [{ kind: "trigger", on: "battle_start", effectRef: guardEff, source: "pil05" }];
    if (lv >= 1) {
      const reflectEff = nodeValue(lv, [[1, "eff_pil_yan_reflect"], [40, "eff_pil_yan_reflect_l40"], [60, "eff_pil_yan_reflect_l60"], [80, "eff_pil_yan_reflect_l80"]]);
      b.push({ kind: "trigger", on: "battle_start", effectRef: reflectEff, source: "pil05" });
    }
    return b;
  },
  pil06: (lv) => {
    const tauntEff = nodeValue(lv, [[0, "eff_pil_li_taunt"], [20, "eff_pil_li_taunt_l20"], [80, "eff_pil_li_taunt_l80"]]);
    const b = [{ kind: "trigger", on: "cd", cdSec: 3, effectRef: tauntEff, source: "pil06" }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.03], [40, 0.04], [60, 0.05]]);
      b.push(stack({ ruleId: "pil06_resolve", on: "hp_lost_decile", stat: "dmgTakenDownPct", perStack: per }, "pil06"));
    }
    return b;
  },
  pil07: (lv, star) => {
    const b = [];
    if (lv >= 1) {
      const eff = star >= 3 ? "eff_pil_yue_thorns_s3" : nodeValue(lv, [[1, "eff_pil_yue_thorns"], [20, "eff_pil_yue_thorns_l20"], [60, "eff_pil_yue_thorns_l60"], [80, "eff_pil_yue_thorns_l80"], [100, "eff_pil_yue_thorns_l100"]]);
      b.push({ kind: "trigger", on: "battle_start", effectRef: eff, source: "pil07" });
    }
    return b;
  },
  pil08: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "controlled_ally_first", source: "pil08" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_cang_aura"], [20, "eff_pil_cang_aura_l20"], [60, "eff_pil_cang_aura_l60"], [80, "eff_pil_cang_aura_l80"]]);
      b.push({ kind: "trigger", on: "battle_start", effectRef: eff, source: "pil08" });
      if (lv >= 40) b.push({ kind: "affix", affix: "shieldPower", value: 0.15, source: "pil08" });
    }
    return b;
  },
  // ===== 炮击组（pil09-12）=====
  pil09: (lv, star) => {
    const b = [{ kind: "behavior", targetingTag: "lock_until_dead", source: "pil09" }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.03], [40, 0.04], [80, 0.05]]);
      const capPct = nodeValue(lv, [[1, 0.3], [20, 0.4], [60, 0.5], [100, 0.6]]);
      const rule = {
        ruleId: "pil09_focus",
        on: "per_second",
        stat: "dmgVsLockedPct",
        perStack: per,
        maxStacks: Math.round(capPct / per)
        // 上限档=层数量子化（如 0.40/0.03→13 层=39%·±1pp 记 §13）
      };
      if (star < 3) {
        rule.breakOn = "target_switch";
        rule.breakAction = "clear";
      }
      b.push(stack(rule, "pil09"));
    }
    return b;
  },
  pil10: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "highest_hp_enemy", source: "pil10" }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.25], [20, 0.35], [60, 0.45], [80, 0.55]]);
      b.push({ kind: "affix", affix: "dmgVsHighHp", value: v, source: "pil10" });
    }
    return b;
  },
  pil11: (lv, star) => {
    const b = [{ kind: "behavior", targetingTag: "first_column_first", source: "pil11" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_xiao_vanguard"], [20, "eff_pil_xiao_vanguard_l20"], [40, "eff_pil_xiao_vanguard_l40"], [60, "eff_pil_xiao_vanguard_l60"], [80, "eff_pil_xiao_vanguard_l80"], [100, "eff_pil_xiao_vanguard_l100"]]);
      b.push({ kind: "trigger", on: "battle_start", effectRef: eff, source: "pil11" });
    }
    if (star >= 3 && lv >= 1) {
      b.push({ kind: "trigger", on: "battle_start", effectRef: "eff_pil_xiao_s3_haste", source: "pil11" });
    }
    return b;
  },
  pil12: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "highest_attack_enemy", source: "pil12" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_ling_asu"], [20, "eff_pil_ling_asu_l20"], [40, "eff_pil_ling_asu_l40"], [60, "eff_pil_ling_asu_l60"], [80, "eff_pil_ling_asu_l80"], [100, "eff_pil_ling_asu_l100"]]);
      b.push({ kind: "trigger", on: "on_kill", effectRef: eff, source: "pil12" });
    }
    return b;
  },
  // ===== 支援组（pil13-16）=====
  pil13: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "lowest_hp_ally", source: "pil13" }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.3], [20, 0.45], [60, 0.6]]);
      b.push({ kind: "affix", affix: "healVsLowHp", value: v, source: "pil13" });
    }
    return b;
  },
  pil14: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "highest_attack_ally", source: "pil14" }];
    if (lv >= 40) b.push({ kind: "affix", affix: "durationPct", value: 0.25, source: "pil14" });
    return b;
  },
  pil15: () => {
    return [{ kind: "behavior", targetingTag: "no_buff_ally_first", source: "pil15" }];
  },
  pil16: () => {
    return [{ kind: "behavior", targetingTag: "most_debuffed_ally", source: "pil16" }];
  },
  // ===== 工程组（pil17-20）=====
  pil17: () => {
    return [{ kind: "behavior", targetingTag: "debuffed_first", source: "pil17" }];
  },
  pil18: (lv, star) => {
    const b = [{ kind: "behavior", targetingTag: "key_unit_first", source: "pil18" }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, "eff_pil_cdr_15"], [20, "eff_pil_cdr_20"], [60, "eff_pil_cdr_25"], [80, "eff_pil_cdr_30"]]);
      b.push({ kind: "trigger", on: "on_kill", onKillRoleTags: ["summon_source"], effectRef: eff, source: "pil18" });
    }
    if (star >= 5) {
      b.push({ kind: "trigger", on: "battle_start", effectRef: "eff_pil_kong_s5_aura", source: "pil18" });
    }
    return b;
  },
  pil19: (lv, star) => {
    const b = [];
    if (lv >= 1) {
      b.push({ kind: "affix", affix: "summonCapBonus", value: nodeValue(lv, [[1, 1], [40, 2]]), source: "pil19" });
      b.push({ kind: "affix", affix: "skillHaste", value: nodeValue(lv, [[1, 0.2], [60, 0.3]]), source: "pil19" });
    }
    if (star >= 5) {
      b.push({ kind: "trigger", on: "battle_start", effectRef: "eff_pil_xun_s5_aura", source: "pil19" });
    }
    return b;
  },
  pil20: (lv) => {
    const b = [{ kind: "behavior", targetingTag: "highest_armor_enemy", source: "pil20" }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.2], [20, 0.3], [60, 0.35], [80, 0.4]]);
      b.push({ kind: "affix", affix: "armorPen", value: v, source: "pil20" });
      if (lv >= 100) b.push({ kind: "modifier", stat: "attack", op: "pct", value: 0.08, source: "pil20" });
    }
    return b;
  }
};
function pilotBlocks(pilotId, pilotLevel = 0, pilotStar = 1) {
  const build = BUILDERS[pilotId];
  if (!build) return [];
  const lv = Math.max(0, Math.floor(pilotLevel));
  const star = Math.max(1, Math.min(5, Math.floor(pilotStar)));
  return build(lv, star);
}

// tests/s7_pilot_talents.test.ts
var S7_DIR = import_node_path.default.resolve(__dirname, "..", "assets", "resources", "configs", "s7");
function loadBundle() {
  const b = {};
  for (const t of Object.keys(S7_TABLE_FILES)) {
    b[t] = JSON.parse((0, import_node_fs.readFileSync)(import_node_path.default.join(S7_DIR, `${t}.sample.json`), "utf-8"));
  }
  return b;
}
var clone = (b) => JSON.parse(JSON.stringify(b));
function row(b, table, rowId) {
  const r = b[table].find((x) => x.rowId === rowId);
  if (!r) throw new Error(`\u7F3A ${table}.${rowId}`);
  return r;
}
function rig(opts) {
  const b = clone(loadBundle());
  Object.assign(row(b, "battle_unit_stat_param", "bu_ship_gunner"), {
    ultimateEffectRef: "none",
    ultimateCdSec: 0,
    coreEffectRef: "none",
    normalEffectRef: "eff_basic_attack",
    attackRangeCells: 99,
    maxHp: 1e6,
    armor: 0,
    attack: 100,
    attackIntervalSec: 1,
    targetingTag: "nearest_random_tie"
  });
  Object.assign(row(b, "battle_unit_stat_param", "bu_ship_vanguard"), {
    ultimateEffectRef: "none",
    ultimateCdSec: 0,
    coreEffectRef: "none",
    normalEffectRef: "eff_basic_attack",
    attackRangeCells: 99,
    maxHp: 1e6,
    armor: 0,
    attack: 100,
    attackIntervalSec: 1,
    targetingTag: "nearest_random_tie"
  });
  Object.assign(row(b, "battle_unit_stat_param", "bu_enemy_swarm"), {
    maxHp: 1e8,
    attack: 1,
    armor: 0,
    sizeRows: 1,
    sizeCols: 1,
    attackIntervalSec: 1,
    attackRangeCells: 99,
    targetingTag: "nearest_random_tie",
    ultimateEffectRef: "none",
    ultimateCdSec: 0,
    coreEffectRef: "none",
    ...opts.enemyA
  });
  Object.assign(row(b, "battle_unit_stat_param", "bu_enemy_boss_add"), {
    maxHp: 1e8,
    attack: 1,
    armor: 0,
    sizeRows: 1,
    sizeCols: 1,
    attackIntervalSec: 1,
    attackRangeCells: 99,
    targetingTag: "nearest_random_tie",
    ultimateEffectRef: "none",
    ultimateCdSec: 0,
    coreEffectRef: "none",
    ...opts.enemyB ?? {}
  });
  Object.assign(row(b, "battle_encounter_param", "enc_n001"), { enemyUnitStatRefs: ["bu_enemy_swarm", "bu_enemy_boss_add"], spawnPlanRefs: ["spawn_n001_w1", "spawn_n001_w2"] });
  Object.assign(row(b, "battle_spawn_param", "spawn_n001_w1"), { unitStatRef: "bu_enemy_swarm", count: 1, slotRefs: ["r0c0"], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  Object.assign(row(b, "battle_spawn_param", "spawn_n001_w2"), { unitStatRef: "bu_enemy_boss_add", count: opts.enemyB ? 1 : 0, slotRefs: ["r0c6"], spawnDelaySec: 0, maxConcurrentOnField: 2 });
  return b;
}
var engineOf = async (b) => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
function dmgEvents(log) {
  return log.filter((e) => e.type === "damage").map((e) => ({
    source: String(e.sourceUnitId ?? ""),
    target: String(e.targetUnitId ?? ""),
    amount: Number(e.amount ?? NaN)
  }));
}
(0, import_vitest.describe)("\u2469A1-\u6218\u6597\u7EA7\u624B\u63A8 \xB7 \u86F0\u300C\u65A9\u94FE\u300D\u6740\u5173\u952E\u5355\u4F4D\u2192\u5168\u961F\u589E\u4F24\uFF08M1+onKillRoleTags \u63A5\u7EBF\uFF09", () => {
  const run = async (victimRole) => {
    const b = rig({
      enemyA: { maxHp: 1, roleTag: victimRole, attack: 1 },
      // 一击必杀的"关键单位"载体
      enemyB: { maxHp: 1e8, roleTag: "boss_add" }
      // 记录靶
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: "enc_n001",
      battleSeed: "zhe",
      playerUnits: [{ unitStatRef: "bu_ship_gunner", slotRef: "p1c1", effectBlocks: [...pilotBlocks("pil04", 1)] }]
    });
    return dmgEvents(r.log).filter((d) => d.source === "player_p1c1" && d.amount > 1).map((d) => d.amount);
  };
  (0, import_vitest.it)("\u6740 support \u2192 \u540E\u7EED\u4F24\u5BB3 100\u2192115\uFF08\u65A9\u94FE +15%\xB7\xA713 \u624B\u63A8\uFF09\uFF1B\u6740 swarm \u2192 \u5168\u7A0B 100\uFF08\u89D2\u8272\u8FC7\u6EE4\u771F\u62E6\u622A\uFF09", async () => {
    const hitsSupport = await run("support");
    (0, import_vitest.expect)(hitsSupport).toContain(115);
    (0, import_vitest.expect)(hitsSupport[0]).toBe(100);
    const hitsSwarm = await run("swarm");
    (0, import_vitest.expect)(hitsSwarm.every((a) => a === 100)).toBe(true);
  });
});
(0, import_vitest.describe)("\u2469A1-\u6218\u6597\u7EA7\u624B\u63A8 \xB7 \u783A\u6301\u7EED\u5632\u8BBD\uFF08cd \u89E6\u53D1\u53CD\u590D apply_state \u63A5\u7EBF\xB7\u2468M4 \u5B9A\u5F0F\uFF09", () => {
  const firstTargetOf = async (withLi) => {
    const b = rig({ enemyA: { attack: 100, targetingTag: "backline_first", maxHp: 1e8 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: "enc_n001",
      battleSeed: "li",
      playerUnits: [
        { unitStatRef: "bu_ship_vanguard", slotRef: "p2c2", ...withLi ? { effectBlocks: [...pilotBlocks("pil06", 0)] } : {} },
        // 前排=砺舰（Lv0=能力即生效）
        { unitStatRef: "bu_ship_gunner", slotRef: "p0c0" }
        // 后排=被点名对象
      ]
    });
    const first = dmgEvents(r.log).find((d) => d.source === "enemy_0000");
    return first?.target ?? "none";
  };
  (0, import_vitest.it)("\u65E0\u783A\uFF1A\u70B9\u540D\u654C\u6253\u540E\u6392 p0c0\uFF1B\u5E26\u783A(Lv0)\uFF1A\u88AB\u5632\u8BBD\u62C9\u53BB\u6253\u524D\u6392 p2c2\u2014\u2014\u80FD\u529B\u8D77\u624B\u5373\u751F\u6548", async () => {
    (0, import_vitest.expect)(await firstTargetOf(false)).toBe("player_p0c0");
    (0, import_vitest.expect)(await firstTargetOf(true)).toBe("player_p2c2");
  });
});
(0, import_vitest.describe)("\u2469A1-\u6218\u6597\u7EA7\u624B\u63A8 \xB7 \u5CA9\u5B88\u62A4+\u53CD\u9707\uFF08guard \u66FF\u6321 + \u683C\u6321/\u53CD\u5F39\u6570\u5B57\xB7\xA713 v0\uFF09", () => {
  (0, import_vitest.it)("\u540E\u6392 100 \u4F24\u88AB\u66FF\u6321\uFF1A\u5CA9\u627F\u4F24 90\uFF08\u683C\u632110%\uFF09\xB7\u653B\u51FB\u8005\u88AB\u53CD\u5F39 36\uFF08=90\xD740%\uFF09\xB7\u5B88\u62A4 CD2s \u671F\u95F4\u6F0F\u51FB\u843D\u56DE\u540E\u6392 100", async () => {
    const b = rig({ enemyA: { attack: 100, targetingTag: "backline_first", maxHp: 1e8, attackIntervalSec: 1 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: "enc_n001",
      battleSeed: "yan",
      playerUnits: [
        { unitStatRef: "bu_ship_vanguard", slotRef: "p2c2", effectBlocks: [...pilotBlocks("pil05", 1)] },
        // 岩：守护(能力)+反震(Lv1)
        { unitStatRef: "bu_ship_gunner", slotRef: "p0c0" }
      ]
    });
    const dmg = dmgEvents(r.log);
    const onYan = dmg.filter((d) => d.source === "enemy_0000" && d.target === "player_p2c2").map((d) => d.amount);
    const onBack = dmg.filter((d) => d.source === "enemy_0000" && d.target === "player_p0c0").map((d) => d.amount);
    const reflected = dmg.filter((d) => d.source === "player_p2c2" && d.target === "enemy_0000" && d.amount === 36);
    (0, import_vitest.expect)(onYan).toContain(90);
    (0, import_vitest.expect)(onBack).toContain(100);
    (0, import_vitest.expect)(reflected.length).toBeGreaterThan(0);
  });
});
(0, import_vitest.describe)("\u2469A1-\u6218\u6597\u7EA7\u624B\u63A8 \xB7 \u6E90\u300C\u4E13\u6CE8\u300D3\u2605 \u7EE7\u627F\u8D28\u53D8\uFF08M3 dmgVsLockedPct + target_switch \u65AD\u6761\u4EF6\u6620\u5C04\uFF09", () => {
  const firstHitOnB = async (star) => {
    const b = rig({
      enemyA: { maxHp: 150, attack: 1 },
      // 先锁定并击杀的目标
      enemyB: { maxHp: 1e8, attack: 1 }
      // 换锁后的目标
    });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: "enc_n001",
      battleSeed: "yuan",
      playerUnits: [{ unitStatRef: "bu_ship_gunner", slotRef: "p1c1", effectBlocks: [...pilotBlocks("pil09", 1, star)] }]
    });
    const hit = dmgEvents(r.log).find((d) => d.source === "player_p1c1" && d.target === "enemy_0001");
    return hit?.amount ?? NaN;
  };
  (0, import_vitest.it)("\u57FA\u5EA7\uFF1A\u6740\u9501\u5B9A\u76EE\u6807\u6362\u9501\u6E05\u7A7A\u4E13\u6CE8\uFF08\u9996\u51FB\u2248\u57FA\u7840\u503C\uFF09\uFF1B3\u2605\uFF1A\u52A0\u6210\u7EE7\u627F\u7ED9\u4E0B\u4E00\u4E2A\u76EE\u6807\uFF08\u9996\u51FB>\u57FA\u5EA7\uFF09", async () => {
    const base = await firstHitOnB(1);
    const s3 = await firstHitOnB(3);
    (0, import_vitest.expect)(s3).toBeGreaterThan(base);
    (0, import_vitest.expect)(base).toBeLessThanOrEqual(110);
  });
});
(0, import_vitest.describe)("\u2469A1-\u6218\u6597\u7EA7\u624B\u63A8 \xB7 \u9A81\u300C\u5148\u950B\u300D\u5F00\u6218\u7A97\u53E3 + Lv0 \u7F3A\u7701\u65E0\u5929\u8D4B\uFF08\u56DE\u6267\u2464\u5B88\u536B\uFF09", () => {
  const hitsOf = async (lv) => {
    const b = rig({ enemyA: { maxHp: 1e8, attack: 1 } });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: "enc_n001",
      battleSeed: "xiao",
      playerUnits: [{ unitStatRef: "bu_ship_gunner", slotRef: "p1c1", effectBlocks: [...pilotBlocks("pil11", lv)] }]
    });
    return dmgEvents(r.log).filter((d) => d.source === "player_p1c1").map((d) => d.amount);
  };
  (0, import_vitest.it)("Lv1\uFF1A\u5F00\u6218 8s \u5185 130\uFF08+30%\uFF09\xB7\u7A97\u53E3\u540E\u56DE 100\uFF1BLv0\uFF1A\u5168\u7A0B 100\uFF08\u5929\u8D4B\u672A\u89E3\u9501=\u6700\u4FDD\u5B88\u7F3A\u7701\uFF09", async () => {
    const lv1 = await hitsOf(1);
    (0, import_vitest.expect)(lv1).toContain(130);
    (0, import_vitest.expect)(lv1).toContain(100);
    (0, import_vitest.expect)(lv1[0]).toBe(130);
    const lv0 = await hitsOf(0);
    (0, import_vitest.expect)(lv0.every((a) => a === 100)).toBe(true);
  });
});
(0, import_vitest.describe)("\u2469A1-\u63A5\u7EBF\u95E8\u626B\u63CF\uFF08\u7EA7\u95E8\u53D6\u5BF9\u6863\xB7\u661F\u95E8\u5F00\u8D28\u53D8\xB7\xA713 \u53C2\u6570\u9010\u70B9\uFF09", () => {
  const trigRefs = (blocks) => blocks.filter((b) => b.kind === "trigger").map((t) => t.effectRef);
  const stacksOf = (blocks) => blocks.filter((b) => b.kind === "stack").map((s) => s.rule);
  const affixOf = (blocks, key) => blocks.find((b) => b.kind === "affix" && b.affix === key)?.value;
  (0, import_vitest.it)("\u71CE\u8FDE\u65A9\u7EA7\u95E8\uFF1ALv1\u21921.5s / Lv20\u21922s / Lv100\u21924s\uFF1B3\u2605 \u52A0\u8FDE\u6740\u653B\u901F\u53E0\u5C42", () => {
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil03", 1))).toContain("eff_pil_cdr_15");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil03", 20))).toContain("eff_pil_cdr_20");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil03", 100))).toContain("eff_pil_cdr_40");
    (0, import_vitest.expect)(stacksOf(pilotBlocks("pil03", 1, 3)).some((r) => r.stat === "atkSpeedPct" && r.perStack === 0.1)).toBe(true);
    (0, import_vitest.expect)(stacksOf(pilotBlocks("pil03", 1, 2)).length).toBe(0);
  });
  (0, import_vitest.it)("\u708E\u8FC7\u70ED\u7EA7\u95E8\uFF1ALv1=2%/3\u5C42 \u2192 Lv40=4% \u2192 Lv80 \u4E0A\u96505 \u2192 Lv100 \u65AD\u51FB\u53EA\u964D1\u5C42", () => {
    const l1 = stacksOf(pilotBlocks("pil01", 1))[0];
    (0, import_vitest.expect)([l1.perStack, l1.maxStacks, l1.breakAction ?? "clear"]).toEqual([0.02, 3, "clear"]);
    const l80 = stacksOf(pilotBlocks("pil01", 80))[0];
    (0, import_vitest.expect)([l80.perStack, l80.maxStacks]).toEqual([0.04, 5]);
    (0, import_vitest.expect)(stacksOf(pilotBlocks("pil01", 100))[0].breakAction).toBe("decay_1");
  });
  (0, import_vitest.it)("\u5F71\u65A9\u9996\u7EA7\u95E8\uFF1ALv1=+40% \u2192 Lv40=+50% \u2192 Lv60=+60%\uFF08dmgVsLowHp\uFF09", () => {
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil02", 1), "dmgVsLowHp")).toBe(0.4);
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil02", 40), "dmgVsLowHp")).toBe(0.5);
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil02", 60), "dmgVsLowHp")).toBe(0.6);
  });
  (0, import_vitest.it)("\u6CA7\u575A\u58C1\uFF1ALv1 \u5149\u73AF\u57FA\u5EA7 \u2192 Lv40 +\u76FE\u6548\u8BCD\u6761 \u2192 Lv80 \u6BCF\u6863 8%\uFF1B\u5DE1\u589E\u4EA7\uFF1ALv40 \u4E0A\u9650+2\uFF1B\u85CF Lv100 \u9644\u589E\u4F24", () => {
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil08", 1))).toContain("eff_pil_cang_aura");
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil08", 40), "shieldPower")).toBe(0.15);
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil08", 80))).toContain("eff_pil_cang_aura_l80");
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil19", 40), "summonCapBonus")).toBe(2);
    (0, import_vitest.expect)(affixOf(pilotBlocks("pil19", 1), "skillHaste")).toBe(0.2);
    const zang100 = pilotBlocks("pil20", 100);
    (0, import_vitest.expect)(zang100.find((b) => b.kind === "modifier").value).toBe(0.08);
  });
  (0, import_vitest.it)("\u7A7A/\u5DE1 5\u2605 \u5149\u73AF\u661F\u95E8\uFF1A5\u2605 \u6709\u30014\u2605 \u65E0\uFF08M6 no_enemy_summon / has_summon \u8F7D\u4F53\uFF09", () => {
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil18", 1, 5))).toContain("eff_pil_kong_s5_aura");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil18", 1, 4))).not.toContain("eff_pil_kong_s5_aura");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil19", 1, 5))).toContain("eff_pil_xun_s5_aura");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil19", 1, 4))).not.toContain("eff_pil_xun_s5_aura");
  });
  (0, import_vitest.it)("\u5CB33\u2605\uFF1A\u8346\u7532\u6539\u6309\u653B\u51FB\u8005\u653B\xD712%\uFF08\u6362 s3 \u884C\uFF09\uFF1B\u783A\u6108\u575A Lv60 \u6BCF\u6863 5%", () => {
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil07", 1, 3))).toContain("eff_pil_yue_thorns_s3");
    (0, import_vitest.expect)(trigRefs(pilotBlocks("pil07", 1, 2))).toContain("eff_pil_yue_thorns");
    (0, import_vitest.expect)(stacksOf(pilotBlocks("pil06", 60))[0].perStack).toBe(0.05);
  });
});
(0, import_vitest.describe)('\u2469A1-\u65B9\u5411\u5339\u914D\u95E8\uFF08deriveUnit\xB7\u771F\u6E90\xA70"\u81EA\u7136\u751F\u6548/\u81EA\u7136\u5931\u6548"\u7684\u673A\u5668\u5316\uFF09', () => {
  const base = {
    maxHp: 800,
    attack: 60,
    armor: 20,
    attackIntervalSec: 1,
    attackRangeCells: 99,
    passiveEnergyPerSec: 0,
    targetingTag: "nearest_random_tie",
    normalEffectRef: "eff_basic_attack",
    ultimateEffectRef: "none",
    coreEffectRef: "none"
  };
  (0, import_vitest.it)("\u82CF(\u53CB\u65B9\u5411\u80FD\u529B)\u88C5\u653B\u51FB\u8230\uFF1A\u666E\u653B\u76EE\u6807\u4E0D\u88AB\u6539\u6210\u53CB\u519B\uFF08\u5426\u5219=\u4F24\u5BB3\u6253\u81EA\u5DF1\u4EBA\uFF09\xB7\u5929\u8D4B\u8BCD\u6761\u7167\u5E38\u751F\u6548", () => {
    const d = deriveUnit(base, pilotBlocks("pil13", 1));
    (0, import_vitest.expect)(d.targetingTag).toBe("nearest_random_tie");
    (0, import_vitest.expect)(d.affixes.healVsLowHp).toBe(0.3);
  });
  (0, import_vitest.it)("\u6F88(\u53CB\u65B9\u5411\u80FD\u529B)\u88C5\u652F\u63F4\u8230\uFF08\u57FA\u7840 tag=\u53CB\u65B9\u5411\uFF09\uFF1A\u8986\u76D6\u751F\u6548=\u589E\u76CA\u5582\u6700\u9AD8\u8F93\u51FA", () => {
    const d = deriveUnit({ ...base, targetingTag: "lowest_hp_ally" }, pilotBlocks("pil14", 1));
    (0, import_vitest.expect)(d.targetingTag).toBe("highest_attack_ally");
  });
  (0, import_vitest.it)("\u708E(\u654C\u65B9\u5411\u80FD\u529B)\u88C5\u652F\u63F4\u8230\uFF1A\u4E0D\u628A\u6CBB\u7597\u666E\u653B\u6539\u6210\u6253\u654C\u4EBA=\u5FFD\u7565\uFF1B\u88C5\u653B\u51FB\u8230\uFF1A\u6B63\u5E38\u8986\u76D6", () => {
    (0, import_vitest.expect)(deriveUnit({ ...base, targetingTag: "lowest_hp_ally" }, pilotBlocks("pil01", 0)).targetingTag).toBe("lowest_hp_ally");
    (0, import_vitest.expect)(deriveUnit(base, pilotBlocks("pil01", 0)).targetingTag).toBe("lowest_hp_enemy");
  });
});
