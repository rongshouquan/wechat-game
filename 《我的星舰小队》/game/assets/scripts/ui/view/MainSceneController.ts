/**
 * 主场景控制器 / 冷启动根（Cocos Component）。
 *
 * 职责（S7-only 启动）：
 * - onLoad 时预加载并私有持有 S7ConfigRuntime（43 张 S7 表）；
 * - 预加载成功后跑一次本地 dry-run 开发探针（仅调试日志，错误自包含）；
 * - 在 Canvas 顶层挂载 S7 最小可玩循环演示层（S7DemoController），注入 runtime 与存储适配器。
 *
 * 注意：本控制器只负责把 S7 接进 Cocos 生命周期，不含任何战斗/数值/结算核心逻辑
 * （全部在 core/s7 纯 TS 服务里，已单测）。历史"流程版"老 UI 启动链已于「包体瘦身批」整体移除。
 */
import { _decorator, Component, Node } from 'cc';
// S7 配置运行时（纯 TS）+ 其 Cocos 资源读取适配层，用于启动链路预加载并私有持有。
import { S7ConfigRuntime } from '../../config/s7/S7ConfigRuntime';
import { createCocosS7TableReader } from '../../config/s7/S7ConfigResourceReader';
// S7 dry-run 开发探针所需的纯 TS 运行壳 / 默认 dry-run 阵容 / 默认主线进度（仅调试用，不接 UI/结算/存档/服务器）。
import { S7BattleRunService } from '../../core/s7/S7BattleRunService';
import { createS7DefaultDryRunLineup } from '../../core/s7/S7DefaultBattleLineup';
import { createDefaultS7MainlineProgress } from '../../core/s7/S7MainlineProgress';
// C1b-step2：S7 最小可玩循环色块演示层（程序化 UI，调已单测的 core/s7 纯逻辑）。
import { S7DemoController } from './S7DemoController';
import {
  BrowserLocalStorageAdapter,
  MemoryStorageAdapter,
  SaveStorageAdapter,
  WxStorageAdapter,
} from '../../save/SaveStorageAdapter';

const { ccclass } = _decorator;

/**
 * 固定开发用 dry-run 种子（显式常量；绝不由 Date.now / Math.random / 账号 / 设备 / openid / unionid 生成）。
 */
const RT07D1_DEV_DRY_RUN_SEED = 'rt07d1-dev-dry-run-seed';

@ccclass('MainSceneController')
export class MainSceneController extends Component {
  /** 预加载并私有持有的 S7 配置运行时；加载失败保持 null。 */
  private s7Runtime: S7ConfigRuntime | null = null;

  onLoad(): void {
    void this.preloadS7ConfigRuntime();
  }

  /**
   * 在 Cocos 启动链路预加载并私有持有 S7ConfigRuntime（43 张 S7 表）。
   * 成功记录 version 与表数、跑 dry-run 探针、挂载 S7 演示层；
   * 失败明确 console.error 且保持 s7Runtime=null，绝不静默补空表或伪造 runtime。
   */
  private async preloadS7ConfigRuntime(): Promise<void> {
    try {
      const runtime = await S7ConfigRuntime.load(createCocosS7TableReader());
      this.s7Runtime = runtime;
      console.log(
        '[MainSceneController] S7 配置运行时预加载完成',
        `version=${runtime.version}`,
        `tables=${runtime.tableNames.length}`,
      );
      // RT-07D-1：预加载成功且已持有 runtime 后，跑一次本地 dry-run 开发探针（仅调试日志，错误自包含，不影响预加载结论）。
      this.runS7DryRunProbe();
      // C1b-step2：挂载 S7 最小可玩循环色块演示层（盖在最上层；调已单测的 S7RunSession）。
      this.mountS7Demo(runtime);
    } catch (err) {
      // 不静默兜底、不伪造 runtime：保持 s7Runtime=null 并明确报错。
      this.s7Runtime = null;
      console.error('[MainSceneController] S7 配置运行时预加载失败', err);
    }
  }

  /**
   * RT-07D-1：S7 最小 dry-run 开发探针（仅在 S7ConfigRuntime 预加载成功后跑一次）。
   * 输入固定：默认主线进度（n001）+ 默认三舰 dry-run 阵容（注意：这是 dry-run 阵容，不是正式玩家阵容，也不是 5 舰阵容）
   * + 固定开发种子常量，经 S7BattleRunService 跑出结果，仅 console.log nodeId/battleSeed/winner/hintCode/durationSec。
   * 严格边界（仅调试观测、不应用结果）：不接 UI 战报页 / 胜负弹窗，不结算、不发奖励、不应用 rewardAnchorRef、
   * 不推进主线、不调 completeS7Node、不写存档、不接服务器；种子为固定常量，绝不由时间/随机/账号/设备/openid/unionid 生成。
   * 错误自包含（本方法内 try/catch），不影响预加载结论与正式启动流程。
   */
  private runS7DryRunProbe(): void {
    const runtime = this.s7Runtime;
    if (!runtime) {
      return;
    }
    try {
      const out = new S7BattleRunService().run({
        runtime,
        progress: createDefaultS7MainlineProgress(),
        runSeed: RT07D1_DEV_DRY_RUN_SEED,
        lineup: createS7DefaultDryRunLineup(),
      });
      console.log(
        '[MainSceneController] S7 dry-run 探针 (debug only / no settlement / no save / no UI result applied)',
        `nodeId=${out.context.nodeId}`,
        `battleSeed=${out.request.battleSeed}`,
        `winner=${out.result.winner}`,
        `hintCode=${out.summary.hintCode}`,
        `durationSec=${out.result.durationSec}`,
      );
    } catch (err) {
      console.error('[MainSceneController] S7 dry-run 探针失败（仅调试，不影响正式流程）', err);
    }
  }

  /**
   * C1b-step2：在 Canvas 顶层挂载 S7 最小可玩循环色块演示层。
   * 程序化创建一个覆盖节点 + S7DemoController，注入已加载的 runtime 与存储适配器；
   * 演示层只读写 S7 独立存档域、调已单测的 S7RunSession。
   * 全程错误自包含：失败仅日志，不影响冷启动其余部分。
   */
  private mountS7Demo(runtime: S7ConfigRuntime): void {
    try {
      const canvas = this.findNodeByName(this.sceneRoot(), 'Canvas');
      if (!canvas) {
        console.warn('[MainSceneController] 未找到 Canvas，S7 演示层跳过');
        return;
      }
      const node = new Node('S7DemoOverlay');
      node.layer = canvas.layer;
      canvas.addChild(node);
      node.setSiblingIndex(canvas.children.length - 1); // 置顶覆盖
      const demo = node.addComponent(S7DemoController);
      demo.init(runtime, this.pickStorageAdapter());
      console.log('[MainSceneController] S7 最小循环演示层已挂载');
    } catch (err) {
      console.error('[MainSceneController] S7 演示层挂载失败', err);
    }
  }

  private findNodeByName(root: Node, name: string): Node | null {
    if (root.name === name) {
      return root;
    }
    for (const child of root.children) {
      const found = this.findNodeByName(child, name);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /** 向上回溯到场景根，供 Canvas 查找。 */
  private sceneRoot(): Node {
    let node: Node = this.node;
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }

  /**
   * 存储适配器选择优先级：真机微信 -> 浏览器/编辑器预览 localStorage -> 内存兜底。
   * 编辑器预览无 wx 但有 localStorage，改用 BrowserLocalStorageAdapter 后，
   * 停止预览再播放也能恢复关键状态，便于验证阶段2出口"重进不丢关键状态"。
   */
  private pickStorageAdapter(): SaveStorageAdapter {
    const g = globalThis as unknown as {
      wx?: ConstructorParameters<typeof WxStorageAdapter>[0];
      localStorage?: ConstructorParameters<typeof BrowserLocalStorageAdapter>[0];
    };
    if (g.wx) {
      return new WxStorageAdapter(g.wx);
    }
    if (g.localStorage) {
      return new BrowserLocalStorageAdapter(g.localStorage);
    }
    return new MemoryStorageAdapter();
  }
}
