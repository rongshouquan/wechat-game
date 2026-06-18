/**
 * 灰盒 UI 视觉皮肤应用层（P57-1，最小可见替换）。
 *
 * 职责：把 P57 已接入的 ui_common 按钮底板套用到 main.scene 现有 7 个灰盒按钮上
 * （S5C-04 起 WinButton/LoseButton 已随手动胜负宣告一并移除），
 * 替换 Cocos 内置默认按钮贴图。仅替换 SpriteFrame，不改任何按钮节点结构、点击事件、
 * Presenter/View 逻辑或场景绑定。
 *
 * 设计：按"节点名 -> assetId"集中映射，资源路径统一走 UiAssetCatalog，不在此散落硬编码路径。
 * 加载失败时静默降级（保留原灰盒按钮外观），不阻断场景装配。
 *
 * 范围说明：main.scene 当前仅这 7 个按钮带 Sprite 节点；各面板（推荐目标/升级/离线/失败/胜利）
 * 暂无底板/状态条/奖励槽的 Sprite 节点，故其底板皮肤留待后续 UI 布局任务（非本次最小替换范围）。
 */
import { Node, Button, Sprite } from 'cc';
import { loadUiSpriteFrame } from './UiAssetCatalog';

/** 灰盒按钮节点名 -> P57 ui_common 按钮底板 assetId（正常态）。 */
const BUTTON_SKIN: Readonly<Record<string, string>> = {
  StartBattleButton: 'ui_btn_primary_9s',
  AdoptButton: 'ui_btn_primary_9s',
  UpgradeButton: 'ui_btn_primary_9s',
  ClaimButton: 'ui_btn_claim_9s',
  Path1Button: 'ui_btn_small_9s',
  Path2Button: 'ui_btn_small_9s',
  NextButton: 'ui_btn_primary_9s',
};

/** 所有被皮肤化按钮统一使用的禁用态底板。 */
const DISABLED_ASSET_ID = 'ui_btn_disabled_9s';

/**
 * 在场景根下查找全部按钮，按节点名套用 P57 按钮底板。
 * 同时覆盖控制器直驱（开始战斗）与各面板（领取/升级/路径/下一步）按钮，无需逐一编辑器绑定。
 */
export async function applyGrayboxButtonSkin(root: Node): Promise<void> {
  const buttons = root.getComponentsInChildren(Button);
  if (buttons.length === 0) {
    return;
  }
  const disabledFrame = await loadUiSpriteFrame(DISABLED_ASSET_ID);
  for (const button of buttons) {
    const assetId = BUTTON_SKIN[button.node.name];
    if (!assetId) {
      continue;
    }
    const normalFrame = await loadUiSpriteFrame(assetId);
    if (normalFrame) {
      const sprite = button.getComponent(Sprite);
      if (sprite) {
        sprite.spriteFrame = normalFrame;
      }
      // 场景中按钮 transition 为 Sprite 过渡：同步正常/悬停/按下三态，保证替换后状态一致。
      button.normalSprite = normalFrame;
      button.hoverSprite = normalFrame;
      button.pressedSprite = normalFrame;
    }
    if (disabledFrame) {
      button.disabledSprite = disabledFrame;
    }
  }
}
