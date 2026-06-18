/**
 * 音频反馈组件（S5C-06，Cocos Component）。
 *
 * 只做资源加载与播放：启动时预加载 5 条短音效（SfxCatalog 唯一登记），play() 经节流后
 * 用 AudioSource.playOneShot 播放。任何失败（资源缺失、解码失败、运行环境不支持播放）
 * 一律安全静默——只打一次 warn，不抛出、不影响战斗/奖励/升级/导航/广告等业务流程。
 */
import { _decorator, AudioClip, AudioSource, Component, resources } from 'cc';
import { SfxEvent, SfxThrottle, sfxResourcePath, SFX_ASSET_IDS } from './SfxCatalog';

const { ccclass } = _decorator;

@ccclass('AudioFeedback')
export class AudioFeedback extends Component {
  private audioSource: AudioSource | null = null;
  private readonly clips = new Map<SfxEvent, AudioClip>();
  private readonly throttle = new SfxThrottle();

  onLoad(): void {
    this.audioSource = this.node.getComponent(AudioSource) ?? this.node.addComponent(AudioSource);
    this.audioSource.playOnAwake = false;
    for (const event of Object.keys(SFX_ASSET_IDS) as SfxEvent[]) {
      this.preload(event);
    }
  }

  /** 播放一条音效：节流拒绝或资源未就绪时静默跳过（预加载失败的事件保持永久静默）。 */
  play(event: SfxEvent): void {
    if (!this.throttle.shouldPlay(event, Date.now())) {
      return;
    }
    const clip = this.clips.get(event);
    if (!clip || !this.audioSource) {
      return;
    }
    try {
      this.audioSource.playOneShot(clip, 1.0);
    } catch (err) {
      // 运行环境不支持播放（如无音频后端）：静默，业务流程不受影响。
      console.warn('[AudioFeedback] 播放失败（已静默）', event, err);
    }
  }

  private preload(event: SfxEvent): void {
    resources.load(sfxResourcePath(event), AudioClip, (err, clip) => {
      if (err || !clip) {
        console.warn('[AudioFeedback] 音效加载失败（该事件将静默）', event, sfxResourcePath(event), err);
        return;
      }
      this.clips.set(event, clip);
    });
  }
}
