// BATTLE-RT-04: S7 专用纯 TS 实时自动战斗核心 S7AutoBattleEngine 测试。
// 覆盖任务包 §7 的 25 个要点：n001/n084/n150 跑通、同/异 seed、站位寻敌、能量/大招、
// 短路、护盾、治疗、清群/贯穿/后排、mark/vulnerable/shield_break、星核、Boss 阶段与召唤上限、
// 超时判负、静态隔离、配置只读、日志上限、tick 顺序稳定、日志 schema、满场召唤、输入校验、状态重入。
// 允许在内存里 clone 配置表制造边界用例；不改磁盘样例表。
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
  S7AutoBattleLogEntry,
  S7AutoBattlePlayerUnitInput,
  S7AutoBattleResult,
} from '../assets/scripts/core/s7/S7AutoBattleTypes';

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

function cloneBundle(b: Bundle): Bundle {
  return JSON.parse(JSON.stringify(b)) as Bundle;
}

function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`fixture 缺少 ${table}.${rowId}`);
  return r;
}

async function runtimeOf(b: Bundle): Promise<S7ConfigRuntime> {
  return S7ConfigRuntime.load(createInMemoryS7TableReader(b));
}

async function engineOf(b: Bundle): Promise<S7AutoBattleEngine> {
  return new S7AutoBattleEngine(await runtimeOf(b));
}

// ---- 日志查询小工具 ----
const ofType = (log: S7AutoBattleLogEntry[], type: string): S7AutoBattleLogEntry[] => log.filter((e) => e.type === type);
const typeSet = (log: S7AutoBattleLogEntry[]): Set<string> => new Set(log.map((e) => e.type));
function firstAttack(log: S7AutoBattleLogEntry[], actorId: string): S7AutoBattleLogEntry | undefined {
  return log.find((e) => e.type === 'unit_attack' && e.actorId === actorId);
}
function summonedCount(log: S7AutoBattleLogEntry[]): number {
  return ofType(log, 'spawn_wave')
    .filter((e) => e.note === 'phase_summon' || e.note === 'effect_summon')
    .reduce((acc, e) => acc + (e.targetIds?.length ?? 0), 0);
}

// ---- 常用阵容 ----
const TRIO: S7AutoBattlePlayerUnitInput[] = [
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c2' },
];
const FIVE: S7AutoBattlePlayerUnitInput[] = [
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p2c2' },
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c1' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c1' },
];

describe('S7AutoBattleEngine - n001 群怪割草 (#1)', () => {
  it('用 3 艘样例星舰刷出两波共 14 只小怪并跑完，含必备事件', async () => {
    const engine = await engineOf(loadBundle());
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'seed-1', playerUnits: TRIO });
    expect(r.winner).toBe('player');
    expect(r.reason).toBe('all_enemies_down');
    const waves = ofType(r.log, 'spawn_wave').filter((e) => e.note === 'spawn_n001_w1' || e.note === 'spawn_n001_w2');
    expect(waves.length).toBe(2);
    const spawned = waves.reduce((a, e) => a + (e.targetIds?.length ?? 0), 0);
    expect(spawned).toBe(14);
    for (const t of ['spawn_wave', 'unit_attack', 'damage', 'unit_down', 'battle_end']) {
      expect(typeSet(r.log).has(t)).toBe(true);
    }
    expect(ofType(r.log, 'unit_down').length).toBe(14);
  });
});

describe('S7AutoBattleEngine - 同/异 seed (#2,#3)', () => {
  it('同一 seed 跑两次 result 与 log 完全一致 (#2)', async () => {
    const engine = await engineOf(loadBundle());
    const a = engine.run({ encounterRef: 'enc_n001', battleSeed: 'same', playerUnits: TRIO });
    const b = engine.run({ encounterRef: 'enc_n001', battleSeed: 'same', playerUnits: TRIO });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('最近目标并列时不同 seed 产生可观察差异 (#3)', async () => {
    // 两个与攻击者等距的敌人（r0c0 / r2c0 对 p1c2 均为距离 2），高血量保活，首攻目标由 seed 决定。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { count: 1, slotRefs: ['r2c0'], spawnDelaySec: 0 });
    const engine = await engineOf(b);
    const attacker = { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' };
    const firstTargets = new Set<string>();
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: seed, playerUnits: [attacker] });
      const fa = firstAttack(r.log, 'player_p1c2');
      if (fa?.targetIds?.[0]) firstTargets.add(fa.targetIds[0]);
    }
    expect(firstTargets.size).toBeGreaterThan(1); // 不同 seed 命中了不同的并列目标
  });
});

describe('S7AutoBattleEngine - 站位影响寻敌 (#4)', () => {
  it('前排 vs 后排同一星舰首次出手时机不同', async () => {
    // 近战 vanguard(range1)：p0c2(行0)可即时打到 w1 行0 敌人；p1c2(行1)够不到行0，须等 w2 行1(5s 后)。
    // 块2：去掉 vanguard 大招（否则开局即放 clear_barrage 会先清掉小怪、令普攻无目标），以隔离“按站位的普攻时机”。
    // ⑥第一段重定基：全舰默认射程改 99（C16 无限射程口径）——本测试测的是"射程过滤×站位"引擎机制，
    // 夹具显式恢复 range1 前提（机制未变，变的是行默认值）。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), { ultimateEffectRef: 'none', ultimateCdSec: 0, attackRangeCells: 1 });
    // 批③段三重锚：敌射程按真源改无限（99）后，w1 敌从 t=0 就射得到后排孤舰、5s 内打死→"后排首击"消失。
    // 夹具钉敌 attack=1 无害化（同 #5/#6 惯例），隔离"站位×射程"机制本体——机制未变。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { attack: 1 });
    const engine = await engineOf(b);
    const front = engine.run({ encounterRef: 'enc_n001', battleSeed: 'pos', playerUnits: [{ unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' }] });
    const back = engine.run({ encounterRef: 'enc_n001', battleSeed: 'pos', playerUnits: [{ unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c2' }] });
    const frontFirst = firstAttack(front.log, 'player_p0c2');
    const backFirst = firstAttack(back.log, 'player_p1c2');
    expect(frontFirst?.timeSec).toBe(0);
    expect(backFirst).toBeDefined();
    expect(backFirst!.timeSec).toBeGreaterThan(0);
    expect(backFirst!.timeSec).toBeGreaterThanOrEqual(5);
  });
});

describe('S7AutoBattleEngine - 技能触发 (#5,#6)', () => {
  it('够不到敌人(无普攻)的单位仍按 CD 触发释放技能 (#5)', async () => {
    // guardian 放后排(p0c0)够不到 r0c6 远敌→不普攻；其大招按 CD 触发(开局即放)。
    // ⑥第一段重定基：默认射程 99（C16）→ 夹具显式 range1 恢复"够不到"前提（大招现=eff_s7_fenbiao·断言只看有放）。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_guardian'), { passiveEnergyPerSec: 100, attackRangeCells: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 1, attackRangeCells: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c6'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'pass', playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }] });
    expect(firstAttack(r.log, 'player_p0c0')).toBeUndefined(); // 全程够不到，无普攻
    const ults = ofType(r.log, 'ultimate_cast').filter((e) => e.actorId === 'player_p0c0');
    expect(ults.length).toBeGreaterThan(0); // 无普攻也能靠 CD 触发放技能
  });

  it('技能(CD触发)可与普攻在同一 tick 发生 (#6)', async () => {
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { attack: 100, passiveEnergyPerSec: 0, attackRangeCells: 7 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'atk', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const ult = ofType(r.log, 'ultimate_cast').find((e) => e.actorId === 'player_p0c2');
    expect(ult).toBeDefined();
    // CD 触发的大招与普攻可在同一 tick 发生（开局即放 + 普攻均在 t=0）。
    const sameTickAttack = r.log.some((e) => e.type === 'unit_attack' && e.actorId === 'player_p0c2' && e.timeSec === ult!.timeSec);
    expect(sameTickAttack).toBe(true);
  });
});

describe('S7AutoBattleEngine - 短路抑制行动 (#7)', () => {
  it('short_circuit 期间敌人不普攻、不放大招', async () => {
    // 一艘 passive 拉满的船在 t=0 用 short_circuit_pulse 短路全体敌人；对照组用清群大招不带控制。
    const make = (ultRef: string): Bundle => {
      const b = cloneBundle(loadBundle());
      Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { passiveEnergyPerSec: 500, ultimateEffectRef: ultRef, attackRangeCells: 7 });
      Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 30 });
      Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
      Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
      return b;
    };
    const sc = await engineOf(make('eff_ult_short_circuit_pulse'));
    const rSc = sc.run({ encounterRef: 'enc_n001', battleSeed: 'sc', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const scApply = ofType(rSc.log, 'state_apply').find((e) => e.stateTag === 'short_circuit');
    expect(scApply).toBeDefined();
    // 短路窗口 [t, t+2) 内被短路敌人不出手。
    const enemyAttacksInWindow = rSc.log.filter(
      (e) => e.type === 'unit_attack' && e.side === 'enemy' && e.timeSec >= scApply!.timeSec && e.timeSec < scApply!.timeSec + 2,
    );
    expect(enemyAttacksInWindow.length).toBe(0);
  });
});

describe('S7AutoBattleEngine - 护盾先扣盾再扣血 (#8)', () => {
  it('护盾吸收伤害时先掉 shield，盾破后才掉 hp', async () => {
    // 敌人自带护盾(自我开盾)，玩家攻击：先看 shieldAfter 下降而 hp 不变，盾清空后 hp 才下降。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_shield'), { maxHp: 1000, armor: 25, attack: 1, passiveEnergyPerSec: 500 });
    Object.assign(row(b, 'battle_effect_param', 'eff_state_shield'), { durationSec: 60 });
    // ⑥第一段重定基：gunner(影刃) 现自带狙杀×4 开局即放会一发打穿 200 盾、"扣盾不掉血"命中不再出现——
    // 夹具去掉大招以隔离普攻扣盾路径（引擎盾结算机制未变）。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { attack: 100, attackRangeCells: 7, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_shield'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_shield', count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'shield', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const dmgs = r.log.filter((e) => e.type === 'damage' && e.side === 'player' && (e.targetIds ?? []).some((id) => id.startsWith('enemy_')));
    expect(dmgs.length).toBeGreaterThan(2);
    // 至少存在“扣盾不掉血”的命中（amount=0 且 shieldAfter 较小于满盾），且其 hpAfter 仍为满血。
    const absorbed = dmgs.filter((e) => (e.amount ?? -1) === 0 && (e.shieldAfter ?? 0) > 0);
    expect(absorbed.length).toBeGreaterThan(0);
    // 批③段三重锚：敌方大招首放转满一轮 CD（躯干节奏规则）→ 自盾 8s 才起、盾前 hp 已从 1000 被啃到起盾值——
    // 旧断言"hpAfter 恒 1000"前提失效。改断"盾期血冻结"：所有吸收命中 hpAfter 相同（盾在则血不动·机制未变）。
    const hpAtShield = absorbed[0].hpAfter;
    expect(absorbed.every((e) => e.hpAfter === hpAtShield)).toBe(true);
  });
});

describe('S7AutoBattleEngine - 治疗与超时 (#9)', () => {
  it('repair_burst 能治疗友方且不会因互奶在超时后误判玩家胜', async () => {
    // 一艘奶(ult=repair_burst)+一艘脆皮坦受伤；面对高血 Boss 打不死→超时判敌方胜，但 heal 真实发生。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { ultimateEffectRef: 'eff_ult_repair_burst', attack: 100, passiveEnergyPerSec: 30 });
    // 批③段三重锚：躯干重校后 n084 落数敌火杀穿本双舰夹具（奶还没放人先没）——钉低全部 n084 敌攻，
    // 隔离"真实奶到友方 + 超时不误判"机制本体。
    for (const u of b.battle_unit_stat_param as Array<Record<string, unknown>>) {
      if (/^bu_(boss_)?n084/.test(String(u.rowId))) u.attack = 12;
    }
    const engine = await engineOf(b);
    const lineup: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c0' }, // 奶妈放后排少挨打
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' }, // 前排受伤目标
    ];
    const r = engine.run({ encounterRef: 'enc_n084', battleSeed: 'heal', playerUnits: lineup });
    const heals = ofType(r.log, 'heal').filter((e) => (e.amount ?? 0) > 0);
    expect(heals.length).toBeGreaterThan(0); // 真实奶到友方
    expect(heals.every((e) => typeof e.shieldAfter === 'number')).toBe(true); // RT-04-fix#1：heal 补 shieldAfter
    if (r.reason === 'timeout') {
      expect(r.winner).toBe('enemy'); // 超时未清敌→敌方胜，绝不因奶量误判玩家赢
    }
  });
});

describe('S7AutoBattleEngine - 大招目标模板 (#10,#11,#12)', () => {
  it('clear_barrage 单次大招命中多个敌人 (#10)', async () => {
    // vanguard 大招=clear_barrage(maxTargets8)，passive 拉满 t=0 即放，铺一行 7 个小怪。
    // ⑥第一段重定基：vanguard(极焰) 默认大招已换 eff_s7_jihuopao（单体）——本测试测 clear_barrage 模板，夹具显式指回。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), { passiveEnergyPerSec: 500, ultimateEffectRef: 'eff_ult_clear_barrage', ultimateCdSec: 10 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'cb', playerUnits: [{ unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c2' }] });
    const ult = ofType(r.log, 'ultimate_cast').find((e) => e.effectType === 'clear_barrage');
    expect(ult).toBeDefined();
    expect((ult!.targetIds ?? []).length).toBeGreaterThan(1);
  });

  it('line_pierce 按列命中 (#11)', async () => {
    // 敌人排成一列(r0c0/r1c0/r2c0)，gunner 大招=line_pierce(column_line) 命中同列多人。
    // ⑥第一段重定基：gunner(影刃) 默认大招已换 eff_s7_jusha（单体）——本测试测 line_pierce 模板，夹具显式指回。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { passiveEnergyPerSec: 500, ultimateEffectRef: 'eff_ult_line_pierce' });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 3, slotRefs: ['r0c0', 'r1c0', 'r2c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'lp', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' }] });
    const ult = ofType(r.log, 'ultimate_cast').find((e) => e.effectType === 'line_pierce');
    expect(ult).toBeDefined();
    expect((ult!.targetIds ?? []).length).toBeGreaterThan(1);
  });

  it('backline_strike 优先打后排(高列) (#12)', async () => {
    // 敌人 r0c0(前) 与 r0c6(后排)，某船大招=backline_strike 应先点后排 r0c6。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { passiveEnergyPerSec: 500, ultimateEffectRef: 'eff_ult_backline_strike' });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 2, slotRefs: ['r0c0', 'r0c6'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'bl', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' }] });
    const ult = ofType(r.log, 'ultimate_cast').find((e) => e.effectType === 'backline_strike');
    expect(ult).toBeDefined();
    // 后排 r0c6 是第二个出怪(enemy_0001)；backline_first 应先选它。
    expect(ult!.targetIds?.[0]).toBe('enemy_0001');
  });
});

describe('S7AutoBattleEngine - mark/vulnerable/shield_break 行为 (#13)', () => {
  it('mark：同距离并列时被标记目标优先被选中', async () => {
    // marker(passive 拉满,t=0 标记最近的 r0c0)；attacker 对 r0c0/r2c0 等距，应恒选被标记的 r0c0。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), { passiveEnergyPerSec: 500, ultimateEffectRef: 'eff_state_mark', attackRangeCells: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { count: 1, slotRefs: ['r2c0'], spawnDelaySec: 0 });
    const engine = await engineOf(b);
    const lineup: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' }, // marker：最近=r0c0
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' }, // attacker：r0c0/r2c0 等距
    ];
    // 跨多个 seed 都应选中被标记的 enemy_0000(r0c0)，证明并非 RNG 偶然。
    for (const seed of ['m1', 'm2', 'm3', 'm4', 'm5']) {
      const r = engine.run({ encounterRef: 'enc_n001', battleSeed: seed, playerUnits: lineup });
      expect(ofType(r.log, 'state_apply').some((e) => e.stateTag === 'mark')).toBe(true);
      const gunnerHits = r.log.filter((e) => e.type === 'unit_attack' && e.actorId === 'player_p1c2');
      expect(gunnerHits.length).toBeGreaterThan(0);
      expect(gunnerHits[0].targetIds?.[0]).toBe('enemy_0000');
    }
  });

  it('vulnerable：被易伤目标受到 1.25x 伤害（80→100）', async () => {
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { attack: 100, attackRangeCells: 7, ultimateEffectRef: 'eff_state_vulnerable', passiveEnergyPerSec: 7 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, armor: 25, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'vuln', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const apply = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'vulnerable');
    expect(apply).toBeDefined();
    const dmgs = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
    expect(dmgs.some((e) => e.amount === 80)).toBe(true); // 易伤前
    const after = dmgs.filter((e) => e.timeSec > apply!.timeSec);
    expect(after.some((e) => e.amount === 100)).toBe(true); // 易伤后 1.25x
  });

  it('shield_break：破盾期间护盾掉得更快（80→120/击）', async () => {
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_shield'), { maxHp: 100000, armor: 25, attack: 1, ultimateCdSec: 0.2 }); // 块2：每 tick 自我回盾到 20000 改由短 CD(0.2=每 tick) 触发
    // 批③段三重锚：全局盾行改 shieldMaxHpPct 0.25（盾题咬合）→ 夹具显式钉回 0.2 保"20000 盾"前提（破盾机制未变）。
    Object.assign(row(b, 'battle_effect_param', 'eff_state_shield'), { durationSec: 60, shieldMaxHpPct: 0.2 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { attack: 100, attackRangeCells: 7, ultimateEffectRef: 'eff_state_shield_break', passiveEnergyPerSec: 7 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_shield'], spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_shield', count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'sb', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const apply = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'shield_break');
    expect(apply).toBeDefined();
    const hits = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
    // 敌人每 tick 自我回满盾到 20000；普攻命中后 shieldAfter = 20000 - shieldLoss。
    expect(hits.some((e) => e.shieldAfter === 19920)).toBe(true); // 破盾前掉 80
    expect(hits.some((e) => e.shieldAfter === 19880 && e.timeSec >= apply!.timeSec)).toBe(true); // 破盾后掉 120
  });
});

describe('S7AutoBattleEngine - 星核触发 (#14)', () => {
  it('coreEffectRef 在首次大招后触发一次 core_trigger', async () => {
    // ⑥第一段重定基：真源影刃无自带核，gunner 行 coreEffectRef 已改 none（星核=装配层积木下发）——
    // 本测试测"行级 core 钩子"引擎机制，夹具显式挂回 eff_core_blackhole。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { coreEffectRef: 'eff_core_blackhole' });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'core', playerUnits: TRIO });
    const cores = ofType(r.log, 'core_trigger').filter((e) => e.actorId === 'player_p1c2');
    expect(cores.length).toBe(1);
    expect(cores[0].effectRef).toBe('eff_core_blackhole');
  });
});

describe('S7AutoBattleEngine - Boss 阶段 (#15,#16)', () => {
  // 段二战斗批重定基：载体 n084/n150（150 关旧世界 Boss 位）→n104/n450（450 关墙①/毕业战）。
  // #15/#16 只验阶段切换与召唤 cap 逻辑——敌场钉手调量纲（同旧 fixture 手法），机制语义零变化。
  // 450 关占位 Boss 仅 mid/final 两段（真阶段=段 2 对位手调）——#15 的三阶段时序覆盖靠 fixture
  // 内存补一段 start（battle_start 触发·不动磁盘表），"start/mid/final 按序"引擎行为覆盖不缩水。
  const pinN104 = (b: Bundle): Bundle => {
    for (const u of b.battle_unit_stat_param as Array<Record<string, unknown>>) {
      if (/^bu_n104_/.test(String(u.rowId))) { u.attack = 30; u.maxHp = 400; }
    }
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_boss_n104'), { maxHp: 6000, attack: 120 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n104_adds'), { unitStatRef: 'bu_enemy_shield' });
    (b.battle_boss_phase_param as Array<Record<string, unknown>>).push({
      schemaVersion: 's7-0.1.0', rowId: 'phase_n104_start', bossNodeId: 'n104', phaseTag: 'start',
      triggerType: 'battle_start', triggerValue: 0, effectRefs: ['eff_state_shield'],
      summonUnitRefs: [], summonCountCap: 0, note: 'fixture 补 start 段（三阶段时序覆盖）',
    });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n104'), {
      enemyUnitStatRefs: ['bu_boss_n104', 'bu_enemy_shield'],
      bossPhaseRefs: ['phase_n104_start', 'phase_n104_mid', 'phase_n104_final'],
    });
    return b;
  };
  const pinN450 = (b: Bundle): Bundle => {
    for (const u of b.battle_unit_stat_param as Array<Record<string, unknown>>) {
      if (/^bu_n450_/.test(String(u.rowId))) u.attack = 30;
    }
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_boss_n450'), { maxHp: 14000, attack: 180 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n450_adds'), { unitStatRef: 'bu_enemy_boss_add' });
    // 占位 phase 无召唤（真召唤=段 2 对位手调）——#16 验"召唤 cap"须 fixture 给 mid 段塞召唤面。
    Object.assign(row(b, 'battle_boss_phase_param', 'phase_n450_mid'), {
      summonUnitRefs: ['bu_enemy_boss_add', 'bu_enemy_boss_add'], summonCountCap: 10,
    });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n450'), { enemyUnitStatRefs: ['bu_boss_n450', 'bu_enemy_boss_add'] });
    return b;
  };

  it('n104 Boss 触发 start / mid / final 三阶段 (#15)', async () => {
    const engine = await engineOf(pinN104(cloneBundle(loadBundle())));
    const r = engine.run({ encounterRef: 'enc_n104', battleSeed: 'n104', playerUnits: FIVE });
    const phases = ofType(r.log, 'boss_phase').map((e) => e.phaseTag);
    expect(phases).toEqual(['start', 'mid', 'final']);
  });

  it('n450 Boss 召唤总量不超过 10 并记录 boss_phase (#16)', async () => {
    const engine = await engineOf(pinN450(cloneBundle(loadBundle())));
    const r = engine.run({ encounterRef: 'enc_n450', battleSeed: 'n450', playerUnits: FIVE });
    expect(ofType(r.log, 'boss_phase').length).toBeGreaterThan(0);
    expect(summonedCount(r.log)).toBeLessThanOrEqual(10);
  });
});

describe('S7AutoBattleEngine - 超时判负 (#17)', () => {
  it('超时未清敌时玩家失败，reason=timeout', async () => {
    // 单艘脆皮 vs n150 终 Boss：必然超时或被清，构造极弱阵容确保非 all_enemies_down。
    const engine = await engineOf(loadBundle());
    const r = engine.run({ encounterRef: 'enc_n150', battleSeed: 'to', playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }] });
    expect(r.winner).toBe('enemy');
    expect(['timeout', 'all_players_down']).toContain(r.reason);
    // 进一步：超大血量 Boss、单奶阵容必然超时。
    const b = cloneBundle(loadBundle());
    // 批③段三重锚：躯干重校后 n150 敌火 120s 能磨掉 10 万血——加厚到 100 万保"必然超时"前提（判负机制未变）。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_guardian'), { ultimateEffectRef: 'eff_ult_repair_burst', maxHp: 1000000, armor: 200 });
    const engine2 = await engineOf(b);
    const r2 = engine2.run({ encounterRef: 'enc_n150', battleSeed: 'to2', playerUnits: [{ unitStatRef: 'bu_ship_guardian', slotRef: 'p0c0' }] });
    expect(r2.reason).toBe('timeout');
    expect(r2.winner).toBe('enemy');
    expect(r2.durationSec).toBe(120);
  });
});

describe('S7AutoBattleEngine - 静态隔离 (#18)', () => {
  it('引擎/类型/RNG 源文件不 import 流程版战斗模块或 cc', () => {
    const forbidden = [
      'BattleEngine', 'BattleUnit', 'HeroConfig', 'EnemyConfig', 'SkillConfig',
      'BattleLaunchService', 'BattlePlaybackService',
    ];
    for (const file of ['S7AutoBattleEngine.ts', 'S7AutoBattleTypes.ts', 'S7AutoBattleRng.ts']) {
      const src = readFileSync(path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', file), 'utf-8');
      const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
      for (const line of importLines) {
        for (const name of forbidden) expect(line.includes(name)).toBe(false);
        expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
        expect(/combat\//.test(line)).toBe(false);
      }
    }
  });
});

describe('S7AutoBattleEngine - 运行不改配置 (#19)', () => {
  it('跑一场战斗不修改 runtime 里的配置行', async () => {
    const rt = await runtimeOf(loadBundle());
    const before = JSON.stringify({
      units: rt.getAll('battle_unit_stat_param'),
      effects: rt.getAll('battle_effect_param'),
      encounters: rt.getAll('battle_encounter_param'),
      spawns: rt.getAll('battle_spawn_param'),
      phases: rt.getAll('battle_boss_phase_param'),
    });
    const engine = new S7AutoBattleEngine(rt);
    engine.run({ encounterRef: 'enc_n084', battleSeed: 'immut', playerUnits: FIVE });
    engine.run({ encounterRef: 'enc_n150', battleSeed: 'immut', playerUnits: FIVE });
    const after = JSON.stringify({
      units: rt.getAll('battle_unit_stat_param'),
      effects: rt.getAll('battle_effect_param'),
      encounters: rt.getAll('battle_encounter_param'),
      spawns: rt.getAll('battle_spawn_param'),
      phases: rt.getAll('battle_boss_phase_param'),
    });
    expect(after).toBe(before);
  });
});

describe('S7AutoBattleEngine - 日志上限 (#20)', () => {
  it('n150 日志为事件触发，长度有上限（< 1000）', async () => {
    const engine = await engineOf(loadBundle());
    const r = engine.run({ encounterRef: 'enc_n150', battleSeed: 'len', playerUnits: FIVE });
    expect(r.log.length).toBeLessThan(1000);
  });
});

describe('S7AutoBattleEngine - tick 顺序稳定 (#21)', () => {
  it('同 seed 下整条日志的(类型/时间/行动者)序列完全固定', async () => {
    const engine = await engineOf(loadBundle());
    const a = engine.run({ encounterRef: 'enc_n084', battleSeed: 'order', playerUnits: FIVE });
    const b = engine.run({ encounterRef: 'enc_n084', battleSeed: 'order', playerUnits: FIVE });
    const seq = (r: S7AutoBattleResult): string => r.log.map((e) => `${e.timeSec}|${e.type}|${e.actorId ?? ''}|${e.stateTag ?? ''}|${e.phaseTag ?? ''}`).join('\n');
    expect(seq(a)).toBe(seq(b));
    // 同一 tick 内固定顺序：state_expire 早于该 tick 的 unit_attack；boss_phase 早于 unit_down。
    const byTick = new Map<number, string[]>();
    for (const e of a.log) {
      const arr = byTick.get(e.timeSec) ?? [];
      arr.push(e.type);
      byTick.set(e.timeSec, arr);
    }
    for (const [, types] of byTick) {
      const iExpire = types.indexOf('state_expire');
      const iAttack = types.indexOf('unit_attack');
      if (iExpire >= 0 && iAttack >= 0) expect(iExpire).toBeLessThan(iAttack);
      const iPhase = types.lastIndexOf('boss_phase');
      const iDown = types.indexOf('unit_down');
      if (iPhase >= 0 && iDown >= 0) expect(iPhase).toBeLessThan(iDown);
    }
  });
});

describe('S7AutoBattleEngine - 日志 schema (#22)', () => {
  it('关键事件含必备字段', async () => {
    const engine = await engineOf(loadBundle());
    const r = engine.run({ encounterRef: 'enc_n084', battleSeed: 'schema', playerUnits: FIVE });
    for (const e of r.log) {
      expect(typeof e.timeSec).toBe('number');
      expect(typeof e.type).toBe('string');
      switch (e.type) {
        case 'spawn_wave':
          expect(Array.isArray(e.targetIds)).toBe(true);
          break;
        case 'unit_attack':
          expect(typeof e.actorId).toBe('string');
          expect(Array.isArray(e.targetIds)).toBe(true);
          expect(typeof e.effectRef).toBe('string');
          break;
        case 'damage':
          expect(typeof e.actorId).toBe('string');
          expect(Array.isArray(e.targetIds)).toBe(true);
          expect(typeof e.amount).toBe('number');
          expect(typeof e.hpAfter).toBe('number');
          expect(typeof e.shieldAfter).toBe('number');
          expect(typeof e.effectRef).toBe('string');
          break;
        case 'heal':
          expect(typeof e.amount).toBe('number');
          expect(typeof e.hpAfter).toBe('number');
          expect(typeof e.shieldAfter).toBe('number'); // RT-04-fix#1
          break;
        case 'state_apply':
          expect(typeof e.stateTag).toBe('string');
          expect(Array.isArray(e.targetIds)).toBe(true);
          if (e.stateTag === 'shield') {
            // RT-04-fix#1：护盾变化必须带 amount + hpAfter + shieldAfter。
            expect(typeof e.amount).toBe('number');
            expect(typeof e.hpAfter).toBe('number');
            expect(typeof e.shieldAfter).toBe('number');
          }
          break;
        case 'state_expire':
          expect(typeof e.stateTag).toBe('string');
          expect(typeof e.actorId).toBe('string');
          break;
        case 'ultimate_cast':
        case 'core_trigger':
          expect(typeof e.actorId).toBe('string');
          expect(typeof e.effectRef).toBe('string');
          break;
        case 'boss_phase':
          expect(typeof e.phaseTag).toBe('string');
          expect(typeof e.actorId).toBe('string');
          break;
        case 'unit_down':
          expect(typeof e.actorId).toBe('string');
          break;
        case 'battle_end':
          expect(typeof e.winner).toBe('string');
          expect(typeof e.reason).toBe('string');
          expect(typeof e.durationSec).toBe('number');
          break;
        default:
          break;
      }
    }
  });
});

describe('S7AutoBattleEngine - 满场召唤 (#23)', () => {
  it('召唤受 summonCountCap 与空格双重约束：cap 触顶 / 满场少召 / 不报错', async () => {
    // 段二战斗批重定基：载体 n150→n450（毕业战位）；占位 Boss=2x2，fixture pin 回 3x3
    // （原格子算术 boss 占 9 格的布阵全部原样复用·尺寸也是 fixture 面=机制语义零变化）。
    // 23a：把 phase summonUnitRefs 加长到 12，cap=10；空格充裕时总召唤恰好触顶 cap。
    const b1 = cloneBundle(loadBundle());
    Object.assign(row(b1, 'battle_boss_phase_param', 'phase_n450_mid'), {
      summonUnitRefs: Array(12).fill('bu_enemy_boss_add'),
      summonCountCap: 10,
    });
    // 血 14000（=#16 已验证量纲·2500 被 FIVE 开局爆发同 tick 秒杀→phase 永不触发=DIAG 实证 0s 全灭）+关大招（隔离面同 affix 先例）。
    Object.assign(row(b1, 'battle_unit_stat_param', 'bu_boss_n450'), { maxHp: 14000, attack: 180, sizeRows: 3, sizeCols: 3, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    // 走量 adds 格位=r2 行中心（r2c2-c4）——与 fixture pin 的 3x3 Boss 底行（r0c2 锚→r0-r2×c2-c4）撞格，
    // Boss 会被静默跳过不生成（DIAG 实证 spawnWaves 无 boss 波）——adds 挪 r3 行避让。
    Object.assign(row(b1, 'battle_spawn_param', 'spawn_n450_adds'), { unitStatRef: 'bu_enemy_boss_add', slotRefs: ['r3c2', 'r3c3', 'r3c4'] });
    Object.assign(row(b1, 'battle_encounter_param', 'enc_n450'), { enemyUnitStatRefs: ['bu_boss_n450', 'bu_enemy_boss_add'] });
    const e1 = await engineOf(b1);
    const r1 = e1.run({ encounterRef: 'enc_n450', battleSeed: 'cap', playerUnits: FIVE });
    expect(ofType(r1.log, 'boss_phase').some((e) => e.phaseTag === 'mid')).toBe(true);
    expect(summonedCount(r1.log)).toBe(10); // 触顶 cap（5×7=35 空格充裕：boss 9 + 3 开场附属，余 23）

    // 23b：开场把敌方格子几乎填满（仅余 3 空格），mid 想召 12 但只能少召 3，不报错不无限刷。
    const b2 = cloneBundle(loadBundle());
    Object.assign(row(b2, 'battle_boss_phase_param', 'phase_n450_mid'), {
      summonUnitRefs: Array(12).fill('bu_enemy_boss_add'),
      summonCountCap: 10,
    });
    Object.assign(row(b2, 'battle_unit_stat_param', 'bu_boss_n450'), { maxHp: 14000, attack: 180, sizeRows: 3, sizeCols: 3, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b2, 'battle_encounter_param', 'enc_n450'), { enemyUnitStatRefs: ['bu_boss_n450', 'bu_enemy_boss_add'] });
    Object.assign(row(b2, 'battle_spawn_param', 'spawn_n450_adds'), {
      unitStatRef: 'bu_enemy_boss_add', // 落数后为节点行（厚）——钉回手调量纲

      // 5×7=35 格：boss 占 9（r0c2..r2c4）+ 23 附属 = 32，仅余 3 空格（r4c4/r4c5/r4c6）。
      count: 23,
      slotRefs: [
        'r0c0', 'r0c1', 'r0c5', 'r0c6', 'r1c0', 'r1c1', 'r1c5', 'r1c6',
        'r2c0', 'r2c1', 'r2c5', 'r2c6', 'r3c0', 'r3c1', 'r3c2', 'r3c3',
        'r3c4', 'r3c5', 'r3c6', 'r4c0', 'r4c1', 'r4c2', 'r4c3',
      ],
      maxConcurrentOnField: 35,
    });
    const e2 = await engineOf(b2);
    const r2 = e2.run({ encounterRef: 'enc_n450', battleSeed: 'cap2', playerUnits: FIVE });
    const summoned2 = summonedCount(r2.log);
    expect(summoned2).toBeLessThanOrEqual(10);
    expect(summoned2).toBeLessThan(10); // 满场少召，未触顶 cap
  });
});

describe('S7AutoBattleEngine - 输入校验 (#24)', () => {
  it('非法/重复玩家格、超过 5 艘、unitStatRef 非 ship 均抛错', async () => {
    const engine = await engineOf(loadBundle());
    const base = { encounterRef: 'enc_n001', battleSeed: 'x' };
    // 非法格
    expect(() => engine.run({ ...base, playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p3c0' }] })).toThrow();
    expect(() => engine.run({ ...base, playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'r0c0' }] })).toThrow();
    // 重复格
    expect(() => engine.run({ ...base, playerUnits: [
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' },
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c0' },
    ] })).toThrow();
    // 超过 5 艘
    expect(() => engine.run({ ...base, playerUnits: [
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c0' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c1' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c0' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c1' },
      { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
    ] })).toThrow();
    // unitStatRef 不是 ship（用敌人单位）
    expect(() => engine.run({ ...base, playerUnits: [{ unitStatRef: 'bu_enemy_swarm', slotRef: 'p0c0' }] })).toThrow();
    // 未知 unitStatRef
    expect(() => engine.run({ ...base, playerUnits: [{ unitStatRef: 'bu_nope', slotRef: 'p0c0' }] })).toThrow();
  });
});

describe('S7AutoBattleEngine - 状态重入 (#25)', () => {
  it('同名状态再次命中刷新持续时间，不叠层（到期次数=1 且 = 末次施加+时长）', async () => {
    // caster 反复短路 E(高血保活)，但被远程敌 F 在 ~2s 击杀后停手；E 的 short_circuit 仅在末次施加+2s 到期一次。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_vanguard'), {
      ultimateEffectRef: 'eff_state_short_circuit', ultimateCdSec: 0.4, maxHp: 200, attackRangeCells: 1, // 块2：反复短路改由短 CD(0.4s) 触发
    });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 1 }); // E：victim
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_shield'), { attack: 120, attackRangeCells: 7, passiveEnergyPerSec: 0 }); // F：远程击杀 caster
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), {
      enemyUnitStatRefs: ['bu_enemy_swarm', 'bu_enemy_shield'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'],
    });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_shield', count: 1, slotRefs: ['r0c1'], spawnDelaySec: 0 });
    const engine = await engineOf(b);
    const lineup: S7AutoBattlePlayerUnitInput[] = [
      { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' }, // caster（会被 F 杀）
      { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c0' }, // 续命，使战斗在 caster 死后继续
    ];
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'reentry', playerUnits: lineup });
    const applies = ofType(r.log, 'state_apply').filter((e) => e.stateTag === 'short_circuit' && (e.targetIds ?? []).includes('enemy_0000'));
    const expires = ofType(r.log, 'state_expire').filter((e) => e.stateTag === 'short_circuit' && e.actorId === 'enemy_0000');
    expect(applies.length).toBeGreaterThanOrEqual(2); // 多次命中
    expect(expires.length).toBe(1); // 不叠层：连续覆盖只到期一次
    const lastApplyBefore = Math.max(...applies.filter((a) => a.timeSec <= expires[0].timeSec).map((a) => a.timeSec));
    expect(Math.round((expires[0].timeSec - lastApplyBefore) * 10) / 10).toBe(2); // 到期 = 末次施加 + 2s
  });
});

// 块2：原“受击满能立刻放大招 (RT-04-fix#2)”测试已删除——其验证的“受击涨能→放大招”机制随
// v1.0 取消能量条而移除（不为绿而绿：该机制已不存在，故删测而非改断言）。受击触发(on_hit)留块2b 再立测试。

describe('S7AutoBattleEngine - stun 抑制行动 (RT-04-fix#3)', () => {
  it('stun 期间敌人不普攻、不放大招（晕眩压住其普攻与 CD 触发）', async () => {
    const b = cloneBundle(loadBundle());
    // 玩家 t=0 用 eff_state_stun 晕住最近敌人；敌人带大招且短 CD(0.4s 会持续想放)，验证被晕期间既不普攻也不放大招。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { ultimateEffectRef: 'eff_state_stun', attackRangeCells: 7, maxHp: 100000 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, attack: 30, ultimateEffectRef: 'eff_ult_burst_nuke', ultimateCdSec: 0.4 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'stun', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const apply = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'stun');
    expect(apply).toBeDefined();
    // 窗口取“晕眩生效后”（> apply）：排除同 tick 内敌人先于被晕的开局即放那一发（敌方在 stableUnits 先于玩家处理）。
    const inWindow = (e: S7AutoBattleLogEntry): boolean => e.side === 'enemy' && e.timeSec > apply!.timeSec && e.timeSec < apply!.timeSec + 2;
    expect(r.log.filter((e) => e.type === 'unit_attack' && inWindow(e)).length).toBe(0); // 晕眩期不普攻
    expect(r.log.filter((e) => e.type === 'ultimate_cast' && inWindow(e)).length).toBe(0); // 晕眩期不放大招（CD 到点也被压住）
  });
});

describe('S7AutoBattleEngine - berserk 行为 (RT-04-fix#3)', () => {
  it('berserk 生效后攻击力 x1.25（普攻伤害 80→100）', async () => {
    const b = cloneBundle(loadBundle());
    // ⑥第一段重定基：影刃行 CD 变 7s < berserk 时长 8s → 狂暴常驻无"80 伤空窗"——夹具恢复 CD10 保留 8-10s 空窗前提。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_ship_gunner'), { attack: 100, attackRangeCells: 7, ultimateEffectRef: 'eff_state_berserk', ultimateCdSec: 10, passiveEnergyPerSec: 7 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_swarm'), { maxHp: 100000, armor: 25, attack: 1 });
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'] });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'zerk', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    const apply = ofType(r.log, 'state_apply').find((e) => e.stateTag === 'berserk');
    expect(apply).toBeDefined();
    const dmgs = r.log.filter((e) => e.type === 'damage' && e.actorId === 'player_p0c2');
    expect(dmgs.some((e) => e.amount === 80)).toBe(true); // 狂暴前：100*100/125=80
    expect(dmgs.some((e) => e.amount === 100 && e.timeSec >= apply!.timeSec)).toBe(true); // 狂暴后：attack x1.25 → 100
  });
});

describe('S7AutoBattleEngine - pending spawn 不提前胜利 (RT-04-fix#4)', () => {
  it('两波之间清场不提前判胜，后续 wave 仍会刷出', async () => {
    // 两波各 1 只，w2 延迟 5s；gunner 秒掉 w1 后场上一度无敌人，但仍有 pending w2 → 不能提前判玩家胜。
    const b = cloneBundle(loadBundle());
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_swarm', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 5 });
    const engine = await engineOf(b);
    const r = engine.run({ encounterRef: 'enc_n001', battleSeed: 'pending', playerUnits: [{ unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' }] });
    expect(ofType(r.log, 'spawn_wave').length).toBe(2); // 两波都刷出（未在 w1 清场时提前胜利）
    expect(r.durationSec).toBeGreaterThanOrEqual(5); // 战斗持续到 w2 到达后才结束
    expect(r.winner).toBe('player');
    expect(r.reason).toBe('all_enemies_down');
    expect(ofType(r.log, 'unit_down').length).toBe(2); // 两波敌人都被清掉
  });
});
