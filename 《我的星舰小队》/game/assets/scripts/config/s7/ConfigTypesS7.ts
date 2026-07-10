// S7 首发正式版配置类型层（与流程版 ConfigTypes.ts 隔离，互不影响）。
// 来源：S7-GAMEPLAY-03-01 / 03-02 / 03-03 冻结口径；落表口径见 CC-02 报告。
// 仅 Tier A 五张叶子表：battle_template / ship / pilot / core / plugin。
// 取值约定：实体 ID 全小写；中文名与描述存设计原文；受 validator 约束的封闭分类用罗马化 token。

// ⑦机制批①：单位行可选字段复用装配层积木的结构定义（纯类型导入·编译期擦除·无运行时依赖）。
import type { S7TriggerBlock, S7StackRuleParam } from '../../core/s7/S7BattleEffectBlock';

/** 6 类战斗问题罗马化标签（1:1 对应设计冻结的 6 类问题）。 */
export type S7ProblemTag = 'swarm' | 'shield' | 'backline' | 'burst' | 'berserk' | 'summon';

/** 关卡类型（与流程版 level type 枚举一致）。 */
export type S7StageType = 'normal' | 'elite' | 'boss';

/** 星舰类型：自由型 / 流派型。 */
export type S7ShipType = 'free' | 'stream';

/** 插件槽位：武器 / 能源 / 战术。 */
export type S7PluginSlot = 'weapon' | 'skill' | 'tactical';

/** 战斗模板配置（默认仅 T01-T10；T11/T12 为条件预留，不进入本表）。 */
export interface S7BattleTemplateConfig {
  schemaVersion: string;
  templateId: string;
  name: string;
  mainProblemTag: S7ProblemTag;
  /** 副标签上限，设计冻结为 1。 */
  secondaryTagCap: number;
  applicableStageTypes: S7StageType[];
  /** 是否条件预留槽；Tier A 默认行恒为 false。 */
  reservedSlotFlag: boolean;
}

/** 星舰配置（默认盘 shp01-shp12 共 12 艘）。 */
export interface S7ShipConfig {
  schemaVersion: string;
  shipId: string;
  name: string;
  shipType: S7ShipType;
  coverProblemTags: S7ProblemTag[];
  positionNote: string;
  roleNote: string;
  freePathNote: string;
  forbiddenBindingNote: string;
}

/** 驾驶员配置（默认盘 pil01-pil10 共 10 名；PIL-RSV 不进入本表）。 */
export interface S7PilotConfig {
  schemaVersion: string;
  pilotId: string;
  name: string;
  roleNote: string;
  driveStyleNote: string;
  mainFitNote: string;
  coverProblemTags: S7ProblemTag[];
  freePathNote: string;
  forbiddenBindingNote: string;
}

/** 星核配置（默认盘 core07-core22 真核 16 颗=步5 收编；CORE-RSV 不进入本表）。 */
export interface S7CoreConfig {
  schemaVersion: string;
  coreId: string;
  name: string;
  roleNote: string;
  effectNote: string;
  coverProblemTags: S7ProblemTag[];
  /** 适配星舰引用（全小写 shipId）。 */
  shipFitRefs: string[];
  freePathNote: string;
  forbiddenBindingNote: string;
}

/** 插件配置（默认盘 plg01-plg18 共 18 个；PLG-RSV 不进入本表）。 */
export interface S7PluginConfig {
  schemaVersion: string;
  pluginId: string;
  name: string;
  slotTag: S7PluginSlot;
  roleNote: string;
  coverProblemTags: S7ProblemTag[];
  /** 适配星舰 / 星核引用（全小写 shipId / coreId）。 */
  fitRefs: string[];
  freePathNote: string;
  upgradeNote: string;
}

// ===== Tier B 参数 / 支撑表（来源 03-03 §11 / 03-04 v0.2）=====
// 数值口径直接转写自 03-04 v0.2，不再平衡；`powerIndex` 仅出现在 power_reference_param。

/** 来源标签延续 / 防洗白配置。 */
export interface S7SourceTagConfig {
  schemaVersion: string;
  rowId: string;
  sourceTag: string;
  sourceCategory: 'free' | 'high_risk';
  riskLevel: 'low' | 'high';
  inheritOnTransform: boolean;
  washProtected: boolean;
  recyclePolicy: 'lossy' | 'minimal';
  note: string;
}

/** D7/D14/D21/D28 战力锚点；powerIndex 仅内部 / QA。 */
export interface S7PowerReferenceParam {
  schemaVersion: string;
  rowId: string;
  anchorDay: string;
  nodeRangeNote: string;
  powerIndex: number;
  powerIndexMin: number;
  powerIndexMax: number;
  internalOnly: boolean;
  freePathNote: string;
}

/** 累计免费资源锚点（floor / expected）。 */
export interface S7FreeResourceAnchorParam {
  schemaVersion: string;
  rowId: string;
  anchorDay: string;
  band: 'floor' | 'expected';
  // 6a-2：删废弃币 battleLog/pluginMat/coreMat 列。
  // 块6余项：本表是"免费毕业预算"参照，只盯核心软货币——撤 beacon 列（信标拆 3 档后其经济交第二块·信标打捞数值表重定）；
  //   新增币 starGem/pilotShardUniversal 同样不进本表（不被逼填毕业预算数值）。键集与 ConfigValidatorS7.ANCHOR_BUDGET_KEYS 对齐。
  starOre: number;
  hullAlloy: number;
  shipBlueprint: number;
  pilotToken: number;
  coreFrag: number;
  fullCore: number;
  supplyTicket: number;
  starCargo: number;
  sourceScopeNote: string;
}

/** 强化成本（星核 5 阶 / 插件 +15）。 */
export interface S7EnhanceCostParam {
  schemaVersion: string;
  rowId: string;
  targetType: 'core' | 'plugin';
  enhanceBand: string;
  maxEnhance: number;
  starOre: number;
  pluginMat: number;
  coreMat: number;
  coreFrag: number;
  note: string;
}

/** 回退返还（不跨币种，来源标签保留）。 */
export interface S7RefundParam {
  schemaVersion: string;
  rowId: string;
  periodTag: string;
  operationTag: string;
  refundRateMinPct: number;
  refundRateMaxPct: number;
  crossCurrency: boolean;
  sourceTagRule: string;
  note: string;
}

/** 战斗压力档（normal / elite / boss / template_modifier）。 */
export interface S7PressureParam {
  schemaVersion: string;
  rowId: string;
  scope: 'normal' | 'elite' | 'boss' | 'template_modifier';
  refKey: string;
  pressureMin?: number;
  pressureMax?: number;
  pressureRecommend?: number;
  secondaryPressureCap?: number;
  modifier?: number;
  appliesToBoss?: boolean;
  note: string;
}

export interface S7RewardResource {
  resourceId: string;
  min: number;
  max?: number;
}

/** 奖励量级（不逐节点精算；不绑定广告 / 商人 / 星贝套利）。 */
export interface S7RewardParam {
  schemaVersion: string;
  rowId: string;
  sourceType: string;
  packId: string;
  resources: S7RewardResource[];
  goodItemTag: string;
  noAdRequired: boolean;
  note: string;
}

/** 商人小站商品（不售关键路径唯一物）。 */
export interface S7ShopParam {
  schemaVersion: string;
  rowId: string;
  itemType: string;
  shopValue: number;
  priceMin: number;
  priceMax: number;
  purchaseLimit: number;
  recyclable: boolean;
  criticalPath: boolean;
  note: string;
}

/** 商人刷新（免费 1 / 付费<=3 / 序列 80-160-320）。 */
export interface S7MerchantRefreshParam {
  schemaVersion: string;
  rowId: string;
  freeRefreshPerCycle: number;
  paidRefreshCapPerCycle: number;
  refreshCostSequence: number[];
  rareItemSlotCap: number;
  criticalPathItemBlock: boolean;
  note: string;
}

/** 回收返还（买入必亏，完整星核不可回收）。 */
export interface S7RecycleParam {
  schemaVersion: string;
  rowId: string;
  sourceTag: string;
  itemType: string;
  refundRateMinPct: number;
  refundRateMaxPct: number;
  recyclable: boolean;
  currencyGroup: string;
  note: string;
}

/** 防套利阻断规则（失败必 block）。 */
export interface S7AntiArbitrageCheck {
  schemaVersion: string;
  rowId: string;
  ruleId: string;
  formula: string;
  blockOnFail: boolean;
  note: string;
}

// ===== Tier B 关系 / schema 表（来源 03-01 §6/§8/§9 / 03-02 §7 / 03-03 §7）=====
// 只写标签 / 槽位 / 引用关系；引用只指向已落的 Tier A 实体表（t/shp/pil/core/plg）。
// 不写血量 / 伤害 / 概率 / 秒数 / 阈值。

/** 敌人角色 schema（按设计 §6 enemy_role 罗列的可枚举职责原型，不展开完整敌人名单）。 */
export interface S7EnemySchemaConfig {
  schemaVersion: string;
  enemyId: string;
  nameKey: string;
  familyTag: string;
  roleTag: string;
  mainProblemTag: S7ProblemTag;
  problemTagRefs: S7ProblemTag[];
  /** 可被哪些模板引用，只允许 T01-T10（条件预留 T11/T12 禁止）。 */
  templateRefSlots: string[];
  positionTag: string;
  previewTagRefs: string[];
  threatLabel: string;
  /** 通用应对方向，至少 2 个，不绑定唯一答案。 */
  counterHintTags: string[];
  assetRefPolicy: string;
  validationTags: string[];
  forbiddenNotes: string[];
}

/** Boss 骨架 schema（4 星域 Boss；1 主问题 + 最多 1 副压力）。 */
export interface S7BossSkeletonConfig {
  schemaVersion: string;
  bossId: string;
  nameKey: string;
  /** 所属星域备注；star_region_config 属 Tier C 未落表，此处仅为说明文本，不作交叉引用。 */
  regionNote: string;
  primaryProblemTag: S7ProblemTag;
  /** 副压力槽，最多 1 个；空字符串表示无副压力。 */
  secondaryPressureTag: string;
  /** 可用模板，只允许 T01-T10。 */
  templateRefs: string[];
  phaseHintTags: string[];
  counterHintTags: string[];
  forbiddenMechanismTags: string[];
  validationTags: string[];
}

/** 战前敌情预览 schema（每个默认模板 T01-T10 一行）。 */
export interface S7PrebattlePreviewConfig {
  schemaVersion: string;
  previewId: string;
  /** 对应战斗模板，只允许 T01-T10。 */
  templateRef: string;
  problemTagRefs: S7ProblemTag[];
  positionTags: string[];
  threatOrderTags: string[];
  counterHintTags: string[];
  displayPriorityTag: string;
  validationTags: string[];
}

/** 星舰 × 驾驶员适配关系（主适配 + 替代适配，禁止唯一绑定）。 */
export interface S7ShipPilotFitConfig {
  schemaVersion: string;
  /** 星舰引用（全小写 shipId）。 */
  shipRef: string;
  /** 主适配驾驶员引用（全小写 pilotId）。 */
  primaryPilotRef: string;
  /** 可替代适配驾驶员引用，至少 1 个；不得为 PIL-RSV。 */
  alternativePilotRefs: string[];
  fitReasonNote: string;
  /** 非唯一绑定标记，恒为 true。 */
  notUniqueFlag: boolean;
}

/** 星核 / 插件流派适配关系（每流派至少 2 解法，不绑定唯一答案）。 */
export interface S7CorePluginFitConfig {
  schemaVersion: string;
  /** 流派罗马化标签（全小写）。 */
  streamTag: string;
  shipRefs: string[];
  pilotRefs: string[];
  /** 星核引用（全小写 coreId）。 */
  coreRefs: string[];
  /** 插件引用（全小写 pluginId）。 */
  pluginRefs: string[];
  boundaryNote: string;
}

// ===== Tier B 建筑配置表（来源 BUILDING-02 落表说明）=====
// 只写段位 / 标签 / 引用关系 / 影响判断；不写逐级数值、倍率、概率、运行时公式。
// 建筑 ID 采用 bld_ 前缀的 snake_case；条件预留建筑 bld_rsv_* 是合法建筑行，按 reservedFlag / releaseTag 区分，
// 不沿用关系表对 "rsv" 标识的硬禁。

/** 建筑组（对齐 v1.0 §7 八栋：船坞 / 驾驶员训练舱 / 居住舱 / 星港补给站 / 打捞港 / 商人小站 / 研究塔 / 星核展厅）。 */
export type S7BuildingGroupTag =
  | 'core_growth' | 'pilot_growth' | 'base_comfort' | 'supply_comfort'
  | 'resource_comfort' | 'merchant_comfort' | 'minor_growth' | 'showcase';
/** 默认 / 条件后置。 */
export type S7BuildingReleaseTag = 'default_release' | 'conditional_post';
/** no-ad 核心路径角色。 */
export type S7BuildingNoAdRole = 'entry_only' | 'optional_support' | 'non_core' | 'none';

/** 建筑实体表（7 默认 + 1 条件/后置 = 8 行，对齐 v1.0 §7）。 */
export interface S7BuildingConfig {
  schemaVersion: string;
  buildingId: string;
  buildingKey: string;
  buildingName: string;
  buildingGroupTag: S7BuildingGroupTag;
  releaseTag: S7BuildingReleaseTag;
  /** 固定 1。 */
  initialLevel: number;
  /** 固定 10。 */
  maxLevel: number;
  /** 固定 1。 */
  functionUnlockLevel: number;
  /** 主线允许要求的最高建筑等级，默认 1（不得 > 1）。 */
  mainlineRequiredLevelCap: number;
  noAdCorePathRole: S7BuildingNoAdRole;
  systemRefTags: string[];
  /** conditional_post 必须 true；default_release 必须 false。 */
  reservedFlag: boolean;
}

/** 建筑解锁 / CC-05a 节点挂接桥。 */
export interface S7BuildingUnlockConfig {
  schemaVersion: string;
  unlockId: string;
  /** 建筑引用（必须存在于 building_config）。 */
  buildingId: string;
  unlockSourceType: 'tutorial_anchor' | 'mainline_anchor' | 'need_anchor' | 'expansion_anchor' | 'blueprint_progress';
  unlockAnchorTag: string;
  cc05aLinkTag: string;
  /** 固定 1。 */
  initialLevelOnUnlock: number;
  noAdAvailableFlag: boolean;
  /** 仅 entry_only 入口建筑可 true。 */
  corePathRequiredFlag: boolean;
  /** 不可挂 70 回退可删节点，必须 true。 */
  forbiddenFallback70Flag: boolean;
  /** 禁止广告 / 商人 / 付费唯一来源，必须 true。 */
  forbiddenCommercialSourceFlag: boolean;
}

/** 建筑等级成本段（只写段位 / 标签，不写逐级精算）。 */
export interface S7BuildingLevelCostParam {
  schemaVersion: string;
  costParamId: string;
  buildingGroupTag: S7BuildingGroupTag;
  levelBand: 'activate_lv1' | 'lv2_5' | 'lv6_10';
  primaryResourceTag: 'none' | 'star_ore';
  secondaryMaterialTag: string;
  costBandTag: 'none' | 'low' | 'mid' | 'high';
  freeAnchorImpactTag: 'entry_unlock_only' | 'not_in_core_floor' | 'optional_post';
  refundCategoryTag: string;
  sourceTagPolicy: string;
  /** 禁止重算 03-04，必须 true。 */
  forbidRecalc0304Flag: boolean;
}

/** 建筑等级效果方向（只写方向标签，不写倍率 / 概率 / 公式）。 */
export interface S7BuildingLevelEffectParam {
  schemaVersion: string;
  effectParamId: string;
  /** 建筑引用（必须存在于 building_config）。 */
  buildingId: string;
  levelBand: 'lv1' | 'lv2_5' | 'lv6_10';
  effectTag: string;
  /** 必须在该建筑 systemRefTags 内。 */
  affectedSystemTag: string;
  effectIntensityBand: 'entry' | 'minor' | 'comfort' | 'advanced_comfort';
  visualChangeTag: string;
  combatPowerImpactTag: 'none' | 'minor_non_gate';
  /** 默认 false（建筑不得卡主线）。 */
  mainlineGateAllowed: boolean;
  /** 默认 false（建筑不得卡 no-ad）。 */
  noAdGateAllowed: boolean;
}

/** 建筑对 no-ad 核心路径 / D7-D28 锚点的侵入校验。 */
export interface S7BuildingAnchorImpactCheck {
  schemaVersion: string;
  checkId: string;
  anchorDay: 'D7' | 'D14' | 'D21' | 'D28';
  noAdCheckTag: string;
  /** 需要的建筑引用（必须存在）。 */
  requiredBuildingRefs: string[];
  /** 不得 > 1。 */
  requiredLevelCap: number;
  includedInFreeAnchor: boolean;
  impactJudgement: 'no_impact' | 'needs_review' | 'blocks_anchor';
  /** 失败必阻断，必须 true。 */
  blockOnFail: boolean;
  /** 禁止商业化补洞，必须 true。 */
  forbidCommercialPatchFlag: boolean;
}

/** 主线节点结构化配置（N001-N075，覆盖 75 主线节点）。 */
export interface S7MainlineNodeConfig {
  schemaVersion: string;
  nodeId: string;
  starfieldId: string;
  chapterId: string;
  /** 节点类型标签（开放词表，由 validator 维护允许值）。 */
  nodeTypeTag: string;
  /** 默认仅引用 t01-t10；N038/N039 非战斗节点为 none。 */
  templateRef: string;
  /** N038/N039 非战斗节点为 none。 */
  problemTagRef: S7ProblemTag | 'none';
  /** 最多 1 个副压力；none 表示无副压力。 */
  secondaryPressureTag: string;
  /** tut01-tut38 或 none。 */
  tutorialStepRef: string;
  unlockRef: string;
  rewardAnchorRef: string;
  noAdCheckTag: string;
  protectionPeriodTag: 'active' | 'ending_notice' | 'closed';
  fallback70Tag: 'keep_70' | 'cut_70' | 'merge_70_to_t01' | 'merge_70_to_t05';
}

/** 章节配置（CH01-CH12）。 */
export interface S7ChapterConfig {
  schemaVersion: string;
  chapterId: string;
  starfieldId: string;
  /** 节点范围标签，如 n001_n006。 */
  nodeRangeTag: string;
  /** 默认仅引用 t01-t10。 */
  primaryTemplateTags: string[];
  tutorialGoalTag: string;
  /** boss_node_config.bossNodeId 或 none。 */
  bossRef: string;
}

/** 星域配置（SF01-SF04）。 */
export interface S7StarRegionConfig {
  schemaVersion: string;
  starfieldId: string;
  /** 节点范围标签，如 n001_n018。 */
  nodeRangeTag: string;
  mainProblemTags: S7ProblemTag[];
  reuseProblemTags: S7ProblemTag[];
  bossValidationTag: S7ProblemTag;
  fallback70Policy: 'keep_all' | 'cut_1' | 'cut_2';
}

/** Boss 节点验证配置（N018/N037/N056/N075）。 */
export interface S7BossNodeConfig {
  schemaVersion: string;
  bossNodeId: string;
  mainProblemTag: S7ProblemTag;
  /** 默认仅引用 t01-t10。 */
  templateRef: string;
  /** 最多 1 个副压力；none 表示无副压力。 */
  secondaryPressureTag: string;
  /** 引用 tutorial_trigger_config.tutorialStepId。 */
  previewTagRefs: string[];
  forbiddenMechanicTag: string;
}

/** 新手教程触发结构（TUT01-TUT38；仅结构字段，不含 UI 文案 / 手指位置 / 气泡 / 遮罩）。 */
export interface S7TutorialTriggerConfig {
  schemaVersion: string;
  tutorialStepId: string;
  /** 对应 mainline_node_config.nodeId。 */
  nodeId: string;
  triggerTag: 'on_node_enter' | 'on_node_complete' | 'on_checkpoint_enter';
  contentTag: string;
  unlockRef: string;
  protectionPeriodTag: 'active' | 'ending_notice' | 'closed';
  skippableTag: 'skippable' | 'mandatory_ack';
}

/** 系统解锁检查点配置（主线系统解锁 + 建筑解锁桥接）。 */
export interface S7UnlockCheckpointConfig {
  schemaVersion: string;
  unlockRef: string;
  /** 对应 mainline_node_config.nodeId；建筑解锁桥接行为 none。 */
  nodeId: string;
  systemTag: string;
  requiredForMainlineTag: boolean;
  noAdRequiredTag: boolean;
  /** building_unlock_config.unlockId 或 none。 */
  buildingUnlockRef: string;
}

/** 新手保护期与重置结构配置（N038/N039 转折）。 */
export interface S7ProtectionResetConfig {
  schemaVersion: string;
  /** 对应 mainline_node_config.nodeId（n038 / n039）。 */
  nodeId: string;
  protectionPeriodTag: 'active' | 'ending_notice' | 'closed';
  /** 全队整备 / 免费总重置标记；N038 必为 true。 */
  freeResetFlag: boolean;
  /** 重置范围标签；不写返还比例。 */
  resetScopeTags: string[];
  /** 永远可调整项标签。 */
  alwaysReversibleTags: string[];
  /** 进入正式养成期提醒；N039 必为 true。 */
  irreversibleWarningFlag: boolean;
}

/** 奖励锚点 -> 03-04 v0.2 既有奖励参数池桥接（来源 D2 补丁，19 个 reward_anchor_ref 全覆盖）。 */
export interface S7RewardPoolRefConfig {
  schemaVersion: string;
  /** 对应 mainline_node_config.rewardAnchorRef。 */
  rewardAnchorRef: string;
  /** 引用该锚点的默认 75 节点 nodeId 列表。 */
  nodeRefs: string[];
  sourceTag: string;
  poolRoleTag: string;
  /** 指向 reward_param.rowId 既有行；reset/notice 类锚点为空数组。 */
  rewardParamRef: string[];
  goodItemTag: string;
  noAdRequiredTag: boolean;
  notes: string;
}

/** 不看广告核心路径检查点（来源 03-05 §8，16 个非 none no_ad_check_tag 全覆盖）。 */
export interface S7NoAdPathCheckConfig {
  schemaVersion: string;
  checkTag: string;
  /** 对应 mainline_node_config.nodeId 且 noAdCheckTag 一致。 */
  nodeId: string;
  requiredStateTag: string;
  forbiddenDependencyTag: string[];
}

/** 70 节点风险回退盘删减 / 合并登记（来源 03-05 §9，覆盖 fallback70Tag != keep_70 的全部节点）。 */
export interface S7RiskFallback70Config {
  schemaVersion: string;
  /** 对应 mainline_node_config.nodeId。 */
  nodeId: string;
  fallback70Tag: 'cut_70' | 'merge_70_to_t01' | 'merge_70_to_t05';
  fallbackReasonTag: string;
  replacementRef: string;
  /** 70 回退不可砍关键路径；本表行必为 false。 */
  criticalPathTag: boolean;
}

// ===== 成长段位参数表（CC-07E-1，来源 03-04 v0.2 §3.2-3.5）=====
// 成长值的唯一配置真源；逐级/逐阶值由运行时/模拟按派生规则展开：
// band_linear（ship/pilot/plugin）段内线性插值；control_point（core）控制点分段线性。
// 数值端点逐字转写自冻结设计稿，不在此调参。

export type S7GrowthTargetType = 'ship' | 'pilot' | 'core' | 'plugin';
export type S7GrowthCurveType = 'band_linear' | 'control_point';
export type S7GrowthSecondaryKind = 'stat' | 'affix' | 'effect' | 'none';

/** 成长段位 / 控制点参数。 */
export interface S7GrowthBandParam {
  schemaVersion: string;
  rowId: string;
  targetType: S7GrowthTargetType;
  curveType: S7GrowthCurveType;
  /** 与 enhance_cost_param.enhanceBand 对齐（旧 upgrade_cost_param 已随步5 公式化退役）（core 为控制点段标识）。 */
  bandId: string;
  /** band_linear：段输出起始等级；control_point：控制点 index（stage）。 */
  fromIndex: number;
  /** band_linear：段输出结束等级；control_point：同 fromIndex。 */
  toIndex: number;
  /** 插值域起点：一般等于 fromIndex；plugin_enhance_0_3 为 0；control_point 等于 fromIndex。 */
  interpFromIndex: number;
  /** 主成长值 power 端点：band_linear 为 min(at interpFromIndex)/max(at toIndex)；control_point 时 min=max。 */
  powerMin: number;
  powerMax: number;
  /** 次成长指数类别：ship=stat、plugin=affix、core=effect、pilot=none。 */
  secondaryKind: S7GrowthSecondaryKind;
  /** 次成长指数端点；secondaryKind=none 时为 0/0；control_point 时 min=max。 */
  secondaryMin: number;
  secondaryMax: number;
  note: string;
}

// ===== 轻量实时自动战斗配置表（BATTLE-RT-03，来源 BATTLE-RT-01 规则包）=====
// 战斗契约与首轮样例 fixture；不含战斗引擎、不做 pressure→属性自动换算（见 RT-02 Codex 决策）。
// 敌方战场固定 3 行 x 7 列（r0c0..r2c6）；玩家固定 3x3（首版 playerSlotPolicy=five_ship_3x3_default）。

export type S7BattleUnitTargetType = 'ship' | 'enemy' | 'boss';
/** 单位寻敌倾向；首版至少支持 nearest_random_tie。
 *  任务单⑥8a 受控并行加法（2026-07-07）：新增驾驶员能力目标族 + 空间AoE 族——
 *  纯 selectTargets 分发新枚举值，既有配置不引用则引擎行为逐字节不变。 */
export type S7BattleUnitTargetingTag =
  | 'nearest_random_tie' | 'backline_first' | 'lowest_hp_ally' | 'column_line' | 'marked_first'
  // ⑥8a 敌方目标族（驾驶员能力）：最低血(炎)/最高血(烬)/最高攻(翎)/最高防(藏)/关键单位(蛰·空)/
  // 残血优先回退(燎)/锁定到死(源)/严格首列(骁)/带减益优先(蔽)
  | 'lowest_hp_enemy' | 'highest_hp_enemy' | 'highest_attack_enemy' | 'highest_armor_enemy'
  | 'key_unit_first' | 'lowhp_then_nearest' | 'lock_until_dead' | 'first_column_first' | 'debuffed_first'
  // ⑥8a 空间AoE族：主目标+十字4格(小范围) / 主目标+3×3(一片)
  | 'cross_area' | 'block_area'
  // ⑦机制批① 友方目标族（8a 如实交回件·随机制批补）：输出最高(澈)/无增益优先(沛)/减益最多(霖)/被控或带减益优先(沧简化口径)
  | 'highest_attack_ally' | 'no_buff_ally_first' | 'most_debuffed_ally' | 'controlled_ally_first'
  // ⑦机制批① 自身区域族（施加者为中心·己方侧）：自己+十字4格(磐石张盾/船长鼓动) / 自己+3×3(岩专属扩圈)
  | 'self_cross_area' | 'self_block_area';

/** 战斗单位最小属性与占格（星舰 / 敌人 / Boss）。不含 pressure 自动换算。 */
export interface S7BattleUnitStatParam {
  schemaVersion: string;
  rowId: string;
  targetType: S7BattleUnitTargetType;
  /** ship→ship_config.shipId；enemy→enemy_schema_config.enemyId；boss→boss_node_config.bossNodeId。 */
  unitRef: string;
  roleTag: string;
  /**
   * 星舰 5 定位型（突击/护卫/炮击/支援/工程）：仅 targetType='ship' 行必填、取值 ∈ S7_POSITION_TYPES；
   * 悬赏词缀按此过滤我方单位（第2.5块·块2）。**灰盒占位**——按 roleNote 语义先归类，星舰内容块随真源统一校准。
   * 非 ship 行（enemy/boss/prop）不填或忽略。
   */
  positionType?: string;
  /** ⑥8a 可选字段（缺省=0=行为不变）：敌/Boss 行的基线定向词条注入——Boss 控制抗性（0~1 缩短硬控时长）、
   *  基线暴击（真源 §0 全体单位基础暴击 5%/150%）。玩家舰的词条走装配层，不用这三个字段。 */
  controlResist?: number;
  baseCritRate?: number;
  baseCritDmg?: number;
  /** ⑦机制批① 可选（缺省缺席=行为不变）：单位行额外触发（敌方事件触发通道——污染体"受击喷毒"级
   *  on_hit 机制的配置载体；玩家舰触发走装配层不用它）。结构同装配层触发积木。 */
  extraTriggerBlocks?: S7TriggerBlock[];
  /** ⑦机制批① 可选（缺省缺席=行为不变）：单位行叠层规则（污染体"越受击越狂暴"/Boss"随时间狂暴"
   *  的配置载体；玩家舰叠层走装配层 stack 积木）。 */
  stackRules?: S7StackRuleParam[];
  maxHp: number;
  attack: number;
  armor: number;
  attackIntervalSec: number;
  attackRangeCells: number;
  /** 每秒被动获得能量，允许 0 或正数。 */
  passiveEnergyPerSec: number;
  /** 占格行数 1-3。 */
  sizeRows: number;
  /** 占格列数 1-7。 */
  sizeCols: number;
  targetingTag: S7BattleUnitTargetingTag;
  /** 指向 battle_effect_param.rowId；无对应效果写 none。 */
  normalEffectRef: string;
  ultimateEffectRef: string;
  /** 大招触发冷却秒数（块2 用，与普攻间隔 attackIntervalSec 同类）。无大招(ultimateEffectRef=none)写 0。占位值，精确值第二块定。 */
  ultimateCdSec: number;
  coreEffectRef: string;
  note: string;
}

export type S7BattleEffectKind = 'normal_attack' | 'ultimate' | 'core' | 'state';
// ⑥8a 新增 effectType（受控并行加法·既有配置不引用则行为不变）：
//   silence=沉默状态（挡技能不挡普攻）· control_immune=免控状态（硬控免疫·守护铃/山岳不动）
//   cd_refund=缩短施法者自身 CD 型触发（燎连斩/空净场·effectPower=秒数）
// ⑦机制批① 新增：apply_state=通用状态施加（限时修正/周期状态一律走它+stateTag 选态；旧逐态 effectType 保留不动）
export type S7BattleEffectType =
  | 'basic_damage' | 'clear_barrage' | 'line_pierce' | 'backline_strike' | 'burst_nuke'
  | 'shield_bubble' | 'repair_burst' | 'short_circuit_pulse' | 'summon_drone'
  | 'shield' | 'shield_break' | 'mark' | 'vulnerable' | 'short_circuit' | 'stun' | 'summon' | 'berserk'
  | 'silence' | 'control_immune' | 'cd_refund'
  | 'apply_state'
  | 'purify' // ⑨机制批② M5：纯净化/驱散（无伤无治·按目标阵营移除减益/增益·dispelCount 条）
  | 'accumulate_attack'; // ⑨机制批② M9：运行时属性累积（贪吃星·on_kill 触发·本场永久 +effectPower×基础攻·无上限）
// ⑦机制批① M1 限时属性修正状态（幅度=效果行 stateAmount·时长=durationSec·全配置驱动；
// 方向编码在 tag 里，stateAmount 一律填正数）：
//   atk_up/atk_down=加攻/虚弱 · atk_speed_up/atk_speed_down=加攻速/减速 · armor_down=破防
//   dmg_up=增伤(输出乘区) · dmg_taken_up=易伤参数版(淬针叠层用·与旧 vulnerable 并存)
//   dmg_taken_down=减伤%（stateAmount≥1 即免伤=零伤路径）
//   crit_rate_up/crit_dmg_up=暴击率/暴伤 buff（号角A/翎Lv100）· skill_haste_up=技能急速 buff（时光糖）
// ⑦机制批① M2 周期结算状态：burn=燃烧（周期掉血·无视防御·吃护盾/易伤/减伤）/ regen=持续回血。
// 每次结算量=施加瞬间快照（stateTickAtkPct×施加者基础攻 + stateTickMaxHpPct×目标最大血 + stateTickFlat）×层数。
export type S7BattleStateTag =
  | 'none' | 'shield' | 'shield_break' | 'mark' | 'vulnerable' | 'short_circuit' | 'stun' | 'summon' | 'berserk'
  | 'silence' | 'control_immune'
  | 'atk_up' | 'atk_down' | 'atk_speed_up' | 'atk_speed_down' | 'armor_down'
  | 'dmg_up' | 'dmg_taken_up' | 'dmg_taken_down' | 'crit_rate_up' | 'crit_dmg_up' | 'skill_haste_up'
  | 'burn' | 'regen'
  | 'debuff_immune' // ⑨机制批② M5：减益免疫（增益·镜像 control_immune·挡一切新减益·霖3★/净化模块传奇）
  | 'taunt' // ⑨机制批② M4：嘲讽（受击重定向·被嘲讽单位攻击性选目标强制打嘲讽者·tauntedBy 记施加者=砺/铁壁怒吼/哨卫诱饵/SS）
  | 'reflect' // ⑨机制批② M4：反弹（受方受击后向攻击者直扣·岩反震/岳荆甲/铁壁A/磐石A/砺5★）
  | 'guard' // ⑨机制批② M4：守护替挡（守护者持此态·敌打其保护的后排友军时伤害转守护者·CD 门控·岩「光盾守护」）
  | 'share' // ⑨机制批② M4：分摊（受方受击时把 sharePct 转给承接者·援护链邻格互摊/山岳SS/沧3★）
  | 'aura' // ⑨机制批② M6：光环（源持态·消费点动态求和·在场即生效退场撤销·磐石力场/号角催进/哨卫联防/沧坚壁/空5★）
  | 'blind'; // ⑨机制批② M8：致盲（减益·持有者普攻按 blindChance 概率落空·迷雾普攻/致盲领域/SS）

/** 普攻 / 大招 / 星核 / 状态的效果模板（首版参数最小集；允许治疗与互奶）。 */
export interface S7BattleEffectParam {
  schemaVersion: string;
  rowId: string;
  effectKind: S7BattleEffectKind;
  effectType: S7BattleEffectType;
  /** 效果强度系数，必须 >= 0。 */
  effectPower: number;
  targetingTag: string;
  /** 瞬发写 0；状态 / 召唤 / 短路写正数。 */
  durationSec: number;
  /** 最多目标数，必须 >= 1。 */
  maxTargets: number;
  /** 无状态写 none。 */
  stateTag: S7BattleStateTag;
  /** 无召唤写 none，否则指向 battle_unit_stat_param.rowId。 */
  summonUnitRef: string;
  /** ⑥8a 可选：stateTag 的施加概率 (0,1]；缺省=必定施加（不掷随机·零回归）。霹雳连锁闪电"每跳概率短路"用。 */
  stateChance?: number;
  /** ⑥8a 可选（召唤生命周期包·真源 §0 召唤物规则）：召唤物存在秒数，到期消亡；缺省=不限时（旧行为）。 */
  summonExpireSec?: number;
  /** ⑥8a 可选：true=召唤源死亡时本效果召出的单位一并消亡；缺省 false（旧行为）。 */
  despawnWithSource?: boolean;
  /** ⑥8a 可选：同一召唤源场上存活召唤物上限（+召唤者 summonCapBonus 词条）；缺省=不限（旧行为）。 */
  summonSourceCap?: number;
  /** ⑦机制批① 可选（M1 限时修正状态专用）：每层修正幅度（正数·方向在 tag）；仅新修正 tag 消费，旧 tag 忽略。 */
  stateAmount?: number;
  /** ⑦机制批① 可选（M3）：同名状态可叠层数上限（≥2 才叠；缺省=1 不叠只刷新）。 */
  stateMaxStacks?: number;
  /** ⑦机制批① 可选（M3）：时限到期动作——clear=整态消失（缺省）/ decay_1=降 1 层并重计时（炎 Lv100 口径）。 */
  stateExpireAction?: 'clear' | 'decay_1';
  /** ⑦机制批① 可选（M2 周期状态 burn/regen）：结算间隔秒（缺省 1s）。 */
  stateTickIntervalSec?: number;
  /** ⑦机制批① 可选（M2）：每次结算量的三个加法通道（施加瞬间快照·至少配一个）：
   *  atkPct=施加者基础攻×系数 / maxHpPct=目标最大血×系数 / flat=固定值。 */
  stateTickAtkPct?: number;
  stateTickMaxHpPct?: number;
  stateTickFlat?: number;
  /** ⑦机制批① 可选：同批对相同目标追加施加的状态效果行（一发多态·山岳「不动」/时光糖/侵蚀）。
   *  仅允许指向状态施加行（stateTag≠none），被引用行自身的 alsoApplyStateRefs 不再展开（禁链式）。 */
  alsoApplyStateRefs?: string[];
  /** ⑨机制批② M5 可选（净化/驱散）：本效果移除的状态数（>0 才启用；缺省=不净化=逐字节不变）。
   *  极性由目标阵营定：友军→移除减益（净化）/ 敌方→移除增益（驱散）。可挂治疗/护盾行（附带净化=回响/涤荡），
   *  或作 effectType='purify' 的纯净化主体（净化模块）。移除优先级=数值细表 §16c 定序（最有害/最具威胁者先移）。 */
  dispelCount?: number;
  /** ⑨机制批② M5 可选：净化是否可移除硬控（短路/沉默/晕眩）；缺省 false=只清软减益（春风/霖需 L40/L60 大节点才开）。 */
  dispelHardControl?: boolean;
  /** ⑨机制批② M5 可选：true=本效果施加的状态标记为"不可驱散"（守护铃「守护铃光」·不被 dispel 移除）；缺省 false。 */
  applyUndispellable?: boolean;
  /** ⑨机制批② M4 可选（仅 stateTag='reflect' 生效·缺省=无反弹=逐字节不变）：反弹给攻击者的量=
   *  受到伤害 ×reflectPct + 攻击者攻 ×reflectAtkPct + 受方防 ×reflectArmorPct（施加瞬间快照进 reflectBase）。 */
  reflectPct?: number;
  reflectAtkPct?: number;
  reflectArmorPct?: number;
  /** ⑨机制批② M4 可选（reflect 态·岩「反震」格挡）：受击时先减免的伤害比例 [0,1]；缺省=不减免。 */
  blockPct?: number;
  /** ⑨机制批② M4 可选（仅 stateTag='guard' 生效·岩「光盾守护」）：保护范围——backline=比守护者更靠后的友军（缺省）/ all=任意友军；
   *  guardCooldownSec=替挡冷却秒（岩=2s·冷却中的攻击照常落原目标·缺省 0=每次都替挡）。缺省无 guard 态=逐字节不变。 */
  guardProtect?: 'backline' | 'all';
  guardCooldownSec?: number;
  /** ⑨机制批② M4 可选（仅 stateTag='share'·分摊）：受击时把 sharePct∈[0,1] 的伤害转给承接者、自己只承剩余；
   *  shareMode=adjacent（转相邻持 share 态友军·援护链互摊）/ to_caster（转施加者·山岳SS/沧3★·shareTargetId 快照施加者）。 */
  sharePct?: number;
  shareMode?: 'adjacent' | 'to_caster';
  /** ⑨机制批② M6 可选（仅 stateTag='aura'·光环）：源持态·对 auraScope 内友军在 auraStat 轴动态叠加 auraAmount（在场即生效/退场撤销）。
   *  auraScope=self / team(全队) / cross(自己+十字4格) / block(自己+3×3)；auraCondition 缺省 always（has_summon=本源有存活召唤物·哨卫联防 / no_enemy_summon=无敌方召唤物·空5★）；
   *  auraScale=per_lowhp_ally（amount×残血友军数·沧坚壁）。 */
  auraStat?: 'dmgTakenDownPct' | 'atkSpeedPct' | 'skillHastePct';
  auraAmount?: number;
  auraScope?: 'self' | 'team' | 'cross' | 'block';
  auraCondition?: 'always' | 'has_summon' | 'no_enemy_summon';
  auraScale?: 'per_lowhp_ally';
  /** ⑨机制批② M7 可选（多重释放·极焰SS连放三次/群蜂饱和SS连放两轮）：技能额外重选+重放次数（≥1）；缺省=只放一次=逐字节不变。 */
  repeatCount?: number;
  /** ⑨机制批② M7 可选（概率连击·极焰快速装填/锋矢L100）：普攻额外再打一发的概率 (0,1]；缺省=不连击（不掷随机·零回归）。仅普攻行生效。 */
  repeatChance?: number;
  /** ⑨机制批② M7 可选（溅射分伤·散射枪管/引爆器/极焰节点/贯日L40）：多目标伤害里非主目标（首目标外）的伤害比例 [0,1)；缺省=全额（无溅射衰减）。仅伤害行生效。 */
  splashPct?: number;
  /** ⑨机制批② M8 可选（仅 stateTag='blind'·致盲）：持有者普攻落空概率 (0,1]（§11 迷雾 40%）；缺省无=不落空=逐字节不变。 */
  blindChance?: number;
  note: string;
}

/** 节点 / 模板 / 压力到战斗单位组合的装配规则。 */
export interface S7BattleEncounterParam {
  schemaVersion: string;
  rowId: string;
  /** 指向 mainline_node_config.nodeId。 */
  nodeRef: string;
  stageType: S7StageType;
  /** 指向 battle_template_config.templateId。 */
  templateRef: string;
  problemTagRef: S7ProblemTag;
  /** none 或副压力标签（保留 one_of_t03_t05_t08_t09）。 */
  secondaryPressureTag: string;
  /** 指向 pressure_param.rowId（强度锚点，不直接判胜负）。 */
  pressureRef: string;
  /** 指向 battle_unit_stat_param.rowId。 */
  enemyUnitStatRefs: string[];
  /** 指向 battle_spawn_param.rowId。 */
  spawnPlanRefs: string[];
  /** 指向 battle_boss_phase_param.rowId；普通战斗为空数组。 */
  bossPhaseRefs: string[];
  /** 首版固定 five_ship_3x3_default。 */
  playerSlotPolicy: string;
  /** 正数；超时未打死敌方算友方输。 */
  timeLimitSec: number;
  /** 首版固定 node_id_plus_run_seed。 */
  battleSeedPolicy: string;
  note: string;
}

/** 敌方 3 行 x 7 列战场的出怪批次、站位与同屏上限。 */
export interface S7BattleSpawnParam {
  schemaVersion: string;
  rowId: string;
  /** 指向 battle_encounter_param.rowId。 */
  encounterRef: string;
  /** 从 1 开始。 */
  waveIndex: number;
  /** 指向 battle_unit_stat_param.rowId。 */
  unitStatRef: string;
  /** 必须等于 slotRefs.length。 */
  count: number;
  /** 单位锚点格 r0c0..r2c6（非全部占用格）。 */
  slotRefs: string[];
  /** 允许 0 或正数。 */
  spawnDelaySec: number;
  /** 同屏上限 1-21。 */
  maxConcurrentOnField: number;
  note: string;
}

export type S7BossPhaseTag = 'start' | 'mid' | 'final';
export type S7BossPhaseTriggerType = 'battle_start' | 'hp_pct_below' | 'time_elapsed_sec';

/** Boss 阶段信号、阶段效果与召唤上限（每 Boss 最多 3 行，phaseTag 不重复）。 */
export interface S7BattleBossPhaseParam {
  schemaVersion: string;
  rowId: string;
  /** 指向 boss_node_config.bossNodeId。 */
  bossNodeId: string;
  phaseTag: S7BossPhaseTag;
  triggerType: S7BossPhaseTriggerType;
  /** battle_start 写 0。 */
  triggerValue: number;
  /** 指向 battle_effect_param.rowId。 */
  effectRefs: string[];
  /** 指向 battle_unit_stat_param.rowId；无召唤则空数组。 */
  summonUnitRefs: string[];
  /** 0-10。 */
  summonCountCap: number;
  note: string;
}

// ===== 悬赏词缀（第2.5块·块2 星港悬赏板，GDD S10.8）=====
/** 单条词缀修正：channel=stat → 改基础属性(modifier 积木)；channel=affix → 改定向词条(affix 积木)。 */
export interface S7CommissionAffixMod {
  channel: 'stat' | 'affix';
  /** channel=stat: S7StatKey（maxHp/attack/armor/attackIntervalSec/attackRangeCells/passiveEnergyPerSec）；channel=affix: S7AffixKey（critRate/critDmg/shieldBreak/skillHaste/healPower/controlResist/dmgVsSwarm/dmgVsBoss）。 */
  key: string;
  /** 仅 channel=stat 用；缺省 pct。词缀不用 set（那是质变覆盖）。 */
  op?: 'flat' | 'pct';
  value: number;
}
/** 悬赏词缀定义（战斗开始时对我方指定定位型施加 buff+debuff·确定性·配置表驱动）。结构与 core/s7/S7CommissionAffix.ts 应用层兼容。 */
export interface S7CommissionAffixParam {
  schemaVersion: string;
  /** = affixId（卡携带的 affixIds 指向它）。 */
  rowId: string;
  affixName: string;
  /** 目标定位型 ∈ S7_POSITION_TYPES(5 定位型) 或 'all'（全队）。 */
  positionType: string;
  /** 0=无条件；>0=仅当我方上阵数 ≤ 此值时生效（孤胆合约=3）。 */
  condLineupMax: number;
  mods: S7CommissionAffixMod[];
  /** 一句效果（卡面全文可见 / 备战词缀标记）。 */
  effectText: string;
  note: string;
}

// ===== 每日推演（第2.5块·块4 每日推演，GDD S10.9）=====
/**
 * 候选战队包（Ron 2026-07-05 修订②：舰+员固定绑定·可选携带题目指定的插件/星核·玩家不可改装）。
 * 战斗构建时归一 C 阶 Lv10（无升阶升星），插件/星核照题目指定携带（见 core/s7/S7DailyPuzzleBattleService）。
 */
export interface S7DailyPuzzlePackParam {
  /** 题内唯一包 id（作者解 + 玩家选择用它指向本包）。 */
  packId: string;
  shipId: string;
  pilotId: string;
  /** 可选·题目指定的星核（core_config）。缺省 = 无核。 */
  coreId?: string;
  /** 可选·题目指定的插件（plugin_config·≤3·槽位不重复；quality ∈ fine/superior/legendary）。缺省 = 无插件。 */
  plugins?: { pluginId: string; quality: string }[];
}
/** 内联敌方单位落点（复用块3受控入口的内联敌阵能力·battle_unit_stat_param enemy 行 + 敌 5×7 锚点格）。 */
export interface S7DailyPuzzleEnemyParam {
  unitStatRef: string;
  /** 敌方 5×7 锚点格：r{0-4}c{0-6}。 */
  slotRef: string;
}
/** 作者解一项（Ron 2026-07-05 修订②：选哪个包·摆哪格·必录）。 */
export interface S7DailyPuzzleSolutionParam {
  /** ∈ 本题 candidatePacks 的 packId。 */
  packId: string;
  /** 我方 3×3 锚点格：p{0-2}c{0-2}。 */
  slotRef: string;
}
/**
 * 每日推演题目（全服同题·确定性引擎验解·配置表驱动·Codex 走量）。GDD S10.9（Ron 2026-07-05 三修订）。
 * 验解器三道闸（core/s7/S7DailyPuzzleSolver）：a) 作者解引擎回放必过；b) 随机合法选摆蒙特卡洛通过率 <30%；c) 候选数 ∈[6,8]。
 * 静态那道闸(c)+结构合法进 validate:configs 门；要真跑引擎的两道闸(a/b)进 vitest 遍历题库测试（.mjs 跑不了 TS 引擎）。
 */
export interface S7DailyPuzzleParam {
  schemaVersion: string;
  /** = puzzleId（轮换按表内顺序·s7DayKey % 题数）。 */
  rowId: string;
  /** 威胁类型（分难度/覆盖用·backline/shield/summon/heal/burst/...）。 */
  threatType: string;
  /** 一句威胁提示（沙盘上方明示）。 */
  threatHint: string;
  /** 内联敌阵（≥1）。 */
  enemyFormation: S7DailyPuzzleEnemyParam[];
  /** 全体敌人血量缩放（占位·调难度用·pct·缺省 0）。 */
  enemyHpPct?: number;
  /** 全体敌人攻击缩放（占位·调难度用·pct·缺省 0）。 */
  enemyAtkPct?: number;
  /** 候选战队包（6-8·硬校验闸 c）。 */
  candidatePacks: S7DailyPuzzlePackParam[];
  /** 作者解（正好 5·必录·闸 a 回放必过）。 */
  authorSolution: S7DailyPuzzleSolutionParam[];
  note?: string;
}

export interface S7ConfigBundle {
  battle_template_config: S7BattleTemplateConfig[];
  ship_config: S7ShipConfig[];
  pilot_config: S7PilotConfig[];
  core_config: S7CoreConfig[];
  plugin_config: S7PluginConfig[];
  source_tag_config: S7SourceTagConfig[];
  power_reference_param: S7PowerReferenceParam[];
  free_resource_anchor_param: S7FreeResourceAnchorParam[];
  enhance_cost_param: S7EnhanceCostParam[];
  growth_band_param: S7GrowthBandParam[];
  refund_param: S7RefundParam[];
  pressure_param: S7PressureParam[];
  reward_param: S7RewardParam[];
  shop_param: S7ShopParam[];
  merchant_refresh_param: S7MerchantRefreshParam[];
  recycle_param: S7RecycleParam[];
  anti_arbitrage_check: S7AntiArbitrageCheck[];
  enemy_schema_config: S7EnemySchemaConfig[];
  boss_skeleton_config: S7BossSkeletonConfig[];
  prebattle_preview_config: S7PrebattlePreviewConfig[];
  ship_pilot_fit_config: S7ShipPilotFitConfig[];
  core_plugin_fit_config: S7CorePluginFitConfig[];
  building_config: S7BuildingConfig[];
  building_unlock_config: S7BuildingUnlockConfig[];
  building_level_cost_param: S7BuildingLevelCostParam[];
  building_level_effect_param: S7BuildingLevelEffectParam[];
  building_anchor_impact_check: S7BuildingAnchorImpactCheck[];
  mainline_node_config: S7MainlineNodeConfig[];
  chapter_config: S7ChapterConfig[];
  star_region_config: S7StarRegionConfig[];
  boss_node_config: S7BossNodeConfig[];
  tutorial_trigger_config: S7TutorialTriggerConfig[];
  unlock_checkpoint_config: S7UnlockCheckpointConfig[];
  protection_reset_config: S7ProtectionResetConfig[];
  reward_pool_ref_config: S7RewardPoolRefConfig[];
  no_ad_path_check_config: S7NoAdPathCheckConfig[];
  risk_fallback_70_config: S7RiskFallback70Config[];
  battle_unit_stat_param: S7BattleUnitStatParam[];
  battle_effect_param: S7BattleEffectParam[];
  battle_encounter_param: S7BattleEncounterParam[];
  battle_spawn_param: S7BattleSpawnParam[];
  battle_boss_phase_param: S7BattleBossPhaseParam[];
  commission_affix_param: S7CommissionAffixParam[];
  daily_puzzle_param: S7DailyPuzzleParam[];
}

export type S7ConfigTableName = keyof S7ConfigBundle;

/** 各表唯一 ID 字段名。 */
export const S7_ID_FIELD: Record<S7ConfigTableName, string> = {
  battle_template_config: 'templateId',
  ship_config: 'shipId',
  pilot_config: 'pilotId',
  core_config: 'coreId',
  plugin_config: 'pluginId',
  source_tag_config: 'rowId',
  power_reference_param: 'rowId',
  free_resource_anchor_param: 'rowId',
  enhance_cost_param: 'rowId',
  growth_band_param: 'rowId',
  refund_param: 'rowId',
  pressure_param: 'rowId',
  reward_param: 'rowId',
  shop_param: 'rowId',
  merchant_refresh_param: 'rowId',
  recycle_param: 'rowId',
  anti_arbitrage_check: 'rowId',
  enemy_schema_config: 'enemyId',
  boss_skeleton_config: 'bossId',
  prebattle_preview_config: 'previewId',
  ship_pilot_fit_config: 'shipRef',
  core_plugin_fit_config: 'streamTag',
  building_config: 'buildingId',
  building_unlock_config: 'unlockId',
  building_level_cost_param: 'costParamId',
  building_level_effect_param: 'effectParamId',
  building_anchor_impact_check: 'checkId',
  mainline_node_config: 'nodeId',
  chapter_config: 'chapterId',
  star_region_config: 'starfieldId',
  boss_node_config: 'bossNodeId',
  tutorial_trigger_config: 'tutorialStepId',
  unlock_checkpoint_config: 'unlockRef',
  protection_reset_config: 'nodeId',
  reward_pool_ref_config: 'rewardAnchorRef',
  no_ad_path_check_config: 'checkTag',
  risk_fallback_70_config: 'nodeId',
  battle_unit_stat_param: 'rowId',
  battle_effect_param: 'rowId',
  battle_encounter_param: 'rowId',
  battle_spawn_param: 'rowId',
  battle_boss_phase_param: 'rowId',
  commission_affix_param: 'rowId',
  daily_puzzle_param: 'rowId',
};

/** 各表资源文件名（不含扩展名，供运行时 cc.resources 加载使用）。 */
export const S7_TABLE_FILES: Record<S7ConfigTableName, string> = {
  battle_template_config: 's7/battle_template_config.sample',
  ship_config: 's7/ship_config.sample',
  pilot_config: 's7/pilot_config.sample',
  core_config: 's7/core_config.sample',
  plugin_config: 's7/plugin_config.sample',
  source_tag_config: 's7/source_tag_config.sample',
  power_reference_param: 's7/power_reference_param.sample',
  free_resource_anchor_param: 's7/free_resource_anchor_param.sample',
  enhance_cost_param: 's7/enhance_cost_param.sample',
  growth_band_param: 's7/growth_band_param.sample',
  refund_param: 's7/refund_param.sample',
  pressure_param: 's7/pressure_param.sample',
  reward_param: 's7/reward_param.sample',
  shop_param: 's7/shop_param.sample',
  merchant_refresh_param: 's7/merchant_refresh_param.sample',
  recycle_param: 's7/recycle_param.sample',
  anti_arbitrage_check: 's7/anti_arbitrage_check.sample',
  enemy_schema_config: 's7/enemy_schema_config.sample',
  boss_skeleton_config: 's7/boss_skeleton_config.sample',
  prebattle_preview_config: 's7/prebattle_preview_config.sample',
  ship_pilot_fit_config: 's7/ship_pilot_fit_config.sample',
  core_plugin_fit_config: 's7/core_plugin_fit_config.sample',
  building_config: 's7/building_config.sample',
  building_unlock_config: 's7/building_unlock_config.sample',
  building_level_cost_param: 's7/building_level_cost_param.sample',
  building_level_effect_param: 's7/building_level_effect_param.sample',
  building_anchor_impact_check: 's7/building_anchor_impact_check.sample',
  mainline_node_config: 's7/mainline_node_config.sample',
  chapter_config: 's7/chapter_config.sample',
  star_region_config: 's7/star_region_config.sample',
  boss_node_config: 's7/boss_node_config.sample',
  tutorial_trigger_config: 's7/tutorial_trigger_config.sample',
  unlock_checkpoint_config: 's7/unlock_checkpoint_config.sample',
  protection_reset_config: 's7/protection_reset_config.sample',
  reward_pool_ref_config: 's7/reward_pool_ref_config.sample',
  no_ad_path_check_config: 's7/no_ad_path_check_config.sample',
  risk_fallback_70_config: 's7/risk_fallback_70_config.sample',
  battle_unit_stat_param: 's7/battle_unit_stat_param.sample',
  battle_effect_param: 's7/battle_effect_param.sample',
  battle_encounter_param: 's7/battle_encounter_param.sample',
  battle_spawn_param: 's7/battle_spawn_param.sample',
  battle_boss_phase_param: 's7/battle_boss_phase_param.sample',
  commission_affix_param: 's7/commission_affix_param.sample',
  daily_puzzle_param: 's7/daily_puzzle_param.sample',
};
