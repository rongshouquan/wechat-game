// ⑩A0 · 148 敌配落数共享库（§20.1 幂等两步的公共件·本批起入库归位——⑥当次用完即删的教训）。
// 职责：配置表 IO（定序序列化）+「清节点行回净土」纯变换 + 命名/注记规则。
// 两个 CLI（clean-and-normalize.mjs / apply-enemy-landing.mjs）共用本库，保证清/落一套规则。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 落数涉及的 5 张表（其余表不碰）。 */
export const LANDING_TABLES = [
  'battle_unit_stat_param',
  'battle_effect_param',
  'battle_encounter_param',
  'battle_spawn_param',
  'battle_boss_phase_param',
];

export function loadTables(dir) {
  const t = {};
  for (const name of LANDING_TABLES) {
    t[name] = JSON.parse(readFileSync(path.join(dir, `${name}.sample.json`), 'utf-8'));
  }
  return t;
}

/** 与仓库既有格式一致：2 空格缩进 + 结尾换行。幂等自证按此字节口径比对。 */
export function serializeTable(rows) {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

export function writeTables(dir, tables, onlyNames = LANDING_TABLES) {
  const written = [];
  for (const name of onlyNames) {
    const file = path.join(dir, `${name}.sample.json`);
    const next = serializeTable(tables[name]);
    const prev = readFileSync(file, 'utf-8');
    if (prev !== next) {
      writeFileSync(file, next);
      written.push(name);
    }
  }
  return written;
}

/** 节点行判定：bu_n<数字>_<后缀>（bu_boss_nXXX 是全局 Boss 行·原位改值不删）。 */
export const NODE_UNIT_RE = /^bu_n\d+_(.+)$/;
export const NODE_EFFECT_RE = /^eff_n\d+_summon$/;

/** 节点行 → 全局职业行（roleKeyOf 同款反解·§20.1）：add/sadd 归 boss_add，其余按后缀。 */
export function globalRowOf(rowId) {
  const m = rowId.match(NODE_UNIT_RE);
  if (!m) return rowId;
  const suffix = m[1] === 'add' || m[1] === 'sadd' ? 'boss_add' : m[1];
  return `bu_enemy_${suffix}`;
}

/** 剥掉历史落数注记后缀（"·⑥三段落数(…)" / "·⑩落数(…)" 等），保留手写正文——注记改覆盖写，根治重复拼接。 */
export function stripLandingNote(note) {
  if (typeof note !== 'string') return note;
  return note.replace(/·[^·()]*落数\([^)]*\)/g, '');
}

/**
 * 清节点行回净土（纯变换·就地改 tables）：
 *  ① 删全部节点敌行（bu_nXXX_*）与节点召唤效果（eff_nXXX_summon）；
 *  ② spawn.unitStatRef / boss_phase.summonUnitRefs 反解回全局职业行；
 *  ③ Boss 行（bu_boss_nXXX）保留原位，注记剥落数后缀（值由下次 apply 覆盖）。
 * 教学段 n001-n008 本就引用全局行=天然不受影响（§20.1 保留面）。
 */
export function cleanBundle(tables) {
  const stat = { unitRemoved: 0, effectRemoved: 0, spawnRefs: 0, phaseRefs: 0 };
  const units = tables.battle_unit_stat_param;
  const kept = units.filter((r) => !NODE_UNIT_RE.test(r.rowId));
  stat.unitRemoved = units.length - kept.length;
  tables.battle_unit_stat_param = kept;
  for (const r of kept) {
    if (/^bu_boss_n\d+$/.test(r.rowId) && typeof r.note === 'string') r.note = stripLandingNote(r.note);
  }
  const effects = tables.battle_effect_param;
  const keptEff = effects.filter((r) => !NODE_EFFECT_RE.test(r.rowId));
  stat.effectRemoved = effects.length - keptEff.length;
  tables.battle_effect_param = keptEff;
  for (const sp of tables.battle_spawn_param) {
    const g = globalRowOf(sp.unitStatRef);
    if (g !== sp.unitStatRef) {
      sp.unitStatRef = g;
      stat.spawnRefs += 1;
    }
  }
  for (const ph of tables.battle_boss_phase_param) {
    if (!Array.isArray(ph.summonUnitRefs)) continue;
    ph.summonUnitRefs = ph.summonUnitRefs.map((ref) => {
      const g = globalRowOf(ref);
      if (g !== ref) stat.phaseRefs += 1;
      return g;
    });
  }
  return stat;
}
