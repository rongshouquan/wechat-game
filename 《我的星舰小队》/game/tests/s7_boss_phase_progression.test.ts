// ②c(块2真机验收)：证明 n030 首Boss 的 start/mid/final 三阶段随掉血真在切换。
//
// 手法（Ron 拍板"用测试配置压我方/抬敌血证明·不动正式数值"）：
//   - 正式 n030 boss(bu_boss_n030) 血量 2600、正式数值归第三块校准——本测试只在**内存**里临时抬高 boss 血，
//     绝不改磁盘 sample.json；抬血是为了让首Boss战"打满"（强队若一击秒杀，boss 在同一 tick 就 alive=false，
//     阶段检查(findBoss 要 alive)会跳过 mid/final，反而观测不到切换——这正是要抬血的原因）。
//   - n030 三阶段(battle_boss_phase_param)：start=battle_start(开场) / mid=hp<50% / final=hp<25%。
//   - 断言真实行为、非为绿而绿：若三阶段切换坏掉（漏触发/永远全触发/顺序错），本测试变红。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineModel } from '../assets/scripts/core/s7/S7MainlineProgress';
import { playS7Node } from '../assets/scripts/core/s7/S7RunSession';
import { createS7DefaultDryRunLineup } from '../assets/scripts/core/s7/S7DefaultBattleLineup';
import type { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const N030 = 'n030';
const FLAGSHIP = 'shp01';

/** 载入样例配置；bossHpOverride 给了则仅在内存把 n030 boss(bu_boss_n030) 血抬高——测试配置、不写磁盘、不动正式数值。 */
async function loadRuntime(bossHpOverride: number): Promise<{ runtime: S7ConfigRuntime; model: S7MainlineModel }> {
  const bundle = {} as Record<string, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  // ⑥三段落数后 n030 敌场=节奏量纲（boss 6740 血/109 重锤攻·bu_n030_swarm 907 血×4）——
  // 本测试只验阶段切换机制，敌场钉回落数前手调量纲（boss 攻 70 + adds 用全局 bu_enemy_swarm 120 血），
  // 血量仍由 bossHpOverride 控制（抬血打满/极高血卡 start 两个用例语义不变）。
  for (const r of bundle['battle_unit_stat_param'] as { rowId: string; maxHp: number; attack: number }[]) {
    if (r.rowId === 'bu_boss_n030') { r.maxHp = bossHpOverride; r.attack = 70; } // 抬敌血（内存·测试配置）
  }
  for (const r of bundle['battle_spawn_param'] as { rowId: string; unitStatRef: string }[]) {
    if (r.rowId === 'spawn_n030_adds') r.unitStatRef = 'bu_enemy_swarm';
  }
  // 批③段三重锚：敌射程按真源改无限（99）——旧全局蜂群 range1 无移动=永久沙包（隐性前提）；
  // 现 adds 真开火会打崩基础阵容 → 钉 attack 1 保"只验阶段切换"的隔离面。
  for (const r of bundle['battle_unit_stat_param'] as { rowId: string; attack: number }[]) {
    if ((r as { rowId: string }).rowId === 'bu_enemy_swarm') r.attack = 1;
  }
  for (const r of bundle['battle_encounter_param'] as { rowId: string; enemyUnitStatRefs: string[] }[]) {
    if (r.rowId === 'enc_n030') r.enemyUnitStatRefs = ['bu_boss_n030', 'bu_enemy_swarm']; // 校验器要求 spawn ref ∈ enc refs
  }
  const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(bundle as never));
  return { runtime, model: S7MainlineModel.fromRuntime(runtime) };
}

/** 打 n030（旗舰 shp01 升到 flagshipLevel 调我方输出），返回胜负 + 三阶段 tag 触发序列（按时间顺序）。 */
async function playN030(bossHp: number, flagshipLevel: number, seed: string): Promise<{ won: boolean; phaseTags: string[] }> {
  const { runtime, model } = await loadRuntime(bossHp);
  const lineup = createS7DefaultDryRunLineup().map((u) => (u.shipId === FLAGSHIP ? { ...u, shipLevel: flagshipLevel } : u));
  const o = playS7Node({ runtime, model, progress: { currentNodeId: N030, clearedNodeIds: [] }, runSeed: seed, lineup });
  const phaseTags = (o.battle.result.log as S7AutoBattleLogEntry[])
    .filter((e) => e.type === 'boss_phase')
    .map((e) => e.phaseTag ?? '');
  return { won: o.won, phaseTags };
}

describe('②c 首Boss n030 · 三阶段(start/mid/final)随掉血切换', () => {
  it('抬敌血打满 → start/mid/final 按序全触发、我方胜（多种子·非种子运气）', async () => {
    // 抬血到 8000(正式 2600)：强队(lv40)不再一击秒杀，boss 存活着逐 tick 掉过 50%/25% → 三阶段依次触发。
    for (const seed of ['s7-demo', 'k', 'r1']) {
      const r = await playN030(8000, 40, seed);
      expect(r.won).toBe(true);
      expect(r.phaseTags).toEqual(['start', 'mid', 'final']); // 齐 + 顺序(开场→50%→25%)
    }
  });

  it('防假过：boss 血极高、我方 120s 掉不下它的血 → 只出 start，mid/final 不触发（证明 mid/final 确按血量门槛 gate）', async () => {
    // 若阶段被误改成"开场全部触发"，这里会出现 mid/final → 本用例变红。
    const r = await playN030(100000, 1, 's7-demo'); // 极高血 + 未升级弱队 → boss 始终 >50%
    expect(r.phaseTags).toEqual(['start']);
    expect(r.phaseTags).not.toContain('mid');
    expect(r.phaseTags).not.toContain('final');
  });
});
