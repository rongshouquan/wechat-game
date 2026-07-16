#!/usr/bin/env node
// ⑩A0 · 落数两步之二「按压力表落 148 敌配」（§20.1 成文规则的入库版）。
// 结构性防呆：**内部先清后落**（cleanBundle 内存净土 → 重建全部节点行），半截重落类事故（174 垃圾行）
// 从机制上不可能；注记覆盖写（stripLandingNote），根治"同句重复拼 8 遍"类追加病。
// 幂等自证：连跑两遍第二遍输出逐字节不变（--check 即字节比对模式·gate 冒烟测试消费）。
//
// 公式与管线一字不差：esbuild 打包 tools/s7-battles-entry.ts，复用 mapPressureToEnemies / loadPressure
// （k 合同、φ 换算、职业形状表、WALL_BOOST 全部单点在 entry——本脚本零公式复制）。
// 专属行规则（§20.1）：Boss 行原位改值；Boss adds=bu_<node>_add（血=池3%/攻=总DPS6%×间隔）；
// 母舰产出=bu_<node>_sadd（2.5%/5%）+ 节点化召唤效果 eff_<node>_summon（限时20s/随源消亡/同源上限3）。
// 保留面：n001-n008 教学段不落公式；41 条全局基础行不删。
//
// 用法：
//   node tools/apply-enemy-landing.mjs                 # 清+落+写盘
//   node tools/apply-enemy-landing.mjs --check         # 不写盘：计算结果与磁盘逐字节比对（0=一致）
//   node tools/apply-enemy-landing.mjs --check-ignore-note  # 同上但忽略 note 字段（迁格式对账用）
//   node tools/apply-enemy-landing.mjs --dir <configs目录>  # 对指定目录副本操作（测试用）
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadTables, writeTables, cleanBundle, serializeTable, stripLandingNote, LANDING_TABLES, BOSS_PERIODIC_SUMMON, BOSS_EFFECT_RE, ELITE_EFFECT_RE, ELITE_EFFECT_REDIRECT, EYE_RULES } from './enemy-landing-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dirIdx = argv.indexOf('--dir');
const DIR = dirIdx >= 0 && argv[dirIdx + 1]
  ? path.resolve(argv[dirIdx + 1])
  : path.resolve(HERE, '..', 'assets', 'resources', 'configs', 's7');
const CHECK = argv.includes('--check') || argv.includes('--check-ignore-note');
const IGNORE_NOTE = argv.includes('--check-ignore-note');

/** add/sadd 专属行份额（§20.1 成文）。 */
const ADD_SHARE = { hp: 0.03, dps: 0.06 };
const SADD_SHARE = { hp: 0.025, dps: 0.05 };
const SUMMON_LIFECYCLE = { summonExpireSec: 20, despawnWithSource: true, summonSourceCap: 3 };
const TEACHING_MAX_NODE = 8; // n001-n008 保留面

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-landing-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..'); // 压力表/growth_band 锚定真实工程根（--dir 副本只换配置面）
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

function suffixOfGlobal(globalId) {
  const m = globalId.match(/^bu_enemy_(.+)$/);
  if (!m) throw new Error(`非全局职业行：${globalId}`);
  return m[1];
}

function landBundle(tables, mod) {
  const stat = { nodes: 0, nodeRows: 0, addRows: 0, saddRows: 0, effects: 0 };
  const pressure = mod.loadPressure();
  const units = tables.battle_unit_stat_param;
  const effects = tables.battle_effect_param;
  const unitById = new Map(units.map((r) => [r.rowId, r]));
  const globalSummonEff = effects.find((r) => r.rowId === 'eff_state_summon');
  if (!globalSummonEff) throw new Error('缺全局行 eff_state_summon');

  const encs = tables.battle_encounter_param
    .filter((e) => /^n\d{3}$/.test(e.nodeRef) && Number(e.nodeRef.slice(1)) > TEACHING_MAX_NODE)
    .sort((a, b) => Number(a.nodeRef.slice(1)) - Number(b.nodeRef.slice(1)));

  const nodeUnitBlocks = [];
  const nodeEffects = [];

  for (const enc of encs) {
    const nodeId = enc.nodeRef;
    const num = Number(nodeId.slice(1));
    const p = pressure[num];
    if (!(p > 0)) throw new Error(`无压力值：${nodeId}`);
    const scale = mod.mapPressureToEnemies(tables, nodeId, p);
    stat.nodes += 1;

    const block = [];
    const blockById = new Map();
    const ensureNodeRow = (globalId) => {
      const suffix = suffixOfGlobal(globalId);
      const nodeRowId = `bu_${nodeId}_${suffix}`;
      if (blockById.has(nodeRowId)) return nodeRowId;
      const template = unitById.get(globalId);
      const attrs = scale.units[globalId];
      if (!template) throw new Error(`缺全局职业行：${globalId}（${nodeId}）`);
      if (!attrs) throw new Error(`该关无此职业份额：${globalId}（${nodeId}·spawn 计划未含此行？）`);
      const row = {
        ...template,
        rowId: nodeRowId,
        maxHp: attrs.maxHp,
        attack: attrs.attack,
        armor: attrs.armor,
        attackIntervalSec: attrs.attackIntervalSec,
        note: `${nodeId} ${suffix}·⑩落数(P=${p}·§19映射·基=${globalId})`,
      };
      // 段6 · 关级效果引用重定向（ELITE_EFFECT_REDIRECT·n356 速鼓变体）：spread 是浅拷贝——
      // extraTriggerBlocks 必须深拷再换引用，防污染全局模板行（clean 对称=节点行整删零残留）。
      const redirect = ELITE_EFFECT_REDIRECT[nodeId];
      if (redirect && Array.isArray(row.extraTriggerBlocks)) {
        row.extraTriggerBlocks = row.extraTriggerBlocks.map((tb) => (
          redirect[tb.effectRef] ? { ...tb, effectRef: redirect[tb.effectRef] } : tb
        ));
      }
      block.push(row);
      blockById.set(nodeRowId, row);
      stat.nodeRows += 1;
      return nodeRowId;
    };
    const ensureSpecialtyRow = (kind, share, templateId = 'bu_enemy_boss_add') => {
      const nodeRowId = `bu_${nodeId}_${kind}`;
      if (blockById.has(nodeRowId)) return nodeRowId;
      const template = unitById.get(templateId);
      if (!template) throw new Error(`缺专属行模板：${templateId}（${nodeId}）`);
      // 防/间隔：add/sadd=职业形状固定值（§19.2·字节兼容⑥口径）；其他真源载体（⑩A4 起·如污染体）=模板行自带值。
      const shape = templateId === 'bu_enemy_boss_add'
        ? mod.ROLE_SHAPE.bu_enemy_boss_add
        : { armor: template.armor, interval: template.attackIntervalSec };
      const noteBody = kind === 'add'
        ? `${nodeId} Boss adds·⑩落数(池${share.hp * 100}%/火${share.dps * 100}%)`
        : kind === 'sadd'
          ? `${nodeId} 母舰产出·⑩落数(池${share.hp * 100}%/火${share.dps * 100}%)`
          : `${nodeId} 阶段召唤载体 ${kind}·⑩落数(池${share.hp * 100}%/火${share.dps * 100}%·基=${templateId}·机制随模板)`;
      const row = {
        ...template,
        rowId: nodeRowId,
        maxHp: Math.max(1, Math.round(scale.pool * share.hp)),
        attack: Math.max(1, Math.round(scale.dps * share.dps * shape.interval)),
        armor: shape.armor,
        attackIntervalSec: shape.interval,
        note: noteBody,
      };
      block.push(row);
      blockById.set(nodeRowId, row);
      if (kind === 'add') stat.addRows += 1;
      else if (kind === 'sadd') stat.saddRows += 1;
      else stat.carrierRows = (stat.carrierRows ?? 0) + 1; // ⑩A4：阶段召唤真源载体（如污染体）
      return nodeRowId;
    };

    // ① spawn 引用面（含 Boss 行原位改值）——按 spawn 计划顺序建行/换引用。
    for (const ref of enc.spawnPlanRefs) {
      const sp = tables.battle_spawn_param.find((s) => s.rowId === ref);
      if (!sp) continue;
      const globalId = sp.unitStatRef;
      if (/^bu_boss_n\d+$/.test(globalId)) {
        const bossRow = unitById.get(globalId);
        const attrs = scale.units[globalId];
        if (!bossRow || !attrs) throw new Error(`Boss 行缺失或无份额：${globalId}`);
        bossRow.maxHp = attrs.maxHp;
        bossRow.attack = attrs.attack;
        bossRow.armor = attrs.armor;
        bossRow.attackIntervalSec = attrs.attackIntervalSec;
        bossRow.note = `${stripLandingNote(bossRow.note ?? '')}·⑩落数(P=${p}·§19映射)`;
        continue;
      }
      sp.unitStatRef = ensureNodeRow(globalId);
    }
    // ② Boss 阶段召唤引用面：boss_add → 专属 add 行；spawn 计划已含的职业 → 节点职业行；
    //    其余真源载体（⑩A4 起·如污染体=不在 spawn 计划的阶段专属召唤）→ 按 add 份额落专属行、机制字段随模板。
    for (const ph of tables.battle_boss_phase_param) {
      if (ph.bossNodeId !== nodeId || !Array.isArray(ph.summonUnitRefs)) continue;
      ph.summonUnitRefs = ph.summonUnitRefs.map((ref) => {
        if (ref === 'bu_enemy_boss_add') return ensureSpecialtyRow('add', ADD_SHARE);
        if (scale.units[ref]) return ensureNodeRow(ref);
        return ensureSpecialtyRow(suffixOfGlobal(ref), ADD_SHARE, ref);
      });
    }
    // ②b 段2 · Boss 声明效果行（eff_boss_<node>_*·content 生成器管建）召唤引用节点化：
    //    全局职业行 → 本关节点行（spawn 计划有份额=ensureNodeRow；无=按 add 份额落专属行·机制随模板）
    //    ——召出单位吃本关压力缩放值而非全局原始值；cleanBundle 对称回退全局（防净土悬空引用）。
    for (const eff of effects) {
      const m = eff.rowId.match(BOSS_EFFECT_RE) ?? eff.rowId.match(ELITE_EFFECT_RE); // 段6：elite 变体域并列（summon 对称·现役 n356 无 summon=零动作通道完备）
      if (!m || m[1] !== nodeId) continue;
      const ref = eff.summonUnitRef;
      if (typeof ref !== 'string' || ref === 'none' || !/^bu_enemy_/.test(ref)) continue;
      eff.summonUnitRef = scale.units[ref] ? ensureNodeRow(ref) : ensureSpecialtyRow(suffixOfGlobal(ref), ADD_SHARE, ref);
    }
    // ②c 段3 · 斩首点名目标节点化（限时斩首花样·victoryRule='kill_target'）：encounter 的
    //    victoryTargetUnitRef 全局职业行 → 本关节点行（validator 要求目标 ∈ enemyUnitStatRefs
    //    且行存在——三方对称=cleanBundle 回退全局，任意落盘态自洽）。
    if (typeof enc.victoryTargetUnitRef === 'string' && /^bu_enemy_/.test(enc.victoryTargetUnitRef)) {
      enc.victoryTargetUnitRef = scale.units[enc.victoryTargetUnitRef]
        ? ensureNodeRow(enc.victoryTargetUnitRef)
        : ensureSpecialtyRow(suffixOfGlobal(enc.victoryTargetUnitRef), ADD_SHARE, enc.victoryTargetUnitRef);
      if (Array.isArray(enc.enemyUnitStatRefs) && !enc.enemyUnitStatRefs.includes(enc.victoryTargetUnitRef)) {
        enc.enemyUnitStatRefs = [...enc.enemyUnitStatRefs, enc.victoryTargetUnitRef];
      }
    }
    // ②d 段4 · 环境块伤害量纲落数（域规则通道①）：attackPof（生成器声明·占 P 比例）→
    //    attack 绝对值（=P×attackPof·随压力自动缩放）；cleanBundle 删 attack=三方对称。
    //    ⚠️ 压力预算外记档（总控前置令 07-16）：环境伤/增幅不在 k 合同预算内——同段2"敌自增强
    //    预算外乘法"结构，眼段带子/boost 调参显式预折（§21.4 记账）。
    if (Array.isArray(enc.environmentBlocks)) {
      for (const eb of enc.environmentBlocks) {
        if (typeof eb.attackPof === 'number' && eb.attackPof > 0) eb.attack = Math.max(1, Math.round(p * eb.attackPof));
      }
    }
    // ③ 母舰节点化：召唤效果 + 产出行 + 母舰行改指节点效果。
    const summonRowId = `bu_${nodeId}_summon_source`;
    if (blockById.has(summonRowId)) {
      const saddId = ensureSpecialtyRow('sadd', SADD_SHARE);
      const effId = `eff_${nodeId}_summon`;
      nodeEffects.push({
        ...globalSummonEff,
        rowId: effId,
        summonUnitRef: saddId,
        note: `${nodeId} 母舰召唤·⑩落数（生命周期包=真源§0：限时20s/随源消亡/同源上限3）`,
        ...SUMMON_LIFECYCLE,
      });
      blockById.get(summonRowId).ultimateEffectRef = effId;
      stat.effects += 1;
    }
    // ④ Boss 周期召唤（段二 H1·真源 f8c6ae75）：失控母舰类 Boss 本体挂 cd 型召唤大招——
    //    召唤单位=本节点 sadd（复用母舰单元召唤物·无人机语义行）+生命周期包；大招指针/CD 由规则拥有
    //    （cleanBundle 对称回退·防"只清不落"悬空引用）。旧 10s 爆发 nuke 让位（真源阶段1 无此项；
    //    残血爆发窗口仍由 phase_final effectRefs 承担）。
    const bossRule = BOSS_PERIODIC_SUMMON[nodeId];
    if (bossRule) {
      const bossRow = unitById.get(`bu_boss_${nodeId}`);
      if (!bossRow) throw new Error(`BOSS_PERIODIC_SUMMON 找不到 Boss 行：bu_boss_${nodeId}`);
      const saddId = ensureSpecialtyRow('sadd', SADD_SHARE);
      const effId = `eff_${nodeId}_summon`;
      if (!nodeEffects.some((e) => e.rowId === effId)) {
        nodeEffects.push({
          ...globalSummonEff,
          rowId: effId,
          summonUnitRef: saddId,
          note: `${nodeId} Boss周期召唤无人机·段二H1落数（真源f8c6ae75阶段1·复用母舰单元召唤物·生命周期包=真源§0：限时20s/随源消亡/同源上限3）`,
          ...SUMMON_LIFECYCLE,
        });
        stat.effects += 1;
      }
      bossRow.ultimateEffectRef = effId;
      bossRow.ultimateCdSec = bossRule.ultimateCdSec;
    }
    // ⑤ 段4 · 眼段坟场复活字段注入（EYE_RULES graveyard·lib 共享声明）：本关全部节点敌行注
    //    selfReviveHpPct 0.5/DelaySec 0.8（真源 sf02"击毁后原地复活一次半血"·引擎通道②消费）；
    //    节点行=本函数产物→重放天然对称（清土删行=字段随行走·零悬挂）。
    if (EYE_RULES[nodeId]?.includes('graveyard')) {
      for (const row2 of block) {
        row2.selfReviveHpPct = 0.5;
        row2.selfReviveDelaySec = 0.8;
      }
    }
    nodeUnitBlocks.push(...block);
  }

  tables.battle_unit_stat_param = [...units, ...nodeUnitBlocks];
  tables.battle_effect_param = [...effects, ...nodeEffects];
  return stat;
}

/** --check：计算态 vs 磁盘逐字节比对；--check-ignore-note 忽略 note 字段后深比对（迁格式对账）。 */
function compareToDisk(tables) {
  let diffs = 0;
  for (const name of LANDING_TABLES) {
    // EOL 归一：--check 守内容字节、不守 git autocrlf 换行差异。
    const diskRaw = readFileSync(path.join(DIR, `${name}.sample.json`), 'utf-8').replace(/\r\n/g, '\n');
    if (!IGNORE_NOTE) {
      if (diskRaw !== serializeTable(tables[name])) {
        diffs += 1;
        console.log(`[check] ✗ ${name} 与磁盘不一致（字节）`);
      }
      continue;
    }
    const dropNote = (rows) => rows.map((r) => { const { note, ...rest } = r; return rest; });
    const disk = dropNote(JSON.parse(diskRaw));
    const mine = dropNote(tables[name]);
    const diskById = new Map(disk.map((r) => [r.rowId, r]));
    const mineById = new Map(mine.map((r) => [r.rowId, r]));
    for (const [id, r] of mineById) {
      const d = diskById.get(id);
      if (!d) { console.log(`[check] ${name} 磁盘缺行：${id}`); diffs += 1; continue; }
      if (JSON.stringify(d) !== JSON.stringify(r)) {
        diffs += 1;
        console.log(`[check] ${name} 行值不同：${id}`);
        for (const k of new Set([...Object.keys(d), ...Object.keys(r)])) {
          if (JSON.stringify(d[k]) !== JSON.stringify(r[k])) console.log(`         ${k}: 磁盘=${JSON.stringify(d[k])} 计算=${JSON.stringify(r[k])}`);
        }
      }
    }
    for (const id of diskById.keys()) {
      if (!mineById.has(id)) { console.log(`[check] ${name} 磁盘多行（计算态无）：${id}`); diffs += 1; }
    }
  }
  return diffs;
}

async function run() {
  const { mod, cleanup } = await loadEntry();
  try {
    const tables = loadTables(DIR);
    const cleanStat = cleanBundle(tables);
    const landStat = landBundle(tables, mod);
    console.log(`[apply] 清：节点行-${cleanStat.unitRemoved}/效果-${cleanStat.effectRemoved} → 落：${landStat.nodes} 关 · 节点行 ${landStat.nodeRows}+add ${landStat.addRows}+sadd ${landStat.saddRows} · 召唤效果 ${landStat.effects} · 单位行总数 ${tables.battle_unit_stat_param.length} · 效果行总数 ${tables.battle_effect_param.length}`);
    if (CHECK) {
      const diffs = compareToDisk(tables);
      console.log(diffs === 0 ? '[check] ✅ 计算态与磁盘一致' : `[check] ✗ 共 ${diffs} 处不一致`);
      process.exitCode = diffs === 0 ? 0 : 1;
      return;
    }
    const written = writeTables(DIR, tables);
    console.log(`[apply] 写盘：${written.length ? written.join(', ') : '（无变化=幂等）'}`);
  } finally {
    cleanup();
  }
}

run().catch((e) => {
  console.error('[apply-enemy-landing] 失败：', e);
  process.exitCode = 1;
});
