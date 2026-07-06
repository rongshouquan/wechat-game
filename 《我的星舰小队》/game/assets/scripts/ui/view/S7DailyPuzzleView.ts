/**
 * 每日推演 · 页签内容 view（第2.5块·块4步2，GDD S10.9 / 附录B B5.3）。
 *
 * 守工作流程⑧：独立 view 文件（不扩 S7DemoController 单体），照 S7BountyBoardView / S7CorridorTowerView 模式——
 * 程序化色块建节点、按钮 TOUCH_END 直挂、业务逻辑全委托 core/s7/S7DailyPuzzle*（经宿主接口 S7DailyPuzzleHost）。
 * 挂进「作战大厅」当页签（topY 让出顶部页签栏空间·返回由大厅统一提供）。
 *
 * 页面（B5.3·灰盒·棋局感）：题头(第X题·威胁类型) → 威胁提示 → 敌阵沙盘(5×7 缩略·威胁单位高亮)
 *   → 候选战队包横排(舰+员+若有核/插件·点选) → 我方 3×3 选摆格(点包再点格放置·点已放格拿回) → 开始推演。
 * 选摆满 5 才可开打；胜=今日已解态+奖励；败=随便再试(不限次·零惩罚·无广告)。
 *
 * 巡检复验修复批（2026-07-06·Ron 真机反馈）两刀：
 *   ① **增量刷新（治点击延迟真因）**：旧版每次点击全量 removeAllChildren + 重建 ~90 节点/20+ 处 SHRINK 文本测量；
 *      现改「结构层换题才重建（rebuildStructure）+ 状态层点击只重画颜色/守卫式改字（applyState）」——点击路径 0 节点重建、
 *      文本没变不重设（Label.string 触发整段重排版，SHRINK 还要多趟字号测量——守卫掉就是省下的延迟）。
 *   ② **三大块放大 + 吃纵向空档**：尺寸上限抬高（沙盘格高 24→44 / 包卡高 112→170 / 摆位格 100→150·字号随格子同步缩放），
 *      区块按可用高度顺排、只留 16px 呼吸档（B0.6 #16 间距档）——高屏不再"内容三分之一+大片空黑"；
 *      小屏仍按带宽自适应缩格，零重叠硬线不破（B0.6②·W=750 校算）。
 *
 * 交互通则 B0.6 逐条守：①点击当帧刷新（增量·毫秒级） ②文本锚容器内 SHRINK ③返回明确(大厅提供) ④按钮随语境(未满5不可开打)
 *   ⑥四态(选中高亮/已上阵置灰) ⑦入账回执(控制器飘字) ⑧玩家侧题号从1起 ⑩新内容一句话(威胁提示) ⑪DEV隔离 ⑫随停(控制器管)。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';
// 战场朝向唯一真源（B0.7·B0.6#13）：敌阵沙盘/我方摆位一律走它换算，禁止自写。
import { s7FieldVisualCell, s7FieldUniformPos, S7_FIELD_DEPTH, S7_FIELD_LATERAL } from '../S7BattleFieldOrient';

/** 一个候选战队包的展示数据（舰+员固定绑定·可选核/插件）。 */
export interface S7PuzzlePackView {
  packId: string;
  shipName: string;
  pilotName: string;
  /** 定位型中文（突击/护卫/炮击/支援/工程）。 */
  posType: string;
  /** 携带的核/插件短文案（"核:陨星弹" / "插:狂热弹药" 拼接；无则空）。 */
  extra: string;
}

/** 敌阵沙盘一格（只列被占用的格）。 */
export interface S7PuzzleEnemyCell {
  /** r{0-4}c{0-6}。 */
  slotRef: string;
  /** 短名/标记（如"狙""盾""奶""召""炮"）。 */
  mark: string;
  /** 威胁单位高亮。 */
  threat: boolean;
}

/** 控制器提供给推演 view 的展示数据（一次性快照·refresh 时现取）。 */
export interface S7DailyPuzzleViewData {
  /** 未解锁（打通 n040 前）：只显示锁定提示、藏选摆/开打。 */
  locked?: boolean;
  lockedText?: string;
  puzzleId: string;
  /** "第 X 题 · 后排点名"。 */
  title: string;
  /** "全星港指挥官同题 · 每天凌晨4点换题"。 */
  subtitle: string;
  threatHint: string;
  enemyCells: S7PuzzleEnemyCell[];
  candidatePacks: S7PuzzlePackView[];
  /** 上阵格数（=5）。 */
  lineupSize: number;
  solved: boolean;
  /** 已解时的奖励短文案（"星贝+20 通用碎片+3"）。 */
  solvedRewardText: string;
  attempts: number;
}

/** 控制器提供给推演 view 的宿主接口（数据只读 + 动作回调）。 */
export interface S7DailyPuzzleHost {
  readonly layer: number;
  /** 今日题展示数据（含已解态·refresh 现取）。 */
  puzzleView(): S7DailyPuzzleViewData;
  /** 开打（控制器接管：备战→真打→结算→单键返回本页）。selection=选中的 5 包各自摆到哪格。 */
  startBattle(selection: { packId: string; slotRef: string }[]): void;
  /** 返回星港（大厅代理）。 */
  onClose(): void;
  /** DEV 跳到指定题号（上线前删）。 */
  devJump(puzzleId: string): void;
  /** DEV 题库全部题号（跳题轮换用·上线前删）。 */
  devPuzzleIds(): string[];
}

export class S7DailyPuzzleView {
  private readonly root: Node;
  private readonly bodyNode: Node;
  private readonly headerLabel: Label;
  private readonly subLabel: Label;
  private readonly hintLabel: Label;
  private readonly noticeLabel: Label;
  private readonly startBtn: Node;
  private readonly startLabel: Label;
  private readonly topY: number;
  private readonly bottomY: number;

  /** 选摆瞬态（UI 状态·不入档）：slotRef→packId + 当前选中待放的包。 */
  private placement = new Map<string, string>();
  private selectedPackId: string | null = null;
  /** 当前题号（换题时清选摆）。 */
  private placedForPuzzle = '';
  private devPickIdx = 0;

  // ===== 复验批①·增量刷新缓存：换题/候选变化才重建节点，点击只改状态 =====
  private builtForPuzzle = '';
  private builtPackKey = '';
  private packViews = new Map<string, { gfx: Graphics; nameL: Label; statusL: Label; cardW: number; cardH: number }>();
  private gridViews = new Map<string, { gfx: Graphics; occL: Label; occSub: Label; emptyL: Label; cell: number }>();
  private lastStartText = '';

  constructor(
    parent: Node, private readonly host: S7DailyPuzzleHost, private readonly W: number, private readonly H: number,
    opts: { topY?: number } = {},
  ) {
    const band = getS7UsableBand();
    this.topY = opts.topY ?? band.usableTopY;
    this.bottomY = band.usableBottomY;
    const root = new Node('S7DailyPuzzle'); root.layer = host.layer; parent.addChild(root); root.setPosition(0, 0, 0);
    const bg = root.addComponent(Graphics); bg.fillColor = new Color(10, 16, 30, 252); bg.rect(-W / 2, -H / 2, W, H); bg.fill();
    root.addComponent(UITransform).setContentSize(W, H);
    root.on(Node.EventType.TOUCH_END, () => {}, this); // 吞空白触摸
    root.active = false;
    this.root = root;

    this.headerLabel = this.mkLabel(root, 0, this.topY - 30, 34, new Color(170, 210, 245));
    this.subLabel = this.mkLabel(root, 0, this.topY - 62, 20, new Color(150, 170, 205));
    this.hintLabel = this.mkLabel(root, 0, this.topY - 92, 22, new Color(240, 205, 130));
    this.hintLabel.overflow = Label.Overflow.SHRINK; this.hintLabel.enableWrapText = true;
    this.hintLabel.node.getComponent(UITransform)!.setContentSize(W * 0.92, 52);
    this.noticeLabel = this.mkLabel(root, 0, this.topY - 128, 20, new Color(180, 225, 190));

    const body = new Node('body'); body.layer = host.layer; root.addChild(body); body.setPosition(0, 0, 0);
    this.bodyNode = body;

    // 底部固定：开始推演大钮 + DEV 行（返回由大厅统一提供）。
    this.startBtn = this.mkBtn(root, '开始推演', 320, 84, new Color(235, 170, 50, 255), 0, band.usableBottomY + 118, () => this.onStart(), 32);
    this.startLabel = this.startBtn.getComponentInChildren(Label)!;
    const devY = band.usableBottomY + 44;
    this.mkBtn(root, 'DEV跳题', 150, 48, new Color(70, 70, 78, 255), -W * 0.22, devY, () => this.devNextPuzzle(), 20);
    this.mkBtn(root, 'DEV清摆', 150, 48, new Color(70, 70, 78, 255), W * 0.22, devY, () => { this.placement.clear(); this.selectedPackId = null; this.refresh(); }, 20);
  }

  open(): void { this.refresh(); this.root.active = true; }
  close(): void { this.root.active = false; }
  get isOpen(): boolean { return this.root.active; }
  notice(text: string): void { this.noticeLabel.string = text; }

  /** 重刷：结构层（换题才重建节点）+ 状态层（守卫式改字/重画变色）。换题清选摆；同题保留（败后可微调再试）。 */
  refresh(): void {
    const t0 = Date.now(); // DEV-TEMP：[PERF] 计时探针（真机延迟证据·微信开发者工具 console 看·上线前随 DEV 清单删）
    const d = this.host.puzzleView();
    if (d.locked) {
      this.builtForPuzzle = ''; this.builtPackKey = '';
      this.packViews.clear(); this.gridViews.clear();
      this.bodyNode.removeAllChildren();
      this.setL(this.headerLabel, '🧩 每日推演');
      this.setL(this.subLabel, '');
      this.setL(this.hintLabel, '');
      this.setL(this.noticeLabel, '');
      this.startBtn.active = false;
      this.lastStartText = '';
      this.mkLabel(this.bodyNode, 0, this.topY - 200, 26, new Color(200, 180, 130)).string = `🔒 ${d.lockedText ?? '暂未解锁'}`;
      return;
    }
    this.startBtn.active = true;
    if (d.puzzleId !== this.placedForPuzzle) { this.placement.clear(); this.selectedPackId = null; this.placedForPuzzle = d.puzzleId; }
    // 清掉已不在候选里的选摆（防御：换题/脏态）。
    const packIds = new Set(d.candidatePacks.map((p) => p.packId));
    for (const [slot, pid] of Array.from(this.placement.entries())) if (!packIds.has(pid)) this.placement.delete(slot);
    if (this.selectedPackId && !packIds.has(this.selectedPackId)) this.selectedPackId = null;

    // 结构层：换题/候选包变了才重建（正常点击路径零节点重建——延迟修复的核心）。
    const packKey = d.candidatePacks.map((p) => p.packId).join(',');
    const rebuilt = d.puzzleId !== this.builtForPuzzle || packKey !== this.builtPackKey;
    if (rebuilt) {
      this.rebuildStructure(d);
      this.builtForPuzzle = d.puzzleId;
      this.builtPackKey = packKey;
    }

    // 状态层：文本守卫（没变不重设=不触发 Label 重排版/SHRINK 重测量）+ 只重画变色的卡/格。
    this.setL(this.headerLabel, `🧩 ${d.title}`);
    this.setL(this.subLabel, d.subtitle);
    this.setL(this.hintLabel, `⚠ ${d.threatHint}`);
    this.setL(this.noticeLabel, d.solved
      ? `🎉 今日已解 · 奖励 ${d.solvedRewardText} · 明日再会（可重温·不重复发奖）`
      : this.selectedPackId
        ? '已选中一个战队包 —— 点下方九宫格空位放上去'
        : `点候选包选中 → 点九宫格摆位 · 已摆 ${this.placement.size}/${d.lineupSize}（点已摆的格可拿回）`);
    this.applyPackStates(d);
    this.applyGridStates(d);

    // 开打态：满 5 才可开（未满置灰·B0.6 ④⑥）；文本没变不重画。
    const ready = this.placement.size === d.lineupSize;
    const startText = ready ? '开始推演' : `再摆 ${d.lineupSize - this.placement.size} 个`;
    if (startText !== this.lastStartText) {
      this.lastStartText = startText;
      this.startLabel.string = startText;
      this.redrawBtnBg(this.startBtn, ready ? new Color(235, 170, 50, 255) : new Color(90, 90, 96, 255));
    }
    const cost = Date.now() - t0;
    if (cost >= 8) console.log(`[PERF][DEV-TEMP] 推演页 refresh ${cost}ms${rebuilt ? '（换题重建）' : '（增量）'}`);
  }

  /** 结构层重建（仅换题/候选变化时走）：四区顺排放大版（复验批②）——尺寸上限抬高、区块紧排 16px 呼吸档、字号随格缩放。 */
  private rebuildStructure(d: S7DailyPuzzleViewData): void {
    this.bodyNode.removeAllChildren();
    this.packViews.clear();
    this.gridViews.clear();
    this.lastStartText = ''; // 重建后强制开打钮重刷一次

    const DIV = 26, GAP = 16; // 区块呼吸间距走 B0.6 #16 档（16px）
    const headerBottom = this.topY - 138;       // 题头块(含威胁提示/notice)之下
    const floor = this.bottomY + 168;           // 内容底（开打大钮之上留呼吸）
    const contentH = Math.max(240, headerBottom - floor - 3 * DIV - 3 * GAP);
    const hEnemy = contentH * 0.26, hCand = contentH * 0.36, hGrid = contentH * 0.38;
    let y = headerBottom;
    const divider = (text: string, color: Color): void => {
      this.mkLabel(this.bodyNode, 0, y - DIV / 2, 19, color).string = text;
      y -= DIV;
    };
    divider('── 敌阵沙盘（下＝敌前排·贴近你 · 威胁高亮）──', new Color(210, 150, 150));
    this.buildEnemySandbox(d.enemyCells, y, hEnemy);
    y -= hEnemy + GAP;
    divider(`── 候选战队包（选 ${d.lineupSize} 个·归一 C 阶 Lv10）──`, new Color(150, 200, 220));
    this.buildCandidateRow(d.candidatePacks, y, hCand);
    y -= hCand + GAP;
    divider('── 我方摆位（上＝我前排·贴近敌 · 下＝后排）──', new Color(150, 220, 180));
    this.buildPlayerGrid(y, hGrid);
  }

  /**
   * 敌阵沙盘（朝向走唯一真源 s7FieldUniformPos·B0.7）：纵深=竖轴、横向=行；敌前排(c0)在下贴近你、c6 最深在上。
   * 只画被占用格（威胁高亮）。复验批②：格高上限 24→44、宽随高放大（≤1.6 倍高·横向最宽 0.88W），标记字号随格缩放。
   * 全静态（占用/威胁属题面）→ 只在结构重建时走。
   */
  private buildEnemySandbox(cells: readonly S7PuzzleEnemyCell[], topY: number, height: number): void {
    const gap = 3;
    const depth = S7_FIELD_DEPTH.enemy, lateral = S7_FIELD_LATERAL.enemy; // 7 深 × 5 横
    const chE = Math.max(12, Math.min(44, (height - (depth - 1) * gap) / depth));
    const cwE = Math.min(chE * 1.6, (this.W * 0.88 - (lateral - 1) * gap) / lateral);
    const gridW = lateral * (cwE + gap) - gap, gridH = depth * (chE + gap) - gap;
    const anchorX = -gridW / 2 + cwE / 2;      // visualCol0 = 最左
    const anchorY = topY - chE / 2 - 4;         // visualRow0 = 最上
    const frame = new Node('efrm'); frame.layer = this.host.layer; this.bodyNode.addChild(frame);
    frame.setPosition(0, topY - 4 - gridH / 2, 0); // 框贴住实际格阵（顶对齐·不再按带高居中留缝）
    const fg = frame.addComponent(Graphics); fg.fillColor = new Color(16, 20, 32, 255); fg.roundRect(-gridW / 2 - 8, -gridH / 2 - 8, gridW + 16, gridH + 16, 8); fg.fill();
    const occ = new Map(cells.map((c) => [c.slotRef, c]));
    const markFs = Math.round(Math.min(22, Math.max(12, chE - 8)));
    for (let row = 0; row < lateral; row += 1) for (let col = 0; col < depth; col += 1) {
      const cell = occ.get(`r${row}c${col}`);
      const { x, y } = s7FieldUniformPos('enemy', row, col, anchorX, anchorY, cwE, chE, gap);
      const n = new Node('ec'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      const g = n.addComponent(Graphics);
      g.fillColor = cell ? (cell.threat ? new Color(200, 70, 70, 255) : new Color(120, 80, 80, 255)) : new Color(30, 36, 50, 255);
      g.roundRect(-cwE / 2, -chE / 2, cwE, chE, 4); g.fill();
      if (cell) { const l = this.mkLabel(n, 0, 0, markFs, new Color(255, 255, 255)); l.string = cell.mark; }
    }
  }

  /** 候选战队包横排（2 行铺·复验批②：卡高上限 112→170、字号随卡高缩放）。结构层只建一次：
   *  名字/定位型/核插件=题面静态文本；「点选/✓已选/已上阵」状态行与描边色由 applyPackStates 增量更新。 */
  private buildCandidateRow(packs: readonly S7PuzzlePackView[], topY: number, height: number): void {
    const perRow = 4, gap = 8, rowGap = 12;
    const rows = Math.max(1, Math.ceil(packs.length / perRow));
    const cardW = Math.min(190, (this.W * 0.94) / perRow - gap);
    const cardH = Math.max(76, Math.min(170, (height - (rows - 1) * rowGap) / rows));
    const nameFs = Math.round(Math.max(19, Math.min(26, cardH * 0.18)));
    const midFs = Math.round(Math.max(15, Math.min(19, cardH * 0.14)));
    const stFs = Math.round(Math.max(14, Math.min(17, cardH * 0.13)));
    const topRowY = topY - cardH / 2 - 2;
    packs.forEach((p, i) => {
      const rowN = Math.floor(i / perRow), col = i % perRow;
      const rowCount = Math.min(perRow, packs.length - rowN * perRow);
      const rowW = rowCount * (cardW + gap) - gap;
      const x = -rowW / 2 + cardW / 2 + col * (cardW + gap);
      const y = topRowY - rowN * (cardH + rowGap);
      const n = new Node('pk'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      n.addComponent(UITransform).setContentSize(cardW, cardH);
      const g = n.addComponent(Graphics); // 底/描边由 applyPackStates 按态重画
      const nameL = this.mkLabel(n, 0, cardH * 0.30, nameFs, new Color(225, 232, 245));
      nameL.overflow = Label.Overflow.SHRINK; nameL.enableWrapText = false; nameL.node.getComponent(UITransform)!.setContentSize(cardW - 12, nameFs + 8);
      nameL.string = `${p.shipName}·${p.pilotName}`;
      const midL = this.mkLabel(n, 0, cardH * 0.03, midFs, new Color(170, 190, 160));
      midL.overflow = Label.Overflow.SHRINK; midL.enableWrapText = false; midL.node.getComponent(UITransform)!.setContentSize(cardW - 12, midFs + 8);
      midL.string = p.extra ? `[${p.posType}] ${p.extra}` : `[${p.posType}]`;
      const statusL = this.mkLabel(n, 0, -cardH * 0.32, stFs, new Color(130, 155, 190));
      // 点击常挂·已上阵与否在 onPickPack 内判（老行为：已上阵卡点了无反应，去点格拿回）。
      n.on(Node.EventType.TOUCH_END, () => this.onPickPack(p.packId), this);
      this.packViews.set(p.packId, { gfx: g, nameL, statusL, cardW, cardH });
    });
  }

  /**
   * 我方 3×3 选摆格（朝向走唯一真源 s7FieldUniformPos·B0.7）：纵深=竖轴、横向=行；我方前排(c2)在上贴近敌。
   * 复验批②：格上限 100→150、字号随格缩放。结构层建格与三套标签（占用名/驾驶员/空位标记），
   * 占用态切换由 applyGridStates 增量更新（改 active+守卫式改字+重画底色）。
   */
  private buildPlayerGrid(topY: number, height: number): void {
    const gap = 10;
    const depth = S7_FIELD_DEPTH.player, lateral = S7_FIELD_LATERAL.player; // 3 深 × 3 横
    const cell = Math.max(64, Math.min(150, Math.min((height - (depth - 1) * gap) / depth, (this.W * 0.8 - (lateral - 1) * gap) / lateral)));
    const gridW = lateral * (cell + gap) - gap;
    const anchorX = -gridW / 2 + cell / 2, anchorY = topY - cell / 2 - 2;
    const occFs = Math.round(Math.min(22, Math.max(14, cell * 0.2)));
    const subFs = Math.round(Math.min(16, Math.max(12, cell * 0.14)));
    const emptyFs = Math.round(Math.min(18, Math.max(13, cell * 0.16)));
    for (let row = 0; row < lateral; row += 1) for (let col = 0; col < depth; col += 1) {
      const slot = `p${row}c${col}`;
      const { x, y } = s7FieldUniformPos('player', row, col, anchorX, anchorY, cell, cell, gap);
      const isFront = s7FieldVisualCell('player', row, col).visualRow === 0;
      const isBack = s7FieldVisualCell('player', row, col).visualRow === depth - 1;
      const n = new Node('gc'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      n.addComponent(UITransform).setContentSize(cell, cell);
      const g = n.addComponent(Graphics); // 底/描边由 applyGridStates 按态重画
      const occL = this.mkLabel(n, 0, cell * 0.08, occFs, new Color(230, 238, 250));
      occL.overflow = Label.Overflow.SHRINK; occL.enableWrapText = true; occL.node.getComponent(UITransform)!.setContentSize(cell - 10, cell * 0.5);
      const occSub = this.mkLabel(n, 0, -cell / 2 + subFs + 4, subFs, new Color(150, 175, 205));
      const emptyL = this.mkLabel(n, 0, 0, emptyFs, new Color(90, 105, 130));
      emptyL.string = isFront ? '前排' : isBack ? '后排' : '·'; // 静态·建一次
      n.on(Node.EventType.TOUCH_END, () => this.onTapCell(slot), this);
      this.gridViews.set(slot, { gfx: g, occL, occSub, emptyL, cell });
    }
  }

  /** 状态层：候选卡按 已上阵/选中/可选 重画底与描边、置灰名字、守卫式更新状态行。 */
  private applyPackStates(d: S7DailyPuzzleViewData): void {
    const placedSet = new Set(this.placement.values());
    for (const p of d.candidatePacks) {
      const v = this.packViews.get(p.packId);
      if (!v) continue;
      const placed = placedSet.has(p.packId);
      const selected = this.selectedPackId === p.packId;
      const g = v.gfx;
      g.clear();
      g.fillColor = placed ? new Color(28, 32, 40, 255) : new Color(24, 34, 56, 255);
      g.roundRect(-v.cardW / 2, -v.cardH / 2, v.cardW, v.cardH, 8); g.fill();
      g.lineWidth = selected ? 5 : 2;
      g.strokeColor = selected ? new Color(240, 205, 90, 255) : placed ? new Color(70, 75, 85, 255) : new Color(90, 120, 165, 255);
      g.roundRect(-v.cardW / 2, -v.cardH / 2, v.cardW, v.cardH, 8); g.stroke();
      v.nameL.color = placed ? new Color(120, 125, 135) : new Color(225, 232, 245);
      this.setL(v.statusL, placed ? '已上阵·点格拿回' : selected ? '✓已选·点格放' : '点选');
      v.statusL.color = placed ? new Color(150, 155, 165) : selected ? new Color(240, 205, 90) : new Color(130, 155, 190);
    }
  }

  /** 状态层：摆位格按 占用/空 重画底与描边、切换标签组、守卫式更新占用文本。 */
  private applyGridStates(d: S7DailyPuzzleViewData): void {
    const nameOf = new Map(d.candidatePacks.map((p) => [p.packId, p]));
    this.gridViews.forEach((v, slot) => { // Map 遍历走 forEach（项目铁律：微信构建禁展开/慎迭代 Set/Map·memory cocos-no-spread-set-map）
      const pid = this.placement.get(slot);
      const pack = pid ? nameOf.get(pid) : undefined;
      const g = v.gfx;
      g.clear();
      g.fillColor = pack ? new Color(36, 60, 92, 255) : new Color(22, 28, 42, 255);
      g.roundRect(-v.cell / 2, -v.cell / 2, v.cell, v.cell, 8); g.fill();
      g.lineWidth = 2; g.strokeColor = pack ? new Color(120, 175, 235, 255) : new Color(60, 72, 96, 255);
      g.roundRect(-v.cell / 2, -v.cell / 2, v.cell, v.cell, 8); g.stroke();
      v.occL.node.active = !!pack;
      v.occSub.node.active = !!pack;
      v.emptyL.node.active = !pack;
      if (pack) {
        this.setL(v.occL, pack.shipName);
        this.setL(v.occSub, pack.pilotName);
      }
    });
  }

  private onPickPack(packId: string): void {
    // 已上阵的卡：点了无反应（拿回走"点格"·与旧版行为一致——旧版靠重建时不挂监听实现）。
    if (Array.from(this.placement.values()).includes(packId)) return;
    this.selectedPackId = this.selectedPackId === packId ? null : packId;
    this.refresh();
  }

  private onTapCell(slot: string): void {
    const existing = this.placement.get(slot);
    if (existing) { this.placement.delete(slot); this.selectedPackId = existing; this.refresh(); return; } // 拿回
    const d = this.host.puzzleView();
    if (this.selectedPackId && this.placement.size < d.lineupSize) {
      // 同一包不可放两格（若已在别处·先移过来）。
      for (const [s, pid] of Array.from(this.placement.entries())) if (pid === this.selectedPackId) this.placement.delete(s);
      this.placement.set(slot, this.selectedPackId);
      this.selectedPackId = null;
    }
    this.refresh();
  }

  private onStart(): void {
    const d = this.host.puzzleView();
    if (this.placement.size !== d.lineupSize) { this.notice(`还差 ${d.lineupSize - this.placement.size} 个没摆`); return; }
    const selection = Array.from(this.placement.entries()).map(([slotRef, packId]) => ({ packId, slotRef }));
    this.host.startBattle(selection);
  }

  private devNextPuzzle(): void {
    const ids = this.host.devPuzzleIds();
    if (ids.length === 0) return;
    this.devPickIdx = (this.devPickIdx + 1) % ids.length;
    this.host.devJump(ids[this.devPickIdx]);
  }

  // ===== 小工具（复刻同族 view 灰盒建法·自包含）=====
  /** 守卫式改字：文本没变不重设（Label.string 触发整段重排版·SHRINK 还要多趟测量——增量刷新的省钱点）。 */
  private setL(l: Label, s: string): void { if (l.string !== s) l.string = s; }

  private redrawBtnBg(btn: Node, color: Color): void {
    const g = btn.getComponent(Graphics)!; const t = btn.getComponent(UITransform)!;
    g.clear(); g.fillColor = color; g.roundRect(-t.width / 2, -t.height / 2, t.width, t.height, 10); g.fill();
  }

  private mkLabel(parent: Node, x: number, y: number, fontSize: number, color: Color): Label {
    const n = new Node('t'); n.layer = this.host.layer; parent.addChild(n); n.setPosition(x, y, 0);
    const l = n.addComponent(Label); l.fontSize = fontSize; l.lineHeight = Math.round(fontSize * 1.28); l.color = color;
    return l;
  }

  private mkBtn(parent: Node, text: string, w: number, h: number, color: Color, x: number, y: number, onTap: () => void, fontSize = 28): Node {
    const n = new Node('btn'); n.layer = this.host.layer; parent.addChild(n); n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(w, h);
    const bg = n.addComponent(Graphics); bg.fillColor = color; bg.roundRect(-w / 2, -h / 2, w, h, 10); bg.fill();
    this.mkLabel(n, 0, 0, fontSize, new Color(255, 255, 255)).string = text;
    n.on(Node.EventType.TOUCH_END, onTap, this);
    return n;
  }
}
