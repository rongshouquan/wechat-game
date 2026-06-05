// 阶段0：占位场景
var ResultScene = function(ctx, width, height, result) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.result = result || 'win'; // 'win' | 'lose'
};

ResultScene.prototype.update = function(dt) {};

ResultScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = this.result === 'win' ? '#1a3a1a' : '#3a1a1a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(this.result === 'win' ? '胜利！' : '失败！', w / 2, h / 2);
};

ResultScene.prototype.onTouchStart = function(x, y) { return 'backToMenu'; };
ResultScene.prototype.onTouchMove = function(x, y) {};
ResultScene.prototype.onTouchEnd = function(x, y) {};

module.exports = { ResultScene: ResultScene };
