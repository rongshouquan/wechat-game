// S7 主线拓扑生成器（2026-07-02，配合毕业节奏建模 150 关改造）。
// 一次性/可重跑工具：把"6星域/25章节/6Boss/150节点"的拓扑规划落成 configs/s7 下的采样 JSON。
// 拓扑来源：Ron 2026-07-02 确认的星域分布（GDD-v2.0 S2/S14）+ 系统解锁前置化拍板（大部分系统第1天内解锁）。
// 只重写与"主线节点拓扑"直接相关的表；reward_param.sample.json 只追加 6 个新 Boss 奖励行，不动其余行。
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

// ===== 1. 星域拓扑（6 星域，前松后紧，见 GDD-v2.0 S2/S14）=====
const REGIONS = [
  { sf: 'sf01', from: 1, to: 60, tag: 'swarm', template: ['t01', 't02'], bossTemplate: 't02' },
  { sf: 'sf02', from: 61, to: 84, tag: 'shield', template: ['t03', 't04'], bossTemplate: 't04' },
  { sf: 'sf03', from: 85, to: 102, tag: 'backline', template: ['t05', 't06'], bossTemplate: 't06' },
  { sf: 'sf04', from: 103, to: 120, tag: 'summon', template: ['t09'], bossTemplate: 't09' },
  { sf: 'sf05', from: 121, to: 138, tag: 'burst', template: ['t07', 't08'], bossTemplate: 't08' },
  { sf: 'sf06', from: 139, to: 150, tag: 'berserk', template: ['t04', 't08'], bossTemplate: 't10' }, // 终域无常规berserk模板，常规关重混前域模板
];
const ALL_TAGS_IN_ORDER = REGIONS.map((r) => r.tag);
function reuseTagsBefore(sf) {
  const idx = REGIONS.findIndex((r) => r.sf === sf);
  return ALL_TAGS_IN_ORDER.slice(0, idx);
}
const BOSS_NODES = REGIONS.map((r) => r.to); // [60,84,102,120,138,150] = 6 区域Boss「墙」
// 首Boss（Ron 2026-07-03 拍板）：n030=第5章章末剧情首Boss（高潮点·非墙·"1艘S阶能打赢"·掉陨星弹·解锁星核展厅+深空回廊·强引导在此收尾）。
//   它是"第7个 boss 类型节点"，但**不进** 6 墙的区域门/不看广告检查点/reward_boss_1~5（n060 仍是第一堵真墙，6墙数量不变）。
const STORY_BOSS_NODES = [30];
const ALL_BOSS_NODES = [...BOSS_NODES, ...STORY_BOSS_NODES]; // 所有 boss 类型节点（nodeTypeTag='boss'）
// 每个大Boss前一关=精英关；n006 是既有真实原型内容(C1b精英强化群怪)，保留其elite定位。（n030 是剧情Boss·非墙·不铺前置精英关）
const ELITE_NODES = [6, ...BOSS_NODES.map((n) => n - 1)];

function regionOf(n) {
  return REGIONS.find((r) => n >= r.from && n <= r.to);
}
function chapterList() {
  // 每章6节点（house style）；每星域内按6分块，边界对齐星域末尾。
  const chapters = [];
  let chIdx = 1;
  for (const r of REGIONS) {
    let start = r.from;
    while (start <= r.to) {
      const end = Math.min(start + 5, r.to);
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

// ===== 2. star_region_config（6 行）=====
writeJson('star_region_config', REGIONS.map((r) => ({
  schemaVersion: SCHEMA,
  starfieldId: r.sf,
  nodeRangeTag: `${pad3(r.from)}_${pad3(r.to)}`,
  mainProblemTags: [r.tag],
  reuseProblemTags: reuseTagsBefore(r.sf),
  bossValidationTag: r.tag,
  fallback70Policy: 'keep_all', // 70回退机制已作废（Codex旧遗留），全部保留不砍
})));

// ===== 3. chapter_config（25 行）=====
writeJson('chapter_config', CHAPTERS.map((c) => {
  const region = REGIONS.find((r) => r.sf === c.starfieldId);
  const isBossChapter = c.to === region.to;
  const storyBossInChapter = STORY_BOSS_NODES.find((n) => n >= c.from && n <= c.to); // n030 落在 ch05
  return {
    schemaVersion: SCHEMA,
    chapterId: c.chapterId,
    starfieldId: c.starfieldId,
    nodeRangeTag: `${pad3(c.from)}_${pad3(c.to)}`,
    primaryTemplateTags: region.template,
    tutorialGoalTag: c.chapterId === 'ch01' ? 'first_battle_formation_clear' : 'none',
    bossRef: isBossChapter ? pad3(region.to) : storyBossInChapter ? pad3(storyBossInChapter) : 'none',
  };
}));

// ===== 4. boss_node_config（6 行）=====
const FORBIDDEN_MECHANIC_BY_INDEX = [
  'no_shield_backline_summon_burst_berserk',
  'no_backline_summon_burst_berserk',
  'no_summon_burst_berserk',
  'no_burst_berserk',
  'no_berserk',
  'all_mechanics_allowed',
];
writeJson('boss_node_config', [
  ...REGIONS.map((r, i) => ({
    schemaVersion: SCHEMA,
    bossNodeId: pad3(r.to),
    mainProblemTag: r.tag,
    templateRef: r.bossTemplate,
    secondaryPressureTag: 'none',
    previewTagRefs: [],
    forbiddenMechanicTag: FORBIDDEN_MECHANIC_BY_INDEX[i],
  })),
  // n030 剧情首Boss（sf01 群怪Boss·复用海盗系机制放大·主模板 t02，与 n060 同区同族）。
  //   最早期Boss=禁用表最严格（只允许群怪，护盾/后排/召唤/爆发/狂暴都不上），对齐 sf01。
  {
    schemaVersion: SCHEMA,
    bossNodeId: pad3(30),
    mainProblemTag: 'swarm',
    templateRef: REGIONS[0].bossTemplate, // sf01 boss 模板 = t02
    secondaryPressureTag: 'none',
    previewTagRefs: [],
    forbiddenMechanicTag: FORBIDDEN_MECHANIC_BY_INDEX[0], // 'no_shield_backline_summon_burst_berserk'
  },
]);

// ===== 5. tutorial_trigger_config（保留真实强引导覆盖的 n001-n005，5行，不再铺到后面）=====
writeJson('tutorial_trigger_config', [
  { schemaVersion: SCHEMA, tutorialStepId: 'tut01', nodeId: 'n001', triggerTag: 'on_node_enter', contentTag: 'first_battle_intro', unlockRef: 'unlock_battle_basic', protectionPeriodTag: 'active', skippableTag: 'mandatory_ack' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut02', nodeId: 'n002', triggerTag: 'on_node_enter', contentTag: 'formation_3x3_intro', unlockRef: 'unlock_formation', protectionPeriodTag: 'active', skippableTag: 'mandatory_ack' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut03', nodeId: 'n003', triggerTag: 'on_node_complete', contentTag: 'swarm_clear_intro', unlockRef: 'unlock_ship_growth_basic', protectionPeriodTag: 'active', skippableTag: 'skippable' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut04', nodeId: 'n004', triggerTag: 'on_node_enter', contentTag: 'gacha_new_squad_intro', unlockRef: 'unlock_pilot_assign', protectionPeriodTag: 'active', skippableTag: 'skippable' },
  { schemaVersion: SCHEMA, tutorialStepId: 'tut05', nodeId: 'n005', triggerTag: 'on_node_enter', contentTag: 'counter_pilot_intro', unlockRef: 'unlock_enemy_preview_tags', protectionPeriodTag: 'active', skippableTag: 'skippable' },
]);

// ===== 6. protection_reset_config（保护期转折点移到 n018/n019）=====
writeJson('protection_reset_config', [
  { schemaVersion: SCHEMA, nodeId: 'n018', protectionPeriodTag: 'ending_notice', freeResetFlag: true, resetScopeTags: ['ship_level', 'pilot_level', 'plugin_enhance', 'core_enhance', 'formation', 'equip_swap'], alwaysReversibleTags: ['formation', 'position', 'plugin_equip_swap', 'core_equip_swap', 'pilot_ship_swap'], irreversibleWarningFlag: false },
  { schemaVersion: SCHEMA, nodeId: 'n019', protectionPeriodTag: 'closed', freeResetFlag: false, resetScopeTags: [], alwaysReversibleTags: ['formation', 'position', 'plugin_equip_swap', 'core_equip_swap', 'pilot_ship_swap'], irreversibleWarningFlag: true },
]);

// ===== 7. unlock_checkpoint_config（系统解锁前置化：大部分系统压到前15关，Ron 2026-07-02 拍板）=====
const FAST_NODE_UNLOCKS = [
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
];
const REGION_GATE_UNLOCKS = REGIONS.slice(1).map((r, i) => [`unlock_region_${i + 2}`, r.from, 'region_gate']);
const CORE_PATH_UNLOCKS = [
  ['unlock_core_path_mid', 70, 'core'],
  ['unlock_core_3_path_check', 95, 'core'],
  ['unlock_late_core_path_check', 125, 'core'],
];
const FINAL_UNLOCKS = [
  ['unlock_final_boss_ready', 148, 'final_check'],
  ['unlock_mainline_clear', 150, 'final_check'],
];
const PROTECTION_UNLOCKS = [
  ['unlock_free_total_reset', 18, 'protection'],
  ['unlock_formal_growth_phase', 19, 'protection'],
];
const NODE_UNLOCKS = [...FAST_NODE_UNLOCKS, ...REGION_GATE_UNLOCKS, ...CORE_PATH_UNLOCKS, ...FINAL_UNLOCKS, ...PROTECTION_UNLOCKS];
const REQUIRED_FOR_MAINLINE = new Set(['region_gate', 'final_check']).add('n018').add('n019');
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
    requiredForMainlineTag: systemTag === 'region_gate' || systemTag === 'final_check' || node === 18 || node === 19,
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

// ===== 8. no_ad_path_check_config（简化为每个大Boss一个检查点，6行）=====
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

// ===== 10. reward_pool_ref_config（10个锚点：basic/elite/cargo旗舰味 + n030剧情首Boss + 5个区域Boss + 终Boss）=====
const basicNodes = [];
const eliteSet = new Set(ELITE_NODES);
const bossSet = new Set(ALL_BOSS_NODES); // 所有 boss 类型节点（6墙 + n030 剧情首Boss）；basic 池 + isBoss 判定共用
for (let n = 1; n <= 150; n++) {
  if (n === 9 || eliteSet.has(n) || bossSet.has(n)) continue;
  basicNodes.push(pad3(n));
}
writeJson('reward_pool_ref_config', [
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_mainline_basic', nodeRefs: basicNodes, sourceTag: 'source_mainline', poolRoleTag: 'mainline_basic', rewardParamRef: ['mainline_sf01_normal'], goodItemTag: 'none', noAdRequiredTag: true, notes: '基础主线包沿用既有普通节点参数行占位，精确逐节点数值留数值校准阶段。' },
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_elite_basic', nodeRefs: ELITE_NODES.map(pad3), sourceTag: 'source_mainline', poolRoleTag: 'elite_basic', rewardParamRef: ['mainline_sf01_normal'], goodItemTag: 'none', noAdRequiredTag: true, notes: '精英节点沿用普通包口径占位，不提供唯一通关物。' },
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_cargo_free_good', nodeRefs: ['n009'], sourceTag: 'source_star_cargo', poolRoleTag: 'cargo_intro', rewardParamRef: ['cargo_early'], goodItemTag: 'cargo_early_good_item_optional', noAdRequiredTag: true, notes: '星辉货舱首触节点，沿用既有 cargo_early 好东西标准。' },
  // n030 剧情首Boss基础成长奖励；特殊大奖陨星弹(core07)走 F 块 resolveBossGrand 的"首Boss"判定(按节点顺序自动=n030)，不在此 anchor。
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_first_boss', nodeRefs: [pad3(30)], sourceTag: 'source_boss', poolRoleTag: 'first_boss_clear', rewardParamRef: ['boss_story'], goodItemTag: 'no_unique_key_item', noAdRequiredTag: true, notes: 'n030 剧情首Boss（第5章章末）基础成长奖励；陨星弹另经首Boss大奖判定发放，占位数值留数值校准阶段。' },
  ...BOSS_NODES.slice(0, 5).map((n, i) => ({
    schemaVersion: SCHEMA,
    rewardAnchorRef: `reward_boss_${i + 1}`,
    nodeRefs: [pad3(n)],
    sourceTag: 'source_boss',
    poolRoleTag: `boss_${i + 1}_clear`,
    rewardParamRef: [`boss_${i + 1}`],
    goodItemTag: 'no_unique_key_item',
    noAdRequiredTag: true,
    notes: `进入 ${REGIONS[i + 1].sf} 的基础成长奖励，不绑定唯一通关物。`,
  })),
  { schemaVersion: SCHEMA, rewardAnchorRef: 'reward_final_boss_anchor', nodeRefs: [pad3(150)], sourceTag: 'source_boss', poolRoleTag: 'final_boss_clear', rewardParamRef: ['boss_final', 'cargo_late'], goodItemTag: 'cargo_late_good_item_required', noAdRequiredTag: true, notes: '主线收束奖励，不做付费转化。' },
]);

// ===== 11. reward_param：追加 6 个新 Boss 奖励行（不动其余既有行）=====
const rewardParam = readJson('reward_param').filter((r) => !/^boss_n0(18|37|56|75)$/.test(r.rowId) && !/^boss_[1-5]$/.test(r.rowId) && r.rowId !== 'boss_final' && r.rowId !== 'boss_story');
const BOSS_REWARD_STEPS = [
  { id: 'boss_story', min: 200, max: 300 }, // n030 剧情首Boss（早于 n060·基础成长奖励占位·比 boss_1 低）
  { id: 'boss_1', min: 300, max: 450 },
  { id: 'boss_2', min: 500, max: 750 },
  { id: 'boss_3', min: 700, max: 1050 },
  { id: 'boss_4', min: 900, max: 1350 },
  { id: 'boss_5', min: 1050, max: 1550 },
  { id: 'boss_final', min: 1300, max: 1900 },
];
for (const step of BOSS_REWARD_STEPS) {
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

// ===== 12. mainline_node_config（150 行）=====
// n001-n007 已有真实 battle_encounter_param 原型内容（C1b真机验过），templateRef/problemTagRef 必须原样对齐，
// 不能被下面的循环公式覆盖——否则跟真实战斗配置对不上（S7BattleEncounterAssembler 运行时会报 context_mismatch）。
const REAL_ENCOUNTER_OVERRIDE = {
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
};
const rows = [];
for (let n = 1; n <= 150; n++) {
  const region = regionOf(n);
  const chapter = chapterOf(n);
  const isBoss = bossSet.has(n);
  const isElite = eliteSet.has(n);
  const isTutorial = n <= 5;
  const isProtectionGate = n === 18 || n === 19; // 保护期转折：非战斗节点
  const nodeTypeTag = isProtectionGate
    ? (n === 18 ? 'reset_gate' : 'protection_notice')
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
  const rewardAnchorRef = n === 9
    ? 'reward_cargo_free_good'
    : STORY_BOSS_NODES.includes(n)
      ? 'reward_first_boss' // n030 剧情首Boss（先于下面的 isBoss 区域墙分支，避免落进 reward_boss_0）
      : isBoss
        ? (n === 150 ? 'reward_final_boss_anchor' : `reward_boss_${BOSS_NODES.indexOf(n) + 1}`)
        : isElite
          ? 'reward_elite_basic'
          : 'reward_mainline_basic';
  const protectionPeriodTag = n <= 17 ? 'active' : n === 18 ? 'ending_notice' : 'closed';
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

console.log('生成完成：star_region_config(6) chapter_config(25) boss_node_config(' + (REGIONS.length + STORY_BOSS_NODES.length) + '=6墙+n030首Boss) tutorial_trigger_config(5)');
console.log('protection_reset_config(2) unlock_checkpoint_config(' + (NODE_UNLOCKS.length + BUILDING_UNLOCKS.length) + ') no_ad_path_check_config(6) risk_fallback_70_config(0)');
console.log('reward_pool_ref_config(10) reward_param(+' + BOSS_REWARD_STEPS.length + ') mainline_node_config(150·n030=boss)');
