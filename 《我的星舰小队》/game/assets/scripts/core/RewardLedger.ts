/**
 * 奖励流水与领取状态机（按《存档与防重规格》要求先行实现，奖励发放必须经过此状态机）。
 * 状态流转：created -> pending -> granted -> confirmed
 * 异常分支：failed（发放失败可重试）/ cancelled（任务取消不发奖）/ duplicate（重复领取拒绝）
 */
export type RewardFlowStatus = 'created' | 'pending' | 'granted' | 'confirmed' | 'failed' | 'cancelled' | 'duplicate';

export interface RewardFlowEntry {
  readonly flowId: string;
  readonly sourceId: string;
  readonly rewardId: string;
  status: RewardFlowStatus;
  readonly sequence: number;
}

export interface RewardLedger {
  entries: RewardFlowEntry[];
}

export function createRewardLedger(): RewardLedger {
  return { entries: [] };
}

function buildFlowId(sourceId: string, rewardId: string, sequence: number): string {
  return `flow_${sourceId}_${rewardId}_${sequence}`;
}

/** 是否已存在该来源+奖励的有效发放记录（granted/confirmed），用于防重复领取判定。 */
function hasGrantedEntry(ledger: RewardLedger, sourceId: string, rewardId: string): boolean {
  return ledger.entries.some(
    (e) => e.sourceId === sourceId && e.rewardId === rewardId && (e.status === 'granted' || e.status === 'confirmed'),
  );
}

export interface RewardGrantOutcome {
  entry: RewardFlowEntry;
  granted: boolean;
  duplicate: boolean;
  log: string[];
}

/**
 * 申请发放一笔奖励：
 * - 若该来源（如 levelId）+ 奖励已有 granted/confirmed 记录，则记为 duplicate 并拒绝发放；
 * - 否则按 created -> pending -> granted 推进状态机，返回最终发放结果。
 * 调用方负责在 granted 之后将奖励内容应用到玩家状态，并将状态置为 confirmed。
 */
export function requestRewardGrant(ledger: RewardLedger, sourceId: string, rewardId: string): RewardGrantOutcome {
  const log: string[] = [];

  if (hasGrantedEntry(ledger, sourceId, rewardId)) {
    const sequence = ledger.entries.length + 1;
    const entry: RewardFlowEntry = { flowId: buildFlowId(sourceId, rewardId, sequence), sourceId, rewardId, status: 'duplicate', sequence };
    ledger.entries.push(entry);
    log.push('duplicate reward rejected');
    return { entry, granted: false, duplicate: true, log };
  }

  const sequence = ledger.entries.length + 1;
  const entry: RewardFlowEntry = { flowId: buildFlowId(sourceId, rewardId, sequence), sourceId, rewardId, status: 'created', sequence };
  ledger.entries.push(entry);
  log.push('reward created');

  entry.status = 'pending';
  entry.status = 'granted';
  log.push('reward granted');

  return { entry, granted: true, duplicate: false, log };
}

/** 确认奖励已应用到玩家状态：granted -> confirmed。 */
export function confirmRewardGrant(entry: RewardFlowEntry): void {
  if (entry.status === 'granted') {
    entry.status = 'confirmed';
  }
}
