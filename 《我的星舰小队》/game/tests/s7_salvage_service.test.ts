// 信标打捞引擎单测（步5 收尾批重定基·初值表 v0.7 打捞表终值）——
// 重定基总说明（旧→新→为什么对）：
//   ① 队数 lv1=1 → lv1=3（细案④ 3/4/5·原 1/2/3 作废）；
//   ② 旧"加权单选掷骰(baseRolls+perHour 线性)" → 双线期望值抽签（经济线/惊喜线·掷骰数按时长档表·
//     期望逐类==尺子 rolls×rollEV·"单次≤1"由期望 <1 天然满足=Ron 2026-06-20 护栏保持）；
//   ③ 必得 100/30/4 占位 → 30/14/1.5 ×时长档倍率{1,2.2,3.8}（v0.7）+ 24h 守恒刀 ×0.72（细案④队数守恒）；
//   ④ 完整星舰 ship_body 奖励类型退役（v0.7 打捞表无此项·高稀有走信标档分层）。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import { DEFAULT_S7_SALVAGE_CONFIG, S7SalvageReward } from '../assets/scripts/core/s7/S7SalvageConfig';
import { createDefaultS7Salvage, normalizeS7Salvage } from '../assets/scripts/core/s7/S7SalvageState';
import {
  startSalvage, collectSalvage, salvageAdComplete, rollSalvageRewards,
  salvageRemainingMs, isSalvageDone, salvageTeamLimit,
} from '../assets/scripts/core/s7/S7SalvageService';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const T = 100 * DAY; // 基准时刻（整天·便于跨天测）
const rng = (seed = 'salvage-test') => new S7AutoBattleRng(seed);
const CFG = DEFAULT_S7_SALVAGE_CONFIG;

function resAmount(rewards: S7SalvageReward[], id: string): number {
  const row = rewards.find((r) => r.kind === 'resource' && r.resourceId === id);
  return row && row.kind === 'resource' ? row.amount : 0;
}

describe('步5 · 打捞表终值对表（v0.7）', () => {
  it('时长档倍率 {1,2.2,3.8}·守恒刀 0.72 只落 h24·加速券价 150', () => {
    expect(CFG.timeMult).toEqual({ h2: 1, h8: 2.2, h24: 3.8 });
    expect(CFG.yieldScale).toBe(0.72);
    expect(CFG.yieldScaleDur).toBe('h24');
    expect(CFG.accelPriceStarCargo).toBe(150);
  });

  it('三档必得/掷骰/期望表==尺子 PARAMS.salvage（抽验关键值）', () => {
    expect(CFG.tiers.common.ore).toBe(30);
    expect(CFG.tiers.common.cargo).toBe(14);
    expect(CFG.tiers.common.universal).toBe(1.5);
    expect(CFG.tiers.common.rolls).toEqual({ h2: 1.6, h8: 3.8, h24: 8.2 });
    expect(CFG.tiers.common.econEV.coreFrag).toBe(0.004);
    expect(CFG.tiers.rare.fixed.coreFrag).toBe(0.25);
    expect(CFG.tiers.rare.econEV.starGem).toBe(0.015);
    expect(CFG.tiers.epic.fixed).toEqual({ coreFrag: 0.5, starGem: 0.5 });
    expect(CFG.tiers.epic.surpriseEV.legendaryPlugin).toBe(0.035);
  });
});

describe('D-step1 · 开打 / 队位 / 计时', () => {
  it('salvageTeamLimit = 打捞港等级队数（lv1→3·lv0→0·细案④）', () => {
    expect(salvageTeamLimit(0)).toBe(0);
    expect(salvageTeamLimit(1)).toBe(3); // 旧 1 → 3（细案④队数拍板）
    expect(salvageTeamLimit(7)).toBe(5);
  });

  it('startSalvage：合法则建任务·占队位·endTime=now+时长；满队位→no_team_slot', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, CFG, 'rare', 8, 1, T);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mission.id).toBe('sv1');
      expect(r.mission.endTime).toBe(T + 8 * HOUR);
      expect(s.missions).toHaveLength(1);
    }
    // 打捞港 lv1 = 3 队：再开两趟占满，第四趟拒绝（重定基：旧 1 队满位场景 → 3 队）。
    expect(startSalvage(s, CFG, 'common', 2, 1, T).ok).toBe(true);
    expect(startSalvage(s, CFG, 'common', 2, 1, T).ok).toBe(true);
    expect(startSalvage(s, CFG, 'common', 2, 1, T)).toMatchObject({ ok: false, reason: 'no_team_slot' });
  });

  it('startSalvage：非法时长/档拒绝', () => {
    const s = createDefaultS7Salvage();
    expect(startSalvage(s, CFG, 'common', 5, 1, T)).toMatchObject({ ok: false, reason: 'bad_hours' });
    // @ts-expect-error 故意传非法档
    expect(startSalvage(s, CFG, 'mythic', 2, 1, T)).toMatchObject({ ok: false, reason: 'bad_tier' });
  });

  it('剩余/完成判定', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, CFG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(salvageRemainingMs(r.mission, T)).toBe(2 * HOUR);
    expect(isSalvageDone(r.mission, T)).toBe(false);
    expect(isSalvageDone(r.mission, T + 2 * HOUR)).toBe(true);
    expect(salvageRemainingMs(r.mission, T + 3 * HOUR)).toBe(0); // 不为负
  });
});

describe('D-step1 · 收菜结算（双线期望值抽签·终值手推）', () => {
  it('未到点收菜→not_done；不存在→not_found', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, CFG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(collectSalvage(s, CFG, r.mission.id, T + HOUR, rng())).toMatchObject({ ok: false, reason: 'not_done' });
    expect(collectSalvage(s, CFG, 'nope', T + 3 * HOUR, rng())).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('到点收菜→出奖 + 移除任务', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, CFG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    const c = collectSalvage(s, CFG, r.mission.id, T + 2 * HOUR, rng());
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.rewards.length).toBeGreaterThan(0);
    expect(s.missions).toHaveLength(0);
  });

  it('必得终值手推：普通 2h = 星矿30+星贝14+通碎 round(1.5)=2', () => {
    const rewards = rollSalvageRewards(CFG, 'common', 2, rng('base-check'));
    expect(resAmount(rewards, 'starOre')).toBe(30);
    expect(resAmount(rewards, 'starCargo')).toBe(14);
    const uni = resAmount(rewards, 'shipBlueprint') + resAmount(rewards, 'pilotShardUniversal');
    expect(uni).toBeGreaterThanOrEqual(2); // 必得部分（经济线可能再加零星）
  });

  it('必得终值手推：史诗 24h 守恒刀 = 星矿 round(160×3.8×0.72)=438·星贝 round(95×3.8×0.72)=260', () => {
    const rewards = rollSalvageRewards(CFG, 'epic', 24, rng('epic-check'));
    expect(resAmount(rewards, 'starOre')).toBe(438);
    expect(resAmount(rewards, 'starCargo')).toBe(260);
  });

  it('时间收益递减：8h=×2.2（非 4×）；24h=×3.8×0.72（长趟专刀·细案④守恒）', () => {
    const h2 = resAmount(rollSalvageRewards(CFG, 'common', 2, rng('t1')), 'starOre');
    const h8 = resAmount(rollSalvageRewards(CFG, 'common', 8, rng('t2')), 'starOre');
    const h24 = resAmount(rollSalvageRewards(CFG, 'common', 24, rng('t3')), 'starOre');
    expect(h2).toBe(30);
    expect(h8).toBe(66);  // 30×2.2
    expect(h24).toBe(82); // 30×3.8×0.72=82.08→round 82
  });

  it('期望值抽签落地：普通 24h 500 趟核碎聚合 ≈ rolls×EV×守恒刀（采样带验口径）', () => {
    const r = rng('ev-agg');
    let coreFrag = 0;
    const N = 500;
    for (let i = 0; i < N; i += 1) coreFrag += resAmount(rollSalvageRewards(CFG, 'common', 24, r), 'coreFrag');
    const expectEV = 8.2 * 0.72 * 0.004 * N; // ≈11.8
    expect(coreFrag).toBeGreaterThan(expectEV * 0.5);
    expect(coreFrag).toBeLessThan(expectEV * 1.7);
  });

  it('惊喜线吃稀有发现加成：Lv10（+35%+24h 额外骰）插件件数 > Lv1（500 趟聚合·方向验证）', () => {
    const count = (lv: number, seed: string): number => {
      const r = rng(seed);
      let n = 0;
      for (let i = 0; i < 500; i += 1) {
        n += rollSalvageRewards(CFG, 'common', 24, r, lv).filter((x) => x.kind === 'plugin').length;
      }
      return n;
    };
    const lv1 = count(1, 'sp-1');
    const lv10 = count(10, 'sp-10');
    // 期望比 = (9.2×1.35)/(8.2×1) ≈ 1.51——采样验方向与量级（>1.15）。
    expect(lv10).toBeGreaterThan(lv1 * 1.15);
  });

  it('护栏：完整星核不进打捞·单次≤1 天然满足（期望全 <1 → 每类 0/1 条）', () => {
    for (const seed of ['g1', 'g2', 'g3']) {
      const rewards = rollSalvageRewards(CFG, 'epic', 24, rng(seed), 10);
      for (const rw of rewards) {
        if (rw.kind === 'resource') expect(['fullCore', 'flowCore', 'gradCore']).not.toContain(rw.resourceId);
      }
      const capKeys = new Map<string, number>();
      for (const rw of rewards) {
        const key = rw.kind === 'plugin' ? `plugin:${rw.quality}` : rw.kind === 'population' ? `pop:${rw.pop}` : rw.kind === 'chest' ? 'chest' : '';
        if (key) capKeys.set(key, (capKeys.get(key) ?? 0) + 1);
      }
      for (const [, n] of capKeys) expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('资源同类合并：manifest 内同 resourceId 只出现一条', () => {
    for (const seed of ['m1', 'm2', 'm3']) {
      const rewards = rollSalvageRewards(CFG, 'rare', 24, rng(seed), 5);
      const seen = new Set<string>();
      for (const rw of rewards) {
        if (rw.kind !== 'resource') continue;
        expect(seen.has(rw.resourceId)).toBe(false);
        seen.add(rw.resourceId);
      }
    }
  });
});

describe('块5 · 广告完成（S13 #5 改行为：看广告=直接完成当前打捞）', () => {
  it('进行中任务：endTime 置为 now → 立即可收菜（不论剩余时长·24h 刚开也一样）', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'epic', 24, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(isSalvageDone(r.mission, T)).toBe(false);
    const sp = salvageAdComplete(s, r.mission.id, T + 1000);
    expect(sp).toEqual({ ok: true });
    expect(isSalvageDone(r.mission, T + 1000)).toBe(true); // 立即完成
    expect(salvageRemainingMs(r.mission, T + 1000)).toBe(0);
    // 完成后可正常收菜（走既有 collect 链路）。
    expect(collectSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, T + 1000, rng()).ok).toBe(true);
  });

  it('任务不存在/已到点 拒绝（already_done 时按钮本不该出现·防御口径）', () => {
    const s = createDefaultS7Salvage();
    const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T);
    if (!r.ok) throw new Error('start failed');
    expect(salvageAdComplete(s, 'svX', T)).toMatchObject({ ok: false, reason: 'not_found' });
    expect(salvageAdComplete(s, r.mission.id, T + 3 * HOUR)).toMatchObject({ ok: false, reason: 'already_done' });
  });

  it('不做内部每日计数（防假过反例：若还有隐藏上限，同一天连开多趟全加速会被拒）——每日1次统一在 S7AdPointPolicy', () => {
    const s = createDefaultS7Salvage();
    // 打捞港 lv1 = 3 队位（细案④）·同一天三趟全部广告完成，引擎层恒 ok（上限属统一政策层·不在这里）。
    for (let i = 0; i < 3; i += 1) {
      const r = startSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, 'common', 2, 1, T + i);
      if (!r.ok) throw new Error('start failed');
      expect(salvageAdComplete(s, r.mission.id, T + i + 1)).toEqual({ ok: true });
      expect(collectSalvage(s, DEFAULT_S7_SALVAGE_CONFIG, r.mission.id, T + i + 1, rng()).ok).toBe(true);
    }
  });
});

describe('D-step1 · 规范化(防脏档)', () => {
  it('丢非法任务(坏档/坏时长/空id/重复id)、nextSeq 守护、老档遗留 adSpeedup 字段静默丢弃（块5 计数统一走 adDaily）', () => {
    const s = normalizeS7Salvage({
      missions: [
        { id: 'sv1', tier: 'rare', hours: 8, startTime: 1, endTime: 2 },
        { id: 'sv1', tier: 'common', hours: 2, startTime: 0, endTime: 1 }, // 重复 id → 丢
        { id: 'sv5', tier: 'mythic', hours: 2, startTime: 0, endTime: 1 }, // 坏档 → 丢
        { id: 'sv6', tier: 'common', hours: 5, startTime: 0, endTime: 1 }, // 坏时长 → 丢
        { id: '', tier: 'common', hours: 2, startTime: 0, endTime: 1 },    // 空 id → 丢
      ],
      nextSeq: 1,
      adSpeedup: { dayKey: 7, count: 2 }, // 老档遗留字段 → 丢弃不进新形状
    });
    expect(s.missions.map((m) => m.id)).toEqual(['sv1']);
    expect(s.nextSeq).toBe(2); // 守护 > sv1
    expect(s).not.toHaveProperty('adSpeedup');
  });

  it('非对象 → 默认空', () => {
    expect(normalizeS7Salvage(null)).toEqual(createDefaultS7Salvage());
  });
});
