// C1a-1 命令行模拟器：摆一场固定阵位战斗，跑出来打印战斗日志 + 结果 + 单位输出统计。
// 运行：npm run sim  （或 node src/sim.ts）
import { runBattle } from "./engine.ts";
import type { UnitConfig, BattleResult } from "./engine.ts";
import { ally, enemy } from "./content.ts";

function printResult(title: string, res: BattleResult, showLog = true): void {
  console.log(`\n===== ${title} =====`);
  if (showLog) for (const line of res.log) console.log(line);
  const verdict =
    res.winner === "ally" ? "我方胜利 ✅" : res.winner === "enemy" ? "战斗失败 ❌" : "超时判负 ⏰";
  console.log(`结果：${verdict}，用时 ${res.timeSec}s`);
  console.log("单位输出统计：");
  for (const u of res.units) {
    const tag = u.side === "ally" ? "我" : "敌";
    const state = u.alive ? `存活(HP ${u.hpLeft})` : "已击毁";
    console.log(`  [${tag}] ${u.name}  伤害 ${u.damageDealt}  ${state}`);
  }
}

// 场景 A —— Node 1：我方 自由号(前) + 蜂群(后) vs 2 星盗艇(前排)。应当我方获胜。
const nodeA: UnitConfig[] = [
  ally("freedom", "freedom", 0, 1),
  ally("swarm", "swarm", 2, 1),
  enemy("raider", "r1", 0, 2, 1),
  enemy("raider", "r2", 0, 3, 1),
];
printResult("场景A · Node1（我方应胜）", runBattle(nodeA));

// 场景 B —— 验证“射程/站位”：壁垒(reach=0，只够前排) vs 1 星盗炮台(后排 row2)。壁垒够不着 → 打不赢。
const nodeB: UnitConfig[] = [
  ally("bulwark", "bulwark", 0, 1),
  enemy("turret", "t1", 2, 3, 1),
];
printResult("场景B · 短射程够不着后排（应非我方胜，证明站位/射程生效）", runBattle(nodeB), false);
