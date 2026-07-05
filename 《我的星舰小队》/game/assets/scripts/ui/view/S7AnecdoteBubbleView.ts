/**
 * 星港趣事 · 小弹泡 view（第2.5块·块5，GDD S10.10 / 附录B B1.1）。
 *
 * 守工作流程⑧：独立 view 文件（不扩 S7DemoController 单体），照 S7CorridorTowerView 模式——程序化色块建节点。
 * 定位（S10.10）：**零广告零红点、不打断操作**的轻浮层（L2）——不锁全屏、不吞别处触摸，
 *   只有弹泡本体可点、**点一下收下即走**；内容=占位 emoji 头像 + 1-2 句趣话 + 微量奖励入账回执。
 * 展示/入账时序由控制器管（先入账+记"今日已展示"再 show）；本 view 纯展示壳。
 * 灰盒：色块圆角泡 + emoji 文本；真实居民 Q 版头像/弹泡演出留美术阶段。
 *
 * 交互通则 B0.6：①点击当帧收起 ②文本 SHRINK 锚容器内 ③点弹泡本体即关（单一出口）⑦入账回执行 ⑫控制器管随停。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';

export class S7AnecdoteBubbleView {
  private readonly root: Node;
  private readonly avatarLabel: Label;
  private readonly speakerLabel: Label;
  private readonly textLabel: Label;
  private readonly rewardLabel: Label;

  constructor(parent: Node, W: number, H: number) {
    void H;
    const band = getS7UsableBand();
    const bw = W * 0.88, bh = 168;
    const root = new Node('S7AnecdoteBubble');
    root.layer = parent.layer;
    parent.addChild(root);
    // 泡挂上部（货币条下方·不占决策热区）；不铺全屏遮罩=不打断别处操作。
    root.setPosition(0, band.usableTopY - 210, 0);
    root.addComponent(UITransform).setContentSize(bw, bh);
    const g = root.addComponent(Graphics);
    g.fillColor = new Color(38, 46, 66, 245);
    g.roundRect(-bw / 2, -bh / 2, bw, bh, 22);
    g.fill();
    g.lineWidth = 3;
    g.strokeColor = new Color(150, 190, 240, 255);
    g.roundRect(-bw / 2, -bh / 2, bw, bh, 22);
    g.stroke();
    root.on(Node.EventType.TOUCH_END, () => this.close(), this); // 点掉即走（只有泡本体可点·别处不受影响）
    root.active = false;
    this.root = root;

    // 左侧占位头像（emoji 大字·真头像留美术）。
    const av = new Node('avatar'); av.layer = parent.layer; root.addChild(av); av.setPosition(-bw / 2 + 62, 8, 0);
    this.avatarLabel = av.addComponent(Label);
    this.avatarLabel.fontSize = 56; this.avatarLabel.lineHeight = 60;

    // 说话人显示名（巡检批·正式池：驾驶员名/居民职业名·种子叙述体空着不占位感）。
    const sp = new Node('speaker'); sp.layer = parent.layer; root.addChild(sp); sp.setPosition(52, 56, 0);
    this.speakerLabel = sp.addComponent(Label);
    this.speakerLabel.fontSize = 20; this.speakerLabel.lineHeight = 26; this.speakerLabel.color = new Color(255, 220, 140);
    this.speakerLabel.overflow = Label.Overflow.SHRINK; this.speakerLabel.enableWrapText = false;
    sp.addComponent(UITransform).setContentSize(bw - 150, 28);

    // 趣话正文（锚定内容框·SHRINK 防溢出）。
    const tx = new Node('text'); tx.layer = parent.layer; root.addChild(tx); tx.setPosition(52, 4, 0);
    this.textLabel = tx.addComponent(Label);
    this.textLabel.fontSize = 22; this.textLabel.lineHeight = 30; this.textLabel.color = new Color(230, 238, 250);
    this.textLabel.overflow = Label.Overflow.SHRINK; this.textLabel.enableWrapText = true;
    tx.addComponent(UITransform).setContentSize(bw - 150, 72);

    // 奖励回执 + 收下提示。
    const rw = new Node('reward'); rw.layer = parent.layer; root.addChild(rw); rw.setPosition(52, -52, 0);
    this.rewardLabel = rw.addComponent(Label);
    this.rewardLabel.fontSize = 20; this.rewardLabel.lineHeight = 26; this.rewardLabel.color = new Color(255, 232, 150);
    this.rewardLabel.overflow = Label.Overflow.SHRINK; this.rewardLabel.enableWrapText = false;
    rw.addComponent(UITransform).setContentSize(bw - 150, 30);
  }

  get isOpen(): boolean { return this.root.active; }

  /** 弹一条趣事（奖励已由控制器入账·此处只展示）。speaker=显示名（空串=叙述体不署名）。 */
  show(avatar: string, speaker: string, text: string, rewardText: string): void {
    this.avatarLabel.string = avatar;
    this.speakerLabel.string = speaker;
    this.textLabel.string = text;
    this.rewardLabel.string = rewardText ? `${rewardText} 已入账 · 点一下收好` : '点一下收好';
    const parent = this.root.parent;
    if (parent) this.root.setSiblingIndex(parent.children.length - 1); // 置顶（轻浮层·不遮挡也别被埋）
    this.root.active = true;
  }

  close(): void { this.root.active = false; }
}
