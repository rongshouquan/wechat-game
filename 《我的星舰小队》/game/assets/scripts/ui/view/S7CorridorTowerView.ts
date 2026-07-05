/**
 * 深空回廊 · 独立全屏塔页 view（第2.5块·块3步2，GDD S10.7 / 附录B B5.2）。
 *
 * 守工作流程⑧：独立 view 文件（不扩 S7DemoController 单体），照 S7BountyBoardView 模式——程序化色块建节点、
 * 按钮 TOUCH_END 直挂、业务逻辑全委托 core/s7/S7DeepCorridor（经宿主接口 S7CorridorHost）。
 *
 * 页面（B5.2·灰盒）：顶部层数牌(当前层+历史最高) → 塔身(当前层高亮大卡 + 上方几层剪影·戏法/回响Boss/里程碑标记)
 *   → 里程碑宝箱区(可开·并排「看广告×2」#10) → 底部 挑战下一层 + 返回 + DEV 跳层行。
 *
 * 交互通则 B0.6 逐条守：①点击当帧刷新(refresh) ②文本锚容器内(SHRINK) ③返回明确(返回星港) ④按钮随语境
 *   (无可开里程碑则不出开箱键) ⑥四态(挑战/开箱可点·锁定给因) ⑦入账回执(控制器飘字) ⑧玩家侧层号从1起
 *   ⑨进行中(战斗交控制器演出) ⑩戏法首见一句话(卡上规则+解法) ⑪DEV隔离(独立DEV行·明显区分) ⑫随停(控制器管)。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';

/** 一层的展示卡（挑战大卡 + 塔身剪影共用）。 */
export interface S7CorridorLayerCard {
  layer: number;
  kind: 'normal' | 'trick' | 'echo_boss';
  /** 标题："第N层" / "第N层 · 戏法：铁甲潮" / "第N层 · 回响Boss：海盗大副"。 */
  title: string;
  /** 规则一句话（戏法/Boss；普通层空）。 */
  ruleText: string;
  /** 解法提示（戏法层；否则空）。 */
  solveHint: string;
  /** 敌情概要（"敌 X" / "Boss 敌阵"）。 */
  enemyBrief: string;
  isMilestone: boolean;
}

/** 一个可开的里程碑宝箱。 */
export interface S7CorridorMilestoneCard {
  layer: number;
  /** 奖励短文案（控制器 gainsText 产出）。 */
  rewardText: string;
}

/** 控制器提供给塔页 view 的宿主接口（数据只读 + 动作回调）。 */
export interface S7CorridorHost {
  readonly layer: number;
  /** 下一层（只能打下一层）。 */
  nextLayer(): number;
  /** 某层的展示卡（当前挑战层 + 上方剪影层）。 */
  layerCard(layer: number): S7CorridorLayerCard;
  /** 当前可开里程碑（升序）。 */
  milestones(): S7CorridorMilestoneCard[];
  /** 挑战下一层（控制器接管：进备战→战斗→结算→回塔）。 */
  challenge(): void;
  /** 开一个里程碑宝箱（普通领取）。 */
  openMilestone(layer: number): void;
  /** 看广告翻倍开箱（广告点位 #10·mock）。 */
  adDoubleMilestone(layer: number): void;
  /** 「开箱×2 📺」键三态（块5 统一收口：每日1次·用尽即隐·券态标「广告券×N」·新手期隐）。 */
  milestoneAdButton(): { visible: boolean; label: string };
  /** 返回星港。 */
  onClose(): void;
  /** DEV 跳层：把已通最高层拨到 targetLayer-1（下一层=targetLayer）。上线前删。 */
  devJump(targetLayer: number): void;
  /** DEV 跳到下一个「孤胆英雄」层（深层专属·验收用·控制器扫描）。上线前删。 */
  devJumpLone(): void;
}

const KIND_MARK: Record<string, string> = { normal: '·', trick: '⚔', echo_boss: '👑' };

export class S7CorridorTowerView {
  private readonly root: Node;
  private readonly headerLabel: Label;
  private readonly bodyNode: Node;      // 塔身（挑战大卡 + 剪影 + 里程碑）
  private readonly noticeLabel: Label;  // 一次性提示行（refresh 清）
  private readonly bodyTopY: number;
  private readonly bodyBottomY: number;

  constructor(parent: Node, private readonly host: S7CorridorHost, private readonly W: number, private readonly H: number) {
    const band = getS7UsableBand();
    const root = new Node('S7CorridorTower'); root.layer = host.layer; parent.addChild(root); root.setPosition(0, 0, 0);
    const bg = root.addComponent(Graphics); bg.fillColor = new Color(6, 10, 22, 252); bg.rect(-W / 2, -H / 2, W, H); bg.fill();
    root.addComponent(UITransform).setContentSize(W, H);
    root.on(Node.EventType.TOUCH_END, () => {}, this); // 吞空白触摸（满屏浮层·只用按钮离开）
    root.active = false;
    this.root = root;

    this.headerLabel = this.mkLabel(root, 0, band.usableTopY - 42, 38, new Color(170, 200, 245));
    this.noticeLabel = this.mkLabel(root, 0, band.usableTopY - 84, 22, new Color(180, 225, 195));

    const body = new Node('body'); body.layer = host.layer; root.addChild(body); body.setPosition(0, 0, 0);
    this.bodyNode = body;
    this.bodyTopY = band.usableTopY - 108;
    this.bodyBottomY = band.usableBottomY + 232;

    // 底部固定：挑战大钮 + 返回 + DEV 行。巡检批 #15：三行热区各留 ≥8px（原 返回×挑战 5px·DEV×返回 重叠 2px 且 DEV 越出安全区下沿）。
    this.mkBtn(root, '⚔ 挑战下一层', 340, 86, new Color(235, 170, 50, 255), 0, band.usableBottomY + 176, () => this.host.challenge(), 32);
    this.mkBtn(root, '返回星港', 200, 64, new Color(120, 90, 160, 255), 0, band.usableBottomY + 92, () => this.host.onClose(), 28);
    // DEV 行（明显区分·上线前整行删）。
    const devY = band.usableBottomY + 26;
    this.mkBtn(root, 'DEV跳戏法', 150, 44, new Color(70, 70, 78, 255), -W * 0.34, devY, () => this.devJumpKind('trick'), 20);
    this.mkBtn(root, 'DEV跳Boss', 150, 44, new Color(70, 70, 78, 255), -W * 0.12, devY, () => this.devJumpKind('boss'), 20);
    this.mkBtn(root, 'DEV跳孤胆', 150, 44, new Color(70, 70, 78, 255), W * 0.12, devY, () => this.host.devJumpLone(), 20);
    this.mkBtn(root, 'DEV+25层', 150, 44, new Color(70, 70, 78, 255), W * 0.34, devY, () => this.host.devJump(this.host.nextLayer() + 25), 20);
  }

  open(): void { this.refresh(); this.root.active = true; }
  close(): void { this.root.active = false; }
  get isOpen(): boolean { return this.root.active; }
  /** 一次性提示行（如"第N层里程碑已解锁·可开箱"）：显示到下次 refresh 自动清。 */
  notice(text: string): void { this.noticeLabel.string = text; }

  /** 重刷：层数牌 + 挑战大卡 + 上方剪影 + 里程碑宝箱区。数据每次从 host 现取（战斗返回后自动反映）。 */
  refresh(): void {
    const next = this.host.nextLayer();
    this.headerLabel.string = `🗼 深空回廊 · 下一层 第 ${next} 层`;
    this.noticeLabel.string = '';
    this.bodyNode.removeAllChildren();

    let y = this.bodyTopY;
    // 上方剪影（未到的更高层·暗·带标记，让玩家看到前方戏法/Boss/里程碑）。
    for (let i = 3; i >= 1; i -= 1) {
      const L = next + i;
      const c = this.host.layerCard(L);
      const mark = KIND_MARK[c.kind] + (c.isMilestone ? '🎁' : '');
      this.mkLabel(this.bodyNode, 0, y, 22, new Color(110, 125, 155)).string = `┈ 第 ${L} 层 ${mark} ${c.kind === 'trick' ? c.title.split('：')[1] ?? '戏法' : c.kind === 'echo_boss' ? '回响Boss' : ''}`;
      y -= 34;
    }
    // 当前挑战层大卡（高亮）。
    y -= 8;
    this.buildChallengeCard(this.host.layerCard(next), y);
    y -= 150;

    // 里程碑宝箱区。
    const ms = this.host.milestones();
    this.mkLabel(this.bodyNode, 0, y, 26, new Color(240, 205, 90)).string = ms.length > 0 ? '🎁 里程碑宝箱（可积攒·手动开）' : '🎁 里程碑：每 5 层攒一个，通到就来开';
    y -= 40;
    for (const m of ms.slice(0, 4)) { // 灰盒最多列 4 个，多了滚动留美术阶段
      this.buildMilestoneRow(m, y);
      y -= 66;
    }
    if (ms.length > 4) {
      this.mkLabel(this.bodyNode, 0, y, 20, new Color(150, 165, 195)).string = `… 还有 ${ms.length - 4} 个里程碑可开`;
    }
  }

  /** 当前挑战层大卡：标题 + 规则/解法 + 敌情。 */
  private buildChallengeCard(card: S7CorridorLayerCard, cy: number): void {
    const w = this.W * 0.9, h = 132;
    const row = new Node('cur'); row.layer = this.host.layer; this.bodyNode.addChild(row); row.setPosition(0, cy, 0);
    row.addComponent(UITransform).setContentSize(w, h);
    const g = row.addComponent(Graphics);
    const edge = card.kind === 'echo_boss' ? new Color(205, 90, 205, 255) : card.kind === 'trick' ? new Color(150, 120, 235, 255) : new Color(90, 150, 210, 255);
    g.fillColor = new Color(20, 28, 48, 255); g.roundRect(-w / 2, -h / 2, w, h, 14); g.fill();
    g.lineWidth = 5; g.strokeColor = edge; g.roundRect(-w / 2, -h / 2, w, h, 14); g.stroke();

    const title = new Node('t'); title.layer = this.host.layer; row.addChild(title); title.setPosition(0, h / 2 - 30, 0);
    const tl = title.addComponent(Label); tl.fontSize = 30; tl.color = new Color(235, 230, 250);
    tl.overflow = Label.Overflow.SHRINK; tl.enableWrapText = false;
    title.getComponent(UITransform)!.setContentSize(w - 40, 40);
    tl.string = `${card.title}${card.isMilestone ? '  🎁里程碑' : ''}`;

    const info = new Node('i'); info.layer = this.host.layer; row.addChild(info); info.setPosition(0, -14, 0);
    const il = info.addComponent(Label); il.fontSize = 22; il.lineHeight = 28; il.color = new Color(200, 210, 235);
    il.overflow = Label.Overflow.SHRINK; il.enableWrapText = true;
    info.getComponent(UITransform)!.setContentSize(w - 44, h - 60);
    const ruleLine = card.ruleText ? `规则：${card.ruleText}` : '常规层 · 战力检查';
    const hintLine = card.solveHint ? `\n解法：${card.solveHint}` : '';
    il.string = `${ruleLine}   ｜   ${card.enemyBrief}${hintLine}`;
  }

  /** 一个里程碑宝箱行：奖励文案 + 「开箱」 + 「开箱×2 📺」（块5 三态：每日已用&无券→广告键不出现·非置灰）。 */
  private buildMilestoneRow(m: S7CorridorMilestoneCard, cy: number): void {
    const rowW = this.W * 0.9;
    const ad = this.host.milestoneAdButton();
    const label = this.mkLabel(this.bodyNode, -rowW / 2 + 8, cy, 20, new Color(235, 220, 170));
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    label.node.getComponent(UITransform)!.setContentSize(ad.visible ? rowW * 0.52 : rowW * 0.66, 56);
    label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true;
    label.string = `第${m.layer}层：${m.rewardText}`;
    // 巡检批 #15：广告键在场时「开箱」左移+双键缩窄——原两键热区重叠 27px → 间距 10px。
    this.mkBtn(this.bodyNode, '开箱', 110, 56, new Color(90, 160, 110, 255), rowW / 2 - (ad.visible ? 232 : 68), cy, () => this.host.openMilestone(m.layer), 24);
    if (ad.visible) {
      const btn = this.mkBtn(this.bodyNode, ad.label, 160, 56, new Color(215, 155, 55, 255), rowW / 2 - 87, cy, () => this.host.adDoubleMilestone(m.layer), 18);
      // 券态文案（「…｜广告券×N」）变长：锚进按钮内框、超长缩字（B0.6 #2）。
      const al = btn.getComponentInChildren(Label);
      if (al) {
        let lt = al.node.getComponent(UITransform);
        if (!lt) lt = al.node.addComponent(UITransform);
        lt.setContentSize(146, 48);
        al.overflow = Label.Overflow.SHRINK;
        al.enableWrapText = false;
      }
    }
  }

  /** DEV：跳到下一个戏法层(10 的倍数非25) / 回响Boss层(25 的倍数)。 */
  private devJumpKind(kind: 'trick' | 'boss'): void {
    const next = this.host.nextLayer();
    if (kind === 'boss') { this.host.devJump(Math.ceil(next / 25) * 25); return; }
    let t = Math.ceil(next / 10) * 10;
    if (t < next) t += 10;
    while (t % 25 === 0) t += 10; // 跳过 Boss 层（Boss 优先·非戏法层）
    this.host.devJump(t);
  }

  // ===== 小工具（复刻 S7BountyBoardView/S7DemoController 灰盒建法·自包含）=====
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
