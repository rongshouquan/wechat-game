var PlayerData = require('../game/PlayerData').PlayerData;

var MenuScene = function(ctx, width, height, offlineMsg) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.offlineMsg = offlineMsg || '';
  this.buttons = [];
  this._initButtons();
};

MenuScene.prototype._initButtons = function() {
  var w = this.width, h = this.height;
  this.buttons = [
    { label: '开始战斗', x: w/2-100, y: h*0.40, w: 200, h: 46, action: 'startBattle',  color: '#e74c3c' },
    { label: '阵容编排', x: w/2-100, y: h*0.48, w: 200, h: 42, action: 'openLineup',   color: '#16a085' },
    { label: '宝物装备', x: w/2-100, y: h*0.55, w: 200, h: 42, action: 'openItems',    color: '#8e44ad' },
    { label: '研究所',   x: w/2-100, y: h*0.62, w: 200, h: 42, action: 'openResearch', color: '#2980b9' },
    { label: '商店',     x: w/2-100, y: h*0.69, w: 200, h: 42, action: 'openShop',     color: '#e67e22' }
  ];
  // 第30关后显示爬塔
  if ((PlayerData.get().currentLevel || 1) > 30) {
    this.buttons.push({ label: '爬　塔', x: w/2-100, y: h*0.76, w: 200, h: 42, action: 'openTower', color: '#c0392b' });
  }
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

  // 离线收益提示
  if (this.offlineMsg) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = '15px sans-serif';
    ctx.fillText(this.offlineMsg, w / 2, h * 0.44);
  }

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
