// 信标打捞存档子状态（阶段一 D-step1，纯 TS，不依赖 cc）：v1.0 §10.2 的持久化载体。
//
// 存「进行中的打捞任务 + 今日广告加速次数」：任务异步真实时钟计时(startTime/endTime·ms)，
//   跨会话/离线照走（回来若已到点即可收菜）。打捞队上限由打捞港等级决定(运行时算·不存)。
// 与 S7Mailbox/S7BuildingState 同构：本模块拥有形状 + createDefault/normalize；S7SaveService 组合(v13→v14)。

import { S7BeaconTier } from './S7SalvageConfig';

/** 一个进行中的打捞任务。 */
export interface S7SalvageMission {
  /** 稳定 id `sv{seq}`。 */
  id: string;
  tier: S7BeaconTier;
  /** 时长档（小时·2/8/24）。 */
  hours: number;
  /** 开始时刻（ms）。 */
  startTime: number;
  /** 结束时刻（ms·= startTime + hours×3600000，被广告加速缩短）。 */
  endTime: number;
}

export interface S7SalvageState {
  missions: S7SalvageMission[];
  nextSeq: number;
  /** 今日广告加速：dayKey(全游戏统一日界·北京凌晨4点重置，见 s7DayKey) + 当日已用次数。跨天自动重置。 */
  adSpeedup: { dayKey: number; count: number };
}

export function createDefaultS7Salvage(): S7SalvageState {
  return { missions: [], nextSeq: 1, adSpeedup: { dayKey: -1, count: 0 } };
}

const VALID_TIERS: S7BeaconTier[] = ['common', 'rare', 'epic'];
const VALID_HOURS = [2, 8, 24];
const finiteNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const nonNegInt = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

/** 规范化（防脏档）：任务取合法字段(档/时长合法·时间有限)、id 去重去空；nextSeq 守护大于现有最大序号；加速计数取非负整数。 */
export function normalizeS7Salvage(raw: unknown): S7SalvageState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = createDefaultS7Salvage();
  const seen = new Set<string>();
  if (Array.isArray(src.missions)) {
    for (const m of src.missions) {
      const row = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      const id = row.id;
      if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
      const tier = row.tier as S7BeaconTier;
      if (!VALID_TIERS.includes(tier)) continue;
      const hours = finiteNum(row.hours);
      if (!VALID_HOURS.includes(hours)) continue;
      seen.add(id);
      out.missions.push({ id, tier, hours, startTime: finiteNum(row.startTime), endTime: finiteNum(row.endTime) });
    }
  }
  let nextSeq = typeof src.nextSeq === 'number' && Number.isInteger(src.nextSeq) && src.nextSeq > 0 ? src.nextSeq : 1;
  for (const m of out.missions) {
    const n = /^sv(\d+)$/.exec(m.id);
    if (n) nextSeq = Math.max(nextSeq, parseInt(n[1], 10) + 1);
  }
  out.nextSeq = nextSeq;
  const ad = (src.adSpeedup && typeof src.adSpeedup === 'object' ? src.adSpeedup : {}) as Record<string, unknown>;
  out.adSpeedup = {
    dayKey: typeof ad.dayKey === 'number' && Number.isInteger(ad.dayKey) ? ad.dayKey : -1,
    count: nonNegInt(ad.count),
  };
  return out;
}
