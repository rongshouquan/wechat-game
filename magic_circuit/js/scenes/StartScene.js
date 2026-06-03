function StartScene(w, h, onStart) {
  this.w = w;
  this.h = h;
  this.onStart = onStart;
  this.btnX = w / 2;
  this.btnY = h * 0.62;
  this.btnW = 200;
  this.btnH = 56;
}

StartScene.prototype.update = function() {};

StartScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  ctx.fillStyle = '#0d0d2b';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('魔网连线', w / 2, h * 0.32);

  ctx.fillStyle = '#c4b5fd';
  ctx.font = '18px sans-serif';
  ctx.fillText('交换节点  理顺线路', w / 2, h * 0.44);

  var bx = this.btnX - this.btnW / 2;
  var by2 = this.btnY - this.btnH / 2;
  var bw = this.btnW, bh = this.btnH, r = 12;
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(bx + r, by2);
  ctx.lineTo(bx + bw - r, by2);
  ctx.arcTo(bx + bw, by2, bx + bw, by2 + r, r);
  ctx.lineTo(bx + bw, by2 + bh - r);
  ctx.arcTo(bx + bw, by2 + bh, bx + bw - r, by2 + bh, r);
  ctx.lineTo(bx + r, by2 + bh);
  ctx.arcTo(bx, by2 + bh, bx, by2 + bh - r, r);
  ctx.lineTo(bx, by2 + r);
  ctx.arcTo(bx, by2, bx + r, by2, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('开始冒险', bx, by);
};

StartScene.prototype.onTouchStart = function(e) {};

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

StartScene.prototype.onTouchMove = function(e) {};

module.exports = StartScene;
