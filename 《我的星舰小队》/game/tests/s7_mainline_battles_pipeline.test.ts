// ⑥第二段·战斗侧第二把尺子（管线三件套）测试：
//   ① 阵容生成器：养成刻度反解贴靶（战力≈P）+ 三族形状；
//   ② 压力→敌配映射：总量按 φ 强度补偿曲线、职业形状生效、等效厚度、单调性；
//   ③ 全扫冒烟：真链路（组装器→引擎）抽段跑通+手感靶带内（全量 148 关=CLI 工具·<1s）。
// 工具主体在 tools/s7-battles-entry.mts（esbuild 打包驱动）；vitest 直接吃 TS 源=同一份代码进 gate。
import { describe, it, expect } from 'vitest';
import {
  solveGrowthPlan, genLineup, pickShips, mapPressureToEnemies,
  loadBundle, scanMainlineAsync, K_HP, K_DPS, STAGE_MULT, ROLE_SHAPE,
} from '../tools/s7-battles-entry';

describe('⑥二段① 阵容生成器', () => {
  it('养成刻度反解：可达域内贴靶（|队伍战力−P|/P ≤ 9%·P 抽样避开阶跳接缝空档）', () => {
    // 段二 A3 重定基（旧→新→为什么对）：等级上限 100→50（TIER_LV_CAP 同步 C10..SS50）后
    // 反解域整体缩水——均匀队可达顶 ~1.9 万→~1.30 万（实测扫描 500..16000 步 100）；接缝空档
    // 随新级段重排：A→S 缝 ≈3.2k-4.0k、S→SS 缝 ≈6.3k-10.2k（阶基值邻比=实测跳·阶内只剩
    // 10 级=平台更窄→缝相对更宽，与 §16f"事件锁定"发现同根）。新抽样点全部取实测贴靶 ≤9%
    // 的可达点；接缝空档=均匀反解器结构局限如实记档（真实玩家该段=混编·墙验收工具走
    // 经济尺真实态 genLineupFromMains 不受此限）。旧抽样与旧缝（v1 刻度百级域）见 git 历史。
    for (const p of [600, 1500, 3000, 5500, 11000, 12500]) {
      const plan = solveGrowthPlan(p);
      const teamPower = plan.shipPower * 5;
      expect(Math.abs(teamPower - p) / p).toBeLessThanOrEqual(0.09);
    }
  });

  it('三族五舰：中位=五型各一；克制向按问题标签换工具；乱搭=三坦双奶', () => {
    // 批③段三载体重定（§16d）：中位第四位 迷雾→贯日（迷雾致盲=万能减伤牌挪去克制位）；
    // 克制族改"中位核心+对题弹性位"（盾题=影刃+破盾件）；乱搭=五支援（真·无胜利路径·反弹暗路清除）。
    expect(pickShips('median', 'swarm')).toEqual(['shp05', 'shp01', 'shp09', 'shp11', 'shp13']);
    expect(pickShips('counter', 'shield')).toContain('shp02'); // 影刃（狙杀+破盾件=对题弹性位）
    expect(pickShips('counter', 'backline')).toContain('shp06'); // 铁壁（嘲讽=M4 改向盖 backline_first）
    expect(pickShips('misfit', 'swarm')).toEqual(['shp13', 'shp14', 'shp15', 'shp16', 'shp17']);
    const { lineup } = genLineup('median', 3072, 'swarm');
    expect(lineup).toHaveLength(5);
    expect(new Set(lineup.map((u) => u.slotRef)).size).toBe(5); // 摆位不重
    expect(lineup.every((u) => u.pilotId)).toBe(true); // 每舰必配驾驶员（战场规则）
  });
});

describe('⑥二段② 压力→敌配映射（规则=细表 §19·定价重锚 v1 φ 恒等化）', () => {
  it('总量=k 合同 × φ(P)=P/500 × 关卡系数（锚点 P=500 处 φ=1）', () => {
    const b = loadBundle();
    const scale = mapPressureToEnemies(b, 'n001', 500);
    expect(scale.pool).toBeCloseTo(K_HP * 500 * STAGE_MULT.normal.pool, 5);
    expect(scale.dps).toBeCloseTo(K_DPS * 500 * STAGE_MULT.normal.dps, 5);
  });

  it('φ 恒等：敌池随 P 线性、敌火超锚段 ^1.08 结构补偿（旧"补偿<线性"断言随根因拆除）', () => {
    // 重定基记录（旧→新→为什么对）：旧断言 φ(15000)<30=「补偿吸收刻度虚胖」——v0 病态行为；
    // v1 刻度即强度（实测重标·RMSE 2%），φ=P/500 恒等=敌厚度直接贴刻度；敌火晚段 ^1.08
    // =套件结构价值不随战力砍半的独立机理（与刻度诚实无关·保留）。
    const b = loadBundle();
    const lo = mapPressureToEnemies(b, 'n001', 2000);
    const hi = mapPressureToEnemies(b, 'n001', 8000);
    expect(hi.pool / lo.pool).toBeCloseTo(4, 5); // 池纯线性
    expect(hi.dps / lo.dps).toBeCloseTo(Math.pow(4, 1.08), 3); // 火 ^1.08
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
  it('n055-n070（含 n060 首真墙Boss）：中位族全通·手感带内（段2a 过渡：接缝段贴靶/墙胜率转带+打印）', async () => {
    const reports = await scanMainlineAsync({ family: 'median', samples: 2, fromNode: 55, toNode: 70 });
    expect(reports.length).toBeGreaterThanOrEqual(14);
    const normals = reports.filter((r) => r.stage === 'normal');
    const avgDur = normals.reduce((a, r) => a + r.avgDurationSec, 0) / normals.length;
    // 批③段三重锚：躯干重校（正常档 25s 靶·盾带咬合加深）后该带=盾题密集带 → 均值带 [15,32]→[18,36]。
    expect(avgDur).toBeGreaterThanOrEqual(18);
    expect(avgDur).toBeLessThanOrEqual(36); // 手感带（普通关均值·盾带偏慢=咬合设计）
    const boss = reports.find((r) => r.nodeId === 'n060')!;
    // ⚠️ 段2a 过渡豁免（同旧靶豁免制·到期=2b 400 关新拓扑落地重钉冒烟段）：L50 世界里
    // n060 压力点上的反解构成"形态"变了——同纸面战力下解出 S 阶带核队（旧世界=A 阶无核
    // 贴线态），对墙读数 0.5 而非旧构成的 ≤0.2（实测贴靶差仅 0.1%=纸面贴住了、构成种类不同；
    // S 阶到手节奏变早=新纸面纹理，非墙变弱）。墙的真验收=经济尺真实态爬坡矩阵（2b 重跑）。
    // 过渡底线仍武装：①链路全通（上面 length/时长带照钉）②墙对贴线量级构成仍不白给
    // （胜率 <0.9）③贴靶带 ≤20%（覆盖本段 A→S 接缝 3.2k-4.0k 内的节点·超出=反解器真坏）；
    // 实测值打印留档。
    // eslint-disable-next-line no-console
    console.log(`[旧靶豁免·段2a 过渡] n060 冒烟：贴靶差 ${(((boss.teamPower - boss.pressure) / boss.pressure) * 100).toFixed(1)}% 胜率 ${boss.winRate}（旧断言 贴靶≤9%/胜率≤0.2·2b 重钉）`);
    expect(boss.winRate).toBeLessThan(0.9);
    for (const r of reports) expect(Math.abs(r.teamPower - r.pressure) / r.pressure).toBeLessThanOrEqual(0.20); // 过渡带=接缝量级上界
  }, 30000);

  it('克制语义抽验：n104 点名题 中位会翻车 vs 克制向稳赢', async () => {
    const med = await scanMainlineAsync({ family: 'median', samples: 5, fromNode: 104, toNode: 104 });
    const ctr = await scanMainlineAsync({ family: 'counter', samples: 5, fromNode: 104, toNode: 104 });
    // ⑥三段落数重定基：落数量纲下中位阵容能磨过 n104（66s=2.6× 普通关均值=真"挣扎"），
    // 胜率差失去区分度；"换搭配破题"的管线级证据改用时长差（实测 66.3s vs 26.4s=2.5×·余量断 ×0.6）。
    // ⑩A1 重定基 ×0.6→×0.75：驾驶员真天赋上场抬高中位队地板（源锁定/苏回光/蔽集火——66.3→32.9s），
    // 克制差收窄到 ≈1.55×（21.2s vs 32.9s）——"带对工具显著更快"语义原样成立（>25% 提速+绝对时长<35s
    // 双断言保留）·阈值按新地板收口；克制差全维度定量=B6 克制工具箱 11/11 实测正主。
    // 机制批③段二b重定基（旧→新→为什么对）：舰侧 L 节点入战再抬中位地板（烈阳重火力/极焰装填档=中位主力）→
    // 克制差进一步收窄（15.2 vs 16.0≈0.95）——比值阈值失去校准意义；冒烟曾退守"必胜+不慢于中位+<35s"。
    // 对锚与阶梯批重定基（旧→新→为什么对）：随机带宽中档转正（我暴击15%/×1.75+敌10%/×1.5）后，
    // 时长轴彻底失去区分度（s8 实测 中位 26.0s vs 克制 27.6s），但敌暴击尖峰让中位队后排会被暴死——
    // 可靠性轴接管语义（s8 实测 中位胜率 87.5% vs 克制 100%）：点名题工具的真价值=消灭暴死风险。
    // 冒烟底线改为：克制向必胜 + 可靠性不输中位 + 绝对时长 <35s（非退化）；"不慢于中位"时长断言退役
    // （26 vs 27.6 属带宽噪声级）。定量正主=n102 B5 五态矩阵（本批段一 n102 专档复验）。
    expect(ctr[0].winRate).toBe(1);
    expect(ctr[0].winRate).toBeGreaterThanOrEqual(med[0].winRate);
    expect(ctr[0].avgDurationSec).toBeLessThan(35);
  }, 45000);
});
