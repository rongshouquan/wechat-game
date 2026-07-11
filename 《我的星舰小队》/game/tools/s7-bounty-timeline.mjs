#!/usr/bin/env node
// 对锚与阶梯批 · 悬赏时间线（Ron 拍板13：只测算出表·不改任何悬赏数值——倍率 vs 奖励候 Ron 拍）。
// 问题：按正常养成节奏，各档玩家"第几天碾得动"困难(×1.5·+1威胁位)/噩梦(×2.2·+2威胁位)？
// 口径（表头声明·总控 07-10 回执）：
//   碾得动 = 单把胜率 ≥95%（samples≥20）且平均时长 ≤18s（碾压门槛=手感靶 1.8× 口径）；
//   能过线 = 单把胜率 ≥20%（Ron 拍定·墙口径章同源）——一并出表做判读前置；
//   悬赏基底=已通关最高星域的首个战斗节点（S7StarportBounty 灰盒规则·滞后内容）；
//   敌配=mapPressureToEnemies(基底, P×倍率)+威胁位替换（§20.8/B7 同机制）；
//   玩家=经济尺当日真实养成态（dailyMains·同爬坡矩阵口径）。
// 用法：node tools/s7-bounty-timeline.mjs [--samples N] [--tier 普通]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const SAMPLES = Number(argStr('samples', '20'));
const TIERS = argStr('tier', '肝档,重度,普通,轻度').split(',');

const SF_SPANS = [[1, 60], [61, 84], [85, 102], [103, 120], [121, 138], [139, 150]];
const THREAT_LIB = ['bu_enemy_charge', 'bu_enemy_backline', 'bu_enemy_summon_source', 'bu_enemy_pollution'];

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-bounty-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** 悬赏基底节点（灰盒规则复刻）：已通关最高星域的首个战斗节点；档 0 → n001。 */
function bountyNodeOf(cleared, encounterNodes) {
  let tier = 0;
  for (let i = 0; i < SF_SPANS.length; i += 1) if (cleared >= SF_SPANS[i][1]) tier = i + 1;
  const span = SF_SPANS[Math.max(0, tier - 1)];
  for (let n = span[0]; n <= span[1]; n += 1) {
    const id = `n${String(n).padStart(3, '0')}`;
    if (encounterNodes.has(id)) return { id, num: n };
  }
  return { id: 'n001', num: 1 };
}

/** B7 机制复刻：基底按 P×倍率重映射 + 威胁位替换（等效厚度换算·确定性抽取）。 */
function buildBountyBundle(mod, base, nodeId, num, pressureVal, mult, threats) {
  const b = clone(base);
  const scale = mod.mapPressureToEnemies(b, nodeId, pressureVal * mult);
  const units = b.battle_unit_stat_param;
  for (const [rowId, attrs] of Object.entries(scale.units)) {
    const r = units.find((x) => x.rowId === rowId);
    if (r) Object.assign(r, attrs);
  }
  const spawns = b.battle_spawn_param.filter((s) => String(s.rowId).startsWith(`spawn_${nodeId}`));
  const enc = b.battle_encounter_param.find((r) => r.nodeRef === nodeId);
  for (let t = 0; t < threats && spawns.length > 0; t += 1) {
    const threatRow = THREAT_LIB[(num + t) % THREAT_LIB.length];
    const sp = spawns[Math.min(t, spawns.length - 1)];
    const donor = units.find((x) => x.rowId === sp.unitStatRef);
    const tr = units.find((x) => x.rowId === threatRow);
    if (!donor || !tr) continue;
    const donorKey = donor.rowId.replace(/^bu_n[0-9]+_/, 'bu_enemy_').replace(/_(add|sadd)$/, '_boss_add');
    const donorEff = (mod.ROLE_SHAPE[donorKey] && mod.ROLE_SHAPE[donorKey].effHpMult) || 1;
    const threatEff = (mod.ROLE_SHAPE[threatRow] && mod.ROLE_SHAPE[threatRow].effHpMult) || 1;
    Object.assign(tr, { maxHp: Math.round(donor.maxHp * donorEff / threatEff), attack: donor.attack });
    sp.unitStatRef = threatRow;
    if (!enc.enemyUnitStatRefs.includes(threatRow)) enc.enemyUnitStatRefs.push(threatRow);
  }
  return b;
}

async function run() {
  const eco = await import(pathToFileURL(path.join(HERE, 'simulate-s7-economy.mjs')).href);
  const { mod, cleanup } = await loadEntry();
  try {
    const { pressure } = eco.calibratePressure();
    const base = mod.loadBundle();
    const encounterNodes = new Set(base.battle_encounter_param.map((e) => e.nodeRef));
    const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];
    const service = new mod.S7BattleRunService();

    const measure = async (mains, nodeId, num, mult, threats, tag) => {
      const b = buildBountyBundle(mod, base, nodeId, num, pressure[num], mult, threats);
      const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(b));
      const m = mains.slice();
      const arranged = [m[1] ?? m[0], m[0], m[2] ?? m[0], m[3] ?? m[0], m[4] ?? m[0]];
      const coreId = arranged.some(([t]) => t === 3 || t === 4 || t === 'S' || t === 'SS') ? 'core08' : undefined;
      const { lineup } = mod.genLineupFromMains({ ships: MEDIAN, mains: arranged, coreId });
      let wins = 0; let dur = 0;
      for (let i = 0; i < SAMPLES; i += 1) {
        const r = service.run({ runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] }, runSeed: `bt-${tag}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH });
        if (r.result.winner === 'player') wins += 1;
        dur += r.result.durationSec;
      }
      return { win: (wins / SAMPLES) * 100, dur: dur / SAMPLES };
    };

    console.log(`# 悬赏时间线（samples=${SAMPLES}·碾得动=胜率≥95%且时长≤18s·能过线=胜率≥20%·玩家=当日真实养成态）`);
    for (const tier of TIERS) {
      const r = eco.simulateEconomyTier(tier, pressure, { envelope: 'expected', runFullDays: true });
      const grad = r.graduateDay ?? r.dailyCleared.length;
      console.log(`\n## ${tier}（毕业 D${grad}）`);
      for (const [label, mult, threats] of [['困难×1.5+威胁1', 1.5, 1], ['噩梦×2.2+威胁2', 2.2, 2]]) {
        let firstPass = null; let firstCrush = null; let lastRead = '';
        let cum = 0; let day = 0; const cumByDay = [];
        for (const c of r.dailyCleared) { cum += c; cumByDay.push(cum); }
        for (let d = 2; d <= grad; d += 2) {
          const mains = r.dailyMains[d - 1];
          if (!mains) continue;
          const { id, num } = bountyNodeOf(cumByDay[d - 1] ?? 0, encounterNodes);
          const m = await measure(mains, id, num, mult, threats, `${tier}-${label}-${d}`);
          lastRead = `D${d}@${id} ${m.win.toFixed(0)}%/${m.dur.toFixed(1)}s`;
          if (firstPass === null && m.win >= 20) firstPass = `D${d}（${m.win.toFixed(0)}%@${id}）`;
          if (m.win >= 95 && m.dur <= 18) { firstCrush = `D${d}（${m.win.toFixed(0)}%/${m.dur.toFixed(1)}s@${id}）`; break; }
          day = d;
        }
        console.log(`${label}: 首过线 ${firstPass ?? '毕业前未过线'} · 首碾 ${firstCrush ?? `毕业前未达碾压（末测 ${lastRead}）`}`);
      }
    }
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-bounty-timeline] 失败：', e); process.exitCode = 1; });
