// 驾驶员运行时（⑩A1 全量接线·真源=GDD-附录D-驾驶员真源 · 数值=细表 §13 v0）：
// pilotId + 驾驶员等级/星级 → 效果积木。与星核(S7CoreEffects)/插件(S7PluginEffects)解析器同构。
//
// 口径（细表 §13 / 驾驶员真源 §0）：
//   ① 能力（打谁/护谁·含嘲讽/守护行为）＝起手 Lv0 即生效；
//   ② 天赋＝Lv1 解锁，Lv20/40/60/80/100 大节点强化（本表按级门取对应参数）；
//   ③ 3★/5★ 质变＝星门（可接线的在此装配；需新引擎机制的逐条挂牌=机制批③，见 §13 挂牌清单）；
//   ④ 「驾驶加成 +1%/级 · 能力线 +10%/星」＝C20 数值通道，由调用方折算（生成器 pilot_scale /
//      运行时 unitAscendBlocks），**本表不重复折算**（只装机制，防双吃）。
//   ⑤ 缺省 level=0/star=1（最保守·教程"起手 Lv0 只有能力"口径·总控回执⑤钉死）——
//      调用点（生成器/真实战斗）一律显式传值，禁缺省当满级。
//   ⑥ 亲和组=自然生效（真源 §0 2026-07-09 改制）：本表不建跨组门；友方向行为 tag 的
//      "方向匹配门"在装配合成层（S7BattleStatDerivation·行为方向与舰行基础 tag 方向一致才覆盖）。
import { S7EffectBlock, S7StackRuleParam } from './S7BattleEffectBlock';

/** 大节点级门工具：取 ≤level 的最后一档参数（levels 与 values 等长升序）。 */
function nodeValue<T>(level: number, tiers: Array<[number, T]>): T | undefined {
  let out: T | undefined;
  for (const [lv, v] of tiers) {
    if (level >= lv) out = v;
  }
  return out;
}

function stack(rule: S7StackRuleParam, source: string): S7EffectBlock {
  return { kind: 'stack', rule: { ...rule, source }, source } as S7EffectBlock;
}

/** 各驾驶员积木构建器（pilotId → (level, star) → 积木）。行内注=真源/§13 依据。 */
const BUILDERS: Record<string, (lv: number, star: number) => S7EffectBlock[]> = {
  // ===== 突击组（pil01-04）=====
  pil01: (lv, star) => {
    // 炎：能力=集火血量最少；天赋「过热」连击叠伤（M3 attack_landed·断击清空·L100 只降1层）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lowest_hp_enemy', source: 'pil01' }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.02], [20, 0.03], [40, 0.04]])!;
      const cap = nodeValue(lv, [[1, 3], [60, 4], [80, 5]])!;
      const rule: S7StackRuleParam = {
        ruleId: 'pil01_overheat', on: 'attack_landed', stat: 'dmgUpPct', perStack: per, maxStacks: cap,
        breakOn: 'attack_gap', breakGapSec: 2.5, breakAction: lv >= 100 ? 'decay_1' : 'clear',
      };
      // 机制批③段二 3★/5★「叠满致命一击」：叠满瞬间对触发目标放比例伤（目标最大生命15%·Boss减半·清零重攒）；
      // 5★ 范围化=目标+相邻4格同等伤害（cross 行）。
      if (star >= 3) {
        rule.onFullEffectRef = star >= 5 ? 'eff_pil_yan01_nova_s5' : 'eff_pil_yan01_nova_s3';
        rule.onFullScope = 'target';
      }
      b.push(stack(rule, 'pil01'));
    }
    return b;
  },
  pil02: (lv, star) => {
    // 影：能力=打最后排；天赋「斩首」对 <30% 残血增伤（dmgVsLowHp 词条·阈值 C6 固定）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'backline_first', source: 'pil02' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.40], [40, 0.50], [60, 0.60]])!;
      b.push({ kind: 'affix', affix: 'dmgVsLowHp', value: v, source: 'pil02' });
      // 机制批③段二 L20/L80「阈值 35%/40%」：本舰残血判定阈值覆盖词条（dmgVsLowHp/5★处决共用）。
      const thresh = nodeValue(lv, [[20, 0.35], [80, 0.40]]);
      if (thresh !== undefined) b.push({ kind: 'affix', affix: 'lowHpThresholdPct', value: thresh, source: 'pil02' });
      // 机制批③段二 L100「对残血敌暴击率+15%」（条件暴击词条）。
      if (lv >= 100) b.push({ kind: 'affix', affix: 'critRateVsLowHp', value: 0.15, source: 'pil02' });
    }
    if (star >= 3 && lv >= 1) {
      // 机制批③段二 3★「斩首击杀后对另一后排目标再判一次」：on_kill 补一发（斩首增伤词条自然作用）。
      b.push({ kind: 'trigger', on: 'on_kill', effectRef: 'eff_pil_ying02_rejudge', source: 'pil02' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「处决」：<40% 非 Boss 即死；Boss=首次跌破后下一击追加最大生命 8%（每场每 Boss 一次·§16d）。
      b.push({ kind: 'affix', affix: 'executeLowHpPct', value: 0.40, source: 'pil02' });
      b.push({ kind: 'affix', affix: 'executeBossMaxHpPct', value: 0.08, source: 'pil02' });
    }
    return b;
  },
  pil03: (lv, star) => {
    // 燎：能力=残血优先（无则最前排）；天赋「连斩」击杀缩本舰 CD（cd_refund·M积木⑥8a）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lowhp_then_nearest', source: 'pil03' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_cdr_15'], [20, 'eff_pil_cdr_20'], [40, 'eff_pil_cdr_25'], [60, 'eff_pil_cdr_30'], [80, 'eff_pil_cdr_35'], [100, 'eff_pil_cdr_40']])!;
      b.push({ kind: 'trigger', on: 'on_kill', effectRef: eff, source: 'pil03' });
    }
    if (star >= 3) {
      // 3★ 连杀期攻速逐层涨；真源"短暂"→断档口径=4s 无击杀清空（数值域定·§13 注记）。
      b.push(stack({ ruleId: 'pil03_chain_haste', on: 'kill', stat: 'atkSpeedPct', perStack: 0.10, breakOn: 'attack_gap', breakGapSec: 4, breakAction: 'clear' }, 'pil03'));
    }
    if (star >= 5 && lv >= 1) {
      // 机制批③段二 5★「一次出手 2+ 杀→直接刷新技能 CD」（minKills 门·cd_refund 999=归零）。
      b.push({ kind: 'trigger', on: 'on_kill', minKills: 2, effectRef: 'eff_pil_cdr_full', source: 'pil03' });
    }
    return b;
  },
  pil04: (lv, star) => {
    // 蛰：能力=关键单位优先；天赋「斩链」杀治疗/召唤源→全队增伤（M1 dmg_up + ⑦onKillRoleTags）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'key_unit_first', source: 'pil04' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_zhe_dmgup'], [20, 'eff_pil_zhe_dmgup_l20'], [40, 'eff_pil_zhe_dmgup_l40'], [60, 'eff_pil_zhe_dmgup_l60'], [80, 'eff_pil_zhe_dmgup_l80'], [100, 'eff_pil_zhe_dmgup_l100']])!;
      b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['support', 'summon_source'], effectRef: eff, source: 'pil04' });
    }
    if (star >= 3) {
      // 3★ 杀关键单位附回本舰 CD 2s（同触发条件第二块积木）。
      b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['support', 'summon_source'], effectRef: 'eff_pil_cdr_20', source: 'pil04' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「对治疗/召唤源+30%处决伤」（dmgVsKeyUnit 条件词条）。
      b.push({ kind: 'affix', affix: 'dmgVsKeyUnit', value: 0.30, source: 'pil04' });
    }
    return b;
  },
  // ===== 护卫组（pil05-08）=====
  pil05: (lv, star) => {
    // 岩：能力=光盾守护（M4 guard·起手即生效·CD 2s→L20 1.8→L100 1.5）；天赋「反震」格挡+反弹（M4 reflect）。
    const guardEff = nodeValue(lv, [[0, 'eff_pil_yan_guard'], [20, 'eff_pil_yan_guard_l20'], [100, 'eff_pil_yan_guard_l100']])!;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'battle_start', effectRef: guardEff, source: 'pil05' }];
    if (lv >= 1) {
      const reflectEff = nodeValue(lv, [[1, 'eff_pil_yan_reflect'], [40, 'eff_pil_yan_reflect_l40'], [60, 'eff_pil_yan_reflect_l60'], [80, 'eff_pil_yan_reflect_l80']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: reflectEff, source: 'pil05' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「守护触发时自身短暂减伤 20%」（守护触发钩=词条驱动）。
      b.push({ kind: 'affix', affix: 'guardSelfDmgDownPct', value: 0.20, source: 'pil05' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「守护改为同时替 2 名后排挡下」（每冷却窗替挡次数 1→2）。
      b.push({ kind: 'affix', affix: 'guardExtraCharges', value: 1, source: 'pil05' });
    }
    return b;
  },
  pil06: (lv, star) => {
    // 砺：能力=持续嘲讽最高攻敌（⑨M4 定式：cd 触发反复 apply_state(taunt, highest_attack_enemy)·起手即生效）。
    const tauntEff = nodeValue(lv, [[0, 'eff_pil_li_taunt'], [20, 'eff_pil_li_taunt_l20'], [80, 'eff_pil_li_taunt_l80']])!;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'cd', cdSec: 3, effectRef: tauntEff, source: 'pil06' }];
    if (lv >= 1) {
      // 天赋「愈坚」：每损 10% 血 +3%/4%/5% 减伤（M3 hp_lost_decile 派生层数）。上限档=派生自然顶（≤10 档）；
      // L100"上限+2档"语义与派生顶重合·记 §13 语义注（无独立参数可加）。
      const per = nodeValue(lv, [[1, 0.03], [40, 0.04], [60, 0.05]])!;
      const rule: S7StackRuleParam = { ruleId: 'pil06_resolve', on: 'hp_lost_decile', stat: 'dmgTakenDownPct', perStack: per };
      // 机制批③段二 3★「血量<50% 时愈坚翻倍」（规则级条件倍率）。
      if (star >= 3) rule.doubleBelowHpPct = 0.5;
      b.push(stack(rule, 'pil06'));
    }
    if (star >= 5) {
      // 机制批③段二 5★「血越低把受伤一部分反弹给嘲讽目标」：比例=15%×(已损血/0.5) 封顶 15%。
      b.push({ kind: 'affix', affix: 'tauntReflectPct', value: 0.15, source: 'pil06' });
    }
    return b;
  },
  pil07: (lv, star) => {
    // 机制批③段二 岳能力接真：打"窗口内攻击过我方后排"的敌人（事件知识目标·backline_attacker_first）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'backline_attacker_first', source: 'pil07' }];
    if (lv >= 1) {
      // 天赋「荆甲」：反弹固定伤=自身防×比例（M4 reflectArmorPct 施加瞬间快照）；3★ 改按攻击者攻×12%。
      const eff = star >= 3
        ? 'eff_pil_yue_thorns_s3'
        : nodeValue(lv, [[1, 'eff_pil_yue_thorns'], [20, 'eff_pil_yue_thorns_l20'], [60, 'eff_pil_yue_thorns_l60'], [80, 'eff_pil_yue_thorns_l80'], [100, 'eff_pil_yue_thorns_l100']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: eff, source: 'pil07' });
    }
    // L40「被多敌攻击时反弹叠加」＝天然已满足（M4 反弹对每个攻击者独立结算·语义注 §16d·同藏 L40 先例）。
    if (star >= 5) {
      // 机制批③段二 5★「被集火反射全部攻击者」：受伤×20% 均分给窗口内全部攻击者（数值域定稿）。
      b.push({ kind: 'affix', affix: 'reflectAllRecentPct', value: 0.20, source: 'pil07' });
    }
    return b;
  },
  pil08: (lv, star) => {
    // 沧：能力=优先保护被集火/被控友军（8a controlled_ally_first·友方向——方向匹配门下在支援舰类生效）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'controlled_ally_first', source: 'pil08' }];
    if (lv >= 1) {
      // 天赋「坚壁」：每名残血友军 +4/5/6/8% 减伤（M6 aura·per_lowhp_ally·self）。
      const eff = nodeValue(lv, [[1, 'eff_pil_cang_aura'], [20, 'eff_pil_cang_aura_l20'], [60, 'eff_pil_cang_aura_l60'], [80, 'eff_pil_cang_aura_l80']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: eff, source: 'pil08' });
      if (lv >= 40) b.push({ kind: 'affix', affix: 'shieldPower', value: 0.15, source: 'pil08' }); // L40 也提升护盾效果
      // 机制批③段二 顺路升级「驰援」（Ron 拍定·Lv1 随天赋直接解锁）：友军首次跌残血→沧立即获盾+嘲讽一次。
      b.push({ kind: 'trigger', on: 'ally_lowhp', threshold: 0.3, effectRef: 'eff_pil_cang08_rescue_shield', source: 'pil08' });
      b.push({ kind: 'trigger', on: 'ally_lowhp', threshold: 0.3, effectRef: 'eff_pil_cang08_rescue_taunt', source: 'pil08' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「友军被硬控时分摊 30%」（条件分摊·引擎 anyShareGuard 门）。
      b.push({ kind: 'affix', affix: 'shareForControlledPct', value: 0.30, source: 'pil08' });
    }
    if (star >= 5 && lv >= 1) {
      // 机制批③段二 5★「减伤一半共享全队」：第二条团队光环（per_lowhp·幅度=基座一半·近似取中档 0.03·复测校）。
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: 'eff_pil_cang08_s5_aura', source: 'pil08' });
    }
    return b;
  },
  // ===== 炮击组（pil09-12）=====
  pil09: (lv, star) => {
    // 源：能力=锁定打到死（lock_until_dead）；天赋「专注」对锁定目标逐秒增伤（M3 dmgVsLockedPct·换目标清空）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lock_until_dead', source: 'pil09' }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.03], [40, 0.04], [80, 0.05]])!;
      const capPct = nodeValue(lv, [[1, 0.30], [20, 0.40], [60, 0.50], [100, 0.60]])!;
      const rule: S7StackRuleParam = {
        ruleId: 'pil09_focus', on: 'per_second', stat: 'dmgVsLockedPct', perStack: per,
        maxStacks: Math.round(capPct / per), // 上限档=层数量子化（如 0.40/0.03→13 层=39%·±1pp 记 §13）
      };
      // 3★ 大质变：锁定目标死亡换锁不清空（继承）——lock_until_dead 只在目标死时换锁，
      // 故 base 的 target_switch 断条件 ≡"击杀后清空"、3★ 去掉断条件 ≡"继承给下一个"（精确映射）。
      if (star < 3) {
        rule.breakOn = 'target_switch';
        rule.breakAction = 'clear';
      }
      b.push(stack(rule, 'pil09'));
    }
    if (star >= 5) {
      // 机制批③段二 5★「专注拉满时技能对锁定目标必定暴击」（focusMaxGuaranteedCrit 闩锁）。
      b.push({ kind: 'affix', affix: 'focusMaxGuaranteedCrit', value: 1, source: 'pil09' });
    }
    return b;
  },
  pil10: (lv, star) => {
    // 烬：能力=打最肥；天赋「贪婪」对 >50% 血增伤（dmgVsHighHp·阈值 C7 固定）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_hp_enemy', source: 'pil10' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.25], [20, 0.35], [60, 0.45], [80, 0.55]])!;
      b.push({ kind: 'affix', affix: 'dmgVsHighHp', value: v, source: 'pil10' });
      // 机制批③段二 L40「阈值放宽到 >40% 血」（高血判定阈值覆盖词条）。
      if (lv >= 40) b.push({ kind: 'affix', affix: 'highHpThresholdPct', value: 0.40, source: 'pil10' });
      // 机制批③段二 L100「对高血敌暴击+15%」。
      if (lv >= 100) b.push({ kind: 'affix', affix: 'critRateVsHighHp', value: 0.15, source: 'pil10' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「对满血敌额外+30% 并削当前生命 3%」。
      b.push({ kind: 'affix', affix: 'dmgVsFullHp', value: 0.30, source: 'pil10' });
      b.push({ kind: 'affix', affix: 'shaveCurHpPct', value: 0.03, source: 'pil10' });
    }
    if (star >= 5) {
      // 机制批③段二 5★（Ron 拍A）：「对Boss满额」＝天然已满足记语义注（base 词条本就无 Boss 折减）；
      // 真内容=顺路升级「破半」：目标被打入半血以下的那一击追加 攻×1.0（演出=爆点放大无飘字·数值域定稿）。
      b.push({ kind: 'affix', affix: 'halfBreakAtkPct', value: 1.0, source: 'pil10' });
    }
    return b;
  },
  pil11: (lv, star) => {
    // 骁：能力=集火第一排；天赋「先锋」开战窗口增伤（M1 battle_start + dmg_up·L100 附攻速）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'first_column_first', source: 'pil11' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_xiao_vanguard'], [20, 'eff_pil_xiao_vanguard_l20'], [40, 'eff_pil_xiao_vanguard_l40'], [60, 'eff_pil_xiao_vanguard_l60'], [80, 'eff_pil_xiao_vanguard_l80'], [100, 'eff_pil_xiao_vanguard_l100']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: eff, source: 'pil11' });
    }
    if (star >= 3 && lv >= 1) {
      // 3★ 先锋期 CD 减半：窗口期 skill_haste_up 1.0（cd/(1+1)=减半·M1 急速轴）。
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: 'eff_pil_xiao_s3_haste', source: 'pil11' });
    }
    if (star >= 5 && lv >= 1) {
      // 机制批③段二 5★「先锋期间击杀延长 2s」（extend_state·窗口过期后击杀=空转）。
      b.push({ kind: 'trigger', on: 'on_kill', effectRef: 'eff_pil_xiao11_extend', source: 'pil11' });
    }
    return b;
  },
  pil12: (lv, star) => {
    // 翎：能力=掐最高攻；天赋「夺势」击杀后攻速窗口（M1 on_kill + atk_speed_up·L100 附暴击率）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_attack_enemy', source: 'pil12' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_ling_asu'], [20, 'eff_pil_ling_asu_l20'], [40, 'eff_pil_ling_asu_l40'], [60, 'eff_pil_ling_asu_l60'], [80, 'eff_pil_ling_asu_l80'], [100, 'eff_pil_ling_asu_l100']])!;
      b.push({ kind: 'trigger', on: 'on_kill', effectRef: eff, source: 'pil12' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「夺势期间普攻附带额外一击」（持加攻速态判定·杂源攻速态同判=宽松口径记 §16d）。
      b.push({ kind: 'affix', affix: 'extraNormalHitWhileAtkSpeedUp', value: 1, source: 'pil12' });
    }
    if (star >= 5 && lv >= 1) {
      // 机制批③段二 5★「击杀高攻目标时夺势翻倍」：杀"当时最高攻敌"触发双倍档夺势行（0.9≈高档×2·复测校）。
      b.push({ kind: 'trigger', on: 'on_kill', onKillHighestAttack: true, effectRef: 'eff_pil_ling12_asu_x2', source: 'pil12' });
    }
    return b;
  },
  // ===== 支援组（pil13-16）=====
  pil13: (lv, star) => {
    // 苏：能力=救最残（lowest_hp_ally·友方向）；天赋「回光」残血治疗增效（healVsLowHp）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lowest_hp_ally', source: 'pil13' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.30], [20, 0.45], [60, 0.60]])!;
      b.push({ kind: 'affix', affix: 'healVsLowHp', value: v, source: 'pil13' });
      // 机制批③段二 L40「含护盾量」/L80「盾+」：对残血友军护盾量+（0.45→0.60 跟治疗档错一档跟上·数值域定）。
      const sv = nodeValue(lv, [[40, 0.45], [80, 0.60]]);
      if (sv !== undefined) b.push({ kind: 'affix', affix: 'shieldVsLowHp', value: sv, source: 'pil13' });
      // 机制批③段二 L100「治疗溢出转护盾」（溢疗转盾=医修族同消费点）。
      if (lv >= 100) b.push({ kind: 'affix', affix: 'overhealToShieldPct', value: 1.0, source: 'pil13' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「被本舰治到满血的友军获短暂护盾（血 10%）」。
      b.push({ kind: 'affix', affix: 'healFullShieldMaxHpPct', value: 0.10, source: 'pil13' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「友军将被致死时替其挡一次（每场 1 次）」（⑨护栏①深坑=致死预结算族接真）。
      b.push({ kind: 'affix', affix: 'saveAllyLethalOnce', value: 1, source: 'pil13' });
    }
    return b;
  },
  pil14: (lv, star) => {
    // 澈：能力=增益喂输出最高友军（highest_attack_ally·友方向）。
    // 机制批③段二 天赋「增幅」接真：buffAmpPct=本舰施加的增益态幅度放大（"状态幅度增效"新消费点·
    // effectAmp 语义修正落点——旧"接 effectAmp=放大伤盾疗"判语义错已挂牌，本批开真消费点）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_attack_ally', source: 'pil14' }];
    if (lv >= 1) {
      const amp = nodeValue(lv, [[1, 0.20], [20, 0.30], [60, 0.40], [80, 0.50]])!;
      b.push({ kind: 'affix', affix: 'buffAmpPct', value: amp, source: 'pil14' });
      if (lv >= 40) b.push({ kind: 'affix', affix: 'durationPct', value: 0.25, source: 'pil14' });
      // 机制批③段二 L100「增益也小幅加暴击」：施加增益附带暴击率 +8% rider。
      if (lv >= 100) b.push({ kind: 'affix', affix: 'buffRiderCritRate', value: 0.08, source: 'pil14' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「被本舰增益的主C暴击伤害+20%」（增益附暴伤 rider）。
      b.push({ kind: 'affix', affix: 'buffRiderCritDmg', value: 0.20, source: 'pil14' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「主C阵亡时增益转移给下一个最高攻友军」。
      b.push({ kind: 'affix', affix: 'buffTransferOnDeath', value: 1, source: 'pil14' });
    }
    return b;
  },
  pil15: (lv, star) => {
    // 沛：能力=铺没增益/盾的友军（no_buff_ally_first·友方向）✓。
    // 机制批③段二 天赋「润泽」接真：coverageAmpPerAlly=按"被本舰覆盖友军数"逐人放大本舰增益/护盾
    // （跨单位条件族·覆盖计数=状态 sourceUnitId 元数据）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'no_buff_ally_first', source: 'pil15' }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.04], [60, 0.05], [80, 0.06]])!;
      b.push({ kind: 'affix', affix: 'coverageAmpPerAlly', value: per, source: 'pil15' });
      // L20「加成上限+」＝线性无上限件·天然已满足记语义注（§16d）。
      // 机制批③段二 L40「覆盖全队额外小回血」：周期小回血（cd10·攻×4%/s·2s·近似不设全覆盖门=记近似·复测校）。
      if (lv >= 40) b.push({ kind: 'trigger', on: 'cd', cdSec: 10, effectRef: 'eff_pil_pei15_regen', source: 'pil15' });
      // 机制批③段二 L100「覆盖全队时小幅延长辅助持续」：durationPct +25%（近似恒开·复测校）。
      if (lv >= 100) b.push({ kind: 'affix', affix: 'durationPct', value: 0.25, source: 'pil15' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「全队都被覆盖时全队获小护盾（血 8%）」：周期小盾（cd14·近似不设门·复测校）。
      b.push({ kind: 'trigger', on: 'cd', cdSec: 14, effectRef: 'eff_pil_pei15_s3_shield', source: 'pil15' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「覆盖全队时本舰辅助持续翻倍」（真条件门=allAlliesCoveredBy·非近似）。
      b.push({ kind: 'affix', affix: 'durationPctFullCoverage', value: 1.0, source: 'pil15' });
    }
    return b;
  },
  pil16: (lv, star) => {
    // 霖：能力=救减益最多的友军（most_debuffed_ally·友方向）✓。
    // 机制批③段二 天赋「涤荡」接真：healDispelCount 词条=驾驶员层注入通道（本舰治疗附驱散·
    // 效果行 dispelCount 之外相加——⑨"行级字段无驾驶员层注入通道"挂牌解除）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'most_debuffed_ally', source: 'pil16' }];
    if (lv >= 1) {
      const cnt = star >= 5 ? 99 : nodeValue(lv, [[1, 1], [20, 2], [60, 3], [100, 4]])!;
      b.push({ kind: 'affix', affix: 'healDispelCount', value: cnt, source: 'pil16' });
      // 机制批③段二 L40「可驱散硬控」。
      if (lv >= 40) b.push({ kind: 'affix', affix: 'healDispelHardControl', value: 1, source: 'pil16' });
      // 机制批③段二 L80「净化回血 攻×80%」（5★=清空全部+回血 攻×300%）。
      const heal = star >= 5 ? 3.0 : (lv >= 80 ? 0.8 : 0);
      if (heal > 0) b.push({ kind: 'affix', affix: 'healOnDispelAtkPct', value: heal, source: 'pil16' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「被本舰净化的友军短时免疫新减益 2s」。
      b.push({ kind: 'affix', affix: 'afterDispelImmuneSec', value: 2, source: 'pil16' });
    }
    return b;
  },
  // ===== 工程组（pil17-20）=====
  pil17: (lv, star) => {
    // 蔽：能力=集火已被控/带减益的敌人（debuffed_first）✓。
    // 机制批③段二 天赋「笼罩」接真：debuffedTakenAmpTeam=被控/带减益敌受全队伤害+（跨单位条件族·
    // 消费点=dealDamage 团队易伤扫描·anyCloak 门）。基座对 Boss 不生效、L40 才开（真源大节点）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'debuffed_first', source: 'pil17' }];
    if (lv >= 1) {
      const amp = nodeValue(lv, [[1, 0.12], [20, 0.18], [60, 0.24], [80, 0.30]])!;
      b.push({ kind: 'affix', affix: 'debuffedTakenAmpTeam', value: amp, source: 'pil17' });
      if (lv >= 40) b.push({ kind: 'affix', affix: 'debuffedTakenIncludeBoss', value: 1, source: 'pil17' });
      // L100「笼罩持续/范围+」＝被动无持续/范围概念·天然已满足记语义注（§16d）。
    }
    if (star >= 3) {
      // 机制批③段二 3★「敌人每多一种减益再叠 6%」。
      b.push({ kind: 'affix', affix: 'debuffedTakenPerDebuff', value: 0.06, source: 'pil17' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「全队对被本舰盯上的（带减益）目标暴击率+15%」。
      b.push({ kind: 'affix', affix: 'teamCritVsDebuffed', value: 0.15, source: 'pil17' });
    }
    return b;
  },
  pil18: (lv, star) => {
    // 空：能力=优先打召唤源（key_unit_first=治疗/召唤源优先·8a 口径）；天赋「净场」杀召唤源回 CD。
    // 击杀过滤=['summon_source']（"杀召唤物也回CD"待敌配召唤物 roleTag 细分·§13 挂牌注）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'key_unit_first', source: 'pil18' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_cdr_15'], [20, 'eff_pil_cdr_20'], [60, 'eff_pil_cdr_25'], [80, 'eff_pil_cdr_30']])!;
      b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['summon_source'], effectRef: eff, source: 'pil18' });
    }
    if (star >= 5) {
      // 5★ 场上无敌方召唤物时本舰 CD 持续加速（⑨M6 no_enemy_summon 光环·空5★=原生载体）。
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: 'eff_pil_kong_s5_aura', source: 'pil18' });
    }
    // 机制批③段二 L40「对召唤源+25%」/L100「对源穿防 50%」（条件词条族）。
    if (lv >= 40) b.push({ kind: 'affix', affix: 'dmgVsSummonSource', value: 0.25, source: 'pil18' });
    if (lv >= 100) b.push({ kind: 'affix', affix: 'armorPenVsSummonSource', value: 0.5, source: 'pil18' });
    if (star >= 3 && lv >= 1) {
      // 机制批③段二 3★「杀召唤源顺带清场伤（十字·攻×1.5）」（on_kill 过滤=召唤源）。
      b.push({ kind: 'trigger', on: 'on_kill', onKillRoleTags: ['summon_source'], effectRef: 'eff_pil_kong18_sweep', source: 'pil18' });
    }
    return b;
  },
  pil19: (lv, star) => {
    // 机制批③段二 巡能力接真：召唤物优先打后排（召唤覆写通道 summon_override·⑨"召唤物指挥"挂牌解除）；
    // 天赋「增产」：召唤上限 +1（summonCapBonus 词条）+ 召唤更快（≈skillHaste·召唤舰大招即召唤·§13 近似注）。
    const b: S7EffectBlock[] = [{ kind: 'summon_override', targetingTag: 'backline_first', source: 'pil19' }];
    if (lv >= 1) {
      b.push({ kind: 'affix', affix: 'summonCapBonus', value: nodeValue(lv, [[1, 1], [40, 2]])!, source: 'pil19' });
      b.push({ kind: 'affix', affix: 'skillHaste', value: nodeValue(lv, [[1, 0.20], [60, 0.30]])!, source: 'pil19' });
      // 机制批③段二 L20/L80「召唤物攻+15/30%」/L100「血+40%」（召唤物属性继承通道）。
      const sa = nodeValue(lv, [[20, 0.15], [80, 0.30]]);
      if (sa !== undefined) b.push({ kind: 'affix', affix: 'summonAtkPct', value: sa, source: 'pil19' });
      if (lv >= 100) b.push({ kind: 'affix', affix: 'summonHpPct', value: 0.40, source: 'pil19' });
    }
    if (star >= 3) {
      // 机制批③段二 3★「召唤物攻击附小溅射」：无人机普攻换溅射弹变体行（首满额·邻格 50%）。
      b.push({ kind: 'summon_override', normalEffectRef: 'eff_s7_drone_splash', source: 'pil19' });
    }
    if (star >= 5) {
      // 5★ 有召唤物时本舰 CD 持续加速（⑨M6 has_summon 光环·哨卫联防同族条件）。
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: 'eff_pil_xun_s5_aura', source: 'pil19' });
    }
    return b;
  },
  pil20: (lv, star) => {
    // 藏：能力=啃最高防；天赋「破甲」无视防御%（armorPen·L40 对Boss=词条天然全体✓）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_armor_enemy', source: 'pil20' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.20], [20, 0.30], [60, 0.35], [80, 0.40]])!;
      b.push({ kind: 'affix', affix: 'armorPen', value: v, source: 'pil20' });
      if (lv >= 100) b.push({ kind: 'modifier', stat: 'attack', op: 'pct', value: 0.08, source: 'pil20' }); // L100 破甲附增伤 8%
    }
    if (star >= 3) {
      // 机制批③段二 3★「击中高防敌叠破防」：命中"当时最高防敌"35% 概率叠 armor_down（0.3·可叠2·5s）。
      b.push({ kind: 'affix', affix: 'shredOnHitChance', value: 0.35, source: 'pil20' });
    }
    if (star >= 5) {
      // 机制批③段二 5★「对最高防敌无视全部防御」（armorPenVsHighestArmor 1.0）+
      // 顺路升级「装甲碎裂」（Ron 拍定·5★ 额外补强不替换）：命中最高防敌 35% 概率碎甲→全队对其易伤 2s。
      b.push({ kind: 'affix', affix: 'armorPenVsHighestArmor', value: 1.0, source: 'pil20' });
      b.push({ kind: 'affix', affix: 'shatterChance', value: 0.35, source: 'pil20' });
    }
    return b;
  },
};

/**
 * 取驾驶员运行时效果积木。
 * @param pilotLevel 驾驶员等级（缺省 0=天赋未解锁·只有能力——总控回执⑤最保守缺省）。
 * @param pilotStar  星级 1-5（缺省 1=无质变）。
 */
export function pilotBlocks(pilotId: string, pilotLevel = 0, pilotStar = 1): readonly S7EffectBlock[] {
  const build = BUILDERS[pilotId];
  if (!build) return [];
  const lv = Math.max(0, Math.floor(pilotLevel));
  const star = Math.max(1, Math.min(5, Math.floor(pilotStar)));
  return build(lv, star);
}
