var PlayerData = require('../game/PlayerData').PlayerData;
var RACES = require('../data/races').RACES;

// 战场格子说明
var SLOT_LABELS = ['前排左','前排中','前排右','后排左','后排中','后排右'];

var LineupScene = function(ctx, width, height, onBack) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  this.onBack = onBack || function() {};
  this._selectedSlot = null;   // 当前点击的格子索引(0-5)
  this._editingSlot = false;   // 是否在选择种族放入该格子
};

LineupScene.prototype.update = function(dt) {};

LineupScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;
  ctx.fillStyle = '#0f1923';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#e0b84b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('阵容编排', w/2, 40);

  ctx.fillStyle = '#34495e';
  ctx.fillRect(10, 12, 60, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('返回', 40, 34);

  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('最多上阵4个种族，点击格子编辑', w/2, 66);

  if (!this._editingSlot) {
    this._drawGrid();
  } else {
    this._drawRacePicker();
  }
};

LineupScene.prototype._drawGrid = function() {
  var ctx = this.ctx, w = this.width;
  var d = PlayerData.get();
  var lineupMap = {}; // slot -> raceId
  (d.lineup || []).forEach(function(e) { lineupMap[e.slot] = e.raceId; });

  this._slotBtns = [];
  var cellW = (w - 60) / 3, cellH = 80;
  var startX = 30;

  // 敌方区域提示
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(startX, 85, w-60, cellH*2);
  ctx.fillStyle = '#333';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('敌方区域', w/2, 125);

  // 分割线
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1;
  ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(startX, 85 + cellH*2 + 10);
  ctx.lineTo(w-startX, 85 + cellH*2 + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // 玩家格子（前排在下，后排在上靠近分割线）
  // 显示顺序：后排(slot3-5)在上，前排(slot0-2)在下
  var rows = [[3,4,5],[0,1,2]];
  var rowLabels = ['后排','前排'];
  for (var r = 0; r < 2; r++) {
    var rowY = 85 + cellH*2 + 20 + r * (cellH + 8);
    ctx.fillStyle = '#444';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(rowLabels[r], startX, rowY - 2);

    for (var c = 0; c < 3; c++) {
      var slot = rows[r][c];
      var x = startX + c * cellW, y = rowY;
      var raceId = lineupMap[slot];
      var race = raceId ? RACES[raceId] : null;
      var isSelected = this._selectedSlot === slot;

      ctx.fillStyle = isSelected ? '#2c4a6a' : (race ? '#1a2f1a' : '#1a1a2a');
      ctx.fillRect(x, y, cellW - 4, cellH - 4);
      ctx.strokeStyle = isSelected ? '#f1c40f' : '#334';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x, y, cellW - 4, cellH - 4);

      if (race) {
        ctx.fillStyle = race.color;
        ctx.beginPath();
        ctx.arc(x + cellW/2 - 2, y + 28, 16, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(race.name, x + cellW/2 - 2, y + 56);
      } else {
        ctx.fillStyle = '#445';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(SLOT_LABELS[slot], x + cellW/2 - 2, y + 35);
        ctx.fillStyle = '#556';
        ctx.font = '20px sans-serif';
        ctx.fillText('+', x + cellW/2 - 2, y + 52);
      }

      this._slotBtns.push({ slot: slot, x: x, y: y, w: cellW-4, h: cellH-4 });
    }
  }

  // 底部说明
  var usedSlots = Object.keys(lineupMap).length;
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('已上阵：' + usedSlots + '/4', w/2, 85+cellH*2+20+2*(cellH+8)+20);
};

LineupScene.prototype._drawRacePicker = function() {
  var ctx = this.ctx, w = this.width;
  var d = PlayerData.get();
  var races = d.unlockedRaces || ['goblin'];

  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('选择种族放入 [' + SLOT_LABELS[this._selectedSlot] + ']', w/2, 82);

  // 清空该格子按钮
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(w/2-70, 92, 140, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('清空该格子', w/2, 116);
  this._clearBtn = { x: w/2-70, y: 92, w: 140, h: 36 };

  this._raceBtns2 = [];
  for (var i = 0; i < races.length; i++) {
    var raceId = races[i];
    var race = RACES[raceId];
    if (!race) continue;
    var x = 20, y = 138 + i * 66, bw = w-40, bh = 56;
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = race.color;
    ctx.beginPath();
    ctx.arc(x+26, y+28, 16, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(race.name, x+50, y+24);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(race.role, x+50, y+42);
    this._raceBtns2.push({ raceId: raceId, x: x, y: y, w: bw, h: bh });
  }
};

LineupScene.prototype.onTouchStart = function(x, y) {
  if (x >= 10 && x <= 70 && y >= 12 && y <= 46) {
    if (this._editingSlot) { this._editingSlot = false; return null; }
    return 'backToMenu';
  }

  if (!this._editingSlot) {
    var btns = this._slotBtns || [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
        this._selectedSlot = b.slot;
        this._editingSlot = true;
        return null;
      }
    }
  } else {
    // 清空格子
    var cb = this._clearBtn;
    if (cb && x >= cb.x && x <= cb.x+cb.w && y >= cb.y && y <= cb.y+cb.h) {
      this._assignSlot(this._selectedSlot, null);
      this._editingSlot = false;
      return null;
    }
    // 选择种族
    var rbtns = this._raceBtns2 || [];
    for (var j = 0; j < rbtns.length; j++) {
      var rb = rbtns[j];
      if (x >= rb.x && x <= rb.x+rb.w && y >= rb.y && y <= rb.y+rb.h) {
        this._assignSlot(this._selectedSlot, rb.raceId);
        this._editingSlot = false;
        return null;
      }
    }
  }
  return null;
};

LineupScene.prototype._assignSlot = function(slot, raceId) {
  var d = PlayerData.get();
  if (!d.lineup) d.lineup = [];
  // 移除该格子原有数据
  d.lineup = d.lineup.filter(function(e) { return e.slot !== slot; });
  // 移除该种族在其他格子（同种族只能上阵一次）
  if (raceId) {
    d.lineup = d.lineup.filter(function(e) { return e.raceId !== raceId; });
    // 限制最多4个
    if (d.lineup.length < 4) d.lineup.push({ raceId: raceId, slot: slot });
  }
  PlayerData.save();
};

LineupScene.prototype.onTouchMove = function() {};
LineupScene.prototype.onTouchEnd = function() {};

module.exports = { LineupScene: LineupScene };
