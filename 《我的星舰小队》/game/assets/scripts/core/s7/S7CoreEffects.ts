// 星核运行时（⑩A2 · 16 核接线·真源=GDD-附录D-星核真源 · 数值=细表 §15/§18.3 v0）：
// coreId → 质变效果积木。配置(core_config)只描述身份/文案；可执行积木由本解析器产出。
//
// ⚠️ core_config 旧占位名与 id 归属（总控回执③加严·映射注记）：
//   core01-06 旧灰盒占位行已随步5 A9 收编删除（2026-07-10）：core_config=core07-22 真核 16 颗、
//   三渠道发放面（开蛋/宝藏/宝库/商店/黑市常量）全部切真核 id——下方映射表=收编对账记录（保留溯源）。
//   【core01-06 占位 ↔ 真核新 id 映射表】（步5 收编用·真源 16 核=陨星弹+15）：
//     core07=陨星弹（唯一原真核·不动）
//     core08=小太阳 · core09=星鲸 · core10=时光糖 · core11=超级护罩 · core12=战鼓
//     core13=贪吃星 · core14=守护铃 · core15=超新星 · core16=银河烟花
//     core17=曲率星门 · core18=共鸣音叉 · core19=引力阱 · core20=彩虹棱镜 · core21=幸运扭蛋 · core22=全息镜
//     （core17-22=⑨如实交回的 6 深坑核·需新引擎机制=机制批③·本表返回空积木=挂牌不硬做；
//       core01-06 旧行已按上表退役（步5 收编·2026-07-10）。）
import { S7EffectBlock } from './S7BattleEffectBlock';

/** 新手核「陨星弹」(真源·首 Boss 首杀固定掉落)：普攻变原子炮（×2.5 半场 AoE·间隔 10s·§15 保形）。 */
export const S7_CORE_OVERLOAD_ID = 'core07';

/** 各星核的运行时质变积木表（coreId → 积木）。未列出的核暂无运行时质变（返回空=挂牌）。 */
const CORE_BLOCKS: Record<string, S7EffectBlock[]> = {
  [S7_CORE_OVERLOAD_ID]: [
    { kind: 'action', slot: 'normal', effectRef: 'eff_atomic_cannon', source: S7_CORE_OVERLOAD_ID },
    { kind: 'modifier', stat: 'attackIntervalSec', op: 'set', value: 10, source: S7_CORE_OVERLOAD_ID },
  ],
  // 小太阳：CD16 的 3×3 ×3.6（§15 第一拍=灼烧折进爆伤·完整版 zone 实体挂机制批③）。
  core08: [{ kind: 'trigger', on: 'cd', cdSec: 16, effectRef: 'eff_core_sun', source: 'core08' }],
  // 星鲸：开场召唤（血1800/攻55·bu_s7_whale 行=⑥落·限时20s/上限1·CD一次性=只放开场一次）。
  core09: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_core_whale', source: 'core09' }],
  // 时光糖：血量首次跌破 70% → 攻速+40%+CD加速30%·10s·每场1（§15 触发时机=数值域定稿 hp_below 0.7）。
  core10: [{ kind: 'trigger', on: 'hp_below', threshold: 0.7, once: true, effectRef: 'eff_core_sugar', source: 'core10' }],
  // 超级护罩：本舰护盾被打破 → 全队盾 攻×5·每场1。
  core11: [{ kind: 'trigger', on: 'shield_broken', once: true, effectRef: 'eff_core_supershield', source: 'core11' }],
  // 战鼓：本舰每放一次技能 → 全队增伤 +8%/层·上限5·8s（M3 skill_cast）。
  core12: [{ kind: 'trigger', on: 'skill_cast', effectRef: 'eff_core_wardrum', source: 'core12' }],
  // 贪吃星：击杀永久 +3% 基础攻（本场·无上限·M9 accumulate_attack）。
  core13: [{ kind: 'trigger', on: 'on_kill', effectRef: 'eff_core_gluttony', source: 'core13' }],
  // 守护铃：开场全队免控 8s·不可被驱散（M5 undispellable）。
  core14: [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_s7_guardianbell', source: 'core14' }],
  // 超新星（毕业核）：恒速攒 14s → 全体 ×5.0·周而复始（§18.3 实证终值：20s/×4.0 常规战只赶尾声=不达档·上调钉高一档）。
  core15: [{ kind: 'trigger', on: 'cd', cdSec: 14, initialCdSec: 14, effectRef: 'eff_s7_supernova', source: 'core15' }],
  // 银河烟花：击杀连锁补一发普攻级伤害（第一拍≈·上限≤5/递增+10%=M7 计数复释挂机制批③）。
  core16: [{ kind: 'trigger', on: 'on_kill', effectRef: 'eff_core_firework', source: 'core16' }],
};

/** 取某星核的运行时效果积木；未知或暂无质变的星核返回空数组（core17-22 深坑核=挂牌·机制批③）。 */
export function coreBlocks(coreId: string): readonly S7EffectBlock[] {
  return CORE_BLOCKS[coreId] ?? [];
}
