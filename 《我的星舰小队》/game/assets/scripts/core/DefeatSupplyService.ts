/**
 * 失败补给广告（C27）。
 *
 * 在 C10 失败恢复路径之外【新增】一个「看广告领补给」的额外选项的纯 TS 服务。
 * C10 的非广告挽留路径（DefeatAnalysisService）完全不改、不依赖本服务——广告补给只是额外选择。
 *
 * 设计要点：
 * - 补给前置：必须广告 completed 且 C25 AdRewardFlowService 产出 granted；中断 / 失败 / 限频 / 重复一律不发补给。
 * - 三重限制：① 广告每日 / 会话 / 冷却（复用 C25 AdFrequencyService，经 AdRewardFlowService）；
 *             ② 同 Boss 每日补给次数上限（本服务维护，配置驱动，占位默认保守）；
 *             ③ 同一失败上下文防重（以 contextId 作为广告 flow 的 opportunityId/flow key，重复回调不重复发奖）。
 * - 补给发放经 RewardLedger（广告 flow 即补给奖励 rw_ad_defeat_supply 的流水），不绕过防重。
 * - 发奖应用失败：沿用 C26 语义——复用已 completed 但未确认的广告 flow 重试，不重播广告、不再消耗每日/会话/Boss 次数。
 * - 具体补给内容（复活 / 能量 / 道具等数值）由调用方 applySupply 注入；本服务只负责门槛、限频、防重与发放流程。
 * - 不依赖 cc / wx，不做强制广告，不做 UI；对 ads 层仅 import type，core 不产生对 ads 的运行时依赖。
 */
import type { AdFrequencyRejectReason } from '../ads/AdFrequencyService';
import type { AdRewardFlowOutcome, AdRewardRequest, AdRewardFlowService } from '../ads/AdRewardFlowService';
import { AdConfig } from '../config/ConfigTypes';
import { PlayerState } from './PlayerState';
import { RewardFlowEntry, RewardLedger } from './RewardLedger';

/** 默认失败补给广告位（对应 ad_config.sample.json 的 ad_defeat_supply）。 */
export const DEFAULT_DEFEAT_SUPPLY_AD_SLOT_ID = 'ad_defeat_supply';
/** 同 Boss 每日补给次数上限（占位默认，待数值设计；保守取 1，每个 Boss 每日仅 1 次广告补给）。 */
export const DEFAULT_MAX_SUPPLIES_PER_BOSS_PER_DAY = 1;

const DAY_MS = 86_400_000;
/** UTC 自然日索引；生产环境应由调用方注入服务器时间（与 AdFrequencyService.dayIndexOf 同口径）。 */
function dayIndexOf(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS);
}

export interface DefeatSupplyBossCounter {
  dayKey: number;
  count: number;
}

/** 可持久化的同 Boss 每日补给计数（跨会话保留，运行时可由存档承载）。 */
export interface DefeatSupplyState {
  bosses: Record<string, DefeatSupplyBossCounter>;
}

export interface DefeatSupplyRequest {
  /** 失败上下文唯一 id（同一失败实例 / 同一次结算），作为广告防重 flow key 后缀。 */
  contextId: string;
  /** Boss / 关卡分组 key（如 levelId 或 bossId），用于同 Boss 每日次数限制。 */
  bossKey: string;
}

export type DefeatSupplyStatus =
  | 'granted' // 广告完成 + 补给应用成功
  | 'already_claimed' // 同一失败上下文已发补给（含重复回调）
  | 'boss_limit' // 同 Boss 每日次数已达上限
  | 'rejected_frequency' // 广告每日 / 会话 / 冷却限频拒绝
  | 'ad_not_completed' // 广告中断 / 失败 -> 不发补给
  | 'grant_failed' // 补给应用失败，可重试
  | 'unknown_slot';

export interface DefeatSupplyResult {
  status: DefeatSupplyStatus;
  granted: boolean;
  contextId: string;
  bossKey: string;
  /** 广告（补给）防重 flow key（= `${flowKeyPrefix}_${contextId}`）。 */
  flowKey: string;
  /** 补给流水 flowId（即广告 flow，rewardId=补给奖励）。 */
  supplyFlowId?: string;
  /** 限频拒绝原因（status=rejected_frequency 时）。 */
  frequencyReason?: AdFrequencyRejectReason;
  adStatus?: AdRewardFlowOutcome['status'];
  retryable: boolean;
  log: string[];
}

export interface DefeatSupplyParams {
  rewardLedger: RewardLedger;
  playerState: PlayerState;
  request: DefeatSupplyRequest;
  now: number;
  /**
   * 应用补给到玩家状态（具体补给内容由调用方 / 设计提供）。返回 false 表示应用失败，可重试。
   * 默认 no-op 返回 true：仅在 RewardLedger 记录补给流水，具体资源/复活由调用方另行应用。
   */
  applySupply?: (state: PlayerState) => boolean;
}

export interface DefeatSupplyOptions {
  adSlotId?: string;
  maxSuppliesPerBossPerDay?: number;
  state?: DefeatSupplyState;
}

/**
 * 失败补给广告服务：在「广告 completed + C25 flow granted」后发放补给，受每日 / 会话 / 冷却 / 同 Boss 次数 / 同上下文防重限制。
 */
export class DefeatSupplyService {
  private readonly configs: Map<string, AdConfig>;
  private readonly adSlotId: string;
  private readonly maxPerBossPerDay: number;
  private readonly state: DefeatSupplyState;

  constructor(
    private readonly adFlow: AdRewardFlowService,
    configs: AdConfig[] | Map<string, AdConfig>,
    options?: DefeatSupplyOptions,
  ) {
    this.configs = configs instanceof Map ? configs : new Map(configs.map((c) => [c.adSlotId, c]));
    this.adSlotId = options?.adSlotId ?? DEFAULT_DEFEAT_SUPPLY_AD_SLOT_ID;
    this.maxPerBossPerDay = options?.maxSuppliesPerBossPerDay ?? DEFAULT_MAX_SUPPLIES_PER_BOSS_PER_DAY;
    this.state = options?.state ? cloneState(options.state) : { bosses: {} };
  }

  /** 导出可持久化的同 Boss 每日补给计数（深拷贝）。 */
  getState(): DefeatSupplyState {
    return cloneState(this.state);
  }

  /** 当前同 Boss 当日已发补给次数（已考虑跨日重置）。 */
  bossCount(bossKey: string, nowMs: number): number {
    const counter = this.state.bosses[bossKey];
    return counter && counter.dayKey === dayIndexOf(nowMs) ? counter.count : 0;
  }

  /**
   * 主动触发一次「看广告领补给」。必须由玩家主动触发，不做强制广告。
   * 仅在广告 completed + C25 flow granted 后发放；中断 / 失败 / 限频 / 重复 / 超 Boss 次数均不发补给。
   */
  async requestSupplyViaAd(params: DefeatSupplyParams): Promise<DefeatSupplyResult> {
    const { contextId, bossKey } = params.request;
    const cfg = this.configs.get(this.adSlotId);
    const flowKey = cfg ? `${cfg.flowKeyPrefix}_${contextId}` : `unknown_${contextId}`;
    const base = { contextId, bossKey, flowKey };
    const log: string[] = [];

    if (!cfg) {
      log.push('defeat_supply_unknown_slot');
      return { ...base, status: 'unknown_slot', granted: false, retryable: false, log };
    }

    // 同一失败上下文已发补给（广告 flow 已 confirmed）-> 判重拒绝。
    if (this.hasConfirmedSupply(params.rewardLedger, flowKey, cfg.rewardId)) {
      log.push('defeat_supply_already_claimed');
      return { ...base, status: 'already_claimed', granted: false, retryable: false, log };
    }

    // 发奖应用失败重试：复用已 completed 但未确认（granted/failed）的广告 flow，
    // 不重播广告、不再消耗每日 / 会话 / Boss 次数。
    const reusable = this.adFlow.findReusableAdFlow(params.rewardLedger, this.adSlotId, contextId);
    if (reusable) {
      log.push('defeat_supply_reuse_ad_flow');
      return this.finalize(params, base, reusable, undefined, false, log);
    }

    // 同 Boss 每日次数上限（在播放广告前拦截，避免无效消耗广告次数）。
    if (this.bossCount(bossKey, params.now) >= this.maxPerBossPerDay) {
      log.push('defeat_supply_boss_limit');
      return { ...base, status: 'boss_limit', granted: false, retryable: false, log };
    }

    // 主动播放广告（C25 处理每日 / 会话 / 冷却限频与广告维度防重）。
    const adReq: AdRewardRequest = { adSlotId: this.adSlotId, opportunityId: contextId };
    const adOutcome = await this.adFlow.requestAdReward(params.rewardLedger, adReq, params.now);
    log.push(`defeat_supply_ad_${adOutcome.status}`);

    if (adOutcome.status === 'rejected_frequency') {
      return {
        ...base,
        status: 'rejected_frequency',
        granted: false,
        frequencyReason: adOutcome.frequencyReason,
        retryable: adOutcome.retryable,
        log,
      };
    }
    if (adOutcome.status !== 'granted' || !adOutcome.flowEntry) {
      // duplicate 归为 already_claimed；cancelled / failed / load_failed 归为 ad_not_completed。
      const status: DefeatSupplyStatus = adOutcome.status === 'duplicate' ? 'already_claimed' : 'ad_not_completed';
      return { ...base, status, granted: false, adStatus: adOutcome.status, retryable: adOutcome.retryable, log };
    }

    // 广告完成：计入同 Boss 次数（每观看一次补给广告算一次），再应用补给。
    return this.finalize(params, base, adOutcome.flowEntry, adOutcome.status, true, log);
  }

  private finalize(
    params: DefeatSupplyParams,
    base: { contextId: string; bossKey: string; flowKey: string },
    adEntry: RewardFlowEntry,
    adStatus: AdRewardFlowOutcome['status'] | undefined,
    countBoss: boolean,
    log: string[],
  ): DefeatSupplyResult {
    if (countBoss) {
      this.incrementBoss(base.bossKey, params.now);
    }

    const apply = params.applySupply ?? (() => true);
    const applied = apply(params.playerState);

    if (!applied) {
      // 应用失败：广告 flow 置 failed（保留为可复用），整笔可重试（复用广告、不重播、不再计次数）。
      this.adFlow.settleReward(adEntry, false);
      log.push('defeat_supply_apply_failed');
      return {
        ...base,
        status: 'grant_failed',
        granted: false,
        supplyFlowId: adEntry.flowId,
        adStatus,
        retryable: true,
        log,
      };
    }

    // 应用成功：结算广告（补给）flow -> confirmed。
    this.adFlow.settleReward(adEntry, true);
    log.push('defeat_supply_granted');
    return {
      ...base,
      status: 'granted',
      granted: true,
      supplyFlowId: adEntry.flowId,
      adStatus,
      retryable: false,
      log,
    };
  }

  private hasConfirmedSupply(ledger: RewardLedger, flowKey: string, rewardId: string): boolean {
    return ledger.entries.some((e) => e.sourceId === flowKey && e.rewardId === rewardId && e.status === 'confirmed');
  }

  private incrementBoss(bossKey: string, nowMs: number): void {
    const day = dayIndexOf(nowMs);
    const counter = this.state.bosses[bossKey];
    if (!counter || counter.dayKey !== day) {
      this.state.bosses[bossKey] = { dayKey: day, count: 1 };
    } else {
      counter.count += 1;
    }
  }
}

function cloneState(state: DefeatSupplyState): DefeatSupplyState {
  const bosses: Record<string, DefeatSupplyBossCounter> = {};
  for (const [key, c] of Object.entries(state.bosses)) {
    bosses[key] = { dayKey: c.dayKey, count: c.count };
  }
  return { bosses };
}
