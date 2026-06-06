var PlayerData = require('./PlayerData').PlayerData;

// 教程步骤
// 0 = 新玩家刚进备战（未显示对话）
// 1 = 对话已显示，等待拖拽哥布林
// 2 = 哥布林已放置，可以点开始战斗
// 3 = 战斗进行中
// 4 = 第一关胜利，结算对话中
// 5 = 返回城堡，显示解锁动画
// 6 = 城堡引导（指向军团）
// 99 = 新手引导完成

var TutorialFlow = {
  isActive: function() {
    return !!PlayerData.get().isNewPlayer;
  },

  getStep: function() {
    return PlayerData.get().tutorialStep || 0;
  },

  setStep: function(s) {
    var d = PlayerData.get();
    d.tutorialStep = s;
    PlayerData.save();
  },

  finish: function() {
    var d = PlayerData.get();
    d.isNewPlayer = false;
    d.legionUnlocked = true;
    d.treasuryUnlocked = true;
    d.tutorialStep = 99;
    PlayerData.save();
  },

  // 通用对话框绘制（底部弹出，说话人+内容）
  drawDialog: function(ctx, w, h, speaker, text, showTap) {
    var panelH = 130, panelX = 12, panelW = w - 24;
    var panelY = h - panelH - 60; // 留底部空间

    // 面板背景
    ctx.fillStyle = 'rgba(10,16,28,0.94)';
    _roundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,170,80,0.45)';
    ctx.lineWidth = 1.5; ctx.stroke();

    // 说话人
    ctx.fillStyle = '#e0b84b';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(speaker, panelX + 16, panelY + 22);

    // 分隔线
    ctx.strokeStyle = 'rgba(200,170,80,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 12, panelY + 30);
    ctx.lineTo(panelX + panelW - 12, panelY + 30);
    ctx.stroke();

    // 正文（自动换行）
    ctx.fillStyle = '#ddd';
    ctx.font = '14px sans-serif';
    _drawWrappedText(ctx, text, panelX + 16, panelY + 50, panelW - 32, 22);

    // 点击提示
    if (showTap !== false) {
      ctx.fillStyle = 'rgba(180,160,80,0.55)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('点击继续 ▶', panelX + panelW - 14, panelY + panelH - 10);
    }
  },

  // 高亮指引箭头（指向某个矩形区域）
  drawArrow: function(ctx, targetX, targetY) {
    ctx.fillStyle = 'rgba(255,220,60,0.85)';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', targetX, targetY);
  }
};

function _roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function _drawWrappedText(ctx, text, x, y, maxW, lineH) {
  var words = text.split('');
  var line = '', lineY = y;
  for (var i = 0; i < words.length; i++) {
    var test = line + words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, lineY);
      line = words[i];
      lineY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}

module.exports = { TutorialFlow: TutorialFlow };
