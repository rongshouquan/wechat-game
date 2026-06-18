/**
 * 导航意图解析服务（S5C-03，纯 TS）。
 *
 * 把各 Presenter 返回的 NavigationIntent（推荐目标采纳 / 失败弹窗挽留路径 / 胜利结算下一步）
 * 解析为单场景内可执行的面板切换指令（NavigationResolution），由 MainSceneController 执行。
 * 不引入多场景跳转框架：当前主界面即备战界面，首批可达目标均为主界面内已有面板。
 *
 * 兜底约定：目标页面尚无正式 UI（阵容编辑 / 关卡选择 / 奖励确认 / 失败回顾）时，
 * 解析为 not_available 并附可见提示文案——任何导航点击都不被吞掉，玩家总能看到明确反馈，
 * 因此本服务保证 notice 恒为非空字符串。
 */
import { NavigationIntent } from './RecommendedTargetService';

export type NavigationResolutionKind =
  /** 回主界面常态（含目标关卡缺失等无法定位时的安全回落）。 */
  | 'main'
  /** 主界面常态 + 引导关注一键升级面板。 */
  | 'focus_upgrade'
  /** 主界面常态 + 引导关注离线收益面板。 */
  | 'focus_offline_reward'
  /** 主界面备战：选定目标关卡，等待玩家点「开始战斗」。 */
  | 'battle_prep'
  /** 目标页面暂未开放：回主界面并展示兜底提示。 */
  | 'not_available';

export interface NavigationResolution {
  kind: NavigationResolutionKind;
  /** battle_prep 专用：要备战的关卡 id（已校验存在于关卡配置中）。 */
  levelId?: string;
  /** 可见反馈文案，恒非空：视图层必须展示，保证任何导航点击都有可感知结果。 */
  notice: string;
}

export interface NavigationContext {
  /** 当前关卡配置中的全部关卡 id，用于校验 level_battle 意图的目标关卡。 */
  knownLevelIds: string[];
}

/** 尚无正式 UI 的目标页面 -> 兜底提示文案（页面落地后从此表移除并改接真实跳转）。 */
const NOT_AVAILABLE_NOTICE: Record<string, string> = {
  formation_edit: '阵容编辑暂未开放，可先用「一键升级」提升战力',
  level_select: '关卡选择暂未开放，请直接挑战推荐关卡',
  reward_claim: '奖励确认页暂未开放，敬请期待',
  defeat_recovery: '失败回顾暂未开放，可先用「一键升级」提升战力后再战',
};

function resolveLevelBattle(intent: NavigationIntent, context: NavigationContext): NavigationResolution {
  const levelId = intent.params?.levelId;
  if (typeof levelId === 'string' && context.knownLevelIds.includes(levelId)) {
    return { kind: 'battle_prep', levelId, notice: `已选定关卡 ${levelId}，点「开始战斗」出击` };
  }
  // levelId 缺失（如无上一关可重刷）或不在关卡配置中：安全回落主界面，不吞掉点击。
  return { kind: 'main', notice: '未找到目标关卡，已返回主界面' };
}

/**
 * 解析导航意图：已有面板的意图给出面板切换指令，未开放页面给出兜底提示。
 * 未知 scene 同样走 not_available（提示中带 scene 名便于排查），不抛错、不静默。
 */
export function resolveNavigationIntent(intent: NavigationIntent, context: NavigationContext): NavigationResolution {
  switch (intent.scene) {
    case 'hero_upgrade':
      return { kind: 'focus_upgrade', notice: '可在主界面用「一键升级」提升战力' };
    case 'offline_reward_claim':
      return { kind: 'focus_offline_reward', notice: '离线收益在主界面即可领取' };
    case 'level_battle':
      return resolveLevelBattle(intent, context);
    default: {
      const notice = NOT_AVAILABLE_NOTICE[intent.scene] ?? `该页面暂未开放（${intent.scene}）`;
      return { kind: 'not_available', notice };
    }
  }
}
