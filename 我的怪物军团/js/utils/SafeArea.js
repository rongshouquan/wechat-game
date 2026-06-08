// 安全区域工具：避免内容绘制到刘海屏 / 状态栏 / 小程序胶囊按钮区域
var _topInset = null;

var SafeArea = {
  // 获取顶部安全偏移量（逻辑像素）。所有顶部UI/资源展示的起始Y都应 >= 此值
  getTopInset: function() {
    if (_topInset !== null) return _topInset;
    var inset = 0;
    try {
      var rect = wx.getMenuButtonBoundingClientRect();
      if (rect && typeof rect.bottom === 'number') {
        inset = rect.bottom + 6; // 胶囊按钮底部 + 一点间距
      }
    } catch (e) {}
    if (!inset) {
      try {
        var sys = wx.getSystemInfoSync();
        inset = (sys.statusBarHeight || 20) + 24;
      } catch (e2) {
        inset = 44;
      }
    }
    _topInset = inset;
    return _topInset;
  }
};

module.exports = { SafeArea: SafeArea };
