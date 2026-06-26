/**
 * 音频服务（工程埋接口，纯 TS，不依赖 cc/wx，可在 Node/Vitest 测试）。
 *
 * 只编排「播放请求 -> 适配器」，不持有真实音频资源。真机播放由后续真实 adapter
 * （Cocos AudioSource / wx.createInnerAudioContext）实现；本阶段【只用 MockSoundAdapter】。
 * 业务代码只认事件 id（SfxEvent / BgmScene），不关心背后是 mock 还是真实播放。
 */
import { BgmScene, SfxEvent } from './SoundEventTypes';

export interface SoundAdapter {
  playSfx(event: SfxEvent): void;
  /** 切换当前 BGM；同一 scene 重复调用应直接忽略（不重启播放）。 */
  playBgm(scene: BgmScene): void;
  stopBgm(): void;
}

export class SoundService {
  constructor(private readonly adapter: SoundAdapter) {}

  playSfx(event: SfxEvent): void {
    this.adapter.playSfx(event);
  }

  playBgm(scene: BgmScene): void {
    this.adapter.playBgm(scene);
  }

  stopBgm(): void {
    this.adapter.stopBgm();
  }
}
