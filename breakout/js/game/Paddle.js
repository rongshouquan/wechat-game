'use strict'

const WIDE_DURATION   = 10  // 秒
const WIDE_MULTIPLIER = 1.8

class Paddle {
  constructor(x, y, baseWidth, height, screenW) {
    this.x         = x
    this.y         = y
    this.baseWidth = baseWidth
    this.width     = baseWidth
    this.height    = height
    this.screenW   = screenW
    this.wideTimer = 0  // 剩余扩宽时间（秒）
  }

  // 相对位移（触摸滑动调用）
  move(dx) {
    this.x = Math.max(0, Math.min(this.screenW - this.width, this.x + dx))
  }

  get centerX() {
    return this.x + this.width / 2
  }

  activateWide() {
    this.wideTimer = WIDE_DURATION
    this.width = this.baseWidth * WIDE_MULTIPLIER
    // 防止超出右边界
    this.x = Math.min(this.x, this.screenW - this.width)
  }

  update(dt) {
    if (this.wideTimer <= 0) return
    this.wideTimer -= dt
    if (this.wideTimer <= 0) {
      this.wideTimer = 0
      this.width = this.baseWidth
      // 重新夹紧
      this.x = Math.min(this.x, this.screenW - this.width)
    }
  }

  draw(ctx) {
    const { x, y, width: w, height: h } = this
    const r   = h / 2
    const isW = this.wideTimer > 0

    ctx.save()

    ctx.shadowColor = isW ? 'rgba(255,215,0,0.7)' : 'rgba(68,136,255,0.6)'
    ctx.shadowBlur  = 12

    // 圆角矩形
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + h, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x,     y + h, x,     y + h - r, r)
    ctx.lineTo(x,     y + r)
    ctx.arcTo(x,     y,     x + r, y,     r)
    ctx.closePath()

    const grad = ctx.createLinearGradient(x, y, x, y + h)
    if (isW) {
      grad.addColorStop(0, '#FFE066')
      grad.addColorStop(1, '#FF8C00')
    } else {
      grad.addColorStop(0, '#66aaff')
      grad.addColorStop(1, '#0044cc')
    }
    ctx.fillStyle = grad
    ctx.fill()

    // 高光条
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
    ctx.beginPath()
    ctx.moveTo(x + r + 2, y + 2)
    ctx.lineTo(x + w - r - 2, y + 2)
    ctx.arcTo(x + w - 2, y + 2, x + w - 2, y + r, r - 2)
    ctx.lineTo(x + w - 2, y + r)
    ctx.arcTo(x + w - 2, y + h - 2, x + w - r - 2, y + h - 2, r - 2)
    ctx.lineTo(x + r + 2, y + h - 2)
    ctx.arcTo(x + 2, y + h - 2, x + 2, y + r, r - 2)
    ctx.lineTo(x + 2, y + r)
    ctx.arcTo(x + 2, y + 2, x + r + 2, y + 2, r - 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fill()

    ctx.restore()

    // 扩宽倒计时条（显示在球拍下方）
    if (this.wideTimer > 0) {
      const barW = w * (this.wideTimer / WIDE_DURATION)
      ctx.fillStyle = 'rgba(255,215,0,0.7)'
      ctx.fillRect(x, y + h + 3, barW, 3)
    }
  }
}

module.exports = Paddle
