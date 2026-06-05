var Storage = {
  save: function(key, data) {
    try {
      wx.setStorageSync(key, JSON.stringify(data));
    } catch (e) {}
  },
  load: function(key, defaultValue) {
    try {
      var val = wx.getStorageSync(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  remove: function(key) {
    try { wx.removeStorageSync(key); } catch (e) {}
  }
};

module.exports = { Storage: Storage };
