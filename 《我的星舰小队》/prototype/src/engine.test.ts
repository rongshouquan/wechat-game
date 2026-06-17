// C1a-1 战斗引擎自动测试。运行：npm test （或 node --test src/*.test.ts）
import { test } from "node:test";
import assert from "node:assert/strict";
import { runBattle } from "./engine.ts";
import type { UnitConfig } from "./engine.ts";

test("我方足够强 → 清场获胜", () => {
  const cfgs: UnitConfig[] = [
    { id: "A_1", name: "强舰", side: "ally", row: 0, col: 1, maxHp: 800, atk: 300, atkInterval: 1.0, def: 20 },
    { id: "E_1", name: "小怪", side: "enemy", row: 0, col: 1, maxHp: 150, atk: 10, atkInterval: 1.0, def: 0 },
  ];
  assert.equal(runBattle(cfgs).winner, "ally");
});

test("默认前排优先 → 前排敌人先被击毁（无限射程下“后排”的克制基础）", () => {
  const cfgs: UnitConfig[] = [
    { id: "A_1", name: "舰", side: "ally", row: 0, col: 1, maxHp: 2000, atk: 100, atkInterval: 1.0, def: 20 },
    { id: "E_front", name: "前怪", side: "enemy", row: 0, col: 1, maxHp: 150, atk: 10, atkInterval: 1.0, def: 0 },
    { id: "E_back", name: "后怪", side: "enemy", row: 2, col: 1, maxHp: 150, atk: 10, atkInterval: 1.0, def: 0 },
  ];
  const r = runBattle(cfgs);
  const iFront = r.log.findIndex((l) => l.includes("前怪") && l.includes("被击毁"));
  const iBack = r.log.findIndex((l) => l.includes("后怪") && l.includes("被击毁"));
  assert.ok(iFront !== -1 && iBack !== -1 && iFront < iBack, "前排应先于后排被击毁");
});

test("确定性：同输入两次结果一致", () => {
  const make = (): UnitConfig[] => [
    { id: "A_1", name: "舰", side: "ally", row: 0, col: 1, maxHp: 500, atk: 50, atkInterval: 1.0, def: 10 },
    { id: "E_1", name: "怪", side: "enemy", row: 0, col: 1, maxHp: 300, atk: 30, atkInterval: 1.1, def: 5 },
  ];
  const r1 = runBattle(make());
  const r2 = runBattle(make());
  assert.equal(r1.winner, r2.winner);
  assert.equal(r1.timeSec, r2.timeSec);
  assert.equal(r1.log.length, r2.log.length);
});
