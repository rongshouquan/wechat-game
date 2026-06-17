// C1a-3 切片循环模拟：自动玩家靠「打→掉落→卡关就升级/领离线→再战」推进 9 关，验证整条循环转得起来。
// 运行：node src/slice.ts
import { runBattle } from "./engine.ts";
import type { UnitSpec } from "./engine.ts";
import { deployAlly, makeEnemy } from "./content.ts";
import { teamPower, shipLevelCost, nodeReward, offlineChunk } from "./progression.ts";

// 9 关切片敌情（取自 轻量B2 §E，简化）
function nodeEnemies(node: number): UnitSpec[] {
  const e: UnitSpec[] = [];
  const add = (k: string, n: number, row: number): void => {
    for (let i = 0; i < n; i++) e.push(makeEnemy(k, `${k[0]}${node}_${row}_${i}`, row, (e.length % 5) + 2, node));
  };
  if (node === 9) { e.push(makeEnemy("boss", "boss", 2, 4, 9)); add("raider", 2, 0); return e; }
  add("raider", Math.min(2 + Math.floor(node / 1.5), 6), 0);
  if (node >= 3) add("turret", 1, 2);
  if (node === 6 || node === 8) add("guard", 1, 1);
  return e;
}

const state = { alloy: 0, level: 1, haveOverload: false, upgrades: 0, offlines: 0 };
const team = (): UnitSpec[] => [
  deployAlly("free", 0, 1, { ship: "freedom", driver: "apai", level: state.level, core: state.haveOverload ? "overload" : undefined }),
  deployAlly("swarm", 2, 1, { ship: "swarm", driver: "laojiu", level: state.level }),
];

console.log("======== C1a-3 切片循环模拟（自由号·阿派 + 蜂群·老九；打→掉落→升级→推进 9 关）========");
for (let node = 1; node <= 9; node++) {
  let attempts = 0, guard = 0;
  while (true) {
    if (++guard > 1000) { console.log(`  关卡${node} 异常：未能通过`); break; }
    const isBoss = node === 9;
    const r = runBattle([...team(), ...nodeEnemies(node)]);
    attempts++;
    if (r.winner === "ally") {
      state.alloy += nodeReward(node, isBoss);
      let extra = "";
      if (isBoss && !state.haveOverload) { state.haveOverload = true; extra = "  ★首杀掉落【过载核心】(新手核)"; }
      console.log(`  关卡${node}${isBoss ? "·Boss" : ""}: 胜 ✅  战力${teamPower(team())} Lv${state.level} 用时${r.timeSec}s 尝试${attempts}次${extra}`);
      break;
    }
    // 卡关：能升级就升级，没钱就领一波离线
    const cost = shipLevelCost(state.level);
    if (state.alloy >= cost) { state.alloy -= cost; state.level++; state.upgrades++; }
    else { state.alloy += offlineChunk(); state.offlines++; }
  }
}
console.log(`\n切片清通 ✅ 共升级 ${state.upgrades} 次、领离线 ${state.offlines} 次、最终 Lv${state.level}、战力 ${teamPower(team())}。`);

// 过载核心 payoff：刚拿到核，去打更硬的“星域2 首关”(node11)，对比有核 / 无核
console.log("\n======== 过载核心(新手核) payoff：同一弱队打同一波小怪，无核 vs 有核 ========");
const tough = (): UnitSpec[] => {
  const e: UnitSpec[] = [];
  for (let i = 0; i < 5; i++) e.push(makeEnemy("raider", "t" + i, i < 3 ? 0 : 1, (i % 3) + 2, 5)); // 一波卡边小怪海
  return e;
};
const L = 1; // 同一支弱队伍，装核前后对比（演示核的纯粹价值，与切片进度无关）
const noCore = runBattle([deployAlly("f", 0, 1, { ship: "freedom", driver: "apai", level: L }), deployAlly("s", 2, 1, { ship: "swarm", driver: "laojiu", level: L }), ...tough()]);
const withCore = runBattle([deployAlly("f", 0, 1, { ship: "freedom", driver: "apai", level: L, core: "overload" }), deployAlly("s", 2, 1, { ship: "swarm", driver: "laojiu", level: L }), ...tough()]);
const show = (r: typeof noCore): string => (r.winner === "ally" ? `胜 ✅ ${r.timeSec}s` : "败 ❌");
console.log(`  无核:        ${show(noCore)}`);
console.log(`  装过载核心:  ${show(withCore)}   ← 新手核简单粗暴（伤害×2）`);
