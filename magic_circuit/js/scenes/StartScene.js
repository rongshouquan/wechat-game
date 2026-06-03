var NODE_TYPES = [
  { color: '#f97316', glow: 'rgba(251,146,60,0.5)',  label: '火' },
  { color: '#38bdf8', glow: 'rgba(125,211,252,0.5)', label: '冰' },
  { color: '#facc15', glow: 'rgba(253,224,71,0.5)',  label: '雷' },
  { color: '#a855f7', glow: 'rgba(192,132,252,0.5)', label: '术' },
  { color: '#34d399', glow: 'rgba(52,211,153,0.5)',  label: '光' },
];

function StartScene(w, h, onStart) {
  this.w = w;
  this.h = h;
  this.onStart = onStart;

  this.btnX = w / 2;
  this.btnY = h * 0.77;
  this.btnW = 200;
  this.btnH = 52;

  var baseR = Math.min(w, h) * 0.24;
  this.circle = { cx: w / 2, cy: h * 0.40, r: baseR, angle: 0 };

  // 12 orbit particles
  this.particles = [];
  for (var i = 0; i < 12; i++) {
    this.particles.push({
      angle: (i / 12) * Math.PI * 2,
      speed: 0.004 + (i % 3) * 0.001,
      size:  1.8 + (i % 3) * 0.7,
      alpha: 0.45 + (i % 4) * 0.14,
    });
  }

  // 5 rune nodes on orbit
  this.decoNodes = [];
  for (var j = 0; j < 5; j++) {
    this.decoNodes.push({ angle: (j / 5) * Math.PI * 2 - Math.PI / 2, type: j });
  }

  this.btnPulse = 0;
  this.time = 0;
}

StartScene.prototype.update = function() {
  this.time++;
  this.circle.angle += 0.004;
  this.btnPulse += 0.055;
  for (var i = 0; i < this.particles.length; i++) {
    this.particles[i].angle += this.particles[i].speed;
  }
};

StartScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  // Deep space background
  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#050514');
  bg.addColorStop(1, '#0e0c2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle star dots
  this._drawStars(ctx);

  this._drawMagicCircle(ctx);
  this._drawLogo(ctx);
  this._drawTagline(ctx);
  this._drawButton(ctx);
};

StartScene.prototype._drawStars = function(ctx) {
  // Fixed lightweight star field (seeded by index)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  var positions = [
    [0.08,0.06],[0.92,0.09],[0.15,0.18],[0.78,0.14],[0.45,0.07],
    [0.62,0.20],[0.30,0.82],[0.85,0.75],[0.05,0.55],[0.95,0.48],
    [0.20,0.90],[0.70,0.88],[0.50,0.95],[0.12,0.70],[0.88,0.62],
  ];
  for (var i = 0; i < positions.length; i++) {
    ctx.beginPath();
    ctx.arc(positions[i][0] * this.w, positions[i][1] * this.h, 1, 0, Math.PI * 2);
    ctx.fill();
  }
};

StartScene.prototype._drawMagicCircle = function(ctx) {
  var c = this.circle;
  var cx = c.cx, cy = c.cy, r = c.r, ang = c.angle;

  // Ambient halo
  var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5);
  halo.addColorStop(0,   'rgba(109,40,217,0.14)');
  halo.addColorStop(0.6, 'rgba(79,20,170,0.06)');
  halo.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(139,92,246,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // 8 tick marks
  for (var i = 0; i < 8; i++) {
    var a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(196,181,253,0.85)' : 'rgba(139,92,246,0.45)';
    ctx.lineWidth   = i % 2 === 0 ? 2 : 1;
    var len = i % 2 === 0 ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - len / 2), Math.sin(a) * (r - len / 2));
    ctx.lineTo(Math.cos(a) * (r + len / 2), Math.sin(a) * (r + len / 2));
    ctx.stroke();
  }
  ctx.restore();

  // Inner dashed ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-ang * 0.5);
  ctx.strokeStyle = 'rgba(99,102,241,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 9]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Center pulse glow
  var pulse = 0.5 + 0.5 * Math.sin(this.time * 0.05);
  var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.22);
  cg.addColorStop(0, 'rgba(167,139,250,' + (0.22 + pulse * 0.12) + ')');
  cg.addColorStop(1, 'rgba(109,40,217,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Orbit particles
  for (var k = 0; k < this.particles.length; k++) {
    var p = this.particles[k];
    var px = cx + Math.cos(p.angle) * r;
    var py = cy + Math.sin(p.angle) * r;
    ctx.fillStyle = 'rgba(196,181,253,' + p.alpha + ')';
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rune nodes on orbit
  for (var n = 0; n < this.decoNodes.length; n++) {
    var dn = this.decoNodes[n];
    var na = dn.angle + ang * 0.12;
    var nx = cx + Math.cos(na) * r;
    var ny = cy + Math.sin(na) * r;
    this._drawRuneNode(ctx, nx, ny, 15, NODE_TYPES[dn.type]);
  }
};

StartScene.prototype._drawRuneNode = function(ctx, x, y, radius, type) {
  // Outer glow
  var g = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius * 1.7);
  g.addColorStop(0, type.glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2);
  ctx.fill();

  // Body
  var body = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.28, 0, x, y, radius);
  body.addColorStop(0,   '#ffffff');
  body.addColorStop(0.32, type.color);
  body.addColorStop(1,   'rgba(0,0,0,0.65)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = type.color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle    = '#ffffff';
  ctx.font         = 'bold ' + Math.round(radius * 0.88) + 'px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type.label, x, y + 1);
};

StartScene.prototype._drawLogo = function(ctx) {
  var x = this.w / 2;
  var y = this.h * 0.115;
  var pulse = 0.5 + 0.5 * Math.sin(this.time * 0.04);

  // Wide glow (8 offsets)
  ctx.font      = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var offsets = [[-5,0],[5,0],[0,-5],[0,5],[-3,-3],[3,3],[-3,3],[3,-3]];
  for (var i = 0; i < offsets.length; i++) {
    ctx.globalAlpha = (0.15 + pulse * 0.10);
    ctx.fillStyle   = '#a78bfa';
    ctx.fillText('魔网大师', x + offsets[i][0], y + offsets[i][1]);
  }
  ctx.globalAlpha = 1;

  // Main text — white
  ctx.fillStyle = '#ffffff';
  ctx.fillText('魔网大师', x, y);

  // Thin purple outline
  ctx.strokeStyle = 'rgba(167,139,250,0.6)';
  ctx.lineWidth   = 0.8;
  ctx.strokeText('魔网大师', x, y);

  // Decorative line under title
  var lw = 110;
  var lg = ctx.createLinearGradient(x - lw, 0, x + lw, 0);
  lg.addColorStop(0,   'rgba(139,92,246,0)');
  lg.addColorStop(0.5, 'rgba(167,139,250,0.75)');
  lg.addColorStop(1,   'rgba(139,92,246,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(x - lw, y + 30, lw * 2, 1.5);
};

StartScene.prototype._drawTagline = function(ctx) {
  ctx.fillStyle    = 'rgba(210,199,255,0.82)';
  ctx.font         = '15px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('交换符文节点  理顺魔法线路', this.w / 2, this.h * 0.635);
};

StartScene.prototype._drawButton = function(ctx) {
  var bx  = this.btnX - this.btnW / 2;
  var by  = this.btnY - this.btnH / 2;
  var bw  = this.btnW, bh = this.btnH, r = 14;
  var pulse = 0.5 + 0.5 * Math.sin(this.btnPulse);

  // Outer glow halo
  ctx.globalAlpha = 0.22 + pulse * 0.18;
  ctx.fillStyle   = '#d97706';
  ctx.beginPath();
  this._rrect(ctx, bx - 7, by - 7, bw + 14, bh + 14, r + 5);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Button body
  var grad = ctx.createLinearGradient(0, by, 0, by + bh);
  grad.addColorStop(0, '#fcd34d');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.beginPath();
  this._rrect(ctx, bx, by, bw, bh, r);
  ctx.fill();

  // Top highlight
  var hl = ctx.createLinearGradient(0, by, 0, by + bh * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  this._rrect(ctx, bx + 2, by + 2, bw - 4, bh * 0.48, r - 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(253,211,77,0.75)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  this._rrect(ctx, bx, by, bw, bh, r);
  ctx.stroke();

  // Label
  ctx.fillStyle    = '#1c0800';
  ctx.font         = 'bold 20px sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始冒险', this.btnX, this.btnY);
};

StartScene.prototype._rrect = function(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
};

StartScene.prototype.onTouchStart = function(e) {};
StartScene.prototype.onTouchMove  = function(e) {};

StartScene.prototype.onTouchEnd = function(e) {
  var t  = e.changedTouches[0];
  var tx = t.clientX, ty = t.clientY;
  if (tx >= this.btnX - this.btnW / 2 && tx <= this.btnX + this.btnW / 2 &&
      ty >= this.btnY - this.btnH / 2 && ty <= this.btnY + this.btnH / 2) {
    this.onStart();
  }
};

module.exports = StartScene;
