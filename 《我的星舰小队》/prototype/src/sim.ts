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

// 场景 B —— 验证“受击/目标优先级”（首发无限射程）：敌方 前排星盗艇 + 后排炮台。
// 我方默认打最前排 → 先清前排艇，后排炮台被晚打、活得久一直输出。这就是“后排威胁”的新基础：
// 想早点点掉后排，需突袭手改目标优先级 / 导弹 AoE（C1a-2 接入）。
const nodeB: UnitConfig[] = [
  ally("freedom", "freedom", 0, 1),
  enemy("raider", "r1", 0, 2, 1),
  enemy("turret", "t1", 2, 4, 1),
];
printResult("场景B · 默认前排优先（后排炮台被晚打、活得久）", runBattle(nodeB));
