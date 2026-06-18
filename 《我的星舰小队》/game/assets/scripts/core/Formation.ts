export type SlotPosition = 'front' | 'back';

export interface FormationSlot {
  readonly index: number;
  readonly position: SlotPosition;
  heroId: string | null;
}

export type HeroPositionLookup = (heroId: string) => SlotPosition | undefined;

export interface FormationOpResult {
  ok: boolean;
  error?: string;
}

const FRONT_SLOT_COUNT = 2;
const BACK_SLOT_COUNT = 3;
export const SQUAD_SIZE = FRONT_SLOT_COUNT + BACK_SLOT_COUNT;

function buildSlots(): FormationSlot[] {
  const slots: FormationSlot[] = [];
  for (let i = 0; i < FRONT_SLOT_COUNT; i++) {
    slots.push({ index: slots.length, position: 'front', heroId: null });
  }
  for (let i = 0; i < BACK_SLOT_COUNT; i++) {
    slots.push({ index: slots.length, position: 'back', heroId: null });
  }
  return slots;
}

/**
 * 5 人小队阵容模型：2 前排 + 3 后排，固定槽位数量与位置类型。
 * 角色的站位合法性由 hero_config 中的 positionType 决定（front/back），
 * 通过 HeroPositionLookup 注入，避免直接依赖配置加载器或 Cocos 运行时。
 */
export class Formation {
  private readonly slots: FormationSlot[];

  constructor(private readonly lookupPosition: HeroPositionLookup) {
    this.slots = buildSlots();
  }

  getSlots(): readonly FormationSlot[] {
    return this.slots;
  }

  getSlot(slotIndex: number): FormationSlot | undefined {
    return this.slots[slotIndex];
  }

  findSlotByHero(heroId: string): FormationSlot | undefined {
    return this.slots.find((slot) => slot.heroId === heroId);
  }

  /** 上阵：将角色放入指定槽位。槽位必须为空，且角色站位类型需匹配槽位类型。 */
  assign(slotIndex: number, heroId: string): FormationOpResult {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return { ok: false, error: `槽位 ${slotIndex} 不存在` };
    }
    if (slot.heroId !== null) {
      return { ok: false, error: `槽位 ${slotIndex} 已被占用` };
    }
    const validation = this.validatePlacement(slotIndex, heroId);
    if (!validation.ok) {
      return validation;
    }
    if (this.findSlotByHero(heroId)) {
      return { ok: false, error: `角色 "${heroId}" 已在阵容中` };
    }
    slot.heroId = heroId;
    return { ok: true };
  }

  /** 替换：将槽位中的角色换成新角色，原角色卸下。槽位与新角色的位置类型必须匹配。 */
  replace(slotIndex: number, heroId: string): FormationOpResult {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return { ok: false, error: `槽位 ${slotIndex} 不存在` };
    }
    const validation = this.validatePlacement(slotIndex, heroId);
    if (!validation.ok) {
      return validation;
    }
    const existing = this.findSlotByHero(heroId);
    if (existing && existing.index !== slotIndex) {
      return { ok: false, error: `角色 "${heroId}" 已在阵容中` };
    }
    slot.heroId = heroId;
    return { ok: true };
  }

  /** 卸下：清空指定槽位。 */
  remove(slotIndex: number): FormationOpResult {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return { ok: false, error: `槽位 ${slotIndex} 不存在` };
    }
    slot.heroId = null;
    return { ok: true };
  }

  /** 校验角色是否可以放入指定槽位：角色 positionType 必须与槽位 position 一致。 */
  validatePlacement(slotIndex: number, heroId: string): FormationOpResult {
    const slot = this.slots[slotIndex];
    if (!slot) {
      return { ok: false, error: `槽位 ${slotIndex} 不存在` };
    }
    const heroPosition = this.lookupPosition(heroId);
    if (!heroPosition) {
      return { ok: false, error: `角色 "${heroId}" 未找到 positionType` };
    }
    if (heroPosition !== slot.position) {
      return {
        ok: false,
        error: `角色 "${heroId}" 站位类型为 "${heroPosition}"，不能放入 "${slot.position}" 槽位`,
      };
    }
    return { ok: true };
  }

  isFull(): boolean {
    return this.slots.every((slot) => slot.heroId !== null);
  }

  countByPosition(position: SlotPosition): number {
    return this.slots.filter((slot) => slot.position === position && slot.heroId !== null).length;
  }

  /** 阵容是否满足 2 前排 + 3 后排的固定结构（仅校验槽位结构本身，不要求填满）。 */
  isStructureValid(): boolean {
    const frontSlots = this.slots.filter((s) => s.position === 'front');
    const backSlots = this.slots.filter((s) => s.position === 'back');
    return frontSlots.length === FRONT_SLOT_COUNT && backSlots.length === BACK_SLOT_COUNT;
  }
}
