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

/** 定向词条（插件提供的附加战斗参数；块1 先收集承载，引擎在后续块按需读取）。 */
export type S7AffixKey =
  | 'critRate'
  | 'critDmg'
  | 'shieldBreak'
  | 'skillHaste'
  | 'healPower'
  | 'controlResist'
  | 'dmgVsSwarm'
  | 'dmgVsBoss';

/** 动作落在哪个槽（普攻 / 大招 / 星核）。星核质变可覆盖 normal 槽（如过载核心把普攻换原子炮）。 */
export type S7ActionSlot = 'normal' | 'ultimate' | 'core';

/** ① 修正类：对某个基础属性做 加法/百分比 修正。 */
export interface S7ModifierBlock {
  kind: 'modifier';
  stat: S7StatKey;
  /** flat=直接加减；pct=百分比（0.15 = +15%，-0.1 = -10%，可叠加）。 */
  op: 'flat' | 'pct';
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

/** ② 触发类：技能/效果何时触发。块1 仅定义并收集，触发机制由块2 实现。 */
export interface S7TriggerBlock {
  kind: 'trigger';
  on: 'battle_start' | 'cd' | 'on_kill' | 'hp_below' | 'on_hit' | 'passive';
  /** on='cd' 时的冷却秒数。 */
  cdSec?: number;
  /** on='hp_below' 时的血量阈值（0~1）。 */
  threshold?: number;
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
  | S7ActionBlock;
