/**
 * 失败弹窗灰盒视图（C14b-1，Cocos Component）。
 *
 * 只做灰盒接线：展示失败原因 + 两条非广告挽留路径按钮（阶段2出口要求 >=2 条非广告路径）。
 * 点击某条路径调用 DefeatPresenter.selectPath()，把跳转意图交回控制器，并隐藏弹窗。
 */
import { _decorator, Component, Label, Button } from 'cc';
import { DefeatPresenter, DefeatViewModel } from '../presenter/DefeatPresenter';
import { DefeatAnalysisContext, DefeatReasonType, NavigationIntent, RetryPathType } from '../../core/DefeatAnalysisService';

const { ccclass, property } = _decorator;

/** 失败弹窗短文案：按失败原因类型展示，不显示长括号说明。 */
const REASON_TYPE_TEXT: Record<DefeatReasonType, string> = {
  insufficient_output: '输出不足',
  insufficient_durability: '承伤不足',
  insufficient_healing: '治疗不足',
  insufficient_level: '等级不足',
  formation_issue: '阵容缺位',
};

/** 失败弹窗短文案：按挽留路径类型展示，不显示 retry.xxx 开发 key。 */
const RETRY_PATH_TYPE_TEXT: Record<RetryPathType, string> = {
  one_tap_upgrade: '去升级',
  adjust_formation: '调整阵容',
  replay_previous_level: '重刷上一关',
  switch_hero: '替换角色',
};

@ccclass('DefeatDialog')
export class DefeatDialog extends Component {
  @property(Label)
  reasonLabel: Label | null = null;

  @property(Button)
  path1Button: Button | null = null;

  @property(Label)
  path1Label: Label | null = null;

  @property(Button)
  path2Button: Button | null = null;

  @property(Label)
  path2Label: Label | null = null;

  private presenter: DefeatPresenter | null = null;
  private onNavigate: ((intent: NavigationIntent) => void) | null = null;
  private vm: DefeatViewModel | null = null;

  bind(presenter: DefeatPresenter, onNavigate: (intent: NavigationIntent) => void): void {
    this.presenter = presenter;
    this.onNavigate = onNavigate;
    this.path1Button?.node.on(Button.EventType.CLICK, this.handlePath1, this);
    this.path2Button?.node.on(Button.EventType.CLICK, this.handlePath2, this);
  }

  /** 由控制器在战斗失败后调用：分析失败并展示弹窗。 */
  show(context: DefeatAnalysisContext, previousLevelId?: string): void {
    if (!this.presenter) {
      return;
    }
    this.vm = this.presenter.show(context, previousLevelId);
    if (this.reasonLabel) {
      // 短文案：按失败原因类型展示固定短词，不显示长括号说明。
      this.reasonLabel.string = `失败原因：${REASON_TYPE_TEXT[this.vm.reason.type] ?? '未知'}`;
    }
    if (this.path1Label) {
      const path = this.vm.retryPaths[0];
      this.path1Label.string = path ? RETRY_PATH_TYPE_TEXT[path.type] ?? '' : '';
    }
    if (this.path2Label) {
      const path = this.vm.retryPaths[1];
      this.path2Label.string = path ? RETRY_PATH_TYPE_TEXT[path.type] ?? '' : '';
    }
    this.node.active = true;
  }

  hide(): void {
    this.node.active = false;
  }

  private select(index: number): void {
    if (!this.presenter || !this.vm) {
      return;
    }
    const path = this.vm.retryPaths[index];
    if (!path) {
      return;
    }
    const intent = this.presenter.selectPath(path);
    this.hide();
    this.onNavigate?.(intent);
  }

  private handlePath1(): void {
    this.select(0);
  }

  private handlePath2(): void {
    this.select(1);
  }

  onDestroy(): void {
    this.path1Button?.node.off(Button.EventType.CLICK, this.handlePath1, this);
    this.path2Button?.node.off(Button.EventType.CLICK, this.handlePath2, this);
  }
}
