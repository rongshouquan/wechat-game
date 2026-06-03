var NODE_COLORS = [
  { color: '#f97316', glow: 'rgba(251,146,60,0.45)'  },
  { color: '#38bdf8', glow: 'rgba(125,211,252,0.45)' },
  { color: '#facc15', glow: 'rgba(253,224,71,0.45)'  },
  { color: '#a855f7', glow: 'rgba(192,132,252,0.45)' },
  { color: '#9ca3af', glow: 'rgba(156,163,175,0.35)' },
  { color: '#34d399', glow: 'rgba(52,211,153,0.45)'  },
];

// Level 1:
//  Nodes 2 & 3 are swapped from their solved positions.
//  This creates exactly one crossing: edge(0-2) x edge(1-3).
//  Solution: swap node 2 and node 3.
//
//  Solved layout (no crossings):
//    4(0.50,0.22)
//    0(0.30,0.35)   1(0.70,0.35)
//    3(0.30,0.65)   2(0.70,0.65)  ← wait, swap labels for initial
//    5(0.50,0.80)
//
//  Initial (scrambled): node2 at bottom-left, node3 at bottom-right
//    → edge 0-2 goes top-left to bottom-left (fine in solved, but here
//      node2 is at bottom-right, node3 is at bottom-left)
//    → 0-2 (top-left → bottom-right) crosses 1-3 (top-right → bottom-left) ✓

var INIT_FPOS = [
  { fx: 0.30, fy: 0.35 },  // 0  top-left
  { fx: 0.70, fy: 0.35 },  // 1  top-right
  { fx: 0.70, fy: 0.65 },  // 2  bottom-right  ← scrambled (solution pos = bottom-left)
  { fx: 0.30, fy: 0.65 },  // 3  bottom-left   ← scrambled (solution pos = bottom-right)
  { fx: 0.50, fy: 0.22 },  // 4  top-center
  { fx: 0.50, fy: 0.80 },  // 5  bottom-center
];

var EDGES = [
  [0, 2],
  [1, 3],
  [2, 3],
  [4, 0],
  [4, 1],
  [5, 2],
  [5, 3],
];

function GameScene(w, h, onBack) {
  this.w = w;
  this.h = h;
  this.onBack = onBack;
  this.NODE_R = Math.round(Math.min(w, h) * 0.055);
  this._initLevel();
}

GameScene.prototype._initLevel = function() {
  var self = this;
  this.nodes = INIT_FPOS.map(function(p) {
    return { x: p.fx * self.w, y: p.fy * self.h };
  });
  this.selected  = -1;
  this.gameState = 'playing';
  this.wonTimer  = 0;
  this.time      = 0;
  this._computeCrossings();
};

// ── Geometry ──────────────────────────────────────────────────────────────

GameScene.prototype._segsIntersect = function(p1, p2, p3, p4) {
  var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  var denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-8) return false; // parallel
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
  var won = true;
  for (var k = 0; k < this.edgeCrossed.length; k++) {
    if (this.edgeCrossed[k]) { won = false; break; }
  }
  if (won) this.gameState = 'won';
};

// ── Loop ──────────────────────────────────────────────────────────────────

GameScene.prototype.update = function() {
  this.time++;
  if (this.gameState === 'won') this.wonTimer++;
};

// ── Drawing ───────────────────────────────────────────────────────────────

GameScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  // Background
  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04040f');
  bg.addColorStop(1, '#0d0b2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  this._drawHeader(ctx);

  // Edges (drawn first, under nodes)
  for (var i = 0; i < EDGES.length; i++) {
    this._drawEdge(ctx, i);
  }

  // Nodes
  for (var j = 0; j < this.nodes.length; j++) {
    this._drawNode(ctx, j);
  }

  // Hint text
  if (this.selected !== -1 && this.gameState === 'playing') {
    ctx.fillStyle = 'rgba(220,209,255,0.75)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('再点击另一个节点完成交换', w / 2, h * 0.91);
  }

  if (this.gameState === 'won') {
    this._drawWin(ctx);
  }
};

GameScene.prototype._drawHeader = function(ctx) {
  var w = this.w;

  ctx.fillStyle = 'rgba(109,40,217,0.12)';
  ctx.fillRect(0, 0, w, 52);

  ctx.strokeStyle = 'rgba(139,92,246,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.lineTo(w, 52);
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('第 1 关  ·  魔网连线', w / 2, 26);

  // Crossing counter (each crossing pair is counted once)
  var crosses = 0;
  for (var i = 0; i < this.edgeCrossed.length; i++) {
    if (this.edgeCrossed[i]) crosses++;
  }
  var crossPairs = crosses >> 1; // integer divide by 2
  ctx.fillStyle = crossPairs === 0 ? '#34d399' : '#f87171';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('交叉 ' + crossPairs, w - 16, 26);
};

GameScene.prototype._drawEdge = function(ctx, idx) {
  var e    = EDGES[idx];
  var p1   = this.nodes[e[0]];
  var p2   = this.nodes[e[1]];
  var bad  = this.edgeCrossed[idx];
  var wPulse = (this.gameState === 'won')
    ? (0.7 + 0.3 * Math.sin(this.wonTimer * 0.1))
    : 1;

  if (bad) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.90;
  } else {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.70 * wPulse;
  }

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

GameScene.prototype._drawNode = function(ctx, idx) {
  var nd  = this.nodes[idx];
  var col = NODE_COLORS[idx % NODE_COLORS.length];
  var r   = this.NODE_R;
  var sel = (this.selected === idx);

  // Selected: bright pulsing ring
  if (sel) {
    var pulse = 0.55 + 0.45 * Math.sin(this.time * 0.18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Outer glow
  var og = ctx.createRadialGradient(nd.x, nd.y, r * 0.3, nd.x, nd.y, r * 1.9);
  og.addColorStop(0, col.glow);
  og.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // Body gradient
  var bg = ctx.createRadialGradient(
    nd.x - r * 0.28, nd.y - r * 0.28, 0,
    nd.x, nd.y, r
  );
  bg.addColorStop(0,    '#ffffff');
  bg.addColorStop(0.32, col.color);
  bg.addColorStop(1,    'rgba(0,0,0,0.65)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = col.color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner highlight ring
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(nd.x, nd.y, r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
};

GameScene.prototype._drawWin = function(ctx) {
  var w  = this.w, h = this.h;
  var t  = Math.min(this.wonTimer / 45, 1);

  // Dim overlay
  ctx.fillStyle = 'rgba(4,4,15,' + (t * 0.6) + ')';
  ctx.fillRect(0, 0, w, h);

  ctx.font        = 'bold 36px sans-serif';
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';

  // Glow offset layers
  var offs = [[-3, 0], [3, 0], [0, -3], [0, 3]];
  ctx.fillStyle = '#34d399';
  for (var i = 0; i < offs.length; i++) {
    ctx.globalAlpha = t * 0.28;
    ctx.fillText('魔网已理顺', w / 2 + offs[i][0], h / 2 + offs[i][1]);
  }

  // Main text
  ctx.globalAlpha = t;
  ctx.fillStyle   = '#ffffff';
  ctx.fillText('魔网已理顺', w / 2, h / 2);

  // Sub text
  ctx.fillStyle = 'rgba(196,181,253,0.82)';
  ctx.font      = '15px sans-serif';
  ctx.fillText('点击返回', w / 2, h / 2 + 48);

  ctx.globalAlpha = 1;
};

// ── Touch ─────────────────────────────────────────────────────────────────

GameScene.prototype.onTouchStart = function(e) {};
GameScene.prototype.onTouchMove  = function(e) {};

GameScene.prototype.onTouchEnd = function(e) {
  var touch = e.changedTouches[0];
  var tx = touch.clientX, ty = touch.clientY;

  if (this.gameState === 'won') {
    this.onBack();
    return;
  }

  // Hit-test nodes (tap radius = 1.5× node radius for comfort)
  var r2 = this.NODE_R * 1.5;
  r2 = r2 * r2;
  var tapped = -1;
  for (var i = 0; i < this.nodes.length; i++) {
    var nd = this.nodes[i];
    var dx = tx - nd.x, dy = ty - nd.y;
    if (dx * dx + dy * dy <= r2) { tapped = i; break; }
  }

  if (tapped === -1) {
    this.selected = -1;
    return;
  }

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
