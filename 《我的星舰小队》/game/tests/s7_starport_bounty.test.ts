// 星港悬赏板核心测试（步5 收尾批重定基·GDD S10.8 总修订案口径 + 初值表 v0.7 终值）：
// 确定性生成 / 明保底日程表 / 积压 6·9·12 / 产出终值手推 / 难度四档 / 遇袭 / 卡完成 / 老档折算 / 规范化。
// 重定基总说明（旧→新→为什么对）：
//   ① 4 张/日+主题混合 → 3 张/日全护航（总修订案 1a：演习剥离进木桩）；
//   ② 金 8%+暗保底 PITY_DAYS → 明保底日程表（每天 ≥1 银·每 3 天 1 金=Ron 2026-07-07 拍板·受控方差）；
//   ③ 容量 12/16/20 → 6/9/12（细案③+§二3·Ron 2026-07-09 收紧）；
//   ④ 产出 80 合金/60 记录·全星域系数 → 495 合金+20 星贝·×星域系数^0.6（v0.7 §6-1·coefPow=防双重计 progression）；
//   ⑤ 遇袭小包 ×2 → ×1（机器真源 ambushWinBonus 0.5/0.5=轮换两件各期望 1/2）。
import { describe, it, expect } from 'vitest';
import {
  DAILY_CARDS,
  GOLD_EVERY_DAYS,
  SILVER_PER_DAY,
  LEGACY_MIGRATION_CAP,
  BOUNTY_COEF_POW,
  BOUNTY_DIFFICULTY_MULTS,
  BOUNTY_DIFFICULTY_REC_POWER,
  BOUNTY_DIFFICULTY_ANCHOR_NODES,
  bountyBattleNodeId,
  bountyAutoDifficulty,
  S7BountyCard,
  S7BountyState,
  AFFIX_COUNT,
  createDefaultS7Bounty,
  generateDayCards,
  isGoldDay,
  refreshBountyBoard,
  bountyBoardCap,
  bountyCardRewards,
  goldPhysicalItem,
  ambushBonusItem,
  settleBountyCard,
  bountyAmbushTriggered,
  bountyAmbushBonus,
  claimBountyAmbushBonus,
  ambushLossPenalty,
  AMBUSH_LOSS_PENALTY_RATE,
  completeBountyCard,
  findBountyCard,
  seedBountyFromLegacyCommissions,
  normalizeExistingBounty,
  normalizeS7Bounty,
} from '../assets/scripts/core/s7/S7StarportBounty';
import { s7DayKey } from '../assets/scripts/core/s7/S7AdDailyCounter';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const POOL = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10', 'a11', 'a12'];
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe('S7StarportBounty - 确定性生成（3 张全护航）', () => {
  it('同种子（同日界）重跑生成完全相同的 3 张卡', () => {
    const a = generateDayCards(1000, POOL);
    const b = generateDayCards(1000, POOL);
    expect(a.cards).toEqual(b.cards);
    expect(a.cards).toHaveLength(DAILY_CARDS); // 3 张（总修订案 4→3）
  });

  it('每张卡：全护航 + 品质合法 + 词缀条数随品质 + 词缀不重复', () => {
    const { cards } = generateDayCards(1234, POOL);
    for (const c of cards) {
      expect(c.theme).toBe('escort'); // 全护航（演习剥离进木桩）
      expect(['bronze', 'silver', 'gold']).toContain(c.quality);
      expect(c.affixIds).toHaveLength(AFFIX_COUNT[c.quality]);
      expect(new Set(c.affixIds).size).toBe(c.affixIds.length); // 一张卡内词缀不重复
      for (const id of c.affixIds) expect(POOL).toContain(id);
    }
  });

  it('不同日界基本会给出不同卡面（抽样）', () => {
    const d1 = JSON.stringify(generateDayCards(1, POOL).cards);
    const d2 = JSON.stringify(generateDayCards(2, POOL).cards);
    expect(d1).not.toBe(d2);
  });
});

describe('S7StarportBounty - 明保底日程表（取代旧暗保底·Ron 2026-07-07 拍板）', () => {
  it('每个发卡日必含 ≥1 张银色（连续 60 日抽验）', () => {
    for (let dk = 1; dk <= 60; dk += 1) {
      const { cards } = generateDayCards(dk, POOL);
      expect(cards.filter((c) => c.quality === 'silver').length).toBeGreaterThanOrEqual(SILVER_PER_DAY);
    }
  });

  it('金卡日程：每 3 个发卡日恰 1 金（金日=金银铜各一·普通日=银1铜2）', () => {
    for (let dk = 1; dk <= 60; dk += 1) {
      const { cards } = generateDayCards(dk, POOL);
      const golds = cards.filter((c) => c.quality === 'gold').length;
      if (isGoldDay(dk)) {
        expect(golds).toBe(1);
        expect(cards.map((c) => c.quality).sort()).toEqual(['bronze', 'gold', 'silver']);
      } else {
        expect(golds).toBe(0);
        expect(cards.map((c) => c.quality).sort()).toEqual(['bronze', 'bronze', 'silver']);
      }
    }
  });

  it('单张期望核对：60 日窗口 金=20/180、银=60/180（金1/9·银1/3=机器真源 commissionQualityEV）', () => {
    let gold = 0; let silver = 0; let total = 0;
    for (let dk = 1; dk <= 60; dk += 1) {
      for (const c of generateDayCards(dk, POOL).cards) {
        total += 1;
        if (c.quality === 'gold') gold += 1;
        if (c.quality === 'silver') silver += 1;
      }
    }
    expect(total).toBe(180);
    expect(gold).toBe(20);   // 1/9
    expect(silver).toBe(60); // 1/3
    expect(GOLD_EVERY_DAYS).toBe(3);
  });
});

describe('S7StarportBounty - 日刷 / 积压 6·9·12（细案③）', () => {
  it('首次刷出今日 3 张，lastGenDayKey 记当日；同日重进不重刷（确定性·杀进程重进不换卡）', () => {
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

  it('隔日再刷 +3 张（未做的积压保留）', () => {
    const st = createDefaultS7Bounty();
    refreshBountyBoard(st, 0, NOW, POOL);
    refreshBountyBoard(st, 0, NOW + DAY, POOL);
    expect(st.cards).toHaveLength(6);
  });

  it('积压封顶：多日不做，基础上限 6（掉最旧）', () => {
    // 重定基：旧 12 → 6（细案③ Ron 收紧·恶补银行减半=追赶红线复验"未伤回补"在册 v0.7 §2.5）。
    const st = createDefaultS7Bounty();
    for (let d = 0; d < 4; d += 1) refreshBountyBoard(st, 0, NOW + d * DAY, POOL);
    expect(st.cards).toHaveLength(6); // 4 天 ×3=12 → 封顶 6
    expect(st.cards.some((c) => c.genDayKey === s7DayKey(NOW + 3 * DAY))).toBe(true);
    expect(st.cards.some((c) => c.genDayKey === s7DayKey(NOW))).toBe(false);
  });

  it('居住舱钩子：容量 6 / 9 / 12（旧 12/16/20 作废）', () => {
    expect(bountyBoardCap(0)).toBe(6);
    expect(bountyBoardCap(4)).toBe(6);
    expect(bountyBoardCap(5)).toBe(9);
    expect(bountyBoardCap(9)).toBe(9);
    expect(bountyBoardCap(10)).toBe(12);
    expect(bountyBoardCap(15)).toBe(12);
  });

  it('居住舱 Lv10：积压封顶 12', () => {
    const st = createDefaultS7Bounty();
    for (let d = 0; d < 6; d += 1) refreshBountyBoard(st, 10, NOW + d * DAY, POOL);
    expect(st.cards).toHaveLength(12);
  });
});

describe('S7StarportBounty - 产出终值（v0.7 §6-1 手推）', () => {
  const card = (over: Partial<S7BountyCard>): S7BountyCard => ({
    id: 'c', genDayKey: 0, theme: 'escort', quality: 'bronze', affixIds: [], ...over,
  });

  it('护航铜卡 tier0：合金 495 + 星贝 20（coef=1^0.6=1·终值手推）', () => {
    // 重定基：旧 80/10 占位 → 495/20（v0.7 escortAlloy/escortCargo=B1 军饷第一单源量值·⑤×2.75 落定）。
    const plain = bountyCardRewards(card({}), 0, false);
    expect(plain.hullAlloy).toBe(495);
    expect(plain.starCargo).toBe(20);
  });

  it('完美护航 ×1.25：floor(495×1.25)=618', () => {
    expect(bountyCardRewards(card({}), 0, true).hullAlloy).toBe(618);
  });

  it('品质倍率 金×3：floor(495×3)=1485', () => {
    expect(bountyCardRewards(card({ quality: 'gold' }), 0, false).hullAlloy).toBe(1485);
  });

  it('星域系数走 ^0.6（防双重计 progression）：tier3=4.0^0.6≈2.2974 → floor(495×2.2974)=1137', () => {
    expect(BOUNTY_COEF_POW).toBe(0.6);
    const t3 = bountyCardRewards(card({}), 3, false);
    expect(t3.hullAlloy).toBe(Math.floor(495 * Math.pow(4.0, 0.6)));
    expect(t3.hullAlloy).toBe(1137); // 手推定点
  });

  it('难度四档倍率（总修订案 1a）：噩梦铜卡=floor(495×2.2)=1089；推荐战力=v0.9 快照定点（定价重锚 v1 重定基）', () => {
    expect(BOUNTY_DIFFICULTY_MULTS).toEqual({ novice: 0.7, normal: 1.0, hard: 1.5, nightmare: 2.2 });
    expect(bountyCardRewards(card({}), 0, false, 0, 'nightmare').hullAlloy).toBe(1089);
    // 推荐战力=压力表 n10/n55/n98/n130 快照值（对表守卫：与初值表 json 逐值一致·重校时红=提醒重落）。
    const json = JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', '第三块-数值校准', '数值初值表-v0-数据.json'), 'utf-8')) as {
      pressure: number[]; params: { bounty: { difficulty: { recNodes: Record<string, number> } } };
    };
    expect(BOUNTY_DIFFICULTY_REC_POWER.novice).toBe(json.pressure[10]);
    expect(BOUNTY_DIFFICULTY_REC_POWER.normal).toBe(json.pressure[55]);
    expect(BOUNTY_DIFFICULTY_REC_POWER.hard).toBe(json.pressure[98]);
    expect(BOUNTY_DIFFICULTY_REC_POWER.nightmare).toBe(json.pressure[130]);
    // 基底锚点=经济尺 recNodes 镜像（定价重锚批·拍板5：改任一侧必须同步——对表钉防漂）。
    for (const d of ['novice', 'normal', 'hard', 'nightmare'] as const) {
      expect(BOUNTY_DIFFICULTY_ANCHOR_NODES[d]).toBe(`n${String(json.params.bounty.difficulty.recNodes[d]).padStart(3, '0')}`);
    }
  });

  it('基底锚点法（定价重锚批·拍板5）：难度→固定锚点节点；自动选档=已通关锚点最高档', () => {
    expect(bountyBattleNodeId('novice')).toBe('n010');
    expect(bountyBattleNodeId()).toBe('n055'); // 缺省 normal
    expect(bountyBattleNodeId('nightmare')).toBe('n130');
    expect(bountyAutoDifficulty([])).toBe('novice'); // 一个锚点没通=新手
    expect(bountyAutoDifficulty(['n001', 'n010'])).toBe('novice'); // 通 n010 仍新手（n055 未通）
    expect(bountyAutoDifficulty(['n010', 'n055'])).toBe('normal');
    expect(bountyAutoDifficulty(['n010', 'n055', 'n098', 'n130'])).toBe('nightmare');
  });

  it('金卡附赠实物按"获得次数"轮换（普通信标→通用碎片→补给券→循环）', () => {
    const g = card({ quality: 'gold' });
    expect(bountyCardRewards(g, 0, false, 0).beaconCommon).toBe(1);
    expect(bountyCardRewards(g, 0, false, 1).shipBlueprint).toBe(1);
    expect(bountyCardRewards(g, 0, false, 2).supplyTicket).toBe(1);
    expect(bountyCardRewards(g, 0, false, 3).beaconCommon).toBe(1); // 循环回第一件
    expect(goldPhysicalItem(4)).toBe('shipBlueprint'); // 纯轮换助手
  });

  it('非金卡不附实物（轮换索引忽略）', () => {
    const r = bountyCardRewards(card({}), 0, false, 5);
    expect(r).toEqual({ hullAlloy: 495, starCargo: 20 });
  });

  it('星矿绝不入悬赏产出（守 S9 星矿四来源）', () => {
    for (const quality of ['bronze', 'silver', 'gold'] as const) {
      expect(bountyCardRewards(card({ quality }), 3, true).starOre).toBeUndefined();
    }
  });

  it('星域越深产出越高（^0.6 仍单调）', () => {
    const t0 = bountyCardRewards(card({}), 0, false).hullAlloy;
    const t3 = bountyCardRewards(card({}), 3, false).hullAlloy;
    expect(t3).toBeGreaterThan(t0);
  });

  it('老开发档积压演习卡仍可结算（drill 行=370 记录·仅存量消化）', () => {
    expect(bountyCardRewards(card({ theme: 'drill' }), 0, false)).toEqual({ pilotToken: 370 });
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

  it('遇袭小包按"获得次数"轮换·量 ×1（旧 ×2 → 1=机器真源 ambushWinBonus 0.5/0.5 期望）', () => {
    expect(bountyAmbushBonus(0)).toEqual({ shipBlueprint: 1 });
    expect(bountyAmbushBonus(1)).toEqual({ supplyTicket: 1 });
    expect(bountyAmbushBonus(2)).toEqual({ shipBlueprint: 1 }); // 循环
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
  const goldCard = (id: string): S7BountyCard => ({ id, genDayKey: 5, theme: 'escort', quality: 'gold', affixIds: ['a01', 'a02', 'a03'] });

  it('连续结算金卡：实物按次数轮换 + 计数+1 + 移除卡', () => {
    const st: S7BountyState = { cards: [goldCard('g0'), goldCard('g1'), goldCard('g2')], lastGenDayKey: 5, noGoldDays: 0, goldPhysicalCount: 0, ambushBonusCount: 0 };
    expect(settleBountyCard(st, 'g0', 0, false)?.rewards.beaconCommon).toBe(1); // 第0次→普通信标
    expect(st.goldPhysicalCount).toBe(1);
    expect(findBountyCard(st, 'g0')).toBeNull(); // 已移除
    expect(settleBountyCard(st, 'g1', 0, false)?.rewards.shipBlueprint).toBe(1); // 第1次→通用碎片
    expect(settleBountyCard(st, 'g2', 0, false)?.rewards.supplyTicket).toBe(1); // 第2次→补给券
    expect(st.goldPhysicalCount).toBe(3);
    expect(st.cards).toHaveLength(0);
  });

  it('结算非金卡：不动金卡实物计数（护航铜卡=495 合金终值）', () => {
    const st: S7BountyState = { cards: [{ id: 'b', genDayKey: 5, theme: 'escort', quality: 'bronze', affixIds: [] }], lastGenDayKey: 5, noGoldDays: 0, goldPhysicalCount: 2, ambushBonusCount: 0 };
    expect(settleBountyCard(st, 'b', 0, false)?.rewards.hullAlloy).toBe(495);
    expect(st.goldPhysicalCount).toBe(2); // 不变
    expect(st.cards).toHaveLength(0);
  });

  it('结算带难度倍率（噩梦 ×2.2）', () => {
    const st: S7BountyState = { cards: [{ id: 'n', genDayKey: 5, theme: 'escort', quality: 'bronze', affixIds: [] }], lastGenDayKey: 5, noGoldDays: 0, goldPhysicalCount: 0, ambushBonusCount: 0 };
    expect(settleBountyCard(st, 'n', 0, false, 'nightmare')?.rewards.hullAlloy).toBe(1089);
  });

  it('结算不存在的卡：返回 null、不改状态', () => {
    const st = createDefaultS7Bounty();
    expect(settleBountyCard(st, 'nope', 0, false)).toBeNull();
    expect(st.goldPhysicalCount).toBe(0);
  });

  it('领取遇袭小包：按次数轮换 + 计数+1（量=1·终值）', () => {
    const st = createDefaultS7Bounty();
    expect(claimBountyAmbushBonus(st)).toEqual({ shipBlueprint: 1 });
    expect(st.ambushBonusCount).toBe(1);
    expect(claimBountyAmbushBonus(st)).toEqual({ supplyTicket: 1 });
    expect(st.ambushBonusCount).toBe(2);
  });
});

describe('S7StarportBounty - 遇袭风险抉择·迎战失败折损（30%=v0.7 终值）', () => {
  it('折损=逐键 floor(本单入账×30%)（495→148、20→6）', () => {
    expect(AMBUSH_LOSS_PENALTY_RATE).toBe(0.3); // v0.7 bountyAmbushLossPct 终值·防无声改动
    expect(ambushLossPenalty({ hullAlloy: 495, starCargo: 20 })).toEqual({ hullAlloy: 148, starCargo: 6 });
  });

  it('量小实物 floor 后免扣（金卡信标×1 不进折损表）', () => {
    expect(ambushLossPenalty({ hullAlloy: 80, beaconCommon: 1 })).toEqual({ hullAlloy: 24 });
  });

  it('折损恒 ≤ 本单入账（"绝不触碰存量"的数学保证：回收量不超过刚发放量）', () => {
    const settled: Record<string, number> = { hullAlloy: 133, starCargo: 17, shipBlueprint: 2, supplyTicket: 1 };
    const loss = ambushLossPenalty(settled);
    for (const k of Object.keys(loss)) {
      expect(loss[k]).toBeGreaterThan(0);
      expect(loss[k]).toBeLessThanOrEqual(settled[k]);
    }
  });

  it('空入账 → 空折损（防御边界）', () => {
    expect(ambushLossPenalty({})).toEqual({});
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

  it('折算铜卡封顶 LEGACY_MIGRATION_CAP（=新基础容量 6）', () => {
    const b = seedBountyFromLegacyCommissions(30, 0);
    expect(b.cards).toHaveLength(LEGACY_MIGRATION_CAP);
    expect(LEGACY_MIGRATION_CAP).toBe(6);
  });

  it('normalizeExistingBounty 剔除非法卡、保留合法卡（容量硬钳=Lv10 上限 12）', () => {
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
    expect(s.noGoldDays).toBe(2); // 退役字段仍收纳（明保底下无消费·refresh 时归 0）
  });

  it('normalizeS7Bounty：有 bounty 用之（含轮换计数保留）；无 bounty+有 commissions 走折算；都无=默认', () => {
    const existing: S7BountyState = { cards: [], lastGenDayKey: 9, noGoldDays: 1, goldPhysicalCount: 3, ambushBonusCount: 1 };
    expect(normalizeS7Bounty(existing, undefined)).toEqual(existing);
    const migrated = normalizeS7Bounty(undefined, { escort: { stock: 2 }, drill: { stock: 1 } });
    expect(migrated.cards).toHaveLength(3);
    expect(normalizeS7Bounty(undefined, undefined)).toEqual(createDefaultS7Bounty());
  });
});
