'use strict'

class Main {
  constructor(canvas) {
    const info = wx.getSystemInfoSync()
    canvas.width  = info.windowWidth
    canvas.height = info.windowHeight

    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')
    this.width  = canvas.width
    this.height = canvas.height

    this._scene   = null
    this._lastTs  = 0

    this._showStart()
    requestAnimationFrame((ts) => this._loop(ts))
  }

  // ── 场景切换 ─────────────────────────────────────────
  _switchScene(scene) {
    if (this._scene && typeof this._scene.destroy === 'function') {
      this._scene.destroy()
    }
    this._scene = scene
  }

  _showStart() {
    const StartScene = require('./scenes/StartScene')
    this._switchScene(new StartScene(this))
  }

  showGame() {
    const GameScene = require('./scenes/GameScene')
    this._switchScene(new GameScene(this))
  }

  showEnd(score, won) {
    const EndScene = require('./scenes/EndScene')
    this._switchScene(new EndScene(this, score, !!won))
  }

  showStart() {
    this._showStart()
  }

  // ── 游戏主循环 ────────────────────────────────────────
  _loop(ts) {
    const dt = this._lastTs === 0 ? 0 : Math.min((ts - this._lastTs) / 1000, 0.05)
    this._lastTs = ts

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this._scene) {
      this._scene.update(dt)
      this._scene.draw(ctx)
    }

    requestAnimationFrame((t) => this._loop(t))
  }
}

module.exports = Main
