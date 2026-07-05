// 战败安慰包（第2.5块·块5，纯 TS，不依赖 cc）：GDD-v2.0 S13.2 #9 + 附录B B1.5"战败附安慰补给小块"。
//
// 口径（S13 #9 + 块5 任务单锁定）：
//   - **仅挂主线战败**（悬赏/回廊/推演战败不给——它们各有零惩罚机制），强引导期不给（新手期全隐 + 教程"零白送"经济）。
//   - 基础包**白送直接入账**（与广告无关）：合金/驾驶记录小额，每日 ≤3 次；**当日第 1 败额外附 1 张普通信标**
//     （有期待感；信标要经打捞时间门控才能兑现，天然防送死刷取）。
//   - 第 4 败起不送包，只显示一句鼓励文案（柔和不挫败·附录B B1.5④）。
//   - 旁边「📺 安慰双倍」（点位 defeat_consolation_double·每日 1 次·三态走 S7AdPointPolicy）：看完把本次基础包翻倍。
// 每日发放计数走 S7AdDailyCounter 通用载体（key=CONSOLATION_PACK_COUNTER_KEY·非广告点位、纯计数复用），不新增存档字段。
// 量级全 v0.1 占位（exported const·第三块数值校准统一精校）。败因归类/克制建议（B1.5b）不在本块——随战斗演出块落地。

/** 「安慰双倍」广告点位 id（S13.2 #9）。 */
export const DEFEAT_CONSOLATION_DOUBLE_AD_POINT = 'defeat_consolation_double';
/** 基础包每日发放计数 key（走 S7AdDailyCounter 载体·非广告点位·白送计数）。 */
export const CONSOLATION_PACK_COUNTER_KEY = 'defeat_consolation_pack';

// ===== 占位数值（第三块统一校准）=====
/** 基础包每日上限（次）。 */
export const CONSOLATION_PACK_DAILY_LIMIT = 3;
/** 基础包内容（小额·白送）。 */
export const CONSOLATION_ALLOY = 30;
export const CONSOLATION_TOKEN = 20;
/** 当日第 1 败额外附普通信标张数。 */
export const CONSOLATION_FIRST_DEFEAT_BEACON = 1;

/** 第 4 败起的鼓励文案（柔和不挫败·零广告零催促·B1.5④）。 */
export const CONSOLATION_ENCOURAGE_TEXT = '舰队已安全返航。回去升一级、换个搭配，下次一定行！';

/**
 * 按"今日第几败"给基础包内容（纯函数）：indexToday 从 1 起。
 * 1 → 基础包 + 普通信标×1（首败彩头）；2/3 → 基础包；≥4 → null（不送包·只给鼓励文案）。
 * 非法输入（≤0/非整数）按 null 处理（不发·防御）。
 */
export function defeatConsolationPack(indexToday: number): Record<string, number> | null {
  if (!Number.isInteger(indexToday) || indexToday <= 0) return null;
  if (indexToday > CONSOLATION_PACK_DAILY_LIMIT) return null;
  const pack: Record<string, number> = { hullAlloy: CONSOLATION_ALLOY, pilotToken: CONSOLATION_TOKEN };
  if (indexToday === 1) pack.beaconCommon = CONSOLATION_FIRST_DEFEAT_BEACON;
  return pack;
}
