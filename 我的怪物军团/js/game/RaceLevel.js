var RACES = require('../data/races').RACES;

// 根据种族和等级，计算实际单位数、尺寸、属性倍率、已解锁技能增强
function getRaceStats(raceId, level) {
  var race = RACES[raceId];
  if (!race) return null;

  var hpMult = 1 + (level - 1) * 0.1;
  var atkMult = 1 + (level - 1) * 0.1;
  var sizeScale = 1;
  var unitCount = 1;
  var skillEnhancements = {};

  var growth = race.levelGrowth || {};

  if (level >= 5) {
    if (growth[5]) {
      if (growth[5].unitCount)       unitCount = growth[5].unitCount;
      if (growth[5].doubleHitChance) skillEnhancements.doubleHitChance = growth[5].doubleHitChance;
      if (growth[5].stunDuration)    skillEnhancements.stunDuration = growth[5].stunDuration;
      if (growth[5].reviveChance)    skillEnhancements.reviveChance = growth[5].reviveChance;
      if (growth[5].shieldAtkBoost)  skillEnhancements.shieldAtkBoost = growth[5].shieldAtkBoost;
      if (growth[5].normalBleed)     skillEnhancements.normalBleed = true;
      if (growth[5].armorPen)        skillEnhancements.armorPen = growth[5].armorPen;
    }
  }
  if (level >= 10) {
    if (growth[10]) {
      if (growth[10].sizeScale)       sizeScale = growth[10].sizeScale;
      if (growth[10].skill)           skillEnhancements.skill = growth[10].skill;
      if (growth[10].skillDmgBoost)   skillEnhancements.skillDmgBoost = (skillEnhancements.skillDmgBoost || 0) + growth[10].skillDmgBoost;
      if (growth[10].healBoost)       skillEnhancements.healBoost = growth[10].healBoost;
      if (growth[10].shieldDuration)  skillEnhancements.shieldDuration = growth[10].shieldDuration;
      if (growth[10].skillBoost)      skillEnhancements.skillBoost = growth[10].skillBoost;
      if (growth[10].damageReduction) skillEnhancements.damageReduction = growth[10].damageReduction;
    }
  }
  if (level >= 15) {
    if (growth[15]) {
      if (growth[15].unitCount)       unitCount = growth[15].unitCount;
      if (growth[15].reviveChance)    skillEnhancements.reviveChance = growth[15].reviveChance;
      if (growth[15].shieldAtkBoost)  skillEnhancements.shieldAtkBoost = growth[15].shieldAtkBoost;
      if (growth[15].damageReduction) skillEnhancements.damageReduction = growth[15].damageReduction;
    }
  }
  if (level >= 20) {
    if (growth[20]) {
      if (growth[20].sizeScale)       sizeScale = growth[20].sizeScale;
      if (growth[20].skillDmgBoost)   skillEnhancements.skillDmgBoost = (skillEnhancements.skillDmgBoost || 0) + growth[20].skillDmgBoost;
      if (growth[20].lifeStealOnLowHp) skillEnhancements.lifeStealOnLowHp = true;
      if (growth[20].permanentShield)  skillEnhancements.permanentShield = true;
      if (growth[20].extraAttack)      skillEnhancements.extraAttack = true;
    }
  }

  // 限制不超过种族满级单位数
  var maxUnits = race.maxUnitsAtMaxLevel || 1;
  unitCount = Math.min(unitCount, maxUnits);

  return {
    raceId: raceId,
    level: level,
    unitCount: unitCount,
    sizeScale: sizeScale,
    hpMult: hpMult,
    atkMult: atkMult,
    skillEnhancements: skillEnhancements
  };
}

// 根据unitCount和baseSlot分配格子（尽量填同排）
function assignSlots(baseSlot, unitCount) {
  var slots = [baseSlot];
  if (unitCount <= 1) return slots;
  var row = Math.floor(baseSlot / 3);
  // 同排找空位（简单顺序分配，实际阵容管理阶段10再优化）
  for (var col = 0; col < 3 && slots.length < unitCount; col++) {
    var s = row * 3 + col;
    if (s !== baseSlot) slots.push(s);
  }
  return slots;
}

module.exports = { getRaceStats: getRaceStats, assignSlots: assignSlots };
