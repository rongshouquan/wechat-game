// 回港报告（第2.5块·块1，纯 TS，不依赖 cc）：GDD-v2.0 S10.10——上线唯一开场聚合弹窗的数据层。
// 聚合三路：离线产出（星矿为主·复用 S7OfflineSettlement）+ 巡逻收益（S7PatrolProduction）+ 已完成打捞。
//
// 关键口径：
// - 打捞奖励在"建报告"时用确定性种子 report_<missionId>_<endTime> 预掷——展示什么就发什么；
//   杀进程重进后重建报告，同任务同种子 → 同结果（不会换奖）。领取时应用侧逐条入账（复用 applySalvageReward
//   的既有 switch，覆盖 船体/插件/宝箱/人口 等非钱包奖励），并 removeClaimedSalvageMissions 移除任务。
// - 翻倍规则（S13 #1）：只翻 离线+巡逻 的软货币；打捞收益（含其中的资源行）一律不翻。
// - 报告"必领才关"（UI 铁律，防丢奖）；领取后调用方 persist（persist 会把 lastOnlineTime 刷成 now 关窗），
//   同一窗口不会重复结算。
// - 每日翻倍上限/按钮三态/广告券：块5 起统一走 S7AdPointPolicy（S13 决策①：每日 1 次），本模块只持点位 id。

import { S7MainlineModel, S7MainlineProgressState } from './S7MainlineProgress';
import { S7BuildingState, getBuildingLevel } from './S7BuildingState';
import { S7PopulationState, residentStorageExtensionHours } from './S7Population';
import { habitatStaffCap } from './S7BuildingEffects';
import { computeS7OfflineSettlement, S7OfflineSettlement, S7_HABITAT_BUILDING_ID } from './S7OfflineSettlement';
import { computePatrolGains, S7PatrolResult } from './S7PatrolProduction';
import { S7SalvageState } from './S7SalvageState';
import { S7BeaconTier, S7SalvageConfig, S7SalvageReward } from './S7SalvageConfig';
import { isSalvageDone, rollSalvageRewards } from './S7SalvageService';
import { S7AutoBattleRng } from './S7AutoBattleRng';

/** 回港报告翻倍广告点位 id（S13.2 #1；每日上限见 S7AdPointPolicy.S7_AD_POINT_DAILY_LIMITS）。 */
export const RETURN_REPORT_DOUBLE_AD_POINT = 'return_report_double';
/** #1 回港翻倍倍率 = ×1.5（Ron 2026-07-07 拍A 定案·B2 削峰 ×2→×1.5·机器真源 PARAMS.ads.offlineDoubleMult）。 */
export const RETURN_REPORT_DOUBLE_MULT = 1.5;

/** 报告里一条已完成打捞（奖励已预掷·确定性）。 */
export interface S7ReturnReportSalvageEntry {
  missionId: string;
  tier: S7BeaconTier;
  hours: number;
  rewards: S7SalvageReward[];
}

export interface S7ReturnReportData {
  /** 实际离开秒数（未截断，展示"离开了多久"）。 */
  elapsedSeconds: number;
  /** 离线产出段（星矿为主）。 */
  offline: S7OfflineSettlement;
  /** 巡逻战报段（合金/驾驶记录/星贝小额）。 */
  patrol: S7PatrolResult;
  /** 打捞入港段（已完成任务 + 预掷奖励）。 */
  salvage: S7ReturnReportSalvageEntry[];
  /** 三段任一有货 → 弹报告；全空不弹。 */
  hasAny: boolean;
}

/**
 * 建回港报告（纯函数，不改任何入参状态）：三段各自结算 + 已完成打捞预掷奖励。
 * 打捞种子绑 missionId+endTime：同任务重建结果一致（杀进程重进不换奖）。
 */
export function buildS7ReturnReport(
  model: S7MainlineModel,
  buildings: S7BuildingState,
  population: S7PopulationState,
  progress: S7MainlineProgressState,
  salvage: S7SalvageState,
  salvageConfig: S7SalvageConfig,
  lastOnlineTime: number,
  now: number,
): S7ReturnReportData {
  const offline = computeS7OfflineSettlement(model, buildings, population, progress, lastOnlineTime, now);
  const habitatLevel = getBuildingLevel(buildings, S7_HABITAT_BUILDING_ID);
  const patrol = computePatrolGains(offline.elapsedSeconds, {
    clearedStarfieldTier: model.clearedStarfieldTier(progress.clearedNodeIds),
    habitatLevel,
    extraStorageHours: residentStorageExtensionHours(population.residents, habitatStaffCap(habitatLevel)),
  });
  const entries: S7ReturnReportSalvageEntry[] = [];
  for (const m of salvage.missions) {
    if (!isSalvageDone(m, now)) continue;
    entries.push({
      missionId: m.id,
      tier: m.tier,
      hours: m.hours,
      rewards: rollSalvageRewards(salvageConfig, m.tier, m.hours, new S7AutoBattleRng(`report_${m.id}_${m.endTime}`), getBuildingLevel(buildings, 'bld_salvage_port')),
    });
  }
  return {
    elapsedSeconds: offline.elapsedSeconds,
    offline,
    patrol,
    salvage: entries,
    hasAny: offline.hasGains || patrol.hasGains || entries.length > 0,
  };
}

/**
 * 领取报告的软货币部分（离线 + 巡逻；doubled=看广告加成 ×1.5·只作用于这两段，S13 #1）。
 * 倍率 ×1.5 = Ron 2026-07-07 拍A 定案（旧 ×2 作废）；金额四舍五入入账。
 * 只加钱包里已有的键（防脏键污染，与 applyOfflineGains 同口径）；返回实际入账汇总（供 UI 飘字/文案）。
 * 打捞段不在此处理——由应用侧逐条 applySalvageReward（含非钱包奖励）。
 */
export function claimReturnReportCurrencies(
  resources: Record<string, number>,
  report: S7ReturnReportData,
  doubled: boolean,
): Record<string, number> {
  const mult = doubled ? RETURN_REPORT_DOUBLE_MULT : 1;
  const total: Record<string, number> = {};
  const addAll = (gains: Record<string, number>): void => {
    for (const key of Object.keys(gains)) {
      const amt = Math.round(gains[key] * mult);
      if (!Object.prototype.hasOwnProperty.call(resources, key)) continue;
      if (typeof amt === 'number' && Number.isFinite(amt) && amt > 0) {
        resources[key] += amt;
        total[key] = (total[key] ?? 0) + amt;
      }
    }
  };
  addAll(report.offline.gains);
  addAll(report.patrol.gains);
  return total;
}

/** 领取后移除已收的打捞任务（按 id 精确移除，不碰进行中的）；返回实际移除数。 */
export function removeClaimedSalvageMissions(state: S7SalvageState, missionIds: string[]): number {
  let removed = 0;
  for (const id of missionIds) {
    const idx = state.missions.findIndex((m) => m.id === id);
    if (idx >= 0) {
      state.missions.splice(idx, 1);
      removed += 1;
    }
  }
  return removed;
}
