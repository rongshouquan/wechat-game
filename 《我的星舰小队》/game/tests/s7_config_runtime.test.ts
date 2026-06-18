// CC-07A 装配冒烟测试：证明 43 张 S7 表可被运行时加载层（S7ConfigRuntime）完整加载、校验、只读访问。
// 用 fs reader 替代真机 cc.resources reader（纯 TS 层与读取实现解耦），断言：
// 全表读齐 -> loadFromData 校验通过 -> 版本/计数/索引可只读访问 -> 错误路径正确暴露。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  S7ConfigRuntime,
  S7ConfigAssembleError,
  S7_RUNTIME_TABLE_NAMES,
  assembleS7Bundle,
  createInMemoryS7TableReader,
  S7TableReader,
} from '../assets/scripts/config/s7/S7ConfigRuntime';
import { S7ConfigLoadError } from '../assets/scripts/config/s7/ConfigLoaderS7';
import { S7ConfigTableName } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

/** fs 读取器：按表名从真实 configs/s7 目录读取 .sample.json（对应真机的 cc.resources reader）。 */
const fsReader: S7TableReader = async (tableName) =>
  JSON.parse(readFileSync(path.join(S7_DIR, `${tableName}.sample.json`), 'utf-8')) as unknown[];

describe('s7 config runtime loading layer (CC-07A)', () => {
  it('manifest enumerates exactly the 43 s7 tables', () => {
    expect(S7_RUNTIME_TABLE_NAMES).toHaveLength(43);
    expect(new Set(S7_RUNTIME_TABLE_NAMES).size).toBe(43);
  });

  it('assembles all 43 tables into a bundle of non-empty row arrays', async () => {
    const bundle = await assembleS7Bundle(fsReader);
    expect(Object.keys(bundle)).toHaveLength(43);
    for (const t of S7_RUNTIME_TABLE_NAMES) {
      expect(Array.isArray(bundle[t])).toBe(true);
      expect(bundle[t].length).toBeGreaterThan(0);
    }
  });

  it('loads + validates the full plate and exposes a read-only runtime', async () => {
    const rt = await S7ConfigRuntime.load(fsReader);
    expect(rt.isLoaded()).toBe(true);
    expect(rt.version).toBe('s7-0.1.0');
    expect(rt.tableNames).toHaveLength(43);
    // 每张表都可经只读入口访问且非空
    for (const t of rt.tableNames) {
      expect(rt.getAll(t).length).toBeGreaterThan(0);
    }
  });

  it('keeps default-plate / structural counts intact through the runtime layer', async () => {
    const rt = await S7ConfigRuntime.load(fsReader);
    expect(rt.getAll('battle_template_config')).toHaveLength(10);
    expect(rt.getAll('ship_config')).toHaveLength(12);
    expect(rt.getAll('pilot_config')).toHaveLength(10);
    expect(rt.getAll('core_config')).toHaveLength(7); // 块3b 注册过载核心 core07
    expect(rt.getAll('plugin_config')).toHaveLength(18);
    expect(rt.getAll('mainline_node_config')).toHaveLength(75);
  });

  it('indexes rows by id for getById / has via the runtime facade', async () => {
    const rt = await S7ConfigRuntime.load(fsReader);
    expect(rt.getById<{ name: string }>('ship_config', 'shp01')?.name).toBe('晨星护卫舰');
    expect(rt.getById<{ rowId: string }>('power_reference_param', 'd28')?.rowId).toBe('d28');
    expect(rt.has('boss_node_config', 'n075')).toBe(true);
    expect(rt.has('ship_config', 'shp_nonexistent')).toBe(false);
    expect(rt.getById('ship_config', 'shp_nonexistent')).toBeUndefined();
  });

  it('round-trips through an in-memory reader (preloaded data path)', async () => {
    const bundle = await assembleS7Bundle(fsReader);
    const rt = await S7ConfigRuntime.load(createInMemoryS7TableReader(bundle));
    expect(rt.isLoaded()).toBe(true);
    expect(rt.tableNames).toHaveLength(43);
    expect(rt.getAll('ship_config')).toHaveLength(12);
  });

  it('does NOT expose loadFromData or any write entry on the read-only facade', async () => {
    const rt = await S7ConfigRuntime.load(fsReader);
    expect((rt as unknown as Record<string, unknown>).loadFromData).toBeUndefined();
  });

  it('surfaces validation failure as S7ConfigLoadError when a counted table is short', async () => {
    const bundle = await assembleS7Bundle(fsReader);
    const shortBundle = { ...bundle, ship_config: bundle.ship_config.slice(0, 11) };
    await expect(S7ConfigRuntime.load(createInMemoryS7TableReader(shortBundle))).rejects.toBeInstanceOf(
      S7ConfigLoadError,
    );
  });

  it('surfaces a reader throw as S7ConfigAssembleError naming the failed table', async () => {
    const throwingReader: S7TableReader = async (tableName) => {
      if (tableName === 'core_config') throw new Error('resource missing');
      return JSON.parse(readFileSync(path.join(S7_DIR, `${tableName}.sample.json`), 'utf-8')) as unknown[];
    };
    await expect(S7ConfigRuntime.load(throwingReader)).rejects.toBeInstanceOf(S7ConfigAssembleError);
    await expect(S7ConfigRuntime.load(throwingReader)).rejects.toThrow(/core_config/);
  });

  it('surfaces a non-array table as S7ConfigAssembleError', async () => {
    const badReader: S7TableReader = async (tableName) => {
      if (tableName === 'pressure_param') return {} as unknown as unknown[];
      return JSON.parse(readFileSync(path.join(S7_DIR, `${tableName}.sample.json`), 'utf-8')) as unknown[];
    };
    await expect(assembleS7Bundle(badReader)).rejects.toBeInstanceOf(S7ConfigAssembleError);
  });
});
