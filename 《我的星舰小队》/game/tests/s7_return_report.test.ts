// 第2.5块·块1：回港报告聚合单测（GDD S10.10 / S13 #1）。真实样例配置建 model，不改磁盘表。
// 覆盖：全空不弹、三段聚合（离线/巡逻/打捞）、打捞奖励确定性预掷（重建同结果）、进行中任务不入报告、
// 领取软货币（单倍/翻倍·只翻离线+巡逻）、钱包脏键护栏、移除已收任务不误伤进行中。
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineModel, createDefaultS7MainlineProgress } from '../assets/scripts/core/s7/S7MainlineProgress';
import { createDefaultS7BuildingState, unlockBuilding, bumpBuildingLevel } from '../assets/scripts/core/s7/S7BuildingState';
import { createDefaultS7Population } from '../assets/scripts/core/s7/S7Population';
import { createDefaultS7Salvage, S7SalvageState } from '../assets/scripts/core/s7/S7SalvageState';
import { DEFAULT_S7_SALVAGE_CONFIG } from '../assets/scripts/core/s7/S7SalvageConfig';
import { S7_HABITAT_BUILDING_ID } from '../assets/scripts/core/s7/S7OfflineSettlement';
import { OFFLINE_BASE_RATE_PER_HOUR } from '../assets/scripts/core/s7/S7OfflineProduction';
import { PATROL_BASE_RATE_PER_HOUR } from '../assets/scripts/core/s7/S7PatrolProduction';
import { createDefaultS7ResourceState } from '../assets/scripts/save/S7SaveService';
import {
  buildS7ReturnReport,
  claimReturnReportCurrencies,
  removeClaimedSalvageMissions,
} from '../assets/scripts/core/s7/S7ReturnReport';

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
const NOW = 1_700_000_000_000;

const habitatAt = (lv: number) => {
  const b = createDefaultS7BuildingState();
  if (lv >= 1) {
    unlockBuilding(b, S7_HABITAT_BUILDING_ID);
    for (let i = 1; i < lv; i += 1) bumpBuildingLevel(b, S7_HABITAT_BUILDING_ID);
  }
  return b;
};
const progressWith = (ids: string[]) => {
  const p = createDefaultS7MainlineProgress();
  p.clearedNodeIds = [...ids];
  return p;
};
/** 加一个打捞任务（endTime 由 doneAgoMs 控制：正=已完成，负=还在进行）。 */
const withMission = (s: S7SalvageState, id: string, doneAgoMs: number): S7SalvageState => {
  s.missions.push({ id, tier: 'common', hours: 2, startTime: NOW - 3 * HOUR_MS, endTime: NOW - doneAgoMs });
  return s;
};

describe('块1 · buildS7ReturnReport', () => {
  it('全空（刚上线 lastOnline=now、无打捞）：hasAny=false → 不弹', () => {
    const rep = buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith([]),
      createDefaultS7Salvage(), DEFAULT_S7_SALVAGE_CONFIG, NOW, NOW,
    );
    expect(rep.hasAny).toBe(false);
    expect(rep.salvage).toEqual([]);
  });

  it('星域档 0：离线段照常（基础产率）、巡逻段全零（未通关星域不巡逻）', () => {
    const rep = buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith([]),
      createDefaultS7Salvage(), DEFAULT_S7_SALVAGE_CONFIG, NOW - HOUR_MS, NOW,
    );
    expect(rep.offline.gains.starOre).toBe(OFFLINE_BASE_RATE_PER_HOUR.starOre);
    expect(rep.patrol.hasGains).toBe(false);
    expect(rep.hasAny).toBe(true);
  });

  it('星域档 1（n060 通关）：巡逻段 = 基础×1.6 与离线同窗口；离线段吃同一系数', () => {
    const rep = buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith(['n060']),
      createDefaultS7Salvage(), DEFAULT_S7_SALVAGE_CONFIG, NOW - HOUR_MS, NOW,
    );
    expect(rep.patrol.gains.hullAlloy).toBe(Math.floor(PATROL_BASE_RATE_PER_HOUR.hullAlloy * 1.6));
    expect(rep.patrol.gains.starCargo).toBe(Math.floor(PATROL_BASE_RATE_PER_HOUR.starCargo * 1.6));
    // 离线同系数：星矿 = 300 × 1.6 ×（1+居住舱lv1加成0%）
    expect(rep.offline.gains.starOre).toBe(Math.floor(OFFLINE_BASE_RATE_PER_HOUR.starOre * 1.6));
    expect(rep.elapsedSeconds).toBe(3600);
  });

  it('打捞：只收已完成任务；奖励确定性预掷——同状态重建两次结果一致；进行中任务不入报告', () => {
    const salvage = createDefaultS7Salvage();
    withMission(salvage, 'sv1', 10_000); // 已完成
    withMission(salvage, 'sv2', -HOUR_MS); // 还有 1h
    const rep1 = buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith([]),
      salvage, DEFAULT_S7_SALVAGE_CONFIG, NOW, NOW,
    );
    expect(rep1.salvage).toHaveLength(1);
    expect(rep1.salvage[0].missionId).toBe('sv1');
    expect(rep1.salvage[0].rewards.length).toBeGreaterThan(0);
    expect(rep1.hasAny).toBe(true); // 只有打捞也要弹
    const rep2 = buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith([]),
      salvage, DEFAULT_S7_SALVAGE_CONFIG, NOW, NOW,
    );
    expect(rep2.salvage[0].rewards).toEqual(rep1.salvage[0].rewards); // 种子=id+endTime → 重进不换奖
    expect(salvage.missions).toHaveLength(2); // 建报告是纯函数：不动任务列表
  });
});

describe('块1 · claimReturnReportCurrencies / removeClaimedSalvageMissions', () => {
  const buildTier1Report = () =>
    buildS7ReturnReport(
      model, habitatAt(1), createDefaultS7Population(), progressWith(['n060']),
      createDefaultS7Salvage(), DEFAULT_S7_SALVAGE_CONFIG, NOW - HOUR_MS, NOW,
    );

  it('单倍领取：离线+巡逻逐键入账，返回汇总=实际入账', () => {
    const rep = buildTier1Report();
    const res = createDefaultS7ResourceState() as unknown as Record<string, number>;
    const total = claimReturnReportCurrencies(res, rep, false);
    expect(res.starOre).toBe(rep.offline.gains.starOre);
    expect(res.hullAlloy).toBe(rep.offline.gains.hullAlloy + rep.patrol.gains.hullAlloy);
    expect(res.starCargo).toBe(rep.patrol.gains.starCargo);
    expect(total.starOre).toBe(rep.offline.gains.starOre);
    expect(total.hullAlloy).toBe(rep.offline.gains.hullAlloy + rep.patrol.gains.hullAlloy);
  });

  it('翻倍领取：离线+巡逻全部 ×2（S13 #1 只翻软货币段）', () => {
    const rep = buildTier1Report();
    const res = createDefaultS7ResourceState() as unknown as Record<string, number>;
    claimReturnReportCurrencies(res, rep, true);
    expect(res.starOre).toBe(rep.offline.gains.starOre * 2);
    expect(res.hullAlloy).toBe((rep.offline.gains.hullAlloy + rep.patrol.gains.hullAlloy) * 2);
    expect(res.starCargo).toBe(rep.patrol.gains.starCargo * 2);
  });

  it('钱包脏键护栏：resources 缺某键则该键跳过不报错（与 applyOfflineGains 同口径）', () => {
    const rep = buildTier1Report();
    const res: Record<string, number> = { starOre: 0 }; // 只有星矿键
    const total = claimReturnReportCurrencies(res, rep, false);
    expect(res.starOre).toBe(rep.offline.gains.starOre);
    expect(Object.keys(res)).toEqual(['starOre']); // 不凭空造键
    expect(total.hullAlloy).toBeUndefined(); // 没入账就不进汇总
  });

  it('removeClaimedSalvageMissions：按 id 精确移除已收任务，进行中的不动；缺失 id 不计数', () => {
    const salvage = createDefaultS7Salvage();
    withMission(salvage, 'sv1', 10_000);
    withMission(salvage, 'sv2', -HOUR_MS);
    const removed = removeClaimedSalvageMissions(salvage, ['sv1', 'sv_ghost']);
    expect(removed).toBe(1);
    expect(salvage.missions.map((m) => m.id)).toEqual(['sv2']);
  });
});
