import { describe, it, expect } from 'vitest';
import {
  createDefaultS7TutorialState,
  normalizeS7TutorialState,
  advanceStrongGuideStep,
  completeStrongGuide,
  hasSeenFirstTouch,
  markFirstTouchSeen,
} from '../assets/scripts/core/s7/S7TutorialState';

describe('S7TutorialState', () => {
  it('默认状态为未开始', () => {
    const s = createDefaultS7TutorialState();
    expect(s.strongGuideStep).toBe(0);
    expect(s.strongGuideDone).toBe(false);
    expect(s.seenFirstTouch).toEqual([]);
  });

  it('advanceStrongGuideStep 原地递增', () => {
    const s = createDefaultS7TutorialState();
    advanceStrongGuideStep(s);
    advanceStrongGuideStep(s);
    expect(s.strongGuideStep).toBe(2);
  });

  it('completeStrongGuide 置完成标记', () => {
    const s = createDefaultS7TutorialState();
    completeStrongGuide(s);
    expect(s.strongGuideDone).toBe(true);
  });

  it('markFirstTouchSeen 幂等去重', () => {
    const s = createDefaultS7TutorialState();
    markFirstTouchSeen(s, 'merchant_intro');
    markFirstTouchSeen(s, 'merchant_intro');
    markFirstTouchSeen(s, 'mailbox_intro');
    expect(s.seenFirstTouch).toEqual(['merchant_intro', 'mailbox_intro']);
    expect(hasSeenFirstTouch(s, 'merchant_intro')).toBe(true);
    expect(hasSeenFirstTouch(s, 'unknown_id')).toBe(false);
  });

  it('normalize 对非法/缺失字段退化为默认值', () => {
    expect(normalizeS7TutorialState(undefined)).toEqual(createDefaultS7TutorialState());
    expect(normalizeS7TutorialState(null)).toEqual(createDefaultS7TutorialState());
    const s = normalizeS7TutorialState({
      strongGuideStep: -3,
      strongGuideDone: 'yes',
      seenFirstTouch: ['a', 'a', 1, null, 'b'],
    });
    expect(s.strongGuideStep).toBe(0);
    expect(s.strongGuideDone).toBe(false);
    expect(s.seenFirstTouch).toEqual(['a', 'b']);
  });

  it('normalize 保留合法字段', () => {
    const s = normalizeS7TutorialState({
      strongGuideStep: 4.9,
      strongGuideDone: true,
      seenFirstTouch: ['x', 'y'],
    });
    expect(s.strongGuideStep).toBe(4);
    expect(s.strongGuideDone).toBe(true);
    expect(s.seenFirstTouch).toEqual(['x', 'y']);
  });
});
