import { ConfigBundle, ConfigTableName } from './ConfigTypes';
import { validateConfigBundle, ValidationError } from './ConfigValidator';

const TABLE_FILES: Record<ConfigTableName, string> = {
  level_config: 'level_config.sample',
  enemy_config: 'enemy_config.sample',
  enemy_group_config: 'enemy_group_config.sample',
  hero_config: 'hero_config.sample',
  skill_config: 'skill_config.sample',
  reward_config: 'reward_config.sample',
  ad_config: 'ad_config.sample',
};

export class ConfigLoadError extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super(`config validation failed: ${errors.length} error(s)`);
  }
}

/**
 * 配置加载器：接收已读取的原始 JSON 数据并构建索引、执行 schema 校验。
 * 真机环境下由调用方负责通过 cc.resources / wx 文件系统读取 JSON 后传入 loadFromData，
 * 以保持本类与运行时资源系统解耦，便于在 Node/vitest 环境下单元测试。
 */
export class ConfigLoader {
  private bundle: ConfigBundle | null = null;
  private indexes = new Map<ConfigTableName, Map<string, unknown>>();
  private version = '';

  static get resourcePaths(): Record<ConfigTableName, string> {
    return { ...TABLE_FILES };
  }

  loadFromData(raw: Record<ConfigTableName, unknown[]>): void {
    const bundle = raw as unknown as ConfigBundle;
    const errors = validateConfigBundle(bundle);
    if (errors.length > 0) {
      throw new ConfigLoadError(errors);
    }

    this.bundle = bundle;
    this.indexes.clear();
    (Object.keys(TABLE_FILES) as ConfigTableName[]).forEach((table) => {
      const idField = ID_FIELD[table];
      const map = new Map<string, unknown>();
      for (const row of bundle[table] as unknown as Array<Record<string, unknown>>) {
        map.set(row[idField] as string, row);
      }
      this.indexes.set(table, map);
    });

    this.version = bundle.level_config[0]?.schemaVersion ?? 'unknown';
  }

  get loadedVersion(): string {
    return this.version;
  }

  isLoaded(): boolean {
    return this.bundle !== null;
  }

  getAll<T = unknown>(table: ConfigTableName): T[] {
    this.assertLoaded();
    return this.bundle![table] as unknown as T[];
  }

  getById<T = unknown>(table: ConfigTableName, id: string): T | undefined {
    this.assertLoaded();
    return this.indexes.get(table)?.get(id) as T | undefined;
  }

  private assertLoaded(): void {
    if (!this.bundle) {
      throw new Error('ConfigLoader: configs not loaded yet');
    }
  }
}

const ID_FIELD: Record<ConfigTableName, string> = {
  level_config: 'levelId',
  enemy_config: 'enemyId',
  enemy_group_config: 'enemyGroupId',
  hero_config: 'heroId',
  skill_config: 'skillId',
  reward_config: 'rewardId',
  ad_config: 'adSlotId',
};
