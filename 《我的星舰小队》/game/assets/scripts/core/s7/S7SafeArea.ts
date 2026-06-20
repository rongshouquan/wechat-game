// S7 UI 地基 · 安全区计算（阶段一 G0，纯 TS，不依赖 cc）：CLAUDE.md 微信硬规则「顶部安全区规避（必须项）」。
//
// 职责：把"微信系统信息(状态栏高/胶囊底/底部安全区) + 可视高度"算成 S7 界面可用的上下安全留白（设计像素）。
//   顶部取「状态栏+8」与「胶囊底+8」的较大值（让开刘海/胶囊菜单按钮）；底部取屏幕底到 safeArea.bottom 的留白。
//   算法照搬流程版已在真机验证过的 PortraitGrayboxLayout.readSafeInsets，但**提成 S7 自有、可单测、不依赖 cc/流程版**
//   （将来换壳删流程版不受影响；cc 读取 view/wx 的薄壳在 ui/S7UiLayout.ts）。
//
// ⚠️ 画布清晰度/像素比：本项目用 Cocos Creator，DPR/分辨率由引擎按"设计分辨率+适配策略"自动处理，
//   不需手写 canvas.width*pixelRatio（CLAUDE.md §二.0 那条是给纯微信 Canvas2D 的，Cocos 下由引擎管）。

/** 算安全区所需的输入（由 cc 薄壳从 wx.getSystemInfoSync + view 收集后传入；纯函数不读全局）。 */
export interface S7SafeAreaInput {
  /** 屏幕逻辑高（wx screenHeight/windowHeight），<=0 视为无效→降级默认。 */
  screenHeightLogical: number;
  /** Cocos 可视高（设计像素，view.getVisibleSize().height）。 */
  visibleHeightDesign: number;
  /** 状态栏高（逻辑像素）；缺省按 20。 */
  statusBarHeight?: number;
  /** 胶囊菜单按钮底部 y（逻辑像素）；有则顶部让开它。 */
  menuButtonBottom?: number;
  /** 底部安全区的 bottom（逻辑像素，wx safeArea.bottom）；有则底部让开。 */
  safeAreaBottom?: number;
}

/** 上下安全留白（设计像素，与 Cocos 可视坐标同系）。 */
export interface S7SafeInsets {
  top: number;
  bottom: number;
}

/** 无法取到系统信息时的降级默认留白（设计像素）——与流程版一致。 */
export const S7_SAFE_INSETS_DEFAULT: Readonly<S7SafeInsets> = Object.freeze({ top: 140, bottom: 70 });

/**
 * 算上下安全留白（纯函数，确定可复算）。screenHeightLogical<=0 或可视高<=0 → 降级默认。
 * top = max(状态栏+8, 胶囊底+8) × scale；bottom = max(12, 屏高-safeArea.bottom+8) × scale；scale=可视高/屏高。
 */
export function computeS7SafeInsets(input: S7SafeAreaInput): S7SafeInsets {
  const screenH = input.screenHeightLogical;
  const visH = input.visibleHeightDesign;
  if (!Number.isFinite(screenH) || screenH <= 0 || !Number.isFinite(visH) || visH <= 0) {
    return { ...S7_SAFE_INSETS_DEFAULT };
  }
  const scale = visH / screenH; // 设计像素 / 逻辑像素
  let topLogical = (input.statusBarHeight ?? 20) + 8;
  if (typeof input.menuButtonBottom === 'number' && Number.isFinite(input.menuButtonBottom)) {
    topLogical = Math.max(topLogical, input.menuButtonBottom + 8); // 让开胶囊底部
  }
  let bottomLogical = 12;
  if (typeof input.safeAreaBottom === 'number' && Number.isFinite(input.safeAreaBottom)) {
    bottomLogical = Math.max(bottomLogical, screenH - input.safeAreaBottom + 8);
  }
  return { top: topLogical * scale, bottom: bottomLogical * scale };
}

/** 可用竖直区间（中心原点坐标系；y 向上）：顶/底安全边界 + 可用中心。供界面在安全区内摆放。 */
export interface S7UsableBand {
  insets: S7SafeInsets;
  /** 顶部可用边界 y（= 可视高/2 - top）。 */
  usableTopY: number;
  /** 底部可用边界 y（= -可视高/2 + bottom）。 */
  usableBottomY: number;
  /** 可用区竖直中心 y。 */
  usableCenterY: number;
}

/** 由可视高 + 安全留白算出"可用竖直区间"（中心原点）。可视高<=0 时区间退化为 0。 */
export function computeS7UsableBand(visibleHeightDesign: number, insets: S7SafeInsets): S7UsableBand {
  const h = Number.isFinite(visibleHeightDesign) && visibleHeightDesign > 0 ? visibleHeightDesign : 0;
  const usableTopY = h / 2 - insets.top;
  const usableBottomY = -h / 2 + insets.bottom;
  return { insets, usableTopY, usableBottomY, usableCenterY: (usableTopY + usableBottomY) / 2 };
}
