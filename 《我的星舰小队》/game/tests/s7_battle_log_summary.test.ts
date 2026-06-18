// BATTLE-RT-06: S7 专用纯 TS 战斗日志摘要 summarizeS7BattleLog 测试。
// 覆盖任务包 §9 的 26 点：真实 n001/n018/n075 摘要、血量/可推导护盾伤害口径、
// 治疗与上盾不计、护盾自然过期不被后续攻击捡走、单位累计、0 输出单位入列、top/排序、
// 8 类胜负提示码、异常但合法日志不崩、不改入参、确定性、静态隔离与未来在线化不堵死。
// 真实结果用 S7AutoBattleEngine 跑出；边界用例用合成 S7AutoBattleResult，不改磁盘配置表。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  createInMemoryS7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigTableName, S7_TABLE_FILES } from '../assets/scripts/config/s7/ConfigTypesS7';
import { S7AutoBattleEngine } from '../assets/scripts/core/s7/S7AutoBattleEngine';
import {
  S7AutoBattleResult,
  S7AutoBattleLogEntry,
  S7AutoBattleSide,
  S7AutoBattleUnitFinalState,
  S7AutoBattleReason,
  S7AutoBattleWinner,
} from '../assets/scripts/core/s7/S7AutoBattleTypes';
import { summarizeS7BattleLog } from '../assets/scripts/core/s7/S7BattleLogSummary';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
const SUMMARY_SRC = path.resolve(__dirname, '..', 'assets', 'scripts', 'core', 's7', 'S7BattleLogSummary.ts');

type Bundle = Record<S7ConfigTableName, unknown[]>;
function loadBundle(): Bundle {
  const b = {} as Bundle;
  for (const t of Object.keys(S7_TABLE_FILES) as S7ConfigTableName[]) {
    b[t] = JSON.parse(readFileSync(path.join(S7_DIR, `${t}.sample.json`), 'utf-8')) as unknown[];
  }
  return b;
}
const runtimeOf = (b: Bundle): Promise<S7ConfigRuntime> => S7ConfigRuntime.load(createInMemoryS7TableReader(b));

const TRIO = [
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c2' },
];
const FIVE = [
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p0c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p1c2' },
  { unitStatRef: 'bu_ship_gunner', slotRef: 'p2c2' },
  { unitStatRef: 'bu_ship_vanguard', slotRef: 'p0c1' },
  { unitStatRef: 'bu_ship_guardian', slotRef: 'p2c1' },
];

// ---- 合成结果构造器（边界用例） ----
function fu(unitId: string, side: S7AutoBattleSide, over: Partial<S7AutoBattleUnitFinalState> = {}): S7AutoBattleUnitFinalState {
  return { unitId, side, unitStatRef: 'x', slotRef: 'p0c0', hp: 100, maxHp: 100, shield: 0, energy: 0, alive: true, ...over };
}
function res(
  winner: S7AutoBattleWinner,
  reason: S7AutoBattleReason,
  opts: { durationSec?: number; log?: S7AutoBattleLogEntry[]; players?: S7AutoBattleUnitFinalState[]; enemies?: S7AutoBattleUnitFinalState[] } = {},
): S7AutoBattleResult {
  const players = opts.players ?? [];
  const enemies = opts.enemies ?? [];
  const durationSec = opts.durationSec ?? 10;
  return { winner, reason, durationSec, log: opts.log ?? [], finalState: { durationSec, players, enemies } };
}
function dmg(actorId: string | undefined, side: S7AutoBattleSide, target: string | undefined, amount: number, shieldAfter?: number): S7AutoBattleLogEntry {
  const e: S7AutoBattleLogEntry = { timeSec: 1, type: 'damage', side, amount };
  if (actorId !== undefined) e.actorId = actorId;
  if (target !== undefined) e.targetIds = [target];
  if (shieldAfter !== undefined) e.shieldAfter = shieldAfter;
  return e;
}
const shieldApply = (target: string, shieldAfter: number): S7AutoBattleLogEntry => ({ timeSec: 1, type: 'state_apply', stateTag: 'shield', targetIds: [target], amount: shieldAfter, hpAfter: 100, shieldAfter });
const shieldExpire = (unit: string): S7AutoBattleLogEntry => ({ timeSec: 1, type: 'state_expire', stateTag: 'shield', actorId: unit, side: 'enemy' });
function find<T extends { unitId: string }>(list: T[], id: string): T | undefined {
  return list.find((u) => u.unitId === id);
}

describe('S7BattleLogSummary - 真实战斗结果 (#1-#5)', () => {
  it('n001 真实结果生成摘要，玩家胜→player_win_all_enemies_down，双方统计来自 finalState (#1,#2,#3)', async () => {
    const rt = await runtimeOf(loadBundle());
    const result = new S7AutoBattleEngine(rt).run({ encounterRef: 'enc_n001', battleSeed: 's', playerUnits: TRIO });
    const s = summarizeS7BattleLog(result);
    expect(s.winner).toBe('player');
    expect(s.hintCode).toBe('player_win_all_enemies_down');
    expect(s.playerDamage.length).toBe(result.finalState.players.length);
    expect(s.enemyDamage.length).toBe(result.finalState.enemies.length);
    expect(s.playerDamage.map((u) => u.unitId).sort()).toEqual(result.finalState.players.map((u) => u.unitId).sort());
  });

  it('n018 真实结果生成摘要，不崩 (#4)', async () => {
    const rt = await runtimeOf(loadBundle());
    const result = new S7AutoBattleEngine(rt).run({ encounterRef: 'enc_n018', battleSeed: 's', playerUnits: FIVE });
    const s = summarizeS7BattleLog(result);
    expect(['player', 'enemy']).toContain(s.winner);
    expect(s.playerDamage.length).toBeGreaterThan(0);
    expect(s.enemyDamage.length).toBeGreaterThan(0);
  });

  it('n075 真实结果生成摘要，不崩、不超时 (#5)', async () => {
    const rt = await runtimeOf(loadBundle());
    const result = new S7AutoBattleEngine(rt).run({ encounterRef: 'enc_n075', battleSeed: 's', playerUnits: FIVE });
    const s = summarizeS7BattleLog(result);
    expect(s.durationSec).toBeGreaterThan(0);
    // 玩家伤害合计应能从真实日志推导出正数（gunner 持续输出）。
    expect(s.playerDamage.reduce((n, u) => n + u.totalDamageDealt, 0)).toBeGreaterThan(0);
  });
});

describe('S7BattleLogSummary - 伤害统计口径 (#6-#13)', () => {
  it('damage.amount 累计到 hpDamageDealt (#6)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player')],
      enemies: [fu('enemy_0', 'enemy', { alive: false })],
      log: [dmg('player_p0c2', 'player', 'enemy_0', 50), dmg('player_p0c2', 'player', 'enemy_0', 30)],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_p0c2')!;
    expect(u.hpDamageDealt).toBe(80);
    expect(u.hitCount).toBe(2);
    expect(u.shieldDamageDealt).toBe(0);
    expect(u.totalDamageDealt).toBe(80);
  });

  it('有护盾时按 shieldAfter 推导 shieldDamageDealt (#7)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player')],
      enemies: [fu('enemy_0', 'enemy', { alive: false, shield: 0 })],
      log: [
        shieldApply('enemy_0', 100),
        dmg('player_p0c2', 'player', 'enemy_0', 0, 60), // 100->60：打掉 40 盾
        dmg('player_p0c2', 'player', 'enemy_0', 0, 20), // 60->20：再打掉 40 盾
        dmg('player_p0c2', 'player', 'enemy_0', 10, 0), // 20->0：再打掉 20 盾并落 10 血
      ],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_p0c2')!;
    expect(u.shieldDamageDealt).toBe(100); // 40+40+20：最后一击同样把残余 20 盾打掉
    expect(u.hpDamageDealt).toBe(10);
    expect(u.totalDamageDealt).toBe(110);
    expect(u.hitCount).toBe(3);
  });

  it('推导不出护盾伤害时记 0 且不报错 (#8)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player')],
      enemies: [fu('enemy_0', 'enemy')],
      // 无 shieldApply 前置、首击带 shieldAfter：无 prev → 护盾伤害 0；后续无 shieldAfter 的命中也不崩。
      log: [dmg('player_p0c2', 'player', 'enemy_0', 5, 0), dmg('player_p0c2', 'player', 'enemy_0', 5)],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_p0c2')!;
    expect(u.shieldDamageDealt).toBe(0);
    expect(u.hpDamageDealt).toBe(10);
  });

  it('护盾自然过期后再被攻击，不把过期护盾算成攻击者输出 (#9)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player')],
      enemies: [fu('enemy_0', 'enemy', { alive: false })],
      log: [
        shieldApply('enemy_0', 100), // 上盾 100
        shieldExpire('enemy_0'), // 自然过期 → 记 0
        dmg('player_p0c2', 'player', 'enemy_0', 50, 0), // 此时盾已为 0，护盾伤害应为 0
      ],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_p0c2')!;
    expect(u.shieldDamageDealt).toBe(0); // 过期护盾不被攻击者捡走
    expect(u.hpDamageDealt).toBe(50);
  });

  it('heal 不计入伤害 (#10)', () => {
    const r = res('enemy', 'timeout', {
      players: [fu('player_medic', 'player')],
      enemies: [fu('enemy_0', 'enemy')],
      log: [{ timeSec: 1, type: 'heal', actorId: 'player_medic', side: 'player', targetIds: ['player_medic'], amount: 200, hpAfter: 100, shieldAfter: 0 }],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_medic')!;
    expect(u.totalDamageDealt).toBe(0);
    expect(u.hitCount).toBe(0);
  });

  it('state_apply(shield) 不计入伤害 (#11)', () => {
    const r = res('enemy', 'timeout', {
      players: [fu('player_guard', 'player')],
      enemies: [fu('enemy_0', 'enemy')],
      log: [shieldApply('player_guard', 300)],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_guard')!;
    expect(u.totalDamageDealt).toBe(0);
  });

  it('同一单位多次攻击累计伤害与 hitCount (#12)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player')],
      enemies: [fu('enemy_0', 'enemy', { alive: false })],
      log: [
        dmg('player_p0c2', 'player', 'enemy_0', 10),
        dmg('player_p0c2', 'player', 'enemy_0', 20),
        dmg('player_p0c2', 'player', 'enemy_0', 30),
      ],
    });
    const u = find(summarizeS7BattleLog(r).playerDamage, 'player_p0c2')!;
    expect(u.hpDamageDealt).toBe(60);
    expect(u.hitCount).toBe(3);
  });

  it('无输出的最终存活单位也入列，伤害为 0 (#13)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_p0c2', 'player'), fu('player_p2c2', 'player', { alive: true })],
      enemies: [fu('enemy_0', 'enemy', { alive: false })],
      log: [dmg('player_p0c2', 'player', 'enemy_0', 100)],
    });
    const idle = find(summarizeS7BattleLog(r).playerDamage, 'player_p2c2')!;
    expect(idle).toBeDefined();
    expect(idle.totalDamageDealt).toBe(0);
    expect(idle.hitCount).toBe(0);
    expect(idle.alive).toBe(true);
  });
});

describe('S7BattleLogSummary - top 与排序 (#14,#15)', () => {
  it('topPlayerDamage / topEnemyDamage 取对应阵营最高输出 (#14)', () => {
    const r = res('enemy', 'timeout', {
      players: [fu('player_a', 'player'), fu('player_b', 'player')],
      enemies: [fu('enemy_x', 'enemy'), fu('enemy_y', 'enemy')],
      log: [
        dmg('player_a', 'player', 'enemy_x', 30),
        dmg('player_b', 'player', 'enemy_x', 90),
        dmg('enemy_y', 'enemy', 'player_a', 70),
        dmg('enemy_x', 'enemy', 'player_a', 10),
      ],
    });
    const s = summarizeS7BattleLog(r);
    expect(s.topPlayerDamage?.unitId).toBe('player_b'); // 90 > 30
    expect(s.topEnemyDamage?.unitId).toBe('enemy_y'); // 70 > 10
  });

  it('伤害相同按 unitId 稳定排序，同输入同输出 (#15)', () => {
    const r = res('player', 'all_enemies_down', {
      players: [fu('player_z', 'player'), fu('player_a', 'player')],
      enemies: [fu('enemy_0', 'enemy', { alive: false })],
      log: [dmg('player_z', 'player', 'enemy_0', 40), dmg('player_a', 'player', 'enemy_0', 40)],
    });
    const s1 = summarizeS7BattleLog(r);
    const s2 = summarizeS7BattleLog(r);
    expect(s1.playerDamage.map((u) => u.unitId)).toEqual(['player_a', 'player_z']); // 同分按 unitId 升序
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('没有单位时 top 为 null', () => {
    const s = summarizeS7BattleLog(res('enemy', 'timeout', { players: [], enemies: [] }));
    expect(s.topPlayerDamage).toBeNull();
    expect(s.topEnemyDamage).toBeNull();
  });
});

describe('S7BattleLogSummary - 胜负提示码 (#2,#16-#21)', () => {
  it('普通 all_players_down → enemy_win_all_players_down (#16)', () => {
    const r = res('enemy', 'all_players_down', {
      players: [fu('player_a', 'player', { alive: false })],
      enemies: [fu('enemy_0', 'enemy', { shield: 0 })],
    });
    expect(summarizeS7BattleLog(r).hintCode).toBe('enemy_win_all_players_down');
  });

  it('召唤数高 → enemy_win_summon_overflow（优先于普通胜因）(#17)', () => {
    const r = res('enemy', 'timeout', {
      enemies: [fu('boss', 'enemy', { shield: 0 })],
      log: [{ timeSec: 5, type: 'spawn_wave', side: 'enemy', note: 'phase_summon', targetIds: ['s1', 's2', 's3', 's4', 's5'] }],
    });
    expect(summarizeS7BattleLog(r).hintCode).toBe('enemy_win_summon_overflow');
  });

  it('Boss final 阶段或敌方 berserk → enemy_win_boss_final_phase (#18)', () => {
    const finalPhase = res('enemy', 'all_players_down', {
      enemies: [fu('boss', 'enemy', { shield: 0 })],
      log: [{ timeSec: 9, type: 'boss_phase', side: 'enemy', actorId: 'boss', phaseTag: 'final' }],
    });
    expect(summarizeS7BattleLog(finalPhase).hintCode).toBe('enemy_win_boss_final_phase');
    const berserk = res('enemy', 'all_players_down', {
      enemies: [fu('boss', 'enemy', { shield: 0 })],
      log: [{ timeSec: 9, type: 'state_apply', side: 'enemy', actorId: 'boss', targetIds: ['boss'], stateTag: 'berserk' }],
    });
    expect(summarizeS7BattleLog(berserk).hintCode).toBe('enemy_win_boss_final_phase');
  });

  it('敌方剩盾 → enemy_win_shield_not_broken (#19)', () => {
    const r = res('enemy', 'timeout', { enemies: [fu('enemy_0', 'enemy', { shield: 50, alive: true })] });
    expect(summarizeS7BattleLog(r).hintCode).toBe('enemy_win_shield_not_broken');
  });

  it('大量敌方生成/存活 → enemy_win_swarm_overflow (#20)', () => {
    const enemies = Array.from({ length: 10 }, (_, i) => fu(`enemy_${i}`, 'enemy', { shield: 0, alive: i < 4 }));
    const r = res('enemy', 'timeout', { enemies });
    expect(summarizeS7BattleLog(r).hintCode).toBe('enemy_win_swarm_overflow');
  });

  it('timeout 普通敌方胜 → enemy_win_timeout (#21)', () => {
    const r = res('enemy', 'timeout', { enemies: [fu('enemy_0', 'enemy', { shield: 0, alive: true })] });
    expect(summarizeS7BattleLog(r).hintCode).toBe('enemy_win_timeout');
  });
});

describe('S7BattleLogSummary - 健壮性与确定性 (#22,#23,#24)', () => {
  it('缺 actorId / 缺 targetIds / 缺 shieldAfter 的合法日志不会崩 (#22)', () => {
    const r = res('enemy', 'timeout', {
      players: [fu('player_a', 'player')],
      enemies: [fu('enemy_0', 'enemy')],
      log: [
        { timeSec: 1, type: 'damage', side: 'enemy', amount: 10 }, // 缺 actorId + targetIds
        { timeSec: 1, type: 'damage', actorId: 'player_a', side: 'player', amount: 20 }, // 缺 targetIds + shieldAfter
        { timeSec: 1, type: 'damage', actorId: 'player_a', side: 'player', targetIds: ['e1', 'e2'], amount: 5 }, // 多目标
        { timeSec: 1, type: 'state_expire', stateTag: 'shield' }, // 缺 actorId
        { timeSec: 1, type: 'state_apply', stateTag: 'shield', targetIds: ['enemy_0'] }, // 缺 shieldAfter
      ],
    });
    const s = summarizeS7BattleLog(r);
    const u = find(s.playerDamage, 'player_a')!;
    expect(u.hpDamageDealt).toBe(25); // 20 + 5（缺 actorId 的那条不归属任何人）
    expect(u.shieldDamageDealt).toBe(0);
  });

  it('摘要不修改传入的 result (#23)', async () => {
    const rt = await runtimeOf(loadBundle());
    const result = new S7AutoBattleEngine(rt).run({ encounterRef: 'enc_n018', battleSeed: 's', playerUnits: FIVE });
    const before = JSON.stringify(result);
    summarizeS7BattleLog(result);
    expect(JSON.stringify(result)).toBe(before);
  });

  it('同一 result 摘要两次输出深度相等 (#24)', async () => {
    const rt = await runtimeOf(loadBundle());
    const result = new S7AutoBattleEngine(rt).run({ encounterRef: 'enc_n075', battleSeed: 's', playerUnits: FIVE });
    expect(JSON.stringify(summarizeS7BattleLog(result))).toBe(JSON.stringify(summarizeS7BattleLog(result)));
  });
});

describe('S7BattleLogSummary - 静态隔离与未来在线化 (#25,#26)', () => {
  it('不 import 引擎/组装器/配置/存档/流程版战斗/cc (#25)', () => {
    const src = readFileSync(SUMMARY_SRC, 'utf-8');
    const importLines = src.split('\n').filter((l) => /^\s*import\b/.test(l));
    const forbidden = [
      'BattleEngine', 'BattleLaunchService', 'BattlePlaybackService',
      'S7AutoBattleEngine', 'S7BattleEncounterAssembler', 'S7ConfigRuntime',
      'S7SaveService', 'SaveService', 'PlayerState', 'completeS7Node',
    ];
    for (const line of importLines) {
      for (const name of forbidden) expect(line.includes(name)).toBe(false);
      expect(/from\s+['"]cc['"]/.test(line)).toBe(false);
      expect(/combat\//.test(line)).toBe(false);
    }
  });

  it('源码（去注释后）不含真实联网/支付/社交/随机时间痕迹 (#26)', () => {
    const raw = readFileSync(SUMMARY_SRC, 'utf-8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const forbidden = [
      'Math.random', 'Date.now', 'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest',
      'http://', 'https://', 'requestPayment', 'createRewardedVideoAd',
      'leaderboard', 'guild', 'friend', 'payment', 'iap', 'openid', 'unionid',
    ];
    for (const token of forbidden) expect(code.includes(token)).toBe(false);
  });
});
