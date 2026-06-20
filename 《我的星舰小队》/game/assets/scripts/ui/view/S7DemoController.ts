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
import { S7UpgradeCostParam, S7BattleUnitStatParam, S7GrowthBandParam, S7BattleEncounterParam, S7PluginConfig, S7PluginSlot, S7ShipConfig, S7PilotConfig } from '../../config/s7/ConfigTypesS7';
import { S7MainlineModel, createDefaultS7MainlineProgress } from '../../core/s7/S7MainlineProgress';
import { S7RunSession, S7PlayNodeOutcome } from '../../core/s7/S7RunSession';
import { getShipLevel } from '../../core/s7/S7UnitLevelState';
import { upgradeShipOneLevel } from '../../core/s7/S7UnitUpgradeService';
import { unitPowerAtLevel } from '../../core/s7/S7UnitGrowth';
import { buildS7BattlePlayback, S7BattlePlayback, S7PlaybackFrame } from '../../core/s7/S7BattlePlayback';
import {
  computeS7OfflineSettlement,
  applyOfflineGains,
  S7OfflineSettlement,
} from '../../core/s7/S7OfflineSettlement';
import {
  buildBuildingUpgradeView,
  upgradeBuildingWithDiscount,
} from '../../core/s7/S7BuildingUpgradeFlow';
import { S7BuildingState, isBuildingUnlocked, unlockBuilding, createDefaultS7BuildingState, getBuildingLevel } from '../../core/s7/S7BuildingState';
import { S7PopulationState, createDefaultS7Population } from '../../core/s7/S7Population';
import {
  shipLevelCap, driverLevelCap, offlineStorageHours, offlineRateBonusPct,
  salvageTeamCount, researchTeamBonusPct, merchantShopSlots, coreGalleryTeamBonusPct,
  coreGalleryPerTypeBonusPct,
} from '../../core/s7/S7BuildingEffects';
import { S7EffectBlock } from '../../core/s7/S7BattleEffectBlock';
import { getS7UsableBand } from '../S7UiLayout';
import {
  S7SquadState, grantShip, grantPilot, grantCore, assignSlot, clearSlot, moveOrSwapFormationSlot, buildSquadLineup,
  isShipDeployed, findPilotShip, findCoreShip, findPluginShip,
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
import { S7AdGateway, S7MockAdAdapter } from '../../core/s7/S7AdGateway';
import { S7AutoBattleRng } from '../../core/s7/S7AutoBattleRng';
// D 信标打捞（step1 引擎已单测）：主界面「打捞港」进打捞界面。
import { DEFAULT_S7_SALVAGE_CONFIG, S7BeaconTier, BEACON_RESOURCE, S7SalvageReward } from '../../core/s7/S7SalvageConfig';
import {
  startSalvage, collectSalvage, salvageAdSpeedup, salvageRemainingMs, isSalvageDone, salvageTeamLimit,
} from '../../core/s7/S7SalvageService';
import { addExclusiveShards } from '../../core/s7/S7ExclusiveShardInventory';
import { addChest } from '../../core/s7/S7ChestInventory';
import { createDefaultS7GachaState } from '../../core/s7/S7GachaState';
import { createDefaultS7Salvage } from '../../core/s7/S7SalvageState';
import { createDefaultS7Merchant } from '../../core/s7/S7MerchantState';
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
/** B 块 DEV-TEMP·开局发插件实例（待抽卡/掉落/合成接好后删）：覆盖三槽 + 品质混搭。pluginId 见 plugin_config。 */
const S7_DEMO_SEED_PLUGINS: { pluginId: string; quality: 'fine' | 'superior' | 'legendary' }[] = [
  { pluginId: 'plg02', quality: 'legendary' }, // 武器
  { pluginId: 'plg09', quality: 'fine' },      // 武器
  { pluginId: 'plg07', quality: 'superior' },  // 技能
  { pluginId: 'plg18', quality: 'fine' },      // 技能
  { pluginId: 'plg01', quality: 'legendary' }, // 战术
  { pluginId: 'plg03', quality: 'fine' },      // 战术
];
/** B 块 DEV-TEMP·开局发星核（待星核三渠道接好后删）：core07=过载核心(有真战斗质变)。 */
const S7_DEMO_SEED_CORES = ['core07', 'core01', 'core02'];
/** 插件槽位类型中文（仅显示用）。 */
const S7_SLOT_TAG_NAMES: Record<S7PluginSlot, string> = { weapon: '武器', skill: '技能', tactical: '战术' };
/** 品质中文（仅显示用）。 */
const S7_QUALITY_NAMES: Record<string, string> = { fine: '精良', superior: '优秀', legendary: '传奇' };
/** 品质排序权重（越大越靠前）。插件用；驾驶员/星核暂无品质等级→0。 */
const S7_QUALITY_RANK: Record<string, number> = { legendary: 3, superior: 2, fine: 1 };

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
};

/** 固定开发种子：同节点同阵容可复现（早期节点默认 3 舰确定性胜）。 */
const S7_DEMO_RUN_SEED = 's7-demo';
/** 演示用旗舰 = 默认阵容首舰；「升级旗舰」升它、出战时它按等级变强。 */
const S7_DEMO_FLAGSHIP_ID = 'shp01';

@ccclass('S7DemoController')
export class S7DemoController extends Component {
  private adapter: SaveStorageAdapter | null = null;
  private session: S7RunSession | null = null;
  private playerState: S7PlayerState | null = null;
  private saveVersion = S7_CURRENT_SAVE_VERSION;
  private upgradeCostRows: S7UpgradeCostParam[] = [];
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
  /** 本次上线算出的未领离线收益（null=无）。 */
  private offlinePending: S7OfflineSettlement | null = null;
  private offlineBtn: Node | null = null;
  /** 建筑面板叠加层 + 每行 Label（与 S7_DEMO_DEFAULT_BUILDINGS 等长平行）。 */
  private baseNode: Node | null = null;
  private baseRowLabels: Label[] = [];
  private baseCloseBtn: Node | null = null;

  // ===== A-step2 战前备战界面 =====
  private squad: S7SquadState | null = null;
  private prebattleNode: Node | null = null;
  private prebattleGfx: Graphics | null = null;     // 画底板 + 敌情预览 + 九宫格（也用于"战斗即战前"的就地演出）
  private prebattleInfoLabel: Label | null = null;  // 节点名 + 我方VS推荐战力 + 敌情概要
  private prebattleCellLabels: Label[] = [];        // 9 格文字(与 SLOTS 平行)
  /** 备战可交互 UI 容器（标题/信息/九宫格/底部按钮）；开战时整体隐藏，让 gfx 就地演战斗。 */
  private prebattleUiNode: Node | null = null;
  /** 备战内嵌战斗的「跳过」键（挂在备战面板上，开战时显示）。 */
  private prebattleSkipBtn: Node | null = null;
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

  // ===== D 打捞港界面（信标打捞）=====
  private salvageNode: Node | null = null;
  private salvageSelTier: S7BeaconTier = 'common';
  private salvageSelHours = 2;
  private salvageInfoLabel: Label | null = null;    // 信标存量 + 打捞队占用
  private salvageResultLabel: Label | null = null;  // 收菜/操作结果
  private salvageListNode: Node | null = null;      // 进行中任务列表容器（刷新重建）
  private salvageTierBtns: { tier: S7BeaconTier; node: Node }[] = [];
  private salvageHourBtns: { hours: number; node: Node }[] = [];
  private salvageTicking = false;                   // 打捞界面开着时每秒刷新倒计时

  // ===== E 商人小站界面 =====
  private merchantNode: Node | null = null;
  private merchantStarLabel: Label | null = null;  // 星贝余量 + 刷新次数
  private merchantListNode: Node | null = null;     // 货架 offer 列表容器（刷新重建）
  private merchantSellNode: Node | null = null;      // 回收按钮容器（随等级解锁·刷新重建）
  private merchantResultLabel: Label | null = null;

  // ===== J 建筑升级入口（弹框·各建筑共用 + 主界面等级/可升提示）=====
  private buildingUpgradeNode: Node | null = null;
  private buildingUpgradeTarget = '';
  private buUpTitleLabel: Label | null = null;
  private buUpInfoLabel: Label | null = null;
  private buUpBtn: Node | null = null;           // 升级按钮（满级/买不起→灰）
  private hubBuildingTracks: { id: string; label: Label }[] = []; // hub 建筑入口副标签(显等级/可升↑)
  private loadoutNode: Node | null = null;
  private loadoutTitleLabel: Label | null = null;
  private loadoutMsgLabel: Label | null = null;
  /** 装备列表容器（每次刷新清空重建：驾驶员/插件分三类/星核 + 装在哪艘船标记）。 */
  private loadoutListNode: Node | null = null;
  // 装备详情弹窗：标题/信息 + 取消 + 主操作按钮(装备/卸下，文字与行为按状态变)。
  private equipDetailNode: Node | null = null;
  private equipDetailTitle: Label | null = null;
  private equipDetailInfo: Label | null = null;
  private equipDetailActionLabel: Label | null = null;
  /** 当前详情弹窗针对的装备 + 主操作模式。 */
  private equipPending: S7EquipRef | null = null;
  private equipActionMode: 'equip' | 'unequip' | 'move' = 'equip';
  // 移动确认弹窗（装备已在别船时二次确认）。
  private equipConfirmNode: Node | null = null;
  private equipConfirmLabel: Label | null = null;
  /** 本场战斗是否胜（finishPlayback 据此路由：胜→下一关备战 / 败→失败弹窗）。 */
  private pendingWon = false;
  /** 战斗结果弹窗（胜/败统一）：标题/文案/右键文字（胜=下一关·败=再次挑战）。弹出时背景保留刚结束的战斗画面。 */
  private resultPopupNode: Node | null = null;
  private resultTitleLabel: Label | null = null;
  private resultMsgLabel: Label | null = null;
  private resultRightLabel: Label | null = null;

  /** 由 MainSceneController 在 S7 配置预载成功后调用：注入 runtime + 存储适配器，建会话 + 搭色块 UI。 */
  init(runtime: S7ConfigRuntime, adapter: SaveStorageAdapter): void {
    this.adapter = adapter;
    this.runtime = runtime;
    const model = S7MainlineModel.fromRuntime(runtime);
    this.model = model;
    this.upgradeCostRows = runtime.getAll<S7UpgradeCostParam>('upgrade_cost_param');
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
    this.ensureDemoSquadSeeded();
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
    this.ensureDefaultBuildingsUnlocked(); // 就地解锁 buildings（同引用）
    const offline = computeS7OfflineSettlement(
      model, buildings, population, this.playerState.mainlineProgress, loaded.data.lastOnlineTime, now,
    );
    this.offlinePending = offline.hasGains ? offline : null;

    // C 抽卡：赞助补给看广告得券——首发接 mock 适配器（确定性·阶段五换真 SDK，玩法零改）。
    this.adGateway = new S7AdGateway(new S7MockAdAdapter());

    this.buildUi();
    this.refresh();
    // 上线即有离线收益：在结果行提示金额，引导点上方金色「领取」。
    if (this.offlinePending) {
      this.setResult(`离线攒了 ${this.offlineGainsText(this.offlinePending.gains)}，点上方「领取离线收益」`, new Color(235, 215, 130));
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
        // J DEV-TEMP：给一笔星矿，方便测建筑升级（升级花星矿·正式靠出战/离线/回收攒）。
        if ((r.starOre ?? 0) < 100000) r.starOre = 100000;
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

  // ===== 战场/备战 共用坐标（上下对称·中间留隙；备战看到的站位 = 战斗站位）=====
  /** 我方格位屏幕坐标：row(0-2)=横向左右、col(0-2)=纵深(c2前排靠中线·在上)。我方占下半。 */
  private fieldPlayerPos(row: number, col: number): { x: number; y: number } {
    const W = this.viewW, H = this.viewH;
    return { x: (row - 1) * (W * 0.235), y: -H * 0.05 - ((2 - col) / 2) * (H * 0.20) };
  }
  /** 敌方格位屏幕坐标：row(0-4)=横向、col(0-6)=纵深(c0前排靠中线·在下)。敌方占上半。 */
  private fieldEnemyPos(row: number, col: number): { x: number; y: number } {
    const W = this.viewW, H = this.viewH;
    return { x: -W * 0.42 + ((row + 0.5) / 5) * (W * 0.84), y: H * 0.05 + (col / 6) * (H * 0.26) };
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
  }

  // ===== 星港主界面 hub =====

  /** 搭星港主界面（灰盒色块·参照基地主界面图的入口布局）：顶部货币栏 + 活动 + 7 建筑入口 + 背包/邮件 + 出战 + 小 DEV 工具行。 */
  private buildHubHome(W: number, H: number): void {
    const band = getS7UsableBand();
    const topY = band.usableTopY; // 安全区下沿（避刘海/胶囊）
    const botY = band.usableBottomY;

    // —— 顶部：标题 + 货币栏（星矿/星贝/补给券·设计§10.5 主界面只常驻这 3 个）——
    this.makeLabel('⭐ 星港', 48, new Color(255, 232, 120), -W * 0.34, topY - 34);
    const cy = topY - 108;
    this.hubOreLabel = this.makeHubChip('星矿', -W * 0.30, cy, new Color(150, 90, 210, 255));
    this.hubCargoLabel = this.makeHubChip('星贝', 0, cy, new Color(210, 170, 60, 255));
    this.hubTicketLabel = this.makeHubChip('补给券', W * 0.30, cy, new Color(70, 150, 200, 255));

    // —— 活动（左右两枚·占位）——
    const ay = topY - 210;
    this.makeHubEntry('3天行动', '即将开放', new Color(90, 160, 120, 255), -W * 0.24, ay, 290, 88, () => this.hubToast('3天行动·即将开放'));
    this.makeHubEntry('7天扩张', '即将开放', new Color(120, 110, 180, 255), W * 0.24, ay, 290, 88, () => this.hubToast('7天扩张·即将开放'));

    // —— 7 建筑入口岛（2 列网格）——
    const gy0 = topY - 360;
    const gap = 150;
    const lx = -W * 0.24, rx = W * 0.24, ew = 300, eh = 118;
    this.makeHubEntry('船坞', '即将开放', new Color(80, 130, 200, 255), lx, gy0, ew, eh, () => this.hubToast('船坞·即将开放'));
    this.makeHubEntry('打捞港', '打捞', new Color(70, 160, 190, 255), rx, gy0, ew, eh, () => this.openSalvage(), 'bld_salvage_port');
    this.makeHubEntry('居住舱', '升级', new Color(160, 130, 90, 255), lx, gy0 - gap, ew, eh, () => this.openBuildingUpgrade('bld_habitat'), 'bld_habitat');
    this.makeHubEntry('星港补给站', '抽卡', new Color(210, 120, 70, 255), rx, gy0 - gap, ew, eh, () => this.openGacha());
    this.makeHubEntry('商人小站', '买卖', new Color(150, 110, 70, 255), lx, gy0 - gap * 2, ew, eh, () => this.openMerchant(), 'bld_merchant_station');
    this.makeHubEntry('研究塔', '升级', new Color(90, 110, 150, 255), rx, gy0 - gap * 2, ew, eh, () => this.openBuildingUpgrade('bld_research_tower'), 'bld_research_tower');
    this.makeHubEntry('星核展厅', '升级', new Color(120, 100, 150, 255), 0, gy0 - gap * 3, ew, eh, () => this.openBuildingUpgrade('bld_rsv_core_gallery'), 'bld_rsv_core_gallery');

    // —— 底部：背包 / 邮件（左）+ 出战（右·大）——
    this.makeHubEntry('背包', '即将开放', new Color(110, 115, 130, 255), -W * 0.33, botY + 170, 160, 96, () => this.hubToast('背包·即将开放'));
    this.makeHubEntry('邮件', '即将开放', new Color(110, 115, 130, 255), -W * 0.11, botY + 170, 160, 96, () => this.hubToast('邮件·即将开放'));
    this.makeButton('出战', 320, 132, new Color(245, 170, 50, 255), W * 0.20, botY + 152, () => this.openPrebattle());

    // —— 中央临时提示（默认空）——
    this.hubToastLabel = this.makeLabel('', 30, new Color(255, 235, 160), 0, gy0 - gap * 3 - 100);

    // —— DEV-TEMP 工具行（小·演示用·正式版去掉；离线收益领取也并在此带出金额）——
    this.makeButton('升级旗舰', 180, 60, new Color(60, 150, 100, 255), -W * 0.30, botY + 56, () => this.onUpgradeFlagship());
    this.offlineBtn = this.makeButton('领离线', 180, 60, new Color(205, 165, 60, 255), 0, botY + 56, () => this.onClaimOffline());
    this.offlineBtn.active = false;
    this.makeButton('重置存档', 180, 60, new Color(120, 70, 70, 255), W * 0.30, botY + 56, () => this.onReset());
    // 状态行（DEV·细字·旗舰等级/节点等）+ 结果行（操作反馈）：保留供 refresh()/setResult() 用。
    this.statusLabel = this.makeLabel('', 22, new Color(150, 165, 190), 0, botY + 108);
    this.resultLabel = this.makeLabel('点「出战」推进主线', 24, new Color(170, 220, 175), 0, botY + 134);
  }

  /** 货币 chip：圆角底 + 「名 值」标签。返回值标签（refresh 更新数字）。 */
  private makeHubChip(name: string, x: number, y: number, color: Color): Label {
    const node = new Node('S7HubChip'); node.layer = this.node.layer; this.node.addChild(node); node.setPosition(x, y, 0);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(36, 42, 60, 235); g.roundRect(-110, -34, 220, 68, 16); g.fill();
    g.fillColor = color; g.roundRect(-110, -34, 12, 68, 6); g.fill(); // 左侧色条区分币种
    const lab = new Node('v'); lab.layer = this.node.layer; node.addChild(lab); lab.setPosition(8, 0, 0);
    const l = lab.addComponent(Label); l.fontSize = 26; l.lineHeight = 32; l.color = new Color(235, 240, 250); l.string = `${name}\n0`;
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

    // 当前池说明 + 保底进度（多行）。
    this.gachaInfoLabel = this.mkPanelLabel(panel, '', 28, new Color(220, 230, 245), 0, topY - 230);
    // 专属池兑换进度 + 领箱按钮（仅专属池显示）。
    this.gachaExchangeLabel = this.mkPanelLabel(panel, '', 26, new Color(255, 215, 140), 0, topY - 330);
    const claim = this.addBtn(panel, '领兑换箱', 280, 80, new Color(220, 150, 60, 255), 0, topY - 400, () => this.onGachaClaim(), 30);
    this.gachaClaimBtn = claim.node.parent; // addBtn 返回 Label，其父节点 = 按钮节点
    if (this.gachaClaimBtn) this.gachaClaimBtn.active = false;

    // 出货明细（多行·居中偏下）。
    this.gachaResultLabel = this.mkPanelLabel(panel, '点下方抽卡', 26, new Color(180, 230, 190), 0, -H * 0.04);

    // 单抽 / 十连（券不足时变灰·点了没反应，见 refreshGacha + onGachaDraw 守门）。
    const single = this.addBtn(panel, '单抽\n(1券)', 260, 110, new Color(70, 130, 200, 255), -W * 0.22, botY + 230, () => this.onGachaDraw(1), 32);
    this.gachaSingleBtn = single.node.parent;
    const ten = this.addBtn(panel, '十连\n(10券)', 260, 110, new Color(80, 160, 120, 255), W * 0.22, botY + 230, () => this.onGachaDraw(10), 32);
    this.gachaTenBtn = ten.node.parent;
    // 赞助补给（看广告得券）。
    this.addBtn(panel, '赞助补给·看广告得补给券', 460, 80, new Color(200, 120, 70, 255), 0, botY + 120, () => this.onGachaSponsorAd(), 28);
    // 返回星港。
    this.addBtn(panel, '返回星港', 240, 80, new Color(120, 90, 160, 255), 0, botY + 36, () => this.closeGacha(), 30);
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
    info += `\n阶级地板保底 ${gacha.pity[pool]}/${cfg.floorPityDraws}（满必出≥A/3★）`;
    if (this.gachaInfoLabel) this.gachaInfoLabel.string = info;

    // 单抽/十连：券不足该档位 → 变灰（点了没反应·见 onGachaDraw 守门）。
    const avail = Math.floor(this.session?.resources.supplyTicket ?? 0);
    const grey = new Color(70, 75, 90, 255);
    this.paintBtn(this.gachaSingleBtn, avail >= 1 ? new Color(70, 130, 200, 255) : grey);
    this.paintBtn(this.gachaTenBtn, avail >= 10 ? new Color(80, 160, 120, 255) : grey);

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

  /** 抽卡（count=1 单抽 / 10 十连）：消耗补给券、出货落 squad/碎片、刷新。 */
  private onGachaDraw(count: number): void {
    if (!this.playerState || !this.session) return;
    const avail = Math.floor(this.session.resources.supplyTicket ?? 0);
    // 必须够该档位整额（十连要满 10·单抽要满 1）——券不足时按钮已变灰，这里再守一道（点了没反应）。
    if (avail < count) {
      if (this.gachaResultLabel) this.gachaResultLabel.string = count >= 10 ? '补给券不足 10 张，无法十连' : '补给券不足！点「赞助补给」看广告得券';
      return;
    }
    const now = Date.now();
    const rng = new S7AutoBattleRng(`gacha_${this.gachaPool}_${now}_${avail}`);
    const r = drawGachaMany(
      this.playerState.gacha, this.squad!, this.playerState.exclusiveShards, this.playerState.mailbox,
      DEFAULT_S7_GACHA_CONFIG, rng, this.gachaPool, count, avail, gachaDayIndex(now), now,
    );
    this.session.resources.supplyTicket = avail - r.ticketsSpent; // 按实际消耗扣券
    // 出货明细。
    if (this.gachaResultLabel) {
      const lines = r.outcomes.map((o) => this.gachaOutcomeText(o));
      const head = r.outcomes.length > 1 ? `本次${r.outcomes.length}连：\n` : '';
      this.gachaResultLabel.string = (head + lines.join('\n')) || '出货异常（配置空池？）';
    }
    this.persist();
    this.refresh();      // 顶部货币栏（券变了）
    this.refreshGacha(); // 池说明/保底/兑换
  }

  private gachaOutcomeText(o: S7GachaDrawOutcome): string {
    const name = this.unitName(o.unitKind, o.unitId);
    const tag = this.gachaTierTag(o); // 阶级/星级/专属（#1+#2）
    const head = o.isFloor ? '[保底]' : '';
    switch (o.result) {
      case 'new_body': return `${head}${name}[${tag}] 新到手!`;
      case 'floor_body': return `${head}${name}[${tag}] 新到手!`;
      case 'dup_shards': return `${head}${name}[${tag}] 重复→碎片+${o.shardsGained}`;
      case 'floor_shards': return `${head}${name}[${tag}] 已有→碎片+${o.shardsGained}`;
      default: return name;
    }
  }

  /** 出货标签：专属舰恒「A级·专属」(§10.1·Ron 拍板)；保底=A级/3★；普通=C级/1★。 */
  private gachaTierTag(o: S7GachaDrawOutcome): string {
    if (o.isExclusive) return 'A级·专属';
    if (o.unitKind === 'pilot') return o.isFloor ? '3★' : '1★';
    return o.isFloor ? 'A级' : 'C级'; // 星舰阶级
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
    this.persist();
    this.refreshGacha();
  }

  /** 赞助补给：看广告（mock）得补给券。首发无每日上限（数值/上限留第二块）。 */
  private onGachaSponsorAd(): void {
    if (!this.adGateway || !this.session) return;
    const GRANT = 10; // v0.1 占位：每次赞助补给得 10 券（上限/数值第二块）
    this.adGateway.show('sponsor_supply').then((res) => {
      if (!res.ok) { if (this.gachaResultLabel) this.gachaResultLabel.string = '广告没看完，没得到补给券'; return; }
      this.session!.resources.supplyTicket = Math.floor(this.session!.resources.supplyTicket ?? 0) + GRANT;
      if (this.gachaResultLabel) this.gachaResultLabel.string = `赞助补给 +${GRANT} 补给券！`;
      this.persist();
      this.refresh();
      this.refreshGacha();
    }).catch(() => { if (this.gachaResultLabel) this.gachaResultLabel.string = '广告加载失败'; });
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

    this.addBtn(panel, '开始打捞 (耗1信标)', 420, 88, new Color(70, 160, 130, 255), 0, topY - 410, () => this.onSalvageStart(), 30);

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
    const band = getS7UsableBand();
    let y = band.usableTopY - 540;
    const now = Date.now();
    if (this.playerState.salvage.missions.length === 0) {
      this.mkPanelLabel(this.salvageListNode, '（暂无打捞·选档开始）', 24, new Color(150, 160, 175), 0, y);
    }
    for (const m of this.playerState.salvage.missions) {
      const tierName = this.SALVAGE_TIERS.find((t) => t.tier === m.tier)?.name ?? m.tier;
      const done = isSalvageDone(m, now);
      const remain = salvageRemainingMs(m, now);
      const txt = done ? `${tierName}·${m.hours}h ✅可收菜` : `${tierName}·${m.hours}h ⏳${this.fmtRemain(remain)}`;
      this.mkPanelLabel(this.salvageListNode, txt, 26, done ? new Color(150, 235, 170) : new Color(220, 225, 235), -this.viewW * 0.20, y);
      const mid = m.id;
      if (done) {
        this.addBtn(this.salvageListNode, '收菜', 150, 64, new Color(70, 160, 110, 255), this.viewW * 0.30, y, () => this.onSalvageCollect(mid), 28);
      } else {
        this.addBtn(this.salvageListNode, '看广告加速', 230, 64, new Color(200, 130, 70, 255), this.viewW * 0.26, y, () => this.onSalvageSpeedup(mid), 26);
        this.addBtn(this.salvageListNode, '秒成', 110, 64, new Color(110, 90, 140, 255), this.viewW * 0.44, y, () => this.devFinishSalvage(mid), 24); // DEV-TEMP
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
    const res = collectSalvage(this.playerState.salvage, DEFAULT_S7_SALVAGE_CONFIG, missionId, Date.now(), new S7AutoBattleRng(`salvage_${missionId}_${Date.now()}`));
    if (!res.ok) { if (this.salvageResultLabel) this.salvageResultLabel.string = res.reason === 'not_done' ? '还没打捞完' : '任务不存在'; return; }
    const texts = res.rewards.map((rw) => this.applySalvageReward(rw));
    if (this.salvageResultLabel) this.salvageResultLabel.string = `带回：${texts.filter(Boolean).join('、')}`;
    this.persist();
    this.refresh();
    this.refreshSalvage();
  }

  private onSalvageSpeedup(missionId: string): void {
    if (!this.adGateway || !this.playerState) return;
    const lv = this.buildings ? getBuildingLevel(this.buildings, 'bld_salvage_port') : 0;
    this.adGateway.show('salvage_speedup').then((ad) => {
      if (!ad.ok) { if (this.salvageResultLabel) this.salvageResultLabel.string = '广告没看完，未加速'; return; }
      const sp = salvageAdSpeedup(this.playerState!.salvage, DEFAULT_S7_SALVAGE_CONFIG, missionId, lv, Date.now());
      if (this.salvageResultLabel) {
        this.salvageResultLabel.string = sp.ok ? `加速成功（今日 ${sp.usedToday}/${sp.dailyLimit}）`
          : sp.reason === 'daily_limit' ? '今日加速次数用尽' : sp.reason === 'already_done' ? '已可收菜' : '任务不存在';
      }
      this.persist();
      this.refreshSalvage();
    }).catch(() => { if (this.salvageResultLabel) this.salvageResultLabel.string = '广告加载失败'; });
  }

  /** DEV-TEMP：秒成（把任务结束时刻设为现在）便于灰盒验证收菜（真机不可能等2-24h）。正式版删。 */
  private devFinishSalvage(missionId: string): void {
    if (!this.playerState) return;
    const m = this.playerState.salvage.missions.find((x) => x.id === missionId);
    if (m) { m.endTime = Date.now(); this.persist(); this.refreshSalvage(); }
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
      case 'ship_body': {
        if (this.squad && !this.squad.ownedShips.includes(rw.shipId)) {
          this.squad.ownedShips.push(rw.shipId);
          return `${this.unitName('ship', rw.shipId)}[C级]`;
        }
        addExclusiveShards(this.playerState.exclusiveShards, rw.shipId, 15); // 已拥有→折专属碎片
        return `${this.unitName('ship', rw.shipId)}碎片×15`;
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

    // 刷新行（去付费·仅免费 + 广告）。
    this.addBtn(panel, '免费刷新', 230, 70, new Color(80, 130, 90, 255), -W * 0.20, topY - 110, () => this.onMerchantRefresh('free'), 28);
    this.addBtn(panel, '广告刷新', 230, 70, new Color(180, 110, 70, 255), W * 0.20, topY - 110, () => this.onMerchantRefresh('ad'), 28);

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
    if (!this.merchantNode || !this.playerState || !this.session) return;
    // 进店先按当前日刷新货架（跨天自动重铺 + 清购买量/计数）。
    refreshMerchantToCycle(this.playerState.merchant, DEFAULT_S7_MERCHANT_CONFIG, this.merchantLevel(), new S7AutoBattleRng(`mc_${Date.now()}`), Date.now());
    this.persist();
    this.merchantNode.active = true;
    if (this.merchantResultLabel) this.merchantResultLabel.string = '逛逛·买卖换星贝';
    this.refreshMerchant();
  }
  private closeMerchant(): void { if (this.merchantNode) this.merchantNode.active = false; }

  /** 刷新商人界面：星贝/刷新次数 + 重建货架列表（名/价/剩余 + 买）+ 重建回收区（随等级解锁）。 */
  private refreshMerchant(): void {
    if (!this.playerState || !this.session || !this.merchantListNode) return;
    const m = this.playerState.merchant;
    const lv = this.merchantLevel();
    if (this.merchantStarLabel) {
      this.merchantStarLabel.string = `星贝 ${Math.floor(this.session.resources.starCargo ?? 0)}　商人Lv.${lv}　免费刷新次数剩余${m.freeRefreshRemaining}　广告刷新次数剩余${m.adRefreshRemaining}`;
    }
    this.merchantListNode.removeAllChildren();
    let y = getS7UsableBand().usableTopY - 200;
    for (const offer of m.offers) {
      const remain = offerRemaining(m, offer);
      const nameStr = this.shopItemName(offer.item);
      const tag = offer.rare ? '★稀有 ' : '';
      this.mkPanelLabel(this.merchantListNode, `${tag}${nameStr}  ${offer.price}星贝  (剩${remain}/${offer.purchaseLimit})`, 24, remain > 0 ? new Color(225, 220, 200) : new Color(140, 140, 140), -this.viewW * 0.16, y);
      const oid = offer.offerId;
      const canBuy = remain > 0 && Math.floor(this.session.resources.starCargo ?? 0) >= offer.price;
      this.addBtn(this.merchantListNode, '买', 110, 56, canBuy ? new Color(70, 150, 110, 255) : new Color(70, 75, 90, 255), this.viewW * 0.38, y, () => this.onMerchantBuy(oid), 26);
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
        this.merchantResultLabel.string = r.ok ? `已刷新一批新货（${mode === 'free' ? '免费' : '广告'}·剩余${r.remaining}）` : '刷新次数用尽';
      }
      this.persist();
      this.refreshMerchant();
    };
    if (mode === 'ad') {
      if (!this.adGateway) return;
      this.adGateway.show('merchant_refresh').then((ad) => {
        if (!ad.ok) { if (this.merchantResultLabel) this.merchantResultLabel.string = '广告没看完，未刷新'; return; }
        doRefresh();
      }).catch(() => { if (this.merchantResultLabel) this.merchantResultLabel.string = '广告加载失败'; });
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
    const r = recycleBeacon(this.session.resources as Record<string, number>, DEFAULT_S7_MERCHANT_CONFIG, tier, 1);
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
    // 统一：左关闭 · 右升级（与战斗结果弹窗等一致：正向操作在右）。
    this.addBtn(panel, '关闭', 200, 84, new Color(110, 90, 150, 255), -W * 0.17, -ch * 0.34, () => this.closeBuildingUpgrade(), 30);
    this.buUpBtn = this.addBtn(panel, '升级', 240, 84, new Color(80, 160, 110, 255), W * 0.17, -ch * 0.34, () => this.onBuildingUpgradeConfirm(), 32).node.parent;
  }

  private openBuildingUpgrade(buildingId: string): void {
    if (!this.buildingUpgradeNode) return;
    this.buildingUpgradeTarget = buildingId;
    this.buildingUpgradeNode.active = true;
    this.refreshBuildingUpgrade();
  }
  private closeBuildingUpgrade(): void { if (this.buildingUpgradeNode) this.buildingUpgradeNode.active = false; }

  /** 刷新升级弹框内容：等级 + 当前→下一级效果 + 花费星矿(工人折后)；满级/买不起→按钮灰。 */
  private refreshBuildingUpgrade(): void {
    if (!this.buildings || !this.session || !this.population) return;
    const id = this.buildingUpgradeTarget;
    const v = buildBuildingUpgradeView([id], this.buildings, this.session.resources, this.population)[0];
    if (this.buUpTitleLabel) this.buUpTitleLabel.string = S7_BUILDING_NAMES[id] ?? id;
    const greyBtn = () => this.paintBtn(this.buUpBtn, new Color(70, 75, 90, 255), 240, 84);
    if (!this.buUpInfoLabel) return;
    if (v.atMax) {
      this.buUpInfoLabel.string = `已满级 Lv.${v.level}\n效果：${this.effectSummary(id, v.level)}`;
      greyBtn();
    } else {
      this.buUpInfoLabel.string = `Lv.${v.level} → Lv.${v.level + 1}\n现：${this.effectSummary(id, v.level)}\n升后：${this.effectSummary(id, v.level + 1)}\n花费：${v.discountedCost} 星矿`;
      this.paintBtn(this.buUpBtn, v.canAfford ? new Color(80, 160, 110, 255) : new Color(70, 75, 90, 255), 240, 84);
    }
  }

  private onBuildingUpgradeConfirm(): void {
    if (!this.buildings || !this.session || !this.population) return;
    const id = this.buildingUpgradeTarget;
    const r = upgradeBuildingWithDiscount(this.buildings, this.session.resources, this.population, id);
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
    const dh = H * 0.32;
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

    const mkB = (w: number, h: number, c: Color, x: number, y: number, tap: () => void): Label => {
      const n = new Node('rb'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = c; bg.roundRect(-w / 2, -h / 2, w, h, 14); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 36; l.lineHeight = 44; l.color = new Color(255, 255, 255); l.string = '';
      n.on(Node.EventType.TOUCH_END, tap, this);
      return l;
    };
    // 三键：选择关卡(左) / 返回星港(中) / 下一关·再次挑战(右)。
    const lvlLbl = mkB(220, 92, new Color(70, 130, 180, 255), -W * 0.30, -dh * 0.30, () => this.onResultGoLevelSelect());
    lvlLbl.string = '选择关卡';
    const homeLbl = mkB(220, 92, new Color(120, 90, 160, 255), 0, -dh * 0.30, () => this.onResultGoHome());
    homeLbl.string = '返回星港';
    this.resultRightLabel = mkB(220, 92, new Color(225, 150, 45, 255), W * 0.30, -dh * 0.30, () => this.onResultGoPrebattle());
  }

  /** 弹结果窗（背景保留战斗画面：不隐藏 stage、不切场景）。 */
  private openResultPopup(won: boolean): void {
    if (!this.resultPopupNode) return;
    if (this.resultTitleLabel) {
      this.resultTitleLabel.string = won ? '★ 战斗胜利 ★' : '战斗失败';
      this.resultTitleLabel.color = won ? new Color(150, 235, 160) : new Color(255, 150, 150);
    }
    if (this.resultMsgLabel && this.pendingResult) this.resultMsgLabel.string = this.pendingResult.text;
    if (this.resultRightLabel) this.resultRightLabel.string = won ? '下一关 ▶' : '再次挑战';
    this.resultPopupNode.active = true;
  }

  /** 收起就地战斗画面 + 结果窗（玩家选完才切场景）：复位备战 UI、隐藏备战面板、回主界面状态。 */
  private dismissBattleScene(): void {
    if (this.resultPopupNode) this.resultPopupNode.active = false;
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = false;
    if (this.prebattleUiNode) this.prebattleUiNode.active = true; // 复位（下次进备战正常显示）
    if (this.prebattleNode) this.prebattleNode.active = false;
    if (this.pendingResult) this.setResult(this.pendingResult.text, this.pendingResult.color);
    this.refresh();
  }
  /** 结果窗·返回星港：收战斗画面 → 回基地主界面。 */
  private onResultGoHome(): void {
    this.dismissBattleScene();
  }
  /** 结果窗·下一关/再次挑战：收战斗画面 → 去当前节点战前备战（胜后当前已推进=下一关；败后当前不变=重打）。 */
  private onResultGoPrebattle(): void {
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
    const mkB = (t: string, w: number, h: number, c: Color, x: number, y: number, tap: () => void): void => {
      const n = new Node('lsb'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = c; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 32; l.lineHeight = 40; l.color = new Color(255, 255, 255); l.string = t;
      n.on(Node.EventType.TOUCH_END, tap, this);
    };

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
      mkB(nodeId, bw, bh, new Color(60, 110, 170, 255), x, y, () => this.onPickLevel(nodeId));
    });
    mkB('关闭', 200, 64, new Color(120, 90, 160, 255), 0, band.usableBottomY + 50, () => this.closeLevelSelect());
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
    const mkBtn = (text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void): void => {
      const n = new Node('pbBtn'); n.layer = this.node.layer; ui.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 12); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 34; l.lineHeight = 42; l.color = new Color(255, 255, 255); l.string = text;
      n.on(Node.EventType.TOUCH_END, onTap, this);
    };

    // 标题 + 信息行（节点/战力/敌情概要）。
    mk('★ 战前备战 ★', 52, new Color(255, 230, 120), 0, band.usableTopY - 42);
    this.prebattleInfoLabel = mk('', 30, new Color(210, 225, 250), 0, band.usableTopY - 100);

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
      }
    }

    // 底部三键：选择关卡(左) / 返回星港(中·回基地) / 开始战斗(右)。
    mkBtn('选择关卡', 230, 88, new Color(70, 130, 180, 255), -W * 0.32, botY + 58, () => this.openLevelSelect());
    mkBtn('返回星港', 230, 88, new Color(120, 90, 160, 255), 0, botY + 58, () => this.closePrebattle());
    mkBtn('🚀 开始战斗', 330, 112, new Color(225, 150, 45, 255), W * 0.30, botY + 58, () => this.onConfirmSortie());

    // 备战内嵌战斗的「跳过」键（挂面板·不在 ui 容器内，开战时单独显示）。
    const skip = new Node('pbSkip'); skip.layer = this.node.layer; panel.addChild(skip); skip.setPosition(0, botY + 58, 0);
    const sut = skip.addComponent(UITransform); sut.setContentSize(220, 72);
    const sbg = skip.addComponent(Graphics); sbg.fillColor = new Color(95, 100, 120, 255); sbg.roundRect(-110, -36, 220, 72, 12); sbg.fill();
    const sln = new Node('t'); sln.layer = this.node.layer; skip.addChild(sln);
    const sl = sln.addComponent(Label); sl.fontSize = 32; sl.lineHeight = 40; sl.color = new Color(255, 255, 255); sl.string = '跳过 ▶▶';
    skip.on(Node.EventType.TOUCH_END, () => this.onSkip(), this);
    skip.active = false;
    this.prebattleSkipBtn = skip;
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
    // #2 出战前校验编队（v1.0 §4.4 空船不能上阵）：有船缺驾驶员/没上阵 → 拦下并提示，不开打。
    // 带插件库存校验(与会话内部一致)，built.lineup 即含插件——下面附上全队加成后直接喂战斗。
    let lineup: ReturnType<typeof buildSquadLineup> | null = null;
    if (this.squad) {
      const built = buildSquadLineup(this.squad, this.playerState?.unitLevels, this.pluginInventory ?? undefined);
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
    // J：把建筑全队加成（研究塔+星核展厅）附到每艘上阵舰，喂进战斗。
    const bonus = this.teamBonusBlocks();
    const battleLineup = (lineup && lineup.ok)
      ? (bonus.length > 0 ? lineup.lineup.map((u) => ({ ...u, extraBlocks: [...(u.extraBlocks ?? []), ...bonus] })) : lineup.lineup)
      : undefined;
    let outcome: S7PlayNodeOutcome;
    try {
      outcome = this.session.playCurrentNode(S7_DEMO_RUN_SEED, battleLineup);
    } catch (err) {
      // 无遭遇节点（你已通到内容缺口·如 n008+）：不静默弹回基地——留在备战界面给明确提示，引导点「选择关卡」挑可玩关。
      console.warn('[S7DemoController] 该节点暂无战斗遭遇', nodeId, err);
      if (this.prebattleInfoLabel) {
        this.prebattleInfoLabel.string = `⚠ ${nodeId} 暂无遭遇（原型内容到此为止）\n点左下「选择关卡」挑一个可玩关`;
        this.prebattleInfoLabel.color = new Color(240, 200, 120);
      }
      return; // 不关备战层、不落盘
    }
    // 有遭遇：落盘 → 就地播战斗演出（不关备战层·隐藏UI在当前界面演·结果按住，播完再亮 + 据胜负路由）。
    this.persist();
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

  /** 打开战前备战层（回放期间禁用）：刷新内容后显示。 */
  private openPrebattle(): void {
    if (this.playing || !this.prebattleNode) return;
    this.prebattleSelSlot = null;
    this.prebattleSelShip = null;
    this.refreshPrebattle();
    this.prebattleNode.active = true;
  }

  private closePrebattle(): void {
    if (this.prebattleNode) this.prebattleNode.active = false;
  }

  /** 刷新战前备战：信息行(节点/战力/敌情概要) + 敌情预览色块 + 9 格编队 + 选中船详情。 */
  private refreshPrebattle(): void {
    if (!this.session || !this.squad || !this.prebattleGfx || !this.prebattleInfoLabel || !this.runtime) return;
    const r = buildPrebattleView(this.runtime, this.session.progress, this.squad, this.playerState?.unitLevels, this.pluginInventory ?? undefined);
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
    } else {
      const v = r.view;
      const stage = v.stageType === 'boss' ? 'Boss' : v.stageType === 'elite' ? '精英' : '普通';
      const enemyBrief = v.hasEncounter ? `敌${v.enemyCount}${v.hasBoss ? '·含Boss' : ''}` : '暂无遭遇';
      const trend = v.playerPower >= v.recommendedPower ? '↑' : '↓';
      this.prebattleInfoLabel.string =
        `节点 ${v.nodeId}（${stage}）   敌情预览：${enemyBrief}\n我方战力 ${v.playerPower} ${trend}   VS   推荐战力 ${v.recommendedPower}`;
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
        if (lbl) lbl.string = slot ? `${slot.shipId}\n${this.pilotOf(slot.shipId) ?? '缺员'}` : '+';
      }
    }
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
    if (isShipDeployed(this.squad, ship)) {
      const cell = this.squad.formation.find((s) => s.shipId === ship)?.slotRef;
      if (cell) clearSlot(this.squad, cell); // 下场（驾驶员/装备跟船记忆保留）
    } else {
      if (!this.prebattleSelSlot) {
        this.setPrebattleInfo('⚠ 先选一个格子，才能让这艘船上场');
        return;
      }
      assignSlot(this.squad, this.prebattleSelSlot, ship, null); // 上场（保留本舰已记忆的驾驶员）
    }
    this.persist();
    this.refreshBoarding();
    this.refreshPrebattle();
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

    // 左侧拥有星舰列表容器（刷新重建）。
    const listN = new Node('bList'); listN.layer = this.node.layer; panel.addChild(listN); listN.setPosition(0, 0, 0);
    this.boardingShipListNode = listN;

    // 右侧详情 + 操作（装配/上下场）。
    const dN = new Node('bd'); dN.layer = this.node.layer; panel.addChild(dN); dN.setPosition(W * 0.24, sheetTop - 120, 0);
    this.boardingDetailLabel = dN.addComponent(Label); this.boardingDetailLabel.fontSize = 24; this.boardingDetailLabel.lineHeight = 32; this.boardingDetailLabel.color = new Color(220, 230, 250);
    const actions = new Node('bActions'); actions.layer = this.node.layer; panel.addChild(actions); actions.setPosition(0, 0, 0);
    this.boardingActionsNode = actions;
    this.addBtn(actions, '装配', 200, 80, new Color(70, 130, 110, 255), W * 0.16, sheetBot + H * 0.13, () => this.openLoadout(), 30);
    this.boardingBoardBtnLabel = this.addBtn(actions, '上场', 200, 80, new Color(90, 110, 160, 255), W * 0.32, sheetBot + H * 0.13, () => this.onToggleBoard(), 30);

    // 底部中间「返回」。
    this.addBtn(panel, '返回', 240, 84, new Color(120, 90, 160, 255), 0, sheetBot + 56, () => this.closeBoarding(), 32);
  }

  private openBoarding(): void {
    if (this.playing || !this.boardingNode) return;
    this.refreshBoarding();
    this.boardingNode.active = true;
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
    for (const shipId of ships) {
      const deployed = isShipDeployed(this.squad, shipId);
      const sel = this.prebattleSelShip === shipId;
      const label = `${shipId}（战力${this.shipPower(shipId)}）${deployed ? '·已上场' : ''}`;
      const col = sel ? new Color(70, 130, 95, 255) : deployed ? new Color(45, 95, 75, 255) : new Color(55, 95, 150, 255);
      this.addBtn(list, label, bw, bh, col, -W * 0.24, y, () => this.onBoardingPickShip(shipId), 24);
      y -= bh + 10;
    }
    // 右侧详情 + 操作。
    const ship = this.prebattleSelShip;
    if (this.boardingDetailLabel) {
      if (ship) {
        const deployed = isShipDeployed(this.squad, ship);
        const where = deployed ? `在场 ${this.squad.formation.find((s) => s.shipId === ship)?.slotRef}` : '未上场';
        this.boardingDetailLabel.string = `星舰 ${ship}（${where}）\n战力 ${this.shipPower(ship)}\n驾驶员 ${this.pilotOf(ship) ?? '缺员'}\n${this.loadoutSummaryText(ship)}`;
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
    return shipPowerOf(this.growthBands, this.squad, shipId, this.playerState?.unitLevels, this.pluginInventory ?? undefined);
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
    back.on(Node.EventType.TOUCH_END, onClose, this);
    const card = new Node('cardAbsorb'); card.layer = this.node.layer; panel.addChild(card); card.setPosition(cardX, cardY, 0);
    const cu = card.addComponent(UITransform); cu.setContentSize(cardW, cardH);
    card.on(Node.EventType.TOUCH_END, () => {}, this);
  }

  /** 通用按钮：父节点 + 文字 + 尺寸/色/位置 + 回调，返回 Label（便于动态改字）。 */
  private addBtn(parent: Node, text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void, fontSize = 28): Label {
    const n = new Node('btn'); n.layer = this.node.layer; parent.addChild(n); n.setPosition(x, y, 0);
    const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
    const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
    const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
    const l = ln.addComponent(Label); l.fontSize = fontSize; l.lineHeight = Math.round(fontSize * 1.25); l.color = new Color(255, 255, 255); l.string = text;
    n.on(Node.EventType.TOUCH_END, onTap, this);
    return l;
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
    this.addBtn(panel, '返回', 200, 84, new Color(120, 90, 160, 255), 0, band.usableBottomY + 56, () => this.closeLoadout(), 30);
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
    this.addBtn(panel, '取消', 240, 84, new Color(110, 90, 150, 255), -W * 0.20, -H * 0.11, () => this.closeEquipDetail(), 32);
    this.equipDetailActionLabel = this.addBtn(panel, '装备', 240, 84, new Color(70, 140, 110, 255), W * 0.20, -H * 0.11, () => this.onEquipDetailAction(), 32);
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
    this.addBtn(panel, '取消', 240, 84, new Color(110, 90, 150, 255), -W * 0.20, -H * 0.09, () => this.closeEquipConfirm(), 32);
    this.addBtn(panel, '确认', 240, 84, new Color(200, 140, 60, 255), W * 0.20, -H * 0.09, () => this.onEquipConfirmMove(), 32);
  }

  /** 开装配面板：须先选中一艘星舰（在场或不在场均可，装配按船记忆）。 */
  private openLoadout(): void {
    if (this.playing || !this.loadoutNode || !this.squad) return;
    if (!this.prebattleSelShip) { this.setPrebattleInfo('⚠ 先在下方点选一艘星舰，再点「装配」'); return; }
    this.setLoadoutMsg('点任一装备 → 弹详情 → 装/卸；标记：★本舰 / ▶在别船 / 未装', new Color(190, 205, 230));
    this.refreshLoadout();
    this.loadoutNode.active = true;
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
        this.addBtn(list, `${it.top}\n${marker}`, w, h, col, x, y - r * (h + 16), () => this.openEquipDetail(it.ref), 26);
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
    header('星核（现仅过载核心有效果）');
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
  private doEquip(ref: S7EquipRef, shipId: string) {
    if (!this.squad) return { ok: false as const, code: 'not_owned_ship' as const };
    if (ref.kind === 'pilot') return equipPilot(this.squad, shipId, ref.id);
    if (ref.kind === 'core') return equipCore(this.squad, shipId, ref.id);
    if (!this.pluginInventory) return { ok: false as const, code: 'not_owned_plugin' as const };
    return equipPlugin(this.squad, this.pluginInventory, shipId, ref.id, this.pluginSlotOf);
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
    // 驾驶员
    if (!sq.shipLoadouts[ship]?.pilotId) {
      const free = sq.ownedPilots.find((p) => !findPilotShip(sq, p));
      if (free) equipPilot(sq, ship, free);
    }
    // 星核
    if (!sq.shipLoadouts[ship]?.coreId) {
      const free = Object.keys(sq.ownedCores).find((cid) => !findCoreShip(sq, cid));
      if (free) equipCore(sq, ship, free);
    }
    // 插件三槽：空槽填该槽空闲插件里品质(战力)最高的。
    if (this.pluginInventory) {
      for (const tag of ['weapon', 'skill', 'tactical'] as S7PluginSlot[]) {
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
    this.equipDetailNode.active = true;
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
    const cleared: string[] = [];
    for (let i = 1; i < num; i += 1) cleared.push(`n${String(i).padStart(3, '0')}`);
    this.session.progress = { currentNodeId: nodeId, clearedNodeIds: cleared };
    this.persist();
    this.closeLevelSelect();
    this.prebattleSelSlot = null;
    this.refreshPrebattle();
    this.refresh();
  }

  /** 组装"上一战结果"文案（胜/重复挑战/败），回放结束后显示。 */
  private composeResultText(nodeId: string, outcome: S7PlayNodeOutcome): { text: string; color: Color } {
    const players = outcome.battle.result.finalState.players;
    const totMax = players.reduce((s, u) => s + u.maxHp, 0);
    const totHp = players.reduce((s, u) => s + Math.max(0, u.hp), 0);
    const hpTag = `[全队残血 ${totMax > 0 ? Math.round((totHp / totMax) * 100) : 0}%]`;
    if (outcome.won && outcome.settlement && outcome.settlement.ok) {
      const grants = outcome.settlement.grants.map((g) => `+${g.amount}${this.zhRes(g.resourceId)}`).join(' ');
      const tail = outcome.settlement.finished ? '（已通关最终节点）' : `→ 推进到 ${outcome.settlement.nextNodeId}`;
      return { text: `${nodeId} 胜！${hpTag} ${grants || '（无软货币）'} ${tail}`, color: new Color(160, 235, 160) };
    }
    if (outcome.won) {
      return { text: `${nodeId} 胜（重复挑战，不再发奖）${hpTag}`, color: new Color(220, 210, 140) };
    }
    return {
      text: `${nodeId} 败：${this.zhHint(outcome.battle.summary.hintCode)} ${hpTag}\n→ 先「升级旗舰」攒强了再来`,
      color: new Color(235, 150, 150),
    };
  }

  // ===== B2 回放驱动 =====

  /** 开播（就地·在备战界面演）：隐藏备战可交互 UI、亮「跳过」，从第 0 帧起逐帧推进（update 驱动）。 */
  private startPlayback(pb: S7BattlePlayback): void {
    if (!this.prebattleNode || !this.prebattleGfx) return;
    this.playback = pb;
    this.frameIdx = 0;
    this.stepClock = 0;
    // 总时长压到 ~2.8 秒内：每帧停留 = clamp(2.8/帧数, 0.03, 0.10)。
    this.stepSec = Math.max(0.03, Math.min(0.10, 2.8 / Math.max(1, pb.frames.length - 1)));
    this.computePositions(pb);
    this.playing = true;
    if (this.prebattleUiNode) this.prebattleUiNode.active = false; // 无关 UI 滑出 → 当前界面变战场
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = true;
    this.drawFrame(pb.frames[0]);
  }

  /** 每帧推进回放（cc 自动调用）。 */
  update(dt: number): void {
    if (!this.playing || !this.playback) return;
    this.stepClock += dt;
    const frames = this.playback.frames;
    while (this.stepClock >= this.stepSec && this.frameIdx < frames.length - 1) {
      this.frameIdx += 1;
      this.stepClock -= this.stepSec;
    }
    this.drawFrame(frames[this.frameIdx]);
    if (this.frameIdx >= frames.length - 1) this.finishPlayback();
  }

  /** 点「跳过」：直接跳到最后一帧并收尾。 */
  private onSkip(): void {
    if (!this.playing || !this.playback) return;
    this.frameIdx = this.playback.frames.length - 1;
    this.drawFrame(this.playback.frames[this.frameIdx]);
    this.finishPlayback();
  }

  /** 收尾：停播、隐藏「跳过」、弹结果窗（背景保留刚结束的就地战斗画面）。 */
  private finishPlayback(): void {
    this.playing = false;
    if (this.prebattleSkipBtn) this.prebattleSkipBtn.active = false;
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
      const p = this.posById.get(u.unitId);
      if (!p) continue;
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

  /** 点「升级旗舰」：花星矿+合金把旗舰升 1 级（升级服务）→ 出战更强 → 刷新 + 落盘。 */
  private onUpgradeFlagship(): void {
    if (!this.session || !this.playerState || this.playing) return;
    const r = upgradeShipOneLevel(
      this.playerState.unitLevels,
      this.session.resources,
      this.upgradeCostRows,
      S7_DEMO_FLAGSHIP_ID,
    );
    if (r.ok) {
      this.setResult(
        `旗舰升到 Lv.${r.toLevel}！花 ${r.spent.starOre}星矿+${r.spent.hullAlloy}合金 → 出战更强`,
        new Color(150, 235, 180),
      );
    } else if (r.reason === 'max_level') {
      this.setResult('旗舰已满级（Lv.40）', new Color(220, 210, 140));
    } else if (r.reason === 'insufficient' && r.needed) {
      this.setResult(`资源不够：升级需 ${r.needed.starOre}星矿+${r.needed.hullAlloy}合金（先出战攒资源）`, new Color(235, 150, 150));
    } else {
      this.setResult('暂无该等级的升级成本配置', new Color(200, 200, 200));
    }
    this.persist();
    this.refresh();
  }

  /** 重置 S7 存档到初始（演示反复验证用）：回 n001、清零资源与单位等级、落盘。 */
  private onReset(): void {
    if (!this.session || !this.playerState || this.playing) return;
    for (const key of Object.keys(this.session.resources)) {
      this.session.resources[key] = 0;
    }
    this.session.progress = createDefaultS7MainlineProgress();
    this.playerState.unitLevels.shipLevels = {};
    this.playerState.unitLevels.pilotLevels = {};
    // C：建筑/人口也归零（重新解锁默认建筑到 1 级），清未领离线。
    this.playerState.buildings = createDefaultS7BuildingState();
    this.playerState.population = createDefaultS7Population();
    this.buildings = this.playerState.buildings;
    this.population = this.playerState.population;
    this.ensureDefaultBuildingsUnlocked();
    this.offlinePending = null;
    // C/D/E：抽卡/打捞/商人状态也归零（这几块后加·原 reset 漏了→刷新次数/保底/任务会残留）。
    this.playerState.gacha = createDefaultS7GachaState();
    this.playerState.salvage = createDefaultS7Salvage();
    this.playerState.merchant = createDefaultS7Merchant();
    // B 块：插件库存也就地清空（会话持有引用，不能整体替换）→ ensureDemoSquadSeeded 重发时实例号从 pi1 起复现。
    if (this.pluginInventory) {
      this.pluginInventory.plugins = [];
      this.pluginInventory.nextInstanceSeq = 1;
      this.pluginInventory.nextActionSeq = 0;
    }
    // A-step2：阵容就地清空+重新发货（会话持有 squad 引用，不能整体替换→必须原地改）。
    if (this.squad) {
      this.squad.ownedShips = [];
      this.squad.ownedPilots = [];
      this.squad.ownedCores = {};
      this.squad.formation = [];
      this.squad.shipLoadouts = {}; // B 块：装配按船记忆，重置一并清
      this.ensureDemoSquadSeeded();
    }
    this.prebattleSelSlot = null;
    this.closeLoadout();
    this.closePrebattle();
    this.closeBase();
    this.setResult('已重置：回到 n001、资源清零、等级归 1、建筑回 1 级', new Color(180, 200, 230));
    this.persist();
    this.refresh();
  }

  // ===== C 离线收益领取 =====

  /** 点「领取离线收益」：把离线进账入账 → 落盘(刷新 lastOnlineTime 关闭本次窗口) → 刷新。 */
  private onClaimOffline(): void {
    if (!this.session || this.playing || !this.offlinePending) return;
    const cap = this.offlinePending.overflowed ? '（已达存储上限·升居住舱可扩）' : '';
    applyOfflineGains(this.session.resources, this.offlinePending.gains);
    const text = this.offlineGainsText(this.offlinePending.gains);
    this.offlinePending = null;
    this.setResult(`领取离线收益 ${text}${cap}`, new Color(235, 215, 130));
    this.persist();
    this.refresh();
  }

  /** 离线进账三币种的"+X名"串（仅正向）。 */
  private offlineGainsText(g: Record<string, number>): string {
    return (['starOre', 'hullAlloy', 'pilotToken'])
      .filter((k) => (g[k] ?? 0) > 0)
      .map((k) => `+${g[k]}${this.zhRes(k)}`)
      .join(' ') || '（无）';
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
    if (!this.session || !this.buildings || !this.population || this.playing) return;
    const r = upgradeBuildingWithDiscount(this.buildings, this.session.resources, this.population, buildingId);
    const name = S7_BUILDING_NAMES[buildingId] ?? buildingId;
    if (r.ok) {
      this.setResult(`${name} 升到 Lv.${r.newLevel}！花 ${r.starOreSpent}星矿`, new Color(150, 235, 180));
    } else if (r.code === 'insufficient_star_ore') {
      this.setResult(`${name} 星矿不够（先出战/领离线攒矿）`, new Color(235, 150, 150));
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
    if (!this.buildings || !this.session || !this.population) return;
    const rows = buildBuildingUpgradeView(S7_DEMO_DEFAULT_BUILDINGS, this.buildings, this.session.resources, this.population);
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
      case 'bld_habitat': return `离线${Math.round(offlineStorageHours(level))}h·产率+${Math.round(offlineRateBonusPct(level))}%`;
      case 'bld_dock': return `旗舰等级上限${shipLevelCap(level)}`;
      case 'bld_pilot_training_bay': return `驾驶员上限${driverLevelCap(level)}`;
      case 'bld_research_tower': return `全队血攻+${researchTeamBonusPct(level)}%`;
      case 'bld_rsv_core_gallery': return `每种星核收藏+${coreGalleryPerTypeBonusPct(level).toFixed(1)}%(×收集种数·封顶10%)`;
      case 'bld_salvage_port': return `打捞队${salvageTeamCount(level)}`;
      case 'bld_merchant_station': return `商店槽${merchantShopSlots(level)}·升级送1次免费刷新`;
      case 'bld_supply_station': return '抽卡出率(待接·J2)';
      default: return '';
    }
  }

  // ===== 刷新 / 落盘 =====

  private refresh(): void {
    if (!this.session || !this.statusLabel || !this.playerState) return;
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
    // C：有未领离线收益才显示金色「领取」按钮。
    if (this.offlineBtn) this.offlineBtn.active = this.offlinePending !== null;
    // J：hub 建筑入口显等级 + 可升↑（买得起且未满级亮提示）。
    if (this.hubBuildingTracks.length > 0 && this.buildings && this.population) {
      const views = buildBuildingUpgradeView(this.hubBuildingTracks.map((t) => t.id), this.buildings, r, this.population);
      const byId = new Map(views.map((v) => [v.buildingId, v]));
      for (const t of this.hubBuildingTracks) {
        const v = byId.get(t.id);
        if (!v) continue;
        t.label.string = v.atMax ? `Lv.${v.level} 满级` : v.canAfford ? `Lv.${v.level} 可升↑` : `Lv.${v.level}`;
        t.label.color = v.canAfford && !v.atMax ? new Color(140, 235, 160) : new Color(225, 235, 255, 200);
      }
    }
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
    };
    return map[resourceId] ?? resourceId;
  }
}
