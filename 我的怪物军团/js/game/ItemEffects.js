var ITEMS = require('../data/items').ITEMS;

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

// 将宝物效果应用到Unit的属性（创建时调用）
function applyToUnit(unit, itemId) {
  var fx = getEffects(itemId);
  if (!fx) return;
  unit._itemEffects = fx;

  // 即时属性修改
  if (fx.normalAtk)          unit.atk = Math.round(unit.atk * (1 + fx.normalAtk));
  if (fx.dmg)                unit.atk = Math.round(unit.atk * (1 + fx.dmg));
  if (fx.skillDmg)           unit._itemSkillDmgMult = 1 + fx.skillDmg;
  if (fx.atkIntervalReduce)  unit.atkInterval *= (1 - fx.atkIntervalReduce);
  if (fx.rageSpeed)          unit._rageSpeedMult = 1 + fx.rageSpeed;
  if (fx.damageReduction)    unit._itemDmgReduction = fx.damageReduction;
  if (fx.reflectDmg)         unit._reflectDmg = fx.reflectDmg;
  if (fx.immuneDebuff)       unit._immuneDebuff = true;
  if (fx.healAndBuffBoost)   unit._healBoostMult = 1 + fx.healAndBuffBoost;
  if (fx.healTargets)        unit._healTargets = fx.healTargets;
  if (fx.skillTargetAll)     unit._skillTargetAll = true;
  if (fx.killRefreshSkill)   unit._killRefreshSkill = true;
  if (fx.stunMultiplier)     unit._stunMult = fx.stunMultiplier;
  if (fx.skillDamageReduction) unit._skillDmgReduction = fx.skillDamageReduction;
  if (fx.invincibleOnLowHp)  unit._invincibleOnLowHp = true;
  if (fx.executeThreshold)   unit._executeThreshold = fx.executeThreshold;
  if (fx.extraShadowRay)     unit._extraShadowRay = true;
  if (fx.shieldBreakStun)    unit._shieldBreakStun = fx.shieldBreakStun;
  if (fx.shieldRageBoost)    unit._shieldRageBoost = fx.shieldRageBoost;
}

module.exports = { applyToUnit: applyToUnit, getEffects: getEffects };
