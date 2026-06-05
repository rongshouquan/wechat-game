var PlayerData = require('../game/PlayerData').PlayerData;
var BONDS = require('../data/bonds').BONDS;
var RACES = require('../data/races').RACES;

var UNLOCK_COST = 100;
var UPGRADE_COST = 150;

var ResearchScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
};

ResearchScene.prototype.update = function(dt) {};

ResearchScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0d1f2d';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#5dade2';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('研究所', w/2, 40);

  // 返回
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 12, 60, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('返回', 40, 34);

  // 研究点
  var d = PlayerData.get();
  ctx.fillStyle = '#f1c40f';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('研究点：' + (d.researchPoints || 0), w/2, 70);

  this._bondBtns = [];

  for (var i = 0; i < BONDS.length; i++) {
    var bond = BONDS[i];
    var level = (d.bonds || {})[bond.id] || 0;
    var y = 90 + i * 80;
    var bh = 70;

    ctx.fillStyle = level > 0 ? '#1a2f1a' : '#1a1a2f';
    ctx.fillRect(20, y, w - 40, bh);

    // 羁绊名称
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(bond.name, 30, y + 22);

    // 所需种族
    var raceNames = bond.races.map(function(r) { return RACES[r] ? RACES[r].name : r; }).join(' + ');
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText(raceNames, 30, y + 40);

    // 当前效果
    if (level > 0) {
      ctx.fillStyle = '#2ecc71';
      ctx.font = '12px sans-serif';
      ctx.fillText('LV' + level + '：' + (bond.levels[level] ? bond.levels[level].desc : ''), 30, y + 56);
    }

    // 操作按钮
    var btnLabel, btnCost, canAct;
    if (level === 0) {
      btnLabel = '解锁 ' + UNLOCK_COST;
      btnCost = UNLOCK_COST;
      canAct = (d.researchPoints || 0) >= UNLOCK_COST;
    } else if (level < 3) {
      btnLabel = '升级 ' + UPGRADE_COST;
      btnCost = UPGRADE_COST;
      canAct = (d.researchPoints || 0) >= UPGRADE_COST;
    } else {
      btnLabel = '已满级';
      btnCost = 0;
      canAct = false;
    }

    var bx = w - 110, by = y + 14, bw2 = 90, bh2 = 36;
    ctx.fillStyle = canAct ? '#2980b9' : '#555';
    ctx.fillRect(bx, by, bw2, bh2);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(btnLabel, bx + bw2/2, by + bh2/2 + 5);

    this._bondBtns.push({ bondId: bond.id, level: level, cost: btnCost, canAct: canAct, x: bx, y: by, w: bw2, h: bh2 });
  }
};

ResearchScene.prototype.onTouchStart = function(x, y) {
  if (x >= 10 && x <= 70 && y >= 12 && y <= 46) return 'backToMenu';

  var btns = this._bondBtns || [];
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    if (!b.canAct) continue;
    if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
      var d = PlayerData.get();
      d.researchPoints -= b.cost;
      if (!d.bonds) d.bonds = {};
      d.bonds[b.bondId] = (d.bonds[b.bondId] || 0) + 1;
      PlayerData.save();
      return null;
    }
  }
  return null;
};
ResearchScene.prototype.onTouchMove = function() {};
ResearchScene.prototype.onTouchEnd = function() {};

module.exports = { ResearchScene: ResearchScene };
