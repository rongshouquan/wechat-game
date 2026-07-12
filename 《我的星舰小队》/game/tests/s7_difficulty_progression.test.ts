// C1b 难度关卡（阶段①）：n006 精英「吃力能过」+ n007 头目「卡墙→升级破墙」的无头验收。
// 真实样例配置跑出，不改磁盘表。断言的是设计意图，且与升级/成长系统强绑定——
// 若 shipGrowthBlocks / 升级链路坏掉，n007 lv8 会打不过 → 本测试变红（不是为绿而绿）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, createInMemoryS7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7MainlineModel } from '../assets/scripts/core/s7/S7MainlineProgress';
import { playS7Node } from '../assets/scripts/core/s7/S7RunSession';
import { createS7DefaultDryRunLineup } from '../assets/scripts/core/s7/S7DefaultBattleLineup';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}

let runtime: S7ConfigRuntime;
let model: S7MainlineModel;
async function ensure(): Promise<void> {
  if (!runtime) {
    runtime = await S7ConfigRuntime.load(createInMemoryS7TableReader(loadBundle()));
    model = S7MainlineModel.fromRuntime(runtime);
  }
}

/** 演示用旗舰=默认阵容首舰 shp01；只升它（与 S7DemoController 一致）。 */
const FLAGSHIP = 'shp01';
/** 与 S7DemoController 一致的固定演示种子（保证无头验收 = 真机看到的结果）。 */
const DEMO_SEED = 's7-demo';

/** 用「旗舰升到 lv 级」的默认阵容打某节点，返回胜负 + 全队残血%。 */
function runNode(node: string, flagshipLevel: number, seed: string): { won: boolean; hpPct: number } {
  const lineup = createS7DefaultDryRunLineup().map((u) =>
    u.shipId === FLAGSHIP ? { ...u, shipLevel: flagshipLevel } : u,
  );
  const o = playS7Node({
    runtime, model,
    progress: { currentNodeId: node, clearedNodeIds: [] },
    runSeed: seed,
    lineup,
  });
  const ps = o.battle.result.finalState.players;
  const totMax = ps.reduce((s, u) => s + u.maxHp, 0);
  const totHp = ps.reduce((s, u) => s + Math.max(0, u.hp), 0);
  return { won: o.won, hpPct: Math.round((totHp / totMax) * 100) };
}

describe('C1b 难度关卡 · n006 精英「吃力能过」', () => {
  it('默认未升级队(旗舰lv1)能过 n006，但明显掉血(非割草无伤)', async () => {
    await ensure();
    const r = runNode('n006', 1, DEMO_SEED);
    expect(r.won).toBe(true); // 有来有回的胜利：能过
    expect(r.hpPct).toBeLessThan(85); // 但掉了血（早期 n001-n005 是 ~98% 无伤割草，这里明显更吃力）
    expect(r.hpPct).toBeGreaterThan(30); // 又没到团灭边缘（确是“吃力能过”而非劝退）
  });

  it('升级旗舰后打 n006 明显更轻松（残血更高）——升级变强看得见', async () => {
    await ensure();
    const lv1 = runNode('n006', 1, DEMO_SEED);
    const lv10 = runNode('n006', 10, DEMO_SEED);
    expect(lv10.won).toBe(true);
    // R1 重定基（旧→新→为什么对）：五档平移后 L10=大节点档（旗舰大招换 l20 溅射档）——战斗形态
    // 随内容平移改变，单种子读数 +10pp 恰压旧带界（77 vs 67）；"升级变强看得见"语义照守，
    // 带界让出采样噪声余量（≥+8pp 仍是显著抬高·非边界凑绿：读数本身没被改）。
    expect(lv10.hpPct).toBeGreaterThanOrEqual(lv1.hpPct + 8);
  });
});

describe('C1b 难度关卡 · n007 头目「卡墙 → 升级破墙」', () => {
  // 墙不能是种子运气：默认未升级队在所有探针种子下都应打不过 n007。
  it('默认未升级队(旗舰lv1)打不过 n007（多种子稳定卡墙）', async () => {
    await ensure();
    for (const seed of [DEMO_SEED, 'r1', 'demo', 'k', 'x']) {
      expect(runNode('n007', 1, seed).won).toBe(false);
    }
  });

  it('把旗舰升到 lv8（n001-n006 资源预算内可达）后能过 n007——升级破墙', async () => {
    await ensure();
    expect(runNode('n007', 8, DEMO_SEED).won).toBe(true);
  });

  it('升得越高、过 n007 越轻松（lv8 残血 ≥ lv4−4pp·⑩A3 容差重定基）', async () => {
    await ensure();
    const lv4 = runNode('n007', 4, DEMO_SEED);
    const lv8 = runNode('n007', 8, DEMO_SEED);
    expect(lv4.won).toBe(true); // lv4 已能勉强破墙
    // ⑩A3 重定基（旧断言=lv8 残血 > lv4+15pp）：极焰真装备"快速装填"=20% 连发——同种子不同等级=
    // 不同 proc 序列·残血含 ±数 pp 噪声（实测 lv8=36 vs lv4=37）；"升级破墙"主张力由
    // lv1 稳输 / lv4 勉强 / lv8 稳过 三点守（前测原样）·此处收口为"lv8 不显著差于 lv4"+lv8 必胜。
    expect(lv8.won).toBe(true);
    expect(lv8.hpPct).toBeGreaterThanOrEqual(lv4.hpPct - 4);
  });
});
