// ⑥第二段·战斗侧第二把尺子（TS 入口·由 simulate-s7-mainline-battles.mjs 用 esbuild 打包后驱动）。
// 职责：148 敌配逐关跑真链路 S7BattleRunService.run()（组装器→引擎·非直喂），产出
//   逐关 {nodeId, stage, 压力值, 阵容战力, 胜率, 平均时长, 超时率} 报告。
// 三件套：
//   ① 阵容生成器 genLineup：按养成刻度反解（阶级×等级×插件档=战力≈P·全队同构粗放版）生成 中位/克制向/乱搭 三族；
//   ② 压力值→敌配映射 mapPressureToEnemies：P×职业组合 → 敌方全属性缩放（规则成文=细表 §19·总量守恒=k 合同数字）；
//   ③ 全扫 scanMainline：每关克隆 bundle→内存缩放→跑 N 种子。**零回写**：不写任何 JSON/存档，纯内存。
// 星域放大曲线口径（§19 成文）：不设独立曲线——压力值 P 本身已含星域递进（经济尺双锚生成法），
//   映射只吃 P、星域系数不二次乘（否则双重计价）。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import {
  S7ConfigTableName, S7_TABLE_FILES,
  S7BattleEncounterParam, S7BattleSpawnParam, S7BattleUnitStatParam, S7MainlineNodeConfig,
} from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
import { S7BattleLineupUnitInput, S7BattleLineupPluginInput } from '../assets/scripts/core/s7/S7BattleEncounterAssembler';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';
import { S7PluginQuality } from '../assets/scripts/core/s7/S7PluginEffects';

// 路径由壳注入（打包产物跑在临时目录·import.meta.url 不可用作锚）：S7_GAME_ROOT=game 目录绝对路径。
const GAME_ROOT = process.env.S7_GAME_ROOT ?? process.cwd();
const S7_DIR = path.resolve(GAME_ROOT, 'assets', 'resources', 'configs', 's7');
const PRESSURE_JSON = path.resolve(GAME_ROOT, '..', '第三块-数值校准', '数值初值表-v0-数据.json');

type Bundle = Record<S7ConfigTableName, unknown[]>;
type Row = Record<string, unknown>;

export function loadBundle(): Bundle {
  const bundle = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    bundle[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return bundle;
}
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** 压力值表（下标 1..150）。默认=初值表 JSON 快照；⑧收官后第三段换新版（本入口吃入参可覆盖·与来源解耦）。 */
export function loadPressure(): number[] {
  const d = JSON.parse(readFileSync(PRESSURE_JSON, 'utf-8')) as { pressure: number[] };
  return d.pressure;
}

// ===== ① 阵容生成器（第一段框架消费者）=====

/** 战力公式 v0 常量（初值表 §3）。 */
const TIER_BASE = { C: 100, B: 160, A: 250, S: 380, SS: 550 } as const;
const TIER_LV_CAP = { C: 20, B: 40, A: 60, S: 80, SS: 100 } as const;
const TIER_ATTR_MULT = 1.26; // §12.1：升阶全属性 ×1.26/阶
const PLUGIN_POWER = { fine: 15, superior: 35, legendary: 70 } as const;
const CORE_POWER = 120;
type Tier = keyof typeof TIER_BASE;
const TIERS: Tier[] = ['C', 'B', 'A', 'S', 'SS'];

/** 各阶默认插件档（槽位随阶开：C1/B2/A3；档位随进度升）。 */
const TIER_PLUGINS: Record<Tier, S7PluginQuality[]> = {
  C: ['fine'],
  B: ['superior', 'fine'],
  A: ['superior', 'superior', 'fine'],
  S: ['legendary', 'superior', 'superior'],
  SS: ['legendary', 'legendary', 'legendary'],
};
/** 三槽插件 id（plugin_config 实际槽位：weapon=plg02 / skill=plg07 / tactical=plg01——每槽首件占位；效果=槽位通用占位）。 */
const SLOT_PLUGINS = ['plg02', 'plg07', 'plg01'];

export interface GrowthPlan {
  tier: Tier;
  level: number;
  plugins: S7PluginQuality[];
  withCore: boolean;
  /** 单舰战力（含核）。 */
  shipPower: number;
}

/** 单舰战力（战力公式 v0·驾驶员系数粗放=1★Lv1≈1.0）。 */
function shipPowerOf(tier: Tier, level: number, plugins: S7PluginQuality[], withCore: boolean): number {
  const base = TIER_BASE[tier] * (1 + 0.08 * (level - 1));
  const plug = plugins.reduce((a, q) => a + PLUGIN_POWER[q], 0);
  return base + plug + (withCore ? CORE_POWER : 0);
}

/** 养成刻度反解（全队同构粗放版）：找 阶级×等级 使 5 舰总战力最接近目标 P。 */
export function solveGrowthPlan(targetTeamPower: number): GrowthPlan {
  const perShip = targetTeamPower / 5;
  let best: GrowthPlan | null = null;
  for (const tier of TIERS) {
    const plugins = TIER_PLUGINS[tier];
    const withCore = tier === 'S' || tier === 'SS';
    for (let lv = 1; lv <= TIER_LV_CAP[tier]; lv += 1) {
      const p = shipPowerOf(tier, lv, plugins, withCore);
      if (!best || Math.abs(p - perShip) < Math.abs(best.shipPower - perShip)) {
        best = { tier, level: lv, plugins, withCore, shipPower: p };
      }
    }
  }
  return best!;
}

export type LineupFamily = 'median' | 'counter' | 'misfit';

/** 族 × 问题标签 → 五舰（shipId 序=真源映射·细表§12）。克制向按工序0克制工具箱选工具。 */
export function pickShips(family: LineupFamily, problemTag: string): string[] {
  if (family === 'misfit') return ['shp05', 'shp06', 'shp07', 'shp13', 'shp15']; // 三坦双奶（合法错配）
  if (family === 'median') return ['shp05', 'shp01', 'shp09', 'shp17', 'shp13']; // 磐石+极焰+烈阳+迷雾+晨曦（第一段成文）
  switch (problemTag) { // counter：对题工具箱
    case 'swarm': return ['shp05', 'shp10', 'shp09', 'shp12', 'shp13'];   // AoE：群蜂+烈阳+霹雳
    case 'shield': return ['shp05', 'shp11', 'shp20', 'shp02', 'shp13'];  // 破盾：贯日+锁链+影刃
    case 'backline': return ['shp05', 'shp02', 'shp09', 'shp04', 'shp13']; // 点后排/单体：影刃+蜂针
    case 'burst': return ['shp05', 'shp06', 'shp13', 'shp02', 'shp09'];   // 双坦+盾奶扛爆发
    case 'berserk': return ['shp05', 'shp02', 'shp01', 'shp09', 'shp13']; // 限时爆发：突击双核
    case 'summon': return ['shp05', 'shp10', 'shp12', 'shp02', 'shp13'];  // 清召唤：AoE+点源
    default: return ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];
  }
}

const SLOTS = ['p1c2', 'p0c1', 'p1c1', 'p2c1', 'p1c0']; // 首舰=坦顶前列（中位摆位成文口径）
const PILOTS = ['pil01', 'pil02', 'pil03', 'pil04', 'pil05']; // 占位轮配（现仅 pil03 有行为积木）

/** 生成组装器阵容输入：养成刻度反解 + 升阶属性积木 + 暴击基线（C3/C4）。 */
export function genLineup(family: LineupFamily, targetTeamPower: number, problemTag: string): {
  lineup: S7BattleLineupUnitInput[]; teamPower: number; plan: GrowthPlan;
} {
  const plan = solveGrowthPlan(targetTeamPower);
  const ships = pickShips(family, problemTag);
  const tierIdx = TIERS.indexOf(plan.tier);
  const attrMult = Math.pow(TIER_ATTR_MULT, tierIdx) - 1; // 升阶全属性跳（运行时未接线=积木承载·细表§12.1）
  const extra: S7EffectBlock[] = [
    { kind: 'affix', affix: 'critRate', value: 0.05, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: 0.5, source: 'crit_base' },
  ];
  if (attrMult > 0) {
    extra.push(
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: attrMult, source: 'tier_up' },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: attrMult, source: 'tier_up' },
      { kind: 'modifier', stat: 'armor', op: 'pct', value: attrMult, source: 'tier_up' },
    );
  }
  const plugins: S7BattleLineupPluginInput[] = plan.plugins.map((q, i) => ({ pluginId: SLOT_PLUGINS[i], quality: q }));
  const lineup: S7BattleLineupUnitInput[] = ships.map((shipId, i) => ({
    shipId,
    slotRef: SLOTS[i],
    pilotId: PILOTS[i],
    ...(plan.withCore && i === 1 ? { coreId: 'core07' } : {}), // 粗放版：S+ 阶第二舰装陨星弹（唯一已接线核）
    plugins,
    shipLevel: plan.level,
    extraBlocks: extra,
  }));
  return { lineup, teamPower: plan.shipPower * 5, plan };
}

// ===== ② 压力值 → 敌配属性映射 v0（规则成文=细表 §19）=====

/** k 合同数字（第一段实证终值·§18）。 */
export const K_HP = 10;
export const K_DPS = 0.34;
/** 关卡类型放大（§18 实证系数）。 */
export const STAGE_MULT = {
  normal: { pool: 1.0, dps: 1.0 },
  elite: { pool: 1.4, dps: 1.15 },
  boss: { pool: 1.9, dps: 1.0 }, // 全扫迭代二：dps 1.15 时 adds 高攻权职业(点名塔/charge)吃掉份额→连克制向也被杀穿；Boss 关压迫=Boss 重锤+持久战，不靠 adds 堆伤
} as const;

/** 8 职业基线形状（血权/攻权/防/间隔——真源"护盾敌高防/爆发敌高攻"的量化）。 */
export const ROLE_SHAPE: Record<string, { hpW: number; atkW: number; armor: number; interval: number; effHpMult?: number }> = {
  // effHpMult=等效厚度（盾循环/治疗/召唤产出=第二条血）：单位落表血=池份额÷effHpMult——
  // 单类编队关权重归一化后份额不变，等效厚度必须除在单位血上（n061 僵持诊断·22 关盾敌段实证）。
  bu_enemy_swarm: { hpW: 0.7, atkW: 0.8, armor: 5, interval: 1.1 },
  bu_enemy_swarm_tough: { hpW: 1.6, atkW: 0.5, armor: 12, interval: 1.1 },
  bu_enemy_burst_raider: { hpW: 0.8, atkW: 2.2, armor: 8, interval: 1.7 },
  bu_enemy_shield_warden: { hpW: 1.2, atkW: 0.9, armor: 30, interval: 1.3, effHpMult: 1.8 },
  bu_enemy_backline: { hpW: 0.7, atkW: 1.5, armor: 10, interval: 1.3 },
  bu_enemy_support: { hpW: 0.9, atkW: 0.35, armor: 15, interval: 1.4, effHpMult: 1.4 },
  bu_enemy_charge: { hpW: 1.3, atkW: 1.6, armor: 15, interval: 1.5 },
  bu_enemy_summon_source: { hpW: 1.4, atkW: 0.4, armor: 12, interval: 1.4, effHpMult: 1.6 },
  bu_enemy_shield: { hpW: 0.9, atkW: 0.8, armor: 25, interval: 1.3, effHpMult: 2.0 },
  bu_enemy_boss_add: { hpW: 0.7, atkW: 0.8, armor: 8, interval: 1.2 },
};
/** Boss 行分成（血池/火力占比·余量归 adds）。 */
const BOSS_SHARE = { hp: 0.65, dps: 0.3 }; // 首扫诊断：0.5 全压单点=前排瞬融·Boss=重锤节奏不是速射炮

export interface NodeScale {
  nodeId: string;
  stage: 'normal' | 'elite' | 'boss';
  pressure: number;
  pool: number;
  dps: number;
  /** rowId → 缩放后属性。 */
  units: Record<string, { maxHp: number; attack: number; armor: number; attackIntervalSec: number }>;
}

/** 压力值 P × 该关职业组合（spawn 计划）→ 各敌行属性（总量守恒：Σ血=pool·Σ原始DPS=dps）。 */
/** 战斗强度指数（DPS 单轴）：阶级属性乘 × 升级 growth 比——战力刻度与强度的换算函数 φ 的分子。
 *  k 合同（k_hp/k_dps）在 C·Lv0 锚点（P=500）校准；全程敌量 = k×500×stage × φ(P)，
 *  φ(P)=strengthIndex(plan(P))/strengthIndex(plan(500))——压力值=养成态指针，敌厚度贴真实强度曲线，
 *  手感靶 25s 全程成立且墙语义保留（敌按 P 的强度、玩家按自身 W 的强度）。规则成文=细表 §19。 */
export function strengthIndex(teamPower: number): number {
  const plan = solveGrowthPlan(teamPower);
  const tierIdx = TIERS.indexOf(plan.tier);
  const growth = growthRatioOf(plan.level);
  return Math.pow(TIER_ATTR_MULT, tierIdx) * growth;
}
let GROWTH_CACHE: Array<{ from: number; to: number; pmin: number; pmax: number }> | null = null;
function growthRatioOf(level: number): number {
  if (!GROWTH_CACHE) {
    const rows = JSON.parse(readFileSync(path.join(S7_DIR, 'growth_band_param.sample.json'), 'utf-8')) as Row[];
    GROWTH_CACHE = rows.filter((r) => r.targetType === 'ship' && r.curveType === 'band_linear')
      .map((r) => ({ from: r.interpFromIndex as number, to: r.toIndex as number, pmin: r.powerMin as number, pmax: r.powerMax as number }))
      .sort((a, b) => a.from - b.from);
  }
  const lv = Math.max(1, Math.min(100, Math.floor(level)));
  let band = GROWTH_CACHE.find((b) => lv >= b.from && lv <= b.to);
  if (!band) band = lv < GROWTH_CACHE[0].from ? GROWTH_CACHE[0] : GROWTH_CACHE[GROWTH_CACHE.length - 1];
  const t = band.to === band.from ? 0 : Math.max(0, Math.min(1, (lv - band.from) / (band.to - band.from)));
  const power = band.pmin + (band.pmax - band.pmin) * t;
  return power / 120;
}
const PHI_BASE = 500; // k 合同锚点

export function mapPressureToEnemies(bundle: Bundle, nodeId: string, pressure: number): NodeScale {
  const encs = bundle.battle_encounter_param as unknown as S7BattleEncounterParam[];
  const spawns = bundle.battle_spawn_param as unknown as S7BattleSpawnParam[];
  const enc = encs.find((e) => e.nodeRef === nodeId);
  if (!enc) throw new Error(`无 encounter：${nodeId}`);
  const stage = enc.stageType as NodeScale['stage'];
  const mult = STAGE_MULT[stage];
  // 刻度→强度换算 φ（§19）：P≤锚点走线性原始合同（教学段 P<起手战力=碾压语义·不被锚点抬难）；
  // P>锚点按"应有养成态"的战斗强度补偿（吸收战力刻度与强度的换算漂移）。
  const phi = pressure <= PHI_BASE
    ? pressure / PHI_BASE
    : strengthIndex(pressure) / strengthIndex(PHI_BASE);
  const pool = K_HP * PHI_BASE * phi * mult.pool;
  const dps = K_DPS * PHI_BASE * phi * mult.dps;

  // 该关单位数量表（按 spawn 计划）：rowId → count。
  const counts = new Map<string, number>();
  for (const ref of enc.spawnPlanRefs) {
    const sp = spawns.find((s) => s.rowId === ref);
    if (!sp) continue;
    counts.set(sp.unitStatRef, (counts.get(sp.unitStatRef) ?? 0) + sp.count);
  }
  const units: NodeScale['units'] = {};
  const bossRows = [...counts.keys()].filter((r) => r.startsWith('bu_boss_'));
  const normalRows = [...counts.keys()].filter((r) => !r.startsWith('bu_boss_'));

  let poolLeft = pool;
  let dpsLeft = dps;
  for (const bossRow of bossRows) {
    const hp = Math.round((pool * BOSS_SHARE.hp) / bossRows.length);
    const bossDps = (dps * BOSS_SHARE.dps) / bossRows.length;
    const interval = 2.0; // 重锤：单发大、频率低（前排能被奶回来=有惊无险而非瞬蒸发）
    units[bossRow] = { maxHp: hp, attack: Math.max(1, Math.round(bossDps * interval)), armor: 35, attackIntervalSec: interval };
    poolLeft -= hp;
    dpsLeft -= bossDps;
  }
  // 权重分摊（血/攻各自守恒）。
  let hpWSum = 0;
  let atkWSum = 0;
  for (const r of normalRows) {
    const shape = ROLE_SHAPE[r] ?? { hpW: 1, atkW: 1, armor: 10, interval: 1.2 };
    hpWSum += shape.hpW * (counts.get(r) ?? 0);
    atkWSum += shape.atkW * (counts.get(r) ?? 0);
  }
  for (const r of normalRows) {
    const shape = ROLE_SHAPE[r] ?? { hpW: 1, atkW: 1, armor: 10, interval: 1.2 };
    const hpPer = (hpWSum > 0 ? (Math.max(0, poolLeft) * shape.hpW) / hpWSum : 0) / (shape.effHpMult ?? 1);
    const dpsPer = atkWSum > 0 ? (Math.max(0, dpsLeft) * shape.atkW) / atkWSum : 0;
    units[r] = {
      maxHp: Math.max(1, Math.round(hpPer)),
      attack: Math.max(1, Math.round(dpsPer * shape.interval)),
      armor: shape.armor,
      attackIntervalSec: shape.interval,
    };
  }
  return { nodeId, stage, pressure, pool, dps, units };
}

// ===== ③ 全扫 =====

export interface NodeReport {
  nodeId: string;
  stage: string;
  pressure: number;
  teamPower: number;
  winRate: number;
  avgDurationSec: number;
  timeoutRate: number;
}

export interface ScanOptions {
  family?: LineupFamily;
  samples?: number;
  fromNode?: number;
  toNode?: number;
  /** 阵容战力 = 压力值 × 此系数（默认 1=贴线；碾压/欠配实验用）。 */
  powerRatio?: number;
}

/** 全扫（runtime.load 为 async；每关构建一次 runtime·148 次 load+validate 实测秒级——性能账见细表 §19）。 */
export async function scanMainlineAsync(opts: ScanOptions = {}): Promise<NodeReport[]> {
  const family = opts.family ?? 'median';
  const samples = Math.max(1, opts.samples ?? 3);
  const base = loadBundle();
  const pressure = loadPressure();
  const nodes = (base.mainline_node_config as unknown as S7MainlineNodeConfig[])
    .map((n) => n.nodeId)
    .filter((id) => {
      const num = Number(id.slice(1));
      return num >= (opts.fromNode ?? 1) && num <= (opts.toNode ?? 150);
    });
  const encs = base.battle_encounter_param as unknown as S7BattleEncounterParam[];
  const service = new S7BattleRunService();
  const out: NodeReport[] = [];

  for (const nodeId of nodes) {
    const enc = encs.find((e) => e.nodeRef === nodeId);
    if (!enc) continue;
    const num = Number(nodeId.slice(1));
    const p = pressure[num];
    const b = clone(base);
    const scale = mapPressureToEnemies(b, nodeId, p);
    const unitRows = b.battle_unit_stat_param as Row[];
    for (const [rowId, attrs] of Object.entries(scale.units)) {
      const r = unitRows.find((x) => x.rowId === rowId);
      if (r) Object.assign(r, attrs);
    }
    const { lineup, teamPower } = genLineup(family, p * (opts.powerRatio ?? 1), enc.problemTagRef);
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(b));
    let wins = 0;
    let durSum = 0;
    let timeouts = 0;
    for (let i = 0; i < samples; i += 1) {
      const r = service.run({
        runtime,
        progress: { currentNodeId: nodeId, clearedNodeIds: [] },
        runSeed: `scan-${family}-${i}`,
        lineup,
      });
      if (r.result.winner === 'player') wins += 1;
      if (r.result.reason === 'timeout') timeouts += 1;
      durSum += r.result.durationSec;
    }
    out.push({
      nodeId, stage: enc.stageType, pressure: p, teamPower: Math.round(teamPower),
      winRate: wins / samples, avgDurationSec: durSum / samples, timeoutRate: timeouts / samples,
    });
  }
  return out;
}

// ===== CLI 主函数（壳调用）=====
export async function main(argv: string[]): Promise<number> {
  const arg = (name: string, dflt: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  const family = arg('lineup', 'median') as LineupFamily;
  const samples = Number(arg('samples', '3'));
  const fromNode = Number(arg('from', '1'));
  const toNode = Number(arg('to', '150'));
  const powerRatio = Number(arg('power-ratio', '1'));
  const debugNode = arg('debug-node', '');

  if (debugNode) {
    // 单关战报诊断：终态双方存活/血量 + 敌配缩放明细。
    const base = loadBundle();
    const pressure = loadPressure();
    const num = Number(debugNode.slice(1));
    const b = clone(base);
    const scale = mapPressureToEnemies(b, debugNode, pressure[num]);
    console.log(`[debug] ${debugNode} P=${pressure[num]} pool=${scale.pool} dps=${scale.dps.toFixed(0)}`);
    for (const [rowId, a] of Object.entries(scale.units)) {
      console.log(`[debug]   ${rowId}: hp=${a.maxHp} atk=${a.attack} armor=${a.armor} int=${a.attackIntervalSec}`);
    }
    const unitRows = b.battle_unit_stat_param as Row[];
    for (const [rowId, attrs] of Object.entries(scale.units)) {
      const r = unitRows.find((x) => x.rowId === rowId);
      if (r) Object.assign(r, attrs);
    }
    const encs2 = b.battle_encounter_param as unknown as S7BattleEncounterParam[];
    const enc2 = encs2.find((e) => e.nodeRef === debugNode)!;
    const { lineup, teamPower, plan } = genLineup(family, pressure[num] * powerRatio, enc2.problemTagRef);
    console.log(`[debug] 阵容：${plan.tier}阶 Lv${plan.level} 插件${plan.plugins.join('/')} 核=${plan.withCore} 战力=${Math.round(teamPower)}`);
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(b));
    const r = new S7BattleRunService().run({ runtime, progress: { currentNodeId: debugNode, clearedNodeIds: [] }, runSeed: 'dbg', lineup });
    console.log(`[debug] winner=${r.result.winner} reason=${r.result.reason} dur=${r.result.durationSec}s`);
    for (const u of r.result.finalState.players) console.log(`[debug]   我 ${u.unitStatRef}@${u.slotRef}: ${u.hp}/${u.maxHp}${u.alive ? '' : ' ✝'}`);
    const aliveE = r.result.finalState.enemies.filter((u) => u.alive);
    console.log(`[debug]   敌存活 ${aliveE.length}：${aliveE.slice(0, 6).map((u) => `${u.unitStatRef}:${u.hp}/${u.maxHp}`).join(' | ')}`);
    return 0;
  }
  const t0 = Date.now();
  const reports = await scanMainlineAsync({ family, samples, fromNode, toNode, powerRatio });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  // 汇总
  const stages: Record<string, { n: number; win: number; dur: number; to: number }> = {};
  for (const r of reports) {
    const s = (stages[r.stage] ??= { n: 0, win: 0, dur: 0, to: 0 });
    s.n += 1; s.win += r.winRate; s.dur += r.avgDurationSec; s.to += r.timeoutRate;
  }
  console.log(`# ⑥战斗侧第二把尺子 · 全扫报告（family=${family} samples=${samples} powerRatio=${powerRatio} 用时 ${secs}s）`);
  console.log('nodeId | stage | P | 阵容战力 | 胜率 | 平均时长 | 超时率');
  for (const r of reports) {
    console.log(`${r.nodeId} | ${r.stage} | ${r.pressure} | ${r.teamPower} | ${(r.winRate * 100).toFixed(0)}% | ${r.avgDurationSec.toFixed(1)}s | ${(r.timeoutRate * 100).toFixed(0)}%`);
  }
  console.log('## 分段汇总');
  for (const [stage, s] of Object.entries(stages)) {
    console.log(`${stage}: 关数 ${s.n} · 平均胜率 ${((s.win / s.n) * 100).toFixed(1)}% · 平均时长 ${(s.dur / s.n).toFixed(1)}s · 平均超时率 ${((s.to / s.n) * 100).toFixed(1)}%`);
  }
  return 0;
}
