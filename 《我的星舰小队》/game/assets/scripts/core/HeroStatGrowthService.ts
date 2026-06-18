/**
 * 英雄等级属性折算（S5C-05 数值初稿，纯 TS，不依赖 cc）。
 *
 * 把英雄等级折算为战斗入场最终属性，供 BattleLaunchService 组装 BattleUnit 时传入
 * buildHeroUnit(..., finalStats)。只影响战斗入场 hp/atk/def，不改 hero_config 基础值、
 * 不改技能倍率/攻速、不接装备战力。公式来自《S5C-05 数值初稿与试玩验收草案》§3.1。
 *
 *   levelBonus = level - 1
 *   hp  = round(baseHp  * (1 + 0.22 * levelBonus))
 *   atk = round(baseAtk * (1 + 0.18 * levelBonus))
 *   def = round(baseDef * (1 + 0.14 * levelBonus))
 */

/** 每级成长系数（草案 §3.1，工程数值初稿，可调参不改结构）。 */
export const HERO_LEVEL_GROWTH = {
  hpPerLevel: 0.22,
  atkPerLevel: 0.18,
  defPerLevel: 0.14,
} as const;

export interface HeroBaseStats {
  hp: number;
  atk: number;
  def: number;
}

export interface HeroFinalStats {
  hp: number;
  atk: number;
  def: number;
}

/**
 * 按等级折算最终战斗属性。等级 <=1 时返回基础值（levelBonus 下限 0），不放大。
 */
export function computeHeroFinalStats(base: HeroBaseStats, level: number): HeroFinalStats {
  const levelBonus = Math.max(0, level - 1);
  return {
    hp: Math.round(base.hp * (1 + HERO_LEVEL_GROWTH.hpPerLevel * levelBonus)),
    atk: Math.round(base.atk * (1 + HERO_LEVEL_GROWTH.atkPerLevel * levelBonus)),
    def: Math.round(base.def * (1 + HERO_LEVEL_GROWTH.defPerLevel * levelBonus)),
  };
}
