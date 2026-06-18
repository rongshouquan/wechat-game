import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ConfigLoader, ConfigLoadError } from '../assets/scripts/config/ConfigLoader';
import { ConfigBundle, ConfigTableName } from '../assets/scripts/config/ConfigTypes';

const CONFIG_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs');

function readSample<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(CONFIG_DIR, file), 'utf-8')) as T;
}

function loadSampleBundle(): Record<ConfigTableName, unknown[]> {
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

describe('config loader', () => {
  it('loads and validates all sample configs', () => {
    const loader = new ConfigLoader();
    loader.loadFromData(loadSampleBundle());

    expect(loader.isLoaded()).toBe(true);
    console.log(`loaded config version ${loader.loadedVersion}`);
    expect(loader.loadedVersion).toBe('0.1.0');
  });

  it('indexes rows by id and resolves references', () => {
    const loader = new ConfigLoader();
    loader.loadFromData(loadSampleBundle());

    const bossLevel = loader.getById<{ levelId: string; type: string; rewardId: string }>(
      'level_config',
      '1-10',
    );
    expect(bossLevel?.type).toBe('boss');

    const reward = loader.getById<{ rewardId: string }>('reward_config', bossLevel!.rewardId);
    expect(reward).toBeDefined();

    const hero = loader.getById<{ heroId: string; skillIds: string[] }>('hero_config', 'hero_mia');
    expect(hero?.skillIds.length).toBeGreaterThan(0);
    for (const skillId of hero!.skillIds) {
      expect(loader.getById('skill_config', skillId)).toBeDefined();
    }
  });

  it('rejects bundles with duplicate ids or dangling references', () => {
    const bundle = loadSampleBundle() as unknown as ConfigBundle;
    const broken: ConfigBundle = {
      ...bundle,
      reward_config: [
        ...bundle.reward_config,
        { ...bundle.reward_config[0] },
      ],
    };

    const loader = new ConfigLoader();
    expect(() => loader.loadFromData(broken as unknown as Record<ConfigTableName, unknown[]>)).toThrow(
      ConfigLoadError,
    );
    expect(loader.isLoaded()).toBe(false);
  });
});
