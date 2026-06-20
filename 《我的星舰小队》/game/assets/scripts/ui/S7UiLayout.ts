/**
 * S7 UI 地基 · Cocos 薄壳（阶段一 G0）：从 cc `view` + 微信 `wx` 收集屏幕信息，
 * 调纯算法 `core/s7/S7SafeArea` 算出"可用竖直区间"（避开刘海/胶囊/底部安全区）。
 *
 * 所有 S7 界面（编队/抽卡/基地…）摆放顶部内容时应锚到 usableTopY 之下、底部锚到 usableBottomY 之上，
 * 别再用满屏比例硬摆（避免顶部被刘海/胶囊菜单按钮遮挡——CLAUDE.md 微信硬规则）。
 * 像素比/清晰度由 Cocos 引擎按设计分辨率自动管，本层不处理。
 *
 * 边界：仅读 view/wx + 调纯算法；不持有状态、不依赖流程版（换壳后照用）。
 */
import { view } from 'cc';
import {
  computeS7SafeInsets,
  computeS7UsableBand,
  S7UsableBand,
  S7SafeAreaInput,
} from '../core/s7/S7SafeArea';

interface WxLike {
  getSystemInfoSync?: () => {
    screenHeight?: number;
    windowHeight?: number;
    statusBarHeight?: number;
    safeArea?: { bottom?: number };
  };
  getMenuButtonBoundingClientRect?: () => { bottom?: number };
}

/** 当前可视尺寸（设计像素）。 */
export function getS7VisibleSize(): { width: number; height: number } {
  const s = view.getVisibleSize();
  return { width: s.width, height: s.height };
}

/** 算当前设备的可用竖直区间（安全区内）。非微信环境/取信息失败 → 纯算法降级默认留白。 */
export function getS7UsableBand(): S7UsableBand {
  const size = view.getVisibleSize();
  const input: S7SafeAreaInput = { screenHeightLogical: 0, visibleHeightDesign: size.height };
  const wx = (globalThis as unknown as { wx?: WxLike }).wx;
  if (wx && typeof wx.getSystemInfoSync === 'function') {
    try {
      const sys = wx.getSystemInfoSync();
      input.screenHeightLogical = sys.screenHeight || sys.windowHeight || 0;
      input.statusBarHeight = sys.statusBarHeight;
      input.safeAreaBottom = sys.safeArea?.bottom;
      if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
        const rect = wx.getMenuButtonBoundingClientRect();
        if (rect && typeof rect.bottom === 'number') input.menuButtonBottom = rect.bottom;
      }
    } catch {
      // 降级：保持 screenHeightLogical=0 → 纯算法返回默认留白
    }
  }
  return computeS7UsableBand(size.height, computeS7SafeInsets(input));
}
