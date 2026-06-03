'use strict'

const TYPES = ['wide', 'multi', 'pierce']

const TYPE_INFO = {
  wide:   { color: '#FF4455', label: '←球拍→' },
  multi:  { color: '#FFD700', label: '多球×3' },
  pierce: { color: '#33FF99', label: '穿透↓↓' },
}

const FALL_SPEED = 160  // px/s

class PowerUp {
  constructor(x, y) {
    this.width  = 52
    this.height = 22
    // 居中在砖块上
    this.x = x - this.width / 2
    this.y = y
    this.type  = TYPES[Math.floor(Math.random() * TYPES.length)]
    this.alive = true
    this._t    = 0   // 用于闪烁动画
  }

  update(dt, screenH) {
    this.y += FALL_SPEED * dt
    this._t += dt * 5
    if (this.y > screenH + this.height) {
      this.alive = false
    }
  }

  // 与球拍 AABB 碰撞检测
  checkPaddle(paddle) {
    return (
      this.x + this.width  > paddle.x &&
      this.x               < paddle.x + paddle.width &&
      this.y + this.height > paddle.y &&
      this.y               < paddle.y + paddle.height
    )
  }

  draw(ctx) {
    if (!this.alive) return

    const { x, y, width: w, height: h, type } = this
    const info   = TYPE_INFO[type]
    const r      = h / 2
    const alpha  = 0.72 + Math.sin(this._t) * 0.28

    ctx.save()
    ctx.globalAlpha = alpha

    ctx.shadowColor = info.color
    ctx.shadowBlur  = 10

    // 胶囊背景
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + h, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h,     x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y,         x + r, y, r)
    ctx.closePath()
    ctx.fillStyle = info.color
    ctx.fill()

    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // 文字
    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'
    ctx.fillStyle   = '#ffffff'
    ctx.font        = 'bold 10px Arial'
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(info.label, x + w / 2, y + h / 2)

    ctx.restore()
  }
}

module.exports = { PowerUp, TYPE_INFO }
