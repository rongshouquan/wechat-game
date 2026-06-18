import { describe, it, expect } from 'vitest';
import { NINE_SLICE_INSETS, UI_ASSET_PATHS, uiAssetPath } from '../assets/scripts/ui/UiAssetPaths';
import {
  ARROW_BUTTON_NAMES,
  BATTLE_HP_BAR,
  BATTLE_RESULT_COLOR,
  BATTLE_SIDE_STYLE,
  BUTTON_TRAIL_ICON,
  CLAIM_HIGHLIGHT,
  FX_MAX_DURATION_MS,
  PANEL_BG_SKIN,
  PANEL_TITLE_BARS,
  REWARD_SPARK,
  hpFillRatio,
} from '../assets/scripts/ui/UiPolishSpec';

/** S6-ART-ENG-01 规格引用的全部 assetId（任何新增引用都必须经此校验，防散落硬编码）。 */
function collectSpecAssetIds(): string[] {
  const ids: string[] = [];
  for (const spec of Object.values(PANEL_BG_SKIN)) {
    ids.push(spec.assetId);
  }
  for (const bar of PANEL_TITLE_BARS) {
    ids.push(bar.assetId);
    if (bar.leadingIconAssetId) {
      ids.push(bar.leadingIconAssetId);
    }
  }
  ids.push(BUTTON_TRAIL_ICON.assetId);
  ids.push(BATTLE_HP_BAR.bgAssetId, BATTLE_HP_BAR.fillAssetId);
  ids.push(REWARD_SPARK.assetId, CLAIM_HIGHLIGHT.assetId);
  return ids;
}

describe('S6-ART-ENG-01 UiAssetPaths - 路径真源', () => {
  it('登记 P57 已接入的全部 41 件资源', () => {
    expect(Object.keys(UI_ASSET_PATHS)).toHaveLength(41);
  });

  it('路径均位于 atlases/ 下且以 assetId 结尾（assetId = 文件名，可追踪）', () => {
    for (const [assetId, path] of Object.entries(UI_ASSET_PATHS)) {
      expect(path.startsWith('atlases/')).toBe(true);
      expect(path.endsWith(`/${assetId}`)).toBe(true);
    }
  });

  it('uiAssetPath 已登记返回路径、未登记返回 null', () => {
    expect(uiAssetPath('ui_fx_reward_spark')).toBe('atlases/ui/ui_common/ui_fx_reward_spark');
    expect(uiAssetPath('not_exists')).toBeNull();
  });

  it('9-slice inset 只登记已接入资源，且四向均为正值（《UI视觉稿与切图规格》§4.1.1）', () => {
    for (const [assetId, insets] of Object.entries(NINE_SLICE_INSETS)) {
      expect(UI_ASSET_PATHS[assetId], assetId).toBeDefined();
      expect(insets.left).toBeGreaterThan(0);
      expect(insets.right).toBeGreaterThan(0);
      expect(insets.top).toBeGreaterThan(0);
      expect(insets.bottom).toBeGreaterThan(0);
    }
    // 按钮底板保持 P57-1 已验收现状，不得登记 inset（避免改变已验收外观）。
    for (const assetId of Object.keys(NINE_SLICE_INSETS)) {
      expect(assetId.startsWith('ui_btn_')).toBe(false);
    }
  });
});

describe('S6-ART-ENG-01 UiPolishSpec - P0 复用与降级口径', () => {
  it('规格引用的全部 assetId 均已在 UI_ASSET_PATHS 登记（0 新增资源）', () => {
    for (const assetId of collectSpecAssetIds()) {
      expect(UI_ASSET_PATHS[assetId], assetId).toBeDefined();
    }
  });

  it('底板皮肤覆盖主界面三常驻区与胜利/失败弹窗', () => {
    expect(Object.keys(PANEL_BG_SKIN).sort()).toEqual(
      ['DefeatDialog', 'OfflinePanel', 'RecommendedTarget', 'UpgradePanel', 'VictoryPanel'].sort(),
    );
    for (const spec of Object.values(PANEL_BG_SKIN)) {
      expect(spec.paddingX).toBeGreaterThan(0);
      expect(spec.paddingY).toBeGreaterThan(0);
      expect(spec.opacity).toBeGreaterThan(0);
      expect(spec.opacity).toBeLessThanOrEqual(255);
    }
  });

  it('OfflinePanel 顶部预留多行 claimable 文案安全余量（S6-ART-P0-FIX-02）', () => {
    expect(PANEL_BG_SKIN.OfflinePanel.extraTopPadding ?? 0).toBeGreaterThan(0);
    expect(PANEL_BG_SKIN.RecommendedTarget.extraTopPadding ?? 0).toBe(0);
    expect(PANEL_BG_SKIN.UpgradePanel.extraTopPadding ?? 0).toBe(0);
  });

  it('失败弹窗标题条带 ui_icon_warning 前置警示', () => {
    const defeat = PANEL_TITLE_BARS.find((b) => b.panelName === 'DefeatDialog');
    expect(defeat?.leadingIconAssetId).toBe('ui_icon_warning');
    expect(defeat?.leadingIconSize ?? 0).toBeGreaterThan(0);
  });

  it('"前往"语义按钮箭头覆盖采纳目标与下一目标', () => {
    expect([...ARROW_BUTTON_NAMES].sort()).toEqual(['AdoptButton', 'NextButton'].sort());
    expect(BUTTON_TRAIL_ICON.assetId).toBe('ui_icon_arrow');
  });

  it('奖励闪光时长在 P0 上限 1200ms 内（任务包 §6.2）', () => {
    expect(REWARD_SPARK.durationMs).toBeGreaterThan(0);
    expect(REWARD_SPARK.durationMs).toBeLessThanOrEqual(FX_MAX_DURATION_MS);
    expect(FX_MAX_DURATION_MS).toBe(1200);
  });

  it('可领取高亮为弱高亮：不全遮（透明度 <255）且外扩为正', () => {
    expect(CLAIM_HIGHLIGHT.opacity).toBeLessThan(255);
    expect(CLAIM_HIGHLIGHT.opacity).toBeGreaterThan(0);
    expect(CLAIM_HIGHLIGHT.margin).toBeGreaterThan(0);
  });

  it('敌我识别：侧名与识别色均不同，HP 条留有内缩', () => {
    expect(BATTLE_SIDE_STYLE.player.label).not.toBe(BATTLE_SIDE_STYLE.enemy.label);
    expect(BATTLE_SIDE_STYLE.player.color).not.toEqual(BATTLE_SIDE_STYLE.enemy.color);
    expect(BATTLE_RESULT_COLOR.win).not.toEqual(BATTLE_RESULT_COLOR.lose);
    expect(BATTLE_HP_BAR.innerPadding).toBeGreaterThan(0);
    expect(BATTLE_HP_BAR.width).toBeGreaterThan(BATTLE_HP_BAR.innerPadding * 2);
    expect(BATTLE_HP_BAR.height).toBeGreaterThan(BATTLE_HP_BAR.innerPadding * 2);
  });
});

describe('S6-ART-ENG-01 hpFillRatio - 坏数据降级', () => {
  it('正常比例', () => {
    expect(hpFillRatio(50, 100)).toBe(0.5);
    expect(hpFillRatio(100, 100)).toBe(1);
    expect(hpFillRatio(0, 100)).toBe(0);
  });

  it('钳制到 [0,1]', () => {
    expect(hpFillRatio(150, 100)).toBe(1);
    expect(hpFillRatio(-10, 100)).toBe(0);
  });

  it('maxHp 非正或非有限值时按 0 处理（视图只显示空条，不抛错）', () => {
    expect(hpFillRatio(10, 0)).toBe(0);
    expect(hpFillRatio(10, -5)).toBe(0);
    expect(hpFillRatio(Number.NaN, 100)).toBe(0);
    expect(hpFillRatio(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
