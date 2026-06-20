// 阶段一 G0：UI 地基·安全区计算（纯算法）单测。
import { describe, it, expect } from 'vitest';
import {
  computeS7SafeInsets,
  computeS7UsableBand,
  S7_SAFE_INSETS_DEFAULT,
} from '../assets/scripts/core/s7/S7SafeArea';

describe('G0 · computeS7SafeInsets', () => {
  it('屏高无效 / 可视高无效 → 降级默认', () => {
    expect(computeS7SafeInsets({ screenHeightLogical: 0, visibleHeightDesign: 1600 })).toEqual(S7_SAFE_INSETS_DEFAULT);
    expect(computeS7SafeInsets({ screenHeightLogical: 800, visibleHeightDesign: 0 })).toEqual(S7_SAFE_INSETS_DEFAULT);
  });

  it('基础：scale=可视/屏高；顶=状态栏+8、底=12（无胶囊/无安全区）', () => {
    // screenH 800, 可视 1600 → scale 2；状态栏 40 → top=(40+8)*2=96；bottom=12*2=24
    const r = computeS7SafeInsets({ screenHeightLogical: 800, visibleHeightDesign: 1600, statusBarHeight: 40 });
    expect(r.top).toBe(96);
    expect(r.bottom).toBe(24);
  });

  it('缺状态栏高 → 按 20', () => {
    const r = computeS7SafeInsets({ screenHeightLogical: 800, visibleHeightDesign: 800 }); // scale 1
    expect(r.top).toBe(28); // (20+8)*1
  });

  it('有胶囊：顶取 max(状态栏+8, 胶囊底+8)', () => {
    // 状态栏 40→48；胶囊底 60→68 → 取 68；scale 2 → 136
    const r = computeS7SafeInsets({ screenHeightLogical: 800, visibleHeightDesign: 1600, statusBarHeight: 40, menuButtonBottom: 60 });
    expect(r.top).toBe(136);
  });

  it('有底部安全区：底取 max(12, 屏高-safeArea.bottom+8)', () => {
    // 屏高 800、safeArea.bottom 780 → 800-780+8=28 → ×scale2 = 56
    const r = computeS7SafeInsets({ screenHeightLogical: 800, visibleHeightDesign: 1600, statusBarHeight: 40, safeAreaBottom: 780 });
    expect(r.bottom).toBe(56);
  });
});

describe('G0 · computeS7UsableBand', () => {
  it('中心原点：上/下可用边界 + 中心', () => {
    const band = computeS7UsableBand(1600, { top: 96, bottom: 24 });
    expect(band.usableTopY).toBe(800 - 96); // 704
    expect(band.usableBottomY).toBe(-800 + 24); // -776
    expect(band.usableCenterY).toBe((704 - 776) / 2); // -36
  });
  it('可视高<=0 → 退化（仅按 insets 偏移）', () => {
    const band = computeS7UsableBand(0, { top: 100, bottom: 50 });
    expect(band.usableTopY).toBe(-100);
    expect(band.usableBottomY).toBe(50);
  });
});
