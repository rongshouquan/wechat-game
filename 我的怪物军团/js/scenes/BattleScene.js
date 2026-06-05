var BattleManager = require('../game/BattleManager').BattleManager;
var LEVELS = require('../data/levels').LEVELS;

var BattleScene = function(ctx, width, height, levelId, onEnd) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onEnd = onEnd || function() {};

  this.bm = new BattleManager(width, height);

  // 默认玩家阵容：哥布林前排0、狼人前排2、牛头怪前排1、骷髅法师后排3
  var playerSlots = [
    { raceId: 'goblin',      slot: 0 },
    { raceId: 'minotaur',    slot: 1 },
    { raceId: 'werewolf',    slot: 2 },
    { raceId: 'skeletonMage',slot: 3 }
  ];

  var levelCfg = LEVELS[(levelId || 1) - 1] || LEVELS[0];
  this.bm.setup(playerSlots, levelCfg.enemies);
  this.levelName = levelCfg.name;
  this._resultShown = false;
};

BattleScene.prototype.update = function(dt) {
  if (this._resultShown) return;
  this.bm.update(dt);
  if (this.bm.state === 'win' || this.bm.state === 'lose') {
    this._resultShown = true;
    var self = this;
    // 延迟1.5秒跳转结果页
    setTimeout(function() { self.onEnd(self.bm.state); }, 1500);
  }
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
  } else if (this.bm.state === 'lose') {
    this._drawResult('失败...', '#e74c3c');
  }
};

BattleScene.prototype._drawUnit = function(u) {
  if (u.dead) return;
  var ctx = this.ctx;
  var r = u.size / 2;

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

  // 血条背景
  var barW = u.size + 10, barH = 5;
  var barX = u.x - barW / 2, barY = u.y + r + 4;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);

  // 血条
  var pct = u.hp / u.maxHp;
  ctx.fillStyle = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(barX, barY, barW * pct, barH);
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

BattleScene.prototype.onTouchStart = function(x, y) { return null; };
BattleScene.prototype.onTouchMove = function(x, y) {};
BattleScene.prototype.onTouchEnd = function(x, y) {};

module.exports = { BattleScene: BattleScene };
