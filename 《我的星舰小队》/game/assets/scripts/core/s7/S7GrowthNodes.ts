// 升级大节点表（段二 A4＋R1 返工·Ron 2026-07-12 裁定：**五档平移**——纯 TS 不依赖 cc）。
//
// R1 结构（取代 07-12 早前"两旧门+三新惊喜件"方案·该方案属结构理解偏差已纠正）：
//   旧世界大节点 20/40/60/80/100 → 新世界 10/20/30/40/50 **整体平移·内容零改动**——
//   舰/员逐单位档位内容全部随门位平移（载体=S7ShipEffects/S7PilotEffects·R1 平移已落）；
//   刻度定价门＝L10 ×1.100 / L20 ×1.166（系数原值随内容走）；L30/40/50＝空门
//   （旧 L60/80/100 实测≈0 收益不加价·忠实对应旧设计定价——内容在、定价空）。
//   毕业锚守恒：L40-50 两门乘积与旧表相同（L50 纸面 3.2935 分毫不动）。
//
// 本模块=大节点"账本与查询"的唯一真源（哪级有节点、类型、解锁了没）；战斗强度载体不在这里。

/** 大节点类型：R1 后五档全部=skill_gate（逐单位强化内容·载体在舰/员效果表）。 */
export type S7GrowthNodeKind = 'skill_gate';

export interface S7GrowthNodeDef {
  /** 节点等级（L10/20/30/40/50）。 */
  level: number;
  kind: S7GrowthNodeKind;
  /** 玩家可见名（UI 灰盒批直接用；文案可再润色）。 */
  name: string;
  /** 是否携带刻度强度（=LF 表是否给该级加价；守恒审计用——L30/40/50 内容在但定价空）。 */
  combatPower: boolean;
  /** 一句设计语义（给 UI tooltip/灰盒批/文档同步用）。 */
  note: string;
}

/** 五节点账本（舰/员两线同表·内容=旧 20/40/60/80/100 档平移）。 */
export const S7_GROWTH_NODES: readonly S7GrowthNodeDef[] = [
  {
    level: 10, kind: 'skill_gate', name: '强化 I', combatPower: true,
    note: '旧 L20 档平移（逐单位技能/天赋强化·实测强度 ×1.100 入 LF 刻度）。',
  },
  {
    level: 20, kind: 'skill_gate', name: '强化 II', combatPower: true,
    note: '旧 L40 档平移（同上·实测强度 ×1.166 入 LF 刻度）。',
  },
  {
    level: 30, kind: 'skill_gate', name: '强化 III', combatPower: false,
    note: '旧 L60 档平移（逐单位档位内容在·团队强度实测≈0 → 刻度不加价=空门·忠实对应旧设计）。',
  },
  {
    level: 40, kind: 'skill_gate', name: '强化 IV', combatPower: false,
    note: '旧 L80 档平移（同上·空门）。',
  },
  {
    level: 50, kind: 'skill_gate', name: '强化 V', combatPower: false,
    note: '旧 L100 档平移（同上·空门·满级档）。',
  },
];

/** 节点等级序（升序）。 */
export const S7_GROWTH_NODE_LEVELS: readonly number[] = S7_GROWTH_NODES.map((n) => n.level);

/**
 * 【未挂载留档·候 Ron 将来处置（R1 裁定）】07-12 早前方案的三个惊喜件设计——不进大节点账本、
 * 不接任何运行时；设计内容保留于此备将来复用（如版本活动/成就/新系统），删除须 Ron 拍。
 */
export const S7_UNMOUNTED_DELIGHT_ARCHIVE = [
  { name: '签名开火', kind: 'signature_fire', note: '解锁本单位签名版开火视觉（开火签名发光色/弹道升档·特效层）——"我的船开火变帅了"。' },
  { name: '舰载趣闻', kind: 'unit_story', note: '解锁本单位专属星港趣事条目＋装配页个性台词——单位"活了"的情感节点。' },
  { name: '王牌徽记', kind: 'ace_crest', note: '满级身份演出：装配页金框＋战场血条旁星徽＋王牌战绩墙联动——毕业仪式感与对外展示。' },
] as const;

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
