// 插件库存（块6d-1，纯 TS，不依赖 cc）：v1.0 §5.3「插件实例制」的存档载体。
// 拥有的插件 = 实例（词条 pluginId + 品质 quality + 唯一 instanceId）；本模块只管「背包/库存」的状态结构与增删查，
// 合成(6d-2)/回收(6d-3) 在其上构建。槽位由 pluginId 经 plugin_config 派生，不在此存（避免冗余/不一致）。
//
// 设计与 S7MainlineProgress 同构：本模块拥有库存子状态的形状 + createDefault/normalize，S7SaveService 组合进 S7PlayerState。

import { S7PluginQuality, S7_PLUGIN_QUALITIES } from './S7PluginEffects';

/** 一个拥有的插件实例：唯一 id + 词条(plg01-18) + 品质。slotTag 由 pluginId 派生，不存。 */
export interface S7OwnedPlugin {
  instanceId: string;
  pluginId: string;
  quality: S7PluginQuality;
}

/** 插件库存子状态：实例列表 + 下一个实例 id 的递增计数（保证 instanceId 唯一、可复现）。 */
export interface S7PluginInventoryState {
  plugins: S7OwnedPlugin[];
  nextInstanceSeq: number;
}

const INSTANCE_PREFIX = 'pi';

/** 默认空库存。 */
export function createDefaultS7PluginInventory(): S7PluginInventoryState {
  return { plugins: [], nextInstanceSeq: 1 };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** 从 'pi<N>' 形式 instanceId 解析出数字序号；非该形式返回 0。 */
function parseSeq(instanceId: string): number {
  if (!instanceId.startsWith(INSTANCE_PREFIX)) return 0;
  const n = Number(instanceId.slice(INSTANCE_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * 规范化库存：丢弃结构非法实例（instanceId/pluginId 非空字符串、quality 合法），instanceId 去重（保留先出现的）；
 * nextInstanceSeq 取 max(原值, 现有实例最大序号+1, 1) 的非负整数——防脏档/篡改导致后续 mint 出重复 id。
 * 注：不校验 pluginId 是否存在于 plugin_config（那是运行时/装配层的事，本存档层与配置解耦）。
 */
export function normalizeS7PluginInventory(raw: unknown): S7PluginInventoryState {
  const out = createDefaultS7PluginInventory();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  let maxSeq = 0;
  if (Array.isArray(src.plugins)) {
    for (const item of src.plugins) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      if (!isNonEmptyString(p.instanceId) || !isNonEmptyString(p.pluginId)) continue;
      if (typeof p.quality !== 'string' || !S7_PLUGIN_QUALITIES.includes(p.quality as S7PluginQuality)) continue;
      if (seen.has(p.instanceId)) continue; // 去重
      seen.add(p.instanceId);
      out.plugins.push({ instanceId: p.instanceId, pluginId: p.pluginId, quality: p.quality as S7PluginQuality });
      maxSeq = Math.max(maxSeq, parseSeq(p.instanceId));
    }
  }
  const rawSeq = src.nextInstanceSeq;
  const seqVal = typeof rawSeq === 'number' && Number.isInteger(rawSeq) && rawSeq > 0 ? rawSeq : 1;
  out.nextInstanceSeq = Math.max(seqVal, maxSeq + 1, 1);
  return out;
}

/** 新增一个插件实例（mint 唯一 instanceId）；就地修改库存并返回新实例。 */
export function addOwnedPlugin(inv: S7PluginInventoryState, pluginId: string, quality: S7PluginQuality): S7OwnedPlugin {
  const instance: S7OwnedPlugin = { instanceId: `${INSTANCE_PREFIX}${inv.nextInstanceSeq}`, pluginId, quality };
  inv.nextInstanceSeq += 1;
  inv.plugins.push(instance);
  return instance;
}

/** 按 instanceId 移除一个实例；移除成功返回 true，找不到返回 false。 */
export function removeOwnedPlugin(inv: S7PluginInventoryState, instanceId: string): boolean {
  const i = inv.plugins.findIndex((p) => p.instanceId === instanceId);
  if (i < 0) return false;
  inv.plugins.splice(i, 1);
  return true;
}

/** 按 instanceId 查实例。 */
export function findOwnedPlugin(inv: S7PluginInventoryState, instanceId: string): S7OwnedPlugin | undefined {
  return inv.plugins.find((p) => p.instanceId === instanceId);
}
