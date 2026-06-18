/**
 * 主场景控制器 / 灰盒装配根（C14b-1，Cocos Component）。
 *
 * 职责（灰盒）：
 * - 启动时装配会话：加载配置、选择存储适配器（真机 wx / 编辑器内存）、建埋点 Sink、建 AppContext 与各 Presenter。
 * - 把 Presenter 绑定到各子视图/面板，统一刷新。
 * - "开始战斗"按真实阵容 + 关卡配置跑 BattleEngine 模拟（S5C-02），胜负与失败上下文均来自真实战斗结果；
 *   战斗过程经 BattlePlaybackService 转为帧序列、由 BattleView 播放后再进结果面板（S5C-04），
 *   播放期间禁止重复开战；奖励/防重/关卡推进语义不变。
 * - 把各 Presenter 返回的跳转意图经 NavigationService 解析为单场景面板切换并执行（S5C-03）：
 *   已有面板的意图切回主界面常态（备战意图同时选定关卡），未开放页面展示可见兜底提示，不吞掉点击。
 *
 * 注意：本控制器是表现层装配，不含任何战斗/数值/结算核心逻辑（全部委托给 C14a Presenter 与底层纯 TS 服务）。
 * 配置加载失败、奖励缺失等异常仅打日志，不在灰盒阶段做健壮兜底（留正式 UI 阶段处理）。
 */
import { _decorator, Button, Color, Component, Label, Node, resources, JsonAsset } from 'cc';
import {
  AdConfig,
  EnemyConfig,
  EnemyGroupConfig,
  HeroConfig,
  LevelConfig,
  RewardConfig,
  SkillConfig,
} from '../../config/ConfigTypes';
import { AnalyticsService } from '../../analytics/AnalyticsService';
import { LocalAnalyticsSink } from '../../analytics/LocalAnalyticsSink';
import {
  BrowserLocalStorageAdapter,
  MemoryStorageAdapter,
  SaveStorageAdapter,
  WxStorageAdapter,
} from '../../save/SaveStorageAdapter';
import { AppContext } from '../presenter/AppContext';
import { MainPresenter } from '../presenter/MainPresenter';
import { UpgradePresenter } from '../presenter/UpgradePresenter';
import { OfflineRewardPresenter } from '../presenter/OfflineRewardPresenter';
import { DefeatPresenter } from '../presenter/DefeatPresenter';
import { VictoryPresenter } from '../presenter/VictoryPresenter';
import { NavigationIntent } from '../../core/RecommendedTargetService';
import { resolveNavigationIntent } from '../../core/NavigationService';
import { launchLevelBattle } from '../../core/BattleLaunchService';
import { buildBattlePlayback } from '../../core/BattlePlaybackService';
// RT-07C-1：S7 配置运行时（纯 TS）+ 其 Cocos 资源读取适配层，仅用于启动链路预加载并私有持有，不消费、不接战斗。
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { createCocosS7TableReader } from '../../config/s7/S7ConfigResourceReader';
// RT-07D-1：S7 dry-run 开发探针所需的纯 TS 运行壳 / 默认 dry-run 阵容 / 默认主线进度（仅调试用，不接 UI/结算/存档/服务器）。
import { S7BattleRunService } from '../../core/s7/S7BattleRunService';
import { createS7DefaultDryRunLineup } from '../../core/s7/S7DefaultBattleLineup';
import { createDefaultS7MainlineProgress } from '../../core/s7/S7MainlineProgress';
import { AudioFeedback } from '../../audio/AudioFeedback';
import { popIn, pulseScale } from '../UiFx';
import { BattleView } from './BattleView';
import { RecommendedTargetView } from './RecommendedTargetView';
import { OneTapUpgradePanel } from './OneTapUpgradePanel';
import { OfflineRewardPanel } from './OfflineRewardPanel';
import { DefeatDialog } from './DefeatDialog';
import { VictorySettlementPanel } from './VictorySettlementPanel';
import { applyGrayboxButtonSkin } from '../GrayboxUiSkin';
import { applyPortraitLayout } from '../PortraitGrayboxLayout';
import { applyMainScenePolish } from '../UiPolishSkin';

const { ccclass, property } = _decorator;

/** 导航可见反馈提示的展示时长（秒），到时自动隐藏。 */
const NAVIGATION_NOTICE_SECONDS = 2.5;

/**
 * 点击音效覆盖的核心按钮（S5C-06，按《S5C-06 任务包》§5.5 最小触发范围）：
 * 开始战斗、主界面采纳目标、失败路径、胜利下一步。升级/领取按钮不播点击音，
 * 由各自的成功音效（sfx_upgrade / sfx_reward_claim）承担反馈，避免双音叠放。
 */
const CLICK_SFX_BUTTON_NAMES: ReadonlySet<string> = new Set([
  'StartBattleButton',
  'AdoptButton',
  'Path1Button',
  'Path2Button',
  'NextButton',
]);

/**
 * RT-07D-1 固定开发用 dry-run 种子（显式常量；绝不由 Date.now / Math.random / 账号 / 设备 / openid / unionid 生成）。
 */
const RT07D1_DEV_DRY_RUN_SEED = 'rt07d1-dev-dry-run-seed';

@ccclass('MainSceneController')
export class MainSceneController extends Component {
  @property(RecommendedTargetView)
  recommendedTargetView: RecommendedTargetView | null = null;

  @property(OneTapUpgradePanel)
  oneTapUpgradePanel: OneTapUpgradePanel | null = null;

  @property(OfflineRewardPanel)
  offlineRewardPanel: OfflineRewardPanel | null = null;

  @property(DefeatDialog)
  defeatDialog: DefeatDialog | null = null;

  @property(VictorySettlementPanel)
  victorySettlementPanel: VictorySettlementPanel | null = null;

  private ctx: AppContext | null = null;
  /** RT-07C-1：预加载并私有持有的 S7 配置运行时（仅验证可加载，不消费、不接战斗）；加载失败保持 null。 */
  private s7Runtime: S7ConfigRuntime | null = null;
  private mainPresenter: MainPresenter | null = null;
  private victoryPresenter: VictoryPresenter | null = null;
  /** 导航可见反馈 Label（S5C-03，运行时动态创建，不改 scene 资源），懒创建。 */
  private navigationNoticeLabel: Label | null = null;
  /** 战斗过程视图（S5C-04，运行时动态创建，不改 scene 资源），懒创建。 */
  private battleView: BattleView | null = null;
  /** 播放期间为 true：禁止重复开战。 */
  private battleInProgress = false;
  /** "开始战斗"按钮引用（启动时按节点名定位），用于战斗期间禁用。 */
  private startBattleButton: Button | null = null;
  /** 音频反馈组件（S5C-06，挂在控制器节点上）；加载/播放失败安全静默。 */
  private audio: AudioFeedback | null = null;
  private currentLevelId = '';
  private levels: LevelConfig[] = [];
  private heroes: HeroConfig[] = [];
  private skills: SkillConfig[] = [];
  private enemies: EnemyConfig[] = [];
  private enemyGroups: EnemyGroupConfig[] = [];

  onLoad(): void {
    void this.bootstrap();
  }

  /** 装配会话：加载配置 -> 建上下文/Presenter -> 绑定视图 -> 首刷。 */
  private async bootstrap(): Promise<void> {
    const levels = await this.loadJson<LevelConfig[]>('configs/level_config.sample');
    const rewards = await this.loadJson<RewardConfig[]>('configs/reward_config.sample');
    // S5C-02 真实战斗所需配置：英雄/技能/敌人/敌组，缺一不可（缺失则无法用真实战斗驱动胜负）。
    const heroes = await this.loadJson<HeroConfig[]>('configs/hero_config.sample');
    const skills = await this.loadJson<SkillConfig[]>('configs/skill_config.sample');
    const enemies = await this.loadJson<EnemyConfig[]>('configs/enemy_config.sample');
    const enemyGroups = await this.loadJson<EnemyGroupConfig[]>('configs/enemy_group_config.sample');
    if (!levels || !rewards || !heroes || !skills || !enemies || !enemyGroups) {
      console.error('[MainSceneController] 配置加载失败，无法装配');
      return;
    }
    this.levels = levels;
    this.heroes = heroes;
    this.skills = skills;
    this.enemies = enemies;
    this.enemyGroups = enemyGroups;

    // 广告配置：加载失败【不阻断灰盒启动】（广告为可选变现路径，灰盒本就无广告入口），
    // 但必须明确报错而非静默忽略；失败时不传 adConfigs，AppContext 退化为不持有广告运行时服务。
    const adConfigs = await this.loadJson<AdConfig[]>('configs/ad_config.sample');
    if (!adConfigs) {
      console.error('[MainSceneController] ad_config 加载失败，本次启动不装配广告运行时服务');
    }

    const analytics = new AnalyticsService({
      sessionId: `dev_user_${Date.now()}`,
      sinks: [new LocalAnalyticsSink()],
    });

    // S5C-01：不再传写死阵容。拥有/上阵真源为存档内 playerState.ownedHeroIds / onFieldHeroIds；
    // 新档由 AppContext 按 Ron 确认的默认规则补齐（初始拥有并上阵 hero_isen / hero_mia）。
    this.ctx = new AppContext({
      adapter: this.pickStorageAdapter(),
      analytics,
      levels,
      rewards,
      // 传入则 AppContext 构造 adService / adFrequency / adRewardFlow / defeatSupply（默认 MockAdAdapter，不接真实 SDK）。
      adConfigs: adConfigs ?? undefined,
    });

    this.mainPresenter = new MainPresenter(this.ctx);
    this.victoryPresenter = new VictoryPresenter(this.ctx);

    // S5C-06：音频反馈组件（预加载 5 条程序化短音效，失败安全静默）。
    this.audio = this.node.addComponent(AudioFeedback);

    this.recommendedTargetView?.bind(this.mainPresenter, (intent) => this.handleNavigation(intent));
    this.oneTapUpgradePanel?.bind(
      this.ctx,
      new UpgradePresenter(this.ctx),
      () => this.refreshAll(),
      () => this.audio?.play('upgrade'),
    );
    this.offlineRewardPanel?.bind(
      new OfflineRewardPresenter(this.ctx),
      () => this.refreshAll(),
      () => this.audio?.play('reward_claim'),
    );
    this.defeatDialog?.bind(new DefeatPresenter(this.ctx), (intent) => this.handleNavigation(intent));
    this.victorySettlementPanel?.bind(this.victoryPresenter, (intent) => this.handleNavigation(intent));

    // P57-1 最小可见替换：用 P57 已接入的 ui_common 按钮底板皮肤化现有灰盒按钮。
    // 在 hide() 之前应用，确保失败/胜利面板内按钮此刻仍处激活态、可被遍历到；
    // 失败仅降级保留原灰盒外观，绝不阻断装配。
    try {
      await applyGrayboxButtonSkin(this.sceneRoot());
    } catch (err) {
      console.warn('[MainSceneController] 灰盒按钮皮肤应用失败（已忽略，不阻断装配）', err);
    }

    // P57-4 运行时竖屏自适应：按真机可视高度与安全区重新分布四个主区域。
    try {
      applyPortraitLayout(this.sceneRoot());
    } catch (err) {
      console.warn('[MainSceneController] 竖屏布局应用失败（已忽略，不阻断装配）', err);
    }

    // S6-ART-ENG-01 P0 观感补强：面板底板/标题条/按钮箭头（复用 P57 资源，运行时挂载）。
    // 须在 enterMainState 隐藏结果面板前执行，保证胜利/失败弹窗子内容可被量到；
    // 内部全程失败安全静默，仅降级保留灰盒外观，不阻断装配。
    // 先刷新一次面板文案（如离线收益"可领取"多行文案），再量底板尺寸，
    // 避免底板按刷新前的占位文案尺寸生成、刷新后文案顶到底板边缘（S6-ART-QA-01 真机反馈）。
    this.refreshAll();
    applyMainScenePolish(this.sceneRoot());

    // S5C-04：定位"开始战斗"按钮（战斗播放期间禁用，禁用态底板由 GrayboxUiSkin 提供）。
    this.startBattleButton =
      this.findNodeByName(this.sceneRoot(), 'StartBattleButton')?.getComponent(Button) ?? null;

    // S5C-06：统一按钮反馈——全部按钮点击轻脉冲，核心按钮叠加点击音效。
    // 须在 enterMainState 隐藏结果面板前遍历，保证面板内按钮可被找到（同皮肤层时序约定）。
    this.attachButtonFeedback(this.sceneRoot());

    this.currentLevelId = this.firstUnclearedLevelId(levels);
    this.enterMainState();
    this.refreshAll();

    // RT-07C-1：主界面常态装配完成后，独立预加载并持有 S7ConfigRuntime（仅验证可加载，不消费、不接战斗/AppContext）。
    await this.preloadS7ConfigRuntime();
  }

  /**
   * RT-07C-1：在 Cocos 启动链路预加载并私有持有 S7ConfigRuntime（43 张 S7 表）。
   * 仅证明运行时能从 cc.resources 完成 S7 配置装配与校验：成功记录 version 与表数；
   * 失败明确 console.error 且保持 s7Runtime=null，绝不静默补空表或伪造 runtime。
   * 严格边界：不消费该 runtime、不传入旧 AppContext、不跑 S7 战斗，
   * 不接结算 / 奖励 / 主线推进 / 存档 / 服务器，不生成 runSeed。
   */
  private async preloadS7ConfigRuntime(): Promise<void> {
    try {
      const runtime = await S7ConfigRuntime.load(createCocosS7TableReader());
      this.s7Runtime = runtime;
      console.log(
        '[MainSceneController] S7 配置运行时预加载完成',
        `version=${runtime.version}`,
        `tables=${runtime.tableNames.length}`,
      );
      // RT-07D-1：预加载成功且已持有 runtime 后，跑一次本地 dry-run 开发探针（仅调试日志，错误自包含，不影响预加载结论）。
      this.runS7DryRunProbe();
    } catch (err) {
      // 不静默兜底、不伪造 runtime：保持 s7Runtime=null 并明确报错。
      this.s7Runtime = null;
      console.error('[MainSceneController] S7 配置运行时预加载失败', err);
    }
  }

  /**
   * RT-07D-1：S7 最小 dry-run 开发探针（仅在 S7ConfigRuntime 预加载成功后跑一次）。
   * 输入固定：默认主线进度（n001）+ 默认三舰 dry-run 阵容（注意：这是 dry-run 阵容，不是正式玩家阵容，也不是 5 舰阵容）
   * + 固定开发种子常量，经 S7BattleRunService 跑出结果，仅 console.log nodeId/battleSeed/winner/hintCode/durationSec。
   * 严格边界（仅调试观测、不应用结果）：不接 BattleView / 战报页 / 胜负弹窗，不结算、不发奖励、不应用 rewardAnchorRef、
   * 不推进主线、不调 completeS7Node、不写存档、不接服务器；种子为固定常量，绝不由时间/随机/账号/设备/openid/unionid 生成。
   * 错误自包含（本方法内 try/catch），不影响预加载结论与正式启动流程。
   */
  private runS7DryRunProbe(): void {
    const runtime = this.s7Runtime;
    if (!runtime) {
      return;
    }
    try {
      const out = new S7BattleRunService().run({
        runtime,
        progress: createDefaultS7MainlineProgress(),
        runSeed: RT07D1_DEV_DRY_RUN_SEED,
        lineup: createS7DefaultDryRunLineup(),
      });
      console.log(
        '[MainSceneController] S7 dry-run 探针 (debug only / no settlement / no save / no UI result applied)',
        `nodeId=${out.context.nodeId}`,
        `battleSeed=${out.request.battleSeed}`,
        `winner=${out.result.winner}`,
        `hintCode=${out.summary.hintCode}`,
        `durationSec=${out.result.durationSec}`,
      );
    } catch (err) {
      console.error('[MainSceneController] S7 dry-run 探针失败（仅调试，不影响正式流程）', err);
    }
  }

  /**
   * 进入战斗（S5C-02/S5C-04）：胜负由真实战斗模拟决定（模拟即时完成），
   * 战斗过程经 BattlePlaybackService 转为帧序列、由 BattleView 按真实日志顺序播放，
   * 播放结束后再进既有结算/失败弹窗流程。播放期间 battleInProgress 置位、开战按钮禁用，
   * 禁止重复开战。BattleView 不可用（异常缺 Canvas）时降级为即时结算，不阻断主流程。
   */
  onStartBattle(): void {
    if (this.battleInProgress) {
      return;
    }
    if (!this.ctx || !this.victoryPresenter) {
      return;
    }
    this.victoryPresenter.startLevel(this.currentLevelId);
    console.log('[MainSceneController] 进入战斗', this.currentLevelId);

    let launch: ReturnType<typeof launchLevelBattle>;
    try {
      launch = launchLevelBattle({
        levelId: this.currentLevelId,
        levels: this.levels,
        enemyGroups: this.enemyGroups,
        enemies: this.enemies,
        heroes: this.heroes,
        skills: this.skills,
        playerState: this.ctx.playerState,
      });
    } catch (err) {
      console.error('[MainSceneController] 真实战斗发起失败（配置/阵容数据错误）', err);
      return;
    }

    const foughtLevelId = this.currentLevelId;
    const battle = launch.levelResult.battle;
    console.log(
      '[MainSceneController] 战斗结束',
      foughtLevelId,
      battle.winner,
      `${battle.durationSec}s`,
      battle.failReason ?? '',
    );

    const view = this.ensureBattleView();
    if (!view) {
      this.finishBattle(foughtLevelId, launch);
      return;
    }
    this.battleInProgress = true;
    this.setStartBattleEnabled(false);
    this.enterBattleState();
    view.play(buildBattlePlayback(launch.levelResult), foughtLevelId, () =>
      this.finishBattle(foughtLevelId, launch),
    );
  }

  /**
   * 播放结束（或降级路径）后的结果处理：沿用 S5C-02 既有语义——
   * 胜利走真实结算并推进到下一未通关卡，失败用真实战报上下文驱动失败弹窗。
   */
  private finishBattle(foughtLevelId: string, launch: ReturnType<typeof launchLevelBattle>): void {
    this.battleInProgress = false;
    this.setStartBattleEnabled(true);
    if (!this.victoryPresenter) {
      return;
    }

    if (launch.levelResult.win) {
      const result = this.victoryPresenter.settleVictory(
        foughtLevelId,
        Math.round(launch.levelResult.battle.durationSec * 1000),
      );
      // 真实关卡推进：胜利后前进到下一未通关卡，再次开战即打新关。
      this.currentLevelId = this.firstUnclearedLevelId(this.levels);
      this.refreshAll();
      this.enterResultState('victory');
      this.victorySettlementPanel?.show(result);
      // S5C-06：真实胜利结算出现时的音效与入场动效。
      this.audio?.play('battle_victory');
      if (this.victorySettlementPanel) {
        popIn(this.victorySettlementPanel.node);
      }
    } else {
      this.refreshAll();
      this.enterResultState('defeat');
      // launch.defeatContext 在失败分支必有值（launchLevelBattle 保证）；真实战报 + 真实阵容摘要。
      if (launch.defeatContext && this.defeatDialog) {
        this.defeatDialog.show(launch.defeatContext, this.previousLevelId());
        // S5C-06：真实失败弹窗出现时的音效（克制）与入场动效。
        this.audio?.play('battle_defeat');
        popIn(this.defeatDialog.node);
      }
    }
  }

  /**
   * 统一按钮反馈（S5C-06）：所有按钮点击时做轻脉冲缩放；任务包 §5.5 列出的核心按钮
   * 叠加 sfx_ui_click。监听为追加（node.on），不影响既有点击事件与业务回调。
   */
  private attachButtonFeedback(root: Node): void {
    for (const button of root.getComponentsInChildren(Button)) {
      const node = button.node;
      node.on(Button.EventType.CLICK, () => {
        pulseScale(node);
        if (CLICK_SFX_BUTTON_NAMES.has(node.name)) {
          this.audio?.play('ui_click');
        }
      });
    }
  }

  /** 进入战斗播放态：隐藏主面板与结果面板，独占展示战斗过程视图。 */
  private enterBattleState(): void {
    this.setMainPanelsVisible(false);
    this.defeatDialog?.hide();
    this.victorySettlementPanel?.hide();
  }

  private setStartBattleEnabled(enabled: boolean): void {
    if (this.startBattleButton) {
      this.startBattleButton.interactable = enabled;
    }
  }

  /**
   * 懒创建战斗过程视图：挂在 Canvas 下、复用离线收益区（屏幕竖直居中）的 y 位置
   * （战斗播放期间主面板全部隐藏，中部区域空闲）。找不到 Canvas 时返回 null，
   * 调用方降级为即时结算。
   */
  private ensureBattleView(): BattleView | null {
    if (this.battleView) {
      return this.battleView;
    }
    const canvas = this.findNodeByName(this.sceneRoot(), 'Canvas');
    if (!canvas) {
      console.warn('[MainSceneController] 未找到 Canvas，战斗过程展示降级为即时结算');
      return null;
    }
    const node = new Node('BattleView');
    node.layer = canvas.layer;
    canvas.addChild(node);
    const offline = this.findNodeByName(canvas, 'OfflinePanel');
    node.setPosition(0, offline ? offline.position.y : 0, 0);
    this.battleView = node.addComponent(BattleView);
    node.active = false;
    return this.battleView;
  }

  private refreshAll(): void {
    this.recommendedTargetView?.refresh();
    this.oneTapUpgradePanel?.refresh();
    this.offlineRewardPanel?.refresh();
  }

  /**
   * 真实导航（S5C-03）：把跳转意图经 NavigationService 解析为单场景面板切换并执行。
   * 备战意图（battle_prep）会选定目标关卡——下次「开始战斗」即打该关，
   * 含失败弹窗"重刷上一关"指定的已通关卡（重复通关奖励由 RewardLedger 防重，通关记录去重）。
   * 所有解析结果都带非空 notice 并展示，保证任何导航点击都有可见反馈、不被吞掉。
   */
  private handleNavigation(intent: NavigationIntent): void {
    const resolution = resolveNavigationIntent(intent, {
      knownLevelIds: this.levels.map((l) => l.levelId),
    });
    console.log('[MainSceneController] 导航', intent.scene, intent.params ?? {}, '->', resolution.kind);
    if (resolution.kind === 'battle_prep' && resolution.levelId) {
      this.currentLevelId = resolution.levelId;
    }
    this.enterMainState();
    this.refreshAll();
    this.showNavigationNotice(resolution.notice);
  }

  /** 展示导航反馈提示：数秒后自动隐藏；再次导航会重置倒计时并替换文案。 */
  private showNavigationNotice(text: string): void {
    if (!this.navigationNoticeLabel) {
      this.navigationNoticeLabel = this.createNavigationNoticeLabel();
    }
    const label = this.navigationNoticeLabel;
    if (!label) {
      return;
    }
    label.string = text;
    label.node.active = true;
    this.unschedule(this.hideNavigationNotice);
    this.scheduleOnce(this.hideNavigationNotice, NAVIGATION_NOTICE_SECONDS);
  }

  /** scheduleOnce 回调：用实例属性保持引用稳定，便于 unschedule 重置倒计时。 */
  private hideNavigationNotice = (): void => {
    if (this.navigationNoticeLabel) {
      this.navigationNoticeLabel.node.active = false;
    }
  };

  /**
   * 动态创建导航提示 Label：挂在 Canvas 下、放在推荐目标区与升级区之间的空档
   * （区块缺失时退回画面中心），层级取 Canvas 的 layer 保证被 UI 相机渲染。
   * 找不到 Canvas 时降级为仅日志（不阻断导航本身）。
   */
  private createNavigationNoticeLabel(): Label | null {
    const canvas = this.findNodeByName(this.sceneRoot(), 'Canvas');
    if (!canvas) {
      console.warn('[MainSceneController] 未找到 Canvas，导航提示降级为仅日志');
      return null;
    }
    const node = new Node('NavigationNotice');
    node.layer = canvas.layer;
    canvas.addChild(node);
    const recommended = this.findNodeByName(canvas, 'RecommendedTarget');
    const upgrade = this.findNodeByName(canvas, 'UpgradePanel');
    const y = recommended && upgrade ? (recommended.position.y + upgrade.position.y) / 2 : 0;
    node.setPosition(0, y, 0);
    const label = node.addComponent(Label);
    label.fontSize = 24;
    label.lineHeight = 32;
    label.color = new Color(255, 230, 120);
    node.active = false;
    return label;
  }

  private findNodeByName(root: Node, name: string): Node | null {
    if (root.name === name) {
      return root;
    }
    for (const child of root.children) {
      const found = this.findNodeByName(child, name);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /** 主界面常态可见性：推荐目标 / 升级 / 离线（底部按钮始终可见）。 */
  private setMainPanelsVisible(visible: boolean): void {
    if (this.recommendedTargetView) {
      this.recommendedTargetView.node.active = visible;
    }
    if (this.oneTapUpgradePanel) {
      this.oneTapUpgradePanel.node.active = visible;
    }
    if (this.offlineRewardPanel) {
      this.offlineRewardPanel.node.active = visible;
    }
  }

  /** 进入主界面常态：显示主面板，隐藏胜利/失败弹出面板（互斥）。 */
  private enterMainState(): void {
    this.setMainPanelsVisible(true);
    this.defeatDialog?.hide();
    this.victorySettlementPanel?.hide();
  }

  /** 进入结算态：隐藏主面板与另一结果面板，独占显示当前结果面板（show 由调用方触发）。 */
  private enterResultState(kind: 'victory' | 'defeat'): void {
    this.setMainPanelsVisible(false);
    if (kind === 'victory') {
      this.defeatDialog?.hide();
    } else {
      this.victorySettlementPanel?.hide();
    }
  }

  /** 向上回溯到场景根，供集中式皮肤层遍历全部按钮（含控制器直驱与各面板按钮）。 */
  private sceneRoot(): Node {
    let node: Node = this.node;
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }

  private loadJson<T>(path: string): Promise<T | null> {
    return new Promise((resolve) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err || !asset) {
          console.error('[MainSceneController] 加载配置失败', path, err);
          resolve(null);
          return;
        }
        resolve(asset.json as T);
      });
    });
  }

  /**
   * 存储适配器选择优先级：真机微信 -> 浏览器/编辑器预览 localStorage -> 内存兜底。
   * 编辑器预览无 wx 但有 localStorage，改用 BrowserLocalStorageAdapter 后，
   * 停止预览再播放也能恢复关键状态，便于验证阶段2出口"重进不丢关键状态"。
   */
  private pickStorageAdapter(): SaveStorageAdapter {
    const g = globalThis as unknown as {
      wx?: ConstructorParameters<typeof WxStorageAdapter>[0];
      localStorage?: ConstructorParameters<typeof BrowserLocalStorageAdapter>[0];
    };
    if (g.wx) {
      return new WxStorageAdapter(g.wx);
    }
    if (g.localStorage) {
      return new BrowserLocalStorageAdapter(g.localStorage);
    }
    return new MemoryStorageAdapter();
  }

  private firstUnclearedLevelId(levels: LevelConfig[]): string {
    const cleared = this.ctx?.playerState.clearedLevelIds ?? [];
    return levels.find((l) => !cleared.includes(l.levelId))?.levelId ?? levels[0]?.levelId ?? '';
  }

  private previousLevelId(): string | undefined {
    const cleared = this.ctx?.playerState.clearedLevelIds ?? [];
    return cleared.length > 0 ? cleared[cleared.length - 1] : undefined;
  }

}
