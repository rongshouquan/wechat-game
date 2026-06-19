// 宝箱库存（块6余项，纯 TS，不依赖 cc）：v1.0 §9.1/§10.6「奖励包装(非货币)，先进背包再开」的存档载体。
// 三种未开宝箱：星辉货舱 / 行动宝藏 / 扩张宝藏——拿到不强制立即开，先记在这里(背包)，玩家想开时再开。
//   本结构只存「持有几个未开箱」的计数；开箱开出什么(掉落表)是内容侧/第二块，不在此(本层不掷骰、不发奖)。
// 与 S7Population 同构：固定键集 + createDefault/normalize + 纯操作，S7SaveService 组合进 S7PlayerState。

/** 三种宝箱键（v1.0 §9.1）：星辉货舱 / 行动宝藏 / 扩张宝藏。注意 starlightCargo(星辉货舱) 与货币 starCargo(星贝) 是两回事。 */
export const S7_CHEST_TYPES = ['starlightCargo', 'actionTreasure', 'expansionTreasure'] as const;
export type S7ChestType = (typeof S7_CHEST_TYPES)[number];

/** 宝箱库存：每种未开宝箱的持有数(非负整数)。 */
export type S7ChestInventoryState = Record<S7ChestType, number>;

/** 默认空宝箱（各类型 0 个）。 */
export function createDefaultS7ChestInventory(): S7ChestInventoryState {
  const out = {} as S7ChestInventoryState;
  for (const t of S7_CHEST_TYPES) out[t] = 0;
  return out;
}

/**
 * 规范化：键集恒为 S7_CHEST_TYPES——缺失补 0，非非负整数(NaN/负/小数/非数)一律落 0，未知键丢弃。
 * 防脏档/篡改把多余键或非法值带进运行时。
 */
export function normalizeS7ChestInventory(raw: unknown): S7ChestInventoryState {
  const out = createDefaultS7ChestInventory();
  if (raw && typeof raw === 'object') {
    const src = raw as Record<string, unknown>;
    for (const t of S7_CHEST_TYPES) {
      const v = src[t];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) out[t] = v;
    }
  }
  return out;
}

/** 取某类型未开宝箱数。 */
export function getChestCount(state: S7ChestInventoryState, type: S7ChestType): number {
  return state[type];
}

/** 入账宝箱（amount 须为正整数；非正/非整数 = 无操作，防误用）。就地修改。 */
export function addChest(state: S7ChestInventoryState, type: S7ChestType, amount: number): void {
  if (!S7_CHEST_TYPES.includes(type)) return;
  if (!Number.isInteger(amount) || amount <= 0) return;
  state[type] += amount;
}

/**
 * 打开一个宝箱（仅扣计数，不发奖——掉落由内容侧/第二块处理）。
 * 有库存才扣 1 返回 true；无库存返回 false。
 */
export function openChest(state: S7ChestInventoryState, type: S7ChestType): boolean {
  if (!S7_CHEST_TYPES.includes(type)) return false;
  if (state[type] <= 0) return false;
  state[type] -= 1;
  return true;
}
