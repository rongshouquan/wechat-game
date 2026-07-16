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
/** Boss 声明效果行域（content 生成器管建；apply 只节点化其 summonUnitRef、clean 对称回退全局）。 */
export const BOSS_EFFECT_RE = /^eff_boss_(n\d+)_/;
/** 段6 · 精英关级效果变体域（n356 速鼓升级案·总控批）：eff_elite_nXXX_*=generate ELITE_CONTENT.effects
 *  独管（先删后建·BOSS 域同构）；带 summon 引用时 apply 节点化/clean 回退与 BOSS 域并列对称。 */
export const ELITE_EFFECT_RE = /^eff_elite_(n\d+)_/;
/** 段6 · 关级效果引用重定向（apply 造节点行时把 extraTriggerBlocks 的全局效果引用换成关级变体行；
 *  clean 对称=节点行整行删除·天然回净土零残留）。n356=速鼓幅度与全局共享行解耦（n165 不再连带）。 */
export const ELITE_EFFECT_REDIRECT = {
  n356: { eff_s7_elite_rally_haste: 'eff_elite_n356_rally_haste' },
};

/**
 * Boss 周期召唤规则（段二 H1·真源 f8c6ae75：失控母舰阶段1"周期召唤【无人机】·复用母舰单元召唤物"）。
 * 生产规则侧落法（防 apply 幂等冲回·星盗队长改名先例）：落数时给 Boss 行挂 cd 型召唤大招
 * （ultimateEffectRef=eff_<node>_summon 生命周期包·召唤单位=bu_<node>_sadd 无人机·SADD 份额），
 * 清土时把 Boss 大招指针回退到 cleanUltimate（保证"只清不落"的净土仍然引用闭合·validator 绿）。
 * ultimateCdSec=12 对齐母舰单元先例（真源"周期召唤"未给数·数值域定报备·2b 复测可调）。
 *
 * ⚠️ 450 关战斗批（2026-07-14）：旧键 n084=150 关世界的失控母舰位——新世界 n084=sf01 普通关，
 * 规则语义**追随 Boss 身份（失控母舰）而非节点号**；段 2 的 13 Boss 对位表过总控后，
 * 本表按失控母舰新位重挂（2a H1 成果=规则范式与生命周期包·原样复用）。
 *
 * 段2 落表（对位表过闸后·n084→n250 全链挪号+召唤主题两 Boss 同规则复用）：
 *   n250 失控母舰（真源原班挪位·阶段1"周期召唤无人机"f8c6ae75）cd12=母舰单元先例值；
 *   n282 母舰指挥官（真源"量产协议=复用母舰单元召唤、召唤速度更快"）cd8；
 *   n312 量产中枢（变体·母舰召唤放大×复活波次）cd6=放大档。
 * cleanUltimate=各 Boss 走量骨架占位值（净土回退防悬空引用·apply 时被本规则覆盖）。
 * 三档 CD=数值域自定报备（12/8/6·"更快/放大"的量化）。
 */
export const BOSS_PERIODIC_SUMMON = {
  n250: { ultimateCdSec: 12, cleanUltimate: { ref: 'eff_ult_burst_nuke', cdSec: 10 } },
  n282: { ultimateCdSec: 8, cleanUltimate: { ref: 'eff_ult_clear_barrage', cdSec: 10 } },
  n312: { ultimateCdSec: 6, cleanUltimate: { ref: 'eff_ult_burst_nuke', cdSec: 10 } },
};

/**
 * 段4 · 眼段域规则声明表（n401-449 普通关·两工具共享=BOSS_PERIODIC_SUMMON 同构）：
 *   生成器翻译 encounter/spawn 面（mist=部分波 spawnDelaySec 10/assembly=波含母舰/tide=env cd 块/
 *   surge=env battle_start 块/battlewave=reviveWaves 1）；apply 翻译单位行面（graveyard=该关节点
 *   敌行注 selfReviveHpPct 0.5/DelaySec 0.8）。n450 六叠=BOSS_CONTENT 手工声明（Boss 关特例）。
 * 六规则池（剧本骨架五域规则+终墙连战成分）：graveyard/mist/assembly/tide/surge/battlewave。
 * 递进（剧本 R7 结构原文）：401-404 低压检阅（两叠·六规则各亮相）→405-415 两叠→416-430 三叠→
 *   431-443 四叠→444-449 五叠（C(6,5)=6 组合恰好各一）→450 六叠全叠。
 * 环境伤害量纲：tide 块 attackPof=0.04（P 的 4%·小潮 cd8）+0.08（大潮 cd20）——预算外预折记档
 *   （§21.4·总控前置令）。
 */
export const EYE_RULES = {
  // —— 低压检阅 4 关（10-14s 碾压·六规则各亮相一遍=毕业核大杀四方的检阅台）——
  n401: ['graveyard', 'mist'], n402: ['tide', 'assembly'], n403: ['surge', 'battlewave'], n404: ['graveyard', 'tide'],
  // —— 两叠段 405-415（11 关·教学序轮换）——
  n405: ['graveyard', 'assembly'], n406: ['mist', 'tide'], n407: ['surge', 'graveyard'], n408: ['battlewave', 'mist'],
  n409: ['tide', 'surge'], n410: ['assembly', 'battlewave'], n411: ['graveyard', 'battlewave'], n412: ['mist', 'assembly'],
  n413: ['tide', 'battlewave'], n414: ['surge', 'assembly'], n415: ['mist', 'surge'],
  // —— 三叠段 416-430（15 关）——
  n416: ['graveyard', 'mist', 'tide'], n417: ['assembly', 'surge', 'battlewave'], n418: ['graveyard', 'tide', 'surge'],
  n419: ['mist', 'assembly', 'battlewave'], n420: ['graveyard', 'assembly', 'tide'], n421: ['mist', 'surge', 'battlewave'],
  n422: ['graveyard', 'mist', 'assembly'], n423: ['tide', 'surge', 'battlewave'], n424: ['graveyard', 'mist', 'battlewave'],
  n425: ['assembly', 'tide', 'surge'], n426: ['graveyard', 'surge', 'battlewave'], n427: ['mist', 'assembly', 'tide'],
  n428: ['graveyard', 'assembly', 'surge'], n429: ['mist', 'tide', 'battlewave'], n430: ['graveyard', 'tide', 'battlewave'],
  // —— 四叠段 431-443（13 关）——
  n431: ['graveyard', 'mist', 'tide', 'surge'], n432: ['assembly', 'tide', 'surge', 'battlewave'],
  n433: ['graveyard', 'mist', 'assembly', 'battlewave'], n434: ['graveyard', 'tide', 'surge', 'battlewave'],
  n435: ['mist', 'assembly', 'tide', 'surge'], n436: ['graveyard', 'mist', 'assembly', 'tide'],
  n437: ['graveyard', 'assembly', 'surge', 'battlewave'], n438: ['mist', 'tide', 'surge', 'battlewave'],
  n439: ['graveyard', 'mist', 'surge', 'battlewave'], n440: ['graveyard', 'assembly', 'tide', 'battlewave'],
  n441: ['mist', 'assembly', 'surge', 'battlewave'], n442: ['graveyard', 'mist', 'tide', 'battlewave'],
  n443: ['graveyard', 'assembly', 'tide', 'surge'],
  // —— 五叠段 444-449（6 关=C(6,5) 恰好各缺一）——
  n444: ['mist', 'assembly', 'tide', 'surge', 'battlewave'],      // 缺 graveyard
  n445: ['graveyard', 'assembly', 'tide', 'surge', 'battlewave'], // 缺 mist
  n446: ['graveyard', 'mist', 'tide', 'surge', 'battlewave'],     // 缺 assembly
  n447: ['graveyard', 'mist', 'assembly', 'surge', 'battlewave'], // 缺 tide
  n448: ['graveyard', 'mist', 'assembly', 'tide', 'battlewave'],  // 缺 surge
  n449: ['graveyard', 'mist', 'assembly', 'tide', 'surge'],       // 缺 battlewave
  // —— n450 毕业战=六叠全叠（encounter 面 tide/surge/battlewave+单位面 graveyard 走本表通用翻译；
  //    assembly/mist=Boss 场 adds 面·BOSS_CONTENT.n450.adds 手工声明〔母舰波+延迟环卫〕）——
  n450: ['graveyard', 'mist', 'assembly', 'tide', 'surge', 'battlewave'],
};

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
  // Boss 周期召唤规则回退（段二 H1）：净土态 Boss 大招指回全局效果（eff_<node>_summon 已被清，防悬空引用）。
  for (const [nodeId, rule] of Object.entries(BOSS_PERIODIC_SUMMON)) {
    const boss = kept.find((r) => r.rowId === `bu_boss_${nodeId}`);
    if (boss) {
      boss.ultimateEffectRef = rule.cleanUltimate.ref;
      boss.ultimateCdSec = rule.cleanUltimate.cdSec;
    }
  }
  const effects = tables.battle_effect_param;
  const keptEff = effects.filter((r) => !NODE_EFFECT_RE.test(r.rowId));
  stat.effectRemoved = effects.length - keptEff.length;
  tables.battle_effect_param = keptEff;
  // 段2：Boss 声明效果行（eff_boss_nXXX_*·content 生成器管建）的召唤引用回退全局行——
  // 净土态节点行已删，指针留节点名=悬空引用（validator 红）；apply 落数时再节点化（对称）。
  for (const r of keptEff) {
    if ((!BOSS_EFFECT_RE.test(r.rowId) && !ELITE_EFFECT_RE.test(r.rowId)) // 段6：elite 变体域并列对称
      || typeof r.summonUnitRef !== 'string' || r.summonUnitRef === 'none') continue;
    const g = globalRowOf(r.summonUnitRef);
    if (g !== r.summonUnitRef) r.summonUnitRef = g;
  }
  // 段3：斩首点名目标回退全局行（victoryRule='kill_target'·apply ②c 的对称面）。
  for (const enc of tables.battle_encounter_param) {
    if (typeof enc.victoryTargetUnitRef !== 'string') continue;
    const g = globalRowOf(enc.victoryTargetUnitRef);
    if (g !== enc.victoryTargetUnitRef) enc.victoryTargetUnitRef = g;
  }
  // 段4：环境块落数值删除（attack=apply 产物·attackPof 声明保留=三方对称·apply ②d 的对称面）。
  for (const enc of tables.battle_encounter_param) {
    if (!Array.isArray(enc.environmentBlocks)) continue;
    for (const eb of enc.environmentBlocks) delete eb.attack;
  }
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
