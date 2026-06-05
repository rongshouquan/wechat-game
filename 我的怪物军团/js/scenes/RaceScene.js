var PlayerData = require('../game/PlayerData').PlayerData;
var RACES = require('../data/races').RACES;
var ITEMS = require('../data/items').ITEMS;
var getRaceStats = require('../game/RaceLevel').getRaceStats;
var ImageCache = require('../utils/ImageCache').ImageCache;

// 升级消耗经验：升到N+1级需要 N*15 经验
function upgradeCost(level) { return level * 15; }

// 获取某等级节点的成长描述
function getGrowthDesc(race, level) {
  var g = race.levelGrowth && race.levelGrowth[level];
  if (!g) return null;
  var parts = [];
  if (g.unitCount)        parts.push('单位数→' + g.unitCount);
  if (g.sizeScale)        parts.push('体型变大');
  if (g.skill)            parts.push('技能附加' + g.skill);
  if (g.skillDmgBoost)    parts.push('技能伤害+' + Math.round(g.skillDmgBoost*100) + '%');
  if (g.doubleHitChance)  parts.push('普攻双击' + Math.round(g.doubleHitChance*100) + '%');
  if (g.stunDuration)     parts.push('眩晕时间→' + g.stunDuration + 's');
  if (g.reviveChance)     parts.push('死亡复活' + Math.round(g.reviveChance*100) + '%');
  if (g.healBoost)        parts.push('治疗+' + Math.round(g.healBoost*100) + '%');
  if (g.normalBleed)      parts.push('普攻流血');
  if (g.armorPen)         parts.push('破甲' + Math.round(g.armorPen*100) + '%');
  if (g.shieldAtkBoost)   parts.push('护盾期间攻击+' + Math.round(g.shieldAtkBoost*100) + '%');
  if (g.lifeStealOnLowHp) parts.push('低血量吸血');
  if (g.permanentShield)  parts.push('护盾永久');
  if (g.extraAttack)      parts.push('技能额外攻击前排');
  return parts.length ? parts.join('  ') : '体型/饰品升级';
}

var RaceScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._selectedRace = null;
  this._showItemPicker = false;
  this._scrollY = 0;
};

RaceScene.prototype.update = function(dt) {};

RaceScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, w, h);

  // 顶栏
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, w, 48);
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('种族管理', w/2, 32);
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 10, 56, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('返回', 38, 30);

  var d = PlayerData.get();
  ctx.fillStyle = '#2ecc71';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('经验：' + (d.monsterExp||0), w-10, 32);

  if (this._showItemPicker) { this._drawItemPicker(d); return; }
  if (this._selectedRace)   { this._drawDetail(d); return; }
  this._drawList(d);
};

// ── 种族列表 ──
RaceScene.prototype._drawList = function(d) {
  var ctx = this.ctx, w = this.width;
  var races = d.unlockedRaces || ['goblin'];
  this._raceBtns = [];

  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId];
    if (!race) continue;
    var level = d.raceLevels[raceId] || 1;
    var stats = getRaceStats(raceId, level);
    var x = 12, y = 56 + i * 82, bw = w-24, bh = 74;

    ctx.fillStyle = '#1a2535';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = race.color;
    ctx.fillRect(x, y, 5, bh);

    // 种族立绘
    var img = race.image ? ImageCache.get(race.image) : null;
    if (img) {
      ctx.drawImage(img, x+8, y+7, 44, 60);
    } else {
      ctx.fillStyle = race.color;
      ctx.beginPath();
      ctx.arc(x+28, y+37, 20, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(race.name, x+28, y+40);
    }

    // 名称+等级
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(race.name, x+56, y+22);
    ctx.fillStyle = '#f1c40f';
    ctx.font = '13px sans-serif';
    ctx.fillText('LV ' + level + ' / 20', x+56, y+40);

    // 属性
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('HP:' + Math.round(race.baseHp * stats.hpMult) + '  ATK:' + Math.round(race.baseAtk * stats.atkMult), x+56, y+58);

    // 已装备宝物
    var equip = (d.equips||{})[raceId];
    var equipName = equip ? this._getItemName(equip) : '未装备';
    ctx.fillStyle = equip ? '#f39c12' : '#555';
    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    ctx.fillText(equipName, x+bw-10, y+22);

    // 升级成本预览
    if (level < 20) {
      var cost = upgradeCost(level);
      var canUp = (d.monsterExp||0) >= cost;
      ctx.fillStyle = canUp ? '#2ecc71' : '#666';
      ctx.fillText('升级:' + cost + '经验', x+bw-10, y+58);
    } else {
      ctx.fillStyle = '#f1c40f';
      ctx.fillText('满级', x+bw-10, y+58);
    }

    this._raceBtns.push({ raceId: raceId, x: x, y: y, w: bw, h: bh });
  }
};

// ── 种族详情 ──
RaceScene.prototype._drawDetail = function(d) {
  var ctx = this.ctx, w = this.width, h = this.height;
  var raceId = this._selectedRace;
  var race = RACES[raceId];
  var level = d.raceLevels[raceId] || 1;
  var stats = getRaceStats(raceId, level);

  ctx.fillStyle = '#1a2535';
  ctx.fillRect(0, 48, w, h-48);

  // 种族立绘（详情页大图）
  var detailImg = race.image ? ImageCache.get(race.image) : null;
  if (detailImg) {
    ctx.drawImage(detailImg, w/2-45, 58, 90, 120);
  } else {
    ctx.fillStyle = race.color;
    ctx.beginPath();
    ctx.arc(w/2, 100, 30, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(race.name, w/2, 104);
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(race.name + '  LV ' + level, w/2, 192);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText(race.role, w/2, 210);

  // 属性
  ctx.fillStyle = '#ccc';
  ctx.font = '13px sans-serif';
  ctx.fillText('HP ' + Math.round(race.baseHp * stats.hpMult) + '   ATK ' + Math.round((race.baseAtk||0) * stats.atkMult), w/2, 230);

  // 已装备宝物
  var equip = (d.equips||{})[raceId];
  ctx.fillStyle = equip ? '#f39c12' : '#666';
  ctx.font = '13px sans-serif';
  ctx.fillText('装备：' + (equip ? this._getItemName(equip) : '未装备'), w/2, 252);

  // 换装备按钮
  ctx.fillStyle = '#8e44ad';
  ctx.fillRect(w/2-60, 262, 120, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('更换宝物', w/2, 284);
  this._equipBtn = { x: w/2-60, y: 262, w: 120, h: 34 };

  // 升级成长节点
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('── 成长预览 ──', w/2, 318);

  var milestones = [5, 10, 15, 20];
  var lineY = 336;
  for (var mi = 0; mi < milestones.length; mi++) {
    var ml = milestones[mi];
    var desc = getGrowthDesc(race, ml);
    if (!desc) continue;
    var reached = level >= ml;
    ctx.fillStyle = reached ? '#2ecc71' : (ml === this._nextMilestone(level) ? '#f1c40f' : '#555');
    ctx.font = (ml === this._nextMilestone(level)) ? 'bold 13px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'left';
    var prefix = reached ? '✓ ' : (ml === this._nextMilestone(level) ? '→ ' : '  ');
    ctx.fillText(prefix + 'LV' + ml + '：' + desc, 20, lineY);
    lineY += 22;
  }

  // 升级按钮
  if (level < 20) {
    var cost = upgradeCost(level);
    var canUp = (d.monsterExp||0) >= cost;
    var btnY = Math.max(lineY + 10, h - 120);
    ctx.fillStyle = canUp ? '#27ae60' : '#444';
    ctx.fillRect(w/2-100, btnY, 200, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('升级  消耗 ' + cost + ' 经验', w/2, btnY+33);
    ctx.fillStyle = canUp ? '#aaffaa' : '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('当前经验：' + (d.monsterExp||0), w/2, btnY+50);
    this._upgradeBtn = { x: w/2-100, y: btnY, w: 200, h: 52, canUp: canUp };
  } else {
    this._upgradeBtn = null;
  }
};

RaceScene.prototype._nextMilestone = function(level) {
  var ms = [5,10,15,20];
  for (var i=0;i<ms.length;i++) { if (level < ms[i]) return ms[i]; }
  return null;
};

// ── 宝物选择 ──
RaceScene.prototype._drawItemPicker = function(d) {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 48, w, h-48);

  ctx.fillStyle = '#bbb';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('为 ' + (RACES[this._selectedRace]||{}).name + ' 选择宝物', w/2, 80);

  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(w/2-60, 88, 120, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('卸下装备', w/2, 109);
  this._unequipBtn2 = { x: w/2-60, y: 88, w: 120, h: 32 };

  // 全部拥有的宝物
  var owned = this._getOwnedItems(d);
  var equippedId = (d.equips||{})[this._selectedRace];
  this._itemBtns2 = [];

  for (var i = 0; i < owned.length; i++) {
    var item = owned[i];
    var x2 = 12, y2 = 128 + i * 62, bw2 = w-24, bh2 = 54;
    ctx.fillStyle = item.id === equippedId ? '#1a3a1a' : '#1a2535';
    ctx.fillRect(x2, y2, bw2, bh2);
    var rarityColor = item.data.rarity==='legendary'?'#f39c12':item.data.rarity==='exclusive'?'#9b59b6':'#2980b9';
    ctx.fillStyle = rarityColor;
    ctx.fillRect(x2, y2, 4, bh2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.data.name + (item.id===equippedId?' [已装备]':''), x2+12, y2+22);
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.fillText(item.data.desc||'', x2+12, y2+40);
    this._itemBtns2.push({ id: item.id, x: x2, y: y2, w: bw2, h: bh2 });
  }
  if (owned.length === 0) {
    ctx.fillStyle = '#555'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('暂无宝物', w/2, 200);
  }
};

RaceScene.prototype._getOwnedItems = function(d) {
  var list = [], owned = d.items||{};
  ['exclusive','legendary','normal'].forEach(function(cat) {
    Object.keys(ITEMS[cat]).forEach(function(id) {
      var arr = owned[id];
      var total = Array.isArray(arr) ? arr[0]+arr[1]+arr[2] : (arr||0);
      if (total > 0) list.push({ id: id, data: ITEMS[cat][id] });
    });
  });
  return list;
};

RaceScene.prototype._getItemName = function(itemId) {
  var cats = ['exclusive','legendary','normal'];
  for (var i=0;i<cats.length;i++) { if (ITEMS[cats[i]][itemId]) return ITEMS[cats[i]][itemId].name; }
  return itemId;
};

RaceScene.prototype.onTouchStart = function(x, y) {
  // 返回
  if (x>=10&&x<=66&&y>=10&&y<=40) {
    if (this._showItemPicker) { this._showItemPicker=false; return null; }
    if (this._selectedRace)   { this._selectedRace=null; return null; }
    return 'backToMenu';
  }

  if (this._showItemPicker) {
    var ub = this._unequipBtn2;
    if (ub&&x>=ub.x&&x<=ub.x+ub.w&&y>=ub.y&&y<=ub.y+ub.h) {
      var d2=PlayerData.get(); if(d2.equips) delete d2.equips[this._selectedRace];
      PlayerData.save(); this._showItemPicker=false; return null;
    }
    var ibs = this._itemBtns2||[];
    for (var i=0;i<ibs.length;i++) {
      var ib=ibs[i];
      if (x>=ib.x&&x<=ib.x+ib.w&&y>=ib.y&&y<=ib.y+ib.h) {
        var d3=PlayerData.get(); if(!d3.equips)d3.equips={};
        d3.equips[this._selectedRace]=ib.id; PlayerData.save();
        this._showItemPicker=false; return null;
      }
    }
    return null;
  }

  if (this._selectedRace) {
    var eb=this._equipBtn;
    if (eb&&x>=eb.x&&x<=eb.x+eb.w&&y>=eb.y&&y<=eb.y+eb.h) {
      this._showItemPicker=true; return null;
    }
    var upb=this._upgradeBtn;
    if (upb&&upb.canUp&&x>=upb.x&&x<=upb.x+upb.w&&y>=upb.y&&y<=upb.y+upb.h) {
      var d4=PlayerData.get();
      var lv=d4.raceLevels[this._selectedRace]||1;
      var cost=upgradeCost(lv);
      if((d4.monsterExp||0)>=cost&&lv<20) {
        d4.monsterExp-=cost; d4.raceLevels[this._selectedRace]=lv+1;
        PlayerData.save();
      }
      return null;
    }
    return null;
  }

  var rbs=this._raceBtns||[];
  for (var j=0;j<rbs.length;j++) {
    var rb=rbs[j];
    if (x>=rb.x&&x<=rb.x+rb.w&&y>=rb.y&&y<=rb.y+rb.h) {
      this._selectedRace=rb.raceId; return null;
    }
  }
  return null;
};
RaceScene.prototype.onTouchMove = function() {};
RaceScene.prototype.onTouchEnd = function() {};

module.exports = { RaceScene: RaceScene };
