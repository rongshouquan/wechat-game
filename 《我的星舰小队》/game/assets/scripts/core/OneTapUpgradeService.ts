/**
 * 一键升级（C12）。
 *
 * 纯 TypeScript 模块，不依赖 cc：在资源允许范围内自动选择升级目标并批量执行。
 * 升级数值沿用 C07 现有占位曲线（computeUpgradeCost / upgradeHero），本任务不重设数值。
 * 不含一键穿装（穿装已移出阶段2，延后到阶段3装备系统）。
 *
 * 选择策略：
 * 1. 优先升级"上阵英雄"（onFieldHeroIds）；上阵英雄全部升不动后，再考虑其余可升英雄（可选关闭）。
 * 2. 同等条件下优先升当前最低等级的英雄（拉齐木桶短板）。
 * 3. 资源不足以再升任何目标时停止，返回明确状态，不把资源扣成负数。
 *
 * 升级结果直接作用在传入的 PlayerState 上，调用方据此走 C08 存档落盘。
 */
import { PlayerState, UpgradeCost, computeUpgradeCost, getHeroLevel, upgradeHero } from './PlayerState';

export interface OneTapUpgradeParams {
  playerState: PlayerState;
  /** 当前上阵英雄 id 列表（优先升级对象）。 */
  onFieldHeroIds: string[];
  /** 其余可操作但未上阵的英雄 id 列表；includeBench=false 时不参与一键升级。 */
  benchHeroIds?: string[];
  /** 是否把替补席英雄也纳入一键升级，默认 false（只升上阵英雄）。 */
  includeBench?: boolean;
  /** 自定义升级消耗函数，默认沿用 C07 占位曲线。 */
  costFn?: (currentLevel: number) => UpgradeCost;
  /** 单次一键升级的最大升级步数上限，防止资源极多时无限循环；默认 100。 */
  maxSteps?: number;
}

export interface OneTapUpgradeStep {
  heroId: string;
  fromLevel: number;
  toLevel: number;
  cost: UpgradeCost;
}

export type OneTapUpgradeStopReason = 'no_resource' | 'no_candidate' | 'max_steps_reached';

export interface OneTapUpgradeResult {
  /** 本次一键升级实际执行的每一步。 */
  steps: OneTapUpgradeStep[];
  /** 至少执行了一步升级。 */
  applied: boolean;
  /** 升级停止的原因。 */
  stopReason: OneTapUpgradeStopReason;
  totalCost: UpgradeCost;
  log: string[];
}

interface Candidate {
  heroId: string;
  /** 优先级分组：0 = 上阵，1 = 替补；数字越小越优先。 */
  group: number;
  level: number;
  cost: UpgradeCost;
}

function canAfford(state: PlayerState, cost: UpgradeCost): boolean {
  return state.resources.starCoin >= cost.starCoin && state.resources.expChip >= cost.expChip;
}

/**
 * 选出当前这一步最应升级的英雄：
 * - 仅保留资源足够支付的候选；
 * - 先按分组（上阵优先），再按当前等级升序（最低等级优先）。
 */
function pickNextHero(state: PlayerState, heroIds: string[], group: number, costFn: (lv: number) => UpgradeCost, acc: Candidate[]): void {
  for (const heroId of heroIds) {
    const level = getHeroLevel(state, heroId);
    const cost = costFn(level);
    if (canAfford(state, cost)) {
      acc.push({ heroId, group, level, cost });
    }
  }
}

export function oneTapUpgrade(params: OneTapUpgradeParams): OneTapUpgradeResult {
  const { playerState } = params;
  const costFn = params.costFn ?? computeUpgradeCost;
  const includeBench = params.includeBench ?? false;
  const benchHeroIds = params.benchHeroIds ?? [];
  const maxSteps = params.maxSteps ?? 100;

  const steps: OneTapUpgradeStep[] = [];
  const totalCost: UpgradeCost = { starCoin: 0, expChip: 0 };
  const log: string[] = [];

  // 是否存在任何"潜在"升级对象（不考虑资源），用于区分 no_candidate vs no_resource。
  const allHeroIds = includeBench ? [...params.onFieldHeroIds, ...benchHeroIds] : [...params.onFieldHeroIds];
  if (allHeroIds.length === 0) {
    log.push('one_tap_upgrade_no_candidate');
    return { steps, applied: false, stopReason: 'no_candidate', totalCost, log };
  }

  let stopReason: OneTapUpgradeStopReason = 'no_resource';

  for (let step = 0; step < maxSteps; step++) {
    const candidates: Candidate[] = [];
    pickNextHero(playerState, params.onFieldHeroIds, 0, costFn, candidates);
    if (includeBench) {
      pickNextHero(playerState, benchHeroIds, 1, costFn, candidates);
    }

    if (candidates.length === 0) {
      stopReason = 'no_resource';
      break;
    }

    candidates.sort((a, b) => (a.group - b.group) || (a.level - b.level) || a.heroId.localeCompare(b.heroId));
    const chosen = candidates[0];

    const result = upgradeHero(playerState, chosen.heroId, costFn);
    if (!result.ok || result.toLevel === undefined || result.cost === undefined) {
      // 理论上不会发生（已校验可支付），保守兜底，不扣负数。
      stopReason = 'no_resource';
      break;
    }

    steps.push({ heroId: chosen.heroId, fromLevel: result.fromLevel ?? chosen.level, toLevel: result.toLevel, cost: result.cost });
    totalCost.starCoin += result.cost.starCoin;
    totalCost.expChip += result.cost.expChip;

    if (step === maxSteps - 1) {
      stopReason = 'max_steps_reached';
    }
  }

  const applied = steps.length > 0;
  if (applied) {
    log.push('one_tap_upgrade_applied');
  } else {
    log.push('one_tap_upgrade_no_resource');
  }

  return { steps, applied, stopReason, totalCost, log };
}
