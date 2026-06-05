var MenuScene = require('./scenes/MenuScene').MenuScene;
var BattleScene = require('./scenes/BattleScene').BattleScene;
var ResultScene = require('./scenes/ResultScene').ResultScene;

var Main = function() {
  var sysInfo = wx.getSystemInfoSync();
  this.width = sysInfo.screenWidth;
  this.height = sysInfo.screenHeight;

  this.canvas = wx.createCanvas();
  this.canvas.width = this.width;
  this.canvas.height = this.height;
  this.ctx = this.canvas.getContext('2d');

  this.currentScene = null;
  this.lastTime = 0;
  this._running = false;

  this._initTouch();
  this._switchScene('menu');
  this._startLoop();
};

Main.prototype._initTouch = function() {
  var self = this;
  wx.onTouchStart(function(e) {
    if (!self.currentScene) return;
    var t = e.touches[0];
    var action = self.currentScene.onTouchStart(t.clientX, t.clientY);
    self._handleAction(action);
  });
  wx.onTouchMove(function(e) {
    if (!self.currentScene) return;
    var t = e.touches[0];
    self.currentScene.onTouchMove(t.clientX, t.clientY);
  });
  wx.onTouchEnd(function(e) {
    if (!self.currentScene) return;
    var t = e.changedTouches[0];
    self.currentScene.onTouchEnd(t.clientX, t.clientY);
  });
};

Main.prototype._handleAction = function(action) {
  if (!action) return;
  if (action === 'startBattle') {
    this._switchScene('battle');
  } else if (action === 'backToMenu') {
    this._switchScene('menu');
  }
};

Main.prototype._switchScene = function(name) {
  var ctx = this.ctx, w = this.width, h = this.height;
  if (name === 'menu') {
    this.currentScene = new MenuScene(ctx, w, h);
  } else if (name === 'battle') {
    this.currentScene = new BattleScene(ctx, w, h);
  } else if (name === 'result') {
    this.currentScene = new ResultScene(ctx, w, h, 'win');
  }
};

Main.prototype._startLoop = function() {
  var self = this;
  this._running = true;
  var loop = function(timestamp) {
    if (!self._running) return;
    var dt = self.lastTime ? (timestamp - self.lastTime) / 1000 : 0;
    self.lastTime = timestamp;
    if (dt > 0.1) dt = 0.1; // 防止大步长
    if (self.currentScene) {
      self.currentScene.update(dt);
      self.currentScene.draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

module.exports = { Main: Main };
