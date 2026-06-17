// 战斗引擎核心（纯 TS，与渲染/Cocos 解耦，可在 Node 单独跑、确定性、未来可服务器复算）。
// C1a-1 范围：属性 + 普攻 + 固定阵位射程目标选择 + 防御减伤 + 胜负判定 + tick 循环。
// 技能/效果积木/驾驶员能力天赋/星核质变 在 C1a-2 接入（本文件预留扩展点）。

export type Side = "ally" | "enemy";

// 一个战斗单位的配置（星舰/驾驶员/敌人统一用它喂进引擎——配置驱动）
export interface UnitConfig {
  id: string;
  name: string;
  side: Side;
  row: number; // 0=前排 1=中排 2=后排（纵深：决定射程与受击优先级）
  col: number; // 横向位置（范围技/点名几何用，C1a-1 仅作平手判定）
  maxHp: number;
  atk: number;
  atkInterval: number; // 攻击间隔（秒）= 1 / 攻速
  def: number;
  reach: number; // 能攻击到对方的最大排号：0=只够前排 / 1=到中排 / 2=到后排
}

export interface Unit extends UnitConfig {
  hp: number;
  cooldown: number;
  alive: boolean;
  damageDealt: number;
}

export interface UnitReport {
  id: string;
  name: string;
  side: Side;
  damageDealt: number;
  alive: boolean;
  hpLeft: number;
}

export interface BattleResult {
  winner: Side | "timeout";
  timeSec: number;
  log: string[];
  units: UnitReport[];
}

const DT = 0.1; // tick 步长（秒）
const TIMEOUT = 120; // 超时判负（秒）

// 伤害公式：atk × 100/(100+def)，下限 1
function mitigate(atk: number, def: number): number {
  return Math.max(1, Math.round((atk * 100) / (100 + def)));
}

// 固定阵位目标选择（C1a-1 默认规则）：对方存活且在射程内（敌排号 ≤ 我方 reach），
// 取最前排（排号最小），再按 col、id 决定，保证确定性。驾驶员“能力”改写此规则放 C1a-2。
function pickTarget(attacker: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  for (const u of units) {
    if (!u.alive || u.side === attacker.side) continue;
    if (u.row > attacker.reach) continue; // 够不着更靠后的排
    if (best === null) { best = u; continue; }
    if (u.row !== best.row) { if (u.row < best.row) best = u; continue; }
    if (u.col !== best.col) { if (u.col < best.col) best = u; continue; }
    if (u.id < best.id) best = u;
  }
  return best;
}

function aliveCount(units: Unit[], side: Side): number {
  let n = 0;
  for (const u of units) if (u.alive && u.side === side) n++;
  return n;
}

export function createUnit(cfg: UnitConfig): Unit {
  return { ...cfg, hp: cfg.maxHp, cooldown: cfg.atkInterval, alive: true, damageDealt: 0 };
}

// 跑一场战斗。胜利 = 清光敌方；我方全灭或超时 = 判负。完全确定性（无随机）。
export function runBattle(configs: UnitConfig[]): BattleResult {
  const units = configs.map(createUnit);
  units.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // 确定性顺序
  const log: string[] = [];
  let t = 0;
  let winner: Side | "timeout" = "timeout";

  while (t < TIMEOUT) {
    for (const u of units) {
      if (!u.alive) continue;
      u.cooldown -= DT;
      if (u.cooldown > 0) continue;
      const target = pickTarget(u, units);
      if (target === null) { u.cooldown = 0; continue; } // 没有够得着的目标 → 待命
      const dmg = mitigate(u.atk, target.def);
      target.hp -= dmg;
      u.damageDealt += dmg;
      u.cooldown += u.atkInterval;
      log.push(`[${t.toFixed(1)}s] ${u.name} → ${target.name} 造成 ${dmg}（剩 ${Math.max(0, Math.round(target.hp))}）`);
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        log.push(`[${t.toFixed(1)}s] ☠ ${target.name} 被击毁`);
      }
    }
    if (aliveCount(units, "enemy") === 0) { winner = "ally"; break; }
    if (aliveCount(units, "ally") === 0) { winner = "enemy"; break; }
    t += DT;
  }

  return {
    winner,
    timeSec: Math.round(t * 10) / 10,
    log,
    units: units.map((u) => ({
      id: u.id, name: u.name, side: u.side,
      damageDealt: u.damageDealt, alive: u.alive, hpLeft: Math.max(0, Math.round(u.hp)),
    })),
  };
}
