// CC-07C: S7 主线进度层测试。
// 覆盖：拓扑计数（150/25/6，2026-07-02 拓扑改造后）、默认路线 n001-n150、
// 70 回退投影（机制已作废，恒为空/等于默认路线）、
// 节点完成顺序推进 + 失败路径（未知/重复/越级不写脏状态）、n018/n019 保护期映射（原N038/N039前移），
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
  it('reports 150 nodes, 25 chapters, 6 star regions', () => {
    const m = buildModelFromFs();
    expect(m.nodeCount).toBe(150);
    expect(m.chapterCount).toBe(25);
    expect(m.starRegionCount).toBe(6);
  });

  it('default route spans n001..n150 in order', () => {
    const m = buildModelFromFs();
    const route = m.defaultRoute;
    expect(route).toHaveLength(150);
    expect(route[0]).toBe('n001');
    expect(route[route.length - 1]).toBe('n150');
    const expected = Array.from({ length: 150 }, (_, i) => `n${String(i + 1).padStart(3, '0')}`);
    expect(route).toEqual(expected);
  });

  it('node views expose 1-based order and cut70 flag', () => {
    const m = buildModelFromFs();
    expect(m.nodeView('n001')?.order).toBe(1);
    expect(m.nodeView('n150')?.order).toBe(150);
    // 70回退机制已作废（2026-07-02），全部节点 fallback70Tag=keep_70，cut70 恒为 false。
    expect(m.nodeView('n060')?.cut70).toBe(false);
    expect(m.nodeView('n999')).toBeUndefined();
  });

  it('clearedStarfieldTier：按各星域最后节点是否通关算最高通关星域（离线星域系数用）', () => {
    const m = buildModelFromFs();
    // 星域最后节点（2026-07-02 拓扑改造）：sf01→n060 / sf02→n084 / sf03→n102 / sf04→n120 / sf05→n138 / sf06→n150
    expect(m.clearedStarfieldTier([])).toBe(0); // 未通关任何星域
    expect(m.clearedStarfieldTier(['n001', 'n059'])).toBe(0); // sf01 最后节点 n060 未过
    expect(m.clearedStarfieldTier(['n001', 'n060'])).toBe(1); // sf01 通关
    expect(m.clearedStarfieldTier(['n060', 'n084'])).toBe(2); // sf02 通关
    expect(m.clearedStarfieldTier(['n060', 'n084', 'n102'])).toBe(3);
    expect(m.clearedStarfieldTier(['n060', 'n084', 'n102', 'n120', 'n138', 'n150'])).toBe(6); // 全通关
  });

  it('70-fallback projection：机制已作废，无节点被砍，等于默认路线', () => {
    const m = buildModelFromFs();
    expect(m.cut70NodeIds).toEqual([]);
    expect(m.fallback70Route).toHaveLength(150);
    expect(m.fallback70Route).toEqual(m.defaultRoute);
  });

  it('maps n018/n019 protection-period status from protection_reset_config', () => {
    const m = buildModelFromFs();
    const n018 = m.protectionStatus('n018')!;
    expect(n018.protectionPeriodTag).toBe('ending_notice');
    expect(n018.freeResetFlag).toBe(true);
    expect(n018.resetScopeTags.length).toBeGreaterThan(0);
    expect(n018.irreversibleWarningFlag).toBe(false);

    const n019 = m.protectionStatus('n019')!;
    expect(n019.protectionPeriodTag).toBe('closed');
    expect(n019.freeResetFlag).toBe(false);
    expect(n019.irreversibleWarningFlag).toBe(true);

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
    expect(m.nodeCount).toBe(150);
    expect(m.fallback70Route).toHaveLength(150);
  });
});

describe('s7 mainline progress - advancement', () => {
  it('default progress starts at n001 with no cleared nodes', () => {
    const p = createDefaultS7MainlineProgress();
    expect(p.currentNodeId).toBe('n001');
    expect(p.clearedNodeIds).toEqual([]);
  });

  it('advances sequentially from n001 to n150 and flags finished on the last node', () => {
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
    expect(state.clearedNodeIds).toHaveLength(150);
    expect(state.currentNodeId).toBe('n150'); // 终点完成后停留自身
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
