// C1a-2 模拟器：验证 #2（换搭配有感）/ #3（星核质变碾压）/ 破盾插件。运行：npm run sim
import { runBattle } from "./engine.ts";
import type { UnitSpec, BattleResult } from "./engine.ts";
import { deployAlly, makeEnemy } from "./content.ts";

function summary(title: string, res: BattleResult): void {
  const v = res.winner === "ally" ? "我方胜 ✅" : res.winner === "enemy" ? "失败 ❌" : "超时 ⏰";
  console.log(`\n  【${title}】${v}  用时 ${res.timeSec}s`);
  for (const u of res.units.filter((x) => x.side === "ally")) {
    const st = u.alive ? `存活 HP${u.hpLeft}${u.shieldLeft ? "+盾" + u.shieldLeft : ""}` : "阵亡";
    console.log(`      我·${u.name}: 伤害 ${u.damageDealt}, ${st}`);
  }
}

// ===== #2 换驾驶员有感：同一艘自由号，打同一波（前排 2 星盗艇 + 后排 1 炮台）=====
const nodeMix = (): UnitSpec[] => [makeEnemy("raider", "r1", 0, 2), makeEnemy("raider", "r2", 0, 3), makeEnemy("turret", "t1", 2, 4)];
console.log("======== #2 换驾驶员有感（同一艘自由号 vs 同一波敌人）========");
summary("阿派（集火残血 + 过热叠伤）", runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "apai" }), ...nodeMix()]));
summary("琪琪（打后排 + 斩首）", runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "qiqi" }), ...nodeMix()]));
summary("老九（打前排 + 维护奶）", runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "laojiu" }), ...nodeMix()]));

// ===== #3 星核质变碾压：自由号+蜂群 打 6 星盗艇（node5 放大）=====
const swarmNode = (): UnitSpec[] => {
  const e: UnitSpec[] = [];
  for (let i = 0; i < 6; i++) e.push(makeEnemy("raider", "r" + i, i < 3 ? 0 : 1, (i % 3) + 2, 5));
  return e;
};
console.log("\n======== #3 星核质变碾压（自由号 + 蜂群 打 6 小怪）========");
summary("无核", runBattle([deployAlly("a", 0, 1, { ship: "freedom", driver: "apai" }), deployAlly("b", 2, 1, { ship: "swarm", driver: "laojiu" }), ...swarmNode()]));
summary("自由号装【小太阳】(技能变大范围)", runBattle([deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", core: "smallSun" }), deployAlly("b", 2, 1, { ship: "swarm", driver: "laojiu" }), ...swarmNode()]));

// ===== 破盾插件：破盾影响的是“破盾时刻”（破盾前血几乎打不动），直接看这个最清楚 =====
function shieldBreakTime(res: BattleResult): string {
  const m = res.log.find((l) => l.includes("打碎") && l.includes("护盾"))?.match(/\[([\d.]+)s\]/);
  return m ? m[1] + "s" : "未破盾";
}
console.log("\n======== 破盾插件（自由号 打 护盾巡卫，盾520·血250）========");
const gNo = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "apai" }), makeEnemy("guard", "g1", 1, 3)]);
const gP = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "apai", plugins: ["pierce"] }), makeEnemy("guard", "g1", 1, 3)]);
console.log(`  无破甲弹头：${shieldBreakTime(gNo)} 破盾，全清 ${gNo.timeSec}s`);
console.log(`  装破甲弹头：${shieldBreakTime(gP)} 破盾，全清 ${gP.timeSec}s  ← 破盾时刻明显提前（破盾插件作用点）`);
