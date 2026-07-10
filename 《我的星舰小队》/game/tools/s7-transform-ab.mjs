#!/usr/bin/env node
// 机制批③段三 · 复测⑧「质变前后对比」实测行（质变体感铁律：体感必须≥文字描述——样板=S阶回打提速26%）。
// 每件跑 A(无/前档) vs B(有/后档) 同场景同种子对照：时长/胜率/签名事件数。
// 覆盖：6 深坑核（core17-22）+ 晚成SS两件（霹雳SS/甘霖SS）+ 顺路升级三条（烬5★破半/藏5★碎裂/沧Lv1驰援）。
// 用法：node tools/s7-transform-ab.mjs [--samples N]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argNum = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
};
const SAMPLES = argNum('samples', 8);

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-ab-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

async function run() {
  const { mod, cleanup } = await loadEntry();
  try {
    const base = mod.loadBundle();
    const pressure = mod.loadPressure();
    const service = new mod.S7BattleRunService();
    const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(base));
    const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp11', 'shp13'];

    const runSet = (nodeId, lineup, tag, sig) => {
      let wins = 0; let dur = 0; const sigs = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        const r = service.run({ runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] }, runSeed: `ab-${tag}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH });
        if (r.result.winner === 'player') wins += 1;
        dur += r.result.durationSec;
        if (sig) sigs.push(sig(r.result));
      }
      return { win: wins / SAMPLES, dur: dur / SAMPLES, sig: sigs.length ? (sigs.reduce((a, b) => a + b, 0) / sigs.length).toFixed(1) : '-' };
    };
    const fmt = (r) => `${(r.win * 100).toFixed(0)}%/${r.dur.toFixed(1)}s`;
    const row = (name, a, b, sigName) => console.log(
      `${name.padEnd(14)} | 前 ${fmt(a)} | 后 ${fmt(b)} | Δ时长 ${(100 * (1 - b.dur / a.dur)).toFixed(0)}%${sigName ? ` | ${sigName}=${b.sig}（前 ${a.sig}）` : ''}`);

    console.log(`# 复测⑧ 质变前后对比（samples=${SAMPLES}·中位体贴线·同种子族）`);

    // ===== 6 深坑核：中位体 @n075（普通关）·主输出位装核 vs 无核 =====
    const NODE = 'n075';
    const P = pressure[75];
    const mk = (coreId, extraShips) => {
      const l = mod.genLineupCustom({ ships: extraShips ?? MEDIAN, targetTeamPower: P, ...(coreId ? { coreMap: { [(extraShips ?? MEDIAN)[1]]: coreId } } : {}) }).lineup;
      return l;
    };
    const CORES = [
      ['core17 曲率星门', 'rank_swap', (res) => res.log.filter((e) => e.type === 'rank_swap').length],
      ['core18 共鸣音叉', null, null],
      ['core19 引力阱', null, null],
      ['core20 彩虹棱镜', null, null],
      ['core21 幸运扭蛋', 'core_gacha', (res) => res.log.filter((e) => e.type === 'core_gacha').length],
      ['core22 全息镜', 'summon', (res) => res.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'summon' && e.side === 'player').length],
    ];
    const noCore = runSet(NODE, mk(null), 'nocore');
    for (const [label, sigName, sigFn] of CORES) {
      const coreId = label.slice(0, 6);
      if (coreId === 'core22') continue; // 全息镜=CD22 长仗核·单独在 n120 Boss 场景对照（常规 30s 仗只赶上尾巴）
      const b = runSet(NODE, mk(coreId), coreId, sigFn);
      const a = sigFn ? { ...noCore, sig: '0.0' } : noCore;
      row(label, a, b, sigName);
    }
    {
      const P120 = pressure[120];
      const mk120 = (coreId) => mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: P120 * 1.35, ...(coreId ? { coreMap: { [MEDIAN[1]]: coreId } } : {}) }).lineup;
      const sigHolo = (res) => res.finalState.players.filter((u) => u.unitStatRef === 'bu_s7_hologram').length;
      const a = runSet('n120', mk120(null), 'holo-a');
      const b = runSet('n120', mk120('core22'), 'holo-b', sigHolo);
      row('core22 全息镜@长仗', { ...a, sig: '0.0' }, b, '分身在场数');
    }

    // ===== 晚成 SS：载具队 S阶 vs SS阶（其余不变·shipTier 逐单位覆写）=====
    const tierSwap = (ships, targetShip, tier, pilotStar) => {
      const l = mod.genLineupCustom({ ships, targetTeamPower: P, coreMap: { [ships[1]]: 'core08' } }).lineup;
      for (const u of l) {
        if (u.shipId === targetShip) {
          u.shipTier = tier;
          if (pilotStar !== undefined) u.pilotStar = pilotStar;
        }
      }
      return l;
    };
    const PILI = ['shp05', 'shp12', 'shp09', 'shp01', 'shp13'];
    row('霹雳SS 引爆短路', runSet(NODE, tierSwap(PILI, 'shp12', 3), 'pili-s'),
      runSet(NODE, tierSwap(PILI, 'shp12', 4), 'pili-ss', (res) => res.log.filter((e) => e.type === 'damage' && e.effectRef === 'eff_s7_liansuo_ss_boom').length), '引爆结算数');
    const GANLIN = ['shp05', 'shp01', 'shp09', 'shp15', 'shp13'];
    row('甘霖SS 复活', runSet(NODE, tierSwap(GANLIN, 'shp15', 3), 'gl-s'),
      runSet(NODE, tierSwap(GANLIN, 'shp15', 4), 'gl-ss', (res) => res.log.filter((e) => e.type === 'revive').length), '复活事件');

    // ===== 顺路升级三条：星级/等级门 A/B =====
    const starSwap = (ships, targetShip, pilotId, star) => {
      const l = mod.genLineupCustom({ ships, targetTeamPower: P, pilotMap: { [targetShip]: pilotId }, coreMap: { [ships[1]]: 'core08' } }).lineup;
      for (const u of l) if (u.shipId === targetShip) u.pilotStar = star;
      return l;
    };
    const JIN = ['shp05', 'shp01', 'shp09', 'shp02', 'shp13'];
    row('烬5★ 贪婪破半', runSet(NODE, starSwap(JIN, 'shp02', 'pil10', 4), 'jin-4'),
      runSet(NODE, starSwap(JIN, 'shp02', 'pil10', 5), 'jin-5', (res) => res.log.filter((e) => e.type === 'damage' && String(e.note ?? '').includes('half_break')).length), '破半结算数');
    row('藏5★ 装甲碎裂', runSet('n059', starSwap(JIN, 'shp02', 'pil20', 4), 'cang-4'),
      runSet('n059', starSwap(JIN, 'shp02', 'pil20', 5), 'cang-5', (res) => res.log.filter((e) => e.type === 'state_apply' && e.effectRef === 'eff_pil_cang20_shatter').length), '碎裂施加数');
    const CANG = ['shp05', 'shp01', 'shp09', 'shp02', 'shp13'];
    const cangSwap = (lv) => {
      const l = mod.genLineupCustom({ ships: CANG, targetTeamPower: P, pilotMap: { shp05: 'pil08' }, coreMap: { shp01: 'core08' } }).lineup;
      for (const u of l) if (u.shipId === 'shp05') u.pilotLevel = lv;
      return l;
    };
    row('沧Lv1 驰援', runSet(NODE, cangSwap(0), 'cang-lv0'),
      runSet(NODE, cangSwap(1), 'cang-lv1', (res) => res.log.filter((e) => e.type === 'state_apply' && e.effectRef === 'eff_pil_cang08_rescue_shield').length), '驰援触发数');
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-transform-ab] 失败：', e); process.exitCode = 1; });
