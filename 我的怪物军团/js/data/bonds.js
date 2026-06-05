// 羁绊配置表
var BONDS = [
  {
    id: 'assassination_squad',
    name: '暗杀小队',
    races: ['goblin', 'werewolf'],
    levels: {
      1: { desc: '狼人攻击目标期间哥布林命中目标眩晕1秒', stunDuration: 1 },
      2: { desc: '眩晕2秒', stunDuration: 2 },
      3: { desc: '眩晕2.5秒 + 狼人伤害+20%', stunDuration: 2.5, werewolfDmgBoost: 0.2 }
    }
  },
  {
    id: 'war_vanguard',
    name: '战争先锋',
    races: ['minotaur', 'orc'],
    levels: {
      1: { desc: '我方优先攻击被击中目标', focusFire: true },
      2: { desc: '集火目标受到伤害+25%', focusFire: true, focusDmgBoost: 0.25 },
      3: { desc: '集火目标受到伤害+50%', focusFire: true, focusDmgBoost: 0.5 }
    }
  },
  {
    id: 'shadow_execution',
    name: '暗影刑控',
    races: ['skeletonMage', 'reaper'],
    levels: {
      1: { desc: '死神技能伤害+10%', reaperSkillDmgBoost: 0.1 },
      2: { desc: '死神技能伤害+15%', reaperSkillDmgBoost: 0.15 },
      3: { desc: '死神技能伤害+20%', reaperSkillDmgBoost: 0.2 }
    }
  },
  {
    id: 'guardian_heart',
    name: '守护之心',
    races: ['fairy', 'paladin'],
    levels: {
      1: { desc: '护盾持续+10%，治疗+5%', shieldBoost: 0.1, healBoost: 0.05 },
      2: { desc: '护盾持续+20%，治疗+10%', shieldBoost: 0.2, healBoost: 0.1 },
      3: { desc: '护盾持续+30%，治疗+20%', shieldBoost: 0.3, healBoost: 0.2 }
    }
  },
  {
    id: 'flame_formation',
    name: '火焰法阵',
    races: ['goblin', 'skeletonMage'],
    levels: {
      1: { desc: '陨石技能附加燃烧2秒', burnDuration: 2 },
      2: { desc: '陨石技能附加燃烧3秒', burnDuration: 3 },
      3: { desc: '陨石技能附加燃烧4秒', burnDuration: 4 }
    }
  },
  {
    id: 'death_gauntlet',
    name: '死神手套',
    races: ['werewolf', 'reaper'],
    levels: {
      1: { desc: '斩杀触发概率+5%', executeChanceBoost: 0.05 },
      2: { desc: '斩杀触发概率+10%', executeChanceBoost: 0.1 },
      3: { desc: '斩杀触发概率+15%', executeChanceBoost: 0.15 }
    }
  },
  {
    id: 'heavy_vanguard',
    name: '重火先锋',
    races: ['minotaur', 'goblin'],
    levels: {
      1: { desc: '牛头怪技能眩晕+0.3秒', stunBoost: 0.3 },
      2: { desc: '牛头怪技能眩晕+0.5秒', stunBoost: 0.5 },
      3: { desc: '牛头怪技能眩晕+0.7秒', stunBoost: 0.7 }
    }
  },
  {
    id: 'battle_inspiration',
    name: '战意激励',
    races: ['orc', 'fairy'],
    levels: {
      1: { desc: '兽人攻击+3%，小精灵治疗+5%', orcAtkBoost: 0.03, fairyHealBoost: 0.05 },
      2: { desc: '兽人攻击+7%，小精灵治疗+10%', orcAtkBoost: 0.07, fairyHealBoost: 0.1 },
      3: { desc: '兽人攻击+10%，小精灵治疗+15%', orcAtkBoost: 0.1, fairyHealBoost: 0.15 }
    }
  }
];

module.exports = { BONDS: BONDS };
