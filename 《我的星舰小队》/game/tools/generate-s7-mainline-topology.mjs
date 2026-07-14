// S7 主线拓扑生成器（2026-07-02 首建 · 段二 2a 参数化扩容 2026-07-12）。
// 一次性/可重跑工具：把"星域/章节/Boss/节点"的拓扑规划落成 configs/s7 下的采样 JSON。
//
// 段二扩容口径（总控补充指令一）：**扩容能力先做、具体落位候剧本过 Ron**——
//   全部世界结构收进 WORLD 参数块（关数/星域 spans/墙 Boss/高潮 Boss/精英位/解锁节点/覆写面），
//   生成逻辑与世界数据彻底分离；默认 WORLD=WORLD_150（现行世界·重跑=逐字节零 diff=幂等自证）；
//   400 关世界（6 星域/12 Boss=9 墙+3 高潮/38 精英/350 普通）在剧本拍板后填 WORLD_400 并切换。
// 只重写与"主线节点拓扑"直接相关的表；reward_param 只重写 Boss 奖励行，不动其余行。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const SCHEMA = 's7-0.1.0';

function writeJson(name, rows) {
  writeFileSync(path.join(DIR, `${name}.sample.json`), JSON.stringify(rows, null, 2) + '\n', 'utf-8');
}
function readJson(name) {
  return JSON.parse(readFileSync(path.join(DIR, `${name}.sample.json`), 'utf-8'));
}
function pad3(n) { return `n${String(n).padStart(3, '0')}`; }

// ============================================================================
// 世界参数块（唯一改动点：换世界=换 WORLD 指向；生成逻辑不碰）
// ============================================================================

/** 现行 150 关世界（2026-07-02 拍板拓扑·字段值与参数化前逐字节等价）。 */
const WORLD_150 = {
  N: 150,
  // 星域（前松后紧）：末关=星域墙 Boss。
  regions: [
    { sf: 'sf01', from: 1, to: 60, tag: 'swarm', template: ['t01', 't02'], bossTemplate: 't02' },
    { sf: 'sf02', from: 61, to: 84, tag: 'shield', template: ['t03', 't04'], bossTemplate: 't04' },
    { sf: 'sf03', from: 85, to: 102, tag: 'backline', template: ['t05', 't06'], bossTemplate: 't06' },
    { sf: 'sf04', from: 103, to: 120, tag: 'summon', template: ['t09'], bossTemplate: 't09' },
    { sf: 'sf05', from: 121, to: 138, tag: 'burst', template: ['t07', 't08'], bossTemplate: 't08' },
    { sf: 'sf06', from: 139, to: 150, tag: 'berserk', template: ['t04', 't08'], bossTemplate: 't10' }, // 终域无常规berserk模板，常规关重混前域模板
  ],
  // 高潮 Boss（boss 类型节点·非墙）：n030=第5章章末剧情首Boss（掉陨星弹·强引导收尾·不进区域门/无广告检查/reward_boss_1~5）。
  climaxBossNodes: [30],
  // 精英位（显式清单）：n006=既有真实原型内容(C1b精英强化群怪)+每个墙Boss前一关。
  eliteNodes: [6, 59, 83, 101, 119, 137, 149],
  // 每章节点数（house style）。
  chapterSize: 6,
  // 教学战斗节点（tutorial_trigger_config 覆盖面·世界无关的强引导前 5 关）。
  tutorialMaxNode: 5,
  // 保护期转折点（reset_gate / protection_notice 两个非战斗节点）。
  protectionGates: { resetNode: 18, noticeNode: 19 },
  // 星辉货舱首触节点（reward_cargo_free_good 锚）。
  cargoIntroNode: 9,
  // 解锁检查点（系统解锁前置化：大部分系统压到前15关，Ron 2026-07-02 拍板）。
  fastNodeUnlocks: [
    ['unlock_battle_basic', 1, 'battle'],
    ['unlock_formation', 2, 'formation'],
    ['unlock_ship_growth_basic', 3, 'ship_growth'],
    ['unlock_pilot_assign', 4, 'pilot'],
    ['unlock_enemy_preview_tags', 5, 'enemy_preview'],
    ['unlock_ship_level', 6, 'ship_growth'],
    ['unlock_pilot_growth', 7, 'pilot'],
    ['unlock_refund_protection', 8, 'protection'],
    ['unlock_star_cargo', 9, 'star_cargo'], // Ron: 星辉货舱不强求D1，放前15关内即可
    ['unlock_plugin_slot_intro', 10, 'plugin'],
    ['unlock_five_ship_lineup', 11, 'fleet'], // 对齐既有锁定决策"满编压快到D1-2"
    ['unlock_plugin_equip', 12, 'plugin'],
    ['unlock_core_choice_entry', 13, 'core'], // Ron: 星核不强求D1，放前15关内即可
    ['unlock_core_equip', 14, 'core'],
    ['unlock_beacon_intro', 15, 'beacon'],
    ['unlock_range_intro', 15, 'range'],
  ],
  corePathUnlocks: [
    ['unlock_core_path_mid', 70, 'core'],
    ['unlock_core_3_path_check', 95, 'core'],
    ['unlock_late_core_path_check', 125, 'core'],
  ],
  finalUnlocks: [
    ['unlock_final_boss_ready', 148, 'final_check'],
    ['unlock_mainline_clear', 150, 'final_check'],
  ],
  // Boss 奖励行阶梯（数值=占位·2b 重铺；行数由本表驱动：climax 走 boss_story、墙走 boss_1..k、末墙走 boss_final）。
  bossRewardSteps: [
    { id: 'boss_story', min: 200, max: 300 }, // n030 剧情首Boss（早于 n060·基础成长奖励占位·比 boss_1 低）
    { id: 'boss_1', min: 300, max: 450 },
    { id: 'boss_2', min: 500, max: 750 },
    { id: 'boss_3', min: 700, max: 1050 },
    { id: 'boss_4', min: 900, max: 1350 },
    { id: 'boss_5', min: 1050, max: 1550 },
    { id: 'boss_final', min: 1300, max: 1900 },
  ],
  // 真实战斗内容覆写面（templateRef/problemTagRef 必须原样对齐真机原型/搬迁内容，不能被公式覆盖）。
  encounterOverrides: {
    1: { templateRef: 't01', problemTagRef: 'swarm', secondaryPressureTag: 'none' },
    2: { templateRef: 't01', problemTagRef: 'swarm', secondaryPressureTag: 'low_position' },
    3: { templateRef: 't01', problemTagRef: 'swarm', secondaryPressureTag: 'none' },
    4: { templateRef: 't02', problemTagRef: 'swarm', secondaryPressureTag: 'none' },
    5: { templateRef: 't01', problemTagRef: 'swarm', secondaryPressureTag: 'low_backline_preview' },
    6: { templateRef: 't02', problemTagRef: 'swarm', secondaryPressureTag: 'low_burst_preview' },
    7: { templateRef: 't03', problemTagRef: 'shield', secondaryPressureTag: 'none' }, // 真机原型提前预告"护盾"主题，早于SF02正式引入
    // n084/n150：真实Boss战斗内容搬迁而来（原n018/n075），templateRef/problemTagRef与公式结果一致，仅secondaryPressureTag需对齐真实值。
    84: { templateRef: 't04', problemTagRef: 'shield', secondaryPressureTag: 'swarm_low' },
    150: { templateRef: 't10', problemTagRef: 'berserk', secondaryPressureTag: 'one_of_t03_t05_t08_t09' },
  },
};

/**
 * 段二 450 关世界（战斗批填位 2026-07-14·剧本 v1.3 拍死骨架＝七域 spans 104/72/74/62/56/32/50、
 * 13 Boss＝9 墙＋3 高潮＋前哨 n384、38 精英位；与经济尺 TRUTHS（regionSpans/wallNodes/climaxNodes/
 * eliteNodes/storyBossNode 54）一字对齐——两处同改，对表守卫=经济尺测试）。
 * 域威胁主题（problemTag 从 6 枚举选最贴近·域规则本体走 star_region_config ruleKind 另一层）：
 *   sf01 星港边域=swarm（星盗数量题）｜sf02 废铁坟场=backline（修理机/磁暴塔躲后排=点治疗源题）
 *   sf03 迷雾星尘带=shield（星尘里藏盾卫）｜sf04 母舰工业区=summon（量产母舰=剧本原文点名）
 *   sf05 污染之海=berserk（污染体"越受击越狂暴"=真源原文）｜sf06 风暴核心=burst（增幅域敌高攻）
 *   sf07 风暴之眼=berserk（终域沿旧例）＋模板全轮换（前六域组合递进的敌配层呼应）。
 * ——域族/Boss 对位提案表随段 1 交付呈总控核，否了改此块重跑（幂等零成本）。
 */
const WORLD_450 = {
  N: 450,
  regions: [
    { sf: 'sf01', from: 1, to: 104, tag: 'swarm', template: ['t01', 't02'], bossTemplate: 't02' },
    { sf: 'sf02', from: 105, to: 176, tag: 'backline', template: ['t05', 't06'], bossTemplate: 't06' },
    { sf: 'sf03', from: 177, to: 250, tag: 'shield', template: ['t03', 't04'], bossTemplate: 't04' },
    { sf: 'sf04', from: 251, to: 312, tag: 'summon', template: ['t09'], bossTemplate: 't09' },
    { sf: 'sf05', from: 313, to: 368, tag: 'berserk', template: ['t07', 't08'], bossTemplate: 't08' }, // 无常规 berserk 模板，普通关混 burst 系（沿 WORLD_150 sf06 先例）
    { sf: 'sf06', from: 369, to: 400, tag: 'burst', template: ['t07', 't08'], bossTemplate: 't08' },
    { sf: 'sf07', from: 401, to: 450, tag: 'berserk', template: ['t02', 't04', 't06', 't08', 't09'], bossTemplate: 't10' }, // 眼段=模板全轮换·n450 终Boss=t10（validator 铁则）
  ],
  // 9 墙（显式清单·含域中段墙 n140/n282——"to 位=墙"推导对新世界不成立）：
  // n104 墙①战力 / n140 墙②机制 / n176 墙③解题 / n250 墙④连战 / n282 墙⑤战+机 /
  // n312 墙⑥解+连 / n368 墙⑦机+解 / n400 墙⑧战+连 / n450 墙⑨毕业战（六规则全叠）。
  wallBossNodes: [104, 140, 176, 250, 282, 312, 368, 400, 450],
  // 高潮/前哨（boss 类型·非墙·经济口径"不卡天"）：n054=剧情首Boss（掉陨星弹·storyBoss）、
  // n214/n340=高潮仗、n384=风暴前哨硬仗（毕业核货架进度闩位·经济尺 vaultGradUnlockNode 384）。
  climaxBossNodes: [54, 214, 340, 384],
  // 38 精英位＝剧本 v1.3 表（=经济尺 TRUTHS.eliteNodes 一字对齐）。
  eliteNodes: [7, 18, 33, 68, 88, 116, 122, 128, 142, 150, 165, 168, 186, 192, 198, 208, 224, 232, 238, 244, 258, 266, 274, 284, 290, 298, 306, 320, 330, 336, 344, 348, 356, 362, 372, 378, 390, 396],
  chapterSize: 6,
  tutorialMaxNode: 5,
  protectionGates: { resetNode: 18, noticeNode: 19 }, // 绝对保持族（重映射表一）
  cargoIntroNode: 9,
  // 前 15 关快解锁族＝绝对保持（重映射表一：强引导步序绑定）。
  fastNodeUnlocks: WORLD_150.fastNodeUnlocks,
  // 核节奏中段提示位：旧 n070/n095/n125 按 150→450 等比（0.47/0.63/0.83）取非 Boss/精英位。
  corePathUnlocks: [
    ['unlock_core_path_mid', 210, 'core'],
    ['unlock_core_3_path_check', 285, 'core'],
    ['unlock_late_core_path_check', 375, 'core'],
  ],
  finalUnlocks: [
    ['unlock_final_boss_ready', 448, 'final_check'],
    ['unlock_mainline_clear', 450, 'final_check'],
  ],
  // 13 Boss 奖励行阶梯（reward_param 占位·真实结算=S7NodeSettlement 公式驱动＋resolveBossGrand 箱）：
  // 墙①-⑧=boss_1..8、毕业战=boss_final、首Boss=boss_story、高潮/前哨=boss_climax_1..3。
  bossRewardSteps: [
    { id: 'boss_story', min: 200, max: 300 },
    { id: 'boss_climax_1', min: 550, max: 800 },
    { id: 'boss_climax_2', min: 950, max: 1400 },
    { id: 'boss_climax_3', min: 1100, max: 1600 },
    { id: 'boss_1', min: 300, max: 450 },
    { id: 'boss_2', min: 420, max: 630 },
    { id: 'boss_3', min: 520, max: 780 },
    { id: 'boss_4', min: 650, max: 980 },
    { id: 'boss_5', min: 780, max: 1170 },
    { id: 'boss_6', min: 900, max: 1350 },
    { id: 'boss_7', min: 1050, max: 1550 },
    { id: 'boss_8', min: 1200, max: 1750 },
    { id: 'boss_final', min: 1300, max: 1900 },
  ],
  // 教学段真机原型覆盖面（n001-n007=强引导真实内容·绝对保持）；旧 n084/n150 搬迁注记
  // 属 150 关世界遗产（新世界该两位=普通/精英关走公式），不再覆盖。
  encounterOverrides: {
    1: WORLD_150.encounterOverrides[1],
    2: WORLD_150.encounterOverrides[2],
    3: WORLD_150.encounterOverrides[3],
    4: WORLD_150.encounterOverrides[4],
    5: WORLD_150.encounterOverrides[5],
    6: WORLD_150.encounterOverrides[6],
    7: WORLD_150.encounterOverrides[7],
  },
};

const WORLD = WORLD_450; // 段二战斗批切换（2026-07-14）；WORLD_150 保留=历史世界参照。

// ============================================================================
// 生成逻辑（只吃 WORLD·不再包含世界数字）
// ============================================================================

const REGIONS = WORLD.regions;
const ALL_TAGS_IN_ORDER = REGIONS.map((r) => r.tag);
function reuseTagsBefore(sf) {
  const idx = REGIONS.findIndex((r) => r.sf === sf);
  return ALL_TAGS_IN_ORDER.slice(0, idx);
}
// 墙 Boss：wallBossNodes 显式清单优先（450 关世界含域中段墙 n140/n282）；未填=旧"域末位=墙"推导（WORLD_150 兼容）。
const BOSS_NODES = WORLD.wallBossNodes ?? REGIONS.map((r) => r.to);
const STORY_BOSS_NODES = WORLD.climaxBossNodes; // 高潮/前哨 Boss（非墙·首位=剧情首Boss 掉陨星弹）
const ALL_BOSS_NODES = [...BOSS_NODES, ...STORY_BOSS_NODES]; // 所有 boss 类型节点（nodeTypeTag='boss'）
const ELITE_NODES = WORLD.eliteNodes;

function regionOf(n) {
  return REGIONS.find((r) => n >= r.from && n <= r.to);
}
function chapterList() {
  // 每章 chapterSize 节点；每星域内按块切，边界对齐星域末尾。
  const chapters = [];
  let chIdx = 1;
  for (const r of REGIONS) {
    let start = r.from;
    while (start <= r.to) {
      const end = Math.min(start + WORLD.chapterSize - 1, r.to);
      chapters.push({ chapterId: `ch${String(chIdx).padStart(2, '0')}`, starfieldId: r.sf, from: start, to: end });
      chIdx += 1;
      start = end + 1;
    }
  }
  return chapters;
}
const CHAPTERS = chapterList();
function chapterOf(n) {
  return CHAPTERS.find((c) => n >= c.from && n <= c.to);
}

// ===== 2. star_region_config =====
writeJson('star_region_config', REGIONS.map((r) => ({
  schemaVersion: SCHEMA,
  starfieldId: r.sf,
  nodeRangeTag: `${pad3(r.from)}_${pad3(r.to)}`,
  mainProblemTags: [r.tag],
  reuseProblemTags: reuseTagsBefore(r.sf),
  bossValidationTag: r.tag,
  fallback70Policy: 'keep_all', // 70回退机制已作废（Codex旧遗留），全部保留不砍
})));

// ===== 3. chapter_config =====
writeJson('chapter_config', CHAPTERS.map((c) => {
  const region = REGIONS.find((r) => r.sf === c.starfieldId);
  // 章内 Boss 挂接：墙（含域中段墙 n140/n282——旧"域尾=墙"推导漏挂中段墙章）与高潮/前哨统一按
  // "Boss 节点落在本章区间"判定；一章至多一个 Boss（450 关布局下天然成立）。
  const bossInChapter = ALL_BOSS_NODES.find((n) => n >= c.from && n <= c.to);
  return {
    schemaVersion: SCHEMA,
    chapterId: c.chapterId,
    starfieldId: c.starfieldId,
    nodeRangeTag: `${pad3(c.from)}_${pad3(c.to)}`,
    primaryTemplateTags: region.template,
    tutorialGoalTag: c.chapterId === 'ch01' ? 'first_battle_formation_clear' : 'none',
    bossRef: bossInChapter !== undefined ? pad3(bossInChapter) : 'none',
  };
}));

// ===== 4. boss_node_config =====
const FORBIDDEN_MECHANIC_BY_INDEX = [
  'no_shield_backline_summon_burst_berserk',
  'no_backline_summon_burst_berserk',
  'no_summon_burst_berserk',
  'no_burst_berserk',
  'no_berserk',
  'all_mechanics_allowed',
];
// 墙/高潮 Boss 行统一按"所在星域"取主题模板与机制禁用档（域中段墙 n140/n282 同域尾口径）。
function bossRowOf(n) {
  const idx = REGIONS.findIndex((r) => n >= r.from && n <= r.to);
  return {
    schemaVersion: SCHEMA,
    bossNodeId: pad3(n),
    mainProblemTag: REGIONS[idx].tag,
    templateRef: REGIONS[idx].bossTemplate,
    secondaryPressureTag: 'none',
    previewTagRefs: [],
    forbiddenMechanicTag: FORBIDDEN_MECHANIC_BY_INDEX[Math.min(idx, FORBIDDEN_MECHANIC_BY_INDEX.length - 1)],
  };
}
writeJson('boss_node_config', [
  ...BOSS_NODES.map(bossRowOf),
  ...STORY_BOSS_NODES.map(bossRowOf),
]);

// ===== 5. tutorial_trigger_config（保留真实强引导覆盖的 n001-n005，不再铺到后面）=====
writeJson('tutorial_trigger_config', [
  { schemaVersion: SCHEMA, tutorialStepId: 'tut01', nodeId: 'n001', triggerTag: 'on_node_enter', contentTag: 'first_battle_intro', unlockRef: 'unlock_battle_basic', protectionPeriodTag: 'active', skippableTag: 'mandatory_ack' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut02', nodeId: 'n002', triggerTag: 'on_node_enter', contentTag: 'formation_3x3_intro', unlockRef: 'unlock_formation', protectionPeriodTag: 'active', skippableTag: 'mandatory_ack' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut03', nodeId: 'n003', triggerTag: 'on_node_complete', contentTag: 'swarm_clear_intro', unlockRef: 'unlock_ship_growth_basic', protectionPeriodTag: 'active', skippableTag: 'skippable' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut04', nodeId: 'n004', triggerTag: 'on_node_enter', contentTag: 'gacha_new_squad_intro', unlockRef: 'unlock_pilot_assign', protectionPeriodTag: 'active', skippableTag: 'skippable' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut05', nodeId: 'n005', triggerTag: 'on_node_enter', contentTag: 'counter_pilot_intro', unlockRef: 'unlock_enemy_preview_tags', protectionPeriodTag: 'active', skippableTag: 'skippable' },
]);

// ===== 6. protection_reset_config =====
const PG = WORLD.protectionGates;
writeJson('protection_reset_config', [
  { schemaVersion: SCHEMA, nodeId: pad3(PG.resetNode), protectionPeriodTag: 'ending_notice', freeResetFlag: true, resetScopeTags: ['ship_level', 'pilot_level', 'plugin_enhance', 'core_enhance', 'formation', 'equip_swap'], alwaysReversibleTags: ['formation', 'position', 'plugin_equip_swap', 'core_equip_swap', 'pilot_ship_swap'], irreversibleWarningFlag: false },
  { schemaVersion: SCHEMA, nodeId: pad3(PG.noticeNode), protectionPeriodTag: 'closed', freeResetFlag: false, resetScopeTags: [], alwaysReversibleTags: ['formation', 'position', 'plugin_equip_swap', 'core_equip_swap', 'pilot_ship_swap'], irreversibleWarningFlag: true },
]);

// ===== 7. unlock_checkpoint_config =====
const REGION_GATE_UNLOCKS = REGIONS.slice(1).map((r, i) => [`unlock_region_${i + 2}`, r.from, 'region_gate']);
const PROTECTION_UNLOCKS = [
  ['unlock_free_total_reset', PG.resetNode, 'protection'],
  ['unlock_formal_growth_phase', PG.noticeNode, 'protection'],
];
const NODE_UNLOCKS = [...WORLD.fastNodeUnlocks, ...REGION_GATE_UNLOCKS, ...WORLD.corePathUnlocks, ...WORLD.finalUnlocks, ...PROTECTION_UNLOCKS];
const BUILDING_UNLOCKS = [
  ['cc05a_bld_dock_unlock', 'building', true, 'unlock_bld_dock_day1'],
  ['cc05a_bld_pilot_training_bay_unlock', 'building', false, 'unlock_bld_pilot_training_bay_day1_2'],
  ['cc05a_bld_habitat_unlock', 'building', false, 'unlock_bld_habitat_day1'],
  ['cc05a_bld_supply_station_unlock', 'building', false, 'unlock_bld_supply_station_day1'],
  ['cc05a_bld_salvage_port_unlock', 'building', false, 'unlock_bld_salvage_port_day1'], // 提速：原day2-3→day1，配合打捞系统本身day1解锁
  ['cc05a_bld_merchant_station_unlock', 'building', false, 'unlock_bld_merchant_station_day1'], // 提速：原"need"→day1
  ['cc05a_bld_research_tower_unlock', 'building', false, 'unlock_bld_research_tower_day3_5'], // 压缩：原day4-7→day3-5（数值增益类建筑，不用D1，但不用拖到D7）
];
writeJson('unlock_checkpoint_config', [
  ...NODE_UNLOCKS.map(([unlockRef, node, systemTag]) => ({
    schemaVersion: SCHEMA,
    unlockRef,
    nodeId: pad3(node),
    systemTag,
    requiredForMainlineTag: systemTag === 'region_gate' || systemTag === 'final_check' || node === PG.resetNode || node === PG.noticeNode,
    noAdRequiredTag: true,
    buildingUnlockRef: 'none',
  })),
  ...BUILDING_UNLOCKS.map(([unlockRef, systemTag, requiredForMainlineTag, buildingUnlockRef]) => ({
    schemaVersion: SCHEMA,
    unlockRef,
    nodeId: 'none',
    systemTag,
    requiredForMainlineTag,
    noAdRequiredTag: false,
    buildingUnlockRef,
  })),
]);

// ===== 8. no_ad_path_check_config（每个墙 Boss 一个检查点）=====
const NO_AD_CHECK_TAGS = BOSS_NODES.map((n, i) => `no_ad_boss${i + 1}_check`);
writeJson('no_ad_path_check_config', BOSS_NODES.map((n, i) => ({
  schemaVersion: SCHEMA,
  checkTag: NO_AD_CHECK_TAGS[i],
  nodeId: pad3(n),
  requiredStateTag: `boss${i + 1}_clear_without_ad_ready`,
  forbiddenDependencyTag: ['ad', 'sponsor_supply', 'merchant_bought'],
})));

// ===== 9. risk_fallback_70_config（70回退机制作废，恒为空）=====
writeJson('risk_fallback_70_config', []);

// ===== 10. reward_pool_ref_config =====
const basicNodes = [];
const eliteSet = new Set(ELITE_NODES);
const bossSet = new Set(ALL_BOSS_NODES); // 所有 boss 类型节点；basic 池 + isBoss 判定共用
for (let n = 1; n <= WORLD.N; n++) {
  if (n === WORLD.cargoIntroNode || eliteSet.has(n) || bossSet.has(n)) continue;
  basicNodes.push(pad3(n));
}
writeJson('reward_pool_ref_config', [
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_mainline_basic', nodeRefs: basicNodes, sourceTag: 'source_mainline', poolRoleTag: 'mainline_basic', rewardParamRef: ['mainline_sf01_normal'], goodItemTag: 'none', noAdRequiredTag: true, notes: '基础主线包沿用既有普通节点参数行占位，精确逐节点数值留数值校准阶段。' },
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_elite_basic', nodeRefs: ELITE_NODES.map(pad3), sourceTag: 'source_mainline', poolRoleTag: 'elite_basic', rewardParamRef: ['mainline_sf01_normal'], goodItemTag: 'none', noAdRequiredTag: true, notes: '精英节点沿用普通包口径占位，不提供唯一通关物。' },
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_cargo_free_good', nodeRefs: [pad3(WORLD.cargoIntroNode)], sourceTag: 'source_star_cargo', poolRoleTag: 'cargo_intro', rewardParamRef: ['cargo_early'], goodItemTag: 'cargo_early_good_item_optional', noAdRequiredTag: true, notes: '星辉货舱首触节点，沿用既有 cargo_early 好东西标准。' },
  // 高潮/前哨 Boss：首位=剧情首Boss（陨星弹大奖走 F 块 resolveBossGrand 数据驱动判定=按节点顺序自动），
  // 其余高潮/前哨位各自独立锚（不能共用 first_boss 语义）。
  ...STORY_BOSS_NODES.map((n, i) => (i === 0
    ? {
      schemaVersion: SCHEMA, rewardAnchorRef: 'reward_first_boss', nodeRefs: [pad3(n)], sourceTag: 'source_boss', poolRoleTag: 'first_boss_clear', rewardParamRef: ['boss_story'], goodItemTag: 'no_unique_key_item', noAdRequiredTag: true, notes: `${pad3(n)} 剧情首Boss（强引导收尾高潮）基础成长奖励；陨星弹另经首Boss大奖判定发放，具体数值=公式驱动结算。`,
    }
    : {
      schemaVersion: SCHEMA, rewardAnchorRef: `reward_climax_${i}`, nodeRefs: [pad3(n)], sourceTag: 'source_boss', poolRoleTag: `climax_${i}_clear`, rewardParamRef: [`boss_climax_${i}`], goodItemTag: 'no_unique_key_item', noAdRequiredTag: true, notes: `${pad3(n)} 高潮/前哨硬仗（boss 类型·非墙·经济口径不卡天）基础成长奖励占位。`,
    })),
  ...BOSS_NODES.slice(0, -1).map((n, i) => {
    // 墙位语义：域末墙破墙=开下一域；域中段墙（如 n140/n282）破墙=同域继续推进。
    const nextRegion = REGIONS.find((r) => n + 1 >= r.from && n + 1 <= r.to);
    const opensNewRegion = regionOf(n).sf !== nextRegion.sf;
    return {
      schemaVersion: SCHEMA,
      rewardAnchorRef: `reward_boss_${i + 1}`,
      nodeRefs: [pad3(n)],
      sourceTag: 'source_boss',
      poolRoleTag: `boss_${i + 1}_clear`,
      rewardParamRef: [`boss_${i + 1}`],
      goodItemTag: 'no_unique_key_item',
      noAdRequiredTag: true,
      notes: opensNewRegion
        ? `墙${i + 1}（${pad3(n)}）破墙=进入 ${nextRegion.sf} 的基础成长奖励，不绑定唯一通关物。`
        : `墙${i + 1}（${pad3(n)}·域中段墙）破墙=同域继续推进的基础成长奖励，不绑定唯一通关物。`,
    };
  }),
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_final_boss_anchor', nodeRefs: [pad3(WORLD.N)], sourceTag: 'source_boss', poolRoleTag: 'final_boss_clear', rewardParamRef: ['boss_final', 'cargo_late'], goodItemTag: 'cargo_late_good_item_required', noAdRequiredTag: true, notes: '主线收束奖励，不做付费转化。' },
]);

// ===== 11. reward_param：重写 Boss 奖励行（不动其余行）=====
const rewardParam = readJson('reward_param').filter((r) => !/^boss_n0(18|37|56|75)$/.test(r.rowId) && !/^boss_\d+$/.test(r.rowId) && !/^boss_climax_\d+$/.test(r.rowId) && r.rowId !== 'boss_final' && r.rowId !== 'boss_story');
for (const step of WORLD.bossRewardSteps) {
  rewardParam.push({
    schemaVersion: SCHEMA,
    rowId: step.id,
    sourceType: 'boss',
    packId: step.id,
    resources: [
      { resourceId: 'hullAlloy', min: step.min, max: step.max },
      { resourceId: 'supplyTicket', min: 1, max: 1 },
      { resourceId: 'beaconEpic', min: 1, max: 1 },
    ],
    goodItemTag: step.id === 'boss_final' ? 'cargo_late_good_item_required' : 'no_unique_key_item',
    noAdRequired: true,
    note: `${step.id} 占位奖励，具体数值留数值一次性校准阶段（150关拓扑改造，2026-07-02）。`,
  });
}
writeJson('reward_param', rewardParam);

// ===== 12. mainline_node_config（N 行）=====
const REAL_ENCOUNTER_OVERRIDE = WORLD.encounterOverrides;
const rows = [];
for (let n = 1; n <= WORLD.N; n++) {
  const region = regionOf(n);
  const chapter = chapterOf(n);
  const isBoss = bossSet.has(n);
  const isElite = eliteSet.has(n);
  const isTutorial = n <= WORLD.tutorialMaxNode;
  const isProtectionGate = n === PG.resetNode || n === PG.noticeNode; // 保护期转折：非战斗节点
  const nodeTypeTag = isProtectionGate
    ? (n === PG.resetNode ? 'reset_gate' : 'protection_notice')
    : isTutorial ? 'tutorial_battle' : isBoss ? 'boss' : isElite ? 'elite' : 'normal';
  const reuse = reuseTagsBefore(region.sf);
  // 模板/问题标签：区内多数关卡用主标签，每4关穿插一次复用标签增加变化（首星域无复用标签可穿插）。
  // Boss节点必须用本区域主标签（与 boss_node_config.mainProblemTag 对齐），不参与复用穿插。
  const useReuse = !isBoss && reuse.length > 0 && n % 4 === 0;
  const override = REAL_ENCOUNTER_OVERRIDE[n];
  const problemTagRef = override ? override.problemTagRef : isProtectionGate ? 'none' : useReuse ? reuse[(n / 4) % reuse.length | 0] : region.tag;
  const templateRef = override
    ? override.templateRef
    : isProtectionGate
      ? 'none'
      : isBoss
        ? region.bossTemplate
        : region.template[n % region.template.length];
  const unlockEntry = NODE_UNLOCKS.find(([, node]) => node === n);
  const unlockRef = unlockEntry ? unlockEntry[0] : 'none';
  const noAdEntry = BOSS_NODES.indexOf(n);
  const noAdCheckTag = noAdEntry >= 0 ? NO_AD_CHECK_TAGS[noAdEntry] : 'none';
  const climaxIdx = STORY_BOSS_NODES.indexOf(n);
  const rewardAnchorRef = n === WORLD.cargoIntroNode
    ? 'reward_cargo_free_good'
    : climaxIdx >= 0
      ? (climaxIdx === 0 ? 'reward_first_boss' : `reward_climax_${climaxIdx}`) // 高潮/前哨（先于墙分支，避免落进 reward_boss_0）
      : isBoss
        ? (n === WORLD.N ? 'reward_final_boss_anchor' : `reward_boss_${BOSS_NODES.indexOf(n) + 1}`)
        : isElite
          ? 'reward_elite_basic'
          : 'reward_mainline_basic';
  const protectionPeriodTag = n < PG.resetNode ? 'active' : n === PG.resetNode ? 'ending_notice' : 'closed';
  rows.push({
    schemaVersion: SCHEMA,
    nodeId: pad3(n),
    starfieldId: region.sf,
    chapterId: chapter.chapterId,
    nodeTypeTag,
    templateRef,
    problemTagRef,
    secondaryPressureTag: override ? override.secondaryPressureTag : 'none',
    tutorialStepRef: isTutorial ? `tut${String(n).padStart(2, '0')}` : 'none',
    unlockRef,
    rewardAnchorRef,
    noAdCheckTag,
    protectionPeriodTag,
    fallback70Tag: 'keep_70',
  });
}
writeJson('mainline_node_config', rows);

console.log('生成完成：star_region_config(' + REGIONS.length + ') chapter_config(' + CHAPTERS.length + ') boss_node_config(' + (REGIONS.length + STORY_BOSS_NODES.length) + '=' + REGIONS.length + '墙+' + STORY_BOSS_NODES.length + '高潮) tutorial_trigger_config(5)');
console.log('protection_reset_config(2) unlock_checkpoint_config(' + (NODE_UNLOCKS.length + BUILDING_UNLOCKS.length) + ') no_ad_path_check_config(' + BOSS_NODES.length + ') risk_fallback_70_config(0)');
console.log('reward_pool_ref_config(' + (4 + STORY_BOSS_NODES.length + (REGIONS.length - 1)) + ') reward_param(+' + WORLD.bossRewardSteps.length + ') mainline_node_config(' + WORLD.N + '·含高潮Boss)');
