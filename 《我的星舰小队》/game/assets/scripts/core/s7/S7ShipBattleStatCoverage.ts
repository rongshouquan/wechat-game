// S7 星舰战斗属性覆盖报告（BATTLE-RT-07E-3-1，纯 TS，不依赖 cc）。
//
// 职责：只读地报告 ship_config 全部星舰与 battle_unit_stat_param 中 ship 行（targetType==='ship'）之间的
// 覆盖关系 —— 哪些 shipId 已有战斗属性行（covered）、哪些缺失（missing）、哪些命中多行（ambiguous）。
// 目标只有一个：让“12 艘星舰里哪些还没有战斗属性行”这一缺口稳定可见。
//
// 严格边界（依 RT-07E-3-1 任务包）：
// - 只报告事实，不补任何 shp04..shp12 数值，不改配置表，不新增默认兜底战斗属性。
// - 不改 S7BattleEncounterAssembler 的 missing_ship_battle_unit / ambiguous_ship_battle_unit 语义，
//   不改战斗公式，不把 validate 改成当前会失败的阻断门禁。
// - 不接 UI / 战报 / 胜负弹窗，不跑战斗（不调 S7BattleRunService / S7AutoBattleEngine），
//   不结算 / 不发奖励 / 不推进主线 / 不调 completeS7Node，不读写存档 / 玩家态 / 编队，不接服务器。
// - 不把驾驶员 / 插件 / 星核 / 等级 / 强化转成战斗属性：本报告只看 ship 行覆盖关系。
// - 未来在线化不堵死：稳定 ID、可复现、纯 TS 本地可测；report 无副作用（不修改 runtime 返回的配置数组 / 行）。

import type { S7ShipConfig, S7BattleUnitStatParam } from '../../config/s7/ConfigTypesS7';
import type { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';

/**
 * 星舰战斗属性覆盖报告（只读快照）。
 * - covered / missing / ambiguous 三类互斥，合计等于 totalShips。
 * - rowsByShipId 覆盖全部 shipId：缺失为 []，命中为按 rowId 升序的命中行列表。
 * - currentConsumer / currentConsumerInput / derivationStatus 记录“当前谁消费、消费什么、派生是否接通”的事实，
 *   说明驾驶员 / 插件 / 星核 / 培养尚未接入战斗属性派生（仅事实陈述，不在此实现派生）。
 */
export interface S7ShipBattleStatCoverageReport {
  totalShips: number;
  shipIds: string[];
  coveredShipIds: string[];
  missingShipIds: string[];
  ambiguousShipIds: string[];
  rowsByShipId: Record<string, string[]>;
  currentConsumer: 'S7BattleEncounterAssembler';
  currentConsumerInput: 'shipId+slotRef';
  derivationStatus: 'not_connected';
}

/** 字典序稳定升序比较（zero-padded shp## / bu_* 行 ID 字典序即稳定序）。 */
function ascending(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 分析 ship_config 与 battle_unit_stat_param ship 行的覆盖关系。
 * 纯函数、无副作用：只读 runtime 配置，不修改任何返回数组 / 行，不抛常规错误。
 * 命中规则（按 unitRef === shipId 的 ship 行计数）：0 行 missing，1 行 covered，多行 ambiguous。
 */
export function analyzeS7ShipBattleStatCoverage(runtime: S7ConfigRuntime): S7ShipBattleStatCoverageReport {
  // 全部星舰 ID（去重 + 稳定升序）；用 Array.from(new Set()) 规避 Cocos 构建对 [...new Set()] 的 spread 降级。
  const ships = runtime.getAll<S7ShipConfig>('ship_config');
  const shipIds = Array.from(new Set(ships.map((s) => s.shipId))).sort(ascending);

  // battle_unit_stat_param 中的 ship 行（filter 产生新数组，不触原配置数组）。
  const shipRows = runtime.getAll<S7BattleUnitStatParam>('battle_unit_stat_param').filter((u) => u.targetType === 'ship');

  const rowsByShipId: Record<string, string[]> = {};
  const coveredShipIds: string[] = [];
  const missingShipIds: string[] = [];
  const ambiguousShipIds: string[] = [];

  for (const shipId of shipIds) {
    const matchedRowIds = shipRows
      .filter((u) => u.unitRef === shipId)
      .map((u) => u.rowId)
      .sort(ascending);
    rowsByShipId[shipId] = matchedRowIds;
    if (matchedRowIds.length === 0) {
      missingShipIds.push(shipId);
    } else if (matchedRowIds.length === 1) {
      coveredShipIds.push(shipId);
    } else {
      ambiguousShipIds.push(shipId);
    }
  }

  return {
    totalShips: shipIds.length,
    shipIds,
    coveredShipIds,
    missingShipIds,
    ambiguousShipIds,
    rowsByShipId,
    currentConsumer: 'S7BattleEncounterAssembler',
    currentConsumerInput: 'shipId+slotRef',
    derivationStatus: 'not_connected',
  };
}
