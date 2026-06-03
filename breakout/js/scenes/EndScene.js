'use strict'

class EndScene {
  constructor(main, score, won) {
    this.main  = main
    this._score = score
    this._won   = won      // true=通关全部5关, false=游戏失败
    this._t     = 0

    const sw = main.width
    const sh = main.height

    // 读取并更新最高分
    const prev = wx.getStorageSync('breakout_high') || 0
    this._isNewRecord = score > prev
    this._highScore   = this._isNewRecord ? score : prev
    if (this._isNewRecord) {
      wx.setStorageSync('breakout_high', score)
    }

    // 按钮区域
    const btnW = 200
    const btnH = 52
    const btnX = sw / 2 - btnW / 2
    this._btnReplay = { x: btnX, y: sh * 0.65,       w: btnW, h: btnH }
    this._btnHome   = { x: btnX, y: sh * 0.65 + 70,  w: btnW, h: btnH }

  }

  destroy() {}

  onTouchStart(e) {
    const { clientX: tx, clientY: ty } = e.touches[0]
    if (this._inBtn(tx, ty, this._btnReplay)) {
      this.main.showGame()
    } else if (this._inBtn(tx, ty, this._btnHome)) {
      this.main.showStart()
    }
  }

  _inBtn(tx, ty, btn) {
    return tx >= btn.x && tx <= btn.x + btn.w &&
           ty >= btn.y && ty <= btn.y + btn.h
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

    // ── 结果标题 ──
    const titleY = sh * 0.22
    if (this._won) {
      // 通关：金色标题 + 光晕
      const glow = 12 + Math.sin(this._t * 2) * 6
      ctx.save()
      ctx.shadowColor = 'rgba(255,215,0,0.9)'
      ctx.shadowBlur  = glow
      ctx.fillStyle   = '#FFD700'
      ctx.font        = 'bold 46px Arial'
      ctx.textAlign   = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('★ 恭喜通关！', sw / 2, titleY)
      ctx.restore()

      ctx.fillStyle    = 'rgba(255,220,100,0.7)'
      ctx.font         = '18px Arial'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('全部 5 关已完成', sw / 2, titleY + 44)
    } else {
      ctx.fillStyle    = '#FF4455'
      ctx.font         = 'bold 46px Arial'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('游戏结束', sw / 2, titleY)

      ctx.fillStyle = 'rgba(255,100,120,0.65)'
      ctx.font      = '18px Arial'
      ctx.fillText('再接再厉！', sw / 2, titleY + 44)
    }

    // ── 得分卡片 ──
    const cardY = sh * 0.40
    const cardW = sw - 60
    const cardX = 30
    const cardH = 90
    this._drawCard(ctx, cardX, cardY, cardW, cardH)

    ctx.fillStyle    = 'rgba(255,255,255,0.5)'
    ctx.font         = '13px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('本局得分', sw / 2, cardY + 22)

    // 得分数字（带入场动画：先放大再稳定）
    const scaleAnim = Math.min(1, this._t * 3)
    const scoreScale = 0.5 + scaleAnim * 0.5
    ctx.save()
    ctx.translate(sw / 2, cardY + 60)
    ctx.scale(scoreScale, scoreScale)
    ctx.translate(-sw / 2, -(cardY + 60))
    ctx.fillStyle    = '#FFD700'
    ctx.font         = 'bold 38px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this._score, sw / 2, cardY + 60)
    ctx.restore()

    // ── 最高分 ──
    const hsY = cardY + cardH + 22
    ctx.fillStyle    = 'rgba(255,255,255,0.45)'
    ctx.font         = '13px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('最高分', sw / 2, hsY)

    ctx.fillStyle = this._isNewRecord ? '#FFD700' : 'rgba(255,255,255,0.75)'
    ctx.font      = 'bold 26px Arial'
    ctx.fillText(this._highScore, sw / 2, hsY + 26)

    // NEW 徽章
    if (this._isNewRecord) {
      this._drawNewBadge(ctx, sw / 2 + 50, hsY + 14)
    }

    // ── 按钮 ──
    this._drawBtn(ctx, this._btnReplay, '再玩一次', '#2A80FF')
    this._drawBtn(ctx, this._btnHome,   '返回主页', '#444466')
  }

  _drawCard(ctx, x, y, w, h) {
    const r = 14
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth   = 1
    this._roundRect(ctx, x, y, w, h, r)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  _drawNewBadge(ctx, x, y) {
    const pulse = 0.9 + Math.sin(this._t * 4) * 0.1
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(pulse, pulse)

    ctx.fillStyle = '#FF4444'
    ctx.beginPath()
    ctx.arc(0, 0, 20, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle    = '#ffffff'
    ctx.font         = 'bold 11px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NEW', 0, 0)
    ctx.restore()
  }

  _drawBtn(ctx, btn, label, color) {
    const { x, y, w, h } = btn
    const cx = x + w / 2
    const cy = y + h / 2
    const r  = h / 2

    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur  = 12

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

    ctx.fillStyle = color
    ctx.fill()

    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'
    ctx.fillStyle   = '#ffffff'
    ctx.font        = 'bold 19px Arial'
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

module.exports = EndScene
