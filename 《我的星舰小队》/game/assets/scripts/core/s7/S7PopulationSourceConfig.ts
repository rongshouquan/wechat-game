// 人口来源·主线救回配置（阶段一 K，纯 TS，不依赖 cc）：v1.0 §7/§11，资源渠道 §9.3「居民/工人」。
//
// ⚠️ 全表 v0.1 占位（Ron 授权 Claude 定灰盒占位·第二块「人口节奏」统一校准）：
//   - 人口三来源（§9.3）：居民=**主线推进救回(主)** + 7天过程 + 打捞低频；工人=7天扩张 + 基地里程碑 + 打捞低频。
//   - 7天/打捞 的人口已在 G 活动 / D 打捞接好；**本块补「主线救回」这条主来源**——指定主线节点首通救回 居民/工人。
//   - §8：居民/工人**不进**关卡三选一池（走主线救回/7天/打捞）；故救回与 F 三选一并行、互不重叠。
//   - §16 是「效果封顶」(居民+40%/工人-30%)非数量封顶 → 人口数量可增长，封顶在居住舱效果侧。
//   - 救回量/分布全占位·居民为主·工人少量·第二块校准。

/** 一个节点首通救回的人口（居民/工人·非负整数）。 */
export interface S7RescueGrant {
  residents: number;
  workers: number;
}

export interface S7PopulationSourceConfig {
  /** 节点 id → 该节点首通救回的人口（未列出的节点不救回）。 */
  rescueByNode: Record<string, S7RescueGrant>;
}

// ===== 默认配置（v0.1 占位探针·早期节点多救人、热闹感·第二块校准）=====

export const DEFAULT_S7_POPULATION_SOURCE_CONFIG: S7PopulationSourceConfig = {
  rescueByNode: {
    n001: { residents: 2, workers: 0 },
    n003: { residents: 3, workers: 0 },
    n005: { residents: 0, workers: 1 },
    n008: { residents: 3, workers: 1 },
    n012: { residents: 0, workers: 2 },
    n016: { residents: 4, workers: 1 },
  },
};

/** 解析某节点首通应救回的人口（无配置 → null·调用方按"不救回"处理）。纯函数。 */
export function resolveNodeRescue(config: S7PopulationSourceConfig, nodeId: string): S7RescueGrant | null {
  const g = config.rescueByNode[nodeId];
  if (!g) return null;
  const residents = typeof g.residents === 'number' && Number.isFinite(g.residents) && g.residents > 0 ? Math.floor(g.residents) : 0;
  const workers = typeof g.workers === 'number' && Number.isFinite(g.workers) && g.workers > 0 ? Math.floor(g.workers) : 0;
  if (residents === 0 && workers === 0) return null;
  return { residents, workers };
}
