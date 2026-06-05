var MenuScene = function(ctx, width, height) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.buttons = [];
  this._initButtons();
};

MenuScene.prototype._initButtons = function() {
  var w = this.width, h = this.height;
  this.buttons = [
    { label: '开始战斗', x: w/2-100, y: h*0.52, w: 200, h: 55, action: 'startBattle', color: '#e74c3c' },
    { label: '宝物装备', x: w/2-100, y: h*0.63, w: 200, h: 50, action: 'openItems',   color: '#8e44ad' }
  ];
};

MenuScene.prototype.update = function(dt) {};

MenuScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;

  // 背景
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('我的怪物军团', w / 2, h * 0.3);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px sans-serif';
  ctx.fillText('放置养成 · 自动战斗', w / 2, h * 0.38);

  // 按钮
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    ctx.fillStyle = btn.color || '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 8);
  }
};

MenuScene.prototype.onTouchStart = function(x, y) {
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      return btn.action;
    }
  }
  return null;
};

MenuScene.prototype.onTouchMove = function(x, y) {};
MenuScene.prototype.onTouchEnd = function(x, y) {};

module.exports = { MenuScene: MenuScene };
