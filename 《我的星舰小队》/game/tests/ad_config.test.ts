import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateConfigBundle, ValidationError } from '../assets/scripts/config/ConfigValidator';
import { AdConfig, ConfigBundle, RewardConfig } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

function loadBundle(): ConfigBundle {
  return {
    level_config: readSample('level_config.sample.json'),
    enemy_config: readSample('enemy_config.sample.json'),
    enemy_group_config: readSample('enemy_group_config.sample.json'),
    hero_config: readSample('hero_config.sample.json'),
    skill_config: readSample('skill_config.sample.json'),
    reward_config: readSample('reward_config.sample.json'),
    ad_config: readSample('ad_config.sample.json'),
  };
}

function adErrors(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.table === 'ad_config');
}

function hasMessage(errors: ValidationError[], sub: string): boolean {
  return errors.some((e) => e.message.includes(sub));
}

// 以合法样例首行为基准，按需覆盖字段制造非法用例；overrides 用 unknown 以允许越界值。
function adRow(overrides: Partial<Record<keyof AdConfig, unknown>>): AdConfig {
  const base = loadBundle().ad_config[0];
  return { ...base, ...overrides } as AdConfig;
}

function bundleWithAds(rows: AdConfig[]): ConfigBundle {
  return { ...loadBundle(), ad_config: rows };
}

describe('ad config schema', () => {
  it('accepts the sample ad config and resolves every rewardId to reward_config', () => {
    const bundle = loadBundle();
    const errors = validateConfigBundle(bundle);
    expect(errors).toEqual([]);

    const rewardIds = new Set((bundle.reward_config as RewardConfig[]).map((r) => r.rewardId));
    expect(bundle.ad_config.length).toBeGreaterThan(0);
    for (const ad of bundle.ad_config) {
      expect(rewardIds.has(ad.rewardId)).toBe(true);
    }
  });

  it('rejects an out-of-enum adType or entry', () => {
    const badType = adErrors(validateConfigBundle(bundleWithAds([adRow({ adType: 'popup' })])));
    expect(hasMessage(badType, 'adType')).toBe(true);

    const badEntry = adErrors(validateConfigBundle(bundleWithAds([adRow({ entry: 'mystery_box' })])));
    expect(hasMessage(badEntry, 'entry')).toBe(true);
  });

  it('rejects negative or out-of-range limits and cooldown', () => {
    const negDaily = adErrors(validateConfigBundle(bundleWithAds([adRow({ dailyLimit: -1 })])));
    expect(hasMessage(negDaily, 'dailyLimit')).toBe(true);

    const negSession = adErrors(validateConfigBundle(bundleWithAds([adRow({ sessionLimit: -2 })])));
    expect(hasMessage(negSession, 'sessionLimit')).toBe(true);

    const negCooldown = adErrors(validateConfigBundle(bundleWithAds([adRow({ cooldownSec: -5 })])));
    expect(hasMessage(negCooldown, 'cooldownSec')).toBe(true);

    // sessionLimit 不得大于 dailyLimit
    const inverted = adErrors(
      validateConfigBundle(bundleWithAds([adRow({ dailyLimit: 1, sessionLimit: 3 })])),
    );
    expect(hasMessage(inverted, 'sessionLimit 不得大于 dailyLimit')).toBe(true);
  });

  it('rejects a rewardId that has no matching reward_config row', () => {
    const errors = adErrors(
      validateConfigBundle(bundleWithAds([adRow({ rewardId: 'rw_does_not_exist' })])),
    );
    expect(hasMessage(errors, 'reward_config')).toBe(true);
  });

  it('rejects duplicate adSlotId', () => {
    const dup = adRow({});
    const errors = adErrors(validateConfigBundle(bundleWithAds([dup, { ...dup }])));
    expect(hasMessage(errors, '重复')).toBe(true);
  });
});
