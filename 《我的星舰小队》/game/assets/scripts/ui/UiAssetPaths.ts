/**
 * UI 资源路径与 9-slice inset 唯一真源（S6-ART-ENG-01，纯 TS，不依赖 cc）。
 *
 * 由 UiAssetCatalog（Cocos 加载层）消费并对外 re-export；拆出纯模块是为了让
 * "assetId -> 路径 / inset" 映射可在 Node/Vitest 里单独校验（路径不散落硬编码）。
 * 资源本体均为 P57 已接入的 41 件（commit cef31b7 / 归一化 09a765c），台账见
 * 项目管理\运行记录\资产授权台账.md。assetId 即去掉扩展名的文件名。
 */

/**
 * assetId -> resources 下图片资产基路径（不含 `/spriteFrame` 子资源后缀）。
 * 覆盖 P57 已接入的全部 41 件。
 */
export const UI_ASSET_PATHS: Readonly<Record<string, string>> = {
  // —— ui_common：按钮 / 弹窗底板 / 标题栏 / 资源条 / 图标 / 反馈（atlases/ui/ui_common，real-1）——
  ui_btn_primary_9s: 'atlases/ui/ui_common/ui_btn_primary_9s',
  ui_btn_claim_9s: 'atlases/ui/ui_common/ui_btn_claim_9s',
  ui_btn_ad_9s: 'atlases/ui/ui_common/ui_btn_ad_9s',
  ui_btn_disabled_9s: 'atlases/ui/ui_common/ui_btn_disabled_9s',
  ui_btn_small_9s: 'atlases/ui/ui_common/ui_btn_small_9s',
  ui_btn_close: 'atlases/ui/ui_common/ui_btn_close',
  ui_panel_dialog_9s: 'atlases/ui/ui_common/ui_panel_dialog_9s',
  ui_bar_title_9s: 'atlases/ui/ui_common/ui_bar_title_9s',
  ui_bar_resource_9s: 'atlases/ui/ui_common/ui_bar_resource_9s',
  ui_badge_red_dot: 'atlases/ui/ui_common/ui_badge_red_dot',
  ui_icon_ad: 'atlases/ui/ui_common/ui_icon_ad',
  ui_icon_check: 'atlases/ui/ui_common/ui_icon_check',
  ui_fx_reward_spark: 'atlases/ui/ui_common/ui_fx_reward_spark',
  ui_divider_line: 'atlases/ui/ui_common/ui_divider_line',
  ui_frame_highlight_9s: 'atlases/ui/ui_common/ui_frame_highlight_9s',
  // —— ui_common：低频 / 状态 UI（atlases/ui/ui_common，real-3）——
  ui_panel_card_9s: 'atlases/ui/ui_common/ui_panel_card_9s',
  ui_bar_target_9s: 'atlases/ui/ui_common/ui_bar_target_9s',
  ui_bar_hp_bg_9s: 'atlases/ui/ui_common/ui_bar_hp_bg_9s',
  ui_bar_hp_fill_9s: 'atlases/ui/ui_common/ui_bar_hp_fill_9s',
  ui_bar_progress_bg_9s: 'atlases/ui/ui_common/ui_bar_progress_bg_9s',
  ui_bar_progress_fill_9s: 'atlases/ui/ui_common/ui_bar_progress_fill_9s',
  ui_slot_reward: 'atlases/ui/ui_common/ui_slot_reward',
  ui_slot_empty: 'atlases/ui/ui_common/ui_slot_empty',
  ui_badge_status_9s: 'atlases/ui/ui_common/ui_badge_status_9s',
  ui_icon_arrow: 'atlases/ui/ui_common/ui_icon_arrow',
  ui_icon_lock: 'atlases/ui/ui_common/ui_icon_lock',
  ui_icon_warning: 'atlases/ui/ui_common/ui_icon_warning',
  ui_icon_loading_dot: 'atlases/ui/ui_common/ui_icon_loading_dot',
  // —— 核心资源 / 系统入口图标（atlases/icons/resources，real-2）——
  res_star_coin_icon: 'atlases/icons/resources/res_star_coin_icon',
  res_exp_chip_icon: 'atlases/icons/resources/res_exp_chip_icon',
  res_equipment_part_icon: 'atlases/icons/resources/res_equipment_part_icon',
  res_base_energy_icon: 'atlases/icons/resources/res_base_energy_icon',
  res_hero_fragment_icon: 'atlases/icons/resources/res_hero_fragment_icon',
  sys_supply_icon: 'atlases/icons/resources/sys_supply_icon',
  sys_mining_icon: 'atlases/icons/resources/sys_mining_icon',
  sys_daily_goal_icon: 'atlases/icons/resources/sys_daily_goal_icon',
  sys_quick_cruise_icon: 'atlases/icons/resources/sys_quick_cruise_icon',
  // —— 装备部位图标（atlases/icons/equipment，real-2）——
  equip_weapon_icon: 'atlases/icons/equipment/equip_weapon_icon',
  equip_armor_icon: 'atlases/icons/equipment/equip_armor_icon',
  equip_core_icon: 'atlases/icons/equipment/equip_core_icon',
  equip_boots_icon: 'atlases/icons/equipment/equip_boots_icon',
};

/** 9-slice inset（设计像素，来源：《UI视觉稿与切图规格》§4.1.1 冻结默认值，禁止临场猜测）。 */
export interface NineSliceInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * 需要按 SLICED 拉伸使用的 assetId -> inset。
 * 只登记 S6-ART-ENG-01 观感补强实际用作 9-slice 的资源；
 * 按钮底板（P57-1 已接入、Ron 已真机验收）保持现状不在此登记，避免改变已验收外观。
 */
export const NINE_SLICE_INSETS: Readonly<Record<string, NineSliceInsets>> = {
  ui_panel_dialog_9s: { left: 32, right: 32, top: 32, bottom: 32 },
  ui_panel_card_9s: { left: 32, right: 32, top: 32, bottom: 32 },
  ui_bar_title_9s: { left: 20, right: 20, top: 8, bottom: 8 },
  ui_bar_target_9s: { left: 20, right: 20, top: 8, bottom: 8 },
  ui_bar_hp_bg_9s: { left: 20, right: 20, top: 8, bottom: 8 },
  ui_bar_hp_fill_9s: { left: 20, right: 20, top: 8, bottom: 8 },
  ui_frame_highlight_9s: { left: 24, right: 24, top: 24, bottom: 24 },
};

/** 返回 assetId 对应的 resources 基路径；未登记返回 null。 */
export function uiAssetPath(assetId: string): string | null {
  return UI_ASSET_PATHS[assetId] ?? null;
}
