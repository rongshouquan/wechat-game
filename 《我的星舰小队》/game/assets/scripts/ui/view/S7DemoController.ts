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
import { S7MainlineModel, createDefaultS7MainlineProgress } from '../../core/s7/S7MainlineProgress';
import { S7RunSession } from '../../core/s7/S7RunSession';

const { ccclass } = _decorator;

/** 固定开发种子：同节点同阵容可复现（早期节点默认 3 舰确定性胜）。 */
const S7_DEMO_RUN_SEED = 's7-demo';

@ccclass('S7DemoController')
export class S7DemoController extends Component {
  private adapter: SaveStorageAdapter | null = null;
  private session: S7RunSession | null = null;
  private playerState: S7PlayerState | null = null;
  private saveVersion = S7_CURRENT_SAVE_VERSION;

  private statusLabel: Label | null = null;
  private resultLabel: Label | null = null;

  /** 由 MainSceneController 在 S7 配置预载成功后调用：注入 runtime + 存储适配器，建会话 + 搭色块 UI。 */
  init(runtime: S7ConfigRuntime, adapter: SaveStorageAdapter): void {
    this.adapter = adapter;
    const model = S7MainlineModel.fromRuntime(runtime);

    // 读 S7 存档（独立域）：取出资源 + 主线进度，建最小循环会话。
    const now = Date.now();
    const loaded = loadS7Save(adapter, now);
    this.playerState = loaded.data.playerState;
    this.saveVersion = loaded.data.saveVersion;
    this.session = new S7RunSession(
      this.playerState.resources,
      this.playerState.mainlineProgress,
      runtime,
      model,
    );

    this.buildUi();
    this.refresh();
  }

  // ===== UI 搭建（程序化色块）=====

  private buildUi(): void {
    const parentUt = this.node.parent?.getComponent(UITransform);
    const W = parentUt ? parentUt.contentSize.width : 720;
    const H = parentUt ? parentUt.contentSize.height : 1280;
    const ut = this.node.addComponent(UITransform);
    ut.setContentSize(W, H);

    // 满屏深色底板（盖住流程版灰盒）+ 吞触摸（避免点穿到底层按钮）。
    const bg = this.node.addComponent(Graphics);
    bg.fillColor = new Color(18, 22, 34, 255);
    bg.rect(-W / 2, -H / 2, W, H);
    bg.fill();
    this.node.on(Node.EventType.TOUCH_END, () => {}, this); // 吞掉空白处触摸

    // 顶部标题（放在上半区、避开最顶刘海安全区）。
    this.makeLabel('《我的星舰小队》S7 最小循环演示', 30, new Color(255, 230, 120), 0, H * 0.30);
    this.makeLabel('（色块原型 · 点出战推进主线）', 20, new Color(170, 180, 200), 0, H * 0.30 - 40);

    // 状态行：星矿/合金/当前节点。
    this.statusLabel = this.makeLabel('', 28, new Color(230, 240, 255), 0, H * 0.10);

    // 「出战」按钮（蓝色块）。
    this.makeButton('出战', 280, 96, new Color(60, 120, 220, 255), 0, -H * 0.08, () => this.onSortie());

    // 上一战结果（多行）。
    this.resultLabel = this.makeLabel('点「出战」开始', 24, new Color(180, 230, 180), 0, -H * 0.24);

    // 「重置存档」小按钮（演示用：回到 n001、清零资源，便于反复验证）。
    this.makeButton('重置存档', 180, 64, new Color(120, 70, 70, 255), 0, -H * 0.36, () => this.onReset());
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
  ): void {
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
  }

  // ===== 交互 =====

  /** 点「出战」：打当前节点 → 胜则发奖+推进（会话内部完成）→ 刷新 + 落盘；无遭遇节点显示「暂无关卡」。 */
  private onSortie(): void {
    if (!this.session) return;
    const nodeId = this.session.currentNodeId;
    try {
      const outcome = this.session.playCurrentNode(S7_DEMO_RUN_SEED);
      if (outcome.won && outcome.settlement && outcome.settlement.ok) {
        const grants = outcome.settlement.grants
          .map((g) => `+${g.amount}${this.zhRes(g.resourceId)}`)
          .join(' ');
        const tail = outcome.settlement.finished ? '（已通关最终节点）' : `→ 推进到 ${outcome.settlement.nextNodeId}`;
        this.setResult(`${nodeId} 胜！ ${grants || '（无软货币）'} ${tail}`, new Color(160, 235, 160));
      } else if (outcome.won) {
        // 战斗胜但结算被拒（如重复挑战）：不发奖、不推进。
        this.setResult(`${nodeId} 胜（重复挑战，不再发奖）`, new Color(220, 210, 140));
      } else {
        this.setResult(`${nodeId} 败：${outcome.battle.summary.hintCode}`, new Color(235, 150, 150));
      }
    } catch (err) {
      // 无遭遇配置节点（原型内容缺口）：组装器抛错，按"暂无关卡"提示，不崩。
      this.setResult(`${nodeId} 暂无关卡（原型遭遇待补）`, new Color(200, 200, 200));
      console.warn('[S7DemoController] 该节点暂无战斗遭遇', nodeId, err);
    }
    this.persist();
    this.refresh();
  }

  /** 重置 S7 存档到初始（演示反复验证用）：回 n001、清零资源、落盘。 */
  private onReset(): void {
    if (!this.session || !this.playerState) return;
    for (const key of Object.keys(this.session.resources)) {
      this.session.resources[key] = 0;
    }
    this.session.progress = createDefaultS7MainlineProgress();
    this.setResult('已重置：回到 n001、资源清零', new Color(180, 200, 230));
    this.persist();
    this.refresh();
  }

  // ===== 刷新 / 落盘 =====

  private refresh(): void {
    if (!this.session || !this.statusLabel) return;
    const r = this.session.resources;
    const ore = Math.floor(r.starOre ?? 0);
    const alloy = Math.floor(r.hullAlloy ?? 0);
    const cleared = this.session.progress.clearedNodeIds.length;
    this.statusLabel.string = `星矿 ${ore}    合金 ${alloy}\n当前节点 ${this.session.currentNodeId}    已通关 ${cleared}`;
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
