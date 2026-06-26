/**
 * M0 · 新手引导进度状态（纯 TS，不依赖 cc）。
 *
 * 只存"走到哪一步"，不持有任何关卡/系统具体内容——具体强引导步骤定义（关1-5各检查点）
 * 由 M1-M3 在表现层（S7DemoController）按顺序消费 strongGuideStep；本层只管递增/查询/持久化。
 * 弱引导（首次接触短教程）按系统/内容各自的字符串 id 登记，谁触发谁调 hasSeenFirstTouch/markFirstTouchSeen，
 * 本层不登记 id 清单（清单见 GDD-M 设计 §弱引导，由调用方各自定义 id）。
 */

export interface S7TutorialState {
  /** 强引导当前步数（0=未开始）；每过一个检查点由调用方调 advanceStrongGuideStep 递增 1。 */
  strongGuideStep: number;
  /** 强引导是否已全部完成（首 Boss/星核收尾后置 true，之后转入弱引导，不再锁操作）。 */
  strongGuideDone: boolean;
  /** 已展示过的弱引导首触 id 集合（去重，只展示一次）。 */
  seenFirstTouch: string[];
}

export function createDefaultS7TutorialState(): S7TutorialState {
  return { strongGuideStep: 0, strongGuideDone: false, seenFirstTouch: [] };
}

/** 规范化：非法/缺失字段一律退化为默认值；seenFirstTouch 只保留字符串并去重。 */
export function normalizeS7TutorialState(raw: unknown): S7TutorialState {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const step = typeof src.strongGuideStep === 'number' && Number.isFinite(src.strongGuideStep) && src.strongGuideStep > 0
    ? Math.floor(src.strongGuideStep) : 0;
  const done = src.strongGuideDone === true;
  const rawList = Array.isArray(src.seenFirstTouch) ? src.seenFirstTouch : [];
  const seenFirstTouch = Array.from(new Set(rawList.filter((id): id is string => typeof id === 'string')));
  return { strongGuideStep: step, strongGuideDone: done, seenFirstTouch };
}

/** 强引导前进一步（原地修改）。 */
export function advanceStrongGuideStep(state: S7TutorialState): void {
  state.strongGuideStep += 1;
}

/** 标记强引导全部完成（原地修改）：之后所有系统改走弱引导（首触短教程，可跳过）。 */
export function completeStrongGuide(state: S7TutorialState): void {
  state.strongGuideDone = true;
}

export function hasSeenFirstTouch(state: S7TutorialState, id: string): boolean {
  return state.seenFirstTouch.includes(id);
}

/** 标记某弱引导首触 id 已展示（原地修改，幂等——重复标记不会产生重复项）。 */
export function markFirstTouchSeen(state: S7TutorialState, id: string): void {
  if (!state.seenFirstTouch.includes(id)) {
    state.seenFirstTouch.push(id);
  }
}
