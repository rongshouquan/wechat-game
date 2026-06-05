var BattleManager = require('../game/BattleManager').BattleManager;
var LEVELS = require('../data/levels').LEVELS;
var PlayerData = require('../game/PlayerData').PlayerData;
var getRaceStats = require('../game/RaceLevel').getRaceStats;
var AdManager = require('../game/AdManager').AdManager;

var BattleScene = function(ctx, width, height, levelId, onEnd) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onEnd = onEnd || function() {};

  this.bm = new BattleManager(width, height);

  var playerSlots = this._buildPlayerSlots();
  // 阵容为空时给默认单位防崩溃
  if (playerSlots.length === 0) {
    playerSlots = [{ raceId: 'goblin', slot: 1, hpMult: 1, atkMult: 1, sizeOverride: 28, skillEnhancements: {} }];
  }
  var levelCfg = LEVELS[(levelId || 1) - 1] || LEVELS[0];
  this.bm.setup(playerSlots, levelCfg.enemies);
  this.levelName = levelCfg.name;
  this.rewards = levelCfg.rewards || { researchPoints: 10 };
  this.isSpecial = levelCfg.isSpecial || false;
  this._canRevive = this.isSpecial; // 特殊关可复活一次
  this._resultShown = false;
  this._showRevive = false;
};

BattleScene.prototype._buildPlayerSlots = function() {
  var d = PlayerData.get();
  var lineup = d.lineup;
  var slots = [];
  for (var i = 0; i < lineup.length; i++) {
    var entry = lineup[i];
    var level = d.raceLevels[entry.raceId] || 1;
    var stats = getRaceStats(entry.raceId, level);
    if (!stats) continue;
    var size = Math.round(28 * stats.sizeScale);
    // 多单位：同一种族占多个格子
    for (var u = 0; u < stats.unitCount; u++) {
      var slot = entry.slot + u; // 简单顺序偏移，最大不超过5
      if (slot > 5) break;
      slots.push({
        raceId: entry.raceId,
        slot: slot,
        hpMult: stats.hpMult,
        atkMult: stats.atkMult,
        sizeOverride: size,
        skillEnhancements: stats.skillEnhancements
      });
    }
  }
  return slots;
};

BattleScene.prototype.update = function(dt) {
  if (this._resultShown || this._showRevive) return;
  this.bm.update(dt);
  if (this.bm.state === 'win') {
    this._resultShown = true;
    var self = this;
    setTimeout(function() { self.onEnd('win', self.rewards); }, 1500);
  } else if (this.bm.state === 'lose') {
    if (this._canRevive) {
      // 特殊关：显示复活提示
      this._showRevive = true;
      this._canRevive = false;
    } else {
      this._resultShown = true;
      var self2 = this;
      setTimeout(function() { self2.onEnd('lose', {}); }, 1500);
    }
  }
};

BattleScene.prototype._doRevive = function() {
  // 复活：所有我方单位恢复50%血量，重启战斗
  this.bm.playerUnits.forEach(function(u) {
    u.dead = false;
    u.hp = Math.round(u.maxHp * 0.5);
    u.rage = 0;
  });
  this.bm.state = 'fighting';
  this._showRevive = false;
};

BattleScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;

  // 背景
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, w, h);

  // 分割线
  ctx.strokeStyle = '#334';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.5);
  ctx.lineTo(w * 0.9, h * 0.5);
  ctx.stroke();

  // 区域标签
  ctx.fillStyle = '#445';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('敌方', w / 2, h * 0.14);
  ctx.fillText('我方', w / 2, h * 0.88);

  // 绘制所有单位
  var units = this.bm.getAllUnits();
  for (var i = 0; i < units.length; i++) {
    this._drawUnit(units[i]);
  }

  // 飘字
  var floats = this.bm.floatTexts;
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // 顶部信息
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(this.levelName + '  ' + Math.ceil(this.bm.timeLimit - this.bm.elapsed) + 's', w / 2, 28);

  // 结果提示
  if (this.bm.state === 'win') {
    this._drawResult('胜利！', '#2ecc71');
  } else if (this.bm.state === 'lose' && !this._showRevive) {
    this._drawResult('失败...', '#e74c3c');
  }

  if (this._showRevive) this._drawRevivePanel();
};

BattleScene.prototype._drawUnit = function(u) {
  if (u.dead) return;
  var ctx = this.ctx;
  var r = u.size / 2;

  // 眩晕外圈
  if (u.stunTimer > 0) {
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(u.x, u.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 单位圆形色块
  ctx.fillStyle = u.color;
  ctx.beginPath();
  ctx.arc(u.x, u.y, r, 0, Math.PI * 2);
  ctx.fill();

  // 名称
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(u.name, u.x, u.y + 4);

  var barW = u.size + 10, barH = 5;
  var barX = u.x - barW / 2;

  // 血条
  var hpY = u.y + r + 4;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, hpY, barW, barH);
  var pct = u.hp / u.maxHp;
  ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(barX, hpY, barW * pct, barH);

  // 怒气条
  var rageY = hpY + barH + 2;
  ctx.fillStyle = '#222';
  ctx.fillRect(barX, rageY, barW, 3);
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(barX, rageY, barW * (u.rage / 100), 3);

  // 状态点（燃烧=红，流血=深红，减速=蓝）
  var dotX = barX;
  if (u.burnTimer > 0)  { ctx.fillStyle = '#e74c3c'; ctx.fillRect(dotX, rageY + 5, 5, 5); dotX += 7; }
  if (u.bleedTimer > 0) { ctx.fillStyle = '#922b21'; ctx.fillRect(dotX, rageY + 5, 5, 5); dotX += 7; }
  if (u.slowTimer > 0)  { ctx.fillStyle = '#3498db'; ctx.fillRect(dotX, rageY + 5, 5, 5); }
};

BattleScene.prototype._drawRevivePanel = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('特殊关卡！是否复活？', w/2, h*0.38);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  var remain = AdManager.remainCount('revive');
  ctx.fillText('观看广告复活（今日剩余' + remain + '次）', w/2, h*0.46);

  var bx = w/2-80, by = h*0.52;
  ctx.fillStyle = remain > 0 ? '#27ae60' : '#555';
  ctx.fillRect(bx, by, 160, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(remain > 0 ? '看广告复活' : '次数已用完', w/2, by+33);

  var bx2 = w/2-80, by2 = h*0.63;
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(bx2, by2, 160, 50);
  ctx.fillStyle = '#fff';
  ctx.fillText('放弃本关', w/2, by2+33);

  this._reviveBtn = { x: bx, y: by, w: 160, h: 50, canAd: remain > 0 };
  this._giveupBtn = { x: bx2, y: by2, w: 160, h: 50 };
};

BattleScene.prototype._drawResult = function(text, color) {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(w / 2 - 100, h / 2 - 35, 200, 60);
  ctx.fillStyle = color;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2 + 10);
};

BattleScene.prototype.onTouchStart = function(x, y) {
  if (this._showRevive) {
    var rb = this._reviveBtn, gb = this._giveupBtn;
    if (rb && rb.canAd && x >= rb.x && x <= rb.x+rb.w && y >= rb.y && y <= rb.y+rb.h) {
      var self3 = this;
      AdManager.show('revive', function() { self3._doRevive(); }, function() {});
    } else if (gb && x >= gb.x && x <= gb.x+gb.w && y >= gb.y && y <= gb.y+gb.h) {
      this._showRevive = false;
      this._resultShown = true;
      var self4 = this;
      setTimeout(function() { self4.onEnd('lose', {}); }, 800);
    }
  }
  return null;
};
BattleScene.prototype.onTouchMove = function(x, y) {};
BattleScene.prototype.onTouchEnd = function(x, y) {};

module.exports = { BattleScene: BattleScene };
