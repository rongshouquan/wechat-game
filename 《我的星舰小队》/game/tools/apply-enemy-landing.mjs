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
import { loadTables, writeTables, cleanBundle, serializeTable, stripLandingNote, LANDING_TABLES } from './enemy-landing-lib.mjs';

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
      block.push(row);
      blockById.set(nodeRowId, row);
      stat.nodeRows += 1;
      return nodeRowId;
    };
    const ensureSpecialtyRow = (kind, share) => {
      const nodeRowId = `bu_${nodeId}_${kind}`;
      if (blockById.has(nodeRowId)) return nodeRowId;
      const template = unitById.get('bu_enemy_boss_add');
      const shape = mod.ROLE_SHAPE.bu_enemy_boss_add; // 防/间隔=职业形状固定值（§19.2·非模板行遗留值）
      const noteBody = kind === 'add'
        ? `${nodeId} Boss adds·⑩落数(池${share.hp * 100}%/火${share.dps * 100}%)`
        : `${nodeId} 母舰产出·⑩落数(池${share.hp * 100}%/火${share.dps * 100}%)`;
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
      else stat.saddRows += 1;
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
    // ② Boss 阶段召唤引用面：boss_add → 专属 add 行；其余职业 → 节点职业行。
    for (const ph of tables.battle_boss_phase_param) {
      if (ph.bossNodeId !== nodeId || !Array.isArray(ph.summonUnitRefs)) continue;
      ph.summonUnitRefs = ph.summonUnitRefs.map((ref) => (
        ref === 'bu_enemy_boss_add' ? ensureSpecialtyRow('add', ADD_SHARE) : ensureNodeRow(ref)
      ));
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
