'use strict'
// 占位 StartScene —— P4 阶段替换为完整实现
class StartScene {
  constructor(main) {
    this.main = main
    this._onTouch = () => main.showGame()
    main.canvas.addEventListener('touchstart', this._onTouch)
  }

  update(dt) {}

  draw(ctx) {
    const { width: w, height: h } = this.main
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 40px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('打砖块', w / 2, h / 2 - 20)

    ctx.font = '22px Arial'
    ctx.fillStyle = '#aaaaaa'
    ctx.fillText('点击开始', w / 2, h / 2 + 30)
  }

  destroy() {
    this.main.canvas.removeEventListener('touchstart', this._onTouch)
  }
}

module.exports = StartScene
