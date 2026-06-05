var PlayerData = require('../game/PlayerData').PlayerData;
var BattleManager = require('../game/BattleManager').BattleManager;
var getRaceStats = require('../game/RaceLevel').getRaceStats;
var getTowerFloor = require('../data/tower').getTowerFloor;

var TowerScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._mode = 'lobby';  // 'lobby' | 'battle' | 'result'
  this._bm = null;
  this._floorCfg = null;
  this._resultShown = false;
  this._showRevive = false;
  this._canRevive = false;
  this._result = null;
};

TowerScene.prototype._getFloor = function() {
  var d = PlayerData.get();
  return d.towerFloor || 1;
};

TowerScene.prototype._startBattle = function() {
  var d = PlayerData.get();
  var floor = this._getFloor();
  this._floorCfg = getTowerFloor(floor);
  this._canRevive = this._floorCfg.isSpecial;
  this._resultShown = false;
  this._showRevive = false;

  var playerSlots = this._buildPlayerSlots(d);
  this._bm = new BattleManager(this.width, this.height);
  this._bm.setup(playerSlots, this._floorCfg.enemies);
  this._mode = 'battle';
};

TowerScene.prototype._buildPlayerSlots = function(d) {
  var slots = [];
  var lineup = d.lineup || [];
  for (var i = 0; i < lineup.length; i++) {
    var entry = lineup[i];
    var level = d.raceLevels[entry.raceId] || 1;
    var stats = getRaceStats(entry.raceId, level);
    if (!stats) continue;
    for (var u = 0; u < stats.unitCount; u++) {
      var slot = entry.slot + u;
      if (slot > 5) break;
      slots.push({
        raceId: entry.raceId, slot: slot,
        hpMult: stats.hpMult, atkMult: stats.atkMult,
        sizeOverride: Math.round(28 * stats.sizeScale),
        skillEnhancements: stats.skillEnhancements
      });
    }
  }
  return slots;
};

TowerScene.prototype.update = function(dt) {
  if (this._mode !== 'battle' || this._resultShown || this._showRevive) return;
  this._bm.update(dt);

  if (this._bm.state === 'win') {
    this._resultShown = true;
    var d = PlayerData.get();
    if (!d.towerFloor || this._getFloor() >= (d.towerFloor || 1)) {
      d.towerFloor = (d.towerFloor || 1) + 1;
    }
    d.honorPoints = (d.honorPoints || 0) + this._floorCfg.honorReward;
    PlayerData.save();
    this._result = 'win';
    var self = this;
    setTimeout(function() { self._mode = 'result'; }, 1500);
  } else if (this._bm.state === 'lose') {
    if (this._canRevive) {
      this._showRevive = true;
      this._canRevive = false;
    } else {
      this._resultShown = true;
      this._result = 'lose';
      var self2 = this;
      setTimeout(function() { self2._mode = 'result'; }, 1500);
    }
  }
};

TowerScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;

  if (this._mode === 'lobby')  { this._drawLobby(); return; }
  if (this._mode === 'result') { this._drawResult(); return; }

  // 战斗画面
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#334';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w*0.1, h*0.5);
  ctx.lineTo(w*0.9, h*0.5);
  ctx.stroke();

  ctx.fillStyle = '#445';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('敌方', w/2, h*0.14);
  ctx.fillText('我方', w/2, h*0.88);

  var units = this._bm.getAllUnits();
  for (var i = 0; i < units.length; i++) this._drawUnit(units[i]);

  var floats = this._bm.floatTexts;
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // 顶部信息
  var floor = this._getFloor() - (this._bm.state === 'win' ? 1 : 0);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('爬塔 第' + floor + '层  ' + Math.ceil(this._bm.timeLimit - this._bm.elapsed) + 's', w/2, 28);

  if (this._bm.state === 'win')  this._drawBanner('胜利！', '#2ecc71');
  if (this._bm.state === 'lose' && !this._showRevive) this._drawBanner('失败...', '#e74c3c');
  if (this._showRevive) this._drawRevivePanel();
};

TowerScene.prototype._drawLobby = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var d = PlayerData.get();
  var floor = d.towerFloor || 1;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 12, 60, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('返回', 40, 34);

  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('爬　塔', w/2, h*0.2);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px sans-serif';
  ctx.fillText('当前层数：第 ' + floor + ' 层', w/2, h*0.32);

  ctx.fillStyle = '#e0b84b';
  ctx.font = '16px sans-serif';
  ctx.fillText('荣誉积分：' + (d.honorPoints || 0), w/2, h*0.40);

  // 下一层预览
  var cfg = getTowerFloor(floor);
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.fillText('下一层奖励：' + cfg.honorReward + ' 荣誉积分' + (cfg.isSpecial ? '（特殊层）' : ''), w/2, h*0.48);

  // 挑战按钮
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(w/2-100, h*0.57, 200, 56);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('挑战第 ' + floor + ' 层', w/2, h*0.57 + 36);
  this._challengeBtn = { x: w/2-100, y: h*0.57, w: 200, h: 56 };
};

TowerScene.prototype._drawResult = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var isWin = this._result === 'win';
  var d = PlayerData.get();

  ctx.fillStyle = isWin ? '#0d2a1a' : '#2a0d0d';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isWin ? '通关！' : '失败...', w/2, h*0.3);

  if (isWin) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = '18px sans-serif';
    ctx.fillText('+' + this._floorCfg.honorReward + ' 荣誉积分', w/2, h*0.42);
    ctx.fillStyle = '#aaa';
    ctx.font = '15px sans-serif';
    ctx.fillText('当前层数：' + (d.towerFloor || 1), w/2, h*0.50);
  }

  // 按钮
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(w/2-90, h*0.60, 180, 50);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(isWin ? '继续挑战' : '再试一次', w/2, h*0.60+33);
  this._continueBtn = { x: w/2-90, y: h*0.60, w: 180, h: 50 };

  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(w/2-90, h*0.70, 180, 50);
  ctx.fillStyle = '#fff';
  ctx.fillText('返回大厅', w/2, h*0.70+33);
  this._lobbyBtn = { x: w/2-90, y: h*0.70, w: 180, h: 50 };
};

TowerScene.prototype._drawUnit = function(u) {
  if (u.dead) return;
  var ctx = this.ctx, r = u.size/2;
  if (u.stunTimer > 0) {
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(u.x, u.y, r+4, 0, Math.PI*2); ctx.stroke();
  }
  ctx.fillStyle = u.color;
  ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(u.name, u.x, u.y+4);
  var barW = u.size+10, barX = u.x-barW/2, hpY = u.y+r+4;
  ctx.fillStyle = '#333'; ctx.fillRect(barX, hpY, barW, 5);
  var pct = u.hp/u.maxHp;
  ctx.fillStyle = pct>0.5?'#2ecc71':pct>0.25?'#f39c12':'#e74c3c';
  ctx.fillRect(barX, hpY, barW*pct, 5);
  ctx.fillStyle='#222'; ctx.fillRect(barX, hpY+7, barW, 3);
  ctx.fillStyle='#e67e22'; ctx.fillRect(barX, hpY+7, barW*(u.rage/100), 3);
};

TowerScene.prototype._drawBanner = function(text, color) {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(w/2-100, h/2-35, 200, 60);
  ctx.fillStyle = color; ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, w/2, h/2+10);
};

TowerScene.prototype._drawRevivePanel = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('特殊层！是否复活？', w/2, h*0.38);
  ctx.fillStyle = '#27ae60'; ctx.fillRect(w/2-80, h*0.47, 160, 48);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('立即复活', w/2, h*0.47+30);
  ctx.fillStyle = '#7f8c8d'; ctx.fillRect(w/2-80, h*0.57, 160, 48);
  ctx.fillStyle = '#fff'; ctx.fillText('放弃', w/2, h*0.57+30);
  this._revBtn = { x: w/2-80, y: h*0.47, w: 160, h: 48 };
  this._gupBtn = { x: w/2-80, y: h*0.57, w: 160, h: 48 };
};

TowerScene.prototype.onTouchStart = function(x, y) {
  if (this._mode === 'lobby') {
    if (x>=10&&x<=70&&y>=12&&y<=46) return 'backToMenu';
    var cb = this._challengeBtn;
    if (cb && x>=cb.x&&x<=cb.x+cb.w&&y>=cb.y&&y<=cb.y+cb.h) this._startBattle();
    return null;
  }
  if (this._mode === 'result') {
    var cont = this._continueBtn;
    if (cont && x>=cont.x&&x<=cont.x+cont.w&&y>=cont.y&&y<=cont.y+cont.h) {
      this._mode = 'lobby'; return null;
    }
    var lb = this._lobbyBtn;
    if (lb && x>=lb.x&&x<=lb.x+lb.w&&y>=lb.y&&y<=lb.y+lb.h) {
      this._mode = 'lobby'; return null;
    }
    return null;
  }
  // 战斗中
  if (this._showRevive) {
    var rv = this._revBtn, gv = this._gupBtn;
    if (rv && x>=rv.x&&x<=rv.x+rv.w&&y>=rv.y&&y<=rv.y+rv.h) {
      this._bm.playerUnits.forEach(function(u) { u.dead=false; u.hp=Math.round(u.maxHp*0.5); u.rage=0; });
      this._bm.state = 'fighting';
      this._showRevive = false;
    } else if (gv && x>=gv.x&&x<=gv.x+gv.w&&y>=gv.y&&y<=gv.y+gv.h) {
      this._showRevive = false;
      this._resultShown = true;
      this._result = 'lose';
      var self = this;
      setTimeout(function() { self._mode = 'result'; }, 400);
    }
  }
  return null;
};
TowerScene.prototype.onTouchMove = function() {};
TowerScene.prototype.onTouchEnd = function() {};

module.exports = { TowerScene: TowerScene };
