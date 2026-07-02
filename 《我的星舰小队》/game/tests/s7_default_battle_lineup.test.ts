// BATTLE-RT-07B-1: S7 默认 dry-run 阵容 helper S7DefaultBattleLineup 测试。
// 覆盖：冻结口径 shipId 顺序 shp01/shp02/shp03、slotRef 顺序 p0c2/p1c2/p2c2；
// createS7DefaultDryRunLineup 返回 fresh copy（改返回值不污染常量/下一次调用）；
// 该阵容可被 S7BattleEncounterAssembler 映射（p0c2->bu_ship_vanguard / p1c2->bu_ship_gunner / p2c2->bu_ship_guardian）；
// 可经 S7BattleRunService 跑 n001/n084/n150 到 summary；静态隔离与未来在线化不堵死。
// 真实链路用样例配置跑出；不改磁盘样例表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7BattleEncounterAssembler } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import {
  S7_DEFAULT_DRY_RUN_LINEUP,
  createS7DefaultDryRunLineup,
} from '../assets/scripts/core/s7/S7DefaultBattleLineup';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const LINEUP_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7DefaultBattleLineup.ts');

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

const EXPECTED = [
  { shipId: 'shp01', slotRef: 'p0c2' },
  { shipId: 'shp02', slotRef: 'p1c2' },
  { shipId: 'shp03', slotRef: 'p2c2' },
];

const NODES: ReadonlyArray<readonly [string, string | number]> = [
  ['n001', 'r1'],
  ['n084', 7],
  ['n150', 'abc'],
];

describe('S7DefaultBattleLineup - 冻结口径', () => {
  it('常量 shipId 顺序为 shp01/shp02/shp03', () => {
    expect(S7_DEFAULT_DRY_RUN_LINEUP.map((u) => u.shipId)).toEqual(['shp01', 'shp02', 'shp03']);
  });

  it('常量 slotRef 顺序为 p0c2/p1c2/p2c2', () => {
    expect(S7_DEFAULT_DRY_RUN_LINEUP.map((u) => u.slotRef)).toEqual(['p0c2', 'p1c2', 'p2c2']);
  });

  it('常量整体严格等于冻结的三舰阵容', () => {
    expect(S7_DEFAULT_DRY_RUN_LINEUP.map((u) => ({ ...u }))).toEqual(EXPECTED);
  });

  it('createS7DefaultDryRunLineup 顺序与口径一致', () => {
    const lineup = createS7DefaultDryRunLineup();
    expect(lineup.map((u) => u.shipId)).toEqual(['shp01', 'shp02', 'shp03']);
    expect(lineup.map((u) => u.slotRef)).toEqual(['p0c2', 'p1c2', 'p2c2']);
    expect(lineup).toEqual(EXPECTED);
  });
});

describe('S7DefaultBattleLineup - fresh copy（不污染下一次调用）', () => {
  it('修改返回数组/元素不影响后续调用，也不污染冻结常量', () => {
    const a = createS7DefaultDryRunLineup();
    a.push({ shipId: 'shpX', slotRef: 'p0c0' }); // 改数组结构
    a[0].shipId = 'tampered'; // 改元素字段
    a[1].slotRef = 'p2c2';

    const b = createS7DefaultDryRunLineup();
    expect(b).toEqual(EXPECTED); // 下一次调用仍是干净口径
    expect(S7_DEFAULT_DRY_RUN_LINEUP.map((u) => ({ ...u }))).toEqual(EXPECTED); // 常量未被污染
  });

  it('两次调用返回不同的数组与元素引用，且与常量元素不同引用', () => {
    const a = createS7DefaultDryRunLineup();
    const b = createS7DefaultDryRunLineup();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]).not.toBe(S7_DEFAULT_DRY_RUN_LINEUP[0]);
  });
});

describe('S7DefaultBattleLineup - 可被 S7BattleEncounterAssembler 接收并映射', () => {
  it('p0c2->bu_ship_vanguard / p1c2->bu_ship_gunner / p2c2->bu_ship_guardian', async () => {
    const rt = await runtimeOf(loadBundle());
    const asm = new S7BattleEncounterAssembler(rt);
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'r1', lineup: createS7DefaultDryRunLineup() });
    const bySlot = new Map(out.request.playerUnits.map((u) => [u.slotRef, u.unitStatRef]));
    expect(bySlot.get('p0c2')).toBe('bu_ship_vanguard');
    expect(bySlot.get('p1c2')).toBe('bu_ship_gunner');
    expect(bySlot.get('p2c2')).toBe('bu_ship_guardian');
  });
});

describe('S7DefaultBattleLineup - 可经 S7BattleRunService 跑到 summary', () => {
  for (const [node, seed] of NODES) {
    it(`${node} 用默认阵容 dry-run 跑到 summary`, async () => {
      const rt = await runtimeOf(loadBundle());
      const out = new S7BattleRunService().run({
        runtime: rt,
        progress: progressAt(node),
        runSeed: seed,
        lineup: createS7DefaultDryRunLineup(),
      });
      expect(out.context.nodeId).toBe(node);
      expect(out.request.encounterRef).toBe(`enc_${node}`);
      expect(out.request.battleSeed).toBe(`${node}:${seed}`);
      expect(out.result.log.some((e) => e.type === 'battle_end')).toBe(true);
      expect(['player', 'enemy']).toContain(out.summary.winner);
    });
  }
});

describe('S7DefaultBattleLineup - 静态隔离与未来在线化不堵死', () => {
  it('不 import 旧阵容 / 存档 / 玩家态 / 旧战斗 / completeS7Node / cc / combat/', () => {
    const src = readFileSync(LINEUP_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'PlayerState', 'Formation', 'SaveService', 'S7SaveService',
      'BattleLaunchService', 'BattleEngine', 'BattlePlaybackService', 'completeS7Node',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });

  it('源码去注释后不含真实联网 / 支付 / 社交 / 随机时间痕迹', () => {
    const raw = readFileSync(LINEUP_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Math.random', 'Date.now', 'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest',
      'http://', 'https://', 'requestPayment', 'createRewardedVideoAd',
      'leaderboard', 'guild', 'friend', 'payment', 'iap', 'openid', 'unionid',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
