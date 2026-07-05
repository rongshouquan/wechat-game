// 关卡三选一发奖引擎（阶段一 F-step1，纯 TS，不依赖 cc / Math.random / Date / 存档 / 配置运行时）：v1.0 §8。
//
// 职责（纯函数·确定性·可单测）：
//   - resolveLevelStage：节点类型 → 奖励档（普通/精英/Boss/none）。
//   - firstBossNodeId：主线节点(按配置顺序) → 首个 Boss 节点 id（判 Boss 大奖给过载核心还是星辉货舱）。
//   - rollLevelChoices：从该档稀缺池随机取 choiceCount(=3) 个**不同**项·解析成具体奖励（随机指定专属碎片→定具体单位）。
//   - resolveBossGrand：Boss 必给大奖（首个 Boss=过载核心 / 其余 Boss=星辉货舱）。
//   - doubleLevelReward(s)：看广告×2（数量类翻倍；唯一核不翻倍）。
//
// 边界：本引擎不读 S7ConfigRuntime / 不读存档 —— 节点类型、单位候选、首通判定由调用方(控制器)读 runtime / squad 后以原始数据喂入。
//   首通限定(§8「重复挑战不刷资源」)在调用方实现：仅在 settleS7NodeVictory 返回 ok:true(首通) 时才调本引擎抽三选一。
//   随机用注入的 S7AutoBattleRng（确定可测）。发放 manifest 由应用侧入账（资源/专属碎片/插件/宝箱/核）。

import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7LevelRewardConfig,
  S7LevelReward,
  S7LevelPoolEntry,
  S7LevelRewardStage,
  S7LevelPoolStage,
} from './S7LevelRewardConfig';

/** 候选单位池（解析「随机指定专属碎片」用·应用侧传所有/拥有 的舰、员 id）。 */
export interface S7UnitCandidates {
  ships: string[];
  pilots: string[];
}

/** 节点类型 → 奖励档（未配置默认 normal）。 */
export function resolveLevelStage(nodeTypeTag: string, config: S7LevelRewardConfig): S7LevelRewardStage {
  return config.nodeTypeToStage[nodeTypeTag] ?? 'normal';
}

/**
 * 主线节点（按配置顺序传入）→ 首个 Boss 节点 id；没有 Boss → null。
 * 用于判断某 Boss 关是否首个（首个给过载核心、其余给星辉货舱）。
 */
export function firstBossNodeId(nodes: { nodeId: string; nodeTypeTag: string }[]): string | null {
  for (const n of nodes) {
    if (n && n.nodeTypeTag === 'boss') return n.nodeId;
  }
  return null;
}

/** 加权取一个下标（entries 非空）；全 0 权重时退化为均匀。 */
function pickWeightedIndex(entries: S7LevelPoolEntry[], rng: S7AutoBattleRng): number {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return Math.min(entries.length - 1, rng.nextInt(entries.length));
  let x = rng.next() * total;
  for (let i = 0; i < entries.length; i += 1) {
    x -= Math.max(0, entries[i].weight);
    if (x < 0) return i;
  }
  return entries.length - 1;
}

/** 把一个池项解析成具体奖励；随机指定专属碎片需从候选定具体单位，候选空 → null（调用方已先剔除此类项，这里二次兜底）。 */
function resolveEntry(entry: S7LevelPoolEntry, rng: S7AutoBattleRng, candidates: S7UnitCandidates): S7LevelReward | null {
  if (entry.kind === 'resource') return { kind: 'resource', resourceId: entry.resourceId, amount: entry.amount };
  if (entry.kind === 'plugin') return { kind: 'plugin', quality: entry.quality, count: entry.count };
  // exclusiveShardRandom
  const pool = entry.unitKind === 'ship' ? candidates.ships : candidates.pilots;
  const unitId = rng.pick(pool);
  if (!unitId) return null;
  return { kind: 'exclusiveShard', unitKind: entry.unitKind, unitId, amount: entry.amount };
}

/** 某「随机指定专属碎片」项的候选是否非空。 */
function entryHasCandidates(entry: S7LevelPoolEntry, candidates: S7UnitCandidates): boolean {
  if (entry.kind !== 'exclusiveShardRandom') return true;
  return (entry.unitKind === 'ship' ? candidates.ships.length : candidates.pilots.length) > 0;
}

/**
 * 三选一抽取：从该档稀缺池随机取 choiceCount(默认3) 个**不同**项，解析成具体奖励。
 *  - 无放回加权抽取（避免出现两个相同选项）；池项不足 choiceCount 时返回现有数量。
 *  - 「随机指定专属碎片」项：抽中时用 rng 定具体单位；候选空的此类项先被剔除（不进抽取）。
 *  - stage='none' 或该档池为空 → 返回空数组（无三选一·如整备/提醒节点）。
 *  确定性：同 config + 同 rng 序列 + 同候选 → 同结果。
 */
export function rollLevelChoices(
  config: S7LevelRewardConfig,
  stage: S7LevelRewardStage,
  rng: S7AutoBattleRng,
  candidates: S7UnitCandidates,
): S7LevelReward[] {
  if (stage === 'none') return [];
  const basePool = config.pools[stage as S7LevelPoolStage];
  if (!basePool || basePool.length === 0) return [];

  // 剔除候选空的「随机指定专属碎片」项，避免它占了一个三选一名额却解析为 null。
  const remaining = basePool.filter((e) => entryHasCandidates(e, candidates));
  const out: S7LevelReward[] = [];
  const n = Math.max(0, Math.min(config.choiceCount, remaining.length));
  for (let k = 0; k < n; k += 1) {
    const idx = pickWeightedIndex(remaining, rng);
    const [entry] = remaining.splice(idx, 1); // 无放回
    const resolved = resolveEntry(entry, rng, candidates);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Boss 必给大奖（非三选一）：首个 Boss → 过载核心(core)；其余 Boss → 星辉货舱(chest×1)。 */
export function resolveBossGrand(config: S7LevelRewardConfig, isFirstBoss: boolean): S7LevelReward {
  if (isFirstBoss) return { kind: 'core', coreId: config.bossGrand.firstBossCoreId };
  return { kind: 'chest', chestId: config.bossGrand.otherBossChestId, amount: 1 };
}

/** 看广告×2：数量类翻倍（resource/exclusiveShard 的 amount、plugin 的 count、chest 的 amount）；唯一核(core)不翻倍。 */
export function doubleLevelReward(r: S7LevelReward): S7LevelReward {
  switch (r.kind) {
    case 'resource': return { ...r, amount: r.amount * 2 };
    case 'exclusiveShard': return { ...r, amount: r.amount * 2 };
    case 'plugin': return { ...r, count: r.count * 2 };
    case 'chest': return { ...r, amount: r.amount * 2 };
    case 'core': return r; // 唯一核不翻倍
  }
}

/** 看广告×2 批量版。 */
export function doubleLevelRewards(rewards: S7LevelReward[]): S7LevelReward[] {
  return rewards.map(doubleLevelReward);
}

/**
 * 「三选一·再选一个」第二选合法性（S13 #4·块5）：只能从**剩下两张**里选——
 * 不能重选已选那张、不能越界。纯函数供 UI 守门 + 单测钉死"只从剩两项发"。
 */
export function canPickExtra(pickedIndex: number, extraIndex: number, choiceCount: number): boolean {
  if (!Number.isInteger(pickedIndex) || !Number.isInteger(extraIndex)) return false;
  if (pickedIndex < 0 || pickedIndex >= choiceCount) return false;
  if (extraIndex < 0 || extraIndex >= choiceCount) return false;
  return extraIndex !== pickedIndex;
}
