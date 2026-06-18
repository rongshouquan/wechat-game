// BATTLE-RT-07E-2-1: S7BattleInputRunRequestAdapter 测试。
// 覆盖：合法快照 + 节点一致 -> ok:true；runtime/progress 原引用；runSeed 透传；lineup 新数组含 {shipId,slotRef,coreId}（块3 透传 coreId）；
// 驾驶员/插件/等级/强化不进入 request；返回 request 可经 S7BattleRunService 跑通 n001（battleSeed=n001:<runSeed>）；
// 非法快照 -> invalid_snapshot（保留 validation，不抛错）；节点不一致 -> node_progress_mismatch；
// adapter 不修改 snapshot/progress；shp04（无 battle_unit_stat_param）可生成 request、由既有 assembler 抛 missing_ship_battle_unit；
// 源码静态隔离与未来在线化不堵死。真实链路用样例配置加载 runtime；不改磁盘样例表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7BattleInputSnapshot } from '../assets/scripts/core/s7/S7BattleInputSnapshot';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { S7BattleEncounterAssemblerError } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { buildS7BattleRunRequestFromInputSnapshot } from '../assets/scripts/core/s7/S7BattleInputRunRequestAdapter';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const ADAPTER_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleInputRunRequestAdapter.ts');

type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));
const progressAt = (nodeId: string): S7MainlineProgressState => ({ currentNodeId: nodeId, clearedNodeIds: [] });

/** n001 的三舰快照（仅 shipId+slotRef，引用一致；runtime 校验只需 ship 存在）。 */
function n001Snapshot(over: Partial<S7BattleInputSnapshot> = {}): S7BattleInputSnapshot {
  return {
    snapshotId: 'snap-n001',
    nodeId: 'n001',
    battleAttemptId: 'attempt-1',
    runIndex: 0,
    lineupRevision: 'rev-1',
    runSeed: 'r1',
    ownedShips: ['shp01', 'shp02', 'shp03'],
    ownedPilots: [],
    ownedPlugins: [],
    ownedCores: [],
    units: [
      { shipId: 'shp01', slotRef: 'p0c2' },
      { shipId: 'shp02', slotRef: 'p1c2' },
      { shipId: 'shp03', slotRef: 'p2c2' },
    ],
    ...over,
  };
}

describe('S7BattleInputRunRequestAdapter - 合法投影', () => {
  it('合法快照 + 节点一致 -> ok:true，runtime/progress 为原引用，runSeed 透传', async () => {
    const runtime = await runtimeOf(loadBundle());
    const progress = progressAt('n001');
    const snapshot = n001Snapshot({ runSeed: 'seed-xyz' });

    const res = buildS7BattleRunRequestFromInputSnapshot({ runtime, progress, snapshot });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.request.runtime).toBe(runtime); // 原引用
    expect(res.request.progress).toBe(progress); // 原引用
    expect(res.request.runSeed).toBe('seed-xyz');
    expect(res.request.lineup).toEqual([
      { shipId: 'shp01', slotRef: 'p0c2' },
      { shipId: 'shp02', slotRef: 'p1c2' },
      { shipId: 'shp03', slotRef: 'p2c2' },
    ]);
    // lineup 是新数组，不是 snapshot.units 本身。
    expect(res.request.lineup as unknown).not.toBe(snapshot.units);
  });

  it('coreId 透传进 lineup（块3 装备路径）；驾驶员/插件/等级/强化仍只经校验、不进 lineup', async () => {
    const runtime = await runtimeOf(loadBundle());
    const pilotId = (runtime.getAll('pilot_config')[0] as { pilotId: string }).pilotId;
    const coreId = (runtime.getAll('core_config')[0] as { coreId: string }).coreId;
    const pluginId = (runtime.getAll('plugin_config')[0] as { pluginId: string }).pluginId;
    const snapshot = n001Snapshot({
      ownedShips: ['shp01'],
      ownedPilots: [pilotId],
      ownedCores: [coreId],
      ownedPlugins: [pluginId],
      units: [
        {
          shipId: 'shp01',
          slotRef: 'p0c2',
          pilotId,
          coreId,
          pluginIds: [pluginId],
          shipLevel: 10,
          pilotLevel: 8,
          coreEnhance: 2,
        },
      ],
    });
    const res = buildS7BattleRunRequestFromInputSnapshot({ runtime, progress: progressAt('n001'), snapshot });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.request.lineup).toEqual([{ shipId: 'shp01', slotRef: 'p0c2', coreId }]); // 块3：coreId 透传
    expect(Object.keys(res.request.lineup[0]).sort()).toEqual(['coreId', 'shipId', 'slotRef']); // 仅此三项；pilot/plugin/等级/强化不进
  });

  it('返回的 request 可经 S7BattleRunService 跑通 n001，battleSeed = n001:<runSeed>', async () => {
    const runtime = await runtimeOf(loadBundle());
    const res = buildS7BattleRunRequestFromInputSnapshot({
      runtime,
      progress: progressAt('n001'),
      snapshot: n001Snapshot({ runSeed: 'r1' }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const out = new S7BattleRunService().run(res.request);
    expect(out.request.battleSeed).toBe('n001:r1');
    expect(out.result.log.some((e) => e.type === 'battle_end')).toBe(true);
    expect(['player', 'enemy']).toContain(out.summary.winner);
  });
});

describe('S7BattleInputRunRequestAdapter - 失败分支', () => {
  it('非法快照（空 runSeed）-> invalid_snapshot，保留 validation，不抛错', async () => {
    const runtime = await runtimeOf(loadBundle());
    const res = buildS7BattleRunRequestFromInputSnapshot({
      runtime,
      progress: progressAt('n001'),
      snapshot: n001Snapshot({ runSeed: '' }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('invalid_snapshot');
    if (res.code !== 'invalid_snapshot') return;
    expect(res.validation.ok).toBe(false);
    if (!res.validation.ok) {
      expect(res.validation.errors.some((e) => e.code === 'missing_run_seed')).toBe(true);
    }
  });

  it('snapshot.nodeId 与 progress.currentNodeId 不一致 -> node_progress_mismatch', async () => {
    const runtime = await runtimeOf(loadBundle());
    const res = buildS7BattleRunRequestFromInputSnapshot({
      runtime,
      progress: progressAt('n002'),
      snapshot: n001Snapshot(), // nodeId = n001
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('node_progress_mismatch');
    if (res.code !== 'node_progress_mismatch') return;
    expect(res.snapshotNodeId).toBe('n001');
    expect(res.progressNodeId).toBe('n002');
  });

  it('校验失败优先于节点检查（非法快照即便节点也不一致仍返回 invalid_snapshot）', async () => {
    const runtime = await runtimeOf(loadBundle());
    const res = buildS7BattleRunRequestFromInputSnapshot({
      runtime,
      progress: progressAt('n002'),
      snapshot: n001Snapshot({ runSeed: '' }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('invalid_snapshot');
  });
});

describe('S7BattleInputRunRequestAdapter - 无副作用', () => {
  it('adapter 不修改 snapshot / progress', async () => {
    const runtime = await runtimeOf(loadBundle());
    const progress = progressAt('n001');
    const snapshot = n001Snapshot({ runSeed: 'r1' });
    const progressBefore = JSON.stringify(progress);
    const snapshotBefore = JSON.stringify(snapshot);
    buildS7BattleRunRequestFromInputSnapshot({ runtime, progress, snapshot });
    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify(snapshot)).toBe(snapshotBefore);
  });
});

describe('S7BattleInputRunRequestAdapter - adapter 不补战斗数值（shp04）', () => {
  it('shp04 合法快照可生成 request；运行时由既有 assembler 抛 missing_ship_battle_unit', async () => {
    // RT-07E-3-3-1 后 shp04 已有 base stat 行；这里在内存里移除 bu_ship_fireworks_cruiser，
    // 复原“ship_config 有、battle_unit_stat_param 缺 ship 行”的前置，继续验证既有错误路径（adapter 不补数值）。
    const bundle = loadBundle();
    bundle.battle_unit_stat_param = (bundle.battle_unit_stat_param as Array<{ rowId: string }>).filter(
      (r) => r.rowId !== 'bu_ship_fireworks_cruiser',
    );
    const runtime = await runtimeOf(bundle);
    // shp04 仍在 ship_config（快照校验通过），但已移除其 battle_unit_stat_param ship 行。
    const snapshot = n001Snapshot({ ownedShips: ['shp04'], units: [{ shipId: 'shp04', slotRef: 'p0c2' }] });
    const res = buildS7BattleRunRequestFromInputSnapshot({ runtime, progress: progressAt('n001'), snapshot });
    expect(res.ok).toBe(true); // adapter 只投影，不补数值
    if (!res.ok) return;
    let thrown: unknown;
    try {
      new S7BattleRunService().run(res.request);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(S7BattleEncounterAssemblerError);
    expect((thrown as S7BattleEncounterAssemblerError).code).toBe('missing_ship_battle_unit');
  });
});

describe('S7BattleInputRunRequestAdapter - 静态隔离与未来在线化不堵死', () => {
  it('imports 不含 cc / 存档 / 玩家态 / 编队 / UI / 旧战斗引擎 / 主线推进', () => {
    const src = readFileSync(ADAPTER_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'SaveService', 'S7SaveService', 'PlayerState', 'Formation', 'MainSceneController',
      'BattleView', 'VictoryPresenter', 'DefeatPresenter', 'completeS7Node', 'S7AutoBattleEngine',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });

  it('源码去注释后不含联网 / 支付 / 社交 / 生产种子来源痕迹', () => {
    const raw = readFileSync(ADAPTER_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Date.now', 'Math.random', 'openid', 'unionid', 'deviceId',
      'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest', 'http://', 'https://',
      'requestPayment', 'createRewardedVideoAd', 'leaderboard', 'guild', 'friend', 'payment', 'iap',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
