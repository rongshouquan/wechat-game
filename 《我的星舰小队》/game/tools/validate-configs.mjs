// 校验 assets/resources/configs 下的样例配置表是否符合《配置Schema冻结包》规则。
// 校验失败时以非零退出码结束，阻断后续任务。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

const TABLES = {
  level_config: { file: 'level_config.sample.json', idField: 'levelId' },
  enemy_config: { file: 'enemy_config.sample.json', idField: 'enemyId' },
  enemy_group_config: { file: 'enemy_group_config.sample.json', idField: 'enemyGroupId' },
  hero_config: { file: 'hero_config.sample.json', idField: 'heroId' },
  skill_config: { file: 'skill_config.sample.json', idField: 'skillId' },
  reward_config: { file: 'reward_config.sample.json', idField: 'rewardId' },
  ad_config: { file: 'ad_config.sample.json', idField: 'adSlotId' },
};

const ID_PATTERN = /^[a-z0-9_]+$/;
const LEVEL_ID_PATTERN = /^\d+-\d+$/;

// 平台保守上限，来源：项目管理\规格冻结\微信平台规则核验记录.md（v3 采用阈值）。
const AD_DAILY_LIMIT_MAX = 8;
const AD_SESSION_LIMIT_MAX = 3;

const ENUMS = {
  level_config: { type: ['normal', 'elite', 'boss'] },
  enemy_config: {
    faction: ['mechanical', 'pirate', 'rift'],
    elementWeakness: ['electromagnetic', 'fire', 'light', 'none'],
  },
  hero_config: {
    rarity: ['protagonist', 'R', 'SR', 'SSR'],
    role: ['guard', 'firepower', 'medic', 'disruptor'],
    element: ['electromagnetic', 'fire', 'light'],
    positionType: ['front', 'back'],
  },
  skill_config: {
    type: ['normal', 'active', 'passive'],
    target: ['enemy_single', 'enemy_multi', 'self', 'ally_low_hp', 'team'],
    effectType: ['damage', 'heal', 'shield', 'armor_break', 'buff'],
  },
  ad_config: {
    adType: ['rewarded_video', 'interstitial'],
    entry: ['offline_reward_double', 'defeat_supply', 'quick_cruise'],
  },
};

const errors = [];

function fail(table, id, message) {
  errors.push(`[${table}] ${id}: ${message}`);
}

function loadTable(name, def) {
  const filePath = path.join(CONFIG_DIR, def.file);
  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (e) {
    fail(name, '-', `无法读取文件 ${def.file}: ${e.message}`);
    return [];
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail(name, '-', `JSON 解析失败: ${e.message}`);
    return [];
  }
  if (!Array.isArray(data)) {
    fail(name, '-', '配置文件必须是数组');
    return [];
  }
  return data;
}

function checkUnique(name, idField, rows) {
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    if (seen.has(id)) fail(name, id, 'id 重复');
    seen.add(id);
  }
}

function checkCommon(name, idField, rows) {
  for (const row of rows) {
    const id = row[idField];
    if (!row.schemaVersion) fail(name, id, '缺少 schemaVersion');
    // level_config 的 id 使用 "1-1" 章节-关卡格式，由 checkLevelRules 单独校验，
    // 不适用通用的小写英文/数字/下划线 ID 规则。
    if (name !== 'level_config' && (typeof id !== 'string' || !ID_PATTERN.test(id))) {
      fail(name, id, `id "${id}" 不符合小写英文/数字/下划线规则`);
    }
    const enums = ENUMS[name] ?? {};
    for (const [field, allowed] of Object.entries(enums)) {
      const value = row[field];
      if (value === undefined) continue;
      if (!allowed.includes(value)) {
        fail(name, id, `${field} "${value}" 不在枚举范围内 [${allowed.join('/')}]`);
      }
    }
  }
}

function checkLevelRules(rows) {
  for (const row of rows) {
    const id = row.levelId;
    if (!LEVEL_ID_PATTERN.test(id ?? '')) fail('level_config', id, 'levelId 必须是 "1-1" 格式');
    if (!(row.chapter >= 1 && row.chapter <= 3)) fail('level_config', id, 'chapter 必须在 1-3');
    if (!(row.stage >= 1 && row.stage <= 20)) fail('level_config', id, 'stage 必须在 1-20');
    if (!(row.recommendedPower > 0)) fail('level_config', id, 'recommendedPower 必须大于 0');
    // 按设计确认，每章第 10 关与第 20 关（levelId 形如 "x-10"/"x-20"）均为 Boss 关。
    if (/-(10|20)$/.test(id ?? '') && row.type !== 'boss') {
      fail('level_config', id, 'levelId 形如 "x-10"/"x-20" 的关卡必须是 type=boss');
    }
  }
}

function checkEnemyRules(rows) {
  for (const row of rows) {
    const id = row.enemyId;
    if (!(row.hp > 0)) fail('enemy_config', id, 'hp 必须大于 0');
    if (!(row.atk > 0)) fail('enemy_config', id, 'atk 必须大于 0');
    if (!(row.def >= 0)) fail('enemy_config', id, 'def 必须大于等于 0');
    if (!(row.aspd >= 0.2 && row.aspd <= 3)) fail('enemy_config', id, 'aspd 必须在 0.2-3');
  }
}

function checkEnemyGroupRules(rows) {
  for (const row of rows) {
    const id = row.enemyGroupId;
    if (!Array.isArray(row.enemies) || row.enemies.length === 0) {
      fail('enemy_group_config', id, 'enemies 必须是非空数组');
    } else {
      for (const member of row.enemies) {
        if (!(member.count > 0)) fail('enemy_group_config', id, `enemies 中 "${member.enemyId}" 的 count 必须大于 0`);
      }
    }
    if (row.timeoutSec !== undefined && row.timeoutSec < 0) {
      fail('enemy_group_config', id, 'timeoutSec 必须大于等于 0');
    }
  }
}

function checkHeroRules(rows) {
  for (const row of rows) {
    const id = row.heroId;
    if (!(row.baseHp > 0)) fail('hero_config', id, 'baseHp 必须大于 0');
    if (!(row.baseAtk > 0)) fail('hero_config', id, 'baseAtk 必须大于 0');
    if (!(row.baseDef > 0)) fail('hero_config', id, 'baseDef 必须大于 0');
    if (!(row.aspd >= 0.2 && row.aspd <= 3)) fail('hero_config', id, 'aspd 必须在 0.2-3');
    if (!Array.isArray(row.skillIds) || row.skillIds.length === 0) {
      fail('hero_config', id, 'skillIds 必须是非空数组');
    }
  }
}

function checkSkillRules(rows) {
  for (const row of rows) {
    const id = row.skillId;
    if (!(row.multiplier >= 0 && row.multiplier <= 5)) fail('skill_config', id, 'multiplier 必须在 0-5');
    if (row.durationSec !== undefined && row.durationSec < 0) {
      fail('skill_config', id, 'durationSec 必须大于等于 0');
    }
    if (row.type === 'active' && row.energyCost !== undefined && row.energyCost !== 100) {
      fail('skill_config', id, 'active 技能 energyCost 默认应为 100');
    }
  }
}

function checkRewardRules(rows) {
  const numericFields = ['starCoin', 'expChip', 'equipmentPart', 'baseEnergy'];
  for (const row of rows) {
    const id = row.rewardId;
    for (const field of numericFields) {
      if (row[field] !== undefined && row[field] < 0) {
        fail('reward_config', id, `${field} 必须大于等于 0`);
      }
    }
    if (typeof row.onceOnly !== 'boolean') fail('reward_config', id, 'onceOnly 必须是 boolean');
  }
}

function checkAdRules(rows) {
  for (const row of rows) {
    const id = row.adSlotId;
    if (!Number.isInteger(row.dailyLimit) || row.dailyLimit < 1 || row.dailyLimit > AD_DAILY_LIMIT_MAX) {
      fail('ad_config', id, `dailyLimit 必须是 1-${AD_DAILY_LIMIT_MAX} 的整数`);
    }
    if (!Number.isInteger(row.sessionLimit) || row.sessionLimit < 1 || row.sessionLimit > AD_SESSION_LIMIT_MAX) {
      fail('ad_config', id, `sessionLimit 必须是 1-${AD_SESSION_LIMIT_MAX} 的整数`);
    }
    if (Number.isInteger(row.dailyLimit) && Number.isInteger(row.sessionLimit) && row.sessionLimit > row.dailyLimit) {
      fail('ad_config', id, 'sessionLimit 不得大于 dailyLimit');
    }
    if (!(row.cooldownSec >= 0)) fail('ad_config', id, 'cooldownSec 必须大于等于 0');
    if (typeof row.activeTriggerOnly !== 'boolean') fail('ad_config', id, 'activeTriggerOnly 必须是 boolean');
    if (typeof row.allowRetryOnFail !== 'boolean') fail('ad_config', id, 'allowRetryOnFail 必须是 boolean');
    if (typeof row.flowKeyPrefix !== 'string' || !ID_PATTERN.test(row.flowKeyPrefix)) {
      fail('ad_config', id, 'flowKeyPrefix 必须符合小写英文/数字/下划线规则且非空');
    }
  }
}

function checkCrossReferences(tables) {
  const rewardIds = new Set(tables.reward_config.map((r) => r.rewardId));
  const heroIds = new Set(tables.hero_config.map((h) => h.heroId));
  const skillById = new Map(tables.skill_config.map((s) => [s.skillId, s]));
  const enemyIds = new Set(tables.enemy_config.map((e) => e.enemyId));
  const enemyGroupIds = new Set(tables.enemy_group_config.map((g) => g.enemyGroupId));

  for (const level of tables.level_config) {
    if (!rewardIds.has(level.rewardId)) {
      fail('level_config', level.levelId, `rewardId "${level.rewardId}" 未在 reward_config 中找到`);
    }
    if (!enemyGroupIds.has(level.enemyGroupId)) {
      fail('level_config', level.levelId, `enemyGroupId "${level.enemyGroupId}" 未在 enemy_group_config 中找到`);
    }
  }

  for (const group of tables.enemy_group_config) {
    for (const member of group.enemies ?? []) {
      if (!enemyIds.has(member.enemyId)) {
        fail('enemy_group_config', group.enemyGroupId, `enemies 引用的 enemyId "${member.enemyId}" 未在 enemy_config 中找到`);
      }
    }
    if (group.bossEnemyId !== undefined && !enemyIds.has(group.bossEnemyId)) {
      fail('enemy_group_config', group.enemyGroupId, `bossEnemyId "${group.bossEnemyId}" 未在 enemy_config 中找到`);
    }
  }

  for (const hero of tables.hero_config) {
    for (const skillId of hero.skillIds ?? []) {
      const skill = skillById.get(skillId);
      if (!skill) {
        fail('hero_config', hero.heroId, `skillIds 引用 "${skillId}" 未在 skill_config 中找到`);
      } else if (skill.ownerHeroId !== hero.heroId) {
        fail('hero_config', hero.heroId, `skill "${skillId}" 的 ownerHeroId 与所属角色不一致`);
      }
    }
  }

  for (const skill of tables.skill_config) {
    if (!heroIds.has(skill.ownerHeroId)) {
      fail('skill_config', skill.skillId, `ownerHeroId "${skill.ownerHeroId}" 未在 hero_config 中找到`);
    }
  }

  for (const reward of tables.reward_config) {
    for (const fragment of reward.fragments ?? []) {
      if (!heroIds.has(fragment.heroId)) {
        fail('reward_config', reward.rewardId, `fragments 引用的 heroId "${fragment.heroId}" 未在 hero_config 中找到`);
      }
    }
  }

  for (const ad of tables.ad_config) {
    if (!rewardIds.has(ad.rewardId)) {
      fail('ad_config', ad.adSlotId, `rewardId "${ad.rewardId}" 未在 reward_config 中找到`);
    }
  }
}

const tables = {};
for (const [name, def] of Object.entries(TABLES)) {
  tables[name] = loadTable(name, def);
  checkUnique(name, def.idField, tables[name]);
  checkCommon(name, def.idField, tables[name]);
}

checkLevelRules(tables.level_config);
checkEnemyRules(tables.enemy_config);
checkEnemyGroupRules(tables.enemy_group_config);
checkHeroRules(tables.hero_config);
checkSkillRules(tables.skill_config);
checkRewardRules(tables.reward_config);
checkAdRules(tables.ad_config);
checkCrossReferences(tables);

const version = tables.level_config[0]?.schemaVersion ?? 'unknown';
console.log(`loaded config version ${version}`);

if (errors.length > 0) {
  console.error(`config validation failed with ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('all sample configs valid');
