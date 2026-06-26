import { BgmScene, SfxEvent } from './SoundEventTypes';
import { SoundAdapter } from './SoundService';

/**
 * 音频 mock 适配器：纯内存记录调用，不真实播放、不接 cc/wx。
 * 当前阶段【只用本 mock】；真机播放（Cocos AudioSource / wx.createInnerAudioContext）属后续任务。
 */
export class MockSoundAdapter implements SoundAdapter {
  readonly sfxCalls: SfxEvent[] = [];
  readonly bgmCalls: BgmScene[] = [];
  currentBgm: BgmScene | null = null;

  playSfx(event: SfxEvent): void {
    this.sfxCalls.push(event);
  }

  playBgm(scene: BgmScene): void {
    if (this.currentBgm === scene) return;
    this.currentBgm = scene;
    this.bgmCalls.push(scene);
  }

  stopBgm(): void {
    this.currentBgm = null;
  }
}
