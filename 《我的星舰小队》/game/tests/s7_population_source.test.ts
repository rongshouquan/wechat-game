// 阶段一 K：人口来源·主线救回单测（v1.0 §7/§11）——
//   解析(配置节点→救回量/未配置→null/全0→null) · 默认配置自检(早期节点有救回·居民为主)。
// 纯结构、不读磁盘。
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_S7_POPULATION_SOURCE_CONFIG as CFG, S7PopulationSourceConfig, resolveNodeRescue,
} from '../assets/scripts/core/s7/S7PopulationSourceConfig';

describe('S7 人口 · 主线救回解析', () => {
  it('配置节点 → 返回救回量', () => {
    expect(resolveNodeRescue(CFG, 'n001')).toEqual({ residents: 2, workers: 0 });
    expect(resolveNodeRescue(CFG, 'n008')).toEqual({ residents: 3, workers: 1 });
  });

  it('未配置节点 → null', () => {
    expect(resolveNodeRescue(CFG, 'n002')).toBeNull();
    expect(resolveNodeRescue(CFG, 'no_such')).toBeNull();
  });

  it('全 0 / 负数 → null·负数清零', () => {
    const cfg: S7PopulationSourceConfig = { rescueByNode: { z: { residents: 0, workers: 0 }, neg: { residents: -3, workers: 2 } } };
    expect(resolveNodeRescue(cfg, 'z')).toBeNull();
    expect(resolveNodeRescue(cfg, 'neg')).toEqual({ residents: 0, workers: 2 });
  });
});

describe('S7 人口 · 默认配置自检', () => {
  it('早期节点配了救回·居民总量 > 工人总量（§9.3 居民走主线救回为主）', () => {
    const entries = Object.values(CFG.rescueByNode);
    expect(entries.length).toBeGreaterThan(0);
    const totRes = entries.reduce((s, g) => s + g.residents, 0);
    const totWork = entries.reduce((s, g) => s + g.workers, 0);
    expect(totRes).toBeGreaterThan(totWork);
  });
});
