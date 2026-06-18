/**
 * 离线收益灰盒面板（C14b-1，Cocos Component）。
 *
 * 只做灰盒接线：展示可领取离线收益，点击领取调用 OfflineRewardPresenter.claim()，刷新结果与主界面。
 */
import { _decorator, Component, Label, Button } from 'cc';
import { OfflineRewardPresenter } from '../presenter/OfflineRewardPresenter';
import { pulseScale, showRewardSpark } from '../UiFx';

const { ccclass, property } = _decorator;

@ccclass('OfflineRewardPanel')
export class OfflineRewardPanel extends Component {
  @property(Label)
  amountLabel: Label | null = null;

  @property(Label)
  resultLabel: Label | null = null;

  @property(Button)
  claimButton: Button | null = null;

  private presenter: OfflineRewardPresenter | null = null;
  private onChanged: (() => void) | null = null;
  /** 真实领取成功时的反馈钩子（S5C-06，控制器注入音效播放）；可选，不影响业务流程。 */
  private onClaimSuccess: (() => void) | null = null;
  /** 本次领取结果文案是否仍在展示（避免与 amountLabel 同时显示造成重叠）。 */
  private resultShown = false;

  bind(presenter: OfflineRewardPresenter, onChanged: () => void, onClaimSuccess?: () => void): void {
    this.presenter = presenter;
    this.onChanged = onChanged;
    this.onClaimSuccess = onClaimSuccess ?? null;
    this.claimButton?.node.on(Button.EventType.CLICK, this.handleClaim, this);
    if (this.resultLabel) {
      // 主界面短文案：清掉编辑器默认占位文本，点击前不展示结果。
      this.resultLabel.string = '';
    }
  }

  refresh(): void {
    if (!this.presenter || !this.amountLabel) {
      return;
    }
    const vm = this.presenter.getViewModel();
    const r = vm.calculation.reward;
    if (vm.claimable) {
      // 有新的可领取离线收益：清空上一次的领取结果文案，避免与本次金额重叠。
      this.amountLabel.string = `可领取\n星币 ${r.starCoin}\n经验芯片 ${r.expChip}`;
      if (this.resultLabel) {
        this.resultLabel.string = '';
      }
      this.resultShown = false;
    } else if (this.resultShown) {
      // 刚领取过、暂无新收益：只展示领取结果，不重复展示"暂无离线收益"。
      this.amountLabel.string = '';
    } else {
      this.amountLabel.string = '暂无离线收益';
    }
  }

  private handleClaim(): void {
    if (!this.presenter) {
      return;
    }
    const result = this.presenter.claim();
    if (this.resultLabel) {
      this.resultLabel.string = result.granted
        ? `已领取\n星币 ${result.calculation.reward.starCoin}\n经验芯片 ${result.calculation.reward.expChip}`
        : '无可领取';
    }
    if (result.granted) {
      // S5C-06：真实领取成功反馈——结果文案轻脉冲 + 控制器注入的领取音效。
      // S6-ART-ENG-01：叠加奖励闪光（复用 ui_fx_reward_spark，失败安全静默）。
      if (this.resultLabel) {
        pulseScale(this.resultLabel.node);
        showRewardSpark(this.resultLabel.node);
      }
      this.onClaimSuccess?.();
    }
    this.resultShown = true;
    this.refresh();
    this.onChanged?.();
  }

  onDestroy(): void {
    this.claimButton?.node.off(Button.EventType.CLICK, this.handleClaim, this);
  }
}
