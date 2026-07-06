// 星港趣事单测（S10.10·块5 立·交互巡检批扩至正式池）——确定性触发（15%占位·每日≤1 由控制器配 adDaily 载体）
// + 定稿池调性守卫（全池禁忌词硬扫 + speaker 名与附录D驾驶员真源核对）。
import { describe, it, expect } from 'vitest';
import {
  anecdoteForDay, anecdoteByIndex, anecdoteSpeakerDisplay,
  S7_ANECDOTE_LINES, S7_ANECDOTE_PILOT_NAMES, ANECDOTE_TRIGGER_CHANCE, ANECDOTE_SHOWN_COUNTER_KEY,
} from '../assets/scripts/core/s7/S7StarportAnecdote';

describe('块5+巡检批 · 星港趣事', () => {
  it('计数 key 常量对齐（"今日已展示"走 adDaily 通用载体）', () => {
    expect(ANECDOTE_SHOWN_COUNTER_KEY).toBe('starport_anecdote_shown');
  });

  it('确定性：同 dayKey 同结果（含命中与未命中两侧）；非法 dayKey → null', () => {
    for (let d = 0; d < 60; d += 1) {
      const a = anecdoteForDay(40_000 + d);
      const b = anecdoteForDay(40_000 + d);
      expect(b).toEqual(a); // 杀进程重进同日同结果
    }
    expect(anecdoteForDay(-1)).toBeNull();
    expect(anecdoteForDay(1.5)).toBeNull();
  });

  it('触发率量级：扫 1000 天命中数落在 15%±带（防"永不触发/天天触发"两个坏死方向）', () => {
    let hits = 0;
    for (let d = 0; d < 1000; d += 1) {
      if (anecdoteForDay(50_000 + d) !== null) hits += 1;
    }
    expect(hits).toBeGreaterThan(80);  // 远高于 0 —— 真的会触发
    expect(hits).toBeLessThan(260);    // 远低于 1000 —— 不是天天有（占位 15%·给宽带防脆断）
    expect(ANECDOTE_TRIGGER_CHANCE).toBeCloseTo(0.15, 5);
  });

  it('定稿池：≥30 条（任务单口径·上不封顶；现 12 种子+60 正式=72·006 改词回池）·每条 头像+趣话+个位数微量奖励（星贝/星矿）', () => {
    expect(S7_ANECDOTE_LINES.length).toBeGreaterThanOrEqual(30);
    for (const line of S7_ANECDOTE_LINES) {
      expect(line.avatar.length).toBeGreaterThan(0);
      expect(line.text.length).toBeGreaterThanOrEqual(8); // 1-2 句像样的话
      expect(line.text.length).toBeLessThanOrEqual(48);   // 池规范≤40字（给标点/引号留余量）
      const keys = Object.keys(line.reward);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(['starCargo', 'starOre'], k).toContain(k); // 只发星贝/星矿（S10.10）
        expect(Number.isInteger(line.reward[k])).toBe(true);
        expect(line.reward[k]).toBeGreaterThanOrEqual(1);
        expect(line.reward[k]).toBeLessThanOrEqual(9); // 个位数
      }
    }
  });

  it('speaker 名核对（任务单步①）：驾驶员条目 ∈ 附录D 20 名单；居民条目带「居民-」前缀；20 位驾驶员每人 ≥1 条', () => {
    expect(S7_ANECDOTE_PILOT_NAMES).toHaveLength(20);
    const pilotSet = new Set(S7_ANECDOTE_PILOT_NAMES);
    const seen = new Set<string>();
    for (const line of S7_ANECDOTE_LINES) {
      if (line.speaker === undefined) continue; // 种子=叙述体不署名
      const isResident = line.speaker.startsWith('居民-');
      if (!isResident) {
        expect(pilotSet.has(line.speaker), `speaker「${line.speaker}」不在附录D驾驶员真源 20 名单里`).toBe(true);
        seen.add(line.speaker);
      } else {
        expect(line.speaker.length).toBeGreaterThan('居民-'.length); // 前缀后有职业名
      }
      // 展示名：去「居民-」前缀；驾驶员原样。
      const disp = anecdoteSpeakerDisplay(line);
      expect(disp.length).toBeGreaterThan(0);
      expect(disp.startsWith('居民-')).toBe(false);
    }
    for (const p of S7_ANECDOTE_PILOT_NAMES) {
      expect(seen.has(p), `驾驶员「${p}」在正式池里一条都没有`).toBe(true);
    }
  });

  it('调性禁忌扫描（S10.10：不卖惨/不催促/不提广告/不指向消费）——全定稿池逐条文案硬扫', () => {
    const banned = ['广告', '买', '充值', '付费', '错过', '倒计时', '快来', '赶紧', '仅剩', '最后', '可怜', '惨'];
    for (const line of S7_ANECDOTE_LINES) {
      for (const word of banned) {
        expect(line.text.includes(word), `「${line.text}」含禁词「${word}」`).toBe(false);
      }
    }
  });

  it('命中日返回的那条 ∈ 定稿池；anecdoteByIndex 轮换取模总有效（DEV 必触发用）', () => {
    let checked = 0;
    for (let d = 0; d < 400 && checked < 10; d += 1) {
      const a = anecdoteForDay(60_000 + d);
      if (!a) continue;
      expect(S7_ANECDOTE_LINES).toContainEqual(a);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
    expect(anecdoteByIndex(0)).toEqual(S7_ANECDOTE_LINES[0]);
    expect(anecdoteByIndex(S7_ANECDOTE_LINES.length)).toEqual(S7_ANECDOTE_LINES[0]); // 取模轮换
    expect(anecdoteByIndex(-1)).toEqual(S7_ANECDOTE_LINES[S7_ANECDOTE_LINES.length - 1]); // 负数也有效
  });
});
