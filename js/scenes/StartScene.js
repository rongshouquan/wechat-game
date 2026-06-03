'use strict'

const { ROW_COLORS } = require('../game/Brick')

class StartScene {
  constructor(main) {
    this.main = main
    const sw  = main.width
    const sh  = main.height

    this._t = 0   // 动画计时

    // 读取最高分
    this._highScore = wx.getStorageSync('breakout_high') || 0

    // 开始按钮区域
    this._btn = {
      x: sw / 2 - 110,
      y: sh * 0.58,
      w: 220,
      h: 56,
    }

    this._onTouch = this._handleTouch.bind(this)
    main.canvas.addEventListener('touchstart', this._onTouch)
  }

  destroy() {
    this.main.canvas.removeEventListener('touchstart', this._onTouch)
  }

  _handleTouch(e) {
    const { clientX: tx, clientY: ty } = e.touches[0]
    const b = this._btn
    if (tx >= b.x && tx <= b.x + b.w && ty >= b.y && ty <= b.y + b.h) {
      this.main.showGame()
    }
  }

  update(dt) {
    this._t += dt
  }

  draw(ctx) {
    const { width: sw, height: sh } = this.main

    // ── 背景 ──
    const bg = ctx.createLinearGradient(0, 0, 0, sh)
    bg.addColorStop(0, '#0d0d2b')
    bg.addColorStop(1, '#1a0a3d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, sw, sh)

    // ── 顶部装饰砖块（3 行 × 8 列迷你砖） ──
    this._drawDecoBricks(ctx, sw)

    // ── 游戏标题 ──
    const glowSize = 10 + Math.sin(this._t * 1.8) * 5
    ctx.save()
    ctx.shadowColor = 'rgba(100,180,255,0.8)'
    ctx.shadowBlur  = glowSize
    ctx.fillStyle   = '#ffffff'
    ctx.font        = 'bold 52px Arial'
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('打砖块', sw / 2, sh * 0.30)
    ctx.restore()

    // 副标题
    ctx.fillStyle    = 'rgba(180,200,255,0.65)'
    ctx.font         = '16px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('BREAKOUT', sw / 2, sh * 0.30 + 44)

    // ── 最高分 ──
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font      = '14px Arial'
    ctx.fillText('最高分', sw / 2, sh * 0.47)
    ctx.fillStyle = '#FFD700'
    ctx.font      = 'bold 30px Arial'
    ctx.fillText(this._highScore, sw / 2, sh * 0.47 + 32)

    // ── 开始按钮 ──
    const pulse = 0.92 + Math.sin(this._t * 2.5) * 0.08
    this._drawBtn(ctx, this._btn, '开 始 游 戏', '#2A80FF', pulse)

    // ── 底部提示 ──
    ctx.fillStyle    = 'rgba(255,255,255,0.28)'
    ctx.font         = '13px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('共 5 关 · 3 种道具 · 触屏操作', sw / 2, sh * 0.82)
  }

  // 顶部装饰：3 行迷你砖
  _drawDecoBricks(ctx, sw) {
    const cols   = 8
    const bw     = Math.floor((sw - 16) / cols) - 4
    const bh     = 12
    const padX   = 8
    const gap    = 4
    const startY = 18

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (bw + gap)
        const y = startY + r * (bh + gap)

        // 各砖块有轻微透明度变化（用 _t 做波浪动画）
        const phase = (r * cols + c) * 0.4
        const alpha = 0.45 + Math.sin(this._t * 1.2 + phase) * 0.25

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle   = ROW_COLORS[r % ROW_COLORS.length]
        this._roundRect(ctx, x, y, bw, bh, 3)
        ctx.fill()

        // 高光
        ctx.globalAlpha = alpha * 0.4
        ctx.fillStyle   = '#ffffff'
        this._roundRect(ctx, x + 2, y + 1, bw - 4, 3, 1)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  _drawBtn(ctx, btn, label, color, scale) {
    const { x, y, w, h } = btn
    const cx = x + w / 2
    const cy = y + h / 2
    const r  = h / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)

    ctx.shadowColor = color
    ctx.shadowBlur  = 18

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + h, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x,     y + h, x,     y + h - r, r)
    ctx.lineTo(x,     y + r)
    ctx.arcTo(x,     y,     x + r, y, r)
    ctx.closePath()

    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, color)
    grad.addColorStop(1, '#0033AA')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'
    ctx.fillStyle   = '#ffffff'
    ctx.font        = 'bold 20px Arial'
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, cx, cy)

    ctx.restore()
  }

  _roundRect(ctx, x, y, w, h, r) {
    const sr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + sr, y)
    ctx.lineTo(x + w - sr, y)
    ctx.arcTo(x + w, y,     x + w, y + sr, sr)
    ctx.lineTo(x + w, y + h - sr)
    ctx.arcTo(x + w, y + h, x + w - sr, y + h, sr)
    ctx.lineTo(x + sr, y + h)
    ctx.arcTo(x,     y + h, x,     y + h - sr, sr)
    ctx.lineTo(x,     y + sr)
    ctx.arcTo(x,     y,     x + sr, y, sr)
    ctx.closePath()
  }
}

module.exports = StartScene
