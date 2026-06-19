// 专属碎片库存（块6余项，纯 TS，不依赖 cc）：v1.0 §6/§10.1 升阶材料「专属碎片」的存档载体。
// 专属碎片是「每单位」的——每艘星舰 / 每名驾驶员各有自己的一格进度，用于升阶(星舰)/升星(驾驶员)。
//   来源：抽卡/打捞拿到已拥有的本体(重复)→ 折成该单位专属碎片(§6/§10.1)、关卡三选一「随机指定专属碎片」(§8)。
//   注：通用碎片(通用星舰碎片 shipBlueprint / 通用驾驶员碎片 pilotShardUniversal)是钱包货币、不在此；本表只存「专属」。
// 与 S7BuildingState / S7PluginInventory 同构：本模块拥有子状态形状 + createDefault/normalize + 纯操作，
//   S7SaveService 组合进 S7PlayerState。与配置解耦：不校验 unitId 是否存在于 ship_config/pilot_config（那是装配/运行时的事）。

/** 专属碎片库存：unitId(星舰/驾驶员实体 id) → 已持有专属碎片数(正整数)。不在表内 = 0。 */
export interface S7ExclusiveShardInventoryState {
  /** key = 单位 id（如 ship01 / pil03）；value = 该单位专属碎片数(>0)。0 不留键。 */
  shards: Record<string, number>;
}

/** 默认空库存（新档无任何专属碎片）。 */
export function createDefaultS7ExclusiveShardInventory(): S7ExclusiveShardInventoryState {
  return { shards: {} };
}

/**
 * 规范化：只保留「key 为非空字符串、value 为正整数」的项；非整数/≤0/脏键一律丢弃，防脏档/篡改。
 * 与配置解耦（不校验 unitId 是否存在）。0 不留键——与运行时「不在表内=0」一致。
 */
export function normalizeS7ExclusiveShardInventory(raw: unknown): S7ExclusiveShardInventoryState {
  const out = createDefaultS7ExclusiveShardInventory();
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const shards = (src.shards && typeof src.shards === 'object') ? (src.shards as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(shards)) {
    if (typeof key !== 'string' || key.length === 0) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue; // 防原型污染
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) continue;
    out.shards[key] = v;
  }
  return out;
}

/** 取某单位的专属碎片数：有则正整数，无则 0。 */
export function getExclusiveShardCount(state: S7ExclusiveShardInventoryState, unitId: string): number {
  const n = state.shards[unitId];
  return typeof n === 'number' ? n : 0;
}

/** 入账专属碎片（amount 须为正整数；非正/非整数 = 无操作，防误用）。就地修改。 */
export function addExclusiveShards(state: S7ExclusiveShardInventoryState, unitId: string, amount: number): void {
  if (typeof unitId !== 'string' || unitId.length === 0) return;
  if (!Number.isInteger(amount) || amount <= 0) return;
  state.shards[unitId] = getExclusiveShardCount(state, unitId) + amount;
}

/**
 * 消耗专属碎片（升阶/升星时）。amount 须为正整数且库存足够才扣，返回是否成功。
 * 扣到 0 即删键（保持表最小、与"不在表内=0"一致）。库存不足/非法 amount → 不扣、返回 false。
 */
export function spendExclusiveShards(state: S7ExclusiveShardInventoryState, unitId: string, amount: number): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  const have = getExclusiveShardCount(state, unitId);
  if (have < amount) return false;
  const left = have - amount;
  if (left === 0) delete state.shards[unitId];
  else state.shards[unitId] = left;
  return true;
}
