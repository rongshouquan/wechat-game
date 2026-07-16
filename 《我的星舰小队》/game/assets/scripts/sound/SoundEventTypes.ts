/**
 * 音效/BGM 事件目录（附录C 音效事件钩子清单的代码侧真源）。
 *
 * 只登记事件 id，不含真实音频文件——真实素材接入时只需在 SoundAdapter 实现里把
 * 事件 id 映射到具体音频资源，调用方（业务代码）不必改动。
 */

/** 短音效事件（一次性播放）。 */
export type SfxEvent =
  | 'battle_victory'
  | 'battle_defeat'
  | 'gacha_draw'
  | 'gacha_highlight'
  | 'upgrade_level_up'
  | 'upgrade_ascend'
  | 'upgrade_star_up'
  | 'chest_open'
  | 'reward_claim'
  | 'return_report'
  | 'tower_up'
  | 'tower_milestone'
  | 'puzzle_start'
  | 'puzzle_solve'
  | 'supply_chest_open'
  | 'trivia_pop'
  | 'ui_click'
  // —— 战斗内音效（音效批 2026-07-16 新增·演出层经模型 sfxQueue 触发=两层制不破）——
  | 'battle_shoot_light'
  | 'battle_shoot_heavy'
  | 'battle_shoot_support'
  | 'battle_hit'
  | 'battle_hit_big'
  | 'battle_crit'
  | 'battle_explode'
  | 'battle_shield'
  | 'battle_heal'
  | 'battle_banner'
  | 'battle_v3';

/** 背景音乐场景（切换式，同一时刻只有一条在播）。 */
export type BgmScene = 'bgm_hub' | 'bgm_battle';

/** 附录C 事件钩子清单：事件 id -> 中文说明，供设计文档与代码共用一份真源。 */
export const SFX_EVENT_NOTES: Readonly<Record<SfxEvent, string>> = {
  battle_victory: '战斗胜利结算弹窗弹出时',
  battle_defeat: '战斗失败弹窗弹出时',
  gacha_draw: '抽卡出货（普通）',
  gacha_highlight: '抽卡出货高光（新到手 / 专属本体）',
  upgrade_level_up: '星舰/驾驶员升级成功',
  upgrade_ascend: '星舰升阶成功',
  upgrade_star_up: '驾驶员升星成功',
  chest_open: '宝箱开箱选中奖励',
  reward_claim: '通用奖励领取（邮件/兑换箱/安慰双倍等通用入账）',
  return_report: '回港报告弹窗弹出（舰队归港·包A 块1）',
  tower_up: '深空回廊通过一层（包A·块3）',
  tower_milestone: '深空回廊里程碑领取（包A·块3）',
  puzzle_start: '每日推演开始推演（包A·块4）',
  puzzle_solve: '每日推演解开（首胜·包A·块4）',
  supply_chest_open: '今日补给箱开箱入账（包A·块5）',
  trivia_pop: '星港趣事弹泡出现（轻快·包A·块5）',
  ui_click: '主要按钮点击',
  battle_shoot_light: '战斗·轻快弹开火（快弹族：聚能束/飞刃/电球·哒哒哒）',
  battle_shoot_heavy: '战斗·厚重弹开火（慢重弹族：炮弹/震荡环·哐）',
  battle_shoot_support: '战斗·支援弹出手（治疗/护盾/旗光·柔）',
  battle_hit: '战斗·命中爆点（小/中档）',
  battle_hit_big: '战斗·命中大爆（V3 陨星/大招级）',
  battle_crit: '战斗·暴击（冲击环时机·更响一记）',
  battle_explode: '战斗·单位被消灭（糖果星爆）',
  battle_shield: '战斗·护盾泡罩上',
  battle_heal: '战斗·治疗生效（泛绿柔光时机）',
  battle_banner: '战斗·横幅锵（战斗开始/第N波来袭）',
  battle_v3: '战斗·星核质变排场（压暗起手·大招音）',
};
// 块5 清理：dispatch_done（每日委托秒结算/速刷）随"委托→悬赏板"重构作废——秒结算机制已删、事件成孤儿，一并移除（附录C 同步）。

export const BGM_SCENE_NOTES: Readonly<Record<BgmScene, string>> = {
  bgm_hub: '主界面/星港等非战斗场景',
  bgm_battle: '出战进入战斗演出期间',
};
