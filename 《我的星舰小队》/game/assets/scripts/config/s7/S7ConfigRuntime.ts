// S7 配置运行时加载层（CC-07A，纯 TS，不依赖 cc）。
//
// 职责：按 S7_TABLE_FILES 清单集中读取全部 43 张 S7 配置表，组装为 bundle，
// 交给 S7ConfigLoader.loadFromData 完成 schema 校验与索引，并对外仅暴露只读访问入口。
//
// 与运行时资源系统解耦：真机读取（cc.resources / wx）由调用方通过注入 S7TableReader 提供
// （真机实现见 S7ConfigResourceReader.ts），本文件不 import 'cc'，可在 Node / vitest 下单测。
//
// 边界（依 CC-07-PRE 决策收口）：仅加载 + 只读访问，不接战斗 / 主线 / 奖励 / 背包 / 存档 /
// 养成 / 建筑 / 商人 / 回收；不写玩家存档、不迁移 saveVersion、不新增 storage key；
// 不复用流程版 BattleEngine / PlayerState / LevelProgression / HeroStatGrowthService 业务逻辑；
// 不新增 HP / atk / def 战斗数值层；不改 43 张表或 03-04 v0.2 冻结口径；powerIndex 不进玩法判定。

import { S7ConfigTableName, S7_TABLE_FILES } from './ConfigTypesS7';
import { S7ConfigLoader } from './ConfigLoaderS7';

/**
 * 运行时表读取器：按表名 + 资源路径返回该表已解析的行数组。
 * 真机由 cc.resources / wx 实现（见 S7ConfigResourceReader.ts）；测试可注入 fs / 内存实现。
 * 约定：读取失败应抛错或 reject，不得静默返回兜底数据（缺表 / 错数据交由后续校验暴露）。
 */
export type S7TableReader = (
  tableName: S7ConfigTableName,
  resourcePath: string,
) => Promise<unknown[]>;

/** 规范的 43 张表加载顺序：直接取自 S7_TABLE_FILES，保持单一清单真源，避免再抄一份表名列表。 */
export const S7_RUNTIME_TABLE_NAMES: S7ConfigTableName[] =
  Object.keys(S7_TABLE_FILES) as S7ConfigTableName[];

/** 装配阶段错误（区别于 loadFromData 的校验错误 S7ConfigLoadError）：表读取失败 / 返回非数组。 */
export class S7ConfigAssembleError extends Error {
  constructor(
    public readonly tableName: S7ConfigTableName,
    message: string,
  ) {
    super(`s7 table "${tableName}" 装配失败: ${message}`);
    this.name = 'S7ConfigAssembleError';
  }
}

/**
 * 按清单读取全部 45 张表并组装为 loadFromData 所需的 bundle。
 * 任一表读取失败 / 返回非数组即抛 S7ConfigAssembleError（不静默吞错）。
 * 注意：本函数只负责"读齐并组装"，不做内容校验——内容校验在 S7ConfigLoader.loadFromData 内统一执行。
 */
export async function assembleS7Bundle(
  reader: S7TableReader,
): Promise<Record<S7ConfigTableName, unknown[]>> {
  const bundle = {} as Record<S7ConfigTableName, unknown[]>;
  for (const tableName of S7_RUNTIME_TABLE_NAMES) {
    const resourcePath = S7_TABLE_FILES[tableName];
    let rows: unknown[];
    try {
      rows = await reader(tableName, resourcePath);
    } catch (err) {
      throw new S7ConfigAssembleError(tableName, (err as Error)?.message ?? String(err));
    }
    if (!Array.isArray(rows)) {
      throw new S7ConfigAssembleError(
        tableName,
        `期望数组，实际为 ${rows === null ? 'null' : typeof rows}`,
      );
    }
    bundle[tableName] = rows;
  }
  return bundle;
}

/**
 * 便捷内存读取器：调用方已持有全部已解析行时直接喂入（测试 / 预加载场景）。
 * 缺表返回空数组——刻意不在此补默认，让缺表 / 数量错误在 loadFromData 校验阶段被暴露。
 */
export function createInMemoryS7TableReader(
  bundle: Partial<Record<S7ConfigTableName, unknown[]>>,
): S7TableReader {
  return async (tableName) => bundle[tableName] ?? [];
}

/**
 * S7 配置运行时只读访问层。
 *
 * 由 S7ConfigRuntime.load 经注入的 reader 装配并校验后构建；对外仅暴露只读查询，
 * 不暴露 loadFromData 或任何写入入口，避免配置在运行时被二次改写。
 * 与 S7ConfigLoader.getAll 一致，getAll 返回底层数组引用（加载后一次性、不再变更的配置数据），
 * 调用方不得修改返回内容。
 */
export class S7ConfigRuntime {
  private constructor(private readonly loader: S7ConfigLoader) {}

  /**
   * 经注入的 reader 读取全部 43 张表，校验后构建只读运行时。
   * 校验失败抛 S7ConfigLoadError；表读取失败 / 非数组抛 S7ConfigAssembleError。
   */
  static async load(reader: S7TableReader): Promise<S7ConfigRuntime> {
    const bundle = await assembleS7Bundle(reader);
    const loader = new S7ConfigLoader();
    loader.loadFromData(bundle); // 内部 validateS7ConfigBundle，校验失败抛 S7ConfigLoadError
    return new S7ConfigRuntime(loader);
  }

  /** 已加载配置版本（schemaVersion），未加载时为空串。 */
  get version(): string {
    return this.loader.loadedVersion;
  }

  isLoaded(): boolean {
    return this.loader.isLoaded();
  }

  /** 已加载的 43 张表名（只读副本）。 */
  get tableNames(): S7ConfigTableName[] {
    return [...S7_RUNTIME_TABLE_NAMES];
  }

  /** 取整表行（加载后只读，调用方不得修改返回数组）。 */
  getAll<T = unknown>(table: S7ConfigTableName): T[] {
    return this.loader.getAll<T>(table);
  }

  /** 按表内唯一 ID 取单行；不存在返回 undefined。 */
  getById<T = unknown>(table: S7ConfigTableName, id: string): T | undefined {
    return this.loader.getById<T>(table, id);
  }

  /** 是否存在指定 ID 的行。 */
  has(table: S7ConfigTableName, id: string): boolean {
    return this.loader.getById(table, id) !== undefined;
  }
}
