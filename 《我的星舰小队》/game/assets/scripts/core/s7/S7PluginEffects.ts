// 插件运行时（⑩A3 · 30 件逐件接线·真源=GDD-附录D-插件真源 · 数值=真源三档保形收录=细表 §14）：
// 「槽位通用占位修正」灰盒口径退役——本表按 pluginId 给出每件词条的精确效果与三档数值。
// 品质制（v1.0 §5.3）：精良/优秀/传奇三档、同品质无升级；传奇额外一条附加小效果（可接线的在此装配，
// 无引擎载体的逐条挂牌=机制批③·清单见 plugin_config.effectNote 与细表 §14/§20.11）。
//
// 换算注：
//   - 攻速 +s% → attackIntervalSec 乘 1/(1+s)（引擎间隔=基础/(1+攻速和) 口径折算成 pct 修正）；
//   - 技能 CD −r% → skillHaste=r/(1−r)（引擎 cd 重排=cd/(1+haste)）；
//   - 净化模块周期=基础 8s／传奇 4.8s（真源"每隔一段"未给数·数值域定=传奇"更勤"=−40% 间隔·§14）。
import type { S7PluginSlot } from '../../config/s7/ConfigTypesS7';
import { S7EffectBlock } from './S7BattleEffectBlock';

/** 插件品质（v1.0 §5.3）：精良 / 优秀 / 传奇。无等级，只分品质。 */
export type S7PluginQuality = 'fine' | 'superior' | 'legendary';
export const S7_PLUGIN_QUALITIES: readonly S7PluginQuality[] = ['fine', 'superior', 'legendary'];

const QI: Record<S7PluginQuality, 0 | 1 | 2> = { fine: 0, superior: 1, legendary: 2 };
type Trio = [number, number, number];

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
const src = (id: string): string => `plugin:${id}`;

/** 三档词条速写。 */
const affix = (id: string, key: string, v: Trio) => (q: 0 | 1 | 2): S7EffectBlock[] => [
  { kind: 'affix', affix: key as never, value: v[q], source: src(id) },
];
const mod = (id: string, stat: string, v: Trio) => (q: 0 | 1 | 2): S7EffectBlock[] => [
  { kind: 'modifier', stat: stat as never, op: 'pct', value: v[q], source: src(id) },
];

/** 30 件逐件构建器（q=品质下标）。返回 []=基础效果无引擎载体（挂牌·机制批③）。 */
const PLUGIN_BUILDERS: Record<string, (q: 0 | 1 | 2) => S7EffectBlock[]> = {
  // ===== 战术槽 =====
  plg01: affix('plg01', 'dmgTakenPct', [-0.08, -0.15, -0.25]), // 护盾：受伤−（传奇重击自罩盾=挂牌）
  plg03: affix('plg03', 'shieldBreak', [0.15, 0.30, 0.50]),    // 破甲：破盾效率（传奇破盾降防=敌盾破无钩·挂牌）
  plg05: mod('plg05', 'maxHp', [0.10, 0.22, 0.40]),            // 舰体：最大生命（传奇<30%减伤=M9 动态·挂牌）
  plg06: affix('plg06', 'controlResist', [0.15, 0.30, 0.50]),  // 韧性：硬控时间−（传奇免疫首控=计数·挂牌）
  plg08: affix('plg08', 'healTakenPct', [0.12, 0.25, 0.45]),   // 医修：受疗+（传奇溢疗转盾=M9·挂牌）
  plg12: (q) => [ // 自愈：每秒回最大生命 0.5/1/1.8%（battle_start 挂长时限 regen=⑯b 定式）
    { kind: 'trigger', on: 'battle_start', effectRef: ['eff_plg_regen_1', 'eff_plg_regen_2', 'eff_plg_regen_3'][q], source: src('plg12') },
  ],
  plg14: (q) => { // 净化：周期自清 1 减益（cd 装配·任务单 A3 点名件）；传奇=更勤 4.8s + 清后免疫减益 2s
    const cd = q === 2 ? 4.8 : 8;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'cd', cdSec: cd, effectRef: 'eff_plg_purify', source: src('plg14') }];
    if (q === 2) b.push({ kind: 'trigger', on: 'cd', cdSec: cd, effectRef: 'eff_plg_dimmune', source: src('plg14') });
    return b;
  },
  plg15: affix('plg15', 'dodgeRate', [0.08, 0.15, 0.25]),      // 警戒：闪避（⑩三段流派扶正：6/12/20→8/15/25——尖峰世界每点闪避=整发免伤·闪避坦 n102 40%→高光线·§14 同步·真源数字为暂定'后期真机调'口径）（传奇闪避必暴=无闪避事件钩·挂牌）
  plg16: (q) => [ // 援护：相邻友军互摊 10/18/30%·传奇附加抬到 40%（M4 share·援护链=命名载体）
    { kind: 'trigger', on: 'battle_start', effectRef: ['eff_plg_share_10', 'eff_plg_share_18', 'eff_plg_share_40'][q], source: src('plg16') },
  ],
  plg30: () => [], // 保命：致死免疫留1血=伤害预结算（⑨深坑·苏5★同族）·挂牌
  // ===== 武器槽 =====
  plg02: mod('plg02', 'attack', [0.08, 0.18, 0.35]),           // 火力（传奇暴击溅射=M7·挂牌）
  plg04: affix('plg04', 'critRate', [0.08, 0.18, 0.30]),       // 瞄准（传奇暴击补刀=M7·挂牌）
  plg09: affix('plg09', 'critDmg', [0.25, 0.50, 0.90]),        // 爆裂（传奇暴击加攻速=无暴击事件钩·挂牌）
  plg10: mod('plg10', 'attackIntervalSec', [-0.074074, -0.152542, -0.230769]), // 急速：攻速+8/18/30% 折间隔
  plg17: affix('plg17', 'dmgVsFortified', [0.12, 0.25, 0.45]), // 破障（传奇对其暴击率=条件暴击·挂牌）
  plg19: (q) => { // 灭群：对小怪增伤·传奇+杀小怪缩 CD 0.5s（cd_refund+onKillRoleTags）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dmgVsSwarm', value: [0.15, 0.30, 0.55][q], source: src('plg19') }];
    if (q === 2) b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['swarm', 'swarm_tough'], effectRef: 'eff_plg_cdr_05', source: src('plg19') });
    return b;
  },
  plg20: affix('plg20', 'dmgVsBoss', [0.12, 0.25, 0.45]),      // 屠巨（传奇对Boss暴伤=条件暴伤·挂牌）
  plg21: () => [], // 散射：splashPct=伤害行字段·插件层注入无通道（挂牌·同霖涤荡病）
  plg22: () => [], // 充能：蓄力状态机=M7 交回（挂牌）
  plg23: affix('plg23', 'lifesteal', [0.03, 0.06, 0.10]),      // 嗜血（传奇暴击吸血翻倍=暴击事件·挂牌）
  // ===== 技能槽 =====
  plg07: affix('plg07', 'skillHaste', [0.086957, 0.176471, 0.333333]), // 冷却：CD−8/15/25%（传奇首技减半=无注入通道·挂牌）
  plg11: affix('plg11', 'skillDmgPct', [0.10, 0.22, 0.40]),    // 增幅（传奇范围+1格=行级档位·挂牌）
  plg13: () => [], // 过载：技能暴击率专项=需新词条（引擎改动=机制批③）·挂牌
  plg18: () => [], // 连发：repeatChance 仅普攻行·概率技能连放无载体（M7 完整版）·挂牌
  plg24: (q) => [ // 回充：普攻命中缩 CD 0.2/0.4/0.7s·传奇翻倍=1.4s（attack_landed+cd_refund）
    { kind: 'trigger', on: 'attack_landed', effectRef: ['eff_plg_cdr_02', 'eff_plg_cdr_04', 'eff_plg_cdr_14'][q], source: src('plg24') },
  ],
  plg25: () => [], // 引爆：技能命中事件+区域=M7 族·挂牌
  plg26: affix('plg26', 'effectAmp', [0.10, 0.22, 0.55]),      // 增效：+10/22/40%·传奇附加"再+一档"=40→55（§14）
  plg27: () => [], // 循环：命中目标计数联动无载体（§14 旧✓判过乐观·本批更正为挂牌）
  plg28: () => [], // 余震：延迟追加=M9 定时器·挂牌
  plg29: affix('plg29', 'durationPct', [0.15, 0.30, 0.70]),    // 持久：+15/30/50%·传奇附加再延长=50→70（§14）
};

/**
 * 把一个插件实例解析成效果积木（⑩A3：按 pluginId 精确词条·slotTag 仅溯源兼容保留）。
 * 未知 id 或基础效果无载体 → 空数组（装配器已校验归属·空=挂牌件只贡献战力刻度不上战场）。
 */
export function pluginBlocks(pluginId: string, slotTag: S7PluginSlot, quality: S7PluginQuality): S7EffectBlock[] {
  void slotTag;
  const build = PLUGIN_BUILDERS[pluginId];
  return build ? build(QI[quality]) : [];
}
