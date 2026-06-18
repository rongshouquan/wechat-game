// 驾驶员运行时（块5）：把驾驶员 pilotId 解析成效果积木（v1.0 §5.2：驾驶员 = 怎么打 + 独特机制，不加原始属性）。
// 与星核(S7CoreEffects)/插件(S7PluginEffects)解析器同构：配置(pilot_config)只描述身份/文案；
// 可执行的「行为AI(选目标) + 驾驶天赋(独特被动)」积木由本解析器产出，喂进装配层 deriveUnit 合成。纯 TS、可 Node 测。
//
// 两类产出（对应 v1.0 §5.2 驾驶员职责，均不碰原始属性）：
//   ① 行为类 behavior —— 覆盖目标选择（锁后排/护盾优先/嘲讽…），复用引擎 targetingTag。
//   ② 驾驶天赋 —— 独特被动，用修正/词条/触发积木承载（占位，精确内容第二块）。
//
// 首发口径（与块3 星核同策略）：先做机制 + 一个代表驾驶员证明「行为AI + 驾驶天赋」两条路通；
// 其余驾驶员的具体行为/天赋（每人各异）留第二块细表，届时按 pilotId 补进本表即可，调用方不变。

import { S7EffectBlock } from './S7BattleEffectBlock';

/** 代表驾驶员「晴岚」(pil03)：driveStyleNote = 后排点杀、召唤源优先（pilot_config）。 */
export const S7_PILOT_BACKLINE_ID = 'pil03';

/** 各驾驶员的运行时积木表（pilotId → 积木）。未列出的驾驶员暂无运行时（返回空），内容留第二块。 */
const PILOT_BLOCKS: Record<string, S7EffectBlock[]> = {
  [S7_PILOT_BACKLINE_ID]: [
    // 行为AI：本舰普攻改「后排优先」（晴岚的后排点杀）。
    { kind: 'behavior', targetingTag: 'backline_first', source: S7_PILOT_BACKLINE_ID },
    // 驾驶天赋（占位）：点杀后排时小幅增伤；精确效果/数值第二块定。
    { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.1, source: S7_PILOT_BACKLINE_ID },
  ],
};

/** 取某驾驶员的运行时效果积木；未知或暂无运行时的驾驶员返回空数组。 */
export function pilotBlocks(pilotId: string): readonly S7EffectBlock[] {
  return PILOT_BLOCKS[pilotId] ?? [];
}
