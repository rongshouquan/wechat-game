// 插件合成（块6d-2 起建 · 段二 E 组全案重造 2026-07-12·纯 TS，不依赖 cc）。
//
// 现行主案＝主副槽制（Ron 2026-07-12 逐条拍板·E1-E7）：
//   E1 概率塔：精良→优秀 80%／优秀→传奇 60%／传奇→传奇+ 40%／传奇+→传奇++ 20%。
//   E2 新品质档：传奇+（共 2 条特殊效果）/传奇++（共 3 条）——第 2/3 条=同槽位传奇效果池随机抽
//      （去重·B 案·零新效果内容纯组合）；"极品组合"=可反复合的研究点。
//   E3 主副槽：两件同品质喂合成；失败=主槽保留、副槽销毁；成功=新件身份在产出槽内随机；
//      星贝锁定主槽身份（成功必出主槽同款高阶/失败星贝照扣/锁价随品质指数涨）。
//   E4 分层限槽：精良→优秀→传奇 全程不限槽（任何同品质件可当副槽燃料·产物槽位跟主槽走）；
//      传奇→传奇+ 起及之后限同槽（燃料稀缺=奢侈段的牺牲感）。
//   E5 广告点 #12：合成失败可看广告返还被销毁的副槽件（本层=损失记录+返还函数；每日 1 次
//      免费/券无限/接入=工程灰盒批）；用了星贝锁定的星贝不返（星贝收支在调用方，本层不碰钱包）。
// 附加条继承规则（实现裁量·随段2a 交付候 Ron 复验）：产物继承主槽件已有附加条（与产物本体
//   去重·撞条重抽），不足部分从同槽可嫁接池随机补齐到品质应有条数——"先合出满意的 + 再升 ++
//   只赌第 3 条"=分层锁定的研究路径（E6"屯资源带目标去赌"）。
// 随机与防刷（沿旧案拍板·本地确定性种子）：全部随机（成败/身份/附加条）用 inv.nextActionSeq 派生
//   确定性 RNG（S7AutoBattleRng/mulberry32），每次合成 seq+1；序号隐藏递增、玩家不可预测控制。
//   取数顺序固定=①成败 ②身份（未锁定才取）③附加条——顺序即协议，改动=行为变更须记档。
// 旧 3 合 1（下方 synthesizePlugins）＝退役中：真机 UI 仍在调用，灰盒批切到 craftPlugins 后删除
//   （接口清单在案）；两案并存期间互不影响（seq 共享=天然串行）。

import { S7PluginConfig, S7PluginSlot } from '../../config/s7/ConfigTypesS7';
import { S7PluginQuality, S7_BONUS_COUNT_BY_QUALITY, S7_BONUS_POOL_BY_SLOT } from './S7PluginEffects';
import {
  S7PluginInventoryState,
  S7OwnedPlugin,
  S7CraftLossRecord,
  addOwnedPlugin,
  removeOwnedPlugin,
  findOwnedPlugin,
} from './S7PluginInventory';
import { S7AutoBattleRng } from './S7AutoBattleRng';

/** 起步合成比例：3 同 → 1 高阶（旧案·退役中）。 */
export const S7_SYNTH_INPUT_COUNT = 3;

/** 品质阶梯（新案·主副槽制用）：精良→优秀→传奇→传奇+→传奇++（顶·不可再合）。 */
const QUALITY_NEXT: Record<S7PluginQuality, S7PluginQuality | null> = {
  fine: 'superior',
  superior: 'legendary',
  legendary: 'legendaryPlus',
  legendaryPlus: 'legendaryPlusPlus',
  legendaryPlusPlus: null,
};
/** 【旧案专用·行为冻结】3 合 1 阶梯到传奇封顶——传奇+/++ 只能走主副槽概率塔（E1），
 *  绝不能让退役路径 100% 白合高档（全量回归抓到的真泄漏·段2a 自检记档）。 */
const LEGACY_QUALITY_NEXT: Record<S7PluginQuality, S7PluginQuality | null> = {
  fine: 'superior',
  superior: 'legendary',
  legendary: null,
  legendaryPlus: null,
  legendaryPlusPlus: null,
};

/** E1 概率塔（键=输入品质·值=升到下一档的成功率）。 */
export const S7_CRAFT_SUCCESS_P: Record<S7PluginQuality, number> = {
  fine: 0.8, superior: 0.6, legendary: 0.4, legendaryPlus: 0.2, legendaryPlusPlus: 0,
};

/** E3 星贝锁定价（键=输入品质·锁价随品质指数涨 ×3 塔=20/60/180/540·数值域定报备·2b 入尺复核）。
 *  扣费在调用方（本层不碰钱包）；失败照扣（E5：锁定星贝不返）。 */
export const S7_CRAFT_LOCK_PRICE: Record<S7PluginQuality, number> = {
  fine: 20, superior: 60, legendary: 180, legendaryPlus: 540, legendaryPlusPlus: 0,
};

/** E4 分层限槽：该输入品质的合成是否要求主副同槽（传奇→+ 起限同槽）。 */
export function craftRequiresSameSlot(inputQuality: S7PluginQuality): boolean {
  return inputQuality === 'legendary' || inputQuality === 'legendaryPlus';
}

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
 * 【旧案·退役中】3 合 1 合成：真机 UI 现行调用；灰盒批切换到 craftPlugins 后删除（段2a 接口清单在案）。
 * 就地修改库存（消费 3 输入、产出 1 高阶、推进 nextActionSeq）；任一前置不满足返回 {ok:false,code}，不改库存。
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
  const outQuality = LEGACY_QUALITY_NEXT[quality]; // 旧案传奇封顶（+/++ 只走主副槽概率塔）
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

// ===== 段二 E 组·主副槽合成（现行主案） =====

export type S7CraftErrorCode =
  | 'same_instance'          // 主副槽不能是同一个实例
  | 'instance_not_found'     // 主/副实例不在库存
  | 'unknown_plugin'         // 主/副词条不在 plugin_config
  | 'quality_mismatch'       // 主副品质不一致
  | 'quality_not_upgradable' // 传奇++ 已是顶
  | 'slot_mismatch_high_tier'; // 传奇→+ 起限同槽（E4）

export type S7CraftResult =
  | { ok: true; success: true; output: S7OwnedPlugin }
  | { ok: true; success: false; destroyedFuel: S7CraftLossRecord }
  | { ok: false; code: S7CraftErrorCode };

/**
 * 主副槽合成（E1-E4）：就地修改库存＋推进 nextActionSeq。
 *  - 成功：消费主+副，按概率塔产出高一档新件（身份=锁定→主槽同款/未锁→产出槽位池随机；
 *    附加条=继承主槽已有条〔与产物本体去重〕+同槽可嫁接池随机补齐到品质应有条数）。
 *  - 失败：副槽销毁（快照记入 inv.lastCraftLoss=#12 返还接口），主槽原样保留。
 *  - opts.locked＝星贝锁定（扣费在调用方·价=S7_CRAFT_LOCK_PRICE[输入品质]·失败照扣不返）；
 *    opts.dayKey＝当日 s7DayKey（损失记录用·缺省 ''）。
 *  任一前置不满足返回 {ok:false,code}，库存与 seq 都不动。
 */
export function craftPlugins(
  inv: S7PluginInventoryState,
  mainInstanceId: string,
  fuelInstanceId: string,
  pluginConfigs: readonly S7PluginConfig[],
  opts: { locked?: boolean; dayKey?: string } = {},
): S7CraftResult {
  if (mainInstanceId === fuelInstanceId) return { ok: false, code: 'same_instance' };
  const main = findOwnedPlugin(inv, mainInstanceId);
  const fuel = findOwnedPlugin(inv, fuelInstanceId);
  if (!main || !fuel) return { ok: false, code: 'instance_not_found' };
  const slotOf = (pluginId: string): S7PluginSlot | undefined => pluginConfigs.find((c) => c.pluginId === pluginId)?.slotTag;
  const mainSlot = slotOf(main.pluginId);
  const fuelSlot = slotOf(fuel.pluginId);
  if (!mainSlot || !fuelSlot) return { ok: false, code: 'unknown_plugin' };
  if (main.quality !== fuel.quality) return { ok: false, code: 'quality_mismatch' };
  const outQuality = QUALITY_NEXT[main.quality];
  if (outQuality === null) return { ok: false, code: 'quality_not_upgradable' };
  if (craftRequiresSameSlot(main.quality) && mainSlot !== fuelSlot) return { ok: false, code: 'slot_mismatch_high_tier' };

  // 确定性 RNG（seq 消费+1）：取数顺序=①成败 ②身份（未锁定才取）③附加条。
  const rng = new S7AutoBattleRng(`craft2:${inv.nextActionSeq}`);
  inv.nextActionSeq += 1;
  const success = rng.next() < S7_CRAFT_SUCCESS_P[main.quality];

  if (!success) {
    removeOwnedPlugin(inv, fuel.instanceId);
    const destroyedFuel: S7CraftLossRecord = {
      pluginId: fuel.pluginId, quality: fuel.quality, dayKey: opts.dayKey ?? '',
      ...(fuel.bonusEffectIds && fuel.bonusEffectIds.length > 0 ? { bonusEffectIds: [...fuel.bonusEffectIds] } : {}),
    };
    inv.lastCraftLoss = destroyedFuel;
    return { ok: true, success: false, destroyedFuel };
  }

  // 身份：锁定=主槽同款；未锁=产出槽位（=主槽槽位·E4"产物槽位跟主槽走"）全词条池随机。
  const outPluginId = opts.locked
    ? main.pluginId
    : (rng.pick(pluginConfigs.filter((c) => c.slotTag === mainSlot).map((c) => c.pluginId)) as string);

  // 附加条（E2 B 案+继承规则）：继承主槽已有条（剔除与产物本体撞条）→ 同槽可嫁接池补齐。
  const need = S7_BONUS_COUNT_BY_QUALITY[outQuality];
  const bonus: string[] = [];
  for (const id of main.bonusEffectIds ?? []) {
    if (id !== outPluginId && !bonus.includes(id) && bonus.length < need) bonus.push(id);
  }
  if (bonus.length < need) {
    const pool = S7_BONUS_POOL_BY_SLOT[mainSlot].filter((id) => id !== outPluginId && !bonus.includes(id));
    while (bonus.length < need && pool.length > 0) {
      const drawn = rng.pick(pool) as string;
      bonus.push(drawn);
      pool.splice(pool.indexOf(drawn), 1);
    }
  }

  removeOwnedPlugin(inv, main.instanceId);
  removeOwnedPlugin(inv, fuel.instanceId);
  const output = addOwnedPlugin(inv, outPluginId, outQuality, bonus);
  return { ok: true, success: true, output };
}

/**
 * #12 返还（E5·本层只管库存动作，"每日 1 次免费/广告券/看广告"三闸=工程灰盒批在调用侧把）：
 * 把最近一次合成失败销毁的副槽件原样回库（同词条/品质/附加条·新 instanceId），清空损失记录。
 * 无损失记录返回 null（调用侧按钮不该亮）。
 */
export function restoreLastCraftLoss(inv: S7PluginInventoryState): S7OwnedPlugin | null {
  const loss = inv.lastCraftLoss;
  if (!loss) return null;
  const restored = addOwnedPlugin(inv, loss.pluginId, loss.quality, loss.bonusEffectIds);
  delete inv.lastCraftLoss;
  return restored;
}
