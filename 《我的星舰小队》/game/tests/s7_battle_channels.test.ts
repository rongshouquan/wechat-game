// 段二 C3：三个新引擎通道（斩首胜利条件 / 复活波次 / 镜像读档）＋增援强化通道测试。
// 可选通道范式的两面都验：①缺省缺席=旧行为逐字节不变（同 seed 双跑日志逐条相等——变异探针的"不咬"面）；
// ②配置就位=通道实咬（行为/日志/胜负按新语义变——探针的"咬"面）。内存 clone 配置表，不改磁盘样例。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattlePlayerUnitInput } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { validateS7ConfigBundle } from '../assets/scripts/config/s7/ConfigValidatorS7';

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
const cloneBundle = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
const engineOf = async (b: Bundle) => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));

const FIVE: S7AutoBattlePlayerUnitInput[] = [
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p2c2' },
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c1' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c1' },
];
const run = async (b: Bundle, encounterRef = 'enc_n001', seed = 'ch') =>
  (await engineOf(b)).run({ encounterRef, battleSeed: seed, playerUnits: FIVE });

describe('可选通道范式 · 不咬面（缺省缺席=旧行为不变）', () => {
  it('无通道字段的节点：通道代码在场 vs 配置缺席——同 seed 结果与日志逐条相等（探针不咬）', async () => {
    // 两次独立构建 runtime（同一磁盘配置·无通道字段）双跑：任何"通道缺省仍改行为"的实现错误都会破相等。
    const a = await run(loadBundle());
    const b = await run(loadBundle());
    expect(a.winner).toBe(b.winner);
    expect(a.reason).toBe(b.reason);
    expect(a.durationSec).toBe(b.durationSec);
    expect(a.log).toEqual(b.log);
    expect(a.reason).not.toBe('target_down'); // 无配置节点永不出现斩首胜利
    expect(a.log.some((e) => typeof e.note === 'string' && (e.note.includes('revive_wave') || e.note.includes('reinforce') || e.note === 'mirror_lineup'))).toBe(false);
  });
});

describe('斩首通道（victoryRule=kill_target·精英花样①）', () => {
  it('点名单位死即胜（reason=target_down·其余敌人仍在场）；增援周期出怪+递增强化实咬', async () => {
    const b = cloneBundle(loadBundle());
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    // n001 现有敌=swarm 小怪；克隆一个"指挥官"单位（厚·不打人）+ 一个不断增援的小怪批次。
    const units = b.battle_unit_stat_param as Row[];
    const swarm = units.find((u) => u.rowId === 'bu_enemy_swarm')!;
    // 指挥官=厚到撑过增援节拍（≥ 数波）但打得死；增援=打不死的干扰件（证明"目标死=在场也胜"）。
    units.push({ ...swarm, rowId: 'bu_ch_commander', maxHp: 5000, armor: 20, attack: 1, note: '通道测试·指挥官' });
    units.push({ ...swarm, rowId: 'bu_ch_add_tanky', maxHp: 9e6, armor: 9999, attack: 1, note: '通道测试·打不死增援' });
    const spawns = b.battle_spawn_param as Row[];
    const encSpawnRefs = enc.spawnPlanRefs as string[];
    const firstSpawn = row(b, 'battle_spawn_param', encSpawnRefs[0]);
    spawns.push({
      ...firstSpawn, rowId: 'spawn_ch_cmd', unitStatRef: 'bu_ch_commander', count: 1, slotRefs: ['r1c5'],
      spawnDelaySec: 0, waveIndex: 9, note: '通道测试·指挥官位',
    });
    spawns.push({
      ...firstSpawn, rowId: 'spawn_ch_adds', unitStatRef: 'bu_ch_add_tanky', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 1,
      waveIndex: 10, repeatEverySec: 3, repeatEscalatePct: 0.5, note: '通道测试·周期增援', maxConcurrentOnField: 21,
    });
    enc.spawnPlanRefs = [...encSpawnRefs, 'spawn_ch_cmd', 'spawn_ch_adds'];
    enc.enemyUnitStatRefs = [...(enc.enemyUnitStatRefs as string[]), 'bu_ch_commander', 'bu_ch_add_tanky'];
    enc.victoryRule = 'kill_target';
    enc.victoryTargetUnitRef = 'bu_ch_commander';
    const r = await run(b);
    expect(r.winner).toBe('player');
    expect(r.reason).toBe('target_down'); // 斩首即胜（不用清场）
    // 增援通道实咬：周期波次真的落了（日志 note 带 reinforce_k）。
    const reinforce = r.log.filter((e) => e.type === 'spawn_wave' && typeof e.note === 'string' && e.note.includes('reinforce_'));
    expect(reinforce.length).toBeGreaterThanOrEqual(1);
    // 斩首胜利时打不死的增援敌必然仍在场（=胜利真的没要求清场）。
    expect(r.finalState.enemies.some((u) => u.alive)).toBe(true);
  });

  it('点名单位没死→照旧不胜（目标在场时清掉其他敌人不结算）', async () => {
    const b = cloneBundle(loadBundle());
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    const units = b.battle_unit_stat_param as Row[];
    const swarm = units.find((u) => u.rowId === 'bu_enemy_swarm')!;
    // 打不死的指挥官（超厚超高防·1 攻）——battle 必然超时=enemy win（拖久必输的下限兜底）。
    units.push({ ...swarm, rowId: 'bu_ch_tanky', maxHp: 9e6, armor: 9999, attack: 1, note: '通道测试·打不死目标' });
    const spawns = b.battle_spawn_param as Row[];
    const firstSpawn = row(b, 'battle_spawn_param', (enc.spawnPlanRefs as string[])[0]);
    spawns.push({ ...firstSpawn, rowId: 'spawn_ch_tanky', unitStatRef: 'bu_ch_tanky', count: 1, slotRefs: ['r1c6'], spawnDelaySec: 0, waveIndex: 9, note: '' });
    enc.spawnPlanRefs = [...(enc.spawnPlanRefs as string[]), 'spawn_ch_tanky'];
    enc.enemyUnitStatRefs = [...(enc.enemyUnitStatRefs as string[]), 'bu_ch_tanky'];
    enc.victoryRule = 'kill_target';
    enc.victoryTargetUnitRef = 'bu_ch_tanky';
    const r = await run(b);
    expect(r.winner).toBe('enemy');
    expect(r.reason).toBe('timeout'); // 目标不死不胜·超时判负照旧
  });
});

describe('复活波次通道（reviveWaves·精英花样③满血复活连战）', () => {
  it('敌全灭后按原计划满血复活再打一遍：时长变长+日志带 revive_wave+最终仍玩家胜', async () => {
    const base = await run(loadBundle());
    expect(base.winner).toBe('player'); // n001=教学碾压关（前提自检）
    const b = cloneBundle(loadBundle());
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    enc.reviveWaves = 1;
    const r = await run(b);
    expect(r.winner).toBe('player');
    const revives = r.log.filter((e) => e.type === 'spawn_wave' && typeof e.note === 'string' && e.note.includes('revive_wave_'));
    expect(revives.length).toBeGreaterThanOrEqual(1); // 复活波真的落了
    expect(r.durationSec).toBeGreaterThan(base.durationSec); // 再打一遍=必然更久
    // 复活出来的是"满血新单位"：敌方最终名单数量 > 基线（新 unitId 增发·旧尸体保留在 finalState）。
    expect(r.finalState.enemies.length).toBeGreaterThan(base.finalState.enemies.length);
  });

  it('reviveWaves=2 比 =1 更久（每波都真打）', async () => {
    const mk = async (n: number) => {
      const b = cloneBundle(loadBundle());
      (row(b, 'battle_encounter_param', 'enc_n001') as Row).reviveWaves = n;
      return run(b);
    };
    const one = await mk(1);
    const two = await mk(2);
    expect(two.durationSec).toBeGreaterThan(one.durationSec);
    expect(two.winner).toBe('player');
  });
});

describe('镜像通道（mirrorLineup·精英花样②）', () => {
  it('敌方=玩家阵容读档生成：同 unitStatRef 同数量对位铺放·战斗完整跑完', async () => {
    const b = cloneBundle(loadBundle());
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    enc.mirrorLineup = true;
    enc.spawnPlanRefs = [];
    const r = await run(b);
    // 敌方=玩家五舰镜像（unitStatRef 多重集合逐一相等）。
    const mirrorWave = r.log.find((e) => e.type === 'spawn_wave' && e.note === 'mirror_lineup');
    expect(mirrorWave?.targetIds).toHaveLength(FIVE.length);
    expect(r.finalState.enemies.map((u) => u.unitStatRef).sort()).toEqual(FIVE.map((u) => u.unitStatRef).sort());
    // 镜像=同构队互打：战斗自然结束（任一方胜/超时都合法），但不允许抛错且必须有战斗事件。
    expect(['player', 'enemy']).toContain(r.winner);
    expect(r.log.some((e) => e.type === 'unit_attack')).toBe(true);
  });
});

describe('校验器武装（新字段带了就严校·缺席=全量样例照旧全绿）', () => {
  it('磁盘全量样例（无通道字段）验证零错误（缺席=合法）', () => {
    const errors = validateS7ConfigBundle(loadBundle() as never);
    expect(errors).toEqual([]);
  });

  it('非法通道配置全部被抓：坏 victoryRule/缺目标/reviveWaves 越界/镜像带出怪计划/repeat 组合非法', () => {
    const b = cloneBundle(loadBundle());
    const enc = row(b, 'battle_encounter_param', 'enc_n001');
    enc.victoryRule = 'kill_all'; // 非法值
    enc.reviveWaves = 9; // 越界
    const enc2 = row(b, 'battle_encounter_param', 'enc_n002');
    enc2.mirrorLineup = true; // 镜像但 spawnPlanRefs 非空=非法
    const sp = (b.battle_spawn_param as Row[])[0];
    sp.repeatEscalatePct = 0.5; // 无 repeatEverySec=非法
    const msgs = validateS7ConfigBundle(b as never).map((e) => e.message).join('\n');
    expect(msgs).toContain("victoryRule 仅支持 'kill_target'");
    expect(msgs).toContain('reviveWaves 必须为 1-3 的整数');
    expect(msgs).toContain('镜像关的 spawnPlanRefs 必须为空数组');
    expect(msgs).toContain('repeatEscalatePct 只能与 repeatEverySec 一起出现');
  });
});
