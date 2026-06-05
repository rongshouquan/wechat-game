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
    if (_cache[src]) return _cache[src];
    // 后台加载
    var img = wx.createImage();
    _cache[src] = null; // 占位防重复加载
    img.onload = function() { _cache[src] = img; };
    img.src = src;
    return null;
  }
};

module.exports = { ImageCache: ImageCache };
