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
import { _decorator, Component, Node, Label, Color, Graphics, UITransform } from 'cc';
import { SaveStorageAdapter } from '../../save/SaveStorageAdapter';
import {
  S7_CURRENT_SAVE_VERSION,
  S7SaveData,
  S7PlayerState,
  loadS7Save,
  persistS7Save,
} from '../../save/S7SaveService';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7UpgradeCostParam, S7BattleUnitStatParam, S7GrowthBandParam, S7BattleEncounterParam, S7PluginConfig, S7PluginSlot } from '../../config/s7/ConfigTypesS7';
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
import { S7BuildingState, isBuildingUnlocked, unlockBuilding, createDefaultS7BuildingState } from '../../core/s7/S7BuildingState';
import { S7PopulationState, createDefaultS7Population } from '../../core/s7/S7Population';
import {
  shipLevelCap, driverLevelCap, offlineStorageHours, offlineRateBonusPct,
  salvageTeamCount, researchTeamBonusPct, merchantShopSlots,
} from '../../core/s7/S7BuildingEffects';
import { getS7UsableBand } from '../S7UiLayout';
import {
  S7SquadState, grantShip, grantPilot, grantCore, assignSlot, clearSlot, buildSquadLineup,
  isShipDeployed, findPilotShip, findCoreShip, findPluginShip,
} from '../../core/s7/S7Squad';
import { buildPrebattleView, shipPowerOf, S7PrebattleView } from '../../core/s7/S7PrebattleView';
import { equipPlugin, unequipPlugin, equipCore, unequipCore, equipPilot, unequipPilot } from '../../core/s7/S7ShipLoadout';
import { coreBlocks } from '../../core/s7/S7CoreEffects';
import {
  S7PluginInventoryState, S7OwnedPlugin, addOwnedPlugin, findOwnedPlugin,
} from '../../core/s7/S7PluginInventory';

const { ccclass } = _decorator;

/** demo 默认解锁的 7 栋建筑（真实游戏靠主线/教程解锁；demo 开局直接开到 1 级，便于演示养成）。 */
const S7_DEMO_DEFAULT_BUILDINGS = [
  'bld_dock', 'bld_pilot_training_bay', 'bld_habitat', 'bld_supply_station',
  'bld_salvage_port', 'bld_merchant_station', 'bld_research_tower',
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

    // 顶部标题：G0 UI 地基——锚到安全区下沿（避开刘海/胶囊菜单按钮），不再用满屏比例硬摆。
    // 这是"所有 S7 界面顶部内容都锚安全区"的范例；A-step2 编队界面等照此摆。
    const topY = getS7UsableBand().usableTopY;
    this.makeLabel('《我的星舰小队》S7 演示', 42, new Color(255, 230, 120), 0, topY - 36);
    this.makeLabel('（色块原型 · 点出战推进主线）', 26, new Color(170, 180, 200), 0, topY - 86);

    // 状态行：星矿/合金/当前节点 + 旗舰等级。
    this.statusLabel = this.makeLabel('', 34, new Color(230, 240, 255), 0, H * 0.14);

    // 「出战」按钮（蓝色块）：A-step2 改为先进"战前备战界面"（编队/敌情/战力），再在那儿确认出战。
    this.makeButton('出战', 400, 120, new Color(60, 120, 220, 255), 0, -H * 0.02, () => this.openPrebattle());

    // 「升级旗舰」（绿）+「基地」（橙）并排：升旗舰=战力养成；基地=建筑养成（开建筑面板）。
    this.makeButton('升级旗舰', 310, 104, new Color(60, 170, 110, 255), -166, -H * 0.15, () => this.onUpgradeFlagship());
    this.makeButton('基地', 310, 104, new Color(200, 140, 60, 255), 166, -H * 0.15, () => this.openBase());

    // 「领取离线收益」按钮（金色·仅有未领收益时显示）：贴合"随用随停、回来有收获"。金额在结果行显示。
    this.offlineBtn = this.makeButton('领取离线收益', 500, 92, new Color(210, 170, 60, 255), 0, H * 0.215, () => this.onClaimOffline());
    this.offlineBtn.active = false;

    // 上一战 / 升级结果（多行）。
    this.resultLabel = this.makeLabel('点「出战」开始', 30, new Color(180, 230, 180), 0, -H * 0.27);

    // 「重置存档」小按钮（演示用：回到 n001、清零资源与等级，便于反复验证）。
    this.makeButton('重置存档', 220, 78, new Color(120, 70, 70, 255), 0, -H * 0.37, () => this.onReset());

    // 战斗演出改为"就地在备战界面演"（无独立叠加层）：演出 gfx = prebattleGfx，跳过键 = prebattleSkipBtn（见 buildPrebattlePanel）。
    this.buildBasePanel(W, H);
    this.buildPrebattlePanel(W, H);
    this.buildBoardingPanel(W, H);
    this.buildLoadoutPanel(W, H);
    this.buildLevelSelectPanel(W, H);
    this.buildResultPopup(W, H);
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
    panel.on(Node.EventType.TOUCH_END, () => this.onResultGoHome(), this); // 点窗外空白 = 返回星港
    panel.active = false;
    this.resultPopupNode = panel;
    // 对话框卡片吸收触摸（点卡片内不触发"返回"）。
    const card = new Node('rcard'); card.layer = this.node.layer; panel.addChild(card); card.setPosition(0, 0, 0);
    const cut = card.addComponent(UITransform); cut.setContentSize(dw, dh);
    card.on(Node.EventType.TOUCH_END, () => {}, this);

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
    panel.on(Node.EventType.TOUCH_END, () => this.closeLevelSelect(), this); // 点空白 = 关闭
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
        cn.on(Node.EventType.TOUCH_END, () => this.onSelectPrebattleSlot(slotRef), this);
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
    const baseUt = panel.addComponent(UITransform); baseUt.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => this.closeBase(), this); // 点卡片外空白 = 关闭
    panel.active = false;
    this.baseNode = panel;
    const baseCard = new Node('baseCard'); baseCard.layer = this.node.layer; panel.addChild(baseCard); baseCard.setPosition(0, 0, 0);
    const baseCardUt = baseCard.addComponent(UITransform); baseCardUt.setContentSize(W * 0.9, H * 0.64); baseCard.on(Node.EventType.TOUCH_END, () => {}, this);

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
    if (this.squad) {
      const built = buildSquadLineup(this.squad, this.playerState?.unitLevels);
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
    }
    const nodeId = this.session.currentNodeId;
    let outcome: S7PlayNodeOutcome;
    try {
      outcome = this.session.playCurrentNode(S7_DEMO_RUN_SEED);
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
    panel.on(Node.EventType.TOUCH_END, () => this.closeBoarding(), this); // 点 sheet 外空白 = 返回
    panel.active = false; this.boardingNode = panel;

    // sheet 区吸收触摸（点 sheet 内空白不返回）。
    const card = new Node('bCard'); card.layer = this.node.layer; panel.addChild(card); card.setPosition(0, (sheetTop + sheetBot) / 2, 0);
    const cut = card.addComponent(UITransform); cut.setContentSize(W * 0.94, sheetTop - sheetBot);
    card.on(Node.EventType.TOUCH_END, () => {}, this);

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
    // 排序：上阵的靠前 → 战力高靠前。
    const ships = this.squad.ownedShips.slice().sort((a, b) => {
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
    panel.on(Node.EventType.TOUCH_END, () => this.closeLoadout(), this); // 点空白 = 关闭(回上阵界面)
    panel.active = false; this.loadoutNode = panel;

    const titleN = new Node('loTitle'); titleN.layer = this.node.layer; panel.addChild(titleN); titleN.setPosition(0, band.usableTopY - 46, 0);
    this.loadoutTitleLabel = titleN.addComponent(Label); this.loadoutTitleLabel.fontSize = 42; this.loadoutTitleLabel.lineHeight = 50; this.loadoutTitleLabel.color = new Color(255, 230, 120);
    const msgN = new Node('loMsg'); msgN.layer = this.node.layer; panel.addChild(msgN); msgN.setPosition(0, band.usableTopY - 98, 0);
    this.loadoutMsgLabel = msgN.addComponent(Label); this.loadoutMsgLabel.fontSize = 24; this.loadoutMsgLabel.lineHeight = 30; this.loadoutMsgLabel.color = new Color(190, 205, 230);

    const listN = new Node('loList'); listN.layer = this.node.layer; panel.addChild(listN); listN.setPosition(0, 0, 0);
    this.loadoutListNode = listN;

    this.addBtn(panel, '关闭', 260, 84, new Color(120, 90, 160, 255), 0, band.usableBottomY + 56, () => this.closeLoadout(), 32);

    this.buildEquipDetailPopup(W, H);
    this.buildEquipConfirmPopup(W, H);
  }

  /** 装备详情弹窗（点装备弹出）：标题 + 信息 + 取消(左) + 主操作(右·装备/卸下)。 */
  private buildEquipDetailPopup(W: number, H: number): void {
    const panel = new Node('S7EquipDetail'); panel.layer = this.node.layer; this.node.addChild(panel); panel.setPosition(0, 0, 0);
    const ut = panel.addComponent(UITransform); ut.setContentSize(W, H);
    const g = panel.addComponent(Graphics); g.fillColor = new Color(6, 9, 18, 200); g.rect(-W / 2, -H / 2, W, H); g.fill(); // 半透明遮罩吞触摸
    g.fillColor = new Color(18, 24, 40, 255); g.roundRect(-W * 0.42, -H * 0.15, W * 0.84, H * 0.30, 16); g.fill();
    panel.on(Node.EventType.TOUCH_END, () => this.closeEquipDetail(), this); // 点卡片外空白 = 取消
    panel.active = false; this.equipDetailNode = panel;
    const cardN = new Node('card'); cardN.layer = this.node.layer; panel.addChild(cardN); cardN.setPosition(0, 0, 0);
    const cardUt = cardN.addComponent(UITransform); cardUt.setContentSize(W * 0.84, H * 0.30); cardN.on(Node.EventType.TOUCH_END, () => {}, this);
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
    panel.on(Node.EventType.TOUCH_END, () => this.closeEquipConfirm(), this); // 点卡片外空白 = 取消
    panel.active = false; this.equipConfirmNode = panel;
    const cardN = new Node('card'); cardN.layer = this.node.layer; panel.addChild(cardN); cardN.setPosition(0, 0, 0);
    const cardUt = cardN.addComponent(UITransform); cardUt.setContentSize(W * 0.84, H * 0.26); cardN.on(Node.EventType.TOUCH_END, () => {}, this);
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
    if (this.loadoutTitleLabel) this.loadoutTitleLabel.string = `装配 — ${ship}`;
    const list = this.loadoutListNode;
    list.removeAllChildren();
    const W = this.viewW;
    const band = getS7UsableBand();
    const w = W * 0.305, h = 72, gx = W * 0.32;
    let y = band.usableTopY - 150;

    const header = (txt: string, color = new Color(255, 220, 140)): void => {
      const n = new Node('h'); n.layer = this.node.layer; list.addChild(n); n.setPosition(-W * 0.40, y, 0);
      const l = n.addComponent(Label); l.fontSize = 26; l.lineHeight = 32; l.color = color; l.string = txt;
      y -= 40;
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
        this.addBtn(list, `${it.top}\n${marker}`, w, h, col, x, y - r * (h + 12), () => this.openEquipDetail(it.ref), 24);
      });
      y -= (Math.ceil(sorted.length / 3) || 1) * (h + 12) + 16;
    };

    // ① 驾驶员（暂无品质/等级 → 仅"已装备靠前"）
    header('驾驶员');
    placeItems(this.squad.ownedPilots.map((id) => ({ ref: { kind: 'pilot' as const, id }, top: id })));
    // ② 插件（按 武器/技能/战术 分；每类内 品质越高越靠前）
    header('插件（武器 / 技能 / 战术）');
    const plugins = this.pluginInventory ? this.pluginInventory.plugins : [];
    (['weapon', 'skill', 'tactical'] as S7PluginSlot[]).forEach((tag) => {
      const group = plugins.filter((p) => this.pluginSlotMap.get(p.pluginId) === tag);
      header(`· ${S7_SLOT_TAG_NAMES[tag]}`, new Color(170, 200, 235));
      if (group.length === 0) { y -= 8; return; }
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
      // 已在别船 → 二次确认弹窗
      const from = this.equipShipOf(ref);
      if (this.equipConfirmLabel) this.equipConfirmLabel.string = `${this.equipDisplayName(ref)}\n将从 ${from} 移到 ${ship}，确认？`;
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
      case 'bld_research_tower': return `全队伤害+${researchTeamBonusPct(level)}%`;
      case 'bld_salvage_port': return `打捞队${salvageTeamCount(level)}`;
      case 'bld_merchant_station': return `商店槽${merchantShopSlots(level)}`;
      case 'bld_supply_station': return '抽卡出率(预览)';
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
      `星矿 ${ore}    合金 ${alloy}\n当前节点 ${this.session.currentNodeId}    已通关 ${cleared}\n旗舰 ${S7_DEMO_FLAGSHIP_ID} Lv.${flagLv}  血${effHp} 攻${effAtk}`;
    // C：有未领离线收益才显示金色「领取」按钮。
    if (this.offlineBtn) this.offlineBtn.active = this.offlinePending !== null;
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
