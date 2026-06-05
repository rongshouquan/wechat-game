var PlayerData = require('./PlayerData').PlayerData;

// 新手引导里程碑（单位：分钟）
var MILESTONES = [
  {
    id: 'unlock_werewolf', minutes: 3,
    apply: function(d) { if (d.unlockedRaces.indexOf('werewolf') === -1) d.unlockedRaces.push('werewolf'); },
    msg: '解锁新种族：狼人！'
  },
  {
    id: 'first_item', minutes: 5,
    apply: function(d) { if (!d.items) d.items = {}; if (!Array.isArray(d.items['mana_ring'])) d.items['mana_ring']=[0,0,0]; d.items['mana_ring'][0]++; },
    msg: '获得宝物：魔力戒指！'
  },
  {
    id: 'unlock_minotaur', minutes: 7,
    apply: function(d) { if (d.unlockedRaces.indexOf('minotaur') === -1) d.unlockedRaces.push('minotaur'); },
    msg: '解锁新种族：牛头怪！'
  },
  {
    id: 'unlock_orc', minutes: 10,
    apply: function(d) { if (d.unlockedRaces.indexOf('orc') === -1) d.unlockedRaces.push('orc'); },
    msg: '解锁新种族：兽人！'
  },
  {
    id: 'level5_boost', minutes: 15,
    apply: function(d) {
      ['goblin','werewolf'].forEach(function(r) {
        if (d.raceLevels[r] < 5) d.raceLevels[r] = 5;
      });
    },
    msg: '哥布林、狼人成长到5级！'
  },
  {
    id: 'unlock_research', minutes: 20,
    apply: function(d) {
      d.researchUnlocked = true;
      if (!d.bonds) d.bonds = {};
      if (!d.bonds['assassination_squad']) d.bonds['assassination_squad'] = 1;
    },
    msg: '研究所开放！获赠暗杀小队羁绊！'
  },
  {
    id: 'unlock_skeletonMage', minutes: 25,
    apply: function(d) { if (d.unlockedRaces.indexOf('skeletonMage') === -1) d.unlockedRaces.push('skeletonMage'); },
    msg: '解锁新种族：骷髅法师！'
  },
  {
    id: 'unlock_shop', minutes: 30,
    apply: function(d) {
      d.shopUnlocked = true;
      if (!d.items) d.items = {};
      if (!Array.isArray(d.items['fire_wand'])) d.items['fire_wand']=[0,0,0]; d.items['fire_wand'][0]++;
    },
    msg: '商店开放！获赠哥布林专属宝物：火焰魔杖！'
  }
];

var TutorialManager = {
  // 更新游戏时间，返回本次新触发的消息列表
  tick: function(dtMs) {
    var d = PlayerData.get();
    if (!d.tutorial) d.tutorial = { triggered: {}, totalMs: 0 };
    d.tutorial.totalMs = (d.tutorial.totalMs || 0) + dtMs;
    var totalMin = d.tutorial.totalMs / 60000;
    var msgs = [];

    for (var i = 0; i < MILESTONES.length; i++) {
      var m = MILESTONES[i];
      if (d.tutorial.triggered[m.id]) continue;
      if (totalMin >= m.minutes) {
        m.apply(d);
        d.tutorial.triggered[m.id] = true;
        msgs.push(m.msg);
      }
    }

    if (msgs.length > 0) PlayerData.save();
    return msgs;
  },

  isUnlocked: function(id) {
    var d = PlayerData.get();
    return d.tutorial && d.tutorial.triggered && !!d.tutorial.triggered[id];
  }
};

module.exports = { TutorialManager: TutorialManager };
