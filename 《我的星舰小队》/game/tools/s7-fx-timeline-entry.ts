// 战斗演出线 · 时间轴导出（TS 入口·由 export-s7-fx-timeline.mjs 用 esbuild 打包驱动）。
// 职责：跑一场**真链路**战斗（组装器→引擎·与战斗尺同链），把回放帧铺成演出指令流
//   （S7FxScript），连同花名册摘要写成 JSON——喂给 fx-preview 预览壳（HTML+Canvas）
//   与后续 Cocos 特效层，"能动的完整战斗界面"的演出数据源。
// 零回写：只写 tools/fx-preview/timeline-sample.json 一个产物文件；不动配置/存档。
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadBundle, loadMilestones, loadPressure, genLineupCustom, mapPressureToEnemies } from './s7-battles-entry';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7BattleUnitStatParam } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { S7_HARD_CONTROL_DIMINISH } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { buildS7BattlePlayback } from '../assets/scripts/core/s7/S7BattlePlayback';
import { buildS7FxScript } from '../assets/scripts/core/s7/fx/S7FxScript';

const GAME_ROOT = process.env.S7_GAME_ROOT ?? process.cwd();

/** 签名试作五舰（每族一艘·Ron 已拍舰单）。 */
const SIGNATURE_SHIPS = ['shp03', 'shp06', 'shp09', 'shp13', 'shp20'];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function main(argv: string[]): Promise<number> {
  const arg = (name: string, dflt: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  const nodeId = arg('node', 'n020');
  const seed = arg('seed', 'fx-preview-1');

  const bundle = clone(loadBundle());
  const num = Number(nodeId.slice(1));
  const pressure = loadPressure()[num];
  let arrivalPower: number | undefined;
  try {
    arrivalPower = loadMilestones().get(nodeId)?.power;
  } catch {
    arrivalPower = undefined; // 快照缺失时退压力值组队（演出验证不挑数值精度）
  }
  const targetPower = arrivalPower ?? pressure;

  // 敌配按压力值内存缩放（与战斗尺同口径·让胜负与时长看着像真实局）。
  const scale = mapPressureToEnemies(bundle, nodeId, pressure);
  const unitRows = bundle.battle_unit_stat_param as unknown as Record<string, unknown>[];
  for (const [rowId, attrs] of Object.entries(scale.units)) {
    const r = unitRows.find((x) => x.rowId === rowId);
    if (r) Object.assign(r, attrs);
  }

  const { lineup, teamPower } = genLineupCustom({ ships: SIGNATURE_SHIPS, targetTeamPower: targetPower });
  const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(bundle));
  const service = new S7BattleRunService();
  const r = service.run({
    runtime,
    progress: { currentNodeId: nodeId, clearedNodeIds: [] },
    runSeed: seed,
    lineup,
    hardControlDiminish: S7_HARD_CONTROL_DIMINISH,
  });

  const playback = buildS7BattlePlayback(r.result);

  // unitStatRef → { unitRef, roleTag }（演出查表键；敌方行 unitRef 缺省空串走族弹兜底）。
  const statRows = bundle.battle_unit_stat_param as unknown as S7BattleUnitStatParam[];
  const refMap = new Map<string, { unitRef: string; roleTag: string }>();
  for (const row of statRows) {
    refMap.set(row.rowId, {
      unitRef: typeof (row as { unitRef?: unknown }).unitRef === 'string' ? (row as { unitRef: string }).unitRef : '',
      roleTag: typeof (row as { roleTag?: unknown }).roleTag === 'string' ? (row as { roleTag: string }).roleTag : '',
    });
  }
  const timeline = buildS7FxScript(playback, (ref) => refMap.get(ref) ?? { unitRef: '', roleTag: '' });

  const rosterOut = playback.roster.map((u) => ({
    unitId: u.unitId,
    side: u.side,
    unitRef: refMap.get(u.unitStatRef)?.unitRef ?? '',
    roleTag: refMap.get(u.unitStatRef)?.roleTag ?? '',
    maxHp: u.maxHp,
  }));

  const outDir = path.resolve(GAME_ROOT, 'tools', 'fx-preview');
  mkdirSync(outDir, { recursive: true });
  const payload = {
    nodeId,
    seed,
    teamPower: Math.round(teamPower),
    winner: playback.winner,
    reason: playback.reason,
    durationSec: playback.durationSec,
    roster: rosterOut,
    layout: timeline.layout,
    fxDurationSec: timeline.durationSec,
    commands: timeline.commands,
  };
  const outFile = path.join(outDir, 'timeline-sample.json');
  writeFileSync(outFile, JSON.stringify(payload, null, 1), 'utf-8');
  // .js 副本：预览壳双击 file:// 打开时 fetch 不可用，走 <script> 全局变量。
  writeFileSync(path.join(outDir, 'timeline-sample.js'), `window.S7_FX_TIMELINE = ${JSON.stringify(payload)};`, 'utf-8');
  console.log(
    `[fx-timeline] ${nodeId} seed=${seed} winner=${playback.winner} dur=${playback.durationSec}s ` +
      `cmds=${timeline.commands.length} roster=${rosterOut.length} -> ${outFile}`
  );
  return 0;
}
