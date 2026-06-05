var Unit = require('./Unit').Unit;
var RACES = require('../data/races').RACES;

// 战场格子布局（3×2，前排0-2，后排3-5）
// 玩家在下方，敌人在上方
function calcSlotPos(slot, team, w, h) {
  var col = slot % 3;
  var row = Math.floor(slot / 3); // 0=前排,1=后排
  var cellW = w / 4, cellH = h / 8;
  var baseX = w / 2 - cellW + col * cellW;

  if (team === 'player') {
    var baseY = h * 0.72 - row * cellH;
    return { x: baseX, y: baseY };
  } else {
    var baseY2 = h * 0.28 + row * cellH;
    return { x: baseX, y: baseY2 };
  }
}

var BattleManager = function(w, h) {
  this.w = w;
  this.h = h;
  this.playerUnits = [];
  this.enemyUnits = [];
  this.state = 'idle'; // 'idle'|'fighting'|'win'|'lose'
  this.timeLimit = 180;
  this.elapsed = 0;
  this._uidCounter = 0;

  this.floatTexts = []; // 飘字
};

BattleManager.prototype.setup = function(playerSlots, enemyCfgs) {
  this.playerUnits = [];
  this.enemyUnits = [];
  this.elapsed = 0;
  this.state = 'fighting';
  this.floatTexts = [];

  var self = this;

  // 玩家单位
  playerSlots.forEach(function(cfg) {
    var race = RACES[cfg.raceId];
    if (!race) return;
    var pos = calcSlotPos(cfg.slot, 'player', self.w, self.h);
    var u = new Unit({
      id: self._uidCounter++,
      raceId: cfg.raceId,
      name: race.name,
      team: 'player',
      slot: cfg.slot,
      color: race.color,
      size: race.size,
      maxHp: Math.round(race.baseHp * (cfg.hpMult || 1)),
      atk: Math.round(race.baseAtk * (cfg.atkMult || 1)),
      atkInterval: race.baseAtkSpeed
    });
    pos && (u.x = pos.x, u.y = pos.y);
    self.playerUnits.push(u);
  });

  // 敌方单位
  enemyCfgs.forEach(function(cfg) {
    var race = RACES[cfg.raceId];
    if (!race) return;
    var lvScale = 1 + (cfg.unitLevel - 1) * 0.08;
    for (var i = 0; i < (cfg.positions || [cfg.slot || 0]).length; i++) {
      var slot = cfg.positions[i];
      var pos = calcSlotPos(slot, 'enemy', self.w, self.h);
      var u = new Unit({
        id: self._uidCounter++,
        raceId: cfg.raceId,
        name: race.name,
        team: 'enemy',
        slot: slot,
        color: race.color,
        size: race.size,
        maxHp: Math.round(race.baseHp * lvScale * (cfg.hpMult || 1)),
        atk: Math.round(race.baseAtk * lvScale * (cfg.atkMult || 1)),
        atkInterval: race.baseAtkSpeed
      });
      pos && (u.x = pos.x, u.y = pos.y);
      self.enemyUnits.push(u);
    }
  });
};

BattleManager.prototype.update = function(dt) {
  if (this.state !== 'fighting') return;

  this.elapsed += dt;
  if (this.elapsed >= this.timeLimit) {
    this.state = 'lose';
    return;
  }

  var self = this;
  var aliveEnemies = this.enemyUnits.filter(function(u) { return !u.dead; });
  var alivePlayers = this.playerUnits.filter(function(u) { return !u.dead; });

  if (aliveEnemies.length === 0) { this.state = 'win'; return; }
  if (alivePlayers.length === 0) { this.state = 'lose'; return; }

  // 玩家单位攻击
  alivePlayers.forEach(function(u) {
    u.update(dt, aliveEnemies, function(attacker, target) {
      var dmg = attacker.atk;
      target.takeDamage(dmg);
      self._addFloat(target.x, target.y, '-' + dmg, '#ff6b6b');
    });
  });

  // 敌方单位攻击
  aliveEnemies.forEach(function(u) {
    u.update(dt, alivePlayers, function(attacker, target) {
      var dmg = attacker.atk;
      target.takeDamage(dmg);
      self._addFloat(target.x, target.y, '-' + dmg, '#ffa07a');
    });
  });

  // 更新飘字
  this.floatTexts = this.floatTexts.filter(function(f) {
    f.y -= dt * 40;
    f.alpha -= dt * 1.5;
    return f.alpha > 0;
  });
};

BattleManager.prototype._addFloat = function(x, y, text, color) {
  if (this.floatTexts.length > 30) return;
  this.floatTexts.push({ x: x + (Math.random() - 0.5) * 20, y: y - 10, text: text, color: color, alpha: 1 });
};

BattleManager.prototype.getAllUnits = function() {
  return this.playerUnits.concat(this.enemyUnits);
};

module.exports = { BattleManager: BattleManager, calcSlotPos: calcSlotPos };
