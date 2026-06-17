// C1a-1 战斗引擎自动测试。运行：npm test （或 node --test src/*.test.ts）
import { test } from "node:test";
import assert from "node:assert/strict";
import { runBattle } from "./engine.ts";
import type { UnitConfig } from "./engine.ts";

test("我方足够强 → 清场获胜", () => {
  const cfgs: UnitConfig[] = [
    { id: "A_1", name: "强舰", side: "ally", row: 0, col: 1, maxHp: 800, atk: 300, atkInterval: 1.0, def: 20, reach: 2 },
    { id: "E_1", name: "小怪", side: "enemy", row: 0, col: 1, maxHp: 150, atk: 10, atkInterval: 1.0, def: 0, reach: 0 },
  ];
  assert.equal(runBattle(cfgs).winner, "ally");
});

test("短射程够不着后排 → 我方赢不了（站位/射程生效）", () => {
  const cfgs: UnitConfig[] = [
    { id: "A_1", name: "壁垒", side: "ally", row: 0, col: 1, maxHp: 1500, atk: 30, atkInterval: 1.0, def: 40, reach: 0 },
    { id: "E_1", name: "炮台", side: "enemy", row: 2, col: 1, maxHp: 90, atk: 35, atkInterval: 1.5, def: 0, reach: 2 },
  ];
  assert.notEqual(runBattle(cfgs).winner, "ally");
});

test("确定性：同输入两次结果一致", () => {
  const make = (): UnitConfig[] => [
    { id: "A_1", name: "舰", side: "ally", row: 0, col: 1, maxHp: 500, atk: 50, atkInterval: 1.0, def: 10, reach: 2 },
    { id: "E_1", name: "怪", side: "enemy", row: 0, col: 1, maxHp: 300, atk: 30, atkInterval: 1.1, def: 5, reach: 0 },
  ];
  const r1 = runBattle(make());
  const r2 = runBattle(make());
  assert.equal(r1.winner, r2.winner);
  assert.equal(r1.timeSec, r2.timeSec);
  assert.equal(r1.log.length, r2.log.length);
});
