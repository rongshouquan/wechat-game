/**
 * S7 首发正式版主线进度层（CC-07C，纯 TS，不依赖 cc）。
 *
 * 职责：从 S7 配置（mainline_node_config / chapter_config / star_region_config /
 * protection_reset_config）构建只读主线拓扑视图（默认 75 节点路线、章节/星区归属、
 * 保护期状态、70 回退路线投影），并提供纯函数式的节点完成推进。
 *
 * 持久化的主线进度状态（S7MainlineProgressState）形状由本层定义，由 S7SaveService 组合进存档
 * （沿用流程版「core 模块拥有自身状态形状 + 默认 + 规范化，SaveService 组合」的工程模式）。
 *
 * 边界（CC-07C）：只处理主线进度状态/拓扑投影；不接战斗/奖励/养成/建筑/商人/回收/UI/启动链路；
 * 不复用流程版 LevelProgression/PlayerState 业务语义（S7 状态独立）；不 import cc，可在 Node/Vitest 单测。
 */
import {
  S7MainlineNodeConfig,
  S7ChapterConfig,
  S7StarRegionConfig,
  S7ProtectionResetConfig,
} from '../../config/s7/ConfigTypesS7';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';

export type S7ProtectionPeriodTag = 'active' | 'ending_notice' | 'closed';
export type S7Fallback70Tag = S7MainlineNodeConfig['fallback70Tag'];

/** 主线默认起始节点（CC-07-PRE/CC-07C 约定：默认主线从 n001 开始）。 */
export const DEFAULT_S7_MAINLINE_START_NODE = 'n001';
const CUT_70_TAG: S7Fallback70Tag = 'cut_70';

// ===== 持久化进度状态（由 S7SaveService 组合进 S7PlayerState）=====

/** 主线进度持久状态：当前待完成节点 + 已完成节点序列。骨架最小字段，不含战斗/奖励派生数据。 */
export interface S7MainlineProgressState {
  /** 当前所在 / 待完成节点 id（默认 n001）。 */
  currentNodeId: string;
  /** 已完成节点 id（按完成顺序，去重）。 */
  clearedNodeIds: string[];
}

export function createDefaultS7MainlineProgress(): S7MainlineProgressState {
  return { currentNodeId: DEFAULT_S7_MAINLINE_START_NODE, clearedNodeIds: [] };
}

/**
 * 规范化主线进度：currentNodeId 缺失/非串落默认 n001；clearedNodeIds 仅保留非空字符串并去重。
 * 不在此校验节点是否真实存在于配置（拓扑校验交由 S7MainlineModel / 推进函数），只保证结构干净。
 */
export function normalizeS7MainlineProgress(raw: unknown): S7MainlineProgressState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const currentNodeId =
    typeof src.currentNodeId === 'string' && src.currentNodeId.length > 0
      ? src.currentNodeId
      : DEFAULT_S7_MAINLINE_START_NODE;
  const rawCleared = Array.isArray(src.clearedNodeIds) ? src.clearedNodeIds : [];
  const cleared = rawCleared.filter((x): x is string => typeof x === 'string' && x.length > 0);
  // Array.from(new Set(...)) 去重：避免 Cocos 构建对 [...new Set()] 的 spread 降级 bug（见流程版注释）。
  return { currentNodeId, clearedNodeIds: Array.from(new Set(cleared)) };
}

// ===== 只读拓扑视图 =====

export interface S7MainlineNodeView {
  nodeId: string;
  /** 默认路线中的 1-based 序号。 */
  order: number;
  starfieldId: string;
  chapterId: string;
  nodeTypeTag: string;
  protectionPeriodTag: S7ProtectionPeriodTag;
  fallback70Tag: S7Fallback70Tag;
  /** 是否 70 回退可删节点（fallback70Tag === 'cut_70'）。 */
  cut70: boolean;
}

export interface S7ProtectionStatusView {
  nodeId: string;
  protectionPeriodTag: S7ProtectionPeriodTag;
  freeResetFlag: boolean;
  resetScopeTags: string[];
  irreversibleWarningFlag: boolean;
}

export interface S7ChapterView {
  chapterId: string;
  starfieldId: string;
  bossRef: string;
}

export interface S7StarRegionView {
  starfieldId: string;
  nodeRangeTag: string;
}

export class S7MainlineModelError extends Error {
  constructor(message: string) {
    super(`s7 mainline model 构建失败: ${message}`);
    this.name = 'S7MainlineModelError';
  }
}

export interface S7MainlineModelInput {
  nodes: S7MainlineNodeConfig[];
  chapters: S7ChapterConfig[];
  starRegions: S7StarRegionConfig[];
  protectionResets: S7ProtectionResetConfig[];
}

// ===== 节点完成推进结果 =====

export type S7CompleteNodeError = 'unknown_node' | 'already_cleared' | 'out_of_order';

export type S7CompleteNodeResult =
  | {
      ok: true;
      state: S7MainlineProgressState;
      completedNodeId: string;
      nextNodeId: string;
      /** 是否已完成最终节点（n075）。 */
      finished: boolean;
    }
  | { ok: false; error: S7CompleteNodeError; state: S7MainlineProgressState };

/**
 * S7 主线只读模型：从配置构建默认路线、章节/星区视图、保护期映射与 70 回退投影。
 * 构建后不可变；进度推进由独立纯函数（completeS7Node）操作 S7MainlineProgressState，不在模型内持状态。
 */
export class S7MainlineModel {
  private readonly orderedNodeIds: string[];
  private readonly nodeViews: Map<string, S7MainlineNodeView>;
  private readonly protectionByNode: Map<string, S7ProtectionResetConfig>;
  readonly chapters: S7ChapterView[];
  readonly starRegions: S7StarRegionView[];

  constructor(input: S7MainlineModelInput) {
    if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
      throw new S7MainlineModelError('mainline_node_config 为空');
    }

    // 以 nodeId 升序定义规范路线（nodeId 为零填充 n###，字典序即数值序），不依赖配置数组原始顺序。
    const sorted = [...input.nodes].sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
    this.orderedNodeIds = sorted.map((n) => n.nodeId);

    this.nodeViews = new Map();
    sorted.forEach((n, i) => {
      if (this.nodeViews.has(n.nodeId)) {
        throw new S7MainlineModelError(`重复节点 id ${n.nodeId}`);
      }
      this.nodeViews.set(n.nodeId, {
        nodeId: n.nodeId,
        order: i + 1,
        starfieldId: n.starfieldId,
        chapterId: n.chapterId,
        nodeTypeTag: n.nodeTypeTag,
        protectionPeriodTag: n.protectionPeriodTag,
        fallback70Tag: n.fallback70Tag,
        cut70: n.fallback70Tag === CUT_70_TAG,
      });
    });

    this.protectionByNode = new Map();
    for (const p of input.protectionResets ?? []) {
      this.protectionByNode.set(p.nodeId, p);
    }

    this.chapters = (input.chapters ?? []).map((c) => ({
      chapterId: c.chapterId,
      starfieldId: c.starfieldId,
      bossRef: c.bossRef,
    }));
    this.starRegions = (input.starRegions ?? []).map((s) => ({
      starfieldId: s.starfieldId,
      nodeRangeTag: s.nodeRangeTag,
    }));
  }

  /** 便捷构建：直接从 CC-07A 运行时加载层拉取所需 4 张表。 */
  static fromRuntime(runtime: S7ConfigRuntime): S7MainlineModel {
    return new S7MainlineModel({
      nodes: runtime.getAll<S7MainlineNodeConfig>('mainline_node_config'),
      chapters: runtime.getAll<S7ChapterConfig>('chapter_config'),
      starRegions: runtime.getAll<S7StarRegionConfig>('star_region_config'),
      protectionResets: runtime.getAll<S7ProtectionResetConfig>('protection_reset_config'),
    });
  }

  get nodeCount(): number {
    return this.orderedNodeIds.length;
  }

  get chapterCount(): number {
    return this.chapters.length;
  }

  get starRegionCount(): number {
    return this.starRegions.length;
  }

  /** 默认 75 节点路线（按 nodeId 升序，只读副本）。 */
  get defaultRoute(): string[] {
    return [...this.orderedNodeIds];
  }

  /** 70 回退路线投影：默认路线剔除全部 cut_70 节点（merge_70 节点保留）。 */
  get fallback70Route(): string[] {
    return this.orderedNodeIds.filter((id) => !this.nodeViews.get(id)!.cut70);
  }

  /** cut_70 可删节点 id（只读副本）。 */
  get cut70NodeIds(): string[] {
    return this.orderedNodeIds.filter((id) => this.nodeViews.get(id)!.cut70);
  }

  hasNode(nodeId: string): boolean {
    return this.nodeViews.has(nodeId);
  }

  nodeView(nodeId: string): S7MainlineNodeView | undefined {
    return this.nodeViews.get(nodeId);
  }

  /** 节点的下一节点（默认路线）；最终节点返回 undefined。 */
  nextNodeId(nodeId: string): string | undefined {
    const idx = this.orderedNodeIds.indexOf(nodeId);
    if (idx < 0) return undefined;
    return this.orderedNodeIds[idx + 1];
  }

  /**
   * 已通关最高星域档（1-based）：某星域的"最后一个节点"（该 starfieldId 下 order 最大者）在 clearedNodeIds 内
   * 即视为该星域已通关；返回最高通关星域号（sf0N → N），一个都没通关返回 0。
   * 用于离线产出"星域系数"（v1.0 §7：产出速率随已通关最高星域永久抬升基线）。与建筑无关，读主线进度。
   */
  clearedStarfieldTier(clearedNodeIds: string[]): number {
    const cleared = new Set(clearedNodeIds);
    const lastNodeBySf = new Map<string, { order: number; nodeId: string }>();
    for (const view of this.nodeViews.values()) {
      const cur = lastNodeBySf.get(view.starfieldId);
      if (!cur || view.order > cur.order) lastNodeBySf.set(view.starfieldId, { order: view.order, nodeId: view.nodeId });
    }
    let tier = 0;
    for (const [sfId, last] of lastNodeBySf) {
      if (!cleared.has(last.nodeId)) continue;
      const n = parseInt(sfId.replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && n > tier) tier = n;
    }
    return tier;
  }

  /**
   * 节点保护期状态视图：以节点自身 protectionPeriodTag 为基底，
   * 若 protection_reset_config 含该节点（n038/n039）则合入 freeReset/resetScope/irreversibleWarning，
   * 否则三项取保守默认（false/[]/false）。未知节点返回 undefined。
   */
  protectionStatus(nodeId: string): S7ProtectionStatusView | undefined {
    const view = this.nodeViews.get(nodeId);
    if (!view) return undefined;
    const reset = this.protectionByNode.get(nodeId);
    return {
      nodeId,
      protectionPeriodTag: view.protectionPeriodTag,
      freeResetFlag: reset?.freeResetFlag ?? false,
      resetScopeTags: reset ? [...reset.resetScopeTags] : [],
      irreversibleWarningFlag: reset?.irreversibleWarningFlag ?? false,
    };
  }
}

/**
 * 完成一个主线节点（纯函数，默认路线推进）。
 * 失败时返回原状态不变（不写脏状态）：
 * - 未知节点 -> unknown_node
 * - 已完成节点 -> already_cleared
 * - 非当前待完成节点（越级 / 回填旧节点）-> out_of_order
 * 成功时返回新状态：currentNodeId 推进到下一节点（最终节点保持自身），clearedNodeIds 追加本节点。
 */
export function completeS7Node(
  model: S7MainlineModel,
  state: S7MainlineProgressState,
  nodeId: string,
): S7CompleteNodeResult {
  if (!model.hasNode(nodeId)) {
    return { ok: false, error: 'unknown_node', state };
  }
  if (state.clearedNodeIds.includes(nodeId)) {
    return { ok: false, error: 'already_cleared', state };
  }
  if (nodeId !== state.currentNodeId) {
    return { ok: false, error: 'out_of_order', state };
  }
  const next = model.nextNodeId(nodeId);
  const finished = next === undefined;
  const nextNodeId = next ?? nodeId; // 最终节点完成后停留在自身
  return {
    ok: true,
    state: { currentNodeId: nextNodeId, clearedNodeIds: [...state.clearedNodeIds, nodeId] },
    completedNodeId: nodeId,
    nextNodeId,
    finished,
  };
}
