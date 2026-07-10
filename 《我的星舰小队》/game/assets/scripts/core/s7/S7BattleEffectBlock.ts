// 效果积木（v1.0 §4.6）：把"驾驶员 × 星舰 × 插件 × 星核"的海量组合拆成一套有限、可复用的积木。
// 装配层（S7BattleStatDerivation）只把一艘船四层产生的全部积木收集、按规则合并，不关心"是什么组合"。
// 纯数据 + 纯类型，不依赖 cc，可在 Node/Vitest 单测。
//
// 四类积木（与 v1.0 §4.6 一一对应）：
//   ① 修正类 modifier/affix —— 调数值（插件、驾驶天赋数值）
//   ② 触发类 trigger        —— 技能何时触发（块2 接入触发机制，块1 仅定义+收集）
//   ③ 行为类 behavior       —— 选目标/打谁（驾驶能力，块5 填内容）
//   ④ 动作类 action         —— 伤害/范围爆炸/召唤/治疗/施加状态（引用 battle_effect_param）

/** 可被「修正类」积木调整的 6 个基础战斗属性（与 battle_unit_stat_param 对齐）。 */
export type S7StatKey =
  | 'maxHp'
  | 'attack'
  | 'armor'
  | 'attackIntervalSec'
  | 'attackRangeCells'
  | 'passiveEnergyPerSec';

/** 定向词条（插件提供的附加战斗参数；块1 先收集承载，引擎在后续块按需读取）。
 *  任务单⑥8a 受控并行加法（2026-07-07）新增 14 条——全部"缺省 0=引擎行为逐字节不变"：
 *  条件伤害族 dmgVsLowHp(影斩首·目标<残血阈值)/dmgVsHighHp(烬贪婪·目标>高血阈值)/dmgVsFortified(破障·带盾或高防)
 *  公式族 armorPen(藏破甲·无视防御%)/lifesteal(嗜血·按实际扣血回吸)/dodgeRate(警戒雷达·受击方闪避)
 *  受方族 dmgTakenPct(护盾发生器·负值=减伤)/healTakenPct(治疗强化·受治疗加成)
 *  施方族 shieldPower(护盾强度·晨曦S/苏)/healVsLowHp(苏回光·对残血友军)/skillDmgPct(增幅线圈·仅技能/星核伤害)
 *        /effectAmp(增效·技能效果量通用)/durationPct(持久力场·施加状态时长)
 *  召唤族 summonCapBonus(巡增产·同源场上上限加值·配合 effect.summonSourceCap) */
export type S7AffixKey =
  | 'critRate'
  | 'critDmg'
  | 'shieldBreak'
  | 'skillHaste'
  | 'healPower'
  | 'controlResist'
  | 'dmgVsSwarm'
  | 'dmgVsBoss'
  | 'dmgVsLowHp'
  | 'dmgVsHighHp'
  | 'dmgVsFortified'
  | 'armorPen'
  | 'lifesteal'
  | 'dodgeRate'
  | 'dmgTakenPct'
  | 'healTakenPct'
  | 'shieldPower'
  | 'healVsLowHp'
  | 'skillDmgPct'
  | 'effectAmp'
  | 'durationPct'
  | 'summonCapBonus'
  // 机制批③ 星核词条（全部"缺省 0=引擎行为逐字节不变"）：
  //   skillHitCurHpPct=引力阱（技能命中追加 目标当前生命×系数）/ skillHitCapAtkMult=引力阱追伤上限（本舰攻×系数）
  //   dmgSplitFattestPct=共鸣音叉（本舰直接伤害的一部分同时打向全场最高血敌）
  //   luckyOnCast=幸运扭蛋（>0 时每次放技能随机一种强化·路由在引擎）
  | 'skillHitCurHpPct'
  | 'skillHitCapAtkMult'
  | 'dmgSplitFattestPct'
  | 'luckyOnCast'
  // 机制批③段二 · 条件/专项词条族（缺省 0=逐字节不变；消费点=dealDamage/addShield/heal/castLogged 各注明）：
  | 'normalAtkDmgPct' // 烈阳「重火力」：普攻专项伤害%（普攻行才吃）
  | 'skillCritRate' // 过载插件：技能暴击率专项（isSkill 才并入暴击率）
  | 'skillCritDmgPct' // 过载传奇：技能暴伤专项
  | 'critRateVsLowHp' // 影 L100：对残血目标暴击率+
  | 'critRateVsHighHp' // 烬 L100：对高血目标暴击率+
  | 'critRateVsFortified' // 破障传奇：对带盾/高防目标暴击率+
  | 'critDmgVsBoss' // 屠巨传奇：对 Boss 暴伤+
  | 'dmgVsBurning' // 贯日 A：对燃烧中的敌人增伤
  | 'dmgVsSummonSource' // 空 L40：对召唤源增伤（roleTag=summon_source）
  | 'armorPenVsSummonSource' // 空 L100：对召唤源穿防
  | 'dmgVsKeyUnit' // 蛰 5★：对治疗/召唤源处决伤（KEY_ROLE_TAGS）
  | 'dmgVsFullHp' // 烬 3★：对满血目标额外增伤
  | 'shaveCurHpPct' // 烬 3★：命中满血目标削其当前生命%（直伤子结算）
  | 'halfBreakAtkPct' // 烬 5★ 顺路升级「破半」：目标被本舰打入半血以下的那一击追加 攻×系数（演出=爆点无飘字）
  | 'shatterChance' // 藏 5★ 顺路升级「装甲碎裂」：命中最高防敌概率碎甲（全队易伤=vulnerable）
  | 'lowHpThresholdPct' // 影 L20/L80：本舰"残血"判定阈值覆盖（dmgVsLowHp/处决判定用·0=用全局 C6）
  | 'highHpThresholdPct' // 烬 L40：本舰"高血"判定阈值覆盖（0=用全局 C7）
  | 'executeLowHpPct' // 影 5★：对 <阈值 非 Boss 直接处决（即死）
  | 'executeBossMaxHpPct' // 影 5★ Boss 侧：目标首次跌破阈值后下一击追加最大生命×系数（每场每 Boss 一次）
  | 'saveAllyLethalOnce' // 苏 5★：友军将被致死时本舰替其挡下该击（每场 1 次·伤害转本舰）
  | 'lethalGuardOnce' // 保命插件：致死伤害免疫一次留 1 血（每场 1 次）
  | 'lethalGuardImmuneSec' // 保命传奇：触发后短暂无敌秒数
  | 'critAfterDodge' // 警戒传奇：闪避后下一击必暴击（一次性闩锁）
  | 'overhealToShieldPct' // 苏 L100/医修传奇：溢出治疗×系数转护盾
  | 'healFullShieldMaxHpPct' // 苏 3★：治到满血的友军获护盾（其最大生命×系数）
  | 'shieldVsLowHp' // 苏 L40/L80：对残血友军护盾量+
  | 'buffAmpPct' // 澈「增幅」：本舰施加的增益态幅度×(1+系数)（状态幅度增效消费点·effectAmp 语义修正落点）
  | 'buffRiderCritRate' // 澈 L100：本舰施加增益时附带暴击率小增益
  | 'buffTransferOnDeath' // 澈 5★：被本舰增益的友军阵亡时其增益转移给最高攻存活友军
  | 'coverageAmpPerAlly' // 沛「润泽」：本舰增益/护盾按"被本舰覆盖友军数"每人+系数放大
  | 'durationPctFullCoverage' // 沛 5★：覆盖全队时本舰辅助持续额外+（叠在 durationPct 上）
  | 'debuffedTakenAmpTeam' // 蔽「笼罩」：被控/带减益敌受全队伤害+（团队易伤·本舰在场生效）
  | 'debuffedTakenIncludeBoss' // 蔽 L40：笼罩对 Boss 也生效（0=Boss 免疫笼罩）
  | 'debuffedTakenPerDebuff' // 蔽 3★：目标每种减益再叠系数
  | 'teamCritVsDebuffed' // 蔽 5★：全队对被控/减益敌暴击率+
  | 'healDispelCount' // 霖「涤荡」：本舰治疗附驱散 N 个（驾驶员层注入=词条通道·效果行 dispelCount 之外相加）
  | 'healDispelHardControl' // 霖 L40：本舰治疗驱散可清硬控（>0=开）
  | 'healOnDispelAtkPct' // 霖 L80/5★：驱散成功附回血 攻×系数
  | 'afterDispelImmuneSec' // 霖 3★：被本舰净化的友军短时免疫新减益秒数
  | 'reflectAllRecentPct' // 岳 5★：受击时把伤害×系数均分反射给窗口内全部攻击者
  | 'tauntReflectPct' // 砺 5★：受击按已损血比例把伤害一部分反弹给自己嘲讽中的目标（封顶=本系数）
  | 'guardExtraCharges' // 岩 5★：守护每个冷却窗可替挡次数+N（基础 1 → 5★=2）
  | 'guardSelfDmgDownPct' // 岩 3★：守护触发时自身获短暂减伤（幅度）
  | 'shareForControlledPct' // 沧 3★：友军被硬控时本舰为其分摊伤害%
  | 'focusMaxGuaranteedCrit' // 源 5★：专注满层时本舰技能对锁定目标必定暴击（>0=开）
  | 'extraNormalHitWhileAtkSpeedUp' // 翎 3★：夺势（加攻速态）期间普攻附带额外一击
  | 'normalSplashPct' // 散射插件/烈阳 L100：普攻附带相邻溅射（伤害比例）
  | 'normalSplashTargets' // 散射档位：溅射波及的相邻目标数（1=相邻1格·传奇 4=十字）
  | 'chargedNormalPct' // 充能插件：普攻改"隔拍蓄力"——蓄力拍不出手、下一发 ×(1+系数)
  | 'chargedNormalSplashPct' // 充能传奇：满蓄那发附带十字溅射（比例）
  | 'skillRepeatChance' // 连发插件：技能概率连放两次（castLogged 掷·传奇"第二次不耗蓄力"=天然满足记语义注）
  | 'skillDetonateAtkPct' // 引爆插件：技能命中附带目标相邻额外伤 攻×系数（直伤子结算）
  | 'skillDetonateCross' // 引爆传奇：额外伤波及十字 4 格（>0=开·缺省相邻 1 格）
  | 'skillCdPerTargetSec' // 循环插件：技能每命中 1 目标缩 CD 秒数
  | 'skillCdFullBonusSec' // 循环传奇：命中满目标数时额外缩 CD 秒数
  | 'aftershockAtkPct' // 余震插件：技能命中的敌人 1.5s 后受延迟追加伤 攻×系数
  | 'lowHpDmgTakenDown' // 舰体传奇：自身 <30% 时减伤+
  | 'summonAtkPct' // 巡 L20/L80：本舰召唤物攻击+%（召唤物属性继承通道）
  | 'summonHpPct' // 巡 L100：本舰召唤物血量+%
  | 'summonSyncFire' // 蜂巢「同步开火」：本舰放技能时在场召唤物齐射一次（≥2=S 阶·连本舰普攻也触发）
  | 'armorPerHpDecilePct' // 堡垒「厚装」：每 10% 当前血 → 防御 ×(1+系数)（动态属性联动）
  | 'lowHpArmorFlat' // 堡垒 S「低血保底防御」：自身 <30% 时防御 +固定值
  | 'dmgToTeamShieldPct' // 山岳「磁暴盾」：自身受到伤害×系数转化为护盾均分全队（伤害转化族）
  | 'shieldCapMaxHpMult' // 山岳 A 前置：本单位护盾上限=最大生命×系数（>0 才启用·配溢出转化）
  | 'overflowShieldToHealPct' // 山岳 A「溢盾转奶」：超出护盾上限的部分×系数转全队回血
  | 'normalAreaMinEnemies' // 群蜂「弹巢」：场上敌数 ≥ 此值时普攻升 3×3（条件 targeting 缩放）
  | 'normalAreaAlways' // 群蜂 L100：普攻恒为 3×3（>0=开）
  | 'armorDownOnShieldBreak' // 破甲传奇：本舰打破敌护盾时给其上破防（armor_down 0.2·3s）
  | 'firstControlImmune' // 韧性传奇：每场免疫第一次硬控（一次性闩锁）
  | 'critSplashPct' // 火力传奇：暴击时该次伤害×系数溅射到最近相邻 1 格
  | 'critFollowupAtkPct' // 瞄准传奇：暴击时额外补一下（攻×系数·直伤子结算）
  | 'critHasteAmount' // 爆裂传奇：暴击时自身攻速+系数·3s
  | 'critLifestealDouble' // 嗜血传奇：暴击时本次吸血翻倍（>0=开）
  | 'firstSkillCdHalf' // 冷却传奇：开局首个技能 CD 减半（只作用于带首发延迟的触发·开局即放型天然满足=语义注）
  | 'skillAreaUp' // 增幅传奇：技能作用范围常驻升一档（同扭蛋 area_up 消费点）
  | 'buffRiderCritDmg' // 澈3★：本舰施加增益时附带主C暴伤小增益
  | 'shredOnHitChance' // 藏3★：命中最高防敌概率叠破防（armor_down 可叠2）
  | 'armorPenVsHighestArmor' // 藏5★：对'当时敌方最高防目标'追加穿透（1.0=无视全部防御）
  | 'skillRepeatCount' // 极焰SS「连放三次」/群蜂SS「连放两轮」：技能固定额外重放次数（词条通道=与行级 repeatCount 相加）
  | 'fortressChargePct'; // 堡垒A「被打积能」：要塞期间每受击一次·结束反击 ×(1+系数×次数·封顶10次)

/** 动作落在哪个槽（普攻 / 大招 / 星核）。星核质变可覆盖 normal 槽（如过载核心把普攻换原子炮）。 */
export type S7ActionSlot = 'normal' | 'ultimate' | 'core';

/** ① 修正类：对某个基础属性做 加法/百分比 修正。 */
export interface S7ModifierBlock {
  kind: 'modifier';
  stat: S7StatKey;
  /** flat=直接加减；pct=百分比（0.15=+15%，可叠加）；set=覆盖为绝对值（质变用，如过载核心把普攻间隔设为 10s）。 */
  op: 'flat' | 'pct' | 'set';
  value: number;
  /** 来源标识（pluginId/pilotId/coreId），仅调试/溯源用，不影响计算。 */
  source?: string;
}

/** ① 修正类（定向词条变体）：落在 affix（累加），不动基础属性。 */
export interface S7AffixBlock {
  kind: 'affix';
  affix: S7AffixKey;
  value: number;
  source?: string;
}

/** ② 触发类：技能/效果何时触发。块1 仅定义并收集，触发机制由块2 实现。
 *  ⑥8a 新增（缺省不用=行为不变）：on='shield_broken'（本单位护盾被打破·超级护罩/晨曦A）、
 *  on='attack_landed'（本单位普攻命中·回充插件〔原蓄能仓〕）；initialCdSec（cd 型首发延迟·超新星"先攒后爆"）；
 *  once（true=事件型触发每场只发一次·缺省事件型可重复）。
 *  ⑦机制批① 新增：on='skill_cast'（本单位放出一次 ultimate 类效果·战鼓；core 类不算——真源"放技能"口径）。 */
export interface S7TriggerBlock {
  kind: 'trigger';
  /** 机制批③：'on_kill_charge'=蓄力攒层（击杀攒 threshold 层满放·引擎按单位行 ultimateChargeKills 内部合成，配置不直接写）；
   *  'ally_lowhp'=有友军跌入残血（<threshold·沧Lv1「驰援」·配 once 用）。 */
  on: 'battle_start' | 'cd' | 'on_kill' | 'hp_below' | 'on_hit' | 'ally_down' | 'passive'
    | 'shield_broken' | 'attack_landed' | 'skill_cast' | 'on_kill_charge' | 'ally_lowhp';
  /** on='cd' 时的冷却秒数。 */
  cdSec?: number;
  /** on='cd' 时的首发延迟秒数；缺省 0=开局即放（既有语义）。 */
  initialCdSec?: number;
  /** on='hp_below' 血量阈值（0~1）；on='ally_down' 为"己方已阵亡数"阈值（达到即触发一次）。 */
  threshold?: number;
  /** true=可重复的事件型触发（on_kill/on_hit/shield_broken/attack_landed）改为每场一次。 */
  once?: boolean;
  /** ⑦机制批① 可选（on='on_kill' 专用）：击杀对象 roleTag 过滤——本 tick 击杀名单与集合有交集才触发
   *  （蛰「斩链」杀治疗/召唤源、空「净场」杀召唤物；缺省=任意击杀都触发·旧行为不变）。 */
  onKillRoleTags?: string[];
  /** 机制批③ 可选（on='on_kill' 专用）：本 tick 击杀数 ≥ 此值才触发（燎5★"一次出手 2+ 杀刷新 CD"）；缺省=1。 */
  minKills?: number;
  /** 机制批③ 可选（on='on_kill' 专用）：只在本 tick 击杀过"当时敌方存活最高攻目标"时触发（翎5★"杀高攻效果翻倍"变体行）。 */
  onKillHighestAttack?: boolean;
  /** 触发后释放的动作，指向 battle_effect_param.rowId。 */
  effectRef: string;
  source?: string;
}

/** ③ 行为类：覆盖/指定目标选择。复用引擎 targetingTag 取值。驾驶能力内容由块5 填。 */
export interface S7BehaviorBlock {
  kind: 'behavior';
  targetingTag: string;
  source?: string;
}

/** ⑦机制批① M3 · 单位级叠层规则（事件驱动层数 × 每层数值 + 断条件·全配置驱动）。
 *  载体：炎「过热」(attack_landed+attack_gap断) / 源「专注」(per_second+dmgVsLockedPct+target_switch断) /
 *  铁壁「坚甲」(was_hit_by_skill=真源"重击"口径) / 砺「愈坚」(hp_lost_decile=派生层数·每损10%血1层) /
 *  贪吃星(kill·不封顶) / 燎3★(kill+atkSpeedPct) / 污染体狂暴(was_hit) / Boss随时间狂暴(per_second)。 */
export interface S7StackRuleParam {
  /** 规则标识（日志/溯源用）。 */
  ruleId: string;
  /** 层数累积事件：普攻命中/被任意伤害命中/被技能伤害命中/击杀/每秒/血量流失（每损10%=1层·派生不累积）。 */
  on: 'attack_landed' | 'was_hit' | 'was_hit_by_skill' | 'kill' | 'per_second' | 'hp_lost_decile';
  /** 每层数值挂到哪个轴；dmgVsLockedPct=仅对本单位当前锁定目标生效（源「专注」·配 lock_until_dead）。 */
  stat: 'atkPct' | 'atkSpeedPct' | 'dmgUpPct' | 'dmgTakenDownPct' | 'dmgVsLockedPct';
  /** 每层幅度（正数）。 */
  perStack: number;
  /** 层数上限；缺省=不封顶（贪吃星"本场累积不清空"）。 */
  maxStacks?: number;
  /** 断条件：attack_gap=距最近一次累积事件超过 breakGapSec（炎"断击"口径）/ target_switch=锁定目标变更（源）。缺省=不断。 */
  breakOn?: 'attack_gap' | 'target_switch';
  /** breakOn='attack_gap' 必填：判定断档的间隔秒数。 */
  breakGapSec?: number;
  /** 断档动作：clear=层数清零（缺省）/ decay_1=只降 1 层（炎 Lv100 口径·每满一个 gap 降一次）。 */
  breakAction?: 'clear' | 'decay_1';
  /** 机制批③ 可选（砺3★「愈坚翻倍」）：自身血量 < 此比例时本规则每层幅度 ×2；缺省=不翻倍。 */
  doubleBelowHpPct?: number;
  /** 机制批③ 可选（叠满触发钩·炎3★致命一击/铁壁S坚甲叠满回血）：层数攒到 maxStacks 的瞬间释放此效果行。 */
  onFullEffectRef?: string;
  /** 机制批③ 可选（配 onFullEffectRef）：target=以"触发叠层那次命中的目标"为锚（炎3★/5★十字）/ self=对自己放（铁壁S 回血）；缺省 self。 */
  onFullScope?: 'target' | 'self';
  /** 机制批③ 可选（配 onFullEffectRef）：触发后层数清零重攒（炎3★"清零"口径）；缺省 true。 */
  onFullReset?: boolean;
  /** 机制批③ 可选（配 onFullEffectRef·护盾传奇"每场 3 次"）：叠满触发的每场次数上限；缺省=不限。 */
  onFullMaxFires?: number;
  source?: string;
}

/** 机制批③ ①'' 召唤覆写类：改写本舰召唤物的行为/普攻（巡「召唤物优先打后排」/哨卫L60 嘲讽诱饵/巡3★ 溅射无人机）。 */
export interface S7SummonOverrideBlock {
  kind: 'summon_override';
  /** 本舰召唤物的目标选择覆写（如 backline_first）。 */
  targetingTag?: string;
  /** 本舰召唤物的普攻效果行覆写（变体行·如溅射无人机弹）。 */
  normalEffectRef?: string;
  source?: string;
}

/** ①' 叠层类：把一条叠层规则挂到本单位（装配层收集·引擎消费）。 */
export interface S7StackBlock {
  kind: 'stack';
  rule: S7StackRuleParam;
  source?: string;
}

/** ④ 动作类：直接引用 battle_effect_param 的动作，按 slot 落到普攻/大招/星核槽。 */
export interface S7ActionBlock {
  kind: 'action';
  slot: S7ActionSlot;
  effectRef: string;
  source?: string;
}

export type S7EffectBlock =
  | S7ModifierBlock
  | S7AffixBlock
  | S7TriggerBlock
  | S7BehaviorBlock
  | S7ActionBlock
  | S7StackBlock
  | S7SummonOverrideBlock;
