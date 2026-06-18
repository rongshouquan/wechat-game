// CC-07E-1: 成长段位参数表 growth_band_param 测试。
// 证明：① 表可被 S7 加载层/校验器消费；② 段端点/控制点转写自 03-04 v0.2 §3.2-3.5（冻结值）；
// ③ 按既定派生口径（band 段内线性 / core 控制点分段线性）展开的逐级/逐阶值与 CC-06A 口径一致；
// ④ 校验器拒绝非法成长行。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigRuntime, S7TableReader } from '../assets/scripts/config/s7/S7ConfigRuntime';
import { validateS7ConfigBundle } from '../assets/scripts/config/s7/ConfigValidatorS7';
import { S7ConfigTableName, S7GrowthBandParam } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

const TABLE_NAMES: S7ConfigTableName[] = [
  'battle_template_config', 'ship_config', 'pilot_config', 'core_config', 'plugin_config',
  'source_tag_config', 'power_reference_param', 'free_resource_anchor_param', 'upgrade_cost_param',
  'enhance_cost_param', 'growth_band_param', 'refund_param', 'pressure_param', 'reward_param', 'shop_param',
  'merchant_refresh_param', 'recycle_param', 'anti_arbitrage_check',
  'enemy_schema_config', 'boss_skeleton_config', 'prebattle_preview_config',
  'ship_pilot_fit_config', 'core_plugin_fit_config',
  'building_config', 'building_unlock_config', 'building_level_cost_param',
  'building_level_effect_param', 'building_anchor_impact_check',
  'mainline_node_config', 'chapter_config', 'star_region_config', 'boss_node_config',
  'tutorial_trigger_config', 'unlock_checkpoint_config', 'protection_reset_config',
  'reward_pool_ref_config', 'no_ad_path_check_config', 'risk_fallback_70_config',
  'battle_unit_stat_param', 'battle_effect_param', 'battle_encounter_param',
  'battle_spawn_param', 'battle_boss_phase_param',
];

function readTable<T>(name: S7ConfigTableName): T {
  return JSON.parse(readFileSync(path.join(S7_DIR, `${name}.sample.json`), 'utf-8')) as T;
}
function loadBundle(): Record<S7ConfigTableName, unknown[]> {
  const b = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of TABLE_NAMES) b[t] = readTable<unknown[]>(t);
  return b;
}

const fsReader: S7TableReader = async (t: S7ConfigTableName) => readTable<unknown[]>(t);

// 与 simulate-s7-progression.mjs 一致的派生口径（band 段内线性 / control_point 分段线性）。
const round2 = (v: number): number => Math.round(v * 100) / 100;
const lerp = (min: number, max: number, t: number): number => min + (max - min) * t;
function piecewiseLerp(points: [number, number][], x: number): number {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return x < points[0][0] ? points[0][1] : points[points.length - 1][1];
}

function rows(): S7GrowthBandParam[] {
  return readTable<S7GrowthBandParam[]>('growth_band_param');
}
function band(targetType: string, bandId: string): S7GrowthBandParam {
  return rows().find((r) => r.targetType === targetType && r.bandId === bandId)!;
}
function bandLevel(b: S7GrowthBandParam, level: number): number {
  const t = (level - b.interpFromIndex) / (b.toIndex - b.interpFromIndex);
  return round2(lerp(b.powerMin, b.powerMax, t));
}

describe('s7 growth_band_param - landing & validation', () => {
  it('loads through the S7 config runtime layer', async () => {
    const rt = await S7ConfigRuntime.load(fsReader);
    expect(rt.getAll('growth_band_param').length).toBe(16);
    expect(rt.getById('growth_band_param', 'ship_growth_lv_1_10')).toBeDefined();
  });

  it('passes the full S7 validator with growth included', () => {
    expect(validateS7ConfigBundle(loadBundle())).toEqual([]);
  });

  it('covers ship/pilot Lv1-40, plugin +1-15, core stages {0,2,3,5}', () => {
    const all = rows();
    const cover = (tt: string) =>
      all.filter((r) => r.targetType === tt && r.curveType === 'band_linear').sort((a, b2) => a.fromIndex - b2.fromIndex);
    const ship = cover('ship');
    expect(ship[0].fromIndex).toBe(1);
    expect(ship[ship.length - 1].toIndex).toBe(40);
    const pilot = cover('pilot');
    expect(pilot[0].fromIndex).toBe(1);
    expect(pilot[pilot.length - 1].toIndex).toBe(40);
    const plugin = cover('plugin');
    expect(plugin[0].fromIndex).toBe(1);
    expect(plugin[plugin.length - 1].toIndex).toBe(15);
    const coreStages = all.filter((r) => r.targetType === 'core').map((r) => r.fromIndex).sort((a, b2) => a - b2);
    expect(coreStages).toEqual([0, 2, 3, 5]);
  });
});

describe('s7 growth_band_param - frozen §3.2-3.5 endpoints & derivation parity', () => {
  it('ship endpoints match §3.2 (Lv1=120 / Lv10=300 / Lv40=2200)', () => {
    expect(bandLevel(band('ship', 'ship_lv_1_10'), 1)).toBe(120);
    expect(bandLevel(band('ship', 'ship_lv_1_10'), 10)).toBe(300);
    expect(bandLevel(band('ship', 'ship_lv_31_40'), 40)).toBe(2200);
  });

  it('pilot endpoints match §3.3 (Lv1=40 / Lv40=1100)', () => {
    expect(bandLevel(band('pilot', 'pilot_lv_1_10'), 1)).toBe(40);
    expect(bandLevel(band('pilot', 'pilot_lv_31_40'), 40)).toBe(1100);
  });

  it('plugin +0-3 keeps interp domain 0..3 outputting +1=106.67 (CC-06A parity)', () => {
    const b = band('plugin', 'plugin_enhance_0_3');
    expect(b.interpFromIndex).toBe(0);
    expect(b.fromIndex).toBe(1);
    expect(b.toIndex).toBe(3);
    expect(bandLevel(b, 1)).toBe(106.67);
    expect(bandLevel(b, 3)).toBe(160);
    expect(bandLevel(band('plugin', 'plugin_enhance_11_15'), 15)).toBe(750);
  });

  it('core control points piecewise-lerp stage1=750 / stage4=1550 (CC-06A parity)', () => {
    const corePower = rows()
      .filter((r) => r.targetType === 'core')
      .sort((a, b2) => a.fromIndex - b2.fromIndex)
      .map((r) => [r.fromIndex, r.powerMin] as [number, number]);
    expect(round2(piecewiseLerp(corePower, 0))).toBe(600);
    expect(round2(piecewiseLerp(corePower, 1))).toBe(750);
    expect(round2(piecewiseLerp(corePower, 4))).toBe(1550);
    expect(round2(piecewiseLerp(corePower, 5))).toBe(1800);
  });
});

describe('s7 growth_band_param - validator rejects bad rows', () => {
  it('rejects a band whose coverage breaks contiguity', () => {
    const b = loadBundle();
    const g = b.growth_band_param as S7GrowthBandParam[];
    const target = g.find((r) => r.rowId === 'ship_growth_lv_11_20')!;
    target.fromIndex = 12; // 制造 10->12 的缺口
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'growth_band_param')).toBe(true);
  });

  it('rejects a mismatched secondaryKind', () => {
    const b = loadBundle();
    const g = b.growth_band_param as Array<Record<string, unknown>>;
    g.find((r) => r.rowId === 'pilot_growth_lv_1_10')!.secondaryKind = 'stat'; // pilot 应为 none
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'growth_band_param')).toBe(true);
  });

  it('rejects a control_point row with powerMin != powerMax', () => {
    const b = loadBundle();
    const g = b.growth_band_param as Array<Record<string, unknown>>;
    g.find((r) => r.rowId === 'core_growth_stage_2')!.powerMax = 999;
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'growth_band_param')).toBe(true);
  });
});
