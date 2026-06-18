// S7 自动战斗确定性随机源（BATTLE-RT-04，纯 TS，不依赖 cc / Math.random / Date）。
//
// 用途：仅用于"最近目标并列时随机选一个"等少量并列裁决，必须完全由 battleSeed 驱动。
// 同一个 battleSeed 必须复现同一序列；不同 seed 允许在并列点产生小差异。
// 算法：xmur3 字符串散列做种 + mulberry32 32 位 PRNG（确定、可移植、不依赖平台）。

/** xmur3：把任意字符串散列为一个 32 位整数种子。 */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32：32 位状态 PRNG，next() 返回 [0,1)。 */
export class S7AutoBattleRng {
  private state: number;

  constructor(seed: string | number) {
    // 统一按字符串散列，使数字与等值字符串（如 7 与 "7"）行为可预期且稳定。
    this.state = xmur3(String(seed));
  }

  /** 下一个 [0,1) 浮点数。 */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, n) 的整数；n<=0 时返回 0。 */
  nextInt(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  /** 从非空数组里等概率取一个；空数组返回 undefined。 */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.nextInt(items.length)];
  }
}
