// 块5：驾驶员运行时（行为AI + 驾驶天赋）。
// 三层验证：① 解析器(pilotBlocks)产出行为积木(后排优先)+天赋占位积木；
//          ② 装配器 lineup.pilotId → effectBlocks + 归属校验 + 与星核/插件并存；
//          ③ 引擎里「装晴岚(pil03)后普攻从打前排改打后排」——用「前排1血/后排海量血」的死亡数对照证明换了目标(带不装对照防假过)。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { pilotBlocks, S7_PILOT_BACKLINE_ID } from '../assets/scripts/core/s7/S7PilotEffects';
import { S7BehaviorBlock, S7ModifierBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';
import {
  S7BattleEncounterAssembler,
  S7BattleEncounterAssemblerError,
} from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';

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
const clone = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`缺 ${table}.${rowId}`);
  return r;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));
const assemblerOf = async (b: Bundle): Promise<S7BattleEncounterAssembler> => new S7BattleEncounterAssembler(await runtimeOf(b));
const progressAt = (nodeId: string): S7MainlineProgressState => ({ currentNodeId: nodeId, clearedNodeIds: [] });
function codeOf(fn: () => unknown): string {
  try { fn(); } catch (e) {
    if (e instanceof S7BattleEncounterAssemblerError) return e.code;
    return `unexpected:${(e as Error).message}`;
  }
  return 'no_throw';
}

describe('块5 解析器 pilotBlocks：行为AI + 驾驶天赋', () => {
  it('晴岚(pil03) → 行为积木(后排优先) + 天赋占位修正', () => {
    const blocks = pilotBlocks(S7_PILOT_BACKLINE_ID);
    const behavior = blocks.find((b) => b.kind === 'behavior') as S7BehaviorBlock | undefined;
    expect(behavior).toBeDefined();
    expect(behavior!.targetingTag).toBe('backline_first');
    const talent = blocks.find((b) => b.kind === 'modifier') as S7ModifierBlock | undefined;
    expect(talent).toBeDefined(); // 驾驶天赋(占位)
    expect(talent!.stat).toBe('attack');
  });

  it('未列出的驾驶员 → 空积木（内容留第二块）', () => {
    expect(pilotBlocks('pil01')).toHaveLength(0);
    expect(pilotBlocks('pil99')).toHaveLength(0);
  });
});

describe('块5 装配器：lineup.pilotId → effectBlocks + 校验', () => {
  it('lineup 带 pilotId=pil03 → 该单位 effectBlocks 携带后排优先行为积木', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'pil', lineup: [{ shipId: 'shp01', slotRef: 'p0c2', pilotId: 'pil03' }] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'behavior' && (b as S7BehaviorBlock).targetingTag === 'backline_first')).toBe(true);
  });

  it('对照：不带 pilotId → 无 effectBlocks（防假过）', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'pil', lineup: [{ shipId: 'shp01', slotRef: 'p0c2' }] });
    expect(out.request.playerUnits[0].effectBlocks).toBeUndefined();
  });

  it('未知驾驶员 pil99 → unknown_pilot', async () => {
    const asm = await assemblerOf(loadBundle());
    expect(codeOf(() => asm.assemble({ progress: progressAt('n001'), runSeed: 1, lineup: [{ shipId: 'shp01', slotRef: 'p0c2', pilotId: 'pil99' }] }))).toBe('unknown_pilot');
  });

  it('驾驶员 + 星核 + 插件并存：effectBlocks 同时含 行为/原子炮(action)/插件加伤(modifier)', async () => {
    const asm = await assemblerOf(loadBundle());
    const out = asm.assemble({ progress: progressAt('n001'), runSeed: 'pil', lineup: [
      { shipId: 'shp01', slotRef: 'p0c2', pilotId: 'pil03', coreId: 'core07', plugins: [{ pluginId: 'plg02', quality: 'fine' }] },
    ] });
    const blocks = out.request.playerUnits[0].effectBlocks ?? [];
    expect(blocks.some((b) => b.kind === 'behavior')).toBe(true);
    expect(blocks.some((b) => b.kind === 'action' && b.effectRef === 'eff_atomic_cannon')).toBe(true);
    expect(blocks.some((b) => b.kind === 'modifier' && b.stat === 'attack' && b.op === 'pct')).toBe(true);
  });
});

describe('块5 引擎：晴岚把普攻从打前排改为打后排（死亡数对照防假过）', () => {
  // 前排 r0c0 = 1 血(被打即死)，后排 r0c6 = 海量血(打不死)。普攻单体、本舰射程覆盖两者。
  // 不装驾驶员 → 打最近(前排)→ 前排死(≥1 unit_down)；装晴岚(后排优先)→ 打后排(打不死)、前排没被碰 → 0 unit_down。
  function bundle(): Bundle {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), {
      ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
      attackRangeCells: 7, maxHp: 100000000, armor: 500, attack: 1000,
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 1, attack: 1, armor: 1, sizeRows: 1, sizeCols: 1 }); // 前排，1血
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), {
      maxHp: 100000000, attack: 1, armor: 1, sizeRows: 1, sizeCols: 1, ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none',
    }); // 后排，海量血
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_boss_add'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    // maxConcurrentOnField 是全局同屏上限：设 2 让前排+后排同 t=0 都出（设 1 会让后排因前排占额而不出）。
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
    return b;
  }
  async function unitDowns(pilotId: string | null): Promise<number> {
    const engine = new S7AutoBattleEngine(await runtimeOf(bundle()));
    const r: S7AutoBattleResult = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'pilrt',
      playerUnits: [pilotId
        ? { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2', effectBlocks: [...pilotBlocks(pilotId)] }
        : { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }],
    });
    return r.log.filter((e) => e.type === 'unit_down').length;
  }
  it('不装驾驶员 → 打前排(死)≥1 阵亡；装晴岚 → 打后排(不死)、前排存活=0 阵亡', async () => {
    const noPilot = await unitDowns(null);
    const withPilot = await unitDowns(S7_PILOT_BACKLINE_ID);
    expect(noPilot).toBeGreaterThanOrEqual(1); // 默认打最近=前排，前排1血被秒
    expect(withPilot).toBe(0);                 // 后排优先=只打打不死的后排，前排没被碰
  });
});
