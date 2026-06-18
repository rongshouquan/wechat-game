/**
 * 一键升级灰盒面板（C14b-1，Cocos Component）。
 *
 * 只做灰盒接线：展示当前资源，点击按钮调用 UpgradePresenter.execute()，刷新结果与主界面。
 */
import { _decorator, Component, Label, Button } from 'cc';
import { AppContext } from '../presenter/AppContext';
import { UpgradePresenter } from '../presenter/UpgradePresenter';
import { pulseScale, showRewardSpark } from '../UiFx';

const { ccclass, property } = _decorator;

@ccclass('OneTapUpgradePanel')
export class OneTapUpgradePanel extends Component {
  @property(Label)
  resourceLabel: Label | null = null;

  @property(Label)
  resultLabel: Label | null = null;

  @property(Button)
  upgradeButton: Button | null = null;

  private ctx: AppContext | null = null;
  private presenter: UpgradePresenter | null = null;
  private onChanged: (() => void) | null = null;
  /** 真实升级成功时的反馈钩子（S5C-06，控制器注入音效播放）；可选，不影响业务流程。 */
  private onUpgradeSuccess: (() => void) | null = null;

  bind(ctx: AppContext, presenter: UpgradePresenter, onChanged: () => void, onUpgradeSuccess?: () => void): void {
    this.ctx = ctx;
    this.presenter = presenter;
    this.onChanged = onChanged;
    this.onUpgradeSuccess = onUpgradeSuccess ?? null;
    this.upgradeButton?.node.on(Button.EventType.CLICK, this.handleUpgrade, this);
    if (this.resultLabel) {
      // 主界面短文案：清掉编辑器默认占位文本，点击前不展示结果。
      this.resultLabel.string = '';
    }
  }

  refresh(): void {
    if (this.resourceLabel && this.ctx) {
      const r = this.ctx.playerState.resources;
      // 主界面短文案：资源拆短分行展示。
      this.resourceLabel.string = `星币 ${r.starCoin}\n经验芯片 ${r.expChip}`;
    }
  }

  private handleUpgrade(): void {
    if (!this.presenter) {
      return;
    }
    const result = this.presenter.execute();
    if (this.resultLabel) {
      this.resultLabel.string = result.applied ? `已升级 ${result.steps.length} 步` : '未升级';
    }
    if (result.applied) {
      // S5C-06：真实升级成功反馈——结果文案轻脉冲 + 控制器注入的升级音效。
      // S6-ART-ENG-01：叠加奖励闪光（复用 ui_fx_reward_spark，失败安全静默）。
      if (this.resultLabel) {
        pulseScale(this.resultLabel.node);
        showRewardSpark(this.resultLabel.node);
      }
      this.onUpgradeSuccess?.();
    }
    this.refresh();
    this.onChanged?.();
  }

  onDestroy(): void {
    this.upgradeButton?.node.off(Button.EventType.CLICK, this.handleUpgrade, this);
  }
}
