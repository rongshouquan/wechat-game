// 第2.5块·块2：每日委托单测（GDD S10.8）。真实样例配置建 model/runtime，不改磁盘表。
// 覆盖：默认态、首次触达只发当日份、跨天补发、积压封顶（基础3天/居住舱Lv5→4/Lv10→5）、
// 同日幂等、消耗、首打必看标记、奖励缩放+完美护航加成、确定性种子、敌阵节点选择、
// 护航运输船真实引擎链路（battle_start 触发开场召唤 → 我方侧出现 prop 单位 → 完美判定）。
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineModel } from '../assets/scripts/core/s7/S7MainlineProgress';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { S7BattleLineupUnitInput } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7AutoBattleResult } from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { starfieldCoefficient } from '../assets/scripts/core/s7/S7OfflineProduction';
import { s7DayKey } from '../assets/scripts/core/s7/S7AdDailyCounter';
import {
  createDefaultS7Commissions,
  normalizeS7Commissions,
  commissionBacklogDays,
  commissionStockCap,
  accrueCommissions,
  consumeCommission,
  isTierWatched,
  markTierWatched,
  commissionBattleNodeId,
  commissionRewards,
  commissionRunSeed,
  escortTransportBlocks,
  isPerfectEscort,
  COMMISSION_DAILY_COUNT,
  COMMISSION_TRANSPORT_STAT_REF,
} from '../assets/scripts/core/s7/S7DailyCommission';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

let runtime: S7ConfigRuntime;
let model: S7MainlineModel;
beforeAll(async () => {
  runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
  model = S7MainlineModel.fromRuntime(runtime);
});

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

describe('块2 · 次数发放与积压', () => {
  it('默认态：两类 库存0/未发放/无已看档', () => {
    const s = createDefaultS7Commissions();
    expect(s.escort).toEqual({ stock: 0, lastAccrualDayKey: 0, watchedTiers: [] });
    expect(s.drill).toEqual({ stock: 0, lastAccrualDayKey: 0, watchedTiers: [] });
  });

  it('首次触达：只发当日份（每类 2）、不追溯解锁前；同日再触达不重复发', () => {
    const s = createDefaultS7Commissions();
    const added = accrueCommissions(s, 0, NOW);
    expect(added).toBe(COMMISSION_DAILY_COUNT * 2);
    expect(s.escort.stock).toBe(2);
    expect(s.drill.stock).toBe(2);
    expect(s.escort.lastAccrualDayKey).toBe(s7DayKey(NOW));
    expect(accrueCommissions(s, 0, NOW + 1000)).toBe(0); // 同日幂等
    expect(s.escort.stock).toBe(2);
  });

  it('跨天补发：隔 1 天 +2/类；攒着不打隔 5 天 → 撞基础积压上限 6（3 天量）', () => {
    const s = createDefaultS7Commissions();
    accrueCommissions(s, 0, NOW);
    accrueCommissions(s, 0, NOW + DAY);
    expect(s.escort.stock).toBe(4);
    accrueCommissions(s, 0, NOW + 6 * DAY);
    expect(s.escort.stock).toBe(6); // cap = 2×3
    expect(s.drill.stock).toBe(6);
  });

  it('居住舱延长积压：Lv5→4 天(8)、Lv10→5 天(10)；backlogDays/stockCap 一致', () => {
    expect(commissionBacklogDays(0)).toBe(3);
    expect(commissionBacklogDays(5)).toBe(4);
    expect(commissionBacklogDays(9)).toBe(4);
    expect(commissionBacklogDays(10)).toBe(5);
    expect(commissionStockCap(5)).toBe(8);
    const s = createDefaultS7Commissions();
    accrueCommissions(s, 10, NOW);
    accrueCommissions(s, 10, NOW + 30 * DAY);
    expect(s.escort.stock).toBe(10);
  });

  it('消耗：有库存扣 1 返回 true；扣空返回 false 且不变负', () => {
    const s = createDefaultS7Commissions();
    accrueCommissions(s, 0, NOW);
    expect(consumeCommission(s, 'escort')).toBe(true);
    expect(consumeCommission(s, 'escort')).toBe(true);
    expect(consumeCommission(s, 'escort')).toBe(false);
    expect(s.escort.stock).toBe(0);
    expect(s.drill.stock).toBe(2); // 类型独立
  });

  it('防刷关键性质：当天打完再触达发放（重开面板）不续杯，次日才 +2', () => {
    const s = createDefaultS7Commissions();
    accrueCommissions(s, 0, NOW);
    consumeCommission(s, 'escort');
    consumeCommission(s, 'escort');
    expect(accrueCommissions(s, 0, NOW + 3600_000)).toBe(0); // 当天重开面板：不补
    expect(s.escort.stock).toBe(0);
    accrueCommissions(s, 0, NOW + DAY);
    expect(s.escort.stock).toBe(2); // 次日恢复当日份
  });

  it('normalize 防脏档：非法退默认；watchedTiers 去重排序丢非法值', () => {
    expect(normalizeS7Commissions(null)).toEqual(createDefaultS7Commissions());
    const n = normalizeS7Commissions({
      escort: { stock: 3.5, lastAccrualDayKey: -2, watchedTiers: [2, 0, 2, -1, 1.5] },
      drill: { stock: 4, lastAccrualDayKey: 19700, watchedTiers: 'x' },
    });
    expect(n.escort).toEqual({ stock: 0, lastAccrualDayKey: 0, watchedTiers: [0, 2] });
    expect(n.drill).toEqual({ stock: 4, lastAccrualDayKey: 19700, watchedTiers: [] });
  });

  it('首打必看标记：mark 幂等、按类型/档独立', () => {
    const s = createDefaultS7Commissions();
    expect(isTierWatched(s, 'escort', 0)).toBe(false);
    markTierWatched(s, 'escort', 0);
    markTierWatched(s, 'escort', 0);
    expect(s.escort.watchedTiers).toEqual([0]);
    expect(isTierWatched(s, 'escort', 0)).toBe(true);
    expect(isTierWatched(s, 'drill', 0)).toBe(false);
    expect(isTierWatched(s, 'escort', 1)).toBe(false);
  });
});

describe('块2 · 奖励与种子', () => {
  it('护航档0：合金80+星贝10；完美 ×1.25 → 100/12；演习：驾驶记录60、无视 perfect', () => {
    expect(commissionRewards('escort', 0, false)).toEqual({ hullAlloy: 80, starCargo: 10 });
    expect(commissionRewards('escort', 0, true)).toEqual({ hullAlloy: 100, starCargo: 12 });
    expect(commissionRewards('drill', 0, false)).toEqual({ pilotToken: 60 });
    expect(commissionRewards('drill', 0, true)).toEqual({ pilotToken: 60 });
  });

  it('奖励随星域档缩放（同离线系数）', () => {
    const coef1 = starfieldCoefficient(1);
    expect(commissionRewards('drill', 1, false).pilotToken).toBe(Math.floor(60 * coef1));
    expect(commissionRewards('escort', 1, false).hullAlloy).toBe(Math.floor(80 * coef1));
  });

  it('运行种子确定且随 类型/日/库存 变化（同一场重跑同种子=不换结果）', () => {
    expect(commissionRunSeed('escort', NOW, 2)).toBe(commissionRunSeed('escort', NOW, 2));
    expect(commissionRunSeed('escort', NOW, 2)).not.toBe(commissionRunSeed('escort', NOW, 1));
    expect(commissionRunSeed('escort', NOW, 2)).not.toBe(commissionRunSeed('drill', NOW, 2));
    expect(commissionRunSeed('escort', NOW, 2)).not.toBe(commissionRunSeed('escort', NOW + DAY, 2));
  });
});

describe('块2 · 敌阵节点选择（灰盒=已通关最高星域首个战斗节点）', () => {
  const lastNodeOf = (sf: string): string => {
    let last = '';
    for (const id of model.defaultRoute) if (model.nodeView(id)!.starfieldId === sf) last = id;
    return last;
  };

  it('档0（无通关）→ 全线路首个战斗节点 n001', () => {
    expect(commissionBattleNodeId(model, [])).toBe('n001');
  });

  it('通关 sf01 → 档1 → sf01 首个战斗节点（旧内容必赢）；通关 sf02 → sf02 首个战斗节点', () => {
    const c1 = commissionBattleNodeId(model, [lastNodeOf('sf01')]);
    expect(c1).toBe('n001'); // sf01 首个战斗节点就是 n001
    const c2 = commissionBattleNodeId(model, [lastNodeOf('sf01'), lastNodeOf('sf02')]);
    expect(c2).not.toBeNull();
    const v2 = model.nodeView(c2!)!;
    expect(v2.starfieldId).toBe('sf02');
    // 是 sf02 里路线最靠前的战斗节点：其前面不存在更早的 sf02 战斗节点
    const earlier = model.defaultRoute.slice(0, model.defaultRoute.indexOf(c2!))
      .filter((id) => model.nodeView(id)!.starfieldId === 'sf02')
      .filter((id) => ['tutorial_battle', 'normal', 'elite', 'boss'].includes(model.nodeView(id)!.nodeTypeTag));
    expect(earlier).toEqual([]);
  });
});

describe('块2 · 护航运输船（真实引擎链路）', () => {
  const TRIO: S7BattleLineupUnitInput[] = [
    { shipId: 'shp01', slotRef: 'p0c2' },
    { shipId: 'shp02', slotRef: 'p1c2' },
    { shipId: 'shp03', slotRef: 'p2c2' },
  ];

  it('battle_start 触发开场召唤：我方侧出现运输船；完美判定与运输船血量一致；同种子重跑结果一致', () => {
    const service = new S7BattleRunService();
    const lineup = TRIO.map((u, i) => (i === 0 ? { ...u, extraBlocks: escortTransportBlocks() } : u));
    const out = service.run({
      runtime,
      progress: { currentNodeId: 'n001', clearedNodeIds: [] },
      runSeed: commissionRunSeed('escort', NOW, 2),
      lineup,
    });
    const transport = out.result.finalState.players.find((u) => u.unitStatRef === COMMISSION_TRANSPORT_STAT_REF);
    expect(transport).toBeDefined(); // 召唤链路真的走通（trigger→effect→summonUnits→我方空格）
    expect(isPerfectEscort(out.result)).toBe(!!transport && transport!.alive && transport!.hp >= transport!.maxHp);

    const again = service.run({
      runtime,
      progress: { currentNodeId: 'n001', clearedNodeIds: [] },
      runSeed: commissionRunSeed('escort', NOW, 2),
      lineup: TRIO.map((u, i) => (i === 0 ? { ...u, extraBlocks: escortTransportBlocks() } : u)),
    });
    expect(JSON.stringify(again.result.finalState.players)).toBe(JSON.stringify(out.result.finalState.players));
  });

  it('演习（无运输船积木）：我方侧不出现运输船，isPerfectEscort=false', () => {
    const service = new S7BattleRunService();
    const out = service.run({
      runtime,
      progress: { currentNodeId: 'n001', clearedNodeIds: [] },
      runSeed: commissionRunSeed('drill', NOW, 2),
      lineup: TRIO,
    });
    expect(out.result.finalState.players.some((u) => u.unitStatRef === COMMISSION_TRANSPORT_STAT_REF)).toBe(false);
    expect(isPerfectEscort(out.result)).toBe(false);
  });

  it('isPerfectEscort 合成边界：无运输船/受伤/阵亡 → false；满血存活 → true', () => {
    const mk = (players: unknown[]): S7AutoBattleResult => ({ finalState: { players } } as unknown as S7AutoBattleResult);
    const t = (over: Record<string, unknown>) => ({
      unitId: 'u_t', side: 'player', unitStatRef: COMMISSION_TRANSPORT_STAT_REF, slotRef: 'p0c0',
      hp: 900, maxHp: 900, shield: 0, alive: true, ...over,
    });
    expect(isPerfectEscort(mk([]))).toBe(false);
    expect(isPerfectEscort(mk([t({ hp: 899 })]))).toBe(false);
    expect(isPerfectEscort(mk([t({ alive: false, hp: 0 })]))).toBe(false);
    expect(isPerfectEscort(mk([t({})]))).toBe(true);
  });
});
