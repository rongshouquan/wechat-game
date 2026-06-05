var PlayerData = require('../game/PlayerData').PlayerData;
var ITEMS = require('../data/items').ITEMS;
var RACES = require('../data/races').RACES;

// 升级消耗碎片：1→2星 20片，2→3星 50片
var UPGRADE_COST = [0, 20, 50];
// 分解返还碎片：1星8片，2星25片，3星不可分解最低件
var DECOMPOSE_RETURN = [8, 25, 60];

function getItemData(itemId) {
  var cats = ['exclusive', 'legendary', 'normal'];
  for (var i = 0; i < cats.length; i++) {
    if (ITEMS[cats[i]][itemId]) return { data: ITEMS[cats[i]][itemId], cat: cats[i] };
  }
  return null;
}

function starStr(n) {
  var s = '';
  for (var i = 0; i < n; i++) s += '★';
  for (var j = n; j < 3; j++) s += '☆';
  return s;
}

var RARITY_COLOR = { exclusive: '#9b59b6', legendary: '#f39c12', normal: '#2980b9' };

var ItemScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._selected = null;  // { itemId, stars } 当前选中的一件宝物
  this._equipTarget = null; // 选择给哪个种族装备
  this._tab = 'all'; // 'all' | 'equipped'
};

ItemScene.prototype.update = function(dt) {};

ItemScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, w, h);

  // 顶栏
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('宝物仓库', w/2, 30);
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 10, 56, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('返回', 38, 29);
  // 碎片数量
  var d = PlayerData.get();
  ctx.fillStyle = '#e67e22';
  ctx.textAlign = 'right';
  ctx.font = '13px sans-serif';
  ctx.fillText('碎片：' + (d.itemShards||0), w-10, 30);

  if (this._equipTarget !== null) { this._drawEquipPicker(d); return; }
  if (this._selected)             { this._drawDetail(d); return; }
  this._drawWarehouse(d);
};

// ── 仓库列表 ──
ItemScene.prototype._drawWarehouse = function(d) {
  var ctx = this.ctx, w = this.width;
  var items = d.items || {};
  var ids = Object.keys(items);
  this._itemBtns = [];
  var y = 56;

  if (ids.length === 0) {
    ctx.fillStyle = '#555'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('仓库为空', w/2, 160);
    return;
  }

  for (var i = 0; i < ids.length; i++) {
    var itemId = ids[i];
    var arr = items[itemId]; // [1星数, 2星数, 3星数]
    var info = getItemData(itemId);
    if (!info) continue;

    // 每个星级单独展示一行
    for (var s = 0; s < 3; s++) {
      var count = arr[s];
      if (count <= 0) continue;
      var stars = s + 1;
      var bh = 56, bx = 12, bw2 = w-24;
      ctx.fillStyle = '#1a2535';
      ctx.fillRect(bx, y, bw2, bh);
      // 稀有度色条
      ctx.fillStyle = RARITY_COLOR[info.cat] || '#555';
      ctx.fillRect(bx, y, 4, bh);

      // 名称 + 星级
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(info.data.name, bx+12, y+20);
      ctx.fillStyle = '#f1c40f';
      ctx.font = '14px sans-serif';
      ctx.fillText(starStr(stars), bx+12, y+40);

      // 数量
      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('×' + count, bx+bw2-10, y+20);

      // 已装备标记
      var equipped = this._isEquipped(d, itemId, stars);
      if (equipped) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = '11px sans-serif';
        ctx.fillText('[' + equipped + ']', bx+bw2-10, y+40);
      }

      this._itemBtns.push({ itemId: itemId, stars: stars, x: bx, y: y, w: bw2, h: bh });
      y += bh + 4;
    }
  }
};

ItemScene.prototype._isEquipped = function(d, itemId, stars) {
  var equips = d.equips || {};
  var keys = Object.keys(equips);
  for (var i = 0; i < keys.length; i++) {
    var eq = equips[keys[i]];
    if (eq && eq.id === itemId && eq.stars === stars) {
      var race = RACES[keys[i]];
      return race ? race.name : keys[i];
    }
  }
  return null;
};

// ── 宝物详情 ──
ItemScene.prototype._drawDetail = function(d) {
  var ctx = this.ctx, w = this.width, h = this.height;
  var sel = this._selected;
  var info = getItemData(sel.itemId);
  if (!info) return;
  var arr = (d.items||{})[sel.itemId] || [0,0,0];
  var count = arr[sel.stars - 1];

  ctx.fillStyle = '#1a2535';
  ctx.fillRect(0, 46, w, h-46);

  // 宝物名+星级
  ctx.fillStyle = RARITY_COLOR[info.cat]||'#555';
  ctx.fillRect(w/2-80, 66, 160, 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(info.data.name, w/2, 98);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '18px sans-serif';
  ctx.fillText(starStr(sel.stars), w/2, 122);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText(info.data.desc || '', w/2, 144);
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.fillText('持有 ' + count + ' 件', w/2, 164);

  var btnY = 186;

  // 装备按钮
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(w/2-110, btnY, 100, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('装备给→', w/2-60, btnY+26);
  this._equipBtn = { x: w/2-110, y: btnY, w: 100, h: 40 };

  // 升级按钮
  var canUpgrade = sel.stars < 3;
  var upgradeCost2 = canUpgrade ? UPGRADE_COST[sel.stars] : 0;
  var hasShards = (d.itemShards||0) >= upgradeCost2;
  ctx.fillStyle = (canUpgrade && hasShards) ? '#27ae60' : '#444';
  ctx.fillRect(w/2+10, btnY, 100, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(canUpgrade ? ('升★ -' + upgradeCost2 + '碎') : '已满星', w/2+60, btnY+26);
  this._upgradeBtn = { x: w/2+10, y: btnY, w: 100, h: 40, canUpgrade: canUpgrade && hasShards };

  btnY += 52;

  // 分解按钮（规则：总数>1 且 不是最高星级唯一件）
  var total = arr[0]+arr[1]+arr[2];
  var maxStars = arr[2]>0?3:arr[1]>0?2:1;
  // 可分解条件：该星级数量>1，或者该星级不是唯一最高星且total>1
  var isHighestStar = sel.stars === maxStars;
  var canDecompose = count > 1 || (count === 1 && (!isHighestStar || total > 1));
  // 精确判断：如果只有这一件且是最高星，不可分解
  if (count === 1 && isHighestStar && total === 1) canDecompose = false;
  // 如果这是唯一一件（总数1），不可分解
  if (total === 1) canDecompose = false;

  var decompReturn = DECOMPOSE_RETURN[sel.stars - 1];
  ctx.fillStyle = canDecompose ? '#c0392b' : '#444';
  ctx.fillRect(w/2-80, btnY, 160, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(canDecompose ? ('分解 +' + decompReturn + '碎片') : '不可分解', w/2, btnY+26);
  this._decompBtn = { x: w/2-80, y: btnY, w: 160, h: 40, canDecompose: canDecompose, ret: decompReturn };

  btnY += 52;

  // 分解说明
  ctx.fillStyle = '#556';
  ctx.font = '11px sans-serif';
  ctx.fillText('唯一件或最高星唯一件时不可分解', w/2, btnY);

  // 已装备提示
  var equippedBy = this._isEquipped(d, sel.itemId, sel.stars);
  if (equippedBy) {
    ctx.fillStyle = '#2ecc71';
    ctx.font = '13px sans-serif';
    ctx.fillText('已装备给：' + equippedBy, w/2, btnY+20);
  }
};

// ── 选择装备目标种族 ──
ItemScene.prototype._drawEquipPicker = function(d) {
  var ctx = this.ctx, w = this.width;
  var info = getItemData(this._selected.itemId);

  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 46, w, this.height-46);
  ctx.fillStyle = '#bbb';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('将 ' + (info?info.data.name:'') + ' ' + starStr(this._selected.stars) + ' 装备给', w/2, 76);

  // 卸下
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(w/2-60, 84, 120, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('卸下装备', w/2, 105);
  this._unequipBtn = { x: w/2-60, y: 84, w: 120, h: 32 };

  var races = d.unlockedRaces || ['goblin'];
  this._raceBtns = [];
  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId];
    if (!race) continue;
    var eq = (d.equips||{})[raceId];
    var x = 12, y = 124 + i*60, bw = w-24, bh = 52;
    ctx.fillStyle = '#1a2535';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = race.color;
    ctx.beginPath(); ctx.arc(x+22, y+26, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(race.name, x+44, y+22);
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    var eqText = eq ? (eq.id ? (this._getItemName(eq.id) + ' ' + starStr(eq.stars)) : '未装备') : '未装备';
    ctx.fillText('当前：' + eqText, x+44, y+40);
    this._raceBtns.push({ raceId: raceId, x: x, y: y, w: bw, h: bh });
  }
};

ItemScene.prototype._getItemName = function(itemId) {
  var info = getItemData(itemId);
  return info ? info.data.name : itemId;
};

ItemScene.prototype.onTouchStart = function(x, y) {
  // 返回
  if (x>=10&&x<=66&&y>=10&&y<=38) {
    if (this._equipTarget !== null) { this._equipTarget = null; return null; }
    if (this._selected)             { this._selected = null; return null; }
    return 'backToMenu';
  }

  // 装备目标选择
  if (this._equipTarget !== null) {
    var ub = this._unequipBtn;
    if (ub&&x>=ub.x&&x<=ub.x+ub.w&&y>=ub.y&&y<=ub.y+ub.h) {
      // 找到当前装备该宝物的种族并卸下
      var d4 = PlayerData.get();
      var keys = Object.keys(d4.equips||{});
      for (var k=0;k<keys.length;k++) {
        var eq=d4.equips[keys[k]];
        if (eq&&eq.id===this._selected.itemId&&eq.stars===this._selected.stars) {
          delete d4.equips[keys[k]];
        }
      }
      PlayerData.save();
      this._equipTarget = null; return null;
    }
    var rbs = this._raceBtns||[];
    for (var ri=0;ri<rbs.length;ri++) {
      var rb=rbs[ri];
      if (x>=rb.x&&x<=rb.x+rb.w&&y>=rb.y&&y<=rb.y+rb.h) {
        var d5=PlayerData.get();
        if (!d5.equips) d5.equips={};
        d5.equips[rb.raceId]={ id: this._selected.itemId, stars: this._selected.stars };
        PlayerData.save();
        this._equipTarget=null; return null;
      }
    }
    return null;
  }

  // 详情操作
  if (this._selected) {
    var eb=this._equipBtn;
    if (eb&&x>=eb.x&&x<=eb.x+eb.w&&y>=eb.y&&y<=eb.y+eb.h) {
      this._equipTarget=true; return null;
    }
    var upb=this._upgradeBtn;
    if (upb&&upb.canUpgrade&&x>=upb.x&&x<=upb.x+upb.w&&y>=upb.y&&y<=upb.y+upb.h) {
      this._doUpgrade(); return null;
    }
    var db=this._decompBtn;
    if (db&&db.canDecompose&&x>=db.x&&x<=db.x+db.w&&y>=db.y&&y<=db.y+db.h) {
      this._doDecompose(); return null;
    }
    return null;
  }

  // 列表选中
  var ibs=this._itemBtns||[];
  for (var ii=0;ii<ibs.length;ii++) {
    var ib=ibs[ii];
    if (x>=ib.x&&x<=ib.x+ib.w&&y>=ib.y&&y<=ib.y+ib.h) {
      this._selected={ itemId: ib.itemId, stars: ib.stars }; return null;
    }
  }
  return null;
};

ItemScene.prototype._doUpgrade = function() {
  var sel = this._selected;
  if (sel.stars >= 3) return;
  var cost = UPGRADE_COST[sel.stars];
  var d = PlayerData.get();
  if ((d.itemShards||0) < cost) return;
  var arr = d.items[sel.itemId];
  if (!arr || arr[sel.stars-1] <= 0) return;
  d.itemShards -= cost;
  arr[sel.stars-1]--;
  arr[sel.stars] = (arr[sel.stars]||0) + 1;
  // 更新装备中的星级（如果该种族装备了此宝物且星级相同，自动升级）
  var keys = Object.keys(d.equips||{});
  for (var i=0;i<keys.length;i++) {
    var eq=d.equips[keys[i]];
    if (eq&&eq.id===sel.itemId&&eq.stars===sel.stars) eq.stars=sel.stars+1;
  }
  PlayerData.save();
  this._selected = { itemId: sel.itemId, stars: sel.stars + 1 };
};

ItemScene.prototype._doDecompose = function() {
  var sel = this._selected;
  var d = PlayerData.get();
  var arr = d.items[sel.itemId];
  if (!arr || arr[sel.stars-1] <= 0) return;
  arr[sel.stars-1]--;
  d.itemShards = (d.itemShards||0) + DECOMPOSE_RETURN[sel.stars-1];
  // 如果分解的是装备中的宝物，自动卸下
  var keys = Object.keys(d.equips||{});
  for (var i=0;i<keys.length;i++) {
    var eq=d.equips[keys[i]];
    if (eq&&eq.id===sel.itemId&&eq.stars===sel.stars) {
      // 检查仓库还有没有同件
      var remaining=arr[sel.stars-1];
      if (remaining<=0) delete d.equips[keys[i]];
    }
  }
  PlayerData.save();
  // 返回列表（该件可能已清零）
  if (arr[sel.stars-1] <= 0) this._selected = null;
};

ItemScene.prototype.onTouchMove = function() {};
ItemScene.prototype.onTouchEnd = function() {};

module.exports = { ItemScene: ItemScene };
