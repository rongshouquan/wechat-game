/**
 * 胜利结算灰盒面板（C14b-1，Cocos Component）。
 *
 * 只做灰盒接线：展示结算奖励与"下一步"目标，点击下一步调用 VictoryPresenter.adoptNextTarget()，
 * 把跳转意图交回控制器并隐藏面板，形成"打完一关 -> 立刻知道下一步"的闭环出口。
 */
import { _decorator, Component, Label, Button } from 'cc';
import { VictoryPresenter } from '../presenter/VictoryPresenter';
import { VictoryFlowResult } from '../../core/VictoryFlowService';
import { NavigationIntent } from '../../core/RecommendedTargetService';
import { TARGET_TYPE_TEXT } from './RecommendedTargetView';
import { showRewardSpark } from '../UiFx';

const { ccclass, property } = _decorator;

@ccclass('VictorySettlementPanel')
export class VictorySettlementPanel extends Component {
  @property(Label)
  resultLabel: Label | null = null;

  @property(Label)
  nextTargetLabel: Label | null = null;

  @property(Button)
  nextButton: Button | null = null;

  private presenter: VictoryPresenter | null = null;
  private onNavigate: ((intent: NavigationIntent) => void) | null = null;
  private result: VictoryFlowResult | null = null;

  bind(presenter: VictoryPresenter, onNavigate: (intent: NavigationIntent) => void): void {
    this.presenter = presenter;
    this.onNavigate = onNavigate;
    this.nextButton?.node.on(Button.EventType.CLICK, this.handleNext, this);
  }

  /** 由控制器在战斗胜利后调用：展示结算结果与刷新出的下一目标。 */
  show(result: VictoryFlowResult): void {
    this.result = result;
    const s = result.settlement;
    if (this.resultLabel) {
      // 短文案：避免长括号说明，按结果给固定短句。
      this.resultLabel.string = s.granted ? '通关，奖励已发放' : s.duplicate ? '通关，奖励已领过' : '通关，奖励未发放';
    }
    if (this.nextTargetLabel) {
      // 短文案：不显示 recommend.xxx 开发 key 与长括号说明，按目标类型展示固定短词。
      const text = TARGET_TYPE_TEXT[result.recommendedTarget.primary.type] ?? '查看详情';
      this.nextTargetLabel.string = `下一步：${text}`;
    }
    this.node.active = true;
    // S6-ART-ENG-01：胜利结算出现时叠加奖励闪光（复用 ui_fx_reward_spark，失败安全静默）。
    showRewardSpark(this.resultLabel?.node);
  }

  hide(): void {
    this.node.active = false;
  }

  private handleNext(): void {
    if (!this.presenter || !this.result) {
      return;
    }
    const intent = this.presenter.adoptNextTarget(this.result);
    this.hide();
    this.onNavigate?.(intent);
  }

  onDestroy(): void {
    this.nextButton?.node.off(Button.EventType.CLICK, this.handleNext, this);
  }
}
