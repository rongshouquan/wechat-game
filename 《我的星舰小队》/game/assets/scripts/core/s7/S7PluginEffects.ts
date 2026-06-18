// 插件运行时（块4a）：把一个「插件实例」(词条 + 槽位 + 品质) 解析成效果积木（v1.0 §5.3：插件 = 定向数值/小效果，只分品质不分等级）。
// 与星核解析器(S7CoreEffects)同构：配置(plugin_config)只描述插件身份/语义标签；可执行的数值修正由本解析器产出，
// 喂进装配层 deriveUnit 合成。纯 TS、可 Node 测，不依赖 cc。
//
// 品质制（v1.0 §5.3 / 插件方案-v1）：精良 / 优秀 / 传奇——
//   - 同品质内无升级；变强靠「用更高品质替换」或「合成升品」。
//   - 品质只缩放数值（精良温和 → 优秀更强 → 传奇强数值）；传奇额外多一条小效果/特色。
//
// 首版口径（占位，与块3 星核同策略）：每条插件词条的「具体效果/数值」留第二块细表，
// 本解析器先按「槽位」给一条通用修正，证明「接线 + 品质缩放 + 传奇额外效果」机制成立；
// 第二块填内容时，本表改为按 pluginId 索引、给出每条词条的精确效果即可，调用方不变。

import type { S7PluginSlot } from '../../config/s7/ConfigTypesS7';
import { S7EffectBlock, S7StatKey, S7AffixKey } from './S7BattleEffectBlock';

/** 插件品质（v1.0 §5.3）：精良 / 优秀 / 传奇。无等级，只分品质。 */
export type S7PluginQuality = 'fine' | 'superior' | 'legendary';
export const S7_PLUGIN_QUALITIES: readonly S7PluginQuality[] = ['fine', 'superior', 'legendary'];

/** 品质数值缩放（占位，真值第二块）：精良基准 ×1 / 优秀 ×1.6 / 传奇 ×2.2。 */
const QUALITY_SCALE: Record<S7PluginQuality, number> = { fine: 1, superior: 1.6, legendary: 2.2 };

/**
 * 槽位通用「主效果」占位（数值占位，每条词条细分留第二块）。
 * 全部用引擎已消费的「修正类」积木，装上即在战斗里生效，便于验证接线 + 品质缩放：
 *   - weapon（武器槽）  → 加伤 %（attack +pct，正向增益）
 *   - skill（技能/CD槽）→ 缩短攻击间隔 %（attackIntervalSec -pct = 缩 CD / 提速，故取负）
 *   - tactical（战术槽）→ 加护甲 %（armor +pct，减伤方向）
 */
const SLOT_PRIMARY: Record<S7PluginSlot, { stat: S7StatKey; base: number; sign: 1 | -1 }> = {
  weapon: { stat: 'attack', base: 0.1, sign: 1 },
  skill: { stat: 'attackIntervalSec', base: 0.1, sign: -1 },
  tactical: { stat: 'armor', base: 0.1, sign: 1 },
};

/**
 * 传奇额外「小效果」占位（v1.0：传奇 = 强数值 + 一条额外小效果/特色）。落在定向词条(affix)上，
 * 累加收集（引擎消费定向词条 = 块4b）。值随品质缩放（仅传奇才有，故按传奇倍率算）。
 */
const SLOT_LEGENDARY_EXTRA: Record<S7PluginSlot, { affix: S7AffixKey; base: number }> = {
  weapon: { affix: 'critRate', base: 0.05 },
  skill: { affix: 'skillHaste', base: 0.05 },
  tactical: { affix: 'controlResist', base: 0.05 },
};

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * 把一个插件实例解析成效果积木。pluginId 仅用于溯源标识（首版按 slotTag 给占位效果，
 * 第二块改为按 pluginId 给精确词条）；slotTag/quality 决定实际修正。
 */
export function pluginBlocks(pluginId: string, slotTag: S7PluginSlot, quality: S7PluginQuality): S7EffectBlock[] {
  const scale = QUALITY_SCALE[quality];
  const primary = SLOT_PRIMARY[slotTag];
  const blocks: S7EffectBlock[] = [
    {
      kind: 'modifier',
      stat: primary.stat,
      op: 'pct',
      value: round6(primary.base * primary.sign * scale),
      source: `plugin:${pluginId}`,
    },
  ];
  // 传奇额外小效果：再附一条定向词条（块4b 起引擎消费）。
  if (quality === 'legendary') {
    const extra = SLOT_LEGENDARY_EXTRA[slotTag];
    blocks.push({
      kind: 'affix',
      affix: extra.affix,
      value: round6(extra.base * scale),
      source: `plugin:${pluginId}:legendary`,
    });
  }
  return blocks;
}
