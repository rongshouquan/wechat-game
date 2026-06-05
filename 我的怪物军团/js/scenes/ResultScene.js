var PlayerData = require('../game/PlayerData').PlayerData;
var AdManager = require('../game/AdManager').AdManager;

var ResultScene = function(ctx, width, height, result, levelId, rewards) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.result = result;
  this.levelId = levelId || 1;
  this.rewards = rewards || {};
  this._initButtons();

  // 胜利时发放奖励
  if (result === 'win') {
    var d = PlayerData.get();
    if (rewards.researchPoints) d.researchPoints = (d.researchPoints||0) + rewards.researchPoints;
    if (rewards.monsterExp)     d.monsterExp     = (d.monsterExp||0)     + rewards.monsterExp;
    // 宝物碎片运行时随机 5~10
    var shards = rewards.itemShards || (Math.floor(Math.random()*6) + 5);
    d.itemShards = (d.itemShards||0) + shards;
    this._actualShards = shards;
    PlayerData.save();
  }
};

ResultScene.prototype._initButtons = function() {
  var w = this.width, h = this.height;
  this.buttons = [];
  if (this.result === 'win') {
    var remain = AdManager.remainCount('doubleReward');
    this.buttons.push({ label: remain>0?'看广告×2奖励':'翻倍次数已用完', x: w/2-90, y: h*0.58, w: 180, h: 44, action: remain>0?'doubleReward':'noop', color: remain>0?'#e67e22':'#555' });
    this.buttons.push({ label: '下一关', x: w/2-90, y: h*0.66, w: 180, h: 46, action: 'nextLevel', color: '#27ae60' });
  } else {
    this.buttons.push({ label: '再来一次', x: w/2-90, y: h*0.65, w: 180, h: 46, action: 'retry', color: '#c0392b' });
  }
  this.buttons.push({ label: '返回主菜单', x: w/2-90, y: h*0.74, w: 180, h: 46, action: 'backToMenu', color: '#2c3e50' });
};

ResultScene.prototype.update = function(dt) {};

ResultScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var isWin = this.result === 'win';

  ctx.fillStyle = isWin ? '#0d2a1a' : '#2a0d0d';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWin ? '胜利！' : '失败...', w/2, h*0.32);

  // 关卡名
  ctx.fillStyle = '#bbb';
  ctx.font = '18px sans-serif';
  ctx.fillText('第' + this.levelId + '关', w/2, h*0.42);

  // 奖励展示（胜利时）
  if (isWin) {
    var d2 = PlayerData.get();
    var lineY = h*0.48;
    ctx.font = '15px sans-serif';
    if (this.rewards.researchPoints) {
      ctx.fillStyle = '#5dade2';
      ctx.fillText('研究点  +' + this.rewards.researchPoints, w/2, lineY); lineY += 22;
    }
    if (this.rewards.monsterExp) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('怪物经验 +' + this.rewards.monsterExp, w/2, lineY); lineY += 22;
    }
    ctx.fillStyle = '#e67e22';
    ctx.fillText('宝物碎片 +' + (this._actualShards||0), w/2, lineY); lineY += 26;
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('经验:' + d2.monsterExp + '  碎片:' + d2.itemShards, w/2, lineY);
  }

  // 按钮
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    ctx.fillStyle = btn.color || '#2c3e50';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2 + 7);
  }
};

ResultScene.prototype.onTouchStart = function(x, y) {
  for (var i = 0; i < this.buttons.length; i++) {
    var btn = this.buttons[i];
    if (x >= btn.x && x <= btn.x+btn.w && y >= btn.y && y <= btn.y+btn.h) {
      if (btn.action === 'doubleReward') {
        var self = this;
        AdManager.show('doubleReward', function() {
          if (self.rewards && self.rewards.researchPoints) {
            PlayerData.addResearchPoints(self.rewards.researchPoints); // 再加一倍
          }
          // 重新初始化按钮（翻倍次数已消耗）
          self._initButtons();
        }, function() {});
        return null;
      }
      if (btn.action === 'noop') return null;
      return btn.action;
    }
  }
  return null;
};
ResultScene.prototype.onTouchMove = function() {};
ResultScene.prototype.onTouchEnd = function() {};

module.exports = { ResultScene: ResultScene };
