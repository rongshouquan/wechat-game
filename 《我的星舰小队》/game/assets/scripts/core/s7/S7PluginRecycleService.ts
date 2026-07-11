// 插件回收（块6d-3，纯 TS，不依赖 cc）：v1.0 §5.3/§10.3 多余/重复插件回收 → 星贝(starCargo)，有折损、无死物品。
// 回收消费该插件实例（出库）并把星贝入账到资源。消费实例 = 天然幂等（重放因实例已消费返回 not_found，不双花）。
//
// 数值口径（占位，第二块定）：回收星贝 = 基值[品质] × 折损率。
//   - 基值[品质]：占位（fine/superior/legendary 越高越值钱），精确值第二块。
//   - 折损率：v1.0 配置 recycle_param 的「插件本体」行给区间 [20%,40%]，精确定点第二块；本占位用区间中点。
//   ⚠️ 配置遗留：recycle_param `recycle_normal_plugin.currencyGroup` 现仍写 "plugin_mat"（6a-2 已删的插件材料），
//      与 v1.0「回收换星贝」冲突——本服务按 v1.0 产出星贝，该配置 tag 的内容订正留第二块。

import { S7ResourceState } from '../../save/S7SaveService';
import { S7PluginQuality } from './S7PluginEffects';
import { S7PluginInventoryState, removeOwnedPlugin, findOwnedPlugin } from './S7PluginInventory';
import { merchantRecycleSteps } from './S7BuildingEffects';

/** 回收星贝终值（步5 回写·传奇 150=初值表 v0.7 尺内值〔步3 清淤入模〕；精良/优秀=尺外比例值·未入尺注记）。
 *  商人回收价档（Lv3/6/9 各 +15·细案⑤）只作用传奇件：150→165→180→195。
 *  传奇+/++＝段二 E 组扩档占位（数值域·≈×2.3 阶比对齐 30→75→150 梯·合成产物拆解=玩家亏损操作，
 *  价只保"不为零的容错"不保等值；2b 入尺复核·回收价档暂不作用）。 */
const RECYCLE_BY_QUALITY: Record<S7PluginQuality, number> = {
  fine: 30, superior: 75, legendary: 150, legendaryPlus: 350, legendaryPlusPlus: 800,
};
export const RECYCLE_LEGENDARY_STEP_ADD = 15;

export type S7RecycleResult =
  | { ok: true; starbeiGained: number }
  | { ok: false; code: 'instance_not_found' };

/** 某品质当前回收价（merchantLevel=商人小站等级·回收价档只作用传奇件）。 */
export function pluginRecyclePrice(quality: S7PluginQuality, merchantLevel = 0): number {
  const base = RECYCLE_BY_QUALITY[quality];
  return quality === 'legendary' ? base + RECYCLE_LEGENDARY_STEP_ADD * merchantRecycleSteps(merchantLevel) : base;
}

/**
 * 回收一个插件实例 → 星贝(starCargo) 入账并出库。就地修改 inv 与 resources；找不到实例返回 not_found 且不改动。
 * merchantLevel = 商人小站等级（传奇件回收价档 Lv3/6/9）。
 */
export function recyclePlugin(
  inv: S7PluginInventoryState,
  resources: S7ResourceState,
  instanceId: string,
  merchantLevel = 0,
): S7RecycleResult {
  const inst = findOwnedPlugin(inv, instanceId);
  if (!inst) return { ok: false, code: 'instance_not_found' };

  const starbei = pluginRecyclePrice(inst.quality, merchantLevel);
  resources.starCargo += starbei; // 星贝 = starCargo（6 货币映射拍板）
  removeOwnedPlugin(inv, instanceId);
  return { ok: true, starbeiGained: starbei };
}
