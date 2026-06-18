// 插件合成（块6d-2，纯 TS，不依赖 cc）：v1.0 §5.3 品质提升=合成。
// 规则：消耗 3 个「同槽位类型 + 同品质」插件实例 → 产出 1 个「高一阶、同槽位类型」实例，词条在该槽位类型内随机。
//   起步比例 3 同→1 高阶（v1.0 §5.3 已定，可调留第二块）；阶梯 精良→优秀→传奇（传奇为顶，不可再合）。
// 随机与防刷（Ron 拍板·本地确定性种子）：随机词条用 inv.nextActionSeq 派生确定性 RNG（复用 S7AutoBattleRng/mulberry32）；
//   nextActionSeq 递增、玩家不可预测控制 → 防"挑输入凑好词条"的存档刷。合成消费 3 个输入实例 → 天然幂等
//   （重放同一组输入会因实例已消费而失败，不双花）；显式动作 id 流水防重留在线化(P1)。

import { S7PluginConfig, S7PluginSlot } from '../../config/s7/ConfigTypesS7';
import { S7PluginQuality } from './S7PluginEffects';
import {
  S7PluginInventoryState,
  S7OwnedPlugin,
  addOwnedPlugin,
  removeOwnedPlugin,
  findOwnedPlugin,
} from './S7PluginInventory';
import { S7AutoBattleRng } from './S7AutoBattleRng';

/** 起步合成比例：3 同 → 1 高阶（v1.0 §5.3，可调留第二块）。 */
export const S7_SYNTH_INPUT_COUNT = 3;

/** 品质阶梯：精良→优秀→传奇；传奇为顶（不可再合）。 */
const QUALITY_NEXT: Record<S7PluginQuality, S7PluginQuality | null> = {
  fine: 'superior',
  superior: 'legendary',
  legendary: null,
};

export type S7SynthesizeErrorCode =
  | 'need_exactly_3_distinct' // 必须恰好 3 个互不相同的实例
  | 'instance_not_found' // 某输入实例不在库存
  | 'unknown_plugin' // 某输入实例的词条不在 plugin_config
  | 'slot_mismatch' // 3 个不在同一槽位类型
  | 'quality_mismatch' // 3 个品质不一致
  | 'quality_not_upgradable'; // 传奇已是顶，不可合

export type S7SynthesizeResult =
  | { ok: true; output: S7OwnedPlugin }
  | { ok: false; code: S7SynthesizeErrorCode };

/**
 * 合成：就地修改库存（消费 3 输入、产出 1 高阶、推进 nextActionSeq）；任一前置不满足返回 {ok:false,code}，不改库存。
 * pluginConfigs 用于查每个实例词条的槽位类型 + 该槽位的随机词条池。
 */
export function synthesizePlugins(
  inv: S7PluginInventoryState,
  inputInstanceIds: readonly string[],
  pluginConfigs: readonly S7PluginConfig[],
): S7SynthesizeResult {
  // 恰好 3 个、互不相同。
  if (inputInstanceIds.length !== S7_SYNTH_INPUT_COUNT || new Set(inputInstanceIds).size !== S7_SYNTH_INPUT_COUNT) {
    return { ok: false, code: 'need_exactly_3_distinct' };
  }
  const slotOf = (pluginId: string): S7PluginSlot | undefined => pluginConfigs.find((c) => c.pluginId === pluginId)?.slotTag;

  const inputs: S7OwnedPlugin[] = [];
  for (const id of inputInstanceIds) {
    const inst = findOwnedPlugin(inv, id);
    if (!inst) return { ok: false, code: 'instance_not_found' };
    if (!slotOf(inst.pluginId)) return { ok: false, code: 'unknown_plugin' };
    inputs.push(inst);
  }

  const slot = slotOf(inputs[0].pluginId)!;
  if (!inputs.every((i) => slotOf(i.pluginId) === slot)) return { ok: false, code: 'slot_mismatch' };
  const quality = inputs[0].quality;
  if (!inputs.every((i) => i.quality === quality)) return { ok: false, code: 'quality_mismatch' };
  const outQuality = QUALITY_NEXT[quality];
  if (outQuality === null) return { ok: false, code: 'quality_not_upgradable' };

  // 槽内随机词条池（该槽位全部 plugin_config 词条，按配置顺序，保证 RNG 可复现）。
  const pool = pluginConfigs.filter((c) => c.slotTag === slot).map((c) => c.pluginId);
  // 确定性种子：nextActionSeq（隐藏递增，玩家不可控）。
  const chosenPluginId = new S7AutoBattleRng(`craft:${inv.nextActionSeq}`).pick(pool) as string;
  inv.nextActionSeq += 1;

  for (const inst of inputs) removeOwnedPlugin(inv, inst.instanceId);
  const output = addOwnedPlugin(inv, chosenPluginId, outQuality);
  return { ok: true, output };
}
