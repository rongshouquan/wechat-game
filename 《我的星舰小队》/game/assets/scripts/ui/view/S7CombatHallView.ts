/**
 * 作战大厅 · 容器页 view（第2.5块·块4步2·Ron 2026-07-05 hub 信息架构拍板）。
 *
 * hub 一个建筑入口「作战大厅」，内含两个页签：悬赏板 + 每日推演（未来辅助战斗玩法都进此容器当新页签）。
 * 回廊维持独立入口（不进大厅）。守工作流程⑧：独立 view 文件；不碰悬赏/推演的业务逻辑，只做"页签框 + 挂两子 view"。
 *
 * 结构：顶部 标题「⚔ 作战大厅」+ 左上「返回星港」+ 两页签栏 → 内容区(topY 让给页签栏·两子 view 叠放·切页签 toggle active)。
 * 悬赏子 view 用 hideClose（返回由大厅统一提供）；两子 view 的 bg/触摸吞噬在底层，大厅页签栏/标题后建=在其上层，触摸优先。
 */
import { Node, Label, Color, Graphics, UITransform } from 'cc';
import { getS7UsableBand } from '../S7UiLayout';
import { S7BountyBoardView, S7BountyHost } from './S7BountyBoardView';
import { S7DailyPuzzleView, S7DailyPuzzleHost } from './S7DailyPuzzleView';

export interface S7CombatHallHost {
  readonly layer: number;
  /** 返回星港。 */
  onClose(): void;
}

export type S7CombatHallTab = 'bounty' | 'puzzle';

export class S7CombatHallView {
  private readonly root: Node;
  private readonly bounty: S7BountyBoardView;
  private readonly puzzle: S7DailyPuzzleView;
  private readonly bountyTab: Node;
  private readonly puzzleTab: Node;
  private tab: S7CombatHallTab = 'bounty';

  constructor(
    parent: Node, private readonly host: S7CombatHallHost,
    bountyHost: S7BountyHost, puzzleHost: S7DailyPuzzleHost,
    private readonly W: number, private readonly H: number,
  ) {
    const band = getS7UsableBand();
    const root = new Node('S7CombatHall'); root.layer = host.layer; parent.addChild(root); root.setPosition(0, 0, 0);
    const bg = root.addComponent(Graphics); bg.fillColor = new Color(8, 12, 22, 252); bg.rect(-W / 2, -H / 2, W, H); bg.fill();
    root.addComponent(UITransform).setContentSize(W, H);
    root.on(Node.EventType.TOUCH_END, () => {}, this);
    root.active = false;
    this.root = root;

    // 内容区顶 Y（让出顶部标题 + 页签栏）。两子 view 先建（在底层）。
    const contentTopY = band.usableTopY - 116;
    this.bounty = new S7BountyBoardView(root, bountyHost, W, H, { topY: contentTopY, hideClose: true });
    this.puzzle = new S7DailyPuzzleView(root, puzzleHost, W, H, { topY: contentTopY });

    // 大厅框（标题 + 返回 + 页签栏）后建 → 在子 view 之上，触摸优先。
    this.mkLabel(root, 0, band.usableTopY - 28, 32, new Color(210, 180, 245)).string = '⚔ 作战大厅';
    this.mkBtn(root, '← 返回星港', 168, 56, new Color(120, 90, 160, 255), -this.W * 0.34, band.usableTopY - 28, () => this.host.onClose(), 22);
    const tabY = band.usableTopY - 76;
    this.bountyTab = this.mkBtn(root, '悬赏板', 220, 60, new Color(70, 165, 150, 255), -this.W * 0.24, tabY, () => this.select('bounty'), 26);
    this.puzzleTab = this.mkBtn(root, '每日推演', 220, 60, new Color(120, 150, 210, 255), this.W * 0.24, tabY, () => this.select('puzzle'), 26);
  }

  /** 打开大厅到某页签（缺省=上次页签·战斗返回后回原页签）。 */
  open(tab?: S7CombatHallTab): void {
    if (tab) this.tab = tab;
    this.root.active = true;
    this.applyTab();
  }

  close(): void {
    this.bounty.close();
    this.puzzle.close();
    this.root.active = false;
  }

  get isOpen(): boolean { return this.root.active; }
  get currentTab(): S7CombatHallTab { return this.tab; }

  /** 刷新当前页签内容（战斗返回后·数据现取）。 */
  refreshActive(): void {
    if (this.tab === 'bounty') this.bounty.refresh();
    else this.puzzle.refresh();
  }

  /** 悬赏页一次性提示行（躲避返航等·转发子 view）。 */
  bountyNotice(text: string): void { this.bounty.notice(text); }
  /** 推演页一次性提示行（转发子 view）。 */
  puzzleNotice(text: string): void { this.puzzle.notice(text); }

  private select(tab: S7CombatHallTab): void {
    if (this.tab === tab && this.root.active) return;
    this.tab = tab;
    this.applyTab();
  }

  /** 切换：显示当前页签子 view、隐藏另一个 + 页签高亮。 */
  private applyTab(): void {
    if (this.tab === 'bounty') { this.puzzle.close(); this.bounty.open(); }
    else { this.bounty.close(); this.puzzle.open(); }
    this.redrawBtnBg(this.bountyTab, this.tab === 'bounty' ? new Color(70, 165, 150, 255) : new Color(46, 70, 66, 255));
    this.redrawBtnBg(this.puzzleTab, this.tab === 'puzzle' ? new Color(120, 150, 210, 255) : new Color(52, 62, 82, 255));
  }

  // ===== 小工具（自包含·同族 view 灰盒建法）=====
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
