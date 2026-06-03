var LevelData = require('../LevelData');

var ANIM_DUR  = 13;
var WIN_COLORS = ['#34d399', '#a78bfa', '#fbbf24', '#38bdf8'];

function GameScene(w, h, onBack) {
  this.w = w;
  this.h = h;
  this.onBack = onBack;
  this.NODE_R = Math.round(Math.min(w, h) * 0.058);
  this.currentLevelIdx = 0;
  this._initLevel(0);
}

GameScene.prototype._initLevel = function(levelIdx) {
  var self  = this;
  var level = LevelData.levels[levelIdx];
  this.levelData = level;
  this.edges     = level.edges;

  this.nodes = level.nodes.map(function(nd) {
    var r = parseInt(nd.color.slice(1, 3), 16);
    var g = parseInt(nd.color.slice(3, 5), 16);
    var b = parseInt(nd.color.slice(5, 7), 16);
    return {
      x:     nd.fx * self.w,
      y:     nd.fy * self.h,
      rune:  nd.rune,
      color: nd.color,
      glow:  'rgba(' + r + ',' + g + ',' + b + ',0.5)',
    };
  });

  this.selected      = -1;
  this.gameState     = 'playing';
  this.wonTimer      = 0;
  this.time          = 0;
  this.moves         = 0;
  this.swapTimer     = 0;
  this.swapNodes     = [-1, -1];
  this.animating     = false;
  this.animTimer     = 0;
  this.animA         = -1;
  this.animB         = -1;
  this.ax0 = this.ay0 = this.bx0 = this.by0 = 0;
  this.ax1 = this.ay1 = this.bx1 = this.by1 = 0;
  this.resolvedFlash = [];
  for (var i = 0; i < this.edges.length; i++) this.resolvedFlash.push(0);
  this.winParticles  = [];
  this._computeCrossings();
};

// ── Sound (placeholder) ───────────────────────────────────────────────────

GameScene.prototype.playSound = function(type) {
  // type: 'select' | 'swap' | 'resolve' | 'win'
};

// ── Geometry (unchanged) ─────────────────────────────────────────────────

GameScene.prototype._segsIntersect = function(p1, p2, p3, p4) {
  var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  var denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-8) return false;
  var dx = p3.x - p1.x, dy = p3.y - p1.y;
  var t = (dx * d2y - dy * d2x) / denom;
  var u = (dx * d1y - dy * d1x) / denom;
  var eps = 1e-8;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
};

GameScene.prototype._computeCrossings = function() {
  var n = this.edges.length;
  this.edgeCrossed = [];
  for (var i = 0; i < n; i++) this.edgeCrossed.push(false);
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var ea = this.edges[i], eb = this.edges[j];
      if (ea[0] === eb[0] || ea[0] === eb[1] ||
          ea[1] === eb[0] || ea[1] === eb[1]) continue;
      var p1 = this.nodes[ea[0]], p2 = this.nodes[ea[1]];
      var p3 = this.nodes[eb[0]], p4 = this.nodes[eb[1]];
      if (this._segsIntersect(p1, p2, p3, p4)) {
        this.edgeCrossed[i] = true;
        this.edgeCrossed[j] = true;
      }
    }
  }
};

// ── Swap ──────────────────────────────────────────────────────────────────

GameScene.prototype._swap = function(a, b) {
  this.animating = true;
  this.animTimer = 0;
  this.animA     = a;
  this.animB     = b;
  this.ax0 = this.nodes[a].x; this.ay0 = this.nodes[a].y;
  this.bx0 = this.nodes[b].x; this.by0 = this.nodes[b].y;
  this.ax1 = this.bx0; this.ay1 = this.by0;
  this.bx1 = this.ax0; this.by1 = this.ay0;
  this.moves++;
  this.playSound('swap');
};

GameScene.prototype._finishSwap = function() {
  var prev = this.edgeCrossed.slice();
  this._computeCrossings();

  var anyResolved = false;
  for (var i = 0; i < this.edges.length; i++) {
    if (prev[i] && !this.edgeCrossed[i]) {
      this.resolvedFlash[i] = 24;
      anyResolved = true;
    }
  }
  if (anyResolved) this.playSound('resolve');

  this.swapTimer = 22;
  this.swapNodes = [this.animA, this.animB];

  var won = true;
  for (var k = 0; k < this.edgeCrossed.length; k++) {
    if (this.edgeCrossed[k]) { won = false; break; }
  }
  if (won) {
    this.gameState = 'won';
    this._spawnWinParticles();
    this.playSound('win');
  }
};

// ── Win particles ─────────────────────────────────────────────────────────

GameScene.prototype._spawnWinParticles = function() {
  this.winParticles = [];
  var cx = this.w / 2, cy = this.h * 0.45;
  for (var i = 0; i < 12; i++) {
    var a   = (i / 12) * Math.PI * 2 + (i % 3) * 0.3;
    var spd = 3.5 + (i % 4) * 0.8;
    this.winParticles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 1.5,
      life: 38 + (i % 5) * 4,
      maxLife: 58,
      r: 3.5 + (i % 3) * 1,
      color: WIN_COLORS[i % 4],
    });
  }
};

// ── Level progression ────────────────────────────────────────────────────

GameScene.prototype._nextLevel = function() {
  var total = LevelData.levels.length;
  if (this.currentLevelIdx < total - 1) {
    this.currentLevelIdx++;
    this._initLevel(this.currentLevelIdx);
  } else {
    this.onBack(); // all available levels done → back to start
  }
};

// ── Loop ──────────────────────────────────────────────────────────────────

GameScene.prototype.update = function() {
  this.time++;

  if (this.animating) {
    this.animTimer++;
    var t = this.animTimer / ANIM_DUR;
    if (t > 1) t = 1;
    var e = 1 - (1 - t) * (1 - t);
    var a = this.animA, b = this.animB;
    this.nodes[a].x = this.ax0 + (this.ax1 - this.ax0) * e;
    this.nodes[a].y = this.ay0 + (this.ay1 - this.ay0) * e;
    this.nodes[b].x = this.bx0 + (this.bx1 - this.bx0) * e;
    this.nodes[b].y = this.by0 + (this.by1 - this.by0) * e;
    if (this.animTimer >= ANIM_DUR) {
      this.nodes[a].x = this.ax1; this.nodes[a].y = this.ay1;
      this.nodes[b].x = this.bx1; this.nodes[b].y = this.by1;
      this.animating  = false;
      this._finishSwap();
    }
  }

  if (this.swapTimer > 0) this.swapTimer--;

  for (var i = 0; i < this.resolvedFlash.length; i++) {
    if (this.resolvedFlash[i] > 0) this.resolvedFlash[i]--;
  }

  for (var p = 0; p < this.winParticles.length; p++) {
    var pt = this.winParticles[p];
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += 0.18;
    pt.life--;
  }
  var alive = [];
  for (var q = 0; q < this.winParticles.length; q++) {
    if (this.winParticles[q].life > 0) alive.push(this.winParticles[q]);
  }
  this.winParticles = alive;

  if (this.gameState === 'won') this.wonTimer++;
};

// ── Drawing ───────────────────────────────────────────────────────────────

GameScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04040f');
  bg.addColorStop(1, '#0d0b2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  this._drawHeader(ctx);

  for (var i = 0; i < this.edges.length; i++) this._drawEdge(ctx, i);
  for (var j = 0; j < this.nodes.length; j++) this._drawNode(ctx, j);

  if (this.selected !== -1 && this.gameState === 'playing' && !this.animating) {
    ctx.fillStyle    = 'rgba(220,209,255,0.78)';
    ctx.font         = '14px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('再点击另一个节点完成交换', w / 2, h * 0.91);
  }

  if (this.gameState === 'won') this._drawWin(ctx);
};

GameScene.prototype._drawHeader = function(ctx) {
  var w = this.w;

  ctx.fillStyle = 'rgba(109,40,217,0.14)';
  ctx.fillRect(0, 0, w, 52);
  ctx.strokeStyle = 'rgba(139,92,246,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 52); ctx.lineTo(w, 52);
  ctx.stroke();

  // Level name — center
  ctx.fillStyle    = '#c4b5fd';
  ctx.font         = 'bold 16px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.levelData.name + '  ·  魔网连线', w / 2, 26);

  // Crossing count — left (away from WeChat capsule)
  var crosses = 0;
  for (var i = 0; i < this.edgeCrossed.length; i++) {
    if (this.edgeCrossed[i]) crosses++;
  }
  var pairs = crosses >> 1;
  ctx.fillStyle = pairs === 0 ? '#34d399' : '#f87171';
  ctx.font      = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('交叉 ' + pairs, 16, 26);

  // Moves — right of center area but safe from capsule
  ctx.fillStyle = 'rgba(196,181,253,0.7)';
  ctx.textAlign = 'right';
  ctx.fillText('步数 ' + this.moves, w - 100, 26);
};

GameScene.prototype._drawEdge = function(ctx, idx) {
  var e   = this.edges[idx];
  var p1  = this.nodes[e[0]], p2 = this.nodes[e[1]];
  var bad = this.edgeCrossed[idx];
  var wPulse = (this.gameState === 'won')
    ? (0.65 + 0.35 * Math.sin(this.wonTimer * 0.08)) : 1;

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);

  if (bad) {
    ctx.strokeStyle = 'rgba(239,68,68,0.28)';
    ctx.lineWidth   = 7;
    ctx.stroke();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth   = 2.8;
    ctx.globalAlpha = 0.95;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    var fv = this.resolvedFlash[idx];
    if (fv > 0) {
      ctx.strokeStyle = 'rgba(186,230,253,' + (fv / 24 * 0.65) + ')';
      ctx.lineWidth   = 10;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(56,189,248,0.22)';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = wPulse;
    ctx.stroke();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth   = 2.2;
    ctx.globalAlpha = 0.85 * wPulse;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
};

GameScene.prototype._drawNode = function(ctx, idx) {
  var nd  = this.nodes[idx];
  var r   = this.NODE_R;
  var sel = (this.selected === idx);

  // Swap flash ring
  var justSwapped = (this.swapTimer > 0) &&
    (this.swapNodes[0] === idx || this.swapNodes[1] === idx);
  if (justSwapped) {
    var fa = this.swapTimer / 22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 3;
    ctx.globalAlpha = fa * 0.85;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r + 6 + (1 - fa) * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Selection ring (double)
  if (sel) {
    var pulse = 0.6 + 0.4 * Math.sin(this.time * 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth   = 5;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Outer glow
  var og = ctx.createRadialGradient(nd.x, nd.y, r * 0.3, nd.x, nd.y, r * 2);
  og.addColorStop(0, nd.glow);
  og.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r * 2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  var body = ctx.createRadialGradient(
    nd.x - r * 0.28, nd.y - r * 0.28, 0, nd.x, nd.y, r
  );
  body.addColorStop(0,   '#ffffff');
  body.addColorStop(0.3, nd.color);
  body.addColorStop(1,   'rgba(0,0,0,0.68)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = nd.color;
  ctx.lineWidth   = 2.2;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r * 0.56, 0, Math.PI * 2);
  ctx.stroke();

  // Rune from level data
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold ' + Math.round(r * 0.82) + 'px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nd.rune, nd.x, nd.y + 1);
};

GameScene.prototype._drawWin = function(ctx) {
  var w  = this.w, h = this.h;
  var t  = Math.min(this.wonTimer / 40, 1);
  var cx = w / 2, cy = h * 0.45;
  var isLast = (this.currentLevelIdx >= LevelData.levels.length - 1);

  // Dim overlay
  ctx.fillStyle = 'rgba(4,4,15,' + (t * 0.65) + ')';
  ctx.fillRect(0, 0, w, h);

  // Particles
  for (var p = 0; p < this.winParticles.length; p++) {
    var pt = this.winParticles[p];
    var pa = pt.life / pt.maxLife;
    ctx.fillStyle   = pt.color;
    ctx.globalAlpha = pa;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r * pa + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Starburst
  var burstLen = Math.min(this.wonTimer * 5, 96);
  if (burstLen > 2) {
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth   = 1.5;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      ctx.globalAlpha = t * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20);
      ctx.lineTo(cx + Math.cos(a) * burstLen, cy + Math.sin(a) * burstLen);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Title glow
  var title = isLast ? '前三关全部完成！' : '魔网已理顺';
  var offs = [[-4, 0], [4, 0], [0, -4], [0, 4]];
  ctx.font      = 'bold 34px sans-serif';
  ctx.fillStyle = '#34d399';
  for (var j = 0; j < offs.length; j++) {
    ctx.globalAlpha = t * 0.3;
    ctx.fillText(title, cx + offs[j][0], cy + offs[j][1]);
  }
  ctx.globalAlpha = t;
  ctx.fillStyle   = '#ffffff';
  ctx.fillText(title, cx, cy);

  // Steps info
  ctx.fillStyle = 'rgba(196,181,253,0.85)';
  ctx.font      = '15px sans-serif';
  ctx.fillText('步数：' + this.moves, cx, cy + 42);

  // Action hint
  var hint = isLast ? '点击返回主界面' : '点击进入下一关';
  ctx.fillStyle = 'rgba(196,181,253,0.7)';
  ctx.fillText(hint, cx, cy + 68);

  ctx.globalAlpha = 1;
};

// ── Touch ─────────────────────────────────────────────────────────────────

GameScene.prototype.onTouchStart = function(e) {};
GameScene.prototype.onTouchMove  = function(e) {};

GameScene.prototype.onTouchEnd = function(e) {
  var touch = e.changedTouches[0];
  var tx = touch.clientX, ty = touch.clientY;

  if (this.gameState === 'won') { this._nextLevel(); return; }
  if (this.animating) return;

  var r2 = this.NODE_R * 1.5;
  r2 *= r2;
  var tapped = -1;
  for (var i = 0; i < this.nodes.length; i++) {
    var nd = this.nodes[i];
    var dx = tx - nd.x, dy = ty - nd.y;
    if (dx * dx + dy * dy <= r2) { tapped = i; break; }
  }

  if (tapped === -1) { this.selected = -1; return; }

  if (this.selected === -1) {
    this.selected = tapped;
    this.playSound('select');
  } else if (this.selected === tapped) {
    this.selected = -1;
  } else {
    this._swap(this.selected, tapped);
    this.selected = -1;
  }
};

module.exports = GameScene;
