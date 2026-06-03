'use strict'
// 占位 EndScene —— P4 阶段替换为完整实现
class EndScene {
  constructor(main, score) {
    this.main  = main
    this.score = score
    this._onTouch = () => main._showStart()
    main.canvas.addEventListener('touchstart', this._onTouch)
  }

  update(dt) {}

  draw(ctx) {
    const { width: w, height: h } = this.main
    ctx.fillStyle = '#16213e'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏结束', w / 2, h / 2 - 30)

    ctx.font = '24px Arial'
    ctx.fillText('得分：' + this.score, w / 2, h / 2 + 20)

    ctx.font = '20px Arial'
    ctx.fillStyle = '#aaaaaa'
    ctx.fillText('点击返回', w / 2, h / 2 + 60)
  }

  destroy() {
    this.main.canvas.removeEventListener('touchstart', this._onTouch)
  }
}

module.exports = EndScene
