'use strict'

// 普通砖按行变色
const ROW_COLORS = [
  '#E84040', // 红
  '#FF8C00', // 橙
  '#F5C400', // 黄
  '#2DB85A', // 绿
  '#2A80FF', // 蓝
  '#A020F0', // 紫
]

class Brick {
  constructor(x, y, width, height, type, hp, row) {
    this.x      = x
    this.y      = y
    this.width  = width
    this.height = height
    this.type   = type   // 'normal' | 'hard' | 'power'
    this.hp     = hp
    this.maxHp  = hp
    this.row    = row    // 用于颜色选择
    this.alive  = true
  }

  // 返回 { destroyed: bool, dropPowerUp: bool }
  hit() {
    this.hp--
    if (this.hp <= 0) {
      this.alive = false
      return { destroyed: true, dropPowerUp: this.type === 'power' }
    }
    return { destroyed: false, dropPowerUp: false }
  }

  draw(ctx) {
    if (!this.alive) return

    const { x, y, width: w, height: h, type, hp, maxHp, row } = this
    const r = 4

    ctx.save()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur  = 0

    // 确定填充色
    let baseColor
    if (type === 'hard') {
      const ratio  = hp / maxHp           // 1.0 → 完好, 趋近 0 → 破损
      const gray   = Math.round(80 + ratio * 80)  // 80-160
      baseColor = `rgb(${gray},${gray},${gray})`
    } else if (type === 'power') {
      ctx.shadowColor = 'rgba(255,215,0,0.9)'
      ctx.shadowBlur  = 10
      baseColor = '#FFD700'
    } else {
      baseColor = ROW_COLORS[row % ROW_COLORS.length]
    }

    // 砖块主体
    this._roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r)
    ctx.fillStyle = baseColor
    ctx.fill()

    // 顶部高光
    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    this._roundRect(ctx, x + 3, y + 2, w - 6, Math.min(4, h * 0.35), 2)
    ctx.fill()

    // 硬砖裂纹
    if (type === 'hard' && hp < maxHp) {
      this._drawCracks(ctx, x, y, w, h, hp, maxHp)
    }

    // 道具砖星号
    if (type === 'power') {
      const fontSize = Math.min(h - 4, 13)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('★', x + w / 2, y + h / 2)
    }

    ctx.restore()
  }

  _drawCracks(ctx, x, y, w, h, hp, maxHp) {
    const cx = x + w / 2
    const cy = y + h / 2

    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth   = 1
    ctx.lineCap     = 'round'

    // 第一级裂纹（hp < maxHp 时都显示）
    ctx.beginPath()
    ctx.moveTo(cx - 4, cy - 2)
    ctx.lineTo(cx + 1, cy + 2)
    ctx.lineTo(cx + 5, cy - 1)
    ctx.stroke()

    // 第二级裂纹（hp === 1 且 maxHp >= 3）
    if (maxHp >= 3 && hp === 1) {
      ctx.beginPath()
      ctx.moveTo(cx + 2, cy - 5)
      ctx.lineTo(cx - 3, cy + 3)
      ctx.moveTo(cx - 7, cy)
      ctx.lineTo(cx + 6, cy + 2)
      ctx.stroke()
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    const safeR = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + safeR, y)
    ctx.lineTo(x + w - safeR, y)
    ctx.arcTo(x + w, y,     x + w, y + safeR, safeR)
    ctx.lineTo(x + w, y + h - safeR)
    ctx.arcTo(x + w, y + h, x + w - safeR, y + h, safeR)
    ctx.lineTo(x + safeR, y + h)
    ctx.arcTo(x, y + h, x, y + h - safeR, safeR)
    ctx.lineTo(x, y + safeR)
    ctx.arcTo(x, y,     x + safeR, y, safeR)
    ctx.closePath()
  }
}

module.exports = { Brick, ROW_COLORS }
