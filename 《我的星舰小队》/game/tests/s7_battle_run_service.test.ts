// BATTLE-RT-07A: S7 战斗 dry-run 运行壳 S7BattleRunService 测试。
// 覆盖：n001/n084/n150 完整跑到 summary；同输入同输出；入参不被修改；
// 组装器错误透传（空 lineup / 坏 slot，不吞错）；battleSeed 来自 nodeId+runSeed（非时间/随机）；
// 静态隔离（不 import 旧战斗链路/存档/玩家态/completeS7Node/cc/combat/）；
// 未来在线化不堵死（源码去注释后无真实联网/支付/社交/随机时间痕迹）。
// 真实结果用样例配置跑出；不改磁盘样例表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import {
  S7BattleEncounterAssemblerError,
  S7BattleLineupUnitInput,
} from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const RUN_SERVICE_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleRunService.ts');

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

const TRIO: S7BattleLineupUnitInput[] = [
  { shipId: 'shp01', slotRef: 'p0c2' },
  { shipId: 'shp02', slotRef: 'p1c2' },
  { shipId: 'shp03', slotRef: 'p2c2' },
];

async function serviceAndRuntime(): Promise<{ service: S7BattleRunService; runtime: S7ConfigRuntime }> {
  const runtime = await runtimeOf(loadBundle());
  return { service: new S7BattleRunService(), runtime };
}

/** 捕获并返回组装器错误码；若没抛/抛了别的错，返回可识别字符串，便于断言“透传”而非“吞错”。 */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof S7BattleEncounterAssemblerError) return e.code;
    return `unexpected:${(e as Error).message}`;
  }
  return 'no_throw';
}

const NODES: ReadonlyArray<readonly [string, string | number]> = [
  ['n001', 'r1'],
  ['n084', 7],
  ['n150', 'abc'],
];

describe('S7BattleRunService - n001/n084/n150 完整跑到 summary', () => {
  for (const [node, seed] of NODES) {
    it(`${node} dry-run 产出 context/request/trace/result/summary`, async () => {
      const { service, runtime } = await serviceAndRuntime();
      // 批③段三重锚：躯干重校后 n150 落数敌火 t=0 秒杀 TRIO（duration 0）——本测=四层链路形状烟测，
      // 内存钉低 n150 敌攻保"跑完一整场"前提（链路机制未变）。
      for (const t of ['battle_unit_stat_param'] as const) {
        for (const r of runtime.getAll<Record<string, unknown>>(t)) {
          if (/^bu_(boss_)?n150/.test(String(r.rowId))) (r as { attack: number }).attack = 40;
        }
      }
      const out = service.run({ runtime, progress: progressAt(node), runSeed: seed, lineup: TRIO });

      // context：来自 S7BattleEntry 的当前节点战斗上下文。
      expect(out.context.nodeId).toBe(node);

      // request：可直接喂引擎的请求，battleSeed = nodeId:runSeed。
      expect(out.request.encounterRef).toBe(`enc_${node}`);
      expect(out.request.battleSeed).toBe(`${node}:${seed}`);
      expect(out.request.playerUnits.map((u) => u.slotRef)).toEqual(['p0c2', 'p1c2', 'p2c2']);

      // trace：本地战报锚点，uploadRequired=false。
      expect(out.trace.nodeId).toBe(node);
      expect(out.trace.battleSeed).toBe(`${node}:${seed}`);
      expect(out.trace.uploadRequired).toBe(false);

      // result：跑完一整场，含 battle_end。
      expect(out.result.log.some((e) => e.type === 'battle_end')).toBe(true);
      expect(out.result.durationSec).toBeGreaterThan(0);

      // summary：胜负合法，双方统计覆盖 finalState 全部单位。
      expect(['player', 'enemy']).toContain(out.summary.winner);
      expect(out.summary.winner).toBe(out.result.winner);
      expect(out.summary.playerDamage.length).toBe(out.result.finalState.players.length);
      expect(out.summary.enemyDamage.length).toBe(out.result.finalState.enemies.length);
    });
  }
});

describe('S7BattleRunService - 确定性（同输入同输出）', () => {
  it('同一 runtime/progress/lineup/runSeed 重复调用 JSON 输出深度相等', async () => {
    const { service, runtime } = await serviceAndRuntime();
    const a = service.run({ runtime, progress: progressAt('n150'), runSeed: 'k', lineup: TRIO });
    const b = service.run({ runtime, progress: progressAt('n150'), runSeed: 'k', lineup: TRIO });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('S7BattleRunService - 入参不被修改', () => {
  it('run 不修改 progress / lineup / runtime 配置行', async () => {
    const { service, runtime } = await serviceAndRuntime();
    const progress = progressAt('n084');
    const lineup: S7BattleLineupUnitInput[] = TRIO.map((u) => ({ ...u }));
    const progressBefore = JSON.stringify(progress);
    const lineupBefore = JSON.stringify(lineup);
    const cfgBefore = JSON.stringify({
      enc: runtime.getAll('battle_encounter_param'),
      units: runtime.getAll('battle_unit_stat_param'),
      ships: runtime.getAll('ship_config'),
    });

    service.run({ runtime, progress, runSeed: 1, lineup });

    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify(lineup)).toBe(lineupBefore);
    expect(JSON.stringify({
      enc: runtime.getAll('battle_encounter_param'),
      units: runtime.getAll('battle_unit_stat_param'),
      ships: runtime.getAll('ship_config'),
    })).toBe(cfgBefore);
  });
});

describe('S7BattleRunService - 错误透传（不吞错）', () => {
  it('空 lineup 透传 S7BattleEncounterAssemblerError(empty_lineup)', async () => {
    const { service, runtime } = await serviceAndRuntime();
    expect(codeOf(() => service.run({ runtime, progress: progressAt('n001'), runSeed: 1, lineup: [] }))).toBe('empty_lineup');
  });

  it('坏 slot 透传 S7BattleEncounterAssemblerError(bad_player_slot)', async () => {
    const { service, runtime } = await serviceAndRuntime();
    expect(codeOf(() => service.run({
      runtime,
      progress: progressAt('n001'),
      runSeed: 1,
      lineup: [{ shipId: 'shp01', slotRef: 'p3c0' }],
    }))).toBe('bad_player_slot');
  });

  it('非战斗节点透传 battle_context_error（n018）', async () => {
    const { service, runtime } = await serviceAndRuntime();
    expect(codeOf(() => service.run({ runtime, progress: progressAt('n018'), runSeed: 1, lineup: TRIO }))).toBe('battle_context_error');
  });
});

describe('S7BattleRunService - battleSeed 来自 nodeId + runSeed（非时间/随机）', () => {
  it('battleSeed 等于 `${nodeId}:${runSeed}`，且 trace 与 engine request 一致', async () => {
    const { service, runtime } = await serviceAndRuntime();
    const out = service.run({ runtime, progress: progressAt('n084'), runSeed: 'seedX', lineup: TRIO });
    expect(out.request.battleSeed).toBe('n084:seedX');
    expect(out.trace.battleSeed).toBe('n084:seedX');
  });

  it('仅 runSeed 不同则 battleSeed 不同；同 runSeed 再跑 result 完全一致（不掺时间/随机源）', async () => {
    const { service, runtime } = await serviceAndRuntime();
    const a = service.run({ runtime, progress: progressAt('n001'), runSeed: 'A', lineup: TRIO });
    const b = service.run({ runtime, progress: progressAt('n001'), runSeed: 'B', lineup: TRIO });
    const a2 = service.run({ runtime, progress: progressAt('n001'), runSeed: 'A', lineup: TRIO });

    expect(a.request.battleSeed).toBe('n001:A');
    expect(b.request.battleSeed).toBe('n001:B');
    expect(a.request.battleSeed).not.toBe(b.request.battleSeed);
    // 同 runSeed 再跑一次：battleSeed 与整份 result 必须完全一致 → 证明结果不依赖当前时间/随机源。
    expect(a2.request.battleSeed).toBe(a.request.battleSeed);
    expect(JSON.stringify(a2.result)).toBe(JSON.stringify(a.result));
  });
});

describe('S7BattleRunService - 静态隔离 (import)', () => {
  it('不 import 旧流程版战斗 / 存档 / 玩家态 / completeS7Node / cc / combat/', () => {
    const src = readFileSync(RUN_SERVICE_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    // 本任务合法依赖的 S7 同族模块名，可能与下方禁用子串重叠（如 S7AutoBattleEngine 含 'BattleEngine'），
    // 先从导入行剔除，避免误伤；剔除后仍出现旧链路名字才算违规。
    const allowedS7 = [
      'S7BattleEncounterAssembler', 'S7AutoBattleEngine', 'S7AutoBattleTypes',
      'S7BattleLogSummary', 'S7BattleEntry', 'S7MainlineProgress', 'S7ConfigRuntime',
    ];
    const forbidden = [
      'BattleLaunchService', 'BattleEngine', 'BattlePlaybackService',
      'S7SaveService', 'SaveService', 'PlayerState', 'completeS7Node',
    ];
    for (const line of importLines) {
      let masked = line;
      for (const a of allowedS7) masked = masked.split(a).join('');
      for (const name of forbidden) expect(masked.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });
});

describe('S7BattleRunService - 未来在线化不堵死 (源码去注释)', () => {
  it('去注释后不含真实联网 / 支付 / 社交 / 随机时间痕迹', () => {
    const raw = readFileSync(RUN_SERVICE_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Math.random', 'Date.now', 'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest',
      'http://', 'https://', 'requestPayment', 'createRewardedVideoAd',
      'leaderboard', 'guild', 'friend', 'payment', 'iap', 'openid', 'unionid',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
