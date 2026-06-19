// C1b 难度关卡 阶段② B1：S7 战斗色块回放「日志→帧」转换器单测。真实样例配置跑出，不改磁盘表。
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { createS7DefaultDryRunLineup } from '../assets/scripts/core/s7/S7DefaultBattleLineup';
import { buildS7BattlePlayback } from '../assets/scripts/core/s7/S7BattlePlayback';
import { S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

let runtime: S7ConfigRuntime;
let n006Result: S7AutoBattleResult;
beforeAll(async () => {
  runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
  // n006：含延迟 3s 登场的爆发兵 → 适合验"登场"时间线；默认 3 舰阵容、固定种子。
  const run = new S7BattleRunService().run({
    runtime,
    progress: { currentNodeId: 'n006', clearedNodeIds: [] },
    runSeed: 's7-demo',
    lineup: createS7DefaultDryRunLineup(),
  });
  n006Result = run.result;
});

describe('C1b 阶段②B1 · buildS7BattlePlayback', () => {
  it('花名册覆盖最终态全部单位，位置解析正确', () => {
    const pb = buildS7BattlePlayback(n006Result);
    const finalCount = n006Result.finalState.players.length + n006Result.finalState.enemies.length;
    expect(pb.roster).toHaveLength(finalCount);
    // 玩家旗舰 shp01 在 p0c2 → row0 col2。
    const flag = pb.roster.find((u) => u.unitId === 'player_p0c2')!;
    expect(flag.side).toBe('player');
    expect([flag.row, flag.col]).toEqual([0, 2]);
    // 敌人格 r{r}c{c} 解析正确（row/col 与 slotRef 一致）。
    const anyEnemy = pb.roster.find((u) => u.side === 'enemy')!;
    expect(anyEnemy.slotRef).toMatch(/^r\dc\d$/);
    expect(anyEnemy.slotRef).toBe(`r${anyEnemy.row}c${anyEnemy.col}`);
  });

  it('帧序列非空、时间不倒退、含开局帧', () => {
    const pb = buildS7BattlePlayback(n006Result);
    expect(pb.frames.length).toBeGreaterThan(1);
    expect(pb.frames[0].timeSec).toBe(0);
    for (let k = 1; k < pb.frames.length; k += 1) {
      expect(pb.frames[k].timeSec).toBeGreaterThanOrEqual(pb.frames[k - 1].timeSec);
    }
  });

  it('登场时间线：开局帧有敌人未登场(延迟波)，末帧全部已登场', () => {
    const pb = buildS7BattlePlayback(n006Result);
    const first = pb.frames[0].units;
    const last = pb.frames[pb.frames.length - 1].units;
    // 开局：玩家全在场。
    for (const u of pb.roster.filter((r) => r.side === 'player')) expect(first[u.unitId].present).toBe(true);
    // 开局：至少一个敌人尚未登场（n006 爆发兵延迟 3s）。
    const enemies = pb.roster.filter((r) => r.side === 'enemy');
    expect(enemies.some((u) => first[u.unitId].present === false)).toBe(true);
    // 末帧：全员已登场（battle 跑满 > 3s，延迟波已出）。
    for (const u of pb.roster) expect(last[u.unitId].present).toBe(true);
    // 有"本帧登场"事件被记录。
    expect(pb.frames.some((f) => f.spawnedIds.length > 0)).toBe(true);
  });

  it('末帧血量/生死与引擎最终态完全一致（回放不偏离权威结果）', () => {
    const pb = buildS7BattlePlayback(n006Result);
    const last = pb.frames[pb.frames.length - 1].units;
    const finals = [...n006Result.finalState.players, ...n006Result.finalState.enemies];
    for (const f of finals) {
      expect(last[f.unitId].hp).toBe(Math.max(0, f.hp));
      expect(last[f.unitId].alive).toBe(f.alive);
    }
  });

  it('确实播出了攻击与伤害事件（战斗真打起来了）', () => {
    const pb = buildS7BattlePlayback(n006Result);
    expect(pb.frames.some((f) => f.attacks.length > 0)).toBe(true);
    expect(pb.frames.some((f) => f.hits.length > 0)).toBe(true);
  });

  it('确定可复现：同 result 两次构建深度相等', () => {
    expect(JSON.stringify(buildS7BattlePlayback(n006Result))).toBe(JSON.stringify(buildS7BattlePlayback(n006Result)));
  });

  it('收尾 playerSurvivorPct 与最终态全队残血% 口径一致', () => {
    const pb = buildS7BattlePlayback(n006Result);
    const totMax = n006Result.finalState.players.reduce((s, u) => s + u.maxHp, 0);
    const totHp = n006Result.finalState.players.reduce((s, u) => s + Math.max(0, u.hp), 0);
    expect(pb.playerSurvivorPct).toBe(Math.round((totHp / totMax) * 100));
  });
});
