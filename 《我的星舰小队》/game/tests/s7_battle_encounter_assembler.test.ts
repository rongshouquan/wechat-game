// BATTLE-RT-05: S7 专用纯 TS 遇敌组装器 S7BattleEncounterAssembler 测试。
// 覆盖任务包 §8 的 17 点：n001/n084/n150 组装、组装产物直接喂引擎跑出 battle_end、
// shipId->unitStatRef 映射、各类输入/一致性校验、trace 内容、组装无副作用、
// 静态隔离、以及“未来在线化不堵死”静态检查。
// 允许在内存 clone 配置表制造边界用例；不改磁盘样例表。
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
  S7BattleEncounterAssembler,
  S7BattleEncounterAssemblerError,
  S7BattleLineupUnitInput,
} from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const ASSEMBLER_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleEncounterAssembler.ts');

type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const bundle = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return bundle;
}
const cloneBundle = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));
const assemblerOf = async (b: Bundle): Promise<S7BattleEncounterAssembler> => new S7BattleEncounterAssembler(await runtimeOf(b));
const progressAt = (nodeId: string): S7MainlineProgressState => ({ currentNodeId: nodeId, clearedNodeIds: [] });

const TRIO: S7BattleLineupUnitInput[] = [
  { shipId: 'shp01', slotRef: 'p0c2' },
  { shipId: 'shp02', slotRef: 'p1c2' },
  { shipId: 'shp03', slotRef: 'p2c2' },
];

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof S7BattleEncounterAssemblerError) return e.code;
    return `unexpected:${(e as Error).message}`;
  }
  return 'no_throw';
}

describe('S7BattleEncounterAssembler - 装备星核解析为效果积木 (块3b)', () => {
  it('lineup 带 coreId=core07(过载核心) → 该单位 playerUnits 携带原子炮+间隔set积木', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'core', lineup: [{ shipId: 'shp01', slotRef: 'p0c2', coreId: 'core07' }] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true); // 普攻槽换原子炮
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attackIntervalSec' && b.op === 'set')).toBe(true); // 间隔 set 10s
  });

  it('不带 coreId → 该单位无 effectBlocks（对照，防假过）', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'core', lineup: [{ shipId: 'shp01', slotRef: 'p0c2' }] });
    expect(out.request.playerUnits[0].effectBlocks).toBeUndefined();
  });

  it('J：lineup 带 extraBlocks(建筑全队加成) → 并入该单位 effectBlocks', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({
      progress: progressAt('n001'), runSeed: 'team',
      lineup: [{ shipId: 'shp01', slotRef: 'p0c2', extraBlocks: [
        { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 0.1, source: 'building_team_bonus' },
        { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.1, source: 'building_team_bonus' },
      ] }],
    });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.filter((b) => b.kind === 'modifier' && (b as any).source === 'building_team_bonus')).toHaveLength(2);
  });
});

describe('S7BattleEncounterAssembler - n001/n084/n150 组装 (#1,#3,#4)', () => {
  it('n001 + [shp01,shp02,shp03] 组装出 enc_n001 (#1)', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'r1', lineup: TRIO });
    expect(out.request.encounterRef).toBe('enc_n001');
    expect(out.context.nodeId).toBe('n001');
    expect(out.request.battleSeed).toBe('n001:r1');
    expect(out.request.playerUnits.map((u) => u.slotRef)).toEqual(['p0c2', 'p1c2', 'p2c2']);
  });

  it('n084 trio 组装出 enc_n084，context 与 encounter 字段一致 (#3)', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n084'), runSeed: 7, lineup: TRIO });
    expect(out.request.encounterRef).toBe('enc_n084');
    expect(out.context.stageType).toBe('boss');
    expect(out.context.templateId).toBe('t04');
    expect(out.context.mainProblemTag).toBe('shield');
    expect(out.request.battleSeed).toBe('n084:7');
  });

  it('n150 trio 组装出 enc_n150，battleSeed 带 n150: 前缀 (#4)', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n150'), runSeed: 'abc', lineup: TRIO });
    expect(out.request.encounterRef).toBe('enc_n150');
    expect(out.request.battleSeed).toBe('n150:abc');
    expect(out.trace.battleSeed.startsWith('n150:')).toBe(true); // trace.battleSeed 为 string 类型
  });
});

describe('S7BattleEncounterAssembler - 组装产物可直接跑引擎 (#2)', () => {
  it('n001 组装结果交给 S7AutoBattleEngine.run() 跑出 battle_end', async () => {
    const rt = await runtimeOf(loadBundle());
    const asm = new S7BattleEncounterAssembler(rt);
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'engine', lineup: TRIO });
    const engine = new S7AutoBattleEngine(rt);
    const result = engine.run(out.request);
    expect(result.log.some((e) => e.type === 'battle_end')).toBe(true);
    expect(result.winner).toBe('player');
    expect(result.reason).toBe('all_enemies_down');
  });
});

describe('S7BattleEncounterAssembler - shipId -> unitStatRef 映射 (#5)', () => {
  it('shp01->bu_ship_vanguard、shp02->bu_ship_gunner、shp03->bu_ship_guardian', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: TRIO });
    const bySlot = new Map(out.request.playerUnits.map((u) => [u.slotRef, u.unitStatRef]));
    expect(bySlot.get('p0c2')).toBe('bu_ship_vanguard'); // shp01
    expect(bySlot.get('p1c2')).toBe('bu_ship_gunner'); // shp02
    expect(bySlot.get('p2c2')).toBe('bu_ship_guardian'); // shp03
    // 输入用稳定 shipId，引擎请求里只出现映射后的 unitStatRef，不出现 shipId。
    expect(out.request.playerUnits.every((u) => u.unitStatRef.startsWith('bu_ship_'))).toBe(true);
  });
});

describe('S7BattleEncounterAssembler - context / encounter 校验 (#6,#7,#8)', () => {
  it('非战斗节点返回 battle_context_error（n018）(#6)', async () => {
    const asm = await assemblerOf(loadBundle());
    expect(codeOf(() => asm.assemble({ progress: progressAt('n018'), runSeed: 1, lineup: TRIO }))).toBe('battle_context_error');
  });

  it('有 context 但缺 encounter 返回 missing_encounter（人为摘掉 n008 的 encounter 行）(#7)', async () => {
    // 2026-07-02 起 148 个可战斗节点已全部批量生产 encounter（见 第二块-关卡战斗内容生产规范.md），
    // 样例表里不再天然存在"合法节点但缺 encounter"的缺口，改为人为摘掉一行来验证这条错误路径本身。
    const b = cloneBundle(loadBundle());
    b.battle_encounter_param = (b.battle_encounter_param as Row[]).filter((r) => r.nodeRef !== 'n008');
    b.battle_spawn_param = (b.battle_spawn_param as Row[]).filter((r) => r.encounterRef !== 'enc_n008');
    const asm = await assemblerOf(b);
    expect(codeOf(() => asm.assemble({ progress: progressAt('n008'), runSeed: 1, lineup: TRIO }))).toBe('missing_encounter');
  });

  it('篡改 encounter 的 template/problem/secondary 任一字段返回 encounter_context_mismatch (#8)', async () => {
    for (const tamper of [
      (b: Bundle) => { row(b, 'battle_encounter_param', 'enc_n001').templateRef = 't02'; },
      (b: Bundle) => { row(b, 'battle_encounter_param', 'enc_n001').problemTagRef = 'shield'; },
      (b: Bundle) => { row(b, 'battle_encounter_param', 'enc_n001').secondaryPressureTag = 'swarm_low'; },
    ]) {
      const b = cloneBundle(loadBundle());
      tamper(b);
      const asm = await assemblerOf(b);
      expect(codeOf(() => asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: TRIO }))).toBe('encounter_context_mismatch');
    }
    // 注：stageType 由配置校验层强制 == 主线节点派生（validate:configs:s7 会拦截不一致），
    // 故无法在合法 runtime 下单独制造 stage 不一致；组装器仍保留该防御校验。
  });
});

describe('S7BattleEncounterAssembler - 阵容与 shipId 校验 (#9,#10,#11,#12)', () => {
  it('空 / 超 5 / 非法格 / 重复格 分别报错 (#9)', async () => {
    const asm = await assemblerOf(loadBundle());
    const p = progressAt('n001');
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: [] }))).toBe('empty_lineup');
    const six: S7BattleLineupUnitInput[] = ['p0c0', 'p0c1', 'p0c2', 'p1c0', 'p1c1', 'p1c2'].map((s) => ({ shipId: 'shp01', slotRef: s }));
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: six }))).toBe('too_many_units');
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: [{ shipId: 'shp01', slotRef: 'p3c0' }] }))).toBe('bad_player_slot');
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: [{ shipId: 'shp01', slotRef: 'r0c0' }] }))).toBe('bad_player_slot');
    expect(codeOf(() => asm.assemble({ progress: p, runSeed: 1, lineup: [
      { shipId: 'shp01', slotRef: 'p0c0' },
      { shipId: 'shp02', slotRef: 'p0c0' },
    ] }))).toBe('duplicate_player_slot');
  });

  it('未知 shipId 报 unknown_ship (#10)', async () => {
    const asm = await assemblerOf(loadBundle());
    expect(codeOf(() => asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: [{ shipId: 'shp99', slotRef: 'p0c0' }] }))).toBe('unknown_ship');
  });

  it('ship_config 有但 battle_unit_stat_param 缺 ship 行的星舰报 missing_ship_battle_unit（内存移除 shp04 行）(#11)', async () => {
    // RT-07E-3-3-1 后 shp04 已有 base stat 行；此处在内存里移除它，复原“缺战斗行”前置以验证错误路径仍生效。
    const b = cloneBundle(loadBundle());
    b.battle_unit_stat_param = (b.battle_unit_stat_param as Row[]).filter((r) => r.rowId !== 'bu_ship_fireworks_cruiser');
    const asm = await assemblerOf(b);
    expect(codeOf(() => asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: [{ shipId: 'shp04', slotRef: 'p0c0' }] }))).toBe('missing_ship_battle_unit');
  });

  it('shp04..shp12 现各映射到唯一 ship 战斗行 (RT-07E-3-3-1)', async () => {
    const asm = await assemblerOf(loadBundle());
    const expected: Record<string, string> = {
      shp04: 'bu_ship_fireworks_cruiser', shp05: 'bu_ship_static_disruptor', shp06: 'bu_ship_oasis_repair',
      shp07: 'bu_ship_star_ring_charger', shp08: 'bu_ship_sweeper_drone', shp09: 'bu_ship_longwave_suppressor',
      shp10: 'bu_ship_flashrail_reaper', shp11: 'bu_ship_blackshield_escort', shp12: 'bu_ship_oldport_flex',
    };
    for (const [shipId, rowId] of Object.entries(expected)) {
      const out = asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: [{ shipId, slotRef: 'p0c2' }] });
      expect(out.request.playerUnits[0].unitStatRef).toBe(rowId);
    }
  });

  it('一个 shipId 命中多行 battle unit 报 ambiguous_ship_battle_unit（内存 clone）(#12)', async () => {
    const b = cloneBundle(loadBundle());
    const dup = { ...row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), rowId: 'bu_ship_vanguard_dup' };
    (b.battle_unit_stat_param as Row[]).push(dup); // 第二行同样 targetType=ship & unitRef=shp01
    const asm = await assemblerOf(b);
    expect(codeOf(() => asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: [{ shipId: 'shp01', slotRef: 'p0c0' }] }))).toBe('ambiguous_ship_battle_unit');
  });
});

describe('S7BattleEncounterAssembler - 确定性与无副作用 (#13,#14)', () => {
  it('同输入组装两次输出深度相等 (#13)', async () => {
    const asm = await assemblerOf(loadBundle());
    const a = asm.assemble({ progress: progressAt('n150'), runSeed: 'k', lineup: TRIO });
    const b = asm.assemble({ progress: progressAt('n150'), runSeed: 'k', lineup: TRIO });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('组装不修改 progress，也不修改 runtime 配置行 (#14)', async () => {
    const rt = await runtimeOf(loadBundle());
    const asm = new S7BattleEncounterAssembler(rt);
    const progress = progressAt('n084');
    const progressBefore = JSON.stringify(progress);
    const cfgBefore = JSON.stringify({
      enc: rt.getAll('battle_encounter_param'),
      units: rt.getAll('battle_unit_stat_param'),
      ships: rt.getAll('ship_config'),
    });
    asm.assemble({ progress, runSeed: 1, lineup: TRIO });
    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify({
      enc: rt.getAll('battle_encounter_param'),
      units: rt.getAll('battle_unit_stat_param'),
      ships: rt.getAll('ship_config'),
    })).toBe(cfgBefore);
  });
});

describe('S7BattleEncounterAssembler - trace (#15)', () => {
  it('trace 含全部稳定 ID 字段且 uploadRequired=false，且不进入引擎请求', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n084'), runSeed: 'seedX', lineup: TRIO });
    expect(out.trace).toEqual({
      nodeId: 'n084',
      encounterRef: 'enc_n084',
      battleSeed: 'n084:seedX',
      shipIds: ['shp01', 'shp02', 'shp03'],
      slotRefs: ['p0c2', 'p1c2', 'p2c2'],
      battleSeedPolicy: 'node_id_plus_run_seed',
      uploadRequired: false,
    });
    // trace 只本地返回：不混进引擎请求。
    expect(Object.keys(out.request).sort()).toEqual(['battleSeed', 'encounterRef', 'playerUnits']);
    expect('trace' in (out.request as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe('S7BattleEncounterAssembler - 静态隔离 (#16)', () => {
  it('不 import 流程版战斗 / 存档 / 玩家态 / cc', () => {
    const src = readFileSync(ASSEMBLER_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'BattleEngine', 'BattleLaunchService', 'BattlePlaybackService',
      'S7SaveService', 'SaveService', 'PlayerState', 'completeS7Node',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });
});

describe('S7BattleEncounterAssembler - 未来在线化不堵死 (#17)', () => {
  it('源码（去注释后）不含真实联网 / 支付 / 社交 / 随机时间实现痕迹', () => {
    const raw = readFileSync(ASSEMBLER_SRC, 'utf-8');
    // 先去掉块注释与行注释，避免普通中文注释误伤；只检查真实代码里的危险痕迹。
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Math.random', 'Date.now', 'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest',
      'http://', 'https://', 'requestPayment', 'createRewardedVideoAd',
      'leaderboard', 'guild', 'friend', 'payment', 'iap', 'openid', 'unionid',
    ];
    for (const token of forbidden) {
      expect(code.includes(token)).toBe(false);
    }
  });
});
