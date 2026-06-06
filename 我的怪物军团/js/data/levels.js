// 关卡配置表（前20关示例，后续扩展）
// enemy: { raceId, level, count, positions: [0-5] (0-2前排, 3-5后排) }
var LEVELS = [];

for (var i = 1; i <= 60; i++) {
  var level = i;
  var hpMult = 1 + (level - 1) * 0.12;
  var atkMult = 1 + (level - 1) * 0.10;

  var enemies = [];
  if (level === 1) {
    // 新手第一关：一只极弱骷髅小兵
    enemies = [
      { raceId: 'skeleton_soldier', unitLevel: 1, count: 1, positions: [1], hpMult: 1, atkMult: 1 }
    ];
  } else if (level <= 5) {
    enemies = [
      { raceId: 'goblin', unitLevel: Math.min(level, 5), count: 2, positions: [0, 1], hpMult: hpMult, atkMult: atkMult }
    ];
  } else if (level <= 10) {
    enemies = [
      { raceId: 'goblin',   unitLevel: Math.min(level, 10), count: 2, positions: [0, 1], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'werewolf', unitLevel: Math.min(level - 3, 8), count: 1, positions: [3], hpMult: hpMult, atkMult: atkMult }
    ];
  } else if (level <= 20) {
    enemies = [
      { raceId: 'minotaur',   unitLevel: Math.min(level - 5, 10), count: 1, positions: [1], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'goblin',     unitLevel: Math.min(level - 3, 12), count: 2, positions: [0, 2], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'werewolf',   unitLevel: Math.min(level - 5, 10), count: 1, positions: [3], hpMult: hpMult, atkMult: atkMult }
    ];
  } else if (level <= 30) {
    enemies = [
      { raceId: 'minotaur',     unitLevel: Math.min(level - 8, 15), count: 1, positions: [1], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'orc',          unitLevel: Math.min(level - 8, 15), count: 2, positions: [0, 2], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'skeletonMage', unitLevel: Math.min(level - 10, 12), count: 1, positions: [4], hpMult: hpMult, atkMult: atkMult }
    ];
  } else {
    var baseLevel = Math.min(level - 10, 20);
    enemies = [
      { raceId: 'minotaur',     unitLevel: baseLevel, count: 1, positions: [1], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'orc',          unitLevel: baseLevel, count: 2, positions: [0, 2], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'skeletonMage', unitLevel: baseLevel, count: 1, positions: [3], hpMult: hpMult, atkMult: atkMult },
      { raceId: 'reaper',       unitLevel: baseLevel, count: 1, positions: [5], hpMult: hpMult, atkMult: atkMult }
    ];
  }

  var rewards = {
    researchPoints: 10,
    monsterExp: Math.round(level * 3 + 5),
    itemShards: Math.floor(Math.random() * 6) + 5
  };
  if (level === 1) {
    // 新手第一关专属奖励
    rewards.gold = 50;
    rewards.monsterExp = 100;
    rewards.tutorialItem = { id: 'war_fang', stars: 1 }; // 战争獠牙1星
  }
  LEVELS.push({
    id: level,
    name: '第' + level + '关',
    timeLimit: 180,
    enemies: enemies,
    rewards: rewards,
    isSpecial: (level % 10 === 0)
  });
}

module.exports = { LEVELS: LEVELS };
