// 升级大节点表（段二 A4·Ron 2026-07-11 晚拍板：大节点 每 20 级→每 10 级，5 个全落 L10-50；纯 TS 不依赖 cc）。
//
// 结构（与 A3 等级上限 100→50 配套）：
//   L10 签名开火（新·演出型）｜L20 技能门（旧 L20 内容原位）｜L30 舰载趣闻（新·内容型）｜
//   L40 技能门（旧 L40 内容原位）｜L50 王牌徽记（新·身份型）。
//   旧 L60/80/100 大节点内容随 51-100 段封存未来版本（S7ShipEffects/S7PilotEffects 数据保留·上限钳死即不可达）。
//
// 三个新节点的设计约束（A4 双铁律·强度总预算守恒）：
//   全部零战斗强度——毕业态（D47 实测态转正=终点锚）在旧世界只吃 L20/L40 两个强度门，新节点不加
//   数字即锚定不动（LF 刻度表 L10/30/50 不加价=守恒的机器体现，守卫在 s7_power_rating_sync）；
//   惊喜靠机制/演出/身份型内容（样板=商人小站），体感验收挂美术/灰盒批实装后做。
//
// 本模块=大节点"账本与查询"的唯一真源（哪级有节点、节点是什么类型、解锁了没）：
//   - 战斗强度载体不在这里：L20/L40 技能门的战斗效果仍由 S7ShipEffects/S7PilotEffects 按级门取档；
//   - 三个新节点的表现载体也不在这里：签名开火=美术批特效层；趣闻文案=内容批；徽记 UI=灰盒批。
//     本模块只提供"解锁判定+节点语义"，供 UI/演出/文案层查询（接口清单=段2a 交付附件）。

/** 大节点类型：skill_gate=技能强化门（战斗强度·旧内容）；其余三种=零强度新节点。 */
export type S7GrowthNodeKind = 'signature_fire' | 'skill_gate' | 'unit_story' | 'ace_crest';

export interface S7GrowthNodeDef {
  /** 节点等级（L10/20/30/40/50）。 */
  level: number;
  kind: S7GrowthNodeKind;
  /** 玩家可见名（UI 灰盒批直接用；文案可再润色）。 */
  name: string;
  /** 是否携带战斗强度（=LF 刻度表是否给该级加价；守恒审计用）。 */
  combatPower: boolean;
  /** 一句设计语义（给 UI tooltip/灰盒批/文档同步用）。 */
  note: string;
}

/** 五节点账本（舰/员两线同表——驾驶员 L20/L40 技能门=天赋大节点，载体在 S7PilotEffects 同构）。 */
export const S7_GROWTH_NODES: readonly S7GrowthNodeDef[] = [
  {
    level: 10, kind: 'signature_fire', name: '签名开火', combatPower: false,
    note: '解锁本单位签名版开火视觉（开火签名发光色/弹道升档·响度阶梯内走特效层）——第一个大节点来得快，主力 D1-D2 即可吃到"我的船开火变帅了"。',
  },
  {
    level: 20, kind: 'skill_gate', name: '技能强化 I', combatPower: true,
    note: '旧 L20 技能门原位（逐单位内容=S7ShipEffects/S7PilotEffects 级门档·实测强度 ×1.100 已入 LF 刻度）。',
  },
  {
    level: 30, kind: 'unit_story', name: '舰载趣闻', combatPower: false,
    note: '解锁本单位专属星港趣事条目＋装配页个性台词（趣事池 speaker 扩展·文案=内容批）——单位"活了"的情感节点。',
  },
  {
    level: 40, kind: 'skill_gate', name: '技能强化 II', combatPower: true,
    note: '旧 L40 技能门原位（同上·实测强度 ×1.166 已入 LF 刻度）。',
  },
  {
    level: 50, kind: 'ace_crest', name: '王牌徽记', combatPower: false,
    note: '满级身份演出：装配页金框＋战场血条旁星徽＋王牌战绩墙联动（训练舱 Lv7 件）——毕业仪式感与对外展示。',
  },
];

/** 节点等级序（升序）。 */
export const S7_GROWTH_NODE_LEVELS: readonly number[] = S7_GROWTH_NODES.map((n) => n.level);

/** 某等级已解锁的大节点（level ≥ 节点级·升序）。 */
export function growthNodesUnlocked(level: number): S7GrowthNodeDef[] {
  const lv = Math.floor(Number.isFinite(level) ? level : 0);
  return S7_GROWTH_NODES.filter((n) => lv >= n.level);
}

/** 下一个未解锁的大节点；满 50 后返回 null（UI"下个大节点"提示用）。 */
export function nextGrowthNode(level: number): S7GrowthNodeDef | null {
  const lv = Math.floor(Number.isFinite(level) ? level : 0);
  return S7_GROWTH_NODES.find((n) => lv < n.level) ?? null;
}

/** 某等级是否恰好是大节点级（升级到该级时触发"大节点达成"演出/提示）。 */
export function isGrowthNodeLevel(level: number): boolean {
  return S7_GROWTH_NODES.some((n) => n.level === level);
}
