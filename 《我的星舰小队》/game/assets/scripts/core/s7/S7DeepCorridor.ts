// 深空回廊·核心逻辑（第2.5块·块3，纯 TS，不依赖 cc）：GDD-v2.0 S10.7 / 附录B B5.2。
// 无尽塔：从第 1 层往上打，只能打"下一层"，进度永久保留；打输免费无限重试、零惩罚（中断口径见 GDD S4）。
//
// 本模块 = 塔的"纯逻辑账本 + 层生成器 + 奖励表"，全部纯函数/可 Node 单测、不碰引擎/UI：
//   - 层生成器 corridorLayerPlan(layer)：按层号确定性生成敌阵（种子=层号·全服同层同阵）+ 戏法层 + 回响Boss + 我方规则。
//   - 敌阵 corridorFormation：从主线 148 关敌人库（调色板由调用方注入·保持纯）里确定性抽敌、随层缩放、按戏法改形状。
//   - 回响Boss corridorEchoBoss：每 25 层=主线 7 个 Boss 按序轮换的强化变体（复用 Boss 节点敌阵 + 倍率）。
//   - 双层奖励：每层首通小奖（自动入账）+ 每 5 层里程碑宝箱（塔页手动开·可积攒·看广告翻倍）。
//   - 状态 S7CorridorState（已通最高层 + 里程碑领取）+ 默认/规范化（存档 v22，S7SaveService 组合）。
//
// ⚠️ 引擎侧现实（Ron 2026-07-04 批准的受控扩展·见 GDD S10.7 实现注记）：现引擎只让"我方"单位带修正积木、
//   敌人 100% 来自静态关卡配置。回廊要的"敌方修正 / 按层动态敌阵 / 限时覆盖"靠**步2 的回廊专用受控入口**注入
//   （复用现有积木与属性合成机器·零新增机制类型·主线/悬赏战斗路径一个字节不动）。本模块只产出纯数据"作战计划"，
//   由步2 那条入口照单执行。数值全 v0.1 占位（缩放/奖励/门槛），阶段三数值校准统一精校。

import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7_ENEMY_ROWS, S7_ENEMY_COLS } from './S7BattleGrid';
import { S7AutoBattleRng } from './S7AutoBattleRng';
import {
  S7CorridorTrickId, S7CorridorTrickEffect, S7_CORRIDOR_TRICKS,
  corridorTrickEffect, neutralCorridorEffect,
} from './S7CorridorTricks';

// ===== 结构常量（定义性·非占位）=====
/** 每 10 层 = 戏法层。 */
export const CORRIDOR_TRICK_INTERVAL = 10;
/** 每 25 层 = 回响Boss。 */
export const CORRIDOR_ECHO_BOSS_INTERVAL = 25;
/** 每 5 层 = 里程碑宝箱。 */
export const CORRIDOR_MILESTONE_INTERVAL = 5;

// ===== 占位数值（阶段三统一校准；改这里不改逻辑）=====
/** 孤胆英雄（深层专属戏法）最早出现层（占位）。 */
export const CORRIDOR_DEEP_TRICK_LAYER = 100;
/** 敌阵基础数量 + 每 N 层 +1 + 上限（占位·防越格）。 */
export const CORRIDOR_BASE_ENEMY_COUNT = 5;
export const CORRIDOR_LAYERS_PER_EXTRA_ENEMY = 8;
export const CORRIDOR_MAX_ENEMY_COUNT = 12;
/** 随层缩放：敌全体 血/攻 每层 +pct（占位·layer×此值）。 */
export const CORRIDOR_HP_PCT_PER_LAYER = 0.08;
export const CORRIDOR_ATK_PCT_PER_LAYER = 0.06;
/** 回响Boss强化：基础额外加成 pct + 每轮（7 个 Boss 一圈）递增步长（占位·叠在层缩放之上）。 */
export const ECHO_BOSS_BASE_BONUS_PCT = 0.8;
export const ECHO_BOSS_CYCLE_STEP = 0.5;
/**
 * 每层首通小奖（合金/驾驶记录/星贝碎屑·自动入账·占位）。
 * 经济口径（Ron 2026-07-04）：每层小奖=从里程碑预算里拆分、总量不变——**§3 经济循环体检表不动**；
 * 精确拆分比例与数量第三块数值校准定，改这几个常量即可，不动逻辑。星矿不入每层小奖（守 S9 星矿四来源）。
 */
export const CORRIDOR_LAYER_ALLOY_BASE = 22; // v0.7 校准终值（机器真源 PARAMS.corridor）
export const CORRIDOR_LAYER_ALLOY_PER = 5.5;
export const CORRIDOR_LAYER_TOKEN_BASE = 15;
export const CORRIDOR_LAYER_TOKEN_PER = 3.6;
export const CORRIDOR_LAYER_CARGO_BASE = 4;
export const CORRIDOR_LAYER_CARGO_PER = 1.0;
/** 里程碑宝箱（星矿/星贝/通用碎片 + 信标·占位·随里程碑序号 idx 增长）。 */
export const CORRIDOR_MS_ORE_BASE = 100;
export const CORRIDOR_MS_ORE_PER = 60;
export const CORRIDOR_MS_CARGO_BASE = 50;
export const CORRIDOR_MS_CARGO_PER = 25;
export const CORRIDOR_MS_SHARD_BASE = 4; // 通用碎片（舰/员对半·v0.7 msUniversal）
export const CORRIDOR_MS_SHARD_PER = 1.6;
export const CORRIDOR_MS_BEACON_AMOUNT = 2;
// B7 稀缺线挪回廊（步4）：宝石入里程碑·不乘 #10 翻倍（稀缺线不挂广告）。
export const CORRIDOR_MS_GEM_BASE = 16;
export const CORRIDOR_MS_GEM_PER = 1.8;
// #10 里程碑翻倍倍率（B2 削峰 ×2→×2.5·机器真源 msMult）。
export const CORRIDOR_MS_AD_MULT = 2.5;
/** 信标升档深度（占位）：≥RARE 层出稀有、≥EPIC 层出史诗（浅层普通）——深层喂打捞，新旧系统咬合。 */
export const CORRIDOR_RARE_BEACON_LAYER = 25;
export const CORRIDOR_EPIC_BEACON_LAYER = 50;

// ===== 层类型判定（回响Boss 优先于戏法：同为倍数的层归 Boss·如 50/100/150）=====

/** 回响Boss层：正数且 25 的倍数。 */
export function isEchoBossLayer(layer: number): boolean {
  return layer > 0 && layer % CORRIDOR_ECHO_BOSS_INTERVAL === 0;
}
/** 戏法层：正数且 10 的倍数，但**不是**回响Boss层（Boss 层优先，不叠戏法规则）。 */
export function isTrickLayer(layer: number): boolean {
  return layer > 0 && layer % CORRIDOR_TRICK_INTERVAL === 0 && !isEchoBossLayer(layer);
}
/** 里程碑层：正数且 5 的倍数（与层类型正交——任何类型的层通关都可能带里程碑）。 */
export function isMilestoneLayer(layer: number): boolean {
  return layer > 0 && layer % CORRIDOR_MILESTONE_INTERVAL === 0;
}

// ===== 敌阵（层生成器·确定性·种子=层号）=====

/** 敌阵调色板一项（调用方从 battle_unit_stat_param 的 enemy 行注入·保持本层纯·假设 1x1 敌人）。 */
export interface S7CorridorEnemyPaletteEntry {
  unitStatRef: string; // battle_unit_stat_param.rowId
  roleTag: string;     // minion / backline_support / ...（治疗型靠 roleTag 区分）
}

/** 一个敌方单位的落点（供步2 喂引擎 spawnUnit）。 */
export interface S7CorridorEnemyUnit {
  unitStatRef: string;
  slotRef: string; // r{row}c{col}，敌方 5×7
}

/** 一层的敌阵规格（纯数据·步2 照单生成引擎出怪 + 敌方修正）。 */
export interface S7CorridorFormation {
  units: S7CorridorEnemyUnit[];
  /** 施加到全体敌人的修正积木（随层缩放 + 敌方类戏法：铁甲潮/护盾矩阵/蜂群变弱）。 */
  enemyBlocks: S7EffectBlock[];
}

/** 敌阵形状指令（层生成器读取；取自戏法作用清单或中性清单）。 */
type S7CorridorFormationDirectives = Pick<
  S7CorridorTrickEffect, 'enemyPlacement' | 'enemyCountMult' | 'extraHealers' | 'enemyBlocks'
>;

/** roleTag=治疗型（持久战加它、常规敌阵排除它，使"治疗单位多"成为可辨戏法）。 */
const HEALER_ROLE = 'backline_support';

/** 常规摆位格序（前中排优先·列=纵深·c0 最近）：列 0-3，每列 5 行。 */
function defaultCells(): string[] {
  const out: string[] = [];
  for (const c of [0, 1, 2, 3]) for (let r = 0; r < S7_ENEMY_ROWS; r += 1) out.push(`r${r}c${c}`);
  return out;
}
/** 后排火力摆位格序（后排优先·c6 最深最难够到）：列 6-4，每列 5 行。 */
function backCells(): string[] {
  const out: string[] = [];
  for (const c of [S7_ENEMY_COLS - 1, S7_ENEMY_COLS - 2, S7_ENEMY_COLS - 3]) {
    for (let r = 0; r < S7_ENEMY_ROWS; r += 1) out.push(`r${r}c${c}`);
  }
  return out;
}

/** 某层的敌阵基础数量（占位·随层缓增·封顶防越格）。 */
export function corridorEnemyCount(layer: number): number {
  const n = CORRIDOR_BASE_ENEMY_COUNT + Math.floor(Math.max(0, layer) / CORRIDOR_LAYERS_PER_EXTRA_ENEMY);
  return Math.min(n, CORRIDOR_MAX_ENEMY_COUNT);
}

/**
 * 随层缩放积木（施加到全体敌人）：血/攻各按 layer×每层pct 放大（pct 叠加·deriveUnit 走 1+Σpct）。
 * bonusPct = 回响Boss等额外加成（叠在层缩放之上）。占位数值第三块校准。
 */
export function corridorEnemyScaleBlocks(layer: number, bonusPct = 0): S7EffectBlock[] {
  const hp = Math.max(0, layer) * CORRIDOR_HP_PCT_PER_LAYER + bonusPct;
  const atk = Math.max(0, layer) * CORRIDOR_ATK_PCT_PER_LAYER + bonusPct;
  const out: S7EffectBlock[] = [];
  if (hp > 0) out.push({ kind: 'modifier', stat: 'maxHp', op: 'pct', value: hp, source: 'corridor_scale' });
  if (atk > 0) out.push({ kind: 'modifier', stat: 'attack', op: 'pct', value: atk, source: 'corridor_scale' });
  return out;
}

/**
 * 生成某层敌阵（纯函数·确定性·seed=`corridor_<layer>`·全服同层同阵）。
 * - 从调色板确定性抽 count 个常规敌（含蜂群翻倍）+ 追加治疗敌（持久战）；摆位按 placement（后排火力=后排）。
 * - enemyBlocks = 层缩放 + 戏法敌方修正（铁甲潮/护盾矩阵/蜂群变弱）。
 * 调色板空 → 空敌阵（只带缩放积木·防御性不崩）。
 */
export function corridorFormation(
  layer: number,
  palette: readonly S7CorridorEnemyPaletteEntry[],
  directives: S7CorridorFormationDirectives,
): S7CorridorFormation {
  const rng = new S7AutoBattleRng(`corridor_${layer}`);
  const healerPool = palette.filter((e) => e.roleTag === HEALER_ROLE);
  const normalPool = palette.filter((e) => e.roleTag !== HEALER_ROLE);
  const pickPool = normalPool.length > 0 ? normalPool : palette.slice();
  const cells = directives.enemyPlacement === 'back' ? backCells() : defaultCells();
  const enemyBlocks = [...corridorEnemyScaleBlocks(layer), ...directives.enemyBlocks];

  if (pickPool.length === 0) return { units: [], enemyBlocks };

  const normalCount = Math.max(1, Math.round(corridorEnemyCount(layer) * directives.enemyCountMult));
  const healerCount = healerPool.length > 0 ? Math.max(0, Math.floor(directives.extraHealers)) : 0;
  const total = Math.min(normalCount + healerCount, cells.length);
  const nNormal = Math.min(normalCount, total);
  const nHealer = total - nNormal;

  const units: S7CorridorEnemyUnit[] = [];
  for (let i = 0; i < nNormal; i += 1) {
    units.push({ unitStatRef: pickPool[rng.nextInt(pickPool.length)].unitStatRef, slotRef: cells[i] });
  }
  for (let j = 0; j < nHealer; j += 1) {
    units.push({ unitStatRef: healerPool[rng.nextInt(healerPool.length)].unitStatRef, slotRef: cells[nNormal + j] });
  }
  return { units, enemyBlocks };
}

// ===== 回响Boss（每 25 层·主线 7 Boss 轮换强化变体）=====

/** 从主线节点（任意顺序）取全部 Boss 节点 id，按 nodeId 升序（=剧情顺序 n030→n150）。供回响Boss轮换。 */
export function corridorBossNodeIds(nodes: readonly { nodeId: string; nodeTypeTag: string }[]): string[] {
  return nodes
    .filter((n) => n && n.nodeTypeTag === 'boss')
    .map((n) => n.nodeId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 回响Boss信息（非 Boss 层 = null）。 */
export interface S7CorridorEchoBoss {
  /** 复用的主线 Boss 节点 id（步2 从该节点 spawn 取 Boss 敌阵形状）。 */
  bossNodeId: string;
  /** 序号（0 起）：层25→0, 50→1, …。 */
  sequence: number;
  /** 本轮第几个 Boss（1 起·1..7）。 */
  bossOrder: number;
  /** 轮完 7 个 Boss 循环第几圈（0 起）。 */
  cycle: number;
  /** 强化倍率（=1+额外加成·展示/日志用；实际缩放走 enemyBlocks）。 */
  mult: number;
  /** 施加到 Boss 敌阵全体的缩放积木（层缩放 + 轮次加成）。 */
  enemyBlocks: S7EffectBlock[];
}

/**
 * 某层的回响Boss（纯函数·确定性）：非 25 倍数层 / 无 Boss 配置 → null。
 * 轮换：seq=layer/25-1，按 bossNodeIds 顺序取模轮换；每轮完一圈 cycle+1、额外加成递增（"轮完循环加倍率"）。
 */
export function corridorEchoBoss(layer: number, bossNodeIds: readonly string[]): S7CorridorEchoBoss | null {
  if (!isEchoBossLayer(layer) || bossNodeIds.length === 0) return null;
  const seq = layer / CORRIDOR_ECHO_BOSS_INTERVAL - 1;
  const idx = ((seq % bossNodeIds.length) + bossNodeIds.length) % bossNodeIds.length;
  const cycle = Math.floor(seq / bossNodeIds.length);
  const bonus = ECHO_BOSS_BASE_BONUS_PCT * (1 + cycle * ECHO_BOSS_CYCLE_STEP);
  return {
    bossNodeId: bossNodeIds[idx],
    sequence: seq,
    bossOrder: idx + 1,
    cycle,
    mult: 1 + bonus,
    enemyBlocks: corridorEnemyScaleBlocks(layer, bonus),
  };
}

// ===== 戏法层抽取 =====

/**
 * 某戏法层用哪种戏法（纯函数·确定性·seed=`corridor_trick_<layer>`）：非戏法层 → null。
 * 深层专属戏法（孤胆英雄）仅当 layer ≥ CORRIDOR_DEEP_TRICK_LAYER 才进候选池。
 */
export function pickCorridorTrick(layer: number): S7CorridorTrickId | null {
  if (!isTrickLayer(layer)) return null;
  const eligible = S7_CORRIDOR_TRICKS.filter((t) => !t.deepOnly || layer >= CORRIDOR_DEEP_TRICK_LAYER);
  if (eligible.length === 0) return null;
  const rng = new S7AutoBattleRng(`corridor_trick_${layer}`);
  return eligible[rng.nextInt(eligible.length)].id;
}

// ===== 层作战计划（生成器总出口）=====

/** 一层的完整作战计划（纯数据·步2 那条受控入口照单执行）。 */
export interface S7CorridorLayerPlan {
  layer: number;
  /** 戏法 id（非戏法层 = null）。 */
  trickId: S7CorridorTrickId | null;
  /** 回响Boss信息（非 Boss 层 = null）。 */
  echoBoss: S7CorridorEchoBoss | null;
  /** 本层是否里程碑层（通关后该里程碑变可开）。 */
  isMilestone: boolean;
  /** 敌阵（普通/戏法层）；回响Boss层 = null（改用 echoBoss.bossNodeId 从 Boss 节点取形状 + echoBoss.enemyBlocks 缩放）。 */
  formation: S7CorridorFormation | null;
  /** 我方全体修正积木（乱流·负急速）。 */
  playerBlocks: S7EffectBlock[];
  /** 我方上阵上限（默认 5 / 精锐 3 / 孤胆 1）。 */
  lineupCap: number;
  /** 限时覆盖秒数（0 = 不覆盖·用引擎默认 120s / 闪电战 40）。 */
  timeLimitSecOverride: number;
  /** 我方星核是否失效（静默空域=true·步2 装配时不注星核积木）。 */
  disablePlayerCores: boolean;
}

/**
 * 生成某层的完整作战计划（纯函数·确定性）。回响Boss 优先于戏法（Boss 层不叠戏法规则）。
 * palette=敌阵调色板（enemy 行）；bossNodeIds=主线 Boss 节点（corridorBossNodeIds 产出·顺序 n030→n150）。
 */
export function corridorLayerPlan(
  layer: number,
  palette: readonly S7CorridorEnemyPaletteEntry[],
  bossNodeIds: readonly string[],
): S7CorridorLayerPlan {
  const echoBoss = corridorEchoBoss(layer, bossNodeIds);
  const trickId = pickCorridorTrick(layer); // Boss 层 isTrickLayer=false → null
  // 戏法层取该戏法作用清单，否则取中性清单（只读作用字段·不读 trickId，故用 Omit 收两个分支）。
  const effect: Omit<S7CorridorTrickEffect, 'trickId'> = trickId
    ? corridorTrickEffect(trickId)
    : neutralCorridorEffect();
  return {
    layer,
    trickId,
    echoBoss,
    isMilestone: isMilestoneLayer(layer),
    formation: echoBoss ? null : corridorFormation(layer, palette, effect),
    playerBlocks: effect.playerBlocks,
    lineupCap: effect.lineupCap,
    timeLimitSecOverride: effect.timeLimitSec,
    disablePlayerCores: effect.disablePlayerCores,
  };
}

// ===== 双层奖励（纯函数·v0.7 校准终值）=====

/**
 * 每层首通小奖（合金/驾驶记录/星贝碎屑·自动入账）。layer≤0 → 空。
 * 从里程碑预算拆分·总量不变（见顶部常量注释）；星矿不入（守 S9）。
 */
export function corridorLayerReward(layer: number): Record<string, number> {
  if (layer <= 0) return {};
  return {
    hullAlloy: Math.round(CORRIDOR_LAYER_ALLOY_BASE + layer * CORRIDOR_LAYER_ALLOY_PER),
    pilotToken: Math.round(CORRIDOR_LAYER_TOKEN_BASE + layer * CORRIDOR_LAYER_TOKEN_PER),
    starCargo: Math.round(CORRIDOR_LAYER_CARGO_BASE + layer * CORRIDOR_LAYER_CARGO_PER),
  };
}

/**
 * 里程碑宝箱内容（星矿/星贝/通用碎片对半 + 信标 + **星空宝石**·v0.7）。非里程碑层 → 空。
 * 信标按深度升档：浅层普通 → ≥25 稀有 → ≥50 史诗（深层喂打捞）。直发货币·不走宝箱系统（不污染背包）。
 * 宝石线（B7 步4 稀缺线挪回廊）：msGem 16+1.8×idx——爬塔独一份的攒头（"攒宝石换想要的核"）。
 */
export function corridorMilestoneReward(layer: number): Record<string, number> {
  if (layer <= 0 || layer % CORRIDOR_MILESTONE_INTERVAL !== 0) return {};
  const idx = layer / CORRIDOR_MILESTONE_INTERVAL; // 1,2,3,...
  const uni = CORRIDOR_MS_SHARD_BASE + idx * CORRIDOR_MS_SHARD_PER;
  const out: Record<string, number> = {
    starOre: Math.round(CORRIDOR_MS_ORE_BASE + idx * CORRIDOR_MS_ORE_PER),
    starCargo: Math.round(CORRIDOR_MS_CARGO_BASE + idx * CORRIDOR_MS_CARGO_PER),
    shipBlueprint: Math.round(uni / 2),
    pilotShardUniversal: Math.round(uni / 2),
    starGem: Math.round(CORRIDOR_MS_GEM_BASE + idx * CORRIDOR_MS_GEM_PER),
  };
  const beaconKey = layer >= CORRIDOR_EPIC_BEACON_LAYER ? 'beaconEpic'
    : layer >= CORRIDOR_RARE_BEACON_LAYER ? 'beaconRare' : 'beaconCommon';
  out[beaconKey] = CORRIDOR_MS_BEACON_AMOUNT;
  return out;
}

/**
 * 看广告翻倍（广告点位 #10·里程碑奖励 ×2.5=B2 削峰终值）：**星空宝石除外**
 * （B7 步4：msGem 不乘 #10——稀缺线不挂广告·分层靠爬得深不靠看广告；
 *  旧 Ron 2026-07-04"无排除项"口径随 B7 宝石入里程碑修订——当时里程碑里没有宝石）。
 */
export function doubleCorridorReward(rewards: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(rewards)) out[k] = k === 'starGem' ? rewards[k] : Math.round(rewards[k] * CORRIDOR_MS_AD_MULT);
  return out;
}

// ===== 持久化状态 + 进度 + 里程碑领取 =====

/** 深空回廊存档子状态（本模块拥有形状 + 默认/规范化·S7SaveService 组合·v22）。 */
export interface S7CorridorState {
  /** 已通过的最高层（0 = 未通过任何层·下一层 = 1）。 */
  highestClearedLayer: number;
  /** 已开箱的里程碑层号（升序去重）。 */
  claimedMilestones: number[];
}

export function createDefaultS7Corridor(): S7CorridorState {
  return { highestClearedLayer: 0, claimedMilestones: [] };
}

/**
 * 规范化（防脏档）：最高层取非负整数；已领里程碑仅保留"是里程碑层(5 的倍数) 且 ≤ 最高层"的正整数、去重升序
 * （钳 ≤ 最高层防脏档预领未来里程碑）。
 */
export function normalizeS7Corridor(raw: unknown): S7CorridorState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const highest = typeof s.highestClearedLayer === 'number' && Number.isInteger(s.highestClearedLayer) && s.highestClearedLayer > 0
    ? s.highestClearedLayer : 0;
  const rawClaimed = Array.isArray(s.claimedMilestones) ? s.claimedMilestones : [];
  const valid = rawClaimed.filter(
    (x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0
      && x % CORRIDOR_MILESTONE_INTERVAL === 0 && x <= highest,
  );
  // Array.from(new Set(...)) 去重（避免 Cocos 构建对 [...new Set()] 展开降级 bug·见 memory cocos-no-spread-set-map）。
  const claimedMilestones = Array.from(new Set(valid)).sort((a, b) => a - b);
  return { highestClearedLayer: highest, claimedMilestones };
}

/** 下一层（只能打下一层）= 已通最高层 + 1。 */
export function nextCorridorLayer(state: S7CorridorState): number {
  return state.highestClearedLayer + 1;
}

/** 某层是否为"当前可打的下一层"（防越级/回刷已通层）。 */
export function canChallengeCorridorLayer(state: S7CorridorState, layer: number): boolean {
  return layer === state.highestClearedLayer + 1;
}

/**
 * 通过一层（战斗胜利后调用·有状态）：仅当 layer===下一层 才推进最高层，返回是否首通（true=首通=发每层小奖）。
 * 重打已通层（layer≤最高层）或越级（layer>下一层）→ 不推进、返回 false —— "重打已通层零奖励"在此天然实现。
 */
export function clearCorridorLayer(state: S7CorridorState, layer: number): boolean {
  if (layer !== state.highestClearedLayer + 1) return false;
  state.highestClearedLayer = layer;
  return true;
}

/** 当前可开的里程碑层号（已通到 + 未开·升序）：所有 5 的倍数 ≤ 最高层，减去已开。 */
export function availableCorridorMilestones(state: S7CorridorState): number[] {
  const out: number[] = [];
  for (let L = CORRIDOR_MILESTONE_INTERVAL; L <= state.highestClearedLayer; L += CORRIDOR_MILESTONE_INTERVAL) {
    if (!state.claimedMilestones.includes(L)) out.push(L);
  }
  return out;
}

/** 某里程碑当前是否可开（是里程碑层 + 已通到该层 + 未开）。 */
export function canClaimCorridorMilestone(state: S7CorridorState, layer: number): boolean {
  return isMilestoneLayer(layer) && layer <= state.highestClearedLayer && !state.claimedMilestones.includes(layer);
}

/**
 * 开一个里程碑宝箱（塔页手动开·有状态）：可开则记入已开、返回奖励（**未翻倍**）；不可开返回 null（不改状态）。
 * 翻倍由调用方看广告后另用 doubleCorridorReward 处理（广告点位 #10）。
 */
export function claimCorridorMilestone(state: S7CorridorState, layer: number): Record<string, number> | null {
  if (!canClaimCorridorMilestone(state, layer)) return null;
  state.claimedMilestones.push(layer);
  state.claimedMilestones.sort((a, b) => a - b);
  return corridorMilestoneReward(layer);
}

// ===== 解锁门控 =====

/**
 * 深空回廊解锁：首个 Boss（firstBossNodeId·数据驱动=n030）已通关（S10.7 / README：解锁=首Boss通关后）。
 * firstBossNodeId 为 null（无 Boss 配置）→ 永不解锁（防御性）。
 */
export function corridorUnlocked(clearedNodeIds: readonly string[], firstBossNodeId: string | null): boolean {
  if (!firstBossNodeId) return false;
  return clearedNodeIds.includes(firstBossNodeId);
}
