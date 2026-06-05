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
  var d = PlayerData.get();
  this.buttons = [];

  // 左侧：种族/阵容
  this.buttons.push({ label: '种族\n管理', x: 16, y: h*0.32, w: w*0.20, h: h*0.22, action: 'openRaces', color: '#16a085', multi: true });

  // 右侧：宝物
  this.buttons.push({ label: '宝物\n装备', x: w - 16 - w*0.20, y: h*0.32, w: w*0.20, h: h*0.22, action: 'openItems', color: '#8e44ad', multi: true });

  // 底部中央：推图（最大）
  this.buttons.push({ label: '推  图', x: w/2-80, y: h*0.75, w: 160, h: 58, action: 'startBattle', color: '#c0392b', large: true });

  // 底部左：研究所
  this.buttons.push({ label: '研究所', x: 16, y: h*0.75, w: w*0.26, h: 52, action: 'openResearch', color: '#2471a3' });

  // 底部右：商店
  this.buttons.push({ label: '商  店', x: w - 16 - w*0.26, y: h*0.75, w: w*0.26, h: 52, action: 'openShop', color: '#d68910' });

  // 爬塔（右下角，30关后显示）
  if ((d.currentLevel || 1) > 30) {
    this.buttons.push({ label: '塔', x: w - 58, y: h*0.86, w: 50, h: 50, action: 'openTower', color: '#7d3c98', corner: true });
  }
};

MenuScene.prototype.update = function(dt) {};

MenuScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var d = PlayerData.get();

  // 背景
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, h);

  // ── 顶部资源栏 ──
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, w, h*0.10);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('第 ' + (d.currentLevel||1) + ' 关', 16, h*0.065);
  ctx.fillStyle = '#5dade2';
  ctx.textAlign = 'center';
  ctx.fillText('研究点 ' + (d.researchPoints||0), w/2, h*0.065);
  ctx.fillStyle = '#f39c12';
  ctx.textAlign = 'right';
  ctx.fillText('荣誉 ' + (d.honorPoints||0), w - 16, h*0.065);

  // ── 中央王座区域 ──
  var throneY = h * 0.12, throneH = h * 0.58;

  // 装饰背景光晕（纯色块，避免shadowBlur）
  ctx.fillStyle = '#1a2035';
  ctx.fillRect(w*0.18, throneY, w*0.64, throneH);

  // 标题
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('我的怪物军团', w/2, throneY + h*0.07);

  // 王座装饰（色块模拟）
  var cx = w/2, cy = throneY + throneH*0.45;
  // 底座
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(cx-55, cy+20, 110, 30);
  ctx.fillRect(cx-40, cy+10, 80, 20);
  // 椅背
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(cx-30, cy-60, 60, 80);
  // 椅顶装饰
  ctx.fillStyle = '#e0b84b';
  ctx.fillRect(cx-30, cy-68, 60, 10);
  ctx.beginPath();
  ctx.arc(cx, cy-74, 10, 0, Math.PI*2);
  ctx.fill();
  // 宝石
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(cx, cy-68, 5, 0, Math.PI*2);
  ctx.fill();
  // 扶手
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(cx-50, cy-20, 18, 40);
  ctx.fillRect(cx+32, cy-20, 18, 40);

  // 离线收益提示
  if (this.offlineMsg) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(w/2-120, throneY+throneH-40, 240, 32);
    ctx.fillStyle = '#f1c40f';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.offlineMsg, w/2, throneY+throneH-18);
  }

  // ── 绘制所有按钮 ──
  for (var i = 0; i < this.buttons.length; i++) {
    this._drawBtn(this.buttons[i]);
  }
};

MenuScene.prototype._drawBtn = function(btn) {
  var ctx = this.ctx;

  ctx.fillStyle = btn.color || '#444';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

  // 高亮边框
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';

  if (btn.multi) {
    // 两行文字
    var lines = btn.label.split('\n');
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(lines[0], btn.x + btn.w/2, btn.y + btn.h/2 - 6);
    ctx.fillText(lines[1], btn.x + btn.w/2, btn.y + btn.h/2 + 14);
  } else if (btn.large) {
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 8);
  } else if (btn.corner) {
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('爬塔', btn.x + btn.w/2, btn.y + btn.h/2 + 5);
  } else {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 6);
  }
};

MenuScene.prototype.onTouchStart = function(x, y) {
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    if (x >= btn.x && x <= btn.x+btn.w && y >= btn.y && y <= btn.y+btn.h) return btn.action;
  }
  return null;
};
MenuScene.prototype.onTouchMove = function() {};
MenuScene.prototype.onTouchEnd = function() {};

module.exports = { MenuScene: MenuScene };
