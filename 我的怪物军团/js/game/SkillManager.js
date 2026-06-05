// 技能执行器 - 每个种族的技能逻辑
// ctx: { bm, addFloat, getAllies, getEnemies }

var SKILLS = {

  // 哥布林：陨石轰击 - AOE攻击敌方后排
  goblin: function(unit, ctx) {
    var enemies = ctx.getEnemies(unit);
    var backRow = enemies.filter(function(e) { return !e.dead && e.slot >= 3; });
    var targets = backRow.length > 0 ? backRow : enemies.filter(function(e) { return !e.dead; });
    var dmg = Math.round(unit.atk * 2.5);
    targets.forEach(function(t) {
      var actual = t.takeDamage(dmg);
      ctx.addFloat(t.x, t.y, '-' + actual, '#e74c3c');
    });
    ctx.addFloat(unit.x, unit.y - unit.size, '陨石！', '#e67e22');
  },

  // 狼人：刺客突袭 - 锁定后排一个目标高频攻击5秒
  werewolf: function(unit, ctx) {
    var enemies = ctx.getEnemies(unit);
    var backRow = enemies.filter(function(e) { return !e.dead && e.slot >= 3; });
    var target = backRow.length > 0 ? backRow[0] : enemies.find(function(e) { return !e.dead; });
    if (!target) return;

    ctx.addFloat(unit.x, unit.y - unit.size, '突袭！', '#8e44ad');
    unit._skillDmgReduction = 0.2;

    var elapsed = 0, interval = 0.4;
    var timer = 0;
    var dmgPerHit = Math.round(unit.atk * 1.5);

    unit._skillActive = true;
    var tick = function(dt) {
      if (!unit._skillActive) return false;
      elapsed += dt;
      timer += dt;
      if (target.dead) { unit._skillActive = false; return false; }
      if (timer >= interval) {
        timer -= interval;
        var actual = target.takeDamage(dmgPerHit);
        ctx.addFloat(target.x, target.y, '-' + actual, '#8e44ad');
      }
      if (elapsed >= 5) {
        unit._skillActive = false;
        unit._skillDmgReduction = 0;
        return false;
      }
      return true;
    };
    ctx.bm.registerTick(tick);
  },

  // 牛头怪：野蛮冲撞 - 直线冲锋，伤害+眩晕1秒
  minotaur: function(unit, ctx) {
    var enemies = ctx.getEnemies(unit);
    // 攻击同列敌人（slot % 3 相同）
    var col = unit.slot % 3;
    var targets = enemies.filter(function(e) { return !e.dead && (e.slot % 3) === col; });
    if (targets.length === 0) targets = enemies.filter(function(e) { return !e.dead; });
    var dmg = Math.round(unit.atk * 2);
    targets.forEach(function(t) {
      var actual = t.takeDamage(dmg);
      t.applyStun(1);
      ctx.addFloat(t.x, t.y, '眩晕', '#f1c40f');
      ctx.addFloat(t.x, t.y + 16, '-' + actual, '#27ae60');
    });
    unit._skillDmgReduction = 0.2;
    ctx.addFloat(unit.x, unit.y - unit.size, '冲撞！', '#27ae60');
    var elapsed = 0;
    ctx.bm.registerTick(function(dt) {
      elapsed += dt;
      if (elapsed >= 3) { unit._skillDmgReduction = 0; return false; }
      return true;
    });
  },

  // 兽人：狂战士化身 - 攻击+10%，损失50%当前血量，5秒，期间怒气不增长
  orc: function(unit, ctx) {
    var hpLoss = Math.round(unit.hp * 0.5);
    unit.hp = Math.max(1, unit.hp - hpLoss); // 狂化自损不触发死亡和怒气
    if (unit.dead) return;
    unit._berserk = true;
    unit._atkBoost = 0.1;
    ctx.addFloat(unit.x, unit.y - unit.size, '狂化！', '#d35400');
    var elapsed = 0;
    ctx.bm.registerTick(function(dt) {
      elapsed += dt;
      if (elapsed >= 5) { unit._berserk = false; unit._atkBoost = 0; return false; }
      return true;
    });
  },

  // 骷髅法师：暗影射线 - 锁定最近敌人持续输出5秒
  skeletonMage: function(unit, ctx) {
    var enemies = ctx.getEnemies(unit);
    var target = enemies.find(function(e) { return !e.dead; });
    if (!target) return;
    ctx.addFloat(unit.x, unit.y - unit.size, '暗影射线！', '#2c3e50');
    var elapsed = 0, tick2 = 0;
    var dmgPerTick = Math.round(unit.atk * 0.8);
    ctx.bm.registerTick(function(dt) {
      elapsed += dt; tick2 += dt;
      if (target.dead || elapsed >= 5) return false;
      if (tick2 >= 0.5) {
        tick2 -= 0.5;
        var actual = target.takeDamage(dmgPerTick);
        ctx.addFloat(target.x, target.y, '-' + actual, '#9b59b6');
      }
      return true;
    });
  },

  // 小精灵：全体回血 + 攻击+5% 持续5秒
  fairy: function(unit, ctx) {
    var allies = ctx.getAllies(unit);
    var healAmt = Math.round(unit.atk > 0 ? unit.atk * 3 : 40);
    allies.forEach(function(a) {
      if (a.dead) return;
      a.hp = Math.min(a.maxHp, a.hp + healAmt);
      ctx.addFloat(a.x, a.y, '+' + healAmt, '#2ecc71');
      a._atkBoost = (a._atkBoost || 0) + 0.05;
    });
    ctx.addFloat(unit.x, unit.y - unit.size, '治愈！', '#f39c12');
    var elapsed = 0;
    ctx.bm.registerTick(function(dt) {
      elapsed += dt;
      if (elapsed >= 5) {
        allies.forEach(function(a) { if (!a.dead) a._atkBoost = Math.max(0, (a._atkBoost || 0) - 0.05); });
        return false;
      }
      return true;
    });
  },

  // 史莱姆：给全体友方增加护盾（最大血量10%）
  slime: function(unit, ctx) {
    var allies = ctx.getAllies(unit);
    allies.forEach(function(a) {
      if (a.dead) return;
      a.shield = Math.round(a.maxHp * 0.1);
      ctx.addFloat(a.x, a.y, '护盾', '#1abc9c');
    });
    ctx.addFloat(unit.x, unit.y - unit.size, '护盾！', '#1abc9c');
  },

  // 死神：死神降临 - 全体敌人AOE，低于5%血量直接斩杀
  reaper: function(unit, ctx) {
    var enemies = ctx.getEnemies(unit);
    var dmg = Math.round(unit.atk * 3);
    ctx.addFloat(unit.x, unit.y - unit.size, '死神降临！', '#7f8c8d');
    enemies.forEach(function(t) {
      if (t.dead) return;
      var executeThreshold = t.maxHp * 0.05;
      if (t.hp <= executeThreshold) {
        t.hp = 0; t.dead = true;
        ctx.addFloat(t.x, t.y, '斩杀！', '#e74c3c');
      } else {
        var actual = t.takeDamage(dmg);
        ctx.addFloat(t.x, t.y, '-' + actual, '#7f8c8d');
      }
    });
  }
};

module.exports = { SKILLS: SKILLS };
