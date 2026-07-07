// 效果装配层（v1.0 §4.6 的"积木 + 引擎"地基）。
// 职责：把一艘船的基础战斗属性 + 四层（星舰/驾驶员/插件/星核）产生的全部效果积木，
//       按统一规则合并成"最终战斗单位"（属性 + 词条 + 目标 + 动作槽 + 触发表）。
// 引擎不关心"是什么组合"，只吃本层算出的最终结果（块1b 接入）。
// 纯函数、确定性、不依赖 cc，可在 Node/Vitest 单测；复杂度只跟"积木种类"线性相关。
//
// 边界：块1 只做"属性 + 效果 + 目标"的装配；技能"取消能量→三类触发"的触发机制由块2 实现，
//       本层仅把触发类积木收集进 triggers 供块2 消费。

import {
  S7EffectBlock,
  S7AffixKey,
  S7StatKey,
  S7TriggerBlock,
  S7StackRuleParam,
} from './S7BattleEffectBlock';

/** 装配层输入：一艘船的基础战斗属性（取自 battle_unit_stat_param 的舰行）。 */
export interface S7DeriveBaseStat {
  maxHp: number;
  attack: number;
  armor: number;
  attackIntervalSec: number;
  attackRangeCells: number;
  passiveEnergyPerSec: number;
  sizeRows: number;
  sizeCols: number;
  targetingTag: string;
  normalEffectRef: string;
  ultimateEffectRef: string;
  coreEffectRef: string;
}

/** 装配层输出：合并四层积木后的最终战斗单位规格。 */
export interface S7DerivedUnit {
  maxHp: number;
  attack: number;
  armor: number;
  attackIntervalSec: number;
  attackRangeCells: number;
  passiveEnergyPerSec: number;
  sizeRows: number;
  sizeCols: number;
  /** 定向词条（同 affix 累加；引擎在后续块按需读取）。 */
  affixes: Record<S7AffixKey, number>;
  /** 目标选择（行为类覆盖，后者覆盖前者；无行为积木则用基础 targetingTag）。 */
  targetingTag: string;
  normalEffectRef: string;
  ultimateEffectRef: string;
  coreEffectRef: string;
  /** 触发类积木（块2 消费）。 */
  triggers: S7TriggerBlock[];
  /** ⑦机制批① 叠层规则积木（引擎消费；无积木=空数组=行为不变）。 */
  stackRules: S7StackRuleParam[];
}

const STAT_KEYS: S7StatKey[] = [
  'maxHp', 'attack', 'armor', 'attackIntervalSec', 'attackRangeCells', 'passiveEnergyPerSec',
];

const AFFIX_KEYS: S7AffixKey[] = [
  'critRate', 'critDmg', 'shieldBreak', 'skillHaste', 'healPower', 'controlResist', 'dmgVsSwarm', 'dmgVsBoss',
  // ⑥8a 受控并行加法（缺省 0=行为不变），语义见 S7BattleEffectBlock 注释
  'dmgVsLowHp', 'dmgVsHighHp', 'dmgVsFortified', 'armorPen', 'lifesteal', 'dodgeRate',
  'dmgTakenPct', 'healTakenPct', 'shieldPower', 'healVsLowHp', 'skillDmgPct', 'effectAmp',
  'durationPct', 'summonCapBonus',
];

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * 合并基础属性与效果积木，产出最终战斗单位。叠加规则（首版口径，非最终平衡）：
 * - 修正类：同一 stat 先把所有 flat 相加，再乘 (1 + Σpct)；最后按属性各自下限钳制。
 *   （attackIntervalSec 用负 pct 表示加速；如 skillHaste 插件给 attackIntervalSec -10%。）
 * - affix：同 affix 直接累加。
 * - behavior：后出现的覆盖前者（驾驶员能力覆盖星舰默认 targetingTag）。
 * - action：按 slot 覆盖对应槽（星核可把 normal 槽换成原子炮等）。
 * - trigger：收集进 triggers（块2 消费）。
 */
export function deriveUnit(base: S7DeriveBaseStat, blocks: readonly S7EffectBlock[] = []): S7DerivedUnit {
  const acc: Record<S7StatKey, { flat: number; pct: number; set: number | null }> =
    {} as Record<S7StatKey, { flat: number; pct: number; set: number | null }>;
  for (const k of STAT_KEYS) acc[k] = { flat: 0, pct: 0, set: null };

  const affixes: Record<S7AffixKey, number> = {} as Record<S7AffixKey, number>;
  for (const a of AFFIX_KEYS) affixes[a] = 0;

  let targetingTag = base.targetingTag;
  let normalEffectRef = base.normalEffectRef;
  let ultimateEffectRef = base.ultimateEffectRef;
  let coreEffectRef = base.coreEffectRef;
  const triggers: S7TriggerBlock[] = [];
  const stackRules: S7StackRuleParam[] = [];

  for (const b of blocks) {
    switch (b.kind) {
      case 'modifier': {
        const slot = acc[b.stat];
        if (!slot) throw new Error(`未知的修正属性: ${String(b.stat)}`);
        if (b.op === 'flat') slot.flat += b.value;
        else if (b.op === 'pct') slot.pct += b.value;
        else slot.set = b.value; // 'set'：覆盖基线为绝对值（后者覆盖前者；flat/pct 仍在其上叠加）
        break;
      }
      case 'affix':
        if (!(b.affix in affixes)) throw new Error(`未知的词条: ${String(b.affix)}`);
        affixes[b.affix] += b.value;
        break;
      case 'behavior':
        targetingTag = b.targetingTag;
        break;
      case 'action':
        if (b.slot === 'normal') normalEffectRef = b.effectRef;
        else if (b.slot === 'ultimate') ultimateEffectRef = b.effectRef;
        else coreEffectRef = b.effectRef;
        break;
      case 'trigger':
        triggers.push(b);
        break;
      case 'stack':
        stackRules.push(b.rule);
        break;
      default: {
        const _exhaustive: never = b;
        throw new Error(`未知积木类型: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  const calc = (k: S7StatKey): number => ((acc[k].set ?? base[k]) + acc[k].flat) * (1 + acc[k].pct);

  return {
    maxHp: Math.max(1, Math.round(calc('maxHp'))),
    attack: Math.max(0, Math.round(calc('attack'))),
    armor: Math.max(0, Math.round(calc('armor'))),
    attackIntervalSec: Math.max(0.1, round6(calc('attackIntervalSec'))),
    attackRangeCells: Math.max(0, round6(calc('attackRangeCells'))),
    passiveEnergyPerSec: Math.max(0, round6(calc('passiveEnergyPerSec'))),
    sizeRows: base.sizeRows,
    sizeCols: base.sizeCols,
    affixes,
    targetingTag,
    normalEffectRef,
    ultimateEffectRef,
    coreEffectRef,
    triggers,
    stackRules,
  };
}
