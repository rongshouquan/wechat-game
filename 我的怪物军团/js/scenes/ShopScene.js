var PlayerData = require('../game/PlayerData').PlayerData;
var ITEMS = require('../data/items').ITEMS;

var NORMAL_ITEM_IDS = Object.keys(ITEMS.normal);
var LEGENDARY_IDS  = Object.keys(ITEMS.legendary);

// 返回今日日期字符串 YYYY-MM-DD
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

// 随机抽取：普通宝物保底，累计10次必出传奇
function doPull(pityCount) {
  var isLegendary = pityCount >= 9 || Math.random() < 0.05;
  if (isLegendary) {
    var id = LEGENDARY_IDS[Math.floor(Math.random() * LEGENDARY_IDS.length)];
    return { id: id, data: ITEMS.legendary[id], isPity: pityCount >= 9 };
  }
  var id = NORMAL_ITEM_IDS[Math.floor(Math.random() * NORMAL_ITEM_IDS.length)];
  return { id: id, data: ITEMS.normal[id], isPity: false };
}

var ShopScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._tab = 'daily'; // 'daily' | 'pull'
  this._pullResult = null;
  this._ensureShopData();
};

ShopScene.prototype._ensureShopData = function() {
  var d = PlayerData.get();
  if (!d.shop) d.shop = {};
  var s = d.shop;
  var today = todayStr();
  // 每日重置
  if (s.date !== today) {
    s.date = today;
    s.dailyClaimed = false;
    s.refreshCount = 0;
    s.shopItems = this._genShopItems();
    PlayerData.save();
  }
  if (!s.shopItems) s.shopItems = this._genShopItems();
  if (typeof s.pityCount !== 'number') s.pityCount = 0;
};

ShopScene.prototype._genShopItems = function() {
  // 随机3件普通宝物展示
  var shuffled = NORMAL_ITEM_IDS.slice().sort(function() { return Math.random()-0.5; });
  return shuffled.slice(0, 3);
};

ShopScene.prototype.update = function(dt) {};

ShopScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#1a0a0a';
  ctx.fillRect(0, 0, w, h);

  // 标题
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('商店', w/2, 40);

  // 返回
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 12, 60, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('返回', 40, 34);

  // Tab切换
  this._tabBtns = [
    { id: 'daily', label: '每日商店', x: w/2-110, y: 58, w: 100, h: 36 },
    { id: 'pull',  label: '宝物抽取', x: w/2+10,  y: 58, w: 100, h: 36 }
  ];
  for (var i = 0; i < this._tabBtns.length; i++) {
    var tb = this._tabBtns[i];
    ctx.fillStyle = this._tab === tb.id ? '#c0392b' : '#444';
    ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tb.label, tb.x + tb.w/2, tb.y + tb.h/2 + 6);
  }

  if (this._tab === 'daily') this._drawDaily();
  else this._drawPull();
};

ShopScene.prototype._drawDaily = function() {
  var ctx = this.ctx, w = this.width;
  var d = PlayerData.get();
  var s = d.shop || {};

  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('今日商品（每日刷新2次）  已刷新：' + (s.refreshCount||0) + '/2', w/2, 115);

  this._shopItemBtns = [];
  var items = s.shopItems || [];
  for (var i = 0; i < items.length; i++) {
    var itemId = items[i];
    var item = ITEMS.normal[itemId];
    if (!item) continue;
    var x = 20, y = 128 + i * 70, bw = w - 40, bh = 60;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(x, y, 5, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, x + 14, y + 24);
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.fillText(item.desc || '', x + 14, y + 44);
    // 领取按钮
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(x + bw - 80, y + 12, 70, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('免费领', x + bw - 45, y + 35);
    this._shopItemBtns.push({ itemId: itemId, x: x + bw - 80, y: y + 12, w: 70, h: 36 });
  }

  // 刷新按钮
  var canRefresh = (s.refreshCount || 0) < 2;
  var ry = 128 + 3 * 70 + 10;
  ctx.fillStyle = canRefresh ? '#8e44ad' : '#444';
  ctx.fillRect(w/2 - 80, ry, 160, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(canRefresh ? '刷新商品' : '今日已刷新2次', w/2, ry + 28);
  this._refreshBtn = { x: w/2-80, y: ry, w: 160, h: 44, canRefresh: canRefresh };
};

ShopScene.prototype._drawPull = function() {
  var ctx = this.ctx, w = this.width;
  var d = PlayerData.get();
  var s = d.shop || {};
  var pity = s.pityCount || 0;
  var claimed = s.dailyClaimed;

  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('保底进度：' + pity + '/10（第10次必出传奇）', w/2, 115);

  // 每日免费抽
  var dy = 140;
  ctx.fillStyle = claimed ? '#333' : '#2c3e50';
  ctx.fillRect(w/2-120, dy, 240, 70);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('每日免费抽（×1）', w/2, dy + 28);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText(claimed ? '今日已领取' : '随机1件普通宝物，5%传奇', w/2, dy + 52);
  this._freePullBtn = { x: w/2-120, y: dy, w: 240, h: 70, disabled: claimed };

  // 抽取结果展示
  if (this._pullResult) {
    var pr = this._pullResult;
    ctx.fillStyle = pr.isPity || pr.data.rarity === 'legendary' ? '#f39c12' : '#2980b9';
    ctx.fillRect(w/2-120, dy+90, 240, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('获得：' + pr.data.name, w/2, dy+126);
    if (pr.data.rarity === 'legendary') {
      ctx.fillStyle = '#f1c40f';
      ctx.font = '13px sans-serif';
      ctx.fillText('★ 传奇宝物！', w/2, dy+147);
    }
  }
};

ShopScene.prototype.onTouchStart = function(x, y) {
  // 返回
  if (x >= 10 && x <= 70 && y >= 12 && y <= 46) return 'backToMenu';

  // Tab
  var tabs = this._tabBtns || [];
  for (var i = 0; i < tabs.length; i++) {
    var tb = tabs[i];
    if (x >= tb.x && x <= tb.x+tb.w && y >= tb.y && y <= tb.y+tb.h) {
      this._tab = tb.id; this._pullResult = null; return null;
    }
  }

  if (this._tab === 'daily') {
    // 领取商店物品
    var ibtns = this._shopItemBtns || [];
    for (var j = 0; j < ibtns.length; j++) {
      var ib = ibtns[j];
      if (x >= ib.x && x <= ib.x+ib.w && y >= ib.y && y <= ib.y+ib.h) {
        this._claimItem(ib.itemId, j);
        return null;
      }
    }
    // 刷新
    var rb = this._refreshBtn;
    if (rb && rb.canRefresh && x >= rb.x && x <= rb.x+rb.w && y >= rb.y && y <= rb.y+rb.h) {
      var d2 = PlayerData.get();
      d2.shop.refreshCount = (d2.shop.refreshCount || 0) + 1;
      d2.shop.shopItems = this._genShopItems();
      PlayerData.save();
    }
  } else {
    // 免费抽
    var fp = this._freePullBtn;
    if (fp && !fp.disabled && x >= fp.x && x <= fp.x+fp.w && y >= fp.y && y <= fp.y+fp.h) {
      this._doFreePull();
    }
  }
  return null;
};

ShopScene.prototype._claimItem = function(itemId, idx) {
  var d = PlayerData.get();
  if (!d.items) d.items = {};
  d.items[itemId] = (d.items[itemId] || 0) + 1;
  // 移除已领取的商品
  if (d.shop && d.shop.shopItems) d.shop.shopItems.splice(idx, 1);
  PlayerData.save();
};

ShopScene.prototype._doFreePull = function() {
  var d = PlayerData.get();
  if (!d.shop) d.shop = {};
  var pity = d.shop.pityCount || 0;
  var result = doPull(pity);
  d.shop.pityCount = result.isPity || result.data.rarity === 'legendary' ? 0 : pity + 1;
  d.shop.dailyClaimed = true;
  if (!d.items) d.items = {};
  d.items[result.id] = (d.items[result.id] || 0) + 1;
  PlayerData.save();
  this._pullResult = result;
};

ShopScene.prototype.onTouchMove = function() {};
ShopScene.prototype.onTouchEnd = function() {};

module.exports = { ShopScene: ShopScene };
