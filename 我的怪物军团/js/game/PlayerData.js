var Storage = require('../utils/Storage').Storage;

var RESEARCH_PER_RACE_MS = 5 * 60 * 1000;
var MAX_OFFLINE_HOURS = 8;

// 生产初始值（新玩家第一次启动）
var DEFAULT_DATA = {
  currentLevel: 1,
  raceLevels: {
    goblin: 1, werewolf: 1, minotaur: 1, orc: 1,
    skeletonMage: 1, fairy: 1, slime: 1, reaper: 1
  },
  unlockedRaces: ['goblin'],
  lineup: [{ raceId: 'goblin', slot: 1 }],
  researchPoints: 0,
  items: {},
  equips: {},
  bonds: {},
  towerFloor: 1,
  honorPoints: 0,
  monsterExp: 0,
  itemShards: 0,
  lastSaveTime: 0,
  shop: null,
  adCounts: null,
  tutorial: { triggered: {}, totalMs: 0 },
  researchUnlocked: false,
  shopUnlocked: false
};

// 将旧存档中缺失的字段补全为默认值（不覆盖已有数据）
function mergeDefaults(data) {
  var def = DEFAULT_DATA;
  if (typeof data.currentLevel !== 'number')    data.currentLevel = def.currentLevel;
  if (!data.raceLevels)   data.raceLevels = JSON.parse(JSON.stringify(def.raceLevels));
  if (!data.unlockedRaces) data.unlockedRaces = def.unlockedRaces.slice();
  if (!data.lineup)       data.lineup = def.lineup.slice();
  if (typeof data.researchPoints !== 'number')  data.researchPoints = 0;
  if (!data.items)        data.items = {};
  if (!data.equips)       data.equips = {};
  if (!data.bonds)        data.bonds = {};
  if (typeof data.towerFloor !== 'number')      data.towerFloor = 1;
  if (typeof data.honorPoints !== 'number')     data.honorPoints = 0;
  if (typeof data.monsterExp !== 'number')      data.monsterExp = 0;
  if (typeof data.itemShards !== 'number')      data.itemShards = 0;
  if (typeof data.lastSaveTime !== 'number')    data.lastSaveTime = 0;
  if (!data.tutorial)     data.tutorial = { triggered: {}, totalMs: 0 };
  if (!data.tutorial.triggered) data.tutorial.triggered = {};
  if (typeof data.tutorial.totalMs !== 'number') data.tutorial.totalMs = 0;
  // 补全 raceLevels 中可能缺失的种族
  var races = Object.keys(def.raceLevels);
  for (var i = 0; i < races.length; i++) {
    if (typeof data.raceLevels[races[i]] !== 'number') data.raceLevels[races[i]] = 1;
  }
  return data;
}

var PlayerData = {
  _data: null,
  offlineEarnings: 0,

  load: function() {
    var saved = Storage.load('playerData', null);
    if (saved) {
      this._data = mergeDefaults(saved);
    } else {
      this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
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
    return Math.floor(elapsed / RESEARCH_PER_RACE_MS) * raceCount;
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
  },

  // 重置存档（调试用）
  reset: function() {
    Storage.remove('playerData');
    this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.offlineEarnings = 0;
    this.save();
  }
};

module.exports = { PlayerData: PlayerData };
