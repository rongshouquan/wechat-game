// 段2 战斗批 · 两条复活语义通道测试（可选通道范式=无配置引用字节不变+变异探针）。
// 通道①（既有 reviveWaves 扩展）：复活波次×Boss 墙组合上岗——阶段旗随复活波重置（n250/n312/n400 消费）。
// 通道②（新建）：坟场自复活 selfReviveHpPct/selfReviveDelaySec（真源 sf02 域规则+n140 废铁再生者）。
// 变异探针记账（开发期实测·段2 立通道时跑）：
//   ① 注掉 checkOutcome 的 selfReviveAt 拦截行 → T1/T2 红（首杀即判胜·revive 不发生）→ 复原绿；
//   ② 注掉 reviveEnemies 的 `ph.triggered = false` → T4 红（第二遍 mid 不触发）→ 复原绿。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import {
  S7AutoBattleLogEntry,
  S7AutoBattlePlayerUnitInput,
} from '../assets/scripts/core/s7/S7AutoBattleTypes';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const bundle = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return bundle;
}
function cloneBundle(b: Bundle): Bundle {
  return JSON.parse(JSON.stringify(b)) as Bundle;
}
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  try {
    return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
  } catch (e) {
    // fixture 调试可见性：运行时校验失败时把逐条错误吐进断言消息（S7ConfigLoadError.errors）。
    const errs = (e as { errors?: { table: string; id: string; message: string }[] }).errors;
    if (errs) throw new Error(`fixture 校验失败：${errs.map((x) => `${x.table}.${x.id}: ${x.message}`).join('；')}`);
    throw e;
  }
}
const ofType = (log: S7AutoBattleLogEntry[], type: string): S7AutoBattleLogEntry[] => log.filter((e) => e.type === type);

const TRIO: S7AutoBattlePlayerUnitInput[] = [
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c2' },
];

/** 单敌坟场关 fixture：enc_n001 缩成 1 只带自复活的 swarm（内存改装·不落盘）。 */
function graveyardSoloFixture(hpPct: number, delaySec: number, enemyHp = 30): Bundle {
  const b = cloneBundle(loadBundle());
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: ['spawn_n001_w1'],
    enemyUnitStatRefs: ['bu_enemy_swarm'],
    bossPhaseRefs: [],
  });
  Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), {
    unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r2c0'], spawnDelaySec: 0, waveIndex: 1,
    maxConcurrentOnField: 35,
  });
  Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), {
    maxHp: enemyHp, attack: 1, armor: 1,
    selfReviveHpPct: hpPct, selfReviveDelaySec: delaySec,
  });
  return b;
}

describe('段2 通道② · 坟场自复活（selfReviveHpPct）', () => {
  it('死亡→延迟原地复活一次（半血）→再死不复活；挂起期拦截清场胜利', async () => {
    const b = graveyardSoloFixture(0.5, 1.0);
    const e = await engineOf(b);
    const r = e.run({ encounterRef: 'enc_n001', battleSeed: 'gy1', playerUnits: TRIO });
    const revives = ofType(r.log, 'revive').filter((x) => x.note === 'graveyard_self');
    const downs = ofType(r.log, 'unit_down').filter((x) => x.side === 'enemy');
    expect(revives).toHaveLength(1); // 恰复活一次（闩锁：第二次死不再复活）
    expect(downs).toHaveLength(2); // 同一只敌死两次
    expect(downs[0].actorId).toBe(downs[1].actorId);
    // 拦截清场：revive 能出现本身=拦截生效（首杀即判胜的话战斗已结束·变异探针①的红点）；
    // 复活后同 tick 被秒=合法（30 血 fixture 下 TRIO 一拍带走）——end 时刻 ≥ 复活时刻。
    expect(r.winner).toBe('player');
    expect(r.durationSec).toBeGreaterThanOrEqual(revives[0].timeSec);
    // 延迟拍：复活时刻 ≈ 首死 +1.0s（TICK_SEC=0.2 粒度容差一拍）
    expect(revives[0].timeSec - downs[0].timeSec).toBeGreaterThanOrEqual(1.0 - 1e-9);
    expect(revives[0].timeSec - downs[0].timeSec).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it('复活血量吃 pct：同 seed 下 pct=0.05 比 pct=0.5 更早二次阵亡（行为级验证·无魔数）', async () => {
    const run = async (pct: number) => {
      const e = await engineOf(graveyardSoloFixture(pct, 1.0, 3000));
      const r = e.run({ encounterRef: 'enc_n001', battleSeed: 'gy-pct', playerUnits: TRIO });
      const downs = ofType(r.log, 'unit_down').filter((x) => x.side === 'enemy');
      expect(downs).toHaveLength(2);
      return downs[1].timeSec;
    };
    const secondDownThin = await run(0.05); // 复活 150 血（一两拍没）
    const secondDownFat = await run(0.9); // 复活 2700 血（要磨多拍）
    expect(secondDownThin).toBeLessThan(secondDownFat);
  });

  it('满场无格=复活作废（不报错不重试·清场后正常判胜）', async () => {
    const b = graveyardSoloFixture(0.5, 8.0); // 死后 8s 才复活（给填场波留窗）
    // 第二波 t=4s 全场 35 格铺满（含 r2c0——敌1 已死格已释放·被抢占）：复活时原地占+无空格=作废。
    const slots: string[] = [];
    for (let rr = 0; rr < 5; rr += 1) for (let cc = 0; cc < 7; cc += 1) slots.push(`r${rr}c${cc}`);
    (b.battle_spawn_param as Row[]).push({
      ...row(b, 'battle_spawn_param', 'spawn_n001_w1'),
      rowId: 'spawn_n001_flood', unitStatRef: 'bu_enemy_swarm_tough', count: 35, slotRefs: slots,
      spawnDelaySec: 4, waveIndex: 2, maxConcurrentOnField: 35,
    });
    // tough 血 5000=复活窗（t≈4-8s）内 TRIO 杀不出空格——复活时刻全场 35 格保持满员。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm_tough'), { maxHp: 5000, attack: 1, armor: 1 });
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    enc.spawnPlanRefs = ['spawn_n001_w1', 'spawn_n001_flood'];
    enc.enemyUnitStatRefs = ['bu_enemy_swarm', 'bu_enemy_swarm_tough'];
    const e = await engineOf(b);
    const r = e.run({ encounterRef: 'enc_n001', battleSeed: 'gy-full', playerUnits: TRIO });
    expect(ofType(r.log, 'revive')).toHaveLength(0); // 作废：无复活事件（闩锁已置·不重试不软锁）
    expect(ofType(r.log, 'battle_end')).toHaveLength(1); // 正常收场（35×5000 血磨不完=超时判负亦合法收场）
  });

  it('召唤物不吃自复活（随源消亡语义边界：summonedBy≠null 排除）', async () => {
    const b = cloneBundle(loadBundle());
    // n450 Boss 低血速通：mid 阶段召 3 只带自复活字段的 add——召唤物死后必须不复活。
    Object.assign(row(b, 'battle_boss_phase_param', 'phase_n450_mid'), {
      summonUnitRefs: ['bu_enemy_boss_add', 'bu_enemy_boss_add', 'bu_enemy_boss_add'],
      summonCountCap: 3,
    });
    // 血 5000：mid（50%）触发窗要真实存在——太脆会同 tick 从满血打穿到死、阶段永不触发（T5 同款教训）。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_boss_n450'), {
      maxHp: 5000, attack: 10, armor: 1, sizeRows: 2, sizeCols: 2,
      ultimateEffectRef: 'none', ultimateCdSec: 0,
    });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n450_boss'), { slotRefs: ['r0c2'] });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), {
      maxHp: 20, attack: 1, armor: 1,
      selfReviveHpPct: 0.5, selfReviveDelaySec: 0.4, // 字段在——召唤物身份必须让它失效
    });
    const enc = row(b, 'battle_encounter_param', 'enc_n450');
    enc.spawnPlanRefs = ['spawn_n450_boss'];
    enc.enemyUnitStatRefs = ['bu_boss_n450', 'bu_enemy_boss_add'];
    // 残留 adds 波行会触发"unitStatRef 不在 enemyUnitStatRefs"全表校验——fixture 一并摘除。
    b.battle_spawn_param = (b.battle_spawn_param as Row[]).filter((x) => x.rowId !== 'spawn_n450_adds');
    const e = await engineOf(b);
    const r = e.run({ encounterRef: 'enc_n450', battleSeed: 'gy-summon', playerUnits: TRIO });
    const summoned = ofType(r.log, 'spawn_wave').filter((x) => x.note === 'phase_summon');
    expect(summoned.length).toBeGreaterThan(0); // mid 真的召了
    expect(ofType(r.log, 'revive')).toHaveLength(0); // 召唤物死亡零复活
  });
});

describe('段2 通道① · 复活波次×Boss 墙组合（阶段旗随复活波重置）', () => {
  it('reviveWaves=1 的 Boss 关：第二遍 mid 阶段再次触发（完整再打一遍·非白板 Boss）', async () => {
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_encounter_param', 'enc_n104'), {
      spawnPlanRefs: ['spawn_n104_boss'],
      enemyUnitStatRefs: ['bu_boss_n104'],
      reviveWaves: 1,
    });
    // 血 3000×两遍：两遍各自的 mid（50%）触发窗都要真实存在（太脆=同 tick 打穿 50% 与 0%·阶段不触发）。
    // extraTriggerBlocks 清空=隔离面：n104 真机制（鼓动/周期召星盗）会让 TRIO 清不了场——本测只验阶段旗重置。
    const bossRow = row(b, 'battle_unit_stat_param', 'bu_boss_n104');
    Object.assign(bossRow, { maxHp: 3000, attack: 5, armor: 1, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    delete bossRow.extraTriggerBlocks; // validator：字段存在须非空——删除=缺席
    // 残留 adds 波行同上摘除（fixture 缩阵后防全表引用校验）。
    b.battle_spawn_param = (b.battle_spawn_param as Row[]).filter((x) => x.rowId !== 'spawn_n104_adds');
    const e = await engineOf(b);
    const r = e.run({ encounterRef: 'enc_n104', battleSeed: 'wave-boss', playerUnits: TRIO });
    const mids = ofType(r.log, 'boss_phase').filter((x) => x.phaseTag === 'mid');
    const reviveWave = ofType(r.log, 'spawn_wave').filter((x) => typeof x.note === 'string' && x.note.includes('revive_wave'));
    expect(reviveWave.length).toBeGreaterThan(0); // 复活波真的出了
    expect(mids.length).toBeGreaterThanOrEqual(2); // 两遍各触发一次 mid（旗未重置=只有 1 次·变异探针②的红点）
    expect(r.winner).toBe('player');
  });
});
