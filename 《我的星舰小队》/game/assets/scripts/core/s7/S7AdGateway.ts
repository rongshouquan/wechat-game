// 广告网关 + mock 适配（阶段一 G1，纯 TS，不依赖 cc）：v1.0 §13「首发纯广告，5 个广告点位」。
//
// 这是基建不是玩法：给全部广告点位一个统一入口 + 可替换适配器接口（点位清单=GDD S13.2，第2.5块逐块补齐到 10 个）。各玩法块（C 赞助补给/D 打捞加速/
//   F 通关翻倍/H 货舱多选/E 商人刷新）调本网关请求广告，拿"看完没/被关/没填充"的结果再决定发不发奖。
//   首发接 mock 适配器（确定性、无副作用、可离线测）；阶段五换成真微信激励视频 SDK 适配器即可，玩法零改动。
//
// 边界：不接真实 wx.createRewardedVideoAd（留阶段五适配器）；不发奖（发奖是各玩法块的事，网关只回"广告结果"）；
//   不使用随机/当前时间；S7 自有、不依赖流程版 ads（换壳后照用）。每日次数上限由各玩法块配合配置(第二块)实现，不在网关。

/** 广告点位（GDD-v2.0 S13.2 十点位清单；包A 第2.5块起逐块补齐，每日上限由各玩法块配 S7AdDailyCounter 实现）。 */
export type S7AdPoint =
  | 'sponsor_supply'        // 赞助补给：看广告得补给券
  | 'salvage_speedup'       // 打捞加速：看广告减剩余时间
  | 'clear_reward_double'   // 通关奖励翻倍：首通结算（包A 扩至全部关卡·改造在块5）
  | 'cargo_extra_pick'      // 星辉货舱多选：免费 1 + 看广告再 1
  | 'merchant_refresh'      // 商人每日刷新：看广告多刷 1 次
  | 'return_report_double'  // 回港报告翻倍：离线+巡逻软货币 ×2（打捞实物不翻·包A 块1）
  | 'corridor_milestone_double'; // 深空回廊里程碑翻倍：里程碑奖励全键 ×2（包A 块3·S13 #10·爬层自然限频·不设每日上限）

export const S7_AD_POINTS: readonly S7AdPoint[] = Object.freeze([
  'sponsor_supply', 'salvage_speedup', 'clear_reward_double', 'cargo_extra_pick', 'merchant_refresh',
  'return_report_double', 'corridor_milestone_double',
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
