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
  pil01: (lv) => {
    // 炎：能力=集火血量最少；天赋「过热」连击叠伤（M3 attack_landed·断击清空·L100 只降1层）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lowest_hp_enemy', source: 'pil01' }];
    if (lv >= 1) {
      const per = nodeValue(lv, [[1, 0.02], [20, 0.03], [40, 0.04]])!;
      const cap = nodeValue(lv, [[1, 3], [60, 4], [80, 5]])!;
      b.push(stack({
        ruleId: 'pil01_overheat', on: 'attack_landed', stat: 'dmgUpPct', perStack: per, maxStacks: cap,
        breakOn: 'attack_gap', breakGapSec: 2.5, breakAction: lv >= 100 ? 'decay_1' : 'clear',
      }, 'pil01'));
    }
    // 3★ 叠满致命一击 / 5★ 范围化：需"叠满触发"钩子（⑦记档未做）——挂牌机制批③。
    return b;
  },
  pil02: (lv) => {
    // 影：能力=打最后排；天赋「斩首」对 <30% 残血增伤（dmgVsLowHp 词条·阈值 C6 固定）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'backline_first', source: 'pil02' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.40], [40, 0.50], [60, 0.60]])!;
      b.push({ kind: 'affix', affix: 'dmgVsLowHp', value: v, source: 'pil02' });
    }
    // L20/L80 阈值 35%/40%（阈值未参数化·8a 记档）、L100 残血暴击、3★ 再判、5★ 处决：挂牌。
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
    // 5★ 双杀刷新整个 CD（一次出手≥2杀判定·M7 计数族）：挂牌。
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
    // 5★ 对治疗/召唤源本体处决伤（按职业条件增伤词条无载体）：挂牌。
    return b;
  },
  // ===== 护卫组（pil05-08）=====
  pil05: (lv) => {
    // 岩：能力=光盾守护（M4 guard·起手即生效·CD 2s→L20 1.8→L100 1.5）；天赋「反震」格挡+反弹（M4 reflect）。
    const guardEff = nodeValue(lv, [[0, 'eff_pil_yan_guard'], [20, 'eff_pil_yan_guard_l20'], [100, 'eff_pil_yan_guard_l100']])!;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'battle_start', effectRef: guardEff, source: 'pil05' }];
    if (lv >= 1) {
      const reflectEff = nodeValue(lv, [[1, 'eff_pil_yan_reflect'], [40, 'eff_pil_yan_reflect_l40'], [60, 'eff_pil_yan_reflect_l60'], [80, 'eff_pil_yan_reflect_l80']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: reflectEff, source: 'pil05' });
    }
    // 3★ 守护触发附自身减伤（守护触发钩子无）、5★ 守护双目标（guard 单目标参数）：挂牌。
    return b;
  },
  pil06: (lv) => {
    // 砺：能力=持续嘲讽最高攻敌（⑨M4 定式：cd 触发反复 apply_state(taunt, highest_attack_enemy)·起手即生效）。
    const tauntEff = nodeValue(lv, [[0, 'eff_pil_li_taunt'], [20, 'eff_pil_li_taunt_l20'], [80, 'eff_pil_li_taunt_l80']])!;
    const b: S7EffectBlock[] = [{ kind: 'trigger', on: 'cd', cdSec: 3, effectRef: tauntEff, source: 'pil06' }];
    if (lv >= 1) {
      // 天赋「愈坚」：每损 10% 血 +3%/4%/5% 减伤（M3 hp_lost_decile 派生层数）。上限档=派生自然顶（≤10 档）；
      // L100"上限+2档"语义与派生顶重合·记 §13 语义注（无独立参数可加）。
      const per = nodeValue(lv, [[1, 0.03], [40, 0.04], [60, 0.05]])!;
      b.push(stack({ ruleId: 'pil06_resolve', on: 'hp_lost_decile', stat: 'dmgTakenDownPct', perStack: per }, 'pil06'));
    }
    // 3★ <50% 血愈坚翻倍（条件倍率钩子无）、5★ 按血差反弹给嘲讽目标（动态反弹）：挂牌。
    return b;
  },
  pil07: (lv, star) => {
    // 岳：能力"打正在攻击我后排的敌人"=M9 事件知识目标（⑨如实交回）——挂牌，行为回落舰行默认 tag。
    const b: S7EffectBlock[] = [];
    if (lv >= 1) {
      // 天赋「荆甲」：反弹固定伤=自身防×比例（M4 reflectArmorPct 施加瞬间快照）；3★ 改按攻击者攻×12%。
      const eff = star >= 3
        ? 'eff_pil_yue_thorns_s3'
        : nodeValue(lv, [[1, 'eff_pil_yue_thorns'], [20, 'eff_pil_yue_thorns_l20'], [60, 'eff_pil_yue_thorns_l60'], [80, 'eff_pil_yue_thorns_l80'], [100, 'eff_pil_yue_thorns_l100']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: eff, source: 'pil07' });
    }
    // L40 多敌叠加（反弹逐攻击者累积）、5★ 反射全部攻击者：挂牌。
    return b;
  },
  pil08: (lv) => {
    // 沧：能力=优先保护被集火/被控友军（8a controlled_ally_first·友方向——方向匹配门下在支援舰类生效）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'controlled_ally_first', source: 'pil08' }];
    if (lv >= 1) {
      // 天赋「坚壁」：每名残血友军 +4/5/6/8% 减伤（M6 aura·per_lowhp_ally·self）。
      const eff = nodeValue(lv, [[1, 'eff_pil_cang_aura'], [20, 'eff_pil_cang_aura_l20'], [60, 'eff_pil_cang_aura_l60'], [80, 'eff_pil_cang_aura_l80']])!;
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: eff, source: 'pil08' });
      if (lv >= 40) b.push({ kind: 'affix', affix: 'shieldPower', value: 0.15, source: 'pil08' }); // L40 也提升护盾效果
    }
    // 3★ 友军被硬控时分摊 30%（条件 share）、5★ 减伤一半共享全队（动态光环）：挂牌。
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
    // 5★ 专注满层技能对锁定必暴（条件暴击闩锁）：挂牌。
    return b;
  },
  pil10: (lv) => {
    // 烬：能力=打最肥；天赋「贪婪」对 >50% 血增伤（dmgVsHighHp·阈值 C7 固定）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_hp_enemy', source: 'pil10' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.25], [20, 0.35], [60, 0.45], [80, 0.55]])!;
      b.push({ kind: 'affix', affix: 'dmgVsHighHp', value: v, source: 'pil10' });
    }
    // L40 阈值→40%（阈值未参数化）、L100 高血暴击、3★ 满血额外+削血、5★ 对Boss满额（base 无 Boss 折减句·语义钉 §13）：挂牌。
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
    // 5★ 先锋期击杀延长持续（时长延长钩子无）：挂牌。
    return b;
  },
  pil12: (lv) => {
    // 翎：能力=掐最高攻；天赋「夺势」击杀后攻速窗口（M1 on_kill + atk_speed_up·L100 附暴击率）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_attack_enemy', source: 'pil12' }];
    if (lv >= 1) {
      const eff = nodeValue(lv, [[1, 'eff_pil_ling_asu'], [20, 'eff_pil_ling_asu_l20'], [40, 'eff_pil_ling_asu_l40'], [60, 'eff_pil_ling_asu_l60'], [80, 'eff_pil_ling_asu_l80'], [100, 'eff_pil_ling_asu_l100']])!;
      b.push({ kind: 'trigger', on: 'on_kill', effectRef: eff, source: 'pil12' });
    }
    // 3★ 夺势期普攻+1击（条件连击）、5★ 杀高攻目标效果翻倍：挂牌。
    return b;
  },
  // ===== 支援组（pil13-16）=====
  pil13: (lv) => {
    // 苏：能力=救最残（lowest_hp_ally·友方向）；天赋「回光」残血治疗增效（healVsLowHp）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'lowest_hp_ally', source: 'pil13' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.30], [20, 0.45], [60, 0.60]])!;
      b.push({ kind: 'affix', affix: 'healVsLowHp', value: v, source: 'pil13' });
    }
    // L40/L80 对残血的护盾量+（条件盾词条无载体）、L100 溢疗转盾（M9 医修族）、3★ 治满血给盾、5★ 替挡致命（⑨护栏①拍）：挂牌。
    return b;
  },
  pil14: (lv) => {
    // 澈：能力=增益喂输出最高友军（highest_attack_ally·友方向）；
    // 天赋「增幅」被增益友军效果+%（需"状态幅度增效"消费点·effectAmp 只放大伤/盾/疗=接了语义错）——幅度挂牌；
    // L40"持续更久"=durationPct 词条（本舰施加状态时长+25%）✓ 可接。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_attack_ally', source: 'pil14' }];
    if (lv >= 40) b.push({ kind: 'affix', affix: 'durationPct', value: 0.25, source: 'pil14' });
    return b;
  },
  pil15: () => {
    // 沛：能力=铺没增益/盾的友军（no_buff_ally_first·友方向）✓；
    // 天赋「润泽」覆盖越多每份越强=跨单位条件族（⑨M6 记未建）——全数值挂牌（含 L40 全队小回血等大节点）。
    return [{ kind: 'behavior', targetingTag: 'no_buff_ally_first', source: 'pil15' } as S7EffectBlock];
  },
  pil16: () => {
    // 霖：能力=救减益最多的友军（most_debuffed_ally·友方向）✓；
    // 天赋「涤荡」治疗附驱散=M5 dispelCount 是效果行字段、驾驶员层跨层注入无通道（变体行方案待评估）——
    // 天赋全线挂牌（含 L40 可驱硬控/L80 净化回血/3★ 免疫/5★ 清空）。
    return [{ kind: 'behavior', targetingTag: 'most_debuffed_ally', source: 'pil16' } as S7EffectBlock];
  },
  // ===== 工程组（pil17-20）=====
  pil17: () => {
    // 蔽：能力=集火已被控/带减益的敌人（debuffed_first）✓；
    // 天赋「笼罩」被控/减益敌受全队伤+%=跨单位条件族（⑨M6 记未建）——全数值挂牌。
    return [{ kind: 'behavior', targetingTag: 'debuffed_first', source: 'pil17' } as S7EffectBlock];
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
    // L40 对召唤源+25%（按职业条件增伤无载体）、L100 对召唤源穿防、3★ 清场伤：挂牌。
    return b;
  },
  pil19: (lv, star) => {
    // 巡：能力=召唤物优先打后排（召唤物指挥=M9 交回）——挂牌；
    // 天赋「增产」：召唤上限 +1（summonCapBonus 词条）+ 召唤更快（≈skillHaste·召唤舰大招即召唤·§13 近似注）。
    const b: S7EffectBlock[] = [];
    if (lv >= 1) {
      b.push({ kind: 'affix', affix: 'summonCapBonus', value: nodeValue(lv, [[1, 1], [40, 2]])!, source: 'pil19' });
      b.push({ kind: 'affix', affix: 'skillHaste', value: nodeValue(lv, [[1, 0.20], [60, 0.30]])!, source: 'pil19' });
    }
    if (star >= 5) {
      // 5★ 有召唤物时本舰 CD 持续加速（⑨M6 has_summon 光环·哨卫联防同族条件）。
      b.push({ kind: 'trigger', on: 'battle_start', effectRef: 'eff_pil_xun_s5_aura', source: 'pil19' });
    }
    // L20/L80 召唤物攻+、L100 召唤物血+（召唤物属性继承=⑨交回）、3★ 召唤物溅射：挂牌。
    return b;
  },
  pil20: (lv) => {
    // 藏：能力=啃最高防；天赋「破甲」无视防御%（armorPen·L40 对Boss=词条天然全体✓）。
    const b: S7EffectBlock[] = [{ kind: 'behavior', targetingTag: 'highest_armor_enemy', source: 'pil20' }];
    if (lv >= 1) {
      const v = nodeValue(lv, [[1, 0.20], [20, 0.30], [60, 0.35], [80, 0.40]])!;
      b.push({ kind: 'affix', affix: 'armorPen', value: v, source: 'pil20' });
      if (lv >= 100) b.push({ kind: 'modifier', stat: 'attack', op: 'pct', value: 0.08, source: 'pil20' }); // L100 破甲附增伤 8%
    }
    // 3★ 击中高防叠破防（条件施态）、5★ 对最高防无视 100%（条件穿防）：挂牌。
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
