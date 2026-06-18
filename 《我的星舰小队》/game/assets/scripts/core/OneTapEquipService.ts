/**
 * 一键穿装（C18）——纯数据层核心服务。
 *
 * 范围：为指定上阵英雄自动选择并穿戴最优装备，结果写入 PlayerState.equipments.equippedByHeroId，
 * 可被 SaveService 落盘。基于 C17 的 EquipmentService 数据结构。
 * 不做：UI、装备获取/掉落/合成/强化，也不改 BattleEngine、不改配置校验、不新增装备来源系统。
 *
 * 设计约束（项目 CLAUDE.md）：普通 TypeScript，不依赖 Cocos cc，可在 Node/Vitest 单测。
 *
 * 规则要点：
 * - 仅处理 onFieldHeroIds 中的英雄；每英雄按 weapon/armor/engine/chip 各选 1 件。
 * - 评分仅用于选择：score = hp + atk*10 + def*8。
 * - 同部位选 score 最高的 owned；同一 owned 同一轮不被多个英雄重复占用。
 * - 已穿低分装备可被高分替换，被替换装备回到可用池（本轮重新参与分配）。
 * - 缺 definition / 部位不匹配 / 非法槽位 / 重复引用一律忽略，不抛异常。
 * - 无可用装备时该槽保持为空（原合法装备会作为候选被重新选中而保留），不产生负数或重复占用。
 */
import {
  EQUIPMENT_PARTS,
  EquipmentDefinition,
  EquipmentPart,
  EquipmentSlots,
  PlayerEquipmentState,
} from './EquipmentService';
import { PlayerState } from './PlayerState';

export interface OneTapEquipResult {
  /** 本次是否改变了任一上阵英雄的穿戴槽。 */
  changed: boolean;
  /** 实际处理的上阵英雄 id（已去重）。 */
  heroes: string[];
}

/** 装备评分：仅用于一键穿装的选择排序，不参与战力公式。 */
export function scoreEquipment(def: EquipmentDefinition): number {
  const b = def.bonus;
  return (b.hp ?? 0) + (b.atk ?? 0) * 10 + (b.def ?? 0) * 8;
}

function toDefinitionMap(
  definitions: Record<string, EquipmentDefinition> | EquipmentDefinition[],
): Map<string, EquipmentDefinition> {
  if (Array.isArray(definitions)) {
    return new Map(definitions.map((d) => [d.id, d]));
  }
  return new Map(Object.values(definitions).map((d) => [d.id, d]));
}

function slotsEqual(a: EquipmentSlots | undefined, b: EquipmentSlots): boolean {
  const prev = a ?? {};
  for (const part of EQUIPMENT_PARTS) {
    if ((prev[part] ?? undefined) !== (b[part] ?? undefined)) {
      return false;
    }
  }
  return true;
}

interface PartCandidate {
  ownedId: string;
  score: number;
}

/**
 * 一键穿装：就地更新 playerState.equipments.equippedByHeroId 并返回结果。
 *
 * 实现策略：以"可用池"为单一真源，从零重建上阵英雄的穿戴槽，从而天然满足：
 * - 无重复占用：每件装备在一轮内至多分配给一个英雄。
 * - 替换回池：上阵英雄当前所穿装备先全部释放进池再统一择优，低分件可被高分件替换。
 * 可用池 = 所有 owned，排除被"非上阵英雄"占用的装备（避免跨英雄重复占用/抢装）。
 */
export function oneTapEquip(
  playerState: PlayerState,
  onFieldHeroIds: string[],
  definitions: Record<string, EquipmentDefinition> | EquipmentDefinition[],
): OneTapEquipResult {
  const equip: PlayerEquipmentState = playerState.equipments;
  const defMap = toDefinitionMap(definitions);

  // 去重并保持顺序：决定同分时优先拿到高分装备的英雄顺序。
  const onField = onFieldHeroIds.filter((id, i) => onFieldHeroIds.indexOf(id) === i);
  const onFieldSet = new Set(onField);

  // 被"非上阵英雄"占用的装备保持不动，且不进入可用池。
  const reserved = new Set<string>();
  for (const [heroId, slots] of Object.entries(equip.equippedByHeroId)) {
    if (onFieldSet.has(heroId)) continue;
    if (!slots) continue;
    for (const part of EQUIPMENT_PARTS) {
      const ownedId = slots[part];
      if (ownedId && equip.owned[ownedId]) {
        reserved.add(ownedId);
      }
    }
  }

  // 按部位收集可用候选（owned 存在、definition 存在、部位合法且与定义一致、未被预留）。
  const candidatesByPart: Record<EquipmentPart, PartCandidate[]> = {
    weapon: [],
    armor: [],
    engine: [],
    chip: [],
  };
  for (const [ownedId, owned] of Object.entries(equip.owned)) {
    if (reserved.has(ownedId)) continue;
    const def = defMap.get(owned.definitionId);
    if (!def) continue; // 缺 definition
    if (!EQUIPMENT_PARTS.includes(def.part)) continue; // 非法部位
    candidatesByPart[def.part].push({ ownedId, score: scoreEquipment(def) });
  }

  // 分数降序；同分按 ownedId 升序，保证确定性。
  for (const part of EQUIPMENT_PARTS) {
    candidatesByPart[part].sort(
      (a, b) => b.score - a.score || (a.ownedId < b.ownedId ? -1 : a.ownedId > b.ownedId ? 1 : 0),
    );
  }

  // 逐部位把高分装备依次分配给上阵英雄（每英雄每部位至多 1 件，每件至多 1 个英雄）。
  const nextSlotsByHero = new Map<string, EquipmentSlots>();
  for (const heroId of onField) {
    nextSlotsByHero.set(heroId, {});
  }
  for (const part of EQUIPMENT_PARTS) {
    const list = candidatesByPart[part];
    let idx = 0;
    for (const heroId of onField) {
      if (idx >= list.length) break; // 无更多可用装备 -> 该英雄此部位保持空槽
      nextSlotsByHero.get(heroId)![part] = list[idx].ownedId;
      idx += 1;
    }
  }

  // 写回 PlayerState，并判断是否发生变化。
  let changed = false;
  for (const heroId of onField) {
    const next = nextSlotsByHero.get(heroId)!;
    if (!slotsEqual(equip.equippedByHeroId[heroId], next)) {
      changed = true;
    }
    equip.equippedByHeroId[heroId] = next;
  }

  return { changed, heroes: onField };
}
