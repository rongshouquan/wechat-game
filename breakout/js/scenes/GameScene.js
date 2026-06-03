'use strict'

const Ball      = require('../game/Ball')
const Paddle    = require('../game/Paddle')
const { Brick } = require('../game/Brick')
const { PowerUp } = require('../game/PowerUp')
const LEVELS    = require('../game/Levels')

// ── 布局常量 ──────────────────────────────────────────────
const HEADER_H   = 55    // HUD 区高度
const BRICK_COLS = 8
const BRICK_GAP  = 4     // 砖块水平/垂直间距
const BRICK_H    = 18    // 砖块高度
const BRICK_PAD  = 8     // 左右边距
const BRICK_TOP  = HEADER_H + 12  // 砖块区起始 Y

const PADDLE_W   = 80
const PADDLE_H   = 14
const BALL_R     = 8
const PIERCE_DUR = 8     // 穿透道具持续秒数

class GameScene {
  constructor(main) {
    this.main = main
    const sw = main.width
    const sh = main.height

    this._score = 0
    this._lives = 3
    this._level = 0
    this._state = 'ready'   // 'ready'|'playing'|'levelclear'|'gameover'
    this._stateTimer = 0

    this._balls      = []
    this._bricks     = []
    this._powerUps   = []
    this._floats     = []   // 浮动得分文字
    this._pierceTimer = 0   // 穿透道具剩余时间

    this._touchX = 0

    // 砖块宽度：8 列均分可用宽度
    this._brickW = Math.floor(
      (sw - BRICK_PAD * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS
    )

    // 球拍（水平居中，距底部 75px）
    this._paddle = new Paddle(
      (sw - PADDLE_W) / 2,
      sh - 75,
      PADDLE_W, PADDLE_H, sw
    )

    this._loadLevel(0)
  }

  destroy() {}

  // ── 关卡加载 ──────────────────────────────────────────────
  _loadLevel(idx) {
    this._level       = idx
    this._bricks      = []
    this._powerUps    = []
    this._floats      = []
    this._pierceTimer = 0

    // 重置球拍宽度（防止道具效果跨关卡残留）
    this._paddle.wideTimer = 0
    this._paddle.width     = this._paddle.baseWidth

    const rows = LEVELS[idx].bricks

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const code = rows[r][c]
        if (code === 0) continue

        const bx = BRICK_PAD + c * (this._brickW + BRICK_GAP)
        const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP)

        let type, hp
        if      (code === 1) { type = 'normal'; hp = 1 }
        else if (code === 2) { type = 'hard';   hp = 2 }
        else if (code === 3) { type = 'hard';   hp = 3 }
        else                 { type = 'power';  hp = 1 }

        this._bricks.push(new Brick(bx, by, this._brickW, BRICK_H, type, hp, r))
      }
    }

    this._resetBall(LEVELS[idx].speed)
    this._state = 'ready'
  }

  _resetBall(speed) {
    const s = speed !== undefined ? speed : LEVELS[this._level].speed
    const p = this._paddle
    this._balls = [new Ball(p.centerX, p.y - BALL_R, BALL_R, s)]
  }

  // ── 触摸控制 ──────────────────────────────────────────────
  onTouchStart(e) {
    this._touchX = e.touches[0].clientX
    if (this._state !== 'ready') return

    // 随机角度 ±30° 发射
    const angle = (Math.random() - 0.5) * (Math.PI / 3)
    this._balls.forEach(b => b.launch(angle))
    this._state = 'playing'
  }

  onTouchMove(e) {
    const tx = e.touches[0].clientX
    const dx = tx - this._touchX
    this._touchX = tx
    this._paddle.move(dx)

    // ready 状态：球跟随球拍
    if (this._state === 'ready' && this._balls[0]) {
      this._balls[0].x = Math.max(
        BALL_R,
        Math.min(this.main.width - BALL_R, this._paddle.centerX)
      )
    }
  }

  // ── 主更新 ────────────────────────────────────────────────
  update(dt) {
    // 过渡状态：等待计时器归零后跳转
    if (this._state === 'levelclear' || this._state === 'gameover') {
      this._stateTimer -= dt
      if (this._stateTimer <= 0) {
        if (this._state === 'gameover') {
          this.main.showEnd(this._score, false)   // 游戏失败
        } else {
          const next = this._level + 1
          next >= LEVELS.length
            ? this.main.showEnd(this._score, true)  // 全关通关
            : this._loadLevel(next)
        }
      }
      return
    }

    this._paddle.update(dt)
    if (this._state === 'ready') return

    // ── playing ──
    // 穿透计时
    if (this._pierceTimer > 0) {
      this._pierceTimer -= dt
      if (this._pierceTimer <= 0) {
        this._pierceTimer = 0
        this._balls.forEach(b => { b.piercing = false })
      }
    }

    // 更新球（移动 + 墙壁反弹）
    this._balls.forEach(b => b.update(dt, this.main.width, this.main.height))
    this._balls = this._balls.filter(b => b.alive)

    // 碰撞检测
    this._balls.forEach(b => this._collidePaddle(b))
    this._balls.forEach(b => this._collideBricks(b))

    // 道具下落 + 收集
    this._powerUps.forEach(p => {
      p.update(dt, this.main.height)
      if (p.alive && p.checkPaddle(this._paddle)) {
        this._applyPower(p.type)
        p.alive = false
      }
    })
    this._powerUps = this._powerUps.filter(p => p.alive)

    // 浮动文字动画
    this._floats = this._floats.filter(f => {
      f.y     += f.vy * dt
      f.alpha -= dt * 1.4
      return f.alpha > 0
    })

    // ★ 先检测通关，再检测球落底（防止同帧冲突）
    if (this._bricks.length > 0 && this._bricks.every(b => !b.alive)) {
      this._score     += 100 * (this._level + 1)
      this._state      = 'levelclear'
      this._stateTimer = 1.8
      return
    }

    // 所有球落底 → 扣命
    if (this._balls.length === 0) {
      this._lives--
      if (this._lives <= 0) {
        this._lives      = 0
        this._state      = 'gameover'
        this._stateTimer = 2.2
      } else {
        this._resetBall()
        this._state = 'ready'
      }
    }
  }

  // ── 碰撞：球 vs 球拍 ──────────────────────────────────────
  _collidePaddle(ball) {
    const p = this._paddle
    // 只在球下落时检测（防止球从下方穿入）
    if (ball.vy <= 0) return

    if (ball.x + ball.radius < p.x           ||
        ball.x - ball.radius > p.x + p.width ||
        ball.y + ball.radius < p.y           ||
        ball.y - ball.radius > p.y + p.height) return

    // 根据命中位置（0~1）计算反弹角，边缘角度更大
    const ratio = (ball.x - p.x) / p.width
    const angle = (ratio - 0.5) * (Math.PI * 0.55)   // ±49.5°
    const spd   = Math.hypot(ball.vx, ball.vy)
    ball.vx = Math.sin(angle) * spd
    ball.vy = -Math.cos(angle) * spd
    // 防止球卡入球拍
    ball.y  = p.y - ball.radius - 1
  }

  // ── 碰撞：球 vs 砖块组 ────────────────────────────────────
  _collideBricks(ball) {
    for (let i = 0; i < this._bricks.length; i++) {
      const brick = this._bricks[i]
      if (!brick.alive) continue

      const hit = this._circleRect(ball, brick)
      if (!hit) continue

      // 穿透状态不反弹
      if (!ball.piercing) {
        this._bounce(ball, hit)
      }

      const res = brick.hit()

      if (res.destroyed) {
        const pts = brick.type === 'normal' ? 10
                  : brick.type === 'power'  ? 20
                  : 25   // hard: 击碎 = 最后一击15 + 奖励10
        this._score += pts
        this._addFloat(brick.x + brick.width / 2, brick.y, '+' + pts)

        if (res.dropPowerUp) {
          this._powerUps.push(
            new PowerUp(brick.x + brick.width / 2, brick.y + brick.height)
          )
        }
      } else if (brick.type === 'hard') {
        // 硬砖非最终一击
        this._score += 15
        this._addFloat(brick.x + brick.width / 2, brick.y, '+15')
      }

      // 非穿透：每帧每个球只与一块砖碰撞（防多重碰撞）
      if (!ball.piercing) break
    }
  }

  // 圆形 vs 矩形：返回 {dx,dy} 或 null
  _circleRect(ball, rect) {
    const cx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width))
    const cy = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height))
    const dx = ball.x - cx
    const dy = ball.y - cy
    if (dx * dx + dy * dy >= ball.radius * ball.radius) return null
    return { dx, dy }
  }

  // 反弹方向：比较两轴穿透深度，选较小的轴反弹
  _bounce(ball, { dx, dy }) {
    const overX = ball.radius - Math.abs(dx)
    const overY = ball.radius - Math.abs(dy)
    if (overX < overY) {
      // 左右碰
      ball.vx = dx < 0 ? -Math.abs(ball.vx) : Math.abs(ball.vx)
    } else {
      // 上下碰
      ball.vy = dy < 0 ? -Math.abs(ball.vy) : Math.abs(ball.vy)
    }
  }

  // ── 道具效果 ──────────────────────────────────────────────
  _applyPower(type) {
    if (type === 'wide') {
      this._paddle.activateWide()

    } else if (type === 'multi') {
      const src = this._balls.find(b => b.launched)
      if (!src) return
      const spd  = Math.hypot(src.vx, src.vy)
      const base = Math.atan2(src.vx, -src.vy)
      ;[-Math.PI / 5, Math.PI / 5].forEach(off => {
        const a  = base + off
        const nb = new Ball(src.x, src.y, BALL_R, spd)
        nb.launched = true
        nb.vx       = Math.sin(a) * spd
        nb.vy       = -Math.cos(a) * spd
        nb.piercing = src.piercing
        this._balls.push(nb)
      })

    } else if (type === 'pierce') {
      this._pierceTimer = PIERCE_DUR
      this._balls.forEach(b => { b.piercing = true })
    }
  }

  _addFloat(x, y, text) {
    this._floats.push({ x, y, text, alpha: 1.3, vy: -52 })
  }

  // ── 绘制 ──────────────────────────────────────────────────
  draw(ctx) {
    const { width: sw, height: sh } = this.main

    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, 0, sh)
    bg.addColorStop(0, '#0d0d2b')
    bg.addColorStop(1, '#1a0a3d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, sw, sh)

    this._drawHUD(ctx, sw)

    // HUD 分割线
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(0, HEADER_H)
    ctx.lineTo(sw, HEADER_H)
    ctx.stroke()

    // 穿透道具进度条（HUD 线下方）
    if (this._pierceTimer > 0) {
      const bw = sw * 0.38
      const bx = (sw - bw) / 2
      const by = HEADER_H + 4
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(bx, by, bw, 4)
      ctx.fillStyle = '#33FF99'
      ctx.fillRect(bx, by, bw * (this._pierceTimer / PIERCE_DUR), 4)
    }

    // 游戏对象
    this._bricks.forEach(b => b.draw(ctx))
    this._powerUps.forEach(p => p.draw(ctx))
    this._paddle.draw(ctx)
    this._balls.forEach(b => b.draw(ctx))

    // 浮动得分
    ctx.font         = 'bold 15px Arial'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    this._floats.forEach(f => {
      ctx.save()
      ctx.globalAlpha = Math.min(1, f.alpha)
      ctx.fillStyle   = '#FFD700'
      ctx.fillText(f.text, f.x, f.y)
      ctx.restore()
    })

    // ── 状态覆盖层 ──
    if (this._state === 'ready')      this._drawReady(ctx, sw, sh)
    if (this._state === 'levelclear') this._drawLevelClear(ctx, sw, sh)
    if (this._state === 'gameover')   this._drawGameOver(ctx, sw, sh)
  }

  _drawHUD(ctx, sw) {
    ctx.save()
    ctx.textBaseline = 'top'

    // 得分（左）
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font      = '11px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('得分', 12, 8)
    ctx.fillStyle = '#FFD700'
    ctx.font      = 'bold 22px Arial'
    ctx.fillText(this._score, 12, 22)

    // 关卡（中）
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font      = '11px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`第 ${this._level + 1} / ${LEVELS.length} 关`, sw / 2, 8)
    ctx.fillStyle = '#ffffff'
    ctx.font      = 'bold 20px Arial'
    ctx.fillText(`关卡 ${this._level + 1}`, sw / 2, 24)

    // 生命（右）
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font      = '11px Arial'
    ctx.textAlign = 'right'
    ctx.fillText('生命', sw - 12, 8)
    ctx.fillStyle = '#FF4455'
    ctx.font      = 'bold 20px Arial'
    const hearts = '♥'.repeat(this._lives) + '♡'.repeat(Math.max(0, 3 - this._lives))
    ctx.fillText(hearts, sw - 12, 24)

    ctx.restore()
  }

  _drawReady(ctx, sw, sh) {
    ctx.save()
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    // 非第一关显示关卡标题
    if (this._level > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, sh / 2 - 70, sw, 58)
      ctx.fillStyle = '#FFD700'
      ctx.font      = 'bold 30px Arial'
      ctx.fillText(`第 ${this._level + 1} 关`, sw / 2, sh / 2 - 42)
    }

    // 发射提示
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font      = '17px Arial'
    ctx.fillText('点击屏幕发射', sw / 2, this._paddle.y - 36)
    ctx.restore()
  }

  _drawLevelClear(ctx, sw, sh) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.50)'
    ctx.fillRect(0, 0, sw, sh)

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = '#FFD700'
    ctx.font         = 'bold 36px Arial'
    ctx.fillText(`第 ${this._level + 1} 关通关！`, sw / 2, sh / 2 - 22)

    ctx.fillStyle = '#ffffff'
    ctx.font      = '22px Arial'
    ctx.fillText(`奖励 +${100 * (this._level + 1)} 分`, sw / 2, sh / 2 + 22)
    ctx.restore()
  }

  _drawGameOver(ctx, sw, sh) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, sw, sh)

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = '#FF4455'
    ctx.font         = 'bold 40px Arial'
    ctx.fillText('游戏结束', sw / 2, sh / 2 - 22)

    ctx.fillStyle = '#FFD700'
    ctx.font      = '26px Arial'
    ctx.fillText('得分：' + this._score, sw / 2, sh / 2 + 22)
    ctx.restore()
  }
}

module.exports = GameScene
