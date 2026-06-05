var PlayerData = require('../game/PlayerData').PlayerData;
var ITEMS = require('../data/items').ITEMS;
var RACES = require('../data/races').RACES;

var ItemScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._selectedRace = null; // 当前选中的种族
  this._scroll = 0;
};

// 获取玩家已拥有的宝物列表（含数量）
ItemScene.prototype._getOwnedItems = function() {
  var d = PlayerData.get();
  var list = [];
  var owned = d.items || {};
  // 遍历所有宝物分类
  ['exclusive', 'legendary', 'normal'].forEach(function(cat) {
    Object.keys(ITEMS[cat]).forEach(function(id) {
      if (owned[id] && owned[id] > 0) {
        list.push({ id: id, data: ITEMS[cat][id], count: owned[id] });
      }
    });
  });
  return list;
};

ItemScene.prototype.update = function(dt) {};

ItemScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, w, h);

  // 顶部标题
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('宝物装备', w/2, 40);

  // 返回按钮
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 12, 60, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('返回', 40, 34);

  var d = PlayerData.get();
  var unlockedRaces = d.unlockedRaces || ['goblin'];

  if (!this._selectedRace) {
    this._drawRaceList(unlockedRaces, d);
  } else {
    this._drawItemPicker(d);
  }
};

ItemScene.prototype._drawRaceList = function(races, d) {
  var ctx = this.ctx, w = this.width;
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('选择种族装备宝物', w/2, 70);

  this._raceBtns = [];
  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId];
    if (!race) continue;
    var x = 20, y = 90 + i * 72, bw = w - 40, bh = 62;
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(x, y, bw, bh);
    // 种族色块
    ctx.fillStyle = race.color;
    ctx.beginPath();
    ctx.arc(x + 30, y + 31, 18, 0, Math.PI * 2);
    ctx.fill();
    // 种族名
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(race.name, x + 58, y + 24);
    // 已装备宝物
    var equippedId = (d.equips || {})[raceId];
    var equippedName = equippedId ? this._getItemName(equippedId) : '未装备';
    ctx.fillStyle = equippedId ? '#f1c40f' : '#666';
    ctx.font = '13px sans-serif';
    ctx.fillText(equippedName, x + 58, y + 46);
    this._raceBtns.push({ raceId: raceId, x: x, y: y, w: bw, h: bh });
  }
};

ItemScene.prototype._drawItemPicker = function(d) {
  var ctx = this.ctx, w = this.width;
  var race = RACES[this._selectedRace];
  ctx.fillStyle = '#bbb';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('为 ' + (race ? race.name : '') + ' 选择宝物', w/2, 70);

  // 卸下按钮
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(w/2 - 60, 82, 120, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('卸下装备', w/2, 104);
  this._unequipBtn = { x: w/2-60, y: 82, w: 120, h: 34 };

  var owned = this._getOwnedItems();
  this._itemBtns = [];
  var equipped = (d.equips || {})[this._selectedRace];

  for (var i = 0; i < owned.length; i++) {
    var item = owned[i];
    var x = 20, y = 128 + i * 64, bw = w - 40, bh = 54;
    var isEq = item.id === equipped;
    ctx.fillStyle = isEq ? '#2c4a1a' : '#1a2a3a';
    ctx.fillRect(x, y, bw, bh);
    // 稀有度色条
    ctx.fillStyle = item.data.rarity === 'legendary' ? '#f39c12' :
                    item.data.rarity === 'exclusive' ? '#9b59b6' : '#2980b9';
    ctx.fillRect(x, y, 5, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.data.name + (isEq ? ' [已装备]' : ''), x + 14, y + 22);
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.fillText(item.data.desc || '', x + 14, y + 40);
    this._itemBtns.push({ id: item.id, x: x, y: y, w: bw, h: bh });
  }

  if (owned.length === 0) {
    ctx.fillStyle = '#555';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无可用宝物', w/2, 180);
  }
};

ItemScene.prototype._getItemName = function(itemId) {
  var cats = ['exclusive', 'legendary', 'normal'];
  for (var i = 0; i < cats.length; i++) {
    if (ITEMS[cats[i]][itemId]) return ITEMS[cats[i]][itemId].name;
  }
  return itemId;
};

ItemScene.prototype.onTouchStart = function(x, y) {
  // 返回按钮
  if (x >= 10 && x <= 70 && y >= 12 && y <= 46) {
    if (this._selectedRace) { this._selectedRace = null; return null; }
    return 'backToMenu';
  }

  if (!this._selectedRace) {
    // 选择种族
    var btns = this._raceBtns || [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
        this._selectedRace = b.raceId;
        return null;
      }
    }
  } else {
    // 卸下装备
    var ub = this._unequipBtn;
    if (ub && x >= ub.x && x <= ub.x+ub.w && y >= ub.y && y <= ub.y+ub.h) {
      var d2 = PlayerData.get();
      if (d2.equips) delete d2.equips[this._selectedRace];
      PlayerData.save();
      return null;
    }
    // 选择宝物装备
    var ibtns = this._itemBtns || [];
    for (var j = 0; j < ibtns.length; j++) {
      var ib = ibtns[j];
      if (x >= ib.x && x <= ib.x+ib.w && y >= ib.y && y <= ib.y+ib.h) {
        var d3 = PlayerData.get();
        if (!d3.equips) d3.equips = {};
        d3.equips[this._selectedRace] = ib.id;
        PlayerData.save();
        return null;
      }
    }
  }
  return null;
};
ItemScene.prototype.onTouchMove = function() {};
ItemScene.prototype.onTouchEnd = function() {};

module.exports = { ItemScene: ItemScene };
