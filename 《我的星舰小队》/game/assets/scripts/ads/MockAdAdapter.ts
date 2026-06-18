import { AdAdapter, AdLoadOutcome, AdPlayEmitter, AdPlayStatus, AdRequest } from './AdService';

/**
 * 单次广告请求的脚本化结果，供 MockAdAdapter 模拟各分支：
 * - load:              加载结果（默认 'loaded'）
 * - play:              加载成功后的播放终态（默认 'completed'）
 * - duplicateCallback: 终态后是否再触发一次重复回调（模拟真实 SDK 重复 onClose -> AdService 标记 duplicate_callback）
 * - error:             失败 / 加载失败时附带的错误描述
 */
export interface MockAdScenario {
  load?: 'loaded' | 'load_failed';
  play?: AdPlayStatus;
  duplicateCallback?: boolean;
  error?: string;
}

/** 根据请求解析脚本结果；可按 adSlotId / adType / entry 返回不同结果。 */
export type MockScenarioResolver = (request: AdRequest) => MockAdScenario;

const DEFAULT_LOAD: NonNullable<MockAdScenario['load']> = 'loaded';
const DEFAULT_PLAY: AdPlayStatus = 'completed';

/**
 * 广告 mock 适配器：纯内存、确定性，仅用于 Node/Vitest。
 * 不接微信 SDK、不读真实广告账号、不写真实广告位 ID、不发奖。
 * 结果由注入的 resolver 决定，因此测试可按 adSlotId / adType / entry 精确指定
 * loaded / completed / cancelled / failed / load_failed / duplicate_callback。
 */
export class MockAdAdapter implements AdAdapter {
  private readonly resolve: MockScenarioResolver;

  constructor(resolver: MockScenarioResolver | MockAdScenario) {
    this.resolve = typeof resolver === 'function' ? resolver : () => resolver;
  }

  /** 便捷构造：按 adSlotId 映射脚本结果，未命中用 fallback（默认完整观看）。 */
  static byAdSlotId(map: Record<string, MockAdScenario>, fallback: MockAdScenario = {}): MockAdAdapter {
    return new MockAdAdapter((req) => map[req.adSlotId] ?? fallback);
  }

  async load(request: AdRequest): Promise<AdLoadOutcome> {
    const scenario = this.resolve(request);
    const status = scenario.load ?? DEFAULT_LOAD;
    // error 仅属于失败阶段：加载成功不带 error；加载失败才透传 scenario.error。
    return status === 'load_failed' ? { status, error: scenario.error } : { status };
  }

  show(request: AdRequest, emit: AdPlayEmitter): void {
    const scenario = this.resolve(request);
    const play = scenario.play ?? DEFAULT_PLAY;
    // error 仅在播放失败时附带，避免 completed/cancelled 误带错误码。
    const error = play === 'failed' ? scenario.error : undefined;
    emit(play, error);
    if (scenario.duplicateCallback) {
      // 第二次回调：AdService 会将其归一化为 duplicate_callback 并丢弃。
      emit(play, error);
    }
  }
}
