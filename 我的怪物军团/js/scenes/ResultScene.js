var PlayerData = require('../game/PlayerData').PlayerData;

var ResultScene = function(ctx, width, height, result, levelId, rewards) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.result = result;
  this.levelId = levelId || 1;
  this.rewards = rewards || {};
  this._initButtons();

  // 胜利时发放奖励
  if (result === 'win' && rewards.researchPoints) {
    PlayerData.addResearchPoints(rewards.researchPoints);
    PlayerData.save();
  }
};

ResultScene.prototype._initButtons = function() {
  var w = this.width, h = this.height;
  this.buttons = [];
  if (this.result === 'win') {
    this.buttons.push({ label: '下一关', x: w/2-90, y: h*0.65, w: 180, h: 50, action: 'nextLevel', color: '#27ae60' });
  } else {
    this.buttons.push({ label: '再来一次', x: w/2-90, y: h*0.65, w: 180, h: 50, action: 'retry', color: '#c0392b' });
  }
  this.buttons.push({ label: '返回主菜单', x: w/2-90, y: h*0.75, w: 180, h: 50, action: 'backToMenu', color: '#2c3e50' });
};

ResultScene.prototype.update = function(dt) {};

ResultScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var isWin = this.result === 'win';

  ctx.fillStyle = isWin ? '#0d2a1a' : '#2a0d0d';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWin ? '胜利！' : '失败...', w/2, h*0.32);

  // 关卡名
  ctx.fillStyle = '#bbb';
  ctx.font = '18px sans-serif';
  ctx.fillText('第' + this.levelId + '关', w/2, h*0.42);

  // 奖励展示（胜利时）
  if (isWin && this.rewards.researchPoints) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = '16px sans-serif';
    ctx.fillText('研究点 +' + this.rewards.researchPoints, w/2, h*0.5);
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('当前研究点：' + PlayerData.get().researchPoints, w/2, h*0.56);
  }

  // 按钮
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    ctx.fillStyle = btn.color || '#2c3e50';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 7);
  }
};

ResultScene.prototype.onTouchStart = function(x, y) {
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    if (x >= btn.x && x <= btn.x+btn.w && y >= btn.y && y <= btn.y+btn.h) return btn.action;
  }
  return null;
};
ResultScene.prototype.onTouchMove = function() {};
ResultScene.prototype.onTouchEnd = function() {};

module.exports = { ResultScene: ResultScene };
