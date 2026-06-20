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
import { S7UpgradeCostParam, S7BattleUnitStatParam, S7GrowthBandParam } from '../../config/s7/ConfigTypesS7';
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

const { ccclass } = _decorator;

/** demo 默认解锁的 7 栋建筑（真实游戏靠主线/教程解锁；demo 开局直接开到 1 级，便于演示养成）。 */
const S7_DEMO_DEFAULT_BUILDINGS = [
  'bld_dock', 'bld_pilot_training_bay', 'bld_habitat', 'bld_supply_station',
  'bld_salvage_port', 'bld_merchant_station', 'bld_research_tower',
];
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

  /** 由 MainSceneController 在 S7 配置预载成功后调用：注入 runtime + 存储适配器，建会话 + 搭色块 UI。 */
  init(runtime: S7ConfigRuntime, adapter: SaveStorageAdapter): void {
    this.adapter = adapter;
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

    // 读 S7 存档（独立域）：取出资源 + 主线进度 + 单位等级，建最小循环会话（带 unitLevels → 升级反映到战斗）。
    const now = Date.now();
    const loaded = loadS7Save(adapter, now);
    this.playerState = loaded.data.playerState;
    this.saveVersion = loaded.data.saveVersion;
    this.session = new S7RunSession(
      this.playerState.resources,
      this.playerState.mainlineProgress,
      runtime,
      model,
      this.playerState.unitLevels,
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
    this.makeLabel('《我的星舰小队》S7 最小循环演示', 30, new Color(255, 230, 120), 0, topY - 26);
    this.makeLabel('（色块原型 · 点出战推进主线）', 20, new Color(170, 180, 200), 0, topY - 64);

    // 状态行：星矿/合金/当前节点 + 旗舰等级。
    this.statusLabel = this.makeLabel('', 26, new Color(230, 240, 255), 0, H * 0.13);

    // 「出战」按钮（蓝色块）。
    this.makeButton('出战', 280, 92, new Color(60, 120, 220, 255), 0, -H * 0.02, () => this.onSortie());

    // 「升级旗舰」（绿）+「基地」（橙）并排：升旗舰=战力养成；基地=建筑养成（开建筑面板）。
    this.makeButton('升级旗舰', 230, 84, new Color(60, 170, 110, 255), -122, -H * 0.14, () => this.onUpgradeFlagship());
    this.makeButton('基地', 230, 84, new Color(200, 140, 60, 255), 122, -H * 0.14, () => this.openBase());

    // 「领取离线收益」按钮（金色·仅有未领收益时显示）：贴合"随用随停、回来有收获"。金额在结果行显示。
    this.offlineBtn = this.makeButton('领取离线收益', 440, 70, new Color(210, 170, 60, 255), 0, H * 0.205, () => this.onClaimOffline());
    this.offlineBtn.active = false;

    // 上一战 / 升级结果（多行）。
    this.resultLabel = this.makeLabel('点「出战」开始', 23, new Color(180, 230, 180), 0, -H * 0.26);

    // 「重置存档」小按钮（演示用：回到 n001、清零资源与等级，便于反复验证）。
    this.makeButton('重置存档', 170, 60, new Color(120, 70, 70, 255), 0, -H * 0.37, () => this.onReset());

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
    label.fontSize = 30;
    label.lineHeight = 40;
    label.color = new Color(255, 255, 255);
    label.string = text;
    node.on(Node.EventType.TOUCH_END, onTap, this);
    return node;
  }

  // ===== 交互 =====

  /**
   * 点「出战」：打当前节点（会话内部完成发奖+推进）→ 落盘 → 播色块回放 → 播完显示结果。
   * 无遭遇节点显示「暂无关卡」。回放期间禁止再次出战/升级/重置（playing 守门）。
   */
  private onSortie(): void {
    if (!this.session || this.playing) return;
    const nodeId = this.session.currentNodeId;
    let outcome: S7PlayNodeOutcome;
    try {
      outcome = this.session.playCurrentNode(S7_DEMO_RUN_SEED);
    } catch (err) {
      // 无遭遇配置节点（原型内容缺口）：组装器抛错，按"暂无关卡"提示，不崩、不落盘（无事发生）。
      this.setResult(`${nodeId} 暂无关卡（原型遭遇待补）`, new Color(200, 200, 200));
      console.warn('[S7DemoController] 该节点暂无战斗遭遇', nodeId, err);
      this.refresh();
      return;
    }
    // 状态已变（胜则发奖+推进），先落盘；结果文案按住、等回放放完再亮（边看打边出结果更有体感）。
    this.persist();
    this.pendingResult = this.composeResultText(nodeId, outcome);
    this.startPlayback(buildS7BattlePlayback(outcome.battle.result));
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
    if (this.stageNode) this.stageNode.active = false;
    if (this.skipBtn) this.skipBtn.active = false;
    if (this.pendingResult) this.setResult(this.pendingResult.text, this.pendingResult.color);
    this.refresh();
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
