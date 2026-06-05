var ResultScene = function(ctx, width, height, result, levelId) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.result = result;  // 'win' | 'lose'
  this.levelId = levelId || 1;
  this._initButtons();
};

ResultScene.prototype._initButtons = function() {
  var w = this.width, h = this.height;
  this.buttons = [];
  if (this.result === 'win') {
    this.buttons.push({ label: '下一关', x: w/2-90, y: h*0.58, w: 180, h: 50, action: 'nextLevel' });
  } else {
    this.buttons.push({ label: '再来一次', x: w/2-90, y: h*0.58, w: 180, h: 50, action: 'retry' });
  }
  this.buttons.push({ label: '返回主菜单', x: w/2-90, y: h*0.68, w: 180, h: 50, action: 'backToMenu' });
};

ResultScene.prototype.update = function(dt) {};

ResultScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var isWin = this.result === 'win';

  ctx.fillStyle = isWin ? '#0d2a1a' : '#2a0d0d';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWin ? '胜利！' : '失败...', w/2, h*0.38);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px sans-serif';
  ctx.fillText('第' + this.levelId + '关', w/2, h*0.47);

  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    ctx.fillStyle = '#2c3e50';
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
