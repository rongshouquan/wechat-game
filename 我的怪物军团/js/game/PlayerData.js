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

// items 新格式：{ itemId: [1星数量, 2星数量, 3星数量] }
// equips 新格式：{ raceId: { id: itemId, stars: N } }

// 将旧格式 items { itemId: count } 迁移到新格式
function migrateItems(items) {
  var newItems = {};
  var keys = Object.keys(items || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = items[k];
    if (Array.isArray(v)) {
      newItems[k] = v; // 已是新格式
    } else if (typeof v === 'number' && v > 0) {
      newItems[k] = [v, 0, 0]; // 旧格式全视为1星
    }
  }
  return newItems;
}

// 迁移旧 equips { raceId: itemId } 到新格式
function migrateEquips(equips) {
  var newEquips = {};
  var keys = Object.keys(equips || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = equips[k];
    if (v && typeof v === 'object' && v.id) {
      newEquips[k] = v; // 已是新格式
    } else if (typeof v === 'string') {
      newEquips[k] = { id: v, stars: 1 }; // 旧格式默认1星
    }
  }
  return newEquips;
}

function mergeDefaults(data) {
  var def = DEFAULT_DATA;
  if (typeof data.currentLevel !== 'number')    data.currentLevel = def.currentLevel;
  if (!data.raceLevels)   data.raceLevels = JSON.parse(JSON.stringify(def.raceLevels));
  if (!data.unlockedRaces) data.unlockedRaces = def.unlockedRaces.slice();
  if (!data.lineup)       data.lineup = def.lineup.slice();
  if (typeof data.researchPoints !== 'number')  data.researchPoints = 0;
  data.items  = migrateItems(data.items);
  data.equips = migrateEquips(data.equips);
  if (!data.bonds)        data.bonds = {};
  if (typeof data.towerFloor !== 'number')      data.towerFloor = 1;
  if (typeof data.honorPoints !== 'number')     data.honorPoints = 0;
  if (typeof data.monsterExp !== 'number')      data.monsterExp = 0;
  if (typeof data.itemShards !== 'number')      data.itemShards = 0;
  if (typeof data.lastSaveTime !== 'number')    data.lastSaveTime = 0;
  if (!data.tutorial)     data.tutorial = { triggered: {}, totalMs: 0 };
  if (!data.tutorial.triggered) data.tutorial.triggered = {};
  if (typeof data.tutorial.totalMs !== 'number') data.tutorial.totalMs = 0;
  var races = Object.keys(def.raceLevels);
  for (var i = 0; i < races.length; i++) {
    if (typeof data.raceLevels[races[i]] !== 'number') data.raceLevels[races[i]] = 1;
  }
  return data;
}

// 工具：给玩家添加一件宝物（指定星级，默认1星）
function addItem(data, itemId, stars) {
  stars = stars || 1;
  if (!data.items) data.items = {};
  if (!data.items[itemId]) data.items[itemId] = [0, 0, 0];
  data.items[itemId][stars - 1]++;
}

// 工具：获取某宝物的总数量
function itemTotal(data, itemId) {
  var arr = (data.items || {})[itemId];
  if (!arr) return 0;
  return arr[0] + arr[1] + arr[2];
}

// 工具：获取某宝物最高星级（0表示没有）
function itemMaxStars(data, itemId) {
  var arr = (data.items || {})[itemId];
  if (!arr) return 0;
  if (arr[2] > 0) return 3;
  if (arr[1] > 0) return 2;
  if (arr[0] > 0) return 1;
  return 0;
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

  addItem: function(itemId, stars) {
    addItem(this.get(), itemId, stars || 1);
    this.save();
  },

  itemTotal: function(itemId) { return itemTotal(this.get(), itemId); },
  itemMaxStars: function(itemId) { return itemMaxStars(this.get(), itemId); },

  // 重置存档（调试用）
  reset: function() {
    Storage.remove('playerData');
    this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.offlineEarnings = 0;
    this.save();
  }
};

module.exports = { PlayerData: PlayerData };
