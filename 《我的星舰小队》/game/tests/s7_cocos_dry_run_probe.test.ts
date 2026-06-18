// BATTLE-RT-07D-1: S7 Cocos dry-run 开发探针静态隔离测试。
// 仅以“读取源码文本”的方式验证 MainSceneController 里的 runS7DryRunProbe 探针存在且没有越界接线，
// 不 import MainSceneController（它依赖 cc，vitest 无法解析），也不 import 任何依赖 cc 的 Cocos 文件。
// 关键证明：探针用固定开发 seed + 默认进度 + 默认三舰 dry-run 阵容 + S7BattleRunService，
// 只打印最小调试日志（含 debug only / no settlement / no save / no UI result applied），
// 不接 UI/战报/胜负弹窗/结算/奖励/主线/存档/服务器，不用时间/随机/账号/设备生成 seed，
// 且 S7 dry-run 仅在探针内被调用一次（onStartBattle/finishBattle 未被改去接 S7）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CONTROLLER_SRC = path.resolve(
  __dirname,
  '..',
  'assets',
  'scripts',
  'ui',
  'view',
  'MainSceneController.ts',
);

function readControllerSource(): string {
  return readFileSync(CONTROLLER_SRC, 'utf-8');
}

/** 截取 runS7DryRunProbe 方法体：从方法签名到下一处 2 空格缩进的右大括号（方法结束）。 */
function probeBodyOf(src: string): { body: string; start: number; end: number } {
  const start = src.indexOf('private runS7DryRunProbe(');
  expect(start).toBeGreaterThan(-1);
  const rel = src.slice(start).indexOf('\n  }');
  expect(rel).toBeGreaterThan(-1);
  const end = start + rel + '\n  }'.length;
  return { body: src.slice(start, end), start, end };
}

describe('S7 Cocos dry-run 探针 - 存在并接到预加载成功路径', () => {
  it('探针方法存在，且在预加载成功日志之后被触发一次', () => {
    const src = readControllerSource();
    expect(src.includes('private runS7DryRunProbe(')).toBe(true);

    // 触发点必须在“预加载完成”成功日志之后（即只在加载成功后跑）。
    const successLog = src.indexOf('S7 配置运行时预加载完成');
    const trigger = src.indexOf('this.runS7DryRunProbe()');
    expect(successLog).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(successLog);
  });
});

describe('S7 Cocos dry-run 探针 - 固定输入与最小日志', () => {
  it('使用固定开发 seed 常量，绝非生成式 seed', () => {
    const src = readControllerSource();
    expect(src.includes("RT07D1_DEV_DRY_RUN_SEED = 'rt07d1-dev-dry-run-seed'")).toBe(true);
    const { body } = probeBodyOf(src);
    expect(body.includes('runSeed: RT07D1_DEV_DRY_RUN_SEED')).toBe(true);
  });

  it('探针用默认主线进度 + 默认三舰 dry-run 阵容 + S7BattleRunService', () => {
    const { body } = probeBodyOf(readControllerSource());
    expect(body.includes('createDefaultS7MainlineProgress()')).toBe(true);
    expect(body.includes('createS7DefaultDryRunLineup()')).toBe(true);
    expect(body.includes('new S7BattleRunService()')).toBe(true);
  });

  it('日志包含 debug-only 边界提示与最小字段', () => {
    const { body } = probeBodyOf(readControllerSource());
    expect(body.includes('debug only / no settlement / no save / no UI result applied')).toBe(true);
    for (const field of ['nodeId=', 'battleSeed=', 'winner=', 'hintCode=', 'durationSec=']) {
      expect(body.includes(field)).toBe(true);
    }
  });
});

describe('S7 Cocos dry-run 探针 - 无越界接线 / 未来在线化不堵死', () => {
  it('探针体内不含时间/随机/联网/支付/社交等痕迹', () => {
    const { body } = probeBodyOf(readControllerSource());
    // 注意：整文件别处（分析埋点 sessionId）合法使用 Date.now()，故此处只扫描探针体本身。
    const forbidden = [
      'Date.now', 'Math.random', 'fetch', 'wx.', 'WebSocket', 'XMLHttpRequest',
      'http://', 'https://', 'requestPayment', 'createRewardedVideoAd',
      'leaderboard', 'guild', 'friend', 'payment', 'iap', 'openid', 'unionid',
    ];
    for (const token of forbidden) expect(body.includes(token)).toBe(false);
  });

  it('探针体内不接 UI / 战报 / 胜负弹窗 / 结算 / 主线推进 / 存档', () => {
    const { body } = probeBodyOf(readControllerSource());
    const forbiddenWiring = [
      'completeS7Node', 'BattleView', 'buildBattlePlayback', 'launchLevelBattle',
      'settleVictory', 'victorySettlementPanel', 'defeatDialog', 'victoryPresenter',
      'rewardAnchorRef', 'S7SaveService', 'SaveService', 'PlayerState', 'Formation',
    ];
    for (const token of forbiddenWiring) expect(body.includes(token)).toBe(false);
  });

  it('S7 dry-run 调用仅出现在探针体内一次（onStartBattle/finishBattle 未接 S7）', () => {
    const src = readControllerSource();
    const { start, end } = probeBodyOf(src);
    // 这些“调用形态”（带括号）只应出现在探针体内、且各仅一次；import 行只有裸名字、不带括号，不会命中。
    for (const call of [
      'new S7BattleRunService()',
      'createS7DefaultDryRunLineup()',
      'createDefaultS7MainlineProgress()',
    ]) {
      const first = src.indexOf(call);
      const last = src.lastIndexOf(call);
      expect(first).toBeGreaterThan(-1); // 存在
      expect(first).toBe(last); // 全文件仅一次
      expect(first).toBeGreaterThanOrEqual(start); // 落在探针体内
      expect(first).toBeLessThan(end);
    }
  });
});
