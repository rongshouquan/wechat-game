// 游戏背景简介页（首次启动）
// 黑屏白字，点击屏幕后回调 onDone

var IntroScene = function(ctx, width, height, onDone) {
  this.ctx    = ctx;
  this.width  = width;
  this.height = height;
  this.onDone = onDone || function() {};

  // 文字淡入
  this._alpha = 0;
  this._phase = 'fadeIn';   // 'fadeIn' | 'show' | 'fadeOut'
  this._timer = 0;

  // 点击提示闪烁
  this._blinkTimer = 0;
  this._blinkOn    = true;
};

var INTRO_TEXT = [
  '怪物王国因叛乱而衰败。',
  '',
  '作为领主，你必须组建怪物军团，',
  '征服叛军，逐步壮大，',
  '直至击败叛军首领，',
  '重振王国辉煌。',
];

IntroScene.prototype.update = function(dt) {
  this._timer += dt;
  this._blinkTimer += dt;
  if (this._blinkTimer > 0.6) { this._blinkOn = !this._blinkOn; this._blinkTimer = 0; }

  if (this._phase === 'fadeIn') {
    this._alpha = Math.min(1, this._timer / 1.2);
    if (this._alpha >= 1) this._phase = 'show';
  } else if (this._phase === 'fadeOut') {
    this._alpha = Math.max(0, 1 - (this._timer / 0.5));
    if (this._alpha <= 0) this.onDone();
  }
};

IntroScene.prototype.draw = function() {
  var ctx = this.ctx, w = this.width, h = this.height;

  // 纯黑背景
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // 装饰细线（顶部和底部）
  ctx.globalAlpha = this._alpha * 0.3;
  ctx.strokeStyle = '#886633';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.1, h*0.18); ctx.lineTo(w*0.9, h*0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.1, h*0.78); ctx.lineTo(w*0.9, h*0.78); ctx.stroke();
  ctx.globalAlpha = 1;

  // 正文
  ctx.globalAlpha = this._alpha;
  ctx.textAlign = 'center';

  var startY = h * 0.28;
  var lineH   = 34;
  for (var i = 0; i < INTRO_TEXT.length; i++) {
    var line = INTRO_TEXT[i];
    if (!line) { startY += lineH * 0.4; continue; }
    ctx.fillStyle = '#e8d9b0';
    ctx.font = '18px sans-serif';
    ctx.fillText(line, w / 2, startY);
    startY += lineH;
  }

  // 点击提示
  if (this._phase === 'show' && this._blinkOn) {
    ctx.fillStyle = 'rgba(200,190,160,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('点击屏幕继续', w / 2, h * 0.86);
  }

  ctx.globalAlpha = 1;
};

IntroScene.prototype.onTouchStart = function() {
  if (this._phase === 'show') {
    this._phase = 'fadeOut';
    this._timer = 0;
  }
  return null;
};
IntroScene.prototype.onTouchMove = function() {};
IntroScene.prototype.onTouchEnd  = function() {};

module.exports = { IntroScene: IntroScene };
