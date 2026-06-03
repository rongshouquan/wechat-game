var SceneManager = require('./SceneManager');

function Main() {
  var sysInfo = wx.getSystemInfoSync();
  this.screenWidth = sysInfo.screenWidth;
  this.screenHeight = sysInfo.screenHeight;

  this.canvas = wx.createCanvas();
  this.canvas.width = this.screenWidth;
  this.canvas.height = this.screenHeight;
  this.ctx = this.canvas.getContext('2d');

  this.sceneManager = new SceneManager(this.canvas, this.ctx, this.screenWidth, this.screenHeight);
  this.sceneManager.switchTo('start');

  var self = this;
  wx.onTouchStart(function(e) {
    self.sceneManager.onTouchStart(e);
  });
  wx.onTouchMove(function(e) {
    self.sceneManager.onTouchMove(e);
  });
  wx.onTouchEnd(function(e) {
    self.sceneManager.onTouchEnd(e);
  });

  this._loop();
}

Main.prototype._loop = function() {
  var self = this;
  requestAnimationFrame(function() {
    self.sceneManager.update();
    self.sceneManager.draw();
    self._loop();
  });
};

module.exports = Main;
