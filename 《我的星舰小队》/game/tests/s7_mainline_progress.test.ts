// CC-07C: S7 主线进度层测试。
// 覆盖：拓扑计数（75/12/4）、默认路线 n001-n075、70 回退投影（70 节点，只剔 5 cut_70）、
// 节点完成顺序推进 + 失败路径（未知/重复/越级不写脏状态）、n038/n039 保护期映射，
// 并经 CC-07A 运行时加载层（S7ConfigRuntime）构建模型验证端到端可用。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7MainlineModel,
  completeS7Node,
  createDefaultS7MainlineProgress,
  normalizeS7MainlineProgress,
  S7MainlineProgressState,
} from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7ConfigRuntime, S7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const CUT_70 = ['n033', 'n047', 'n053', 'n063', 'n070'];
const MERGE_70 = ['n004', 'n021', 'n028', 'n035'];

function readTable<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(S7_DIR, `${name}.sample.json`), 'utf-8')) as T;
}

function buildModelFromFs(): S7MainlineModel {
  return new S7MainlineModel({
    nodes: readTable('mainline_node_config'),
    chapters: readTable('chapter_config'),
    starRegions: readTable('star_region_config'),
    protectionResets: readTable('protection_reset_config'),
  });
}

describe('s7 mainline model - topology', () => {
  it('reports 75 nodes, 12 chapters, 4 star regions', () => {
    const m = buildModelFromFs();
    expect(m.nodeCount).toBe(75);
    expect(m.chapterCount).toBe(12);
    expect(m.starRegionCount).toBe(4);
  });

  it('default route spans n001..n075 in order', () => {
    const m = buildModelFromFs();
    const route = m.defaultRoute;
    expect(route).toHaveLength(75);
    expect(route[0]).toBe('n001');
    expect(route[route.length - 1]).toBe('n075');
    const expected = Array.from({ length: 75 }, (_, i) => `n${String(i + 1).padStart(3, '0')}`);
    expect(route).toEqual(expected);
  });

  it('node views expose 1-based order and cut70 flag', () => {
    const m = buildModelFromFs();
    expect(m.nodeView('n001')?.order).toBe(1);
    expect(m.nodeView('n075')?.order).toBe(75);
    expect(m.nodeView('n033')?.cut70).toBe(true);
    expect(m.nodeView('n004')?.cut70).toBe(false); // merge_70, 非可删
    expect(m.nodeView('n999')).toBeUndefined();
  });

  it('clearedStarfieldTier：按各星域最后节点是否通关算最高通关星域（离线星域系数用）', () => {
    const m = buildModelFromFs();
    // 星域最后节点：sf01→n018 / sf02→n037 / sf03→n056 / sf04→n075
    expect(m.clearedStarfieldTier([])).toBe(0); // 未通关任何星域
    expect(m.clearedStarfieldTier(['n001', 'n017'])).toBe(0); // sf01 最后节点 n018 未过
    expect(m.clearedStarfieldTier(['n001', 'n018'])).toBe(1); // sf01 通关
    expect(m.clearedStarfieldTier(['n018', 'n037'])).toBe(2); // sf02 通关
    expect(m.clearedStarfieldTier(['n018', 'n037', 'n056'])).toBe(3);
    expect(m.clearedStarfieldTier(['n018', 'n037', 'n056', 'n075'])).toBe(4); // 全通关
  });

  it('70-fallback projection drops exactly the 5 cut_70 nodes, keeps merge_70 nodes', () => {
    const m = buildModelFromFs();
    expect([...m.cut70NodeIds].sort()).toEqual([...CUT_70].sort());
    const route70 = m.fallback70Route;
    expect(route70).toHaveLength(70);
    for (const id of CUT_70) expect(route70).not.toContain(id);
    for (const id of MERGE_70) expect(route70).toContain(id);
  });

  it('maps n038/n039 protection-period status from protection_reset_config', () => {
    const m = buildModelFromFs();
    const n038 = m.protectionStatus('n038')!;
    expect(n038.protectionPeriodTag).toBe('ending_notice');
    expect(n038.freeResetFlag).toBe(true);
    expect(n038.resetScopeTags.length).toBeGreaterThan(0);
    expect(n038.irreversibleWarningFlag).toBe(false);

    const n039 = m.protectionStatus('n039')!;
    expect(n039.protectionPeriodTag).toBe('closed');
    expect(n039.freeResetFlag).toBe(false);
    expect(n039.irreversibleWarningFlag).toBe(true);

    // 普通节点：保护期取节点自身 tag，重置三项为保守默认。
    const n001 = m.protectionStatus('n001')!;
    expect(n001.protectionPeriodTag).toBe('active');
    expect(n001.freeResetFlag).toBe(false);
    expect(n001.resetScopeTags).toEqual([]);
  });

  it('builds the same model through the CC-07A runtime loading layer', async () => {
    const fsReader: S7TableReader = async (t: S7ConfigTableName) =>
      JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
    const rt = await S7ConfigRuntime.load(fsReader);
    const m = S7MainlineModel.fromRuntime(rt);
    expect(m.nodeCount).toBe(75);
    expect(m.fallback70Route).toHaveLength(70);
  });
});

describe('s7 mainline progress - advancement', () => {
  it('default progress starts at n001 with no cleared nodes', () => {
    const p = createDefaultS7MainlineProgress();
    expect(p.currentNodeId).toBe('n001');
    expect(p.clearedNodeIds).toEqual([]);
  });

  it('advances sequentially from n001 to n075 and flags finished on the last node', () => {
    const m = buildModelFromFs();
    let state = createDefaultS7MainlineProgress();
    const route = m.defaultRoute;
    for (let i = 0; i < route.length; i++) {
      const res = completeS7Node(m, state, route[i]);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.completedNodeId).toBe(route[i]);
      expect(res.finished).toBe(i === route.length - 1);
      state = res.state;
    }
    expect(state.clearedNodeIds).toHaveLength(75);
    expect(state.currentNodeId).toBe('n075'); // 终点完成后停留自身
  });

  it('rejects an unknown node without mutating state', () => {
    const m = buildModelFromFs();
    const state = createDefaultS7MainlineProgress();
    const res = completeS7Node(m, state, 'n999');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('unknown_node');
    expect(res.state).toBe(state); // 原状态引用未变
    expect(state.clearedNodeIds).toEqual([]);
  });

  it('rejects an out-of-order (越级) completion without mutating state', () => {
    const m = buildModelFromFs();
    const state = createDefaultS7MainlineProgress(); // current = n001
    const res = completeS7Node(m, state, 'n003');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('out_of_order');
    expect(state.currentNodeId).toBe('n001');
    expect(state.clearedNodeIds).toEqual([]);
  });

  it('rejects re-completing an already cleared node', () => {
    const m = buildModelFromFs();
    let state = createDefaultS7MainlineProgress();
    const first = completeS7Node(m, state, 'n001');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state; // current = n002, cleared = [n001]
    const again = completeS7Node(m, state, 'n001');
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toBe('already_cleared');
    expect(state.currentNodeId).toBe('n002');
    expect(state.clearedNodeIds).toEqual(['n001']);
  });
});

describe('s7 mainline progress - normalization', () => {
  it('fills defaults and de-dups dirty progress state', () => {
    const normalized: S7MainlineProgressState = normalizeS7MainlineProgress({
      currentNodeId: '',
      clearedNodeIds: ['n001', 'n001', '', 42, 'n002'],
    });
    expect(normalized.currentNodeId).toBe('n001'); // 空串落默认
    expect(normalized.clearedNodeIds).toEqual(['n001', 'n002']); // 去重 + 丢非串/空串
  });

  it('returns clean default for non-object input', () => {
    expect(normalizeS7MainlineProgress(null)).toEqual({ currentNodeId: 'n001', clearedNodeIds: [] });
    expect(normalizeS7MainlineProgress(undefined)).toEqual({ currentNodeId: 'n001', clearedNodeIds: [] });
  });
});
