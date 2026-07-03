// 修复 Codex 2c 批量产出里 note 字段的乱码（Windows 环境编码问题，字段本身结构数据完好，只是中文说明被写坏）。
// 只重写 note，不动任何功能字段；encounter/spawn 按结构字段自动生成说明，unit_stat/boss_phase 少量手写更贴切的说明。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

function readJson(name) { return JSON.parse(readFileSync(path.join(DIR, `${name}.sample.json`), 'utf-8')); }
function writeJson(name, rows) { writeFileSync(path.join(DIR, `${name}.sample.json`), JSON.stringify(rows, null, 2) + '\n', 'utf-8'); }
function isMojibake(s) { return typeof s === 'string' && /\?{3,}/.test(s); }

const TAG_CN = { swarm: '群怪', shield: '护盾', backline: '打后排', summon: '召唤', burst: '爆发', berserk: '狂暴' };

// ---- battle_encounter_param ----
const enc = readJson('battle_encounter_param');
let fixedEnc = 0;
for (const r of enc) {
  if (!isMojibake(r.note)) continue;
  const tag = TAG_CN[r.problemTagRef] || r.problemTagRef;
  const stage = r.stageType === 'boss' ? 'Boss' : r.stageType === 'elite' ? '精英' : '普通';
  r.note = `${r.nodeRef} ${stage}关·${tag}主题(${r.templateRef})，压力参照${r.pressureRef}`;
  fixedEnc++;
}
writeJson('battle_encounter_param', enc);

// ---- battle_spawn_param ----
const spawn = readJson('battle_spawn_param');
let fixedSpawn = 0;
for (const r of spawn) {
  if (!isMojibake(r.note)) continue;
  r.note = `${r.encounterRef} 第${r.waveIndex}波：${r.unitStatRef} x${r.count}`;
  fixedSpawn++;
}
writeJson('battle_spawn_param', spawn);

// ---- battle_unit_stat_param（8行，手写更贴切说明）----
const UNIT_NOTES = {
  bu_enemy_backline: '后排炮台型敌人，射程7格，优先躲在后排开火',
  bu_enemy_support: '后排治疗型敌人，奶友方当前最低血量单位',
  bu_enemy_charge: '蓄力冲击型敌人，短路脉冲打断/削弱',
  bu_enemy_summon_source: '召唤源敌人，周期召唤小怪，击杀即停',
  bu_boss_n060: 'n060 海盗大王（SF01群怪Boss，复用海盗系机制放大），占2x2',
  bu_boss_n102: 'n102 废铁泰坦（SF03打后排Boss），占3x2',
  bu_boss_n120: 'n120 母舰指挥官（SF04召唤Boss，复用无人舰系机制放大），占2x3',
  bu_boss_n138: 'n138 污染巨兽（SF05爆发Boss），占3x3',
};
const bu = readJson('battle_unit_stat_param');
let fixedBu = 0;
for (const r of bu) {
  if (!isMojibake(r.note)) continue;
  if (UNIT_NOTES[r.rowId]) { r.note = UNIT_NOTES[r.rowId]; fixedBu++; }
}
writeJson('battle_unit_stat_param', bu);

// ---- battle_boss_phase_param（12行，手写贴合实际effectRefs的说明）----
const PHASE_NOTES = {
  phase_n060_start: '开场先召唤星盗艇铺场(6只)，配合清场弹幕',
  phase_n060_mid: '血量50%：召唤星盗艇加量(8只，累计不超10)+清场弹幕爆发',
  phase_n060_final: '残血：目标易伤，打输出窗口',
  phase_n102_start: '开场先点名标记我方目标',
  phase_n102_mid: '血量50%：打后排重击窗口',
  phase_n102_final: '残血：目标易伤，打输出窗口',
  phase_n120_start: '开场先召唤无人机铺场(6只)',
  phase_n120_mid: '血量50%：转打后排点名(标记+后排重击)',
  phase_n120_final: '残血：召唤无人机加量(8只，累计不超10)兜底',
  phase_n138_start: '开场先放爆发核弹窗口',
  phase_n138_mid: '血量50%：召唤污染体(4只)+爆发核弹+目标易伤叠加',
  phase_n138_final: '残血：爆发核弹收尾',
};
const bp = readJson('battle_boss_phase_param');
let fixedBp = 0;
for (const r of bp) {
  if (!isMojibake(r.note)) continue;
  if (PHASE_NOTES[r.rowId]) { r.note = PHASE_NOTES[r.rowId]; fixedBp++; }
}
writeJson('battle_boss_phase_param', bp);

console.log(`修复完成：encounter ${fixedEnc}, spawn ${fixedSpawn}, unit_stat ${fixedBu}, boss_phase ${fixedBp}`);
