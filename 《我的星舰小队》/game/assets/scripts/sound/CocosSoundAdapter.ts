// 真实音频适配器（音效批 2026-07-16·Cocos AudioSource 实现——微信端由引擎自动走底层）。
//
// 职责：事件 id → resources/audio/ 下音频文件的映射与播放。业务代码零改动（附录C 承诺兑现）。
// - 预载：init() 一次性把映射表里的 AudioClip 全载入内存（短音效合计 ~300KB·常驻无压力）。
// - 播放：单 AudioSource playOneShot（引擎自带混音·无节点池负担）。
// - 节流：同一事件 60ms 内只播一次（战斗高倍速齐射防爆音·gacha 等低频事件无感）。
// - 兜底：未映射/加载失败的事件静默跳过（演出/流程永不因音频断——与演出层贴图兜底同精神）。
// - BGM：本批映射留空=静默（BGM 二批 Ron 另拍后填文件名即活）。

import { AudioClip, AudioSource, Node, director, resources } from 'cc';
import { BgmScene, SfxEvent } from './SoundEventTypes';
import { SoundAdapter } from './SoundService';

/** 事件 → resources/audio/ 相对路径（不含扩展名）。缺行=该事件暂无素材·静默。 */
const SFX_FILES: Partial<Record<SfxEvent, string>> = {
  battle_victory: 'sfx/battle_victory',
  battle_defeat: 'sfx/battle_defeat',
  battle_shoot_light: 'sfx/battle_shoot_light',
  battle_shoot_heavy: 'sfx/battle_shoot_heavy',
  battle_shoot_support: 'sfx/battle_shoot_support',
  battle_hit: 'sfx/battle_hit',
  battle_hit_big: 'sfx/battle_hit_big',
  battle_crit: 'sfx/battle_crit',
  battle_explode: 'sfx/battle_explode',
  battle_shield: 'sfx/battle_shield',
  battle_heal: 'sfx/battle_heal',
  battle_banner: 'sfx/battle_banner',
  battle_v3: 'sfx/battle_v3',
  gacha_draw: 'sfx/gacha_draw',
  gacha_highlight: 'sfx/gacha_highlight',
  upgrade_level_up: 'sfx/upgrade_level_up',
  upgrade_ascend: 'sfx/upgrade_ascend',
  upgrade_star_up: 'sfx/upgrade_star_up',
  chest_open: 'sfx/chest_open',
  reward_claim: 'sfx/reward_claim',
  return_report: 'sfx/return_report',
  tower_up: 'sfx/tower_up',
  tower_milestone: 'sfx/tower_milestone',
  puzzle_start: 'sfx/puzzle_start',
  puzzle_solve: 'sfx/puzzle_solve',
  supply_chest_open: 'sfx/supply_chest_open',
  trivia_pop: 'sfx/trivia_pop',
  ui_click: 'sfx/ui_click',
};
/** BGM 映射（二批候 Ron 选曲后填）。 */
const BGM_FILES: Partial<Record<BgmScene, string>> = {};

/** 每事件音量微调（素材响度不一·代码端归一——粗调，精调候真机）。缺省 1.0。 */
const SFX_VOLUME: Partial<Record<SfxEvent, number>> = {
  battle_shoot_light: 0.5, // 最高频事件压低=白噪音层
  battle_shoot_heavy: 0.65,
  battle_shoot_support: 0.45,
  battle_hit: 0.55,
  battle_hit_big: 0.9,
  battle_crit: 0.8,
  battle_explode: 0.75,
  battle_shield: 0.6,
  battle_heal: 0.45,
  battle_banner: 0.85,
  battle_v3: 1.0,
};

const THROTTLE_MS = 60; // 同事件最小间隔（防高倍速齐射爆音）

export class CocosSoundAdapter implements SoundAdapter {
  private clips: Partial<Record<SfxEvent, AudioClip>> = {};
  private bgmClips: Partial<Record<BgmScene, AudioClip>> = {};
  private src: AudioSource | null = null;
  private bgmSrc: AudioSource | null = null;
  private lastPlayAt: Partial<Record<SfxEvent, number>> = {};
  private currentBgm: BgmScene | null = null;
  private muted = false;

  /** 预载全部映射素材（幂等·失败逐条静默跳过）。挂常驻节点承载 AudioSource。 */
  init(onDone?: () => void): void {
    if (!this.src) {
      const n = new Node('S7SoundHost');
      director.getScene()?.addChild(n);
      director.addPersistRootNode(n);
      this.src = n.addComponent(AudioSource);
      this.bgmSrc = n.addComponent(AudioSource);
      if (this.bgmSrc) this.bgmSrc.loop = true;
    }
    const entries = Object.entries(SFX_FILES) as Array<[SfxEvent, string]>;
    let left = entries.length;
    if (left === 0) { if (onDone) onDone(); return; }
    for (const [event, path] of entries) {
      resources.load(`audio/${path}`, AudioClip, (err, clip) => {
        if (!err && clip) this.clips[event] = clip;
        left -= 1;
        if (left === 0 && onDone) onDone();
      });
    }
    for (const [scene, path] of Object.entries(BGM_FILES) as Array<[BgmScene, string]>) {
      resources.load(`audio/${path}`, AudioClip, (err, clip) => {
        if (!err && clip) this.bgmClips[scene] = clip;
      });
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m && this.bgmSrc) this.bgmSrc.stop();
  }

  playSfx(event: SfxEvent): void {
    if (this.muted || !this.src) return;
    const clip = this.clips[event];
    if (!clip) return; // 未映射/未载成=静默（流程不断）
    const now = Date.now();
    const last = this.lastPlayAt[event] ?? 0;
    if (now - last < THROTTLE_MS) return;
    this.lastPlayAt[event] = now;
    this.src.playOneShot(clip, SFX_VOLUME[event] ?? 1.0);
  }

  playBgm(scene: BgmScene): void {
    if (this.currentBgm === scene) return;
    this.currentBgm = scene;
    if (this.muted || !this.bgmSrc) return;
    const clip = this.bgmClips[scene];
    this.bgmSrc.stop();
    if (!clip) return; // BGM 二批未填=静默
    this.bgmSrc.clip = clip;
    this.bgmSrc.volume = 0.55;
    this.bgmSrc.play();
  }

  stopBgm(): void {
    this.currentBgm = null;
    if (this.bgmSrc) this.bgmSrc.stop();
  }
}
