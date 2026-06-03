function GameScene(w, h, onBack) {
  this.w = w;
  this.h = h;
  this.onBack = onBack;
}

GameScene.prototype.update = function() {};

GameScene.prototype.draw = function(ctx) {
  var w = this.w, h = this.h;

  ctx.fillStyle = '#0d0d2b';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#a78bfa';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏场景（开发中）', w / 2, h / 2);

  ctx.fillStyle = '#6d28d9';
  ctx.font = '16px sans-serif';
  ctx.fillText('点击返回', w / 2, h / 2 + 50);
};

GameScene.prototype.onTouchStart = function(e) {};

GameScene.prototype.onTouchEnd = function(e) {
  this.onBack();
};

GameScene.prototype.onTouchMove = function(e) {};

module.exports = GameScene;
