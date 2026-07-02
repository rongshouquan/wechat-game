// CC-07D: S7 战斗入口上下文层测试。
// 覆盖：current-node context（n001 normal / n084·n150 boss / 一个 elite）、守卫（unknown/out_of_order/
// not_battle_node）、boss 不叠加 template_modifier 且 n150 pressureMax=14500、构建不改 progress、
// 以及静态隔离（不 import 流程版战斗/流程引擎模块）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7BattleEntry } from '../assets/scripts/core/s7/S7BattleEntry';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7ConfigRuntime, S7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

const fsReader: S7TableReader = async (t: S7ConfigTableName) =>
  JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];

async function buildEntry(): Promise<S7BattleEntry> {
  const rt = await S7ConfigRuntime.load(fsReader);
  return S7BattleEntry.fromRuntime(rt);
}

/** 把 progress 的 currentNodeId 指向目标节点（只有当前节点可进入）。 */
function progressAt(nodeId: string, cleared: string[] = []): S7MainlineProgressState {
  return { currentNodeId: nodeId, clearedNodeIds: cleared };
}

describe('s7 battle entry - current node context', () => {
  it('resolves n001 as a normal t01/swarm/sf01 context', async () => {
    const entry = await buildEntry();
    const res = entry.resolveCurrentContext(progressAt('n001'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const c = res.context;
    expect(c.nodeId).toBe('n001');
    expect(c.stageType).toBe('normal');
    expect(c.templateId).toBe('t01');
    expect(c.mainProblemTag).toBe('swarm');
    expect(c.starfieldId).toBe('sf01');
    expect(c.secondaryPressure).toBeNull();
    expect(c.boss).toBeNull();
    expect(c.pressure.scope).toBe('normal');
    expect(c.pressure.pressureRefKey).toBe('sf01');
    expect(c.pressure.min).toBe(200);
    expect(c.pressure.max).toBe(1200);
    expect(c.pressure.recommend).toBeNull();
    expect(c.pressure.secondaryPressureCap).toBe(1);
    expect(typeof c.pressure.templateModifier).toBe('number'); // 非 boss 有参考系数
    expect(c.preview.previewId).toBe('pv_t01');
    expect(c.rewardAnchorRef).toBe('reward_mainline_basic');
    expect(c.noAdCheckTag).toBe('none');
  });

  it('resolves an elite node with elite-scope pressure and secondaryTagCap=1', async () => {
    const entry = await buildEntry();
    const res = entry.resolveContext(progressAt('n006'), 'n006');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const c = res.context;
    expect(c.stageType).toBe('elite');
    expect(c.pressure.scope).toBe('elite');
    expect(c.pressure.pressureRefKey).toBe('sf01');
    expect(c.pressure.min).toBe(900);
    expect(c.pressure.max).toBe(1500);
    expect(c.pressure.recommend).toBeNull();
    expect(c.pressure.secondaryPressureCap).toBe(1);
  });

  it('resolves n084 as a boss context (boss view + boss-scope pressure, no template_modifier)', async () => {
    const entry = await buildEntry();
    const res = entry.resolveCurrentContext(progressAt('n084'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const c = res.context;
    expect(c.stageType).toBe('boss');
    expect(c.boss).not.toBeNull();
    expect(c.boss?.bossNodeId).toBe('n084');
    expect(c.boss?.mainProblemTag).toBe('shield');
    expect(c.templateId).toBe('t04');
    expect(c.secondaryPressure).toBe('swarm_low');
    expect(c.pressure.scope).toBe('boss');
    expect(c.pressure.pressureRefKey).toBe('n084');
    expect(c.pressure.recommend).toBe(1500);
    expect(c.pressure.templateModifier).toBeNull(); // boss 不叠加 template_modifier
  });

  it('resolves n150 as boss with pressureMax capped at 14500 and no modifier stacking', async () => {
    const entry = await buildEntry();
    const res = entry.resolveCurrentContext(progressAt('n150'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const c = res.context;
    expect(c.stageType).toBe('boss');
    expect(c.templateId).toBe('t10');
    expect(c.mainProblemTag).toBe('berserk');
    expect(c.pressure.min).toBe(12500);
    expect(c.pressure.max).toBe(14500); // 上限保持 14500，不上探
    expect(c.pressure.recommend).toBe(13600);
    expect(c.pressure.templateModifier).toBeNull();
    expect(c.noAdCheckTag).toBe('no_ad_boss6_check');
  });
});

describe('s7 battle entry - guards', () => {
  it('returns not_battle_node for n018 (templateRef none)', async () => {
    const entry = await buildEntry();
    const res = entry.resolveCurrentContext(progressAt('n018'));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('not_battle_node');
    expect(res.nodeId).toBe('n018');
  });

  it('returns not_battle_node for n019 (protection notice)', async () => {
    const entry = await buildEntry();
    const res = entry.resolveCurrentContext(progressAt('n019'));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('not_battle_node');
  });

  it('returns out_of_order for a non-current node', async () => {
    const entry = await buildEntry();
    const res = entry.resolveContext(progressAt('n001'), 'n002');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('out_of_order');
    expect(res.nodeId).toBe('n002');
    // 即便目标是合法 boss 节点，只要不是当前节点也不放行。
    const res2 = entry.resolveContext(progressAt('n001'), 'n084');
    expect(res2.ok).toBe(false);
    if (res2.ok) return;
    expect(res2.error).toBe('out_of_order');
  });

  it('returns unknown_node for an id absent from the route', async () => {
    const entry = await buildEntry();
    const res = entry.resolveContext(progressAt('n001'), 'n999');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('unknown_node');
  });
});

describe('s7 battle entry - no side effects', () => {
  it('does not mutate the progress state when building a context', async () => {
    const entry = await buildEntry();
    const progress = progressAt('n001', []);
    const before = JSON.stringify(progress);
    entry.resolveCurrentContext(progress);
    expect(JSON.stringify(progress)).toBe(before);
    expect(progress.currentNodeId).toBe('n001');
    expect(progress.clearedNodeIds).toEqual([]);
  });
});

describe('s7 battle entry - flow/engine isolation (static)', () => {
  it('does not import 流程版 battle/flow modules or cc', () => {
    const src = readFileSync(
      path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleEntry.ts'),
      'utf-8',
    );
    const forbidden = [
      'BattleEngine',
      'BattleLaunchService',
      'LevelProgression',
      'PlayerState',
      'HeroStatGrowthService',
      'BattleUnit',
    ];
    for (const name of forbidden) {
      // 仅检查 import 语句行，避免误伤注释/文档里的名字提及。
      const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
      for (const line of importLines) expect(line.includes(name)).toBe(false);
    }
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    for (const line of importLines) expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
  });
});
