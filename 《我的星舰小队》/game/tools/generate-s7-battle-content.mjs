#!/usr/bin/env node
// 段二战斗批 · 450 关战斗内容骨架走量生成器（2026-07-14 首建）。
//
// 分工（与 apply-enemy-landing.mjs 的两步幂等纪律咬合）：
//   本工具＝**骨架层**（encounter 行/spawn 波次与格位/Boss 全局行/Boss 阶段占位——"这关有谁、几波、站哪"）；
//   apply-enemy-landing＝**属性层**（按压力表落血攻防——"他们多硬多疼"）。
//   顺序：本工具 → apply-enemy-landing → apply-pressure-display → validator。
// 幂等：纯确定性映射（零随机），重跑逐字节同结果；--check 同 apply 口径字节比对。
//
// 保留面（§20.1 红线）：n001-n008 教学段 encounter/spawn 原行一字不动（敌配手调窗口）；
//   41+ 条全局基础行不删（本工具只动 bu_boss_* 全局行：删旧世界 7 位、建新世界 13 位骨架）。
// 波次设计：跟 problemTagRef 走（战前预览标签与实际敌人对得上）；六域族味用真源载体
//   （废铁=swarm_tough/support/stormtower、污染=pollution——ROLE_SHAPE 已含其形状行）。
// Boss 内容：段 1 只落"占位弧线"（mid 血50% 易伤窗 + final 血20% 爆发窗·通用两段）——
//   13 Boss 真机制（对位真源 §5 族属/招牌/召唤）＝段 2 手调域，本工具不发明设计。
// 精英内容：段 1 落"强化组合"骨架；花样（词缀点名/奇阵/斩首/镜像/复活连战/福利）＝段 3 手调域。
//
// 用法：
//   node tools/generate-s7-battle-content.mjs           # 生成+写盘
//   node tools/generate-s7-battle-content.mjs --check   # 不写盘：计算态与磁盘逐字节比对（0=一致）
// ⚠️ --check 只在 apply-enemy-landing 之前有效：apply 会把骨架属性覆盖成落数值（Boss 行血攻/
//    spawn 引用节点化）——落数后的盘面 vs 骨架计算态必然不同（≠工具坏）。落数后的幂等验证
//    =apply-enemy-landing --check；重跑本工具会以磁盘现态为基（Boss 行"已有保留"）+重建 encounter/
//    spawn/phase 骨架，跑完必须再跑一遍 apply 恢复属性层。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTables, writeTables, serializeTable, LANDING_TABLES } from './enemy-landing-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const SCHEMA = 's7-0.1.0';
const CHECK = process.argv.includes('--check');
const TEACHING_MAX_NODE = 8; // n001-n008 保留面（§20.1）

const mainline = JSON.parse(readFileSync(path.join(DIR, 'mainline_node_config.sample.json'), 'utf-8'));

// ============================================================================
// 波次映射（problemTag → 职业波次组合·主模式对齐旧 148 关归纳 + 六域族味载体）
// 每 tag 两个 normal 变体（按节点号轮换=域内有变化不单调）。
// ============================================================================

/** 全局职业行短后缀（bu_enemy_<suffix>）。 */
const NORMAL_WAVES = {
  swarm: [
    [['swarm', 7], ['swarm', 5]], // 星盗海双波（旧 t02 主模式）
    [['swarm', 7]],               // 单波直道（旧 t01 主模式）
  ],
  backline: [
    [['swarm_tough', 4], ['support', 2], ['stormtower', 2]], // 废铁全家福：滚石挡前+修理机奶+磁暴塔（点治疗源题）
    [['swarm_tough', 6], ['stormtower', 2]],                 // 重肉波
  ],
  shield: [
    [['shield', 3]],               // 盾墙（旧 t03/t04 主模式·血厚量少）
    [['shield', 2], ['swarm', 5]], // 盾+杂兵混编
  ],
  summon: [
    [['summon_source', 2], ['boss_add', 4]], // 量产母舰+在场无人机（旧 t09 主模式）
    [['summon_source', 2], ['backline', 2]], // 母舰+点名塔（无人舰族纯度）
  ],
  berserk: [
    [['pollution', 3], ['swarm', 4]],       // 污染体+杂兵（受击狂暴题·真源载体）
    [['pollution', 2], ['burst_raider', 2]], // 污染+快攻
  ],
  burst: [
    [['burst_raider', 2], ['charge', 2]], // 玻璃炮+前锋（旧 t08 主模式）
    [['burst_raider', 3]],                // 纯爆发（旧 t07 主模式）
  ],
};

/** 精英强化组合（花样=段 3 手调，此处为强度骨架·对齐旧 elite 例）。 */
const ELITE_WAVES = {
  swarm: [['swarm_tough', 8], ['swarm', 4]],
  backline: [['stormtower', 3], ['support', 2], ['swarm_tough', 3]],
  shield: [['shield_warden', 1], ['shield', 2]],
  summon: [['summon_source', 2], ['boss_add', 4]],
  berserk: [['pollution', 4], ['swarm', 3]],
  burst: [['burst_raider', 3], ['charge', 2]],
};

/** Boss 场 adds 波（域主题·旧例 boss=bossx1+主题职业）。 */
const BOSS_ADDS = {
  swarm: [['swarm', 5]],
  backline: [['stormtower', 2], ['support', 2]],
  shield: [['shield', 3]],
  summon: [['summon_source', 2]],
  berserk: [['pollution', 3]],
  burst: [['charge', 3]],
};

/** Boss 大招占位（段 2 对位真源后换真机制；轮换两款通用大招防千篇一律）。 */
const BOSS_ULT_PLACEHOLDER = ['eff_ult_clear_barrage', 'eff_ult_burst_nuke'];

// ============================================================================
// 格位铺排（敌方 5 行×7 列 r0-r4 × c0-c6·行内从中心 c3 向两侧扩）
// ============================================================================

function rowSlots(startRow, count) {
  const order = [3, 2, 4, 1, 5, 0, 6]; // 行内中心向外
  const slots = [];
  let row = startRow;
  let left = count;
  while (left > 0 && row <= 4) { // 敌方 5 行封顶（r0-r4）·超行数=配置错误由 validator 拦
    const take = Math.min(left, 7);
    slots.push(...order.slice(0, take).sort((a, b) => a - b).map((c) => `r${row}c${c}`));
    left -= take;
    row += 1;
  }
  return slots;
}

/** 一波占用的行数（跨行铺格后，下一波从其下一行起=波间零格冲突）。 */
function rowsUsed(count) {
  return Math.max(1, Math.ceil(count / 7));
}

// ============================================================================
// 生成
// ============================================================================

function buildBundle(tables) {
  const stat = { encounters: 0, spawns: 0, bossRows: 0, phases: 0 };
  const oldEnc = tables.battle_encounter_param;
  const oldSpawn = tables.battle_spawn_param;
  const units = tables.battle_unit_stat_param;

  // —— 全局行面：删除不在新世界 Boss 位的旧 bu_boss_* 行，按新 13 位建骨架行。
  const bossNums = mainline.filter((r) => r.nodeTypeTag === 'boss').map((r) => r.nodeId);
  const bossSet = new Set(bossNums);
  const keptUnits = units.filter((r) => {
    const m = r.rowId.match(/^bu_boss_(n\d{3})$/);
    return !m || bossSet.has(m[1]);
  });
  const existingBoss = new Set(keptUnits.filter((r) => /^bu_boss_n\d{3}$/.test(r.rowId)).map((r) => r.rowId));
  const bossTemplateRow = units.find((r) => r.rowId === 'bu_boss_n060') ?? units.find((r) => /^bu_boss_n\d{3}$/.test(r.rowId));
  if (!bossTemplateRow) throw new Error('缺 Boss 行结构模板（bu_boss_*）');
  let ultIdx = 0;
  for (const nodeId of bossNums) {
    const rowId = `bu_boss_${nodeId}`;
    if (existingBoss.has(rowId)) continue; // 已有行保留（重跑幂等/段 2 手调后不被冲掉——本工具只建缺失骨架）
    const node = mainline.find((r) => r.nodeId === nodeId);
    keptUnits.push({
      ...bossTemplateRow,
      rowId,
      unitRef: nodeId,
      roleTag: `boss_${node.problemTagRef}`,
      targetingTag: 'nearest_random_tie',
      normalEffectRef: 'eff_basic_attack',
      ultimateEffectRef: BOSS_ULT_PLACEHOLDER[ultIdx++ % BOSS_ULT_PLACEHOLDER.length],
      ultimateCdSec: 10,
      coreEffectRef: 'none',
      note: `${nodeId} Boss 骨架占位（450 关走量·域主题=${node.problemTagRef}·真机制=段2 对位真源§5 手调）`,
    });
    stat.bossRows += 1;
  }
  tables.battle_unit_stat_param = keptUnits;

  // —— encounter/spawn/phase：教学段 n001-n008 原行保留，n009+ 全重建。
  // 教学段保留面=敌配属性/波次/格位一字不动；stageType 标签跟 mainline 对齐
  // （新世界精英位挪动：旧 n006 elite→normal、n007 normal→elite——validator 一致性铁则）。
  const keepEnc = oldEnc.filter((e) => /^n00[1-8]$/.test(e.nodeRef)).map((e) => {
    const node = mainline.find((r) => r.nodeId === e.nodeRef);
    const stage = node.nodeTypeTag === 'boss' ? 'boss'
      : node.nodeTypeTag === 'elite' ? 'elite'
        : node.nodeTypeTag === 'tutorial_battle' ? e.stageType // 教学战斗节点沿原标签（n001-n005）
          : 'normal';
    return e.stageType === stage ? e : { ...e, stageType: stage };
  });
  const keepSpawn = oldSpawn.filter((s) => /^spawn_n00[1-8]_/.test(s.rowId));
  const newEnc = [];
  const newSpawn = [];
  const newPhases = [];

  for (const node of mainline) {
    const num = Number(node.nodeId.slice(1));
    if (num <= TEACHING_MAX_NODE) continue;
    if (node.nodeTypeTag === 'reset_gate' || node.nodeTypeTag === 'protection_notice') continue;
    const nodeId = node.nodeId;
    const tag = node.problemTagRef;
    const isBoss = node.nodeTypeTag === 'boss';
    const isElite = node.nodeTypeTag === 'elite';
    const stage = isBoss ? 'boss' : isElite ? 'elite' : 'normal';
    const spawnRefs = [];
    const unitRefs = new Set();

    if (isBoss) {
      const bossRowId = `bu_boss_${nodeId}`;
      newSpawn.push({
        schemaVersion: SCHEMA, rowId: `spawn_${nodeId}_boss`, encounterRef: `enc_${nodeId}`, waveIndex: 1,
        unitStatRef: bossRowId, count: 1, slotRefs: ['r0c2'], spawnDelaySec: 0, maxConcurrentOnField: 12,
        note: `enc_${nodeId} 第1波：${bossRowId} x1`,
      });
      spawnRefs.push(`spawn_${nodeId}_boss`);
      unitRefs.add(bossRowId);
      const adds = BOSS_ADDS[tag] ?? BOSS_ADDS.swarm;
      let addWave = 0;
      for (const [suffix, count] of adds) {
        addWave += 1;
        const sid = `spawn_${nodeId}_adds${adds.length > 1 ? addWave : ''}`;
        newSpawn.push({
          schemaVersion: SCHEMA, rowId: sid, encounterRef: `enc_${nodeId}`, waveIndex: 1,
          unitStatRef: `bu_enemy_${suffix}`, count, slotRefs: rowSlots(2 + (addWave - 1), count),
          spawnDelaySec: 0, maxConcurrentOnField: 12,
          note: `enc_${nodeId} 第1波 adds：bu_enemy_${suffix} x${count}`,
        });
        spawnRefs.push(sid);
        // 节点行名与 apply 的 ensureNodeRow 命名一致：spawn 引用 bu_enemy_boss_add → bu_nXXX_boss_add
        // （bu_nXXX_add 是 phase 召唤专属行名·3%/6% 特殊份额，spawn 面不用）。
        unitRefs.add(`bu_${nodeId}_${suffix}`);
      }
      // Boss 阶段占位（通用两段弧线：血50% 易伤窗 → 血20% 爆发窗）；真阶段=段 2 手调。
      newPhases.push({
        schemaVersion: SCHEMA, rowId: `phase_${nodeId}_mid`, bossNodeId: nodeId, phaseTag: 'mid',
        triggerType: 'hp_pct_below', triggerValue: 50, effectRefs: ['eff_state_vulnerable'],
        summonUnitRefs: [], summonCountCap: 0, note: '中段易伤窗占位（450 关走量·真阶段=段2 对位手调）',
      });
      newPhases.push({
        schemaVersion: SCHEMA, rowId: `phase_${nodeId}_final`, bossNodeId: nodeId, phaseTag: 'final',
        triggerType: 'hp_pct_below', triggerValue: 20, effectRefs: ['eff_ult_burst_nuke'],
        summonUnitRefs: [], summonCountCap: 0, note: '残血爆发窗占位（450 关走量·真阶段=段2 对位手调）',
      });
      stat.phases += 2;
    } else {
      const variants = NORMAL_WAVES[tag] ?? NORMAL_WAVES.swarm;
      const plan = isElite ? (ELITE_WAVES[tag] ?? ELITE_WAVES.swarm) : variants[num % variants.length];
      let wave = 0;
      let nextRow = 0; // 波间从上一波占用行的下一行起铺=零格冲突
      for (const [suffix, count] of plan) {
        wave += 1;
        const sid = `spawn_${nodeId}_w${wave}`;
        newSpawn.push({
          schemaVersion: SCHEMA, rowId: sid, encounterRef: `enc_${nodeId}`, waveIndex: wave,
          unitStatRef: `bu_enemy_${suffix}`, count, slotRefs: rowSlots(nextRow, count),
          spawnDelaySec: wave === 1 ? 0 : 5, maxConcurrentOnField: 14,
          note: `enc_${nodeId} 第${wave}波：bu_enemy_${suffix} x${count}`,
        });
        nextRow += rowsUsed(count);
        spawnRefs.push(sid);
        unitRefs.add(`bu_${nodeId}_${suffix}`);
      }
    }

    newEnc.push({
      schemaVersion: SCHEMA,
      rowId: `enc_${nodeId}`,
      nodeRef: nodeId,
      stageType: stage,
      templateRef: node.templateRef,
      problemTagRef: tag,
      secondaryPressureTag: node.secondaryPressureTag ?? 'none',
      pressureRef: isBoss ? `bp_${nodeId}` : `np_${node.starfieldId}`,
      enemyUnitStatRefs: [...unitRefs],
      spawnPlanRefs: spawnRefs,
      bossPhaseRefs: isBoss ? [`phase_${nodeId}_mid`, `phase_${nodeId}_final`] : [],
      playerSlotPolicy: 'five_ship_3x3_default',
      timeLimitSec: 120,
      battleSeedPolicy: 'node_id_plus_run_seed',
      note: `${nodeId} ${stage === 'boss' ? 'Boss关' : stage === 'elite' ? '精英关' : '普通关'}·${tag} 主题（450 关走量）`,
    });
    stat.encounters += 1;
    stat.spawns = newSpawn.length;
  }

  tables.battle_encounter_param = [...keepEnc, ...newEnc];
  tables.battle_spawn_param = [...keepSpawn, ...newSpawn];
  tables.battle_boss_phase_param = newPhases;
  return stat;
}

function compareToDisk(tables) {
  let diffs = 0;
  for (const name of LANDING_TABLES) {
    const diskRaw = readFileSync(path.join(DIR, `${name}.sample.json`), 'utf-8').replace(/\r\n/g, '\n');
    if (diskRaw !== serializeTable(tables[name])) {
      diffs += 1;
      console.log(`[check] ✗ ${name} 与磁盘不一致（字节）`);
    }
  }
  return diffs;
}

const tables = loadTables(DIR);
const stat = buildBundle(tables);
console.log(`[content] encounter ${stat.encounters}（+教学 8 保留）· spawn ${stat.spawns}（+教学保留）· Boss 骨架行 +${stat.bossRows} · phase ${stat.phases}`);
if (CHECK) {
  const diffs = compareToDisk(tables);
  console.log(diffs === 0 ? '[check] ✅ 计算态与磁盘一致' : `[check] ✗ 共 ${diffs} 处不一致`);
  process.exitCode = diffs === 0 ? 0 : 1;
} else {
  const written = writeTables(DIR, tables);
  console.log(`[content] 写盘：${written.length ? written.join(', ') : '（无变化=幂等）'}`);
}
