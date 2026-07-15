// ⑩A4 · 敌配爆发窗口接线验证（真源=敌人真源 §3/§4/§5 · §20.6 #6/#10 缺口收口）。
// 战斗级：n138 污染潮+随时间狂暴 / 污染体三件套（易伤普攻·受击喷毒·越打越狂）/ 磁暴塔磁暴场 / n150 阶段3 狂暴全屏。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import { S7AutoBattleLogEntry } from '../assets/scripts/core/s7/S7AutoBattleTypes';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const clone = (b: Bundle): Bundle => JSON.parse(JSON.stringify(b)) as Bundle;
function row(b: Bundle, table: S7ConfigTableName, rowId: string): Row {
  const r = (b[table] as Row[]).find((x) => x.rowId === rowId);
  if (!r) throw new Error(`缺 ${table}.${rowId}`);
  return r;
}
const engineOf = async (b: Bundle): Promise<S7AutoBattleEngine> => new S7AutoBattleEngine(await S7ConfigRuntime.load(createInMemoryS7TableReader(b)));
type Dmg = { source: string; target: string; amount: number; t: number; effectRef?: string; periodic?: boolean };
const dmg = (log: S7AutoBattleLogEntry[]): Dmg[] => log.filter((e) => e.type === 'damage').map((e) => ({
  source: e.actorId ?? '', target: (e.targetIds ?? [])[0] ?? '', amount: e.amount ?? NaN, t: e.timeSec, effectRef: e.effectRef, periodic: e.periodic,
}));
/** 玩家双舰试验行（攻125/防25→净伤100 手推口径）。 */
function player(b: Bundle, rowId: string): void {
  Object.assign(row(b, 'battle_unit_stat_param', rowId), {
    ultimateEffectRef: 'none', ultimateCdSec: 0, coreEffectRef: 'none', normalEffectRef: 'eff_basic_attack',
    attackRangeCells: 99, maxHp: 1000000, armor: 25, attack: 125, attackIntervalSec: 1.0, targetingTag: 'nearest_random_tie',
  });
}

// 段2 恢复（挂起核销·换载体 n138→n340）：污染巨兽对位 n340（真源§5 原班挪位·BOSS_CONTENT 声明
// 落真机制=extra cd12 污染潮+stackRules per_second 0.02 狂暴+普攻 eff_normal_polluted）。
describe('⑩A4→段2 · n340 污染巨兽：污染潮（cd12 全屏+全队燃烧）+ 随时间狂暴（真源§5·M9 组合定式）', () => {
  it('全队周期吃 eff_pollution_tide + 燃烧跳伤；Boss 普攻随时间涨（+2%/s 狂暴）', async () => {
    const b = clone(loadBundle());
    // Boss 行原位缩为测试量纲（结构字段 extraTriggerBlocks/stackRules=BOSS_CONTENT 落数·原样保留）。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_boss_n340'), { maxHp: 100000000, attack: 125, armor: 25, attackIntervalSec: 2.0 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_n340_pollution'), { maxHp: 1, attack: 1, armor: 1 }); // 随行污染体缩惰性（首拍即清·不污染手推口径）
    player(b, 'bu_ship_vanguard');
    player(b, 'bu_ship_gunner');
    // 直接用 n340 遭遇（spawn=bu_boss_n340+pollution adds 原样）。
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n340', battleSeed: 'tide',
      playerUnits: [
        { unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c2' },
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c0' },
      ],
    });
    const tide = dmg(r.log).filter((d) => d.effectRef === 'eff_pollution_tide' && !d.periodic);
    expect(tide.length).toBeGreaterThanOrEqual(4); // 至少两轮 × 两目标（cd12·120s 战斗）
    expect(new Set(tide.map((d) => d.target)).size).toBe(2); // 全屏=两船都吃
    const burns = dmg(r.log).filter((d) => d.periodic && d.source.startsWith('enemy'));
    expect(burns.length).toBeGreaterThan(0); // 全队燃烧真在跳（M2 rider）
    expect(burns[0].amount).toBe(10); // 125×8%=10（燃烧无视防御）
    // 随时间狂暴：Boss 普攻净伤 100 起步、后期显著上涨（per_second +2% 攻）。
    // 载体注记：n340 普攻=eff_normal_polluted（真源污染族·带易伤 rider）——首发无易伤 ≤105 仍成立，
    // 后期=狂暴×易伤叠加 ≥140 更稳。
    const bossNormals = dmg(r.log).filter((d) => d.source.startsWith('enemy') && d.effectRef === 'eff_normal_polluted' && !d.periodic).map((d) => d.amount);
    expect(bossNormals[0]).toBeLessThanOrEqual(105);
    expect(Math.max(...bossNormals)).toBeGreaterThanOrEqual(140); // ≥20s 后 +40% 以上
  });
});

describe('⑩A4 · 污染体三件套（真源§4·n138 阶段召唤真载体/悬赏威胁库第4类）', () => {
  const rigPollution = () => {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_pollution'), { maxHp: 100000000, attack: 125, armor: 25 });
    player(b, 'bu_ship_vanguard');
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_pollution', 'bu_enemy_boss_add'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), { maxHp: 100000000, attack: 1, armor: 25, attackRangeCells: 99, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_pollution', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    return b;
  };
  it('普攻挂易伤（我方受击 100→125）+ 受击喷燃烧（我方被跳伤）+ 越受击越狂暴（敌普攻递增）', async () => {
    const b = rigPollution();
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'pol',
      playerUnits: [{ unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c1' }],
    });
    const onUs = dmg(r.log).filter((d) => d.source === 'enemy_0000' && !d.periodic).map((d) => d.amount);
    expect(onUs[0]).toBe(100); // 首发（易伤在首发后才在身）
    expect(onUs.some((a) => a >= 125)).toBe(true); // 易伤 +25% 生效（后续或叠狂暴更高）
    const sprayBurn = dmg(r.log).filter((d) => d.periodic && d.source === 'enemy_0000');
    expect(sprayBurn.length).toBeGreaterThan(0); // 受击喷毒=我方被燃烧跳（on_hit 触发）
    expect(Math.max(...onUs)).toBeGreaterThan(140); // 越打越狂（was_hit +10%/次·1.25×1.1^n）
  });
});

describe('⑩A4 · 磁暴塔磁暴场（真源§3·克制#10"削弱我方"敌侧载体）', () => {
  it('周期给我方一片挂减速（atk_speed_down 态·cd8）——我方攻击节奏被拖慢', async () => {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_stormtower'), { maxHp: 100000000, attack: 1, armor: 25 });
    player(b, 'bu_ship_vanguard');
    Object.assign(row(b, 'battle_encounter_param', 'enc_n001'), { enemyUnitStatRefs: ['bu_enemy_stormtower', 'bu_enemy_boss_add'], spawnPlanRefs: ['spawn_n001_w1', 'spawn_n001_w2'] });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_enemy_boss_add'), { maxHp: 100000000, attack: 1, armor: 25, attackRangeCells: 99, ultimateEffectRef: 'none', ultimateCdSec: 0 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w2'), { unitStatRef: 'bu_enemy_boss_add', count: 1, slotRefs: ['r0c6'], spawnDelaySec: 0, maxConcurrentOnField: 2 });
    Object.assign(row(b, 'battle_spawn_param', 'spawn_n001_w1'), { unitStatRef: 'bu_enemy_stormtower', count: 1, slotRefs: ['r0c0'], spawnDelaySec: 0, maxConcurrentOnField: 1 });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n001', battleSeed: 'st',
      playerUnits: [{ unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c1' }],
    });
    const slows = r.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'atk_speed_down' && (e.targetIds ?? []).some((t) => t.startsWith('player')));
    expect(slows.length).toBeGreaterThanOrEqual(2); // cd8 周期重复施加
    // 减速真拖慢：120s 内我方普攻数 < 无减速基线（间隔 1.0→1.33）。
    const myHits = dmg(r.log).filter((d) => d.source === 'player_p1c1' && !d.periodic).length;
    expect(myHits).toBeLessThan(115); // 无减速≈120 发（±排程量子）·−25% 攻速应显著少于
  });
});

// 段2 恢复（挂起核销·换载体 n150→n450）：终Boss 星能污染核心对位 n450（真源§5 原班·BOSS_CONTENT
// 声明落真机制=开局大盾+mid 召唤点名+final「先狂暴后全屏」效果序原样迁移）。
describe('⑩A4→段2 · n450 终Boss final 阶段狂暴全屏（真源§5·先狂暴后全屏效果序）', () => {
  it('压血入终阶后 eff_s7_cataclysm 全屏命中双船', async () => {
    const b = clone(loadBundle());
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_boss_n450'), { maxHp: 4000, attack: 50, armor: 25, attackIntervalSec: 2.0 });
    player(b, 'bu_ship_vanguard');
    player(b, 'bu_ship_gunner');
    // n450 场面单位缩到无害量纲防干扰（结构不动）：spawn 波污染体环卫+mid 阶段召唤（污染体+add×2）。
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_n450_pollution'), { maxHp: 1, attack: 1, armor: 1 });
    Object.assign(row(b, 'battle_unit_stat_param', 'bu_n450_add'), { maxHp: 1, attack: 1, armor: 1 });
    const engine = await engineOf(b);
    const r = engine.run({
      encounterRef: 'enc_n450', battleSeed: 'cat',
      playerUnits: [
        { unitStatRef: 'bu_ship_vanguard', slotRef: 'p1c2' },
        { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c0' },
      ],
    });
    const cat = dmg(r.log).filter((d) => d.effectRef === 'eff_s7_cataclysm');
    expect(cat.length).toBeGreaterThanOrEqual(2); // 阶段入场一发·全屏=双船都中
    expect(new Set(cat.map((d) => d.target)).size).toBe(2);
    // 手推（旧 n150 先例 60 的载体差重定基·旧→新→为什么对）：n150 普攻=eff_basic_attack（无易伤）
    // →60=50×1.25(狂暴先上身)×1.2×(100/125)；n450 普攻=eff_normal_polluted（污染族·真源=命中挂
    // 易伤 +25%）→cataclysm 落地时玩家已带易伤：60×1.25=75（易伤吃全屏伤=机制正确·非放宽）。
    expect(cat[0].amount).toBe(75);
  });
});
