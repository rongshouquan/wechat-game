#!/usr/bin/env node
// ⑩第三段 · 复调实测探针（B5 五态矩阵 / B6 克制 11/11 / B7 悬赏威胁位 / 随机带宽 / 流派图鉴）。
// 入库理由：机制批③（6 深坑核+挂牌项）落地后要按同口径复跑对照——⑥"用完即删"教训不再犯。
// 全部纯内存零回写；敌配一律吃磁盘落数值（战斗尺=终态），B7 例外按 §20.8 规则在内存乘倍率。
//
// 用法：node tools/s7-batch10-probes.mjs <b5|b6|b7|bw|builds> [--samples N]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const CMD = argv[0] ?? 'b5';
const argNum = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
};
const SAMPLES = argNum('samples', 10);

async function loadEntry() {
  const tmp = mkdtempSync(path.join(tmpdir(), 's7-probes-'));
  const outfile = path.join(tmp, 'entry.mjs');
  await build({
    entryPoints: [path.join(HERE, 's7-battles-entry.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile, logLevel: 'silent',
  });
  process.env.S7_GAME_ROOT = path.resolve(HERE, '..');
  const mod = await import(pathToFileURL(outfile).href);
  return { mod, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/** 跑一组：指定节点×自定义阵容×seeds → {win, dur, timeout, probes}。probeFn 可从战报日志抽取证据。 */
async function runSet(mod, base, nodeId, lineup, samples, seedTag, probeFn) {
  const service = new mod.S7BattleRunService();
  const runtime = await mod.S7ConfigRuntime.load(mod.createInMemoryS7TableReader(base));
  let wins = 0; let dur = 0; let timeouts = 0; const probes = [];
  for (let i = 0; i < samples; i += 1) {
    const r = service.run({ runtime, progress: { currentNodeId: nodeId, clearedNodeIds: [] }, runSeed: `${seedTag}-${i}`, lineup, hardControlDiminish: mod.S7_HARD_CONTROL_DIMINISH }); // C14 真值（真机三入口同口径）
    if (r.result.winner === 'player') wins += 1;
    if (r.result.reason === 'timeout') timeouts += 1;
    dur += r.result.durationSec;
    if (probeFn) probes.push(probeFn(r.result));
  }
  return { win: wins / samples, dur: dur / samples, timeout: timeouts / samples, probes };
}
const fmt = (r) => `${(r.win * 100).toFixed(0)}% · ${r.dur.toFixed(1)}s${r.timeout > 0 ? ` · 超时${(r.timeout * 100).toFixed(0)}%` : ''}`;

// ===== B5 · n102 五态验收矩阵（任务单弹药1·工具载体装护卫舰且站前排·中位摆位·战力贴线）=====
async function b5(mod) {
  const base = mod.loadBundle();
  const P = mod.loadPressure()[102];
  const GUARD_TEAM = ['shp05', 'shp06', 'shp01', 'shp09', 'shp13']; // 磐石+铁壁双护卫前排 + 极焰/烈阳双炮 + 晨曦（弹药1 只钉'工具装护卫舰站前排'·输出保留=换掉最低输出的迷雾）
  const SLOTS2 = ['p1c2', 'p0c2', 'p1c1', 'p2c1', 'p1c0'];          // 双前排 c2
  const mk = (pilotMap, ships = GUARD_TEAM, ratio = 1, slots = SLOTS2) =>
    mod.genLineupCustom({ ships, targetTeamPower: P * ratio, slots, pilotMap, coreMap: { [ships[1]]: 'core15' } });
  const aliveProbe = (res) => res.finalState.players.filter((u) => u.alive).length;
  const toolProbe = (res) => ({
    taunt: res.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'taunt').length,
    guard: res.log.some((e) => e.type === 'state_apply' && e.stateTag === 'guard'),
    tauntTargets: [...new Set(res.log.filter((e) => e.type === 'state_apply' && e.stateTag === 'taunt').flatMap((e) => e.targetIds ?? []))],
  });
  console.log(`# B5 · n102 五态矩阵（P=${P}·samples=${SAMPLES}·塔×3 设计密度）`);
  const s1 = await runSet(mod, base, 'n102', mk({ shp05: 'pil05', shp06: 'pil06' }).lineup, SAMPLES, 'b5s1', toolProbe);
  console.log(`① 工具组合（磐石×岩+铁壁×砺）  ：${fmt(s1)} | 嘲讽施加均次 ${(s1.probes.reduce((a, p) => a + p.taunt, 0) / SAMPLES).toFixed(1)} · 咬 ${s1.probes[0].tauntTargets.join('/')}`);
  const s2a = await runSet(mod, base, 'n102', mk({ shp05: 'pil07', shp06: 'pil06' }).lineup, SAMPLES, 'b5s2a');
  console.log(`②a 单件（只砺·磐石换岳）      ：${fmt(s2a)}`);
  const s2b = await runSet(mod, base, 'n102', mk({ shp05: 'pil05', shp06: 'pil07' }).lineup, SAMPLES, 'b5s2b');
  console.log(`②b 单件（只岩·铁壁换岳）      ：${fmt(s2b)}`);
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];
  const s3 = await runSet(mod, base, 'n102', mk({ shp05: 'pil07', shp01: 'pil06', shp09: 'pil05' }, MEDIAN, 1, undefined).lineup, SAMPLES, 'b5s3', toolProbe);
  console.log(`③ 错舰（砺装极焰+岩装烈阳）   ：${fmt(s3)} | 能力真发动：嘲讽 ${s3.probes.every((p) => p.taunt > 0) ? '✓' : '✗'} 守护 ${s3.probes.every((p) => p.guard) ? '✓' : '✗'}`);
  const s3a = await runSet(mod, base, 'n102', mk({ shp05: 'pil07', shp01: 'pil06', shp09: 'pil05' }, MEDIAN, 1, undefined).lineup, SAMPLES, 'b5s3a', (res) => aliveProbe(res));
  console.log(`   ③ 风险度：胜时均存活 ${(s3a.probes.reduce((a, b) => a + b, 0) / s3a.probes.length).toFixed(1)}/5`);
  const TANKS = ['shp05', 'shp06', 'shp07', 'shp08', 'shp13'];
  const s4 = await runSet(mod, base, 'n102', mk({ shp05: 'pil07', shp06: 'pil08', shp07: 'pil16', shp08: 'pil15' }, TANKS).lineup, SAMPLES, 'b5s4');
  console.log(`④ 无双驾堆坦（四坦一奶·无砺岩）：${fmt(s4)}`);
  const s5 = await runSet(mod, base, 'n102', mk({ shp05: 'pil07' }, MEDIAN, 1.5, undefined).lineup, SAMPLES, 'b5s5');
  console.log(`⑤ 硬怼刻度（无工具中位 ×1.5） ：${fmt(s5)}`);
  const s0 = await runSet(mod, base, 'n102', mk({ shp05: 'pil07' }, MEDIAN, 1, undefined).lineup, SAMPLES, 'b5s0');
  console.log(`⑥ 边界：无工具中位 ×1（硬怼贴线）：${fmt(s0)}`);
  const s6 = await runSet(mod, base, 'n102', mk({ shp05: 'pil05', shp01: 'pil06' }, MEDIAN, 1, undefined).lineup, SAMPLES, 'b5s6', (res) => aliveProbe(res));
  console.log(`⑦ 参考：中位体+双工具（磐石岩+极焰砺=③近亲·输出体带工具）：${fmt(s6)} | 胜时均存活 ${(s6.probes.reduce((a, b) => a + b, 0) / s6.probes.length).toFixed(1)}/5`);
}

// ===== B6 · 克制工具箱 11/11（带对工具 vs 中位·samples 贴线·§20.6 口径复测）=====
async function b6(mod) {
  const base = mod.loadBundle();
  const pressure = mod.loadPressure();
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];
  const median = (node, core = 'core08') =>
    mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: pressure[Number(node.slice(1))], coreMap: { shp01: core } }).lineup;
  const custom = (node, ships, opts = {}) =>
    mod.genLineupCustom({ ships, targetTeamPower: pressure[Number(node.slice(1))], ...opts }).lineup;
  const row = async (tag, node, counterLineup, medianCore) => {
    const m = await runSet(mod, base, node, median(node, medianCore), SAMPLES, `b6m-${tag}`);
    const c = await runSet(mod, base, node, counterLineup, SAMPLES, `b6c-${tag}`);
    console.log(`${tag.padEnd(14)} ${node} | 中位 ${fmt(m)} | 克制 ${fmt(c)} | Δ时长 ${(100 * (1 - c.dur / m.dur)).toFixed(0)}%`);
  };
  console.log(`# B6 · 克制工具箱 11/11（samples=${SAMPLES}·贴线）`);
  await row('1数量', 'n037', custom('n037', ['shp05', 'shp10', 'shp09', 'shp12', 'shp13'], { coreMap: { shp10: 'core08' } }));
  await row('2后排输出', 'n097', custom('n097', ['shp05', 'shp02', 'shp09', 'shp04', 'shp13'], { coreMap: { shp02: 'core09' } }));
  await row('3护盾', 'n061', custom('n061', ['shp05', 'shp11', 'shp20', 'shp02', 'shp13'], { slotPlugins: ['plg02', 'plg07', 'plg03'], coreMap: { shp02: 'core09' } })); // 纯盾墙节点 n061（v0.6 22关僵持段实证载体）·破甲件+星鲸
  await row('4高防高血', 'n059', custom('n059', ['shp05', 'shp01', 'shp09', 'shp02', 'shp13'], { pilotMap: { shp01: 'pil20' }, coreMap: { shp01: 'core13' } })); // 真高防载体节点=n059（swarm_tough）·藏破甲上主C+贪吃星滚攻
  await row('5召唤', 'n113', custom('n113', ['shp05', 'shp10', 'shp12', 'shp02', 'shp13'], { pilotMap: { shp02: 'pil18' }, coreMap: { shp10: 'core08' } }));
  await row('6爆发窗口', 'n138', custom('n138', ['shp05', 'shp02', 'shp01', 'shp09', 'shp13'], { slotPlugins: ['plg02', 'plg07', 'plg14'], coreMap: { shp02: 'core15' } })); // 拖时间狂暴题=限时爆发+净化件（带坦拖长=喂狂暴·第一版−25% 实证）
  console.log('7后排点名   n102 | =B5 矩阵（①能破 vs ⑤硬怼与②单件·见 B5 输出）');
  await row('8控制我方', 'n131', custom('n131', ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'], { slotPlugins: ['plg02', 'plg07', 'plg06'], coreMap: { shp01: 'core14' } })); // 中位体+韧性件+守护铃（换山岳拖输出=第一版−11% 实证）
  await row('9敌方治疗', 'n093', custom('n093', ['shp05', 'shp02', 'shp04', 'shp09', 'shp13'], { coreMap: { shp02: 'core09' } }));
  // 10 削弱我方：主线未布磁暴塔（载体在库=B7 悬赏上场）——合成探针：n075 阵中一席换磁暴塔（同伴量纲）。
  {
    const b10 = clone(base);
    const units = b10.battle_unit_stat_param;
    const peer = units.find((r) => r.rowId === 'bu_n075_shield');
    const tower = units.find((r) => r.rowId === 'bu_enemy_stormtower');
    Object.assign(tower, { maxHp: Math.round(peer.maxHp * 0.7), attack: Math.round(peer.attack * 0.5), armor: 12 });
    const sp = b10.battle_spawn_param.find((r) => r.rowId === 'spawn_n075_w2') ?? b10.battle_spawn_param.find((r) => String(r.rowId).startsWith('spawn_n075'));
    const enc = b10.battle_encounter_param.find((r) => r.nodeRef === 'n075');
    sp.unitStatRef = 'bu_enemy_stormtower';
    if (Array.isArray(sp.slotRefs) && sp.slotRefs.length >= 2) { /* 密度=2 塔（第一版单塔削弱不痛=1%·加重减速覆盖） */ } else { sp.count = sp.count; }
    if (!enc.enemyUnitStatRefs.includes('bu_enemy_stormtower')) enc.enemyUnitStatRefs.push('bu_enemy_stormtower');
    const m = await runSet(mod, b10, 'n075', median('n075'), SAMPLES, 'b6m-10');
    const c = await runSet(mod, b10, 'n075', custom('n075', ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'], { slotPlugins: ['plg02', 'plg07', 'plg14'], coreMap: { shp01: 'core08' } }), SAMPLES, 'b6c-10'); // 中位体+净化件（换奶舰=拖慢·第一版−15% 实证）
    console.log(`10削弱(合成)  n075+磁暴塔 | 中位 ${fmt(m)} | 净化向(春风+净化件) ${fmt(c)} | Δ时长 ${(100 * (1 - c.dur / m.dur)).toFixed(0)}%`);
  }
  await row('11Boss狂暴', 'n145', custom('n145', ['shp05', 'shp02', 'shp01', 'shp09', 'shp13'], { coreMap: { shp02: 'core15' } }));
}

// ===== B7 · 悬赏威胁位四档（§20.8 规则：倍率乘压力走 φ·困难+1/噩梦+2 从威胁库抽）=====
async function b7(mod) {
  const NODE = 'n075';
  const num = 75;
  const base = mod.loadBundle();
  const P = mod.loadPressure()[num];
  const LIB = ['bu_enemy_charge', 'bu_enemy_backline', 'bu_enemy_summon_source', 'bu_enemy_pollution'];
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];
  const player = mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: P, coreMap: { shp01: 'core08' } }).lineup; // 玩家=贴线中位（§20.8 实测口径）
  console.log(`# B7 · 悬赏威胁位四档（基底 ${NODE}·P=${P}·玩家=贴线中位·samples=${SAMPLES}·威胁库=控制/点名/召唤/爆发窗口(⑩新)）`);
  for (const [tier, mult, threats] of [['新手', 0.7, 0], ['普通', 1.0, 0], ['困难', 1.5, 1], ['噩梦', 2.2, 2]]) {
    const b = clone(base);
    const scale = mod.mapPressureToEnemies(b, NODE, P * mult);
    const units = b.battle_unit_stat_param;
    for (const [rowId, attrs] of Object.entries(scale.units)) {
      const r = units.find((x) => x.rowId === rowId);
      if (r) Object.assign(r, attrs);
    }
    // 威胁位：替换基底阵中等权重敌位（shield 一席→威胁单位·同量纲=池份额继承被换行值）
    const spawns = b.battle_spawn_param.filter((s) => String(s.rowId).startsWith(`spawn_${NODE}`));
    const enc = b.battle_encounter_param.find((r) => r.nodeRef === NODE);
    for (let t = 0; t < threats; t += 1) {
      const threatRow = LIB[(num + t) % LIB.length]; // 抽取=节点号+序（确定性·不重复）
      const sp = spawns[Math.min(t, spawns.length - 1)];
      const donor = units.find((x) => x.rowId === sp.unitStatRef);
      const tr = units.find((x) => x.rowId === threatRow);
      // 等效厚度换算（§19.2）：盾卫等 effHpMult 职业的'第二条血'要折进替换单位——否则威胁位替换=变薄变快（首版'困难<普通'倒挂实证）。
      const donorKey = donor.rowId.replace(/^bu_n[0-9]+_/, 'bu_enemy_').replace(/_(add|sadd)$/, '_boss_add');
      const donorEff = (mod.ROLE_SHAPE[donorKey] && mod.ROLE_SHAPE[donorKey].effHpMult) || 1;
      const threatEff = (mod.ROLE_SHAPE[threatRow] && mod.ROLE_SHAPE[threatRow].effHpMult) || 1;
      Object.assign(tr, { maxHp: Math.round(donor.maxHp * donorEff / threatEff), attack: donor.attack, armor: tr.armor, attackIntervalSec: tr.attackIntervalSec });
      sp.unitStatRef = threatRow;
      if (!enc.enemyUnitStatRefs.includes(threatRow)) enc.enemyUnitStatRefs.push(threatRow);
    }
    const r = await runSet(mod, b, NODE, player, SAMPLES, `b7-${tier}`);
    console.log(`${tier} ×${mult}${threats ? `+威胁${threats}` : ''}：${fmt(r)}`);
    if (tier === '噩梦') {
      const tooled = mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: P, coreMap: { shp01: 'core14' }, slotPlugins: ['plg02', 'plg07', 'plg06'] }).lineup; // 守护铃+韧性件（#8 正名舞台=威胁位有控制时）
      const purified = mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: P, coreMap: { shp01: 'core08' }, slotPlugins: ['plg02', 'plg07', 'plg14'] }).lineup; // 净化件（#10 正名舞台=威胁位有污染体时）
      const rt2 = await runSet(mod, b, NODE, tooled, SAMPLES, 'b7-nm-resist');
      const rp2 = await runSet(mod, b, NODE, purified, SAMPLES, 'b7-nm-purify');
      console.log(`  ↳ 噩梦+抗控向（守护铃+韧性）：${fmt(rt2)} | 净化向（净化件）：${fmt(rp2)}（#8/#10 克制价值舞台=威胁位场景）`);
    }
  }
}

// ===== 随机带宽（弹药5：战力→胜率坡·窄/中两档·对称锚·五五开点）=====
async function bw(mod) {
  const base = mod.loadBundle();
  const pressure = mod.loadPressure();
  const MEDIAN = ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'];
  // 两档旋钮：窄=现行（暴击5%/×1.5·敌0%）；中=暴击15%/×1.75+敌暴击10%/×1.5（随机源=弹药5 点名四旋钮的实测组合）
  const KNOBS = [
    ['窄档(现行)', { crit: 0.05, critDmg: 0.5, enemyCrit: 0 }],
    ['中档(候选)', { crit: 0.15, critDmg: 0.75, enemyCrit: 0.10 }],
  ];
  const CLIFFS = [['n060', [0.40, 0.45, 0.5, 0.525, 0.55, 0.575, 0.6, 0.65, 0.7]], ['n120', [0.70, 0.75, 0.775, 0.8, 0.825, 0.85, 0.9]], ['n097', [0.45, 0.6, 0.8, 1.0]]];
  for (const [tag, k] of KNOBS) {
    console.log(`# 随机带宽 · ${tag}：我方暴击 ${k.crit * 100}%/×${1 + k.critDmg} · 敌暴击 ${k.enemyCrit * 100}%`);
    for (const [node, ratios] of CLIFFS) {
      const num = Number(node.slice(1));
      const b = clone(base);
      if (k.enemyCrit > 0) for (const r of b.battle_unit_stat_param) { if (r.targetType !== 'ship') r.baseCritRate = k.enemyCrit; }
      const cells = [];
      for (const ratio of ratios) {
        const lp = mod.genLineupCustom({ ships: MEDIAN, targetTeamPower: pressure[num] * ratio, coreMap: { shp01: num === 60 || num === 120 ? 'core15' : 'core08' } });
        for (const u of lp.lineup) {
          u.extraBlocks = (u.extraBlocks ?? []).map((bk) => (bk.source === 'crit_base' ? { ...bk, value: bk.affix === 'critRate' ? k.crit : k.critDmg } : bk));
        }
        const r = await runSet(mod, b, node, lp.lineup, SAMPLES, `bw-${tag}-${node}-${ratio}`);
        cells.push(`×${ratio}=${(r.win * 100).toFixed(0)}%`);
      }
      console.log(`${node}: ${cells.join(' ')}`);
    }
  }
}

// ===== 流派图鉴 v0（六流派 × 三场景：平推 n055 / 墙 n120 / 各自克制场）=====
async function builds(mod) {
  const base = mod.loadBundle();
  const pressure = mod.loadPressure();
  const BUILDS = [
    ['闪避坦', { ships: ['shp05', 'shp06', 'shp01', 'shp09', 'shp13'], slotPlugins: ['plg02', 'plg07', 'plg15'], coreMap: { shp01: 'core08' } }, 'n102'],
    ['反弹流', { ships: ['shp06', 'shp05', 'shp01', 'shp09', 'shp13'], pilotMap: { shp06: 'pil07', shp05: 'pil05' }, slotPlugins: ['plg02', 'plg07', 'plg16'], coreMap: { shp01: 'core08' } }, 'n102'], // v2：铁壁怒吼(舰载区域嘲讽)×岳荆甲=把火拉进反弹甲+磐石岩守护
    ['嘲讽歪坦', { ships: ['shp08', 'shp01', 'shp09', 'shp17', 'shp13'], pilotMap: { shp08: 'pil06' }, slotPlugins: ['plg02', 'plg07', 'plg05'], coreMap: { shp01: 'core08' } }, 'n060'], // 歪坦主场=单点 Boss（嘲讽拉锤上高甲山岳）
    ['燃烧叠层', { ships: ['shp05', 'shp11', 'shp10', 'shp01', 'shp13'], pilotMap: { shp11: 'pil01' }, coreMap: { shp11: 'core08' } }, 'n059'],
    ['召唤海', { ships: ['shp05', 'shp18', 'shp19', 'shp09', 'shp13'], pilotMap: { shp18: 'pil19' }, coreMap: { shp18: 'core09' } }, 'n102'], // 召唤海主场候补=尖峰关（召唤物身体吸塔火）
    ['处决收割', { ships: ['shp05', 'shp02', 'shp03', 'shp01', 'shp13'], pilotMap: { shp03: 'pil03' }, coreMap: { shp02: 'core13' } }, 'n130'],
  ];
  const SCENES = (counterNode) => [['平推', 'n055'], ['墙', 'n120'], ['克制场', counterNode]];
  console.log(`# 流派图鉴 v0 · 六流派三场景（samples=${SAMPLES}·贴线；对照=中位队）`);
  for (const [scene, node] of [['平推', 'n055'], ['墙', 'n120']]) {
    const P = pressure[Number(node.slice(1))];
    const m = await runSet(mod, base, node, mod.genLineupCustom({ ships: ['shp05', 'shp01', 'shp09', 'shp17', 'shp13'], targetTeamPower: P, coreMap: { shp01: node === 'n120' ? 'core15' : 'core08' } }).lineup, SAMPLES, `bl-m-${node}`);
    console.log(`【中位对照·${scene} ${node}】${fmt(m)}`);
  }
  for (const [name, opts, counterNode] of BUILDS) {
    const cells = [];
    for (const [scene, node] of SCENES(counterNode)) {
      const P = pressure[Number(node.slice(1))];
      const lineup = mod.genLineupCustom({ ...opts, targetTeamPower: P }).lineup;
      const r = await runSet(mod, base, node, lineup, SAMPLES, `bl-${name}-${node}`);
      cells.push(`${scene}${node} ${fmt(r)}`);
    }
    console.log(`${name.padEnd(6)}：${cells.join(' | ')}`);
  }
}

async function run() {
  const { mod, cleanup } = await loadEntry();
  try {
    if (CMD === 'b5') await b5(mod);
    else if (CMD === 'b6') await b6(mod);
    else if (CMD === 'b7') await b7(mod);
    else if (CMD === 'bw') await bw(mod);
    else if (CMD === 'builds') await builds(mod);
    else console.log('用法: node tools/s7-batch10-probes.mjs <b5|b6|b7|bw|builds> [--samples N]');
  } finally {
    cleanup();
  }
}
run().catch((e) => { console.error('[s7-batch10-probes] 失败：', e); process.exitCode = 1; });
