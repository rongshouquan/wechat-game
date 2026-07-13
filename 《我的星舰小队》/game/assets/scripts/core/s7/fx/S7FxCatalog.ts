// S7 战斗演出查表（签名攻击制 · 总谱 §2a · 演出骨架批 2026-07-13）。
//
// 职责：把「谁开火 × 什么效果 × 普攻还是技能」映射成一份**签名演出参数**——
//   弹体（形状/数量/节奏/飞行时长/大小/弹道弧度/发光色）+ 落点（爆点类型/大小）+ V 档。
//   五艘签名精雕舰（锋矢/铁壁/烈阳/晨曦/锁链）按星舰真源"开火签名"字段直译参数；
//   其余我方舰走五族基调 fallback；敌方走族弹 fallback（骨架期=星盗红，后续按族扩展）；
//   治疗/回复类走全阵营功能色（总谱 §2 颜色语法：治疗恒绿）。
//
// 严格边界：纯 TS 纯数据，不 import cc/引擎/配置加载器；查表键 = unitRef（shp01-20）+
//   roleTag（战斗单位表 roleTag 字段）由调用方从花名册/配置解出后传入，本层不读表。
// 响度守恒（总谱 §2a 铁线）：普攻=V1、技能=V2；签名个性只落在形状与节奏，
//   不越档抢尺寸亮度（V3 排场归星核质变，不在本表）。

/** 弹体形状（渲染壳按形状画占位图形，正式期换图集帧）。 */
export type S7FxShape = 'bolt' | 'shell' | 'ring' | 'orb' | 'blade' | 'bubble' | 'beam' | 'mist';

/** 落点行为（命中后那 0.3s 的戏——签名四要素之④）。 */
export type S7FxImpactKind =
  | 'burst_small'
  | 'burst_mid'
  | 'burst_big'
  | 'ring_expand'
  | 'bubble_pop'
  | 'cage_ring'
  | 'none';

/** 弹体参数（签名四要素①形状 ②数量与节奏 ③发光色，外加快慢与弧度性格）。 */
export interface S7FxProjectileSpec {
  shape: S7FxShape;
  /** 一次开火射出几发（三连点射=3）。 */
  count: number;
  /** 弹与弹的间隔秒（开火"鼓点"；单发=0）。 */
  intervalSec: number;
  /** 单发飞行时长秒（快慢性格；总谱§6 演出-结算同拍锁定→建议 ≤0.4）。 */
  flightSec: number;
  /** 相对尺寸（1=标准弹；烈阳大弹>1、锋矢细弹<1）。 */
  size: number;
  /** 弹道弧度 0=直线，1=高抛（烈阳过载轰击）。 */
  arc: number;
  /** 发光色 hex（=舰主色/族色/功能色；颜色语法"颜色=谁打的"）。 */
  color: string;
}

/** 一条签名演出（弹体可为 null=原地效果，如环自心扩散）。 */
export interface S7FxSignature {
  projectile: S7FxProjectileSpec | null;
  /** color：原地效果（无弹体）时的落点用色；durationSec：落点行为持续秒
   *  （Ron 07-13 反馈④：牢笼/盾泡要罩得住看得见——缺省由渲染壳按 kind 取短默认）。 */
  impact: { kind: S7FxImpactKind; size: number; color?: string; durationSec?: number };
  /** 响度档：1=普攻 V1、2=技能 V2（V3 星核质变不在本表）。 */
  vLevel: 1 | 2;
  /** 技能名（仅 V2 有意义·横幅用·取自星舰真源技能名）。 */
  name?: string;
}

/** 查表输入（由调用方解出，本层不读配置）。 */
export interface S7FxResolveQuery {
  /** 舰编号 shp01-20；敌方/召唤物可传空串。 */
  unitRef: string;
  /** 战斗单位表 roleTag（assault/guard 等）；未知传空串。 */
  roleTag: string;
  /** 日志 effectType（damage 族/heal/regen/summon…）。 */
  effectType: string;
  /** 普攻 false / 技能与星核 true（Playback.isUltimate）。 */
  isUltimate: boolean;
  /** 'player' | 'enemy'。 */
  side: string;
}

// ---- 功能色（总谱 §2 全阵营通用功能色：功能色 > 身份色，不随发射者变）----
const COLOR_HEAL = '#7ED957';
const COLOR_SHIELD = '#63B8FF';

// ---- 五族基调色（我方 fallback 用的代表色；正式逐舰色随素材接入补齐）----
const ROLE_COLOR: Record<string, string> = {
  assault: '#4FC3F7', // 突击·青蓝系
  guard: '#3BA8A0', // 护卫·钢青系
  artillery: '#FF8A3D', // 炮击·炽橙系
  support: '#F5A8C0', // 支援·金粉系
  engineer: '#9C6BD4', // 工程·紫系
};
const ENEMY_PIRATE_RED = '#D94A4A'; // 星盗族弹色（骨架期全敌通用，后续按族扩展）
const GENERIC_COLOR = '#FFE066';

function sig(
  projectile: S7FxProjectileSpec | null,
  impactKind: S7FxImpactKind,
  impactSize: number,
  vLevel: 1 | 2,
  impactColor?: string
): S7FxSignature {
  return { projectile, impact: { kind: impactKind, size: impactSize, color: impactColor }, vLevel };
}

function proj(p: Partial<S7FxProjectileSpec> & { shape: S7FxShape; color: string }): S7FxProjectileSpec {
  return {
    count: 1,
    intervalSec: 0,
    flightSec: 0.3,
    size: 1,
    arc: 0,
    ...p,
  };
}

// ---- 五舰签名精雕表（星舰真源"开火签名"直译；键=unitRef）----
// 锋矢 shp03：天青三连点射细束（全队最快的哒哒哒）；分镖=2 记回旋光刃。
// 铁壁 shp06：钢青震荡波环前推；怒吼=自心大声波环（原地）。
// 烈阳 shp09：全队最大颗慢速炽橙大弹；过载轰击=巨弹高抛落点大爆。
// 晨曦 shp13：蓝护盾泡飞向友军罩上；圣盾=全队依次亮泡（原地多目标）。
// 锁链 shp20：缠电小球；力场牢笼=紫光环牢罩住目标区。
const SHIP_SIGNS: Record<string, { normal: S7FxSignature; ultimate: S7FxSignature }> = {
  shp03: {
    normal: sig(proj({ shape: 'bolt', color: '#4FC3F7', count: 3, intervalSec: 0.1, flightSec: 0.18, size: 0.7 }), 'burst_small', 0.7, 1),
    ultimate: { ...sig(proj({ shape: 'blade', color: '#4FC3F7', count: 2, intervalSec: 0.12, flightSec: 0.32, size: 1.6, arc: 0.25 }), 'burst_mid', 1.3, 2), name: '分镖' },
  },
  shp06: {
    normal: sig(proj({ shape: 'ring', color: '#3BA8A0', flightSec: 0.35, size: 1.1 }), 'ring_expand', 1, 1),
    ultimate: { ...sig(null, 'ring_expand', 2.2, 2, '#3BA8A0'), name: '怒吼', impact: { kind: 'ring_expand', size: 2.2, color: '#3BA8A0', durationSec: 0.9 } }, // 自心钢青声波大环
  },
  shp09: {
    normal: sig(proj({ shape: 'shell', color: '#FF8A3D', flightSec: 0.4, size: 1.5 }), 'burst_mid', 1.3, 1),
    ultimate: { ...sig(proj({ shape: 'shell', color: '#FF8A3D', flightSec: 0.55, size: 2.8, arc: 1 }), 'burst_big', 2.4, 2), name: '过载轰击' },
  },
  shp13: {
    normal: sig(proj({ shape: 'bubble', color: COLOR_SHIELD, flightSec: 0.35, size: 1 }), 'bubble_pop', 1, 1),
    ultimate: { ...sig(null, 'bubble_pop', 1.6, 2, COLOR_SHIELD), name: '圣盾', impact: { kind: 'bubble_pop', size: 1.6, color: COLOR_SHIELD, durationSec: 2.5 } }, // 全队罩泡·罩得住看得见
  },
  shp20: {
    normal: sig(proj({ shape: 'orb', color: '#9C6BD4', flightSec: 0.38, size: 0.9 }), 'burst_small', 0.8, 1),
    ultimate: { ...sig(proj({ shape: 'ring', color: '#B96BE0', flightSec: 0.4, size: 1.8 }), 'cage_ring', 2, 2), name: '力场牢笼', impact: { kind: 'cage_ring', size: 2, color: '#B96BE0', durationSec: 2 } }, // 牢笼罩 2 秒
  },
};

// ---- 五族基调 fallback（键=roleTag；未精雕舰过渡期用·总谱 §2a 分批精雕条款）----
function roleBase(roleTag: string, isUltimate: boolean): S7FxSignature {
  const color = ROLE_COLOR[roleTag] ?? GENERIC_COLOR;
  switch (roleTag) {
    case 'assault':
      return isUltimate
        ? sig(proj({ shape: 'bolt', color, count: 2, intervalSec: 0.1, flightSec: 0.2, size: 1 }), 'burst_mid', 1, 2)
        : sig(proj({ shape: 'bolt', color, count: 2, intervalSec: 0.12, flightSec: 0.2, size: 0.8 }), 'burst_small', 0.8, 1);
    case 'guard':
      return isUltimate
        ? sig(null, 'ring_expand', 1.6, 2, color)
        : sig(proj({ shape: 'ring', color, flightSec: 0.35, size: 1 }), 'ring_expand', 0.9, 1);
    case 'artillery':
      return isUltimate
        ? sig(proj({ shape: 'shell', color, flightSec: 0.4, size: 1.8, arc: 0.8 }), 'burst_big', 1.6, 2)
        : sig(proj({ shape: 'shell', color, flightSec: 0.4, size: 1.3 }), 'burst_mid', 1.1, 1);
    case 'support':
      return isUltimate
        ? sig(null, 'bubble_pop', 1.3, 2, color)
        : sig(proj({ shape: 'bubble', color, flightSec: 0.35, size: 1 }), 'bubble_pop', 0.9, 1);
    case 'engineer':
      return isUltimate
        ? sig(proj({ shape: 'mist', color, flightSec: 0.4, size: 1.4 }), 'cage_ring', 1.3, 2)
        : sig(proj({ shape: 'orb', color, flightSec: 0.38, size: 0.9 }), 'burst_small', 0.8, 1);
    default:
      return isUltimate
        ? sig(proj({ shape: 'bolt', color: GENERIC_COLOR, flightSec: 0.3, size: 1.2 }), 'burst_mid', 1.2, 2)
        : sig(proj({ shape: 'bolt', color: GENERIC_COLOR, flightSec: 0.3, size: 1 }), 'burst_small', 1, 1);
  }
}

/** 治疗/回复类效果（功能色恒绿；骨架期口径：heal/regen 两值，随精雕批细分）。 */
const HEAL_TYPES = new Set(['heal', 'regen']);
/** 无弹体效果（召唤登场演出走 spawnedIds，不发弹）。 */
const NO_PROJECTILE_TYPES = new Set(['summon', 'summon_unit', 'rank_swap', 'cd_refund', 'accumulate_attack', 'extend_state', 'revive']);

/**
 * 签名演出主查表（优先级：功能件 > 无弹件 > 五舰精雕 > 我方族基调 > 敌方族弹 > 通用）。
 * 纯函数；查不到永远有兜底，不抛错（演出层残缺不许影响播放）。
 */
export function resolveFxSignature(q: S7FxResolveQuery): S7FxSignature {
  if (HEAL_TYPES.has(q.effectType)) {
    return sig(proj({ shape: 'bubble', color: COLOR_HEAL, flightSec: 0.3, size: 0.9 }), 'bubble_pop', 0.8, q.isUltimate ? 2 : 1);
  }
  if (NO_PROJECTILE_TYPES.has(q.effectType)) {
    return sig(null, 'none', 0, q.isUltimate ? 2 : 1);
  }
  const shipSign = SHIP_SIGNS[q.unitRef];
  if (shipSign) return q.isUltimate ? shipSign.ultimate : shipSign.normal;
  if (q.side === 'player') return roleBase(q.roleTag, q.isUltimate);
  // 敌方族弹（骨架期=星盗红一族；按族扩展时在此分键）
  return q.isUltimate
    ? sig(proj({ shape: 'bolt', color: ENEMY_PIRATE_RED, flightSec: 0.3, size: 1.4 }), 'burst_mid', 1.2, 2)
    : sig(proj({ shape: 'bolt', color: ENEMY_PIRATE_RED, flightSec: 0.3, size: 1 }), 'burst_small', 0.9, 1);
}
