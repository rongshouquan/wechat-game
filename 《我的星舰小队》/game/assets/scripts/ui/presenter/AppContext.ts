/**
 * 阶段2灰盒表现层 - 会话门面（C14a，纯 TS，不依赖 cc）。
 *
 * 把 C08 存档生命周期、PlayerState / RewardLedger、C13 埋点服务、以及配置表组装成一个
 * 供各 Presenter 共享的会话上下文。Cocos 视图层（C14b）只持有本上下文与 Presenter，
 * 不直接碰核心数据结构，保证核心逻辑仍可在 Node/Vitest 独立测试。
 *
 * 职责：
 * - 启动加载存档（无档则默认档），恢复关键状态（资源/等级/通关/奖励流水/最后在线时间）。
 * - 提供时间源、关卡->奖励查表、离线收益可领取判定。
 * - 提供切后台/关键变更后的落盘入口（persist）。
 * - 持有最近一次失败信息 lastDefeat，供推荐目标与结算流程消费。
 */
import { SaveStorageAdapter } from '../../save/SaveStorageAdapter';
import { onAppHide, onAppLaunchOrShow, buildSaveDataFromState, SaveData } from '../../save/SaveService';
import {
  CloudSaveAdapter,
  CloudSaveSnapshot,
  CloudUploadResult,
  createCloudSnapshot,
} from '../../save/CloudSaveAdapter';
import { PlayerState, INITIAL_OWNED_HERO_IDS, DEFAULT_ON_FIELD_HERO_IDS } from '../../core/PlayerState';
import { RewardLedger } from '../../core/RewardLedger';
import { AdFrequencyService, AdFrequencyState } from '../../ads/AdFrequencyService';
import { AdRewardFlowService } from '../../ads/AdRewardFlowService';
import { AdAdapter, AdService } from '../../ads/AdService';
import { MockAdAdapter } from '../../ads/MockAdAdapter';
import { DefeatSupplyService, DefeatSupplyState } from '../../core/DefeatSupplyService';
import { AdConfig, LevelConfig, RewardConfig } from '../../config/ConfigTypes';
import { AnalyticsService, NowFn } from '../../analytics/AnalyticsService';
import {
  AnalyticsUploadAdapter,
  AnalyticsUploadQueue,
  EnqueueResult,
  FlushSummary,
} from '../../analytics/AnalyticsUploadAdapter';
import { AnalyticsUploadEvent } from '../../analytics/AnalyticsEventTypes';
import { LastDefeatInfo } from '../../core/RecommendedTargetService';
import {
  OfflineRewardCalculation,
  OfflineRewardConfig,
  calculateOfflineReward,
} from '../../core/OfflineRewardService';

export interface AppContextConfig {
  adapter: SaveStorageAdapter;
  analytics: AnalyticsService;
  levels: LevelConfig[];
  rewards: RewardConfig[];
  /**
   * 拥有角色 id 的 seed（测试/特殊装配用，可省略）。真源是 playerState.ownedHeroIds；
   * 仅当加载后真源为空时，本 seed 才被复制进真源一次。
   * 省略时使用 INITIAL_OWNED_HERO_IDS（S5C-01，Ron 已确认的新玩家初始英雄）。
   */
  ownedHeroIds?: string[];
  /**
   * 上阵英雄 id 的 seed（测试/特殊装配用，可省略）。真源是 playerState.onFieldHeroIds（S5C-01 起随存档持久化）；
   * 仅当加载后真源为空时，本 seed 才被复制进真源一次。
   * 省略时使用 DEFAULT_ON_FIELD_HERO_IDS（S5C-01，Ron 已确认的新玩家默认上阵）。
   */
  onFieldHeroIds?: string[];
  /** 替补席英雄 id（一键升级 includeBench 时纳入），默认空。 */
  benchHeroIds?: string[];
  /** 时间源，默认 Date.now；测试可注入固定值。 */
  now?: NowFn;
  /** 离线收益配置，默认沿用 OfflineRewardService 内置默认值。 */
  offlineRewardConfig?: OfflineRewardConfig;
  /**
   * 广告配置（来自 ad_config）。提供且非空时，AppContext 构造广告运行时服务
   * （AdService / AdFrequencyService / AdRewardFlowService / DefeatSupplyService），
   * 并以存档恢复的 adFrequencyState / defeatSupplyState 作为初始计数。不提供则不持有广告服务（向后兼容旧调用方）。
   */
  adConfigs?: AdConfig[];
  /**
   * 广告底层适配器；默认 MockAdAdapter（完整观看）。当前阶段【只用 mock】，不接真实微信激励视频 SDK——
   * 真机 adapter（wx.createRewardedVideoAd）属后续任务。测试可注入自定义 mock 场景。
   */
  adAdapter?: AdAdapter;
  /**
   * 云存档适配器（可选）。提供时 AppContext 暴露最小云同步入口（上传当前快照 / 下载云端快照）。
   * 当前阶段【只用 MockCloudSaveAdapter】，不接真实微信云开发 / wx.cloud / 真实云函数；真机 adapter 属后续任务。
   */
  cloudSaveAdapter?: CloudSaveAdapter;
  /**
   * 埋点上报适配器（可选）。提供时 AppContext 构造 AnalyticsUploadQueue 并暴露最小上传入队/flush 入口。
   * 当前阶段【只用 MockAnalyticsUploadAdapter】，不接真实微信云开发 / wx.cloud / 真实云函数 / 真实 BI；真机 adapter 属后续任务。
   */
  analyticsUploadAdapter?: AnalyticsUploadAdapter;
}

export class AppContext {
  playerState: PlayerState;
  rewardLedger: RewardLedger;
  lastOnlineTime: number;
  /**
   * 广告限频每日次数 / 冷却起点（跨会话持久化）。启动从存档恢复，作为 new AdFrequencyService(configs, state) 的种子；
   * 广告计数变化后，持有广告服务的调用方应调用 syncAdRuntimeState 回写最新 getState() 再 persist 落盘。
   */
  adFrequencyState: AdFrequencyState;
  /** 同 Boss 每日补给次数（跨会话持久化）。来源/回写同 adFrequencyState（DefeatSupplyService.getState()）。 */
  defeatSupplyState: DefeatSupplyState;
  /** 最近一次失败信息；胜利后清除。由 DefeatPresenter 写入。 */
  lastDefeat?: LastDefeatInfo;

  readonly analytics: AnalyticsService;
  readonly levels: LevelConfig[];
  readonly rewards: RewardConfig[];
  readonly benchHeroIds: string[];

  /**
   * 广告运行时服务实例（仅当 config.adConfigs 提供且非空时存在）。
   * 以存档恢复的计数为初始状态；计数变化后须调用 commitAdRuntimeState() 同步并落盘。
   */
  readonly adService?: AdService;
  readonly adFrequency?: AdFrequencyService;
  readonly adRewardFlow?: AdRewardFlowService;
  readonly defeatSupply?: DefeatSupplyService;

  /** 云存档适配器（仅当 config.cloudSaveAdapter 提供时存在）；当前为 MockCloudSaveAdapter。 */
  readonly cloudSave?: CloudSaveAdapter;

  /** 埋点上报失败重试队列（仅当 config.analyticsUploadAdapter 提供时存在）；当前由 MockAnalyticsUploadAdapter 承载传输。 */
  readonly analyticsUploadQueue?: AnalyticsUploadQueue;

  private readonly adapter: SaveStorageAdapter;
  private readonly nowFn: NowFn;
  private readonly offlineRewardConfig?: OfflineRewardConfig;

  constructor(config: AppContextConfig) {
    this.adapter = config.adapter;
    this.analytics = config.analytics;
    this.levels = config.levels;
    this.rewards = config.rewards;
    this.benchHeroIds = config.benchHeroIds ?? [];
    this.nowFn = config.now ?? (() => Date.now());
    this.offlineRewardConfig = config.offlineRewardConfig;

    const { restored } = onAppLaunchOrShow(this.adapter, this.nowFn());
    this.playerState = restored.playerState;
    this.rewardLedger = restored.rewardLedger;
    this.adFrequencyState = restored.adFrequencyState;
    this.defeatSupplyState = restored.defeatSupplyState;
    this.lastOnlineTime = restored.lastOnlineTime;

    // 阵容唯一持久化真源是 playerState.ownedHeroIds / onFieldHeroIds（S5C-01 起均随存档持久化）；
    // config 仅作 seed：真源为空时复制一次，避免覆盖已落盘阵容。缺省 seed 即 Ron 确认的新档规则
    // （初始拥有 hero_isen/hero_mia，默认上阵同两人）；显式传空数组保持真源为空（兼容旧调用方语义）。
    const ownedSeed = config.ownedHeroIds ?? INITIAL_OWNED_HERO_IDS;
    if (this.playerState.ownedHeroIds.length === 0 && ownedSeed.length > 0) {
      this.playerState.ownedHeroIds = [...ownedSeed];
    }
    const onFieldSeed = config.onFieldHeroIds ?? DEFAULT_ON_FIELD_HERO_IDS;
    if ((this.playerState.onFieldHeroIds ?? []).length === 0 && onFieldSeed.length > 0) {
      // ?? [] 兜底：版本号已是当前值但缺 onFieldHeroIds 字段的异常档（不走迁移），就地补齐而非崩溃。
      this.playerState.onFieldHeroIds = [...onFieldSeed];
    }

    // 广告运行时服务：以存档恢复的每日/冷却/同 Boss 计数为初始状态接续累计。
    // 会话次数（sessionCount）按设计仍为内存态、随本服务实例新建从 0 起，不进存档。
    if (config.adConfigs && config.adConfigs.length > 0) {
      this.adService = new AdService(config.adAdapter ?? new MockAdAdapter({}));
      this.adFrequency = new AdFrequencyService(config.adConfigs, this.adFrequencyState);
      this.adRewardFlow = new AdRewardFlowService(this.adService, this.adFrequency, config.adConfigs);
      this.defeatSupply = new DefeatSupplyService(this.adRewardFlow, config.adConfigs, {
        state: this.defeatSupplyState,
      });
    }

    // 云存档：可选持有。不接真实云账号，仅 mock。
    this.cloudSave = config.cloudSaveAdapter;

    // 埋点上报队列：可选持有。不接真实 BI / 云函数，仅 mock。
    if (config.analyticsUploadAdapter) {
      this.analyticsUploadQueue = new AnalyticsUploadQueue(config.analyticsUploadAdapter);
    }
  }

  /** 拥有角色 id：真源为 playerState.ownedHeroIds（不保留独立副本）。 */
  get ownedHeroIds(): string[] {
    return this.playerState.ownedHeroIds;
  }

  /** 上阵英雄 id：真源为 playerState.onFieldHeroIds（S5C-01，不保留独立副本，随存档持久化）。 */
  get onFieldHeroIds(): string[] {
    return this.playerState.onFieldHeroIds;
  }

  now(): number {
    return this.nowFn();
  }

  /** 关卡 id -> 该关卡奖励配置；找不到关卡或奖励时返回 undefined。 */
  rewardFor(levelId: string): RewardConfig | undefined {
    const level = this.levels.find((l) => l.levelId === levelId);
    if (!level) {
      return undefined;
    }
    return this.rewards.find((r) => r.rewardId === level.rewardId);
  }

  /** 当前离线收益计算结果（不发放，仅用于展示与推荐目标判定）。 */
  getOfflineRewardCalculation(): OfflineRewardCalculation {
    return calculateOfflineReward({
      lastOnlineTime: this.lastOnlineTime,
      now: this.now(),
      hasProgress: this.playerState.clearedLevelIds.length > 0,
      config: this.offlineRewardConfig,
    });
  }

  hasClaimableOfflineReward(): boolean {
    return this.getOfflineRewardCalculation().claimable;
  }

  get offlineConfig(): OfflineRewardConfig | undefined {
    return this.offlineRewardConfig;
  }

  /**
   * 回写广告运行时计数（由持有 AdFrequencyService / DefeatSupplyService 的调用方在计数变化后调用，
   * 传入各自 getState()），随后 persist() 即可把最新广告计数一并落盘。会话次数不在此列。
   */
  syncAdRuntimeState(adFrequencyState: AdFrequencyState, defeatSupplyState: DefeatSupplyState): void {
    this.adFrequencyState = adFrequencyState;
    this.defeatSupplyState = defeatSupplyState;
  }

  /**
   * 广告/补给计数变化后调用：从持有的广告服务拉取最新 getState() 同步进持久化快照，并立即落盘。
   * 这是「让 S5A-01 存档字段真正被运行时使用」的闭环入口——任何经 adRewardFlow / defeatSupply
   * 产生的计数变化，调用本方法后即跨会话保留。未持有广告服务时退化为普通 persist()。
   */
  commitAdRuntimeState(): void {
    if (this.adFrequency && this.defeatSupply) {
      this.syncAdRuntimeState(this.adFrequency.getState(), this.defeatSupply.getState());
    }
    this.persist();
  }

  /** 把当前会话关键状态打包为一份完整 SaveData 快照（含 adFrequencyState / defeatSupplyState）。 */
  currentSaveData(): SaveData {
    return buildSaveDataFromState(
      this.playerState,
      this.rewardLedger,
      this.lastOnlineTime,
      this.adFrequencyState,
      this.defeatSupplyState,
    );
  }

  /**
   * 上传当前本地存档快照到云端（mock）。
   * 上传前先 commitAdRuntimeState()（同步广告运行时计数并落盘），确保上传的是最新 SaveData——
   * 整存整取，包含 S5A-01 的 adFrequencyState / defeatSupplyState。
   * 仅整体存取一份 SaveData，不解析字段语义、不做冲突合并；只把 adapter 结果返回给上层后续决策。
   * 未持有 cloudSaveAdapter 时返回 null（向后兼容）。
   */
  async uploadCurrentSaveToCloud(revision: number): Promise<CloudUploadResult | null> {
    if (!this.cloudSave) {
      return null;
    }
    this.commitAdRuntimeState();
    const snapshot = createCloudSnapshot(this.currentSaveData(), revision);
    return this.cloudSave.upload(snapshot);
  }

  /**
   * 下载云端当前权威快照（mock）。
   * 【不自动覆盖本地存档、不做冲突合并】——只把 adapter 结果返回给上层后续决策（是否采用、如何合并由上层处理）。
   * 云端无档返回 null；未持有 cloudSaveAdapter 时同样返回 null（向后兼容）。
   */
  async downloadCloudSave(): Promise<CloudSaveSnapshot | null> {
    if (!this.cloudSave) {
      return null;
    }
    return this.cloudSave.download();
  }

  /**
   * 把一条 P0 上传事件加入埋点上报队列。
   * 队列内部 validateUploadEvent 校验：仅接受 AnalyticsEventTypes 定义的合法 P0 事件；
   * 非法事件 / 含敏感硬件 ID 的事件会被拒绝、不入队（accepted=false + errors）。
   * 【不】自动桥接 C13 AnalyticsService 的全部事件——调用方需显式构造 P0 上传事件传入。
   * 未注入 analyticsUploadAdapter 时返回 null（向后兼容）。
   */
  enqueueAnalyticsUploadEvent(event: AnalyticsUploadEvent): EnqueueResult | null {
    if (!this.analyticsUploadQueue) {
      return null;
    }
    return this.analyticsUploadQueue.enqueue(event);
  }

  /**
   * flush 埋点上报队列：上报所有到期事件（成功置 sent，失败置 failed 并按退避设 retryAt，可后续重试）。
   * now 默认取 AppContext 时间源。未注入 analyticsUploadAdapter 时返回 null（向后兼容）。
   */
  async flushAnalyticsUploads(now?: number): Promise<FlushSummary | null> {
    if (!this.analyticsUploadQueue) {
      return null;
    }
    return this.analyticsUploadQueue.flush(now ?? this.now());
  }

  /** 落盘当前关键状态（切后台/关键变更后调用），并把 lastOnlineTime 推进到落盘时刻。 */
  persist(): void {
    const saved = onAppHide(
      this.adapter,
      this.playerState,
      this.rewardLedger,
      this.now(),
      this.adFrequencyState,
      this.defeatSupplyState,
    );
    this.lastOnlineTime = saved.lastOnlineTime;
  }
}
