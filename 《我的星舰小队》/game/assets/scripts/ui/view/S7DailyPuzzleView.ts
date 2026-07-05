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
 * 交互通则 B0.6 逐条守：①点击当帧刷新 ②文本锚容器内 SHRINK ③返回明确(大厅提供) ④按钮随语境(未满5不可开打)
 *   ⑥四态(选中高亮/已上阵置灰) ⑦入账回执(控制器飘字) ⑧玩家侧题号从1起 ⑩新内容一句话(威胁提示) ⑪DEV隔离 ⑫随停(控制器管)。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';

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

/** 我方 3×3 九格（p{0-2}c{0-2}·c0=后排 c2=前排，与引擎一致）。 */
const PLAYER_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) out.push(`p${r}c${c}`);
  return out;
})();

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

  /** 选摆瞬态（UI 状态·不入档）：slotRef→packId + 当前选中待放的包。 */
  private placement = new Map<string, string>();
  private selectedPackId: string | null = null;
  /** 当前题号（换题时清选摆）。 */
  private placedForPuzzle = '';
  private devPickIdx = 0;

  constructor(
    parent: Node, private readonly host: S7DailyPuzzleHost, private readonly W: number, private readonly H: number,
    opts: { topY?: number } = {},
  ) {
    const band = getS7UsableBand();
    this.topY = opts.topY ?? band.usableTopY;
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

  /** 重刷：题头 + 威胁 + 敌阵沙盘 + 候选包横排 + 3×3 选摆 + 开打态。换题清选摆；同题保留（败后可微调再试）。 */
  refresh(): void {
    const d = this.host.puzzleView();
    this.bodyNode.removeAllChildren();
    if (d.locked) {
      this.headerLabel.string = '🧩 每日推演';
      this.subLabel.string = '';
      this.hintLabel.string = '';
      this.noticeLabel.string = '';
      this.startBtn.active = false;
      this.mkLabel(this.bodyNode, 0, this.topY - 200, 26, new Color(200, 180, 130)).string = `🔒 ${d.lockedText ?? '暂未解锁'}`;
      return;
    }
    this.startBtn.active = true;
    if (d.puzzleId !== this.placedForPuzzle) { this.placement.clear(); this.selectedPackId = null; this.placedForPuzzle = d.puzzleId; }
    // 清掉已不在候选里的选摆（防御：换题/脏态）。
    const packIds = new Set(d.candidatePacks.map((p) => p.packId));
    for (const [slot, pid] of Array.from(this.placement.entries())) if (!packIds.has(pid)) this.placement.delete(slot);
    if (this.selectedPackId && !packIds.has(this.selectedPackId)) this.selectedPackId = null;

    this.headerLabel.string = `🧩 ${d.title}`;
    this.subLabel.string = d.subtitle;
    this.hintLabel.string = `⚠ ${d.threatHint}`;
    this.noticeLabel.string = d.solved
      ? `🎉 今日已解 · 奖励 ${d.solvedRewardText} · 明日再会（可重温·不重复发奖）`
      : this.selectedPackId
        ? `已选中一个战队包 —— 点下方九宫格空位放上去`
        : `点候选包选中 → 点九宫格摆位 · 已摆 ${this.placement.size}/${d.lineupSize}（点已摆的格可拿回）`;

    let y = this.topY - 158;
    // 敌阵沙盘（缩略）。
    this.mkLabel(this.bodyNode, 0, y, 20, new Color(200, 150, 150)).string = '── 敌阵沙盘（威胁高亮）──';
    y -= 26;
    this.buildEnemySandbox(d.enemyCells, y);
    y -= 150;
    // 候选战队包横排。
    this.mkLabel(this.bodyNode, 0, y, 20, new Color(150, 200, 220)).string = `── 候选战队包（选 ${d.lineupSize} 个·归一 C 阶 Lv10）──`;
    y -= 26;
    this.buildCandidateRow(d.candidatePacks, y);
    y -= 132;
    // 我方 3×3 选摆。
    this.mkLabel(this.bodyNode, 0, y, 20, new Color(150, 220, 180)).string = '── 我方摆位（c0=后排 · c2=前排）──';
    y -= 20;
    this.buildPlayerGrid(d.candidatePacks, y);

    // 开打态：满 5 才可开（未满置灰·B0.6 ④⑥）。
    const ready = this.placement.size === d.lineupSize;
    this.startLabel.string = ready ? '开始推演' : `再摆 ${d.lineupSize - this.placement.size} 个`;
    this.redrawBtnBg(this.startBtn, ready ? new Color(235, 170, 50, 255) : new Color(90, 90, 96, 255));
  }

  /** 敌阵沙盘：5 行 × 7 列缩略网格，只画被占用格（威胁高亮）。列越大越深（c6 最深后排）。 */
  private buildEnemySandbox(cells: readonly S7PuzzleEnemyCell[], topCy: number): void {
    const cw = Math.min(38, (this.W * 0.9) / 7), ch = 26, gap = 3;
    const gridW = 7 * (cw + gap) - gap, gridH = 5 * (ch + gap) - gap;
    const x0 = -gridW / 2 + cw / 2, y0 = topCy - ch / 2;
    // 底板框。
    const frame = new Node('efrm'); frame.layer = this.host.layer; this.bodyNode.addChild(frame); frame.setPosition(0, topCy - gridH / 2, 0);
    const fg = frame.addComponent(Graphics); fg.fillColor = new Color(16, 20, 32, 255); fg.roundRect(-gridW / 2 - 8, -gridH / 2 - 8, gridW + 16, gridH + 16, 8); fg.fill();
    const occ = new Map(cells.map((c) => [c.slotRef, c]));
    for (let r = 0; r < 5; r += 1) for (let c = 0; c < 7; c += 1) {
      const cell = occ.get(`r${r}c${c}`);
      const x = x0 + c * (cw + gap), y = y0 - r * (ch + gap);
      const n = new Node('ec'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      const g = n.addComponent(Graphics);
      g.fillColor = cell ? (cell.threat ? new Color(200, 70, 70, 255) : new Color(120, 80, 80, 255)) : new Color(30, 36, 50, 255);
      g.roundRect(-cw / 2, -ch / 2, cw, ch, 4); g.fill();
      if (cell) this.mkLabel(n, 0, 0, 16, new Color(255, 255, 255)).string = cell.mark;
    }
  }

  /** 候选战队包横排（分行铺·点选高亮·已上阵置灰）。 */
  private buildCandidateRow(packs: readonly S7PuzzlePackView[], topCy: number): void {
    const perRow = 4;
    const cardW = Math.min(174, (this.W * 0.94) / perRow - 8), cardH = 108, gap = 8;
    const placedPacks = new Set(this.placement.values());
    packs.forEach((p, i) => {
      const rowN = Math.floor(i / perRow), col = i % perRow;
      const rowCount = Math.min(perRow, packs.length - rowN * perRow);
      const rowW = rowCount * (cardW + gap) - gap;
      const x = -rowW / 2 + cardW / 2 + col * (cardW + gap);
      const y = topCy - rowN * (cardH + 10);
      const placed = placedPacks.has(p.packId);
      const selected = this.selectedPackId === p.packId;
      const n = new Node('pk'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      n.addComponent(UITransform).setContentSize(cardW, cardH);
      const g = n.addComponent(Graphics);
      g.fillColor = placed ? new Color(28, 32, 40, 255) : new Color(24, 34, 56, 255);
      g.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 8); g.fill();
      g.lineWidth = selected ? 5 : 2;
      g.strokeColor = selected ? new Color(240, 205, 90, 255) : placed ? new Color(70, 75, 85, 255) : new Color(90, 120, 165, 255);
      g.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 8); g.stroke();
      const nameL = this.mkLabel(n, 0, cardH / 2 - 20, 20, placed ? new Color(120, 125, 135) : new Color(225, 232, 245));
      nameL.overflow = Label.Overflow.SHRINK; nameL.enableWrapText = false; nameL.node.getComponent(UITransform)!.setContentSize(cardW - 12, 24);
      nameL.string = `${p.shipName}·${p.pilotName}`;
      this.mkLabel(n, 0, cardH / 2 - 46, 16, new Color(150, 180, 150)).string = `[${p.posType}]`;
      if (p.extra) {
        const ex = this.mkLabel(n, 0, -cardH / 2 + 30, 15, new Color(200, 180, 120));
        ex.overflow = Label.Overflow.SHRINK; ex.enableWrapText = true; ex.node.getComponent(UITransform)!.setContentSize(cardW - 12, 30);
        ex.string = p.extra;
      }
      this.mkLabel(n, 0, -cardH / 2 + 12, 15, placed ? new Color(150, 155, 165) : selected ? new Color(240, 205, 90) : new Color(130, 155, 190))
        .string = placed ? '已上阵（点九宫格拿回）' : selected ? '✓ 已选·点格子放' : '点选';
      if (!placed) n.on(Node.EventType.TOUCH_END, () => this.onPickPack(p.packId), this);
    });
  }

  /** 我方 3×3 选摆格：点空位放当前选中包、点已放格拿回。 */
  private buildPlayerGrid(packs: readonly S7PuzzlePackView[], topCy: number): void {
    const nameOf = new Map(packs.map((p) => [p.packId, p]));
    const cell = 96, gap = 10;
    const gridW = 3 * (cell + gap) - gap;
    const x0 = -gridW / 2 + cell / 2, y0 = topCy - cell / 2;
    PLAYER_SLOTS.forEach((slot) => {
      const r = Number(slot[1]), c = Number(slot[3]);
      const x = x0 + c * (cell + gap), y = y0 - r * (cell + gap);
      const pid = this.placement.get(slot);
      const pack = pid ? nameOf.get(pid) : undefined;
      const n = new Node('gc'); n.layer = this.host.layer; this.bodyNode.addChild(n); n.setPosition(x, y, 0);
      n.addComponent(UITransform).setContentSize(cell, cell);
      const g = n.addComponent(Graphics);
      g.fillColor = pack ? new Color(36, 60, 92, 255) : new Color(22, 28, 42, 255);
      g.roundRect(-cell / 2, -cell / 2, cell, cell, 8); g.fill();
      g.lineWidth = 2; g.strokeColor = pack ? new Color(120, 175, 235, 255) : new Color(60, 72, 96, 255);
      g.roundRect(-cell / 2, -cell / 2, cell, cell, 8); g.stroke();
      if (pack) {
        const l = this.mkLabel(n, 0, 6, 17, new Color(230, 238, 250));
        l.overflow = Label.Overflow.SHRINK; l.enableWrapText = true; l.node.getComponent(UITransform)!.setContentSize(cell - 10, cell - 24);
        l.string = pack.shipName;
        this.mkLabel(n, 0, -cell / 2 + 14, 14, new Color(150, 175, 205)).string = pack.pilotName;
      } else {
        this.mkLabel(n, 0, 0, 16, new Color(90, 105, 130)).string = c === 0 ? '后排' : c === 2 ? '前排' : '·';
      }
      n.on(Node.EventType.TOUCH_END, () => this.onTapCell(slot), this);
    });
  }

  private onPickPack(packId: string): void {
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
