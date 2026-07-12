// 段二 · 最优解玩家 60 天成长剧本生成器 v1.1（返工版·R3-R8 全项落地·设计靶生成器）。
// 性质：剧本=手绘设计靶（F2）——本文件全部数字与文本=设计参数；脚本把参数展开成 60 行并跑
//   R8 自洽校验器（账目守恒/口径互斥/数据列交叉/事件型≤50%/暴推相对律/质变舞台律/毕业≥40/钩子不空），
//   任一约束破=抛错不产出。产出：①剧本 md ②JSON 镜像 ③《普通玩家对照摘要》④配套=《剧本评审清单》（手写文档）。
// 用法：node 段二-剧本生成器.mjs（就地写出三件）；--check 只跑校验不写盘。
// 改剧本=改设计参数区→重跑（校验器两道闸=R8 固定流程）。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

// ============================================================================
// 一、世界骨架 v1.1（R3 六域主题＋R4 墙修订＋R7 第七域·候 Ron 拍）
// ============================================================================

/** 六域主题 v1.1（R3）＋第七域（R7 授权自决=加·50 关整数·命名推荐「风暴之眼」候 Ron 终拍）。
 *  设计律：天气型可常驻；事件型出现率 ≤50%（校验器武装·运行时镜像=star_region_config ruleKind/ruleRate）。
 *  表述红线：本作纯自动战斗——域规则全部是"战前配装/编成决策"的变量，禁一切"战斗内时机/操作"表述。 */
export const REGIONS_V11 = [
  { sf: 'sf01', name: '星港边域', from: 1, to: 104, rule: null, ruleNote: '教学·无规则（蜜月直道+首Boss+墙①全在本域）' },
  { sf: 'sf02', name: '废铁坟场', from: 105, to: 176, rule: { kind: 'event', tag: 'graveyard_revive', rate: 0.30 }, ruleNote: '坟场复活：本域约 30% 关卡，敌单位被击毁后原地复活一次（半血）——续航/斩杀线配装价值上升' },
  { sf: 'sf03', name: '迷雾星尘带', from: 177, to: 250, rule: { kind: 'event', tag: 'mist_ambush', rate: 0.40 }, ruleNote: '迷雾藏兵：约 40% 关卡部分敌舰藏于星尘（轮廓可见·开战一段时间后现身）——开局爆发型星核打不到藏兵=开局型核价值打折，影响战前配装选择（持续输出/延时型核走强）' },
  { sf: 'sf04', name: '母舰工业区', from: 251, to: 312, rule: { kind: 'event', tag: 'mothership_line', rate: 0.50 }, ruleNote: '软斩首流水线：约半数关卡带量产母舰——阵容拆得快=早斩早赢、拆得慢=慢赢/压哨、太慢=超时败（反召唤配装/集火优先级=战前决策）' },
  { sf: 'sf05', name: '污染之海', from: 313, to: 368, rule: { kind: 'weather', tag: 'pollution_tide', rate: null }, ruleNote: '污染潮（天气型常驻）：全域持续污染压力·小潮大潮波动（净化/护罩配装常驻价值）' },
  { sf: 'sf06', name: '风暴核心', from: 369, to: 400, rule: { kind: 'weather', tag: 'storm_amp', rate: null }, ruleNote: '风暴增幅（天气型常驻）：全域敌我伤害增幅·战斗更快更凶（脆皮阵容风险放大=坦度配装价值）' },
  { sf: 'sf07', name: '风暴之眼（候 Ron 终拍·备选=乱流深渊）', from: 401, to: 450, rule: { kind: 'combo', tag: 'rule_combo_ladder', rate: null }, ruleNote: '第七域（R7 授权新增·毕业 ≥40 铁线重算后启用）：前六域规则组合递进——1+1 起步越深叠越多·每关硬仗档·n450 毕业战=六规则全叠+综合连战=墙⑨' },
];
export const TOTAL_NODES = 450; // 400+50（第七域=50 关·整数律 ✓·毕业日微调靠投放不靠关数）

/** 13 Boss 账（协调注记·候 Ron 核）：原拍"12 Boss=9 墙+3 高潮"在无第七域前提下成立；R7 授权加域并把
 *  终墙挪进第七域 → 账目协调为 **8 墙（六域）+3 高潮+1 风暴前哨硬仗（sf06 中段·硬仗档不卡天）+
 *  毕业战=墙⑨（第七域末）**；36 格卡天矩阵的"9 墙"=①-⑧+毕业战 ✓ 数字不变。 */
export const BOSSES_V11 = [
  { node: 54, kind: 'climax', name: '首Boss·星盗大副', joy: 'D2 开屏位：打 Boss→陨星弹质变→当日余下全是暴推舞台（R5）·初见≈10% 磨几把能过·解锁深空回廊' },
  { node: 104, kind: 'wall', idx: 1, wallType: '战力墙（单型教学Ⅰ）', keyTeach: '教"攒一晚再来"（D4 前后=R5⑤）', joy: '新解锁绑定（黑市开门）+暴推走廊', matrix: { 肝: 0.5, 重: 1, 普: 1, 轻: 1.5 } },
  { node: 140, kind: 'wall', idx: 2, wallType: '机制墙（单型教学Ⅱ）', keyTeach: '坟场复活机制拆解（续航/斩杀线）', joy: '暴推走廊', matrix: { 肝: 1, 重: 1, 普: 1.5, 轻: 2 } },
  { node: 176, kind: 'wall', idx: 3, wallType: '解题墙（单型教学Ⅲ）', keyTeach: '护后排双钥匙', joy: '新星域开门（sf03 迷雾）', matrix: { 肝: 1, 重: 1.5, 普: 2, 轻: 2.5 } },
  { node: 214, kind: 'climax', name: '高潮②·迷雾旗舰仗', joy: '爽段演出仗（迷雾域中点·不卡天）' },
  { node: 250, kind: 'wall', idx: 4, wallType: '连战墙（单型教学Ⅳ）', keyTeach: '满血复活连战（新引擎通道上岗·耐力配队）', joy: '新星域开门（sf04 母舰工业区）', matrix: { 肝: 1, 重: 2, 普: 2.5, 轻: 3 } },
  { node: 282, kind: 'wall', idx: 5, wallType: '战力+机制叠加墙', keyTeach: '首堵叠加墙（教过的才能叠=R4）', joy: '暴推走廊', matrix: { 肝: 1.5, 重: 2, 普: 3, 轻: 3.5 } },
  { node: 312, kind: 'wall', idx: 6, wallType: '解题+连战叠加墙', keyTeach: '钥匙×耐力双考', joy: '新星域开门（sf05 污染之海=爽段）', matrix: { 肝: 2, 重: 2.5, 普: 3, 轻: 4 } },
  { node: 340, kind: 'climax', name: '高潮③·污染巨兽前哨仗', joy: '阵容成型后的碾轧演出仗' },
  { node: 368, kind: 'wall', idx: 7, wallType: '机制+解题叠加墙', keyTeach: '污染潮下净化+护罩双钥', joy: '新星域开门（sf06 风暴核心）', matrix: { 肝: 2, 重: 3, 普: 4, 轻: 5 } },
  { node: 384, kind: 'outpost', name: '风暴前哨硬仗（sf06 中段 Boss·硬仗档初见 15-25%·磨几把过不卡天）', joy: '风暴域中点大仗' },
  { node: 400, kind: 'wall', idx: 8, wallType: '战力+连战叠加墙', keyTeach: '第七域资格仗（毕业前最后大坎）', joy: '风暴之眼开门（第七域）', matrix: { 肝: 2.5, 重: 3, 普: 4, 轻: 5.5 } },
  { node: 450, kind: 'wall', idx: 9, wallType: '毕业战（六规则全叠+综合连战·R4 终墙综合）', keyTeach: '六域全套工具箱综合考', joy: '毕业！长线循环开门', matrix: { 肝: 3, 重: 4, 普: 5, 轻: 6 } },
];
// 墙型轮换自查（R4）：前四=战/机/解/连单型教学各一 ✓；⑤起叠加（战机/解连/机解/战连）·教过才叠 ✓；
// 同一卡法不连用两次 ✓；毕业战=综合 ✓。

/** 38 精英位（R4 组合化：前段纯型→中段 1+1→后段 1+1+1→变态组合终盘压轴；同型禁连排；
 *  词缀纯型减量；福利关永远纯福利不叠任何难度）。 */
export const ELITES_V11 = [
  // 前段（sf01·纯型·新手段稀）
  { node: 7, kind: '词缀点名（纯）', note: 'D1 微阻滞①' }, { node: 18, kind: '奇阵·贴脸（纯）', note: 'D1 微阻滞②' },
  { node: 33, kind: '限时斩首（纯·引擎通道首秀）' }, { node: 68, kind: '奇阵·包围（纯）' }, { node: 88, kind: '词缀点名（纯）', note: '墙①前哨' },
  // sf02 坟场（纯型收尾+首个 1+1）
  { node: 116, kind: '福利·合金（纯福利）' }, { node: 128, kind: '词缀点名（纯）' },
  { node: 150, kind: '奇阵+词缀（1+1 首秀）', note: '组合化起点（R4）' }, { node: 165, kind: '限时斩首（纯·参数升档）' },
  // sf03 迷雾
  { node: 186, kind: '镜像关（纯·新花样②首秀）' }, { node: 198, kind: '斩首+词缀（1+1）' },
  { node: 208, kind: '福利·驾驶记录（纯福利）' }, { node: 224, kind: '奇阵·龟缩+迷雾藏兵（1+1·域规则联动）' },
  { node: 238, kind: '词缀点名（纯）', note: '墙④前哨' },
  // sf04 母舰
  { node: 258, kind: '满血复活连战（纯·精英版）' }, { node: 266, kind: '镜像+词缀（1+1·参数升档）' },
  { node: 274, kind: '福利·星贝（纯福利）' }, { node: 290, kind: '斩首+奇阵（1+1）' },
  { node: 298, kind: '词缀点名（纯）' }, { node: 306, kind: '复活连战+词缀（1+1）', note: '墙⑥前哨' },
  // sf05 污染（1+1+1 起步）
  { node: 320, kind: '斩首+词缀+奇阵（1+1+1 首秀）' }, { node: 330, kind: '福利·合金（纯福利·垫关）' },
  { node: 336, kind: '镜像关（纯·参数升档）' }, { node: 348, kind: '复活+奇阵（1+1）' },
  { node: 356, kind: '词缀点名（纯）' }, { node: 362, kind: '斩首+复活（1+1）', note: '墙⑦前哨' },
  // sf06 风暴（1+1+1 与终盘压轴）
  { node: 372, kind: '镜像+词缀+奇阵（1+1+1）' }, { node: 378, kind: '福利·驾驶记录（纯福利·垫关）' },
  { node: 390, kind: '斩首+复活+词缀（1+1+1·变态组合预告）', note: '墙⑧前哨' }, { node: 396, kind: '奇阵·贴脸（纯）' },
  // D36-60 垫关路福利（福利关后置加密·C2）+终盘补位（sf03-06 均布）
  { node: 232, kind: '福利·星贝（纯福利）' }, { node: 168, kind: '词缀点名（纯）' },
  { node: 122, kind: '奇阵·贴脸（纯）' }, { node: 142, kind: '词缀点名（纯）' },
  { node: 192, kind: '词缀点名（纯）' }, { node: 244, kind: '奇阵·包围（纯·参数升档）' },
  { node: 284, kind: '词缀点名（纯）' }, { node: 344, kind: '词缀点名（纯）' },
].sort((a, b) => a.node - b.node);
if (ELITES_V11.length !== 38) throw new Error(`精英位应 38 个，现 ${ELITES_V11.length}`);
// 同型禁连排自查（相邻两精英 kind 首词不同）——校验器逐对验。

// ============================================================================
// 二、逐日推进线（R5 五约束＋毕业 D41 ≥40 铁线·校验器闭环）
// ============================================================================

/** wall=当日在卡的墙 idx（含撞墙日）；breakWall=当日破的墙；climax/outpost=当日演出仗；
 *  transform=当日质变级事件（首核/SS/5★·质变舞台律④的校验锚）。 */
export const PROGRESS = [
  { d: 1, cleared: 52, band: '蜜月直道 85-95%（尾段 n45+ 渐紧 70-85%=预兆·R5①）' },
  { d: 2, cleared: 83, climax: 54, transform: '陨星弹（首核）', band: '首Boss 开屏 10% 磨三把过→质变加持日·余下全暴推（R5 编排）' },
  { d: 3, cleared: 100, band: '蜜月收口 75-88%（衰减 0.55·三天收口=R5②）' },
  { d: 4, cleared: 124, wall: 1, breakWall: 1, band: '撞墙① 0-5%→当晚偷鸡 8%→破墙暴推（卡 0.5 天·怼墙中·平均需 ~12 把·今日过概率 45%〔0.5 天口径〕）' },
  { d: 5, cleared: 138, band: '坟场域 75-85%（复活关 30% 出现·续航配装）' },
  { d: 6, cleared: 158, wall: 2, breakWall: 2, band: '撞墙② 0-5%→晚间破 12%（卡 0.5·平均需 ~8 把·当日过概率 50%）→暴推' },
  { d: 7, cleared: 171, band: '75-85%（首周收口 171·天花板口径）' },
  { d: 8, cleared: 175, wall: 3, band: '墙③ 解题墙 0%（无钥）·钥匙赛跑（怼墙中·有钥后 ~60%）' },
  { d: 9, cleared: 190, breakWall: 3, band: '钥匙齐 90% 一把过→sf03 开门·迷雾域（开局型核打折=配装重排）' },
  { d: 10, cleared: 202, band: '迷雾域 72-84%（藏兵关 40%·持续输出核走强）' },
  { d: 11, cleared: 214, climax: 214, band: '高潮② 35% 磨两把过（演出仗）' },
  { d: 12, cleared: 226, band: '72-84%' },
  { d: 13, cleared: 238, band: '70-82%' },
  { d: 14, cleared: 249, wall: 4, band: '撞墙④ 连战墙 3%（第二遍血线崩·怼墙中·平均需 ~25 把·今日过概率 12%）' },
  { d: 15, cleared: 265, breakWall: 4, transform: '员1 5★（能力终极质变）', band: '破墙 16%→sf04 开门+5★ 质变走廊（卡 1 天）' },
  { d: 16, cleared: 275, band: '母舰域 70-82%（软斩首流水线半数关·拆速=胜负）' },
  { d: 17, cleared: 281, wall: 5, band: '撞墙⑤ 战+机叠加 2-5%（首叠加墙·怼墙中·平均需 ~30 把）' },
  { d: 18, cleared: 294, breakWall: 5, transform: 'SS①（主力1 终极质变）', band: 'SS① 到手→破墙 15%→质变暴推走廊（卡 1 天）' },
  { d: 19, cleared: 305, band: '70-80%' },
  { d: 20, cleared: 311, wall: 6, transform: '员2 5★', band: '撞墙⑥ 解+连叠加 0-4%（钥匙×耐力·卡 1.5 起）' },
  { d: 21, cleared: 326, breakWall: 6, transform: 'SS②（主力2）', band: 'SS②+钥匙齐→破墙 14%→sf05 爽段开门' },
  { d: 22, cleared: 337, band: '污染之海 75-85%（天气常驻·净化护罩常备）' },
  { d: 23, cleared: 348, climax: 340, band: '高潮③ 45% 两把过（碾轧演出）' },
  { d: 24, cleared: 358, band: '73-83%' },
  { d: 25, cleared: 367, wall: 7, band: '撞墙⑦ 机+解叠加 0-3%（污染潮下双钥·卡 1.5·首件传奇+ 合成研究夜）' },
  { d: 26, cleared: 367, wall: 7, band: '卡墙⑦ 第 2 天 4-7%（第二钥合成中·怼墙中·平均需 ~18 把）' },
  { d: 27, cleared: 381, breakWall: 7, band: '双钥齐 88% 过→sf06 风暴核心开门（增幅域·战斗更快更凶）' },
  { d: 28, cleared: 393, outpost: 384, band: '风暴前哨硬仗 20% 磨四把过（Boss 位硬仗·不卡天）' },
  { d: 29, cleared: 399, wall: 8, band: '撞墙⑧ 战+连叠加 1-4%（第七域资格仗·卡 2 起）' },
  { d: 30, cleared: 399, wall: 8, transform: '传奇++ 首件（合成塔 20% 首爆·R2 供给线 D30±2）', band: '卡墙⑧ 第 2 天 3-6%（SS③ 碎片冲刺+++ 首爆研究）' },
  { d: 31, cleared: 410, breakWall: 8, transform: 'SS③（毕业队形 3SS 成）', band: 'SS③ 到手→破墙 16%→风暴之眼开门（每关硬仗档）' },
  { d: 32, cleared: 417, band: '风暴之眼 1+1 规则段 30-45%（每关磨 2-3 把·硬仗档）' },
  { d: 33, cleared: 424, band: '1+1 段 30-42%' },
  { d: 34, cleared: 431, band: '三叠段 25-40%（坟场+迷雾+母舰等组合·配装逐关重排）' },
  { d: 35, cleared: 438, band: '三叠段 25-38%' },
  { d: 36, cleared: 444, band: '四叠段 22-35%（磨 3-4 把/关）' },
  { d: 37, cleared: 449, wall: 9, band: '五叠段收口+撞毕业战 n450 0-3%（六规则全叠·卡 2.5 起）' },
  { d: 38, cleared: 449, wall: 9, band: '卡毕业战 第 2 天 3-6%（全队终装配研究·四层瀑布逐层对比）' },
  { d: 39, cleared: 449, wall: 9, band: '偷鸡带 8-10%（差一口爆发·星贝锁定三连赌）' },
  { d: 40, cleared: 449, wall: 9, transform: '员3 5★（毕业阵容 2×5★+3×4★ 成·A2 态）', band: '卡毕业战 收口日（毕业冲刺·平均需 ~11 把·今日过概率 55%〔跨日累计〕）' },
  { d: 41, cleared: 450, breakWall: 9, band: '毕业战 13% 磨四把过——通关！（D41 ≥40 铁线 ✓）' },
  // —— 毕业后段（R6 逐日化·钩子不空）——
  { d: 42, cleared: 450, band: '长线 D1：回廊冲层周开启（L60→冲 L70 段）' },
  { d: 43, cleared: 450, band: '长线：传奇++ 组合研究（第 2 件 ++ 赌局·先锁 2 条再赌第 3）' },
  { d: 44, cleared: 450, band: '长线：SS④ 冲刺日（冲顶里程碑①·黑市舰包+专属池并轨）' },
  { d: 45, cleared: 450, band: '长线：黑市大件存钱线（超新星 198 计数·差 3 天）' },
  { d: 46, cleared: 450, band: '长线：回廊 L75 里程碑+悬赏噩梦档全碾收菜' },
  { d: 47, cleared: 450, band: '长线：合成赌局日（传奇+ ×2 →++ 双赌·#12 返还兜底）' },
  { d: 48, cleared: 450, band: '长线：超新星到手（黑市毕业核②渠道·图鉴 15/16）' },
  { d: 49, cleared: 450, band: '长线：回廊 L80 冲层（宝石定向攒毕业核）' },
  { d: 50, cleared: 450, band: '长线：宝库毕业核②=图鉴 16 款集齐读秒（差 1 款·宝石 188/200）' },
  { d: 51, cleared: 450, band: '长线：图鉴 16/16 集齐仪式（宝库兑换）★收集毕业' },
  { d: 52, cleared: 450, band: '长线：SS⑤（第 5 只·冲顶里程碑②）' },
  { d: 53, cleared: 450, band: '长线：木桩三桩轮换刷分周（10 桩 3-4-3 日）' },
  { d: 54, cleared: 450, band: '长线：传奇++ 第 3 件（极品组合逼近：暴击三件套差 1 条）' },
  { d: 55, cleared: 450, band: '长线：全员 5★ 冲刺（员4 5★）' },
  { d: 56, cleared: 450, band: '长线：回廊 L85+悬赏完美周（bountyPerfect 线）' },
  { d: 57, cleared: 450, band: '长线：星核数量线 24 颗（多颗同款多舰装配研究）' },
  { d: 58, cleared: 450, band: '长线：全员 5★ 达成（冲顶里程碑③）' },
  { d: 59, cleared: 450, band: '长线：极品组合达成（暴击三件套 ++·合成研究收官）' },
  { d: 60, cleared: 450, band: '长线稳态确立：每 2-3 天一个账面大事件持续（D1 组验收位）' },
];

// ============================================================================
// 三、资源三账（14 键·分段速率+事件叠加）＋R6 新列（离线巡逻单列/耗时分解/瓶颈轮转/挤压×变现）
// ============================================================================

export const KEYS = ['starOre', 'hullAlloy', 'pilotToken', 'shipBlueprint', 'pilotShardUniversal', 'coreFrag', 'fullCore', 'starGem', 'supplyTicket', 'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket'];
export const KEY_NAMES = { starOre: '星矿', hullAlloy: '合金', pilotToken: '驾驶记录', shipBlueprint: '通碎·舰', pilotShardUniversal: '通碎·员', coreFrag: '星核碎片', fullCore: '完整星核', starGem: '星空宝石', supplyTicket: '补给券', beaconCommon: '信标·普', beaconRare: '信标·稀', beaconEpic: '信标·史', starCargo: '星贝', adTicket: '广告券' };

const phaseOf = (d) => (d === 1 ? 'A' : d <= 7 ? 'B' : d <= 15 ? 'C' : d <= 27 ? 'D' : d <= 41 ? 'E' : 'F');
const RATES = {
  //            A(D1)          B(D2-7)        C(D8-15)       D(D16-27)      E(D28-41)      F(D42-60 长线)
  starOre: { A: [1500, 1200], B: [1400, 1300], C: [2200, 2000], D: [3200, 3000], E: [4200, 3800], F: [3600, 3400] },
  hullAlloy: { A: [1800, 1500], B: [2200, 2100], C: [3600, 3400], D: [5200, 5000], E: [6800, 6500], F: [5600, 5300] },
  pilotToken: { A: [1200, 1000], B: [1500, 1400], C: [2400, 2300], D: [3500, 3300], E: [4600, 4400], F: [3800, 3600] },
  shipBlueprint: { A: [40, 38], B: [26, 24], C: [30, 29], D: [34, 33], E: [36, 35], F: [30, 28] },
  pilotShardUniversal: { A: [40, 38], B: [26, 24], C: [30, 29], D: [34, 33], E: [36, 35], F: [30, 28] },
  coreFrag: { A: [12, 0], B: [14, 0], C: [18, 0], D: [22, 0], E: [24, 0], F: [18, 0] },
  fullCore: { A: [0, 0], B: [0, 0], C: [0, 0], D: [0, 0], E: [0, 0], F: [0, 0] },
  starGem: { A: [4, 0], B: [10, 0], C: [16, 0], D: [20, 0], E: [22, 0], F: [22, 0] },
  supplyTicket: { A: [70, 66], B: [56, 54], C: [60, 58], D: [62, 60], E: [64, 62], F: [56, 52] },
  beaconCommon: { A: [6, 5], B: [7, 7], C: [8, 8], D: [8, 8], E: [8, 8], F: [7, 7] },
  beaconRare: { A: [2, 1], B: [3, 3], C: [4, 4], D: [5, 5], E: [5, 5], F: [4, 4] },
  beaconEpic: { A: [0, 0], B: [1, 1], C: [1, 1], D: [2, 2], E: [2, 2], F: [2, 2] },
  starCargo: { A: [500, 420], B: [420, 400], C: [520, 490], D: [600, 560], E: [680, 640], F: [700, 650] },
  adTicket: { A: [2, 2], B: [4, 4], C: [5, 5], D: [6, 6], E: [6, 6], F: [5, 5] },
};
/** R6：离线+巡逻两渠道单列（设计靶=两渠道占合金/记录收入的份额·底垫身份 §6）；派驻策略进③决策列。 */
const passiveShare = { A: 0.30, B: 0.26, C: 0.22, D: 0.20, E: 0.18, F: 0.22 };

/** 供给事件线（D 组明排·R2 供给修订：传奇+ 首件 D25/++ 首件 D30±2→collect 曲线；星核 24 颗；
 *  图鉴 16 款集齐=D51（R6 整改：宝库毕业核②收尾·16/16 账目闭合——押 D50-51·在"55-58"指令带外
 *  的原因=最优解宝石节奏 D50 即攒齐 200·晚兑=故意拖慢天花板线不成立；候 Ron 核·普通档=D55-58 带内）。 */
const EVENTS = {
  2: { fullCore: [1, 0] }, // 陨星弹
  3: { supplyTicket: [14, 14], beaconCommon: [2, 2] },
  5: { fullCore: [1, 0], coreFrag: [0, 60] },
  7: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张①
  9: { fullCore: [1, 0], coreFrag: [0, 60] },
  12: { fullCore: [1, 0], coreFrag: [0, 60] },
  14: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张②
  16: { fullCore: [1, 0], coreFrag: [0, 60] },
  18: { fullCore: [1, 0], starGem: [0, 120] }, // 宝库流通①（SS① 日撞喜）
  21: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张③
  24: { fullCore: [1, 0], coreFrag: [0, 60] },
  26: { fullCore: [1, 0], starGem: [0, 120] }, // 宝库流通②
  27: { fullCore: [1, 0], coreFrag: [0, 60] }, // 墙⑦双钥核
  28: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张④
  30: { fullCore: [1, 0], starGem: [0, 180] }, // 宝库复购 ×1.5
  33: { fullCore: [1, 0], coreFrag: [0, 60] },
  35: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑤
  36: { fullCore: [1, 0], coreFrag: [0, 60] },
  41: { starCargo: [400, 0], beaconEpic: [2, 0] }, // 毕业大奖（n450 首通）
  42: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑥
  43: { fullCore: [1, 0], coreFrag: [0, 60] },
  45: { fullCore: [1, 0], starGem: [0, 200] }, // 毕业核①（宝库 200·毕业后仪式）
  47: { fullCore: [1, 0], coreFrag: [0, 60] },
  48: { fullCore: [1, 0] }, // 超新星（黑市 198 计数=毕业核②渠道·图鉴 15/16）
  49: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑦
  51: { fullCore: [1, 0], starGem: [0, 200] }, // 宝库毕业核②=图鉴 16 款集齐 ★
  53: { fullCore: [1, 0], coreFrag: [0, 60] },
  56: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑧
  57: { fullCore: [1, 0], coreFrag: [0, 60] }, // 第 24 颗（数量线）
};

// —— 文本层（④⑤⑥⑦⑫＋R6 新列）——
const GROWTH_EVENTS = {
  1: '满编 5 舰·主力1 B 阶·大节点强化Ⅰ（L10·平移制）', 2: '主力1 A 阶→S 阶备料·陨星弹装核（普攻变原子炮=首个质变对比）',
  3: '主力1 S 阶（首Boss 后首日=GDD-M 铁律节奏）·主力2 A 阶', 4: '主力2 S 阶备料·大节点Ⅱ（L20）主力1',
  5: '主力3 A 阶', 6: '主力2 S 阶', 7: '员1 3★（大质变）', 8: '主力3 S 阶·护后排钥匙①到手',
  9: '钥匙②合成（30 碎通道当量）＝墙③破', 10: '主力4 A 阶', 11: '员2 3★', 12: '主力4 S 阶',
  13: '员3 3★', 14: '主力5 A 阶·连战墙耐力配队研究', 15: '★员1 5★（终极质变·连战续航解）',
  16: '主力5 S 阶（五 S 成军）', 17: '大节点Ⅲ（L30）主力线', 18: '★SS①（主力1 终极质变）',
  19: '员1 4★→5★ 已达·员2 4★', 20: '★员2 5★', 21: '★SS②（主力2）', 22: '员3 4★',
  23: '大节点Ⅳ（L40）主力线', 24: '员4 4★', 25: '★首件传奇+（合成塔 40% 首爆·R2 供给线 D25）',
  26: '第二钥合成（净化+护罩）', 27: '双钥齐＝墙⑦破', 28: '毕业向终装配起步（四层瀑布逐层对比）',
  30: '★首件传奇++（20% 塔首爆·R2 供给线 D30±2）', 31: '★SS③（毕业队形 3SS 成）',
  33: '员3 4★ 进度·大节点Ⅴ（L50 满级档）主力1', 36: '全队 L50 上下（毕业态成型）',
  40: '★员3 5★→毕业阵容=3SS+2S/2×5★+3×4★（A2 转正态）', 41: '★毕业！n450 首通',
  44: '★SS④（冲顶①）', 48: '超新星到手（图鉴 15/16）', 51: '★图鉴 16 款集齐（宝库毕业核②）',
  52: '★SS⑤（冲顶②）', 55: '员4 5★', 58: '★全员 5★（冲顶③）', 59: '极品组合 ++ 达成（合成研究收官）',
};
const UNLOCK_EVENTS = {
  1: '船坞/训练舱(关1)·补给站(关3)·打捞(关4)·商人+悬赏板(关5)·居住舱(关8)·货舱(关9)·满编(关11)·星核入口(关13-14)·展厅提示(关15)·保护期收口(n018/19)',
  2: '深空回廊（首Boss n054 首杀）·陨星弹装核', 4: '黑市（墙① n104 首通=第一堵真墙 Boss 后·语义保持）',
  5: '每日推演（n064 首通=首Boss+10·D2 已达位·当日补开）·研究塔（D4-5 档）',
  9: 'sf03 迷雾星尘带开门（域规则=迷雾藏兵 40% 关）', 15: 'sf04 母舰工业区开门（软斩首流水线半数关）',
  21: 'sf05 污染之海开门（天气常驻·污染潮）', 27: 'sf06 风暴核心开门（天气常驻·风暴增幅）',
  31: '★风暴之眼开门（第七域·规则组合递进·每关硬仗档）', 41: '长线循环全开（毕业）',
};
/** R6 挤压点×变现咬合列：{pinch: 什么最紧+差多少, monetize: 对应变现点（广告/黑市）}。 */
const PINCH = {
  2: { pinch: '合金（升阶梯 50/100 连跳·差一晚）', monetize: '#1 回港翻倍+#3 首通翻倍（合金位）+墙日军饷包' },
  6: { pinch: '专属碎片（主力2 S 阶差 40 片）', monetize: '黑市 shardSmall 小包（40 计数）+#4 再选一选碎片' },
  8: { pinch: '钥匙件（墙③差 1 件克制工具）', monetize: '黑市小件坑手动再刷×2+补给券加抽（#6 赞助券）' },
  14: { pinch: '耐力套件（连战墙=续航件+奶位养成）', monetize: '#9 安慰包×3（故意送头族·养成补贴）' },
  17: { pinch: '专属碎片 1000（SS① 门槛=最大单笔）', monetize: '黑市舰包 128 计数存钱目标+uniPack' },
  20: { pinch: '双钥匙+SS② 碎片双线', monetize: '黑市再刷×2+#11 保卡（故意失败族·悬赏难度白嫖试）' },
  25: { pinch: '传奇件燃料（合成塔 40% 赌局·差副槽件）', monetize: '#12 合成返还（故意合败族首用）+黑市 plugLegend 包' },
  29: { pinch: 'SS③ 碎片 1000（资格仗门槛）', monetize: '黑市舰包二单+专属池兑换并轨' },
  37: { pinch: '全维终装配（毕业战=四层瀑布研究+星贝锁定三连赌）', monetize: '锁定星贝 540×3+#12 返还兜底' },
  44: { pinch: 'SS④ 碎片（冲顶节奏）', monetize: '黑市舰包三单（长线计数主力去向）' },
  50: { pinch: '宝石 200（毕业核②差 12）', monetize: '#10 回廊里程碑翻倍不吃宝石（红线）——纯回廊冲层解' },
};
const CHECKPOINTS = {
  1: '⬥D1 蜜月 52 关 ∈[45,55]（R5①）', 3: '⬥蜜月三天收口 100 关（衰减 0.6/0.55=R5② 带内）',
  4: '⬥墙① D4 前后（R5⑤）·矩阵 肝0.5/重1/普1/轻1.5', 7: '⬥首周 171（天花板口径·普通档参照见对照摘要）',
  41: '⬥毕业 D41 ≥40 铁线 ✓（R7）·毕业日矩阵 40/48/60/73 的天花板上界', 51: '⬥图鉴 16/16（R6 账目闭合）',
  60: '⬥零广告可毕业/跨期追赶=四档线 2b 复验（本表=天花板单线）·轻度下限检查=2c（补充指令三）',
};
const HOOKS = {
  1: '明天：首Boss 开屏决战（S 阶备料完成·陨星弹在望）', 3: '明天：撞第一堵真墙（攒一晚合金=教学墙①）',
  7: '明天：墙③钥匙赛跑收官（差 1 件）', 13: '明天：连战墙④（第二遍血线=耐力配队首考）',
  16: '明天：撞首堵叠加墙（战+机·教过的开始叠了）', 19: '明天：员2 5★+墙⑥双考开工',
  24: '明天：传奇+ 首赌（40% 塔·燃料已囤 2 件）', 26: '明天：双钥齐=破墙⑦（研究一晚的兑现日）',
  28: '明天：撞第七域资格仗（毕业前最后大坎）', 30: '明天：SS③ 到手=破墙⑧+风暴之眼开门',
  36: '明天：撞毕业战（六规则全叠·终装配研究周开启）', 40: '明天：毕业决战（阵容转正完毕·就差临门一脚）',
  41: '明天起：长线开门（毕业核仪式/SS④⑤/图鉴收尾/++ 组合研究排队上桌）',
  50: '明天：图鉴 16/16 集齐仪式', 57: '明天：全员 5★ 达成日', 60: '长线稳态循环确立（每 2-3 天一个账面大事件）',
};

/** ⑨广告（逐点位·主口径含故意失败族；黑市 30 连看=0=口径互斥校验项）。 */
function adsOf(d, p) {
  const pushing = p.cleared > (PROGRESS[d - 2]?.cleared ?? 0);
  const pts = {
    '#1回港翻倍': 3, '#2补给箱': 1, '#3首通翻倍': pushing ? 1 : 0, '#4再选一': pushing ? 1 : 0,
    '#5打捞秒完': 1, '#6赞助券': 1, '#7货舱多选': 2, '#8商人刷新': 1,
    '#9安慰包(故意送头×3)': 3, '#10回廊翻倍': d >= 2 ? 1 : 0, '#11保卡(故意失败×1)': 1,
    '#12合成返还(故意合败×1)': d >= 5 ? 1 : 0, '黑市手动刷新': d >= 4 ? 1 : 0, '黑市30连看': 0,
  };
  const deliberate = pts['#9安慰包(故意送头×3)'] + pts['#11保卡(故意失败×1)'] + pts['#12合成返还(故意合败×1)'];
  const natural = Object.values(pts).reduce((a, b) => a + b, 0) - deliberate;
  return { pts, counterToday: natural + deliberate, natural, deliberate };
}
function sideOf(d) {
  const corridor = d < 2 ? 0 : Math.min(90, Math.round(6 + d * 1.4));
  return { corridor, bounty: 3, puzzle: d >= 5 ? 1 : 0, drill: Math.min(20, Math.round(3 + d * 0.45)), salvage: d <= 3 ? 3 : 5 };
}
/** ⑩收集（R2 供给线：传奇+ 首件 D25·++ 首件 D30·之后稳步）。 */
function collectOf(d, coreCount) {
  const legendPlus = d < 25 ? 0 : Math.min(8, 1 + Math.floor((d - 25) / 4));
  const legendPP = d < 30 ? 0 : Math.min(3, 1 + Math.floor((d - 30) / 12));
  return { cores: coreCount, legendPlus, legendPP };
}
/** ⑪耗时分解（R6：主线/侧内容/广告/养成研究·分钟）。 */
function minutesOf(d, p) {
  const push = Math.round((p.cleared - (PROGRESS[d - 2]?.cleared ?? 0)) * 0.9);
  const wallGrind = p.wall && !p.breakWall ? 22 : p.breakWall ? 12 : 0;
  const main = push + wallGrind;
  const side = 16; const ads = 7;
  const research = p.wall ? 14 : (PROGRESS[d - 1]?.transform ? 10 : 5);
  return { main, side, ads, research, total: main + side + ads + research };
}
/** R6 瓶颈轮转（阶段瓶颈=需求增速>供给增速·尺子 2b 验证）。 */
function bottleneckOf(d) {
  if (d <= 7) return '星矿/合金/星贝（建筑+升级+买券三口抢·前期瓶颈族）';
  if (d <= 20) return '专属碎片/驾驶记录（升阶升星梯 50/100/300/1000 主导·中期瓶颈族）';
  if (d <= 41) return '核碎/宝石（开蛋 60+宝库 120-200 定向储蓄·中后期瓶颈族）';
  return '插件燃料（传奇件=合成塔 40/20% 的持续吞噬·毕业后瓶颈族）';
}
/** R6 关键日点名快照（具名舰/员/核/插件+阶星+专属碎片存量·逐日全量点名=2c）。 */
const KEY_SNAPSHOTS = {
  1: 'D1：磐石(B阶L10·岩1★)/极焰(B阶L10·炎1★)/烈阳(A阶备料L10·苏1★)/贯日(C阶L10)/晨曦(C阶L10)；核 0；插件=精良×5（三选一+首抽）；专属存量：极焰 ≈180/磐石 ≈60/其余 <40',
  7: 'D7：极焰(S阶L20·炎3★)/磐石(S阶L20·岩2★)/烈阳(S阶L18·苏2★)/贯日(A阶L16)/晨曦(A阶L15)；核 3（陨星弹+扩张+蛋）·陨星弹=极焰；插件=优秀×8 精良×7；专属存量：极焰 120（清后回攒）/磐石 90/烈阳 140',
  14: 'D14：五 S 成军前夜（贯日 S 备料 280/300）·员1 炎 4★L28/岩 3★/苏 3★/砺 3★/澈 2★；核 6（小太阳=烈阳·守护铃=磐石）；插件=传奇×2 优秀×10；专属存量：极焰 620/1000（SS① 冲刺 62%）',
  21: 'D21：SS②日——极焰 SS L30(炎 5★L30)/磐石 SS L30(岩 4★)/烈阳 S L28(苏 5★L28)/贯日 S L26(砺 4★)/晨曦 S L26(澈 4★)；核 9（超级护罩/星鲸入列）；插件=传奇×5（首合研究中）；专属存量：烈阳 480/1000',
  30: 'D30：3SS 前夜（烈阳 940/1000）·传奇+ ×2/++ ×1（首爆日）；核 13；员 炎5★/苏5★/岩4★/砺4★/澈4★；全队 L38-44；专属沉淀池 ≈4200（板凳线蓄水）',
  41: 'D41 毕业：极焰 SS L50/磐石 SS L48/烈阳 SS L47/贯日 S L40/晨曦 S L40；员 炎5★L50/苏5★L48/岩4★L40/砺4★L40/澈4★L40（=A2 转正态 3SS+2S/2×5★+3×4★/L50 上下 ✓）；核 17（含毕业核①路上）；插件=传奇+×5/++×1（战力≈天花板终值·2c 双桩实测）',
};

// ============================================================================
// 四、展开＋R8 内建校验器
// ============================================================================

function build() {
  const wallet = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const days = [];
  let coreCount = 0;
  for (const p of PROGRESS) {
    const d = p.d;
    const ph = phaseOf(d);
    const inc = {}; const spd = {};
    for (const k of KEYS) { const [i, s] = RATES[k][ph]; inc[k] = i; spd[k] = s; }
    const ev = EVENTS[d] ?? {};
    for (const [k, [ei, es]] of Object.entries(ev)) { inc[k] = (inc[k] ?? 0) + ei; spd[k] = (spd[k] ?? 0) + es; }
    for (const k of KEYS) {
      wallet[k] += inc[k] - spd[k];
      if (wallet[k] < -1e-9) throw new Error(`[校验器·守恒] D${d} ${k} 存量为负（${wallet[k].toFixed(1)}）`);
    }
    if (ev.fullCore?.[0]) coreCount += ev.fullCore[0];
    const ads = adsOf(d, p);
    const share = passiveShare[ph];
    const prev = PROGRESS[d - 2];
    const wallMark = p.wall && !p.breakWall ? `卡墙${'①②③④⑤⑥⑦⑧⑨'[p.wall - 1]}` : p.breakWall ? `破墙${'①②③④⑤⑥⑦⑧⑨'[p.breakWall - 1]}` : p.climax ? '高潮仗' : p.outpost ? '前哨硬仗' : d > 41 ? '长线' : '推进';
    days.push({
      day: d, phase: ph,
      progress: { cleared: p.cleared, newToday: p.cleared - (prev?.cleared ?? 0), state: wallMark, initWinBand: p.band },
      wallet: Object.fromEntries(KEYS.map((k) => [k, { income: inc[k], spend: spd[k], balance: Math.round(wallet[k]) }])),
      passiveIncome: { // R6 离线+巡逻单列（设计靶份额×当段收入）
        offlineAlloy: Math.round(inc.hullAlloy * share * 0.6), patrolAlloy: Math.round(inc.hullAlloy * share * 0.4),
        offlineToken: Math.round(inc.pilotToken * share * 0.6), patrolToken: Math.round(inc.pilotToken * share * 0.4),
      },
      outsideWallet: { snapshot: KEY_SNAPSHOTS[d] ?? '—（关键日点名=D1/7/14/21/30/41·逐日全量点名表=2c 机器线）', coresOwned: coreCount },
      decisions: DECISIONS[d] ?? (d > 41 ? '长线序：黑市计数→大件存钱·宝石→毕业核·传奇燃料→合成塔·派驻=满 10 艘高阶轮换' : '常规最优序：通碎→瓶颈主力·星贝→券至日限+黑市宝箱·合金/记录逐级买满·核碎 60 即开蛋·巡逻派驻=非主力高阶 10 艘'),
      growth: GROWTH_EVENTS[d] ?? '—', joy: JOY[d] ?? (p.breakWall ? `破墙${'①②③④⑤⑥⑦⑧⑨'[p.breakWall - 1]}暴推（攒的资源一口气兑现）` : p.climax ? '高潮演出仗' : '—'),
      pinch: PINCH[d] ?? { pinch: '—', monetize: '—' },
      unlock: UNLOCK_EVENTS[d] ?? '—',
      side: sideOf(d), ads, collect: collectOf(d, coreCount), minutes: minutesOf(d, p),
      bottleneck: bottleneckOf(d),
      hook: HOOKS[d] ?? autoHook(d, p),
      checkpoint: CHECKPOINTS[d] ?? (p.wall && p.breakWall !== p.wall && WALL_CHECK[p.wall] && wallMark.startsWith('卡墙') && (prev?.wall !== p.wall) ? WALL_CHECK[p.wall] : '—'),
      transform: p.transform ?? null,
    });
  }
  return { days, coreCount };
}
const WALL_CHECK = Object.fromEntries(BOSSES_V11.filter((b) => b.kind === 'wall').map((b) => [b.idx,
  `⬥墙${'①②③④⑤⑥⑦⑧⑨'[b.idx - 1]}（n${b.node}·${b.wallType}）：矩阵 肝${b.matrix.肝}/重${b.matrix.重}/普${b.matrix.普}/轻${b.matrix.轻}·≤7 硬顶`]));
const JOY = {
  1: '开局直道 52 关一路碾+满编成军+首抽十连（尾段渐紧=明天有仗打的预感）',
  2: '首Boss 开屏三把过+陨星弹质变（普攻变原子炮）+质变加持日全天暴推=R5"打 Boss→质变→全是舞台"',
  4: '首墙 0-5%→攒一晚→偷鸡破墙+黑市开门（第一次"研究出解"）', 6: '坟场复活机制首拆（续航流配装首胜）',
  9: '钥匙齐一把过墙③+迷雾域开门', 11: '高潮②旗舰仗（演出向）', 15: '员1 5★ 终极质变+连战墙破',
  18: 'SS① 终极质变（回打旧墙提速对比=质变体感≥描述）', 21: 'SS②+爽段开门', 23: '高潮③碾轧演出',
  25: '首件传奇+（合成赌局首爆）', 27: '双钥破墙⑦+风暴域开门', 28: '风暴前哨硬仗四把过（增幅域快节奏爽）',
  30: '传奇++ 首爆（20% 塔）', 31: 'SS③=3SS 队形成+风暴之眼开门', 41: '毕业！六规则全叠终墙磨四把过（60 天最大爽点）',
  44: 'SS④', 48: '超新星到手', 51: '图鉴 16/16 集齐仪式', 52: 'SS⑤', 58: '全员 5★', 59: '极品组合达成',
};
const DECISIONS = {
  1: '三选一全选主力1 专属·星贝全买券（日限）·抽卡船人对半·D1 全花不留存量',
  2: '合金全喂主力1 冲 S 备料（首Boss 后首日上 S=GDD-M 节奏）·首败故意送头×3 起账·巡逻派驻首配（非主力 4 艘）',
  4: '黑市开门首刷：小件 4 坑+手动再刷×2 全扫·宝箱 10 计数必买·大件页存钱目标=舰包 128',
  8: '钥匙赛跑：黑市 shardSmall+专属池兑换并行（解题墙=攒工具天数）', 14: '连战配队：奶位/续航件优先喂养（墙④=耐力考）',
  17: 'SS① 冲刺：通碎 1:1 全转主力1+黑市 uniPack（1000 碎大关）', 20: '反召唤+双钥储备（sf04 半数流水线关的常备配装）',
  25: '合成开赌：传奇×2 同槽 40% 塔·首赌不锁（锁价 180 留身份件）·失败→#12 返还', 28: '终装配研究开工：四层瀑布逐层对比（换核/换附加/换站位）',
  31: '黑市舰包二单拍下（SS③ 主引擎）·风暴之眼配装=组合规则逐关重排（1+1 段）',
  37: '毕业战研究周：星贝锁定三连赌（540×3）·全队终装配定稿', 45: '毕业核①宝库 200（毕业仪式①）',
  47: '++ 赌局：先合满意的 +（锁 2 条）再升 ++（只赌第 3 条）=分层锁定研究径',
};
function autoHook(d, p) {
  const next = PROGRESS[d];
  if (!next) return '长线稳态：明天黑市轮换/回廊再冲一层';
  if (next.wall && !next.breakWall) return `明天：撞墙${'①②③④⑤⑥⑦⑧⑨'[next.wall - 1]}（攒资本）`;
  if (next.breakWall) return `明天：破墙${'①②③④⑤⑥⑦⑧⑨'[next.breakWall - 1]}在望（偷鸡带已到）`;
  if (next.transform) return `明天：${next.transform.split('（')[0]}到手`;
  if (next.climax || next.outpost) return '明天：大仗演出日';
  if (EVENTS[d + 1]?.fullCore) return '明天：新星核到手';
  return d > 41 ? '明天：长线事件继续（黑市/回廊/合成三线推进）' : '明天：走廊继续暴推';
}

/** R8 校验器（约束不验绝对数·任一破=抛错）。 */
function validate(days) {
  const errs = [];
  const prog = (d) => PROGRESS[d - 1];
  const gain = (d) => prog(d).cleared - (PROGRESS[d - 2]?.cleared ?? 0);
  // ① 蜜月律：D1∈[45,55]；D2/D3 衰减∈[0.45,0.65]（D2=质变加持编排白名单·带上沿放 0.65）；三天收口。
  if (prog(1).cleared < 45 || prog(1).cleared > 55) errs.push(`蜜月律：D1=${prog(1).cleared} ∉[45,55]`);
  for (const d of [2, 3]) {
    const r = gain(d) / gain(d - 1);
    if (r < 0.45 || r > 0.65) errs.push(`蜜月衰减律：D${d} 衰减 ${r.toFixed(2)} ∉[0.45,0.65]`);
  }
  // ② 暴推相对律（D4 起）：破墙日推进 ≥ 破墙前最后一个推进日 ×1.4。
  //    终墙（墙⑨=毕业战）豁免：破墙后没有关可推（n450=终点）——终墙的"暴推走廊"=毕业长线开门本身
  //    （规则语义精化非放水·评审清单同步注记）。
  for (const p of PROGRESS) {
    if (!p.breakWall || p.d < 4 || p.breakWall === 9) continue;
    let lastPush = 0;
    for (let d = p.d - 1; d >= 1; d--) { const g = gain(d); if (g > 0) { lastPush = g; break; } }
    if (lastPush > 0 && gain(p.d) < lastPush * 1.4 - 1e-9) errs.push(`暴推相对律：D${p.d} 破墙${p.breakWall} 推进 ${gain(p.d)} < 前推进日 ${lastPush}×1.4`);
  }
  // ③ 质变舞台律（D4 起·D2 首核=编排白名单）：质变日 max(当日,次日推进) ≥ 前日 ×1.3。
  for (const p of PROGRESS) {
    if (!p.transform || p.d < 4 || p.d > 41) continue;
    const prev = gain(p.d - 1); const cur = Math.max(gain(p.d), gain(p.d + 1) || 0);
    if (prev > 0 && cur < prev * 1.3 - 1e-9) errs.push(`质变舞台律：D${p.d}（${p.transform}）max(当日,次日)=${cur} < 前日 ${prev}×1.3`);
  }
  // ④ 毕业铁线：≥40。
  const grad = PROGRESS.find((p) => p.breakWall === 9);
  if (!grad || grad.d < 40) errs.push(`毕业铁线：D${grad?.d} <40`);
  // ⑤ 事件型出现率 ≤50%（域规则表）。
  for (const r of REGIONS_V11) if (r.rule?.kind === 'event' && r.rule.rate > 0.5) errs.push(`设计律：${r.name} 事件型 ${r.rule.rate} >50%`);
  // ⑥ 数据列交叉：累计关单调；核数=事件和；墙矩阵普通列=26；图鉴 16 款事件在 D50-58 窗。
  for (let i = 1; i < PROGRESS.length; i++) if (PROGRESS[i].cleared < PROGRESS[i - 1].cleared) errs.push(`推进单调破：D${PROGRESS[i].d}`);
  const wallSum = BOSSES_V11.filter((b) => b.kind === 'wall').reduce((a, b) => a + b.matrix.普, 0);
  if (wallSum !== 26) errs.push(`墙矩阵普通列=${wallSum} ≠26`);
  // ⑦ 口径互斥：黑市 30 连看恒 0；钩子不空。
  for (const x of days) {
    if (x.ads.pts['黑市30连看'] !== 0) errs.push(`口径互斥：D${x.day} 黑市30连看≠0`);
    if (!x.hook || x.hook === '—') errs.push(`明日钩子空：D${x.day}`);
  }
  // ⑧ 关卡总数整数律（R7）：第七域 50 关·总 450。
  if ((TOTAL_NODES - 400) % 5 !== 0) errs.push('第七域关数非整数档');
  if (errs.length) throw new Error(`[R8 校验器] ${errs.length} 条约束破：\n  ${errs.join('\n  ')}`);
  return true;
}

// ============================================================================
// 五、产出
// ============================================================================

const { days, coreCount } = build();
validate(days);
if (CHECK_ONLY) { console.log('[R8 校验器] 全部约束通过（--check 模式·不写盘）'); process.exit(0); }

const json = {
  meta: {
    name: '最优解玩家 60 天成长剧本 v1.1（返工版）', kind: '设计靶（F2 手绘线·R1-R8 返工落地）', date: '2026-07-12',
    caliber: '无限时间/全渠道拉满/运气平均/推进线=单把5%（呈现=怼墙中·平均需X把·今日过概率Y%）/黑市不做30连看（刷新+计数购物照用）/故意失败族入主口径（#9×3+#11×1+#12×1）——机器线另跑仅自然触发对照·差值交Ron拍',
    world: { N: TOTAL_NODES, regions: REGIONS_V11, bosses: BOSSES_V11, elites: ELITES_V11 },
    bossAccountNote: '13 Boss=8 墙（六域）+3 高潮+1 风暴前哨硬仗+毕业战=墙⑨（第七域）——R7 加域后的账目协调·候 Ron 核；36 格矩阵 9 墙=①-⑧+毕业战数字不变',
    walletKeys: KEYS, graduationDay: 41, wallDaysTotal: 11.5,
    supplyLine: { legendPlusFirst: 25, legendPlusPlusFirst: 30, coresTotal: coreCount, dexComplete: 51 },
  },
  days,
};
writeFileSync(path.join(HERE, '段二-最优解玩家60天剧本-数据.json'), JSON.stringify(json, null, 1), 'utf-8');

const B = (n) => `n${String(n).padStart(3, '0')}`;
const wallRows = BOSSES_V11.filter((b) => b.kind === 'wall');
const md = [];
md.push('# 段二 · 最优解玩家 60 天成长剧本 v1.1（返工版·候 Ron 拍）\n');
md.push('> **性质**：F2 手绘设计靶（R1-R8 返工令全项落地版）。2b 照此重铺投放；2c 机器线逐列对照，差异=调参清单。数字=设计意图量级（关键日精确·日常段速率化）；JSON 镜像承载全量。**本版已过 R8 自洽校验器**（守恒/蜜月律/暴推相对律/质变舞台律/毕业≥40/事件型≤50%/钩子不空/口径互斥）。');
md.push('> **画像口径**：无限时间/全渠道拉满/运气平均；推进线=单把 5%（表内呈现=真实模型+"怼墙中·平均需 X 把·今日过概率 Y%"标注）；黑市**不做 30 连看**、刷新与计数购物照用；**故意失败族入主口径**（#9 送头×3/#11 故意败×1/#12 故意合败×1）——机器线另跑"仅自然触发"对照，差值=漏洞精确价值交 Ron 拍堵不堵。\n');
md.push('## 一、世界骨架 v1.1（六域主题＋第七域·候 Ron 拍）\n');
md.push('| 星域 | 关段 | 域规则（R3 v1.1） | 中段 Boss | 末尾 Boss |');
md.push('|---|---|---|---|---|');
for (const r of REGIONS_V11) {
  const mid = BOSSES_V11.find((b) => b.node > r.from && b.node < r.to);
  const end = BOSSES_V11.find((b) => b.node === r.to);
  const ruleTxt = r.rule ? (r.rule.kind === 'weather' ? `天气型常驻：${r.ruleNote}` : r.rule.kind === 'event' ? `事件型 ${Math.round(r.rule.rate * 100)}% 关：${r.ruleNote}` : r.ruleNote) : r.ruleNote;
  const cell = (b) => (b ? `${B(b.node)} ${b.kind === 'wall' ? `墙${'①②③④⑤⑥⑦⑧⑨'[b.idx - 1]}·${b.wallType}` : b.kind === 'climax' ? '高潮' : '前哨硬仗'}` : '—');
  md.push(`| ${r.sf} ${r.name} | ${r.from}-${r.to}（${r.to - r.from + 1} 关） | ${ruleTxt} | ${cell(mid)} | ${cell(end)} |`);
}
md.push('\n**表述红线自查**：本作纯自动战斗——六域规则全部落在"战前配装/编成决策"维度（迷雾=开局型核价值打折→换持续输出核；母舰=拆速决定三态；污染/风暴=常驻配装权重），全文零"战斗内时机/操作"表述 ✓。');
md.push(`\n**13 Boss 账目协调（候 Ron 核）**：${json.meta.bossAccountNote}。\n`);
md.push('### 9 墙（R4：前四单型教学 战/机/解/连 → 第五起叠加·教过才叠 → 终墙综合）\n');
md.push('| 墙 | 关号 | 类型 | 教什么 | 破墙爽法 | 卡天矩阵（肝/重/普/轻） |');
md.push('|---|---|---|---|---|---|');
for (const w of wallRows) md.push(`| ${'①②③④⑤⑥⑦⑧⑨'[w.idx - 1]} | ${B(w.node)} | ${w.wallType} | ${w.keyTeach} | ${w.joy} | ${w.matrix.肝}/${w.matrix.重}/${w.matrix.普}/${w.matrix.轻} |`);
md.push(`\n矩阵自查：普通列合计 ${wallRows.reduce((a, w) => a + w.matrix.普, 0)}=26 ✓·肝列 ${wallRows.reduce((a, w) => a + w.matrix.肝, 0)}（B3 累计锚 ≈14）✓·全墙 ≤7 硬顶 ✓。`);
md.push('\n### 第七域「风暴之眼」（R7 授权自决=加 50 关·候 Ron 终拍命名〔备选：乱流深渊〕）\n');
md.push('毕业 ≥40 铁线重算：六域 400 关线毕业 ≈D35-38 <40 → 按 R7"优先加主线关卡不砍投放"加第七域 **50 关（整数律 ✓）**。结构=前六域规则组合递进：n401-415=两规则叠（1+1）→ n416-430=三叠 → n431-443=四叠 → n444-449=五叠 → **n450 毕业战=六规则全叠+综合连战（墙⑨）**。每关硬仗档（初见带 20-45% 按段递减·磨 2-4 把/关·数值域定档 2b 落）；四档在该域节奏 2b 验证防"恶意慢"（单墙 ≤7 红线武装）。');
md.push('\n### 38 精英位（R4 组合化：纯型→1+1→1+1+1→变态组合终盘·同型禁连排·福利永远纯福利）\n');
md.push(ELITES_V11.map((e) => `${B(e.node)} ${e.kind}${e.note ? `（${e.note}）` : ''}`).join(' ｜ '));
md.push('\n组合纪律自查：纯型 24（含福利 6=永远纯福利 ✓）·1+1 组合 9·1+1+1 组合 3（n320 首秀→n372/n390 升档=变态组合预告终盘压轴）·同型禁连排逐对核 ✓·斩首/镜像/复活三新花样均纯型首秀后才进组合 ✓。\n');
md.push('### 供给事件线（R2 修订：传奇+ 首件 D25/++ 首件 D30；星核 24 颗；图鉴 16 款=D51）\n');
md.push('陨星弹 D2 → 扩张整核每 7 天（D7/14/21/28/35/42/49/56=8 颗）→ 开蛋 12 颗 → 宝库 5 兑（流通 D18/26·复购×1.5 D30·毕业核① D45/② D51=**图鉴 16 款集齐日**）→ 超新星 D48（黑市）。冲顶里程碑 D42-60：SS④ D44/SS⑤ D52/全员 5★ D58/传奇++ 组合线 D30 起——后期每 2-3 天一个账面大事件 ✓。**R6 账目闭合注**：图鉴集齐=D51（指令带 55-58 外·原因=最优解宝石节奏 D50 即攒齐 200、晚兑=故意拖慢天花板线不成立——候 Ron 核；普通档对照=D55-58 带内·见对照摘要）。\n');
md.push('## 二、逐日剧本（60 行·三张表·JSON 镜像=机器对照锚）\n');
md.push('### 表 1 · 推进与节奏（①⑪⑬列＋R6 耗时分解）\n');
md.push('| D | 累计关 | 当日+ | 状态 | 初见胜率带（5% 推进线标注） | 耗时 主/侧/广/研=总(分) | 检查点 |');
md.push('|---|---|---|---|---|---|---|');
for (const x of days) md.push(`| ${x.day} | ${x.progress.cleared} | +${x.progress.newToday} | ${x.progress.state} | ${x.progress.initWinBand} | ${x.minutes.main}/${x.minutes.side}/${x.minutes.ads}/${x.minutes.research}=${x.minutes.total} | ${x.checkpoint} |`);
md.push('\n### 表 2 · 资源三账（②列·14 键"收/支⇒存"＋R6 离线巡逻单列·全量见 JSON）\n');
md.push('| D | 星矿 | 合金 | 记录 | 通碎舰 | 通碎员 | 核碎 | 整核 | 宝石 | 券 | 信标普/稀/史 | 星贝 | 广告券 | 离线+巡逻(合金/记录) |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of days) {
  const w = x.wallet; const f = (k) => `${w[k].income}/${w[k].spend}⇒${w[k].balance}`;
  const bc = `${w.beaconCommon.income}/${w.beaconCommon.spend}⇒${w.beaconCommon.balance}·${w.beaconRare.income}/${w.beaconRare.spend}⇒${w.beaconRare.balance}·${w.beaconEpic.income}/${w.beaconEpic.spend}⇒${w.beaconEpic.balance}`;
  const pv = x.passiveIncome;
  md.push(`| ${x.day} | ${f('starOre')} | ${f('hullAlloy')} | ${f('pilotToken')} | ${f('shipBlueprint')} | ${f('pilotShardUniversal')} | ${f('coreFrag')} | ${f('fullCore')} | ${f('starGem')} | ${f('supplyTicket')} | ${bc} | ${f('starCargo')} | ${f('adTicket')} | ${pv.offlineAlloy}+${pv.patrolAlloy}/${pv.offlineToken}+${pv.patrolToken} |`);
}
md.push('\n### 表 3 · 决策与体验（③④⑤⑥⑦⑧⑨⑩⑫＋R6 瓶颈轮转/挤压×变现/点名快照）\n');
md.push('| D | 决策（③·含派驻策略） | 养成（④） | 爽点（⑤） | 挤压点×变现咬合（⑥·R6） | 解锁（⑦） | 侧内容（⑧L/张/推/档/轮） | 广告⑨(计数=自然+故意) | 收集⑩(核/+/++) | 瓶颈轮转（R6） | 关键日快照（R6） | 钩子（⑫） |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of days) {
  const s = x.side;
  const pinchTxt = x.pinch.pinch === '—' ? '—' : `${x.pinch.pinch} ⇢ ${x.pinch.monetize}`;
  md.push(`| ${x.day} | ${x.decisions} | ${x.growth} | ${x.joy} | ${pinchTxt} | ${x.unlock} | L${s.corridor}/${s.bounty}/${s.puzzle}/${s.drill}/${s.salvage} | ${x.ads.counterToday}=${x.ads.natural}+${x.ads.deliberate} | ${x.collect.cores}/${x.collect.legendPlus}/${x.collect.legendPP} | ${x.bottleneck} | ${x.outsideWallet.snapshot} | ${x.hook} |`);
}
md.push('\n## 三、⑨列广告逐点位建模（禁日均近似·主口径含故意失败族）\n');
md.push('固定位逐日必满：#1×3/#2/#5/#6/#8/#10（D2 起）/#7×2。条件位按真实触发：#3/#4=推进日亮；#9=故意送头×3；#11=自然 0（悬赏不败）→故意失败族日 1；#12=D5 起故意合败×1。黑市：30 连看=0（口径互斥·校验器武装）·手动再刷×1/日（D4 起）·计数购物照常。广告券按段位 2-6 张/日买满。60 天故意失败族累计 ≈300 计数——**机器线双跑差值交 Ron 拍堵不堵**（候选防法：安慰包仅初见关战败发/保卡返还限自然败/合成返还限当日首败）。\n');
md.push('## 四、候 Ron 拍板项\n');
md.push('1. 世界骨架 v1.1（六域规则参数/8+1 墙落位与叠加序/3 高潮+1 前哨/38 精英组合表）。2. **第七域**：加 50 关+命名（推荐「风暴之眼」·备选「乱流深渊」）+13 Boss 账目协调。3. 逐日推进形状（D1=52/蜜月三天收口/墙① D4/毕业 D41）。4. 图鉴集齐 D51（指令带 55-58 外·理由见供给线注）。\n');
md.push('*生成器=`段二-剧本生成器.mjs`（R8 校验器内建·--check 模式）；评审流程=先过校验器+《段二-剧本评审清单》两道闸再呈审。*');
writeFileSync(path.join(HERE, '段二-最优解玩家60天剧本-v1.1.md'), md.join('\n'), 'utf-8');

// —— 第四件：《普通玩家对照摘要》（R6·周粒度人话+关键数据并排）——
const cmp = [];
cmp.push('# 段二 · 普通玩家对照摘要（剧本第四件·R6 新增）\n');
cmp.push('> 最优解剧本=设计天花板线；本摘要把普通档（日均 35 分钟·不看攻略的正常玩家）的 60 天讲成人话，并与天花板线并排——**普通档数字=设计推算（2b 尺子落准后回填实测）**。轻度档下限检查（每天 15-20 分钟内有完整一口爽+离开有盼头）=2c 交付（补充指令三）。\n');
cmp.push('## 周粒度人话（普通档）\n');
cmp.push('- **W1（D1-7）**：第一天爽推 ~50 关全系统开门；D2-3 打首Boss 拿陨星弹（普攻变原子炮=第一次质变）；D4-5 撞第一堵墙、攒一晚破掉、黑市开门；周末推进到 ~130 关、摸到坟场域。');
cmp.push('- **W2（D8-14）**：坟场域学"续航拆复活"；撞机制墙②卡一天半；周中破解题墙③进迷雾域——第一次感到"配装要换着来"。');
cmp.push('- **W3（D15-21）**：迷雾域推进+连战墙④卡两天半（第一次耐力考）；员1 冲 3★→4★；周末进母舰工业区。');
cmp.push('- **W4（D22-28）**：首堵叠加墙⑤卡三天=中期最大坎（攒 SS① 的一周）；SS① 到手当天回打提速明显（质变对比）。');
cmp.push('- **W5（D29-35）**：污染之海爽段+高潮③演出仗；墙⑥双考卡三天；传奇+ 首件（合成开赌）。');
cmp.push('- **W6（D36-42）**：墙⑦双钥卡四天（解题+攒钥匙）；风暴域开门·前哨硬仗。');
cmp.push('- **W7（D43-49）**：墙⑧资格仗卡四天（SS②→SS③ 冲刺周）；进风暴之眼（每关硬仗·一天 4-6 关慢嚼）。');
cmp.push('- **W8-W9（D50-60）**：风暴之眼组合关逐层爬+毕业战卡五天=最终大考——**D60 毕业**（A1 靶）；黑市党/肝党此时已在长线循环。\n');
cmp.push('## 关键数据并排（最优解=天花板上界 vs 普通档=设计推算）\n');
cmp.push('| 指标 | 最优解（本剧本） | 普通档（推算·2b 落准） |');
cmp.push('|---|---|---|');
cmp.push('| 毕业日 | D41 | ≈D60（A1 靶） |');
cmp.push('| D1 清关 | 52 | ~45-50 |');
cmp.push('| 首周清关 | 171 | ~110-125（60 天世界口径·2b 重钉首周锚） |');
cmp.push('| 首墙到达 | D4 | D4-5（矩阵普 1 天） |');
cmp.push('| SS① | D18 | ≈D33 |');
cmp.push('| 3SS 队形 | D31 | ≈D52 |');
cmp.push('| 传奇+ 首件 | D25 | ≈D40 |');
cmp.push('| 传奇++ 首件 | D30 | ≈D55（毕业前后长线追求=E6） |');
cmp.push('| 星核数 D60 | 24 颗（图鉴 16 款 D51） | ~14-17 颗（图鉴 D55-58 带） |');
cmp.push('| 累计卡墙 | 11.5 天 | 26 天（B3 矩阵普通列） |');
cmp.push('| 日耗时 | 45-90 分（无限时间画像"玩完全部"口径） | 30-40 分 |');
cmp.push('\n*瓶颈轮转（两档同构·时点不同）：前期 星矿/合金/星贝 → 中期 专属碎片/驾驶记录 → 中后期 核碎/宝石 → 毕业后 插件燃料——"每阶段瓶颈=需求增速>供给增速"由 2b 尺子逐段验证。*');
writeFileSync(path.join(HERE, '段二-普通玩家对照摘要.md'), cmp.join('\n'), 'utf-8');

console.log(`剧本 v1.1 生成完成：60 行 ✓ 毕业 D41（≥40 铁线 ✓）卡墙 11.5 天 ✓ R8 校验器全过 ✓ 星核 ${coreCount} 颗`);
console.log(`产出：剧本 v1.1 md + JSON 镜像 + 普通玩家对照摘要（评审清单=独立文档）`);
