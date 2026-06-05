var BattleManager = require('../game/BattleManager').BattleManager;
var LEVELS        = require('../data/levels').LEVELS;
var PlayerData    = require('../game/PlayerData').PlayerData;
var getRaceStats  = require('../game/RaceLevel').getRaceStats;
var AdManager     = require('../game/AdManager').AdManager;
var ImageCache    = require('../utils/ImageCache').ImageCache;

// ── 布局（相对屏幕比例）──
var L = {
  topBarH:      56,
  bottomStart:  0.88,
  cellW:        0.28,
  cellH:        0.088,
  colX:         [0.17, 0.50, 0.83],
  enemyRows:    [0.215, 0.355],  // [背排, 前排] — 向中间压缩
  playerRows:   [0.565, 0.685], // [前排, 背排] — 向中间压缩
  enemyLabelY:  0.12,
  zoneLabelY:   0.46,
};

// ── 工具 ──
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

// ── BattleScene ──
var BattleScene = function(ctx, width, height, levelId, onEnd) {
  this.ctx    = ctx;
  this.width  = width;
  this.height = height;
  this.onEnd  = onEnd || function() {};
  this._speed   = 1;
  this._paused  = false;
  this._auto    = false;
  this._resultShown = false;
  this._showRevive  = false;

  this.bm = new BattleManager(width, height);

  var playerSlots = this._buildPlayerSlots();
  if (playerSlots.length === 0) {
    playerSlots = [{ raceId: 'goblin', slot: 1, hpMult: 1, atkMult: 1, sizeOverride: 28, skillEnhancements: {} }];
  }
  var levelCfg = LEVELS[(levelId || 1) - 1] || LEVELS[0];
  this.bm.setup(playerSlots, levelCfg.enemies);
  this.levelName  = levelCfg.name;
  this.rewards    = levelCfg.rewards || { researchPoints: 10 };
  this.isSpecial  = levelCfg.isSpecial || false;
  this._canRevive = this.isSpecial;
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
    for (var u = 0; u < stats.unitCount; u++) {
      var slot = entry.slot + u;
      if (slot > 5) break;
      slots.push({ raceId: entry.raceId, slot: slot, hpMult: stats.hpMult, atkMult: stats.atkMult, sizeOverride: size, skillEnhancements: stats.skillEnhancements });
    }
  }
  return slots;
};

BattleScene.prototype.update = function(dt) {
  if (this._resultShown || this._showRevive || this._paused) return;
  this.bm.update(dt * this._speed);
  if (this.bm.state === 'win') {
    this._resultShown = true;
    var self = this;
    setTimeout(function() { self.onEnd('win', self.rewards); }, 1500);
  } else if (this.bm.state === 'lose') {
    if (this._canRevive) {
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
  this.bm.playerUnits.forEach(function(u) {
    u.dead = false;
    u.hp = Math.round(u.maxHp * 0.5);
    u.rage = 0;
  });
  this.bm.state = 'fighting';
  this._showRevive = false;
};

// ════════════════════════════════════════
//  绘制入口
// ════════════════════════════════════════
BattleScene.prototype.draw = function() {
  this._drawBackground();
  this._drawGrid();
  this._drawZoneLabels();
  this._drawUnits();
  this._drawFloats();
  this._drawTopBar();
  this._drawBottomBar();

  if (this.bm.state === 'win') {
    this._drawResult('胜利！', '#2ecc71');
  } else if (this.bm.state === 'lose' && !this._showRevive) {
    this._drawResult('失败...', '#e74c3c');
  }
  if (this._showRevive) this._drawRevivePanel();
};

// ── 背景 ──
BattleScene.prototype._drawBackground = function() {
  var ctx = this.ctx, w = this.width, h = this.height;

  // 战斗场地背景图
  var bg = ImageCache.get('assets/backgrounds/battle_field.png');
  if (bg) {
    ctx.drawImage(bg, 0, 0, w, h);
  } else {
    // 降级：深色渐变
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,   '#0d1520');
    grad.addColorStop(0.5, '#1a1a38');
    grad.addColorStop(1,   '#0a1020');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // 战斗区域边界线（辅助）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h * 0.40); ctx.lineTo(w, h * 0.40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h * 0.51); ctx.lineTo(w, h * 0.51); ctx.stroke();
};

// ── 格子 ──
BattleScene.prototype._drawGrid = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var cw = w * L.cellW, ch = h * L.cellH, cr = ch * 0.42;
  var colX  = [w * L.colX[0],       w * L.colX[1],       w * L.colX[2]];
  var eRows = [h * L.enemyRows[0],  h * L.enemyRows[1]];
  var pRows = [h * L.playerRows[0], h * L.playerRows[1]];

  // 占用情况（有单位 = 占用，不管死活）
  var eOcc = {}, pOcc = {};
  for (var i = 0; i < this.bm.enemyUnits.length;  i++) eOcc[this.bm.enemyUnits[i].slot]  = true;
  for (var j = 0; j < this.bm.playerUnits.length; j++) pOcc[this.bm.playerUnits[j].slot] = true;

  // 敌方格子：有单位不画，空位极淡轮廓
  for (var er = 0; er < 2; er++) {
    for (var ec = 0; ec < 3; ec++) {
      if (!eOcc[er * 3 + ec]) {
        roundRect(ctx, colX[ec] - cw/2, eRows[er] - ch/2, cw, ch, cr);
        ctx.strokeStyle = 'rgba(200, 100, 100, 0.08)';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }

  // 我方格子：有单位不画，空位极淡轮廓
  for (var pr = 0; pr < 2; pr++) {
    for (var pc = 0; pc < 3; pc++) {
      if (!pOcc[pr * 3 + pc]) {
        roundRect(ctx, colX[pc] - cw/2, pRows[pr] - ch/2, cw, ch, cr);
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.08)';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }
};

// 骷髅水印（圆头 + 眼睛）
BattleScene.prototype._drawSkullWatermark = function(ctx, cx, cy, ch) {
  var r = ch * 0.28;
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#cc2222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.1, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#cc2222';
  ctx.beginPath(); ctx.arc(cx - r * 0.32, cy - r * 0.15, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.32, cy - r * 0.15, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
};

// 盾牌水印（六边形盾形）
BattleScene.prototype._drawShieldWatermark = function(ctx, cx, cy, ch) {
  var sw = ch * 0.26, sh = ch * 0.34;
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#2255cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx,       cy - sh);
  ctx.lineTo(cx + sw,  cy - sh * 0.5);
  ctx.lineTo(cx + sw,  cy + sh * 0.1);
  ctx.lineTo(cx,       cy + sh);
  ctx.lineTo(cx - sw,  cy + sh * 0.1);
  ctx.lineTo(cx - sw,  cy - sh * 0.5);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
};

// ── 区域标签 ──
BattleScene.prototype._drawZoneLabels = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.textAlign = 'center';

  // 敌方区域
  var ey = h * L.enemyLabelY;
  ctx.strokeStyle = 'rgba(160, 30, 30, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.06, ey - 3); ctx.lineTo(w * 0.28, ey - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.72, ey - 3); ctx.lineTo(w * 0.94, ey - 3); ctx.stroke();
  ctx.fillStyle = 'rgba(200, 50, 50, 0.9)';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('- 敌方区域 -', w / 2, ey);

  // 中间分隔线（细线 + 小字）
  var my = h * L.zoneLabelY;
  ctx.strokeStyle = 'rgba(120, 120, 160, 0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w * 0.06, my); ctx.lineTo(w * 0.38, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.62, my); ctx.lineTo(w * 0.94, my); ctx.stroke();
  ctx.fillStyle = 'rgba(140, 140, 170, 0.55)';
  ctx.font = '11px sans-serif';
  ctx.fillText('— 战斗区域 —', w / 2, my + 4);
};

// ── 单位（按 y 排序：小 y 先画，大 y 后画 = 近处在前）──
BattleScene.prototype._drawUnits = function() {
  var units = this.bm.getAllUnits().slice().sort(function(a, b) { return a.y - b.y; });
  for (var i = 0; i < units.length; i++) {
    if (!units[i].dead) this._drawUnit(units[i]);
  }
};

BattleScene.prototype._drawUnit = function(u) {
  var ctx = this.ctx;
  var imgH = this.height * 0.14;
  var imgW = imgH * 0.78;
  var imgTop = u.y - imgH * 0.88;   // 立绘顶部（88% 在 u.y 上方）

  // 立绘 or 降级圆球
  var portrait = u.image ? ImageCache.get(u.image) : null;
  if (portrait) {
    ctx.drawImage(portrait, u.x - imgW / 2, imgTop, imgW, imgH);
  } else {
    var r = u.size / 2;
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill();
  }

  // HP 条（角色头顶上方 4px）
  var barW = imgW * 0.85, barH = 5;
  var barX  = u.x - barW / 2;
  var barY  = imgTop - barH - 4;
  // 底色（暗）
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  // 血量色
  var pct = u.hp / u.maxHp;
  ctx.fillStyle = pct > 0.5 ? '#e74c3c' : pct > 0.25 ? '#e67e22' : '#c0392b';
  ctx.fillRect(barX, barY, barW * pct, barH);

  // 护盾光圈
  if (u.shield > 0) {
    ctx.strokeStyle = '#1abc9c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(u.x, u.y, imgW * 0.5, 0, Math.PI * 2); ctx.stroke();
  }

  // 眩晕标记
  if (u.stunTimer > 0) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', u.x, barY - 4);
  }

  // 状态点（燃烧/流血/减速）— 放在 HP 条右下角
  var dotX = barX + barW + 3, dotY = barY;
  if (u.burnTimer  > 0) { ctx.fillStyle = '#e74c3c'; ctx.fillRect(dotX, dotY,     4, 4); dotY += 5; }
  if (u.bleedTimer > 0) { ctx.fillStyle = '#922b21'; ctx.fillRect(dotX, dotY,     4, 4); dotY += 5; }
  if (u.slowTimer  > 0) { ctx.fillStyle = '#3498db'; ctx.fillRect(dotX, dotY,     4, 4); }
};

// ── 飘字 ──
BattleScene.prototype._drawFloats = function() {
  var ctx = this.ctx;
  var floats = this.bm.floatTexts;
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
};

// ── 顶栏 ──
BattleScene.prototype._drawTopBar = function() {
  var ctx = this.ctx, w = this.width;

  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, 0, w, L.topBarH);
  // 底边高光
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, L.topBarH); ctx.lineTo(w, L.topBarH); ctx.stroke();

  // 关卡名（左）
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(this.levelName, 14, 26);

  // 剩余时间
  var remain = Math.max(0, Math.ceil(this.bm.timeLimit - this.bm.elapsed));
  ctx.fillStyle = remain < 30 ? '#e74c3c' : '#8899aa';
  ctx.font = '12px sans-serif';
  ctx.fillText('剩余: ' + remain + 's', 14, 46);

  // 倍速按钮
  var spX = w - 104, spY = 28;
  ctx.fillStyle = this._speed === 2 ? '#c48a00' : '#1e2c44';
  ctx.beginPath(); ctx.arc(spX, spY, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = this._speed === 2 ? '#f1c40f' : '#334';
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this._speed === 2 ? 'x2' : 'x1', spX, spY);
  this._speedBtn = { x: spX - 22, y: spY - 22, w: 44, h: 44 };

  // 暂停按钮
  var paX = w - 50, paY = 28;
  ctx.fillStyle = this._paused ? '#6b0000' : '#1e2c44';
  ctx.beginPath(); ctx.arc(paX, paY, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#334'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = this._paused ? 'bold 14px sans-serif' : '12px sans-serif';
  ctx.fillText(this._paused ? '▶' : '||', paX, paY);
  this._pauseBtn = { x: paX - 22, y: paY - 22, w: 44, h: 44 };

  ctx.textBaseline = 'alphabetic';
};

// ── 底栏 ──
BattleScene.prototype._drawBottomBar = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var barY = h * L.bottomStart;
  var barH = h - barY;
  var midY = barY + barH / 2;

  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, barY, w, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(w, barY); ctx.stroke();

  // ── 各单位独立怒气条 ──
  var units = this.bm.playerUnits;
  if (units.length === 0) { ctx.textBaseline = 'alphabetic'; return; }

  var pad = 8;
  var areaX = pad, areaW = w - pad * 2;
  var unitW = areaW / units.length;
  var dotR  = 5;
  var rbH   = barH * 0.24;   // 怒气条高度
  var dotY  = barY + barH * 0.30;
  var rbY   = barY + barH * 0.58;
  var labelY = rbY + rbH + 9;

  for (var i = 0; i < units.length; i++) {
    var u    = units[i];
    var ux   = areaX + i * unitW;
    var ucx  = ux + unitW / 2;  // 该单位列中心
    var full = !u.dead && u.rage >= 100;

    // 颜色圆点
    ctx.fillStyle  = u.dead ? '#333' : u.color;
    ctx.globalAlpha = u.dead ? 0.3 : 1;
    ctx.beginPath(); ctx.arc(ucx - 14, dotY, dotR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // 种族首字
    ctx.fillStyle  = u.dead ? '#444' : '#bbb';
    ctx.font       = '10px sans-serif';
    ctx.textAlign  = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.name.charAt(0), ucx - 7, dotY);

    // 怒气条底
    var rbX = ux + 4, rbW = unitW - 8;
    roundRect(ctx, rbX, rbY, rbW, rbH, rbH / 2);
    ctx.fillStyle = '#0e0e0e'; ctx.fill();

    // 怒气填充
    if (!u.dead && u.rage > 0) {
      roundRect(ctx, rbX, rbY, rbW * (u.rage / 100), rbH, rbH / 2);
      ctx.fillStyle = full ? '#ff8800' : '#7a3a00';
      ctx.fill();
    }

    // 满怒气高亮边框 + "技能！"
    if (full) {
      roundRect(ctx, rbX - 1, rbY - 1, rbW + 2, rbH + 2, rbH / 2 + 1);
      ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle  = '#ffaa00';
      ctx.font       = 'bold 8px sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('技能！', ucx, dotY - 7);
    }

    // 百分比数字
    if (!u.dead) {
      ctx.fillStyle  = full ? '#ffaa00' : '#666';
      ctx.font       = '8px sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText(Math.round(u.rage) + '%', ucx, labelY);
    }
  }

  ctx.textBaseline = 'alphabetic';
};

// ── 结果提示 ──
BattleScene.prototype._drawResult = function(text, color) {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
  roundRect(ctx, w / 2 - 120, h / 2 - 45, 240, 74, 16);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  ctx.textBaseline = 'alphabetic';
};

// ── 复活面板 ──
BattleScene.prototype._drawRevivePanel = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('特殊关卡！是否复活？', w / 2, h * 0.37);

  var remain = AdManager.remainCount('revive');
  ctx.fillStyle = '#999';
  ctx.font = '13px sans-serif';
  ctx.fillText('观看广告复活（今日剩余' + remain + '次）', w / 2, h * 0.46);

  var bx = w / 2 - 80, by = h * 0.52;
  roundRect(ctx, bx, by, 160, 50, 10);
  ctx.fillStyle = remain > 0 ? '#27ae60' : '#444';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(remain > 0 ? '看广告复活' : '次数已用完', w / 2, by + 33);

  var bx2 = w / 2 - 80, by2 = h * 0.64;
  roundRect(ctx, bx2, by2, 160, 50, 10);
  ctx.fillStyle = '#444';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('放弃本关', w / 2, by2 + 33);

  this._reviveBtn = { x: bx,  y: by,  w: 160, h: 50, canAd: remain > 0 };
  this._giveupBtn = { x: bx2, y: by2, w: 160, h: 50 };
};

// ── 触摸 ──
BattleScene.prototype.onTouchStart = function(x, y) {
  function hit(b) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

  if (hit(this._speedBtn)) { this._speed = this._speed === 1 ? 2 : 1; return null; }
  if (hit(this._pauseBtn)) { this._paused = !this._paused; return null; }
  if (hit(this._autoBtn))  { this._auto  = !this._auto;   return null; }

  if (this._showRevive) {
    var self = this;
    var rb = this._reviveBtn, gb = this._giveupBtn;
    if (hit(rb) && rb.canAd) {
      AdManager.show('revive', function() { self._doRevive(); }, function() {});
    } else if (hit(gb)) {
      this._showRevive = false;
      this._resultShown = true;
      setTimeout(function() { self.onEnd('lose', {}); }, 800);
    }
  }
  return null;
};
BattleScene.prototype.onTouchMove = function() {};
BattleScene.prototype.onTouchEnd  = function() {};

module.exports = { BattleScene: BattleScene };
