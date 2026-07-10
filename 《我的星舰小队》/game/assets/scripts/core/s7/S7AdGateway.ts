// 广告网关 + mock 适配（阶段一 G1，纯 TS，不依赖 cc）：GDD-v2.0 S13「首发纯广告」。
//
// 这是基建不是玩法：给全部广告点位一个统一入口 + 可替换适配器接口（点位清单=GDD S13.2，第2.5块·块5 已补齐 10/10）。
//   各玩法块调本网关请求广告，拿"看完没/被关/没填充"的结果再决定发不发奖。
//   首发接 mock 适配器（确定性、无副作用、可离线测）；阶段五换成真微信激励视频 SDK 适配器即可，玩法零改动。
//
// 边界：不接真实 wx.createRewardedVideoAd（留阶段五适配器）；不发奖（发奖是各玩法块的事，网关只回"广告结果"）；
//   不使用随机/当前时间；S7 自有、不依赖流程版 ads（换壳后照用）。
//   每日次数上限/按钮三态/广告券恢复 → S7AdPointPolicy（块5 统一收口），不在网关。

/** 广告点位（GDD-v2.0 S13.2 十点位唯一清单·块5 齐 10/10；注释里的 #N = S13.2 表编号）。 */
export type S7AdPoint =
  | 'return_report_double'       // #1 回港报告翻倍：离线+巡逻软货币 ×2（打捞实物不翻·块1）
  | 'daily_supply_chest'         // #2 今日补给箱：看广告开每日礼盒（白送型·块5）
  | 'clear_reward_double'        // #3 首通奖励翻倍：全部关卡首通三选一"选完后"（块5 扩至全部关卡）
  | 'triple_pick_extra'          // #4 三选一·再选一个：首通三选一选完后从剩两张再选一张（块5）
  | 'salvage_speedup'            // #5 打捞加速：看广告直接完成当前打捞（块5 改行为·原"减2小时"作废）
  | 'sponsor_supply'             // #6 赞助补给：看广告得补给券×10（块5 定量）
  | 'cargo_extra_pick'           // #7 星辉货舱多选：免费 1 + 看广告再 1（唯一不限次点位·天然限频）
  | 'merchant_refresh'           // #8 商人每日刷新：看广告多刷 1 次
  | 'defeat_consolation_double'  // #9 战败安慰双倍：主线战败基础安慰包 ×2（块5）
  | 'corridor_milestone_double'  // #10 回廊里程碑翻倍（福利广告·券不可恢复）
  | 'escort_fail_guard'; // #10 深空回廊里程碑翻倍：里程碑奖励全键 ×2（块3）

export const S7_AD_POINTS: readonly S7AdPoint[] = Object.freeze([
  'return_report_double', 'daily_supply_chest', 'clear_reward_double', 'triple_pick_extra', 'salvage_speedup',
  'sponsor_supply', 'cargo_extra_pick', 'merchant_refresh', 'defeat_consolation_double', 'corridor_milestone_double',
  'escort_fail_guard', // #11 委托失败保卡（S13.2 总修订案·免费 1 次/日+券可无限恢复；接线随作战大厅重构=灰盒批）
]);

/** 广告结果：看完(ok) / 未看完被关 / 加载失败 / 无填充。仅 ok 时调用方才发奖。 */
export type S7AdResult =
  | { ok: true }
  | { ok: false; reason: 'closed' | 'failed' | 'no_fill' };

/** 广告适配器接口：首发 mock，阶段五换真 SDK；玩法只依赖本接口。 */
export interface S7AdAdapter {
  /** 请求展示某点位广告，异步回结果。 */
  show(point: S7AdPoint): Promise<S7AdResult>;
}

/**
 * Mock 广告适配器（首发/测试）：确定性返回固定结果（默认"看完"），不接真广告、不触网、不用时间/随机。
 * 需测"被关/失败"分支时构造 new S7MockAdAdapter({ ok:false, reason:'closed' })。
 */
export class S7MockAdAdapter implements S7AdAdapter {
  constructor(private readonly result: S7AdResult = { ok: true }) {}
  show(_point: S7AdPoint): Promise<S7AdResult> {
    return Promise.resolve(this.result);
  }
}

/** 广告网关：持有一个可替换适配器；玩法块调 show(point) 请求广告。 */
export class S7AdGateway {
  constructor(private adapter: S7AdAdapter) {}

  /** 换适配器（阶段五用真 SDK 适配器替换 mock）。 */
  setAdapter(adapter: S7AdAdapter): void {
    this.adapter = adapter;
  }

  /** 请求某点位广告；非法点位直接当失败（不抛错，便于玩法兜底）。 */
  async show(point: S7AdPoint): Promise<S7AdResult> {
    if (!S7_AD_POINTS.includes(point)) return { ok: false, reason: 'failed' };
    return this.adapter.show(point);
  }
}
