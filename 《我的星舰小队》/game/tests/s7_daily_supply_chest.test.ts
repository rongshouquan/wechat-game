// 第2.5块·块5：今日补给箱单测（S13 #2 + S10.10 定死结构：合金/驾驶记录/星贝小额组合 + 小概率信标或通用碎片）。
// 重点：确定性预掷（同日同序号=同内容·杀进程重进不换奖）+ 结构合规（禁 Math.random 由实现走 S7AutoBattleRng 保证）。
import { describe, it, expect } from 'vitest';
import {
  rollDailySupplyChest,
  SUPPLY_CHEST_ALLOY_BASE, SUPPLY_CHEST_TOKEN_BASE, SUPPLY_CHEST_CARGO_BASE, SUPPLY_CHEST_JITTER_PCT,
  DAILY_SUPPLY_CHEST_AD_POINT,
} from '../assets/scripts/core/s7/S7DailySupplyChest';

describe('块5 · 今日补给箱', () => {
  it('点位 id 与网关一致', () => {
    expect(DAILY_SUPPLY_CHEST_AD_POINT).toBe('daily_supply_chest');
  });

  it('确定性：同 dayKey+同序号 → 逐键相同；不同 dayKey / 不同序号 → 内容会变（扫窗口内至少一处不同）', () => {
    const a = rollDailySupplyChest(20_000, 1);
    const b = rollDailySupplyChest(20_000, 1);
    expect(b).toEqual(a); // 杀进程重进不换奖
    // 不同日/不同序号：不是处处相同（抖动+彩蛋层由种子驱动）。
    let diffDay = false;
    let diffIndex = false;
    for (let d = 1; d <= 30 && !(diffDay && diffIndex); d += 1) {
      if (JSON.stringify(rollDailySupplyChest(20_000 + d, 1)) !== JSON.stringify(a)) diffDay = true;
      if (JSON.stringify(rollDailySupplyChest(20_000, 1 + d)) !== JSON.stringify(a)) diffIndex = true;
    }
    expect(diffDay).toBe(true);
    expect(diffIndex).toBe(true); // 广告券重开=新序号 → 不发同一份
  });

  it('结构（S10.10 定死）：必含 合金/驾驶记录/星贝 三键正整数·量在基础±抖动带内', () => {
    for (let d = 0; d < 40; d += 1) {
      const r = rollDailySupplyChest(21_000 + d, 1);
      const inBand = (v: number, base: number): boolean =>
        v >= Math.max(1, Math.floor(base * (1 - SUPPLY_CHEST_JITTER_PCT))) && v <= Math.ceil(base * (1 + SUPPLY_CHEST_JITTER_PCT));
      expect(Number.isInteger(r.hullAlloy) && r.hullAlloy > 0).toBe(true);
      expect(Number.isInteger(r.pilotToken) && r.pilotToken > 0).toBe(true);
      expect(Number.isInteger(r.starCargo) && r.starCargo > 0).toBe(true);
      expect(inBand(r.hullAlloy, SUPPLY_CHEST_ALLOY_BASE)).toBe(true);
      expect(inBand(r.pilotToken, SUPPLY_CHEST_TOKEN_BASE)).toBe(true);
      expect(inBand(r.starCargo, SUPPLY_CHEST_CARGO_BASE)).toBe(true);
      // 键集护栏：只可能出 定死结构的 3 软货币 + 彩蛋（普通信标 或 通用碎片其一），不出别的键。
      const allowed = new Set(['hullAlloy', 'pilotToken', 'starCargo', 'beaconCommon', 'shipBlueprint', 'pilotShardUniversal']);
      for (const k of Object.keys(r)) expect(allowed.has(k), k).toBe(true);
      // 彩蛋互斥：信标与通用碎片不同时出。
      const bonusKinds = ['beaconCommon', 'shipBlueprint', 'pilotShardUniversal'].filter((k) => r[k] !== undefined);
      expect(bonusKinds.length <= 1 || (bonusKinds.length === 1)).toBe(true);
      expect(['beaconCommon' in r, ('shipBlueprint' in r) || ('pilotShardUniversal' in r)].filter(Boolean).length <= 1).toBe(true);
    }
  });

  it('彩蛋层真的会出（扫 400 天：信标≥1 次、通用碎片≥1 次、纯软货币≥1 次——三分支都活着）', () => {
    let beacon = 0; let shard = 0; let plain = 0;
    for (let d = 0; d < 400; d += 1) {
      const r = rollDailySupplyChest(30_000 + d, 1);
      if (r.beaconCommon !== undefined) { beacon += 1; expect(r.beaconCommon).toBe(1); }
      else if (r.shipBlueprint !== undefined || r.pilotShardUniversal !== undefined) shard += 1;
      else plain += 1;
    }
    expect(beacon).toBeGreaterThan(0);
    expect(shard).toBeGreaterThan(0);
    expect(plain).toBeGreaterThan(0);
    // 概率量级粗校验（占位 12%·400 天 ≈ 48 次·给宽带 20-90 防脆断）。
    expect(beacon).toBeGreaterThan(20);
    expect(beacon).toBeLessThan(90);
  });
});
