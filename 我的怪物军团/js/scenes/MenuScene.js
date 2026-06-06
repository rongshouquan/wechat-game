var PlayerData = require('../game/PlayerData').PlayerData;

var TAB_H = 64; // 底部导航栏高度

var MenuScene = function(ctx, width, height, offlineMsg) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.offlineMsg = offlineMsg || '';
  // 解锁动画状态（首次进入城堡时播放）
  this._unlockAnim = false;
  this._unlockTimer = 0;
  this._unlockStep  = 0; // 0=军团出现, 1=宝库出现, 2=完成
};

// 底部三个标签配置
MenuScene.TABS = [
  { label: '军团', action: 'openLegion',   color: '#16a085', icon: '⚔' },
  { label: '征战', action: 'startBattle',  color: '#c0392b', icon: '▶' },
  { label: '宝库', action: 'openTreasury', color: '#8e44ad', icon: '◆' },
];

MenuScene.prototype.startUnlockAnim = function() {
  this._unlockAnim  = true;
  this._unlockTimer = 0;
  this._unlockStep  = 0;
};

MenuScene.prototype._getTabs = function() {
  var d = PlayerData.get();
  var tabs = [];
  // 军团：解锁后显示（isNewPlayer=false 或 legionUnlocked）
  tabs.push({ idx: 0, unlocked: !d.isNewPlayer || d.legionUnlocked });
  // 征战：始终可见
  tabs.push({ idx: 1, unlocked: true });
  // 宝库：解锁后显示
  tabs.push({ idx: 2, unlocked: !d.isNewPlayer || d.treasuryUnlocked });
  return tabs;
};

MenuScene.prototype.update = function(dt) {
  if (this._unlockAnim) {
    this._unlockTimer += dt;
    if (this._unlockStep === 0 && this._unlockTimer > 0.4) this._unlockStep = 1;
    if (this._unlockStep === 1 && this._unlockTimer > 0.8) this._unlockStep = 2;
    if (this._unlockTimer > 1.2) this._unlockAnim = false;
  }
};

MenuScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var d = PlayerData.get();
  var navY = h - TAB_H;

  // 背景
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, h);

  // ── 顶部资源栏 ──
  var topH = 48;
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, w, topH);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('第 ' + (d.currentLevel||1) + ' 关', 16, 30);
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'right';
  ctx.font = '13px sans-serif';
  ctx.fillText('怪物王国', w - 16, 30);

  // ── 中央城堡区域 ──
  var castleY = topH + 10;
  var castleH = navY - castleY - 10;

  // 背景装饰
  ctx.fillStyle = '#1a2035';
  ctx.fillRect(w*0.10, castleY, w*0.80, castleH);

  // 标题
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('我的怪物军团', w/2, castleY + 44);

  // 副标题/关卡状态
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.fillText('当前进度：第 ' + (d.currentLevel||1) + ' 关', w/2, castleY + 68);

  // 王座（色块模拟）
  var cx = w/2, cy = castleY + castleH * 0.52;
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(cx-55, cy+22, 110, 28);
  ctx.fillRect(cx-40, cy+12, 80, 18);
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(cx-28, cy-58, 56, 78);
  ctx.fillStyle = '#e0b84b';
  ctx.fillRect(cx-28, cy-66, 56, 10);
  ctx.beginPath(); ctx.arc(cx, cy-72, 9, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(cx, cy-66, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(cx-48, cy-18, 18, 38);
  ctx.fillRect(cx+30, cy-18, 18, 38);

  // 离线收益提示
  if (this.offlineMsg) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(w/2-130, castleY+castleH-44, 260, 32);
    ctx.fillStyle = '#2ecc71';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.offlineMsg, w/2, castleY+castleH-22);
  }

  // ── 底部导航栏 ──
  this._drawBottomNav(navY);
};

MenuScene.prototype._drawBottomNav = function(navY) {
  var ctx = this.ctx, w = this.width;
  var tabs = MenuScene.TABS;
  var tabW = w / 3;
  var tabStates = this._getTabs();

  // 导航背景
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, navY, w, TAB_H);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, navY); ctx.lineTo(w, navY); ctx.stroke();

  for (var i = 0; i < 3; i++) {
    var tab = tabs[i];
    var state = tabStates[i];
    var tx = i * tabW;
    var cx = tx + tabW / 2;
    var cy = navY + TAB_H / 2;

    // 解锁动画：军团(i=0)和宝库(i=2)用淡入
    var alpha = 1;
    if (this._unlockAnim) {
      if (i === 0 && this._unlockStep < 1) alpha = this._unlockTimer / 0.4;
      if (i === 2 && this._unlockStep < 2) alpha = (this._unlockTimer - 0.4) / 0.4;
      if (alpha < 0) alpha = 0;
      if (alpha > 1) alpha = 1;
    }

    if (!state.unlocked) {
      // 锁定状态：灰色
      ctx.fillStyle = 'rgba(80,80,80,' + alpha + ')';
      ctx.fillRect(tx, navY, tabW, TAB_H);
      ctx.fillStyle = 'rgba(100,100,100,' + alpha + ')';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', cx, cy - 4);
      ctx.fillText(tab.label, cx, cy + 14);
      continue;
    }

    // 征战按钮特殊高亮
    if (i === 1) {
      ctx.fillStyle = 'rgba(192,57,43,' + alpha + ')';
      ctx.fillRect(tx, navY, tabW, TAB_H);
    }

    // 图标
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tab.icon, cx, cy - 2);

    // 文字
    ctx.fillStyle = i === 1 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(200,200,200,' + alpha + ')';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(tab.label, cx, cy + 18);

    // 分隔线
    if (i < 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx + tabW, navY + 8); ctx.lineTo(tx + tabW, navY + TAB_H - 8); ctx.stroke();
    }
  }
};

MenuScene.prototype.onTouchStart = function(x, y) {
  var w = this.width, h = this.height;
  var navY = h - TAB_H;
  // 点击底部导航
  if (y >= navY) {
    var tabW = w / 3;
    var idx = Math.floor(x / tabW);
    var tabStates = this._getTabs();
    if (idx >= 0 && idx <= 2 && tabStates[idx].unlocked) {
      return MenuScene.TABS[idx].action;
    }
  }
  return null;
};
MenuScene.prototype.onTouchMove = function() {};
MenuScene.prototype.onTouchEnd = function() {};

module.exports = { MenuScene: MenuScene };
