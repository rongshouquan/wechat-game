/**
 * S6-ART-ENG-01 P0 观感补强规格（纯 TS，不依赖 cc）。
 *
 * 唯一真源：主界面/弹窗底板皮肤映射、标题条映射、按钮装饰图标、战斗敌我识别样式、
 * HP 条规格、奖励闪光与可领取高亮参数。Cocos 侧（UiPolishSkin / UiFx / BattleView）
 * 只按本规格做显示与节点动效，不在业务方法里散落 assetId / 路径 / 数值。
 *
 * 全部 assetId 复用 P57 已接入资源（见 UiAssetPaths），0 新增资源；
 * 所有动效时长受 FX_MAX_DURATION_MS（任务包 P0 上限 1200ms）约束，失败安全静默。
 */

/** P0 约束：单次反馈动效时长上限（毫秒），见 S6-ART-01 任务包 §6.2。 */
export const FX_MAX_DURATION_MS = 1200;

/** RGB 颜色（0-255），纯数据，Cocos 侧转换为 cc.Color。 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// 主界面 / 弹窗底板
// ---------------------------------------------------------------------------

export interface PanelBackgroundSpec {
  /** 底板 9-slice assetId。 */
  assetId: string;
  /** 在子内容包围盒基础上向四周扩展的留白（设计像素）。 */
  paddingX: number;
  paddingY: number;
  /** 底板透明度（0-255）：常驻面板压暗一些，弹窗更实。 */
  opacity: number;
  /**
   * 仅向顶部追加的额外安全留白（设计像素，可选，默认 0）。
   * 用于多行文案的 Label 节点 contentSize 在装配时未必反映最终行数（如离线收益
   * "可领取"三行文案），仅靠包围盒量出的高度可能不够，顶部预留余量避免首行出框。
   * 只加在顶部，不影响底部边缘与底板下方按钮的相对位置。
   */
  extraTopPadding?: number;
}

/**
 * 面板容器节点名 -> 底板皮肤。覆盖主界面三常驻区与胜利/失败弹窗。
 * RecommendedTarget 不用 ui_bar_target_9s 做底板：该资源左侧带高亮竖条装饰，
 * 是为标题条尺寸设计的，拉伸为整个面板底板会在左边缘出现一条竖线（S6-ART-QA-01 真机反馈）。
 */
export const PANEL_BG_SKIN: Readonly<Record<string, PanelBackgroundSpec>> = {
  RecommendedTarget: { assetId: 'ui_panel_card_9s', paddingX: 28, paddingY: 26, opacity: 215 },
  UpgradePanel: { assetId: 'ui_panel_card_9s', paddingX: 28, paddingY: 26, opacity: 215 },
  // extraTopPadding：claimable 态 amountLabel 文案为"可领取"三行，contentSize 量出的
  // 包围盒可能仍按一行/两行计算，首行会顶出底板（S6-ART-P0-FIX-02 真机反馈）。
  OfflinePanel: { assetId: 'ui_panel_card_9s', paddingX: 28, paddingY: 26, opacity: 215, extraTopPadding: 40 },
  DefeatDialog: { assetId: 'ui_panel_dialog_9s', paddingX: 36, paddingY: 32, opacity: 245 },
  VictoryPanel: { assetId: 'ui_panel_dialog_9s', paddingX: 36, paddingY: 32, opacity: 245 },
};

// ---------------------------------------------------------------------------
// 标题条 / 标题前置图标
// ---------------------------------------------------------------------------

export interface TitleBarSpec {
  /** 面板容器节点名（在其内部查找标题 Label）。 */
  panelName: string;
  /** 标题 Label 节点名。 */
  labelName: string;
  /** 标题条 9-slice assetId。 */
  assetId: string;
  /** 标题条固定尺寸（设计像素）。 */
  width: number;
  height: number;
  /** 可选：条内左侧前置小图标（如失败弹窗警示）。 */
  leadingIconAssetId?: string;
  leadingIconSize?: number;
}

/** 标题条映射：推荐目标标题、胜利结算标题、失败原因标题（带警示图标）。 */
export const PANEL_TITLE_BARS: ReadonlyArray<TitleBarSpec> = [
  { panelName: 'RecommendedTarget', labelName: 'TitleLabel', assetId: 'ui_bar_title_9s', width: 460, height: 56 },
  { panelName: 'VictoryPanel', labelName: 'ResultLabel', assetId: 'ui_bar_title_9s', width: 560, height: 60 },
  {
    panelName: 'DefeatDialog',
    labelName: 'ReasonLabel',
    assetId: 'ui_bar_title_9s',
    width: 560,
    height: 60,
    leadingIconAssetId: 'ui_icon_warning',
    leadingIconSize: 34,
  },
];

// ---------------------------------------------------------------------------
// 按钮装饰图标（"前往/继续"语义的尾随箭头）
// ---------------------------------------------------------------------------

export interface ButtonTrailIconSpec {
  assetId: string;
  /** 图标边长（设计像素）。 */
  size: number;
  /** 距按钮右边缘的留白（设计像素）。 */
  marginRight: number;
}

/** 需要尾随箭头的按钮节点名（采纳目标 / 下一目标，均为"前往"语义）。 */
export const ARROW_BUTTON_NAMES: ReadonlyArray<string> = ['AdoptButton', 'NextButton'];

export const BUTTON_TRAIL_ICON: ButtonTrailIconSpec = {
  assetId: 'ui_icon_arrow',
  size: 30,
  marginRight: 22,
};

// ---------------------------------------------------------------------------
// 战斗过程：敌我识别 / HP 条
// ---------------------------------------------------------------------------

export interface BattleSideStyle {
  /** 侧别短名（Label 前缀，色块同色）。 */
  label: string;
  /** 侧别识别色（Label 与 HP 条填充同色系）。 */
  color: RgbColor;
}

/** 我方冷色（青蓝）、敌方暖色（橙红），色弱场景下仍有明度差。 */
export const BATTLE_SIDE_STYLE: Readonly<Record<'player' | 'enemy', BattleSideStyle>> = {
  player: { label: '我方', color: { r: 96, g: 208, b: 255 } },
  enemy: { label: '敌方', color: { r: 255, g: 122, b: 104 } },
};

export interface BattleHpBarSpec {
  bgAssetId: string;
  fillAssetId: string;
  /** 条底尺寸（设计像素）。 */
  width: number;
  height: number;
  /** 填充条相对条底的内缩（设计像素，左右上下各缩此值）。 */
  innerPadding: number;
}

export const BATTLE_HP_BAR: BattleHpBarSpec = {
  bgAssetId: 'ui_bar_hp_bg_9s',
  fillAssetId: 'ui_bar_hp_fill_9s',
  width: 440,
  height: 22,
  innerPadding: 3,
};

/** 战斗结果文案颜色：胜利绿 / 失败红（与敌我识别色区分明度）。 */
export const BATTLE_RESULT_COLOR: Readonly<Record<'win' | 'lose', RgbColor>> = {
  win: { r: 134, g: 230, b: 142 },
  lose: { r: 255, g: 122, b: 104 },
};

/**
 * HP 填充比例：钳制到 [0,1]；maxHp 非正（异常数据）按 0 处理，
 * 保证视图侧拿到的宽度永远合法，坏数据只会显示空条、不抛错。
 */
export function hpFillRatio(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, hp / maxHp));
}

// ---------------------------------------------------------------------------
// 奖励 / 升级 / 胜利反馈与可领取高亮
// ---------------------------------------------------------------------------

export interface RewardSparkSpec {
  assetId: string;
  /** 闪光图标边长（设计像素）。 */
  size: number;
  /** 相对锚点节点的偏移（设计像素，向上避开文字）。 */
  offsetY: number;
  /** 总时长（毫秒），必须 <= FX_MAX_DURATION_MS。 */
  durationMs: number;
  /** 入场起始 / 峰值缩放。 */
  fromScale: number;
  toScale: number;
}

/** 领取/升级/胜利共用的奖励闪光（复用 ui_fx_reward_spark + 程序化 tween）。 */
export const REWARD_SPARK: RewardSparkSpec = {
  assetId: 'ui_fx_reward_spark',
  size: 72,
  offsetY: 44,
  durationMs: 900,
  fromScale: 0.4,
  toScale: 1.15,
};

export interface ClaimHighlightSpec {
  assetId: string;
  /** 高亮框相对目标节点四周外扩（设计像素）。 */
  margin: number;
  /** 弱高亮透明度（0-255），不得压过按钮本体。 */
  opacity: number;
}

/** 离线收益"可领取"弱高亮（复用 ui_frame_highlight_9s）。 */
export const CLAIM_HIGHLIGHT: ClaimHighlightSpec = {
  assetId: 'ui_frame_highlight_9s',
  margin: 12,
  opacity: 190,
};
