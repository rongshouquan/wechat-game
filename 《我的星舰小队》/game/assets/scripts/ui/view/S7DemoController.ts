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
  S7SquadState, grantShip, grantPilot, grantCore, assignSlot, setSlotPilot, clearSlot, buildSquadLineup,
} from '../../core/s7/S7Squad';
import { buildPrebattleView, S7PrebattleView } from '../../core/s7/S7PrebattleView';
import { equipPlugin, unequipPlugin, equipCore, unequipCore } from '../../core/s7/S7ShipLoadout';
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

  // ===== B2 战斗色块回放（叠加层）=====
  private viewW = 720;
  private viewH = 1280;
  private stageNode: Node | null = null;
  private stageGfx: Graphics | null = null;
  private skipBtn: Node | null = null;
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
  private prebattleGfx: Graphics | null = null;     // 画底板 + 敌情预览 + 编队格高亮
  private prebattleInfoLabel: Label | null = null;  // 节点名 + 我方VS推荐战力 + 敌情概要
  private prebattleDetailLabel: Label | null = null; // 选中船详情(驾驶员/插件/星核占位)
  private prebattleCellLabels: Label[] = [];        // 9 格文字(与 SLOTS 平行)
  /** 当前选中的编队格(p{r}c{c})；null=未选。 */
  private prebattleSelSlot: string | null = null;
  /** 选择关卡浮层 + 有遭遇可玩的节点 id（init 算）。 */
  private levelSelectNode: Node | null = null;
  private encounterNodeIds: string[] = [];

  // ===== B 块 单舰深装（插件×3槽 + 星核槽）=====
  private pluginInventory: S7PluginInventoryState | null = null;
  /** pluginId → 槽位类型（武器/技能/战术），init 从 plugin_config 建。 */
  private pluginSlotMap: Map<string, S7PluginSlot> = new Map();
  private loadoutNode: Node | null = null;
  private loadoutTitleLabel: Label | null = null;
  private loadoutMsgLabel: Label | null = null;
  /** 4 个槽位行文字：[武器, 技能, 战术, 星核]。 */
  private loadoutSlotLabels: Label[] = [];
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

  /** 当前选中格里的星舰 id（按船装配用）；没选/空格 → null。 */
  private selectedShipId(): string | null {
    const s = this.prebattleSelSlot ? this.slotOf(this.prebattleSelSlot) : null;
    return s ? s.shipId : null;
  }

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

  /** 第一个未被任何船占用的拥有驾驶员(给"放船自动配员"用)；都占用则用第一个拥有员。
   *  "占用"= 已记忆在任意一艘船的装配里（含下场的船·一员只驾一船）。 */
  private firstFreePilot(): string | null {
    if (!this.squad || this.squad.ownedPilots.length === 0) return null;
    const used = new Set(
      Object.values(this.squad.shipLoadouts).map((l) => l.pilotId).filter((x): x is string => !!x),
    );
    return this.squad.ownedPilots.find((p) => !used.has(p)) ?? this.squad.ownedPilots[0];
  }

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

    // B2 战斗回放叠加层（默认隐藏；出战时弹出、播完隐藏）。挂在最后→盖在按钮之上。
    const stage = new Node('S7BattleStage');
    stage.layer = this.node.layer;
    this.node.addChild(stage);
    stage.setPosition(0, H * 0.02, 0);
    this.stageGfx = stage.addComponent(Graphics);
    stage.active = false;
    this.stageNode = stage;
    // 「跳过」按钮：回放时显示（盖在出战位上），点了直接跳到结果。
    this.skipBtn = this.makeButton('跳过 ▶▶', 200, 64, new Color(95, 100, 120, 255), 0, -H * 0.02, () => this.onSkip());
    this.skipBtn.active = false;

    this.buildBasePanel(W, H);
    this.buildPrebattlePanel(W, H);
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
    const dw = W * 0.82;
    const dh = H * 0.32;
    dim.fillColor = new Color(28, 24, 40, 255);
    dim.roundRect(-dw / 2, -dh / 2, dw, dh, 20);
    dim.fill();
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
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
    const leftLbl = mkB(260, 92, new Color(120, 90, 160, 255), -W * 0.21, -dh * 0.30, () => this.onResultGoHome());
    leftLbl.string = '返回星港';
    this.resultRightLabel = mkB(260, 92, new Color(225, 150, 45, 255), W * 0.21, -dh * 0.30, () => this.onResultGoPrebattle());
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

  /** 收起战斗画面 + 结果窗（玩家选完才切场景）。 */
  private dismissBattleScene(): void {
    if (this.resultPopupNode) this.resultPopupNode.active = false;
    if (this.stageNode) this.stageNode.active = false;
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
    panel.on(Node.EventType.TOUCH_END, () => {}, this);
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

  /** 搭"战前备战"叠加层（默认隐藏；点主界面出战时弹）。结构搭一次，内容由 refreshPrebattle 填。
   *  布局照 Ron mockup：标题/节点+敌情预览(上) → 我方VS推荐战力(中) → 3×3编队+选中船详情(下) → 返回星港/出战(底)。 */
  private buildPrebattlePanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const topY = band.usableTopY;
    const botY = band.usableBottomY;
    const panel = new Node('S7Prebattle');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸，防点穿到主界面按钮
    panel.active = false;
    this.prebattleNode = panel;
    this.prebattleGfx = g;

    const mk = (text: string, size: number, color: Color, x: number, y: number): Label => {
      const n = new Node('pbl');
      n.layer = this.node.layer;
      panel.addChild(n);
      n.setPosition(x, y, 0);
      const l = n.addComponent(Label);
      l.fontSize = size; l.lineHeight = Math.round(size * 1.3); l.color = color; l.string = text;
      return l;
    };
    const mkBtn = (text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void): void => {
      const n = new Node('pbBtn');
      n.layer = this.node.layer;
      panel.addChild(n);
      n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 12); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 34; l.lineHeight = 42; l.color = new Color(255, 255, 255); l.string = text;
      n.on(Node.EventType.TOUCH_END, onTap, this);
    };

    // 标题 + 信息行（节点/战力/敌情概要）——放大做清晰；上方大区留给敌情预览。
    mk('★ 战前备战 ★', 54, new Color(255, 230, 120), 0, topY - 44);
    this.prebattleInfoLabel = mk('', 32, new Color(210, 225, 250), 0, topY - 108);

    // 3×3 编队格：下移到下半区（上方大区留给敌情预览·照参考图）；格大、字大、但不撞下方"拥有"行。点格选中→下方选船/选员放入。
    const cell = W * 0.17;
    const gap = W * 0.19;
    const gridCx = -W * 0.13;          // 编队格整体偏左，右侧留给"选中船详情"
    const gridCy = -H * 0.10;
    this.prebattleCellLabels = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const slotRef = `p${r}c${c}`;
        // 站位与战斗一致：行 r=横向(左→右)，列 c=纵深(c2前排在上·朝敌、c0后排在下)。(原先横竖弄反致备战↔战斗对不上)
        const x = gridCx + (r - 1) * gap;
        const y = gridCy + (c - 1) * gap;
        const cn = new Node(`pbCell_${slotRef}`);
        cn.layer = this.node.layer; panel.addChild(cn); cn.setPosition(x, y, 0);
        const ut = cn.addComponent(UITransform); ut.setContentSize(cell, cell);
        cn.on(Node.EventType.TOUCH_END, () => this.onSelectPrebattleSlot(slotRef), this);
        const ln = new Node('t'); ln.layer = this.node.layer; cn.addChild(ln);
        const l = ln.addComponent(Label); l.fontSize = 30; l.lineHeight = 36; l.color = new Color(230, 240, 255); l.string = '';
        this.prebattleCellLabels.push(l);
      }
    }

    // 选中船详情（右侧）+「装配」(开插件/星核装卸面板) +「下场」键（清当前选中格）。
    this.prebattleDetailLabel = mk('', 26, new Color(220, 230, 250), W * 0.28, gridCy + gap * 0.6);
    mkBtn('装配', 160, 64, new Color(70, 130, 110, 255), W * 0.16, gridCy - gap, () => this.openLoadout());
    mkBtn('下场', 160, 64, new Color(120, 70, 70, 255), W * 0.40, gridCy - gap, () => this.onPrebattleBench());

    // 拥有的船 / 驾驶员（点选中格后，点这里放入）——按钮/字放大。
    mk('拥有星舰（点格后点这里放入）', 26, new Color(170, 185, 210), 0, botY + H * 0.205);
    S7_DEMO_SEED_SHIPS.forEach((s, i) => mkBtn(s, W * 0.175, 76, new Color(60, 110, 170, 255), (i - 2) * W * 0.185, botY + H * 0.16, () => this.onPrebattlePickShip(s)));
    mk('拥有驾驶员', 26, new Color(170, 185, 210), 0, botY + H * 0.12);
    S7_DEMO_SEED_PILOTS.forEach((p, i) => mkBtn(p, W * 0.175, 76, new Color(120, 90, 170, 255), (i - 2) * W * 0.185, botY + H * 0.075, () => this.onPrebattlePickPilot(p)));

    // 底部三键（照 Ron 图）：选择关卡(左) / 返回星港(中·回基地) / 开始战斗(右·明显更大)。
    mkBtn('选择关卡', 230, 84, new Color(70, 130, 180, 255), -W * 0.32, botY + 54, () => this.openLevelSelect());
    mkBtn('返回星港', 230, 84, new Color(120, 90, 160, 255), 0, botY + 54, () => this.closePrebattle());
    mkBtn('🚀 开始战斗', 340, 112, new Color(225, 150, 45, 255), W * 0.29, botY + 54, () => this.onConfirmSortie());
  }

  /** 搭"基地建筑"面板叠加层（默认隐藏）：底板 + 标题 + 7 行(点行=升该建筑) + 关闭。行文案在 refreshBasePanel 填。 */
  private buildBasePanel(W: number, H: number): void {
    const panel = new Node('S7BasePanel');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(10, 14, 26, 248);
    g.roundRect(-W * 0.45, -H * 0.32, W * 0.9, H * 0.64, 14);
    g.fill();
    panel.active = false;
    this.baseNode = panel;

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
    // 有遭遇：收起备战层 → 落盘 → 播战斗演出（结果按住、播完再亮 + 据胜负路由）。
    this.closePrebattle();
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
      // 敌情预览色块：按敌人站位 r{er}c{ec} 摆到上半区(占位待美术)。
      this.drawEnemyPreview(g, v, band);
    }

    // 9 格编队内容 + 选中高亮（在 gfx 上画格框）。坐标须与 buildPrebattlePanel 一致！
    const cell = W * 0.17;
    const gap = W * 0.19;
    const gridCx = -W * 0.13;
    const gridCy = -this.viewH * 0.10;
    for (let r2 = 0; r2 < 3; r2 += 1) {
      for (let c = 0; c < 3; c += 1) {
        const slotRef = `p${r2}c${c}`;
        // 与 buildPrebattlePanel 一致、与战斗一致：行=横向、列=纵深(c2前排在上)。
        const x = gridCx + (r2 - 1) * gap;
        const y = gridCy + (c - 1) * gap;
        const slot = this.slotOf(slotRef);
        const selected = this.prebattleSelSlot === slotRef;
        g.fillColor = slot ? new Color(60, 110, 170, 255) : new Color(34, 42, 60, 255);
        g.rect(x - cell / 2, y - cell / 2, cell, cell);
        g.fill();
        if (selected) {
          g.strokeColor = new Color(255, 235, 130, 255);
          g.lineWidth = 4;
          g.rect(x - cell / 2, y - cell / 2, cell, cell);
          g.stroke();
        }
        const idx = r2 * 3 + c;
        const lbl = this.prebattleCellLabels[idx];
        if (lbl) lbl.string = slot ? `${slot.shipId}\n${this.pilotOf(slot.shipId) ?? '缺员'}` : '空';
      }
    }

    // 选中船详情（B 块：插件×3槽 + 星核槽 真状态）。
    if (this.prebattleDetailLabel) {
      const sel = this.prebattleSelSlot ? this.slotOf(this.prebattleSelSlot) : null;
      this.prebattleDetailLabel.string = sel
        ? `选中 ${this.prebattleSelSlot}\n星舰 ${sel.shipId}\n驾驶员 ${this.pilotOf(sel.shipId) ?? '缺员'}\n${this.loadoutSummaryText(sel.shipId)}\n（点「装配」装/卸插件·星核）`
        : (this.prebattleSelSlot ? `选中 ${this.prebattleSelSlot}\n（空·点下方放船）` : '点一个格选中');
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

  /** 敌情预览：摆到编队格上方的敌方区（红=普通敌·紫=Boss）。占位，美术阶段换皮。
   *  站位与战斗一致：行 er=横向(左→右·5行)、列 ec=纵深(col0前排靠下朝我方、col6后排/Boss在上·7列)。 */
  private drawEnemyPreview(g: Graphics, v: S7PrebattleView, band: { usableTopY: number }): void {
    const W = this.viewW;
    const H = this.viewH;
    const left = -W * 0.40;
    const span = W * 0.80;
    const gridTop = -H * 0.10 + W * 0.19 + W * 0.085; // 编队格顶（gridCy + gap + cell/2）
    const enemyBottom = gridTop + H * 0.02;           // 敌方区下沿（前排 col0·靠我方）
    const enemyTop = band.usableTopY - H * 0.16;      // 敌方区上沿（后排 col6·信息行之下）
    const depth = Math.max(H * 0.06, enemyTop - enemyBottom);
    for (const e of v.enemies) {
      const m = /^r(\d)c(\d)$/.exec(e.slotRef);
      if (!m) continue;
      const er = Number(m[1]); // 行（横向）
      const ec = Number(m[2]); // 列（纵深）
      const x = left + ((er + 0.5) / 5) * span;
      const y = enemyBottom + (ec / 6) * depth; // col0 在下(前)、col6 在上(后)
      const sz = e.isBoss ? 42 : 26;
      g.fillColor = e.isBoss ? new Color(200, 90, 205, 255) : new Color(230, 110, 80, 255);
      g.rect(x - sz / 2, y - sz / 2, sz, sz);
      g.fill();
    }
  }

  private onSelectPrebattleSlot(slotRef: string): void {
    this.prebattleSelSlot = slotRef;
    this.refreshPrebattle();
  }

  /** 点拥有的船：放进当前选中格（自动配一个空闲驾驶员）；未选格则忽略。 */
  private onPrebattlePickShip(shipId: string): void {
    if (!this.squad || !this.prebattleSelSlot) return;
    assignSlot(this.squad, this.prebattleSelSlot, shipId, this.firstFreePilot());
    this.persist();
    this.refreshPrebattle();
  }

  /** 点拥有的驾驶员：配给当前选中格的船（该格须已有船）；走唯一性（从别船自动卸下）。 */
  private onPrebattlePickPilot(pilotId: string): void {
    if (!this.squad || !this.prebattleSelSlot) return;
    if (!this.slotOf(this.prebattleSelSlot)) return; // 空格先放船
    setSlotPilot(this.squad, this.prebattleSelSlot, pilotId); // 一员只能驾一船·自动卸下
    this.persist();
    this.refreshPrebattle();
  }

  /** 下场：清空当前选中格。 */
  private onPrebattleBench(): void {
    if (!this.squad || !this.prebattleSelSlot) return;
    clearSlot(this.squad, this.prebattleSelSlot);
    this.persist();
    this.refreshPrebattle();
  }

  // ===== B 块 单舰深装面板（插件×3槽 + 星核槽 真装/卸）=====

  /** 搭深装叠加层（默认隐藏）：标题 + 4 槽位行(点行=卸) + 拥有插件/星核按钮(点=装) + 关闭。
   *  插件/星核按钮在 init 发货后建一次（实例号确定·重置后可复现，故按钮恒有效）。 */
  private buildLoadoutPanel(W: number, H: number): void {
    const band = getS7UsableBand();
    const panel = new Node('S7Loadout');
    panel.layer = this.node.layer;
    this.node.addChild(panel);
    panel.setPosition(0, 0, 0);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color(10, 14, 26, 252);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    const put = panel.addComponent(UITransform);
    put.setContentSize(W, H);
    panel.on(Node.EventType.TOUCH_END, () => {}, this); // 吞触摸
    panel.active = false;
    this.loadoutNode = panel;

    const mkL = (t: string, s: number, c: Color, x: number, y: number): Label => {
      const n = new Node('lol'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const l = n.addComponent(Label); l.fontSize = s; l.lineHeight = Math.round(s * 1.3); l.color = c; l.string = t;
      return l;
    };
    const mkB = (t: string, w: number, h: number, c: Color, x: number, y: number, tap: () => void): void => {
      const n = new Node('lob'); n.layer = this.node.layer; panel.addChild(n); n.setPosition(x, y, 0);
      const ut = n.addComponent(UITransform); ut.setContentSize(w, h);
      const bg = n.addComponent(Graphics); bg.fillColor = c; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; n.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 24; l.lineHeight = 30; l.color = new Color(255, 255, 255); l.string = t;
      n.on(Node.EventType.TOUCH_END, tap, this);
    };

    this.loadoutTitleLabel = mkL('', 36, new Color(255, 230, 120), 0, band.usableTopY - 50);
    this.loadoutMsgLabel = mkL('点下方插件/星核装入；点上方槽位行卸下', 24, new Color(190, 205, 230), 0, band.usableTopY - 100);

    // 4 槽位行（武器/技能/战术/星核）：点行 = 卸该槽。
    const rowLabels = ['weapon', 'skill', 'tactical', 'core'];
    this.loadoutSlotLabels = [];
    const rowTop = band.usableTopY - 165;
    const rowH = 60;
    rowLabels.forEach((_tag, i) => {
      const y = rowTop - i * (rowH + 8);
      const row = new Node(`loSlot_${i}`); row.layer = this.node.layer; panel.addChild(row); row.setPosition(0, y, 0);
      const rut = row.addComponent(UITransform); rut.setContentSize(W * 0.86, rowH);
      const rg = row.addComponent(Graphics); rg.fillColor = new Color(30, 38, 56, 255);
      rg.roundRect(-W * 0.43, -rowH / 2, W * 0.86, rowH, 8); rg.fill();
      const ln = new Node('t'); ln.layer = this.node.layer; row.addChild(ln);
      const l = ln.addComponent(Label); l.fontSize = 24; l.lineHeight = 30; l.color = new Color(230, 240, 255); l.string = '';
      this.loadoutSlotLabels.push(l);
      row.on(Node.EventType.TOUCH_END, () => this.onLoadoutUnequipSlot(i), this);
    });

    // 拥有插件（点装入对应槽）—— init 发货后建按钮。
    let y = rowTop - 4 * (rowH + 8) - 30;
    mkL('拥有插件（点装入·同类槽会拦/同名拦）', 24, new Color(170, 185, 210), 0, y);
    y -= 44;
    const plugins = this.pluginInventory ? this.pluginInventory.plugins : [];
    const perRow = 3;
    const bw = W * 0.29;
    const bh = 74;
    const gx = W * 0.31;
    plugins.forEach((p, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const x = (c - (perRow - 1) / 2) * gx;
      const tagZh = S7_SLOT_TAG_NAMES[this.pluginSlotMap.get(p.pluginId) ?? 'weapon'] ?? '?';
      mkB(`${p.pluginId}\n${tagZh}·${S7_QUALITY_NAMES[p.quality] ?? p.quality}`, bw, bh, new Color(55, 95, 150, 255), x, y - r * (bh + 10), () => this.onLoadoutEquipPlugin(p.instanceId));
    });
    const pluginRows = Math.ceil(plugins.length / perRow);
    y -= pluginRows * (bh + 10) + 24;

    // 拥有星核（点装入星核槽）。标注"有效果/占位"：现仅过载核心(core07)做了战斗质变，core01-06 效果留后续内容块。
    mkL('拥有星核（点装入·现仅过载核心有效果）', 24, new Color(170, 185, 210), 0, y);
    y -= 44;
    const cores = this.squad ? Object.keys(this.squad.ownedCores) : [];
    cores.forEach((coreId, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const x = (c - (perRow - 1) / 2) * gx;
      const hasEffect = coreBlocks(coreId).length > 0;
      const label = `${coreId}\n${hasEffect ? '有效果' : '占位·待做'}`;
      const col = hasEffect ? new Color(150, 110, 60, 255) : new Color(80, 80, 90, 255);
      mkB(label, bw, bh, col, x, y - r * (bh + 10), () => this.onLoadoutEquipCore(coreId));
    });

    mkB('关闭', 220, 70, new Color(120, 90, 160, 255), 0, band.usableBottomY + 50, () => this.closeLoadout());
  }

  /** 开深装面板：须当前选中一个有船的格。 */
  private openLoadout(): void {
    if (this.playing || !this.loadoutNode) return;
    const sel = this.prebattleSelSlot ? this.slotOf(this.prebattleSelSlot) : null;
    if (!sel) {
      if (this.prebattleInfoLabel) {
        this.prebattleInfoLabel.string = '⚠ 先点一个有船的格，再点「装配」';
        this.prebattleInfoLabel.color = new Color(240, 200, 120);
      }
      return;
    }
    this.refreshLoadout();
    this.loadoutNode.active = true;
  }

  private closeLoadout(): void {
    if (this.loadoutNode) this.loadoutNode.active = false;
    this.refreshPrebattle(); // 回备战界面更新选中船详情
  }

  /** 刷新深装面板：标题(船) + 4 槽位行当前装备。按船读 shipLoadouts。 */
  private refreshLoadout(): void {
    const ref = this.prebattleSelSlot;
    const slot = ref ? this.slotOf(ref) : null;
    if (!slot) { this.closeLoadout(); return; }
    const shipId = slot.shipId;
    const loadout = this.squad ? this.squad.shipLoadouts[shipId] : undefined;
    if (this.loadoutTitleLabel) this.loadoutTitleLabel.string = `装配 — ${shipId}（${ref}）`;
    const tags: S7PluginSlot[] = ['weapon', 'skill', 'tactical'];
    tags.forEach((t, i) => {
      const inst = this.equippedInSlotType(shipId, t);
      const v = inst ? `${inst.pluginId}·${S7_QUALITY_NAMES[inst.quality] ?? inst.quality}（点卸下）` : '空';
      if (this.loadoutSlotLabels[i]) this.loadoutSlotLabels[i].string = `${S7_SLOT_TAG_NAMES[t]}槽：${v}`;
    });
    if (this.loadoutSlotLabels[3]) this.loadoutSlotLabels[3].string = `星核槽：${loadout?.coreId ? `${loadout.coreId}（点卸下）` : '空'}`;
  }

  private setLoadoutMsg(text: string, color: Color): void {
    if (this.loadoutMsgLabel) { this.loadoutMsgLabel.string = text; this.loadoutMsgLabel.color = color; }
  }

  /** 装插件到当前选中船：成功/失败都给中文提示。按船(shipId)装。 */
  private onLoadoutEquipPlugin(instanceId: string): void {
    const shipId = this.selectedShipId();
    if (!this.squad || !this.pluginInventory || !shipId) return;
    const r = equipPlugin(this.squad, this.pluginInventory, shipId, instanceId, this.pluginSlotOf);
    if (r.ok) this.setLoadoutMsg('已装上', new Color(160, 235, 160));
    else this.setLoadoutMsg(this.zhLoadoutErr(r.code), new Color(235, 150, 150));
    this.persist();
    this.refreshLoadout();
  }

  /** 装星核到当前选中船。按船(shipId)装。 */
  private onLoadoutEquipCore(coreId: string): void {
    const shipId = this.selectedShipId();
    if (!this.squad || !shipId) return;
    const r = equipCore(this.squad, shipId, coreId);
    if (r.ok) this.setLoadoutMsg('已装上星核', new Color(160, 235, 160));
    else this.setLoadoutMsg(this.zhLoadoutErr(r.code), new Color(235, 150, 150));
    this.persist();
    this.refreshLoadout();
  }

  /** 点槽位行卸下（i: 0武器/1技能/2战术/3星核）。按船(shipId)卸。 */
  private onLoadoutUnequipSlot(i: number): void {
    const shipId = this.selectedShipId();
    if (!this.squad || !shipId) return;
    if (i === 3) {
      unequipCore(this.squad, shipId);
    } else {
      const tag: S7PluginSlot = i === 0 ? 'weapon' : i === 1 ? 'skill' : 'tactical';
      const inst = this.equippedInSlotType(shipId, tag);
      if (inst) unequipPlugin(this.squad, shipId, inst.instanceId);
    }
    this.setLoadoutMsg('已卸下', new Color(200, 210, 235));
    this.persist();
    this.refreshLoadout();
  }

  /** 装配错误码 → 中文（仅显示）。 */
  private zhLoadoutErr(code: string): string {
    const map: Record<string, string> = {
      not_owned_ship: '未拥有该船',
      not_owned_plugin: '没有这个插件',
      unknown_plugin: '插件槽位未知',
      slot_type_occupied: '该类型槽已占（先卸下原件）',
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

  /** 开播：算各单位战场坐标、亮出叠加层与「跳过」，从第 0 帧起逐帧推进（update 驱动）。 */
  private startPlayback(pb: S7BattlePlayback): void {
    if (!this.stageNode || !this.skipBtn) return;
    this.playback = pb;
    this.frameIdx = 0;
    this.stepClock = 0;
    // 总时长压到 ~2.8 秒内：每帧停留 = clamp(2.8/帧数, 0.03, 0.10)。
    this.stepSec = Math.max(0.03, Math.min(0.10, 2.8 / Math.max(1, pb.frames.length - 1)));
    this.computePositions(pb);
    this.playing = true;
    this.stageNode.active = true;
    this.skipBtn.active = true;
    this.setResult('⚔ 交战中…', new Color(210, 220, 240));
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

  /** 收尾：停播、隐藏叠加层与「跳过」、亮出结果文案、刷新状态行。 */
  private finishPlayback(): void {
    this.playing = false;
    if (this.skipBtn) this.skipBtn.active = false;
    // #3：弹结果窗时【背景保留刚结束的战斗画面】——不隐藏 stage、不刷主界面，等玩家选了再切场景。
    this.openResultPopup(this.pendingWon);
  }

  /** 预算各单位的战场局部坐标：敌方在上半区（前列 col 小→靠中间），我方在下半区（前列 col 大→靠中间）。 */
  private computePositions(pb: S7BattlePlayback): void {
    this.posById.clear();
    const hw = this.viewW * 0.46;
    const hh = this.viewH * 0.20;
    const gap = hh * 0.12;
    for (const u of pb.roster) {
      const boss = u.unitStatRef.indexOf('warden') >= 0 || u.unitStatRef.indexOf('boss') >= 0;
      let x: number;
      let y: number;
      if (u.side === 'player') {
        x = -hw + ((u.row + 0.5) / 3) * (2 * hw);
        y = -gap - ((2 - u.col) / 2) * (hh - gap); // col2(前排)靠中间, col0(后排)靠底
      } else {
        x = -hw + ((u.row + 0.5) / 5) * (2 * hw);
        y = gap + (u.col / 6) * (hh - gap); // col0(前排)靠中间, col6(后排)靠顶
      }
      this.posById.set(u.unitId, { x, y, boss });
    }
  }

  /** 画一帧：底板 + 攻击连线 + 双方色块（血条/死亡变灰/出手描边）。 */
  private drawFrame(frame: S7PlaybackFrame): void {
    const g = this.stageGfx;
    if (!g || !this.playback) return;
    const hw = this.viewW * 0.46;
    const hh = this.viewH * 0.20;
    g.clear();
    // 底板
    g.fillColor = new Color(8, 11, 22, 242);
    g.roundRect(-hw - 12, -hh - 12, 2 * hw + 24, 2 * hh + 24, 12);
    g.fill();
    // 中线（双方分界）
    g.strokeColor = new Color(60, 70, 90, 200);
    g.lineWidth = 1;
    g.moveTo(-hw, 0);
    g.lineTo(hw, 0);
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
      const half = p.boss ? 26 : 15;
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
