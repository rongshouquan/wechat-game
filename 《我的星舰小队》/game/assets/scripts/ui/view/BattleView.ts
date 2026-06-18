/**
 * 战斗过程灰盒视图（S5C-04，Cocos Component；S6-ART-ENG-01 补最低观感）。
 *
 * 只做展示与定时播放：按 BattlePlaybackService 产出的帧序列（真实战斗日志驱动）逐帧更新
 * 关卡名、战斗计时、双方存活/血量摘要、最近事件、最终胜负提示；播放结束短暂停留后回调控制器
 * 进入既有胜利结算/失败弹窗流程。不含任何战斗/数值逻辑，不构造事件数据。
 *
 * S6-ART-ENG-01 观感补强（全部复用 P57 已接入资源 + 程序化节点，0 新增资源）：
 * - 敌我识别：我方/敌方 Label 按 UiPolishSpec.BATTLE_SIDE_STYLE 着色（我方青蓝 / 敌方橙红）；
 * - HP 条：双方各一条 ui_bar_hp_bg_9s + ui_bar_hp_fill_9s，填充宽度按引擎 HP 快照比例缩放、同侧别色；
 * - 标题条：关卡行垫 ui_bar_title_9s；胜负文案按胜绿/败红着色。
 * 全部贴图异步加载、失败安全静默（仅缺对应装饰，文字信息不受影响），不阻塞播放与结算。
 *
 * 节点与全部 Label 由控制器/本组件在运行时动态创建（不改 main.scene 资源、不新增美术资源），
 * 文案直接使用播放帧内容。
 */
import { _decorator, Color, Component, Label, Node, Sprite, UITransform } from 'cc';
import { BattlePlayback, BattlePlaybackFrame } from '../../core/BattlePlaybackService';
import { loadUiSpriteFrame } from '../UiAssetCatalog';
import {
  BATTLE_HP_BAR,
  BATTLE_RESULT_COLOR,
  BATTLE_SIDE_STYLE,
  RgbColor,
  hpFillRatio,
} from '../UiPolishSpec';

const { ccclass } = _decorator;

/** 事件滚动条数（最近 N 条伤害/治疗/技能事件）。 */
const EVENT_FEED_LINES = 4;
/** 播放结束后停留时长（秒），让玩家读到最终状态再进结果面板。 */
const END_HOLD_SECONDS = 1.2;

/** 标签/装饰行（自上而下排布的局部 y 偏移与字号；S6-ART-ENG-01 为 HP 条腾出行距）。 */
const LABEL_ROWS = {
  level: { y: 190, fontSize: 26 },
  time: { y: 150, fontSize: 22 },
  player: { y: 108, fontSize: 24 },
  playerBar: { y: 76 },
  enemy: { y: 34, fontSize: 24 },
  enemyBar: { y: 2 },
  events: { y: -84, fontSize: 20 },
  result: { y: -190, fontSize: 34 },
} as const;

/** 关卡标题条尺寸（设计像素，垫在关卡行 Label 之后）。 */
const TITLE_BAR_SIZE = { width: 480, height: 48 } as const;

function toColor(rgb: RgbColor): Color {
  return new Color(rgb.r, rgb.g, rgb.b);
}

/** 单侧 HP 条：条底 + 左锚点填充；贴图未就绪时记住比例，就绪后立即应用。 */
interface HpBar {
  fill: UITransform;
  innerWidth: number;
  ratio: number;
  loaded: boolean;
}

@ccclass('BattleView')
export class BattleView extends Component {
  private levelLabel: Label | null = null;
  private timeLabel: Label | null = null;
  private playerLabel: Label | null = null;
  private enemyLabel: Label | null = null;
  private eventsLabel: Label | null = null;
  private resultLabel: Label | null = null;
  private playerBar: HpBar | null = null;
  private enemyBar: HpBar | null = null;

  private playback: BattlePlayback | null = null;
  private frameIndex = 0;
  private elapsed = 0;
  private playing = false;
  private recentEvents: string[] = [];
  private onComplete: (() => void) | null = null;

  onLoad(): void {
    this.ensureLabels();
  }

  /** 幂等建行：onLoad 与 play 双入口调用，规避"动态 addComponent 后立即休眠节点"的生命周期时序差异。 */
  private ensureLabels(): void {
    if (this.levelLabel) {
      return;
    }
    this.levelLabel = this.createRowLabel('LevelLabel', LABEL_ROWS.level.y, LABEL_ROWS.level.fontSize);
    this.timeLabel = this.createRowLabel('TimeLabel', LABEL_ROWS.time.y, LABEL_ROWS.time.fontSize);
    this.playerLabel = this.createRowLabel('PlayerLabel', LABEL_ROWS.player.y, LABEL_ROWS.player.fontSize);
    this.enemyLabel = this.createRowLabel('EnemyLabel', LABEL_ROWS.enemy.y, LABEL_ROWS.enemy.fontSize);
    this.eventsLabel = this.createRowLabel('EventsLabel', LABEL_ROWS.events.y, LABEL_ROWS.events.fontSize);
    this.resultLabel = this.createRowLabel('ResultLabel', LABEL_ROWS.result.y, LABEL_ROWS.result.fontSize);
    this.resultLabel.color = new Color(255, 230, 120);
    // S6-ART-ENG-01：敌我识别色 + 关卡标题条 + 双方 HP 条（全部失败安全，缺装饰不缺信息）。
    this.playerLabel.color = toColor(BATTLE_SIDE_STYLE.player.color);
    this.enemyLabel.color = toColor(BATTLE_SIDE_STYLE.enemy.color);
    this.createTitleBar();
    this.playerBar = this.createHpBar('PlayerHpBar', LABEL_ROWS.playerBar.y, BATTLE_SIDE_STYLE.player.color);
    this.enemyBar = this.createHpBar('EnemyHpBar', LABEL_ROWS.enemyBar.y, BATTLE_SIDE_STYLE.enemy.color);
  }

  /** 开始播放一场战斗：帧序列与胜负均来自真实战斗结果，本组件只按 wallTime 调度展示。 */
  play(playback: BattlePlayback, levelId: string, onComplete: () => void): void {
    this.ensureLabels();
    this.unschedule(this.finishPlayback);
    this.playback = playback;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.recentEvents = [];
    this.onComplete = onComplete;
    this.node.active = true;

    const speedSuffix = playback.speed > 1 ? `（${playback.speed.toFixed(1)} 倍速）` : '';
    this.setText(this.levelLabel, `关卡 ${levelId} 战斗中${speedSuffix}`);
    this.setText(this.timeLabel, `0.0s / ${playback.durationSec.toFixed(1)}s`);
    this.setText(this.eventsLabel, '');
    this.setText(this.resultLabel, '');
    this.setHpRatio(this.playerBar, 1);
    this.setHpRatio(this.enemyBar, 1);
    this.playing = true;
  }

  /** 中止/隐藏（防御性入口，正常流程由播放结束回调收尾）。 */
  hide(): void {
    this.unschedule(this.finishPlayback);
    this.playing = false;
    this.playback = null;
    this.onComplete = null;
    this.node.active = false;
  }

  update(dt: number): void {
    if (!this.playing || !this.playback) {
      return;
    }
    this.elapsed += dt;
    const frames = this.playback.frames;
    while (this.frameIndex < frames.length && frames[this.frameIndex].wallTime <= this.elapsed) {
      this.applyFrame(frames[this.frameIndex]);
      this.frameIndex += 1;
    }
    if (this.frameIndex >= frames.length) {
      this.playing = false;
      this.scheduleOnce(this.finishPlayback, END_HOLD_SECONDS);
    }
  }

  private applyFrame(frame: BattlePlaybackFrame): void {
    if (!this.playback) {
      return;
    }
    this.setText(this.timeLabel, `${frame.simTime.toFixed(1)}s / ${this.playback.durationSec.toFixed(1)}s`);
    const s = frame.summary;
    this.setText(
      this.playerLabel,
      `${BATTLE_SIDE_STYLE.player.label} 存活 ${s.alivePlayers}  HP ${s.playerHp}/${s.playerMaxHp}`,
    );
    this.setText(
      this.enemyLabel,
      `${BATTLE_SIDE_STYLE.enemy.label} 存活 ${s.aliveEnemies}  HP ${s.enemyHp}/${s.enemyMaxHp}`,
    );
    this.setHpRatio(this.playerBar, hpFillRatio(s.playerHp, s.playerMaxHp));
    this.setHpRatio(this.enemyBar, hpFillRatio(s.enemyHp, s.enemyMaxHp));
    if (frame.eventText) {
      this.recentEvents.push(frame.eventText);
      if (this.recentEvents.length > EVENT_FEED_LINES) {
        this.recentEvents = this.recentEvents.slice(-EVENT_FEED_LINES);
      }
      this.setText(this.eventsLabel, this.recentEvents.join('\n'));
    }
    if (frame.kind === 'end') {
      const win = frame.winner === 'player';
      this.setText(this.resultLabel, win ? '胜利！' : '战斗失败');
      if (this.resultLabel) {
        this.resultLabel.color = toColor(win ? BATTLE_RESULT_COLOR.win : BATTLE_RESULT_COLOR.lose);
      }
    }
  }

  /** scheduleOnce 回调：实例属性保持引用稳定，便于 unschedule。 */
  private finishPlayback = (): void => {
    this.node.active = false;
    const callback = this.onComplete;
    this.onComplete = null;
    callback?.();
  };

  private createRowLabel(name: string, y: number, fontSize: number): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.setPosition(0, y, 0);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    return label;
  }

  /** 关卡行标题条：异步加载，垫在所有 Label 之后面（插到子节点首位）；失败仅缺底条。 */
  private createTitleBar(): void {
    const node = new Node('POLISH_BattleTitleBar');
    node.layer = this.node.layer;
    this.node.insertChild(node, 0);
    node.setPosition(0, LABEL_ROWS.level.y, 0);
    node.addComponent(UITransform).setContentSize(TITLE_BAR_SIZE.width, TITLE_BAR_SIZE.height);
    const sprite = node.addComponent(Sprite);
    sprite.type = Sprite.Type.SLICED;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    void loadUiSpriteFrame('ui_bar_title_9s').then((frame) => {
      if (frame && node.isValid) {
        sprite.spriteFrame = frame;
      }
    });
  }

  /**
   * 创建单侧 HP 条：条底居中、填充条左锚点（宽度按比例缩放）、填充按侧别着色。
   * 贴图异步加载；未就绪期间只记比例，就绪后立刻应用，保证播放中途加载完成也显示正确。
   */
  private createHpBar(name: string, y: number, color: RgbColor): HpBar | null {
    try {
      const spec = BATTLE_HP_BAR;
      const bgNode = new Node(name);
      bgNode.layer = this.node.layer;
      // 插到首位：渲染在全部文字行之后面，避免压住任何 Label。
      this.node.insertChild(bgNode, 0);
      bgNode.setPosition(0, y, 0);
      bgNode.addComponent(UITransform).setContentSize(spec.width, spec.height);
      const bgSprite = bgNode.addComponent(Sprite);
      bgSprite.type = Sprite.Type.SLICED;
      bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;

      const innerWidth = spec.width - spec.innerPadding * 2;
      const innerHeight = spec.height - spec.innerPadding * 2;
      const fillNode = new Node(`${name}Fill`);
      fillNode.layer = this.node.layer;
      bgNode.addChild(fillNode);
      const fillUi = fillNode.addComponent(UITransform);
      fillUi.setAnchorPoint(0, 0.5);
      fillUi.setContentSize(innerWidth, innerHeight);
      fillNode.setPosition(-innerWidth / 2, 0, 0);
      const fillSprite = fillNode.addComponent(Sprite);
      fillSprite.type = Sprite.Type.SLICED;
      fillSprite.sizeMode = Sprite.SizeMode.CUSTOM;
      fillSprite.color = toColor(color);

      const bar: HpBar = { fill: fillUi, innerWidth, ratio: 1, loaded: false };
      void Promise.all([
        loadUiSpriteFrame(spec.bgAssetId),
        loadUiSpriteFrame(spec.fillAssetId),
      ]).then(([bgFrame, fillFrame]) => {
        if (!bgNode.isValid || !bgFrame || !fillFrame) {
          return;
        }
        bgSprite.spriteFrame = bgFrame;
        fillSprite.spriteFrame = fillFrame;
        bar.loaded = true;
        this.applyHpWidth(bar);
      });
      return bar;
    } catch (err) {
      console.warn('[BattleView] HP 条创建失败（已忽略，保留文字摘要）', err);
      return null;
    }
  }

  /** 更新单侧 HP 比例：未加载完成时仅记账，加载完成后才写宽度。 */
  private setHpRatio(bar: HpBar | null, ratio: number): void {
    if (!bar) {
      return;
    }
    bar.ratio = ratio;
    if (bar.loaded) {
      this.applyHpWidth(bar);
    }
  }

  private applyHpWidth(bar: HpBar): void {
    const width = Math.max(0, Math.round(bar.innerWidth * bar.ratio));
    bar.fill.setContentSize(width, bar.fill.contentSize.height);
    // 宽度为 0 时整体隐藏填充节点，避免 9-slice 在 0 宽下的边角残影。
    bar.fill.node.active = width > 0;
  }

  private setText(label: Label | null, text: string): void {
    if (label) {
      label.string = text;
    }
  }
}
