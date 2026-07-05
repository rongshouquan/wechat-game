// 第2.5块·块5：战败安慰包单测（S13 #9·仅主线）——每日≤3 白送、首败附普通信标、第4败零包只给鼓励文案。
// 防假过反例（任务单硬要求③）："安慰包第4败仍发包"会被【>上限 → null】断言测出。
import { describe, it, expect } from 'vitest';
import {
  defeatConsolationPack,
  CONSOLATION_PACK_DAILY_LIMIT, CONSOLATION_ALLOY, CONSOLATION_TOKEN,
  CONSOLATION_FIRST_DEFEAT_BEACON, CONSOLATION_ENCOURAGE_TEXT,
  CONSOLATION_PACK_COUNTER_KEY, DEFEAT_CONSOLATION_DOUBLE_AD_POINT,
} from '../assets/scripts/core/s7/S7DefeatConsolation';
import { createDefaultS7AdDaily, adDailyTryConsume } from '../assets/scripts/core/s7/S7AdDailyCounter';

describe('块5 · 战败安慰包（S13 #9）', () => {
  it('点位/计数 key 常量与设计对齐', () => {
    expect(DEFEAT_CONSOLATION_DOUBLE_AD_POINT).toBe('defeat_consolation_double');
    expect(CONSOLATION_PACK_COUNTER_KEY).toBe('defeat_consolation_pack');
    expect(CONSOLATION_PACK_DAILY_LIMIT).toBe(3);
  });

  it('当日第 1 败：基础包 + 普通信标×1（首败彩头·信标经打捞时间门控天然防送死刷取）', () => {
    expect(defeatConsolationPack(1)).toEqual({
      hullAlloy: CONSOLATION_ALLOY,
      pilotToken: CONSOLATION_TOKEN,
      beaconCommon: CONSOLATION_FIRST_DEFEAT_BEACON,
    });
  });

  it('第 2/3 败：只有基础包（无信标）', () => {
    for (const i of [2, 3]) {
      expect(defeatConsolationPack(i)).toEqual({ hullAlloy: CONSOLATION_ALLOY, pilotToken: CONSOLATION_TOKEN });
    }
  });

  it('【防假过③】第 4 败起零包（若第4败仍发包这里立刻红）；非法输入也不发', () => {
    expect(defeatConsolationPack(4)).toBeNull();
    expect(defeatConsolationPack(5)).toBeNull();
    expect(defeatConsolationPack(99)).toBeNull();
    expect(defeatConsolationPack(0)).toBeNull();
    expect(defeatConsolationPack(-1)).toBeNull();
    expect(defeatConsolationPack(1.5)).toBeNull();
  });

  it('鼓励文案：柔和不挫败·零广告零催促（B1.5④ 调性守卫）', () => {
    expect(CONSOLATION_ENCOURAGE_TEXT.length).toBeGreaterThan(0);
    for (const banned of ['广告', '错过', '倒计时', '最后', '仅剩']) {
      expect(CONSOLATION_ENCOURAGE_TEXT.includes(banned), banned).toBe(false);
    }
  });

  it('与每日计数载体联动（控制器同款时序）：连败 4 场 → 前 3 场发包(第1场带信标)·第 4 场 tryConsume 拒 → 零包', () => {
    const NOW = 1_700_000_000_000;
    const s = createDefaultS7AdDaily();
    const packs: (Record<string, number> | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const c = adDailyTryConsume(s, CONSOLATION_PACK_COUNTER_KEY, CONSOLATION_PACK_DAILY_LIMIT, NOW + i);
      packs.push(c.ok ? defeatConsolationPack(c.usedToday) : null);
    }
    expect(packs[0]?.beaconCommon).toBe(1); // 首败带信标
    expect(packs[1]).toEqual({ hullAlloy: CONSOLATION_ALLOY, pilotToken: CONSOLATION_TOKEN });
    expect(packs[2]).toEqual({ hullAlloy: CONSOLATION_ALLOY, pilotToken: CONSOLATION_TOKEN });
    expect(packs[3]).toBeNull(); // 第 4 败：计数拒 → 只给鼓励文案
    // 次日重置：又能领、且重新算首败（信标回来）。
    const DAY = 86_400_000;
    const c5 = adDailyTryConsume(s, CONSOLATION_PACK_COUNTER_KEY, CONSOLATION_PACK_DAILY_LIMIT, NOW + DAY);
    expect(c5.ok && defeatConsolationPack(c5.ok ? c5.usedToday : 0)?.beaconCommon).toBe(1);
  });
});
