function GameScene(w, h, onBack) {
  this.w = w;
  this.h = h;
  this.onBack = onBack;
  this.time = 0;
}

GameScene.prototype.update = function() {
  this.time += 1;
};

GameScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#04040f');
  bg.addColorStop(1, '#0d0b2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Top bar placeholder
  ctx.fillStyle = 'rgba(109,40,217,0.15)';
  ctx.fillRect(0, 0, w, 56);
  ctx.strokeStyle = 'rgba(139,92,246,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(w, 56);
  ctx.stroke();

  ctx.fillStyle = 'rgba(196,181,253,0.8)';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('第 1 关', w / 2, 28);

  // Center placeholder text
  var pulse = 0.5 + 0.5 * Math.sin(this.time * 0.05);
  ctx.globalAlpha = 0.5 + pulse * 0.3;
  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('核心玩法开发中', w / 2, h / 2);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(109,40,217,0.5)';
  ctx.font = '14px sans-serif';
  ctx.fillText('点击任意位置返回', w / 2, h / 2 + 40);
};

GameScene.prototype.onTouchStart = function(e) {};
GameScene.prototype.onTouchMove  = function(e) {};

GameScene.prototype.onTouchEnd = function(e) {
  this.onBack();
};

module.exports = GameScene;
