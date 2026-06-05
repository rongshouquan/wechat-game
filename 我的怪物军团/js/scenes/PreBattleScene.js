var PlayerData = require('../game/PlayerData').PlayerData;
var RACES = require('../data/races').RACES;
var LEVELS = require('../data/levels').LEVELS;

var SLOT_LABELS = ['前左','前中','前右','后左','后中','后右'];

var PreBattleScene = function(ctx, width, height, levelId, onStart, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.levelId = levelId || 1;
  this.onStart = onStart || function() {};
  this.onBack = onBack || function() {};
  this._levelCfg = LEVELS[(levelId-1)] || LEVELS[0];
  this._editingSlot = null; // 正在编辑的格子
};

PreBattleScene.prototype.update = function(dt) {};

PreBattleScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, h);

  // 顶栏
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(this._levelCfg.name + ' 战前准备', w/2, 30);
  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 9, 56, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('返回', 38, 28);

  if (this._editingSlot !== null) {
    this._drawRacePicker();
  } else {
    this._drawBattleField();
  }
};

PreBattleScene.prototype._drawBattleField = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var d = PlayerData.get();

  var cellW = (w - 40) / 3;
  var cellH = 72;
  var startX = 20;

  // ── 敌方区域 ──
  ctx.fillStyle = '#c0392b';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('敌方阵容（预览）', startX, 66);

  // 构建敌方单位映射 slot -> enemy
  var enemyMap = {};
  var enemies = this._levelCfg.enemies || [];
  for (var e = 0; e < enemies.length; e++) {
    var enc = enemies[e];
    var pos = enc.positions || [0];
    for (var pi = 0; pi < pos.length; pi++) {
      enemyMap[pos[pi]] = enc;
    }
  }

  // 敌方格子（后排在上，前排在下）
  var eRows = [[3,4,5],[0,1,2]];
  for (var er = 0; er < 2; er++) {
    var rowY = 72 + er * (cellH + 6);
    for (var ec = 0; ec < 3; ec++) {
      var slot = eRows[er][ec];
      var enc2 = enemyMap[slot];
      var race = enc2 ? RACES[enc2.raceId] : null;
      var x = startX + ec * cellW, y = rowY;
      ctx.fillStyle = race ? '#2a1a1a' : '#1a1a1a';
      ctx.fillRect(x, y, cellW-4, cellH-4);
      if (race) {
        ctx.fillStyle = race.color;
        ctx.beginPath();
        ctx.arc(x+cellW/2-2, y+22, 14, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(race.name, x+cellW/2-2, y+44);
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.fillText('LV' + enc2.unitLevel, x+cellW/2-2, y+57);
      } else {
        ctx.fillStyle = '#333';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空', x+cellW/2-2, y+cellH/2);
      }
    }
  }

  // 分割线
  var divY = 72 + 2*(cellH+6) + 8;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(startX, divY);
  ctx.lineTo(w-startX, divY);
  ctx.stroke();

  // ── 我方编排区域 ──
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('我方阵容（点击格子编辑，最多4个）', startX, divY+18);

  var lineupMap = {};
  (d.lineup||[]).forEach(function(e) { lineupMap[e.slot] = e.raceId; });

  this._playerSlotBtns = [];
  var pRows = [[3,4,5],[0,1,2]];
  var pRowLabels = ['后排','前排'];
  for (var pr = 0; pr < 2; pr++) {
    var pRowY = divY + 22 + pr * (cellH + 6);
    ctx.fillStyle = '#556';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pRowLabels[pr], startX, pRowY - 2);
    for (var pc = 0; pc < 3; pc++) {
      var pSlot = pRows[pr][pc];
      var pRaceId = lineupMap[pSlot];
      var pRace = pRaceId ? RACES[pRaceId] : null;
      var px = startX + pc * cellW, py = pRowY;
      ctx.fillStyle = pRace ? '#1a2f1a' : '#1a1a2a';
      ctx.fillRect(px, py, cellW-4, cellH-4);
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, cellW-4, cellH-4);
      if (pRace) {
        ctx.fillStyle = pRace.color;
        ctx.beginPath();
        ctx.arc(px+cellW/2-2, py+22, 14, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pRace.name, px+cellW/2-2, py+44);
        ctx.fillStyle = '#f1c40f';
        ctx.font = '10px sans-serif';
        ctx.fillText('LV' + (d.raceLevels[pRaceId]||1), px+cellW/2-2, py+57);
      } else {
        ctx.fillStyle = '#556';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', px+cellW/2-2, py+cellH/2+4);
        ctx.fillStyle = '#445';
        ctx.font = '10px sans-serif';
        ctx.fillText(SLOT_LABELS[pSlot], px+cellW/2-2, py+57);
      }
      this._playerSlotBtns.push({ slot: pSlot, x: px, y: py, w: cellW-4, h: cellH-4 });
    }
  }

  // 已上阵数
  var usedCount = Object.keys(lineupMap).length;
  ctx.fillStyle = '#aaa';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  var infoY = divY + 22 + 2*(cellH+6) + 4;
  ctx.fillText('已上阵 ' + usedCount + ' / 4', w/2, infoY);

  // 开始战斗按钮
  var btnY = h - 72;
  var hasLineup = usedCount > 0;
  ctx.fillStyle = hasLineup ? '#c0392b' : '#444';
  ctx.fillRect(w/2-100, btnY, 200, 54);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('开始战斗', w/2, btnY+34);
  this._startBtn = { x: w/2-100, y: btnY, w: 200, h: 54, enabled: hasLineup };
};

PreBattleScene.prototype._drawRacePicker = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  var d = PlayerData.get();
  var races = d.unlockedRaces || ['goblin'];

  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 46, w, h-46);

  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('选择种族放入 [' + SLOT_LABELS[this._editingSlot] + ']', w/2, 76);

  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(w/2-60, 84, 120, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('清空格子', w/2, 105);
  this._clearBtn2 = { x: w/2-60, y: 84, w: 120, h: 32 };

  this._raceBtns2 = [];
  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId];
    if (!race) continue;
    var lv = d.raceLevels[raceId] || 1;
    var x = 14, y = 124 + i*60, bw = w-28, bh = 52;
    ctx.fillStyle = '#1a2535';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = race.color;
    ctx.beginPath(); ctx.arc(x+22, y+26, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(race.name + '  LV' + lv, x+44, y+22);
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText(race.role, x+44, y+40);
    this._raceBtns2.push({ raceId: raceId, x: x, y: y, w: bw, h: bh });
  }
};

PreBattleScene.prototype.onTouchStart = function(x, y) {
  if (x>=10&&x<=66&&y>=9&&y<=37) {
    if (this._editingSlot !== null) { this._editingSlot = null; return null; }
    this.onBack(); return null;
  }

  if (this._editingSlot !== null) {
    var cb = this._clearBtn2;
    if (cb&&x>=cb.x&&x<=cb.x+cb.w&&y>=cb.y&&y<=cb.y+cb.h) {
      this._assignSlot(this._editingSlot, null);
      this._editingSlot = null; return null;
    }
    var rb2 = this._raceBtns2||[];
    for (var i=0;i<rb2.length;i++) {
      var rb=rb2[i];
      if (x>=rb.x&&x<=rb.x+rb.w&&y>=rb.y&&y<=rb.y+rb.h) {
        this._assignSlot(this._editingSlot, rb.raceId);
        this._editingSlot = null; return null;
      }
    }
    return null;
  }

  // 格子点击
  var psb = this._playerSlotBtns||[];
  for (var j=0;j<psb.length;j++) {
    var b=psb[j];
    if (x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) {
      this._editingSlot=b.slot; return null;
    }
  }

  // 开始战斗
  var sb = this._startBtn;
  if (sb&&sb.enabled&&x>=sb.x&&x<=sb.x+sb.w&&y>=sb.y&&y<=sb.y+sb.h) {
    this.onStart(); return null;
  }
  return null;
};

PreBattleScene.prototype._assignSlot = function(slot, raceId) {
  var d = PlayerData.get();
  if (!d.lineup) d.lineup = [];
  d.lineup = d.lineup.filter(function(e) { return e.slot !== slot; });
  if (raceId) {
    d.lineup = d.lineup.filter(function(e) { return e.raceId !== raceId; });
    if (d.lineup.length < 4) d.lineup.push({ raceId: raceId, slot: slot });
  }
  PlayerData.save();
};

PreBattleScene.prototype.onTouchMove = function() {};
PreBattleScene.prototype.onTouchEnd = function() {};

module.exports = { PreBattleScene: PreBattleScene };
