var PlayerData = require('./PlayerData').PlayerData;

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

// 广告位配置
var AD_UNITS = {
  revive:       { id: 'adunit-revive',   dailyLimit: 1,  key: 'adRevive' },
  doubleReward: { id: 'adunit-double',   dailyLimit: 2,  key: 'adDouble' },
  shopRefresh:  { id: 'adunit-refresh',  dailyLimit: 2,  key: 'adShop' },
  itemExpand:   { id: 'adunit-item',     dailyLimit: 1,  key: 'adItem' }
};

var _adInstances = {};

function _getAd(adKey) {
  if (_adInstances[adKey]) return _adInstances[adKey];
  try {
    var unit = AD_UNITS[adKey];
    if (!unit) return null;
    var ad = wx.createRewardedVideoAd({ adUnitId: unit.id });
    ad.load();
    _adInstances[adKey] = ad;
    return ad;
  } catch (e) {
    return null;
  }
}

function _getDailyCount(key) {
  var d = PlayerData.get();
  if (!d.adCounts) d.adCounts = {};
  var today = todayStr();
  if (d.adCounts.date !== today) {
    d.adCounts = { date: today };
    PlayerData.save();
  }
  return d.adCounts[key] || 0;
}

function _incDailyCount(key) {
  var d = PlayerData.get();
  if (!d.adCounts) d.adCounts = {};
  d.adCounts[key] = (d.adCounts[key] || 0) + 1;
  PlayerData.save();
}

var AdManager = {
  // 检查某广告位今日是否还有次数
  canShow: function(adKey) {
    var unit = AD_UNITS[adKey];
    if (!unit) return false;
    return _getDailyCount(unit.key) < unit.dailyLimit;
  },

  // 展示广告，onSuccess/onFail 回调
  show: function(adKey, onSuccess, onFail) {
    var unit = AD_UNITS[adKey];
    if (!unit) { if (onFail) onFail('no_unit'); return; }

    if (!this.canShow(adKey)) {
      if (onFail) onFail('limit_reached');
      wx.showToast({ title: '今日次数已用完', icon: 'none', duration: 1500 });
      return;
    }

    var ad = _getAd(adKey);
    if (!ad) {
      // 开发环境/不支持广告：模拟成功（方便测试）
      _incDailyCount(unit.key);
      if (onSuccess) onSuccess();
      return;
    }

    ad.onClose(function(res) {
      if (res && res.isEnded) {
        _incDailyCount(unit.key);
        if (onSuccess) onSuccess();
      } else {
        if (onFail) onFail('not_ended');
        wx.showToast({ title: '请完整观看广告', icon: 'none', duration: 1500 });
      }
    });
    ad.onError(function() {
      // 广告加载失败时模拟成功（降级处理）
      _incDailyCount(unit.key);
      if (onSuccess) onSuccess();
    });
    ad.show().catch(function() {
      ad.load().then(function() { ad.show(); });
    });
  },

  remainCount: function(adKey) {
    var unit = AD_UNITS[adKey];
    if (!unit) return 0;
    return Math.max(0, unit.dailyLimit - _getDailyCount(unit.key));
  }
};

module.exports = { AdManager: AdManager };
