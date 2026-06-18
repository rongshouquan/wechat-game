// 块1b：效果装配层接入引擎的集成测试。
// 验证玩家单位带 effectBlocks 时，装配后的属性真的进入战斗（finalState 暴露 maxHp）；
// 不带 effectBlocks 时与基线完全一致（零回归保证）。
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
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;

function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

async function engineOf(): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle())));
}

function playerMaxHp(res: S7AutoBattleResult, slot: string): number {
  const u = res.finalState.players.find((p) => p.slotRef === slot);
  if (!u) throw new Error(`finalState 缺少玩家 ${slot}`);
  return u.maxHp;
}

describe('块1b 效果装配层接入引擎', () => {
  it('玩家单位带 +100% maxHp 积木 → 最终 maxHp 翻倍', async () => {
    const base = (await engineOf()).run({
      encounterRef: 'enc_n001',
      battleSeed: 's',
      playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }],
    });
    const baseMax = playerMaxHp(base, 'p0c0');
    expect(baseMax).toBeGreaterThan(0);

    const blocks: S7EffectBlock[] = [{ kind: 'modifier', stat: 'maxHp', op: 'pct', value: 1.0 }];
    const buff = (await engineOf()).run({
      encounterRef: 'enc_n001',
      battleSeed: 's',
      playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0', effectBlocks: blocks }],
    });
    expect(playerMaxHp(buff, 'p0c0')).toBe(baseMax * 2);
  });

  it('effectBlocks 缺省 与 显式空数组 结果完全一致（零回归）', async () => {
    const r1 = (await engineOf()).run({
      encounterRef: 'enc_n001',
      battleSeed: 'z',
      playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }],
    });
    const r2 = (await engineOf()).run({
      encounterRef: 'enc_n001',
      battleSeed: 'z',
      playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0', effectBlocks: [] }],
    });
    expect(r2.reason).toBe(r1.reason);
    expect(r2.durationSec).toBe(r1.durationSec);
    expect(playerMaxHp(r2, 'p0c0')).toBe(playerMaxHp(r1, 'p0c0'));
  });
});
