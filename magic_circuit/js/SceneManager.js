var StartScene = require('./scenes/StartScene');
var GameScene = require('./scenes/GameScene');

function SceneManager(canvas, ctx, w, h) {
  this.canvas = canvas;
  this.ctx = ctx;
  this.w = w;
  this.h = h;
  this.current = null;
}

SceneManager.prototype.switchTo = function(name) {
  var self = this;
  if (name === 'start') {
    this.current = new StartScene(this.w, this.h, function() {
      self.switchTo('game');
    });
  } else if (name === 'game') {
    this.current = new GameScene(this.w, this.h, function() {
      self.switchTo('start');
    });
  }
};

SceneManager.prototype.update = function() {
  if (this.current && this.current.update) {
    this.current.update();
  }
};

SceneManager.prototype.draw = function() {
  this.ctx.clearRect(0, 0, this.w, this.h);
  if (this.current && this.current.draw) {
    this.current.draw(this.ctx);
  }
};

SceneManager.prototype.onTouchStart = function(e) {
  if (this.current && this.current.onTouchStart) {
    this.current.onTouchStart(e);
  }
};

SceneManager.prototype.onTouchMove = function(e) {
  if (this.current && this.current.onTouchMove) {
    this.current.onTouchMove(e);
  }
};

SceneManager.prototype.onTouchEnd = function(e) {
  if (this.current && this.current.onTouchEnd) {
    this.current.onTouchEnd(e);
  }
};

module.exports = SceneManager;
