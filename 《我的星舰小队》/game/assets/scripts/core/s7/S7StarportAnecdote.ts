// 星港趣事（第2.5块·块5，纯 TS，不依赖 cc）：GDD-v2.0 S10.10"星港趣事文案规范"。
//
// 口径（S10.10 + 块5 任务单决策⑧）：
//   - 触发=进主界面（hub）低概率（参考 15%·占位常量）且每日 ≤1 次；强引导期不触发。
//   - **按 s7DayKey 确定性**：dayKey 种子掷"今天有无趣事 + 哪条"，当日首次进 hub 展示（杀进程重进同日同结果）。
//   - 表现=小弹泡（灰盒：占位 emoji 头像 + 1-2 句趣话 + 微量奖励入账飘字·星贝/星矿个位数）；
//     **零广告零红点**、不打断操作（点掉即走）——纯白送，是口碑的呼吸口（S13.2）。
//   - "已展示"计数走 S7AdDailyCounter 通用载体（key=ANECDOTE_SHOWN_COUNTER_KEY），不新增存档字段。
//
// 种子文案（本块执行会话写 10-15 条·现 12 条）：调性=Q萌幽默日常（§1.1⑥ 世界观基调）；
//   **禁忌**=不卖惨、不催促、不提广告、不指向消费（测试里有调性守卫扫描）。
//   正式池 ≥30 条后续 Codex 走量、Claude 校调性——**平文件常量数组即可**（Ron 拍板不建配置表）。

import { S7AutoBattleRng } from './S7AutoBattleRng';

/** "今日趣事已展示"每日计数 key（走 S7AdDailyCounter 载体·非广告点位）。 */
export const ANECDOTE_SHOWN_COUNTER_KEY = 'starport_anecdote_shown';

// ===== 占位数值（第三块可调）=====
/** 每日触发概率（0-1·参考 15%·S10.10）。 */
export const ANECDOTE_TRIGGER_CHANCE = 0.15;

/** 一条趣事：占位 emoji 头像 + 1-2 句趣话 + 微量奖励（星贝/星矿个位数）。 */
export interface S7AnecdoteLine {
  avatar: string;
  text: string;
  reward: Record<string, number>;
}

/** 种子文案池（12 条·灰盒首发；正式池 ≥30 条 Codex 走量）。 */
const ANECDOTE_SEED_LINES: S7AnecdoteLine[] = [
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
];
export const S7_ANECDOTE_LINES: readonly S7AnecdoteLine[] = Object.freeze(ANECDOTE_SEED_LINES);

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
