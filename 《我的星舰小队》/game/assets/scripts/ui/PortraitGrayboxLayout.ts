/**
 * 竖屏灰盒主界面运行时布局（P57-4，P57-6-fix3 按 Ron 截图标注重新分布）。
 *
 * 不再依赖 scene 里的固定 y 坐标：启动时读取真机可视高度与安全区（微信胶囊/状态栏/底部安全区）。
 * - 推荐目标区固定贴顶部安全边界；
 * - 离线收益区放在屏幕竖直居中位置；
 * - 一键升级区放在"推荐目标区"与"离线收益区"之间的居中位置；
 * - 结算面板/失败弹窗（与常驻面板互斥显示）放在屏幕竖直居中位置；
 * - 底部按钮整体上移、不贴底。
 *
 * 边界：只移动现有区域容器节点的位置、并关闭其 scene 端 Widget（避免与运行时定位冲突）；
 * 不改任何业务逻辑、点击事件、Presenter/View 数据，不新增资源。
 */
import { Node, Widget, view } from 'cc';

/** 推荐目标区中心到内容顶部的距离（设计像素，量自 main.scene）。 */
const RECOMMENDED_TARGET_TOP = 62;

/** 底部按钮行内容范围（三个按钮同高、同 y）。 */
const DEBUG_BUTTONS_EXTENT = { top: 52, bottom: -52 };

/** 底部按钮整体上移、不贴底部安全区的额外留白（设计像素）。 */
const DEBUG_BUTTONS_BOTTOM_MARGIN = 120;

interface SafeInsets {
  /** 顶部安全留白（设计像素）。 */
  top: number;
  /** 底部安全留白（设计像素）。 */
  bottom: number;
}

/** 读取安全区；非微信环境降级为默认留白。返回值单位为设计像素（与可视高度同坐标系）。 */
function readSafeInsets(visibleHeight: number): SafeInsets {
  const DEFAULT: SafeInsets = { top: 140, bottom: 70 };
  const wx = (globalThis as unknown as { wx?: WxLike }).wx;
  if (!wx || typeof wx.getSystemInfoSync !== 'function') {
    return DEFAULT;
  }
  try {
    const sys = wx.getSystemInfoSync();
    const screenH = sys.screenHeight || sys.windowHeight || 0;
    if (!screenH) {
      return DEFAULT;
    }
    const scale = visibleHeight / screenH; // 设计像素 / 逻辑像素
    let topLogical = (sys.statusBarHeight ?? 20) + 8;
    if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
      const rect = wx.getMenuButtonBoundingClientRect();
      if (rect && typeof rect.bottom === 'number') {
        topLogical = Math.max(topLogical, rect.bottom + 8); // 让开胶囊底部
      }
    }
    let bottomLogical = 12;
    if (sys.safeArea && typeof sys.safeArea.bottom === 'number') {
      bottomLogical = Math.max(bottomLogical, screenH - sys.safeArea.bottom + 8);
    }
    return { top: topLogical * scale, bottom: bottomLogical * scale };
  } catch {
    return DEFAULT;
  }
}

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

/** 关闭 scene 端 Widget（避免其每帧重对齐覆盖运行时定位），并设置区块容器的位置。 */
function placeZone(root: Node, name: string, y: number): void {
  const node = findByName(root, name);
  if (!node) {
    return;
  }
  const widget = node.getComponent(Widget);
  if (widget) {
    widget.enabled = false;
  }
  node.setPosition(0, y, 0);
}

/**
 * 按真机可视高度重新分布主界面区块：
 * - 推荐目标区贴顶部安全边界；
 * - 离线收益区放在屏幕竖直居中位置；
 * - 一键升级区放在推荐目标区与离线收益区之间的居中位置；
 * - 结算/失败弹窗与常驻面板互斥显示，复用屏幕竖直居中位置；
 * - 底部按钮贴近底部安全区、整体上移一点不贴底。
 * 失败静默降级，不阻断装配。
 */
export function applyPortraitLayout(root: Node): void {
  const size = view.getVisibleSize();
  const height = size.height;
  if (!height || height <= 0) {
    return;
  }
  const insets = readSafeInsets(height);
  const usableTop = height / 2 - insets.top; // 中心原点下，顶部可用边界 y
  const usableBottom = -height / 2 + insets.bottom;
  if (usableTop - usableBottom <= 0) {
    return;
  }
  const usableCenter = (usableTop + usableBottom) / 2;

  const recommendedY = usableTop - RECOMMENDED_TARGET_TOP;
  placeZone(root, 'RecommendedTarget', recommendedY);

  const offlineY = usableCenter;
  placeZone(root, 'OfflinePanel', offlineY);

  const upgradeY = (recommendedY + offlineY) / 2;
  placeZone(root, 'UpgradePanel', upgradeY);

  placeZone(root, 'DefeatDialog', usableCenter);
  placeZone(root, 'VictoryPanel', usableCenter);

  placeZone(root, 'DebugButtons', usableBottom - DEBUG_BUTTONS_EXTENT.bottom + DEBUG_BUTTONS_BOTTOM_MARGIN);
}

/** 微信 API 最小子集（仅本布局所需字段），避免引入额外类型依赖。 */
interface WxLike {
  getSystemInfoSync?: () => {
    screenHeight?: number;
    windowHeight?: number;
    statusBarHeight?: number;
    safeArea?: { bottom?: number };
  };
  getMenuButtonBoundingClientRect?: () => { bottom?: number };
}
