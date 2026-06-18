/**
 * 埋点上报事件 schema 与校验（C30）。
 *
 * 纯 TypeScript 模块，不依赖 cc / wx：定义《数据接入技术方案》第 3 节通用字段与第 4 节 P0 事件，
 * 并提供事件校验（必填字段完整性 + P0 关键参数 + 敏感硬件 ID 防采集）。
 *
 * 明确不做（属后续或越界）：
 *  - 不接真实微信云开发 / 真实 BI / 真实云函数；上报通道由 adapter 抽象，真机实现另起。
 *  - 不采集任何敏感硬件 ID（imei / idfa / oaid / mac / androidId 等）——见 SENSITIVE_ID_KEYS，校验直接拒绝。
 *  - userId 由调用方注入（微信 openid 或开发期 dev_user_*），本模块不读真实账号、不生成硬件标识。
 */

/** P0 事件名（《数据接入技术方案》§4）。 */
export const P0_EVENT_NAMES = [
  'tutorial_start',
  'tutorial_step_complete',
  'first_battle_win',
  'first_upgrade_click',
  'first_equipment_wear',
  'first_boss_challenge',
  'first_boss_win',
  'first_boss_fail',
  'stage_start',
  'stage_win',
  'boss_fail',
  'fail_action_click',
  'offline_reward_claim_1x',
  'ad_click',
  'ad_complete',
  'ad_fail',
  'goal_show',
  'goal_complete',
] as const;

export type P0EventName = (typeof P0_EVENT_NAMES)[number];

/**
 * 上报事件通用字段（《数据接入技术方案》§3）。
 * levelId 为可选顶层字段；部分 P0 事件要求其必填（见 P0_EVENT_SPECS.requiresLevelId）。
 * 不含 deviceId 等硬件字段：身份仅用 userId（openid / 开发期占位）+ sessionId。
 */
export interface AnalyticsUploadEvent {
  eventName: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  appVersion: string;
  configVersion: string;
  levelId?: string;
  params: Record<string, unknown>;
}

/** 单个 P0 事件的必填约束：是否需要顶层 levelId，以及 params 中的必填关键参数。 */
interface P0EventSpec {
  requiresLevelId: boolean;
  params: readonly string[];
}

/** 各 P0 事件关键参数表（《数据接入技术方案》§4，levelId 归入顶层字段单独约束）。 */
export const P0_EVENT_SPECS: Record<P0EventName, P0EventSpec> = {
  tutorial_start: { requiresLevelId: true, params: [] },
  tutorial_step_complete: { requiresLevelId: false, params: ['stepId', 'duration'] },
  first_battle_win: { requiresLevelId: true, params: ['battleTime'] },
  first_upgrade_click: { requiresLevelId: false, params: ['heroId', 'levelBefore', 'levelAfter'] },
  first_equipment_wear: { requiresLevelId: false, params: ['heroId', 'equipmentId'] },
  first_boss_challenge: { requiresLevelId: true, params: ['teamPower'] },
  first_boss_win: { requiresLevelId: true, params: ['battleTime'] },
  first_boss_fail: { requiresLevelId: true, params: ['failReason'] },
  stage_start: { requiresLevelId: true, params: ['teamPower'] },
  stage_win: { requiresLevelId: true, params: ['battleTime', 'rewardId'] },
  boss_fail: { requiresLevelId: true, params: ['failReason', 'tacticalData'] },
  fail_action_click: { requiresLevelId: false, params: ['actionType', 'isAd'] },
  offline_reward_claim_1x: { requiresLevelId: false, params: ['minutes', 'rewardId'] },
  ad_click: { requiresLevelId: false, params: ['adType', 'entry'] },
  ad_complete: { requiresLevelId: false, params: ['adType', 'rewardId'] },
  ad_fail: { requiresLevelId: false, params: ['adType', 'failReason'] },
  goal_show: { requiresLevelId: false, params: ['goalType', 'priority'] },
  goal_complete: { requiresLevelId: false, params: ['goalType', 'duration'] },
};

/**
 * 禁止出现的敏感硬件 ID 字段名（顶层或 params 内任一命中即拒绝），保障「不采集敏感硬件 ID」。
 * deviceId 亦在内：§2 要求用运行环境摘要而非硬件 ID，本上报层一律不接受 deviceId 字段，避免误采。
 */
export const SENSITIVE_ID_KEYS: readonly string[] = [
  'imei',
  'imsi',
  'idfa',
  'idfv',
  'oaid',
  'aaid',
  'mac',
  'macaddress',
  'wifimac',
  'androidid',
  'serialnumber',
  'serialno',
  'deviceid',
  'devicetoken',
  'phonenumber',
];

const REQUIRED_STRING_FIELDS: (keyof AnalyticsUploadEvent)[] = [
  'eventName',
  'userId',
  'sessionId',
  'appVersion',
  'configVersion',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_ID_KEYS.includes(key.toLowerCase());
}

/**
 * 校验单条上报事件：
 *  - 通用必填字段完整且类型正确（eventName/userId/sessionId/appVersion/configVersion 为非空字符串，timestamp 为数字，params 为对象）。
 *  - eventName 必须是已登记的 P0 事件。
 *  - 满足该事件的 requiresLevelId 与 params 关键参数。
 *  - 不得出现任何敏感硬件 ID 字段（顶层或 params 内）。
 * 校验不通过的事件应被上报层拒绝（不入队、不上报）。
 */
export function validateUploadEvent(event: AnalyticsUploadEvent): ValidationResult {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['event_not_object'] };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = event[field];
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`missing_or_invalid_field:${field}`);
    }
  }
  if (typeof event.timestamp !== 'number' || !Number.isFinite(event.timestamp)) {
    errors.push('missing_or_invalid_field:timestamp');
  }
  if (!event.params || typeof event.params !== 'object' || Array.isArray(event.params)) {
    errors.push('missing_or_invalid_field:params');
  }
  if (event.levelId !== undefined && typeof event.levelId !== 'string') {
    errors.push('invalid_field:levelId');
  }

  // 敏感硬件 ID 防采集：顶层与 params 任一命中即拒绝。
  for (const key of Object.keys(event)) {
    if (isSensitiveKey(key)) {
      errors.push(`sensitive_id_field:${key}`);
    }
  }
  if (event.params && typeof event.params === 'object' && !Array.isArray(event.params)) {
    for (const key of Object.keys(event.params)) {
      if (isSensitiveKey(key)) {
        errors.push(`sensitive_id_param:${key}`);
      }
    }
  }

  const spec = (P0_EVENT_SPECS as Record<string, P0EventSpec>)[event.eventName];
  if (!spec) {
    errors.push(`unknown_event:${event.eventName}`);
    return { valid: errors.length === 0, errors };
  }

  if (spec.requiresLevelId && (typeof event.levelId !== 'string' || event.levelId.length === 0)) {
    errors.push('missing_required_field:levelId');
  }
  const params = event.params && typeof event.params === 'object' ? event.params : {};
  for (const key of spec.params) {
    if ((params as Record<string, unknown>)[key] === undefined) {
      errors.push(`missing_required_param:${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
