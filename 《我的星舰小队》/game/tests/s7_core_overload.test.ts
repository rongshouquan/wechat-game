// 块3：星核运行时 + 新手核「过载核心」集成测试。
// 装上过载核心 → 普攻变「原子炮」：开局即放、AoE 多目标、普攻间隔变 10s；带对照(不装核=普通单体普攻)防假过。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleResult, S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { coreBlocks, S7_CORE_OVERLOAD_ID } from '../assets/scripts/core/s7/S7CoreEffects';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
function clone(b: Bundle): Bundle {
  return JSON.parse(JSON.stringify(b)) as Bundle;
}
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`缺 ${table}.${rowId}`);
  return r;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}
// 隔离用：去掉枪手自带大招/星核钩子，使其唯一主动行为就是普攻，便于纯测「普攻质变」。
function makeBundle(): Bundle {
  const b = clone(loadBundle());
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', attackRangeCells: 7, maxHp: 1000000, armor: 500,
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 1000000, attack: 1 }); // 高血存活，便于观察 10s 间隔
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm'], spawnPlanRefs: ['spawn_n001_w1'] });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 4, slotRefs: ['r0c0', 'r0c1', 'r0c2', 'r0c3'], spawnDelaySec: 0, maxConcurrentOnField: 4 });
  return b;
}
function playerAttacks(r: S7AutoBattleResult): S7AutoBattleLogEntry[] {
  return r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p0c2');
}

describe('块3 过载核心：普攻变原子炮', () => {
  it('装过载核心 → 普攻=原子炮、开局即放、AoE 多目标、间隔 10s', async () => {
    const r = (await engineOf(makeBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'oc',
      playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: [...coreBlocks(S7_CORE_OVERLOAD_ID)] }],
    });
    const atks = playerAttacks(r);
    expect(atks.length).toBeGreaterThanOrEqual(1);
    expect(atks.every((e) => e.effectRef === 'eff_atomic_cannon')).toBe(true); // 普攻已质变为原子炮
    expect(atks[0].timeSec).toBe(0); // 开局即放
    expect((atks[0].targetIds ?? []).length).toBeGreaterThanOrEqual(2); // AoE：一炮多目标
    expect(atks.filter((e) => e.timeSec > 0 && e.timeSec < 10).length).toBe(0); // 0~10s 内不再普攻
    expect(atks.some((e) => Math.abs((e.timeSec ?? 0) - 10) < 1e-6)).toBe(true); // 第二发在 t=10 → 间隔 10s
  });

  it('对照：不装核 → 普通单体普攻、间隔约 1s（防假过）', async () => {
    const r = (await engineOf(makeBundle())).run({
      encounterRef: 'enc_n001', battleSeed: 'oc',
      playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    const atks = playerAttacks(r);
    expect(atks.every((e) => e.effectRef === 'eff_basic_attack')).toBe(true); // 仍是普通普攻
    expect((atks[0].targetIds ?? []).length).toBe(1); // 单体
    expect(atks.filter((e) => e.timeSec > 0 && e.timeSec < 10).length).toBeGreaterThanOrEqual(3); // 间隔约1s→0~10s内多次普攻
  });
});
