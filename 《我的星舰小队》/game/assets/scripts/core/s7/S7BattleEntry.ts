/**
 * S7 首发正式版战斗入口上下文层（CC-07D，纯 TS，不依赖 cc）。
 *
 * 职责：把当前主线节点（S7MainlineProgressState.currentNodeId）解析为只读的 S7 战斗输入 context：
 * nodeId / nodeType / stageType / template / problemTag / secondaryPressure / pressure / preview /
 * boss / rewardAnchorRef / noAdCheckTag。仅为后续 S7 战斗结算核心准备输入。
 *
 * 明确不做（CC-07D 边界）：
 * - 不做真实战斗模拟、胜负结算、奖励发放、主线推进；不调用 completeS7Node、不写 S7SaveService。
 * - 不 import/复用流程版 BattleEngine/BattleLaunchService/LevelProgression/PlayerState/
 *   HeroStatGrowthService/BattleUnit；不新增 HP/atk/def/技能倍率/时间轴/波次/随机模拟。
 * - 不启用 t11/t12 或任何 reserve template。
 * - Boss 节点用 boss pressure（如 n075 pressureMax=14500），不叠加 template_modifier。
 * - secondary pressure 只允许 0/1 个，尊重 battle_template_config.secondaryTagCap=1。
 */
import {
  S7MainlineNodeConfig,
  S7BattleTemplateConfig,
  S7PressureParam,
  S7PrebattlePreviewConfig,
  S7BossNodeConfig,
  S7StageType,
} from '../../config/s7/ConfigTypesS7';
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { S7MainlineModel, S7MainlineProgressState } from './S7MainlineProgress';

/** 解析后的战斗压力输入（只读）。boss 用 boss pressure，不叠加 template_modifier。 */
export interface S7BattlePressure {
  scope: S7StageType;
  /** normal/elite 取 starfieldId，boss 取 nodeId。 */
  pressureRefKey: string;
  min: number;
  max: number;
  /** boss 专有推荐压力；normal/elite 为 null。 */
  recommend: number | null;
  /** 副压力上限（尊重 battle_template_config.secondaryTagCap，恒为 1）。 */
  secondaryPressureCap: number;
  /**
   * 模板压力系数（参考用，未应用到 min/max）：normal/elite 取对应 template_modifier 行的 modifier；
   * boss 恒为 null —— boss 不叠加 template_modifier（pressure 即 boss 档原值）。
   */
  templateModifier: number | null;
}

export interface S7BattlePreviewView {
  previewId: string;
  templateRef: string;
  problemTagRefs: string[];
  positionTags: string[];
  threatOrderTags: string[];
  counterHintTags: string[];
}

export interface S7BossView {
  bossNodeId: string;
  mainProblemTag: string;
  templateRef: string;
  secondaryPressureTag: string;
  previewTagRefs: string[];
  forbiddenMechanicTag: string;
}

export interface S7BattleContext {
  nodeId: string;
  nodeTypeTag: string;
  stageType: S7StageType;
  starfieldId: string;
  chapterId: string;
  templateId: string;
  mainProblemTag: string;
  /** 单个副压力标签；无副压力（'none'）为 null。 */
  secondaryPressure: string | null;
  pressure: S7BattlePressure;
  preview: S7BattlePreviewView;
  /** boss 节点的 boss_node_config 视图；非 boss 为 null。 */
  boss: S7BossView | null;
  rewardAnchorRef: string;
  noAdCheckTag: string;
}

export type S7BattleContextError =
  | 'unknown_node'
  | 'out_of_order'
  | 'not_battle_node'
  | 'missing_template'
  | 'missing_pressure'
  | 'missing_preview'
  | 'missing_boss_config';

export type S7BattleContextResult =
  | { ok: true; context: S7BattleContext }
  | { ok: false; error: S7BattleContextError; nodeId: string };

/** 由 nodeTypeTag 推导战斗阶段类型；boss/elite 显式，其余战斗节点归 normal。 */
function deriveStageType(nodeTypeTag: string): S7StageType {
  if (nodeTypeTag === 'boss') return 'boss';
  if (nodeTypeTag === 'elite') return 'elite';
  return 'normal';
}

/** 解析 S7 战斗输入 context（只读，无副作用：不改 progress、不写 save、不推进主线）。 */
export class S7BattleEntry {
  private readonly templates: S7BattleTemplateConfig[];
  private readonly pressures: S7PressureParam[];
  private readonly previews: S7PrebattlePreviewConfig[];
  private readonly bosses: S7BossNodeConfig[];
  /** template id -> template_modifier（参考系数，非 boss）。 */
  private readonly modifierByTemplate: Map<string, number>;

  constructor(
    private readonly runtime: S7ConfigRuntime,
    private readonly model: S7MainlineModel,
  ) {
    this.templates = runtime.getAll<S7BattleTemplateConfig>('battle_template_config');
    this.pressures = runtime.getAll<S7PressureParam>('pressure_param');
    this.previews = runtime.getAll<S7PrebattlePreviewConfig>('prebattle_preview_config');
    this.bosses = runtime.getAll<S7BossNodeConfig>('boss_node_config');
    this.modifierByTemplate = buildTemplateModifierMap(this.pressures);
  }

  static fromRuntime(runtime: S7ConfigRuntime): S7BattleEntry {
    return new S7BattleEntry(runtime, S7MainlineModel.fromRuntime(runtime));
  }

  /** 解析当前节点（progress.currentNodeId）的战斗 context。 */
  resolveCurrentContext(progress: S7MainlineProgressState): S7BattleContextResult {
    return this.resolveContext(progress, progress.currentNodeId);
  }

  /**
   * 解析指定节点的战斗 context。
   * 守卫顺序：unknown_node -> out_of_order(非当前节点) -> not_battle_node(templateRef/problemTagRef=none)
   * -> missing_template -> missing_boss_config(boss) -> missing_pressure -> missing_preview。
   * 任意失败返回 { ok:false }，不构建 context，不产生任何副作用。
   */
  resolveContext(progress: S7MainlineProgressState, nodeId: string): S7BattleContextResult {
    if (!this.model.hasNode(nodeId)) {
      return fail('unknown_node', nodeId);
    }
    if (nodeId !== progress.currentNodeId) {
      return fail('out_of_order', nodeId);
    }
    const node = this.runtime.getById<S7MainlineNodeConfig>('mainline_node_config', nodeId);
    if (!node) {
      return fail('unknown_node', nodeId); // 防御：模型有但配置缺，按未知节点处理
    }
    if (node.templateRef === 'none' || node.problemTagRef === 'none') {
      return fail('not_battle_node', nodeId);
    }

    const stageType = deriveStageType(node.nodeTypeTag);

    const template = this.templates.find((t) => t.templateId === node.templateRef);
    if (!template || template.reservedSlotFlag) {
      return fail('missing_template', nodeId); // 含 t11/t12 等保留/未知模板
    }

    let bossView: S7BossView | null = null;
    if (stageType === 'boss') {
      const boss = this.bosses.find((b) => b.bossNodeId === nodeId);
      if (!boss) {
        return fail('missing_boss_config', nodeId);
      }
      bossView = {
        bossNodeId: boss.bossNodeId,
        mainProblemTag: boss.mainProblemTag,
        templateRef: boss.templateRef,
        secondaryPressureTag: boss.secondaryPressureTag,
        previewTagRefs: [...boss.previewTagRefs],
        forbiddenMechanicTag: boss.forbiddenMechanicTag,
      };
    }

    const pressureRow = this.findPressureRow(stageType, node);
    if (!pressureRow || typeof pressureRow.pressureMin !== 'number' || typeof pressureRow.pressureMax !== 'number') {
      return fail('missing_pressure', nodeId);
    }

    const preview = this.previews.find((p) => p.templateRef === node.templateRef);
    if (!preview) {
      return fail('missing_preview', nodeId);
    }

    const secondaryPressure =
      node.secondaryPressureTag && node.secondaryPressureTag !== 'none' ? node.secondaryPressureTag : null;

    const pressure: S7BattlePressure = {
      scope: stageType,
      pressureRefKey: stageType === 'boss' ? node.nodeId : node.starfieldId,
      min: pressureRow.pressureMin,
      max: pressureRow.pressureMax,
      recommend: stageType === 'boss' ? pressureRow.pressureRecommend ?? null : null,
      // 尊重 secondaryTagCap=1：副压力上限取模板上限（恒为 1），副压力本身为单值，天然 <=1。
      secondaryPressureCap: template.secondaryTagCap,
      // boss 不叠加 template_modifier；非 boss 取参考系数（未应用到 min/max）。
      templateModifier: stageType === 'boss' ? null : this.modifierByTemplate.get(node.templateRef) ?? null,
    };

    const context: S7BattleContext = {
      nodeId: node.nodeId,
      nodeTypeTag: node.nodeTypeTag,
      stageType,
      starfieldId: node.starfieldId,
      chapterId: node.chapterId,
      templateId: template.templateId,
      mainProblemTag: node.problemTagRef,
      secondaryPressure,
      pressure,
      preview: {
        previewId: preview.previewId,
        templateRef: preview.templateRef,
        problemTagRefs: [...preview.problemTagRefs],
        positionTags: [...preview.positionTags],
        threatOrderTags: [...preview.threatOrderTags],
        counterHintTags: [...preview.counterHintTags],
      },
      boss: bossView,
      rewardAnchorRef: node.rewardAnchorRef,
      noAdCheckTag: node.noAdCheckTag,
    };

    return { ok: true, context };
  }

  /** normal/elite 按 starfieldId、boss 按 nodeId 匹配压力档行。 */
  private findPressureRow(stageType: S7StageType, node: S7MainlineNodeConfig): S7PressureParam | undefined {
    if (stageType === 'boss') {
      return this.pressures.find((r) => r.scope === 'boss' && r.refKey === node.nodeId);
    }
    // 对锚与阶梯批（Ron 07-10 拍板⑦"显示推荐值=真实需求"）：普通/精英优先取逐节点行
    // （refKey=nXXX·min=max=校准压力值→视图取中公式自然吐出真值），无节点行回退星域带
    // （旧口径·早段一带跨 45-2973 显示中值 1509 的虚标由此修正）。缺省缺席=行为逐字节不变。
    return (
      this.pressures.find((r) => r.scope === stageType && r.refKey === node.nodeId) ??
      this.pressures.find((r) => r.scope === stageType && r.refKey === node.starfieldId)
    );
  }
}

/**
 * 从 template_modifier 行构建 template id -> modifier 映射。
 * refKey 形如 't01_t02' / 't09' / 't10'，按 '_' 拆出其覆盖的模板 id。boss 不消费本映射。
 */
function buildTemplateModifierMap(pressures: S7PressureParam[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of pressures) {
    if (r.scope !== 'template_modifier' || typeof r.modifier !== 'number') continue;
    for (const tpl of r.refKey.split('_')) {
      if (/^t\d+$/.test(tpl)) map.set(tpl, r.modifier);
    }
  }
  return map;
}

function fail(error: S7BattleContextError, nodeId: string): S7BattleContextResult {
  return { ok: false, error, nodeId };
}
