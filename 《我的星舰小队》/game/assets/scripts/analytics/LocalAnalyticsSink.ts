/**
 * 本地埋点 Sink（C13）。
 *
 * 纯 TypeScript 模块，不依赖 cc：把 AnalyticsService 产出的事件落到本地可调试输出，供开发期 / QA 验收。
 * 阶段2只做：内存缓冲（便于断言与导出）+ 控制台调试行；不写磁盘文件、不接云上报（真实上报通道留到阶段4）。
 *
 * 调试行统一以 `analytics_event_emitted` 打头，QA 可据此在控制台过滤事件到达情况。
 */
import { AnalyticsEventRecord, AnalyticsSink } from './AnalyticsService';

export interface LocalAnalyticsSinkOptions {
  /** 是否打印控制台调试行，默认 true；测试中可关闭以保持输出干净。 */
  console?: boolean;
}

export class LocalAnalyticsSink implements AnalyticsSink {
  /** 已记录的全部事件（按发生顺序）。 */
  readonly events: AnalyticsEventRecord[] = [];
  /** 已记录事件的调试日志行（JSONL，便于阶段4替换为落盘/上报）。 */
  readonly logs: string[] = [];

  private readonly consoleEnabled: boolean;

  constructor(options: LocalAnalyticsSinkOptions = {}) {
    this.consoleEnabled = options.console ?? true;
  }

  record(event: AnalyticsEventRecord): void {
    this.events.push(event);
    const line = `analytics_event_emitted ${JSON.stringify(event)}`;
    this.logs.push(line);
    if (this.consoleEnabled) {
      // eslint-disable-next-line no-console
      console.log('[analytics]', line);
    }
  }

  /** 导出 JSONL 文本（每行一条事件），便于阶段4接入本地日志文件 / 云上报。 */
  toJsonl(): string {
    return this.events.map((e) => JSON.stringify(e)).join('\n');
  }

  /** 清空缓冲（场景切换 / 已上报后调用）。 */
  clear(): void {
    this.events.length = 0;
    this.logs.length = 0;
  }
}
