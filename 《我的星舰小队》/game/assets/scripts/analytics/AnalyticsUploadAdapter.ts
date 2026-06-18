/**
 * 埋点上报 adapter 接口与失败重试队列（C30）。
 *
 * 纯 TypeScript 模块，不依赖 cc / wx：定义上报传输边界（AnalyticsUploadAdapter）与一个
 * 纯内存的失败重试队列（AnalyticsUploadQueue），用 pending / sent / failed + retryAt 表达重试状态。
 *
 * 明确不做（属后续或越界）：
 *  - 不接真实微信云开发 / 真实云函数 / 真实 BI；真机 adapter 另起占位实现。
 *  - 不读系统时间：now 由调用方注入（《数据接入技术方案》服务端时间优先、本地兜底，由上层决定取值）。
 *  - 不做最低看板聚合（属 C31）。
 */
import { AnalyticsUploadEvent, validateUploadEvent } from './AnalyticsEventTypes';

/** 单条事件在重试队列中的状态。 */
export type UploadStatus = 'pending' | 'sent' | 'failed';

/** 一次上报的结果（adapter 只表达成功/失败，不发奖、不解析业务语义）。 */
export interface UploadResult {
  ok: boolean;
  /** 失败时的错误描述，便于埋点/日志；不含敏感信息。 */
  error?: string;
}

/**
 * 上报底层适配器接口（平台边界）。
 * 真机侧由后续真实 adapter（如基于微信云开发云函数 trackEvent 的实现，属本任务之后）落地；
 * 本任务【不得】写真实云调用，仅提供 MockAnalyticsUploadAdapter 供 Node/Vitest 测试。
 */
export interface AnalyticsUploadAdapter {
  /** 上报一批事件；resolve UploadResult（ok / error），不 reject。 */
  upload(events: AnalyticsUploadEvent[]): Promise<UploadResult>;
}

/** 队列中的一条事件及其重试元数据。 */
export interface QueuedEvent {
  event: AnalyticsUploadEvent;
  status: UploadStatus;
  /** 已尝试上报次数。 */
  attempts: number;
  /** 下次可重试时间（仅 failed 时有意义）；now >= retryAt 才会被再次 flush。 */
  retryAt?: number;
  /** 首次失败时间，用于 24 小时保留窗口裁剪。 */
  firstFailedAt?: number;
  lastError?: string;
}

export interface EnqueueResult {
  accepted: boolean;
  /** 校验不通过时的错误列表（accepted=false 时非空）。 */
  errors: string[];
}

export interface FlushSummary {
  /** 本次 flush 尝试上报的事件数。 */
  attempted: number;
  /** 标记为已发送的数量。 */
  sent: number;
  /** 标记为失败（含本次新失败/重试再失败）的数量。 */
  failed: number;
}

export interface AnalyticsUploadQueueOptions {
  /** 重试退避间隔（毫秒）；超出列表后统一用 tailDelayMs。默认 10s / 30s / 60s。 */
  retryDelaysMs?: number[];
  /** 退避列表用尽后的固定间隔，默认 5 分钟。 */
  tailDelayMs?: number;
  /** failed 事件最大保留条数（超出丢弃最旧），默认 100。 */
  maxFailedRetained?: number;
  /** failed 事件最长保留时长（毫秒），默认 24 小时。 */
  failedTtlMs?: number;
}

const DEFAULT_RETRY_DELAYS = [10_000, 30_000, 60_000];
const DEFAULT_TAIL_DELAY = 5 * 60_000;
const DEFAULT_MAX_FAILED = 100;
const DEFAULT_FAILED_TTL = 24 * 60 * 60_000;

/**
 * 失败重试队列：把校验通过的事件入队为 pending，flush 时交给 adapter 上报，
 * 成功置 sent、失败置 failed 并按退避计算 retryAt；保留窗口按「100 条或 24 小时」裁剪 failed。
 * 纯内存、确定性，可在 Node/Vitest 注入 now 与 mock adapter 测试。
 */
export class AnalyticsUploadQueue {
  private readonly entries: QueuedEvent[] = [];
  private readonly retryDelays: number[];
  private readonly tailDelay: number;
  private readonly maxFailedRetained: number;
  private readonly failedTtl: number;

  constructor(
    private readonly adapter: AnalyticsUploadAdapter,
    options: AnalyticsUploadQueueOptions = {},
  ) {
    this.retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    this.tailDelay = options.tailDelayMs ?? DEFAULT_TAIL_DELAY;
    this.maxFailedRetained = options.maxFailedRetained ?? DEFAULT_MAX_FAILED;
    this.failedTtl = options.failedTtlMs ?? DEFAULT_FAILED_TTL;
  }

  /** 入队前先校验；校验不通过则拒绝（不入队、不上报），返回错误列表。 */
  enqueue(event: AnalyticsUploadEvent): EnqueueResult {
    const validation = validateUploadEvent(event);
    if (!validation.valid) {
      return { accepted: false, errors: validation.errors };
    }
    this.entries.push({ event, status: 'pending', attempts: 0 });
    return { accepted: true, errors: [] };
  }

  /** 计算第 n 次（1 基）失败后的退避间隔。 */
  private delayForAttempt(attempts: number): number {
    const index = attempts - 1;
    return index < this.retryDelays.length ? this.retryDelays[index] : this.tailDelay;
  }

  /** 当前到期可上报的条目：pending，或 failed 且 retryAt <= now。 */
  private dueEntries(now: number): QueuedEvent[] {
    return this.entries.filter(
      (e) =>
        e.status === 'pending' ||
        (e.status === 'failed' && (e.retryAt === undefined || e.retryAt <= now)),
    );
  }

  /**
   * 上报所有到期事件（合并为一批交给 adapter）。
   * 成功：全部置 sent；失败：全部置 failed，attempts+1 并按退避设 retryAt。
   * flush 后做保留窗口裁剪。
   */
  async flush(now: number): Promise<FlushSummary> {
    const due = this.dueEntries(now);
    if (due.length === 0) {
      this.prune(now);
      return { attempted: 0, sent: 0, failed: 0 };
    }

    const result = await this.adapter.upload(due.map((e) => e.event));

    let sent = 0;
    let failed = 0;
    for (const entry of due) {
      entry.attempts += 1;
      if (result.ok) {
        entry.status = 'sent';
        entry.retryAt = undefined;
        entry.lastError = undefined;
        sent += 1;
      } else {
        entry.status = 'failed';
        entry.lastError = result.error;
        entry.firstFailedAt = entry.firstFailedAt ?? now;
        entry.retryAt = now + this.delayForAttempt(entry.attempts);
        failed += 1;
      }
    }

    this.prune(now);
    return { attempted: due.length, sent, failed };
  }

  /** 保留窗口裁剪：丢弃超过 24 小时的 failed，并把 failed 条数压到上限内（丢弃最旧）。 */
  private prune(now: number): void {
    // 24 小时窗口
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      if (e.status === 'failed' && e.firstFailedAt !== undefined && now - e.firstFailedAt > this.failedTtl) {
        this.entries.splice(i, 1);
      }
    }
    // 条数上限（仅裁 failed，按入队顺序丢弃最旧）
    const failedIdx = this.entries
      .map((e, i) => ({ e, i }))
      .filter((x) => x.e.status === 'failed')
      .map((x) => x.i);
    const overflow = failedIdx.length - this.maxFailedRetained;
    if (overflow > 0) {
      const dropSet = new Set(failedIdx.slice(0, overflow));
      let k = 0;
      for (let i = 0; i < this.entries.length; i++) {
        if (!dropSet.has(i)) {
          this.entries[k++] = this.entries[i];
        }
      }
      this.entries.length = k;
    }
  }

  /** 全部条目快照（只读副本，便于断言/调试）。 */
  snapshot(): QueuedEvent[] {
    return this.entries.map((e) => ({ ...e }));
  }

  countByStatus(status: UploadStatus): number {
    return this.entries.reduce((n, e) => (e.status === status ? n + 1 : n), 0);
  }

  get size(): number {
    return this.entries.length;
  }
}
