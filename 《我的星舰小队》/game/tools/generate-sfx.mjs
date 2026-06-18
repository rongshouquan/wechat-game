// S5C-06 程序化短音效生成脚本（自制来源凭证，进入仓库）。
// 用法：node tools/generate-sfx.mjs
// 输出：assets/resources/audio/sfx/ 下 5 个极短 mono 8-bit PCM WAV（合计预算 <=20KB）。
// 设计依据《音效BGM规格.md》：纯正弦合成、确定性输出（无随机源），音量层级
// 点击 < 失败 < 领取 < 升级 < 胜利；时长/单文件体积均落在规格窗口内。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'resources', 'audio', 'sfx');

/** 单个音符/扫频片段：起止频率线性插值，attack/decay 包络，可叠加二次谐波。 */
function addNote(buf, sampleRate, { start, dur, freqFrom, freqTo = freqFrom, amp, attack = 0.005, decayTau, harmonic = 0 }) {
  const startIdx = Math.floor(start * sampleRate);
  const n = Math.floor(dur * sampleRate);
  const tau = decayTau ?? dur / 3;
  let phase = 0;
  let phaseH = 0;
  for (let i = 0; i < n && startIdx + i < buf.length; i++) {
    const t = i / sampleRate;
    const freq = freqFrom + (freqTo - freqFrom) * (t / dur);
    phase += (2 * Math.PI * freq) / sampleRate;
    phaseH += (2 * Math.PI * freq * 2) / sampleRate;
    const env = (t < attack ? t / attack : Math.exp(-(t - attack) / tau)) * Math.min(1, (dur - t) / 0.01);
    buf[startIdx + i] += (Math.sin(phase) + harmonic * Math.sin(phaseH)) * amp * env;
  }
}

/** 归一化到目标峰值（音量层级编码在文件本体），软限幅防爆音，量化为 8-bit 无符号 PCM。 */
function toU8(buf, peak) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  const gain = max > 0 ? peak / max : 0;
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(-1, Math.min(1, buf[i] * gain));
    out[i] = Math.round(128 + v * 127);
  }
  return out;
}

/** 写 44 字节标准 RIFF/WAVE 头 + 8-bit mono PCM 数据。 */
function writeWav(file, samples, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28); // byteRate = sampleRate * 1ch * 1B
  header.writeUInt16LE(1, 32); // blockAlign
  header.writeUInt16LE(8, 34); // bitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(samples.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, Buffer.from(samples)]));
}

/** 5 条音效定义：assetId 与《音效BGM规格.md》规格表一致。 */
const SFX_DEFS = [
  {
    assetId: 'sfx_ui_click',
    sampleRate: 11025,
    durationSec: 0.09,
    peak: 0.4, // 最低层级：短促轻点击
    notes: [{ start: 0, dur: 0.09, freqFrom: 1500, freqTo: 950, amp: 1, attack: 0.002, decayTau: 0.03 }],
  },
  {
    assetId: 'sfx_reward_claim',
    sampleRate: 11025,
    durationSec: 0.22,
    peak: 0.6, // 清晰但不夸张：双音上行
    notes: [
      { start: 0, dur: 0.11, freqFrom: 659, amp: 1, harmonic: 0.2 },
      { start: 0.09, dur: 0.13, freqFrom: 880, amp: 1, harmonic: 0.2 },
    ],
  },
  {
    assetId: 'sfx_upgrade',
    sampleRate: 11025,
    durationSec: 0.27,
    peak: 0.7, // 强于领取、弱于胜利：上扫 + 确认音
    notes: [
      { start: 0, dur: 0.16, freqFrom: 440, freqTo: 880, amp: 0.9, decayTau: 0.12 },
      { start: 0.15, dur: 0.12, freqFrom: 1175, amp: 1, harmonic: 0.15 },
    ],
  },
  {
    assetId: 'sfx_battle_victory',
    sampleRate: 8000,
    durationSec: 0.5,
    peak: 0.85, // 最亮：C 大调短琶音，不做长 fanfare
    notes: [
      { start: 0, dur: 0.16, freqFrom: 523, amp: 0.9, harmonic: 0.2 },
      { start: 0.12, dur: 0.16, freqFrom: 659, amp: 0.9, harmonic: 0.2 },
      { start: 0.24, dur: 0.16, freqFrom: 784, amp: 0.9, harmonic: 0.2 },
      { start: 0.36, dur: 0.14, freqFrom: 1046, amp: 1, harmonic: 0.15 },
    ],
  },
  {
    assetId: 'sfx_battle_defeat',
    sampleRate: 8000,
    durationSec: 0.36,
    peak: 0.5, // 克制：缓起音双音下行，不制造刺耳挫败感
    notes: [
      { start: 0, dur: 0.16, freqFrom: 440, amp: 1, attack: 0.015, decayTau: 0.1 },
      { start: 0.14, dur: 0.22, freqFrom: 330, amp: 0.9, attack: 0.015, decayTau: 0.12 },
    ],
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
for (const def of SFX_DEFS) {
  const buf = new Float64Array(Math.floor(def.durationSec * def.sampleRate));
  for (const note of def.notes) {
    addNote(buf, def.sampleRate, note);
  }
  const file = path.join(OUT_DIR, `${def.assetId}.wav`);
  writeWav(file, toU8(buf, def.peak), def.sampleRate);
  const size = fs.statSync(file).size;
  total += size;
  console.log(`${def.assetId}.wav  ${def.durationSec}s @${def.sampleRate}Hz  ${size} B`);
}
console.log(`total: ${total} B (${(total / 1024).toFixed(1)} KB), budget 20480 B -> ${total <= 20480 ? 'OK' : 'OVER BUDGET'}`);
