/**
 * 星港悬赏板 · 独立全屏 view（第2.5块·块2，GDD S10.8 / 附录B B5.1）。
 *
 * 守工作流程⑧：这是**首个 S7 独立 view 文件**（不再扩 S7DemoController 单体）。表现层灰盒——程序化色块建节点、
 * 按钮 TOUCH_END 直挂（cc 自动派发，无需控制器路由触摸）；业务逻辑全委托 core/s7/S7StarportBounty + S7CommissionAffix。
 *
 * 页面（附录B B5.1 重写版·悬赏板）：顶部说明行(星域档+每天4点刷) + 积压行 + 悬赏卡列表(分页) + 返回。
 * 每张卡：主题(护航/演习)×品质(铜/银/金)徽标 + **词缀全文**(卡面全可见·GDD S10.8 rule⑥) + 产出预览 + 出战键。
 * 出战 → host.playCard(cardId)（控制器跑：主线同款备战→真打→结算→遇袭→单键返回本板）。
 *
 * 灰盒简化：分页(非拖动滚动·避免拖/点冲突)；主题/品质用色块区分(护航航道蓝/演习训练绿·铜银金描边)，真实涂装留美术阶段。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';
import {
  S7BountyState, S7BountyCard, bountyBoardCap, bountyCardRewards,
} from '../../core/s7/S7StarportBounty';
import { S7CommissionAffixDef } from '../../core/s7/S7CommissionAffix';

/** 控制器提供给悬赏板 view 的宿主接口（数据只读 + 动作回调）。 */
export interface S7BountyHost {
  readonly layer: number;
  bountyState(): S7BountyState;
  affixDefs(): readonly S7CommissionAffixDef[];
  /** 已通关最高星域档（产出预览/难度缩放）。 */
  starfieldTier(): number;
  habitatLevel(): number;
  /** 复用控制器的"货币表→短文案"。 */
  gainsText(rewards: Record<string, number>): string;
  /** 出战一张卡（控制器接管 备战→战斗→结算→遇袭→返回）。 */
  playCard(cardId: string): void;
  /** 返回星港。 */
  onClose(): void;
}

const THEME_LABEL: Record<string, string> = { escort: '护航', drill: '演习' };
const QUALITY_LABEL: Record<string, string> = { bronze: '铜', silver: '银', gold: '金' };
const THEME_COLOR: Record<string, Color> = {
  escort: new Color(46, 92, 140, 255), // 星门航道蓝
  drill: new Color(46, 128, 108, 255), // 全息训练绿
};
const QUALITY_EDGE: Record<string, Color> = {
  bronze: new Color(175, 125, 80, 255), silver: new Color(190, 200, 215, 255), gold: new Color(240, 200, 75, 255),
};

const CARDS_PER_PAGE = 5;

export class S7BountyBoardView {
  private readonly root: Node;
  private readonly listNode: Node;
  private readonly headerLabel: Label;
  private readonly backlogLabel: Label;
  private readonly pageLabel: Label;
  private readonly prevBtn: Node;
  private readonly nextBtn: Node;
  private page = 0;
  private readonly listTopY: number;
  private readonly rowH: number;

  constructor(parent: Node, private readonly host: S7BountyHost, private readonly W: number, private readonly H: number) {
    const band = getS7UsableBand();
    const root = new Node('S7BountyBoard'); root.layer = host.layer; parent.addChild(root); root.setPosition(0, 0, 0);
    const bg = root.addComponent(Graphics); bg.fillColor = new Color(8, 12, 24, 252); bg.rect(-W / 2, -H / 2, W, H); bg.fill();
    root.addComponent(UITransform).setContentSize(W, H);
    root.on(Node.EventType.TOUCH_END, () => {}, this); // 吞空白触摸（满屏浮层·只用「返回」离开）
    root.active = false;
    this.root = root;

    const title = this.mkLabel(root, 0, band.usableTopY - 44, 40, new Color(150, 220, 200));
    this.headerLabel = title;
    this.backlogLabel = this.mkLabel(root, 0, band.usableTopY - 92, 24, new Color(195, 210, 235));

    const list = new Node('list'); list.layer = host.layer; root.addChild(list); list.setPosition(0, 0, 0);
    this.listNode = list;
    this.listTopY = band.usableTopY - 140;
    const listBottomY = band.usableBottomY + 150;
    this.rowH = Math.min(230, (this.listTopY - listBottomY) / CARDS_PER_PAGE);

    // 分页行（仅多页时显示）
    this.prevBtn = this.mkBtn(root, '◀ 上一页', 200, 68, new Color(80, 100, 150, 255), -W * 0.26, band.usableBottomY + 132, () => this.turn(-1), 26);
    this.pageLabel = this.mkLabel(root, 0, band.usableBottomY + 132, 26, new Color(200, 210, 230));
    this.nextBtn = this.mkBtn(root, '下一页 ▶', 200, 68, new Color(80, 100, 150, 255), W * 0.26, band.usableBottomY + 132, () => this.turn(1), 26);

    this.mkBtn(root, '返回星港', 260, 84, new Color(120, 90, 160, 255), 0, band.usableBottomY + 48, () => this.host.onClose(), 30);
  }

  open(): void { this.page = 0; this.refresh(); this.root.active = true; }
  close(): void { this.root.active = false; }
  get isOpen(): boolean { return this.root.active; }

  /** 重刷：说明行 + 积压行 + 当前页卡片 + 分页控件。数据每次从 host 现取（出战返回后自动反映消耗）。 */
  refresh(): void {
    const st = this.host.bountyState();
    const tier = this.host.starfieldTier();
    const cap = bountyBoardCap(this.host.habitatLevel());
    // 档位玩家侧从 1 起显示（内部 tier 0 起数是"已通关星域数"·真机④：别把程序员的 0 亮给玩家）。
    this.headerLabel.string = `📋 星港悬赏板 · 星域档 ${tier + 1} · 每天凌晨4点刷新`;
    this.backlogLabel.string = `板上 ${st.cards.length} / ${cap} 张 —— 没做的攒着，星港帮你留（不催办）`;

    const pages = Math.max(1, Math.ceil(st.cards.length / CARDS_PER_PAGE));
    if (this.page >= pages) this.page = pages - 1;
    if (this.page < 0) this.page = 0;

    this.listNode.removeAllChildren();
    const start = this.page * CARDS_PER_PAGE;
    const slice = st.cards.slice(start, start + CARDS_PER_PAGE);
    if (slice.length === 0) {
      this.mkLabel(this.listNode, 0, this.listTopY - this.rowH * 1.5, 28, new Color(150, 165, 195)).string = '今天的悬赏都办完啦 —— 明早4点再来';
    }
    slice.forEach((card, i) => this.buildCardRow(card, tier, st.goldPhysicalCount, this.listTopY - this.rowH * (i + 0.5)));

    const multi = pages > 1;
    this.prevBtn.active = multi; this.nextBtn.active = multi;
    this.pageLabel.node.active = multi;
    this.pageLabel.string = multi ? `第 ${this.page + 1} / ${pages} 页` : '';
  }

  private turn(dir: number): void { this.page += dir; this.refresh(); }

  /** 一张卡：左=主题×品质徽标；中=词缀全文+产出预览；右=出战键。 */
  private buildCardRow(card: S7BountyCard, tier: number, goldIndex: number, cy: number): void {
    const rowW = this.W * 0.92, rowH = this.rowH - 12;
    const row = new Node('card'); row.layer = this.host.layer; this.listNode.addChild(row); row.setPosition(0, cy, 0);
    row.addComponent(UITransform).setContentSize(rowW, rowH);
    const g = row.addComponent(Graphics);
    g.fillColor = new Color(18, 26, 44, 255); g.roundRect(-rowW / 2, -rowH / 2, rowW, rowH, 12); g.fill();
    g.lineWidth = 5; g.strokeColor = QUALITY_EDGE[card.quality]; g.roundRect(-rowW / 2, -rowH / 2, rowW, rowH, 12); g.stroke();

    // 左：主题×品质徽标色块
    const badge = new Node('bg'); badge.layer = this.host.layer; row.addChild(badge); badge.setPosition(-rowW / 2 + 78, 0, 0);
    const bgG = badge.addComponent(Graphics); bgG.fillColor = THEME_COLOR[card.theme]; bgG.roundRect(-64, -rowH / 2 + 16, 128, rowH - 32, 10); bgG.fill();
    this.mkLabel(badge, 0, 22, 30, new Color(255, 255, 255)).string = THEME_LABEL[card.theme];
    this.mkLabel(badge, 0, -20, 26, QUALITY_EDGE[card.quality]).string = `${QUALITY_LABEL[card.quality]}卡`;

    // 中：词缀全文 + 产出预览——**锚定进卡片内容区**（真机①修复：原中心锚+无内容框导致文本悬出卡外/被截断）。
    // 内容框 = 徽标右缘(-rowW/2+142)到出战键左缘(rowW/2-171)之间；左缘锚点(0,0.5) + SHRINK 自动缩排版，
    // 银2条/金3条词缀+产出行在窄屏下也保证收进框内（超长自动缩字号，灰盒可接受）。
    const defs = this.host.affixDefs();
    const affixText = card.affixIds
      .map((id) => defs.find((d) => d.rowId === id)?.effectText ?? id)
      .map((t) => `· ${t}`)
      .join('\n');
    const rewards = bountyCardRewards(card, tier, false, goldIndex);
    const perfectHint = card.theme === 'escort' ? '｜满血护航+25%' : '';
    const midX = -rowW / 2 + 150;
    const midW = rowW - 327; // = (rowW/2-177) - midX：右侧给出战键(左缘 rowW/2-171)留 6
    const mid = new Node('mid'); mid.layer = this.host.layer; row.addChild(mid); mid.setPosition(midX, 0, 0);
    const midL = mid.addComponent(Label);
    midL.fontSize = 20; midL.lineHeight = 26; midL.color = new Color(210, 220, 240);
    midL.horizontalAlign = Label.HorizontalAlign.LEFT;
    midL.verticalAlign = Label.VerticalAlign.CENTER;
    midL.overflow = Label.Overflow.SHRINK;
    midL.enableWrapText = true;
    const mut = mid.getComponent(UITransform)!;
    mut.setAnchorPoint(0, 0.5);
    mut.setContentSize(midW, rowH - 20);
    midL.string = `${affixText || '· （无词缀）'}\n产出 ${this.host.gainsText(rewards)}${perfectHint}`;

    // 右：出战键
    this.mkBtn(row, '出战', 150, 74, new Color(235, 170, 50, 255), rowW / 2 - 96, 0, () => this.host.playCard(card.id), 30);
  }

  // ===== 小工具（复刻 S7DemoController.addBtn/mkLabel 同款灰盒建法·自包含）=====
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
