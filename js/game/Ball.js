'use strict'

class Ball {
  constructor(x, y, radius, speed) {
    this.x      = x
    this.y      = y
    this.radius = radius
    this.speed  = speed   // px/s
    this.vx     = 0
    this.vy     = 0
    this.launched  = false
    this.piercing  = false  // 穿透道具激活时为 true
    this.alive     = true   // 落出底部后变 false
  }

  // 以角度 angle（弧度，从竖直向上方向偏转）发射
  launch(angle) {
    this.vx = Math.sin(angle) * this.speed
    this.vy = -Math.cos(angle) * this.speed
    this.launched = true
  }

  update(dt, screenW, screenH) {
    if (!this.launched) return

    this.x += this.vx * dt
    this.y += this.vy * dt

    // 左右墙反弹
    if (this.x - this.radius < 0) {
      this.x  = this.radius
      this.vx = Math.abs(this.vx)
    } else if (this.x + this.radius > screenW) {
      this.x  = screenW - this.radius
      this.vx = -Math.abs(this.vx)
    }

    // 顶部反弹
    if (this.y - this.radius < 0) {
      this.y  = this.radius
      this.vy = Math.abs(this.vy)
    }

    // 落出底部 → 死亡
    if (this.y - this.radius > screenH) {
      this.alive = false
    }
  }

  draw(ctx) {
    ctx.save()

    if (this.piercing) {
      ctx.shadowColor = '#00ff88'
      ctx.shadowBlur  = 14
    } else {
      ctx.shadowColor = 'rgba(200,220,255,0.7)'
      ctx.shadowBlur  = 8
    }

    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)

    const r   = this.radius
    const grad = ctx.createRadialGradient(
      this.x - r * 0.3, this.y - r * 0.3, r * 0.1,
      this.x, this.y, r
    )
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.4, '#ddeeff')
    grad.addColorStop(1, this.piercing ? '#00cc66' : '#6688cc')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.restore()
  }
}

module.exports = Ball
