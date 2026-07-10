// C·养成接入 step1：离线收益编排单测。真实样例配置建 model，不改磁盘表。
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineModel, createDefaultS7MainlineProgress } from '../assets/scripts/core/s7/S7MainlineProgress';
import { createDefaultS7BuildingState, unlockBuilding, bumpBuildingLevel } from '../assets/scripts/core/s7/S7BuildingState';
import { createDefaultS7Population } from '../assets/scripts/core/s7/S7Population';
import { OFFLINE_BASE_RATE_PER_HOUR } from '../assets/scripts/core/s7/S7OfflineProduction';
import {
  computeS7OfflineSettlement,
  applyOfflineGains,
  S7_HABITAT_BUILDING_ID,
} from '../assets/scripts/core/s7/S7OfflineSettlement';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

let model: S7MainlineModel;
beforeAll(async () => {
  const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
  model = S7MainlineModel.fromRuntime(runtime);
});

const HOUR_MS = 3600 * 1000;
const habitatAt = (lv: number) => {
  const b = createDefaultS7BuildingState();
  if (lv >= 1) {
    unlockBuilding(b, S7_HABITAT_BUILDING_ID); // lv1
    for (let i = 1; i < lv; i += 1) bumpBuildingLevel(b, S7_HABITAT_BUILDING_ID);
  }
  return b;
};
const progress0 = () => createDefaultS7MainlineProgress(); // clearedNodeIds=[] → 星域档 0

describe('C step1 · computeS7OfflineSettlement', () => {
  it('居住舱 lv1、离线 1 小时、星域档 0、无居民：进账=基础产率，hasGains', () => {
    const s = computeS7OfflineSettlement(model, habitatAt(1), createDefaultS7Population(), progress0(), 0, HOUR_MS);
    // 步5 重定基：v0.7 基础 62/24/16 + 居住舱 lv1 产率 +2%（细案③逐级表 lv1=2·旧 lv1=0 作废）。
    expect(s.gains.starOre).toBe(Math.floor(OFFLINE_BASE_RATE_PER_HOUR.starOre * 1.02)); // 63
    expect(s.gains.hullAlloy).toBe(Math.floor(OFFLINE_BASE_RATE_PER_HOUR.hullAlloy * 1.02)); // 24
    expect(s.gains.pilotToken).toBe(Math.floor(OFFLINE_BASE_RATE_PER_HOUR.pilotToken * 1.02)); // 16
    expect(s.hasGains).toBe(true);
    expect(s.overflowed).toBe(false);
    expect(s.elapsedSeconds).toBe(3600);
  });

  it('居住舱未解锁(lv0)：存储上限 0 → 无离线收益', () => {
    const s = computeS7OfflineSettlement(model, createDefaultS7BuildingState(), createDefaultS7Population(), progress0(), 0, HOUR_MS);
    expect(s.gains.starOre).toBe(0);
    expect(s.hasGains).toBe(false);
    expect(s.capSeconds).toBe(0);
  });

  it('now <= lastOnlineTime（时钟回拨/无离线）：离线秒数归 0、无收益', () => {
    const s = computeS7OfflineSettlement(model, habitatAt(1), createDefaultS7Population(), progress0(), HOUR_MS, HOUR_MS - 5000);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.hasGains).toBe(false);
  });

  it('离线过久撞上限：effectiveSeconds=封顶、overflowed=true、进账按封顶算', () => {
    const s = computeS7OfflineSettlement(model, habitatAt(1), createDefaultS7Population(), progress0(), 0, 1000 * HOUR_MS);
    expect(s.overflowed).toBe(true);
    expect(s.effectiveSeconds).toBe(s.capSeconds); // lv1 居住舱 36h 封顶
    expect(s.gains.starOre).toBe(Math.floor((OFFLINE_BASE_RATE_PER_HOUR.starOre * 1.02 * s.capSeconds) / 3600)); // lv1 +2%
  });

  it('居住舱升级 → 同样离线 1 小时进账更高（产率加成）——养成可见', () => {
    const lv1 = computeS7OfflineSettlement(model, habitatAt(1), createDefaultS7Population(), progress0(), 0, HOUR_MS);
    const lv10 = computeS7OfflineSettlement(model, habitatAt(10), createDefaultS7Population(), progress0(), 0, HOUR_MS);
    expect(lv10.gains.starOre).toBeGreaterThan(lv1.gains.starOre); // lv10 自带 +18% 产率
  });

  it('居民>0 → 离线收益更高（居民产率加成注入）', () => {
    const noRes = computeS7OfflineSettlement(model, habitatAt(1), createDefaultS7Population(), progress0(), 0, HOUR_MS);
    const withRes = computeS7OfflineSettlement(model, habitatAt(1), { residents: 10, workers: 0 }, progress0(), 0, HOUR_MS);
    expect(withRes.gains.starOre).toBeGreaterThan(noRes.gains.starOre); // +10% 产率
  });

  it('applyOfflineGains 只加账本已有键、跳过未知键、不加非正值', () => {
    const wallet: Record<string, number> = { starOre: 100, hullAlloy: 50, pilotToken: 0 };
    applyOfflineGains(wallet, { starOre: 30, hullAlloy: 0, pilotToken: 5 });
    expect(wallet.starOre).toBe(130);
    expect(wallet.hullAlloy).toBe(50); // +0 不变
    expect(wallet.pilotToken).toBe(5);
    // 钱包没有的键不会被创建
    const w2: Record<string, number> = { starOre: 0 };
    applyOfflineGains(w2, { starOre: 10, hullAlloy: 9, pilotToken: 9 });
    expect(w2.starOre).toBe(10);
    expect(Object.prototype.hasOwnProperty.call(w2, 'hullAlloy')).toBe(false);
  });
});
