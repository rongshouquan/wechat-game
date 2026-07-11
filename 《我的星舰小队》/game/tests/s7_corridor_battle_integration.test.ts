// 深空回廊·受控引擎入口 + 战斗服务 集成测试（第2.5块·块3步2，GDD S10.7）。
//
// 引擎触碰=深度自检范畴·反例三件套（Ron 2026-07-04 硬要求）：
//   ① 铁甲潮开/关跑同一敌阵，结果必须不同（戏法没生效则此测试会红）。
//   ② 闪电战限时覆盖真在 40s 判负（覆盖生效）。
//   ③ 同层同种子回廊战斗逐字节一致（确定性）。
// 并行加法零回归：不设回廊三字段时引擎行为=扩展前（走 encounter 敌阵）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { createS7DefaultDryRunLineup } from '../assets/scripts/core/s7/S7DefaultBattleLineup';
import { corridorTrickEffect } from '../assets/scripts/core/s7/S7CorridorTricks';
import {
  corridorLayerPlan, corridorBossNodeIds, corridorPaletteFrom, S7CorridorEnemyPaletteEntry,
} from '../assets/scripts/core/s7/S7DeepCorridor';
import {
  runCorridorBattle, corridorInlineEnemies, bossNodeInlineEnemies,
  applyCorridorLineupEffects, S7CorridorLineupCapError,
} from '../assets/scripts/core/s7/S7CorridorBattleService';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
async function runtimeOf(): Promise<S7ConfigRuntime> {
  return S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
}
/** 回廊调色板（对锚批：改走单源过滤器 corridorPaletteFrom——只收 bu_enemy_ 基础行+带三围）。 */
function paletteOf(runtime: S7ConfigRuntime): S7CorridorEnemyPaletteEntry[] {
  return corridorPaletteFrom(
    runtime.getAll<{ targetType: string; rowId: string; roleTag: string; sizeRows: number; sizeCols: number; maxHp: number; attack: number; attackIntervalSec: number }>('battle_unit_stat_param'),
  );
}
function bossIdsOf(runtime: S7ConfigRuntime): string[] {
  return corridorBossNodeIds(runtime.getAll<{ nodeId: string; nodeTypeTag: string }>('mainline_node_config'));
}
const enemyHp = (r: S7AutoBattleResult): number => r.finalState.enemies.reduce((s, e) => s + e.hp, 0);

describe('回廊受控引擎入口 - 反例三件套', () => {
  it('① 铁甲潮开/关跑同一敌阵，结果必须不同（护甲拖慢击杀·戏法没生效会红）', async () => {
    const engine = new S7AutoBattleEngine(await runtimeOf());
    // 高攻玩家 vs 一个坦克敌人（400血/30甲）：无护甲 buff 更快打死、铁甲潮(+150%甲)更慢打死 → 击杀耗时不同。
    const inline = [{ unitStatRef: 'bu_enemy_shield', slotRef: 'r0c0' }];
    const players = [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' }];
    const plain = engine.run({ encounterRef: 'enc_n001', battleSeed: 'ct', playerUnits: players, inlineEnemyUnits: inline });
    const ironBlocks = corridorTrickEffect('iron_tide').enemyBlocks;
    const armored = engine.run({ encounterRef: 'enc_n001', battleSeed: 'ct', playerUnits: players, inlineEnemyUnits: inline, enemyEffectBlocks: ironBlocks });
    // 两场都打赢（敌人最终会死），但铁甲潮让击杀更慢 → durationSec 更长。
    expect(plain.winner).toBe('player');
    expect(armored.winner).toBe('player');
    expect(armored.durationSec).toBeGreaterThan(plain.durationSec); // 铁甲潮真生效
    expect(armored).not.toEqual(plain); // 结果整体不同
  });

  it('② 闪电战限时覆盖真在 40s 判负；覆盖决定判负时刻（120 → 120s）', async () => {
    const engine = new S7AutoBattleEngine(await runtimeOf());
    // 打不死的头目 vs 弱攻但超肉的玩家(+100倍血·撑过窗口打不死头目) → 双方都活到点 → 必到点判负。
    // 限时覆盖决定判负秒数（这才是本反例要验的：40 覆盖真在 40s 判、120 覆盖在 120s 判）。
    // ⑥第一段重定基：guardian(锋矢) 现带伤害大招+更快手速、~60s 能杀穿头目破坏"双活到点"前提——
    // 夹具追加 攻−99% 修正钉死"打不死"（对敌行后续任何缩放也稳健）。
    const inline = [{ unitStatRef: 'bu_enemy_shield_warden', slotRef: 'r0c0' }];
    const players = [{
      unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0',
      effectBlocks: [
        { kind: 'modifier' as const, stat: 'maxHp' as const, op: 'pct' as const, value: 100 },
        { kind: 'modifier' as const, stat: 'attack' as const, op: 'pct' as const, value: -0.99 },
      ],
    }];
    const blitz = engine.run({ encounterRef: 'enc_n001', battleSeed: 'ct', playerUnits: players, inlineEnemyUnits: inline, timeLimitSecOverride: 40 });
    expect(blitz.reason).toBe('timeout');
    expect(blitz.durationSec).toBe(40); // 真在 40s 判负
    expect(blitz.winner).toBe('enemy');
    const long = engine.run({ encounterRef: 'enc_n001', battleSeed: 'ct', playerUnits: players, inlineEnemyUnits: inline, timeLimitSecOverride: 120 });
    expect(long.durationSec).toBe(120); // 覆盖生效=不同判负时刻
  });

  it('③ 同层同种子回廊战斗逐字节一致（确定性）', async () => {
    const runtime = await runtimeOf();
    const plan = corridorLayerPlan(3, paletteOf(runtime), bossIdsOf(runtime));
    const lineup = createS7DefaultDryRunLineup();
    const a = runCorridorBattle({ runtime, plan, lineup, runSeed: 'corridor_3' });
    const b = runCorridorBattle({ runtime, plan, lineup, runSeed: 'corridor_3' });
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });
});

describe('回廊受控引擎入口 - 并行加法零回归', () => {
  it('不设回廊三字段：引擎走 encounter 敌阵（与扩展前一致·主线路径不变）', async () => {
    const engine = new S7AutoBattleEngine(await runtimeOf());
    const base = engine.run({ encounterRef: 'enc_n001', battleSeed: 'ct', playerUnits: createS7DefaultDryRunLineup().map((u, i) => ({ unitStatRef: ['bu_ship_vanguard', 'bu_ship_gunner', 'bu_ship_guardian'][i], slotRef: u.slotRef })) });
    // enc_n001 有出怪（spawn_n001_w1/w2）→ 敌方非空；证明未传 inline 时仍走 encounter 原路径。
    expect(base.finalState.enemies.length).toBeGreaterThan(0);
    expect(['player', 'enemy']).toContain(base.winner);
  });
});

describe('回廊战斗服务 - 敌阵来源 / 阵容效果', () => {
  it('普通/戏法层：内联敌阵=Step1 生成敌阵，全部进战斗（多重集包含·召唤增员合法）', async () => {
    const runtime = await runtimeOf();
    const plan = corridorLayerPlan(4, paletteOf(runtime), bossIdsOf(runtime));
    const r = runCorridorBattle({ runtime, plan, lineup: createS7DefaultDryRunLineup(), runSeed: 'c4' });
    expect(plan.formation).not.toBeNull();
    // ⑩A0 重定基（旧断言=终态数==编队数）：调色板=全部 1×1 敌行，⑩清 4 条零引用孤行（bu_n030/060/084/102_add）
    // 后层4 抽签重排、抽中母舰职业行 → 战中召唤增员使终态数>编队数——召唤是引擎合法行为非泄漏。
    // 改多重集包含：编队每个成员按其数量必须都进了战斗（原属性"全部进战斗"原样保住，且比相等更精确——
    // 旧断言在"漏 1 编队员+来 1 召唤物"时会假绿，包含式抓得住）。
    const fieldCount = new Map<string, number>();
    for (const e of r.result.finalState.enemies) fieldCount.set(e.unitStatRef, (fieldCount.get(e.unitStatRef) ?? 0) + 1);
    const planCount = new Map<string, number>();
    for (const u of plan.formation!.units) planCount.set(u.unitStatRef, (planCount.get(u.unitStatRef) ?? 0) + 1);
    for (const [ref, n] of planCount) {
      expect(fieldCount.get(ref) ?? 0, `编队成员 ${ref} 应全员进战斗`).toBeGreaterThanOrEqual(n);
    }
    expect(r.result.finalState.enemies.length).toBeGreaterThanOrEqual(plan.formation!.units.length);
    expect(r.result.finalState.enemies.length).toBeGreaterThan(0);
  });

  it('回响Boss层：内联敌阵复用 Boss 节点(n030)的 spawn 形状', async () => {
    const runtime = await runtimeOf();
    const fromNode = bossNodeInlineEnemies(runtime, 'n030');
    expect(fromNode.length).toBeGreaterThan(0);
    const plan = corridorLayerPlan(25, paletteOf(runtime), bossIdsOf(runtime)); // 层25=首个回响Boss=n030
    expect(plan.echoBoss?.bossNodeId).toBe('n030');
    const { inlineEnemyUnits, enemyEffectBlocks } = corridorInlineEnemies(plan, runtime);
    expect(inlineEnemyUnits).toEqual(fromNode); // 复用Boss配置
    expect(enemyEffectBlocks).toBe(plan.echoBoss!.enemyBlocks); // 轮次缩放积木
  });

  it('上阵超上限（孤胆1舰带3舰）→ 抛 S7CorridorLineupCapError', async () => {
    const runtime = await runtimeOf();
    // 深层找一个孤胆层。
    let loneLayer = -1;
    for (let L = 100; L <= 3000 && loneLayer < 0; L += 10) {
      const p = corridorLayerPlan(L, paletteOf(runtime), bossIdsOf(runtime));
      if (p.trickId === 'lone_hero') loneLayer = L;
    }
    expect(loneLayer).toBeGreaterThan(0);
    const plan = corridorLayerPlan(loneLayer, paletteOf(runtime), bossIdsOf(runtime));
    expect(plan.lineupCap).toBe(1);
    expect(() => runCorridorBattle({ runtime, plan, lineup: createS7DefaultDryRunLineup(), runSeed: 'lone' }))
      .toThrow(S7CorridorLineupCapError);
  });

  it('静默空域：我方 coreId 被清（禁核）·乱流 playerBlocks 加到 extraBlocks', async () => {
    const runtime = await runtimeOf();
    const lineup = [{ shipId: 'shp01', slotRef: 'p0c2', coreId: 'core07' }];
    // 找一个静默空域层与一个乱流层。
    const find = (trick: string): number => {
      for (let L = 10; L <= 5000; L += 10) if (corridorLayerPlan(L, paletteOf(runtime), bossIdsOf(runtime)).trickId === trick) return L;
      return -1;
    };
    const silentPlan = corridorLayerPlan(find('silent_zone'), paletteOf(runtime), bossIdsOf(runtime));
    const silenced = applyCorridorLineupEffects(lineup, silentPlan);
    expect(silenced[0].coreId).toBeUndefined(); // 禁核

    const turbPlan = corridorLayerPlan(find('turbulence'), paletteOf(runtime), bossIdsOf(runtime));
    const turbo = applyCorridorLineupEffects(lineup, turbPlan);
    expect(turbo[0].coreId).toBe('core07'); // 乱流不禁核
    expect((turbo[0].extraBlocks ?? []).some((b) => b.kind === 'affix' && (b as { affix: string }).affix === 'skillHaste')).toBe(true);
  });
});
