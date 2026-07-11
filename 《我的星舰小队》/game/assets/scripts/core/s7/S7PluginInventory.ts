// 插件库存（块6d-1，纯 TS，不依赖 cc）：v1.0 §5.3「插件实例制」的存档载体。
// 拥有的插件 = 实例（词条 pluginId + 品质 quality + 唯一 instanceId）；本模块只管「背包/库存」的状态结构与增删查，
// 合成(6d-2)/回收(6d-3) 在其上构建。槽位由 pluginId 经 plugin_config 派生，不在此存（避免冗余/不一致）。
//
// 设计与 S7MainlineProgress 同构：本模块拥有库存子状态的形状 + createDefault/normalize，S7SaveService 组合进 S7PlayerState。

import { S7PluginQuality, S7_PLUGIN_QUALITIES } from './S7PluginEffects';

/** 一个拥有的插件实例：唯一 id + 词条(plg01-30) + 品质（+传奇+/++ 的额外附加条）。slotTag 由 pluginId 派生，不存。 */
export interface S7OwnedPlugin {
  instanceId: string;
  pluginId: string;
  quality: S7PluginQuality;
  /** 段二 E2：传奇+/++ 的额外附加条（捐主 pluginId 列表·+=1 条/++=2 条·与本体及彼此去重）。
   *  低品质无此字段（存档紧凑）；解析=S7PluginEffects.bonusEffectBlocks。 */
  bonusEffectIds?: string[];
}

/** 段二 E5（#12 广告点接口）：最近一次合成失败销毁的副槽件快照（返还用·成功/返还后清空）。 */
export interface S7CraftLossRecord {
  pluginId: string;
  quality: S7PluginQuality;
  bonusEffectIds?: string[];
  /** 发生日（s7DayKey·灰盒批做"每日 1 次免费返还"闸用；本层只记录不判限）。 */
  dayKey: string;
}

/** 插件库存子状态：实例列表 + 实例 id 递增计数 + 动作序号（合成/回收用作确定性 RNG 种子源）。 */
export interface S7PluginInventoryState {
  plugins: S7OwnedPlugin[];
  nextInstanceSeq: number;
  /** 玩家动作序号（6d-2 起）：每次带随机的动作(合成/回收)消费它派生确定性种子并 +1。
   *  递增计数=隐藏、玩家不可预测控制 → 防"挑输入凑好词条"的存档刷。 */
  nextActionSeq: number;
  /** 段二 E5：最近一次合成失败的损失记录（#12 返还接口·无损失=缺席）。 */
  lastCraftLoss?: S7CraftLossRecord;
}

const INSTANCE_PREFIX = 'pi';

/** 默认空库存。 */
export function createDefaultS7PluginInventory(): S7PluginInventoryState {
  return { plugins: [], nextInstanceSeq: 1, nextActionSeq: 0 };
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

/** 规范化附加条列表（段二 E2）：仅传奇+/++ 保留；数量按品质钳（+=1/++=2）；去重且剔除与本体同 id；非法丢弃。 */
function normBonusIds(raw: unknown, pluginId: string, quality: S7PluginQuality): string[] | undefined {
  const cap = quality === 'legendaryPlusPlus' ? 2 : quality === 'legendaryPlus' ? 1 : 0;
  if (cap === 0 || !Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const v of raw) {
    if (!isNonEmptyString(v) || v === pluginId || out.includes(v)) continue;
    out.push(v);
    if (out.length >= cap) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * 规范化库存：丢弃结构非法实例（instanceId/pluginId 非空字符串、quality 合法），instanceId 去重（保留先出现的）；
 * nextInstanceSeq 取 max(原值, 现有实例最大序号+1, 1) 的非负整数——防脏档/篡改导致后续 mint 出重复 id。
 * 段二 E 组：bonusEffectIds 按品质钳数量+去重；lastCraftLoss 结构合法才保留。
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
      const quality = p.quality as S7PluginQuality;
      const bonus = normBonusIds(p.bonusEffectIds, p.pluginId, quality);
      out.plugins.push({
        instanceId: p.instanceId, pluginId: p.pluginId, quality,
        ...(bonus ? { bonusEffectIds: bonus } : {}),
      });
      maxSeq = Math.max(maxSeq, parseSeq(p.instanceId));
    }
  }
  const rawSeq = src.nextInstanceSeq;
  const seqVal = typeof rawSeq === 'number' && Number.isInteger(rawSeq) && rawSeq > 0 ? rawSeq : 1;
  out.nextInstanceSeq = Math.max(seqVal, maxSeq + 1, 1);
  const rawAct = src.nextActionSeq;
  out.nextActionSeq = typeof rawAct === 'number' && Number.isInteger(rawAct) && rawAct >= 0 ? rawAct : 0;
  const loss = src.lastCraftLoss as Record<string, unknown> | undefined;
  if (loss && typeof loss === 'object' && isNonEmptyString(loss.pluginId)
    && typeof loss.quality === 'string' && S7_PLUGIN_QUALITIES.includes(loss.quality as S7PluginQuality)
    && isNonEmptyString(loss.dayKey)) {
    const q = loss.quality as S7PluginQuality;
    const bonus = normBonusIds(loss.bonusEffectIds, loss.pluginId, q);
    out.lastCraftLoss = { pluginId: loss.pluginId, quality: q, dayKey: loss.dayKey, ...(bonus ? { bonusEffectIds: bonus } : {}) };
  }
  return out;
}

/** 新增一个插件实例（mint 唯一 instanceId）；就地修改库存并返回新实例。 */
export function addOwnedPlugin(
  inv: S7PluginInventoryState, pluginId: string, quality: S7PluginQuality, bonusEffectIds?: readonly string[],
): S7OwnedPlugin {
  const instance: S7OwnedPlugin = {
    instanceId: `${INSTANCE_PREFIX}${inv.nextInstanceSeq}`, pluginId, quality,
    ...(bonusEffectIds && bonusEffectIds.length > 0 ? { bonusEffectIds: [...bonusEffectIds] } : {}),
  };
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
