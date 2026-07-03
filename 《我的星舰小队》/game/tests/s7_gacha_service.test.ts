// 阶段一 C-step1：抽卡三池引擎单测——
//   日序/轮换 · 当天开放类别 · 专属池单位集 · 单抽(发本体/折碎片) · 阶级地板保底 · 连抽扣券 ·
//   专属池兑换进度/兑换箱(本体/溢出折碎片/×2叠领) · 轮换补发(走邮件·零头清零) · 脏档规范化。
// 纯结构、确定性 RNG、不读磁盘。
import { describe, it, expect } from 'vitest';
import { S7AutoBattleRng } from '../assets/scripts/core/s7/S7AutoBattleRng';
import {
  DEFAULT_S7_GACHA_CONFIG,
  S7GachaConfig,
  nonExclusiveShipIds,
} from '../assets/scripts/core/s7/S7GachaConfig';
import {
  createDefaultS7GachaState,
  normalizeS7GachaState,
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
import { createDefaultS7Squad, grantShip } from '../assets/scripts/core/s7/S7Squad';
import { createDefaultS7ExclusiveShardInventory, getExclusiveShardCount } from '../assets/scripts/core/s7/S7ExclusiveShardInventory';
import { createDefaultS7Mailbox } from '../assets/scripts/core/s7/S7Mailbox';

const DAY_MS = 86_400_000;
/** 造测试配置：DEFAULT 的浅覆盖。 */
function cfg(overrides: Partial<S7GachaConfig> = {}): S7GachaConfig {
  return { ...DEFAULT_S7_GACHA_CONFIG, ...overrides };
}
const rng = () => new S7AutoBattleRng('gacha-test-seed');

describe('C-step1 · 日序与专属轮换', () => {
  it('gachaDayIndex：委托全游戏统一日界（北京凌晨4点重置=UTC+4h 移位）', () => {
    const SHIFT = 14_400_000; // +4h
    expect(gachaDayIndex(0)).toBe(0);
    expect(gachaDayIndex(DAY_MS - SHIFT - 1)).toBe(0); // 北京 03:59:59.999
    expect(gachaDayIndex(DAY_MS - SHIFT)).toBe(1); // 北京 04:00:00.000 起新一日
    expect(gachaDayIndex(DAY_MS * 7 + 123)).toBe(7);
  });

  it('exclusivePeriodOf / currentExclusiveShipId：每 3 天轮换一艘(2 艘交替)', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect([0, 1, 2].map((d) => exclusivePeriodOf(c, d))).toEqual([0, 0, 0]);
    expect([3, 4, 5].map((d) => exclusivePeriodOf(c, d))).toEqual([1, 1, 1]);
    // 期 0→shp10, 期 1→shp11, 期 2→shp10 ...
    expect([0, 1, 2].map((d) => currentExclusiveShipId(c, d))).toEqual(['shp10', 'shp10', 'shp10']);
    expect(currentExclusiveShipId(c, 3)).toBe('shp11');
    expect(currentExclusiveShipId(c, 6)).toBe('shp10');
  });

  it('无专属舰配置 → currentExclusiveShipId 返回 null', () => {
    expect(currentExclusiveShipId(cfg({ exclusiveShipIds: [] }), 0)).toBeNull();
  });
});

describe('C-step1 · 当天开放类别 / 单位集', () => {
  it('openCategoryIds：每天开 2 类、3 天走完一轮 6 类', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect(openCategoryIds(c, 'refit', 0)).toEqual(['rf_guard', 'rf_breach']);
    expect(openCategoryIds(c, 'refit', 1)).toEqual(['rf_snipe', 'rf_suppress']);
    expect(openCategoryIds(c, 'refit', 2)).toEqual(['rf_charge', 'rf_versatile']);
    expect(openCategoryIds(c, 'refit', 3)).toEqual(['rf_guard', 'rf_breach']); // 回卷
    expect(openCategoryIds(c, 'recruit', 0)).toEqual(['rc_guard', 'rc_breach']);
  });

  it('openUnitIds：招募/整备=当天开放类别成员；专属池=全部非专属舰+当期专属', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    expect(openUnitIds(c, 'refit', 0).sort()).toEqual(['shp01', 'shp02', 'shp05', 'shp06']); // guard+breach 成员
    // 专属池：10 艘非专属 + shp10(期0专属)
    const ex0 = openUnitIds(c, 'exclusive', 0);
    expect(ex0).toContain('shp10');
    expect(ex0.sort()).toEqual([...nonExclusiveShipIds(c), 'shp10'].sort());
    expect(ex0).not.toContain('shp11'); // 非当期专属不在池
    expect(openUnitIds(c, 'exclusive', 3)).toContain('shp11'); // 期1专属
  });
});

describe('C-step1 · 单抽：发本体 / 重复折碎片', () => {
  it('未拥有 → 发本体(new_body)、不折碎片', () => {
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const shards = createDefaultS7ExclusiveShardInventory();
    const o = drawGachaOnce(state, squad, shards, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 0)!;
    expect(o.result).toBe('new_body');
    expect(o.shardsGained).toBe(0);
    expect(squad.ownedShips).toContain(o.unitId); // 本体已发
    expect(['shp01', 'shp02', 'shp05', 'shp06']).toContain(o.unitId); // 在当天开放集
  });

  it('已拥有 → 折 15 专属碎片(dup_shards)、不重复发本体', () => {
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    ['shp01', 'shp02', 'shp05', 'shp06'].forEach((s) => grantShip(squad, s)); // 预拥有整备当天全集
    const shards = createDefaultS7ExclusiveShardInventory();
    const before = squad.ownedShips.length;
    const o = drawGachaOnce(state, squad, shards, DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 0)!;
    expect(o.result).toBe('dup_shards');
    expect(o.shardsGained).toBe(15);
    expect(getExclusiveShardCount(shards, o.unitId)).toBe(15);
    expect(squad.ownedShips.length).toBe(before); // 没多发本体
  });

  it('招募池抽到的是驾驶员(pilot)', () => {
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const o = drawGachaOnce(state, squad, createDefaultS7ExclusiveShardInventory(), DEFAULT_S7_GACHA_CONFIG, rng(), 'recruit', 0)!;
    expect(o.unitKind).toBe('pilot');
    expect(squad.ownedPilots).toContain(o.unitId);
  });

  it('openUnitIds 为空(配置异常) → 返回 null', () => {
    const c = cfg({ recruitCategories: [] });
    expect(drawGachaOnce(createDefaultS7GachaState(), createDefaultS7Squad(), createDefaultS7ExclusiveShardInventory(), c, rng(), 'recruit', 0)).toBeNull();
  });
});

describe('C-step1 · 阶级地板保底(每 N 抽必出 ≥A/3★)', () => {
  it('第 N 抽触发保底、计数清零；前 N-1 抽不触发', () => {
    const c = cfg({ floorPityDraws: 5 });
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const shards = createDefaultS7ExclusiveShardInventory();
    const flags: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      flags.push(drawGachaOnce(state, squad, shards, c, rng(), 'refit', 0)!.isFloor);
    }
    expect(flags).toEqual([false, false, false, false, true]); // 第 5 抽保底
    expect(state.pity.refit).toBe(0); // 命中后清零
    // 再抽 4 次仍不触发、第 10 抽再触发
    let next = false;
    for (let i = 0; i < 5; i += 1) next = drawGachaOnce(state, squad, shards, c, rng(), 'refit', 0)!.isFloor;
    expect(next).toBe(true);
  });

  it('保底命中且 A 级候选已拥有 → 折 60(floor_shards)', () => {
    const c = cfg({ floorPityDraws: 1, aTierShipIds: ['shp02'] }); // 每抽都保底、候选唯一
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    grantShip(squad, 'shp02'); // 预拥有该 A 级候选
    const shards = createDefaultS7ExclusiveShardInventory();
    const o = drawGachaOnce(state, squad, shards, c, rng(), 'refit', 0)!;
    expect(o.isFloor).toBe(true);
    expect(o.result).toBe('floor_shards');
    expect(o.unitId).toBe('shp02');
    expect(o.shardsGained).toBe(60);
    expect(getExclusiveShardCount(shards, 'shp02')).toBe(60);
  });

  it('保底命中且 A 级候选未拥有 → 发本体(floor_body)', () => {
    const c = cfg({ floorPityDraws: 1, aTierShipIds: ['shp11'] }); // 候选=专属舰(普通整备抽不到→必未拥有)
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const o = drawGachaOnce(state, squad, createDefaultS7ExclusiveShardInventory(), c, rng(), 'refit', 0)!;
    expect(o.result).toBe('floor_body');
    expect(o.unitId).toBe('shp11');
    expect(squad.ownedShips).toContain('shp11');
  });
});

describe('C-step1 · 连抽扣券', () => {
  it('drawGachaMany：抽 min(count, 可用券) 次、ticketsSpent 据此', () => {
    const squad = createDefaultS7Squad();
    const r1 = drawGachaMany(createDefaultS7GachaState(), squad, createDefaultS7ExclusiveShardInventory(), createDefaultS7Mailbox(), DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 10, 3, 0, 1000);
    expect(r1.ticketsSpent).toBe(3); // 券不够，只抽 3
    expect(r1.outcomes.length).toBe(3);
    const r2 = drawGachaMany(createDefaultS7GachaState(), squad, createDefaultS7ExclusiveShardInventory(), createDefaultS7Mailbox(), DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 3, 99, 0, 1000);
    expect(r2.ticketsSpent).toBe(3); // count 限制
  });

  it('drawGachaMany：配置异常(空池) → 不扣券', () => {
    const c = cfg({ recruitCategories: [] });
    const r = drawGachaMany(createDefaultS7GachaState(), createDefaultS7Squad(), createDefaultS7ExclusiveShardInventory(), createDefaultS7Mailbox(), c, rng(), 'recruit', 5, 5, 0, 1000);
    expect(r.ticketsSpent).toBe(0);
  });
});

describe('C-step1 · 专属池进度兑换箱', () => {
  it('availableExchangeBoxes = floor(进度/阈值) - 已领', () => {
    const c = cfg({ exchangeThreshold: 2 });
    const state = createDefaultS7GachaState();
    state.exchangeProgress = 5;
    expect(availableExchangeBoxes(state, c)).toBe(2); // floor(5/2)=2
    state.exchangeClaimed = 1;
    expect(availableExchangeBoxes(state, c)).toBe(1);
  });

  it('claimExchangeBox：首箱发本体、再箱(已拥有)溢出折碎片；无箱→no_box', () => {
    const c = cfg({ exchangeThreshold: 2, exchangeOverflowShards: 60 });
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const shards = createDefaultS7ExclusiveShardInventory();
    refreshGachaToDay(state, createDefaultS7Mailbox(), c, 0, 1000); // 初始化当期专属=shp10
    state.exchangeProgress = 4; // 2 箱可领
    const c1 = claimExchangeBox(state, squad, shards, c, 0);
    expect(c1).toMatchObject({ ok: true, result: 'exclusive_body', exclusiveShipId: 'shp10', boxesClaimed: 1 });
    expect(squad.ownedShips).toContain('shp10');
    const c2 = claimExchangeBox(state, squad, shards, c, 0);
    expect(c2).toMatchObject({ ok: true, result: 'overflow_shards', shardsGained: 60 });
    expect(getExclusiveShardCount(shards, 'shp10')).toBe(60);
    expect(claimExchangeBox(state, squad, shards, c, 0)).toMatchObject({ ok: false, reason: 'no_box' });
  });

  it('claimExchangeBox claimAll=true：一次领光(×2 叠领)·首箱本体余箱碎片', () => {
    const c = cfg({ exchangeThreshold: 2, exchangeOverflowShards: 60 });
    const state = createDefaultS7GachaState();
    const squad = createDefaultS7Squad();
    const shards = createDefaultS7ExclusiveShardInventory();
    refreshGachaToDay(state, createDefaultS7Mailbox(), c, 0, 1000);
    state.exchangeProgress = 4; // 2 箱
    const r = claimExchangeBox(state, squad, shards, c, 0, true);
    expect(r).toMatchObject({ ok: true, result: 'exclusive_body', boxesClaimed: 2 });
    expect(squad.ownedShips).toContain('shp10'); // 首箱本体
    expect(getExclusiveShardCount(shards, 'shp10')).toBe(60); // 余 1 箱折碎片
    expect(state.exchangeClaimed).toBe(2);
  });

  it('isExclusive：专属池抽到当期专属舰=true；其它池/非专属舰=false（专属恒A级·§10.1）', () => {
    // 专属池只含专属舰（清空整备类别→非专属舰为空）→ 必抽到专属。
    const c = cfg({ refitCategories: [], exclusiveShipIds: ['shp10'] });
    const o = drawGachaOnce(createDefaultS7GachaState(), createDefaultS7Squad(), createDefaultS7ExclusiveShardInventory(), c, rng(), 'exclusive', 0)!;
    expect(o.unitId).toBe('shp10');
    expect(o.isExclusive).toBe(true);
    // 整备池抽到的是普通舰 → 非专属。
    const o2 = drawGachaOnce(createDefaultS7GachaState(), createDefaultS7Squad(), createDefaultS7ExclusiveShardInventory(), DEFAULT_S7_GACHA_CONFIG, rng(), 'refit', 0)!;
    expect(o2.isExclusive).toBe(false);
  });

  it('专属池每抽累加兑换进度', () => {
    const c = cfg({ exchangeThreshold: 100 });
    const state = createDefaultS7GachaState();
    refreshGachaToDay(state, createDefaultS7Mailbox(), c, 0, 1000);
    drawGachaOnce(state, createDefaultS7Squad(), createDefaultS7ExclusiveShardInventory(), c, rng(), 'exclusive', 0);
    expect(state.exchangeProgress).toBe(1);
  });
});

describe('C-step1 · 轮换补发(走邮件·零头清零)', () => {
  it('首次刷新：仅初始化期号/专属、不算轮换、不发邮件', () => {
    const c = DEFAULT_S7_GACHA_CONFIG;
    const state = createDefaultS7GachaState();
    const box = createDefaultS7Mailbox();
    const r = refreshGachaToDay(state, box, c, 0, 1000);
    expect(r).toMatchObject({ rotated: false, settledBoxes: 0, mailId: null });
    expect(state.exclusivePeriod).toBe(0);
    expect(state.exclusiveShipId).toBe('shp10');
    expect(box.mails.length).toBe(0);
  });

  it('轮换时忘领满格 → 邮件补发(本体+余格折碎片)、进度清零(零头不补偿)', () => {
    const c = cfg({ exchangeThreshold: 2, exchangeOverflowShards: 60, rotationDays: 3 });
    const state = createDefaultS7GachaState();
    const box = createDefaultS7Mailbox();
    refreshGachaToDay(state, box, c, 0, 1000); // 期0·shp10
    state.exchangeProgress = 5; // floor(5/2)=2 箱, 零头 1
    state.exchangeClaimed = 0;
    const r = refreshGachaToDay(state, box, c, 3, 2000); // 跳到期1·shp11
    expect(r).toMatchObject({ rotated: true, settledBoxes: 2 });
    expect(r.mailId).not.toBeNull();
    const mail = box.mails.find((m) => m.id === r.mailId)!;
    expect(mail.kind).toBe('gacha_rotation_makeup');
    // 补发=1 本体(OLD 专属 shp10) + (2-1)*60 碎片
    expect(mail.rewards).toEqual([
      { type: 'unit', unitKind: 'ship', unitId: 'shp10' },
      { type: 'resource', resourceId: exclusiveShardResourceId('shp10'), amount: 60 },
    ]);
    // 进度清零、刷新到新期
    expect(state.exchangeProgress).toBe(0);
    expect(state.exchangeClaimed).toBe(0);
    expect(state.exclusivePeriod).toBe(1);
    expect(state.exclusiveShipId).toBe('shp11');
  });

  it('轮换但无忘领满格(进度不足一格) → 不发邮件、零头清零', () => {
    const c = cfg({ exchangeThreshold: 50, rotationDays: 3 });
    const state = createDefaultS7GachaState();
    const box = createDefaultS7Mailbox();
    refreshGachaToDay(state, box, c, 0, 1000);
    state.exchangeProgress = 30; // 不足 1 格
    const r = refreshGachaToDay(state, box, c, 3, 2000);
    expect(r).toMatchObject({ rotated: true, settledBoxes: 0, mailId: null });
    expect(box.mails.length).toBe(0);
    expect(state.exchangeProgress).toBe(0); // 零头清零
  });

  it('补发仅 1 格 → 只发本体、无折碎片项', () => {
    const c = cfg({ exchangeThreshold: 2, rotationDays: 3 });
    const state = createDefaultS7GachaState();
    const box = createDefaultS7Mailbox();
    refreshGachaToDay(state, box, c, 0, 1000);
    state.exchangeProgress = 3; // 1 格 + 零头 1
    const r = refreshGachaToDay(state, box, c, 3, 2000);
    expect(r.settledBoxes).toBe(1);
    const mail = box.mails.find((m) => m.id === r.mailId)!;
    expect(mail.rewards).toEqual([{ type: 'unit', unitKind: 'ship', unitId: 'shp10' }]);
  });
});

describe('C-step1 · 存档规范化(防脏档)', () => {
  it('normalize：保底/进度取非负整数、claimed 夹到 ≤ progress、期号取整(允许 -1)', () => {
    const dirty = {
      pity: { recruit: -3, refit: 2.5, exclusive: 4 },
      exchangeProgress: 10,
      exchangeClaimed: 99, // 超过 progress → 夹到 10
      exclusivePeriod: 1.9, // 非整 → -1
      exclusiveShipId: '',
    };
    const s = normalizeS7GachaState(dirty);
    expect(s.pity).toEqual({ recruit: 0, refit: 0, exclusive: 4 });
    expect(s.exchangeProgress).toBe(10);
    expect(s.exchangeClaimed).toBe(10);
    expect(s.exclusivePeriod).toBe(-1);
    expect(s.exclusiveShipId).toBeNull();
  });

  it('normalize 非对象 → 默认空状态', () => {
    expect(normalizeS7GachaState(null)).toEqual(createDefaultS7GachaState());
    expect(normalizeS7GachaState(42)).toEqual(createDefaultS7GachaState());
  });
});
