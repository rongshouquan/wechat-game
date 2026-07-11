// 舰侧运行时（机制批③段二b·真源=GDD-附录D-星舰真源 · 数值=细表 §12 v0）：
// shipId + 星舰等级/阶级 → 升级大节点(L20-L100)与升阶质变(A/S/SS)的效果积木。
// 与 pilotBlocks/coreBlocks/pluginBlocks 同构；基础套件（Lv0 普攻/技1/技2）仍在 battle_unit_stat_param 行=不动。
// ⚠️ 段二 A3 封存注记（2026-07-12）：等级上限 100→50——本表 lv≥60 各档（L60/80/100 内容）随 51-100 段
//   整体封存未来版本（代码与数值保留不删·上限钳死即不可达·解封=未来版本抬上限）；L20/L40 档在 L10-50
//   新大节点带内原位有效（大节点账本=S7GrowthNodes·L10/30/50 三新节点零强度不进本表）。
//
// 口径（§16d 记档）：
//   ① tier：0=C 1=B 2=A 3=S 4=SS（B/S 阶主给槽+属性·属性跳由调用方 unitAscendBlocks 折算——本表只装机制质变）。
//   ② 组合并档（数值域裁量）：等级档 × 阶级质变的组合变体只做主线链（低频组合并入更高档=玩家提前受益的宽松向），
//      逐处行内注明；升档无通道件（蓄力门槛/行级叠层上限等）=微注如实记，挂批后微调。
//   ③ 光环类升档靠引擎"同单位重复上 aura 保留更强档"规则（次序无关）。
//   ④ 缺省 level=1/tier=0（C·Lv1 基线=行为不变）；调用点显式传值。
import { S7EffectBlock, S7StackRuleParam } from './S7BattleEffectBlock';

/** 大节点级门工具（同 pilotBlocks）：取 ≤level 的最后一档。 */
function nodeValue<T>(level: number, tiers: Array<[number, T]>): T | undefined {
  let out: T | undefined;
  for (const [lv, v] of tiers) {
    if (level >= lv) out = v;
  }
  return out;
}
const act = (slot: 'normal' | 'ultimate', effectRef: string, source: string): S7EffectBlock =>
  ({ kind: 'action', slot, effectRef, source });
const afx = (affix: string, value: number, source: string): S7EffectBlock =>
  ({ kind: 'affix', affix, value, source } as unknown as S7EffectBlock);
const trg = (on: string, effectRef: string, source: string, extra?: Record<string, unknown>): S7EffectBlock =>
  ({ kind: 'trigger', on, effectRef, source, ...(extra ?? {}) } as unknown as S7EffectBlock);
const mod = (stat: string, value: number, source: string): S7EffectBlock =>
  ({ kind: 'modifier', stat, op: 'pct', value, source } as unknown as S7EffectBlock);

/** 各舰积木构建器（shipId → (level, tier) → 升级/升阶积木）。行内注=§12/真源依据。 */
const BUILDERS: Record<string, (lv: number, tier: number) => S7EffectBlock[]> = {
  shp01: (lv, tier) => {
    // 极焰：L20/60/100 集火炮溅射档（十字⅓→3×3⅓→3×3⅔）·L40/80/S 装填 40/60/80%·A 集火炮+100%·SS 连放三次。
    const b: S7EffectBlock[] = [];
    const ult = nodeValue(lv, [[20, 'eff_s7_jihuopao_l20'], [60, 'eff_s7_jihuopao_l60'], [100, 'eff_s7_jihuopao_l100']]);
    if (ult) b.push(act('ultimate', ult, 'shp01'));
    const rc = tier >= 3 ? 'eff_s7_normal_reload_80' : nodeValue(lv, [[40, 'eff_s7_normal_reload_40'], [80, 'eff_s7_normal_reload_60']]);
    if (rc) b.push(act('normal', rc, 'shp01'));
    if (tier >= 2) b.push(afx('skillDmgPct', 1.0, 'shp01')); // A：集火炮伤害+100%（=本舰技能伤专项·单伤技等价·记档）
    if (tier >= 4) b.push(afx('skillRepeatCount', 2, 'shp01')); // SS：连放三次（1+2）
    return b;
  },
  shp02: (lv, tier) => {
    // 影刃：L20/40/80 狙杀 ×4.5/5.0/6.0·SS 连狙 3 目标；残影档=（节奏 lv≥60 每2次·目标 3★? 不：S 阶或 L100 →3 目标）。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_jusha_ss' : nodeValue(lv, [[20, 'eff_s7_jusha_l20'], [40, 'eff_s7_jusha_l40'], [80, 'eff_s7_jusha_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp02'));
    const every2 = lv >= 60;
    const three = tier >= 3 || lv >= 100;
    const split = every2 ? (three ? 'eff_s7_normal_shadow_l100' : 'eff_s7_normal_shadow_l60') : (three ? 'eff_s7_normal_shadow_s' : undefined);
    if (split) b.push(act('normal', split, 'shp02'));
    if (tier >= 2) b.push(afx('skillRepeatCount', 1, 'shp02')); // A"命中若存活再射一道"≈连放（目标已死=重选·记近似）
    return b;
  },
  shp03: (lv, tier) => {
    // 锋矢：L20/40/80 分镖 3记/×3.0/4记·SS 全体各一记；L60/S 疾火 +35/+50%（折间隔）；L100 普攻 20% 连击；A 分镖后附普攻。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_fenbiao_ss' : nodeValue(lv, [[20, 'eff_s7_fenbiao_l20'], [40, 'eff_s7_fenbiao_l40'], [80, 'eff_s7_fenbiao_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp03'));
    const haste = tier >= 3 ? -0.2333 : (lv >= 60 ? -0.1481 : undefined); // 疾火 15→35/50%：interval ×1.15/1.35 或 /1.5（折算记档）
    if (haste !== undefined) b.push(mod('attackIntervalSec', haste, 'shp03'));
    if (lv >= 100) b.push(act('normal', 'eff_s7_normal_x12_fs100', 'shp03'));
    if (tier >= 2) b.push(afx('summonSyncFire', 2, 'shp03')); // A：分镖命中触发一次额外普攻（复用"放技能→本舰普攻"钩·无召唤物=只普攻·记档）
    return b;
  },
  shp04: (lv, tier) => {
    // 蜂针：定时爆破延迟版档位（L40 3×3·A 附短路·SS 双贴=并档）；L20 爆伤+·L60 淬针 3 层·L100 易伤 8s。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_dingshibaopo_ss' : tier >= 2 ? 'eff_s7_dingshibaopo_a'
      : nodeValue(lv, [[40, 'eff_s7_dingshibaopo_l40']]);
    if (ult) b.push(act('ultimate', ult, 'shp04'));
    else if (lv >= 20) b.push(act('ultimate', 'eff_s7_dingshibaopo_l20', 'shp04'));
    const cz = nodeValue(lv, [[60, 'eff_s7_normal_cuizhen_l60'], [100, 'eff_s7_normal_cuizhen_l100']]);
    if (cz) b.push(act('normal', cz, 'shp04'));
    // L80 贴弹降防：并入 L100 淬针变体（低频组合并档·§16d）——单独档=alsoApply armor_down 变体
    if (lv >= 80 && lv < 100) b.push(act('normal', 'eff_s7_normal_cuizhen_l80', 'shp04'));
    return b;
  },
  shp05: (lv, tier) => {
    // 磐石：L20/L60/S 力场 −20%十字/−20% 3×3/−25% 3×3（光环保强规则）；张盾 L40/L80/L100/A/SS 档。
    const b: S7EffectBlock[] = [];
    const aura = tier >= 3 ? 'eff_s7_aura_panshi_s' : nodeValue(lv, [[20, 'eff_s7_aura_panshi_l20'], [60, 'eff_s7_aura_panshi_l60']]);
    if (aura) b.push(trg('battle_start', aura, 'shp05'));
    const zd = tier >= 4 ? 'eff_s7_zhangdun_ss' : tier >= 2 ? 'eff_s7_zhangdun_a'
      : nodeValue(lv, [[40, 'eff_s7_zhangdun_l40'], [80, 'eff_s7_zhangdun_l80'], [100, 'eff_s7_zhangdun_l100']]);
    if (zd) b.push(act('ultimate', zd, 'shp05'));
    return b;
  },
  shp06: (lv, tier) => {
    // 铁壁：L20 吼 4s·L80 吼 CD−2（skillHaste 0.25=10→8 精确折算）·A 吼期反弹 30%·SS 全场嘲讽+免伤 2s。
    // 坚甲 L60 上限 5/L100 −12%＝行级叠层规则无升档通道·微注如实记（挂批后微调·§16d）。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_nuhou_ss' : nodeValue(lv, [[20, 'eff_s7_nuhou_l20']]);
    if (ult) b.push(act('ultimate', ult, 'shp06'));
    if (lv >= 80) b.push(afx('skillHaste', 0.25, 'shp06'));
    if (tier >= 2) b.push(trg('skill_cast', 'eff_s7_nuhou_a_reflect', 'shp06')); // A：怒吼期反弹 30%（放吼瞬间上 4s 反弹态）
    if (tier >= 4) b.push(trg('skill_cast', 'eff_s7_nuhou_ss_immune', 'shp06')); // SS：吼瞬自身免伤 2s
    return b;
  },
  shp07: (lv, tier) => {
    // 堡垒（基础两技全新接·⑨挂牌解除）：Lv1 要塞展开（cd15·期间停普攻+大减伤·结束反击）·Lv10 厚装（每10%当前血防+2%）。
    // 档位并档链：base(−70%·4s·单体反击)→L20(−80%)→L40(反击十字)→L60(5s)；L80 CD−3=skillHaste 0.25；A 被打积能；S 低血保底；SS 全队共享。
    const b: S7EffectBlock[] = [];
    if (lv >= 1) {
      const fort = nodeValue(lv, [[1, 'eff_s7_yaosai'], [20, 'eff_s7_yaosai_l20'], [40, 'eff_s7_yaosai_l40'], [60, 'eff_s7_yaosai_l60']])!;
      b.push(trg('cd', fort, 'shp07', { cdSec: 15 }));
      if (tier >= 4) b.push(trg('cd', 'eff_s7_yaosai_team', 'shp07', { cdSec: 15 })); // SS：要塞期间全队共享减伤（同拍同 CD）
    }
    if (lv >= 10) b.push(afx('armorPerHpDecilePct', 0.02, 'shp07')); // 厚装
    if (lv >= 80) b.push(afx('skillHaste', 0.25, 'shp07')); // L80 要塞 CD−3（15/1.25=12）
    if (lv >= 100) b.push(afx('dmgVsFullHp', 0, 'shp07')); // L100 满血加攻＝无自满血词条·微注占位（0=零行为·§16d 如实记）
    if (tier >= 2) b.push(afx('fortressChargePct', 0.5, 'shp07')); // A：被打积能·反击 ×(1+0.5×受击次)
    if (tier >= 3) b.push(afx('lowHpArmorFlat', 30, 'shp07')); // S：低血保底一档防御
    return b;
  },
  shp08: (lv, tier) => {
    // 山岳：磁暴盾（Lv1 被动=受伤 15% 转全队盾·L20/L40/L80 比例档 18/20/25%=并档递进）·L60/L100 不动档·A 溢盾转奶·S 免首控·SS 全队分摊转盾。
    const b: S7EffectBlock[] = [];
    if (lv >= 1) {
      const pct = nodeValue(lv, [[1, 0.15], [20, 0.18], [40, 0.20], [80, 0.25]])!;
      b.push(afx('dmgToTeamShieldPct', pct, 'shp08'));
    }
    const bd = nodeValue(lv, [[60, 'eff_s7_budong_l60'], [100, 'eff_s7_budong_l100']]);
    if (bd) b.push(act('ultimate', bd, 'shp08'));
    if (tier >= 2) {
      b.push(afx('shieldCapMaxHpMult', 1.0, 'shp08')); // A 前置：盾上限=最大生命（防无限滚盾·数值域定）
      b.push(afx('overflowShieldToHealPct', 1.0, 'shp08')); // A：溢出的护盾转全队回血
    }
    if (tier >= 3) b.push(afx('firstControlImmune', 1, 'shp08')); // S：每场免疫一次硬控
    if (tier >= 4) b.push(trg('battle_start', 'eff_s7_shanyue_ss_share', 'shp08')); // SS：全队受伤分摊一部分给山岳（再经磁暴盾转盾）
    return b;
  },
  shp09: (lv, tier) => {
    // 烈阳：重火力接真（Lv10：普攻专项+25%·攻速−15%·档 L40 40%/L80 55%）·L20/60/S/SS 轰击档·L100 普攻小溅射·A +100%。
    const b: S7EffectBlock[] = [];
    if (lv >= 10) {
      b.push(afx('normalAtkDmgPct', nodeValue(lv, [[10, 0.25], [40, 0.40], [80, 0.55]])!, 'shp09'));
      b.push(mod('attackIntervalSec', 0.1765, 'shp09')); // 攻速−15%（间隔 ×1/0.85·折算记档）
    }
    const ult = tier >= 4 ? 'eff_s7_guozaihongji_ss' : tier >= 3 ? 'eff_s7_guozaihongji_s'
      : nodeValue(lv, [[20, 'eff_s7_guozaihongji_l20'], [60, 'eff_s7_guozaihongji_l60']]);
    if (ult) b.push(act('ultimate', ult, 'shp09'));
    if (lv >= 100) {
      b.push(afx('normalSplashPct', 0.30, 'shp09'));
      b.push(afx('normalSplashTargets', 1, 'shp09'));
    }
    if (tier >= 2) b.push(afx('skillDmgPct', 1.0, 'shp09')); // A：过载轰击伤害+100%
    return b;
  },
  shp10: (lv, tier) => {
    // 群蜂：饱和打击 L40/L80 +30/60%·A 附燃烧·SS 连放两轮；弹巢 Lv10（敌≥6→3×3）·L100 恒 3×3。
    // 蓄力门槛 L20 4层/S 3层＝行级 ultimateChargeKills 无升档通道·微注如实记（§16d）。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 2 ? 'eff_s7_saturation_a' : nodeValue(lv, [[40, 'eff_s7_saturation_l40'], [80, 'eff_s7_saturation_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp10'));
    if (lv >= 10) b.push(afx('normalAreaMinEnemies', 6, 'shp10'));
    if (lv >= 100) b.push(afx('normalAreaAlways', 1, 'shp10'));
    if (tier >= 4) b.push(afx('skillRepeatCount', 1, 'shp10')); // SS：满层后连放两轮
    return b;
  },
  shp11: (lv, tier) => {
    // 贯日：L20/L80 光束 ×2.2/×2.6·SS 扇面（全体·并档）；L60 燃烧叠2/S 燃烧伤+（普攻变体）；A 对燃烧敌+40%。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_guanchuan_ss' : nodeValue(lv, [[20, 'eff_s7_guanchuan_l20'], [80, 'eff_s7_guanchuan_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp11'));
    const nb = tier >= 3 ? 'eff_s7_normal_burnray_s' : nodeValue(lv, [[60, 'eff_s7_normal_burnray_l60']]);
    if (nb) b.push(act('normal', nb, 'shp11'));
    if (tier >= 2) b.push(afx('dmgVsBurning', 0.40, 'shp11')); // A：对燃烧中的敌人额外增伤（数值域定 40%）
    return b;
  },
  shp12: (lv, tier) => {
    // 霹雳：连锁闪电档（L20 5目标→L40 短路45%→L80 6目标→L100 ×1.5→A 必短路）·SS 引爆所有被短路敌（晚成调热=满配大幅超越）。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 2 ? 'eff_s7_liansuo_a'
      : nodeValue(lv, [[20, 'eff_s7_liansuo_l20'], [40, 'eff_s7_liansuo_l40'], [80, 'eff_s7_liansuo_l80'], [100, 'eff_s7_liansuo_l100']]);
    if (ult) b.push(act('ultimate', ult, 'shp12'));
    if (lv >= 60) b.push(act('normal', 'eff_s7_normal_x09_slow_l60', 'shp12')); // L60 减速幅度 −35%
    if (tier >= 4) b.push(trg('skill_cast', 'eff_s7_liansuo_ss_boom', 'shp12')); // SS：放连锁闪电→同拍引爆全部被短路敌 ×2.5
    return b;
  },
  shp13: (lv, tier) => {
    // 晨曦：L20/L40/S 盾量档（shieldPower 0.15/0.30/0.60=并档递进）·L60 回响净化2（双行变体）·L80 圣盾CD−2·L100 普盾附减伤·SS 圣盾+免控。
    // A"圣盾破时回血"＝无逐盾归源通道·微注如实记（§16d）。
    const b: S7EffectBlock[] = [];
    const sp = tier >= 3 ? 0.60 : nodeValue(lv, [[20, 0.15], [40, 0.30]]);
    if (sp !== undefined) b.push(afx('shieldPower', sp, 'shp13'));
    if (lv >= 60) {
      b.push(act('ultimate', tier >= 4 ? 'eff_s7_shengdun_ss' : 'eff_s7_shengdun_l60', 'shp13'));
      b.push(act('normal', lv >= 100 ? 'eff_s7_normal_shieldbubble_l100' : 'eff_s7_normal_shieldbubble_l60', 'shp13'));
    } else if (tier >= 4) {
      b.push(act('ultimate', 'eff_s7_shengdun_ss', 'shp13'));
    } else if (lv >= 100) {
      b.push(act('normal', 'eff_s7_normal_shieldbubble_l100', 'shp13'));
    }
    if (lv >= 80) b.push(afx('skillHaste', 0.20, 'shp13')); // L80 圣盾 CD−2（12/1.2=10）
    return b;
  },
  shp14: (lv, tier) => {
    // 号角：L20 旗光波+·冲锋号 L40/L80/A/SS 档·催进 L60/L100 光环档（保强规则）·S 催进附暴伤（cd 拼装）。
    const b: S7EffectBlock[] = [];
    if (lv >= 20) b.push(act('normal', 'eff_s7_normal_flag_l20', 'shp14'));
    const ult = tier >= 4 ? 'eff_s7_chongfenghao_ss' : tier >= 2 ? 'eff_s7_chongfenghao_a'
      : nodeValue(lv, [[40, 'eff_s7_chongfenghao_l40'], [80, 'eff_s7_chongfenghao_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp14'));
    const aura = nodeValue(lv, [[60, 'eff_s7_aura_haojiao_l60'], [100, 'eff_s7_aura_haojiao_l100']]);
    if (aura) b.push(trg('battle_start', aura, 'shp14'));
    if (tier >= 3) b.push(trg('cd', 'eff_s7_haojiao_s_critdmg', 'shp14', { cdSec: 8 })); // S：催进额外加暴伤（cd 反复上团队暴伤态=无缝）
    return b;
  },
  shp15: (lv, tier) => {
    // 甘霖：L20 普奶+·L40 治疗波+·L60 再生持续+（变体链）·SS 复活+全队回血（晚成调热=满配大幅超越）。
    // L80 范围更大/L100 普攻治疗溅射＝治疗无溅射/范围通道·微注如实记。
    const b: S7EffectBlock[] = [];
    if (lv >= 20) b.push(act('normal', 'eff_s7_normal_heal_l20', 'shp15'));
    const ult = tier >= 4 ? 'eff_s7_ganlin_ss'
      : nodeValue(lv, [[40, 'eff_s7_zhiliaobo_l40'], [60, 'eff_s7_zhiliaobo_l60']]);
    if (ult) b.push(act('ultimate', ult, 'shp15'));
    return b;
  },
  shp16: (lv, tier) => {
    // 春风：L20 群奶+·净化 L60 驱硬控/L80 驱2/A 回血+/SS 免疫+大回血；L40 微风+/L100 微风回盾＝触发次序病+无通道·微注如实记。
    const b: S7EffectBlock[] = [];
    if (lv >= 20) b.push(act('normal', 'eff_s7_normal_groupheal_l20', 'shp16'));
    const ult = tier >= 4 ? 'eff_s7_chunfeng_ss' : tier >= 2 ? 'eff_s7_chunfeng_a'
      : nodeValue(lv, [[60, 'eff_s7_chunfeng_l60'], [80, 'eff_s7_chunfeng_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp16'));
    return b;
  },
  shp17: (lv, tier) => {
    // 迷雾：普攻致盲接真（Lv0 基线行随本批换）·L20 致盲 4s·侵蚀档 L40 叠3/L80 40%/L100 叠满附沉默·A 附易伤·SS 全体。
    const b: S7EffectBlock[] = [];
    if (lv >= 20) b.push(act('normal', 'eff_s7_normal_fog_l20', 'shp17'));
    const ult = tier >= 4 ? 'eff_s7_zhimang_ss' : tier >= 2 ? 'eff_s7_zhimang_a'
      : nodeValue(lv, [[40, 'eff_s7_zhimang_l40'], [80, 'eff_s7_zhimang_l80'], [100, 'eff_s7_zhimang_l100']]);
    if (ult) b.push(act('ultimate', ult, 'shp17'));
    // S 侵蚀对 Boss 满效＝状态对 Boss 本就满效（controlResist 只缩硬控）·天然已满足记语义注（§16d）。
    return b;
  },
  shp18: (lv, tier) => {
    // 蜂巢：同步开火接真（Lv10=召唤物齐射·S=连本舰普攻）·蜂群 L20/40/80 架数·L60 无人机攻+·L100 时限+·A 溅射弹·SS 大型母舰机。
    const b: S7EffectBlock[] = [];
    if (lv >= 10) b.push(afx('summonSyncFire', tier >= 3 ? 2 : 1, 'shp18'));
    const ult = tier >= 4 ? 'eff_s7_fengqun_ss'
      : nodeValue(lv, [[20, 'eff_s7_fengqun_l20'], [40, 'eff_s7_fengqun_l40'], [80, 'eff_s7_fengqun_l80'], [100, 'eff_s7_fengqun_l100']]);
    if (ult) b.push(act('ultimate', ult, 'shp18'));
    if (lv >= 60) b.push(afx('summonAtkPct', 0.15, 'shp18'));
    if (tier >= 2) b.push({ kind: 'summon_override', normalEffectRef: 'eff_s7_drone_splash', source: 'shp18' } as unknown as S7EffectBlock); // A：无人机攻击附小溅射
    return b;
  },
  shp19: (lv, tier) => {
    // 哨卫：L20 诱饵盒血+（summonHpPct）·L40/L100 联防档（保强）·L60 嘲讽诱饵·L80 双盒·A 打爆反击（亡语）·SS 高血嘲讽堡垒。
    // 诱饵变体=大招行换召唤单位行（嘲讽触发/亡语在诱饵单位行上）·并档链：base→L60(嘲讽)→L80(嘲讽×2)→A(爆炸嘲讽×2)→SS(堡垒)。
    const b: S7EffectBlock[] = [];
    if (lv >= 20) b.push(afx('summonHpPct', 0.30, 'shp19'));
    const aura = nodeValue(lv, [[40, 'eff_s7_aura_lianfang_l40'], [100, 'eff_s7_aura_lianfang_l100']]);
    if (aura) b.push(trg('battle_start', aura, 'shp19'));
    const ult = tier >= 4 ? 'eff_s7_youerhe_ss' : tier >= 2 ? 'eff_s7_youerhe_a'
      : nodeValue(lv, [[60, 'eff_s7_youerhe_l60'], [80, 'eff_s7_youerhe_l80']]);
    if (ult) b.push(act('ultimate', ult, 'shp19'));
    return b;
  },
  shp20: (lv, tier) => {
    // 锁链：L20 牢笼 2s·L80 双技 CD−2（skillHaste 0.2 并档）·L100 脉冲沉默 2.5s·SS 全体短路（Boss 抗性自然约束）。
    // L40 削盾+/L60 牢笼更大＝系数常量/形状已顶·微注如实记。
    const b: S7EffectBlock[] = [];
    const ult = tier >= 4 ? 'eff_s7_laolong_ss' : nodeValue(lv, [[20, 'eff_s7_laolong_l20']]);
    if (ult) b.push(act('ultimate', ult, 'shp20'));
    if (lv >= 80) b.push(afx('skillHaste', 0.20, 'shp20'));
    if (lv >= 100) b.push(trg('cd', 'eff_s7_maichong_l100', 'shp20', { cdSec: 13 })); // L100 沉默 2.5s 版脉冲（替代行级第二主动=同 CD 同拍·记并档）
    return b;
  },
};

/**
 * 取星舰升级/升阶运行时积木。
 * @param level 星舰等级（缺省 1=基线·大节点 20/40/60/80/100 级门取档）。
 * @param tier  阶级 0-4=C/B/A/S/SS（缺省 0；A=大质变·SS=终极质变；B/S 主给槽+属性跳=调用方折算）。
 */
export function shipBlocks(shipId: string, level = 1, tier = 0): readonly S7EffectBlock[] {
  const build = BUILDERS[shipId];
  if (!build) return [];
  return build(Math.max(1, Math.floor(level)), Math.max(0, Math.min(4, Math.floor(tier))));
}
