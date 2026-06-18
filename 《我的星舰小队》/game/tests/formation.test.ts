import { describe, it, expect } from 'vitest';
import { Formation, SQUAD_SIZE, HeroPositionLookup } from '../assets/scripts/core/Formation';

// 与 hero_config.sample.json 对齐：hero_isen=front, hero_mia=back
const HERO_POSITIONS: Record<string, 'front' | 'back'> = {
  hero_isen: 'front',
  hero_mia: 'back',
  hero_rex: 'front',
  hero_nova: 'back',
  hero_kai: 'back',
};

const lookup: HeroPositionLookup = (heroId) => HERO_POSITIONS[heroId];

describe('Formation', () => {
  it('creates a 5-slot squad with 2 front and 3 back', () => {
    const formation = new Formation(lookup);
    expect(formation.getSlots().length).toBe(SQUAD_SIZE);
    expect(formation.isStructureValid()).toBe(true);
    console.log('formation valid: 2 front, 3 back');
    expect(formation.countByPosition('front')).toBe(0);
    expect(formation.countByPosition('back')).toBe(0);
    const slots = formation.getSlots();
    expect(slots.filter((s) => s.position === 'front').length).toBe(2);
    expect(slots.filter((s) => s.position === 'back').length).toBe(3);
  });

  it('assigns heroes into matching slots', () => {
    const formation = new Formation(lookup);
    expect(formation.assign(0, 'hero_isen')).toEqual({ ok: true });
    expect(formation.assign(2, 'hero_mia')).toEqual({ ok: true });
    expect(formation.getSlot(0)?.heroId).toBe('hero_isen');
    expect(formation.getSlot(2)?.heroId).toBe('hero_mia');
    expect(formation.countByPosition('front')).toBe(1);
    expect(formation.countByPosition('back')).toBe(1);
  });

  it('rejects illegal placement: front hero into back slot', () => {
    const formation = new Formation(lookup);
    const result = formation.assign(2, 'hero_isen');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不能放入/);
  });

  it('rejects illegal placement: back hero into front slot', () => {
    const formation = new Formation(lookup);
    const result = formation.assign(0, 'hero_mia');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不能放入/);
  });

  it('rejects assigning into an occupied slot', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    const result = formation.assign(0, 'hero_rex');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/已被占用/);
  });

  it('rejects assigning the same hero twice', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    const result = formation.assign(1, 'hero_isen');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/已在阵容中/);
  });

  it('rejects unknown hero ids', () => {
    const formation = new Formation(lookup);
    const result = formation.assign(0, 'hero_unknown');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/未找到 positionType/);
  });

  it('replaces a hero in an occupied slot with a same-position hero', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    const result = formation.replace(0, 'hero_rex');
    expect(result.ok).toBe(true);
    expect(formation.getSlot(0)?.heroId).toBe('hero_rex');
    expect(formation.findSlotByHero('hero_isen')).toBeUndefined();
  });

  it('rejects replacing with an incompatible position type', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    const result = formation.replace(0, 'hero_mia');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/不能放入/);
  });

  it('removes a hero from a slot', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    const result = formation.remove(0);
    expect(result.ok).toBe(true);
    expect(formation.getSlot(0)?.heroId).toBeNull();
  });

  it('reports full squad once all 5 slots are filled', () => {
    const formation = new Formation(lookup);
    formation.assign(0, 'hero_isen');
    formation.assign(1, 'hero_rex');
    formation.assign(2, 'hero_mia');
    formation.assign(3, 'hero_nova');
    formation.assign(4, 'hero_kai');
    expect(formation.isFull()).toBe(true);
  });

  it('rejects operations on out-of-range slot indices', () => {
    const formation = new Formation(lookup);
    expect(formation.assign(99, 'hero_isen').ok).toBe(false);
    expect(formation.replace(-1, 'hero_isen').ok).toBe(false);
    expect(formation.remove(99).ok).toBe(false);
  });
});
