import { describe, it, expect } from 'vitest';
import {
  SFX_ASSET_IDS,
  SFX_MIN_INTERVAL_MS,
  SfxEvent,
  SfxThrottle,
  sfxResourcePath,
} from '../assets/scripts/audio/SfxCatalog';

const ALL_EVENTS = Object.keys(SFX_ASSET_IDS) as SfxEvent[];

describe('S5C-06 SfxCatalog - 事件映射', () => {
  it('5 个事件齐全且 assetId 与《音效BGM规格》规格表一致', () => {
    expect(SFX_ASSET_IDS).toEqual({
      ui_click: 'sfx_ui_click',
      reward_claim: 'sfx_reward_claim',
      upgrade: 'sfx_upgrade',
      battle_victory: 'sfx_battle_victory',
      battle_defeat: 'sfx_battle_defeat',
    });
  });

  it('resources 路径统一位于 audio/sfx/ 下且以 assetId 结尾', () => {
    for (const event of ALL_EVENTS) {
      expect(sfxResourcePath(event)).toBe(`audio/sfx/${SFX_ASSET_IDS[event]}`);
    }
  });

  it('每个事件都有正的最小播放间隔', () => {
    for (const event of ALL_EVENTS) {
      expect(SFX_MIN_INTERVAL_MS[event]).toBeGreaterThan(0);
    }
  });
});

describe('S5C-06 SfxThrottle - 防叠音节流', () => {
  it('同一事件在最小间隔内重复触发被拒绝，到达间隔后放行', () => {
    const throttle = new SfxThrottle();
    const t0 = 10_000;
    expect(throttle.shouldPlay('ui_click', t0)).toBe(true);
    expect(throttle.shouldPlay('ui_click', t0 + SFX_MIN_INTERVAL_MS.ui_click - 1)).toBe(false);
    expect(throttle.shouldPlay('ui_click', t0 + SFX_MIN_INTERVAL_MS.ui_click)).toBe(true);
  });

  it('被拒绝的触发不刷新计时（连点期间到点即可再播）', () => {
    const throttle = new SfxThrottle();
    const t0 = 0;
    expect(throttle.shouldPlay('ui_click', t0)).toBe(true);
    // 间隔内连点多次均拒绝，且不把"上次播放时间"推后
    expect(throttle.shouldPlay('ui_click', t0 + 30)).toBe(false);
    expect(throttle.shouldPlay('ui_click', t0 + 60)).toBe(false);
    expect(throttle.shouldPlay('ui_click', t0 + SFX_MIN_INTERVAL_MS.ui_click)).toBe(true);
  });

  it('不同事件互不影响', () => {
    const throttle = new SfxThrottle();
    const t0 = 5_000;
    expect(throttle.shouldPlay('ui_click', t0)).toBe(true);
    expect(throttle.shouldPlay('reward_claim', t0)).toBe(true);
    expect(throttle.shouldPlay('battle_victory', t0)).toBe(true);
  });
});
