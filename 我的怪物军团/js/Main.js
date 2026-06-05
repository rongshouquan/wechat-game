var MenuScene = require('./scenes/MenuScene').MenuScene;
var BattleScene = require('./scenes/BattleScene').BattleScene;
var ResultScene = require('./scenes/ResultScene').ResultScene;
var ItemScene = require('./scenes/ItemScene').ItemScene;
var ResearchScene = require('./scenes/ResearchScene').ResearchScene;
var PlayerData = require('./game/PlayerData').PlayerData;

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

  PlayerData.load();
  this.currentLevel = PlayerData.get().currentLevel;
  this._offlineMsg = PlayerData.offlineEarnings > 0
    ? '离线收益：+' + PlayerData.offlineEarnings + ' 研究点' : '';

  // 退出时保存时间戳
  wx.onHide(function() { PlayerData.save(); });

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
  } else if (action === 'openItems') {
    this._switchScene('items');
  } else if (action === 'openResearch') {
    this._switchScene('research');
  } else if (action === 'backToMenu') {
    this._switchScene('menu');
  } else if (action === 'nextLevel') {
    PlayerData.advanceLevel();
    this.currentLevel = PlayerData.get().currentLevel;
    this._switchScene('battle');
  } else if (action === 'retry') {
    this._switchScene('battle');
  }
};

Main.prototype._switchScene = function(name, data) {
  var ctx = this.ctx, w = this.width, h = this.height;
  var self = this;
  if (name === 'menu') {
    this.currentScene = new MenuScene(ctx, w, h, this._offlineMsg);
    this._offlineMsg = ''; // 只显示一次
  } else if (name === 'items') {
    var self2 = this;
    this.currentScene = new ItemScene(ctx, w, h, function() { self2._switchScene('menu'); });
  } else if (name === 'research') {
    var self3 = this;
    this.currentScene = new ResearchScene(ctx, w, h, function() { self3._switchScene('menu'); });
  } else if (name === 'battle') {
    this.currentScene = new BattleScene(ctx, w, h, this.currentLevel, function(result, rewards) {
      self.currentScene = new ResultScene(ctx, w, h, result, self.currentLevel, rewards);
    });
  }
};

Main.prototype._startLoop = function() {
  var self = this;
  var loop = function(timestamp) {
    var dt = self.lastTime ? (timestamp - self.lastTime) / 1000 : 0;
    self.lastTime = timestamp;
    if (dt > 0.1) dt = 0.1;
    if (self.currentScene) {
      self.currentScene.update(dt);
      self.currentScene.draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

module.exports = { Main: Main };
