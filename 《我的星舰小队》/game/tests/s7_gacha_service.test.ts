// 抽卡三池引擎单测（步5 收尾批重定基·S10.1 碎片化模型 + 初值表 v0.7 终值）——
// 重定基总说明（旧→新→为什么对）：
//   ① 旧"每抽=选单位·未拥有发本体/已拥有折15"灰盒模型 → 碎片化终值模型（每抽必得随机单位碎片 1-3〔期望 2.0〕+
//     本体线 C7%/B2.5%/A0.8%+垫层·本体带阶级）——S10.1"大概率随机专属碎片"真源口径 + 机器真源 PARAMS.gacha；
//   ② 旧"阶级地板 floorPityDraws=10（灰盒缩小值）·候选=aTier 名单" → 20 抽真概率保底（天然/保底 A 都清计数）·
//     A 本体=开放池随机单位（名单制作废=旧占位分组文案·细表 §13 头注）；
//   ③ 旧"保底重复折 60" → 全部重复体统一折 15（机器真源 dupFoldShards·"60=满A阶"为 v0.1 占位注释非拍板）；
//   ④ 专属兑换阈值 50（灰盒缩小值）→ 200（§10.1 设计值·尺外注记）；
//   ⑤ 新增：免费抽（补给站 Lv4/7）+ 十连九折（Lv10）计费面 + 抽到更高阶=升阶+旧体分解 15（§10.1 原文语义）。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import {
  DEFAULT_S7_GACHA_CONFIG,
  S7GachaConfig,
  nonExclusiveShipIds,
  bodyRankToShipTier,
  bodyRankToPilotStar,
} from '../assets/scripts/core/s7/S7GachaConfig';
import {
  createDefaultS7GachaState,
  normalizeS7GachaState,
  freePullsLeftToday,
  spendFreePulls,
} from '../assets/scripts/core/s7/S7GachaState';
import {
  gachaDayIndex,
  exclusivePeriodOf,
  currentExclusiveShipId,
  openCategoryIds,
  openUnitIds,
  drawGachaOnce,
  drawGachaMany,
  refreshGachaToDay,
  availableExchangeBoxes,
  claimExchangeBox,
  exclusiveShardResourceId,
} from '../assets/scripts/core/s7/S7GachaService';
import { createDefaultS7Squad, grantShip, isShipOwned } from '../assets/scripts/core/s7/S7Squad';
import { createDefaultS7UnitTierState, getShipTier, setShipTier, getPilotStar } from '../assets/scripts/core/s7/S7UnitTierState';
import { createDefaultS7ExclusiveShardInventory, getExclusiveShardCount } from '../assets/scripts/core/s7/S7ExclusiveShardInventory';
import { createDefaultS7Mailbox } from '../assets/scripts/core/s7/S7Mailbox';

const DAY_MS = 86_400_000;
/** 造测试配置：DEFAULT 的浅覆盖。 */
function cfg(overrides: Partial<S7GachaConfig> = {}): S7GachaConfig {
  return { ...DEFAULT_S7_GACHA_CONFIG, ...overrides };
}
const rng = (seed = 'gacha-test-seed') => new S7AutoBattleRng(seed);
/** 一套抽卡上下文（state/squad/tiers/shards/mailbox）。 */
function ctx() {
  return {
    state: createDefaultS7GachaState(),
    squad: createDefaultS7Squad(),
    tiers: createDefaultS7UnitTierState(),
    shards: createDefaultS7ExclusiveShardInventory(),
    mailbox: createDefaultS7Mailbox(),
  };
}

describe('C-step1 · 日序与专属轮换', () => {
  it('gachaDayIndex：委托全游戏统一日界（北京凌晨4点重置=UTC+4h 移位）', () => {
    const SHIFT = 14_400_000; // +4h
    expect(gachaDayIndex(0)).toBe(0);
    expect(gachaDayIndex(DAY_MS - SHIFT - 1)).toBe(0); // 北京 03:59:59.999
    expect(gachaDayIndex(DAY_MS - SHIFT)).toBe(1); // 北京 04:00:00.000 起新一日
    expect(gachaDayIndex(DAY_MS * 7 + 123)).toBe(7);
  });

  it('exclusivePeriodOf / currentExclusiveShipId：每 3 天轮换一艘(2 艘交替·名单=占位沿用挂牌)', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect([0, 1, 2].map((d) => exclusivePeriodOf(c, d))).toEqual([0, 0, 0]);
    expect([3, 4, 5].map((d) => exclusivePeriodOf(c, d))).toEqual([1, 1, 1]);
    expect([0, 1, 2].map((d) => currentExclusiveShipId(c, d))).toEqual(['shp10', 'shp10', 'shp10']);
    expect(currentExclusiveShipId(c, 3)).toBe('shp11');
    expect(currentExclusiveShipId(c, 6)).toBe('shp10');
  });

  it('无专属舰配置 → currentExclusiveShipId 返回 null', () => {
    expect(currentExclusiveShipId(cfg({ exclusiveShipIds: [] }), 0)).toBeNull();
  });
});

describe('C-step1 · 当天开放类别 / 单位集（步5 真 20/20 名单）', () => {
  it('openCategoryIds：每天开 2 类、3 天走完一轮 6 类（新定位型分桶）', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect(openCategoryIds(c, 'refit', 0)).toEqual(['rf_assault', 'rf_guard_a']);
    expect(openCategoryIds(c, 'refit', 1)).toEqual(['rf_guard_b', 'rf_artillery']);
    expect(openCategoryIds(c, 'refit', 2)).toEqual(['rf_support', 'rf_engineer']);
    expect(openCategoryIds(c, 'refit', 3)).toEqual(['rf_assault', 'rf_guard_a']); // 回卷
    expect(openCategoryIds(c, 'recruit', 0)).toEqual(['rc_assault_a', 'rc_assault_b']);
  });

  it('openUnitIds：招募/整备=当天开放类别成员；专属池=18 非专属舰+当期专属', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect(openUnitIds(c, 'refit', 0).sort()).toEqual(['shp01', 'shp02', 'shp03', 'shp04', 'shp05', 'shp06']); // 突击4+护卫磐铁2
    const ex0 = openUnitIds(c, 'exclusive', 0);
    expect(ex0).toContain('shp10');
    expect(ex0.sort()).toEqual([...nonExclusiveShipIds(c), 'shp10'].sort());
    expect(nonExclusiveShipIds(c)).toHaveLength(18); // 20 舰 − 2 专属（=机器真源 poolSizeShips 18）
  });

  it('池名单=真 id 全集：招募 20 员（pil01-20）·整备+专属=20 舰（shp01-20）', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    const pilots = c.recruitCategories.flatMap((x) => x.memberIds).sort();
    expect(pilots).toEqual(Array.from({ length: 20 }, (_, i) => `pil${String(i + 1).padStart(2, '0')}`));
    const ships = [...nonExclusiveShipIds(c), ...c.exclusiveShipIds].sort();
    expect(ships).toEqual(Array.from({ length: 20 }, (_, i) => `shp${String(i + 1).padStart(2, '0')}`));
  });
});

describe('步5 · 出货终值钉（对表：运行时值==校准值）', () => {
  it('碎片 1-3/抽（期望 2.0）·本体率 C7%/B2.5%/A0.8%·保底 20·重复折 15·兑换 200', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect(c.shardPerPullMin).toBe(1);
    expect(c.shardPerPullMax).toBe(3);
    expect(c.bodyP).toEqual({ C: 0.07, B: 0.025, A: 0.008 });
    expect(c.pityDraws).toBe(20);
    expect(c.dupFoldShards).toBe(15);
    expect(c.exchangeThreshold).toBe(200);
    expect(c.exchangeOverflowShards).toBe(60);
  });

  it('本体阶级映射：舰 C/B/A=阶 0/1/2·员=1★/2★/3★（"本体阶级=抽卡稀有度"口径）', () => {
    expect([bodyRankToShipTier('C'), bodyRankToShipTier('B'), bodyRankToShipTier('A')]).toEqual([0, 1, 2]);
    expect([bodyRankToPilotStar('C'), bodyRankToPilotStar('B'), bodyRankToPilotStar('A')]).toEqual([1, 2, 3]);
  });
});

describe('C-step1 · 单抽（碎片化模型）', () => {
  it('每抽必得随机开放单位碎片 1-3', () => {
    const { state, squad, tiers, shards } = ctx();
    const o = drawGachaOnce(state, squad, tiers, shards, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 0)!;
    expect(o).not.toBeNull();
    expect(openUnitIds(DEFAULT_S7_GACHA_CONFIG, 'refit', 0)).toContain(o.shardUnitId);
    expect(o.shardAmount).toBeGreaterThanOrEqual(1);
    expect(o.shardAmount).toBeLessThanOrEqual(3);
    expect(getExclusiveShardCount(shards, o.shardUnitId)).toBe(o.shardAmount);
  });

  it('碎片量分布：1-3 均匀·均值≈2（1000 抽窗）', () => {
    const { state, squad, tiers, shards } = ctx();
    const r = rng('shard-dist');
    let sum = 0;
    for (let i = 0; i < 1000; i += 1) {
      const o = drawGachaOnce(state, squad, tiers, shards, DEFAULT_S7_GACHA_CONFIG, r, 'refit', 0)!;
      sum += o.shardAmount;
    }
    expect(sum / 1000).toBeGreaterThan(1.85);
    expect(sum / 1000).toBeLessThan(2.15);
  });

  it('20 抽硬保底：计数 19 时下一抽必出 A 本体（viaPity）且计数清零', () => {
    const { state, squad, tiers, shards } = ctx();
    state.pity.refit = 19;
    const o = drawGachaOnce(state, squad, tiers, shards, DEFAULT_S7_GACHA_CONFIG, rng('pity-hit'), 'refit', 0)!;
    expect(o.body).not.toBeNull();
    expect(o.body!.rank).toBe('A');
    expect(o.body!.viaPity).toBe(true);
    expect(state.pity.refit).toBe(0);
  });

  it('真概率保底：天然 A 也清计数（保底进度条语义）', () => {
    // 垫层拉满让天然 A 好出（测试注入 100% A：bodyP.A=1）——结构断言非分布断言。
    const c = cfg({ bodyP: { C: 0, B: 0, A: 1 } });
    const { state, squad, tiers, shards } = ctx();
    state.pity.refit = 5;
    const o = drawGachaOnce(state, squad, tiers, shards, c, rng(), 'refit', 0)!;
    expect(o.body!.rank).toBe('A');
    expect(o.body!.viaPity).toBe(false); // 天然出的（计数 6<20）
    expect(state.pity.refit).toBe(0);    // 同样清零=真概率保底
  });

  it('新到手本体带阶级：A 本体=舰 A 阶（tier 2）', () => {
    const c = cfg({ bodyP: { C: 0, B: 0, A: 1 } });
    const { state, squad, tiers, shards } = ctx();
    const o = drawGachaOnce(state, squad, tiers, shards, c, rng(), 'refit', 0)!;
    expect(o.body!.result).toBe('new');
    expect(isShipOwned(squad, o.body!.unitId)).toBe(true);
    expect(getShipTier(tiers, o.body!.unitId)).toBe(2);
  });

  it('重复本体折 15；抽到更高阶=升到该阶+旧体分解 15（§10.1"高阶留低阶分解"）', () => {
    const c = cfg({ bodyP: { C: 0, B: 0, A: 1 } });
    const { state, squad, tiers, shards } = ctx();
    // 预置：拥有全部开放单位（C 阶）→ A 本体必是"已拥有但更高阶"→ upgraded+折15。
    for (const id of openUnitIds(c, 'refit', 0)) grantShip(squad, id);
    const o = drawGachaOnce(state, squad, tiers, shards, c, rng(), 'refit', 0)!;
    expect(o.body!.result).toBe('upgraded');
    expect(o.body!.foldShards).toBe(15);
    expect(getShipTier(tiers, o.body!.unitId)).toBe(2); // 升到 A 阶
    // 再抽一次同单位（已 A 阶）→ 纯重复折 15、阶级不再动。
    setShipTier(tiers, o.body!.unitId, 4); // 抬到 SS 阶（高于 A）
    const before = getExclusiveShardCount(shards, o.body!.unitId);
    let dup = null as ReturnType<typeof drawGachaOnce>;
    const r2 = rng('dup-check');
    for (let i = 0; i < 200 && !dup; i += 1) {
      const oo = drawGachaOnce(state, squad, tiers, shards, c, r2, 'refit', 0)!;
      if (oo.body && oo.body.unitId === o.body!.unitId) dup = oo;
    }
    expect(dup).not.toBeNull();
    expect(dup!.body!.result).toBe('dup');
    expect(getShipTier(tiers, o.body!.unitId)).toBe(4); // 不降阶
    expect(getExclusiveShardCount(shards, o.body!.unitId)).toBeGreaterThan(before); // 折 15 入账（另含每抽碎片）
  });

  it('招募池：员本体=星级（3★=A）', () => {
    const c = cfg({ bodyP: { C: 0, B: 0, A: 1 } });
    const { state, squad, tiers, shards } = ctx();
    const o = drawGachaOnce(state, squad, tiers, shards, c, rng(), 'recruit', 0)!;
    expect(o.unitKind).toBe('pilot');
    expect(getPilotStar(tiers, o.body!.unitId)).toBe(3);
  });

  it('A 本体出量受硬保底下界约束（真 RNG 2000 抽：A ≥ floor(n/20)）', () => {
    const { state, squad, tiers, shards } = ctx();
    const r = rng('a-floor');
    let aBodies = 0;
    for (let i = 0; i < 2000; i += 1) {
      const o = drawGachaOnce(state, squad, tiers, shards, DEFAULT_S7_GACHA_CONFIG, r, 'refit', 0)!;
      if (o.body?.rank === 'A') aBodies += 1;
    }
    expect(aBodies).toBeGreaterThanOrEqual(100); // 2000/20=100 硬下界
    expect(aBodies).toBeLessThan(200); // 0.008+1/20≈5.7% 上界余量（防疯出）
  });

  it('空池（配置异常）→ null 不动状态', () => {
    const c = cfg({ refitCategories: [], exclusiveShipIds: [] });
    const { state, squad, tiers, shards } = ctx();
    expect(drawGachaOnce(state, squad, tiers, shards, c, rng(), 'refit', 0)).toBeNull();
    expect(state.pity.refit).toBe(0);
  });
});

describe('C-step1 · 连抽计费（免费抽 + 十连九折=细案⑥）', () => {
  it('连抽扣券：券不足按可支付数抽（免费 0）', () => {
    const { state, squad, tiers, shards, mailbox } = ctx();
    const r = drawGachaMany(state, squad, tiers, shards, mailbox, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 5, 3, 0, 0);
    expect(r.outcomes).toHaveLength(3);
    expect(r.ticketsSpent).toBe(3);
    expect(r.freePullsSpent).toBe(0);
  });

  it('免费抽先花：2 免费+1 券抽 3 次', () => {
    const { state, squad, tiers, shards, mailbox } = ctx();
    const r = drawGachaMany(state, squad, tiers, shards, mailbox, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 3, 10, 0, 0, { freePulls: 2 });
    expect(r.outcomes).toHaveLength(3);
    expect(r.freePullsSpent).toBe(2);
    expect(r.ticketsSpent).toBe(1);
  });

  it('十连整额：补给站 Lv10 九折收 9 券、未满级收 10 券（细案⑥ Lv10 里程碑）', () => {
    const a = ctx();
    const r10 = drawGachaMany(a.state, a.squad, a.tiers, a.shards, a.mailbox, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 10, 20, 0, 0, { supplyLevel: 10 });
    expect(r10.outcomes).toHaveLength(10);
    expect(r10.ticketsSpent).toBe(9); // 九折
    const b = ctx();
    const r9 = drawGachaMany(b.state, b.squad, b.tiers, b.shards, b.mailbox, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 10, 20, 0, 0, { supplyLevel: 9 });
    expect(r9.ticketsSpent).toBe(10); // 未满级原价
  });

  it('免费抽状态记账：跨天自动重置口径', () => {
    const st = createDefaultS7GachaState();
    expect(freePullsLeftToday(st, 100, 2)).toBe(2);
    spendFreePulls(st, 100, 1);
    expect(freePullsLeftToday(st, 100, 2)).toBe(1);
    spendFreePulls(st, 100, 1);
    expect(freePullsLeftToday(st, 100, 2)).toBe(0);
    expect(freePullsLeftToday(st, 101, 2)).toBe(2); // 跨天重置
  });
});

describe('C-step1 · 专属池兑换（阈值 200=§10.1 设计值）', () => {
  it('每抽 +1 进度；满 200 出兑换箱；首箱发当期专属本体、其余溢出折 60', () => {
    const { state, squad, tiers, shards, mailbox } = ctx();
    drawGachaMany(state, squad, tiers, shards, mailbox, DEFAULT_S7_GACHA_CONFIG, rng(), 'exclusive', 10, 10, 0, 0);
    expect(state.exchangeProgress).toBe(10);
    state.exchangeProgress = 401; // 直接置进度（2 箱+零头）
    expect(availableExchangeBoxes(state, DEFAULT_S7_GACHA_CONFIG)).toBe(2);
    const res = claimExchangeBox(state, squad, shards, DEFAULT_S7_GACHA_CONFIG, 0, true);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.exclusiveShipId).toBe('shp10');
      expect(res.result).toBe('exclusive_body');
      expect(res.shardsGained).toBe(60); // 第 2 箱溢出折 60
      expect(res.boxesClaimed).toBe(2);
    }
    expect(isShipOwned(squad, 'shp10')).toBe(true);
  });

  it('轮换补发：跨期未领满格 → 邮件（本体+余格折碎片）·零头清零', () => {
    const { state, squad, tiers, shards, mailbox } = ctx();
    void squad; void tiers; void shards;
    refreshGachaToDay(state, mailbox, DEFAULT_S7_GACHA_CONFIG, 0, 0);
    state.exchangeProgress = 450; // 2 满格+零头
    const r = refreshGachaToDay(state, mailbox, DEFAULT_S7_GACHA_CONFIG, 3, DAY_MS * 3); // 进期 1
    expect(r.rotated).toBe(true);
    expect(r.settledBoxes).toBe(2);
    expect(mailbox.mails).toHaveLength(1);
    const rewards = mailbox.mails[0].rewards;
    expect(rewards[0]).toEqual({ type: 'unit', unitKind: 'ship', unitId: 'shp10' });
    expect(rewards[1]).toEqual({ type: 'resource', resourceId: exclusiveShardResourceId('shp10'), amount: 60 });
    expect(state.exchangeProgress).toBe(0); // 零头清零
  });
});

describe('C-step1 · 状态规范化（步5 新增免费抽字段）', () => {
  it('normalizeS7GachaState：脏值回默认·免费抽字段收纳', () => {
    const raw = {
      pity: { recruit: 3, refit: -1, exclusive: 'x' },
      exchangeProgress: 12.7,
      exchangeClaimed: 99,
      exclusivePeriod: 2,
      exclusiveShipId: 'shp11',
      freePullDayKey: 123,
      freePullsUsed: 2,
    };
    const s = normalizeS7GachaState(raw);
    expect(s.pity).toEqual({ recruit: 3, refit: 0, exclusive: 0 });
    expect(s.exchangeProgress).toBe(0); // 非整数回 0
    expect(s.exchangeClaimed).toBe(0); // 钳 ≤ progress
    expect(s.exclusivePeriod).toBe(2);
    expect(s.exclusiveShipId).toBe('shp11');
    expect(s.freePullDayKey).toBe(123);
    expect(s.freePullsUsed).toBe(2);
  });

  it('默认态：免费抽字段归零', () => {
    const s = createDefaultS7GachaState();
    expect(s.freePullDayKey).toBe(0);
    expect(s.freePullsUsed).toBe(0);
  });
});
