var Unit = function(cfg) {
  this.id = cfg.id;
  this.raceId = cfg.raceId;
  this.name = cfg.name;
  this.team = cfg.team;
  this.slot = cfg.slot;
  this.color = cfg.color || '#888';
  this.size = cfg.size || 28;

  this.maxHp = cfg.maxHp;
  this.hp = cfg.maxHp;
  this.atk = cfg.atk;
  this.atkInterval = cfg.atkInterval || 1.2;
  this.atkTimer = Math.random() * this.atkInterval;

  // 怒气
  this.rage = 0; // 0~100

  // 状态
  this.stunTimer = 0;
  this.burnTimer = 0;     // 燃烧：受伤+10%
  this.bleedTimer = 0;    // 流血：持续掉血
  this.bleedDmg = 0;      // 流血每秒伤害
  this.slowTimer = 0;     // 减速
  this.slowRate = 0;      // 减速幅度 0~1

  this.dead = false;
  this.x = 0;
  this.y = 0;

  this.onSkill = null; // 技能回调，由BattleManager注入
};

Unit.prototype.update = function(dt, enemies, onAttack) {
  if (this.dead) return;

  // 自然怒气恢复 1%/秒（狂化期间不增长）
  if (!this._berserk) this._addRage(dt * 1);

  // 流血持续掉血
  if (this.bleedTimer > 0) {
    this.bleedTimer -= dt;
    this._takePureDamage(this.bleedDmg * dt);
  }

  // 燃烧倒计时
  if (this.burnTimer > 0) this.burnTimer -= dt;

  // 减速倒计时
  if (this.slowTimer > 0) this.slowTimer -= dt;

  // 眩晕期间不行动
  if (this.stunTimer > 0) {
    this.stunTimer -= dt;
    return;
  }

  // 技能检查（怒气满）
  if (this.rage >= 100) {
    this.rage = 0;
    if (this.onSkill) this.onSkill(this);
  }

  // 普攻
  var interval = this.slowTimer > 0 ? this.atkInterval * (1 + this.slowRate) : this.atkInterval;
  this.atkTimer -= dt;
  if (this.atkTimer <= 0) {
    this.atkTimer = interval;
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
    var d = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; nearest = e; }
  }
  return nearest;
};

// 受到攻击伤害（受燃烧加成，触发被攻击怒气）
Unit.prototype.takeDamage = function(dmg) {
  if (this.dead) return 0;
  var actual = this.burnTimer > 0 ? Math.round(dmg * 1.1) : dmg;
  this._takePureDamage(actual);
  this._addRage(3); // 被攻击+3%
  return actual;
};

Unit.prototype._takePureDamage = function(dmg) {
  if (this.dead) return;
  this.hp -= dmg;
  if (this.hp <= 0) { this.hp = 0; this.dead = true; }
};

Unit.prototype._addRage = function(amount) {
  if (this.dead) return;
  this.rage = Math.min(100, this.rage + amount);
};

Unit.prototype.onAttackHit = function() {
  if (!this._berserk) this._addRage(10);
};

// 施加状态
Unit.prototype.applyBurn = function(duration) {
  this.burnTimer = duration;
};
Unit.prototype.applyBleed = function(dps, duration) {
  this.bleedDmg = dps;
  this.bleedTimer = duration; // 不叠加，刷新
};
Unit.prototype.applyStun = function(duration) {
  this.stunTimer = duration;
};
Unit.prototype.applySlow = function(rate, duration) {
  this.slowRate = rate;
  this.slowTimer = duration;
};

module.exports = { Unit: Unit };
