import { AdConfig } from '../config/ConfigTypes';

/** 广告类型与触发入口，直接复用 AdConfig 的字段联合，避免与配置 schema 重复定义。 */
export type AdType = AdConfig['adType'];
export type AdEntry = AdConfig['entry'];

/**
 * 一次广告请求的上下文：广告位、类型、入口。
 * adSlotId 为逻辑广告位标识（来自 ad_config），不是真实微信广告位 ID；真实 adUnitId 由真机 adapter 在运行时注入。
 */
export interface AdRequest {
  adSlotId: string;
  adType: AdType;
  entry: AdEntry;
}

/**
 * 广告结果状态：
 * - loaded             加载成功（资源就绪，可播放）
 * - load_failed        加载失败（不进入播放）
 * - completed          完整观看（满足发奖前置；发奖/限频由 C25-C28 处理，本层不发奖）
 * - cancelled          用户中断（提前关闭，不发奖）
 * - failed             播放失败（不发奖，可重试）
 * - duplicate_callback 终态之后对同一次播放的重复回调（去重丢弃，不重复触发完成）
 */
export type AdResultStatus =
  | 'loaded'
  | 'load_failed'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'duplicate_callback';

export interface AdResult {
  status: AdResultStatus;
  request: AdRequest;
  /** 失败 / 加载失败时的可选错误码或描述，便于上层埋点；不含敏感信息。 */
  error?: string;
}

/** 播放阶段的终态（由 adapter 通过 emit 上报，可能被重复触发）。 */
export type AdPlayStatus = 'completed' | 'cancelled' | 'failed';

/** adapter.show 上报播放终态事件的回调。 */
export type AdPlayEmitter = (status: AdPlayStatus, error?: string) => void;

/** 加载阶段结果；load_failed 时可附带错误码，便于上层埋点。 */
export interface AdLoadOutcome {
  status: 'loaded' | 'load_failed';
  error?: string;
}

/** 构造结果对象：error 为空时省略该字段，保持结果干净（不带 error: undefined，也不含任何奖励字段）。 */
function buildResult(status: AdResultStatus, request: AdRequest, error?: string): AdResult {
  return error === undefined ? { status, request } : { status, request, error };
}

/**
 * 广告底层适配器接口（平台边界）。
 *
 * 真机侧由后续真实 adapter（如 WxRewardedVideoAdAdapter，属 C24 之后任务）实现，映射关系：
 *   const ad = wx.createRewardedVideoAd({ adUnitId });   // adUnitId 运行时注入，不在代码写死
 *   ad.onLoad(...)         -> load() resolve 'loaded'
 *   ad.onError(...)        -> load() resolve 'load_failed'（加载期）/ show emit 'failed'（播放期）
 *   ad.onClose(res)        -> res && res.isEnded ? emit 'completed' : emit 'cancelled'
 * 本任务【不得】真实调用 wx.createRewardedVideoAd；仅提供 MockAdAdapter 供 Node/Vitest 测试。
 *
 * 约定：adapter 只如实转发 SDK 生命周期，不做去重、不发奖、不计限频。
 * 去重在 AdService 完成；限频 / 防重 flow / 发奖由 C25-C28 负责。
 */
export interface AdAdapter {
  /** 加载广告资源；resolve loaded / load_failed（可带错误码），不 reject。 */
  load(request: AdRequest): Promise<AdLoadOutcome>;
  /**
   * 播放已加载的广告，通过 emit 上报终态。
   * 真实 SDK 可能对同一次播放重复触发回调；adapter 可多次调用 emit，由 AdService 归一化为 duplicate_callback。
   */
  show(request: AdRequest, emit: AdPlayEmitter): void;
}

/**
 * 广告服务：编排「加载 -> 播放」，并把 adapter 的多次回调归一为单一终态结果。
 * 纯 TS，不依赖 cc / wx，可在 Node/Vitest 独立测试。
 * 只表达广告生命周期结果；不发奖、不接 RewardLedger、不做限频（那些属于 C25-C28）。
 */
export class AdService {
  constructor(private readonly adapter: AdAdapter) {}

  /** 仅加载阶段：返回 loaded / load_failed（load_failed 透传错误码）。 */
  async load(request: AdRequest): Promise<AdResult> {
    const outcome = await this.adapter.load(request);
    return buildResult(outcome.status, request, outcome.error);
  }

  /**
   * 主动触发一次激励视频完整流程（加载 -> 播放）。必须由玩家主动触发，不做强制广告。
   * @param request 广告上下文（广告位 / 类型 / 入口）
   * @param onResult 可选：依序接收过程结果事件（loaded / 播放终态 / duplicate_callback），便于上层观测或埋点
   * @returns 归一化后的终态结果（load_failed / completed / cancelled / failed）
   */
  async requestRewardedAd(
    request: AdRequest,
    onResult?: (result: AdResult) => void,
  ): Promise<AdResult> {
    const emit = (result: AdResult): void => {
      onResult?.(result);
    };

    const loaded = await this.load(request);
    emit(loaded);
    if (loaded.status === 'load_failed') {
      return loaded;
    }

    return new Promise<AdResult>((resolve) => {
      let settled = false;
      this.adapter.show(request, (status, error) => {
        if (settled) {
          // 终态之后对同一次播放的回调一律视为重复回调，去重丢弃：不重复触发完成、不发奖。
          emit(buildResult('duplicate_callback', request, error));
          return;
        }
        settled = true;
        const result = buildResult(status, request, error);
        emit(result);
        resolve(result);
      });
    });
  }
}
