var Unit = function(cfg) {
  this.id = cfg.id;           // 唯一id
  this.raceId = cfg.raceId;
  this.name = cfg.name;
  this.team = cfg.team;       // 'player' | 'enemy'
  this.slot = cfg.slot;       // 0-5 战场格子
  this.color = cfg.color || '#888';
  this.size = cfg.size || 28;

  this.maxHp = cfg.maxHp;
  this.hp = cfg.maxHp;
  this.atk = cfg.atk;
  this.atkInterval = cfg.atkInterval || 1.2; // 秒
  this.atkTimer = Math.random() * this.atkInterval; // 错开攻击节奏

  this.dead = false;
  this.stunTimer = 0;

  // 位置（由BattleManager根据slot计算）
  this.x = 0;
  this.y = 0;
};

Unit.prototype.update = function(dt, enemies, onAttack) {
  if (this.dead) return;

  if (this.stunTimer > 0) {
    this.stunTimer -= dt;
    return;
  }

  this.atkTimer -= dt;
  if (this.atkTimer <= 0) {
    this.atkTimer = this.atkInterval;
    var target = this._findNearest(enemies);
    if (target && onAttack) onAttack(this, target);
  }
};

Unit.prototype._findNearest = function(enemies) {
  var nearest = null, minDist = Infinity;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.dead) continue;
    var dx = e.x - this.x, dy = e.y - this.y;
    var dist = dx * dx + dy * dy;
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
};

Unit.prototype.takeDamage = function(dmg) {
  if (this.dead) return;
  this.hp -= dmg;
  if (this.hp <= 0) { this.hp = 0; this.dead = true; }
};

module.exports = { Unit: Unit };
