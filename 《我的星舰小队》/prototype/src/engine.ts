// 战斗引擎核心（纯 TS，与渲染/Cocos 解耦，可在 Node 单独跑、确定性、未来可服务器复算）。
// C1a-2：效果系统——普攻 + 技能(三类触发) + 驾驶员能力(目标选择)/天赋 + 插件(修正) + 星核质变 + 护盾/破盾。
// 首发无限射程（默认打最前排，可被驾驶员能力改写）。确定性：暴击用“累积”实现，无随机。

export type Side = "ally" | "enemy";
export type Targeting = "frontmost" | "backmost" | "lowestHp" | "highestHp";

// 动作（技能/星核效果产生的结果）
export interface ActionSpec {
  kind: "damage" | "aoe" | "healTeam" | "shieldTeam";
  mult: number; // ×攻击
  maxTargets?: number; // aoe 命中上限
}

// 技能 = 触发 + 动作（或被动光环）
export interface SkillSpec {
  name: string;
  trigger: "cooldown" | "enemyCountGte" | "passive";
  cd?: number; // cooldown 触发：间隔秒
  threshold?: number; // enemyCountGte：敌数阈值
  refire?: number; // 条件触发的再触发冷却秒
  action?: ActionSpec;
  auraDmgReduction?: number; // passive：给全队的减伤光环（0..1）
}

// 驾驶天赋
export interface TalentSpec {
  name: string;
  kind: "overheat" | "behead" | "maintain"; // 过热/斩首/维护
  value: number; // 1★ 值（百分比数，如 4 = 4%）
}

// 喂进引擎的单位规格（我方=由 ship+driver+plugins+core 聚合；敌人=直接给）
export interface UnitSpec {
  id: string;
  name: string;
  side: Side;
  row: number;
  col: number;
  maxHp: number;
  atk: number;
  atkInterval: number;
  def: number;
  targeting?: Targeting;
  skill?: SkillSpec;
  talent?: TalentSpec;
  shield?: number; // 初始护盾
  onShieldBreakTeamShield?: number; // 超级护罩：本舰护盾破碎时给全队护盾 = atk × 此值（每场 1 次）
  // 聚合修正（插件/星核）
  dmgMult?: number;
  skillDmgMult?: number;
  critChance?: number;
  critMult?: number;
  cdMult?: number;
  shieldPen?: number; // 破盾：对护盾伤害额外倍率
  dmgReduction?: number; // 自身减伤 0..1
  reach?: number; // 预留，首发不启用
}

interface Unit extends UnitSpec {
  hp: number;
  shieldCur: number;
  alive: boolean;
  atkCd: number;
  skillCd: number;
  overheatStacks: number;
  critAcc: number;
  usedShieldBreak: boolean;
  damageDealt: number;
}

export interface UnitReport {
  id: string; name: string; side: Side;
  damageDealt: number; alive: boolean; hpLeft: number; shieldLeft: number;
}
export interface BattleResult {
  winner: Side | "timeout";
  timeSec: number;
  log: string[];
  units: UnitReport[];
}

const DT = 0.1;
const TIMEOUT = 120;

function living(units: Unit[], side: Side): Unit[] {
  return units.filter((u) => u.alive && u.side === side);
}
function opponents(u: Unit, units: Unit[]): Unit[] {
  return units.filter((x) => x.alive && x.side !== u.side);
}

// 目标选择（首发无限射程；按 targeting，默认 frontmost）。确定性 tie-break：row→col→id。
function pickTarget(attacker: Unit, units: Unit[]): Unit | null {
  const foes = opponents(attacker, units);
  if (foes.length === 0) return null;
  const mode = attacker.targeting ?? "frontmost";
  const score = (u: Unit): number =>
    mode === "frontmost" ? u.row :
    mode === "backmost" ? -u.row :
    mode === "lowestHp" ? u.hp :
    /* highestHp */ -u.hp;
  let best = foes[0];
  for (const f of foes) {
    const sf = score(f), sb = score(best);
    if (sf < sb) best = f;
    else if (sf === sb) {
      if (f.col !== best.col) { if (f.col < best.col) best = f; }
      else if (f.id < best.id) best = f;
    }
  }
  return best;
}

function isHighestHpOpponent(target: Unit, attacker: Unit, units: Unit[]): boolean {
  const foes = opponents(attacker, units);
  let max = -Infinity;
  for (const f of foes) if (f.hp > max) max = f.hp;
  return target.hp >= max;
}

// 目标总减伤：防御减伤 + 自身减伤 + 全队最强减伤光环（光环取最大，不叠加）
function totalReduction(target: Unit, units: Unit[]): number {
  const defRed = target.def / (100 + target.def);
  const own = target.dmgReduction ?? 0;
  let aura = 0;
  for (const a of living(units, target.side)) {
    const r = a.skill?.trigger === "passive" ? a.skill.auraDmgReduction ?? 0 : 0;
    if (r > aura) aura = r;
  }
  const keep = (1 - defRed) * (1 - own) * (1 - aura);
  return 1 - keep;
}

function healTeam(caster: Unit, amount: number, units: Unit[], log: string[], t: number): void {
  const amt = Math.round(amount);
  if (amt <= 0) return;
  for (const a of living(units, caster.side)) {
    const before = a.hp;
    a.hp = Math.min(a.maxHp, a.hp + amt);
    if (a.hp > before) log.push(`[${t.toFixed(1)}s] ＋${caster.name} 维护：${a.name} 回血 ${a.hp - before}`);
  }
}

// 造成一次伤害（含暴击/斩首/减伤/护盾/破盾/维护）。返回是否击毁。
function dealDamage(attacker: Unit, target: Unit, mult: number, isSkill: boolean, units: Unit[], log: string[], t: number): void {
  let dmg = attacker.atk * mult;
  dmg *= attacker.dmgMult ?? 1;
  if (isSkill) dmg *= attacker.skillDmgMult ?? 1;
  if (attacker.talent?.kind === "behead" && isHighestHpOpponent(target, attacker, units)) {
    dmg *= 1 + attacker.talent.value / 100;
  }
  // 暴击（累积式，确定性）
  attacker.critAcc += attacker.critChance ?? 0;
  let crit = false;
  if (attacker.critAcc >= 1) { crit = true; attacker.critAcc -= 1; dmg *= attacker.critMult ?? 1.5; }
  dmg *= 1 - totalReduction(target, units);
  dmg = Math.max(1, Math.round(dmg));

  if (target.shieldCur > 0) {
    const sd = Math.round(dmg * (1 + (attacker.shieldPen ?? 0)));
    if (sd >= target.shieldCur) {
      target.shieldCur = 0;
      log.push(`[${t.toFixed(1)}s] ${attacker.name} ${crit ? "暴击" : ""}打碎 ${target.name} 的护盾`);
      onShieldBreak(target, units, log, t);
    } else {
      target.shieldCur -= sd;
      log.push(`[${t.toFixed(1)}s] ${attacker.name}${isSkill ? "·技能" : ""}${crit ? "·暴击" : ""} → ${target.name} 护盾 -${sd}（剩盾 ${target.shieldCur}）`);
    }
  } else {
    target.hp -= dmg;
    log.push(`[${t.toFixed(1)}s] ${attacker.name}${isSkill ? "·技能" : ""}${crit ? "·暴击" : ""} → ${target.name} -${dmg}（剩 ${Math.max(0, Math.round(target.hp))}）`);
    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      log.push(`[${t.toFixed(1)}s] ☠ ${target.name} 被击毁`);
    }
  }
  attacker.damageDealt += dmg;
  if (isSkill && attacker.talent?.kind === "maintain") {
    healTeam(attacker, (dmg * attacker.talent.value) / 100, units, log, t);
  }
}

function onShieldBreak(unit: Unit, units: Unit[], log: string[], t: number): void {
  if (unit.onShieldBreakTeamShield && !unit.usedShieldBreak) {
    unit.usedShieldBreak = true;
    const amt = Math.round(unit.atk * unit.onShieldBreakTeamShield);
    for (const a of living(units, unit.side)) a.shieldCur += amt;
    log.push(`[${t.toFixed(1)}s] ✦ ${unit.name} 超级护罩触发：全队获得护盾 +${amt}`);
  }
}

function fireSkill(u: Unit, units: Unit[], log: string[], t: number): void {
  const sk = u.skill;
  if (!sk || !sk.action) return;
  const a = sk.action;
  if (a.kind === "healTeam") { healTeam(u, u.atk * a.mult, units, log, t); return; }
  if (a.kind === "shieldTeam") {
    const amt = Math.round(u.atk * a.mult);
    for (const ally of living(units, u.side)) ally.shieldCur += amt;
    log.push(`[${t.toFixed(1)}s] ✦ ${u.name}·${sk.name}：全队护盾 +${amt}`); return;
  }
  if (a.kind === "damage") {
    const tgt = pickTarget(u, units);
    if (tgt) { log.push(`[${t.toFixed(1)}s] ✦ ${u.name} 释放【${sk.name}】`); dealDamage(u, tgt, a.mult, true, units, log, t); }
    return;
  }
  if (a.kind === "aoe") {
    const foes = opponents(u, units).sort((x, y) => x.row - y.row || x.col - y.col || (x.id < y.id ? -1 : 1));
    const targets = foes.slice(0, a.maxTargets ?? foes.length);
    if (targets.length > 0) {
      log.push(`[${t.toFixed(1)}s] ✦ ${u.name} 释放【${sk.name}】(范围 ${targets.length} 目标)`);
      for (const tgt of targets) dealDamage(u, tgt, a.mult, true, units, log, t);
    }
  }
}

function makeUnit(spec: UnitSpec): Unit {
  return {
    ...spec,
    hp: spec.maxHp,
    shieldCur: spec.shield ?? 0,
    alive: true,
    atkCd: spec.atkInterval,
    skillCd: 0, // CD/条件技默认开局即检定第一次（根文件 §4.2「默认开局即放第一次」）
    overheatStacks: 0,
    critAcc: 0,
    usedShieldBreak: false,
    damageDealt: 0,
  };
}

export function runBattle(specs: UnitSpec[]): BattleResult {
  const units = specs.map(makeUnit);
  units.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const log: string[] = [];
  let t = 0;
  let winner: Side | "timeout" = "timeout";

  while (t < TIMEOUT) {
    for (const u of units) {
      if (!u.alive) continue;

      // 技能触发
      const sk = u.skill;
      if (sk && sk.trigger !== "passive") {
        u.skillCd -= DT;
        if (u.skillCd <= 0) {
          if (sk.trigger === "cooldown") {
            fireSkill(u, units, log, t);
            u.skillCd = (sk.cd ?? 99) * (u.cdMult ?? 1);
          } else if (sk.trigger === "enemyCountGte") {
            if (opponents(u, units).length >= (sk.threshold ?? 99)) {
              fireSkill(u, units, log, t);
              u.skillCd = (sk.refire ?? 6) * (u.cdMult ?? 1);
            } else {
              u.skillCd = 0; // 条件不满足，等待
            }
          }
        }
      }

      // 普攻
      u.atkCd -= DT;
      if (u.atkCd <= 0) {
        const tgt = pickTarget(u, units);
        if (tgt === null) { u.atkCd = 0; }
        else {
          // 过热（仅普攻）
          let mult = 1;
          if (u.talent?.kind === "overheat") {
            u.overheatStacks = Math.min(5, u.overheatStacks + 1);
            mult = 1 + (u.overheatStacks * u.talent.value) / 100;
          }
          dealDamage(u, tgt, mult, false, units, log, t);
          u.atkCd += u.atkInterval;
        }
      }
    }
    if (living(units, "enemy").length === 0) { winner = "ally"; break; }
    if (living(units, "ally").length === 0) { winner = "enemy"; break; }
    t += DT;
  }

  return {
    winner,
    timeSec: Math.round(t * 10) / 10,
    log,
    units: units.map((u) => ({
      id: u.id, name: u.name, side: u.side,
      damageDealt: u.damageDealt, alive: u.alive,
      hpLeft: Math.max(0, Math.round(u.hp)), shieldLeft: Math.max(0, Math.round(u.shieldCur)),
    })),
  };
}
