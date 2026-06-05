// 种族配置表
var RACES = {
  goblin: {
    id: 'goblin',
    name: '哥布林',
    image: 'race_images/race_goblin.png',
    role: '群伤/燃烧',
    baseHp: 300,
    baseAtk: 40,
    baseAtkSpeed: 1.2, // 攻击间隔(秒)
    maxUnitsAtMaxLevel: 3,
    color: '#e74c3c',
    size: 28,
    // 等级成长节点
    levelGrowth: {
      5:  { unitCount: 2 },
      10: { sizeScale: 1.3, skill: 'burn' },
      15: { unitCount: 3 },
      20: { sizeScale: 1.6, skillDmgBoost: 0.3 }
    }
  },
  werewolf: {
    id: 'werewolf',
    name: '狼人',
    image: 'race_images/race_werewolf.png',
    role: '切后排',
    baseHp: 400,
    baseAtk: 55,
    baseAtkSpeed: 0.9,
    maxUnitsAtMaxLevel: 2,
    color: '#8e44ad',
    size: 30,
    levelGrowth: {
      5:  { doubleHitChance: 0.1 },
      10: { sizeScale: 1.3, skillDmgBoost: 0.2 },
      15: { unitCount: 2 },
      20: { sizeScale: 1.6, skillDurationBoost: 2 }
    }
  },
  minotaur: {
    id: 'minotaur',
    name: '牛头怪',
    image: 'race_images/race_minotaur.png',
    role: '坦克/控制',
    baseHp: 800,
    baseAtk: 35,
    baseAtkSpeed: 1.5,
    maxUnitsAtMaxLevel: 1,
    color: '#27ae60',
    size: 36,
    levelGrowth: {
      5:  { stunDuration: 1.5 },
      10: { sizeScale: 1.3, skillDmgBoost: 0.2 },
      15: { damageReduction: 0.3 },
      20: { sizeScale: 1.6, extraAttack: true }
    }
  },
  orc: {
    id: 'orc',
    name: '兽人',
    image: 'race_images/race_orc.png',
    role: '狂战士',
    baseHp: 600,
    baseAtk: 60,
    baseAtkSpeed: 1.0,
    maxUnitsAtMaxLevel: 3,
    color: '#d35400',
    size: 32,
    levelGrowth: {
      5:  { unitCount: 2 },
      10: { sizeScale: 1.3, skillBoost: 0.15 },
      15: { unitCount: 3 },
      20: { sizeScale: 1.6, lifeStealOnLowHp: true }
    }
  },
  skeletonMage: {
    id: 'skeletonMage',
    name: '骷髅法师',
    image: 'race_images/race_skeleton_mage.png',
    role: '高爆发单体',
    baseHp: 280,
    baseAtk: 70,
    baseAtkSpeed: 1.3,
    maxUnitsAtMaxLevel: 2,
    color: '#2c3e50',
    size: 28,
    levelGrowth: {
      5:  { armorPen: 0.1 },
      10: { sizeScale: 1.3, skillDmgBoost: 0.2 },
      15: { unitCount: 2 },
      20: { sizeScale: 1.6, skillDmgBoost: 0.5 }
    }
  },
  fairy: {
    id: 'fairy',
    name: '小精灵',
    image: 'race_images/race_fairy.png',
    role: '辅助/治疗',
    baseHp: 250,
    baseAtk: 0,  // 普攻是治疗
    baseHeal: 30,
    baseAtkSpeed: 1.2,
    maxUnitsAtMaxLevel: 1,
    color: '#f39c12',
    size: 24,
    levelGrowth: {
      5:  { reviveChance: 0.2 },
      10: { sizeScale: 1.3, healBoost: 0.2 },
      15: { reviveChance: 0.5 },
      20: { sizeScale: 1.6, skillHealBoost: 0.5 }
    }
  },
  paladin: {
    id: 'paladin',
    name: '圣骑士',
    image: 'race_images/race_paladin.png',
    role: '辅助/保护',
    baseHp: 350,
    baseAtk: 20,
    baseAtkSpeed: 1.4,
    maxUnitsAtMaxLevel: 1,
    color: '#1abc9c',
    size: 26,
    levelGrowth: {
      5:  { shieldAtkBoost: 0.1 },
      10: { sizeScale: 1.3, shieldDuration: 15 },
      15: { shieldAtkBoost: 0.2 },
      20: { sizeScale: 1.6, permanentShield: true }
    }
  },
  reaper: {
    id: 'reaper',
    name: '死神',
    image: 'race_images/race_reaper.png',
    role: '高爆发/收割',
    baseHp: 320,
    baseAtk: 65,
    baseAtkSpeed: 1.1,
    maxUnitsAtMaxLevel: 2,
    color: '#7f8c8d',
    size: 30,
    levelGrowth: {
      5:  { normalBleed: true },
      10: { sizeScale: 1.3, skillDmgBoost: 0.2 },
      15: { unitCount: 2 },
      20: { sizeScale: 1.6, skillDmgBoost: 0.5 }
    }
  }
};

module.exports = { RACES: RACES };
