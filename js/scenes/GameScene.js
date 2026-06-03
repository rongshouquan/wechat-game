'use strict'
// 占位 GameScene —— P3 阶段替换为完整实现
class GameScene {
  constructor(main) {
    this.main = main
    this._onTouch = () => main.showEnd(0)
    main.canvas.addEventListener('touchstart', this._onTouch)
  }

  update(dt) {}

  draw(ctx) {
    const { width: w, height: h } = this.main
    ctx.fillStyle = '#0f3460'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = '28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏场景（开发中）', w / 2, h / 2)
    ctx.fillText('点击进入结算', w / 2, h / 2 + 40)
  }

  destroy() {
    this.main.canvas.removeEventListener('touchstart', this._onTouch)
  }
}

module.exports = GameScene
