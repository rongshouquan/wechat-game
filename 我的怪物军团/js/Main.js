var MenuScene = require('./scenes/MenuScene').MenuScene;
var BattleScene = require('./scenes/BattleScene').BattleScene;
var ResultScene = require('./scenes/ResultScene').ResultScene;
var ItemScene = require('./scenes/ItemScene').ItemScene;
var ResearchScene = require('./scenes/ResearchScene').ResearchScene;
var ShopScene = require('./scenes/ShopScene').ShopScene;
var LineupScene = require('./scenes/LineupScene').LineupScene;
var TowerScene = require('./scenes/TowerScene').TowerScene;
var RaceScene = require('./scenes/RaceScene').RaceScene;
var PreBattleScene = require('./scenes/PreBattleScene').PreBattleScene;
var TutorialManager = require('./game/TutorialManager').TutorialManager;
var PlayerData = require('./game/PlayerData').PlayerData;
var ImageCache = require('./utils/ImageCache').ImageCache;

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

  // 预加载种族立绘
  ImageCache.preload([
    'assets/characters/race_goblin.png', 'assets/characters/race_werewolf.png', 'assets/characters/race_minotaur.png',
    'assets/characters/race_orc.png', 'assets/characters/race_skeleton_mage.png', 'assets/characters/race_fairy.png',
    'assets/characters/race_paladin.png', 'assets/characters/race_reaper.png',
    'assets/backgrounds/battle_field.png'
  ]);
  this._offlineMsg = PlayerData.offlineEarnings > 0
    ? '离线收益：+' + PlayerData.offlineEarnings + ' 研究点' : '';

  this._notifyQueue = [];   // 待显示的引导通知
  this._notifyTimer = 0;
  this._currentNotify = '';

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
  } else if (action === 'openLegion') {
    this._switchScene('races');
  } else if (action === 'openTreasury') {
    this._switchScene('items');
  } else if (action === 'openRaces') {
    this._switchScene('races');
  } else if (action === 'openItems') {
    this._switchScene('items');
  } else if (action === 'openResearch') {
    this._switchScene('research');
  } else if (action === 'openShop') {
    this._switchScene('shop');
  } else if (action === 'openLineup') {
    this._switchScene('lineup');
  } else if (action === 'openTower') {
    this._switchScene('tower');
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
  } else if (name === 'shop') {
    var self4 = this;
    this.currentScene = new ShopScene(ctx, w, h, function() { self4._switchScene('menu'); });
  } else if (name === 'lineup') {
    var self5 = this;
    this.currentScene = new LineupScene(ctx, w, h, function() { self5._switchScene('menu'); });
  } else if (name === 'tower') {
    var self6 = this;
    this.currentScene = new TowerScene(ctx, w, h, function() { self6._switchScene('menu'); });
  } else if (name === 'battle') {
    this.currentScene = new BattleScene(ctx, w, h, this.currentLevel, function(result, rewards) {
      self.currentScene = new ResultScene(ctx, w, h, result, self.currentLevel, rewards);
    });
  } else if (name === 'races') {
    var self8 = this;
    this.currentScene = new RaceScene(ctx, w, h, function() { self8._switchScene('menu'); });
  }
};

Main.prototype._startLoop = function() {
  var self = this;
  var loop = function(timestamp) {
    var dt = self.lastTime ? (timestamp - self.lastTime) / 1000 : 0;
    self.lastTime = timestamp;
    if (dt > 0.1) dt = 0.1;

    // 引导计时 & 通知
    var msgs = TutorialManager.tick(dt * 1000);
    for (var i = 0; i < msgs.length; i++) self._notifyQueue.push(msgs[i]);
    if (self._currentNotify) {
      self._notifyTimer -= dt;
      if (self._notifyTimer <= 0) self._currentNotify = '';
    }
    if (!self._currentNotify && self._notifyQueue.length > 0) {
      self._currentNotify = self._notifyQueue.shift();
      self._notifyTimer = 3;
    }

    if (self.currentScene) {
      self.currentScene.update(dt);
      self.currentScene.draw();
    }
    if (self._currentNotify) self._drawNotify(self._currentNotify);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

Main.prototype._drawNotify = function(msg) {
  var ctx = this.ctx, w = this.width;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(w/2 - 160, 80, 320, 44);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(msg, w/2, 108);
};

module.exports = { Main: Main };
