// C1a-2 战斗引擎自动测试。运行：npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { runBattle } from "./engine.ts";
import type { UnitSpec, BattleResult } from "./engine.ts";
import { deployAlly, makeEnemy } from "./content.ts";

const swarm6 = (): UnitSpec[] => {
  const e: UnitSpec[] = [];
  for (let i = 0; i < 6; i++) e.push(makeEnemy("raider", "r" + i, i < 3 ? 0 : 1, (i % 3) + 2, 5));
  return e;
};
const killIdx = (r: BattleResult, name: string): number => r.log.findIndex((l) => l.includes(name) && l.includes("被击毁"));

test("小太阳核 → 技能变 AoE，清群明显更快", () => {
  const tNo = runBattle([deployAlly("a", 0, 1, { ship: "freedom", driver: "apai" }), deployAlly("b", 2, 1, { ship: "swarm", driver: "laojiu" }), ...swarm6()]).timeSec;
  const tCore = runBattle([deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", core: "smallSun" }), deployAlly("b", 2, 1, { ship: "swarm", driver: "laojiu" }), ...swarm6()]).timeSec;
  assert.ok(tCore < tNo, `带核应更快：核 ${tCore}s 应 < 无核 ${tNo}s`);
});

test("破甲弹头 → 破护盾巡卫更快", () => {
  const tNo = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "apai" }), makeEnemy("guard", "g", 1, 3)]).timeSec;
  const tP = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "apai", plugins: ["pierce"] }), makeEnemy("guard", "g", 1, 3)]).timeSec;
  assert.ok(tP < tNo, `破甲应更快：${tP}s 应 < ${tNo}s`);
});

test("换驾驶员目标 → 击毁顺序不同（前排优先 vs 打后排）", () => {
  const node = (): UnitSpec[] => [makeEnemy("raider", "r1", 0, 2), makeEnemy("turret", "t1", 2, 4)];
  const front = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "laojiu" }), ...node()]);
  const back = runBattle([deployAlly("s", 0, 1, { ship: "freedom", driver: "qiqi" }), ...node()]);
  assert.ok(killIdx(front, "星盗艇") < killIdx(front, "星盗炮台"), "前排优先：前排艇应先被击毁");
  assert.ok(killIdx(back, "星盗炮台") < killIdx(back, "星盗艇"), "打后排：炮台应先被击毁");
});

test("确定性：同输入两次一致", () => {
  const mk = (): UnitSpec[] => [deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", plugins: ["amp", "scope"] }), ...swarm6()];
  const r1 = runBattle(mk()), r2 = runBattle(mk());
  assert.equal(r1.timeSec, r2.timeSec);
  assert.equal(r1.log.length, r2.log.length);
});
