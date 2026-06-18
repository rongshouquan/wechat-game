import { describe, it, expect } from 'vitest';
import { BattleDebugReport } from '../assets/scripts/debug/BattleDebugReport';
import {
  DefeatAnalysisContext,
  DefeatReasonType,
  SquadMemberSummary,
  analyzeDefeatAndBuildRecovery,
  analyzeDefeatReason,
  getRetryPathsForReason,
} from '../assets/scripts/core/DefeatAnalysisService';

const FULL_LEVEL_SQUAD: SquadMemberSummary[] = [
  { unitId: 'u1', heroId: 'hero_guard', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 10 },
  { unitId: 'u2', heroId: 'hero_guard2', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 10 },
  { unitId: 'u3', heroId: 'hero_fire', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
  { unitId: 'u4', heroId: 'hero_fire2', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
  { unitId: 'u5', heroId: 'hero_medic', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 10 },
];

function baseReport(overrides: Partial<BattleDebugReport> = {}): BattleDebugReport {
  return {
    winner: 'enemy',
    durationSec: 30,
    failReason: 'all_players_down',
    totalDamage: 1000,
    totalHealing: 200,
    damageTakenByUnit: [],
    skillCastCounts: [],
    ...overrides,
  };
}

function baseContext(overrides: Partial<DefeatAnalysisContext> = {}): DefeatAnalysisContext {
  return {
    report: baseReport(),
    levelId: '1-1',
    squad: FULL_LEVEL_SQUAD,
    recommendedPower: 500,
    ...overrides,
  };
}

const ALL_REASON_TYPES: DefeatReasonType[] = [
  'insufficient_output',
  'insufficient_durability',
  'insufficient_healing',
  'insufficient_level',
  'formation_issue',
];

describe('DefeatAnalysisService - 5 种失败原因判定', () => {
  it('战斗超时（timeout）判定为输出不足', () => {
    const result = analyzeDefeatReason(
      baseContext({ report: baseReport({ failReason: 'timeout', winner: 'draw' }) }),
    );
    expect(result.type).toBe('insufficient_output');
  });

  it('团灭且阵容含治疗、有实际治疗量时判定为承伤不足', () => {
    const result = analyzeDefeatReason(
      baseContext({ report: baseReport({ failReason: 'all_players_down', totalHealing: 300 }) }),
    );
    expect(result.type).toBe('insufficient_durability');
  });

  it('团灭且阵容缺少治疗位时判定为治疗不足', () => {
    const squadWithoutMedic: SquadMemberSummary[] = [
      ...FULL_LEVEL_SQUAD.slice(0, 4),
      { unitId: 'u5', heroId: 'hero_fire3', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
    ];
    const result = analyzeDefeatReason(
      baseContext({ squad: squadWithoutMedic, report: baseReport({ totalHealing: 0 }) }),
    );
    expect(result.type).toBe('insufficient_healing');
  });

  it('团灭且阵容含治疗位但实际治疗量为 0 时判定为治疗不足', () => {
    const result = analyzeDefeatReason(
      baseContext({ report: baseReport({ failReason: 'all_players_down', totalHealing: 0 }) }),
    );
    expect(result.type).toBe('insufficient_healing');
  });

  it('阵容平均等级远低于关卡推荐战力时判定为等级不足', () => {
    const lowLevelSquad = FULL_LEVEL_SQUAD.map((m) => ({ ...m, level: 1 }));
    const result = analyzeDefeatReason(
      baseContext({ squad: lowLevelSquad, recommendedPower: 1000 }),
    );
    expect(result.type).toBe('insufficient_level');
  });

  it('S5C-05：出战人数为 0 时判定为阵容缺位/站位不当', () => {
    const result = analyzeDefeatReason(baseContext({ squad: [] }));
    expect(result.type).toBe('formation_issue');
  });

  it('S5C-05：默认双人 starter squad（站位合法、未满 5 人）不判 formation_issue', () => {
    // 一前排 + 一后排、站位与 positionType 一致；等级足够、非超时 -> 应归过程性原因，而非阵容缺位。
    const starterSquad: SquadMemberSummary[] = [
      { unitId: 'u1', heroId: 'hero_isen', role: 'firepower', positionType: 'front', assignedPosition: 'front', level: 10 },
      { unitId: 'u2', heroId: 'hero_mia', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 10 },
    ];
    const result = analyzeDefeatReason(baseContext({ squad: starterSquad, recommendedPower: 250 }));
    expect(result.type).not.toBe('formation_issue');
  });

  it('前后排人数配比不对时判定为阵容缺位/站位不当', () => {
    const wrongRatioSquad = FULL_LEVEL_SQUAD.map((m, i) => ({ ...m, assignedPosition: i < 3 ? 'front' as const : 'back' as const }));
    const result = analyzeDefeatReason(baseContext({ squad: wrongRatioSquad }));
    expect(result.type).toBe('formation_issue');
  });

  it('实际站位与角色定位 positionType 不一致时判定为阵容缺位/站位不当', () => {
    const mismatchSquad: SquadMemberSummary[] = FULL_LEVEL_SQUAD.map((m) =>
      m.unitId === 'u3' ? { ...m, assignedPosition: 'front' as const } : m,
    );
    // 调整后前排会变 3 人，已能命中阵容问题；为验证"站位不一致"分支，单独构造一个前后排数量仍然合规但站位错配的阵容
    const positionMismatchOnly: SquadMemberSummary[] = [
      { unitId: 'u1', heroId: 'hero_guard', role: 'guard', positionType: 'front', assignedPosition: 'back', level: 10 },
      { unitId: 'u2', heroId: 'hero_fire', role: 'firepower', positionType: 'back', assignedPosition: 'front', level: 10 },
      { unitId: 'u3', heroId: 'hero_guard2', role: 'guard', positionType: 'front', assignedPosition: 'front', level: 10 },
      { unitId: 'u4', heroId: 'hero_fire2', role: 'firepower', positionType: 'back', assignedPosition: 'back', level: 10 },
      { unitId: 'u5', heroId: 'hero_medic', role: 'medic', positionType: 'back', assignedPosition: 'back', level: 10 },
    ];
    expect(analyzeDefeatReason(baseContext({ squad: mismatchSquad })).type).toBe('formation_issue');
    expect(analyzeDefeatReason(baseContext({ squad: positionMismatchOnly })).type).toBe('formation_issue');
  });
});

describe('DefeatAnalysisService - 每种失败原因至少 2 条非广告路径', () => {
  it.each(ALL_REASON_TYPES)('失败原因 %s 至少给出 2 条挽留路径', (reasonType) => {
    const paths = getRetryPathsForReason(reasonType, '1-1');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('所有路径均为非广告路径（type/textKey/navigationIntent 中不出现广告相关标识）', () => {
    for (const reasonType of ALL_REASON_TYPES) {
      const paths = getRetryPathsForReason(reasonType, '1-1');
      for (const path of paths) {
        const serialized = JSON.stringify(path).toLowerCase();
        expect(serialized).not.toContain('rewarded_ad');
        expect(serialized).not.toContain('reward_video');
        expect(serialized).not.toContain('watch_ad');
        expect(serialized).not.toContain('广告');
      }
    }
  });

  it('"重刷上一关"类路径在提供 levelId 时应携带有效 levelId，不出现 undefined', () => {
    const paths = getRetryPathsForReason('insufficient_level', '1-1');
    const replayPath = paths.find((p) => p.type === 'replay_previous_level');
    expect(replayPath).toBeDefined();
    expect(replayPath?.navigationIntent.params?.levelId).toBe('1-1');
    expect(JSON.stringify(replayPath)).not.toContain('undefined');
  });

  it('未提供 levelId 时，"重刷上一关"路径不应在 params 中放入 levelId: undefined', () => {
    const paths = getRetryPathsForReason('insufficient_level');
    const replayPath = paths.find((p) => p.type === 'replay_previous_level');
    expect(replayPath).toBeDefined();
    const params = replayPath?.navigationIntent.params;
    if (params) {
      expect('levelId' in params).toBe(false);
    }
    expect(JSON.stringify(replayPath)).not.toContain('undefined');
  });
});

describe('DefeatAnalysisService - 输出结构可被 UI 直接消费', () => {
  it('analyzeDefeatAndBuildRecovery 返回结构包含 reason 与 retryPaths，且字段完整', () => {
    const result = analyzeDefeatAndBuildRecovery(baseContext(), '1-1');

    expect(typeof result.reason.type).toBe('string');
    expect(typeof result.reason.textKey).toBe('string');
    expect(typeof result.reason.reason).toBe('string');

    expect(result.retryPaths.length).toBeGreaterThanOrEqual(2);
    for (const path of result.retryPaths) {
      expect(typeof path.type).toBe('string');
      expect(typeof path.textKey).toBe('string');
      expect(typeof path.navigationIntent.scene).toBe('string');
      expect(typeof path.reason).toBe('string');
      expect(typeof path.priority).toBe('number');
    }
  });

  it('retryPaths 按优先级升序排列', () => {
    const paths = getRetryPathsForReason('insufficient_output');
    const priorities = paths.map((p) => p.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});
