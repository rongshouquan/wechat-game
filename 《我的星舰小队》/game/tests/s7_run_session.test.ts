// C1b-step1b：S7 对局编排（playS7Node 纯函数 + S7RunSession 最小循环）测试。真实样例配置跑出，不改磁盘表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import {
  S7MainlineModel,
  S7MainlineProgressState,
  createDefaultS7MainlineProgress,
} from '../assets/scripts/core/s7/S7MainlineProgress';
import { playS7Node, S7RunSession } from '../assets/scripts/core/s7/S7RunSession';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
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
const freshResources = (): Record<string, number> => ({ starOre: 0, hullAlloy: 0, starCargo: 0, supplyTicket: 0 });

describe('C1b-step1b playS7Node（纯函数）', () => {
  it('n001 默认阵容：胜、结算 ok、发软货币、推进到 n002；不修改入参 progress', async () => {
    await ensure();
    const progress = createDefaultS7MainlineProgress();
    const before = JSON.stringify(progress);
    const o = playS7Node({ runtime, model, progress, runSeed: 'r1' });
    expect(o.nodeId).toBe('n001');
    expect(o.won).toBe(true);
    expect(o.settlement && o.settlement.ok).toBe(true);
    if (o.settlement && o.settlement.ok) {
      expect(o.settlement.grants).toEqual([
        { resourceId: 'starOre', amount: 90 },
        { resourceId: 'hullAlloy', amount: 25 },
      ]);
      expect(o.settlement.nextNodeId).toBe('n002');
    }
    expect(JSON.stringify(progress)).toBe(before); // 纯函数不改入参
  });

  it('确定性：同 runtime/progress/runSeed/默认阵容，两次 outcome 深度相等', async () => {
    await ensure();
    const a = playS7Node({ runtime, model, progress: createDefaultS7MainlineProgress(), runSeed: 'k' });
    const b = playS7Node({ runtime, model, progress: createDefaultS7MainlineProgress(), runSeed: 'k' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('C1b-step1b S7RunSession（最小循环）', () => {
  it('打当前节点(n001)胜：资源按发放累加、进度推进到 n002', async () => {
    await ensure();
    const s = new S7RunSession(freshResources(), createDefaultS7MainlineProgress(), runtime, model);
    expect(s.currentNodeId).toBe('n001');
    const o = s.playCurrentNode('r1');
    expect(o.won).toBe(true);
    expect(s.currentNodeId).toBe('n002');
    expect(s.resources.starOre).toBe(90);
    expect(s.resources.hullAlloy).toBe(25);
  });

  // ⚠️ 样例 battle_encounter_param 只给了 3 个节点的战斗(enc_n001/n018/n075,不连续)；连续多节点循环
  //   需补遭遇配置(原型内容缺口，见 README 遗留)。故此处按"每个可玩节点独立验机制"，不假设连续可玩。
  it('对每个可玩遭遇节点(n001/n018/n075)机制成立：胜→按发放入账+进度前移至结算 nextNodeId；负→状态不变；至少一节点胜', async () => {
    await ensure();
    let wins = 0;
    for (const node of ['n001', 'n018', 'n075']) {
      const s = new S7RunSession(freshResources(), { currentNodeId: node, clearedNodeIds: [] }, runtime, model);
      const oreBefore = s.resources.starOre;
      const o = s.playCurrentNode('loopseed'); // 这 3 个都有遭遇，不应抛错
      expect(o.nodeId).toBe(node);
      if (o.won && o.settlement && o.settlement.ok) {
        expect(s.currentNodeId).toBe(o.settlement.nextNodeId); // n075 为终点则停留自身
        const oreGrant = o.settlement.grants.filter((g) => g.resourceId === 'starOre').reduce((n, g) => n + g.amount, 0);
        expect(s.resources.starOre).toBe(oreBefore + oreGrant);
        wins += 1;
      } else {
        expect(s.currentNodeId).toBe(node);
        expect(s.resources.starOre).toBe(oreBefore);
      }
    }
    expect(wins).toBeGreaterThanOrEqual(1); // n001 默认阵容确定性胜
  });

  it('推进到"无遭遇配置"的节点(n002)→ playCurrentNode 抛错(不吞错)；记录原型内容缺口', async () => {
    await ensure();
    const s = new S7RunSession(freshResources(), createDefaultS7MainlineProgress(), runtime, model);
    s.playCurrentNode('r1'); // 胜 n001 → 推进到 n002
    expect(s.currentNodeId).toBe('n002');
    // n002 样例无 enc_n002 → 组装器抛 missing_encounter（按"不吞错"原则透传；表现层须处理）。
    expect(() => s.playCurrentNode('r1')).toThrow();
  });

  it('赢但结算被拒（篡改档：currentNodeId 已在 clearedNodeIds）→ 不发奖、不推进', async () => {
    await ensure();
    // 构造不一致状态：当前节点 n001 但已记为通关 → settleS7NodeVictory 返回 already_cleared。
    const tampered: S7MainlineProgressState = { currentNodeId: 'n001', clearedNodeIds: ['n001'] };
    const s = new S7RunSession(freshResources(), tampered, runtime, model);
    const o = s.playCurrentNode('r1');
    expect(o.won).toBe(true); // 战斗仍打赢
    expect(o.settlement && o.settlement.ok).toBe(false); // 但结算被顺序校验拒
    expect(s.currentNodeId).toBe('n001'); // 进度不变
    expect(s.resources.starOre).toBe(0); // 不发奖
  });
});
