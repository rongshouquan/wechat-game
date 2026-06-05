// 宝物配置表
var ITEMS = {
  // 专属宝物
  exclusive: {
    fire_wand: {
      id: 'fire_wand', name: '火焰魔杖', rarity: 'exclusive', forRace: 'goblin',
      desc: '伤害-20%，技能攻击全体敌人',
      effects: { skillDmg: -0.2, skillTargetAll: true }
    },
    wolf_necklace: {
      id: 'wolf_necklace', name: '狼牙项链', rarity: 'exclusive', forRace: 'werewolf',
      desc: '伤害+20%，技能期间击杀立刻再次释放',
      effects: { dmg: 0.2, killRefreshSkill: true }
    },
    thunder_helm: {
      id: 'thunder_helm', name: '雷霆战盔', rarity: 'exclusive', forRace: 'minotaur',
      desc: '眩晕时间×2，技能期间减伤40%',
      effects: { stunMultiplier: 2, skillDamageReduction: 0.4 }
    },
    wargod_armlet: {
      id: 'wargod_armlet', name: '战神臂环', rarity: 'exclusive', forRace: 'orc',
      desc: '生命低于10%触发3秒无敌，每2分钟一次',
      effects: { invincibleOnLowHp: true, invincibleDuration: 3, invincibleCooldown: 120 }
    },
    shadow_staff: {
      id: 'shadow_staff', name: '暗影法杖', rarity: 'exclusive', forRace: 'skeletonMage',
      desc: '技能伤害-20%，同时对随机敌方发射暗影射线持续7秒',
      effects: { skillDmg: -0.2, extraShadowRay: true, extraDuration: 7 }
    },
    heal_gem_exclusive: {
      id: 'heal_gem_exclusive', name: '精灵宝典', rarity: 'exclusive', forRace: 'fairy',
      desc: '普攻治疗2个最低血量友方，所有治疗及增益效果+100%',
      effects: { healTargets: 2, healAndBuffBoost: 1.0 }
    },
    paladin_shield: {
      id: 'paladin_shield', name: '圣光盾徽', rarity: 'exclusive', forRace: 'paladin',
      desc: '护盾破裂眩晕敌人1秒，护盾期间怒气+30%',
      effects: { shieldBreakStun: 1, shieldRageBoost: 0.3 }
    },
    death_scythe: {
      id: 'death_scythe', name: '死神之镰', rarity: 'exclusive', forRace: 'reaper',
      desc: '技能伤害大幅提升，低血目标直接斩杀',
      effects: { skillDmg: 0.5, executeThreshold: 0.05 }
    }
  },

  // 传奇宝物
  legendary: {
    shadow_sword:   { id: 'shadow_sword',   name: '暗影之剑',   rarity: 'legendary', effects: { skillDmg: 0.2 } },
    frost_ring:     { id: 'frost_ring',     name: '冰霜之戒',   rarity: 'legendary', effects: { skillSlow: 3 } },
    thorn_armor:    { id: 'thorn_armor',    name: '反伤刺甲',   rarity: 'legendary', effects: { reflectDmg: 0.25 } },
    thunder_glove:  { id: 'thunder_glove',  name: '雷霆护手',   rarity: 'legendary', effects: { skillStunBoost: 0.5 } },
    holy_book:      { id: 'holy_book',      name: '光明之书',   rarity: 'legendary', effects: { skillHeal: 0.2 } },
    angel_wings:    { id: 'angel_wings',    name: '天使翅膀',   rarity: 'legendary', effects: { immuneDebuff: true } }
  },

  // 普通宝物
  normal: {
    iron_sword:     { id: 'iron_sword',     name: '铁剑',     rarity: 'normal', effects: { normalAtk: 0.05 } },
    copper_shield:  { id: 'copper_shield',  name: '铜盾',     rarity: 'normal', effects: { damageReduction: 0.05 } },
    mage_hat:       { id: 'mage_hat',       name: '法师帽',   rarity: 'normal', effects: { skillDmg: 0.05 } },
    mana_ring:      { id: 'mana_ring',      name: '魔力戒指', rarity: 'normal', effects: { rageSpeed: 0.2 } },
    heal_orb:       { id: 'heal_orb',       name: '治疗宝珠', rarity: 'normal', effects: { skillHeal: 0.05 } },
    speed_boots:    { id: 'speed_boots',    name: '速度靴',   rarity: 'normal', effects: { atkIntervalReduce: 0.05 } },
    flame_necklace: { id: 'flame_necklace', name: '火焰项链', rarity: 'normal', effects: { skillBurn: true } },
    ice_glove:      { id: 'ice_glove',      name: '冰晶护手', rarity: 'normal', effects: { skillSlow: 3 } },
    light_cape:     { id: 'light_cape',     name: '光明披风', rarity: 'normal', effects: { heal: 0.05 } },
    copper_glove:   { id: 'copper_glove',   name: '铜手套',   rarity: 'normal', effects: { damageReduction: 0.03 } }
  }
};

module.exports = { ITEMS: ITEMS };
