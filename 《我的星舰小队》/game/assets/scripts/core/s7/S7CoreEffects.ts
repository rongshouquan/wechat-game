// 星核运行时（块3）：把星核 coreId 解析成效果积木（v1.0 §5.4：星核 = 规则级质变）。
// 配置(core_config)只描述星核身份/文案；质变的可执行积木由本解析器产出，喂进装配层 deriveUnit 合成。
// 首发用代码解析器承载少量星核质变（C1 最小集 2 核），config 化留后续。纯 TS、可 Node 测。

import { S7EffectBlock } from './S7BattleEffectBlock';

/** 新手核「过载核心」(v1.0 §5.4/§11)：首个 Boss 首杀固定掉落、人人相同（非三选一）。
 *  质变：本舰普攻变「原子炮」——开局即放、约半个敌方战场 AoE 巨量伤害、普攻间隔变 10s。
 *  前期超爽（开局一炮秒一片）、中期够用、后期过渡，非毕业核。 */
export const S7_CORE_OVERLOAD_ID = 'core07';

/** 各星核的运行时质变积木表（coreId → 积木）。未列出的核暂无运行时质变（返回空）。 */
const CORE_BLOCKS: Record<string, S7EffectBlock[]> = {
  [S7_CORE_OVERLOAD_ID]: [
    // 普攻槽换成原子炮（AoE 伤害效果，命中数/范围/倍率占位，最终第二块定）。
    { kind: 'action', slot: 'normal', effectRef: 'eff_atomic_cannon', source: S7_CORE_OVERLOAD_ID },
    // 普攻间隔质变为 10 秒（set=绝对值覆盖基线）。
    { kind: 'modifier', stat: 'attackIntervalSec', op: 'set', value: 10, source: S7_CORE_OVERLOAD_ID },
  ],
};

/** 取某星核的运行时效果积木；未知或暂无质变的星核返回空数组。 */
export function coreBlocks(coreId: string): readonly S7EffectBlock[] {
  return CORE_BLOCKS[coreId] ?? [];
}
