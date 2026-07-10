// 单位成长积木（C1b 升级变强 步2，纯 TS，不依赖 cc）：把"星舰等级"经 growth_band_param 折成效果积木，
// 喂给 S7BattleStatDerivation.deriveUnit 让升过级的船在战斗里更强。v1.0 §6 升级→提升基础属性。
//
// 口径（与 s7_growth_band.test 的 bandLevel 一致）：段内线性——找到含该等级的 band，
//   t = (level - interpFromIndex) / (toIndex - interpFromIndex)，power = lerp(powerMin, powerMax, t)。
// 映射（C1b 占位·Ron 拍板"战力倍率放大血攻"）：ratio = power(level) / power(1)，
//   按 (ratio - 1) 作为百分比同时放大 maxHp 与 attack（战力越高、血攻越高）。
//   ⚠️ 占位简化：精确"每条属性各涨多少 / 高级段放大幅度（避免血×攻双乘过冲）"留第二块校准；
//   这里只保证"升级→可见变强"成立、且用的是冻结的 growth_band 数据、不瞎编。

import { S7GrowthBandParam } from '../../config/s7/ConfigTypesS7';
import { S7EffectBlock } from './S7BattleEffectBlock';
import { S7_UNIT_MIN_LEVEL, S7_UNIT_MAX_LEVEL } from './S7UnitLevelState';
import { S7_TIER_ATTR_MULT, S7_PILOT_STAR_MULT, S7_PLAYER_CRIT_BASE } from './S7PowerRating';

function clampLevel(level: number): number {
  const n = Math.floor(Number.isFinite(level) ? level : S7_UNIT_MIN_LEVEL);
  return Math.max(S7_UNIT_MIN_LEVEL, Math.min(S7_UNIT_MAX_LEVEL, n));
}

/**
 * 某 targetType（ship/pilot）在某等级的战力 power（段内线性）。
 * 找到含该等级的 band（interpFromIndex<=level<=toIndex），无命中则用最接近的端点 band 夹紧。
 * 无该 targetType 的成长段时返回 0（调用方据此判定"无成长"）。
 */
export function unitPowerAtLevel(bands: S7GrowthBandParam[], targetType: 'ship' | 'pilot', level: number): number {
  const lv = clampLevel(level);
  const mine = bands.filter((b) => b.targetType === targetType && b.curveType === 'band_linear');
  if (mine.length === 0) return 0;
  // 命中含该等级的段；否则取等级落在其右侧最远的段（夹紧到最高段尾）。
  let band = mine.find((b) => lv >= b.interpFromIndex && lv <= b.toIndex);
  if (!band) {
    const sorted = mine.slice().sort((a, b) => a.interpFromIndex - b.interpFromIndex);
    band = lv < sorted[0].interpFromIndex ? sorted[0] : sorted[sorted.length - 1];
  }
  const span = band.toIndex - band.interpFromIndex;
  // 段内线性插值；等级落在所有段之外时夹到最近段端点（t∈[0,1]、不外插）。
  // 取消建筑卡等级后等级上限放到 100，而 growth_band 仅铺到 40 → 41-100 暂"持平在最高段末"(占位·不外插出离谱战力)，真实 41-100 曲线留第三块。
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (lv - band.interpFromIndex) / span));
  return band.powerMin + (band.powerMax - band.powerMin) * t;
}

/**
 * 星舰成长积木：按"战力倍率"同时放大 maxHp + attack（pct 修正）。
 * 1 级（或无成长/倍率<=1）返回空数组（不加积木）。
 */
export function shipGrowthBlocks(bands: S7GrowthBandParam[], level: number): S7EffectBlock[] {
  const base = unitPowerAtLevel(bands, 'ship', S7_UNIT_MIN_LEVEL);
  const cur = unitPowerAtLevel(bands, 'ship', level);
  if (base <= 0 || cur <= base) return [];
  const pct = cur / base - 1; // 战力倍率超出 1 的部分作为同比例血/攻加成
  return [
    { kind: 'modifier', stat: 'maxHp', op: 'pct', value: pct, source: 'ship_growth' },
    { kind: 'modifier', stat: 'attack', op: 'pct', value: pct, source: 'ship_growth' },
  ];
}

/**
 * 驾驶员成长积木（占位）：v1.0 §5.2 驾驶员升级强化"驾驶天赋数值"、无原始属性，
 * 故暂不映射到战斗基础属性（hp/攻），返回空。精确天赋成长留第二块/块5（届时落 affix/behavior 积木）。
 */
export function pilotGrowthBlocks(_bands: S7GrowthBandParam[], _level: number): S7EffectBlock[] {
  return [];
}

/**
 * 星舰升阶属性积木（机制批③段三·躯干统一）：×1.26^阶 血/攻/甲同乘（细表 §12.1）。
 * 此前该乘区只活在模拟器手动注入里（tier_up）、真机走占位百分比表（+12..72% 血/攻）——两个世界。
 * 现归装配器统一通道：tier 0（C 阶）返回空=既有测试字节不变。
 */
export function shipTierBlocks(tier: number): S7EffectBlock[] {
  const t = Math.max(0, Math.floor(tier));
  if (t <= 0) return [];
  const pct = Math.pow(S7_TIER_ATTR_MULT, t) - 1;
  return [
    { kind: 'modifier', stat: 'maxHp', op: 'pct', value: pct, source: 'tier_up' },
    { kind: 'modifier', stat: 'attack', op: 'pct', value: pct, source: 'tier_up' },
    { kind: 'modifier', stat: 'armor', op: 'pct', value: pct, source: 'tier_up' },
  ];
}

/**
 * 驾驶员数值线积木（C20 通道·细表 §10——与天赋机制分立防双吃：天赋=机制件按星/级缩放，
 * 本件=纯数值成长）：星系数×(1+0.01×驾级)−1，护卫组折 armor%、其余折 attack%。
 * 1★ Lv0（缺省）= 0 = 空数组=既有测试字节不变。
 */
export function pilotNumericBlocks(star: number, level: number, guard: boolean): S7EffectBlock[] {
  const s = Math.max(1, Math.min(5, Math.floor(star)));
  const lv = Math.max(0, Math.floor(level));
  const value = S7_PILOT_STAR_MULT[s] * (1 + 0.01 * lv) - 1;
  if (value <= 0) return [];
  return [{ kind: 'modifier', stat: guard ? 'armor' : 'attack', op: 'pct', value, source: 'pilot_scale' }];
}

/**
 * 玩家侧暴击基线积木（随机带宽"窄档"现行·真机三入口与模拟器同源注入——
 * 不进装配器缺省：既有战斗测试的 RNG 轨迹不因批③改变，注入责任在调用方）。
 */
export function playerCritBaseBlocks(): S7EffectBlock[] {
  return [
    { kind: 'affix', affix: 'critRate', value: S7_PLAYER_CRIT_BASE.rate, source: 'crit_base' },
    { kind: 'affix', affix: 'critDmg', value: S7_PLAYER_CRIT_BASE.dmg, source: 'crit_base' },
  ];
}
