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
  | 'ui_click';

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
  reward_claim: '通用奖励领取（邮件/离线收益/兑换箱）',
  ui_click: '主要按钮点击',
};

export const BGM_SCENE_NOTES: Readonly<Record<BgmScene, string>> = {
  bgm_hub: '主界面/星港等非战斗场景',
  bgm_battle: '出战进入战斗演出期间',
};
