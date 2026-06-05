var BONDS = require('../data/bonds').BONDS;
var PlayerData = require('./PlayerData').PlayerData;

// 检测当前阵容中激活的羁绊，返回 [{ bond, level }]
function getActiveBonds(raceIds) {
  var d = PlayerData.get();
  var playerBonds = d.bonds || {};
  var result = [];
  for (var i = 0; i < BONDS.length; i++) {
    var bond = BONDS[i];
    var level = playerBonds[bond.id] || 0;
    if (level === 0) continue;
    // 检测阵容是否包含所有所需种族
    var hasAll = bond.races.every(function(r) { return raceIds.indexOf(r) !== -1; });
    if (hasAll) result.push({ bond: bond, level: level });
  }
  return result;
}

// 将羁绊效果注入到单位（战斗开始时调用）
function applyBonds(activeBonds, playerUnits) {
  activeBonds.forEach(function(ab) {
    var fx = ab.bond.levels[ab.level];
    if (!fx) return;
    var id = ab.bond.id;

    if (id === 'assassination_squad') {
      // 狼人攻击目标期间哥布林命中眩晕
      playerUnits.forEach(function(u) {
        if (u.raceId === 'goblin') u._assassinStun = fx.stunDuration || 1;
        if (u.raceId === 'werewolf' && fx.werewolfDmgBoost) {
          u.atk = Math.round(u.atk * (1 + fx.werewolfDmgBoost));
        }
      });
    }
    else if (id === 'war_vanguard') {
      // 集火：我方攻击加成由BattleManager处理（标记focusFire）
      playerUnits.forEach(function(u) {
        u._focusFire = true;
        if (fx.focusDmgBoost) u._focusDmgBoost = fx.focusDmgBoost;
      });
    }
    else if (id === 'shadow_execution') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'reaper' && fx.reaperSkillDmgBoost) {
          u._bondSkillBoost = (u._bondSkillBoost || 0) + fx.reaperSkillDmgBoost;
        }
      });
    }
    else if (id === 'guardian_heart') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'fairy' && fx.healBoost)   u._healBoostMult = (u._healBoostMult || 1) * (1 + fx.healBoost);
        if (u.raceId === 'slime' && fx.shieldBoost)  u._bondShieldBoost = fx.shieldBoost;
      });
    }
    else if (id === 'flame_formation') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'goblin') u._flameBondBurnDuration = fx.burnDuration || 2;
      });
    }
    else if (id === 'death_gauntlet') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'reaper') u._executeChanceBoost = (u._executeChanceBoost || 0) + (fx.executeChanceBoost || 0);
      });
    }
    else if (id === 'heavy_vanguard') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'minotaur') u._bondStunBoost = fx.stunBoost || 0;
      });
    }
    else if (id === 'battle_inspiration') {
      playerUnits.forEach(function(u) {
        if (u.raceId === 'orc'   && fx.orcAtkBoost)   u.atk = Math.round(u.atk * (1 + fx.orcAtkBoost));
        if (u.raceId === 'fairy' && fx.fairyHealBoost) u._healBoostMult = (u._healBoostMult || 1) * (1 + fx.fairyHealBoost);
      });
    }
  });
}

module.exports = { getActiveBonds: getActiveBonds, applyBonds: applyBonds };
