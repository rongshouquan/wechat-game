// C1b-step1a：S7 节点结算（节点→奖励解析 + 首通发奖+推进）测试。真实样例配置跑出，不改磁盘表。
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
import {
  resolveNodeRewardGrants,
  applyResourceGrants,
  settleS7NodeVictory,
} from '../assets/scripts/core/s7/S7NodeSettlement';

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
const progressAt = (nodeId: string): S7MainlineProgressState => ({ currentNodeId: nodeId, clearedNodeIds: [] });

describe('C1b-step1a 节点奖励解析 resolveNodeRewardGrants', () => {
  it('n001 固定三件套=55/36/24（步5 重定基：公式驱动 基值×档位×星域系数·sf01 normal=×1·v0.7 §6 mainline·旧 reward_param 包链路 25 作废）', async () => {
    await ensure();
    const grants = resolveNodeRewardGrants(runtime, 'n001');
    expect(grants).toEqual([
      { resourceId: 'hullAlloy', amount: 55 },
      { resourceId: 'pilotToken', amount: 36 },
      { resourceId: 'starCargo', amount: 24 },
    ]);
  });

  it('未知节点 / 无链路 → 空数组（不报错）', async () => {
    await ensure();
    expect(resolveNodeRewardGrants(runtime, 'nXXX')).toEqual([]);
  });
});

describe('C1b-step1a 发放入账 applyResourceGrants', () => {
  it('只加账本已有键、跳过未知键、忽略非正量', () => {
    const res: Record<string, number> = { starOre: 100, hullAlloy: 0 };
    applyResourceGrants(res, [
      { resourceId: 'starOre', amount: 90 },
      { resourceId: 'hullAlloy', amount: 25 },
      { resourceId: 'bogusKey', amount: 999 }, // 账本没有→跳过
      { resourceId: 'starOre', amount: -5 }, // 非正→忽略
    ]);
    expect(res).toEqual({ starOre: 190, hullAlloy: 25 });
  });
});

describe('C1b-step1a 首通结算 settleS7NodeVictory', () => {
  it('当前待通节点首通：返回发放 + 推进到下一节点（不修改入参 progress）', async () => {
    await ensure();
    const progress = createDefaultS7MainlineProgress(); // currentNodeId=n001
    const before = JSON.stringify(progress);
    const r = settleS7NodeVictory(model, progress, runtime, 'n001');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.grants).toEqual([
      { resourceId: 'hullAlloy', amount: 55 },
      { resourceId: 'pilotToken', amount: 36 },
      { resourceId: 'starCargo', amount: 24 },
    ]); // 步5 重定基：公式驱动三件套（同上）
    expect(r.completedNodeId).toBe('n001');
    expect(r.nextNodeId).toBe('n002');
    expect(r.finished).toBe(false);
    expect(r.nextProgress.currentNodeId).toBe('n002');
    expect(r.nextProgress.clearedNodeIds).toEqual(['n001']);
    expect(JSON.stringify(progress)).toBe(before); // 纯函数，不改入参
  });

  it('重复挑战（已通关节点）→ ok:false already_cleared，不发奖不推进（§8 重复不刷资源）', async () => {
    await ensure();
    const progress: S7MainlineProgressState = { currentNodeId: 'n002', clearedNodeIds: ['n001'] };
    const r = settleS7NodeVictory(model, progress, runtime, 'n001');
    expect(r).toEqual({ ok: false, error: 'already_cleared' });
  });

  it('越级（非当前待通节点）→ ok:false out_of_order', async () => {
    await ensure();
    const r = settleS7NodeVictory(model, progressAt('n001'), runtime, 'n005');
    expect(r).toEqual({ ok: false, error: 'out_of_order' });
  });

  it('未知节点 → ok:false unknown_node', async () => {
    await ensure();
    const r = settleS7NodeVictory(model, progressAt('n001'), runtime, 'nope');
    expect(r).toEqual({ ok: false, error: 'unknown_node' });
  });

  it('结算→入账 端到端：软货币真加进资源账本', async () => {
    await ensure();
    const resources: Record<string, number> = { starOre: 0, hullAlloy: 0, starCargo: 0 };
    const r = settleS7NodeVictory(model, createDefaultS7MainlineProgress(), runtime, 'n001');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    applyResourceGrants(resources, r.grants);
    expect(resources.starOre).toBe(0); // 改动#3：星矿不再随节点结算必得
    expect(resources.hullAlloy).toBe(55); // 步5 重定基：v0.7 fixedAlloyBase 55（sf01 normal ×1）
    expect(resources.starCargo).toBe(24);
  });
});
