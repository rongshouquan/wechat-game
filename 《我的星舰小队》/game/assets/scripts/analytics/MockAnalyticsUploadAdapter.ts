/**
 * 埋点上报 mock 适配器（C30）。
 *
 * 纯内存、确定性，仅用于 Node/Vitest。绝不接微信云开发 / wx.cloud / 真实云函数 / 真实账号，
 * 不读真实后端配置、不写磁盘、不采集任何硬件 ID。结果由注入的行为决定，
 * 因此测试可精确模拟「上报成功 / 上报失败 / 先失败后成功（重试）」。
 */
import { AnalyticsUploadAdapter, UploadResult } from './AnalyticsUploadAdapter';
import { AnalyticsUploadEvent } from './AnalyticsEventTypes';

/** 行为函数：按「第几次调用（1 基）+ 本批事件」决定返回结果。 */
export type MockUploadBehavior = (events: AnalyticsUploadEvent[], callIndex: number) => UploadResult;

export class MockAnalyticsUploadAdapter implements AnalyticsUploadAdapter {
  /** 上报成功的全部事件（按到达顺序累计）。 */
  readonly sentEvents: AnalyticsUploadEvent[] = [];
  /** 每次 upload 调用收到的批次（无论成功失败），便于断言重试行为。 */
  readonly batches: AnalyticsUploadEvent[][] = [];
  private callIndex = 0;
  private readonly behavior: MockUploadBehavior;

  constructor(behavior?: MockUploadBehavior) {
    this.behavior = behavior ?? (() => ({ ok: true }));
  }

  /** 始终成功。 */
  static alwaysOk(): MockAnalyticsUploadAdapter {
    return new MockAnalyticsUploadAdapter(() => ({ ok: true }));
  }

  /** 始终失败（可带错误码）。 */
  static alwaysFail(error = 'mock_upload_failed'): MockAnalyticsUploadAdapter {
    return new MockAnalyticsUploadAdapter(() => ({ ok: false, error }));
  }

  /** 前 n 次失败、第 n+1 次起成功，用于测试重试后成功。 */
  static failFirst(n: number, error = 'mock_upload_failed'): MockAnalyticsUploadAdapter {
    return new MockAnalyticsUploadAdapter((_events, callIndex) =>
      callIndex <= n ? { ok: false, error } : { ok: true },
    );
  }

  async upload(events: AnalyticsUploadEvent[]): Promise<UploadResult> {
    this.callIndex += 1;
    this.batches.push([...events]);
    const result = this.behavior(events, this.callIndex);
    if (result.ok) {
      this.sentEvents.push(...events);
    }
    return result;
  }

  /** 已发生的 upload 调用次数。 */
  get callCount(): number {
    return this.callIndex;
  }
}
