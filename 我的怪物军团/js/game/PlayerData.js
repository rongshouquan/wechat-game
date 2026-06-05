// 玩家数据（内存状态，阶段13接入存档）
var Storage = require('../utils/Storage').Storage;

var DEFAULT_DATA = {
  currentLevel: 1,
  raceLevels: {
    goblin: 1,
    werewolf: 1,
    minotaur: 1,
    orc: 1,
    skeletonMage: 1,
    fairy: 1,
    slime: 1,
    reaper: 1
  },
  unlockedRaces: ['goblin'],   // 初始只有哥布林
  // 上阵阵容：{ raceId, slot }
  lineup: [
    { raceId: 'goblin', slot: 1 }
  ],
  researchPoints: 200, // 初始给200研究点方便测试
  items: { iron_sword: 1, copper_shield: 1, mage_hat: 1 },
  equips: {},
  bonds: { assassination_squad: 1 } // 初始赠送暗杀小队LV1（对应新手引导第20分钟）
};

var PlayerData = {
  _data: null,

  load: function() {
    var saved = Storage.load('playerData', null);
    this._data = saved || JSON.parse(JSON.stringify(DEFAULT_DATA));
  },

  save: function() {
    Storage.save('playerData', this._data);
  },

  get: function() {
    if (!this._data) this.load();
    return this._data;
  },

  // 解锁新种族
  unlockRace: function(raceId) {
    var d = this.get();
    if (d.unlockedRaces.indexOf(raceId) === -1) {
      d.unlockedRaces.push(raceId);
      this.save();
    }
  },

  // 种族升级
  levelUpRace: function(raceId) {
    var d = this.get();
    if (d.raceLevels[raceId] < 20) {
      d.raceLevels[raceId]++;
      this.save();
    }
  },

  // 推图进度
  advanceLevel: function() {
    var d = this.get();
    d.currentLevel++;
    this.save();
  },

  // 添加研究点
  addResearchPoints: function(pts) {
    var d = this.get();
    d.researchPoints += pts;
    this.save();
  }
};

module.exports = { PlayerData: PlayerData };
