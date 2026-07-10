// 机制批③段二b：舰侧阶/级装配通道（shipBlocks）+ 点名挂牌舰件的战斗级手推。
// 基线量纲同段一：攻100/防25 → 普攻 80；直伤子结算=不过甲。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import {
  S7AutoBattlePlayerUnitInput,
  S7AutoBattleResult,
} from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';
import { shipBlocks } from '../assets/scripts/core/s7/S7ShipEffects';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

function loadBundle(): Bundle {
  const bundle = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return bundle;
}
const cloneBundle = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}
async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
}
/** 试验台：真舰行（不中性化=吃真基线套件）+ 巨血敌。 */
function rigShip(opts: {
  shipRow: string; shipOverrides?: Row;
  enemies: Array<{ rowId: string; slot: string; overrides?: Row }>;
  timeLimitSec?: number;
}): Bundle {
  const b = cloneBundle(loadBundle());
  if (opts.shipOverrides) Object.assign(row(b, 'battle_unit_stat_param', opts.shipRow), opts.shipOverrides);
  const spawnRefs: string[] = [];
  const enemyRefs = new Set<string>(['bu_enemy_swarm']);
  opts.enemies.forEach((e, i) => {
    const src = row(b, 'battle_unit_stat_param', 'bu_enemy_swarm');
    const bare = JSON.parse(JSON.stringify(src)) as Row;
    delete bare.extraTriggerBlocks;
    delete bare.stackRules;
    const clone = { ...bare, rowId: e.rowId, maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, targetingTag: 'nearest_random_tie', ...(e.overrides ?? {}) } as Row;
    (b.battle_unit_stat_param as Row[]).push(clone);
    enemyRefs.add(e.rowId);
    if (i === 0) {
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: 0 });
      spawnRefs.push('spawn_n001_w1');
    } else {
      const src2 = row(b, 'battle_spawn_param', 'spawn_n001_w2');
      (b.battle_spawn_param as Row[]).push({ ...JSON.parse(JSON.stringify(src2)), rowId: `spawn_st_${i}`, unitStatRef: e.rowId, count: 1, slotRefs: [e.slot], spawnDelaySec: 0 });
      spawnRefs.push(`spawn_st_${i}`);
    }
  });
  Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
    spawnPlanRefs: spawnRefs, enemyUnitStatRefs: [...enemyRefs], timeLimitSec: opts.timeLimitSec ?? 6,
  });
  return b;
}
async function runShip(b: Bundle, shipRow: string, level: number, tier: number, shipId: string, extra: S7EffectBlock[] = []): Promise<S7AutoBattleResult> {
  const units: S7AutoBattlePlayerUnitInput[] = [{
    unitStatRef: shipRow, slotRef: 'p1c2',
    effectBlocks: [...shipBlocks(shipId, level, tier), ...extra],
  }];
  return (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'st', playerUnits: units });
}

describe('机制批③段二b-shipBlocks 阶/级门扫描（形状）', () => {
  it('缺省 Lv1/C 阶=空积木（基线行为不变）·大节点/阶门逐档出件', () => {
    // 例外两舰=基础技/被动全新接（⑨挂牌解除）在 Lv1 即出件：shp07 堡垒（要塞展开）·shp08 山岳（磁暴盾）。
    for (const id of ['shp01', 'shp05', 'shp12', 'shp15', 'shp17']) {
      expect(shipBlocks(id, 1, 0), `${id} Lv1/C 应为空`).toHaveLength(0);
    }
    expect(shipBlocks('shp01', 20, 0).some((x) => x.kind === 'action' && (x as { effectRef?: string }).effectRef === 'eff_s7_jihuopao_l20')).toBe(true);
    expect(shipBlocks('shp01', 1, 4).some((x) => x.kind === 'affix' && (x as { affix?: string }).affix === 'skillRepeatCount')).toBe(true); // 极焰SS 连放
    expect(shipBlocks('shp07', 1, 0).some((x) => x.kind === 'trigger')).toBe(true); // 堡垒 Lv1 要塞展开（⑨挂牌解除=基础技上线）
    expect(shipBlocks('shp08', 1, 0).some((x) => x.kind === 'affix' && (x as { affix?: string }).affix === 'dmgToTeamShieldPct')).toBe(true); // 山岳磁暴盾
    expect(shipBlocks('shp12', 1, 4).some((x) => x.kind === 'trigger' && (x as { effectRef?: string }).effectRef === 'eff_s7_liansuo_ss_boom')).toBe(true); // 霹雳SS
    expect(shipBlocks('shp15', 1, 4).some((x) => x.kind === 'action' && (x as { effectRef?: string }).effectRef === 'eff_s7_ganlin_ss')).toBe(true); // 甘霖SS 复活
    expect(shipBlocks('shp18', 10, 0).some((x) => x.kind === 'affix' && (x as { affix?: string }).affix === 'summonSyncFire')).toBe(true); // 蜂巢同步开火
    expect(shipBlocks('shp09', 10, 0).some((x) => x.kind === 'affix' && (x as { affix?: string }).affix === 'normalAtkDmgPct')).toBe(true); // 烈阳重火力词条
  });
});

describe('机制批③段二b-堡垒「要塞展开」（⑨挂牌解除·停普攻+减伤+结束反击）', () => {
  it('要塞期间普攻停+受伤−70%·4s 到期反击 ×3.0（A 积能=受击次放大）', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_star_ring_charger',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, normalEffectRef: 'eff_basic_attack' },
      enemies: [{ rowId: 'bu_st_e0', slot: 'r0c0', overrides: { attack: 100 } }],
      timeLimitSec: 6,
    });
    // A 阶（fortressChargePct 0.5）：t0 开要塞（4s）→ 期间敌打 4 发（t0-t3·各 80×0.3=24）→ t4 到期反击。
    const r = await runShip(b, 'bu_ship_star_ring_charger', 1, 2, 'shp07');
    const own = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2');
    // 要塞期间（<4s）无普攻输出。
    expect(own.filter((e) => (e.timeSec ?? 0) < 3.9).length).toBe(0);
    // 期间受伤 80×(1−0.7)=24（L1 档 −70%）。
    const taken = r.log.filter((e) => e.type === 'damage' && (e.targetIds ?? [])[0] === 'player_p1c2' && (e.timeSec ?? 0) < 4);
    expect(taken.every((e) => e.amount === 24)).toBe(true);
    // 到期反击：受击 4 次 → ×(1+0.5×4)=×3 → 100×3.0×3×100/125=720。
    const counter = r.log.find((e) => e.type === 'damage' && e.effectRef === 'eff_s7_yaosai_counter');
    expect(counter?.amount).toBe(720);
    expect(counter?.timeSec).toBeCloseTo(4, 5);
  });
});

describe('机制批③段二b-山岳「磁暴盾」（⑨挂牌解除·受伤转全队盾）', () => {
  it('受 80 伤 → 全队各得 round(80×0.15)/队伍数 护盾（单人=12）', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_sweeper_drone',
      shipOverrides: { maxHp: 100000, attack: 1, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, normalEffectRef: 'eff_basic_attack', ultimateEffectRef: 'none', ultimateCdSec: 0 },
      enemies: [{ rowId: 'bu_st_e0', slot: 'r0c0', overrides: { attack: 100 } }],
      timeLimitSec: 1.2,
    });
    const r = await runShip(b, 'bu_ship_sweeper_drone', 1, 0, 'shp08');
    const conv = r.log.find((e) => e.type === 'state_apply' && e.effectRef === 'storm_shield');
    expect(conv?.amount).toBe(12); // round(80×0.15)=12·单人全得
    expect(r.finalState.players[0].shield).toBeGreaterThan(0);
  });
});

describe('机制批③段二b-霹雳SS「引爆短路」（晚成调热件）', () => {
  it('放连锁闪电（必短路档）→ 同拍引爆全部被短路敌 ×2.5（未短路者不吃爆）', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_oldport_flex',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, normalEffectRef: 'eff_basic_attack' },
      enemies: [
        { rowId: 'bu_st_e0', slot: 'r0c0' },
        { rowId: 'bu_st_e1', slot: 'r1c0' },
        { rowId: 'bu_st_immune', slot: 'r2c0', overrides: {
          // 对照敌：开场免疫减益（短路上不去）→ 不吃引爆（条件目标门真咬合·防假绿）。
          extraTriggerBlocks: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_plg_dimmune' }],
        } },
        { rowId: 'bu_st_far', slot: 'r4c6' },
      ],
      timeLimitSec: 0.6,
    });
    // SS 档=liansuo_a（每跳必短路）+ skill_cast 引爆：t0 闪电中 4 敌·3 被短路（免疫敌挡下）→ 同拍爆 3 发 ×2.5=200。
    const r = await runShip(b, 'bu_ship_oldport_flex', 100, 4, 'shp12');
    const booms = r.log.filter((e) => e.type === 'damage' && e.effectRef === 'eff_s7_liansuo_ss_boom');
    expect(booms.length).toBe(3); // 免疫敌不吃爆=条件门生效
    expect(booms.every((e) => e.amount === 200)).toBe(true); // 100×2.5×100/125=200（burst 走常规管线·防25）
    expect(booms.every((e) => (e.targetIds ?? [])[0] !== 'enemy_0002')).toBe(true); // enemy_0002=免疫敌
  });
});

describe('机制批③段二b-甘霖SS「复活」（晚成调热件）', () => {
  it('阵亡友军被复活（血 50%·每场一次）+全队回血', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_shp15',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, ultimateCdSec: 11 },
      enemies: [{ rowId: 'bu_st_killer', slot: 'r0c0', overrides: { attack: 500, targetingTag: 'backline_first' } }],
      timeLimitSec: 13,
    });
    // 脆皮 p1c0（500 血）：敌 400/发 t0 即打残 → t1 致死；甘霖 SS 治疗波 CD11 → t11 第二次施放时复活它。
    const frail = row(b, 'battle_unit_stat_param', 'bu_ship_vanguard');
    Object.assign(frail, { maxHp: 500, attack: 1, armor: 25, normalEffectRef: 'eff_basic_attack', ultimateEffectRef: 'none', ultimateCdSec: 0 });
    delete (frail as Row).extraTriggerBlocks;
    delete (frail as Row).stackRules;
    const units: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c0' },
      { unitStatRef: 'bu_ship_shp15', slotRef: 'p1c2', effectBlocks: [...shipBlocks('shp15', 1, 4)] },
    ];
    const r = await (await engineOf(b)).run({ encounterRef: 'enc_n001', battleSeed: 'st', playerUnits: units });
    const revive = r.log.find((e) => e.type === 'revive');
    expect(revive?.targetIds).toEqual(['player_p1c0']);
    expect(revive?.amount).toBe(250); // 500×0.5
    expect(r.log.filter((e) => e.type === 'revive')).toHaveLength(1); // 每场一次（后续施放不再复活）
  });
});

describe('机制批③段二b-蜂巢「同步开火」+ 群蜂「弹巢」（⑨挂牌解除）', () => {
  it('蜂巢放蜂群→在场无人机同拍齐射（sync_fire 记号）', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_shp18',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, ultimateCdSec: 4 },
      enemies: [{ rowId: 'bu_st_e0', slot: 'r0c0' }],
      timeLimitSec: 6,
    });
    const r = await runShip(b, 'bu_ship_shp18', 10, 0, 'shp18');
    // t0 蜂群召 3 架（无 sync 对象=召唤先行）；t4 第二次放技能 → 在场 3 架齐射（note=sync_fire）。
    const sync = r.log.filter((e) => e.type === 'unit_attack' && e.note === 'sync_fire');
    expect(sync.length).toBeGreaterThanOrEqual(3);
  });

  it('群蜂弹巢：敌 ≥6 时普攻升 3×3（unit_attack 多目标）·敌少时单发', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_flashrail_reaper',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9 },
      // 布阵：主目标 r1c0；十字可收 r0c0/r2c0/r1c1（+主=4）；斜角 r0c1/r2c1 只有 3×3 能收（≥5=弹巢实证）。
      enemies: [
        { rowId: 'bu_st_sw0', slot: 'r1c0' },
        { rowId: 'bu_st_sw1', slot: 'r0c0' },
        { rowId: 'bu_st_sw2', slot: 'r2c0' },
        { rowId: 'bu_st_sw3', slot: 'r1c1' },
        { rowId: 'bu_st_sw4', slot: 'r0c1' },
        { rowId: 'bu_st_sw5', slot: 'r2c1' },
      ],
      timeLimitSec: 1.2,
    });
    const r = await runShip(b, 'bu_ship_flashrail_reaper', 10, 0, 'shp10');
    const atks = r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2' && e.note === undefined);
    expect(atks.length).toBeGreaterThanOrEqual(1);
    expect((atks[0].targetIds ?? []).length).toBeGreaterThanOrEqual(5); // 3×3 收斜角（十字上限 4=弹巢关掉必红）
  });
});

describe('机制批③段二b-烈阳「重火力」专项词条（⑨挂牌解除）', () => {
  it('Lv10：普攻 ×1.2×1.25=120·技能不吃普攻专项', async () => {
    const b = rigShip({
      shipRow: 'bu_ship_longwave_suppressor',
      shipOverrides: { maxHp: 100000, attack: 100, armor: 25, attackIntervalSec: 1, attackRangeCells: 9, ultimateCdSec: 9 },
      enemies: [{ rowId: 'bu_st_e0', slot: 'r0c0' }],
      timeLimitSec: 1.2,
    });
    const r = await runShip(b, 'bu_ship_longwave_suppressor', 10, 0, 'shp09');
    // 烈阳普攻行 eff_s7_normal_x12=×1.2 → ×(1+0.25) 专项 → 100×1.2×1.25×0.8=120。
    const normals = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p1c2' && e.effectRef === 'eff_s7_normal_x12');
    expect(normals[0]?.amount).toBe(120);
  });
});
