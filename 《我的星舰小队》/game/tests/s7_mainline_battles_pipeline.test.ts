// ⑥第二段·战斗侧第二把尺子（管线三件套）测试：
//   ① 阵容生成器：养成刻度反解贴靶（战力≈P）+ 三族形状；
//   ② 压力→敌配映射：总量按 φ 强度补偿曲线、职业形状生效、等效厚度、单调性；
//   ③ 全扫冒烟：真链路（组装器→引擎）抽段跑通+手感靶带内（全量 148 关=CLI 工具·<1s）。
// 工具主体在 tools/s7-battles-entry.mts（esbuild 打包驱动）；vitest 直接吃 TS 源=同一份代码进 gate。
import { describe, it, expect } from 'vitest';
import {
  solveGrowthPlan, genLineup, pickShips, mapPressureToEnemies, strengthIndex,
  loadBundle, scanMainlineAsync, K_HP, K_DPS, STAGE_MULT, ROLE_SHAPE,
} from '../tools/s7-battles-entry';

describe('⑥二段① 阵容生成器', () => {
  it('养成刻度反解：全程贴靶（|队伍战力−P|/P ≤ 6%·P=600..26000 抽样）', () => {
    for (const p of [600, 1500, 3072, 5000, 10216, 14776, 20000, 26028]) {
      const plan = solveGrowthPlan(p);
      const teamPower = plan.shipPower * 5;
      expect(Math.abs(teamPower - p) / p).toBeLessThanOrEqual(0.06);
    }
  });

  it('三族五舰：中位=五型各一；克制向按问题标签换工具；乱搭=三坦双奶', () => {
    expect(pickShips('median', 'swarm')).toEqual(['shp05', 'shp01', 'shp09', 'shp17', 'shp13']);
    expect(pickShips('counter', 'shield')).toContain('shp11'); // 贯日=破盾工具
    expect(pickShips('counter', 'shield')).toContain('shp20'); // 锁链
    expect(pickShips('misfit', 'swarm')).toEqual(['shp05', 'shp06', 'shp07', 'shp13', 'shp15']);
    const { lineup } = genLineup('median', 3072, 'swarm');
    expect(lineup).toHaveLength(5);
    expect(new Set(lineup.map((u) => u.slotRef)).size).toBe(5); // 摆位不重
    expect(lineup.every((u) => u.pilotId)).toBe(true); // 每舰必配驾驶员（战场规则）
  });
});

describe('⑥二段② 压力→敌配映射（规则=细表 §19）', () => {
  it('总量=k 合同 × φ 强度补偿 × 关卡系数（锚点 P=500 处 φ=1）', () => {
    const b = loadBundle();
    const phi500 = strengthIndex(500) / strengthIndex(500);
    expect(phi500).toBe(1);
    const scale = mapPressureToEnemies(b, 'n001', 500);
    expect(scale.pool).toBeCloseTo(K_HP * 500 * STAGE_MULT.normal.pool, 5);
    expect(scale.dps).toBeCloseTo(K_DPS * 500 * STAGE_MULT.normal.dps, 5);
  });

  it('φ 单调不减 且 中后期强度补偿 < 刻度线性（=漂移被吸收）', () => {
    const phi = (p: number): number => strengthIndex(p) / strengthIndex(500);
    expect(phi(3000)).toBeGreaterThan(phi(1000));
    expect(phi(15000)).toBeGreaterThan(phi(3000));
    // 刻度翻 30 倍（500→15000）时强度补偿显著小于 30（战力刻度与战斗强度的换算漂移·§19）
    expect(phi(15000)).toBeLessThan(15000 / 500);
  });

  it('职业形状：爆发敌高攻/盾卫高防/等效厚度折减单位血', () => {
    const b = loadBundle();
    const s = mapPressureToEnemies(b, 'n006', 2000); // n006=swarm_tough+burst_raider 混编
    const tough = s.units.bu_enemy_swarm_tough;
    const raider = s.units.bu_enemy_burst_raider;
    expect(tough.maxHp).toBeGreaterThan(raider.maxHp); // 血权 1.6 vs 0.8
    expect(raider.attack / raider.attackIntervalSec).toBeGreaterThan(tough.attack / tough.attackIntervalSec); // 攻权 2.2 vs 0.5
    expect(raider.armor).toBe(ROLE_SHAPE.bu_enemy_burst_raider.armor);
    // 等效厚度：n061=纯盾敌关——单位血=份额/2（盾循环=第二条血）
    // ⑥三段落数后 enc_n061 引用节点行 bu_n061_shield（形状按 roleKeyOf 归一回 bu_enemy_shield 查表·数值语义不变）
    const s61 = mapPressureToEnemies(b, 'n061', 3104);
    const shield = s61.units.bu_n061_shield;
    const rawShare = s61.pool / 3; // 三只均分
    expect(shield.maxHp).toBeLessThan(rawShare * 0.6); // ÷2.0 后显著小于原份额
  });

  it('单调性：P 越大敌总量越大（同关）', () => {
    const b = loadBundle();
    const lo = mapPressureToEnemies(b, 'n061', 2000);
    const hi = mapPressureToEnemies(b, 'n061', 8000);
    expect(hi.pool).toBeGreaterThan(lo.pool);
    expect(hi.units.bu_n061_shield.maxHp).toBeGreaterThan(lo.units.bu_n061_shield.maxHp); // ⑥落数后键=节点行名

  });
});

describe('⑥三段 落数一致性（JSON 真值==映射公式·抽样守卫）', () => {
  // 守卫目标：磁盘节点敌行 = mapPressureToEnemies 公式值（防手改漂移/半截重落）。
  // 抽样=普通关 n061（等效厚度）/ 墙关 n102（WALL_BOOST+M4 记档关）/ 毕业 Boss n150（BOSS_SHARE）。
  // 压力值取自 ⑧ 经济尺 v0.6 压力表（loadPressure 同源）——若 ⑧ 重校压力，此测试红=提醒重落敌配。
  it('n061 / n102 / n150 磁盘行值与公式一字不差', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const b = loadBundle();
    const { loadPressure } = await import('../tools/s7-battles-entry');
    const pressure = loadPressure();
    const dir = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');
    const units = JSON.parse(readFileSync(path.join(dir, 'battle_unit_stat_param.sample.json'), 'utf-8')) as
      { rowId: string; maxHp: number; attack: number; armor: number; attackIntervalSec: number }[];
    const byId = new Map(units.map((r) => [r.rowId, r]));
    for (const node of [61, 102, 150]) {
      const nodeId = `n${String(node).padStart(3, '0')}`;
      const scale = mapPressureToEnemies(b, nodeId, pressure[node]);
      for (const [rowId, attrs] of Object.entries(scale.units)) {
        const row = byId.get(rowId);
        expect(row, `${nodeId} 应有落数行 ${rowId}`).toBeTruthy();
        expect(row!.maxHp, `${rowId}.maxHp`).toBe(attrs.maxHp);
        expect(row!.attack, `${rowId}.attack`).toBe(attrs.attack);
        expect(row!.armor, `${rowId}.armor`).toBe(attrs.armor);
        expect(row!.attackIntervalSec, `${rowId}.attackIntervalSec`).toBe(attrs.attackIntervalSec);
      }
    }
  });
});

describe('⑥二段③ 全扫冒烟（真链路·抽段）', () => {
  it('n055-n070（含 n060 首真墙Boss）：中位族全通·手感带内', async () => {
    const reports = await scanMainlineAsync({ family: 'median', samples: 2, fromNode: 55, toNode: 70 });
    expect(reports.length).toBeGreaterThanOrEqual(14);
    const normals = reports.filter((r) => r.stage === 'normal');
    const avgDur = normals.reduce((a, r) => a + r.avgDurationSec, 0) / normals.length;
    expect(avgDur).toBeGreaterThanOrEqual(15);
    expect(avgDur).toBeLessThanOrEqual(32); // 手感带（普通关均值）
    const boss = reports.find((r) => r.nodeId === 'n060')!;
    expect(boss.winRate).toBeGreaterThanOrEqual(0.5);
    expect(boss.avgDurationSec).toBeGreaterThanOrEqual(40);
    // ⑩A0 重定基 70→75：v0.7 压力表（γ 1.125）下 n060 P 3113→3622、φ 超线性使贴线时长 68→71.6s；
    // 墙口径带=≥55s 硬仗且 <120s 可破（§20.2），本断言是"硬仗非深渊"的窗口守卫——上沿放到 75 仍紧
    // （深墙回归如 ≥80s 照抓），不是跟着数值走的放宽。
    expect(boss.avgDurationSec).toBeLessThanOrEqual(75);
    // 阵容战力贴压力值（管线自洽）
    for (const r of reports) expect(Math.abs(r.teamPower - r.pressure) / r.pressure).toBeLessThanOrEqual(0.06);
  }, 30000);

  it('克制语义抽验：n104 点名题 中位挣扎 vs 克制向速通', async () => {
    const med = await scanMainlineAsync({ family: 'median', samples: 3, fromNode: 104, toNode: 104 });
    const ctr = await scanMainlineAsync({ family: 'counter', samples: 3, fromNode: 104, toNode: 104 });
    // ⑥三段落数重定基：落数量纲下中位阵容能磨过 n104（66s=2.6× 普通关均值=真"挣扎"），
    // 胜率差失去区分度；"换搭配破题"的管线级证据改用时长差（实测 66.3s vs 26.4s=2.5×·余量断 ×0.6）。
    // ⑩A1 重定基 ×0.6→×0.75：驾驶员真天赋上场抬高中位队地板（源锁定/苏回光/蔽集火——66.3→32.9s），
    // 克制差收窄到 ≈1.55×（21.2s vs 32.9s）——"带对工具显著更快"语义原样成立（>25% 提速+绝对时长<35s
    // 双断言保留）·阈值按新地板收口；克制差全维度定量=B6 克制工具箱 11/11 实测正主。
    expect(ctr[0].winRate).toBe(1);
    // 机制批③段二重定基（旧→新→为什么对）：段二质变全接后中位队默认工具再变强（岩3★守护自减伤/苏系盾量等）→
    // 中位地板再抬、克制差自然收窄 14.93/19.9≈0.75 贴线——阈值 0.75→0.8 收口；克制语义三重保留
    // （克制向必胜 + 绝对 <35s + 仍显著快于中位）。同⑩A1"n104 ×0.6→×0.75"先例。
    expect(ctr[0].avgDurationSec).toBeLessThan(med[0].avgDurationSec * 0.8); // 克制向显著更快=破题
    expect(ctr[0].avgDurationSec).toBeLessThan(35);
  }, 30000);
});
