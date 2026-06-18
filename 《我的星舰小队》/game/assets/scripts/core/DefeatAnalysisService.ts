/**
 * 失败原因判断与失败后非广告路径（C10）。
 *
 * 纯 TypeScript 模块，不依赖 cc：基于 BattleDebugReport + 出战阵容摘要，
 * 自动判定失败主因（5 种之一），并给出每种原因对应的非广告挽留路径列表。
 * 不做 UI、不接广告、不计算离线收益（离线收益属 C11）。
 *
 * 判定规则为"可解释的确定性启发式占位规则"：当前阈值/权重为工程占位值，
 * 待设计补充正式的失败诊断规则后再调参替换（不改变本模块对外结构）。
 */
import { BattleDebugReport } from '../debug/BattleDebugReport';

export type DefeatReasonType =
  | 'insufficient_output'
  | 'insufficient_durability'
  | 'insufficient_healing'
  | 'insufficient_level'
  | 'formation_issue';

export interface SquadMemberSummary {
  unitId: string;
  heroId: string;
  role: 'guard' | 'firepower' | 'medic' | 'disruptor';
  /** 该角色配置上要求的站位类型（来自 hero_config.positionType）。 */
  positionType: 'front' | 'back';
  /** 实际出战时被分配到的站位。 */
  assignedPosition: 'front' | 'back';
  level: number;
}

export interface DefeatAnalysisContext {
  report: BattleDebugReport;
  levelId: string;
  /** 出战阵容摘要（按 Formation 规则应为 2 前排 + 3 后排，共 5 人）。 */
  squad: SquadMemberSummary[];
  /** 关卡配置中的 recommendedPower（来自 level_config），用于和阵容等级做粗略比对。 */
  recommendedPower: number;
}

export interface DefeatReason {
  type: DefeatReasonType;
  textKey: string;
  reason: string;
}

export type RetryPathType =
  | 'one_tap_upgrade'
  | 'adjust_formation'
  | 'replay_previous_level'
  | 'switch_hero';

export interface NavigationIntent {
  scene: string;
  params?: Record<string, unknown>;
}

export interface RetryPath {
  type: RetryPathType;
  textKey: string;
  navigationIntent: NavigationIntent;
  reason: string;
  /** 优先级数值，越小优先级越高；同一失败原因下的多条路径按此排序展示。 */
  priority: number;
}

const REASON_TEXT_KEY: Record<DefeatReasonType, string> = {
  insufficient_output: 'defeat.reason.insufficient_output',
  insufficient_durability: 'defeat.reason.insufficient_durability',
  insufficient_healing: 'defeat.reason.insufficient_healing',
  insufficient_level: 'defeat.reason.insufficient_level',
  formation_issue: 'defeat.reason.formation_issue',
};

const REASON_DESCRIPTION: Record<DefeatReasonType, string> = {
  insufficient_output: '输出不足：限定时间内未能击杀敌方（战斗超时）',
  insufficient_durability: '承伤不足：前排/坦克扛伤能力不够，队伍过早被击溃',
  insufficient_healing: '治疗不足：缺少有效治疗或治疗量不够，被持续消耗致死',
  insufficient_level: '等级不足：出战阵容平均等级明显落后于关卡推荐战力',
  formation_issue: '阵容缺位/站位不当：前后排人数不齐或站位与角色定位不符',
};

/** S5C-05 数值初稿：等级折算战力换算系数（草案 §3.4，estimatedPower = avgLevel * 90）。 */
const LEVEL_TO_POWER_FACTOR = 90;
/** 阈值：阵容折算战力低于关卡推荐战力的该比例时，判定为等级不足。 */
const LEVEL_GAP_RATIO_THRESHOLD = 0.8;

const FRONT_SLOTS = 2;
const BACK_SLOTS = 3;
const FULL_SQUAD_SIZE = FRONT_SLOTS + BACK_SLOTS;

/**
 * 阵容是否存在缺位或站位不当（S5C-05 数值初稿，草案 §3.4）：
 * 默认双人 starter squad 在 S5C 灰度范围内视为合法阵容，不再仅因人数 < 5 判 formation_issue。
 * 只在以下情况判定 formation_issue：
 *  1. 出战人数为 0；
 *  2. 有角色被分配到与 positionType 不一致的位置；
 *  3. 当出战人数已达满编 5 人时，前排/后排数量不符合 2/3。
 * （人数在 1~4 之间时，只要无站位错配即视为合法 starter squad。）
 */
function hasFormationIssue(squad: SquadMemberSummary[]): boolean {
  if (squad.length === 0) {
    return true;
  }
  if (squad.some((m) => m.assignedPosition !== m.positionType)) {
    return true;
  }
  if (squad.length === FULL_SQUAD_SIZE) {
    const frontCount = squad.filter((m) => m.assignedPosition === 'front').length;
    const backCount = squad.filter((m) => m.assignedPosition === 'back').length;
    if (frontCount !== FRONT_SLOTS || backCount !== BACK_SLOTS) {
      return true;
    }
  }
  return false;
}

function averageSquadLevel(squad: SquadMemberSummary[]): number {
  if (squad.length === 0) {
    return 0;
  }
  const sum = squad.reduce((acc, m) => acc + m.level, 0);
  return sum / squad.length;
}

function hasInsufficientLevel(squad: SquadMemberSummary[], recommendedPower: number): boolean {
  if (recommendedPower <= 0) {
    return false;
  }
  const estimatedPower = averageSquadLevel(squad) * LEVEL_TO_POWER_FACTOR;
  return estimatedPower < recommendedPower * LEVEL_GAP_RATIO_THRESHOLD;
}

/**
 * 判定失败主因。按以下优先顺序匹配，命中即返回（前面的判定属于"结构性/门槛性"问题，
 * 优先于"过程性"问题，因为结构不对时过程数据已无参考意义）：
 * 1. 阵容缺位/站位不当（结构问题，最先排查）
 * 2. 等级不足（门槛问题，阵容等级与关卡门槛差距过大）
 * 3. 输出不足（战斗因超时判负）
 * 4. 治疗不足（团灭，且阵容中无治疗位或战斗中实际治疗量为 0）
 * 5. 承伤不足（团灭，且非治疗不足，归因为前排扛伤不够，兜底分类）
 */
export function analyzeDefeatReason(context: DefeatAnalysisContext): DefeatReason {
  if (hasFormationIssue(context.squad)) {
    return { type: 'formation_issue', textKey: REASON_TEXT_KEY.formation_issue, reason: REASON_DESCRIPTION.formation_issue };
  }

  if (hasInsufficientLevel(context.squad, context.recommendedPower)) {
    return { type: 'insufficient_level', textKey: REASON_TEXT_KEY.insufficient_level, reason: REASON_DESCRIPTION.insufficient_level };
  }

  if (context.report.failReason === 'timeout') {
    return { type: 'insufficient_output', textKey: REASON_TEXT_KEY.insufficient_output, reason: REASON_DESCRIPTION.insufficient_output };
  }

  // 团灭（all_players_down）或其他非超时败因：在续航类问题中细分治疗 vs 承伤
  const hasMedic = context.squad.some((m) => m.role === 'medic');
  if (!hasMedic || context.report.totalHealing <= 0) {
    return { type: 'insufficient_healing', textKey: REASON_TEXT_KEY.insufficient_healing, reason: REASON_DESCRIPTION.insufficient_healing };
  }

  return { type: 'insufficient_durability', textKey: REASON_TEXT_KEY.insufficient_durability, reason: REASON_DESCRIPTION.insufficient_durability };
}

/**
 * 每种失败原因对应的非广告挽留路径（每种至少 2 条，纯数据层，UI 接入留待 C14）。
 * 路径中不得包含"看广告"作为达成条件——广告路径属阶段4。
 */
const RETRY_PATHS_BY_REASON: Record<DefeatReasonType, RetryPath[]> = {
  insufficient_output: [
    {
      type: 'one_tap_upgrade',
      textKey: 'retry.upgrade_for_output',
      navigationIntent: { scene: 'hero_upgrade', params: { focus: 'firepower' } },
      reason: '一键升级提升输出位等级，加快击杀速度',
      priority: 1,
    },
    {
      type: 'switch_hero',
      textKey: 'retry.switch_for_output',
      navigationIntent: { scene: 'formation_edit', params: { focus: 'firepower' } },
      reason: '替换更高输出的角色再战',
      priority: 2,
    },
  ],
  insufficient_durability: [
    {
      type: 'one_tap_upgrade',
      textKey: 'retry.upgrade_for_durability',
      navigationIntent: { scene: 'hero_upgrade', params: { focus: 'guard' } },
      reason: '一键升级提升前排/坦克等级，提高扛伤能力',
      priority: 1,
    },
    {
      type: 'adjust_formation',
      textKey: 'retry.adjust_for_durability',
      navigationIntent: { scene: 'formation_edit', params: { focus: 'front_row' } },
      reason: '调整阵容补齐前排或替换更高防御的角色',
      priority: 2,
    },
  ],
  insufficient_healing: [
    {
      type: 'one_tap_upgrade',
      textKey: 'retry.upgrade_for_healing',
      navigationIntent: { scene: 'hero_upgrade', params: { focus: 'medic' } },
      reason: '一键升级提升治疗位等级，提高续航能力',
      priority: 1,
    },
    {
      type: 'adjust_formation',
      textKey: 'retry.adjust_for_healing',
      navigationIntent: { scene: 'formation_edit', params: { focus: 'medic' } },
      reason: '调整阵容上阵或替换治疗角色',
      priority: 2,
    },
  ],
  insufficient_level: [
    {
      type: 'one_tap_upgrade',
      textKey: 'retry.upgrade_for_level',
      navigationIntent: { scene: 'hero_upgrade' },
      reason: '一键升级可升级的角色，缩小与关卡门槛的差距',
      priority: 1,
    },
    {
      type: 'replay_previous_level',
      textKey: 'retry.replay_for_level',
      navigationIntent: { scene: 'level_battle', params: { levelId: undefined, mode: 'replay_previous' } },
      reason: '重刷上一关攒资源再升级',
      priority: 2,
    },
  ],
  formation_issue: [
    {
      type: 'adjust_formation',
      textKey: 'retry.adjust_for_formation_gap',
      navigationIntent: { scene: 'formation_edit', params: { focus: 'fill_slots' } },
      reason: '调整阵容补齐前后排空缺',
      priority: 1,
    },
    {
      type: 'adjust_formation',
      textKey: 'retry.adjust_for_position_mismatch',
      navigationIntent: { scene: 'formation_edit', params: { focus: 'fix_position' } },
      reason: '按角色站位定位（positionType）重新排布前后排站位',
      priority: 2,
    },
  ],
};

/**
 * 取得指定失败原因对应的非广告挽留路径列表（按优先级升序排列，至少 2 条）。
 * `levelId` 用于把"重刷上一关"等需要具体关卡 id 的路径补全跳转参数，避免 UI 拿到 undefined。
 */
export function getRetryPathsForReason(reasonType: DefeatReasonType, levelId?: string): RetryPath[] {
  const paths = RETRY_PATHS_BY_REASON[reasonType];
  return paths.map((path) => {
    if (path.type !== 'replay_previous_level') {
      return path;
    }
    const params = { ...path.navigationIntent.params };
    if (levelId) {
      params.levelId = levelId;
    } else {
      delete params.levelId;
    }
    return { ...path, navigationIntent: { ...path.navigationIntent, params } };
  });
}

export interface DefeatRecoveryResult {
  reason: DefeatReason;
  retryPaths: RetryPath[];
}

/** 一站式入口：判定失败原因并附带对应的非广告挽留路径（>=2 条）。 */
export function analyzeDefeatAndBuildRecovery(context: DefeatAnalysisContext, previousLevelId?: string): DefeatRecoveryResult {
  const reason = analyzeDefeatReason(context);
  const retryPaths = getRetryPathsForReason(reason.type, previousLevelId);
  return { reason, retryPaths };
}
