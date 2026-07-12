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

/** 插件品质：精良 / 优秀 / 传奇 / 传奇+ / 传奇++（段二 E2 扩两档·Ron 2026-07-12 拍板）。无等级，只分品质。
 *  传奇+/++ 主数值沿传奇档（"零新效果内容、纯组合"）；多出来的=额外附加条（bonusEffectIds·见下方附加池）。 */
export type S7PluginQuality = 'fine' | 'superior' | 'legendary' | 'legendaryPlus' | 'legendaryPlusPlus';
export const S7_PLUGIN_QUALITIES: readonly S7PluginQuality[] = ['fine', 'superior', 'legendary', 'legendaryPlus', 'legendaryPlusPlus'];

/** 品质→三档数值下标：传奇+/++ 数值沿传奇档（E2）。 */
const QI: Record<S7PluginQuality, 0 | 1 | 2> = { fine: 0, superior: 1, legendary: 2, legendaryPlus: 2, legendaryPlusPlus: 2 };
/** 品质→应带的"额外附加条"数（E2：传奇+共 2 条特殊效果=本体附加+1 额外；++共 3 条=+2 额外）。 */
export const S7_BONUS_COUNT_BY_QUALITY: Record<S7PluginQuality, number> = {
  fine: 0, superior: 0, legendary: 0, legendaryPlus: 1, legendaryPlusPlus: 2,
};
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
  plg01: (q) => { // 护盾：受伤−；机制批③段二传奇接真：受"重击"（技能命中·真源口径表）自罩盾 最大生命10%·每场3次
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dmgTakenPct', value: [-0.08, -0.15, -0.25][q], source: src('plg01') }];
    if (q === 2) {
      b.push({
        kind: 'stack',
        rule: {
          ruleId: 'plg01_guard_shield', on: 'was_hit_by_skill', stat: 'dmgTakenDownPct', perStack: 0, maxStacks: 1,
          onFullEffectRef: 'eff_plg_guard_shield', onFullScope: 'self', onFullMaxFires: 3, source: src('plg01'),
        },
        source: src('plg01'),
      } as S7EffectBlock);
    }
    return b;
  },
  plg03: (q) => { // 破甲：破盾效率；机制批③段二传奇接真：本舰打破敌盾→其防−20%·3s（armorDownOnShieldBreak）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'shieldBreak', value: [0.15, 0.30, 0.50][q], source: src('plg03') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'armorDownOnShieldBreak', value: 0.20, source: src('plg03') });
    return b;
  },
  plg05: (q) => { // 舰体：最大生命；机制批③段二传奇接真：<30% 时减伤+15%（lowHpDmgTakenDown）
    const b: S7EffectBlock[] = [{ kind: 'modifier', stat: 'maxHp', op: 'pct', value: [0.10, 0.22, 0.40][q], source: src('plg05') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'lowHpDmgTakenDown', value: 0.15, source: src('plg05') });
    return b;
  },
  plg06: (q) => { // 韧性：硬控时间−；机制批③段二传奇接真：每场免疫第一次硬控（firstControlImmune 闩锁）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'controlResist', value: [0.15, 0.30, 0.50][q], source: src('plg06') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'firstControlImmune', value: 1, source: src('plg06') });
    return b;
  },
  plg08: (q) => { // 医修：受疗+；机制批③段二传奇接真：满血时溢出治疗转护盾（overhealToShieldPct·受方语义→施方词条=装它的船自己被奶溢出转盾——真源"满血时溢出治疗转成护盾"主语=受方·词条挂本舰即本舰受益 ✓）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'healTakenPct', value: [0.12, 0.25, 0.45][q], source: src('plg08') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'overhealToShieldPct', value: 1.0, source: src('plg08') });
    return b;
  },
  plg12: (q) => [ // 自愈：每秒回最大生命 0.5/1/1.8%（battle_start 挂长时限 regen=⑯b 定式）
    { kind: 'trigger', on: 'battle_start', effectRef: ['eff_plg_regen_1', 'eff_plg_regen_2', 'eff_plg_regen_3'][q], source: src('plg12') },
  ],
  plg14: (q) => { // 净化：周期自清 1 减益（cd 装配·任务单 A3 点名件）；传奇=更勤 4.8s + 清后免疫减益 2s
    const cd = q === 2 ? 4.8 : 8;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'cd', cdSec: cd, effectRef: 'eff_plg_purify', source: src('plg14') }];
    if (q === 2) b.push({ kind: 'trigger', on: 'cd', cdSec: cd, effectRef: 'eff_plg_dimmune', source: src('plg14') });
    return b;
  },
  plg15: (q) => { // 警戒：闪避 8/15/25（⑩三段流派扶正）；机制批③段二传奇接真：闪避后下一击必暴（critAfterDodge 闩锁）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dodgeRate', value: [0.08, 0.15, 0.25][q], source: src('plg15') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critAfterDodge', value: 1, source: src('plg15') });
    return b;
  },
  plg16: (q) => [ // 援护：相邻友军互摊 10/18/30%·传奇附加抬到 40%（M4 share·援护链=命名载体）
    { kind: 'trigger', on: 'battle_start', effectRef: ['eff_plg_share_10', 'eff_plg_share_18', 'eff_plg_share_40'][q], source: src('plg16') },
  ],
  plg30: (q) => { // 机制批③段二 保命接真：致死免疫一次留 1 血（每场 1 次·三档同效）；传奇+触发后短暂无敌 1.5s
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'lethalGuardOnce', value: 1, source: src('plg30') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'lethalGuardImmuneSec', value: 1.5, source: src('plg30') });
    return b;
  },
  // ===== 武器槽 =====
  plg02: (q) => { // 火力；机制批③段二传奇接真：暴击时该次伤害 30% 溅射到最近相邻 1 格（critSplashPct）
    const b: S7EffectBlock[] = [{ kind: 'modifier', stat: 'attack', op: 'pct', value: [0.08, 0.18, 0.35][q], source: src('plg02') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critSplashPct', value: 0.30, source: src('plg02') });
    return b;
  },
  plg04: (q) => { // 瞄准；机制批③段二传奇接真：暴击时额外补一下（攻×0.5·critFollowupAtkPct）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'critRate', value: [0.08, 0.18, 0.30][q], source: src('plg04') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critFollowupAtkPct', value: 0.5, source: src('plg04') });
    return b;
  },
  plg09: (q) => { // 爆裂；机制批③段二传奇接真：暴击时攻速 +20%·3s（critHasteAmount）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'critDmg', value: [0.25, 0.50, 0.90][q], source: src('plg09') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critHasteAmount', value: 0.20, source: src('plg09') });
    return b;
  },
  plg10: (q) => { // 急速：攻速+8/18/30% 折间隔；机制批③段二传奇接真：每10%攻速→+4%普伤（按自带攻速档静折=+12%·外源攻速不联动=记近似 §16d）
    const b: S7EffectBlock[] = [{ kind: 'modifier', stat: 'attackIntervalSec', op: 'pct', value: [-0.074074, -0.152542, -0.230769][q], source: src('plg10') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'normalAtkDmgPct', value: 0.12, source: src('plg10') });
    return b;
  },
  plg17: (q) => { // 破障；机制批③段二传奇接真：对带盾/高防目标暴击率 +12%（critRateVsFortified）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dmgVsFortified', value: [0.12, 0.25, 0.45][q], source: src('plg17') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critRateVsFortified', value: 0.12, source: src('plg17') });
    return b;
  },
  plg19: (q) => { // 灭群：对小怪增伤·传奇+杀小怪缩 CD 0.5s（cd_refund+onKillRoleTags）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dmgVsSwarm', value: [0.15, 0.30, 0.55][q], source: src('plg19') }];
    if (q === 2) b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['swarm', 'swarm_tough'], effectRef: 'eff_plg_cdr_05', source: src('plg19') });
    return b;
  },
  plg20: (q) => { // 屠巨；机制批③段二传奇接真：对 Boss 暴伤 +30%（critDmgVsBoss）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'dmgVsBoss', value: [0.12, 0.25, 0.45][q], source: src('plg20') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critDmgVsBoss', value: 0.30, source: src('plg20') });
    return b;
  },
  plg21: (q) => [ // 机制批③段二 散射接真：普攻附带相邻溅射 10/20/35%（词条注入通道·⑨"行级字段无插件层注入"挂牌解除）；传奇=扩到相邻 4 格
    { kind: 'affix', affix: 'normalSplashPct', value: [0.10, 0.20, 0.35][q], source: src('plg21') },
    { kind: 'affix', affix: 'normalSplashTargets', value: q === 2 ? 4 : 1, source: src('plg21') },
  ],
  plg22: (q) => { // 机制批③段二 充能接真：隔拍蓄力·下一发 +20/40/70%（chargedNormal 状态机）；传奇=满蓄发附十字 50% 溅射
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'chargedNormalPct', value: [0.20, 0.40, 0.70][q], source: src('plg22') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'chargedNormalSplashPct', value: 0.5, source: src('plg22') });
    return b;
  },
  plg23: (q) => { // 嗜血；机制批③段二传奇接真：暴击时本次吸血翻倍（critLifestealDouble）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'lifesteal', value: [0.03, 0.06, 0.10][q], source: src('plg23') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'critLifestealDouble', value: 1, source: src('plg23') });
    return b;
  },
  // ===== 技能槽 =====
  plg07: (q) => { // 冷却：CD−8/15/25%；机制批③段二传奇接真：开局首技 CD 减半（firstSkillCdHalf·只压带首发延迟的触发·开局即放型天然满足=语义注）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'skillHaste', value: [0.086957, 0.176471, 0.333333][q], source: src('plg07') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'firstSkillCdHalf', value: 1, source: src('plg07') });
    return b;
  },
  plg11: (q) => { // 增幅；机制批③段二传奇接真：技能作用范围常驻升一档（skillAreaUp·同扭蛋 area_up 消费点）
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'skillDmgPct', value: [0.10, 0.22, 0.40][q], source: src('plg11') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'skillAreaUp', value: 1, source: src('plg11') });
    return b;
  },
  plg13: (q) => { // 机制批③段二 过载接真：技能暴击率专项 +12/25/45%（skillCritRate 新词条）；传奇=技能暴伤 +25%
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'skillCritRate', value: [0.12, 0.25, 0.45][q], source: src('plg13') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'skillCritDmgPct', value: 0.25, source: src('plg13') });
    return b;
  },
  plg18: (q) => [ // 机制批③段二 连发接真：技能 8/16/28% 概率连放两次（skillRepeatChance）；传奇"第二次不耗蓄力/条件"＝天然满足记语义注（连放本就不耗层）
    { kind: 'affix', affix: 'skillRepeatChance', value: [0.08, 0.16, 0.28][q], source: src('plg18') },
  ],
  plg24: (q) => [ // 回充：普攻命中缩 CD 0.2/0.4/0.7s·传奇翻倍=1.4s（attack_landed+cd_refund）
    { kind: 'trigger', on: 'attack_landed', effectRef: ['eff_plg_cdr_02', 'eff_plg_cdr_04', 'eff_plg_cdr_14'][q], source: src('plg24') },
  ],
  plg25: (q) => { // 机制批③段二 引爆接真：技能命中附带相邻额外伤 攻×0.3/0.6/1.0（skillDetonate）；传奇=波及十字 4 格
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'skillDetonateAtkPct', value: [0.3, 0.6, 1.0][q], source: src('plg25') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'skillDetonateCross', value: 1, source: src('plg25') });
    return b;
  },
  plg26: affix('plg26', 'effectAmp', [0.10, 0.22, 0.55]),      // 增效：+10/22/40%·传奇附加"再+一档"=40→55（§14）
  plg27: (q) => { // 机制批③段二 循环接真：技能每命中 1 目标缩 CD 0.2/0.4/0.6s（数值域定·§14 基础档未给数）；传奇=满目标再 −1.5s
    const b: S7EffectBlock[] = [{ kind: 'affix', affix: 'skillCdPerTargetSec', value: [0.2, 0.4, 0.6][q], source: src('plg27') }];
    if (q === 2) b.push({ kind: 'affix', affix: 'skillCdFullBonusSec', value: 1.5, source: src('plg27') });
    return b;
  },
  plg28: (q) => [ // 机制批③段二 余震接真：技能命中 1.5s 后延迟追加 攻×0.3/0.6/1.4（传奇附加=1.0→1.4·§14）
    { kind: 'affix', affix: 'aftershockAtkPct', value: [0.3, 0.6, 1.4][q], source: src('plg28') },
  ],
  plg29: affix('plg29', 'durationPct', [0.15, 0.30, 0.70]),    // 持久：+15/30/50%·传奇附加再延长=50→70（§14）
};

// ===== 传奇附加条（段二 E2·B 案＋R2 修订：**池=同槽全 10 件/全库 30 件**·随机抽去重·零新效果内容） =====
// R2（Ron 2026-07-12 返工令）：撤 07-12 早前"18 件可嫁接收窄"裁量——附加条池=B 案全 30 件；
// 所谓"死条"按**全游戏作用对象口径**逐条重定性（舰技能/驾驶员天赋/召唤物/词条族都算载体），
// 真白板率如实报（审计表=S7_BONUS_GRAFT_AUDIT·数字见 §16g 补账）。
// 每条=该件"传奇附加"的独立块（source=plugbonus:<捐主id>·语义与真源附加逐字对应）；
// 折档类（plg16/24/26/28/29）=第三档增量还原成独立加法/当量块（复用既有效果行·零新机制）；
// 语义绑定本体不可迁的（plg18/plg12）=空块（抽到=白板·审计表如实标）。
const BONUS_BUILDERS: Record<string, () => S7EffectBlock[]> = {
  // —— 武器槽 ——
  plg02: () => [{ kind: 'affix', affix: 'critSplashPct', value: 0.30, source: 'plugbonus:plg02' }],
  plg04: () => [{ kind: 'affix', affix: 'critFollowupAtkPct', value: 0.5, source: 'plugbonus:plg04' }],
  plg09: () => [{ kind: 'affix', affix: 'critHasteAmount', value: 0.20, source: 'plugbonus:plg09' }],
  plg10: () => [{ kind: 'affix', affix: 'normalAtkDmgPct', value: 0.12, source: 'plugbonus:plg10' }],
  plg17: () => [{ kind: 'affix', affix: 'critRateVsFortified', value: 0.12, source: 'plugbonus:plg17' }],
  plg19: () => [{ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['swarm', 'swarm_tough'], effectRef: 'eff_plg_cdr_05', source: 'plugbonus:plg19' }],
  plg20: () => [{ kind: 'affix', affix: 'critDmgVsBoss', value: 0.30, source: 'plugbonus:plg20' }],
  plg21: () => [{ kind: 'affix', affix: 'normalSplashTargets', value: 3, source: 'plugbonus:plg21' }], // 条件条：吃宿主普攻溅射（载体=烈阳 L50 普攻小溅射/散射件本体）
  plg22: () => [{ kind: 'affix', affix: 'chargedNormalSplashPct', value: 0.5, source: 'plugbonus:plg22' }], // 白板级：蓄力载体仅充能件本体（同槽互斥）
  plg23: () => [{ kind: 'affix', affix: 'critLifestealDouble', value: 1, source: 'plugbonus:plg23' }], // 白板级：吸血载体仅嗜血件本体（同槽互斥）
  // —— 技能槽 ——
  plg07: () => [{ kind: 'affix', affix: 'firstSkillCdHalf', value: 1, source: 'plugbonus:plg07' }],
  plg11: () => [{ kind: 'affix', affix: 'skillAreaUp', value: 1, source: 'plugbonus:plg11' }],
  plg13: () => [{ kind: 'affix', affix: 'skillCritDmgPct', value: 0.25, source: 'plugbonus:plg13' }],
  plg18: () => [], // 白板：连放"第二次不耗蓄力"=修饰自身连放的语义注·独立嫁接无载体（审计表如实标）
  plg24: () => [{ kind: 'trigger', on: 'attack_landed', effectRef: 'eff_plg_cdr_07', source: 'plugbonus:plg24' }], // 活：翻倍差值 +0.7s 独立成块（行现成）
  plg25: () => [{ kind: 'affix', affix: 'skillDetonateCross', value: 1, source: 'plugbonus:plg25' }], // 白板级：引爆载体仅本体（同槽互斥）
  plg26: () => [{ kind: 'affix', affix: 'effectAmp', value: 0.15, source: 'plugbonus:plg26' }],   // 55−40
  plg27: () => [{ kind: 'affix', affix: 'skillCdFullBonusSec', value: 1.5, source: 'plugbonus:plg27' }], // 白板级：逐目标缩CD载体仅本体
  plg28: () => [{ kind: 'affix', affix: 'aftershockAtkPct', value: 0.4, source: 'plugbonus:plg28' }], // 1.4−1.0
  plg29: () => [{ kind: 'affix', affix: 'durationPct', value: 0.20, source: 'plugbonus:plg29' }], // 0.70−0.50
  // —— 战术槽 ——
  plg01: () => [{
    kind: 'stack',
    rule: {
      ruleId: 'plg01_guard_shield', on: 'was_hit_by_skill', stat: 'dmgTakenDownPct', perStack: 0, maxStacks: 1,
      onFullEffectRef: 'eff_plg_guard_shield', onFullScope: 'self', onFullMaxFires: 3, source: 'plugbonus:plg01',
    },
    source: 'plugbonus:plg01',
  } as S7EffectBlock], // ruleId 与本体同名=单位内天然去重（同槽一件+去重规则保证同单位不会双持）
  plg03: () => [{ kind: 'affix', affix: 'armorDownOnShieldBreak', value: 0.20, source: 'plugbonus:plg03' }],
  plg05: () => [{ kind: 'affix', affix: 'lowHpDmgTakenDown', value: 0.15, source: 'plugbonus:plg05' }],
  plg06: () => [{ kind: 'affix', affix: 'firstControlImmune', value: 1, source: 'plugbonus:plg06' }],
  plg08: () => [{ kind: 'affix', affix: 'overhealToShieldPct', value: 1.0, source: 'plugbonus:plg08' }],
  plg12: () => [], // 白板：濒死自愈翻倍=语义绑定本体自愈档不可独立迁（审计表如实标）
  plg14: () => [{ kind: 'trigger', on: 'cd', cdSec: 8, effectRef: 'eff_plg_dimmune', source: 'plugbonus:plg14' }], // 活：周期免疫减益块独立成立（"清得更勤"绑本体不迁·部分嫁接如实注）
  plg15: () => [{ kind: 'affix', affix: 'critAfterDodge', value: 1, source: 'plugbonus:plg15' }], // 白板级：闪避载体仅警戒件本体（同槽互斥）
  plg16: () => [{ kind: 'trigger', on: 'battle_start', effectRef: 'eff_plg_share_10', source: 'plugbonus:plg16' }], // 活："分摊再提升"最小独立化=+10pp 互摊当量（行现成）
  plg30: () => [{ kind: 'affix', affix: 'lethalGuardImmuneSec', value: 1.5, source: 'plugbonus:plg30' }], // 白板级：免死闩载体仅保命件本体（同槽互斥）
};

/** R2 重定性审计表（逐条·全游戏作用对象口径）：live=任意宿主生效；conditional=特定搭配生效（载体点名）；
 *  blank=全游戏无独立载体（抽到=白板·如实入池如实报）。数字汇总见 §16g 补账与交付报告。 */
export const S7_BONUS_GRAFT_AUDIT: Record<string, { cls: 'live' | 'conditional' | 'blank'; carriers: string }> = {
  plg01: { cls: 'live', carriers: '任意宿主（受技能命中即触发罩盾）' },
  plg02: { cls: 'live', carriers: '任意宿主（基础暴击 5%+装配暴击词条）' },
  plg03: { cls: 'live', carriers: '任意宿主（伤害打破敌盾即触发）' },
  plg04: { cls: 'live', carriers: '任意宿主' },
  plg05: { cls: 'live', carriers: '任意宿主（低血状态）' },
  plg06: { cls: 'live', carriers: '任意宿主（受首次硬控）' },
  plg07: { cls: 'live', carriers: '任意宿主（带首发延迟技能）' },
  plg08: { cls: 'live', carriers: '任意宿主（受治疗溢出·队伍带奶更肥）' },
  plg09: { cls: 'live', carriers: '任意宿主' },
  plg10: { cls: 'live', carriers: '任意宿主（普攻伤害专项）' },
  plg11: { cls: 'live', carriers: '任意宿主（区域技能范围+1）' },
  plg12: { cls: 'blank', carriers: '无（"濒死自愈翻倍"语义绑定本体自愈档·全游戏无独立自愈翻倍载体）' },
  plg13: { cls: 'live', carriers: '任意宿主（技能可暴击=全体输出默认）' },
  plg14: { cls: 'live', carriers: '任意宿主（周期免疫减益块独立生效·"清得更勤"部分绑本体不迁）' },
  plg15: { cls: 'blank', carriers: '闪避词条仅警戒件本体（同槽互斥）——全游戏舰/员/核均无闪避源' },
  plg16: { cls: 'live', carriers: '任意宿主（+10pp 相邻互摊当量·eff_plg_share_10）' },
  plg17: { cls: 'live', carriers: '任意宿主（对带盾/高防敌·sf02 盾域起遍地）' },
  plg18: { cls: 'blank', carriers: '无（"连放第二次不耗蓄力"=修饰自身连放的语义注）' },
  plg19: { cls: 'live', carriers: '任意宿主（击杀小怪·群怪域高频）' },
  plg20: { cls: 'live', carriers: '任意宿主（对 Boss/精英）' },
  plg21: { cls: 'conditional', carriers: '烈阳 L50（普攻小溅射 normalSplashPct 0.30）——溅射扩到 4 格随宿主舰生效；其余宿主=白板' },
  plg22: { cls: 'blank', carriers: '蓄力词条仅充能件本体（同槽互斥）' },
  plg23: { cls: 'blank', carriers: '吸血词条仅嗜血件本体（同槽互斥·舰/员/核无吸血源〔烬"贪婪"=对高血增伤非吸血〕）' },
  plg24: { cls: 'live', carriers: '任意宿主（普攻命中缩 CD +0.7s=翻倍差值独立块）' },
  plg25: { cls: 'blank', carriers: '引爆词条仅本体（同槽互斥）' },
  plg26: { cls: 'live', carriers: '任意宿主（效果量通用放大）' },
  plg27: { cls: 'blank', carriers: '逐目标缩 CD 词条仅本体（同槽互斥）' },
  plg28: { cls: 'live', carriers: '任意宿主（技能命中延迟追加·独立 affix）' },
  plg29: { cls: 'live', carriers: '任意宿主（持续型效果延长）' },
  plg30: { cls: 'blank', carriers: '免死闩词条仅保命件本体（同槽互斥·苏5★=替他人挡/甘霖SS=复活·非免死闩载体）' },
};

/** 同槽位传奇效果池（R2＝B 案全量：同槽全 10 件；顺序固定=确定性 RNG 可复现）。 */
export const S7_BONUS_POOL_BY_SLOT: Record<S7PluginSlot, readonly string[]> = {
  weapon: ['plg02', 'plg04', 'plg09', 'plg10', 'plg17', 'plg19', 'plg20', 'plg21', 'plg22', 'plg23'],
  skill: ['plg07', 'plg11', 'plg13', 'plg18', 'plg24', 'plg25', 'plg26', 'plg27', 'plg28', 'plg29'],
  tactical: ['plg01', 'plg03', 'plg05', 'plg06', 'plg08', 'plg12', 'plg14', 'plg15', 'plg16', 'plg30'],
};

/** 一条附加（按捐主 id）解析成效果积木；未收录 id → 空数组（防脏档·合法性由合成/装配层把关）。 */
export function bonusEffectBlocks(donorPluginId: string): S7EffectBlock[] {
  const build = BONUS_BUILDERS[donorPluginId];
  return build ? build() : [];
}

/**
 * 把一个插件实例解析成效果积木（⑩A3：按 pluginId 精确词条·slotTag 仅溯源兼容保留）。
 * 未知 id 或基础效果无载体 → 空数组（装配器已校验归属·空=挂牌件只贡献战力刻度不上战场）。
 * 段二 E2：传奇+/++ 额外附加条经 bonusEffectIds 传入（捐主 id 列表·去重由合成/装配层保证），
 * 主数值沿传奇档；低品质传入 bonusEffectIds=忽略（防脏档拼强度）。
 */
export function pluginBlocks(
  pluginId: string, slotTag: S7PluginSlot, quality: S7PluginQuality, bonusEffectIds?: readonly string[],
): S7EffectBlock[] {
  void slotTag;
  const build = PLUGIN_BUILDERS[pluginId];
  const base = build ? build(QI[quality]) : [];
  const allow = S7_BONUS_COUNT_BY_QUALITY[quality];
  if (!bonusEffectIds || bonusEffectIds.length === 0 || allow <= 0) return base;
  const extras = bonusEffectIds.slice(0, allow).flatMap((id) => bonusEffectBlocks(id));
  return [...base, ...extras];
}
