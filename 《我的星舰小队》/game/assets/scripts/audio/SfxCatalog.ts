/**
 * 短音效映射与节流策略（S5C-06，纯 TS，不依赖 cc）。
 *
 * 职责：把音效事件唯一映射到 assetId / resources 路径（与《音效BGM规格.md》规格表一致），
 * 并提供最小播放间隔节流（防高频连点叠音）。资源路径只在此登记，禁止散落硬编码。
 * 实际加载与播放由 cc 侧 AudioFeedback 组件完成；本模块可在 Node/Vitest 单独测试。
 *
 * 音量层级说明：层级（点击 < 失败 < 领取 < 升级 < 胜利）编码在生成的音频文件峰值里
 * （见 tools/generate-sfx.mjs），播放侧统一增益 1.0，不在代码里二次调音。
 */

export type SfxEvent = 'ui_click' | 'reward_claim' | 'upgrade' | 'battle_victory' | 'battle_defeat';

/** 事件 -> assetId（与规格表/授权台账一致，即文件名去扩展名）。 */
export const SFX_ASSET_IDS: Readonly<Record<SfxEvent, string>> = {
  ui_click: 'sfx_ui_click',
  reward_claim: 'sfx_reward_claim',
  upgrade: 'sfx_upgrade',
  battle_victory: 'sfx_battle_victory',
  battle_defeat: 'sfx_battle_defeat',
};

/** 事件 -> resources 下音频资产路径（不含扩展名）。 */
export function sfxResourcePath(event: SfxEvent): string {
  return `audio/sfx/${SFX_ASSET_IDS[event]}`;
}

/** 同一事件两次播放的最小间隔（毫秒）：点击高频需防叠音，结算类事件天然低频、间隔取较大保险值。 */
export const SFX_MIN_INTERVAL_MS: Readonly<Record<SfxEvent, number>> = {
  ui_click: 90,
  reward_claim: 150,
  upgrade: 150,
  battle_victory: 400,
  battle_defeat: 400,
};

/**
 * 最小间隔节流器：同一事件在间隔内重复触发时拒绝播放，不同事件互不影响。
 * 时间由调用方注入（nowMs），便于确定性测试。
 */
export class SfxThrottle {
  private readonly lastPlayedAt = new Map<SfxEvent, number>();

  /** 判定是否允许播放；允许时记录本次播放时间。 */
  shouldPlay(event: SfxEvent, nowMs: number): boolean {
    const last = this.lastPlayedAt.get(event);
    if (last !== undefined && nowMs - last < SFX_MIN_INTERVAL_MS[event]) {
      return false;
    }
    this.lastPlayedAt.set(event, nowMs);
    return true;
  }
}
