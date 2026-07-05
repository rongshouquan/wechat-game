// 星港趣事（第2.5块·块5 立；交互巡检批接入正式文案池）：GDD-v2.0 S10.10"星港趣事文案规范"。
//
// 口径（S10.10 + 块5 任务单决策⑧）：
//   - 触发=进主界面（hub）低概率（参考 15%·占位常量）且每日 ≤1 次；强引导期不触发。
//   - **按 s7DayKey 确定性**：dayKey 种子掷"今天有无趣事 + 哪条"，当日首次进 hub 展示（杀进程重进同日同结果）。
//   - 表现=小弹泡（灰盒：占位 emoji 头像 + 说话人显示名 + 1-2 句趣话 + 微量奖励入账飘字·星贝/星矿个位数）；
//     **零广告零红点**、不打断操作（点掉即走）——纯白送，是口碑的呼吸口（S13.2）。
//   - "已展示"计数走 S7AdDailyCounter 通用载体（key=ANECDOTE_SHOWN_COUNTER_KEY），不新增存档字段。
//
// 文案池（交互巡检批定稿·71 条）：
//   - 12 条种子（块5 执行会话写·无署名的星港日常，速写体）＋ 59 条正式池（源=《星港趣事文案池-v1》·
//     Codex 产 60 条→总控 2026-07-03 调性初校→巡检批禁忌词扫描剔除 1 条〔006 含"最后"〕后接入）。
//   - speaker：20 位驾驶员名与附录D驾驶员真源逐一核对一致（炎/影/燎/蛰/源/烬/骁/翎/岩/砺/岳/沧/苏/澈/沛/霖/蔽/空/巡/藏）；
//     居民条目带「居民-」前缀（数据层保留前缀便于溯源·弹泡展示时去前缀）；种子条目无 speaker（叙述体）。
//   - 禁忌（S10.10 不卖惨/不催促/不提广告/不指向消费）由测试全池硬扫；扩池=加行即可（Ron 拍板不建配置表）。
//   - 奖励量全占位（个位数星贝/星矿）·第三块统一配平。

import { S7AutoBattleRng } from './S7AutoBattleRng';

/** "今日趣事已展示"每日计数 key（走 S7AdDailyCounter 载体·非广告点位）。 */
export const ANECDOTE_SHOWN_COUNTER_KEY = 'starport_anecdote_shown';

// ===== 占位数值（第三块可调）=====
/** 每日触发概率（0-1·参考 15%·S10.10）。 */
export const ANECDOTE_TRIGGER_CHANCE = 0.15;

/** 附录D驾驶员真源 20 名（speaker 校验用·与《GDD-附录D-驾驶员真源》§1-§5 逐一对应）。 */
export const S7_ANECDOTE_PILOT_NAMES: readonly string[] = Object.freeze([
  '炎', '影', '燎', '蛰', // §1 突击
  '源', '烬', '骁', '翎', // §2 炮击
  '岩', '砺', '岳', '沧', // §3 护卫
  '苏', '澈', '沛', '霖', // §4 支援
  '蔽', '空', '巡', '藏', // §5 工程
]);

/** 一条趣事：占位 emoji 头像 + 可选说话人（驾驶员名/「居民-XX」·无=叙述体种子）+ 1-2 句趣话 + 微量奖励。 */
export interface S7AnecdoteLine {
  avatar: string;
  speaker?: string;
  text: string;
  reward: Record<string, number>;
}

/** 定稿文案池（71 条 = 12 种子 + 59 正式；顺序：种子 → 驾驶员 001-040(去006) → 居民 041-060）。 */
const ANECDOTE_LINES: S7AnecdoteLine[] = [
  // ---- 种子 12 条（块5·无署名叙述体·合格保留）----
  { avatar: '🐱', text: '打捞队在废墟里捞回一只太空猫，现在它自封打捞港编外队长，天天验收货物。', reward: { starCargo: 3 } },
  { avatar: '🍜', text: '食堂新厨师把合金锅烧糊了，大家尝了一口反而说"这才是星港的味道"。', reward: { starOre: 5 } },
  { avatar: '🤖', text: '维修机器人给自己拧了根新天线，逢人就转两圈展示，谁夸它它就亮灯。', reward: { starCargo: 2 } },
  { avatar: '😴', text: '值夜班的雷达员打了个盹，梦话把陨石群报成了"烤土豆群"，全频道笑醒。', reward: { starOre: 4 } },
  { avatar: '🎈', text: '居民们用退役气密袋扎了个大气球，慢悠悠飘过训练舱窗口，驾驶员们集体行注目礼。', reward: { starCargo: 3 } },
  { avatar: '🐟', text: '水培舱的鱼学会了跟着警报声摆尾，大家给它起名"节拍鱼"，还想给它排班。', reward: { starOre: 6 } },
  { avatar: '🎨', text: '有位驾驶员偷偷给座舰画了个笑脸，出击时被全港围观，现在排队求同款。', reward: { starCargo: 4 } },
  { avatar: '🧦', text: '洗衣机器人又把袜子配错了对，于是今天全星港流行穿混色袜，还挺好看。', reward: { starOre: 3 } },
  { avatar: '🍞', text: '面包房试做"星云面包"，切开真的有漩涡纹，队伍从店门口排到了码头。', reward: { starCargo: 5 } },
  { avatar: '🎮', text: '两个机修工用备用操纵杆攒了台小街机，午休时间一位难求，胜者奖励一瓶汽水。', reward: { starOre: 5 } },
  { avatar: '🌱', text: '星核展厅门口的盆栽悄悄开花了，管理员骄傲得像是自己开的花，逢人就介绍。', reward: { starCargo: 3 } },
  { avatar: '📦', text: '仓库盘点多出一箱零件，查了半天记录，发现是去年自己藏给自己的惊喜。', reward: { starOre: 4 } },
  // ---- 驾驶员 39 条（v1 池 001-040·006「留到最后」含禁词"最后"已剔除报备）----
  { avatar: '🔥', speaker: '炎', text: '残血靶今天很有礼貌，看见我就靠边。', reward: { starCargo: 3 } },
  { avatar: '🔥', speaker: '炎', text: '演习的靶机一看是我，直接举了白旗。教官说这不算成绩。', reward: { starOre: 4 } },
  { avatar: '🌑', speaker: '影', text: '后排灯泡太亮，我顺手把它调暗。', reward: { starCargo: 4 } },
  { avatar: '🌑', speaker: '影', text: '巡逻带回三箱合金。别问。', reward: { starOre: 5 } },
  { avatar: '⚡', speaker: '燎', text: '谁把残血留桌上？我已经端走了。', reward: { starCargo: 3 } },
  { avatar: '🗡️', speaker: '蛰', text: '治疗机藏得很深，可惜影子先到一步。', reward: { starCargo: 5 } },
  { avatar: '🗡️', speaker: '蛰', text: '修理机修得快，没我拆得快。这是数学。', reward: { starOre: 3 } },
  { avatar: '🎯', speaker: '源', text: '锁定后别换频道，我连汤勺都对准它。', reward: { starCargo: 2 } },
  { avatar: '🎯', speaker: '源', text: '换目标？先等我这口茶。哦，它已经沉了。', reward: { starOre: 6 } },
  { avatar: '💣', speaker: '烬', text: '硬骨头适合慢慢啃，火候刚好。', reward: { starCargo: 4 } },
  { avatar: '💣', speaker: '烬', text: '燎又抢我收尾。没事，下一个我从满血啃起，他插不上嘴。', reward: { starOre: 4 } },
  { avatar: '🚀', speaker: '骁', text: '第一排站太整齐，我忍不住先打招呼。', reward: { starCargo: 3 } },
  { avatar: '🚀', speaker: '骁', text: '冲锋号还没响我就出去了。回来又补听了一遍，挺好听。', reward: { starOre: 5 } },
  { avatar: '🏹', speaker: '翎', text: '对面输出最吵，我让准星请它安静。', reward: { starCargo: 5 } },
  { avatar: '🏹', speaker: '翎', text: '擦枪擦到睡着，梦里也是十环。', reward: { starOre: 3 } },
  { avatar: '🛡️', speaker: '岩', text: '后排别怕，盾牌今天也站得很结实。', reward: { starCargo: 3 } },
  { avatar: '🛡️', speaker: '岩', text: '苏说我盾上全是划痕，要消毒。那是勋章。行吧，消。', reward: { starOre: 4 } },
  { avatar: '🪖', speaker: '砺', text: '最凶的火力归我，别跟老兵抢活。', reward: { starCargo: 4 } },
  { avatar: '🪖', speaker: '砺', text: '新兵问我怕不怕疼。我给他看考勤表：疼，全勤。', reward: { starOre: 6 } },
  { avatar: '🏰', speaker: '岳', text: '谁碰后排，我的塔盾先记名字。', reward: { starCargo: 2 } },
  { avatar: '🏰', speaker: '岳', text: '名单上第一位今天没来。听说改行了，明智。', reward: { starOre: 4 } },
  { avatar: '🌊', speaker: '沧', text: '风浪先到我这边，队友只管站稳。', reward: { starCargo: 5 } },
  { avatar: '🌊', speaker: '沧', text: '披风又破了个口。换新的就行，习惯不换。', reward: { starOre: 3 } },
  { avatar: '💊', speaker: '苏', text: '治疗球刚充好，今天不许逞强。', reward: { starCargo: 3 } },
  { avatar: '💊', speaker: '苏', text: '今天零受伤，治疗球闲得在诊室弹来弹去。挺好。', reward: { starOre: 5 } },
  { avatar: '✨', speaker: '澈', text: '主C在左，我的光笔就不向右偏。', reward: { starCargo: 4 } },
  { avatar: '✨', speaker: '澈', text: '偷偷给主C的增益画了颗小星星。他没发现，但打得更起劲了。', reward: { starOre: 4 } },
  { avatar: '🫧', speaker: '沛', text: '篮子里光点很多，每个人都有一颗。', reward: { starCargo: 3 } },
  { avatar: '🫧', speaker: '沛', text: '今天护盾铺得特别匀，地板都说亮堂。', reward: { starOre: 3 } },
  { avatar: '🌦️', speaker: '霖', text: '减益别排队，我的法杖会点名。', reward: { starCargo: 5 } },
  { avatar: '🌦️', speaker: '霖', text: '给影的斗篷做了净化。他说少了点味道，我说那叫干净。', reward: { starOre: 5 } },
  { avatar: '🌫️', speaker: '蔽', text: '雾弹不是恶作剧，是软柿子说明书。', reward: { starCargo: 2 } },
  { avatar: '🌫️', speaker: '蔽', text: '在敌舰玻璃上画了个笑脸，他们连打歪三炮。', reward: { starOre: 6 } },
  { avatar: '🧹', speaker: '空', text: '召唤源别乱摆，我有整理癖。', reward: { starCargo: 4 } },
  { avatar: '🧹', speaker: '空', text: '把敌方无人机排成一排。好看。然后一排带走。', reward: { starOre: 4 } },
  { avatar: '🛰️', speaker: '巡', text: '无人机今天很乖，只偷看后排。', reward: { starCargo: 3 } },
  { avatar: '🛰️', speaker: '巡', text: '无人机学了个新队形叫"下班"。我假装没看见。', reward: { starOre: 5 } },
  { avatar: '🔩', speaker: '藏', text: '硬壳不用急，钻头会慢慢讲道理。', reward: { starCargo: 5 } },
  { avatar: '🔩', speaker: '藏', text: '今天的罐头有点厚。我是说敌舰。开罐愉快。', reward: { starOre: 3 } },
  // ---- 居民 20 条（v1 池 041-060）----
  { avatar: '🍜', speaker: '居民-港口厨师', text: '今天的星云汤很稳，只冒几朵泡。', reward: { starCargo: 3 } },
  { avatar: '🔧', speaker: '居民-维修师', text: '修好的闸门学会自动关了，就是总夹我扳手。', reward: { starOre: 4 } },
  { avatar: '🗼', speaker: '居民-灯塔员', text: '星港灯塔打了个喷嚏，亮度满分。', reward: { starCargo: 4 } },
  { avatar: '📦', speaker: '居民-货柜员', text: '有个货柜不肯进位，一查，装的全是打捞战利品，骄傲得很。', reward: { starOre: 3 } },
  { avatar: '🌱', speaker: '居民-园艺师', text: '小太阳晒过的叶子，站得特别直。', reward: { starCargo: 2 } },
  { avatar: '🔦', speaker: '居民-巡逻员', text: '巡逻路上捡到蓝光，它说只是路过。', reward: { starOre: 5 } },
  { avatar: '📋', speaker: '居民-调度员', text: '给运输船排泊位，它非要停在指挥官旁边，说有安全感。', reward: { starCargo: 5 } },
  { avatar: '☕', speaker: '居民-咖啡摊主', text: '咖啡机学会低空飞行，味道没变。', reward: { starOre: 4 } },
  { avatar: '🧽', speaker: '居民-清洁员', text: '甲板擦完后，影子路过都放轻脚步。', reward: { starCargo: 3 } },
  { avatar: '📰', speaker: '居民-小报编辑', text: '悬赏征稿《深空回廊一百层长什么样》，至今没人来领。', reward: { starOre: 6 } },
  { avatar: '🌤️', speaker: '居民-气象员', text: '港区微风偏甜，适合给护盾晾干。', reward: { starCargo: 4 } },
  { avatar: '🗃️', speaker: '居民-仓库员', text: '星矿袋今天很安静，像在装酷。', reward: { starOre: 3 } },
  { avatar: '🧭', speaker: '居民-导航员', text: '航线画歪一格，意外像个笑脸。', reward: { starCargo: 2 } },
  { avatar: '🥇', speaker: '居民-训练教官', text: '靶机申请休假，理由是被看穿。', reward: { starOre: 4 } },
  { avatar: '📻', speaker: '居民-通信员', text: '频道里只有滋滋声，听着很有节拍。', reward: { starCargo: 3 } },
  { avatar: '🎨', speaker: '居民-码头画师', text: '我给磐石号描边，被盾光挡回来了。', reward: { starOre: 5 } },
  { avatar: '🎁', speaker: '居民-补给员', text: '货舱堆成了小山，我在山顶插了面小旗。', reward: { starCargo: 5 } },
  { avatar: '🛤️', speaker: '居民-轨道工', text: '轨道拐弯太圆，飞船差点夸它。', reward: { starOre: 3 } },
  { avatar: '📢', speaker: '居民-播报员', text: '晨间播报少了一拍，大家掌声很准。', reward: { starCargo: 4 } },
  { avatar: '🔭', speaker: '居民-观星员', text: '今晚星星排成箭头，指向厨房。', reward: { starOre: 4 } },
];
export const S7_ANECDOTE_LINES: readonly S7AnecdoteLine[] = Object.freeze(ANECDOTE_LINES);

/** 说话人显示名（「居民-」前缀只是数据溯源标记·展示时去掉；无 speaker 返回空串=叙述体不署名）。 */
export function anecdoteSpeakerDisplay(line: S7AnecdoteLine): string {
  if (!line.speaker) return '';
  return line.speaker.startsWith('居民-') ? line.speaker.slice('居民-'.length) : line.speaker;
}

/**
 * 掷"今天有无趣事、有则哪条"（确定性·纯函数）：种子=anecdote_<dayKey>。
 * 命中（< ANECDOTE_TRIGGER_CHANCE）→ 返回当日那条（索引确定）；未命中 → null（今天没有趣事）。
 */
export function anecdoteForDay(dayKey: number): S7AnecdoteLine | null {
  if (!Number.isInteger(dayKey) || dayKey < 0 || S7_ANECDOTE_LINES.length === 0) return null;
  const rng = new S7AutoBattleRng(`anecdote_${dayKey}`);
  if (rng.next() >= ANECDOTE_TRIGGER_CHANCE) return null;
  const idx = Math.floor(rng.next() * S7_ANECDOTE_LINES.length) % S7_ANECDOTE_LINES.length;
  return S7_ANECDOTE_LINES[idx];
}

/** 按索引取一条（DEV「触发趣事」轮换用·索引取模保证总有效）。 */
export function anecdoteByIndex(index: number): S7AnecdoteLine {
  const n = S7_ANECDOTE_LINES.length;
  const i = ((Math.floor(index) % n) + n) % n;
  return S7_ANECDOTE_LINES[i];
}
