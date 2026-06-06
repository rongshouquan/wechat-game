var BattleManager  = require('../game/BattleManager').BattleManager;
var LEVELS         = require('../data/levels').LEVELS;
var RACES          = require('../data/races').RACES;
var PlayerData     = require('../game/PlayerData').PlayerData;
var getRaceStats   = require('../game/RaceLevel').getRaceStats;
var AdManager      = require('../game/AdManager').AdManager;
var ImageCache     = require('../utils/ImageCache').ImageCache;
var TutorialFlow   = require('../game/TutorialFlow').TutorialFlow;

// ── 布局常量 ──
var L = {
  topBarH:     56,
  bottomH:     0.12,        // 底栏占屏高比例
  cellW:       0.28,
  cellH:       0.088,
  colX:        [0.17, 0.50, 0.83],
  enemyRows:   [0.215, 0.355],
  playerRows:  [0.565, 0.685],
  enemyLabelY: 0.12,
  zoneLabelY:  0.46,
};

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// ═══════════════════════════════════════════
//  BattleScene
// ═══════════════════════════════════════════
var BattleScene = function(ctx, width, height, levelId, onEnd) {
  this.ctx    = ctx;
  this.width  = width;
  this.height = height;
  this.onEnd  = onEnd || function() {};

  // 阶段：'preBattle' | 'battle'
  this._phase = 'preBattle';

  // 关卡配置
  this._levelId  = levelId || 1;
  var cfg = LEVELS[(this._levelId) - 1] || LEVELS[0];
  this._levelCfg  = cfg;
  this.levelName  = cfg.name;
  this.rewards    = cfg.rewards || { researchPoints: 10 };
  this.isSpecial  = cfg.isSpecial || false;

  // 备战阵容（slot 0-5）：{ raceId, slot }[]，最多4条
  var saved = PlayerData.get().lineup || [];
  this._pbLineup = saved.slice(0, 4);

  // 拖拽状态
  this._drag = null; // { raceId, x, y, fromSlot: -1 or slot index }

  // 教程状态（内部管理）
  // tutorState: '' | 'dialog' | 'place' | 'ready'
  this._tutorActive = TutorialFlow.isActive() && this._levelId === 1;
  this._tutorState  = this._tutorActive ? 'dialog' : '';
  this._tutorDialogText = '上吧，小的们，为了怪物王国！';

  // 教程限制钩子（供 draw 使用）
  this.tutorAllowedSlot   = this._tutorActive ? 5 : -1;
  this.tutorHighlightSlot = this._tutorActive ? 5 : -1;
  this.tutorShowDragHint  = false;
  this.tutorDragHintTimer = 0;
  this.tutorLockStart     = this._tutorActive ? true : false;

  // 战斗阶段状态
  this.bm = new BattleManager(width, height);
  this._speed = 1;
  this._paused = false;
  this._resultShown = false;
  this._showRevive  = false;
  this._canRevive   = this.isSpecial;
};

// ── 备战：格子像素坐标 ──
BattleScene.prototype._slotCenter = function(slot) {
  var w = this.width, h = this.height;
  var row = Math.floor(slot / 3), col = slot % 3;
  var rows = [h * L.playerRows[0], h * L.playerRows[1]];
  return { x: w * L.colX[col], y: rows[row] };
};

BattleScene.prototype._slotAtPoint = function(px, py) {
  var w = this.width, h = this.height;
  var cw = w * L.cellW, ch = h * L.cellH;
  var rows = [h * L.playerRows[0], h * L.playerRows[1]];
  var cols = [w * L.colX[0], w * L.colX[1], w * L.colX[2]];
  for (var r = 0; r < 2; r++) {
    for (var c = 0; c < 3; c++) {
      var cx = cols[c], cy = rows[r];
      if (px >= cx - cw/2 && px <= cx + cw/2 && py >= cy - ch/2 && py <= cy + ch/2) {
        return r * 3 + c;
      }
    }
  }
  return -1;
};

// ── 备战：底部种族选取栏 ──
BattleScene.prototype._getRaceBar = function() {
  var d = PlayerData.get();
  var races = d.unlockedRaces || ['goblin'];
  var w = this.width, h = this.height;
  var barY = h * (1 - L.bottomH);
  var iconSize = Math.min(56, (w - 16) / races.length);
  var totalW = iconSize * races.length;
  var startX = (w - totalW) / 2;
  var items = [];
  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId] || {};
    items.push({
      raceId: raceId,
      name:   race.name || raceId,
      color:  race.color || '#888',
      image:  race.image || null,
      x: startX + i * iconSize,
      y: barY + 4,
      w: iconSize - 4,
      h: h * L.bottomH - 12,
    });
  }
  return items;
};

// ── 备战：开始战斗 ──
BattleScene.prototype._startBattle = function() {
  // 保存阵容
  var d = PlayerData.get();
  d.lineup = this._pbLineup.slice();
  PlayerData.save();

  // 构建玩家单位
  var playerSlots = [];
  for (var i = 0; i < this._pbLineup.length; i++) {
    var entry = this._pbLineup[i];
    var level = d.raceLevels[entry.raceId] || 1;
    var stats = getRaceStats(entry.raceId, level);
    if (!stats) continue;
    var size = Math.round(28 * stats.sizeScale);
    playerSlots.push({
      raceId: entry.raceId,
      slot:   entry.slot,
      hpMult: stats.hpMult,
      atkMult: stats.atkMult,
      sizeOverride: size,
      skillEnhancements: stats.skillEnhancements,
    });
  }
  if (playerSlots.length === 0) {
    playerSlots = [{ raceId: 'goblin', slot: 1, hpMult: 1, atkMult: 1, sizeOverride: 28, skillEnhancements: {} }];
  }
  this.bm.setup(playerSlots, this._levelCfg.enemies);
  this._phase = 'battle';
  if (this._tutorActive) TutorialFlow.setStep(3);
};

// ════════════════════════════════════════
//  update
// ════════════════════════════════════════
BattleScene.prototype.update = function(dt) {
  if (this._phase === 'preBattle') {
    if (this.tutorShowDragHint) this.tutorDragHintTimer += dt;
    // dialog 阶段不做任何事
    if (this._tutorState === 'dialog') return;
    // place 阶段：检查是否已放置在 slot 5
    if (this._tutorState === 'place') {
      var hasSlot5 = false;
      for (var i = 0; i < this._pbLineup.length; i++) {
        if (this._pbLineup[i].slot === 5) { hasSlot5 = true; break; }
      }
      if (hasSlot5) {
        this._tutorState = 'ready';
        this.tutorShowDragHint = false;
        this.tutorLockStart = false;
        TutorialFlow.setStep(2);
      }
    }
    return;
  }
  // battle
  if (this._resultShown || this._showRevive || this._paused) return;
  this.bm.update(dt * this._speed);
  if (this.bm.state === 'win') {
    this._resultShown = true;
    var self = this;
    setTimeout(function() { self.onEnd('win', self.rewards); }, 1500);
  } else if (this.bm.state === 'lose') {
    if (this._canRevive) {
      this._showRevive = true;
      this._canRevive  = false;
    } else {
      this._resultShown = true;
      var self2 = this;
      setTimeout(function() { self2.onEnd('lose', {}); }, 1500);
    }
  }
};

// ════════════════════════════════════════
//  draw
// ════════════════════════════════════════
BattleScene.prototype.draw = function() {
  this._drawBackground();
  this._drawGrid();
  this._drawZoneLabels();

  if (this._phase === 'preBattle') {
    this._drawPreBattleEnemies();
    this._drawPreBattlePlaced();
    this._drawPreBattleTopBar();
    this._drawPreBattleBottom();
    this._drawPreBattleStartBtn();
    if (this._drag) this._drawDragGhost();
    if (this.tutorShowDragHint) this._drawDragHint();
    // 教程对话框（最顶层）
    if (this._tutorState === 'dialog') this._drawTutorDialog();
    // ready 阶段：指引点开始
    if (this._tutorState === 'ready') this._drawStartHint();
  } else {
    this._drawUnits();
    this._drawFloats();
    this._drawTopBar();
    this._drawBattleBottom();
    if (this.bm.state === 'win') this._drawResult('胜利！', '#2ecc71');
    else if (this.bm.state === 'lose' && !this._showRevive) this._drawResult('失败...', '#e74c3c');
    if (this._showRevive) this._drawRevivePanel();
  }
};

// ── 背景 ──
BattleScene.prototype._drawBackground = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var bg = ImageCache.get('assets/backgrounds/battle_field.png');
  if (bg) {
    ctx.drawImage(bg, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#0d1520'; ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h*0.40); ctx.lineTo(w, h*0.40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h*0.51); ctx.lineTo(w, h*0.51); ctx.stroke();
};

// ── 格子（备战/战斗通用）──
BattleScene.prototype._drawGrid = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var cw = w * L.cellW, ch = h * L.cellH, cr = ch * 0.42;
  var cols  = [w*L.colX[0], w*L.colX[1], w*L.colX[2]];
  var eRows = [h*L.enemyRows[0], h*L.enemyRows[1]];
  var pRows = [h*L.playerRows[0], h*L.playerRows[1]];

  // 敌方格子（空位才画轮廓）
  var eOcc = {};
  if (this._phase === 'preBattle') {
    for (var ei = 0; ei < this._levelCfg.enemies.length; ei++) {
      var ec = this._levelCfg.enemies[ei];
      for (var ep = 0; ep < (ec.positions || []).length; ep++) eOcc[ec.positions[ep]] = true;
    }
  } else {
    for (var bi = 0; bi < this.bm.enemyUnits.length; bi++) eOcc[this.bm.enemyUnits[bi].slot] = true;
  }
  for (var er = 0; er < 2; er++) {
    for (var ec2 = 0; ec2 < 3; ec2++) {
      if (!eOcc[er*3+ec2]) {
        roundRect(ctx, cols[ec2]-cw/2, eRows[er]-ch/2, cw, ch, cr);
        ctx.strokeStyle = 'rgba(200,100,100,0.08)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }

  // 我方格子
  var pOcc = {};
  if (this._phase === 'preBattle') {
    for (var pi = 0; pi < this._pbLineup.length; pi++) pOcc[this._pbLineup[pi].slot] = true;
  } else {
    for (var bj = 0; bj < this.bm.playerUnits.length; bj++) pOcc[this.bm.playerUnits[bj].slot] = true;
  }
  for (var pr = 0; pr < 2; pr++) {
    for (var pc = 0; pc < 3; pc++) {
      var slot = pr*3+pc;
      var isEmpty = !pOcc[slot];
      var isHigh = this.tutorHighlightSlot === slot;
      roundRect(ctx, cols[pc]-cw/2, pRows[pr]-ch/2, cw, ch, cr);
      if (isEmpty) {
        if (this._phase === 'preBattle') {
          ctx.strokeStyle = isHigh ? 'rgba(80,180,255,0.7)' : 'rgba(100,150,255,0.18)';
          ctx.lineWidth = isHigh ? 2 : 1;
        } else {
          ctx.strokeStyle = 'rgba(100,150,255,0.08)'; ctx.lineWidth = 1;
        }
        ctx.stroke();
        // 高亮脉冲填充
        if (isHigh && this._phase === 'preBattle') {
          ctx.fillStyle = 'rgba(80,150,255,0.08)'; ctx.fill();
        }
      }
    }
  }
};

// ── 区域标签 ──
BattleScene.prototype._drawZoneLabels = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.textAlign = 'center';
  var ey = h * L.enemyLabelY;
  ctx.strokeStyle = 'rgba(160,30,30,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.06, ey-3); ctx.lineTo(w*0.28, ey-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.72, ey-3); ctx.lineTo(w*0.94, ey-3); ctx.stroke();
  ctx.fillStyle = 'rgba(200,50,50,0.9)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('- 敌方区域 -', w/2, ey);
  var my = h * L.zoneLabelY;
  ctx.strokeStyle = 'rgba(120,120,160,0.30)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.06, my); ctx.lineTo(w*0.38, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.62, my); ctx.lineTo(w*0.94, my); ctx.stroke();
  ctx.fillStyle = 'rgba(140,140,170,0.55)';
  ctx.font = '11px sans-serif';
  ctx.fillText('— 战斗区域 —', w/2, my+4);
};

// ════ 备战阶段绘制 ════

// 敌方单位（备战时静态展示）
BattleScene.prototype._drawPreBattleEnemies = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var cols  = [w*L.colX[0], w*L.colX[1], w*L.colX[2]];
  var eRows = [h*L.enemyRows[0], h*L.enemyRows[1]];
  var enemies = this._levelCfg.enemies;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    var race = RACES[e.raceId] || {};
    var imgH = h * 0.12, imgW = imgH * 0.78;
    for (var j = 0; j < (e.positions || []).length; j++) {
      var slot = e.positions[j];
      var row = Math.floor(slot / 3), col = slot % 3;
      var cx = cols[col], cy = eRows[row];
      var portrait = race.image ? ImageCache.get(race.image) : null;
      if (portrait) {
        ctx.save();
        ctx.scale(1, -1); // 敌方立绘翻转
        ctx.drawImage(portrait, cx - imgW/2, -cy - imgH*0.12, imgW, imgH);
        ctx.restore();
      } else {
        ctx.fillStyle = race.color || '#c0392b';
        ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI*2); ctx.fill();
      }
      // 名字标签
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cx-22, cy+14, 44, 16);
      ctx.fillStyle = '#eee'; ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(race.name || e.raceId, cx, cy+25);
    }
  }
};

// 我方已放置种族
BattleScene.prototype._drawPreBattlePlaced = function() {
  var ctx = this.ctx, h = this.height;
  var imgH = h * 0.12, imgW = imgH * 0.78;
  for (var i = 0; i < this._pbLineup.length; i++) {
    var entry = this._pbLineup[i];
    var pos = this._slotCenter(entry.slot);
    var race = RACES[entry.raceId] || {};
    var portrait = race.image ? ImageCache.get(race.image) : null;
    if (portrait) {
      ctx.drawImage(portrait, pos.x - imgW/2, pos.y - imgH*0.88, imgW, imgH);
    } else {
      ctx.fillStyle = race.color || '#3498db';
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 18, 0, Math.PI*2); ctx.fill();
    }
    // 种族名
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(pos.x-24, pos.y+14, 48, 16);
    ctx.fillStyle = '#aef'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(race.name || entry.raceId, pos.x, pos.y+25);
  }
};

// 备战顶栏
BattleScene.prototype._drawPreBattleTopBar = function() {
  var ctx = this.ctx, w = this.width;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, L.topBarH);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, L.topBarH); ctx.lineTo(w, L.topBarH); ctx.stroke();
  ctx.fillStyle = '#e0b84b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(this.levelName, 14, 26);
  ctx.fillStyle = '#888'; ctx.font = '12px sans-serif';
  ctx.fillText('选择种族拖到我方阵地', 14, 46);
  // 返回按钮
  ctx.fillStyle = '#333';
  roundRect(ctx, w-70, 12, 56, 32, 8); ctx.fill();
  ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('返回', w-42, 32);
  this._backBtn = { x: w-70, y: 12, w: 56, h: 32 };
};

// 备战底部种族栏
BattleScene.prototype._drawPreBattleBottom = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var barY = h * (1 - L.bottomH);
  var barH = h * L.bottomH;
  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  ctx.fillRect(0, barY, w, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(w, barY); ctx.stroke();

  var items = this._getRaceBar();
  this._raceBarItems = items;
  var imgH = barH - 20, imgW = imgH * 0.78;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var cy = barY + barH/2;
    var cx = it.x + it.w/2;
    // 检查是否已在阵容中
    var inLineup = false;
    for (var j = 0; j < this._pbLineup.length; j++) {
      if (this._pbLineup[j].raceId === it.raceId) { inLineup = true; break; }
    }
    ctx.globalAlpha = inLineup ? 0.4 : 1.0;
    var portrait = it.image ? ImageCache.get(it.image) : null;
    if (portrait) {
      ctx.drawImage(portrait, cx - imgW/2, cy - imgH/2, imgW, imgH);
    } else {
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(cx, cy - 6, 18, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = inLineup ? '#666' : '#ddd';
    ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(it.name, cx, barY + barH - 4);
  }
};

// 开始战斗按钮
BattleScene.prototype._drawPreBattleStartBtn = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var hasLineup = this._pbLineup.length > 0;
  var locked = this.tutorLockStart && !hasLineup;
  var bw = 160, bh = 48;
  var bx = w/2 - bw/2, by = h * (1 - L.bottomH) - bh - 10;

  roundRect(ctx, bx, by, bw, bh, 12);
  ctx.fillStyle = hasLineup ? '#c0392b' : '#333';
  ctx.fill();
  ctx.strokeStyle = hasLineup ? '#e74c3c' : '#444'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = hasLineup ? '#fff' : '#666';
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始战斗', w/2, by + bh/2);
  ctx.textBaseline = 'alphabetic';
  this._startBtn = { x: bx, y: by, w: bw, h: bh, active: hasLineup };
};

// 拖拽幽灵
BattleScene.prototype._drawDragGhost = function() {
  var ctx = this.ctx;
  var drag = this._drag;
  var race = RACES[drag.raceId] || {};
  var imgH = 60, imgW = imgH * 0.78;
  var portrait = race.image ? ImageCache.get(race.image) : null;
  ctx.globalAlpha = 0.8;
  if (portrait) {
    ctx.drawImage(portrait, drag.x - imgW/2, drag.y - imgH, imgW, imgH);
  } else {
    ctx.fillStyle = race.color || '#3498db';
    ctx.beginPath(); ctx.arc(drag.x, drag.y, 22, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// 教程拖拽提示动画（循环从底部图标飘向高亮格）
BattleScene.prototype._drawDragHint = function() {
  if (this.tutorHighlightSlot < 0) return;
  var ctx = this.ctx, h = this.height;
  var items = this._raceBarItems;
  if (!items || items.length === 0) return;
  var src = { x: items[0].x + items[0].w/2, y: h * (1 - L.bottomH) + h * L.bottomH/2 };
  var dst = this._slotCenter(this.tutorHighlightSlot);
  var t = (this.tutorDragHintTimer % 1.2) / 1.2;
  var hx = src.x + (dst.x - src.x) * t;
  var hy = src.y + (dst.y - src.y) * t;
  ctx.globalAlpha = 0.7 * (1 - Math.abs(t - 0.5) * 2);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
};

// 教程对话框
BattleScene.prototype._drawTutorDialog = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  // 半透明遮罩（让玩家聚焦对话框）
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
  TutorialFlow.drawDialog(ctx, w, h, '怪物领主', this._tutorDialogText);
};

// ready 状态：指引点开始战斗
BattleScene.prototype._drawStartHint = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  // 开始按钮上方的提示箭头
  var btn = this._startBtn;
  if (!btn) return;
  TutorialFlow.drawArrow(ctx, w/2, btn.y - 18);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('点击开始战斗！', w/2, btn.y - 28);
};

// ════ 战斗阶段绘制 ════

BattleScene.prototype._drawUnits = function() {
  var units = this.bm.getAllUnits().slice().sort(function(a, b) { return a.y - b.y; });
  for (var i = 0; i < units.length; i++) {
    if (!units[i].dead) this._drawUnit(units[i]);
  }
};

BattleScene.prototype._drawUnit = function(u) {
  var ctx = this.ctx;
  var imgH = this.height * 0.14, imgW = imgH * 0.78;
  var imgTop = u.y - imgH * 0.88;
  var portrait = u.image ? ImageCache.get(u.image) : null;
  if (portrait) {
    ctx.drawImage(portrait, u.x - imgW/2, imgTop, imgW, imgH);
  } else {
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.size/2, 0, Math.PI*2); ctx.fill();
  }
  var barW = imgW * 0.85, barH = 5;
  var barX = u.x - barW/2, barY = imgTop - barH - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(barX-1, barY-1, barW+2, barH+2);
  var pct = u.hp / u.maxHp;
  ctx.fillStyle = pct > 0.5 ? '#e74c3c' : pct > 0.25 ? '#e67e22' : '#c0392b';
  ctx.fillRect(barX, barY, barW * pct, barH);
  if (u.shield > 0) {
    ctx.strokeStyle = '#1abc9c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(u.x, u.y, imgW*0.5, 0, Math.PI*2); ctx.stroke();
  }
  if (u.stunTimer > 0) {
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('★', u.x, barY-4);
  }
  var dotX = barX + barW + 3, dotY = barY;
  if (u.burnTimer  > 0) { ctx.fillStyle = '#e74c3c'; ctx.fillRect(dotX, dotY, 4, 4); dotY += 5; }
  if (u.bleedTimer > 0) { ctx.fillStyle = '#922b21'; ctx.fillRect(dotX, dotY, 4, 4); dotY += 5; }
  if (u.slowTimer  > 0) { ctx.fillStyle = '#3498db'; ctx.fillRect(dotX, dotY, 4, 4); }
};

BattleScene.prototype._drawFloats = function() {
  var ctx = this.ctx, floats = this.bm.floatTexts;
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
};

BattleScene.prototype._drawTopBar = function() {
  var ctx = this.ctx, w = this.width;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, w, L.topBarH);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, L.topBarH); ctx.lineTo(w, L.topBarH); ctx.stroke();
  ctx.fillStyle = '#e0b84b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(this.levelName, 14, 26);
  var remain = Math.max(0, Math.ceil(this.bm.timeLimit - this.bm.elapsed));
  ctx.fillStyle = remain < 30 ? '#e74c3c' : '#8899aa';
  ctx.font = '12px sans-serif'; ctx.fillText('剩余: ' + remain + 's', 14, 46);
  var spX = w-104, spY = 28;
  ctx.fillStyle = this._speed === 2 ? '#c48a00' : '#1e2c44';
  ctx.beginPath(); ctx.arc(spX, spY, 22, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = this._speed === 2 ? '#f1c40f' : '#334'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(this._speed === 2 ? 'x2' : 'x1', spX, spY);
  this._speedBtn = { x: spX-22, y: spY-22, w: 44, h: 44 };
  var paX = w-50, paY = 28;
  ctx.fillStyle = this._paused ? '#6b0000' : '#1e2c44';
  ctx.beginPath(); ctx.arc(paX, paY, 22, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#334'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = this._paused ? 'bold 14px sans-serif' : '12px sans-serif';
  ctx.fillText(this._paused ? '▶' : '||', paX, paY);
  this._pauseBtn = { x: paX-22, y: paY-22, w: 44, h: 44 };
  ctx.textBaseline = 'alphabetic';
};

BattleScene.prototype._drawBattleBottom = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var barY = h * (1 - L.bottomH), barH = h * L.bottomH;
  var midY = barY + barH / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, barY, w, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(w, barY); ctx.stroke();
  var units = this.bm.playerUnits;
  if (units.length === 0) return;
  var pad = 8, areaW = w - pad*2, unitW = areaW / units.length;
  var rbH = barH * 0.24, dotY = barY + barH*0.30, rbY = barY + barH*0.58, labelY = rbY + rbH + 9;
  for (var i = 0; i < units.length; i++) {
    var u = units[i], ux = pad + i * unitW, ucx = ux + unitW/2;
    var full = !u.dead && u.rage >= 100;
    ctx.fillStyle = u.dead ? '#333' : u.color; ctx.globalAlpha = u.dead ? 0.3 : 1;
    ctx.beginPath(); ctx.arc(ucx-14, dotY, 5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = u.dead ? '#444' : '#bbb'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(u.name.charAt(0), ucx-7, dotY);
    var rbX = ux+4, rbW = unitW-8;
    roundRect(ctx, rbX, rbY, rbW, rbH, rbH/2);
    ctx.fillStyle = '#0e0e0e'; ctx.fill();
    if (!u.dead && u.rage > 0) {
      roundRect(ctx, rbX, rbY, rbW*(u.rage/100), rbH, rbH/2);
      ctx.fillStyle = full ? '#ff8800' : '#7a3a00'; ctx.fill();
    }
    if (full) {
      roundRect(ctx, rbX-1, rbY-1, rbW+2, rbH+2, rbH/2+1);
      ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('技能！', ucx, dotY-7);
    }
    if (!u.dead) {
      ctx.fillStyle = full ? '#ffaa00' : '#666'; ctx.font = '8px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(Math.round(u.rage)+'%', ucx, labelY);
    }
  }
  ctx.textBaseline = 'alphabetic';
};

BattleScene.prototype._drawResult = function(text, color) {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  roundRect(ctx, w/2-120, h/2-45, 240, 74, 16); ctx.fill();
  ctx.fillStyle = color; ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w/2, h/2);
  ctx.textBaseline = 'alphabetic';
};

BattleScene.prototype._drawRevivePanel = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('特殊关卡！是否复活？', w/2, h*0.37);
  var remain = AdManager.remainCount('revive');
  ctx.fillStyle = '#999'; ctx.font = '13px sans-serif';
  ctx.fillText('观看广告复活（今日剩余'+remain+'次）', w/2, h*0.46);
  var bx = w/2-80, by = h*0.52;
  roundRect(ctx, bx, by, 160, 50, 10);
  ctx.fillStyle = remain > 0 ? '#27ae60' : '#444'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText(remain > 0 ? '看广告复活' : '次数已用完', w/2, by+33);
  var bx2 = w/2-80, by2 = h*0.64;
  roundRect(ctx, bx2, by2, 160, 50, 10);
  ctx.fillStyle = '#444'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('放弃本关', w/2, by2+33);
  this._reviveBtn = { x: bx,  y: by,  w: 160, h: 50, canAd: remain > 0 };
  this._giveupBtn = { x: bx2, y: by2, w: 160, h: 50 };
};

BattleScene.prototype._doRevive = function() {
  this.bm.playerUnits.forEach(function(u) { u.dead = false; u.hp = Math.round(u.maxHp * 0.5); u.rage = 0; });
  this.bm.state = 'fighting'; this._showRevive = false;
};

// ════════════════════════════════════════
//  触摸
// ════════════════════════════════════════
BattleScene.prototype.onTouchStart = function(x, y) {
  function hit(b) { return b && x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h; }

  if (this._phase === 'preBattle') {
    // 教程对话框期间：点任意处关闭对话，进入 place 阶段
    if (this._tutorState === 'dialog') {
      this._tutorState = 'place';
      this.tutorShowDragHint = true;
      TutorialFlow.setStep(1);
      return null;
    }
    // 返回按钮
    if (hit(this._backBtn)) return 'backToMenu';
    // 开始战斗按钮
    if (hit(this._startBtn) && this._startBtn.active && !this.tutorLockStart) {
      this._startBattle(); return null;
    }
    // 点击已放置的种族（从格子拖走/移除）
    for (var i = 0; i < this._pbLineup.length; i++) {
      var entry = this._pbLineup[i];
      var pos = this._slotCenter(entry.slot);
      var r = 26;
      if (Math.abs(x - pos.x) < r && Math.abs(y - pos.y) < r) {
        this._drag = { raceId: entry.raceId, x: x, y: y, fromSlot: entry.slot };
        this._pbLineup.splice(i, 1);
        return null;
      }
    }
    // 点击底部种族图标开始拖拽
    var items = this._raceBarItems || this._getRaceBar();
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (x >= it.x && x <= it.x+it.w && y >= it.y && y <= it.y+it.h) {
        // 已在阵容中不可拖（但可以继续拖换位）
        var alreadyIn = false;
        for (var k = 0; k < this._pbLineup.length; k++) {
          if (this._pbLineup[k].raceId === it.raceId) { alreadyIn = true; break; }
        }
        if (!alreadyIn) {
          this._drag = { raceId: it.raceId, x: x, y: y, fromSlot: -1 };
        }
        return null;
      }
    }
    return null;
  }

  // battle 阶段
  if (hit(this._speedBtn)) { this._speed = this._speed === 1 ? 2 : 1; return null; }
  if (hit(this._pauseBtn)) { this._paused = !this._paused; return null; }
  if (this._showRevive) {
    var self = this;
    if (hit(this._reviveBtn) && this._reviveBtn.canAd) {
      AdManager.show('revive', function() { self._doRevive(); }, function() {});
    } else if (hit(this._giveupBtn)) {
      this._showRevive = false; this._resultShown = true;
      setTimeout(function() { self.onEnd('lose', {}); }, 800);
    }
  }
  return null;
};

BattleScene.prototype.onTouchMove = function(x, y) {
  if (this._drag) { this._drag.x = x; this._drag.y = y; }
};

BattleScene.prototype.onTouchEnd = function(x, y) {
  if (!this._drag) return;
  var drag = this._drag;
  this._drag = null;

  // 检查落点是否在我方格子内
  var slot = this._slotAtPoint(x, y);
  if (slot < 0) {
    // 拖出格子 → 取消（如果是从格子拖出，已经在onTouchStart移除了）
    return;
  }

  // 教程限制
  if (this.tutorAllowedSlot >= 0 && slot !== this.tutorAllowedSlot) return;

  // 该格子是否已有其他种族
  for (var i = 0; i < this._pbLineup.length; i++) {
    if (this._pbLineup[i].slot === slot) {
      // 已有种族 → 换位：把原来的种族移到拖拽来源格（或移除）
      if (drag.fromSlot >= 0) {
        this._pbLineup[i].slot = drag.fromSlot;
      } else {
        this._pbLineup.splice(i, 1);
      }
      break;
    }
  }

  // 阵容已满（4个）且是新种族
  var alreadyInLineup = false;
  for (var j = 0; j < this._pbLineup.length; j++) {
    if (this._pbLineup[j].raceId === drag.raceId) { alreadyInLineup = true; break; }
  }
  if (!alreadyInLineup && this._pbLineup.length >= 4) return;

  // 放置
  if (!alreadyInLineup) {
    this._pbLineup.push({ raceId: drag.raceId, slot: slot });
  }
};

module.exports = { BattleScene: BattleScene };
