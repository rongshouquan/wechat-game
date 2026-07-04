// S7 配置加载器（与流程版 ConfigLoader.ts 隔离）。
// 与运行时资源系统解耦：调用方通过 cc.resources / wx 文件系统读取 JSON 后传入 loadFromData，
// 以便在 Node / vitest 环境下单元测试。Tier A 仅做加载 + 索引 + 校验，不接入玩法运行时。

import {
  S7ConfigBundle,
  S7ConfigTableName,
  S7_ID_FIELD,
  S7_TABLE_FILES,
} from './ConfigTypesS7';
import { validateS7ConfigBundle, S7ValidationError } from './ConfigValidatorS7';

const S7_TABLE_NAMES: S7ConfigTableName[] = [
  'battle_template_config',
  'ship_config',
  'pilot_config',
  'core_config',
  'plugin_config',
  'source_tag_config',
  'power_reference_param',
  'free_resource_anchor_param',
  'upgrade_cost_param',
  'enhance_cost_param',
  'growth_band_param',
  'refund_param',
  'pressure_param',
  'reward_param',
  'shop_param',
  'merchant_refresh_param',
  'recycle_param',
  'anti_arbitrage_check',
  'enemy_schema_config',
  'boss_skeleton_config',
  'prebattle_preview_config',
  'ship_pilot_fit_config',
  'core_plugin_fit_config',
  'building_config',
  'building_unlock_config',
  'building_level_cost_param',
  'building_level_effect_param',
  'building_anchor_impact_check',
  'mainline_node_config',
  'chapter_config',
  'star_region_config',
  'boss_node_config',
  'tutorial_trigger_config',
  'unlock_checkpoint_config',
  'protection_reset_config',
  'reward_pool_ref_config',
  'no_ad_path_check_config',
  'risk_fallback_70_config',
  'battle_unit_stat_param',
  'battle_effect_param',
  'battle_encounter_param',
  'battle_spawn_param',
  'battle_boss_phase_param',
  'commission_affix_param',
];

export class S7ConfigLoadError extends Error {
  constructor(public readonly errors: S7ValidationError[]) {
    super(`s7 config validation failed: ${errors.length} error(s)`);
  }
}

export class S7ConfigLoader {
  private bundle: S7ConfigBundle | null = null;
  private indexes = new Map<S7ConfigTableName, Map<string, unknown>>();
  private version = '';

  static get resourcePaths(): Record<S7ConfigTableName, string> {
    return { ...S7_TABLE_FILES };
  }

  loadFromData(raw: Record<S7ConfigTableName, unknown[]>): void {
    const errors = validateS7ConfigBundle(raw);
    if (errors.length > 0) {
      throw new S7ConfigLoadError(errors);
    }

    const bundle = raw as unknown as S7ConfigBundle;
    this.bundle = bundle;
    this.indexes.clear();
    for (const table of S7_TABLE_NAMES) {
      const idField = S7_ID_FIELD[table];
      const map = new Map<string, unknown>();
      for (const row of bundle[table] as unknown as Array<Record<string, unknown>>) {
        map.set(row[idField] as string, row);
      }
      this.indexes.set(table, map);
    }

    const first = bundle.battle_template_config[0];
    this.version = first ? first.schemaVersion : 'unknown';
  }

  get loadedVersion(): string {
    return this.version;
  }

  isLoaded(): boolean {
    return this.bundle !== null;
  }

  getAll<T = unknown>(table: S7ConfigTableName): T[] {
    this.assertLoaded();
    return this.bundle![table] as unknown as T[];
  }

  getById<T = unknown>(table: S7ConfigTableName, id: string): T | undefined {
    this.assertLoaded();
    return this.indexes.get(table)?.get(id) as T | undefined;
  }

  private assertLoaded(): void {
    if (!this.bundle) {
      throw new Error('S7ConfigLoader: configs not loaded yet');
    }
  }
}
