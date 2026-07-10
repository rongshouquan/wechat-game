// ⑥第一段·任务单硬规格#3："同刻度异搭配 → 战力相同"自动化测试（总纲1 的机器守卫）。
// 现钉占位战力公式（S7PrebattleView.shipPowerOf·精确统一公式落运行时时本测试随之升级=A9/步5）：
// 战力只由 等级/阶级/星级/装备档位 决定，与"选了哪艘舰/哪位驾驶员/哪颗核"无关——组合无关性=结构性质。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { shipPowerOf } from '../assets/scripts/core/s7/S7PrebattleView';
import { S7GrowthBandParam } from '../assets/scripts/config/s7/ConfigTypesS7';

const BANDS = JSON.parse(readFileSync(
  path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7', 'growth_band_param.sample.json'),
  'utf-8',
)) as S7GrowthBandParam[];

type Loadout = { pilotId?: string; coreId?: string; pluginInstanceIds: string[] };
const squadOf = (loadouts: Record<string, Loadout>): { shipLoadouts: Record<string, Loadout> } =>
  ({ shipLoadouts: loadouts }) as never;

describe('⑥战力刻度 · 同刻度异搭配 → 战力相同（总纲1）', () => {
  it('两套完全不同的 舰×员×核 组合（同等级同装备档位）战力逐舰相等、队伍和相等', () => {
    // 组合A：极焰+影(核M) / 组合B：锁链+藏(核N)——舰/员/核全不同，档位全同（lv 缺省 1、无插件）。
    const a = squadOf({ shp01: { pilotId: 'pil01', coreId: 'core07', pluginInstanceIds: [] } });
    const b = squadOf({ shp20: { pilotId: 'pil09', coreId: 'core12', pluginInstanceIds: [] } });
    const pa = shipPowerOf(BANDS, a as never, 'shp01');
    const pb = shipPowerOf(BANDS, b as never, 'shp20');
    expect(pa).toBe(pb); // 换舰/换员/换核不改战力数字

    // 五舰队伍级：两套互不重叠的五舰组合 → 队伍战力和相等。
    const teamA = ['shp01', 'shp05', 'shp09', 'shp13', 'shp17'];
    const teamB = ['shp04', 'shp08', 'shp12', 'shp16', 'shp20'];
    const mk = (ships: string[], pilots: string[]): number => {
      const lo: Record<string, Loadout> = {};
      ships.forEach((s, i) => { lo[s] = { pilotId: pilots[i], pluginInstanceIds: [] }; });
      const sq = squadOf(lo);
      return ships.reduce((acc, s) => acc + shipPowerOf(BANDS, sq as never, s), 0);
    };
    const sumA = mk(teamA, ['pil01', 'pil02', 'pil03', 'pil04', 'pil05']);
    const sumB = mk(teamB, ['pil06', 'pil07', 'pil08', 'pil09', 'pil10']);
    expect(sumA).toBe(sumB);
  });

  it('对照防假过：档位变化必须改变战力（装核 vs 不装核 ≠）', () => {
    const withCore = squadOf({ shp01: { pilotId: 'pil01', coreId: 'core07', pluginInstanceIds: [] } });
    const noCore = squadOf({ shp01: { pilotId: 'pil01', pluginInstanceIds: [] } });
    expect(shipPowerOf(BANDS, withCore as never, 'shp01'))
      .toBeGreaterThan(shipPowerOf(BANDS, noCore as never, 'shp01'));
  });
});
