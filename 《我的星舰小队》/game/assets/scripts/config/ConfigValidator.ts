import {
  AdConfig,
  ConfigBundle,
  EnemyConfig,
  EnemyGroupConfig,
  HeroConfig,
  LevelConfig,
  RewardConfig,
  SkillConfig,
} from './ConfigTypes';

export interface ValidationError {
  table: string;
  id: string;
  message: string;
}

const LEVEL_TYPES = ['normal', 'elite', 'boss'];
const FACTIONS = ['mechanical', 'pirate', 'rift'];
const ELEMENT_WEAKNESS = ['electromagnetic', 'fire', 'light', 'none'];
const RARITIES = ['protagonist', 'R', 'SR', 'SSR'];
const ROLES = ['guard', 'firepower', 'medic', 'disruptor'];
const ELEMENTS = ['electromagnetic', 'fire', 'light'];
const POSITION_TYPES = ['front', 'back'];
const SKILL_TYPES = ['normal', 'active', 'passive'];
const SKILL_TARGETS = ['enemy_single', 'enemy_multi', 'self', 'ally_low_hp', 'team'];
const EFFECT_TYPES = ['damage', 'heal', 'shield', 'armor_break', 'buff'];
const AD_TYPES = ['rewarded_video', 'interstitial'];
const AD_ENTRIES = ['offline_reward_double', 'defeat_supply', 'quick_cruise'];

// 平台保守上限，来源：项目管理\规格冻结\微信平台规则核验记录.md（v3 采用阈值）。
// 单广告位的每日/单会话上限不得超过平台总上限；跨广告位的总次数封顶由运行时限频（C25）负责。
const AD_DAILY_LIMIT_MAX = 8;
const AD_SESSION_LIMIT_MAX = 3;

const ID_PATTERN = /^[a-z0-9_]+$/;
const LEVEL_ID_PATTERN = /^\d+-\d+$/;

function err(out: ValidationError[], table: string, id: string, message: string): void {
  out.push({ table, id, message });
}

function checkId(out: ValidationError[], table: string, id: string): void {
  if (!ID_PATTERN.test(id)) {
    err(out, table, id, `id "${id}" 不符合小写英文/数字/下划线规则`);
  }
}

function checkUnique(out: ValidationError[], table: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      err(out, table, id, `id "${id}" 重复`);
    }
    seen.add(id);
  }
}

function validateLevel(out: ValidationError[], row: LevelConfig): void {
  const id = row.levelId;
  // levelId 使用 "1-1" 章节-关卡格式，不适用通用的小写英文/数字/下划线 ID 规则。
  if (!LEVEL_ID_PATTERN.test(row.levelId)) {
    err(out, 'level_config', id, 'levelId 必须是 "1-1" 格式');
  }
  if (!(row.chapter >= 1 && row.chapter <= 3)) {
    err(out, 'level_config', id, 'chapter 必须在 1-3 之间');
  }
  if (!(row.stage >= 1 && row.stage <= 20)) {
    err(out, 'level_config', id, 'stage 必须在 1-20 之间');
  }
  if (!LEVEL_TYPES.includes(row.type)) {
    err(out, 'level_config', id, `type "${row.type}" 不在枚举范围内`);
  }
  if (!(row.recommendedPower > 0)) {
    err(out, 'level_config', id, 'recommendedPower 必须大于 0');
  }
  // 冻结包规则: "boss 关必须有 type=boss"。按设计确认，每章第 10 关与第 20 关
  // （levelId 形如 "x-10" / "x-20"）均为 Boss 关。
  if (/-(10|20)$/.test(row.levelId) && row.type !== 'boss') {
    err(out, 'level_config', id, 'levelId 形如 "x-10"/"x-20" 的关卡必须是 type=boss');
  }
}

function validateEnemyGroup(out: ValidationError[], row: EnemyGroupConfig): void {
  const id = row.enemyGroupId;
  checkId(out, 'enemy_group_config', id);
  if (!Array.isArray(row.enemies) || row.enemies.length === 0) {
    err(out, 'enemy_group_config', id, 'enemies 必须是非空数组');
  } else {
    for (const member of row.enemies) {
      if (!(member.count > 0)) {
        err(out, 'enemy_group_config', id, `enemies 中 "${member.enemyId}" 的 count 必须大于 0`);
      }
    }
  }
  if (row.timeoutSec !== undefined && row.timeoutSec < 0) {
    err(out, 'enemy_group_config', id, 'timeoutSec 必须大于等于 0');
  }
}

function validateEnemy(out: ValidationError[], row: EnemyConfig): void {
  const id = row.enemyId;
  checkId(out, 'enemy_config', id);
  if (!FACTIONS.includes(row.faction)) {
    err(out, 'enemy_config', id, `faction "${row.faction}" 不在枚举范围内`);
  }
  if (row.elementWeakness !== undefined && !ELEMENT_WEAKNESS.includes(row.elementWeakness)) {
    err(out, 'enemy_config', id, `elementWeakness "${row.elementWeakness}" 不在枚举范围内`);
  }
  if (!(row.hp > 0)) err(out, 'enemy_config', id, 'hp 必须大于 0');
  if (!(row.atk > 0)) err(out, 'enemy_config', id, 'atk 必须大于 0');
  if (!(row.def >= 0)) err(out, 'enemy_config', id, 'def 必须大于等于 0');
  if (!(row.aspd >= 0.2 && row.aspd <= 3)) {
    err(out, 'enemy_config', id, 'aspd 必须在 0.2-3 之间');
  }
}

function validateHero(out: ValidationError[], row: HeroConfig): void {
  const id = row.heroId;
  checkId(out, 'hero_config', id);
  if (!RARITIES.includes(row.rarity)) {
    err(out, 'hero_config', id, `rarity "${row.rarity}" 不在枚举范围内`);
  }
  if (!ROLES.includes(row.role)) {
    err(out, 'hero_config', id, `role "${row.role}" 不在枚举范围内`);
  }
  if (!ELEMENTS.includes(row.element)) {
    err(out, 'hero_config', id, `element "${row.element}" 不在枚举范围内`);
  }
  if (!POSITION_TYPES.includes(row.positionType)) {
    err(out, 'hero_config', id, `positionType "${row.positionType}" 不在枚举范围内`);
  }
  if (!(row.baseHp > 0)) err(out, 'hero_config', id, 'baseHp 必须大于 0');
  if (!(row.baseAtk > 0)) err(out, 'hero_config', id, 'baseAtk 必须大于 0');
  if (!(row.baseDef > 0)) err(out, 'hero_config', id, 'baseDef 必须大于 0');
  if (!(row.aspd >= 0.2 && row.aspd <= 3)) {
    err(out, 'hero_config', id, 'aspd 必须在 0.2-3 之间');
  }
  if (!Array.isArray(row.skillIds) || row.skillIds.length === 0) {
    err(out, 'hero_config', id, 'skillIds 必须是非空数组');
  }
}

function validateSkill(out: ValidationError[], row: SkillConfig): void {
  const id = row.skillId;
  checkId(out, 'skill_config', id);
  if (!SKILL_TYPES.includes(row.type)) {
    err(out, 'skill_config', id, `type "${row.type}" 不在枚举范围内`);
  }
  if (!SKILL_TARGETS.includes(row.target)) {
    err(out, 'skill_config', id, `target "${row.target}" 不在枚举范围内`);
  }
  if (!(row.multiplier >= 0 && row.multiplier <= 5)) {
    err(out, 'skill_config', id, 'multiplier 必须在 0-5 之间');
  }
  if (row.effectType !== undefined && !EFFECT_TYPES.includes(row.effectType)) {
    err(out, 'skill_config', id, `effectType "${row.effectType}" 不在枚举范围内`);
  }
  if (row.durationSec !== undefined && row.durationSec < 0) {
    err(out, 'skill_config', id, 'durationSec 必须大于等于 0');
  }
  if (row.type === 'active' && row.energyCost !== undefined && row.energyCost !== 100) {
    err(out, 'skill_config', id, 'active 技能 energyCost 默认应为 100');
  }
}

function validateReward(out: ValidationError[], row: RewardConfig): void {
  const id = row.rewardId;
  checkId(out, 'reward_config', id);
  const nonNegFields: Array<[string, number | undefined]> = [
    ['starCoin', row.starCoin],
    ['expChip', row.expChip],
    ['equipmentPart', row.equipmentPart],
    ['baseEnergy', row.baseEnergy],
  ];
  for (const [field, value] of nonNegFields) {
    if (value !== undefined && value < 0) {
      err(out, 'reward_config', id, `${field} 必须大于等于 0`);
    }
  }
  if (row.onceOnly !== true && row.onceOnly !== false) {
    err(out, 'reward_config', id, 'onceOnly 必须是 boolean');
  }
}

function validateAd(out: ValidationError[], row: AdConfig): void {
  const id = row.adSlotId;
  checkId(out, 'ad_config', id);
  if (!AD_TYPES.includes(row.adType)) {
    err(out, 'ad_config', id, `adType "${row.adType}" 不在枚举范围内`);
  }
  if (!AD_ENTRIES.includes(row.entry)) {
    err(out, 'ad_config', id, `entry "${row.entry}" 不在枚举范围内`);
  }
  if (!Number.isInteger(row.dailyLimit) || row.dailyLimit < 1 || row.dailyLimit > AD_DAILY_LIMIT_MAX) {
    err(out, 'ad_config', id, `dailyLimit 必须是 1-${AD_DAILY_LIMIT_MAX} 的整数`);
  }
  if (!Number.isInteger(row.sessionLimit) || row.sessionLimit < 1 || row.sessionLimit > AD_SESSION_LIMIT_MAX) {
    err(out, 'ad_config', id, `sessionLimit 必须是 1-${AD_SESSION_LIMIT_MAX} 的整数`);
  }
  if (Number.isInteger(row.dailyLimit) && Number.isInteger(row.sessionLimit) && row.sessionLimit > row.dailyLimit) {
    err(out, 'ad_config', id, 'sessionLimit 不得大于 dailyLimit');
  }
  if (!(row.cooldownSec >= 0)) {
    err(out, 'ad_config', id, 'cooldownSec 必须大于等于 0');
  }
  if (typeof row.activeTriggerOnly !== 'boolean') {
    err(out, 'ad_config', id, 'activeTriggerOnly 必须是 boolean');
  }
  if (typeof row.allowRetryOnFail !== 'boolean') {
    err(out, 'ad_config', id, 'allowRetryOnFail 必须是 boolean');
  }
  if (typeof row.flowKeyPrefix !== 'string' || !ID_PATTERN.test(row.flowKeyPrefix)) {
    err(out, 'ad_config', id, 'flowKeyPrefix 必须符合小写英文/数字/下划线规则且非空');
  }
}

function validateCrossReferences(out: ValidationError[], bundle: ConfigBundle): void {
  const rewardIds = new Set(bundle.reward_config.map((r) => r.rewardId));
  const heroIds = new Set(bundle.hero_config.map((h) => h.heroId));
  const skillIds = new Set(bundle.skill_config.map((s) => s.skillId));
  const skillById = new Map(bundle.skill_config.map((s) => [s.skillId, s]));

  const enemyIds = new Set(bundle.enemy_config.map((e) => e.enemyId));
  const enemyGroupIds = new Set(bundle.enemy_group_config.map((g) => g.enemyGroupId));

  for (const level of bundle.level_config) {
    if (!rewardIds.has(level.rewardId)) {
      err(out, 'level_config', level.levelId, `rewardId "${level.rewardId}" 未在 reward_config 中找到`);
    }
    if (!enemyGroupIds.has(level.enemyGroupId)) {
      err(out, 'level_config', level.levelId, `enemyGroupId "${level.enemyGroupId}" 未在 enemy_group_config 中找到`);
    }
  }

  for (const group of bundle.enemy_group_config) {
    for (const member of group.enemies ?? []) {
      if (!enemyIds.has(member.enemyId)) {
        err(out, 'enemy_group_config', group.enemyGroupId, `enemies 引用的 enemyId "${member.enemyId}" 未在 enemy_config 中找到`);
      }
    }
    if (group.bossEnemyId !== undefined && !enemyIds.has(group.bossEnemyId)) {
      err(out, 'enemy_group_config', group.enemyGroupId, `bossEnemyId "${group.bossEnemyId}" 未在 enemy_config 中找到`);
    }
  }

  for (const hero of bundle.hero_config) {
    for (const skillId of hero.skillIds ?? []) {
      const skill = skillById.get(skillId);
      if (!skill) {
        err(out, 'hero_config', hero.heroId, `skillIds 引用 "${skillId}" 未在 skill_config 中找到`);
      } else if (skill.ownerHeroId !== hero.heroId) {
        err(
          out,
          'hero_config',
          hero.heroId,
          `skill "${skillId}" 的 ownerHeroId 是 "${skill.ownerHeroId}"，与所属角色不一致`,
        );
      }
    }
  }

  for (const skill of bundle.skill_config) {
    if (!heroIds.has(skill.ownerHeroId)) {
      err(out, 'skill_config', skill.skillId, `ownerHeroId "${skill.ownerHeroId}" 未在 hero_config 中找到`);
    }
  }

  for (const reward of bundle.reward_config) {
    for (const fragment of reward.fragments ?? []) {
      if (!heroIds.has(fragment.heroId)) {
        err(out, 'reward_config', reward.rewardId, `fragments 引用的 heroId "${fragment.heroId}" 未在 hero_config 中找到`);
      }
    }
  }

  for (const ad of bundle.ad_config) {
    if (!rewardIds.has(ad.rewardId)) {
      err(out, 'ad_config', ad.adSlotId, `rewardId "${ad.rewardId}" 未在 reward_config 中找到`);
    }
  }

  void skillIds;
}

export function validateConfigBundle(bundle: ConfigBundle): ValidationError[] {
  const errors: ValidationError[] = [];

  checkUnique(errors, 'level_config', bundle.level_config.map((r) => r.levelId));
  checkUnique(errors, 'enemy_config', bundle.enemy_config.map((r) => r.enemyId));
  checkUnique(errors, 'enemy_group_config', bundle.enemy_group_config.map((r) => r.enemyGroupId));
  checkUnique(errors, 'hero_config', bundle.hero_config.map((r) => r.heroId));
  checkUnique(errors, 'skill_config', bundle.skill_config.map((r) => r.skillId));
  checkUnique(errors, 'reward_config', bundle.reward_config.map((r) => r.rewardId));
  checkUnique(errors, 'ad_config', bundle.ad_config.map((r) => r.adSlotId));

  bundle.level_config.forEach((row) => validateLevel(errors, row));
  bundle.enemy_config.forEach((row) => validateEnemy(errors, row));
  bundle.enemy_group_config.forEach((row) => validateEnemyGroup(errors, row));
  bundle.hero_config.forEach((row) => validateHero(errors, row));
  bundle.skill_config.forEach((row) => validateSkill(errors, row));
  bundle.reward_config.forEach((row) => validateReward(errors, row));
  bundle.ad_config.forEach((row) => validateAd(errors, row));

  validateCrossReferences(errors, bundle);

  return errors;
}
