var Unit = require('./Unit').Unit;
var RACES = require('../data/races').RACES;

function calcSlotPos(slot, team, w, h) {
  var col = slot % 3;
  var row = Math.floor(slot / 3);
  var cellW = w / 4, cellH = h / 8;
  var baseX = w / 2 - cellW + col * cellW;
  if (team === 'player') {
    return { x: baseX, y: h * 0.72 - row * cellH };
  } else {
    return { x: baseX, y: h * 0.28 + row * cellH };
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
};

BattleManager.prototype.setup = function(playerSlots, enemyCfgs) {
  this.playerUnits = [];
  this.enemyUnits = [];
  this.elapsed = 0;
  this.state = 'fighting';
  this.floatTexts = [];
  var self = this;

  playerSlots.forEach(function(cfg) {
    var race = RACES[cfg.raceId];
    if (!race) return;
    var pos = calcSlotPos(cfg.slot, 'player', self.w, self.h);
    var u = new Unit({
      id: self._uidCounter++,
      raceId: cfg.raceId, name: race.name, team: 'player', slot: cfg.slot,
      color: race.color, size: race.size,
      maxHp: Math.round(race.baseHp * (cfg.hpMult || 1)),
      atk: Math.round(race.baseAtk * (cfg.atkMult || 1)),
      atkInterval: race.baseAtkSpeed
    });
    u.x = pos.x; u.y = pos.y;
    u.onSkill = function(unit) { self._onSkill(unit); };
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
      u.onSkill = function(unit) { self._onSkill(unit); };
      self.enemyUnits.push(u);
    }
  });
};

// 技能占位（阶段3实现具体技能）
BattleManager.prototype._onSkill = function(unit) {
  this._addFloat(unit.x, unit.y - unit.size, '技能！', '#f1c40f');
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

  alivePlayers.forEach(function(u) {
    u.update(dt, aliveEnemies, function(attacker, target) {
      var actual = target.takeDamage(attacker.atk);
      attacker.onAttackHit();
      self._addFloat(target.x, target.y, '-' + actual, '#ff6b6b');
    });
  });

  aliveEnemies.forEach(function(u) {
    u.update(dt, alivePlayers, function(attacker, target) {
      var actual = target.takeDamage(attacker.atk);
      attacker.onAttackHit();
      self._addFloat(target.x, target.y, '-' + actual, '#ffa07a');
    });
  });

  // 流血飘字（每秒采样，避免每帧飘字）
  this._bleedTick = (this._bleedTick || 0) + dt;
  if (this._bleedTick >= 1) {
    this._bleedTick -= 1;
    this.playerUnits.concat(this.enemyUnits).forEach(function(u) {
      if (!u.dead && u.bleedTimer > 0) {
        self._addFloat(u.x, u.y, '流血', '#c0392b');
      }
    });
  }

  this.floatTexts = this.floatTexts.filter(function(f) {
    f.y -= dt * 40;
    f.alpha -= dt * 1.5;
    return f.alpha > 0;
  });
};

BattleManager.prototype._addFloat = function(x, y, text, color) {
  if (this.floatTexts.length > 40) return;
  this.floatTexts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 10, text: text, color: color, alpha: 1 });
};

BattleManager.prototype.getAllUnits = function() {
  return this.playerUnits.concat(this.enemyUnits);
};

module.exports = { BattleManager: BattleManager, calcSlotPos: calcSlotPos };
