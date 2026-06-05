// 阶段0：占位场景，阶段1实现完整战斗逻辑
var BattleScene = function(ctx, width, height) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
};

BattleScene.prototype.update = function(dt) {};

BattleScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('战斗场景 - 阶段1实现', w / 2, h / 2);
};

BattleScene.prototype.onTouchStart = function(x, y) { return null; };
BattleScene.prototype.onTouchMove = function(x, y) {};
BattleScene.prototype.onTouchEnd = function(x, y) {};

module.exports = { BattleScene: BattleScene };
