/**
 * S7 最小可玩循环 · 色块演示层（C1b-step2，Cocos Component）。
 *
 * 职责（表现层薄壳）：把已写好且单测过的 S7 纯逻辑（S7RunSession / 节点结算 / 战斗 dry-run）
 * 接成一个能在真机/预览里点的最小循环：主界面色块显示 星矿/合金/当前节点 + 「出战」按钮 + 上一战结果，
 * 点「出战」→ 打当前主线节点 → 胜则发软货币+推进主线 → 刷新+落盘；到无遭遇节点显示「暂无关卡」不崩。
 *
 * 边界（灰盒/原型）：UI 全程程序化色块（无美术资源）；战斗暂不接逐帧回放（只显示结果文字，回放留后）；
 * 只接 S7 存档域（S7SaveService 独立 key），不动流程版 AppContext/存档；不接广告/服务器/支付。
 * 本组件是 cc 表现层，逻辑全部委托给 core/s7 纯 TS 服务（已 Node 单测）。
 */
import { _decorator, Component, Node, Label, Color, Graphics, UITransform, EventTouch } from 'cc';
import { SaveStorageAdapter } from '../../save/SaveStorageAdapter';
import {
  S7_CURRENT_SAVE_VERSION,
  S7SaveData,
  S7PlayerState,
  loadS7Save,
  persistS7Save,
} from '../../save/S7SaveService';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7BattleUnitStatParam, S7GrowthBandParam, S7BattleEncounterParam, S7PluginConfig, S7PluginSlot, S7ShipConfig, S7PilotConfig, S7MainlineNodeConfig } from '../../config/s7/ConfigTypesS7';
import { S7MainlineModel, createDefaultS7MainlineProgress } from '../../core/s7/S7MainlineProgress';
import { S7RunSession, S7PlayNodeOutcome } from '../../core/s7/S7RunSession';
import { getShipLevel, getPilotLevel } from '../../core/s7/S7UnitLevelState';
import { upgradeShipOneLevel, upgradePilotOneLevel } from '../../core/s7/S7UnitUpgradeService';
import { unitPowerAtLevel, playerCritBaseBlocks } from '../../core/s7/S7UnitGrowth';
import { buildS7BattlePlayback, S7BattlePlayback, S7PlaybackFrame } from '../../core/s7/S7BattlePlayback';
import {
  buildS7ReturnReport,
  claimReturnReportCurrencies,
  removeClaimedSalvageMissions,
  S7ReturnReportData,
  RETURN_REPORT_DOUBLE_AD_POINT,
} from '../../core/s7/S7ReturnReport';
import { adDailyUsed, adDailyTryConsume, adDailyRecord, s7DayKey } from '../../core/s7/S7AdDailyCounter';
// 块5 广告统一收口：十点位每日上限/按钮三态/广告券（S13 决策①②③④）唯一真源——所有广告按钮显隐一律走 adButtonState。
import {
  S7AdButtonState, s7AdButtonState, adTicketButtonLabel, adTicketCount,
  consumeAdTicket, refundAdTicket, S7_AD_POINT_DAILY_LIMITS, S7_SPONSOR_SUPPLY_TICKETS,
  AD_TICKET_RESOURCE_KEY,
} from '../../core/s7/S7AdPointPolicy';
// 块5 三个新系统（纯逻辑各自成模块）：今日补给箱 / 战败安慰包 / 星港趣事。
import { DAILY_SUPPLY_CHEST_AD_POINT, rollDailySupplyChest } from '../../core/s7/S7DailySupplyChest';
import {
  DEFEAT_CONSOLATION_DOUBLE_AD_POINT, CONSOLATION_PACK_COUNTER_KEY, CONSOLATION_PACK_DAILY_LIMIT,
  CONSOLATION_ENCOURAGE_TEXT, defeatConsolationPack,
} from '../../core/s7/S7DefeatConsolation';
import {
  ANECDOTE_SHOWN_COUNTER_KEY, anecdoteForDay, anecdoteByIndex, anecdoteSpeakerDisplay, S7AnecdoteLine, S7_ANECDOTE_LINES,
} from '../../core/s7/S7StarportAnecdote';
import { S7AnecdoteBubbleView } from './S7AnecdoteBubbleView';
// 星港悬赏板（第2.5块·块2）：整体取代旧每日委托。核心逻辑在 core/s7/S7StarportBounty + S7CommissionAffix；
// 界面在独立 view 文件 S7BountyBoardView（守工作流程⑧）；本控制器只做"挂 view + 悬赏战斗编排"。
import { S7BountyHost } from './S7BountyBoardView'; // view 本体现由 S7CombatHallView 持有（块4·作战大厅）
import { S7CorridorTowerView, S7CorridorHost, S7CorridorLayerCard, S7CorridorMilestoneCard } from './S7CorridorTowerView';
// Cocos 壳批（2026-07-14 Ron 开工令）：战斗演出层——真皮肤/签名弹道/伤害数字，
// 消费与色块回放同一份 playback；资源未就绪时自动落回色块路径（演出不许断流程）。
import { S7BattleFxLayer } from './fx/S7BattleFxLayer';
// 块4 每日推演（作战大厅容器·Ron 2026-07-05 hub 架构）：独立 view + 纯逻辑 + 战斗服务（守工作流程⑧）。
import { S7CombatHallView, S7CombatHallHost, S7CombatHallTab } from './S7CombatHallView';
import { S7DailyPuzzleHost, S7DailyPuzzleViewData, S7PuzzlePackView, S7PuzzleEnemyCell } from './S7DailyPuzzleView';
import {
  refreshDailyPuzzle, isDailyPuzzleSolved, dailyPuzzleAttempts,
  recordDailyPuzzleAttempt, markDailyPuzzleSolved, dailyPuzzleUnlocked, dailyPuzzleFirstWinReward,
  PUZZLE_LINEUP_SIZE, DAILY_PUZZLE_UNLOCK_NODE,
} from '../../core/s7/S7DailyPuzzle';
import { runDailyPuzzleBattle, S7DailyPuzzleSelectionEntry } from '../../core/s7/S7DailyPuzzleBattleService';
import { S7DailyPuzzleParam } from '../../config/s7/ConfigTypesS7';
import {
  corridorLayerPlan, corridorBossNodeIds, corridorPaletteFrom, nextCorridorLayer, clearCorridorLayer,
  corridorLayerReward, corridorMilestoneReward, doubleCorridorReward,
  availableCorridorMilestones, claimCorridorMilestone, canClaimCorridorMilestone, corridorUnlocked,
  isEchoBossLayer, isMilestoneLayer, pickCorridorTrick,
  S7CorridorEnemyPaletteEntry, S7CorridorLayerPlan,
} from '../../core/s7/S7DeepCorridor';
import { corridorTrickDef } from '../../core/s7/S7CorridorTricks';
import { runCorridorBattle, bossNodeInlineEnemies, S7CorridorLineupCapError } from '../../core/s7/S7CorridorBattleService';
import {
  S7BountyCard,
  refreshBountyBoard,
  generateDayCards,
  bountyBoardCap,
  findBountyCard,
  settleBountyCard,
  bountyBattleNodeId,
  bountyAutoDifficulty,
  S7BountyDifficulty,
  bountyRunSeed,
  bountyAmbushTriggered,
  claimBountyAmbushBonus,
  ambushLossPenalty,
  escortTransportBlocks,
  isPerfectEscort,
} from '../../core/s7/S7StarportBounty';
import {
  commissionAffixBlocks,
  matchedCommissionAffixes,
  S7PositionType,
  S7_POSITION_TYPES,
  S7CommissionAffixDef,
} from '../../core/s7/S7CommissionAffix';
import { S7BattleRunService, S7BattleRunResult } from '../../core/s7/S7BattleRunService';
import {
  buildBuildingUpgradeView,
  upgradeBuildingWithDiscount,
} from '../../core/s7/S7BuildingUpgradeFlow';
import { unlockBuildingWithStarOre } from '../../core/s7/S7BuildingUpgradeService';
import { S7TutorialState, advanceStrongGuideStep, completeStrongGuide, hasSeenFirstTouch, markFirstTouchSeen } from '../../core/s7/S7TutorialState';
import { S7BuildingState, isBuildingUnlocked, unlockBuilding, createDefaultS7BuildingState, getBuildingLevel } from '../../core/s7/S7BuildingState';
import { S7PopulationState, createDefaultS7Population, residentRateBonusPct, residentStorageExtensionHours } from '../../core/s7/S7Population';
import {
  offlineStorageHours, offlineRateBonusPct,
  salvageTeamCount, researchTeamBonusPct, merchantRareSlots, coreGalleryTeamBonusPct,
  coreGalleryPerTypeBonusPct, habitatStaffCap, workerBuildDiscountPct, galleryDoubleYolkP,
  supplyATierRateBumpPct, supplyFreeDailyPulls, supplyTenPullTicketCost, UPGRADE_DISCOUNT_PCT_PER_LEVEL,
} from '../../core/s7/S7BuildingEffects';
import { S7EffectBlock } from '../../core/s7/S7BattleEffectBlock';
import { getS7UsableBand } from '../S7UiLayout';
import { s7FieldVisualCell } from '../S7BattleFieldOrient'; // 战场朝向唯一真源（B0.7·所有阵位换算走它）
import {
  S7SquadState, grantShip, grantPilot, grantCore, assignSlot, clearSlot, moveOrSwapFormationSlot, buildSquadLineup,
  isShipDeployed, findPilotShip, findCoreShip, findPluginShip,
  S7GameplayLineupKey, loadGameplayLineup, saveGameplayLineup, // ③b 分玩法阵容记忆
} from '../../core/s7/S7Squad';
import { buildPrebattleView, shipPowerOf, S7PrebattleView } from '../../core/s7/S7PrebattleView';
import { equipPlugin, unequipPlugin, equipCore, unequipCore, equipPilot, unequipPilot } from '../../core/s7/S7ShipLoadout';
import { coreBlocks } from '../../core/s7/S7CoreEffects';
import {
  S7PluginInventoryState, S7OwnedPlugin, addOwnedPlugin, findOwnedPlugin,
} from '../../core/s7/S7PluginInventory';
// C 抽卡三池（step1 引擎已单测）：主界面「星港补给站」进抽卡界面，本控制器只做表现层薄壳。
import { DEFAULT_S7_GACHA_CONFIG, S7GachaPoolId } from '../../core/s7/S7GachaConfig';
import {
  gachaDayIndex, openCategoryIds, currentExclusiveShipId, refreshGachaToDay,
  drawGachaMany, claimExchangeBox, availableExchangeBoxes, S7GachaDrawOutcome,
} from '../../core/s7/S7GachaService';
import { S7AdGateway, S7MockAdAdapter, S7AdPoint } from '../../core/s7/S7AdGateway';
import { S7AutoBattleRng } from '../../core/s7/S7AutoBattleRng';
// 音效/BGM 工程接口（附录C 事件钩子）：音效批（07-16）起接真声 CocosSoundAdapter。
import { SoundService } from '../../sound/SoundService';
import { CocosSoundAdapter } from '../../sound/CocosSoundAdapter';
import { SfxEvent } from '../../sound/SoundEventTypes';
// 阶段一 F·关卡三选一发奖（首通限定·三档稀缺池·Boss大奖·看广告×2）。
import { DEFAULT_S7_LEVEL_REWARD_CONFIG, S7LevelReward, S7LevelRewardStage } from '../../core/s7/S7LevelRewardConfig';
import {
  resolveLevelStage, firstBossNodeId, rollLevelChoices, resolveBossGrand, canPickExtra, S7UnitCandidates,
} from '../../core/s7/S7LevelRewardService';
// D 信标打捞（step1 引擎已单测）：主界面「打捞港」进打捞界面。
import { DEFAULT_S7_SALVAGE_CONFIG, S7BeaconTier, BEACON_RESOURCE, S7SalvageReward } from '../../core/s7/S7SalvageConfig';
import {
  startSalvage, collectSalvage, salvageAdComplete, salvageRemainingMs, isSalvageDone, salvageTeamLimit,
} from '../../core/s7/S7SalvageService';
import { addExclusiveShards, getExclusiveShardCount } from '../../core/s7/S7ExclusiveShardInventory';
import { addChest, S7ChestType, S7_CHEST_TYPES, getChestCount, openChest } from '../../core/s7/S7ChestInventory';
// 阶段一 H·宝箱开箱（星辉货舱：3选项·免费1·看广告再选1）。
import { DEFAULT_S7_CHEST_REWARD_CONFIG, S7ChestReward } from '../../core/s7/S7ChestRewardConfig';
import { rollChestOptions, chestPickLimits } from '../../core/s7/S7ChestRewardService';
// 阶段一 G·活动接全（3天行动/7天扩张：进度喂入 + 周期tick结算 + 里程碑/完成/结算发奖）。
import {
  S7ActivityType, addActivityProgress, claimMilestone, claimCompletion, tickActivityCycles, activityCycleEndTime, getActivityProgress, S7_ACTIVITY_DURATION_SEC,
} from '../../core/s7/S7ActivityProgress';
import { DEFAULT_S7_ACTIVITY_CONFIG, S7ActivityReward, S7_ACTIVITY_ACTIONS } from '../../core/s7/S7ActivityConfig';
import { listMilestones, completionView, progressWeightFor, activityCycleConfig, settlementBackfillRewards } from '../../core/s7/S7ActivityService';
// 阶段一 I·星核三渠道 + 星空宝库。
import { DEFAULT_S7_CORE_SOURCE_CONFIG } from '../../core/s7/S7CoreSourceConfig';
import { synthesizeCore, rollExpansionChoices, vaultCoreViews, vaultShipViews, grantRandomFlowCore } from '../../core/s7/S7CoreSourceService';
// 阶段一 K·人口来源(主线救回)。
import { DEFAULT_S7_POPULATION_SOURCE_CONFIG, resolveNodeRescue } from '../../core/s7/S7PopulationSourceConfig';
// 阶段一 L·战斗伤害统计（胜负弹窗都可看·双方 top5）。
import { summarizeS7BattleLog, S7BattleLogSummaryResult, S7BattleUnitDamageSummary } from '../../core/s7/S7BattleLogSummary';
// 阶段一 G2·邮件领取地基：引擎(收件/领取/计数/过期清理)已就绪，本控制器接「领取→入账」应用侧 + 邮件界面。
import {
  S7MailReward, claimMail, claimableMailCount, unreadMailCount, pruneExpiredMail, addMail,
} from '../../core/s7/S7Mailbox';
import { createDefaultS7GachaState, freePullsLeftToday, spendFreePulls } from '../../core/s7/S7GachaState';
import { createDefaultS7Salvage } from '../../core/s7/S7SalvageState';
import { createDefaultS7Merchant } from '../../core/s7/S7MerchantState';
// 升阶/升星（step1 引擎已单测）：船坞升阶 + 训练舱升星 + 背包通用碎片转换 + 开槽/战力接入。
import {
  createDefaultS7UnitTierState, getShipTier, getPilotStar, shipTierName,
  shipPluginSlotCap, shipCoreSlotOpen, SHIP_TIER_MAX, PILOT_STAR_MAX,
  shipLevelCapForTier, pilotLevelCapForStar,
} from '../../core/s7/S7UnitTierState';
import { DEFAULT_S7_ASCEND_CONFIG } from '../../core/s7/S7AscendConfig';
import { S7_HARD_CONTROL_DIMINISH } from '../../core/s7/S7AutoBattleTypes';
import { S7_TIER_ATTR_MULT, S7_PILOT_STAR_MULT } from '../../core/s7/S7PowerRating';
import { ascendShip, starupPilot, convertUniversalToExclusive } from '../../core/s7/S7AscendService';
// E 商人小站（step1 引擎已单测）：主界面「商人小站」进商店。
import { DEFAULT_S7_MERCHANT_CONFIG, S7ShopItem } from '../../core/s7/S7MerchantConfig';
import {
  refreshMerchantToCycle, buyMerchantOffer, offerRemaining, refreshMerchantShop, S7RefreshMode,
  recycleBeacon, recycleStarOre, grantMerchantFreeRefresh,
} from '../../core/s7/S7MerchantService';

const { ccclass } = _decorator;

/** demo 默认解锁的 7 栋建筑（真实游戏靠主线/教程解锁；demo 开局直接开到 1 级，便于演示养成）。 */
const S7_DEMO_DEFAULT_BUILDINGS = [
  'bld_dock', 'bld_pilot_training_bay', 'bld_habitat', 'bld_supply_station',
  'bld_salvage_port', 'bld_merchant_station', 'bld_research_tower', 'bld_rsv_core_gallery',
];
/** A-step2 demo 开局发货（DEV-TEMP·正式获取靠后面抽卡/发奖块）：默认拥有的船/驾驶员 + 默认编队。 */
const S7_DEMO_SEED_SHIPS = ['shp01', 'shp02', 'shp03', 'shp04', 'shp05'];
const S7_DEMO_SEED_PILOTS = ['pil01', 'pil02', 'pil03', 'pil04', 'pil05'];
const S7_DEMO_SEED_FORMATION: { slotRef: string; shipId: string; pilotId: string }[] = [
  { slotRef: 'p0c2', shipId: 'shp01', pilotId: 'pil01' },
  { slotRef: 'p1c2', shipId: 'shp02', pilotId: 'pil02' },
  { slotRef: 'p2c2', shipId: 'shp03', pilotId: 'pil03' },
];
/** M1 新手引导开局：只给起始编队第一组（内容无关，按角色引用，第二阶段换内容不重写）。 */
const S7_TUTORIAL_STARTER = S7_DEMO_SEED_FORMATION[0];
/**
 * M1 教程解锁船坞/训练舱/星港补给站的星矿花费。全程靠关1三选一发的 +50 星矿（合法关卡奖励·非白送）覆盖：
 * 50 −8(船坞) −5(训练舱)（步5 回写后升级改花合金 50×L^1.3·不再花星矿——教程段收支对表挂教程收尾批），
 * 关3 再 −3(解锁星港补给站) = 12，关4 再 −8(解锁打捞港) = 4，关5 再 −4(解锁商人小站) = 0，
 * 全程不为负、不靠任何白送。占位值·第二块数值校准。
 */
const S7_TUTORIAL_DOCK_UNLOCK_COST = 8;
const S7_TUTORIAL_TRAINING_UNLOCK_COST = 5;
const S7_TUTORIAL_GACHA_UNLOCK_COST = 3;
/** M1 教程关1节点（=默认起手节点·内容无关，第二阶段换内容不重写）。 */
const S7_TUTORIAL_LEVEL1_NODE = createDefaultS7MainlineProgress().currentNodeId;
/** M1 关1三选一强制选的星矿量（GDD-M §第1关 +50：覆盖全程教程的解锁/升级花费·见上 DOCK 注释；非白送·占位·第二块校准）。 */
const S7_TUTORIAL_LEVEL1_STARORE = 50;
/** M1 关2三选一强制选的武器插件（GDD-M §第2关·变更#4：选前显示"武器槽·精良"、选后揭晓真实名）。内容无关·占位 plg09(武器)。 */
const S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN = { pluginId: 'plg09', quality: 'fine' as const, slotTag: 'weapon' as const };
/** M1b-3 活动首触短教程 id（弱引导·首次打开活动面板时弹一次）。 */
const S7_FIRST_TOUCH_ACTIVITY = 'activity_intro';
/** M1c 关3抽卡强制招募的第二队伍（内容无关·下一对种子单位；显示真实配置名。护卫摆阵角色匹配=关4内容·留后）。 */
const S7_TUTORIAL_GACHA_PILOT = S7_DEMO_SEED_PILOTS[1]; // 驾驶员池抽中
const S7_TUTORIAL_GACHA_SHIP = S7_DEMO_SEED_SHIPS[1];   // 星舰池抽中
/** M1c 关3三选一强制选的补给券量（GDD-M §第3关 +2：够后面抽 2 次·驾驶员/星舰各 1）。占位·第二块校准。 */
const S7_TUTORIAL_LEVEL3_TICKETS = 2;
/** M2 关4解锁打捞港的星矿花费（GDD-M §第4关·占位·第二块校准）。 */
const S7_TUTORIAL_SALVAGE_UNLOCK_COST = 8;
/** M3 关5解锁商人小站的星矿花费（占位·全程预算见 DOCK 注释，关5时约剩4矿·第二块校准）。 */
const S7_TUTORIAL_MERCHANT_UNLOCK_COST = 4;
/** M3 关5抽卡补强强制招募的克制驾驶员（内容无关·第三个种子驾驶员；显示真实配置名）。 */
const S7_TUTORIAL_COUNTER_PILOT = S7_DEMO_SEED_PILOTS[2];
/** B 块 DEV-TEMP·开局发插件实例（待抽卡/掉落/合成接好后删）：覆盖三槽 + 品质混搭。pluginId 见 plugin_config。 */
const S7_DEMO_SEED_PLUGINS: { pluginId: string; quality: 'fine' | 'superior' | 'legendary' }[] = [
  { pluginId: 'plg02', quality: 'legendary' }, // 武器
  { pluginId: 'plg09', quality: 'fine' },      // 武器
  { pluginId: 'plg07', quality: 'superior' },  // 技能
  { pluginId: 'plg18', quality: 'fine' },      // 技能
  { pluginId: 'plg01', quality: 'legendary' }, // 战术
  { pluginId: 'plg03', quality: 'fine' },      // 战术
];
/** B 块 DEV-TEMP·开局发星核（待星核三渠道接好后删）：core10/11=流通核(步5 收编后真 id·测深装/宝库)。
 *  ⚠️ core07=陨星弹(过载核心) 已从种子剔除(块2真机)——它是首Boss n030 的固定大奖，不能开局白送，
 *  否则"打 n030→掉陨星弹"链路无法验证；新档只能靠打赢 n030 拿到 core07（反复验证用 hub 工具行「回档n029」DEV 键）。 */
const S7_DEMO_SEED_CORES = ['core10', 'core11']; // 步5 收编：旧 core01/02 占位 id 已删
/** 演出线 DEV-TEMP（07-15 Ron 令·上线前删）：五艘带皮肤舰+配对驾驶员（缺就补发·真机看真皮肤演出用）。 */
const S7_DEV_FX_SHOWCASE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['shp03', 'pil03'], ['shp06', 'pil06'], ['shp09', 'pil09'], ['shp13', 'pil13'], ['shp20', 'pil20'],
];
/** 插件槽位类型中文（仅显示用）。 */
const S7_SLOT_TAG_NAMES: Record<S7PluginSlot, string> = { weapon: '武器', skill: '技能', tactical: '战术' };
/** 品质中文（仅显示用·段二 E2 扩两档；散落的品质三元与合成 UI 切换=灰盒批接口清单）。 */
const S7_QUALITY_NAMES: Record<string, string> = { fine: '精良', superior: '优秀', legendary: '传奇', legendaryPlus: '传奇+', legendaryPlusPlus: '传奇++' };
/** 品质排序权重（越大越靠前）。插件用；驾驶员/星核暂无品质等级→0。 */
const S7_QUALITY_RANK: Record<string, number> = { legendaryPlusPlus: 5, legendaryPlus: 4, legendary: 3, superior: 2, fine: 1 };

/** 装备（统称：驾驶员/插件/星核）的引用：kind + id（pilotId / 插件 instanceId / coreId）。 */
type S7EquipKind = 'pilot' | 'plugin' | 'core';
interface S7EquipRef { kind: S7EquipKind; id: string }

/** 建筑中文名（仅显示用）。 */
const S7_BUILDING_NAMES: Record<string, string> = {
  bld_dock: '船坞',
  bld_pilot_training_bay: '训练舱',
  bld_habitat: '居住舱',
  bld_supply_station: '补给站',
  bld_salvage_port: '打捞港',
  bld_merchant_station: '商人小站',
  bld_research_tower: '研究塔',
  bld_rsv_core_gallery: '星核展厅',
};

/** 固定开发种子：同节点同阵容可复现（早期节点默认 3 舰确定性胜）。 */
const S7_DEMO_RUN_SEED = 's7-demo';
/** 演示用旗舰 = 默认阵容首舰；「升级旗舰」升它、出战时它按等级变强。 */
const S7_DEMO_FLAGSHIP_ID = 'shp01';

@ccclass('S7DemoController')
export class S7DemoController extends Component {
  private adapter: SaveStorageAdapter | null = null;
  /** 音效/BGM 服务（附录C 事件钩子·音效批起真声）。 */
  // 音效批（07-16）：Mock→真声适配器（预载失败逐条静默=流程永不因音频断；Mock 仅测试用）。
  private readonly soundAdapter = new CocosSoundAdapter();
  private readonly sound = new SoundService(this.soundAdapter);
  private session: S7RunSession | null = null;
  private playerState: S7PlayerState | null = null;
  private saveVersion = S7_CURRENT_SAVE_VERSION;
  private growthBands: S7GrowthBandParam[] = [];
  private flagshipBaseHp = 0;
  private flagshipBaseAtk = 0;

  private statusLabel: Label | null = null;
  private resultLabel: Label | null = null;

  // ===== B2 战斗色块演出（就地·画在备战 prebattleGfx 上）=====
  private viewW = 720;
  private viewH = 1280;
  /** 当前在播的回放（null=未在播）。 */
  private playback: S7BattlePlayback | null = null;
  private frameIdx = 0;
  private stepClock = 0;
  /** 每帧停留秒数（在 startPlayback 按总帧数压到约 3 秒内）。 */
  private stepSec = 0.06;
  // L：倍速 1/2/3x（回放提速）+ 入场仪式（开战我方从下方滑入）。
  private playbackSpeed = 1;
  private speedBtnLabel: Label | null = null;
  private introClock = 0;
  private introSec = 0;        // >0 = 入场进行中
  private introYOffset = 0;    // 我方单位入场 y 偏移（负=在下方·滑到 0）
  private playing = false;
  /** 单位 unitId → 战场屏幕局部坐标 + 是否头目（块更大）。 */
  private posById = new Map<string, { x: number; y: number; boss: boolean }>();
  /** 回放结束后再显示的结果文案（播放期间先按住）。 */
  private pendingResult: { text: string; color: Color } | null = null;

  // ===== C 养成接入（离线产出 + 建筑升级）=====
  private runtime: S7ConfigRuntime | null = null;
  private model: S7MainlineModel | null = null;
  private buildings: S7BuildingState | null = null;
  private population: S7PopulationState | null = null;
  /** 本次上线算出的未领回港报告（null=无；弹窗必领才关，防丢奖·块1）。 */
  private reportPending: S7ReturnReportData | null = null;
  private reportNode: Node | null = null;
  private reportBodyLabel: Label | null = null;
  private reportDoubleBtn: Node | null = null;
  private reportDoubleLabel: Label | null = null; // 块5：券态文案「广告券×N」就地改写用

  // ===== 块5 · 今日补给箱 / 战败安慰包 / 星港趣事 =====
  /** hub 今日补给箱礼盒岛（活动区旁·B1.1）：当日已开→隐藏（券态恢复·统一三态）。 */
  private hubSupplyChestNode: Node | null = null;
  private hubSupplyChestSubLabel: Label | null = null; // 礼盒副标签（券态「广告券×N」提示）
  /** 开箱结果确认弹窗（块5 完善批·Ron 2026-07-06）：奖励入账后弹·必点「收下」才关（吞触摸·杀进程不丢奖）。 */
  private supplyChestResultNode: Node | null = null;
  private supplyChestResultLabel: Label | null = null; // 逐行奖励明细（emoji+名称+数量）
  /** 主线战败安慰包（本场·transient）：pack=null 表示今日已发满只给鼓励文案；doubled=本场已翻倍。 */
  private pendingConsolation: { pack: Record<string, number> | null; doubled: boolean } | null = null;
  private consolationStripNode: Node | null = null;   // 结算卡下方附属小块（战败·仅主线）
  private consolationTextLabel: Label | null = null;
  private consolationAdBtn: Node | null = null;
  private consolationAdLabel: Label | null = null;
  /** 星港趣事小弹泡（独立 view·守⑧）。 */
  private anecdoteView: S7AnecdoteBubbleView | null = null;

  // ===== 块2 星港悬赏板 + 块4 每日推演（作战大厅容器·GDD S10.8/S10.9）=====
  /** hub「作战大厅」入口（关5 强引导结束后解锁·内含悬赏板+每日推演两页签·Ron 2026-07-05 架构）。 */
  private hubCombatHallBtn: Node | null = null;
  /** hub「回廊」入口（首Boss通关后解锁·refresh 门控·维持独立不进大厅）。 */
  private hubCorridorBtn: Node | null = null;
  /** 独立全屏深空回廊塔页 view（守工作流程⑧·块3）。 */
  private corridorView: S7CorridorTowerView | null = null;
  /** 备战处于"回廊模式"（出战改打该层·敌情/规则按它）；null=正常主线备战。 */
  private corridorPrepLayer: number | null = null;
  /** 正在演出/结算的回廊层（结果窗单键返回路由用）；null=非回廊战斗。 */
  private corridorActiveLayer: number | null = null;
  /** 作战大厅容器 view（悬赏板+每日推演双页签·守工作流程⑧·块4）。悬赏 view 由大厅内部持有。 */
  private combatHall: S7CombatHallView | null = null;
  /** 正在演出/结算的推演题（结果窗单键返回路由用）；null=非推演战斗。 */
  private puzzleActiveId: string | null = null;
  /** DEV-TEMP（块4·上线前删）：跳题内存覆盖——设了就用它当"今日题"（不碰真存档态·真题 solved 存活）；hub 入口清零回真题。 */
  private devPuzzleId: string | null = null;
  /** 备战处于"悬赏模式"（出战改打该卡·词缀标记按它）；null=正常主线备战。 */
  private bountyPrepCardId: string | null = null;
  /** 正在演出/结算的悬赏卡（结果窗单键返回路由用）；null=主线战斗。 */
  private bountyActiveCardId: string | null = null;
  /** 护航赢后待抉择的遇袭上下文（卡 + 本单刚结算的入账·迎战失败按它折损）；null=无遇袭。 */
  private bountyAmbushPending: { card: S7BountyCard; settledRewards: Record<string, number> } | null = null;
  /** 备战底部「选择关卡」键（悬赏备战隐藏·主线专属）+「返回」键文字（悬赏备战改「返回悬赏板」）。 */
  private prebattleLevelSelBtn: Node | null = null;
  private prebattleBackLabel: Label | null = null;
  /** 当前备战所属玩法（③b 分玩法阵容记忆·四把钥匙：主线/回廊/护航/演习）。openPrebattle 按模式设、编队改动后据它存记忆。 */
  private prebattleGameplay: S7GameplayLineupKey = 'mainline';
  // DEV-TEMP（块2悬赏板真机验收批·上线前删）：必遇袭武装标志 + 重掷计数（均仅内存·不入档）。
  // salt 绑启动时间避免"重启后重掷"与上次会话的 DEV 批撞卡 id（salt 仅内存、裸 0 起会复现同 fakeKey）。
  private devBountyForceAmbush = false;
  private devBountySalt = Math.floor(Date.now() % 997);
  private devBountyLastBatchKey = 0;
  private battleRunService: S7BattleRunService = new S7BattleRunService();
  /** 建筑面板叠加层 + 每行 Label（与 S7_DEMO_DEFAULT_BUILDINGS 等长平行）。 */
  private baseNode: Node | null = null;
  private baseRowLabels: Label[] = [];
  private baseCloseBtn: Node | null = null;

  // ===== A-step2 战前备战界面 =====
  private squad: S7SquadState | null = null;
  private prebattleNode: Node | null = null;
  private prebattleGfx: Graphics | null = null;     // 画底板 + 敌情预览 + 九宫格（也用于"战斗即战前"的就地演出）
  private fxLayer: S7BattleFxLayer | null = null;   // Cocos 壳批：战斗演出层（资源就绪时取代色块回放）
  private fxActive = false;                          // 本场走演出层（跳过/倍速/收尾分流用）
  private readonly fxRefMap = new Map<string, { unitRef: string; roleTag: string }>();
  private prebattleInfoLabel: Label | null = null;  // 节点名 + 我方VS推荐战力 + 敌情概要
  private prebattleCellLabels: Label[] = [];        // 9 格文字(与 SLOTS 平行)
  private prebattleCellNodes: Map<string, Node> = new Map(); // 9 格真节点(键=slotRef如"p0c0")——教程锁步定位高亮/挖洞用
  /** 备战可交互 UI 容器（标题/信息/九宫格/底部按钮）；开战时整体隐藏，让 gfx 就地演战斗。 */
  private prebattleUiNode: Node | null = null;
  /** 备战内嵌战斗的「跳过」键（挂在备战面板上，开战时显示）。 */
  private prebattleSkipBtn: Node | null = null;
  /** L：倍速键（开战时与跳过同显隐）。 */
  private prebattleSpeedBtn: Node | null = null;
  /** 当前选中的编队格(p{r}c{c})；null=未选。上场目标格。 */
  private prebattleSelSlot: string | null = null;
  /** 当前选中的星舰（上阵界面左侧列表/点在场格选中）；装配/上场/下场都针对它。 */
  private prebattleSelShip: string | null = null;
  /** 选择关卡浮层 + 有遭遇可玩的节点 id（init 算）。 */
  private levelSelectNode: Node | null = null;
  private encounterNodeIds: string[] = [];

  // ===== 上阵界面（点九宫格弹出·下半部分·左选星舰/右详情+装配+上下场/底部返回）=====
  private boardingNode: Node | null = null;
  private boardingShipListNode: Node | null = null; // 左侧拥有星舰列表（刷新重建）
  private boardingDetailLabel: Label | null = null; // 右侧选中船详情
  private boardingBoardBtnLabel: Label | null = null; // 右侧 上场/下场 按钮文字
  private boardingActionsNode: Node | null = null;  // 右侧 装配/上下场 按钮容器（没选船时隐藏）
  private boardingEquipBtn: Node | null = null;     // 右侧「装配」真按钮节点（教程锁步高亮用）
  private boardingBoardBtn: Node | null = null;     // 右侧「上场/下场」真按钮节点（教程锁步高亮用）
  private boardingShipRowBtns: Map<string, Node> = new Map(); // 左侧星舰行真按钮节点(键=shipId，刷新重建)——教程锁步高亮用

  // ===== B 块 单舰装配（驾驶员 + 插件×3槽 + 星核，统称"装备"）=====
  private pluginInventory: S7PluginInventoryState | null = null;
  /** pluginId → 槽位类型（武器/技能/战术），init 从 plugin_config 建。 */
  private pluginSlotMap: Map<string, S7PluginSlot> = new Map();

  // ===== 星港主界面 hub（顶部货币栏 + 建筑入口 + 出战）=====
  private hubOreLabel: Label | null = null;
  private hubCargoLabel: Label | null = null;
  private hubTicketLabel: Label | null = null;
  /** 中央临时提示（"即将开放/未解锁"等·自动淡出）。 */
  private hubToastLabel: Label | null = null;

  // ===== C 抽卡界面（星港补给站·三池）=====
  private adGateway: S7AdGateway | null = null;
  private gachaNode: Node | null = null;
  private gachaPool: S7GachaPoolId = 'recruit';
  private gachaInfoLabel: Label | null = null;   // 当前池说明（今日开放类别 / 当期专属 + 保底进度）
  private gachaTicketLabel: Label | null = null;  // 补给券余量
  private gachaResultLabel: Label | null = null;  // 本次出货明细
  private gachaExchangeLabel: Label | null = null; // 专属池兑换进度
  private gachaClaimBtn: Node | null = null;       // 专属池「领兑换箱」按钮（有箱才显示）
  private gachaTabBtns: { pool: S7GachaPoolId; node: Node }[] = [];
  private gachaSingleBtn: Node | null = null;      // 单抽按钮（券<1 变灰）
  private gachaTenBtn: Node | null = null;         // 十连按钮（券<10 变灰）
  private gachaSponsorBtn: Node | null = null;     // 赞助补给广告键（块5 统一三态·用尽即隐）
  private gachaSponsorLabel: Label | null = null;
  private gachaBackBtn: Node | null = null;        // 「返回星港」（强引导：去自动跳转·要求玩家真点）

  // ===== D 打捞港界面（信标打捞）=====
  private salvageNode: Node | null = null;
  private salvageSelTier: S7BeaconTier = 'common';
  private salvageSelHours = 2;
  private salvageInfoLabel: Label | null = null;    // 信标存量 + 打捞队占用
  private salvageResultLabel: Label | null = null;  // 收菜/操作结果
  private salvageListNode: Node | null = null;      // 进行中任务列表容器（刷新重建）
  private salvageTierBtns: { tier: S7BeaconTier; node: Node }[] = [];
  private salvageHourBtns: { hours: number; node: Node }[] = [];
  private salvageStartBtn: Node | null = null;       // 「开始打捞」（强引导：要求玩家真点）
  private salvageCollectBtns: Map<string, Node> = new Map(); // missionId→「收菜」按钮（列表刷新重建·每帧重抓）
  private salvageTicking = false;                   // 打捞界面开着时每秒刷新倒计时

  // ===== E 商人小站界面 =====
  private merchantNode: Node | null = null;
  private merchantStarLabel: Label | null = null;  // 星贝余量 + 刷新次数
  private merchantListNode: Node | null = null;     // 货架 offer 列表容器（刷新重建）
  private merchantSellNode: Node | null = null;      // 回收按钮容器（随等级解锁·刷新重建）
  private merchantResultLabel: Label | null = null;
  private merchantTicketBuyBtn: Node | null = null; // 补给券那行的「买」按钮（列表刷新重建·强引导 case43 用）
  private merchantAdRefreshBtn: Node | null = null;   // 广告刷新键（块5 统一三态·用尽即隐）
  private merchantAdRefreshLabel: Label | null = null;

  // ===== J 建筑升级入口（弹框·各建筑共用 + 主界面等级/可升提示）=====
  private buildingUpgradeNode: Node | null = null;
  private buildingUpgradeTarget = '';
  private buUpTitleLabel: Label | null = null;
  private buUpInfoLabel: Label | null = null;
  private buUpBtn: Node | null = null;           // 升级按钮（满级/买不起→灰）
  private hubBuildingTracks: { id: string; label: Label }[] = []; // hub 建筑入口副标签(显等级/可升↑)

  // ===== J-step2 船坞(星舰升级)/训练舱(驾驶员升级) 养成界面 =====
  private dockNode: Node | null = null;
  private dockListNode: Node | null = null;
  private dockInfoLabel: Label | null = null;
  private dockResultLabel: Label | null = null;
  private dockBackBtn: Node | null = null;       // 「返回星港」（强引导：去自动跳转·要求玩家真点）
  private trainingNode: Node | null = null;
  private trainingListNode: Node | null = null;
  private trainingInfoLabel: Label | null = null;
  private trainingResultLabel: Label | null = null;
  private trainingBackBtn: Node | null = null;   // 「返回星港」（同上）
  /** 船坞/训练舱列表里每行「管理」按钮（kind:unitId → Node），refreshUnitTrain() 重建时刷新；强引导高光用。 */
  private manageRowBtns = new Map<string, Node>();
  private manageRowBtn(kind: 'ship' | 'pilot', unitId: string): Node | null {
    return this.manageRowBtns.get(`${kind}:${unitId}`) ?? null;
  }
  // 居住舱(人口中枢) / 星核展厅(收藏) 信息界面
  private habitatNode: Node | null = null;
  private habitatInfoLabel: Label | null = null;
  private galleryNode: Node | null = null;
  private galleryInfoLabel: Label | null = null;
  // 单位管理面板（船坞单舰 / 训练舱驾驶员共用：详情 + 升级/升阶升星/装配·预留属性&技能详情）
  private unitManageNode: Node | null = null;
  private unitManageKind: 'ship' | 'pilot' = 'ship';
  private unitManageId = '';
  private unitManageInfoLabel: Label | null = null;
  private unitManageResultLabel: Label | null = null;
  private unitManageAscendLabel: Label | null = null; // 升阶/升星 按钮文字
  private unitManageEquipBtn: Node | null = null;      // 装配按钮(仅星舰显示)
  private unitManageBackBtn: Node | null = null;        // 「返回」（强引导：去自动跳转·要求玩家真点）
  // 背包·通用碎片转换（点使用→选专属单位→选数量→转换·Ron 2026-06-21）
  private backpackNode: Node | null = null;
  private backpackKind: 'ship' | 'pilot' = 'ship';
  private backpackTargetId = '';
  private backpackAmount = 1;
  private backpackInfoLabel: Label | null = null;
  private backpackListNode: Node | null = null;
  private backpackAmountLabel: Label | null = null;
  // H-step2：背包三页签（资源总览 / 宝箱 / 碎片转换）。
  private backpackTab: 'resource' | 'chest' | 'convert' = 'resource';
  private backpackTitleLabel: Label | null = null;
  private backpackConvertNode: Node | null = null; // 碎片转换专用控件组（仅 convert 页显）
  // H-step2：星辉货舱开箱浮层（3 选项·免费选 1·看广告再选 1·盖在背包之上）。
  private chestOpenNode: Node | null = null;
  private chestOpenTitleLabel: Label | null = null;
  private chestOpenListNode: Node | null = null;
  private chestOpenAdBtnNode: Node | null = null;
  private chestOpenMsgLabel: Label | null = null;
  /** 当前开箱状态（开箱浮层用）。 */
  private chestOpen: {
    chestId: S7ChestType; options: S7ChestReward[]; picked: boolean[];
    freeLeft: number; adLeft: number; adUnlocked: boolean; consumed: boolean;
  } | null = null;
  // G-step2：活动界面（3天行动/7天扩张·进度条/里程碑领/完成领/倒计时）。
  private activityNode: Node | null = null;
  private activityTitleLabel: Label | null = null;
  private activityInfoLabel: Label | null = null;
  private activityListNode: Node | null = null;
  private activityMsgLabel: Label | null = null;
  private activityType: S7ActivityType = 'action3';
  // I-step2：星空宝库（兑换星核/专属舰 + 碎片合成）+ 扩张宝藏开箱。
  private vaultNode: Node | null = null;
  private vaultInfoLabel: Label | null = null;
  private vaultListNode: Node | null = null;
  private vaultMsgLabel: Label | null = null;
  private expOpenNode: Node | null = null;
  private expOpenTitleLabel: Label | null = null;
  private expOpenListNode: Node | null = null;
  private expOpenMsgLabel: Label | null = null;
  /** 当前扩张宝藏开箱状态。 */
  private expOpen: { options: string[]; isFirstSelect: boolean; picked: boolean; consumed: boolean } | null = null;
  // 邮件界面（阶段一 G2·从 hub「邮件」入口进；活动结算/抽卡轮换补发/补偿的领取管道）
  private mailNode: Node | null = null;
  private mailInfoLabel: Label | null = null;
  private mailListNode: Node | null = null;
  private mailResultLabel: Label | null = null;
  private hubMailSubLabel: Label | null = null; // hub「邮件」入口副标签（refresh 显可领数/红点）
  private loadoutNode: Node | null = null;
  private loadoutTitleLabel: Label | null = null;
  private loadoutMsgLabel: Label | null = null;
  private loadoutBackBtn: Node | null = null; // 「返回」（强引导：去自动跳转·要求玩家真点）
  /** 装备列表容器（每次刷新清空重建：驾驶员/插件分三类/星核 + 装在哪艘船标记）。 */
  private loadoutListNode: Node | null = null;
  private loadoutItemBtns: Map<string, Node> = new Map(); // 装配列表条目真按钮节点(键=`${kind}:${id}`，刷新重建)——教程锁步高亮用
  // 装备详情弹窗：标题/信息 + 取消 + 主操作按钮(装备/卸下，文字与行为按状态变)。
  private equipDetailNode: Node | null = null;
  private equipDetailTitle: Label | null = null;
  private equipDetailInfo: Label | null = null;
  private equipDetailActionLabel: Label | null = null;
  private equipDetailActionBtn: Node | null = null; // 装备详情弹窗主操作真按钮节点（教程锁步高亮用）
  /** 当前详情弹窗针对的装备 + 主操作模式。 */
  private equipPending: S7EquipRef | null = null;
  private equipActionMode: 'equip' | 'unequip' | 'move' = 'equip';
  // 移动确认弹窗（装备已在别船时二次确认）。
  private equipConfirmNode: Node | null = null;
  private equipConfirmLabel: Label | null = null;
  /** 本场战斗是否胜（finishPlayback 据此路由：胜→下一关备战 / 败→失败弹窗）。 */
  private pendingWon = false;
  /** K：本次首通主线救回的人口描述（拼进结果文案·无则空）。 */
  private pendingRescueText = '';
  /** L：上一战伤害统计（胜负弹窗的「伤害统计」按钮用）。 */
  private lastBattleSummary: S7BattleLogSummaryResult | null = null;
  private battleStatsNode: Node | null = null;
  private battleStatsListNode: Node | null = null;
  /** 战斗结果弹窗（胜/败统一）：标题/文案/右键文字（胜=下一关·败=再次挑战）。弹出时背景保留刚结束的战斗画面。 */
  private resultPopupNode: Node | null = null;
  private resultTitleLabel: Label | null = null;
  private resultMsgLabel: Label | null = null;
  private resultRightLabel: Label | null = null;
  /** M0·强引导遮罩（锁操作+挖洞聚光+引导文字，M1-M3 复用）：满屏吞触摸 + 目标处不压暗(正常亮) + 高光框 + 文字。 */
  private tutorialOverlayNode: Node | null = null;
  private tutorialDimGfx: Graphics | null = null;       // 暗化层：目标包围盒处挖洞(不盖暗)→目标正常亮，其余压暗
  private tutorialHighlightGfx: Graphics | null = null;
  private tutorialTextLabel: Label | null = null;
  private tutorialNextLabel: Label | null = null;
  private tutorialNextHandler: (() => void) | null = null;
  /** M0·弱引导首触短教程弹窗（M1-M3 复用）：文字 + 跳过/下一步。 */
  private tutorialPopupNode: Node | null = null;
  private tutorialPopupTextLabel: Label | null = null;
  private tutorialPopupSkipHandler: (() => void) | null = null;
  private tutorialPopupNextHandler: (() => void) | null = null;
  /** M2·交互式强引导（不锁操作）：顶部提示条 + 目标轮询（玩家在真实 UI 完成目标 → update() 检测推进）。 */
  private tutorialHintNode: Node | null = null;
  private tutorialHintLabel: Label | null = null;
  private tutorialInteractiveGoal: (() => boolean) | null = null;
  private tutorialMerchantTicketBaseline = 0; // M3-1a 商人买补给券：进店时补给券基准（买多一张才算完成）
  // 交互式引导改版（Ron 真机反馈）：教学不出自己的按钮，让玩家点真界面那个按钮/卡——
  // 闪烁高亮框（不锁操作）框住目标真按钮 + update() 轮询玩家完成。
  private tutorialFlashNode: Node | null = null;   // 满屏不吞触摸·只画闪烁高亮框
  private tutorialFlashGfx: Graphics | null = null;
  private tutorialFlashTarget: Node | null = null; // 当前要闪烁高亮的真按钮/卡
  private tutorialDimHoleTarget: Node | null = null; // 挖洞范围（默认=tutorialFlashTarget；传更大的卡片节点可保留弹窗自身文字可见）
  private tutorialFlashClock = 0;                   // 闪烁动画相位累加（update 用）
  /** 留洞锁屏（拖拽步专用）：四块挡板盖住目标四周(压暗+吞触摸)，目标包围盒处真留空洞——
   *  洞内无任何节点→原生触摸序列(start/move/end)直通底下真节点，drag 手势能正常完成；洞外四块各自挡触摸。 */
  private tutorialDragLockNode: Node | null = null;
  private tutorialDragLockTop: Node | null = null;
  private tutorialDragLockBottom: Node | null = null;
  private tutorialDragLockLeft: Node | null = null;
  private tutorialDragLockRight: Node | null = null;
  private tutorialDragLockTopGfx: Graphics | null = null;
  private tutorialDragLockBottomGfx: Graphics | null = null;
  private tutorialDragLockLeftGfx: Graphics | null = null;
  private tutorialDragLockRightGfx: Graphics | null = null;
  /** DEV-TEMP：左上角常驻测试键（跳过引导/重置教程）——教程各遮罩激活时也要置顶可点，见 raiseTutorialDevBar()。上线前删。 */
  private tutorialDevBarNode: Node | null = null;
  private tutorialInfoMode = false;                 // 纯讲解步（遮罩点任意处继续·无按钮）
  private tutorialForcedPickIndex: number | null = null; // 强制三选一：只允许点这张卡（防御·锁死遮罩已挡住其余）
  /** 建筑解锁确认弹框（真功能·点未解锁建筑弹出）：花XX星矿解锁该建筑至Lv1？ */
  private buildingUnlockDialogNode: Node | null = null;
  private buildingUnlockDialogTextLabel: Label | null = null;
  private buildingUnlockConfirmBtn: Node | null = null; // 「确认」按钮 Node（教程高亮用）
  private buildingUnlockPendingId: string | null = null;
  /** M1：强引导步骤里要高光指引的真实按钮 Node 引用（出战/船坞入口/训练舱入口/备战面板开始战斗）。 */
  private hubSortieBtn: Node | null = null;
  private hubDockEntryNode: Node | null = null;
  private hubTrainingEntryNode: Node | null = null;
  private hubActivityEntryNode: Node | null = null; // 「3天行动」入口（M1b-3 活动短教程高光）
  private hubGachaEntryNode: Node | null = null;    // 「星港补给站」入口（M1c 抽卡引导高光）
  private hubSalvageEntryNode: Node | null = null;  // 「打捞港」入口（M2 打捞引导高光）
  private hubMerchantEntryNode: Node | null = null; // 「商人小站」入口（M3 商人引导高光）
  private prebattleSortieBtn: Node | null = null;
  private resultHomeBtn: Node | null = null;        // 结果弹窗「返回星港」（强引导 step3 高光）
  private resultHomeLabel: Label | null = null;     // 「返回星港」文字（悬赏战斗改「返回悬赏板」）
  private resultLevelBtn: Node | null = null;       // 结果弹窗「选择关卡」键（悬赏战斗时隐藏·单键返回）
  private unitManageUpgradeBtn: Node | null = null;  // 单位管理「升级」（强引导 step5/8 高光）
  /** F·关卡三选一发奖浮层（首通胜利后盖在结果弹窗之上·必须选 1 个才离开）。 */
  private levelRewardNode: Node | null = null;
  private levelRewardTitleLabel: Label | null = null;
  private levelRewardFixedLabel: Label | null = null;  // 固定奖励列表 + 必给大奖预告
  private levelRewardListNode: Node | null = null;      // 三张选项卡容器
  private levelRewardMsgLabel: Label | null = null;
  /** ③(块2真机终稿)三选一屏＝唯一奖励屏；块5 扩两键：选完同屏并排浮现「📺固定奖励×2」(#3)+「📺再选一个」(#4)+「继续」（S13 决策⑥·全部关卡）。 */
  private levelRewardAdBtnNode: Node | null = null;
  private levelRewardAdLabel: Label | null = null;
  private levelRewardExtraBtnNode: Node | null = null; // #4 再选一个（块5）
  private levelRewardExtraLabel: Label | null = null;
  /** 一窗两点（Ron 07-16）：三选一屏内的终局三键（选关/回港/下一关·选完浮现）+📊 统计小键；教程期不显走旧直通链。 */
  private levelRewardEndBtnNodes: Node[] = [];
  private levelRewardStatsBtnNode: Node | null = null;
  /** Boss 大奖特写「收下」后要续跑的终局动作（一窗两点路径专用；教程旧链=null→收下即露结算窗）。 */
  private pendingGrandAction: (() => void) | null = null;
  /** 本次首通待发的三选一上下文（继续/离开后清空）。 */
  private pendingLevelReward: {
    nodeId: string; stage: S7LevelRewardStage; isBoss: boolean;
    choices: S7LevelReward[]; bossGrand: S7LevelReward | null;
    softGrants: { resourceId: string; amount: number }[]; // 首通必得(固定)软货币（结算已发一份；选完看广告可再翻一份）
    forcedPickIndex?: number; // M1 关1强引导：写死三选一、强制选此索引（星矿），其余仅展示
    pickedIndex: number | null; // null=未选；≥0=已选（锁卡+浮现两广告键/继续·块5 全部关卡；无键可显则直接走）
    softDoubled: boolean;       // #3 已看广告把固定奖励翻倍（就地×2、防重复）
    extraPickArmed: boolean;    // #4 广告已看完·等玩家从剩两张里再选一张
    extraPickedIndex: number | null; // #4 已再选的那张（也锁定✓）
  } | null = null;
  /** ②(块2真机)Boss 首通大奖特写弹窗（陨星弹/星辉货舱·大字名+图标占位+效果说明+收下·三选一确认后·结算窗前）。 */
  private grandRewardNode: Node | null = null;
  private grandRewardTitleLabel: Label | null = null;
  private grandRewardDescLabel: Label | null = null;

  /** 由 MainSceneController 在 S7 配置预载成功后调用：注入 runtime + 存储适配器，建会话 + 搭色块 UI。 */
  init(runtime: S7ConfigRuntime, adapter: SaveStorageAdapter): void {
    this.adapter = adapter;
    this.runtime = runtime;
    // 演出层资源预载（异步幂等）+ unitStatRef→{unitRef,roleTag} 解析表（演出签名查表键）。
    S7BattleFxLayer.preload();
    this.soundAdapter.init(); // 音效批：预载全部短音效（失败逐条静默·不阻塞流程）
    this.fxRefMap.clear();
    runtime.getAll<S7BattleUnitStatParam>('battle_unit_stat_param').forEach((row) => {
      const r = row as unknown as { rowId?: string; unitRef?: unknown; roleTag?: unknown };
      if (typeof r.rowId === 'string') {
        this.fxRefMap.set(r.rowId, {
          unitRef: typeof r.unitRef === 'string' ? r.unitRef : '',
          roleTag: typeof r.roleTag === 'string' ? r.roleTag : '',
        });
      }
    });
    const model = S7MainlineModel.fromRuntime(runtime);
    this.model = model;
    this.growthBands = runtime.getAll<S7GrowthBandParam>('growth_band_param');
    // 旗舰基础血/攻（用于状态行展示"有效血/攻随等级变大"，让升级变强一眼可见）。
    const flagshipBase = runtime
      .getAll<S7BattleUnitStatParam>('battle_unit_stat_param')
      .find((u) => u.targetType === 'ship' && u.unitRef === S7_DEMO_FLAGSHIP_ID);
    this.flagshipBaseHp = flagshipBase?.maxHp ?? 0;
    this.flagshipBaseAtk = flagshipBase?.attack ?? 0;
    // 有遭遇可玩的节点（供「选择关卡」列表）：按 id 排序去重。
    const encNodes = new Set<string>();
    runtime.getAll<S7BattleEncounterParam>('battle_encounter_param').forEach((e) => encNodes.add(e.nodeRef));
    this.encounterNodeIds = Array.from(encNodes).sort();

    // 读 S7 存档（独立域）：取出资源 + 主线进度 + 单位等级，建最小循环会话（带 unitLevels → 升级反映到战斗）。
    const now = Date.now();
    const loaded = loadS7Save(adapter, now);
    this.playerState = loaded.data.playerState;
    this.saveVersion = loaded.data.saveVersion;
    // A-step2：拿阵容引用 + demo 开局发货(默认拥有/默认编队)，再把 squad 喂会话(出战用玩家编队)。
    this.squad = this.playerState.squad;
    // B 块：拿插件库存引用 + 建 pluginId→槽位 映射（装/卸判同类槽 + 显示用）。
    this.pluginInventory = this.playerState.pluginInventory;
    runtime.getAll<S7PluginConfig>('plugin_config').forEach((c) => this.pluginSlotMap.set(c.pluginId, c.slotTag));
    // M1：老档(存档迁移来的、教程还在默认状态=step0)视为已过完教程，保留旧版"一进来全发好"体验；
    // 新档真走教程，初始锁定、靠教程逐步解锁/发货。
    const tutorial = this.playerState.tutorial;
    if (!loaded.isNew && tutorial.strongGuideStep === 0 && !tutorial.strongGuideDone) {
      completeStrongGuide(tutorial);
    }
    if (tutorial.strongGuideDone && tutorial.strongGuideStep === 0) {
      // 仅"迁移的老档/开局即跳过引导"(step 仍为 0)走旧 demo 全发好；
      this.ensureDemoSquadSeeded();
    } else if (!tutorial.strongGuideDone) {
      this.ensureTutorialStarterSeeded();
    }
    // 自然走完教程(done 且 step>0)：保留玩家教程中挣得的状态，不再发货（不白送星核等）。
    // 演出线 DEV-TEMP（07-15 Ron 令·上线前随 DEV 清单删）：引导完成的档（含自然走完教程档）
    // 补发五艘带皮肤舰——独立于上面发货分支（那两支覆盖不到自然完教程档）；教程中不发（护强引导拥有态）。
    if (tutorial.strongGuideDone) this.ensureFxShowcaseShipsGranted();
    this.session = new S7RunSession(
      this.playerState.resources,
      this.playerState.mainlineProgress,
      runtime,
      model,
      this.playerState.unitLevels,
      this.playerState.squad,
      this.playerState.pluginInventory, // B 块：编队里装的插件实例真进战斗
    );

    // C 养成接入：拿建筑/人口引用、确保默认建筑已解锁、按"上次在线→现在"算离线收益（待领取）。
    const buildings = this.playerState.buildings;
    const population = this.playerState.population;
    this.buildings = buildings;
    this.population = population;
    if (tutorial.strongGuideDone) {
      this.ensureDefaultBuildingsUnlocked(); // 就地解锁 buildings（同引用）
    }
    // 块1 回港报告：离线+巡逻+已完成打捞 聚合成一份（S10.10）；打捞奖励确定性预掷（种子=任务id+endTime，重进不换奖）。
    const report = buildS7ReturnReport(
      model, buildings, population, this.playerState.mainlineProgress,
      this.playerState.salvage, DEFAULT_S7_SALVAGE_CONFIG, loaded.data.lastOnlineTime, now,
    );
    this.reportPending = report.hasAny ? report : null;

    // C 抽卡：赞助补给看广告得券——首发接 mock 适配器（确定性·阶段五换真 SDK，玩法零改）。
    this.adGateway = new S7AdGateway(new S7MockAdAdapter());

    this.buildUi();
    this.tickActivities(); // G：加载时滚动活动周期·到期结算宝藏走邮件（离线期间到期的也补发）
    this.refresh();
    // 回港报告：开场唯一聚合弹窗（S13.1 五原则②：开场广告决策点 ≤1）；强引导期间不弹（防与锁屏遮罩打架），教程结束时补弹。
    if (this.reportPending && !this.isStrongGuideActive()) {
      this.openReturnReport();
    } else {
      this.maybeShowAnecdote(); // 块5 星港趣事：开场没报告可弹才轮到它（报告在场时由领取后补触发）
    }
    // M1 强引导：新手没走完 → 归一冷启动恢复步 + 展示当前引导步（开场/续上次进度）。
    if (this.isStrongGuideActive()) {
      this.normalizeTutorialResumeStep();
      this.runTutorialStep();
    }
  }

  /** demo 便利：把 7 栋默认建筑解锁到 1 级（仅对尚未解锁的，保留已升等级）。 */
  private ensureDefaultBuildingsUnlocked(): void {
    if (!this.buildings) return;
    for (const id of S7_DEMO_DEFAULT_BUILDINGS) {
      if (!isBuildingUnlocked(this.buildings, id)) unlockBuilding(this.buildings, id);
    }
  }

  /** DEV-TEMP·开局发货：空阵容时给默认拥有的船/员 + 默认编队，保证一进来就能编队出战。
   *  ⚠️ 正式获取系统(抽卡/关卡发奖/打捞)接好后删本方法。 */
  private ensureDemoSquadSeeded(): void {
    if (!this.squad) return;
    // 船/员/编队：仅对全新空阵容发货。
    if (this.squad.ownedShips.length === 0) {
      for (const s of S7_DEMO_SEED_SHIPS) grantShip(this.squad, s);
      for (const p of S7_DEMO_SEED_PILOTS) grantPilot(this.squad, p);
      for (const f of S7_DEMO_SEED_FORMATION) assignSlot(this.squad, f.slotRef, f.shipId, f.pilotId);
      // C DEV-TEMP：顺带发一批补给券，方便一进来就能抽十连演示（正式券来源=赞助补给/商人/活动）。
      if (this.playerState && (this.playerState.resources.supplyTicket ?? 0) < 188) this.playerState.resources.supplyTicket = 188;
      // D DEV-TEMP：顺带发各档信标，方便一进来就能打捞演示（正式信标来源=商人/活动/关卡/打捞概率）。
      if (this.playerState) {
        const r = this.playerState.resources;
        if ((r.beaconCommon ?? 0) < 8) r.beaconCommon = 8;
        if ((r.beaconRare ?? 0) < 5) r.beaconRare = 5;
        if ((r.beaconEpic ?? 0) < 3) r.beaconEpic = 3;
        // E DEV-TEMP：给一笔星贝，方便一进来就能在商人小站买东西（正式星贝来自出战/回收）。
        if ((r.starCargo ?? 0) < 50000) r.starCargo = 50000;
        // J DEV-TEMP：给星矿/合金/驾驶记录，方便测建筑升级 + 船坞(星舰升级·花矿/合金)/训练舱(驾驶员升级·花驾驶记录)。
        if ((r.starOre ?? 0) < 100000) r.starOre = 100000;
        if ((r.hullAlloy ?? 0) < 100000) r.hullAlloy = 100000;
        if ((r.pilotToken ?? 0) < 5000) r.pilotToken = 5000;
        // 升阶升星 DEV-TEMP：发通用舰/员碎片(测背包转换) + 给各 seed 单位一笔专属碎片(测升阶/升星)。
        if ((r.shipBlueprint ?? 0) < 300) r.shipBlueprint = 300;
        if ((r.pilotShardUniversal ?? 0) < 300) r.pilotShardUniversal = 300;
        for (const s of S7_DEMO_SEED_SHIPS) addExclusiveShards(this.playerState.exclusiveShards, s, 200);
        for (const p of S7_DEMO_SEED_PILOTS) addExclusiveShards(this.playerState.exclusiveShards, p, 200);
      }
    }
    // B 块 DEV-TEMP：插件/星核「空就补发」（独立判定 → 已有 A 存档也能直接体验深装、无需重置）。
    // 顺序固定 → 实例号 pi1.. 确定、重置后可复现。
    if (Object.keys(this.squad.ownedCores).length === 0) {
      for (const c of S7_DEMO_SEED_CORES) grantCore(this.squad, c, 1);
    }
    if (this.pluginInventory && this.pluginInventory.plugins.length === 0) {
      for (const p of S7_DEMO_SEED_PLUGINS) addOwnedPlugin(this.pluginInventory, p.pluginId, p.quality);
    }
  }

  /** 演出线 DEV-TEMP（07-15 Ron 令·上线前随 DEV 清单删）：五艘带皮肤舰「缺就补发」——
   *  真机看真皮肤/签名弹道/切件动骨（SHIP_BODY 五舰=锋矢/铁壁/烈阳/晨曦/锁链）；配对驾驶员同补（上阵不缺员）；
   *  首次入手才补专属碎片 200（对齐 seed 先例·可试升阶质变演出；借 grantShip 幂等返回值防每次启动重复加）。 */
  private ensureFxShowcaseShipsGranted(): void {
    if (!this.squad || !this.playerState) return;
    for (const [ship, pilot] of S7_DEV_FX_SHOWCASE_PAIRS) {
      if (grantShip(this.squad, ship)) addExclusiveShards(this.playerState.exclusiveShards, ship, 200);
      if (grantPilot(this.squad, pilot)) addExclusiveShards(this.playerState.exclusiveShards, pilot, 200);
    }
  }

  /** M1：教程开局，只给起始船+起始驾驶员编 1 号位，建筑/插件/星核全留空，靠教程逐步解锁（与 ensureDemoSquadSeeded 二选一·按 tutorial.strongGuideDone 分支）。 */
  private ensureTutorialStarterSeeded(): void {
    if (!this.squad) return;
    if (this.squad.ownedShips.length === 0) {
      grantShip(this.squad, S7_TUTORIAL_STARTER.shipId);
      grantPilot(this.squad, S7_TUTORIAL_STARTER.pilotId);
      assignSlot(this.squad, S7_TUTORIAL_STARTER.slotRef, S7_TUTORIAL_STARTER.shipId, S7_TUTORIAL_STARTER.pilotId);
    }
  }

  /** B 块：pluginId → 槽位类型（plugin_config 派生；查不到返回 undefined）。给 S7ShipLoadout 注入。 */
  private pluginSlotOf = (pluginId: string): S7PluginSlot | undefined => this.pluginSlotMap.get(pluginId);

  /** 某船、某槽位类型 当前装的插件实例（找不到 null）。卸槽/显示用。按船装配(shipLoadouts)读。 */
  private equippedInSlotType(shipId: string, slotTag: S7PluginSlot): S7OwnedPlugin | null {
    const loadout = this.squad ? this.squad.shipLoadouts[shipId] : undefined;
    if (!loadout || !this.pluginInventory) return null;
    for (const id of loadout.pluginInstanceIds) {
      const inst = findOwnedPlugin(this.pluginInventory, id);
      if (inst && this.pluginSlotMap.get(inst.pluginId) === slotTag) return inst;
    }
    return null;
  }

  /** 该格当前已配在编队里的某船? 返回编队槽(找不到 null)。 */
  private slotOf(slotRef: string) {
    return this.squad ? this.squad.formation.find((s) => s.slotRef === slotRef) ?? null : null;
  }

  /** 某船当前驾驶员（跟船记忆·按 shipId 读 shipLoadouts）。 */
  private pilotOf(shipId: string): string | null {
    return this.squad ? this.squad.shipLoadouts[shipId]?.pilotId ?? null : null;
  }

  /** 某上阵船所在格的 col（纵深：c2=前排靠中线 / c0=后排）；未上阵返回 null。M2 摆阵目标判定用。 */
  private shipSlotCol(shipId: string): number | null {
    if (!this.squad) return null;
    const slot = this.squad.formation.find((s) => s.shipId === shipId)?.slotRef;
    if (!slot) return null;
    const m = slot.match(/c(\d)/);
    return m ? Number(m[1]) : null;
  }

  // ===== 战场/备战 共用坐标（上下对称·中间留隙；备战看到的站位 = 战斗站位）=====
  // 朝向 = 唯一真源 s7FieldVisualCell（B0.7·纵轴深度/横轴横排/我方前排在上·敌方前排在下）；本处只套战斗场的分数间距。
  /** 我方格位屏幕坐标：row=横排、col=纵深（前排 c2 在上贴中线）。我方占下半。 */
  private fieldPlayerPos(row: number, col: number): { x: number; y: number } {
    const W = this.viewW, H = this.viewH;
    const { visualRow, visualCol } = s7FieldVisualCell('player', row, col);
    return { x: (visualCol - 1) * (W * 0.235), y: -H * 0.05 - visualRow * (H * 0.10) };
  }
  /** 敌方格位屏幕坐标：row=横排、col=纵深（前排 c0 在下贴中线）。敌方占上半。 */
  private fieldEnemyPos(row: number, col: number): { x: number; y: number } {
    const W = this.viewW, H = this.viewH;
    const { visualRow, visualCol } = s7FieldVisualCell('enemy', row, col);
    return { x: -W * 0.42 + ((visualCol + 0.5) / 5) * (W * 0.84), y: H * 0.05 + (H * 0.26) - visualRow * (H * 0.26 / 6) };
  }
  /** 我方九宫格格子边长。 */
  private get fieldCell(): number { return this.viewW * 0.18; }


  // ===== UI 搭建（程序化色块）=====

  private buildUi(): void {
    const parentUt = this.node.parent?.getComponent(UITransform);
    const W = parentUt ? parentUt.contentSize.width : 720;
    const H = parentUt ? parentUt.contentSize.height : 1280;
    this.viewW = W;
    this.viewH = H;
    const ut = this.node.addComponent(UITransform);
    ut.setContentSize(W, H);

    // 满屏深色底板（盖住流程版灰盒）+ 吞触摸（避免点穿到底层按钮）。
    const bg = this.node.addComponent(Graphics);
    bg.fillColor = new Color(18, 22, 34, 255);
    bg.rect(-W / 2, -H / 2, W, H);
    bg.fill();
    this.node.on(Node.EventType.TOUCH_END, () => {}, this); // 吞掉空白处触摸

    // 星港主界面 hub（顶部货币栏 + 建筑入口岛 + 活动 + 背包/邮件 + 出战）。参照基地主界面图，灰盒版色块。
    this.buildHubHome(W, H);

    // 战斗演出改为"就地在备战界面演"（无独立叠加层）：演出 gfx = prebattleGfx，跳过键 = prebattleSkipBtn（见 buildPrebattlePanel）。
    this.buildBasePanel(W, H);
    this.buildPrebattlePanel(W, H);
    this.buildBoardingPanel(W, H);
    this.buildLoadoutPanel(W, H);
    this.buildLevelSelectPanel(W, H);
    this.buildResultPopup(W, H);
    this.buildGachaPanel(W, H); // C 抽卡界面（星港补给站进）
    this.buildSalvagePanel(W, H); // D 打捞界面（打捞港进）
    this.buildMerchantPanel(W, H); // E 商人小站界面（商人小站进）
    this.buildBuildingUpgradePanel(W, H); // J 建筑升级弹框（各建筑共用）
    this.buildUnitTrainPanel('ship', W, H); // J-step2 船坞（星舰升级）
    this.buildUnitTrainPanel('pilot', W, H); // J-step2 训练舱（驾驶员升级）
    this.buildInfoBuildingPanel('habitat', W, H); // J-step3 居住舱（人口中枢）
    this.buildInfoBuildingPanel('gallery', W, H); // J-step3 星核展厅（收藏）
    this.buildUnitManagePanel(W, H); // 升阶升星 step2 单位管理面板
    this.buildBackpackPanel(W, H); // 升阶升星 step2 背包·通用碎片转换
    this.buildMailPanel(W, H); // 阶段一 G2 邮件界面（领取入账）
    this.buildLevelRewardPanel(W, H); // 阶段一 F 关卡三选一发奖浮层（最后建 → 盖在结果弹窗之上）
    this.buildGrandRewardPopup(W, H); // ②块2真机 Boss首通大奖特写弹窗（盖在三选一屏/结算窗之上）
    this.buildSupplyChestResultPopup(W, H); // 块5 完善批 今日补给箱开箱结果确认弹窗（必点收下才关）
    this.buildChestOpenPanel(W, H); // 阶段一 H 星辉货舱开箱浮层（盖在背包之上）
    this.buildActivityPanel(W, H); // 阶段一 G 活动界面（3天行动/7天扩张）
    this.buildVaultPanel(W, H); // 阶段一 I 星空宝库（兑换+合成）
    this.buildExpOpenPanel(W, H); // 阶段一 I 扩张宝藏开箱浮层
    this.buildBattleStatsPanel(W, H); // 阶段一 L 伤害统计浮层（盖在结果弹窗之上）
    // 块4 作战大厅：容器持有 悬赏板 + 每日推演两页签（守工作流程⑧·Ron 2026-07-05 hub 架构）。
    this.combatHall = new S7CombatHallView(this.node, this.makeCombatHallHost(), this.makeBountyHost(), this.makePuzzleHost(), W, H);
    this.corridorView = new S7CorridorTowerView(this.node, this.makeCorridorHost(), W, H); // 块3 深空回廊·独立全屏塔页 view（守工作流程⑧·维持独立）
    this.anecdoteView = new S7AnecdoteBubbleView(this.node, W, H); // 块5 星港趣事小弹泡（独立 view·守⑧·点掉即走不打断）
    this.buildReturnReportPopup(W, H); // 块1 回港报告聚合弹窗（上线自动弹·必领才关；教程遮罩在其后建、可盖住它）
    this.buildBuildingUnlockDialog(W, H); // 建筑解锁确认弹框（真功能·点未解锁建筑弹出）
    this.buildTutorialOverlay(W, H); // M0 强引导遮罩（最后建→盖在所有面板之上）
    this.buildTutorialPopup(W, H); // M0 弱引导首触短教程弹窗（最后建→盖在所有面板之上）
    this.buildTutorialHint(W, H); // M2 交互式强引导顶部提示条（不锁操作·最后建→盖在所有面板之上）
    this.buildTutorialDragLock(W, H); // M4 留洞锁屏（拖拽步专用·最后建→盖在所有面板之上）
    this.buildTutorialDevBar(W, H); // DEV-TEMP 左上角常驻测试键（最后建→默认最顶；教程遮罩抬前时会再抬一次见 raiseTutorialDevBar）
  }

  /** DEV-TEMP：左上角常驻「跳过引导」「重置教程」——教程遮罩/提示条/弹窗激活期间也要能点，故各自抬前时都会再调 raiseTutorialDevBar()。上线前整体删。 */
  private buildTutorialDevBar(W: number, H: number): void {
    const band = getS7UsableBand();
    const bar = new Node('S7TutorialDevBar');
    bar.layer = this.node.layer;
    this.node.addChild(bar);
    bar.setPosition(0, 0, 0);
    // 巡检批 #15/#11：缩小成左上角窄条（108×32×2·上下 8px 间距），热区不再压到 hub 星矿货币条/作战大厅返回键。
    const x = -W / 2 + 64, y = band.usableTopY - 18;
    this.addBtn(bar, '重置教程', 108, 32, new Color(120, 70, 70, 220), x, y, () => this.onReset(), 14);
    this.addBtn(bar, '跳过引导', 108, 32, new Color(70, 110, 90, 220), x, y - 40, () => this.devSkipGuide(), 14);
    this.tutorialDevBarNode = bar;
  }

  /** 把 DEV 测试键条抬到最前（盖过教程遮罩/提示条/弹窗）。三处教程浮层各自抬前后都要调一次。 */
  private raiseTutorialDevBar(): void {
    const parent = this.tutorialDevBarNode?.parent;
    if (parent && this.tutorialDevBarNode) this.tutorialDevBarNode.setSiblingIndex(parent.children.length - 1);
  }

  // ===== 星港主界面 hub =====

  /** 搭星港主界面（灰盒色块·参照基地主界面图的入口布局）：顶部货币栏 + 活动 + 7 建筑入口 + 背包/邮件 + 出战 + 小 DEV 工具行。 */
  private buildHubHome(W: number, H: number): void {
    const band = getS7UsableBand();
    const topY = band.usableTopY; // 安全区下沿（避刘海/胶囊）
    const botY = band.usableBottomY;

    // —— 顶部：标题 + 货币栏（星矿/星贝/补给券·设计§10.5 主界面只常驻这 3 个）——
    // 巡检批 #15：标题右移让出左上角（教程 DEV 测试键专用道）；货币条下移 10px 与 DEV 键热区拉开 ≥8px。
    this.makeLabel('⭐ 星港', 48, new Color(255, 232, 120), -W * 0.18, topY - 34);
    const cy = topY - 118;
    this.hubOreLabel = this.makeHubChip('星矿', -W * 0.30, cy, new Color(150, 90, 210, 255), '星矿：建筑升级主货币·出战/离线产出（点建筑升级看花费）');
    this.hubCargoLabel = this.makeHubChip('星贝', 0, cy, new Color(210, 170, 60, 255), '星贝：商人交易/回收货币·出战获得（去商人小站买卖）');
    this.hubTicketLabel = this.makeHubChip('补给券', W * 0.30, cy, new Color(70, 150, 200, 255), '补给券：抽卡货币·商人每日供应/赞助补给/活动获得（去补给站抽卡）');

    // —— 活动（左右两枚·占位）——
    const ay = topY - 210;
    this.hubActivityEntryNode = this.makeHubEntry('3天行动', '进度/领奖', new Color(90, 160, 120, 255), -W * 0.24, ay, 290, 88, () => this.openActivity('action3'));
    this.makeHubEntry('7天扩张', '进度/领奖', new Color(120, 110, 180, 255), W * 0.24, ay, 290, 88, () => this.openActivity('expansion7'));
    // —— 今日补给箱（S13 #2·块5）：活动区旁小礼盒岛（B1.1）。每日1次看广告开；当日已开→隐（券态恢复·统一三态）；零红点。
    const chest = new Node('S7SupplyChest'); chest.layer = this.node.layer; this.node.addChild(chest);
    chest.setPosition(0, topY - 285, 0); // 巡检批 #15：与活动行/建筑格各留 8px 热区间距（原上 0px 下 1px）
    chest.addComponent(UITransform).setContentSize(340, 46);
    const cg = chest.addComponent(Graphics);
    cg.fillColor = new Color(190, 140, 55, 235); cg.roundRect(-170, -23, 340, 46, 12); cg.fill();
    const chestLab = new Node('t'); chestLab.layer = this.node.layer; chest.addChild(chestLab);
    const cl = chestLab.addComponent(Label); cl.fontSize = 22; cl.lineHeight = 26; cl.color = new Color(255, 248, 225);
    cl.overflow = Label.Overflow.SHRINK; cl.enableWrapText = false;
    chestLab.addComponent(UITransform).setContentSize(324, 40);
    chest.on(Node.EventType.TOUCH_END, () => this.onOpenSupplyChest(), this);
    chest.active = false; // refresh() 按统一三态控显
    this.hubSupplyChestNode = chest;
    this.hubSupplyChestSubLabel = cl;

    // —— 7 建筑入口岛（2 列网格）——（巡检批 #15：起点下移 15/行距 145 → 补给箱条上下各 8px、总底沿不变 topY-869）
    const gy0 = topY - 375;
    const gap = 145;
    const lx = -W * 0.24, rx = W * 0.24, ew = 300, eh = 118;
    this.hubDockEntryNode = this.makeHubEntry('船坞', '养成', new Color(80, 130, 200, 255), lx, gy0, ew, eh, () => this.openDock(), 'bld_dock');
    this.hubSalvageEntryNode = this.makeHubEntry('打捞港', '打捞', new Color(70, 160, 190, 255), rx, gy0, ew, eh, () => this.openSalvage(), 'bld_salvage_port');
    this.makeHubEntry('居住舱', '人口', new Color(160, 130, 90, 255), lx, gy0 - gap, ew, eh, () => this.openHabitat(), 'bld_habitat');
    this.hubGachaEntryNode = this.makeHubEntry('星港补给站', '抽卡', new Color(210, 120, 70, 255), rx, gy0 - gap, ew, eh, () => this.openGacha(), 'bld_supply_station');
    this.hubMerchantEntryNode = this.makeHubEntry('商人小站', '买卖', new Color(150, 110, 70, 255), lx, gy0 - gap * 2, ew, eh, () => this.openMerchant(), 'bld_merchant_station');
    this.makeHubEntry('研究塔', '升级', new Color(90, 110, 150, 255), rx, gy0 - gap * 2, ew, eh, () => this.openBuildingUpgrade('bld_research_tower'), 'bld_research_tower');
    this.makeHubEntry('星核展厅', '收藏', new Color(120, 100, 150, 255), lx, gy0 - gap * 3, ew, eh, () => this.openGallery(), 'bld_rsv_core_gallery');
    this.hubTrainingEntryNode = this.makeHubEntry('训练舱', '养成', new Color(110, 140, 90, 255), rx, gy0 - gap * 3, ew, eh, () => this.openTraining(), 'bld_pilot_training_bay');

    // —— 底部：背包 / 邮件（左）+ 出战（右·大）——（巡检批 #15：邮件左移——原与出战热区重叠 7.5px；各相邻 ≥8px）
    this.makeHubEntry('背包', '资源/宝箱', new Color(110, 115, 130, 255), -W * 0.377, botY + 170, 160, 96, () => this.openBackpack());
    const mailEntry = this.makeHubEntry('邮件', '查看', new Color(110, 115, 130, 255), -W * 0.153, botY + 170, 160, 96, () => this.openMail());
    this.hubMailSubLabel = mailEntry.getChildByName('s')?.getComponent(Label) ?? null; // 副标签 refresh() 显可领数
    this.hubSortieBtn = this.makeButton('出战', 320, 132, new Color(245, 170, 50, 255), W * 0.20, botY + 160, () => this.openPrebattle());
    // 块2：星港悬赏板入口（出战正上方·关5 强引导结束后解锁，见 refresh()）。
    this.hubCombatHallBtn = this.makeButton('作战大厅', 200, 80, new Color(120, 110, 175, 255), W * 0.20, botY + 274, () => this.openCombatHall('bounty'));
    this.hubCombatHallBtn.active = false;
    // 块3：深空回廊入口（左上·首Boss通关后解锁，见 refresh()）。
    this.hubCorridorBtn = this.makeButton('回廊', 200, 80, new Color(95, 120, 190, 255), -W * 0.20, botY + 274, () => this.openCorridor());
    this.hubCorridorBtn.active = false;

    // —— 中央临时提示（默认空）——
    this.hubToastLabel = this.makeLabel('', 30, new Color(255, 235, 160), 0, gy0 - gap * 3 - 100);

    // —— DEV-TEMP 工具行（小·演示用·正式版去掉；升级走船坞/训练舱）——
    // DEV-TEMP 工具行（8 槽·上线前整行删）：测回港=拨回8h重建回港报告 / 测试邮件=验G2邮件领取 / 回档n029=拨主线回首Boss待通·反复验掉落结算 /
    // 刷悬赏=重掷今日4张验品质词缀分布与暗保底 / 必遇袭=武装下张护航必触发（15%小概率没法真机验收） /
    // +5券=发5张广告券验券态恢复与失败退券 / 重置广告=清今日全部每日计数（否则每日1次没法反复真机验） / 触发趣事=必触发趣事弹泡（15%概率没法验收）。
    const devX = (i: number): number => -W * 0.4025 + i * W * 0.115;
    const devY = botY + 56;
    this.addBtn(this.node, '测回港', 76, 60, new Color(205, 165, 60, 255), devX(0), devY, () => this.devTestReturnReport(), 16);
    this.addBtn(this.node, '测邮件', 76, 60, new Color(80, 120, 160, 255), devX(1), devY, () => this.devSendTestMail(), 16);
    this.addBtn(this.node, '回n029', 76, 60, new Color(165, 90, 90, 255), devX(2), devY, () => this.devRollbackToFirstBoss(), 16);
    this.addBtn(this.node, '刷悬赏', 76, 60, new Color(90, 150, 130, 255), devX(3), devY, () => this.devRerollBounty(), 16);
    this.addBtn(this.node, '必遇袭', 76, 60, new Color(170, 120, 70, 255), devX(4), devY, () => this.devToggleForceAmbush(), 16);
    this.addBtn(this.node, '+5券', 76, 60, new Color(120, 140, 90, 255), devX(5), devY, () => this.devGrantAdTickets(), 16);
    this.addBtn(this.node, '重置广告', 76, 60, new Color(140, 100, 150, 255), devX(6), devY, () => this.devResetAdDaily(), 16);
    this.addBtn(this.node, '触发趣事', 76, 60, new Color(90, 130, 170, 255), devX(7), devY, () => this.devForceAnecdote(), 16);
    // 状态行（DEV·细字）挪进 DEV 工具行正下方（#11 DEV 同区、不再横穿「出战」）；
    // 结果行（操作反馈）左半区左对齐锚框（#2/#15：右缘止于「出战」左缘 8px 外，不再压主按钮）。
    this.statusLabel = this.makeLabel('', 18, new Color(150, 165, 190), 0, botY + 14);
    {
      const st = this.labelBox(this.statusLabel);
      st.setContentSize(W * 0.94, 26);
      this.statusLabel.overflow = Label.Overflow.SHRINK;
      this.statusLabel.enableWrapText = false;
    }
    this.resultLabel = this.makeLabel('点「出战」推进主线', 22, new Color(170, 220, 175), -W / 2 + 12, botY + 104);
    {
      const rt = this.labelBox(this.resultLabel);
      rt.setAnchorPoint(0, 0.5);
      rt.setContentSize(W * 0.46, 32);
      this.resultLabel.overflow = Label.Overflow.SHRINK;
      this.resultLabel.enableWrapText = false;
      this.resultLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    }
  }

  /** 货币 chip：圆角底 + 「名 值」标签 + 点击看说明（§10.6 顶部货币栏上下文）。返回值标签（refresh 更新数字）。 */
  private makeHubChip(name: string, x: number, y: number, color: Color, desc?: string): Label {
    const node = new Node('S7HubChip'); node.layer = this.node.layer; this.node.addChild(node); node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(220, 68);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(36, 42, 60, 235); g.roundRect(-110, -34, 220, 68, 16); g.fill();
    g.fillColor = color; g.roundRect(-110, -34, 12, 68, 6); g.fill(); // 左侧色条区分币种
    const lab = new Node('v'); lab.layer = this.node.layer; node.addChild(lab); lab.setPosition(8, 0, 0);
    const l = lab.addComponent(Label); l.fontSize = 26; l.lineHeight = 32; l.color = new Color(235, 240, 250); l.string = `${name}\n0`;
    if (desc) node.on(Node.EventType.TOUCH_END, () => this.hubToast(desc), this);
    return l;
  }

  /** 建筑/活动入口块：圆角底 + 名 + 状态子标签 + 点击。trackBuildingId 给了则把副标签登记，refresh() 更新"Lv.X·可升↑"。 */
  private makeHubEntry(name: string, sub: string, color: Color, x: number, y: number, w: number, h: number, onTap: () => void, trackBuildingId?: string): Node {
    const node = new Node('S7HubEntry'); node.layer = this.node.layer; this.node.addChild(node); node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(w, h);
    const g = node.addComponent(Graphics);
    g.fillColor = color; g.roundRect(-w / 2, -h / 2, w, h, 14); g.fill();
    const nameN = new Node('n'); nameN.layer = this.node.layer; node.addChild(nameN); nameN.setPosition(0, h * 0.12, 0);
    const nl = nameN.addComponent(Label); nl.fontSize = Math.min(36, Math.floor(h * 0.34)); nl.lineHeight = nl.fontSize + 6; nl.color = new Color(255, 255, 255); nl.string = name;
    const subN = new Node('s'); subN.layer = this.node.layer; node.addChild(subN); subN.setPosition(0, -h * 0.26, 0);
    const sl = subN.addComponent(Label); sl.fontSize = 22; sl.lineHeight = 26; sl.color = new Color(225, 235, 255, 200); sl.string = sub;
    node.on(Node.EventType.TOUCH_END, onTap, this);
    if (trackBuildingId) this.hubBuildingTracks.push({ id: trackBuildingId, label: sl });
    return node;
  }

  /** 建筑未解锁则弹「花XX星矿解锁该建筑至Lv1？」确认框并返回 true（拦截打开）；已解锁返回 false。
   *  解锁是真功能：确认→花星矿解锁+打开；取消→关框。教程只负责引导玩家点建筑→点确认。 */
  private blockIfBuildingLocked(buildingId: string, name: string): boolean {
    if (this.buildings && isBuildingUnlocked(this.buildings, buildingId)) return false;
    this.openBuildingUnlockDialog(buildingId, name);
    return true;
  }

  /** 各建筑解锁星矿花费（占位·教程段预算见 DOCK 注释·第二块校准）。 */
  private buildingUnlockCost(buildingId: string): number {
    switch (buildingId) {
      case 'bld_dock': return S7_TUTORIAL_DOCK_UNLOCK_COST;
      case 'bld_pilot_training_bay': return S7_TUTORIAL_TRAINING_UNLOCK_COST;
      case 'bld_salvage_port': return S7_TUTORIAL_SALVAGE_UNLOCK_COST;
      case 'bld_merchant_station': return S7_TUTORIAL_MERCHANT_UNLOCK_COST;
      case 'bld_supply_station': return S7_TUTORIAL_GACHA_UNLOCK_COST;
      case 'bld_habitat': return 30;
      case 'bld_research_tower': return 40;
      case 'bld_rsv_core_gallery': return 50;
      default: return 20;
    }
  }

  /** 搭建筑解锁确认弹框（默认隐藏·真功能）：文字 + 取消(左下)/确认(右下)。 */
  private buildBuildingUnlockDialog(W: number, H: number): void {
    const panel = new Node('S7BuildingUnlock'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    panel.addComponent(UITransform).setContentSize(W, H);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, 170); g.rect(-W / 2, -H / 2, W, H); g.fill();
    const cardW = W * 0.78, cardH = 300;
    g.fillColor = new Color(26, 32, 50, 255); g.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 18); g.fill();
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸·只能点按钮
    panel.active = false;
    this.buildingUnlockDialogNode = panel;
    const tN = new Node('t'); tN.layer = this.node.layer; panel.addChild(tN); tN.setPosition(0, cardH * 0.16, 0);
    const tl = tN.addComponent(Label); tl.fontSize = 30; tl.lineHeight = 42; tl.color = new Color(235, 238, 250);
    tl.horizontalAlign = Label.HorizontalAlign.CENTER;
    tN.addComponent(UITransform).setContentSize(cardW * 0.88, 160); tl.overflow = Label.Overflow.RESIZE_HEIGHT;
    this.buildingUnlockDialogTextLabel = tl;
    // B0.6 #14：两键走统一孔位（取消左/确认右·等宽等高对称）。
    const [, unlockConfirm] = this.addDialogBtnPair(
      panel, '取消', new Color(110, 90, 150, 255), () => this.onCancelBuildingUnlock(),
      '确认', new Color(70, 150, 110, 255), () => this.onConfirmBuildingUnlock(), -cardH * 0.30, 220, 88,
    );
    this.buildingUnlockConfirmBtn = unlockConfirm.node.parent;
  }

  /** 点未解锁建筑 → 弹「花XX星矿解锁至Lv1？」确认框。 */
  private openBuildingUnlockDialog(buildingId: string, name: string): void {
    if (!this.buildingUnlockDialogNode) return;
    this.buildingUnlockPendingId = buildingId;
    const cost = this.buildingUnlockCost(buildingId);
    const have = Math.floor((this.session?.resources as Record<string, number> | undefined)?.starOre ?? 0);
    if (this.buildingUnlockDialogTextLabel) this.buildingUnlockDialogTextLabel.string = `是否花 ${cost} 星矿解锁「${name}」至 Lv1？\n（当前星矿 ${have}）`;
    const parent = this.buildingUnlockDialogNode.parent;
    if (parent) this.buildingUnlockDialogNode.setSiblingIndex(parent.children.length - 1);
    this.buildingUnlockDialogNode.active = true;
  }
  private closeBuildingUnlockDialog(): void { if (this.buildingUnlockDialogNode) this.buildingUnlockDialogNode.active = false; }
  private onCancelBuildingUnlock(): void { this.buildingUnlockPendingId = null; this.closeBuildingUnlockDialog(); }

  /** 确认解锁：花星矿解锁该建筑 + 关框 + 打开它（星矿不足则提示、不解锁）。 */
  private onConfirmBuildingUnlock(): void {
    const id = this.buildingUnlockPendingId;
    if (!id || !this.buildings || !this.playerState) return;
    const r = unlockBuildingWithStarOre(this.buildings, this.playerState.resources, id, this.buildingUnlockCost(id));
    if (!r.ok) { if (r.code === 'insufficient_star_ore') this.hubToast('星矿不足'); return; }
    this.buildingUnlockPendingId = null;
    this.closeBuildingUnlockDialog();
    this.refresh();
    this.openBuildingById(id);
  }

  /** 建筑 id → 打开对应面板（解锁后/正常进入用）。 */
  private openBuildingById(buildingId: string): void {
    switch (buildingId) {
      case 'bld_dock': this.openDock(); break;
      case 'bld_pilot_training_bay': this.openTraining(); break;
      case 'bld_salvage_port': this.openSalvage(); break;
      case 'bld_merchant_station': this.openMerchant(); break;
      case 'bld_supply_station': this.openGacha(); break;
      case 'bld_habitat': this.openHabitat(); break;
      case 'bld_rsv_core_gallery': this.openGallery(); break;
      default: break;
    }
  }

  /** 中央临时提示：显示一行字、约 1.4 秒后自动清空。 */
  private hubToast(text: string): void {
    if (!this.hubToastLabel) return;
    this.hubToastLabel.string = text;
    this.unschedule(this.clearHubToast);
    this.scheduleOnce(this.clearHubToast, 1.4);
  }
  private clearHubToast = (): void => { if (this.hubToastLabel) this.hubToastLabel.string = ''; };

  // ===== C 抽卡界面（星港补给站·三池：招募/整备/专属）=====

  /** 搭抽卡浮层（默认隐藏）：标题/补给券 + 三池切页 + 当前池说明+保底 + 专属兑换 + 出货明细 + 单抽/十连 + 赞助补给 + 返回。 */
  private buildGachaPanel(W: number, H: number): void {
    const panel = new Node('S7Gacha'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(16, 20, 32, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 满屏浮层吞触摸（用「返回」键关）
    panel.active = false;
    this.gachaNode = panel;

    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;

    this.mkPanelLabel(panel, '星港补给站', 40, new Color(255, 232, 130), -W * 0.26, topY - 30);
    this.gachaTicketLabel = this.mkPanelLabel(panel, '补给券 0', 30, new Color(120, 200, 240), W * 0.26, topY - 30);

    // 三池切页（左→中→右 = 招募补给 / 专属补给 / 舰船补给；专属居中高亮）。
    const tabY = topY - 110;
    this.gachaTabBtns = [];
    this.mkGachaTab(panel, 'recruit', '招募补给\n驾驶员', -W * 0.30, tabY);
    this.mkGachaTab(panel, 'exclusive', '专属补给\n限定专属', 0, tabY);
    this.mkGachaTab(panel, 'refit', '舰船补给\n星舰', W * 0.30, tabY);

    // 当前池说明 + 保底进度（多行）。#2：锚容器框（今日开放类目名可能拼很长）。
    this.gachaInfoLabel = this.mkPanelLabel(panel, '', 28, new Color(220, 230, 245), 0, topY - 230);
    this.labelBox(this.gachaInfoLabel).setContentSize(W * 0.94, 130);
    this.gachaInfoLabel.overflow = Label.Overflow.SHRINK;
    this.gachaInfoLabel.enableWrapText = true;
    // 专属池兑换进度 + 领箱按钮（仅专属池显示）。
    this.gachaExchangeLabel = this.mkPanelLabel(panel, '', 26, new Color(255, 215, 140), 0, topY - 330);
    const claim = this.addBtn(panel, '领兑换箱', 280, 80, new Color(220, 150, 60, 255), 0, topY - 400, () => this.onGachaClaim(), 30);
    this.gachaClaimBtn = claim.node.parent; // addBtn 返回 Label，其父节点 = 按钮节点
    if (this.gachaClaimBtn) this.gachaClaimBtn.active = false;

    // 出货明细（多行·居中偏下）。#2：十连 10 行长名锚进容器框自动缩。
    this.gachaResultLabel = this.mkPanelLabel(panel, '点下方抽卡', 26, new Color(180, 230, 190), 0, -H * 0.04);
    this.labelBox(this.gachaResultLabel).setContentSize(W * 0.92, H * 0.30);
    this.gachaResultLabel.overflow = Label.Overflow.SHRINK;
    this.gachaResultLabel.enableWrapText = true;

    // 单抽 / 十连（券不足时变灰·点了没反应，见 refreshGacha + onGachaDraw 守门）。
    const single = this.addBtn(panel, '单抽\n(1券)', 260, 110, new Color(70, 130, 200, 255), -W * 0.22, botY + 238, () => this.onGachaDraw(1), 32);
    this.gachaSingleBtn = single.node.parent;
    const ten = this.addBtn(panel, '十连\n(10券)', 260, 110, new Color(80, 160, 120, 255), W * 0.22, botY + 238, () => this.onGachaDraw(10), 32);
    this.gachaTenBtn = ten.node.parent;
    // 赞助补给（看广告得券×10·S13 #6）：块5 统一三态（每日1次·用尽即隐·券态恢复），refreshGacha 控显。
    // 巡检批 #15：底部三行（抽卡键/赞助/返回）相邻热区各拉开 ≥8px（原 4/5px），返回键收进安全区。
    const sponsor = this.addBtn(panel, '', 460, 80, new Color(200, 120, 70, 255), 0, botY + 130, () => this.onGachaSponsorAd(), 28);
    this.gachaSponsorLabel = sponsor;
    this.gachaSponsorBtn = sponsor.node.parent;
    // 返回星港。
    const back = this.addBtn(panel, '返回星港', 240, 80, new Color(120, 90, 160, 255), 0, botY + 42, () => this.closeGacha(), 30);
    this.gachaBackBtn = back.node.parent;
  }

  /** 在某浮层下加一个标签（随浮层显隐）。 */
  private mkPanelLabel(parent: Node, text: string, fontSize: number, color: Color, x: number, y: number): Label {
    const n = new Node('lab'); n.layer = this.node.layer; parent.addChild(n); n.setPosition(x, y, 0);
    const l = n.addComponent(Label); l.fontSize = fontSize; l.lineHeight = Math.round(fontSize * 1.3); l.color = color; l.string = text;
    return l;
  }

  /** 抽卡切页 tab（存 node+gfx 供高亮重绘）。 */
  private mkGachaTab(parent: Node, pool: S7GachaPoolId, text: string, x: number, y: number): void {
    const n = new Node('tab'); n.layer = this.node.layer; parent.addChild(n); n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(200, 92);
    n.addComponent(Graphics);
    const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
    const l = ln.addComponent(Label); l.fontSize = 26; l.lineHeight = 32; l.color = new Color(255, 255, 255); l.string = text;
    n.on(Node.EventType.TOUCH_END, () => this.switchGachaPool(pool), this);
    this.gachaTabBtns.push({ pool, node: n });
    this.paintGachaTab(n, pool === this.gachaPool);
  }
  private paintGachaTab(n: Node, selected: boolean): void {
    const g = n.getComponent(Graphics); if (!g) return;
    g.clear();
    g.fillColor = selected ? new Color(90, 150, 220, 255) : new Color(48, 56, 76, 255);
    g.roundRect(-100, -46, 200, 92, 12); g.fill();
  }
  /** 重绘按钮底色（变灰=禁用·见十连/单抽券不足）。addBtn 圆角=10、抽卡键尺寸 260×110。 */
  private paintBtn(node: Node | null, color: Color, w = 260, h = 110): void {
    if (!node) return;
    const g = node.getComponent(Graphics); if (!g) return;
    g.clear(); g.fillColor = color; g.roundRect(-w / 2, -h / 2, w, h, 10); g.fill();
  }

  private openGacha(): void {
    if (this.blockIfBuildingLocked('bld_supply_station', '星港补给站')) return;
    if (!this.gachaNode || !this.playerState) return;
    // 进界面先刷新到当前日（专属轮换可能在离开期间发生→忘领满格走邮件补发·零头清零）。
    refreshGachaToDay(this.playerState.gacha, this.playerState.mailbox, DEFAULT_S7_GACHA_CONFIG, gachaDayIndex(Date.now()), Date.now());
    this.persist();
    this.gachaNode.active = true;
    this.gachaResultLabel && (this.gachaResultLabel.string = '点下方抽卡');
    this.refreshGacha();
  }
  private closeGacha(): void { if (this.gachaNode) this.gachaNode.active = false; }

  private switchGachaPool(pool: S7GachaPoolId): void {
    this.gachaPool = pool;
    for (const t of this.gachaTabBtns) this.paintGachaTab(t.node, t.pool === pool);
    if (this.gachaResultLabel) this.gachaResultLabel.string = '点下方抽卡';
    this.refreshGacha();
  }

  /** 刷新抽卡界面信息（当前池说明 + 保底进度 + 专属兑换 + 补给券）。 */
  private refreshGacha(): void {
    if (!this.playerState) return;
    const cfg = DEFAULT_S7_GACHA_CONFIG;
    const gacha = this.playerState.gacha;
    const day = gachaDayIndex(Date.now());
    const pool = this.gachaPool;
    if (this.gachaTicketLabel) this.gachaTicketLabel.string = `补给券 ${Math.floor(this.session?.resources.supplyTicket ?? 0)}`;

    let info = '';
    if (pool === 'exclusive') {
      const exId = currentExclusiveShipId(cfg, day);
      info = `专属补给（常驻全部非专属星舰）\n当期专属：${exId ? this.unitName('ship', exId) : '—'}（A级·每${cfg.rotationDays}天轮换）`;
    } else {
      const cats = pool === 'recruit' ? cfg.recruitCategories : cfg.refitCategories;
      const openIds = openCategoryIds(cfg, pool, day);
      const names = openIds.map((id) => cats.find((c) => c.categoryId === id)?.name ?? id).join('、');
      info = pool === 'recruit'
        ? `招募补给（驾驶员·每天开2类·3天一轮）\n今日开放：${names}`
        : `舰船补给（星舰·每天开2类·3天一轮）\n今日开放：${names}`;
    }
    const supplyLvInfo = this.buildings ? getBuildingLevel(this.buildings, 'bld_supply_station') : 0;
    const freeLeftInfo = this.playerState ? freePullsLeftToday(this.playerState.gacha, day, supplyFreeDailyPulls(supplyLvInfo)) : 0;
    info += `\nA级保底 ${gacha.pity[pool]}/${cfg.pityDraws}（真概率·满必出 A级/3★）`;
    if (freeLeftInfo > 0) info += `\n今日免费抽剩 ${freeLeftInfo} 次`;
    if (this.gachaInfoLabel) this.gachaInfoLabel.string = info;

    // 单抽/十连：支付力不足该档位 → 变灰（点了没反应·见 onGachaDraw 守门）。
    const avail = Math.floor(this.session?.resources.supplyTicket ?? 0);
    const grey = new Color(70, 75, 90, 255);
    this.paintBtn(this.gachaSingleBtn, freeLeftInfo + avail >= 1 ? new Color(70, 130, 200, 255) : grey);
    this.paintBtn(this.gachaTenBtn, avail >= supplyTenPullTicketCost(supplyLvInfo) ? new Color(80, 160, 120, 255) : grey);
    // 赞助补给（#6）：块5 统一三态（每日1次·用尽即隐非置灰·券态「广告券×N」·新手期隐）。
    this.applyAdButton(this.gachaSponsorBtn, this.gachaSponsorLabel, 'sponsor_supply', `📺 赞助补给·看广告得补给券×${S7_SPONSOR_SUPPLY_TICKETS}`);

    // 专属兑换进度 + 领箱按钮。
    if (pool === 'exclusive') {
      const boxes = availableExchangeBoxes(gacha, cfg);
      if (this.gachaExchangeLabel) this.gachaExchangeLabel.string = `兑换进度 ${gacha.exchangeProgress % cfg.exchangeThreshold}/${cfg.exchangeThreshold}（满兑当期专属A级）`;
      if (this.gachaClaimBtn) {
        this.gachaClaimBtn.active = boxes > 0;
        const cl = this.gachaClaimBtn.getComponentInChildren(Label);
        if (cl) cl.string = boxes > 1 ? `领兑换箱 ×${boxes}` : '领兑换箱';
      }
    } else {
      if (this.gachaExchangeLabel) this.gachaExchangeLabel.string = '';
      if (this.gachaClaimBtn) this.gachaClaimBtn.active = false;
    }
  }

  /** 抽卡（count=1 单抽 / 10 十连）：免费抽先花（补给站 Lv4/Lv7）→ 补给券；十连 Lv10 九折。出货落 squad/阶级/碎片、刷新。 */
  private onGachaDraw(count: number): void {
    if (!this.playerState || !this.session || !this.buildings) return;
    const avail = Math.floor(this.session.resources.supplyTicket ?? 0);
    const now = Date.now();
    const dayIdx = gachaDayIndex(now);
    const supplyLv = getBuildingLevel(this.buildings, 'bld_supply_station');
    const freeLeft = freePullsLeftToday(this.playerState.gacha, dayIdx, supplyFreeDailyPulls(supplyLv));
    const tenCost = supplyTenPullTicketCost(supplyLv);
    // 支付力校验（十连=整额券价；单抽=免费或 1 券）——不足时按钮已变灰，这里再守一道。
    const payable = count >= 10 ? avail >= tenCost : freeLeft + avail >= count;
    if (!payable) {
      const sponsorVisible = this.adButtonState('sponsor_supply').kind !== 'hidden';
      if (this.gachaResultLabel) {
        this.gachaResultLabel.string = count >= 10 ? `补给券不足 ${tenCost} 张，无法十连`
          : sponsorVisible ? '补给券不足！点「赞助补给」看广告得券' : '补给券不足（商人小站每日有售）';
      }
      return;
    }
    const rng = new S7AutoBattleRng(`gacha_${this.gachaPool}_${now}_${avail}`);
    const r = drawGachaMany(
      this.playerState.gacha, this.squad!, this.playerState.unitTiers, this.playerState.exclusiveShards, this.playerState.mailbox,
      DEFAULT_S7_GACHA_CONFIG, rng, this.gachaPool, count, avail, dayIdx, now,
      { supplyLevel: supplyLv, freePulls: freeLeft },
    );
    this.session.resources.supplyTicket = avail - r.ticketsSpent; // 按实际消耗扣券
    if (r.freePullsSpent > 0) spendFreePulls(this.playerState.gacha, dayIdx, r.freePullsSpent);
    // 出货明细。
    if (this.gachaResultLabel) {
      const lines = r.outcomes.map((o) => this.gachaOutcomeText(o));
      const head = r.outcomes.length > 1 ? `本次${r.outcomes.length}连：\n` : '';
      const freeNote = r.freePullsSpent > 0 ? `（含免费抽×${r.freePullsSpent}）\n` : '';
      this.gachaResultLabel.string = (head + freeNote + lines.join('\n')) || '出货异常（配置空池？）';
    }
    if (r.outcomes.length > 0) this.feedActivity(S7_ACTIVITY_ACTIONS.gacha, r.outcomes.length); // G：抽卡喂活动进度(每抽)
    const hasHighlight = r.outcomes.some((o) => o.body !== null && (o.body.result !== 'dup' || o.body.isExclusive));
    if (r.outcomes.length > 0) this.sound.playSfx(hasHighlight ? 'gacha_highlight' : 'gacha_draw');
    this.persist();
    this.refresh();      // 顶部货币栏（券变了）
    this.refreshGacha(); // 池说明/保底/兑换
  }

  private gachaOutcomeText(o: S7GachaDrawOutcome): string {
    const shardLine = `${this.unitName(o.unitKind, o.shardUnitId)}碎片+${o.shardAmount}`;
    if (!o.body) return shardLine;
    const b = o.body;
    const name = this.unitName(o.unitKind, b.unitId);
    const tag = b.isExclusive ? `${this.gachaRankTag(o.unitKind, b.rank)}·专属` : this.gachaRankTag(o.unitKind, b.rank);
    const head = b.viaPity ? '[保底]' : '';
    const bodyLine = b.result === 'new' ? `${head}${name}[${tag}] 新到手!`
      : b.result === 'upgraded' ? `${head}${name}[${tag}] 升到该阶！旧体分解→碎片+${b.foldShards}`
        : `${head}${name}[${tag}] 已有→碎片+${b.foldShards}`;
    return `${bodyLine}　${shardLine}`;
  }

  /** 本体阶级标签（舰=C/B/A 级·员=1/2/3★）。 */
  private gachaRankTag(kind: 'ship' | 'pilot', rank: 'C' | 'B' | 'A'): string {
    if (kind === 'pilot') return rank === 'A' ? '3★' : rank === 'B' ? '2★' : '1★';
    return `${rank}级`;
  }

  /** 领专属池兑换箱（一次领光·×2叠领）：发当期专属本体 / 已有则溢出折碎片。 */
  private onGachaClaim(): void {
    if (!this.playerState) return;
    const res = claimExchangeBox(this.playerState.gacha, this.squad!, this.playerState.exclusiveShards, DEFAULT_S7_GACHA_CONFIG, gachaDayIndex(Date.now()), true);
    if (this.gachaResultLabel) {
      if (!res.ok) this.gachaResultLabel.string = res.reason === 'no_box' ? '还没有可领的兑换箱' : '当期无专属';
      else if (res.result === 'exclusive_body') this.gachaResultLabel.string = `兑换箱：${this.unitName('ship', res.exclusiveShipId)}[A级·专属] 到手!${res.shardsGained > 0 ? ` +碎片${res.shardsGained}` : ''}`;
      else this.gachaResultLabel.string = `兑换箱：[A级·专属]已拥有→碎片+${res.shardsGained}`;
    }
    if (res.ok) this.sound.playSfx(res.result === 'exclusive_body' ? 'gacha_highlight' : 'reward_claim');
    this.persist();
    this.refreshGacha();
  }

  /** 赞助补给（S13 #6·块5 定量）：看广告得补给券×10（S7_SPONSOR_SUPPLY_TICKETS·占位挂第三块）。每日1次/券态走统一广告流。 */
  private onGachaSponsorAd(): void {
    if (!this.session) return;
    this.runAdPoint('sponsor_supply',
      () => {
        this.session!.resources.supplyTicket = Math.floor(this.session!.resources.supplyTicket ?? 0) + S7_SPONSOR_SUPPLY_TICKETS;
        if (this.gachaResultLabel) this.gachaResultLabel.string = `赞助补给 +${S7_SPONSOR_SUPPLY_TICKETS} 补给券！`;
        this.persist();
        this.refresh();
        this.refreshGacha();
      },
      (reason) => {
        if (this.gachaResultLabel) this.gachaResultLabel.string = reason === 'ad_failed' ? '广告没看完，没得到补给券' : '广告加载失败';
        this.refreshGacha(); // 券态可能已退回·刷显隐
      });
  }

  /** 单位 id → 中文名（取配置·缺失回退 id）。 */
  private unitName(kind: 'ship' | 'pilot', id: string): string {
    if (!this.runtime) return id;
    if (kind === 'ship') return this.runtime.getById<S7ShipConfig>('ship_config', id)?.name ?? id;
    return this.runtime.getById<S7PilotConfig>('pilot_config', id)?.name ?? id;
  }

  // ===== D 打捞港界面（信标打捞）=====

  private readonly SALVAGE_TIERS: { tier: S7BeaconTier; name: string }[] = [
    { tier: 'common', name: '普通' }, { tier: 'rare', name: '稀有' }, { tier: 'epic', name: '史诗' },
  ];

  /** 搭打捞浮层（默认隐藏）：标题/信标存量+队占用 + 选档 + 选时长 + 开打 + 进行中任务列表(倒计时/收菜/加速) + 返回。 */
  private buildSalvagePanel(W: number, H: number): void {
    const panel = new Node('S7Salvage'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(14, 24, 30, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.salvageNode = panel;

    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;

    this.mkPanelLabel(panel, '打捞港', 40, new Color(150, 220, 240), -W * 0.30, topY - 30);
    this.salvageInfoLabel = this.mkPanelLabel(panel, '', 24, new Color(210, 230, 245), 0, topY - 92);
    this.labelBox(this.salvageInfoLabel).setContentSize(W * 0.94, 34); // #2：信标存量行超长自动缩
    this.salvageInfoLabel.overflow = Label.Overflow.SHRINK;
    this.salvageInfoLabel.enableWrapText = false;

    // 选信标档。
    this.mkPanelLabel(panel, '选信标档', 24, new Color(170, 190, 210), -W * 0.36, topY - 150);
    this.salvageTierBtns = [];
    const tierY = topY - 200;
    this.SALVAGE_TIERS.forEach((t, i) => {
      const x = (-1 + i) * W * 0.28;
      const n = this.mkToggleBtn(panel, t.name, x, tierY, () => this.selectSalvageTier(t.tier));
      this.salvageTierBtns.push({ tier: t.tier, node: n });
    });

    // 选时长。
    this.mkPanelLabel(panel, '选时长', 24, new Color(170, 190, 210), -W * 0.36, topY - 270);
    this.salvageHourBtns = [];
    const hourY = topY - 320;
    [2, 8, 24].forEach((h, i) => {
      const x = (-1 + i) * W * 0.28;
      const n = this.mkToggleBtn(panel, `${h}h`, x, hourY, () => this.selectSalvageHours(h));
      this.salvageHourBtns.push({ hours: h, node: n });
    });

    this.salvageStartBtn = this.addBtn(panel, '开始打捞 (耗1信标)', 420, 88, new Color(70, 160, 130, 255), 0, topY - 410, () => this.onSalvageStart(), 30).node.parent;

    // 进行中任务列表容器。
    this.mkPanelLabel(panel, '— 进行中 —', 24, new Color(150, 170, 190), 0, topY - 480);
    const list = new Node('svList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.salvageListNode = list;

    this.salvageResultLabel = this.mkPanelLabel(panel, '选档+时长→开始打捞', 24, new Color(180, 230, 200), 0, botY + 130);
    this.addBtn(panel, '返回星港', 240, 80, new Color(120, 90, 160, 255), -W * 0.18, botY + 44, () => this.closeSalvage(), 30);
    this.addBtn(panel, '升级打捞港', 260, 80, new Color(90, 150, 110, 255), W * 0.20, botY + 44, () => this.openBuildingUpgrade('bld_salvage_port'), 28);
  }

  /** 单选小按钮（选档/选时长用·存 node 供高亮）。 */
  private mkToggleBtn(parent: Node, text: string, x: number, y: number, onTap: () => void): Node {
    const n = new Node('tg'); n.layer = this.node.layer; parent.addChild(n); n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(180, 76);
    n.addComponent(Graphics);
    const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
    const l = ln.addComponent(Label); l.fontSize = 30; l.lineHeight = 36; l.color = new Color(255, 255, 255); l.string = text;
    n.on(Node.EventType.TOUCH_END, onTap, this);
    return n;
  }
  private paintToggle(n: Node, selected: boolean, w = 180, h = 76): void {
    const g = n.getComponent(Graphics); if (!g) return;
    g.clear(); g.fillColor = selected ? new Color(80, 160, 130, 255) : new Color(46, 58, 66, 255);
    g.roundRect(-w / 2, -h / 2, w, h, 10); g.fill();
  }

  private openSalvage(): void {
    if (this.blockIfBuildingLocked('bld_salvage_port', '打捞港')) return;
    if (!this.salvageNode) return;
    this.salvageNode.active = true;
    if (this.salvageResultLabel) this.salvageResultLabel.string = '选档+时长→开始打捞';
    this.refreshSalvage();
    if (!this.salvageTicking) { this.salvageTicking = true; this.schedule(this.salvageTick, 1); } // 每秒刷倒计时
  }
  private closeSalvage(): void {
    if (this.salvageNode) this.salvageNode.active = false;
    if (this.salvageTicking) { this.salvageTicking = false; this.unschedule(this.salvageTick); }
  }
  private salvageTick = (): void => { if (this.salvageNode?.active) this.refreshSalvage(); };

  private selectSalvageTier(tier: S7BeaconTier): void { this.salvageSelTier = tier; this.refreshSalvage(); }
  private selectSalvageHours(h: number): void { this.salvageSelHours = h; this.refreshSalvage(); }

  /** 打捞港等级 → 打捞队上限。 */
  private salvageTeamMax(): number {
    return salvageTeamLimit(this.buildings ? getBuildingLevel(this.buildings, 'bld_salvage_port') : 0);
  }

  /** 刷新打捞界面：信标存量/队占用、选档/时长高亮、进行中任务列表（倒计时+收菜/加速）。 */
  private refreshSalvage(): void {
    if (!this.playerState || !this.session || !this.salvageListNode) return;
    const r = this.session.resources;
    const teamMax = this.salvageTeamMax();
    const used = this.playerState.salvage.missions.length;
    if (this.salvageInfoLabel) {
      this.salvageInfoLabel.string = `信标 普通${Math.floor(r.beaconCommon ?? 0)} 稀有${Math.floor(r.beaconRare ?? 0)} 史诗${Math.floor(r.beaconEpic ?? 0)}　打捞队 ${used}/${teamMax}`;
    }
    for (const b of this.salvageTierBtns) this.paintToggle(b.node, b.tier === this.salvageSelTier);
    for (const b of this.salvageHourBtns) this.paintToggle(b.node, b.hours === this.salvageSelHours);

    // 重建任务列表。
    this.salvageListNode.removeAllChildren();
    this.salvageCollectBtns.clear();
    const band = getS7UsableBand();
    let y = band.usableTopY - 540;
    const now = Date.now();
    if (this.playerState.salvage.missions.length === 0) {
      this.mkPanelLabel(this.salvageListNode, '（暂无打捞·选档开始）', 24, new Color(150, 160, 175), 0, y);
    }
    // 块5 统一三态（#5·每日1次·点位级一次算好）：可用/券态→出按钮；已用&无券→按钮不出现（非置灰）。
    const adSt = this.adButtonState('salvage_speedup');
    for (const m of this.playerState.salvage.missions) {
      const tierName = this.SALVAGE_TIERS.find((t) => t.tier === m.tier)?.name ?? m.tier;
      const done = isSalvageDone(m, now);
      const remain = salvageRemainingMs(m, now);
      const txt = done ? `${tierName}·${m.hours}h ✅可收菜` : `${tierName}·${m.hours}h ⏳${this.fmtRemain(remain)}`;
      this.mkPanelLabel(this.salvageListNode, txt, 26, done ? new Color(150, 235, 170) : new Color(220, 225, 235), -this.viewW * 0.20, y);
      const mid = m.id;
      if (done) {
        const btn = this.addBtn(this.salvageListNode, '收菜', 150, 64, new Color(70, 160, 110, 255), this.viewW * 0.30, y, () => this.onSalvageCollect(mid), 28);
        if (btn.node.parent) this.salvageCollectBtns.set(mid, btn.node.parent);
      } else {
        // S13 #5 改行为（决策④）：看广告=直接完成当前打捞（不论品质/剩余时长）；DEV「秒成」并存不混淆（工具style·上线删）。
        // 巡检批 #15：广告键与 DEV「秒成」热区间距拉到 ≥8px（块5 只把 35px 重叠收到 2.5px 间距·未达标）。
        if (adSt.kind !== 'hidden') {
          const base = '📺 看广告立即完成';
          const label = adSt.kind === 'ticket' ? adTicketButtonLabel(base, adSt.tickets) : base;
          this.clampBtnLabel(this.addBtn(this.salvageListNode, label, 250, 64, new Color(200, 130, 70, 255), this.viewW * 0.185, y, () => this.onSalvageAdComplete(mid), 22));
        }
        this.addBtn(this.salvageListNode, '秒成', 96, 64, new Color(110, 90, 140, 255), this.viewW * 0.43, y, () => this.devFinishSalvage(mid), 22); // DEV-TEMP
      }
      y -= 92;
    }
  }

  /** 剩余毫秒 → "Xh Ym Zs" 简显。 */
  private fmtRemain(ms: number): string {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h${m}m`;
    if (m > 0) return `${m}m${sec}s`;
    return `${sec}s`;
  }

  private onSalvageStart(): void {
    if (!this.playerState || !this.session) return;
    const tier = this.salvageSelTier;
    const key = BEACON_RESOURCE[tier];
    if (Math.floor((this.session.resources as Record<string, number>)[key] ?? 0) <= 0) {
      if (this.salvageResultLabel) this.salvageResultLabel.string = `没有${this.SALVAGE_TIERS.find((t) => t.tier === tier)?.name}信标（去商人/活动获取）`;
      return;
    }
    const lv = this.buildings ? getBuildingLevel(this.buildings, 'bld_salvage_port') : 0;
    const res = startSalvage(this.playerState.salvage, DEFAULT_S7_SALVAGE_CONFIG, tier, this.salvageSelHours, lv, Date.now());
    if (!res.ok) {
      if (this.salvageResultLabel) this.salvageResultLabel.string = res.reason === 'no_team_slot' ? '打捞队都在忙（升打捞港加队）' : '无法开打';
      return;
    }
    (this.session.resources as Record<string, number>)[key] -= 1; // 扣 1 张该档信标
    if (this.salvageResultLabel) this.salvageResultLabel.string = `已派出打捞队（${this.salvageSelHours}h）`;
    this.persist();
    this.refresh();
    this.refreshSalvage();
  }

  private onSalvageCollect(missionId: string): void {
    if (!this.playerState) return;
    const res = collectSalvage(this.playerState.salvage, DEFAULT_S7_SALVAGE_CONFIG, missionId, Date.now(), new S7AutoBattleRng(`salvage_${missionId}_${Date.now()}`), this.buildings ? getBuildingLevel(this.buildings, 'bld_salvage_port') : 0);
    if (!res.ok) { if (this.salvageResultLabel) this.salvageResultLabel.string = res.reason === 'not_done' ? '还没打捞完' : '任务不存在'; return; }
    const texts = res.rewards.map((rw) => this.applySalvageReward(rw));
    if (this.salvageResultLabel) this.salvageResultLabel.string = `带回：${texts.filter(Boolean).join('、')}`;
    this.feedActivity(S7_ACTIVITY_ACTIONS.salvage); // G：打捞收菜喂活动进度
    this.persist();
    this.refresh();
    this.refreshSalvage();
  }

  /** S13 #5（块5 改行为·决策④）：看广告=直接完成当前打捞。每日1次/券态/失败退券走统一广告流。 */
  private onSalvageAdComplete(missionId: string): void {
    if (!this.playerState) return;
    this.runAdPoint('salvage_speedup',
      () => {
        const sp = salvageAdComplete(this.playerState!.salvage, missionId, Date.now());
        if (this.salvageResultLabel) {
          this.salvageResultLabel.string = sp.ok ? '打捞已完成——点「收菜」入账'
            : sp.reason === 'already_done' ? '已可收菜' : '任务不存在';
        }
        this.persist();
        this.refreshSalvage();
      },
      (reason) => {
        if (this.salvageResultLabel) this.salvageResultLabel.string = reason === 'ad_failed' ? '广告没看完，打捞未完成' : '广告加载失败';
        this.refreshSalvage(); // 券态可能已退回·刷显隐
      });
  }

  /** DEV-TEMP：秒成（把任务结束时刻设为现在）便于灰盒验证收菜（真机不可能等2-24h）。正式版删。 */
  private devFinishSalvage(missionId: string): void {
    if (!this.playerState) return;
    const m = this.playerState.salvage.missions.find((x) => x.id === missionId);
    if (m) { m.endTime = Date.now(); this.persist(); this.refreshSalvage(); }
  }

  /** M5 关5：首次打捞教学奖励——直接判完成，免去真机不可能等的 2h（非 DEV-TEMP，正式逻辑保留）。 */
  private tutorialFinishFirstSalvage(): void {
    if (!this.playerState) return;
    const missions = this.playerState.salvage.missions;
    const m = missions[missions.length - 1];
    if (m) m.endTime = Date.now();
  }

  /** 把一条打捞奖励入账，返回中文短描述（供结果行汇总）。完整星舰已拥有→折该船专属碎片(15·同抽卡重复)。 */
  private applySalvageReward(rw: S7SalvageReward): string {
    if (!this.playerState || !this.session) return '';
    switch (rw.kind) {
      case 'resource': {
        const res = this.session.resources as Record<string, number>;
        if (res[rw.resourceId] === undefined) return ''; // 非钱包键（护栏：不会有 exShard 之类）
        res[rw.resourceId] += rw.amount;
        return `${this.zhRes(rw.resourceId)}×${rw.amount}`;
      }
      case 'plugin': {
        if (this.pluginInventory) {
          const ids = Array.from(this.pluginSlotMap.keys());
          const pid = ids.length > 0 ? ids[this.pluginInventory.plugins.length % ids.length] : 'plg01';
          addOwnedPlugin(this.pluginInventory, pid, rw.quality);
        }
        const q = rw.quality === 'fine' ? '精良' : rw.quality === 'superior' ? '优秀' : '传奇';
        return `${q}插件`;
      }
      case 'chest':
        addChest(this.playerState.chests, rw.chestId as any, rw.amount);
        return `星辉货舱×${rw.amount}`;
      case 'population':
        if (rw.pop === 'resident') this.playerState.population.residents += rw.amount;
        else this.playerState.population.workers += rw.amount;
        return rw.pop === 'resident' ? `居民×${rw.amount}` : `工人×${rw.amount}`;
    }
  }

  // ===== E 商人小站界面 =====

  /** 搭商人浮层（默认隐藏）：标题/星贝 + 刷新行(免费/付费/广告) + 货架列表(买) + 卖区(回收星矿/信标/闲置插件) + 返回。 */
  private buildMerchantPanel(W: number, H: number): void {
    const panel = new Node('S7Merchant'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(26, 20, 14, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.merchantNode = panel;

    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;

    this.mkPanelLabel(panel, '商人小站', 40, new Color(230, 195, 120), -W * 0.30, topY - 30);
    this.merchantStarLabel = this.mkPanelLabel(panel, '星贝 0', 28, new Color(240, 210, 110), W * 0.24, topY - 30);

    // 刷新行（去付费·仅免费 + 广告）。广告刷新键=块5 统一三态（每日1次·用尽即隐·券态），refreshMerchant 控显。
    this.addBtn(panel, '免费刷新', 230, 70, new Color(80, 130, 90, 255), -W * 0.20, topY - 110, () => this.onMerchantRefresh('free'), 28);
    const adRef = this.addBtn(panel, '📺 广告刷新', 280, 70, new Color(180, 110, 70, 255), W * 0.20, topY - 110, () => this.onMerchantRefresh('ad'), 26);
    this.merchantAdRefreshLabel = adRef;
    this.merchantAdRefreshBtn = adRef.node.parent;

    // 货架列表容器。
    const list = new Node('mList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.merchantListNode = list;

    // 卖区（回收按钮随商人等级解锁·refreshMerchant 重建）。
    this.mkPanelLabel(panel, '— 回收换星贝 —', 22, new Color(180, 160, 130), 0, botY + 210);
    const sell = new Node('mSell'); sell.layer = this.node.layer; panel.addChild(sell); sell.setPosition(0, 0, 0);
    this.merchantSellNode = sell;

    this.merchantResultLabel = this.mkPanelLabel(panel, '逛逛·买卖换星贝', 24, new Color(220, 210, 160), 0, botY + 100);
    this.addBtn(panel, '返回星港', 240, 76, new Color(120, 90, 160, 255), -W * 0.18, botY + 40, () => this.closeMerchant(), 28);
    this.addBtn(panel, '升级商人小站', 260, 76, new Color(90, 150, 110, 255), W * 0.20, botY + 40, () => this.openBuildingUpgrade('bld_merchant_station'), 26);
  }

  private merchantLevel(): number {
    return this.buildings ? getBuildingLevel(this.buildings, 'bld_merchant_station') : 0;
  }

  private openMerchant(): void {
    if (this.blockIfBuildingLocked('bld_merchant_station', '商人小站')) return;
    if (!this.merchantNode || !this.playerState || !this.session) return;
    // 进店先按当前日刷新货架（跨天自动重铺 + 清购买量/计数）。
    refreshMerchantToCycle(this.playerState.merchant, DEFAULT_S7_MERCHANT_CONFIG, this.merchantLevel(), new S7AutoBattleRng(`mc_${Date.now()}`), Date.now());
    this.persist();
    this.merchantNode.active = true;
    if (this.merchantResultLabel) this.merchantResultLabel.string = '逛逛·买卖换星贝';
    this.refreshMerchant();
  }
  private closeMerchant(): void { if (this.merchantNode) this.merchantNode.active = false; }

  /** 刷新商人界面：星贝/免费刷新次数 + 重建货架列表（名/价/剩余 + 买）+ 重建回收区（随等级解锁）。
   *  块5：header 不显示广告刷新剩余次数（决策②·广告类一律不显剩余）；广告刷新键走统一三态；
   *  广告券商品行强引导期不渲染（新手期全隐收口——玩家没见过广告前不卖"广告券"）。 */
  private refreshMerchant(): void {
    if (!this.playerState || !this.session || !this.merchantListNode) return;
    const m = this.playerState.merchant;
    const lv = this.merchantLevel();
    if (this.merchantStarLabel) {
      this.merchantStarLabel.string = `星贝 ${Math.floor(this.session.resources.starCargo ?? 0)}　商人Lv.${lv}　免费刷新次数剩余${m.freeRefreshRemaining}`;
    }
    this.applyAdButton(this.merchantAdRefreshBtn, this.merchantAdRefreshLabel, 'merchant_refresh', '📺 广告刷新');
    this.merchantListNode.removeAllChildren();
    this.merchantTicketBuyBtn = null;
    let y = getS7UsableBand().usableTopY - 200;
    for (const offer of m.offers) {
      // 广告券商品：强引导期整行不渲染（货架状态不动·纯显示过滤）。
      if (offer.item.kind === 'resource' && offer.item.resourceId === AD_TICKET_RESOURCE_KEY && this.isStrongGuideActive()) continue;
      const remain = offerRemaining(m, offer);
      const nameStr = this.shopItemName(offer.item);
      const tag = offer.rare ? '★稀有 ' : '';
      this.mkPanelLabel(this.merchantListNode, `${tag}${nameStr}  ${offer.price}星贝  (剩${remain}/${offer.purchaseLimit})`, 24, remain > 0 ? new Color(225, 220, 200) : new Color(140, 140, 140), -this.viewW * 0.16, y);
      const oid = offer.offerId;
      const canBuy = remain > 0 && Math.floor(this.session.resources.starCargo ?? 0) >= offer.price;
      // 巡检批 #15：行距 60 − 键高 52 = 相邻行「买」键垂直间距 8px（原 56 高只剩 4px）。
      const btn = this.addBtn(this.merchantListNode, '买', 110, 52, canBuy ? new Color(70, 150, 110, 255) : new Color(70, 75, 90, 255), this.viewW * 0.38, y, () => this.onMerchantBuy(oid), 26);
      // 补给券是 alwaysOffers[0]→offerId='o0'，固定在第一行，捕获以便强引导 case43 锁步高亮。
      if (offer.offerId === 'o0') this.merchantTicketBuyBtn = btn.node.parent;
      y -= 60;
    }
    this.rebuildMerchantSell(lv);
  }

  /** 重建回收区按钮：回收星矿/信标随商人小站等级陆续解锁（未到等级→灰显"lvX解锁"）。 */
  private rebuildMerchantSell(lv: number): void {
    if (!this.merchantSellNode) return;
    this.merchantSellNode.removeAllChildren();
    const W = this.viewW, botY = getS7UsableBand().usableBottomY;
    const rc = DEFAULT_S7_MERCHANT_CONFIG.recycle;
    const mk = (label: string, x: number, unlockLv: number, onTap: () => void) => {
      const open = lv >= unlockLv;
      this.addBtn(this.merchantSellNode!, open ? label : `lv${unlockLv}解锁`, 230, 66, open ? new Color(110, 95, 70, 255) : new Color(70, 72, 84, 255), x, botY + 150, () => { if (open) onTap(); }, 24);
    };
    mk('回收100星矿', -W * 0.20, rc.starOreUnlockLevel, () => this.onMerchantRecycleOre(100));
    mk('回收普通信标', W * 0.20, rc.beaconUnlockLevel, () => this.onMerchantRecycleBeacon('common'));
  }

  /** 商品 → 中文短名。 */
  private shopItemName(item: S7ShopItem): string {
    if (item.kind === 'plugin') {
      const q = item.quality === 'fine' ? '精良' : item.quality === 'superior' ? '优秀' : '传奇';
      return `${q}插件`;
    }
    if (item.kind === 'bundle') return `${item.name}(${item.resources.map((r) => `${this.zhRes(r.resourceId)}×${r.amount}`).join('+')})`;
    if (item.kind === 'core') return '流通星核(随机一颗)';
    return `${this.zhRes(item.resourceId)}×${item.amount}`;
  }

  private onMerchantBuy(offerId: string): void {
    if (!this.playerState || !this.session) return;
    const r = buyMerchantOffer(this.playerState.merchant, this.session.resources, offerId, Date.now());
    if (!r.ok) {
      if (this.merchantResultLabel) this.merchantResultLabel.string = r.reason === 'insufficient_starcargo' ? '星贝不够' : r.reason === 'limit_reached' ? '今日已买够这件' : '该商品没了';
      this.refreshMerchant();
      return;
    }
    const got = this.applyShopItem(r.item);
    if (this.merchantResultLabel) this.merchantResultLabel.string = `买到 ${got}（花 ${r.spent} 星贝）`;
    this.persist();
    this.refresh();
    this.refreshMerchant();
  }

  /** 把买到的商品入账，返回中文短描述。 */
  private applyShopItem(item: S7ShopItem): string {
    if (!this.session) return '';
    if (item.kind === 'resource') {
      const res = this.session.resources as Record<string, number>;
      if (res[item.resourceId] !== undefined) res[item.resourceId] += item.amount;
      return `${this.zhRes(item.resourceId)}×${item.amount}`;
    }
    if (item.kind === 'bundle') {
      const res = this.session.resources as Record<string, number>;
      for (const r of item.resources) { if (res[r.resourceId] !== undefined) res[r.resourceId] += r.amount; }
      return item.name;
    }
    if (item.kind === 'core') {
      const coreId = grantRandomFlowCore(this.squad!, new S7AutoBattleRng(`shop_flow_core_${Date.now()}`));
      return coreId ? `${this.coreName(coreId)}(流通核)` : '流通核(发放异常)';
    }
    // plugin：挑一个 pluginId 入库（品质来自商品）。
    if (this.pluginInventory) {
      const ids = Array.from(this.pluginSlotMap.keys());
      const pid = ids.length > 0 ? ids[this.pluginInventory.plugins.length % ids.length] : 'plg01';
      addOwnedPlugin(this.pluginInventory, pid, item.quality);
    }
    const q = item.quality === 'fine' ? '精良' : item.quality === 'superior' ? '优秀' : '传奇';
    return `${q}插件`;
  }

  private onMerchantRefresh(mode: S7RefreshMode): void {
    if (!this.playerState || !this.session) return;
    const doRefresh = () => {
      const r = refreshMerchantShop(this.playerState!.merchant, DEFAULT_S7_MERCHANT_CONFIG, this.merchantLevel(), new S7AutoBattleRng(`mr_${mode}_${Date.now()}`), mode);
      if (this.merchantResultLabel) {
        // 决策②：广告类不显剩余次数；免费刷新照显。
        this.merchantResultLabel.string = r.ok ? (mode === 'free' ? `已刷新一批新货（免费·剩余${r.remaining}）` : '已刷新一批新货') : '刷新次数用尽';
      }
      this.persist();
      this.refreshMerchant();
    };
    if (mode === 'ad') {
      // 块5：每日1次/券态/失败退券统一走 runAdPoint（商人内部广告计数已随之移除）。
      this.runAdPoint('merchant_refresh', doRefresh, (reason) => {
        if (this.merchantResultLabel) this.merchantResultLabel.string = reason === 'ad_failed' ? '广告没看完，未刷新' : '广告加载失败';
        this.refreshMerchant(); // 券态可能已退回·刷显隐
      });
    } else {
      doRefresh();
    }
  }


  private onMerchantRecycleOre(amount: number): void {
    if (!this.session) return;
    const r = recycleStarOre(this.session.resources as Record<string, number>, DEFAULT_S7_MERCHANT_CONFIG, amount);
    if (this.merchantResultLabel) this.merchantResultLabel.string = r.ok ? `回收星矿→星贝+${r.starCargoGained}` : r.reason === 'insufficient' ? '星矿不够' : '量太少换不出星贝';
    this.persist(); this.refresh(); this.refreshMerchant();
  }

  private onMerchantRecycleBeacon(tier: 'common' | 'rare' | 'epic'): void {
    if (!this.session) return;
    const r = recycleBeacon(this.session.resources as Record<string, number>, DEFAULT_S7_MERCHANT_CONFIG, tier, 1, this.buildings ? getBuildingLevel(this.buildings, 'bld_merchant_station') : 0);
    if (this.merchantResultLabel) this.merchantResultLabel.string = r.ok ? `回收信标→星贝+${r.starCargoGained}` : '没有该档信标';
    this.persist(); this.refresh(); this.refreshMerchant();
  }

  // ===== J 建筑升级弹框（各建筑共用：等级/当前→下一级效果/花星矿·工人折扣）=====

  /** 搭建筑升级弹框（默认隐藏·居中卡片）。 */
  private buildBuildingUpgradePanel(W: number, H: number): void {
    const panel = new Node('S7BuildUpgrade'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, 170); g.rect(-W / 2, -H / 2, W, H); g.fill();
    const cw = W * 0.84, ch = H * 0.36;
    g.fillColor = new Color(30, 30, 46, 255); g.roundRect(-cw / 2, -ch / 2, cw, ch, 18); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.active = false;
    this.buildingUpgradeNode = panel;
    this.addModalDismiss(panel, () => this.closeBuildingUpgrade(), cw, ch, 0, 0);
    this.buUpTitleLabel = this.mkPanelLabel(panel, '', 40, new Color(255, 225, 140), 0, ch * 0.33);
    this.buUpInfoLabel = this.mkPanelLabel(panel, '', 26, new Color(225, 230, 245), 0, ch * 0.02);
    // B0.6 #14：左关闭 · 右升级，统一孔位等宽等高（巡检批修：原 200/240 不等宽）。
    const [, buUp] = this.addDialogBtnPair(
      panel, '关闭', new Color(110, 90, 150, 255), () => this.closeBuildingUpgrade(),
      '升级', new Color(80, 160, 110, 255), () => this.onBuildingUpgradeConfirm(), -ch * 0.34, 220, 88,
    );
    this.buUpBtn = buUp.node.parent;
  }

  private openBuildingUpgrade(buildingId: string): void {
    if (this.blockIfBuildingLocked(buildingId, '该建筑')) return;
    if (!this.buildingUpgradeNode) return;
    this.buildingUpgradeTarget = buildingId;
    // 置顶：升级弹窗被多个建筑界面共用，必须盖在当前界面之上（否则被后建的船坞/训练舱浮层压在底下）。
    const parent = this.buildingUpgradeNode.parent;
    if (parent) this.buildingUpgradeNode.setSiblingIndex(parent.children.length - 1);
    this.buildingUpgradeNode.active = true;
    this.refreshBuildingUpgrade();
  }
  private closeBuildingUpgrade(): void { if (this.buildingUpgradeNode) this.buildingUpgradeNode.active = false; }

  /** 刷新升级弹框内容：等级 + 当前→下一级效果 + 花费星矿(工人折后)；满级/买不起→按钮灰。 */
  private refreshBuildingUpgrade(): void {
    if (!this.buildings || !this.playerState || !this.population) return;
    const id = this.buildingUpgradeTarget;
    const v = buildBuildingUpgradeView([id], this.buildings, this.playerState.resources, this.population)[0];
    if (this.buUpTitleLabel) this.buUpTitleLabel.string = S7_BUILDING_NAMES[id] ?? id;
    const greyBtn = () => this.paintBtn(this.buUpBtn, new Color(70, 75, 90, 255), 220, 88);
    if (!this.buUpInfoLabel) return;
    if (v.atMax) {
      this.buUpInfoLabel.string = `已满级 Lv.${v.level}\n效果：${this.effectSummary(id, v.level)}`;
      greyBtn();
    } else {
      this.buUpInfoLabel.string = `Lv.${v.level} → Lv.${v.level + 1}\n现：${this.effectSummary(id, v.level)}\n升后：${this.effectSummary(id, v.level + 1)}\n花费：${v.discountedCost} 星矿`;
      this.paintBtn(this.buUpBtn, v.canAfford ? new Color(80, 160, 110, 255) : new Color(70, 75, 90, 255), 220, 88);
    }
  }

  private onBuildingUpgradeConfirm(): void {
    if (!this.buildings || !this.playerState || !this.population) return;
    const id = this.buildingUpgradeTarget;
    const r = upgradeBuildingWithDiscount(this.buildings, this.playerState.resources, this.population, id);
    if (!r.ok) {
      if (this.buUpInfoLabel) this.buUpInfoLabel.string = r.code === 'max_level' ? '已满级' : r.code === 'insufficient_star_ore' ? '星矿不够（去出战/回收攒矿）' : '暂不可升级';
      return;
    }
    // 商人升级：当场 +1 次免费刷新（一次性·Ron）。升级不改当前货架；新格子等下次刷新生效。
    if (id === 'bld_merchant_station' && this.playerState) grantMerchantFreeRefresh(this.playerState.merchant, 1);
    this.persist();
    this.refresh();           // 主界面货币 + hub 建筑等级/红点
    this.refreshBuildingUpgrade();
    if (this.merchantNode?.active) this.refreshMerchant();
    if (this.salvageNode?.active) this.refreshSalvage();
    if (this.habitatNode?.active) this.refreshInfoBuilding('habitat');
    if (this.galleryNode?.active) this.refreshInfoBuilding('gallery');
    if (this.dockNode?.active) this.refreshUnitTrain('ship');
    if (this.trainingNode?.active) this.refreshUnitTrain('pilot');
  }

  /** 战斗结果弹窗（胜/败统一·居中对话框+半屏遮罩）：v1.0 §4.5。背景遮罩半透明→保留刚结束的战斗画面。
   *  左键恒「返回星港」；右键 胜=「下一关」/败=「再次挑战」（都→去当前节点战前备战，胜后当前已是下一关）。 */
  private buildResultPopup(W: number, H: number): void {
    const panel = new Node('S7Result');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 160); // 半透明→透出背后战斗画面
    dim.rect(-W / 2, -H / 2, W, H);
    dim.fill();
    const dw = W * 0.9;
    const dh = H * 0.32; // ③终稿：奖励明细/广告键全移到三选一屏、结算窗瘦身(banner+📊+三键)，还原原高度
    dim.fillColor = new Color(28, 24, 40, 255);
    dim.roundRect(-dw / 2, -dh / 2, dw, dh, 20);
    dim.fill();
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 结算弹窗：吞触摸·不点空白关(必须点按钮选择)
    panel.active = false;
    this.resultPopupNode = panel;

    const titleN = new Node('t'); titleN.layer = this.node.layer; panel.addChild(titleN); titleN.setPosition(0, dh * 0.30, 0);
    this.resultTitleLabel = titleN.addComponent(Label);
    this.resultTitleLabel.fontSize = 50; this.resultTitleLabel.lineHeight = 60; this.resultTitleLabel.string = '';
    const msgN = new Node('m'); msgN.layer = this.node.layer; panel.addChild(msgN); msgN.setPosition(0, dh * 0.02, 0);
    this.resultMsgLabel = msgN.addComponent(Label);
    this.resultMsgLabel.fontSize = 30; this.resultMsgLabel.lineHeight = 40; this.resultMsgLabel.color = new Color(225, 228, 240); this.resultMsgLabel.string = '';
    // #2：败因/遇袭长文案锚进结算卡内容框自动缩。
    this.labelBox(this.resultMsgLabel).setContentSize(dw * 0.92, dh * 0.34);
    this.resultMsgLabel.overflow = Label.Overflow.SHRINK;
    this.resultMsgLabel.enableWrapText = true;

    const mkB = (w: number, h: number, c: Color, x: number, y: number, tap: () => void): Label => {
      const n = new Node('rb'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = c; bg.roundRect(-w / 2, -h / 2, w, h, 14); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 36; l.lineHeight = 44; l.color = new Color(255, 255, 255); l.string = '';
      n.on(Node.EventType.TOUCH_END, tap, this);
      return l;
    };
    // L 反馈4：伤害统计键（胜负都有·点开看双方 top5）。
    mkB(260, 64, new Color(90, 100, 130, 255), 0, -dh * 0.06, () => this.openBattleStats()).string = '📊 伤害统计';
    // 三键：选择关卡(左) / 返回(中·随语境改文案) / 下一关·再次挑战(右)。x 由 layoutResultKeys 按可见键数走 #14 统一孔位。
    // ③终稿：奖励明细/广告键已全移到三选一屏，结算窗不再带它们。巡检批：220→210 等宽（三键 #15 间距达标）。
    const lvlLbl = mkB(210, 92, new Color(70, 130, 180, 255), -W * 0.30, -dh * 0.30, () => this.onResultGoLevelSelect());
    lvlLbl.string = '选择关卡';
    this.resultLevelBtn = lvlLbl.node.parent; // 块2：悬赏战斗时隐藏（单键返回）
    const homeLbl = mkB(210, 92, new Color(120, 90, 160, 255), 0, -dh * 0.30, () => this.onResultGoHome());
    homeLbl.string = '返回星港';
    this.resultHomeLabel = homeLbl;
    this.resultHomeBtn = homeLbl.node.parent; // M1：强引导 step3 高光「返回星港」用
    this.resultRightLabel = mkB(210, 92, new Color(225, 150, 45, 255), W * 0.30, -dh * 0.30, () => this.onResultGoPrebattle());

    // 块5(S13 #9·附录B B1.5)：战败"安慰补给"附属小块——挂在结算卡下方（仅主线战败显·openResultPopup 控显）。
    // 基础包白送已入账文案 + 旁「📺 安慰双倍」（每日1次·统一三态）；第4败起=鼓励文案、无双倍键。
    const strip = new Node('S7Consolation'); strip.layer = this.node.layer; panel.addChild(strip);
    strip.setPosition(0, -dh / 2 - 78, 0);
    strip.addComponent(UITransform).setContentSize(dw * 0.94, 120);
    const sg = strip.addComponent(Graphics);
    sg.fillColor = new Color(30, 34, 30, 235); sg.roundRect(-(dw * 0.94) / 2, -60, dw * 0.94, 120, 16); sg.fill();
    strip.active = false;
    this.consolationStripNode = strip;
    // 巡检批 #2：文案框右缘止于「安慰双倍」键左缘 8px 外（原 0.60dw 宽垫进按钮底下 72px）。
    const ct = this.mkPanelLabel(strip, '', 22, new Color(215, 230, 210), -dw * 0.135, 0);
    ct.overflow = Label.Overflow.SHRINK; ct.enableWrapText = true;
    ct.getComponent(UITransform)?.setContentSize(dw * 0.50, 108);
    this.consolationTextLabel = ct;
    const cad = this.addBtn(strip, '📺 安慰双倍', 220, 72, new Color(60, 130, 90, 255), dw * 0.30, 0, () => this.onConsolationDouble(), 20);
    this.consolationAdLabel = cad;
    this.consolationAdBtn = cad.node.parent;
  }

  /** 弹结果窗（背景保留战斗画面：不隐藏 stage、不切场景）。 */
  private openResultPopup(won: boolean): void {
    if (!this.resultPopupNode) return;
    // 音效批：演出层路径的胜负音已随收尾演出播（模型 finished 时机=音画同步）——只有旧色块路径在此补播
    if (!this.fxActive) this.sound.playSfx(won ? 'battle_victory' : 'battle_defeat');
    if (this.resultTitleLabel) {
      this.resultTitleLabel.string = won ? '★ 战斗胜利 ★' : '战斗失败';
      this.resultTitleLabel.color = won ? new Color(150, 235, 160) : new Color(255, 150, 150);
    }
    if (this.resultMsgLabel && this.pendingResult) this.resultMsgLabel.string = this.pendingResult.text;
    // 块2：悬赏战斗结算=单键「返回悬赏板」（藏「选关」「下一关/再次挑战」·rule⑨）；主线保持三键。
    // 遇袭=风险抉择（Ron 2026-07-04 修订）：两键——中「🛡 躲避袭击」（零损失返航）/ 右「⚔ 正面迎战」（胜夺小包·败折本单）。
    // 块3：回廊战斗结算=单键「返回回廊」（同悬赏藏「选关」「下一关/再次挑战」·rule⑨）。
    const isBounty = this.bountyActiveCardId !== null;
    const isCorridor = this.corridorActiveLayer !== null;
    const isPuzzle = this.puzzleActiveId !== null; // 块4：推演结算=单键「返回推演」
    const isSpecial = isBounty || isCorridor || isPuzzle;
    const ambushChoice = isBounty && this.bountyAmbushPending !== null;
    if (this.resultLevelBtn) this.resultLevelBtn.active = !isSpecial;
    if (this.resultRightLabel?.node.parent) this.resultRightLabel.node.parent.active = !isSpecial || ambushChoice;
    if (this.resultHomeLabel) this.resultHomeLabel.string = ambushChoice ? '🛡 躲避袭击' : isBounty ? '返回悬赏板' : isCorridor ? '返回回廊' : isPuzzle ? '返回推演' : '返回星港';
    if (this.resultRightLabel) {
      if (ambushChoice) this.resultRightLabel.string = '⚔ 正面迎战';
      else if (!isSpecial) this.resultRightLabel.string = won ? '下一关 ▶' : '再次挑战';
    }
    // B0.6 #14（巡检批·Ron 点名先例）：按可见键数重排到统一孔位——单键居中、两键对称（遇袭 躲避左/迎战右）、三键等分；
    // 长文案（返回悬赏板/⚔ 正面迎战等）锚进按钮内框防溢出（#2）。
    this.layoutResultKeys();
    if (this.resultHomeLabel) this.clampBtnLabel(this.resultHomeLabel);
    if (this.resultRightLabel) this.clampBtnLabel(this.resultRightLabel);
    // 块5(S13 #9)：主线战败 → 结算卡下方附"安慰补给"小块（基础包已入账文案/第4败鼓励文案 + 「📺安慰双倍」三态）。
    this.refreshConsolationStrip(won, isSpecial);
    // 一窗两点（Ron 07-16·只改首胜）：首通有奖且非教程 → 结算窗不再弹出，三选一屏=终点窗
    //（胜利 banner/📊 统计/终局三键全并入·"继续"中转步删除）。教程期走下方旧链（M 0-46 封板步序不动）。
    if (won && this.pendingLevelReward && !this.isStrongGuideActive()) {
      this.openLevelReward();
      return;
    }
    this.resultPopupNode.active = true;
    // F：首通胜利且该档有奖 → 在结算窗之上弹「三选一屏(唯一奖励屏)」（教程旧链：必须选 1 才继续；Boss 继续后弹大奖特写，才露出结算窗）。
    if (won && this.pendingLevelReward) this.openLevelReward();
  }

  /** 结算窗按钮组随语境重排（B0.6 #14·统一孔位）：可见键 1/2/3 个 → 居中 / 左右对称 / 等分一行（等宽等高已由构造保证）。 */
  private layoutResultKeys(): void {
    const keys: Node[] = [];
    if (this.resultLevelBtn?.active) keys.push(this.resultLevelBtn);
    if (this.resultHomeBtn) keys.push(this.resultHomeBtn); // 中键恒在（文案随语境）
    const rightBtn = this.resultRightLabel?.node.parent ?? null;
    if (rightBtn && rightBtn.active) keys.push(rightBtn);
    const xs = this.dialogBtnRowXs(keys.length);
    keys.forEach((n, i) => n.setPosition(xs[i] ?? 0, n.position.y, 0));
  }

  /** 安慰小块刷新：仅"主线战败 + 本场已捕获安慰上下文"时显示。pack=null（第4败起）→ 鼓励文案、无双倍键。 */
  private refreshConsolationStrip(won: boolean, isSpecial: boolean): void {
    if (!this.consolationStripNode) return;
    const c = this.pendingConsolation;
    const show = !won && !isSpecial && c !== null;
    this.consolationStripNode.active = show;
    if (!show || !c) return;
    if (this.consolationTextLabel) {
      this.consolationTextLabel.string = c.pack
        ? `🎁 安慰补给已入账：${this.gainsText(c.pack)}${c.doubled ? '（已双倍✓）' : ''}`
        : CONSOLATION_ENCOURAGE_TEXT;
    }
    // 「📺 安慰双倍」：有包可翻且未翻才出现（无包=第4败不出现）；每日1次/券态/新手隐走统一三态。
    if (this.consolationAdBtn) {
      if (!c.pack || c.doubled) {
        this.consolationAdBtn.active = false;
      } else {
        this.applyAdButton(this.consolationAdBtn, this.consolationAdLabel, DEFEAT_CONSOLATION_DOUBLE_AD_POINT, '📺 安慰双倍');
      }
    }
  }

  /** 主线战败时捕获安慰包（sortie 战败路径调·persist 前）：每日≤3 次白送直接入账、当日首败附 1 普通信标；第4败起零包只给鼓励文案。
   *  仅主线（悬赏/回廊/推演各有零惩罚机制·不走本路径）；强引导期不给（新手期全隐 + 教程零白送经济）。 */
  private captureDefeatConsolation(won: boolean): void {
    this.pendingConsolation = null;
    if (won || !this.playerState || this.isStrongGuideActive()) return;
    const c = adDailyTryConsume(this.playerState.adDaily, CONSOLATION_PACK_COUNTER_KEY, CONSOLATION_PACK_DAILY_LIMIT, Date.now());
    if (!c.ok) { this.pendingConsolation = { pack: null, doubled: false }; return; }
    const pack = defeatConsolationPack(c.usedToday);
    if (!pack) { this.pendingConsolation = { pack: null, doubled: false }; return; } // 防御（tryConsume ok 时不应发生）
    this.creditGains(pack); // 白送直接入账（与广告无关）
    this.pendingConsolation = { pack, doubled: false };
  }

  /** 「📺 安慰双倍」(S13 #9)：看完把本次基础包再补一份（=×2）·就地"+X→+2X"回执。每日1次/券态/失败退券走统一广告流。 */
  private onConsolationDouble(): void {
    const c = this.pendingConsolation;
    if (!c || !c.pack || c.doubled) return;
    this.runAdPoint(DEFEAT_CONSOLATION_DOUBLE_AD_POINT,
      () => {
        const cur = this.pendingConsolation;
        if (!cur || !cur.pack || cur.doubled) return;
        this.creditGains(cur.pack); // 基础已入账一份 → 再补一份 = 合计×2
        cur.doubled = true;
        this.sound.playSfx('reward_claim');
        this.persist();
        this.refresh();
        if (this.consolationTextLabel && cur.pack) {
          const parts = Object.keys(cur.pack).filter((k) => (cur.pack![k] ?? 0) > 0)
            .map((k) => `${this.zhRes(k)} +${cur.pack![k]}→+${cur.pack![k] * 2}`);
          this.consolationTextLabel.string = `🎁 安慰双倍✓：${parts.join('，')}`;
        }
        if (this.consolationAdBtn) this.consolationAdBtn.active = false;
      },
      (reason) => {
        this.refreshConsolationStrip(false, false); // 券态可能已退回·刷键（仅主线战败语境可达·调用安全）
        // 反馈写进小块本体（hubToast 在结算弹窗底下看不见——块2 悬赏失败提示同款教训）。
        if (this.consolationTextLabel) this.consolationTextLabel.string += `\n（${reason === 'ad_failed' ? '广告没看完，未双倍' : '广告加载失败'}）`;
      });
  }

  /** 收起就地战斗画面 + 结果窗（玩家选完才切场景）：复位备战 UI、隐藏备战面板、回主界面状态。 */
  private dismissBattleScene(): void {
    this.sound.playBgm('bgm_hub');
    this.pendingLevelReward = null; // ③终稿·防御：离开结算即清三选一上下文（正常路径已由终局键/教程直通清空）
    this.pendingGrandAction = null; // 一窗两点·防御：特写待续动作不跨场泄漏
    this.pendingConsolation = null; // 块5：安慰包上下文只活本场结算
    if (this.consolationStripNode) this.consolationStripNode.active = false;
    if (this.levelRewardNode) this.levelRewardNode.active = false;
    if (this.grandRewardNode) this.grandRewardNode.active = false;
    if (this.resultPopupNode) this.resultPopupNode.active = false;
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = false;
    if (this.prebattleUiNode) this.prebattleUiNode.active = true; // 复位（下次进备战正常显示）
    if (this.fxLayer) { this.fxLayer.stopAndClear(); this.fxLayer.node.active = false; } // 演出层收场（下次开播重建舞台）
    this.fxActive = false;
    if (this.prebattleNode) this.prebattleNode.active = false;
    if (this.pendingResult) this.setResult(this.pendingResult.text, this.pendingResult.color);
    this.refresh();
    // 趣事触发不放这里：本函数也被悬赏/回廊/推演"单键返回"链路调用（落点是大厅/塔页非 hub）——触发点在 onResultGoHome 主线分支。
  }
  /** 结果窗·返回：悬赏战斗 → 单键回悬赏板（有遇袭先接遭遇战）；主线 → 收战斗画面回基地。 */
  private onResultGoHome(): void {
    if (this.bountyActiveCardId !== null) { this.onBountyResultReturn(); return; }
    if (this.corridorActiveLayer !== null) { this.onCorridorResultReturn(); return; } // 块3：单键回塔
    if (this.puzzleActiveId !== null) { this.onPuzzleResultReturn(); return; } // 块4：单键回推演页
    this.dismissBattleScene();
    this.maybeShowAnecdote(); // 块5 星港趣事：主线战斗返回=真正"进 hub"（悬赏/回廊/推演返回落点是大厅/塔页·不触发）
  }
  /** 结果窗·下一关/再次挑战：收战斗画面 → 去当前节点战前备战（胜后当前已推进=下一关；败后当前不变=重打）。 */
  private onResultGoPrebattle(): void {
    // 块2遇袭风险抉择：悬赏结算窗右键=「⚔ 正面迎战」（仅遇袭时该键可见）。
    if (this.bountyActiveCardId !== null) { this.onBountyAmbushFight(); return; }
    this.dismissBattleScene();
    this.openPrebattle();
  }
  /** 结果窗·选择关卡：收战斗画面 → 进战前备战 → 弹选关浮层。 */
  private onResultGoLevelSelect(): void {
    this.dismissBattleScene();
    this.openPrebattle();
    this.openLevelSelect();
  }

  /** 选择关卡浮层（graybox 跳关工具）：列有遭遇的可玩节点，点了把进度设到该关→回备战界面。
   *  ⚠️ 这是 graybox 测试用跳关（设该节点为当前进度·前面记为已通）；正式主线关卡选择/地图(§8)是独立块、后面做。 */
  private buildLevelSelectPanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const panel = new Node('S7LevelSelect');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(10, 14, 26, 250);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 满屏浮层：吞触摸·不点空白关(用「关闭」键)
    panel.active = false;
    this.levelSelectNode = panel;

    const mkL = (t: string, s: number, c: Color, x: number, y: number): void => {
      const n = new Node('lsl'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const l = n.addComponent(Label); l.fontSize = s; l.lineHeight = Math.round(s * 1.3); l.color = c; l.string = t;
    };
    const mkB = (t: string, w: number, h: number, c: Color, x: number, y: number, tap: () => void, host?: Node): void => {
      const n = new Node('lsb'); n.layer = this.node.layer; (host ?? panel).addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = c; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 32; l.lineHeight = 40; l.color = new Color(255, 255, 255); l.string = t;
      n.on(Node.EventType.TOUCH_END, () => { if (this.scrollDragging) return; tap(); }, this); // 滚动松手不误点
    };
    // 节点按钮滚动容器（07-15 反馈③：150 关列表超一屏必须能滑）
    const lsContent = new Node('lsContent'); lsContent.layer = this.node.layer; panel.addChild(lsContent); lsContent.setPosition(0, 0, 0);

    mkL('选择关卡（灰盒跳关·点了去打那一关）', 34, new Color(255, 230, 120), 0, band.usableTopY - 50);
    // 节点按钮：每行 3 个，居中铺开。
    const perRow = 3;
    const bw = W * 0.28;
    const bh = 86;
    const gx = W * 0.31;
    const gy = 112;
    const top = band.usableTopY - 160;
    this.encounterNodeIds.forEach((nodeId, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const x = (c - (perRow - 1) / 2) * gx;
      const y = top - r * gy;
      mkB(nodeId, bw, bh, new Color(60, 110, 170, 255), x, y, () => this.onPickLevel(nodeId), lsContent);
    });
    // 滚动上限：最低一行抬到「返回」键上方可见（内容不满一屏=0 不滚）
    const lsRows = Math.ceil(this.encounterNodeIds.length / perRow);
    const lsLowest = top - (lsRows - 1) * gy;
    const lsMax = Math.max(0, (band.usableBottomY + 150) - lsLowest);
    this.attachVScroll(panel, lsContent, () => lsMax);
    mkB('返回', 200, 64, new Color(120, 90, 160, 255), 0, band.usableBottomY + 50, () => this.closeLevelSelect()); // #16：子浮层退路统一叫「返回」（钉在面板·不随列表滚）
  }

  // ===== M0 新手引导 UI 壳（通用·M1-M3 复用，本层不含具体步骤内容） =====

  /** 搭强引导遮罩（默认隐藏）：满屏吞触摸（锁定其他操作）+ 目标高光描边框 + 引导文字 + 「下一步」按钮。 */
  private buildTutorialOverlay(W: number, H: number): void {
    const panel = new Node('S7TutorialOverlay');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform);
    ut.setContentSize(W, H);
    const dim = panel.addComponent(Graphics);
    this.tutorialDimGfx = dim; // 暗化层(挖洞)：实际暗块由 drawTutorialDim 按目标重画
    dim.fillColor = new Color(0, 0, 0, 120);
    dim.rect(-W / 2, -H / 2, W, H);
    dim.fill();
    // 吞触摸（锁定其他操作）；点中高亮目标/纯讲解步点任意处 → 推进（见 onTutorialOverlayTap）。
    panel.on(Node.EventType.TOUCH_END, (e: EventTouch) => this.onTutorialOverlayTap(e), this);

    const highlightNode = new Node('highlight');
    highlightNode.layer = this.node.layer;
    panel.addChild(highlightNode);
    const highlightGfx = highlightNode.addComponent(Graphics);

    const textNode = new Node('text');
    textNode.layer = this.node.layer;
    panel.addChild(textNode);
    textNode.setPosition(0, -H * 0.32, 0);
    const textLabel = textNode.addComponent(Label);
    textLabel.fontSize = 32;
    textLabel.lineHeight = 42;
    textLabel.color = new Color(255, 255, 255);
    const textUt = textNode.addComponent(UITransform);
    textUt.setContentSize(W * 0.82, 200);
    textLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
    textLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

    const btnW = 220, btnH = 70;
    const btnNode = new Node('nextBtn');
    btnNode.layer = this.node.layer;
    panel.addChild(btnNode);
    btnNode.setPosition(0, -H * 0.42, 0);
    const btnUt = btnNode.addComponent(UITransform);
    btnUt.setContentSize(btnW, btnH);
    const btnBg = btnNode.addComponent(Graphics);
    btnBg.fillColor = new Color(80, 160, 230, 255);
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btnBg.fill();
    const btnTextNode = new Node('t');
    btnTextNode.layer = this.node.layer;
    btnNode.addChild(btnTextNode);
    const btnLabel = btnTextNode.addComponent(Label);
    btnLabel.fontSize = 32;
    btnLabel.lineHeight = 40;
    btnLabel.color = new Color(255, 255, 255);
    btnLabel.string = '下一步';
    btnNode.on(Node.EventType.TOUCH_END, () => this.tutorialNextHandler?.(), this);

    panel.active = false;
    this.tutorialOverlayNode = panel;
    this.tutorialHighlightGfx = highlightGfx;
    this.tutorialTextLabel = textLabel;
    this.tutorialNextLabel = btnLabel;
  }

  /**
   * 展示强引导一步：高光描边框跟着 target 的世界坐标包围盒（target 为 null 则不画高光，仅文字+遮罩）；
   * text 为引导文案；onNext 为点「下一步」的回调（通常调 advanceStrongGuideStep 再决定下一步展示什么）。
   */
  private showTutorialStep(text: string, target: Node | null, onNext: () => void, _nextLabel = '', holeTarget?: Node | null): void {
    if (!this.tutorialOverlayNode || !this.tutorialTextLabel) return;
    this.hideTutorialHint(); // 与非阻塞提示条互斥
    // 锁死全屏：只有点中高亮目标(target)才推进；target=null=纯讲解步=点任意处继续。无「下一步」按钮。
    this.tutorialInfoMode = !target;
    this.tutorialNextHandler = onNext;
    this.tutorialFlashTarget = target; // 闪烁高亮由 tickTutorialFlash 每帧画在 tutorialHighlightGfx 上
    // 挖洞范围默认=target；目标是"弹窗内的小按钮"时传 holeTarget=整张弹窗卡片，避免卡片自身文字被压暗看着像空的。
    this.tutorialDimHoleTarget = holeTarget !== undefined ? holeTarget : target;
    this.tutorialTextLabel.string = target ? text : `${text}\n\n（点任意处继续）`;
    if (this.tutorialNextLabel?.node.parent) this.tutorialNextLabel.node.parent.active = false; // 永远藏「下一步」按钮
    if (this.tutorialHighlightGfx) this.tutorialHighlightGfx.clear();
    this.drawTutorialDim(this.tutorialDimHoleTarget); // 暗化层挖洞：目标处正常亮、其余压暗（讲解步=全屏暗）
    // 置顶：结果弹窗/单位管理/三选一发奖会 setSiblingIndex 抢前，遮罩须再抬上去才能盖住+吞触摸。
    const parent = this.tutorialOverlayNode.parent;
    if (parent) this.tutorialOverlayNode.setSiblingIndex(parent.children.length - 1);
    this.tutorialOverlayNode.active = true;
    this.raiseTutorialDevBar();
  }

  /** 重画暗化层：有目标→目标包围盒处挖洞(不压暗·正常亮)、其余四块压暗；无目标(讲解步)→全屏压暗。 */
  private drawTutorialDim(target: Node | null): void {
    const gfx = this.tutorialDimGfx;
    const overlayUt = this.tutorialOverlayNode?.getComponent(UITransform);
    if (!gfx || !overlayUt) return;
    const W = this.viewW, H = this.viewH;
    gfx.clear();
    gfx.fillColor = new Color(0, 0, 0, 120);
    const ut = target?.getComponent(UITransform);
    if (!target || !ut) { gfx.rect(-W / 2, -H / 2, W, H); gfx.fill(); return; } // 讲解步=全屏暗
    const c = overlayUt.convertToNodeSpaceAR(target.getWorldPosition());
    const pad = 12;
    const hw = ut.contentSize.width * target.scale.x / 2 + pad;
    const hh = ut.contentSize.height * target.scale.y / 2 + pad;
    const L = c.x - hw, R = c.x + hw, B = c.y - hh, T = c.y + hh;
    const rect = (x: number, y: number, w: number, h: number): void => { if (w > 0 && h > 0) { gfx.rect(x, y, w, h); gfx.fill(); } };
    rect(-W / 2, T, W, H / 2 - T);          // 洞上方
    rect(-W / 2, -H / 2, W, B + H / 2);     // 洞下方
    rect(-W / 2, B, L + W / 2, T - B);      // 洞左侧
    rect(R, B, W / 2 - R, T - B);           // 洞右侧
  }

  /** 锁死遮罩被点：纯讲解步点任意处继续；动作步只有点中高亮目标包围盒才推进(点别处无反应)。 */
  private onTutorialOverlayTap(e: EventTouch): void {
    if (!this.tutorialOverlayNode?.active) return;
    if (this.tutorialInfoMode) { this.tutorialNextHandler?.(); return; }
    const target = this.tutorialFlashTarget;
    const ut = target?.getComponent(UITransform);
    const overlayUt = this.tutorialOverlayNode.getComponent(UITransform);
    if (!target || !ut || !overlayUt) return;
    const loc = e.getUILocation();
    const tx = loc.x - this.viewW / 2;  // 屏幕UI坐标→以屏幕中心为原点(=遮罩本地坐标·与高光同空间)
    const ty = loc.y - this.viewH / 2;
    const tl = overlayUt.convertToNodeSpaceAR(target.getWorldPosition());
    const w = ut.contentSize.width * target.scale.x;
    const h = ut.contentSize.height * target.scale.y;
    const pad = 16;
    if (Math.abs(tx - tl.x) <= w / 2 + pad && Math.abs(ty - tl.y) <= h / 2 + pad) {
      this.tutorialNextHandler?.(); // 点中高亮目标→推进
    }
  }

  /** 收起强引导遮罩（强引导全部完成时调用）。 */
  private hideTutorialStep(): void {
    if (this.tutorialOverlayNode) this.tutorialOverlayNode.active = false;
    if (this.tutorialHighlightGfx) this.tutorialHighlightGfx.clear();
    this.tutorialNextHandler = null;
    this.tutorialInfoMode = false;
    this.tutorialFlashTarget = null;
    this.tutorialDimHoleTarget = null;
    this.hideTutorialDragLock();
  }

  // ===== M1a/M1b 强引导步骤调度器（关1 解锁建筑&升级 → 关2 技能演示&插件装配）=====

  /** 强引导是否进行中（新手没走完=锁操作引导态）。 */
  private isStrongGuideActive(): boolean {
    return !!this.playerState && !this.playerState.tutorial.strongGuideDone;
  }

  // ===== 块5 · 广告点位统一收口（S13 决策①②③④：每日1次/用尽即隐/广告券/新手期全隐）=====

  /** 某点位按钮此刻的三态（所有广告按钮显隐一律走这里，禁止各界面自写判断）。 */
  private adButtonState(point: S7AdPoint): S7AdButtonState {
    if (!this.playerState || !this.session) return { kind: 'hidden' };
    const used = adDailyUsed(this.playerState.adDaily, point, Date.now());
    const tickets = adTicketCount(this.session.resources as Record<string, number>);
    return s7AdButtonState(point, used, tickets, this.isStrongGuideActive());
  }

  /** 三态按钮通用应用：hidden→节点隐藏；available→基础文案；ticket→基础文案+「广告券×N」（长文案自动缩进按钮内·B0.6 #2）。
   *  复验批：文本没变不重设——Label.string 触发整段重排版+SHRINK 多趟测量，本方法挂在 hub/打捞/抽卡/商人等高频 refresh 链上，守卫掉就是省下的点击延迟。 */
  private applyAdButton(node: Node | null, label: Label | null, point: S7AdPoint, baseText: string): S7AdButtonState {
    const st = this.adButtonState(point);
    if (node) node.active = st.kind !== 'hidden';
    if (label) {
      const s = st.kind === 'ticket' ? adTicketButtonLabel(baseText, st.tickets) : baseText;
      if (label.string !== s) {
        label.string = s;
        this.clampBtnLabel(label);
      }
    }
    return st;
  }

  /** 取/补 Label 所在节点的 UITransform（B0.6 #2 容器框通用小工具·防重复 addComponent）。 */
  private labelBox(label: Label): UITransform {
    let ut = label.node.getComponent(UITransform);
    if (!ut) ut = label.node.addComponent(UITransform);
    return ut;
  }

  /** 按钮文案锚进按钮内框（B0.6 #2 文本永在容器内）：券态附加「广告券×N」会变长——超长自动缩字号、禁溢出。 */
  private clampBtnLabel(label: Label): void {
    const btn = label.node.parent?.getComponent(UITransform);
    if (!btn) return;
    let lt = label.node.getComponent(UITransform);
    if (!lt) lt = label.node.addComponent(UITransform);
    lt.setContentSize(btn.width - 14, btn.height - 8);
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = false;
  }

  /**
   * 统一广告点位流（消耗时序·决策③）：
   *   券态=先扣 1 张（仅内存·成功才落盘）→ 播广告 → ok：记数+发奖(onGranted 内自行 persist)；失败/被关：退回该张券。
   *   常态=播广告 → ok：走每日计数（极端跨天竞态失败给 quota_gone）→ 发奖。
   * onGranted 负责发奖+persist+refresh；onFail(reason) 负责就地提示（reason：ad_failed 没看完 / ad_error 加载失败 / quota_gone 次数没了）。
   */
  private runAdPoint(point: S7AdPoint, onGranted: () => void, onFail: (reason: 'ad_failed' | 'ad_error' | 'quota_gone') => void): void {
    if (!this.adGateway || !this.playerState || !this.session) return;
    const st = this.adButtonState(point);
    if (st.kind === 'hidden') return; // 按钮本不该出现（防御·如异步期间跨态）
    const wallet = this.session.resources as Record<string, number>;
    const viaTicket = st.kind === 'ticket';
    if (viaTicket && !consumeAdTicket(wallet)) return; // 竞态防御：券刚好花光
    this.adGateway.show(point).then((res) => {
      if (!this.playerState || !this.session) return;
      if (!res.ok) {
        if (viaTicket) { refundAdTicket(wallet); this.refresh(); } // 失败退券（未落盘的内存扣减就地还原）
        onFail('ad_failed');
        return;
      }
      if (viaTicket) {
        adDailyRecord(this.playerState.adDaily, point, Date.now()); // 券路径也记账（补给箱重开序号/遥测）
      } else {
        const limit = S7_AD_POINT_DAILY_LIMITS[point];
        if (limit === null) {
          adDailyRecord(this.playerState.adDaily, point, Date.now()); // 不限次点位：纯记数
        } else {
          const c = adDailyTryConsume(this.playerState.adDaily, point, limit, Date.now());
          if (!c.ok) { onFail('quota_gone'); return; } // 极端竞态（异步期间跨界）：不发奖
        }
      }
      onGranted();
    }).catch(() => {
      if (viaTicket) { refundAdTicket(wallet); this.refresh(); }
      onFail('ad_error');
    });
  }

  /**
   * 冷启动恢复归一：从存档某步重进时，把每关「战斗/三选一/结果弹窗/揭晓」这段临时弹窗态归一到该关后的"星港步"。
   * 因为关卡战斗已结算入档(进度已前移)，这些弹窗无法忠实复现 → 直接续到回星港那步；
   * 若停在三选一那步(强制奖励还没入账)→ 先补发该关强制奖励。只在 init 调一次。
   *   关1：step2(三选一)/3(结果弹窗) → step4；step2 补发星矿。
   *   关2：step12(三选一)/13(揭晓) → step14；step12 补发武器插件。
   */
  private normalizeTutorialResumeStep(): void {
    if (!this.isStrongGuideActive() || !this.playerState) return;
    const t = this.playerState.tutorial;
    switch (t.strongGuideStep) {
      case 2: this.grantTutorialLevel1StarOre(); t.strongGuideStep = 4; this.persist(); break;
      case 3: t.strongGuideStep = 4; this.persist(); break;
      case 12: this.grantTutorialLevel2Plugin(); t.strongGuideStep = 14; this.persist(); break;
      case 13: t.strongGuideStep = 14; this.persist(); break;
      case 21: this.grantTutorialLevel3Tickets(); t.strongGuideStep = 23; this.persist(); break;
      case 22: t.strongGuideStep = 23; this.persist(); break;
      case 34: this.grantTutorialLevel4Beacon(); t.strongGuideStep = 36; this.persist(); break;
      case 35: t.strongGuideStep = 36; this.persist(); break;
      case 40: t.strongGuideStep = 42; this.persist(); break; // 关5三选一不强制(毕业自选)·冷启动丢了就跳过、不补发
      case 41: t.strongGuideStep = 42; this.persist(); break;
      default: break;
    }
  }

  /** 补发关1三选一强制的星矿（冷启动恢复用·与三选一选星矿同量；幂等性由调用点 step 把关）。 */
  private grantTutorialLevel1StarOre(): void {
    const res = this.session?.resources as Record<string, number> | undefined;
    if (res && res.starOre !== undefined) res.starOre += S7_TUTORIAL_LEVEL1_STARORE;
  }

  /** 补发关2三选一强制的武器插件（冷启动恢复用·与三选一选的同一具体插件；幂等性由调用点 step 把关）。 */
  private grantTutorialLevel2Plugin(): void {
    if (!this.pluginInventory) return;
    const p = S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN;
    addOwnedPlugin(this.pluginInventory, p.pluginId, p.quality);
  }

  /** 补发关3三选一强制的补给券（冷启动恢复用；幂等性由调用点 step 把关）。 */
  private grantTutorialLevel3Tickets(): void {
    const res = this.session?.resources as Record<string, number> | undefined;
    if (res && res.supplyTicket !== undefined) res.supplyTicket += S7_TUTORIAL_LEVEL3_TICKETS;
  }

  /** 补发关4三选一强制的普通信标（冷启动恢复用；幂等性由调用点 step 把关）。 */
  private grantTutorialLevel4Beacon(): void {
    const res = this.session?.resources as Record<string, number> | undefined;
    if (res && res.beaconCommon !== undefined) res.beaconCommon += 1;
  }

  /** M1c：抽卡强制招募一个单位到拥有（已拥有跳过·幂等）+ 消耗1张补给券（若有）。 */
  private grantTutorialGachaUnit(kind: 'ship' | 'pilot', id: string): void {
    if (!this.squad) return;
    if (kind === 'ship') grantShip(this.squad, id); else grantPilot(this.squad, id);
    const res = this.playerState?.resources as Record<string, number> | undefined;
    if (res && (res.supplyTicket ?? 0) >= 1) res.supplyTicket -= 1; // 用券招募（够2张·三选一发的）
  }

  /**
   * 按 tutorial.strongGuideStep 展示当前该高光哪个按钮/弹哪句引导。
   * 每步「下一步」回调：先 advanceStrongGuideStep 递增、做该步副作用(出战/解锁/升级…)、落盘、再回头调本方法展示下一步。
   * 每个 case 自带「确保上下文」(冷启动从存档某步恢复也续得上)。步序见各 case 内联注释：
   *   0-10 = M1a(关1+解锁建筑&升级)；11-13 = M1b-1 关2(出战→武器插件三选一→揭晓)；
   *   14-17 = M1b-2(回船坞→装配→装插件&槽位教学)；18-19 = M1b-3(活动短教程→引导出战关3)；
   *   20-25 = M1c-1 关3(出战→补给券三选一→返回→激活补给站→驾驶员/星舰池各抽1得新队)；
   *   26 = M1c-2(引导出战关4·不白送资源·新单位留玩家自然攒够再练)；27-28 = 废弃(原升级演示·老档兼容跳到29)；
   *   29-31 = M2-1 关4备战(交互式：上阵新舰→铁律→装配驾驶员·玩家真操作)；
   *   32-33 = M2-2(交互式摆阵·玩家真拖老舰到后排→出战关4)；
   *   34-38 = M2-3(信标三选一→返回→解锁打捞港→交互式打捞→收尾)；
   *   39-43 = M3-1a 关5(出战→三选一毕业自选[不强制·星贝是必得不进池]→返回→解锁商人→交互式买补给券)；
   *   44-46 = M3-1b(抽卡得克制驾驶员→交互式装到旗舰→强引导结束 completeStrongGuide)；≥47 = 强引导已结束。
   *   升阶/升星/星核/离线/居住舱 = 弱引导首触(玩家自然触发时弹·不在强引导链)。
   */
  private runTutorialStep(): void {
    if (!this.isStrongGuideActive() || !this.playerState) return;
    const t = this.playerState.tutorial;
    const ship = S7_TUTORIAL_STARTER.shipId;
    const pilot = S7_TUTORIAL_STARTER.pilotId;
    // 引导文字一律用实际配置名（与界面一致·内容无关：换内容不用改代码）。
    const shipName = this.unitName('ship', ship);
    const pilotName = this.unitName('pilot', pilot);
    switch (t.strongGuideStep) {
      case 0:
        this.showTutorialInfo(
          '指挥官，欢迎接手这座破败的小星港。\n这片星域又乱又热闹——星盗、失控无人舰、废铁机械、星能污染舰横行。\n你的使命：收集星舰、组建小队、打败敌人，把小破港养成热闹大星港！',
          () => { advanceStrongGuideStep(t); this.persist(); this.openPrebattle(); this.runTutorialStep(); },
        );
        break;
      case 1:
        this.openPrebattle();
        this.showTutorialStep(
          `这是备战界面。点闪烁高亮的「开始战斗」，看你的${shipName}自动迎敌（这一关它只会普攻）。`,
          this.prebattleSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onConfirmSortie(); },
        );
        break;
      case 2:
        // 三选一由 openLevelReward 触发(战斗结束、卡建好才弹)；这里仅冷启动/防御，正常已被 normalize 归一到 step4。
        if (this.pendingLevelReward && this.levelRewardNode?.active) this.showTutorialForcedChoice();
        break;
      case 3:
        this.showTutorialStep(
          '打赢了！奖励到手。\n点闪烁高亮的「返回星港」回到星港，去解锁建筑。',
          this.resultHomeBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onResultGoHome(); this.runTutorialStep(); },
        );
        break;
      case 4:
        this.showTutorialStep(
          '星港百废待兴——点闪烁高亮的「船坞」（造船养船的地方）。',
          this.hubDockEntryNode,
          () => { // 点船坞→弹解锁确认框→高亮「确认」
            this.openBuildingUnlockDialog('bld_dock', '船坞');
            this.showTutorialStep('花星矿解锁船坞——点闪烁高亮的「确认」。', this.buildingUnlockConfirmBtn,
              () => { advanceStrongGuideStep(t); this.onConfirmBuildingUnlock(); this.persist(); this.runTutorialStep(); });
          },
        );
        break;
      case 5:
        // 船坞已由 case4 确认解锁时自动打开(真实功能行为)；这里不再代劝直接跳管理面板，要玩家自己点「管理」。
        this.showTutorialStep(
          `进船坞了。点闪烁高亮的「管理」，管理${shipName}。`,
          this.manageRowBtn('ship', ship),
          () => {
            this.openUnitManage('ship', ship); // 点「管理」→真实动作(遮罩吞触摸·手动复刻)
            this.showTutorialStep(
              `这是${shipName}的管理面板。点闪烁高亮的「升级」，把它升一级（花星舰合金、直接变强）。`,
              this.unitManageUpgradeBtn,
              () => { advanceStrongGuideStep(t); this.onUpgradeUnit('ship', ship); this.persist(); this.runTutorialStep(); },
            );
          },
        );
        break;
      case 6:
        this.showTutorialInfo(
          `升到 Lv1，${shipName}解锁了它的星舰技能！\n（星舰升到一定等级会解锁专属技能，战斗中自动释放。）`,
          () => {
            this.showTutorialStep(
              '点闪烁高亮的「返回」，退出管理面板。',
              this.unitManageBackBtn,
              () => {
                if (this.unitManageNode) this.unitManageNode.active = false; // 点「返回」→真实动作(遮罩吞触摸·手动复刻)
                this.showTutorialStep(
                  '点闪烁高亮的「返回星港」，回到星港。',
                  this.dockBackBtn,
                  () => {
                    advanceStrongGuideStep(t);
                    if (this.dockNode) this.dockNode.active = false;
                    this.refresh();
                    this.persist();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      case 7:
        this.closeUnitPanelsToHub(); // 确保上下文(冷启动可续)
        this.showTutorialStep(
          '光有船不够，还得练驾驶员。\n点闪烁高亮的「训练舱」。',
          this.hubTrainingEntryNode,
          () => {
            this.openBuildingUnlockDialog('bld_pilot_training_bay', '训练舱');
            this.showTutorialStep('花星矿解锁训练舱——点闪烁高亮的「确认」。', this.buildingUnlockConfirmBtn,
              () => { advanceStrongGuideStep(t); this.onConfirmBuildingUnlock(); this.persist(); this.runTutorialStep(); });
          },
        );
        break;
      case 8:
        this.showTutorialStep(
          `进训练舱了。点闪烁高亮的「管理」，管理驾驶员「${pilotName}」。`,
          this.manageRowBtn('pilot', pilot),
          () => {
            this.openUnitManage('pilot', pilot); // 点「管理」→真实动作(遮罩吞触摸·手动复刻)
            this.showTutorialStep(
              `这是驾驶员「${pilotName}」的管理面板。点闪烁高亮的「升级」，把TA升一级。`,
              this.unitManageUpgradeBtn,
              () => { advanceStrongGuideStep(t); this.onUpgradeUnit('pilot', pilot); this.persist(); this.runTutorialStep(); },
            );
          },
        );
        break;
      case 9:
        this.showTutorialInfo(
          `${pilotName}升到 Lv1，解锁了驾驶能力！\n（驾驶员能力会改变星舰的战斗行为——让它在战斗里更聪明地选目标。）`,
          () => {
            this.showTutorialStep(
              '点闪烁高亮的「返回」，退出管理面板。',
              this.unitManageBackBtn,
              () => {
                if (this.unitManageNode) this.unitManageNode.active = false; // 点「返回」→真实动作(遮罩吞触摸·手动复刻)
                this.showTutorialStep(
                  '点闪烁高亮的「返回星港」，回到星港。',
                  this.trainingBackBtn,
                  () => {
                    advanceStrongGuideStep(t);
                    if (this.trainingNode) this.trainingNode.active = false;
                    this.refresh();
                    this.persist();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      case 10:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '船和驾驶员都练好了，去挑战第 2 关！\n点闪烁高亮的「出战」。',
          this.hubSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.openPrebattle(); this.runTutorialStep(); },
        );
        break;
      // ===== M1b 关2：技能演示（文字介绍）+ 插件三选一（变更#4）=====
      case 11:
        this.openPrebattle();
        this.showTutorialStep(
          `第 2 关，敌人更多了。\n现在${shipName}升了级、${pilotName}也会驾驶了——点「开始战斗」看看比上关轻松多少。`,
          this.prebattleSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onConfirmSortie(); },
        );
        break;
      case 12:
        // 正常流程由 openLevelReward 触发本步遮罩；冷启动已被 normalize 归一到 step14，不会落这。
        if (this.pendingLevelReward) this.showTutorialForcedChoice();
        break;
      case 13:
        this.showTutorialStep(
          `恭喜获得 ${this.pluginName(S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN.pluginId)}（武器槽·精良）！\n这是把武器插件，装上能强化${shipName}的输出。\n点闪烁高亮的「返回星港」，下一步去船坞把它装到${shipName}身上。`,
          this.resultHomeBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onResultGoHome(); this.runTutorialStep(); },
        );
        break;
      // ===== M1b-2 关2后：插件装配 + 槽位教学 =====
      case 14:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          `回到星港了。进「船坞」给${shipName}装上刚拿到的武器插件。`,
          this.hubDockEntryNode,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.openDock(); this.runTutorialStep(); },
        );
        break;
      case 15:
        this.openDock(); // 确保上下文(冷启动可续)
        this.showTutorialStep(
          `点闪烁高亮的「管理」，管理${shipName}。`,
          this.manageRowBtn('ship', ship),
          () => {
            this.openUnitManage('ship', ship); // 点「管理」→真实动作(遮罩吞触摸·手动复刻)
            this.showTutorialStep(
              `点「装配」打开${shipName}的装备界面。`,
              this.unitManageEquipBtn,
              () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.openLoadoutForTutorial(ship); this.runTutorialStep(); },
            );
          },
        );
        break;
      case 16: {
        this.openLoadoutForTutorial(ship);
        const pluginRef = this.tutorialWeaponPluginRef();
        const pName = this.pluginName(S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN.pluginId);
        this.showTutorialStep(
          `这是装配界面。${shipName}现在是 C 阶，只有 1 个插件槽能用；\n升到 B 阶开第 2 个槽（技能槽）、A 阶开第 3 个（战术槽）。\n在列表里点「${pName}」。`,
          pluginRef ? this.loadoutItemBtns.get(`plugin:${pluginRef.id}`) ?? null : null,
          () => {
            if (pluginRef) this.openEquipDetail(pluginRef);
            // 用 hint 而非 overlay：overlay 虽做全屏透明洞但某些设备仍遮挡弹窗；hint 收起 overlay 让弹窗完整可见
            this.showTutorialHint(
              '点闪烁高亮的「装备」，把它装进唯一的槽里。',
              () => {
                const ids = this.squad?.shipLoadouts[S7_TUTORIAL_STARTER.shipId]?.pluginInstanceIds ?? [];
                return pluginRef ? ids.includes(pluginRef.id) : false;
              },
              this.equipDetailActionBtn,
            );
          },
        );
        break;
      }
      case 17:
        this.openLoadoutForTutorial(ship); // 确保上下文(冷启动可续)
        this.showTutorialStep(
          `装好了！武器插件已上，${shipName}战力提升。\n（以后任意装备都在这里装/卸；升阶开更多槽。）\n点闪烁高亮的「返回」，退出装配界面。`,
          this.loadoutBackBtn,
          () => {
            this.closeLoadout(); // 点「返回」→真实动作(遮罩吞触摸·手动复刻)
            this.showTutorialStep(
              '点闪烁高亮的「返回」，退出管理面板。',
              this.unitManageBackBtn,
              () => {
                if (this.unitManageNode) this.unitManageNode.active = false;
                this.showTutorialStep(
                  '点闪烁高亮的「返回星港」，回到星港。',
                  this.dockBackBtn,
                  () => {
                    advanceStrongGuideStep(t);
                    if (this.dockNode) this.dockNode.active = false;
                    this.refresh();
                    this.persist();
                    this.hideTutorialStep();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      // ===== M1b-3 关2后续：活动短教程（弱引导）+ 引导出战关3 =====
      case 18:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '回基地了。先认识两个限时活动——点闪烁高亮的「3天行动」入口看一眼。\n（这俩边玩边自动攒进度、不强求现在做，看完就走。）',
          this.hubActivityEntryNode,
          () => {
            advanceStrongGuideStep(t); // →19
            this.persist();
            this.hideTutorialStep();
            this.openActivity('action3'); // 触发首触弱弹窗；关弹窗时回调续到 step19
            // 防御：首触已看过(弹窗没弹)→直接续 step19。
            if (!this.tutorialPopupNode?.active) { this.closeActivityToHub(); this.runTutorialStep(); }
          },
        );
        break;
      case 19:
        this.closeActivityToHub();
        this.showTutorialStep(
          '认识完啦！这俩活动平时正常玩就会自动推进度。\n现在去挑战第 3 关——点「出战」。',
          this.hubSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.openPrebattle(); this.runTutorialStep(); },
        );
        break;
      // ===== M1c-1 关3：新敌人 + 抽卡扩编队 =====
      case 20:
        this.openPrebattle();
        this.showTutorialStep(
          '第 3 关来了，敌人里出现了没见过的类型。\n靠你新装的插件顶住——点「开始战斗」。',
          this.prebattleSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onConfirmSortie(); },
        );
        break;
      case 21:
        // 正常流程由 openLevelReward 触发本步遮罩；冷启动已被 normalize 归一到 step23，不会落这。
        if (this.pendingLevelReward) this.showTutorialForcedChoice();
        break;
      case 22:
        this.showTutorialStep(
          '敌人越来越强，光靠一艘船快顶不住了——得赶紧扩充编队。\n点「返回星港」，去补给站招募新成员。',
          this.resultHomeBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onResultGoHome(); this.runTutorialStep(); },
        );
        break;
      case 23:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '「星港补给站」能用补给券招募新星舰和驾驶员。\n点闪烁高亮的「星港补给站」。',
          this.hubGachaEntryNode,
          () => {
            this.openBuildingUnlockDialog('bld_supply_station', '星港补给站');
            this.showTutorialStep('花星矿解锁星港补给站——点闪烁高亮的「确认」。', this.buildingUnlockConfirmBtn,
              () => { advanceStrongGuideStep(t); this.onConfirmBuildingUnlock(); this.persist(); this.runTutorialStep(); });
          },
        );
        break;
      case 24:
        this.openGacha(); this.switchGachaPool('recruit');
        this.showTutorialStep(
          '这是「驾驶员招募池」。点闪烁高亮的「单抽」，招募一名新驾驶员。',
          this.gachaSingleBtn,
          () => {
            advanceStrongGuideStep(t); // →25
            this.grantTutorialGachaUnit('pilot', S7_TUTORIAL_GACHA_PILOT);
            this.persist();
            this.hideTutorialStep();
            const star = this.playerState ? getPilotStar(this.playerState.unitTiers, S7_TUTORIAL_GACHA_PILOT) : 1;
            this.showTutorialStep(
              `🎉 招募到驾驶员「${this.unitName('pilot', S7_TUTORIAL_GACHA_PILOT)}」（${star}★）！`,
              null,
              () => { this.hideTutorialStep(); this.runTutorialStep(); },
              '继续',
            );
          },
        );
        break;
      case 25: {
        this.openGacha();
        const refitTab = this.gachaTabBtns.find((b) => b.pool === 'refit')?.node ?? null;
        this.showTutorialStep(
          '再切到「星舰招募池」——点闪烁高亮的页签。',
          refitTab,
          () => {
            this.switchGachaPool('refit');
            this.showTutorialStep(
              '点闪烁高亮的「单抽」，招募一艘新星舰。',
              this.gachaSingleBtn,
              () => {
                advanceStrongGuideStep(t); // →26
                this.grantTutorialGachaUnit('ship', S7_TUTORIAL_GACHA_SHIP);
                this.persist();
                this.hideTutorialStep();
                const tier = this.playerState ? shipTierName(getShipTier(this.playerState.unitTiers, S7_TUTORIAL_GACHA_SHIP)) : 'C';
                this.showTutorialStep(
                  `🎉 招募到星舰「${this.unitName('ship', S7_TUTORIAL_GACHA_SHIP)}」（${tier}阶）！\n新成员加入了，下一步去把队伍练强。\n点闪烁高亮的「返回星港」，回到星港。`,
                  this.gachaBackBtn,
                  () => {
                    this.hideTutorialStep();
                    this.closeGacha(); // 点「返回星港」→真实动作(遮罩吞触摸·手动复刻)
                    this.closeUnitPanelsToHub();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      }
      // ===== M1c-2 关3后：引导出战关4（不白送资源·升级新单位留玩家自然攒够再练）=====
      case 26:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '招到新成员了！新单位先放着——平时多打关、慢慢攒够资源，再回来把他们练强。\n现在带新队伍去挑战第 4 关——点「出战」。',
          this.hubSortieBtn,
          () => {
            this.playerState!.tutorial.strongGuideStep = 29; // 跳过原"升级新船演示"(已去白送·见上)，直接进关4备战
            this.persist(); this.hideTutorialStep(); this.openPrebattle(); this.runTutorialStep();
          },
        );
        break;
      case 27:
      case 28:
        // 原 M1c-2"升级新船演示"已按 Ron"不白送"移除；老存档若落这两步→直接续到关4备战。
        this.playerState!.tutorial.strongGuideStep = 29; this.persist(); this.runTutorialStep();
        break;
      // ===== M2-1 关4备战：上阵新舰 + 铁律 + 装配驾驶员（交互式·玩家真操作）=====
      case 29: {
        this.openPrebattle();
        const sName = this.unitName('ship', S7_TUTORIAL_GACHA_SHIP);
        const slotRef = 'p1c2'; // 前排空格(起手船占 p0c2)，新护卫舰直接部署前排
        this.showTutorialStep(
          `把新星舰「${sName}」上阵：点闪烁高亮的空格。`,
          this.prebattleCellNodes.get(slotRef) ?? null,
          () => {
            this.onSelectPrebattleSlot(slotRef);
            this.showTutorialStep(
              `在列表里点「${sName}」选中它。`,
              this.boardingShipRowBtns.get(S7_TUTORIAL_GACHA_SHIP) ?? null,
              () => {
                this.onBoardingPickShip(S7_TUTORIAL_GACHA_SHIP);
                this.showTutorialStep(
                  '点闪烁高亮的「上场」，让它进场。',
                  this.boardingBoardBtn,
                  () => {
                    advanceStrongGuideStep(t);
                    this.onToggleBoard();
                    this.persist();
                    this.hideTutorialStep();
                    this.closeBoarding();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      }
      case 30:
        this.showTutorialStep(
          '上阵成功！但有条铁律：星舰必须配上驾驶员才能上场战斗——\n新星舰现在还缺驾驶员。下一步给它配一个。',
          null,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.runTutorialStep(); },
        );
        break;
      case 31: {
        this.openPrebattle();
        this.prebattleSelShip = S7_TUTORIAL_GACHA_SHIP;
        this.openBoarding();
        const sName = this.unitName('ship', S7_TUTORIAL_GACHA_SHIP);
        const pName = this.unitName('pilot', S7_TUTORIAL_GACHA_PILOT);
        this.showTutorialStep(
          `给「${sName}」配驾驶员：点闪烁高亮的「装配」。\n（装配不必回星港，备战界面就能配；只有升级/升阶才回星港。）`,
          this.boardingEquipBtn,
          () => {
            this.openLoadout();
            this.showTutorialStep(
              `在列表里点驾驶员「${pName}」。`,
              this.loadoutItemBtns.get(`pilot:${S7_TUTORIAL_GACHA_PILOT}`) ?? null,
              () => {
                this.openEquipDetail({ kind: 'pilot', id: S7_TUTORIAL_GACHA_PILOT });
                this.showTutorialHint(
                  '点闪烁高亮的「装备」，把它装上。',
                  () => this.pilotOf(S7_TUTORIAL_GACHA_SHIP) === S7_TUTORIAL_GACHA_PILOT,
                  this.equipDetailActionBtn,
                );
              },
            );
          },
        );
        break;
      }
      // ===== M2-2 关4备战：摆阵换位（留洞锁屏·玩家真拖）+ 出战关4 =====
      case 32: {
        this.closeLoadout();
        this.closeBoarding();
        this.openPrebattle();
        const starterName = this.unitName('ship', S7_TUTORIAL_STARTER.shipId);
        const curSlot = this.squad?.formation.find((f) => f.shipId === S7_TUTORIAL_STARTER.shipId)?.slotRef ?? null;
        const cellNode = curSlot ? this.prebattleCellNodes.get(curSlot) ?? null : null;
        // 开放全九宫格拖拽；「开始战斗」由 onConfirmSortie 拦截：晨星仍在前排则阻止并提示
        this.showTutorialHint(
          `站位有讲究：突击型老舰「${starterName}」站后排输出更好，新护卫舰留前排扛伤。\n把闪烁高亮的「${starterName}」从前排拖到后排（往下那排的格子）——拖对后才能开始战斗。`,
          () => { const c = this.shipSlotCol(S7_TUTORIAL_STARTER.shipId); return c !== null && c < 2; },
          cellNode,
        );
        break;
      }
      case 33:
        this.openPrebattle();
        this.showTutorialStep(
          '站位摆好了！新护卫舰前排扛伤、老舰后排输出。\n点「开始战斗」——这关敌人更多，但靠新阵容应该轻松。',
          this.prebattleSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onConfirmSortie(); },
        );
        break;
      // ===== M2-3 关4后：三选一普通信标 → 解锁打捞港 → 打捞（交互式）=====
      case 34:
        // 正常流程由 openLevelReward 触发本步遮罩；冷启动已被 normalize 归一到 step36，不会落这。
        if (this.pendingLevelReward) this.showTutorialForcedChoice();
        break;
      case 35:
        this.showTutorialStep(
          '拿到普通信标了！信标是打捞用的——打捞能挂机产资源。\n点「返回星港」，去解锁打捞港。',
          this.resultHomeBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onResultGoHome(); this.runTutorialStep(); },
        );
        break;
      case 36:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '「打捞港」能派打捞队挂机产资源（星矿/合金等）。\n点闪烁高亮的「打捞港」。',
          this.hubSalvageEntryNode,
          () => {
            this.openBuildingUnlockDialog('bld_salvage_port', '打捞港');
            this.showTutorialStep('花星矿解锁打捞港——点闪烁高亮的「确认」。', this.buildingUnlockConfirmBtn,
              () => { advanceStrongGuideStep(t); this.onConfirmBuildingUnlock(); this.persist(); this.runTutorialStep(); });
          },
        );
        break;
      case 37: {
        this.openSalvage();
        const tierBtn = this.salvageTierBtns.find((b) => b.tier === 'common')?.node ?? null;
        this.showTutorialStep(
          '点闪烁高亮的「普通」信标档。',
          tierBtn,
          () => {
            this.selectSalvageTier('common');
            const hourBtn = this.salvageHourBtns.find((b) => b.hours === 2)?.node ?? null;
            this.showTutorialStep(
              '点闪烁高亮的「2h」时长。',
              hourBtn,
              () => {
                this.selectSalvageHours(2);
                this.showTutorialStep(
                  '点闪烁高亮的「开始打捞」，用掉刚拿的普通信标。',
                  this.salvageStartBtn,
                  () => {
                    this.onSalvageStart();
                    this.tutorialFinishFirstSalvage(); // 第一次打捞·直接判完成，免去真机不可能等的2h
                    advanceStrongGuideStep(t); // →38
                    this.persist();
                    this.hideTutorialStep();
                    this.runTutorialStep();
                  },
                );
              },
            );
          },
        );
        break;
      }
      case 38: {
        this.refreshSalvage(); // 重建列表→让刚完成的任务出现「收菜」按钮、抓进 salvageCollectBtns
        // 停掉自动刷新 tick：否则每秒 refreshSalvage() 会 removeAllChildren 重建，导致 collectBtn 引用变悬空
        // 悬空节点 getWorldPosition() 返回异常值 → 高亮框出现在错误位置（真机实测 bug）
        if (this.salvageTicking) { this.salvageTicking = false; this.unschedule(this.salvageTick); }
        const mission = this.playerState?.salvage.missions[0];
        const collectBtn = mission ? this.salvageCollectBtns.get(mission.id) ?? null : null;
        this.showTutorialStep(
          '第一次打捞，直接帮你跳过等待——点闪烁高亮的「收菜」领取奖励。',
          collectBtn,
          () => {
            if (mission) this.onSalvageCollect(mission.id);
            advanceStrongGuideStep(t); // →39
            this.persist();
            this.hideTutorialStep();
            this.closeSalvage();
            this.runTutorialStep();
          },
        );
        break;
      }
      // ===== M3-1a 关5 + 商人小站（强引导收尾·关5商人买补给券）=====
      case 39:
        this.closeUnitPanelsToHub();
        this.openPrebattle();
        this.showTutorialStep(
          '第 5 关——敌人的打法越来越刁钻了。\n点「开始战斗」迎战。',
          this.prebattleSortieBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onConfirmSortie(); },
        );
        break;
      case 40:
        // 正常流程由 openLevelReward 触发"毕业自选"提示条；冷启动已被 normalize 归一到 step42，不会落这。
        if (this.pendingLevelReward) this.showTutorialGraduationPick();
        break;
      case 41:
        this.showTutorialStep(
          '打赢了！但你会发现：敌人开始用刁钻打法（比如躲后排、专破前排）。\n应对的办法是「克制」——多备几个驾驶员，换着上去打不同的敌人。\n点「返回星港」，去商人那补给、招募新成员。',
          this.resultHomeBtn,
          () => { advanceStrongGuideStep(t); this.persist(); this.hideTutorialStep(); this.onResultGoHome(); this.runTutorialStep(); },
        );
        break;
      case 42:
        this.closeUnitPanelsToHub();
        this.showTutorialStep(
          '「商人小站」能用星贝（你出战攒下的货币）买补给券、信标等。\n点闪烁高亮的「商人小站」。',
          this.hubMerchantEntryNode,
          () => {
            this.openBuildingUnlockDialog('bld_merchant_station', '商人小站');
            this.showTutorialStep('花星矿解锁商人小站——点闪烁高亮的「确认」。', this.buildingUnlockConfirmBtn,
              () => { advanceStrongGuideStep(t); this.onConfirmBuildingUnlock(); this.persist(); this.runTutorialStep(); });
          },
        );
        break;
      case 43:
        this.openMerchant();
        this.showTutorialStep(
          '用星贝买一张补给券——点闪烁高亮的「买」。\n（补给券是抽卡货币，下一步要用它招募新驾驶员。）',
          this.merchantTicketBuyBtn,
          () => {
            advanceStrongGuideStep(t); // →44
            this.onMerchantBuy('o0'); // offerId o0 = 补给券（alwaysOffers 第1项固定）
            this.persist();
            this.hideTutorialStep();
            this.closeMerchant();
            this.closeUnitPanelsToHub();
            this.showTutorialStep(
              '买到补给券了！下一步去补给站用它招募新驾驶员。',
              null,
              () => { this.hideTutorialStep(); this.runTutorialStep(); },
              '去抽卡',
            );
          },
        );
        break;
      // ===== M3-1b 关5后：抽卡得克制驾驶员 → 装到旗舰 → 强引导结束 =====
      case 44:
        this.openGacha(); this.switchGachaPool('recruit');
        this.showTutorialStep(
          '用刚买的补给券，在「驾驶员招募池」抽 1 次，招募一名能克制刁钻敌人的驾驶员。\n点闪烁高亮的「单抽」。',
          this.gachaSingleBtn,
          () => {
            advanceStrongGuideStep(t); // →45
            this.grantTutorialGachaUnit('pilot', S7_TUTORIAL_COUNTER_PILOT);
            this.persist();
            this.hideTutorialStep();
            const star = this.playerState ? getPilotStar(this.playerState.unitTiers, S7_TUTORIAL_COUNTER_PILOT) : 1;
            this.showTutorialStep(
              `🎉 招募到驾驶员「${this.unitName('pilot', S7_TUTORIAL_COUNTER_PILOT)}」（${star}★）！\n下一步把它装到旗舰上，换个驾驶员应对敌人——这就是「克制」。`,
              null,
              () => { this.hideTutorialStep(); this.closeGacha(); this.closeUnitPanelsToHub(); this.runTutorialStep(); },
              '去装配',
            );
          },
        );
        break;
      case 45: {
        this.openPrebattle();
        this.prebattleSelShip = S7_TUTORIAL_STARTER.shipId;
        this.openBoarding();
        const flagName = this.unitName('ship', S7_TUTORIAL_STARTER.shipId);
        const newPName = this.unitName('pilot', S7_TUTORIAL_COUNTER_PILOT);
        this.showTutorialStep(
          `给旗舰「${flagName}」换驾驶员：点闪烁高亮的「装配」。`,
          this.boardingEquipBtn,
          () => {
            this.openLoadout();
            this.showTutorialStep(
              `在列表里点驾驶员「${newPName}」。`,
              this.loadoutItemBtns.get(`pilot:${S7_TUTORIAL_COUNTER_PILOT}`) ?? null,
              () => {
                this.openEquipDetail({ kind: 'pilot', id: S7_TUTORIAL_COUNTER_PILOT });
                this.showTutorialHint(
                  '点闪烁高亮的「装备」，换上克制驾驶员。\n（原驾驶员会被换下·留着以后再用。）',
                  () => this.pilotOf(S7_TUTORIAL_STARTER.shipId) === S7_TUTORIAL_COUNTER_PILOT,
                  this.equipDetailActionBtn,
                );
              },
            );
          },
        );
        break;
      }
      case 46:
        this.showTutorialStep(
          '搞定！核心系统都教完啦——战斗、升级、插件、抽卡、装配、摆阵、克制、打捞、商人……\n往后自由探索：升阶、升星、星核这些，等你自然玩到会有简短提示。\n强引导到此结束，祝你在星港玩得开心，指挥官！',
          null,
          () => {
            completeStrongGuide(this.playerState!.tutorial);
            this.persist();
            this.hideTutorialStep();
            this.closeLoadout(); this.closeBoarding(); this.closeUnitPanelsToHub();
            this.refresh();
            if (this.reportPending) this.openReturnReport(); // 块1：教程期间压住的回港报告补弹
          },
          '开始探索',
        );
        break;
      default:
        // 强引导已结束(step≥47/或 completeStrongGuide)：收起遮罩/提示条、放开自由玩。
        this.hideTutorialStep();
        this.hideTutorialHint();
        break;
    }
  }

  /** M1：教程内收起 单位管理 + 船坞/训练舱，回到星港主界面。 */
  private closeUnitPanelsToHub(): void {
    if (this.unitManageNode) this.unitManageNode.active = false;
    if (this.dockNode) this.dockNode.active = false;
    if (this.trainingNode) this.trainingNode.active = false;
    this.refresh();
  }

  /** M1b-2：教程内为指定星舰打开装配面板（设选中舰→开 loadout）。幂等。 */
  private openLoadoutForTutorial(shipId: string): void {
    this.prebattleSelShip = shipId;
    if (this.loadoutNode && !this.loadoutNode.active) this.openLoadout();
    else this.refreshLoadout();
  }

  /** M1b-2：关2拿到的武器插件实例 ref（找不到=未发货，返回 null·正常不会发生）。 */
  private tutorialWeaponPluginRef(): S7EquipRef | null {
    if (!this.pluginInventory) return null;
    const inst = this.pluginInventory.plugins.find((p) => p.pluginId === S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN.pluginId);
    return inst ? { kind: 'plugin', id: inst.instanceId } : null;
  }

  /**
   * M1 关1-4：锁死遮罩 + 闪烁高亮"该选的那张卡"，玩家只能点高亮那张（点别处遮罩吞掉无反应）。
   * 文案按当前步分：step2=星矿 / step12=武器插件 / step21=补给券 / step34=普通信标。
   */
  private showTutorialForcedChoice(): void {
    const p = this.pendingLevelReward;
    if (!p || !this.playerState) return;
    const idx = p.forcedPickIndex ?? 0;
    const pick = (idx >= 0 && idx < p.choices.length) ? idx : 0;
    const card = this.levelRewardListNode ? (this.levelRewardListNode.children[pick] ?? null) : null;
    const step = this.playerState.tutorial.strongGuideStep;
    const text = step === 12
      ? '点闪烁高亮的「武器槽·精良」插件（选前只显示槽位+品质，选后才揭晓具体名）。'
      : step === 21
        ? '点闪烁高亮的「补给券」——招募新成员（抽卡）要用它。'
        : step === 34
          ? '点闪烁高亮的「普通信标」——下一步解锁打捞港要用。'
          : '首通奖励三选一：点闪烁高亮的「星矿」——下一步解锁建筑要用。';
    // 锁死：点中高亮的那张卡→onNext 入账该项+推进；点别处遮罩吞掉无反应。
    this.showTutorialStep(text, card, () => {
      const t = this.playerState!.tutorial;
      advanceStrongGuideStep(t); // 关1 2→3 / 关2 12→13 / 关3 21→22 / 关4 34→35
      this.onPickLevelChoice(pick);
      this.runTutorialStep();
    });
  }

  /**
   * M3 关5：三选一不强制（星贝是必得软货币·不进三选一·GDD §S8）→ 顶部提示条引导玩家"毕业自选"，
   * 不盖遮罩、可点任意卡；选完(onPickLevelChoice 清空 pendingLevelReward)由 update() 轮询续到 step41。
   */
  private showTutorialGraduationPick(): void {
    if (!this.pendingLevelReward) return;
    this.showTutorialHint(
      '🎓 这关的奖励三选一——你已经学会怎么挑了，这次自己选一个喜欢的！',
      () => !this.pendingLevelReward,
    );
  }

  /** 搭弱引导首触短教程弹窗（默认隐藏）：居中卡片，文字 + 「知道了」单键（居中·#14 单键孔位）。 */
  private buildTutorialPopup(W: number, H: number): void {
    const panel = new Node('S7TutorialPopup');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform);
    ut.setContentSize(W, H);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 120);
    dim.rect(-W / 2, -H / 2, W, H);
    dim.fill();
    panel.on(Node.EventType.TOUCH_END, () => {}, this);

    const cardW = W * 0.78, cardH = 320;
    const cardNode = new Node('card');
    cardNode.layer = this.node.layer;
    panel.addChild(cardNode);
    const cardUt = cardNode.addComponent(UITransform);
    cardUt.setContentSize(cardW, cardH);
    const cardBg = cardNode.addComponent(Graphics);
    cardBg.fillColor = new Color(28, 34, 52, 255);
    cardBg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    cardBg.fill();

    const textNode = new Node('text');
    textNode.layer = this.node.layer;
    cardNode.addChild(textNode);
    textNode.setPosition(0, 40, 0);
    const textLabel = textNode.addComponent(Label);
    textLabel.fontSize = 30;
    textLabel.lineHeight = 40;
    textLabel.color = new Color(255, 255, 255);
    const textUt = textNode.addComponent(UITransform);
    textUt.setContentSize(cardW * 0.86, 200);
    textLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
    textLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

    const mkBtn = (label: string, x: number, color: Color, tap: () => void): void => {
      const w = cardW * 0.36, h = 68;
      const n = new Node('b');
      n.layer = this.node.layer;
      cardNode.addChild(n);
      n.setPosition(x, -cardH / 2 + 60, 0);
      const nut = n.addComponent(UITransform);
      nut.setContentSize(w, h);
      const bg = n.addComponent(Graphics);
      bg.fillColor = color;
      bg.roundRect(-w / 2, -h / 2, w, h, 12);
      bg.fill();
      const ln = new Node('t');
      ln.layer = this.node.layer;
      n.addChild(ln);
      const l = ln.addComponent(Label);
      l.fontSize = 28;
      l.lineHeight = 36;
      l.color = new Color(255, 255, 255);
      l.string = label;
      n.on(Node.EventType.TOUCH_END, tap, this);
    };
    mkBtn('知道了', 0, new Color(80, 160, 230, 255), () => this.tutorialPopupNextHandler?.());

    panel.active = false;
    this.tutorialPopupNode = panel;
    this.tutorialPopupTextLabel = textLabel;
  }

  /** 展示弱引导首触短教程弹窗；onSkip/onNext 通常都应调 markFirstTouchSeen 再各自收尾（跳过=直接关，下一步=可能翻页或关）。 */
  private showTutorialPopup(text: string, onSkip: () => void, onNext: () => void): void {
    if (!this.tutorialPopupNode || !this.tutorialPopupTextLabel) return;
    this.tutorialPopupTextLabel.string = text;
    this.tutorialPopupSkipHandler = onSkip;
    this.tutorialPopupNextHandler = onNext;
    this.tutorialPopupNode.active = true;
    this.raiseTutorialDevBar();
  }

  /** 收起弱引导首触短教程弹窗。 */
  private hideTutorialPopup(): void {
    if (this.tutorialPopupNode) this.tutorialPopupNode.active = false;
    this.tutorialPopupSkipHandler = null;
    this.tutorialPopupNextHandler = null;
  }

  // ===== M2 交互式强引导：顶部提示条（不锁操作）+ 目标轮询 =====

  /** 搭交互式提示条（默认隐藏·顶部安全区下方·不吞触摸→玩家可操作真实 UI）。 */
  private buildTutorialHint(W: number, H: number): void {
    const band = getS7UsableBand();
    const panel = new Node('S7TutorialHint'); panel.layer = this.node.layer; this.node.addChild(panel);
    panel.setPosition(0, band.usableTopY - 36, 0);
    // 半透明底条（窄·只盖顶部一行·不挡九宫格/上阵面板）；不挂触摸监听 → 不吞触摸。
    const bg = panel.addComponent(Graphics);
    bg.fillColor = new Color(20, 28, 48, 230);
    bg.roundRect(-W * 0.46, -52, W * 0.92, 104, 14);
    bg.fill();
    const tN = new Node('t'); tN.layer = this.node.layer; panel.addChild(tN);
    const l = tN.addComponent(Label); l.fontSize = 26; l.lineHeight = 34; l.color = new Color(255, 235, 170);
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    const tut = tN.addComponent(UITransform); tut.setContentSize(W * 0.88, 100);
    l.overflow = Label.Overflow.RESIZE_HEIGHT;
    panel.active = false;
    this.tutorialHintNode = panel;
    this.tutorialHintLabel = l;
    // 闪烁高亮层（满屏·不挂触摸监听→不吞触摸，玩家点得到下面的真按钮）：画框框住目标按钮/卡，update() 做闪烁。
    const flash = new Node('S7TutorialFlash'); flash.layer = this.node.layer; this.node.addChild(flash);
    flash.addComponent(UITransform).setContentSize(W, H);
    this.tutorialFlashGfx = flash.addComponent(Graphics);
    flash.active = false;
    this.tutorialFlashNode = flash;
  }

  /**
   * 交互式强引导步：顶部提示条说明该做什么（不锁操作），玩家在真实 UI 完成 goal() 后由 update() 检测推进。
   * target 给了就闪烁高亮框住那个真按钮/卡（玩家直接点它，不点教学按钮）。goal 必须只在真正完成时返回 true。
   */
  private showTutorialHint(text: string, goal: () => boolean, target: Node | null = null): void {
    if (!this.tutorialHintNode || !this.tutorialHintLabel) return;
    this.hideTutorialStep(); // 交互提示条与锁操作遮罩互斥
    this.tutorialHintLabel.string = text;
    this.tutorialInteractiveGoal = goal;
    this.tutorialFlashTarget = target;
    this.tutorialHintNode.active = true;
    if (this.tutorialFlashNode) this.tutorialFlashNode.active = !!target;
    this.raiseTutorialHintIfActive();
  }

  /** 收起交互式提示条 + 清目标 + 清闪烁高亮。 */
  private hideTutorialHint(): void {
    if (this.tutorialHintNode) this.tutorialHintNode.active = false;
    if (this.tutorialFlashNode) this.tutorialFlashNode.active = false;
    if (this.tutorialFlashGfx) this.tutorialFlashGfx.clear();
    this.tutorialInteractiveGoal = null;
    this.tutorialFlashTarget = null;
    this.tutorialForcedPickIndex = null;
    this.hideTutorialDragLock();
  }

  /** 搭"留洞锁屏"四块挡板（默认隐藏，初始 0 大小；每次展示前由 layoutTutorialDragLockBlockers 按目标重摆）。 */
  private buildTutorialDragLock(W: number, H: number): void {
    const container = new Node('S7TutorialDragLock'); container.layer = this.node.layer; this.node.addChild(container);
    container.addComponent(UITransform).setContentSize(W, H); // 缺这行 convertToNodeSpaceAR 拿不到坐标系→挡板永远摆不上(真机栽过)
    const mk = (name: string): [Node, Graphics] => {
      const n = new Node(name); n.layer = this.node.layer; container.addChild(n);
      n.addComponent(UITransform).setContentSize(1, 1);
      const gfx = n.addComponent(Graphics);
      n.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸（挡板范围内点击无反应，洞内无此节点→直通底下真节点）
      n.active = false;
      return [n, gfx];
    };
    [this.tutorialDragLockTop, this.tutorialDragLockTopGfx] = mk('top');
    [this.tutorialDragLockBottom, this.tutorialDragLockBottomGfx] = mk('bottom');
    [this.tutorialDragLockLeft, this.tutorialDragLockLeftGfx] = mk('left');
    [this.tutorialDragLockRight, this.tutorialDragLockRightGfx] = mk('right');
    container.active = false;
    this.tutorialDragLockNode = container;
  }

  /** 按 target 包围盒摆四块挡板：上/下/左/右各盖一块，target 处真留空(无节点)——与 drawTutorialDim 同套挖洞算法。 */
  private layoutTutorialDragLockBlockers(target: Node): void {
    const container = this.tutorialDragLockNode;
    const ut = target.getComponent(UITransform);
    if (!container) return;
    const containerUt = container.getComponent(UITransform);
    if (!ut || !containerUt) return;
    const W = this.viewW, H = this.viewH;
    const c = containerUt.convertToNodeSpaceAR(target.getWorldPosition());
    const pad = 12;
    const hw = ut.contentSize.width * target.scale.x / 2 + pad;
    const hh = ut.contentSize.height * target.scale.y / 2 + pad;
    const L = c.x - hw, R = c.x + hw, B = c.y - hh, T = c.y + hh;
    const place = (n: Node | null, gfx: Graphics | null, x: number, y: number, w: number, h: number): void => {
      if (!n) return;
      const active = w > 0 && h > 0;
      n.active = active;
      if (!active) return;
      n.getComponent(UITransform)!.setContentSize(w, h);
      n.setPosition(x + w / 2, y + h / 2, 0);
      if (gfx) { gfx.clear(); gfx.fillColor = new Color(0, 0, 0, 175); gfx.rect(-w / 2, -h / 2, w, h); gfx.fill(); }
    };
    place(this.tutorialDragLockTop, this.tutorialDragLockTopGfx, -W / 2, T, W, H / 2 - T);
    place(this.tutorialDragLockBottom, this.tutorialDragLockBottomGfx, -W / 2, -H / 2, W, B + H / 2);
    place(this.tutorialDragLockLeft, this.tutorialDragLockLeftGfx, -W / 2, B, L + W / 2, T - B);
    place(this.tutorialDragLockRight, this.tutorialDragLockRightGfx, R, B, W / 2 - R, T - B);
  }

  /**
   * 留洞锁屏：拖拽步专用——target 四周锁死(压暗+吞触摸)，target 包围盒处真留空洞，
   * 玩家在洞内对真节点的拖拽手势(start/move/end)完整直通，其余地方点了无反应。
   * goal() 真正拖对位置才返回 true；复用 tutorialInteractiveGoal 轮询(update() 自动推进+收尾)。
   */
  private showTutorialDragLock(text: string, target: Node, goal: () => boolean): void {
    this.showTutorialHint(text, goal, target); // 文字提示条 + 闪烁高亮框 + goal 轮询
    this.layoutTutorialDragLockBlockers(target);
    if (this.tutorialDragLockNode) {
      this.tutorialDragLockNode.active = true;
      const parent = this.tutorialDragLockNode.parent;
      if (parent) this.tutorialDragLockNode.setSiblingIndex(parent.children.length - 1);
    }
    this.raiseTutorialHintIfActive(); // 把提示条/高亮/DEV键再抬到挡板之上
  }

  /** 收起留洞锁屏四块挡板。 */
  private hideTutorialDragLock(): void {
    if (this.tutorialDragLockNode) this.tutorialDragLockNode.active = false;
  }

  /** 提示条/高亮活动时抬到最前（玩家打开上阵/装配/打捞面板会 setSiblingIndex 抢前→须再抬上去才可见）。 */
  private raiseTutorialHintIfActive(): void {
    const parent = this.tutorialHintNode?.parent;
    if (!parent) return;
    if (this.tutorialFlashNode && this.tutorialFlashNode.active) this.tutorialFlashNode.setSiblingIndex(parent.children.length - 1);
    if (this.tutorialHintNode && this.tutorialHintNode.active) this.tutorialHintNode.setSiblingIndex(parent.children.length - 1);
    this.raiseTutorialDevBar();
  }

  /** 每帧更新闪烁高亮框（脉动透明度+微放大），框住 tutorialFlashTarget 的真按钮包围盒。update() 调。
   *  锁死遮罩激活→画在遮罩高光层(tutorialHighlightGfx)；非阻塞提示条激活→画在闪烁层(tutorialFlashGfx)。 */
  private tickTutorialFlash(dt: number): void {
    const target = this.tutorialFlashTarget;
    if (!target) return;
    let gfx: Graphics | null = null;
    let ownerUt: UITransform | null = null;
    if (this.tutorialOverlayNode?.active) {
      gfx = this.tutorialHighlightGfx; ownerUt = this.tutorialOverlayNode.getComponent(UITransform);
    } else if (this.tutorialFlashNode?.active) {
      gfx = this.tutorialFlashGfx; ownerUt = this.tutorialFlashNode.getComponent(UITransform);
    }
    const ut = target.getComponent(UITransform);
    if (!gfx || !ownerUt || !ut) return;
    this.tutorialFlashClock += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.tutorialFlashClock * 6); // 0..1 脉动
    const local = ownerUt.convertToNodeSpaceAR(target.getWorldPosition());
    const w = ut.contentSize.width * target.scale.x;
    const h = ut.contentSize.height * target.scale.y;
    const pad = 6 + pulse * 10; // 边距随脉动放大→"放大/闪烁"感
    gfx.clear();
    gfx.lineWidth = 4 + pulse * 3;
    gfx.strokeColor = new Color(255, 220, 80, Math.round(140 + pulse * 115));
    gfx.roundRect(local.x - w / 2 - pad, local.y - h / 2 - pad, w + pad * 2, h + pad * 2, 12);
    gfx.stroke();
  }

  /** 纯讲解步（无游戏动作可点）：= 锁死遮罩 + 文字 + 点任意处继续（showTutorialStep 的 target=null 分支）。 */
  private showTutorialInfo(text: string, onNext: () => void): void {
    this.showTutorialStep(text, null, onNext);
  }

  /** 搭"战前备战"叠加层（默认隐藏）。布局：敌情预览(上半) ↔ 九宫格(下半居中·上下对称) → 底部三键。
   *  开战时 prebattleUiNode 整体隐藏，战斗就地画在 prebattleGfx 上（站位 = 备战站位）。装备/上下场移到「上阵界面」。 */
  private buildPrebattlePanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const botY = band.usableBottomY;
    const panel = new Node('S7Prebattle');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics); // 底板 + 敌情预览 + 九宫格；开战时改画战斗帧
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.prebattleNode = panel;
    this.prebattleGfx = g;

    // 可交互 UI 容器（开战时隐藏）。
    const ui = new Node('pbUi'); ui.layer = this.node.layer; panel.addChild(ui); ui.setPosition(0, 0, 0);
    this.prebattleUiNode = ui;

    const mk = (text: string, size: number, color: Color, x: number, y: number): Label => {
      const n = new Node('pbl'); n.layer = this.node.layer; ui.addChild(n); n.setPosition(x, y, 0);
      const l = n.addComponent(Label); l.fontSize = size; l.lineHeight = Math.round(size * 1.3); l.color = color; l.string = text;
      return l;
    };
    const mkBtn = (text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void): Node => {
      const n = new Node('pbBtn'); n.layer = this.node.layer; ui.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 12); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 34; l.lineHeight = 42; l.color = new Color(255, 255, 255); l.string = text;
      n.on(Node.EventType.TOUCH_END, onTap, this);
      return n;
    };

    // 标题 + 信息行（节点/战力/敌情概要）。信息行带容器框（#2：悬赏词缀多行长文案自动缩）。
    mk('★ 战前备战 ★', 52, new Color(255, 230, 120), 0, band.usableTopY - 42);
    this.prebattleInfoLabel = mk('', 30, new Color(210, 225, 250), 0, band.usableTopY - 130);
    {
      const it = this.labelBox(this.prebattleInfoLabel);
      it.setContentSize(W * 0.94, 150);
      this.prebattleInfoLabel.overflow = Label.Overflow.SHRINK;
      this.prebattleInfoLabel.enableWrapText = true;
    }

    // 3×3 九宫格（居中·下半部分；坐标走 fieldPlayerPos = 战斗站位）。点格 → 弹「上阵界面」。
    const cell = this.fieldCell;
    this.prebattleCellLabels = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const slotRef = `p${r}c${c}`;
        const p = this.fieldPlayerPos(r, c);
        const cn = new Node(`pbCell_${slotRef}`);
        cn.layer = this.node.layer; ui.addChild(cn); cn.setPosition(p.x, p.y, 0);
        const ut = cn.addComponent(UITransform); ut.setContentSize(cell, cell);
        // 触摸结束：松手位置在别的格 = 拖动换位/移动；同格 = 点击进上阵界面。
        // ⚠️ 在格内松手触发 TOUCH_END、拖到格外松手触发 TOUCH_CANCEL——两者都要听，否则拖动(必落在别格)永远收不到事件。
        cn.on(Node.EventType.TOUCH_END, (e: EventTouch) => this.onCellTouchEnd(slotRef, e), this);
        cn.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => this.onCellTouchEnd(slotRef, e), this);
        const ln = new Node('t'); ln.layer = this.node.layer; cn.addChild(ln);
        const l = ln.addComponent(Label); l.fontSize = 30; l.lineHeight = 36; l.color = new Color(230, 240, 255); l.string = '';
        this.prebattleCellLabels.push(l);
        this.prebattleCellNodes.set(slotRef, cn);
      }
    }

    // 底部三键：选择关卡(左·主线专属) / 返回(中) / 开始战斗(右)。悬赏备战=两键（藏选关·返回改「返回悬赏板」·openPrebattle 里切）。
    // 巡检批 #15：原「开始战斗」330 宽 @0.30W 与居中「返回」热区重叠 64px → 三键重排，相邻各留 8px。
    this.prebattleLevelSelBtn = mkBtn('选择关卡', 210, 88, new Color(70, 130, 180, 255), -W * 0.344, botY + 58, () => this.openLevelSelect());
    const backBtn = mkBtn('返回星港', 200, 88, new Color(120, 90, 160, 255), -W * 0.06, botY + 58, () => this.onPrebattleBack());
    this.prebattleBackLabel = backBtn.getComponentInChildren(Label);
    this.prebattleSortieBtn = mkBtn('🚀 开始战斗', 300, 112, new Color(225, 150, 45, 255), W * 0.284, botY + 58, () => this.onConfirmSortie());

    // 备战内嵌战斗的「跳过」「倍速」两键（挂面板·开战时单独显示）——磨精批1 糖果件重画：
    // 倍速收左下角、跳过收右下角（中央让给战场=竞品惯例），凝胶按钮=投影+描边圈+高光带。
    const skip = this.makeBattleCandyBtn('跳过 ▶▶', 200, 78, new Color(240, 154, 62, 255), new Color(172, 100, 32, 255), W / 2 - 112, botY + 58, () => this.onSkip());
    panel.addChild(skip.node);
    skip.node.active = false;
    this.prebattleSkipBtn = skip.node;
    const spd = this.makeBattleCandyBtn('1x ▶', 140, 78, new Color(74, 156, 214, 255), new Color(40, 104, 156, 255), -(W / 2 - 82), botY + 58, () => this.onCycleSpeed());
    panel.addChild(spd.node);
    spd.node.active = false;
    this.speedBtnLabel = spd.label;
    this.prebattleSpeedBtn = spd.node;
  }

  /** 战斗态糖果按钮（磨精批1·战斗页专用件）：落地投影+深描边圈+主色体+顶部高光带——
   *  治"灰盒方块钮=demo 感"；全局 addBtn 灰盒件不动，只换战斗播放态两钮。 */
  private makeBattleCandyBtn(
    text: string, w: number, h: number, main: Color, dark: Color,
    x: number, y: number, onTap: () => void,
  ): { node: Node; label: Label } {
    const n = new Node('pbCandyBtn');
    n.layer = this.node.layer;
    n.addComponent(UITransform).setContentSize(w, h);
    n.setPosition(x, y, 0);
    const g = n.addComponent(Graphics);
    const r = h / 2;
    g.fillColor = new Color(30, 16, 36, 88); // 落地投影
    g.roundRect(-w / 2 + 2, -h / 2 - 5, w, h, r);
    g.fill();
    g.fillColor = dark; // 深色外壳圈
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
    g.fillColor = main; // 主色体
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 3);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 58); // 顶部高光带（凝胶感）
    g.roundRect(-w / 2 + 9, h * 0.08, w - 18, h * 0.28, h * 0.14);
    g.fill();
    const ln = new Node('t');
    ln.layer = this.node.layer;
    n.addChild(ln);
    ln.setPosition(0, 1, 0);
    const l = ln.addComponent(Label);
    l.fontSize = 30;
    l.lineHeight = 36;
    l.isBold = true;
    l.color = new Color(255, 255, 255);
    l.enableOutline = true;
    l.outlineWidth = 2;
    l.outlineColor = new Color(Math.round(dark.r * 0.55), Math.round(dark.g * 0.55), Math.round(dark.b * 0.55), 235);
    l.string = text;
    n.on(Node.EventType.TOUCH_END, onTap, this);
    return { node: n, label: l };
  }

  /** L：循环倍速 1x→2x→3x→1x（回放期间即时生效）。 */
  private onCycleSpeed(): void {
    this.playbackSpeed = this.playbackSpeed >= 3 ? 1 : this.playbackSpeed + 1;
    if (this.speedBtnLabel) this.speedBtnLabel.string = `${this.playbackSpeed}x ▶`;
    if (this.fxActive && this.fxLayer) this.fxLayer.setSpeed(this.playbackSpeed);
  }

  /** 搭"基地建筑"面板叠加层（默认隐藏）：底板 + 标题 + 7 行(点行=升该建筑) + 关闭。行文案在 refreshBasePanel 填。 */
  private buildBasePanel(W: number, H: number): void {
    const panel = new Node('S7BasePanel');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(6, 9, 18, 150); // 全屏淡遮罩（吞触摸·不点穿主界面）
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    g.fillColor = new Color(10, 14, 26, 248);
    g.roundRect(-W * 0.45, -H * 0.32, W * 0.9, H * 0.64, 14);
    g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.active = false;
    this.baseNode = panel;
    // 点卡片外空白 = 关闭；卡片内不关（背板兄弟节点接管·正确处理冒泡）。
    this.addModalDismiss(panel, () => this.closeBase(), W * 0.9, H * 0.64, 0, 0);

    const title = new Node('S7BaseTitle');
    title.layer = this.node.layer;
    panel.addChild(title);
    title.setPosition(0, H * 0.27, 0);
    const tl = title.addComponent(Label);
    tl.fontSize = 22;
    tl.lineHeight = 28;
    tl.color = new Color(255, 230, 120);
    tl.string = '基地建筑（原型：仅居住舱→离线 真生效，余为展示）';

    // 7 行：每行一个可点 Node（行底板 + Label），点击升对应建筑。
    this.baseRowLabels = [];
    for (let i = 0; i < S7_DEMO_DEFAULT_BUILDINGS.length; i += 1) {
      const id = S7_DEMO_DEFAULT_BUILDINGS[i];
      const rowY = H * 0.20 - i * H * 0.052;
      const row = new Node(`S7BaseRow_${id}`);
      row.layer = this.node.layer;
      panel.addChild(row);
      row.setPosition(0, rowY, 0);
      const rut = row.addComponent(UITransform);
      rut.setContentSize(W * 0.84, H * 0.046);
      const rg = row.addComponent(Graphics);
      rg.fillColor = new Color(30, 38, 56, 255);
      rg.roundRect(-W * 0.42, -H * 0.022, W * 0.84, H * 0.044, 8);
      rg.fill();
      const lblNode = new Node('rowlbl');
      lblNode.layer = this.node.layer;
      row.addChild(lblNode);
      const lbl = lblNode.addComponent(Label);
      lbl.fontSize = 20;
      lbl.lineHeight = 26;
      lbl.color = new Color(230, 240, 255);
      lbl.string = '';
      this.baseRowLabels.push(lbl);
      row.on(Node.EventType.TOUCH_END, () => this.onUpgradeBuilding(id), this);
    }

    // 关闭按钮（挂在 this.node 上，随面板一起显隐）。
    this.baseCloseBtn = this.makeButton('关闭', 180, 64, new Color(95, 100, 120, 255), 0, -H * 0.28, () => this.closeBase());
    this.baseCloseBtn.active = false;
  }

  private makeLabel(text: string, fontSize: number, color: Color, x: number, y: number): Label {
    const node = new Node('S7DemoLabel');
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.setPosition(x, y, 0);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.35);
    label.color = color;
    label.string = text;
    return label;
  }

  private makeButton(
    text: string,
    w: number,
    h: number,
    color: Color,
    x: number,
    y: number,
    onTap: () => void,
  ): Node {
    const node = new Node('S7DemoButton');
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.setPosition(x, y, 0);
    const ut = node.addComponent(UITransform);
    ut.setContentSize(w, h);
    const g = node.addComponent(Graphics);
    g.fillColor = color;
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    const labelNode = new Node('S7DemoButtonLabel');
    labelNode.layer = this.node.layer;
    node.addChild(labelNode);
    const label = labelNode.addComponent(Label);
    label.fontSize = 38;
    label.lineHeight = 48;
    label.color = new Color(255, 255, 255);
    label.string = text;
    node.on(Node.EventType.TOUCH_END, onTap, this);
    return node;
  }

  // ===== 交互 =====

  /**
   * 战前备战层「出战」确认：关战前备战层 → 打当前节点（会话用玩家编队·内部发奖+推进）→ 落盘 → 播回放 → 显示结果。
   * 无遭遇节点显示「暂无关卡」。回放期间守门。
   */
  private onConfirmSortie(): void {
    if (!this.session || this.playing) return;
    // 块3：备战处于回廊模式（点挑战进来）→ 出战改打该层（内联敌阵/戏法/限时在 runCorridorBattle 内组装）。
    if (this.corridorPrepLayer !== null) {
      this.launchCorridorBattle(this.corridorPrepLayer); // 成功进播放时内部才清回廊模式标记（失败留在备战可调阵）
      return;
    }
    // 块2：备战处于悬赏模式（点卡进来）→ 出战改打该悬赏卡（词缀/运输船在 runBountyBattle 内组装）。
    // 与主线同口径：**不关备战层**——战斗就地在备战舞台播放（startPlayback 只藏 prebattleUiNode）；
    // 曾在此 closePrebattle() 把舞台整个藏掉 → 真机"跳回主界面、隔会弹结算"看不到战斗（块2真机灵魂bug）。
    if (this.bountyPrepCardId) {
      this.launchBountyBattle(this.bountyPrepCardId); // 成功进播放时内部才清悬赏模式标记（失败留在备战可重试）
      return;
    }
    // 关4摆阵教程(step32)：晨星仍在前排→阻止出战并提示
    if (this.isStrongGuideActive() && this.playerState?.tutorial.strongGuideStep === 32) {
      const col = this.shipSlotCol(S7_TUTORIAL_STARTER.shipId);
      if (col !== null && col >= 2) {
        this.setPrebattleInfo('⚠ 先把晨星护卫舰拖到后排（第二或第三排），再开始战斗');
        return;
      }
    }
    // #2 出战前校验编队（v1.0 §4.4 空船不能上阵）：有船缺驾驶员/没上阵 → 拦下并提示，不开打。
    // 带插件库存校验(与会话内部一致)，built.lineup 即含插件——下面附上全队加成后直接喂战斗。
    let lineup: ReturnType<typeof buildSquadLineup> | null = null;
    if (this.squad) {
      const built = buildSquadLineup(this.squad, this.playerState?.unitLevels, this.pluginInventory ?? undefined, this.playerState?.unitTiers); // ⑩A1：驾驶员级/星入战（回执⑤）
      if (!built.ok && this.prebattleInfoLabel) {
        const msg = built.code === 'no_pilot' ? '有星舰缺驾驶员——请给每艘上阵星舰配上驾驶员再出战'
          : built.code === 'empty' ? '请先上阵至少 1 艘星舰'
          : built.code === 'dup_pilot' ? '同一驾驶员只能驾一艘船'
          : `编队不合法（${built.code}）`;
        this.prebattleInfoLabel.string = `⚠ ${msg}`;
        this.prebattleInfoLabel.color = new Color(240, 180, 120);
        return;
      }
      if (!built.ok) return;
      lineup = built;
    }
    const nodeId = this.session.currentNodeId;
    this.sound.playBgm('bgm_battle');
    // J：全队加成（研究塔+星核展厅）+ 每舰升阶/升星加成，都附到上阵舰喂进战斗。
    const team = this.teamBonusBlocks();
    const battleLineup = (lineup && lineup.ok)
      ? lineup.lineup.map((u) => {
        const extra = [...(u.extraBlocks ?? []), ...team, ...playerCritBaseBlocks()];
        return extra.length > 0 ? { ...u, extraBlocks: extra } : u;
      })
      : undefined;
    let outcome: S7PlayNodeOutcome;
    try {
      outcome = this.session.playCurrentNode(S7_DEMO_RUN_SEED, battleLineup, S7_HARD_CONTROL_DIMINISH);
    } catch (err) {
      // 无遭遇节点（你已通到内容缺口·如 n008+）：不静默弹回基地——留在备战界面给明确提示，引导点「选择关卡」挑可玩关。
      console.warn('[S7DemoController] 该节点暂无战斗遭遇', nodeId, err);
      if (this.prebattleInfoLabel) {
        this.prebattleInfoLabel.string = `⚠ ${nodeId} 暂无遭遇（原型内容到此为止）\n点左下「选择关卡」挑一个可玩关`;
        this.prebattleInfoLabel.color = new Color(240, 200, 120);
      }
      return; // 不关备战层、不落盘
    }
    // 有遭遇：先喂活动进度(G) + 主线救回人口(K) + 战败安慰包(块5·S13 #9·仅主线·白送入账，都随落盘一起存) → 落盘 → 就地播战斗演出。
    if (outcome.won) this.feedActivity(S7_ACTIVITY_ACTIONS.nodeClear); // G：推关胜利喂活动进度
    this.grantNodeRescuePop(nodeId, outcome); // K：首通主线救回 居民/工人
    this.captureDefeatConsolation(outcome.won); // 块5：主线战败→基础包入账+结算窗小块（悬赏/回廊/推演不走此路径）
    this.persist();
    this.captureLevelReward(nodeId, outcome); // F：首通胜利→抓取三选一上下文（结果弹窗弹出时再展示）
    this.pendingWon = outcome.won;
    this.pendingResult = this.composeResultText(nodeId, outcome);
    this.startPlayback(buildS7BattlePlayback(outcome.battle.result));
  }

  /** J：建筑全队加成（研究塔伤害 + 星核展厅收藏加成）→ 战斗积木(maxHp+attack 各一条 pct)。无加成→空。 */
  private teamBonusBlocks(): S7EffectBlock[] {
    if (!this.buildings || !this.squad) return [];
    const researchLv = getBuildingLevel(this.buildings, 'bld_research_tower');
    const galleryLv = getBuildingLevel(this.buildings, 'bld_rsv_core_gallery');
    const distinctCores = Object.keys(this.squad.ownedCores).length;
    const pct = researchTeamBonusPct(researchLv) + coreGalleryTeamBonusPct(galleryLv, distinctCores); // 百分数
    if (pct <= 0) return [];
    const frac = pct / 100;
    return [
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: frac, source: 'building_team_bonus' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: frac, source: 'building_team_bonus' },
    ];
  }

  // ===== A-step2 战前备战界面交互 =====

  /** 打开战前备战层（回放期间禁用）：刷新内容后显示。悬赏备战=两键（藏「选择关卡」·返回改「返回悬赏板」，真机批②①）。 */
  private openPrebattle(): void {
    if (this.playing || !this.prebattleNode) return;
    this.prebattleSelSlot = null;
    this.prebattleSelShip = null;
    const isBounty = this.bountyPrepCardId !== null;
    const isCorridor = this.corridorPrepLayer !== null; // 块3：回廊模式也藏「选择关卡」、返回改「返回回廊」
    if (this.prebattleLevelSelBtn) this.prebattleLevelSelBtn.active = !isBounty && !isCorridor; // 选关=主线专属
    if (this.prebattleBackLabel) this.prebattleBackLabel.string = isBounty ? '返回悬赏板' : isCorridor ? '返回回廊' : '返回星港';
    // 巡检复验批 #14：两键模式（悬赏/回廊）底栏改等宽等高对称孔位（原「返回」200×88 与「开始战斗」300×112 大小不一且不对称）。
    this.layoutPrebattleKeys(isBounty || isCorridor);
    // ③b：定当前玩法（护航/演习按悬赏卡主题分）+ 载入该玩法的编队记忆（首进从当前全局 formation 播种再分叉）。
    this.prebattleGameplay = isCorridor ? 'corridor' : isBounty ? this.bountyThemeKey() : 'mainline';
    if (this.squad) loadGameplayLineup(this.squad, this.prebattleGameplay);
    this.refreshPrebattle();
    this.prebattleNode.active = true;
  }

  /** 当前悬赏卡主题 → 阵容记忆钥匙（护航=escort / 演习=drill；缺卡兜底 escort）。 */
  private bountyThemeKey(): S7GameplayLineupKey {
    if (this.bountyPrepCardId && this.playerState) {
      const card = findBountyCard(this.playerState.bounty, this.bountyPrepCardId);
      if (card) return card.theme === 'drill' ? 'drill' : 'escort';
    }
    return 'escort';
  }

  /** 把当前编队存进当前玩法的阵容记忆（③b·编队改动后调：上/下场、拖动换位）。 */
  private saveGameplayLineup(): void {
    if (this.squad) saveGameplayLineup(this.squad, this.prebattleGameplay);
  }

  /** 重摆一颗既有按钮（位置+热区+重绘底色·圆角 12 与备战 mkBtn 一致）。备战底栏模式切换用。 */
  private resizeBtn(node: Node, w: number, h: number, color: Color, x: number, y: number): void {
    node.setPosition(x, y, 0);
    node.getComponent(UITransform)?.setContentSize(w, h);
    const g = node.getComponent(Graphics);
    if (g) { g.clear(); g.fillColor = color; g.roundRect(-w / 2, -h / 2, w, h, 12); g.fill(); }
  }

  /** 备战底栏随模式重排（巡检复验批·B0.6 #14）：悬赏/回廊=两键（藏选关）→ 等宽等高对称孔位（返回左/开始战斗右）；
   *  主线=三键原三槽（页面底栏·主行动键加重合 #4，#14b 属正式版施工规范灰盒不搬家——本函数只治"两键模式大小不一不对称"的妨碍使用级问题）。 */
  private layoutPrebattleKeys(twoKey: boolean): void {
    const W = this.viewW;
    const botY = getS7UsableBand().usableBottomY;
    const back = this.prebattleBackLabel?.node.parent ?? null;
    if (!back || !this.prebattleSortieBtn) return;
    if (twoKey) {
      const xs = this.dialogBtnRowXs(2);
      this.resizeBtn(back, 260, 96, new Color(120, 90, 160, 255), xs[0], botY + 58);
      this.resizeBtn(this.prebattleSortieBtn, 260, 96, new Color(225, 150, 45, 255), xs[1], botY + 58);
    } else {
      this.resizeBtn(back, 200, 88, new Color(120, 90, 160, 255), -W * 0.06, botY + 58);
      this.resizeBtn(this.prebattleSortieBtn, 300, 112, new Color(225, 150, 45, 255), W * 0.284, botY + 58);
    }
  }

  /** 备战「返回」：悬赏→回悬赏板 / 回廊→回塔 / 主线→回基地。 */
  private onPrebattleBack(): void {
    const wasBounty = this.bountyPrepCardId !== null;
    const wasCorridor = this.corridorPrepLayer !== null;
    this.closePrebattle(); // 内部清悬赏/回廊模式标记
    if (wasBounty) this.reopenCombatHall('bounty');
    else if (wasCorridor) this.openCorridor();
  }

  private closePrebattle(): void {
    this.bountyPrepCardId = null; // 块2：取消/离开备战即退出悬赏模式（出战路径已先取走 id）
    this.corridorPrepLayer = null; // 块3：同上·退出回廊模式
    if (this.prebattleNode) this.prebattleNode.active = false;
  }

  /** 刷新战前备战：信息行(节点/战力/敌情概要) + 敌情预览色块 + 9 格编队 + 选中船详情。 */
  private refreshPrebattle(): void {
    if (!this.session || !this.squad || !this.prebattleGfx || !this.prebattleInfoLabel || !this.runtime) return;
    const perfT0 = Date.now(); // DEV-TEMP：[PERF] 探针（复验批·编队点击链延迟证据·上线前随 DEV 清单删）
    // 悬赏模式下敌情预览用悬赏敌阵节点（定价重锚批：recNodes 锚点法·过渡期自动选档），不显示主线当前关。
    // 块3：回廊模式用 n001 为载体建玩家侧战力/9格（敌情另按回廊敌阵单画·见下）。
    const viewProgress = this.corridorPrepLayer !== null
      ? { currentNodeId: 'n001', clearedNodeIds: [] as string[] }
      : this.bountyPrepCardId && this.model
        ? { currentNodeId: bountyBattleNodeId(this.bountyDifficultyNow()), clearedNodeIds: [] }
        : this.session.progress;
    const r = buildPrebattleView(this.runtime, viewProgress, this.squad, this.playerState?.unitLevels, this.pluginInventory ?? undefined, this.playerState?.unitTiers);
    const g = this.prebattleGfx;
    const W = this.viewW;
    const band = getS7UsableBand();
    g.clear();
    // 底板
    g.fillColor = new Color(12, 16, 28, 250);
    g.rect(-W / 2, -this.viewH / 2, W, this.viewH);
    g.fill();

    if (!r.ok) {
      this.prebattleInfoLabel.string = '该节点非战斗节点';
    } else if (this.corridorPrepLayer !== null) {
      // 块3：回廊备战——信息行=层号/戏法规则/敌情；敌情预览=回廊生成敌阵（非主线关）。
      const v = r.view;
      this.prebattleInfoLabel.string = this.corridorPrepInfoText(this.corridorPrepLayer, v.playerPower);
      this.drawCorridorEnemyPreview(g);
    } else {
      const v = r.view;
      const stage = v.stageType === 'boss' ? 'Boss' : v.stageType === 'elite' ? '精英' : '普通';
      const enemyBrief = v.hasEncounter ? `敌${v.enemyCount}${v.hasBoss ? '·含Boss' : ''}` : '暂无遭遇';
      const trend = v.playerPower >= v.recommendedPower ? '↑' : '↓';
      const bountyTag = this.bountyPrepCardId ? '【悬赏】' : '';
      this.prebattleInfoLabel.string =
        `${bountyTag}节点 ${v.nodeId}（${stage}）   敌情预览：${enemyBrief}\n我方战力 ${v.playerPower} ${trend}   VS   推荐战力 ${v.recommendedPower}`
        + this.bountyPrepAffixInfo(); // 块2：悬赏本场词缀全文（作用于对应定位型的我方单位）
      // 敌情预览色块：按敌人站位摆到上半区(坐标=fieldEnemyPos·战斗站位)。
      this.drawEnemyPreview(g, v);
    }

    // 九宫格（坐标 = fieldPlayerPos = 战斗站位）：空格画"+"、有船画蓝块+船/驾驶员；选中格高亮。
    const cell = this.fieldCell;
    for (let r2 = 0; r2 < 3; r2 += 1) {
      for (let c = 0; c < 3; c += 1) {
        const slotRef = `p${r2}c${c}`;
        const p = this.fieldPlayerPos(r2, c);
        const slot = this.slotOf(slotRef);
        const selected = this.prebattleSelSlot === slotRef;
        g.fillColor = slot ? new Color(60, 110, 170, 255) : new Color(30, 38, 56, 255);
        g.roundRect(p.x - cell / 2, p.y - cell / 2, cell, cell, 10);
        g.fill();
        if (selected) {
          g.strokeColor = new Color(255, 235, 130, 255); g.lineWidth = 4;
          g.roundRect(p.x - cell / 2, p.y - cell / 2, cell, cell, 10); g.stroke();
        }
        const lbl = this.prebattleCellLabels[r2 * 3 + c];
        if (lbl) {
          const s = slot ? `${this.unitName('ship', slot.shipId)}\n${this.pilotOf(slot.shipId) ? this.unitName('pilot', this.pilotOf(slot.shipId)!) : '缺员'}` : '+';
          if (lbl.string !== s) lbl.string = s; // 复验批：文本守卫（九宫格逐格重设会白付 9 次排版）
        }
      }
    }
    const perfCost = Date.now() - perfT0;
    if (perfCost >= 8) console.log(`[PERF][DEV-TEMP] 备战 refresh ${perfCost}ms`);
  }

  /** 某船的装配概要（3槽插件 + 星核），多行短文。按船读 shipLoadouts。 */
  private loadoutSummaryText(shipId: string): string {
    const loadout = this.squad ? this.squad.shipLoadouts[shipId] : undefined;
    const tags: S7PluginSlot[] = ['weapon', 'skill', 'tactical'];
    const lines = tags.map((t) => {
      const inst = this.equippedInSlotType(shipId, t);
      const v = inst ? `${inst.pluginId}·${S7_QUALITY_NAMES[inst.quality] ?? inst.quality}` : '空';
      return `${S7_SLOT_TAG_NAMES[t]}槽 ${v}`;
    });
    lines.push(`星核 ${loadout?.coreId ?? '空'}`);
    return lines.join('\n');
  }

  /** 敌情预览：敌方区（红=普通敌·紫=Boss）。坐标 = fieldEnemyPos（与战斗一致·上下与九宫格对称）。占位，美术阶段换皮。 */
  private drawEnemyPreview(g: Graphics, v: S7PrebattleView): void {
    for (const e of v.enemies) {
      const m = /^r(\d)c(\d)$/.exec(e.slotRef);
      if (!m) continue;
      const p = this.fieldEnemyPos(Number(m[1]), Number(m[2]));
      const sz = e.isBoss ? 46 : 30;
      g.fillColor = e.isBoss ? new Color(200, 90, 205, 255) : new Color(230, 110, 80, 255);
      g.rect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      g.fill();
    }
  }

  /** 找居中局部坐标最近的九宫格格子(就近吸附·容错)；落点离最近格太远(不在九宫格区)则返回 null。 */
  private cellAtLocal(x: number, y: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const p = this.fieldPlayerPos(r, c);
        const d = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y);
        if (d < bestD) { bestD = d; best = `p${r}c${c}`; }
      }
    }
    const reach = this.viewW * 0.22; // 容错半径(约一个格距)
    return best && bestD <= reach * reach ? best : null;
  }

  /** 格子触摸结束：松手落点在别的格 → 拖动(有船则 移动/互换)；落点同格/格外 → 点击进上阵界面。
   *  坐标换算不依赖 convertToNodeSpaceAR：UI 设计坐标(原点左下) → 居中坐标(与 fieldPlayerPos 同空间)。 */
  private onCellTouchEnd(startSlot: string, e: EventTouch): void {
    const loc = e.getUILocation();
    const lx = loc.x - this.viewW / 2;
    const ly = loc.y - this.viewH / 2;
    const target = this.cellAtLocal(lx, ly) ?? startSlot;
    if (this.squad && target !== startSlot && this.slotOf(startSlot)) {
      moveOrSwapFormationSlot(this.squad, startSlot, target); // 拖动：有船→移动/互换
      this.saveGameplayLineup(); // ③b：换位后存进当前玩法阵容记忆
      this.persist();
      this.refreshPrebattle();
    } else {
      this.onSelectPrebattleSlot(startSlot); // 点击：进上阵界面
    }
  }

  /** 点九宫格：把该格设为上场目标格 → 弹「上阵界面」。有船的格连带选中那艘船(右侧直接显示)；空格不选船(右侧空白)。 */
  private onSelectPrebattleSlot(slotRef: string): void {
    this.prebattleSelSlot = slotRef;
    const slot = this.slotOf(slotRef);
    this.prebattleSelShip = slot ? slot.shipId : null;
    this.openBoarding();
  }

  /** 上阵界面左侧点星舰：选中它（右侧显示信息+按钮）；不直接上场。 */
  private onBoardingPickShip(shipId: string): void {
    this.prebattleSelShip = shipId;
    this.refreshBoarding();
  }

  /** 上场/下场切换：选中船在场→下场(清其格)；不在场→上场到选中格(无选中格则提示)。 */
  private onToggleBoard(): void {
    if (!this.squad || !this.prebattleSelShip) {
      this.setPrebattleInfo('⚠ 先在左侧点选一艘星舰');
      return;
    }
    const ship = this.prebattleSelShip;
    const wasDeployed = isShipDeployed(this.squad, ship);
    if (wasDeployed) {
      const cell = this.squad.formation.find((s) => s.shipId === ship)?.slotRef;
      if (cell) clearSlot(this.squad, cell); // 下场（驾驶员/装备跟船记忆保留）
    } else {
      if (!this.prebattleSelSlot) {
        this.setPrebattleInfo('⚠ 先选一个格子，才能让这艘船上场');
        return;
      }
      assignSlot(this.squad, this.prebattleSelSlot, ship, null); // 上场（保留本舰已记忆的驾驶员）
    }
    this.saveGameplayLineup(); // ③b：把本次编队改动存进当前玩法的阵容记忆
    this.persist();
    this.refreshPrebattle();
    // ③a（真机修复批·Ron 2026-07-05）：上场后底部「上阵界面」自动收起；下场保持开着可继续调阵。
    if (wasDeployed) this.refreshBoarding();
    else this.closeBoarding();
  }

  /** 备战信息行提示（橙色警示）。 */
  private setPrebattleInfo(text: string): void {
    if (this.prebattleInfoLabel) { this.prebattleInfoLabel.string = text; this.prebattleInfoLabel.color = new Color(240, 200, 120); }
  }

  // ===== 上阵界面（点九宫格弹出·下半部分）=====

  /** 搭上阵界面（默认隐藏·下半 sheet·上半透出敌情预览）：左=拥有星舰列表(刷新重建) / 右=详情+装配+上下场 / 底部中=返回。
   *  点上半空白(sheet 外) = 返回。 */
  private buildBoardingPanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const sheetTop = 0;                       // 上沿=中线（上半留给敌情预览）
    const sheetBot = band.usableBottomY;      // 下沿=安全区底
    const panel = new Node('S7Boarding'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform); ut.setContentSize(W, H);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(6, 9, 18, 120); g.rect(-W / 2, sheetTop, W, H / 2); g.fill();           // 上半淡遮罩
    g.fillColor = new Color(14, 18, 30, 255); g.roundRect(-W * 0.47, sheetBot, W * 0.94, sheetTop - sheetBot, 16); g.fill(); // 下半 sheet
    panel.active = false; this.boardingNode = panel;
    // 点 sheet 外(上半)空白 = 返回；sheet 内不返回（背板兄弟节点接管·正确处理冒泡）。
    this.addModalDismiss(panel, () => this.closeBoarding(), W * 0.94, sheetTop - sheetBot, 0, (sheetTop + sheetBot) / 2);

    // 标题
    const tN = new Node('bt'); tN.layer = this.node.layer; panel.addChild(tN); tN.setPosition(-W * 0.24, sheetTop - 40, 0);
    const tl = tN.addComponent(Label); tl.fontSize = 30; tl.lineHeight = 38; tl.color = new Color(255, 220, 140); tl.string = '上阵 — 选星舰';

    // 左侧拥有星舰列表容器（刷新重建）；拖动滚动（07-15 反馈③）。
    const listN = new Node('bList'); listN.layer = this.node.layer; panel.addChild(listN); listN.setPosition(0, 0, 0);
    this.boardingShipListNode = listN;
    this.attachVScroll(panel, listN, () => this.boardingScrollMax);

    // 右侧详情 + 操作（装配/上下场）。
    const dN = new Node('bd'); dN.layer = this.node.layer; panel.addChild(dN); dN.setPosition(W * 0.24, sheetTop - 120, 0);
    this.boardingDetailLabel = dN.addComponent(Label); this.boardingDetailLabel.fontSize = 24; this.boardingDetailLabel.lineHeight = 32; this.boardingDetailLabel.color = new Color(220, 230, 250);
    // #2：详情多行（船名/战力/驾驶员/装配概要）锚进右侧详情框，超长自动缩。
    this.labelBox(this.boardingDetailLabel).setContentSize(W * 0.44, 230);
    this.boardingDetailLabel.overflow = Label.Overflow.SHRINK;
    this.boardingDetailLabel.enableWrapText = true;
    const actions = new Node('bActions'); actions.layer = this.node.layer; panel.addChild(actions); actions.setPosition(0, 0, 0);
    this.boardingActionsNode = actions;
    // 巡检批 #15：原两键 200 宽 @0.16W/0.32W 热区重叠 80px → 缩窄拉开（间距 ≥8px）。
    this.boardingEquipBtn = this.addBtn(actions, '装配', 170, 80, new Color(70, 130, 110, 255), W * 0.09, sheetBot + H * 0.13, () => this.openLoadout(), 30).node.parent;
    this.boardingBoardBtnLabel = this.addBtn(actions, '上场', 170, 80, new Color(90, 110, 160, 255), W * 0.335, sheetBot + H * 0.13, () => this.onToggleBoard(), 30);
    this.boardingBoardBtn = this.boardingBoardBtnLabel.node.parent;

    // 底部中间「返回」。
    this.addBtn(panel, '返回', 240, 84, new Color(120, 90, 160, 255), 0, sheetBot + 56, () => this.closeBoarding(), 32);
  }

  private openBoarding(): void {
    if (this.playing || !this.boardingNode) return;
    this.refreshBoarding();
    this.boardingNode.active = true;
    this.raiseTutorialHintIfActive(); // M2：上阵面板打开后把交互提示条抬到最前
  }
  private closeBoarding(): void {
    if (this.boardingNode) this.boardingNode.active = false;
    this.refreshPrebattle();
  }

  /** 刷新上阵界面：左侧拥有星舰(上阵靠前→战力高靠前)重建 + 右侧详情/按钮(按选中船)。 */
  private refreshBoarding(): void {
    if (!this.squad || !this.boardingShipListNode) return;
    const band = getS7UsableBand();
    const W = this.viewW, H = this.viewH;
    const list = this.boardingShipListNode;
    list.removeAllChildren();
    list.setPosition(0, 0, 0); // 重建回顶
    this.boardingShipRowBtns.clear();
    // 排序：① 当前格上的船最前 → ② 上阵的靠前 → ③ 战力高靠前。
    const cellShip = this.prebattleSelSlot ? this.slotOf(this.prebattleSelSlot)?.shipId ?? null : null;
    const ships = this.squad.ownedShips.slice().sort((a, b) => {
      if (a === cellShip && b !== cellShip) return -1;
      if (b === cellShip && a !== cellShip) return 1;
      const da = isShipDeployed(this.squad!, a) ? 1 : 0;
      const db = isShipDeployed(this.squad!, b) ? 1 : 0;
      if (da !== db) return db - da;
      return this.shipPower(b) - this.shipPower(a);
    });
    const bw = W * 0.40, bh = 76;
    let y = -H * 0.06;
    // 滚动上限：最低一行要能抬到底部安全区之上（07-15 反馈③）
    this.boardingScrollMax = Math.max(0, (band.usableBottomY + 150) - (-H * 0.06 - (ships.length - 1) * (bh + 10)));
    for (const shipId of ships) {
      const deployed = isShipDeployed(this.squad, shipId);
      const sel = this.prebattleSelShip === shipId;
      const label = `${this.unitName('ship', shipId)}（战力${this.shipPower(shipId)}）${deployed ? '·已上场' : ''}`;
      const col = sel ? new Color(70, 130, 95, 255) : deployed ? new Color(45, 95, 75, 255) : new Color(55, 95, 150, 255);
      const row = this.addBtn(list, label, bw, bh, col, -W * 0.24, y, () => this.onBoardingPickShip(shipId), 24);
      this.boardingShipRowBtns.set(shipId, row.node.parent as Node);
      y -= bh + 10;
    }
    // 右侧详情 + 操作。
    const ship = this.prebattleSelShip;
    if (this.boardingDetailLabel) {
      if (ship) {
        const deployed = isShipDeployed(this.squad, ship);
        const where = deployed ? `在场 ${this.squad.formation.find((s) => s.shipId === ship)?.slotRef}` : '未上场';
        this.boardingDetailLabel.string = `星舰 ${this.unitName('ship', ship)}（${where}）\n战力 ${this.shipPower(ship)}\n驾驶员 ${this.pilotOf(ship) ? this.unitName('pilot', this.pilotOf(ship)!) : '缺员'}\n${this.loadoutSummaryText(ship)}`;
      } else {
        this.boardingDetailLabel.string = '← 左侧选一艘星舰';
      }
    }
    if (this.boardingActionsNode) this.boardingActionsNode.active = !!ship;
    if (this.boardingBoardBtnLabel) this.boardingBoardBtnLabel.string = ship && isShipDeployed(this.squad, ship) ? '下场' : '上场';
  }

  /** 单舰战力（占位·与备战总战力同口径·上阵列表排序/显示用）。 */
  private shipPower(shipId: string): number {
    if (!this.squad) return 0;
    return shipPowerOf(this.growthBands, this.squad, shipId, this.playerState?.unitLevels, this.pluginInventory ?? undefined, this.playerState?.unitTiers);
  }

  // ===== B 块 单舰装配面板（驾驶员 + 插件分三类 + 星核，统称"装备"；点装备→详情弹窗→装/卸/移动）=====

  /**
   * 给"卡片/半屏类"浮层加「点卡片外空白=关」。正确处理 Cocos 触摸冒泡：
   *   - 全屏背板(兄弟节点·最底)接管关闭：点空白命中它 → onClose。
   *   - 卡片区吸收节点(在背板之上)：点卡片内 → 命中它(空操作)，事件冒泡到 panel 根(无关闭)，不会触达背板。
   *   - 内容(按钮/列表)随后 addChild → 在最上；其点击冒泡到 panel 根(无关闭)，也不触达背板（背板非其祖先）。
   * ⚠️ 必须在「加内容之前」调用；且 panel 根不要再挂关闭监听。
   */
  private addModalDismiss(panel: Node, onClose: () => void, cardW: number, cardH: number, cardX = 0, cardY = 0): void {
    const back = new Node('backdrop'); back.layer = this.node.layer; panel.addChild(back); back.setPosition(0, 0, 0);
    const bu = back.addComponent(UITransform); bu.setContentSize(this.viewW, this.viewH);
    back.on(Node.EventType.TOUCH_END, () => { if (this.scrollDragging) return; onClose(); }, this); // 滚动拖出卡片松手≠点空白关（07-15 反馈③）
    const card = new Node('cardAbsorb'); card.layer = this.node.layer; panel.addChild(card); card.setPosition(cardX, cardY, 0);
    const cu = card.addComponent(UITransform); cu.setContentSize(cardW, cardH);
    card.on(Node.EventType.TOUCH_END, () => {}, this);
  }

  /** B0.6 #14 弹窗按钮组统一孔位（巡检批抽取·唯一真源）：1键居中 / 2键左右对称等分 / 3键等分一行。
   *  语义位置铁律：主行动/确认恒右（单键居中）、取消/返回恒左。今后弹窗按钮组一律走本孔位，禁止手摆坐标。 */
  private dialogBtnRowXs(count: number): number[] {
    const W = this.viewW;
    if (count <= 1) return [0];
    if (count === 2) return [-W * 0.21, W * 0.21];
    return [-W * 0.30, 0, W * 0.30];
  }

  /** B0.6 #14 弹窗两键（等宽等高·对称等分·次要/取消左 + 主行动右）。返回 [左Label, 右Label]。 */
  private addDialogBtnPair(
    parent: Node, leftText: string, leftColor: Color, onLeft: () => void,
    rightText: string, rightColor: Color, onRight: () => void,
    y: number, w = 240, h = 88, fontSize = 30,
  ): [Label, Label] {
    const xs = this.dialogBtnRowXs(2);
    return [
      this.addBtn(parent, leftText, w, h, leftColor, xs[0], y, onLeft, fontSize),
      this.addBtn(parent, rightText, w, h, rightColor, xs[1], y, onRight, fontSize),
    ];
  }

  /** 通用按钮：父节点 + 文字 + 尺寸/色/位置 + 回调，返回 Label（便于动态改字）。 */
  private addBtn(parent: Node, text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void, fontSize = 28): Label {
    const n = new Node('btn'); n.layer = this.node.layer; parent.addChild(n); n.setPosition(x, y, 0);
    const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
    const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
    const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
    const l = ln.addComponent(Label); l.fontSize = fontSize; l.lineHeight = Math.round(fontSize * 1.25); l.color = new Color(255, 255, 255); l.string = text;
    n.on(Node.EventType.TOUCH_END, () => { if (this.scrollDragging) return; onTap(); }, this); // 拖动滚动后松手不误触（07-15 反馈③）
    return l;
  }

  // ===== 手搓列表拖动滚动（07-15 Ron 反馈③：内容超一屏的页面要能上下滑看全）=====

  /** 本次触摸是否已构成拖动（各按钮回调据此吞掉"拖完松手"的误点击）。 */
  private scrollDragging = false;

  /** 给"内容超一屏"的手搓列表加拖动滚动：拖 touchArea 时把 content 在 y∈[0,maxScroll()] 里平移。
   *  maxScroll 用闭包=列表行数随刷新变；触摸累计位移 >12px 才算拖（保住普通点击）。 */
  private attachVScroll(touchArea: Node, content: Node, maxScroll: () => number): void {
    let lastY = 0;
    let startY = 0;
    touchArea.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      lastY = e.getUILocation().y;
      startY = lastY;
      this.scrollDragging = false;
    }, this);
    touchArea.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      const yNow = e.getUILocation().y;
      const dy = yNow - lastY;
      lastY = yNow;
      if (Math.abs(yNow - startY) > 12) this.scrollDragging = true;
      const max = Math.max(0, maxScroll());
      if (max <= 0) return; // 内容不满一屏=不滚
      const ny = Math.min(max, Math.max(0, content.position.y + dy));
      content.setPosition(content.position.x, ny, 0);
    }, this);
  }

  /** 装配面板：标题 + 提示 + 装备列表容器(刷新重建) + 关闭；并搭 详情/移动确认 两弹窗。 */
  private buildLoadoutPanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const panel = new Node('S7Loadout'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics); g.fillColor = new Color(10, 14, 26, 252); g.rect(-W / 2, -H / 2, W, H); g.fill();
    const put = panel.addComponent(UITransform); put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 满屏浮层：吞触摸·不点空白关(只用「关闭」键)
    panel.active = false; this.loadoutNode = panel;

    const titleN = new Node('loTitle'); titleN.layer = this.node.layer; panel.addChild(titleN); titleN.setPosition(0, band.usableTopY - 46, 0);
    this.loadoutTitleLabel = titleN.addComponent(Label); this.loadoutTitleLabel.fontSize = 42; this.loadoutTitleLabel.lineHeight = 50; this.loadoutTitleLabel.color = new Color(255, 230, 120);
    const msgN = new Node('loMsg'); msgN.layer = this.node.layer; panel.addChild(msgN); msgN.setPosition(0, band.usableTopY - 98, 0);
    this.loadoutMsgLabel = msgN.addComponent(Label); this.loadoutMsgLabel.fontSize = 24; this.loadoutMsgLabel.lineHeight = 30; this.loadoutMsgLabel.color = new Color(190, 205, 230);

    const listN = new Node('loList'); listN.layer = this.node.layer; panel.addChild(listN); listN.setPosition(0, 0, 0);
    this.loadoutListNode = listN;

    // 底部：一键卸装(左) / 关闭(中) / 一键装配(右)。
    this.addBtn(panel, '一键卸装', 230, 84, new Color(125, 80, 80, 255), -W * 0.30, band.usableBottomY + 56, () => this.onLoadoutUnequipAll(), 30);
    const back = this.addBtn(panel, '返回', 200, 84, new Color(120, 90, 160, 255), 0, band.usableBottomY + 56, () => this.closeLoadout(), 30);
    this.loadoutBackBtn = back.node.parent;
    this.addBtn(panel, '一键装配', 230, 84, new Color(70, 140, 110, 255), W * 0.30, band.usableBottomY + 56, () => this.onLoadoutAutoEquip(), 30);

    this.buildEquipDetailPopup(W, H);
    this.buildEquipConfirmPopup(W, H);
  }

  /** 装备详情弹窗（点装备弹出）：标题 + 信息 + 取消(左) + 主操作(右·装备/卸下)。 */
  private buildEquipDetailPopup(W: number, H: number): void {
    const panel = new Node('S7EquipDetail'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform); ut.setContentSize(W, H);
    const g = panel.addComponent(Graphics); g.fillColor = new Color(6, 9, 18, 200); g.rect(-W / 2, -H / 2, W, H); g.fill(); // 半透明遮罩吞触摸
    g.fillColor = new Color(18, 24, 40, 255); g.roundRect(-W * 0.42, -H * 0.15, W * 0.84, H * 0.30, 16); g.fill();
    panel.active = false; this.equipDetailNode = panel;
    this.addModalDismiss(panel, () => this.closeEquipDetail(), W * 0.84, H * 0.30, 0, 0); // 点卡片外 = 取消
    const tN = new Node('t'); tN.layer = this.node.layer; panel.addChild(tN); tN.setPosition(0, H * 0.105, 0);
    this.equipDetailTitle = tN.addComponent(Label); this.equipDetailTitle.fontSize = 38; this.equipDetailTitle.lineHeight = 46; this.equipDetailTitle.color = new Color(255, 230, 120);
    const iN = new Node('i'); iN.layer = this.node.layer; panel.addChild(iN); iN.setPosition(0, 0, 0);
    this.equipDetailInfo = iN.addComponent(Label); this.equipDetailInfo.fontSize = 28; this.equipDetailInfo.lineHeight = 38; this.equipDetailInfo.color = new Color(215, 225, 245);
    // B0.6 #14：取消左 / 主操作右，统一孔位。
    const [, equipAction] = this.addDialogBtnPair(
      panel, '取消', new Color(110, 90, 150, 255), () => this.closeEquipDetail(),
      '装备', new Color(70, 140, 110, 255), () => this.onEquipDetailAction(), -H * 0.11, 240, 88, 32,
    );
    this.equipDetailActionLabel = equipAction;
    this.equipDetailActionBtn = this.equipDetailActionLabel.node.parent;
  }

  /** 移动确认弹窗（装备已在别船时二次确认）：文案 + 取消(左) + 确认(右)。 */
  private buildEquipConfirmPopup(W: number, H: number): void {
    const panel = new Node('S7EquipConfirm'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform); ut.setContentSize(W, H);
    const g = panel.addComponent(Graphics); g.fillColor = new Color(6, 9, 18, 210); g.rect(-W / 2, -H / 2, W, H); g.fill();
    g.fillColor = new Color(22, 18, 30, 255); g.roundRect(-W * 0.42, -H * 0.13, W * 0.84, H * 0.26, 16); g.fill();
    panel.active = false; this.equipConfirmNode = panel;
    this.addModalDismiss(panel, () => this.closeEquipConfirm(), W * 0.84, H * 0.26, 0, 0); // 点卡片外 = 取消
    const cN = new Node('c'); cN.layer = this.node.layer; panel.addChild(cN); cN.setPosition(0, H * 0.045, 0);
    this.equipConfirmLabel = cN.addComponent(Label); this.equipConfirmLabel.fontSize = 28; this.equipConfirmLabel.lineHeight = 38; this.equipConfirmLabel.color = new Color(230, 220, 245);
    // B0.6 #14：取消左 / 确认右，统一孔位。
    this.addDialogBtnPair(
      panel, '取消', new Color(110, 90, 150, 255), () => this.closeEquipConfirm(),
      '确认', new Color(200, 140, 60, 255), () => this.onEquipConfirmMove(), -H * 0.09, 240, 88, 32,
    );
  }

  /** 开装配面板：须先选中一艘星舰（在场或不在场均可，装配按船记忆）。 */
  private openLoadout(): void {
    if (this.playing || !this.loadoutNode || !this.squad) return;
    if (!this.prebattleSelShip) { this.setPrebattleInfo('⚠ 先在下方点选一艘星舰，再点「装配」'); return; }
    this.setLoadoutMsg('点任一装备 → 弹详情 → 装/卸；标记：★本舰 / ▶在别船 / 未装', new Color(190, 205, 230));
    this.refreshLoadout();
    // 置顶：从船坞(后建浮层)进装配时，确保装配面板盖在最上面。
    const parent = this.loadoutNode.parent;
    if (parent) this.loadoutNode.setSiblingIndex(parent.children.length - 1);
    this.loadoutNode.active = true;
    this.raiseTutorialHintIfActive(); // M2：装配面板打开后把交互提示条抬到最前
  }

  private closeLoadout(): void {
    if (this.equipDetailNode) this.equipDetailNode.active = false;
    if (this.equipConfirmNode) this.equipConfirmNode.active = false;
    if (this.loadoutNode) this.loadoutNode.active = false;
    this.refreshBoarding(); // 装配从上阵界面打开 → 关掉回上阵界面，刷新详情/列表
    this.refreshPrebattle();
  }

  private setLoadoutMsg(text: string, color: Color): void {
    if (this.loadoutMsgLabel) { this.loadoutMsgLabel.string = text; this.loadoutMsgLabel.color = color; }
  }

  /** 刷新装配列表：三段（驾驶员 / 插件按武器·技能·战术 / 星核），每段内"已装备靠前 + 品质高靠前"，每项标"装在哪艘船"。重建列表节点。 */
  private refreshLoadout(): void {
    const ship = this.prebattleSelShip;
    if (!ship || !this.squad || !this.loadoutListNode) { this.closeLoadout(); return; }
    // 顶部标题带实时战力（refreshLoadout 在每次装/卸后都调 → 随装备实时变）。
    if (this.loadoutTitleLabel) this.loadoutTitleLabel.string = `装配 — ${ship}　战力 ${this.shipPower(ship)}`;
    const list = this.loadoutListNode;
    list.removeAllChildren();
    this.loadoutItemBtns.clear();
    const W = this.viewW;
    const band = getS7UsableBand();
    // 调大 + 往下铺开（别堆顶部）：大格、大字、段间留白。
    const w = W * 0.30, h = 90, gx = W * 0.315;
    let y = band.usableTopY - 128;

    const header = (txt: string, color = new Color(255, 220, 140), advance = 56): void => {
      const n = new Node('h'); n.layer = this.node.layer; list.addChild(n); n.setPosition(-W * 0.40, y, 0);
      const l = n.addComponent(Label); l.fontSize = 30; l.lineHeight = 38; l.color = color; l.string = txt;
      y -= advance;
    };
    // 排序：① 装在"本舰"的最前 → ② 装在(任意船)的次之 → ③ 战力(sortKey·插件=品质·越高越前)。
    const placeItems = (items: { ref: S7EquipRef; top: string; sortKey?: number }[]): void => {
      const sorted = items.slice().sort((a, b) => {
        const sa = this.equipShipOf(a.ref); const sb = this.equipShipOf(b.ref);
        const ca = sa === ship ? 1 : 0; const cb = sb === ship ? 1 : 0;
        if (ca !== cb) return cb - ca;                 // ① 本舰靠前
        const ea = sa ? 1 : 0; const eb = sb ? 1 : 0;
        if (ea !== eb) return eb - ea;                 // ② 已装备(任意船)靠前
        return (b.sortKey ?? 0) - (a.sortKey ?? 0);    // ③ 战力(品质)高靠前
      });
      sorted.forEach((it, i) => {
        const c = i % 3; const r = Math.floor(i / 3);
        const x = (c - 1) * gx;
        const onShip = this.equipShipOf(it.ref);
        const marker = onShip === ship ? '★本舰' : onShip ? `▶${onShip}` : '未装';
        const col = onShip === ship ? new Color(55, 130, 95, 255) : onShip ? new Color(125, 100, 55, 255) : new Color(55, 95, 150, 255);
        const btn = this.addBtn(list, `${it.top}\n${marker}`, w, h, col, x, y - r * (h + 16), () => this.openEquipDetail(it.ref), 26);
        this.loadoutItemBtns.set(`${it.ref.kind}:${it.ref.id}`, btn.node.parent as Node);
      });
      y -= (Math.ceil(sorted.length / 3) || 1) * (h + 16) + 22;
    };

    // ① 驾驶员（暂无品质/等级 → 仅"已装备靠前"）
    header('驾驶员');
    placeItems(this.squad.ownedPilots.map((id) => ({ ref: { kind: 'pilot' as const, id }, top: id })));
    // ② 插件（按 武器/技能/战术 分；每类内 品质越高越靠前）
    header('插件（武器 / 技能 / 战术）');
    const plugins = this.pluginInventory ? this.pluginInventory.plugins : [];
    (['weapon', 'skill', 'tactical'] as S7PluginSlot[]).forEach((tag) => {
      const group = plugins.filter((p) => this.pluginSlotMap.get(p.pluginId) === tag);
      header(`· ${S7_SLOT_TAG_NAMES[tag]}`, new Color(170, 200, 235), 50);
      if (group.length === 0) { y -= 10; return; }
      placeItems(group.map((p) => ({
        ref: { kind: 'plugin' as const, id: p.instanceId },
        top: `${p.pluginId}·${S7_QUALITY_NAMES[p.quality] ?? p.quality}`,
        sortKey: S7_QUALITY_RANK[p.quality] ?? 0,
      })));
    });
    // ③ 星核（暂无品质/等级 → 仅"已装备靠前"）
    header('星核（现仅陨星弹有效果）');
    placeItems(Object.keys(this.squad.ownedCores).map((coreId) => ({
      ref: { kind: 'core' as const, id: coreId },
      top: `${coreId}${coreBlocks(coreId).length > 0 ? '·有效果' : '·占位'}`,
    })));
  }

  // ----- 装备通用：查在哪艘船 / 显示名 / 装 / 卸 -----
  private equipShipOf(ref: S7EquipRef): string | null {
    if (!this.squad) return null;
    if (ref.kind === 'pilot') return findPilotShip(this.squad, ref.id);
    if (ref.kind === 'core') return findCoreShip(this.squad, ref.id);
    return findPluginShip(this.squad, ref.id);
  }
  private equipDisplayName(ref: S7EquipRef): string {
    if (ref.kind === 'pilot') return `驾驶员 ${ref.id}`;
    if (ref.kind === 'core') return `星核 ${ref.id}（${coreBlocks(ref.id).length > 0 ? '有战斗质变' : '效果占位·待做'}）`;
    const inst = this.pluginInventory ? findOwnedPlugin(this.pluginInventory, ref.id) : undefined;
    if (!inst) return `插件 ${ref.id}`;
    const tagZh = S7_SLOT_TAG_NAMES[this.pluginSlotMap.get(inst.pluginId) ?? 'weapon'] ?? '?';
    return `插件 ${inst.pluginId}（${tagZh}槽·${S7_QUALITY_NAMES[inst.quality] ?? inst.quality}）`;
  }
  private doEquip(ref: S7EquipRef, shipId: string): { ok: true } | { ok: false; code: string } {
    if (!this.squad) return { ok: false, code: 'not_owned_ship' };
    if (ref.kind === 'pilot') return equipPilot(this.squad, shipId, ref.id);
    // J 升阶开槽 gating：星核槽 S 阶才开；插件槽数按阶级 C=1/B=2/A=3。
    const tier = this.playerState ? getShipTier(this.playerState.unitTiers, shipId) : 0;
    if (ref.kind === 'core') {
      if (!shipCoreSlotOpen(tier)) return { ok: false, code: 'core_locked' };
      return equipCore(this.squad, shipId, ref.id);
    }
    if (!this.pluginInventory) return { ok: false, code: 'not_owned_plugin' };
    if (this.pluginEquipExceedsTier(shipId, ref.id, tier)) return { ok: false, code: 'slot_locked' };
    return equipPlugin(this.squad, this.pluginInventory, shipId, ref.id, this.pluginSlotOf);
  }

  /** 装这件插件会不会超过该阶插件槽上限（已在本舰 / 替换同类槽 → 不增不超；否则看是否已达 cap）。 */
  private pluginEquipExceedsTier(shipId: string, instanceId: string, tier: number): boolean {
    if (!this.pluginInventory) return false;
    const cap = shipPluginSlotCap(tier);
    const ids = this.squad?.shipLoadouts[shipId]?.pluginInstanceIds ?? [];
    if (ids.includes(instanceId)) return false; // 已在本舰·不增
    const inst = findOwnedPlugin(this.pluginInventory, instanceId);
    const slotTag = inst ? this.pluginSlotMap.get(inst.pluginId) : undefined;
    const sameType = ids.some((id) => { const o = findOwnedPlugin(this.pluginInventory!, id); return !!o && this.pluginSlotMap.get(o.pluginId) === slotTag; });
    if (sameType) return false; // 替换同类槽·不增
    return ids.length >= cap; // 会新增 → 达上限即超
  }
  private doUnequip(ref: S7EquipRef, shipId: string): void {
    if (!this.squad) return;
    if (ref.kind === 'pilot') unequipPilot(this.squad, shipId);
    else if (ref.kind === 'core') unequipCore(this.squad, shipId);
    else unequipPlugin(this.squad, shipId, ref.id);
  }

  /** 本舰在该装备对应"部位"上是否已有装备（用于"互换/移来"文案判断）。 */
  private currentShipHasSlotOccupant(ref: S7EquipRef): boolean {
    const ship = this.prebattleSelShip;
    const lo = ship && this.squad ? this.squad.shipLoadouts[ship] : undefined;
    if (!lo) return false;
    if (ref.kind === 'pilot') return !!lo.pilotId;
    if (ref.kind === 'core') return !!lo.coreId;
    const inst = this.pluginInventory ? findOwnedPlugin(this.pluginInventory, ref.id) : undefined;
    const tag = inst ? this.pluginSlotMap.get(inst.pluginId) : undefined;
    return !!tag && !!this.equippedInSlotType(ship!, tag);
  }

  /** 一键卸装：把本舰的 驾驶员 + 星核 + 全部插件 卸下。 */
  private onLoadoutUnequipAll(): void {
    const ship = this.prebattleSelShip;
    if (!this.squad || !ship) return;
    unequipPilot(this.squad, ship);
    unequipCore(this.squad, ship);
    const lo = this.squad.shipLoadouts[ship];
    if (lo) for (const id of lo.pluginInstanceIds.slice()) unequipPlugin(this.squad, ship, id);
    this.setLoadoutMsg('已一键卸装', new Color(200, 210, 235));
    this.persist();
    this.refreshLoadout();
  }

  /** 一键装配：本舰每个空部位，装上该类"空闲装备"里战力最高的（插件按品质·驾驶员/星核取第一个空闲）。 */
  private onLoadoutAutoEquip(): void {
    const ship = this.prebattleSelShip;
    if (!this.squad || !ship) return;
    const sq = this.squad;
    // J 升阶开槽 gating：按阶级算插件槽上限 + 星核槽是否开。
    const tier = this.playerState ? getShipTier(this.playerState.unitTiers, ship) : 0;
    const slotCap = shipPluginSlotCap(tier);
    // 驾驶员
    if (!sq.shipLoadouts[ship]?.pilotId) {
      const free = sq.ownedPilots.find((p) => !findPilotShip(sq, p));
      if (free) equipPilot(sq, ship, free);
    }
    // 星核（仅 S 阶起开槽）
    if (shipCoreSlotOpen(tier) && !sq.shipLoadouts[ship]?.coreId) {
      const free = Object.keys(sq.ownedCores).find((cid) => !findCoreShip(sq, cid));
      if (free) equipCore(sq, ship, free);
    }
    // 插件：空槽填该槽空闲插件里品质(战力)最高的·但总数不超过阶级槽上限。
    if (this.pluginInventory) {
      for (const tag of ['weapon', 'skill', 'tactical'] as S7PluginSlot[]) {
        if ((sq.shipLoadouts[ship]?.pluginInstanceIds.length ?? 0) >= slotCap) break; // 到阶级上限停
        if (this.equippedInSlotType(ship, tag)) continue; // 本舰该槽已有
        const best = this.pluginInventory.plugins
          .filter((p) => this.pluginSlotMap.get(p.pluginId) === tag && !findPluginShip(sq, p.instanceId))
          .sort((a, b) => (S7_QUALITY_RANK[b.quality] ?? 0) - (S7_QUALITY_RANK[a.quality] ?? 0))[0];
        if (best) equipPlugin(sq, this.pluginInventory, ship, best.instanceId, this.pluginSlotOf);
      }
    }
    this.setLoadoutMsg('已一键装配（空位填最优空闲装备）', new Color(160, 235, 160));
    this.persist();
    this.refreshLoadout();
  }

  /** 点某装备 → 弹详情：标题/信息 + 主操作按钮(装/卸·按是否已装、装在哪)。 */
  private openEquipDetail(ref: S7EquipRef): void {
    const ship = this.prebattleSelShip;
    if (!ship || !this.equipDetailNode) return;
    this.equipPending = ref;
    const onShip = this.equipShipOf(ref);
    let info = this.equipDisplayName(ref);
    if (onShip === ship) { this.equipActionMode = 'unequip'; info += `\n已装配在本舰`; }
    else if (onShip) { this.equipActionMode = 'move'; info += `\n已装配在 ${onShip} 星舰上`; }
    else { this.equipActionMode = 'equip'; info += `\n（未装配）`; }
    if (this.equipDetailTitle) this.equipDetailTitle.string = ref.kind === 'pilot' ? '驾驶员' : ref.kind === 'core' ? '星核' : '插件';
    if (this.equipDetailInfo) this.equipDetailInfo.string = info;
    if (this.equipDetailActionLabel) this.equipDetailActionLabel.string = this.equipActionMode === 'unequip' ? '卸下' : '装备';
    const edParent = this.equipDetailNode.parent;
    if (edParent) this.equipDetailNode.setSiblingIndex(edParent.children.length - 1);
    this.equipDetailNode.active = true;
    this.raiseTutorialHintIfActive();
  }
  private closeEquipDetail(): void { if (this.equipDetailNode) this.equipDetailNode.active = false; }

  /** 详情弹窗主操作：未装→直接装；已在别船→弹移动确认；在本舰→直接卸。 */
  private onEquipDetailAction(): void {
    const ref = this.equipPending; const ship = this.prebattleSelShip;
    if (!ref || !ship || !this.squad) return;
    if (this.equipActionMode === 'unequip') {
      this.doUnequip(ref, ship);
      this.setLoadoutMsg('已卸下', new Color(200, 210, 235));
      this.closeEquipDetail(); this.persist(); this.refreshLoadout();
      return;
    }
    if (this.equipActionMode === 'move') {
      // 已在别船 → 二次确认弹窗。本舰该位已有装备=互换；空位=移来。
      const from = this.equipShipOf(ref);
      const verb = this.currentShipHasSlotOccupant(ref) ? `与 ${from} 互换该位装备` : `从 ${from} 移到本舰`;
      if (this.equipConfirmLabel) this.equipConfirmLabel.string = `${this.equipDisplayName(ref)}\n将${verb}，确认？`;
      this.closeEquipDetail();
      if (this.equipConfirmNode) this.equipConfirmNode.active = true;
      return;
    }
    // 未装 → 直接装
    const r = this.doEquip(ref, ship);
    this.setLoadoutMsg(r.ok ? '已装备' : this.zhLoadoutErr(r.code), r.ok ? new Color(160, 235, 160) : new Color(235, 150, 150));
    this.closeEquipDetail(); this.persist(); this.refreshLoadout();
  }

  private closeEquipConfirm(): void { if (this.equipConfirmNode) this.equipConfirmNode.active = false; }

  /** 移动确认：装到本舰（唯一性自动从原船卸下）。 */
  private onEquipConfirmMove(): void {
    const ref = this.equipPending; const ship = this.prebattleSelShip;
    if (!ref || !ship || !this.squad) { this.closeEquipConfirm(); return; }
    const r = this.doEquip(ref, ship);
    this.setLoadoutMsg(r.ok ? '已移到本舰' : this.zhLoadoutErr(r.code), r.ok ? new Color(160, 235, 160) : new Color(235, 150, 150));
    this.closeEquipConfirm(); this.persist(); this.refreshLoadout();
  }

  /** 装配错误码 → 中文（仅显示）。 */
  private zhLoadoutErr(code: string): string {
    const map: Record<string, string> = {
      not_owned_ship: '未拥有该船',
      not_owned_pilot: '没有这个驾驶员',
      not_owned_plugin: '没有这个插件',
      unknown_plugin: '插件槽位未知',
      slot_type_occupied: '该类型插件槽已占（先卸下原件）',
      dup_plugin: '同名插件已装',
      too_many_plugins: '插件已满 3 个',
      not_owned_core: '没有这颗星核',
      slot_locked: '插件槽不够——升阶星舰解锁更多槽',
      core_locked: '星核槽未开——星舰升到 S 阶解锁',
    };
    return map[code] ?? code;
  }

  // ===== 选择关卡（graybox 跳关）=====
  private openLevelSelect(): void {
    if (this.playing || !this.levelSelectNode) return;
    this.levelSelectNode.active = true;
  }
  private closeLevelSelect(): void {
    if (this.levelSelectNode) this.levelSelectNode.active = false;
  }
  /** 选关：把进度设到该节点（前面节点记为已通→该关成为当前可打的"前沿"）→ 落盘 → 回备战界面刷新。
   *  ⚠️ graybox 跳关语义(设前沿)；正式主线地图的解锁/重打语义后面定。 */
  private onPickLevel(nodeId: string): void {
    if (!this.session) return;
    const m = /^n(\d+)$/.exec(nodeId);
    const num = m ? parseInt(m[1], 10) : 1;
    // 灰盒跳关：只「填空缺」让目标关可达，**绝不抹掉真实已通关记录**（否则重打已通的关会被当首通又发奖·Ron 反馈1b）。
    const gap: string[] = [];
    for (let i = 1; i < num; i += 1) gap.push(`n${String(i).padStart(3, '0')}`);
    const cleared = Array.from(new Set([...this.session.progress.clearedNodeIds, ...gap]));
    this.session.progress = { currentNodeId: nodeId, clearedNodeIds: cleared };
    this.persist();
    this.closeLevelSelect();
    this.prebattleSelSlot = null;
    this.refreshPrebattle();
    this.refresh();
  }

  /** 组装"上一战结果"文案（胜/重复挑战/败），回放结束后显示。同时存本战伤害统计供「伤害统计」按钮用（L 反馈4）。 */
  private composeResultText(nodeId: string, outcome: S7PlayNodeOutcome): { text: string; color: Color } {
    this.lastBattleSummary = summarizeS7BattleLog(outcome.battle.result); // L：胜负都存·供伤害统计浮层
    const players = outcome.battle.result.finalState.players;
    const totMax = players.reduce((s, u) => s + u.maxHp, 0);
    const totHp = players.reduce((s, u) => s + Math.max(0, u.hp), 0);
    const hpTag = `[全队残血 ${totMax > 0 ? Math.round((totHp / totMax) * 100) : 0}%]`;
    if (outcome.won && outcome.settlement && outcome.settlement.ok) {
      const tail = outcome.settlement.finished ? '（已通关最终节点）' : `→ 推进到 ${outcome.settlement.nextNodeId}`;
      const rescue = this.pendingRescueText ? `\n${this.pendingRescueText}` : ''; // K：主线救回人口
      // ③终稿(块2真机·Ron真机拍板)：奖励明细全在"三选一屏(唯一奖励屏)"展示，结算窗不再重复——只留 胜利+残血+推进(+救回人口)。
      return { text: `${nodeId} 胜！${hpTag} ${tail}${rescue}`, color: new Color(160, 235, 160) };
    }
    if (outcome.won) {
      return { text: `${nodeId} 胜（重复挑战，不再发奖）${hpTag}`, color: new Color(220, 210, 140) };
    }
    return {
      text: `${nodeId} 败：${this.zhHint(outcome.battle.summary.hintCode)} ${hpTag}\n→ 升级/调配后「再次挑战」（可看「伤害统计」）`,
      color: new Color(235, 150, 150),
    };
  }

  // ===== L·伤害统计浮层（胜负弹窗都可看·双方各伤害最高 5 个单位）=====

  /** 搭伤害统计浮层（默认隐藏·盖在结果弹窗之上）。 */
  private buildBattleStatsPanel(W: number, H: number): void {
    const panel = new Node('S7BattleStats'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 210); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.92, dh = H * 0.56;
    dim.fillColor = new Color(24, 28, 40, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 20); dim.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.battleStatsNode = panel;
    this.mkPanelLabel(panel, '📊 伤害统计（双方各 Top5）', 34, new Color(220, 226, 245), 0, dh * 0.40);
    const list = new Node('statsList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.battleStatsListNode = list;
    this.addBtn(panel, '返回', 220, 72, new Color(120, 90, 160, 255), 0, -dh * 0.40, () => { panel.active = false; }, 28);
  }

  private openBattleStats(): void {
    if (!this.battleStatsNode || !this.lastBattleSummary) return;
    const parent = this.battleStatsNode.parent;
    if (parent) this.battleStatsNode.setSiblingIndex(parent.children.length - 1); // 置顶(盖结果弹窗)
    this.battleStatsNode.active = true;
    this.refreshBattleStats();
  }

  /** 刷新伤害统计：我方(左) / 敌方(右) 各按伤害降序 top5。 */
  private refreshBattleStats(): void {
    const sum = this.lastBattleSummary;
    if (!sum || !this.battleStatsListNode) return;
    this.battleStatsListNode.removeAllChildren();
    const topY = this.viewH * 0.18;
    this.mkPanelLabel(this.battleStatsListNode, '— 我方 —', 26, new Color(140, 200, 255), -this.viewW * 0.22, topY);
    this.mkPanelLabel(this.battleStatsListNode, '— 敌方 —', 26, new Color(255, 170, 130), this.viewW * 0.22, topY);
    const row = (name: string, dmg: number, x: number, y: number, c: Color): void => {
      this.mkPanelLabel(this.battleStatsListNode!, `${name}\n${Math.round(dmg)}`, 22, c, x, y);
    };
    const player = sum.playerDamage.slice(0, 5);
    const enemy = sum.enemyDamage.slice(0, 5);
    for (let i = 0; i < 5; i += 1) {
      const y = topY - 70 - i * 78;
      if (player[i]) row(`${this.unitName('ship', player[i].unitId)}`, player[i].totalDamageDealt, -this.viewW * 0.22, y, new Color(200, 224, 248));
      if (enemy[i]) row(this.statsUnitName(enemy[i]), enemy[i].totalDamageDealt, this.viewW * 0.22, y, new Color(245, 214, 196));
    }
    if (player.length === 0 && enemy.length === 0) this.mkPanelLabel(this.battleStatsListNode, '（本战无伤害记录）', 24, new Color(160, 168, 188), 0, topY - 80);
  }

  /** 敌方单位显示名（灰盒·用敌情 statRef 兜底；正式名待内容铺量）。 */
  private statsUnitName(u: S7BattleUnitDamageSummary): string {
    return u.unitStatRef || u.unitId;
  }

  // ===== B2 回放驱动 =====

  /** 开播（就地·在备战界面演）：隐藏备战可交互 UI、亮「跳过」，从第 0 帧起逐帧推进（update 驱动）。 */
  private startPlayback(pb: S7BattlePlayback): void {
    if (!this.prebattleNode || !this.prebattleGfx) return;
    // Cocos 壳批：资源就绪走演出层（真皮肤/签名弹道/伤害数字）；未就绪落回色块。
    if (S7BattleFxLayer.assetsReady) {
      this.playback = pb;
      this.playing = false; // 旧 update 逐帧驱动关闭（演出层自驱）
      this.fxActive = true;
      if (!this.fxLayer) {
        this.fxLayer = S7BattleFxLayer.mount(this.prebattleNode);
        this.fxLayer.node.setSiblingIndex(0); // 压底板之上、pbUi/跳过/倍速按钮之下
      }
      this.fxLayer.node.active = true;
      if (this.prebattleUiNode) this.prebattleUiNode.active = false;
      if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = true;
      if (this.prebattleSpeedBtn) this.prebattleSpeedBtn.active = true;
      if (this.tutorialDevBarNode) this.tutorialDevBarNode.active = false; // 磨精批1：播放期藏 DEV 教程键（不脏画面·finishPlayback 恢复）
      this.prebattleGfx.clear(); // 底板交给演出层的背景板
      // 备战即战场（Ron 07-15 反馈①）：把备战格坐标（Cocos 局部·中心原点 y 上）
      // 归一化成 0-1（y 下）喂给演出层——玩家摆哪打哪，弹道爆点全随之。
      // 我方整体下移（Ron 07-15 二轮反馈③"战斗中位置太靠前"）：只在战斗映射时加，
      // 备战九宫格不动；相对阵型不变=备战即战场承诺仍成立（摆哪打哪指相对站位）。
      // 间距三调（Ron 07-15 真机："敌我靠太近了，敌方整体往上、我方往下"——批1 敌方下压
      // 0.09 在贴中线格位的真实敌配上过头〔预览样本未覆盖=自验盲区〕，敌回收至 0.02、我方再降 0.03）。
      const PLAYER_Y_SHIFT = 0.10;
      const ENEMY_Y_SHIFT = 0.02;
      this.computePositions(pb);
      const layoutOv: Record<string, { x: number; y: number }> = {};
      for (const u of pb.roster) {
        const p = this.posById.get(u.unitId);
        if (!p) continue;
        layoutOv[u.unitId] = {
          x: p.x / this.viewW + 0.5,
          y: 0.5 - p.y / this.viewH + (u.side === 'player' ? PLAYER_Y_SHIFT : ENEMY_Y_SHIFT),
        };
      }
      this.fxLayer.play(pb, (ref) => this.fxRefMap.get(ref) ?? { unitRef: '', roleTag: '' }, {
        speed: this.playbackSpeed,
        layout: layoutOv,
        onFinish: () => this.finishPlayback(),
        // 音效批：模型事件名=SfxEvent 战斗子集（未知名 adapter 静默兜底）
        onSfx: (e) => this.sound.playSfx(e as SfxEvent),
      });
      return;
    }
    this.fxActive = false;
    this.playback = pb;
    this.frameIdx = 0;
    this.stepClock = 0;
    // 每帧停留 = clamp(目标总时长/帧数, 下限, 上限)：放慢到能看清战斗过程（嫌慢可点倍速键）。占位·真机手感再调。
    this.stepSec = Math.max(0.18, Math.min(0.40, 7.5 / Math.max(1, pb.frames.length - 1)));
    this.computePositions(pb);
    // L 入场仪式：开战我方从屏幕下方平行飞入（~0.5s·情绪价值·不影响数值）。
    this.introSec = 0.5;
    this.introClock = 0;
    this.introYOffset = -this.viewH * 0.55;
    this.playing = true;
    if (this.prebattleUiNode) this.prebattleUiNode.active = false; // 无关 UI 滑出 → 当前界面变战场
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = true;
    if (this.prebattleSpeedBtn) this.prebattleSpeedBtn.active = true; // L 倍速键
    if (this.tutorialDevBarNode) this.tutorialDevBarNode.active = false; // 磨精批1：播放期藏 DEV 教程键
    this.drawFrame(pb.frames[0]);
  }

  /** 每帧推进回放（cc 自动调用）。 */
  update(dt: number): void {
    // 交互式强引导：闪烁高亮框 + 玩家在真实 UI 完成目标 → 收提示条、推进、派发下一步。
    this.tickTutorialFlash(dt);
    if (this.tutorialInteractiveGoal && this.isStrongGuideActive() && this.playerState) {
      let done = false;
      try { done = this.tutorialInteractiveGoal(); } catch { done = false; }
      if (done) {
        this.tutorialInteractiveGoal = null;
        this.hideTutorialHint();
        advanceStrongGuideStep(this.playerState.tutorial);
        this.persist();
        this.runTutorialStep();
      }
    }
    if (!this.playing || !this.playback) return;
    const frames = this.playback.frames;
    // L 入场仪式：先放我方滑入（不推进战斗帧），完成后再正常逐帧。
    if (this.introSec > 0) {
      this.introClock += dt;
      const t = Math.min(1, this.introClock / this.introSec);
      this.introYOffset = -this.viewH * 0.55 * (1 - t);
      if (t >= 1) { this.introSec = 0; this.introYOffset = 0; }
      this.drawFrame(frames[0]);
      return;
    }
    this.stepClock += dt;
    const effStep = this.stepSec / Math.max(1, this.playbackSpeed); // L 倍速：2x/3x 缩短每帧停留
    while (this.stepClock >= effStep && this.frameIdx < frames.length - 1) {
      this.frameIdx += 1;
      this.stepClock -= effStep;
    }
    this.drawFrame(frames[this.frameIdx]);
    if (this.frameIdx >= frames.length - 1) this.finishPlayback();
  }

  /** 点「跳过」：直接跳到最后一帧并收尾。 */
  private onSkip(): void {
    if (this.fxActive && this.fxLayer) { // 演出层路径：快进指令流到终局（onFinish→finishPlayback）
      this.fxLayer.skipToEnd();
      return;
    }
    if (!this.playing || !this.playback) return;
    this.introSec = 0; this.introYOffset = 0; // L：跳过时结束入场（避免残留偏移）
    this.frameIdx = this.playback.frames.length - 1;
    this.drawFrame(this.playback.frames[this.frameIdx]);
    this.finishPlayback();
  }

  /** 收尾：停播、隐藏「跳过/倍速」、弹结果窗（背景保留刚结束的就地战斗画面）。 */
  private finishPlayback(): void {
    this.playing = false;
    this.introSec = 0; this.introYOffset = 0;
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = false;
    if (this.prebattleSpeedBtn) this.prebattleSpeedBtn.active = false;
    if (this.tutorialDevBarNode) this.tutorialDevBarNode.active = true; // 恢复 DEV 教程键（播放期临时藏）
    this.openResultPopup(this.pendingWon);
  }

  /** 各单位战场坐标 = 备战站位（fieldPlayerPos/fieldEnemyPos）：备战看到的位置就是战斗位置。 */
  private computePositions(pb: S7BattlePlayback): void {
    this.posById.clear();
    for (const u of pb.roster) {
      const boss = u.unitStatRef.indexOf('warden') >= 0 || u.unitStatRef.indexOf('boss') >= 0;
      const p = u.side === 'player' ? this.fieldPlayerPos(u.row, u.col) : this.fieldEnemyPos(u.row, u.col);
      this.posById.set(u.unitId, { x: p.x, y: p.y, boss });
    }
  }

  /** 画一帧（就地·画在备战 prebattleGfx 上）：满屏底板 + 中线 + 攻击连线 + 双方色块（血条/死亡变灰/出手描边）。 */
  private drawFrame(frame: S7PlaybackFrame): void {
    const g = this.prebattleGfx;
    if (!g || !this.playback) return;
    const W = this.viewW, H = this.viewH;
    g.clear();
    // 满屏底板（战场）
    g.fillColor = new Color(10, 13, 24, 255);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    // 中线（双方分界·屏幕中线）
    g.strokeColor = new Color(60, 70, 90, 200);
    g.lineWidth = 1;
    g.moveTo(-W * 0.46, 0);
    g.lineTo(W * 0.46, 0);
    g.stroke();

    // 攻击连线（画在色块下层）
    for (const a of frame.attacks) {
      const from = this.posById.get(a.actorId);
      const tid = a.targetIds.length > 0 ? a.targetIds[0] : undefined;
      const to = tid ? this.posById.get(tid) : undefined;
      if (!from || !to) continue;
      g.strokeColor = a.side === 'player' ? new Color(140, 220, 255, 230) : new Color(255, 180, 120, 230);
      g.lineWidth = a.isUltimate ? 5 : 2;
      g.moveTo(from.x, from.y);
      g.lineTo(to.x, to.y);
      g.stroke();
    }

    const attackers = new Set<string>(frame.attacks.map((a) => a.actorId));
    for (const u of this.playback.roster) {
      const s = frame.units[u.unitId];
      if (!s || !s.present) continue;
      const base = this.posById.get(u.unitId);
      if (!base) continue;
      const yo = u.side === 'player' ? this.introYOffset : 0; // L 入场：我方滑入偏移
      const p = { x: base.x, y: base.y + yo, boss: base.boss };
      const half = p.boss ? 34 : 20;
      if (!s.alive) {
        // 死亡：灰色小方块
        g.fillColor = new Color(70, 70, 82, 255);
        g.rect(p.x - half * 0.7, p.y - half * 0.7, half * 1.4, half * 1.4);
        g.fill();
        continue;
      }
      // 本体（我方蓝 / 敌方红 / 头目紫）
      g.fillColor = u.side === 'player'
        ? new Color(70, 150, 235, 255)
        : (p.boss ? new Color(200, 90, 205, 255) : new Color(230, 110, 80, 255));
      g.rect(p.x - half, p.y - half, 2 * half, 2 * half);
      g.fill();
      // 出手描边（本帧有攻击的单位高亮）
      if (attackers.has(u.unitId)) {
        g.strokeColor = new Color(255, 245, 180, 255);
        g.lineWidth = 3;
        g.rect(p.x - half, p.y - half, 2 * half, 2 * half);
        g.stroke();
      }
      // 血条（块顶）
      const bw = 2 * half;
      g.fillColor = new Color(40, 40, 46, 255);
      g.rect(p.x - half, p.y + half + 3, bw, 5);
      g.fill();
      g.fillColor = s.hpPct > 50 ? new Color(90, 210, 120, 255) : s.hpPct > 25 ? new Color(230, 200, 90, 255) : new Color(230, 90, 90, 255);
      g.rect(p.x - half, p.y + half + 3, (bw * s.hpPct) / 100, 5);
      g.fill();
    }
  }

  // ===== J-step2 船坞(星舰升级) / 训练舱(驾驶员升级) 养成界面 =====

  /** 搭船坞/训练舱共用的养成浮层（列表 + 各行升级 + 建筑升级入口 + 返回）。kind 区分星舰/驾驶员。 */
  private buildUnitTrainPanel(kind: 'ship' | 'pilot', W: number, H: number): Node {
    const panel = new Node(kind === 'ship' ? 'S7Dock' : 'S7Training'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(16, 22, 34, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    const bid = kind === 'ship' ? 'bld_dock' : 'bld_pilot_training_bay';
    this.mkPanelLabel(panel, kind === 'ship' ? '船坞 · 星舰升级' : '训练舱 · 驾驶员升级', 38, new Color(150, 210, 240), -W * 0.22, topY - 30);
    const info = this.mkPanelLabel(panel, '', 24, new Color(200, 220, 240), 0, topY - 92);
    const list = new Node('utList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    const result = this.mkPanelLabel(panel, kind === 'ship' ? '选星舰升级(花星舰合金·船坞折扣生效)' : '选驾驶员升级(花驾驶记录·训练舱折扣生效)', 22, new Color(180, 230, 200), 0, botY + 120);
    const back = this.addBtn(panel, '返回星港', 240, 76, new Color(120, 90, 160, 255), -W * 0.18, botY + 44, () => { panel.active = false; }, 28);
    this.addBtn(panel, kind === 'ship' ? '升级船坞' : '升级训练舱', 260, 76, new Color(90, 150, 110, 255), W * 0.20, botY + 44, () => this.openBuildingUpgrade(bid), 26);
    if (kind === 'ship') { this.dockNode = panel; this.dockListNode = list; this.dockInfoLabel = info; this.dockResultLabel = result; this.dockBackBtn = back.node.parent; }
    else { this.trainingNode = panel; this.trainingListNode = list; this.trainingInfoLabel = info; this.trainingResultLabel = result; this.trainingBackBtn = back.node.parent; }
    // 列表拖动滚动（07-15 反馈③）：行数超一屏时可上下滑；上限随 refreshUnitTrain 重算。
    this.attachVScroll(panel, list, () => (kind === 'ship' ? this.dockScrollMax : this.trainingScrollMax));
    return panel;
  }

  /** 船坞/训练舱列表滚动上限（refreshUnitTrain 重算）。 */
  private dockScrollMax = 0;
  private trainingScrollMax = 0;
  /** 上阵星舰列表滚动上限（refreshBoarding 重算）。 */
  private boardingScrollMax = 0;

  private openDock(): void {
    if (this.blockIfBuildingLocked('bld_dock', '船坞')) return;
    if (this.dockNode) { this.dockNode.active = true; this.refreshUnitTrain('ship'); }
  }
  private openTraining(): void {
    if (this.blockIfBuildingLocked('bld_pilot_training_bay', '训练舱')) return;
    if (this.trainingNode) { this.trainingNode.active = true; this.refreshUnitTrain('pilot'); }
  }

  /** 刷新船坞/训练舱：建筑等级与等级上限 + 重建拥有单位列表(名/等级/升级键)。 */
  private refreshUnitTrain(kind: 'ship' | 'pilot'): void {
    if (!this.playerState || !this.session || !this.buildings || !this.squad) return;
    const listNode = kind === 'ship' ? this.dockListNode : this.trainingListNode;
    const infoLabel = kind === 'ship' ? this.dockInfoLabel : this.trainingInfoLabel;
    if (!listNode) return;
    const bLv = getBuildingLevel(this.buildings, kind === 'ship' ? 'bld_dock' : 'bld_pilot_training_bay');
    // 折扣线（细案①②·步5 回写）：−1.5%/级顶 −15%，只折升级币；等级上限只由阶级决定（Ron 2026-07-03）。
    if (infoLabel) infoLabel.string = kind === 'ship'
      ? `船坞 Lv.${bLv} · 星舰升级合金 -${(UPGRADE_DISCOUNT_PCT_PER_LEVEL * bLv).toFixed(1)}%`
      : `训练舱 Lv.${bLv} · 驾驶员升级记录 -${(UPGRADE_DISCOUNT_PCT_PER_LEVEL * bLv).toFixed(1)}%`;
    listNode.removeAllChildren();
    listNode.setPosition(0, 0, 0); // 重建列表回顶（滚动位不跨刷新残留）
    for (const key of Array.from(this.manageRowBtns.keys())) { if (key.startsWith(`${kind}:`)) this.manageRowBtns.delete(key); }
    const units = kind === 'ship' ? this.squad.ownedShips : this.squad.ownedPilots;
    // 滚动上限：内容高 − 可视高（可视=列表首行到底部按钮区上沿）
    {
      const b2 = getS7UsableBand();
      const visibleSpan = (b2.usableTopY - 170) - (b2.usableBottomY + 170);
      const overflow = Math.max(0, units.length * 62 - visibleSpan);
      if (kind === 'ship') this.dockScrollMax = overflow; else this.trainingScrollMax = overflow;
    }
    let y = getS7UsableBand().usableTopY - 170;
    if (units.length === 0) this.mkPanelLabel(listNode, '（还没有拥有的单位）', 24, new Color(150, 160, 175), 0, y);
    for (const uid of units) {
      const lv = kind === 'ship' ? getShipLevel(this.playerState.unitLevels, uid) : getPilotLevel(this.playerState.unitLevels, uid);
      const cap = kind === 'ship' ? shipLevelCapForTier(getShipTier(this.playerState.unitTiers, uid)) : pilotLevelCapForStar(getPilotStar(this.playerState.unitTiers, uid));
      const tierStr = kind === 'ship' ? `${shipTierName(getShipTier(this.playerState.unitTiers, uid))}阶` : `${getPilotStar(this.playerState.unitTiers, uid)}★`;
      this.mkPanelLabel(listNode, `${this.unitName(kind, uid)}  ${tierStr}·Lv.${lv}/${cap}`, 24, new Color(225, 225, 235), -this.viewW * 0.20, y);
      const id = uid;
      // 巡检批 #15：行距 62 − 键高 52 = 相邻行「管理」键垂直间距 10px（原 56 高只剩 6px）。
      const manageBtn = this.addBtn(listNode, '管理', 150, 52, new Color(80, 130, 160, 255), this.viewW * 0.34, y, () => this.openUnitManage(kind, id), 26);
      this.manageRowBtns.set(`${kind}:${id}`, manageBtn.node.parent as Node);
      y -= 62;
    }
  }

  /** 升一个星舰/驾驶员：受建筑等级封顶；扣费/封顶/资源不足分别提示。 */
  private onUpgradeUnit(kind: 'ship' | 'pilot', unitId: string): void {
    if (!this.session || !this.playerState || !this.buildings) return;
    // 修复(块2真机)：升级键在「管理面板」上——反馈/刷新必须落到管理面板本身。
    //   旧代码把反馈写到被盖在下面的船坞/训练舱 result 标签(玩家看不见)、且升完只刷底层列表不刷管理面板，
    //   导致点升级后管理面板里 Lv/战力/成本纹丝不动(退出重进才对)、满级升阶提示也不出现。
    const resultLabel = this.unitManageResultLabel;
    const name = this.unitName(kind, unitId);
    if (kind === 'ship') {
      const cap = shipLevelCapForTier(getShipTier(this.playerState.unitTiers, unitId));
      const dockLv = getBuildingLevel(this.buildings, 'bld_dock');
      const r = upgradeShipOneLevel(this.playerState.unitLevels, this.session.resources, unitId, dockLv, cap);
      if (resultLabel) resultLabel.string = r.ok ? `${name} 升到 Lv.${r.toLevel}！花 ${r.spent.hullAlloy}合金`
        : r.reason === 'cap_reached' ? `已达当前阶级上限（升阶解锁更高）` : r.reason === 'max_level' ? `${name} 已满级` : r.reason === 'insufficient' ? `合金不够（还需 ${r.needed?.hullAlloy ?? 0}）` : '暂无成本配置';
      if (r.ok) this.sound.playSfx('upgrade_level_up');
    } else {
      const cap = pilotLevelCapForStar(getPilotStar(this.playerState.unitTiers, unitId));
      const trainLv = getBuildingLevel(this.buildings, 'bld_pilot_training_bay');
      const r = upgradePilotOneLevel(this.playerState.unitLevels, this.session.resources, unitId, trainLv, cap);
      if (resultLabel) resultLabel.string = r.ok ? `${name} 升到 Lv.${r.toLevel}！花 ${r.spentPilotToken}驾驶记录`
        : r.reason === 'cap_reached' ? `已达当前星级上限（升星解锁更高）` : r.reason === 'max_level' ? `${name} 已满级` : r.reason === 'insufficient' ? `驾驶记录不够（还需 ${r.neededPilotToken ?? 0}）` : '暂无成本配置';
      if (r.ok) this.sound.playSfx('upgrade_level_up');
    }
    this.persist();
    this.refresh();
    this.refreshUnitManage();   // 修复：刷新玩家正看着的管理面板(Lv/战力/成本/满级升阶提示即时更新)
    this.refreshUnitTrain(kind); // 底层船坞/训练舱列表也刷新(返回该列表时已是新值)
  }

  // ===== J-step3 居住舱(人口中枢) / 星核展厅(收藏) 信息界面 =====

  /** 搭"信息+升级入口"建筑浮层（居住舱/星核展厅共用）：标题 + 信息(刷新) + 升级入口 + 返回。 */
  private buildInfoBuildingPanel(kind: 'habitat' | 'gallery', W: number, H: number): void {
    const panel = new Node(kind === 'habitat' ? 'S7Habitat' : 'S7Gallery'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(20, 22, 32, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    const bid = kind === 'habitat' ? 'bld_habitat' : 'bld_rsv_core_gallery';
    this.mkPanelLabel(panel, kind === 'habitat' ? '居住舱 · 人口中枢' : '星核展厅 · 收藏', 38, new Color(200, 200, 240), -W * 0.20, topY - 30);
    const info = this.mkPanelLabel(panel, '', 26, new Color(220, 228, 245), 0, topY * 0.2);
    this.addBtn(panel, '返回星港', 240, 76, new Color(120, 90, 160, 255), -W * 0.18, botY + 44, () => { panel.active = false; }, 28);
    this.addBtn(panel, '升级', 240, 76, new Color(90, 150, 110, 255), W * 0.20, botY + 44, () => this.openBuildingUpgrade(bid), 28);
    // 星核展厅 → 星空宝库入口（I·星核兑换/合成）。
    if (kind === 'gallery') this.addBtn(panel, '🌌 星空宝库', 300, 72, new Color(120, 90, 170, 255), 0, botY + 134, () => this.openVault(), 28);
    if (kind === 'habitat') { this.habitatNode = panel; this.habitatInfoLabel = info; }
    else { this.galleryNode = panel; this.galleryInfoLabel = info; }
  }

  private openHabitat(): void {
    if (this.blockIfBuildingLocked('bld_habitat', '居住舱')) return;
    if (this.habitatNode) { this.habitatNode.active = true; this.refreshInfoBuilding('habitat'); }
  }
  private openGallery(): void {
    if (this.blockIfBuildingLocked('bld_rsv_core_gallery', '星核展厅')) return;
    if (this.galleryNode) { this.galleryNode.active = true; this.refreshInfoBuilding('gallery'); }
  }

  /** 刷新居住舱/星核展厅信息（进界面 + 升级后调）。 */
  private refreshInfoBuilding(kind: 'habitat' | 'gallery'): void {
    if (!this.buildings) return;
    if (kind === 'habitat' && this.habitatInfoLabel) {
      const lv = getBuildingLevel(this.buildings, 'bld_habitat');
      const res = this.population?.residents ?? 0;
      const wrk = this.population?.workers ?? 0;
      const cap = habitatStaffCap(lv);
      this.habitatInfoLabel.string =
        `居住舱 Lv.${lv}\n居民 ${res} 人　工人 ${wrk} 人（有效编制各 ${cap} 人·超编纯人气）\n\n离线储存上限 ${Math.round(offlineStorageHours(lv))}h（建筑）\n离线产率 +${Math.round(offlineRateBonusPct(lv))}%（建筑）\n居民加成：离线产率再 +${residentRateBonusPct(res, cap)}% · 储存再 +${residentStorageExtensionHours(res, cap)}h\n工人加成：建筑升级成本 -${workerBuildDiscountPct(lv, wrk)}%${lv < 3 ? '（居住舱 Lv3 启用）' : ''}`;
    } else if (kind === 'gallery' && this.galleryInfoLabel && this.squad) {
      const lv = getBuildingLevel(this.buildings, 'bld_rsv_core_gallery');
      const ids = Object.keys(this.squad.ownedCores);
      const distinct = ids.length;
      const list = ids.length > 0 ? ids.map((c) => `${this.coreName(c)}×${this.squad!.ownedCores[c]}`).join('、') : '（暂无·星核靠扩张宝藏/合成/宝库获得）';
      this.galleryInfoLabel.string =
        `星核展厅 Lv.${lv}\n已收集星核 ${distinct} 种：\n${list}\n\n全队收藏加成 +${coreGalleryTeamBonusPct(lv, distinct).toFixed(1)}%（已接入战斗·种类越多越强·封顶10%）`;
    }
  }

  /** 星核 id → 中文名（取配置·缺失回退 id）。 */
  private coreName(coreId: string): string {
    return this.runtime?.getById<{ name: string }>('core_config', coreId)?.name ?? coreId;
  }

  /** 插件 id → 中文名（取配置·缺失回退 id）。变更#4 揭晓具体插件名用。 */
  private pluginName(pluginId: string): string {
    return this.runtime?.getById<{ name: string }>('plugin_config', pluginId)?.name ?? pluginId;
  }

  // ===== 升阶升星 step2：单位管理面板（详情 + 升级/升阶升星/装配·预留属性&技能详情）=====

  /** 搭单位管理浮层（船坞单舰 / 训练舱驾驶员共用）。 */
  private buildUnitManagePanel(W: number, H: number): void {
    const panel = new Node('S7UnitManage'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(18, 24, 34, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.unitManageNode = panel;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    this.unitManageInfoLabel = this.mkPanelLabel(panel, '', 26, new Color(222, 230, 245), 0, topY * 0.18);
    this.unitManageResultLabel = this.mkPanelLabel(panel, '', 24, new Color(180, 230, 200), 0, botY + 200);
    // 动作：升级 / 升阶或升星 / 装配(仅舰) / 返回。
    // 巡检批 #15：原三键 200 宽间距 0.24W 相邻热区各重叠 20px、返回行超出安全区下沿 → 重排（相邻 ≥8px·全在安全区内）。
    this.unitManageUpgradeBtn = this.addBtn(panel, '升级', 190, 76, new Color(70, 150, 110, 255), -W * 0.30, botY + 128, () => this.onUpgradeUnit(this.unitManageKind, this.unitManageId), 28).node.parent; // M1：强引导 step5/8 高光「升级」用
    this.unitManageAscendLabel = this.addBtn(panel, '升阶', 190, 76, new Color(150, 110, 180, 255), -W * 0.025, botY + 128, () => this.onAscendUnit(this.unitManageKind, this.unitManageId), 28);
    this.unitManageEquipBtn = this.addBtn(panel, '装配', 190, 76, new Color(70, 130, 160, 255), W * 0.25, botY + 128, () => { this.prebattleSelShip = this.unitManageId; this.openLoadout(); }, 28).node.parent;
    this.unitManageBackBtn = this.addBtn(panel, '返回', 200, 76, new Color(120, 90, 160, 255), W * 0.34, botY + 40, () => { panel.active = false; }, 28).node.parent;
  }

  private openUnitManage(kind: 'ship' | 'pilot', unitId: string): void {
    if (!this.unitManageNode) return;
    this.unitManageKind = kind;
    this.unitManageId = unitId;
    const parent = this.unitManageNode.parent;
    if (parent) this.unitManageNode.setSiblingIndex(parent.children.length - 1); // 置顶(盖在船坞/训练舱之上)
    this.unitManageNode.active = true;
    if (this.unitManageResultLabel) this.unitManageResultLabel.string = '';
    this.refreshUnitManage();
  }

  /** 刷新管理面板：阶级/星级·等级·槽位·战力·加成 + 属性/技能详情(预留)。 */
  private refreshUnitManage(): void {
    if (!this.playerState || !this.buildings || !this.unitManageInfoLabel) return;
    const kind = this.unitManageKind, uid = this.unitManageId;
    const name = this.unitName(kind, uid);
    if (this.unitManageAscendLabel) this.unitManageAscendLabel.string = kind === 'ship' ? '升阶' : '升星';
    if (this.unitManageEquipBtn) this.unitManageEquipBtn.active = kind === 'ship';
    if (kind === 'ship') {
      const lv = getShipLevel(this.playerState.unitLevels, uid);
      const tier = getShipTier(this.playerState.unitTiers, uid);
      const cap = shipLevelCapForTier(tier);
      const haveShard = getExclusiveShardCount(this.playerState.exclusiveShards, uid);
      const nextCost = tier < SHIP_TIER_MAX ? DEFAULT_S7_ASCEND_CONFIG.shipTierStepCost[tier].exclusiveShards : 0;
      const power = this.shipPower(uid);
      this.unitManageInfoLabel.string =
        `${name}\n阶级 ${shipTierName(tier)}阶（全属性 ×${Math.pow(S7_TIER_ATTR_MULT, tier).toFixed(2)}）\n` +
        `${tier < SHIP_TIER_MAX ? `升阶需 ${nextCost} 专属碎片（有 ${haveShard}）` : '已满阶 SS'}\n` +
        `等级 Lv.${lv}/${cap}${lv >= cap ? (tier < SHIP_TIER_MAX ? '（已满级·升阶解锁更高等级）' : '（已满级·SS顶级）') : '（升级花星舰合金）'}\n插件槽 ${shipPluginSlotCap(tier)}　星核槽 ${shipCoreSlotOpen(tier) ? '已开' : '未开(S阶解锁)'}\n战力 ${power}\n` +
        `— 属性详情（待接入）—\n— 技能详情（待接入）—`;
    } else {
      const lv = getPilotLevel(this.playerState.unitLevels, uid);
      const star = getPilotStar(this.playerState.unitTiers, uid);
      const cap = pilotLevelCapForStar(star);
      const haveShard = getExclusiveShardCount(this.playerState.exclusiveShards, uid);
      const nextCost = star < PILOT_STAR_MAX ? DEFAULT_S7_ASCEND_CONFIG.pilotStarStepCost[star - 1].exclusiveShards : 0;
      this.unitManageInfoLabel.string =
        `${name}\n星级 ${star}★（数值线 ×${S7_PILOT_STAR_MULT[star].toFixed(2)}）\n` +
        `${star < PILOT_STAR_MAX ? `升星需 ${nextCost} 专属碎片（有 ${haveShard}）` : '已满星 5★'}\n` +
        `等级 Lv.${lv}/${cap}${lv >= cap ? (star < PILOT_STAR_MAX ? '（已满级·升星解锁更高等级）' : '（已满级·5★顶级）') : '（升级花驾驶记录）'}\n` +
        `— 驾驶能力详情（待接入）—\n— 驾驶天赋详情（待接入）—`;
    }
  }

  // ===== 背包·通用碎片转换（通用→指定单位专属·占位 1:1）=====

  /** 搭背包转换浮层：通用碎片余量 + 舰/员切页 + 可转单位列表(选) + 数量(−/+/最大) + 转换 + 返回。 */
  private buildBackpackPanel(W: number, H: number): void {
    const panel = new Node('S7Backpack'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(22, 22, 30, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.backpackNode = panel;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    this.backpackTitleLabel = this.mkPanelLabel(panel, '🎒 背包', 38, new Color(210, 220, 240), -W * 0.32, topY - 30);
    // 三页签：资源总览 / 宝箱 / 碎片转换。
    this.addBtn(panel, '资源', 180, 64, new Color(70, 110, 160, 255), -W * 0.28, topY - 96, () => this.setBackpackTab('resource'), 26);
    this.addBtn(panel, '宝箱', 180, 64, new Color(150, 120, 70, 255), 0, topY - 96, () => this.setBackpackTab('chest'), 26);
    this.addBtn(panel, '碎片转换', 180, 64, new Color(90, 140, 110, 255), W * 0.28, topY - 96, () => this.setBackpackTab('convert'), 26);
    this.backpackInfoLabel = this.mkPanelLabel(panel, '', 24, new Color(220, 228, 245), 0, topY - 158);
    const list = new Node('bpList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.backpackListNode = list;
    // 碎片转换专用控件组（仅 convert 页显）。
    const cv = new Node('bpConvert'); cv.layer = this.node.layer; panel.addChild(cv); cv.setPosition(0, 0, 0);
    this.backpackConvertNode = cv;
    this.addBtn(cv, '转舰专属', 200, 64, new Color(80, 130, 200, 255), -W * 0.20, topY - 222, () => { this.backpackKind = 'ship'; this.backpackTargetId = ''; this.backpackAmount = 1; this.refreshBackpack(); }, 24);
    this.addBtn(cv, '转员专属', 200, 64, new Color(110, 140, 90, 255), W * 0.20, topY - 222, () => { this.backpackKind = 'pilot'; this.backpackTargetId = ''; this.backpackAmount = 1; this.refreshBackpack(); }, 24);
    this.addBtn(cv, '−', 80, 70, new Color(90, 95, 110, 255), -W * 0.30, botY + 150, () => this.changeBackpackAmount(-1), 34);
    this.backpackAmountLabel = this.mkPanelLabel(cv, '1', 30, new Color(255, 235, 160), -W * 0.16, botY + 150);
    this.addBtn(cv, '+', 80, 70, new Color(90, 95, 110, 255), -W * 0.02, botY + 150, () => this.changeBackpackAmount(1), 34);
    this.addBtn(cv, '最大', 100, 70, new Color(90, 95, 110, 255), W * 0.14, botY + 150, () => this.changeBackpackAmount(0), 26);
    this.addBtn(cv, '转换', 160, 70, new Color(70, 150, 110, 255), W * 0.34, botY + 150, () => this.onBackpackConvert(), 28);
    this.addBtn(panel, '返回星港', 240, 76, new Color(120, 90, 160, 255), 0, botY + 50, () => { panel.active = false; }, 28);
  }

  private openBackpack(): void {
    if (!this.backpackNode) return;
    this.backpackTab = 'resource';
    this.backpackKind = 'ship'; this.backpackTargetId = ''; this.backpackAmount = 1;
    this.backpackNode.active = true;
    this.refreshBackpack();
  }

  private setBackpackTab(tab: 'resource' | 'chest' | 'convert'): void {
    this.backpackTab = tab;
    if (tab === 'convert') { this.backpackKind = 'ship'; this.backpackTargetId = ''; this.backpackAmount = 1; }
    this.refreshBackpack();
  }

  /** 刷新背包：按页签分派（资源总览 / 宝箱 / 碎片转换）。 */
  private refreshBackpack(): void {
    if (!this.backpackListNode) return;
    this.backpackListNode.removeAllChildren();
    if (this.backpackConvertNode) this.backpackConvertNode.active = this.backpackTab === 'convert';
    if (this.backpackTab === 'resource') { if (this.backpackTitleLabel) this.backpackTitleLabel.string = '🎒 背包 · 资源'; this.refreshBackpackResource(); }
    else if (this.backpackTab === 'chest') { if (this.backpackTitleLabel) this.backpackTitleLabel.string = '🎒 背包 · 宝箱'; this.refreshBackpackChest(); }
    else { if (this.backpackTitleLabel) this.backpackTitleLabel.string = '🎒 背包 · 碎片转换'; this.refreshBackpackConvert(); }
  }

  /** 资源页：列出所有背包可见资源（§10.6·软/流通货币除外·走货币栏）+ 各单位专属碎片（非零）+ 未装插件数。 */
  private refreshBackpackResource(): void {
    if (!this.session || !this.playerState || !this.backpackListNode) return;
    const res = this.session.resources as Record<string, number>;
    if (this.backpackInfoLabel) this.backpackInfoLabel.string = '攒着不过期·想用再用（软/流通货币星矿·合金·驾驶记录·星贝见顶部货币栏）';
    // 背包资源键（§10.6 line 377）：补给券·信标三档·通用碎片·星核碎片·星空宝石。
    const keys = ['supplyTicket', 'beaconCommon', 'beaconRare', 'beaconEpic', 'shipBlueprint', 'pilotShardUniversal', 'coreFrag', 'starGem'];
    const cells: string[] = [];
    for (const k of keys) cells.push(`${this.zhRes(k)} ${Math.floor(res[k] ?? 0)}`);
    // 各单位专属碎片（非零）。
    const ex = this.playerState.exclusiveShards;
    const exIds = (ex && ex.shards ? Object.keys(ex.shards) : []).filter((id) => getExclusiveShardCount(ex, id) > 0);
    for (const id of exIds) cells.push(`${this.unitNameAny(id)}专属 ${getExclusiveShardCount(ex, id)}`);
    // 拥有插件数（库存总数·含已装·灰盒先显总数）。
    const plugCount = this.pluginInventory ? this.pluginInventory.plugins.length : 0;
    cells.push(`拥有插件 ${plugCount}`);
    // 两列网格平铺。
    let y = getS7UsableBand().usableTopY - 215;
    let col = 0;
    for (const c of cells) {
      const x = col === 0 ? -this.viewW * 0.22 : this.viewW * 0.22;
      const cell = new Node('bpRes'); cell.layer = this.node.layer; this.backpackListNode.addChild(cell); cell.setPosition(x, y, 0);
      const bg = cell.addComponent(Graphics); bg.fillColor = new Color(40, 46, 64, 255); bg.roundRect(-this.viewW * 0.21, -28, this.viewW * 0.42, 56, 8); bg.fill();
      this.mkPanelLabel(cell, c, 24, new Color(228, 234, 248), 0, 0);
      col += 1; if (col >= 2) { col = 0; y -= 66; }
    }
  }

  /** 宝箱页：列出三类宝箱数量；星辉货舱有货→「开箱」(→开箱浮层)；行动/扩张宝藏占位（随 G/I 接）。 */
  private refreshBackpackChest(): void {
    if (!this.playerState || !this.backpackListNode) return;
    if (this.backpackInfoLabel) this.backpackInfoLabel.string = '宝箱攒着不过期·想开再开（星辉货舱=3选项免费选1·看广告再选1）';
    const names: Record<S7ChestType, string> = { starlightCargo: '星辉货舱', actionTreasure: '行动宝藏', expansionTreasure: '扩张宝藏' };
    let y = getS7UsableBand().usableTopY - 220;
    for (const t of S7_CHEST_TYPES) {
      const cnt = getChestCount(this.playerState.chests, t);
      const row = new Node('bpChest'); row.layer = this.node.layer; this.backpackListNode.addChild(row); row.setPosition(0, y, 0);
      const bg = row.addComponent(Graphics); bg.fillColor = new Color(44, 40, 58, 255); bg.roundRect(-this.viewW * 0.40, -42, this.viewW * 0.80, 84, 12); bg.fill();
      this.mkPanelLabel(row, `${names[t]} ×${cnt}`, 28, new Color(232, 224, 245), -this.viewW * 0.22, 0);
      // 星辉货舱→H开箱；扩张宝藏→I开箱(星核·首次自选/之后三选一)；行动宝藏开箱留后(三选一·随后接)。
      if (cnt > 0 && t === 'starlightCargo') this.addBtn(row, '开箱', 150, 64, new Color(225, 150, 45, 255), this.viewW * 0.30, 0, () => this.openChestUI(t), 26);
      else if (cnt > 0 && t === 'expansionTreasure') this.addBtn(row, '开箱', 150, 64, new Color(150, 110, 200, 255), this.viewW * 0.30, 0, () => this.openExpOpenUI(), 26);
      else if (t === 'actionTreasure') this.mkPanelLabel(row, '开箱随后接', 22, new Color(150, 158, 178), this.viewW * 0.30, 0);
      else this.mkPanelLabel(row, '暂无', 22, new Color(150, 158, 178), this.viewW * 0.30, 0);
      y -= 100;
    }
  }

  /** 当前 kind 的通用碎片余量。 */
  private backpackUniversalHave(): number {
    const r = this.session?.resources as Record<string, number> | undefined;
    if (!r) return 0;
    return Math.floor((this.backpackKind === 'ship' ? r.shipBlueprint : r.pilotShardUniversal) ?? 0);
  }

  private changeBackpackAmount(delta: number): void {
    const max = Math.max(1, this.backpackUniversalHave());
    if (delta === 0) this.backpackAmount = max; // 最大
    else this.backpackAmount = Math.max(1, Math.min(max, this.backpackAmount + delta));
    if (this.backpackAmountLabel) this.backpackAmountLabel.string = String(this.backpackAmount);
  }

  /** 碎片转换页：余量/选中 + 重建可转单位列表（拥有的舰/员）。 */
  private refreshBackpackConvert(): void {
    if (!this.playerState || !this.squad || !this.backpackListNode) return;
    const have = this.backpackUniversalHave();
    const kindName = this.backpackKind === 'ship' ? '通用舰碎片' : '通用员碎片';
    const selName = this.backpackTargetId ? this.unitName(this.backpackKind, this.backpackTargetId) : '（点下方选单位）';
    if (this.backpackInfoLabel) this.backpackInfoLabel.string = `${kindName} 余 ${have}　→ 选中：${selName}\n点单位选目标 → 选数量 → 转换（1 通用 = 1 专属）`;
    if (this.backpackAmount > Math.max(1, have)) this.backpackAmount = Math.max(1, have);
    if (this.backpackAmountLabel) this.backpackAmountLabel.string = String(this.backpackAmount);
    const units = this.backpackKind === 'ship' ? this.squad.ownedShips : this.squad.ownedPilots;
    let y = getS7UsableBand().usableTopY - 300;
    let x = -this.viewW * 0.28;
    for (const uid of units) {
      const sel = uid === this.backpackTargetId;
      const have2 = getExclusiveShardCount(this.playerState.exclusiveShards, uid);
      this.addBtn(this.backpackListNode, `${this.unitName(this.backpackKind, uid)}\n专属${have2}`, 200, 70, sel ? new Color(90, 150, 220, 255) : new Color(48, 56, 76, 255), x, y, () => { this.backpackTargetId = uid; this.refreshBackpack(); }, 22);
      x += this.viewW * 0.28;
      if (x > this.viewW * 0.28) { x = -this.viewW * 0.28; y -= 80; }
    }
  }

  private onBackpackConvert(): void {
    if (!this.playerState || !this.session) return;
    if (!this.backpackTargetId) { if (this.backpackInfoLabel) this.backpackInfoLabel.string = '先点一个单位作转换目标'; return; }
    const r = convertUniversalToExclusive(this.session.resources as Record<string, number>, this.playerState.exclusiveShards, this.backpackKind, this.backpackTargetId, this.backpackAmount);
    if (this.backpackInfoLabel && !r.ok) this.backpackInfoLabel.string = r.reason === 'insufficient' ? '通用碎片不够' : '数量不对';
    if (r.ok) { this.backpackAmount = 1; }
    this.persist();
    this.refresh();
    this.refreshBackpack();
  }

  // ===== H·星辉货舱开箱（3 选项·免费选 1·看广告再选 1）=====

  /** 搭开箱浮层（默认隐藏·盖在背包之上）：标题 + 信息行 + 3 选项卡 + 看广告再选键 + 返回。 */
  private buildChestOpenPanel(W: number, H: number): void {
    const panel = new Node('S7ChestOpen'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 205); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.92, dh = H * 0.5;
    dim.fillColor = new Color(30, 26, 42, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 22); dim.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.chestOpenNode = panel;
    this.chestOpenTitleLabel = this.mkPanelLabel(panel, '', 36, new Color(255, 222, 150), 0, dh * 0.40);
    this.chestOpenMsgLabel = this.mkPanelLabel(panel, '', 24, new Color(210, 220, 240), 0, dh * 0.28);
    const list = new Node('chestOptList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.chestOpenListNode = list;
    // 看广告再选键（免费选完后显）。
    const adNode = new Node('chestAd'); adNode.layer = this.node.layer; panel.addChild(adNode); adNode.setPosition(0, -dh * 0.28, 0);
    adNode.addComponent(UITransform).setContentSize(340, 70);
    const abg = adNode.addComponent(Graphics); abg.fillColor = new Color(60, 130, 90, 255); abg.roundRect(-170, -35, 340, 70, 14); abg.fill();
    const al = new Node('t'); al.layer = this.node.layer; adNode.addChild(al);
    const alab = al.addComponent(Label); alab.fontSize = 26; alab.color = new Color(255, 255, 255); alab.string = '📺 看广告再选 1 个';
    adNode.on(Node.EventType.TOUCH_END, () => this.onChestOpenAd(), this);
    this.chestOpenAdBtnNode = adNode;
    // 巡检批 #15：与广告键垂直间距拉到 ≥8px（原 7px）。
    this.addBtn(panel, '返回背包', 240, 76, new Color(120, 90, 160, 255), 0, -dh * 0.41, () => { panel.active = false; this.refreshBackpack(); }, 28);
  }

  /** 开一个宝箱：有货→掷 3 选项·进开箱浮层（箱子在「免费选 1」那一刻才扣库存·没选不亏）。 */
  private openChestUI(chestId: S7ChestType): void {
    if (!this.playerState || !this.chestOpenNode) return;
    if (getChestCount(this.playerState.chests, chestId) < 1) return;
    const rng = new S7AutoBattleRng(`chest:${chestId}:${Date.now()}`);
    const options = rollChestOptions(DEFAULT_S7_CHEST_REWARD_CONFIG, chestId, rng);
    if (options.length === 0) return;
    const limits = chestPickLimits(DEFAULT_S7_CHEST_REWARD_CONFIG, chestId);
    this.chestOpen = { chestId, options, picked: options.map(() => false), freeLeft: limits.free, adLeft: limits.ad, adUnlocked: false, consumed: false };
    const parent = this.chestOpenNode.parent;
    if (parent) this.chestOpenNode.setSiblingIndex(parent.children.length - 1); // 置顶（盖在背包之上）
    this.chestOpenNode.active = true;
    if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = '';
    this.refreshChestOpen();
  }

  /** 刷新开箱浮层：标题/信息 + 重建选项卡 + 看广告再选键显隐。 */
  private refreshChestOpen(): void {
    const c = this.chestOpen;
    if (!c || !this.chestOpenListNode) return;
    const names: Record<S7ChestType, string> = { starlightCargo: '星辉货舱', actionTreasure: '行动宝藏', expansionTreasure: '扩张宝藏' };
    if (this.chestOpenTitleLabel) this.chestOpenTitleLabel.string = `🎁 ${names[c.chestId]} 开箱`;
    // 块5：#7 不限次（唯一例外点位），但新手期全隐（统一三态）——广告键藏时文案也不提广告（别指向不存在的按钮）。
    const adVisible = this.adButtonState('cargo_extra_pick').kind !== 'hidden';
    const info = c.freeLeft > 0 ? (adVisible ? '免费选 1 个（看广告可再选 1 个）' : '免费选 1 个')
      : c.adLeft > 0 ? (c.adUnlocked ? '广告已看·再选 1 个未选项' : (adVisible ? '已选 1 个 · 看广告可再选 1 个' : '已选完，返回背包'))
        : '已选完，返回背包';
    if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = info; // 状态行（onPick 的「到手」在 refresh 之后再覆盖）
    this.chestOpenListNode.removeAllChildren();
    const n = c.options.length;
    const cardW = Math.min(this.viewW * 0.27, 230);
    const gap = this.viewW * 0.30;
    const startX = -((n - 1) * gap) / 2;
    for (let i = 0; i < n; i += 1) {
      const x = startX + i * gap;
      const card = new Node('chestCard'); card.layer = this.node.layer; this.chestOpenListNode.addChild(card); card.setPosition(x, this.viewH * 0.04, 0);
      card.addComponent(UITransform).setContentSize(cardW, 170);
      const bg = card.addComponent(Graphics); bg.fillColor = c.picked[i] ? new Color(40, 70, 50, 255) : new Color(52, 56, 78, 255); bg.roundRect(-cardW / 2, -85, cardW, 170, 14); bg.fill();
      const tl = this.mkPanelLabel(card, this.chestRewardText(c.options[i]), 23, new Color(230, 236, 250), 0, 22);
      tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(cardW - 16, 100);
      if (c.picked[i]) this.mkPanelLabel(card, '✓ 已选', 24, new Color(150, 220, 160), 0, -54);
      else this.addBtn(card, '选这个', cardW - 40, 54, new Color(225, 150, 45, 255), 0, -54, () => this.onPickChestOption(i), 24);
    }
    // 看广告再选键：免费已选完、还有广告名额、且未解锁时显示（块5：叠加统一三态·新手期全隐）。
    if (this.chestOpenAdBtnNode) this.chestOpenAdBtnNode.active = adVisible && c.freeLeft === 0 && c.adLeft > 0 && !c.adUnlocked;
  }

  /** 选一个开箱选项：免费名额→扣箱+入账；广告名额(需先看广告解锁)→入账。 */
  private onPickChestOption(index: number): void {
    const c = this.chestOpen;
    if (!c || !this.playerState || c.picked[index]) return;
    if (c.freeLeft > 0) {
      if (!c.consumed) { if (!openChest(this.playerState.chests, c.chestId)) return; c.consumed = true; } // 免费选那刻才扣箱
      c.picked[index] = true; c.freeLeft -= 1;
    } else if (c.adLeft > 0 && c.adUnlocked) {
      c.picked[index] = true; c.adLeft -= 1; c.adUnlocked = false;
    } else {
      if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = '先点下方「看广告再选」解锁第 2 个';
      return;
    }
    const text = this.applyChestReward(c.options[index]);
    this.sound.playSfx('chest_open');
    this.persist();
    this.refresh();
    this.refreshChestOpen(); // 先刷新（会写状态行）→ 再覆盖成「到手」结果，避免被状态行盖掉。
    if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = `到手：${text}${c.adLeft > 0 && c.freeLeft === 0 ? '（看广告可再选 1 个）' : ''}`;
  }

  /** 看广告解锁第 2 个选择名额（#7·不限次·统一广告流走记数不走上限）。 */
  private onChestOpenAd(): void {
    const c = this.chestOpen;
    if (!c || c.freeLeft > 0 || c.adLeft <= 0 || c.adUnlocked) return;
    this.runAdPoint('cargo_extra_pick',
      () => {
        const cur = this.chestOpen;
        if (!cur || cur.freeLeft > 0 || cur.adLeft <= 0 || cur.adUnlocked) return;
        cur.adUnlocked = true;
        this.persist(); // 记数入档（不限次·纯遥测口径）
        if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = '已解锁·再选 1 个未选项';
        this.refreshChestOpen();
      },
      (reason) => { if (this.chestOpenMsgLabel) this.chestOpenMsgLabel.string = reason === 'ad_failed' ? '广告没看完，未解锁' : '广告加载失败'; });
  }

  /** 开箱奖励的中文短描述。 */
  private chestRewardText(r: S7ChestReward): string {
    if (r.kind === 'resource') return `${this.zhRes(r.resourceId)}×${r.amount}`;
    return '信标包\n3~5个随机品质信标'; // 不剧透具体档位(Ron 反馈2)·领取入账时再显示实际所得
  }

  /** 把一笔开箱奖励入账（资源→钱包·有非钱包键护栏；信标包逐档加）。 */
  private applyChestReward(r: S7ChestReward): string {
    if (!this.session) return '';
    const res = this.session.resources as Record<string, number>;
    if (r.kind === 'resource') {
      if (res[r.resourceId] === undefined) return '';
      res[r.resourceId] += r.amount;
      return `${this.zhRes(r.resourceId)}×${r.amount}`;
    }
    // beaconBundle
    const parts: string[] = [];
    for (const it of r.items) {
      if (res[it.resourceId] === undefined) continue;
      res[it.resourceId] += it.amount;
      parts.push(`${this.zhRes(it.resourceId)}×${it.amount}`);
    }
    return `信标包(${parts.join(' ')})`;
  }

  // ===== G·活动接全（3天行动/7天扩张·进度喂入 + 周期tick结算 + 里程碑/完成/结算发奖）=====

  /** 喂活动进度（两活动都累积·§10.5 自然累积）：某行为 → 按权重加进度。 */
  private feedActivity(action: string, mult = 1): void {
    if (!this.playerState) return;
    const st = this.playerState.activityProgress;
    for (const t of ['action3', 'expansion7'] as S7ActivityType[]) {
      const w = progressWeightFor(DEFAULT_S7_ACTIVITY_CONFIG, t, action);
      if (w > 0) addActivityProgress(st, t, w * mult);
    }
  }

  /** 滚动活动周期到现在：到期且攒够 → 结算宝藏走邮件（行动/扩张宝藏·离线期间到期的也补发）。 */
  private tickActivities(): void {
    if (!this.playerState) return;
    const events = tickActivityCycles(this.playerState.activityProgress, Date.now(), activityCycleConfig(DEFAULT_S7_ACTIVITY_CONFIG));
    if (events.length === 0) return;
    for (const ev of events) {
      // G 反馈3：结算邮件含 漏领里程碑 + 漏领完成 + 结算宝藏（不再只补结算宝藏）。
      const rewards: S7MailReward[] = [];
      for (const r of settlementBackfillRewards(ev, DEFAULT_S7_ACTIVITY_CONFIG)) {
        if (r.kind === 'resource') rewards.push({ type: 'resource', resourceId: r.resourceId, amount: r.amount });
        else if (r.kind === 'chest') rewards.push({ type: 'chest', chestId: r.chestId, amount: r.amount });
        else rewards.push({ type: 'population', pop: r.pop, amount: r.amount });
      }
      const title = ev.type === 'action3' ? '3天行动·结算+漏领补发' : '7天扩张·结算+漏领补发';
      addMail(this.playerState.mailbox, { kind: `activity_settlement_${ev.type}`, title, rewards, createdAt: Date.now() });
    }
    this.persist();
  }

  /** 搭活动浮层（默认隐藏·3天/7天共用·openActivity 设 type）。 */
  private buildActivityPanel(W: number, H: number): void {
    const panel = new Node('S7Activity'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(20, 24, 34, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.activityNode = panel;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    this.activityTitleLabel = this.mkPanelLabel(panel, '', 38, new Color(210, 230, 210), 0, topY - 34);
    this.activityInfoLabel = this.mkPanelLabel(panel, '', 24, new Color(220, 228, 245), 0, topY - 100);
    const list = new Node('actList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.activityListNode = list;
    this.activityMsgLabel = this.mkPanelLabel(panel, '', 24, new Color(170, 220, 175), 0, botY + 130);
    // DEV-TEMP（验活动链·真机不可能等3/7天/打15把攒满）：灌进度 + 强制周期结算。正式版删。
    // 巡检批 #15：两 DEV 键原重叠 2.5px → 缩窄拉开（相邻 ≥8px）。
    this.addBtn(panel, 'DEV:+50进度', 180, 58, new Color(90, 110, 140, 255), -W * 0.31, botY + 50, () => this.devAddActivityProgress(), 22);
    this.addBtn(panel, 'DEV:秒结算', 180, 58, new Color(110, 90, 140, 255), -W * 0.055, botY + 50, () => this.devSettleActivity(), 22);
    this.addBtn(panel, '返回', 180, 58, new Color(120, 90, 160, 255), W * 0.22, botY + 50, () => { panel.active = false; }, 26);
  }

  /** DEV-TEMP·给当前活动灌 50 进度（验里程碑/完成不必真打满）。正式版删。 */
  private devAddActivityProgress(): void {
    if (!this.playerState) return;
    addActivityProgress(this.playerState.activityProgress, this.activityType, 50);
    this.persist();
    this.refreshActivity();
    if (this.activityMsgLabel) this.activityMsgLabel.string = '[DEV] +50 进度';
  }

  /** DEV-TEMP·强制当前活动本周期立即到期（攒够则结算宝藏进邮箱）·验结算→邮件。正式版删。 */
  private devSettleActivity(): void {
    if (!this.playerState) return;
    const st = this.playerState.activityProgress[this.activityType];
    st.cycleStartTime = Date.now() - S7_ACTIVITY_DURATION_SEC[this.activityType] * 1000 - 1000; // 把周期起算推到一整周期前→立即到期
    this.tickActivities();
    this.refresh();
    this.refreshActivity();
    if (this.activityMsgLabel) this.activityMsgLabel.string = '[DEV] 已强制本周期到期·攒够完成阈值则结算宝藏进邮箱';
  }

  /** 打开活动界面（先滚周期结算·再展示该 type）。 */
  private openActivity(type: S7ActivityType): void {
    if (!this.activityNode) return;
    this.tickActivities();
    this.activityType = type;
    this.activityNode.active = true;
    if (this.activityMsgLabel) this.activityMsgLabel.string = '';
    this.refreshActivity();
    this.refresh(); // 邮件红点（结算宝藏可能刚进邮箱）
    this.maybeShowActivityFirstTouch(); // M1b-3 弱引导：首次打开活动 → 弹一次首触短教程
  }

  /** M1b-3 弱引导：首次打开活动面板 → 弹首触短教程（只一次·可跳过/下一步）。 */
  private maybeShowActivityFirstTouch(): void {
    if (!this.playerState) return;
    if (hasSeenFirstTouch(this.playerState.tutorial, S7_FIRST_TOUCH_ACTIVITY)) return;
    markFirstTouchSeen(this.playerState.tutorial, S7_FIRST_TOUCH_ACTIVITY);
    this.persist();
    this.showTutorialPopup(
      '🗓 这是限时活动（3天行动 / 7天扩张）——\n正常推关 / 升级 / 打捞 / 抽卡就会自动累积进度，不用专门打卡；\n到段位领过程奖励、完成领宝藏（7天扩张能拿完整星核）。\n先知道有这回事就行，不强求现在做完。',
      () => this.onActivityFirstTouchClose(),
      () => this.onActivityFirstTouchClose(),
    );
  }

  /** 活动首触短教程关闭：收弹窗；教程内(step19)则关活动回星港 + 续引导出战关3，自由玩则保留活动面板继续用。 */
  private onActivityFirstTouchClose(): void {
    this.hideTutorialPopup();
    if (this.isStrongGuideActive() && this.playerState && this.playerState.tutorial.strongGuideStep === 19) {
      this.closeActivityToHub();
      this.runTutorialStep();
    }
  }

  /** M1b-3：收起活动面板回星港主界面。 */
  private closeActivityToHub(): void {
    if (this.activityNode) this.activityNode.active = false;
    this.refresh();
  }

  /** 剩余时间「Xd Yh」短描述。 */
  private remainText(ms: number): string {
    if (ms <= 0) return '本周期结算中';
    const h = Math.floor(ms / 3_600_000);
    const d = Math.floor(h / 24);
    return d > 0 ? `剩 ${d}天${h % 24}时` : `剩 ${h}时`;
  }

  /** 刷新活动界面：标题/进度/倒计时 + 里程碑列表 + 完成行。 */
  private refreshActivity(): void {
    if (!this.playerState || !this.activityListNode) return;
    const t = this.activityType;
    const st = this.playerState.activityProgress;
    const cfg = DEFAULT_S7_ACTIVITY_CONFIG;
    const name = t === 'action3' ? '3天行动' : '7天扩张';
    if (this.activityTitleLabel) this.activityTitleLabel.string = `🗓 ${name}`;
    const prog = getActivityProgress(st, t);
    const comp = completionView(st, t, cfg);
    const endMs = activityCycleEndTime(st, t);
    const remain = endMs > 0 ? this.remainText(endMs - Date.now()) : '本周期未起算';
    if (this.activityInfoLabel) this.activityInfoLabel.string = `进度 ${Math.floor(prog)} / 完成 ${comp?.threshold ?? '—'}　${remain}\n（推关/打捞/抽卡 自然累积·结算宝藏走邮件）`;
    this.activityListNode.removeAllChildren();
    let y = getS7UsableBand().usableTopY - 180;
    for (const m of listMilestones(st, t, cfg)) {
      const row = this.makeActivityRow(`里程碑 ${m.threshold}：${m.rewards.map((r) => this.activityRewardText(r)).join(' ')}`, y);
      if (m.claimed) this.mkPanelLabel(row, '已领', 22, new Color(120, 130, 150), this.viewW * 0.34, 0);
      else if (m.claimable) this.addBtn(row, '领取', 130, 58, new Color(70, 150, 110, 255), this.viewW * 0.34, 0, () => this.onClaimActivityMilestone(m.id, m.threshold), 24);
      else this.mkPanelLabel(row, '进度不足', 22, new Color(150, 158, 178), this.viewW * 0.34, 0);
      y -= 96;
    }
    if (comp) {
      const row = this.makeActivityRow(`完成 ${comp.threshold}：${comp.rewards.map((r) => this.activityRewardText(r)).join(' ')}`, y);
      if (comp.claimed) this.mkPanelLabel(row, '已领', 22, new Color(120, 130, 150), this.viewW * 0.34, 0);
      else if (comp.claimable) this.addBtn(row, '领取', 130, 58, new Color(225, 150, 45, 255), this.viewW * 0.34, 0, () => this.onClaimActivityCompletion(comp.threshold), 24);
      else this.mkPanelLabel(row, '进度不足', 22, new Color(150, 158, 178), this.viewW * 0.34, 0);
    }
  }

  /** 一行活动条（底板 + 描述标签）·返回行节点供加按钮。 */
  private makeActivityRow(text: string, y: number): Node {
    const row = new Node('actRow'); row.layer = this.node.layer; this.activityListNode!.addChild(row); row.setPosition(0, y, 0);
    const bg = row.addComponent(Graphics); bg.fillColor = new Color(40, 46, 64, 255); bg.roundRect(-this.viewW * 0.44, -40, this.viewW * 0.88, 80, 10); bg.fill();
    const tl = this.mkPanelLabel(row, text, 22, new Color(225, 232, 248), -this.viewW * 0.18, 0);
    tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(this.viewW * 0.5, 72);
    return row;
  }

  private onClaimActivityMilestone(id: string, threshold: number): void {
    if (!this.playerState) return;
    const st = this.playerState.activityProgress;
    const m = listMilestones(st, this.activityType, DEFAULT_S7_ACTIVITY_CONFIG).find((x) => x.id === id);
    if (!m || !claimMilestone(st, this.activityType, id, threshold)) { this.refreshActivity(); return; }
    const texts = m.rewards.map((r) => this.applyActivityReward(r)).filter(Boolean);
    if (this.activityMsgLabel) this.activityMsgLabel.string = `领取里程碑：${texts.join('、')}`;
    this.persist(); this.refresh(); this.refreshActivity();
  }

  private onClaimActivityCompletion(threshold: number): void {
    if (!this.playerState) return;
    const st = this.playerState.activityProgress;
    const cv = completionView(st, this.activityType, DEFAULT_S7_ACTIVITY_CONFIG);
    if (!cv || !claimCompletion(st, this.activityType, threshold)) { this.refreshActivity(); return; }
    const texts = cv.rewards.map((r) => this.applyActivityReward(r)).filter(Boolean);
    if (this.activityMsgLabel) this.activityMsgLabel.string = `领取完成奖励：${texts.join('、')}`;
    this.persist(); this.refresh(); this.refreshActivity();
  }

  /** 一笔活动奖励的中文短描述。 */
  private activityRewardText(r: S7ActivityReward): string {
    if (r.kind === 'resource') return `${this.zhRes(r.resourceId)}×${r.amount}`;
    if (r.kind === 'chest') return `${this.chestName(r.chestId)}×${r.amount}`;
    return r.pop === 'resident' ? `居民×${r.amount}` : `工人×${r.amount}`;
  }

  /** 把一笔活动奖励入账（resource→钱包护栏·chest→宝箱库·population→居民/工人）。 */
  private applyActivityReward(r: S7ActivityReward): string {
    if (!this.playerState || !this.session) return '';
    if (r.kind === 'resource') {
      const res = this.session.resources as Record<string, number>;
      if (res[r.resourceId] === undefined) return '';
      res[r.resourceId] += r.amount;
      return `${this.zhRes(r.resourceId)}×${r.amount}`;
    }
    if (r.kind === 'chest') {
      addChest(this.playerState.chests, r.chestId, r.amount);
      return `${this.chestName(r.chestId)}×${r.amount}`;
    }
    if (r.pop === 'resident') this.playerState.population.residents += r.amount;
    else this.playerState.population.workers += r.amount;
    return r.pop === 'resident' ? `居民×${r.amount}` : `工人×${r.amount}`;
  }

  // ===== I·星空宝库（兑换星核/专属舰 + 碎片随机合成）+ 扩张宝藏开箱 =====

  /** 搭星空宝库浮层（默认隐藏）：信息行 + 合成行 + 星核兑换 + 专属舰兑换 + 结果行 + 返回。 */
  private buildVaultPanel(W: number, H: number): void {
    const panel = new Node('S7Vault'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(18, 18, 30, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.vaultNode = panel;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    this.mkPanelLabel(panel, '🌌 星空宝库', 38, new Color(200, 190, 240), -W * 0.26, topY - 30);
    this.vaultInfoLabel = this.mkPanelLabel(panel, '', 24, new Color(220, 220, 245), 0, topY - 96);
    const list = new Node('vaultList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.vaultListNode = list;
    this.vaultMsgLabel = this.mkPanelLabel(panel, '', 24, new Color(180, 220, 200), 0, botY + 130);
    this.addBtn(panel, '返回', 240, 76, new Color(120, 90, 160, 255), 0, botY + 50, () => { panel.active = false; }, 28);
  }

  private openVault(): void {
    if (!this.vaultNode) return;
    this.vaultNode.active = true;
    if (this.vaultMsgLabel) this.vaultMsgLabel.string = '';
    this.refreshVault();
  }

  /** 通用宝库行（底板 + 描述）·返回行节点供加按钮/标签。 */
  private makeVaultRow(text: string, y: number, color: Color): Node {
    const row = new Node('vaultRow'); row.layer = this.node.layer; this.vaultListNode!.addChild(row); row.setPosition(0, y, 0);
    const bg = row.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-this.viewW * 0.44, -34, this.viewW * 0.88, 68, 10); bg.fill();
    const tl = this.mkPanelLabel(row, text, 22, new Color(228, 232, 248), -this.viewW * 0.20, 0);
    tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(this.viewW * 0.46, 60);
    return row;
  }

  private refreshVault(): void {
    if (!this.session || !this.squad || !this.vaultListNode) return;
    const cfg = DEFAULT_S7_CORE_SOURCE_CONFIG;
    const res = this.session.resources as Record<string, number>;
    const gem = Math.floor(res.starGem ?? 0);
    const frag = Math.floor(res.coreFrag ?? 0);
    if (this.vaultInfoLabel) this.vaultInfoLabel.string = `星空宝石 ${gem}　星核碎片 ${frag}\n（流通核可复购·第2份起×1.5；毕业核唯一解锁；开蛋=碎片随机出常规核）`;
    this.vaultListNode.removeAllChildren();
    let y = getS7UsableBand().usableTopY - 168;
    // 碎片随机合成行。
    const synthRow = this.makeVaultRow(`碎片随机合成 1 核（${cfg.synthesisCost} 碎片）`, y, new Color(46, 42, 64, 255));
    if (frag >= cfg.synthesisCost) this.addBtn(synthRow, '合成', 130, 56, new Color(150, 110, 200, 255), this.viewW * 0.34, 0, () => this.onSynthesize(), 24);
    else this.mkPanelLabel(synthRow, '碎片不足', 22, new Color(150, 158, 178), this.viewW * 0.34, 0);
    y -= 80;
    // 星核兑换（流通核复购×1.5·毕业核唯一解锁）。
    for (const v of vaultCoreViews(cfg, this.squad.ownedCores, gem)) {
      const tag = v.graduation ? '[毕业核]' : v.ownedCopies > 0 ? `[已有×${v.ownedCopies}]` : '';
      const row = this.makeVaultRow(`${this.coreName(v.coreId)}${tag}　${v.gemCost}宝石`, y, new Color(40, 44, 62, 255));
      if (!v.purchasable) this.mkPanelLabel(row, '已拥有', 22, new Color(120, 200, 140), this.viewW * 0.34, 0);
      else if (v.affordable) this.addBtn(row, v.ownedCopies > 0 ? '复购' : '兑换', 130, 56, new Color(90, 150, 110, 255), this.viewW * 0.34, 0, () => this.onRedeemCore(v.coreId, v.gemCost), 24);
      else this.mkPanelLabel(row, '宝石不足', 22, new Color(150, 158, 178), this.viewW * 0.34, 0);
      y -= 76;
    }
    // 专属舰兑换。
    for (const v of vaultShipViews(cfg, this.squad.ownedShips, gem)) {
      const row = this.makeVaultRow(`${this.unitName('ship', v.shipId)}[专属]　${v.gemCost}宝石`, y, new Color(44, 40, 60, 255));
      if (v.owned) this.mkPanelLabel(row, '已拥有', 22, new Color(120, 200, 140), this.viewW * 0.34, 0);
      else if (v.affordable) this.addBtn(row, '兑换', 130, 56, new Color(110, 130, 200, 255), this.viewW * 0.34, 0, () => this.onRedeemShip(v.shipId, v.gemCost), 24);
      else this.mkPanelLabel(row, '宝石不足', 22, new Color(150, 158, 178), this.viewW * 0.34, 0);
      y -= 76;
    }
  }

  private onSynthesize(): void {
    if (!this.session || !this.squad) return;
    const res = this.session.resources as Record<string, number>;
    const ownedIds = Object.keys(this.squad.ownedCores).filter((id) => (this.squad!.ownedCores[id] ?? 0) > 0);
    const yolkP = this.buildings ? galleryDoubleYolkP(getBuildingLevel(this.buildings, 'bld_rsv_core_gallery')) : 0;
    const r = synthesizeCore(DEFAULT_S7_CORE_SOURCE_CONFIG, Math.floor(res.coreFrag ?? 0), new S7AutoBattleRng(`synth:${Date.now()}`), ownedIds, yolkP);
    if (!r.ok) { if (this.vaultMsgLabel) this.vaultMsgLabel.string = r.reason === 'insufficient' ? `星核碎片不够（需 ${DEFAULT_S7_CORE_SOURCE_CONFIG.synthesisCost}）` : '合成池为空'; return; }
    res.coreFrag -= r.fragSpent;
    for (const cid of r.coreIds) grantCore(this.squad, cid);
    if (this.vaultMsgLabel) this.vaultMsgLabel.string = r.doubleYolk ? `🥚 双黄蛋！开出：${r.coreIds.map((c) => this.coreName(c)).join(' + ')}！` : `开出：${this.coreName(r.coreIds[0])}！`;
    this.persist(); this.refresh(); this.refreshVault();
  }

  private onRedeemCore(coreId: string, gemCost: number): void {
    if (!this.session || !this.squad) return;
    const cfgEntry = DEFAULT_S7_CORE_SOURCE_CONFIG.vaultCores.find((e) => e.coreId === coreId);
    if (cfgEntry?.graduation && (this.squad.ownedCores[coreId] ?? 0) > 0) return; // 毕业核唯一解锁（流通核可复购）
    const res = this.session.resources as Record<string, number>;
    if ((res.starGem ?? 0) < gemCost) { if (this.vaultMsgLabel) this.vaultMsgLabel.string = '星空宝石不够'; return; }
    res.starGem -= gemCost;
    grantCore(this.squad, coreId);
    if (this.vaultMsgLabel) this.vaultMsgLabel.string = `兑换：${this.coreName(coreId)}！`;
    this.persist(); this.refresh(); this.refreshVault();
  }

  private onRedeemShip(shipId: string, gemCost: number): void {
    if (!this.session || !this.squad) return;
    if (this.squad.ownedShips.includes(shipId)) return;
    const res = this.session.resources as Record<string, number>;
    if ((res.starGem ?? 0) < gemCost) { if (this.vaultMsgLabel) this.vaultMsgLabel.string = '星空宝石不够'; return; }
    res.starGem -= gemCost;
    grantShip(this.squad, shipId);
    if (this.vaultMsgLabel) this.vaultMsgLabel.string = `兑换专属舰：${this.unitName('ship', shipId)}！`;
    this.persist(); this.refresh(); this.refreshVault();
  }

  /** 搭扩张宝藏开箱浮层（默认隐藏·盖在背包之上·首次全池自选/之后随机三选一）。 */
  private buildExpOpenPanel(W: number, H: number): void {
    const panel = new Node('S7ExpOpen'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 205); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.92, dh = H * 0.5;
    dim.fillColor = new Color(28, 24, 44, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 22); dim.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.expOpenNode = panel;
    this.expOpenTitleLabel = this.mkPanelLabel(panel, '', 34, new Color(210, 195, 245), 0, dh * 0.40);
    this.expOpenMsgLabel = this.mkPanelLabel(panel, '', 24, new Color(210, 220, 240), 0, dh * 0.28);
    const list = new Node('expOptList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.expOpenListNode = list;
    // 巡检批 #15：下移配合选项卡行距压缩——首次全池自选排到第 3 行也不压返回键。
    this.addBtn(panel, '返回背包', 240, 76, new Color(120, 90, 160, 255), 0, -dh * 0.41, () => { panel.active = false; this.refreshBackpack(); }, 28);
  }

  /** 开扩张宝藏（有货→掷核选项·进开箱浮层·首次=全池自选/非首次=随机三选一·选那刻才扣箱）。 */
  private openExpOpenUI(): void {
    if (!this.playerState || !this.expOpenNode) return;
    if (getChestCount(this.playerState.chests, 'expansionTreasure') < 1) return;
    const isFirstSelect = this.playerState.expansionOpenedCount <= 0;
    const ownedIdsExp = this.squad ? Object.keys(this.squad.ownedCores).filter((id) => (this.squad!.ownedCores[id] ?? 0) > 0) : [];
    const options = rollExpansionChoices(DEFAULT_S7_CORE_SOURCE_CONFIG, isFirstSelect, new S7AutoBattleRng(`exp:${Date.now()}`), ownedIdsExp);
    if (options.length === 0) return;
    this.expOpen = { options, isFirstSelect, picked: false, consumed: false };
    const parent = this.expOpenNode.parent;
    if (parent) this.expOpenNode.setSiblingIndex(parent.children.length - 1);
    this.expOpenNode.active = true;
    if (this.expOpenMsgLabel) this.expOpenMsgLabel.string = '';
    this.refreshExpOpen();
  }

  private refreshExpOpen(): void {
    const e = this.expOpen;
    if (!e || !this.expOpenListNode) return;
    if (this.expOpenTitleLabel) this.expOpenTitleLabel.string = e.isFirstSelect ? '🌠 扩张宝藏 · 首次全池自选' : '🌠 扩张宝藏 · 随机三选一';
    if (this.expOpenMsgLabel && !this.expOpenMsgLabel.string) this.expOpenMsgLabel.string = e.picked ? '已选取' : '选一颗星核';
    this.expOpenListNode.removeAllChildren();
    const n = e.options.length;
    const perRow = Math.min(n, 3);
    const cardW = Math.min(this.viewW * 0.27, 210);
    const gap = this.viewW * 0.30;
    // 巡检批 #15：卡高 118/行距 130（原 130/150）——首次全池自选 3 行也留住与「返回背包」≥8px，行间 12px。
    for (let i = 0; i < n; i += 1) {
      const colu = i % perRow, rowi = Math.floor(i / perRow);
      const rowCount = Math.min(perRow, n - rowi * perRow);
      const startX = -((rowCount - 1) * gap) / 2;
      const x = startX + colu * gap;
      const y = this.viewH * 0.075 - rowi * 130;
      const coreId = e.options[i];
      const card = new Node('expCard'); card.layer = this.node.layer; this.expOpenListNode.addChild(card); card.setPosition(x, y, 0);
      card.addComponent(UITransform).setContentSize(cardW, 118);
      const bg = card.addComponent(Graphics); bg.fillColor = new Color(50, 46, 76, 255); bg.roundRect(-cardW / 2, -59, cardW, 118, 12); bg.fill();
      const tl = this.mkPanelLabel(card, this.coreName(coreId), 22, new Color(228, 224, 248), 0, 18);
      tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(cardW - 14, 56);
      if (!e.picked) this.addBtn(card, '选这个', cardW - 34, 46, new Color(150, 110, 200, 255), 0, -34, () => this.onPickExpOption(coreId), 22);
    }
  }

  /** 选取扩张宝藏的一颗核：扣箱(首选那刻)+expansionOpenedCount+1+grantCore→关浮层。 */
  private onPickExpOption(coreId: string): void {
    const e = this.expOpen;
    if (!e || e.picked || !this.playerState || !this.squad) return;
    if (!e.consumed) { if (!openChest(this.playerState.chests, 'expansionTreasure')) return; e.consumed = true; this.playerState.expansionOpenedCount += 1; }
    e.picked = true;
    grantCore(this.squad, coreId);
    if (this.expOpenMsgLabel) this.expOpenMsgLabel.string = `获得星核：${this.coreName(coreId)}！`;
    this.persist();
    this.refresh();
    this.refreshExpOpen();
  }

  // ===== 邮件界面（阶段一 G2·领取入账 + 列表） =====

  /** 搭邮件浮层（默认隐藏）：标题 + 计数 + 一键领取 + 邮件列表(每封 领取/已领/已过期) + 结果行 + 返回。 */
  private buildMailPanel(W: number, H: number): void {
    const panel = new Node('S7Mail'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(20, 22, 32, 255); g.rect(-W / 2, -H / 2, W, H); g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
    panel.active = false;
    this.mailNode = panel;
    const band = getS7UsableBand();
    const topY = band.usableTopY, botY = band.usableBottomY;
    this.mkPanelLabel(panel, '📮 邮件', 40, new Color(210, 220, 240), -W * 0.32, topY - 30);
    this.addBtn(panel, '一键领取', 200, 70, new Color(70, 150, 110, 255), W * 0.28, topY - 34, () => this.onClaimAllMail(), 28);
    this.mailInfoLabel = this.mkPanelLabel(panel, '', 24, new Color(220, 228, 245), 0, topY - 96);
    const list = new Node('mailList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.mailListNode = list;
    this.mailResultLabel = this.mkPanelLabel(panel, '', 26, new Color(170, 220, 175), 0, botY + 132);
    this.addBtn(panel, '返回星港', 240, 76, new Color(120, 90, 160, 255), 0, botY + 50, () => { panel.active = false; }, 28);
  }

  private openMail(): void {
    if (!this.mailNode || !this.playerState) return;
    pruneExpiredMail(this.playerState.mailbox, Date.now()); // 进邮箱先清「过期未领」
    if (this.mailResultLabel) this.mailResultLabel.string = '';
    this.mailNode.active = true;
    this.persist();
    this.refresh();
    this.refreshMail();
  }

  /** 刷新邮件列表：计数 + 重建邮件行（最新在上·每封显标题/奖励/领取态）。 */
  private refreshMail(): void {
    if (!this.playerState || !this.mailListNode) return;
    const now = Date.now();
    const box = this.playerState.mailbox;
    const claimable = claimableMailCount(box, now);
    const unread = unreadMailCount(box);
    if (this.mailInfoLabel) this.mailInfoLabel.string = `共 ${box.mails.length} 封 · 未读 ${unread} · 可领 ${claimable}`;
    this.mailListNode.removeAllChildren();
    // 最新在上；灰盒上限显示 7 封，超出提示。
    const mails = box.mails.slice().reverse();
    const MAX_ROWS = 7;
    let y = getS7UsableBand().usableTopY - 168;
    for (let i = 0; i < Math.min(mails.length, MAX_ROWS); i++) {
      const m = mails[i];
      const expired = m.expireAt !== null && now > m.expireAt;
      const row = new Node('mailRow'); row.layer = this.node.layer; this.mailListNode.addChild(row); row.setPosition(0, y, 0);
      const g = row.addComponent(Graphics);
      g.fillColor = m.claimed ? new Color(36, 40, 52, 255) : new Color(46, 54, 74, 255);
      g.roundRect(-this.viewW * 0.44, -36, this.viewW * 0.88, 72, 10); g.fill();
      const txt = `${m.title || m.kind}　${this.mailRewardText(m.rewards)}`;
      const tl = this.mkPanelLabel(row, txt, 22, m.claimed ? new Color(150, 158, 175) : new Color(225, 232, 248), -this.viewW * 0.18, 0);
      tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(this.viewW * 0.52, 64);
      if (m.claimed) this.mkPanelLabel(row, '已领', 24, new Color(120, 130, 150), this.viewW * 0.34, 0);
      else if (expired) this.mkPanelLabel(row, '已过期', 22, new Color(180, 120, 120), this.viewW * 0.34, 0);
      else this.addBtn(row, '领取', 140, 60, new Color(70, 150, 110, 255), this.viewW * 0.34, 0, () => this.onClaimMail(m.id), 26);
      y -= 84;
    }
    if (mails.length > MAX_ROWS) this.mkPanelLabel(this.mailListNode, `… 还有 ${mails.length - MAX_ROWS} 封（先领前面的）`, 22, new Color(170, 180, 200), 0, y - 6);
  }

  /** 领取一封邮件：领取→按 type 入账→结果反馈。 */
  private onClaimMail(id: string): void {
    if (!this.playerState) return;
    const res = claimMail(this.playerState.mailbox, id, Date.now());
    if (!res.ok) {
      if (this.mailResultLabel) this.mailResultLabel.string = res.reason === 'already_claimed' ? '这封已领过了' : res.reason === 'expired' ? '这封已过期' : '邮件不存在';
      this.refreshMail();
      return;
    }
    const texts = res.rewards.map((rw) => this.applyMailReward(rw)).filter((t) => t.length > 0);
    if (this.mailResultLabel) this.mailResultLabel.string = texts.length > 0 ? `已领取：${texts.join('、')}` : '已领取（空邮件）';
    this.sound.playSfx('reward_claim');
    this.persist();
    this.refresh();
    this.refreshMail();
  }

  /** 一键领取所有「未领且未过期」的邮件，奖励合并展示。 */
  private onClaimAllMail(): void {
    if (!this.playerState) return;
    const now = Date.now();
    const ids = this.playerState.mailbox.mails.filter((m) => !m.claimed && (m.expireAt === null || now <= m.expireAt)).map((m) => m.id);
    if (ids.length === 0) { if (this.mailResultLabel) this.mailResultLabel.string = '没有可领取的邮件'; return; }
    const texts: string[] = [];
    for (const id of ids) {
      const res = claimMail(this.playerState.mailbox, id, now);
      if (res.ok) for (const rw of res.rewards) { const t = this.applyMailReward(rw); if (t) texts.push(t); }
    }
    if (this.mailResultLabel) this.mailResultLabel.string = `领取 ${ids.length} 封：${texts.join('、') || '（空）'}`;
    this.persist();
    this.refresh();
    this.refreshMail();
  }

  /** 把一笔邮件奖励按 type 入账，返回中文短描述（与 applySalvageReward 同风格）。 */
  private applyMailReward(rw: S7MailReward): string {
    if (!this.playerState || !this.session || !this.squad) return '';
    switch (rw.type) {
      case 'resource': {
        // exShard:<id> 约定（抽卡轮换补发）→ 进专属碎片库存（别进 13 键钱包）。
        if (rw.resourceId.startsWith('exShard:')) {
          const uid = rw.resourceId.slice('exShard:'.length);
          addExclusiveShards(this.playerState.exclusiveShards, uid, rw.amount);
          return `${this.unitNameAny(uid)}碎片×${rw.amount}`;
        }
        const res = this.session.resources as Record<string, number>;
        if (res[rw.resourceId] === undefined) return ''; // 非钱包键护栏
        res[rw.resourceId] += rw.amount;
        return `${this.zhRes(rw.resourceId)}×${rw.amount}`;
      }
      case 'chest':
        addChest(this.playerState.chests, rw.chestId as S7ChestType, rw.amount);
        return `${this.chestName(rw.chestId)}×${rw.amount}`;
      case 'unit': {
        // 本体：未拥有→发本体(C阶/1★起点)；已拥有→折 15 专属碎片（同抽卡重复折碎片口径）。
        const owned = rw.unitKind === 'ship' ? this.squad.ownedShips : this.squad.ownedPilots;
        if (!owned.includes(rw.unitId)) {
          if (rw.unitKind === 'ship') grantShip(this.squad, rw.unitId); else grantPilot(this.squad, rw.unitId);
          return `${this.unitName(rw.unitKind, rw.unitId)}[本体]`;
        }
        addExclusiveShards(this.playerState.exclusiveShards, rw.unitId, 15);
        return `${this.unitName(rw.unitKind, rw.unitId)}碎片×15`;
      }
      case 'population':
        if (rw.pop === 'resident') this.playerState.population.residents += rw.amount;
        else this.playerState.population.workers += rw.amount;
        return rw.pop === 'resident' ? `居民×${rw.amount}` : `工人×${rw.amount}`;
    }
  }

  /**
   * DEV-TEMP·发一封混合奖励测试邮件（验 G2 邮件领取入账：软货币 / 专属碎片 / 宝箱 / 本体 四类各一）。正式版删。
   * 本体用未拥有的 shp08 → 首次领发本体；再点一次「发测试邮件」并领取 → 此时已拥有 → 折 15 专属碎片（两条路径都可验）。
   */
  private devSendTestMail(): void {
    if (!this.playerState) return;
    const rewards: S7MailReward[] = [
      { type: 'resource', resourceId: 'starOre', amount: 500 },     // 软货币→钱包
      { type: 'resource', resourceId: 'exShard:shp01', amount: 20 }, // exShard:<id>→专属碎片库
      { type: 'chest', chestId: 'starlightCargo', amount: 1 },       // 宝箱→宝箱库
      { type: 'unit', unitKind: 'ship', unitId: 'shp08' },           // 本体→未拥有发本体/已拥有折15
    ];
    addMail(this.playerState.mailbox, { kind: 'dev_test', title: 'DEV 测试邮件', rewards, createdAt: Date.now() });
    this.persist();
    this.refresh();
    this.setResult('已发 1 封测试邮件，去「邮件」领取', new Color(150, 200, 230));
  }

  // ===== F·关卡三选一发奖（灰盒·首通限定·三档稀缺池·Boss大奖·看广告×2）=====

  /** 搭三选一发奖浮层（默认隐藏）：标题 + 固定/大奖行 + 三张选项卡 + 看广告×2 + 结果行。无关闭键——必须选 1 个才离开。 */
  private buildLevelRewardPanel(W: number, H: number): void {
    const panel = new Node('S7LevelReward'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 205); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.92, dh = H * 0.52;
    dim.fillColor = new Color(26, 30, 46, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 22); dim.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸·不点空白关（必须选 1 个）
    panel.active = false;
    this.levelRewardNode = panel;
    this.levelRewardTitleLabel = this.mkPanelLabel(panel, '', 36, new Color(255, 225, 150), 0, dh * 0.40);
    this.levelRewardFixedLabel = this.mkPanelLabel(panel, '', 24, new Color(200, 230, 200), 0, dh * 0.28);
    const list = new Node('lvlRewardList'); list.layer = this.node.layer; panel.addChild(list); list.setPosition(0, 0, 0);
    this.levelRewardListNode = list;
    // ③(块2真机终稿)三选一屏＝唯一奖励屏；块5(S13 决策⑥)：**全部关卡**首通选完后同屏并排浮现
    //   「📺固定奖励×2」(#3) + 「📺再选一个」(#4) + 「继续」——两键各自每日1次/券态/新手隐走统一三态；
    //   两键都不可显时选完直接走（不留只剩「继续」的空步·守五原则②"不为翻倍多走一步"）。
    const adBtn = this.addBtn(panel, '📺 固定奖励×2', 330, 76, new Color(60, 130, 90, 255), -W * 0.23, -dh * 0.20, () => this.onLevelRewardAdDouble(), 24);
    this.levelRewardAdLabel = adBtn;
    this.levelRewardAdBtnNode = adBtn.node.parent;
    if (this.levelRewardAdBtnNode) this.levelRewardAdBtnNode.active = false;
    const exBtn = this.addBtn(panel, '📺 再选一个', 330, 76, new Color(90, 110, 170, 255), W * 0.23, -dh * 0.20, () => this.onLevelRewardExtraPick(), 24);
    this.levelRewardExtraLabel = exBtn;
    this.levelRewardExtraBtnNode = exBtn.node.parent;
    if (this.levelRewardExtraBtnNode) this.levelRewardExtraBtnNode.active = false;
    // 一窗两点（Ron 07-16·首胜结算改造）：原「继续」中转步删除——终局三键直接进屏
    //（同结算窗三键语义/孔位），选完奖励即亮：不看广告一步点走。伤害统计小键右上常驻（Ron 点名保留）。
    const xs3 = this.dialogBtnRowXs(3);
    const endDefs: ReadonlyArray<readonly [string, Color, () => void]> = [
      ['选择关卡', new Color(70, 130, 180, 255), () => this.onLevelRewardEnd('level')],
      ['返回星港', new Color(120, 90, 160, 255), () => this.onLevelRewardEnd('home')],
      ['下一关 ▶', new Color(225, 150, 45, 255), () => this.onLevelRewardEnd('next')],
    ];
    this.levelRewardEndBtnNodes = endDefs.map(([txt, col, cb], i) => {
      const b = this.addBtn(panel, txt, 210, 92, col, xs3[i] ?? 0, -dh * 0.33, cb, 30).node.parent!;
      b.active = false;
      return b;
    });
    const statsBtn = this.addBtn(panel, '📊 统计', 150, 52, new Color(90, 100, 130, 255), dw * 0.34, dh * 0.40, () => this.openBattleStats(), 20);
    this.levelRewardStatsBtnNode = statsBtn.node.parent;
    if (this.levelRewardStatsBtnNode) this.levelRewardStatsBtnNode.active = false;
    this.levelRewardMsgLabel = this.mkPanelLabel(panel, '', 22, new Color(255, 225, 150), 0, -dh * 0.43); // 翻倍飘字/反馈行
  }

  /** K：首通胜利→按配置救回 居民/工人（§7/§11·非首通不救回）。就地加人口、拼结果文案。 */
  private grantNodeRescuePop(nodeId: string, outcome: S7PlayNodeOutcome): void {
    this.pendingRescueText = '';
    if (!this.playerState || !outcome.won || !outcome.settlement || !outcome.settlement.ok) return;
    const g = resolveNodeRescue(DEFAULT_S7_POPULATION_SOURCE_CONFIG, nodeId);
    if (!g) return;
    this.playerState.population.residents += g.residents;
    this.playerState.population.workers += g.workers;
    const parts: string[] = [];
    if (g.residents > 0) parts.push(`救回居民×${g.residents}`);
    if (g.workers > 0) parts.push(`救回工人×${g.workers}`);
    this.pendingRescueText = parts.join(' ');
  }

  /** F：首通胜利→抓取三选一上下文（结果弹窗弹出时展示）。非首通/none档/无奖→不弹。 */
  private captureLevelReward(nodeId: string, outcome: S7PlayNodeOutcome): void {
    this.pendingLevelReward = null;
    if (!outcome.won || !outcome.settlement || !outcome.settlement.ok || !this.runtime) return;
    const node = this.runtime.getById<S7MainlineNodeConfig>('mainline_node_config', nodeId);
    const stage = resolveLevelStage(node?.nodeTypeTag ?? '', DEFAULT_S7_LEVEL_REWARD_CONFIG);
    if (stage === 'none') return;
    // 1a 首通固定补充软货币（驾驶记录+星贝·§8）：一次性发钱包 + 并入 softGrants（供显示 & 看广告×2 翻倍）。
    const res = this.session?.resources as Record<string, number> | undefined;
    const bonus = res ? DEFAULT_S7_LEVEL_REWARD_CONFIG.fixedSoftBonus.filter((b) => res[b.resourceId] !== undefined) : [];
    for (const b of bonus) res![b.resourceId] += b.amount;
    const softGrants = [...outcome.settlement.grants, ...bonus];
    const allNodes = this.runtime.getAll<S7MainlineNodeConfig>('mainline_node_config').map((n) => ({ nodeId: n.nodeId, nodeTypeTag: n.nodeTypeTag }));
    const candidates: S7UnitCandidates = { // Ron 拍板：随机指定专属碎片从「全部单位」随机
      ships: this.runtime.getAll<S7ShipConfig>('ship_config').map((c) => c.shipId),
      pilots: this.runtime.getAll<S7PilotConfig>('pilot_config').map((c) => c.pilotId),
    };
    const rng = new S7AutoBattleRng(`levelreward:${nodeId}:${S7_DEMO_RUN_SEED}`);
    let choices = rollLevelChoices(DEFAULT_S7_LEVEL_REWARD_CONFIG, stage, rng, candidates);
    // M1 关1强引导：三选一写死「精良插件 / 普通信标 / 星矿」、强制选星矿（GDD-M §第1关）。
    // 不走随机池——保证玩家第一次见到的三项与教学文案一致、且必有星矿可选（下一步解锁建筑要用）。
    let forcedPickIndex: number | undefined;
    if (this.playerState && !this.playerState.tutorial.strongGuideDone) {
      const step = this.playerState.tutorial.strongGuideStep;
      if (step === 2 && nodeId === S7_TUTORIAL_LEVEL1_NODE) {
        choices = [
          { kind: 'plugin', quality: 'fine', count: 1 },
          { kind: 'resource', resourceId: 'beaconCommon', amount: 1 },
          { kind: 'resource', resourceId: 'starOre', amount: S7_TUTORIAL_LEVEL1_STARORE },
        ];
        forcedPickIndex = 2;
      } else if (step === 12) {
        // 关2强引导（变更#4）：三选一写死「武器槽·精良(→急速弹链) / 补给券 / 普通信标」、强制选武器插件。
        // 选前只显示槽位+品质（slotTag），选后由 applyLevelReward 按 revealPluginId 揭晓真实插件名。
        const p = S7_TUTORIAL_LEVEL2_WEAPON_PLUGIN;
        choices = [
          { kind: 'plugin', quality: p.quality, count: 1, slotTag: p.slotTag, revealPluginId: p.pluginId },
          { kind: 'resource', resourceId: 'supplyTicket', amount: 3 },
          { kind: 'resource', resourceId: 'beaconCommon', amount: 1 },
        ];
        forcedPickIndex = 0;
      } else if (step === 21) {
        // 关3强引导：三选一写死「补给券×2 / 合金 / 普通信标」、强制选补给券（下一步要用它招募扩编队）。
        choices = [
          { kind: 'resource', resourceId: 'supplyTicket', amount: S7_TUTORIAL_LEVEL3_TICKETS },
          { kind: 'resource', resourceId: 'hullAlloy', amount: 40 },
          { kind: 'resource', resourceId: 'beaconCommon', amount: 1 },
        ];
        forcedPickIndex = 0;
      } else if (step === 34) {
        // 关4强引导：三选一写死「普通信标×1 / 合金 / 补给券」、强制选普通信标（下一步解锁打捞港要用）。
        choices = [
          { kind: 'resource', resourceId: 'beaconCommon', amount: 1 },
          { kind: 'resource', resourceId: 'hullAlloy', amount: 60 },
          { kind: 'resource', resourceId: 'supplyTicket', amount: 1 },
        ];
        forcedPickIndex = 0;
      }
      // 关5(step40)不强制：用正常随机池三选一，让玩家"毕业自选"（星贝是必得软货币·不进三选一·GDD §S8）。
    }
    const isBoss = stage === 'boss';
    const bossGrand = isBoss ? resolveBossGrand(DEFAULT_S7_LEVEL_REWARD_CONFIG, firstBossNodeId(allNodes) === nodeId) : null;
    if (choices.length === 0) {
      // 防御（现实中三档池都 ≥3 不会空）：无三选一可发 → 有 Boss 大奖就直接发、不弹空面板（避免无选项卡卡死）。
      if (bossGrand) this.applyLevelReward(bossGrand);
      return;
    }
    this.pendingLevelReward = {
      nodeId, stage, isBoss, choices, bossGrand,
      softGrants,
      // 块5(S13 决策⑥)：#3/#4 扩至全部关卡——"要不要浮现"不再看关卡档，由选完那刻的统一三态定（每日1次/券/新手隐）。
      forcedPickIndex,
      pickedIndex: null,
      softDoubled: false,
      extraPickArmed: false,
      extraPickedIndex: null,
    };
  }

  /** 展示三选一发奖浮层（置顶盖在结果弹窗之上）。 */
  private openLevelReward(): void {
    if (!this.levelRewardNode || !this.pendingLevelReward) return;
    const parent = this.levelRewardNode.parent;
    if (parent) this.levelRewardNode.setSiblingIndex(parent.children.length - 1); // 置顶
    this.levelRewardNode.active = true;
    if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = '';
    this.refreshLevelReward();
    // M1 关1-4 强引导：三选一是写死的强制项 → 盖遮罩高光该卡、锁住其余选项。
    if (this.isStrongGuideActive() && this.pendingLevelReward.forcedPickIndex !== undefined) this.showTutorialForcedChoice();
    // M3 关5(step40)：不强制 → 顶部提示条引导玩家"毕业自选"，选完(pendingLevelReward 清空)由 update() 续到 step41。
    else if (this.isStrongGuideActive() && this.playerState?.tutorial.strongGuideStep === 40) this.showTutorialGraduationPick();
  }

  private stageName(stage: S7LevelRewardStage): string {
    return stage === 'boss' ? 'Boss关' : stage === 'elite' ? '精英关' : '普通关';
  }

  /** 刷新三选一屏(唯一奖励屏)：标题 + 固定奖励列表(可×2) + 必给大奖预告 + 三张选卡 + 选完浮现两键/继续（块5·全部关卡）。
   *  卡片态：未选→全可点；已选→选中✓/其余灰；#4 广告看完(extraPickArmed)→剩两张恢复可点；再选完→两张都✓。 */
  private refreshLevelReward(): void {
    const p = this.pendingLevelReward;
    if (!p || !this.levelRewardListNode) return;
    const picked = p.pickedIndex !== null;
    const x2 = p.softDoubled;
    // 一窗两点：非教程=终点窗，胜利 banner 并入标题（结算窗不再弹出·战报感一屏齐）。
    if (this.levelRewardTitleLabel) {
      this.levelRewardTitleLabel.string = this.isStrongGuideActive()
        ? `🎁 ${p.nodeId} · ${this.stageName(p.stage)}首通奖励`
        : `★ 战斗胜利 ★　🎁 ${this.stageName(p.stage)}首通奖励`;
    }
    // 固定奖励列表（必得软货币·看广告可×2·就地显示翻倍值）+ 必给大奖预告（精英/Boss）。
    const fixedParts: string[] = [];
    const soft = p.softGrants.map((g) => `${this.zhRes(g.resourceId)}×${x2 ? g.amount * 2 : g.amount}`).join('　');
    if (soft) fixedParts.push(`固定奖励${x2 ? '(已×2)' : ''}：${soft}`);
    if (p.bossGrand) fixedParts.push(`必给大奖：${this.levelRewardText(p.bossGrand)}`);
    if (this.levelRewardFixedLabel) this.levelRewardFixedLabel.string = fixedParts.join('\n');
    this.levelRewardListNode.removeAllChildren();
    const n = p.choices.length;
    const cardW = Math.min(this.viewW * 0.27, 230);
    const gap = this.viewW * 0.30;
    const startX = -((n - 1) * gap) / 2;
    const rePickable = p.extraPickArmed && p.extraPickedIndex === null; // #4 广告已看·等第二选
    for (let i = 0; i < n; i++) {
      const c = p.choices[i];
      const x = startX + i * gap;
      const isPicked = p.pickedIndex === i;
      const isExtra = p.extraPickedIndex === i;
      const canTap = !picked || (rePickable && !isPicked);
      const card = new Node('lvlCard'); card.layer = this.node.layer; this.levelRewardListNode.addChild(card); card.setPosition(x, this.viewH * 0.02, 0);
      card.addComponent(UITransform).setContentSize(cardW, 180);
      const cardColor = isPicked || isExtra ? new Color(70, 112, 82, 255) : canTap ? new Color(48, 58, 84, 255) : new Color(38, 42, 52, 255);
      const bg = card.addComponent(Graphics); bg.fillColor = cardColor; bg.roundRect(-cardW / 2, -90, cardW, 180, 14); bg.fill();
      const tl = this.mkPanelLabel(card, `${isPicked || isExtra ? '✓ ' : ''}${this.levelRewardText(c)}`, 24, picked && !isPicked && !isExtra && !canTap ? new Color(120, 130, 148) : new Color(230, 236, 250), 0, 26);
      tl.overflow = Label.Overflow.SHRINK; tl.getComponent(UITransform)?.setContentSize(cardW - 16, 110);
      if (canTap) this.addBtn(card, rePickable ? '再拿这个' : '选这个', cardW - 40, 56, new Color(225, 150, 45, 255), 0, -56, () => this.onPickLevelChoice(i), 24);
    }
    // 选完后浮现（块5·全部关卡·统一三态）：#3 固定奖励×2 + #4 再选一个 + 继续。
    // 已用过的键保留"✓已完成"回执（本场反馈优先于隐藏）；没用过且三态=hidden 的键不出现（非置灰）。
    if (this.levelRewardAdBtnNode) {
      const st3 = this.adButtonState('clear_reward_double');
      const show3 = picked && p.softGrants.length > 0 && (x2 || st3.kind !== 'hidden');
      this.levelRewardAdBtnNode.active = show3;
      if (this.levelRewardAdLabel) {
        this.levelRewardAdLabel.string = x2 ? '✓ 固定奖励已翻倍'
          : st3.kind === 'ticket' ? adTicketButtonLabel('📺 固定奖励×2', st3.tickets) : '📺 固定奖励×2';
        this.clampBtnLabel(this.levelRewardAdLabel);
      }
    }
    if (this.levelRewardExtraBtnNode) {
      const st4 = this.adButtonState('triple_pick_extra');
      const done4 = p.extraPickedIndex !== null;
      const show4 = picked && p.choices.length === 3 && (done4 || p.extraPickArmed || st4.kind !== 'hidden');
      this.levelRewardExtraBtnNode.active = show4;
      if (this.levelRewardExtraLabel) {
        this.levelRewardExtraLabel.string = done4 ? '✓ 已再选一张'
          : p.extraPickArmed ? '点上方卡·再选一张'
            : st4.kind === 'ticket' ? adTicketButtonLabel('📺 再选一个', st4.tickets) : '📺 再选一个';
        this.clampBtnLabel(this.levelRewardExtraLabel);
      }
    }
    // 一窗两点：终局三键=选完浮现（教程期不显·教程选完直接走不会到这）；📊 统计=常驻（选前也可看）。
    const showEnd = picked && !this.isStrongGuideActive();
    for (const b of this.levelRewardEndBtnNodes) b.active = showEnd;
    if (this.levelRewardStatsBtnNode) this.levelRewardStatsBtnNode.active = !this.isStrongGuideActive();
  }

  /** 一笔关卡奖励的中文短描述。 */
  private levelRewardText(r: S7LevelReward): string {
    switch (r.kind) {
      case 'resource': return `${this.zhRes(r.resourceId)}×${r.amount}`;
      case 'exclusiveShard': return `${this.unitName(r.unitKind, r.unitId)}专属碎片×${r.amount}`;
      case 'plugin': {
        const q = r.quality === 'fine' ? '精良' : r.quality === 'superior' ? '优秀' : '传奇';
        // 变更#4：选前只显示"槽位·品质"（有 slotTag 时），不揭晓具体插件名；无 slotTag 走旧"品质插件"。
        if (r.slotTag) return `${S7_SLOT_TAG_NAMES[r.slotTag]}槽·${q}${r.count > 1 ? `×${r.count}` : ''}`;
        return `${q}插件${r.count > 1 ? `×${r.count}` : ''}`;
      }
      case 'chest': return `${this.chestName(r.chestId)}×${r.amount}`;
      case 'core': return `${this.coreName(r.coreId)}[核]`;
    }
  }

  /** ③终稿+块5·点一张选卡：首选=入账选中项+Boss大奖 → 有键可显则停留同屏（#3/#4/继续）、否则直接走；
   *  #4 二选（extraPickArmed）=只能点剩下两张之一（canPickExtra 守门）→ 再发一份 → 第二张也锁定✓。 */
  private onPickLevelChoice(index: number): void {
    const p = this.pendingLevelReward;
    if (!p || !this.playerState || !this.session) return;
    // —— #4 二选路径（已首选 + 广告已看 + 未再选）——
    if (p.pickedIndex !== null) {
      if (!p.extraPickArmed || p.extraPickedIndex !== null) return; // 已选锁定（防重复点）
      if (!canPickExtra(p.pickedIndex, index, p.choices.length)) { this.hubToast('从剩下的两张里选一张'); return; }
      const extra = p.choices[index];
      if (!extra) return;
      const text = this.applyLevelReward(extra);
      p.extraPickedIndex = index;
      p.extraPickArmed = false;
      this.persist();
      this.refresh();
      this.refreshLevelReward();
      if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = `再选到手：${text}`;
      this.setResult(`再选到手：${text}`, new Color(150, 220, 160));
      return;
    }
    // —— 首选路径 ——
    // 教程强制三选一：只允许点高亮那张（其余点了没反应·提示再点高亮的）。
    if (this.tutorialForcedPickIndex !== null && index !== this.tutorialForcedPickIndex) {
      this.hubToast('点闪烁高亮的那张'); return;
    }
    const chosen = p.choices[index];
    if (!chosen) return;
    // 入账 选中项 + Boss大奖（基础量）。固定软货币结算已发一份；「📺固定奖励×2」在"选完浮现"的广告键里补第二份。
    const texts: string[] = [];
    texts.push(this.applyLevelReward(chosen));
    if (p.bossGrand) texts.push(this.applyLevelReward(p.bossGrand));
    this.persist();
    this.refresh();
    this.setResult(`关卡奖励到手：${texts.filter((t) => t).join('、')}`, new Color(150, 220, 160));
    // 块5(S13 决策⑥)：全部关卡——选完若 #3/#4 至少一键可显 → 锁卡停留同屏；两键都不可显（每日已用尽&无券/新手期）
    // → 直接走（不留只剩「继续」的空步·教程期两键必隐=行为与旧"选完直接关"一致，step40 毕业选卡照常续步）。
    p.pickedIndex = index;
    if (this.isStrongGuideActive()) {
      // 教程封板路径照旧：选完直接走（广告键教程期必隐·后续步序靠结算窗高亮键推进）。
      this.finishLevelReward();
    } else {
      // 一窗两点：选完停留同屏——终局三键亮起（+广告键若可显），不看广告直接点「下一关」走人。
      this.refreshLevelReward();
    }
  }

  /** 收口：关三选一屏 → (Boss)弹大奖特写弹窗[②] → 结算窗(已在底下·瘦身)。「继续」和"无键直接走"共用。 */
  private finishLevelReward(): void {
    const p = this.pendingLevelReward;
    const grand = p?.bossGrand ?? null;
    this.pendingLevelReward = null;
    if (this.levelRewardNode) this.levelRewardNode.active = false;
    if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = '';
    // ②Boss首通：结算窗出现前弹大奖特写(陨星弹/星辉货舱)。无 bossGrand → 直接露出底下的结算窗。
    if (grand) this.openGrandRewardPopup(grand);
  }

  /** 一窗两点终局（Ron 07-16·替代旧「继续」中转步）：从三选一屏直接执行终局动作；
   *  Boss 大奖特写插在中间（收下→续跑动作）；#4 已看广告未再选 → 拦下（广告已花别浪费·与首选"必须选1"同精神）。 */
  private onLevelRewardEnd(action: 'level' | 'home' | 'next'): void {
    const p = this.pendingLevelReward;
    if (!p || p.pickedIndex === null) return;
    if (p.extraPickArmed && p.extraPickedIndex === null) {
      if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = '广告已看完——先从剩下两张里再选一张，别浪费';
      return;
    }
    const grand = p.bossGrand;
    this.pendingLevelReward = null;
    if (this.levelRewardNode) this.levelRewardNode.active = false;
    if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = '';
    const go = () => {
      if (action === 'level') this.onResultGoLevelSelect();
      else if (action === 'home') this.onResultGoHome();
      else this.onResultGoPrebattle();
    };
    if (grand) {
      this.pendingGrandAction = go; // 大奖特写照弹（高光时刻保留）·收下即续跑终局
      this.openGrandRewardPopup(grand);
    } else {
      go();
    }
  }

  /** 「📺固定奖励×2」(#3·块5 全部关卡)：只把首通必得(固定)软货币再补一份(合计×2)；唯一核/三选一选中项/Boss星辉货舱均不翻。
   *  就地把固定奖励行刷成翻倍值 + 飘字"+X→+2X" + 键变"已翻倍✓"。每日1次/券态/失败退券走统一广告流。 */
  private onLevelRewardAdDouble(): void {
    const p = this.pendingLevelReward;
    if (!p || p.pickedIndex === null || p.softDoubled || !this.session) return;
    this.runAdPoint('clear_reward_double',
      () => {
        const cur = this.pendingLevelReward;
        if (!cur || cur.softDoubled || !this.session) return;
        cur.softDoubled = true;
        const resmap = this.session.resources as Record<string, number>;
        const parts: string[] = [];
        for (const g of cur.softGrants) {
          if (resmap[g.resourceId] === undefined) continue; // 非钱包键护栏
          resmap[g.resourceId] += g.amount; // 结算已发一份 → 再补一份 = 合计×2
          parts.push(`${this.zhRes(g.resourceId)} +${g.amount}→+${g.amount * 2}`);
        }
        this.persist();
        this.refresh();
        this.refreshLevelReward(); // 固定奖励行就地显示翻倍值 + 广告键变「已翻倍✓」
        if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = `固定奖励已翻倍：${parts.join('，')}`;
      },
      (reason) => {
        this.refreshLevelReward(); // 券态可能已退回·刷键
        if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = reason === 'ad_failed' ? '广告没看完，未翻倍' : reason === 'quota_gone' ? '今日翻倍次数已用完' : '广告加载失败';
      });
  }

  /** 「📺再选一个」(#4·块5)：看广告 → 剩下两张恢复可点 → 玩家再选一张（第二张也锁定✓）。每日1次/券态/失败退券走统一广告流。 */
  private onLevelRewardExtraPick(): void {
    const p = this.pendingLevelReward;
    if (!p || p.pickedIndex === null || p.extraPickArmed || p.extraPickedIndex !== null || p.choices.length !== 3) return;
    this.runAdPoint('triple_pick_extra',
      () => {
        const cur = this.pendingLevelReward;
        if (!cur || cur.pickedIndex === null || cur.extraPickedIndex !== null) return;
        cur.extraPickArmed = true;
        this.persist(); // 记数落盘（广告已消耗·奖励等玩家点卡）
        this.refreshLevelReward();
        if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = '广告看完——从剩下两张里再选一张';
      },
      (reason) => {
        this.refreshLevelReward();
        if (this.levelRewardMsgLabel) this.levelRewardMsgLabel.string = reason === 'ad_failed' ? '广告没看完，不能再选' : reason === 'quota_gone' ? '今日再选次数已用完' : '广告加载失败';
      });
  }

  // ===== ②(块2真机) Boss 首通大奖特写弹窗（陨星弹/星辉货舱·仪式感·灰盒·正式演出随战斗演出块升级）=====

  /** 搭大奖特写弹窗（默认隐藏）：★首通大奖★ + 图标占位 + 大字奖名 + 效果说明 + 收下。 */
  private buildGrandRewardPopup(W: number, H: number): void {
    const panel = new Node('S7GrandReward'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 220); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.82, dh = H * 0.44;
    dim.fillColor = new Color(42, 34, 22, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 24); dim.fill(); // 金调·仪式感
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸·必须点收下
    panel.active = false;
    this.grandRewardNode = panel;
    this.mkPanelLabel(panel, '★ 首通大奖 ★', 32, new Color(255, 220, 140), 0, dh * 0.34);
    // 图标占位（色块方框·正式图标随美术/演出块接）。
    const icon = new Node('gicon'); icon.layer = this.node.layer; panel.addChild(icon); icon.setPosition(0, dh * 0.10, 0);
    icon.addComponent(UITransform).setContentSize(148, 148);
    const ig = icon.addComponent(Graphics); ig.fillColor = new Color(212, 152, 62, 255); ig.roundRect(-74, -74, 148, 148, 18); ig.fill();
    this.mkPanelLabel(icon, '图标', 22, new Color(60, 45, 24), 0, 0);
    this.grandRewardTitleLabel = this.mkPanelLabel(panel, '', 46, new Color(255, 238, 184), 0, -dh * 0.16);
    this.grandRewardDescLabel = this.mkPanelLabel(panel, '', 24, new Color(232, 224, 200), 0, -dh * 0.28);
    this.addBtn(panel, '收下', 260, 84, new Color(212, 152, 62, 255), 0, -dh * 0.40, () => this.onGrandRewardClaim(), 30);
  }

  /** 弹大奖特写（置顶盖在三选一屏/结算窗之上）：设奖名+效果说明。由「继续」触发（仅 Boss 有 bossGrand）。 */
  private openGrandRewardPopup(grand: S7LevelReward): void {
    if (!this.grandRewardNode) return;
    if (this.grandRewardTitleLabel) this.grandRewardTitleLabel.string = this.grandRewardName(grand);
    if (this.grandRewardDescLabel) this.grandRewardDescLabel.string = this.grandRewardEffectText(grand);
    const parent = this.grandRewardNode.parent;
    if (parent) this.grandRewardNode.setSiblingIndex(parent.children.length - 1); // 置顶
    this.grandRewardNode.active = true;
    this.sound.playSfx('reward_claim');
  }

  /** 收下大奖：关特写弹窗 → 一窗两点路径=续跑终局动作；教程旧链（无 pendingGrandAction）=露出底下结算窗。 */
  private onGrandRewardClaim(): void {
    if (this.grandRewardNode) this.grandRewardNode.active = false;
    const act = this.pendingGrandAction;
    this.pendingGrandAction = null;
    if (act) act();
  }

  /** 大奖奖名（核/宝箱取配置名·陨星弹=core07 已改名）。 */
  private grandRewardName(grand: S7LevelReward): string {
    if (grand.kind === 'core') return this.coreName(grand.coreId);
    if (grand.kind === 'chest') return this.chestName(grand.chestId);
    return this.levelRewardText(grand);
  }

  /** 大奖效果说明（核取 core_config.roleNote·如陨星弹"新手核·普攻质变为原子炮"·取自星核真源；宝箱给开箱提示）。 */
  private grandRewardEffectText(grand: S7LevelReward): string {
    if (grand.kind === 'core') {
      const role = this.runtime?.getById<{ roleNote?: string }>('core_config', grand.coreId)?.roleNote;
      return role && role.length > 0 ? role : '装上直接质变战斗';
    }
    if (grand.kind === 'chest') return '开启获得随机星辉奖励（去「背包·宝箱」开）';
    return '';
  }

  /** 把一笔关卡奖励入账（复用 applyMailReward/applySalvageReward 同款·返回中文短描述）。 */
  private applyLevelReward(r: S7LevelReward): string {
    if (!this.playerState || !this.session) return '';
    switch (r.kind) {
      case 'resource': {
        const res = this.session.resources as Record<string, number>;
        if (res[r.resourceId] === undefined) return ''; // 非钱包键护栏
        res[r.resourceId] += r.amount;
        return `${this.zhRes(r.resourceId)}×${r.amount}`;
      }
      case 'exclusiveShard':
        addExclusiveShards(this.playerState.exclusiveShards, r.unitId, r.amount);
        return `${this.unitName(r.unitKind, r.unitId)}碎片×${r.amount}`;
      case 'plugin': {
        if (this.pluginInventory) {
          const ids = Array.from(this.pluginSlotMap.keys());
          for (let k = 0; k < r.count; k += 1) {
            // 变更#4：revealPluginId 指定具体插件（教程关2 写死）→ 发它；否则按旧逻辑轮换挑一个。
            const pid = r.revealPluginId ?? (ids.length > 0 ? ids[this.pluginInventory.plugins.length % ids.length] : 'plg01');
            addOwnedPlugin(this.pluginInventory, pid, r.quality);
          }
        }
        const q = r.quality === 'fine' ? '精良' : r.quality === 'superior' ? '优秀' : '传奇';
        // 揭晓：有 revealPluginId 时返回其真实名（变更#4 选后才知道具体是哪个）。
        if (r.revealPluginId) return `${this.pluginName(r.revealPluginId)}（${r.slotTag ? S7_SLOT_TAG_NAMES[r.slotTag] + '槽·' : ''}${q}）`;
        return `${q}插件${r.count > 1 ? `×${r.count}` : ''}`;
      }
      case 'chest':
        addChest(this.playerState.chests, r.chestId, r.amount);
        return `${this.chestName(r.chestId)}×${r.amount}`;
      case 'core':
        if (this.squad) grantCore(this.squad, r.coreId);
        return `${this.coreName(r.coreId)}[核]`;
    }
  }

  /** 宝箱键→中文名（仅显示用）。 */
  private chestName(id: string): string {
    return id === 'starlightCargo' ? '星辉货舱' : id === 'actionTreasure' ? '行动宝藏' : id === 'expansionTreasure' ? '扩张宝藏' : id;
  }

  /** 不知舰/员时按 id 兜底取名（exShard 领取用·先试 ship_config 再 pilot_config）。 */
  private unitNameAny(id: string): string {
    if (!this.runtime) return id;
    const s = this.runtime.getById<S7ShipConfig>('ship_config', id);
    if (s?.name) return s.name;
    return this.runtime.getById<S7PilotConfig>('pilot_config', id)?.name ?? id;
  }

  /** 一封邮件的奖励列表→中文短摘要（列表行用）。 */
  private mailRewardText(rewards: S7MailReward[]): string {
    if (rewards.length === 0) return '（无奖励）';
    return rewards.map((rw) => {
      if (rw.type === 'resource') {
        if (rw.resourceId.startsWith('exShard:')) return `${this.unitNameAny(rw.resourceId.slice('exShard:'.length))}碎片×${rw.amount}`;
        return `${this.zhRes(rw.resourceId)}×${rw.amount}`;
      }
      if (rw.type === 'chest') return `${this.chestName(rw.chestId)}×${rw.amount}`;
      if (rw.type === 'population') return rw.pop === 'resident' ? `居民×${rw.amount}` : `工人×${rw.amount}`;
      return `${this.unitName(rw.unitKind, rw.unitId)}[本体]`;
    }).join('、');
  }

  /** 升阶(星舰)/升星(驾驶员)：扣专属碎片·提阶级/星级。 */
  private onAscendUnit(kind: 'ship' | 'pilot', unitId: string): void {
    if (!this.playerState) return;
    const rl = this.unitManageResultLabel;
    if (kind === 'ship') {
      const r = ascendShip(this.playerState.unitTiers, this.playerState.exclusiveShards, DEFAULT_S7_ASCEND_CONFIG, unitId);
      if (rl) rl.string = r.ok ? `升阶到 ${shipTierName(r.toTier)} 阶！插件槽 ${r.pluginSlots}${r.coreSlot ? '·星核槽已开' : ''}`
        : r.reason === 'max_tier' ? '已满阶 SS' : r.reason === 'insufficient' ? `专属碎片不够（需 ${r.needExclusive}·去抽卡攒或背包转换）` : '暂不可升阶';
      if (r.ok) this.sound.playSfx('upgrade_ascend');
    } else {
      const r = starupPilot(this.playerState.unitTiers, this.playerState.exclusiveShards, DEFAULT_S7_ASCEND_CONFIG, unitId);
      if (rl) rl.string = r.ok ? `升星到 ${r.toStar}★！` : r.reason === 'max_tier' ? '已满星 5★' : r.reason === 'insufficient' ? `专属碎片不够（需 ${r.needExclusive}）` : '暂不可升星';
      if (r.ok) this.sound.playSfx('upgrade_star_up');
    }
    this.persist();
    this.refresh();
    this.refreshUnitManage();
    this.refreshUnitTrain(kind);
  }

  /** 重置 S7 存档到初始（演示反复验证用）：回 n001、清零资源与单位等级、落盘。 */
  private onReset(): void {
    if (!this.session || !this.playerState || this.playing) return;
    // DEV-TEMP·重玩教程：重置到教程第 0 步（强引导从头跑·建筑全锁·只给起手编队）；demo 自由态用「跳过引导」进。
    const tut = this.playerState.tutorial;
    tut.strongGuideStep = 0; tut.strongGuideDone = false; tut.seenFirstTouch = [];
    this.hideTutorialStep();
    this.hideTutorialPopup();
    this.hideTutorialHint();
    for (const key of Object.keys(this.session.resources)) {
      this.session.resources[key] = 0;
    }
    this.session.progress = createDefaultS7MainlineProgress();
    this.playerState.unitLevels.shipLevels = {};
    this.playerState.unitLevels.pilotLevels = {};
    // 建筑/人口归零，且建筑保持全锁（教程靠引导逐步解锁，不预先解锁）。
    this.playerState.buildings = createDefaultS7BuildingState();
    this.playerState.population = createDefaultS7Population();
    this.buildings = this.playerState.buildings;
    this.population = this.playerState.population;
    this.reportPending = null;
    this.playerState.gacha = createDefaultS7GachaState();
    this.playerState.salvage = createDefaultS7Salvage();
    this.playerState.merchant = createDefaultS7Merchant();
    this.playerState.unitTiers = createDefaultS7UnitTierState();
    if (this.pluginInventory) {
      this.pluginInventory.plugins = [];
      this.pluginInventory.nextInstanceSeq = 1;
      this.pluginInventory.nextActionSeq = 0;
    }
    // 阵容就地清空 + 只发起手编队（教程态·会话持有 squad 引用，不能整体替换→原地改）。
    if (this.squad) {
      this.squad.ownedShips = [];
      this.squad.ownedPilots = [];
      this.squad.ownedCores = {};
      this.squad.formation = [];
      this.squad.shipLoadouts = {};
      this.ensureTutorialStarterSeeded();
    }
    // 收起一切可能开着的面板，回到干净星港。
    this.prebattleSelSlot = null; this.prebattleSelShip = null;
    this.closeLoadout(); this.closeBoarding(); this.closePrebattle(); this.closeBase();
    this.closeUnitPanelsToHub();
    if (this.gachaNode) this.gachaNode.active = false;
    if (this.salvageNode) this.salvageNode.active = false;
    if (this.merchantNode) this.merchantNode.active = false;
    if (this.activityNode) this.activityNode.active = false;
    this.setResult('已重玩教程：回到教程开头', new Color(180, 200, 230));
    this.persist();
    this.refresh();
    this.runTutorialStep(); // 从第 0 步（开场）开始
  }

  /**
   * DEV-TEMP·跳过新手强引导（不清存档）：标 strongGuideDone → 收引导遮罩 → 老演示态全量发货
   * （补齐起手缺的船/员/资源/插件/星核 + 解锁全建筑）→ 落盘刷新。正式版删（与新手引导一并清 DEV 入口）。
   */
  private devSkipGuide(): void {
    if (!this.playerState || !this.squad) return;
    completeStrongGuide(this.playerState.tutorial);
    this.hideTutorialStep();
    this.hideTutorialPopup();
    this.hideTutorialHint();
    // 全量发货（幂等·grant* 已拥有跳过；资源用 Math.max 只补不降）。
    for (const s of S7_DEMO_SEED_SHIPS) grantShip(this.squad, s);
    for (const p of S7_DEMO_SEED_PILOTS) grantPilot(this.squad, p);
    for (const f of S7_DEMO_SEED_FORMATION) assignSlot(this.squad, f.slotRef, f.shipId, f.pilotId);
    const r = this.playerState.resources as Record<string, number>;
    const topUp: Record<string, number> = {
      starOre: 100000, hullAlloy: 100000, pilotToken: 5000, supplyTicket: 188,
      starCargo: 50000, beaconCommon: 8, beaconRare: 5, beaconEpic: 3, shipBlueprint: 300, pilotShardUniversal: 300,
    };
    for (const k of Object.keys(topUp)) r[k] = Math.max(r[k] ?? 0, topUp[k]);
    for (const s of S7_DEMO_SEED_SHIPS) addExclusiveShards(this.playerState.exclusiveShards, s, 200);
    for (const p of S7_DEMO_SEED_PILOTS) addExclusiveShards(this.playerState.exclusiveShards, p, 200);
    if (Object.keys(this.squad.ownedCores).length === 0) for (const c of S7_DEMO_SEED_CORES) grantCore(this.squad, c, 1);
    if (this.pluginInventory && this.pluginInventory.plugins.length === 0) for (const p of S7_DEMO_SEED_PLUGINS) addOwnedPlugin(this.pluginInventory, p.pluginId, p.quality);
    this.ensureDefaultBuildingsUnlocked();
    this.persist();
    this.refresh();
    this.hubToast('已跳过新手引导（DEV·全量发货）');
    if (this.reportPending) this.openReturnReport(); // 块1：跳过引导后补弹被压住的回港报告
  }

  // ===== 块1 回港报告（离线+巡逻+打捞聚合 · GDD S10.10 / S13 #1）=====

  /** 搭回港报告弹窗（默认隐藏）：全屏吞触摸遮罩 + 卡片（标题/三段明细/两键并排）。必领才关（发奖类铁律，防丢奖）。 */
  private buildReturnReportPopup(W: number, H: number): void {
    const panel = new Node('S7ReturnReport');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, 180);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    const dw = W * 0.92;
    const dh = H * 0.52;
    g.fillColor = new Color(22, 30, 48, 255);
    g.roundRect(-dw / 2, -dh / 2, dw, dh, 20);
    g.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸：不点遮罩关（必领才关）
    panel.active = false;
    this.reportNode = panel;

    const tn = new Node('t'); tn.layer = this.node.layer; panel.addChild(tn); tn.setPosition(0, dh * 0.40, 0);
    const tl = tn.addComponent(Label);
    tl.fontSize = 42; tl.lineHeight = 52; tl.color = new Color(150, 215, 255); tl.string = '⚓ 欢迎回港，指挥官';

    const bn = new Node('b'); bn.layer = this.node.layer; panel.addChild(bn); bn.setPosition(0, dh * 0.04, 0);
    this.reportBodyLabel = bn.addComponent(Label);
    this.reportBodyLabel.fontSize = 26;
    this.reportBodyLabel.lineHeight = 40;
    this.reportBodyLabel.color = new Color(225, 230, 245);
    this.reportBodyLabel.string = '';
    // #2：打捞多单时明细行数不定——锚进卡片内容框自动缩，不顶出卡外。
    this.labelBox(this.reportBodyLabel).setContentSize(dw * 0.90, dh * 0.58);
    this.reportBodyLabel.overflow = Label.Overflow.SHRINK;
    this.reportBodyLabel.enableWrapText = true;

    // 两键并排同级（S13.1 五原则②：翻倍与直领并排可选、点哪个都立即走；广告键正常显示不放大不闪烁）。
    // B0.6 #14（巡检批修：原 250/270 不等宽不对称）：等宽等高对称孔位。
    const [, dbl] = this.addDialogBtnPair(
      panel, '一键全领', new Color(90, 170, 95, 255), () => this.onClaimReturnReport(false),
      '📺 全部翻倍', new Color(225, 150, 45, 255), () => this.onClaimReturnReport(true), -dh * 0.38, 260, 96, 30,
    );
    this.reportDoubleLabel = dbl;
    this.reportDoubleBtn = dbl.node.parent;
  }

  /** 弹回港报告（上线自动 / 强引导结束补弹 / DEV 测回港）。翻倍键超每日上限时不出现（非置灰·零红点，S13.1）。 */
  private openReturnReport(): void {
    if (!this.reportNode || !this.reportPending || !this.playerState) return;
    const rep = this.reportPending;
    const hrs = rep.elapsedSeconds / 3600;
    const away = hrs >= 1 ? `${Math.floor(hrs)} 小时` : `${Math.max(1, Math.floor(rep.elapsedSeconds / 60))} 分钟`;
    const lines: string[] = [];
    lines.push(`离开了 ${away}${rep.offline.overflowed ? '（已达存储上限·升居住舱可扩）' : ''}`);
    lines.push(`🏭 基地产出：${this.gainsText(rep.offline.gains) || '—'}`);
    lines.push(`🛡 巡逻战报：${rep.patrol.hasGains ? this.gainsText(rep.patrol.gains) : '—（通关首个星域后舰队开始巡逻）'}`);
    if (rep.salvage.length > 0) {
      const tierZh: Record<string, string> = { common: '普通', rare: '稀有', epic: '史诗' };
      lines.push('⚓ 打捞入港：');
      for (const e of rep.salvage) {
        lines.push(`· ${tierZh[e.tier] ?? e.tier}信标(${e.hours}h)：${e.rewards.map((rw) => this.salvagePreviewText(rw)).join('、')}`);
      }
    } else {
      lines.push('⚓ 打捞入港：—');
    }
    if (this.reportBodyLabel) this.reportBodyLabel.string = lines.join('\n');
    const softAny = rep.offline.hasGains || rep.patrol.hasGains;
    // 块5 统一三态（#1·每日1次）：可用→显示；已用&无券→不出现；已用&持券→券态「广告券×N」。无软货币可翻同样不出现。
    this.applyAdButton(this.reportDoubleBtn, this.reportDoubleLabel, RETURN_REPORT_DOUBLE_AD_POINT, '📺 全部翻倍');
    if (this.reportDoubleBtn && !softAny) this.reportDoubleBtn.active = false;
    this.sound.playSfx('return_report');
    this.reportNode.active = true;
  }

  /** 点「一键全领」/「全部翻倍」。翻倍走统一广告流（块5：券态先扣券·失败退券）；广告失败不关窗，仍可直领。 */
  private onClaimReturnReport(doubled: boolean): void {
    if (!this.session || !this.playerState || !this.reportPending) return;
    if (!doubled) {
      this.finishReturnReportClaim(false, null);
      return;
    }
    this.runAdPoint(RETURN_REPORT_DOUBLE_AD_POINT,
      () => this.finishReturnReportClaim(true, null),
      (reason) => {
        // 极端竞态（弹窗挂着跨天等）额度没了：退普通领取，绝不吞玩家基础奖励；广告失败则留窗可直领。
        if (reason === 'quota_gone') this.finishReturnReportClaim(false, '今日翻倍次数已用完，已按普通领取');
        else this.hubToast(reason === 'ad_failed' ? '广告没看完——也可以直接点「一键全领」' : '广告加载失败——也可以直接点「一键全领」');
      });
  }

  /** 入账+关窗：软货币(离线+巡逻·可翻倍) + 打捞逐条入账(实物不翻·S13 #1) + 移除已收任务 + 喂活动 + persist(刷新 lastOnlineTime 关窗)。 */
  private finishReturnReportClaim(doubled: boolean, note: string | null): void {
    if (!this.session || !this.playerState || !this.reportPending) return;
    const rep = this.reportPending;
    const soft = claimReturnReportCurrencies(this.session.resources as Record<string, number>, rep, doubled);
    const parts: string[] = [];
    const softText = this.gainsText(soft);
    if (softText) parts.push(doubled ? `${softText}（已翻倍）` : softText);
    for (const e of rep.salvage) {
      const texts = e.rewards.map((rw) => this.applySalvageReward(rw)).filter(Boolean);
      if (texts.length > 0) parts.push(`打捞带回 ${texts.join('、')}`);
      this.feedActivity(S7_ACTIVITY_ACTIONS.salvage); // 与打捞港收菜同口径：每收 1 单喂一次活动进度
    }
    removeClaimedSalvageMissions(this.playerState.salvage, rep.salvage.map((e) => e.missionId));
    this.reportPending = null;
    if (this.reportNode) this.reportNode.active = false;
    this.sound.playSfx('reward_claim');
    this.setResult(`回港报告已领：${parts.join('；') || '（无进账）'}${note ? `（${note}）` : ''}`, new Color(235, 215, 130));
    this.persist();
    this.refresh();
    this.refreshSalvage();
    this.maybeShowAnecdote(); // 块5：报告独占开场·领完回到 hub 才轮到趣事（弹窗≤1）
  }

  /** 通用进账串「+X名 …」（只列正向键）。 */
  private gainsText(g: Record<string, number>): string {
    return Object.keys(g)
      .filter((k) => (g[k] ?? 0) > 0)
      .map((k) => `+${this.fmtNum(g[k])}${this.zhRes(k)}`)
      .join(' ');
  }

  /** 打捞奖励的只读预览文案（与 applySalvageReward 的入账文案同口径；同报告两只同艘未拥有舰时第二只实际折碎片，预览不细分——灰盒可接受）。 */
  private salvagePreviewText(rw: S7SalvageReward): string {
    switch (rw.kind) {
      case 'resource': return `${this.zhRes(rw.resourceId)}×${rw.amount}`;
      case 'plugin': return `${rw.quality === 'fine' ? '精良' : rw.quality === 'superior' ? '优秀' : '传奇'}插件`;
      case 'chest': return `星辉货舱×${rw.amount}`;
      case 'population': return rw.pop === 'resident' ? `居民×${rw.amount}` : `工人×${rw.amount}`;
    }
  }

  // ===== 块5 · 今日补给箱（S13 #2）+ 星港趣事（S10.10）+ 块5 DEV 键 =====

  /** 点礼盒（S13 #2）：看广告→确定性预掷（种子=s7DayKey+今日第几开·杀进程重进不换奖）→入账→弹结果确认弹窗。每日1次/券态/失败退券走统一广告流。 */
  private onOpenSupplyChest(): void {
    if (!this.playerState || !this.session) return;
    this.runAdPoint(DAILY_SUPPLY_CHEST_AD_POINT,
      () => {
        if (!this.playerState) return;
        const now = Date.now();
        const openIndex = adDailyUsed(this.playerState.adDaily, DAILY_SUPPLY_CHEST_AD_POINT, now); // 刚记完数=今日第 N 开（1 起）
        const rewards = rollDailySupplyChest(s7DayKey(now), Math.max(1, openIndex));
        this.creditGains(rewards); // 入账时机不变（弹窗只是回执，杀进程不丢奖）
        this.sound.playSfx('supply_chest_open');
        this.persist();
        this.refresh(); // 礼盒随三态隐入背景（"空盒隐入背景"演出留美术阶段）
        this.openSupplyChestResultPopup(rewards); // 完善批：逐行明细弹窗·必点「收下」才关（替代原飘字自动消失）
      },
      (reason) => {
        this.refresh(); // 券态可能已退回·刷显隐
        this.hubToast(reason === 'ad_failed' ? '广告没看完，补给箱没开' : '广告加载失败');
      });
  }

  /** 搭补给箱结果确认弹窗（默认隐藏·块5 完善批·照大奖特写成例）：半透明遮罩 + 小卡片 + 标题 + 明细行 + 「收下」。 */
  private buildSupplyChestResultPopup(W: number, H: number): void {
    const panel = new Node('S7SupplyChestResult'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const dim = panel.addComponent(Graphics);
    dim.fillColor = new Color(0, 0, 0, 200); dim.rect(-W / 2, -H / 2, W, H); dim.fill();
    const dw = W * 0.78, dh = H * 0.40;
    dim.fillColor = new Color(38, 34, 24, 255); dim.roundRect(-dw / 2, -dh / 2, dw, dh, 22); dim.fill();
    panel.addComponent(UITransform).setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸·点空白不关（B0.6 ⑤·必点收下）
    panel.active = false;
    this.supplyChestResultNode = panel;
    this.mkPanelLabel(panel, '🎁 今日补给箱', 34, new Color(255, 224, 150), 0, dh * 0.32);
    const detail = this.mkPanelLabel(panel, '', 26, new Color(232, 236, 245), 0, dh * 0.02);
    detail.overflow = Label.Overflow.SHRINK; detail.enableWrapText = true; // 文本锚容器内·多条自动缩（B0.6 ②）
    detail.getComponent(UITransform)?.setContentSize(dw * 0.82, dh * 0.5);
    this.supplyChestResultLabel = detail;
    this.addBtn(panel, '收下', 260, 84, new Color(212, 160, 66, 255), 0, -dh * 0.34, () => this.onSupplyChestResultClaim(), 30);
  }

  /** 弹补给箱结果确认（置顶盖在 hub 之上）：逐行列 emoji+名称+数量。奖励已入账（本弹窗纯回执）。 */
  private openSupplyChestResultPopup(rewards: Record<string, number>): void {
    if (!this.supplyChestResultNode) return;
    const lines = Object.keys(rewards)
      .filter((k) => (rewards[k] ?? 0) > 0)
      .map((k) => `${this.resEmoji(k)} ${this.zhRes(k)} ×${this.fmtNum(rewards[k])}`);
    if (this.supplyChestResultLabel) this.supplyChestResultLabel.string = lines.join('\n') || '（本次无进账）';
    const parent = this.supplyChestResultNode.parent;
    if (parent) this.supplyChestResultNode.setSiblingIndex(parent.children.length - 1); // 置顶
    this.supplyChestResultNode.active = true;
  }

  /** 收下：关结果弹窗（奖励开箱时已入账·此处只收回执）。 */
  private onSupplyChestResultClaim(): void {
    if (this.supplyChestResultNode) this.supplyChestResultNode.active = false;
  }

  /** 补给箱奖励键→emoji 图标（灰盒占位·仅补给箱可能出现的键；未列回退🎁）。 */
  private resEmoji(resourceId: string): string {
    const map: Record<string, string> = {
      starOre: '🔷', hullAlloy: '🔩', pilotToken: '🎖️', starCargo: '🪙',
      beaconCommon: '📡', shipBlueprint: '🚀', pilotShardUniversal: '👤',
    };
    return map[resourceId] ?? '🎁';
  }

  /** 星港趣事（S10.10·块5）：进 hub 时机调——当日确定性掷"有无+哪条"（15%占位）、每日≤1、强引导期不触发、
   *  回港报告在场时让位（开场主动弹窗≤1 独占；报告领完/收起后再进 hub 还有机会）。命中=微量奖励入账+弹泡（点掉即走·零广告零红点）。 */
  private maybeShowAnecdote(): void {
    if (!this.playerState || !this.session || this.playing) return;
    if (this.isStrongGuideActive()) return;
    if (this.reportPending || (this.reportNode && this.reportNode.active)) return; // 报告独占开场
    if (this.anecdoteView?.isOpen) return;
    const now = Date.now();
    if (adDailyUsed(this.playerState.adDaily, ANECDOTE_SHOWN_COUNTER_KEY, now) > 0) return; // 每日≤1
    const line = anecdoteForDay(s7DayKey(now));
    if (!line) return; // 今天没趣事（~85%）
    this.showAnecdote(line);
  }

  /** 展示一条趣事：奖励先入账（微量·星贝/星矿个位数）+ 记"今日已展示" + 弹泡。 */
  private showAnecdote(line: S7AnecdoteLine): void {
    if (!this.playerState || !this.session) return;
    this.creditGains(line.reward);
    adDailyRecord(this.playerState.adDaily, ANECDOTE_SHOWN_COUNTER_KEY, Date.now());
    this.persist();
    this.refresh();
    this.sound.playSfx('trivia_pop');
    this.anecdoteView?.show(line.avatar, anecdoteSpeakerDisplay(line), line.text, this.gainsText(line.reward));
  }

  /** DEV-TEMP：+5 广告券（验券态恢复/用券/失败退券——不买商人也能反复测）。上线前删。 */
  private devGrantAdTickets(): void {
    if (!this.session) return;
    const res = this.session.resources as Record<string, number>;
    res[AD_TICKET_RESOURCE_KEY] = adTicketCount(res) + 5;
    this.persist();
    this.refresh();
    this.hubToast(`[DEV] 广告券 +5（现 ${adTicketCount(res)} 张）`);
  }

  /** DEV-TEMP：重置今日广告/每日计数（清 adDaily 全部条目：10点位+安慰包发放数+趣事已展示——否则每日1次没法反复真机验）。上线前删。 */
  private devResetAdDaily(): void {
    if (!this.playerState) return;
    this.playerState.adDaily.entries = {};
    this.persist();
    this.refresh();
    this.refreshSalvage();
    this.hubToast('[DEV] 已重置今日广告与每日计数（各点位按钮恢复）');
  }

  /** DEV-TEMP：必触发趣事（绕过 15% 概率与每日≤1·随机抽一条·真实入账链路）。上线前删。
   *  DEV 路径允许 Math.random；正式触发 anecdoteForDay 的确定性掷签一字不动（当天锁签防反复刷=设计+工程双重需要）。 */
  private devForceAnecdote(): void {
    if (!this.playerState || !this.session) return;
    const line = anecdoteByIndex(Math.floor(Math.random() * S7_ANECDOTE_LINES.length));
    this.showAnecdote(line);
  }

  /** DEV-TEMP：测回港——把离线窗口拨回 8 小时重建报告并弹窗（真机不可能干等离线/打捞）。上线前删。 */
  private devTestReturnReport(): void {
    if (!this.session || !this.playerState || !this.model || !this.buildings || !this.population) return;
    const now = Date.now();
    const rep = buildS7ReturnReport(
      this.model, this.buildings, this.population, this.session.progress,
      this.playerState.salvage, DEFAULT_S7_SALVAGE_CONFIG, now - 8 * 3600 * 1000, now,
    );
    if (!rep.hasAny) { this.hubToast('拨回8h也无收益（先解锁居住舱/通关星域/有完成的打捞）'); return; }
    this.reportPending = rep;
    this.openReturnReport();
  }

  /** DEV-TEMP·回档到首Boss前：把主线拨回"首Boss(=n030)待通关"（清 n030 及之后的通关标记）+ 移除档内 core07(陨星弹·库存+装配位)。
   *  反复可用——让 Ron 真机反复验"打 n030→掉陨星弹→飘字/结算显示"全链路。正式版删（core07 正式来源=打赢首Boss首通）。 */
  private devRollbackToFirstBoss(): void {
    if (!this.session || !this.playerState || !this.runtime || !this.squad) return;
    const allNodes = this.runtime
      .getAll<S7MainlineNodeConfig>('mainline_node_config')
      .map((n) => ({ nodeId: n.nodeId, nodeTypeTag: n.nodeTypeTag }));
    const bossId = firstBossNodeId(allNodes);
    if (!bossId) { this.hubToast('无首Boss节点·回档失败'); return; }
    // 主线：清首Boss及之后的通关标记（nodeId 零填充→字典序=数值序），当前节点=首Boss（变回"待通关"→打赢即首通）。
    const kept = this.session.progress.clearedNodeIds.filter((id) => id < bossId);
    this.session.progress = { currentNodeId: bossId, clearedNodeIds: kept };
    // 移除已有陨星弹(core07)：库存删键 + 从所有星舰装配位卸下 → "完全没有陨星弹"的干净起点。
    delete this.squad.ownedCores['core07'];
    for (const shipId of Object.keys(this.squad.shipLoadouts)) {
      const lo = this.squad.shipLoadouts[shipId];
      if (lo && lo.coreId === 'core07') lo.coreId = null;
    }
    this.persist();
    this.refresh();
    this.setResult(`已回档到 ${bossId} 待通关·移除陨星弹（去打赢 ${bossId} 验证掉落+结算显示）`, new Color(205, 165, 60));
  }

  // ===== 块2 星港悬赏板（GDD S10.8）：挂独立 view + 悬赏战斗编排 =====

  /** 悬赏板 view 宿主接口（数据只读 + 动作回调）。 */
  private makeBountyHost(): S7BountyHost {
    return {
      layer: this.node.layer,
      bountyState: () => this.playerState!.bounty,
      affixDefs: () => this.runtime?.getAll<S7CommissionAffixDef>('commission_affix_param') ?? [],
      starfieldTier: () => this.bountyTier(),
      bountyDifficulty: () => this.bountyDifficultyNow(),
      habitatLevel: () => (this.buildings ? getBuildingLevel(this.buildings, 'bld_habitat') : 0),
      gainsText: (r) => this.gainsText(r),
      playCard: (id) => this.onBountyPlayCard(id),
      onClose: () => this.closeCombatHall(),
    };
  }

  // ===== 块4 作战大厅（容器·两页签 悬赏板+每日推演·Ron 2026-07-05 hub 架构）=====

  private makeCombatHallHost(): S7CombatHallHost {
    return { layer: this.node.layer, onClose: () => this.closeCombatHall() };
  }

  /** hub「作战大厅」入口：日刷两页签数据（悬赏发卡 + 推演对齐今日）→ 落盘 → 开大厅到指定页签。解锁=关5 强引导结束。 */
  private openCombatHall(tab: S7CombatHallTab): void {
    if (this.playing || !this.combatHall || !this.playerState || !this.session || !this.model) return;
    if (!this.playerState.tutorial.strongGuideDone) { this.hubToast('完成新手引导后解锁作战大厅'); return; }
    this.devPuzzleId = null; // 从 hub 进=回真题（清 DEV 跳题覆盖）
    let dirty = false;
    // 悬赏日刷（跨天补刷·封顶·幂等）。
    const habitatLv = this.buildings ? getBuildingLevel(this.buildings, 'bld_habitat') : 0;
    const affixPool = (this.runtime?.getAll<{ rowId: string }>('commission_affix_param') ?? []).map((r) => r.rowId);
    if (refreshBountyBoard(this.playerState.bounty, habitatLv, Date.now(), affixPool)) dirty = true;
    // 推演对齐今日（跨天换题·真题 solved 存活）。
    const before = { ...this.playerState.dailyPuzzle };
    refreshDailyPuzzle(this.playerState.dailyPuzzle, Date.now(), this.puzzleIds());
    if (before.dayKey !== this.playerState.dailyPuzzle.dayKey || before.puzzleId !== this.playerState.dailyPuzzle.puzzleId) dirty = true;
    if (dirty) this.persist();
    this.combatHall.open(tab);
  }

  /** 战斗返回后重开大厅（不再日刷/不清 DEV 覆盖·保留 DEV 跳题态）：回原页签 + 刷新。 */
  private reopenCombatHall(tab: S7CombatHallTab): void {
    if (!this.combatHall) return;
    this.combatHall.open(tab);
    this.combatHall.refreshActive();
  }

  private closeCombatHall(): void { this.combatHall?.close(); }

  /** 已通关最高星域档（产出/难度缩放）。 */
  private bountyTier(): number {
    if (!this.model || !this.session) return 0;
    return this.model.clearedStarfieldTier(this.session.progress.clearedNodeIds);
  }

  /** 悬赏当前难度（过渡期自动选档=已通关锚点最高档；难度弹窗归灰盒批·上线后由玩家选择取代）。
   *  战斗敌阵/结算倍率/产出预览三处共用同一读数（配对纪律：打哪档敌人拿哪档倍率）。 */
  private bountyDifficultyNow(): S7BountyDifficulty {
    return bountyAutoDifficulty(this.session?.progress.clearedNodeIds ?? []);
  }

  /** 点卡「出战」：进主线同款备战（悬赏模式·出战改打该卡）；备战信息行挂本场词缀。 */
  private onBountyPlayCard(cardId: string): void {
    if (!this.playerState || this.playing) return;
    if (!findBountyCard(this.playerState.bounty, cardId)) { this.hubToast('这张悬赏已失效'); return; }
    this.bountyPrepCardId = cardId;
    this.combatHall?.close();
    this.openPrebattle();
  }

  /** shipId → 定位型（读 battle_unit_stat_param 的 ship 行 positionType·灰盒占位）。找不到/非法返回 null。 */
  private bountyShipPositionType(shipId: string): S7PositionType | null {
    const rows = this.runtime?.getAll<{ targetType: string; unitRef: string; positionType?: string }>('battle_unit_stat_param') ?? [];
    const pt = rows.find((r) => r.targetType === 'ship' && r.unitRef === shipId)?.positionType;
    return pt && (S7_POSITION_TYPES as readonly string[]).includes(pt) ? (pt as S7PositionType) : null;
  }

  /** 备战信息补充：悬赏模式下把本场词缀全文（按定位型作用）拼成一行，挂进备战信息（灰盒词缀标记）。 */
  private bountyPrepAffixInfo(): string {
    if (!this.bountyPrepCardId || !this.playerState || !this.runtime) return '';
    const card = findBountyCard(this.playerState.bounty, this.bountyPrepCardId);
    if (!card || card.affixIds.length === 0) return '';
    const defs = this.runtime.getAll<S7CommissionAffixDef>('commission_affix_param');
    const lines = card.affixIds.map((id) => {
      const d = defs.find((x) => x.rowId === id);
      return d ? `词缀·${d.affixName}：${d.effectText}` : '';
    }).filter(Boolean);
    return lines.length > 0 ? `\n${lines.join('\n')}` : '';
  }

  /** 跑一场悬赏战斗（不推主线）：敌阵=当前难度的 recNodes 锚点节点（定价重锚批·拍板5）；
   *  按卡词缀给对应定位型注积木；护航附运输船。 */
  private runBountyBattle(card: S7BountyCard): S7BattleRunResult | null {
    if (!this.playerState || !this.session || !this.model || !this.runtime || !this.squad) return null;
    const nodeId = bountyBattleNodeId(this.bountyDifficultyNow());
    const built = buildSquadLineup(this.squad, this.playerState.unitLevels, this.pluginInventory ?? undefined, this.playerState.unitTiers); // ⑩A1：驾驶员级/星入战（回执⑤）
    if (!built.ok) { this.bountyBattleError('有星舰缺驾驶员或没上阵——把阵容配好再出战'); return null; }
    const defs = this.runtime.getAll<S7CommissionAffixDef>('commission_affix_param');
    const lineupSize = built.lineup.length;
    const team = this.teamBonusBlocks();
    const lineup = built.lineup.map((u, i) => {
      const pt = this.bountyShipPositionType(u.shipId);
      const affixBlocks = pt ? commissionAffixBlocks(defs, card.affixIds, pt, lineupSize) : [];
      const extra = [
        ...(u.extraBlocks ?? []), ...team, ...playerCritBaseBlocks(), ...affixBlocks,
        ...(card.theme === 'escort' && i === 0 ? escortTransportBlocks() : []), // 护航：旗舰位开场召唤运输船
      ];
      return extra.length > 0 ? { ...u, extraBlocks: extra } : u;
    });
    try {
      const progress = { currentNodeId: nodeId, clearedNodeIds: [] as string[] };
      return this.battleRunService.run({ runtime: this.runtime, progress, runSeed: bountyRunSeed(card, Date.now()), lineup, hardControlDiminish: S7_HARD_CONTROL_DIMINISH });
    } catch (err) {
      console.warn('[S7DemoController] 悬赏战斗启动失败', nodeId, err);
      this.bountyBattleError('悬赏敌阵暂不可用（原型内容缺口）');
      return null;
    }
  }

  /** 悬赏战斗失败提示：备战面板开着 → 写信息行（hubToast 被面板盖住看不见）；否则 hubToast。 */
  private bountyBattleError(msg: string): void {
    if (this.prebattleNode?.active && this.prebattleInfoLabel) {
      this.prebattleInfoLabel.string = `⚠ ${msg}`;
      this.prebattleInfoLabel.color = new Color(240, 200, 120);
    } else {
      this.hubToast(msg);
    }
  }

  /** 真打一场悬赏（先结算后演出·同主线口径·就地在备战舞台播放）：胜→结算发奖(完美护航×1.25)+移除卡+遇袭判定；负→不罚·卡留板。 */
  private launchBountyBattle(cardId: string): void {
    if (!this.playerState) return;
    const card = findBountyCard(this.playerState.bounty, cardId);
    if (!card) { this.bountyBattleError('这张悬赏已失效'); return; }
    const out = this.runBountyBattle(card);
    if (!out) return; // 失败提示已由 runBountyBattle 写进备战信息行；悬赏标记保留，修好阵容可直接重试
    this.bountyPrepCardId = null; // 确认能开播才退出悬赏备战模式
    const won = out.result.winner === 'player';
    const themeName = card.theme === 'escort' ? '护航' : '演习';
    let text: string;
    if (won) {
      const perfect = card.theme === 'escort' && isPerfectEscort(out.result);
      // 难度倍率与敌阵同档（配对纪律：打哪档敌人拿哪档倍率——runBountyBattle 同一读数）。
      const settled = settleBountyCard(this.playerState.bounty, cardId, this.bountyTier(), perfect, this.bountyDifficultyNow());
      if (settled) this.creditGains(settled.rewards);
      // DEV-TEMP「必遇袭」：武装后下张护航打赢必触发（15% 小概率真机没法验收）·用掉即灭。上线前删。
      const ambush = card.theme === 'escort' && (this.devBountyForceAmbush || bountyAmbushTriggered(card));
      if (ambush) this.devBountyForceAmbush = false;
      // 遇袭=风险抉择（Ron 2026-07-04 修订）：带上本单刚结算的入账，迎战失败按它折损（绝不碰存量）。
      this.bountyAmbushPending = ambush ? { card, settledRewards: settled?.rewards ?? {} } : null;
      text = `${themeName}悬赏完成 ${this.gainsText(settled?.rewards ?? {})}`
        + (perfect ? '（✨完美护航 +25%）' : '')
        + (ambush ? '\n⚠ 遭遇星盗拦路——迎战：胜得额外小包·败折本单部分收益；躲避：零损失' : '');
    } else {
      this.bountyAmbushPending = null;
      text = `${themeName}没打赢——不扣不罚，卡还在板上，调下阵容再来`;
    }
    this.bountyActiveCardId = cardId;
    this.pendingWon = won;
    this.pendingResult = { text, color: won ? new Color(150, 235, 160) : new Color(255, 180, 150) };
    this.pendingLevelReward = null; // 悬赏无三选一
    this.persist();
    this.sound.playBgm('bgm_battle'); // 与主线出战同口径
    this.startPlayback(buildS7BattlePlayback(out.result));
  }

  /** 遇袭遭遇战（选「正面迎战」后·同一战斗舞台接着打）：赢=额外小包(轮换)；败=折损本单护航入账的一部分（占位30%·绝不碰存量）。打完回悬赏板。 */
  private launchBountyAmbush(ctx: { card: S7BountyCard; settledRewards: Record<string, number> }): void {
    if (!this.playerState) { this.dismissBattleScene(); this.reopenCombatHall('bounty'); return; }
    const out = this.runBountyBattle(ctx.card); // 灰盒复用同敌阵（真实星盗涂装留美术阶段）
    if (!out) { this.dismissBattleScene(); this.reopenCombatHall('bounty'); return; } // 起不来就收舞台回板（别卡在黑舞台·不罚）
    const won = out.result.winner === 'player';
    let text: string;
    if (won) {
      const bonus = claimBountyAmbushBonus(this.playerState.bounty);
      this.creditGains(bonus);
      text = `星盗遭遇战·胜！额外小包 ${this.gainsText(bonus)}`;
    } else {
      // 败=只回收"本单刚入账"的一部分（floor 30%·恒 ≤ 刚入账量 → 数学上碰不到既有存量；量小实物 floor 后免扣）。
      const loss = ambushLossPenalty(ctx.settledRewards);
      this.deductGains(loss);
      const lossText = Object.keys(loss).map((k) => `${this.zhRes(k)} -${loss[k]}`).join('、');
      text = lossText.length > 0
        ? `星盗遭遇战·败——遇袭损失 ${lossText}（只折本单护航收益·库存未动）`
        : '星盗遭遇战·败——本单收益无可折损项，未受损失';
    }
    this.bountyActiveCardId = '__ambush__'; // 标记：结果窗返回直接回板（不再触发二次遇袭）
    this.bountyAmbushPending = null;
    this.pendingWon = won;
    this.pendingResult = { text, color: won ? new Color(150, 235, 160) : new Color(255, 180, 150) };
    this.pendingLevelReward = null;
    this.persist();
    this.startPlayback(buildS7BattlePlayback(out.result));
  }

  /** 结果窗中键：无遇袭=「返回悬赏板」收场回板；有遇袭=「🛡 躲避袭击」——不打、零损失、中性文案返航（风险抉择之退路）。 */
  private onBountyResultReturn(): void {
    const dodged = this.bountyAmbushPending !== null;
    this.bountyActiveCardId = null;
    this.bountyAmbushPending = null;
    this.dismissBattleScene();
    this.reopenCombatHall('bounty');
    if (dodged) this.combatHall?.bountyNotice('🛡 舰队绕道返航，本单收益已入账（零损失）');
  }

  /** 结果窗右键「⚔ 正面迎战」（仅遇袭抉择时可见）：不收舞台只收结果窗，同一舞台接打星盗遭遇战。 */
  private onBountyAmbushFight(): void {
    const ambush = this.bountyAmbushPending;
    this.bountyActiveCardId = null;
    this.bountyAmbushPending = null;
    if (!ambush) { this.dismissBattleScene(); this.reopenCombatHall('bounty'); return; } // 防御：无上下文就当普通返回
    if (this.resultPopupNode) this.resultPopupNode.active = false;
    this.launchBountyAmbush(ambush);
  }

  // ===== 块4 每日推演（作战大厅内页签·GDD S10.9·Ron 2026-07-05 三修订）=====

  private makePuzzleHost(): S7DailyPuzzleHost {
    return {
      layer: this.node.layer,
      puzzleView: () => this.buildPuzzleViewData(),
      startBattle: (sel) => this.onPuzzleStart(sel),
      onClose: () => this.closeCombatHall(),
      devJump: (id) => this.devPuzzleJump(id),
      devPuzzleIds: () => this.puzzleIds(),
    };
  }

  /** 题库全部题号（表内顺序·轮换/DEV跳题用）。 */
  private puzzleIds(): string[] {
    return (this.runtime?.getAll<S7DailyPuzzleParam>('daily_puzzle_param') ?? []).map((p) => p.rowId);
  }
  private puzzleById(id: string): S7DailyPuzzleParam | null {
    return this.runtime?.getById<S7DailyPuzzleParam>('daily_puzzle_param', id) ?? null;
  }
  /** 当前活动题号：DEV 覆盖优先，否则真存档态今日题。 */
  private activePuzzleId(): string {
    return this.devPuzzleId ?? (this.playerState?.dailyPuzzle.puzzleId ?? '');
  }
  private cfgName(table: 'ship_config' | 'pilot_config' | 'plugin_config', id: string): string {
    return this.runtime?.getById<{ name?: string }>(table, id)?.name ?? id;
  }
  private puzzlePosZh(shipId: string): string {
    const zh: Record<string, string> = { assault: '突击', guard: '护卫', artillery: '炮击', support: '支援', engineer: '工程' };
    const pt = this.bountyShipPositionType(shipId);
    return pt ? zh[pt] ?? String(pt) : '—';
  }
  private threatZh(t: string): string {
    const zh: Record<string, string> = { backline: '后排点名', shield: '护盾', summon: '召唤', heal: '治疗', burst: '爆发', swarm: '蜂群', berserk: '狂暴', mixed: '综合' };
    return zh[t] ?? t;
  }
  /** 战队包携带的核/插件短文案（"核:陨星弹 插:狂热弹药"）。无则空。 */
  private puzzlePackExtra(pk: S7DailyPuzzleParam['candidatePacks'][number]): string {
    const parts: string[] = [];
    if (pk.coreId) parts.push(`核:${this.coreName(pk.coreId)}`);
    if (pk.plugins && pk.plugins.length > 0) parts.push('插:' + pk.plugins.map((pl) => this.cfgName('plugin_config', pl.pluginId)).join('/'));
    return parts.join(' ');
  }
  /** 敌单位缩略标记 + 是否威胁（沙盘高亮）。 */
  private puzzleEnemyMark(unitStatRef: string): { mark: string; threat: boolean } {
    const m: Record<string, { mark: string; threat: boolean }> = {
      bu_enemy_backline: { mark: '狙', threat: true },
      bu_enemy_shield: { mark: '盾', threat: true },
      bu_enemy_shield_warden: { mark: '盾王', threat: true },
      bu_enemy_support: { mark: '奶', threat: true },
      bu_enemy_summon_source: { mark: '召', threat: true },
      bu_enemy_burst_raider: { mark: '炮', threat: true },
      bu_enemy_charge: { mark: '冲', threat: true },
      bu_enemy_swarm: { mark: '兵', threat: false },
      bu_enemy_swarm_tough: { mark: '精', threat: false },
      bu_enemy_boss_add: { mark: '仆', threat: false },
    };
    return m[unitStatRef] ?? { mark: '敌', threat: false };
  }

  /** 推演 view 展示数据（一次性快照·含未解锁态/已解态）。 */
  private buildPuzzleViewData(): S7DailyPuzzleViewData {
    const base: S7DailyPuzzleViewData = {
      puzzleId: '', title: '每日推演', subtitle: '', threatHint: '', enemyCells: [], candidatePacks: [],
      lineupSize: PUZZLE_LINEUP_SIZE, solved: false, solvedRewardText: '', attempts: 0,
    };
    const st = this.playerState;
    if (!st || !this.runtime || !this.session) return base;
    if (!dailyPuzzleUnlocked(this.session.progress.clearedNodeIds)) {
      return { ...base, locked: true, lockedText: `打通 ${DAILY_PUZZLE_UNLOCK_NODE} 后解锁每日推演（第5关克制概念已教）` };
    }
    const pid = this.activePuzzleId();
    const p = this.puzzleById(pid);
    if (!p) return { ...base, locked: true, lockedText: '暂无今日推演题（题库待补）' };
    const idx = this.puzzleIds().indexOf(pid);
    const now = Date.now();
    const enemyCells: S7PuzzleEnemyCell[] = p.enemyFormation.map((e) => {
      const m = this.puzzleEnemyMark(e.unitStatRef);
      return { slotRef: e.slotRef, mark: m.mark, threat: m.threat };
    });
    const candidatePacks: S7PuzzlePackView[] = p.candidatePacks.map((pk) => ({
      packId: pk.packId,
      shipName: this.cfgName('ship_config', pk.shipId),
      pilotName: this.cfgName('pilot_config', pk.pilotId),
      posType: this.puzzlePosZh(pk.shipId),
      extra: this.puzzlePackExtra(pk),
    }));
    return {
      puzzleId: pid,
      title: `第 ${idx >= 0 ? idx + 1 : 1} 题 · ${this.threatZh(p.threatType)}`,
      subtitle: this.devPuzzleId ? '🧪 DEV 跳题预览（不计真存档）' : '全星港指挥官同题 · 每天凌晨4点换题',
      threatHint: p.threatHint,
      enemyCells,
      candidatePacks,
      lineupSize: PUZZLE_LINEUP_SIZE,
      solved: isDailyPuzzleSolved(st.dailyPuzzle, now, pid),
      solvedRewardText: this.gainsText(dailyPuzzleFirstWinReward()),
      attempts: dailyPuzzleAttempts(st.dailyPuzzle, now, pid),
    };
  }

  /** 推演页「开始推演」：记一次尝试（DEV题不碰真档）→ 真打。 */
  private onPuzzleStart(sel: S7DailyPuzzleSelectionEntry[]): void {
    if (!this.playerState || this.playing) return;
    if (!this.devPuzzleId) recordDailyPuzzleAttempt(this.playerState.dailyPuzzle, Date.now(), this.puzzleIds());
    this.launchPuzzleBattle(sel);
  }

  /** 真打一场推演（战队包→组装器→受控入口·就地在战斗舞台播放；摆位已在推演页做·不走主线备战屏）。
   *  胜=首胜发一次小奖(重复不发)+sfx；负=再想想(不限次·零惩罚·无广告)。结算单键「返回推演」。 */
  private launchPuzzleBattle(sel: S7DailyPuzzleSelectionEntry[]): void {
    if (!this.playerState || !this.runtime) return;
    const pid = this.activePuzzleId();
    const p = this.puzzleById(pid);
    if (!p) { this.combatHall?.puzzleNotice('暂无今日推演题'); return; }
    let out: ReturnType<typeof runDailyPuzzleBattle>;
    try {
      out = runDailyPuzzleBattle({ runtime: this.runtime, puzzle: p, selection: sel });
    } catch (err) {
      console.warn('[S7DemoController] 推演战斗启动失败', pid, err);
      this.combatHall?.puzzleNotice('⚠ 阵容不可用，换一摆再试');
      this.combatHall?.refreshActive();
      return;
    }
    this.sound.playSfx('puzzle_start');
    const won = out.result.winner === 'player';
    let text: string;
    if (won) {
      // 真题首胜发一次奖（markDailyPuzzleSolved 内含跨天对齐·DEV题不碰真档）。
      const firstWin = this.devPuzzleId ? false : markDailyPuzzleSolved(this.playerState.dailyPuzzle, Date.now(), this.puzzleIds());
      if (firstWin) {
        const rw = dailyPuzzleFirstWinReward();
        this.creditGains(rw);
        this.sound.playSfx('puzzle_solve');
        text = `🎉 妙手！推演解开 —— ${this.gainsText(rw)} · 明日再会`;
      } else {
        text = this.devPuzzleId ? '🧪 DEV 题·通过（不发奖·验证用）' : '再次通关（今日已领奖·重温不重复发）';
      }
    } else {
      text = `没解开——再想想（不限次·零惩罚·无广告）\n提示：${this.puzzleThreatAdvice(p)}`;
    }
    this.puzzleActiveId = pid;
    this.pendingWon = won;
    this.pendingResult = { text, color: won ? new Color(150, 235, 160) : new Color(255, 180, 150) };
    this.pendingLevelReward = null; // 推演无三选一
    this.persist();
    this.combatHall?.close();
    this.sound.playBgm('bgm_battle');
    if (this.prebattleNode) this.prebattleNode.active = true; // 激活战斗舞台（摆位已在推演页做·startPlayback 藏摆阵UI画战斗）
    this.startPlayback(buildS7BattlePlayback(out.result));
  }

  /** 结果窗·单键「返回推演」：收战斗画面 → 回大厅推演页（保留 DEV 跳题态·不日刷）。 */
  private onPuzzleResultReturn(): void {
    this.puzzleActiveId = null;
    this.dismissBattleScene();
    this.reopenCombatHall('puzzle');
  }

  /** 败后威胁提示（B5.3·不推广告）：按威胁类型给解法方向。 */
  private puzzleThreatAdvice(p: S7DailyPuzzleParam): string {
    const m: Record<string, string> = {
      backline: '两艘硬壳护卫放后排(c0)扛狙、脆皮远程放前列速清',
      shield: '带高爆发一口气凿穿盾，别带纯辅助拖时间',
      summon: '群伤清小弟 + 远程狙速杀召唤源，前排顶住',
      heal: '远程狙掉后排奶妈 + 爆发盖过回复',
      burst: '硬壳顶前排吃重炮、脆皮站后排输出',
    };
    return m[p.threatType] ?? '换个搭配 / 摆位再试';
  }

  /** DEV 跳题（上线前删）：内存覆盖今日题（不碰真存档态）→ 刷新推演页。 */
  private devPuzzleJump(id: string): void {
    this.devPuzzleId = id;
    this.combatHall?.refreshActive();
  }

  // ===== 块3 深空回廊（塔页 view 宿主 + 出战流程 + 里程碑 + DEV）=====

  private makeCorridorHost(): S7CorridorHost {
    return {
      layer: this.node.layer,
      nextLayer: () => (this.playerState ? nextCorridorLayer(this.playerState.corridor) : 1),
      layerCard: (L) => this.corridorLayerCard(L),
      milestones: () => this.corridorMilestoneCards(),
      challenge: () => this.onCorridorChallenge(),
      openMilestone: (L) => this.onCorridorMilestoneOpen(L),
      adDoubleMilestone: (L) => this.onCorridorMilestoneAdDouble(L),
      milestoneAdButton: () => {
        const st = this.adButtonState('corridor_milestone_double');
        const base = '开箱×2 📺';
        return { visible: st.kind !== 'hidden', label: st.kind === 'ticket' ? adTicketButtonLabel(base, st.tickets) : base };
      },
      onClose: () => this.closeCorridor(),
      devJump: (L) => this.devCorridorJump(L),
      devJumpLone: () => this.devCorridorJumpLone(),
    };
  }

  /** 深空回廊是否已解锁（首个 Boss n030 通关后·S10.7）。 */
  private corridorUnlockedNow(): boolean {
    if (!this.session || !this.runtime) return false;
    const allNodes = this.runtime.getAll<S7MainlineNodeConfig>('mainline_node_config').map((n) => ({ nodeId: n.nodeId, nodeTypeTag: n.nodeTypeTag }));
    return corridorUnlocked(this.session.progress.clearedNodeIds, firstBossNodeId(allNodes));
  }

  /** 回廊敌阵调色板（对锚批：单源过滤器=只收 bu_enemy_ 全局基础行——落数节点行混入曾致层强度非单调）。 */
  private corridorPalette(): S7CorridorEnemyPaletteEntry[] {
    return corridorPaletteFrom(
      this.runtime?.getAll<{ targetType: string; rowId: string; roleTag: string; sizeRows: number; sizeCols: number; maxHp: number; attack: number; attackIntervalSec: number }>('battle_unit_stat_param') ?? [],
    );
  }

  private corridorBosses(): string[] {
    return corridorBossNodeIds(this.runtime?.getAll<{ nodeId: string; nodeTypeTag: string }>('mainline_node_config') ?? []);
  }

  /** 回响层倍率锚（对锚批）：Boss 节点压力表（bp_nXXX.pressureRecommend）——req(L)×尖峰 ÷ 节点压力。 */
  private corridorBossPressures(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.runtime?.getAll<{ scope: string; refKey: string; pressureRecommend?: number }>('pressure_param') ?? []) {
      if (r.scope === 'boss' && typeof r.pressureRecommend === 'number') out[r.refKey] = r.pressureRecommend;
    }
    return out;
  }

  private corridorPlanFor(layer: number): S7CorridorLayerPlan {
    return corridorLayerPlan(layer, this.corridorPalette(), this.corridorBosses(), this.corridorBossPressures());
  }

  /** 某层展示卡（塔页大卡/剪影用）。 */
  private corridorLayerCard(layer: number): S7CorridorLayerCard {
    const plan = this.corridorPlanFor(layer);
    if (plan.echoBoss) {
      return {
        layer, kind: 'echo_boss',
        title: `第${layer}层 · 回响Boss ${plan.echoBoss.bossNodeId}（第${plan.echoBoss.bossOrder}位·第${plan.echoBoss.cycle + 1}轮）`,
        ruleText: `主线 Boss 强化变体 ×${plan.echoBoss.mult.toFixed(1)}`,
        solveHint: '', enemyBrief: 'Boss 敌阵', isMilestone: isMilestoneLayer(layer),
      };
    }
    if (plan.trickId) {
      const def = corridorTrickDef(plan.trickId);
      return {
        layer, kind: 'trick', title: `第${layer}层 · 戏法：${def?.name ?? plan.trickId}`,
        ruleText: def?.ruleText ?? '', solveHint: def?.solveHint ?? '',
        enemyBrief: `敌 ${plan.formation?.units.length ?? 0}`, isMilestone: isMilestoneLayer(layer),
      };
    }
    return {
      layer, kind: 'normal', title: `第${layer}层`, ruleText: '', solveHint: '',
      enemyBrief: `敌 ${plan.formation?.units.length ?? 0}`, isMilestone: isMilestoneLayer(layer),
    };
  }

  /** 回廊备战信息行（层号/戏法规则/敌情/战力）。 */
  private corridorPrepInfoText(layer: number, playerPower: number): string {
    const card = this.corridorLayerCard(layer);
    const ruleLine = card.ruleText ? `\n规则：${card.ruleText}${card.solveHint ? `　｜　解法：${card.solveHint}` : ''}` : '';
    return `【回廊】${card.title}　　${card.enemyBrief}\n我方战力 ${playerPower}${ruleLine}`;
  }

  /** 回廊敌情预览（按回廊生成敌阵/Boss节点敌阵摆位·非主线关）。 */
  private drawCorridorEnemyPreview(g: Graphics): void {
    if (this.corridorPrepLayer === null || !this.runtime) return;
    const plan = this.corridorPlanFor(this.corridorPrepLayer);
    const enemies = plan.formation
      ? plan.formation.units
      : plan.echoBoss ? bossNodeInlineEnemies(this.runtime, plan.echoBoss.bossNodeId) : [];
    const isBoss = plan.echoBoss !== null;
    for (const e of enemies) {
      const m = /^r(\d)c(\d)$/.exec(e.slotRef);
      if (!m) continue;
      const p = this.fieldEnemyPos(Number(m[1]), Number(m[2]));
      const sz = isBoss ? 46 : 30;
      g.fillColor = isBoss ? new Color(200, 90, 205, 255) : new Color(230, 110, 80, 255);
      g.rect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      g.fill();
    }
  }

  /** hub「回廊」入口：解锁校验 → 开塔页 view。 */
  private openCorridor(): void {
    if (this.playing || !this.corridorView || !this.playerState || !this.session || !this.model) return;
    if (!this.corridorUnlockedNow()) { this.hubToast('通关首个 Boss 后解锁深空回廊'); return; }
    this.corridorView.open();
  }

  private closeCorridor(): void { this.corridorView?.close(); }

  /** 塔页「挑战下一层」：进主线同款备战（回廊模式·不跳备战·每层都摆阵）。 */
  private onCorridorChallenge(): void {
    if (!this.playerState || this.playing) return;
    this.corridorPrepLayer = nextCorridorLayer(this.playerState.corridor);
    this.corridorView?.close();
    this.openPrebattle();
  }

  /** 真打一层回廊（先结算后演出·同主线口径·就地在备战舞台播放）：胜→首通推进+发小奖+sfx；负→停留原层·不罚·给养成建议。 */
  private launchCorridorBattle(layer: number): void {
    if (!this.playerState || !this.runtime || !this.squad || !this.session) return;
    const built = buildSquadLineup(this.squad, this.playerState.unitLevels, this.pluginInventory ?? undefined, this.playerState.unitTiers); // ⑩A1：驾驶员级/星入战（回执⑤）
    if (!built.ok) { this.corridorBattleError('有星舰缺驾驶员或没上阵——把阵容配好再出战'); return; }
    const plan = this.corridorPlanFor(layer);
    const team = this.teamBonusBlocks();
    const lineup = built.lineup.map((u) => {
      const extra = [...(u.extraBlocks ?? []), ...team, ...playerCritBaseBlocks()];
      return extra.length > 0 ? { ...u, extraBlocks: extra } : u;
    });
    let out: ReturnType<typeof runCorridorBattle>;
    try {
      out = runCorridorBattle({ runtime: this.runtime, plan, lineup, runSeed: `corridor_${layer}`, hardControlDiminish: S7_HARD_CONTROL_DIMINISH });
    } catch (err) {
      if (err instanceof S7CorridorLineupCapError) { this.corridorBattleError(`本层限上阵 ${err.cap} 舰——请下阵多余星舰再出战`); return; }
      console.warn('[S7DemoController] 回廊战斗启动失败', layer, err);
      this.corridorBattleError('回廊敌阵暂不可用（原型内容缺口）');
      return;
    }
    this.corridorPrepLayer = null; // 确认能开播才退出回廊备战模式
    const won = out.result.winner === 'player';
    let text: string;
    if (won) {
      const advanced = clearCorridorLayer(this.playerState.corridor, layer); // 只有首通"下一层"才推进+发小奖
      const rewards = advanced ? corridorLayerReward(layer) : {};
      if (advanced && Object.keys(rewards).length > 0) this.creditGains(rewards);
      this.sound.playSfx('tower_up');
      const msLine = advanced && isMilestoneLayer(layer) ? `\n🎁 第${layer}层里程碑已解锁——回塔手动开箱（可积攒）` : '';
      text = advanced
        ? `第 ${layer} 层通过！${this.gainsText(rewards)}${msLine}`
        : `第 ${layer} 层已通过（重打零奖励·纯练手场）`;
    } else {
      text = `第 ${layer} 层未通过——不罚·免费无限重试\n${this.corridorAdvice(plan)}`;
    }
    this.corridorActiveLayer = layer;
    this.pendingWon = won;
    this.pendingResult = { text, color: won ? new Color(150, 235, 160) : new Color(255, 180, 150) };
    this.pendingLevelReward = null; // 回廊无三选一
    this.persist();
    this.sound.playBgm('bgm_battle');
    this.startPlayback(buildS7BattlePlayback(out.result));
  }

  /** 败后养成建议（B5.2·不推广告）：戏法层给解法提示，否则给通用养成方向。 */
  private corridorAdvice(plan: S7CorridorLayerPlan): string {
    if (plan.trickId) { const d = corridorTrickDef(plan.trickId); return d ? `试试：${d.solveHint}` : '换个搭配再来'; }
    if (plan.echoBoss) return '升级星舰 / 凑克制阵容再来';
    return '升级星舰、换更强驾驶员再来';
  }

  /** 回廊战斗失败提示（备战面板开着→写信息行；否则 hubToast）。 */
  private corridorBattleError(msg: string): void {
    if (this.prebattleNode?.active && this.prebattleInfoLabel) {
      this.prebattleInfoLabel.string = `⚠ ${msg}`;
      this.prebattleInfoLabel.color = new Color(240, 200, 120);
    } else {
      this.hubToast(msg);
    }
  }

  /** 结果窗·单键「返回回廊」：收战斗画面 → 回塔页。 */
  private onCorridorResultReturn(): void {
    this.corridorActiveLayer = null;
    this.dismissBattleScene();
    this.openCorridor();
  }

  /** 当前可开里程碑（塔页用·带奖励短文案）。 */
  private corridorMilestoneCards(): S7CorridorMilestoneCard[] {
    if (!this.playerState) return [];
    return availableCorridorMilestones(this.playerState.corridor).map((layer) => ({
      layer, rewardText: this.gainsText(corridorMilestoneReward(layer)),
    }));
  }

  /** 开一个里程碑宝箱（塔页手动开·可积攒）：直发货币 + sfx + 回执。 */
  private onCorridorMilestoneOpen(layer: number): void {
    if (!this.playerState) return;
    const reward = claimCorridorMilestone(this.playerState.corridor, layer);
    if (!reward) { this.hubToast('该里程碑已开或未通到'); return; }
    this.creditGains(reward);
    this.sound.playSfx('tower_milestone');
    this.persist();
    this.corridorView?.refresh();
    this.corridorView?.notice(`🎁 第${layer}层里程碑：${this.gainsText(reward)} 已入账`);
  }

  /** 看广告翻倍开箱（广告点位 #10·块5 起每日1次/券态/失败退券走统一广告流）：先确认可开→看广告→翻倍入账。 */
  private onCorridorMilestoneAdDouble(layer: number): void {
    if (!this.playerState) return;
    if (!canClaimCorridorMilestone(this.playerState.corridor, layer)) { this.hubToast('该里程碑已开或未通到'); return; }
    this.runAdPoint('corridor_milestone_double',
      () => {
        if (!this.playerState) return;
        const reward = claimCorridorMilestone(this.playerState.corridor, layer);
        if (!reward) return;
        const doubled = doubleCorridorReward(reward);
        this.creditGains(doubled);
        this.sound.playSfx('tower_milestone');
        this.persist();
        this.corridorView?.refresh();
        this.corridorView?.notice(`🎁 第${layer}层里程碑×2✓：${this.gainsText(doubled)} 已入账`);
      },
      (reason) => {
        this.corridorView?.refresh(); // 券态可能已退回·刷键
        this.corridorView?.notice(reason === 'ad_failed' ? '广告未看完·未翻倍（可点「开箱」普通领取）' : '广告加载失败（可点「开箱」普通领取）');
      });
  }

  /** DEV-TEMP·回廊跳层（拨已通最高层到 targetLayer-1·下一层=target）：验戏法/回响Boss/深层。上线前删。 */
  private devCorridorJump(targetLayer: number): void {
    if (!this.playerState) return;
    const t = Math.max(1, Math.floor(targetLayer));
    this.playerState.corridor.highestClearedLayer = t - 1;
    this.playerState.corridor.claimedMilestones = this.playerState.corridor.claimedMilestones.filter((L) => L <= t - 1); // 保持不预领未来
    this.persist();
    this.corridorView?.refresh();
    this.corridorView?.notice(`DEV：已拨到 下一层 = 第 ${t} 层`);
  }

  /** DEV-TEMP·跳到下一个孤胆英雄层（深层专属·扫描）。上线前删。 */
  private devCorridorJumpLone(): void {
    if (!this.playerState) return;
    const from = nextCorridorLayer(this.playerState.corridor);
    for (let L = Math.max(from, 100); L <= from + 5000; L += 10) {
      if (!isEchoBossLayer(L) && pickCorridorTrick(L) === 'lone_hero') { this.devCorridorJump(L); return; }
    }
    this.hubToast('DEV：附近没找到孤胆层');
  }

  /** 把奖励 map 入账钱包（护栏：只加钱包键·非钱包键跳过）。 */
  private creditGains(gains: Record<string, number>): void {
    if (!this.session) return;
    const res = this.session.resources as Record<string, number>;
    for (const [key, amt] of Object.entries(gains)) {
      if (res[key] !== undefined && amt > 0) res[key] += amt;
    }
  }

  /** 从钱包扣减（遇袭折损用）：按设计只回收"本单刚入账"的部分（恒 ≤ 刚入账量·动不到存量），防御钳到 0。 */
  private deductGains(loss: Record<string, number>): void {
    if (!this.session) return;
    const res = this.session.resources as Record<string, number>;
    for (const [key, amt] of Object.entries(loss)) {
      if (res[key] !== undefined && amt > 0) res[key] = Math.max(0, res[key] - amt);
    }
  }

  /** DEV-TEMP：重掷今日3张悬赏卡（换种子重抽·验词缀分布与槽位洗牌；品质=明保底日程表随 fakeKey 变化）。上线前删。 */
  private devRerollBounty(): void {
    if (!this.playerState || this.playing) return;
    const st = this.playerState.bounty;
    if (st.lastGenDayKey <= 0) { this.hubToast('[DEV] 先开一次悬赏板再重掷'); return; }
    const batchKey = this.devBountyLastBatchKey > 0 ? this.devBountyLastBatchKey : st.lastGenDayKey;
    st.cards = st.cards.filter((c) => c.genDayKey !== batchKey); // 只换当前批（更早积压留着）
    this.devBountySalt += 1;
    const fakeKey = st.lastGenDayKey * 1000 + this.devBountySalt; // 变种子重抽（确定性基建不动）
    const pool = (this.runtime?.getAll<{ rowId: string }>('commission_affix_param') ?? []).map((r) => r.rowId);
    const r = generateDayCards(fakeKey, pool);
    for (const c of r.cards) st.cards.push(c);
    this.devBountyLastBatchKey = fakeKey;
    const habitatLv = this.buildings ? getBuildingLevel(this.buildings, 'bld_habitat') : 0;
    const cap = bountyBoardCap(habitatLv);
    if (st.cards.length > cap) st.cards.splice(0, st.cards.length - cap);
    this.persist();
    if (this.combatHall?.isOpen) this.combatHall.refreshActive();
    const golds = r.cards.filter((c) => c.quality === 'gold').length;
    this.hubToast(`[DEV] 重掷3张：金×${golds}（明保底：每3发卡日1金·每日≥1银）`);
  }

  /** DEV-TEMP：武装/解除「下张护航打赢必遇袭」（仅内存·用掉即灭；15% 概率打几次不中很正常、没法验收）。上线前删。 */
  private devToggleForceAmbush(): void {
    this.devBountyForceAmbush = !this.devBountyForceAmbush;
    this.hubToast(this.devBountyForceAmbush ? '[DEV] 已武装：下张护航打赢必遇袭' : '[DEV] 已解除必遇袭');
  }

  // ===== C 建筑面板 =====

  /** 打开基地建筑面板（回放期间禁用）。 */
  private openBase(): void {
    if (this.playing || !this.baseNode) return;
    this.refreshBasePanel();
    this.baseNode.active = true;
    if (this.baseCloseBtn) this.baseCloseBtn.active = true;
  }

  private closeBase(): void {
    if (this.baseNode) this.baseNode.active = false;
    if (this.baseCloseBtn) this.baseCloseBtn.active = false;
  }

  /** 点某建筑行：升 1 级（花星矿，工人折扣）→ 落盘 + 刷新（含面板）。 */
  private onUpgradeBuilding(buildingId: string): void {
    if (!this.playerState || !this.buildings || !this.population || this.playing) return;
    const r = upgradeBuildingWithDiscount(this.buildings, this.playerState.resources, this.population, buildingId);
    const name = S7_BUILDING_NAMES[buildingId] ?? buildingId;
    if (r.ok) {
      this.setResult(`${name} 升到 Lv.${r.newLevel}！花 ${r.starOreSpent}星矿`, new Color(150, 235, 180));
    } else if (r.code === 'insufficient_star_ore') {
      this.setResult(`${name} 星矿不够（去出战/回收攒矿）`, new Color(235, 150, 150));
    } else if (r.code === 'max_level') {
      this.setResult(`${name} 已满级（Lv.10）`, new Color(220, 210, 140));
    } else {
      this.setResult(`${name} 暂不可升级`, new Color(200, 200, 200));
    }
    this.persist();
    this.refresh();
    this.refreshBasePanel();
  }

  /** 刷新建筑面板各行文案（等级/效果/折后成本/买不买得起）。 */
  private refreshBasePanel(): void {
    if (!this.buildings || !this.playerState || !this.population) return;
    const rows = buildBuildingUpgradeView(S7_DEMO_DEFAULT_BUILDINGS, this.buildings, this.playerState.resources, this.population);
    for (let i = 0; i < rows.length && i < this.baseRowLabels.length; i += 1) {
      const row = rows[i];
      const name = S7_BUILDING_NAMES[row.buildingId] ?? row.buildingId;
      const lbl = this.baseRowLabels[i];
      const eff = this.effectSummary(row.buildingId, row.level);
      if (!row.unlocked) {
        lbl.string = `${name}  未解锁`;
        lbl.color = new Color(140, 140, 150);
      } else if (row.atMax) {
        lbl.string = `${name} Lv.${row.level} 满级 · ${eff}`;
        lbl.color = new Color(190, 200, 220);
      } else {
        lbl.string = `${name} Lv.${row.level} · ${eff} · 升级 ${row.discountedCost}矿`;
        lbl.color = row.canAfford ? new Color(180, 235, 180) : new Color(220, 160, 150);
      }
    }
  }

  /** 建筑当前等级的效果一句话（显示用；原型仅居住舱→离线 真生效，余为展示）。 */
  private effectSummary(buildingId: string, level: number): string {
    switch (buildingId) {
      case 'bld_habitat': return `离线${Math.round(offlineStorageHours(level))}h·产率+${Math.round(offlineRateBonusPct(level))}%·编制${habitatStaffCap(level)}`;
      case 'bld_dock': return `星舰升级合金 -${(UPGRADE_DISCOUNT_PCT_PER_LEVEL * level).toFixed(1)}%`;
      case 'bld_pilot_training_bay': return `驾驶员升级记录 -${(UPGRADE_DISCOUNT_PCT_PER_LEVEL * level).toFixed(1)}%`;
      case 'bld_research_tower': return `全队血攻+${researchTeamBonusPct(level)}%`;
      case 'bld_rsv_core_gallery': return `每种星核收藏+${coreGalleryPerTypeBonusPct(level).toFixed(2)}%(×收集种数·封顶10%)`;
      case 'bld_salvage_port': return `打捞队${salvageTeamCount(level)}`;
      case 'bld_merchant_station': return `稀有格${merchantRareSlots(level)}·升级送1次免费刷新`;
      case 'bld_supply_station': return `A级出率+${supplyATierRateBumpPct(level)}pp·免费抽${supplyFreeDailyPulls(level)}/日`;
      default: return '';
    }
  }

  // ===== 刷新 / 落盘 =====

  private refresh(): void {
    if (!this.session || !this.statusLabel || !this.playerState) return;
    const perfT0 = Date.now(); // DEV-TEMP：[PERF] 探针（复验批·公共 refresh 主链延迟证据·上线前随 DEV 清单删）
    const r = this.session.resources;
    const ore = Math.floor(r.starOre ?? 0);
    const alloy = Math.floor(r.hullAlloy ?? 0);
    const cleared = this.session.progress.clearedNodeIds.length;
    const flagLv = getShipLevel(this.playerState.unitLevels, S7_DEMO_FLAGSHIP_ID);
    // 旗舰有效血/攻 = 基础 × 战力倍率(power(lv)/power(1))——升级后数字变大,直观看到变强。
    const p1 = unitPowerAtLevel(this.growthBands, 'ship', 1);
    const ratio = p1 > 0 ? unitPowerAtLevel(this.growthBands, 'ship', flagLv) / p1 : 1;
    const effHp = Math.round(this.flagshipBaseHp * ratio);
    const effAtk = Math.round(this.flagshipBaseAtk * ratio);
    this.statusLabel.string =
      `[DEV] 合金 ${alloy} · 节点 ${this.session.currentNodeId} · 通关 ${cleared} · 旗舰Lv.${flagLv} 血${effHp}攻${effAtk}`;
    // 顶部货币栏（星矿/星贝/补给券）。
    if (this.hubOreLabel) this.hubOreLabel.string = `星矿\n${this.fmtNum(ore)}`;
    if (this.hubCargoLabel) this.hubCargoLabel.string = `星贝\n${this.fmtNum(Math.floor(r.starCargo ?? 0))}`;
    if (this.hubTicketLabel) this.hubTicketLabel.string = `补给券\n${this.fmtNum(Math.floor(r.supplyTicket ?? 0))}`;
    // 块1：回港报告为弹窗生命周期（必领才关），无常驻领取按钮。
    // 块2：星港悬赏入口=关5 强引导结束后解锁（S10.8）。
    if (this.hubCombatHallBtn) this.hubCombatHallBtn.active = !!this.playerState?.tutorial.strongGuideDone;
    // 块3：深空回廊入口=首个 Boss（n030）通关后解锁（S10.7）。
    if (this.hubCorridorBtn) this.hubCorridorBtn.active = this.corridorUnlockedNow();
    // 块5：今日补给箱礼盒岛（S13 #2·统一三态）：当日已开→隐入背景（非置灰·零红点）；持券恢复+「广告券×N」。
    this.applyAdButton(this.hubSupplyChestNode, this.hubSupplyChestSubLabel, DAILY_SUPPLY_CHEST_AD_POINT, '🎁 今日补给箱 · 看广告开');
    // J：hub 建筑入口显等级 + 可升↑（买得起且未满级亮提示）。
    if (this.hubBuildingTracks.length > 0 && this.buildings && this.population) {
      const views = buildBuildingUpgradeView(this.hubBuildingTracks.map((t) => t.id), this.buildings, this.playerState.resources, this.population);
      const byId = new Map(views.map((v) => [v.buildingId, v]));
      for (const t of this.hubBuildingTracks) {
        if (this.buildings && !isBuildingUnlocked(this.buildings, t.id)) { // 未解锁建筑显示「未解锁」(Ron 真机反馈)
          t.label.string = '未解锁'; t.label.color = new Color(200, 160, 150, 220); continue;
        }
        const v = byId.get(t.id);
        if (!v) continue;
        t.label.string = v.atMax ? `Lv.${v.level} 满级` : v.canAfford ? `Lv.${v.level} 可升↑` : `Lv.${v.level}`;
        t.label.color = v.canAfford && !v.atMax ? new Color(140, 235, 160) : new Color(225, 235, 255, 200);
      }
    }
    // hub「邮件」入口：可领数 > 0 显红绿提示。
    if (this.hubMailSubLabel) {
      const claimable = claimableMailCount(this.playerState.mailbox, Date.now());
      this.hubMailSubLabel.string = claimable > 0 ? `领取×${claimable}` : '查看';
      this.hubMailSubLabel.color = claimable > 0 ? new Color(140, 235, 160) : new Color(225, 235, 255, 200);
    }
    const perfCost = Date.now() - perfT0;
    if (perfCost >= 8) console.log(`[PERF][DEV-TEMP] hub refresh ${perfCost}ms`);
  }

  /** 千分位格式化（避免 locale 差异·手写分组）。 */
  private fmtNum(n: number): string {
    const s = String(Math.max(0, Math.floor(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 把会话当前态写回 S7 存档域并落盘（独立 key，不动流程版存档）。 */
  private persist(): void {
    if (!this.adapter || !this.session || !this.playerState) return;
    // 会话推进时 progress 被整体替换，需同步回 playerState 再落盘；resources 为同一引用、已就地更新。
    this.playerState.mainlineProgress = this.session.progress;
    const data: S7SaveData = {
      saveVersion: this.saveVersion,
      playerState: this.playerState,
      lastOnlineTime: Date.now(),
    };
    try {
      persistS7Save(this.adapter, data, Date.now());
    } catch (err) {
      console.error('[S7DemoController] S7 存档落盘失败', err);
    }
  }

  private setResult(text: string, color: Color): void {
    if (!this.resultLabel) return;
    this.resultLabel.string = text;
    this.resultLabel.color = color;
  }

  /** 战斗败因码→中文短句（仅显示用，未列出的回退原码）。 */
  private zhHint(code: string): string {
    const map: Record<string, string> = {
      enemy_win_all_players_down: '全队被打光',
      enemy_win_timeout: '超时没清场',
      enemy_win_shield_not_broken: '护盾没破掉',
      enemy_win_swarm_overflow: '敌人太多清不完',
      enemy_win_summon_overflow: '召唤物压场',
      enemy_win_boss_final_phase: '头目狂暴翻盘',
      enemy_win_unknown: '战斗失利',
    };
    return map[code] ?? code;
  }

  /** 货币键→中文短名（仅显示用，未列出的回退键名）。 */
  private zhRes(resourceId: string): string {
    const map: Record<string, string> = {
      starOre: '星矿',
      hullAlloy: '合金',
      pilotToken: '驾驶记录',
      starCargo: '星贝',
      supplyTicket: '补给券',
      coreFrag: '星核碎片',
      shipBlueprint: '通用舰碎片',
      pilotShardUniversal: '通用员碎片',
      starGem: '星空宝石',
      fullCore: '完整星核',
      beaconCommon: '普通信标',
      beaconRare: '稀有信标',
      beaconEpic: '史诗信标',
      adTicket: '广告券',
    };
    return map[resourceId] ?? resourceId;
  }
}
