// 图片缓存：wx.createImage() 异步加载，同步读取
var _cache = {};

var ImageCache = {
  // 预加载一组图片路径
  preload: function(paths, onDone) {
    var total = paths.length;
    if (total === 0) { onDone && onDone(); return; }
    var loaded = 0;
    paths.forEach(function(src) {
      if (_cache[src]) { loaded++; if (loaded === total) onDone && onDone(); return; }
      var img = wx.createImage();
      img.onload = function() {
        _cache[src] = img;
        loaded++;
        if (loaded === total) onDone && onDone();
      };
      img.onerror = function() {
        loaded++;
        if (loaded === total) onDone && onDone();
      };
      img.src = src;
    });
  },

  // 同步获取（已加载则返回，否则触发后台加载并返回 null）
  get: function(src) {
    if (src in _cache) return _cache[src]; // null=加载中，img=已加载
    // 首次请求，后台加载
    _cache[src] = null; // 占位，防止每帧重复创建
    var img = wx.createImage();
    img.onload = function() { _cache[src] = img; };
    img.onerror = function() { delete _cache[src]; }; // 失败时清除占位，允许重试
    img.src = src;
    return null;
  }
};

module.exports = { ImageCache: ImageCache };
