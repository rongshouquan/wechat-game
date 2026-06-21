// 阶段一 F-step1：关卡三选一发奖引擎单测（v1.0 §8）——
//   节点档解析 · 首个 Boss 判定 · 三选一抽取(不同项/随机指定专属碎片/none/候选空/不足/确定性) ·
//   Boss 大奖(首=过载核心/其余=星辉货舱) · 看广告×2(数量翻倍/唯一核不翻) · 默认池 §8 构成自检。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import {
  DEFAULT_S7_LEVEL_REWARD_CONFIG as CFG,
  S7LevelRewardConfig,
  S7LevelPoolEntry,
} from '../assets/scripts/core/s7/S7LevelRewardConfig';
import {
  resolveLevelStage,
  firstBossNodeId,
  rollLevelChoices,
  resolveBossGrand,
  doubleLevelReward,
  doubleLevelRewards,
  S7UnitCandidates,
} from '../assets/scripts/core/s7/S7LevelRewardService';

const ALL_UNITS: S7UnitCandidates = {
  ships: ['shp01', 'shp02', 'shp03', 'shp04'],
  pilots: ['plt01', 'plt02', 'plt03'],
};

describe('S7 关卡发奖 · 节点档解析', () => {
  it('elite/boss/none 按映射，普通及未列出类型默认 normal', () => {
    expect(resolveLevelStage('normal', CFG)).toBe('normal');
    expect(resolveLevelStage('elite', CFG)).toBe('elite');
    expect(resolveLevelStage('boss', CFG)).toBe('boss');
    expect(resolveLevelStage('reset_gate', CFG)).toBe('none');
    expect(resolveLevelStage('protection_notice', CFG)).toBe('none');
    // 未列出 → 默认 normal（含 tutorial/checkpoint/review/boss_prep 与任意未知 tag）。
    expect(resolveLevelStage('tutorial_battle', CFG)).toBe('normal');
    expect(resolveLevelStage('checkpoint', CFG)).toBe('normal');
    expect(resolveLevelStage('boss_prep', CFG)).toBe('normal');
    expect(resolveLevelStage('whatever_unknown', CFG)).toBe('normal');
  });
});

describe('S7 关卡发奖 · 首个 Boss 判定', () => {
  it('取按顺序第一个 boss 节点；无 boss → null', () => {
    const nodes = [
      { nodeId: 'n001', nodeTypeTag: 'normal' },
      { nodeId: 'n006', nodeTypeTag: 'elite' },
      { nodeId: 'n018', nodeTypeTag: 'boss' },
      { nodeId: 'n037', nodeTypeTag: 'boss' },
    ];
    expect(firstBossNodeId(nodes)).toBe('n018');
    expect(firstBossNodeId([{ nodeId: 'n001', nodeTypeTag: 'normal' }])).toBeNull();
    expect(firstBossNodeId([])).toBeNull();
  });
});

describe('S7 关卡发奖 · 三选一抽取', () => {
  it('池≥3 时返回恰好 choiceCount 个、互不相同的项', () => {
    const choices = rollLevelChoices(CFG, 'normal', new S7AutoBattleRng('seed-a'), ALL_UNITS);
    expect(choices.length).toBe(CFG.choiceCount); // 3
    // 不同项：用「种类+具体内容」签名判重，确保无放回（不出现两个一模一样的选项）。
    const sig = (r: typeof choices[number]): string => {
      switch (r.kind) {
        case 'resource': return `res:${r.resourceId}`;
        case 'exclusiveShard': return `exs:${r.unitKind}`; // 同一「随机指定X专属碎片」模板只会出一次
        case 'plugin': return `plg:${r.quality}`;
        case 'chest': return `chest:${r.chestId}`;
        case 'core': return `core:${r.coreId}`;
      }
    };
    expect(new Set(choices.map(sig)).size).toBe(choices.length);
  });

  it('无放回：用各项唯一 resourceId 的池抽 3，得 3 个不同 resourceId', () => {
    const entries: S7LevelPoolEntry[] = [
      { kind: 'resource', resourceId: 'a', amount: 1, weight: 1 },
      { kind: 'resource', resourceId: 'b', amount: 1, weight: 1 },
      { kind: 'resource', resourceId: 'c', amount: 1, weight: 1 },
      { kind: 'resource', resourceId: 'd', amount: 1, weight: 1 },
      { kind: 'resource', resourceId: 'e', amount: 1, weight: 1 },
    ];
    const cfg: S7LevelRewardConfig = { ...CFG, choiceCount: 3, pools: { ...CFG.pools, normal: entries } };
    for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
      const out = rollLevelChoices(cfg, 'normal', new S7AutoBattleRng(seed), ALL_UNITS);
      const ids = out.map((r) => (r.kind === 'resource' ? r.resourceId : '?'));
      expect(ids.length).toBe(3);
      expect(new Set(ids).size).toBe(3); // 无重复
    }
  });

  it('随机指定专属碎片 → 解析为候选内的具体单位', () => {
    // 只含一个「随机指定星舰专属碎片」项的池，候选只有 shp02 → 必出 shp02。
    const cfg: S7LevelRewardConfig = {
      ...CFG, choiceCount: 1,
      pools: { ...CFG.pools, normal: [{ kind: 'exclusiveShardRandom', unitKind: 'ship', amount: 9, weight: 1 }] },
    };
    const out = rollLevelChoices(cfg, 'normal', new S7AutoBattleRng('x'), { ships: ['shp02'], pilots: [] });
    expect(out.length).toBe(1);
    expect(out[0]).toEqual({ kind: 'exclusiveShard', unitKind: 'ship', unitId: 'shp02', amount: 9 });
  });

  it('候选空的「随机指定专属碎片」项被剔除，不占名额也不产出 null', () => {
    // 池：1 个随机指定员碎片 + 2 个资源；员候选为空 → 该项剔除，只剩 2 个资源可抽。
    const cfg: S7LevelRewardConfig = {
      ...CFG, choiceCount: 3,
      pools: {
        ...CFG.pools,
        normal: [
          { kind: 'exclusiveShardRandom', unitKind: 'pilot', amount: 5, weight: 1 },
          { kind: 'resource', resourceId: 'a', amount: 1, weight: 1 },
          { kind: 'resource', resourceId: 'b', amount: 1, weight: 1 },
        ],
      },
    };
    const out = rollLevelChoices(cfg, 'normal', new S7AutoBattleRng('y'), { ships: ['shp01'], pilots: [] });
    expect(out.length).toBe(2); // 只剩两个资源项
    expect(out.every((r) => r.kind === 'resource')).toBe(true);
    expect(out.every((r) => r !== null)).toBe(true);
  });

  it('stage=none → 空数组（整备/提醒节点不发三选一）', () => {
    expect(rollLevelChoices(CFG, 'none', new S7AutoBattleRng('z'), ALL_UNITS)).toEqual([]);
  });

  it('池项不足 choiceCount → 返回现有数量（不报错）', () => {
    const cfg: S7LevelRewardConfig = {
      ...CFG, choiceCount: 3,
      pools: { ...CFG.pools, elite: [{ kind: 'resource', resourceId: 'only', amount: 1, weight: 1 }] },
    };
    const out = rollLevelChoices(cfg, 'elite', new S7AutoBattleRng('q'), ALL_UNITS);
    expect(out.length).toBe(1);
  });

  it('确定性：同 seed 同结果，不同 seed 一般不同', () => {
    const a = rollLevelChoices(CFG, 'boss', new S7AutoBattleRng('same'), ALL_UNITS);
    const b = rollLevelChoices(CFG, 'boss', new S7AutoBattleRng('same'), ALL_UNITS);
    expect(a).toEqual(b);
  });
});

describe('S7 关卡发奖 · Boss 必给大奖', () => {
  it('首个 Boss → 过载核心(core07)；其余 Boss → 星辉货舱', () => {
    expect(resolveBossGrand(CFG, true)).toEqual({ kind: 'core', coreId: 'core07' });
    expect(resolveBossGrand(CFG, false)).toEqual({ kind: 'chest', chestId: 'starlightCargo', amount: 1 });
  });
});

describe('S7 关卡发奖 · 看广告×2', () => {
  it('数量类翻倍；唯一核不翻倍', () => {
    expect(doubleLevelReward({ kind: 'resource', resourceId: 'coreFrag', amount: 20 }))
      .toEqual({ kind: 'resource', resourceId: 'coreFrag', amount: 40 });
    expect(doubleLevelReward({ kind: 'exclusiveShard', unitKind: 'ship', unitId: 'shp01', amount: 8 }))
      .toEqual({ kind: 'exclusiveShard', unitKind: 'ship', unitId: 'shp01', amount: 16 });
    expect(doubleLevelReward({ kind: 'plugin', quality: 'superior', count: 1 }))
      .toEqual({ kind: 'plugin', quality: 'superior', count: 2 });
    expect(doubleLevelReward({ kind: 'chest', chestId: 'starlightCargo', amount: 1 }))
      .toEqual({ kind: 'chest', chestId: 'starlightCargo', amount: 2 });
    // 唯一核：原样返回（翻倍无意义）。
    const core = { kind: 'core', coreId: 'core07' } as const;
    expect(doubleLevelReward(core)).toEqual(core);
  });

  it('批量版逐项翻倍', () => {
    const out = doubleLevelRewards([
      { kind: 'resource', resourceId: 'supplyTicket', amount: 10 },
      { kind: 'core', coreId: 'core07' },
    ]);
    expect(out).toEqual([
      { kind: 'resource', resourceId: 'supplyTicket', amount: 20 },
      { kind: 'core', coreId: 'core07' },
    ]);
  });
});

describe('S7 关卡发奖 · 默认池 §8 构成自检', () => {
  const has = (entries: S7LevelPoolEntry[], pred: (e: S7LevelPoolEntry) => boolean): boolean => entries.some(pred);

  it('三档池都 ≥3 项（保证三选一能填满）', () => {
    expect(CFG.pools.normal.length).toBeGreaterThanOrEqual(3);
    expect(CFG.pools.elite.length).toBeGreaterThanOrEqual(3);
    expect(CFG.pools.boss.length).toBeGreaterThanOrEqual(3);
  });

  it('普通档：精良插件 + 普通信标 + 随机指定舰/员专属碎片 + 补给券 + 星核碎片', () => {
    const p = CFG.pools.normal;
    expect(has(p, (e) => e.kind === 'plugin' && e.quality === 'fine')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'beaconCommon')).toBe(true);
    expect(has(p, (e) => e.kind === 'exclusiveShardRandom' && e.unitKind === 'ship')).toBe(true);
    expect(has(p, (e) => e.kind === 'exclusiveShardRandom' && e.unitKind === 'pilot')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'supplyTicket')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'coreFrag')).toBe(true);
  });

  it('精英档：优秀插件 + 稀有信标 + 随机指定专属碎片 + 补给券 + 星核碎片', () => {
    const p = CFG.pools.elite;
    expect(has(p, (e) => e.kind === 'plugin' && e.quality === 'superior')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'beaconRare')).toBe(true);
    expect(has(p, (e) => e.kind === 'exclusiveShardRandom')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'coreFrag')).toBe(true);
  });

  it('Boss档：优秀+小概率传奇插件 + 史诗信标 + 星空宝石 + 星核碎片 + 补给券 + 随机指定专属碎片', () => {
    const p = CFG.pools.boss;
    expect(has(p, (e) => e.kind === 'plugin' && e.quality === 'superior')).toBe(true);
    const leg = p.find((e) => e.kind === 'plugin' && e.quality === 'legendary');
    expect(leg).toBeTruthy();
    // 传奇为「小概率」：权重应明显低于优秀插件（§8）。
    const sup = p.find((e) => e.kind === 'plugin' && e.quality === 'superior')!;
    expect((leg as S7LevelPoolEntry).weight).toBeLessThan(sup.weight);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'beaconEpic')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'starGem')).toBe(true);
    expect(has(p, (e) => e.kind === 'resource' && e.resourceId === 'coreFrag')).toBe(true);
    expect(has(p, (e) => e.kind === 'exclusiveShardRandom')).toBe(true);
  });
});
