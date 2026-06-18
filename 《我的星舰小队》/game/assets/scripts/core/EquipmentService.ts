/**
 * 装备四部位（C17）——纯数据层核心服务。
 *
 * 范围：装备数据结构 + 4 部位（武器/护甲/引擎/芯片）定义 + 属性加成聚合计算。
 * 不做：穿戴 UI、掉落/合成、强化、锁定、品质、随机词条，也不定义正式战力公式。
 *
 * 设计约束（项目 CLAUDE.md）：本模块为普通 TypeScript，不依赖 Cocos cc，可在 Node/Vitest 单测。
 * 为避免与 PlayerState 形成循环依赖，本模块只认 PlayerEquipmentState（装备子状态），不引用 PlayerState。
 */

export type EquipmentPart = 'weapon' | 'armor' | 'engine' | 'chip';

/** 装备提供的属性加成；C17 仅覆盖 hp/atk/def 三项，缺省视为 0。 */
export interface EquipmentBonus {
  hp?: number;
  atk?: number;
  def?: number;
}

/** 装备定义（静态数据）：唯一 id、所属部位、展示名、加成。 */
export interface EquipmentDefinition {
  id: string;
  part: EquipmentPart;
  name: string;
  bonus: EquipmentBonus;
}

/** 玩家拥有的某一件具体装备实例，引用一条 EquipmentDefinition。 */
export interface OwnedEquipment {
  id: string;
  definitionId: string;
}

/** 单个英雄四部位的穿戴槽，值为 OwnedEquipment.id；未穿戴则该部位缺省。 */
export interface EquipmentSlots {
  weapon?: string;
  armor?: string;
  engine?: string;
  chip?: string;
}

/** 玩家装备状态：拥有的装备仓库 + 各英雄的穿戴槽。 */
export interface PlayerEquipmentState {
  owned: Record<string, OwnedEquipment>;
  equippedByHeroId: Record<string, EquipmentSlots>;
}

/** 参与加成计算的基础属性三元组（与战斗单位的 hp/atk/def 对齐）。 */
export interface HeroBaseStats {
  hp: number;
  atk: number;
  def: number;
}

export const EQUIPMENT_PARTS: EquipmentPart[] = ['weapon', 'armor', 'engine', 'chip'];

export function createDefaultEquipmentState(): PlayerEquipmentState {
  return { owned: {}, equippedByHeroId: {} };
}

function toDefinitionMap(
  definitions: Record<string, EquipmentDefinition> | EquipmentDefinition[],
): Map<string, EquipmentDefinition> {
  if (Array.isArray(definitions)) {
    return new Map(definitions.map((d) => [d.id, d]));
  }
  return new Map(Object.values(definitions).map((d) => [d.id, d]));
}

/**
 * 计算某英雄当前穿戴装备带来的属性加成总和。
 * 容错（均忽略、绝不抛异常）：
 * - 空槽：该部位无加成
 * - 缺 owned：槽位引用的实例不在仓库中
 * - 缺 definition：实例引用的定义不存在
 * - 部位不匹配：装备定义的 part 与所在槽位不一致
 * - 重复槽位引用：同一 OwnedEquipment 被多个槽位引用时只生效一次
 * 同一英雄每部位最多生效 1 件（槽位结构天然保证单部位单值）。
 * C17 不处理跨英雄同一装备互斥。
 */
export function getEquipmentBonusForHero(
  state: PlayerEquipmentState,
  heroId: string,
  definitions: Record<string, EquipmentDefinition> | EquipmentDefinition[],
): EquipmentBonus {
  const total: Required<EquipmentBonus> = { hp: 0, atk: 0, def: 0 };
  const slots = state.equippedByHeroId[heroId];
  if (!slots) {
    return total;
  }

  const defMap = toDefinitionMap(definitions);
  const usedOwnedIds = new Set<string>();

  for (const part of EQUIPMENT_PARTS) {
    const ownedId = slots[part];
    if (!ownedId) continue; // 空槽
    if (usedOwnedIds.has(ownedId)) continue; // 重复槽位引用同一件，只生效一次

    const owned = state.owned[ownedId];
    if (!owned) continue; // 缺 owned

    const def = defMap.get(owned.definitionId);
    if (!def) continue; // 缺 definition
    if (def.part !== part) continue; // 部位不匹配

    usedOwnedIds.add(ownedId);
    total.hp += def.bonus.hp ?? 0;
    total.atk += def.bonus.atk ?? 0;
    total.def += def.bonus.def ?? 0;
  }

  return total;
}

/** 把装备加成叠加到基础属性上，返回新的属性三元组（不修改入参）。 */
export function applyEquipmentBonus(baseStats: HeroBaseStats, bonus: EquipmentBonus): HeroBaseStats {
  return {
    hp: baseStats.hp + (bonus.hp ?? 0),
    atk: baseStats.atk + (bonus.atk ?? 0),
    def: baseStats.def + (bonus.def ?? 0),
  };
}
