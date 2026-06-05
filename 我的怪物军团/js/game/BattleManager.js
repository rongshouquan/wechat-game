var Unit = require('./Unit').Unit;
var RACES = require('../data/races').RACES;
var SKILLS = require('./SkillManager').SKILLS;
var ItemEffects = require('./ItemEffects').applyToUnit;
var PlayerData = require('./PlayerData').PlayerData;
var BondManager = require('./BondManager');

function calcSlotPos(slot, team, w, h) {
  var col = slot % 3;
  var row = Math.floor(slot / 3);
  var colX = [w * 0.17, w * 0.5, w * 0.83];
  if (team === 'player') {
    return { x: colX[col], y: row === 0 ? h * 0.565 : h * 0.685 };
  } else {
    return { x: colX[col], y: row === 0 ? h * 0.355 : h * 0.215 };
  }
}

var BattleManager = function(w, h) {
  this.w = w;
  this.h = h;
  this.playerUnits = [];
  this.enemyUnits = [];
  this.state = 'idle';
  this.timeLimit = 180;
  this.elapsed = 0;
  this._uidCounter = 0;
  this.floatTexts = [];
  this._ticks = []; // 技能持续tick列表
  this._bleedSample = 0;
};

BattleManager.prototype.setup = function(playerSlots, enemyCfgs) {
  this.playerUnits = [];
  this.enemyUnits = [];
  this.elapsed = 0;
  this.state = 'fighting';
  this.floatTexts = [];
  this._ticks = [];
  this._bleedSample = 0;
  var self = this;

  playerSlots.forEach(function(cfg) {
    var race = RACES[cfg.raceId];
    if (!race) return;
    var pos = calcSlotPos(cfg.slot, 'player', self.w, self.h);
    var u = new Unit({
      id: self._uidCounter++,
      raceId: cfg.raceId, name: race.name, team: 'player', slot: cfg.slot,
      color: race.color,
      size: cfg.sizeOverride || race.size,
      maxHp: Math.round(race.baseHp * (cfg.hpMult || 1)),
      atk: Math.round((race.baseAtk || 0) * (cfg.atkMult || 1)),
      baseHeal: race.baseHeal || 0,
      atkInterval: race.baseAtkSpeed,
      skillEnhancements: cfg.skillEnhancements || {}
    });
    u.x = pos.x; u.y = pos.y;
    u.onSkill = function(unit) { self._fireSkill(unit); };
    // 应用装备宝物
    var equips = PlayerData.get().equips || {};
    var itemId = equips[cfg.raceId];
    if (itemId) ItemEffects(u, itemId);
    self.playerUnits.push(u);
  });

  enemyCfgs.forEach(function(cfg) {
    var race = RACES[cfg.raceId];
    if (!race) return;
    var lvScale = 1 + (cfg.unitLevel - 1) * 0.08;
    var positions = cfg.positions || [0];
    for (var i = 0; i < positions.length; i++) {
      var slot = positions[i];
      var pos = calcSlotPos(slot, 'enemy', self.w, self.h);
      var u = new Unit({
        id: self._uidCounter++,
        raceId: cfg.raceId, name: race.name, team: 'enemy', slot: slot,
        color: race.color, size: race.size,
        maxHp: Math.round(race.baseHp * lvScale * (cfg.hpMult || 1)),
        atk: Math.round(race.baseAtk * lvScale * (cfg.atkMult || 1)),
        atkInterval: race.baseAtkSpeed
      });
      u.x = pos.x; u.y = pos.y;
      u.onSkill = function(unit) { self._fireSkill(unit); };
      self.enemyUnits.push(u);
    }
  });

  // 激活羁绊
  var raceIds = this.playerUnits.map(function(u) { return u.raceId; });
  var activeBonds = BondManager.getActiveBonds(raceIds);
  BondManager.applyBonds(activeBonds, this.playerUnits);
  this.activeBonds = activeBonds;
};

BattleManager.prototype._fireSkill = function(unit) {
  var skillFn = SKILLS[unit.raceId];
  if (!skillFn) {
    this._addFloat(unit.x, unit.y - unit.size, '技能！', '#f1c40f');
    return;
  }
  var self = this;
  skillFn(unit, {
    bm: self,
    addFloat: function(x, y, t, c) { self._addFloat(x, y, t, c); },
    getEnemies: function(u) { return u.team === 'player' ? self.enemyUnits : self.playerUnits; },
    getAllies:  function(u) { return u.team === 'player' ? self.playerUnits : self.enemyUnits; }
  });
};

// 注册持续tick（返回true继续，false停止）
BattleManager.prototype.registerTick = function(fn) {
  this._ticks.push(fn);
};

BattleManager.prototype.update = function(dt) {
  if (this.state !== 'fighting') return;

  this.elapsed += dt;
  if (this.elapsed >= this.timeLimit) { this.state = 'lose'; return; }

  var self = this;
  var aliveEnemies = this.enemyUnits.filter(function(u) { return !u.dead; });
  var alivePlayers = this.playerUnits.filter(function(u) { return !u.dead; });

  if (aliveEnemies.length === 0) { this.state = 'win'; return; }
  if (alivePlayers.length === 0) { this.state = 'lose'; return; }

  // 集火目标：血量最低的存活敌人
  this._focusTarget = aliveEnemies.length > 0 ? aliveEnemies.reduce(function(a, b) { return a.hp < b.hp ? a : b; }) : null;

  // 持续技能tick
  this._ticks = this._ticks.filter(function(fn) { return fn(dt); });

  alivePlayers.forEach(function(u) {
    var berserking = u._berserk;
    if (berserking) u.rage = Math.min(99, u.rage);

    // 小精灵普攻：治疗血量最低友方（不参与普通攻击逻辑）
    if (u.raceId === 'fairy') {
      u.update(dt, alivePlayers, function(attacker) {
        var targets = alivePlayers.filter(function(a) { return !a.dead; });
        var healTargetCount = attacker._healTargets || 1;
        targets.sort(function(a, b) { return (a.hp/a.maxHp) - (b.hp/b.maxHp); });
        var healAmt = Math.round((attacker._baseHeal || 30) * (attacker._healBoostMult || 1));
        for (var hi = 0; hi < Math.min(healTargetCount, targets.length); hi++) {
          var ht = targets[hi];
          ht.hp = Math.min(ht.maxHp, ht.hp + healAmt);
          self._addFloat(ht.x, ht.y, '+' + healAmt, '#2ecc71');
        }
        attacker.onAttackHit();
      });
      return;
    }

    u.update(dt, aliveEnemies, function(attacker, target) {
      var atkVal = Math.round(attacker.atk * (1 + (attacker._atkBoost || 0)));
      var dmgReduction = (target._skillDmgReduction || 0) + (target._itemDmgReduction || 0);
      var focusBoost = (attacker._focusFire && target === self._focusTarget) ? (attacker._focusDmgBoost || 0) : 0;
      var dmg = Math.round(atkVal * Math.max(0, 1 - dmgReduction) * (1 + focusBoost));
      if (target.shield > 0) {
        var abs = Math.min(target.shield, dmg);
        target.shield -= abs; dmg -= abs;
        if (abs > 0) self._addFloat(target.x, target.y, '护盾-' + abs, '#1abc9c');
      }
      if (dmg > 0) {
        var actual = target.takeDamage(dmg);
        attacker.onAttackHit();
        self._addFloat(target.x, target.y, '-' + actual, '#ff6b6b');
        if (target._reflectDmg && !target.dead) {
          var ref = Math.round(dmg * target._reflectDmg);
          attacker.takeDamage(ref);
          self._addFloat(attacker.x, attacker.y, '反-' + ref, '#e67e22');
        }
      }
    });
  });

  aliveEnemies.forEach(function(u) {
    u.update(dt, alivePlayers, function(attacker, target) {
      var atkVal = Math.round(attacker.atk * (1 + (attacker._atkBoost || 0)));
      var dmgReduction = (target._skillDmgReduction || 0) + (target._itemDmgReduction || 0);
      var dmg = Math.round(atkVal * Math.max(0, 1 - dmgReduction));
      if (target.shield > 0) {
        var abs = Math.min(target.shield, dmg);
        target.shield -= abs; dmg -= abs;
        if (abs > 0) self._addFloat(target.x, target.y, '护盾-' + abs, '#1abc9c');
      }
      if (dmg > 0) {
        var actual = target.takeDamage(dmg);
        attacker.onAttackHit();
        self._addFloat(target.x, target.y, '-' + actual, '#ffa07a');
        if (target._reflectDmg && !target.dead) {
          var ref2 = Math.round(dmg * target._reflectDmg);
          attacker.takeDamage(ref2);
          self._addFloat(attacker.x, attacker.y, '反-' + ref2, '#e67e22');
        }
      }
    });
  });

  // 流血飘字采样
  this._bleedSample += dt;
  if (this._bleedSample >= 1) {
    this._bleedSample -= 1;
    this.playerUnits.concat(this.enemyUnits).forEach(function(u) {
      if (!u.dead && u.bleedTimer > 0) self._addFloat(u.x, u.y, '流血', '#c0392b');
    });
  }

  this.floatTexts = this.floatTexts.filter(function(f) {
    f.y -= dt * 40;
    f.alpha -= dt * 1.5;
    return f.alpha > 0;
  });
};

BattleManager.prototype._addFloat = function(x, y, text, color) {
  if (this.floatTexts.length > 50) return;
  this.floatTexts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 10, text: text, color: color, alpha: 1 });
};

BattleManager.prototype.getAllUnits = function() {
  return this.playerUnits.concat(this.enemyUnits);
};

module.exports = { BattleManager: BattleManager, calcSlotPos: calcSlotPos };
