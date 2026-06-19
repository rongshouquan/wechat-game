// C1b 升级变强 步4：集成测试——同一关 n001,星舰升过级后战斗确实更强(端到端经装配器+引擎)。真实样例配置。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineProgressState } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7BattleLineupUnitInput } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const N001: S7MainlineProgressState = { currentNodeId: 'n001', clearedNodeIds: [] };
const lineupAtLevel = (lv?: number): S7BattleLineupUnitInput[] => [
  { shipId: 'shp01', slotRef: 'p0c2', shipLevel: lv },
  { shipId: 'shp02', slotRef: 'p1c2', shipLevel: lv },
  { shipId: 'shp03', slotRef: 'p2c2', shipLevel: lv },
];
type FS = { result: { finalState: { players: { hp: number; maxHp: number }[] } } };
const sumPlayerHp = (r: FS): number => r.result.finalState.players.reduce((s, u) => s + Math.max(0, u.hp), 0);
const sumPlayerMaxHp = (r: FS): number => r.result.finalState.players.reduce((s, u) => s + u.maxHp, 0);

describe('C1b 升级变强 步4 集成：升级后同关更强', () => {
  it('n001 同种子:10 级阵容比 1 级 打得更快 / 残血更多,且都胜', async () => {
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
    const svc = new S7BattleRunService();
    const base = svc.run({ runtime, progress: N001, runSeed: 'cmp', lineup: lineupAtLevel(1) });
    const leveled = svc.run({ runtime, progress: N001, runSeed: 'cmp', lineup: lineupAtLevel(10) });

    // 都打赢
    expect(base.summary.winner).toBe('player');
    expect(leveled.summary.winner).toBe('player');
    // 升级后"更强"的可量化证据:① 血更厚(总 maxHp 升,证成长积木放大了血);② 残血更多(更经打)。
    expect(sumPlayerMaxHp(leveled)).toBeGreaterThan(sumPlayerMaxHp(base));
    expect(sumPlayerHp(leveled)).toBeGreaterThan(sumPlayerHp(base));
    // 用时不会更长(秒粒度较粗,弱断言)
    expect(leveled.result.durationSec).toBeLessThanOrEqual(base.result.durationSec);
    // 装配器确实给升级单位织了成长积木(1 级不织、10 级织)
    expect(base.request.playerUnits.some((u) => u.effectBlocks && u.effectBlocks.length > 0)).toBe(false);
    expect(leveled.request.playerUnits.every((u) => (u.effectBlocks ?? []).length > 0)).toBe(true);
  });

  it('确定性:同等级同种子两次结果一致', async () => {
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
    const svc = new S7BattleRunService();
    const a = svc.run({ runtime, progress: N001, runSeed: 'k', lineup: lineupAtLevel(8) });
    const b = svc.run({ runtime, progress: N001, runSeed: 'k', lineup: lineupAtLevel(8) });
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });
});
