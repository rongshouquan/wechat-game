var NODE_TYPES = [
  { color: '#f97316', glow: 'rgba(251,146,60,0.5)',  label: '火' },
  { color: '#38bdf8', glow: 'rgba(125,211,252,0.5)', label: '冰' },
  { color: '#facc15', glow: 'rgba(253,224,71,0.5)',  label: '雷' },
  { color: '#a855f7', glow: 'rgba(192,132,252,0.5)', label: '术' },
  { color: '#9ca3af', glow: 'rgba(156,163,175,0.4)', label: '影' },
];

function StartScene(w, h, onStart) {
  this.w = w;
  this.h = h;
  this.onStart = onStart;

  this.btnX = w / 2;
  this.btnY = h * 0.76;
  this.btnW = 220;
  this.btnH = 54;

  var baseR = Math.min(w, h) * 0.26;
  this.circle = {
    cx: w / 2,
    cy: h * 0.42,
    r: baseR,
    angle: 0,
  };

  // 16 particles on orbit ring, ≤20 total
  this.particles = [];
  for (var i = 0; i < 16; i++) {
    this.particles.push({
      angle: (i / 16) * Math.PI * 2,
      speed: 0.004 + (i % 3) * 0.001,
      size:  1.5 + (i % 3) * 0.8,
      alpha: 0.4 + (i % 4) * 0.15,
    });
  }

  // Decorative nodes around circle
  this.decoNodes = [];
  for (var j = 0; j < 5; j++) {
    var a = (j / 5) * Math.PI * 2 - Math.PI / 2;
    this.decoNodes.push({
      angle: a,
      type: j,
    });
  }

  this.btnPulse = 0;
  this.time = 0;
}

StartScene.prototype.update = function() {
  this.time += 1;
  this.circle.angle += 0.005;
  this.btnPulse += 0.06;
  for (var i = 0; i < this.particles.length; i++) {
    this.particles[i].angle += this.particles[i].speed;
  }
};

StartScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  // Background gradient
  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04040f');
  bg.addColorStop(1, '#0d0b2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  this._drawMagicCircle(ctx);
  this._drawLogo(ctx);
  this._drawSubtitle(ctx);
  this._drawButton(ctx);
};

StartScene.prototype._drawMagicCircle = function(ctx) {
  var c = this.circle;
  var cx = c.cx, cy = c.cy, r = c.r, ang = c.angle;

  // Ambient glow behind circle
  var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.4);
  glow.addColorStop(0,   'rgba(109,40,217,0.18)');
  glow.addColorStop(0.6, 'rgba(79,20,170,0.08)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring (rotates)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(139,92,246,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // 8 tick marks
  for (var i = 0; i < 8; i++) {
    var a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(196,181,253,0.9)' : 'rgba(139,92,246,0.5)';
    ctx.lineWidth = i % 2 === 0 ? 2 : 1;
    var len = i % 2 === 0 ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - len / 2), Math.sin(a) * (r - len / 2));
    ctx.lineTo(Math.cos(a) * (r + len / 2), Math.sin(a) * (r + len / 2));
    ctx.stroke();
  }
  ctx.restore();

  // Inner dashed ring (counter-rotate)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-ang * 0.5);
  ctx.strokeStyle = 'rgba(99,102,241,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Triangle (slow rotate)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang * 0.25);
  ctx.strokeStyle = 'rgba(167,139,250,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var j = 0; j < 3; j++) {
    var ta = (j / 3) * Math.PI * 2 - Math.PI / 2;
    var tx = Math.cos(ta) * r * 0.68;
    var ty = Math.sin(ta) * r * 0.68;
    j === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Center pulse
  var pulse = 0.5 + 0.5 * Math.sin(this.time * 0.05);
  var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.25);
  cg.addColorStop(0, 'rgba(167,139,250,' + (0.25 + pulse * 0.15) + ')');
  cg.addColorStop(1, 'rgba(109,40,217,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Particles on outer ring
  for (var k = 0; k < this.particles.length; k++) {
    var p = this.particles[k];
    var px = cx + Math.cos(p.angle) * r;
    var py = cy + Math.sin(p.angle) * r;
    ctx.fillStyle = 'rgba(196,181,253,' + p.alpha + ')';
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Decorative nodes on the orbit
  for (var n = 0; n < this.decoNodes.length; n++) {
    var dn = this.decoNodes[n];
    var na = dn.angle + ang * 0.15;
    var nx = cx + Math.cos(na) * r;
    var ny = cy + Math.sin(na) * r;
    this._drawNode(ctx, nx, ny, 14, NODE_TYPES[dn.type]);
  }
};

StartScene.prototype._drawNode = function(ctx, x, y, radius, type) {
  // Outer glow
  var g = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius * 1.6);
  g.addColorStop(0, type.glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Node body
  var body = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.35, type.color);
  body.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Rim — thicker, fully opaque for visibility
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Bright inner highlight ring
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.round(radius * 0.9) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type.label, x, y + 1);
};

StartScene.prototype._drawLogo = function(ctx) {
  var x = this.w / 2;
  var y = this.h * 0.12;
  var pulse = 0.5 + 0.5 * Math.sin(this.time * 0.04);

  // Glow layer (brighter violet, wider spread)
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var offsets = [[-4,0],[4,0],[0,-4],[0,4],[-3,-3],[3,3],[-3,3],[3,-3]];
  for (var i = 0; i < offsets.length; i++) {
    ctx.globalAlpha = (0.18 + pulse * 0.12);
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText('魔网大师', x + offsets[i][0], y + offsets[i][1]);
  }
  ctx.globalAlpha = 1;

  // Main text — pure white for max contrast
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('魔网大师', x, y);

  // Thin bright stroke outline
  ctx.strokeStyle = 'rgba(196,181,253,0.7)';
  ctx.lineWidth = 0.8;
  ctx.strokeText('魔网大师', x, y);

  // Underline accent
  var uw = 120;
  var grad = ctx.createLinearGradient(x - uw, 0, x + uw, 0);
  grad.addColorStop(0, 'rgba(139,92,246,0)');
  grad.addColorStop(0.5, 'rgba(167,139,250,0.8)');
  grad.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - uw, y + 28, uw * 2, 2);
};

StartScene.prototype._drawSubtitle = function(ctx) {
  ctx.fillStyle = 'rgba(220,209,255,0.88)';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('交换节点  理顺魔网', this.w / 2, this.h * 0.63);
};

StartScene.prototype._drawButton = function(ctx) {
  var bx = this.btnX - this.btnW / 2;
  var by = this.btnY - this.btnH / 2;
  var bw = this.btnW, bh = this.btnH, r = 14;
  var pulse = 0.5 + 0.5 * Math.sin(this.btnPulse);

  // Glow halo
  ctx.globalAlpha = 0.25 + pulse * 0.2;
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  this._rrect(ctx, bx - 6, by - 6, bw + 12, bh + 12, r + 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Button body gradient
  var bg = ctx.createLinearGradient(0, by, 0, by + bh);
  bg.addColorStop(0, '#fbbf24');
  bg.addColorStop(1, '#b45309');
  ctx.fillStyle = bg;
  ctx.beginPath();
  this._rrect(ctx, bx, by, bw, bh, r);
  ctx.fill();

  // Inner highlight
  var hl = ctx.createLinearGradient(0, by, 0, by + bh * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.3)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  this._rrect(ctx, bx + 2, by + 2, bw - 4, bh * 0.5, r - 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(251,191,36,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  this._rrect(ctx, bx, by, bw, bh, r);
  ctx.stroke();

  // Label
  ctx.fillStyle = '#1c0a00';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始冒险', this.btnX, this.btnY);
};

// Helper: rounded rect path
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
  var t = e.changedTouches[0];
  var tx = t.clientX, ty = t.clientY;
  if (
    tx >= this.btnX - this.btnW / 2 &&
    tx <= this.btnX + this.btnW / 2 &&
    ty >= this.btnY - this.btnH / 2 &&
    ty <= this.btnY + this.btnH / 2
  ) {
    this.onStart();
  }
};

module.exports = StartScene;
