// 阶段一 D-step1：信标打捞引擎单测——
//   开打(占队位/校验) · 剩余/完成判定 · 收菜结算(必得+概率发现+单次≤1+护栏) · 广告加速(按档减时/每日上限/跨天重置) · 脏档规范化。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_SALVAGE_CONFIG, S7SalvageConfig } from '../assets/scripts/core/s7/S7SalvageConfig';
import { createDefaultS7Salvage, normalizeS7Salvage } from '../assets/scripts/core/s7/S7SalvageState';
import {
  startSalvage, collectSalvage, salvageAdSpeedup, rollSalvageRewards,
  salvageRemainingMs, isSalvageDone, salvageTeamLimit, salvageDayKey,
} from '../assets/scripts/core/s7/S7SalvageService';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const T = 100 * DAY; // 基准时刻（整天·便于跨天测）
const rng = () => new S7AutoBattleRng('salvage-test');
function cfg(overrides: Partial<S7SalvageConfig> = {}): S7SalvageConfig {
  return { ...DEFAULT_S7_SALVAGE_CONFIG, ...overrides };
}

describe('D-step1 · 开打 / 队位 / 计时', () => {
  it('salvageTeamLimit = 打捞港等级队数（lv1→1·lv0→0）', () => {
    expect(salvageTeamLimit(0)).toBe(0);
    expect(salvageTeamLimit(1)).toBe(1);
  });

  it('startSalvage：合法则建任务·占队位·endTime=now+时长；满队位→no_team_slot', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'rare', 8, 1, T);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mission.id).toBe('sv1');
      expect(r.mission.endTime).toBe(T + 8 * HOUR);
      expect(s.missions).toHaveLength(1);
    }
    // 打捞港 lv1 = 1 队，已满 → 第二趟拒绝。
    expect(startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T)).toMatchObject({ ok: false, reason: 'no_team_slot' });
  });

  it('startSalvage：非法时长/档拒绝', () => {
    const s = createDefaultS7Salvage();
    expect(startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 5, 1, T)).toMatchObject({ ok: false, reason: 'bad_hours' });
    // @ts-expect-error 故意传非法档
    expect(startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'mythic', 2, 1, T)).toMatchObject({ ok: false, reason: 'bad_tier' });
  });

  it('剩余/完成判定', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(salvageRemainingMs(r.mission, T)).toBe(2 * HOUR);
    expect(isSalvageDone(r.mission, T)).toBe(false);
    expect(isSalvageDone(r.mission, T + 2 * HOUR)).toBe(true);
    expect(salvageRemainingMs(r.mission, T + 3 * HOUR)).toBe(0); // 不为负
  });
});

describe('D-step1 · 收菜结算', () => {
  it('未到点收菜→not_done；不存在→not_found', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(collectSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, T + HOUR, rng())).toMatchObject({ ok: false, reason: 'not_done' });
    expect(collectSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'svX', T + 3 * HOUR, rng())).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('到点收菜→出奖 + 移除任务', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'rare', 8, 1, T);
    if (!r.ok) throw new Error('start failed');
    const c = collectSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, T + 8 * HOUR, rng());
    expect(c.ok).toBe(true);
    expect(s.missions).toHaveLength(0); // 收完移除
    if (c.ok) expect(c.rewards.length).toBeGreaterThan(0);
  });

  it('必得：每趟必有星矿+星贝+1种通用碎片(舰/员其一)；稀有档额外保底干货', () => {
    const rewards = rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'rare', 2, rng());
    const resIds = rewards.filter((x) => x.kind === 'resource').map((x: any) => x.resourceId);
    expect(resIds).toContain('starOre');
    expect(resIds).toContain('starCargo');
    // 通用碎片 1 种（舰 or 员，至少其一在）。
    expect(resIds.some((id) => id === 'shipBlueprint' || id === 'pilotShardUniversal')).toBe(true);
    // 稀有保底干货=星核碎片（占位）。
    expect(resIds).toContain('coreFrag');
  });

  it('时间收益递减：8h 软货币 > 2h，但不足 4×（递减）', () => {
    const ore = (hours: number) => {
      const r = rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'common', hours, rng());
      return (r.find((x) => x.kind === 'resource' && (x as any).resourceId === 'starOre') as any).amount;
    };
    const o2 = ore(2), o8 = ore(8);
    expect(o8).toBeGreaterThan(o2);
    expect(o8).toBeLessThan(o2 * 4); // 递减（yieldMult 2.8 < 4）
  });

  it('护栏：完整星核不进打捞（产出永不含 fullCore）·完整星舰只走 ship_body(C阶)', () => {
    // 多次掷验：史诗 24h（最易出稀有项）也不出 fullCore。
    for (let i = 0; i < 30; i += 1) {
      const r = rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'epic', 24, new S7AutoBattleRng(`gu${i}`));
      expect(r.some((x) => x.kind === 'resource' && (x as any).resourceId === 'fullCore')).toBe(false);
    }
  });

  it('插件每品质单次≤1：普通/稀有 24h 长趟也不会刷出多个同品质插件（Ron 反馈的回归守门）', () => {
    const countQ = (rewards: ReturnType<typeof rollSalvageRewards>, q: string) =>
      rewards.filter((x) => x.kind === 'plugin' && (x as any).quality === q).length;
    for (let i = 0; i < 40; i += 1) {
      // 普通 24h（多掷骰）→ 精良 ≤1
      expect(countQ(rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'common', 24, new S7AutoBattleRng(`c${i}`)), 'fine')).toBeLessThanOrEqual(1);
      // 稀有 24h → 优秀 ≤1
      expect(countQ(rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'rare', 24, new S7AutoBattleRng(`r${i}`)), 'superior')).toBeLessThanOrEqual(1);
      // 史诗 24h → 传奇 ≤1 且 优秀 ≤1（同档可各 1，但同品质不重复）
      const epic = rollSalvageRewards(DEFAULT_S7_SALVAGE_CONFIG, 'epic', 24, new S7AutoBattleRng(`e${i}`));
      expect(countQ(epic, 'legendary')).toBeLessThanOrEqual(1);
      expect(countQ(epic, 'superior')).toBeLessThanOrEqual(1);
    }
  });

  it('单次≤1：居民/工人/货舱/传奇插件/完整星舰 一趟最多各 1（构造高权重必中验证去重）', () => {
    // 专门配一档：发现表只有 1 个 cap1 居民项 + 大量掷骰 → 应只出 1 个居民。
    const c = cfg({
      tiers: {
        ...DEFAULT_S7_SALVAGE_CONFIG.tiers,
        common: {
          baseStarOre: 0, baseStarCargo: 0, universalShardBase: 0, guaranteedExtra: [],
          baseRolls: 20, perHourRolls: 0,
          discovery: [{ reward: { kind: 'population', pop: 'resident', amount: 1 }, weight: 100, cap1: true }],
        },
      },
    });
    const r = rollSalvageRewards(c, 'common', 2, rng());
    const residents = r.filter((x) => x.kind === 'population' && (x as any).pop === 'resident');
    expect(residents).toHaveLength(1); // 20 次掷骰也只出 1 个（单次≤1）
  });

  it('资源同类合并：多次掷到同一资源 → manifest 内合并成一条求和', () => {
    const c = cfg({
      tiers: {
        ...DEFAULT_S7_SALVAGE_CONFIG.tiers,
        common: {
          baseStarOre: 0, baseStarCargo: 0, universalShardBase: 0, guaranteedExtra: [],
          baseRolls: 5, perHourRolls: 0,
          discovery: [{ reward: { kind: 'resource', resourceId: 'coreFrag', amount: 2 }, weight: 100 }],
        },
      },
    });
    const r = rollSalvageRewards(c, 'common', 2, rng());
    const frags = r.filter((x) => x.kind === 'resource' && (x as any).resourceId === 'coreFrag');
    expect(frags).toHaveLength(1);
    expect((frags[0] as any).amount).toBe(10); // 5 次 ×2
  });
});

describe('D-step1 · 广告加速', () => {
  it('按档固定减时(2h档减30min)·返回剩余/已用/上限', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    const sp = salvageAdSpeedup(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, 1, T);
    expect(sp.ok).toBe(true);
    if (sp.ok) {
      expect(sp.remainingMs).toBe(2 * HOUR - 30 * 60_000); // 减 30 分钟
      expect(sp.usedToday).toBe(1);
      expect(sp.dailyLimit).toBe(3); // 打捞港 lv1 → 基础 3 次
    }
  });

  // 用「小减时」配置，使多次加速不把任务提前减到完成（隔离每日上限逻辑·避免误判 already_done）。
  const smallCut = (): S7SalvageConfig => cfg({ adSpeedup: { ...DEFAULT_S7_SALVAGE_CONFIG.adSpeedup, reduceMinutesByHours: { 2: 1, 8: 1, 24: 1 } } });

  it('每日上限：用满拒绝(daily_limit)；高级打捞港(lv≥4)上限 5', () => {
    const c = smallCut();
    const s = createDefaultS7Salvage();
    startSalvage(s, c, 'epic', 24, 1, T); // 24h 任务·每次只减 1 分钟 → 多次加速仍在进行
    const id = s.missions[0].id;
    for (let i = 0; i < 3; i += 1) expect(salvageAdSpeedup(s, c, id, 1, T).ok).toBe(true);
    expect(salvageAdSpeedup(s, c, id, 1, T)).toMatchObject({ ok: false, reason: 'daily_limit' }); // lv1 上限 3
    // 高级打捞港：上限 5（同一天已用 3 → 还能再 2 次，第 6 次满）。
    expect(salvageAdSpeedup(s, c, id, 4, T).ok).toBe(true);
    expect(salvageAdSpeedup(s, c, id, 4, T).ok).toBe(true);
    expect(salvageAdSpeedup(s, c, id, 4, T)).toMatchObject({ ok: false, reason: 'daily_limit' });
  });

  it('跨天重置加速次数', () => {
    const c = smallCut();
    const s = createDefaultS7Salvage();
    const start = T + 20 * HOUR; // 当日(day=floor(T/DAY))内开打·24h 任务跨到次日仍在进行
    startSalvage(s, c, 'epic', 24, 1, start);
    const id = s.missions[0].id;
    for (let i = 0; i < 3; i += 1) salvageAdSpeedup(s, c, id, 1, start);
    expect(salvageAdSpeedup(s, c, id, 1, start).ok).toBe(false); // 当天满
    const nextDay = T + DAY + HOUR; // 次日·任务(end≈start+24h)仍在进行
    expect(salvageAdSpeedup(s, c, id, 1, nextDay).ok).toBe(true); // 次日重置
    expect(s.adSpeedup.count).toBe(1);
  });

  it('加速：任务不存在/已到点 拒绝', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(salvageAdSpeedup(s, DEFAULT_S7_SALVAGE_CONFIG, 'svX', 1, T)).toMatchObject({ ok: false, reason: 'not_found' });
    expect(salvageAdSpeedup(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, 1, T + 3 * HOUR)).toMatchObject({ ok: false, reason: 'already_done' });
  });

  it('salvageDayKey 按天取整', () => {
    expect(salvageDayKey(0)).toBe(0);
    expect(salvageDayKey(DAY - 1)).toBe(0);
    expect(salvageDayKey(DAY)).toBe(1);
  });
});

describe('D-step1 · 规范化(防脏档)', () => {
  it('丢非法任务(坏档/坏时长/空id/重复id)、nextSeq 守护、加速计数非负', () => {
    const s = normalizeS7Salvage({
      missions: [
        { id: 'sv1', tier: 'rare', hours: 8, startTime: 1, endTime: 2 },
        { id: 'sv1', tier: 'common', hours: 2, startTime: 0, endTime: 1 }, // 重复 id → 丢
        { id: 'sv5', tier: 'mythic', hours: 2, startTime: 0, endTime: 1 }, // 坏档 → 丢
        { id: 'sv6', tier: 'common', hours: 5, startTime: 0, endTime: 1 }, // 坏时长 → 丢
        { id: '', tier: 'common', hours: 2, startTime: 0, endTime: 1 },    // 空 id → 丢
      ],
      nextSeq: 1,
      adSpeedup: { dayKey: 7, count: -3 },
    });
    expect(s.missions.map((m) => m.id)).toEqual(['sv1']);
    expect(s.nextSeq).toBe(2); // 守护 > sv1
    expect(s.adSpeedup).toEqual({ dayKey: 7, count: 0 }); // 负 → 0
  });

  it('非对象 → 默认空', () => {
    expect(normalizeS7Salvage(null)).toEqual(createDefaultS7Salvage());
  });
});
