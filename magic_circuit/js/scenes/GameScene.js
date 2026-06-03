var NODE_COLORS = [
  { color: '#f97316', glow: 'rgba(251,146,60,0.5)'  },
  { color: '#38bdf8', glow: 'rgba(125,211,252,0.5)' },
  { color: '#facc15', glow: 'rgba(253,224,71,0.5)'  },
  { color: '#a855f7', glow: 'rgba(192,132,252,0.5)' },
  { color: '#9ca3af', glow: 'rgba(156,163,175,0.4)' },
  { color: '#34d399', glow: 'rgba(52,211,153,0.5)'  },
];

var NODE_RUNES = ['火', '冰', '雷', '术', '影', '光'];

// Level 1 initial positions (nodes 2 & 3 scrambled → edge[0-2] × edge[1-3] cross)
// Solution: swap node 2 and node 3.
var INIT_FPOS = [
  { fx: 0.30, fy: 0.35 },
  { fx: 0.70, fy: 0.35 },
  { fx: 0.70, fy: 0.65 },
  { fx: 0.30, fy: 0.65 },
  { fx: 0.50, fy: 0.22 },
  { fx: 0.50, fy: 0.80 },
];

var EDGES = [
  [0, 2], [1, 3], [2, 3],
  [4, 0], [4, 1],
  [5, 2], [5, 3],
];

function GameScene(w, h, onBack) {
  this.w = w;
  this.h = h;
  this.onBack = onBack;
  this.NODE_R = Math.round(Math.min(w, h) * 0.058);
  this._initLevel();
}

GameScene.prototype._initLevel = function() {
  var self = this;
  this.nodes = INIT_FPOS.map(function(p) {
    return { x: p.fx * self.w, y: p.fy * self.h };
  });
  this.selected   = -1;
  this.gameState  = 'playing';
  this.wonTimer   = 0;
  this.time       = 0;
  this.swapTimer  = 0;
  this.swapNodes  = [-1, -1];
  this._computeCrossings();
};

// ── Geometry (unchanged) ──────────────────────────────────────────────────

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
  var n = EDGES.length;
  this.edgeCrossed = [];
  for (var i = 0; i < n; i++) this.edgeCrossed.push(false);
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var ea = EDGES[i], eb = EDGES[j];
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

GameScene.prototype._swap = function(a, b) {
  var tmp = { x: this.nodes[a].x, y: this.nodes[a].y };
  this.nodes[a].x = this.nodes[b].x;
  this.nodes[a].y = this.nodes[b].y;
  this.nodes[b].x = tmp.x;
  this.nodes[b].y = tmp.y;
  this._computeCrossings();
  // Swap flash feedback
  this.swapTimer = 24;
  this.swapNodes = [a, b];
  var won = true;
  for (var k = 0; k < this.edgeCrossed.length; k++) {
    if (this.edgeCrossed[k]) { won = false; break; }
  }
  if (won) this.gameState = 'won';
};

// ── Loop ──────────────────────────────────────────────────────────────────

GameScene.prototype.update = function() {
  this.time++;
  if (this.swapTimer > 0) this.swapTimer--;
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

  for (var i = 0; i < EDGES.length; i++) this._drawEdge(ctx, i);
  for (var j = 0; j < this.nodes.length; j++) this._drawNode(ctx, j);

  if (this.selected !== -1 && this.gameState === 'playing') {
    ctx.fillStyle = 'rgba(220,209,255,0.78)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
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

  // Level name — centered
  ctx.fillStyle = '#c4b5fd';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('第 1 关  ·  魔网连线', w / 2, 26);

  // Crossing count — LEFT side (away from WeChat capsule on right)
  var crosses = 0;
  for (var i = 0; i < this.edgeCrossed.length; i++) {
    if (this.edgeCrossed[i]) crosses++;
  }
  var pairs = crosses >> 1;
  ctx.fillStyle = pairs === 0 ? '#34d399' : '#f87171';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('交叉 ' + pairs, 16, 26);
};

GameScene.prototype._drawEdge = function(ctx, idx) {
  var e   = EDGES[idx];
  var p1  = this.nodes[e[0]], p2 = this.nodes[e[1]];
  var bad = this.edgeCrossed[idx];
  var wPulse = (this.gameState === 'won')
    ? (0.65 + 0.35 * Math.sin(this.wonTimer * 0.08)) : 1;

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);

  if (bad) {
    // Glow layer (wide, dim)
    ctx.strokeStyle = 'rgba(239,68,68,0.28)';
    ctx.lineWidth   = 7;
    ctx.stroke();
    // Core line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth   = 2.8;
    ctx.globalAlpha = 0.95;
    ctx.stroke();
  } else {
    // Glow layer
    ctx.strokeStyle = 'rgba(56,189,248,0.22)';
    ctx.lineWidth   = 6;
    ctx.globalAlpha = wPulse;
    ctx.stroke();
    // Core line
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth   = 2.2;
    ctx.globalAlpha = 0.85 * wPulse;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

GameScene.prototype._drawNode = function(ctx, idx) {
  var nd  = this.nodes[idx];
  var col = NODE_COLORS[idx % NODE_COLORS.length];
  var r   = this.NODE_R;
  var sel = (this.selected === idx);

  // Swap flash ring (fades out quickly)
  var justSwapped = (this.swapTimer > 0) &&
    (this.swapNodes[0] === idx || this.swapNodes[1] === idx);
  if (justSwapped) {
    var fa = this.swapTimer / 24;
    var fr = r + 6 + (1 - fa) * 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 3;
    ctx.globalAlpha = fa * 0.9;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, fr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Selection ring — thick, double-ring
  if (sel) {
    var pulse = 0.6 + 0.4 * Math.sin(this.time * 0.2);
    // Outer dim ring
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 5;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    // Inner bright ring
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
  og.addColorStop(0, col.glow);
  og.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r * 2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  var body = ctx.createRadialGradient(
    nd.x - r * 0.28, nd.y - r * 0.28, 0, nd.x, nd.y, r
  );
  body.addColorStop(0,    '#ffffff');
  body.addColorStop(0.3,  col.color);
  body.addColorStop(1,    'rgba(0,0,0,0.68)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = col.color;
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

  // Rune label
  var fs = Math.round(r * 0.82);
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold ' + fs + 'px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(NODE_RUNES[idx % NODE_RUNES.length], nd.x, nd.y + 1);
};

GameScene.prototype._drawWin = function(ctx) {
  var w = this.w, h = this.h;
  var t = Math.min(this.wonTimer / 40, 1);
  var cx = w / 2, cy = h * 0.48;

  // Dim overlay
  ctx.fillStyle = 'rgba(4,4,15,' + (t * 0.65) + ')';
  ctx.fillRect(0, 0, w, h);

  // Starburst — 8 radiating lines from center, growing outward
  var burstLen = Math.min(this.wonTimer * 4, 90);
  if (burstLen > 0) {
    ctx.globalAlpha = t * 0.45;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth   = 1.5;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      ctx.lineTo(cx + Math.cos(a) * burstLen, cy + Math.sin(a) * burstLen);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // "魔网已理顺" — glow + main text
  ctx.font        = 'bold 36px sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';

  var offs = [[-4,0],[4,0],[0,-4],[0,4]];
  ctx.fillStyle = '#34d399';
  for (var j = 0; j < offs.length; j++) {
    ctx.globalAlpha = t * 0.3;
    ctx.fillText('魔网已理顺', cx + offs[j][0], cy + offs[j][1]);
  }
  ctx.globalAlpha = t;
  ctx.fillStyle   = '#ffffff';
  ctx.fillText('魔网已理顺', cx, cy);

  // Sub text
  ctx.fillStyle = 'rgba(196,181,253,0.85)';
  ctx.font      = '15px sans-serif';
  ctx.fillText('点击任意位置返回', cx, cy + 50);

  ctx.globalAlpha = 1;
};

// ── Touch ─────────────────────────────────────────────────────────────────

GameScene.prototype.onTouchStart = function(e) {};
GameScene.prototype.onTouchMove  = function(e) {};

GameScene.prototype.onTouchEnd = function(e) {
  var touch = e.changedTouches[0];
  var tx = touch.clientX, ty = touch.clientY;

  if (this.gameState === 'won') { this.onBack(); return; }

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
  } else if (this.selected === tapped) {
    this.selected = -1;
  } else {
    this._swap(this.selected, tapped);
    this.selected = -1;
  }
};

module.exports = GameScene;
