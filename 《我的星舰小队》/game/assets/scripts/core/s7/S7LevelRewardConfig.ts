// 关卡三选一发奖配置（阶段一 F-step1，纯 TS，不依赖 cc）：v1.0 §8「关卡奖励（首通限定·重复挑战不刷资源）」。
//
// ⚠️ 全表 v0.1 占位（Ron 授权 Claude 定灰盒占位·第二块「关卡三选一各档量」统一校准）：
//   - 关卡首通奖励 = 固定软货币(保底·仍由既有 S7NodeSettlement 发) + 该档稀缺道具「三选一」(本模块新增的那一层)。
//   - 三档稀缺池(普通/精英/Boss)的候选构成 **严格照 §8 列的**（不加不减）；池内随机取 choiceCount(=3) 个不同项供选 1。
//   - 「随机指定专属碎片」= 随机选一个具体单位(舰/员)给其专属碎片；三选一里显示是哪艘/哪位（看得见才选·区别于打捞盲盒只给通用碎片）。
//   - Boss 必给特殊大奖(非三选一)：首个 Boss = 过载核心(core07)；其余 Boss 必给星辉货舱(starlightCargo)。
//   - 看广告×2(仅精英/Boss)：翻倍本次首通结果（数量类×2；唯一核不翻倍）。
//   - 节点档由 nodeTypeToStage 映射 nodeTypeTag → 档；未列出的默认 normal（含 tutorial_* / checkpoint / review / boss_prep —— 这几类落普通档是 v0.1 灰盒决定，待 Ron 拍是否细分）。
//   - 资源键沿用钱包既有键（与打捞同：beaconCommon/Rare/Epic·supplyTicket·coreFrag·starGem）；插件按品质(fine/superior/legendary)发、应用侧挑 pluginId。
//   - 数值/权重全占位·刻意好测好演示；第二块统一校准（出率/各档量/小概率传奇概率）。

import { S7PluginQuality } from './S7PluginEffects';
import { S7ChestType } from './S7ChestInventory';

/** 关卡奖励档（三选一池口径）。none = 该节点不发三选一（如整备 reset_gate / 提醒 protection_notice 节点）。 */
export type S7LevelRewardStage = 'normal' | 'elite' | 'boss' | 'none';
/** 有池的三档（none 除外）。 */
export type S7LevelPoolStage = 'normal' | 'elite' | 'boss';

/** 一笔关卡奖励（发放 manifest·由应用侧入账，与 S7SalvageReward 同风格）。 */
export type S7LevelReward =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'exclusiveShard'; unitKind: 'ship' | 'pilot'; unitId: string; amount: number } // 随机指定专属碎片（已定具体单位）
  | { kind: 'plugin'; quality: S7PluginQuality; count: number }                            // 插件（品质·应用侧挑 pluginId 入库）
  | { kind: 'chest'; chestId: S7ChestType; amount: number }                                // 星辉货舱等宝箱（Boss 大奖）
  | { kind: 'core'; coreId: string };                                                      // 唯一核（过载核心）·首个 Boss 固定大奖

/** 稀缺池一项（三选一候选·加权）。exclusiveShardRandom 是模板——抽中时再定具体单位。 */
export type S7LevelPoolEntry =
  | { kind: 'resource'; resourceId: string; amount: number; weight: number }
  | { kind: 'plugin'; quality: S7PluginQuality; count: number; weight: number }
  | { kind: 'exclusiveShardRandom'; unitKind: 'ship' | 'pilot'; amount: number; weight: number };

export interface S7LevelRewardConfig {
  /** 三档稀缺池（三选一候选）。 */
  pools: Record<S7LevelPoolStage, S7LevelPoolEntry[]>;
  /**
   * 首通固定软货币补充（§8·首通限定）：旧节点 reward_param 只发了星矿+合金，
   * 这里补 驾驶记录(pilotToken)+星贝(starCargo)，与 reward_param 的软货币一起构成「首通固定奖励」。占位·第二块校准。
   */
  fixedSoftBonus: { resourceId: string; amount: number }[];
  /** 一次三选一展示的选项数（§8 = 3）。 */
  choiceCount: number;
  /** Boss 必给大奖。 */
  bossGrand: { firstBossCoreId: string; otherBossChestId: S7ChestType };
  /** 节点类型 → 奖励档（未列出的默认 normal）。 */
  nodeTypeToStage: Record<string, S7LevelRewardStage>;
}

// ===== 默认配置（v0.1 占位探针·第二块校准）=====

const RES = (resourceId: string, amount: number, weight: number): S7LevelPoolEntry => ({ kind: 'resource', resourceId, amount, weight });
const PLG = (quality: S7PluginQuality, weight: number, count = 1): S7LevelPoolEntry => ({ kind: 'plugin', quality, count, weight });
const EXS = (unitKind: 'ship' | 'pilot', amount: number, weight: number): S7LevelPoolEntry => ({ kind: 'exclusiveShardRandom', unitKind, amount, weight });

export const DEFAULT_S7_LEVEL_REWARD_CONFIG: S7LevelRewardConfig = {
  choiceCount: 3,
  // 首通固定补充：驾驶记录 + 星贝（占位·与 reward_param 的星矿+合金合成 4 类固定软货币·第二块校准）。
  fixedSoftBonus: [
    { resourceId: 'pilotToken', amount: 20 },
    { resourceId: 'starCargo', amount: 60 },
  ],
  pools: {
    // §8 普通关池：精良插件 / 普通信标 / 随机指定星舰专属碎片 / 随机指定驾驶员专属碎片 / 补给券 / 星核碎片(少量)
    normal: [
      PLG('fine', 30),
      RES('beaconCommon', 1, 22),
      EXS('ship', 8, 20),
      EXS('pilot', 8, 20),
      RES('supplyTicket', 3, 22),
      RES('coreFrag', 3, 10),
    ],
    // §8 精英关池：优秀插件 / 稀有信标 / 随机指定星舰专属碎片 / 随机指定驾驶员专属碎片 / 补给券 / 星核碎片(中量)
    elite: [
      PLG('superior', 28),
      RES('beaconRare', 1, 20),
      EXS('ship', 12, 20),
      EXS('pilot', 12, 20),
      RES('supplyTicket', 5, 22),
      RES('coreFrag', 8, 14),
    ],
    // §8 Boss关池：优秀插件(小概率传奇) / 史诗信标 / 星空宝石 / 星核碎片(大笔) / 补给券(较多) / 随机指定星舰专属碎片 / 随机指定驾驶员专属碎片
    boss: [
      PLG('superior', 24),
      PLG('legendary', 6), // 小概率传奇（低权重·§8）
      RES('beaconEpic', 1, 16),
      RES('starGem', 5, 16),
      RES('coreFrag', 20, 18),
      RES('supplyTicket', 10, 16),
      EXS('ship', 15, 14),
      EXS('pilot', 15, 14),
    ],
  },
  bossGrand: { firstBossCoreId: 'core07', otherBossChestId: 'starlightCargo' },
  // 仅列非普通档；其余（normal/checkpoint/review/boss_prep/tutorial_* 等）走默认 normal。
  nodeTypeToStage: {
    normal: 'normal',
    elite: 'elite',
    boss: 'boss',
    reset_gate: 'none',
    protection_notice: 'none',
  },
};
