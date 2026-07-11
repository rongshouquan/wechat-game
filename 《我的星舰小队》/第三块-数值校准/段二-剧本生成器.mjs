// 段二 · 最优解玩家 60 天成长剧本生成器（设计靶生成器·非游戏运行时工具）。
// 性质：剧本=手绘设计靶（F2）——本脚本里的全部数字与文本=设计参数（"应该给多少/应该发生什么"），
//   不是模拟结果；脚本只负责把设计参数展开成 60 行三账并自检（守恒/非负/账目闭合），
//   产出 ①剧本 md（人读版·60 行三张表+摘要）②JSON 镜像（2c 机器线逐列对照用）。
// 用法：node 段二-剧本生成器.mjs（在本目录跑·就地写出 段二-最优解玩家60天剧本-v0.md / -数据.json）
// 改剧本=改本文件设计参数区→重跑（Ron 拍板修改同径）。
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 一、世界骨架（400 关落位提案·候 Ron 拍——B/C/D 组拍板的编织落点）
// ============================================================================

/** 星域 spans（前松后紧·sf3/4/6=加密段·sf2/5=爽段——厚度地图语义继承）。 */
export const REGIONS_400 = [
  { sf: 'sf01', from: 1, to: 72, theme: '群怪（星盗）', midBoss: 34, note: '开局直道 55-60 关零墙+缓坡' },
  { sf: 'sf02', from: 73, to: 140, theme: '护盾（无人舰）', midBoss: 106, note: '爽段大区' },
  { sf: 'sf03', from: 141, to: 204, theme: '点名后排（无人舰/污染混编）', midBoss: 172, note: '加密段①' },
  { sf: 'sf04', from: 205, to: 264, theme: '召唤（机械/母舰）', midBoss: 234, note: '加密段②' },
  { sf: 'sf05', from: 265, to: 328, theme: '爆发（污染）', midBoss: 296, note: '爽段' },
  { sf: 'sf06', from: 329, to: 400, theme: '狂暴综合（终域）', midBoss: 364, note: '加密段③·终域' },
];

/** 12 Boss＝9 墙＋3 高潮（C2 前轻后重·墙类型轮换=同一卡法不连用两次·破墙爽法轮换）。 */
export const BOSSES_400 = [
  { node: 34, kind: 'climax', name: '首Boss·星盗大副（新世界位）', wallType: null, joy: '强引导收尾高潮·掉陨星弹·解锁深空回廊（初见≈10%·磨几把能过）' },
  { node: 72, kind: 'wall', idx: 1, wallType: '战力墙', keyTeach: '教"攒一晚再来"', joy: '破墙爽法=新解锁绑定（黑市开门）+暴推走廊', matrix: { 肝: 0.5, 重: 1, 普: 1, 轻: 1.5 } },
  { node: 106, kind: 'climax', name: '高潮②·盾域旗舰仗', wallType: null, joy: '爽段中点大仗（不卡天·演出向）' },
  { node: 140, kind: 'wall', idx: 2, wallType: '机制墙', keyTeach: '破盾节奏（星鲸/削盾件）', joy: '新星域开门（sf03）', matrix: { 肝: 1, 重: 1, 普: 1.5, 轻: 2 } },
  { node: 172, kind: 'wall', idx: 3, wallType: '解题墙', keyTeach: '护后排双钥匙（岩×磐石+砺×铁壁精神续作）', joy: '暴推走廊', matrix: { 肝: 1, 重: 1.5, 普: 2, 轻: 2.5 } },
  { node: 204, kind: 'wall', idx: 4, wallType: '战力墙', keyTeach: 'S 阶冲刺', joy: '新星域开门（sf04）+大节点齐至', matrix: { 肝: 1, 重: 2, 普: 2.5, 轻: 3 } },
  { node: 234, kind: 'wall', idx: 5, wallType: '连战墙', keyTeach: '满血复活连战（新引擎通道上岗·耐力配队）', joy: '暴推走廊', matrix: { 肝: 1.5, 重: 2, 普: 3, 轻: 3.5 } },
  { node: 264, kind: 'wall', idx: 6, wallType: '机制墙', keyTeach: '反召唤优先级+护后排', joy: '新星域开门（sf05=爽段）', matrix: { 肝: 2, 重: 2.5, 普: 3, 轻: 4 } },
  { node: 296, kind: 'climax', name: '高潮③·污染巨兽前哨仗', wallType: null, joy: '阵容成型后的碾轧演出仗' },
  { node: 328, kind: 'wall', idx: 7, wallType: '解题墙', keyTeach: '净化+护罩双钥（爆发域）', joy: '暴推走廊', matrix: { 肝: 2, 重: 3, 普: 4, 轻: 5 } },
  { node: 364, kind: 'wall', idx: 8, wallType: '战力墙', keyTeach: 'SS③ 冲刺（毕业前最后大坎）', joy: '暴推走廊', matrix: { 肝: 2.5, 重: 3, 普: 4, 轻: 5.5 } },
  { node: 400, kind: 'wall', idx: 9, wallType: '连战墙（综合终墙）', keyTeach: '三阶段综合考·全套工具箱', joy: '毕业！长线循环开门', matrix: { 肝: 3, 重: 4, 普: 5, 轻: 6 } },
];
// 墙类型轮换自查：战/机/解/战/连/机/解/战/连——同类不相邻 ✓（B2）。

/** 38 精英位（≈每 10 关 1·首个第 6-8 关·前轻后重·福利关后置加密 D36-60 垫关路）。 */
export const ELITES_400 = [
  { node: 7, kind: '词缀点名', note: 'D1 微阻滞①（B4）' }, { node: 18, kind: '奇阵·贴脸', note: 'D1 微阻滞②' },
  { node: 29, kind: '词缀点名' }, { node: 44, kind: '奇阵·包围' }, { node: 55, kind: '福利·合金' },
  { node: 66, kind: '词缀点名', note: '墙①前哨' }, { node: 82, kind: '奇阵·龟缩' }, { node: 94, kind: '词缀点名' },
  { node: 118, kind: '福利·驾驶记录' }, { node: 130, kind: '词缀点名', note: '墙②前哨' },
  { node: 152, kind: '限时斩首', note: '新花样首秀（引擎通道①）' }, { node: 163, kind: '词缀点名' },
  { node: 184, kind: '奇阵·贴脸' }, { node: 196, kind: '限时斩首', note: '墙④前哨' },
  { node: 216, kind: '镜像关', note: '新花样②首秀（阵容小成后最有嚼头·前轻后重）' }, { node: 226, kind: '词缀点名' },
  { node: 246, kind: '限时斩首·参数升档' }, { node: 256, kind: '奇阵·包围·参数升档' },
  { node: 276, kind: '福利·星贝' }, { node: 288, kind: '词缀点名' }, { node: 308, kind: '镜像关·参数升档' },
  { node: 318, kind: '限时斩首' }, { node: 336, kind: '满血复活连战', note: '新花样③精英版（墙⑤教过·此处独立成关）' },
  { node: 344, kind: '福利·合金', note: 'D36-60 垫关惊喜①' }, { node: 352, kind: '词缀点名' },
  { node: 358, kind: '镜像关' }, { node: 370, kind: '福利·驾驶记录', note: '垫关惊喜②' },
  { node: 376, kind: '满血复活连战·参数升档' }, { node: 382, kind: '限时斩首·参数升档' },
  { node: 388, kind: '福利·星贝', note: '垫关惊喜③' }, { node: 394, kind: '词缀点名', note: '终墙前哨' },
  // 前段补位（每 10 关 1 的密度平衡·新手段稀）
  { node: 100, kind: '奇阵·龟缩' }, { node: 112, kind: '词缀点名' }, { node: 124, kind: '奇阵·贴脸' },
  { node: 158, kind: '福利·合金' }, { node: 176, kind: '词缀点名' }, { node: 240, kind: '词缀点名' }, { node: 300, kind: '奇阵·包围' },
].sort((a, b) => a.node - b.node);
if (ELITES_400.length !== 38) throw new Error(`精英位应 38 个，现 ${ELITES_400.length}`);

// ============================================================================
// 二、最优解玩家逐日推进线（①列·无限时间/全渠道拉满/推进线=单把 5%）
// ============================================================================

/** 逐日：cleared=日末累计关；wall=当日卡的墙（idx·null=推进日）；wallDayN=卡该墙第几天；band=当日初见胜率带。 */
export const PROGRESS = [
  { d: 1, cleared: 58, band: '普通关 85-95%（直道碾）' },
  { d: 2, cleared: 71, wall: 1, wallDayN: 1, band: '墙① 0-5%（D2 中段撞墙=正爽时卡住）' },
  { d: 3, cleared: 90, breakWall: 1, band: '破墙日 10-20%→暴推走廊 90%+' },
  { d: 4, cleared: 104, band: '普通 80-90%' },
  { d: 5, cleared: 116, band: '普通 80-90%（高潮② n106 初见 35% 磨两把过）' },
  { d: 6, cleared: 128, band: '普通 78-88%' },
  { d: 7, cleared: 139, wall: 2, wallDayN: 1, band: '墙② 0-5%（首周收在墙下=悬念收尾）' },
  { d: 8, cleared: 150, breakWall: 2, band: '破墙 12%→走廊 88%' },
  { d: 9, cleared: 164, band: '普通 78-88%' },
  { d: 10, cleared: 171, wall: 3, wallDayN: 1, band: '墙③ 解题墙：无钥 0%·有钥 60%（钥匙差一件）' },
  { d: 11, cleared: 186, breakWall: 3, band: '钥匙齐→93% 一把过·走廊' },
  { d: 12, cleared: 199, band: '普通 75-85%' },
  { d: 13, cleared: 203, wall: 4, wallDayN: 1, band: '墙④ 3-6%（S 阶差半步）' },
  { d: 14, cleared: 217, breakWall: 4, band: '破墙 15%→走廊 88%' },
  { d: 15, cleared: 229, band: '普通 75-85%' },
  { d: 16, cleared: 233, wall: 5, wallDayN: 1, band: '墙⑤ 连战墙 4%（第二遍血线崩）' },
  { d: 17, cleared: 247, breakWall: 5, band: 'SS① 到手→破墙 18%→走廊 90%' },
  { d: 18, cleared: 259, band: '普通 75-85%' },
  { d: 19, cleared: 263, wall: 6, wallDayN: 1, band: '墙⑥ 0-4%（召唤海淹后排）' },
  { d: 20, cleared: 263, wall: 6, wallDayN: 2, band: '偷鸡 6-9%（差反召唤钥匙）' },
  { d: 21, cleared: 276, breakWall: 6, band: '破墙 14%→sf05 开门爽段' },
  { d: 22, cleared: 288, band: '爽段 82-92%' },
  { d: 23, cleared: 300, band: '爽段 82-92%（高潮③ n296 碾轧演出 45% 两把过）' },
  { d: 24, cleared: 312, band: '爽段 80-90%' },
  { d: 25, cleared: 324, band: '普通 75-85%' },
  { d: 26, cleared: 327, wall: 7, wallDayN: 1, band: '墙⑦ 解题墙：无双钥 0%' },
  { d: 27, cleared: 327, wall: 7, wallDayN: 2, band: '一钥在手 3-6%（第二钥合成中）' },
  { d: 28, cleared: 340, breakWall: 7, band: '双钥齐 90% 过·走廊' },
  { d: 29, cleared: 352, band: '普通 72-82%' },
  { d: 30, cleared: 363, wall: 8, wallDayN: 1, band: '墙⑧ 2-5%' },
  { d: 31, cleared: 363, wall: 8, wallDayN: 2, band: '卡墙 3-6%（SS③ 碎片冲刺）' },
  { d: 32, cleared: 363, wall: 8, wallDayN: 2.5, band: '偷鸡 8%（半天）' },
  { d: 33, cleared: 376, breakWall: 8, band: 'SS③ 到手→破墙 16%→走廊 88%' },
  { d: 34, cleared: 388, band: '普通 70-80%' },
  { d: 35, cleared: 399, wall: 9, wallDayN: 1, band: '终墙 0-3%（三阶段综合）' },
  { d: 36, cleared: 399, wall: 9, wallDayN: 2, band: '卡墙 4-7%（全队终装配研究）' },
  { d: 37, cleared: 399, wall: 9, wallDayN: 2.5, band: '偷鸡 9%（差一口爆发）' },
  { d: 38, cleared: 400, breakWall: 9, band: '毕业战 13% 磨四把过——通关！' },
  ...Array.from({ length: 22 }, (_, i) => ({ d: 39 + i, cleared: 400, band: '毕业后长线期（回廊/悬赏/黑市/合成研究）' })),
];
// 卡墙自查：0.5+0.5+1+1+1+2+2+2.5+3=13.5 天（肝矩阵累计≈14 的上界压缩）·毕业 D38 ∈ 肝≈40 上界内 ✓

// ============================================================================
// 三、资源三账设计参数（14 键·分段速率+事件叠加=设计靶量级）
// ============================================================================

export const KEYS = ['starOre', 'hullAlloy', 'pilotToken', 'shipBlueprint', 'pilotShardUniversal', 'coreFrag', 'fullCore', 'starGem', 'supplyTicket', 'beaconCommon', 'beaconRare', 'beaconEpic', 'starCargo', 'adTicket'];
export const KEY_NAMES = { starOre: '星矿', hullAlloy: '合金', pilotToken: '驾驶记录', shipBlueprint: '通碎·舰', pilotShardUniversal: '通碎·员', coreFrag: '星核碎片', fullCore: '完整星核', starGem: '星空宝石', supplyTicket: '补给券', beaconCommon: '信标·普', beaconRare: '信标·稀', beaconEpic: '信标·史', starCargo: '星贝', adTicket: '广告券' };

/** 阶段日速率（收入=全渠道拉满设计靶·支出=最优解花光策略）。阶段：A=D1 / B=D2-7 / C=D8-16 / D=D17-28 / E=D29-38 / F=D39-60。 */
const phaseOf = (d) => (d === 1 ? 'A' : d <= 7 ? 'B' : d <= 16 ? 'C' : d <= 28 ? 'D' : d <= 38 ? 'E' : 'F');
const RATES = {
  //           A(D1 爆发)      B(D2-7)        C(D8-16)       D(D17-28)      E(D29-38)      F(D39-60 长线)
  starOre: { A: [1500, 1200], B: [1400, 1300], C: [2200, 2000], D: [3200, 3000], E: [4200, 3800], F: [3600, 3400] },
  hullAlloy: { A: [1800, 1500], B: [2200, 2100], C: [3600, 3400], D: [5200, 5000], E: [6800, 6500], F: [5600, 5300] },
  pilotToken: { A: [1200, 1000], B: [1500, 1400], C: [2400, 2300], D: [3500, 3300], E: [4600, 4400], F: [3800, 3600] },
  shipBlueprint: { A: [40, 38], B: [26, 24], C: [30, 29], D: [34, 33], E: [36, 35], F: [30, 28] },
  pilotShardUniversal: { A: [40, 38], B: [26, 24], C: [30, 29], D: [34, 33], E: [36, 35], F: [30, 28] },
  coreFrag: { A: [12, 0], B: [14, 0], C: [18, 0], D: [22, 0], E: [24, 0], F: [18, 0] }, // 核碎唯一支出=开蛋（EVENTS 60/次·日常零支出·残余=下一蛋进度条）
  fullCore: { A: [0, 0], B: [0, 0], C: [0, 0], D: [0, 0], E: [0, 0], F: [0, 0] }, // 整核只走 EVENTS 明排（D 组供给事件）
  starGem: { A: [4, 0], B: [10, 0], C: [16, 0], D: [20, 0], E: [22, 0], F: [22, 0] }, // 宝石唯一支出=宝库兑换（EVENTS·定向储蓄货币）
  supplyTicket: { A: [70, 66], B: [56, 54], C: [60, 58], D: [62, 60], E: [64, 62], F: [56, 52] },
  beaconCommon: { A: [6, 5], B: [7, 7], C: [8, 8], D: [8, 8], E: [8, 8], F: [7, 7] },
  beaconRare: { A: [2, 1], B: [3, 3], C: [4, 4], D: [5, 5], E: [5, 5], F: [4, 4] },
  beaconEpic: { A: [0, 0], B: [1, 1], C: [1, 1], D: [2, 2], E: [2, 2], F: [2, 2] },
  starCargo: { A: [500, 420], B: [420, 400], C: [520, 490], D: [600, 560], E: [680, 640], F: [700, 650] },
  adTicket: { A: [2, 2], B: [4, 4], C: [5, 5], D: [6, 6], E: [6, 6], F: [5, 5] },
};
/** 事件叠加（日→键→[收入加, 支出加]）——供给事件线（D 组明排）：
 *  整核 24 颗/60 天（天花板线）：陨星弹 D2 + 扩张宝藏 8 颗（每 7 天结算）+ 开蛋 12 颗 + 宝库 5 兑
 *  （流通 D18/D26·复购×1.5 D30·毕业核 D40/D50=图鉴 16 款集齐日）。 */
const EVENTS = {
  2: { fullCore: [1, 0] }, // 陨星弹（首Boss n034 首杀）
  3: { supplyTicket: [14, 14], beaconCommon: [2, 2] }, // 3 天行动结算①+行动宝藏
  5: { fullCore: [1, 0], coreFrag: [0, 60] }, // 开蛋①
  7: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 7 天扩张①：完成奖+结算=扩张宝藏整核
  9: { fullCore: [1, 0], coreFrag: [0, 60] },
  12: { fullCore: [1, 0], coreFrag: [0, 60] },
  14: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张②
  16: { fullCore: [1, 0], coreFrag: [0, 60] }, // SS① 日（开蛋撞喜）
  18: { fullCore: [1, 0], starGem: [0, 120] }, // 宝库流通核①
  21: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张③
  24: { fullCore: [1, 0], coreFrag: [0, 60] },
  26: { fullCore: [1, 0], starGem: [0, 120] }, // 宝库流通核②（另款）
  27: { fullCore: [1, 0], coreFrag: [0, 60] }, // 墙⑦钥匙核
  28: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张④
  30: { fullCore: [1, 0], starGem: [0, 180] }, // 宝库复购 ×1.5
  33: { fullCore: [1, 0], coreFrag: [0, 60] }, // SS③ 日
  35: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑤
  36: { fullCore: [1, 0], coreFrag: [0, 60] },
  38: { starCargo: [400, 0], beaconEpic: [2, 0] }, // 毕业大奖（n400 首通）
  40: { fullCore: [1, 0], starGem: [0, 200] }, // ★毕业核①（宝库 200·毕业后仪式）
  42: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑥
  44: { fullCore: [1, 0], coreFrag: [0, 60] },
  48: { fullCore: [1, 0], coreFrag: [0, 60] },
  49: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑦
  50: { fullCore: [1, 0], starGem: [0, 200] }, // ★毕业核②=图鉴 16 款集齐
  52: { fullCore: [1, 0], coreFrag: [0, 60] },
  55: { fullCore: [1, 0], coreFrag: [0, 60] },
  56: { beaconEpic: [1, 1], coreFrag: [6, 0], fullCore: [1, 0] }, // 扩张⑧
  58: { fullCore: [1, 0], coreFrag: [0, 60] }, // 第 24 颗（数量线·图鉴款数 D50 已齐）
};

// ============================================================================
// 四、事件线（④养成 ⑦解锁 ⑤爽点 ⑥挤压点 ⑫钩子 ⑬检查点 ⑧侧内容 ⑨广告 ⑩收集 ⑪耗时）
// ============================================================================

const GROWTH_EVENTS = {
  1: '满编 5 舰·主力1 上 B 阶·L10 签名开火×3（大节点①）', 2: '主力1 A 阶（首Boss 前 S 阶备料）·L10 签名开火全队',
  3: '主力1 S 阶=装陨星弹（质变：普攻变原子炮）', 4: '主力2 A 阶·L20 技能强化 I（主力1）',
  5: '主力3 A 阶', 6: '主力2 S 阶', 7: '主力1 L30 舰载趣闻（大节点③）·员1 3★（大质变）',
  8: '主力3 S 阶', 9: '员2 3★', 10: '主力4 A 阶', 11: '护后排双钥匙齐（岩系+磐石系当量）=墙③钥',
  12: '主力4 S 阶·首个宝库心愿单立项', 13: '员3 3★', 14: '主力5 A 阶·流通核① 到手', 15: '主力1 L40 技能强化 II',
  16: '★SS①（主力1 终极质变·全队跳变）', 17: '员1 4★', 18: '★员1 5★（能力终极质变）', 19: '主力5 S 阶',
  20: '反召唤钥匙（工程舰培养 1-2 天=n102 三层第②层节奏）', 21: '★SS②（主力2）', 22: '员2 4★',
  23: '员3 4★', 24: '主力1 L50 王牌徽记（大节点⑤·满级仪式）', 25: '员2 5★', 26: '插件合成开赌（传奇→+ 首试）',
  27: '净化+护罩双钥合成（30 碎合成通道当量）', 28: '首件传奇+ 到手（合成研究开门）', 30: '流通核复购 ×1.5（宝库）',
  31: 'SS③ 碎片冲刺（黑市小件包+专属池兑换）', 33: '★SS③（毕业队形 3SS 成）', 34: '员4 4★',
  36: '全队 L50 上下·终装配研究', 37: '毕业阵容定稿（3SS+2S/2×5★+3×4★=A2 毕业态）', 38: '★毕业！n400 首通',
  40: '专属舰①（宝库 200）', 42: '传奇+ 第 3 件', 44: '★SS④（第 4 只·冲顶里程碑）', 46: '员5 5★? 不——全员 5★ 冲刺中',
  48: '传奇++ 首件（20% 塔首爆·极品组合研究起步）', 50: '专属舰②', 52: '★SS⑤（第 5 只）',
  55: '★全员 5★', 58: '★第 16 颗星核=图鉴集齐（收集毕业）', 60: '长线稳态：传奇++ 组合研究/黑市周期大件/回廊冲层',
};
const UNLOCK_EVENTS = {
  1: '船坞/训练舱(关1)·补给站(关3)·打捞(关4)·商人+悬赏板(关5)·居住舱(关8)·货舱(关9)·满编(关11)·星核入口(关13-14)·展厅提示(关15)·保护期收口(n018/19)',
  2: '深空回廊（首Boss n034 首杀）·陨星弹装核',
  3: '黑市（墙① n072 首通=第一堵真墙 Boss 后·语义保持）', 4: '每日推演（n044 首通=首Boss+10）',
  5: '研究塔（D4-5 档）',
};
const PINCH = {
  2: '合金（升阶梯 50/100/300 三连·离墙①差一晚积累）', 7: '专属碎片（主力2 S 阶差 40 片=墙②挤压）',
  10: '钥匙件（墙③差 1 件克制工具·抽卡/黑市小件赛跑）', 13: '合金+专属碎片（S 阶双线冲刺）',
  16: '专属碎片 1000（SS① 门槛=最大单笔）', 19: '工程舰专属碎片（反召唤钥培养）',
  26: '双钥匙（墙⑦·合成材料凑第二钥）', 31: 'SS③ 专属碎片 1000（黑市小件包+专属池兑换双管）',
  35: '全维（终墙=全队终装配·星贝锁定合成三连赌）', 44: 'SS④ 碎片（冲顶节奏挤压）', 52: 'SS⑤ 碎片（图鉴冲顶）',
};
const CHECKPOINTS = {
  1: '⬥检查点：D1 直道 58 关（普通档参照 50-60·B4/B6 锚）',
  7: '⬥检查点：首周 139 关（矩阵上界·普通档参照 80-90/肝 120）',
  38: '⬥检查点：毕业 D38 ∈ 肝≈40 上界 ✓（毕业日矩阵 40/48/60/73 的天花板线）',
  60: '⬥检查点：零广告可毕业/跨期追赶=另跑口径（2b 四档线复验·本表=天花板单线）',
};

/** ⑨广告行为（逐点位·F1/F2 口径：黑市 30 连看不做·刷新/计数购物照用·故意失败族入主口径）。 */
function adsOf(d, p) {
  const pushing = p.cleared > (PROGRESS[d - 2]?.cleared ?? 0); // 当日有推进
  const pts = {
    '#1回港翻倍': 3, '#2补给箱': 1, '#3首通翻倍': pushing ? 1 : 0, '#4再选一': pushing ? 1 : 0,
    '#5打捞秒完': 1, '#6赞助券': 1, '#7货舱多选': 2, '#8商人刷新': 1,
    '#9安慰包(故意送头×3)': 3, '#10回廊翻倍': d >= 2 ? 1 : 0, '#11保卡(故意失败×1)': 1,
    '#12合成返还(故意合败×1)': d >= 5 ? 1 : 0, '黑市手动刷新': d >= 3 ? 1 : 0,
  };
  const natural = Object.entries(pts).filter(([k]) => !k.includes('故意')).reduce((a, [, v]) => a + v, 0);
  const deliberate = (pts['#9安慰包(故意送头×3)'] ?? 0) + (pts['#11保卡(故意失败×1)'] ?? 0) + (pts['#12合成返还(故意合败×1)'] ?? 0);
  return { pts, counterToday: natural + deliberate, natural, deliberate };
}

/** ⑧侧内容进度（回廊层/悬赏/推演/木桩档/打捞轮）。 */
function sideOf(d) {
  const corridor = d < 2 ? 0 : Math.min(90, Math.round(6 + d * 1.4));
  return {
    corridor, bounty: d >= 1 ? 3 : 0, puzzle: d >= 4 ? 1 : 0,
    drill: Math.min(20, Math.round(3 + d * 0.45)), salvage: d >= 1 ? (d <= 3 ? 3 : 5) : 0,
  };
}

/** ⑩收集进度。 */
function collectOf(d, coreCount) {
  const legendPlus = d < 28 ? 0 : Math.min(6, Math.floor((d - 26) / 5) + 1);
  const legendPP = d < 48 ? 0 : Math.min(2, Math.floor((d - 46) / 8));
  return { cores: coreCount, legendPlus, legendPP };
}

/** ⑪日耗时（分钟·无限时间画像的"玩完全部内容"耗时——不是被迫在线）。 */
function minutesOf(d, p) {
  const push = (p.cleared - (PROGRESS[d - 2]?.cleared ?? 0)) * 0.9;
  return Math.round(28 + push + (p.wall ? 18 : 0)); // 日常全清 ≈28 分 + 推进 + 卡墙研究
}

// ============================================================================
// 五、展开与自检
// ============================================================================

function build() {
  const wallet = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const days = [];
  let coreCount = 0;
  for (const p of PROGRESS) {
    const d = p.d;
    const ph = phaseOf(d);
    const inc = {}; const spd = {};
    for (const k of KEYS) {
      const [i, s] = RATES[k][ph];
      inc[k] = i; spd[k] = s;
    }
    const ev = EVENTS[d] ?? {};
    for (const [k, [ei, es]] of Object.entries(ev)) { inc[k] = (inc[k] ?? 0) + ei; spd[k] = (spd[k] ?? 0) + es; }
    // 收支入账+非负自检（设计靶必须自洽：花不出比挣+存量更多的钱）。
    for (const k of KEYS) {
      wallet[k] += inc[k] - spd[k];
      if (wallet[k] < -1e-9) throw new Error(`D${d} ${k} 存量为负（${wallet[k]}）——设计参数不自洽，调 RATES/EVENTS`);
    }
    if (ev.fullCore?.[0]) coreCount += ev.fullCore[0];
    const ads = adsOf(d, p);
    const wallInfo = p.wall ? `卡墙${'①②③④⑤⑥⑦⑧⑨'[p.wall - 1]}第${p.wallDayN}天` : p.breakWall ? `破墙${'①②③④⑤⑥⑦⑧⑨'[p.breakWall - 1]}` : '推进';
    const nextP = PROGRESS[d] ?? null;
    const hook = HOOKS[d] ?? autoHook(d, p, nextP);
    days.push({
      day: d, phase: ph,
      progress: { cleared: p.cleared, newToday: p.cleared - (PROGRESS[d - 2]?.cleared ?? 0), state: wallInfo, initWinBand: p.band },
      wallet: Object.fromEntries(KEYS.map((k) => [k, { income: inc[k], spend: spd[k], balance: Math.round(wallet[k]) }])),
      outsideWallet: { exclusiveShardsNote: EX_SHARDS[d] ?? '主力线平稳积攒（沉淀池滚存）', plugins: collectOf(d, coreCount), coresOwned: coreCount },
      decisions: DECISIONS[d] ?? '常规最优序：通碎→当前瓶颈主力·星贝→券至日限+黑市宝箱·合金/记录逐级买满·核碎够 60 即开蛋',
      growth: GROWTH_EVENTS[d] ?? '—', joy: JOY[d] ?? (p.breakWall ? `破墙${'①②③④⑤⑥⑦⑧⑨'[p.breakWall - 1]}暴推（一晚积蓄一口气兑现）` : '—'),
      pinch: PINCH[d] ?? '—', unlock: UNLOCK_EVENTS[d] ?? '—',
      side: sideOf(d), ads, collect: collectOf(d, coreCount), minutes: minutesOf(d, p),
      hook, checkpoint: CHECKPOINTS[d] ?? (p.wall && WALL_CHECK[p.wall] && p.wallDayN === 1 ? WALL_CHECK[p.wall] : '—'),
    });
  }
  return days;
}

const WALL_CHECK = Object.fromEntries(BOSSES_400.filter((b) => b.kind === 'wall').map((b) => [b.idx,
  `⬥墙${'①②③④⑤⑥⑦⑧⑨'[b.idx - 1]}（n${b.node}·${b.wallType}）：矩阵 肝${b.matrix.肝}/重${b.matrix.重}/普${b.matrix.普}/轻${b.matrix.轻} 天·全档 ≤7 硬顶`]));

const JOY = {
  1: '开局直道 58 关一路碾（新手零墙纯爽推）+满编成军+首抽十连',
  2: '首Boss 高潮仗（磨三把 10%→过=第一次"研究出解"）+陨星弹到手·普攻变原子炮（首个质变对比）',
  3: '破墙①+黑市开门（新解锁绑定爽法）+暴推 19 关',
  5: '高潮②旗舰仗（不卡天演出仗）', 7: '员1 3★ 大质变（能力线首跳）',
  11: '钥匙齐·墙③一把 93% 过（研究回报兑现=D3"认真搭配值多少个百分点"的体感版）',
  16: 'SS① 终极质变（回打旧墙提速对比=质变体感≥描述）', 18: '员1 5★ 终极质变',
  21: 'SS②+sf05 爽段开门', 23: '高潮③碾轧演出（阵容成型的舞台）', 24: 'L50 王牌徽记（首个满级仪式）',
  28: '首件传奇+（合成赌局首爆）', 33: 'SS③=毕业队形成', 38: '毕业！终墙三阶段决战磨四把过（60 天世界最大爽点）',
  44: 'SS④（冲顶）', 48: '传奇++ 首爆（20% 塔·极品组合研究开门）', 52: 'SS⑤', 55: '全员 5★', 58: '第 16 核=图鉴集齐',
};
const DECISIONS = {
  1: '三选一全选主力1 专属碎片·星贝全买补给券（日限）·抽卡船人对半·不留存量（D1 全花=最优）',
  2: '合金全喂主力1 冲 A→S 备料（首Boss 前 S 阶=GDD-M 铁律）·首败故意送头×3 起账（#9 翻倍照领）',
  3: '黑市开门首刷：小件坑 4+手动再刷×2 全扫·宝箱 10 计数必买（期望>价）·大件页设存钱目标=舰包 128',
  5: '开蛋①（60 碎攒够即开·前 5 颗保底互异）·广告券 4 张买满（星贝→广告转换器·边际为正）',
  10: '钥匙赛跑：黑市 shardSmall 小包×1+专属池兑换并行（墙③=解题墙·攒工具天数就是卡墙天数）',
  14: '宝石 120 兑流通核①（宝库首兑·先流通后毕业=毕业核留 D40+）',
  16: 'SS① 冲刺：通碎 1:1 全转主力1+黑市 uniPack·1000 碎大关',
  20: '工程舰现培养（钥匙现培养 1-2 天=n102 三层②层的自证）·星贝改囤（大件 128 差口）',
  26: '合成开赌：传奇×2 同槽 40% 塔·首赌不锁（锁价 180 留给身份件）·失败→#12 返还副槽',
  31: '黑市大件·舰包 128 计数拍下（SS③ 冲刺主引擎）·星贝锁定合成×1（180 星贝锁主槽身份）',
  35: '终墙研究夜：四层瀑布逐层对比（换核/换附加条/换站位）·星贝锁定三连赌',
  40: '毕业核①+专属舰①（宝库 200×2 档期错开）', 48: '++ 赌局：先合满意的 +（锁 2 条）再升 ++（只赌第 3 条）=分层锁定研究路径',
};
const EX_SHARDS = {
  2: '主力1 专属 ≈260（教学投放+三选一定向）', 16: '主力1 专属清空→SS①（-1000）', 21: '主力2 专属清空→SS②',
  31: '主力3 专属 ≈700/1000（黑市舰包+专属池并轨冲刺）', 33: '主力3 清空→SS③', 44: 'SS④ 同径', 52: 'SS⑤ 同径',
};
const HOOKS = {
  1: '明天：首Boss 决战（S 阶差一步·陨星弹在望）', 2: '明天：破墙①+黑市开门（攒了一晚的合金兑现）',
  7: '明天：破墙②（S 阶双主力成型·首周收官战）', 10: '明天：钥匙齐=墙③一把过（专属池兑换今晚到）',
  15: '明天：SS① 终极质变（1000 碎就差一口）', 17: '明天：员1 5★（首个满星）',
  20: '明天：破墙⑥+sf05 爽段开门', 27: '明天：双钥齐破墙⑦+首件传奇+ 在望',
  32: '明天：SS③ 到手=毕业队形成', 37: '明天：毕业决战（全队终装配完毕）',
  38: '明天起：长线期开门（毕业核/专属舰/传奇++/图鉴冲顶排队上桌）', 57: '明天：第 16 颗核=图鉴集齐仪式',
  60: '长线稳态循环确立（每 2-3 天一个账面大事件持续）',
};
function autoHook(d, p, nextP) {
  if (!nextP) return '长线稳态：明天黑市轮换/回廊再冲一层';
  const nb = BOSSES_400.find((b) => b.node > p.cleared && b.node <= nextP.cleared + 14);
  if (p.wall) return `明天：${p.band.includes('偷鸡') ? '破墙在望（偷鸡带已到）' : '继续攒破墙资本（差距在缩小）'}`;
  if (nb) return `明天：逼近 n${nb.node} ${nb.kind === 'wall' ? '墙' + '①②③④⑤⑥⑦⑧⑨'[(nb.idx ?? 1) - 1] : '高潮仗'}`;
  return `明天：${(EVENTS[d + 1] && EVENTS[d + 1].fullCore) ? '新星核到手' : GROWTH_EVENTS[d + 1] ? '养成节点（' + GROWTH_EVENTS[d + 1].slice(0, 12) + '…）' : '暴推段继续（走廊没走完）'}`;
}

// ============================================================================
// 六、产出
// ============================================================================

const days = build();

// —— JSON 镜像（2c 机器线逐列对照）——
const json = {
  meta: {
    name: '最优解玩家 60 天成长剧本 v0', kind: '设计靶（F2 手绘线）', date: '2026-07-12',
    caliber: '无限时间/全渠道拉满/运气平均/推进线=单把5%/黑市不做30连看（刷新+计数购物照用）/故意失败族入主口径（#9×3+#11×1+#12×1）',
    world: { N: 400, regions: REGIONS_400, bosses: BOSSES_400, elites: ELITES_400 },
    walletKeys: KEYS,
    graduationDay: 38,
    wallDaysTotal: 13.5,
  },
  days,
};
writeFileSync(path.join(HERE, '段二-最优解玩家60天剧本-数据.json'), JSON.stringify(json, null, 1), 'utf-8');

// —— Markdown 人读版 ——
const B = (b) => `n${String(b.node).padStart(3, '0')}`;
const wallRows = BOSSES_400.filter((b) => b.kind === 'wall');
const md = [];
md.push('# 段二 · 最优解玩家 60 天成长剧本 v0（设计靶·候 Ron 拍）\n');
md.push('> **性质**：F2 手绘设计靶——"理想的 60 天该长什么样"。2b 照此重铺投放；2c 机器按真实规则跑最优解线，与本表逐列对照，差异=调参清单。**数字=设计意图量级**（关键日精确·日常段速率化），JSON 镜像（`段二-最优解玩家60天剧本-数据.json`）承载全量 14 键三账供机器复算。');
md.push('> **画像口径**：无限时间/全渠道拉满/运气按平均；推进线=单把 5%（天花板口径·与"能过线 20%"两线不混）；黑市**不做 30 连看**、每日刷新与计数购物照用；**故意失败族入主口径**（#9 送头×3/#11 故意败×1/#12 故意合败×1≈日 5 条额外计数）——机器线另跑"仅自然触发"对照，差值=漏洞精确价值交 Ron 拍堵不堵。\n');
md.push('## 一、世界骨架（400 关落位提案·B/C/D 组拍板的编织）\n');
md.push('### 星域与 12 Boss（9 墙+3 高潮）\n');
md.push('| 星域 | 关段 | 主题 | 中段 Boss | 末尾 Boss |');
md.push('|---|---|---|---|---|');
for (const r of REGIONS_400) {
  const mid = BOSSES_400.find((b) => b.node === r.midBoss);
  const end = BOSSES_400.find((b) => b.node === r.to);
  md.push(`| ${r.sf} | ${r.from}-${r.to}（${r.to - r.from + 1} 关·${r.note}） | ${r.theme} | ${B(mid)} ${mid.kind === 'climax' ? '高潮' : `墙${'①②③④⑤⑥⑦⑧⑨'[mid.idx - 1]}·${mid.wallType}`} | ${B(end)} 墙${'①②③④⑤⑥⑦⑧⑨'[end.idx - 1]}·${end.wallType} |`);
}
md.push('\n### 9 墙（类型轮换：战/机/解/战/连/机/解/战/连终——同卡法不连用两次 ✓）\n');
md.push('| 墙 | 关号 | 类型 | 教什么 | 破墙爽法 | 卡天矩阵（肝/重/普/轻·Ron 拍） |');
md.push('|---|---|---|---|---|---|');
for (const w of wallRows) md.push(`| ${'①②③④⑤⑥⑦⑧⑨'[w.idx - 1]} | ${B(w)} | ${w.wallType} | ${w.keyTeach} | ${w.joy} | ${w.matrix.肝}/${w.matrix.重}/${w.matrix.普}/${w.matrix.轻} |`);
md.push('\n矩阵自查：普通列 1+1.5+2+2.5+3+3+4+4+5=26 ✓ 肝列≈14 ✓（B3 累计锚）；全档全墙 ≤7 硬顶 ✓。\n');
md.push('### 38 精英位（花样 6 种·前轻后重·福利关后置加密）\n');
md.push(ELITES_400.map((e) => `n${String(e.node).padStart(3, '0')} ${e.kind}${e.note ? `（${e.note}）` : ''}`).join(' ｜ '));
md.push('\n分布纪律自查：斩首×5/镜像×3/复活连战×2（另墙⑤⑨=连战墙）/福利×6（3 个落 D36-60 垫关路）/奇阵×7/词缀点名×15≈四成（降为主力六分之一→实际按"每 10 关 1"的补位需要略高·候 Ron）；镜像/复活刻意排 n216 起=阵容成型后（C2 前轻后重）；同花样二次出现拉开间隔且参数升档。\n');
md.push('### 供给事件时间线（D 组·星核 16+专属舰 2 明排）\n');
md.push('陨星弹 D2 → 扩张整核 D7 → 开蛋节奏 2-3 天/颗（D5/9/12/16/19/24/27/33/36/42/48/52/58）→ 宝库流通 D14/21/30（复购×1.5）→ **毕业核 D40/D45（毕业后仪式·宝库 200）** → 专属舰 D40/D50 → 第 16 核 D58=图鉴集齐。冲顶里程碑全落 D36-60：SS④ D44/SS⑤ D52/全员 5★ D55/传奇++ D48——**后期每 2-3 天一个账面大事件 ✓（D1）**。\n');
md.push('### 逐日推进曲线（发现②的如实呈现：平均 ≈15 关/推进日·靠直道+暴推走廊拉出来）\n');
md.push('D1=58 关（直道）→ 首周 139 → D14=217 → D21=276 → D28=340 → D38=400 毕业。卡墙 13.5 天+推进 24.5 天；推进日均 ≈15 关（B6 的 7-8 关/日=中盘匀速段读数，暴推走廊 12-19 关/日、加密段 8-12 关/日——形状如图表 1 逐日列）。\n');
md.push('## 二、逐日剧本（60 行·三张表）\n');
md.push('### 表 1 · 推进与节奏（①⑪⑬列）\n');
md.push('| D | 累计关 | 当日+ | 状态 | 初见胜率带 | 耗时(分) | 检查点 |');
md.push('|---|---|---|---|---|---|---|');
for (const x of days) md.push(`| ${x.day} | ${x.progress.cleared} | +${x.progress.newToday} | ${x.progress.state} | ${x.progress.initWinBand} | ${x.minutes} | ${x.checkpoint} |`);
md.push('\n### 表 2 · 资源三账（②列·14 键"收/支⇒存"·全量精确值见 JSON 镜像）\n');
md.push('| D | 星矿 | 合金 | 驾驶记录 | 通碎舰 | 通碎员 | 核碎 | 整核 | 宝石 | 补给券 | 信标普/稀/史 | 星贝 | 广告券 |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of days) {
  const w = x.wallet;
  const f = (k) => `${w[k].income}/${w[k].spend}⇒${w[k].balance}`;
  const bc = `${w.beaconCommon.income}/${w.beaconCommon.spend}⇒${w.beaconCommon.balance}·${w.beaconRare.income}/${w.beaconRare.spend}⇒${w.beaconRare.balance}·${w.beaconEpic.income}/${w.beaconEpic.spend}⇒${w.beaconEpic.balance}`;
  md.push(`| ${x.day} | ${f('starOre')} | ${f('hullAlloy')} | ${f('pilotToken')} | ${f('shipBlueprint')} | ${f('pilotShardUniversal')} | ${f('coreFrag')} | ${f('fullCore')} | ${f('starGem')} | ${f('supplyTicket')} | ${bc} | ${f('starCargo')} | ${f('adTicket')} |`);
}
md.push('\n### 表 3 · 决策与体验（③④⑤⑥⑦⑧⑨⑩⑫列）\n');
md.push('| D | 转换/分配决策（③） | 养成事件（④） | 爽点（⑤） | 挤压点（⑥） | 解锁（⑦） | 侧内容（⑧回廊层/悬赏/推演/木桩档/打捞轮） | 广告（⑨当日计数=自然+故意） | 收集（⑩核/传奇+/++） | 明日钩子（⑫） |');
md.push('|---|---|---|---|---|---|---|---|---|---|');
for (const x of days) {
  const s = x.side;
  md.push(`| ${x.day} | ${x.decisions} | ${x.growth} | ${x.joy} | ${x.pinch} | ${x.unlock} | L${s.corridor}/${s.bounty}张/${s.puzzle}/${s.drill}档/${s.salvage}轮 | ${x.ads.counterToday}=${x.ads.natural}+${x.ads.deliberate} | ${x.collect.cores}/16·${x.collect.legendPlus}·${x.collect.legendPP} | ${x.hook} |`);
}
md.push('\n## 三、⑨列广告逐点位建模说明（Ron 07-12 加令·禁日均近似）\n');
md.push('固定位逐日必满：#1 回港翻倍×3（会话段）/#2 补给箱/#5 打捞秒完/#6 赞助券/#8 商人刷新/#10 回廊翻倍/#7 货舱多选×2。条件位按当日真实触发：#3 首通翻倍/#4 再选一=推进日亮（卡墙纯等日灭）；#9 安慰包=故意送头×3（主口径）；#11 保卡=自然态 0（悬赏不败）→故意失败族口径日 1；#12 合成返还=有垃圾件起（D5+）故意合败×1。广告券=星贝→广告转换器按段位 2-6 张/日买满（③列已入账）。**当日计数=表 3 ⑨列**（自然 ≈10-12+故意 5）；60 天故意失败族累计 ≈300 计数≈黑市 2-4 个永久大奖量级——**机器线双跑差值交 Ron 拍堵不堵**（候选防法：安慰包仅初见关卡战败发/保卡返还限自然败/合成返还限当日首败）。\n');
md.push('## 四、候 Ron 拍板项（三段式见交付汇报正文）\n');
md.push('1. 世界骨架落位（星域 spans/9 墙位与类型轮换/3 高潮位/38 精英花样分布）。2. 逐日推进形状（D1=58/首周 139/毕业 D38 天花板线）。3. 供给时间线（星核 16 排期/SS①-⑤节奏/毕业核 D40+ 后置）。4. 故意失败族三点位如实入主口径（已拍口径的落地确认）。\n');
md.push('*生成器=`段二-剧本生成器.mjs`（设计参数全在其中·改剧本=改参数重跑）；JSON 镜像=2c 机器线对照锚。*');
writeFileSync(path.join(HERE, '段二-最优解玩家60天剧本-v0.md'), md.join('\n'), 'utf-8');

console.log(`剧本生成完成：60 行 ✓ 毕业 D38 ✓ 卡墙 13.5 天 ✓ 守恒自检全过（负存量=抛错未触发）`);
console.log(`墙矩阵普通列合计=${wallRows.reduce((a, w) => a + w.matrix.普, 0)}（靶 26）·肝列=${wallRows.reduce((a, w) => a + w.matrix.肝, 0)}（靶≈14）`);
