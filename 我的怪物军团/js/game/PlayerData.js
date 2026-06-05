var Storage = require('../utils/Storage').Storage;

var RESEARCH_PER_RACE_MS = 5 * 60 * 1000; // 每个种族每5分钟1研究点
var MAX_OFFLINE_HOURS = 8; // 最多补算8小时

var DEFAULT_DATA = {
  currentLevel: 1,
  raceLevels: {
    goblin: 1, werewolf: 1, minotaur: 1, orc: 1,
    skeletonMage: 1, fairy: 1, slime: 1, reaper: 1
  },
  unlockedRaces: ['goblin'],
  lineup: [{ raceId: 'goblin', slot: 1 }],
  researchPoints: 200,
  items: { iron_sword: 1, copper_shield: 1, mage_hat: 1 },
  equips: {},
  bonds: { assassination_squad: 1 },
  lastSaveTime: 0
};

var PlayerData = {
  _data: null,
  offlineEarnings: 0, // 本次登录离线收益，供UI展示

  load: function() {
    var saved = Storage.load('playerData', null);
    this._data = saved || JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.offlineEarnings = this._calcOffline();
    if (this.offlineEarnings > 0) {
      this._data.researchPoints += this.offlineEarnings;
    }
    this._data.lastSaveTime = Date.now();
    this.save();
  },

  _calcOffline: function() {
    var d = this._data;
    if (!d.lastSaveTime) return 0;
    var elapsed = Date.now() - d.lastSaveTime;
    var maxMs = MAX_OFFLINE_HOURS * 3600 * 1000;
    elapsed = Math.min(elapsed, maxMs);
    if (elapsed < RESEARCH_PER_RACE_MS) return 0;
    var raceCount = (d.unlockedRaces || []).length;
    var pts = Math.floor(elapsed / RESEARCH_PER_RACE_MS) * raceCount;
    return pts;
  },

  save: function() {
    if (!this._data) return;
    this._data.lastSaveTime = Date.now();
    Storage.save('playerData', this._data);
  },

  get: function() {
    if (!this._data) this.load();
    return this._data;
  },

  unlockRace: function(raceId) {
    var d = this.get();
    if (d.unlockedRaces.indexOf(raceId) === -1) {
      d.unlockedRaces.push(raceId);
      this.save();
    }
  },

  levelUpRace: function(raceId) {
    var d = this.get();
    if (d.raceLevels[raceId] < 20) {
      d.raceLevels[raceId]++;
      this.save();
    }
  },

  advanceLevel: function() {
    var d = this.get();
    d.currentLevel++;
    this.save();
  },

  addResearchPoints: function(pts) {
    var d = this.get();
    d.researchPoints = (d.researchPoints || 0) + pts;
    this.save();
  }
};

module.exports = { PlayerData: PlayerData };
