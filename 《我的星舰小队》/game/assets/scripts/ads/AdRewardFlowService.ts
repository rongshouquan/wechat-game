import { AdConfig } from '../config/ConfigTypes';
import { AdRequest, AdResultStatus, AdService } from './AdService';
import { AdFrequencyRejectReason, AdFrequencyService } from './AdFrequencyService';
import { requestRewardGrant, RewardFlowEntry, RewardLedger } from '../core/RewardLedger';

/**
 * 广告奖励 flow 的处置结果：
 * - granted            完整观看 + 限频通过 + RewardLedger 新建 granted 流水（待 C26-C28 应用具体奖励后 settle）
 * - duplicate          同一奖励机会（flow key）已发放 / 重复回调，判重不重复发奖
 * - cancelled          用户中断，不发奖（可重试）
 * - failed             播放失败，不发奖（可重试，不消耗成功次数）
 * - load_failed        加载失败，不发奖（可重试，不消耗成功次数）
 * - rejected_frequency 超每日 / 超会话 / 冷却未结束，未播放
 * - unknown_slot       广告位无配置
 */
export type AdRewardFlowStatus =
  | 'granted'
  | 'duplicate'
  | 'cancelled'
  | 'failed'
  | 'load_failed'
  | 'rejected_frequency'
  | 'unknown_slot';

export interface AdRewardRequest {
  adSlotId: string;
  /** 本次奖励机会的唯一标识（离线周期 id / 失败上下文 / 关卡 id 等），用于构造防重 flow key。 */
  opportunityId: string;
}

export interface AdRewardFlowOutcome {
  status: AdRewardFlowStatus;
  adSlotId: string;
  opportunityId: string;
  /** 防重 flow key（= `${flowKeyPrefix}_${opportunityId}`），作为 RewardLedger 的 sourceId。 */
  flowKey: string;
  /** granted 时的 ledger 流水条目（处于 granted 状态，未 confirm，等调用方应用奖励后 settle）。 */
  flowEntry?: RewardFlowEntry;
  /** 限频拒绝原因（status=rejected_frequency 时）。 */
  frequencyReason?: AdFrequencyRejectReason;
  /** 是否可重试（失败 / 中断 / 冷却为 true；其余为 false）。 */
  retryable: boolean;
  /** 底层广告状态，便于埋点 / 调试。 */
  adStatus?: AdResultStatus;
}

/**
 * 广告奖励 flow 服务：把「限频判定 -> 主动触发广告 -> 完整观看产出 reward flow」串成一条防重链路。
 * 纯 TS，不依赖 cc / wx；时间由调用方注入。
 *
 * 边界约束（按 C25 范围）：
 * - 完整观看只创建 RewardLedger 的 granted 流水（可发奖状态），【不在本服务应用任何具体业务奖励】（那是 C26-C28）。
 * - 失败 / 中断 / 重复回调一律不发奖；失败可重试且不消耗每日/会话成功次数。
 * - 所有发奖必须经 RewardLedger + flow key，禁止绕过。
 */
export class AdRewardFlowService {
  private readonly configs: Map<string, AdConfig>;

  constructor(
    private readonly adService: AdService,
    private readonly frequency: AdFrequencyService,
    configs: AdConfig[] | Map<string, AdConfig>,
  ) {
    this.configs = configs instanceof Map ? configs : new Map(configs.map((c) => [c.adSlotId, c]));
  }

  /**
   * 主动触发一次广告奖励流程。必须由玩家主动触发，不做强制广告。
   * @returns 归一化结果；仅 granted 会在 RewardLedger 产生 granted 流水。
   */
  async requestAdReward(ledger: RewardLedger, req: AdRewardRequest, nowMs: number): Promise<AdRewardFlowOutcome> {
    const cfg = this.configs.get(req.adSlotId);
    const flowKey = cfg ? `${cfg.flowKeyPrefix}_${req.opportunityId}` : `unknown_${req.opportunityId}`;
    const base = { adSlotId: req.adSlotId, opportunityId: req.opportunityId, flowKey };

    if (!cfg) {
      return { ...base, status: 'unknown_slot', retryable: false };
    }

    // 防重①：该奖励机会已有 granted/confirmed 流水（如杀进程重进），直接判重，不重播、不消耗。
    if (hasGranted(ledger, flowKey, cfg.rewardId)) {
      return { ...base, status: 'duplicate', retryable: false };
    }

    // 限频：超每日 / 超会话 / 冷却未结束则拒绝，不播放。
    const decision = this.frequency.canRequest(req.adSlotId, nowMs);
    if (!decision.allowed) {
      return {
        ...base,
        status: 'rejected_frequency',
        frequencyReason: decision.reason,
        retryable: decision.reason === 'cooldown',
      };
    }

    const adRequest: AdRequest = { adSlotId: cfg.adSlotId, adType: cfg.adType, entry: cfg.entry };
    const result = await this.adService.requestRewardedAd(adRequest);

    if (result.status === 'completed') {
      const grant = requestRewardGrant(ledger, flowKey, cfg.rewardId);
      if (!grant.granted) {
        // 防重②：理论上已被防重①拦截，仍兜底——重复回调不重复生成 reward flow。
        return { ...base, status: 'duplicate', retryable: false, adStatus: result.status };
      }
      // 仅在确有新发放时计入成功次数与冷却（失败/中断不到这里）。
      this.frequency.recordCompleted(req.adSlotId, nowMs);
      return { ...base, status: 'granted', flowEntry: grant.entry, retryable: false, adStatus: result.status };
    }

    // load_failed / failed / cancelled：不发奖、不消耗成功次数；失败与中断均可重试。
    const status: AdRewardFlowStatus =
      result.status === 'load_failed' ? 'load_failed' : result.status === 'failed' ? 'failed' : 'cancelled';
    return { ...base, status, retryable: true, adStatus: result.status };
  }

  /**
   * 结算一笔已 granted 的奖励流水：调用方（C26-C28）应用具体业务奖励后调用。
   * - success=true：granted/failed -> confirmed（发奖确认完成）
   * - success=false：granted/failed -> failed（发奖失败，可重试：重新应用后再 settle(true)）
   * 不处理 cancelled/duplicate 流水（那些本就未 granted）。
   */
  settleReward(entry: RewardFlowEntry, success: boolean): void {
    if (entry.status !== 'granted' && entry.status !== 'failed') {
      return;
    }
    entry.status = success ? 'confirmed' : 'failed';
  }

  /**
   * 只读查询：某奖励机会是否已存在「广告已完成、但业务奖励尚未确认」的可复用广告 flow 条目
   * （granted=待结算 / failed=应用失败待重试）。
   * 供「广告已看完但发奖应用失败」时复用广告结果重试——避免重播广告、避免再次计入限频。
   * 不改任何状态、不触发播放、不消耗每日/会话次数；保持 C25 语义。
   * 注：confirmed（已交付）不算可复用——其对应业务奖励已发放，由各业务侧自身防重拦截。
   */
  findReusableAdFlow(ledger: RewardLedger, adSlotId: string, opportunityId: string): RewardFlowEntry | undefined {
    const cfg = this.configs.get(adSlotId);
    if (!cfg) {
      return undefined;
    }
    const flowKey = `${cfg.flowKeyPrefix}_${opportunityId}`;
    return ledger.entries.find(
      (e) => e.sourceId === flowKey && e.rewardId === cfg.rewardId && (e.status === 'granted' || e.status === 'failed'),
    );
  }
}

/** 是否已存在该 flow key + 奖励的有效发放记录（granted/confirmed）。 */
function hasGranted(ledger: RewardLedger, sourceId: string, rewardId: string): boolean {
  return ledger.entries.some(
    (e) => e.sourceId === sourceId && e.rewardId === rewardId && (e.status === 'granted' || e.status === 'confirmed'),
  );
}
