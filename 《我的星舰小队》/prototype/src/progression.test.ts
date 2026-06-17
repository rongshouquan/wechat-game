// C1a-3 养成/战力 自动测试。运行：npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { powerOf, shipLevelCost, nodeReward } from "./progression.ts";
import { deployAlly } from "./content.ts";

test("过载核心 ≈ 战力翻倍", () => {
  const base = powerOf(deployAlly("a", 0, 1, { ship: "freedom", driver: "apai" }));
  const core = powerOf(deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", core: "overload" }));
  assert.ok(core >= base * 1.6, `过载核心应≈翻倍：${core} vs ${base}`);
});

test("星舰升级 → 战力上涨", () => {
  const l1 = powerOf(deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", level: 1 }));
  const l10 = powerOf(deployAlly("a", 0, 1, { ship: "freedom", driver: "apai", level: 10 }));
  assert.ok(l10 > l1, `Lv10 应 > Lv1：${l10} vs ${l1}`);
});

test("升级成本与关卡掉落随进度递增", () => {
  assert.ok(shipLevelCost(8) > shipLevelCost(2));
  assert.ok(nodeReward(9, true) > nodeReward(1, false));
});
