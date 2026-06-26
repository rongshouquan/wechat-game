import { describe, it, expect } from 'vitest';
import { SoundService } from '../assets/scripts/sound/SoundService';
import { MockSoundAdapter } from '../assets/scripts/sound/MockSoundAdapter';

describe('SoundService', () => {
  it('转发 playSfx 给 adapter', () => {
    const adapter = new MockSoundAdapter();
    const sound = new SoundService(adapter);
    sound.playSfx('battle_victory');
    sound.playSfx('gacha_highlight');
    expect(adapter.sfxCalls).toEqual(['battle_victory', 'gacha_highlight']);
  });

  it('playBgm 切场景；重复同一场景不重复触发', () => {
    const adapter = new MockSoundAdapter();
    const sound = new SoundService(adapter);
    sound.playBgm('bgm_battle');
    sound.playBgm('bgm_battle');
    sound.playBgm('bgm_hub');
    expect(adapter.bgmCalls).toEqual(['bgm_battle', 'bgm_hub']);
    expect(adapter.currentBgm).toBe('bgm_hub');
  });

  it('stopBgm 清空当前场景，之后同名场景可再次触发', () => {
    const adapter = new MockSoundAdapter();
    const sound = new SoundService(adapter);
    sound.playBgm('bgm_hub');
    sound.stopBgm();
    sound.playBgm('bgm_hub');
    expect(adapter.bgmCalls).toEqual(['bgm_hub', 'bgm_hub']);
  });
});
