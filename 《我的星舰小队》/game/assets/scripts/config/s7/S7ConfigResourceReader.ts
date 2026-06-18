// S7 配置运行时读取器 - Cocos 真机实现（CC-07A）。
//
// 仅封装 cc.resources 读取 JsonAsset 的细节，产出 S7ConfigRuntime 所需的 S7TableReader。
// 本文件 import 'cc'，只在真机 / 编辑器运行链路使用；纯 TS 单测请用 S7ConfigRuntime + 注入 reader，
// 不要在测试中 import 本文件（避免 Node / vitest 解析 'cc' 失败）。
//
// 边界同 CC-07-PRE：仅加载配置 JSON，不接业务系统、不写存档、不做 UI / 美术 / 资源导入。

import { resources, JsonAsset } from 'cc';
import { S7TableReader } from './S7ConfigRuntime';

/**
 * 资源根下 S7 配置目录前缀。
 * S7_TABLE_FILES 给出的相对名是 "s7/<table>.sample"，而配置实际位于
 * assets/resources/configs/s7/ 下，故 cc.resources 路径需补 "configs/" 前缀，
 * 得到 "configs/s7/<table>.sample"（cc.resources 路径相对 resources 根、不含扩展名）。
 */
const S7_RESOURCE_PREFIX = 'configs/';

/**
 * 构建基于 cc.resources 的 S7 表读取器：把每张表的 JsonAsset 读为行数组。
 * 读取失败 / 资源为空 / JSON 非数组即 reject，由上层 assembleS7Bundle 统一抛 S7ConfigAssembleError。
 */
export function createCocosS7TableReader(): S7TableReader {
  return (_tableName, resourcePath) =>
    new Promise<unknown[]>((resolve, reject) => {
      const fullPath = `${S7_RESOURCE_PREFIX}${resourcePath}`;
      resources.load(fullPath, JsonAsset, (err, asset) => {
        if (err || !asset) {
          reject(err ?? new Error(`资源为空: ${fullPath}`));
          return;
        }
        const json = asset.json;
        if (!Array.isArray(json)) {
          reject(new Error(`配置 JSON 非数组: ${fullPath}`));
          return;
        }
        resolve(json as unknown[]);
      });
    });
}
