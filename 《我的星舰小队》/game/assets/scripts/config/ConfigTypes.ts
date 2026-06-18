export interface LevelConfig {
  schemaVersion: string;
  levelId: string;
  chapter: number;
  stage: number;
  type: 'normal' | 'elite' | 'boss';
  enemyGroupId: string;
  recommendedPower: number;
  rewardId: string;
  unlockId?: string;
  tutorialTag?: string;
}

export interface EnemyConfig {
  schemaVersion: string;
  enemyId: string;
  name: string;
  faction: 'mechanical' | 'pirate' | 'rift';
  elementWeakness?: 'electromagnetic' | 'fire' | 'light' | 'none';
  hp: number;
  atk: number;
  def: number;
  aspd: number;
  mechanicTags?: string[];
}

export interface HeroConfig {
  schemaVersion: string;
  heroId: string;
  name: string;
  rarity: 'protagonist' | 'R' | 'SR' | 'SSR';
  role: 'guard' | 'firepower' | 'medic' | 'disruptor';
  element: 'electromagnetic' | 'fire' | 'light';
  positionType: 'front' | 'back';
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  aspd: number;
  skillIds: string[];
  obtain: string;
}

export interface SkillConfig {
  schemaVersion: string;
  skillId: string;
  ownerHeroId: string;
  type: 'normal' | 'active' | 'passive';
  target: 'enemy_single' | 'enemy_multi' | 'self' | 'ally_low_hp' | 'team';
  multiplier: number;
  effectType?: 'damage' | 'heal' | 'shield' | 'armor_break' | 'buff';
  effectValue?: number;
  energyCost?: number;
  durationSec?: number;
}

export interface RewardFragment {
  heroId: string;
  count: number;
}

export interface RewardConfig {
  schemaVersion: string;
  rewardId: string;
  starCoin?: number;
  expChip?: number;
  equipmentPart?: number;
  baseEnergy?: number;
  fragments?: RewardFragment[];
  onceOnly: boolean;
}

export interface EnemyGroupMember {
  enemyId: string;
  count: number;
}

export interface EnemyGroupConfig {
  schemaVersion: string;
  enemyGroupId: string;
  enemies: EnemyGroupMember[];
  bossEnemyId?: string;
  timeoutSec?: number;
}

/**
 * 广告位配置（纯数据层 schema）。
 * 仅描述广告位、奖励关联、限频与防重参数；不接入微信 SDK，不实现发奖逻辑。
 * 播放/发奖/限频的运行时实现由后续任务（C24 SDK 适配、C25 限频与异常）负责。
 */
export interface AdConfig {
  schemaVersion: string;
  /** 广告位 id（占位，不接真实广告位 ID）。 */
  adSlotId: string;
  /** 广告类型。当前游戏内仅用激励视频。 */
  adType: 'rewarded_video' | 'interstitial';
  /** 触发入口（对应离线翻倍 / 失败补给 / 快速巡航等场景）。 */
  entry: 'offline_reward_double' | 'defeat_supply' | 'quick_cruise';
  /** 关联 reward_config 的奖励 id；看广告完成后发放的奖励内容。 */
  rewardId: string;
  /** 每日总次数上限（保守，不超过平台每日广告总次数上限）。 */
  dailyLimit: number;
  /** 单会话次数上限（不超过平台单会话上限）。 */
  sessionLimit: number;
  /** 同类广告冷却秒数（>=0）。 */
  cooldownSec: number;
  /** 是否仅允许玩家主动触发（非强制广告，默认 true）。 */
  activeTriggerOnly: boolean;
  /** 失败后是否允许重试（重试不发奖，由领取状态机保证，默认 true）。 */
  allowRetryOnFail: boolean;
  /** 奖励流水 key 前缀，用于防重（结合存档与防重规格的奖励流水 ID）。 */
  flowKeyPrefix: string;
}

export interface ConfigBundle {
  level_config: LevelConfig[];
  enemy_config: EnemyConfig[];
  enemy_group_config: EnemyGroupConfig[];
  hero_config: HeroConfig[];
  skill_config: SkillConfig[];
  reward_config: RewardConfig[];
  ad_config: AdConfig[];
}

export type ConfigTableName = keyof ConfigBundle;
