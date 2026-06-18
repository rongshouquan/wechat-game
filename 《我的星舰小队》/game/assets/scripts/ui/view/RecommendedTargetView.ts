/**
 * 主界面推荐目标灰盒视图（C14b-1，Cocos Component）。
 *
 * 只做灰盒 UI 接线：从 MainPresenter 读取 view-model 刷新 Label，点击按钮回调 presenter 采纳目标。
 * 不含美术 polish，文案直接展示 textKey / reason 占位。
 */
import { _decorator, Component, Label, Button } from 'cc';
import { MainPresenter } from '../presenter/MainPresenter';
import { NavigationIntent, RecommendedTargetType } from '../../core/RecommendedTargetService';

const { ccclass, property } = _decorator;

/** 主界面/结算面板短文案：按推荐目标类型展示，避免直接暴露 reason 中的内部 id（如 hero_xxx）。 */
export const TARGET_TYPE_TEXT: Record<RecommendedTargetType, string> = {
  unconfirmed_reward: '领取奖励',
  offline_reward: '领取离线收益',
  defeat_recovery: '调整阵容',
  upgrade: '去升级',
  next_level: '挑战下一关',
  replay_level: '重刷上一关',
  safe_fallback: '选择关卡',
};

@ccclass('RecommendedTargetView')
export class RecommendedTargetView extends Component {
  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  reasonLabel: Label | null = null;

  @property(Label)
  offlineBadgeLabel: Label | null = null;

  @property(Button)
  adoptButton: Button | null = null;

  private presenter: MainPresenter | null = null;
  private onAdopt: ((intent: NavigationIntent) => void) | null = null;

  bind(presenter: MainPresenter, onAdopt: (intent: NavigationIntent) => void): void {
    this.presenter = presenter;
    this.onAdopt = onAdopt;
    this.adoptButton?.node.on(Button.EventType.CLICK, this.handleAdopt, this);
  }

  refresh(): void {
    if (!this.presenter) {
      return;
    }
    const vm = this.presenter.getViewModel();
    if (this.titleLabel) {
      // 主界面短文案：不直接显示 recommend.xxx 开发 key，用固定短标题。
      this.titleLabel.string = '下一步目标';
    }
    if (this.reasonLabel) {
      // 主界面短文案：按目标类型展示固定短词，不直接显示 reason 原文（含内部 id，过长）。
      this.reasonLabel.string = TARGET_TYPE_TEXT[vm.recommended.primary.type] ?? '查看详情';
    }
    if (this.offlineBadgeLabel) {
      this.offlineBadgeLabel.string = vm.hasClaimableOfflineReward ? '● 离线收益可领取' : '';
    }
  }

  private handleAdopt(): void {
    if (!this.presenter || !this.onAdopt) {
      return;
    }
    this.onAdopt(this.presenter.adoptPrimaryTarget());
  }

  onDestroy(): void {
    this.adoptButton?.node.off(Button.EventType.CLICK, this.handleAdopt, this);
  }
}
