/**
 * S6-ART-ENG-01 P0 观感皮肤层（Cocos 侧，只做显示/资源加载/节点创建）。
 *
 * 按 UiPolishSpec（纯 TS 唯一真源）给现有灰盒界面补最低观感：
 * - 主界面三常驻区与胜利/失败弹窗的运行时底板（复用 P57 9-slice 底板，不改 main.scene）；
 * - 推荐目标 / 胜利结算 / 失败原因的标题条（失败带 ui_icon_warning 前置警示）；
 * - "采纳目标 / 下一目标"按钮的尾随箭头（ui_icon_arrow）；
 * - 离线收益"可领取"弱高亮（ui_frame_highlight_9s）。
 *
 * 降级策略：所有节点先同步创建（占位、不可见），SpriteFrame 异步加载成功后才可见；
 * 加载失败仅留空节点（不渲染、零交互），任何异常静默吞掉，绝不阻断装配、奖励、战斗、导航。
 * 创建的节点统一带 POLISH_ 前缀命名，与业务节点可区分、可追踪。
 */
import { Node, Sprite, UIOpacity, UITransform } from 'cc';
import { loadUiSpriteFrame } from './UiAssetCatalog';
import {
  ARROW_BUTTON_NAMES,
  BUTTON_TRAIL_ICON,
  CLAIM_HIGHLIGHT,
  PANEL_BG_SKIN,
  PANEL_TITLE_BARS,
  TitleBarSpec,
} from './UiPolishSpec';

/** 本层创建的节点统一前缀（参与子内容包围盒计算时会被排除）。 */
const POLISH_PREFIX = 'POLISH_';
const BG_NODE_NAME = `${POLISH_PREFIX}PanelBg`;
const TITLE_BAR_NODE_NAME = `${POLISH_PREFIX}TitleBar`;
const TRAIL_ICON_NODE_NAME = `${POLISH_PREFIX}TrailIcon`;
const HIGHLIGHT_NODE_NAME = `${POLISH_PREFIX}ClaimHighlight`;

function findByName(root: Node, name: string): Node | null {
  if (root.name === name) {
    return root;
  }
  for (const child of root.children) {
    const found = findByName(child, name);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * 同步创建一个带 UITransform 的展示节点，并异步填充 SpriteFrame。
 * 同步创建保证幂等检查（按节点名）无竞态；加载失败时节点无 frame、不渲染任何内容。
 */
function createSpriteNode(
  name: string,
  assetId: string,
  width: number,
  height: number,
  opacity: number,
  sliced: boolean,
): Node {
  const node = new Node(name);
  node.addComponent(UITransform).setContentSize(width, height);
  const sprite = node.addComponent(Sprite);
  sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  if (opacity < 255) {
    node.addComponent(UIOpacity).opacity = opacity;
  }
  void loadUiSpriteFrame(assetId).then((frame) => {
    if (frame && node.isValid) {
      sprite.spriteFrame = frame;
    }
  });
  return node;
}

/** 直接子节点（排除本层 POLISH_ 节点）在面板本地坐标下的包围盒；无可量内容返回 null。 */
function childContentBounds(
  panel: Node,
): { centerX: number; centerY: number; width: number; height: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const child of panel.children) {
    if (child.name.startsWith(POLISH_PREFIX)) {
      continue;
    }
    const ui = child.getComponent(UITransform);
    if (!ui) {
      continue;
    }
    const { width, height } = ui.contentSize;
    const ax = ui.anchorPoint.x;
    const ay = ui.anchorPoint.y;
    minX = Math.min(minX, child.position.x - width * ax);
    maxX = Math.max(maxX, child.position.x + width * (1 - ax));
    minY = Math.min(minY, child.position.y - height * ay);
    maxY = Math.max(maxY, child.position.y + height * (1 - ay));
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** 给单个面板补运行时底板：插到首位（渲染在所有业务子节点之后面），幂等。 */
function applyPanelBackground(panel: Node): void {
  const spec = PANEL_BG_SKIN[panel.name];
  if (!spec || panel.getChildByName(BG_NODE_NAME)) {
    return;
  }
  const bounds = childContentBounds(panel);
  if (!bounds) {
    return;
  }
  // extraTopPadding 只加在顶部：高度整体增加该值，中心同步上移一半，
  // 使底部边缘（= centerY - height/2）保持不变，不影响底板下方按钮的相对位置。
  const extraTop = spec.extraTopPadding ?? 0;
  const node = createSpriteNode(
    BG_NODE_NAME,
    spec.assetId,
    bounds.width + spec.paddingX * 2,
    bounds.height + spec.paddingY * 2 + extraTop,
    spec.opacity,
    true,
  );
  node.layer = panel.layer;
  panel.insertChild(node, 0);
  node.setPosition(bounds.centerX, bounds.centerY + extraTop / 2, 0);
}

/** 给标题 Label 垫一条标题条（渲染在底板之上、Label 之下），可带前置警示图标。 */
function applyTitleBar(root: Node, spec: TitleBarSpec): void {
  const panel = findByName(root, spec.panelName);
  if (!panel || panel.getChildByName(TITLE_BAR_NODE_NAME)) {
    return;
  }
  const label = findByName(panel, spec.labelName);
  if (!label || label.parent !== panel) {
    return;
  }
  const bar = createSpriteNode(TITLE_BAR_NODE_NAME, spec.assetId, spec.width, spec.height, 255, true);
  bar.layer = panel.layer;
  panel.insertChild(bar, Math.max(0, label.getSiblingIndex()));
  bar.setPosition(label.position.x, label.position.y, 0);
  if (spec.leadingIconAssetId && spec.leadingIconSize) {
    const icon = createSpriteNode(
      `${POLISH_PREFIX}TitleIcon`,
      spec.leadingIconAssetId,
      spec.leadingIconSize,
      spec.leadingIconSize,
      255,
      false,
    );
    icon.layer = panel.layer;
    bar.addChild(icon);
    icon.setPosition(-spec.width / 2 + spec.leadingIconSize / 2 + 14, 0, 0);
  }
}

/** 给"前往"语义按钮补尾随箭头图标（按按钮自身宽度定位，确定性布局）。 */
function applyButtonTrailIcon(root: Node, buttonName: string): void {
  const button = findByName(root, buttonName);
  if (!button || button.getChildByName(TRAIL_ICON_NODE_NAME)) {
    return;
  }
  const ui = button.getComponent(UITransform);
  if (!ui) {
    return;
  }
  const icon = createSpriteNode(
    TRAIL_ICON_NODE_NAME,
    BUTTON_TRAIL_ICON.assetId,
    BUTTON_TRAIL_ICON.size,
    BUTTON_TRAIL_ICON.size,
    255,
    false,
  );
  icon.layer = button.layer;
  button.addChild(icon);
  icon.setPosition(ui.contentSize.width / 2 - BUTTON_TRAIL_ICON.size / 2 - BUTTON_TRAIL_ICON.marginRight, 0, 0);
}

/**
 * 主场景观感补强入口：面板底板 + 标题条 + 按钮箭头。
 * 整体 try/catch，任何异常静默降级为保留灰盒现状，不阻断装配。
 */
export function applyMainScenePolish(root: Node): void {
  try {
    for (const panelName of Object.keys(PANEL_BG_SKIN)) {
      const panel = findByName(root, panelName);
      if (panel) {
        applyPanelBackground(panel);
      }
    }
    for (const spec of PANEL_TITLE_BARS) {
      applyTitleBar(root, spec);
    }
    for (const buttonName of ARROW_BUTTON_NAMES) {
      applyButtonTrailIcon(root, buttonName);
    }
  } catch (err) {
    console.warn('[UiPolishSkin] 主场景观感补强失败（已忽略，保留灰盒外观）', err);
  }
}

/**
 * 切换目标节点（如领取按钮）的"可领取"弱高亮：首次显示时懒创建高亮框节点。
 * 失败安全静默；高亮纯展示，不拦截点击、不参与业务状态。
 */
export function setClaimableHighlight(target: Node | null | undefined, visible: boolean): void {
  try {
    if (!target || !target.isValid) {
      return;
    }
    let highlight = target.getChildByName(HIGHLIGHT_NODE_NAME);
    if (!highlight) {
      if (!visible) {
        return;
      }
      const ui = target.getComponent(UITransform);
      if (!ui) {
        return;
      }
      highlight = createSpriteNode(
        HIGHLIGHT_NODE_NAME,
        CLAIM_HIGHLIGHT.assetId,
        ui.contentSize.width + CLAIM_HIGHLIGHT.margin * 2,
        ui.contentSize.height + CLAIM_HIGHLIGHT.margin * 2,
        CLAIM_HIGHLIGHT.opacity,
        true,
      );
      highlight.layer = target.layer;
      // 插到首位：渲染在按钮自身底板之后、按钮文字之前，弱高亮不压过按钮内容。
      target.insertChild(highlight, 0);
      highlight.setPosition(0, 0, 0);
    }
    highlight.active = visible;
  } catch (err) {
    console.warn('[UiPolishSkin] 可领取高亮切换失败（已忽略）', err);
  }
}
