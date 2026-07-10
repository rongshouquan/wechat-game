// 效果积木（v1.0 §4.6）：把"驾驶员 × 星舰 × 插件 × 星核"的海量组合拆成一套有限、可复用的积木。
// 装配层（S7BattleStatDerivation）只把一艘船四层产生的全部积木收集、按规则合并，不关心"是什么组合"。
// 纯数据 + 纯类型，不依赖 cc，可在 Node/Vitest 单测。
//
// 四类积木（与 v1.0 §4.6 一一对应）：
//   ① 修正类 modifier/affix —— 调数值（插件、驾驶天赋数值）
//   ② 触发类 trigger        —— 技能何时触发（块2 接入触发机制，块1 仅定义+收集）
//   ③ 行为类 behavior       —— 选目标/打谁（驾驶能力，块5 填内容）
//   ④ 动作类 action         —— 伤害/范围爆炸/召唤/治疗/施加状态（引用 battle_effect_param）

/** 可被「修正类」积木调整的 6 个基础战斗属性（与 battle_unit_stat_param 对齐）。 */
export type S7StatKey =
  | 'maxHp'
  | 'attack'
  | 'armor'
  | 'attackIntervalSec'
  | 'attackRangeCells'
  | 'passiveEnergyPerSec';

/** 定向词条（插件提供的附加战斗参数；块1 先收集承载，引擎在后续块按需读取）。
 *  任务单⑥8a 受控并行加法（2026-07-07）新增 14 条——全部"缺省 0=引擎行为逐字节不变"：
 *  条件伤害族 dmgVsLowHp(影斩首·目标<残血阈值)/dmgVsHighHp(烬贪婪·目标>高血阈值)/dmgVsFortified(破障·带盾或高防)
 *  公式族 armorPen(藏破甲·无视防御%)/lifesteal(嗜血·按实际扣血回吸)/dodgeRate(警戒雷达·受击方闪避)
 *  受方族 dmgTakenPct(护盾发生器·负值=减伤)/healTakenPct(治疗强化·受治疗加成)
 *  施方族 shieldPower(护盾强度·晨曦S/苏)/healVsLowHp(苏回光·对残血友军)/skillDmgPct(增幅线圈·仅技能/星核伤害)
 *        /effectAmp(增效·技能效果量通用)/durationPct(持久力场·施加状态时长)
 *  召唤族 summonCapBonus(巡增产·同源场上上限加值·配合 effect.summonSourceCap) */
export type S7AffixKey =
  | 'critRate'
  | 'critDmg'
  | 'shieldBreak'
  | 'skillHaste'
  | 'healPower'
  | 'controlResist'
  | 'dmgVsSwarm'
  | 'dmgVsBoss'
  | 'dmgVsLowHp'
  | 'dmgVsHighHp'
  | 'dmgVsFortified'
  | 'armorPen'
  | 'lifesteal'
  | 'dodgeRate'
  | 'dmgTakenPct'
  | 'healTakenPct'
  | 'shieldPower'
  | 'healVsLowHp'
  | 'skillDmgPct'
  | 'effectAmp'
  | 'durationPct'
  | 'summonCapBonus'
  // 机制批③ 星核词条（全部"缺省 0=引擎行为逐字节不变"）：
  //   skillHitCurHpPct=引力阱（技能命中追加 目标当前生命×系数）/ skillHitCapAtkMult=引力阱追伤上限（本舰攻×系数）
  //   dmgSplitFattestPct=共鸣音叉（本舰直接伤害的一部分同时打向全场最高血敌）
  //   luckyOnCast=幸运扭蛋（>0 时每次放技能随机一种强化·路由在引擎）
  | 'skillHitCurHpPct'
  | 'skillHitCapAtkMult'
  | 'dmgSplitFattestPct'
  | 'luckyOnCast';

/** 动作落在哪个槽（普攻 / 大招 / 星核）。星核质变可覆盖 normal 槽（如过载核心把普攻换原子炮）。 */
export type S7ActionSlot = 'normal' | 'ultimate' | 'core';

/** ① 修正类：对某个基础属性做 加法/百分比 修正。 */
export interface S7ModifierBlock {
  kind: 'modifier';
  stat: S7StatKey;
  /** flat=直接加减；pct=百分比（0.15=+15%，可叠加）；set=覆盖为绝对值（质变用，如过载核心把普攻间隔设为 10s）。 */
  op: 'flat' | 'pct' | 'set';
  value: number;
  /** 来源标识（pluginId/pilotId/coreId），仅调试/溯源用，不影响计算。 */
  source?: string;
}

/** ① 修正类（定向词条变体）：落在 affix（累加），不动基础属性。 */
export interface S7AffixBlock {
  kind: 'affix';
  affix: S7AffixKey;
  value: number;
  source?: string;
}

/** ② 触发类：技能/效果何时触发。块1 仅定义并收集，触发机制由块2 实现。
 *  ⑥8a 新增（缺省不用=行为不变）：on='shield_broken'（本单位护盾被打破·超级护罩/晨曦A）、
 *  on='attack_landed'（本单位普攻命中·回充插件〔原蓄能仓〕）；initialCdSec（cd 型首发延迟·超新星"先攒后爆"）；
 *  once（true=事件型触发每场只发一次·缺省事件型可重复）。
 *  ⑦机制批① 新增：on='skill_cast'（本单位放出一次 ultimate 类效果·战鼓；core 类不算——真源"放技能"口径）。 */
export interface S7TriggerBlock {
  kind: 'trigger';
  /** 机制批③：'on_kill_charge'=蓄力攒层（击杀攒 threshold 层满放·引擎按单位行 ultimateChargeKills 内部合成，配置不直接写）。 */
  on: 'battle_start' | 'cd' | 'on_kill' | 'hp_below' | 'on_hit' | 'ally_down' | 'passive'
    | 'shield_broken' | 'attack_landed' | 'skill_cast' | 'on_kill_charge';
  /** on='cd' 时的冷却秒数。 */
  cdSec?: number;
  /** on='cd' 时的首发延迟秒数；缺省 0=开局即放（既有语义）。 */
  initialCdSec?: number;
  /** on='hp_below' 血量阈值（0~1）；on='ally_down' 为"己方已阵亡数"阈值（达到即触发一次）。 */
  threshold?: number;
  /** true=可重复的事件型触发（on_kill/on_hit/shield_broken/attack_landed）改为每场一次。 */
  once?: boolean;
  /** ⑦机制批① 可选（on='on_kill' 专用）：击杀对象 roleTag 过滤——本 tick 击杀名单与集合有交集才触发
   *  （蛰「斩链」杀治疗/召唤源、空「净场」杀召唤物；缺省=任意击杀都触发·旧行为不变）。 */
  onKillRoleTags?: string[];
  /** 触发后释放的动作，指向 battle_effect_param.rowId。 */
  effectRef: string;
  source?: string;
}

/** ③ 行为类：覆盖/指定目标选择。复用引擎 targetingTag 取值。驾驶能力内容由块5 填。 */
export interface S7BehaviorBlock {
  kind: 'behavior';
  targetingTag: string;
  source?: string;
}

/** ⑦机制批① M3 · 单位级叠层规则（事件驱动层数 × 每层数值 + 断条件·全配置驱动）。
 *  载体：炎「过热」(attack_landed+attack_gap断) / 源「专注」(per_second+dmgVsLockedPct+target_switch断) /
 *  铁壁「坚甲」(was_hit_by_skill=真源"重击"口径) / 砺「愈坚」(hp_lost_decile=派生层数·每损10%血1层) /
 *  贪吃星(kill·不封顶) / 燎3★(kill+atkSpeedPct) / 污染体狂暴(was_hit) / Boss随时间狂暴(per_second)。 */
export interface S7StackRuleParam {
  /** 规则标识（日志/溯源用）。 */
  ruleId: string;
  /** 层数累积事件：普攻命中/被任意伤害命中/被技能伤害命中/击杀/每秒/血量流失（每损10%=1层·派生不累积）。 */
  on: 'attack_landed' | 'was_hit' | 'was_hit_by_skill' | 'kill' | 'per_second' | 'hp_lost_decile';
  /** 每层数值挂到哪个轴；dmgVsLockedPct=仅对本单位当前锁定目标生效（源「专注」·配 lock_until_dead）。 */
  stat: 'atkPct' | 'atkSpeedPct' | 'dmgUpPct' | 'dmgTakenDownPct' | 'dmgVsLockedPct';
  /** 每层幅度（正数）。 */
  perStack: number;
  /** 层数上限；缺省=不封顶（贪吃星"本场累积不清空"）。 */
  maxStacks?: number;
  /** 断条件：attack_gap=距最近一次累积事件超过 breakGapSec（炎"断击"口径）/ target_switch=锁定目标变更（源）。缺省=不断。 */
  breakOn?: 'attack_gap' | 'target_switch';
  /** breakOn='attack_gap' 必填：判定断档的间隔秒数。 */
  breakGapSec?: number;
  /** 断档动作：clear=层数清零（缺省）/ decay_1=只降 1 层（炎 Lv100 口径·每满一个 gap 降一次）。 */
  breakAction?: 'clear' | 'decay_1';
  source?: string;
}

/** ①' 叠层类：把一条叠层规则挂到本单位（装配层收集·引擎消费）。 */
export interface S7StackBlock {
  kind: 'stack';
  rule: S7StackRuleParam;
  source?: string;
}

/** ④ 动作类：直接引用 battle_effect_param 的动作，按 slot 落到普攻/大招/星核槽。 */
export interface S7ActionBlock {
  kind: 'action';
  slot: S7ActionSlot;
  effectRef: string;
  source?: string;
}

export type S7EffectBlock =
  | S7ModifierBlock
  | S7AffixBlock
  | S7TriggerBlock
  | S7BehaviorBlock
  | S7ActionBlock
  | S7StackBlock;
