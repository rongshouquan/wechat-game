// 星港悬赏板核心测试（第2.5块·块2，GDD S10.8）：
// 确定性生成 / 品质暗保底 / 积压封顶+居住舱钩子 / 产出口径 / 遇袭 / 卡完成 / 老档折算 / 规范化。
import { describe, it, expect } from 'vitest';
import {
  DAILY_CARDS,
  PITY_DAYS,
  LEGACY_MIGRATION_CAP,
  S7BountyCard,
  S7BountyState,
  AFFIX_COUNT,
  createDefaultS7Bounty,
  generateDayCards,
  refreshBountyBoard,
  bountyBoardCap,
  bountyCardRewards,
  goldPhysicalItem,
  ambushBonusItem,
  settleBountyCard,
  bountyAmbushTriggered,
  bountyAmbushBonus,
  claimBountyAmbushBonus,
  completeBountyCard,
  findBountyCard,
  seedBountyFromLegacyCommissions,
  normalizeExistingBounty,
  normalizeS7Bounty,
} from '../assets/scripts/core/s7/S7StarportBounty';
import { s7DayKey } from '../assets/scripts/core/s7/S7AdDailyCounter';

const POOL = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10', 'a11', 'a12'];
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe('S7StarportBounty - 确定性生成', () => {
  it('同种子（同日界）重跑生成完全相同的 4 张卡', () => {
    const a = generateDayCards(1000, 0, POOL);
    const b = generateDayCards(1000, 0, POOL);
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).toHaveLength(DAILY_CARDS);
  });

  it('每张卡：主题/品质合法 + 词缀条数随品质 + 词缀不重复', () => {
    const { cards } = generateDayCards(1234, 0, POOL);
    for (const c of cards) {
      expect(['escort', 'drill']).toContain(c.theme);
      expect(['bronze', 'silver', 'gold']).toContain(c.quality);
      expect(c.affixIds).toHaveLength(AFFIX_COUNT[c.quality]);
      expect(new Set(c.affixIds).size).toBe(c.affixIds.length); // 一张卡内词缀不重复
      for (const id of c.affixIds) expect(POOL).toContain(id);
    }
  });

  it('不同日界基本会给出不同卡面（抽样）', () => {
    const d1 = JSON.stringify(generateDayCards(1, 0, POOL).cards);
    const d2 = JSON.stringify(generateDayCards(2, 0, POOL).cards);
    expect(d1).not.toBe(d2);
  });
});

describe('S7StarportBounty - 品质暗保底', () => {
  it('连续无金达阈值时本次必出金（跨多日界恒成立）', () => {
    for (let dk = 1; dk <= 60; dk += 1) {
      const { cards, noGoldDays } = generateDayCards(dk, PITY_DAYS - 1, POOL);
      expect(cards.some((c) => c.quality === 'gold')).toBe(true); // 保底触发/自然出金都算
      expect(noGoldDays).toBe(0); // 出金后计数清零
    }
  });

  it('未达阈值且自然无金：计数 +1（不强制出金）', () => {
    // 找一个自然无金的日界（无保底压力）验证计数累加。
    let found = -1;
    for (let dk = 1; dk <= 500 && found < 0; dk += 1) {
      if (!generateDayCards(dk, 0, POOL).cards.some((c) => c.quality === 'gold')) found = dk;
    }
    expect(found).toBeGreaterThan(0); // 一定能找到自然无金的一天
    expect(generateDayCards(found, 0, POOL).noGoldDays).toBe(1); // 无金 → 计数 +1
    // 同一无金日界若已到阈值 → 被强制出金、计数清零。
    const forced = generateDayCards(found, PITY_DAYS - 1, POOL);
    expect(forced.cards.some((c) => c.quality === 'gold')).toBe(true);
    expect(forced.noGoldDays).toBe(0);
  });

  it('自然出金的一天：计数清零', () => {
    let found = -1;
    for (let dk = 1; dk <= 500 && found < 0; dk += 1) {
      if (generateDayCards(dk, 0, POOL).cards.some((c) => c.quality === 'gold')) found = dk;
    }
    expect(found).toBeGreaterThan(0);
    expect(generateDayCards(found, 0, POOL).noGoldDays).toBe(0);
  });

  it('刷板跨天线程暗保底：refreshBountyBoard 逐日 noGoldDays 与手动 generateDayCards 完全一致（反例守卫）', () => {
    // 强反例守卫：若 refreshBountyBoard 没把 noGoldDays 正确线程进/出 generateDayCards（如恒传 0），
    // 则在第 2 个连续无金日，手动=2 而坏实现=1，下面逐日等价断言发散报红。
    // maxManual≥2 保证这条序列确实跨天累积过（否则等价断言太弱、证明不了线程）。
    const st = createDefaultS7Bounty();
    let manualNoGold = 0;
    let maxManual = 0;
    for (let d = 0; d < 60; d += 1) {
      const dk = s7DayKey(NOW + d * DAY);
      manualNoGold = generateDayCards(dk, manualNoGold, POOL).noGoldDays; // 手动逐日线程（对照真源）
      maxManual = Math.max(maxManual, manualNoGold);
      refreshBountyBoard(st, 10, NOW + d * DAY, POOL); // 高居住舱大容量避免封顶干扰
      expect(st.noGoldDays).toBe(manualNoGold); // 逐日必须一致——线程串错在此发散
      expect(st.noGoldDays).toBeLessThan(PITY_DAYS); // 保底封顶（永不达 PITY_DAYS）
    }
    expect(maxManual).toBeGreaterThanOrEqual(2); // 场景确实跨天累积过≥2，等价断言才有力
  });
});

describe('S7StarportBounty - 日刷 / 积压 / 容量', () => {
  it('首次刷出今日 4 张，lastGenDayKey 记当日；同日重进不重刷（确定性·杀进程重进不换卡）', () => {
    const st = createDefaultS7Bounty();
    const first = refreshBountyBoard(st, 0, NOW, POOL);
    expect(first).toBe(true);
    expect(st.cards).toHaveLength(DAILY_CARDS);
    expect(st.lastGenDayKey).toBe(s7DayKey(NOW));
    const snapshot = JSON.parse(JSON.stringify(st.cards));
    const second = refreshBountyBoard(st, 0, NOW + 1000, POOL); // 同日再进
    expect(second).toBe(false);
    expect(st.cards).toEqual(snapshot); // 卡面不变
  });

  it('隔日再刷 +4 张（未做的积压保留）', () => {
    const st = createDefaultS7Bounty();
    refreshBountyBoard(st, 0, NOW, POOL);
    refreshBountyBoard(st, 0, NOW + DAY, POOL);
    expect(st.cards).toHaveLength(8);
  });

  it('积压封顶：多日不做，基础上限 12（掉最旧）', () => {
    const st = createDefaultS7Bounty();
    for (let d = 0; d < 6; d += 1) refreshBountyBoard(st, 0, NOW + d * DAY, POOL);
    expect(st.cards).toHaveLength(12); // 6 天 ×4=24 → 封顶 12
    // 最新一天的卡还在（掉的是最旧）。
    expect(st.cards.some((c) => c.genDayKey === s7DayKey(NOW + 5 * DAY))).toBe(true);
    expect(st.cards.some((c) => c.genDayKey === s7DayKey(NOW))).toBe(false);
  });

  it('居住舱钩子：容量 12 / 16 / 20', () => {
    expect(bountyBoardCap(0)).toBe(12);
    expect(bountyBoardCap(4)).toBe(12);
    expect(bountyBoardCap(5)).toBe(16);
    expect(bountyBoardCap(9)).toBe(16);
    expect(bountyBoardCap(10)).toBe(20);
    expect(bountyBoardCap(15)).toBe(20);
  });

  it('居住舱 Lv10：积压封顶 20', () => {
    const st = createDefaultS7Bounty();
    for (let d = 0; d < 8; d += 1) refreshBountyBoard(st, 10, NOW + d * DAY, POOL);
    expect(st.cards).toHaveLength(20);
  });
});

describe('S7StarportBounty - 产出口径', () => {
  const card = (over: Partial<S7BountyCard>): S7BountyCard => ({
    id: 'c', genDayKey: 0, theme: 'drill', quality: 'bronze', affixIds: [], ...over,
  });

  it('演习=驾驶记录；品质倍率 铜1/金3（tier0 系数 1.0）', () => {
    expect(bountyCardRewards(card({ theme: 'drill', quality: 'bronze' }), 0, false)).toEqual({ pilotToken: 60 });
    expect(bountyCardRewards(card({ theme: 'drill', quality: 'gold' }), 0, false).pilotToken).toBe(180); // 60×3
  });

  it('护航=合金+星贝；完美护航 ×1.25', () => {
    const plain = bountyCardRewards(card({ theme: 'escort', quality: 'bronze' }), 0, false);
    expect(plain.hullAlloy).toBe(80);
    expect(plain.starCargo).toBe(10);
    const perfect = bountyCardRewards(card({ theme: 'escort', quality: 'bronze' }), 0, true);
    expect(perfect.hullAlloy).toBe(100); // 80×1.25
  });

  it('演习完美参数不加成（完美护航仅护航）', () => {
    expect(bountyCardRewards(card({ theme: 'drill', quality: 'bronze' }), 0, true)).toEqual({ pilotToken: 60 });
  });

  it('金卡附赠实物按"获得次数"轮换（普通信标→通用碎片→打捞加速券→循环）', () => {
    const g = card({ theme: 'drill', quality: 'gold' });
    expect(bountyCardRewards(g, 0, false, 0).beaconCommon).toBe(1);
    expect(bountyCardRewards(g, 0, false, 1).shipBlueprint).toBe(1);
    expect(bountyCardRewards(g, 0, false, 2).supplyTicket).toBe(1);
    expect(bountyCardRewards(g, 0, false, 3).beaconCommon).toBe(1); // 循环回第一件
    expect(goldPhysicalItem(4)).toBe('shipBlueprint'); // 纯轮换助手
  });

  it('非金卡不附实物（轮换索引忽略）', () => {
    const r = bountyCardRewards(card({ theme: 'drill', quality: 'bronze' }), 0, false, 5);
    expect(r).toEqual({ pilotToken: 60 });
  });

  it('星矿绝不入悬赏产出', () => {
    for (const theme of ['escort', 'drill'] as const) {
      for (const quality of ['bronze', 'silver', 'gold'] as const) {
        expect(bountyCardRewards(card({ theme, quality }), 3, true).starOre).toBeUndefined();
      }
    }
  });

  it('星域越深产出越高（系数放大）', () => {
    const t0 = bountyCardRewards(card({ theme: 'drill' }), 0, false).pilotToken;
    const t3 = bountyCardRewards(card({ theme: 'drill' }), 3, false).pilotToken;
    expect(t3).toBeGreaterThan(t0);
  });
});

describe('S7StarportBounty - 遇袭', () => {
  const esc = (id: string): S7BountyCard => ({ id, genDayKey: 5, theme: 'escort', quality: 'bronze', affixIds: [] });

  it('演习卡永不遇袭', () => {
    const drill: S7BountyCard = { id: 'd', genDayKey: 5, theme: 'drill', quality: 'bronze', affixIds: [] };
    expect(bountyAmbushTriggered(drill)).toBe(false);
  });

  it('护航遇袭按卡确定性（同卡重判同结果）', () => {
    const c = esc('19680_0');
    expect(bountyAmbushTriggered(c)).toBe(bountyAmbushTriggered(c));
  });

  it('遇袭在护航卡群里以小概率出现（非恒真恒假）', () => {
    let hit = 0;
    for (let i = 0; i < 200; i += 1) if (bountyAmbushTriggered(esc(`card_${i}`))) hit += 1;
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(200);
  });

  it('遇袭小包按"获得次数"轮换（通用碎片→加速券→循环）', () => {
    expect(bountyAmbushBonus(0)).toEqual({ shipBlueprint: 2 });
    expect(bountyAmbushBonus(1)).toEqual({ supplyTicket: 2 });
    expect(bountyAmbushBonus(2)).toEqual({ shipBlueprint: 2 }); // 循环
    expect(ambushBonusItem(3)).toBe('supplyTicket');
  });
});

describe('S7StarportBounty - 卡完成', () => {
  it('完成一张卡把它从板上移除', () => {
    const st = createDefaultS7Bounty();
    refreshBountyBoard(st, 0, NOW, POOL);
    const id = st.cards[0].id;
    const removed = completeBountyCard(st, id);
    expect(removed?.id).toBe(id);
    expect(findBountyCard(st, id)).toBeNull();
    expect(st.cards).toHaveLength(DAILY_CARDS - 1);
  });

  it('完成不存在的卡：返回 null 且不改板', () => {
    const st = createDefaultS7Bounty();
    refreshBountyBoard(st, 0, NOW, POOL);
    expect(completeBountyCard(st, 'nope')).toBeNull();
    expect(st.cards).toHaveLength(DAILY_CARDS);
  });
});

describe('S7StarportBounty - 结算（获得次数轮换推进·确定性）', () => {
  const goldCard = (id: string): S7BountyCard => ({ id, genDayKey: 5, theme: 'drill', quality: 'gold', affixIds: ['a01', 'a02', 'a03'] });

  it('连续结算金卡：实物按次数轮换 + 计数+1 + 移除卡', () => {
    const st: S7BountyState = { cards: [goldCard('g0'), goldCard('g1'), goldCard('g2')], lastGenDayKey: 5, noGoldDays: 0, goldPhysicalCount: 0, ambushBonusCount: 0 };
    expect(settleBountyCard(st, 'g0', 0, false)?.rewards.beaconCommon).toBe(1); // 第0次→普通信标
    expect(st.goldPhysicalCount).toBe(1);
    expect(findBountyCard(st, 'g0')).toBeNull(); // 已移除
    expect(settleBountyCard(st, 'g1', 0, false)?.rewards.shipBlueprint).toBe(1); // 第1次→通用碎片
    expect(settleBountyCard(st, 'g2', 0, false)?.rewards.supplyTicket).toBe(1); // 第2次→打捞加速券
    expect(st.goldPhysicalCount).toBe(3);
    expect(st.cards).toHaveLength(0);
  });

  it('结算非金卡：不动金卡实物计数', () => {
    const st: S7BountyState = { cards: [{ id: 'b', genDayKey: 5, theme: 'escort', quality: 'bronze', affixIds: [] }], lastGenDayKey: 5, noGoldDays: 0, goldPhysicalCount: 2, ambushBonusCount: 0 };
    expect(settleBountyCard(st, 'b', 0, false)?.rewards.hullAlloy).toBe(80);
    expect(st.goldPhysicalCount).toBe(2); // 不变
    expect(st.cards).toHaveLength(0);
  });

  it('结算不存在的卡：返回 null、不改状态', () => {
    const st = createDefaultS7Bounty();
    expect(settleBountyCard(st, 'nope', 0, false)).toBeNull();
    expect(st.goldPhysicalCount).toBe(0);
  });

  it('领取遇袭小包：按次数轮换 + 计数+1', () => {
    const st = createDefaultS7Bounty();
    expect(claimBountyAmbushBonus(st)).toEqual({ shipBlueprint: 2 });
    expect(st.ambushBonusCount).toBe(1);
    expect(claimBountyAmbushBonus(st)).toEqual({ supplyTicket: 2 });
    expect(st.ambushBonusCount).toBe(2);
  });
});

describe('S7StarportBounty - 老档折算 + 规范化', () => {
  it('积压次数折算成等量铜卡（无词缀·theme 交替）', () => {
    const b = seedBountyFromLegacyCommissions(3, 2);
    expect(b.cards).toHaveLength(5);
    expect(b.cards.every((c) => c.quality === 'bronze')).toBe(true);
    expect(b.cards.every((c) => c.affixIds.length === 0)).toBe(true);
    expect(b.lastGenDayKey).toBe(0);
  });

  it('折算铜卡封顶 LEGACY_MIGRATION_CAP', () => {
    const b = seedBountyFromLegacyCommissions(30, 0);
    expect(b.cards).toHaveLength(LEGACY_MIGRATION_CAP);
  });

  it('normalizeExistingBounty 剔除非法卡、保留合法卡', () => {
    const dirty = {
      cards: [
        { id: 'ok', genDayKey: 5, theme: 'escort', quality: 'gold', affixIds: ['a01', 123, 'a02'] },
        { id: 'bad_theme', genDayKey: 5, theme: 'xxx', quality: 'gold', affixIds: [] },
        { theme: 'escort', quality: 'gold', affixIds: [] }, // 缺 id
        null,
      ],
      lastGenDayKey: 5,
      noGoldDays: 2,
    };
    const s = normalizeExistingBounty(dirty);
    expect(s.cards).toHaveLength(1);
    expect(s.cards[0].id).toBe('ok');
    expect(s.cards[0].affixIds).toEqual(['a01', 'a02']); // 非字符串词缀被过滤
    expect(s.lastGenDayKey).toBe(5);
    expect(s.noGoldDays).toBe(2);
  });

  it('normalizeS7Bounty：有 bounty 用之（含轮换计数保留）；无 bounty+有 commissions 走折算；都无=默认', () => {
    const existing: S7BountyState = { cards: [], lastGenDayKey: 9, noGoldDays: 1, goldPhysicalCount: 3, ambushBonusCount: 1 };
    expect(normalizeS7Bounty(existing, undefined)).toEqual(existing);
    const migrated = normalizeS7Bounty(undefined, { escort: { stock: 2 }, drill: { stock: 1 } });
    expect(migrated.cards).toHaveLength(3);
    expect(normalizeS7Bounty(undefined, undefined)).toEqual(createDefaultS7Bounty());
  });
});
