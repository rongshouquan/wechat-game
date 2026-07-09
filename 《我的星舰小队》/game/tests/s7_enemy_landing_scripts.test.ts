// ⑩A0 · 落数两步脚本冒烟守卫（总控回执①加严：脚本要带"幂等自证"进 gate）。
// 三重断言（对临时副本跑真脚本·零触碰仓库配置）：
//   ① 两步协议可用：clean（回净土）→ apply（按压力表重落）跑通；
//   ② 一致性：脚本输出 == 仓库磁盘逐字节（磁盘手改一个值即红——继承"落数一致性"守卫语义）；
//   ③ 幂等自证：apply 连跑第二遍输出逐字节不变（§20.1"禁半截重落"的机制化——174 垃圾行事故类根治）。
// 变异探针（开发期手动验证·2026-07-09 实测）：临时把 bu_n061_shield.maxHp −1 → 断言②红；恢复复绿。
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const GAME_ROOT = path.resolve(__dirname, '..');
const S7_DIR = path.join(GAME_ROOT, 'assets', 'resources', 'configs', 's7');
const TABLES = [
  'battle_unit_stat_param',
  'battle_effect_param',
  'battle_encounter_param',
  'battle_spawn_param',
  'battle_boss_phase_param',
];

function runTool(tool: string, dir: string): void {
  execFileSync(process.execPath, [path.join(GAME_ROOT, 'tools', tool), '--dir', dir], {
    cwd: GAME_ROOT,
    stdio: 'pipe',
  });
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  // EOL 归一（\r\n→\n）：守卫守的是内容字节，不守 git autocrlf 造成的换行差异（fresh checkout 防假红）。
  for (const t of TABLES) out[t] = readFileSync(path.join(dir, `${t}.sample.json`), 'utf-8').replace(/\r\n/g, '\n');
  return out;
}

describe('s7 enemy landing scripts (⑩A0 幂等两步·自证守卫)', () => {
  it('clean→apply 复现磁盘态（一致性），apply 连跑第二遍逐字节不变（幂等）', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 's7-landing-guard-'));
    try {
      for (const t of TABLES) {
        cpSync(path.join(S7_DIR, `${t}.sample.json`), path.join(tmp, `${t}.sample.json`));
      }
      runTool('clean-and-normalize.mjs', tmp);
      runTool('apply-enemy-landing.mjs', tmp);
      const first = snapshot(tmp);
      const disk = snapshot(S7_DIR);
      for (const t of TABLES) expect(first[t], `${t}: 脚本输出应与仓库磁盘一致`).toBe(disk[t]);
      runTool('apply-enemy-landing.mjs', tmp);
      const second = snapshot(tmp);
      for (const t of TABLES) expect(second[t], `${t}: 第二遍重落应逐字节不变`).toBe(first[t]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
