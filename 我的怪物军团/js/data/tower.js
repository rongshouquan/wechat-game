var RACES_ORDER = ['goblin','werewolf','minotaur','orc','skeletonMage','fairy','paladin','reaper'];

// 动态生成塔层配置（难度高于推图）
function getTowerFloor(floor) {
  var hpMult  = 1 + floor * 0.18;
  var atkMult = 1 + floor * 0.15;
  var raceCount = Math.min(2 + Math.floor(floor / 3), 5);
  var enemies = [];
  var slots = [1, 3, 0, 4, 2, 5];

  for (var i = 0; i < raceCount; i++) {
    var raceId = RACES_ORDER[i % RACES_ORDER.length];
    enemies.push({
      raceId: raceId,
      unitLevel: Math.min(5 + floor, 20),
      positions: [slots[i]],
      hpMult: hpMult,
      atkMult: atkMult
    });
  }

  return {
    floor: floor,
    name: '第' + floor + '层',
    enemies: enemies,
    timeLimit: 180,
    honorReward: floor * 5 + 10,
    isSpecial: (floor % 5 === 0)
  };
}

module.exports = { getTowerFloor: getTowerFloor };
