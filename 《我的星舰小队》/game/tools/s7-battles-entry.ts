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
import { shipPowerV0, S7_PLAYER_CRIT_BASE } from '../assets/scripts/core/s7/S7PowerRating';
import { S7_HARD_CONTROL_DIMINISH } from '../assets/scripts/core/s7/S7AutoBattleTypes';

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

/** 逐关到达时点养成态（步5 A9-6 机读字段化：读 json 快照 standard.<档>.expected.milestones·
 *  与压力表同源同锚〔敌配按快照落数·快照变化→落数守卫红提醒重落〕；旧"跑尺子抠文本输出"解析退役）。
 *  tier 缺省普通档（⑥到达态口径）。 */
export function loadMilestones(tier = '普通'): Map<string, { day: number; power: number }> {
  const d = JSON.parse(readFileSync(PRESSURE_JSON, 'utf-8')) as {
    standard?: Record<string, { expected?: { milestones?: { node: number; day: number; power: number }[] } }>;
  };
  const rows = d.standard?.[tier]?.expected?.milestones;
  if (!Array.isArray(rows) || rows.length < 100) {
    throw new Error(`milestones 机读字段异常：${tier} 档仅 ${rows?.length ?? 0} 行（json 快照缺字段？）`);
  }
  const map = new Map<string, { day: number; power: number }>();
  for (const r of rows) map.set(`n${String(r.node).padStart(3, '0')}`, { day: r.day, power: r.power });
  return map;
}

/** 压力值表（下标 1..150）。默认=初值表 JSON 快照；⑧收官后第三段换新版（本入口吃入参可覆盖·与来源解耦）。 */
export function loadPressure(): number[] {
  const d = JSON.parse(readFileSync(PRESSURE_JSON, 'utf-8')) as { pressure: number[] };
  return d.pressure;
}

// ===== ① 阵容生成器（第一段框架消费者）=====

/** 战力公式 v0＝S7PowerRating 单一真源（段三躯干统一：本地复制退役）。 */
// 段二 A3：等级上限 100→50（C10/B20/A30/S40/SS50·与 S7UnitTierState/TRUTHS 同改）——
// 旧百级表喂给已截断的 shipPowerV0 会让 L51+ 全夹到 LF(50)＝反解搜索静默失真，必须同步。
const TIER_LV_CAP = { C: 10, B: 20, A: 30, S: 40, SS: 50 } as const;
type Tier = keyof typeof TIER_LV_CAP;
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
  /** 驾驶员星级（1-5）与等级（战力公式 v0 完整版：星系数×(1+0.01×驾级)）。 */
  pilotStar: number;
  pilotLevel: number;
  /** 单舰战力（含核·含驾驶员系数）。 */
  shipPower: number;
}
/** 星级刻度系数＝S7_PILOT_STAR_POWER_MULT（shipPowerV0 内部单源·v1 拆分后战斗表不再进刻度）。 */

/** 单舰战力（v0·经 S7PowerRating 单源）。 */
function shipPowerOf(tier: Tier, level: number, plugins: S7PluginQuality[], withCore: boolean, pilotStar: number, pilotLevel: number): number {
  return shipPowerV0({ tier: TIERS.indexOf(tier), level, pluginQualities: plugins, withCore, pilotStar, pilotLevel });
}

/** 养成刻度反解（全队同构粗放版）：阶级×等级×驾驶员星/级 使 5 舰总战力最接近目标 P。
 *  驾驶员进度与舰同步走（星级≈阶级档·驾级=舰级同频）——真实玩家双线并进的粗放近似。 */
export function solveGrowthPlan(targetTeamPower: number): GrowthPlan {
  const perShip = targetTeamPower / 5;
  const TIER_STAR: Record<Tier, number> = { C: 1, B: 2, A: 3, S: 4, SS: 5 }; // 星级随阶（粗放同步）
  let best: GrowthPlan | null = null;
  for (const tier of TIERS) {
    const plugins = TIER_PLUGINS[tier];
    const withCore = tier === 'S' || tier === 'SS';
    const pilotStar = TIER_STAR[tier];
    // 段三保真度：升阶保级——真实玩家满级才升阶（L50 世界：B 从 10 级起、SS 从 40 级起），
    // 放开 lv=1 会解出"SS低等级"纸面高实际弱的幽灵方案（×1.15 反而输的量化悬崖实证）。
    const tierIdx0 = TIERS.indexOf(tier);
    const lvFloor = tierIdx0 === 0 ? 1 : TIER_LV_CAP[TIERS[tierIdx0 - 1]];
    for (let lv = lvFloor; lv <= TIER_LV_CAP[tier]; lv += 1) {
      // 驾级=舰级同频为主轴 + ±20 级独立微调（反解量化间隙实证：n120 到达/破墙两态 14976 vs 16510
      // 曾落同一档=同队打同墙——墙窗口验证失真；驾级微调轴把档间隙填到 <1%）。
      const plvLo = Math.max(1, lv - 20);
      const plvHi = Math.min(TIER_LV_CAP[tier], lv + 20);
      for (let pilotLevel = plvLo; pilotLevel <= plvHi; pilotLevel += 2) {
        const p = shipPowerOf(tier, lv, plugins, withCore, pilotStar, pilotLevel);
        if (!best || Math.abs(p - perShip) < Math.abs(best.shipPower - perShip)) {
          best = { tier, level: lv, plugins, withCore, pilotStar, pilotLevel, shipPower: p };
        }
      }
    }
  }
  return best!;
}

export type LineupFamily = 'median' | 'counter' | 'misfit' | 'poor';

/** 族 × 问题标签 → 五舰（shipId 序=真源映射·细表§12）。克制向按工序0克制工具箱选工具。 */
export function pickShips(family: LineupFamily, problemTag: string): string[] {
  if (family === 'misfit') return ['shp13', 'shp14', 'shp15', 'shp16', 'shp17']; // 五支援＝面⑤乱搭载体（真·无胜利路径：双坦版仍有磐石A反弹暗路=蜂群袋26%实证；全奶无输出=只能超时·也是真实新手误配形态）
  if (family === 'poor') return ['shp05', 'shp06', 'shp01', 'shp13', 'shp15'];  // 双坦一C双奶＝面②差搭配载体（有胜利路径·输出饥饿≈45s）
  // 段三载体重定（§16d 记）：迷雾（普攻致盲 40%=通用减伤王牌）从中位挪去克制件位——
  // 旧中位含迷雾=实质"优质搭配"，六题带克制全数倒挂实证；中位第四位换哨卫（工程盒·无万能减伤）。
  if (family === 'median') return ['shp05', 'shp01', 'shp09', 'shp11', 'shp13']; // 磐石+极焰+烈阳+贯日+晨曦——第四位=纯炮击（哨卫版实证：诱饵盒吃光敌火=砍半半血队满血通关·万能牌不当中位）
  switch (problemTag) { // counter：中位核心+对题弹性位（玩家真实构筑法=主力队换弹性位带工具）
    case 'swarm': return ['shp05', 'shp01', 'shp09', 'shp10', 'shp13'];   // 弹性位=群蜂（AoE 弹巢）
    case 'shield': return ['shp05', 'shp01', 'shp09', 'shp02', 'shp13'];  // 弹性位=影刃（狙杀）+破盾件
    case 'backline': return ['shp05', 'shp06', 'shp01', 'shp09', 'shp13']; // 弹性位=铁壁（怒吼嘲讽拉塔火·M4 嘲讽盖 backline_first=真工具——致盲只吃普攻拦不住塔大招实证）
    case 'burst': return ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];   // 弹性位=迷雾（致盲重炮）+舰体件
    case 'berserk': return ['shp05', 'shp01', 'shp09', 'shp02', 'shp13']; // 弹性位=影刃（限时竞速）+净化件
    case 'summon': return ['shp05', 'shp01', 'shp09', 'shp12', 'shp13'];  // 弹性位=霹雳（连锁清群+点源）
    default: return ['shp05', 'shp01', 'shp09', 'shp02', 'shp13'];
  }
}

const SLOTS = ['p1c2', 'p0c1', 'p1c1', 'p2c1', 'p1c0']; // 首舰=坦顶前列（中位摆位成文口径）
/** 克制族按题带工具插件（段三：B6 手工行早已带件、全扫克制族此前只换舰=假克制——盾题不带破盾件被中位反超实证）。 */
const TAG_PLUGINS: Record<string, string[]> = {
  shield: ['plg02', 'plg07', 'plg03'],   // 破盾件
  berserk: ['plg02', 'plg07', 'plg14'],  // 净化件（拖时间狂暴题）
  burst: ['plg02', 'plg07', 'plg05'],    // 舰体件（扛爆发单发）
  backline: ['plg02', 'plg07', 'plg05'], // 舰体件（扛点名尖峰）
  heal: ['plg02', 'plg07', 'plg01'],
};
/** ⑩A1 驾驶员真配（pil01-05 占位轮配退役）：舰↔驾驶员恒等映射 shpNN↔pilNN——
 *  舰按定位分块（01-04突击/05-08护卫/09-12炮击/13-16支援/17-20工程）与驾驶员亲和组同构，
 *  五对带★专属配对全部落同下标（影02/岩05/源09/苏13/蔽17=四点已拍④"带★钉死"），
 *  巡(pil19)=哨卫(shp19·有召唤物)=任务单弹药2"巡默认钉蜂巢或哨卫"。 */
export const pilotOfShip = (shipId: string): string => `pil${shipId.slice(3)}`;

/** ⑩A2 按题/按段选核（"核固定陨星弹"粗放点收口·§18.3 强度表语义·规则记 §19.5）：
 *  中位=Boss 关带超新星（毕业核=攒能 Boss 主场）·常规关带小太阳（常规最强档）；
 *  克制向=按题挑（AoE 题小太阳/爆发题超级护罩/拖延狂暴题时光糖/短仗压盾星鲸）；
 *  乱搭=陨星弹（"拿着新手核不换"的人设一致性）。教学段无核照旧（withCore 只在 S+ 阶）。 */
function pickCore(family: LineupFamily, problemTag: string, stage: string): string {
  if (family === 'misfit') return 'core07';
  if (family === 'median') return stage === 'boss' ? 'core15' : 'core08';
  switch (problemTag) {
    case 'swarm': case 'summon': return 'core08'; // AoE 题：小太阳
    case 'burst': return 'core11';                // 爆发窗口：超级护罩
    case 'berserk': return 'core10';              // 拖延/狂暴：时光糖（险仗加速）
    case 'shield': return 'core09';               // 压盾长打：星鲸（附加 DPS 体）
    default: return 'core08';
  }
}

/** 生成组装器阵容输入：养成刻度反解 + 升阶属性积木 + 暴击基线（C3/C4）+ 驾驶员真配（级/星喂机制门）。 */
export function genLineup(family: LineupFamily, targetTeamPower: number, problemTag: string, stage = 'normal'): {
  lineup: S7BattleLineupUnitInput[]; teamPower: number; plan: GrowthPlan;
} {
  const plan = solveGrowthPlan(targetTeamPower);
  const ships = pickShips(family, problemTag);
  const tierIdx = TIERS.indexOf(plan.tier);
  // 段三躯干统一：升阶属性跳与驾驶员数值线归装配器（shipTier/pilotStar/pilotLevel 直传·shipTierBlocks/pilotNumericBlocks）；
  // 此处只保留玩家暴击基线注入（真机三入口同源=playerCritBaseBlocks·值=S7_PLAYER_CRIT_BASE）。
  const extra: S7EffectBlock[] = [
    { kind: 'affix', affix: 'critRate', value: S7_PLAYER_CRIT_BASE.rate, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: S7_PLAYER_CRIT_BASE.dmg, source: 'crit_base' },
  ];
  const pluginIds = family === 'counter' ? (TAG_PLUGINS[problemTag] ?? SLOT_PLUGINS) : SLOT_PLUGINS;
  const plugins: S7BattleLineupPluginInput[] = plan.plugins.map((q, i) => ({ pluginId: pluginIds[i], quality: q }));
  const lineup: S7BattleLineupUnitInput[] = ships.map((shipId, i) => {
    return {
      shipId,
      slotRef: SLOTS[i],
      pilotId: pilotOfShip(shipId),
      pilotLevel: plan.pilotLevel,
      pilotStar: plan.pilotStar,
      shipTier: tierIdx,
      ...(plan.withCore && i === 1 ? { coreId: pickCore(family, problemTag, stage) } : {}), // ⑩A2：按题/按段选核（第二舰=主输出位）
      plugins,
      shipLevel: plan.level,
      extraBlocks: extra,
    };
  });
  return { lineup, teamPower: plan.shipPower * 5, plan };
}

/** ⑩三段 · 自定义阵容构建器（B5 五态矩阵/B6 克制装配/流派图鉴共用）：
 *  在 genLineup 同一套刻度反解与积木注入上，开放 舰组/站位/驾驶员置换/核/插件 覆写——
 *  "无工具中位队/错舰态/堆坦态/流派构筑"全靠 pilotMap 与装配覆写表达，战力刻度保持贴 target。 */
export interface CustomLineupOpts {
  ships: string[];
  targetTeamPower: number;
  /** 站位（缺省=SLOTS 中位摆位）。 */
  slots?: string[];
  /** shipId → pilotId 置换（缺省=恒等 pilotOfShip）。 */
  pilotMap?: Record<string, string>;
  /** shipId → coreId（缺省=无核；'default' 走 plan.withCore 规则给第二舰）。 */
  coreMap?: Record<string, string>;
  /** 全队三槽插件覆写（缺省=SLOT_PLUGINS 按阶三档）。 */
  slotPlugins?: string[];
}
export function genLineupCustom(opts: CustomLineupOpts): {
  lineup: S7BattleLineupUnitInput[]; teamPower: number; plan: GrowthPlan;
} {
  const plan = solveGrowthPlan(opts.targetTeamPower);
  const slots = opts.slots ?? SLOTS;
  const tierIdx = TIERS.indexOf(plan.tier);
  const extra: S7EffectBlock[] = [
    { kind: 'affix', affix: 'critRate', value: S7_PLAYER_CRIT_BASE.rate, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: S7_PLAYER_CRIT_BASE.dmg, source: 'crit_base' },
  ];
  const pluginIds = opts.slotPlugins ?? SLOT_PLUGINS;
  const plugins: S7BattleLineupPluginInput[] = plan.plugins.map((q, i) => ({ pluginId: pluginIds[i], quality: q }));
  const lineup: S7BattleLineupUnitInput[] = opts.ships.map((shipId, i) => {
    const coreId = opts.coreMap?.[shipId];
    return {
      shipId,
      slotRef: slots[i],
      pilotId: opts.pilotMap?.[shipId] ?? pilotOfShip(shipId),
      pilotLevel: plan.pilotLevel,
      pilotStar: plan.pilotStar,
      shipTier: tierIdx,
      ...(coreId ? { coreId } : {}),
      plugins,
      shipLevel: plan.level,
      extraBlocks: extra,
    };
  });
  return { lineup, teamPower: plan.shipPower * 5, plan };
}

/** 对锚与阶梯批 · 按经济尺真实养成态组队（爬坡矩阵消噪版）：
 *  mains=经济尺 dailyMains/milestones 快照（[阶字母, 舰级, 驾星, 驾级] ×5·主力1 在首位），
 *  逐舰用各自的阶/级/星组装（不做战力反解=没有相邻战力点跳组合的形状噪声）；
 *  插件按各舰阶默认三档、核给首个 S+ 阶舰（经济尺"主力1 先冲 S 装核"口径）。 */
export function genLineupFromMains(opts: {
  ships: string[];
  /** 阶位=经济尺原生数字下标（0=C..4=SS）或字母，两种都收。 */
  mains: Array<[string | number, number, number, number]>;
  coreId?: string;
  slots?: string[];
  slotPlugins?: string[];
}): { lineup: S7BattleLineupUnitInput[]; teamPower: number } {
  const slots = opts.slots ?? SLOTS;
  const extra: S7EffectBlock[] = [
    { kind: 'affix', affix: 'critRate', value: S7_PLAYER_CRIT_BASE.rate, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: S7_PLAYER_CRIT_BASE.dmg, source: 'crit_base' },
  ];
  const pluginIds = opts.slotPlugins ?? SLOT_PLUGINS;
  const tierOf = (t: string | number): Tier =>
    typeof t === 'number' ? TIERS[Math.max(0, Math.min(TIERS.length - 1, Math.floor(t)))] : (TIERS.includes(t as Tier) ? (t as Tier) : 'C');
  const coreIdx = opts.mains.findIndex(([t]) => { const tt = tierOf(t); return tt === 'S' || tt === 'SS'; });
  let teamPower = 0;
  const lineup: S7BattleLineupUnitInput[] = opts.ships.map((shipId, i) => {
    const [tierRaw, level, star, plevel] = opts.mains[i] ?? opts.mains[opts.mains.length - 1];
    const tier = tierOf(tierRaw);
    const tierIdx = TIERS.indexOf(tier);
    const quals = TIER_PLUGINS[tier];
    const withCore = i === coreIdx && !!opts.coreId;
    teamPower += shipPowerOf(tier, level, quals, withCore, star, plevel);
    return {
      shipId,
      slotRef: slots[i],
      pilotId: pilotOfShip(shipId),
      pilotLevel: plevel,
      pilotStar: star,
      shipTier: tierIdx,
      ...(withCore ? { coreId: opts.coreId } : {}),
      plugins: quals.map((q, j) => ({ pluginId: pluginIds[j], quality: q })),
      shipLevel: level,
      extraBlocks: extra,
    };
  });
  return { lineup, teamPower };
}

// ===== ② 压力值 → 敌配属性映射 v0（规则成文=细表 §19）=====

/** k 合同数字（批③段三躯干重校：玩家世界全接真〔舰阶质变+满天赋+插件+数值线〕后全局上抬——
 *  池 10→15（正常档手感 11.8s→≈25s 靶）·火 0.34→0.44（砍半必败/错舰归零/乱搭无路的生存压强）。⑥⑩史值见 git。 */
export const K_HP = 20;
export const K_DPS = 0.5;
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
  bu_enemy_swarm: { hpW: 0.9, atkW: 0.8, armor: 5, interval: 1.1 }, // 段三：0.7→0.9 数量题咬合（单体磨群付时间·AoE 不受扰）
  bu_enemy_swarm_tough: { hpW: 1.6, atkW: 0.5, armor: 12, interval: 1.1 },
  bu_enemy_burst_raider: { hpW: 0.8, atkW: 2.2, armor: 8, interval: 2.4 }, // 段三尖峰族：单发×1.41（DPS 守恒·重锤打穿脆皮/坦体扛得住）
  bu_enemy_shield_warden: { hpW: 1.2, atkW: 0.9, armor: 30, interval: 1.3, effHpMult: 1.8 },
  bu_enemy_backline: { hpW: 0.7, atkW: 0.7, armor: 10, interval: 1.4 }, // 段三尖峰族终值：射程醒后全额参战·攻权 1.1→0.85（点名带全员致死实证回拉·尖峰主载体=n102 塔型覆写 3.0s）
  bu_enemy_support: { hpW: 0.9, atkW: 0.35, armor: 15, interval: 1.4, effHpMult: 1.4 },
  bu_enemy_charge: { hpW: 1.3, atkW: 1.6, armor: 15, interval: 2.0 }, // 段三尖峰族：冲锋单发×1.33
  bu_enemy_summon_source: { hpW: 1.4, atkW: 0.4, armor: 12, interval: 1.4, effHpMult: 1.6 },
  bu_enemy_shield: { hpW: 0.9, atkW: 0.8, armor: 25, interval: 1.3, effHpMult: 2.0 },
  bu_enemy_boss_add: { hpW: 0.7, atkW: 0.8, armor: 8, interval: 1.2 },
  // ⑩三段（B7 悬赏威胁位/带宽探针用·主线 spawn 未布=不影响既有落数）：真源载体两形状。
  bu_enemy_pollution: { hpW: 1.1, atkW: 1.0, armor: 10, interval: 1.4 },   // 污染体：精英·爆发窗口（喷毒+受击狂暴=机制承伤·血权略厚）
  bu_enemy_stormtower: { hpW: 0.9, atkW: 0.5, armor: 12, interval: 1.6 },  // 磁暴塔：削弱塔（威胁在磁暴场非火力·攻权低）
};
/** 墙关陡度（⑥三段·经济尺墙矩阵>0 的真墙）：到达态（power<P 数个点）打不过、破墙态（≥P）能过——
 *  没有陡度时战斗侧在贴线处必胜（手感靶设计），墙会比经济模型软=毕业节奏漂移（milestone 验收实证）。
 *  段2 战斗批：旧世界 6 墙号（n060/n102/n120/n150/n084/n138·git 可溯）随 450 关新世界退役，
 *  按新 9 墙+13 Boss 位重配。分工不变：经济层管"卡 N 天"（压力尖峰+lifts）、本表管"贴线是场硬仗"
 *  （§20.2：贴线时长 ≥55s 或胜率 ≤80%·<120s 可破）。初值设计按墙类型分型（数值域自定·实测收敛报备）：
 *  战力墙 pool 厚=持久硬仗；连战墙 pool 收（reviveWaves 已 ×总池）；解题墙中性（考题在机制/钥匙跳变·
 *  boost 不越位）；机制墙中性（复活=天然二遍池）；高潮/前哨=演出硬仗不卡天。 */
const WALL_BOOST: Record<string, { pool: number; dps: number }> = {
  // 第一轮实测修正（n104 三轮收敛的全表外推）：鼓动/量产/狂暴/盾墙/治疗类敌自增强机制是压力
  // 预算外的乘法（n104 实测鼓动+攻速=团队实效 ×1.55·贴线队 35s 团灭）——dps 全表预折；
  // n104 结构结论：自增强机制墙=天然二值形态（悬崖只随 pool 平移·无日内中间胜率点）——
  // 破墙日为锚（卡日 0%/破日干脆过=墙①攒一晚教学字面·§8a 例外记档=n120 跳变先例同款）。
  n054: { pool: 1.0, dps: 0.7 },   // 首Boss（非墙·小鼓动预折）
  n104: { pool: 0.85, dps: 0.42 }, // 墙①战力：三轮收敛值（D3-4 卡 0%/D5 破干脆过·鼓动×2+召唤补员预折）
  n140: { pool: 1.4, dps: 0.8 },   // 墙②机制：复活=二遍池+修理机奶=变相池·双预折
  n176: { pool: 1.05, dps: 0.72 },  // 墙③解题：重锤尖峰在 BOSS_SHAPE·磁暴塔+奶预折
  n214: { pool: 0.95, dps: 0.78 },  // 高潮②：盾墙=变相池预折（演出仗不卡天）
  n250: { pool: 0.55, dps: 0.35 },   // 墙④连战：reviveWaves ×2 总池+大盾+召唤·三重预折
  n282: { pool: 1.0, dps: 0.68 },   // 墙⑤战+机：量产协议召唤海预折
  n312: { pool: 1.0, dps: 0.85 },  // 墙⑥解+连：revive+快召+奶·预折
  n340: { pool: 0.8, dps: 0.5 }, // 高潮③：时间狂暴（120s 封顶 +240% 攻）重预折
  n368: { pool: 0.9, dps: 0.6 },   // 墙⑦机+解：受击狂暴+喷毒·预折
  n384: { pool: 2.0, dps: 0.85 },   // 前哨：快锤形状在 BOSS_SHAPE·中性
  n400: { pool: 0.8, dps: 0.65 },  // 墙⑧战+连：revive ×3 总池·重预折（击杀密度=超新星舞台）
  n450: { pool: 1.0, dps: 0.42 },   // 墙⑨毕业战：马拉松+3 阶段狂暴全屏预折
};
/** 扫参工具单点读本表（s7-wall-boost-scan.mjs 换算基准=磁盘现值·防双账本漂移）。 */
export { WALL_BOOST };
/** ⑩三段 · 节点级职业形状覆写（B5 五态矩阵结构刀·§20.2 n102 特例）：
 *  塔×3 设计密度下守恒摊薄杀死了单塔尖峰（A0 记档）——标量 dps/pool 五轮实证分不开五态（①双护卫组合
 *  杀敌速度=错舰队一半·任何①能清的池③都能竞速）。对症=把尖峰还给每座塔：间隔 1.3→3.0s、单发×2.31
 *  （单位 DPS 守恒·总量不变）——塔回到最高攻（砺咬塔=任务单弹药1 叙事复原）、尖峰打穿脆皮/坦体扛得住，
 *  护后排工具的价值=挡尖峰（二值机理回归 v0.6 形态·密度保持设计 3 座）。 */
const NODE_SHAPE_OVERRIDE: Record<string, Record<string, { interval?: number; atkW?: number }>> = {
  // 批③段三加 atkW 轴：二值机理=塔吃走火力预算（杂兵按权重守恒自动饿死）——
  // 无工具=塔尖峰点死后排（0%）·带嘲讽=尖峰全进铁壁、杂兵磨不死人（过）。
  // 全局 dps 刀分不开这两态（工具组 48s 死于杂兵磨血实证）。
  n102: { bu_enemy_backline: { interval: 3.0, atkW: 3.0 } }, // 对锚批钞门重校·int 2.2 试点=切奶节奏工具组8%坏案记档
};
/** Boss 行分成（血池/火力占比·余量归 adds）。 */
const BOSS_SHARE = { hp: 0.65, dps: 0.3 }; // 首扫诊断：0.5 全压单点=前排瞬融·Boss=重锤节奏不是速射炮
/** 段2 · Boss 形状覆写（手调通道·公式参数层——只对对位表点名形状词的 Boss 配，其余全默认；
 *  血攻仍走压力公式守恒=k 合同结构性免疫，此表只调"同预算下的形状"）：
 *  n176 废铁泰坦=真源"超高血高防"+重锤（hpShare 抬/防抬/间隔拉长·单发=DPS×interval 自动变重）；
 *  n384 风暴哨兵=增幅域快节奏（间隔缩短=快锤）；n400 风暴壁垒=重装（防抬）。 */
export const BOSS_SHAPE_OVERRIDE: Record<string, { hpShare?: number; interval?: number; armor?: number }> = {
  n176: { hpShare: 0.75, interval: 2.6, armor: 60 },
  n384: { interval: 1.4 },
  n400: { armor: 50 },
};

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
/** φ 换算恒等化（定价重锚 v1·2026-07-11）：旧 φ=strengthIndex(plan(P))/strengthIndex(plan(500))
 *  （反解器+阶乘+growth 带的分析近似）是给"刻度≠强度"打的补丁——v0 刻度纸面涨速与真机强度脱钩，
 *  φ 负责吸漂移，代价=φ 台阶局部非单调（3622→3912 反降 7.3% 实测）+ ≈28k 饱和（反解器顶）。
 *  v1 刻度按实测重标后"刻度即强度"（tools/s7-power-recalib.mjs·同刻度≈同强度 RMSE 2%），
 *  φ(P)=P/500 恒等——补丁失去存在理由，随根因一并拆除（strengthIndex/growthRatioOf 已删）。
 *  敌火晚段 ^1.08 结构补偿保留（套件结构价值不随战力砍半·与刻度诚实无关的独立机理）。 */
const PHI_BASE = 500; // k 合同锚点

export function mapPressureToEnemies(bundle: Bundle, nodeId: string, pressure: number): NodeScale {
  const encs = bundle.battle_encounter_param as unknown as S7BattleEncounterParam[];
  const spawns = bundle.battle_spawn_param as unknown as S7BattleSpawnParam[];
  const enc = encs.find((e) => e.nodeRef === nodeId);
  if (!enc) throw new Error(`无 encounter：${nodeId}`);
  const stage = enc.stageType as NodeScale['stage'];
  const mult = STAGE_MULT[stage];
  // φ 恒等（v1 刻度即强度·见上方注释）；教学段 P<起手战力=碾压语义天然保留（线性全程一条式）。
  const phiPool = pressure / PHI_BASE;
  // 敌火晚段 ^1.08 结构补偿保留（φ>1 才作用）：套件结构价值（复活/免控/保底）不随战力砍半，
  // 纯属性压强晚段追不上=砍半晚段 64% 实证——这是"结构件不缩放"的独立机理，不随刻度诚实化消失。
  const phiDps = phiPool > 1 ? Math.pow(phiPool, 1.08) : phiPool;
  const wall = WALL_BOOST[nodeId] ?? { pool: 1, dps: 1 };
  const pool = K_HP * PHI_BASE * phiPool * mult.pool * wall.pool;
  let dps = K_DPS * PHI_BASE * phiDps * mult.dps * wall.dps;

  // 该关单位数量表（按 spawn 计划）：rowId → count。
  const counts = new Map<string, number>();
  for (const ref of enc.spawnPlanRefs) {
    const sp = spawns.find((s) => s.rowId === ref);
    if (!sp) continue;
    counts.set(sp.unitStatRef, (counts.get(sp.unitStatRef) ?? 0) + sp.count);
  }
  const units: NodeScale['units'] = {};
  // 节点行归一（落数后 encounter 引用 bu_nXXX_<role>·查形状表前还原为全局职业键；add/sadd=boss_add 形状）
  const roleKeyOf = (rowId: string): string => {
    if (rowId.startsWith('bu_boss_')) return rowId;
    const m = rowId.match(/^bu_n\d+_(.+)$/);
    if (!m) return rowId;
    const suffix = m[1] === 'add' || m[1] === 'sadd' ? 'boss_add' : m[1];
    return `bu_enemy_${suffix}`;
  };
  const bossRows = [...counts.keys()].filter((r) => r.startsWith('bu_boss_'));
  const normalRows = [...counts.keys()].filter((r) => !r.startsWith('bu_boss_'));
  // 批③段三·集中度折扣 v2（全局结构规则·非点调）：纯阵把整份火力预算灌进同一种威胁型，
  // 职业攻权在纯阵上守恒自消=无旋钮可拧（n104 纯塔阵两版工具全灭实证）。v1 对所有纯阵打折=
  // 误伤全局（大多数普通关本就单一职业·世界火力 −30%·砍半面报废实证）——v2 只折"集中威胁型"
  // 纯阵（点名塔/重炮=定点爆发类），糊脸型（蜂群/盾/召唤）纯阵威胁本就弥散不折。
  const CONCENTRATED_ROLES = new Set(['bu_enemy_backline', 'bu_enemy_burst_raider']);
  const pureRoles = new Set(normalRows.map((r) => roleKeyOf(r)));
  if (stage !== 'boss' && pureRoles.size === 1 && CONCENTRATED_ROLES.has([...pureRoles][0])) dps *= 0.7;

  let poolLeft = pool;
  let dpsLeft = dps;
  for (const bossRow of bossRows) {
    const shape = BOSS_SHAPE_OVERRIDE[nodeId] ?? {};
    const hp = Math.round((pool * (shape.hpShare ?? BOSS_SHARE.hp)) / bossRows.length);
    const bossDps = (dps * BOSS_SHARE.dps) / bossRows.length;
    const interval = shape.interval ?? 2.0; // 重锤：单发大、频率低（前排能被奶回来=有惊无险而非瞬蒸发）
    units[bossRow] = { maxHp: hp, attack: Math.max(1, Math.round(bossDps * interval)), armor: shape.armor ?? 35, attackIntervalSec: interval };
    poolLeft -= hp;
    dpsLeft -= bossDps;
  }
  // 权重分摊（血/攻各自守恒）。
  let hpWSum = 0;
  let atkWSum = 0;
  for (const r of normalRows) {
    const shape = { ...(ROLE_SHAPE[roleKeyOf(r)] ?? { hpW: 1, atkW: 1, armor: 10, interval: 1.2 }), ...(NODE_SHAPE_OVERRIDE[nodeId]?.[roleKeyOf(r)] ?? {}) };
    hpWSum += shape.hpW * (counts.get(r) ?? 0);
    atkWSum += shape.atkW * (counts.get(r) ?? 0);
  }
  for (const r of normalRows) {
    const shape = { ...(ROLE_SHAPE[roleKeyOf(r)] ?? { hpW: 1, atkW: 1, armor: 10, interval: 1.2 }), ...(NODE_SHAPE_OVERRIDE[nodeId]?.[roleKeyOf(r)] ?? {}) };
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
  /** true=不做内存缩放、直接跑落地 JSON（⑥三段落数后的验收模式）。 */
  noScale?: boolean;
  /** true=阵容战力用"该关到达时点养成态"（⑧ --milestones）而非压力值——任务单三段#1 正主验收。 */
  milestonePower?: boolean;
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
      return num >= (opts.fromNode ?? 1) && num <= (opts.toNode ?? 450); // 450 关新世界默认全扫（旧 150=段1 前欠账·段2 修）
    });
  const encs = base.battle_encounter_param as unknown as S7BattleEncounterParam[];
  const service = new S7BattleRunService();
  const milestones = opts.milestonePower ? loadMilestones() : null;
  const out: NodeReport[] = [];

  for (const nodeId of nodes) {
    const enc = encs.find((e) => e.nodeRef === nodeId);
    if (!enc) continue;
    const num = Number(nodeId.slice(1));
    const p = pressure[num];
    const arrivalPower = milestones?.get(nodeId)?.power;
    const b = clone(base);
    if (!opts.noScale) {
      const scale = mapPressureToEnemies(b, nodeId, p);
      const unitRows = b.battle_unit_stat_param as Row[];
      for (const [rowId, attrs] of Object.entries(scale.units)) {
        const r = unitRows.find((x) => x.rowId === rowId);
        if (r) Object.assign(r, attrs);
      }
    }
    const targetPower = (arrivalPower ?? p) * (opts.powerRatio ?? 1);
    const { lineup, teamPower } = genLineup(family, targetPower, enc.problemTagRef, enc.stageType);
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
        hardControlDiminish: S7_HARD_CONTROL_DIMINISH, // C14 真值（真机三入口同口径）
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
  const toNode = Number(arg('to', '450')); // 450 关新世界默认（段2 对齐）
  const powerRatio = Number(arg('power-ratio', '1'));
  const noScale = argv.includes('--no-scale');
  const milestonePower = argv.includes('--milestone-power');
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
    const { lineup, teamPower, plan } = genLineup(family, pressure[num] * powerRatio, enc2.problemTagRef, enc2.stageType);
    console.log(`[debug] 阵容：${plan.tier}阶 Lv${plan.level} 插件${plan.plugins.join('/')} 核=${plan.withCore} 战力=${Math.round(teamPower)}`);
    const runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(b));
    const r = new S7BattleRunService().run({ runtime, progress: { currentNodeId: debugNode, clearedNodeIds: [] }, runSeed: 'dbg', lineup, hardControlDiminish: S7_HARD_CONTROL_DIMINISH });
    console.log(`[debug] winner=${r.result.winner} reason=${r.result.reason} dur=${r.result.durationSec}s`);
    for (const u of r.result.finalState.players) console.log(`[debug]   我 ${u.unitStatRef}@${u.slotRef}: ${u.hp}/${u.maxHp}${u.alive ? '' : ' ✝'}`);
    const aliveE = r.result.finalState.enemies.filter((u) => u.alive);
    console.log(`[debug]   敌存活 ${aliveE.length}：${aliveE.slice(0, 6).map((u) => `${u.unitStatRef}:${u.hp}/${u.maxHp}`).join(' | ')}`);
    return 0;
  }
  const t0 = Date.now();
  const reports = await scanMainlineAsync({ family, samples, fromNode, toNode, powerRatio, noScale, milestonePower });
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

// 运行件 re-export（quick 实测脚本复用面·⑥三段悬赏敌配实测起）——纯导出零逻辑。
export { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
export { S7BattleRunService } from '../assets/scripts/core/s7/S7BattleRunService';
export { S7_HARD_CONTROL_DIMINISH } from '../assets/scripts/core/s7/S7AutoBattleTypes';
