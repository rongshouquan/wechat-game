/**
 * 程序化 UI 微动效助手（S5C-06；S6-ART-ENG-01 增加奖励闪光）。
 *
 * 只用 tween 与已接入贴图做轻反馈，不新增贴图/粒子/帧动画资源：
 * - pulseScale：按钮点击 / 领取成功 / 升级成功的轻脉冲。
 * - popIn：胜利结算 / 失败弹窗出现时的入场弹出。
 * - showRewardSpark：领取/升级/胜利的奖励闪光（复用 P57 ui_fx_reward_spark，
 *   参数见 UiPolishSpec.REWARD_SPARK，时长受 1200ms P0 上限约束）。
 * 每次启动前停掉目标节点上的旧 tween，防连点叠加导致缩放漂移；
 * 任何异常静默降级（无动效即无反馈），不影响业务流程。
 */
import { Node, Sprite, Tween, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { loadUiSpriteFrame } from './UiAssetCatalog';
import { REWARD_SPARK } from './UiPolishSpec';

const SCALE_ONE = new Vec3(1, 1, 1);

/** 轻脉冲：快速缩小再回弹，用于按钮点击与成功反馈。 */
export function pulseScale(node: Node, dip = 0.94, duration = 0.14): void {
  try {
    Tween.stopAllByTarget(node);
    node.setScale(SCALE_ONE);
    tween(node)
      .to(duration * 0.4, { scale: new Vec3(dip, dip, 1) })
      .to(duration * 0.6, { scale: SCALE_ONE })
      .start();
  } catch (err) {
    console.warn('[UiFx] pulseScale 失败（已忽略）', err);
  }
}

/** 入场弹出：从略小弹到原大，用于胜利/失败结算面板出现时的可读反馈。 */
export function popIn(node: Node, from = 0.9, duration = 0.18): void {
  try {
    Tween.stopAllByTarget(node);
    node.setScale(new Vec3(from, from, 1));
    tween(node)
      .to(duration * 0.7, { scale: new Vec3(1.03, 1.03, 1) })
      .to(duration * 0.3, { scale: SCALE_ONE })
      .start();
  } catch (err) {
    console.warn('[UiFx] popIn 失败（已忽略）', err);
  }
}

/**
 * 奖励闪光（S6-ART-ENG-01）：在锚点节点上方短暂弹出 ui_fx_reward_spark 并淡出销毁。
 * 闪光节点挂在锚点之下（随面板隐藏/销毁一并消失），纯展示、不拦截点击；
 * 资源加载失败或任何异常时静默放弃（仅少一个闪光），不阻塞奖励/升级/结算流程。
 */
export function showRewardSpark(anchor: Node | null | undefined): void {
  try {
    if (!anchor || !anchor.isValid) {
      return;
    }
    void loadUiSpriteFrame(REWARD_SPARK.assetId).then((frame) => {
      if (!frame || !anchor.isValid) {
        return;
      }
      const node = new Node('POLISH_RewardSpark');
      node.layer = anchor.layer;
      anchor.addChild(node);
      node.setPosition(0, REWARD_SPARK.offsetY, 0);
      node.addComponent(UITransform).setContentSize(REWARD_SPARK.size, REWARD_SPARK.size);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = frame;
      const opacity = node.addComponent(UIOpacity);
      const seconds = REWARD_SPARK.durationMs / 1000;
      node.setScale(REWARD_SPARK.fromScale, REWARD_SPARK.fromScale, 1);
      tween(node)
        .to(seconds * 0.35, { scale: new Vec3(REWARD_SPARK.toScale, REWARD_SPARK.toScale, 1) })
        .to(seconds * 0.25, { scale: SCALE_ONE })
        .start();
      tween(opacity)
        .delay(seconds * 0.55)
        .to(seconds * 0.45, { opacity: 0 })
        .call(() => {
          if (node.isValid) {
            node.destroy();
          }
        })
        .start();
    });
  } catch (err) {
    console.warn('[UiFx] showRewardSpark 失败（已忽略）', err);
  }
}
