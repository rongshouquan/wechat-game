var ITEMS = require('../data/items').ITEMS;

// 星级效果倍率：1星×1.0，2星×1.3，3星×1.6
var STAR_MULT = [1.0, 1.3, 1.6];

// 根据itemId获取effects对象
function getEffects(itemId) {
  if (!itemId) return null;
  var cats = ['exclusive', 'legendary', 'normal'];
  for (var i = 0; i < cats.length; i++) {
    var item = ITEMS[cats[i]][itemId];
    if (item) return item.effects;
  }
  return null;
}

// equip 参数：{ id, stars } 或旧格式 string
function applyToUnit(unit, equip) {
  var itemId, stars;
  if (equip && typeof equip === 'object' && equip.id) {
    itemId = equip.id; stars = equip.stars || 1;
  } else if (typeof equip === 'string') {
    itemId = equip; stars = 1;
  } else { return; }

  var fx = getEffects(itemId);
  if (!fx) return;
  var mult = STAR_MULT[Math.min(stars - 1, 2)];
  unit._itemEffects = fx;

  // 数值效果均乘以星级倍率
  if (fx.normalAtk)          unit.atk = Math.round(unit.atk * (1 + fx.normalAtk * mult));
  if (fx.dmg)                unit.atk = Math.round(unit.atk * (1 + fx.dmg * mult));
  if (fx.skillDmg)           unit._itemSkillDmgMult = 1 + fx.skillDmg * mult;
  if (fx.atkIntervalReduce)  unit.atkInterval *= (1 - fx.atkIntervalReduce * mult);
  if (fx.rageSpeed)          unit._rageSpeedMult = 1 + fx.rageSpeed * mult;
  if (fx.damageReduction)    unit._itemDmgReduction = fx.damageReduction * mult;
  if (fx.reflectDmg)         unit._reflectDmg = fx.reflectDmg * mult;
  if (fx.immuneDebuff)       unit._immuneDebuff = true;
  if (fx.healAndBuffBoost)   unit._healBoostMult = 1 + fx.healAndBuffBoost * mult;
  if (fx.healTargets)        unit._healTargets = fx.healTargets;
  if (fx.skillTargetAll)     unit._skillTargetAll = true;
  if (fx.killRefreshSkill)   unit._killRefreshSkill = true;
  if (fx.stunMultiplier)     unit._stunMult = fx.stunMultiplier * mult;
  if (fx.skillDamageReduction) unit._skillDmgReduction = fx.skillDamageReduction * mult;
  if (fx.invincibleOnLowHp)  unit._invincibleOnLowHp = true;
  if (fx.executeThreshold)   unit._executeThreshold = fx.executeThreshold;
  if (fx.extraShadowRay)     unit._extraShadowRay = true;
  if (fx.shieldBreakStun)    unit._shieldBreakStun = fx.shieldBreakStun * mult;
  if (fx.shieldRageBoost)    unit._shieldRageBoost = fx.shieldRageBoost * mult;
}

module.exports = { applyToUnit: applyToUnit, getEffects: getEffects };
